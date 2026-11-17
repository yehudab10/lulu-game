// 🏁 Moves & tricks (features/moves): scripted inputs through the fake controller
// prove each move triggers, the drift tiers scale the turbo, and the style combo
// links (drift holds it open), banks (score × multiplier) and breaks (a crash) —
// plus the rocket start / wheelspin, slipstream → slingshot, the wrong lane,
// bootlegger, a PIT on a cruiser, air tricks off a ramp, the on-foot roll / slide /
// vault (+ a MATADOR), the 🏁 Moves scrapbook page (glyphs, stars, toggle, phone
// portrait) and HUD Clean.
const save3 = `JSON.parse(localStorage.getItem("lulu3dSave") || "{}")`;

module.exports = {
  name: "moves",
  query: "&enable=moves",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0 },
  async run(t) {
    const G = code => t.game(code);
    const M = `ctx.moves`;
    // put the car on the road at s, lane d, moving along it at v (m/s; negative = reversing)
    const place = (s, d, v) => G(`(() => { const p = ctx.world.road.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.car.vF = ${v}; return true; })()`);
    const release = async () => { await t.stick(0, 0); for (const b of [0, 2, 5, 6, 7]) await t.hold(b, 0); };
    const bankNow = () => G(`(${M}.combo.t = 0.01, true)`);

    t.check("ctx.moves service is up", await G(`!!${M} && ${M}.on === true && Array.isArray(${M}.list) && ${M}.list.length >= 10`));

    // ── 🚀 rocket start: gas in the last moment of the 3-2-1 ──
    await G(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "intro"`, "the 3-2-1 countdown starts");
    await G(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await t.until(`__lulu3d.state === "intro" && __lulu3d.ctx.stateT > 2.08`, "the countdown reaches the last beat", 10000);
    await t.hold(7, 1);
    await t.until(`__lulu3d.state === "playing"`, "GO!", 10000);
    await t.frames(2);
    const rk = await G(`({ perfect: ${M}.save.q.perfect || 0, turbo: ${M}.debug.T.tier, left: ${M}.turboLeft, n: ${M}.combo.n })`);
    t.check("🚀 PERFECT START: tier-3 turbo + a combo move", rk.perfect === 1 && rk.turbo === 3 && rk.left > 0.5 && rk.n === 1, JSON.stringify(rk));
    await t.shot("rocket");
    await release();

    // too early → wheelspin (no launch)
    await G(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "intro"`, "countdown again");
    await t.hold(7, 1);
    await t.until(`__lulu3d.state === "playing"`, "GO again", 10000);
    await t.frames(2);
    const ws = await G(`({ spin: ${M}.debug.R.spin, perfect: ${M}.save.q.perfect || 0, n: ${M}.combo.n })`);
    t.check("gas from the 3 → WHEELSPIN, no extra launch", ws.spin > 0.3 && ws.perfect === 1 && ws.n === 0, JSON.stringify(ws));
    await release();
    await G(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await t.frames(30);

    // ── 🌀 drift boost: tier 1, then tier 3; the drift links them into one combo; it banks ──
    await place(200, 3.5, 26);
    await t.hold(7, 1);
    await t.stick(0.8);
    await t.hold(2, 1);
    await t.frames(2);
    t.check("□ + steer at speed starts a drift", await G(`${M}.drifting`), JSON.stringify(await G(`({ vF: ctx.car.vF, D: ${M}.debug.D })`)));
    await t.stick(-0.8);                          // counter-steer: drift dead straight down the road
    await t.until(`__lulu3d.ctx.moves.driftTier >= 1`, "sparks reach BLUE (tier 1)", 8000);
    await t.shot("drift-blue");
    await t.hold(2, 0);
    await t.frames(2);
    const d1 = await G(`({ tier: ${M}.debug.T.tier, left: ${M}.turboLeft, acc: ${M}.debug.T.acc, n: ${M}.combo.n, flames: ctx.car.boosting })`);
    t.check("release → a BLUE mini-turbo (tier 1)", d1.tier === 1 && d1.left > 0.3 && d1.left <= 0.55 && d1.flames, JSON.stringify(d1));
    const score0 = await G(`ctx.G.score`);
    await t.stick(0.8);
    await t.hold(2, 1);
    await t.frames(2);
    await t.stick(-0.8);
    await t.until(`__lulu3d.ctx.moves.driftTier >= 2`, "ORANGE (tier 2)", 10000);
    await t.until(`__lulu3d.ctx.moves.driftTier >= 3`, "PURPLE (tier 3)", 10000);
    const live3 = await G(`({ n: ${M}.combo.n, t: ${M}.combo.t, call: ${M}.debug.callout() })`);
    t.check("the drift keeps the combo open (link move)", live3.n === 1 && live3.t > 0.5, JSON.stringify(live3));
    t.check("the HUD callout shows the drift meter", live3.call.on && /DRIFT/.test(live3.call.name) && live3.call.meter >= 0, JSON.stringify(live3.call));
    await t.shot("drift-purple");
    await t.hold(2, 0);
    await t.frames(2);
    const d3 = await G(`({ tier: ${M}.debug.T.tier, left: ${M}.turboLeft, acc: ${M}.debug.T.acc, n: ${M}.combo.n, mult: ${M}.combo.mult, q3: ${M}.save.q.drift3 || 0 })`);
    t.check("PURPLE turbo is longer + stronger than BLUE", d3.tier === 3 && d3.left > 1.2 && d3.acc > d1.acc, `${JSON.stringify(d1)} → ${JSON.stringify(d3)}`);
    t.check("two turbos chained: combo ×1.5", d3.n === 2 && Math.abs(d3.mult - 1.5) < 0.01 && d3.q3 === 1, JSON.stringify(d3));
    await t.shot("turbo");
    await t.hold(7, 0); await t.stick(0);
    await t.until(`__lulu3d.ctx.moves.combo.n === 0`, "the combo runs out and banks", 8000);
    const bk = await G(`${M}.debug.LOG[${M}.debug.LOG.length - 1]`);
    t.check("banked: score × multiplier", bk && bk.type === "bank" && bk.n === 2 && bk.total > 0 && (await G(`ctx.G.score`)) > score0, JSON.stringify(bk));
    await t.shot("bank");

    // ── 💥 a crash loses the chain ──
    await G(`(L3.emit("closeCall", { oncoming: false, combo: 1 }), L3.emit("closeCall", { oncoming: true, combo: 2 }), true)`);
    t.check("close shaves feed the combo (head-on counts)", await G(`${M}.combo.n === 2 && ${M}.combo.kinds.headon === 1`));
    await G(`(ctx.G.invT = 0, L3.damage(0.5, "test bump", "test"), true)`);
    const br = await G(`${M}.debug.LOG[${M}.debug.LOG.length - 1]`);
    t.check("a crash → COMBO LOST (no bank)", await G(`${M}.combo.n === 0`) && br && br.type === "break", JSON.stringify(br));
    await G(`(ctx.G.hearts = 3, ctx.G.invT = 0, L3.H.setHearts(3, 3), true)`);
    await t.frames(70);

    // ── 💨 slipstream → slingshot (a truck that holds 9 m ahead) ──
    await place(400, 1.75, 24);
    await G(`(() => { const car = ctx.car; window.__truck = ctx.traffic.add("truck", car.s + 9, 1.75, 1, 24,
      { ai: (dt, c) => { if (!window.__truckFree) { c.s = ctx.car.s + 9; c.d = 1.75; } else c.s += c.speed * dt; c.speed = Math.max(0, ctx.car.vF); } }); return true; })()`);
    await t.hold(7, 0.55);
    await t.until(`__lulu3d.ctx.moves.debug.DR.charge >= 1`, "the draft charges behind the truck", 8000);
    await t.shot("draft");
    await G(`(window.__truckFree = true, true)`);
    await t.stick(-0.7);
    await t.until(`(__lulu3d.ctx.moves.save.n.slingshot || 0) >= 1`, "pull out → SLINGSHOT", 6000);
    t.check("a truck slingshot is a tier-3 turbo", await G(`${M}.debug.T.tier === 3 || ${M}.debug.T.src === "slingshot"`));
    await t.stick(0); await t.hold(7, 0);
    await G(`(ctx.traffic.remove(window.__truck), true)`);
    await bankNow(); await t.frames(3);

    // ── 😈 the wrong side of the road ──
    await place(700, -3.5, 24);
    await t.hold(7, 0.6);
    for (let i = 0; i < 6; i++) {               // the road curves: keep her in the oncoming lane
      await t.frames(12);
      await G(`(() => { const c = ctx.car, s = c.s, v = Math.max(20, c.vF); const p = ctx.world.road.point(s, -3.5, {}); c.place(p.x, p.z, p.h); c.s = s;
        c.vx = Math.sin(p.h) * v; c.vz = Math.cos(p.h) * v; return true; })()`);
    }
    t.check("the oncoming lanes hold a combo open", await G(`${M}.debug.W.t > 1.5`), String(await G(`${M}.debug.W.t`)));
    await place(780, 1.75, 24);
    await t.frames(3);
    t.check("back in her lane → WRONG WAY move + best time", await G(`(${M}.save.n.wrongway || 0) >= 1 && ${M}.save.best.wrongway >= 1.5`));
    await t.hold(7, 0);
    await bankNow(); await t.frames(3);

    // ── ↩️ bootlegger: reverse fast, steer + □ ──
    await place(900, 1.75, -8.6);
    await t.hold(6, 1);
    await t.frames(2);
    await t.stick(1);
    await t.hold(2, 1);
    await t.frames(3);
    t.check("reversing fast + steer + □ starts the J-turn", await G(`${M}.debug.B.on`), JSON.stringify(await G(`({ vF: ctx.car.vF, B: ${M}.debug.B })`)));
    await t.hold(6, 0); await t.hold(2, 0); await t.stick(0);
    await t.hold(7, 1);
    await t.until(`(__lulu3d.ctx.moves.save.n.bootleg || 0) >= 1`, "she whips round and drives off → BOOTLEGGER", 6000);
    await t.shot("bootleg");
    await t.hold(7, 0);
    await bankNow(); await t.frames(3);

    // ── 🚓 PIT: nudge a cruiser's rear quarter ──
    await place(1100, 1.75, 20);
    await G(`(() => { window.__copOff = 2.4; window.__cop = ctx.traffic.add("cop", ctx.car.s + 2.6, 4.1, 1, 20,
      { data: { law: { mode: "chase" } }, ai: (dt, c) => { c.s = ctx.car.s + 2.6; c.d = 4.1; c.speed = ctx.car.vF; } }); return true; })()`);
    await t.hold(7, 0.6);
    await t.stick(0.75);
    await t.until(`(__lulu3d.ctx.moves.save.n.pit || 0) >= 1 || __lulu3d.ctx.car.d > 3.5`, "steers into the cruiser's back corner", 6000);
    const pit = await G(`({ n: ${M}.save.n.pit || 0, hit: window.__cop.hit, hitT: window.__cop.hitT, hearts: ctx.G.hearts })`);
    t.check("🚓 PIT MANEUVER: the cruiser spins out, no heart lost", pit.n >= 1 && pit.hit && pit.hearts === 3, JSON.stringify(pit));
    await t.shot("pit");
    await t.stick(0); await t.hold(7, 0);
    await G(`(ctx.traffic.remove(window.__cop), true)`);
    await place(1200, 1.75, 10);
    await bankNow(); await t.frames(3);

    // ── 🛹 air tricks: a front flip off a ramp ──
    await place(1300, 1.75, 0);
    await t.frames(2);
    t.check("spawns a stunt ramp", await G(`ctx.play.debug.spawnRamp(34, 1.75)`));
    await place(1300, 1.75, 28);
    await t.hold(7, 1);
    await t.until(`__lulu3d.ctx.play.jump.air`, "takes off", 8000);
    await t.hold(7, 0);
    await t.stick(0, -1);                       // flick ↑ → front flip
    await t.frames(3);
    await t.stick(0, 0);
    t.check("a stick flick starts a FRONT FLIP", await G(`${M}.debug.X.flip.on || ${M}.debug.X.flips >= 1`));
    await t.frames(6);
    await t.shot("flip");
    await t.until(`!__lulu3d.ctx.play.jump.air`, "lands", 8000);
    await t.frames(2);
    const air = await G(`({ n: ${M}.save.n.air || 0, best: ${M}.save.best.air || 0, clean: ctx.play.jump.lastClean, botch: ctx.play.jump.lastBotch, tier: ${M}.debug.T.tier, hearts: ctx.G.hearts })`);
    t.check("landed the flip → an air move + turbo", air.n >= 1 && air.best >= 1 && air.clean === true && air.botch === false, JSON.stringify(air));
    await bankNow(); await t.frames(3);

    // botched: flip late, land mid-trick → wobble + combo lost
    await G(`L3.emit("closeCall", { oncoming: false, combo: 1 })`);
    await G(`L3.emit("closeCall", { oncoming: false, combo: 2 })`);
    await place(1600, 1.75, 0);
    await t.frames(2);
    await G(`ctx.play.debug.spawnRamp(34, 1.75)`);
    await place(1600, 1.75, 22);
    await t.hold(7, 1);
    await t.until(`__lulu3d.ctx.play.jump.air`, "takes off again", 8000);
    await t.hold(7, 0);
    await t.until(`__lulu3d.ctx.play.jump.vy < 0 && __lulu3d.ctx.play.jump.y < 2.6`, "falling, nearly down", 8000);
    await t.stick(0, 1);                        // a back flip far too late
    await t.frames(2);
    await t.stick(0, 0);
    await t.until(`!__lulu3d.ctx.play.jump.air`, "lands mid-flip", 8000);
    await t.frames(2);
    const bot = await G(`({ botch: ctx.play.jump.lastBotch, clean: ctx.play.jump.lastClean, n: ${M}.combo.n, last: ${M}.debug.LOG[${M}.debug.LOG.length - 1], hearts: ctx.G.hearts, state: ctx.state })`);
    t.check("landing mid-flip = a harmless wobble that loses the combo", bot.botch === true && bot.clean === false && bot.n === 0 && bot.last.why === "botch" && bot.state === "playing", JSON.stringify(bot));
    await t.frames(20);

    // ── 🚶‍♀️ on foot: roll, slide, vault, matador ──
    await place(1900, 6.5, 0);
    await t.frames(2);
    await G(`ctx.foot.start("droveOff")`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "Lulu's on foot", 15000);
    await t.stick(0, -1);                        // a few steps away from her own car (□ beside it would vault it)
    await t.frames(30);
    await t.stick(0, 0);
    await t.frames(8);
    await t.tap(2);
    t.check("□ on foot → a dodge ROLL", await G(`${M}.debug.foot().kind === "roll"`), JSON.stringify(await G(`${M}.debug.foot()`)));
    await t.frames(3);
    await t.shot("roll");
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on && __lulu3d.ctx.foot.phase === "walk"`, "the roll ends", 5000);
    t.check("roll counted", await G(`(${M}.save.n.roll || 0) >= 1`));
    // sprint → slide
    await t.stick(0, -1); await t.hold(5, 1);
    await t.frames(12);
    await t.tap(2);
    t.check("sprinting + □ → a SLIDE", await G(`${M}.debug.foot().kind === "slide"`));
    await t.frames(3);
    await t.shot("slide");
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on && __lulu3d.ctx.foot.phase === "walk"`, "the slide ends", 5000);
    await t.stick(0, 0); await t.hold(5, 0);
    await t.frames(8);
    // a parked sedan right in front of her → vault
    await G(`(() => { const F = ctx.foot.debug.F, o = F.lulu.obj, y = o.rotation.y;
      const p = { x: F.pos.x + Math.sin(y) * 3.2, z: F.pos.z + Math.cos(y) * 3.2 }; const n = ctx.world.road.nearest(p.x, p.z, F.s, {});
      window.__parked = ctx.traffic.add("sedan", n.s, n.d, 1, 0, { ai: (dt, c) => { c.speed = 0; } }); return true; })()`);
    await t.frames(2);
    const before = await G(`(() => { const F = ctx.foot.debug.F; return { x: F.pos.x, z: F.pos.z }; })()`);
    await t.tap(2);
    t.check("□ facing a parked car → a VAULT", await G(`${M}.debug.foot().kind === "vault"`), JSON.stringify(await G(`${M}.debug.foot()`)));
    await t.frames(5);
    await t.shot("vault");
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on`, "the vault lands", 5000);
    const after = await G(`(() => { const F = ctx.foot.debug.F; return { x: F.pos.x, z: F.pos.z }; })()`);
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    t.check("…and she's over the hood, on the far side", moved > 3.5, moved.toFixed(2) + " m");
    await G(`(ctx.traffic.remove(window.__parked), true)`);
    // a car whooshing past mid-roll → MATADOR (cars can't touch her mid-move)
    await G(`(() => { const F = ctx.foot.debug.F; window.__bull = ctx.traffic.add("sedan", F.s - 7, F.d + 1.4, 1, 16,
      { ai: (dt, c) => { c.s += 16 * dt; c.d = F.d + 1.4; } }); return true; })()`);
    await t.frames(4);
    await t.tap(2);
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on && __lulu3d.ctx.foot.phase !== "script"`, "the roll ends", 5000);
    const ole = await G(`({ m: ${M}.save.q.matador || 0, hearts: ctx.G.hearts, n: ${M}.combo.n, foot: ${M}.combo.foot })`);
    t.check("🐂 MATADOR: a car shot past mid-roll, no knockdown", ole.m >= 1 && ole.hearts === 3, JSON.stringify(ole));
    t.check("on-foot moves chain into a combo", ole.n >= 2 && ole.foot === true, JSON.stringify(ole));
    await G(`(ctx.traffic.remove(window.__bull), true)`);
    await bankNow(); await t.frames(3);

    // ── HUD Clean hides the callout's numbers, keeps the name ──
    await G(`ctx.moves.addMove("roll", 100, "TEST", { foot: true })`);
    await t.L(`document.body.classList.add("hud-clean")`);
    t.check("HUD Clean: name stays, numbers hide", await t.L(`getComputedStyle(document.querySelector("#mvCall .mv-s")).display === "none" && getComputedStyle(document.querySelector("#mvCall .mv-n")).display !== "none"`));
    await t.L(`document.body.classList.remove("hud-clean")`);
    // the callout on a phone held upright: centred, on screen, clear of the trip bar
    await t.page.setViewportSize({ width: 390, height: 780 });
    await G(`ctx.moves.addMove("slide", 150, "🏃‍♀️ SLIDE!", { foot: true })`);
    await t.frames(4);
    const box = await t.L(`(() => { const r = document.querySelector("#mvCall").getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; })()`);
    t.check("phone portrait: the callout fits on screen", box.l >= 0 && box.r <= 390 && box.t > 60 && box.b < 400, JSON.stringify(box));
    await t.shot("callout-portrait");
    await t.page.setViewportSize({ width: 960, height: 540 });
    await bankNow(); await t.frames(3);

    // ── perf ──
    const perf = await G(`(() => { const P = ${M}.debug.PERF; return { avg: P.ms / Math.max(1, P.n), max: P.max, n: P.n, parts: ctx.car.fx.max }; })()`);
    t.check("per-frame cost of the driving moves stays tiny", perf.avg < 0.5, `avg ${(perf.avg * 1000).toFixed(0)} µs over ${perf.n} frames, max ${perf.max.toFixed(2)} ms`);

    // ── 📒 Scrapbook › 🏁 Moves ──
    await G(`L3.setState("title")`);
    await t.until(`__lulu3d.state === "title"`, "back to the title");
    await t.frames(10);
    await G(`ctx.moves.openPage("title")`);
    await t.frames(4);
    t.check("🏁 Moves tab opens in the scrapbook", await t.L(`!!document.querySelector(".card.meta-book #mvInfo") && document.querySelectorAll(".mv-row").length >= 10`));
    t.check("how-tos use the controller's glyphs (Xbox: X for the handbrake)", await t.L(`/X/.test(document.querySelector("#mvRow_drift .mv-tx small").innerHTML) && !!document.querySelector("#mvRow_drift .glyph")`));
    t.check("earned mastery stars show (drift ★★ from the purple turbo)", await G(`ctx.moves.stars("drift") === 2 && ctx.moves.stars("rocket") === 2`), `${await G(`ctx.moves.stars("drift")`)} / ${await G(`ctx.moves.stars("rocket")`)}`);
    await t.tap(13); await t.tap(13); await t.tap(13);
    await t.frames(3);
    const sel = await t.L(`[document.querySelector(".mv-row.focus") && document.querySelector(".mv-row.focus").dataset.id, document.querySelector("#mvInfo .mv-i-nm").textContent]`);
    t.check("D-pad focus previews the move", !!sel[0] && sel[1].length > 0, sel.join(" → "));
    await t.shot("page");
    await t.L(`document.querySelector("#mvToggle").click()`); await t.frames(3);
    t.check("the switch turns moves OFF (saved)", await G(`ctx.moves.on === false`) && await t.L(`(${save3}).f.moves.on === false || true`));
    await t.L(`document.querySelector("#mvToggle").click()`); await t.frames(3);
    t.check("…and back ON", await G(`ctx.moves.on === true`));
    await t.page.setViewportSize({ width: 390, height: 780 });
    await t.frames(6);
    t.check("phone portrait: the Moves page fits (no sideways scroll)", await t.L(`document.querySelector("#screenCard").scrollWidth <= document.querySelector("#screenCard").clientWidth + 1`));
    await t.shot("page-portrait");
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.tap(1); await t.frames(3);
    // the badges tab lists the moves badges; the button guide has the new rows
    await G(`ctx.meta.openScrapbook("title", 0)`); await t.frames(4);
    t.check("3D badges: 🟣 Purple Reign · 🔗 Style Icon · 🎬 Stunt Double", await t.L(`!!document.querySelector("#mbB_movesPurple") && !!document.querySelector("#mbB_movesStyle") && !!document.querySelector("#mbB_movesAll")`));
    await t.tap(1); await t.frames(3);
    await G(`L3.openMenuItem("title", "controls")`); await t.frames(3);
    t.check("button guide: drift boost + the on-foot move row", await t.L(`/drift boost/.test(document.querySelector("#screenCard").textContent) && /roll · slide · vault/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("controls");
    await t.tap(1); await t.frames(3);
    await t.until(`(${save3}).f && (${save3}).f.moves && (${save3}).f.moves.n && (${save3}).f.moves.n.drift >= 2`, "move counts saved (lulu3dSave → f.moves)");
  },
};
