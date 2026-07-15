import type { AnalysisResult, ChatScenario } from "../types/analysis";

const HISTORY_KEY = "chat_analyzer_history_v2";
const MAX_HISTORY_ITEMS = 10;
const SUMMARY_LIMIT = 80;

export type AnalysisHistoryItem = {
  id: string;
  createdAt: string;
  chatSummary: string;
  scenario?: ChatScenario;
  result: AnalysisResult;
};

export function loadHistory(): AnalysisHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryItem).slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function addHistoryItem(chatText: string, result: AnalysisResult, scenario?: ChatScenario) {
  const nextItem: AnalysisHistoryItem = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    chatSummary: summarizeChatText(chatText),
    scenario,
    result,
  };
  const nextHistory = [nextItem, ...loadHistory()].slice(0, MAX_HISTORY_ITEMS);
  saveHistory(nextHistory);
  return nextHistory;
}

export function deleteHistoryItem(id: string) {
  const nextHistory = loadHistory().filter((item) => item.id !== id);
  saveHistory(nextHistory);
  return nextHistory;
}

export function clearHistory() {
  window.localStorage.removeItem(HISTORY_KEY);
  return [];
}

function saveHistory(history: AnalysisHistoryItem[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
}

function summarizeChatText(chatText: string) {
  const normalized = chatText.replace(/\s+/g, " ").trim();
  if (!normalized) return "空消息记录";
  return normalized.length > SUMMARY_LIMIT ? `${normalized.slice(0, SUMMARY_LIMIT - 1)}…` : normalized;
}

function isHistoryItem(value: unknown): value is AnalysisHistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AnalysisHistoryItem>;
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.chatSummary === "string" &&
    Boolean(item.result) &&
    typeof item.result === "object" &&
    typeof (item.result as Partial<AnalysisResult>).positivityScore === "number"
  );
}
