// features/crime — 📦 THE PORCH PIRATE — crime that isn't hers.
//
// While she walks in town, now and then (TUNE.porch: the first after firstAfter s, then every gap s, ≤ perRun a run) a
// guy in a beanie strolls up to a front door 12–45 m from her, lifts the parcel off the step and legs it down the street.
//   ✋ TACKLE him (he drops it) → ✋ pick it up → ✋ RETURN it at THAT family's door: their thanks + PAY.porch.back 💰
//      (≤ perDay a REAL day) — and the family remembers (SAVE.mem["fam:<key>"], features/memory): next time she passes
//      they wave ("our package angel!").
//   📞 Shomrim (the 📞 Phone, while he's running): a Shomer jogs after him and brings it back himself — PAY.porch.shomrim.
//   🙈 let him go: the town's group chat hears about it.
//   📦 KEEP IT (walk off with the box / get in a car with it): she opens it (+PAY.porch.keep, ≤ keepPerDay) — but the
//      family's doorbell camera saw: law.callIn("PORCH PACKAGE THEFT") and the family remembers THAT.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { CR, SAVE, PAY, TUNE, LINES, dirty, log, stat, pick, fill, lulu, bubble, mustSee, bakeBoxes, need, person, drop, payCapped,
    walking, onFoot, live, chasing, luluPos } from "./common.js";
import { CHARGES } from "./data.js";
import { sendCop } from "./street.js";

const K = TUNE.porch, M = LINES.porch;
export const PORCH = { E: null, nextT: K.firstAfter, n: 0, geos: [], spotRm: [], anchors: [] };
const tmp = {};

/** The household at a door — ci/homelife's stable id + family name when it's there (ctx.homes.householdAt), else the door's
 *  own key (which can shift when a house becomes a landmark: then nothing is SAVED under it, only features/memory's log). */
function household(h) {
    let hh = null;
    try { hh = ctx.homes.householdAt ? ctx.homes.householdAt(h.ap.x, h.ap.z, 3) : null; } catch (e) { hh = null; }
    return { id: hh && hh.id ? hh.id : null, fam: hh && hh.family ? hh.family.replace(/^the /i, "") : `${h.name || "Katz"}s` };
}
const famOf = h => household(h).fam;
const livedIn = h => { try { const id = household(h).id; return !(id && ctx.homes.livedIn && ctx.homes.livedIn(id) === false); } catch (e) { return true; } };
export function famMem(key) { return SAVE.mem["fam:" + key] || null; }
function famRemember(h, what) {
    const hh = household(h);
    if (hh.id) {
        const k = "fam:" + hh.id, m = SAVE.mem[k] || (SAVE.mem[k] = { name: h.name, back: 0, kept: 0 });
        m[what] = (m[what] || 0) + 1;
        dirty();
    }
    try { if (ctx.memory && ctx.memory.remember) ctx.memory.remember("crime", { who: "family", fam: h.name, id: hh.id, did: what, town: CR.town }); } catch (e) { /* no memory */ }
    // (ci/homelife makes the household remember it: "did you SEE who took my package?!")
    emit("crime:porch", { id: hh.id || h.key, fam: hh.fam, phase: what });
}

export function porchReset() { dropPorch(); PORCH.nextT = K.firstAfter; PORCH.n = 0; }
export function dropPorch() {
    const E = PORCH.E;
    if (!E) return;
    if (E.p) drop(E.p.obj);
    if (E.box) drop(E.box);
    if (E.anchor) drop(E.anchor);
    for (const rm of PORCH.spotRm) rm();
    PORCH.spotRm.length = 0;
    for (const g of PORCH.geos) g.dispose();
    PORCH.geos.length = 0;
    PORCH.E = null;
}

/** Every frame in town. */
export function porchTick(dt, on) {
    const E = PORCH.E;
    if (E) { tick(dt, E); return; }
    if (!on || PORCH.n >= K.perRun || !walking() || chasing() || ctx.dialogOpen) return;
    PORCH.nextT -= dt;
    if (PORCH.nextT > 0) return;
    PORCH.nextT = K.gap[0] + Math.random() * (K.gap[1] - K.gap[0]);
    spawn();
}

function makeBox() {
    return bakeBoxes([
        { w: 0.46, h: 0.34, d: 0.4, y: 0.17, color: "#C8A26B" },
        { w: 0.08, h: 0.345, d: 0.405, y: 0.17, color: "#E0C9A6" },
        { w: 0.18, h: 0.01, d: 0.12, x: 0.1, y: 0.345, z: 0.08, color: "#FFFFFF" },
    ], PORCH.geos);
}

/** A porch pirate now, at a door near her (tests: opts.i = the door's index). → Promise<bool> */
export async function spawn(opts = {}) {
    if (PORCH.E || !ctx.homes || !ctx.homes.homes) return false;
    const lp = luluPos();
    const doors = ctx.homes.homes().filter(h => { const d = Math.hypot(h.ap.x - lp.x, h.ap.z - lp.z); return d > K.doorMin && d < K.doorMax && livedIn(h); });
    const h = opts.i != null ? ctx.homes.homes().find(x => x.i === opts.i) : doors[Math.floor(Math.random() * doors.length)];
    if (!h) { log("porch", { phase: "noDoor" }); return false; }
    PORCH.E = { loading: true };
    await need(["uw_pickpocket", "npcMan"]);
    if (!PORCH.E || !PORCH.E.loading) return false;
    const p = person("uw_pickpocket", null, "npcMan");
    if (!p) { PORCH.E = null; return false; }
    const box = makeBox();
    box.position.set(h.door.x, 0, h.door.z);
    ctx.scene.add(box);
    p.obj.position.set(h.ap.x, 0, h.ap.z);
    ctx.scene.add(p.obj);
    const anchor = new THREE.Object3D();
    anchor.position.set(h.ap.x, 1.8, h.ap.z);
    ctx.scene.add(anchor);
    const E = PORCH.E = { home: h, p, box, anchor, phase: "approach", t: 0, pt: 0, x: h.ap.x, z: h.ap.z, s: 0, d: 0, dir: 1, runT: 0, result: "", fam: famOf(h), shomer: null };
    PORCH.n++;
    PORCH.spotRm.push(ctx.foot.addSpot(tackleSpot), ctx.foot.addSpot(boxSpot), ctx.foot.addSpot(returnSpot));
    stat("crimePorchPirates");
    log("porch", { phase: "spawn", key: h.key, fam: E.fam });
    return true;
}

function tick(dt, E) {
    if (E.loading) return;
    E.t += dt; E.pt += dt;
    const p = E.p, road = ctx.world.road, lp = luluPos();
    switch (E.phase) {
        case "approach": {
            // to the door, grab, turn
            const dx = E.home.door.x - E.x, dz = E.home.door.z - E.z, d = Math.hypot(dx, dz);
            if (d > 0.5) { E.x += dx / d * K.walk * dt; E.z += dz / d * K.walk * dt; p.face(E.home.door.x, E.home.door.z, dt, 8); p.update(dt, { walk: K.walk }); }
            else {
                E.phase = "run"; E.pt = 0;
                p.obj.add(E.box); E.box.position.set(0, 0.95, 0.32);
                road.nearest(E.x, E.z, undefined, tmp);
                const ls = road.nearest(lp.x, lp.z, tmp.s, {}).s;
                E.s = tmp.s; E.d = Math.sign(tmp.d || 1) * (Math.abs(tmp.d) > 0 ? Math.min(Math.abs(tmp.d), (tmp.street ? tmp.street.walk - 1 : 9)) : 8);
                E.dir = Math.sign(tmp.s - ls) || 1;
                bubble(pick(M.grab), p.obj, { y: 2.2, cls: "angry", dur: 2.2 });
                const near = Math.hypot(lp.x - E.x, lp.z - E.z) < 50;
                if (near) { bubble(M.spotted, E.anchor, { y: 0.4, cls: "nice", dur: 2.2 }); lulu(pick(M.lulu), true); }
                log("porch", { phase: "grab", near });
            }
            if (E.pt > 20) gone(E);
            break;
        }
        case "run": {
            E.runT += dt;
            const sp = (E.runT > K.tiredAfter ? K.tired : K.run) * (ctx.dialogOpen ? 0.25 : 1);
            // (he runs along the sidewalk he came out on — road coords: the town street he's on)
            road.nearest(E.x, E.z, E.s, tmp);
            E.s = tmp.s + E.dir * sp * dt;
            const q = road.point(E.s, E.d, tmp);
            const vx = q.x - E.x, vz = q.z - E.z;
            if (Number.isFinite(q.x)) { E.x = q.x; E.z = q.z; }
            p.face(E.x + vx * 10, E.z + vz * 10, dt, 10);
            p.update(dt, { walk: sp });
            if (E.runT > 0.6 && E.runT % 3 < dt) bubble(pick(M.run), p.obj, { y: 2.2, cls: "angry", dur: 1.4 });
            const dl = Math.hypot(lp.x - E.x, lp.z - E.z);
            if (onFoot() && dl < K.auto && E.runT > 0.9) tackle("lulu");
            else if (!E.shomer && !ctx.dialogOpen && (dl > K.getaway || E.runT > K.life)) gone(E);
            break;
        }
        case "tackled":
            if (E.pt < 2.4) { p.obj.rotation.x = Math.max(-1.45, p.obj.rotation.x - dt * 8); p.obj.position.y = 0.15; p.update(dt, {}); }
            else { p.obj.rotation.x = 0; p.obj.position.y = 0; E.x += Math.sin(p.obj.rotation.y) * 2 * dt; E.z += Math.cos(p.obj.rotation.y) * 2 * dt; p.update(dt, { walk: 2 }); if (E.pt > 6) { drop(p.obj); E.p = null; E.phase = "dropped"; E.pt = 0; } }
            break;
        case "dropped": case "carry": case "held":
            if (E.p && E.phase === "held") E.p.update(dt, { talk: true });
            break;
    }
    if (E.p && E.phase !== "dropped") E.p.obj.position.set(E.x, E.p.obj.position.y, E.z);
    // carrying it: walked off with it / got in a car → kept
    if (E.phase === "carry") {
        if (!onFoot()) { kept(E); return; }
        const h = E.home, d = Math.hypot(lp.x - h.ap.x, lp.z - h.ap.z);
        if (d > K.getaway + 15) kept(E);
    }
    // a box left lying around once she's gone: tidy up
    if ((E.phase === "dropped" || E.phase === "gone" || E.phase === "held" || E.phase === "done") && Math.hypot(lp.x - E.x, lp.z - E.z) > 90) dropPorch();
}

/** Got him. by: "lulu" | "shomrim". */
export function tackle(by = "lulu") {
    const E = PORCH.E;
    if (!E || E.phase !== "run") return false;
    E.phase = by === "lulu" ? "tackled" : "held"; E.pt = 0;
    // the box goes down where he went down
    E.p.obj.remove(E.box);
    E.box.position.set(E.x + 0.6, 0, E.z + 0.3);
    ctx.scene.add(E.box);
    bubble(pick(M.tackled), E.p.obj, { y: by === "lulu" ? 1.2 : 2.1, dur: 2.6 });
    if (by === "lulu") { stat("crimeTackles"); if (ctx.G) ctx.G.shake = Math.max(ctx.G.shake || 0, 0.3); }
    log("porch", { phase: "tackled", by });
    if (by === "shomrim") {
        // the Shomrim bring it back to the family themselves
        E.phase = "done";
        drop(E.box);
        famRemember(E.home, "back");
        const paid = payCapped("porch", PAY.porch.shomrim, PAY.porch.perDay);
        mustSee(fill(M.shomrimDone, { fam: E.fam }) + (paid > 0 ? ` · +${paid} 💰` : ""), paid > 0 ? "gold" : "", "crime:porch");
    }
    return true;
}
function gone(E) {
    if (E.result) return;
    E.result = "gone"; E.phase = "gone";
    { const hh = household(E.home); emit("crime:porch", { id: hh.id || E.home.key, fam: hh.fam, phase: "gone" }); }
    if (E.p) { drop(E.p.obj); E.p = null; }
    log("porch", { phase: "gone" });
    const G = ctx.town && ctx.town.def && ctx.town.def.lines && ctx.town.def.lines.GROUP;
    try { if (G && ctx.phone && ctx.phone.text) ctx.phone.text({ from: G.from, emoji: G.emoji, color: G.color, msg: fill(pick(M.group), { fam: E.fam }), dur: 4 }); } catch (e) { /* no phone */ }
}
function pickUp() {
    const E = PORCH.E;
    if (!E || E.phase !== "dropped" && E.phase !== "tackled") return;
    E.phase = "carry"; E.pt = 0;
    const me = ctx.foot.obj;
    if (me) { me.add(E.box); E.box.position.set(0, 0.85, 0.34); }
    log("porch", { phase: "carry" });
}
function giveBack() {
    const E = PORCH.E;
    if (!E || E.phase !== "carry") return;
    E.phase = "done"; E.result = "back";
    drop(E.box);
    E.box.position.set(E.home.door.x, 0, E.home.door.z);
    ctx.scene.add(E.box);
    const m = famMem(household(E.home).id);
    bubble(m && m.back ? pick(M.again) : pick(M.thanks), E.anchor, { y: 0.2, cls: "nice", dur: 3 });
    famRemember(E.home, "back");
    stat("crimePackagesBack");
    const paid = payCapped("porch", PAY.porch.back, PAY.porch.perDay);
    mustSee(fill(M.backDone, { fam: E.fam }) + (paid > 0 ? ` · +${paid} 💰` : ""), paid > 0 ? "gold" : "", "crime:porch");
    log("porch", { phase: "back", paid });
}
function kept(E) {
    E.phase = "done"; E.result = "kept";
    drop(E.box);
    famRemember(E.home, "kept");
    stat("crimePackagesKept");
    rememberKeep();
    const paid = payCapped("porch:keep", PAY.porch.keep, PAY.porch.keepPerDay);
    mustSee(fill(M.kept, { what: pick(M.keptWhat) }) + (paid > 0 ? ` · +${paid} 💰` : ""), "", "crime:porch");
    // the doorbell camera saw her
    try { if (ctx.law && ctx.law.callIn) ctx.law.callIn(CHARGES.porch.name, { msg: fill(M.keepCall, { fam: E.fam }) }); } catch (e) { /* no law */ }
    log("porch", { phase: "kept", paid });
}
function rememberKeep() { try { if (ctx.underworld && ctx.underworld.addHeat) ctx.underworld.addHeat(3, "package"); } catch (e) { /* none */ } }

// ── ✋ spots ──────────────────────────────────────────────────────────────
const tackleSpot = {
    r: TUNE.porch.tackleR, short: "TACKLE", first: true,
    pos() { const E = PORCH.E; return E && E.phase === "run" && E.p ? { x: E.x, z: E.z } : null; },
    label() { return M.tackle; },
    act() { tackle("lulu"); },
};
const boxSpot = {
    r: 1.6, short: "PICK UP", first: true,
    pos() { const E = PORCH.E; return E && (E.phase === "dropped" || (E.phase === "tackled" && E.pt > 0.8)) ? { x: E.box.position.x, z: E.box.position.z } : null; },
    label() { return fill(M.pick, { fam: PORCH.E.fam }); },
    act() { pickUp(); },
};
const returnSpot = {
    r: 2.4, short: M.ret, first: true,
    pos() { const E = PORCH.E; return E && E.phase === "carry" ? { x: E.home.ap.x, z: E.home.ap.z } : null; },
    label() { return fill(M.carry, { fam: PORCH.E.fam }); },
    act() { giveBack(); },
};

/** 📞 Shomrim while he's running. */
export function porchReason() {
    const E = PORCH.E;
    if (!E || E.phase !== "run" || E.shomer || !live()) return null;
    return { id: "crimePorch", icon: "📦", label: M.phoneLabel, sub: M.phoneSub, run: () => ctx.community.callOut("shomrim", M.callLines, () => shomrim()) };
}
export function shomrim() {
    const E = PORCH.E;
    if (!E || E.phase !== "run" || E.shomer) return false;
    E.shomer = true;
    sendCop(E, () => tackle("shomrim"), { speed: 7.4, key: "community_shomer", line: "SHOMRIM! Stop right there! …please?" });
    stat("crimeShomrimCalls");
    log("porch", { phase: "shomrim" });
    return true;
}
