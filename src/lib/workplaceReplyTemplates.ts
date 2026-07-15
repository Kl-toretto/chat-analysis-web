import type { RecommendedReply, UrgencyLevel } from "../types/analysis";

export type WorkplaceReplyTemplateKey =
  | "leaderTask"
  | "leaderProgress"
  | "leaderRevision"
  | "leaderSeriousTone"
  | "leaderTemporaryArrangement"
  | "leaderPraise"
  | "leaderAccountability"
  | "cannotFinishNow"
  | "needMoreTime"
  | "needClarifyRequirements"
  | "needReportProgress"
  | "needDeclineUnreasonable";

export type WorkplaceReplyTemplate = {
  key: WorkplaceReplyTemplateKey;
  label: string;
  keywords: RegExp[];
  replies: RecommendedReply[];
};

export const workplaceReplyTemplates: WorkplaceReplyTemplate[] = [
  {
    key: "leaderTask",
    label: "领导布置任务",
    keywords: [/做一?个|准备|整理|发我|给我|提交|出一版|安排一下|麻烦你|负责一下/],
    replies: [
      { label: "简短版", text: "收到，我来处理，今天下班前先同步进展。" },
      { label: "稳妥版", text: "收到，我先按这个方向推进，今天下班前给您一版初步结果。" },
      { label: "主动版", text: "收到，我先拆成重点和时间节点，晚点发您确认后继续推进。" },
    ],
  },
  {
    key: "leaderProgress",
    label: "领导催进度",
    keywords: [/进度|到哪|怎么样了|什么时候|多久|抓紧|尽快|推进到哪|有结果了吗/],
    replies: [
      { label: "简短版", text: "收到，我马上整理进度，稍后同步您。" },
      { label: "稳妥版", text: "收到，目前我先整理已完成和剩余部分，半小时内同步您。" },
      { label: "主动版", text: "收到，我先发阶段性结果，再补充剩余事项和预计完成时间。" },
    ],
  },
  {
    key: "leaderRevision",
    label: "领导提出修改意见",
    keywords: [/修改|调整|优化|再梳理|再完善|反馈|意见|重点不够|不够突出|改一下/],
    replies: [
      { label: "简短版", text: "好的，我再把重点梳理清楚，改完发您。" },
      { label: "稳妥版", text: "收到，我会重点调整结构和亮点，今天下班前发您一版。" },
      { label: "主动版", text: "收到，我先按核心问题、解决路径和效果三部分调整，晚点请您确认。" },
    ],
  },
  {
    key: "leaderSeriousTone",
    label: "领导语气偏严肃",
    keywords: [/必须|务必|为什么|说明原因|不要再|严肃|重点|不行|问题很大|怎么回事/],
    replies: [
      { label: "简短版", text: "收到，我马上核对问题并尽快处理。" },
      { label: "稳妥版", text: "收到，我先核对具体问题，今天内给您处理结果和后续安排。" },
      { label: "主动版", text: "收到，我会先定位原因，再把修正动作和时间节点整理给您确认。" },
    ],
  },
  {
    key: "leaderTemporaryArrangement",
    label: "领导临时安排",
    keywords: [/马上|现在|临时|突然|下午|今晚|开会|会议|客户来了|领导层要看|上面要看/],
    replies: [
      { label: "简短版", text: "收到，我优先处理，稍后同步您。" },
      { label: "稳妥版", text: "收到，我先把这个排到优先级前面，预计一小时内给您反馈。" },
      { label: "主动版", text: "收到，我先处理最关键部分，若有冲突会同步您确认优先级。" },
    ],
  },
  {
    key: "leaderPraise",
    label: "领导表扬",
    keywords: [/不错|很好|辛苦|做得好|可以|值得肯定|表扬|效果不错/],
    replies: [
      { label: "简短版", text: "谢谢认可，我继续跟进后面的部分。" },
      { label: "稳妥版", text: "谢谢您认可，我会按这个方向继续完善，后续进展及时同步。" },
      { label: "主动版", text: "谢谢认可，我再把可复用的部分整理一下，方便后面继续推进。" },
    ],
  },
  {
    key: "leaderAccountability",
    label: "领导问责",
    keywords: [/谁负责|谁来|责任|归谁|为什么没|为什么还没|原因是什么|解释一下|失误|漏了/],
    replies: [
      { label: "简短版", text: "收到，我先核清情况，稍后给您明确说明和处理动作。" },
      { label: "稳妥版", text: "收到，我先核对责任边界和实际进展，今天内给您准确反馈。" },
      { label: "主动版", text: "收到，我会先把原因、影响和补救动作整理清楚，再发您确认。" },
    ],
  },
  {
    key: "cannotFinishNow",
    label: "自己暂时做不完",
    keywords: [/做不完|来不及|赶不完|排不过来|时间不够|卡住|今天完不成/],
    replies: [
      { label: "简短版", text: "我这边可能今天做不完，先给您一版关键部分。" },
      { label: "稳妥版", text: "目前时间比较紧，我先交付关键部分，剩余内容预计明早补齐。" },
      { label: "主动版", text: "我建议先保证核心内容质量，今晚发重点版，明早补完整细节。" },
    ],
  },
  {
    key: "needMoreTime",
    label: "需要争取更多时间",
    keywords: [/能不能晚点|延后|宽限|多给.*时间|需要.*时间|明天再|改到|顺延/],
    replies: [
      { label: "简短版", text: "我想多确认一轮，能否明早前给您最终版？" },
      { label: "稳妥版", text: "为了避免返工，我想再核对一轮，是否可以明早前给您完整版本？" },
      { label: "主动版", text: "我今晚先发阶段版给您看，完整版本申请明早前补齐，可以吗？" },
    ],
  },
  {
    key: "needClarifyRequirements",
    label: "需要确认需求",
    keywords: [/需求|范围|标准|口径|格式|具体|怎么做|做到什么程度|确认一下|看一下/],
    replies: [
      { label: "简短版", text: "收到，我先确认下范围和输出标准。" },
      { label: "稳妥版", text: "收到，我想先确认目标、范围和截止时间，避免后面返工。" },
      { label: "主动版", text: "收到，我先按现有信息列个方向，也想跟您确认下重点和交付口径。" },
    ],
  },
  {
    key: "needReportProgress",
    label: "需要汇报进度",
    keywords: [/汇报|同步|进展|阶段结果|当前情况|完成了哪些|剩余|卡点/],
    replies: [
      { label: "简短版", text: "目前已完成主要框架，剩余细节我今天内补齐。" },
      { label: "稳妥版", text: "目前框架和关键内容已完成，剩余校对和补充预计今天下班前完成。" },
      { label: "主动版", text: "我先同步当前进展、卡点和下一步安排，方便您判断优先级。" },
    ],
  },
  {
    key: "needDeclineUnreasonable",
    label: "需要拒绝不合理安排",
    keywords: [/不合理|做不了|无法保证|超出范围|不现实|没有资源|排期冲突|同时做不了|不建议这样做/],
    replies: [
      { label: "简短版", text: "这个安排我这边可能无法保证质量，建议先确认优先级。" },
      { label: "稳妥版", text: "目前时间和资源可能无法同时保证质量，建议先明确优先级和取舍。" },
      { label: "主动版", text: "我建议先保留核心目标，其他部分顺延处理，这样交付质量更稳。" },
    ],
  },
];

export function matchWorkplaceReplyTemplate(text: string, intent: string, urgency: UrgencyLevel) {
  const normalized = `${intent} ${text}`;
  const explicitMatch = workplaceReplyTemplates.find((template) =>
    template.keywords.some((pattern) => pattern.test(normalized)),
  );

  if (explicitMatch) return explicitMatch;

  if (intent === "布置任务") return getWorkplaceReplyTemplate("leaderTask");
  if (intent === "催进度") return getWorkplaceReplyTemplate("leaderProgress");
  if (intent === "修改反馈") return getWorkplaceReplyTemplate("leaderRevision");
  if (intent === "表达不满") return getWorkplaceReplyTemplate("leaderSeriousTone");
  if (intent === "临时安排" || urgency === "高") return getWorkplaceReplyTemplate("leaderTemporaryArrangement");
  if (intent === "表扬认可") return getWorkplaceReplyTemplate("leaderPraise");
  if (intent === "确认责任") return getWorkplaceReplyTemplate("leaderAccountability");
  if (intent === "需要用户主动补充信息" || intent === "模糊试探") return getWorkplaceReplyTemplate("needClarifyRequirements");

  return getWorkplaceReplyTemplate("leaderTask");
}

export function getWorkplaceReplyTemplate(key: WorkplaceReplyTemplateKey) {
  return workplaceReplyTemplates.find((template) => template.key === key) ?? workplaceReplyTemplates[0];
}
