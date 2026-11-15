// features/banter — Lulu's one-liners: what happened → what she says.
//
// Rules: one bubble every ~8–15 s at most, big moments (a crash, a cop chase,
// a combo) may cut in after 3 s; every category has its own cooldown and its
// own shuffle bag; never during cutscenes, dialogs, the pause menu, a skip, a
// phone call or anything that isn't free driving. All of it is "random
// content", so it only runs when ctx.enabled("banter").
import { ctx, on, emit, hook, MPH } from "../../core/ctx.js";
import { SHOULDER } from "../../world.js";
import { LULU, LULU_LEG } from "./lines.js";
import { draw, quiet, clamp, nightness, chance } from "./util.js";
import { showLulu, luluBubble } from "./bubbles.js";
import { talk } from "./rig.js";

// prio: 1 small talk · 2 normal · 3 big moment (cuts in) — chance per trigger — cd: seconds before that category again
export const CAT = {
    opener:          { prio: 2, chance: 0.75, cd: 0 },
    leg:             { prio: 2, chance: 1, cd: 0 },
    closeCall:       { prio: 2, chance: 0.7, cd: 7 },
    dodge:           { prio: 2, chance: 0.85, cd: 7 },
    combo:           { prio: 3, chance: 1, cd: 9, big: true },
    honk:            { prio: 1, chance: 0.45, cd: 16 },
    honkSpam:        { prio: 2, chance: 0.9, cd: 25 },
    boost:           { prio: 2, chance: 0.55, cd: 14 },
    coinStreak:      { prio: 1, chance: 0.8, cd: 20 },
    cone:            { prio: 2, chance: 0.8, cd: 8 },
    damage:          { prio: 3, chance: 0.7, cd: 6 },
    lastHeart:       { prio: 3, chance: 1, cd: 30, big: true },
    copChase:        { prio: 3, chance: 1, cd: 20, big: true },
    copChaseOngoing: { prio: 2, chance: 0.7, cd: 11 },
    copEscape:       { prio: 3, chance: 1, cd: 10, big: true },
    speedTrapLegal:  { prio: 2, chance: 0.7, cd: 15 },
    speedTrapTicket: { prio: 2, chance: 0.85, cd: 15 },
    boring:          { prio: 1, chance: 1, cd: 30 },
    wrongWay:        { prio: 2, chance: 0.9, cd: 25 },
    offroad:         { prio: 1, chance: 0.7, cd: 30 },
    speedy:          { prio: 1, chance: 0.6, cd: 45 },
    drift:           { prio: 1, chance: 0.6, cd: 25 },
    heart:           { prio: 2, chance: 0.7, cd: 20 },
    splash:          { prio: 2, chance: 0.75, cd: 15 },
    pothole:         { prio: 2, chance: 0.75, cd: 15 },
    phoneEnd:        { prio: 2, chance: 0.75, cd: 10 },
    animal:          { prio: 2, chance: 0.75, cd: 12 },
    night:           { prio: 2, chance: 1, cd: 9999 },
    backOnRoad:      { prio: 2, chance: 0.8, cd: 30 },
    comeback:        { prio: 1, chance: 0.35, cd: 20 },
    thanks:          { prio: 2, chance: 0.8, cd: 15 },
    billboard:       { prio: 1, chance: 0.45, cd: 18 },
};

const D = {
    last: -99, gap: 9, cd: {}, count: 0, lastLine: "", lastCat: "", byCat: {},
    pending: null, phone: false, chase: false, chaseT: 0,
    boringT: 0, boringAt: 40, wrongT: 0, offT: 0, speedyT: 0, driftT: 0, nightSaid: false, honks: [],
};
export const luluState = D;

function lineFor(cat, info) {
    let list = cat === "leg" ? LULU_LEG[info.id] : LULU[cat];
    if (!list || !list.length) return null;
    const l = draw("lulu:" + (cat === "leg" ? "leg:" + info.id : cat), list);
    return typeof l === "function" ? l(info) : l;
}
function canTalk() {
    if (quiet() || D.phone) return false;
    const car = ctx.car;
    return !!car && (!car.driver || car.driver.visible || !!(ctx.foot && ctx.foot.borrowed));
}

/**
 * Lulu says something from `cat` (or opts.line). opts: force (skip the dice, the
 * throttle and the test gate — debug/tests), delay (seconds; the newest pending line wins).
 * Returns true if she said it (or it's queued).
 */
export function say(cat, info = {}, { force = false, delay = 0, line = null } = {}) {
    if (!force && !ctx.enabled("banter")) return false;
    const c = CAT[cat] || { prio: 2, chance: 1, cd: 0 };
    if (delay > 0) {
        if (!D.pending || (CAT[D.pending.cat] || c).prio <= c.prio) D.pending = { cat, info, force, line, at: ctx.time + delay };
        return true;
    }
    if (!canTalk()) return false;
    const now = ctx.time;
    if (!force) {
        if ((D.cd[cat] || 0) > now) return false;
        if (!chance(c.chance)) { D.cd[cat] = now + 1.5; return false; }
        const since = now - D.last;
        if (since < (c.prio >= 3 ? 3 : c.prio === 2 ? D.gap * 0.6 : D.gap)) return false;
        if (luluBubble().on && c.prio < 3) return false;
    }
    const text = line || lineFor(cat, info);
    if (!text) return false;
    const dur = clamp(1.6 + text.length * 0.052, 2.2, 4.6);
    showLulu(text, dur, { big: !!c.big, cat });
    talk(Math.min(1.5, dur * 0.5));
    D.last = now; D.gap = 8 + Math.random() * 7; D.cd[cat] = now + (c.cd || 0);
    D.lastLine = text; D.lastCat = cat; D.count++; D.byCat[cat] = (D.byCat[cat] || 0) + 1;
    D.boringT = 0; D.boringAt = 32 + Math.random() * 20;
    emit("banter:line", { cat, text });
    return true;
}
/** Something happened (resets the "boring" clock even if she stays quiet). */
function busy() { D.boringT = 0; }

/** Every driving frame (hud hook, state "playing"). */
export function tickLulu(dt) {
    if (!ctx.enabled("banter")) return;
    const car = ctx.car, G = ctx.G;
    if (D.pending && ctx.time >= D.pending.at) {
        const p = D.pending; D.pending = null;
        say(p.cat, p.info, { force: p.force, line: p.line });
    }
    if (ctx.state !== "playing") return;
    const sp = car.speed;
    // long boring stretch
    if (sp > 8 && !D.chase) D.boringT += dt;
    if (D.boringT > D.boringAt) { D.boringT = 0; D.boringAt = 30 + Math.random() * 20; say("boring"); }
    // wrong side of the road
    D.wrongT = car.d < -1.2 && sp > 9 ? D.wrongT + dt : Math.max(0, D.wrongT - dt * 2);
    if (D.wrongT > 1.6) { D.wrongT = 0; say("wrongWay"); }
    // off the road entirely
    D.offT = Math.abs(car.d) > SHOULDER + 0.8 && sp > 6 ? D.offT + dt : Math.max(0, D.offT - dt * 2);
    if (D.offT > 1.8) { D.offT = 0; say("offroad"); }
    // very fast
    D.speedyT = sp * MPH > 88 ? D.speedyT + dt : 0;
    if (D.speedyT > 2.5) { D.speedyT = 0; say("speedy"); }
    // drifting
    D.driftT = car.slip > 0.55 && sp > 12 ? D.driftT + dt : Math.max(0, D.driftT - dt);
    if (D.driftT > 0.7) { D.driftT = 0; say("drift"); }
    // night falls (the Vegas strip)
    if (!D.nightSaid && nightness() > 0.75 && say("night")) D.nightSaid = true;
    // a chase that goes on and on
    if (D.chase) { D.chaseT += dt; if (D.chaseT > 9) { D.chaseT = 0; say("copChaseOngoing"); } }
    if (G.combo > 0) busy();
}

// ── events ──────────────────────────────────────────────────────────────────
// reset first thing in a new run (before the journey arms its leg and says where we're going)
hook("runStart", () => {
    Object.assign(D, { pending: null, chase: false, chaseT: 0, boringT: 0, boringAt: 40, wrongT: 0, offT: 0, speedyT: 0, driftT: 0, nightSaid: false, honks: [], last: -99, phone: false });
}, 100);
on("run:start", ({ mode }) => { if (mode === "cruise") say("opener", {}, { delay: 3.4 }); });
on("journey:leg", ({ stop }) => { if (stop && stop.id) say("leg", { id: stop.id }, { delay: 3.4 }); });
on("closeCall", ({ oncoming, combo }) => {
    busy();
    if (combo >= 3) say("combo", { combo });
    else say(oncoming ? "dodge" : "closeCall");
});
on("honk", () => {
    busy();
    const now = ctx.time;
    D.honks.push(now);
    while (D.honks.length && now - D.honks[0] > 5) D.honks.shift();
    if (D.honks.length >= 4) { D.honks.length = 0; say("honkSpam"); }
    else say("honk");
});
on("boost", () => { busy(); say("boost"); });
on("coin", ({ why }) => {
    const G = ctx.G;
    if (why === "road" && G.coinStreak > 0 && G.coinStreak % 8 === 0) { busy(); say("coinStreak"); }
});
on("stat", ({ id }) => {
    if (id === "cones") { busy(); say("cone"); }
    else if (id === "puddles") { busy(); say("splash"); }
    else if (id === "potholes") { busy(); say("pothole"); }
});
on("damage", ({ source }) => {
    busy();
    const G = ctx.G;
    if (G.hearts === 1) say("lastHeart");
    else if (G.hearts > 1) say(source === "cone" ? "cone" : "damage");
});
on("heart", () => { busy(); say("heart"); });
on("cop:chase", ({ active, result }) => {
    busy();
    D.chase = !!active; D.chaseT = 0;
    if (active) say("copChase");
    else if (result !== "busted") say("copEscape", {}, { delay: 0.8 });
});
on("speedTrap", ({ ticketed, handled }) => {
    if (handled) return;
    busy();
    say(ticketed ? "speedTrapTicket" : "speedTrapLegal", {}, { delay: 0.3 });
});
on("phone:ring", () => { D.phone = true; });
on("phone:end", () => { D.phone = false; say("phoneEnd", {}, { delay: 1.2 }); });
on("roadevents:animal", () => { busy(); say("animal", {}, { delay: 0.4 }); });
on("foot:end", () => { say("backOnRoad", {}, { delay: 2.5 }); });
on("state", ({ to }) => { if (to !== "playing" && to !== "intro") D.pending = D.pending && D.pending.cat === "backOnRoad" ? D.pending : null; });
