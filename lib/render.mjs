// 校验 + 渲染：调用 hyperframes CLI，解析进度
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildEnv } from "./env.mjs";

const HF_VERSION = "hyperframes@0.8.50";

function runStream(args, cwd, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn("npx", ["--yes", HF_VERSION, ...args], { cwd, env: buildEnv(), shell: process.platform === "win32" });
    let tail = "";
    const push = (buf, stream) => {
      const text = buf.toString();
      tail = (tail + text).slice(-4000);
      if (onLine) text.split(/\r?\n/).forEach((l) => l.trim() && onLine(l.replace(/\x1b\[[0-9;]*m/g, "").trim(), stream));
    };
    p.stdout.on("data", (d) => push(d, "out"));
    p.stderr.on("data", (d) => push(d, "err"));
    p.on("error", reject);
    p.on("close", (code) => code === 0 ? resolve(tail) : reject(new Error((tail || "").slice(-1200) || ("exit " + code))));
  });
}

export async function check(workDir, log) {
  log("校验工程（布局 / 对比度 / 运行时）…");
  try {
    let summary = "";
    await runStream(["check", "--timeout", "60000"], workDir, (line) => {
      if (/Check (passed|failed)|error\(s\)|✗/.test(line)) { log("  " + line.slice(0, 180)); summary = line; }
    });
    log("校验完成" + (summary ? "：" + summary.slice(0, 120) : ""));
    return true;
  } catch (e) {
    log("校验未通过（继续渲染）：" + String(e.message).split("\n")[0].slice(0, 160));
    return false;
  }
}

export async function render(workDir, outName, log, onProgress) {
  log("开始渲染（逐帧截图 → 编码）…");
  const out = path.join(workDir, outName);
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await runStream(["render", "-o", outName], workDir, (line) => {
    const m = line.match(/(\d{1,3})%/);
    if (m) { onProgress && onProgress(Math.min(99, parseInt(m[1], 10))); return; }
    if (/Render failed|Failed:/i.test(line)) log("  ✗ " + line.slice(0, 200));
    else if (/MB ·|rendered in/.test(line)) log("  " + line.slice(0, 200));
  });
  if (!fs.existsSync(out)) throw new Error("渲染结束但没有找到输出文件");
  onProgress && onProgress(100);
  return out;
}
