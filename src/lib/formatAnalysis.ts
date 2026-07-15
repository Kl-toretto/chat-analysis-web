import type { AnalysisResult } from "../types/analysis";

export function formatAnalysisResult(analysis: AnalysisResult) {
  return [
    `分析场景：${analysis.scenarioLabel}`,
    `核心意图：${analysis.coreIntent}`,
    `语气倾向：${analysis.toneTendency.label}（置信度：${analysis.toneTendency.confidence}）`,
    `沟通顺畅程度：${analysis.positivityScore}/100`,
    `紧急程度：${analysis.urgencyLevel}`,
    `当前阶段：${analysis.relationshipStage}`,
    `需要注意：${analysis.riskPoints.join("；")}`,
    `不建议表达：${analysis.avoidExpressions.join("；")}`,
    `回复策略：${analysis.replyStrategy}`,
    `推荐回复：${analysis.recommendedReplies.map((reply) => `${reply.label}：${reply.text}`).join(" / ")}`,
    `后续行动：${analysis.followUpActions.join("；")}`,
    analysis.meetOrWarmUpSuggestion ? `线下/推进建议：${analysis.meetOrWarmUpSuggestion}` : "",
    `简短总结：${analysis.summary}`,
  ]
    .filter(Boolean)
    .join("\n");
}
