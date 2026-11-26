// 📦 MOVE OUT — Ima's house is temporary (roadmap 23, ci/moveout: features/decor/moveout.js).
//
//  • what she bought sits in boxes in her room — exactly those things — and Ima says once what happened to them
//  • the hints, stage by stage on forced played-day counts: each stage's props are there, Ima's one line as she walks in,
//    nothing in a wall: every ✋ spot is reachable and the way from the front door to Dina's door / Ima stays open
//  • with a friend inside her copy: ✋ at the door is 🔔 RING THE BELL → Ima's refusal, she stays outside
//  • strangers' ghosts aren't drawn on / around the family lot (one on the porch hidden, one up the street shown)
//  • her FIRST own home: the pieces she'd picked go up there by themselves, no coins
//  • "Start my days here" → the hints stop: WE KEPT YOUR ROOM! (it's a gym now)
const { startRelay } = require("../lib/party3d.js");
const PORT = 29000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;

/** A raw protocol-v1 stranger (Node's WebSocket) standing still at a town point. */
class Rider {
  constructor(name, sk) { this.name = name; this.sk = sk; this.iv = null; }
  open() {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${URL}/room/lobby`);
      ws.onopen = () => ws.send(JSON.stringify({ t: "j", v: 1, room: "lobby", name: this.name, sk: this.sk }));
      ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === "h") resolve(); };
      ws.onerror = () => reject(new Error("rider could not connect"));
    });
  }
  stand(w) { this.stop(); this.iv = setInterval(() => { try { this.ws.send(JSON.stringify({ t: "s", d: { m: 1, x: 240, di: 0, sp: 0, vk: "car", w } })); } catch (e) { } }, 200); }
  stop() { if (this.iv) clearInterval(this.iv); this.iv = null; }
  close() { this.stop(); try { this.ws.close(); } catch (e) { } }
}

module.exports = {
  name: "moveout",
  viewport: { width: 1280, height: 720 },
  query: `&enable=world,foot,town,decor,realestate,multiplayer&mpurl=${encodeURIComponent(URL)}`,
  save2d: { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid", footRunsPlayed: 3, runs3d: 6 },
  async run(t) {
    const relay = await startRelay(PORT);
    const riders = [];
    try { await body(t, riders); }
    catch (e) { t.check("moveout threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally { for (const r of riders) r.close(); relay.kill(); }
  },
};

async function body(t, riders) {
  const g = t.game;
  if (!(await g(`!!(ctx.moveout && ctx.home && ctx.town.home)`))) { t.check("(no family house in a town on this build)", true); return; }
  await g(`(ctx.mp && ctx.mp.setOnline && ctx.mp.setOnline(false), true)`);
  await t.click(/PLAY/);
  if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "midwood"`, "on foot at home in Midwood", 60000)) return;
  // she bought three things (as her own homes' picker would), and picked two of them
  await g(`(() => { for (const [s, o] of [["bed", "fluffy"], ["rug", "round"], ["mailbox", "fish"]]) ctx.decor.buy(s, o); return true; })()`);
  const door = await g(`ctx.decor.debug.spotAt("door")`);
  const goIn = async (label) => {
    await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${door.x}, 0.05, ${door.z}); F.phase = "walk"; ctx.foot.obj.position.copy(F.pos); return true; })()`);
    await t.frames(3);
    await t.until(`__lulu3d.ctx.interiors.luluHome.ready()`, "house warmed", 60000);
    await g(`ctx.decor.enter()`);
    return t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready && !!__lulu3d.ctx.moveout.debug.room()`, label, 30000);
  };
  const goOut = async () => { await g(`(window.__interiors.room.leave(), true)`); return t.until(`__lulu3d.state === "footRun"`, "back out on the porch", 30000); };
  // nothing in a wall: every ✋ spot is outside every collider, and the walks door → her room → Dina's door / door → Ima stay open
  const open = () => g(`(() => {
    const r = window.__interiors.room, cols = r.cols.filter(c => c.on !== false);
    const inside = (x, z, m) => cols.some(c => x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m);
    const bad = [];
    for (const h of r.hots) { if (h.track) continue; if (inside(h.x, h.z, 0)) bad.push("hot:" + h.id); }
    const walk = pts => { for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; for (let k = 0; k <= 20; k++) { const x = ax + (bx - ax) * k / 20, z = az + (bz - az) * k / 20; if (inside(x, z, 0.22)) return [x.toFixed(2), z.toFixed(2)]; } } return null; };
    const d = r.hots.find(h => h.id === "dinaRoom"), I = r.byId.ima && r.byId.ima.p.obj.position;
    const a = walk([[1.4, 1.9], [1.4, 0.6], [3.1, 0.6], [d ? d.x : 8.5, d ? d.z : -1.1]]);
    if (a) bad.push("toDina@" + a);
    const b = walk([[1.4, 1.9], [-3.1, 0.6], [I ? I.x + 0.6 : -5, I ? I.z + 0.6 : -0.4]]);
    if (b) bad.push("toIma@" + b);
    return bad;
  })()`);

  // ── day 1: her things in boxes, Ima says once what happened to them ──
  await g(`ctx.moveout.debug.setDays(1, false)`);
  if (!await goIn("inside on day 1")) return;
  const M1 = await g(`ctx.moveout.debug.room()`);
  const box = await g(`({ boxed: ctx.moveout.boxed().map(b => b.slot + ":" + b.id).sort(), bought: ctx.decor.summary().bought.map(b => b.slot + ":" + b.name).length })`);
  t.check("her boxes hold exactly what she bought (3 things, 3 boxes)", M1.boxes === 3 && box.boxed.join() === "bed:fluffy,mailbox:fish,rug:round" && box.bought === 3, JSON.stringify({ M1, box }));
  t.check("…Ima tells her once what happened to her things", /packed your things/.test(M1.line || ""), M1.line);
  t.check("…no redecorate spots at Ima's, a 📦 Your things spot", !(await g(`window.__interiors.room.hots.some(h => /^slot:/.test(h.id))`)) && await g(`window.__interiors.room.hots.some(h => h.id === "boxes")`));
  t.check("…Ima's own bed and rug, not hers", await g(`(() => { const V = ctx.decor.debug.room().data.V; const vis = s => Object.keys(V.cache[s] || {}).filter(k => V.cache[s][k] && V.cache[s][k].visible).join(); return vis("bed") === "basic" && vis("rug") === "none"; })()`), await g(`JSON.stringify(Object.keys(ctx.decor.debug.room().data.V.cache))`));
  const bad1 = await open();
  t.check("…nothing in a wall, every spot reachable (day 1)", bad1.length === 0, bad1.join(" "));
  await t.shot("day1-boxes");
  await goOut();
  if (!await goIn("inside again")) return;
  t.check("…said once: not again on the next visit", !/packed your things/.test((await g(`ctx.moveout.debug.room()`)).line || ""));
  await goOut();

  // ── the stages, on forced played-day counts ──
  const ST = await g(`ctx.moveout.debug.STAGES.map(s => ({ id: s.id, at: s.at, line: s.line }))`);
  let props0 = 0;
  for (let k = 0; k < ST.length; k++) {
    await g(`ctx.moveout.debug.setDays(${ST[k].at}, true)`);
    if (!await goIn(`inside on day ${ST[k].at}`)) return;
    const M = await g(`(() => { const m = ctx.moveout.debug.room(); return { stage: m.stage, line: m.line, props: m.props.length, boxes: m.boxes, at: m.at, bed: !!(ctx.decor.debug.room().data.V.objs.bed && ctx.decor.debug.room().data.V.objs.bed.visible) }; })()`);
    t.check(`stage ${k + 1} (${ST[k].id}, day ${ST[k].at}): it's showing, with Ima's line`, M.stage === k && M.line === ST[k].line, JSON.stringify(M));
    t.check(`…more than the stage before (props ${props0} → ${M.props})`, M.props >= props0 && (k === 0 || M.props > props0 || ST[k].id === "bike" || ST[k].id === "boarder"), JSON.stringify(M));
    const bad = await open();
    t.check(`…nothing in a wall, every spot reachable (${ST[k].id})`, bad.length === 0, bad.join(" "));
    if (ST[k].id === "rent") t.check("…her boxes moved by the front door", M.at && M.at.x < 2, JSON.stringify(M.at));
    if (ST[k].id === "boarder") t.check("…her bed is an air mattress now", !M.bed);
    props0 = M.props;
    await t.shot(`stage-${k + 1}-${ST[k].id}`);
    await goOut();
  }

  // ── a friend inside her copy: the door is a bell, Ima says no ──
  await g(`(window.__fh = ctx.moveout.friendHome, ctx.moveout.friendHome = () => true, true)`);
  await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${door.x}, 0.05, ${door.z}); return true; })()`);
  await t.frames(3);
  t.check("with a friend inside: ✋ 🔔 RING THE BELL at Ima's door", /RING THE BELL/.test(await g(`(ctx.foot.debug.interactables() || {}).label || ""`)));
  await g(`(() => { const pr = ctx.foot.debug.interactables(); return !!(pr && pr.kind === "spot" && (pr.ent.act(), true)); })()`);
  await t.frames(20);
  t.check("…Ima's refusal; she stays outside", (await g(`ctx.state`)) === "footRun" && (await g(`ctx.moveout.refusedAt`)) > 0);
  await g(`(ctx.moveout.friendHome = window.__fh, true)`);

  // ── strangers on the porch aren't drawn (one up the street is) ──
  await g(`(ctx.mp.setOnline ? ctx.mp.setOnline(true) : ctx.mp.connect("lobby"), true)`);
  if (await t.until(`__lulu3d.ctx.mp.connected`, "online in EVERYONE", 60000)) {
    const O = await g(`(() => { const O = ctx.town.plan.ORIGIN, h = ctx.home.lot; return { porch: [ctx.town.id, ${door.x} - O.x, ${door.z} - O.z, 0], street: [ctx.town.id, h.x + h.nx * 40 + h.ux * 6 - O.x, h.z + h.nz * 40 + h.uz * 6 - O.z, 0] }; })()`);
    const a = new Rider("Porch Pal", "blue"), b = new Rider("Street Pal", "green");
    await a.open(); await b.open(); riders.push(a, b);
    a.stand(O.porch); b.stand(O.street);
    await t.frames(60);
    // (the relay names strangers itself — "Blue 17" — so they're told apart by where they stand)
    const at = (w, on) => `Object.values(__lulu3d.ctx.mp._debug.peers).some(p => p.w && Math.hypot(p.w.a - ${w[1]}, p.w.b - ${w[2]}) < 3${on ? " && p.onScreen" : ""})`;
    t.check("two strangers in Midwood (one on the porch, one up the street)", await t.until(`${at(O.porch, false)} && ${at(O.street, false)}`, "both strangers heard", 30000));
    t.check("…the one up the street is drawn", await t.until(at(O.street, true), "the stranger up the street is drawn", 30000));
    await t.frames(30);
    t.check("…the one on Ima's porch is not", !(await t.L(at(O.porch, true))), await g(`JSON.stringify(Object.values(ctx.mp._debug.peers).map(p => [p.name, p.onScreen, p.w && [Math.round(p.w.a), Math.round(p.w.b)]]))`));
    a.close(); b.close();
    await g(`(ctx.mp.setOnline ? ctx.mp.setOnline(false) : ctx.mp.disconnect(), true)`);
  }

  // ── her first own home: her picks go up there, free ──
  if (!(await g(`ctx.realestate.listings().length`))) {
    // (no listing on her own street today: a house in Lakewood, like realestatehome.js)
    await g(`(ctx.foot.end("test"), L3.setState("playing"), ctx.town.load("lakewood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 120000);
    await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
    await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood" && __lulu3d.ctx.realestate.listings().length > 0`, "in Lakewood with listings", 30000);
    await g(`ctx.foot.start("parked")`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot in Lakewood", 60000);
  }
  const rec = await g(`(() => { for (const r of ctx.realestate.listings()) if (ctx.realestate.debug.buyNow(r.id)) return { id: r.id, ax: r.ap.x, az: r.ap.z, dx: r.door.x, dz: r.door.z, nx: r.nx, nz: r.nz, town: r.town, address: r.address }; return null; })()`);
  t.check("she buys a home of her own", !!rec, JSON.stringify(rec));
  if (!rec) return;
  await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${rec.ax} + ${rec.nx} * 0.4, 0.05, ${rec.az} + ${rec.nz} * 0.4); F.phase = "walk"; ctx.foot.obj.position.copy(F.pos); ctx.foot.obj.rotation.y = Math.atan2(${rec.dx} - F.pos.x, ${rec.dz} - F.pos.z); return true; })()`);
  await t.frames(6);
  const c0 = await g(`L3.wallet.coins`);
  await t.tap(0);
  if (await t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.def.id !== "luluHome"`, "inside her own home", 30000)) {
    const P = await g(`ctx.realestate.debug.S.decor[${JSON.stringify(rec.id)}] || null`);
    t.check("…the bed and rug she'd picked are up in it, without paying again", !!P && P.bed === "fluffy" && P.rug === "round" && (await g(`L3.wallet.coins`)) === c0, JSON.stringify(P));
    await t.shot("first-own-home");
    await g(`(window.__interiors.room.leave(), true)`);
    await t.until(`__lulu3d.state === "footRun"`, "out of her home", 30000);
  }

  // ── "Start my days here": the hints stop, and turn warm ──
  await g(`(ctx.home.setStartAt({ town: ${JSON.stringify(rec.town)}, key: ${JSON.stringify(rec.id)}, door: { x: ${rec.ax}, z: ${rec.az} }, face: 0, label: ${JSON.stringify(rec.address)} }), ctx.moveout.debug.setDays(40, true), true)`);
  // (dinner's at Ima's: ctx.onegame.home lands her on the family porch — her days start elsewhere now, so go via dinner)
  await g(`ctx.onegame.home({ via: "dinner" })`);
  await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === __lulu3d.ctx.town.home.town`, "back at Ima's for dinner", 60000);
  if (!await goIn("Ima's after she moved out")) return;
  const K = await g(`ctx.moveout.debug.room()`);
  t.check("after \"Start my days here\": no more hints — WE KEPT YOUR ROOM (it's a gym now)", K.stage === "kept" && /kept your room/i.test(K.line || ""), JSON.stringify(K));
  t.check("…no air mattress, no boarder: her bed's back", await g(`(() => { const V = ctx.decor.debug.room().data.V; return !!(V.objs.bed && V.objs.bed.visible); })()`));
  const badK = await open();
  t.check("…nothing in a wall (kept)", badK.length === 0, badK.join(" "));
  await t.shot("kept-your-room");
  await goOut();
  await g(`(ctx.home.setStartAt(null), true)`);
}
