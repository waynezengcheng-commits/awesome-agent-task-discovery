// Extract source excerpts, never invent beneficiaries, savings, or proven ROI.
export function valueSignals(description = '', readme = '') {
  const lines = `${description}\n${readme}`.split(/\n/).map(x => x.replace(/<[^>]*>/g, '').trim()).filter(x => x.length > 25 && x.length < 600 && !/^```|^!\[|^\|/.test(x));
  const take = regex => [...new Set(lines.filter(x => regex.test(x)))].slice(0, 2);
  const beneficiaryEvidence = take(/\b(for (?:users|people|teams|students|teachers|developers|creators|professionals)|helps?\s+\w+|accessibility|daily life)\b|帮助|用户|教师|学生|日常/iu);
  const taskEvidence = take(/\b(automate|extract|organize|transcribe|summarize|schedule|create|generate|repair|diagnose|edit|complete|manage|assist)\w*\b|整理|生成|完成|提取|诊断|制作/iu);
  const outcomeEvidence = take(/\b(saves?|reduces?|improves?|faster|hours?|minutes?|accuracy|productivity|accessible)\b|节省|减少|提升|小时|分钟/iu);
  const audioEvidence = take(/\b(audio|speech|voice|sound)\b.*\b(video|image|screen|visual)\b|\b(video|image|screen|visual)\b.*\b(audio|speech|voice|sound)\b/iu);
  const valueSignalScore = (beneficiaryEvidence.length ? 25 : 0) + (taskEvidence.length ? 35 : 0) + (outcomeEvidence.length ? 25 : 0) + (readme && taskEvidence.length ? 15 : 0);
  const source = `${description}\n${readme}`;
  const sceneRules = [
    ['内容创作', /video|image|audio|voice|subtitle|avatar|editing|creator|创作|视频|图像|音频|字幕/i],
    ['软件开发', /code|coding|program|software|debug|repository|developer|代码|开发|调试/i],
    ['办公与知识工作', /document|spreadsheet|email|calendar|meeting|report|workflow|office|文档|表格|邮件|会议|报告/i],
    ['教育与学习', /student|teacher|education|course|tutor|learning|学生|教师|教育|课程|学习/i],
    ['客户与服务', /customer|support|sales|service|ticket|客服|客户|销售|服务/i],
    ['研究与信息处理', /research|search|retrieval|knowledge|paper|information|研究|检索|知识|信息/i],
    ['运维与安全', /monitor|observability|incident|security|threat|deploy|infra|监控|安全|部署/i],
    ['真实环境与设备', /robot|robotics|camera|sensor|home|vehicle|device|embodied|机器人|传感器|设备|家庭/i],
  ];
  const scene = sceneRules.find(([, rule]) => rule.test(source))?.[0] ?? '通用工作流';
  const taskRules = [
    ['语音转写与内容整理', /transcrib|speech.to.text|caption|subtitle|转写|字幕/i],
    ['多媒体内容生成与编辑', /generate|create|edit|video|image|audio|avatar|生成|制作|编辑|视频|图像|音频/i],
    ['检索、问答与知识整理', /retriev|search|knowledge|question.answer|semantic|检索|搜索|知识|问答/i],
    ['信息抽取与结构化', /extract|parse|ocr|classif|information extraction|抽取|解析|识别/i],
    ['界面与流程自动化', /automate|browser|desktop|computer use|control|操作|自动化|浏览器|桌面/i],
    ['监控、评测与排障', /monitor|observab|evaluat|test|debug|diagnos|监控|评测|测试|诊断|排障/i],
    ['规划、调度与执行', /plan|schedule|orchestrat|routing|planning|规划|调度|编排/i],
    ['翻译与跨语言处理', /translat|multilingual|翻译|多语言/i],
  ];
  const taskLabel = taskRules.find(([, rule]) => rule.test(source))?.[0] ?? '任务协作与执行';
  const modalityLabel = ['Vision', 'Video', 'Audio', 'Text'].filter(x => {
    const rule = { Vision: /vision|image|visual|screen|gui|camera/i, Video: /video|temporal|frame/i, Audio: /audio|voice|speech|sound|transcri/i, Text: /text|document|language|llm|prompt/i }[x];
    return rule.test(source);
  });
  const sceneEvidence = take(new RegExp(sceneRules.find(([label]) => label === scene)?.[1].source ?? 'never', 'i'));
  const valueSummary = outcomeEvidence.length ? '公开描述提到效率、速度或质量改善，值得验证实际节省的时间与人工成本。' : beneficiaryEvidence.length ? '能看出潜在使用者，但还缺少结果数据，需要用真实流程验证价值。' : '目前只有技术能力线索，尚未证明具体使用者和业务收益。';
  return { beneficiaryEvidence, taskEvidence, outcomeEvidence, audioEvidence, valueSignalScore,
    scene, sceneEvidence, taskLabel, modalityLabel, valueSummary,
    valueStatus: taskEvidence.length && (beneficiaryEvidence.length || outcomeEvidence.length) ? '价值线索待核验' : '价值假设待补证',
    audioValueStatus: audioEvidence.length ? '音视联合使用线索；增益待验证' : '尚无音频补充价值证据',
    businessValueScore: null };
}
