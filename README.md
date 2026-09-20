# Agent Task Radar

探索 Agent 在生活、工作、学习、创作等场景中创造实际价值的机会。行业不限，项目是线索来源；网站帮助筛选值得继续调查的任务。

## 当前可用能力

- 28 条通用能力、模态与执行面查询，默认每条最多 3 页、每页 100 条。每日在 Stars / updated 排序之间轮换，同一轮分页保持一致；这是有预算的部分覆盖。
- 按仓库 URL 去重。fork、归档、私有仓库不纳入。资料、评测类关键词只标记为待分类，不据此直接丢弃项目。
- 按仓库描述中的任务价值线索、活跃度、Stars 选择最多 240 个读取 README。README 根据仓库 pushed_at 缓存，没有更新时复用。
- 从描述和 README 原文提取受益人、任务/交付物、收益主张，以及音视联合使用片段。提取只用本地规则，没有大模型调用。
- 候选池最多展示 1,000 个公开项目，加上既有人工样例；网页每次加载 40 张卡片。
- 支持任务原子、价值证据状态、关键词、多模态和本机收藏筛选。提交入口打开 GitHub Issue 草稿。
- 发现工作流每周运行，也可手动触发；成功后触发 Pages 部署。

## 分数与证据的含义

当前排序分是**价值线索完整度**：受益人片段 25、任务片段 35、收益主张片段 25、存在 README 且有任务片段 15。这个分数不是收益大小、ROI 或效果证明。技术分另存 technicalScore；businessValueScore 保持 null。

README 中 Agent 与动作词共现只记为 readme-rule-match，不等于实现已验证。模态标签同样是文本线索；三模态关键词共现不证明同一工作流融合了三种输入。音频有无实际增益，需要视觉+文本与加入音频后的对照证据，当前只提供待核验线索。

项目描述和 README 原文可能包含宣传或无关引用，使用前应打开来源核对。系统尚未自动生成可靠的跨仓库任务模式，也尚未接入真实任务量、耗时或效果数据。人工样例与自动候选的证据完整度不同，不能直接比较旧样例分数。

## 使用方式

1. 浏览排序靠前的候选，阅读受益人、任务、收益摘录。
2. 用任务原子与多模态筛选缩小范围，打开来源核对。
3. 记录真实需求、人工做法、预期交付物与验收标准，再决定是否试点。

## 本地运行

需要 Node.js 22+。

```sh
npm ci
npm run dev
npm test
node --test scripts/value-signals.test.mjs
npm run build
# Token 由环境提供，不要写入源文件
npm run discover
```

DISCOVERY_PAGES 可设为 1–5；DISCOVERY_QUERY_LIMIT 可缩小查询数量。API 失败时本轮不会覆盖旧任务快照；当前尚无自动重试和全候选持久化。

## 文件

- src/data/tasks.json：网站任务候选与原文摘录。
- src/data/discovery.json：最近一次扫描统计。
- src/data/readme-cache.json：公开 README 缓存，不由前端导入。
- scripts/discover-tasks.mjs：检索、去重、缓存与候选生成。
- scripts/value-signals.mjs：可解释的原文线索提取。
- .github/workflows/discover-tasks.yml：定时发现。
- .github/workflows/deploy-pages.yml：站点部署。

MIT 许可。保留原仓库 Git 历史及 LICENSE；收录项目内容归各自作者所有。
