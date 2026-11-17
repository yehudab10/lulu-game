// features/world/depart.js — THE DRIVEWAY PULL-OUT. Picking Cruise or the Story
// Trip's first leg from the title doesn't cut to a 3-2-1 countdown on an empty
// road any more: the camera swoops down from the title shot, Lulu hops in, backs
// out of the driveway (Dina waving from the porch, Mr. Pinsky waving his hose),
// and pulls away down the street — and the camera settles into the chase cam
// exactly where it'll be when she gets the wheel. ~4 s, skippable (⏭ / hold ○),
// and ✕ / A jumps straight to the road.
//
// Wired through one tiny core hook: a runStart hook sets G.introState =
// "worldDepart" (startRun then enters it instead of "intro"). Only when the run
// is started FROM THE TITLE at the start of the road, outside a party and not
// with opts.quick — Restart / Try again / checkpoints / parties keep the instant
// countdown.
import * as THREE from "three";
import { ctx, on, emit, hook, registerState, setState } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { CAMS } from "../../core/camera.js";
import { input, glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { home, luluSpots, placeParked, peopleTick } from "./home.js";
import { Path, Ride, ease } from "./path.js";

const D = { phase: "", t: 0, rev: null, fwd: null, from: new THREE.Vector3(), fromLook: new THREE.Vector3(), cam: new THREE.Vector3(), look: new THREE.Vector3(), said: false };
const WALK = 0.55, IN = 0.2, PAUSE = 0.18;
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
const spots = {};
const BYE = ["Bring me back a slushie!", "DRIVE SAFE! Ima said!", "Byeee Lulu!", "Don't forget Morgan's snacks!", "Honk when you get there!"];

/** Should a run that's starting now begin with the pull-out? */
export function wantsDeparture(G, opts) {
    if (!home.ready || ctx.state !== "title" || (opts && opts.quick)) return false;
    if (!ctx.enabled("world")) return false;
    if ((ctx.party && ctx.party.active) || G.mode === "party") return false;
    const s0 = opts && opts.s != null ? opts.s : 12;
    return s0 < 60;
}

function buildPaths() {
    const road = ctx.world.road, P = home.park, s = P.s;
    const pt = (ss, d) => road.point(ss, d, {});
    // back out: rear first toward the road, swinging so she ends up facing +s
    const fx = Math.sin(P.h), fz = Math.cos(P.h);
    const rev = new Path([{ x: P.x, z: P.z }, { x: P.x - fx * 3.2, z: P.z - fz * 3.2 }, pt(s - 1.0, 6.6), pt(s - 4.5, 4.4), pt(s - 7.5, 4.0)]);
    const fwd = new Path([pt(s - 7.5, 4.0), pt(s - 4, 3.4), pt(s + 3, 2.0), pt(s + 9, 1.75)]);
    D.rev = new Ride(rev, { reverse: true, profile: "inout", dur: 2.1 });
    D.fwd = new Ride(fwd, { profile: "accel", v1: 12 });
}

hook("runStart", (G, opts) => {
    if (!wantsDeparture(G, opts)) return;
    G.introState = "worldDepart";
    D.from.copy(ctx.camera.position);
    ctx.camera.getWorldDirection(D.fromLook).multiplyScalar(20).add(D.from);
    placeParked();                       // she starts by the car, whatever the title was doing
}, -100);

/** Where the chase cam will be for the car's current pose (so the hand-off is seamless). */
function chasePos(out, look) {
    const car = ctx.car, cfg = CAMS[ctx.cam ? ctx.cam.mode : 0] || CAMS[0];
    const portrait = ctx.camera.aspect < 1;
    if (cfg.fp) {   // Lulu's eyes: hand off from just behind instead
        out.set(car.pos.x - Math.sin(car.h) * 6, 2.4, car.pos.z - Math.cos(car.h) * 6);
        look.set(car.pos.x + Math.sin(car.h) * 4, 1.2, car.pos.z + Math.cos(car.h) * 4);
        return;
    }
    const dist = cfg.dist * (portrait ? 1.25 : 1) + Math.min(car.speed, 45) * 0.025;
    const height = cfg.height * (portrait ? 1.25 : 1);
    out.set(car.pos.x - Math.sin(car.h) * dist, height, car.pos.z - Math.cos(car.h) * dist);
    look.set(car.pos.x + Math.sin(car.h) * 4, cfg.look, car.pos.z + Math.cos(car.h) * 4);
}

function finish() {
    if (ctx.state !== "worldDepart") return;
    const car = ctx.car, G = ctx.G;
    // land exactly at the end of the pull-out, rolling
    if (!D.fwd.done) D.fwd.finish();
    car.showDriver(true);
    if (home.people.lulu) home.people.lulu.obj.visible = false;
    G.lastS = car.s;
    // the chase cam takes over from where we are (no jump)
    chasePos(v1, v2);
    const st = ctx.cam && ctx.cam.state;
    ctx.camera.position.copy(v1);
    ctx.camera.lookAt(v2);
    if (st) { st.pos.copy(v1); st.yaw = car.h; st.snap = false; }
    H.banner(`<b>GO!</b>${G.goText ? `<small>${G.goText}</small>` : ""}`, 1200, { key: "countdown" });
    if (!ctx.skipping) A.sfxCloseCall(6);
    rumble(0.3, 0.6, 200, true);
    emit("world:depart", { mode: G.mode });
    setState("playing");
}

registerState("worldDepart", {
    hud: false, touch: false, pausable: true, driving: false, world: true,
    skip: true,
    enter() {
        const G = ctx.G;
        G.countdown = 0;
        H.clearNotices();
        H.setBoost(G.boost, input.device === "touch" ? "" : glyph("boost"));
        if (!G.musicSet) A.setMusic("../luludriving.mp3");
        buildPaths();
        D.phase = "walk"; D.t = 0; D.said = false;
        luluSpots(spots);
        const L = home.people.lulu;
        if (L) { L.obj.visible = true; }
        D.cam.copy(D.from);
        D.look.copy(D.fromLook);
    },
    exit() {
        if (home.people.lulu) home.people.lulu.obj.visible = false;
        A.updateEngine(0, 0, 0, 0, false, false);
    },
    update(dt, P) {
        const car = ctx.car;
        D.t += dt;
        if (P.confirm && ctx.stateT > 0.3 && !ctx.skipping) { finish(); return; }
        const L = home.people.lulu;
        if (D.phase === "walk") {
            if (L) {
                const k = Math.min(1, D.t / WALK);
                const sx = L.obj.position.x, sz = L.obj.position.z;
                L.obj.position.x += (spots.door.x - sx) * Math.min(1, dt * 9);
                L.obj.position.z += (spots.door.z - sz) * Math.min(1, dt * 9);
                L.face(spots.door.x, spots.door.z, dt, 12);
                L.update(dt, { walk: 1.8 * (1 - k * 0.5) });
            }
            if (D.t >= WALK) { D.phase = "in"; D.t = 0; if (L) L.obj.visible = false; car.showDriver(true); if (!ctx.skipping) A.sfxBump(); }
        } else if (D.phase === "in") {
            if (D.t >= IN) { D.phase = "rev"; D.t = 0; }
        } else if (D.phase === "rev") {
            if (D.rev.step(dt)) { D.phase = "pause"; D.t = 0; }
        } else if (D.phase === "pause") {
            if (D.t >= PAUSE) { D.phase = "fwd"; D.t = 0; }
        } else if (D.phase === "fwd") {
            if (D.fwd.step(dt)) { finish(); return; }
        }
        if (D.phase === "rev" || D.phase === "fwd") {
            A.updateEngine(Math.abs(car.vF), D.phase === "fwd" ? 0.7 : 0.25, 0, 0, false, true);
        }
        // Dina + Mr. Pinsky see her off (a line from Dina, unless chatter is Quiet)
        peopleTick(dt, D.phase === "fwd" ? "go" : "bye");
        if (!D.said && D.phase === "rev" && D.t > 0.3) {
            D.said = true;
            if ((save3d.settings.chatter || "normal") !== "quiet" && ctx.banter && ctx.banter.bubble && home.people.dina) {
                ctx.banter.bubble(BYE[(ctx.frames >> 3) % BYE.length], home.people.dina.obj, { dur: 2.4, y: 1.6, cls: "kid" });
            }
        }
    },
    camera(dt) {
        const car = ctx.car, cam = ctx.camera, P = home.park;
        // three beats: the title shot → down by the driveway (a low 3/4 view) → the chase cam
        const road = ctx.world.road;
        const total = WALK + IN + (D.rev ? D.rev.dur : 2) + PAUSE;
        const elapsed = D.phase === "walk" ? D.t : D.phase === "in" ? WALK + D.t : D.phase === "rev" ? WALK + IN + D.rev.t : D.phase === "pause" ? total - PAUSE + D.t : total;
        const k1 = ease(elapsed / (WALK + IN + 0.6));
        const low = road.point(P.s + 9, -1.5, {});
        v3.set(low.x, 2.3, low.z);
        v4.set(car.pos.x, 1.0, car.pos.z);
        D.cam.copy(D.from).lerp(v3, k1);
        D.look.copy(D.fromLook).lerp(v4, k1);
        if (D.phase === "fwd") {
            chasePos(v1, v2);
            const k2 = ease(D.fwd.t / D.fwd.dur * 1.1);
            D.cam.lerp(v1, k2);
            D.look.lerp(v2, k2);
        }
        cam.position.copy(D.cam);
        cam.lookAt(D.look);
        const portrait = cam.aspect < 1;
        const fov = D.phase === "fwd" ? 60 + (portrait ? 16 : 0) : 52 + (portrait ? 12 : 0);
        cam.fov += (fov - cam.fov) * Math.min(1, dt * 2.5);
        cam.updateProjectionMatrix();
        if (ctx.cam) ctx.cam.state.pos.copy(cam.position);
        return true;
    },
});

/** Test / debug: is a departure running, and its phase. */
export const departInfo = () => ({ phase: ctx.state === "worldDepart" ? D.phase : "", t: D.t });
