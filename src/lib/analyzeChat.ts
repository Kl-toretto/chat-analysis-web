import { mockAnalyzeChat } from "./mockAnalyze";
import { applySafetyBoundary, createSensitiveContentResult, detectSafetyBoundary } from "./safetyBoundaries";
import type {
  AnalysisInputMode,
  AnalysisResult,
  ChatScenario,
} from "../types/analysis";

export type AnalyzeMode = "mock" | "ai";

export type AnalyzeChatResponse = {
  analysis: AnalysisResult;
  mode: AnalyzeMode;
  notice?: string;
};

const serviceUnavailableNotice = "分析服务暂时不可用，已切换为本地估算结果。";
const singleMessageNotice = "当前只有单条消息，判断可能不完整，建议结合上下文使用。";

export async function analyzeChat(
  chatText: string,
  scenario: ChatScenario,
  inputMode: AnalysisInputMode = "chat",
): Promise<AnalyzeChatResponse> {
  const boundary = detectSafetyBoundary(chatText);
  const modeNotice = inputMode === "single" ? singleMessageNotice : undefined;

  if (boundary?.kind === "sensitive") {
    return {
      analysis: createSensitiveContentResult(boundary.message),
      mode: "mock",
      notice: joinNotices(boundary.message, modeNotice),
    };
  }

  try {
    const aiResult = await analyzeWithAi(chatText, scenario, inputMode);
    return {
      analysis: applySafetyBoundary(aiResult, boundary),
      mode: aiResult.isMock ? "mock" : "ai",
      notice: joinNotices(aiResult.isMock ? "当前为本地估算版本。" : undefined, boundary?.message, modeNotice),
    };
  } catch (error) {
    console.warn("AI analysis failed, falling back to mock analysis.", error);
    return {
      analysis: applySafetyBoundary({ ...mockAnalyzeChat(chatText, scenario, inputMode), isMock: true }, boundary),
      mode: "mock",
      notice: joinNotices(serviceUnavailableNotice, boundary?.message, modeNotice),
    };
  }
}

function joinNotices(...notices: Array<string | undefined>) {
  return notices.filter(Boolean).join(" ");
}

async function analyzeWithAi(
  chatText: string,
  scenario: ChatScenario,
  inputMode: AnalysisInputMode,
): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatText,
      scenario,
      mode: inputMode,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return data as AnalysisResult;
}
