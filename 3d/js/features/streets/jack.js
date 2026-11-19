// features/streets — 🚗 CARJACK ANYTHING + 🤸 BAIL OUT.
//
// On foot, ✕ / E / ✋ next to a traffic car that's stopped or crawling (or one that
// braked because she stepped in front of it): Lulu yanks the door, the driver
// tumbles out (sees stars, gets up ANGRY: shakes a fist, yells, chases a few steps
// or calls the cops), she slides in, the door slams — ONE continuous animation —
// and she drives off in THAT vehicle (foot's borrowed-vehicle shell), with handling
// to match: the box truck is a slug, the minivan floats, the sports car is a rocket
// on a hair trigger. Only a cop who SEES it (close, clear line of sight) gives chase (a cop car: two stars,
// always); a driver who phones it in puts out a call-in (law's BOLO: a cruiser comes looking, later); nobody
// watching → nothing, and the cops lose her old car's description.
//
// Bail out of a moving car (hold △ / Y, E above ~30 mph, or the ✋ BAIL touch button):
// she dives out the driver's door, tucks and rolls, and gets up on foot while the
// car coasts on without her (and plows into whatever's ahead).
import * as THREE from "three";
import { ctx, on, hook, emit, addActor, wrapAngle } from "../../core/ctx.js";
import { save3d, saveSoon } from "../../core/save.js";
import { CAMS } from "../../core/camera.js";
import { spawnPerson } from "../../core/people.js";
import { input, glyph, glyphSet, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { models, need, live, partyOn, clamp, lerp, rand, pick, smooth, easeOut, backOut, left, fwd, luluSays, npcSays, crime, phoneIn, toast, stat, sfx, dizzyStars, spinStars } from "./common.js";
import * as T from "./lines.js";

// ── what can be jacked, and how it drives ────────────────────────────────
// door: half-width to the door skin, fwd = door centre along the car, len, y range; seat = where the driver sits
export const RIDES = {
    sedan: { model: "sedan", label: "🚗 CARJACK", vtype: "car", feel: "plain", half: 0.92, fwd: 0.2, len: 1.05, y: [0.42, 0.98],
        handling: { top: 1.0, acc: 0.95, grip: 1.0, brake: 1.0 } },
    van: { model: "van", label: "🚐 JACK THE MINIVAN", vtype: "car", feel: "floaty", half: 0.99, fwd: 0.75, len: 1.0, y: [0.45, 1.15],
        handling: { top: 0.9, acc: 0.85, grip: 0.8, brake: 0.85 } },
    truck: { model: "truck", label: "🚚 JACK THE BOX TRUCK", vtype: "car", feel: "heavy", half: 1.12, fwd: 2.75, len: 1.0, y: [0.8, 1.95],
        handling: { top: 0.72, acc: 0.55, grip: 0.85, brake: 0.62 } },
    cop: { model: "cop", label: "🚓 JACK THE COP CAR", vtype: "cop", feel: "plain", half: 0.92, fwd: 0.2, len: 1.05, y: [0.42, 0.98], paint: "CopPaint",
        handling: { top: 1.12, acc: 1.12, grip: 1.12, brake: 1.15 } },
    streets_sports: { model: "streets_sports", label: "🏎️ JACK THE SPORTS CAR", vtype: "car", feel: "twitchy", half: 0.95, fwd: -0.1, len: 1.2, y: [0.34, 0.8],
        handling: { top: 1.32, acc: 1.45, grip: 0.92, brake: 1.2 } },
};
export const BIG_CAM = { truck: { d: 3.4, h: 1.5 }, foot_bus: { d: 4.2, h: 1.9 }, foot_ambulance: { d: 1.2, h: 0.6 }, van: { d: 0.6, h: 0.3 }, foot_dozer: { d: 0.8, h: 0.6 } };
export const force = {};      // tests: { reaction: "fist" | "yell" | "chase" | "call" }
export const J = { active: null, jacks: 0, bails: 0, lastRide: null };

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _land = new THREE.Vector3();
const _o = {}, _n = {}, _q = new THREE.Quaternion(), _e = new THREE.Euler();
const PEOPLE = ["npcMan", "npcWoman"];
const TOPS = ["#81C784", "#4FC3F7", "#FFB74D", "#F06292", "#9575CD", "#FFFFFF", "#E57373", "#4DB6AC", "#FFD54F"];
const BOTTOMS = ["#37474F", "#283593", "#212121", "#5D4037", "#1565C0", "#455A64"];
const HAIRS = ["#4E342E", "#3E2723", "#1A1A1A", "#8D6E63", "#D7B56D", "#BDBDBD"];

/** car-local (x = left, y = up, z = forward) → world, for a traffic car `c`. */
function local(c, x, y, z, out = _v) {
    const f = fwd(c.h), l = left(c.h);
    return out.set(c.x + l.x * x + f.x * z, y, c.z + l.z * x + f.z * z);
}

// ── candidates ───────────────────────────────────────────────────────────
export function jackable(c) {
    // a 🎉 party's shared traffic never stops for anyone: she jacks it on the move (it brakes for her on HER screen
    // only once it's hers — ctx.party.claimTraffic takes it out of everyone's traffic first)
    if (c && c.data && c.data.party) return partyOn() && !c.hit && !c.data.owTown && !!RIDES[c.kind];
    // (a shared car she CLAIMED in a party — features/party — is parked for her; a town loop car's is free-placed)
    const claimed = !!(c && c.data && c.data.partyClaim);
    if (!c || c.hit || (c.free && !claimed) || (c.ai && !(c.data && c.data.streetsHold)) || !RIDES[c.kind]) return false;
    if (c.data && (c.data.footStub || c.data.streetsJack)) return false;
    if (c.data && c.data.law && c.data.law.mode !== "patrol") return false;    // a pursuing cruiser won't stop for her
    return c.speed < 4.5;
}
function doorSpot(c, out = _w) {
    const R = RIDES[c.kind];
    return local(c, R.half + 0.62, 0, R.fwd - 0.15, out);
}
let cand = null;
export function nearestCandidate() {
    if (!ctx.foot || !ctx.foot.pos || J.active) return null;
    const p = ctx.foot.pos;
    let best = null, bd = 3.4;
    for (const c of ctx.traffic.cars) {
        if (Math.abs(c.x - p.x) > 9 || Math.abs(c.z - p.z) > 9 || !jackable(c)) continue;
        const d = doorSpot(c, _a);
        const dist = Math.hypot(d.x - p.x, d.z - p.z);
        if (dist < bd) { bd = dist; best = c; }
    }
    return best;
}
/** The foot interaction spot (registered in index.js through ctx.foot.addSpot). */
export const jackSpot = {
    r: 3.4, short: "JACK",
    pos() {
        cand = live() || partyOn() || force.jack ? nearestCandidate() : null;
        if (!cand) return null;
        const d = doorSpot(cand, _b);
        return { x: d.x, z: d.z };
    },
    label() { return cand ? RIDES[cand.kind].label : null; },
    act() { if (cand) startJack(cand); },
};

// ── the jack: one continuous animation, game-time based ──────────────────
const doorGeo = new THREE.BoxGeometry(0.07, 1, 1);
const phoneGeo = new THREE.BoxGeometry(0.07, 0.16, 0.04);
const phoneMat = new THREE.MeshStandardMaterial({ color: "#212121", roughness: 0.4 });

function paintOf(c, name = "Paint") {
    let m = null;
    c.obj.traverse(o => { if (!m && o.isMesh && o.material && o.material.name === name) m = o.material; });
    return m;
}
function makeDoor(c) {
    const R = RIDES[c.kind];
    const mat = paintOf(c, R.paint || "Paint") || paintOf(c, "Paint") || phoneMat;
    const pivot = new THREE.Group();
    const h = R.y[1] - R.y[0];
    pivot.position.set(R.half + 0.02, (R.y[0] + R.y[1]) / 2, R.fwd + R.len / 2);
    const slab = new THREE.Mesh(doorGeo, mat);
    slab.scale.set(1, h, R.len);
    slab.position.set(0.035, 0, -R.len / 2);
    slab.castShadow = true;
    pivot.add(slab);
    c.obj.add(pivot);
    return pivot;
}
function spawnVictim(c) {
    const key = c.kind === "cop" ? (models.copPerson ? "copPerson" : null) : pick(PEOPLE.filter(k => models[k]));
    if (!key || !models[key]) return null;
    const colors = key === "copPerson" ? null : { Top: pick(TOPS), Bottom: pick(BOTTOMS), Hair: pick(HAIRS) };
    const p = spawnPerson(key, { colors });
    p.look = { key, colors };              // remembered (streets:carjack → features/memory's grudges)
    p.obj.rotation.order = "YXZ";
    p.obj.visible = false;
    ctx.scene.add(p.obj);
    return p;
}

export function startJack(c) {
    const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F;
    if (!F || J.active) return false;
    const R = RIDES[c.kind];
    // a party's shared car: out of everyone's traffic first (a poof on friends' screens; hers from now on)
    if (c.data && (c.data.party || c.data.partyClaim) && !(ctx.party && ctx.party.claimTraffic && ctx.party.claimTraffic(c))) return false;
    // the car stops where it is (it was already crawling or waiting for her)
    c.data.streetsJack = true;
    c.keep = true; c.noNearMiss = true;
    c.ai = (dt, cc) => { cc.speed = Math.max(0, cc.speed - 16 * dt); cc.s += cc.speed * cc.dir * dt; };
    const lulu = F.lulu;
    const jk = { c, R, t: 0, phase: "approach", lulu, door: makeDoor(c), victim: spawnVictim(c), from: F.pos.clone(), said: false, yelp: false, done: false,
        landed: false, witnessed: false, cop: c.kind === "cop" };
    J.active = jk;
    need(PEOPLE).catch(() => {});
    ctx.foot.script({
        update: (dt, P, Fx) => updateJack(jk, dt, Fx),
        camera: dt => jackCamera(jk, dt),
        abort: why => { if (!jk.done) cancelJack(jk); },
    });
    sfx.whoosh();
    rumble(0.2, 0.3, 120);
    return true;
}

const D_APPROACH = 0.55, D_OPEN = 0.2, D_YANK = 0.55, D_IN = 0.38, D_SLAM = 0.16;
function updateJack(jk, dt, F) {
    const c = jk.c, R = jk.R, L1 = jk.lulu, o = L1.obj;
    if (!ctx.traffic.cars.includes(c) || c.hit) { cancelJack(jk); return false; }
    jk.t += dt;
    const spot = doorSpot(c, _a);
    const seat = local(c, R.half - 0.42, 0, R.fwd - 0.15, _b);
    const yaw = c.h;
    if (jk.phase === "approach") {
        const k = smooth(jk.t / D_APPROACH);
        F.pos.lerpVectors(jk.from, spot, k);
        o.position.set(F.pos.x, 0.05, F.pos.z);
        if (k < 0.85) L1.face(spot.x + (spot.x - jk.from.x), spot.z + (spot.z - jk.from.z), dt, 12);
        else L1.face(seat.x, seat.z, dt, 12);
        L1.update(dt, { walk: jk.from.distanceTo(spot) > 0.4 ? 5.5 * (1 - k) + 1 : 0 });
        if (jk.t >= D_APPROACH) { jk.phase = "open"; jk.t = 0; sfx.door(); }
    } else if (jk.phase === "open") {
        jk.door.rotation.y = -1.25 * backOut(jk.t / D_OPEN);
        F.pos.copy(spot); o.position.set(spot.x, 0.05, spot.z);
        L1.face(seat.x, seat.z, dt, 12);
        L1.update(dt, { point: true });
        if (jk.victim) { jk.victim.obj.visible = true; placeSeated(jk, seat, yaw, dt); }
        if (jk.t >= D_OPEN) { jk.phase = "yank"; jk.t = 0; sfx.yank(); rumble(0.4, 0.4, 160, true); }
    } else if (jk.phase === "yank") {
        const k = jk.t / D_YANK;
        // Lulu heaves back half a step and swings the driver out
        local(c, R.half + 0.62 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35, 0, R.fwd - 0.15, _w);
        F.pos.copy(_w); o.position.set(_w.x, 0.05, _w.z);
        L1.update(dt, { cheer: k > 0.25 && k < 0.7, point: k <= 0.25 });
        if (!jk.said && k > 0.2) { jk.said = true; luluSays(pick(jk.cop ? T.JACK_COP_LULU : T.JACK_LULU), true); }
        if (jk.victim) flyVictim(jk, k, seat, yaw, dt);
        if (jk.t >= D_YANK) {
            jk.phase = "in"; jk.t = 0; jk.inFrom = F.pos.clone();
            if (jk.victim) landVictim(jk);
        }
    } else if (jk.phase === "in") {
        const k = smooth(jk.t / D_IN);
        F.pos.lerpVectors(jk.inFrom, seat, k);
        o.position.set(F.pos.x, 0.05 + Math.sin(k * Math.PI) * 0.18 + k * 0.1, F.pos.z);
        o.rotation.y += wrapAngle(yaw - o.rotation.y) * Math.min(1, dt * 14);
        L1.update(dt, { sit: k > 0.5 });
        if (jk.victim) jk.victim.update(dt, {});
        if (jk.t >= D_IN) { jk.phase = "slam"; jk.t = 0; o.visible = false; }
    } else if (jk.phase === "slam") {
        jk.door.rotation.y = -1.25 * (1 - smooth(jk.t / D_SLAM));
        if (jk.t >= D_SLAM) { sfx.slam(); finishJack(jk); return false; }
    }
    if (jk.victim && jk.phase !== "yank" && jk.phase !== "approach" && jk.phase !== "open") spinStars(jk.stars, dt, 0);
    return true;
}
function placeSeated(jk, seat, yaw, dt) {
    const v = jk.victim.obj;
    v.position.set(seat.x, 0.12, seat.z);
    v.rotation.set(0, yaw, 0);
    jk.victim.update(dt, { sit: true });
}
function flyVictim(jk, k, seat, yaw, dt) {
    const c = jk.c, R = jk.R, v = jk.victim.obj;
    // an arc out of the door: up and over, tumbling backwards, landing on their back ~2.4 m out
    const land = local(c, R.half + 2.5, 0, R.fwd - 0.7, _land);
    const e = easeOut(k);
    v.position.set(lerp(seat.x, land.x, e), 0.12 + Math.sin(Math.PI * k) * 0.9 * (1 - k * 0.35), lerp(seat.z, land.z, e));
    v.rotation.set(-Math.PI / 2 * smooth(k * 1.2), yaw + Math.PI / 2 + Math.sin(k * 9) * 0.25 * (1 - k), Math.sin(k * 11) * 0.2 * (1 - k));
    jk.victim.update(dt, { cheer: true });
    if (!jk.yelp && k > 0.1) { jk.yelp = true; npcSays(v, pick(T.JACK_YELP), { always: true }); }
}
function landVictim(jk) {
    const v = jk.victim.obj;
    v.position.y = 0.05;
    sfx.thud();
    ctx.car.fx.burst(v.position.x, 0.3, v.position.z, 10, 2.2, [0.72, 0.68, 0.6], 0.8, 0.7);
    jk.stars = dizzyStars();
    ctx.scene.add(jk.stars);
    v.updateMatrixWorld();
    _v.set(0, 1.45, 0);
    v.localToWorld(_v);
    jk.stars.position.set(_v.x, 0.32, _v.z);                 // round the dizzy head
    jk.landed = true;
}
function cancelJack(jk) {
    if (jk.done) return;
    jk.done = true;
    J.active = null;
    const c = jk.c;
    if (jk.door && jk.door.parent) jk.door.parent.remove(jk.door);
    if (c && ctx.traffic.cars.includes(c)) { c.ai = null; c.keep = false; c.data.streetsJack = false; }
    if (jk.lulu && jk.lulu.obj) { jk.lulu.obj.visible = true; jk.lulu.obj.rotation.x = 0; }
    if (jk.victim) {
        if (jk.landed) victimActor(jk.victim, jk.stars, null, c && c.kind === "cop");   // they're already out: let them be angry
        else ctx.scene.remove(jk.victim.obj);
    }
}

function finishJack(jk) {
    jk.done = true;
    J.active = null;
    const c = jk.c, R = jk.R;
    if (jk.door.parent) jk.door.parent.remove(jk.door);
    let colors = null;
    const pm = paintOf(c, "Paint");
    if (pm && R.model !== "cop") colors = { Paint: "#" + pm.color.getHexString() };
    const v = { vtype: R.vtype, key: R.model, colors, x: c.x, z: c.z, h: c.h, how: "jack", handling: R.handling };
    const where = { x: c.x, z: c.z };
    ctx.traffic.remove(c);
    ctx.foot.drive(v);
    const shell = ctx.foot.shellObj;
    const ride = { kind: c.kind, R, color: colors && colors.Paint, t: 0, ls: 0, roll: 0, rollV: 0, victim: null, called: false };
    if (shell) shell.userData.streetsRide = ride;
    J.jacks++;
    J.lastRide = ride;
    stat("carjacks", 1);
    if (jk.victim) ride.victim = victimActor(jk.victim, jk.stars, ride, jk.cop);
    // seen by a cop? (a cop car is ALWAYS a crime — its owner is right there)
    const seen = jk.cop ? (ctx.law ? (ctx.law.startChase("CARJACKING A POLICE CRUISER", { msg: "🚨 YOU JACKED A COP CAR?!", heat: 2 }), true) : false)
        : crime("CARJACKING", where.x, where.z, { msg: "🚨 CARJACKING — A COP SAW THAT!" });
    emit("streets:carjack", { kind: c.kind, model: R.model, color: ride.color, x: where.x, z: where.z, witnessed: !!seen, driver: jk.victim ? jk.victim.look : null });
    // no blinking "shield" on a car she just took (it's standing still), one card says how it drives
    ctx.G.invT = 0;
    H.banner(`<b>🚗 CARJACKED!</b><small>${T.RIDE_HINT[c.kind] || ""}${!S.hinted ? ` · ${bailHint()} to bail out` : ""}</small>`, 2800, { key: "streets:ride" });
    S.hinted = true;

    familyText();
}
const S = { hinted: false };
export function bailHint() {
    if (input.device === "touch") return "✋ BAIL";
    if (input.device === "gamepad") return `hold ${glyph("camera")}`;
    return `${glyph("interact")} at speed`;
}
let famT = -1;
function familyText() {
    if (!live() || famT >= 0 || Math.random() > 0.4 || !ctx.phone || !ctx.phone.text) return;
    famT = 7 + Math.random() * 6;
}

// ── the yanked driver: dizzy, up, ANGRY (and never in harm's way) ────────
function victimActor(p, stars, ride, isCop) {
    const o = p.obj;
    const r = force.reaction || (isCop ? "yell" : pick(["fist", "fist", "yell", "yell", "chase", "chase", "call"]));
    const V = { p, stars, ride, r, t: 0, phase: "down", dive: null, said: false, s: 0, gone: false, called: false };
    const phone = r === "call" ? new THREE.Mesh(phoneGeo, phoneMat) : null;
    if (phone && p.limbs.Arm_R) { phone.position.set(0, -0.55, 0.06); p.limbs.Arm_R.add(phone); }
    addActor({
        foot: true,
        update(dt) {
            V.t += dt;
            const car = ctx.car, onFoot = ctx.foot && ctx.foot.active;
            const tgt = onFoot && ctx.foot.pos ? ctx.foot.pos : car.pos;
            dodge(V, dt);
            if (V.dive) { updateDive(V, dt); return true; }
            if (V.phase === "down") {
                o.rotation.x = -Math.PI / 2;
                p.update(dt, {});
                if (stars) { stars.visible = true; o.updateMatrixWorld(); _v.set(0, 1.45, 0); o.localToWorld(_v); stars.position.set(_v.x, 0.32, _v.z); spinStars(stars, dt, 0); }
                if (V.t > 1.15) { V.phase = "up"; V.t0 = V.t; }
            } else if (V.phase === "up") {
                const k = easeOut((V.t - V.t0) / 0.5);
                o.rotation.x = lerp(-Math.PI / 2, 0, k);
                o.rotation.z = Math.sin(k * 8) * 0.08 * (1 - k);
                p.face(tgt.x, tgt.z, dt, 6);
                p.update(dt, {});
                if (stars) { stars.visible = k < 0.6; o.updateMatrixWorld(); _v.set(0, 1.5, 0); o.localToWorld(_v); stars.position.copy(_v); spinStars(stars, dt, 0.15); }
                if (k >= 1) { V.phase = "react"; V.t0 = V.t; if (stars) { stars.visible = false; } }
            } else if (V.phase === "react") {
                react(V, dt, tgt, isCop);
                if (V.t - V.t0 > 5.2) { V.phase = "leave"; V.t0 = V.t; }
            } else {
                // off to the sidewalk, muttering (standing up straight again)
                o.rotation.x += (0 - o.rotation.x) * Math.min(1, dt * 6);
                const near = ctx.world.road.nearest(o.position.x, o.position.z, car.s, _n);
                const side = Math.sign(near.d || 1);
                const want = side * 10.2;
                if (Math.abs(near.d - want) > 0.3) {
                    pt2(near.s, near.d + Math.sign(want - near.d) * Math.min(Math.abs(want - near.d), 2.4 * dt), _w);
                    p.face(_w.x + (_w.x - o.position.x) * 10, _w.z + (_w.z - o.position.z) * 10, dt, 8);
                    o.position.set(_w.x, 0.05, _w.z);
                    p.update(dt, { walk: 2.4 });
                } else { p.face(tgt.x, tgt.z, dt, 3); p.update(dt, { talk: Math.sin(V.t * 2) > 0.5 }); }
            }
            holdTraffic(o);
            // gone once she's well away (never popping out in front of her)
            const dist = Math.hypot(o.position.x - car.pos.x, o.position.z - car.pos.z);
            return !(dist > 150 || (V.t > 22 && dist > 60));
        },
        dispose() {
            ctx.scene.remove(o);
            if (stars) ctx.scene.remove(stars);
            if (phone && phone.parent) phone.parent.remove(phone);
        },
    });
    return V;
}
function pt2(s, d, out) { const q = ctx.world.road.point(s, d, _o); return out.set(q.x, 0, q.z); }

function react(V, dt, tgt, isCop) {
    const p = V.p, o = p.obj, rt = V.t - V.t0;
    if (!V.said) {
        V.said = true;
        const pool = isCop ? T.JACK_COP_VICTIM : T.VICTIM[V.r];
        npcSays(o, pick(pool), { always: true });
    }
    if (V.r === "chase" && rt < 2.4) {
        // a few steps after the car… then hands on knees
        const dx = tgt.x - o.position.x, dz = tgt.z - o.position.z, dist = Math.hypot(dx, dz);
        if (dist > 3) { const k = Math.min(dist - 3, 5.2 * dt) / dist; o.position.x += dx * k; o.position.z += dz * k; }
        p.face(tgt.x, tgt.z, dt, 8);
        p.update(dt, { walk: 5.2, point: Math.sin(rt * 6) > 0 });
        return;
    }
    p.face(tgt.x, tgt.z, dt, 5);
    if (V.r === "chase") {           // out of breath
        o.rotation.x += (0.35 - o.rotation.x) * Math.min(1, dt * 6);
        p.update(dt, {});
        return;
    }
    o.rotation.x += (0 - o.rotation.x) * Math.min(1, dt * 6);
    p.update(dt, { talk: true, cheer: V.r === "yell" && Math.sin(rt * 7) > -0.2 });
    const arm = p.limbs.Arm_R;
    if (arm && (V.r === "fist" || V.r === "call")) {
        // a shaking fist, or the phone to the ear
        if (V.r === "fist") _e.set(-2.5 + Math.sin(rt * 17) * 0.3, 0, -0.25); else _e.set(-2.3, 0, -1.25);
        arm.quaternion.copy(arm.userData.base).multiply(_q.setFromEuler(_e));
    }
    if (V.r === "call" && !V.called && rt > 2.6) {
        V.called = true;
        // it only matters if she's still in THEIR car
        const ride = currentRide();
        if (ride && ride === V.ride) phoneIn("GRAND THEFT AUTO", o.position.x, o.position.z, { msg: "📞 THE DRIVER CALLED IT IN!" });
    }
}
/** Pedestrians ALWAYS dive out of the way (Lulu's car, the coasting car she bailed from). */
function dodge(V, dt) {
    if (V.dive || V.phase === "down") return;
    const o = V.p.obj;
    for (const c of threatsTo(o)) {
        const dx = o.position.x - c.x, dz = o.position.z - c.z;
        const d = Math.hypot(dx, dz);
        const vx = c.vx, vz = c.vz, sp = Math.hypot(vx, vz);
        if (sp < 3 || d > 10) continue;
        if ((dx * vx + dz * vz) / (d * sp) < 0.55) continue;           // not heading at them
        // dive perpendicular to the car's path, away from it
        const px = -vz / sp, pz = vx / sp, side = Math.sign(dx * px + dz * pz) || 1;
        V.dive = { t: 0, vx: px * side * 6.5, vz: pz * side * 6.5, yaw: Math.atan2(px * side, pz * side), from: o.rotation.x };
        npcSays(o, pick(["WHOA!", "AAAH!", "Watch it, lady!", "NOT TODAY!"]), { always: true });
        sfx.whoosh();
        return;
    }
}
function threatsTo(o) {
    const out = [];
    if (ctx.state === "playing" && !(ctx.foot && ctx.foot.active)) out.push({ x: ctx.car.pos.x, z: ctx.car.pos.z, vx: ctx.car.vx, vz: ctx.car.vz });
    for (const c of ctx.traffic.cars) {
        if (Math.abs(c.x - o.position.x) > 14 || Math.abs(c.z - o.position.z) > 14) continue;
        const sp = c.hit ? Math.hypot(c.vx, c.vz) : c.speed;
        out.push({ x: c.x, z: c.z, vx: c.hit ? c.vx : Math.sin(c.h) * sp, vz: c.hit ? c.vz : Math.cos(c.h) * sp });
    }
    return out;
}
function updateDive(V, dt) {
    const dv = V.dive, p = V.p, o = p.obj;
    dv.t += dt;
    if (dv.t < 0.55) {
        const k = dv.t / 0.55;
        o.position.x += dv.vx * dt * (1 - k * 0.5); o.position.z += dv.vz * dt * (1 - k * 0.5);
        o.position.y = 0.05 + Math.sin(Math.PI * k) * 0.7;
        o.rotation.y += wrapAngle(dv.yaw - o.rotation.y) * Math.min(1, dt * 14);
        o.rotation.x = lerp(dv.from, Math.PI / 2, smooth(k * 1.3));            // superman dive onto the belly
        p.update(dt, { cheer: true });
    } else if (dv.t < 1.25) {
        o.position.y = 0.05;
        o.rotation.x = Math.PI / 2;
        p.update(dt, {});
    } else {
        const k = easeOut((dv.t - 1.25) / 0.45);
        o.rotation.x = lerp(Math.PI / 2, 0, k);
        p.update(dt, {});
        if (k >= 1) { V.dive = null; if (V.phase === "down" || V.phase === "up") V.phase = "react"; V.t0 = V.t; }
    }
}
/** Cars coming down the lane slow for someone standing in it. */
function holdTraffic(o) {
    const near = ctx.world.road.nearest(o.position.x, o.position.z, ctx.car.s, _n);
    if (Math.abs(near.d) > 7.6) return;
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.ai || Math.abs(c.d - near.d) > 2.2) continue;
        const g = (near.s - c.s) * c.dir;
        if (g > 0 && g < 40) c.want = Math.min(c.want, Math.max(0, (g - 8) * 0.6));
    }
}

// ── riding a jacked vehicle: handling feel + a camera that fits it ───────
export function currentRide() {
    const so = ctx.foot && ctx.foot.shellObj;
    return so && so.userData.streetsRide || null;
}
hook("controls", (ctl, dt) => {
    const R = currentRide();
    if (!R) return;
    const feel = R.R.feel;
    if (feel === "twitchy") ctl.steer = clamp(ctl.steer * 1.3, -1, 1);
    else if (feel === "floaty" || feel === "heavy") {
        R.ls += (ctl.steer - R.ls) * Math.min(1, dt * (feel === "heavy" ? 2.6 : 3.4));
        ctl.steer = R.ls;
    }
}, 4);
// body language on top of the car's own roll / pitch (after core's updateVisual)
hook("hud", dt => {
    if (J.hideCar) { J.hideCar = false; if (ctx.foot && ctx.foot.active) ctx.car.obj.visible = false; }
    const R = currentRide();

    if (!R || ctx.state !== "playing") return;
    const car = ctx.car, feel = R.R.feel;
    R.t += dt;
    if (feel === "floaty") {
        // a soft, wallowing spring — it leans late and bounces back
        const want = clamp(-car.latAcc * 0.011, -0.16, 0.16);
        R.rollV += ((want - R.roll) * 26 - R.rollV * 3.2) * dt;
        R.roll += R.rollV * dt;
        car.tilt.rotation.z += R.roll;
        car.tilt.position.y += Math.sin(R.t * 2.1) * 0.012 * Math.min(1, car.speed / 20);
    } else if (feel === "heavy") {
        car.tilt.rotation.x += clamp(-car.accelLong * 0.0035, -0.035, 0.03);
    } else if (feel === "twitchy") {
        car.tilt.position.y -= 0.03;
    }
});
let camBase = null, camKind = null;
function fitCamera() {
    const v = ctx.foot && ctx.foot.vehicle;
    const want = v && BIG_CAM[v.kind] && (ctx.state === "playing" || ctx.state === "intro") ? v.kind : null;
    if (want === camKind) return;
    if (!camBase) camBase = CAMS.map(c => ({ dist: c.dist, height: c.height }));
    CAMS.forEach((c, i) => { if (!c.fp) { c.dist = camBase[i].dist; c.height = camBase[i].height; } });
    if (camKind && camKind.fp != null) { /* nothing */ }
    camKind = want;
    if (want) {
        const b = BIG_CAM[want];
        CAMS.forEach(c => { if (!c.fp) { c.dist += b.d; c.height += b.h; } });
        // Lulu's-eyes view sits in her own car's seat — useless inside a truck box: use the chase cam meanwhile
        if (ctx.cam && CAMS[ctx.cam.mode] && CAMS[ctx.cam.mode].fp && b.d > 1) { J.fpWas = ctx.cam.mode; ctx.cam.state.mode = 0; }
    } else if (J.fpWas != null && ctx.cam) { ctx.cam.state.mode = J.fpWas; J.fpWas = null; }
}

// ── 🤸 bailing out ───────────────────────────────────────────────────────
export function canBail() {
    if (!(live() || partyOn() || force.bail) || !ctx.foot || !ctx.foot.start || ctx.foot.active || ctx.state !== "playing") return false;
    const G = ctx.G;
    if (G.arrived || G.hearts <= 0 || J.active || (ctx.phone && ctx.phone.talking)) return false;
    if (ctx.roadevents && ctx.roadevents.vehicle) return false;    // the steamroller has its own exit
    return ctx.car.speed > 3;
}
const hold = { t: 0, armed: false, mode: 0 };
function padTriangle() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && (pads[input.padIndex] || pads[0]);
    return !!(p && p.buttons && p.buttons[3] && (p.buttons[3].pressed || p.buttons[3].value > 0.5));
}
hook("update", (dt, P, controlsOn) => {
    fitCamera();
    if (famT >= 0 && ctx.state === "playing") {
        famT -= dt;
        if (famT < 0) { famT = -2; const m = pick(T.FAMILY_TEXTS); try { ctx.phone.text({ from: m.from, emoji: m.emoji, msg: m.msg, dur: 6 }); } catch (e) { /* no phone */ } }
    }
    if (ctx.state !== "playing" || !controlsOn) { hold.t = 0; hold.armed = false; return; }
    const ok = canBail();
    // △ / Y: a tap is the camera (core already cycled it this frame); HOLD it to bail — and put the camera back
    if (P.camera && input.device === "gamepad" && padTriangle()) {
        hold.armed = true; hold.t = 0;
        hold.mode = ctx.cam ? (ctx.cam.mode + CAMS.length - 1) % CAMS.length : 0;
    }
    if (hold.armed && padTriangle()) {
        hold.t += dt;
        if (hold.t >= 0.42) {
            hold.armed = false;
            if (ok) { if (ctx.cam) { ctx.cam.state.mode = hold.mode; save3d.cam = hold.mode; saveSoon(); } bail(); return; }
        }
    } else { hold.armed = false; hold.t = 0; }
    if (!ok) return;
    // keyboard: E itself (not Enter) at speed — slower than that, E belongs to pull-over / get-out
    if ((P.interact && input.interactHeld && input.device === "keyboard" && ctx.car.speed > 13) || P.bail) bail();

});

/** Dive out of the moving car. Returns true if she's out. */
export function bail() {
    const car = ctx.car, h = car.h, sp = car.speed;
    const vx = car.vx, vz = car.vz;
    const l = left(h);
    const at = { x: car.pos.x + l.x * 1.05, z: car.pos.z + l.z * 1.05 };
    const chasing = ctx.law && ctx.law.chasing;
    const reason = chasing && ctx.law._dbg && ctx.law._dbg.L.chase ? ctx.law._dbg.L.chase.reason : null;
    const ride = currentRide();
    const coast = coastAi(vx, vz);
    // (foot's noIntro: she starts on her feet with this line over her head — our dive below is the one animation)
    if (!ctx.foot.start("bailout", { noIntro: true, at, drivable: true, stubAi: coast, line: pick(T.BAIL_LULU) })) return false;
    // running from the cops doesn't make the crime go away: it's on her file, and cops on foot know her face
    if (chasing && reason && ctx.law.addWarrant) ctx.law.addWarrant(reason);
    J.bails++;
    stat("bailouts", 1);
    emit("streets:bail", { speed: sp, ride: ride ? ride.kind : null });
    const F = ctx.foot.debug.F;
    if (F && F.car && F.car.stub) { F.car.stub.data.streetsCoast = true; if (ride) F.car.handling = ride.R.handling; }
    const dv = { t: 0, phase: "fly", vx: vx * 0.55 + l.x * 3.4, vz: vz * 0.55 + l.z * 3.4, y: 0.95, vy: 2.6, rx: 0, said: false, yaw: Math.atan2(vx + l.x * 2, vz + l.z * 2) };
    ctx.foot.script({
        update: (dt, P, Fx) => updateBail(dv, dt, Fx),
        camera: dt => bailCamera(dv, dt),
    });
    toast(pick(T.BAIL_TOAST), "gold", "streets:bail");
    J.hideCar = true;      // core's updateVisual still runs once this frame: keep the abandoned anchor hidden
    sfx.whoosh();
    rumble(0.6, 0.5, 260, true);
    return true;
}
const BODY = 0.8;   // the rolling body's centre above her feet
function updateBail(dv, dt, F) {
    const p = F.lulu, o = p.obj;
    dv.t += dt;
    o.rotation.order = "YXZ";
    o.rotation.y = dv.yaw;
    if (dv.phase === "fly") {
        F.pos.x += dv.vx * dt; F.pos.z += dv.vz * dt;
        dv.vy -= 15 * dt; dv.y += dv.vy * dt;
        dv.rx += dt * 7;                                   // tucking into a forward roll
        p.update(dt, { sit: true });
        if (dv.y <= 0.35) {
            dv.phase = "roll"; dv.y = 0.35;
            sfx.thud();
            rumble(0.7, 0.6, 200, true);
            ctx.car.fx.burst(F.pos.x, 0.3, F.pos.z, 14, 2.6, [0.75, 0.7, 0.62], 1.0, 0.8);
        }
    } else if (dv.phase === "roll") {
        const sp = Math.hypot(dv.vx, dv.vz);
        const ns = Math.max(0, sp - 15 * dt);
        if (sp > 0) { dv.vx *= ns / sp; dv.vz *= ns / sp; }
        F.pos.x += dv.vx * dt; F.pos.z += dv.vz * dt;
        dv.rx += Math.max(ns, 2.2) / 0.45 * dt;            // rolls like a ball of radius 0.45
        dv.y = 0.35;
        if (Math.random() < 0.4 && ns > 3) ctx.car.fx.emit(F.pos.x, 0.15, F.pos.z, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.8, 0.6, [0.75, 0.7, 0.62]);
        p.update(dt, { sit: true });
        if (ns < 1.2 && dv.t > 0.5) { dv.phase = "up"; dv.t0 = dv.t; dv.rx0 = dv.rx; dv.rx1 = Math.ceil(dv.rx / (Math.PI * 2)) * Math.PI * 2; }
    } else if (dv.phase === "up") {
        const k = easeOut((dv.t - dv.t0) / 0.5);
        dv.rx = lerp(dv.rx0, dv.rx1, k);
        dv.y = lerp(0.35, BODY, k);
        p.update(dt, { sit: k < 0.6 });
        if (k >= 1) { dv.phase = "shake"; dv.t0 = dv.t; o.rotation.x = 0; }
    } else {
        const k = (dv.t - dv.t0) / 0.5;
        o.rotation.z = Math.sin(k * 14) * 0.1 * (1 - k);
        p.update(dt, {});

        o.position.set(F.pos.x, 0.05, F.pos.z);
        if (k >= 1) { o.rotation.z = 0; return false; }
        return true;
    }
    // place her so the body turns about its centre (a proper roll, not a cartwheel round her feet)
    const fx = Math.sin(dv.yaw), fz = Math.cos(dv.yaw);
    o.rotation.x = dv.rx;
    o.position.set(F.pos.x - fx * Math.sin(dv.rx) * BODY, dv.y - Math.cos(dv.rx) * BODY, F.pos.z - fz * Math.sin(dv.rx) * BODY);
    if (o.position.y < 0.02) o.position.y = 0.02;
    return true;
}
const _cf = new THREE.Vector3(), _cl = new THREE.Vector3();
function bailCamera(dv, dt) {
    const F = ctx.foot.debug.F;
    if (!F) return false;
    const fx = Math.sin(dv.yaw), fz = Math.cos(dv.yaw), lx = Math.cos(dv.yaw), lz = -Math.sin(dv.yaw);
    // from behind, on the car's side of her dive: her roll and the car rolling away in one shot
    _cf.set(F.pos.x - fx * 6.5 - lx * 3.2, 2.8, F.pos.z - fz * 6.5 - lz * 3.2);

    _cl.set(F.pos.x + fx * 1.5, 0.7, F.pos.z + fz * 1.5);
    ctx.cam.cinematic(_cf, _cl, dt, 4, 54);
    return true;
}
function jackCamera(jk, dt) {
    const c = jk.c, R = jk.R;
    if (!ctx.traffic.cars.includes(c)) return false;
    local(c, R.half + 4.4, 2.3, R.fwd + 4.6, _cf);
    local(c, R.half + 0.4, 1.0, R.fwd - 0.4, _cl);
    _cl.y = 1.0;
    ctx.cam.cinematic(_cf, _cl, dt, 3.2, 50);
    return true;
}

// the abandoned car rolls on without her: friction, a lazy drift, and a pile-up if anything's in the way
function coastAi(vx0, vz0) {
    let vx = vx0, vz = vz0, t = 0, stopped = false;
    const drift = (Math.random() < 0.5 ? -1 : 1) * rand(0.03, 0.08);
    return (dt, c) => {
        t += dt;
        if (stopped) { c.speed = 0; return; }
        let sp = Math.hypot(vx, vz);
        const dec = (1.6 + 0.0016 * sp * sp) * dt;
        const ns = Math.max(0, sp - dec);
        if (sp > 0) { vx *= ns / sp; vz *= ns / sp; }
        sp = ns;
        // nobody's steering: it wanders a touch
        const turn = drift * Math.min(1, sp / 10) * dt;
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const nx = vx * cs + vz * sn, nz = -vx * sn + vz * cs;
        vx = nx; vz = nz;
        c.x += vx * dt; c.z += vz * dt;
        if (sp > 0.5) c.h = Math.atan2(vx, vz);
        c.speed = sp;
        c.s = ctx.world.road.nearest(c.x, c.z, c.s, _o).s;
        if (sp < 0.2) { stopped = true; c.data.streetsCoast = false; return; }
        // other cars: both go spinning
        for (const o of ctx.traffic.cars) {
            if (o === c || o.hit) continue;
            const dx = o.x - c.x, dz = o.z - c.z;
            if (dx * dx + dz * dz > 2.3 * 2.3) continue;
            // (an immune car — a 🎉 party's shared traffic — shrugs it off: only her empty car spins away)
            if (!o.immune) { o.hit = true; o.hitT = 0; o.vx = vx * 0.7; o.vz = vz * 0.7; o.spinV = (Math.random() < 0.5 ? -1 : 1) * Math.min(6, sp * 0.3); }
            c.hit = true; c.hitT = 0; c.vx = vx * 0.3; c.vz = vz * 0.3; c.spinV = (Math.random() < 0.5 ? -1 : 1) * 3;
            sfx.thud();
            ctx.car.fx.burst(c.x, 1, c.z, 16, 3, [1, 0.8, 0.4], 0.6, 0.6);
            toast("💥 Your empty car found a friend!", "gold", "streets:coast");
            return;
        }
        // trees, poles, signs: a dead stop
        for (const ch of ctx.world.activeChunks()) {
            if (Math.abs(ch.s0 + 100 - c.s) > 220) continue;
            for (const col of ch.colliders) {
                if (col.off) continue;
                const dx = col.x - c.x, dz = col.z - c.z, rr = col.r + 1.1;
                if (dx * dx + dz * dz < rr * rr) {
                    stopped = true; c.speed = 0; c.data.streetsCoast = false;
                    sfx.thud();
                    ctx.car.fx.burst(c.x + vx * 0.1, 1, c.z + vz * 0.1, 18, 2.5, [0.55, 0.55, 0.58], 1.4, 1.1);
                    return;
                }
            }
        }
    };
}

// glyphs for the button guide / prompts: "bail" (△ hold on a pad)
glyphSet("ps").bail = "hold △"; glyphSet("xbox").bail = "hold Y"; glyphSet("nintendo").bail = "hold X";
glyphSet("keyboard").bail = "E (moving)"; glyphSet("touch").bail = "✋ BAIL";

on("title", () => { J.active = null; famT = -1; S.hinted = false; });
on("run:start", () => { famT = -1; });
