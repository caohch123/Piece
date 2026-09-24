// 冒烟测试：直接用一段短片跑完整管线（转写 → 规划 → 建工程 → 校验 → 渲染）
import { randomBytes } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { prepare, finish } from "../lib/pipeline.mjs";

const APP = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clip = process.argv[2] || path.join(APP, "workspace", "uploads", "smoke-clip.mp4");
const workDir = path.join(APP, "workspace", "smoke-" + randomBytes(4).toString("hex"));

fs.mkdirSync(workDir, { recursive: true });

const job = { workDir, mode: "video", videoPath: clip, videoName: "input.mp4" };
const t0 = Date.now();
const log = (line) => console.log(line);
const progress = (p) => process.stdout.write(`\r  [${p}%] `);
const draft = await prepare(job, log, progress);
const res = await finish(job, draft, log, progress);
console.log("\n输出：", res.output, "时长", res.total + "s", "耗时", ((Date.now() - t0) / 1000).toFixed(0) + "s");
