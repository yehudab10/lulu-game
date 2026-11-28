// 🚗 The road sweep, part 2 (ci/sweep-road, 3d/docs/sweeps/sweep-road.md): A WHOLE LAP on a phone (390 × 844 touch),
// every feature on, the QA watchdog on.
//   survey  the car is carried up the highway a lap and a bit (200 m steps, as fast as a car would plan things) and the
//           test reads what a player reads: every green / blue board, the trip bar, the exit chip. Checks: an "1 MI" /
//           "½ MI" board stands about that far before the exit it names; the boards that list the next places up the
//           road say real distances; the trip bar + the exit chip name the same next exit as the boards (JFK too)
//   (SHOTS=1 / --shots: a picture at each exit's first board, its gantry and its gore)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "sweeproad2",
  parts: ["survey"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all&airport=1",
  save2d: { totalCoins: 2000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const PART = process.env.SWEEPROAD_PART ? process.env.SWEEPROAD_PART.split(",") : this.parts;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 400)); } };
    try {
      if (PART.includes("survey")) await step("survey", () => survey(t));
    } finally { W.dropRelayErrors(t); }
  },
};

const MI = 1609;

async function survey(t) {
  const g = t.game;
  await W.install(t);
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 180000)) return;
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
  const s0 = await g(`Math.round(ctx.car.s)`);
  const LAP = 16000, STEP = 200, end = s0 + LAP + 2400;
  const seen = [];
  for (let s = s0 + 100; s <= end; s += STEP) {
    await g(`(() => { const hw = ctx.world.highway, p = hw.point(${s}, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = 1.75;
      ctx.car.vx = Math.sin(p.h) * 30; ctx.car.vz = Math.cos(p.h) * 30; ctx.car.vF = 30; ctx.G.invT = 5; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
    await W.moved(t);
    await t.frames(10);         // (the trip bar's next-place sum is cached for 0.25 s of game time)
    const r = await t.L(`(() => { const C = __lulu3d.ctx, q = s => { const e = document.querySelector(s); return e && !e.closest(".hidden") ? e.textContent.trim() : ""; };
      return { s: ${s}, state: C.state, town: !!(C.town && C.town.active), trip: q("#tripLabel"), chip: q(".exits-chip") }; })()`);
    seen.push(r);
    // a picture coming up to each exit (a phone held upright): the boards, the decel lane, the gore
    const lapM = ((s % 16000) + 16000) % 16000;
    if (s < s0 + 16000 && [2900, 3500, 5100, 5600, 7700, 8700, 11300, 11900].some(m => Math.abs(lapM - m) < STEP / 2)) await t.shot(`lap-${lapM}`);
    // (boards are collected as she passes: JFK takes its own down once she's gone by)
    await g(`(() => { const M = window.__boards = window.__boards || new Map(); for (const x of ctx.world.signs) if (x.s > ${s} - 300 && x.s < ${s} + 3000) M.set(Math.round(x.s) + "|" + x.lines.join("/"), { s: Math.round(x.s), d: x.d, lines: x.lines, tab: x.tab || null }); return true; })()`);
    if (r.state !== "playing" || r.town) { await g(`(ctx.town && ctx.town.active && ctx.town.leave("reset"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`); }
  }
  const W0 = await g(`(() => {
    const L = ${s0}, E = ${end};
    const signs = [...(window.__boards || new Map()).values()].filter(x => x.s > L - 200 && x.s < E + 2000);
    const exits = ctx.town && ctx.town.exits ? ctx.town.exits.map(e => ({ s: Math.round(e.s), id: e.id, no: e.no, label: e.label })) : [];
    const ap = ctx.airport && ctx.airport.on ? ctx.airport.planned : null;
    const air = ctx.airport && ctx.airport.zones ? ctx.airport.zones(L - 2000, E + 2000).map(z => Math.round(z.s)) : [];
    const rests = ctx.exits ? ctx.exits.rests.map(r => ({ s: Math.round(r.s), name: r.name })) : [];
    return { signs, exits, air, rests, ap };
  })()`);
  console.log(`    · exits ${JSON.stringify(W0.exits)} · JFK ${JSON.stringify(W0.air)} · rests ${JSON.stringify(W0.rests)}`);
  const places = [];
  for (const e of W0.exits) places.push({ s: e.s, kind: "exit", name: String(e.id).toUpperCase(), alt: String(e.label || e.id).toUpperCase(), no: String(e.no || "") });
  for (const s of W0.air) places.push({ s, kind: "exit", name: "JFK", alt: "JFK", no: "12" });
  for (const r of W0.rests) places.push({ s: r.s, kind: "rest", name: "REST AREA" });
  places.sort((a, b) => a.s - b.s);
  const nextAfter = (s, f = () => true) => places.find(p => p.s > s && f(p));
  // ── the boards ──
  const bad = [];
  for (const sg of W0.signs) {
    const txt = sg.lines.join(" | ");
    const isRest = /REST AREA/.test(txt), tabNo = sg.tab && (/EXIT (\d+)/.exec(sg.tab) || [])[1];
    const target = nextAfter(sg.s, p => isRest ? p.kind === "rest" : tabNo ? p.no === tabNo : true);
    if (/(^|[^.\d])1 MI\b/.test(txt) && !/\d\.\d MI/.test(txt)) {
      const a = target ? target.s - sg.s : null;
      if (a == null || a < 1100 || a > 2000) bad.push(`"${txt}" @${sg.s}: the place is ${a} m on`);
    }
    if (/½ MI/.test(txt)) {
      const a = target ? target.s - sg.s : null;
      if (a == null || a < 450 || a > 1200) bad.push(`"${txt}" @${sg.s}: the place is ${a} m on`);
    }
    // the "next places up the road" boards: NAME  x.y MI (the same name twice = the next one, then the one after)
    const seenNm = {};
    for (const ln of sg.lines) {
      const m = /^(.*\S)\s+(\d+\.\d) MI$/.exec(ln);
      if (!m) continue;
      const nm = m[1].trim(), want = +m[2] * MI, nth = seenNm[nm] = (seenNm[nm] || 0) + 1;
      const match = q => nm === "REST AREA" ? q.kind === "rest" : q.name === nm || q.name.startsWith(nm) || nm.startsWith(q.name);
      const p = places.filter(q => q.s > sg.s && match(q))[nth - 1];
      if (!p) { if (sg.s + want < end) bad.push(`"${ln}" @${sg.s}: no ${nm} ahead`); continue; }
      if (Math.abs((p.s - sg.s) - want) > 0.2 * MI) bad.push(`"${ln}" @${sg.s}: ${nm} is really ${((p.s - sg.s) / MI).toFixed(1)} mi on`);
    }
  }
  console.log(`    · ${W0.signs.length} boards: ` + W0.signs.filter(x => /MI\b|EXIT|REST/.test(x.lines.join(" "))).map(x => `@${x.s}${x.tab ? "[" + x.tab + "]" : ""} ${x.lines.join(" / ")}`).join(" ‖ ").slice(0, 3000));
  t.check("lap: every 1 MI / ½ MI board stands about that far before its exit, every 'x.y MI' board is right (±0.2)", bad.length === 0, bad.slice(0, 6).join(" · "));
  // ── the trip bar + the exit chip ──
  const tb = [];
  for (const r of seen) {
    if (r.state !== "playing" || r.town) continue;
    const nx = nextAfter(r.s + 59);
    const m = /in (\d+\.\d) mi/.exec(r.trip || "");
    if (nx && m && nx.s - r.s < 2 * MI) {
      const real = (nx.s - r.s) / MI;
      if (Math.abs(real - +m[1]) > 0.15) tb.push(`@${r.s} trip "${r.trip}" vs ${nx.name} ${real.toFixed(2)} mi`);
      if (nx.kind === "exit" && !new RegExp(nx.name.split(" ")[0], "i").test(r.trip)) tb.push(`@${r.s} trip "${r.trip}" vs next ${nx.name}`);
    }
    if (nx && nx.s - r.s < MI - 100 && nx.s - r.s > 200 && !r.chip) tb.push(`@${r.s} no exit chip ${((nx.s - r.s) / MI).toFixed(1)} mi before ${nx.name}`);
    if (r.chip && nx && nx.s - r.s < MI - 100 && !new RegExp(nx.kind === "rest" ? "REST" : nx.name.split(" ")[0] + "|" + nx.alt.split(" ")[0], "i").test(r.chip)) tb.push(`@${r.s} chip "${r.chip}" vs ${nx.name}`);
  }
  t.check("lap: the trip bar + the exit chip count down to the same next exit as the boards (JFK too)", tb.length === 0, tb.slice(0, 6).join(" · "));
  W.check(t, "lap survey", await W.report(t), ["nan", "overlay", "underground", "stuck"]);
}
