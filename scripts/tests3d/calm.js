// 🧘 A CALM SCREEN (ci/calm) — how many pop-ups a player actually sees, measured in four situations, against the
// LOCAL relay (never production):
//   (a) SOLO   a minute on the highway in a cruise (every feature on: &enable=all)
//   (b) FOOT   a minute on foot in Lakewood
//   (c) FRIENDS a minute with a friend in a 🌍 Free Roam town (2 real pages) — strangers around too
//   (d) ONLINE a minute on the highway with strangers' ghosts around (fake riders: emotes, honks, records)
// The sampler (in the page) looks at every overlay a feature can pop up — toasts, banners, speech bubbles, floaters,
// captions, the radio ticker, texts / calls, law / heist / meta toasts, Shared Road's overlay, the invitation chip — and
// counts each APPEARANCE (an element turning visible, or its text changing), the most on screen at once, and how much of
// the screen they cover. Checks (phone-sized pages): a solo highway minute shows ≤ LIMIT.solo pop-ups and never two
// toasts at once; a stranger never produces a toast / banner / record line, in a party or not.
// CALM_SECS=<n> shortens the minute (local runs); CALM_REPORT=1 only prints (no checks — the "before" numbers).
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const PORT = 28000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=all&mpurl=${encodeURIComponent(URL)}`;
const SECS = +(process.env.CALM_SECS || 60);
const REPORT_ONLY = !!process.env.CALM_REPORT;
const LIMIT = { solo: 18, foot: 12, friends: 12, online: 12 };   // (one random minute swings: before ≈ 25 / 17 / 21 / 14, after ≈ 16 / 8 / 9 / …)     // pop-ups a minute (overlays a player has to read)
const PHONE = { width: 844, height: 390 };

// (the page-side sampler: one rAF loop, game-time stamped)
const SAMPLER = `(() => {
  if (window.__calm) return true;
  const SEL = [
    ["toast", "#toasts .toast"], ["banner", "#banner"], ["meta", "#metaToast .mt"], ["law", ".law-toast"], ["law", ".law-bubble"], ["law", ".law-cap"],
    ["speech", "#banterBubbles .bn-b"], ["bubble", "#footBubbles .fbub"], ["floater", "#footBubbles .ffloat"], ["bubble", ".re-bub"],
    ["caption", "#cameosCap"], ["caption", "#cameosChips > *"], ["caption", "#hsCap"], ["radio", ".hs-radio"], ["caption", ".heist-cap"],
    ["text", ".jtext"], ["call", ".jphone"], ["mp", "#mpOverlay .toasts > div"], ["mp", "#mpOverlay .ban"], ["chip", "#owChip"], ["chip", "#frChip"],
    ["toast", ".lp-toast"], ["bubble", ".dl-bubble"], ["floater", ".dl-float"], ["prompt", "#prompt"],
  ];
  const C = window.__calm = { on: false, t0: 0, events: [], seen: new Map(), maxOn: 0, maxToasts: 0, cover: 0, coverSum: 0, samples: 0, toastsNow: 0 };
  const L3 = () => window.__lulu3d;
  const gt = () => (L3() ? L3().frames : 0) / 30;
  const vis = el => {
    if (!el.isConnected || /\\b(hidden|off|gone|hide|out)\\b/.test(el.className || "")) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return null;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 40 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    const tx = (el.textContent || "").trim();
    return tx ? { r, tx } : null;
  };
  let prevKeys = new Set();
  const tick = () => {
    requestAnimationFrame(tick);
    if (!C.on) return;
    let on = 0, toasts = 0, area = 0;
    const now = new Set(), keys = new Set();
    for (const [kind, sel] of SEL) for (const el of document.querySelectorAll(sel)) {
      const v = vis(el);
      if (!v) continue;
      now.add(el);
      if (kind !== "prompt" && kind !== "chip") { on++; area += Math.min(v.r.width, innerWidth) * Math.min(v.r.height, innerHeight); }
      if (kind === "toast" || kind === "meta" || kind === "law" && el.classList.contains("law-toast") || kind === "mp") toasts++;
      // an APPEARANCE = this kind + text wasn't on screen a moment ago (a re-rendered overlay isn't a new pop-up)
      const key = kind === "call" ? "call" : /^(text|caption|radio)$/.test(kind) ? kind + "|#" + (el.id || el.className) : kind + "|" + v.tx;   // (a card whose lines change is one pop-up; ringing → talking is ONE call)
      if (!prevKeys.has(key) && !keys.has(key)) C.events.push({ t: +(gt() - C.t0).toFixed(1), kind, text: v.tx.slice(0, 80) });
      keys.add(key);
      C.seen.set(el, v.tx);
    }
    prevKeys = keys;
    for (const el of [...C.seen.keys()]) if (!now.has(el)) C.seen.delete(el);
    C.maxOn = Math.max(C.maxOn, on); C.maxToasts = Math.max(C.maxToasts, toasts); C.toastsNow = toasts;
    const cov = area / (innerWidth * innerHeight);
    C.cover = Math.max(C.cover, cov); C.coverSum += cov; C.samples++;
  };
  requestAnimationFrame(tick);
  window.__calmStart = () => { prevKeys = new Set(); Object.assign(C, { on: true, t0: gt(), events: [], maxOn: 0, maxToasts: 0, cover: 0, coverSum: 0, samples: 0 }); C.seen.clear(); return true; };
  window.__calmStop = () => { C.on = false; const secs = Math.max(1, gt() - C.t0); const by = {}; for (const e of C.events) by[e.kind] = (by[e.kind] || 0) + 1;
    const pop = C.events.filter(e => e.kind !== "prompt" && e.kind !== "chip").length;
    return { secs: +secs.toFixed(1), perMin: +(pop * 60 / secs).toFixed(1), pop, by, maxOn: C.maxOn, maxToasts: C.maxToasts,
      coverMax: +(C.cover * 100).toFixed(1), coverAvg: +(C.coverSum / Math.max(1, C.samples) * 100).toFixed(1), events: C.events.slice(0, 60) }; };
  return true;
})()`;

/** A raw protocol-v1 stranger (Node's WebSocket). */
class Rider {
  constructor(name, sk) { this.name = name; this.sk = sk; this.d = { m: 0, x: 240, di: 0, sp: 0, vk: "car" }; this.iv = null; }
  open() {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${URL}/room/lobby`);
      ws.onopen = () => ws.send(JSON.stringify({ t: "j", v: 1, room: "lobby", name: this.name, sk: this.sk }));
      ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === "h") resolve(); };
      ws.onerror = () => reject(new Error("rider could not connect"));
    });
  }
  keep(fn, ms = 250) { this.stop(); let n = 0; this.iv = setInterval(() => { n++; Object.assign(this.d, fn(n) || {}); try { this.ws.send(JSON.stringify({ t: "s", d: this.d })); if (n % 8 === 0) this.ws.send(JSON.stringify({ t: "e", e: "honk" })); } catch (e) { } }, ms); }
  stop() { if (this.iv) clearInterval(this.iv); this.iv = null; }
  close() { this.stop(); try { this.ws.close(); } catch (e) { } }
}
/** Strangers that emote, honk and "set records" around a point: { s, d } on the highway or { z, x, zz } in a town. */
async function crowd(n, at) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = new Rider("Kugel Kid", ["red", "blue", "green", "gold"][i % 4]);
    await r.open();
    r.keep(k => {
      const w = at.z ? [at.z, at.x + (i % 3 - 1) * 6, at.zz + 6 + i * 4, 0] : ["", at.s + 8 + i * 7, (i % 3 - 1) * 3, 0];
      return { di: Math.round((at.s || 0) * 56000 / 4800), x: 240, w, em: [k, k % 6], pb: [k, 100000 + k] };
    });
    out.push(r);
  }
  return out;
}

module.exports = {
  name: "calm",
  viewport: PHONE,
  query: Q,
  save2d: { totalCoins: 800, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid", footRunsPlayed: 3, runs3d: 6 },
  async run(t) {
    const relay = await startRelay(PORT);
    setWallCap(8 * 60000);
    const pages = [], riders = [];
    try { await body(t, pages, riders); }
    catch (e) { t.check("calm threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const r of riders) r.close();
      for (const g of pages) { try { await g.page.close(); } catch (e) { } }
      relay.kill();
    }
  },
};

const SHOW = (name, r) => console.log(`   CALM ${name} ${JSON.stringify({ perMin: r.perMin, pop: r.pop, secs: r.secs, maxOn: r.maxOn, maxToasts: r.maxToasts, coverMax: r.coverMax, coverAvg: r.coverAvg, by: r.by })}\n     ${r.events.map(e => `${e.t}s ${e.kind}: ${e.text}`).slice(0, 40).join("\n     ")}`);
const STRANGER = /\b(Red|Blue|Green|Gold|Pink|Purple|Orange|Black|Rider) \d\d\b|set a record/;

async function minute(P, secs = SECS) {
  await P.L(`window.__calmStart()`);
  await P.frames(Math.round(secs * 30));
  return P.L(`window.__calmStop()`);
}

async function body(t, pages, riders) {
  const A = hostPage(t), g = t.game;
  await t.L(SAMPLER);
  const results = {};
  // ── (a) SOLO on the highway: cruising with the autopilot (traffic, roadside, chatter, the radio — all on) ──
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await A.until(`__lulu3d.state === "playing"`, "solo: cruise starts")) return;
  await g(`(ctx.mp && ctx.mp.setOnline(false), ctx.banter.autopilot = { d: 1.75, speed: 24 }, ctx.G.invT = 20, true)`);
  results.solo = await minute(A);
  SHOW("solo highway (phone landscape)", results.solo);
  // portrait: the same drive, a while
  await t.page.setViewportSize({ width: 390, height: 844 });
  results.soloPortrait = await minute(A, Math.min(SECS, 30));
  SHOW("solo highway (phone portrait)", results.soloPortrait);
  await t.page.setViewportSize(PHONE);

  // ── (b) FOOT in Lakewood: walking about ──
  await g(`ctx.town.load("lakewood")`);
  if (await A.until(`ctx.town.loaded("lakewood")`, "Lakewood loads", 120000)) {
    await g(`(ctx.banter.autopilot = null, ctx.town.enter({ town: "lakewood", exitS: ctx.car.s, speed: 0 }), true)`);
    await A.until(`ctx.town.active && !ctx.town.transitioning`, "in Lakewood", 60000);
    await g(`ctx.foot.start("parked")`);
    await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, "on foot", 60000);
    await t.L(`(window.__walk = setInterval(() => { const a = (Date.now() / 4000) % (Math.PI * 2); __pad.axes[0] = Math.sin(a) * 0.6; __pad.axes[1] = -0.8; }, 200), true)`);
    results.foot = await minute(A);
    await t.L(`(clearInterval(window.__walk), __pad.axes[0] = 0, __pad.axes[1] = 0, true)`);
    SHOW("on foot in Lakewood (phone landscape)", results.foot);
  }

  // ── (c) FRIENDS: a 🌍 Free Roam hangout in town, a friend beside me, strangers around ──
  await g(`(L3.setState("title"), true)`);
  await A.frames(5);
  await g(`(ctx.mp.setOnline(true), ctx.party.hostRoam(), true)`);
  if (!await A.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "friends: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), uid = await g(`ctx.party.uid`);
  const B = await guestPage(t, "friend", { totalCoins: 0, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q}&party=${code}&with=${uid}`, PHONE);
  pages.push(B);
  await B.until(`ctx.party && ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && (ctx.state === "playing" || ctx.state === "footRun")`, "friend joins", 240000);
  await A.until(`ctx.party.players.length >= 2`, "friend in the party", 60000);
  const me = await g(`({ s: ctx.car.s })`);
  riders.push(...await crowd(4, { s: me.s }));
  await g(`(ctx.banter.autopilot = { d: 1.75, speed: 14 }, true)`);
  await B.game(`(ctx.banter.autopilot = { d: -1.75, speed: 14 }, true)`);
  results.friends = await minute(A);
  SHOW("friends hangout + strangers (phone landscape)", results.friends);
  for (const r of riders) r.close();
  riders.length = 0;

  // ── (d) ONLINE, solo: strangers' ghosts all around on the highway (a fresh page: two heavy pages in one browser are
  //    too much for a CI runner — the friend's page closes first) ──
  try { await B.page.close(); } catch (e) { }
  pages.splice(pages.indexOf(B), 1);
  await g(`(ctx.party.leave(), true)`);
  const O = await guestPage(t, "online", { totalCoins: 0, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid", footRunsPlayed: 3, runs3d: 6 }, Q, PHONE);
  pages.push(O);
  await O.until(`__lulu3d && __lulu3d.state === "title"`, "online page boots", 180000);
  await O.L(SAMPLER);
  await O.game(`L3.startRun({ mode: "cruise", quick: true })`);
  await O.until(`__lulu3d.state === "playing"`, "online: cruise");
  await O.game(`(ctx.banter.autopilot = { d: 1.75, speed: 0 }, ctx.mp.setOnline(true), true)`);
  await O.until(`ctx.mp.connected`, "online: in EVERYONE", 60000);
  const me2 = await O.game(`({ s: ctx.car.s })`);
  riders.push(...await crowd(6, { s: me2.s }));
  await O.until(`ctx.mp.near >= 3`, "online: ghosts around", 60000);
  results.online = await minute(O);
  SHOW("online with strangers (phone landscape)", results.online);

  if (REPORT_ONLY) { t.check("report only (CALM_REPORT)", true); return; }
  const per = r => r ? r.perMin : 0;
  t.check(`solo highway: ≤ ${LIMIT.solo} pop-ups a minute`, per(results.solo) <= LIMIT.solo, JSON.stringify(results.solo.by));
  t.check("solo highway: never two toasts at once on a phone", results.solo.maxToasts <= 1 && results.soloPortrait.maxToasts <= 1, `${results.solo.maxToasts} / ${results.soloPortrait.maxToasts}`);
  if (results.foot) t.check(`on foot in town: ≤ ${LIMIT.foot} pop-ups a minute`, per(results.foot) <= LIMIT.foot, JSON.stringify(results.foot.by));
  t.check(`with a friend: ≤ ${LIMIT.friends} pop-ups a minute`, per(results.friends) <= LIMIT.friends, JSON.stringify(results.friends.by));
  t.check(`online with strangers: ≤ ${LIMIT.online} pop-ups a minute`, per(results.online) <= LIMIT.online, JSON.stringify(results.online.by));
  const fromStrangers = r => r.events.filter(e => e.kind !== "bubble" && e.kind !== "floater" && STRANGER.test(e.text));
  t.check("a stranger never produces a toast / banner / record line (party)", fromStrangers(results.friends).length === 0, JSON.stringify(fromStrangers(results.friends)));
  t.check("a stranger never produces a toast / banner / record line (solo online)", fromStrangers(results.online).length === 0, JSON.stringify(fromStrangers(results.online)));
  for (const k of Object.keys(results)) t.check(`${k}: pop-ups never cover more than a fifth of the screen`, results[k].coverMax <= 20, `${results[k].coverMax} %`);
}
