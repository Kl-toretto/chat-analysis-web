const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const SCENARIOS = ["auto", "romantic", "friend", "leader", "colleague", "client", "teacher", "family"];
const CONFIDENCE = ["低", "中", "高"];
const URGENCY = ["低", "中", "高", "不明确"];

const scenarioLabels = {
  auto: "自动判断",
  romantic: "恋爱 / 暧昧聊天",
  friend: "普通朋友聊天",
  leader: "领导 / 上级消息回复",
  colleague: "同事协作沟通",
  client: "客户 / 甲方沟通",
  teacher: "老师 / 导师沟通",
  family: "家人沟通",
};

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (request.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON_BODY" }, 400, env);
  }

  const chatText = typeof body?.chatText === "string" ? body.chatText.trim() : "";
  const scenario = SCENARIOS.includes(body?.scenario) ? body.scenario : "auto";
  const mode = body?.mode === "single" ? "single" : "chat";

  if (!chatText) {
    return json({ error: "CHAT_TEXT_REQUIRED" }, 400, env);
  }

  const apiKey = env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    return json(createMockResult(chatText, scenario, mode), 200, env);
  }

  try {
    const analysis = await analyzeWithOpenAi(chatText, scenario, mode, apiKey, env);
    return json(analysis, 200, env);
  } catch (error) {
    console.error("analyze failed, fallback to mock", error);
    return json(createMockResult(chatText, scenario, mode), 200, env);
  }
}

async function analyzeWithOpenAi(chatText, scenario, mode, apiKey, env) {
  const baseUrl = (env?.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = env?.OPENAI_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const prompt = buildAnalyzePrompt(chatText, scenario, mode);

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "analysis_result",
          strict: true,
          schema: analysisJsonSchema,
        },
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OPENAI_REQUEST_FAILED_${response.status}`);
  }

  const outputText = extractOutputText(data);
  return normalizeAnalysisResult(JSON.parse(outputText), chatText, scenario, mode);
}

function extractOutputText(data) {
  if (data && typeof data.output_text === "string") return data.output_text;
  const chunks = Array.isArray(data?.output)
    ? data.output.flatMap((item) =>
        Array.isArray(item?.content)
          ? item.content.map((content) => content?.text || content?.output_text || "").filter(Boolean)
          : [],
      )
    : [];
  const text = chunks.join("").trim();
  if (!text) throw new Error("AI response text is empty.");
  return text;
}

function buildAnalyzePrompt(chatText, scenario, mode) {
  return `
你是一个克制、理性、尊重边界的多场景聊天分析助手。用户会提供聊天记录、截图 OCR 文本或单条消息。

当前输入模式：${mode === "single" ? "单条消息快速回复" : "聊天记录分析"}
用户选择场景：${scenarioLabels[scenario] || scenarioLabels.auto}

支持场景：
1. 恋爱 / 暧昧聊天
2. 普通朋友聊天
3. 领导 / 上级消息回复
4. 同事协作沟通
5. 客户 / 甲方沟通
6. 老师 / 导师沟通
7. 家人沟通
8. 自动判断

必须遵守：
- 不做心理诊断；
- 不断言对方真实想法；
- 不输出“领导一定生气了”“对方一定喜欢你”等绝对判断；
- 不制造焦虑；
- 不提供操控性话术；
- 不建议试探、冷暴力、阴阳怪气、PUA、施压；
- 不鼓励连续轰炸式发消息；
- 不建议越界打探隐私；
- 所有判断必须基于聊天文本；
- 信息不足时，明确提示“信息不足，仅能做初步判断”。

只输出严格 JSON，不要输出 Markdown、代码块或解释性前后缀。字段必须完全符合：
{
  "detectedScenario": "auto/romantic/friend/leader/colleague/client/teacher/family",
  "scenarioLabel": "中文场景名",
  "coreIntent": "核心意图，不超过80字",
  "toneTendency": { "label": "语气倾向", "confidence": "低/中/高", "explanation": "判断依据" },
  "positivityScore": 0,
  "urgencyLevel": "低/中/高/不明确",
  "relationshipStage": "当前沟通阶段",
  "riskPoints": ["风险点1", "风险点2"],
  "avoidExpressions": ["不建议表达1", "不建议表达2"],
  "replyStrategy": "回复策略",
  "recommendedReplies": [
    { "label": "简短版", "text": "回复内容" },
    { "label": "稳妥版", "text": "回复内容" },
    { "label": "主动版", "text": "回复内容" }
  ],
  "followUpActions": ["后续建议1", "后续建议2"],
  "meetOrWarmUpSuggestion": "",
  "summary": "120字以内总结"
}

聊天文本：
${chatText}
`.trim();
}

function createMockResult(chatText, scenario, mode) {
  const detectedScenario = scenario === "auto" ? inferScenario(chatText) : scenario;
  const label = scenarioLabels[detectedScenario] || scenarioLabels.auto;
  const isSingle = mode === "single";
  const urgencyLevel = inferUrgency(chatText);

  return {
    detectedScenario,
    scenarioLabel: label,
    coreIntent: isSingle ? "信息有限，先确认对方核心诉求并给出低压力回应。" : "当前更像是在推进沟通或确认事项，需要稳妥接住并明确下一步。",
    toneTendency: {
      label: "信息不足，仅能做初步判断",
      confidence: "低",
      explanation: "当前为本地估算版本，只根据文本长度、关键词和场景做粗略判断。",
    },
    positivityScore: clamp(chatText.length > 40 ? 62 : 48, 0, 100),
    urgencyLevel,
    relationshipStage: isSingle ? "单条消息判断" : "初步沟通判断",
    riskPoints: [
      "信息不足，仅能做初步判断。",
      "不要把单次回复直接理解为对方真实态度。",
      "避免连续追问或施压式表达。",
    ],
    avoidExpressions: ["你到底什么意思", "你必须说清楚", "为什么不回我"],
    replyStrategy: urgencyLevel === "高" ? "先确认收到，再给出明确动作和时间点。" : "先接住对方意思，再用自然、清晰、低压力的方式回复。",
    recommendedReplies: [
      { label: "简短版", text: "收到，我先确认一下。" },
      { label: "稳妥版", text: "我明白你的意思了，我整理清楚后再回复你。" },
      { label: "主动版", text: "我先看下重点，稍后给你一个明确回复。" },
    ],
    followUpActions: [
      "结合上下文再判断，不要只凭一句话下结论。",
      "如涉及工作事项，补充确认时间、范围和交付标准。",
    ],
    meetOrWarmUpSuggestion: "",
    summary: "当前为本地估算版本。信息不足，仅能做初步判断，建议用稳妥、低压力的方式回复。",
    isMock: true,
  };
}

function inferScenario(text) {
  if (/领导|上级|老板|汇报|审批|提交|进度/.test(text)) return "leader";
  if (/客户|甲方|报价|合同|需求|交付|验收/.test(text)) return "client";
  if (/同事|协作|项目|会议|排期|同步|接口/.test(text)) return "colleague";
  if (/老师|导师|论文|课题|作业|请教|修改意见/.test(text)) return "teacher";
  if (/爸爸|妈妈|家里|父母|家人|亲戚|回家/.test(text)) return "family";
  if (/喜欢|约会|暧昧|见面|咖啡|电影|想你|晚安/.test(text)) return "romantic";
  return "friend";
}

function inferUrgency(text) {
  if (/马上|立刻|尽快|今天必须|今天|下班前|明早|截止|抓紧|ASAP|asap|会议|汇报|提交/.test(text)) return "高";
  if (/明天|这周|本周|抽空|这两天|尽量|有时间|方便时|周末|看一下/.test(text)) return "中";
  if (text.length < 8) return "不明确";
  return "低";
}

function normalizeAnalysisResult(value, chatText, selectedScenario, mode) {
  const fallback = createMockResult(chatText, selectedScenario, mode);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const detectedScenario = SCENARIOS.includes(value.detectedScenario) ? value.detectedScenario : fallback.detectedScenario;
  const recommendedReplies = normalizeReplies(value.recommendedReplies, fallback.recommendedReplies, mode);

  return {
    detectedScenario,
    scenarioLabel: stringOr(value.scenarioLabel, scenarioLabels[detectedScenario] || fallback.scenarioLabel),
    coreIntent: trim(stringOr(value.coreIntent, fallback.coreIntent), 80),
    toneTendency: normalizeTone(value.toneTendency, fallback.toneTendency),
    positivityScore: clamp(Math.round(Number(value.positivityScore)), 0, 100, fallback.positivityScore),
    urgencyLevel: URGENCY.includes(value.urgencyLevel) ? value.urgencyLevel : fallback.urgencyLevel,
    relationshipStage: stringOr(value.relationshipStage, fallback.relationshipStage),
    riskPoints: stringArray(value.riskPoints, fallback.riskPoints, 5),
    avoidExpressions: stringArray(value.avoidExpressions, fallback.avoidExpressions, 5),
    replyStrategy: stringOr(value.replyStrategy, fallback.replyStrategy),
    recommendedReplies,
    followUpActions: stringArray(value.followUpActions, fallback.followUpActions, 5),
    meetOrWarmUpSuggestion: typeof value.meetOrWarmUpSuggestion === "string" ? value.meetOrWarmUpSuggestion : "",
    summary: trim(stringOr(value.summary, fallback.summary), 120),
    isMock: false,
  };
}

function normalizeTone(value, fallback) {
  if (!value || typeof value !== "object") return fallback;
  return {
    label: stringOr(value.label, fallback.label),
    confidence: CONFIDENCE.includes(value.confidence) ? value.confidence : fallback.confidence,
    explanation: stringOr(value.explanation, fallback.explanation),
  };
}

function normalizeReplies(value, fallback, mode) {
  const maxLength = mode === "single" ? 48 : 80;
  if (!Array.isArray(value)) return fallback;
  const replies = value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      label: stringOr(item.label, ""),
      text: trim(stringOr(item.text, ""), maxLength),
    }))
    .filter((item) => item.label && item.text);
  return replies.length >= 3 ? replies : fallback;
}

function stringArray(value, fallback, maxLength) {
  if (!Array.isArray(value)) return fallback.slice(0, maxLength);
  const items = value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  return items.length ? items.slice(0, maxLength) : fallback.slice(0, maxLength);
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function trim(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function clamp(value, min, max, fallback = 50) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function json(payload, status, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function corsHeaders(env) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  const allowOrigin = env?.CORS_ALLOW_ORIGIN || process.env.CORS_ALLOW_ORIGIN;
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "detectedScenario",
    "scenarioLabel",
    "coreIntent",
    "toneTendency",
    "positivityScore",
    "urgencyLevel",
    "relationshipStage",
    "riskPoints",
    "avoidExpressions",
    "replyStrategy",
    "recommendedReplies",
    "followUpActions",
    "meetOrWarmUpSuggestion",
    "summary",
  ],
  properties: {
    detectedScenario: { type: "string", enum: SCENARIOS },
    scenarioLabel: { type: "string" },
    coreIntent: { type: "string", maxLength: 80 },
    toneTendency: {
      type: "object",
      additionalProperties: false,
      required: ["label", "confidence", "explanation"],
      properties: {
        label: { type: "string" },
        confidence: { type: "string", enum: CONFIDENCE },
        explanation: { type: "string" },
      },
    },
    positivityScore: { type: "integer", minimum: 0, maximum: 100 },
    urgencyLevel: { type: "string", enum: URGENCY },
    relationshipStage: { type: "string" },
    riskPoints: { type: "array", maxItems: 5, items: { type: "string" } },
    avoidExpressions: { type: "array", maxItems: 5, items: { type: "string" } },
    replyStrategy: { type: "string" },
    recommendedReplies: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "text"],
        properties: {
          label: { type: "string" },
          text: { type: "string", maxLength: 80 },
        },
      },
    },
    followUpActions: { type: "array", maxItems: 5, items: { type: "string" } },
    meetOrWarmUpSuggestion: { type: "string" },
    summary: { type: "string", maxLength: 120 },
  },
};
