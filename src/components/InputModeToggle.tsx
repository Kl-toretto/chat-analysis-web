import type { AnalysisInputMode } from "../types/analysis";

type InputModeToggleProps = {
  value: AnalysisInputMode;
  onChange: (value: AnalysisInputMode) => void;
};

const modes: Array<{ value: AnalysisInputMode; label: string; description: string }> = [
  { value: "chat", label: "聊天记录分析", description: "适合多轮对话、截图 OCR 文本" },
  { value: "single", label: "单条消息回复", description: "适合只分析对方刚发来的一句话" },
];

export function InputModeToggle({ value, onChange }: InputModeToggleProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">输入模式</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          单条消息模式会更关注核心意图、语气、紧急程度和短回复建议。
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {modes.map((mode) => {
          const selected = mode.value === value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                selected
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/60"
              }`}
            >
              <span className="block text-sm font-semibold">{mode.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{mode.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
