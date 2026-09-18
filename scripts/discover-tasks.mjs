import { readFile, writeFile } from "node:fs/promises";

const dataFile = new URL("../src/data/tasks.json", import.meta.url);
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "agent-task-radar",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};
const patterns = [
  { query: '"agent" "code review"', category: "工程交付", priority: "P0", base: 89, loop: "代码变更触发 → Agent 收集变更与校验结果 → 标出风险与证据 → 工程师裁决。", metric: "以审查覆盖率、首次通过率和修复时长衡量。", guardrail: "不得自动合并、发布或修改生产配置。", tags: ["Code review", "CI"] },
  { query: '"agent" "customer support"', category: "客户运营", priority: "P0", base: 87, loop: "新请求进入 → Agent 分类、补全上下文并建议路由 → 人工发送或升级。", metric: "以首次响应时间、一次解决率和错误升级率衡量。", guardrail: "退款、隐私、法律和安全事件必须转人工。", tags: ["Support", "Routing"] },
  { query: '"agent" "browser automation"', category: "业务运营", priority: "P1", base: 80, loop: "合格请求触发 → Agent 在授权系统中执行低风险步骤 → 异常与高风险动作交接人工。", metric: "以处理时长、成功率和人工接管率衡量。", guardrail: "支付、删除、权限变更和对外发送必须二次确认。", tags: ["Browser", "Approvals"] },
  { query: '"agent" "security"', category: "风险与安全", priority: "P0", base: 88, loop: "告警或请求触发 → Agent 汇总允许范围内的证据 → 分诊并提交给安全人员。", metric: "以平均分诊时间、有效告警率和证据完整度衡量。", guardrail: "仅只读访问；不得自行隔离资产、封禁账号或删除证据。", tags: ["Security", "Evidence"] },
  { query: '"agent" "data quality"', category: "数据运营", priority: "P1", base: 81, loop: "质量规则失败 → Agent 对比上游变更与历史数据 → 提出影响范围和修复建议 → 负责人审核。", metric: "以恢复时间、重复故障率和影响范围衡量。", guardrail: "生产环境只读；写入操作必须由数据负责人批准。", tags: ["Data quality", "Root cause"] },
  { query: '"multimodal agent"', category: "多模态任务", priority: "P0", base: 90, loop: "图像、视频或音频与文本进入 → Agent 提取跨模态证据并完成分类、检索或下一步建议 → 人工复核。", metric: "以任务完成率、跨模态准确率、人工复核率和处理时长衡量。", guardrail: "保留原始媒体和时间戳引用；涉及人物、版权、医疗或安全判断时必须人工确认。", tags: ["Multimodal", "Vision", "Audio / Video"] },
  { query: '"vision language agent"', category: "多模态任务", priority: "P1", base: 87, loop: "视觉输入与任务说明进入 → Agent 定位证据、生成结构化结果或执行建议 → 人工确认高影响结果。", metric: "以证据定位准确率、结构化字段正确率和人工返工率衡量。", guardrail: "不得把视觉推断视为身份、医疗、合规或安全结论；敏感内容只在获授权范围处理。", tags: ["Multimodal", "Vision", "Structured output"] },
  { query: '"video agent"', category: "多模态任务", priority: "P1", base: 86, loop: "视频与任务目标进入 → Agent 定位片段、提取事件或生成操作建议 → 人工抽检与确认。", metric: "以片段召回率、事件准确率、审核吞吐量和处理时长衡量。", guardrail: "不得仅依自动结果采取处罚、支付或安全关键行动；须保留时间戳与原始视频审计链。", tags: ["Multimodal", "Video", "Temporal reasoning"] },
];
const nonWorkflowRepository = /(?:^|[-_])(awesome|course|tutorial|example|examples|paper|benchmark|collection|list)(?:$|[-_])/i;

async function search(pattern) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `${pattern.query} archived:false fork:false`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "8");
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub search failed (${response.status}) for ${pattern.query}`);
  const body = await response.json();
  return body.items.filter((repo) => !nonWorkflowRepository.test(repo.name)).map((repo) => {
    const adoption = Math.min(8, Math.floor(Math.log10(repo.stargazers_count + 1) * 3));
    return {
      id: `github-${repo.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${pattern.category}：${repo.name}`,
      category: pattern.category,
      priority: pattern.priority,
      score: Math.min(99, pattern.base + adoption),
      frequency: "公开工作流信号；待内部验证",
      summary: repo.description?.trim() || `GitHub 中的 ${pattern.category} Agent 工作流候选。`,
      agentLoop: pattern.loop,
      successMetric: pattern.metric,
      guardrail: pattern.guardrail,
      tags: [...pattern.tags, "GitHub discovery"],
      evidenceUrl: repo.html_url,
      evidenceLabel: `${repo.full_name} · ${repo.stargazers_count} stars`,
      source: "github-discovery",
      discoveredAt: new Date().toISOString(),
    };
  });
}

const existing = JSON.parse(await readFile(dataFile, "utf8"));
const curated = existing.filter((task) => task.source !== "github-discovery");
const results = await Promise.all(patterns.map(search));
const deduped = new Map();
for (const task of results.flat()) {
  const key = task.evidenceUrl;
  if (!deduped.has(key) || deduped.get(key).score < task.score) deduped.set(key, task);
}
const next = [...curated, ...deduped.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
await writeFile(dataFile, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Discovered ${deduped.size} public Agent task candidates; retained ${curated.length} curated tasks.`);
