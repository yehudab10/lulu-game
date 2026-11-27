// features/lanes — 🎳 EAST MIDWOOD LANES (the owner, 2026-11-27: "fill every building with something… I'm open to new
// immersive game mechanics"; the game is "mainly multiplayer" now). A retro bowling alley on Kings Hwy, Midwood — walk in
// (ci/doors: no button) and really bowl, alone, against the house bowler, or with whoever's in the alley.
//
//   pins.js   the roll (the ball's line, speed + spin → the pins that fall) + 10-pin scoring — pure code
//   game.js   one lane's game: the turn order, the compact form on the wire (d.x.bw)
//   room.js   the alley (interiors engine): 4 lanes, Sheldon's counter, Rivky's snack bar, the trophy case, the
//             scoreboards, league night (Tue + Thu evenings) + the kids' birthday party (Sundays)
//   play.js   her game: start / join, the controls (swipe · hold-and-let-go · keys), the camera down the lane
//   net.js    the others in the alley: their games to watch / join, their balls in hers — no relay change
//   data.js   every name, line + number (TUNE)
//
// Service: ctx.lanes { enter(), game(), best, debug }
// Events: lanes:start {lane, frames, vs} · lanes:join {lane, owner} · lanes:ball {lane, down, gutter, frame} ·
//         lanes:over {total, best, first200} · lanes:trophy · lanes:end · shops:open {place: "lanes"}
// Save: store("lanes") { best, games, strikes, shirt, trophy, knishDay } (in the 💾 save code with the rest of the 3D save).
// Pays: NOTHING. The lane (and the shoes) is a small sink; a first 200+ game → the LANES bowling shirt (features/clothes)
// + a badge; her best on the board with her username. Dina's mode: never here (no Lulu).
import { ctx, on, emit, setState } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { pick } from "../interiors/engine.js";
import { tone } from "../interiors/fx.js";
import { walkPath } from "../clothes/stage.js";
import { when } from "../homes/life.js";
import { ALL, countOf } from "./pins.js";
import { order, BOT } from "./game.js";
import { V, LANES_DEF, laneX, APPROACH_Z, COUNTER, SNACK, CASE, drawBoard, addHouse, showGame } from "./room.js";
import { G, startGame, joinGame, endGame, atLane, tickBot, laneCamera, myId, playDebug } from "./play.js";
import { sync, publish, freeLane, joinable, peersHere, netDebug } from "./net.js";
import { ID, NAME, TUNE, LINES, SHIMMY } from "./data.js";

const S = store("lanes", { best: 0, games: 0, strikes: 0, shirt: false, trophy: false, knishDay: "" });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const LG = { done: "", force: { trophy: false, when: null }, said: 0, streak: 0 };

// ── names on the boards ──
function nameOf(u) {
    if (u === G.me || u === "me") return (ctx.accounts && ctx.accounts.name) || "Lulu";
    if (u === BOT) return SHIMMY.short;
    for (const H of V.house) { const i = H.game.roster.indexOf(u); if (i >= 0 && H.people[i]) return H.people[i].name || "League"; }
    try { return (ctx.party && ctx.party.displayName && ctx.party.displayName(u)) || "Friend"; } catch (e) { return "Friend"; }
}

// ── the trophy (features/houseitems: the stolen "EAST MIDWOOD LANES 1994" bowling trophy) ──
function hasTrophy() {
    if (LG.force.trophy) return true;
    try { return !!(ctx.houseitems && ctx.houseitems.bag.some(x => x.id === "trophy")); } catch (e) { return false; }
}
function takeTrophy() {
    if (LG.force.trophy) { LG.force.trophy = false; return true; }
    const hi = ctx.houseitems;
    if (!hi) return false;
    if (typeof hi.take === "function") return !!hi.take("trophy");
    const B = hi.debug && hi.debug.S;             // (until houseitems has a take(): its own bag, the same way it uses one up)
    const i = B ? B.bag.findIndex(x => x.id === "trophy") : -1;
    if (i < 0) return false;
    B.bag.splice(i, 1); B.hand = Math.max(0, Math.min(B.hand, B.bag.length - 1)); saveSoon();
    emit("houseitems:gone", { id: "trophy" });
    return true;
}

// ── her bowling shoes (the rental pair, while she's in the alley) ──
function rentalShoes(rt) {
    rt.lulu.obj.traverse(o => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m, i) => { if (m && /shoe/i.test(m.name || "")) { const c = m.clone(); c.color.set(i % 2 ? "#1565C0" : "#C62828"); if (Array.isArray(o.material)) o.material[i] = c; else o.material = c; rt.own(c); } });
    });
    rt.data.shoes = true;
}

// ── the high-scores board ──
function drawHi(rt) {
    const hs = rt.data.hiscore;
    if (!hs) return;
    const { g, canvas } = hs, w = canvas.width, h = canvas.height;
    g.fillStyle = "#0B0820"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FF4F9A"; g.font = "700 30px Fredoka, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("HIGH GAMES", w / 2, 30);
    const rows = [["House record — Shimmy", 279], ["1994 — the trophy game", 212], ["League — Big Chaim", 247]];
    if (S.best > 0) rows.push([`★ ${(ctx.accounts && ctx.accounts.name) || "Lulu"}`, S.best]);
    rows.sort((a, b) => b[1] - a[1]);
    rows.forEach(([n, v], i) => {
        const y = 78 + i * 46, mine = n.startsWith("★");
        g.fillStyle = mine ? "#FFD54F" : "#FFFFFF"; g.textAlign = "left"; g.font = "700 24px Fredoka, Arial, sans-serif"; g.fillText(n.slice(0, 24), 22, y);
        g.textAlign = "right"; g.fillStyle = mine ? "#FFD54F" : "#7CFF6B"; g.fillText(String(v), w - 22, y);
    });
    hs.mesh.material.map.needsUpdate = true;
}

// ── the alley's spots (✋) ──
async function counter(rt) {
    const sh = rt.byId.sheldon;
    if (G.game && order(G.game).next) { await rt.say(`🎳 ${NAME}`, `You're on lane ${G.game.lane}. It's waiting for you. Lanes don't wait forever. They do, actually. But I don't.`, { person: sh }); return; }
    const free = freeLane();
    if (!free) { await rt.say(`🎳 ${NAME}`, "Every lane's taken. Watch a game, have a knish. Or join somebody — they don't bite. Mostly.", { person: sh }); return; }
    const i = await rt.choose(`🎳 ${SHEL()}`, pick(LINES.hello), [`🎳 A game — 10 frames · ${TUNE.fee}`, `⚡ A quick game — 3 frames · ${TUNE.fee}`, `🥇 Me vs. Shimmy · ${TUNE.fee}`, "👀 Just looking"], { person: sh });
    if (i < 0 || i > 2) return;
    if (!rt.pay(TUNE.fee)) { await rt.say(`🎳 ${SHEL()}`, LINES.broke, { person: sh }); return; }
    if (!rt.data.shoes) { rentalShoes(rt); rt.bubble(pick(LINES.shoes), sh.p.obj, 3); }
    startGame(free, { frames: i === 1 ? 3 : 10, vsShimmy: i === 2 });
    if (i === 2) rt.bubble(pick(LINES.shimmy), (rt.byId.shimmy || sh).p.obj, 3);
    await goBowl(rt);
}
const SHEL = () => "Sheldon";
async function goBowl(rt) {
    if (!G.game || rt.disposed) return;
    const x = laneX(G.game.lane);
    await walkPath(rt, x, APPROACH_Z + 0.9, 8);
    if (rt.disposed || !G.game) return;
    await atLane(rt);
}
async function laneSpot(rt, k) {
    if (G.game && G.game.lane === k) return goBowl(rt);
    const j = joinable(k);
    if (j) {
        if (!rt.pay(TUNE.fee)) { await rt.say(`🎳 ${SHEL()}`, LINES.broke, { person: rt.byId.sheldon }); return; }
        if (!rt.data.shoes) rentalShoes(rt);
        joinGame(j.w, j.uid);
        return goBowl(rt);
    }
    rt.bubble("*Sheldon, from the counter* Lanes are at the COUNTER, sweetheart. I'm the counter.", rt.byId.sheldon.p.obj, 3);
}
function laneLabel(k) {
    if (G.game && G.game.lane === k) return order(G.game).next ? "🎳 Bowl" : "🎳 Your lane (game over)";
    const j = joinable(k);
    if (j) return LINES.joinAsk(nameOf(j.uid));
    return "🎳 Lane " + k;
}
async function snack(rt) {
    const rv = rt.byId.rivky;
    if (S.knishDay === today()) { await rt.say("🥔 Rivky", LINES.knishDone, { person: rv }); return; }
    const i = await rt.choose("🥔 Rivky", `A knish? ${TUNE.knishPrice}. One a day.`, [`🥔 A knish · ${TUNE.knishPrice}`, "Not now"], { person: rv });
    if (i !== 0) return;
    if (!rt.pay(TUNE.knishPrice)) { await rt.say("🥔 Rivky", "No coins, no knish. Them's the rules.", { person: rv }); return; }
    S.knishDay = today(); saveSoon();
    G.knish = TUNE.knishBalls;
    emit("lanes:knish", {});
    rt.bubble(pick(LINES.knish), rv.p.obj, 3);
}
async function trophyCase(rt) {
    const sh = rt.byId.sheldon;
    if (hasTrophy() && !S.trophy) {
        if (!takeTrophy()) return;
        S.trophy = true; saveSoon();
        rt.data.trophy.visible = true;
        rt.burst({ x: CASE.x + 0.4, y: 1.6, z: CASE.z }, ["#FFD54F", "#FFFFFF", "#FF4F9A"], 18, 2.2, 0.06);
        tone(523, 0.12, "triangle", 0.1); tone(659, 0.12, "triangle", 0.1, 0, 0.13); tone(784, 0.3, "triangle", 0.1, 0, 0.26);
        emit("stat", { id: "lanesTrophy", n: 1 });
        emit("lanes:trophy", {});
        await rt.say(`🏆 ${SHEL()}`, LINES.trophyBack, { person: sh });
        return;
    }
    rt.bubble(S.trophy ? "*the 1994 trophy, back where it belongs. Someone has polished it. (Sheldon. Twice a day.)*" : pick(LINES.trophyCase), sh.p.obj, 3.2);
}
async function shimmyTalk(rt) {
    const sm = rt.byId.shimmy;
    if (G.game) { rt.bubble(pick(LINES.shimmy), sm.p.obj, 3); return; }
    const free = freeLane();
    const i = await rt.choose(`🥇 ${SHIMMY.name}`, pick(LINES.shimmy), free ? [`🎳 Bowl against me · ${TUNE.fee}`, "Maybe later"] : ["Maybe later"], { person: sm });
    if (i !== 0 || !free) return;
    if (!rt.pay(TUNE.fee)) { await rt.say(`🎳 ${SHEL()}`, LINES.broke, { person: rt.byId.sheldon }); return; }
    if (!rt.data.shoes) rentalShoes(rt);
    startGame(free, { vsShimmy: true });
    await goBowl(rt);
}

// ── the room's own setup (room.js builds the place; this adds the people + the spots) ──
V.build = rt => {
    G.game = null; G.joining = false; G.done = false; LG.streak = 0;
    rt.data.trophy.visible = !!S.trophy;
    const now = LG.force.when || when();
    const house = addHouse(rt, now);
    // Shimmy hangs around by lane 1 (league night: he's watching from the bench)
    rt.person("shimmy", SHIMMY.key, { x: laneX(1) - 0.9, z: 5.4, ry: Math.PI * 0.9 }, { name: SHIMMY.name, colors: SHIMMY.colors });
    rt.hot({ id: "counter", x: COUNTER.x + 0.2, z: COUNTER.z - 0.85, r: 1.4, who: "sheldon", label: () => (G.game && order(G.game).next ? "🎳 Sheldon" : `🎳 A lane + shoes · ${TUNE.fee}`), action: r => counter(r) });
    rt.hot({ id: "snack", x: SNACK.x - 0.85, z: SNACK.z, r: 1.4, who: "rivky", label: () => (S.knishDay === today() ? "🥔 Rivky's snack bar" : `🥔 A knish · ${TUNE.knishPrice}`), action: r => snack(r) });
    rt.hot({ id: "trophy", x: CASE.x + 0.85, z: CASE.z, r: 1.3, label: () => (hasTrophy() && !S.trophy ? "🏆 Put the 1994 trophy back" : "🏆 The trophy case"), action: r => trophyCase(r) });
    rt.hot({ id: "shimmy", x: laneX(1) - 0.9, z: 5.0, r: 1.1, who: "shimmy", track: true, label: () => `🥇 ${SHIMMY.short}`, action: r => shimmyTalk(r) });
    for (let k = 1; k <= TUNE.lanes; k++) {
        rt.hot({ id: "lane" + k, x: laneX(k), z: APPROACH_Z + 1.0, r: 1.0, label: () => laneLabel(k), action: r => laneSpot(r, k),
            enabled: () => (G.game && G.game.lane === k) || !!joinable(k) });
    }
    // the camera at her lane (the room's own camera otherwise)
    const base = rt.updateCamera.bind(rt);
    rt.updateCamera = (dt, snap) => (G.cam && G.game ? laneCamera(rt, dt, snap) : base(dt, snap));
    drawHi(rt);
    if (!house.league && !house.party && !S.games) rt.bubble(pick(LINES.hello), rt.byId.sheldon.p.obj, 3.5);
    emit("shops:open", { place: "lanes", town: "midwood" });
};
V.tick = (rt, dt) => {
    sync();
    publish();
    tickBot(rt, dt);
    for (let k = 1; k < V.lanes.length; k++) drawBoard(V.lanes[k], nameOf);
    // her game over (every ball played out on her screen)
    const g = G.game;
    if (g && !G.done && !order(g).next && V.lanes[g.lane] && !V.lanes[g.lane].anim && V.lanes[g.lane].rack <= 0) gameOver(rt, g);
};
V.dispose = () => {
    if (G.game) endGame("left");
    G.cam = null;
    publish();
};
V.onBall = (L, A, kind, sheet) => {
    const rt = V.rt;
    if (!rt || rt.disposed) return;
    const mine = L.src === "mine" && A.e.uid === G.me;
    const who = mine ? rt.lulu.obj : rt.byId.sheldon.p.obj;
    if (kind === "gutter") { if (mine || L.src === "peer") rt.bubble(pick(LINES.gutter), rt.byId.sheldon.p.obj, 2.8); return; }
    if (L.src === "house") return;
    const n = countOf(A.down), strike = A.e.standing === ALL && A.down === ALL, spare = !strike && (A.e.standing & ~A.down) === 0;
    if (mine) {
        if (strike) { S.strikes++; saveSoon(); emit("stat", { id: "lanesStrikes", n: 1 }); LG.streak++; } else LG.streak = 0;
    }
    if (strike) { rt.bubble(LG.streak === 3 && mine ? LINES.turkey[0] : pick(LINES.strike), who, 2.4); tone(784, 0.1, "square", 0.06); tone(1046, 0.18, "square", 0.06, 0, 0.1); }
    else if (spare) rt.bubble(pick(LINES.spare), who, 2.2);
    else if (A.e.standing === ALL && ((A.e.standing & ~A.down) === ((1 << 6) | (1 << 9)))) rt.bubble(LINES.split[1], rt.byId.sheldon.p.obj, 2.6);
    else if (A.e.standing === ALL && n > 0 && n < 10 && countOf(A.e.standing & ~A.down) >= 2 && !((A.e.standing & ~A.down) & 1) && Math.random() < 0.4) rt.bubble(LINES.split[0], who, 2);
};

function gameOver(rt, g) {
    G.done = true;
    const o = order(g), mine = o.sheets[G.me], total = mine ? mine.total : 0;
    const first200 = total >= TUNE.shirtAt && !S.shirt;
    S.games++;
    if (total > S.best) S.best = total;
    if (first200) {
        S.shirt = true;
        if (ctx.clothes && ctx.clothes.give) ctx.clothes.give("lanes_shirt");
        emit("stat", { id: "lanes200", n: 1 });
    }
    saveSoon();
    emit("stat", { id: "lanesGames", n: 1 });
    emit("lanes:over", { total, best: S.best, first200, frames: g.frames });
    drawHi(rt);
    const sh = rt.byId.sheldon;
    if (first200) rt.bubble(LINES.shirt, sh.p.obj, 4);
    else if (g.roster.includes(BOT)) {
        const b = o.sheets[BOT] ? o.sheets[BOT].total : 0;
        rt.bubble(total > b ? LINES.shimmyLoses : LINES.shimmyWins, (rt.byId.shimmy || sh).p.obj, 3.2);
    } else rt.bubble(total > 0 && total === S.best && S.games > 1 ? LINES.best(total) : pick(LINES.over), sh.p.obj, 3);
}

// ── the door on Kings Hwy (✋ — and ci/doors: just walk in) ──
const inTown = () => !!(ctx.town && ctx.town.active && ctx.town.id === "midwood");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
function canWalkIn() {
    if (!inTown() || ctx.state !== "footRun" || !ctx.interiors) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
const OUT = { at: null, t: 0 };
function doorPos() {
    if (!canWalkIn()) return null;
    const sp = ctx.town.spot("lanes"), p = herPos();
    if (!sp || !p) return null;
    if (OUT.at && ctx.time < OUT.t && Math.hypot(p.x - OUT.at.x, p.z - OUT.at.z) < 4) return null;
    const d = Math.hypot(sp.x - p.x, sp.z - p.z);
    if (d < 24 && ctx.interiors.lanes && ctx.interiors.lanes.warm) ctx.interiors.lanes.warm();
    return d < 30 ? sp : null;
}
export function enterLanes(opts = {}) {
    if (!ctx.interiors.lanes) return false;
    if (opts.exit) return ctx.interiors.lanes.enter(Object.assign({ from: "foot" }, opts));
    const sp = inTown() && ctx.town.spot("lanes");
    if (!sp) return false;
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    const dr = { id: "lanes", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
    emit("stat", { id: "footInteriors", n: 1 });
    const exit = () => { setState("footRun", { resume: "interior", door: dr }); OUT.at = { x: sp.x, z: sp.z }; OUT.t = ctx.time + 8; };
    return ctx.interiors.lanes.enter({ exit, door: "lanes", from: "foot" });
}
function addDoors() {
    if (!ctx.foot || !ctx.foot.addSpot) return;
    ctx.foot.addSpot({ pos: () => doorPos(), r: 2.4, door: true, walkIn: { id: "lanes" }, short: "LANES", label: () => `🎳 GO INTO ${NAME.toUpperCase()}`, act: () => enterLanes() });
}
function addPinAndBadges() {
    if (ctx.pins && ctx.pins.add && !LG.pinned) { LG.pinned = true; try { ctx.pins.add({ id: "midwood:lanes", town: "midwood", spot: "lanes", cat: "town", icon: "🎳", name: NAME, sub: "bowling · alone or with friends" }); } catch (e) { console.error("[lanes] pin", e); } }
    if (ctx.meta && ctx.meta.addBadge && !LG.badges) {
        LG.badges = true;
        ctx.meta.addBadge({ id: "lanes200", icon: "🎳", name: "The 200 Club", desc: "Bowl a 200 game at East Midwood Lanes", test: s => ((s.stats && s.stats.lanes200) || 0) >= 1 });
        ctx.meta.addBadge({ id: "lanesTrophy", icon: "🏆", name: "Back in the Case", desc: "Bring Sheldon's 1994 trophy home", test: s => ((s.stats && s.stats.lanesTrophy) || 0) >= 1 });
        ctx.meta.addBadge({ id: "lanesStrike", icon: "💥", name: "Strike!", desc: "A strike at East Midwood Lanes", test: s => ((s.stats && s.stats.lanesStrikes) || 0) >= 1 });
    }
}
on("boot", () => { addDoors(); addPinAndBadges(); });

ctx.lanes = {
    enter: enterLanes,
    game: () => G.game,
    get best() { return S.best; },
    debug: { S, G, V, LG, play: playDebug, net: netDebug, order, nameOf, peersHere, freeLane, joinable, showGame, laneX, doorPos, canWalkIn, hasTrophy,
        lanesDef: LANES_DEF, myId },
};
export { ID };
