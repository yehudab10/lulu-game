// 🐞 QA with FRIENDS, part 2 (ci/together) — two pages in one 🎉 party (LOCAL relay), the watchdog on BOTH screens:
//   • the same building at the same moment: both walk into the town's courthouse lobby in the same frame; one walks out
//     while the other walks in; both out — nobody stuck, no black left up, each sees the other come and go
//   • Lulu's house: the guest visiting while the HOST walks out — and while the host leaves the party altogether
//   • a phone (portrait + landscape) while riding in a friend's car and on foot with a friend around: the 🚪 HOP OUT /
//     ✋ / JUMP / ROLL / emote buttons and the friend pointers — nothing overlapping, the prompt not under a thumb
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const W = require("../lib/qawatch.js");
let relay = null;
const PORT = 29000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,homes,places,decor&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const OVER = 4;

module.exports = {
  name: "qafriends2",
  viewport: { width: 960, height: 540 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("qafriends2 threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

/** Every visible button / pointer box on a page + the ✋ prompt line. */
const LAYOUT = `(() => {
  const out = [], vis = e => { for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || n.classList.contains("hidden")) return false; } return true; };
  for (const e of document.querySelectorAll("#touch button, #touch #stickBase, #phoneBtn, #pauseBtn, button.tbtn, [id^=tx_], .tg-p")) {
    const cs = getComputedStyle(e); if (cs.pointerEvents === "none" && !e.classList.contains("tg-p")) continue; if (+cs.opacity < 0.2 || !vis(e)) continue;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    out.push({ id: e.id || e.className, ptr: e.classList.contains("tg-p"), l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
  }
  let prompt = null; for (const p of document.querySelectorAll(".prompt")) { const r = p.getBoundingClientRect(); if (r.width > 4 && p.textContent.trim()) prompt = { l: r.left, t: r.top, r: r.right, b: r.bottom, text: p.textContent.trim().slice(0, 30) }; }
  return { W: innerWidth, H: innerHeight, out, prompt }; })()`;

async function body(t, guests) {
  const g = t.game, Hp = hostPage(t);
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`, { width: 960, height: 540 });
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const P of [Hp, A]) await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
  const AW = { L: A.L };
  await W.install(t); await W.install(AW);
  const seg = async (label, P, kinds) => { const r = await W.report(P === A ? AW : t); W.log(r); W.check(t, `${P.label}: ${label}`, r, kinds); await W.reset(P === A ? AW : t); return r; };
  const moved = P => W.moved(P === A ? AW : t);
  const KINDS = ["nan", "overlay", "flat", "underground", "jump", "hidden", "stuck"];

  // ════ 1. the courthouse lobby (Lakewood, attached), both at the same moment ════
  for (const P of [Hp, A]) {
    await moved(P);
    await P.game(`(ctx.town.load("lakewood"), true)`); await P.until(`ctx.town.loaded("lakewood")`, "Lakewood's models", 120000);   // (Lakewood isn't the first exit any more: load it)
    await P.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
    await P.until(`ctx.town.active && !!ctx.civic.spot("court")`, `${P.label}: in Lakewood with its courthouse`, 60000);
    await P.game(`ctx.foot.start("parked")`);
    await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label}: on foot`, 60000);
    await moved(P);
    await P.game(`(() => { const sp = ctx.civic.spot("court"); ctx.foot.debug.F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); return true; })()`);
    await P.frames(6);
  }
  await W.reset(t); await W.reset(AW);
  // the same frame (as near as two pages get): both press ✋
  await Promise.all([Hp, A].map(P => P.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return !!s; })()`)));
  await Promise.all([Hp, A].map(P => P.until(`ctx.state === "interior"`, `${P.label}: into the courthouse (together)`, 60000)));
  await Hp.until(`ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "host sees the guest in the lobby", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "guest sees the host in the lobby", 60000);
  // the guest walks out while the host walks out-and-back-in at the same moment
  await Promise.all([A.game(`(window.__interiors.room.leave(), true)`), g(`(window.__interiors.room.leave(), true)`)]);
  await Promise.all([Hp, A].map(P => P.until(`ctx.state === "footRun"`, `${P.label}: back out`, 40000)));
  await Promise.all([A.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return !!s; })()`), Hp.frames(1)]);
  await A.until(`ctx.state === "interior"`, "guest back in", 60000);
  await Hp.frames(20);
  t.check("host outside, guest inside: the host isn't drawn in the guest's lobby any more", await A.game(`!ctx.together.debug.room().mates.some(m => m.uid === ${HU} && !m.leaving)`));
  await A.game(`(window.__interiors.room.leave(), true)`);
  await A.until(`ctx.state === "footRun"`, "guest out again", 40000);
  await A.frames(30);
  for (const P of [Hp, A]) t.check(`${P.label}: nothing left covering the screen`, (await P.L(`window.__qa.covered()`)).length === 0);
  await seg("in and out of the courthouse together", Hp, KINDS);
  await seg("in and out of the courthouse together", A, KINDS);

  // ════ 2. a phone, while riding and on foot with a friend around ════
  for (const P of [A]) {
    await P.L(`(window.dispatchEvent(new Event("touchstart")), __lulu3d.input && (__lulu3d.input.device = "touch"), 0)`);
    for (const [w, h] of [[390, 844], [844, 390]]) {
      await P.page.setViewportSize({ width: w, height: h });
      await P.frames(15);
      const L = await P.L(LAYOUT);
      const bad = [];
      for (let i = 0; i < L.out.length; i++) for (let j = i + 1; j < L.out.length; j++) {
        const a = L.out[i], b = L.out[j];
        if (a.ptr && b.ptr) continue;
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        const inside = (a.l >= b.l && a.r <= b.r && a.t >= b.t && a.b <= b.b) || (b.l >= a.l && b.r <= a.r && b.t >= a.t && b.b <= a.b);
        if (ox > OVER && oy > OVER && !inside) bad.push(`${a.id} × ${b.id}`);
      }
      t.check(`on foot with a friend, ${w}×${h}: no two buttons / pointers overlap`, bad.length === 0, bad.join(" | ") + " — " + L.out.map(a => a.id).join(","));
      t.check(`on foot with a friend, ${w}×${h}: everything on screen`, L.out.every(a => a.l >= -2 && a.t >= -2 && a.r <= L.W + 2 && a.b <= L.H + 2), JSON.stringify(L.out.filter(a => !(a.l >= -2 && a.t >= -2 && a.r <= L.W + 2 && a.b <= L.H + 2))));
    }
  }
  // riding: the 🚪 HOP OUT button
  await g(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await Hp.until(`ctx.state === "playing"`, "host driving", 30000);
  await A.game(`(() => { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); return true; })()`);
  await A.until(`ctx.state === "playing"`, "guest driving", 30000);
  await A.game(`ctx.openworld.ride(${HU})`);
  if (await A.until(`ctx.openworld.riding === ${HU}`, "guest riding (phone)", 30000)) {
    for (const [w, h] of [[390, 844], [844, 390]]) {
      await A.page.setViewportSize({ width: w, height: h });
      await A.frames(15);
      const L = await A.L(LAYOUT);
      const hop = L.out.find(a => a.id === "tx_owHopOut");
      t.check(`riding, ${w}×${h}: the 🚪 HOP OUT button shows`, !!hop, L.out.map(a => a.id).join(","));
      const bad = L.out.filter(a => a !== hop && hop && !a.ptr && Math.min(a.r, hop.r) - Math.max(a.l, hop.l) > OVER && Math.min(a.b, hop.b) - Math.max(a.t, hop.t) > OVER);
      t.check(`riding, ${w}×${h}: nothing overlaps 🚪 HOP OUT`, !!hop && bad.length === 0, JSON.stringify({ hop, bad }));
    }
    await A.page.setViewportSize({ width: 960, height: 540 });
    await A.L(`(__lulu3d.input && (__lulu3d.input.device = "gamepad"), 0)`);
    await A.game(`ctx.openworld.hopOut({ moving: false })`);
    await A.until(`ctx.openworld.riding == null`, "hopped out", 30000);
  }

  // ════ 3. Lulu's house: the guest visiting while the host walks out, then while the host leaves the party ════
  for (const P of [Hp, A]) {
    await P.game(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
    await P.until(`ctx.state === "playing"`, `${P.label}: driving`, 30000);
    await moved(P);
    await P.game(`(ctx.town.active && ctx.town.leave("reset"), true)`);
    await P.until(`!ctx.town.active`, `${P.label}: out of town`, 30000);
    if (await P.game(`!!(ctx.home && ctx.home.site === "town")`)) {
      // (Lulu's house is on its Midwood street — roadmap 14: into the home town, at the family driveway)
      await P.game(`(() => { const T = ctx.town.home, K = ctx.home.park; ctx.town.enter({ town: T.town, exitS: T.exitS, at: { x: K.x, z: K.z, h: K.h }, speed: 0, quiet: true }); return true; })()`);
      await P.until(`ctx.town.active && ctx.town.id === ctx.town.home.town`, `${P.label}: in Lulu's town`, 60000);
    } else await P.game(`ctx.party._debug.place(36, 5.25, 0)`);
    await P.frames(10);
    await P.game(`ctx.foot.start("parked")`);
    await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label}: on foot by Lulu's house`, 60000);
  }
  await g(`ctx.decor.enter()`);
  if (await Hp.until(`ctx.state === "interior" && !!ctx.decor.debug.room()`, "host goes into her house", 60000)) {
    // (roadmap 23 — Ima's house is family only: the guest walks into HER OWN copy at once, nobody waits)
    await A.until(`(() => { const pr = ctx.party.presenceOf(${HU}); return !!pr && pr.label === "at home"; })()`, "guest knows the host is home", 30000);
    await W.reset(AW);
    const door = await g(`ctx.decor.debug.spotAt("door")`);
    await A.game(`(ctx.foot.debug.F.pos.set(${door.x}, 0.05, ${door.z}), true)`); await A.frames(3);
    await A.game(`ctx.decor.enter()`);
    t.check("a friend at Ima's door while the host is inside: straight into her own copy", await A.until(`ctx.state === "interior" && !!ctx.decor.debug.room()`, "the guest's own copy", 60000));
    await A.frames(60);
    t.check("…in control, and nobody else in her copy", await A.L(`window.__qa.control() || __lulu3d.state === "interior"`) && (await A.game(`(() => { const R = ctx.together.debug.room(); return R.room !== "luluHome" && R.mates.length === 0; })()`)), await A.game(`ctx.state`));
    await seg("both in their own copies of Ima's house", A, KINDS);
    await A.game(`(ctx.decor.debug.room().leave(), true)`);
    await A.until(`ctx.state === "footRun"`, "guest out of her copy", 40000);
    // the host walks out, then leaves the party: nothing strands anyone
    await g(`(ctx.decor.debug.room().leave(), true)`);
    await Hp.until(`ctx.state === "footRun"`, "host out of her house", 40000);
    await g(`(ctx.party.leave ? ctx.party.leave() : 0, true)`);
    await A.frames(150);
    t.check("the host left the party: the guest is fine (in control)", await A.L(`window.__qa.control()`), await A.game(`ctx.state`));
    await seg("outside Lulu's house when the host leaves the party", A, KINDS);
  }
}
