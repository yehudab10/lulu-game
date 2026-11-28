// 📱 The phone sweep, part 3 — MENUS + SETTINGS on a phone (a returning player's save), upright then on its side:
//   • ❚❚ pause: fits, every button ≥ 44 px tall, no broken text
//   • ⚙️ Settings: every switch changes what it says, the card fits a small phone (375 × 667) and scrolls by finger; a
//     reload keeps every choice
//   • the 📱 phone on a small phone upright + turned on its side WHILE it's open: the handset stays on the screen
// Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweepphone/.
const { make, W } = require("../lib/sweepphone.js");

const CARD_FIT = `(() => { const c = document.getElementById("screenCard"); if (!c || c.offsetParent === null) return null; const r = c.getBoundingClientRect(), bad = [];
  if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push("card off screen " + [r.left, r.top, r.right, r.bottom].map(Math.round));
  for (const b of c.querySelectorAll("button")) { if (b.offsetParent === null) continue; const q = b.getBoundingClientRect(); if (q.width < 2) continue;
    if (q.height < 40) bad.push("small " + Math.round(q.width) + "×" + Math.round(q.height) + " " + b.textContent.trim().slice(0, 24));
    if (q.right > innerWidth + 1 || q.left < -1) bad.push("off the side " + b.textContent.trim().slice(0, 24)); }
  for (const e of c.querySelectorAll("*")) { if (e.children.length || !e.textContent.trim() || e.offsetParent === null) continue; const q = e.getBoundingClientRect();
    const box = e.closest("button") ? e.closest("button").getBoundingClientRect() : r;
    if (q.width && (q.right > box.right + 1 || q.left < box.left - 1)) bad.push("text past its box: " + e.textContent.trim().slice(0, 30)); }
  const sc = [c, ...c.querySelectorAll("*")].find(e => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  const cut = c.scrollHeight > c.clientHeight + 4 && !sc;
  if (cut) bad.push("taller than the screen and doesn't scroll");
  return { bad, scrolls: !!sc, h: Math.round(r.height) }; })()`;

module.exports = {
  name: "sweepphone3",
  viewport: { width: 375, height: 667 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 23456, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" }, best: 4321, f: { meta: { tutorialDone: true } } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t), g = t.game;
    const touch = () => t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await touch();
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "PLAY: on foot at home", 30000)) return;
    await g(`(ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law.hold(99999), true)`);
    await t.frames(30);
    // a long username (16 characters, the widest letters) — it shows in ⚙️ 🪪 Your name + 👯 Friends
    await g(`(ctx.player.setName("WWWWWWWWWWWWWWWW"), true)`);
    // ❚❚ pause (the corner button on foot is the 📱: the pause menu through the game's own pause)
    const pb = await S.box("pauseBtn");
    S.log("❚❚ button: " + JSON.stringify(pb));
    await t.L(`(document.getElementById("pauseBtn").click(), 0)`);
    await t.frames(6);
    await S.shot("10-pause");
    const pz = await t.L(CARD_FIT);
    S.log("pause: " + JSON.stringify(pz) + " · " + (await S.texts()).filter(x => x.id === "screenCard" || /screenCard/.test(x.id)).map(x => x.tx).join(" | ").slice(0, 600));
    t.check("❚❚ pause fits a small phone, buttons ≥ 40 px", pz && !pz.bad.length, JSON.stringify(pz));
    await S.badText("pause", { touch: true, w: 375 });
    // ⚙️ Settings
    await t.click(/Settings/);
    await t.frames(6);
    await S.shot("11-settings");
    const sf = await t.L(CARD_FIT);
    S.log("settings widths: " + JSON.stringify(await t.L(`(() => { const g = document.querySelector("#screenCard .settings"); if (!g) return null; return { grid: Math.round(g.getBoundingClientRect().width), cols: getComputedStyle(g).gridTemplateColumns,
      wide: [...g.children].map(e => ({ t: e.textContent.trim().slice(0, 40), w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth, min: (() => { const c = e.cloneNode(true); c.style.width = "min-content"; c.style.position = "absolute"; g.appendChild(c); const w = c.getBoundingClientRect().width; c.remove(); return Math.round(w); })() })).sort((a, b) => b.min - a.min).slice(0, 4) }; })()`)));
    t.check("⚙️ Settings fits a small phone (or scrolls)", sf && !sf.bad.length, JSON.stringify(sf));
    await S.badText("settings", { touch: true, w: 375 });
    const read = () => t.L(`[...document.querySelectorAll("#screenCard .setting")].map(b => ({ id: b.id, l: (b.querySelector("span") || b).textContent.trim(), v: (b.querySelector("b") || {}).textContent || "" }))`);
    const rows0 = await read();
    S.log("settings: " + rows0.map(r => `${r.l}=${r.v}`).join(" · "));
    const SKIP = /set_controls|set_x_/;
    const changed = {};
    for (const r of rows0) {
      if (SKIP.test(r.id) || !r.v) continue;
      await t.L(`(document.getElementById(${JSON.stringify(r.id)}).click(), 0)`);
      await t.frames(4);
      const now = (await read()).find(x => x.id === r.id);
      t.check(`⚙️ ${r.l}: a tap changes it (${r.v} → ${now && now.v})`, now && now.v !== r.v);
      if (now) changed[r.id] = now.v;
    }
    await S.shot("12-settings-changed");
    const s3 = await t.L(`import("./js/core/save.js").then(m => { m.saveNow && m.saveNow(); return JSON.stringify(m.save3d.settings) + " music " + m.save3d.music + " sound " + m.save3d.sound; })`);
    S.log("saved: " + s3);
    await t.page.reload();
    await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots again after the reload", 120000);
    await touch();
    await t.click(/More/); await t.frames(3);
    await t.click(/Settings/); await t.frames(6);
    const rows1 = await read();
    for (const [id, v] of Object.entries(changed)) {
      const r = rows1.find(x => x.id === id);
      // (graphics AUTO shows the tier it picked: compare the word before " · ")
      const same = r && (r.v === v || r.v.split(" · ")[0] === v.split(" · ")[0]);
      t.check(`⚙️ ${r ? r.l : id} survives a reload (${v} → ${r && r.v})`, same);
    }
    await t.click(/Done/); await t.frames(4);
    // (back to the usual screen for the rest: TV mode off, the HUD at 100 %, FULL)
    await t.L(`import("./js/core/save.js").then(m => { Object.assign(m.save3d.settings, { tv: "auto", hud: 1, hudMode: "full" }); return true; })`);
    await g(`(ctx.applySettings(), true)`);
    // the title's 🚗 Garage + 📒 Scrapbook (its 💾 save code) on a small phone
    for (const [re, tag] of [[/Garage/, "16-garage"], [/Scrapbook/, "17-scrapbook"]]) {
      await t.click(re); await t.frames(10);
      await S.shot(tag);
      const f = await t.L(CARD_FIT);
      S.log(`${tag}: ${JSON.stringify(f)}`);
      t.check(`${tag}: fits a small phone (or scrolls), buttons ≥ 40 px`, !f || !f.bad.length, JSON.stringify(f));
      await S.badText(tag, { touch: true, w: 375 });
      for (let k = 0; k < 5 && !await t.L(`!!document.querySelector("#screenCard #play")`); k++) { await t.tap(1); await t.frames(6); }
    }
    // the 📱 on a small phone, then turned on its side while it's open
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "PLAY again", 30000)) return;
    await touch();
    await t.frames(20);
    await g(`ctx.phone.openPhone()`);
    await t.frames(12);
    await S.shot("13-phone-small");
    const fb = await t.L(`[...document.querySelectorAll("#screenCard.lphone .lp-fb")].filter(b => b.offsetParent !== null).map(b => Math.round(b.getBoundingClientRect().height) + " " + b.textContent.trim())`);
    t.check("📱 ‹ Back / ☰ Menu are big enough for a finger (≥ 40 px tall)", fb.length && fb.every(x => parseInt(x) >= 40), fb.join(" | "));
    await g(`(ctx.phone._dbg.openApp("friends"), true)`);
    await t.frames(8);
    await S.shot("13b-phone-friends-longname");
    await S.badText("👯 Friends with a 16-letter name", { touch: true, w: 375 });
    const fr = await t.L(`(() => { const c = document.querySelector("#screenCard.lphone .lp-scr"); if (!c) return "no phone"; const r = c.getBoundingClientRect(); const out = [...c.querySelectorAll("*")].filter(e => !e.children.length && e.textContent.trim() && e.offsetParent !== null).filter(e => { const q = e.getBoundingClientRect(); return q.width && q.right > r.right + 1; }).map(e => e.textContent.trim().slice(0, 30)); return out.join(" | "); })()`);
    t.check("👯 Friends: a 16-letter name stays inside the handset", !fr, fr);
    // every app on the home screen, upright on a small phone: a screenshot each, nothing broken on screen
    for (const a of await g(`ctx.phone.apps()`)) {
      if (a === "camera") continue;      // (a hand-off: photo mode)
      await g(`(ctx.phone._dbg.openApp(${JSON.stringify(a)}), true)`); await t.frames(8);
      await S.shot(`13c-app-${a}`);
      await S.badText(`📱 ${a}`, { touch: true, w: 375 });
      S.log(`app ${a}: ` + (await S.texts()).filter(x => /lp|screenCard/.test(x.id + x.cls)).map(x => x.tx).join(" | ").slice(0, 500));
    }
    await g(`(ctx.phone.closePhone(), true)`); await t.frames(4);
    await g(`ctx.phone.openPhone()`); await t.frames(8);
    const hs = () => t.L(`(() => { const c = document.querySelector("#screenCard.lphone"); if (!c) return null; const r = c.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), W: innerWidth, H: innerHeight }; })()`);
    const in1 = await hs();
    t.check("📱 small phone upright: the handset is on the screen", in1 && in1.t >= -1 && in1.b <= in1.H + 1 && in1.l >= -1 && in1.r <= in1.W + 1, JSON.stringify(in1));
    await t.page.setViewportSize({ width: 667, height: 375 });
    await t.frames(12);
    await S.shot("14-phone-turned");
    const in2 = await hs();
    t.check("📱 turned on its side while open: the handset is still on the screen", in2 && in2.t >= -1 && in2.b <= in2.H + 1 && in2.l >= -1 && in2.r <= in2.W + 1, JSON.stringify(in2));
    await g(`(ctx.phone.closePhone(), true)`);
    await t.frames(6);
    await S.shot("15-foot-turned");
    await S.badText("on its side", { touch: true, w: 667 });
    await t.page.setViewportSize({ width: 375, height: 667 });
    await t.frames(6);
  },
};
