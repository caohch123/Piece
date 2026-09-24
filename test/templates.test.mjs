import assert from "node:assert/strict";
import test from "node:test";
import { BUILDERS } from "../lib/templates.mjs";

test("用户修正的分镜标题按文本转义", () => {
  const malicious = '<img src=x onerror=alert(1)>';
  for (const type of ["hero", "keypoints", "outro"]) {
    const html = BUILDERS[type]({ title: malicious, big: malicious, items: ["正常文案"], tags: [] }).html;
    assert.equal(html.includes("<img"), false, type);
    assert.ok(html.includes("&lt;img"), type);
  }
});
