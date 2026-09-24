// 本地单机任务队列：浏览器会话隔离、磁盘持久化、转写后人工确认。
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepare, finish } from "./pipeline.mjs";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKSPACE = process.env.CLIP_AGENT_WORKSPACE
  ? path.resolve(process.env.CLIP_AGENT_WORKSPACE)
  : path.join(APP_DIR, "workspace");
const ID = /^[a-f0-9]{32}$/;
export const jobs = new Map();

function save(job) {
  fs.mkdirSync(job.workDir, { recursive: true });
  const file = path.join(job.workDir, "job.json");
  const temp = file + ".tmp";
  const { emitter, workDir, output, videoPath, ...data } = job;
  fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(temp, file);
}

function signal(job) {
  save(job);
  job.emitter.emit("change");
}

function loadJobs() {
  fs.mkdirSync(WORKSPACE, { recursive: true });
  for (const id of fs.readdirSync(WORKSPACE)) {
    if (!ID.test(id)) continue;
    const workDir = path.join(WORKSPACE, id);
    const file = path.join(workDir, "job.json");
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data.id !== id || typeof data.owner !== "string") continue;
      const job = { ...data, workDir, videoPath: null, output: null, emitter: new EventEmitter() };
      if (job.status === "done") {
        const output = path.join(workDir, "final.mp4");
        if (fs.existsSync(output)) job.output = output;
        else { job.status = "error"; job.stage = "失败"; job.error = "成片文件已丢失"; }
      } else if (job.status !== "review" && job.status !== "error") {
        job.status = "error";
        job.stage = "已中断";
        job.error = "服务重启时任务仍在处理，请重新创建任务";
      }
      jobs.set(id, job);
      save(job);
    } catch { /* 忽略旧格式或损坏的任务元数据 */ }
  }
}
loadJobs();

// 渲染吃满 CPU；准备和渲染都串行，避免单机资源争用。
let tail = Promise.resolve();
function enqueue(fn) { tail = tail.then(fn, fn); }

function logger(job) {
  return (line) => {
    for (const item of String(line).split(/\r?\n/)) {
      if (!item.trim()) continue;
      job.log.push(item);
      if (job.log.length > 400) job.log.shift();
      signal(job);
    }
  };
}

function progress(job) {
  return (p) => {
    job.progress = Math.max(job.progress, Math.min(100, p));
    signal(job);
  };
}

export function createJob(input) {
  const id = randomBytes(16).toString("hex");
  const job = {
    id, owner: input.owner, mode: input.mode,
    name: input.name || (input.mode === "prompt" ? "字幕动画" : "口播视频"),
    prompt: input.mode === "prompt" ? input.prompt : null,
    videoPath: input.videoPath || null,
    videoName: input.videoName || null,
    workDir: path.join(WORKSPACE, id),
    status: "queued", stage: "排队中", progress: 0, log: [],
    draft: null, output: null, error: null, duration: null,
    emitter: new EventEmitter(), createdAt: Date.now()
  };
  jobs.set(id, job);
  save(job);
  enqueue(() => runPrepare(job));
  return job;
}

async function runPrepare(job) {
  const log = logger(job);
  try {
    job.status = "preparing";
    job.stage = job.mode === "video" ? "转写" : "写稿";
    progress(job)(5);
    job.draft = await prepare(job, log, progress(job));
    job.status = "review";
    job.stage = "待确认";
    progress(job)(50);
    log("转写和分镜已完成，请确认文案后开始渲染");
  } catch (e) {
    job.status = "error";
    job.stage = "失败";
    job.error = String(e.message || e).slice(0, 600);
    log("失败：" + job.error);
  } finally {
    if (job.videoPath && fs.existsSync(job.videoPath)) {
      try { fs.unlinkSync(job.videoPath); } catch {}
    }
    job.videoPath = null;
    signal(job);
  }
}

export function approveJob(job, changes) {
  if (job.status !== "review" || !job.draft) throw new Error("任务当前不可确认");
  const scenes = job.draft.plan.scenes;
  const caps = job.draft.caps;
  if (!Array.isArray(changes.scenes) || changes.scenes.length !== scenes.length ||
      !Array.isArray(changes.captions) || changes.captions.length !== caps.length) {
    throw new Error("分镜或字幕数量不匹配");
  }
  const clean = (value, max) => {
    if (typeof value !== "string") throw new Error("文案格式错误");
    const result = value.trim();
    if (!result || result.length > max) throw new Error(`文案必须为 1–${max} 字`);
    return result;
  };
  const titles = changes.scenes.map((item) => clean(item.title, 40));
  const texts = changes.captions.map((item) => clean(item.text, 100));
  scenes.forEach((scene, i) => { scene.title = titles[i]; });
  caps.forEach((cap, i) => {
    if (cap.text !== texts[i]) { cap.text = texts[i]; cap.words = []; }
  });
  job.status = "queued";
  job.stage = "等待渲染";
  job.progress = 50;
  signal(job);
  enqueue(() => runRender(job));
}

async function runRender(job) {
  const log = logger(job);
  try {
    job.status = "running";
    job.stage = "生成工程";
    signal(job);
    if (!job.draft?.plan?.scenes?.length || !job.draft?.caps?.length) throw new Error("分镜或字幕为空，无法渲染");
    const result = await finish(job, job.draft, log, progress(job));
    job.output = result.output;
    job.duration = result.total;
    job.status = "done";
    job.stage = "完成";
    progress(job)(100);
    log("全部完成 ✅");
  } catch (e) {
    job.status = "error";
    job.stage = "失败";
    job.error = String(e.message || e).slice(0, 600);
    log("失败：" + job.error);
  } finally {
    signal(job);
  }
}

export function getJob(id, owner) {
  const job = jobs.get(id);
  return job && job.owner === owner ? job : null;
}

export function listJobs(owner) {
  return [...jobs.values()].filter((job) => job.owner === owner)
    .sort((a, b) => b.createdAt - a.createdAt).map(publicJob);
}

export function publicJob(job) {
  return {
    id: job.id, status: job.status, stage: job.stage, progress: job.progress,
    log: job.log.slice(-60), error: job.error, duration: job.duration || null,
    hasVideo: !!job.output, hasDraft: !!job.draft, mode: job.mode,
    name: job.name, createdAt: job.createdAt
  };
}

export function publicDraft(job) {
  if (!job.draft) return null;
  return {
    scenes: job.draft.plan.scenes.map((s) => ({ type: s.type, title: s.title || "", start: s.start, dur: s.dur })),
    captions: job.draft.caps.map((c) => ({ text: c.text, start: c.start, dur: c.dur }))
  };
}
