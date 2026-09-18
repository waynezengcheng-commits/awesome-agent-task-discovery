import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, CircleHelp, ExternalLink, Github, Layers, Search, ShieldCheck, Sparkles, Target, X, Zap } from "lucide-react";
import tasks from "./data/tasks.json";

type Task = (typeof tasks)[number];
const repositoryUrl = "https://github.com/waynezengcheng-commits/awesome-agent-task-discovery";
const discoveryUrl = `${repositoryUrl}/actions/workflows/discover-tasks.yml`;
const savedKey = "agent-task-radar:saved";
const getSaved = () => { try { const x = JSON.parse(localStorage.getItem(savedKey) ?? "[]"); return Array.isArray(x) ? x.filter((id) => typeof id === "string") : []; } catch { return []; } };
const issueUrl = () => `${repositoryUrl}/issues/new?title=${encodeURIComponent("[Task opportunity] ")}&body=${encodeURIComponent("## Agent task\n\n## Trigger and expected outcome\n\n## Execution loop\n\n## Success metric\n\n## Human approval or safety boundary\n\n## Supporting evidence\n")}`;

export default function App() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [priority, setPriority] = useState("全部");
  const [saved, setSaved] = useState<string[]>(getSaved);
  const [onlySaved, setOnlySaved] = useState(false);
  const [active, setActive] = useState<Task | null>(null);
  const [toast, setToast] = useState("");
  const categories = useMemo(() => ["全部", ...new Set(tasks.map((task) => task.category))], []);
  const visible = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase();
    return tasks.filter((task) => category === "全部" || task.category === category)
      .filter((task) => priority === "全部" || task.priority === priority)
      .filter((task) => !onlySaved || saved.includes(task.id))
      .filter((task) => !terms || [task.title, task.summary, task.agentLoop, task.category, ...task.tags].join(" ").toLocaleLowerCase().includes(terms))
      .sort((a, b) => b.score - a.score);
  }, [category, onlySaved, priority, query, saved]);
  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem(savedKey, JSON.stringify(next)); setToast(next.includes(id) ? "已收藏到此浏览器" : "已取消收藏"); } catch { setToast("浏览器未允许保存收藏"); }
  };
  return <>
    <header className="header">
      <a className="brand" href="#top"><span className="brand-icon"><Zap size={23} fill="currentColor" /></span>agent<span className="brand-tasks">tasks</span><span className="beta">RADAR</span></a>
      <nav aria-label="主导航" className="header-utilities"><button className={!onlySaved ? "nav-item active" : "nav-item"} onClick={() => setOnlySaved(false)}>发现任务</button><button className={onlySaved ? "nav-item active" : "nav-item"} onClick={() => setOnlySaved(true)}><Bookmark size={16} /> 收藏 <span className="nav-count">{saved.length}</span></button></nav>
      <a className="button dark submit-top" href={issueUrl()} target="_blank" rel="noreferrer"><Target size={16} />提交任务机会</a>
    </header>
    <main className="page" id="top">
      <section className="hero" aria-labelledby="hero-heading"><div className="hero-copy"><p className="eyebrow">SOURCE-BACKED TASK DISCOVERY</p><h1 id="hero-heading">先找到最值得交给 Agent 的工作。</h1><p>每周自动检索公开 GitHub Agent 工作流，再按场景、采用信号与安全边界生成候选任务。</p><a className="text-link" href="#explore">查看任务机会 <ArrowUpRight size={15} /></a></div><div className="decision-canvas" aria-label="Agent 任务价值筛选方法"><div className="canvas-heading"><span>SIGNAL → PRIORITY</span><span className="mono">task.score()</span></div><div className="decision-flow"><div className="flow-in"><Layers size={20} /><span>工作信号</span></div><span className="connector" /><div className="fit-node"><Target size={23} /><strong>fit</strong></div><span className="connector" /><div className="flow-out"><span>频率</span><span>影响</span><span>边界</span></div></div><div className="canvas-footer">用可验证的任务闭环决定优先级。<ArrowRight size={14} /></div></div></section>
      <section className="stats" aria-label="任务统计"><div><span className="stat-value">{tasks.length.toString().padStart(2, "0")}</span><span>任务机会</span></div><div><span className="stat-value">{tasks.filter((task) => task.priority === "P0").length}</span><span>P0 优先验证</span></div><div><span className="stat-value">{categories.length - 1}</span><span>业务场景</span></div><div className="data-updated"><span>公开发现</span><strong>每周更新</strong></div></section>
      <section className="explorer" id="explore"><aside className="sidebar"><div className="side-title">场景 <span>{categories.length - 1}</span></div><div className="category-list">{categories.map((item) => <button key={item} className={category === item ? "category active" : "category"} onClick={() => setCategory(item)}><Layers size={16} /><span>{item}</span><b>{item === "全部" ? tasks.length : tasks.filter((task) => task.category === item).length}</b></button>)}</div><div className="side-note"><span className="mini-radar"><ShieldCheck size={19} /></span><h3>从机会到试点</h3><p>公开候选每周更新；先验证一个可控闭环，再扩大自动化范围。</p><a href={discoveryUrl} target="_blank" rel="noreferrer">查看或手动运行发现 <ArrowUpRight size={15} /></a></div><a className="side-source" href={repositoryUrl} target="_blank" rel="noreferrer">任务方法与数据 <ExternalLink size={12} /></a></aside>
      <div className="results"><div className="search-row"><div className="search-box"><Search size={19} /><input aria-label="搜索任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、场景或能力（如：代码审查、工单、安全）…" />{query && <button className="clear-search" onClick={() => setQuery("")} aria-label="清空搜索"><X size={16} /></button>}</div><select className="filter-button" aria-label="优先级" value={priority} onChange={(event) => setPriority(event.target.value)}><option>全部</option><option>P0</option><option>P1</option><option>P2</option></select></div><div className="results-heading"><h2>{onlySaved ? "我的收藏" : "高价值任务"}<span>{visible.length}</span></h2><span className="ticker-note">按价值分排序</span></div><div className="project-grid">{visible.map((task) => <article className="project-card" key={task.id}><div className="card-top"><div className="project-identity"><div className="avatar avatar-fallback"><Target size={19} /></div><div><button className="project-title" onClick={() => setActive(task)}>{task.title}<ArrowUpRight size={15} /></button><span className="author">{task.frequency}</span></div></div><button className={`icon-button save-button ${saved.includes(task.id) ? "saved" : ""}`} aria-label={`收藏 ${task.title}`} onClick={() => toggleSaved(task.id)}><Bookmark size={18} fill={saved.includes(task.id) ? "currentColor" : "none"} /></button></div><div className="card-category"><Sparkles size={13} />{task.category}<span className="auto-label">{task.priority} · {task.score}</span></div><p className="plain-summary">{task.summary}</p><div className="decision-block"><div><Zap size={13} fill="currentColor" /><span>Agent 可接手的环节</span></div><p>{task.agentLoop}</p></div><p className="benefit"><ArrowRight size={14} />{task.successMetric}</p><div className="tags">{task.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></article>)}</div>{!visible.length && <div className="empty-state"><Search size={30} /><h3>没有匹配的任务</h3><p>试试更短的关键词，或放宽场景和优先级筛选。</p></div>}<div className="result-footer"><span>{visible.length} / {tasks.length} 个任务</span><span>优先级是探索参考，不等于 ROI 承诺 <CircleHelp size={13} /></span></div></div></section>
      <footer className="footer"><a className="footer-brand" href={repositoryUrl} target="_blank" rel="noreferrer"><Zap size={16} />Agent Tasks · 高价值任务雷达</a><span>静态、可审阅的任务目录</span><a href={repositoryUrl} target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a></footer>
    </main>
    {active && <dialog open className="modal" aria-label={active.title}><div className="modal-head"><h2>{active.title}</h2><button className="icon-button" aria-label="关闭" onClick={() => setActive(null)}><X size={20} /></button></div><div className="detail-author"><span>{active.category}</span><span className="tag">{active.priority} · {active.score}/99</span></div><p className="detail-summary">{active.summary}</p><div className="decision-block"><div><Zap size={14} />Agent 执行闭环</div><p>{active.agentLoop}</p></div><p className="detail-benefit">{active.successMetric}</p><div className="evidence"><h3>安全与人工边界</h3><p>{active.guardrail}</p><a href={active.evidenceUrl} target="_blank" rel="noreferrer">{active.evidenceLabel}<ExternalLink size={13} /></a></div><div className="detail-actions"><button className="button" onClick={() => toggleSaved(active.id)}><Bookmark size={15} />{saved.includes(active.id) ? "取消收藏" : "收藏任务"}</button><a className="button dark" href={issueUrl()} target="_blank" rel="noreferrer">提交类似任务 <ArrowUpRight size={15} /></a></div></dialog>}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </>;
}
