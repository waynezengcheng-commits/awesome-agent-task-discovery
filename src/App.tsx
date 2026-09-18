import { useEffect, useId, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Braces,
  Check,
  CheckCheck,
  CircleHelp,
  Code2,
  Copy,
  ExternalLink,
  Filter,
  Gamepad2,
  GitFork,
  Github,
  Globe,
  Layers,
  Network,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Terminal,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { validateSubmission, createIssueUrl } from "./lib/submission.mjs";
import type { SubmissionErrors, SubmissionValues } from "./lib/submission.mjs";
import { translate, categoryEnglish, readLocale } from "./lib/i18n";
import type { Locale } from "./lib/i18n";

type Project = {
  id: string;
  name: string;
  author: string;
  url: string;
  category: string;
  plainSummary: string;
  jevDecisionPoint: string;
  highlightBenefit: string;
  tags: string[];
  stars: number | null;
  forks: number | null;
  openIssues: number | null;
  license: string | null;
  lastCommitAt: string | null;
  createdAt: string | null;
  summarySource: string;
  claimStatus: string;
  avatarUrl?: string;
  metadataFetchedAt?: string;
  evidence?: { url: string; note?: string }[];
  pinned?: boolean;
  plainSummaryEn?: string;
  jevDecisionPointEn?: string;
  highlightBenefitEn?: string;
  claimStatusEn?: string;
};
const categoryInfo: Record<string, { label: string; icon: LucideIcon }> = {
  "SDK & Integrations": { label: "SDK 与兼容接入", icon: Braces },
  "Evaluation & Observability": {
    label: "评测与观测",
    icon: SlidersHorizontal,
  },
  "Voice & Conversation": { label: "语音与对话", icon: Terminal },
  "Data & Search": { label: "数据与搜索", icon: Search },
  "Classification & Taxonomy": { label: "分类与目录", icon: Layers },
  "SDK & Decision Frameworks": { label: "SDK 与决策框架", icon: Braces },
  "Creative Tools": { label: "音乐与界面创作", icon: Sparkles },
  "Benchmarks & Evaluation": { label: "基准与评测", icon: SlidersHorizontal },
  "Decision Tools": { label: "决策工具", icon: Workflow },
  "Browser & OS Action": { label: "浏览器与桌面", icon: Globe },
  "MCP & Integrations": { label: "MCP 与集成", icon: Braces },
  "CLI & Pipelines": { label: "命令行与流水线", icon: Terminal },
  "Routing & Cost Optimization": { label: "模型路由与降本", icon: Workflow },
  "Context GC & Filter": { label: "上下文与记忆", icon: Layers },
  "Codebase & Graph Pathfinding": { label: "代码与图谱", icon: Network },
  "High-Frequency & Simulation": { label: "游戏与实时决策", icon: Gamepad2 },
  "Domain & Vertical Tools": { label: "行业应用", icon: ShieldCheck },
  "Security & Guardrails": { label: "安全与内容审核", icon: ShieldCheck },
};
const format = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("en-US").format(n);
/** Transparent task triage: category impact + public adoption + source evidence. */
const opportunityScore = (project: Project) => {
  const impact: Record<string, number> = {
    "Security & Guardrails": 92,
    "Codebase & Graph Pathfinding": 90,
    "Browser & OS Action": 89,
    "Routing & Cost Optimization": 87,
    "Data & Search": 85,
    "Voice & Conversation": 81,
    "MCP & Integrations": 80,
    "Context GC & Filter": 79,
    "Evaluation & Observability": 78,
  };
  const maturity = Math.min(6, Math.floor(Math.log10((project.stars ?? 0) + 1) * 2));
  return Math.min(99, (impact[project.category] ?? 74) + maturity + (project.evidence?.length ? 2 : 0));
};
const opportunityTier = (project: Project) =>
  opportunityScore(project) >= 90 ? "P0" : opportunityScore(project) >= 82 ? "P1" : "P2";
const date = (s: string | null | undefined, locale: Locale) =>
  s
    ? new Date(s).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
const validProject = (x: unknown): x is Project => {
  if (!x || typeof x !== "object") return false;
  const p = x as Project;
  return (
    [
      "id",
      "name",
      "author",
      "category",
      "plainSummary",
      "jevDecisionPoint",
      "highlightBenefit",
      "url",
      "claimStatus",
      "summarySource",
    ].every((k) => typeof p[k as keyof Project] === "string") &&
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(p.url) &&
    ["stars", "forks", "openIssues"].every(
      (k) =>
        p[k as keyof Project] === null ||
        (typeof p[k as keyof Project] === "number" &&
          Number.isFinite(p[k as keyof Project]) &&
          Number(p[k as keyof Project]) >= 0),
    ) &&
    ["license", "lastCommitAt", "createdAt"].every(
      (k) =>
        p[k as keyof Project] === null ||
        typeof p[k as keyof Project] === "string",
    ) &&
    (
      [
        "plainSummaryEn",
        "jevDecisionPointEn",
        "highlightBenefitEn",
        "claimStatusEn",
      ] as const
    ).every((k) => p[k] === undefined || typeof p[k] === "string") &&
    Array.isArray(p.tags) &&
    p.tags.every((t) => typeof t === "string") &&
    (!p.avatarUrl ||
      (typeof p.avatarUrl === "string" &&
        p.avatarUrl.startsWith("https://avatars.githubusercontent.com/"))) &&
    (!p.evidence ||
      (Array.isArray(p.evidence) &&
        p.evidence.every(
          (e) =>
            !!e && typeof e === "object" &&
            typeof e.url === "string" &&
            e.url.startsWith("https://") &&
            (!e.note || typeof e.note === "string"),
        )))
  );
};
const searchProjects = (fuse: Fuse<Project>, query: string): Project[] => {
  const aliases: Record<string, string[]> = {
    省成本: ["Cost Optimization", "Token Saver"],
    省钱: ["Cost Optimization", "Token Saver"],
    降本: ["Cost Optimization", "Token Saver"],
    浏览器: ["browser"],
    上下文: ["context", "compaction"],
    "9hz": ["9hz", "9 hz"],
  };
  const terms = [query, ...(aliases[query.trim().toLowerCase()] ?? [])];
  const hits = new Map<string, Project>();
  for (const term of terms)
    for (const hit of fuse.search(term)) hits.set(hit.item.id, hit.item);
  return [...hits.values()];
};
const getSaved = () => {
  try {
    const x = JSON.parse(localStorage.getItem("awesome-jev:saved") ?? "[]");
    return Array.isArray(x) ? x.filter((y) => typeof y === "string") : [];
  } catch {
    return [];
  }
};
function Modal({
  title,
  onClose,
  children,
  locale,
}: {
  locale: Locale;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const startedOutside = useRef(false);
  useEffect(() => {
    const el = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={onClose}
      onPointerDown={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        startedOutside.current =
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom;
      }}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const outside =
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom;
        if (e.target === e.currentTarget && startedOutside.current && outside)
          onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label={translate("关闭弹窗", locale)}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const t = (text: string) => translate(text, locale);
  const label = (category: string) =>
    locale === "en"
      ? (categoryEnglish[category] ?? category)
      : (categoryInfo[category]?.label ?? category);
  const projectText = (
    project: Project,
    key:
      "plainSummary" | "jevDecisionPoint" | "highlightBenefit" | "claimStatus",
  ) => {
    const english =
      project[
        `${key}En` as
          | "plainSummaryEn"
          | "jevDecisionPointEn"
          | "highlightBenefitEn"
          | "claimStatusEn"
      ];
    return locale === "en" && english?.trim() ? english : project[key];
  };
  useEffect(() => {
    try {
      localStorage.setItem("awesome-jev:locale", locale);
    } catch {
      /* Current-visit language still works. */
    }
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title =
      locale === "zh"
        ? "Agent 任务雷达 — 发现值得自动化的工作"
        : "Agent Opportunity Radar — Find work worth automating";
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute(
      "content",
      locale === "zh"
        ? "从可验证的开源实践中发现高价值 Agent 任务：高频、可执行、可衡量，并附来源证据。"
        : "Discover high-value Agent work from verifiable open-source practice: repeatable, executable, measurable, and source-backed.",
    );
  }, [locale]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    fetch(`${import.meta.env.BASE_URL}projects.json`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Project snapshot unavailable");
        return response.json();
      })
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error("Empty project snapshot");
        }
        const validRows = rows.filter(validProject);
        if (validRows.length === 0) {
          throw new Error("No valid projects found");
        }
        setProjects(validRows);
        setLoadState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });
    return () => controller.abort();
  }, [loadAttempt]);
  const updatedAt = useMemo(
    () =>
      projects.reduce(
        (latest, project) =>
          project.metadataFetchedAt && project.metadataFetchedAt > latest
            ? project.metadataFetchedAt
            : latest,
        "",
      ),
    [projects],
  );
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [stars, setStars] = useState("all");
  const [sort, setSort] = useState("value");
  const [saved, setSaved] = useState<string[]>(getSaved);
  const [onlySaved, setOnlySaved] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<"submit" | null>(null);
  const [active, setActive] = useState<Project | null>(null);
  const [toast, setToast] = useState("");
  const [repo, setRepo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [decision, setDecision] = useState("");
  const [formErrors, setFormErrors] = useState<SubmissionErrors>({});
  const [issueDraftUrl, setIssueDraftUrl] = useState<string | null>(null);
  const [shareFallback, setShareFallback] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const submissionFormRef = useRef<HTMLFormElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(query), 90);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2400);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const editable = (e.target as HTMLElement).matches(
        'input,textarea,select,[contenteditable="true"]',
      );
      if (
        (e.key === "/" && !editable && !e.metaKey && !e.ctrlKey && !e.altKey) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")
      ) {
        if (!document.querySelector("dialog[open]")) {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        searchRef.current?.blur();
    };
    window.addEventListener("keydown", handler);
    const fromHash = () => {
      const id =
        new URLSearchParams(location.hash.slice(1)).get("project") ??
        new URLSearchParams(location.search).get("project");
      if(id)setModal(null);
      setActive(projects.find((p) => p.id === id) ?? null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [projects]);
  const categories = useMemo(
    () => [...new Set(projects.map((p) => p.category))],
    [projects],
  );
  const tags = useMemo(
    () => [...new Set(projects.flatMap((p) => p.tags))].sort(),
    [projects],
  );
  const fuse = useMemo(
    () =>
      new Fuse(projects, {
        keys: [
          { name: "name", weight: 3 },
          { name: "plainSummary", weight: 2 },
          "author",
          "jevDecisionPoint",
          "highlightBenefit",
          "plainSummaryEn",
          "jevDecisionPointEn",
          "highlightBenefitEn",
          "category",
          "tags",
        ],
        threshold: 0.34,
        ignoreLocation: true,
      }),
    [projects],
  );
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: "search_agent_opportunities",
      title: "Search Agent task opportunities",
      description:
        "Search source-backed Agent task opportunities. Returns task evidence and a transparent priority score; does not change filters or bookmarks.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, category: { type: "string" } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input: unknown) => {
        const q = input as { query?: unknown; category?: unknown };
        if (
          !q ||
          typeof q.query !== "string" ||
          (q.category !== undefined && typeof q.category !== "string")
        )
          throw new Error("query and category must be strings");
        const found = q.query ? searchProjects(fuse, q.query) : projects;
        return {
          projects: found
            .filter((p) => !q.category || p.category === q.category)
            .slice(0, 20)
            .map((p) => ({
              id: p.id,
              name: p.name,
              summary: projectText(p, "plainSummary"),
              decision: projectText(p, "jevDecisionPoint"),
              priority: opportunityTier(p),
              score: opportunityScore(p),
              url: p.url,
            })),
          snapshotAt: updatedAt,
        };
      },
    };
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional API; normal UI remains available. */
    }
    return () => lifecycle.abort();
  }, [projects, fuse, updatedAt, locale]);
  const visible = useMemo(() => {
    const list = searchTerm.trim()
      ? searchProjects(fuse, searchTerm)
      : projects;
    return list
      .filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (tag === "all" || p.tags.includes(tag)) &&
          (!onlySaved || saved.includes(p.id)) &&
          (stars === "all" ||
            (p.stars !== null &&
              (stars === "100+"
                ? p.stars >= 100
                : stars === "10-99"
                  ? p.stars >= 10 && p.stars < 100
                  : p.stars < 10))),
      )
      .sort((a, b) =>
        sort === "created"
          ? Date.parse(b.createdAt ?? "1970") -
            Date.parse(a.createdAt ?? "1970")
          : sort === "updated"
            ? Date.parse(b.lastCommitAt ?? "1970") -
              Date.parse(a.lastCommitAt ?? "1970")
          : sort === "value"
            ? opportunityScore(b) - opportunityScore(a)
            : (b.stars ?? -1) - (a.stars ?? -1),
      );
  }, [
    fuse,
    searchTerm,
    category,
    tag,
    stars,
    onlySaved,
    saved,
    sort,
    projects,
  ]);
  const trending = useMemo(
    () =>
      [...projects]
        .filter((p) => p.stars !== null)
        .sort((a, b) => b.stars! - a.stars!)
        .slice(0, 4),
    [projects],
  );
  const totalStars = projects.reduce((s, p) => s + (p.stars ?? 0), 0);
  const metadataCount = projects.filter((p) => p.stars !== null).length;
  const toggleSaved = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("awesome-jev:saved", JSON.stringify(next));
      setToast(next.includes(id) ? t("已加入本机收藏") : t("已取消收藏"));
    } catch {
      setToast(t("已收藏，本次浏览有效；浏览器未允许保存"));
    }
  };
  const share = async (p: Project) => {
    const url = `${location.origin}${import.meta.env.BASE_URL}#project=${encodeURIComponent(p.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareFallback(null);
      setToast(t("项目链接已复制"));
    } catch {
      setShareFallback({ id: p.id, url });
      openProject(p);
      setToast(t("无法自动复制，请使用详情中的项目链接。"));
    }
  };
  const openProject = (p: Project) => {
    setModal(null);
    location.hash = `project=${encodeURIComponent(p.id)}`;
    setActive(p);
  };
  const closeProject = () => {
    const url = new URL(location.href);
    url.hash = "";
    url.searchParams.delete("project");
    history.replaceState(null, "", url.pathname + url.search);
    setActive(null);
    setShareFallback(null);
  };
  const clearSearch = () => {
    setQuery("");
    setSearchTerm("");
  };
  const reset = () => {
    clearSearch();
    setCategory("all");
    setTag("all");
    setStars("all");
    setOnlySaved(false);
  };
  const updateSubmission = (field: keyof SubmissionValues, value: string) => {
    ({ repo: setRepo, purpose: setPurpose, decision: setDecision })[field](
      value,
    );
    setFormErrors((previous) => ({ ...previous, [field]: undefined }));
    setIssueDraftUrl(null);
  };
  const openSubmission = () => {
    closeProject();
    setFormErrors({});
    setIssueDraftUrl(null);
    setModal("submit");
  };
  const submitProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { values, errors } = validateSubmission(
      { repo, purpose, decision },
      locale,
    );
    setFormErrors(errors);
    setIssueDraftUrl(null);
    const first = (["repo", "purpose", "decision"] as const).find(
      (field) => errors[field],
    );
    if (first) {
      requestAnimationFrame(() =>
        submissionFormRef.current
          ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            `[name="${first}"]`,
          )
          ?.focus(),
      );
      return;
    }
    setRepo(values.repo);
    setPurpose(values.purpose);
    setDecision(values.decision);
    const url = createIssueUrl(values, locale);
    // Keep this synchronous inside the user gesture; no awaited work before opening.
    window.open(url, "_blank", "noopener,noreferrer");
    setIssueDraftUrl(url);
  };
  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            reset();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="brand-icon">
            <Zap size={23} fill="currentColor" />
          </span>
          agent<span className="brand-jev">tasks</span>
          <span className="beta">RADAR</span>
        </a>
        <div className="header-utilities">
          <nav aria-label={t("主导航")}>
            <button
              className={!onlySaved ? "nav-item active" : "nav-item"}
              onClick={() => {
                setOnlySaved(false);
                setCategory("all");
              }}
            >
              {t("探索项目")}
            </button>
            <button
              className={onlySaved ? "nav-item active" : "nav-item"}
              onClick={() => setOnlySaved(true)}
              aria-label={`${t("我的收藏")} ${saved.length}`}
            >
              <Bookmark
                className="mobile-bookmark"
                size={18}
                aria-hidden="true"
              />
              <span className="saved-label">{t("我的收藏")}</span>
              <span className="nav-count">{saved.length}</span>
            </button>
          </nav>
          <button
            className="language-toggle"
            onClick={() => setLocale((value) => (value === "zh" ? "en" : "zh"))}
            aria-label={t(locale === "zh" ? "切换到英文" : "切换到中文")}
            title={t(locale === "zh" ? "切换到英文" : "切换到中文")}
          >
            <span className={locale === "zh" ? "current" : ""} lang="zh-CN">
              中
            </span>
            <span aria-hidden="true">/</span>
            <span className={locale === "en" ? "current" : ""} lang="en">
              EN
            </span>
          </button>
        </div>
        <div className="header-actions">
          <a
            className="button github-star"
            href="https://github.com/waynezengcheng-commits/awesome-agent-task-discovery"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("Star on GitHub（新标签页打开）")}
            title={t("到 GitHub 支持这个项目")}
          >
            <Star size={17} strokeWidth={1.75} aria-hidden="true" />
            <span>Star on GitHub</span>
          </a>
          <button className="button dark submit-top" onClick={openSubmission}>
            <Plus size={16} />
            <span>{t("提交任务机会")}</span>
          </button>
        </div>
      </header>
      <main className="page">
        <aside className="featured-banner" aria-label={t("推荐位")}>
          <div className="featured-copy">
            <Sparkles size={16} aria-hidden="true" />
            <p>
              <strong>{t("推荐位：")}</strong>{" "}
              {t("想让团队发现你验证过的 Agent 任务？")}
            </p>
          </div>
          <a
            href="https://x.com/0xLogicrw"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("立即联系")}
            <ArrowUpRight size={15} />
          </a>
        </aside>
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-copy">
            <h1 id="hero-heading">{t("先找到最值得交给 Agent 的工作。")}</h1>
            <p>
              {t("从可验证的开源实践反推任务机会。")}
              <br className="mobile-break" />{" "}
              {t("优先关注高频、高影响、能闭环验证的工作流。")}
            </p>
            <a
              className="text-link"
              href="#explore"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("查看任务筛选方法")}
              <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="decision-canvas" aria-label={t("Agent 任务价值筛选示意")}>
            <div className="canvas-heading">
              <span>SIGNAL → PRIORITY</span>
              <span className="mono">task.score()</span>
            </div>
            <div className="decision-flow">
              <div className="flow-in">
                <Code2 size={20} />
                <span>{t("任务与选项")}</span>
              </div>
              <span className="connector" />
              <div className="jev-node">
                <Zap size={23} fill="currentColor" />
                <strong>fit</strong>
              </div>
              <span className="connector" />
              <div className="flow-out">
                <span>
                  <CheckCheck size={16} />
                  {t("选一个")}
                </span>
                <span>
                  <SlidersHorizontal size={16} />
                  {t("打个分")}
                </span>
                <span>
                  <Workflow size={16} />
                  {t("下一步")}
                </span>
              </div>
            </div>
            <div className="canvas-footer">
              {t("用证据筛选任务，再决定 Agent 应该接手什么。")}
              <ArrowRight size={14} />
            </div>
          </div>
        </section>
        <section className="stats" aria-label={t("生态统计")}>
          <div>
            <span className="stat-value">
              {projects.length.toString().padStart(2, "0")}
            </span>
            <span>{t("任务机会")}</span>
          </div>
          <div>
            <span className="stat-value">
              {metadataCount ? format(totalStars) : "—"}
              <Star size={17} />
            </span>
            <span>
              GitHub Stars
              {metadataCount < projects.length ? t(" · 部分数据") : ""}
            </span>
          </div>
          <div>
            <span className="stat-value">
              {categories.length.toString().padStart(2, "0")}
            </span>
            <span>{t("应用方向")}</span>
          </div>
          <div className="data-updated">
            <span>{t("数据更新")}</span>
            <strong>{updatedAt ? date(updatedAt, locale) : "—"}</strong>
          </div>
        </section>
        {trending.length > 0 && (
          <div className="ticker">
            <span className="ticker-label">
              <Sparkles size={14} />
              {t("高信号机会")}
            </span>
            <div className="ticker-items">
              {trending.map((p) => (
                <button key={p.id} onClick={() => openProject(p)}>
                  {p.name}
                  <span>
                    <Star size={12} />
                    {format(p.stars)}
                  </span>
                </button>
              ))}
            </div>
            <span className="ticker-note">{t("按当前星数")}</span>
          </div>
        )}
        <section className="explorer" id="explore">
          <aside className="sidebar">
            <div className="side-title">
              {t("分类")} <span>{categories.length}</span>
            </div>
            <div className="category-list">
              <button
                className={category === "all" ? "category active" : "category"}
                onClick={() => setCategory("all")}
              >
                <Layers size={16} />
                <span>{t("全部机会")}</span>
                <b>{projects.length}</b>
              </button>
              {categories.map((c) => {
                const Icon = categoryInfo[c]?.icon ?? Code2;
                return (
                  <button
                    className={category === c ? "category active" : "category"}
                    key={c}
                    onClick={() => setCategory(c)}
                  >
                    <Icon size={16} />
                    <span>{label(c)}</span>
                    <b>{projects.filter((p) => p.category === c).length}</b>
                  </button>
                );
              })}
            </div>
            <div className="side-note">
              <span className="mini-radar">
                <Radar size={19} />
              </span>
              <h3>{t("让好项目被看见")}</h3>
              <p>
                {t("验证过一个 Agent 任务？")}
                <br />
                {t("把你的下一步，分享给大家。")}
              </p>
              <button onClick={openSubmission}>
                {t("提交任务机会")} <ArrowUpRight size={15} />
              </button>
            </div>
            <a
              className="side-source"
              href="https://github.com/waynezengcheng-commits/awesome-agent-task-discovery"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Agent Tasks · 高价值任务雷达")} <ExternalLink size={12} />
            </a>
          </aside>
          <div className="results">
            <div className="search-row">
              <div className="search-box">
                <Search size={19} />
                <input
                  ref={searchRef}
                  aria-label={t("搜索项目")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(
                    "搜任务、工作流或能力（如：代码审查、浏览器、路由、安全）...",
                  )}
                />
                {query ? (
                  <button
                    className="clear-search"
                    onClick={() => {
                      clearSearch();
                      searchRef.current?.focus();
                    }}
                    aria-label={t("清空搜索")}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <kbd>⌘ K</kbd>
                )}
              </div>
              <button
                className={`filter-button ${showFilters ? "selected" : ""}`}
                aria-label={t("展开筛选")}
                aria-expanded={showFilters}
                aria-controls="filter-panel"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={17} />
                <span>{t("筛选")}</span>
                {(tag !== "all" || stars !== "all") && <i />}
              </button>
            </div>
            {showFilters && (
              <div id="filter-panel" className="filter-panel">
                <label>
                  {t("技术标签")}
                  <select
                    aria-label={t("技术标签")}
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  >
                    <option value="all">{t("全部标签")}</option>
                    {tags.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  GitHub Stars
                  <select
                    aria-label={t("星数范围")}
                    value={stars}
                    onChange={(e) => setStars(e.target.value)}
                  >
                    <option value="all">{t("不限星数")}</option>
                    <option value="100+">{t("100 及以上")}</option>
                    <option value="10-99">10 – 99</option>
                    <option value="0-9">0 – 9</option>
                  </select>
                </label>
                <button className="text-link" onClick={reset}>
                  {t("重置筛选")}
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="results-heading">
              <h2>
                {onlySaved
                  ? t("我的收藏")
                  : category === "all"
                    ? t("发现任务")
                    : label(category)}
                <span>{visible.length}</span>
              </h2>
              <label className="sort-label">
                <ArrowDownWideNarrow size={15} />
                <select
                  aria-label={t("排序方式")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="value">{t("最高任务价值")}</option>
                  <option value="stars">{t("最多 Stars")}</option>
                  <option value="created">{t("最近创建")}</option>
                  <option value="updated">{t("最近更新")}</option>
                </select>
              </label>
            </div>
            <span className="sr-only" role="status" aria-live="polite">
              {loadState === "ready"
                ? `${visible.length} ${t("个匹配项目")}`
                : t("正在读取项目")}
            </span>
            <div className="project-grid" aria-busy={loadState === "loading"}>
              {visible.map((p) => {
                const Icon = categoryInfo[p.category]?.icon ?? Code2;
                return (
                  <article
                    className="project-card"
                    key={p.id}
                    data-project-id={p.id}
                  >
                    <div className="card-top">
                      <div className="project-identity">
                        {p.avatarUrl ? (
                          <img
                            src={p.avatarUrl}
                            alt=""
                            className="avatar"
                            width="40"
                            height="40"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="avatar avatar-fallback">
                            {p.author.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <button
                            className="project-title"
                            onClick={() => openProject(p)}
                          >
                            {p.name}
                            <ArrowUpRight size={15} />
                          </button>
                          <a
                            href={`https://github.com/${p.author}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="author"
                          >
                            {p.author}
                          </a>
                        </div>
                      </div>
                      <button
                        className={`icon-button save-button ${saved.includes(p.id) ? "saved" : ""}`}
                        aria-label={`${saved.includes(p.id) ? t("取消收藏") : t("收藏")} ${p.name}`}
                        aria-pressed={saved.includes(p.id)}
                        onClick={() => toggleSaved(p.id)}
                      >
                        <Bookmark
                          size={18}
                          fill={saved.includes(p.id) ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    <div className="card-category">
                      <Icon size={13} />
                      {label(p.category)}
                      {p.summarySource === "readme-extractive" && (
                        <span className="auto-label">{t("自动提炼")}</span>
                      )}
                      <span className="auto-label">{opportunityTier(p)} · {opportunityScore(p)}</span>
                    </div>
                    <p className="plain-summary">
                      {projectText(p, "plainSummary")}
                    </p>
                    <div className="decision-block">
                      <div>
                        <Zap size={13} fill="currentColor" />
                      <span>{t("Agent 可接手的环节")}</span>
                      </div>
                      <p>{projectText(p, "jevDecisionPoint")}</p>
                    </div>
                    <p className="benefit">
                      <ArrowRight size={14} />
                      {projectText(p, "highlightBenefit")}
                    </p>
                    <div className="tags">
                      {p.tags.slice(0, 3).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTag(t);
                            setShowFilters(true);
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="card-bottom">
                      <div className="repo-metrics">
                        <span title={t("最近同步的 GitHub Stars")}>
                          <Star size={15} />
                          {format(p.stars)}
                        </span>
                        <span title="Forks">
                          <GitFork size={14} />
                          {format(p.forks)}
                        </span>
                      </div>
                      <div>
                        <button
                          className="icon-button"
                          aria-label={`${t("分享")} ${p.name}`}
                          onClick={() => share(p)}
                        >
                          <Copy size={15} />
                        </button>
                        <a
                          className="github-link"
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Github size={15} />
                          GitHub
                          <ArrowUpRight size={13} />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {loadState === "loading" && (
              <div className="empty-state" role="status">
                {t("正在读取项目…")}
              </div>
            )}
            {loadState === "error" && (
              <div className="empty-state" role="alert">
                <p>{t("项目数据暂时无法读取。")}</p>
                <button
                  className="button"
                  onClick={() => setLoadAttempt((n) => n + 1)}
                >
                  {t("重试")}
                </button>
              </div>
            )}
            {loadState === "ready" && !visible.length && (
              <div className="empty-state">
                <Search size={30} />
                <h3>
                  {onlySaved && !saved.length
                    ? t("把想试的项目，留在这里。")
                    : t("还没有找到这样的项目")}
                </h3>
                <p>
                  {onlySaved && !saved.length
                    ? t("点击项目右上角的书签，即可收藏到本机。")
                    : t("试试更短的关键词，或放宽筛选条件。")}
                </p>
                <div className="empty-actions">
                  {query && (
                    <button className="button dark" onClick={clearSearch}>
                      {t("清空搜索")}
                      <X size={15} />
                    </button>
                  )}
                  {(category !== "all" ||
                    tag !== "all" ||
                    stars !== "all" ||
                    onlySaved) && (
                    <button className="button" onClick={reset}>
                      {onlySaved && !saved.length
                        ? t("浏览全部项目")
                        : t("重置筛选")}
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="result-footer">
              <span>
                {visible.length} / {projects.length} {t("个项目")}
              </span>
              <span>
                {t("性能数据来自项目说明，未经本站独立复测")}{" "}
                <CircleHelp size={13} />
              </span>
            </div>
          </div>
        </section>
        <footer className="footer">
          <a
            className="footer-brand"
            href="https://github.com/waynezengcheng-commits/awesome-agent-task-discovery"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Zap size={16} />
            {t("Agent Tasks · 高价值任务雷达")}
          </a>
          <span>{t("GitHub 数据定时同步")}</span>
          <a
            href="https://github.com/waynezengcheng-commits/awesome-agent-task-discovery"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
            <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
      {modal === "submit" && (
        <Modal
          locale={locale}
          title={t("提交任务机会")}
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            {t("说明任务如何触发、Agent 如何闭环执行，以及人工确认边界。")}
          </p>
          <form
            ref={submissionFormRef}
            className="submit-form"
            noValidate
            onSubmit={submitProject}
          >
            {Object.values(formErrors).some(Boolean) && (
              <p className="form-error-summary" role="alert">
                {t("请检查下面标出的信息，填写内容已保留。")}
              </p>
            )}
            <div className="form-field">
              <label htmlFor="submission-repo">{t("GitHub 仓库")}</label>
              <input
                id="submission-repo"
                name="repo"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-required="true"
                value={repo}
                onChange={(e) => updateSubmission("repo", e.target.value)}
                placeholder={t("owner/repo 或 GitHub 链接")}
                aria-invalid={Boolean(formErrors.repo)}
                aria-describedby={
                  formErrors.repo ? "repo-hint repo-error" : "repo-hint"
                }
              />
              <p id="repo-hint" className="field-hint">
                {t("支持仓库简称、文件链接和分支链接，会自动提取仓库地址。")}
              </p>
              {formErrors.repo && (
                <p id="repo-error" className="field-error">
                  {formErrors.repo}
                </p>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="submission-purpose">
                {t("一句话，这个 Agent 任务要完成什么？")}
              </label>
              <input
                id="submission-purpose"
                name="purpose"
                type="text"
                aria-required="true"
                value={purpose}
                onChange={(e) => updateSubmission("purpose", e.target.value)}
                placeholder={t("比如：帮 Claude Code 过滤不相关的日志")}
                aria-invalid={Boolean(formErrors.purpose)}
                aria-describedby={
                  formErrors.purpose ? "purpose-error" : undefined
                }
              />
              {formErrors.purpose && (
                <p id="purpose-error" className="field-error">
                  {formErrors.purpose}
                </p>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="submission-decision">
                {t("Agent 如何执行、验证并安全退出？")}
              </label>
              <textarea
                id="submission-decision"
                name="decision"
                aria-required="true"
                value={decision}
                onChange={(e) => updateSubmission("decision", e.target.value)}
                placeholder={t(
                  "它拿到什么输入？需要选择、打分，还是判断下一步？",
                )}
                rows={3}
                aria-invalid={Boolean(formErrors.decision)}
                aria-describedby={
                  formErrors.decision ? "decision-error" : undefined
                }
              />
              {formErrors.decision && (
                <p id="decision-error" className="field-error">
                  {formErrors.decision}
                </p>
              )}
            </div>
            <button className="button dark issue-submit" type="submit">
              <Github size={17} />
              {t("前往 GitHub 创建 Issue")}
              <ArrowUpRight size={15} />
            </button>
            {issueDraftUrl && (
              <div className="issue-draft-feedback" role="status">
                <p>
                  {t("已准备好 Issue 草稿。若新标签页未打开，可以直接继续：")}
                </p>
                <a
                  href={issueDraftUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("打开 GitHub Issue 草稿")}
                  <ArrowUpRight size={14} />
                </a>
              </div>
            )}
            <p className="fine-print">
              {t(
                "填写后点击继续，我们会检查并整理仓库地址。跳转后由你确认发布。",
              )}
            </p>
          </form>
        </Modal>
      )}
      {active && (
        <Modal locale={locale} title={active.name} onClose={closeProject}>
          <div className="detail-author">
            <span>{active.author}</span>
            <span className="tag">{label(active.category)}</span>
          </div>
          <p className="detail-summary">
            {projectText(active, "plainSummary")}
          </p>
          <div className="decision-block">
            <div>
              <Zap size={14} />
              {t("Agent 可接手的环节")}
            </div>
            <p>{projectText(active, "jevDecisionPoint")}</p>
          </div>
          <p className="detail-benefit">
            {projectText(active, "highlightBenefit")}
          </p>
          <dl className="detail-grid">
            <div>
              <dt>{t("任务优先级")}</dt>
              <dd>{opportunityTier(active)} · {opportunityScore(active)} / 99</dd>
            </div>
            <div>
              <dt>Stars / Forks</dt>
              <dd>
                {format(active.stars)} / {format(active.forks)}
              </dd>
            </div>
            <div>
              <dt>Issues + PR</dt>
              <dd>{format(active.openIssues)}</dd>
            </div>
            <div>
              <dt>{t("许可证")}</dt>
              <dd>{active.license ?? t("API 未识别")}</dd>
            </div>
            <div>
              <dt>{t("最近提交")}</dt>
              <dd>{date(active.lastCommitAt, locale)}</dd>
            </div>
          </dl>
          <div className="evidence">
            <h3>{t("来源与说明")}</h3>
            <p>{projectText(active, "claimStatus")}</p>
            {active.evidence?.map((e, i) => (
              <a key={i} href={e.url} target="_blank" rel="noopener noreferrer">
                {locale === "en"
                  ? t("查看来源证据")
                  : (e.note ?? t("查看 README 证据"))}
                <ExternalLink size={13} />
              </a>
            ))}
            <span>
              {t("数据更新")}：{date(active.metadataFetchedAt, locale)}
            </span>
          </div>
          {shareFallback?.id === active.id && (
            <label className="share-fallback">
              {t("项目链接")}
              <input
                aria-label={t("手动复制项目链接")}
                readOnly
                value={shareFallback.url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <span>{t("选中后复制即可分享。")}</span>
            </label>
          )}
          <div className="detail-actions">
            <a
              className="button dark"
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={16} />
              {t("打开仓库")}
              <ArrowUpRight size={15} />
            </a>
            <button className="button" onClick={() => share(active)}>
              <Copy size={15} />
              {t("复制链接")}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
export default App;
