// 任务编排：视频 → 转写 → 规划 → 建工程 → 校验 → 渲染 → 成片
import fs from "node:fs";
import path from "node:path";
import { transcribe, parseWhisperJson, run } from "./transcribe.mjs";
import { plan as makePlan } from "./plan.mjs";
import { build } from "./build.mjs";
import { check, render } from "./render.mjs";

export function makeCaps(sentences) {
  return sentences.map((s, i) => ({
    id: "cap" + (i + 1),
    text: s.text || "",
    start: +s.start.toFixed(3),
    dur: +Math.max(0.8, s.end - s.start).toFixed(3),
    words: (s.words || []).map((w) => ({ w: w.w, start: w.start }))
  }));
}

export async function probeDuration(file) {
  const { out } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  const d = parseFloat(out.trim());
  if (!isFinite(d) || d <= 0) throw new Error("读不出视频时长");
  return d;
}

// 渲染器是逐帧抓取的，要求关键帧密集；间隔过大时自动转码补齐（如手机/剪辑导出的成片）
async function ensureDenseKeyframes(file, dir, log) {
  const { out } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", file]);
  const times = out.split(/\s+/).map((s) => parseFloat(s)).filter((n) => isFinite(n));
  let maxGap = 0;
  for (let i = 1; i < times.length; i++) maxGap = Math.max(maxGap, times[i] - times[i - 1]);
  if (times.length >= 2 && maxGap <= 1.0) return null;
  log(`关键帧间隔 ${maxGap > 0 ? maxGap.toFixed(1) + "s" : "未知"}，先转码补齐（逐帧渲染需要）…`);
  const outFile = path.join(dir, "a_roll.mp4");
  await run("ffmpeg", ["-y", "-v", "error", "-i", file, "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-g", "5", "-keyint_min", "5", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "copy", outFile]);
  return "a_roll.mp4";
}

export async function prepare(job, log, setProgress) {
  const { workDir, mode, prompt, videoPath, videoName } = job;
  fs.mkdirSync(workDir, { recursive: true });

  let sentences = [], videoFile = null, caps = [];
  if (mode === "video") {
    const target = path.join(workDir, videoName);
    if (videoPath !== target) fs.copyFileSync(videoPath, target);
    let src = target;
    const dense = await ensureDenseKeyframes(target, workDir, log);
    if (dense) {
      src = path.join(workDir, dense);
      try { fs.unlinkSync(target); } catch {}
    }
    videoFile = path.basename(src);
    const dur = await probeDuration(src);
    log(`收到视频：${videoName}（${dur.toFixed(1)}s）`);
    setProgress(10);
    const raw = await transcribe(src, workDir, log);
    setProgress(30);
    job.stage = "规划分镜";
    const parsed = parseWhisperJson(raw, dur);
    if (!parsed.sentences.length) throw new Error("转写没有结果");
    sentences = parsed.sentences;
    caps = makeCaps(sentences);
    log(`转写完成：${sentences.length} 句 / ${parsed.words.length} 词`);
  } else {
    log("提示词模式：先生成文稿…");
    job.stage = "写稿";
    setProgress(10);
  }

  log("规划分镜…");
  const plan = await makePlan({ sentences, mode, prompt, log });
  if (mode === "prompt") caps = makeCaps(plan.units);
  setProgress(45);

  return { plan, caps, videoFile };
}

export async function finish(job, draft, log, setProgress) {
  const { total } = build({ workDir: job.workDir, ...draft, log });
  setProgress(55);

  job.stage = "校验";
  await check(job.workDir, log);
  setProgress(60);

  job.stage = "渲染";
  const out = await render(job.workDir, "final.mp4", log, (p) => setProgress(60 + Math.round(p * 0.39)));
  log(`完成：${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
  return { output: out, total };
}
