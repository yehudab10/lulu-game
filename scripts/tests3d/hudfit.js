// 📏 HUD FIT (ci/hudfit, 2026-11-21): nothing important on the HUD sits on anything else, at the real screen sizes —
// a phone held upright (390 × 844) and on its side (844 × 390), a small phone (375 × 667 and 667 × 375), a tablet (768 × 1024), each
// with fingers AND with a controller (no touch layout), a laptop (1280 × 720, keyboard) and a TV at 720p / 1080p.
// In Lakewood, driving and on foot, with the HUD at its busiest: a 5-digit score, 📝 Ima's list, the ON FOOT chip,
// a 💬 text card, the ⏭ SKIP pill (a cutscene), the town's "WELCOME TO …" banner, a ✋ prompt and the controller's bottom hint.
// The cases the weekend QA sweep found (each a named check below, by element-rect intersection):
//   1. phone landscape on foot: the WALK stick's base over the 📝 / ON FOOT chips
//   2. ⏭ SKIP over the trip label ("🏙️ Route 9 · LAKEWOOD") on a phone held upright
//   3. a controller on a narrow portrait screen: the bottom prompt / hint on the speedo
//   4. the "WELCOME TO …" banner over the 📝 chip
// + every other pair of the named HUD pieces (none on top of another, all on screen) — and the same for the 🅿️ Parking
//   Challenge's HUD on a rest area's lot (its chip, its prompt line, the level banner).
const VIEWS = [
  // name, width, height, TV mode, device
  ["phone", 390, 844, false, "touch"],
  ["phone-land", 844, 390, false, "touch"],
  ["small-land", 667, 375, false, "touch"],
  ["small", 375, 667, false, "touch"],
  ["tablet", 768, 1024, false, "touch"],
  ["phone-pad", 390, 844, false, "gamepad"],
  ["small-pad", 375, 667, false, "gamepad"],
  ["tablet-pad", 768, 1024, false, "gamepad"],
  ["desktop", 1280, 720, false, "keyboard"],
  ["tv-720", 1280, 720, true, "gamepad"],
  ["tv-1080", 1920, 1080, true, "gamepad"],
];
const ONLY = process.env.HUDFIT_VIEWS ? process.env.HUDFIT_VIEWS.split(",") : null;

/** The HUD's pieces, by name → selector. Pieces of one group never count against each other (a stack lays them out). */
const PIECES = {
  pills: "#hud .hud-tl .pill", trip: "#hud .trip", tripLabel: "#tripLabel", pause: "#pauseBtn", phone: "#phoneBtn",
  left: "#slot-left > *", center: "#slot-center > *:not(#banner)", banner: "#banner", right: "#slot-right > *",
  speedo: "#hud .speedo", skip: "#skipBtn", prompt: "#slot-bottom .prompt", padHint: "#padHint",
  stick: "#stickBase", pedals: "#touch .pedals .tbtn", footPad: "#footPad .tbtn", extra: "#touchExtra button",
};
const measure = t => t.L(`(() => { const P = ${JSON.stringify(PIECES)}, W = innerWidth, H = innerHeight, out = [];
    for (const [g, sel] of Object.entries(P)) for (const e of document.querySelectorAll(sel)) {
      let hid = false; for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.1 || n.classList.contains("hidden") || n.classList.contains("calm-off")) { hid = true; break; } }
      if (hid || e.classList.contains("out")) continue;      // (a card on its way out slides off the edge: not a layout spot)
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const txt = (e.textContent || "").trim();
      out.push({ g, n: (e.id || (e.className || e.tagName).toString().split(" ")[0]) + (txt ? ":" + txt.slice(0, 14) : ""), l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    const pairs = [], off = [];
    for (const a of out) if (a.l < -2 || a.t < -2 || a.r > W + 2 || a.b > H + 2) off.push(a.g + ":" + a.n);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const a = out[i], b = out[j];
      if (a.g === b.g) continue;
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > 2 && oy > 2) pairs.push({ a: a.g, b: b.g, txt: a.n + " × " + b.n + " (" + Math.round(ox) + "×" + Math.round(oy) + ")" }); }
    return { pairs, off, groups: [...new Set(out.map(a => a.g))], touch: document.body.classList.contains("touch") }; })()`);
/** Do pieces of group a and group b overlap? (→ the clashes, as text) */
const clash = (m, a, b) => m.pairs.filter(p => (p.a === a && p.b === b) || (p.a === b && p.b === a)).map(p => p.txt);

async function inTown(t, town) {
  const g = t.game;
  if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
  await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.load("${town}"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town}'s models load`, 120000);
  await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
  const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "${town}"`, `in ${town}`, 60000);
  await t.frames(10);
  return ok;
}
async function onFoot(t) {
  if (await t.game(`ctx.foot.active && L3.state === "footRun"`)) return true;
  await t.game(`ctx.foot.start("droveOff", { noIntro: true })`);
  return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000);
}
async function inCar(t) {
  if (await t.game(`ctx.foot.active`)) await t.game(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`);
  return t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "back in the car", 20000);
}
async function device(t, d) {
  if (d === "touch") await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
  else if (d === "keyboard") await t.L(`(window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" })), 0)`);
  else await t.L(`(() => { const e = new Event("gamepadconnected"); e.gamepad = window.__pad; window.dispatchEvent(e); return 0; })()`);
}
/** The HUD at its busiest: a 5-digit score, ⏭ SKIP, the town's welcome banner, a ✋ prompt, the controller's hint. */
async function busiest(t, d, foot) {
  const g = t.game;
  const hint = d === "touch" ? "" : foot ? "Ⓐ near your car to hop back in 🚗 · or take a walk" : "Ⓡ gas · Ⓛ brake · Ⓑ drift · RB nitro · Ⓧ horn · Ⓨ camera";
  await g(`(ctx.G.score = Math.max(ctx.G.score || 0, 12345), ctx.G.hint = ${JSON.stringify(hint)}, ctx.cutscene.begin("hudfit"), true)`);
  await g(`(() => { const H = L3.H, S = ["WELCOME TO LAKEWOOD", "Pop.: Yes", "Est. traffic: always"];
    H.hideBanner(); H.banner("<b>🏙️ " + S[0] + "</b><small>" + S.slice(1).join(" · ") + "</small>", 0, { key: "town", prio: 2 }); return true; })()`);
  // exactly one 💬 text card in the left column (a town's gossip / Bubbe's text arrives on its own at random times)
  await g(`(() => { document.querySelectorAll("#slot-left .jtext").forEach(e => e.remove());
    window.__hfText = ctx.phone.text({ from: "BUBBE", emoji: "👵", color: "#E91E63", msg: "Lakewood?! What did you do wrong?", dur: 900 });
    window.__hfText.style.animation = "none"; return true; })()`);      // (its 0.3 s slide-in from the left isn't over in 14 fast frames: measure it where it lands)
  await g(`(L3.H.prompt("✋ <b>Talk to Heshy</b>"), true)`);
  await t.frames(14);
  // (again right before measuring: a feature's own prompt this frame would have replaced ours; it fits itself at once)
  await g(`(L3.H.prompt("✋ <b>Talk to Heshy</b>"), true)`);
}
async function calm(t) {
  await t.game(`(ctx.cutscene.end("hudfit"), ctx.G.hint = "", L3.H.hideBanner(), L3.H.prompt(""), window.__hfText && window.__hfText.remove(), true)`);
}

module.exports = {
  name: "hudfit",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "PLAY: starts on foot at home", 20000)) return;
    await g(`(ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law.hold(99999), ctx.hustle && ctx.hustle.hold && ctx.hustle.hold(1e6), true)`);
    await inCar(t);
    if (!await inTown(t, "lakewood")) return;
    await g(`(ctx.traffic.config.enabled = false, true)`);
    await t.frames(30);
    const hasDay = await t.L(`!!document.querySelector("#slot-left .day-chip")`);
    t.check("📝 Ima's list is on the HUD (the chip the layout has to make room for)", hasDay);
    const setSave = code => t.L(`import("./js/core/save.js").then(m => { ${code} })`);
    for (const [name, w, h, tv, d] of VIEWS) {
      if (ONLY && !ONLY.includes(name)) continue;
      await t.page.setViewportSize({ width: w, height: h });
      await setSave(`m.save3d.settings.tv = ${tv ? '"on"' : '"off"'};`);
      await g(`(ctx.applySettings(), true)`);
      for (const foot of [false, true]) {
        if (foot) await onFoot(t); else await inCar(t);
        await device(t, d);
        await t.frames(4);
        await busiest(t, d, foot);
        const m = await measure(t);
        const where = `${name} (${w}×${h}${tv ? " TV" : ""}, ${d}), ${foot ? "on foot" : "driving"}`;
        const touchOk = d === "touch" ? m.touch : !m.touch;
        t.check(`${where}: the ${d === "touch" ? "touch" : "no-touch"} layout`, touchOk, m.groups.join(","));
        // the four cases the QA sweep found, named
        if (d === "touch" && foot) t.check(`${where}: the WALK stick is clear of the 📝 / ON FOOT chips`, clash(m, "stick", "left").length === 0, clash(m, "stick", "left").join(" | "));
        t.check(`${where}: ⏭ SKIP is clear of the trip bar + its label`, clash(m, "skip", "tripLabel").length + clash(m, "skip", "trip").length === 0, clash(m, "skip", "tripLabel").concat(clash(m, "skip", "trip")).join(" | "));
        if (!foot) t.check(`${where}: the bottom prompt + hint are clear of the speedo`, clash(m, "prompt", "speedo").length + clash(m, "padHint", "speedo").length === 0, clash(m, "prompt", "speedo").concat(clash(m, "padHint", "speedo")).join(" | "));
        t.check(`${where}: the WELCOME banner is clear of the 📝 chip (+ the other chips)`, ["left", "right", "trip", "tripLabel", "pills"].every(x => !clash(m, "banner", x).length), ["left", "right", "trip", "tripLabel", "pills"].flatMap(x => clash(m, "banner", x)).join(" | "));
        // …and nothing else on anything else
        t.check(`${where}: no two HUD pieces on top of each other, all on screen`, !m.pairs.length && !m.off.length, m.pairs.map(p => p.txt).concat(m.off.map(o => "off-screen " + o)).join(" | "));
        await t.shot(`${name}-${foot ? "foot" : "car"}`);
        await calm(t);
      }
    }
    // ⚙️ HUD: Clean (no score, a slim trip bar) on the phone layouts — the same rules
    await setSave(`m.save3d.settings.tv = "off"; m.save3d.settings.hudMode = "clean";`);
    for (const [name, w, h, , d] of VIEWS.filter(v => /^(phone|phone-land|phone-pad)$/.test(v[0]) && (!ONLY || ONLY.includes(v[0])))) {
      await t.page.setViewportSize({ width: w, height: h });
      await g(`(ctx.applySettings(), true)`);
      for (const foot of [false, true]) {
        if (foot) await onFoot(t); else await inCar(t);
        await device(t, d);
        await t.frames(4);
        await busiest(t, d, foot);
        const m = await measure(t);
        t.check(`Clean HUD, ${name} (${d}), ${foot ? "on foot" : "driving"}: no two HUD pieces on top of each other, all on screen`, !m.pairs.length && !m.off.length, m.pairs.map(p => p.txt).concat(m.off.map(o => "off-screen " + o)).join(" | "));
        await t.shot(`clean-${name}-${foot ? "foot" : "car"}`);
        await calm(t);
      }
    }
    await t.page.setViewportSize({ width: 390, height: 844 });
    await setSave(`m.save3d.settings.tv = "off"; m.save3d.settings.hudMode = "full";`);
    await g(`(ctx.applySettings(), true)`);

    // 🅿️ the Parking Challenge on a rest area's lot: its chip (level · lives · stars · coins · the clock), its prompt
    // line and the level banner on the regular HUD — the same rules at every size
    await inCar(t);
    if (await g(`ctx.town.active`)) { await g(`ctx.town.leave("quiet")`); await t.until(`!__lulu3d.ctx.town.active`, "back on the highway", 20000); }
    await setSave(`m.shared.update(s => { s.parkingUnlocked = true; });`);
    await g(`ctx.exits.debug.restAhead(320)`);
    if (!await t.until(`__lulu3d.ctx.parking.debug.courses().length > 0`, "a rest area's 🅿️ course", 30000)) return;
    await g(`ctx.parking.debug.toBox()`);
    if (!await t.until(`__lulu3d.state === "parking" && __lulu3d.ctx.parking._debug.phase === "drive"`, "the challenge's level 1", 30000)) return;
    for (const [name, w, h, tv, d] of VIEWS) {
      if (ONLY && !ONLY.includes(name)) continue;
      await t.page.setViewportSize({ width: w, height: h });
      await setSave(`m.save3d.settings.tv = ${tv ? '"on"' : '"off"'};`);
      await g(`(ctx.applySettings(), ctx.parking._debug.timeLeft = 50, ctx.G.score = Math.max(ctx.G.score || 0, 12345), true)`);
      await device(t, d);
      await g(`(() => { const S = ctx.parking._debug; L3.H.banner("<b>🅿️ " + S.introTitle + "</b><small>" + S.introDetails + "</small>", 0, { key: "parking:intro" }); return true; })()`);
      await t.frames(8);
      const m = await measure(t);
      const where = `🅿️ Parking Challenge, ${name} (${w}×${h}${tv ? " TV" : ""}, ${d})`;
      t.check(`${where}: the challenge's chip is on the HUD`, m.groups.includes("left") && await t.L(`!!document.querySelector("#slot-left .park-chip")`));
      t.check(`${where}: no two HUD pieces on top of each other, all on screen`, !m.pairs.length && !m.off.length, m.pairs.map(p => p.txt).concat(m.off.map(o => "off-screen " + o)).join(" | "));
      await t.shot(`parking-${name}`);
      await g(`(L3.H.hideBanner(), true)`);
    }
    await g(`ctx.parking.debug.endRun("quit")`);
    await t.page.setViewportSize({ width: 390, height: 844 });
    await setSave(`m.save3d.settings.tv = "off";`);
    await g(`(ctx.applySettings(), true)`);
  },
};
