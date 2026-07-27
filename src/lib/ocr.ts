import { createWorker } from "tesseract.js";
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB } from "./ocrConfig";
import { normalizeOcrText } from "./textClean";

const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export type OcrProgress = {
  status: string;
  progress: number;
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

export async function recognizeImageText(file: File, onProgress?: (progress: OcrProgress) => void) {
  const validationError = validateOcrImage(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const worker = await createWorker(["chi_sim", "eng"], 1, {
    logger: (message) => {
      onProgress?.({
        status: message.status,
        progress: Math.round((message.progress || 0) * 100),
      });
    },
  });

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
    });

    const result = await worker.recognize(file);
    return normalizeOcrText(result.data.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR 识别失败";
    throw new Error(`识别失败：${message}`);
  } finally {
    await worker.terminate();
  }
}
