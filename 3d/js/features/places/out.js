// features/places — BEING TAKEN THERE and WALKING OUT. The scenes stay what they were (law's booking, cell and
// courtroom, the ER's bedside comedy — sets, skippable as before); what changes is where they ARE and where she comes
// out: a real building in a real town, its front door, on foot, in control.
//
//   claim(kind)    at the arrest / the admission: which town's building ("here" in a town; on the highway the nearest
//                  interchange's town — Cruise, solo); null → the old highway flow
//   tick(dt)       every frame of the cell / court / the ER: builds that town in slices (no long frame later)
//   walkOut(opts)  the release: (into the town if she isn't there) → on foot at the door, her car at the kerb out front
//                  or (impounded) behind the impound lot's fence — a soft cut, never a black screen
//   state "placesArrive"  the cruiser pulls up at the town's precinct and she's walked up the steps (⏭)
import * as THREE from "three";
import { ctx, on, emit, registerState, setState } from "../../core/ctx.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { SKINS } from "../../car.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { person, lulu, walkTo, cuffs, disposeCuffs } from "../law/scene.js";
import { OUT_LINES } from "./data.js";
import { LAP } from "../../world.js";
import { BY_ID, copyS, nearest, hwSpot } from "./roadside.js";

const inTown = () => !!(ctx.town && ctx.town.active);
const party = () => !!(ctx.party && ctx.party.active);
/** The stay in progress: { kind: law | er, id (town), exitS, here (it happened in that town), built } | null. */
export const STAY = { place: null };

/** Can a town host this (its models loaded or loadable, attachable, the building data there)? */
function hosts(id) { const T = ctx.town && ctx.town.towns && ctx.town.towns[id]; return !!(T && T.uses && T.uses.civic && T.uses.hospital); }

/** Decide where she's taken (law | er). → the place, or null (the old flow: back on the highway). */
export function claim(kind = "law") {
    STAY.place = null;
    if (!ctx.town || !ctx.civic) return null;
    if (inTown()) {
        if (!hosts(ctx.town.id)) return null;
        STAY.place = { kind, id: ctx.town.id, exitS: ctx.town.debug && ctx.town.debug.S ? ctx.town.debug.S.exitS : null, here: true, attached: !!ctx.town.attached };
        return STAY.place;
    }
    // on the highway: the nearest interchange's town — only in a solo Cruise (a 🎉 party keeps the old flow: a warp into
    // a town would split her from her friends; Story / the Shabbos run have no towns)
    if (party() || !ctx.G || ctx.G.mode !== "cruise" || !ctx.town.prebuild) return null;
    // 🚔🚑 ci/roadside — THE rule: the nearest place of this kind ALONG THE LAP from where it happened, either way round,
    // the towns' buildings and the roadside ones alike (roadside.js nearest) — the same answer on every lap
    const n = nearest(kind), s = ctx.car.s;
    if (!n) return null;
    if (n.hw) {
        STAY.place = { kind, id: n.hw.id, hw: n.hw.id, s: copyS(n.hw, s), here: false };
        return STAY.place;
    }
    if (!hosts(n.town) || !ctx.town.exitOf) return null;
    // (that town's copy nearest her: its first exit after half a lap back)
    let exitS = null;
    try { exitS = ctx.town.exitOf(n.town, s - LAP / 2); } catch (e) { exitS = null; }
    if (exitS == null) return null;
    STAY.place = { kind, id: n.town, exitS, here: false };
    if (ctx.town.load) ctx.town.load(n.town);
    return STAY.place;
}
export function clear() { STAY.place = null; }

/** Per frame while she's in a set (the cell, court, the ER): build the town she'll walk out into, ~3 ms a frame. */
export function tick() {
    const P = STAY.place;
    if (!P || P.built || P.here || P.hw) return;
    try { P.built = !!ctx.town.prebuild(P.id, P.exitS, 3); } catch (e) { console.error("[places] prebuild", e); P.built = false; }
}
/** Can she walk out of the building right now (the town's there — or ready to step into — and the doors exist)? */
export function ready() {
    const P = STAY.place;
    if (!P) return false;
    if (P.here) return inTown() && ctx.town.id === P.id;
    if (P.hw) return !!BY_ID[P.hw];              // (a roadside place: code-built, there on every lap — walkOut builds its chunks)
    tick();
    return !!P.built;
}

// ── her impounded car, behind the lot's fence ────────────────────────────
const IMP = { obj: null, town: null };
export function showImpounded(on) {
    if (IMP.obj) { if (IMP.obj.parent) IMP.obj.parent.remove(IMP.obj); IMP.obj = null; IMP.town = null; }
    if (!on || !models.lulu) return;
    const sp = ctx.civic.spot("impound");
    if (!sp || sp.cx == null || !(inTown() || sp.car)) return;
    const sk = SKINS[ctx.car.skinKey] || SKINS.pink;
    const o = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
    for (const n of [...findNodes(o, "Driver"), ...findNodes(o, "Hair_")]) n.visible = false;
    if (sp.car) {
        // (a roadside yard — Trooper Post 13's, roadside.js: its own bay)
        o.position.set(sp.car.x, 0, sp.car.z); o.rotation.y = sp.car.h;
        ctx.scene.add(o);
        IMP.obj = o; IMP.town = null;
        return;
    }
    // (the lot's Anchor_car: its left bay, nose-in — model left = -X; the lot's local frame turns with the face)
    const a = models.places_impound ? findNodes(models.places_impound, "Anchor_car")[0] : null;
    const ax = a ? a.position.x : -1.5, az = a ? a.position.z : 3.0;
    const h = sp.rot;
    o.position.set(sp.cx + Math.cos(h) * ax + Math.sin(h) * az, 0, sp.cz - Math.sin(h) * ax + Math.cos(h) * az);
    o.rotation.y = h + Math.PI;
    ctx.scene.add(o);
    IMP.obj = o; IMP.town = ctx.town.id;
}
on("town:leave", () => showImpounded(false));
on("run:start", () => showImpounded(false));
on("title", () => showImpounded(false));
on("state", ({ to }) => { if (IMP.obj && (to === "playing" && ctx.foot && ctx.foot.ownCar !== "gone")) showImpounded(false); });
export const impoundedCar = () => IMP.obj;

/**
 * Out of the building's front door: door = precinct | court | hospital; car = her own car is waiting (parked at the
 * kerb out front) — else she walks (impounded / wrecked / a ride that wasn't hers: her own car sits behind the impound
 * lot's fence when the law has it); reason = foot's start reason (copWalk | jailbreak | discharged); line = her first
 * bubble. → true (she's out), false (no building to come out of: the caller does the old thing).
 */
export function walkOut({ door = "precinct", car = false, reason = "copWalk", line = "", impound = false, soft = true, side = 0 } = {}) {
    const P = STAY.place;
    if (!P || !ctx.foot || !ctx.foot.start) return false;
    const swap = () => {
        if (P.hw) {
            // a roadside place (roadside.js): out on the highway at its copy on THIS lap — its chunks built under the cut
            if (inTown()) ctx.town.leave("reset");
            if (ctx.world.prebuild) ctx.world.prebuild(P.s);
        } else if (!inTown() || ctx.town.id !== P.id) {
            if (inTown()) ctx.town.leave("reset");
            if (!ctx.town.enter({ town: P.id, exitS: P.exitS, speed: 0 })) return false;
        }
        // (by P, not STAY: a dissolve runs this after STAY.place is cleared)
        const sp = P.hw ? hwSpot(door, P) : ctx.civic.spot(door);
        if (!sp) return false;
        // (a walk that was suspended by the scene — she was on foot when it began — ends first: ending it puts the car
        //  anchor back where her old parked car was, and her car is about to be somewhere else)
        if (ctx.foot.active) ctx.foot.end("places");
        const c = ctx.car, face = Math.atan2(sp.nx, sp.nz);           // (out toward the street)
        // she steps out onto the sidewalk just in front of the steps (the lot line is solid: 1 m out from it)
        // (side: partners walking out together stand side by side along the sidewalk — law/crew.js doorSide)
        const at = { x: sp.x - sp.nx * 1.5 - sp.nz * side, z: sp.z - sp.nz * 1.5 + sp.nx * side };
        if (car) {
            // her car at the kerb right out front — the stretch in front of each civic building is kept clear of parked
            // cars (the town data's clearParking: POLICE / AMBULANCE ONLY) — facing the way the traffic on that side goes
            const k = sp.kerbAt ? sp.kerbAt(5 + side * 4) : kerbAt(sp, 5 + side * 4);      // (partners' cars one behind the other; a roadside place: its stalls)
            c.place(k.x, k.z, k.h); c.s = k.s; c.d = k.d;
        } else {
            const n = ctx.world.road.nearest(at.x, at.z, c.s, {});
            c.place(at.x, at.z, face); c.s = n.s; c.d = n.d;
        }
        c.vx = c.vz = c.vF = 0;
        const say = line || (car ? OUT_LINES[door][Math.floor(Math.random() * OUT_LINES[door].length)] : "");
        const ok = ctx.foot.start(car ? "droveOff" : reason, { at, face, noIntro: true, drivable: !!car, line: say || undefined }) !== false;
        if (!ok) return false;
        if (ctx.cam && ctx.cam.free) ctx.cam.free.yaw = face + Math.PI;     // (looking at her from the street side… then the door behind her)
        if (!car && impound) showImpounded(true);
        emit("places:out", { kind: P.kind, door, town: P.hw ? null : P.id, hw: P.hw || null, car: !!car, here: !!P.here });
        emit("stat", { id: "placesWalkOuts", n: 1 });
        return true;
    };
    let ok = false;
    try { ok = soft && ctx.dissolve && !ctx.skipping ? ctx.dissolve(swap) : swap(); } catch (e) { console.error("[places] walkOut", e); ok = false; }
    STAY.place = null;
    return !!ok;
}

/** The parking lane in front of a door spot, `ahead` m along the street: { x, z, h (with the traffic on that side), s, d }. */
export function kerbAt(sp, ahead = 0) {
    const rd = ctx.world.road, n = rd.nearest(sp.x, sp.z, ctx.car.s, {}), side = Math.sign(n.d) || 1;
    const pd = (n.street && n.street.parkLane && n.street.park) || 4.7;
    const s = n.s + side * ahead, p = rd.point(s, side * pd, {});
    return { x: p.x, z: p.z, h: p.h + (side > 0 ? 0 : Math.PI), s, d: side * pd };
}

// ── arriving at the precinct (an arrest in town): the cruiser pulls up, she's walked up the steps ──
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
let AR = null;
registerState("placesArrive", {
    hud: false, touch: false, pausable: true, world: true, skip: true,
    enter(data) {
        const sp = ctx.civic.spot("precinct");
        AR = { data, t: 0, sp, phase: "drive", walkers: [], cruiser: null, lulu: null, cop: null, cf: null, done: false };
        if (!sp) { finishArrive(); return; }
        const kerb = kerbAt(sp, -3);
        // the cruiser rolls the last stretch up to the kerb, along the street (its own clone: no traffic car, nothing to collide)
        const cr = models.cop ? cloneWithColors(models.cop) : new THREE.Group();
        AR.lit = [];
        cr.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { o.material = o.material.clone(); AR.lit.push(o.material); } });
        AR.h = kerb.h;                                  // (it drives with the traffic on her side of the street)
        AR.stop = new THREE.Vector3(kerb.x, 0, kerb.z);
        AR.from = new THREE.Vector3(kerb.x - Math.sin(AR.h) * 22, 0, kerb.z - Math.cos(AR.h) * 22);
        cr.position.copy(AR.from); cr.rotation.y = AR.h;
        ctx.scene.add(cr);
        AR.cruiser = cr;
        AR.door = new THREE.Vector3(sp.x - sp.nx * 1.4, 0, sp.z - sp.nz * 1.4);
        // (the car anchor — the world's streaming, the sun's shadow box — comes along to the precinct, hidden)
        ctx.car.place(kerb.x, kerb.z, kerb.h); ctx.car.s = kerb.s; ctx.car.d = kerb.d; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0;
        ctx.car.obj.visible = false;
        if (ctx.foot && ctx.foot.active && ctx.foot.obj) ctx.foot.obj.visible = false;
        // (another place: a CUT to the precinct's shot — easing there from the arrest swooped the camera hundreds of
        //  metres across town, through the houses)
        if (ctx.cam) ctx.cam.snap();
        A.setMusic(null);
        emit("places:arrive", { town: ctx.town && ctx.town.id });
    },
    exit() {
        if (!AR) return;
        for (const o of [AR.cruiser, AR.lulu && AR.lulu.obj, AR.cop && AR.cop.obj]) if (o && o.parent) o.parent.remove(o);
        if (AR.cf) disposeCuffs(AR.cf);
        AR = null;
    },
    update(dt) {
        if (!AR || AR.done) return;
        AR.t += dt;
        for (const m of AR.lit || []) m.emissiveIntensity = Math.sin(AR.t * 12 + (m.name.includes("Blue") ? Math.PI : 0)) > 0 ? 6 : 0.4;
        if (AR.phase === "drive") {
            const k = Math.min(1, AR.t / 2.2), e = 1 - (1 - k) * (1 - k);
            AR.cruiser.position.lerpVectors(AR.from, AR.stop, e);
            if (k >= 1) {
                AR.phase = "walk";
                const h = AR.h, side = (x, z, off) => new THREE.Vector3(x + Math.cos(h) * off, 0, z - Math.sin(h) * off);
                const toDoor = Math.sign((AR.door.x - AR.stop.x) * Math.cos(h) - (AR.door.z - AR.stop.z) * Math.sin(h)) || 1;
                const out = side(AR.stop.x, AR.stop.z, toDoor * 1.3);
                AR.lulu = lulu(false); AR.lulu.obj.position.copy(out);
                AR.cop = person("copPerson", null, "npcMan"); AR.cop.obj.position.copy(out).add(_a.set(Math.sin(h) * 1.0, 0, Math.cos(h) * 1.0));
                AR.cf = cuffs(); AR.lulu.obj.add(AR.cf); AR.cf.position.set(0, 0.86, 0.2);
                ctx.scene.add(AR.lulu.obj, AR.cop.obj);
                AR.walkers = [{ p: AR.lulu, x: AR.door.x, z: AR.door.z, speed: 1.5 },
                    { p: AR.cop, x: AR.door.x + Math.sin(h) * 0.8, z: AR.door.z + Math.cos(h) * 0.8, speed: 1.5 }];
                AR.walkT = 0;
            }
        } else if (AR.phase === "walk") {
            AR.walkT += dt;
            for (const w of AR.walkers) if (!w.done && walkTo(w.p, w.x, w.z, w.speed, dt)) w.done = true; else if (w.done) w.p.update(dt, {});
            if (AR.walkers.every(w => w.done) || AR.walkT > 7) { AR.phase = "in"; AR.inT = 0; }
        } else if (AR.phase === "in") {
            AR.inT += dt;
            for (const w of AR.walkers) w.p.update(dt, {});
            if (AR.inT > 0.6) finishArrive();
        }
    },
    camera(dt) {
        if (!AR || !AR.sp) return true;
        const sp = AR.sp;
        _a.set(sp.x + sp.nx * 15 + sp.ux * 7, 3.4, sp.z + sp.nz * 15 + sp.uz * 7);
        const f = AR.lulu ? AR.lulu.obj.position : AR.cruiser.position;
        _b.set((f.x + sp.x) / 2, 1.7, (f.z + sp.z) / 2);
        ctx.cam.cinematic(_a, _b, dt, 2.2, 48);
        return true;
    },
    onSkip() { finishArrive(); },
});
function finishArrive() {
    if (!AR || AR.done) return;
    AR.done = true;
    const d = AR.data || {};
    // through the doors: a soft cut into booking (the jail set) — no ext set, no black
    const go = () => setState("lawJail", { charges: d.charges, arrive: false, sResume: d.sResume, placed: true });
    if (ctx.dissolve && !ctx.skipping) ctx.dissolve(go); else go();
}
/** Into the arrival beat (law's arrest in a town, after the cuffs): → bool */
export function arrive(data) {
    if (!inTown() || !ctx.civic.spot("precinct")) return false;
    ensureModels(["copPerson"]).catch(() => {});
    const go = () => setState("placesArrive", data);
    if (ctx.dissolve && !ctx.skipping) ctx.dissolve(go); else go();
    return true;
}
