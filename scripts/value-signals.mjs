// Extract source excerpts, never invent beneficiaries, savings, or proven ROI.
export function valueSignals(description = '', readme = '') {
  const lines = `${description}\n${readme}`.split(/\n/).map(x => x.replace(/<[^>]*>/g, '').trim()).filter(x => x.length > 25 && x.length < 600 && !/^```|^!\[|^\|/.test(x));
  const take = regex => [...new Set(lines.filter(x => regex.test(x)))].slice(0, 2);
  const beneficiaryEvidence = take(/\b(for (?:users|people|teams|students|teachers|developers|creators|professionals)|helps?\s+\w+|accessibility|daily life)\b|帮助|用户|教师|学生|日常/iu);
  const taskEvidence = take(/\b(automate|extract|organize|transcribe|summarize|schedule|create|generate|repair|diagnose|edit|complete|manage|assist)\w*\b|整理|生成|完成|提取|诊断|制作/iu);
  const outcomeEvidence = take(/\b(saves?|reduces?|improves?|faster|hours?|minutes?|accuracy|productivity|accessible)\b|节省|减少|提升|小时|分钟/iu);
  const audioEvidence = take(/\b(audio|speech|voice|sound)\b.*\b(video|image|screen|visual)\b|\b(video|image|screen|visual)\b.*\b(audio|speech|voice|sound)\b/iu);
  const valueSignalScore = (beneficiaryEvidence.length ? 25 : 0) + (taskEvidence.length ? 35 : 0) + (outcomeEvidence.length ? 25 : 0) + (readme && taskEvidence.length ? 15 : 0);
  return { beneficiaryEvidence, taskEvidence, outcomeEvidence, audioEvidence, valueSignalScore,
    valueStatus: taskEvidence.length && (beneficiaryEvidence.length || outcomeEvidence.length) ? '价值线索待核验' : '价值假设待补证',
    audioValueStatus: audioEvidence.length ? '音视联合使用线索；增益待验证' : '尚无音频补充价值证据',
    businessValueScore: null };
}
