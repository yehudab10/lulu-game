// 📱 The phone sweep (ci/sweep-phone, Shabbos 2026-11-28): shared helpers for scripts/tests3d/sweepphone*.js.
// What a player on a PHONE sees: every visible piece of text on the screen (+ where), words a player should never read
// (`undefined`, `NaN`, `[object Object]`, a controller glyph on a touch screen), on-screen pieces that cover each other,
// and screenshots (SWEEP_SHOTS=1 or --shots → smoke-shots/sweepphone/).
const W = require("./qawatch.js");
const fs = require("fs");
const path = require("path");

const SHOTS = path.resolve(__dirname, "..", "..", "smoke-shots", "sweepphone");
const BAD_WORDS = /\bundefined\b|\bNaN\b|\[object |\bnull\b(?! ?island)|\bTODO\b|\bFIXME\b|\$\{/;
// a controller's / keyboard's button names in text a TOUCH player reads
const PAD_WORDS = /(^|[^\w])(press|hold|tap) (A|B|X|Y|✕|○|△|□|LB|RB|LT|RT|L1|R1|L2|R2|E|Space|Enter|Esc)\b/i;

function make(t) {
  const g = t.game;
  const log = (...a) => console.log("   ·", ...a);
  const shot = async label => {
    if (!process.env.SWEEP_SHOTS && !process.argv.includes("--shots")) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await t.L(`(window.__lulu3d && __lulu3d.realFrame && __lulu3d.realFrame(), true)`).catch(() => {});
    await t.page.screenshot({ path: path.join(SHOTS, `${label.replace(/[^\w-]+/g, "-")}.png`) });
  };
  // every visible leaf-ish text on screen: { tx, id, cls, r: [l, t, r, b] }
  const texts = () => t.L(`(() => {
    const out = [], seen = new Set();
    const vis = e => { for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.05) return false; } return true; };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const tx = n.textContent.replace(/\\s+/g, " ").trim(); if (!tx) continue;
      const e = n.parentElement; if (!e || seen.has(e) || /SCRIPT|STYLE/.test(e.tagName)) continue;
      const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      if (!vis(e)) continue; seen.add(e);
      out.push({ tx: e.textContent.replace(/\\s+/g, " ").trim().slice(0, 140), id: e.id || (e.closest("[id]") || {}).id || "", cls: String(e.className || "").slice(0, 40), r: [r.left, r.top, r.right, r.bottom].map(Math.round) });
    }
    return out;
  })()`);
  // text a player can read that is clearly broken
  const badText = async (where, opts = {}) => {
    const all = await texts();
    const bad = all.filter(x => BAD_WORDS.test(x.tx)).map(x => `${x.id}: ${x.tx}`);
    t.check(`${where}: no undefined / NaN / [object] on screen`, !bad.length, bad.slice(0, 4).join(" | "));
    if (opts.touch) {
      const pad = all.filter(x => PAD_WORDS.test(x.tx)).map(x => `${x.id}: ${x.tx}`);
      t.check(`${where}: no controller / keyboard button names on a touch screen`, !pad.length, pad.slice(0, 4).join(" | "));
    }
    // a piece of text running off the screen's sides
    const off = all.filter(x => x.r[0] < -2 || x.r[2] > (opts.w || 9999) + 2).map(x => `${x.id}: ${x.tx.slice(0, 40)} ${x.r}`);
    if (opts.w) t.check(`${where}: no text off the sides`, !off.length, off.slice(0, 4).join(" | "));
    return all;
  };
  const dump = async label => { const all = await texts(); log(label + ": " + all.map(x => `[${x.id}${x.cls ? "." + x.cls.split(" ")[0] : ""}] ${x.tx.slice(0, 70)}`).join(" ‖ ").slice(0, 1800)); return all; };
  // rectangles of the HUD's touch pieces that are on screen
  const box = id => t.L(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e) return null; for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === "none" || s.visibility === "hidden") return null; } const r = e.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; })()`);
  const tapEl = async (id, hold = 2) => {
    await t.L(`(() => { const e = document.getElementById(${JSON.stringify(id)}); const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 9, clientX: x, clientY: y })); return 0; })()`);
    await t.frames(hold);
    await t.L(`(() => { const e = document.getElementById(${JSON.stringify(id)}); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", pointerId: 9 })); return 0; })()`);
    await t.frames(2);
  };
  return { g, log, shot, texts, badText, dump, box, tapEl };
}

module.exports = { make, W };
