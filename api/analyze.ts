import { buildAnalyzePrompt } from "../src/lib/analyzePrompt";
import { mockAnalyzeChat } from "../src/lib/mockAnalyze";
import type {
  AnalysisInputMode,
  AnalysisResult,
  ChatScenario,
  RecommendedReply,
  ToneConfidence,
  UrgencyLevel,
} from "../src/types/analysis";
import { getScenarioLabel, isChatScenario } from "../src/types/scenario";

declare const process: { env: Record<string, string | undefined> };

type AnalyzeRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: {
    remoteAddress?: string;
  };
};

type AnalyzeResponse = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_BODY_BYTES = 120_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;

const rateLimitBuckets = new Map<string, number[]>();
const scenarioValues: ChatScenario[] = ["auto", "romantic", "friend", "leader", "colleague", "client", "teacher", "family"];
const confidenceValues: ToneConfidence[] = ["低", "中", "高"];
const urgencyValues: UrgencyLevel[] = ["低", "中", "高", "不明确"];
const mockNotice = "当前为本地估算版本。";

export default async function handler(req: AnalyzeRequest, res: AnalyzeResponse) {
  try {
    if (req.method === "OPTIONS") {
      sendCorsHeaders(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
      return;
    }

    if (!checkRateLimit(getClientId(req))) {
      sendJson(res, 429, { error: "RATE_LIMITED" });
      return;
    }

    const body = await readJsonBody(req);
    if (!isRecord(body)) {
      sendJson(res, 400, { error: "INVALID_ANALYZE_PAYLOAD" });
      return;
    }

    const chatText = typeof body.chatText === "string" ? body.chatText.trim() : "";
    const scenario = isChatScenario(body.scenario) ? body.scenario : "auto";
    const mode = normalizeInputMode(body.mode);

    if (!chatText) {
      sendJson(res, 400, { error: "CHAT_TEXT_REQUIRED" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey || !globalThis.fetch) {
      sendJson(res, 200, createMockResult(chatText, scenario, mode));
      return;
    }

    const analysis = await analyzeWithOpenAi(chatText, scenario, mode, apiKey).catch(() =>
      createMockResult(chatText, scenario, mode),
    );
    sendJson(res, 200, analysis);
  } catch (error) {
    if (isHttpError(error)) {
      sendJson(res, error.statusCode, { error: error.code });
      return;
    }

    const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    sendJson(res, 500, { error: "INTERNAL_SERVER_ERROR", detail: message });
  }
}

async function readJsonBody(req: AnalyzeRequest) {
  const rawBody = await getRawBody(req);
  const body = req.body ?? (rawBody ? parseJson(rawBody) : null);

  if (typeof body === "string") {
    return parseJson(body);
  }

  return body;
}

async function getRawBody(req: AnalyzeRequest) {
  if (req.body !== undefined || !isAsyncIterable(req)) {
    return "";
  }

  const maxBodyBytes = Number(process.env.MAX_ANALYZE_BODY_BYTES || DEFAULT_MAX_BODY_BYTES);
  const chunks: string[] = [];
  let size = 0;
  const decoder = new TextDecoder();

  for await (const chunk of req) {
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk as Uint8Array);
    size += new TextEncoder().encode(text).byteLength;
    if (size > maxBodyBytes) {
      throw createHttpError(413, "REQUEST_BODY_TOO_LARGE");
    }
    chunks.push(text);
  }

  return chunks.join("");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw createHttpError(400, "INVALID_JSON_BODY");
  }
}

function getBaseUrl() {
  return (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function analyzeWithOpenAi(
  chatText: string,
  scenario: ChatScenario,
  mode: AnalysisInputMode,
  apiKey: string,
): Promise<AnalysisResult> {
  const upstream = await fetch(`${getBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input: buildAnalyzePrompt(chatText, scenario, mode),
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

  const data = await upstream.json();
  if (!upstream.ok) {
    throw new Error("OPENAI_REQUEST_FAILED");
  }

  const outputText = extractOutputText(data);
  return normalizeAnalysisResult(JSON.parse(outputText), chatText, scenario, mode);
}

function createMockResult(chatText: string, scenario: ChatScenario, mode: AnalysisInputMode): AnalysisResult {
  const result = mockAnalyzeChat(chatText, scenario, mode);
  return {
    ...result,
    isMock: true,
    summary: result.summary.includes(mockNotice) ? result.summary : `${mockNotice}${result.summary}`,
  };
}

function normalizeInputMode(value: unknown): AnalysisInputMode {
  return value === "single" ? "single" : "chat";
}

function extractOutputText(data: unknown) {
  if (isRecord(data) && typeof data.output_text === "string") {
    return data.output_text;
  }

  if (!isRecord(data) || !Array.isArray(data.output)) {
    throw new Error("AI response has no output text.");
  }

  const chunks = data.output.flatMap((item) => {
    if (!isRecord(item) || !Array.isArray(item.content)) return [];
    return item.content
      .map((content) => {
        if (!isRecord(content)) return "";
        if (typeof content.text === "string") return content.text;
        if (typeof content.output_text === "string") return content.output_text;
        return "";
      })
      .filter(Boolean);
  });

  const text = chunks.join("").trim();
  if (!text) {
    throw new Error("AI response text is empty.");
  }

  return text;
}

function normalizeAnalysisResult(
  value: unknown,
  chatText: string,
  selectedScenario: ChatScenario,
  mode: AnalysisInputMode,
): AnalysisResult {
  if (!isRecord(value)) {
    throw new Error("AI result is not an object.");
  }

  const fallback = mockAnalyzeChat(chatText, selectedScenario, mode);
  const detectedScenario = normalizeScenario(value.detectedScenario, fallback.detectedScenario);
  const recommendedReplies = normalizeRecommendedReplies(value.recommendedReplies, fallback.recommendedReplies, mode);

  return {
    detectedScenario,
    scenarioLabel: normalizeString(value.scenarioLabel, getScenarioLabel(detectedScenario)),
    coreIntent: trimToLength(normalizeString(value.coreIntent, fallback.coreIntent), 80),
    toneTendency: normalizeToneTendency(value.toneTendency, fallback.toneTendency),
    positivityScore: clampInteger(value.positivityScore, fallback.positivityScore),
    urgencyLevel: normalizeEnum(value.urgencyLevel, urgencyValues, fallback.urgencyLevel),
    relationshipStage: normalizeString(value.relationshipStage, fallback.relationshipStage),
    riskPoints: normalizeStringArray(value.riskPoints, 5, fallback.riskPoints),
    avoidExpressions: normalizeStringArray(value.avoidExpressions, 5, fallback.avoidExpressions),
    replyStrategy: normalizeString(value.replyStrategy, fallback.replyStrategy),
    recommendedReplies,
    followUpActions: normalizeStringArray(value.followUpActions, 5, fallback.followUpActions),
    meetOrWarmUpSuggestion: normalizeOptionalString(value.meetOrWarmUpSuggestion, fallback.meetOrWarmUpSuggestion) ?? "",
    summary: trimToLength(normalizeString(value.summary, fallback.summary), 120),
    isMock: false,
  };
}

function normalizeScenario(value: unknown, fallback: ChatScenario): ChatScenario {
  if (isChatScenario(value)) return value;
  return fallback;
}

function normalizeToneTendency(value: unknown, fallback: AnalysisResult["toneTendency"]): AnalysisResult["toneTendency"] {
  if (!isRecord(value)) return fallback;
  return {
    label: normalizeString(value.label, fallback.label),
    confidence: normalizeEnum(value.confidence, confidenceValues, fallback.confidence),
    explanation: normalizeString(value.explanation, fallback.explanation),
  };
}

function normalizeRecommendedReplies(value: unknown, fallback: RecommendedReply[], mode: AnalysisInputMode) {
  const maxLength = mode === "single" ? 48 : 80;
  const fallbackMap = [
    { label: "简短版", text: "收到，我先确认一下。" },
    { label: "稳妥版", text: "收到，我整理清楚后回复你。" },
    { label: "主动版", text: "我先看下重点，稍后给你明确回复。" },
    ...fallback,
  ];

  if (!Array.isArray(value)) return fallbackMap.slice(0, 3);

  const items = value
    .filter(isRecord)
    .map((item) => ({
      label: normalizeString(item.label, ""),
      text: trimToLength(normalizeString(item.text, ""), maxLength),
    }))
    .filter((item) => item.label && item.text);

  return [...items, ...fallbackMap].slice(0, Math.max(3, items.length || 3));
}

function normalizeStringArray(value: unknown, maxLength: number, fallback: string[]) {
  if (!Array.isArray(value)) return fallback.slice(0, maxLength);
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxLength);
  return items.length ? items : fallback.slice(0, maxLength);
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeOptionalString(value: unknown, fallback?: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function normalizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function clampInteger(value: unknown, fallback = 50) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function trimToLength(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function checkRateLimit(clientId: string) {
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || DEFAULT_RATE_LIMIT_PER_MINUTE);
  if (!Number.isFinite(limit) || limit <= 0) return true;

  const now = Date.now();
  const active = (rateLimitBuckets.get(clientId) || []).filter((timestamp) => now - timestamp < 60_000);

  if (active.length >= limit) {
    rateLimitBuckets.set(clientId, active);
    return false;
  }

  active.push(now);
  rateLimitBuckets.set(clientId, active);
  return true;
}

function getClientId(req: AnalyzeRequest) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0].split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

function sendJson(res: AnalyzeResponse, statusCode: number, payload: unknown) {
  sendCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function sendCorsHeaders(res: AnalyzeResponse) {
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN;
  if (!allowOrigin) return;

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return isRecord(value) && Symbol.asyncIterator in value;
}

function createHttpError(statusCode: number, code: string) {
  return Object.assign(new Error(code), { statusCode, code });
}

function isHttpError(error: unknown): error is Error & { statusCode: number; code: string } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    "code" in error &&
    typeof error.code === "string"
  );
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
    detectedScenario: { type: "string", enum: scenarioValues },
    scenarioLabel: { type: "string" },
    coreIntent: { type: "string", maxLength: 80 },
    toneTendency: {
      type: "object",
      additionalProperties: false,
      required: ["label", "confidence", "explanation"],
      properties: {
        label: { type: "string" },
        confidence: { type: "string", enum: confidenceValues },
        explanation: { type: "string" },
      },
    },
    positivityScore: { type: "integer", minimum: 0, maximum: 100 },
    urgencyLevel: { type: "string", enum: urgencyValues },
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
