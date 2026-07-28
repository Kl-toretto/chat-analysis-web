import { createWorker } from "tesseract.js";
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB } from "./ocrConfig";
import { normalizeOcrText } from "./textClean";

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const OCR_ASSET_BASE = "/ocr/v7";
const OCR_TIMEOUT_MS = 120_000;
const WORKER_IDLE_TIMEOUT_MS = 120_000;

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

export type OcrProgress = {
  status: string;
  progress: number;
};

let workerPromise: Promise<OcrWorker> | null = null;
let activeProgressListener: ((progress: OcrProgress) => void) | undefined;
let workerIdleTimer: ReturnType<typeof setTimeout> | undefined;

const OCR_STATUS_LABELS: Record<string, string> = {
  "loading tesseract core": "正在加载本地 OCR 引擎...",
  "initializing tesseract": "正在初始化 OCR 引擎...",
  "loading language traineddata": "正在加载中英文识别模型...",
  "initializing api": "正在准备文字识别...",
  "recognizing text": "正在识别截图文字...",
};

export function validateOcrImage(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "只支持 png、jpg、jpeg、webp 格式的截图。";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `图片不能超过 ${MAX_IMAGE_SIZE_MB}MB，请压缩或裁剪后再上传。`;
  }

  return null;
}

function localAssetUrl(path: string) {
  return new URL(`${OCR_ASSET_BASE}/${path}`, window.location.origin).toString();
}

function clearWorkerIdleTimer() {
  if (workerIdleTimer) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = undefined;
  }
}

function resetWorker() {
  clearWorkerIdleTimer();
  const pendingWorker = workerPromise;
  workerPromise = null;

  if (pendingWorker) {
    void pendingWorker.then((worker) => worker.terminate()).catch(() => undefined);
  }
}

function scheduleWorkerTermination() {
  clearWorkerIdleTimer();
  workerIdleTimer = setTimeout(resetWorker, WORKER_IDLE_TIMEOUT_MS);
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(["chi_sim", "eng"], 1, {
      workerPath: localAssetUrl("worker.min.js"),
      corePath: localAssetUrl("core"),
      langPath: localAssetUrl("lang"),
      logger: (message) => {
        activeProgressListener?.({
          status: OCR_STATUS_LABELS[message.status] ?? "正在处理截图...",
          progress: Math.round((message.progress || 0) * 100),
        });
      },
    })
      .then(async (worker) => {
        await worker.setParameters({
          preserve_interword_spaces: "1",
        });
        return worker;
      })
      .catch((error) => {
        workerPromise = null;
        throw error;
      });
  }

  return workerPromise;
}

async function withTimeout<T>(operation: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("OCR 加载或识别超时，请检查网络后重试，或直接粘贴聊天文字。"));
    }, OCR_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function recognizeImageText(file: File, onProgress?: (progress: OcrProgress) => void) {
  const validationError = validateOcrImage(file);
  if (validationError) {
    throw new Error(validationError);
  }

  clearWorkerIdleTimer();
  activeProgressListener = onProgress;

  try {
    return await withTimeout(
      (async () => {
        const worker = await getWorker();
        const result = await worker.recognize(file);
        return normalizeOcrText(result.data.text);
      })(),
    );
  } catch (error) {
    resetWorker();
    const message = error instanceof Error ? error.message : "OCR 识别失败";
    throw new Error(`识别失败：${message}`);
  } finally {
    activeProgressListener = undefined;
    if (workerPromise) {
      scheduleWorkerTermination();
    }
  }
}
