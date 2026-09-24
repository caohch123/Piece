import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const APP = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function start(port, workspace) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: APP,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", CLIP_AGENT_WORKSPACE: workspace, DEEPSEEK_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stderr.on("data", (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("服务未启动：" + output);
    try { const response = await fetch(base); if (response.ok) return { child, base, response }; }
    catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error("服务启动超时：" + output);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await once(child, "exit");
}

test("任务确认、会话隔离与重启恢复", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "clip-agent-test-"));
  const port = await freePort();
  let running;
  try {
    fs.mkdirSync(path.join(workspace, "uploads"));
    const stale = path.join(workspace, "uploads", "a".repeat(32));
    fs.writeFileSync(stale, "abandoned upload");
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(stale, old, old);
    running = await start(port, workspace);
    assert.equal(fs.existsSync(stale), false);
    const cookie = running.response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie?.startsWith("clip_session="));
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const created = await fetch(running.base + "/api/jobs", {
      method: "POST", headers,
      body: JSON.stringify({ mode: "prompt", prompt: "神经网络接收数据。隐藏层逐步计算。输出层给出结果。" })
    });
    assert.equal(created.status, 200);
    const { id } = await created.json();
    assert.match(id, /^[a-f0-9]{32}$/);
    let status;
    for (let i = 0; i < 100; i++) {
      const response = await fetch(`${running.base}/api/jobs/${id}/json`, { headers });
      status = await response.json();
      if (status.status === "review" || status.status === "error") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(status.status, "review", status.error);
    assert.equal(fs.existsSync(path.join(workspace, id, "final.mp4")), false);
    const draft = await (await fetch(`${running.base}/api/jobs/${id}/draft`, { headers })).json();
    assert.ok(draft.draft.scenes.length >= 2);
    assert.equal(draft.draft.captions.length, 3);

    assert.equal((await fetch(`${running.base}/api/jobs/${id}/json`)).status, 404);
    assert.equal((await fetch(`${running.base}/api/jobs`, {
      method: "POST", headers,
      body: JSON.stringify({ mode: "video", uploadId: "../../server.mjs" })
    })).status, 400);
    assert.equal((await fetch(`${running.base}/api/jobs`, {
      method: "POST", headers: { ...headers, Origin: "https://evil.example" },
      body: JSON.stringify({ mode: "prompt", prompt: "测试" })
    })).status, 403);
    assert.equal((await fetch(`${running.base}/api/upload`, {
      method: "PUT", headers: { Cookie: cookie, "X-File-Name": encodeURIComponent("broken.mp4") },
      body: Buffer.from("this is not a video")
    })).status, 400);
    assert.deepEqual(fs.readdirSync(path.join(workspace, "uploads")), []);
    assert.equal((await fetch(`${running.base}/api/jobs/${id}/approve`, {
      method: "POST", headers, body: JSON.stringify({ scenes: [], captions: [] })
    })).status, 400);

    await stop(running.child);
    running = await start(port, workspace);
    const restored = await (await fetch(running.base + "/api/jobs", { headers })).json();
    assert.equal(restored.jobs[0].id, id);
    assert.equal(restored.jobs[0].status, "review");
  } finally {
    if (running) await stop(running.child);
    if (workspace.startsWith(os.tmpdir() + path.sep) && path.basename(workspace).startsWith("clip-agent-test-")) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
});
