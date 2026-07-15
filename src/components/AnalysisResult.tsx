import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Check,
  Clipboard,
  Clock3,
  Flag,
  Lightbulb,
  MessageSquareReply,
  Route,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { LoadingState } from "./LoadingState";
import type { AnalyzeMode } from "../lib/analyzeChat";
import { formatAnalysisResult } from "../lib/formatAnalysis";
import type { AnalysisResult as AnalysisResultData, UrgencyLevel } from "../types/analysis";

type AnalysisResultPanelProps = {
  analysis: AnalysisResultData | null;
  mode: AnalyzeMode | null;
  notice: string;
  isAnalyzing: boolean;
  canCopy: boolean;
};

type CopyText = (text: string, key: string) => Promise<void>;

export function AnalysisResultPanel({ analysis, mode, notice, isAnalyzing, canCopy }: AnalysisResultPanelProps) {
  const [copied, setCopied] = useState("");

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1400);
  }

  if (!analysis) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <SectionHeader title="分析结果" subtitle="结果会在这里展开，先不用急着下结论。" />
        {notice ? <Notice tone="error" text={notice} /> : null}
        <LoadingState isLoading={isAnalyzing} />
      </section>
    );
  }

  const fullText = formatAnalysisResult(analysis);
  const isSingleMessage = analysis.summary.includes("当前只有单条消息");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          title="分析结果"
          subtitle={mode === "ai" ? "AI 返回结果已整理成可读卡片。" : "当前为本地估算版本，适合作为粗略参考。"}
        />
        <button
          type="button"
          disabled={!canCopy}
          onClick={() => copyText(fullText, "all")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {copied === "all" ? <Check size={16} /> : <Clipboard size={16} />}
          {copied === "all" ? "已复制" : "复制分析结果"}
        </button>
      </div>

      {notice ? <Notice tone="info" text={notice} /> : null}
      {isSingleMessage ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          当前只有单条消息，判断可能不完整，建议结合上下文使用。
        </div>
      ) : null}

      {analysis.detectedScenario === "leader" && !isSingleMessage ? (
        <LeaderResultContent analysis={analysis} copied={copied} copyText={copyText} />
      ) : (
        <GeneralResultContent analysis={analysis} copied={copied} copyText={copyText} compact={isSingleMessage} />
      )}
    </section>
  );
}

function LeaderResultContent({ analysis, copied, copyText }: { analysis: AnalysisResultData; copied: string; copyText: CopyText }) {
  return (
    <div className="grid gap-4">
      <ResultCard icon={<Flag size={18} />} title="核心意图">
        <p className="text-sm leading-6 text-slate-600">目前看，{analysis.coreIntent}</p>
      </ResultCard>

      <ResultCard icon={<Lightbulb size={18} />} title="语气倾向">
        <ToneContent analysis={analysis} />
      </ResultCard>

      <ResultCard icon={<Clock3 size={18} />} title="紧急程度">
        <UrgencyBadge level={analysis.urgencyLevel} />
        <p className="mt-3 text-sm leading-6 text-slate-600">建议按这个紧急程度安排回复节奏，先给明确反馈时间。</p>
      </ResultCard>

      <ResultCard icon={<Route size={18} />} title="当前沟通阶段">
        <p className="text-sm leading-6 text-slate-600">倾向于：{analysis.relationshipStage}</p>
      </ResultCard>

      <ResultCard icon={<TriangleAlert size={18} />} title="回复时建议留意">
        <p className="mb-3 text-sm leading-6 text-slate-500">这些点只是帮你把回复写稳，不代表情况一定很严重。</p>
        <BulletList items={analysis.riskPoints} />
      </ResultCard>

      <ResultCard icon={<ShieldAlert size={18} />} title="不太建议这样表达">
        <p className="mb-3 text-sm leading-6 text-slate-500">可以尽量避开下面这些说法，让回复更清楚、更少误解。</p>
        <BulletList items={analysis.avoidExpressions} />
      </ResultCard>

      <ResultCard icon={<Route size={18} />} title="建议回复策略">
        <p className="text-sm leading-6 text-slate-600">{analysis.replyStrategy}</p>
      </ResultCard>

      <ResultCard icon={<MessageSquareReply size={18} />} title="推荐回复">
        <ReplyGrid replies={analysis.recommendedReplies} copied={copied} copyText={copyText} />
      </ResultCard>

      <ResultCard icon={<Sparkles size={18} />} title="后续行动建议">
        <BulletList items={analysis.followUpActions} />
        {analysis.meetOrWarmUpSuggestion ? (
          <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            {analysis.meetOrWarmUpSuggestion}
          </p>
        ) : null}
      </ResultCard>

      <ResultCard icon={<Flag size={18} />} title="总结">
        <p className="text-sm leading-6 text-slate-600">{analysis.summary}</p>
      </ResultCard>
    </div>
  );
}

function GeneralResultContent({
  analysis,
  copied,
  copyText,
  compact,
}: {
  analysis: AnalysisResultData;
  copied: string;
  copyText: CopyText;
  compact: boolean;
}) {
  const progressWidth = `${Math.max(0, Math.min(100, analysis.positivityScore))}%`;

  return (
    <div className="grid gap-4">
      <ResultCard icon={<Flag size={18} />} title={compact ? "核心意图" : "场景与核心意图"}>
        {!compact ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {analysis.scenarioLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              {analysis.relationshipStage}
            </span>
          </div>
        ) : null}
        <p className="text-sm leading-6 text-slate-600">{analysis.coreIntent}</p>
      </ResultCard>

      <ResultCard icon={<Lightbulb size={18} />} title="语气倾向">
        <ToneContent analysis={analysis} />
      </ResultCard>

      <ResultCard icon={<Clock3 size={18} />} title="紧急程度">
        <UrgencyBadge level={analysis.urgencyLevel} />
      </ResultCard>

      {!compact ? (
        <ResultCard icon={<BarChart3 size={18} />} title="沟通顺畅程度">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">顺畅度 / 积极度</span>
            <span className="text-slate-500">{analysis.positivityScore}/100</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500/75" style={{ width: progressWidth }} />
          </div>
        </ResultCard>
      ) : null}

      <ResultCard icon={<TriangleAlert size={18} />} title={compact ? "是否需要确认细节" : "需要注意的点"}>
        <BulletList items={analysis.riskPoints} />
      </ResultCard>

      {!compact ? (
        <ResultCard icon={<ShieldAlert size={18} />} title="不建议使用的表达">
          <BulletList items={analysis.avoidExpressions} />
        </ResultCard>
      ) : null}

      <ResultCard icon={<Route size={18} />} title="回复策略">
        <p className="text-sm leading-6 text-slate-600">{analysis.replyStrategy}</p>
      </ResultCard>

      <ResultCard icon={<MessageSquareReply size={18} />} title="推荐回复">
        <ReplyGrid replies={analysis.recommendedReplies} copied={copied} copyText={copyText} />
      </ResultCard>

      {!compact ? (
        <ResultCard icon={<Sparkles size={18} />} title="后续行动">
          <BulletList items={analysis.followUpActions} />
          {analysis.meetOrWarmUpSuggestion ? (
            <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {analysis.meetOrWarmUpSuggestion}
            </p>
          ) : null}
        </ResultCard>
      ) : null}

      <ResultCard icon={<Flag size={18} />} title="简短总结">
        <p className="text-sm leading-6 text-slate-600">{analysis.summary}</p>
      </ResultCard>
    </div>
  );
}

function ToneContent({ analysis }: { analysis: AnalysisResultData }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-800">{analysis.toneTendency.label}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
          置信度：{analysis.toneTendency.confidence}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{analysis.toneTendency.explanation}</p>
    </>
  );
}

function ReplyGrid({
  replies,
  copied,
  copyText,
}: {
  replies: AnalysisResultData["recommendedReplies"];
  copied: string;
  copyText: CopyText;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {replies.map((reply, index) => (
        <button
          key={`${reply.label}-${reply.text}`}
          type="button"
          onClick={() => copyText(reply.text, `reply-${index}`)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
        >
          <span className="block text-xs font-semibold text-calm">{reply.label}</span>
          <span className="mt-1 block text-sm leading-6 text-slate-700">{reply.text}</span>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-calm">
            {copied === `reply-${index}` ? <Check size={13} /> : <Clipboard size={13} />}
            {copied === `reply-${index}` ? "已复制" : "点击复制"}
          </span>
        </button>
      ))}
    </div>
  );
}

function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  const classNameByLevel: Record<UrgencyLevel, string> = {
    高: "border-amber-200 bg-amber-50 text-amber-800",
    中: "border-sky-200 bg-sky-50 text-sky-800",
    低: "border-emerald-200 bg-emerald-50 text-emerald-800",
    不明确: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${classNameByLevel[level] ?? classNameByLevel["不明确"]}`}>
      紧急程度：{level}
    </span>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
    </div>
  );
}

function ResultCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-calm">
        {icon}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </article>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm leading-6 text-slate-600">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Notice({ tone, text }: { tone: "info" | "error"; text: string }) {
  const className =
    tone === "error"
      ? "mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      : "mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800";

  return <div className={className}>{text}</div>;
}
