import { MessagesSquare } from "lucide-react";

export function Header() {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-soft sm:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-calm">
            <MessagesSquare size={24} strokeWidth={2.1} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">多场景聊天分析助手</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              帮你判断消息语气、沟通节奏和回复方式，给出自然、稳妥、不越界的建议。
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          多场景 · AI / Mock
        </span>
      </div>
    </header>
  );
}
