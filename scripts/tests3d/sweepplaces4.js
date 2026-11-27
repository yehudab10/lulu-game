// 🔎 The places sweep, part 4 — the JFK terminal (features/airport stage 2–3, `?airport=1`) audited like a town room, then
// TWO FRIENDS in Midwood (a 🌍 Free Roam party on a local relay, scripts/lib/party3d.js): both walk into the same rooms
// (the clothes shop, the bank, the pizza shop, Borough Hall, the realtor) — the place still behaves on both screens, and
// a room friends share shows the other one inside. Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweep/.
const { make, W } = require("../lib/sweepplaces.js");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");

let relay = null;
const PORT = 29000 + (process.pid % 20000);
const Q0 = `&enable=all&airport=1&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

module.exports = {
  name: "sweepplaces4",
  viewport: { width: 960, height: 540 },
  query: Q0,
  save2d: { totalCoins: 3000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    const guests = [];
    try { await this.body(t, guests); }
    catch (e) { t.check("sweepplaces4 threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of guests) { t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | ")); try { await g.page.close(); } catch (e) { } }
      if (relay) relay.kill();
      W.dropRelayErrors(t);
    }
  },
  async body(t, guests) {
    const S = make(t), g = S.g;
    await W.install(t);
    if (!await S.start()) return;

    // ── ✈️ the terminal hall ──
    if (await g(`!!(ctx.airport && ctx.airport.debug && ctx.airport.debug.enterTerminal)`)) {
      await S.onFoot();
      await W.moved(t);
      await g(`(ctx.airport.debug.enterTerminal(), true)`);
      if (await t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.def.id === "terminal" && window.__interiors.room.ready`, "inside the JFK terminal", 90000)) {
        const a = await S.audit("jfk-terminal");
        S.report("jfk-terminal", a);
        await S.shot("jfk-terminal-end");
        await g(`(__interiors.room.leave(), true)`);
        await t.until(`__lulu3d.state !== "interior"`, "out of the terminal", 30000);
        const r = await W.report(t); W.log(r); W.check(t, "jfk terminal: in + out", r); await W.reset(t);
      }
    } else S.log("no airport feature here — skipped");

    // ── two friends ──
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    await S.playing();
    await g(`(ctx.party.hostRoam(), true)`);
    const Hp = hostPage(t);
    if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
    const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
    const A = await guestPage(t, "guest", { totalCoins: 800, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`, { width: 390, height: 844 });
    guests.push(A);
    if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing" && !ctx.party.joining`, "guest joins Free Roam", 240000)) return;
    for (const P of [Hp, A]) await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.town.load("midwood"), true)`);
    for (const P of [Hp, A]) await P.until(`ctx.town.loaded("midwood")`, `${P.label}: Midwood's models`, 120000);
    for (const P of [Hp, A]) { await P.game(`(ctx.town.enter({ town: "midwood", speed: 0 }), true)`); await P.until(`ctx.town.active && ctx.town.id === "midwood"`, `${P.label}: in Midwood`, 20000); }
    for (const P of [Hp, A]) { await P.game(`(ctx.foot.start("parked", { noIntro: true }), true)`); await P.until(`ctx.state === "footRun"`, `${P.label}: on foot`, 20000); }
    await W.moved(t);
    const doors = await S.findDoors();
    for (const name of ["clothes", "bank", "pizza", "cityhall", "realty"]) {
      const d = doors.find(x => x.name === name);
      if (!d) { t.check(`party: Midwood has its ${name} door`, false); continue; }
      const go = P => P.game(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); ctx.cam.snap();
        const pr = ctx.foot.debug.interactables(); if (!pr || !pr.ent || !pr.ent.door) return "no door: " + (pr ? pr.label : "nothing"); pr.ent.act(); return pr.label; })()`);
      await W.moved(t);
      const lh = await go(Hp); const lg = await go(A);
      const inH = await Hp.until(`ctx.state === "interior" && window.__interiors.room && __interiors.room.ready`, `party ${name}: host goes in («${lh}»)`, 60000);
      const inG = await A.until(`ctx.state === "interior" && window.__interiors.room && __interiors.room.ready`, `party ${name}: guest goes in («${lg}»)`, 60000);
      if (inH && inG) {
        const id = await g(`__interiors.room.def.id`);
        const shared = await g(`ctx.together.shared().includes(${JSON.stringify(id)})`);
        let seeH = null, seeG = null;
        for (let k = 0; k < 40 && !(seeH && seeG); k++) {
          await t.frames(10);
          seeH = await g(`ctx.together.debug.room().mates || ctx.together.debug.room()`).then(x => JSON.stringify(x).slice(0, 200)).catch(() => "");
          seeG = await A.game(`ctx.together.debug.room().mates || ctx.together.debug.room()`).then(x => JSON.stringify(x).slice(0, 200)).catch(() => "");
          if (!shared) break;
          if (!/Latke|uid|"n"|\d/.test(seeH)) seeH = null;
          if (!/Kugel|uid|"n"|\d/.test(seeG)) seeG = null;
        }
        S.log(`party ${name} (${id}, ${shared ? "shared" : "not shared"}): host sees ${seeH} · guest sees ${seeG}`);
        await S.shot(`party-${name}-host`);
        await A.page.screenshot({ path: require("path").join(__dirname, "..", "..", "smoke-shots", "sweep", `party-${name}-guest.png`) }).catch(() => { });
        // the guest on her phone: the ✋ / 🚪 work and nothing of the street is left on screen
        const st = await A.L(`(() => { const r = document.getElementById("footBubbles"); return { bub: r && getComputedStyle(r).display !== "none" ? r.children.length : 0, hint: (__lulu3d.ctx.G && __lulu3d.ctx.G.hint) || "" }; })()`);
        t.check(`party ${name}: nothing of the street on the guest's screen (${JSON.stringify(st)})`, !st.bub && !/borrow/.test(st.hint));
      }
      for (const P of [Hp, A]) { await P.game(`(window.__interiors && __interiors.room ? __interiors.room.leave() : 0, true)`); await P.until(`ctx.state === "footRun"`, `${P.label}: back out of the ${name}`, 30000); }
      const r = await W.report(t); W.log(r); W.check(t, `party ${name}: host in + out`, r); await W.reset(t);
    }
  },
};
