// 🅿️ THE PARKING CHALLENGE ON A REAL LOT (ci/parkinglot): the course stands in a rest area's truck lot; the 📱 💼 Jobs
// card unlocks it (1,000 shared coins) and MARKS the course (no teleport); pulling into the START box starts level 1 —
// the "parking" state is a DRIVING state in the world (no separate scene: the highway traffic keeps going, the lot is
// closed to other cars); the controller drives her real car under the lot governor; the autopilot (the tests' route
// helper, the real physics) parallel-parks a level and pulls out into the lane for the next; scoring + the shared save fields as 2D;
// a fail (ram a parked car: −1 life, the grandpa); running out of lives ends the run with the attendant's board and no
// card; driving out of the course / ❚❚ › Leave ends it; every one of the ten levels is parked by the autopilot; the
// QA watchdog sees no cut in or out; the HUD chip fits a phone both ways + TV.
// Parts: PARKING_PART=basic,levels,layouts (default: all).
const W = require("../lib/qawatch.js");
const S = `__lulu3d.ctx.parking._debug`;
const PARTS = (process.env.PARKING_PART || "basic,levels,layouts").split(",");
module.exports = {
  name: "parking",
  save2d: { totalCoins: 1500, ownedSkins: ["pink", "purple"], selectedSkin: "purple" },
  async run(t) {
    const g = c => t.game(c);
    const st = () => g(`ctx.state`);
    const coins = () => t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
    await t.frames(10);
    t.check("no Parking Challenge on the title", !(await t.titleItems()).some(l => /Parking Challenge/.test(l)));
    t.check("no separate parking scene: the 'parking' state is a driving state in the world (and parkingEnd is gone)",
      await g(`(() => { const d = ctx.states.parking; return !!d && d.driving === true && d.world !== false && !ctx.states.parkingEnd; })()`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "driving")) return;
    const RS = await g(`ctx.exits.debug.restAhead(320)`);
    t.check("a rest area can be planned ahead", typeof RS === "number", String(RS));
    t.check("the rest area has a 🅿️ course (with the attendant's START box)", await t.until(`__lulu3d.ctx.parking.debug.courses().length > 0`, "course", 20000));
    await W.install(t);

    // warp into the course's START box (a test shortcut: the watchdog is told), stopped
    const toBox = async () => { await W.pause(t, false); await g(`ctx.parking.debug.toBox()`); await t.frames(4); await W.pause(t, true); await W.moved(t); };
    const place = async (x, z, h, v = 0) => { await W.pause(t, false); await g(`ctx.parking.debug.place(${x}, ${z}, ${h}, ${v})`); await t.frames(2); await W.pause(t, true); await W.moved(t); };
    const startHere = async label => {
      await toBox();
      return t.until(`__lulu3d.state === "parking" && ${S}.phase === "drive"`, label, 20000);
    };

    if (PARTS.includes("basic")) {
      // ── the 📱 💼 Jobs card: unlock with the shared wallet, then it MARKS the course ──
      await g(`ctx.phone.openPhone("jobs")`);
      await t.frames(3);
      t.check("the 📱 💼 Jobs app's 🅿️ card offers the 1,000-coin unlock", await t.L(`/Unlock — 1,000/.test(document.querySelector("#screenCard").textContent)`));
      await t.L(`document.getElementById("lpParkUnlock").click()`);
      await t.frames(4);
      const s2 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2"))`);
      t.check("unlock spends 1,000 shared coins + sets parkingUnlocked", s2.parkingUnlocked === true && s2.totalCoins === 500, `coins ${s2.totalCoins}`);
      await t.L(`document.getElementById("lpPark").click()`);
      await t.frames(6);
      t.check("…'Show me the course' marks it (a light over the START box) — she isn't moved anywhere", await g(`!!ctx.parking._debug.mark && ctx.state === "playing" && !ctx.parking.active`));
      await t.shot("marked");

      // ── pulling into the START box IS the start (no button, no cut) ──
      if (!await startHere("pull into the START box → level 1")) return;
      t.check("stopping in the START box starts level 1 (her real car, the world around her)", await g(`ctx.parking._debug.level === 1 && !ctx.view && ctx.car.obj.visible`));
      t.check("she parks HER car (the shared skin)", await g(`ctx.car.skinKey`) === "purple");
      t.check("the attendant is there (with his clipboard)", await g(`ctx.parking.debug.courses().some(c => c.attendant)`));
      t.check("level 1 is set out on the lot: two parked cars round the bay, one camera", await g(`(() => { const L = ctx.parking._debug.L; return L.parked.length >= 2 && L.cams.length === 1; })()`));
      t.check("the HUD chip shows the level, lives and the clock", await t.L(`/LVL 1/.test((document.querySelector(".park-chip") || {}).textContent || "") && /♥ ?3/.test(document.querySelector(".park-chip").textContent)`));
      await t.shot("level1");

      // ── drive with the controller: RT forward, the lot governor caps speed ──
      const x0 = await g(`ctx.parking.debug.local().x`);
      await t.hold(7, 1); await t.stick(0.15);
      await t.frames(30);
      const sp = await g(`ctx.car.speed`);
      await t.hold(7, 0); await t.stick(0);
      const x1 = await g(`ctx.parking.debug.local().x`);
      t.check("RT drives her car along the row (toward the bay)", x0 - x1 > 1.2, `${(x0 - x1).toFixed(2)} m`);
      t.check("the lot speed governor (≤ 4.5 m/s)", sp <= 4.5 && sp > 0.8, `${sp.toFixed(2)} m/s`);
      await t.frames(30);
      // reverse from a stop: LT backs her up
      const x2 = await g(`ctx.parking.debug.local().x`);
      await t.hold(6, 1); await t.frames(30); await t.hold(6, 0);
      t.check("LT from a stop reverses", await g(`ctx.parking.debug.local().x`) - x2 > 0.6);
      await t.frames(30);
      t.check("the security camera tracks her", await g(`ctx.parking._debug.L.cams.every(c => Math.abs(c.yaw) > 0.01)`));
      // △ cycles the lot camera: Lot cam → Overhead → Chase → Lot cam
      await t.tap(3); await t.frames(20); await t.shot("overhead");
      t.check("△ cycles the lot camera (Overhead)", await g(`ctx.parking._debug.camToast > 0`));
      await t.tap(3); await t.frames(10); await t.tap(3); await t.frames(10);

      // ── the lot is closed to other cars; the world keeps going ──
      const tr = await g(`(() => { const CO = ctx.parking.debug.CO, c = ctx.parking._debug.c; let inside = 0; for (const k of ctx.traffic.cars) { const l = CO.toLocal(c, k.x, k.z, {}); if (CO.insideLocal(l.x, l.z, 2)) inside++; } return { n: ctx.traffic.cars.length, inside }; })()`);
      t.check("the highway traffic keeps going during a level, and no car comes onto the course", tr.n > 0 && tr.inside === 0, JSON.stringify(tr));

      // ── a park, by the autopilot (her real car, the real physics): stars + coins + the shared save ──
      const w0 = await coins();
      await g(`ctx.parking.debug.autopark(true)`);
      if (!await t.until(`${S}.phase === "result"`, "the autopilot parks level 1", 90000)) return;
      const stars = await g(`ctx.parking._debug.stars`);
      t.check("level 1 parked (in the bay, still, lined up)", await g(`ctx.parking._debug.result === "success"`));
      t.check("…a clean park scores ⭐⭐ or more (★★★ = no contact at all)", stars >= 2, `${stars} ★`);
      await t.frames(20);
      await t.shot("parked");
      const w1 = await coins();
      t.check("level 1 pays 1×25 + 15 per ★ to the shared wallet", w1 - w0 === 25 + 15 * stars, `${w0} → ${w1} (${stars} ★)`);
      const s3 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2"))`);
      t.check("shared save: best level 1, the stars added, a perfect park counted only for ★★★",
        s3.parkingBestLevel === 1 && s3.parkingTotalStars === stars && (s3.parkingPerfectRuns || 0) === (stars === 3 ? 1 : 0), JSON.stringify([s3.parkingBestLevel, s3.parkingTotalStars, s3.parkingPerfectRuns]));
      t.check("the attendant holds up the result board (no card)", await g(`!!ctx.parking._debug.board && !(L3.H && L3.H.screenOpen && L3.H.screenOpen())`));
      await t.tap(0);   // ✕ skips the result
      t.check("✕ → pull out into the lane for level 2", await t.until(`${S}.phase === "box" && ${S}.level === 2`, "box", 6000));
      t.check("…the autopilot backs out of the bay into the lane, and level 2 is set out round her", await t.until(`${S}.level === 2 && ${S}.phase === "drive"`, "level 2", 60000));
      await g(`ctx.parking.debug.autopark(false)`);

      // ── a fail: ram a parked car ──
      await t.frames(4);
      const pc = await g(`(() => { const p = ctx.parking._debug.L.parked[0].obj.position; return { x: p.x, z: p.z }; })()`);
      await place(pc.x + 5.2, pc.z, -Math.PI / 2, 4.2);
      if (!await t.until(`${S}.phase === "result"`, "ramming a parked car fails")) return;
      t.check("ramming a parked car = CRASH!", await g(`ctx.parking._debug.result === "fail" && ctx.parking._debug.failHit.who === "parked"`));
      t.check("a fail costs one of the three lives", await g(`ctx.parking._debug.lives`) === 2);
      await t.frames(40);
      t.check("the angry grandpa storms over", await g(`!!ctx.parking._debug.angry`));
      await t.shot("crash");
      await t.tap(0);
      t.check("…pull out to retry the same level", await t.until(`${S}.phase === "box" && ${S}.level === 2`, "retry", 6000));

      // ── out of lives: no card — the attendant's board, one line, she's just driving again ──
      if (!await startHere("level 2 again")) return;
      await g(`(ctx.parking._debug.lives = 1, ctx.parking._debug.timeLeft = 0.2)`);
      if (!await t.until(`${S}.phase === "result"`, "the clock runs out")) return;
      t.check("out of time = fail", await g(`ctx.parking._debug.failHit.who`) === "timeout");
      await t.tap(0);
      t.check("the last life → the run ends: plain driving again, no end card", await t.until(`__lulu3d.state === "playing"`, "playing", 6000) && !await t.L(`!!document.querySelector("#screen:not(.hidden) #screenCard")`));
      t.check("…the run's board + one line (level reached)", await g(`!!ctx.parking._debug.board && ctx.parking._debug.endStats.level === 2 && ctx.parking._debug.endStats.why === "lives"`));
      await t.shot("run-over");

      // ── driving out of the course ends it ──
      await t.frames(30);
      if (!await startHere("again")) return;
      await place(16.5, 12, Math.PI / 2, 2);
      t.check("driving out of the course ends the run (she just keeps driving)", await t.until(`__lulu3d.state === "playing"`, "left", 4000) && await g(`ctx.parking._debug.endStats.why === "left"`));

      // ── ❚❚ › Leave the Parking Challenge ──
      await t.frames(30);
      if (!await startHere("again")) return;
      await t.key("Escape");
      t.check("the pause menu offers 'Leave the Parking Challenge'", await t.L(`!!document.querySelector('[data-pi="parkLeave"]')`));
      await t.L(`document.querySelector('[data-pi="parkLeave"]').click()`);
      t.check("…→ plain driving, right where she is", await t.until(`__lulu3d.state === "playing"`, "left via pause", 4000) && await g(`ctx.parking._debug.endStats.why === "quit"`));
      await t.frames(30);
    }

    if (PARTS.includes("levels")) {
      // ── every level, driven: the autopilot parks 1 → 10 and drives back to the box between them ──
      await t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2")); s.parkingUnlocked = true; localStorage.setItem("luluSaveV2", JSON.stringify(s)); })()`);
      await t.L(`import("./js/core/save.js").then(m => (m.shared.update(s => { s.parkingUnlocked = true; }), true))`);
      await g(`ctx.parking.debug.autopark(true)`);
      if (!await startHere("a fresh run")) return;
      const done = await t.until(`__lulu3d.state === "playing" && ${S}.endStats && ${S}.endStats.why !== "quit"`, "ten levels", 900000);
      const es = await g(`ctx.parking._debug.endStats`);
      const res = await g(`ctx.parking._debug.lives`);
      t.check("the autopilot parks all ten levels (each one reachable + completable on the real lot)", done && es && es.victory === true, JSON.stringify({ es, lives: res }));
      const s4 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2"))`);
      t.check("…best level 10 in the shared save", s4.parkingBestLevel === 10, String(s4.parkingBestLevel));
      await g(`ctx.parking.debug.autopark(false)`);
      await t.shot("all-ten");
    }

    if (PARTS.includes("layouts")) {
      // ── the HUD: phone portrait / landscape (touch) + TV, during a level ──
      if (!await startHere("a level for the layouts")) return;
      const fits = () => t.L(`(() => { const out = []; for (const sel of [".park-chip", "#slot-bottom .prompt"]) { const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1)) out.push(sel); } const a = document.querySelector(".park-chip"), b = document.querySelector("#hud .speedo"); if (a && b) { const r = a.getBoundingClientRect(), q = b.getBoundingClientRect(); if (r.width && q.width && r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom) out.push("chip/speedo"); } return out; })()`);
      for (const [name, w, h, tv, dev] of [["portrait", 390, 844, false, "touch"], ["landscape", 844, 390, false, "touch"], ["tv", 1280, 720, true, "gamepad"]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.L(`(__lulu3d.input.device = "${dev}", document.body.classList.toggle("touch", ${dev === "touch"}), document.body.classList.toggle("tv", ${tv}), document.getElementById("touch").classList.toggle("hidden", ${dev !== "touch"}))`);
        await t.frames(12);
        const bad = await fits();
        t.check(`${name}: the challenge's chip + prompt are on screen, clear of the speedo`, bad.length === 0, bad.join(","));
        await t.shot(name);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`(document.body.classList.remove("tv"), document.body.classList.remove("touch"))`);
      await g(`ctx.parking.debug.endRun("quit")`);
      await t.frames(10);
    }
    W.check(t, "the challenge on the lot (in and out, every level)", await W.report(t));
  },
};
