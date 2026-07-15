import { Clock, RotateCcw, Trash2 } from "lucide-react";
import type { AnalysisHistoryItem } from "../lib/history";
import { getScenarioLabel } from "../types/scenario";

type HistoryPanelProps = {
  items: AnalysisHistoryItem[];
  onLoad: (item: AnalysisHistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export function HistoryPanel({ items, onLoad, onDelete, onClear }: HistoryPanelProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-calm" />
            <h2 className="text-lg font-semibold">历史分析</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            最近 10 次分析会保存在当前设备浏览器中，不会上传服务器。
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!items.length}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <Trash2 size={15} />
          清空全部
        </button>
      </div>

      {!items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
          暂无历史记录。完成一次分析后会自动保存到这里。
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <button type="button" onClick={() => onLoad(item)} className="min-w-0 flex-1 text-left">
                  <div className="text-sm font-semibold text-slate-800">{formatTime(item.createdAt)}</div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{item.chatSummary}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.result.scenarioLabel || getScenarioLabel(item.scenario ?? "auto")} · {item.result.relationshipStage} ·{" "}
                    {item.result.toneTendency.label} · {item.result.positivityScore}/100
                  </p>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onLoad(item)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-calm"
                  >
                    <RotateCcw size={14} />
                    查看
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
