import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  isLoading: boolean;
};

export function LoadingState({ isLoading }: LoadingStateProps) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm leading-7 text-slate-600">
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin text-calm" size={16} />
          正在分析消息语境，请稍等一下。
        </span>
      ) : (
        "粘贴聊天记录、单条消息或上传截图后，点击分析按钮。系统会用偏保守的方式看沟通状态，不制造焦虑。"
      )}
    </div>
  );
}
