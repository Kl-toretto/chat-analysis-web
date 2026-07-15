import { ShieldAlert } from "lucide-react";

const notices = [
  "请确认你有权分析这段聊天。",
  "建议上传前遮挡头像、姓名、手机号、地址等敏感信息。",
  "分析结果仅供参考，不能代表对方真实想法。",
  "请尊重对方边界，不建议骚扰式追问。",
];

export function PrivacyNotice() {
  return (
    <aside className="rounded-3xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-950 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="shrink-0" size={18} />
          隐私与边界
        </div>
        <ul className="grid flex-1 gap-2 sm:grid-cols-2">
          {notices.map((notice) => (
            <li key={notice} className="flex gap-2 leading-6">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{notice}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
