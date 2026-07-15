import type { AnalysisInputMode, AnalysisResult, ChatScenario, ToneConfidence, UrgencyLevel } from "../types/analysis";
import { getScenarioLabel } from "../types/scenario";
import { matchWorkplaceReplyTemplate } from "./workplaceReplyTemplates";

type Message = {
  speaker: "self" | "other";
  text: string;
};

type ResolvedScenario = Exclude<ChatScenario, "auto">;

const singleMessageNotice = "当前只有单条消息，判断可能不完整，建议结合上下文使用。";
const positiveWords = ["哈哈", "好呀", "可以", "不错", "收到", "明白", "谢谢", "辛苦", "没问题"];
const coldWords = ["嗯", "哦", "还行", "不知道", "随便", "再说", "没空", "算了", "都行"];

export function mockAnalyzeChat(chatText: string, scenario: ChatScenario = "auto", inputMode: AnalysisInputMode = "chat"): AnalysisResult {
  const text = chatText.trim();
  const messages = inputMode === "single" ? [{ speaker: "other" as const, text }] : parseMessages(text);
  const otherMessages = messages.filter((message) => message.speaker === "other");
  const selfMessages = messages.filter((message) => message.speaker === "self");
  const otherText = otherMessages.map((message) => message.text).join(" ") || text;
  const roundCount = inputMode === "single" ? 1 : Math.min(selfMessages.length, otherMessages.length);
  const resolvedScenario = scenario === "auto" ? inferScenario(text) : scenario;

  if (resolvedScenario === "leader") {
    return buildLeaderAnalysis(otherText, roundCount, inputMode);
  }

  return inputMode === "single"
    ? buildSingleMessageAnalysis(otherText, resolvedScenario)
    : buildChatAnalysis(text, otherText, resolvedScenario, roundCount);
}

function buildSingleMessageAnalysis(text: string, scenario: ResolvedScenario): AnalysisResult {
  const urgencyLevel = inferUrgency(text);
  const needsDetails = shouldConfirmDetails(text, scenario);
  const positivityScore = scoreSingleMessage(text, urgencyLevel);

  return {
    detectedScenario: scenario,
    scenarioLabel: getScenarioLabel(scenario),
    coreIntent: buildCoreIntent(text, scenario),
    toneTendency: inferTone(text, 1, positivityScore),
    positivityScore,
    urgencyLevel,
    relationshipStage: needsDetails ? "信息确认" : "日常沟通",
    riskPoints: uniqueLimit(
      [
        singleMessageNotice,
        needsDetails ? "信息还不完整，建议先确认关键细节。" : "",
        urgencyLevel === "高" ? "看起来可能需要较快回应，先给确认和时间点。" : "",
      ],
      5,
    ),
    avoidExpressions: buildAvoidExpressions(scenario, positivityScore),
    replyStrategy: needsDetails
      ? "先确认收到，再礼貌补问关键细节，回复保持短、清楚、不给对方压力。"
      : "先接住对方意图，再给一个简短明确的回应，适合微信、企业微信或钉钉快速发送。",
    recommendedReplies: buildQuickReplies(scenario, urgencyLevel, needsDetails),
    followUpActions: uniqueLimit(
      [
        needsDetails ? "确认时间、范围、标准或对方真正想要的结果。" : "",
        "结合前后文再判断语气，不要只凭一句话下结论。",
        urgencyLevel === "高" ? "优先回复“收到”，再补充后续动作。" : "",
      ],
      5,
    ),
    meetOrWarmUpSuggestion: "",
    summary: `${singleMessageNotice}目前看核心是：${buildCoreIntent(text, scenario)}`,
  };
}

function buildChatAnalysis(text: string, otherText: string, scenario: ResolvedScenario, roundCount: number): AnalysisResult {
  const coldCount = parseMessages(text)
    .filter((message) => message.speaker === "other")
    .filter((message) => coldWords.includes(message.text.replace(/\s/g, ""))).length;
  const questionCount = (otherText.match(/[?？]|吗|呢|怎么|什么|能不能|可以不/g) ?? []).length;
  const positiveCount = positiveWords.reduce((count, word) => count + (otherText.includes(word) ? 1 : 0), 0);
  const positivityScore = scoreChat(roundCount, otherText.length, questionCount, positiveCount, coldCount);
  const urgencyLevel = inferUrgency(text);

  return {
    detectedScenario: scenario,
    scenarioLabel: getScenarioLabel(scenario),
    coreIntent: buildCoreIntent(otherText || text, scenario),
    toneTendency: inferTone(otherText || text, roundCount, positivityScore),
    positivityScore,
    urgencyLevel,
    relationshipStage: inferStage(roundCount, positivityScore, scenario, text),
    riskPoints: buildRiskPoints(positivityScore, scenario, coldCount, text),
    avoidExpressions: buildAvoidExpressions(scenario, positivityScore),
    replyStrategy: buildReplyStrategy(scenario, urgencyLevel, positivityScore),
    recommendedReplies: buildChatReplies(scenario, urgencyLevel, positivityScore),
    followUpActions: buildFollowUpActions(scenario, positivityScore, roundCount),
    meetOrWarmUpSuggestion: buildMeetOrWarmUpSuggestion(scenario, positivityScore, roundCount, text),
    summary: buildSummary(roundCount, positivityScore, scenario),
  };
}

function buildLeaderAnalysis(text: string, roundCount: number, inputMode: AnalysisInputMode): AnalysisResult {
  const intent = inferLeaderIntent(text);
  const urgencyLevel = inferLeaderUrgency(text);
  const toneTendency = inferLeaderTone(text, urgencyLevel, roundCount);
  const singleNote = inputMode === "single" ? singleMessageNotice : "";
  const replyTemplate = matchWorkplaceReplyTemplate(text, intent, urgencyLevel);

  return {
    detectedScenario: "leader",
    scenarioLabel: getScenarioLabel("leader"),
    coreIntent: buildLeaderCoreIntent(intent),
    toneTendency,
    positivityScore: scoreLeader(intent, toneTendency.label, urgencyLevel),
    urgencyLevel,
    relationshipStage: leaderIntentToStage(intent),
    riskPoints: uniqueLimit([singleNote, ...buildLeaderRiskPoints(intent, toneTendency.label, urgencyLevel)], 5),
    avoidExpressions: ["我已经尽力了", "这个不是我的问题", "你之前也没说清楚", "我现在没办法", "带情绪或阴阳怪气的表达"],
    replyStrategy:
      inputMode === "single"
        ? "先简短确认收到，再给一个动作或补问关键细节，适合微信、企业微信、钉钉快速回复。"
        : buildLeaderReplyStrategy(intent, urgencyLevel),
    recommendedReplies: replyTemplate.replies,
    followUpActions: buildLeaderFollowUpActions(intent, urgencyLevel, inputMode),
    meetOrWarmUpSuggestion: inputMode === "single" ? "" : buildLeaderMeetSuggestion(intent, urgencyLevel),
    summary: `${singleNote}目前看更像“${intent}”，语气倾向于“${toneTendency.label}”，建议先确认收到，再给动作和时间点。`,
  };
}

function parseMessages(chatText: string): Message[] {
  const lines = chatText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const parsed: Message[] = [];
  let currentSpeaker: Message["speaker"] | null = null;

  for (const line of lines) {
    const normalized = line.replace(/^\[?\d{1,2}[:：]\d{2}(?::\d{2})?\]?\s*/, "");
    const selfMatch = /^(我|本人|自己|me)\s*[:：]\s*/i.exec(normalized);
    const otherMatch = /^(对方|ta|TA|他|她|你|领导|上级|同事|客户|甲方|老师|导师|家人|妈妈|爸爸)\s*[:：]\s*/.exec(normalized);

    if (selfMatch) {
      currentSpeaker = "self";
      parsed.push({ speaker: "self", text: normalized.slice(selfMatch[0].length).trim() });
      continue;
    }

    if (otherMatch) {
      currentSpeaker = "other";
      parsed.push({ speaker: "other", text: normalized.slice(otherMatch[0].length).trim() });
      continue;
    }

    if (currentSpeaker && parsed.length) {
      parsed[parsed.length - 1].text += ` ${normalized}`;
    } else {
      parsed.push({ speaker: parsed.length % 2 === 0 ? "self" : "other", text: normalized });
      currentSpeaker = parsed[parsed.length - 1].speaker;
    }
  }

  return parsed.filter((message) => message.text);
}

function inferScenario(text: string): ResolvedScenario {
  if (/(领导|上级|老板|汇报|审批|绩效|会议|提交|抓紧|尽快|方案.*改|进度|您看)/.test(text)) return "leader";
  if (/(客户|甲方|报价|合同|需求|交付|验收|方案)/.test(text)) return "client";
  if (/(同事|协作|项目|会议|排期|对齐|同步|接口)/.test(text)) return "colleague";
  if (/(老师|导师|论文|课题|作业|请教|修改意见)/.test(text)) return "teacher";
  if (/(爸爸|妈妈|家里|父母|家人|亲戚|回家)/.test(text)) return "family";
  if (/(喜欢|约会|暧昧|见面|咖啡|电影|想你|晚安)/.test(text)) return "romantic";
  return "friend";
}

function inferUrgency(text: string): UrgencyLevel {
  if (/(马上|立刻|尽快|今天必须|今天|下班前|明早|截止|抓紧|ASAP|asap|会议|汇报|提交|客户|检查|领导层要看)/.test(text)) {
    return "高";
  }
  if (/(明天|这周|本周|抽空|这两天|尽量|有时间|方便时|周末|看一下)/.test(text)) return "中";
  if (text.length < 8) return "不明确";
  if (/(不急|有时间|之后|回头|晚点|同步一下|了解一下)/.test(text)) return "低";
  return "不明确";
}

function inferTone(text: string, roundCount: number, score: number): AnalysisResult["toneTendency"] {
  const confidence: ToneConfidence = text.length < 8 || roundCount < 2 ? "低" : text.length < 30 ? "中" : "高";
  if (/(不行|怎么回事|太慢|没做好|不满意|别再|不要再)/.test(text)) {
    return { label: "偏严肃", confidence, explanation: "目前看对方在指出问题或提出要求，建议先稳住语气。" };
  }
  if (/(谢谢|辛苦|不错|很好|可以|哈哈)/.test(text) || score >= 70) {
    return { label: "相对积极", confidence, explanation: "文本里有认可或较顺畅的回应，但仍只能作为倾向判断。" };
  }
  if (score < 40) {
    return { label: "信息偏少", confidence, explanation: "可用信息不多，建议先轻量回应，不要过度解读。" };
  }
  return { label: "正常沟通", confidence, explanation: "目前看是正常交流，建议按场景给出清楚回应。" };
}

function shouldConfirmDetails(text: string, scenario: ResolvedScenario) {
  if (text.length < 10) return true;
  if (/(这个|那个|处理一下|看一下|弄一下|尽快|方案|材料)/.test(text) && !/(今天|明天|下班前|几点|范围|标准)/.test(text)) {
    return true;
  }
  return ["leader", "colleague", "client", "teacher"].includes(scenario) && /[?？]|能不能|是否|可以吗/.test(text);
}

function buildCoreIntent(text: string, scenario: ResolvedScenario) {
  if (/(修改|调整|优化|重点不够|反馈)/.test(text)) return "对方在提出修改或反馈，希望你调整后再同步。";
  if (/(进度|到哪|怎么样了|什么时候|催|抓紧|尽快)/.test(text)) return "对方在确认进度，希望尽快得到明确反馈。";
  if (/(马上|现在|临时|会议|客户|汇报|提交)/.test(text)) return "对方可能有临时安排或较急事项，需要你先确认。";
  if (/(不错|很好|辛苦|谢谢|做得好)/.test(text)) return "对方在表达认可或感谢，可以简短接住。";
  const fallback: Record<ResolvedScenario, string> = {
    romantic: "对方在开启或延续轻量互动，适合自然接话。",
    friend: "对方在日常交流，适合轻松回应。",
    leader: "对方可能在安排或确认工作事项，需要稳妥回复。",
    colleague: "对方在同步协作事项，需要确认边界和下一步。",
    client: "对方可能在确认需求或推进事项，需要专业回应。",
    teacher: "对方可能在提出要求或反馈，需要礼貌确认。",
    family: "对方可能在表达关心或诉求，需要温和回应。",
  };
  return fallback[scenario];
}

function inferLeaderIntent(text: string) {
  if (/(不错|很好|辛苦|做得好|可以|值得肯定|表扬)/.test(text)) return "表扬认可";
  if (/(不满意|不行|问题很大|怎么回事|太慢|没做好|不够|效果不好)/.test(text)) return "表达不满";
  if (/(修改|调整|优化|再梳理|再完善|反馈|意见|重点不够)/.test(text)) return "修改反馈";
  if (/(进度|到哪|怎么样了|什么时候|多久|抓紧|尽快|推进到哪)/.test(text)) return "催进度";
  if (/(谁负责|谁来|责任|归谁|边界|分工|你这边负责)/.test(text)) return "确认责任";
  if (/(马上|现在|临时|突然|下午|今晚|开会|会议|客户来了|领导层要看)/.test(text)) return "临时安排";
  if (/(做一个|准备|整理|发我|给我|提交|出一版|安排一下|麻烦你)/.test(text)) return "布置任务";
  if (/(什么情况|情况如何|现在怎样|有结果吗|确认一下|看一下)/.test(text)) return "询问情况";
  if (/(你怎么看|你觉得|有没有问题|能不能|是否可以|方便吗)/.test(text)) return "模糊试探";
  return "需要用户主动补充信息";
}

function inferLeaderTone(text: string, urgency: UrgencyLevel, roundCount: number): AnalysisResult["toneTendency"] {
  const confidence: ToneConfidence = text.length < 8 || roundCount < 1 ? "低" : text.length < 24 ? "中" : "高";
  if (text.length < 6) return { label: "信息不足，不能判断", confidence: "低", explanation: "消息太短，只能先按工作沟通谨慎回应。" };
  if (/(不错|很好|辛苦|做得好|可以|值得肯定|表扬)/.test(text)) {
    return { label: "鼓励认可", confidence, explanation: "消息里有认可或肯定表达，但不推断领导个人态度。" };
  }
  if (/(不满意|不行|问题很大|怎么回事|太慢|没做好|不够|效果不好)/.test(text)) {
    return { label: "明确不满", confidence, explanation: "目前看对方在指出问题或结果不达预期，应先承接问题并给出修正动作。" };
  }
  if (urgency === "高" || /(马上|尽快|现在|立刻|抓紧|今天必须)/.test(text)) {
    return { label: "偏急", confidence, explanation: "消息包含时间压力或高优先级事项，适合快速确认并给时间点。" };
  }
  if (/(必须|务必|为什么|说明原因|责任|不要再|重点|严肃)/.test(text)) {
    return { label: "偏严肃", confidence, explanation: "表达更偏任务要求或问题确认，建议少解释，多给清晰动作。" };
  }
  if (/(抽空|有时间|方便的话|看一下|提醒|注意|尽量)/.test(text)) {
    return { label: "委婉提醒", confidence, explanation: "语气相对委婉，但仍需要把事项确认清楚，避免漏跟进。" };
  }
  return { label: "正常工作沟通", confidence, explanation: "目前看主要是正常任务或信息沟通，不建议过度解读情绪。" };
}

function inferLeaderUrgency(text: string): UrgencyLevel {
  if (/(马上|尽快|今天必须|现在|立刻|抓紧|会议|汇报|提交|客户|检查|领导层要看|上面要看)/.test(text)) return "高";
  if (/(抽空|这两天|尽量|有时间看一下|方便时|回头|晚点|明天)/.test(text)) return "中";
  if (text.trim().length < 8) return "不明确";
  if (/(同步|了解|知道一下|参考|日常|不急)/.test(text)) return "低";
  return /[?？]|看一下|确认/.test(text) ? "中" : "低";
}

function buildLeaderCoreIntent(intent: string) {
  const detail: Record<string, string> = {
    布置任务: "领导在布置任务，需要你确认收到、明确动作和完成时间。",
    催进度: "领导在催进度，需要你快速同步当前状态、卡点和下一步时间。",
    修改反馈: "领导在提出修改反馈，需要你复述重点并给出调整计划。",
    表达不满: "领导在指出不满意或问题，需要先承接，再给补救动作。",
    询问情况: "领导在了解情况，需要你简洁说明现状、结论和下一步。",
    确认责任: "领导在确认责任或分工，需要你明确边界，但不推责。",
    临时安排: "领导有临时安排，需要快速确认优先级和可交付时间。",
    表扬认可: "领导在表达认可，可以简短感谢，并顺带确认后续推进。",
    模糊试探: "领导可能在征询可行性，需要你主动补充判断和方案。",
    需要用户主动补充信息: "信息不够完整，需要你礼貌确认背景、标准或截止时间。",
  };
  return detail[intent] ?? detail["需要用户主动补充信息"];
}

function leaderIntentToStage(intent: string) {
  const stageMap: Record<string, string> = {
    布置任务: "任务布置",
    催进度: "进度确认",
    修改反馈: "反馈修改",
    表达不满: "冲突风险",
    询问情况: "进度确认",
    确认责任: "责任边界确认",
    临时安排: "任务布置",
    表扬认可: "日常沟通",
    模糊试探: "责任边界确认",
    需要用户主动补充信息: "日常沟通",
  };
  return stageMap[intent] ?? "日常沟通";
}

function buildLeaderRiskPoints(intent: string, toneLabel: string, urgency: UrgencyLevel) {
  const risks = ["只回复“收到”但没有动作和时间点，会显得承接不够。", "长篇解释原因，容易稀释解决方案。"];
  if (urgency === "高") risks.unshift("事项可能比较急，回复里要给明确时间节点。");
  if (toneLabel === "明确不满" || intent === "表达不满") risks.unshift("对方已经指出问题，先承接再补救，不要争辩。");
  if (intent === "确认责任") risks.unshift("需要说清责任边界，但不要把语气写成推责。");
  if (intent === "需要用户主动补充信息") risks.unshift("信息不足时直接开做，可能返工。");
  return uniqueLimit(risks, 5);
}

function buildLeaderReplyStrategy(intent: string, urgency: UrgencyLevel) {
  if (intent === "表达不满") return "先承接问题，再说明会如何修正和何时反馈，避免争辩或解释过长。";
  if (intent === "催进度") return "先同步当前进度，再说明卡点和下一步完成时间，必要时主动给阶段性结果。";
  if (intent === "修改反馈") return "先确认修改方向，再复述要强化的重点，最后给出修改稿时间。";
  if (urgency === "高") return "先快速确认收到，再给优先级处理动作和最近一个明确反馈时间。";
  return "先确认收到，复述对方重点，给出明确动作和时间节点；不推责、不过度解释、不情绪化。";
}

function buildLeaderReplies(intent: string, urgency: UrgencyLevel) {
  if (intent === "修改反馈") {
    return [
      { label: "简短版", text: "好的，我再梳理重点，改完发您。" },
      { label: "稳妥版", text: "收到，我会强化重点和亮点，稍后发您一版。" },
      { label: "主动版", text: "收到，我先按核心问题和落地效果调整，晚点请您确认。" },
    ];
  }
  if (intent === "催进度") {
    return [
      { label: "简短版", text: "收到，我马上同步进度。" },
      { label: "稳妥版", text: "收到，我整理下当前进展，稍后发您。" },
      { label: "主动版", text: "收到，我先发阶段结果，再补剩余时间点。" },
    ];
  }
  if (urgency === "高") {
    return [
      { label: "简短版", text: "收到，我优先处理。" },
      { label: "稳妥版", text: "收到，我先处理关键部分，稍后同步。" },
      { label: "主动版", text: "收到，我先给一版初步结果，方便您确认。" },
    ];
  }
  return [
    { label: "简短版", text: "收到，我来处理。" },
    { label: "稳妥版", text: "收到，我先按这个方向推进，稍后同步。" },
    { label: "主动版", text: "收到，我先整理重点和下一步，发您确认。" },
  ];
}

function buildLeaderFollowUpActions(intent: string, urgency: UrgencyLevel, inputMode: AnalysisInputMode) {
  const actions = ["把任务、截止时间、输出标准整理成清单。", "有进度或卡点时主动同步。"];
  if (inputMode === "single") actions.unshift("如信息不完整，先确认范围、时间或输出标准。");
  if (urgency === "高") actions.unshift("优先给一个最近反馈时间，不要长时间无回应。");
  if (intent === "修改反馈" || intent === "表达不满") actions.unshift("按反馈逐项修改，避免只解释原因。");
  if (intent === "需要用户主动补充信息" || intent === "模糊试探") actions.unshift("补问目标、范围、截止时间、输出格式。");
  return uniqueLimit(actions, 5);
}

function buildLeaderMeetSuggestion(intent: string, urgency: UrgencyLevel) {
  if (intent === "表达不满") return "如果文字来回容易误解，可以请求简短当面或语音确认，重点放在问题点和补救计划。";
  if (urgency === "高") return "如事项复杂，建议申请 5-10 分钟快速确认优先级和交付口径。";
  return "如果任务边界不清，可以礼貌请求简短确认，避免直接开做后返工。";
}

function scoreSingleMessage(text: string, urgencyLevel: UrgencyLevel) {
  let score = 48;
  if (text.length > 20) score += 10;
  if (/[?？]/.test(text)) score += 5;
  if (/(谢谢|辛苦|不错|很好|哈哈)/.test(text)) score += 12;
  if (/(不行|怎么回事|太慢|不满意|别再)/.test(text)) score -= 18;
  if (urgencyLevel === "高") score -= 4;
  return clamp(score, 15, 88);
}

function scoreLeader(intent: string, toneLabel: string, urgency: UrgencyLevel) {
  let score = 58;
  if (toneLabel === "鼓励认可") score += 18;
  if (toneLabel === "明确不满") score -= 22;
  if (toneLabel === "偏严肃") score -= 10;
  if (urgency === "高") score -= 4;
  if (intent === "需要用户主动补充信息") score -= 5;
  return clamp(score, 10, 92);
}

function scoreChat(roundCount: number, textLength: number, questionCount: number, positiveCount: number, coldCount: number) {
  let score = 42;
  score += Math.min(15, roundCount * 3);
  score += Math.min(14, textLength * 0.2);
  score += Math.min(12, questionCount * 5);
  score += Math.min(10, positiveCount * 4);
  score -= Math.min(24, coldCount * 8);
  if (roundCount < 2) score = Math.min(score, 38);
  return clamp(Math.round(score), 8, 96);
}

function inferStage(roundCount: number, score: number, scenario: ResolvedScenario, text: string) {
  if (roundCount < 2) return "不明朗";
  if (["romantic", "friend", "family"].includes(scenario)) {
    if (scenario === "romantic" && score >= 80 && roundCount >= 5) return "升温中";
    if (scenario === "romantic" && score >= 70) return "轻微暧昧";
    if (score >= 60) return "有来有回";
    if (score >= 45) return "初步熟悉";
    return "不明朗";
  }
  if (/(修改|调整|反馈|意见)/.test(text)) return "反馈修改";
  if (/(进度|完成|推进|排期|什么时候|几点|截止)/.test(text)) return "进度确认";
  if (/(谁来|负责|边界|范围|归属|接口)/.test(text)) return "责任边界确认";
  return "日常沟通";
}

function buildRiskPoints(score: number, scenario: ResolvedScenario, coldCount: number, text: string) {
  const risks: string[] = [];
  if (score < 40 || coldCount >= 2) risks.push("对方回应偏短，继续追问容易增加压力。");
  if (/(拒绝|不想|不方便|别约|不见|没空)/.test(text)) risks.push("对方可能在表达拒绝或回避，不适合继续推进。");
  const byScenario: Record<ResolvedScenario, string> = {
    romantic: "不要把轻微回应直接理解成明确好感。",
    friend: "避免把普通闲聊升级成关系审问。",
    leader: "不要只回复情绪，要给出明确动作和时间点。",
    colleague: "注意责任边界，避免口头答应不清楚的范围。",
    client: "不要未经确认就承诺交付范围或时间。",
    teacher: "避免只解释困难，要给出你准备怎么改。",
    family: "先承接情绪，再表达立场，避免直接顶回去。",
  };
  return uniqueLimit([...risks, byScenario[scenario]], 5);
}

function buildAvoidExpressions(scenario: ResolvedScenario, score: number) {
  const byScenario: Record<ResolvedScenario, string[]> = {
    romantic: ["你是不是喜欢我", "你怎么不回我"],
    friend: ["你必须说清楚", "你不把我当朋友吗"],
    leader: ["我已经尽力了", "这个不是我的问题"],
    colleague: ["你自己看着办", "反正我不管"],
    client: ["肯定没问题", "这个很简单"],
    teacher: ["我真的没办法", "能不能宽限一下"],
    family: ["别管我了", "你每次都这样"],
  };
  const extra = score < 40 ? ["连续追问", "长篇解释"] : [];
  return uniqueLimit([...byScenario[scenario], ...extra], 5);
}

function buildReplyStrategy(scenario: ResolvedScenario, urgencyLevel: UrgencyLevel, score: number) {
  if (score < 40) return "降低信息量，短句回应；如果对方仍然短回，就自然收尾。";
  if (urgencyLevel === "高") return "先确认收到，再给明确动作和最近反馈时间。";
  const strategies: Record<ResolvedScenario, string> = {
    romantic: "顺着对方愿意聊的点轻轻展开，不急着定义关系。",
    friend: "接住对方的话题，用轻松语气回应，再留一个低压力延展点。",
    leader: "先确认收到，再说明理解的重点，最后给执行步骤和预计时间。",
    colleague: "先对齐事实，再明确分工和下一步，语气保持合作。",
    client: "先确认需求，再说明边界和可选方案，避免过度承诺。",
    teacher: "先表达收到和感谢，再说明会如何修改或准备下一步。",
    family: "先回应对方感受，再表达自己的安排，少用对抗语气。",
  };
  return strategies[scenario];
}

function buildQuickReplies(scenario: ResolvedScenario, urgencyLevel: UrgencyLevel, needsDetails: boolean) {
  if (needsDetails) {
    return [
      { label: "简短版", text: "收到，我先确认下具体要求。" },
      { label: "稳妥版", text: "收到，我想确认下时间和标准，再开始处理。" },
      { label: "主动版", text: "收到，我先按现有信息看下，也想确认下重点。" },
    ];
  }
  if (urgencyLevel === "高") {
    return [
      { label: "简短版", text: "收到，我优先处理。" },
      { label: "稳妥版", text: "收到，我先处理关键部分，稍后同步。" },
      { label: "主动版", text: "收到，我先给一版初步结果，方便确认。" },
    ];
  }
  const replies: Record<ResolvedScenario, Array<{ label: string; text: string }>> = {
    romantic: [
      { label: "简短版", text: "哈哈，这个有点意思。" },
      { label: "稳妥版", text: "我懂你意思了，可以慢慢聊。" },
      { label: "主动版", text: "下次刚好聊到这个，可以一起试试。" },
    ],
    friend: [
      { label: "简短版", text: "哈哈懂了。" },
      { label: "稳妥版", text: "听起来还挺有意思，有空接着聊。" },
      { label: "主动版", text: "下次有类似的我也发你看看。" },
    ],
    leader: [
      { label: "简短版", text: "收到，我来处理。" },
      { label: "稳妥版", text: "收到，我先按这个方向推进，稍后同步。" },
      { label: "主动版", text: "收到，我先整理重点和下一步，发您确认。" },
    ],
    colleague: [
      { label: "简短版", text: "收到，我看一下。" },
      { label: "稳妥版", text: "收到，我先对齐下信息，再同步你。" },
      { label: "主动版", text: "我先拉一下重点，咱们再确认分工。" },
    ],
    client: [
      { label: "简短版", text: "收到，我确认一下。" },
      { label: "稳妥版", text: "收到，我整理后给您明确回复。" },
      { label: "主动版", text: "我先列两个方案，方便您比较。" },
    ],
    teacher: [
      { label: "简短版", text: "收到老师，我会处理。" },
      { label: "稳妥版", text: "谢谢老师，我整理后再发您看。" },
      { label: "主动版", text: "我先补充查证，再把修改版发您。" },
    ],
    family: [
      { label: "简短版", text: "我知道你的意思了。" },
      { label: "稳妥版", text: "我明白你是担心我，我会想想。" },
      { label: "主动版", text: "我们晚点慢慢说，我先理一下。" },
    ],
  };
  return replies[scenario];
}

function buildChatReplies(scenario: ResolvedScenario, urgencyLevel: UrgencyLevel, score: number) {
  if (score < 40) {
    return [
      { label: "简短版", text: "好的，那先这样。" },
      { label: "稳妥版", text: "明白，你先忙，方便时再说。" },
      { label: "主动版", text: "我先不打扰你，有需要再聊。" },
    ];
  }
  return buildQuickReplies(scenario, urgencyLevel, false);
}

function buildFollowUpActions(scenario: ResolvedScenario, score: number, roundCount: number) {
  const actions: string[] = [];
  if (roundCount < 5) actions.push("样本较少，先把结论当作粗略参考。");
  if (score < 40) actions.push("降低回复频率，不要连续追问。");
  const byScenario: Record<ResolvedScenario, string[]> = {
    romantic: ["继续观察对方是否会主动延展话题。", "不要急着定义关系。"],
    friend: ["保持轻松节奏，选对方愿意聊的话题。"],
    leader: ["整理任务清单和时间节点。", "必要时主动同步进度。"],
    colleague: ["确认责任边界和交付时间。", "把关键信息落到文字。"],
    client: ["确认需求范围、时间和验收标准。", "把承诺写清楚再推进。"],
    teacher: ["按反馈列修改项。", "下次沟通前准备具体问题。"],
    family: ["先回应关心，再讨论具体安排。"],
  };
  return uniqueLimit([...actions, ...byScenario[scenario]], 5);
}

function buildMeetOrWarmUpSuggestion(scenario: ResolvedScenario, score: number, roundCount: number, text: string) {
  if (/(拒绝|不方便|不见|别约|没空|算了)/.test(text)) return "对方有拒绝或回避信号，不建议继续推进；可以自然收住。";
  if (scenario === "leader") return "如果事项复杂，可以建议当面或语音确认 10 分钟，重点放在任务和时间节点。";
  if (!["romantic", "friend", "client", "colleague"].includes(scenario)) return "";
  if (score < 40) return "当前不适合推进线下沟通，先降低频率，等对方有更明确回应。";
  if (score >= 68 && roundCount >= 5) return "可以给一个低压力选项，例如“刚好聊到这个，下次可以顺路一起去，不方便也没事。”";
  return "";
}

function buildSummary(roundCount: number, score: number, scenario: ResolvedScenario) {
  const sampleNote = roundCount < 5 ? "样本较少，仅供参考。" : "";
  const tendency = score < 40 ? "节奏偏弱" : score >= 70 ? "沟通较顺" : "沟通正常";
  return trimToLength(`${sampleNote}目前按“${getScenarioLabel(scenario)}”看，${tendency}，建议用更稳妥、低压力的方式回应。`, 120);
}

function uniqueLimit(items: string[], limit: number) {
  return Array.from(new Set(items.filter(Boolean))).slice(0, limit);
}

function trimToLength(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
