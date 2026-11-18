// QoL / consistency regressions (the owner's list):
//   • the touch pedal that reverses says REVERSE (parking lot + the road), the parking hint says reverse
//   • the precinct walk-in / walk-out wear the world's time of day + weather (atmos.dress), no jump between them
//   • the pull-over parking lot is lit like the road she pulled off (night → a night lot)
//   • leaving jail follows what happened to her wheels: her own car → drives out · a stolen ride → walks out
//     (never handed the stolen car back) · the ER discharge after a stolen ride → on foot
//   • pepper spray works ON FOOT (D-pad ↓ / G / the SPRAY touch button): aims where she faces, hits people + critters
module.exports = {
  name: "qol",
  query: "&enable=atmos",
  save2d: { totalCoins: 20000, pepperSpray: 6, convictions: 0, offenses: 0, escapes: 0, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const st = () => t.game(`ctx.state`);
    const D = `ctx.law._dbg`;
    const CELL = `__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawBail")`;
    async function tapUntil(code, label, max = 400) {
      for (let i = 0; i < max; i++) { if (await t.game(code)) return true; await t.tap(0); }
      return t.check(label, false, "never reached: " + code + " · state " + await st());
    }
    const viewLook = `(ctx.view && ctx.view.scene.userData.atmosLook) || null`;

    // ── 1. the touch pedal: REVERSE where it reverses ─────────────────────
    await t.game(`ctx.parking.start({ challenge: true, level: 1 })`);
    await t.until(`__lulu3d.state === "parking" && /Park between/.test((document.querySelector("#parkHud .ph-hint") || {}).textContent || "")`, "parking: the drive phase starts", 120000);
    await t.frames(4);
    t.check("parking: the stopped car's pedal says REVERSE", await t.L(`document.getElementById("tBrake").textContent`) === "REVERSE", await t.L(`document.getElementById("tBrake").textContent`));
    const hint = await t.L(`document.querySelector("#parkHud .ph-hint").textContent`);
    t.check("parking: the hint names reverse (not 'BRAKE to move')", /reverse/i.test(hint) && !/BRAKE to move/.test(hint), hint);
    await t.shot("parking-reverse");
    await t.game(`L3.setState("title")`);
    await t.until(`__lulu3d.state === "title"`, "back to the title");
    t.check("the pedal goes back to BRAKE off the road", await t.L(`document.getElementById("tBrake").textContent`) === "BRAKE");

    await t.game(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "cruise starts", 120000);
    await t.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ${D}.L.grace = 999, ctx.law.hold(999))`);
    await t.game(`(() => { const c = ctx.car; c.vx = Math.sin(c.h) * 18; c.vz = Math.cos(c.h) * 18; })()`);
    await t.frames(4);
    t.check("on the road at speed: BRAKE", await t.L(`document.getElementById("tBrake").textContent`) === "BRAKE");
    await t.game(`(() => { const c = ctx.car; c.vx = c.vz = 0; })()`);
    await t.hold(6, 1);           // holding the brake from a stop backs her up
    await t.frames(10);
    await t.hold(6, 0);
    t.check("stopped / backing up on the road: REVERSE", await t.L(`document.getElementById("tBrake").textContent`) === "REVERSE");

    // ── 2. the precinct at night in the rain (atmos.dress) ────────────────
    await t.game(`(ctx.atmos.debug.freeze(true), ctx.atmos.debug.time("night"), ctx.atmos.debug.weather("rain", 1, true))`);
    await t.frames(20);
    const road = await t.game(`(() => { const l = ctx.atmos.look(); return { night: l.night, rain: l.rain, src: l.src }; })()`);
    t.check("atmos.look() reads the live night + rain", road.night > 0.6 && road.rain > 0.5 && road.src === "atmos", JSON.stringify(road));
    await t.shot("road-night-rain");
    await t.game(`L3.setState("lawJail", { charges: ["SPEEDING"], arrive: true, sResume: ctx.car.s + 200 })`);
    await t.until(`!!(${viewLook})`, "the precinct exterior is dressed", 120000);
    await t.frames(20);
    const inLook = await t.game(viewLook);
    t.check("walk-in: the precinct shows the night", inLook && inLook.night > 0.6, JSON.stringify(inLook));
    t.check("walk-in: …and the rain", inLook && inLook.rain > 0.5);
    t.check("walk-in: the lamps are on after dark", inLook && inLook.lamps > 0.5);
    t.check("the arrest noted her own car (ride 'own')", await t.game(`${D}.run.ride`) === "own");
    await t.shot("precinct-walkin-night-rain");
    if (!await tapUntil(CELL, "to the cell")) return;
    await t.game(`document.querySelector("#lawBail").click()`);
    await t.until(`__lulu3d.state === "lawExit"`, "bail → walking out", 60000);
    await t.until(`!!(${viewLook})`, "the walk-out is dressed", 60000);
    await t.frames(20);
    const outLook = await t.game(viewLook);
    t.check("walk-out: the same night sky (no jump)", outLook && Math.abs(outLook.night - inLook.night) < 0.05 && outLook.sky === inLook.sky, JSON.stringify(outLook));
    t.check("walk-out: still raining", outLook && outLook.rain > 0.5);
    t.check("bail in her own car → she drives out", await t.game(`ctx.stateData && ctx.stateData.dest`) === "drive");
    await t.shot("precinct-walkout-night-rain");
    await t.until(`["intro", "playing"].includes(__lulu3d.state)`, "back on the road after bail", 120000);
    t.check("…in her own car, not on foot", await t.game(`!ctx.foot.active && !ctx.foot.borrowed`));

    // ── 3. arrested in a STOLEN ride: it is never handed back ─────────────
    await t.until(`__lulu3d.state === "playing"`, "driving again", 60000);
    await t.game(`(${D}.L.grace = 999, ctx.atmos.debug.time("noon"), ctx.atmos.debug.weather("clear", 1, true))`);
    await t.game(`(() => { const c = ctx.car; ctx.foot.drive({ vtype: "car", key: "sedan", colors: { Paint: "#E53935" }, x: c.pos.x, z: c.pos.z, h: c.h, how: "test" }); })()`);
    await t.frames(4);
    t.check("driving a 'borrowed' sedan", await t.game(`ctx.foot.borrowed === "car" && ctx.foot.ownCar === "gone"`));
    await t.game(`L3.setState("lawJail", { charges: ["GRAND THEFT AUTO"], sResume: ctx.car.s + 200 })`);
    await t.frames(2);
    t.check("the arrest noted a stolen ride", await t.game(`${D}.run.ride`) === "stolen");
    if (!await tapUntil(CELL, "to the cell (stolen)")) return;
    await t.game(`document.querySelector("#lawBail").click()`);
    await t.until(`__lulu3d.state === "lawExit"`, "bail → walking out (stolen)", 60000);
    t.check("bail after a stolen ride → she walks out", await t.game(`ctx.stateData && ctx.stateData.dest`) === "foot");
    await t.frames(20);
    t.check("the walk-out says why", /owner/i.test(await t.L(`document.getElementById("lawUI").textContent`)));
    await t.shot("walkout-stolen");
    await t.until(`__lulu3d.state === "footRun"`, "on foot outside", 120000);
    t.check("…on foot, the stolen ride gone", await t.game(`ctx.foot.active && !ctx.foot.borrowed && ctx.foot.ownCar === "gone"`));

    // ── 4. the ER after crashing a stolen ride: walks out, no car ─────────
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "walking", 60000);
    await t.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ vtype: "car", key: "sedan", colors: { Paint: "#42A5F5" }, x: p.x, z: p.z, h: ctx.car.h, how: "test" }); })()`);
    await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.foot.borrowed === "car"`, "hops in another 'borrowed' car", 30000);
    await t.game(`ctx.er.admit("crash", { force: { intro: false, visitor: false } })`);
    await t.until(`__lulu3d.state === "cameosER"`, "the ER", 60000);
    for (let i = 0; i < 120 && !["playing", "footRun"].includes(await st()); i++) {
      if (await t.L(`!!document.querySelector("#dialog.open .opt") && document.querySelector("#dialog .opt").style.visibility === "visible"`)) {
        await t.L(`document.querySelector("#dialog .opt").click()`); await t.frames(3); continue;
      }
      await t.tap(0); await t.frames(2);
    }
    await t.until(`["playing", "footRun"].includes(__lulu3d.state)`, "discharged", 60000);
    await t.frames(6);
    t.check("ER after a stolen ride → discharged on foot, not back in it", await t.game(`ctx.state === "footRun" && !ctx.foot.borrowed`), await st());

    // ── 5. pepper spray ON FOOT ──────────────────────────────────────────
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "walking (spray)", 60000);
    await t.until(`!!__lulu3d.ctx.foot.debug.spawnPed({ key: "npcWoman", s: __lulu3d.ctx.foot.debug.F.s + 4, d: __lulu3d.ctx.foot.debug.F.d, speed: 0, drunk: false })`, "a pedestrian to spray", 60000);
    const facePed = `(() => { const F = ctx.foot.debug.F, p = F.peds[F.peds.length - 1].p.obj.position; F.lulu.obj.rotation.y = Math.atan2(p.x - F.pos.x, p.z - F.pos.z); return true; })()`;
    await t.game(facePed);
    const n0 = await t.game(`ctx.garage.items().pepper`);
    t.check("the SPRAY touch button is offered on foot", await t.L(`(document.getElementById("tx_garage_pepper") || {}).dataset.v === "true"`));
    await t.tap(13);              // D-pad ↓
    await t.frames(3);
    t.check("D-pad ↓ on foot sprays the person she faces (a charge used)", (await t.game(`ctx.garage.items().pepper`)) === n0 - 1, `${n0} → ${await t.game(`ctx.garage.items().pepper`)}`);
    t.check("…who stumbles off, eyes streaming", await t.game(`ctx.foot.debug.F.peds.some(p => p.sprayT > 0)`));
    await t.shot("pepper-foot");
    await t.until(`!!__lulu3d.ctx.foot.debug.spawnAnimal({ key: "foot_duck", s: __lulu3d.ctx.foot.debug.F.s + 3, d: __lulu3d.ctx.foot.debug.F.d })`, "a duck to spray", 60000);
    await t.game(`(() => { const F = ctx.foot.debug.F, a = F.animals[F.animals.length - 1]; if (!a) return false; const p = a.p.obj.position; F.lulu.obj.rotation.y = Math.atan2(p.x - F.pos.x, p.z - F.pos.z); return true; })()`);
    await t.key("g");             // keyboard G
    await t.frames(3);
    t.check("G on the keyboard sprays too (a critter scoots off)", (await t.game(`ctx.garage.items().pepper`)) === n0 - 2 && await t.game(`ctx.foot.debug.F.animals.some(a => a.scoot > 0)`));
  },
};
