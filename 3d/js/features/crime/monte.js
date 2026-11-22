// features/crime — 🥄 "FIND THE KUGEL" (three-cup monte) — crime that isn't hers.
//
// Yanky Three-Cups runs a folding table on the sidewalk by the bank (or the hall / the bakery): three paper cups, one
// tiny kugel, and Berel the shill "winning" every few seconds. The table FOLDS the moment a cop turns the corner (a law
// unit / the town patrol within sight of it) — Yanky strolls off whistling — and is back ~45 s after they've gone.
// ✋ at the table → the card:
//   🎲 PLAY (PAY.monte.bet 💰) — the cups shuffle; pick one. It's rigged (the kugel's up his sleeve): she loses the bet
//      (≤ playsPerDay a real day — a tiny coin sink, never a source).
//   📞 REPORT HIM (or from the 📞 Phone › 911 while she's near) — a beat cop walks over; Yanky folds and runs, the cop
//      nabs him: PAY.monte.report 💰 (once a REAL day). Yanky remembers (next time: "Not YOU again." — the table folds
//      when she walks up).
//   🤝 BE HIS SHILL — she stands by and "wins" loudly; every few seconds a mark sits down: PAY.monte.shill a mark,
//      ≤ shillMax a shift, once a REAL day, +heat. A cop who SEES her shilling: the ⚠️ look, then a foot chase for
//      CONSPIRACY TO MONTE. Yanky remembers a partner (he waves her over next time).
//   🚶‍♀️ Walk away.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { PAY, TUNE, LINES, log, stat, pick, fill, lulu, bubble, mustSee, bakeBoxes, townSpot, copWatching, footCrime, payCapped,
    walking, onFoot, live, paidToday, luluPos } from "./common.js";
import { CHARGES } from "./data.js";
import { Character, ask, sendCop, mem, remember } from "./street.js";

const K = TUNE.monte, M = LINES.monte;
export const MONTE = { table: null, cups: [], geos: [], mats: [], yanky: null, berel: null, state: "open", foldT: 0, lookT: 0, shillT: 0, game: null, shift: null, spotRm: null, rm: null, reported: false };

function makeTable() {
    const g = new THREE.Group();
    const top = "#8D6E63", leg = "#424242", cloth = "#1B5E20";
    g.add(bakeBoxes([
        { w: 1.2, h: 0.05, d: 0.7, y: 0.78, color: top },
        { w: 1.22, h: 0.01, d: 0.72, y: 0.81, color: cloth },
        { w: 0.04, h: 0.78, d: 0.04, x: -0.55, y: 0.39, z: -0.3, rz: 0.12, color: leg },
        { w: 0.04, h: 0.78, d: 0.04, x: 0.55, y: 0.39, z: -0.3, rz: -0.12, color: leg },
        { w: 0.04, h: 0.78, d: 0.04, x: -0.55, y: 0.39, z: 0.3, rz: 0.12, color: leg },
        { w: 0.04, h: 0.78, d: 0.04, x: 0.55, y: 0.39, z: 0.3, rz: -0.12, color: leg },
        // a cardboard sign: "FIND THE KUGEL · 3 💰"
        { w: 0.5, h: 0.32, d: 0.02, x: 0, y: 0.6, z: 0.36, color: "#FFE082" },
    ], MONTE.geos));
    const cupGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.13, 10);
    MONTE.geos.push(cupGeo);
    const cupMat = new THREE.MeshStandardMaterial({ color: "#ECEFF1", roughness: 0.8 });
    MONTE.mats.push(cupMat);
    for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(cupGeo, cupMat);
        c.position.set((i - 1) * 0.3, 0.88, 0);
        g.add(c);
        MONTE.cups.push(c);
    }
    return g;
}

export function buildMonte() {
    clearMonte();
    const at = townSpot(["bank", "hall", "bakery"], -10, 1.3);
    if (!at) return false;
    MONTE.table = makeTable();
    MONTE.table.position.set(at.x, 0, at.z);
    MONTE.table.rotation.y = at.yaw + Math.PI;
    ctx.scene.add(MONTE.table);
    MONTE.at = at;
    // Yanky behind it (facing the street), Berel the shill in front
    MONTE.yanky = new Character({ key: "uw_goon", fallback: "npcMan", colors: { Shirt: "#4E342E", Pants: "#212121" }, name: M.dealer });
    MONTE.yanky.place(at.x - at.nx * 0.7, at.z - at.nz * 0.7, at.yaw);
    MONTE.berel = new Character({ key: "npcMan", colors: { Shirt: "#F9A825", Pants: "#37474F" }, name: "Berel" });
    MONTE.berel.place(at.x + at.nx * 0.75 + at.ux * 0.5, at.z + at.nz * 0.75 + at.uz * 0.5, at.yaw + Math.PI);
    MONTE.state = mem("yanky").mood === "snitch" ? "wary" : "open";
    if (ctx.foot && ctx.foot.addSpot) MONTE.spotRm = ctx.foot.addSpot(spot);
    log("monte", { phase: "built", key: at.key });
    return true;
}
export function clearMonte() {
    if (MONTE.spotRm) { MONTE.spotRm(); MONTE.spotRm = null; }
    if (MONTE.yanky) MONTE.yanky.clear();
    if (MONTE.berel) MONTE.berel.clear();
    if (MONTE.table) MONTE.table.removeFromParent();
    for (const g of MONTE.geos) g.dispose();
    for (const m of MONTE.mats) m.dispose();
    MONTE.geos.length = MONTE.mats.length = MONTE.cups.length = 0;
    Object.assign(MONTE, { table: null, yanky: null, berel: null, game: null, shift: null, state: "open", at: null });
}

const open = () => MONTE.table && (MONTE.state === "open" || MONTE.state === "wary") && MONTE.yanky && MONTE.yanky.p;
const spot = {
    r: 2.2, short: "TABLE",
    pos() { return open() && live() && !MONTE.game && !MONTE.shift ? { x: MONTE.table.position.x + MONTE.at.nx * 0.8, z: MONTE.table.position.z + MONTE.at.nz * 0.8 } : null; },
    label() { return M.spot; },
    act() { card(); },
};

async function card() {
    if (!open() || ctx.dialogOpen) return;
    const y = MONTE.yanky;
    const m = mem("yanky");
    m.met++;
    if (MONTE.state === "wary") {
        bubble(pick(M.snitch), y.obj, { y: 2.1 });
        fold("snitch");
        return;
    }
    const friend = m.mood === "partner";
    const opts = [fill(M.play, { n: PAY.monte.bet }), M.report, M.shill, M.leave];
    const i = await ask(`🥄 ${M.dealer}`, friend ? pick(M.hiPartner) : pick(M.pitch), opts, "🥄");
    if (!open()) return;
    if (i === 0) play();
    else if (i === 1) report("person");
    else if (i === 2) startShift();
    else bubble(pick(M.bye), y.obj, { y: 2.1 });
}

// ── 🎲 the game (rigged) ──────────────────────────────────────────────────
function play() {
    const y = MONTE.yanky;
    const n = (mem("yanky").playDay === paidDayKey() ? mem("yanky").plays || 0 : 0);
    if (n >= PAY.monte.playsPerDay) { bubble(M.noMore, y.obj, { y: 2.1 }); return; }
    if (wallet.coins < PAY.monte.bet) { bubble(M.broke, y.obj, { y: 2.1 }); return; }
    const m = mem("yanky");
    m.playDay = paidDayKey(); m.plays = n + 1;
    wallet.spend(PAY.monte.bet);
    MONTE.game = { t: 0, swaps: 0, a: -1, b: -1, swapT: 0, done: false };
    bubble(pick(M.shuffle), y.obj, { y: 2.1, dur: 2.2 });
    log("monte", { phase: "play" });
    stat("crimeMontePlays");
}
const paidDayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
async function pickCup() {
    const i = await ask(`🥄 ${M.dealer}`, M.which, M.cups, "🥄");
    const c = MONTE.cups[Math.max(0, Math.min(2, i))];
    if (c) c.position.y = 1.0;
    lulu(pick(M.lost), true);
    if (MONTE.yanky && MONTE.yanky.obj) bubble(pick(M.sleeve), MONTE.yanky.obj, { y: 2.1, dur: 2.6 });
    log("monte", { phase: "lost", bet: PAY.monte.bet });
    setTimeout(() => { if (c) c.position.y = 0.88; }, 1500);
}
function gameTick(dt) {
    const G = MONTE.game;
    if (!G) return;
    G.t += dt;
    if (G.swaps < K.swaps) {
        G.swapT += dt;
        if (G.a < 0) { G.a = Math.floor(Math.random() * 3); G.b = (G.a + 1 + Math.floor(Math.random() * 2)) % 3; G.swapT = 0; G.ax = MONTE.cups[G.a].position.x; G.bx = MONTE.cups[G.b].position.x; }
        const k = Math.min(1, G.swapT / K.swapSec);
        const ca = MONTE.cups[G.a], cb = MONTE.cups[G.b];
        ca.position.x = G.ax + (G.bx - G.ax) * k; cb.position.x = G.bx + (G.ax - G.bx) * k;
        ca.position.z = Math.sin(k * Math.PI) * 0.12; cb.position.z = -Math.sin(k * Math.PI) * 0.12;
        if (k >= 1) { G.swaps++; G.a = -1; }
        return;
    }
    if (!G.done) { G.done = true; MONTE.game = null; pickCup(); }
}

// ── 📞 report ─────────────────────────────────────────────────────────────
export function report(via = "person") {
    if (!open() || MONTE.reported) return false;
    MONTE.reported = true;
    const y = MONTE.yanky;
    const go = () => sendCop(y, () => {
        // he folds, makes a run for it, the cop has him by the collar (cartoon)
        MONTE.state = "busted";
        hideTable(true);
        if (y.obj) bubble(pick(M.nabbed), y.obj, { y: 2.1, dur: 2.4 });
        remember("yanky", "reported", "snitch");
        const paid = payCapped("monte:report", PAY.monte.report, PAY.monte.report);
        stat("crimeReports");
        mustSee(paid > 0 ? `${M.reportDone} · +${paid} 💰` : M.reportDone, paid > 0 ? "gold" : "", "crime:monte");
        log("monte", { phase: "reported", via, paid });
        MONTE.foldT = K.backAfter * 2;
    });
    log("monte", { phase: "report", via });
    if (via === "person" && ctx.community && ctx.community.callOut) ctx.community.callOut("police", M.call911, go);
    else go();
    return true;
}

// ── 🤝 the shill ──────────────────────────────────────────────────────────
function startShift() {
    if (paidToday("monte:shill") >= PAY.monte.shillMax) { bubble(M.shillDone, MONTE.yanky.obj, { y: 2.1 }); return; }
    MONTE.shift = { t: 0, marks: 0, markT: K.markEvery * 0.6, lookT: 0.8, where: { x: MONTE.table.position.x + MONTE.at.nx * 0.9, z: MONTE.table.position.z + MONTE.at.nz * 0.9 } };
    lulu(pick(M.shillLulu), true);
    stat("crimeShills");
    log("monte", { phase: "shill" });
    try { if (ctx.underworld && ctx.underworld.addHeat) ctx.underworld.addHeat(PAY.monte.heat, "monte"); } catch (e) { /* no underworld */ }
}
function shiftTick(dt) {
    const S = MONTE.shift;
    if (!S) return;
    const lp = luluPos();
    S.t += dt;
    if (!onFoot() || Math.hypot(lp.x - S.where.x, lp.z - S.where.z) > 6 || !open()) { endShift(open() ? "walked" : "folded"); return; }
    S.markT -= dt;
    if (S.markT <= 0 && S.marks < K.marks) {
        S.markT = K.markEvery;
        S.marks++;
        lulu(pick(M.shillWin), true);
        if (MONTE.berel && MONTE.berel.obj) bubble(pick(M.mark), MONTE.berel.obj, { y: 2.1, dur: 1.6 });
        log("monte", { phase: "mark", n: S.marks });
    }
    S.lookT -= dt;
    if (S.lookT <= 0) { S.lookT = 1; if (footCrime("monte", CHARGES.monte.name, lp) === "chase") { endShift("cop"); fold("cop"); return; } }
    if (S.marks >= K.marks && S.markT < K.markEvery * 0.5) endShift("done");
}
function endShift(why) {
    const S = MONTE.shift;
    if (!S) return;
    MONTE.shift = null;
    log("monte", { phase: "shiftEnd", why, marks: S.marks });
    if (why === "cop" || !S.marks) return;
    const paid = payCapped("monte:shill", S.marks * PAY.monte.shill, PAY.monte.shillMax);
    remember("yanky", "joined", "partner");
    if (paid > 0) mustSee(`${M.shillPaid} · +${paid} 💰`, "gold", "crime:monte");
}

// ── folding up when a cop turns the corner ───────────────────────────────
function hideTable(on) {
    if (!MONTE.table) return;
    for (const c of MONTE.cups) c.visible = !on;
    MONTE.table.rotation.x = on ? -1.45 : 0;        // (flat, under his arm — close enough)
    MONTE.table.position.y = on ? 0.4 : 0;
}
function fold(why) {
    if (MONTE.state === "folded" || MONTE.state === "busted") return;
    MONTE.state = "folded";
    MONTE.foldT = K.backAfter;
    hideTable(true);
    if (MONTE.game) MONTE.game = null;
    if (MONTE.yanky && MONTE.yanky.obj) bubble(pick(M.fold), MONTE.yanky.obj, { y: 2.1, dur: 2 });
    if (MONTE.shift) endShift("folded");
    stat("crimeMonteFolds");
    log("monte", { phase: "fold", why });
}

export function monteTick(dt) {
    if (!MONTE.table) return;
    const on = MONTE.yanky.keep();
    MONTE.berel.keep();
    if (!on) return;
    const y = MONTE.yanky, b = MONTE.berel;
    gameTick(dt);
    shiftTick(dt);
    // the people
    if (y.p) { y.p.update(dt, { talk: !!MONTE.game || MONTE.state === "open" && Math.sin(ctx.time * 1.3) > 0.4 }); }
    if (b.p) {
        b.p.update(dt, { cheer: MONTE.state === "open" && Math.sin(ctx.time * 0.9) > 0.85 });
        MONTE.shillT -= dt;
        if (MONTE.shillT <= 0 && MONTE.state === "open") { MONTE.shillT = 9 + Math.random() * 6; const lp = luluPos(); if (Math.hypot(lp.x - b.x, lp.z - b.z) < 22) bubble(pick(M.berel), b.obj, { y: 2.1, dur: 1.8 }); }
    }
    if (MONTE.state === "folded" || MONTE.state === "busted") {
        if (MONTE.state === "busted") { if (y.p) y.p.obj.visible = false; if (b.p) b.p.obj.visible = false; return; }
        // he strolls off a little and waits for the coast to clear
        const cop = copWatching(MONTE.table.position.x, MONTE.table.position.z, K.copR);
        MONTE.foldT = cop ? K.backAfter : MONTE.foldT - dt;
        if (MONTE.foldT <= 0) { MONTE.state = mem("yanky").mood === "snitch" ? "wary" : "open"; hideTable(false); log("monte", { phase: "back" }); }
        return;
    }
    // a cop turns the corner: fold
    MONTE.lookT -= dt;
    if (MONTE.lookT <= 0) {
        MONTE.lookT = 0.5;
        if (!MONTE.reported && copWatching(MONTE.table.position.x, MONTE.table.position.z, K.copR)) fold("cop");
        // a snitch walks up: fold
        const lp = luluPos();
        if (MONTE.state === "wary" && Math.hypot(lp.x - y.x, lp.z - y.z) < 6) { bubble(pick(M.snitch), y.obj, { y: 2.1 }); fold("snitch"); }
    }
}
/** For the 📞 Phone (community.addReason "police"): while she's near an open table. */
export function monteReason() {
    if (!open() || MONTE.reported || !live() || MONTE.state === "wary") return null;
    const lp = luluPos(), t = MONTE.table.position;
    if (Math.hypot(lp.x - t.x, lp.z - t.z) > 60) return null;
    return { id: "crimeMonte", icon: "🥄", label: M.phoneLabel, sub: M.phoneSub, run: () => ctx.community.callOut("police", M.call911, () => report("phone")) };
}
export const montePaidToday = () => paidToday("monte:report");
export { fold as monteFold };
