// Banter (personality): Lulu animated at the wheel (the carved driver rig —
// hands ride the wheel, she leans and looks), her one-liners (small bubbles,
// left of the road's centre, never while paused), the road talking back
// (honk → the car ahead answers; wrong-way drivers panic; a fist after a near
// miss; roadside onlookers), and the billboards streaming in and getting
// cleaned up with their chunks.
module.exports = {
  name: "banter",
  query: "&enable=banter",
  save2d: { convictions: 2, offenses: 3, avigailRel: 20 },
  async run(t) {
    const g = t.game;
    t.check("service is up", await g(`!!ctx.banter && typeof ctx.banter.say === "function"`));
    await g(`(ctx.banter.knobs.always = true)`);

    // ── the title screen: Lulu bops along on autopilot ─────────────────────
    const tp0 = await g(`ctx.banter.pose()`);
    await t.frames(12);
    const tp1 = await g(`ctx.banter.pose()`);
    t.check("driver rig carved into torso / head / arms", tp0.ok && !tp0.rigid && tp0.parts >= 4, JSON.stringify(tp0).slice(0, 160));
    const diff = (a, b) => (a && b ? Math.max(...a.map((v, i) => Math.abs(v - b[i]))) : 0);
    t.check("she moves on the title screen (bop / steer)", diff(tp0.head, tp1.head) > 0.002 || diff(tp0.armL, tp1.armL) > 0.002,
      `head Δ${diff(tp0.head, tp1.head).toFixed(4)} arm Δ${diff(tp0.armL, tp1.armL).toFixed(4)}`);

    await g(`(ctx.banter.gesture("wave", 2.5), true)`);
    await t.frames(10);
    await t.shot("title-wave");

    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "drive starts")) return;

    // put the car at (s, d) heading down the road at v m/s, traffic cleared
    const tp = (s, d, v) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {});
      ctx.traffic.clear(); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.G.invT = 0; ctx.G.hearts = 3; ctx.cam.snap(); return true; })()`);
    const S = () => g(`ctx.car.s`);

    // ── 1. the rig follows the wheel ───────────────────────────────────────
    await tp(300, 1.75, 16);
    await t.frames(4);
    const p0 = await g(`ctx.banter.pose()`);
    await t.hold(7, 0.6);
    await t.stick(0.85);
    await t.frames(16);
    const p1 = await g(`ctx.banter.pose()`);
    await t.shot("steer");
    await t.stick(0);
    t.check("her hands turn with the wheel", diff(p0.armL, p1.armL) > 0.04 && diff(p0.armR, p1.armR) > 0.04,
      `armL Δ${diff(p0.armL, p1.armL).toFixed(3)} armR Δ${diff(p0.armR, p1.armR).toFixed(3)}`);
    t.check("she leans into the turn", diff(p0.body, p1.body) > 0.008, `body Δ${diff(p0.body, p1.body).toFixed(4)}`);
    t.check("her head turns with the steering", diff(p0.head, p1.head) > 0.01, `head Δ${diff(p0.head, p1.head).toFixed(4)}`);
    await t.hold(7, 0);

    // ── 1b. a cop chase: she checks over her shoulder ──────────────────────
    await g(`(L3.emit("cop:chase", { active: true, reason: "test" }), true)`);
    let maxYaw = 0;
    for (let i = 0; i < 6; i++) { await t.frames(4); const q = (await g(`ctx.banter.pose()`)).head; maxYaw = Math.max(maxYaw, Math.abs(q[1])); }
    t.check("in a chase she looks back over her shoulder", maxYaw > 0.45, `head yaw quat.y ${maxYaw.toFixed(3)}`);
    await t.shot("cop-look");
    await g(`(L3.emit("cop:chase", { active: false, result: "escaped" }), true)`);

    // ── 2. honk at the car ahead → its driver answers ──────────────────────
    let s0 = (await S()) + 60;
    await tp(s0, 1.75, 13);
    await g(`(window.__hc = ctx.traffic.add("sedan", ${s0 + 26}, 1.75, 1, 11), true)`);
    await t.frames(3);
    const r0 = await g(`ctx.banter.npc.replies`);
    await t.tap(4);
    await t.until(`window.__lulu3d.ctx.banter.npc.replies > ${r0}`, "honking at the car ahead gets an answer", 6000);
    t.check("honking at the car ahead gets an answer", await g(`ctx.banter.npc.replies`) > r0, JSON.stringify(await g(`ctx.banter.npc.lastReply`)));
    await t.frames(6);
    const rects = await g(`ctx.banter.rects()`);
    const npcR = rects.find(r => r.who === "npc");
    t.check("…in a speech bubble over that car", !!npcR, JSON.stringify(rects).slice(0, 200));
    await t.shot("honk-reply");
    const vw = await t.L(`innerWidth`), vh = await t.L(`innerHeight`);
    if (npcR) t.check("the driver's bubble is small", npcR.w < vw * 0.3 && npcR.h < vh * 0.14, `${npcR.w.toFixed(0)}×${npcR.h.toFixed(0)}`);
    t.check("…and a hand comes out of the window", (await g(`ctx.banter.arms()`)).length > 0, JSON.stringify(await g(`ctx.banter.arms()`)));
    await g(`ctx.banter.reply(window.__hc, 2)`);
    t.check("honk twice and they get annoyed", (await g(`ctx.banter.npc.lastReply.cat`)) === "honkAgain");

    // ── 3. a close call → Lulu says something ──────────────────────────────
    await t.frames(10);
    let said = false;
    for (let i = 0; i < 4 && !said; i++) {
      await g(`(ctx.banter.resetThrottle(), L3.emit("closeCall", { oncoming: true, combo: 1 }), true)`);
      await t.frames(3);
      said = (await g(`ctx.banter.lulu.lastCat`)) === "dodge" && !!(await g(`ctx.banter.line`));
    }
    t.check("a close call gets a Lulu line", said, await g(`ctx.banter.line`));
    await t.frames(8);
    const lr = (await g(`ctx.banter.rects()`)).find(r => r.who === "lulu");
    t.check("Lulu's bubble is on screen", !!lr);
    if (lr) {
      t.check("Lulu's bubble is small", lr.w < vw * 0.34 && lr.h < vh * 0.2, `${lr.w.toFixed(0)}×${lr.h.toFixed(0)} of ${vw}×${vh}`);
      t.check("…and stays off the road's centre (left half)", lr.x + lr.w <= vw / 2 + 2 && lr.x >= 0, `x ${lr.x.toFixed(0)}–${(lr.x + lr.w).toFixed(0)}`);
    }
    await t.shot("lulu-line");

    // ── 4. never while paused ──────────────────────────────────────────────
    await g(`ctx.banter.say("Testing, testing!")`);
    await t.frames(2);
    t.check("a forced line shows", (await g(`ctx.banter.line`)) === "Testing, testing!");
    await t.tap(9);
    t.check("paused", await g(`ctx.paused === true`));
    await t.frames(2);
    t.check("no bubbles while paused", (await g(`ctx.banter.rects().length`)) === 0 &&
      await t.L(`document.getElementById("banterBubbles").classList.contains("off")`));
    await g(`ctx.banter.say("closeCall")`);
    t.check("…and she can't be made to talk while paused", (await g(`ctx.banter.line`)) === "");
    await t.tap(1);
    t.check("resumed", await g(`ctx.paused === false && ctx.state === "playing"`));

    // ── 5. wrong lane: the oncoming driver panics ──────────────────────────
    s0 = (await S()) + 60;
    await tp(s0, -1.75, 12);
    const w0 = await g(`ctx.banter.npc.wrongWays`);
    await g(`(ctx.traffic.add("sedan", ${s0 + 70}, -1.75, -1, 10), true)`);
    await t.until(`window.__lulu3d.ctx.banter.npc.wrongWays > ${w0}`, "an oncoming driver yells at Lulu in the wrong lane", 6000);
    t.check("an oncoming driver yells at Lulu in the wrong lane", (await g(`ctx.banter.npc.wrongWays`)) > w0);
    await t.frames(4);
    await t.shot("wrong-way");
    await tp((await S()) + 40, 1.75, 0);

    // ── 6. a near miss: a fist out of the window ───────────────────────────
    s0 = (await S()) + 50;
    await tp(s0, 1.75, 20);
    await g(`(window.__nm = ctx.traffic.add("van", ${s0 + 4}, 5.25, 1, 12), true)`);
    const f0 = await g(`ctx.banter.npc.fists`);
    await g(`(L3.emit("closeCall", { oncoming: false, combo: 1 }), true)`);
    await t.frames(3);
    t.check("a near-missed driver shakes a fist", (await g(`ctx.banter.npc.fists`)) > f0 && (await g(`ctx.banter.arms()`)).includes("fist"));

    // ── 7. billboards: forced, then streamed with the road, then recycled ─
    s0 = (await S()) + 80;
    await tp(s0, 1.75, 0);
    await t.frames(4);
    const key = await g(`ctx.banter.billboard("lawyer", 52, 1)`);
    t.check("a billboard can be hung (the lawyers know her record)", key === "lawyer3", String(key));
    await g(`ctx.banter.billboard("kugel", 70, -1)`);
    await t.frames(4);
    await t.shot("billboards");
    // after dark the boards light up
    await g(`(window.__sunI = ctx.lights.sun.intensity, window.__hemiI = ctx.lights.hemi.intensity, ctx.lights.sun.intensity = 0.6, ctx.lights.hemi.intensity = 0.35, true)`);
    await t.frames(3);
    await t.shot("billboards-night");
    await g(`(ctx.lights.sun.intensity = window.__sunI, ctx.lights.hemi.intensity = window.__hemiI, true)`);
    const placed0 = await g(`ctx.banter.billboards.placed`);
    let s = await S();
    for (let i = 0; i < 24; i++) {
      s += 120;
      await tp(s, 1.75, 18);
      await t.frames(5);
      if ((await g(`ctx.banter.billboards.placed`)) > placed0 + 1) break;
    }
    const placed1 = await g(`ctx.banter.billboards.placed`);
    t.check("billboards stream in as the road is built", placed1 > placed0, `${placed0} → ${placed1} (booked ${await g(`ctx.banter.billboards.booked`)})`);
    const list = await g(`ctx.banter.activeBillboards()`);
    const near = list.filter(b => b.s > s && b.s < s + 640).sort((a, b) => a.s - b.s)[0];
    if (near) { await tp(near.s - 40, 1.75, 6); await t.frames(8); await t.shot("billboard-streamed"); }
    const rel0 = await g(`ctx.banter.billboards.released`);
    await tp((await S()) + 3000, 1.75, 0);
    await t.frames(10);
    const rel1 = await g(`ctx.banter.billboards.released`);
    const stale = await g(`ctx.banter.activeBillboards().filter(b => b.s < ctx.car.s - 300).length`);
    t.check("passed billboards are recycled with their chunks", rel1 > rel0 && stale === 0, `released ${rel0} → ${rel1}, stale ${stale}`);
    t.check("…back into the pool", (await g(`ctx.banter.billboards.pooled`)) > 0);
    t.check("bookings don't pile up in world.reserved", (await g(`ctx.banter.billboards.booked`)) <= 4, String(await g(`ctx.banter.billboards.booked`)));

    // ── 8. folks on the roadside wave (or gasp) ────────────────────────────
    await t.until(`window.__lulu3d.ctx.banter.ped() > 0`, "an onlooker shows up", 8000);
    const peds = await g(`ctx.banter.peds()`);
    if (peds.length) {
      const pd = peds[0];
      await tp(pd.s - 45, 1.75, 11);
      const reacted = `(ctx.banter.npc.pedWaves + ctx.banter.npc.pedGasps + ctx.banter.npc.pedCheers)`;
      await t.until(`(() => { const ctx = window.__lulu3d.ctx; return ${reacted} > 0; })()`, "an onlooker reacts as Lulu drives by", 8000);
      t.check("an onlooker reacts as Lulu drives by", (await g(reacted)) > 0, JSON.stringify(await g(`ctx.banter.peds()`)));
      await t.frames(3);
      await t.shot("onlooker");
    }

    // ── 9. back to the title: everything tidied away ───────────────────────
    await g(`L3.setState("title")`);
    await t.frames(4);
    t.check("no bubbles on the title screen", (await g(`ctx.banter.rects().length`)) === 0);
    t.check("no arms left hanging out of windows", (await g(`ctx.banter.arms().length`)) === 0);
    t.check("onlookers go home", (await g(`ctx.banter.peds().length`)) === 0);
  },
};
