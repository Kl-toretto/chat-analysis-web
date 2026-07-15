import type { ReactNode } from "react";

type ResultCardProps = {
  icon: ReactNode;
  title: string;
  content: string | string[];
};

export function ResultCard({ icon, title, content }: ResultCardProps) {
  const items = Array.isArray(content) ? content : [content];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30">
      <div className="mb-2 flex items-center gap-2 text-calm">
        {icon}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {items.length > 1 ? (
        <ul className="space-y-1.5 text-sm leading-6 text-slate-600">
          {items.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-slate-600">{items[0]}</p>
      )}
    </article>
  );
}
