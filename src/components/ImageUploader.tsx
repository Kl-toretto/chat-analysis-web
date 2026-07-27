import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Upload } from "lucide-react";
import { MAX_IMAGE_SIZE_MB } from "../lib/ocrConfig";

type OcrStatusKind = "idle" | "loading" | "success" | "error";

type ImageUploaderProps = {
  fileName: string;
  statusKind: OcrStatusKind;
  statusMessage: string;
  onFileSelected: (file: File) => void;
};

const accept = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export function ImageUploader({ fileName, statusKind, statusMessage, onFileSelected }: ImageUploaderProps) {
  const isLoading = statusKind === "loading";

  return (
    <section className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">选择消息截图</h2>
        <p className="mt-1 text-sm text-slate-500">图片只在浏览器本地识别文字，不会上传到服务器。</p>
      </div>

      <label
        className={`flex min-h-80 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          isLoading
            ? "cursor-wait border-emerald-200 bg-emerald-50/70"
            : "cursor-pointer border-slate-300 bg-slate-50 hover:border-calm hover:bg-emerald-50/60"
        }`}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={isLoading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFileSelected(file);
            }
            event.currentTarget.value = "";
          }}
        />
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-calm shadow-sm">
          {isLoading ? <Loader2 className="animate-spin" size={24} /> : <ImagePlus size={24} />}
        </div>
        <span className="text-sm font-semibold text-slate-700">
          {isLoading ? "正在识别截图文字..." : "点击选择截图"}
        </span>
        <span className="mt-1 text-xs leading-5 text-slate-500">
          支持 png、jpg、jpeg、webp，单张不超过 {MAX_IMAGE_SIZE_MB}MB
        </span>
      </label>

      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        <Upload size={16} />
        <span className="truncate">{fileName || "尚未选择文件"}</span>
      </div>

      <StatusLine kind={statusKind} message={statusMessage} />
    </section>
  );
}

function StatusLine({ kind, message }: { kind: OcrStatusKind; message: string }) {
  if (!message) return null;

  const icon =
    kind === "loading" ? (
      <Loader2 className="animate-spin" size={16} />
    ) : kind === "success" ? (
      <CheckCircle2 size={16} />
    ) : kind === "error" ? (
      <AlertCircle size={16} />
    ) : (
      <Upload size={16} />
    );

  const tone =
    kind === "success"
      ? "text-emerald-700"
      : kind === "error"
        ? "text-rose-600"
        : kind === "loading"
          ? "text-calm"
          : "text-slate-500";

  return (
    <div className={`mt-3 flex items-start gap-2 text-sm leading-6 ${tone}`}>
      <span className="mt-0.5">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
