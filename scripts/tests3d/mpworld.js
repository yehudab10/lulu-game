// 🌐 EVERYONE IN THE SAME WORLD (ci/everyone, roadmap 11) — the ambient layer, against the LOCAL relay (never production).
//   OFFLINE   a relay nobody can reach → the world plays solo, nothing on screen says so, no errors
//   DROP-IN   two pages that never exchanged a code both just drive → each sees the other (EVERYONE room, a ghost)
//   SAFE      a stranger shows as "colour + number" (never the name they sent); can't start a race / tag on my screen,
//             can't shove my car, can't flood me with emotes or honks (dropped on MY side)
//   CAP       14 riders in the room, the nearest 6 drawn — the rest cost no model at all
//   TOWN      a 3D rider in a town shows at the same spot of that town; someone on the highway doesn't
//   OFF       ⚙️ Settings › Play online OFF disconnects (and stays off); ON again reconnects out in the world;
//             Dina's mode takes you offline, back in the world you're online again
//   FRIENDS   the 👯 Friends hub (📤 Play with a friend · 🔑 Have a code?); A invites → straight
//             into 🌍 Free Roam, STILL online (a stranger still shows as a ghost); B joins with the code → lands next to
//             A as a FRIEND: a real car with B's name, and no second ghost of B; the phone's 👯 app → Go solo
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = url => `&enable=multiplayer,party,openworld,foot,town,atmos,phone&mpurl=${encodeURIComponent(url)}`;
const S = `ctx.mp._debug`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** A raw protocol-v1 rider (Node's WebSocket): any name, any packet — a stranger whose client could be anything. */
class Rider {
  constructor(name, sk, room = "lobby") { this.name = name; this.sk = sk; this.room = room; this.d = { m: 0, x: 240, di: 0, sp: 0, vk: "car" }; this.peers = {}; this.iv = null; }
  open() {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${URL}/room/${this.room}`);
      ws.onopen = () => ws.send(JSON.stringify({ t: "j", v: 1, room: this.room, name: this.name, sk: this.sk }));
      ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === "h") { this.id = m.id; resolve(); } else if (m.t === "+") this.peers[m.id] = 1; else if (m.t === "-") delete this.peers[m.id]; };
      ws.onerror = () => reject(new Error("rider could not connect"));
    });
  }
  state(extra = {}) { Object.assign(this.d, extra); try { this.ws.send(JSON.stringify({ t: "s", d: this.d })); } catch (e) { } }
  event(e) { try { this.ws.send(JSON.stringify({ t: "e", e })); } catch (e2) { } }
  keep(fn, ms = 200) { this.stop(); this.iv = setInterval(() => { if (fn) Object.assign(this.d, fn(this) || {}); this.state(); }, ms); }
  stop() { if (this.iv) clearInterval(this.iv); this.iv = null; }
  close() { this.stop(); try { this.ws.close(); } catch (e) { } }
}

module.exports = {
  name: "mpworld",
  viewport: { width: 960, height: 540 },
  query: Q(URL),
  save2d: { totalCoins: 100, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(6 * 60000);
    const pages = [], riders = [];
    try { await body(t, pages, riders); }
    catch (e) { t.check("mpworld threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const r of riders) r.close();
      for (const g of pages) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

const PLACE = (s, d) => `(() => { ctx.traffic.clear(); ctx.traffic.config.enabled = false; const p = ctx.world.road.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`;
const HOLD = `(ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.G.invT = 999, true)`;

async function body(t, pages, riders) {
  const A = hostPage(t), g = t.game;

  // ── OFFLINE: the relay can't be reached → solo, silently ──
  const off = await guestPage(t, "offline", { totalCoins: 0, selectedSkin: "pink" }, Q("ws://127.0.0.1:9"));
  pages.push(off);
  await off.until(`__lulu3d && __lulu3d.state === "title"`, "offline page boots", 120000);
  t.check("offline: nothing connects on the title", await off.game(`!${S}.want && !${S}.sock`));
  await off.game(`L3.startRun({ mode: "cruise", quick: true })`);
  await off.until(`__lulu3d.state === "playing"`, "offline: cruise starts");
  await off.frames(150);
  const o = await off.game(`({ want: ${S}.want, conn: ${S}.connected, st: ctx.state, chips: (document.getElementById("mpChips") || {}).textContent || "", toast: (document.getElementById("toast") || {}).textContent || "" })`);
  t.check("offline: still trying quietly (wants online, not connected, still playing)", o.want && !o.conn && o.st === "playing", JSON.stringify(o));
  t.check("offline: no chip, no message about it", !/rider|online|connect/i.test(o.chips + o.toast), JSON.stringify(o));
  await off.page.close(); pages.splice(pages.indexOf(off), 1);
  t.check("offline: no page errors", off.errors.length === 0, off.errors.slice(0, 2).join(" | "));

  // ── DROP-IN: two pages, no code ──
  t.check("title: nothing connects until she's out in the world", await g(`!${S}.want && !${S}.sock`));
  t.check("⚙️ Settings has 🌐 Play online", await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("settings").some(i => i.id === "online"))`));
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await A.until(`__lulu3d.state === "playing"`, "A: cruise starts")) return;
  await g(HOLD); await g(PLACE(400, 1.75));
  if (!await A.until(`${S}.connected && ${S}.room === "lobby"`, "A: online by default (EVERYONE)")) return;
  t.check("A: online by default — EVERYONE, no code, no lobby screen", await g(`ctx.state === "playing" && !document.querySelector("#screenCard.open, .screen.open")`));

  const B = await guestPage(t, "B", { totalCoins: 0, ownedSkins: ["pink", "gold"], selectedSkin: "gold", mpName: "Latke Legend" }, Q(URL));
  pages.push(B);
  await B.until(`__lulu3d && __lulu3d.state === "title"`, "B boots", 120000);
  await B.game(`(ctx.car.setSkin ? ctx.car.setSkin("gold") : 0, L3.startRun({ mode: "cruise", quick: true }))`);
  await B.until(`__lulu3d.state === "playing"`, "B: cruise starts");
  await B.game(HOLD); await B.game(PLACE(425, -1.75));
  await B.until(`${S}.connected`, "B: online");
  const sees = `Object.values(${S}.peers).some(p => p.onScreen && p.w && p.w.z === "")`;
  t.check("A sees B (never exchanged a code)", await A.until(sees, "A sees B's ghost", 60000));
  t.check("B sees A", await B.until(sees, "B sees A's ghost", 60000));
  const seen = await g(`(() => { const p = Object.values(${S}.peers)[0]; return { name: p.name, raw: p.raw, ca: +p.w.ca.toFixed(1), cb: +p.w.cb.toFixed(1) }; })()`);
  t.check("A sees B at B's spot on the road (s 425, d −1.75)", Math.abs(seen.ca - 425) < 4 && Math.abs(seen.cb + 1.75) < 0.6, JSON.stringify(seen));
  t.check("a stranger is a generated label (colour + number), not their name", /^[A-Z][a-z]+ \d\d$/.test(seen.name) && seen.name !== "Latke Legend", JSON.stringify(seen));
  t.check("one ghost built for one rider", await g(`ctx.mp.ghostStats().built === 1 && ctx.mp.ghostStats().shown === 1`));
  await t.shot("dropin");

  // ── SAFE: a stranger with a hacked client ──
  const bad = new Rider("BAD WORDS HERE", "red");
  riders.push(bad);
  await bad.open();
  const me = await g(`({ s: ctx.car.s, d: ctx.car.d, di: Math.round(ctx.car.s * 56000 / 4800) })`);
  const v0 = await g(`Math.hypot(ctx.car.vx, ctx.car.vz)`);
  let n = 1;
  bad.keep(() => ({ di: me.di, x: 240 + me.d * 20, w: ["", me.s + 1, me.d, 0], rn: 900 + n, it: [n, 77], tgo: 77, em: [n++, 3], pb: [n, 999999] }), 125);   // 8 Hz, a new "invite" / emote every packet
  for (let i = 0; i < 20; i++) { bad.event("honk"); await sleep(40); }
  await A.frames(120);
  bad.stop();
  const safe = await g(`(() => { const p = Object.values(${S}.peers).find(q => q.raw === "BAD WORDS HERE"); return { found: !!p, name: p && p.name, race: !!${S}.race, tag: !!${S}.tag, bonks: ${S}.bonks || 0, recv: ${S}.recv, v: Math.hypot(ctx.car.vx, ctx.car.vz), banner: (document.getElementById("mpOverlay") || {}).textContent || "" }; })()`);
  t.check("stranger's typed name never shows (they're \"Red NN\")", safe.found && /^Red \d\d$/.test(safe.name), JSON.stringify(safe));
  t.check("a stranger can't start a race or tag on my screen", !safe.race && !safe.tag && !/RACE|TAG|IT/.test(safe.banner), JSON.stringify(safe));
  t.check("a stranger driving into me doesn't shove my car (no BONK in EVERYONE)", safe.bonks === 0 && safe.v < v0 + 0.5, JSON.stringify({ v0, v: safe.v }));
  t.check("emote / honk / record floods are dropped on my side", safe.recv >= 10 && !/BAD WORDS/.test(safe.banner), `recv ${safe.recv}`);
  bad.close(); riders.splice(riders.indexOf(bad), 1);

  // ── CAP: 12 more riders around me → only the nearest 6 are drawn ──
  const calls1 = await g(`L3.renderer.info.render.calls`);
  for (let i = 0; i < 12; i++) {
    const r = new Rider("Kugel Kid", ["pink", "blue", "green", "orange"][i % 4]);
    riders.push(r);
    await r.open();
    const s = me.s + 8 + i * 9;
    r.keep(() => ({ di: Math.round(s * 56000 / 4800), x: 240, w: ["", s, (i % 3 - 1) * 3, 0] }), 250);
  }
  await A.until(`Object.keys(${S}.peers).length >= 13`, "A: 13 others in the room", 60000);
  await A.frames(40);
  const cap = await g(`Object.assign(ctx.mp.ghostStats(), { riders: Object.keys(${S}.peers).length, inRange: Object.values(${S}.peers).filter(p => Math.abs(p.rel) / (56000 / 4800) < 320).length, calls: L3.renderer.info.render.calls })`);
  t.check(`cap: ${cap.riders} riders in range, only the nearest ${cap.cap} drawn`, cap.inRange > cap.cap && cap.shown === cap.cap && cap.built <= cap.cap + 2, JSON.stringify(cap));
  console.log(`    (draw calls: 1 ghost ${calls1} → ${cap.shown} ghosts ${cap.calls}, ${cap.riders} riders in the room)`);
  t.check("cap: B (nearest, 25 m) is among the drawn", await g(`Object.values(${S}.peers).some(p => p.raw === "Latke Legend" && p.onScreen)`));
  await t.shot("cap");
  for (const r of riders) r.close();
  riders.length = 0;
  await A.until(`Object.keys(${S}.peers).length === 1`, "A: the 12 riders gone", 60000);
  await A.frames(130);
  t.check("riders gone → their ghosts are freed (no per-player cost)", await g(`ctx.mp.ghostStats().built <= 1`), JSON.stringify(await g(`ctx.mp.ghostStats()`)));

  // ── TOWN: a rider in Lakewood shows at that spot of Lakewood; B on the highway doesn't ──
  await g(`ctx.town.load("lakewood")`);
  if (await A.until(`ctx.town.loaded("lakewood")`, "A: Lakewood loaded", 120000)) {
    await g(`(ctx.town.enter({ town: "lakewood", exitS: ctx.car.s, speed: 0 }), true)`);
    await A.until(`ctx.town.active && ctx.town.id === "lakewood" && !ctx.town.transitioning`, "A: in Lakewood", 60000);
    const town = new Rider("Babka Baron", "purple");
    riders.push(town);
    await town.open();
    const loc = await g(`(() => { const O = ctx.town.plan.ORIGIN, c = ctx.car.pos; return { lx: c.x - O.x + 6, lz: c.z - O.z + 4 }; })()`);
    town.keep(() => ({ di: 0, x: 470, sp: 0, m: 1, w: ["lakewood", loc.lx, loc.lz, 1.2] }), 200);
    const tw = `(() => { const p = Object.values(${S}.peers).find(q => q.raw === "Babka Baron"); return !!p && p.onScreen; })()`;
    if (await A.until(tw, "A sees the Lakewood rider", 30000)) {
      const at = await g(`(() => { const O = ctx.town.plan.ORIGIN, p = Object.values(${S}.peers).find(q => q.raw === "Babka Baron"); return { dx: p.ws - (O.x + ${loc.lx}), dz: p.wd - (O.z + ${loc.lz}) }; })()`);
      t.check("a rider in town shows at the same spot of that town (on foot)", Math.hypot(at.dx, at.dz) < 1, JSON.stringify(at));
    } else t.check("a rider in town shows at the same spot of that town (on foot)", false);
    t.check("B (on the highway) isn't drawn in town", await g(`!Object.values(${S}.peers).some(p => p.raw === "Latke Legend" && p.onScreen)`));
    t.check("B doesn't see A while A is in town", await B.until(`!Object.values(${S}.peers).some(p => p.onScreen)`, "B: A leaves the highway", 30000));
    await t.shot("town");
    town.close(); riders.length = 0;
    await g(`(ctx.town.leave("reset"), true)`);
    await A.until(`!ctx.town.active`, "A: back on the highway", 30000);
  }

  // ── OFF: ⚙️ Settings › Play online ──
  await t.tap(9); await t.frames(2);
  await t.click(/Settings/);
  await t.click(/Play online/);
  t.check("Settings › Play online OFF → disconnected, remembered (shared save)", await g(`!${S}.want && !${S}.connected`) && await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).mpAutoOff === true`));
  t.check("B sees A leave", await B.until(`Object.keys(${S}.peers).length === 0`, "B: A gone", 30000));
  await t.tap(1); await t.frames(2);
  await t.tap(1); await t.frames(3);
  await A.until(`ctx.state === "playing" && !ctx.paused`, "A: resumed", 20000);
  await A.frames(60);
  t.check("OFF stays off out in the world", await g(`!${S}.want`));
  await t.tap(9); await t.frames(2);
  await t.click(/Settings/);
  await t.click(/Play online/);
  await t.tap(1); await t.frames(2);
  await t.tap(1); await t.frames(3);
  t.check("ON again → back online in the world", await A.until(`${S}.connected`, "A: reconnects", 30000));
  // solo, 📱 📍 Nearby has the other drivers + 📤 invite + 🌐 go solo (one tap)
  await g(`ctx.phone.openPhone("nearby")`);
  await A.frames(6);
  t.check("📱 📍 Nearby (solo): other drivers + invite + Go solo", await t.L(`!!document.getElementById("owOnline") && !!document.getElementById("owInviteSolo") && /Other drivers/.test(document.getElementById("screenCard").textContent)`));
  await g(`(ctx.phone.closePhone(), true)`);
  await A.frames(4);

  // ── Dina's mode is always offline ──
  await g(`(L3.setState("title"), true)`);
  await A.frames(5);
  await g(`L3.openMenuItem("title", "dina")`);
  t.check("Dina's mode → offline", await A.until(`/^dina/.test(ctx.state) && !${S}.want`, "A: Dina offline", 30000), await g(`ctx.state`));
  await g(`(L3.setState("title"), true)`);
  await A.frames(5);
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  t.check("back in the world → online again", await A.until(`${S}.connected`, "A: online after Dina", 30000));

  // ── FRIENDS: a private group inside the same world ──
  await g(`(L3.setState("title"), true)`);
  await A.frames(5);
  await t.click(/Friends/);
  const hub = await t.L(`[...document.querySelectorAll("#screenCard button")].map(b => b.id)`);
  t.check("👯 Friends hub: Play with a friend, then Have a code (no Play online / 2D buttons — ⚙️ Settings + ⚙️ More)", hub.indexOf("pt_roam") >= 0 && hub.indexOf("pt_join") > hub.indexOf("pt_roam") && !hub.includes("pt_online") && !hub.includes("pt_open"), hub.join(","));
  await t.shot("hub");
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await A.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "A: 📤 Invite → Free Roam", 120000)) return;
  await g(HOLD); await g(PLACE(400, 1.75));
  t.check("in a party she's still in EVERYONE (strangers stay in the world)", await A.until(`${S}.connected && ${S}.room === "lobby"`, "A: online in the party", 30000));
  t.check("…and B, a stranger, still shows as a ghost", await A.until(`Object.values(${S}.peers).some(p => p.raw === "Latke Legend" && p.onScreen)`, "A sees stranger B in the party", 60000));
  await g(`(ctx.banter && (ctx.banter.autopilot = { d: 1.75, speed: 0 }), true)`);      // (A holds still while B joins)
  const code = await g(`ctx.party.code`), auid = await g(`ctx.party.uid`);
  await B.game(`(L3.setState("title"), true)`);
  await B.frames(5);
  await B.game(`(ctx.party.join(${JSON.stringify(code)}), true)`);
  if (!await B.until(`ctx.state === "playing" && ctx.party.connected && ctx.party.activity.k === "roam"`, "B: joins with the code", 120000)) return;
  t.check("B joins with the code → in A's Free Roam", true);
  const friendCar = `(() => { const rc = ctx.party.remoteCar(${JSON.stringify(await B.game(`ctx.party.uid`))}); return !!rc && rc.shown !== false; })()`;
  t.check("A sees B as a FRIEND: a real car", await A.until(friendCar, "A: B's party car", 60000));
  t.check("…with B's name", await g(`ctx.party.displayName(${JSON.stringify(await B.game(`ctx.party.uid`))})`) === "Latke Legend");
  await A.frames(30);
  t.check("…and no second (ghost) B", await g(`!Object.values(${S}.peers).some(p => p.raw === "Latke Legend" && p.onScreen)`), JSON.stringify(await g(`Object.values(${S}.peers).map(p => [p.raw, p.pt, p.onScreen])`)));
  await B.frames(60);
  const pa = await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`), pb = await B.game(`(() => { const p = ctx.foot.active && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos; return { x: p.x, z: p.z }; })()`);
  t.check("B is dropped next to A (the host) — same world, ≤ 60 m", Math.hypot(pa.x - pb.x, pa.z - pb.z) < 60, JSON.stringify({ pa, pb }));
  await t.shot("friends");
  // the phone's 👯 app: one tap → go solo (strangers gone, the friend stays)
  t.check("📱 the phone is there", await g(`!!(ctx.phone && ctx.phone.openPhone)`));
  await g(`ctx.phone.openPhone("owparty")`);
  await A.frames(6);
  t.check("📱 👯 Friends: Hide other drivers is one tap", await t.L(`!!document.getElementById("owOnline")`));
  await t.L(`document.getElementById("owOnline").click()`);
  await A.frames(6);
  t.check("one tap → offline from EVERYONE, still in the party", await g(`!${S}.want && ctx.party.connected && !!ctx.party.remoteCar(${JSON.stringify(await B.game(`ctx.party.uid`))})`));
  await g(`(ctx.phone.closePhone && ctx.phone.closePhone(), ctx.mp.setOnline(true), true)`);
}
