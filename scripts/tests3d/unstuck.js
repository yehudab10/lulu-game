// 🆘 "I'M STUCK" (features/unstuck): force each stuck case and check she lands on a SURELY normal spot — on a lane / a
// sidewalk / a shoulder / a lot / a room's door spot, clear of everything — with nothing else changed (coins, hearts, a
// chase, a job's clock), the button reachable (❚❚ / Options / the touch ❚❚ that appears when the HUD is hidden), the
// automatic rescue firing for the obvious cases (NaN, off the edge, inside a solid, in the lake) and NOT in a normal
// 3,000-frame monkey run in each place; the watchdog (scripts/lib/qawatch.js) reports nothing afterwards.
// The passenger case (two pages) is `unstuck2`.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "unstuck",
  query: "&enable=all,unstuck",
  save2d: { totalCoins: 600, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds = ["nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "inside", "invisible"]) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const log = () => g(`ctx.unstuck.debug.U.log.slice()`);
    const nLog = async () => (await log()).length;
    const ready = () => g(`(ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.debug.U.autoLast = -1e9, true)`);
    const purse = () => g(`({ coins: ctx.G.coins, hearts: ctx.G.hearts, wallet: (window.__lulu3d.wallet || {}).coins })`);
    // the player's way: Options (pad) / ❚❚ (touch) / the touch ❚❚ the hatch shows → 🆘 → "get me out"
    const press = async (label, { via = "pad", go = "unstuckGo", expect = true, none = false } = {}) => {
      if (via === "pad") await t.tap(9);
      else if (via === "touch") await t.L(`document.getElementById("pauseBtn").click()`);
      else if (via === "hatch") await t.L(`document.getElementById("unstuckPause").click()`);
      else if (via === "key") await t.key("Escape");
      if (!await t.until(`__lulu3d.ctx.paused`, `${label}: the pause menu opens (${via})`, 3000)) return false;
      const has = await t.L(`!!document.querySelector('#screenCard [data-pi="unstuck"]')`);
      t.check(`${label}: 🆘 I'm stuck is in the pause menu`, has === expect, `${has} (state ${await g(`L3.state`)})`);
      if (!has) { await t.L(`document.querySelector('#screenCard [data-pi="resume"]').click()`); await t.frames(3); return false; }
      await t.L(`document.querySelector('#screenCard [data-pi="unstuck"]').click()`);
      await t.frames(2);
      // the menu card sits above every fade: the button under its own centre is the button
      const top = await t.L(`(() => { const b = document.getElementById("${go}") || document.getElementById("unstuckBack"); if (!b) return "no button"; const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === b || b.contains(e) ? "ok" : (e ? (e.id || e.tagName) : "nothing"); })()`);
      t.check(`${label}: the 🆘 card is on top (clickable)`, top === "ok", top);
      if (none) {
        const why = await t.L(`(() => { const c = document.getElementById("screenCard"); return { go: !!document.getElementById("unstuckGo"), text: c ? c.textContent : "" }; })()`);
        t.check(`${label}: no way through, says why`, !why.go && /moment|again in/i.test(why.text), JSON.stringify(why));
        await t.L(`document.getElementById("unstuckBack").click()`); await t.frames(2);
        await t.L(`(() => { const b = document.querySelector('#screenCard [data-pi="resume"]'); if (b) b.click(); })()`); await t.frames(3);
        return false;
      }
      const ok = await t.L(`(() => { const b = document.getElementById("${go}"); if (b) b.click(); return !!b; })()`);
      t.check(`${label}: the card's "${go}"`, ok);
      if (!ok) { await t.L(`(() => { const b = document.getElementById("unstuckBack"); if (b) b.click(); })()`); await t.frames(2); await t.L(`(() => { const b = document.querySelector('#screenCard [data-pi="resume"]'); if (b) b.click(); })()`); }
      await t.frames(10);
      await W.reset(t);       // (the test's own teleport into the solid is behind us: watch from here)
      return ok;
    };
    const carAt = () => g(`(() => { const c = ctx.car; return { why: ctx.unstuck.normal(c.pos.x, c.pos.z, "car"), s: +c.s.toFixed(1), d: +c.d.toFixed(2), v: +c.speed.toFixed(2), y: +c.pos.y.toFixed(2), x: c.pos.x, z: c.pos.z,
      pitch: c.pitch, roll: c.roll, town: !!ctx.town.active, state: L3.state, paved: (L3.pavedAt || (() => -1))(c.s, c.d), soft: !!ctx.G.invSoft }; })()`);
    const footAt = () => g(`(() => { const F = ctx.foot.debug.F; if (!F) return { state: L3.state }; return { why: ctx.unstuck.normal(F.pos.x, F.pos.z, "foot"), s: +F.s.toFixed(1), d: +F.d.toFixed(2), y: +(F.y || 0).toFixed(2), x: F.pos.x, z: F.pos.z, phase: F.phase, state: L3.state }; })()`);
    const LANES = [1.75, 5.25, -1.75, -5.25];
    const carOK = async (label, from, { lanes = true } = {}) => {
      const c = await carAt();
      const lane = c.town ? Math.abs(Math.abs(c.d) - 1.75) < 0.3 : LANES.some(l => Math.abs(l - c.d) < 0.3);
      t.check(`${label}: she's in the car, on a clear spot`, c.state === "playing" && c.why == null, JSON.stringify(c));
      if (lanes) t.check(`${label}: …on a lane (d ${c.d})`, lane, JSON.stringify(c));
      t.check(`${label}: …upright and still`, c.v < 0.5 && Math.abs(c.y) < 0.2 && !c.pitch && !c.roll, JSON.stringify(c));
      if (from) t.check(`${label}: …near where she was (≤ 90 m)`, Math.hypot(c.x - from.x, c.z - from.z) <= 90, Math.hypot(c.x - from.x, c.z - from.z).toFixed(1));
      t.check(`${label}: …a courtesy shield`, c.soft);
      return c;
    };
    const footOK = async (label, from) => {
      const f = await footAt();
      t.check(`${label}: on her feet, on a clear spot`, f.state === "footRun" && f.phase === "walk" && f.why == null, JSON.stringify(f));
      if (from) t.check(`${label}: …near where she was (≤ 90 m)`, Math.hypot(f.x - from.x, f.z - from.z) <= 90, Math.hypot(f.x - from.x, f.z - from.z).toFixed(1));
      return f;
    };
    const onFoot = async () => {
      if (await g(`L3.state === "footRun"`)) return true;
      await g(`(ctx.foot.start("droveOff"), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    };
    const backIn = async () => {
      if (await g(`L3.state === "hustleResult"`)) { await t.L(`(() => { const b = document.getElementById("hsKeep"); if (b) b.click(); return true; })()`); await t.frames(10); }
      if (await g(`L3.state === "interior"`)) { await g(`(window.__interiors.room && window.__interiors.room.finishLeave(), true)`); await t.frames(10); }
      if (await g(`L3.state === "playing"`)) return true;
      await g(`ctx.foot.debug.getIn()`);
      return t.until(`__lulu3d.state === "playing"`, "back in the car", 5000);
    };
    // the nearest solid circle (r ≥ min, not a low thing) to (x, z) — a house, a tree, a sign…
    const solidNear = (min = 1, kinds = null) => g(`(() => { const p = ctx.state === "footRun" && ctx.foot.debug.F ? ctx.foot.debug.F.pos : ctx.car.pos; let best = null, bd = 1e9;
      for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders || []) { if (c.off || c.r < ${min} || ctx.foot.LOW[c.kind] || c.kind === "car" ${kinds ? `|| !${JSON.stringify(kinds)}.includes(c.kind)` : ""}) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd && d > 3) { bd = d; best = { x: c.x, z: c.z, r: c.r, kind: c.kind, d }; } } return best; })()`);
    const putCar = async (x, z, h = null) => { await W.moved(t); return g(`(() => { const c = ctx.car, h = ${h == null ? "c.h" : h}; c.place(${x}, ${z}, h); const n = ctx.world.road.nearest(c.pos.x, c.pos.z, c.s, {}); c.s = n.s; c.d = n.d; ctx.cam.snap(); return true; })()`); };
    const putFoot = async (x, z, y = 0) => { await W.moved(t); return g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${x}, 0, ${z}); F.y = ${y}; F.vel.set(0, 0, 0); F.lulu.obj.position.copy(F.pos); ctx.cam.snap(); return true; })()`); };
    const autoFired = async (n0, kind, label, ms = 6000) => {
      const ok = await t.until(`__lulu3d.ctx.unstuck.debug.U.log.length > ${n0}`, `${label}: the automatic rescue fires`, ms);
      const last = (await log()).slice(-1)[0];
      if (ok) t.check(`${label}: …for "${kind}"`, last && last.auto === kind, JSON.stringify(last));
      await t.frames(8);
      await W.reset(t);
      return ok;
    };
    const monkey = async (frames, seed) => {
      let r = seed;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let f = 0; f < frames; f += 6) {
        await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1.2).toFixed(2)}, __pad.axes[2] = ${rnd() < 0.3 ? (rnd() * 2 - 1).toFixed(2) : 0}, true)`);
        const b = [2, 3, 7, 7, 6, null, null, null][Math.floor(rnd() * 8)];     // (no ✕: wandering into rooms is another test's)
        if (b != null) await t.L(`__btn(${b}, 1)`);
        await t.frames(3);
        if (b != null) await t.L(`__btn(${b}, 0)`);
        await t.frames(3);
      }
      await t.L(`(__pad.axes[0] = __pad.axes[1] = __pad.axes[2] = __pad.axes[3] = 0, true)`);
    };
    // 3,000 frames of a player mashing about (half in the car, half on foot): no automatic rescue may fire
    const noFalse = async (label, seed) => {
      const n0 = await nLog();
      await g(`(ctx.G.hearts = 99, ctx.G.maxHearts = 99, true)`);      // (a monkey crashes: stay in this place)
      await backIn();
      await t.hold(7, 0.6); await monkey(1500, seed); await t.hold(7, 0);
      if (await g(`L3.state === "playing"`) && await onFoot()) await monkey(1500, seed + 7);
      const extra = (await log()).slice(n0);
      t.check(`${label}: a 3,000-frame monkey run — no automatic rescue`, extra.length === 0, JSON.stringify(extra));
      await g(`(ctx.G.maxHearts = 3, ctx.G.hearts = 3, true)`);
      await backIn();
    };

    // ═══ the highway ═══
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.law.hold && ctx.law.hold(1e6), true)`);
    await t.frames(20);
    t.check("the service is up", await g(`!!ctx.unstuck && typeof ctx.unstuck.now === "function"`));
    await W.reset(t);

    // 1 · the car into something solid by the road
    let sol = await solidNear(1);
    if (t.check("a solid thing by the highway", !!sol, JSON.stringify(sol))) {
      const p0 = await purse(), from = { x: sol.x, z: sol.z };
      await putCar(sol.x, sol.z);
      await t.frames(3);
      await ready();
      if (await press("highway: the car in a " + sol.kind)) {
        await carOK("highway: the car in a " + sol.kind, from);
        const p1 = await purse();
        t.check("highway: coins + hearts untouched", p1.coins === p0.coins && p1.hearts === p0.hearts && p1.wallet === p0.wallet, JSON.stringify([p0, p1]));
      }
      // the cooldown: right away again → "one moment", no way through
      await press("highway: again at once (cooldown)", { none: true });
      t.check("the cooldown: a second press within 10 s does nothing", (await nLog()) === 1, JSON.stringify(await log()));
      if (await g(`ctx.paused`)) { await t.tap(1); await t.frames(4); }
      await t.shot("highway-car");
    }
    await seg("highway: the car out of a solid");

    // 2 · NaN → rescued at once (automatic)
    await ready();
    let n0 = await nLog();
    await W.allow(t, "nan", ".");
    await g(`(ctx.car.pos.x = NaN, true)`);
    if (await autoFired(n0, "nan", "highway: a NaN car")) await carOK("highway: after NaN", null);
    await W.reset(t);

    // 3 · on foot: off the world's edge → back on the shoulder (automatic)
    if (await onFoot()) {
      await ready();
      n0 = await nLog();
      await g(`(() => { const F = ctx.foot.debug.F, p = ctx.world.road.point(F.s, 300, {}); F.pos.set(p.x, 0, p.z); F.lulu.obj.position.copy(F.pos); return true; })()`);
      await W.moved(t);
      if (await autoFired(n0, "edge", "highway: on foot far off the world's edge")) {
        const f = await footOK("highway: off the edge → the shoulder", null);
        t.check("…on a shoulder (|d| 7–10)", Math.abs(f.d) > 7 && Math.abs(f.d) < 10, String(f.d));
      }
      // 4 · on foot inside something solid → out (automatic, after ~2 s of not moving)
      sol = await solidNear(0.8);
      if (sol) {
        await ready();
        n0 = await nLog();
        await putFoot(sol.x, sol.z);
        // (the game's own collision pushes her out of a round thing; the rescue is for what it can't — either way she's out)
        await t.frames(120);
        const out = await g(`(() => { const F = ctx.foot.debug.F; return { d: Math.hypot(F.pos.x - ${sol.x}, F.pos.z - ${sol.z}), phase: F.phase, bad: ctx.unstuck.debug.badNow() }; })()`);
        t.check(`highway: on foot inside a ${sol.kind} (r ${sol.r.toFixed(1)}) → out of it (by the game's push or the rescue)`, out.d >= sol.r - 0.4 && out.bad == null, JSON.stringify(out));
        await W.reset(t);
      }
      // 5 · her parked CAR is the stuck thing → "🚗 Bring my car here too"
      sol = await solidNear(1);
      if (sol) {
        await g(`(() => { const c = ctx.foot.debug.F.car.stub; c.x = ${sol.x}; c.z = ${sol.z}; ctx.traffic.place(c, 0); return true; })()`);
        await t.frames(3);
        t.check("on foot: her car inside a " + sol.kind + " counts as stuck", await g(`ctx.unstuck.debug.carBad()`));
        await ready();
        if (await press("on foot: bring my car", { go: "unstuckCar" })) {
          await footOK("on foot: bring my car — she", null);
          const c = await g(`(() => { const F = ctx.foot.debug.F, c = F.car.stub; return { why: ctx.unstuck.normal(c.x, c.z, "car", { ignore: c }), d: Math.hypot(c.x - F.pos.x, c.z - F.pos.z), mine: ctx.traffic.cars.includes(c) }; })()`);
          t.check("…her car is beside her, clear, still hers", c.mine && c.why == null && c.d < 30, JSON.stringify(c));
          t.check("…and she can get in", await backIn());
        }
      }
    }
    await seg("highway: on foot");

    // 6 · stuck fades: each one up over the road — ❚❚ still opens a menu ABOVE it, 🆘 clears it
    await backIn();
    for (const [id, how] of [["townFade", `e.style.opacity = "1"`], ["footWash", `e.style.opacity = "1"`], ["intFade", `e.style.transition = "none"; e.style.opacity = "1"; e.classList.add("on")`],
      ["cameosFade", `e.style.transition = "none"; e.style.opacity = "1"`], ["lawFade", `e.style.transition = "none"; e.classList.add("on")`]]) {
      const made = await t.L(`(() => { let e = document.getElementById("${id}"); if (!e) { e = document.createElement("div"); e.id = "${id}"; document.body.appendChild(e); } ${how}; return true; })()`);
      if (!made) continue;
      await t.frames(25);
      await ready();
      if (await press(`a stuck #${id}`)) {
        await t.frames(30);
        const cov = await t.L(`window.__qa.covered()`);
        t.check(`a stuck #${id}: cleared — nothing covers the screen`, cov.length === 0, JSON.stringify(cov));
      }
    }
    // (+ the frozen soft-cut canvas: left up by a cut that never melted)
    await t.L(`(__lulu3d.ctx.dissolve(() => 0), true)`);
    await t.until(`document.getElementById("softCut").style.display === "none"`, "the real soft cut melts first", 6000);
    await t.L(`(() => { const e = document.getElementById("softCut"); e.style.transition = "none"; e.style.display = "block"; e.style.opacity = "1"; return true; })()`);
    await t.frames(10);
    // a stuck fade over the road for > 4 s: the touch ❚❚ (the hatch's) shows too
    await t.frames(150);
    t.check("a stuck #softCut for > 4 s: the spare touch ❚❚ shows", await g(`ctx.unstuck.debug.button`));
    await ready();
    if (await press("a stuck #softCut", { via: "hatch" })) { await t.frames(20); t.check("#softCut cleared", (await t.L(`window.__qa.covered()`)).length === 0); }
    await t.L(`(() => { const e = document.getElementById("softCut"); if (e) e.style.transition = ""; return true; })()`);
    await W.reset(t);

    // 7 · a scene that has hung (no input taken, never ends): after 12 s the pause menu is reachable from every input
    //     (the hatch) — a skippable one ends the way ⏭ ends it; one that can't be skipped, after 30 s, back on the road
    await g(`(() => { const S = ctx.states; S.qaHung = { hud: false, touch: false, pausable: false, world: true, driving: true, skip: true, onSkip() { L3.setState("playing"); }, update() {} };
      S.qaHung2 = { hud: false, touch: false, pausable: false, world: true, driving: true, update() {} }; return true; })()`);
    for (const [st, wait, via] of [["qaHung", 380, "hatch"], ["qaHung", 380, "pad"], ["qaHung", 380, "key"], ["qaHung2", 940, "pad"]]) {
      await g(`(L3.setState("${st}"), true)`);
      await t.frames(30);
      await t.tap(9);
      t.check(`${st}: no pause in a scene playing normally (first seconds)`, !await g(`ctx.paused`));
      if (await g(`ctx.paused`)) { await t.tap(1); await t.frames(3); }
      await t.frames(wait);
      t.check(`${st}: hung for 12 s → the pause hatch opens`, await g(`ctx.unstuck.debug.hatch`));
      if (via === "hatch") t.check(`${st}: …and a touch ❚❚ shows (the HUD is hidden)`, await g(`ctx.unstuck.debug.button`));
      await ready();
      if (await press(`a hung scene (${st}, via ${via})`, { via })) {
        await t.until(`__lulu3d.state === "playing"`, `${st}: back on the road`, 6000);
        await t.frames(10);
        t.check(`${st}: she has control again`, await t.L(`window.__qa.control()`), await g(`L3.state`));
      }
    }
    await g(`(delete ctx.states.qaHung, delete ctx.states.qaHung2, true)`);
    await seg("hung scenes");

    // 8 · during a chase: still wanted, the cops still on her
    await g(`(ctx.law.hold && ctx.law.hold(0), true)`);
    // (wedged first, then the chase, then 🆘 at once — a stopped car with a cruiser on it is pulled over: a law scene)
    sol = await solidNear(1);
    if (sol) await putCar(sol.x, sol.z);
    await t.frames(3);
    const chased = sol ? await g(`ctx.law.startChase("RECKLESS DRIVING")`) : false;
    await t.frames(4);
    if (chased && sol) {
      const w0 = await g(`ctx.law.wanted`);
      await ready();
      if (await press("in a chase")) {
        await carOK("in a chase", sol);
        t.check("in a chase: still chased, still wanted", await g(`ctx.law.chasing`) && JSON.stringify(await g(`ctx.law.wanted`)) === JSON.stringify(w0), JSON.stringify([w0, await g(`ctx.law.wanted`)]));
      }
    } else console.log("   (no chase / no solid for the chase case)", chased, JSON.stringify(sol));
    // (a fresh drive: the chase would otherwise go on to a bust and every later case would start inside the arrest)
    await W.moved(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.law.chasing`, "a fresh cruise after the chase", 9000);
    await g(`(ctx.law.hold && ctx.law.hold(1e6), ctx.law.clearHeat && ctx.law.clearHeat(""), true)`);
    await t.frames(10);
    await W.reset(t);

    // 9 · during a job: the clock keeps running, the job stays
    if (await g(`!!(ctx.hustle && ctx.hustle.start)`)) {
      await g(`ctx.hustle.start("delivery", { food: "cholent", dist: 600 })`);
      await t.frames(60);
      const j0 = await g(`(() => { const j = ctx.hustle.job; return j ? { id: j.def.id, left: j.timeLeft ? j.timeLeft() : null } : null; })()`);
      sol = await solidNear(1);
      if (j0 && sol) {
        await putCar(sol.x, sol.z);
        await t.frames(3);
        await ready();
        if (await press("on a job")) {
          const j1 = await g(`(() => { const j = ctx.hustle.job; return j ? { id: j.def.id, left: j.timeLeft ? j.timeLeft() : null } : null; })()`);
          t.check("on a job: the job's still on and its clock didn't go back", j1 && j1.id === j0.id && (j0.left == null || j1.left <= j0.left), JSON.stringify([j0, j1]));
        }
      }
      await g(`(ctx.hustle.job ? ctx.hustle.end("quit", "test") : 0, true)`);
      await t.frames(10);
      // (the job's result card)
      for (let i = 0; i < 6 && await g(`L3.state === "hustleResult"`); i++) { await t.L(`(() => { const b = document.getElementById("hsKeep"); if (b) b.click(); return true; })()`); await t.frames(10); }
    }

    // 10 · on a ramp → still on the ramp, heading down it
    await W.moved(t);
    await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 1200, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    const E = await g(`ctx.town.debug.exitAhead(400)`);
    const route = E ? await g(`ctx.town.debug.rampRoute(${E}, 0, 40)`) : null;
    const rp = route && route.find(([u]) => u >= 70) || (route && route[route.length - 1]);
    if (rp) {
      await g(`(() => { const s = ${E} + ${rp[0]}, p = ctx.world.highway.point(s, ${rp[1]}, {}); ctx.world.prebuild(s); ctx.car.place(p.x, p.z, p.h + Math.PI); ctx.car.s = s; ctx.car.d = ${rp[1]}; ctx.cam.snap(); return true; })()`);
      await W.moved(t);
      await t.frames(10);
      const before = await carAt();
      console.log("   on the ramp:", JSON.stringify(before));
      await ready();
      if (await press("on the ramp, facing the wrong way")) {
        const c = await carOK("on the ramp", before, { lanes: false });
        t.check("on the ramp: still on the ramp (off the lanes, paved)", Math.abs(c.d) > 7 && !c.town, JSON.stringify(c));
        t.check("on the ramp: heading down it (the road's way)", await g(`Math.cos(ctx.car.h - ctx.world.highway.at(ctx.car.s, {}).h) > 0.7`));
      }
    } else t.check("a ramp to test", false, JSON.stringify({ E, route: !!route }));

    // 11 · a rest area's lot: the car into one of its buildings → a free bit of the lot
    await W.moved(t);
    await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 1800, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    const RS = await g(`ctx.exits && ctx.exits.debug.restAhead(500)`);
    if (typeof RS === "number" && await t.until(`__lulu3d.ctx.exits.debug.modelsReady()`, "rest-area models", 60000)) {
      await g(`(() => { const r = ctx.world.road, s = ${RS} + 150, p = r.point(s, 28, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 28; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await W.moved(t);
      await t.frames(20);
      sol = await solidNear(0.8);
      if (sol && sol.d < 80) {
        await putCar(sol.x, sol.z);
        await t.frames(3);
        await ready();
        if (await press("rest area: the car in a " + sol.kind)) await carOK("rest area", sol, { lanes: false });
      } else console.log("   (no building in the rest area)", JSON.stringify(sol));
      await noFalse("rest area", 31);
    }
    await seg("ramp + rest area");

    // 12 · the highway monkey run
    await noFalse("highway", 11);

    // ═══ the towns ═══
    for (const id of ["lakewood", "midwood"]) {
      await backIn();
      await g(`(ctx.town.load("${id}"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("${id}")`, `${id}'s models load`, 90000)) continue;
      await W.moved(t);
      await g(`ctx.town.enter({ town: "${id}", speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active`, `in ${id}`, 8000)) continue;
      await t.frames(20);
      await W.reset(t);
      // a block's middle (a house) — in world coords
      const block = await g(`(() => { const pl = ctx.town.plan, n = pl.OCCLUDERS.length; let best = null, bd = 1e9; const me = ctx.town.debug.local(ctx.car.pos.x, ctx.car.pos.z);
        for (const r of pl.OCCLUDERS) { const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, d = Math.hypot(cx - me.x, cz - me.z); if (d < bd && r.x1 - r.x0 > 8 && r.z1 - r.z0 > 8) { bd = d; best = { cx, cz }; } }
        return best ? Object.assign(ctx.town.debug.world(best.cx, best.cz), { n }) : null; })()`);
      // 13 · the car inside a house → the nearest street, in her lane
      if (t.check(`${id}: a block to test`, !!block)) {
        await putCar(block.x, block.z);
        await t.frames(3);
        await ready();
        if (await press(`${id}: the car inside a house`)) await carOK(`${id}: the car inside a house`, block);
        await t.shot(`${id}-car-out-of-house`);
        // the same, automatic (no press): inside a block for > 2 s
        await ready();
        n0 = await nLog();
        await putCar(block.x, block.z);
        // (the town's own collision may shove a car out of a block by itself; the rescue is for when it can't — either way she's out)
        const fired = await t.until(`__lulu3d.ctx.unstuck.debug.U.log.length > ${n0}`, `${id}: the car left inside a house — rescued or pushed out`, 8000);
        const out = await g(`({ bad: ctx.unstuck.debug.badNow(), why: ctx.unstuck.normal(ctx.car.pos.x, ctx.car.pos.z, "car"), d: +ctx.car.d.toFixed(1), log: ctx.unstuck.debug.U.log.slice(${n0}) })`);
        console.log(`   ${id}: the car left inside a house →`, JSON.stringify(out));
        t.check(`${id}: the car left inside a house → out of it (the game's push or the rescue)`, out.bad == null && out.why !== "block", JSON.stringify(out));
        if (fired) await carOK(`${id}: auto out of the house`, block);
        await W.reset(t);
      }
      // 14 · the lake (Lakewood): the car in the water → out (automatic)
      const lake = await g(`(() => { const W = (ctx.town.def.water || [])[0]; if (!W) return null; return ctx.town.debug.world((W.x0 + W.x1) / 2 + 4, (W.z0 + W.z1) / 2); })()`);
      if (lake) {
        await ready();
        n0 = await nLog();
        await putCar(lake.x, lake.z);
        if (await autoFired(n0, "inside", `${id}: the car in the lake`, 8000)) await carOK(`${id}: out of the lake`, null);
      }
      // 15 · between parked cars (in the parking lane, nose to tail) → a clear lane
      const pk = await g(`(() => { const T = ctx.town.debug.S.T; const p = T && T.parked && T.parked[0]; if (!p) return null; const w = p.obj ? { x: p.obj.position.x, z: p.obj.position.z } : ctx.town.debug.world(p.x, p.z); return w; })()`);
      if (pk) {
        await putCar(pk.x, pk.z);
        await t.frames(3);
        await ready();
        if (await press(`${id}: wedged into the parked cars`)) await carOK(`${id}: out from the parked cars`, pk);
      }
      // 16 · on foot: inside a house (and up on its roof) → the sidewalk (automatic)
      if (block && await onFoot()) {
        for (const y of [0, 6]) {
          await ready();
          n0 = await nLog();
          await putFoot(block.x, block.z, y);
          if (await autoFired(n0, "inside", `${id}: on foot inside a house${y ? " (on its roof)" : ""}`, 8000)) {
            const f = await footOK(`${id}: on foot out of the house${y ? " roof" : ""}`, block);
            t.check(`${id}: …on a sidewalk`, await g(`(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(F.pos.x, F.pos.z, F.s, {}), st = n.street; return !!st && Math.abs(n.d) >= st.outer - 0.2 && Math.abs(n.d) <= st.walk + 0.2; })()`), JSON.stringify(f));
          }
        }
        // a tree in town
        sol = await solidNear(1, ["tree"]);
        if (sol) {
          await ready();
          n0 = await nLog();
          await putFoot(sol.x, sol.z);
          if (await autoFired(n0, "inside", `${id}: on foot inside a tree`, 8000)) await footOK(`${id}: out of the tree`, sol);
        }
        // the manual press on foot, in town
        await putFoot(block.x, block.z);
        await ready();
        await g(`(ctx.unstuck.debug.U.autoLast = ctx.time, true)`);    // (beat the automatic one to it)
        if (await press(`${id}: on foot, pressed`)) await footOK(`${id}: on foot, pressed`, block);
        await seg(`${id}: on foot`);
      }
      // 17 · the monkey run in town
      await noFalse(id, id === "lakewood" ? 41 : 53);
      await seg(`${id}: monkey`, ["nan", "overlay", "underground", "stuck"]);
      await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`);
      await t.frames(10);
    }

    // ═══ a room ═══ (the bar: Lulu through a wall → back at the door; a room that never loads → out of the front door)
    await g(`(window.__exited = 0, ctx.interiors.bar.enter({ exit: () => { window.__exited++; L3.setState("playing"); } }), true)`);
    if (await t.until(`window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.fadeIn >= 1`, "the bar loads", 60000)) {
      await t.frames(10);
      await g(`(() => { const r = window.__interiors.room; r.lulu.obj.position.set(r.bounds.x1 + 6, 0, r.bounds.z1 + 6); return true; })()`);
      await t.frames(3);
      await ready();
      if (await press("in the bar, through a wall")) {
        const r = await g(`(() => { const r = window.__interiors.room, p = r.lulu.obj.position, sp = r.spots.lulu || r.spots.door; return { state: L3.state, d: Math.hypot(p.x - sp.x, p.z - sp.z), inB: p.x >= r.bounds.x0 - 0.5 && p.x <= r.bounds.x1 + 0.5 && p.z >= r.bounds.z0 - 0.5 && p.z <= r.bounds.z1 + 0.5 }; })()`);
        t.check("in the bar: back at the room's entry spot, inside its walls", r.state === "interior" && r.d < 0.5 && r.inB, JSON.stringify(r));
      }
      await t.frames(20);
      await g(`(window.__interiors.room.ready = false, true)`);
      await ready();
      if (await press("in a broken room")) {
        await t.until(`__lulu3d.state === "playing"`, "a broken room: out of its front door", 6000);
        t.check("a broken room: its exit ran (she's outside)", await g(`window.__exited === 1 && !window.__interiors.room`));
      }
    }
    await t.frames(20);
    await seg("a room", ["nan", "overlay", "stuck"]);

    // ═══ Lulu's house / the home start (wherever it stands) ═══
    await g(`(ctx.foot.active && ctx.foot.end("test"), L3.startRun({ mode: "cruise" }), true)`);
    if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "the home start (on foot)", 30000)) {
      await t.frames(30);
      await W.reset(t);
      sol = await solidNear(0.8);
      if (sol && sol.d < 60) {
        await putFoot(sol.x, sol.z);
        await ready();
        await g(`(ctx.unstuck.debug.U.autoLast = ctx.time, true)`);
        if (await press(`home: inside a ${sol.kind}`)) await footOK(`home: out of the ${sol.kind}`, sol);
      }
      await t.stick(0, -1); await t.frames(60); await t.stick(0, 0);
      await seg("home");
    }
  },
};
