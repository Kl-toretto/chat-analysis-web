import { Trash2 } from "lucide-react";
import type { AnalysisInputMode } from "../types/analysis";

type ChatInputProps = {
  mode: AnalysisInputMode;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export function ChatInput({ mode, value, onChange, onClear }: ChatInputProps) {
  const isSingle = mode === "single";

  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{isSingle ? "输入对方单条消息" : "粘贴消息记录"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isSingle
              ? "适合快速判断一句消息怎么回，建议结合上下文使用。"
              : "支持“我：…”“对方：…”格式，也可以粘贴工作、客户、导师、家人等对话。"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <Trash2 size={15} />
          清空
        </button>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          isSingle
            ? "示例：\n这个方案你再改一下，重点不够突出。"
            : "示例：\n我：这个材料我今天晚点整理给您，可以吗？\n对方：可以，最好下班前给我一个简版。"
        }
        className="min-h-80 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-calm focus:bg-white focus:ring-4 focus:ring-emerald-100"
      />
    </section>
  );
}
