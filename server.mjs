// 本地 HTTP 服务：安全上传、会话内任务、确认分镜、SSE 与成片下载。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJob, getJob, listJobs, publicJob, publicDraft, approveJob } from "./lib/jobs.mjs";
import { run } from "./lib/transcribe.mjs";
import { LlmSettings, chatCompletion } from "./lib/llm.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(APP_DIR, "public");
const WORKSPACE = process.env.CLIP_AGENT_WORKSPACE
  ? path.resolve(process.env.CLIP_AGENT_WORKSPACE)
  : path.join(APP_DIR, "workspace");
const TMP = path.join(WORKSPACE, "uploads");
const SECRET_FILE = path.join(WORKSPACE, ".session-secret");
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_UPLOAD = 800 * 1024 * 1024;
const MAX_DURATION = 180;
const UPLOAD_ID = /^[a-f0-9]{32}$/;
const JOB_ID = /^[a-f0-9]{32}$/;
const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const uploads = new Map();

fs.mkdirSync(TMP, { recursive: true });
function purgeStaleUploads() {
  const cutoff = Date.now() - UPLOAD_TTL_MS;
  for (const id of fs.readdirSync(TMP)) {
    if (!UPLOAD_ID.test(id)) continue;
    const file = path.join(TMP, id);
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.mtimeMs >= cutoff) continue;
      fs.unlinkSync(file);
      uploads.delete(id);
    } catch { /* 文件可能正被其他操作处理，下次再检查 */ }
  }
}
purgeStaleUploads();
setInterval(purgeStaleUploads, 60 * 60 * 1000).unref();
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, randomBytes(32), { mode: 0o600, flag: "wx" });
const secret = fs.readFileSync(SECRET_FILE);
const llmSettings = new LlmSettings(WORKSPACE, secret);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function sign(id) { return createHmac("sha256", secret).update(id).digest("hex"); }

function session(req, res) {
  const raw = (req.headers.cookie || "").split(";").map((x) => x.trim()).find((x) => x.startsWith("clip_session="));
  const value = raw?.slice("clip_session=".length) || "";
  const [id, mac] = value.split(".");
  if (/^[a-f0-9]{32}$/.test(id || "") && /^[a-f0-9]{64}$/.test(mac || "")) {
    const expected = sign(id);
    if (timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))) return id;
  }
  const next = randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie", `clip_session=${next}.${sign(next)}; HttpOnly; SameSite=Strict; Path=/`);
  return next;
}

function checkOrigin(req) {
  if (!req.headers.origin) return;
  const host = req.headers.host;
  if (req.headers.origin !== `http://${host}` && req.headers.origin !== `https://${host}`) {
    throw new HttpError(403, "跨站请求已拒绝");
  }
}

function inside(root, file) {
  const rel = path.relative(root, file);
  return rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
}

function serveFile(req, res, file, mime) {
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) throw new HttpError(416, "无效的视频范围");
    let start, end;
    if (!match[1]) {
      const suffix = Number(match[2]);
      start = Math.max(0, stat.size - suffix);
      end = stat.size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : stat.size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      "Content-Type": mime, "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1
    });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": mime, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
  fs.createReadStream(file).pipe(res);
}

function readJson(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      body += chunk;
      if (body.length > limit) { settled = true; body = ""; reject(new HttpError(413, "请求内容过大")); }
    });
    req.on("end", () => {
      if (settled) return;
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new HttpError(400, "JSON 格式错误")); }
    });
    req.on("error", reject);
  });
}

async function inspectVideo(file) {
  let info;
  try {
    const { out } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_type,width,height", "-of", "json", file]);
    info = JSON.parse(out);
  } catch { throw new HttpError(400, "无法读取视频，请确认文件格式和编码"); }
  const duration = Number(info.format?.duration);
  const video = info.streams?.find((s) => s.codec_type === "video");
  const audio = info.streams?.find((s) => s.codec_type === "audio");
  if (!video || !audio || !Number.isFinite(duration) || duration < 1 || duration > MAX_DURATION) {
    throw new HttpError(400, `请上传含音轨、时长 1–${MAX_DURATION} 秒的视频`);
  }
  if (!video.width || !video.height || video.width > 3840 || video.height > 3840) {
    throw new HttpError(400, "视频尺寸不受支持，最长边不得超过 3840 像素");
  }
}

async function upload(req, res, owner) {
  let name;
  try { name = decodeURIComponent(String(req.headers["x-file-name"] || "")); }
  catch { throw new HttpError(400, "文件名编码错误"); }
  const ext = path.extname(name).toLowerCase();
  if (!name || ![".mp4", ".mov", ".mkv"].includes(ext)) throw new HttpError(400, "仅支持 mp4、mov、mkv 视频");
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_UPLOAD) throw new HttpError(413, "视频不能超过 800 MB");
  const id = randomBytes(16).toString("hex");
  const file = path.join(TMP, id);
  let size = 0;
  try {
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(file, { flags: "wx" });
      let settled = false;
      const fail = (error) => { if (settled) return; settled = true; req.unpipe(ws); ws.destroy(); req.resume(); reject(error); };
      req.on("data", (chunk) => { size += chunk.length; if (size > MAX_UPLOAD) fail(new HttpError(413, "视频不能超过 800 MB")); });
      req.on("aborted", () => fail(new HttpError(400, "上传已中断")));
      req.on("error", fail);
      ws.on("error", fail);
      ws.on("finish", () => { if (!settled) { settled = true; resolve(); } });
      req.pipe(ws);
    });
    if (!size) throw new HttpError(400, "文件为空");
    await inspectVideo(file);
    uploads.set(id, { file, owner, name: path.basename(name).slice(0, 120), ext, createdAt: Date.now() });
    sendJson(res, 200, { uploadId: id, size });
  } catch (error) {
    try { fs.unlinkSync(file); } catch {}
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (["127.0.0.1", "localhost", "::1"].includes(HOST) &&
        !/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(req.headers.host || "")) {
      throw new HttpError(403, "仅允许通过本机地址访问");
    }
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    const owner = session(req, res);
    if (req.method === "GET" && !p.startsWith("/api/")) {
      let decoded;
      try { decoded = decodeURIComponent(p); } catch { throw new HttpError(400, "路径编码错误"); }
      const file = decoded === "/" ? path.join(PUBLIC, "index.html") : path.resolve(PUBLIC, "." + decoded);
      if ((file === path.join(PUBLIC, "index.html") || inside(PUBLIC, file)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return serveFile(req, res, file, MIME[path.extname(file)] || "application/octet-stream");
      }
      throw new HttpError(404, "页面不存在");
    }
    if (req.method === "PUT" || req.method === "POST") checkOrigin(req);

    if (p === "/api/settings/llm" && req.method === "GET") return sendJson(res, 200, llmSettings.public(owner));
    if (p === "/api/settings/llm" && req.method === "PUT") {
      try { return sendJson(res, 200, llmSettings.save(owner, await readJson(req, 4096))); }
      catch (error) { if (error.code) throw error; throw new HttpError(400, error.message); }
    }
    if (p === "/api/settings/llm/test" && req.method === "POST") {
      const config = llmSettings.current(owner);
      if (!config) throw new HttpError(400, "请先保存模型 API 配置");
      try {
        const reply = await chatCompletion(config, [{ role: "user", content: "请只回复 OK" }]);
        return sendJson(res, 200, { ok: true, model: config.model, reply: reply.slice(0, 100) });
      } catch (error) { throw new HttpError(502, error.message); }
    }

    if (req.method === "PUT" && p === "/api/upload") return await upload(req, res, owner);

    if (p === "/api/jobs" && req.method === "GET") return sendJson(res, 200, { jobs: listJobs(owner) });
    if (p === "/api/jobs" && req.method === "POST") {
      const data = await readJson(req);
      if (data.mode === "prompt") {
        const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
        if (!prompt || prompt.length > 2000) throw new HttpError(400, "提示词长度必须为 1–2000 字");
        const job = createJob({ owner, mode: "prompt", prompt, llm: llmSettings.current(owner) });
        return sendJson(res, 200, { id: job.id });
      }
      if (data.mode === "video") {
        if (!UPLOAD_ID.test(data.uploadId || "")) throw new HttpError(400, "无效的 uploadId");
        const item = uploads.get(data.uploadId);
        if (!item || item.owner !== owner || !fs.existsSync(item.file)) throw new HttpError(404, "上传文件不存在");
        uploads.delete(data.uploadId);
        const job = createJob({ owner, mode: "video", videoPath: item.file, videoName: "input" + item.ext, name: item.name, llm: llmSettings.current(owner) });
        return sendJson(res, 200, { id: job.id });
      }
      throw new HttpError(400, "mode 必须是 video 或 prompt");
    }

    const match = /^\/api\/jobs\/([a-f0-9]{32})(?:\/(stream|video|draft|approve|json))?$/.exec(p);
    if (match && JOB_ID.test(match[1])) {
      const job = getJob(match[1], owner);
      if (!job) throw new HttpError(404, "任务不存在");
      const sub = match[2] || "json";
      if (req.method === "GET" && sub === "draft") return sendJson(res, 200, { draft: publicDraft(job) });
      if (req.method === "POST" && sub === "approve") {
        try { approveJob(job, await readJson(req)); }
        catch (e) { throw new HttpError(400, e.message); }
        return sendJson(res, 200, publicJob(job));
      }
      if (req.method === "GET" && sub === "video") {
        if (!job.output || !fs.existsSync(job.output)) throw new HttpError(404, "成片尚未生成");
        return serveFile(req, res, job.output, "video/mp4");
      }
      if (req.method === "GET" && sub === "stream") {
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
        const push = () => res.write(`data: ${JSON.stringify(publicJob(job))}\n\n`);
        push();
        const onChange = () => {
          push();
          if (["review", "done", "error"].includes(job.status)) res.end();
        };
        job.emitter.on("change", onChange);
        const keep = setInterval(() => res.write(": ping\n\n"), 15000);
        req.on("close", () => { clearInterval(keep); job.emitter.off("change", onChange); });
        return;
      }
      if (req.method === "GET" && sub === "json") return sendJson(res, 200, publicJob(job));
    }
    throw new HttpError(404, "接口不存在");
  } catch (error) {
    if (!res.headersSent) sendJson(res, error.status || 500, { error: error.status ? error.message : "服务内部错误" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`剪辑 Agent 已启动：http://${HOST}:${PORT}`);
});
