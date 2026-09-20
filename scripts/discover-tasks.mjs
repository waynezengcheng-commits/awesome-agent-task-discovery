import { readFile, writeFile } from "node:fs/promises";
import { valueSignals } from './value-signals.mjs';
const cacheFile = new URL('../src/data/readme-cache.json', import.meta.url);
const cache = await readFile(cacheFile, 'utf8').then(JSON.parse).catch(() => ({}));

const dataFile = new URL("../src/data/tasks.json", import.meta.url);
const reportFile = new URL("../src/data/discovery.json", import.meta.url);
const token = process.env.GITHUB_TOKEN;
const pages = Math.min(5, Math.max(1, Number(process.env.DISCOVERY_PAGES ?? 3)));
const headers = { Accept: "application/vnd.github+json", "User-Agent": "agent-task-radar", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Industries are deliberately absent: these are universal Agent task primitives.
const plans = [
  ["感知与理解", '"agent" "vision"'], ["感知与理解", '"agent" "audio"'],
  ["感知与理解", '"agent" "video"'], ["感知与理解", '"agent" "document understanding"'],
  ["检索与关联", '"agent" "retrieval"'], ["检索与关联", '"agent" "semantic search"'],
  ["检索与关联", '"agent" "knowledge graph"'], ["检索与关联", '"agent" "information extraction"'],
  ["规划与决策", '"agent" "planning"'], ["规划与决策", '"agent" "routing"'],
  ["规划与决策", '"agent" "orchestration"'], ["规划与决策", '"agent" "scheduling"'],
  ["执行与操作", '"agent" "computer use"'], ["执行与操作", '"agent" "browser automation"'],
  ["执行与操作", '"agent" "desktop automation"'], ["执行与操作", '"agent" "mobile automation"'],
  ["执行与操作", '"agent" "API automation"'], ["执行与操作", '"agent" "robotics"'],
  ["验证与反馈", '"agent" "evaluation"'], ["验证与反馈", '"agent" "verification"'],
  ["验证与反馈", '"agent" "testing"'], ["验证与反馈", '"agent" "monitoring"'],
  ["跨模态推理", '"multimodal agent"'], ["跨模态推理", '"vision language agent"'],
  ["跨模态推理", '"audio visual agent"'], ["跨模态推理", '"video audio agent"'],
  ["跨模态推理", '"speech vision language agent"'], ["跨模态推理", '"screen audio computer use"'],
];
const queryLimit = Math.max(1, Math.min(plans.length, Number(process.env.DISCOVERY_QUERY_LIMIT ?? plans.length)));
const nonWorkflow = /(?:^|[-_\s])(awesome|course|tutorial|example|examples|paper|benchmark|collection|list|dataset)(?:$|[-_\s])/i;
const implementation = /\b(agent|autonomous|multi-agent)\b/i;
const actionSignal = /\b(tool|workflow|action|execute|automation|browser|api|robot|operate|evaluate|verify|review)\b/i;
const modalityRules = [["Vision", /\b(vision|image|visual|screen|gui|camera)\b/i], ["Video", /\b(video|temporal|frame)\b/i], ["Audio", /\b(audio|voice|speech|sound|transcri)\b/i], ["Text", /\b(text|document|language|llm|prompt)\b/i]];
const surfaceRules = [["Browser", /\b(browser|web|playwright|selenium)\b/i], ["Desktop", /\b(desktop|computer use|osworld|screen)\b/i], ["Mobile", /\b(mobile|android|ios|smartphone)\b/i], ["API", /\b(api|mcp|endpoint)\b/i], ["Robotics", /\b(robot|robotics|embodied)\b/i]];

async function search(query, page) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `${query} archived:false fork:false`);
  url.searchParams.set("sort", new Date().getUTCDate() % 2 ? "stars" : "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`GitHub search failed (${response.status}) for ${query}`);
  return response.json();
}
async function readme(repo) {
  if (cache[repo.full_name]?.pushedAt === repo.pushed_at) return cache[repo.full_name].text;
  const response = await fetch(`https://api.github.com/repos/${repo.full_name}/readme`, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) return "";
  const body = await response.json();
  const text = body.content ? Buffer.from(body.content, "base64").toString("utf8").slice(0, 30000) : "";
  cache[repo.full_name] = { pushedAt: repo.pushed_at, text };
  return text;
}
const labels = (text, rules) => rules.filter(([, rule]) => rule.test(text)).map(([label]) => label);
const freshness = (pushedAt) => {
  const age = Date.now() - Date.parse(pushedAt ?? "1970-01-01");
  if (age < 90 * 864e5) return 12;
  if (age < 365 * 864e5) return 7;
  return 1;
};

const raw = [];
for (const [, query] of plans.slice(0, queryLimit)) {
  for (let page = 1; page <= pages; page += 1) {
    const result = await search(query, page);
    console.log(`${query} page ${page}: ${result.items.length}`);
    raw.push(...result.items.map((repo) => ({ repo, query })));
    await wait(2100); // GitHub search permits ~30 requests/minute for tokens.
    if (result.items.length < 100) break;
  }
}
const candidates = new Map();
let rejected = 0;
for (const { repo, query } of raw) {
  const searchable = `${repo.name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`;
  if (repo.private || repo.fork || repo.archived) { rejected += 1; continue; }
  const prior = candidates.get(repo.html_url);
  if (!prior || repo.stargazers_count > prior.repo.stargazers_count) candidates.set(repo.html_url, { repo, queries: new Set([query]) });
  else prior.queries.add(query);
}
const ranked = [...candidates.values()].sort((a, b) => valueSignals(b.repo.description).valueSignalScore - valueSignals(a.repo.description).valueSignalScore || freshness(b.repo.pushed_at) - freshness(a.repo.pushed_at) || b.repo.stargazers_count - a.repo.stargazers_count);
const verified = new Map();
for (let index = 0; index < Math.min(240, ranked.length); index += 8) {
  const batch = ranked.slice(index, index + 8);
  const bodies = await Promise.all(batch.map(({ repo }) => readme(repo)));
  batch.forEach((candidate, i) => verified.set(candidate.repo.html_url, bodies[i]));
}

const generated = ranked.slice(0, 1000).map(({ repo, queries }) => {
  const body = verified.get(repo.html_url) ?? "";
  const text = `${repo.name} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")} ${body}`;
  const plan = plans.find(([, query]) => queries.has(query)) ?? plans[0];
  const modalities = labels(text, modalityRules);
  const surfaces = labels(text, surfaceRules);
  const verifiedWorkflow = implementation.test(body) && actionSignal.test(body);
  const adoption = Math.min(16, Math.floor(Math.log10(repo.stargazers_count + 1) * 5));
  const feasibility = Math.min(100, 45 + adoption + freshness(repo.pushed_at) + (repo.license ? 5 : 0) + (verifiedWorkflow ? 22 : 0) + (modalities.length >= 2 ? 5 : 0));
  const triModal = ["Vision", "Audio", "Text"].every((label) => modalities.includes(label));
  const tags = [...new Set([plan[0], ...modalities, ...surfaces, triModal ? "三模态关键词线索" : "", verifiedWorkflow ? "README规则命中" : "keyword-candidate", "GitHub discovery"].filter(Boolean))];
  const value = valueSignals(repo.description ?? '', body);
  return {
    id: `github-${repo.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: `${plan[0]}：${repo.name}`,
    category: plan[0], priority: value.valueStatus, score: value.valueSignalScore, technicalScore: feasibility,
    frequency: "公开技术信号；待内部业务验证",
    summary: repo.description?.trim() || `公开 Agent 候选仓库：${repo.full_name}`,
    agentLoop: "公开候选：请查看来源证据，确认输入、Agent 动作、输出与人工边界后再建立试点。",
    successMetric: "先验证任务完成率、人工接管率、处理时长与失败成本。",
    guardrail: "公开项目只能证明技术线索；高影响动作必须在受控环境中人工确认。",
    tags, evidenceUrl: repo.html_url, evidenceLabel: `${repo.full_name} · ${repo.stargazers_count} stars`,
    ...value, source: "github-discovery", evidenceStatus: verifiedWorkflow ? "readme-rule-match" : "keyword-candidate",
    repositoryType: nonWorkflow.test(`${repo.name} ${repo.description ?? ''}`) ? '资料/评测线索，待分类' : '项目候选',
    modalities, executionSurfaces: surfaces, querySignals: [...queries], discoveredAt: new Date().toISOString(),
  };
});
const existing = JSON.parse(await readFile(dataFile, "utf8"));
const curated = existing.filter((task) => task.source !== "github-discovery");
await writeFile(dataFile, `${JSON.stringify([...curated, ...generated].sort((a, b) => b.score - a.score), null, 2)}\n`);
const report = { generatedAt: new Date().toISOString(), queryCount: queryLimit, pagesPerQuery: pages, rawRepositoryHits: raw.length, deduplicatedCandidates: candidates.size, rejectedBeforeEvidence: rejected, readmeChecked: verified.size, readmeRuleMatched: generated.filter((task) => task.evidenceStatus === "readme-rule-match").length, valueSignalsFound: generated.filter(t => t.valueStatus === '价值线索待核验').length, publishedCandidates: generated.length };
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(cacheFile, JSON.stringify(cache));
console.log(JSON.stringify(report));
