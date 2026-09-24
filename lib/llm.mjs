// 会话级模型配置与 OpenAI 兼容 Chat Completions 适配器。
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const PRESETS = {
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-flash" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  qwen: { label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  custom: { label: "自定义 / 本地模型", baseUrl: "", model: "" }
};

function validBaseUrl(raw) {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 500) throw new Error("API Base URL 长度必须为 1–500 字");
  let url;
  try { url = new URL(raw.trim()); }
  catch { throw new Error("API Base URL 不是有效网址"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error("API Base URL 必须使用 HTTPS；本机模型可使用 HTTP localhost");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("API Base URL 不能含账号、查询参数或片段");
  if (url.pathname.includes("..") || /%2f|%5c/i.test(url.pathname)) throw new Error("API Base URL 路径无效");
  return url.href.replace(/\/+$/, "");
}

export function completionUrl(baseUrl) {
  return baseUrl.endsWith("/chat/completions") ? baseUrl : baseUrl + "/chat/completions";
}

function encrypt(key, secret, owner) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(Buffer.from(owner));
  const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}

function decrypt(value, secret, owner) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAAD(Buffer.from(owner));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export class LlmSettings {
  constructor(workspace, secret) {
    this.file = path.join(workspace, ".llm-settings.json");
    this.secret = secret;
    this.sessions = {};
    this.warning = null;
    this.writeBlocked = false;
    if (fs.existsSync(this.file)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("配置格式错误");
        this.sessions = parsed;
      } catch {
        const backup = this.file + `.corrupt-${Date.now()}-${randomBytes(3).toString("hex")}`;
        try {
          fs.copyFileSync(this.file, backup, fs.constants.COPYFILE_EXCL);
          this.warning = `模型配置文件损坏，原文件已备份为 ${path.basename(backup)}；请重新配置。`;
        } catch {
          this.warning = "模型配置文件损坏且无法备份；请检查本机 workspace 目录。";
          this.writeBlocked = true;
        }
      }
    }
  }

  current(owner) {
    const saved = this.sessions[owner];
    if (saved) {
      if (saved.provider === "none") return null;
      let apiKey = "";
      if (saved.encryptedKey) {
        try { apiKey = decrypt(saved.encryptedKey, this.secret, owner); }
        catch { this.warning = "已保存的模型密钥无法解密；请重新填写 API Key。"; }
      }
      return {
        provider: saved.provider, baseUrl: saved.baseUrl, model: saved.model,
        apiKey
      };
    }
    const apiKey = process.env.DEEPSEEK_API_KEY || "";
    return apiKey ? { provider: "deepseek", ...PRESETS.deepseek, apiKey } : null;
  }

  public(owner) {
    const config = this.current(owner);
    return {
      provider: config?.provider || "none", baseUrl: config?.baseUrl || "",
      model: config?.model || "", hasApiKey: !!config?.apiKey,
      source: this.sessions[owner] ? "saved" : config ? "environment" : "none",
      presets: PRESETS, warning: this.warning
    };
  }

  save(owner, input) {
    if (this.writeBlocked) {
      const error = new Error("配置文件无法备份，拒绝覆盖原文件");
      error.code = "ESETTINGSBACKUP";
      throw error;
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("配置格式错误");
    const provider = input.provider;
    if (provider !== "none" && !Object.hasOwn(PRESETS, provider)) throw new Error("不支持的 API 服务");
    let saved;
    if (provider === "none") saved = { provider: "none" };
    else {
      const baseUrl = validBaseUrl(input.baseUrl || PRESETS[provider].baseUrl);
      const model = typeof input.model === "string" ? input.model.trim() : "";
      if (!model || model.length > 120 || /[\r\n\x00-\x1f]/.test(model)) throw new Error("模型 ID 长度必须为 1–120 字且不能含控制字符");
      if (input.apiKey != null && typeof input.apiKey !== "string") throw new Error("API Key 格式错误");
      const typedKey = (input.apiKey || "").trim();
      if (typedKey.length > 1000 || /[\r\n\x00-\x1f]/.test(typedKey)) throw new Error("API Key 格式错误或过长");
      const old = this.current(owner);
      const sameEndpoint = old?.provider === provider && old.baseUrl === baseUrl;
      const apiKey = typedKey || (!input.clearApiKey && sameEndpoint ? old.apiKey : "");
      if (!apiKey && provider !== "custom") throw new Error("该 API 服务需要填写 API Key");
      saved = { provider, baseUrl, model, encryptedKey: apiKey ? encrypt(apiKey, this.secret, owner) : "" };
    }
    const next = { ...this.sessions, [owner]: saved };
    const temp = this.file + ".tmp";
    try {
      fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
      fs.renameSync(temp, this.file);
    } catch (error) {
      try { fs.unlinkSync(temp); } catch {}
      throw error;
    }
    this.sessions = next;
    this.warning = null;
    return this.public(owner);
  }
}

export async function chatCompletion(config, messages) {
  if (!config) throw new Error("尚未配置模型 API");
  let response;
  try {
    response = await fetch(completionUrl(config.baseUrl), {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(60000),
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({ model: config.model, messages, stream: false })
    });
  } catch (error) {
    throw new Error(error.name === "TimeoutError" ? "模型 API 请求超时" : "无法连接模型 API");
  }
  if (!response.ok) throw new Error(`模型 API 返回 HTTP ${response.status}`);
  let data;
  try { data = await response.json(); }
  catch { throw new Error("模型 API 响应不是有效 JSON"); }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("模型 API 未返回文本内容");
  return content.trim();
}
