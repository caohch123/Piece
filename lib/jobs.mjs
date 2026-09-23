// 极简任务队列（内存）+ SSE 广播
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execute } from "./pipeline.mjs";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKSPACE = path.join(APP_DIR, "workspace");

export const jobs = new Map();

// 串行执行（渲染吃满 CPU，并行会互相拖慢）
let tail = Promise.resolve();
function enqueue(fn) {
  tail = tail.then(fn, fn);
  return tail;
}

export function createJob(input) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const job = {
    id,
    mode: input.mode,
    prompt: input.mode === "prompt" ? input.prompt : null,
    videoPath: input.videoPath || null,
    videoName: input.videoName || null,
    workDir: path.join(WORKSPACE, id),
    status: "queued",
    stage: "排队中",
    progress: 0,
    log: [],
    output: null,
    error: null,
    emitter: new EventEmitter(),
    createdAt: Date.now()
  };
  jobs.set(id, job);
  enqueue(() => run(job));
  return job;
}

async function run(job) {
  const log = (line) => {
    const text = String(line);
    for (const l of text.split(/\r?\n/)) {
      if (!l.trim()) continue;
      job.log.push(l);
      if (job.log.length > 400) job.log.shift();
      job.emitter.emit("log", l);
    }
  };
  const setProgress = (p) => { job.progress = Math.max(job.progress, Math.min(100, p)); job.emitter.emit("progress", job.progress); };
  try {
    job.status = "running";
    job.stage = job.mode === "video" ? "转写" : "写稿";
    setProgress(5);
    const res = await execute(job, log, setProgress);
    job.status = "done";
    job.stage = "完成";
    job.output = res.output;
    job.duration = res.total;
    setProgress(100);
    log("全部完成 ✅");
  } catch (e) {
    job.status = "error";
    job.stage = "失败";
    job.error = String(e.message || e).slice(0, 600);
    log("失败：" + job.error);
  } finally {
    job.emitter.emit("done", job.status);
    if (job.videoPath && fs.existsSync(job.videoPath)) { try { fs.unlinkSync(job.videoPath); } catch {} }
  }
}

export function publicJob(job) {
  return {
    id: job.id, status: job.status, stage: job.stage, progress: job.progress,
    log: job.log.slice(-60), error: job.error, duration: job.duration || null,
    hasVideo: !!job.output, mode: job.mode
  };
}
