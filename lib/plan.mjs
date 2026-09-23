// 规划：把句子变成分镜（选模板 + 填内容）。有 DEEPSEEK_API_KEY 时用 LLM，否则用启发式
const FILLERS = /^(其实|那么|所以|但是|不过|而且|然后|我们|你们|他们|这个|那个|就是|一种|一套|一些|非常|真的|主要|基本上|大家|现在)/;

const clip = (s, n) => {
  let t = String(s || "").replace(/[「」"“”]/g, "").replace(/[，,。！？!?；;：:\s]/g, "").replace(FILLERS, "");
  return t.length > n ? t.slice(0, n) : t;
};

function splitItems(text, max = 4, len = 14) {
  const parts = String(text).split(/[，,。！？!?；;]/).map((s) => s.trim())
    .filter((s) => s.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "").length > 1);
  const out = [];
  parts.forEach((p) => {
    if (p.length <= len + 4) { out.push(clip(p, len + 2)); return; }
    const chunks = Math.max(2, Math.ceil(p.length / len));
    const size = Math.ceil(p.length / chunks);
    for (let i = 0; i < p.length; i += size) out.push(clip(p.slice(i, i + size), len + 2));
  });
  return out.slice(0, max);
}

function classify(text) {
  if (/首先|第一步|第一是|第二步|第三步|接着|然后|最后|步骤|流程|下一步/.test(text)) return "steps";
  if (/但是|不过|对比|相比|区别|不同|相反|一边|另一|而不是/.test(text)) return "compare";
  if (/层|结构|节点|网络|输入|输出|连接|组成|体系/.test(text)) return "diagram";
  if (/越来越|上升|下降|增长|提高|准确率|误差|趋势|数据越多/.test(text)) return "chart";
  return "keypoints";
}

const KICKERS = { hero: "开场", card: "一句话说清", keypoints: "要点", steps: "流程", compare: "对比", diagram: "结构", chart: "趋势", outro: "小结" };

function heuristicScenes(units, log) {
  const scenes = [];
  let i = 0;
  let idx = 0;
  while (i < units.length) {
    const isFirst = idx === 0;
    const isLast = i >= units.length - 1;
    let group = [units[i]];
    if (!isFirst && !isLast) {
      let dur = units[i].end - units[i].start;
      let j = i + 1;
      while (j < units.length - 1 && group.length < 3 && dur < 10.5) {
        group.push(units[j]);
        dur = units[j].end - units[i].start;
        j++;
      }
      i = j - 1;
    }
    const text = group.map((g) => g.text).join("，");
    const start = group[0].start;
    const end = group[group.length - 1].end;
    let type;
    if (isFirst) type = "hero";
    else if (isLast) type = "outro";
    else type = classify(text);

    const base = { i: idx, start: +start.toFixed(3), dur: +Math.max(1.6, end - start).toFixed(3), type, kicker: KICKERS[type] };
    const items = splitItems(text);

    if (type === "hero") {
      Object.assign(base, { title: clip(group[0].text, 12), big: clip(group.map((g) => g.text).join(""), 16), reveals: [0.3, 0.7] });
    } else if (type === "outro") {
      const lines = splitItems(text, 2, 22);
      Object.assign(base, {
        title: clip(text, 12),
        ok: "学到： " + (lines[0] || ""),
        no: "它不是： " + (lines[1] || ""),
        tags: items.filter((x) => x.length <= 6).slice(0, 3),
        reveals: [0.7, 1.05, 1.5]
      });
    } else if (type === "compare") {
      const mid = Math.ceil(items.length / 2);
      Object.assign(base, {
        title: clip(text, 12),
        leftTitle: "一方面", left: items.slice(0, mid),
        rightTitle: "另一方面", right: items.slice(mid),
        reveals: [0.6, 0.85]
      });
    } else if (type === "diagram") {
      Object.assign(base, {
        title: clip(text, 12),
        nodes: ["输入层", "隐藏层", "输出层", "接收数据", "层层计算", "给出结果"],
        reveals: [0.6, 0.9, 1.2]
      });
    } else if (type === "chart") {
      Object.assign(base, {
        title: clip(text, 12),
        xLabel: "数据 / 时间 →", yLabel: "效果 ↑",
        capLeft: clip(items[0] || "", 8), capRight: clip(items[items.length - 1] || "", 8),
        reveals: [0.6, 0.9, 1.3]
      });
    } else if (type === "keypoints" || type === "steps") {
      const t = clip(group[0].text, 12);
      let list = items;
      // 首条要点常和标题是同一句，去掉避免重复展示
      if (list.length > 1 && (t.startsWith(list[0]) || list[0].startsWith(t))) list = list.slice(1);
      Object.assign(base, { title: t, items: list, reveals: list.map((_, k) => 0.6 + k * 0.22) });
    }
    scenes.push(base);
    idx++; i++;
  }
  log(`启发式分镜：${scenes.length} 个场景（${scenes.map((s) => s.type).join(" → ")}）`);
  return scenes;
}

async function llmScenes(units, log) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const list = units.map((u, i) => `${i}. [${u.start.toFixed(1)}-${u.end.toFixed(1)}s] ${u.text}`).join("\n");
  const sys = `你是短视频分镜导演。把口播稿按语义分组，为每组选一个场景模板并提炼文案。
可用模板：hero(开场,仅第一组)、keypoints(2-4条要点)、steps(2-4步流程)、compare(左右对比)、diagram(三层结构图)、chart(趋势曲线)、outro(结尾小结,仅最后一组)。
只输出 JSON，不要解释。格式：
{"scenes":[{"ids":[0,1],"type":"keypoints","title":"不超过12字","items":["不超过14字","..."],"leftTitle":"","left":[],"rightTitle":"","right":[],"ok":"","no":"","tags":[]}]}
要求：ids 连续覆盖所有句子且不重叠；hero 必须有 title 和 big(核心观点,<=16字)；outro 必须有 title、ok、no、tags(<=3个,每个<=6字)；compare 必须给 left/right；其他模板给 items。文案要口语化、短、精确。`;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: "deepseek-chat", temperature: 0.4, response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: `口播稿（共 ${units.length} 句）：\n${list}` }]
      })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const plan = JSON.parse(data.choices[0].message.content);
    const scenes = [];
    plan.scenes.forEach((sc, idx) => {
      const ids = (sc.ids || []).filter((n) => n >= 0 && n < units.length);
      if (!ids.length) return;
      const start = units[ids[0]].start;
      const end = units[ids[ids.length - 1]].end;
      const type = idx === 0 ? "hero" : idx === plan.scenes.length - 1 ? "outro" : (sc.type || "keypoints");
      const items = (sc.items || []).map((x) => clip(x, 18)).slice(0, 4);
      const base = { i: idx, start: +start.toFixed(3), dur: +Math.max(1.6, end - start).toFixed(3), type, kicker: KICKERS[type] || "要点" };
      if (type === "hero") Object.assign(base, { title: clip(sc.title, 12), big: clip(sc.big || sc.title, 16), reveals: [0.3, 0.7] });
      else if (type === "outro") Object.assign(base, {
        title: clip(sc.title, 12), ok: clip(sc.ok || "拿到结论", 20), no: clip(sc.no || "别误解", 20),
        tags: (sc.tags || []).map((t) => clip(t, 6)).slice(0, 3), reveals: [0.7, 1.05, 1.5]
      });
      else if (type === "compare") Object.assign(base, {
        title: clip(sc.title, 12),
        leftTitle: clip(sc.leftTitle || "一方面", 6), left: (sc.left || items).map((x) => clip(x, 18)).slice(0, 3),
        rightTitle: clip(sc.rightTitle || "另一方面", 6), right: (sc.right || items).map((x) => clip(x, 18)).slice(0, 3),
        reveals: [0.6, 0.85]
      });
      else if (type === "diagram") Object.assign(base, { title: clip(sc.title, 12), nodes: sc.nodes || ["输入层", "隐藏层", "输出层", "接收数据", "层层计算", "给出结果"], reveals: [0.6, 0.9, 1.2] });
      else if (type === "chart") Object.assign(base, {
        title: clip(sc.title, 12), xLabel: clip(sc.xLabel || "数据 / 时间 →", 14), yLabel: clip(sc.yLabel || "效果 ↑", 10),
        capLeft: clip(sc.capLeft || "", 8), capRight: clip(sc.capRight || "", 8), reveals: [0.6, 0.9, 1.3]
      });
      else Object.assign(base, { title: clip(sc.title, 12), items, reveals: items.map((_, k) => 0.6 + k * 0.22) });
      scenes.push(base);
    });
    if (!scenes.length) throw new Error("空分镜");
    log(`DeepSeek 分镜：${scenes.length} 个场景（${scenes.map((s) => s.type).join(" → ")}）`);
    return scenes;
  } catch (e) {
    log("LLM 分镜失败（" + e.message + "），改用启发式");
    return null;
  }
}

// prompt 模式：让 LLM 写稿（没有 key 就按提示词切句），再合成时间轴
async function scriptUnits(text, log) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          model: "deepseek-chat", temperature: 0.7,
          messages: [
            { role: "system", content: "你是科普短视频编剧。写一段 6-9 句的中文口播稿，每句独立、口语化、长度 8-24 字，句末用句号。只输出稿子正文，不要序号、不要解释。" },
            { role: "user", content: text }
          ]
        })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const body = data.choices[0].message.content.trim();
      const lines = body.split(/[\n。！？!?]+/).map((s) => s.replace(/^[\s\d.、]+/, "").trim()).filter((s) => s.length > 3);
      if (lines.length >= 3) { log(`DeepSeek 写稿：${lines.length} 句`); return lines; }
    } catch (e) { log("写稿失败（" + e.message + "），改用原始提示词切句"); }
  }
  // 无 key：按标点切句，把逗号切出来的碎片（如"研究发现"）并到下一句
  const out = [];
  String(text).split(/[\n。！？!?；;]+/).map((s) => s.trim()).filter((s) => s.length > 3).forEach((s) => {
    const parts = s.split(/[，,]/).map((x) => x.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].length < 6 && i + 1 < parts.length) { parts[i + 1] = parts[i] + parts[i + 1]; continue; }
      out.push(parts[i]);
    }
  });
  return out.slice(0, 9);
}

export async function plan({ sentences, mode, prompt, log }) {
  let units;
  if (mode === "prompt") {
    const lines = await scriptUnits(prompt, log);
    let t = 0.4;
    units = lines.map((text) => {
      const dur = Math.min(5.2, Math.max(2.4, 1.1 + text.length * 0.19));
      const u = { text, start: +t.toFixed(3), end: +(t + dur).toFixed(3), words: [] };
      t += dur;
      return u;
    });
  } else {
    units = sentences.map((s) => ({ text: s.text, start: s.start, end: s.end, words: s.words }));
  }
  if (!units.length) throw new Error("没有可用句子");
  const scenes = (await llmScenes(units, log)) || heuristicScenes(units, log);
  // 场景边界对齐：前一个场景延伸到下一个场景开始，避免空档
  for (let i = 0; i < scenes.length - 1; i++) scenes[i].dur = +(scenes[i + 1].start - scenes[i].start).toFixed(3);
  const total = +(scenes[scenes.length - 1].start + scenes[scenes.length - 1].dur + 1.0).toFixed(3);
  const cuts = scenes.slice(1).map((s) => s.start);
  return { scenes, cuts, total, units };
}
