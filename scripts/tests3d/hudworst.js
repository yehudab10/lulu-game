// 📏 HUD WORST CASE (ci/hud, 2026-11-26 — the owner's friend's Android, portrait, at night on the highway at 77 mph:
// a friends' 2× coins window + Ima's list + a chase with stars + a robbery to foil + a timed kugel delivery with its
// meters + BAIL + NITRO + the speedo + the phone's badge, all at once — "I think u can see the obvious issues").
// hudfit's other half (hudfit.js measures the busy-but-normal HUD in town); this one forces EVERY chip that can exist at
// once, at every phone size, and holds the play HUD to its layout contract (3d/ARCHITECTURE.md › UI › The play HUD's
// layout contract, hud.js › LAYOUT):
//   • no two HUD pieces (chips, badges, meters, touch buttons, the speedo, the pills) overlap, all on screen;
//   • the CLEAR WINDOW around the car and the road ahead (H.clearWindow()) has no persistent HUD in it;
//   • at most ONE full objective chip (the rest are icon badges on the same line);
//   • no text is cut off with "…" (no element whose text overflows its box).
// `--shots` saves each size; the before/after pictures for the owner are in 3d/docs/hud/.
const VIEWS = [
  // name, width, height, TV mode, device
  ["p360", 360, 800, false, "touch"],
  ["p390", 390, 844, false, "touch"],
  ["p412", 412, 915, false, "touch"],
  ["p430", 430, 932, false, "touch"],
  ["l800", 800, 360, false, "touch"],
  ["l844", 844, 390, false, "touch"],
  ["l932", 932, 430, false, "touch"],
  ["tablet", 768, 1024, false, "touch"],
  ["tablet-pad", 768, 1024, false, "gamepad"],
  ["desktop", 1280, 720, false, "keyboard"],
  ["tv-720", 1280, 720, true, "gamepad"],
  ["tv-1080", 1920, 1080, true, "gamepad"],
];
const ONLY = process.env.HUDFIT_VIEWS ? process.env.HUDFIT_VIEWS.split(",") : null;
const BEFORE = !!process.env.HUDWORST_BEFORE;      // (only the pictures: the "before" run on the old HUD)

/** Every persistent HUD piece, by group → selector (pieces of one group are laid out by one stack: never counted against
 *  each other). Touch buttons are pieces too: no chip may sit under a thumb. */
const PIECES = {
  pills: "#hud .hud-tl .pill", trip: "#hud .trip", tripLabel: "#tripLabel", pause: "#pauseBtn", phone: "#phoneBtn",
  obj: "#objLine > *", left: "#slot-left > *", center: "#slot-center > *:not(#banner):not(#objLine)", right: "#slot-right > *",
  speedo: "#hud .speedo", prompt: "#slot-bottom .prompt", bubble: "#banterBubbles .bn-lulu:not(.hide) .bn-in",
  stick: "#stickBase", pedals: "#touch .pedals .tbtn", extra: "#touchExtra button",
};
/** The persistent HUD that must stay out of the clear window (touch buttons sit in the bands / side columns by design). */
const PERSIST = ["pills", "trip", "tripLabel", "obj", "left", "center", "right", "speedo", "extra", "pedals", "stick", "bubble"];
const measure = t => t.L(`(() => { const P = ${JSON.stringify(PIECES)}, W = innerWidth, H = innerHeight, out = [];
    const hidden = e => { for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.1 || n.classList.contains("hidden") || n.classList.contains("calm-off")) return true; } return false; };
    for (const [g, sel] of Object.entries(P)) for (const e of document.querySelectorAll(sel)) {
      if (hidden(e) || e.classList.contains("out")) continue;
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const txt = (e.textContent || "").trim().replace(/\\s+/g, " ");
      out.push({ g, n: (e.id || (e.className || e.tagName).toString().split(" ")[0]) + (txt ? ":" + txt.slice(0, 16) : ""), l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    const pairs = [], off = [];
    for (const a of out) if (a.l < -2 || a.t < -2 || a.r > W + 2 || a.b > H + 2) off.push(a.g + ":" + a.n);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const a = out[i], b = out[j];
      if (a.g === b.g) continue;
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > 2 && oy > 2) pairs.push(a.g + ":" + a.n + " × " + b.g + ":" + b.n + " (" + Math.round(ox) + "×" + Math.round(oy) + ")"); }
    // the clear window (screen fractions → px)
    const cw = window.__lulu3d && __lulu3d.H.clearWindow ? __lulu3d.H.clearWindow() : null, inWin = [];
    if (cw) { const x0 = cw.x0 * W, x1 = cw.x1 * W, y0 = cw.y0 * H, y1 = cw.y1 * H;
      for (const a of out) if (${JSON.stringify(PERSIST)}.includes(a.g) && Math.min(a.r, x1) - Math.max(a.l, x0) > 2 && Math.min(a.b, y1) - Math.max(a.t, y0) > 2) inWin.push(a.g + ":" + a.n); }
    // full objective chips: what's on the objective line's main spot + any registered chip still shown full-size elsewhere
    const full = [...document.querySelectorAll("[data-obj]")].filter(e => !hidden(e) && !e.classList.contains("obj-folded") && e.getBoundingClientRect().height > 4).map(e => e.dataset.obj);
    // text cut off: any shown element in the HUD whose own text overflows its box, or that ends in "…"
    const cut = [];
    for (const e of document.querySelectorAll("#hud *, #touch *")) {
      if (!e.childNodes.length || hidden(e)) continue;
      const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim();
      if (!own) continue;
      const cs = getComputedStyle(e);
      if (/…$/.test(own) && !/(SEARCHING|THEM|calling)/i.test(own)) cut.push("… " + own.slice(-24));
      else if ((cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && e.scrollWidth > e.clientWidth + 2) cut.push("overflow " + own.slice(0, 24));
    }
    return { pairs, off, inWin, full, cut, cw, groups: [...new Set(out.map(a => a.g))], touch: document.body.classList.contains("touch") }; })()`);

async function device(t, d) {
  if (d === "touch") await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
  else if (d === "keyboard") await t.L(`(window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" })), 0)`);
  else await t.L(`(() => { const e = new Event("gamepadconnected"); e.gamepad = window.__pad; window.dispatchEvent(e); return 0; })()`);
}

/** Everything at once (the owner's screenshot): each through the feature's own code, so the real chips show. */
async function worstCase(t) {
  const g = t.game;
  // 👥 a friends' 2× coins window (a passenger's bonus), 30 s
  await t.L(`import("./js/features/roadevents/passengers.js").then(m => { m.seat.t = 30; return true; })`);
  // 📝 Ima's list with its longest line (it's date-seeded: pin the longest so this never passes by the calendar)
  await g(`(() => { if (!ctx.day || !ctx.day.debug) return false; if (!ctx.day.active && ctx.day.debug.activate) ctx.day.debug.activate();
    const all = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.id && o.text) all.push(o); else Object.values(o).forEach(walk); } })(ctx.day.ITEMS);
    all.sort((a, b) => (b.icon + b.text).length - (a.icon + a.text).length); const D = ctx.day.debug.DAY; D.list = [all[0].id, ...D.list.filter(i => i !== all[0].id).slice(0, 2)]; D.prog = {}; return true; })()`);
  // 🦹 a robbery to foil (staged before the chase: a chase holds new robberies back), its getaway chip
  // (the getaway car drives off without traffic around it — the chip itself is what's measured: keep the real one up)
  await t.L(`Promise.all([import("./js/features/heist/common.js"), import("./js/core/ctx.js")]).then(([m, C]) => { const L = window.__lulu3d; if (!window.__hwRob) { window.__hwRob = true;
    C.hook("hud", () => { if (!L.ctx.heist.robbery) m.setChip("🦹 STOP THE GETAWAY CAR", "💥 ram 0/3 · PIT it · box it in · 140 m", 0.55, "#FF4081"); }); } return true; })`);
  // 🥔 a timed delivery with its meters (the kugel)
  if (!await g(`!!ctx.hustle.job`)) await g(`(ctx.hustle.start("delivery", { via: "test", food: "kugel", intro: false, force: true }), true)`);
  // 🚨 a chase with stars, the cops searching (LOSING THEM…)
  if (!await g(`ctx.law.chasing`)) await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("SPEEDING", { heat: 1 }), true)`);
  // 📍 a ping (features/pins: the objective line's lowest slot — the longest name, in the other town)
  await g(`(ctx.pins && ctx.pins.ping("lakewood:clothes"), true)`);
  // 📱 a badge on the phone
  await g(`(() => { const d = document.querySelector("#phoneBtn .lp-dot"); if (d) { d.textContent = "9"; d.classList.add("on"); } return true; })()`);
}

module.exports = {
  name: "hudworst",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 162, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "PLAY: starts on foot at home", 20000)) return;
    await g(`(ctx.atmos.debug.time("night"), ctx.atmos.debug.freeze(true), true)`);
    await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`);
    if (!await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "in the car", 20000)) return;
    if (await g(`ctx.town.active`)) { await g(`ctx.town.leave("quiet")`); await t.until(`!__lulu3d.ctx.town.active`, "on the highway", 30000); }
    await g(`(ctx.traffic.config.enabled = false, ctx.roadevents.auto = false, ctx.roadevents.autopilot = { d: 1.75, speed: 34.4 }, true)`);
    await t.frames(60);
    await worstCase(t);
    await t.frames(40);
    const setSave = code => t.L(`import("./js/core/save.js").then(m => { ${code} })`);
    for (const [name, w, h, tv, d] of VIEWS) {
      if (ONLY && !ONLY.includes(name)) continue;
      await t.page.setViewportSize({ width: w, height: h });
      await setSave(`m.save3d.settings.tv = ${tv ? '"on"' : '"off"'};`);
      await g(`(ctx.applySettings(), true)`);
      await device(t, d);
      await worstCase(t);
      // (a phone: + Lulu says a long line — her bubble docks outside the clear window, or waits; bigger screens keep it by her head)
      const phoneSize = /^[pl]\d/.test(name);
      await t.L(`import("./js/features/banter/bubbles.js").then(m => { ${phoneSize ? `m.showLulu("Amber lights. Somebody's getting a jump start.", 99)` : "m.hideLulu()"}; return true; })`);
      await t.frames(12);
      const live = await g(`({ day: !!(ctx.day && ctx.day.active), rob: !!document.querySelector(".heist-chip.on"), job: !!ctx.hustle.job, chase: !!ctx.law.chasing, pass: ctx.roadevents.passengerTime > 0, state: L3.state })`);
      const m = await measure(t);
      const where = `${name} (${w}×${h}${tv ? " TV" : ""}, ${d})`;
      t.check(`${where}: the worst case is on (Ima's list, a robbery, a timed job, a chase, 2× coins)`, live.day && live.rob && live.job && live.chase && live.pass, JSON.stringify(live));
      await t.shot(`${BEFORE ? "before" : "after"}-${name}`);
      if (BEFORE) { console.log(`  ${where}: overlaps ${m.pairs.length} · in the clear window ${m.inWin.length} · full chips ${m.full.length} · cut ${m.cut.length}\n    ` + m.pairs.concat(m.inWin.map(x => "WIN " + x), m.cut.map(x => "CUT " + x)).join("\n    ")); continue; }
      t.check(`${where}: the ${d === "touch" ? "touch" : "no-touch"} layout`, d === "touch" ? m.touch : !m.touch);
      t.check(`${where}: no two HUD pieces on top of each other, all on screen`, !m.pairs.length && !m.off.length, m.pairs.concat(m.off.map(o => "off-screen " + o)).join(" | "));
      t.check(`${where}: the clear window around the car is empty`, !!m.cw && !m.inWin.length, JSON.stringify(m.cw) + " " + m.inWin.join(" | "));
      const maxFull = w * h >= 1280 * 700 ? 3 : w >= 700 && h >= 700 ? 2 : 1;
      t.check(`${where}: at most ${maxFull} full objective chip${maxFull > 1 ? "s" : ""} (the rest are badges)`, m.full.length <= maxFull, m.full.join(","));
      t.check(`${where}: no text cut off with "…"`, !m.cut.length, m.cut.join(" | "));
    }
    await t.L(`import("./js/features/banter/bubbles.js").then(m => { m.hideLulu(); return true; })`);
    await t.page.setViewportSize({ width: 412, height: 915 });
    await setSave(`m.save3d.settings.tv = "off";`);
    await g(`(ctx.applySettings(), true)`);
  },
};
