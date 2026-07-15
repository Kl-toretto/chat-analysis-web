import type { AnalysisResult } from "../types/analysis";

export type SafetyBoundary = {
  kind: "sensitive" | "rejectedMeet" | "conflict" | "cold";
  message: string;
};

const sensitivePatterns = [
  /1[3-9]\d{9}/,
  /\b\d{17}[\dXx]\b/,
  /(身份证|手机号|手机号码|住址|家庭住址|详细地址|银行卡|验证码|密码|账号|微信号|身份证号)/,
  /(小区|街道|单元|门牌号|省|市|区|县).{0,12}(号|室|楼)/,
];

const rejectedMeetPatterns = [
  /(不想见|不见|别约|不要约|不方便见|不太想见|不想出来|别再约|别来了)/,
  /(不方便|没空|算了|下次吧|改天吧|再说吧).{0,8}(见面|出来|吃饭|喝咖啡|一起去|约)/,
];

const conflictPatterns = [
  /(吵架|争吵|压力|逼问|别逼我|别再问|烦不烦|拉黑|删除|别联系|不要再发|停止联系|别打扰)/,
  /(拒绝|不同意|不愿意|不接受).{0,8}(还问|继续|追问|解释|见面|邀约)/,
];

const coldPattern = /(嗯|哦|还行|不知道|随便|再说|没空|算了)(\s|\n|$)/g;

export function detectSafetyBoundary(chatText: string): SafetyBoundary | null {
  if (sensitivePatterns.some((pattern) => pattern.test(chatText))) {
    return {
      kind: "sensitive",
      message: "聊天内容里可能包含手机号、地址、账号或证件等敏感信息。请删除或遮挡后再分析。",
    };
  }

  if (rejectedMeetPatterns.some((pattern) => pattern.test(chatText))) {
    return {
      kind: "rejectedMeet",
      message: "对方有拒绝或回避见面的信号，不建议继续邀约。",
    };
  }

  if (conflictPatterns.some((pattern) => pattern.test(chatText))) {
    return {
      kind: "conflict",
      message: "聊天里出现争吵、压力、拒绝或拉黑等信号，建议先停止施压。",
    };
  }

  const coldHits = chatText.match(coldPattern)?.length ?? 0;
  if (coldHits >= 3) {
    return {
      kind: "cold",
      message: "对方回复明显偏冷，建议降低频率或自然收尾。",
    };
  }

  return null;
}

export function createSensitiveContentResult(message: string): AnalysisResult {
  return {
    detectedScenario: "auto",
    scenarioLabel: "暂不分析",
    coreIntent: "内容可能包含敏感隐私，建议先删除或遮挡后再重新分析。",
    toneTendency: {
      label: "不判断",
      confidence: "低",
      explanation: "涉及敏感信息时不适合继续推断语气或关系状态。",
    },
    positivityScore: 0,
    urgencyLevel: "不明确",
    relationshipStage: "不明朗",
    riskPoints: ["可能包含敏感隐私信息。", "继续保存或转发截图可能带来隐私风险。"],
    avoidExpressions: ["继续分析含隐私的聊天", "保存或转发敏感截图", "追问对方隐私信息"],
    replyStrategy: "先删除或遮挡姓名、头像、手机号、地址、账号、证件等信息，再保留必要上下文分析。",
    recommendedReplies: [
      { label: "简短版", text: "我先把敏感信息处理掉。" },
      { label: "稳妥版", text: "这段先不分析了，等删除隐私内容再看。" },
      { label: "主动版", text: "我先只保留必要上下文，再重新分析。" },
    ],
    followUpActions: ["删除或遮挡敏感信息。", "只保留与沟通判断相关的文字。", "不要上传含证件、地址、账号的截图。"],
    summary: message,
    isMock: true,
  };
}

export function applySafetyBoundary(result: AnalysisResult, boundary: SafetyBoundary | null): AnalysisResult {
  if (!boundary || boundary.kind === "sensitive") return result;

  if (boundary.kind === "rejectedMeet") {
    return {
      ...result,
      riskPoints: uniqueLimit(["对方有拒绝或回避见面的信号。", ...result.riskPoints], 5),
      avoidExpressions: uniqueLimit(["继续邀约", "追问为什么不见面", "换说法再次试探", ...result.avoidExpressions], 5),
      recommendedReplies: [
        { label: "简短版", text: "明白，那先不打扰你。" },
        { label: "稳妥版", text: "理解，那这个先放一放，不勉强。" },
        { label: "主动版", text: "我知道了，之后你方便再说。" },
      ],
      followUpActions: uniqueLimit(["停止继续邀约。", "不要追问拒绝原因。", ...result.followUpActions], 5),
      meetOrWarmUpSuggestion: "对方已有拒绝或回避信号，不建议继续邀约；自然收住即可。",
      summary: appendBoundaryNote(result.summary, "对方有拒绝见面信号，建议停止邀约。"),
    };
  }

  if (boundary.kind === "conflict") {
    return {
      ...result,
      positivityScore: Math.min(result.positivityScore, 35),
      toneTendency: {
        label: "有压力或冲突倾向",
        confidence: "中",
        explanation: "聊天中出现争吵、拒绝、拉黑或停止联系等信号，建议先停止推进。",
      },
      relationshipStage: "冲突风险",
      riskPoints: uniqueLimit(["继续解释或追问可能加重压力。", "需要先尊重对方边界。", ...result.riskPoints], 5),
      avoidExpressions: uniqueLimit(["继续施压", "连续解释", "逼问关系", "继续邀约", ...result.avoidExpressions], 5),
      replyStrategy: "如果必须回复，保持很短，承认边界，然后暂停联系。",
      recommendedReplies: [
        { label: "简短版", text: "我明白了，先不打扰你。" },
        { label: "稳妥版", text: "抱歉让你有压力，我先停止追问。" },
        { label: "主动版", text: "我尊重你的意思，之后不再继续推进。" },
      ],
      followUpActions: uniqueLimit(["停止施压。", "不要连续发消息解释。", "给对方空间。", ...result.followUpActions], 5),
      meetOrWarmUpSuggestion: "当前不适合推进见面或升温，先暂停联系并尊重对方边界。",
      summary: appendBoundaryNote(result.summary, "出现冲突或压力信号，建议先停下来。"),
    };
  }

  return {
    ...result,
    positivityScore: Math.min(result.positivityScore, 39),
    toneTendency: {
      label: "偏冷淡或保留",
      confidence: result.toneTendency.confidence,
      explanation: "对方多次短回复，当前更适合降低频率或自然收尾。",
    },
    riskPoints: uniqueLimit(["对方回应偏短，继续追问容易增加压力。", ...result.riskPoints], 5),
    avoidExpressions: uniqueLimit(["连续追问", "长篇解释", "要求对方表态", ...result.avoidExpressions], 5),
    replyStrategy: "降低信息量，短句回应；如果对方仍然短回，就自然收尾。",
    recommendedReplies: [
      { label: "简短版", text: "好的，那先这样。" },
      { label: "稳妥版", text: "明白，你先忙，方便时再说。" },
      { label: "主动版", text: "我先不打扰你，有需要再聊。" },
    ],
    followUpActions: uniqueLimit(["降低回复频率。", "不要连续追问。", "换轻松话题或自然收尾。", ...result.followUpActions], 5),
    meetOrWarmUpSuggestion: "当前不适合推进见面或升温，先放慢节奏。",
    summary: appendBoundaryNote(result.summary, "对方偏冷，建议自然收尾或放慢节奏。"),
  };
}

function uniqueLimit(items: string[], limit: number) {
  return Array.from(new Set(items.filter(Boolean))).slice(0, limit);
}

function appendBoundaryNote(summary: string, note: string) {
  const next = `${summary} ${note}`;
  return next.length > 120 ? `${next.slice(0, 119)}…` : next;
}
