# 多场景聊天分析助手

这是一个“多场景聊天分析助手”，用于帮助用户理解聊天语境、降低误解，并生成更自然、稳妥的回复建议。项目基于 Vite + React + TypeScript，前端部署为静态网页，后端分析接口使用 Vercel Serverless Function。

支持的分析场景：

- 恋爱 / 暧昧聊天
- 普通朋友聊天
- 领导 / 上级消息回复
- 同事协作沟通
- 客户 / 甲方沟通
- 老师 / 导师沟通
- 家人沟通
- 自动判断

本项目用于帮助用户改善沟通表达，不用于操控他人或侵犯隐私。

## 功能列表

- 聊天记录文本输入
- 聊天截图 OCR 识别
- 多场景选择
- 单条消息快速回复
- AI 分析
- mock 兜底分析
- 推荐回复复制
- 隐私提示
- 本地历史记录，最近 10 次结果保存在当前浏览器 `localStorage`

OCR 在浏览器本地完成。选择截图后，系统会先识别为文字并填入输入框；用户检查文字后，只有点击“开始分析”才会把文本发送到 `/api/analyze`。

## 本地运行

安装依赖：

```powershell
npm install
```

启动前端开发服务：

```powershell
npm run dev
```

本地访问：

```text
http://localhost:5173
```

本地 `npm run dev` 主要用于调试前端。只运行 Vite 时，没有完整的 Vercel Serverless Function 环境，真实 AI 接口可能不可用，页面会使用 mock 兜底分析。

如果要完整模拟 Vercel API，可以使用 Vercel 本地开发命令：

```powershell
npx vercel dev
```

## 环境变量

本地 `.env` 示例：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

注意：

- 不要使用 `VITE_OPENAI_API_KEY`。
- `VITE_` 开头的环境变量会进入前端构建环境，存在暴露风险。
- `OPENAI_API_KEY` 必须只由 `api/analyze.ts` 在服务端读取。
- 不要把真实 `.env` 提交到 GitHub。

## 公网部署到 Vercel

1. 将项目推送到 GitHub。
2. 登录 Vercel。
3. 点击 `New Project`。
4. 选择该 GitHub 仓库。
5. `Framework Preset` 选择 `Vite`。
6. `Build Command` 填写 `npm run build`。
7. `Output Directory` 填写 `dist`。
8. 在 `Environment Variables` 中添加：
   - `OPENAI_API_KEY`
   - `OPENAI_BASE_URL`
   - `OPENAI_MODEL`
9. 点击 `Deploy`。
10. 部署完成后，访问 Vercel 生成的公网链接。

项目根目录的 `vercel.json` 已明确配置：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

不要把 API Key 写入 `vercel.json`。

## 部署后的使用方式

部署成功后，不需要再运行 `npm run dev`。也不需要启动 `127.0.0.1:8787`。用户只需要打开：

```text
https://项目名.vercel.app
```

使用流程：

1. 打开公网网址。
2. 选择分析场景。
3. 粘贴聊天记录，或上传聊天截图。
4. 检查 OCR 识别文本。
5. 点击开始分析。
6. 查看核心意图、语气倾向、风险点和推荐回复。
7. 点击推荐回复卡片即可复制。

## 隐私说明

- 本项目用于帮助用户改善沟通表达，不用于操控他人或侵犯隐私。
- 请确认你有权分析相关聊天内容。
- 建议上传前遮挡姓名、头像、手机号、地址等敏感信息。
- 分析结果仅供参考，不能代表对方真实想法。
- 请尊重对方边界，不建议骚扰式追问。
- OCR 在浏览器本地完成，不会把图片上传到服务器。
- 历史记录只保存在当前设备的当前浏览器中。

## 常见问题

### Q1：为什么不能访问 127.0.0.1:8787？

`127.0.0.1` 只代表当前电脑，无法被其他设备访问。公网部署后应访问 Vercel 生成的网址，例如：

```text
https://项目名.vercel.app
```

### Q2：为什么部署后分析失败？

请检查 Vercel 环境变量是否配置了：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

如果没有配置 `OPENAI_API_KEY`，项目会返回 mock 兜底分析，而不应该导致页面完全不可用。

### Q3：为什么网页能打开，但 /api/analyze 报错？

请查看 Vercel Functions 日志，重点检查：

- API Key 是否正确
- 模型名是否可用
- 接口地址是否正确
- OpenAI 兼容接口是否返回了符合 JSON 格式的内容
- 返回内容是否符合 `AnalysisResult` 字段结构

### Q4：API Key 会不会暴露？

不会。API Key 只在 Vercel Serverless Function 中读取，不进入前端打包文件。前端只调用同源接口：

```ts
fetch("/api/analyze")
```

不要创建或使用 `VITE_OPENAI_API_KEY`。
