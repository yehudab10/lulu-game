// 🆘 "I'M STUCK" with FRIENDS (features/unstuck) — two real pages in one 🎉 party against the LOCAL relay (never
// production), the watchdog on both:
//   • a PASSENGER presses 🆘 → she's out beside the friend's car, on her feet / in her car; the DRIVER isn't moved
//   • the automatic rescue on the guest (on foot, inside something solid) → the HOST sees her at the new spot
//   • in a party game (Race to a Pin) 🆘 is refused and says why
// Waits are in GAME frames (scripts/lib/party3d.js).
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const W = require("../lib/qawatch.js");
let relay = null;
const PORT = 29000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,homes,places,law,unstuck&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

module.exports = {
  name: "unstuck2",
  viewport: { width: 960, height: 540 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("unstuck2 threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

async function body(t, guests) {
  const g = t.game, Hp = hostPage(t);
  await t.game(`(ctx.party.hostRoam(), true)`);     // (📱 👯 › Play with a friend — the title has no Friends tile any more)
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`, { width: 960, height: 540 });
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const P of [Hp, A]) await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
  const AW = { L: A.L };
  await W.install(t); await W.install(AW);
  const seg = async (label, P, kinds = ["nan", "overlay", "underground", "stuck", "hidden"]) => { const r = await W.report(P === A ? AW : t); W.log(r); W.check(t, `${P.label}: ${label}`, r, kinds); await W.reset(P === A ? AW : t); return r; };
  // the guest presses ❚❚ → 🆘 → (go) — by clicking, as a touch player would
  const press = async (label, go = "unstuckGo") => {
    await A.L(`(__lulu3d.ctx.unstuck.debug.U.last = -1e9, document.getElementById("pauseBtn").click(), true)`);
    if (!await A.until(`ctx.paused`, `${label}: the guest's pause menu`, 6000)) return null;
    const has = await A.L(`(() => { const b = document.querySelector('#screenCard [data-pi="unstuck"]'); if (b) b.click(); return !!b; })()`);
    t.check(`${label}: 🆘 in the guest's pause menu`, has);
    await A.until(`!!document.getElementById("unstuckBack")`, `${label}: the 🆘 card`, 3000);
    const card = await A.L(`(() => { const c = document.getElementById("screenCard"); return { text: c ? c.textContent : "", go: !!document.getElementById("unstuckGo") }; })()`);
    if (go) await A.L(`(() => { const b = document.getElementById("${go}"); if (b) b.click(); return !!b; })()`);
    else { await A.L(`document.getElementById("unstuckBack").click()`); await A.L(`(() => { const b = document.querySelector('#screenCard [data-pi="resume"]'); if (b) b.click(); })()`); }
    await A.until(`!ctx.paused`, `${label}: unpaused`, 3000);
    return card;
  };

  // ════ 1. a passenger: out beside the friend's car; the driver stays put ════
  await g(`ctx.party._debug.place(400, 1.75, 0)`);
  await A.game(`ctx.party._debug.place(388, 1.75, 0)`);
  await A.game(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
  await A.until(`ctx.state === "playing"`, "guest in her car", 30000);
  await A.game(`ctx.openworld.ride(${HU})`);
  if (await A.until(`ctx.openworld.riding === ${HU}`, "guest riding with the host", 30000)) {
    await t.frames(30);
    const h0 = await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z, state: ctx.state })`);
    await W.reset(t); await W.reset(AW);
    const card = await press("a passenger");
    t.check("a passenger: the card says she gets out beside the friend's car", card && /friend's car/.test(card.text), card && card.text);
    await A.until(`!ctx.openworld.riding`, "the passenger is out", 12000);
    await t.frames(30);
    const a1 = await A.game(`(() => { const p = ctx.foot.active ? ctx.foot.pos : ctx.car.pos; return { x: p.x, z: p.z, state: ctx.state, riding: ctx.openworld.riding }; })()`);
    const h1 = await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z, state: ctx.state })`);
    t.check("a passenger: out of the ride, in control", !a1.riding && (a1.state === "footRun" || a1.state === "playing"), JSON.stringify(a1));
    t.check("a passenger: beside the friend's car (≤ 10 m)", Math.hypot(a1.x - h1.x, a1.z - h1.z) <= 10, Math.hypot(a1.x - h1.x, a1.z - h1.z).toFixed(1));
    t.check("a passenger: the DRIVER wasn't moved", Math.hypot(h1.x - h0.x, h1.z - h0.z) < 1.5 && h1.state === "playing", JSON.stringify([h0, h1]));
    await t.shot("passenger-out");
    await seg("a passenger's 🆘", A);
    await seg("a passenger's 🆘 (the driver's screen)", Hp);
  }

  // ════ 2. the automatic rescue on the guest — the host sees her at the new spot ════
  if (await A.game(`ctx.state === "playing"`)) { await A.game(`(ctx.foot.start("droveOff"), true)`); }
  if (await A.until(`ctx.state === "footRun" && ctx.foot.debug.F && ctx.foot.debug.F.phase === "walk"`, "guest on foot", 8000)) {
    const sol = await A.game(`(() => { const p = ctx.foot.debug.F.pos; let best = null, bd = 1e9; for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders || []) { if (c.off || c.r < 0.8 || ctx.foot.LOW[c.kind] || c.kind === "car") continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = { x: c.x, z: c.z, kind: c.kind }; } } return best; })()`);
    if (sol) {
      const n0 = await A.game(`ctx.unstuck.debug.U.log.length`);
      await W.moved(AW);
      await A.game(`(() => { const F = ctx.foot.debug.F; F.pos.set(${sol.x}, 0, ${sol.z}); F.vel.set(0, 0, 0); F.lulu.obj.position.copy(F.pos); ctx.unstuck.debug.U.autoLast = -1e9; return true; })()`);
      if (await A.until(`ctx.unstuck.debug.U.log.length > ${n0}`, `guest inside a ${sol.kind}: the automatic rescue`, 12000)) {
        await W.reset(AW);
        const a = await A.game(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z, why: ctx.unstuck.normal(ctx.foot.pos.x, ctx.foot.pos.z, "foot") })`);
        t.check("guest: rescued to a clear spot", a.why == null, JSON.stringify(a));
        const seen = await Hp.until(`(() => { const r = ctx.party.remoteCar(${GU}); return !!r && Math.hypot(r.x - ${a.x}, r.z - ${a.z}) < 4; })()`, "the host sees her at the new spot", 20000);
        t.check("friends just see her appear at the new spot", seen);
      }
    }
    await seg("the guest's automatic rescue", A);
  }

  // ════ 3. in a party game: refused, and it says why ════
  const why = await g(`ctx.openworld.start("pin")`);
  if (why === "") {
    await A.until(`ctx.openworld.game && ctx.openworld.game.ph === "in"`, "the guest sees the invitation", 15000);
    await A.game(`ctx.openworld.join()`);
    if (await A.until(`ctx.openworld.game && ctx.openworld.game.ph === "go" && ctx.openworld.game.ps.includes(${GU})`, "the guest is in the game", 30000)) {
      const card = await press("in a party game", null);
      t.check("in a party game: 🆘 refused, says why", card && !card.go && /game with friends/.test(card.text), JSON.stringify(card));
    }
    await g(`ctx.openworld.end()`);
    await t.frames(20);
  } else console.log("   (no party game:", why, ")");
}
