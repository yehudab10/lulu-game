// Cameos: Avigail (coupe taunt, pulled over, the porch visit + ride-along,
// the friendship meter), the salon (style + colour → shared save → car hair),
// the sasquatch, Heshy's pool, the uncles, the crash aftermath (revenge car →
// ER, Hillel's insurance reprieve, the animal swarm) and the ER (bill,
// punch card, the bill-skip escape). Driven with the fake controller through
// the real entry points; random spawns are switched off (ctx.cameos.auto).
//   CAMEOS_ONLY=salon,er  → run just those sections (development)
const ONLY = process.env.CAMEOS_ONLY ? new RegExp("^(" + process.env.CAMEOS_ONLY.split(",").join("|") + ")$") : null;
const want = n => !ONLY || ONLY.test(n);

module.exports = {
  name: "cameos",
  query: "&enable=cameos",
  save2d: { totalCoins: 400, avigailRel: 50, luluHair: "#8B5A2B", luluHairStyle: "sheitel", erVisits: 2, missiles: 0 },
  async run(t) {
    const shared = k => t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}")[${JSON.stringify(k)}])`);
    const log = () => t.game(`ctx.cameos.log.slice()`);
    await t.frames(4);
    await t.game(`ctx.cameos.auto = false`);
    t.check("services: ctx.avigail / ctx.er / ctx.cameos / salon door", await t.game(`!!(ctx.avigail && ctx.avigail.rel && ctx.er && ctx.er.admit && ctx.cameos.trigger && ctx.interiors.salon && ctx.interiors.salon.enter)`));
    t.check("avigail meter reads the shared save", await t.game(`ctx.avigail.rel()`) === 50);

    const drive = async () => {
      await t.hold(7, 0);
      await t.game(`(ctx.cameos.force = {}, L3.startRun({ mode: "cruise" }))`);
      await t.until(`__lulu3d.state === "playing"`, "drives");
      await t.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.G.invT = 999)`);
      await t.hold(7, 0.55);
    };
    // choice buttons exist (hidden) while the question is still typing — wait until they're shown
    const OPTS = `!!document.querySelector("#dialog.open .opt") && document.querySelector("#dialog .opt").style.visibility === "visible"`;
    // dialogue / menu masher: ✕ until `done` (an expression) is true
    const mash = async (done, max = 80, pickRe = null) => {
      for (let i = 0; i < max; i++) {
        if (await t.L(done)) return true;
        if (pickRe && await t.L(`!!document.querySelector("#dialog.open .opt")`)) {
          const hit = await t.L(`(() => { const b = [...document.querySelectorAll("#dialog .opt")].find(b => ${pickRe}.test(b.textContent)); if (b) { b.click(); return true; } return false; })()`);
          if (hit) { await t.frames(3); continue; }
        }
        await t.tap(0);
        await t.frames(2);
      }
      return t.L(done);
    };

    if (want("road")) {
      await drive();
      // ── Avigail's coupe: pass her → taunt, +1 💜, weekly-quest stat ──
      await t.game(`ctx.cameos.trigger("avigailCar", { s: ctx.car.s + 26, d: 5.25, speed: 9 })`);
      await t.until(`__lulu3d.ctx.traffic.cars.some(c => c.kind === "avigail")`, "Avigail's coupe joins the traffic");
      await t.frames(6);
      await t.shot("avigail-coupe");
      await t.until(`__lulu3d.ctx.traffic.cars.some(c => c.kind === "avigail" && c.data.taunted)`, "passing Avigail triggers her taunt", 60000);
      t.check("passing Avigail: taunt bubble + 💜 +1 (shared avigailRel)", await shared("avigailRel") === 51, `rel ${await shared("avigailRel")}`);
      t.check("passing Avigail feeds the avigail3 stat", (await log()).includes("avigail3"));
      await t.frames(4);
      await t.shot("avigail-taunt");

      // ── Heshy's pool: cruise past → 4.5 s shield + heshy2 ──
      const c0 = await t.game(`ctx.G.coins`);
      await t.game(`(ctx.G.invT = 0, ctx.cameos.trigger("heshy", { ahead: 55, side: 1 }))`);
      await t.until(`!!__lulu3d.ctx.actors.find(a => a.kind === "heshy")`, "Heshy's yard appears");
      await t.frames(20);
      await t.shot("heshy-pool");
      await t.until(`__lulu3d.ctx.cameos.log.includes("heshy2")`, "driving past Heshy's yard triggers the cameo", 60000);
      t.check("Heshy grants the shield (invincible ≥ 3 s)", await t.game(`ctx.G.invT > 3`));
      await t.frames(10);
      await t.shot("heshy-cannonball");

      // ── an uncle (Burry + Mindy + the kids) on the shoulder: wave + 8 coins ──
      await t.game(`ctx.cameos.trigger("uncle", { id: "burry", ahead: 60, side: 1 })`);
      await t.until(`!!__lulu3d.ctx.actors.find(a => a.kind === "uncle")`, "Uncle Burry appears");
      await t.frames(25);
      await t.shot("uncle-burry");
      await t.until(`__lulu3d.ctx.cameos.log.includes("uncles3")`, "greeting the uncle", 60000);
      t.check("the uncle tips Lulu +8 coins", (await t.game(`ctx.G.coins`)) - c0 >= 8);
      await t.frames(4);
      await t.shot("uncle-greet");

      // ── the sasquatch: honk while he waves → hitchhiker +25 ──
      await t.game(`ctx.cameos.trigger("sasquatch", { ahead: 70, side: 1 })`);
      await t.until(`!!__lulu3d.ctx.actors.find(a => a.kind === "sasquatch" && a.st.phase === 1)`, "the sasquatch steps out and waves", 60000);
      await t.shot("sasquatch-wave");
      const c1 = await t.game(`ctx.G.coins`);
      await t.tap(4);   // L1 = horn
      await t.frames(30);
      t.check("honking picks up the sasquatch (+25)", (await t.game(`ctx.G.coins`)) - c1 >= 25, `+${(await t.game(`ctx.G.coins`)) - c1}`);
      t.check("the sasquatch rides along in the car", await t.game(`!!(ctx.car.attached && (ctx.car.attached.passenger || ctx.car.attached.deck))`));
      await t.shot("sasquatch-passenger");

      // ── Avigail pulled over on the shoulder: catch her mid-tantrum → +2 💜 ──
      const r1 = await shared("avigailRel");
      await t.game(`ctx.cameos.trigger("avigailPulled", { s: ctx.car.s + 70 })`);
      await t.until(`!!__lulu3d.ctx.actors.find(a => a.kind === "avigailPulled")`, "Avigail pulled over by a cop");
      await t.frames(10);
      await t.shot("avigail-pulled");
      await t.until(`JSON.parse(localStorage.getItem("luluSaveV2")).avigailRel >= ${r1 + 2}`, "passing Avigail's traffic stop: +2 💜", 60000);
      t.check("catching Avigail pulled over: +2 💜", (await shared("avigailRel")) === r1 + 2);
    }

    if (want("porch")) {
      await drive();
      // ── Avigail walking by the road → pull up in the right lane → the porch visit ──
      await t.game(`ctx.cameos.trigger("avigailWalker", { s: ctx.car.s + 45 })`);
      await t.until(`!!__lulu3d.ctx.actors.find(a => a.kind === "avigailWalker")`, "Avigail walks by the road");
      await t.stick(0.6); await t.frames(20); await t.stick(0);
      await t.game(`(() => { const r = ctx.world.road, s = ctx.car.s, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.vx = Math.sin(p.h) * 12; ctx.car.vz = Math.cos(p.h) * 12; })()`);
      await t.until(`__lulu3d.state === "cameosPorch"`, "pulling up next to Avigail starts the porch visit", 60000);
      t.check("pulling up next to Avigail starts the porch visit", true);
      const r0 = await shared("avigailRel");
      await t.until(`!!document.querySelector("#dialog.open")`, "Lulu knocks");
      await t.frames(40);
      await t.shot("porch-knock");
      await mash(OPTS, 30);
      await t.frames(6);
      await t.shot("porch-choice");
      t.check("the porch shows the friendship meter chip", await t.L(`/friends|rivals|frenemies/.test(document.getElementById("cameosChips").textContent)`));
      const ok = await mash(`__lulu3d.state === "playing"`, 140, "/rugelach/i");
      t.check("the porch conversation finishes → back on the road", ok);
      const r1 = await shared("avigailRel");
      t.check("surviving the porch visit: +6 💜 (+4 with rugelach)", r1 - r0 === 6 || r1 - r0 === 10, `${r0} → ${r1}`);
      t.check("Avigail rides shotgun (2× points)", await t.game(`ctx.G.avigailRide === true && !!ctx.car.attached.passenger`));
      const sc0 = await t.game(`ctx.G.score`);
      await t.frames(30);
      t.check("score climbs while she rides", (await t.game(`ctx.G.score`)) > sc0);
      await t.shot("avigail-shotgun");
    }

    if (want("salon")) {
      await drive();
      // ── Chez Fabio by the road: pull into the pink lot and stop ──
      await t.game(`ctx.cameos.trigger("salonShop", { ahead: 70 })`);
      await t.until(`!!__lulu3d.ctx.actors.find(a => a.kind === "salonShop")`, "Chez Fabio appears by the road");
      await t.frames(10);
      await t.shot("salon-storefront");
      await t.game(`(() => { const a = ctx.actors.find(a => a.kind === "salonShop"); const p = ctx.world.road.point(a.S, 11.2, {}); ctx.car.place(p.x, p.z, p.h); })()`);
      await t.hold(7, 0);
      await t.until(`__lulu3d.state === "cameosSalon"`, "stopping in the lot enters the salon", 60000);
      t.check("stopping in the lot enters the salon", true);
      await t.until(`!!document.querySelector("#dialog.open")`, "Fabio greets Lulu");
      await t.frames(30);
      await t.shot("salon-fabio");
      await mash(`!!document.querySelector(".salon-card")`, 30);
      t.check("the style picker opens (side panel)", await t.L(`!!document.querySelector(".salon-card") && document.body.classList.contains("cameos-panel")`));
      await t.tap(13);  // D-pad ↓ → BIG & BOUNCY (live preview)
      await t.frames(12);
      t.check("focusing a style previews it on Lulu (live)", await t.game(`ctx.cameos.salon.salonState().preview === "bouncy"`));
      await t.shot("salon-style");
      // the side panel must not break phone portrait or TV mode
      await t.page.setViewportSize({ width: 390, height: 780 });
      await t.frames(6);
      await t.shot("salon-style-portrait");
      t.check("portrait: the style panel fits on screen", await t.L(`(() => { const r = document.getElementById("screenCard").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })()`));
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`document.body.classList.add("tv")`);
      await t.frames(6);
      await t.shot("salon-style-tv");
      await t.L(`document.body.classList.remove("tv")`);
      await t.page.setViewportSize({ width: 960, height: 540 });
      await t.frames(4);
      await t.tap(0);
      await t.until(`!!document.querySelector(".swatch")`, "the colour picker opens");
      await t.tap(13); await t.tap(13);  // ↓ ↓ → PINK
      await t.frames(10);
      await t.shot("salon-colour");
      await t.tap(0);   // pick PINK → confirm
      await t.frames(4);
      t.check("Fabio asks to confirm the colour", await t.L(`/Go PINK/.test(document.getElementById("screenCard").textContent)`));
      await t.tap(0);   // YES!
      await t.frames(90);
      await t.shot("salon-process");
      await mash(`/Leave the salon/.test(document.getElementById("screenCard").textContent) && !document.getElementById("screen").classList.contains("hidden")`, 80);
      await t.shot("salon-reveal");
      t.check("the new look is saved to the shared 2D save", (await shared("luluHair")) === "#FF6FB5" && (await shared("luluHairStyle")) === "bouncy",
        `${await shared("luluHair")} / ${await shared("luluHairStyle")}`);
      t.check("salon visit feeds the salon stat", (await log()).includes("salon"));
      await t.tap(0);
      await t.until(`__lulu3d.state === "playing"`, "leaving the salon → back on the road");
      t.check("Lulu in the car wears the new style + colour", await t.game(`ctx.car.hairStyle === "bouncy" && ctx.car.hairs.some(h => h.name === "Hair_bouncy" && h.visible) && ctx.car.hairMats.some(m => m.color.getHexString() === "ff6fb5")`));
      t.check("on-foot Lulu model (luluPerson_bouncy) is loaded for the foot feature", await t.game(`ctx.cameos.salon.hasFootModel("bouncy")`));
      await t.frames(20);
      await t.shot("car-new-hair");
    }

    if (want("crash")) {
      // ── a car wreck → the driver storms out → revenge car → the ambulance → the ER ──
      await drive();
      const w0 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
      const er0 = await shared("erVisits");
      await t.game(`(ctx.cameos.force = { reprieve: false, er: true, intro: true, mood: "angry", visitor: "hillel", tammy: "scold" }, ctx.G.invT = 0, ctx.cameos.trigger("wreck", { kind: "car" }))`);
      await t.until(`__lulu3d.state === "wrecked"`, "out of hearts → wrecked");
      await t.until(`__lulu3d.state === "cameosCrash"`, "the crash aftermath claims the wreck", 90000);
      t.check("the crash aftermath claims the wreck (hooks.wreck)", true);
      await t.frames(70);
      await t.shot("crash-driver");
      await t.until(`__lulu3d.ctx.cameos.crash.crashScene() && __lulu3d.ctx.cameos.crash.crashScene().slammed`, "the revenge car flattens the angry driver", 90000);
      await t.frames(6);
      await t.shot("crash-revenge");
      await t.until(`__lulu3d.state === "cameosAmbulance"`, "the ambulance gets there first", 90000);
      await t.frames(55);
      await t.shot("er-ambulance");
      await t.until(`__lulu3d.state === "cameosER"`, "Lulu wakes up in the ER", 90000);
      t.check("an ER visit punches the shared card (erVisits +1)", (await shared("erVisits")) === er0 + 1);
      await t.until(`!!document.querySelector("#dialog.open")`, "Dr. Shtern's diagnosis");
      await t.frames(30);
      await t.shot("er-doctor");
      t.check("Dr. Shtern delivers a diagnosis", await t.L(`/You've got/.test(document.querySelector("#dialog .text").textContent) || /DR\\. SHTERN/i.test(document.querySelector("#dialog .name").textContent)`));
      await mash(OPTS, 40);
      await t.shot("er-care");
      t.check("care menu offers two treatments + the RUN option", await t.L(`document.querySelectorAll("#dialog .opt").length === 3 && /RUN/.test(document.querySelectorAll("#dialog .opt")[2].textContent)`));
      await t.tap(0);   // the first (paid) treatment
      await mash(`!!document.querySelector(".punch")`, 40);
      await t.frames(6);
      await t.shot("er-receipt");
      t.check("discharge receipt shows the frequent-flyer punch card", await t.L(`document.querySelectorAll(".punch .hole.on").length === 3`));
      const w1 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
      t.check("the medical bill comes out of the shared wallet", w1 < w0, `${w0} → ${w1}`);
      await t.tap(0);
      await t.until(`__lulu3d.state === "playing"`, "discharged → back on the road", 60000);
      t.check("discharged back onto the road with ≥1 heart", await t.game(`ctx.G.hearts >= 1 && ctx.state === "playing"`));
    }

    if (want("hillel")) {
      // ── the rare reprieve: Hillel the (ex-)insurance adjuster settles the claim ──
      await drive();
      const c0 = await t.game(`ctx.G.coins`);
      await t.game(`(ctx.cameos.force = { reprieve: "insurance", fault: false, mood: "angry" }, ctx.G.invT = 0, ctx.cameos.trigger("wreck", { kind: "car" }))`);
      await t.until(`__lulu3d.state === "cameosCrash"`, "wreck → aftermath", 90000);
      await t.until(`/Hillel/i.test((document.querySelector("#dialog.open .name") || {}).textContent || "")`, "Hillel walks up to handle the claim", 90000);
      await t.frames(20);
      await t.shot("hillel-adjuster");
      await mash(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, 60);
      t.check("Hillel: not your fault → payout lands", (await t.game(`ctx.G.coins`)) - c0 >= 60, `+${(await t.game(`ctx.G.coins`)) - c0}`);
      t.check("second chance → Lulu carries on (foot, or the car if no foot feature)", await t.game(`ctx.state !== "gameover"`));
    }

    if (want("animal")) {
      // ── hit an animal: its furious kin surround her… until revenge traffic → game over ──
      await drive();
      await t.game(`(ctx.cameos.force = {}, ctx.G.invT = 0, ctx.cameos.trigger("wreck", { kind: "animal" }))`);
      await t.until(`__lulu3d.state === "cameosCrash"`, "animal wreck → aftermath", 90000);
      await t.frames(75);
      await t.shot("animal-swarm");
      await t.until(`__lulu3d.state === "gameover"`, "the animal swarm ends in game over", 120000);
      t.check("game over quotes the furious kin", await t.L(`/— the (ducks|raccoons)/.test(document.querySelector("#screenCard .quote").textContent)`));
      await t.shot("animal-gameover");
    }

    if (want("escape")) {
      // ── the ER bill-skip: wheelchair getaway → BUSTED → bill collected anyway ──
      await drive();
      const w0 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
      await t.game(`ctx.cameos.trigger("er", { reason: "knockout", force: { intro: false, visitor: false, caught: true, escape: "chair", caughtGag: "oldlady" } })`);
      await t.until(`__lulu3d.state === "cameosER"`, "admitted to the ER");
      await mash(OPTS, 40);
      await t.tap(13); await t.tap(13); await t.frames(3);
      await t.tap(0);   // 🏃 Skip the bill — RUN!
      await t.frames(30);
      await t.shot("er-escape");
      await t.until(`/BUSTED/.test(document.getElementById("cameosCap").textContent)`, "she's nabbed", 60000);
      await t.frames(10);
      await t.shot("er-busted");
      await t.until(`__lulu3d.state !== "cameosER"`, "busted → arrested (or let off)", 60000);
      const w1 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
      t.check("skipping the bill and getting caught still collects it", w0 - w1 >= 30, `${w0} → ${w1}`);
    }
  },
};
