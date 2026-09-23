// 转写：ffmpeg 抽音 → whisper-cli 词级时间戳（JSON full）→ 解析成句
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildEnv } from "./env.mjs";
import * as OpenCC from "opencc-js";

// whisper 中文模型倾向输出繁体 + 半角标点，统一成简体中文的习惯写法
const t2s = OpenCC.Converter({ from: "tw", to: "cn" });
const PUNCT = [[/,/g, "，"], [/\.{3}/g, "…"], [/\./g, "。"], [/\?/g, "？"], [/!/g, "！"], [/:/g, "："], [/;/g, "；"]];
const toSimp = (s) => {
  let out = t2s(s);
  if (/[\u4e00-\u9fa5]/.test(out) || /^[\s,.:;?!]+$/.test(out)) for (const [re, ch] of PUNCT) out = out.replace(re, ch);
  return out;
};

export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: buildEnv(), ...opts });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => code === 0 ? resolve({ out, err }) : reject(new Error(`exit ${code}: ${(err || out).slice(-1200)}`)));
  });
}

const SPECIAL = /^\[_[A-Z_]*\d*\]$/;

export function findModel() {
  if (process.env.HF_WHISPER_MODEL && fs.existsSync(process.env.HF_WHISPER_MODEL)) return process.env.HF_WHISPER_MODEL;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const dir = path.join(home, ".cache", "hyperframes", "whisper", "models");
  if (!fs.existsSync(dir)) throw new Error("找不到 whisper 模型目录：" + dir);
  const files = fs.readdirSync(dir).filter((f) => /^ggml-.*\.bin$/.test(f));
  const prefer = ["ggml-small.bin", "ggml-base.bin", "ggml-medium.bin", "ggml-tiny.bin"];
  for (const p of prefer) if (files.includes(p)) return path.join(dir, p);
  if (!files.length) throw new Error("模型目录里没有 ggml-*.bin：" + dir);
  return path.join(dir, files[0]);
}

export function parseWhisperJson(raw, audioDurationSec) {
  const segs = raw.transcription || raw.segments || [];
  let last = 0;
  segs.forEach((s) => { const t = s.offsets && s.offsets.to; if (typeof t === "number") last = Math.max(last, t); });
  const scale = audioDurationSec > 0 && last / 1000 > audioDurationSec * 1.5 ? 0.01 : 0.001;

  const words = [];
  segs.forEach((s) => {
    (s.tokens || []).forEach((tk) => {
      const text = String(tk.text || "").replace(/^\s+/, "");
      if (!text.trim() || SPECIAL.test(text.trim())) return;
      const from = tk.offsets ? tk.offsets.from : 0;
      const to = tk.offsets ? tk.offsets.to : from;
      words.push({ w: toSimp(text), start: +(from * scale).toFixed(3), end: +(to * scale).toFixed(3) });
    });
  });
  if (!words.length) throw new Error("whisper 没有输出任何词");

  const sentences = [];
  let cur = [];
  const END = /[。！？!?]$/;
  const SOFT = /[，,、；;]$/;
  words.forEach((wd, i) => {
    cur.push(wd);
    const next = words[i + 1];
    const gap = next ? next.start - wd.end : 99;
    const chars = cur.reduce((n, x) => n + x.w.length, 0);
    if (END.test(wd.w) || gap > 0.6 || chars > 26 || (SOFT.test(wd.w) && chars > 15) || !next) {
      const text = cur.map((x) => x.w).join("").replace(/\s+/g, "").replace(/，$/, "");
      if (text.replace(/[，。！？、\s]/g, "").length > 1) {
        sentences.push({ text, start: cur[0].start, end: cur[cur.length - 1].end, words: cur.slice() });
      }
      cur = [];
    }
  });
  return { sentences, words };
}

export async function transcribe(videoPath, workDir, log) {
  const whisper = process.env.HYPERFRAMES_WHISPER_PATH || buildEnv().HYPERFRAMES_WHISPER_PATH;
  if (!whisper || !fs.existsSync(whisper)) throw new Error("找不到 whisper-cli，请确认 HYPERFRAMES_WHISPER_PATH");
  const model = findModel();
  const wav = path.join(workDir, "audio16k.wav");
  const prefix = path.join(workDir, "asr");

  log("抽取音轨（16k 单声道）…");
  await run("ffmpeg", ["-y", "-v", "error", "-i", videoPath, "-ar", "16000", "-ac", "1", "-vn", wav]);

  log(`语音识别（${path.basename(model)}）…`);
  const t0 = Date.now();
  await run(whisper, [
    "-m", model, "-f", wav, "-l", "zh",
    "--prompt", "以下是普通话的句子，请使用简体中文转写。",
    "-ojf", "-of", prefix, "-ml", "24"
  ]);
  const jsonPath = prefix + ".json";
  if (!fs.existsSync(jsonPath)) throw new Error("whisper 没有产出 JSON");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  log(`识别完成（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
  return raw;
}
