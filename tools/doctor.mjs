import fs from "node:fs";
import { buildEnv, whisperModelPath } from "../lib/env.mjs";
import { run } from "../lib/transcribe.mjs";

const env = buildEnv();
let failed = false;
function line(name, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ": " + detail : ""}`);
  if (!ok) failed = true;
}

line("Node.js", Number(process.versions.node.split(".")[0]) >= 22, process.version + "（HyperFrames 需要 22+）");
for (const command of ["ffmpeg", "ffprobe"]) {
  try {
    const result = await run(command, ["-version"]);
    line(command, true, result.out.split(/\r?\n/)[0]);
  } catch {
    line(command, false, "无法运行，请检查 PATH");
  }
}

const whisper = env.HYPERFRAMES_WHISPER_PATH;
line("Whisper CLI", !!whisper && fs.existsSync(whisper), whisper ? (fs.existsSync(whisper) ? whisper : "配置路径不存在") : "请设置 HYPERFRAMES_WHISPER_PATH");
const model = env.HF_WHISPER_MODEL;
const modelDir = whisperModelPath();
const hasModel = model ? fs.existsSync(model) : fs.existsSync(modelDir) && fs.readdirSync(modelDir).some((name) => /^ggml-.*\.bin$/.test(name));
line("Whisper 模型", hasModel, hasModel ? (model || modelDir) : "请设置 HF_WHISPER_MODEL 或放入默认模型目录");

const browser = env.HYPERFRAMES_BROWSER_PATH;
line("浏览器路径", !browser || fs.existsSync(browser), browser ? (fs.existsSync(browser) ? browser : "配置路径不存在") : "未显式配置，HyperFrames 将使用其默认浏览器");
console.log(env.DEEPSEEK_API_KEY
  ? "✓ DeepSeek 环境变量：已配置（不显示密钥）；网页中也可切换其他模型"
  : "• 模型 API：可在网页中配置；未配置时使用启发式分镜");
process.exitCode = failed ? 1 : 0;
