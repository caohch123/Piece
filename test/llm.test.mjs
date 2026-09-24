import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { LlmSettings } from "../lib/llm.mjs";

const APP = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startApp(port, workspace) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: APP,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", CLIP_AGENT_WORKSPACE: workspace, DEEPSEEK_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(stderr || "服务未启动");
    try { if ((await fetch(base)).ok) return { child, base }; }
    catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error("服务启动超时：" + stderr);
}

async function stopApp(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await once(child, "exit");
}

async function awaitReview(base, id, headers) {
  for (let i = 0; i < 100; i++) {
    const job = await (await fetch(`${base}/api/jobs/${id}/json`, { headers })).json();
    if (job.status === "review") return job;
    if (job.status === "error") throw new Error(job.error);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("任务准备超时");
}

test("模型服务配置、切换、调用、密钥隔离与重启恢复", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "clip-agent-llm-test-"));
  const appPort = await freePort();
  const requests = [];
  const provider = http.createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    const data = JSON.parse(body);
    requests.push({ path: req.url, authorization: req.headers.authorization, ...data });
    if (data.model === "model-fail") {
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "temporary" }));
    }
    const system = data.messages?.find((message) => message.role === "system")?.content || "";
    let content = "OK";
    if (system.includes("短视频编剧")) content = "第一句说明问题。第二句展示流程。第三句总结重点。";
    if (system.includes("分镜导演")) content = JSON.stringify({ scenes: [
      { ids: [0], type: "hero", title: "开场", big: "说明问题" },
      { ids: [1], type: "keypoints", title: "流程", items: ["展示流程"] },
      { ids: [2], type: "outro", title: "总结", ok: "记住重点", no: "不是误解", tags: ["重点"] }
    ] });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerPort = provider.address().port;
  let running;
  try {
    running = await startApp(appPort, workspace);
    const initial = await fetch(running.base);
    const cookie = initial.headers.get("set-cookie")?.split(";")[0];
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const otherCookie = (await fetch(running.base)).headers.get("set-cookie")?.split(";")[0];
    const endpoint = `http://127.0.0.1:${providerPort}/v1`;

    const empty = await (await fetch(running.base + "/api/settings/llm", { headers })).json();
    assert.equal(empty.provider, "none");
    const savedResponse = await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers,
      body: JSON.stringify({ provider: "custom", baseUrl: endpoint, model: "model-alpha", apiKey: "secret-token-unique" })
    });
    assert.equal(savedResponse.status, 200);
    const saved = await savedResponse.json();
    assert.equal(saved.model, "model-alpha");
    assert.equal(saved.hasApiKey, true);
    assert.equal(JSON.stringify(saved).includes("secret-token-unique"), false);
    assert.equal((await (await fetch(running.base + "/api/settings/llm", { headers: { Cookie: otherCookie } })).json()).provider, "none");
    assert.equal(fs.readFileSync(path.join(workspace, ".llm-settings.json"), "utf8").includes("secret-token-unique"), false);
    assert.equal((await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers: { ...headers, Origin: "https://evil.example" }, body: JSON.stringify({ provider: "none" })
    })).status, 403);
    const rebindingStatus = await new Promise((resolve, reject) => {
      http.get(running.base + "/api/settings/llm", { headers: { Host: "evil.example" } }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      }).on("error", reject);
    });
    assert.equal(rebindingStatus, 403);
    assert.equal((await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers,
      body: JSON.stringify({ provider: "custom", baseUrl: "http://example.com/v1", model: "unsafe" })
    })).status, 400);

    const tested = await (await fetch(running.base + "/api/settings/llm/test", { method: "POST", headers })).json();
    assert.equal(tested.ok, true);
    assert.equal(tested.reply, "OK");
    const created = await (await fetch(running.base + "/api/jobs", {
      method: "POST", headers, body: JSON.stringify({ mode: "prompt", prompt: "解释一个技术概念" })
    })).json();
    const job = await awaitReview(running.base, created.id, headers);
    assert.equal(job.llmModel, "model-alpha");
    assert.equal(fs.readFileSync(path.join(workspace, created.id, "job.json"), "utf8").includes("secret-token-unique"), false);
    assert.ok(requests.some((request) => request.model === "model-alpha" && request.messages?.[0]?.role === "system"));
    assert.ok(requests.every((request) => request.path === "/v1/chat/completions" && request.authorization === "Bearer secret-token-unique"));

    const changed = await (await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers,
      body: JSON.stringify({ provider: "custom", baseUrl: endpoint, model: "model-beta", apiKey: "" })
    })).json();
    assert.equal(changed.hasApiKey, true);
    const second = await (await fetch(running.base + "/api/jobs", {
      method: "POST", headers, body: JSON.stringify({ mode: "prompt", prompt: "再解释一次概念" })
    })).json();
    assert.equal((await awaitReview(running.base, second.id, headers)).llmModel, "model-beta");
    assert.ok(requests.some((request) => request.model === "model-beta"));
    assert.equal((await (await fetch(`${running.base}/api/jobs/${created.id}/json`, { headers })).json()).llmModel, "model-alpha");

    await stopApp(running.child);
    running = await startApp(appPort, workspace);
    const restored = await (await fetch(running.base + "/api/settings/llm", { headers })).json();
    assert.equal(restored.model, "model-beta");
    assert.equal(restored.hasApiKey, true);
    assert.equal((await (await fetch(running.base + "/api/settings/llm/test", { method: "POST", headers })).json()).ok, true);

    assert.equal((await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers, body: JSON.stringify({ provider: "openai", model: "gpt-4.1-mini", apiKey: "" })
    })).status, 400);
    assert.equal((await (await fetch(running.base + "/api/settings/llm", { headers })).json()).model, "model-beta");

    await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers,
      body: JSON.stringify({ provider: "custom", baseUrl: endpoint, model: "model-fail", apiKey: "" })
    });
    const fallback = await (await fetch(running.base + "/api/jobs", {
      method: "POST", headers,
      body: JSON.stringify({ mode: "prompt", prompt: "第一句解释问题。第二句展示流程。第三句总结重点。" })
    })).json();
    const fallbackJob = await awaitReview(running.base, fallback.id, headers);
    assert.ok(fallbackJob.log.some((line) => line.includes("模型 API 返回 HTTP 503")));
    assert.ok(fallbackJob.log.some((line) => line.includes("启发式分镜")));

    const localNoKey = await (await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers,
      body: JSON.stringify({ provider: "custom", baseUrl: `http://127.0.0.1:${providerPort}/v2`, model: "model-local", apiKey: "" })
    })).json();
    assert.equal(localNoKey.hasApiKey, false);
    assert.equal((await (await fetch(running.base + "/api/settings/llm/test", { method: "POST", headers })).json()).ok, true);
    assert.equal(requests.at(-1).path, "/v2/chat/completions");
    assert.equal(requests.at(-1).authorization, undefined);

    const disabled = await (await fetch(running.base + "/api/settings/llm", {
      method: "PUT", headers, body: JSON.stringify({ provider: "none" })
    })).json();
    assert.equal(disabled.provider, "none");
    assert.equal(disabled.hasApiKey, false);
    assert.equal((await fetch(running.base + "/api/settings/llm/test", { method: "POST", headers })).status, 400);
  } finally {
    if (running) await stopApp(running.child);
    await new Promise((resolve) => provider.close(resolve));
    const resolved = path.resolve(workspace);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("clip-agent-llm-test-")) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
});

test("模型配置写盘失败不改变内存配置，损坏文件可恢复", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "clip-agent-llm-test-"));
  const owner = "a".repeat(32);
  const secret = randomBytes(32);
  try {
    const settings = new LlmSettings(workspace, secret);
    settings.save(owner, { provider: "custom", baseUrl: "http://127.0.0.1:9999/v1", model: "first", apiKey: "private-key" });
    const temp = path.join(workspace, ".llm-settings.json.tmp");
    fs.mkdirSync(temp);
    assert.throws(() => settings.save(owner, { provider: "custom", baseUrl: "http://127.0.0.1:9999/v1", model: "second", apiKey: "" }));
    assert.equal(settings.public(owner).model, "first");
    fs.rmdirSync(temp);

    const wrongSecret = new LlmSettings(workspace, randomBytes(32));
    assert.equal(wrongSecret.public(owner).hasApiKey, false);
    assert.match(wrongSecret.public(owner).warning, /无法解密/);
    fs.writeFileSync(path.join(workspace, ".llm-settings.json"), "{broken");
    const damaged = new LlmSettings(workspace, secret);
    assert.match(damaged.public(owner).warning, /文件损坏/);
    assert.ok(fs.readdirSync(workspace).some((name) => name.startsWith(".llm-settings.json.corrupt-")));
    damaged.save(owner, { provider: "none" });
    assert.equal(damaged.public(owner).provider, "none");
  } finally {
    const resolved = path.resolve(workspace);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("clip-agent-llm-test-")) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
});
