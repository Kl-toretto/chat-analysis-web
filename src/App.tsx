import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Header } from "./components/Header";
import { InputModeToggle } from "./components/InputModeToggle";
import { ScenarioSelector } from "./components/ScenarioSelector";
import { ChatInput } from "./components/ChatInput";
import { ImageUploader } from "./components/ImageUploader";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { AnalysisResultPanel } from "./components/AnalysisResult";
import { HistoryPanel } from "./components/HistoryPanel";
import { analyzeChat, type AnalyzeMode } from "./lib/analyzeChat";
import { addHistoryItem, clearHistory, deleteHistoryItem, loadHistory, type AnalysisHistoryItem } from "./lib/history";
import type { AnalysisInputMode, AnalysisResult, ChatScenario } from "./types/analysis";

type OcrStatusKind = "idle" | "loading" | "success" | "error";

const sampleText = `我：这个材料我今天晚点整理给您，可以吗？
对方：可以，最好下班前给我一个简版，我明早要用。
我：明白，我先发重点版，细节明天再补。
对方：好，辛苦。`;

export default function App() {
  const [inputMode, setInputMode] = useState<AnalysisInputMode>("chat");
  const [chatText, setChatText] = useState(sampleText);
  const [selectedScenario, setSelectedScenario] = useState<ChatScenario>("auto");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalyzeMode | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [history, setHistory] = useState<AnalysisHistoryItem[]>(() => loadHistory());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrStatusKind, setOcrStatusKind] = useState<OcrStatusKind>("idle");
  const [ocrStatusMessage, setOcrStatusMessage] = useState("");
  const ocrRequestId = useRef(0);

  const canAnalyze = chatText.trim().length > 0 && ocrStatusKind !== "loading" && !isAnalyzing;

  function handleModeChange(mode: AnalysisInputMode) {
    setInputMode(mode);
    setAnalysis(null);
    setAnalysisMode(null);
    setAnalysisNotice("");
  }

  async function handleAnalyze() {
    if (!canAnalyze) {
      setAnalysisNotice(inputMode === "single" ? "先输入对方发来的一条消息，再生成回复建议。" : "先粘贴消息记录，或上传截图识别文字后再分析。");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisNotice("");

    try {
      const response = await analyzeChat(chatText, selectedScenario, inputMode);
      setAnalysis(response.analysis);
      setAnalysisMode(response.mode);
      setAnalysisNotice(response.notice ?? "");
      setHistory(addHistoryItem(chatText, response.analysis, selectedScenario));
    } catch (error) {
      setAnalysis(null);
      setAnalysisMode(null);
      setAnalysisNotice(error instanceof Error ? error.message : "分析失败，请稍后再试。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleClear() {
    setChatText("");
    setAnalysis(null);
    setAnalysisMode(null);
    setAnalysisNotice("");
    setFileName("");
    setOcrStatusKind("idle");
    setOcrStatusMessage("");
  }

  function handleLoadHistory(item: AnalysisHistoryItem) {
    setAnalysis(item.result);
    if (item.scenario) setSelectedScenario(item.scenario);
    setAnalysisMode("mock");
    setAnalysisNotice("已从本地历史记录中载入。历史记录仅保存在当前设备浏览器中。");
  }

  function handleDeleteHistory(id: string) {
    setHistory(deleteHistoryItem(id));
  }

  function handleClearHistory() {
    setHistory(clearHistory());
  }

  async function handleImageSelected(file: File) {
    const requestId = ocrRequestId.current + 1;
    ocrRequestId.current = requestId;
    setFileName(file.name);
    setAnalysis(null);
    setAnalysisMode(null);
    setAnalysisNotice("");
    setOcrStatusKind("loading");
    setOcrStatusMessage("正在识别截图文字...");

    try {
      const { recognizeImageText } = await import("./lib/ocr");
      const text = await recognizeImageText(file, (progress) => {
        if (ocrRequestId.current !== requestId) return;
        const percent = progress.progress > 0 ? ` ${progress.progress}%` : "";
        setOcrStatusMessage(`正在识别截图文字...${percent}`);
      });

      if (ocrRequestId.current !== requestId) return;

      if (!text) {
        setOcrStatusKind("error");
        setOcrStatusMessage("没有识别到清晰文字。可以换一张更清楚的截图，或直接粘贴消息记录。");
        return;
      }

      setChatText(text);
      setOcrStatusKind("success");
      setOcrStatusMessage("识别完成，请检查文字是否准确。");
    } catch (error) {
      if (ocrRequestId.current !== requestId) return;
      setOcrStatusKind("error");
      setOcrStatusMessage(error instanceof Error ? error.message : "OCR 识别失败，请换图或手动粘贴文字。");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Header />
        <PrivacyNotice />
        <InputModeToggle value={inputMode} onChange={handleModeChange} />
        <ScenarioSelector value={selectedScenario} onChange={setSelectedScenario} />

        <section className="grid gap-5 lg:grid-cols-2">
          <ChatInput mode={inputMode} value={chatText} onChange={setChatText} onClear={handleClear} />
          <ImageUploader
            fileName={fileName}
            statusKind={ocrStatusKind}
            statusMessage={ocrStatusMessage}
            onFileSelected={handleImageSelected}
          />
        </section>

        {inputMode === "single" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            当前只有单条消息，判断可能不完整，建议结合上下文使用。
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={ocrStatusKind === "loading" || isAnalyzing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-calm px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {isAnalyzing ? "正在分析..." : inputMode === "single" ? "生成快速回复" : "开始沟通分析"}
          </button>
          <p className="text-sm leading-6 text-slate-500">
            {inputMode === "single" ? "建议把对方原话完整粘贴进来，回复会更稳。" : "建议先检查 OCR 文字，再开始沟通分析。"}
          </p>
        </div>

        <AnalysisResultPanel
          analysis={analysis}
          mode={analysisMode}
          notice={analysisNotice}
          isAnalyzing={isAnalyzing}
          canCopy={Boolean(analysis)}
        />

        <HistoryPanel items={history} onLoad={handleLoadHistory} onDelete={handleDeleteHistory} onClear={handleClearHistory} />
      </div>
    </main>
  );
}
