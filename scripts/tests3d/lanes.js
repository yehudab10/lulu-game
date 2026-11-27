// 🎳 East Midwood Lanes (features/lanes): a bowling alley you walk into and really bowl in.
//   • the room: 4 lanes, every pin of every lane in one instanced mesh, Sheldon, Rivky, Shimmy, the trophy case
//   • a full 10-frame game from a scripted set of throws → the right frames + the right score (strike, spare, gutter,
//     an open frame, a three-ball 10th), checked against this file's OWN scorer
//   • the controls: a swipe → a throw (up = bowl, bent = curve, fast = power); hold-and-let-go on keys / a pad
//   • the counter: a lane costs a small fee (never below 0), a quick 3-frame game, Shimmy's solo game, the knish (once
//     a day); a first 200+ game → the LANES shirt in her closet + a badge; nothing pays coins
//   • the trophy: brought back → in the case, a badge
//   • the door on Kings Hwy (Midwood), the 📍 Map pin
//   • two pages in one group on one lane: the same balls, the same pins, the same score on both screens, frame by frame
const path = require("path");
const W = require("../lib/qawatch.js");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const MP = `&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

// the throws (pins.js decides what falls: found with a search over the same code — see the expected downs below)
const T = {
  strike: { x: 0, aim: 31, p: 34, s: 17 }, gutter: { x: 0, aim: 0, p: 14, s: 17 }, seven: { x: 0, aim: 27, p: 14, s: 17 },
  spare7: { x: 0, aim: 29, p: 14, s: 17 }, miss: { x: 0, aim: 0, p: 14, s: 17 }, eight: { x: 0, aim: 25, p: 14, s: 17 }, one8: { x: 0, aim: 35, p: 34, s: 26 },
};
// a 10-frame game: X · 7/ · -- · 81 · X · X · 7- · 81 · -7 · XXX
const GAME = ["strike", "seven", "spare7", "gutter", "gutter", "eight", "one8", "strike", "strike", "seven", "miss", "eight", "one8", "gutter", "seven", "strike", "strike", "strike"];
const PINS = [10, 7, 3, 0, 0, 8, 1, 10, 10, 7, 0, 8, 1, 0, 7, 10, 10, 10];
/** This test's own scorer (10-pin rules), independent of the game's. */
function score(rolls) {
  let total = 0, i = 0; const frames = [];
  for (let f = 0; f < 10; f++) {
    if (rolls[i] === 10) { total += 10 + rolls[i + 1] + rolls[i + 2]; i += 1; }
    else if (rolls[i] + rolls[i + 1] === 10) { total += 10 + rolls[i + 2]; i += 2; }
    else { total += rolls[i] + rolls[i + 1]; i += 2; }
    frames.push(total);
  }
  return frames;
}

module.exports = {
  name: "lanes",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,world,day,party,foot,homes,openworld" + MP,
  save2d: { totalCoins: 300, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    const guests = [];
    try { await this.body(t, guests); }
    catch (e) { t.check("lanes threw", false, String(e && e.stack || e).slice(0, 600)); }
    finally {
      for (const p of guests) { t.check(`${p.label}: no page errors`, p.errors.length === 0, p.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | ")); try { await p.page.close(); } catch (e) { } }
      if (relay) relay.kill();
      W.dropRelayErrors(t);
    }
  },
  async body(t, guests) {
    const g = t.game;
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const inLanes = `window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "lanes"`;
    const D = `ctx.lanes.debug`;
    const enter = async (P = null) => {
      const call = `ctx.lanes.enter({ exit: () => L3.setState("footRun", { resume: "interior" }) })`;
      if (P) { await P.game(call); return P.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.def.id === "lanes"`, `${P.label}: into the lanes`, 60000); }
      await g(call);
      const ok = await t.until(`__lulu3d.state === "interior" && ${inLanes}`, "inside East Midwood Lanes", 60000);
      await t.frames(10);
      return ok;
    };
    const idle = k => `(() => { const D = __lulu3d.ctx.lanes.debug, L = D.V.lanes[${k}]; return !L.anim && L.rack <= 0 && (!L.game || L.shown >= D.order(L.game).seq.length); })()`;

    t.check("ctx.lanes is there", await g(`!!ctx.lanes && typeof ctx.lanes.enter === "function"`));
    // ── the pure parts: the roll is the same every time, the score is right ──
    t.check("the same throw → the same pins (the roll is a pure function)", await t.L(`import("./js/features/lanes/pins.js").then(P => { const a = P.roll(1023, { x: 9, aim: 20, p: 25, s: 23 }), b = P.roll(1023, { x: 9, aim: 20, p: 25, s: 23 }); return a.down === b.down && a.hits.length === b.hits.length; })`));
    t.check("a perfect game is 300, a gutter game 0, all 5-spares 150", await t.L(`import("./js/features/lanes/pins.js").then(P => P.framesOf(Array(12).fill(1023)).total === 300 && P.framesOf(Array(20).fill(0)).total === 0 && P.framesOf(Array(21).fill(0).map((_, i) => i % 2 ? 0b1111100000 : 0b0000011111)).total === 150)`));
    t.check("a throw packs into 6 characters and back", await t.L(`import("./js/features/lanes/game.js").then(G => { const s = G.packThrow({ x: 3, aim: 35, p: 0, s: 17 }, 777); const b = G.unpackBalls(s)[0]; return s.length === 6 && b.x === 3 && b.aim === 35 && b.p === 0 && b.s === 17 && b.down === 777; })`));

    // ── the room ──
    if (!await enter()) return;
    await t.shot("room");
    t.check("4 lanes, all 40 pins in ONE instanced mesh, the balls in another", await g(`${D}.V.lanes.length === 5 && ${D}.V.pins.isInstancedMesh && ${D}.V.pins.count === 40 && ${D}.V.balls.isInstancedMesh`));
    t.check("Sheldon at the counter, Rivky at the snack bar, Shimmy by lane 1", await g(`["sheldon", "rivky", "shimmy"].every(id => !!__interiors.room.byId[id])`));
    const calls = await g(`(() => { const rt = __interiors.room, skip = new Set([rt.lulu.obj, ...rt.people.map(q => q.p.obj)]); let n = 0; const walk = o => { if (skip.has(o) || !o.visible) return; if (o.isMesh || o.isSprite) n++; for (const c of o.children) walk(c); }; walk(rt.set.scene); return n; })()`);
    t.check(`the room itself is cheap: ≤ 45 draws without the people (${calls})`, calls <= 45, String(calls));
    t.check("every lane open at the start (no game)", await g(`[1, 2, 3, 4].every(k => !${D}.V.lanes[k].game || ${D}.V.lanes[k].src === "house")`));

    // ── a full game from a scripted set of throws ──
    const c0 = await coins();
    await g(`(${D}.V.speed = 4, ${D}.play.startGame(1, { frames: 10 }), true)`);
    const downs = [];
    for (let i = 0; i < GAME.length; i++) {
      await t.until(`__lulu3d.ctx.lanes.debug.play.myTurn()`, `my ball ${i + 1}`, 20000);
      const b = await g(`(() => { const b = ${D}.play.bowl(${JSON.stringify(T[GAME[i]])}); return b ? b.down : -1; })()`);
      const n = await t.L(`import("./js/features/lanes/pins.js").then(P => P.countOf(${b} & 1023))`);
      downs.push(n);
      await t.until(`__lulu3d.ctx.lanes.debug.V.lanes[1].shown >= ${i + 1}`, `ball ${i + 1} played out`, 20000);
    }
    t.check("every scripted ball knocked the pins it should", JSON.stringify(downs) === JSON.stringify(PINS), JSON.stringify(downs));
    await t.until(idle(1), "the last ball settles", 20000);
    const sheet = await g(`(() => { const G = ${D}.G.game, s = ${D}.order(G).sheets[${D}.G.me]; return { total: s.total, frames: s.frames.map(f => f.score), marks: s.frames.map(f => f.marks.join("")), done: s.done }; })()`);
    const want = score(PINS);
    t.check(`the game's frames match this test's own scorer (${want.join(" ")})`, JSON.stringify(sheet.frames) === JSON.stringify(want), JSON.stringify(sheet.frames));
    t.check(`the total: ${want[9]}`, sheet.total === want[9] && sheet.done, JSON.stringify(sheet));
    t.check("the marks: X · 7/ · -- · 81 · X · X · 7- · 81 · -7 · XXX", sheet.marks.join(" ") === "X 7/ -- 81 X X 7- 81 -7 XXX", sheet.marks.join(" "));
    await t.until(`__lulu3d.ctx.lanes.debug.G.done`, "game over", 10000);
    t.check("game over: her best is saved", await g(`${D}.S.best === ${want[9]} && ${D}.S.games === 1`));
    t.check("a game started from the debug hook cost nothing + paid nothing", await coins() === c0, `${c0} → ${await coins()}`);
    await t.shot("game-over");

    // ── the counter: a quick 3-frame game for the fee, then against Shimmy ──
    await g(`(${D}.play.endGame("test"), ${D}.G.done = false, true)`);
    const c1 = await coins();
    const USE = id => g(`(() => { const rt = __interiors.room; const h = rt.hots.find(x => x.id === ${JSON.stringify(id)}); rt.use(h); return true; })()`);
    await USE("counter");
    await t.until(`!!document.querySelector("#dialog .choice, .dlg-choice, [data-choice]") || __lulu3d.ctx.dialogOpen`, "Sheldon asks", 8000);
    await t.frames(30);
    // the second choice: a quick game
    await t.click(/quick game/i); await t.frames(3); if (await g(`ctx.dialogOpen`)) await t.click(/quick game/i);      // (the first tap finishes the typing)
    const quick = await t.until(`!!__lulu3d.ctx.lanes.game() && __lulu3d.ctx.lanes.game().frames === 3`, "a quick game started", 10000);
    t.check("the counter: a quick 3-frame game", quick);
    t.check(`…for the lane fee (${c1} → ${await coins()})`, await coins() === c1 - 12);
    await t.until(`__interiors.room.mode && __lulu3d.ctx.lanes.debug.G.cam`, "at the lane (the bowling camera)", 20000);
    await t.frames(20);
    await t.shot("at-lane");
    // a swipe: up = a throw; a sideways drag first = a step
    const sw = await g(`(() => { const f = ${D}.play.fromSwipe; const H = 720, Wd = 1280; const up = [{ x: 640, y: 650, t: 0 }, { x: 640, y: 560, t: 60 }, { x: 640, y: 420, t: 120 }, { x: 640, y: 300, t: 170 }]; const bent = [{ x: 640, y: 650, t: 0 }, { x: 640, y: 560, t: 60 }, { x: 650, y: 440, t: 120 }, { x: 700, y: 330, t: 170 }]; const slow = up.map(p => ({ x: p.x, y: p.y, t: p.t * 5 })); const side = [{ x: 600, y: 600, t: 0 }, { x: 700, y: 605, t: 100 }]; const a = f(up, Wd, H), b = f(bent, Wd, H), c = f(slow, Wd, H), d = f(side, Wd, H); return { a, b, c, d }; })()`);
    t.check("a swipe up = a throw; a bent swipe = curve; a slow one = less power; sideways = no throw", !!sw.a && !!sw.b && sw.b.s !== sw.a.s && sw.c.p < sw.a.p && sw.d === null, JSON.stringify(sw));
    // hold-and-let-go (keys): hold Space, let go → a ball
    await t.until(`__lulu3d.ctx.lanes.debug.play.myTurn()`, "my turn", 10000);
    await t.frames(10);
    const before = await g(`${D}.G.game.balls[${D}.G.me].length`);
    await t.page.keyboard.down("Space"); await t.frames(20); await t.page.keyboard.up("Space"); await t.frames(10);
    t.check("hold Space, let go → she bowls", await g(`${D}.G.game.balls[${D}.G.me].length`) === before + 1);
    for (let i = 0; i < 8; i++) {
      if (await g(`!${D}.order(${D}.G.game).next`)) break;
      await t.until(`__lulu3d.ctx.lanes.debug.play.myTurn() || !__lulu3d.ctx.lanes.debug.order(__lulu3d.ctx.lanes.debug.G.game).next`, "my turn", 20000);
      await g(`(${D}.play.bowl(${JSON.stringify(T.strike)}), true)`);
      await t.frames(5);
    }
    await t.until(`__lulu3d.ctx.lanes.debug.G.done`, "the quick game ends", 30000);
    t.check("the quick game ends after 3 frames", await g(`${D}.order(${D}.G.game).sheets[${D}.G.me].frames.length === 3`));
    await t.until(`!__interiors.room.mode`, "back to walking", 10000);

    // ── against Shimmy: he takes his balls ──
    await g(`(${D}.play.endGame("test"), ${D}.G.done = false, ${D}.play.startGame(2, { frames: 3, vsShimmy: true }), true)`);
    for (let i = 0; i < 12; i++) {
      await t.until(`__lulu3d.ctx.lanes.debug.play.myTurn() || !__lulu3d.ctx.lanes.debug.order(__lulu3d.ctx.lanes.debug.G.game).next`, "my turn (vs Shimmy)", 30000);
      if (await g(`!${D}.order(${D}.G.game).next`)) break;
      await g(`(${D}.play.bowl(${JSON.stringify(T.eight)}), true)`);
      await t.frames(5);
    }
    t.check("Shimmy bowled his frames too", await g(`${D}.order(${D}.G.game).sheets["~shimmy"].frames.length === 3`));
    await t.until(`__lulu3d.ctx.lanes.debug.G.done`, "vs Shimmy: over", 30000);

    // ── a first 200+ game → the LANES shirt + a badge (no coins) ──
    const c2 = await coins();
    await g(`(${D}.play.endGame("test"), ${D}.G.done = false, ${D}.play.startGame(1, { frames: 10 }), true)`);
    for (let i = 0; i < 12; i++) {
      await t.until(`__lulu3d.ctx.lanes.debug.play.myTurn() || !__lulu3d.ctx.lanes.debug.order(__lulu3d.ctx.lanes.debug.G.game).next`, "my turn", 20000);
      if (await g(`!${D}.order(${D}.G.game).next`)) break;
      await g(`(${D}.play.bowl(${JSON.stringify(T.strike)}), true)`);
      await t.frames(3);
    }
    await t.until(`__lulu3d.ctx.lanes.debug.G.done`, "a 300 game ends", 40000);
    t.check("a perfect game: 300 on the board + her best", await g(`${D}.S.best === 300`));
    t.check("…the LANES bowling shirt is in her closet", await g(`ctx.clothes.owns("lanes_shirt") && ${D}.S.shirt === true`));
    t.check("…and nothing paid coins", await coins() === c2, `${c2} → ${await coins()}`);
    t.check("the shirt is a prize: on no shop's rack", await g(`ctx.clothes.pieces.find(p => p.id === "lanes_shirt").shop === "prize"`));

    // ── the knish: once a day, a coin sink, a steadier hand ──
    const c3 = await coins();
    await USE("snack");
    await t.until(`__lulu3d.ctx.dialogOpen`, "Rivky asks", 8000); await t.frames(30);
    await t.click(/A knish/); await t.frames(3); if (await g(`ctx.dialogOpen`)) await t.click(/A knish/);
    await t.until(`__lulu3d.ctx.lanes.debug.G.knish === 3`, "a knish", 8000);
    t.check(`a knish: ${c3} → ${await coins()} (−4), the next 3 balls steadier`, await coins() === c3 - 4 && await g(`${D}.G.knish === 3`));

    // ── the trophy comes home ──
    await t.until(`!__lulu3d.ctx.dialogOpen && !__interiors.room.busy`, "free", 8000);
    await g(`(${D}.LG.force.trophy = true, true)`);
    t.check("✋ at the case: put the 1994 trophy back", await g(`(() => { const h = __interiors.room.hots.find(x => x.id === "trophy"); return /1994 trophy back/.test(h.label()); })()`));
    await USE("trophy");
    await t.until(`__lulu3d.ctx.lanes.debug.S.trophy`, "the trophy is back", 8000);
    t.check("the trophy is in the case (and stays there)", await g(`${D}.S.trophy && __interiors.room.data.trophy.visible`));
    await t.shot("trophy");

    // ── nothing in the room ever paid ──
    t.check("the wallet never went up in the alley", await coins() <= c0);

    // ── out, then the door on Kings Hwy + the map pin ──
    await g(`(__interiors.room.leave(), true)`);
    await t.until(`__lulu3d.state === "footRun"`, "out of the lanes", 30000);
    t.check("📍 the Map knows the lanes", await g(`!!(ctx.pins && ctx.pins.get && ctx.pins.get("midwood:lanes"))`));

    // ── league night (Tue / Thu evening) + the Sunday birthday party (bumpers on lane 4) ──
    await g(`(${D}.LG.force.when = { wd: 2, hour: 20, key: "2026-12-1", ids: [] }, true)`);
    if (await enter()) {
      t.check("league night: two teams bowling on lanes 3 + 4", await g(`${D}.V.house.length === 2 && ${D}.V.house.every(H => H.k >= 3 && H.people.length === 2) && ${D}.V.lanes[3].src === "house"`));
      await t.until(`__lulu3d.ctx.lanes.debug.V.lanes[3].shown + __lulu3d.ctx.lanes.debug.V.lanes[4].shown >= 1`, "a league ball", 60000);
      t.check("…they really bowl (their balls play out on the lanes)", await g(`${D}.V.lanes[3].shown + ${D}.V.lanes[4].shown >= 1`));
      t.check("…and a player still gets a lane (1 or 2)", await g(`[1, 2].includes(${D}.freeLane())`));
      await t.shot("league");
      await g(`(__interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out", 30000);
    }
    await g(`(${D}.LG.force.when = { wd: 0, hour: 12, key: "2026-12-6", ids: [] }, true)`);
    if (await enter()) {
      t.check("Sunday: Yossi's birthday party on lane 4, bumpers up", await g(`${D}.V.house.length === 1 && ${D}.V.house[0].k === 4 && ${D}.V.lanes[4].bumpers && /YOSSI/.test(${D}.V.lanes[4].names)`));
      await g(`(__interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out", 30000);
    }
    await g(`(${D}.LG.force.when = null, true)`);

    // ── the door on Kings Hwy (Midwood) ──
    await g(`(ctx.foot.active && ctx.foot.end("test"), L3.setState("playing"), true)`); await t.frames(5);
    await g(`(ctx.town.load("midwood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 90000);
    await g(`ctx.town.enter({ town: "midwood", speed: 0 })`);
    if (await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "into Midwood", 8000)) {
      await t.frames(30);
      t.check("Midwood has the lanes' storefront on Kings Hwy", await g(`!!ctx.town.spot("lanes")`));
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      await g(`(() => { const sp = ctx.town.spot("lanes"); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 0.3, 0.05, sp.z + sp.nz * 0.3); F.phase = "walk"; return true; })()`);
      await t.frames(10);
      const l = await g(`(ctx.foot.debug.interactables() || {}).label || ""`);
      t.check(`✋ at the door: GO INTO EAST MIDWOOD LANES (${l})`, /EAST MIDWOOD LANES/.test(l));
      await t.shot("door");
      await t.tap(0);
      t.check("…and in she goes", await t.until(`__lulu3d.state === "interior" && ${inLanes}`, "in through the door", 60000));
      await t.frames(10);
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back out on Kings Hwy", 30000);
    }

    // ── two pages, one lane ──
    await twoPages(t, guests);
  },
};

async function twoPages(t, guests) {
  relay = await startRelay(PORT);
  setWallCap(8 * 60000);
  const g = t.game, Hp = hostPage(t);
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return t.check("host: a group", false);
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
  const A = await guestPage(t, "guest", { totalCoins: 100, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${module.exports.query}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins", 240000)) return t.check("guest: joined", false);
  const guestUid = await A.game(`ctx.party.uid`);
  for (const P of [Hp, A]) {
    await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
    await P.game(`ctx.lanes.enter({ exit: () => L3.setState("footRun", { resume: "interior" }) })`);
    if (!await P.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.def.id === "lanes"`, `${P.label}: into the lanes`, 60000)) return t.check(`${P.label}: in the lanes`, false);
  }
  const D = `ctx.lanes.debug`;
  t.check("both in the alley: each sees the other (features/together)", await Hp.until(`ctx.lanes.debug.peersHere().some(q => q.uid === ${JSON.stringify(guestUid)})`, "host sees the guest", 30000)
    && await A.until(`ctx.lanes.debug.peersHere().some(q => q.uid === ${JSON.stringify(hostUid)})`, "guest sees the host", 30000));
  // the host starts a game on lane 3; the guest sees it on lane 3 and its ✋ JOIN
  await Hp.game(`(${D}.V.speed = 4, ${D}.play.startGame(3, { frames: 3 }), true)`);
  await A.game(`(${D}.V.speed = 4, true)`);
  t.check("the guest sees the host's game on lane 3 (to watch)", await A.until(`ctx.lanes.debug.V.lanes[3].src === "peer" && !!ctx.lanes.debug.joinable(3)`, "guest: the host's game", 30000));
  t.check("…and its ✋ says JOIN", await A.game(`(() => { const h = window.__interiors.room.hots.find(x => x.id === "lane3"); return h.enabled() && /Join/.test(h.label()); })()`));
  const gc0 = await A.game(`window.__lulu3d.ctx && 0`) || 0;
  await A.game(`(() => { const j = ${D}.joinable(3); ${D}.play.joinGame(j.w, j.uid); return true; })()`);
  t.check("the host adds her to the roster (2 bowlers, the host first)", await Hp.until(`ctx.lanes.game().roster.length === 2 && ctx.lanes.game().roster[1] === ${JSON.stringify(guestUid)}`, "host: roster", 30000)
    && await A.until(`ctx.lanes.game().roster.length === 2 && !ctx.lanes.debug.G.joining`, "guest: joined", 30000));
  // they take turns: host ball(s), guest ball(s) … same throws, checked frame by frame on both screens
  const seqH = [T.strike, T.seven, T.spare7, T.eight, T.one8], seqA = [T.eight, T.one8, T.gutter, T.gutter, T.strike];
  let ih = 0, ia = 0, agree = true, steps = 0;
  const key = P => P.game(`(() => { const G = ${D}.G.game, o = ${D}.order(G); return JSON.stringify(G.roster.map(u => [u, o.sheets[u].frames.map(f => f.marks.join("") + ":" + f.score)])); })()`);
  for (; steps < 20; steps++) {
    const nextH = await Hp.game(`${D}.order(${D}.G.game).next`);
    if (!nextH) break;
    const P = nextH === hostUid ? Hp : A, seq = nextH === hostUid ? seqH : seqA, i = nextH === hostUid ? ih++ : ia++;
    if (!await P.until(`ctx.lanes.debug.play.myTurn()`, `${P.label}: my turn`, 30000)) { agree = false; break; }
    await P.game(`(${D}.play.bowl(${JSON.stringify(seq[i % seq.length])}), true)`);
    const n = await P.game(`${D}.G.game.balls[${D}.G.me].length`);
    const total = ih + ia;
    // both screens play it out, then compare every frame
    for (const Q of [Hp, A]) await Q.until(`ctx.lanes.debug.V.lanes[3].shown >= ${total} && !ctx.lanes.debug.V.lanes[3].anim`, `${Q.label}: ball ${total} played`, 30000);
    const a = await key(Hp), b = await key(A);
    if (a !== b) { agree = false; t.check(`after ball ${total}: both screens agree`, false, `${a} ≠ ${b}`); break; }
  }
  t.check(`two pages, one lane: every frame the same on both screens (${ih + ia} balls)`, agree && ih + ia >= 8, `${ih}+${ia}`);
  const fin = await key(Hp);
  t.check("the game ran to the end on both (3 frames each)", await Hp.game(`!${D}.order(${D}.G.game).next`) && await A.game(`!${D}.order(${D}.G.game).next`), fin);
  await t.shot("two-pages");
}
