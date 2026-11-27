// 🏛️ City hall › Midwood's new mayor (roadmap 31, features/cityhall/mayor.js): a communist-wannabe planner (one name
// constant, a pun on politics), policy satire only; today's edict drives Midwood's protest, the notice board and a Complaints line; a Courtroom 2B
// case strikes it down for good; Pickleman lost by 3 votes and demands a recount from his pickle stand; nothing pays.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "cityhall4",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cityhall,places",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game, CH = `ctx.cityhall`, M = `ctx.cityhall.mayor31`;
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const st = () => g(`L3.state`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    const drain = async (n = 14) => { for (let i = 0; i < n && await g(`ctx.dialogOpen`); i++) { if ((await opts()).length) return; await t.tap(0); await t.frames(2); } };
    const promptText = () => t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);

    // ── the data: one name constant, ≥ 10 edicts, no real person anywhere in the words ──
    const src = await t.L(`fetch("js/features/cityhall/data.js").then(r => r.text())`);
    t.check("no real politician's name in city hall's words", !/mamdani|zohran/i.test(src));
    t.check("Midwood's mayor is the one name constant", await g(`${CH}.mayor("midwood").name`) === (src.match(/MIDWOOD_MAYOR = \{ name: "([^"]+)"/) || [])[1]);
    t.check("Lakewood keeps Mayor Kugelman", /Kugelman/.test(await g(`${CH}.mayor("lakewood").name`)));
    t.check("at least 10 edicts, each with a notice, signs and a chant", await t.L(`import("./js/features/cityhall/data.js").then(m => m.EDICTS.length >= 10 && m.EDICTS.every(e => e.notice && e.signs.length >= 3 && e.chant.length === 4))`));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ${CH}.debug.RB.next = 1e9, ${CH}.debug.S.struck = {}, true)`);
    await g(`(ctx.town.load("midwood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood loads", 90000);
    await g(`ctx.town.enter({ town: "midwood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "into Midwood", 8000)) return;
    await W.install(t);

    // ── today's edict → the protest topic ──
    const e0 = await g(`${M}.today().id`);
    t.check(`today's edict: ${e0}`, !!e0);
    await g(`(${CH}.debug.force.protest = true, ${CH}.protest.stop(), true)`);
    await t.frames(4);
    t.check("Midwood's protest is about today's edict", await g(`${CH}.protest.topic().id === "edict:" + ${M}.today().id`));
    await g(`(${CH}.debug.force.protest = false, true)`);

    // ── Borough Hall: the mayor, the notice board, the Complaints line ──
    await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
    await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000);
    await g(`(() => { const sp = ${CH}.spot(); ctx.foot.debug.F.pos.set(sp.x + sp.nx, 0.05, sp.z + sp.nz); if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
    await g(`(${CH}.debug.force.mayorOut = false, ${CH}.debug.force.closed = 0, ${CH}.debug.force.hour = 9, ${M}.MY.force.board = true, true)`);      // (9:00: not his lunch hour)
    await g(`${CH}.enter()`);
    if (await t.until(`__lulu3d.state === "interior" && __interiors.room && __interiors.room.ready`, "inside Borough Hall", 60000)) {
      t.check("the mayor in the office is the new one", await g(`__interiors.room.byId.mayor && __interiors.room.byId.mayor.name === ${CH}.mayor("midwood").name`));
      const use = async id => { await g(`(() => { const r = __interiors.room, h = r.hots.find(h => h.id === ${JSON.stringify(id)}); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`); await t.until(`__lulu3d.ctx.dialogOpen`, `${id} talks`, 6000); };
      const c0 = await coins();
      await use("board");
      t.check("the notice board shows today's edict", await t.until(`/EDICT/.test(document.getElementById("dialog").textContent)`, "the edict on the board", 6000));
      await drain();
      await use("win_complaints");
      for (let i = 0; i < 30 && !(await opts()).length; i++) { await t.tap(0); await t.frames(2); }
      t.check(`the Complaints window has a line for the edict (${(await opts()).join(" / ").slice(0, 80)})`, (await opts()).some(o => /edict/i.test(o)));
      await drain();
      await use("mayor"); await drain(30);
      t.check(`nothing in Borough Hall pays or charges (${c0} → ${await coins()})`, await coins() === c0);
      await t.shot("cityhall4-office");
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000);
    }
    await g(`(${M}.MY.force.board = false, ${CH}.debug.force.closed = null, true)`);

    // ── Courtroom 2B: the edict's case, then struck down for good ──
    const cs = await g(`(() => { const C = ctx.civic && ctx.civic.courts; ${M}.addCase(); const c = C && C.caseById("cityhall:edict:" + ${M}.today().id); return c ? { title: c.title, town: c.town, avail: c.available() } : null; })()`);
    t.check(`a case on Midwood's 2B docket (${cs && cs.title})`, !!cs && cs.town === "midwood" && cs.avail);
    await g(`(() => { const c = ctx.civic.courts.caseById("cityhall:edict:" + ${M}.today().id); window.__H = {}; c.acts.ruling(window.__H); return true; })()`);
    await drain();
    t.check(`the ruling strikes it down (${e0})`, await g(`!!${CH}.debug.S.struck[${JSON.stringify(e0)}] && ${M}.today().id !== ${JSON.stringify(e0)}`));
    t.check("…its case is closed", await g(`!ctx.civic.courts.caseById("cityhall:edict:${e0}").available()`));
    t.check("…and the next edict gets its own case", await g(`(${M}.addCase(), !!ctx.civic.courts.caseById("cityhall:edict:" + ${M}.today().id))`));
    await g(`(() => { const S = ${CH}.debug.S; for (const id of ["grocery","buses","rent","pothole","kugel","avenue","bench","tickets","umbrella","bread"]) S.struck[id] = 1; return true; })()`);
    t.check("every edict struck → no edict, the protests go back to the old topics", await g(`${M}.today() === null && !/^edict:/.test(${CH}.protest.topic("midwood").id)`));
    await g(`(${CH}.debug.S.struck = {}, true)`);

    // ── Pickleman's recount stand ──
    await t.until(`!!__lulu3d.ctx.cityhall.mayor31.MY.stand`, "Pickleman's stand is up outside Borough Hall", 8000);
    const P = await g(`(() => { const s = ${M}.MY.stand; return { x: s.x, z: s.z }; })()`);
    const onWalk = await g(`(() => { const n = ctx.world.road.nearest(${P.x}, ${P.z}, ctx.car.s, {}); return Math.abs(n.d) > (n.street ? n.street.curb : 4) - 0.3; })()`);
    t.check("…on the sidewalk, not in a lane", onWalk);
    await g(`(() => { ctx.foot.debug.F.pos.set(${P.x} + 0.8, 0.05, ${P.z} + 0.8); if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
    await t.frames(30);
    await t.shot("cityhall4-pickleman");
    t.check(`✋ offers Pickleman's recount (${(await promptText()).slice(0, 50)})`, /RECOUNT/i.test(await promptText()));
    const c1 = await coins();
    for (let i = 0; i < 6 && !await g(`ctx.dialogOpen`); i++) { await t.tap(0); await t.frames(3); }
    t.check("Pickleman talks (three votes!)", await t.until(`/three votes|recount|pickle|ribbons|Board of Elections/i.test(document.getElementById("dialog").textContent)`, "Pickleman's line", 6000));
    await drain();
    t.check(`…and it costs nothing (${c1} → ${await coins()})`, await coins() === c1);
    t.check("Midwood's ribbon cuttings are the People's", await t.L(`import("./js/features/cityhall/data.js").then(m => m.RIBBONS.midwood.every(r => /People's/.test(r.what)))`));
    const r = await W.report(t); W.log(r); W.check(t, "the new mayor", r, ["nan", "overlay", "stuck"]);
  },
};
