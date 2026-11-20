// features/world/depart.js — A RUN STARTS AT HOME, ON FOOT (roadmap step 2).
//
// Picking Cruise, the Story Trip's first leg or the 🕯️ Shabbos Rush from the title doesn't
// play a cutscene or a 3-2-1 any more: the camera pushes in from the title shot to behind
// Lulu at the bottom of her porch steps, and she's yours at once (the on-foot game,
// features/foot). Ima is in the doorway with one line, Dina waves from the step, the pink
// car waits nose-out in the driveway with a little bobbing marker over it. Walk over, ✋
// GET IN (foot's hop-in: the camera glides, no cut) — and driving off IS the run.
// First-ever play gets a gentler hint (how to walk + ✋); standing about, Ima chimes in once.
//
// Wired through one core hook: a runStart hook sets G.introStart (startRun calls it instead of
// setting "intro"). Only for a run started from the title (or the pause menu's Restart) at the
// start of the road, outside a party, not with opts.quick — tests, checkpoints and parties keep
// the plain countdown. The old pull-out cutscene state ("worldDepart") is gone.
import * as THREE from "three";
import { ctx, on, emit, hook, registerState, setState, wrapAngle } from "../../core/ctx.js";
import { updateDriving } from "../../core/driving.js";
import { save3d, store, saveSoon } from "../../core/save.js";
import { input, glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { home, luluSpots, placeParked, peopleTick, titleShot, nearHome, homeEdge, enterHomeTown } from "./home.js";

const HS = store("worldHome", { starts: 0, drives: 0, wayHint: 0 });
const D = { live: false, t: 0, idleT: 0, said: 0, moved: false, first: false, marker: null, imaLine: "", left: false };
const spots = {};

const IMA = {
    // (a first-time player: the car AND the road trip — her suitcase by the car, features/onegame)
    first: ["Lulu! Your suitcase is by the car 🧳 — Bubbe's expecting you! Or just hop in and go for a spin 🚗"],
    any: ["Drive safe! Text me when you get there! 💕", "Your KEYS— oh, they're in the car. Of course they are.",
        "Seatbelt! And take a SWEATER!", "Go, go — and drive SLOW, you hear me?", "Don't forget Dina's snacks! ...Fine, go.",
        "Call Bubbe from the road! Hands-FREE!"],
    story: ["Bubbe's expecting you for Shabbos! Don't make her wait!", "Give Bubbe a kiss from me! And DRIVE SAFE!"],
    shabbos: ["Lulu! Candle-lighting is SOON! GO, GO, GO! 🕯️", "The cholent won't wait and neither will the sun! GO!"],
    nudge: ["The CAR, Lulu! It's not going to drive ITSELF!", "Mamele, the car. Over there. The pink one. 🚗", "Nu? You're waiting for an engraved invitation?"],
};
const pick = a => a[Math.floor(Math.random() * a.length)];

/** Should a run that's starting now begin at home on foot? */
export function wantsDeparture(G, opts) {
    // (from the title, the pause menu's Restart, or back home from inside the world — opts.home: features/onegame)
    if (!home.ready || (ctx.state !== "title" && !(opts && (opts.restart || opts.home))) || (opts && opts.quick)) return false;
    if (!ctx.enabled("world")) return false;
    if ((ctx.party && ctx.party.active) || G.mode === "party") return false;
    if (!ctx.foot || typeof ctx.foot.start !== "function") return false;
    const s0 = opts && opts.s != null ? opts.s : 12;
    return s0 < 60;
}

hook("runStart", (G, opts) => {
    if (!wantsDeparture(G, opts)) return;
    // home is a house on a Midwood street (roadmap 14): the day starts IN that town — no town, no home start (the plain countdown)
    if (!enterHomeTown()) return;
    placeParked();                       // the car in the driveway, Lulu by the porch, whatever the title was doing
    G.introStart = () => startAtHome(opts);
}, -100);

// (the pull-out + the dinner beat play IN a town too — any other state sends her back to the highway first)
on("boot", () => { if (ctx.town && ctx.town.allowState) { ctx.town.allowState("worldPullOut"); ctx.town.allowState("worldHomeBeat"); } });

// ── the marker over the car: a small pink arrow, bobbing (a nudge, not a tutorial) ──
function marker() {
    if (D.marker) return D.marker;
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: "#FF4F9A", emissive: "#FF4F9A", emissiveIntensity: 0.6, roughness: 0.4 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 14), m);
    cone.rotation.x = Math.PI;           // pointing down at the car
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 20), m);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.42;
    g.add(cone, ring);
    g.name = "HomeCarMarker";
    g.visible = false;
    home.group.add(g);
    D.marker = g;
    return g;
}

function imaSay(text, dur = 3.2) {
    const ima = home.people.ima;
    if (!text || !ima || !ima.obj.visible) return false;
    if ((save3d.settings.chatter || "normal") === "quiet" && D.said > 0) return false;
    D.said++;
    D.imaLine = text;
    // (on foot her own bubbles show; banter's only while driving)
    if (ctx.state === "footRun" && ctx.foot && ctx.foot.bubble) return !!ctx.foot.bubble(ima.obj, text, dur, { y: 2.0 });
    if (ctx.banter && ctx.banter.bubble) return ctx.banter.bubble(text, ima.obj, { dur, y: 1.9, cls: "nice" });
    H.toast(`👩 Ima: ${text}`, "pink");
    return true;
}

/** The walk-to-the-car hint: gentle and longer the first time ever. */
function hint() {
    const touch = input.device === "touch";
    if (D.first) return touch ? `Drag the WALK pad to your car 🚗 · then tap ✋ to hop in` : `Walk to your car 🚗 (${glyph("move") || "left stick"}) · ${glyph("interact")} to hop in`;
    return touch ? "" : `${glyph("interact")} at the car to hop in 🚗`;
}

function startAtHome(opts = {}) {
    const G = ctx.G;
    luluSpots(spots);
    const L = home.people.lulu;
    // (opts.homeAt {x, z, face}: she's already somewhere on her street — the road trip from the suitcase starts right there)
    const at = opts.homeAt && Number.isFinite(opts.homeAt.x) ? opts.homeAt : null;
    const face = at && at.face != null ? at.face : L ? L.obj.rotation.y : 0;
    if (L) L.obj.visible = false;
    D.first = !HS.starts;
    HS.starts++; saveSoon();
    D.live = true; D.t = 0; D.idleT = 0; D.said = 0; D.moved = false; D.left = false; D.pendingLine2 = null;
    const ima = home.people.ima;
    if (ima) { ima.obj.visible = true; ima.obj.position.copy(home.anchors.door); ima.obj.rotation.y = home.house.rotation.y; }
    const ok = ctx.foot.start("home", {
        at: at ? { x: at.x, z: at.z } : { x: spots.idle.x, z: spots.idle.z }, face, noIntro: true, drivable: true,
        camBlend: opts.camBlend != null ? opts.camBlend : ctx.state === "title" ? 1.1 : 0, line: "",
        home: {
            hazards: false,
            hint, hintT: D.first ? 14 : 6,
            quiet: () => !!ctx.foot.pos && nearHome(ctx.foot.pos.x, ctx.foot.pos.z, 90),     // no random townsfolk / busking / "get in a car" nudges on her own street
            onOwnCar: drove, driveState: "worldPullOut",
        },
    });
    if (!ok) { D.live = false; if (ima) ima.obj.visible = false; return false; }
    H.setBoost(G.boost, input.device === "touch" ? "" : glyph("boost"));
    G.lastS = G.startS = ctx.car.s;
    // (a Cruise with features/day: Ima reads out today's list instead — after the first-ever "the car's right there")
    // (a real Friday afternoon: the Erev Shabbos Rush is what Ima asks for — getting in the car starts it; features/shabbos)
    const friday = G.mode === "cruise" && ctx.shabbos && ctx.shabbos.atDoor ? ctx.shabbos.atDoor() : false;
    const dayLine = G.mode === "cruise" && !friday && ctx.day && ctx.day.imaLine ? ctx.day.imaLine() : null;
    const line = G.mode === "shabbos" || friday ? pick(IMA.shabbos) : D.first ? IMA.first[0] : G.mode === "story" ? pick(IMA.story) : opts.homeLine || dayLine || pick(IMA.any);
    D.pendingLine = line;
    D.pendingLine2 = D.first && dayLine ? dayLine : opts.homeLine && dayLine && line !== dayLine ? dayLine : null;
    emit("world:homeStart", { mode: G.mode, first: D.first, friday, via: opts.home ? "world" : opts.restart ? "restart" : "title" });
    return true;
}

/** She hopped into her own car at home: the run is on (no countdown — she's already rolling her own way). */
function drove() {
    const G = ctx.G, car = ctx.car;
    D.live = false;
    HS.drives++; saveSoon();
    if (D.marker) D.marker.visible = false;
    G.lastS = car.s;
    G.hint = null;
    if (G.music) A.setMusic(G.music);
    if (G.goText) H.banner(`<b>Let's go!</b><small>${G.goText}</small>`, 1800, { key: "countdown" });
    if (!ctx.skipping) A.sfxCloseCall(6);
    rumble(0.3, 0.6, 200, true);
    if (!D.left) imaSay(pick(["Bye, mamele! Drive SAFE! 💕", "Text me when you get there!", "Love you! SLOW DOWN!"]), 2.4);
    // home is on a town street now: the first time she drives off, one line on how to get out to the highway
    if (home.site === "town" && !HS.wayHint && ctx.town && typeof ctx.town.wayOut === "function") {
        let w = null;
        try { w = ctx.town.wayOut(); } catch (e) { w = null; }
        if (w) { HS.wayHint = 1; saveSoon(); H.toast(`🛣️ To the highway: ${w.street ? `take ${w.street}` : "follow the signs"} — the on-ramp's at the end`, "", { prio: 2 }); }
    }
    emit("world:depart", { mode: G.mode, left: D.left });
}

// (back on the title or into another driving state: the home start is over)
on("state", ({ to }) => {
    if (!D.live) return;
    if (to === "footRun" || to === "playing") return;
    if (to === "title" || ctx.states[to] && ctx.states[to].driving) { D.live = false; if (D.marker) D.marker.visible = false; }
});
on("foot:end", () => { if (D.marker) D.marker.visible = false; });

hook("hud", dt => {
    if (!home.ready) return;
    const ima = home.people.ima;
    if (ima && ima.obj.visible) {
        ima.update(dt, { wave: ctx.state === "playing" || (Math.sin(ctx.time * 0.8) > 0.5), talk: !!D.imaLine && D.t < 3 });
        if (ctx.state === "playing") ima.face(ctx.car.pos.x, ctx.car.pos.z, dt, 3);
    }
    if (!D.live || ctx.state !== "footRun") {
        if (ctx.state === "playing" && home.group && home.group.visible && nearHome(ctx.car.pos.x, ctx.car.pos.z, 140)) peopleTick(dt, "go");
        return;
    }
    D.t += dt;
    peopleTick(dt, "bye");
    if (D.pendingLine && D.t > 0.6) { imaSay(D.pendingLine, D.first ? 4.5 : 4); D.pendingLine = null; }
    if (D.pendingLine2 && D.t > 5.4) { imaSay(D.pendingLine2, 5); D.pendingLine2 = null; }
    const car = ctx.foot && ctx.foot.parkedCar;
    const P = home.park, m = marker();
    const lulu = ctx.car.pos;          // (on foot, core's car anchor follows her)
    const dist = Math.hypot((car ? car.x : P.x) - lulu.x, (car ? car.z : P.z) - lulu.z);
    if (dist > 60 || !nearHome(lulu.x, lulu.z, 120)) D.left = true;      // she wandered off: no more nudging
    m.visible = !D.left && dist > 2.6;
    if (m.visible) m.position.set(car ? car.x : P.x, 2.3 + Math.sin(ctx.time * 3.2) * 0.18, car ? car.z : P.z), m.rotation.y += dt * 1.6;
    // moved yet? if she just stands there a while, Ima says something (once)
    if (input.moveX * input.moveX + input.moveY * input.moveY > 0.04) D.moved = true;
    D.idleT = D.moved ? 0 : D.idleT + dt;
    if (!D.left && D.said < 3 && D.idleT > (D.first ? 6 : 9)) { D.idleT = -99; imaSay(pick(IMA.nudge), 3); }
});

// ── pulling out of the driveway: she drives (it's "playing" in all but name), the camera looks up the street ──
// The car is nose-out in front of the garage, so the chase cam would sit IN the garage: until she's out on the
// road this state frames her from the lawn side, along the road — which IS the chase cam's view once she turns
// onto the street, so the hand-over to "playing" doesn't move the picture.
const PO = { yaw: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), v: new THREE.Vector3(), w: new THREE.Vector3() };
registerState("worldPullOut", {
    hud: true, touch: true, pausable: true, driving: true,
    enter() { PO.yaw = ctx.world.road.at(ctx.car.s).h; PO.snap = true; },
    update(dt, P) {
        updateDriving(dt, P, true);
        const car = ctx.car, rh = ctx.world.road.at(car.s).h;
        const lined = Math.abs(wrapAngle(car.h - rh)) < 0.7;
        const edge = homeEdge(), P0 = home.park, gone = Math.hypot(car.pos.x - P0.x, car.pos.z - P0.z);
        const onRoad = Math.abs(car.d) < edge + 0.6;
        if ((onRoad && lined) || Math.abs(car.d) < edge - 1.5 || gone > 30 || ctx.stateT > 15) {
            const st = ctx.cam && ctx.cam.state;
            if (st) { st.yaw = PO.yaw; st.pos.copy(ctx.camera.position); st.snap = false; }
            // (lined up along the road, the chase cam is where this one already is; at an angle, glide over)
            if ((!lined || home.site === "town") && ctx.cam && ctx.cam.blend) ctx.cam.blend(home.site === "town" ? 1.0 : 0.8);
            setState("playing");
        }
    },
    camera(dt) {
        const car = ctx.car, cam = ctx.camera, rh = ctx.world.road.at(car.s).h;
        // along the road's heading, eased toward the car's once she's turning onto it
        const al = Math.abs(wrapAngle(car.h - rh));
        PO.yaw += wrapAngle((al < 1.2 ? car.h : rh) - PO.yaw) * Math.min(1, dt * (al < 1.2 ? 3 : 6));
        const portrait = cam.aspect < 1;
        if (home.site === "town") {
            // a town lot (neighbours' houses either side, the porch roof behind): from out by the kerb, looking back at her
            // car, the house and Ima in the doorway as she pulls out — then the chase cam glides in once she's on the street
            const P = home.park, fx = Math.sin(P.h), fz = Math.cos(P.h), xx = Math.cos(P.h), xz = -Math.sin(P.h);
            const out = portrait ? 11 : 9.5, side = portrait ? 1.5 : 3, hi = portrait ? 4.2 : 3.2;
            PO.v.set(P.x + fx * out + xx * side, hi, P.z + fz * out + xz * side);
            PO.w.set(car.pos.x - fx * 1.5, 1.1, car.pos.z - fz * 1.5);
            if (PO.snap) { PO.pos.copy(PO.v); PO.look.copy(PO.w); PO.snap = false; }
            PO.pos.lerp(PO.v, Math.min(1, dt * 4));
            PO.look.lerp(PO.w, Math.min(1, dt * 6));
            cam.position.copy(PO.pos);
            cam.lookAt(PO.look);
            cam.fov += (55 + (portrait ? 16 : 0) - cam.fov) * Math.min(1, dt * 3);
            cam.updateProjectionMatrix();
            if (ctx.cam) ctx.cam.state.pos.copy(cam.position);
            return true;
        }
        const dist = 7.2 * (portrait ? 1.25 : 1), up = 3.4 * (portrait ? 1.2 : 1);
        const rx = -Math.cos(rh), rz = Math.sin(rh);            // (toward the road from her lawn: −d)
        const side = Math.max(0, Math.min(3, Math.abs(car.d) - homeEdge())) * 0.9;
        PO.v.set(car.pos.x - Math.sin(PO.yaw) * dist - rx * side * Math.sign(car.d || 1), up, car.pos.z - Math.cos(PO.yaw) * dist - rz * side * Math.sign(car.d || 1));
        PO.w.set(car.pos.x + Math.sin(PO.yaw) * 4, 1.2, car.pos.z + Math.cos(PO.yaw) * 4);
        if (PO.snap) { PO.pos.copy(PO.v); PO.look.copy(PO.w); PO.snap = false; }
        PO.pos.lerp(PO.v, Math.min(1, dt * 5));
        PO.look.lerp(PO.w, Math.min(1, dt * 6));
        cam.position.copy(PO.pos);
        cam.lookAt(PO.look);
        const fov = 60 + (portrait ? 16 : 0) + Math.min(car.speed, 20) * 0.3;
        cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
        cam.updateProjectionMatrix();
        if (ctx.cam) ctx.cam.state.pos.copy(cam.position);
        return true;
    },
});

// ── coming home at the end of a day (features/day): a short beat, then she's on her feet at home again ──
// The car is parked in the driveway, the camera glides back to the house, Lulu climbs out and walks up to the
// porch, Ima waves from the door — and then the camera glides down behind her: a fresh open-world run at home
// (features/onegame's home(); roadmap 10: activities end in the world, not on the title). Without it: the title.
// Skippable (⏭ / ✕). ctx.places.home.comeHome({ line }) starts it.
const HB = { line: "", v: new THREE.Vector3(), w: new THREE.Vector3() };
registerState("worldHomeBeat", {
    hud: true, touch: false, pausable: false, world: true, skip: true,       // (hud: the "home for dinner" banner + the coins ticking up)
    enter(data = {}) {
        HB.line = data.line || "";
        if (ctx.foot && ctx.foot.active && ctx.foot.end) ctx.foot.end("home");
        A.updateEngine(0, 0, 0, 0, false, false);
        placeParked();                                   // (the car in its spot; Lulu climbs out by the driver's door)
        luluSpots(spots);
        const L = home.people.lulu;
        if (L) { L.obj.position.set(spots.door.x, 0, spots.door.z); L.obj.visible = true; home.luluT = 0; }
        const ima = home.people.ima;
        if (ima) { ima.obj.visible = true; ima.obj.position.copy(home.anchors.door); ima.obj.rotation.y = home.house.rotation.y; }
        if (ctx.cam) { if (ctx.cam.blend) ctx.cam.blend(1.0); else ctx.cam.snap(); }
        if (HB.line) H.banner(HB.line, 3400, { prio: 2 });
    },
    update(dt, P) {
        peopleTick(dt);
        const ima = home.people.ima;
        if (ima) ima.update(dt, { wave: true });
        if ((P.confirm && ctx.stateT > 0.6) || ctx.stateT > 4.2) beatDone();
    },
    onSkip() { if (ctx.state === "worldHomeBeat") beatDone(); },
    camera(dt) {
        titleShot(HB.v, HB.w);
        if (ctx.cam) ctx.cam.cinematic(HB.v, HB.w, dt, 1.6, 50);
        return true;
    },
});
function beatDone() {
    if (ctx.onegame && ctx.onegame.home) ctx.onegame.home({ via: "dinner", camBlend: 1.2, line: "" });
    else setState("title");
}
export function comeHome(opts = {}) {
    if (!home.ready || !ctx.states.worldHomeBeat) return false;
    setState("worldHomeBeat", opts);
    return true;
}

/** Test / debug: the home start's live state. */
export const departInfo = () => ({
    live: D.live, phase: D.live ? (ctx.state === "footRun" ? "walk" : ctx.state) : "", t: D.t, first: D.first, line: D.imaLine,
    marker: !!(D.marker && D.marker.visible), ima: !!(home.people.ima && home.people.ima.obj.visible), starts: HS.starts, drives: HS.drives,
});
