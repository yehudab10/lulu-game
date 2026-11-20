// 🏦 THE BANK WITH FRIENDS (ci/bankfriends) — two real pages in one party against the LOCAL relay (never production):
//   STAGE 2  FOILING A ROBBERY TOGETHER (heist/party.js): a robbery on one friend's screen (the owner) shows on the
//            other's (the robber + the getaway car, the chip, the beacon); the friend TACKLES the robber on foot; the
//            owner checks it against what it sees, the party's HOST splits the pay (a crew of 2 → about half each, never
//            more than one solo foil in total) and keeps the per-player cap; a payout broadcast by a non-host is ignored;
//            one robbery at a time across the party.
// Waits are in GAME frames (scripts/lib/party3d.js). QA's watchdog runs on the host page.
const path = require("path");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const W = require("../lib/qawatch.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,heist&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");

module.exports = {
  name: "bankfriends",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(8 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("bankfriends threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const P of [Hp, A]) {
    await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await P.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    await P.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, `${P.label}: in Lakewood`, 40000);
  }
  // both on foot, near the bank, ~20 m apart
  const bank = await g(`ctx.town.spot("bank")`);
  for (const [P, off] of [[Hp, 9], [A, 13]]) {
    await P.game(`ctx.foot.start("parked")`);
    await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label}: on foot`, 60000);
    await P.game(`(() => { const sp = ctx.town.spot("bank"); ctx.foot.debug.F.pos.set(sp.x + sp.nx * ${off}, 0.05, sp.z + sp.nz * ${off}); return true; })()`);
  }
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && rc.foot; })()`, "guest sees the host on foot", 60000);
  await W.install(t);
  const coins0 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };

  // ── a robbery on the host's screen (she's on foot: the robber fumbles in the doorway) ──
  t.check("robberies are on in a party's Free Roam town (heist live gate)", await g(`ctx.heist.debug.live("robbery")`));
  t.check("the host's screen stages one at the bank", await g(`ctx.heist.debug.robbery({ where: "town", spot: "bank" })`));
  await Hp.until(`!!ctx.heist.robbery && ctx.heist.robbery.phase === "run"`, "host: the robber bursts out", 40000);
  await Hp.until(`!!ctx.heist.debug.party().sent`, "host: the robbery rides in my snapshot (d.x.rb)", 20000);
  await g(`(ctx.heist.robbery.t = 0, true)`);
  t.check("one robbery at a time: the guest's scheduler stands down while the host's is on", true);
  await A.until(`ctx.heist.debug.party().puppets.includes(${HU})`, "guest: sees the host's robbery (robber + getaway car)", 40000);
  t.check("guest: …and its own scheduler won't start another", await A.game(`(ctx.heist.debug.R.nextT = 0, !ctx.heist.debug.schedRobbery())`));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-bankfriends-robbery-guest.png") }).catch(() => { });
  // the guest runs up and TACKLES him (the ✋ spot on her screen → the host checks she's really there)
  await A.game(`(() => { const p = ctx.heist.debug.party(); return true; })()`);
  const rob = await g(`(() => { const o = ctx.heist.robbery.robber.obj.position; return { x: o.x, z: o.z }; })()`);
  await A.game(`(ctx.foot.debug.F.pos.set(${rob.x} + 1.2, 0.05, ${rob.z} + 0.6), true)`);
  await A.frames(6);
  // (the host checks the claim against where IT sees her: let her walk reach the host's screen first)
  // (the test holds the robber in his doorway fumble while it waits: two pages in software WebGL crawl, and his
  //  dash for the car must not end the run before her tackle has even reached the host)
  const HOLD = `(ctx.heist.robbery && ctx.heist.robbery.phase === "run" && (ctx.heist.robbery.t = 0), true)`;
  await Hp.until(`${HOLD} && (() => { const rc = ctx.party.remoteCar(${GU}), o = ctx.heist.robbery && ctx.heist.robbery.robber && ctx.heist.robbery.robber.obj.position; return !!rc && rc.shown && rc.foot && !!o && Math.hypot(rc.x - o.x, rc.z - o.z) < 4; })()`, "host: sees the guest beside the robber", 40000);
  const lbl = await A.game(`(ctx.foot.debug.interactables() || {}).label || ""`);
  t.check("guest: ✋ TACKLE HIM! on the friend's robber", /TACKLE/.test(lbl), lbl);
  const acted = await A.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) { s.ent.act(); return { ok: true, xk: Object.keys(ctx.party._debug.N.xk) }; } return { ok: false, keys: s ? Object.keys(s) : null, ent: s && s.ent ? Object.keys(s.ent) : null }; })()`);
  console.log("   TACKLE act", JSON.stringify(acted));
  if (!await Hp.until(`${HOLD} && !!ctx.heist.robbery && ctx.heist.robbery.phase === "foiled"`, "host: the friend's tackle foils it (checked on the host's screen)", 40000)) {
    const diag = async () => ({
      host: await g(`(() => { const ev = ctx.heist.robbery, rc = ctx.party.remoteCar(${GU}), p = ctx.party.peer(${GU}), o = ev && ev.robber && ev.robber.obj.position;
        return { frames: L3.frames, time: +ctx.time.toFixed(1), state: ctx.state, paused: ctx.paused, ph: ev && ev.phase, id: ev && ev.id, rc: rc && { shown: rc.shown, foot: rc.foot, d: o ? +Math.hypot(rc.x - o.x, rc.z - o.z).toFixed(1) : null },
          hk: p && p.x && p.x.hk, z: p && p.x && p.x.z, myZone: ctx.town.active ? ctx.town.id : "", dbg: ctx.heist.debug.party(), vis: document.visibilityState }; })()`).catch(e => String(e)),
      guest: await A.game(`(() => { const N = ctx.party._debug.N, x = Object.assign({}, N.extra, N.xk);
        return { frames: L3.frames, state: ctx.state, xkKeys: Object.keys(N.xk), hk: N.xk.hk || null, xLen: JSON.stringify(x).length, bc: N.bcast.length, bcLen: JSON.stringify(N.bcast).length,
          sizes: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, JSON.stringify(v).length])), dbg: ctx.heist.debug.party(), vis: document.visibilityState }; })()`).catch(e => String(e)),
    });
    console.log("   TACKLE diag", JSON.stringify(await diag()));
    await new Promise(r => setTimeout(r, 5000));
    console.log("   TACKLE diag +5s", JSON.stringify(await diag()));
    return;
  }
  t.check("…credited to the guest", (await g(`ctx.heist.robbery.by`)) === guestUid, await g(`ctx.heist.robbery.by`));
  // the host (also the party's host) splits the pay; each screen pays itself its share once
  await Hp.until(`ctx.heist.debug.party().paid.length > 0`, "host: share paid", 30000);
  await A.until(`ctx.heist.debug.party().paid.length > 0`, "guest: share paid", 30000);
  const coins1 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };
  const dh = coins1.h - coins0.h, da = coins1.a - coins0.a, maxPay = await g(`ctx.heist.pay.foil[1] + ctx.heist.pay.foilClean + ctx.heist.pay.tackle`);
  t.check("both get a share, and the two together aren't more than one solo foil (split, never multiplied)", dh > 0 && da > 0 && dh + da <= maxPay + 5, JSON.stringify({ dh, da, maxPay }));
  t.check("the host's book counts one party foil each", await g(`(() => { const n = ctx.heist.debug.party().host.n; return n[${HU}] === 1 && n[${GU}] === 1; })()`), JSON.stringify(await g(`ctx.heist.debug.party().host`)));
  await t.shot("robbery-foiled-host");
  // a payout broadcast by someone who isn't the host is ignored
  await A.game(`(ctx.party.broadcast("hfa", 4242, ${GU}, "ram", [[${HU}, 80], [${GU}, 80]]), true)`);
  await Hp.frames(40);
  t.check("a fake payout from a non-host pays nobody", (await g(`L3.wallet.coins`)) === coins1.h, JSON.stringify({ was: coins1.h, now: await g(`L3.wallet.coins`) }));
  // the same claim twice never pays twice
  await g(`(ctx.party.sendEvent("hfo", ctx.heist.robbery ? ctx.heist.robbery.id : 1, "tackle", [${HU}, ${GU}], 120), true)`);
  await Hp.frames(30);
  t.check("the same robbery's claim again pays nothing more", (await g(`L3.wallet.coins`)) === coins1.h);
  await Hp.until(`!ctx.heist.robbery`, "the robbery tidies away", 60000);
  await A.until(`ctx.heist.debug.party().puppets.length === 0`, "guest: the friend's robbery is gone too", 40000);
  W.check(t, "watchdog (host)", await W.report(t));
  await crewJob(t, g, Hp, A, hostUid, guestUid);
}

// ════ STAGE 3: THE BANK JOB WITH FRIENDS (heist/crew.js) ════
const HOT = (id) => `(() => { const rt = window.__interiors && window.__interiors.room; const h = rt && rt.hots.find(x => x.id === ${JSON.stringify(id)}); return h ? (typeof h.label === "function" ? h.label(rt) : h.label) : null; })()`;
const USE = (id) => `(() => { const rt = window.__interiors.room; const h = rt.hots.find(x => x.id === ${JSON.stringify(id)}); rt.use(h); return true; })()`;
async function crewJob(t, g, Hp, A, hostUid, guestUid) {
  const HU = JSON.stringify(hostUid), GU = JSON.stringify(guestUid);
  // both into the bank's lobby
  for (const P of [Hp, A]) {
    await P.game(`(() => { const sp = ctx.town.spot("bank"); ctx.foot.debug.F.pos.set(sp.x, 0.05, sp.z); return true; })()`);
    await P.frames(4);
    await P.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return true; })()`);
    if (!await P.until(`ctx.state === "interior" && ctx.stateData && ctx.stateData.id === "bank" && window.__interiors.room && window.__interiors.room.ready`, `${P.label}: into the bank`, 60000)) return;
  }
  await Hp.until(`ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "the lobby is shared", 60000);
  for (const P of [Hp, A]) await P.game(`(ctx.heist.debug.bypass(true), true)`);       // (the one-a-run / cooldown rules: tests start fresh)
  t.check("host: ✋ at the vault offers a crew job", /Plan a job with the crew/.test(await g(HOT("vault"))), await g(HOT("vault")));
  await g(`ctx.heist.debug.crew.lead("classic")`);
  await A.until(`(() => { const o = ctx.heist.debug.crew.on; return !!o && o.ph === "in"; })()`, "guest: sees the invitation", 30000);
  const jl = await A.game(HOT("vault"));
  t.check("guest: ✋ at the vault = 💰 Join Kugel Kid's job (opt-in, nobody dragged in)", /Join Kugel Kid's job/.test(jl), jl);
  t.check("guest: not in the crew until she says so", !(await g(`ctx.heist.debug.crew.C.lead.crew.includes(${GU})`)));
  await A.game(USE("vault"));
  await Hp.until(`ctx.heist.debug.crew.C.lead.crew.includes(${GU})`, "host: the guest joined the crew", 30000);
  await g(`ctx.heist.debug.crew.launch()`);
  await Hp.until(`ctx.heist.debug.crew.C.lead.ph === "inside"`, "the job's on: roles", 20000);
  await A.until(`ctx.heist.debug.crew.C.mine && ctx.heist.debug.crew.C.mine.role === "talker"`, "guest: THE TALKER", 30000);
  t.check("host: THE VAULT (the leader)", (await g(`ctx.heist.debug.crew.C.mine.role`)) === "vault");
  t.check("guest: ✋ at the window = 🗣️ Distract the teller", /Distract the teller/.test(await A.game(HOT("crewTalk")) || ""));
  t.check("host: ✋ at the vault = 🔓 Crack the vault", /Crack the vault/.test(await g(HOT("vault"))));
  await t.shot("crew-inside");
  await A.game(`ctx.heist.debug.crew.done("talker")`);
  await g(`ctx.heist.debug.crew.done("vault")`);
  // the alarm: both out of the lobby, the getaway is on
  await Hp.until(`ctx.heist.debug.crew.C.mine && ctx.heist.debug.crew.C.mine.ph === "getaway" && ctx.state === "footRun"`, "host: THE ALARM — out on the street", 60000);
  await A.until(`ctx.heist.debug.crew.C.mine && ctx.heist.debug.crew.C.mine.ph === "getaway" && ctx.state === "footRun"`, "guest: out on the street too", 60000);
  t.check("taking part spends each one's own heist (one a run)", await g(`ctx.heist.debug.J.done`) && await A.game(`ctx.heist.debug.J.done`));
  const c0 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };
  // results: both shake the cops → the host splits the take
  await A.game(`ctx.heist.debug.crew.result("ok")`);
  await g(`ctx.heist.debug.crew.result("ok")`);
  await Hp.until(`!ctx.heist.debug.crew.C.lead && ctx.heist.debug.crew.C.paid.size > 0`, "host: the take is settled", 60000);
  await A.until(`ctx.heist.debug.crew.C.paid.size > 0`, "guest: her share arrives", 60000);
  const dh = (await g(`L3.wallet.coins`)) - c0.h, da = (await A.game(`L3.wallet.coins`)) - c0.a, max = await g(`ctx.heist.debug.crew.MAX_TAKE`);
  t.check("the take is SPLIT between the two who got away (never more than one solo take)", dh > 0 && da > 0 && Math.abs(dh - da) <= 5 && dh + da <= max + 5, JSON.stringify({ dh, da, max }));
  t.check("the host's book: one paying crew job each this session", await g(`(() => { const n = ctx.heist.debug.crew.C.host.n; return n.get(${HU}) === 1 && n.get(${GU}) === 1; })()`));
  // the same claim again pays nothing
  await g(`(ctx.party.sendEvent("hjo", 777, [${HU}, ${GU}], ["ok", "ok"], 400), true)`);
  await Hp.frames(30);
  t.check("a second crew job the same session pays nobody (the cap)", (await g(`L3.wallet.coins`)) === c0.h + dh);
}
