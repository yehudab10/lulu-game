// Interiors: each building Lulu walks into on foot (bar, school, hospital,
// precinct, beach) entered through ctx.interiors[id].enter({ exit }) from the
// title screen, driven with the fake controller: walk with the stick, use the
// hotspots with A/✕, check rewards land in the shared 2D wallet, services
// (liquid courage, settle charges, rest & heal) work, and the door hands back
// to the caller's exit().
const W = `(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`;

module.exports = {
  name: "interiors",
  save2d: { totalCoins: 500, wanted: ["JAYWALKING", "GRAND THEFT AUTO"] },
  async run(t) {
    await t.frames(10);
    const ONLY = (process.env.INTERIORS_ONLY || "bar,school,hospital,police,beach,layout").split(",");
    t.check("all five interiors register", await t.game(`["bar","school","hospital","police","beach"].every(k => ctx.interiors[k] && typeof ctx.interiors[k].enter === "function" && ctx.interiors[k].name)`));

    // helpers living in the page
    await t.game(`(window.__it = {
      room: () => window.__interiors && window.__interiors.room,
      go(id, after) { window.__exited = 0; return ctx.interiors[id].enter({ exit: () => { window.__exited++; L3.setState(after || "title"); } }); },
      // teleport Lulu next to a hotspot and face it
      at(id) { const r = this.room(), h = r.hots.find(h => h.id === id); if (!h) return false;
        const x = h.x, z = h.z;
        const o = r.lulu.obj; o.position.x = x; o.position.z = z + Math.min(h.r * 0.5, 0.6); r.collide(o.position, 0.32);
        o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z); return true; },
      near: () => { const r = window.__interiors.room; return r && r.near ? r.near.id : null; },
    }, true)`);

    async function enter(id, after) {
      await t.game(`__it.go(${JSON.stringify(id)}, ${JSON.stringify(after || "title")})`);
      return t.until(`window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.fadeIn >= 1`, `${id}: the set loads`, 60000);
    }
    async function use(id, label) {
      await t.game(`__it.at(${JSON.stringify(id)})`);
      await t.frames(3);
      const near = await t.game(`__it.near()`);
      t.check(`${label}: prompt shows`, near === id, `near=${near}`);
      await t.tap(0);
      return near === id;
    }
    async function advance(max = 12) {   // click through any open dialogue lines
      for (let i = 0; i < max; i++) {
        if (!await t.game(`ctx.dialogOpen`)) { await t.frames(3); if (!await t.game(`ctx.dialogOpen`)) return; }
        await t.tap(0); await t.frames(2);
      }
    }
    async function leave(id, after = "title") {
      await t.game(`__it.at("door")`); await t.frames(3);
      await t.tap(0);
      await t.until(`__lulu3d.state === ${JSON.stringify(after)} && window.__exited === 1`, `${id}: the door hands back to exit()`, 20000);
      t.check(`${id}: leaving disposes the set`, await t.game(`ctx.view === null && !window.__interiors.room && !document.body.classList.contains("lulu-interior")`));
    }

    // ── THE THIRSTY SCHOLAR ──────────────────────────────────────────
    if (ONLY.includes("bar") && await enter("bar", "playing")) {
      t.check("bar: state + set view", await t.game(`ctx.state === "interior" && ctx.view !== null`));
      await t.frames(20);
      await t.shot("bar-enter");
      // walk with the stick (up = into the room)
      const z0 = await t.game(`__it.room().lulu.obj.position.z`);
      await t.stick(0.3, -1); await t.frames(20); await t.stick(0, 0); await t.frames(4);
      const z1 = await t.game(`__it.room().lulu.obj.position.z`);
      t.check("bar: the stick walks Lulu into the room", z1 < z0 - 1, `${z0.toFixed(2)} → ${z1.toFixed(2)}`);
      // Sol: free seltzer ⭐ + 3 coins (first time only)
      let w0 = await t.L(W);
      await use("bartender", "bar: Sol");
      await t.frames(8);
      t.check("bar: talking opens the dialogue", await t.game(`ctx.dialogOpen`));
      await t.shot("bar-sol");
      await advance();
      await t.frames(40);
      let w1 = await t.L(W);
      t.check("bar: free seltzer = ⭐ + 3 coins", w1 - w0 === 4, `${w0} → ${w1}`);
      await use("bartender", "bar: Sol again"); await t.frames(6); await advance(); await t.frames(40);
      t.check("bar: the seltzer is once per visit", (await t.L(W)) === w1);
      // the passed-out guy: +2, once
      w0 = await t.L(W);
      await use("passed", "bar: snoozer"); await t.frames(6); await advance(); await t.frames(40);
      t.check("bar: chip-clip keys +2", (await t.L(W)) - w0 === 2);
      // clink with the tipsy regular: forced +4 "my round!"
      await t.game(`window.__interiors.force.clink = 4`);
      w0 = await t.L(W);
      await use("drunkB", "bar: clink"); await t.frames(6); await advance(); await t.frames(40);
      t.check("bar: clink glasses → my round +4", (await t.L(W)) - w0 === 4);
      // liquid courage: −35, buff armed
      w0 = await t.L(W);
      await use("courage", "bar: liquid courage"); await t.frames(6); await advance(); await t.frames(40);
      t.check("bar: liquid courage costs 35", w0 - (await t.L(W)) === 35);
      // the jukebox dance: Lulu boogies on the disco floor
      await use("jukebox", "bar: jukebox"); await t.frames(6); await advance(2);
      await t.until(`window.__interiors.room && window.__interiors.room.data.dancing`, "bar: the jukebox starts the dance", 20000);
      for (let i = 0; i < 6; i++) { await t.tap(0); await t.frames(4); }
      await t.shot("bar-dance");
      await t.until(`!window.__interiors.room.data.dancing`, "bar: the dance ends", 40000);
      await advance();
      await t.frames(10);
      await t.shot("bar-after");
      await leave("bar", "playing");
      // back on the road (the same run): the courage shield vetoes a heart and doubles points
      await t.frames(6);
      const h0 = await t.game(`ctx.G.hearts`);
      await t.game(`(ctx.G.invT = 0, L3.damage(1, "test", "test"))`);
      t.check("courage shields Lulu's next drive", (await t.game(`ctx.G.hearts`)) === h0, `${h0} → ${await t.game(`ctx.G.hearts`)}`);
      const sc0 = await t.game(`ctx.G.score`);
      await t.hold(7, 1); await t.frames(30); await t.hold(7, 0);
      const gained = (await t.game(`ctx.G.score`)) - sc0, dist = await t.game(`ctx.G.distance`);
      t.check("courage doubles the points", gained > dist * 1.5, `+${gained.toFixed(0)} pts for ${dist.toFixed(0)} m`);
      t.check("courage chip on the HUD", await t.L(`[...document.querySelectorAll(".int-meter")].some(e => e.offsetParent && /COURAGE/.test(e.textContent))`));
      await t.shot("bar-courage-drive");
      await t.game(`L3.setState("title")`);
      await t.frames(4);
    }

    // ── CHEDER ON THE CORNER ─────────────────────────────────────────
    if (ONLY.includes("school") && await enter("school")) {
      await t.frames(16);
      await t.shot("school-enter");
      let w0 = await t.L(W);
      await use("bake", "school: bake sale"); await t.frames(6); await advance(); await t.frames(40);
      let w1 = await t.L(W);
      t.check("school: bake sale +6 the first time", w1 - w0 === 6, `${w0} → ${w1}`);
      await use("bake", "school: bake sale again"); await t.frames(6); await advance(); await t.frames(40);
      t.check("school: then +1 ⭐ one more nosh", (await t.L(W)) - w1 === 1);
      await use("morah", "school: Morah"); await t.frames(10);
      t.check("school: the Morah talks", await t.L(`/MORAH/i.test(document.querySelector("#dialog .name").textContent)`));
      await t.shot("school-morah");
      await advance();
      await use("fountain", "school: fountain"); await t.frames(6); await advance();
      await leave("school");
    }

    // ── URGENT CARE ──────────────────────────────────────────────────
    if (ONLY.includes("hospital") && await enter("hospital")) {
      await t.frames(16);
      await t.shot("hospital-enter");
      await t.game(`window.__interiors.force.vend = "snack"`);
      let w0 = await t.L(W);
      await use("vending", "hospital: SNAX"); await t.frames(6); await advance(); await t.frames(40);
      t.check("hospital: the vending machine pays a +5 snack", (await t.L(W)) - w0 === 5);
      await t.game(`(window.__interiors.force.vend = "eat", ctx.G.coins = Math.max(ctx.G.coins, 3))`);
      w0 = await t.L(W);
      await use("vending", "hospital: SNAX again"); await t.frames(6); await advance(); await t.frames(40);
      t.check("hospital: …or it EATS a coin", (await t.L(W)) - w0 === -1);
      w0 = await t.L(W);
      await use("heshy", "hospital: Heshy"); await t.frames(10);
      await t.shot("hospital-heshy");
      await advance(); await t.frames(40);
      t.check("hospital: Heshy's get-well gelt ⭐ + 3", (await t.L(W)) - w0 === 4);
      await use("doctor", "hospital: the doctor"); await t.frames(6); await advance();
      await leave("hospital");
    }

    // ── PRECINCT 18½ ─────────────────────────────────────────────────
    if (ONLY.includes("police") && await enter("police")) {
      await t.frames(16);
      await t.shot("police-enter");
      let w0 = await t.L(W);
      await use("coffee", "police: coffee"); await t.frames(6); await advance(); await t.frames(40);
      t.check("police: precinct coffee +30", (await t.L(W)) - w0 === 30);
      await use("coffee", "police: coffee again"); await t.frames(6); await advance(); await t.frames(40);
      t.check("police: the coffee coins are once a visit", (await t.L(W)) - w0 === 30);
      // settle charges: 2 on file → 50 + 2×40 = 130
      w0 = await t.L(W);
      await use("fines", "police: fines window"); await t.frames(8);
      await advance(1);                     // finish typing → options show
      await t.frames(4);
      t.check("police: the fines window offers to settle for 130", await t.L(`/130/.test(document.querySelector("#dialog").textContent)`));
      await t.tap(0); await t.frames(10); await advance(); await t.frames(30);
      t.check("police: paying the fine costs 130", w0 - (await t.L(W)) === 130, `${w0} → ${await t.L(W)}`);
      t.check("police: …and wipes the wanted file", await t.L(`(JSON.parse(localStorage.getItem("luluSaveV2")).wanted || []).length === 0`));
      await use("board", "police: most wanted"); await t.frames(6); await advance();
      await use("cell", "police: the perp"); await t.frames(8);
      await t.shot("police-perp");
      await advance();
      // the sneak-out: army-crawl, nabbed by a K9 — she's shooed out either way
      await t.game(`Object.assign(window.__interiors.force, { escape: true, escapeKind: "crawl", caught: true, gag: "k9" })`);
      await t.game(`__it.at("door")`); await t.frames(3);
      await t.tap(0);
      await t.until(`window.__interiors.room && window.__interiors.room.data.escaping === "crawl"`, "police: the sneak-out plays", 20000);
      await t.frames(30);
      await t.shot("police-sneakout");
      await t.until(`window.__interiors.room && window.__interiors.room.data.dog`, "police: …and the K9 nabs her", 30000);
      await t.frames(10);
      await t.shot("police-nabbed");
      await t.until(`__lulu3d.state === "title" && window.__exited === 1`, "police: shooed back out to the street", 30000);
      t.check("police: out after the sneak-out", await t.game(`ctx.state === "title" && !window.__interiors.room`));
    }

    // ── SHTRAND-BY-THE-SEA ───────────────────────────────────────────
    if (ONLY.includes("beach") && await enter("beach")) {
      await t.frames(16);
      await t.shot("beach-enter");
      let w0 = await t.L(W);
      await use("icecream", "beach: ice cream"); await t.frames(6); await advance(); await t.frames(40);
      t.check("beach: ice cream +25 and a ⭐", (await t.L(W)) - w0 === 26);
      t.check("beach: Lulu has a cone", await t.game(`window.__interiors.room.inHandName === "Cone"`));
      await use("gull", "beach: seagull"); await t.frames(6); await advance(); await t.frames(10);
      t.check("beach: the seagull steals the cone", await t.game(`window.__interiors.room.inHandName === null && !!window.__interiors.room.data.gullSteal`));
      await t.shot("beach-gull");
      for (let i = 0; i < 2; i++) { await use("castle", "beach: sandcastle " + (i + 1)); await t.frames(6); await advance(); await t.frames(16); }
      t.check("beach: helping builds the sandcastle", await t.game(`window.__interiors.room.data.castleN === 2`));
      await t.shot("beach-castle");
      // rest & heal at the cabana: 1 heart → full, −40
      await t.game(`(ctx.G.hearts = 1)`);
      w0 = await t.L(W);
      await use("cabana", "beach: cabana"); await t.frames(10);
      await t.shot("beach-cabana");
      await advance(); await t.frames(30);
      t.check("beach: rest & heal refills the hearts", await t.game(`ctx.G.hearts === ctx.G.maxHearts`));
      t.check("beach: …for 40 coins", w0 - (await t.L(W)) === 40);
      // ○ asks to leave → ✕ leaves
      await t.frames(6);
      await t.tap(1); await t.frames(8);
      t.check("beach: ○ asks “Head back outside?”", await t.L(`/outside/i.test(document.querySelector("#dialog").textContent)`));
      await advance(1); await t.tap(0);
      await t.until(`__lulu3d.state === "title" && window.__exited === 1`, "beach: ○ → leave → exit()", 20000);
    }
    // keyboard: E uses a hotspot
    if (ONLY.includes("school") && await enter("school")) {
      await t.game(`__it.at("clock")`); await t.frames(3);
      await t.key("e"); await t.frames(6);
      t.check("keyboard E uses a hotspot", await t.game(`ctx.dialogOpen`));
      await advance();
      await t.game(`window.__interiors.room.leave()`);
      await t.until(`__lulu3d.state === "title"`, "school (keyboard): leaves", 20000);
    }
    // layouts: phone portrait with the touch controls, then TV mode
    if (ONLY.includes("layout")) {
      await t.page.setViewportSize({ width: 390, height: 780 });
      await t.game(`(L3.input.device = "touch", true)`);
      if (await enter("hospital")) {
        await t.game(`__it.at("vending")`); await t.frames(12);
        t.check("touch: the ✋ USE button shows near a hotspot", await t.L(`(() => { const b = document.getElementById("tx_intTalk"); return !!b && b.offsetParent !== null; })()`));
        t.check("touch: the driving pedals are hidden inside", await t.L(`getComputedStyle(document.querySelector("#touch .pedals")).display === "none"`));
        await t.shot("layout-portrait-touch");
        await t.game(`window.__interiors.room.leave()`);
        await t.until(`__lulu3d.state === "title"`, "portrait: leaves", 20000);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.game(`(L3.input.device = "gamepad", document.body.classList.add("tv"), true)`);
      if (await enter("beach")) {
        await t.game(`__it.at("lifeguard")`); await t.frames(12);
        await t.shot("layout-tv");
        await t.game(`window.__interiors.room.leave()`);
        await t.until(`__lulu3d.state === "title"`, "tv: leaves", 20000);
      }
      await t.game(`(document.body.classList.remove("tv"), true)`);
    }
  },
};

