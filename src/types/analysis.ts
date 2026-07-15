export type ChatScenario =
  | "auto"
  | "romantic"
  | "friend"
  | "leader"
  | "colleague"
  | "client"
  | "teacher"
  | "family";

export type AnalysisInputMode = "chat" | "single";

export type ToneConfidence = "低" | "中" | "高";

export type UrgencyLevel = "低" | "中" | "高" | "不明确";

export interface RecommendedReply {
  label: string;
  text: string;
}

export interface ToneTendency {
  label: string;
  confidence: ToneConfidence;
  explanation: string;
}

export interface AnalysisResult {
  detectedScenario: ChatScenario;
  scenarioLabel: string;
  coreIntent: string;
  toneTendency: ToneTendency;
  positivityScore: number;
  urgencyLevel: UrgencyLevel;
  relationshipStage: string;
  riskPoints: string[];
  avoidExpressions: string[];
  replyStrategy: string;
  recommendedReplies: RecommendedReply[];
  followUpActions: string[];
  meetOrWarmUpSuggestion?: string;
  summary: string;
  isMock?: boolean;
}
