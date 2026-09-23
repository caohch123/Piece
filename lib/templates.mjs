// 场景模板库：固定 CSS + 页面运行时 + 每种场景的 HTML 构建器
// 生成的 index.html = 固定外壳（本文件）+ 数据（PLAN / CAPS）

export const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@font-face { font-family: "PingFang SC"; src: local("PingFang SC"); }
@font-face { font-family: "Microsoft YaHei"; src: local("Microsoft YaHei"); }
@font-face { font-family: "Noto Sans SC"; src: local("Noto Sans SC"); }
html, body {
  width: 1080px; height: 1920px; overflow: hidden; background: #05070c;
  font-family: "Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  color: #eef1f8;
}
#root { position: relative; width: 1080px; height: 1920px; }
#bg {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(900px 1200px at 20% 20%, rgba(34,211,238,.16), transparent 60%),
    radial-gradient(900px 1200px at 90% 80%, rgba(142,163,196,.16), transparent 60%),
    #05070c;
}
#blob1, #blob2 { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 1; }
#blob1 { width: 620px; height: 620px; left: -160px; top: 900px; background: rgba(34,211,238,.2); }
#blob2 { width: 700px; height: 700px; right: -220px; top: 140px; background: rgba(142,163,196,.18); }
#grid {
  position: absolute; left: -200px; top: -200px; width: 1480px; height: 2320px; z-index: 2;
  background-image:
    linear-gradient(rgba(120,170,230,.075) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120,170,230,.075) 1px, transparent 1px);
  background-size: 96px 96px;
}
#particles { position: absolute; inset: 0; z-index: 3; }
.pt { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: rgba(110,231,245,.6); filter: blur(1px); }
.pt.pv { background: rgba(184,198,220,.55); }

#person-frame {
  position: absolute; left: 0; top: 0; width: 1080px; height: 1920px;
  transform-origin: left top; overflow: hidden; z-index: 10;
  box-shadow: 0 24px 70px rgba(0,0,0,.65);
}
#person-zoom { width: 100%; height: 100%; overflow: hidden; transform-origin: center center; }
#a-roll { width: 100%; height: 100%; object-fit: cover; display: block; }
#scrim {
  position: absolute; inset: 0; z-index: 15; pointer-events: none; opacity: 0;
  background: linear-gradient(180deg, rgba(3,5,10,.88) 0%, rgba(3,5,10,.28) 22%, rgba(3,5,10,0) 38%, rgba(3,5,10,.06) 62%, rgba(3,5,10,.86) 82%, rgba(3,5,10,.97) 100%);
}

.g {
  position: absolute; inset: 0; z-index: 5;
  background:
    radial-gradient(1000px 900px at 12% 12%, rgba(34,211,238,.14), transparent 62%),
    radial-gradient(900px 900px at 95% 85%, rgba(142,163,196,.16), transparent 62%),
    linear-gradient(165deg, rgba(8,11,19,.93), rgba(8,11,19,.78));
}
.kicker {
  position: absolute; left: 80px; top: 196px;
  display: inline-flex; align-items: center; gap: 12px;
  font-size: 24px; letter-spacing: .16em; color: #8f99b0; text-transform: uppercase;
}
.kicker .dot { width: 12px; height: 12px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 20px #22d3ee; }
.g-title { position: absolute; left: 80px; top: 244px; width: 620px; font-size: 58px; font-weight: 900; line-height: 1.25; }
.g-title span { color: #6ee7f5; }
.content { position: absolute; left: 80px; top: 790px; width: 920px; }

.vcard {
  position: relative; padding: 44px 48px; border-radius: 28px; overflow: hidden;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.10);
  font-size: 46px; font-weight: 800; line-height: 1.5;
}
.vcard em { font-style: normal; color: #6ee7f5; }
.vcard .sub { margin-top: 18px; font-size: 30px; font-weight: 500; color: #9aa3b8; line-height: 1.5; }
.vcard .sweep {
  position: absolute; top: 0; left: -40%; width: 40%; height: 100%;
  background: linear-gradient(100deg, transparent, rgba(110,231,245,.22), transparent);
}

.kps { display: flex; flex-direction: column; gap: 22px; }
.kp {
  display: flex; align-items: center; gap: 24px; padding: 30px 34px; border-radius: 24px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
}
.kp .n {
  width: 60px; height: 60px; border-radius: 16px; flex: none; display: grid; place-items: center;
  background: #22d3ee; color: #052028; font-size: 30px; font-weight: 900;
}
.kp .t { font-size: 38px; font-weight: 700; line-height: 1.35; }

.flow { display: flex; flex-direction: column; gap: 24px; }
.fp {
  display: flex; align-items: center; gap: 26px; padding: 30px 34px; border-radius: 24px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
}
.fp .fd {
  width: 64px; height: 64px; border-radius: 18px; flex: none; display: grid; place-items: center;
  background: linear-gradient(160deg,#22d3ee,#0e7490); color: #04202a; font-size: 30px; font-weight: 900;
}
.fp .ft { font-size: 38px; font-weight: 700; line-height: 1.35; }

.cmp { display: flex; gap: 20px; }
.cmp .col { flex: 1; padding: 32px 28px; border-radius: 26px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.09); }
.cmp .col.a { border-color: rgba(34,211,238,.45); }
.cmp .col.b { border-color: rgba(245,158,11,.45); }
.cmp .hd { font-size: 34px; font-weight: 900; margin-bottom: 18px; }
.cmp .col.a .hd { color: #6ee7f5; }
.cmp .col.b .hd { color: #fcd34d; }
.cmp li { list-style: none; font-size: 29px; color: #cfd6e6; line-height: 1.5; margin-top: 12px; }

.figure { display: block; width: 920px; height: auto; }
.fig-lb { fill: #e6ecf8; font-size: 32px; font-weight: 800; }
.fig-sub { fill: #9aa3b8; font-size: 26px; font-weight: 500; }
.lb-row { display: flex; margin-top: 10px; }
.lb-row .lb { flex: 1; text-align: center; }
.lb-row .lb b { display: block; font-size: 36px; }
.lb-row .lb span { font-size: 24px; color: #9aa3b8; }
.lb-row .lb:nth-child(1) b { color: #22d3ee; }
.lb-row .lb:nth-child(2) b { color: #b8c6dc; }
.lb-row .lb:nth-child(3) b { color: #f59e0b; }
.chart-cap { display: flex; justify-content: space-between; font-size: 26px; color: #8f99b0; margin-top: 8px; }

.ov { position: absolute; inset: 0; z-index: 20; }
.ov .kicker { top: 128px; }
.ov-title { position: absolute; left: 80px; top: 196px; width: 800px; font-size: 54px; font-weight: 900; line-height: 1.28; }
.ov-title span { color: #6ee7f5; }
.ov-big { position: absolute; left: 80px; right: 80px; top: 1010px; font-size: 76px; font-weight: 900; line-height: 1.3; }
.ov-big em { font-style: normal; color: #6ee7f5; }
.ov-mid { position: absolute; left: 80px; right: 80px; top: 1120px; text-align: center; font-size: 92px; font-weight: 900; line-height: 1.2; }
.ov-mid em { font-style: normal; color: #6ee7f5; }

.verdicts { position: absolute; left: 80px; right: 80px; top: 1080px; display: flex; flex-direction: column; gap: 20px; }
.vd { display: flex; align-items: center; gap: 18px; padding: 26px 28px; border-radius: 24px; background: rgba(6,10,20,.72); border: 1px solid rgba(255,255,255,.14); }
.vd .badge { width: 56px; height: 56px; border-radius: 16px; flex: none; display: grid; place-items: center; font-size: 30px; font-weight: 900; }
.vd.ok .badge { background: rgba(52,211,153,.16); color: #34d399; border: 1px solid rgba(52,211,153,.5); }
.vd.no .badge { background: rgba(248,113,113,.16); color: #f87171; border: 1px solid rgba(248,113,113,.5); }
.vd .vt { font-size: 34px; font-weight: 800; line-height: 1.3; }
.tags { position: absolute; left: 80px; right: 80px; top: 1420px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.tags .tg {
  padding: 16px 30px; border-radius: 999px; font-size: 30px; font-weight: 700;
  background: rgba(34,211,238,.14); border: 1px solid rgba(34,211,238,.45); color: #a5f3fc;
  opacity: 0;
}

#caption-bar { position: absolute; left: 0; right: 0; bottom: 210px; z-index: 30; text-align: center; }
.cap { position: absolute; left: 0; right: 0; top: auto; bottom: 0; text-align: center; padding: 0 72px; }
.cap > span {
  display: inline; padding: 10px 24px; border-radius: 16px; background: rgba(6,8,14,.82);
  box-shadow: 0 8px 34px rgba(0,0,0,.5);
  font-size: 54px; font-weight: 800; line-height: 1.62; color: #fff;
  -webkit-box-decoration-break: clone; box-decoration-break: clone;
}
.cap .w { display: inline-block; color: #fff; }

#stage { position: absolute; inset: 0; transform-origin: 50% 50%; }
#flash { position: absolute; inset: 0; z-index: 42; background: #dff7ff; opacity: 0; pointer-events: none; }
#wipe {
  position: absolute; top: -400px; left: 0; width: 420px; height: 2800px; z-index: 40; opacity: 0; pointer-events: none;
  background: linear-gradient(90deg, rgba(110,231,245,0) 0%, rgba(110,231,245,.85) 45%, rgba(255,255,255,.9) 50%, rgba(110,231,245,.85) 55%, rgba(110,231,245,0) 100%);
  transform: rotate(18deg);
}
#iris { position: absolute; inset: 0; z-index: 41; opacity: 0; pointer-events: none;
  background: radial-gradient(circle at 50% 50%, #6ee7f5 0%, #22d3ee 45%, #1b6d94 100%); clip-path: circle(0% at 10% 14%); }
#bars { position: absolute; inset: 0; z-index: 41; opacity: 0; pointer-events: none; }
#bars .b { position: absolute; left: 0; width: 100%; height: 16.7%; transform: scaleX(0);
  background: linear-gradient(90deg, #071019, #0e2836); border-top: 1px solid rgba(110,231,245,.55); }
#blocks { position: absolute; inset: 0; z-index: 41; opacity: 0; pointer-events: none; }
#blocks .k { position: absolute; width: 25%; height: 33.4%; transform: scale(0);
  background: linear-gradient(160deg, #0a1826, #12222f); border: 1px solid rgba(110,231,245,.25); }
#progress { position: absolute; left: 0; bottom: 0; height: 6px; width: 0; z-index: 45; background: linear-gradient(90deg,#22d3ee,#8fa6c4); }
`;

// ---------------- 运行时（固定，读 window.PLAN / window.CAPS 驱动） ----------------
export const RUNTIME = `
const tl = gsap.timeline({ paused: true });
const D  = { micro: 0.16, fast: 0.24, std: 0.34, med: 0.46, slow: 0.68 };
const EZ = { reveal: "expo.out", landing: "power4.out", back: "back.out(1.7)", spring: "elastic.out(1, 0.68)", exit: "power3.in", loop: "sine.inOut", step: "steps(3)" };
const ST = { tight: 0.04, list: 0.075, line: 0.1, cascade: 0.15 };
const TOTAL = PLAN.total;

/* ---------- ambient ---------- */
tl.to("#blob1", { x: 150, y: -190, scale: 1.15, duration: 26, ease: "sine.inOut", yoyo: true, repeat: 6 }, 0);
tl.to("#blob2", { x: -160, y: 210, scale: 1.12, duration: 30, ease: "sine.inOut", yoyo: true, repeat: 6 }, 0);
tl.fromTo("#grid", { backgroundPositionX: "0px", backgroundPositionY: "0px" },
                  { backgroundPositionX: "288px", backgroundPositionY: "288px", duration: 24, ease: "none", repeat: 8 }, 0);
document.querySelectorAll(".pt").forEach(function (p, i) {
  tl.to(p, { x: (i % 3 === 0 ? 90 : i % 3 === 1 ? -70 : 60), y: (i % 2 === 0 ? -120 : 110),
             opacity: 0.25, duration: 7 + (i % 4), ease: "sine.inOut", yoyo: true, repeat: 20 }, i * 0.4);
});
tl.to("#progress", { width: 1080, duration: TOTAL, ease: "none" }, 0);
tl.to(".kicker .dot", { scale: 1.45, opacity: 0.7, duration: 1.4, ease: EZ.loop, yoyo: true, repeat: 90, transformOrigin: "center" }, 0);

function jelly(t, k) {
  tl.to("#grid", { keyframes: [ { scale: 1 + 0.02 * k, duration: 0.2, ease: "power2.out" }, { scale: 1, duration: 0.9, ease: EZ.landing } ], transformOrigin: "50% 50%" }, t);
  tl.to("#particles", { keyframes: [ { scale: 1 + 0.035 * k, duration: 0.24, ease: "power2.out" }, { scale: 1, duration: 1.05, ease: EZ.landing } ], transformOrigin: "50% 50%" }, t);
}

/* ---------- 人物镜头 ---------- */
const FULLSCREEN = { hero: 1, outro: 1 };
function toPip(t) {
  tl.to("#person-frame", { keyframes: [
    { x: -24, y: -16, scale: 1.02, duration: 0.12, ease: "power1.out" },
    { x: 712, y: 132, scale: 0.3, borderRadius: 86, duration: 0.52, ease: "back.out(1.25)" } ] }, t);
}
function toFull(t) {
  tl.to("#person-frame", { keyframes: [
    { x: 730, y: 142, scale: 0.283, duration: 0.12, ease: "power1.out" },
    { x: 0, y: 0, scale: 1, borderRadius: 0, duration: 0.52, ease: "back.out(1.15)" } ] }, t);
}
if (PLAN.hasPerson) {
  let cur = null;
  PLAN.scenes.forEach(function (sc) {
    const want = FULLSCREEN[sc.type] ? "full" : "pip";
    if (want !== cur) { (want === "pip" ? toPip : toFull)(sc.start); cur = want; }
  });
  const last = PLAN.scenes[PLAN.scenes.length - 1];
  if (cur !== "full") toFull(last.start + last.dur - 0.6);
  tl.set("#person-zoom", { scale: 1 }, 0);
  tl.to("#person-zoom", { scale: 1.07, duration: TOTAL, ease: "none" }, 0);
  tl.fromTo("#scrim", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.1);
  PLAN.scenes.forEach(function (sc) {
    const full = !!FULLSCREEN[sc.type];
    tl.to("#scrim", { opacity: full ? 1 : 0, duration: 0.3, ease: full ? EZ.landing : EZ.exit }, sc.start - 0.1);
  });
}

/* ---------- 转场 ---------- */
function fxSweep(t) {
  tl.fromTo("#wipe", { xPercent: -270, opacity: 0 }, { xPercent: 270, duration: 0.7, ease: "power4.inOut" }, t - 0.36);
  tl.fromTo("#wipe", { opacity: 0 }, { opacity: 1, duration: D.micro, ease: EZ.landing }, t - 0.36);
  tl.to("#wipe", { opacity: 0, duration: D.fast, ease: EZ.exit }, t + 0.04);
}
function fxZoomPunch(t) {
  tl.fromTo("#stage", { scale: 1 }, { scale: 1.13, duration: 0.22, ease: "power3.in" }, t - 0.26);
  tl.to("#stage", { scale: 1, duration: 0.52, ease: "back.out(1.5)" }, t - 0.04);
  tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.6, duration: 0.09 }, t - 0.07);
  tl.to("#flash", { opacity: 0, duration: 0.28, ease: EZ.exit }, t + 0.02);
}
function fxWhip(t) {
  tl.fromTo("#stage", { rotation: 0, scale: 1 }, { rotation: -1.7, scale: 1.06, duration: 0.18, ease: "power2.in" }, t - 0.30);
  tl.to("#stage", { rotation: 0.9, scale: 1.035, duration: 0.16, ease: "power2.out" }, t - 0.12);
  tl.to("#stage", { rotation: 0, scale: 1, duration: 0.44, ease: EZ.landing }, t + 0.04);
  tl.fromTo("#wipe", { xPercent: -270 }, { xPercent: 270, duration: 0.5, ease: "power4.inOut" }, t - 0.30);
  tl.fromTo("#wipe", { opacity: 0 }, { opacity: 0.9, duration: 0.12 }, t - 0.30);
  tl.to("#wipe", { opacity: 0, duration: 0.2, ease: EZ.exit }, t + 0.08);
}
function fxIris(t) {
  tl.set("#iris", { opacity: 1 }, t - 0.44);
  tl.fromTo("#iris", { clipPath: "circle(0% at 10% 14%)" }, { clipPath: "circle(150% at 55% 62%)", duration: 0.5, ease: "power3.in" }, t - 0.44);
  tl.to("#iris", { clipPath: "circle(0% at 94% 90%)", duration: 0.5, ease: EZ.reveal }, t + 0.02);
  tl.set("#iris", { opacity: 0 }, t + 0.54);
}
function fxBars(t) {
  const bs = document.querySelectorAll("#bars .b");
  tl.set("#bars", { opacity: 1 }, t - 0.44);
  tl.fromTo(bs, { scaleX: 0, transformOrigin: "left center" }, { scaleX: 1, duration: 0.24, ease: "power3.in", stagger: ST.tight }, t - 0.44);
  tl.to(bs, { scaleX: 0, transformOrigin: "right center", duration: 0.22, ease: EZ.exit, stagger: ST.tight }, t + 0.05);
  tl.set("#bars", { opacity: 0 }, t + 0.46);
}
function fxBlocks(t) {
  const ks = document.querySelectorAll("#blocks .k");
  tl.set("#blocks", { opacity: 1 }, t - 0.44);
  tl.fromTo(ks, { scale: 0 }, { scale: 1, duration: 0.26, ease: "back.out(1.6)", stagger: { each: 0.022, from: "start" } }, t - 0.44);
  tl.to(ks, { scale: 0, duration: 0.2, ease: EZ.exit, stagger: { each: 0.022, from: "end" } }, t + 0.04);
  tl.set("#blocks", { opacity: 0 }, t + 0.44);
}
function fxFlash(t) {
  tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.85, duration: 0.07 }, t - 0.06);
  tl.to("#flash", { opacity: 0, duration: 0.3, ease: EZ.exit }, t + 0.01);
  tl.fromTo("#stage", { scale: 1.06 }, { scale: 1, duration: 0.44, ease: "back.out(1.3)" }, t - 0.06);
}
function fxGlitch(t) {
  tl.to("#stage", { x: -24, scale: 1.05, duration: 0.05, ease: EZ.step }, t - 0.20);
  tl.to("#stage", { x: 18, scale: 1.05, duration: 0.05, ease: EZ.step }, t - 0.15);
  tl.to("#stage", { x: -11, scale: 1.05, duration: 0.05, ease: EZ.step }, t - 0.10);
  tl.to("#stage", { x: 0, scale: 1, duration: 0.16, ease: "power4.out" }, t - 0.05);
  tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.5, duration: 0.06, ease: EZ.step }, t - 0.20);
  tl.to("#flash", { opacity: 0, duration: 0.22, ease: EZ.exit }, t - 0.12);
  tl.fromTo("#wipe", { xPercent: -270 }, { xPercent: 270, duration: 0.42, ease: "power3.in" }, t - 0.24);
  tl.fromTo("#wipe", { opacity: 0 }, { opacity: 0.85, duration: 0.1 }, t - 0.24);
  tl.to("#wipe", { opacity: 0, duration: 0.16, ease: EZ.exit }, t + 0.08);
}
const FX = [fxZoomPunch, fxBars, fxWhip, fxIris, fxBlocks, fxSweep, fxFlash, fxGlitch];
PLAN.cuts.forEach(function (t, i) {
  const fn = FX[i % FX.length];
  fn(t); jelly(t, i % 2 === 0 ? 1.3 : 0.9);
});

/* ---------- 每类场景的入场 ---------- */
const RECIPES = {
  hero: function (S, sc) {
    tl.from(S + " .kicker", { opacity: 0, x: -20, duration: D.med, ease: EZ.reveal }, sc.start + 0.15);
    tl.from(S + " .ov-title", { opacity: 0, clipPath: "inset(0 0 100% 0)", y: 34, duration: D.slow, ease: EZ.reveal }, sc.start + 0.3);
    tl.from(S + " .ov-big", { opacity: 0, y: 40, duration: D.slow, ease: EZ.back }, sc.start + 0.7);
  },
  card: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .g-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .vcard", { opacity: 0, rotationY: -22, transformPerspective: 1000, transformOrigin: "left center", duration: D.slow, ease: EZ.reveal }, sc.start + 0.7);
    tl.fromTo(S + " .sweep", { xPercent: 0 }, { xPercent: 420, duration: 1.5, ease: "power2.inOut" }, sc.start + 1.1);
  },
  keypoints: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .g-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .kp", { opacity: 0, x: -70, duration: D.med, stagger: 0.22, ease: EZ.back }, sc.start + 0.6);
  },
  steps: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .g-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .fd", { opacity: 0, scale: 0.3, duration: D.std, stagger: 0.22, transformOrigin: "center", ease: EZ.back }, sc.start + 0.6);
    tl.from(S + " .ft", { opacity: 0, x: -24, duration: D.med, stagger: 0.22, ease: EZ.reveal }, sc.start + 0.75);
  },
  compare: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .g-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .col.a", { opacity: 0, x: -60, duration: D.slow, ease: EZ.reveal }, sc.start + 0.6);
    tl.from(S + " .col.b", { opacity: 0, x: 60, duration: D.slow, ease: EZ.reveal }, sc.start + 0.85);
  },
  diagram: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .g-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .nd", { opacity: 0, scale: 0.2, duration: D.std, stagger: ST.tight, transformOrigin: "center", ease: EZ.back }, sc.start + 0.6);
    tl.from(S + " .eg", { opacity: 0, duration: 0.12, stagger: 0.02, ease: EZ.landing }, sc.start + 1.0);
    tl.from(S + " .lb-row .lb", { opacity: 0, y: 18, duration: D.med, stagger: ST.line, ease: EZ.reveal }, sc.start + 1.2);
    tl.to(S + " .flowline", { strokeDashoffset: -216, duration: 2.4, repeat: 4, ease: "none" }, sc.start + 1.4);
  },
  chart: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .g-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .axi", { opacity: 0, duration: D.med, stagger: ST.line, ease: EZ.landing }, sc.start + 0.6);
    tl.from(S + " .dot", { opacity: 0, scale: 0, duration: D.std, stagger: ST.tight, transformOrigin: "center", ease: EZ.back }, sc.start + 0.7);
    tl.fromTo(S + " .trend", { strokeDasharray: 1300, strokeDashoffset: 1300 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, sc.start + 1.3);
    tl.from(S + " .chart-cap span", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: D.med, stagger: 0.2, ease: EZ.reveal }, sc.start + 2.4);
  },
  outro: function (S, sc) {
    tl.from(S + " .kicker, " + S + " .ov-title", { opacity: 0, y: 30, duration: D.slow, stagger: ST.line, ease: EZ.reveal }, sc.start + 0.2);
    tl.from(S + " .vd", { opacity: 0, y: 30, duration: D.med, stagger: 0.35, ease: EZ.reveal }, sc.start + 0.7);
    tl.from(S + " .tg", { opacity: 0, scale: 0.5, duration: D.std, stagger: 0.45, ease: EZ.back }, sc.start + 1.5);
  }
};
PLAN.scenes.forEach(function (sc) { const fn = RECIPES[sc.type] || RECIPES.keypoints; fn("#s" + sc.i, sc); });

/* ---------- 字幕 ---------- */
CAPS.forEach(function (c) {
  const el = document.getElementById(c.id);
  if (!el) return;
  tl.fromTo(el, { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: D.std, ease: EZ.back }, c.start);
  el.querySelectorAll(".w").forEach(function (w) {
    const t = c.start + parseFloat(w.dataset.t) / 1000;
    tl.to(w, { color: "#ffd166", duration: 0.12 }, t);
    tl.to(w, { color: "#ffffff", duration: 0.22 }, t + 0.36);
  });
  tl.to(el, { opacity: 0, y: -18, scale: 0.97, duration: 0.2, ease: EZ.exit }, c.start + c.dur - 0.24);
});

window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
`;

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function kicker(text, top) {
  if (!text) return "";
  const style = top ? ` style="top:${top}px"` : "";
  return `<div class="kicker"${style}><span class="dot"></span>${esc(text)}</div>`;
}
function title(t) {
  return t ? `<div class="g-title">${t}</div>` : "";
}

// 每种场景：返回 { html, reveals } —— reveals 是相对场景开始的秒数（用于排 pop 音效）
export const BUILDERS = {
  hero(sc) {
    return {
      html: `${kicker(sc.kicker, 128)}<div class="ov-title">${sc.title || ""}</div><div class="ov-big">${sc.big || ""}</div>`,
      reveals: [0.3, 0.7]
    };
  },
  card(sc) {
    return {
      html: `${kicker(sc.kicker)}${title(sc.title)}<div class="content"><div class="vcard">${sc.text || ""}${sc.sub ? `<div class="sub">${esc(sc.sub)}</div>` : ""}<div class="sweep"></div></div></div>`,
      reveals: [0.7]
    };
  },
  keypoints(sc) {
    const items = (sc.items || []).map((t, i) => `<div class="kp"><div class="n">${i + 1}</div><div class="t">${esc(t)}</div></div>`).join("");
    return {
      html: `${kicker(sc.kicker)}${title(sc.title)}<div class="content"><div class="kps">${items}</div></div>`,
      reveals: (sc.items || []).map((_, i) => 0.6 + i * 0.22)
    };
  },
  steps(sc) {
    const items = (sc.items || []).map((t, i) => `<div class="fp"><div class="fd">${i + 1}</div><div class="ft">${esc(t)}</div></div>`).join("");
    return {
      html: `${kicker(sc.kicker)}${title(sc.title)}<div class="content"><div class="flow">${items}</div></div>`,
      reveals: (sc.items || []).map((_, i) => 0.6 + i * 0.22)
    };
  },
  compare(sc) {
    const li = (arr) => (arr || []).map((t) => `<li>${esc(t)}</li>`).join("");
    return {
      html: `${kicker(sc.kicker)}${title(sc.title)}<div class="content"><div class="cmp">` +
        `<div class="col a"><div class="hd">${esc(sc.leftTitle || "A")}</div><ul>${li(sc.left)}</ul></div>` +
        `<div class="col b"><div class="hd">${esc(sc.rightTitle || "B")}</div><ul>${li(sc.right)}</ul></div></div></div>`,
      reveals: [0.6, 0.85]
    };
  },
  diagram(sc) {
    const N = (sc.nodes || ["输入层", "隐藏层", "输出层"]);
    const edges = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) edges.push(`<line class="eg" x1="110" y1="${110 + a * 150}" x2="460" y2="${70 + b * 130}"/>`);
    for (let b = 0; b < 4; b++) for (let c = 0; c < 2; c++) edges.push(`<line class="eg" x1="460" y1="${70 + b * 130}" x2="810" y2="${190 + c * 140}"/>`);
    const circles = [0, 1, 2].map((a) => `<circle class="nd" cx="110" cy="${110 + a * 150}" r="26" fill="rgba(34,211,238,.18)" stroke="#22d3ee" stroke-width="2.5"/>`).join("")
      + [0, 1, 2, 3].map((b) => `<circle class="nd" cx="460" cy="${70 + b * 130}" r="26" fill="rgba(184,198,220,.16)" stroke="#b8c6dc" stroke-width="2.5"/>`).join("")
      + [0, 1].map((c) => `<circle class="nd" cx="810" cy="${190 + c * 140}" r="26" fill="rgba(245,158,11,.18)" stroke="#f59e0b" stroke-width="2.5"/>`).join("");
    return {
      html: `${kicker(sc.kicker)}${title(sc.title)}<div class="content"><svg class="figure" viewBox="0 0 920 500" fill="none">` +
        `<g stroke="rgba(160,180,205,.28)" stroke-width="1.6">${edges.join("")}</g>` +
        `<path class="flowline" d="M110 110 C 300 60, 600 420, 810 190" stroke="#6ee7f5" stroke-width="4" stroke-dasharray="10 22" stroke-linecap="round" opacity=".85"/>` +
        circles + `</svg><div class="lb-row">` +
        `<div class="lb"><b>${esc(N[0])}</b><span>${esc(N[3] || "接收数据")}</span></div>` +
        `<div class="lb"><b>${esc(N[1])}</b><span>${esc(N[4] || "层层计算")}</span></div>` +
        `<div class="lb"><b>${esc(N[2])}</b><span>${esc(N[5] || "给出结果")}</span></div>` +
        `</div></div>`,
      reveals: [0.6, 0.9, 1.2]
    };
  },
  chart(sc) {
    const pts = [[90, 300], [170, 286], [250, 300], [330, 258], [410, 266], [490, 224], [570, 232], [650, 190], [730, 172], [810, 120]];
    return {
      html: `${kicker(sc.kicker)}${title(sc.title)}<div class="content"><svg class="figure" viewBox="0 0 920 380" fill="none">` +
        `<g class="axi" stroke="rgba(255,255,255,.13)" stroke-width="2"><line x1="60" y1="330" x2="880" y2="330"/><line x1="60" y1="330" x2="60" y2="60"/></g>` +
        pts.map((p) => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="9" fill="#b8c6dc"/>`).join("") +
        `<path class="trend" d="M70 312 C 220 300 320 220 460 180 C 600 140 720 110 840 92" stroke="#34d399" stroke-width="7" stroke-linecap="round"/>` +
        `<text class="fig-sub" x="64" y="368">${esc(sc.xLabel || "时间 / 数据量 →")}</text>` +
        `<text class="fig-sub" x="700" y="60">${esc(sc.yLabel || "准确率 ↑")}</text></svg>` +
        `<div class="chart-cap"><span>${esc(sc.capLeft || "数据越多")}</span><span>${esc(sc.capRight || "效果越好")}</span></div></div>`,
      reveals: [0.6, 0.9, 1.3]
    };
  },
  outro(sc) {
    const tags = (sc.tags || []).map((t) => `<div class="tg">${esc(t)}</div>`).join("");
    return {
      html: `${kicker(sc.kicker, 128)}<div class="ov-title">${sc.title || ""}</div><div class="verdicts">` +
        `<div class="vd ok"><div class="badge">✓</div><div class="vt">${esc((sc.ok || ""))}</div></div>` +
        `<div class="vd no"><div class="badge">✕</div><div class="vt">${esc((sc.no || ""))}</div></div></div>` +
        `<div class="tags">${tags}</div>`,
      reveals: [0.7, 1.05, 1.5, 1.8]
    };
  }
};
