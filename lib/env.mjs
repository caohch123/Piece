// 运行环境：合并系统 PATH 与 HYPERFRAMES_* 定位变量（子进程用）
import { execSync } from "node:child_process";
import path from "node:path";

let cached = null;

export function buildEnv() {
  if (cached) return cached;
  const env = { ...process.env };
  const user = () => {
    try {
      return execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'PATH\',\'Machine\') + \';\' + [Environment]::GetEnvironmentVariable(\'PATH\',\'User\')"', { encoding: "utf8" }).trim();
    } catch { return ""; }
  };
  const extra = user();
  if (extra) env.Path = extra + ";" + (env.Path || "");
  const gv = (name) => {
    if (env[name]) return env[name];
    try {
      return execSync(`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('${name}','User')"`, { encoding: "utf8" }).trim();
    } catch { return ""; }
  };
  const browser = gv("HYPERFRAMES_BROWSER_PATH");
  const whisper = gv("HYPERFRAMES_WHISPER_PATH");
  if (browser) env.HYPERFRAMES_BROWSER_PATH = browser;
  if (whisper) env.HYPERFRAMES_WHISPER_PATH = whisper;
  cached = env;
  return env;
}

export function whisperModelPath() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const dir = path.join(home, ".cache", "hyperframes", "whisper", "models");
  return dir;
}
