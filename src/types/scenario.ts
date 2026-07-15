import type { ChatScenario } from "./analysis";

export type { ChatScenario };

export const scenarioOptions: Array<{ value: ChatScenario; label: string; description: string }> = [
  { value: "auto", label: "自动判断", description: "不确定场景时使用" },
  { value: "romantic", label: "恋爱 / 暧昧聊天", description: "看互动节奏和边界" },
  { value: "friend", label: "普通朋友聊天", description: "看轻松程度和回应空间" },
  { value: "leader", label: "领导 / 上级消息回复", description: "看任务重点和时间节点" },
  { value: "colleague", label: "同事协作沟通", description: "看协作效率和责任边界" },
  { value: "client", label: "客户 / 甲方沟通", description: "看需求、范围和推进方式" },
  { value: "teacher", label: "老师 / 导师沟通", description: "看礼貌、明确和可执行性" },
  { value: "family", label: "家人沟通", description: "看情绪承接和表达分寸" },
];

export function getScenarioLabel(scenario: ChatScenario) {
  return scenarioOptions.find((option) => option.value === scenario)?.label ?? "自动判断";
}

export function isChatScenario(value: unknown): value is ChatScenario {
  return scenarioOptions.some((option) => option.value === value);
}
