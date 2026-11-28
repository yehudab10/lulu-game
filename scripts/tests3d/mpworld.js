// 🌐 EVERYONE IN THE SAME WORLD (ci/everyone, roadmap 11) — the ambient layer, against the LOCAL relay (never production).
//   OFFLINE   a relay nobody can reach → the world plays solo, nothing on screen says so, no errors
//   DROP-IN   two pages that never exchanged a code both just drive → each sees the other (EVERYONE room, a ghost)
//   SAFE      a stranger shows as "colour + number" (never the name they sent); can't start a race / tag on my screen,
//             can't shove my car, can't flood me with emotes or honks (dropped on MY side)
//   CAP       14 riders in the room, the nearest 6 drawn — the rest cost no model at all
//   TOWN      a 3D rider in a town shows at the same spot of that town; someone on the highway doesn't
//   OFF       ⚙️ Settings › Play online OFF disconnects (and stays off); ON again reconnects out in the world;
//             Dina's mode takes you offline, back in the world you're online again
//   FRIENDS   the 👯 Friends hub (📤 Play with a friend · 🔑 Join with a code?); A invites → straight
//             into 🌍 Free Roam, STILL online (a stranger still shows, solid since stage 3); B joins with the code → lands next to
//             A as a FRIEND: a real car with B's name, and no second ghost of B; the phone's 👯 app → Go solo
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = url => `&enable=multiplayer,party,openworld,foot,town,atmos,phone,streets,houseitems&mpurl=${encodeURIComponent(url)}`;
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
  fast: false,     // (it measures draws / pictures per frame: the old clock — scripts/smoke3d.js › THE FAST TEST CLOCK)
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
  if (!await A.until(`${S}.connected && ctx.mp.room === "lobby"`, "A: online by default (EVERYONE)")) return;
  t.check("A: online by default — EVERYONE, no code, no lobby screen", await g(`ctx.state === "playing" && !document.querySelector("#screenCard.open, .screen.open")`));

  const B = await guestPage(t, "B", { totalCoins: 0, ownedSkins: ["pink", "gold"], selectedSkin: "gold", mpName: "Latke Legend", luluHair: "#8E24AA", luluHairStyle: "bouncy" }, Q(URL));
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
  // stage 3 ("no ghosts", owner 2026-11-27): another player is drawn SOLID, her own car the way friends' are
  const gs1 = await g(`ctx.mp.ghostStats()`);
  t.check("stage 3: the other player is a solid car (no see-through body)", gs1.kinds[0] === "car" && gs1.seeThrough === 0, JSON.stringify(gs1));
  // …and her look travels: B's hair colour + outfit reach A (d.hc / d.ot)
  // (give B a hair colour + something to wear first, so the check compares real values)
  await B.game(`(() => { try { const P = ctx.clothes; P.give("mw_headband"); P.wear(Object.assign({}, P.current(), { acc: "mw_headband" })); } catch (e) { } return true; })()`);
  await B.game(`(ctx.mp._debug.me.lookAt = 0, true)`);
  await B.frames(150);
  const look = await g(`(() => { const p = Object.values(${S}.peers).find(p => p.raw === "Latke Legend"); return p ? { hc: p.hc, ot: p.ot } : null; })()`);
  const bLook = await B.game(`({ hc: ctx.mp._debug.me ? ctx.mp._debug.me.hc : null, ot: ctx.mp._debug.me ? ctx.mp._debug.me.ot : null })`);
  t.check("stage 3: B's look (hair colour, outfit) reaches A as B sends it", !!look && !!bLook.hc && !!bLook.ot && look.hc === bLook.hc && look.ot === bLook.ot, JSON.stringify({ look, bLook }));
  // …her salon hairdo too (d.hs): A draws B's car with the bouncy style's hair piece, not the default sheitel
  const styled = await A.until(`ctx.mp.ghostStats().styled >= 1`, "A draws B's salon hairdo", 30000);
  t.check("B's salon hairdo (bouncy) shows on A's screen", styled, JSON.stringify({ A: await g(`ctx.mp.ghostStats()`), hs: await g(`(Object.values(${S}.peers).find(p => p.raw === "Latke Legend") || {}).hs`), B: await B.game(`ctx.mp._debug.me.hs`) }));
  await t.shot("dropin");

  // 🌍 one sky for everyone online (the world clock): A and B, not friends, see the same time of day + the same weather
  await A.until(`ctx.mp.worldSky && ctx.mp.worldSky.on()`, "A: the world sky is on (clock measured)", 60000);
  await B.until(`ctx.mp.worldSky && ctx.mp.worldSky.on()`, "B: the world sky is on", 60000);
  await A.frames(10); await B.frames(10);
  const skyA = await g(`({ c: ctx.atmos.clock, w: ctx.atmos.weather, want: ctx.mp.worldSky.weather().kind })`), skyB = await B.game(`({ c: ctx.atmos.clock, w: ctx.atmos.weather })`);
  const dc = Math.abs(skyA.c - skyB.c), dcw = Math.min(dc, 1 - dc);
  t.check("world sky: the same time of day on two strangers' screens", dcw < 0.01, JSON.stringify({ skyA, skyB }));
  t.check("world sky: the same weather (from the world clock)", skyA.w === skyB.w && skyA.w === skyA.want, JSON.stringify({ skyA, skyB }));

  // what you see is what others see: B on foot with a rolling pin in hand → A's B holds it too (d.hi)
  if (await B.game(`!!(ctx.houseitems && ctx.foot && ctx.foot.start)`)) {
    await B.game(`(ctx.houseitems.debug.clear(), ctx.houseitems.add("rollingpin", null, false), ctx.foot.start("parked"), true)`);
    await B.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "B walks", 60000);
    const held = await A.until(`ctx.mp.ghostStats().hands >= 1`, "A sees B holding something", 30000);
    t.check("B's hand item shows on A's screen (the rolling pin in her hand)", held, JSON.stringify({ A: await g(`ctx.mp.ghostStats()`), B: await B.game(`({ shown: ctx.houseitems.shown, hi: ctx.mp._debug.me.hi })`) }));
    // …and her foot code (d.f, the friends' one): B in the old-lady disguise, busking → A's B dances in the disguise
    await B.game(`(() => { const F = ctx.foot.debug.F; F.disguise = "oldLady"; F.buskT = 60; return true; })()`);
    const moved = await A.until(`ctx.mp.ghostStats().feet.some(f => f[0] === 5 && f[1] === 2)`, "A sees B dancing in a disguise", 30000);
    t.check("B's foot move + disguise show on A's screen (dancing, as the old lady)", moved, JSON.stringify({ A: await g(`ctx.mp.ghostStats()`), B: await B.game(`ctx.mp._debug.me.f`) }));
    await B.game(`(() => { const F = ctx.foot.debug.F; F.disguise = null; F.buskT = 0; return true; })()`);
    await B.game(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
    await B.until(`ctx.state === "playing"`, "B back in her car", 30000);
    await B.game(HOLD); await B.game(PLACE(425, -1.75));
  }

  // her car as she sees it: B switches to her pink car mid-session → A draws B's car pink (d.sk: the hello only knew gold)
  await B.game(`(ctx.car.setSkin("pink"), ctx.mp._debug.me.carAt = 0, true)`);
  t.check("B's car switch reaches A (she's drawn in the car she's in now)", await A.until(`(() => { const p = Object.values(${S}.peers).find(p => p.raw === "Latke Legend"); return !!p && p.sk === "pink"; })()`, "A: B's car is pink now", 30000));
  await B.game(`(ctx.car.setSkin("gold"), ctx.mp._debug.me.carAt = 0, true)`);

  // 🌍 an emote is a reliable one-time event (the relay's r): A gets B's 😱 once, as an event — not only from B's state
  await g(`(window.__emr = [], L3.on("mp:event", e => { if (e.k === "em") window.__emr.push(e.d); }), true)`);
  await B.game(`(ctx.mp.emote(2), true)`);
  const emOk = await A.until(`(window.__emr || []).length >= 1 && window.__emr[0].i === 2`, "A: B's emote event", 30000) && await g(`window.__emr.length === 1`);
  if (!emOk) console.log("   EMDIAG", JSON.stringify({ B: await B.game(`({ flags: ctx.worldClock.flags, out: ctx.mp._debug.relOut ? ctx.mp._debug.relOut.size : -1, room: ctx.mp.room, conn: ctx.mp._debug.connected })`), A: await g(`({ seen: ctx.mp._debug.relSeen ? ctx.mp._debug.relSeen.size : -1, room: ctx.mp.room, emr: window.__emr })`) }));
  t.check("an emote arrives as a reliable event (r) and shows once", emOk, JSON.stringify(await g(`window.__emr`)));

  // stage 3, step 3: other players inside a PUBLIC room — A and B (not friends) both walk into the JFK terminal: each
  // draws the other in the hall, in her own look; out again, both are back on the road
  for (const P of [{ g, until: (c, w, ms) => A.until(c, w, ms) }, { g: c => B.game(c), until: (c, w, ms) => B.until(c, w, ms) }]) {
    await P.g(`(window.__e = ctx.airport && ctx.airport.debug && ctx.airport.debug.enterTerminal ? ctx.airport.debug.enterTerminal() : null, true)`);
    await P.until(`ctx.state === "interior" && window.__interiors && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.def.id === "terminal"`, "inside the terminal", 90000);
  }
  const bId = await g(`(Object.values(${S}.peers).find(p => p.raw === "Latke Legend") || {}).id`);
  const seeB = await A.until(`ctx.together.debug.room().mates.some(m => m.uid === "mp:" + ${JSON.stringify(bId || "")})`, "A sees B inside the terminal", 60000);
  t.check("stage 3: A sees B (a stranger, not a friend) inside the terminal", seeB, JSON.stringify(await g(`ctx.together.debug.room()`)).slice(0, 300));
  t.check("stage 3: …and B sees A in there too", await B.until(`ctx.together.debug.room().mates.some(m => /^mp:/.test(m.uid))`, "B sees A inside the terminal", 60000));
  t.check("stage 3: inside, she isn't drawn out on the street (d.in)", await g(`(() => { const p = Object.values(${S}.peers).find(p => p.raw === "Latke Legend"); return !!p && !!p.in && !p.onScreen; })()`));
  for (const P of [g, c => B.game(c)]) await P(`(window.__interiors.room && window.__interiors.room.leave(), true)`);
  await A.until(`["playing", "footRun"].includes(ctx.state)`, "A: out of the terminal", 60000);
  await B.until(`["playing", "footRun"].includes(ctx.state)`, "B: out of the terminal", 60000);
  for (const [P, s0, d0] of [[g, 400, 1.75], [c => B.game(c), 425, -1.75]]) await P(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
  await A.until(`ctx.state === "playing"`, "A: driving again", 30000); await B.until(`ctx.state === "playing"`, "B: driving again", 30000);
  await g(HOLD); await g(PLACE(400, 1.75)); await B.game(HOLD); await B.game(PLACE(425, -1.75));
  await A.until(`Object.values(${S}.peers).some(p => p.raw === "Latke Legend" && p.onScreen)`, "A sees B on the road again", 60000);

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
  const safe = await g(`(() => { const p = Object.values(${S}.peers).find(q => q.raw === "BAD WORDS HERE"); return { found: !!p, name: p && p.name, race: !!${S}.race, tag: !!${S}.tag, bonks: ${S}.bonks || 0, bumps: ${S}.bumps || 0, recv: ${S}.recv, v: Math.hypot(ctx.car.vx, ctx.car.vz), banner: (document.getElementById("mpOverlay") || {}).textContent || "" }; })()`);
  t.check("stranger's typed name never shows (they're \"Red NN\")", safe.found && /^Red \d\d$/.test(safe.name), JSON.stringify(safe));
  t.check("a stranger can't start a race or tag on my screen", !safe.race && !safe.tag && !/RACE|TAG|IT/.test(safe.banner), JSON.stringify(safe));
  // stage 3: everyone has the same bump rule — ONE harmless bounce, then she drives through for a moment (nobody can pin,
  // drag or keep shoving her: a stranger sitting on top of her at 8 Hz for ~2 s gets at most one small bounce)
  t.check("a stranger driving into me: at most one small bounce, never a shove-fest (same rule as friends)", safe.bumps <= 1 && safe.bonks === 0 && safe.v < v0 + 4, JSON.stringify({ v0, v: safe.v, bumps: safe.bumps }));
  t.check("emote / honk / record floods are dropped on my side", safe.recv >= 10 && !/BAD WORDS/.test(safe.banner), `recv ${safe.recv}`);
  bad.close(); riders.splice(riders.indexOf(bad), 1);

  // 🌍 drawn ~150 ms in the past between the relay's timestamped updates: a rider driving past at 12 m/s (5 updates a
  // second) glides forward on my screen — no jumps, no going backwards
  {
    const mv = new Rider("Kugel Kid", "blue");
    riders.push(mv);
    await mv.open();
    const s0 = me.s + 20, t0 = Date.now();
    mv.keep(() => { const s = s0 + 12 * (Date.now() - t0) / 1000; return { di: Math.round(s * 56000 / 4800), x: 240, sp: Math.round(12 * 56000 / 4800), w: ["", Math.round(s * 10) / 10, -1.75, 0] }; }, 200);
    await A.until(`Object.values(${S}.peers).some(p => p.raw === "Kugel Kid" && p.w && p.w.buf && p.w.buf.length >= 3)`, "A: the mover's timestamped updates", 30000);
    const xs = [], ts = [];
    for (let i = 0; i < 24; i++) { xs.push(await g(`(() => { const p = Object.values(${S}.peers).find(p => p.raw === "Kugel Kid"); return p && p.w ? +p.w.ca.toFixed(2) : null; })()`)); ts.push(Date.now()); await A.frames(3); }
    // (the samples are seconds apart on a slow page: judge each step against the real time between them — 12 m/s ± a little)
    const bad = xs.slice(1).map((x, i) => ({ d: x - xs[i], want: 12 * (ts[i + 1] - ts[i]) / 1000 })).filter(o => o.d < -0.05 || Math.abs(o.d - o.want) > 6 + o.want * 0.25);
    t.check("drawn between real updates: the mover glides forward at her real speed (never back, no jumps)", xs.every(x => x != null) && !bad.length, JSON.stringify({ xs, bad: bad.slice(0, 4) }));
    mv.close(); riders.splice(riders.indexOf(mv), 1);
  }

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
    // 🌍 B drives into Lakewood too — the town's loop minivans are the WORLD's: the same cars at the same places on two
    // strangers' screens at the same world time (each still has her own extra drivers), and one stopped by A stops for B
    await B.game(`ctx.town.load("lakewood")`);
    if (await B.until(`ctx.town.loaded("lakewood")`, "B: Lakewood loaded", 120000)) {
      // (the same interchange as A's — in the game a town always stands at its own fixed exit; the test dropped A in at hers)
      const exA = await g(`ctx.town.highwayS`);
      await B.game(`(ctx.town.enter({ town: "lakewood", exitS: ${JSON.stringify(exA)}, speed: 0 }), true)`);
      await B.until(`ctx.town.active && ctx.town.id === "lakewood" && !ctx.town.transitioning`, "B: in Lakewood", 60000);
      const loopsOn = q => q.until(`ctx.openworld.worldTowns() && ctx.openworld.debug.townLive().length >= 6`, "the world's town loops", 60000);
      if (await loopsOn(A) && await loopsOn(B)) {
        const T0 = await g(`Math.round(ctx.worldClock.now() + 2000)`);
        const la = await g(`JSON.stringify(ctx.openworld.debug.townCarsAt(${T0}).map(c => [c.key, +c.x.toFixed(2), +c.z.toFixed(2)]))`);
        const lb = await B.game(`JSON.stringify(ctx.openworld.debug.townCarsAt(${T0}).map(c => [c.key, +c.x.toFixed(2), +c.z.toFixed(2)]))`);
        t.check("world town loops: the same minivans at the same places on two strangers' screens", la === lb && JSON.parse(la).length >= 6, `${JSON.parse(la).length} / ${JSON.parse(lb).length}`);
        // A claims one (as if she stepped out in front of it): it pulls over on B's screen too (a reliable "tcl" event)
        const key = await g(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.owTown && typeof c.data.party === "string"); return c && ctx.party.claim(c, { how: "step" }) ? c.data.key : null; })()`);
        t.check("world town loops: A stops one…", !!key, String(key));
        if (key) t.check("…and it pulls over on B's screen too", await B.until(`ctx.openworld.debug.townClaims.claimed(${JSON.stringify(key)})`, "B: the claim arrives", 30000));
      } else t.check("world town loops: both screens run the world's loops in Lakewood", false, JSON.stringify(await g(`({ wt: ctx.openworld.worldTowns(), live: ctx.openworld.debug.townLive().length, sky: ctx.mp.worldSky.on() })`)));
      await B.game(`(ctx.town.leave("reset"), true)`);
      await B.until(`!ctx.town.active`, "B: back on the highway", 30000);
      await B.game(HOLD); await B.game(PLACE(425, -1.75));
    }
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
  await g(`(ctx.dina.start(), true)`);                   // (the title's Dina tile is hidden since the hometown landing — the same start her door and her bus use)
  t.check("Dina's mode → offline", await A.until(`/^dina/.test(ctx.state) && !${S}.want`, "A: Dina offline", 30000), await g(`ctx.state`));
  await g(`(L3.setState("title"), true)`);
  await A.frames(5);
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  t.check("back in the world → online again", await A.until(`${S}.connected`, "A: online after Dina", 30000));

  // ── FRIENDS: a private group inside the same world ──
  await g(`(L3.setState("title"), true)`);
  await A.frames(5);
  await t.game(`L3.startRun({ mode: "cruise", quick: true })`);     // (▶ PLAY first, then 📱 👯 › Play with a friend — the title has no Friends tile any more)
  await t.until(`["playing", "footRun"].includes(__lulu3d.ctx.state)`, "▶ PLAY: her run starts", 120000);
  await t.game(`(ctx.party.hostRoam(), true)`);
  if (!await A.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "A: 📤 Invite → Free Roam", 120000)) return;
  await g(HOLD); await g(PLACE(400, 1.75));
  t.check("in a party she's still in EVERYONE (strangers stay in the world)", await A.until(`${S}.connected && ctx.mp.room === "lobby"`, "A: online in the party", 30000));
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
