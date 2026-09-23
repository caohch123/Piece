// 构建：把分镜数据写成 HyperFrames 工程（index.html + 配置 + 资产）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CSS, RUNTIME, BUILDERS } from "./templates.mjs";

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HF_VERSION = "hyperframes@0.8.50";

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
}

function ensureAssets(workDir) {
  const dstAssets = path.join(workDir, "assets");
  fs.mkdirSync(path.join(dstAssets, "sfx"), { recursive: true });
  fs.copyFileSync(path.join(APP_DIR, "assets", "gsap.min.js"), path.join(dstAssets, "gsap.min.js"));
  for (const f of ["whoosh.wav", "pop.wav", "ding.wav"]) {
    fs.copyFileSync(path.join(APP_DIR, "assets", "sfx", f), path.join(dstAssets, "sfx", f));
  }
}

function particles() {
  const spots = [[120, 340], [820, 520], [420, 780], [240, 1180], [900, 1320], [640, 1560], [180, 1680], [760, 980], [520, 240], [960, 760], [320, 520], [680, 1240]];
  return spots.map(([l, t], i) => `<div class="pt${i % 2 ? " pv" : ""}" style="left:${l}px;top:${t}px"></div>`).join("");
}

// 长标题按标点/中点断成两行，避免末行只剩一两个字
function balance(t, max = 14) {
  const s = String(t || "").trim();
  if (!s || s.includes("<") || s.length <= max + 2) return s;
  const mid = Math.round(s.length / 2);
  let cut = mid;
  for (let d = 0; d < 4; d++) {
    if (/[，、。；：]/.test(s[mid + d] || "")) { cut = mid + d + 1; break; }
    if (/[，、。；：]/.test(s[mid - d] || "")) { cut = mid - d + 1; break; }
  }
  return s.slice(0, cut) + "<br>" + s.slice(cut);
}

export function build({ workDir, plan, caps, videoFile, log }) {
  ensureAssets(workDir);

  const { scenes, cuts, total } = plan;
  const person = !!videoFile;

  // 场景 HTML
  const sceneHtml = scenes.map((sc) => {
    const sc2 = sc.type === "hero" || sc.type === "outro"
      ? { ...sc, title: balance(sc.title), big: balance(sc.big, 13) }
      : sc;
    const b = (BUILDERS[sc2.type] || BUILDERS.keypoints)(sc2);
    const cls = person && (sc.type === "hero" || sc.type === "outro") ? "ov" : "g";
    return `<div id="s${sc.i}" class="${cls} clip" data-type="${sc.type}" data-start="${sc.start}" data-duration="${sc.dur}" data-track-index="1">${b.html}</div>`;
  }).join("\n      ");

  // 音效：切点 whoosh + 场景内 pop
  const sfx = [];
  let track = 4;
  cuts.forEach((t) => {
    sfx.push({ src: "whoosh", start: +(t - 0.3).toFixed(3), dur: 0.5, vol: 0.5, track: track++ });
    if (track > 9) track = 4;
  });
  scenes.forEach((sc) => {
    const b = (BUILDERS[sc.type] || BUILDERS.keypoints)(sc);
    (b.reveals || []).slice(0, 4).forEach((r) => {
      sfx.push({ src: "pop", start: +(sc.start + r).toFixed(3), dur: 0.14, vol: 0.26, track: track++ });
      if (track > 9) track = 4;
    });
  });
  sfx.sort((a, b) => a.start - b.start);
  const sfxHtml = sfx.map((s, i) =>
    `<audio id="sx${i + 1}" src="assets/sfx/${s.src}.wav" data-start="${s.start}" data-duration="${s.dur}" data-volume="${s.vol}" data-track-index="${s.track}"></audio>`
  ).join("\n      ");

  // 字幕 HTML（有词级时间戳走卡拉OK高亮，没有就整句显示）
  const escHtml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const capHtml = caps.map((c) => {
    const words = c.words && c.words.length
      ? c.words.map((w) => `<span class="w" data-t="${Math.max(0, Math.round((w.start - c.start) * 1000))}">${escHtml(w.w)}</span>`).join("")
      : `<span class="w" data-t="0">${escHtml(c.text)}</span>`;
    return `<div id="${c.id}" class="cap clip" data-start="${c.start}" data-duration="${c.dur}" data-track-index="3"><span>${words}</span></div>`;
  }).join("\n        ");

  const personHtml = person ? `
      <div id="person-frame">
        <div id="person-zoom">
          <video id="a-roll" src="${videoFile}" muted playsinline data-start="0" data-duration="${total}" data-track-index="0"></video>
        </div>
      </div>
      <audio id="a-roll-audio" src="${videoFile}" data-start="0" data-duration="${total}" data-track-index="2" data-volume="1"></audio>` : "";

  const PLAN_DATA = {
    total,
    hasPerson: person,
    cuts,
    scenes: scenes.map((s) => ({ i: s.i, start: s.start, dur: s.dur, type: s.type }))
  };
  const CAPS_DATA = caps.map((c) => ({ id: c.id, start: c.start, dur: c.dur }));

  const html = `<!doctype html>
<html lang="zh-CN" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>${CSS}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920">
      <div id="stage">
      <div id="bg"></div>
      <div id="blob1"></div>
      <div id="blob2"></div>
      <div id="grid"></div>
      <div id="particles">${particles()}</div>

      ${sceneHtml}
      ${personHtml}
      <div id="scrim"></div>

      <div id="caption-bar">
        ${capHtml}
      </div>

      <div id="flash"></div>
      <div id="wipe"></div>
      <div id="iris"></div>
      <div id="bars">${Array.from({ length: 6 }, (_, i) => `<div class="b" style="top:${i * 16.7}%"></div>`).join("")}</div>
      <div id="blocks">${Array.from({ length: 12 }, (_, i) => `<div class="k" style="left:${(i % 4) * 25}%;top:${Math.floor(i / 4) * 33.4}%"></div>`).join("")}</div>
      <div id="progress"></div>
      </div>

      ${sfxHtml}
    </div>

    <script>
      window.PLAN = ${JSON.stringify(PLAN_DATA)};
      window.CAPS = ${JSON.stringify(CAPS_DATA)};
    </script>
    <script>${RUNTIME}</script>
  </body>
</html>
`;

  fs.writeFileSync(path.join(workDir, "index.html"), html, "utf8");
  writeJson(path.join(workDir, "package.json"), {
    name: path.basename(workDir), private: true, type: "module",
    scripts: {
      dev: `npx --yes ${HF_VERSION} preview`,
      check: `npx --yes ${HF_VERSION} check`,
      render: `npx --yes ${HF_VERSION} render`
    }
  });
  writeJson(path.join(workDir, "hyperframes.json"), {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
    media: { autoProxy: true }
  });
  writeJson(path.join(workDir, "meta.json"), { id: path.basename(workDir), name: path.basename(workDir), createdAt: new Date().toISOString() });

  log(`工程已生成：${scenes.length} 场景 / ${cuts.length} 次转场 / ${sfx.length} 个音效 / ${caps.length} 条字幕 / ${total}s`);
  return { htmlPath: path.join(workDir, "index.html"), total };
}
