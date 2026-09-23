// 零依赖 HTTP 服务：静态页 + 上传/提示词建任务 + SSE 进度 + 成片下载
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jobs, createJob, publicJob } from "./lib/jobs.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(APP_DIR, "public");
const TMP = path.join(APP_DIR, "workspace", "uploads");
const PORT = Number(process.env.PORT || 5173);

fs.mkdirSync(TMP, { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function serveFile(req, res, file, mime) {
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range && /bytes=/.test(range)) {
    const [s, e] = range.replace("bytes=", "").split("-");
    const start = parseInt(s, 10) || 0;
    const end = e ? parseInt(e, 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Type": mime, "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": mime, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
    fs.createReadStream(file).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;

  // 静态
  if (req.method === "GET" && !p.startsWith("/api/")) {
    const file = p === "/" ? path.join(PUBLIC, "index.html") : path.join(PUBLIC, p.replace(/^\/+/, ""));
    if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return serveFile(req, res, file, MIME[path.extname(file)] || "application/octet-stream");
    }
    res.writeHead(404); return res.end("not found");
  }

  // 新建任务（提示词模式）
  if (req.method === "POST" && p === "/api/jobs") {
    let body = "";
    req.on("data", (d) => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        if (data.mode === "prompt") {
          if (!data.prompt || !data.prompt.trim()) return sendJson(res, 400, { error: "提示词为空" });
          const job = createJob({ mode: "prompt", prompt: data.prompt.trim().slice(0, 2000) });
          return sendJson(res, 200, { id: job.id });
        }
        if (data.mode === "video") {
          if (!data.uploadId) return sendJson(res, 400, { error: "缺少 uploadId" });
          const src = path.join(TMP, data.uploadId);
          if (!fs.existsSync(src)) return sendJson(res, 400, { error: "上传文件不存在" });
          const job = createJob({ mode: "video", videoPath: src, videoName: data.name || "input.mp4" });
          return sendJson(res, 200, { id: job.id });
        }
        sendJson(res, 400, { error: "mode 必须是 video 或 prompt" });
      } catch (e) {
        sendJson(res, 500, { error: String(e.message || e) });
      }
    });
    return;
  }

  // 上传（原始字节流）
  if (req.method === "PUT" && p === "/api/upload") {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const file = path.join(TMP, id);
    const ws = fs.createWriteStream(file);
    let size = 0;
    req.on("data", (d) => { size += d.length; if (size > 800 * 1024 * 1024) req.destroy(); });
    req.pipe(ws);
    ws.on("finish", () => sendJson(res, 200, { uploadId: id, size }));
    ws.on("error", (e) => sendJson(res, 500, { error: String(e.message) }));
    return;
  }

  const mJob = p.match(/^\/api\/jobs\/([a-z0-9]+)(\/stream|\/video|\/json)?$/);
  if (mJob) {
    const job = jobs.get(mJob[1]);
    if (!job) return sendJson(res, 404, { error: "任务不存在" });
    const sub = mJob[2] || "";

    if (sub === "/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const push = () => res.write(`data: ${JSON.stringify(publicJob(job))}\n\n`);
      push();
      const onLog = () => { push(); };
      job.emitter.on("log", onLog);
      const onProgress = () => { push(); };
      job.emitter.on("progress", onProgress);
      const onDone = () => { push(); setTimeout(() => res.end(), 50); };
      job.emitter.on("done", onDone);
      const keep = setInterval(() => res.write(": ping\n\n"), 15000);
      req.on("close", () => { clearInterval(keep); job.emitter.off("log", onLog); job.emitter.off("progress", onProgress); job.emitter.off("done", onDone); });
      return;
    }
    if (sub === "/video") {
      if (!job.output || !fs.existsSync(job.output)) { res.writeHead(404); return res.end("not ready"); }
      return serveFile(req, res, job.output, "video/mp4");
    }
    return sendJson(res, 200, publicJob(job));
  }

  res.writeHead(404); res.end("not found");
});

server.listen(PORT, () => {
  console.log(`\n  剪辑 Agent 已启动：http://localhost:${PORT}\n`);
});
