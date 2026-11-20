// 📞 The Phone app everywhere (features/community calls.js): she can always make a call.
//   • the 📞 Phone app sits right after 💬 Messages on the highway, at a rest area, in Lakewood AND Midwood —
//     and the phone is still one 3 × 3 screen (🏡 Family & places is a contact in it now)
//   • contacts: Chaverim · Hatzalah · Shomrim · 911 · 👩 Ima · 🏡 Family; with nothing to call about, one line instead
//   • the highway: Hatzalah drives up to her parked car (+❤️), Chaverim to her on FOOT, the call card says
//     "pull over" at speed; the heart cap (help.js HEAL) and the nitro gap hold
//   • a rest area's lot: Chaverim drive across the lot to her
//   • Midwood: its own volunteer orgs (Brooklyn lines), one Shomrim cruiser at most, the town's budget measured
//   • Ima: a sweater line, no reward
module.exports = {
  name: "calls",
  viewport: { width: 1280, height: 720 },
  query: "&enable=community,town,exits,atmos",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const C = `ctx.community`;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["community:help", "community:call", "phone:end"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 90))); })`);
    const evs = () => t.L(`window.__ev.slice()`);
    const appOpen = async (arg = null) => { await g(`(ctx.phone.closePhone && ctx.phone.isOpen && ctx.phone.closePhone(), true)`); await t.frames(2); await g(`ctx.phone.openPhone("community"${arg ? ", " + JSON.stringify(arg) : ""})`); await t.frames(3); };
    const appText = () => t.L(`(document.querySelector("#screenCard") || {}).textContent || ""`);
    const close = async () => { await g(`(ctx.phone.isOpen && ctx.phone.closePhone(), true)`); await t.frames(2); };
    // stop dead at (s, d) on the highway
    const parkAt = (s, d) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
    // (in the car the call card runs itself; on foot the call is a dialogue — tap through it like a player)
    const callDone = async () => {
      for (let i = 0; i < 40; i++) {
        if (!(await g(`ctx.phone.busy() || ctx.dialogOpen`))) return true;
        if (await g(`ctx.dialogOpen`)) await t.tap(0);
        await t.frames(8);
      }
      return t.until(`!__lulu3d.ctx.phone.busy() && !__lulu3d.ctx.dialogOpen`, "the call ends", 30000);
    };
    const freshCap = () => g(`(${C}.debug.CM.heals = 0, ${C}.debug.CM.healAt = null, true)`);

    // ── the highway ──────────────────────────────────────────────────────
    await step("highway", async () => {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts", 24000)) return;
      await g(`(ctx.law.hold(900), ctx.traffic.config.enabled = false, ctx.traffic.cars.slice().forEach(c => ctx.traffic.remove(c)), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ${C}.debug.CM.assistCool = 1e9, true)`);
      const apps = await g(`ctx.phone.apps()`);
      t.check("📞 Phone is on the phone on the highway", apps.includes("community"), apps.join(","));
      t.check("…right after 💬 Messages (where a Phone app sits)", apps.indexOf("community") === apps.indexOf("messages") + 1, apps.join(","));
      t.check("…and the phone is still one 3 × 3 screen (🏡 Family is a contact, not an app)", apps.length <= 9 && !apps.includes("family"), `${apps.length}: ${apps.join(",")}`);
      t.check("the app is called Phone", await g(`ctx.phone._dbg.APPS.find(a => a.id === "community").name`) === "Phone");
      await stopCar();
      await appOpen();
      const home = await appText();
      t.check("contacts: Chaverim · Hatzalah · Shomrim · 911 · Ima · Family & places", ["Chaverim", "Hatzalah", "Shomrim", "911", "Ima", "Family & places"].every(n => home.includes(n)), home.slice(0, 300));
      t.check("…headed 'On the road'", /On the road/.test(home), home.slice(0, 80));
      await t.shot("phone-highway");
      await appOpen({ org: "shomrim" });
      t.check("Shomrim off town: one line in their voice instead of an empty page", /NEIGHBOURHOOD/.test(await appText()), (await appText()).slice(0, 200));
      await appOpen({ org: "chaverim" });
      const chv = await appText();
      t.check("Chaverim on the highway: I'm stuck (a tow) + I'm out of gas", /I'm stuck/.test(chv) && /out of gas/.test(chv), chv.slice(0, 240));
      await t.click(/‹ Contacts/);
      await t.frames(2);
      await t.click(/Family & places/);
      await t.frames(3);
      t.check("🏡 Family & places opens inside the Phone app", /Bubbe/.test(await appText()));
      await close();

      // Hatzalah drives up behind her car parked on the shoulder: +❤️
      const s0 = await g(`ctx.car.s`);
      await parkAt(s0 + 30, 8.2);
      await g(`(ctx.G.hearts = 1, true)`);
      t.check("Hatzalah: I'm hurt (+❤️)", (await g(`${C}.reasons("hatzalah")`)).includes("patch"));
      await g(`${C}.call("hatzalah", "patch")`);
      t.check("in the car: the call card", await g(`ctx.phone.busy()`));
      await callDone();
      t.check("…somebody's on the way (the org cars loaded on demand)", await t.until(`!!__lulu3d.ctx.community.help`, "help coming", 48000), JSON.stringify(await evs()));
      t.check("…a Hatzalah van comes up the highway behind her", await g(`${C}.vehicles.some(v => v.org === "hatzalah")`));
      t.check("…pulls up and patches her up (the scene plays)", await t.until(`__lulu3d.state === "communityScene"`, "the roadside scene", 96000));
      await t.shot("hatzalah-shoulder");
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.community.help`, "scene over", 72000);
      t.check("…+❤️ (1 → 2)", await g(`ctx.G.hearts`) === 2, String(await g(`ctx.G.hearts`)));

      // the cap: right away again → they come, no heart; after HEAL.max a run → none at all
      t.check("heal cap: ctx.community.heal = 3 a run, 60 s apart", await g(`JSON.stringify(${C}.heal)`) === JSON.stringify({ max: 3, gap: 60, left: 2 }), await g(`JSON.stringify(${C}.heal)`));
      await appOpen({ org: "hatzalah" });
      t.check("…calling again at once: the app says they JUST patched her", /JUST patched/.test(await appText()));
      await close();
      await g(`${C}.call("hatzalah", "patch")`);
      await callDone();
      await t.until(`!!__lulu3d.ctx.community.help`, "help coming again", 48000);
      await t.until(`__lulu3d.state === "communityScene"`, "the scene again", 96000);
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.community.help`, "scene over", 72000);
      t.check("…they came, no heart (still 2)", await g(`ctx.G.hearts`) === 2, String(await g(`ctx.G.hearts`)));
      await g(`(${C}.debug.CM.heals = 3, ${C}.debug.CM.healAt = -1e9, true)`);
      await appOpen({ org: "hatzalah" });
      t.check("…3 this run: 'no more ❤️ this drive'", /no more ❤️/.test(await appText()));
      await close();

      // nitro from Chaverim: once, then not again for a while
      await g(`(ctx.G.boost = 0.1, ${C}.debug.CM.gasAt = null, true)`);
      t.check("Chaverim: I'm out of gas (nitro low)", (await g(`${C}.reasons("chaverim")`)).includes("gas"));
      await g(`${C}.call("chaverim", "gas")`);
      t.check("…and not again for 90 s (no nitro on tap)", !(await g(`${C}.reasons("chaverim")`)).includes("gas") && await g(`${C}.gasGap`) === 90);
      await callDone();
      await t.until(`!__lulu3d.ctx.community.help`, "gas delivered", 96000);
      t.check("…the nitro's full", await g(`ctx.G.boost`) > 0.95, String(await g(`ctx.G.boost`)));

      // calling at speed: the call card says to pull over
      await freshCap();
      await g(`(ctx.G.hearts = 1, true)`);
      await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => c.hook("controls", (ctl, dt) => { if (window.__auto) Object.assign(ctl, m.autoDrive(dt, 5.25, 22)); }, 999)))`);
      await parkAt(await g(`ctx.car.s + 60`), 5.25);
      await g(`(window.__auto = true, true)`);
      await t.until(`__lulu3d.ctx.car.speed > 12`, "up to speed", 24000);
      await g(`${C}.call("chaverim", "tow")`);
      await t.until(`/Pull over/.test((document.querySelector(".jphone") || {}).textContent || "")`, "pull over", 36000);
      t.check("at speed: the call card says to pull over", /Pull over/.test(await t.L(`(document.querySelector(".jphone") || {}).textContent || ""`)), await t.L(`(document.querySelector(".jphone") || {}).textContent || ""`));
      await g(`(window.__auto = false, true)`);
      await t.until(`__lulu3d.ctx.car.speed < 1`, "she stops", 36000);
      t.check("…she stops: Chaverim pull up", await t.until(`__lulu3d.state === "communityScene"`, "chaverim scene", 96000));
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.community.help`, "scene over", 72000);
      t.check("…fixed: +❤️", await g(`ctx.G.hearts`) === 2, String(await g(`ctx.G.hearts`)));

      // on FOOT on the highway: Chaverim drive up to HER (not to her parked car)
      await freshCap();
      await parkAt(await g(`ctx.car.s`), 8.4);
      await t.frames(3);
      await g(`(ctx.foot.start("parked"), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "climbs out", 48000);
      await g(`(() => { const r = ctx.world.road, p = r.point(ctx.car.s + 45, 9.5, {}); ctx.foot.pos.set(p.x, 0.05, p.z); ctx.foot.obj.position.copy(ctx.foot.pos); return true; })()`);
      await g(`(ctx.G.hearts = 1, true)`);
      t.check("on foot: 📞 Phone is still there", (await g(`ctx.phone.apps()`)).includes("community"));
      t.check("on foot: Hatzalah (hurt) — Chaverim have nothing for her on foot → their line", (await g(`${C}.reasons("hatzalah")`)).includes("patch") && /shoes/.test(await g(`${C}.nothing("chaverim")`)));
      await g(`${C}.call("hatzalah", "patch")`);
      await callDone();
      await t.until(`!!__lulu3d.ctx.community.help`, "help coming (foot)", 48000);
      t.check("…the van drives up to HER, 45 m past her car", await t.until(`!!__lulu3d.ctx.cutscene && __lulu3d.ctx.cutscene.active()`, "the foot scene", 96000), await g(`JSON.stringify(${C}.help)`));
      await t.shot("hatzalah-foot");
      await t.until(`!(__lulu3d.ctx.cutscene && __lulu3d.ctx.cutscene.active()) && !__lulu3d.ctx.community.help`, "foot scene over", 72000);
      t.check("…+❤️ on foot", await g(`ctx.G.hearts`) === 2, String(await g(`ctx.G.hearts`)));
      await g(`(ctx.foot.end("test"), true)`);
      await t.frames(4);
      if (await g(`L3.state !== "playing"`)) { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
    });

    // ── a rest area: across the lot ──────────────────────────────────────
    await step("rest area", async () => {
      const at = await g(`ctx.exits.debug.restAhead(500)`);
      t.check("a rest area is planned ahead", typeof at === "number", String(at));
      const i = await g(`ctx.exits.rests.findIndex(r => Math.abs(r.s - ${at}) < 1)`);
      // the lot's drive aisle, half-way along (exits/layout.js: the lot is u 0 → 232, the aisle at d 27)
      const pt = await g(`ctx.exits.debug.pt(${i}, 120, ctx.exits.debug.LY.AISLE)`);
      if (!pt) { t.check("rest area point", false, String(i)); return; }
      await g(`(() => { const p = ${JSON.stringify(pt)}; ctx.car.place(p.x, p.z, p.h); ctx.car.s = p.s; ctx.world.road.nearest(p.x, p.z, p.s, {}); ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; ctx.world.prebuild(p.s); ctx.cam.snap(); return true; })()`);
      await t.frames(20);
      t.check("parked in the lot (off the highway's lanes)", Math.abs(await g(`ctx.car.d`)) > 7, String(await g(`ctx.car.d`)));
      t.check("📞 Phone at the rest area", (await g(`ctx.phone.apps()`)).includes("community"));
      await freshCap();
      await g(`(ctx.G.hearts = 1, true)`);
      await g(`${C}.call("chaverim", "fix")`);
      await callDone();
      await t.until(`!!__lulu3d.ctx.community.help`, "chaverim coming (lot)", 48000);
      t.check("…Chaverim drive across the lot to her", await t.until(`__lulu3d.state === "communityScene"`, "lot scene", 120000), await g(`JSON.stringify(${C}.vehicles.map(v => [v.org, v.mode, Math.round(Math.hypot(v.x - ctx.car.pos.x, v.z - ctx.car.pos.z))]))`));
      await t.shot("chaverim-lot");
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.community.help`, "scene over", 72000);
      t.check("…fixed: +❤️", await g(`ctx.G.hearts`) === 2, String(await g(`ctx.G.hearts`)));
    });

    // ── Ima: a sweater, no reward ────────────────────────────────────────
    await step("ima", async () => {
      const c0 = await t.L(`window.__lulu3d.wallet.coins`), h0 = await g(`ctx.G.hearts`);
      await g(`${C}.call("ima")`);
      t.check("calling Ima: the call card from IMA", await t.until(`/IMA/.test((document.querySelector(".jphone") || {}).textContent || "")`, "ima card", 12000));
      await callDone();
      await t.frames(30);
      t.check("…about a sweater (or kugel) — and no reward", (await t.L(`window.__lulu3d.wallet.coins`)) === c0 && (await g(`ctx.G.hearts`)) === h0 && (await evs()).some(e => /community:call:\{"org":"ima"/.test(e)));
    });

    // ── Midwood ──────────────────────────────────────────────────────────
    await step("midwood", async () => {
      t.check("Midwood has its volunteer orgs (towns.js)", await g(`!!${C}.config("midwood") && ["chaverim", "shomrim", "hatzalah"].every(o => ${C}.config("midwood").orgs[o])`));
      await g(`(ctx.town.load("midwood"), true)`);
      await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 60000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "midwood", speed: 0 }))`);
      if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "into Midwood", 24000)) return;
      await g(`(ctx.traffic.config.enabled = false, ctx.law.hold(900), ${C}.debug.CM.assistCool = 1e9, true)`);
      t.check("📞 Phone in Midwood", (await g(`ctx.phone.apps()`)).includes("community"));
      await appOpen();
      t.check("…headed Midwood", /Midwood/.test(await appText()));
      await appOpen({ org: "shomrim" });
      t.check("Midwood's Shomrim take calls (a suspicious car, the geese)", /suspicious car/.test(await appText()) && /geese/.test(await appText()));
      await appOpen({ org: "police" });
      t.check("…the lines name Midwood's streets (Avenue J, not Main St)", /Avenue J/.test(await appText()) && !/Main St/.test(await appText()), (await appText()).slice(0, 200));
      await close();
      // the budget: Midwood is at its triangle / draw-call limit, so NO org car cruises its streets — they come when called
      await t.frames(240);
      const cru = await g(`${C}.vehicles.filter(v => v.mode === "cruise").map(v => v.org)`);
      t.check("Midwood's streets: no org car cruising until she calls (the town's budget)", cru.length === 0 && await g(`ctx.community.config("midwood").cruisers.shomrim`) === 0, cru.join(","));
      // (measured once while building this: one org car in view = +~17 draw calls, +~1.8k triangles — hence none)

      // Chaverim in Midwood: a Brooklyn dispatcher, and they come
      await freshCap();
      await g(`(ctx.G.hearts = 1, true)`);
      await g(`${C}.call("chaverim", "fix")`);
      await t.until(`/Coney Island Ave/.test((document.querySelector(".jphone") || {}).textContent || "")`, "brooklyn dispatch", 16000);
      t.check("Midwood's Chaverim dispatcher: Coney Island Ave", /Coney Island Ave/.test(await t.L(`(document.querySelector(".jphone") || {}).textContent || ""`)));
      await callDone();
      await t.until(`!!__lulu3d.ctx.community.help`, "chaverim coming (midwood)", 48000);
      t.check("…they find her in Midwood's grid", await t.until(`__lulu3d.state === "communityScene"`, "midwood scene", 144000));
      await t.shot("chaverim-midwood");
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.community.help`, "scene over", 72000);
      t.check("…fixed: +❤️", await g(`ctx.G.hearts`) === 2, String(await g(`ctx.G.hearts`)));
    });

    async function stopCar() { await g(`(ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, true)`); await t.frames(2); }
  },
};
