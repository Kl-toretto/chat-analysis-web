import type { ChatScenario } from "../types/scenario";
import { scenarioOptions } from "../types/scenario";

type ScenarioSelectorProps = {
  value: ChatScenario;
  onChange: (value: ChatScenario) => void;
};

export function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">分析场景</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          选择最接近的沟通场景，系统会调整语气判断和回复建议。拿不准就用“自动判断”。
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {scenarioOptions.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                selected
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/60"
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
