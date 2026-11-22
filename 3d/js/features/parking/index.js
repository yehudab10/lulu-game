// features/parking — 🅿️ THE PARKING CHALLENGE, played on a REAL lot in the world (ci/parkinglot; the owner,
// 2026-11-22: "I want one main world and that's it… parking challenge should move to a lot").
//
//  • THE COURSE (course.js): one in every rest area's truck lot, beside Mendel's garage — a kerb, a bay row, a lane,
//    the attendant with his clipboard by his booth, a painted START box. Nothing is a separate scene any more.
//  • STARTING: pull into the START box and stop — that's it: level 1 begins where she is (the challenge still unlocks
//    once for 1,000 shared coins: the first time, the attendant asks — hold ✕). The 🅿️ booth's ✋ (on foot) and the
//    card in 📱 💼 Jobs don't teleport her any more: they mark the course (a light over the START box).
//  • A LEVEL: the course crew sets out the level (the parked cars, a cone, the cameras on the sidewalk, a pedestrian,
//    cars cutting through, Sasquatch on the Boss Level — they pop in with a puff), the attendant blows his whistle, and
//    she parks HER car with the game's real driving (the "parking" state is a DRIVING state: the world, the highway
//    traffic and the rest area carry on around her; the lot is closed to other cars). A lot speed governor, reverse
//    from a stop, a higher lot camera (🎥 cycles Lot cam · Overhead · Chase). Scored EXACTLY like 2D: ★★★ no contact
//    at all · ★★ no car touched · ★ dinged something; level × 25 + 15/★ coins; ram a car hard, roll into the
//    pedestrian, hit a car cutting through or run out the clock → CRASH! −1 of 3 lives (and the angry grandpa).
//  • BETWEEN LEVELS no card: the attendant holds up a board (the stars + coins, or CRASH); she pulls out of the bay into
//    the lane and stops, and the crew re-sets the course round her for the next level (the START box is for level 1). After level 10 / the last life: the board shows the run, one line, and she's just
//    driving again. Driving out of the course (or ❚❚ › Leave the challenge) ends it.
//  • The old roadside PULL-OVER (its own lot scene) is RETIRED: the highway has no kerb to park at and the lanes can't
//    be closed while she manoeuvres; stopping on the shoulder still gets her out and walking (features/foot).
//  • Save fields unchanged (the classic 2D game reads them): parkingUnlocked, parkingBestLevel, parkingTotalStars,
//    parkingPerfectRuns, the shared wallet.
//
// Service: ctx.parking = { start(opts), active, phase, here(), mark(), pose() → null, debug }  ·  emits parking:result
//   {stars, coins, level, mode, ok, fail} · parking:run {phase: "start" | "end", level, victory, why}
//   start(opts): { challenge: true, from: "booth" | "phone" | "box" | <test>, level } — at a START box: the run begins;
//   elsewhere: the nearest / next course is marked. Returns true when a run began.
import * as THREE from "three";
import { ctx, on, emit, hook, registerState, setState, addMenuItem, wrapAngle, css } from "../../core/ctx.js";
import { save3d, saveSoon, store, shared, wallet } from "../../core/save.js";
import { addCoins, updateDriving } from "../../core/driving.js";
import { input, glyph, rumble, addTouchButton } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { resume } from "../../core/screens.js";
import { spawnPerson } from "../../core/people.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { beacon, hideBeacon } from "../openworld/marks.js";
import * as LOT from "./lot.js";
import * as CO from "./course.js";
import { PH } from "./hud.js";
import { tone, notes, wompWomp, crunch } from "./sfx.js";

export const UNLOCK_COST = 1000;          // PARKING_UNLOCK_COST in src/01-engine-core.js
const MAXF = 4.0, MAXR = 2.5;             // lot speed governor (2D: 60 / 42 px/s)
const SLOW = 8 / LOT.PXM;                 // "slow" = under 8 px/s in 2D
const HOLD = 0.8;                         // seconds in the bay to count as parked
const BOX_STOP = 0.5;                     // stopped this long in the START box → the level is set out
const UNLOCK_HOLD = 1.0;                  // hold ✕ this long to spend the 1,000 💰
const P3 = store("parking", { parks: 0, fails: 0, challengeRuns: 0, cam: 0 });
const CAM_NAMES = ["Lot cam", "Overhead", "Chase cam"];
const FAIL_MSGS = { timeout: "Out of time!", pedestrian: "You bumped a pedestrian!", parked: "You dinged the other car!", traffic: "You hit a car cutting through!" };
const LINES = {
    go: ["Nice and easy. Like your Bubbe parks.", "Between the two cars. Not ON them.", "Tighter than last time. You got this!", "No dents, no drama."],
    yay: ["Beautiful! Next one's tighter.", "Textbook! Pull out for the next one, sweetheart.", "Now THAT'S parking.", "My clipboard is impressed."],
    nay: ["Oy. Pull out and try again.", "He's not happy. I'm not happy. Go again.", "Gently! It's a car, not a bumper car."],
    win: ["ALL TEN! I'm putting your picture on the booth. 🏆"],
    over: ["That's the run. Come back any time — I'm always here.", "Good effort! Pull up again when you're ready."],
    left: ["Leaving already? The course isn't going anywhere."],
};
const pick = a => a[Math.floor(Math.random() * a.length)];

const S = { active: false, phase: "idle", t: 0, c: null, L: null, opts: {}, level: 0, lives: 3, chStars: 0, chCoins: 0, pops: [],
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), camYaw: 0, camInit: false, boxT: 0, offer: null, holdT: 0, mark: null };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
const _a = {}, _b = {}, _c = {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const solo = () => !(ctx.party && ctx.party.active) && !(ctx.G && ctx.G.mode === "party");
const unlocked = () => !!shared.get().parkingUnlocked;

// ── where she is, in the course's frame ───────────────────────────────────
/** Her car in course c's local frame: { x, z, h, fx, fz } (x / z metres, h local heading). */
function local(c, out = {}) {
    const car = ctx.car;
    CO.toLocal(c, car.pos.x, car.pos.z, out);
    out.h = CO.hLocal(c, car.h);
    out.fx = Math.sin(out.h); out.fz = Math.cos(out.h);
    return out;
}
const inBox = lc => Math.hypot(lc.x - CO.COURSE.start.x, lc.z - CO.COURSE.start.z) < CO.COURSE.start.r;

// ── the service ──────────────────────────────────────────────────────────
ctx.parking = {
    /** Start the challenge at a START box, or mark the nearest course. See the header. */
    start(opts = {}) { return start(opts); },
    get active() { return S.active; },
    get phase() { return S.active ? S.phase : "idle"; },
    /** The course she's at (her car within ~40 m of its middle), or null. */
    here: () => hereCourse(40),
    /** Mark the nearest / next course (a light over its START box). */
    mark: () => markCourse(),
    /** (The old roadside lot sent Shared Road party poses; the challenge happens in the world now: nothing to send.) */
    pose: () => null,
    /** Stopped in a START box: foot's "get out & walk" stands down (pulling up IS the start). */
    holdsStop: () => !!S.offer || (S.active && ctx.state === "parking"),
};
function hereCourse(max) {
    if (!ctx.car) return null;
    const c = CO.nearestCourse(ctx.car.pos.x, ctx.car.pos.z, max);
    return c && c.chunk && !c.chunk.dead ? c : null;
}

/** Why the challenge can't start right now ("" = it can). */
export function parkBlock() {
    if (!solo()) return "Not in a party 🎉";
    if (S.active) return "You're already parking!";
    if (ctx.shabbos && ctx.shabbos.active) return "Candles first — Bubbe's waiting! 🕯️";
    if (ctx.law && (ctx.law.chasing || (ctx.law.wanted || 0) >= 2)) return "Lose the cops first 🚓";
    if (ctx.foot && ctx.foot.borrowed) return "In HER car, please — the attendant knows it";
    return "";
}

function start(opts) {
    S.opts = opts || {};
    const why = parkBlock();
    if (why) { H.toast(why, "red"); return false; }
    const c = hereCourse(40);
    if (c && ctx.state === "playing" && inBox(local(c, _a))) return beginRun(c, S.opts.level || 1, S.opts.from || "box");
    markCourse();
    return false;
}

/** A light over the nearest live course's START box (or the next rest area's), + one line. */
function markCourse() {
    const car = ctx.car;
    let c = CO.nearestCourse(car.pos.x, car.pos.z, 400);
    if (!c) {
        const R = ((ctx.exits && ctx.exits.rests) || []).filter(r => r.s > car.s - 150).sort((a, b) => a.s - b.s)[0];
        if (R) c = CO.courseAt(R.s);
        if (c) H.toast(`🅿️ The Parking Challenge is at the ${R.name} rest area — pull up to the attendant`, "gold");
        else { H.toast("🅿️ Every rest area has a Parking Challenge — pull in at the next one", "gold"); return false; }
    } else H.toast("🅿️ Drive into the START box by the attendant", "gold");
    S.mark = c;
    return true;
}
function markTick() {
    const c = S.mark;
    if (!c || S.active || !ctx.car) { if (S.markOn) { hideBeacon("parkDest"); S.markOn = false; } return; }
    const p = CO.startPoint(c), me = (ctx.foot && ctx.foot.active && ctx.foot.pos) || ctx.car.pos;
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d > 900 && Math.abs(c.s - ctx.car.s) > 1500) { S.mark = null; return; }
    if (d < 600) { beacon("parkDest", p.x, p.z, "#1E88E5", 2.2, 26); S.markOn = true; } else if (S.markOn) { hideBeacon("parkDest"); S.markOn = false; }
}

// ── the START box: pulling up IS the start ─────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    if (ctx.state !== "playing") { if (S.offer) clearOffer(); return; }
    const c = controlsOn && solo() && !S.active ? hereCourse(30) : null;
    const lc = c ? local(c, _a) : null;
    const there = !!(lc && inBox(lc) && ctx.car.speed < 1.4 && !(ctx.foot && ctx.foot.borrowed));
    if (!there) { if (S.offer) clearOffer(); S.boxT = 0; return; }
    if (!S.offer) {
        S.offer = c; S.holdT = 0; S.boxT = 0;
        if (S.mark === c) S.mark = null;
        if (c.person) say(c, unlocked() ? pick(LINES.go) : "Ten levels. 1,000 coins, once — forever.", 2.6);
    }
    const why = parkBlock();
    if (why) { H.prompt(`🅿️ ${why}`); return; }
    if (unlocked()) {
        // stop in the box → level 1 (no button: she pulled up to the attendant)
        H.prompt(`🅿️ Parking Challenge — stop in the box to start`);
        S.boxT = ctx.car.speed < 0.6 ? S.boxT + dt : 0;
        if (S.boxT >= BOX_STOP) { clearOffer(); beginRun(c, 1, S.opts.from || "box"); }
        return;
    }
    // locked: the attendant asks first (a HOLD — 1,000 💰 is not a tap)
    const have = wallet.coins;
    if (have < UNLOCK_COST) { H.prompt(`🅿️ Parking Challenge — 🔒 ${UNLOCK_COST.toLocaleString()} 💰 (you've got ${have.toLocaleString()})`); return; }
    const tap = P.interact && input.device === "touch";
    S.holdT = input.interactHeld || tap ? S.holdT + (tap ? UNLOCK_HOLD : dt) : 0;
    const pct = Math.min(100, S.holdT / UNLOCK_HOLD * 100).toFixed(0);
    H.prompt(`🅿️ Hold ${glyph("interact")} to unlock the Parking Challenge — ${UNLOCK_COST.toLocaleString()} 💰<span class="po-bar"><i style="width:${pct}%"></i></span>`);
    if (S.holdT >= UNLOCK_HOLD) {
        S.holdT = 0;
        if (unlock()) { say(c, "Unlocked! Level one's a nice wide spot. …They get worse. 😬", 3); clearOffer(); beginRun(c, 1, "box"); }
    }
}, -10);
function clearOffer() { S.offer = null; S.holdT = 0; H.prompt(""); }
export function unlock() {
    if (unlocked()) return true;
    if (!wallet.spend(UNLOCK_COST)) return false;
    shared.update(s => { s.parkingUnlocked = true; });
    A.sfxFanfare();
    emit("parking:unlock", {});
    return true;
}
css("pullover", `.prompt .po-bar { display: inline-block; vertical-align: middle; margin-left: 10px; width: 64px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.25); overflow: hidden; }
.prompt .po-bar i { display: block; height: 100%; background: #CE93D8; }
body.tv .prompt .po-bar { width: 96px; height: 12px; }
.day-chip.park-chip b { color: #FFD54F; } .day-chip.park-chip .pk-low { color: #FF5252; animation: phBlink .5s steps(2) infinite; }
.day-chip.park-chip small { display: block; opacity: .85; }`);
addTouchButton({ id: "parkUnlock", emoji: "🔓", label: "UNLOCK", action: "interact", visible: () => !!S.offer && !unlocked() && wallet.coins >= UNLOCK_COST && ctx.state === "playing" });

// ── a run ────────────────────────────────────────────────────────────────
function beginRun(c, level, from) {
    S.c = c; S.from = from;
    S.level = clamp(level | 0, 1, 10);
    S.lives = 3; S.chStars = 0; S.chCoins = 0;
    S.active = true;
    P3.challengeRuns++; saveSoon();
    emit("parking:run", { phase: "start", level: S.level, from });
    emit("onegame:parking", { via: from });
    if (ctx.paused) resume();
    setState("parking", { from });
    return true;
}

/** End the run: the attendant's board, one line, back to plain driving. why: "victory" | "lives" | "left" | "quit" */
function endRun(why) {
    if (!S.active) return;
    const victory = why === "victory";
    const st = { level: Math.min(S.level, 10), stars: S.chStars, coins: S.chCoins, victory, why };
    S.endStats = st;
    if (why === "victory" || why === "lives") {
        emit("stat", { id: "parkingChallenges", n: 1 });
        if (victory) { emit("stat", { id: "parkingMaster", n: 1 }); A.sfxFanfare(); rumble(0.4, 0.8, 500, true); }
    }
    emit("parking:run", { phase: "end", level: st.level, victory, why });
    const best = shared.get().parkingBestLevel || 0;
    const c = S.c;
    showBoard(c, victory ? ["🏆 ALL 10!", `★ ${st.stars} · 💰 ${st.coins}`] : ["RUN OVER", `level ${st.level} · ★ ${st.stars}`, `best: ${best}`], victory ? "#2E7D32" : "#1565C0", 7);
    say(c, pick(LINES[victory ? "win" : why === "lives" ? "over" : "left"]), 3.2);
    H.toast(victory ? `🏆 MASTER PARKER — all 10 levels! ★ ${st.stars} · +${st.coins} 💰` : why === "lives" ? `🅿️ Parking run over — level ${st.level} · ★ ${st.stars} · +${st.coins} 💰 (best: level ${best})` : `🅿️ Parking Challenge — you left the course (level ${st.level})`, victory ? "gold" : "");
    S.active = false;
    clearLevel(true);
    if (ctx.state === "parking") {
        setState("playing");
        if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(ctx.camera.position);
        if (ctx.cam && ctx.cam.blend) ctx.cam.blend(0.8);
    }
}

// ── the state: a DRIVING state (the world carries on round the lot) ─────────
registerState("parking", {
    hud: true, touch: true, pausable: true, driving: true,
    enter() {
        if (!S.active || !S.c) { setState("playing"); return; }
        S.phase = "setup"; S.t = 0; S.built = false;
        S.camInit = false;
        S.noBoost0 = ctx.G.noBoost; ctx.G.noBoost = true;
        CO.attendantCtl.busy = S.c;
        PH.reset(); PH.show(true);
        A.setMusic("../parking.mp3");
        A.sfxHorn(false);
        H.prompt("");
        ensureModels(LOT.MODELS).catch(() => {});
    },
    exit(next) {
        ctx.G.noBoost = S.noBoost0 || false;
        CO.attendantCtl.busy = null;
        PH.show(false);
        chip(null);
        H.prompt("");
        hideBeacon("parkBox");
        removeBubble();
        if (S.active) {
            // something else took over (a wreck, an arrest, the title, a party): the run just stops
            S.active = false;
            emit("parking:run", { phase: "end", level: S.level, victory: false, why: "interrupted" });
            clearLevel(false);
        }
        if (next === "playing" || next === "footRun") A.setMusic("../luludriving.mp3");
    },
    update(dt, P) {
        S.t += dt;
        if (!S.active) return;
        if (P.camera) { P3.cam = (P3.cam + 1) % 3; saveSoon(); S.camToast = 1.8; S.camInit = false; if (P3.cam === 2 && ctx.cam) { ctx.cam.state.pos.copy(ctx.camera.position); if (ctx.cam.blend) ctx.cam.blend(0.6); } }
        switch (S.phase) {
            case "setup": updateSetup(dt, P); break;
            case "drive": updateDrive(dt, P); break;
            case "result": updateResult(dt, P); break;
            case "box": updateBox(dt, P); break;
            default: break;
        }
        tickPops(dt);
        if (S.active) chip(chipHtml());
    },
    camera(dt) { return lotCamera(dt); },
});

// the controls: her real car, with the lot's speed governor (2D's 60 / 42 px/s), reverse from a stop
function lotCtl(hold = false) {
    const car = ctx.car, thr = input.throttle, brk = input.brake, vF = car.vF;
    if (hold) return { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true };
    return {
        steer: clamp(input.steer * (save3d.settings.steerSens || 1), -1, 1),
        throttle: thr * 0.5 * clamp((MAXF - vF) / 1.2, 0, 1),
        brake: vF > 0.6 ? brk : brk * 0.65 * clamp((MAXR + vF) / 1.0, 0, 1),
        handbrake: false, analog: input.device !== "keyboard",
    };
}
function drive(dt, P, hold = false) {
    const car = ctx.car, ctl = lotCtl(hold);
    updateDriving(dt, P, true, ctl);
    if (hold) { car.vx *= Math.exp(-5 * dt); car.vz *= Math.exp(-5 * dt); return; }
    // gas while rolling backwards brakes (the car would just coast)
    const thr = Math.max(input.throttle, ctl.throttle * 2);
    if (car.vF < -0.2 && thr > 0.05) slowAlong(car, 9 * Math.min(1, thr) * dt);
    if (Math.abs(car.vF) < 0.05 && thr < 0.05 && input.brake < 0.05 && ctl.brake < 0.05) { car.vx *= 0.8; car.vz *= 0.8; }
}
function slowAlong(car, dv) {
    const sp = Math.hypot(car.vx, car.vz);
    if (sp < 1e-4) return;
    const k = Math.max(0, sp - dv) / sp;
    car.vx *= k; car.vz *= k;
}
/** Did she drive out of the course? (ends the run) */
function leftCourse() {
    const lc = local(S.c, _b);
    if (CO.insideLocal(lc.x, lc.z)) return false;
    endRun("left");
    return true;
}

// ── setting out a level ───────────────────────────────────────────────────
function updateSetup(dt, P) {
    drive(dt, P, true);
    if (!S.built) {
        if (!LOT.MODELS.every(k => models[k])) { PH.hint("") ; chip(chipHtml()); return; }      // (the props are still loading: a beat)
        buildLevel();
        S.built = true; S.t = 0;
        whistle();
        H.banner(`<b>🅿️ ${S.introTitle}</b><small>${S.introDetails}</small>`, 2200, { key: "parking:intro" });
    }
    animateLevel(dt);
    if (S.t >= 1.0) { S.phase = "drive"; S.t = 0; tone(523, 0.08, "triangle", 0.2); }
}
function whistle() {
    tone(2350, 0.09, "square", 0.08); tone(2200, 0.22, "square", 0.08, 0, 0.12);
    const p = S.c && S.c.person;
    if (p) { p.face(ctx.car.pos.x, ctx.car.pos.z, 1, 99); }
}

/** Lay out the level's props in the course (local coords, in a group turned with the course). */
function buildLevel() {
    clearLevel(true);
    const c = S.c, cfg = LOT.levelConfig(S.level), layout = LOT.challengeLayout(cfg.spotWidth);
    S.cfg = cfg; S.layout = layout;
    const G = new THREE.Group();
    G.name = "ParkingLevel";
    G.position.set(c.O.x, 0, c.O.z);
    G.rotation.y = c.phi;
    ctx.scene.add(G);
    const zone = layout.zone, curbZ = CO.COURSE.curbZ;
    const zx0 = LOT.lotX(zone.x), zx1 = LOT.lotX(zone.x + zone.w), zz0 = LOT.lotZ(zone.y), zz1 = LOT.lotZ(zone.y + zone.h);
    const L = S.L = { G, zone, curbZ, zx0, zx1, zz0, zz1, parked: [], cams: [], cones: [], traffic: [], trafficT: 3, owned: [] };
    const own = (...xs) => { L.owned.push(...xs); return xs[0]; };
    const pop = o => { o.scale.multiplyScalar(0.01); S.pops.push({ obj: o, t: 0, dir: 1, s: 1 / 0.01 }); };

    // the painted bay: a dashed outline (yellow → green when she's in it) + T marks + a bobbing chevron
    L.outlineMat = own(new THREE.MeshStandardMaterial({ color: "#FFEB3B", emissive: "#FFEB3B", emissiveIntensity: 0.35, roughness: 0.5 }));
    const dGeo = own(new THREE.PlaneGeometry(0.47, 0.11).rotateX(-Math.PI / 2));
    const per = [];
    const inset = 0.08, ax0 = zx0 + inset, ax1 = zx1 - inset, az0 = Math.max(curbZ + 0.08, zz0), az1 = zz1 - inset;
    for (let x = ax0; x < ax1 - 0.2; x += 0.82) { per.push([x + 0.235, az0, 0]); per.push([x + 0.235, az1, 0]); }
    for (let z = az0 + 0.3; z < az1 - 0.2; z += 0.82) { per.push([ax0, z + 0.235, 1]); per.push([ax1, z + 0.235, 1]); }
    const outline = new THREE.InstancedMesh(dGeo, L.outlineMat, per.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    per.forEach((p, i) => outline.setMatrixAt(i, m4.compose(v1.set(p[0], 0.02, p[1]), q.setFromEuler(e.set(0, p[2] ? Math.PI / 2 : 0, 0)), one)));
    G.add(outline);
    const chev = new THREE.Mesh(own(new THREE.ConeGeometry(0.42, 0.8, 4)), L.outlineMat);
    chev.rotation.x = Math.PI;
    chev.position.set((zx0 + zx1) / 2, 2.4, (Math.max(curbZ, zz0) + zz1) / 2);
    G.add(chev);
    L.chevron = chev;
    const white = own(new THREE.MeshStandardMaterial({ color: "#F5F5EE", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    const tGeo = own(new THREE.PlaneGeometry(0.1, 0.5).rotateX(-Math.PI / 2));
    for (const pc of layout.cars) for (const s of [-1, 1]) { const m = new THREE.Mesh(tGeo, white); m.position.set(LOT.lotX(pc.x + s * 42), 0.018, zz1 - 0.2); G.add(m); }

    // the parked cars (each a real car: dents go on its bodywork; the two either side of the bay can end the level)
    for (const pc of layout.cars) {
        const obj = cloneWithColors(models.sedan, { Paint: pc.color });
        const h = LOT.rotToH(pc.rot || 0);
        obj.position.set(LOT.lotX(pc.x), 0, LOT.lotZ(pc.y));
        obj.rotation.y = h;
        G.add(obj); pop(obj);
        const fx = Math.sin(h), fz = Math.cos(h);
        const circles = [-1.45, 0, 1.45].map(o => ({ x: obj.position.x + fx * o, z: obj.position.z + fz * o, r: 0.9 }));
        L.parked.push({ obj, circles, deco: !!pc.deco });
    }
    // the security cameras on the sidewalk (1 → 3), each tracking her with a dashed red laser
    const camXs = [-9.6, 0.9, 9.4];
    const idx = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, cfg.numCameras);
    for (const i of idx) {
        const cam = cloneWithColors(models.parking_camera);
        cam.position.set(camXs[i], 0.15, curbZ - 0.75);
        G.add(cam); pop(cam);
        const head = findNodes(cam, "CamHead")[0];
        if (head) head.rotation.order = "YXZ";
        const beamMat = own(new THREE.MeshBasicMaterial({ color: "#ff3b30", map: own(LOT.laserTex().clone()), transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beamMat.map.wrapS = beamMat.map.wrapT = THREE.RepeatWrapping; beamMat.map.needsUpdate = true;
        const beamGeo = own(new THREE.PlaneGeometry(0.06, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5));
        const beam = new THREE.Mesh(beamGeo, beamMat), beam2 = new THREE.Mesh(beamGeo, beamMat);
        beam2.rotation.z = Math.PI / 2; beam.add(beam2); beam.renderOrder = 5;
        if (head) { beam.position.set(0, 0.04, 0.86); head.add(beam); }
        L.cams.push({ obj: cam, head, beam, beamMat, yaw: 0, pitch: 0.3 });
    }
    // a cone in the bay (4+) · a stray shopping cart in the lane (6+)
    if (cfg.coneInSpot) {
        const cone = cloneWithColors(models.parking_cone);
        const cx = zone.x + zone.w / 2 + (Math.random() * 30 - 15), cy = zone.y + zone.h / 2 + (Math.random() * 20 - 10);
        cone.position.set(LOT.lotX(cx), 0, Math.max(curbZ + 0.4, LOT.lotZ(cy)));
        G.add(cone); pop(cone);
        L.cones.push({ obj: cone, r: 0.26, knocked: false, v: new THREE.Vector3(), spin: new THREE.Vector3(), rest: false, y0: 0, kind: "cone" });
    }
    if (S.level >= 6) {
        const ct = cartModel();
        const me = local(c, _b);
        let cx = 0, cz = 0;
        for (let k = 0; k < 12; k++) { cx = -8 + Math.random() * 16; cz = zz1 + 2.2 + Math.random() * 1.5; if (Math.hypot(cx - me.x, cz - me.z) > 3.8) break; }
        ct.position.set(cx, 0, cz);
        ct.rotation.y = Math.random() * Math.PI * 2;
        G.add(ct); pop(ct);
        L.cones.push({ obj: ct, r: 0.5, knocked: false, v: new THREE.Vector3(), spin: new THREE.Vector3(), rest: false, y0: 0, kind: "cart" });
    }
    // a pedestrian (5+) crossing along the bay row's edge
    if (cfg.pedestrian) {
        const key = ["npcWoman", "npcMan", "npcKid"][Math.floor(Math.random() * 3)];
        const p = spawnPerson(key, { colors: { Top: ["#E91E63", "#FFC107", "#43A047", "#2196F3", "#FF5722", "#9C27B0"][Math.floor(Math.random() * 6)] } });
        const dir = Math.random() < 0.5 ? 1 : -1;
        p.obj.position.set(-12 * dir, 0, zz1 + 0.9);
        p.obj.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        p.obj.visible = false;
        G.add(p.obj);
        L.ped = { person: p, dir, speed: 1.4 + Math.random() * 0.6, delay: 2 + Math.random() * 4, state: "walk", fallT: 0 };
    }
    // Sasquatch watches the Boss Level from the sidewalk
    if (cfg.sasquatchWatcher) {
        const sq = spawnPerson("parking_sasquatch");
        sq.obj.position.set(6, 0.15, curbZ - 1.0);
        G.add(sq.obj); pop(sq.obj);
        L.sasquatch = sq;
    }
    L.trafficOn = !!cfg.traffic;
    S.auto = null;
    S.inZoneT = 0; S.touched = false; S.perfect = true; S.failHit = null; S.result = null; S.stars = 0; S.bonus = 0;
    S.hitCd = 0; S.flashT = 0; S.inZone = false; S.timeLeft = cfg.timeLimit; S.angry = null;
    S.introTitle = `Level ${S.level} · ${LOT.LEVEL_NAMES[Math.min(S.level - 1, 9)]}`;
    let d = `${cfg.numCameras} 📹 · ${Math.floor(cfg.timeLimit)}s`;
    if (cfg.coneInSpot) d += " · 🚧";
    if (S.level >= 6) d += " · 🛒";
    if (cfg.pedestrian) d += " · 🚶";
    if (cfg.traffic) d += " · 🚗";
    if (cfg.sasquatchWatcher) d += " · 🦍";
    S.introDetails = d;
    // a puff where the crew set things out
    const fx = ctx.car && ctx.car.fx;
    if (fx) for (const p of L.parked) { const w = CO.toWorld(c, p.obj.position.x, p.obj.position.z, _c); fx.burst(w.x, 0.6, w.z, 10, 2.2, [0.85, 0.85, 0.82], 0.5, 0.6); }
}

/** The level's props go (pop out with a puff when `soft`); the parked cars' dents with them. */
function clearLevel(soft) {
    const L = S.L;
    S.L = null;
    removeAngry();
    if (!L) return;
    const done = () => {
        L.G.traverse(o => { if (o.userData.dispose) o.userData.dispose(); });
        L.G.removeFromParent();
        for (const t of L.owned) if (t && t.dispose) t.dispose();
    };
    if (soft && L.parked.length) {
        for (const o of L.G.children) S.pops.push({ obj: o, t: 0, dir: -1, s: o.scale.x });
        S.pops.push({ obj: null, t: 0, dir: -1, done });
    } else done();
}
function tickPops(dt) {
    for (let i = S.pops.length - 1; i >= 0; i--) {
        const p = S.pops[i];
        p.t += dt;
        const k = Math.min(1, p.t / 0.32);
        if (p.obj) {
            const e = p.dir > 0 ? 1 + 0.12 * Math.sin(k * Math.PI) : 1 - k;     // a little overshoot coming in
            const base = p.dir > 0 ? (k < 1 ? 0.01 + (1 - 0.01) * k : 1) : 1;
            p.obj.scale.setScalar(Math.max(0.01, p.dir > 0 ? base * e : p.s * e));
        }
        if (k >= 1) { S.pops.splice(i, 1); if (p.done) p.done(); }
    }
}
// keep popping props tidy when nothing's running (a run ended, the props shrink away in the normal driving state)
hook("hud", dt => { if (!S.active && S.pops.length) tickPops(dt); markTick(); boardTick(dt); });

let cartTpl = null;
function cartModel() {
    if (!cartTpl) {
        const steel = new THREE.MeshStandardMaterial({ color: "#B0BEC5", roughness: 0.4, metalness: 0.6 });
        const red = new THREE.MeshStandardMaterial({ color: "#E53935", roughness: 0.6 });
        const g = new THREE.Group();
        const B = (w, h, d, x, y, z, m = steel) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); };
        B(0.56, 0.42, 0.03, 0, 0.78, 0.44); B(0.56, 0.42, 0.03, 0, 0.78, -0.44); B(0.03, 0.42, 0.88, 0.28, 0.78, 0); B(0.03, 0.42, 0.88, -0.28, 0.78, 0);
        B(0.56, 0.03, 0.88, 0, 0.58, 0);
        for (const [x, z] of [[0.24, -0.38], [-0.24, -0.38], [0.24, 0.38], [-0.24, 0.38]]) B(0.04, 0.5, 0.04, x, 0.3, z);
        B(0.6, 0.06, 0.06, 0, 1.02, -0.52, red);
        cartTpl = g;
    }
    return cartTpl.clone();
}

// ── driving the level ─────────────────────────────────────────────────────
function updateDrive(dt, P) {
    const c = S.c, L = S.L, car = ctx.car;
    drive(dt, P);
    if (leftCourse()) return;
    S.hitCd = Math.max(0, S.hitCd - dt);
    const lc = local(c, _a);
    collideParked(lc);
    if (S.phase !== "drive") return;
    collideKerb(local(c, _a));
    updateCones(dt, true, local(c, _a));
    updatePed(dt, true, local(c, _a));
    if (S.phase !== "drive") return;
    updateTraffic(dt, local(c, _a));
    if (S.phase !== "drive") return;
    animateLevel(dt);

    // in the bay + slow + roughly lined up with the kerb → hold for 0.8 s
    const l2 = local(c, _a);
    const zone = S.layout.zone;
    const x2 = LOT.toX2(l2.x), y2 = LOT.toY2(l2.z);
    const rotMod = ((LOT.hToRot(l2.h) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const horizontalOK = rotMod < 0.35 || rotMod > Math.PI * 2 - 0.35 || Math.abs(rotMod - Math.PI) < 0.35;
    S.inZone = LOT.centreInZone(zone, x2, y2) && cornersInBay(l2, L);
    const slow = Math.abs(car.vF) < SLOW;
    L.outlineMat.color.set(S.inZone ? "#4CAF50" : "#FFEB3B");
    L.outlineMat.emissive.set(S.inZone ? "#4CAF50" : "#FFEB3B");
    if (S.inZone && slow && horizontalOK) {
        S.inZoneT += dt;
        if (S.inZoneT > HOLD) { success(); return; }
    } else S.inZoneT = 0;
    if (S.inZone) H.prompt(`<b>🅿️ HOLD STILL TO PARK!</b><span class="po-bar"><i style="width:${Math.min(100, S.inZoneT / HOLD * 100).toFixed(0)}%"></i></span>`);
    else if (S.camToast > 0) { S.camToast -= dt; H.prompt(`🎥 ${CAM_NAMES[P3.cam]} · ${glyph("camera")} to switch`); }
    else H.prompt(hintText());

    // the clock (urgent beep each second under 10, higher under 5)
    const prev = S.timeLeft;
    S.timeLeft -= dt;
    if (S.timeLeft <= 10 && S.timeLeft > 0 && Math.ceil(S.timeLeft) !== Math.ceil(prev)) {
        tone(Math.ceil(S.timeLeft) <= 5 ? 880 : 660, 0.09, "square", 0.14);
        rumble(0.1, 0.3, 60);
    }
    if (S.timeLeft <= 10 && S.timeLeft > 0 && !save3d.settings.calm) {
        const urg = (10 - S.timeLeft) / 10;
        PH.vignette((0.2 + urg * 0.4) * (0.5 + 0.5 * Math.sin(ctx.time * (6 + urg * 8))));
    } else PH.vignette(0);
    if (S.timeLeft <= 0) { S.failHit = { who: "timeout" }; fail(); }
}
function hintText() {
    if (input.device === "touch") return "Park between the two cars · STEER with the stick · GAS forward · REVERSE back";
    return `Park between the two cars · ${glyph("steer")} steer · ${glyph("gas")} forward · ${glyph("reverse")} reverse`;
}

function corners(lc, out) {
    const rx = -Math.cos(lc.h), rz = Math.sin(lc.h);
    let i = 0;
    for (const a of [2.05, -2.05]) for (const b of [0.9, -0.9]) {
        out[i] = out[i] || { x: 0, z: 0 };
        out[i].x = lc.x + lc.fx * a + rx * b; out[i].z = lc.z + lc.fz * a + rz * b; i++;
    }
    return out;
}
const CORN = [];
function cornersInBay(lc, L) {
    corners(lc, CORN);
    for (const p of CORN) if (p.x < L.zx0 - 0.45 || p.x > L.zx1 + 0.45 || p.z < L.curbZ - 0.1 || p.z > L.zz1 + 0.45) return false;
    return true;
}

function collideParked(lc, scoring = true) {
    const c = S.c, car = ctx.car, L = S.L;
    let best = 0, pc = null, cx = 0, cz = 0;
    for (const p of L.parked) for (const ci of p.circles) {
        const dx = ci.x - lc.x, dz = ci.z - lc.z;
        if (dx * dx + dz * dz > 20) continue;
        const w = CO.toWorld(c, ci.x, ci.z, _c);
        const imp = car.collideStatic(w.x, w.z, ci.r);
        if (imp > best) {
            best = imp; pc = p;
            const d = Math.hypot(car.pos.x - w.x, car.pos.z - w.z) || 1;
            cx = w.x + (car.pos.x - w.x) / d * ci.r; cz = w.z + (car.pos.z - w.z) / d * ci.r;
        }
    }
    if (best < 0.05 || S.hitCd > 0) return;
    S.hitCd = 0.35;
    if (!scoring) { if (best > 0.8) { A.sfxBump(); rumble(0.3, 0.4, 120, true); } return; }     // (between levels: solid, nothing scored)
    const sev = clamp(best / MAXF, 0, 1);
    v1.set(cx, 0.7, cz);
    LOT.addDent(pc.obj, v1, sev, { hx: 0.9, hz: 2.2, y: 0.7 });
    S.touched = true; S.perfect = false;
    if (S.autoAll) (S.trace = S.trace || []).push({ hit: pc.deco ? "deco" : L.parked.indexOf(pc), ph: S.auto && S.auto.phase, x: +lc.x.toFixed(2), z: +lc.z.toFixed(2), h: +lc.h.toFixed(2), sev: +sev.toFixed(2) });
    S.flashT = 0.2;
    if (!save3d.settings.calm) ctx.G.shake = Math.max(ctx.G.shake || 0, 0.2 + sev * 0.3);
    car.fx.burst(cx, 0.7, cz, sev > 0.35 ? 24 : 10, 3, [1, 0.8, 0.4], 0.4, 0.5);
    if (sev > 0.35) car.fx.burst(cx, 0.9, cz, 12, 1.5, [0.6, 0.6, 0.62], 1.2, 1.0);
    crunch(0.6 + sev);
    A.sfxBump();
    rumble(0.5 + sev * 0.5, 0.6, 160 + sev * 200, true);
    if (sev > 0.4) { S.failHit = { who: "parked", car: pc, severity: sev }; fail(); }
}

/** The kerb stops her (the bay row's back edge), and the closed end's bollards. */
function collideKerb(lc) {
    const c = S.c, car = ctx.car, L = S.L;
    corners(lc, CORN);
    let minZ = 1e9, minX = 1e9;
    for (const p of CORN) { minZ = Math.min(minZ, p.z); minX = Math.min(minX, p.x); }
    const lv = CO.vecLocal(c, car.vx, car.vz, _b);
    let dx = 0, dz = 0;
    if (minZ < L.curbZ && lc.x > CO.COURSE.x0 - 0.5 && lc.x < CO.COURSE.x1 + 0.5) {
        dz = L.curbZ - minZ;
        if (lv.z < 0) {
            const imp = -lv.z;
            lv.z *= -0.3;
            if (imp > 0.25) { S.perfect = false; tone(150, 0.1, "square", 0.12); A.sfxBump(); rumble(0.3, 0.4, 120, true); }
        }
    }
    const lim = CO.COURSE.x0 - 0.2;
    if (minX < lim) { dx = lim - minX; if (lv.x < 0) lv.x *= -0.3; }
    if (dx || dz) {
        const w = CO.vecWorld(c, dx, dz, _c);
        car.pos.x += w.x; car.pos.z += w.z;
        const vw = CO.vecWorld(c, lv.x, lv.z, _c);
        car.vx = vw.x; car.vz = vw.z;
    }
}

function updateCones(dt, live, lc) {
    const car = ctx.car, c = S.c;
    for (const k of S.L.cones) {
        const o = k.obj;
        if (!k.knocked && live) {
            for (const off of [1.15, -1.15]) {
                const px = lc.x + lc.fx * off, pz = lc.z + lc.fz * off;
                const dx = o.position.x - px, dz = o.position.z - pz;
                if (dx * dx + dz * dz < (k.r + 0.93) ** 2) {
                    // Boop! it goes flying (no damage, but no perfect park either)
                    k.knocked = true;
                    const d = Math.hypot(dx, dz) || 1, sp = car.speed * 1.5 + 2;
                    k.v.set(dx / d * sp, (k.kind === "cart" ? 1.2 : 2.6) + car.speed * 0.4, dz / d * sp);
                    k.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14);
                    if (k.kind === "cart") k.spin.set(0, (Math.random() - 0.5) * 6, 0);
                    S.perfect = false;
                    tone(k.kind === "cart" ? 330 : 220, 0.1, "square", 0.15);
                    const w = CO.toWorld(c, o.position.x, o.position.z, _c);
                    car.fx.burst(w.x, 0.4, w.z, 8, 3, k.kind === "cart" ? [0.75, 0.78, 0.8] : [1, 0.34, 0.13], 0.25, 0.5);
                    rumble(0.2, 0.4, 80);
                    break;
                }
            }
        }
        if (k.knocked && !k.rest) {
            k.v.y -= 9.8 * dt;
            o.position.addScaledVector(k.v, dt);
            o.rotation.x += k.spin.x * dt; o.rotation.y += k.spin.y * dt; o.rotation.z += k.spin.z * dt;
            const floor = k.kind === "cart" ? 0 : 0.13;
            if (o.position.y <= floor && k.v.y < 0) {
                o.position.y = floor;
                k.v.y *= -0.35; k.v.x *= 0.6; k.v.z *= 0.6; k.spin.multiplyScalar(0.6);
                if (Math.abs(k.v.y) < 0.6 && Math.hypot(k.v.x, k.v.z) < 0.5) {
                    k.rest = true;
                    if (k.kind === "cone") o.rotation.set(Math.PI / 2, o.rotation.y, 0); else o.rotation.set(0, o.rotation.y, 0);
                }
            }
        }
    }
}

function updatePed(dt, live, lc) {
    const ped = S.L.ped;
    if (!ped) return;
    const car = ctx.car, p = ped.person, o = p.obj;
    if (ped.delay > 0) { ped.delay -= dt; if (ped.delay <= 0) o.visible = true; return; }
    if (ped.state === "fallen") {
        ped.fallT = Math.min(1, ped.fallT + dt * 3);
        o.rotation.x = -ped.fallT * Math.PI / 2;
        o.position.y = 0.2 * ped.fallT;
        p.update(dt, { walk: 0 });
        return;
    }
    // wait politely if the car is blocking the way — and after a moment, step round it on the lane side
    ped.z0 = ped.z0 == null ? o.position.z : ped.z0;
    const ahead = (lc.x - o.position.x) * ped.dir;
    const inPath = ahead > -2.6 && ahead < 3.2 && Math.abs(lc.z - ped.z0) < 2.2;
    const blocked = !ped.round && live && ahead > 0 && ahead < 2.9 && Math.abs(lc.z - o.position.z) < 1.9;
    ped.waitT = blocked ? (ped.waitT || 0) + dt : 0;
    if (ped.waitT > 2.0) ped.round = true;
    if (ped.round && !inPath) ped.round = false;
    const wantZ = ped.round ? Math.max(ped.z0, lc.z + 2.7) : ped.z0;
    o.position.z += clamp(wantZ - o.position.z, -1.6 * dt, 1.6 * dt);
    const sp = blocked ? 0 : ped.speed * (Math.abs(wantZ - o.position.z) > 0.3 ? 0.4 : 1);
    o.position.x += ped.dir * sp * dt;
    p.update(dt, { walk: sp + Math.abs(wantZ - o.position.z) * 0.2, talk: blocked });
    if (blocked && !ped.ahem) { ped.ahem = true; showBubble(o, "Ahem!", 2.3, 1.2); }
    if (!blocked) ped.ahem = false;
    if (Math.abs(o.position.x) > 13.5) { o.visible = false; S.L.ped = null; return; }
    if (!live) return;
    for (const off of [1.15, -1.15]) {
        const px = lc.x + lc.fx * off, pz = lc.z + lc.fz * off;
        const dx = o.position.x - px, dz = o.position.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < 0.93 + 0.32) {
            if (Math.abs(car.vF) > SLOW) {
                // rolling INTO them is a fail; a passer-by bumping a parked car isn't
                ped.state = "fallen";
                S.failHit = { who: "pedestrian" };
                fail();
                return;
            }
            const k = (0.93 + 0.32 - d) / (d || 1);
            o.position.x += dx * k; o.position.z += dz * k;
            if (!ped.hey) { ped.hey = true; showBubble(o, "Hey!", 2.3, 1.0); }
        }
    }
}

// ── cars cutting through (7+): out of the gap between the semis, across the lane's far side, out past the entrance ──
function updateTraffic(dt, lc) {
    const L = S.L;
    if (!L || !L.trafficOn) return;
    const c = S.c, car = ctx.car;
    L.trafficT -= dt;
    if (L.trafficT <= 0 && L.traffic.length < 2) {
        L.trafficT = 6 + Math.random() * 4;
        const kind = Math.random() < 0.7 ? "sedan" : "van";
        if (models[kind]) {
            const obj = cloneWithColors(models[kind], { Paint: LOT.ENEMY_COLS[Math.floor(Math.random() * LOT.ENEMY_COLS.length)] });
            obj.position.set(1.6, 0, 27);
            obj.rotation.y = Math.PI;
            L.G.add(obj);
            L.traffic.push({ obj, h: Math.PI, speed: 5 + Math.random(), v: 0, wheels: findNodes(obj, "Wheel_"), len: kind === "van" ? 1.5 : 1.3 });
        }
    }
    for (let i = L.traffic.length - 1; i >= 0; i--) {
        const t = L.traffic[i], o = t.obj;
        // turn toward the entrance once on the lane's far side
        const want = o.position.z < 17.8 ? Math.PI / 2 : Math.PI;
        t.h += clamp(wrapAngle(want - t.h), -1.7 * dt, 1.7 * dt);
        const fx = Math.sin(t.h), fz = Math.cos(t.h);
        // politely stop for her when she's right in front
        const ax = lc.x - o.position.x, az = lc.z - o.position.z, along = ax * fx + az * fz, side = Math.abs(ax * fz - az * fx);
        const blocked = along > 0 && along < 6 && side < 2.6;
        t.v += clamp((blocked ? 0 : t.speed) - t.v, -8 * dt, 3 * dt);
        o.position.x += fx * t.v * dt; o.position.z += fz * t.v * dt;
        o.rotation.y = t.h;
        for (const w of t.wheels) w.rotation.x += t.v * dt / 0.34;
        if (o.position.x > 19) { o.removeFromParent(); L.traffic.splice(i, 1); continue; }
        for (const off of [-t.len, 0, t.len]) {
            const px = o.position.x + fx * off, pz = o.position.z + fz * off;
            const dx = px - lc.x, dz = pz - lc.z;
            if (dx * dx + dz * dz > 9) continue;
            const w = CO.toWorld(c, px, pz, _c);
            const imp = car.collideStatic(w.x, w.z, 0.95);
            if (imp > 0 || dx * dx + dz * dz < 3.4) {
                if (S.phase !== "drive") { t.v = 0; continue; }       // (between levels: it just waits for her)
                t.speed = 0; t.v = 0;
                const iw = CO.vecWorld(c, fx * 3, fz * 3, _b);
                car.applyImpulse(iw.x, 0, iw.z);
                A.sfxCrash(0.8);
                S.failHit = { who: "traffic" };
                fail();
                return;
            }
        }
    }
}

// cameras track Lulu · LEDs blink · the bay chevron bobs · the sasquatch watches · the attendant watches too
function animateLevel(dt) {
    const L = S.L, car = ctx.car, c = S.c;
    if (!L) return;
    LOT.blinkLeds(ctx.time);
    const tgt = v2.set(car.pos.x, 0.8, car.pos.z);
    for (const k of L.cams) {
        if (!k.head) continue;
        k.head.getWorldPosition(v1);
        const dx = tgt.x - v1.x, dz = tgt.z - v1.z;
        // (the head sits in the course's turned frame: aim in its parent's space)
        const yaw = Math.atan2(dx, dz) - c.phi, pitch = Math.atan2(v1.y - tgt.y, Math.hypot(dx, dz));
        k.yaw += wrapAngle(yaw - k.yaw) * Math.min(1, dt * 6);
        k.pitch += (pitch - k.pitch) * Math.min(1, dt * 6);
        k.head.rotation.y = k.yaw;
        k.head.rotation.x = k.pitch;
        const dist = v1.distanceTo(tgt);
        k.beam.scale.z = Math.max(0.5, dist - 1.4);
        k.beamMat.map.repeat.y = k.beam.scale.z / 0.7;
        k.beamMat.map.offset.y -= dt * 1.8;
        k.beamMat.opacity = S.phase === "drive" ? 0.7 : 0.35;
    }
    if (L.chevron) {
        L.chevron.visible = S.phase === "drive" || S.phase === "setup";
        L.chevron.position.y = 2.4 + Math.sin(ctx.time * 3) * 0.25;
        L.chevron.rotation.y += dt * 1.5;
    }
    if (L.sasquatch) {
        const lc = local(c, _b);
        const o = L.sasquatch.obj;
        o.rotation.y += wrapAngle(Math.atan2(lc.x - o.position.x, lc.z - o.position.z) - o.rotation.y) * Math.min(1, dt * 3);
        L.sasquatch.update(dt, { cheer: S.result === "success", talk: S.result === "fail" });
    }
    const p = c.person;
    if (p) { p.face(car.pos.x, car.pos.z, dt, 4); p.update(dt, { cheer: S.result === "success" && S.phase === "result", talk: S.result === "fail" && S.phase === "result" }); }
    if (S.flashT > 0) { S.flashT -= dt; PH.flash(S.flashT / 0.2); } else PH.flash(0);
    if (S.bubble) S.bubble.sprite.position.y = S.bubble.baseY + Math.sin(ctx.time * 4) * 0.08;
    if (S.bubble && (S.bubble.life -= dt) <= 0 && S.bubble.temp) removeBubble();
}

// ── success / fail ───────────────────────────────────────────────────────
function calcStars() {
    if (S.perfect && !S.touched) return 3;
    if (!S.touched) return 2;
    return 1;
}

function success() {
    S.result = "success";
    S.phase = "result"; S.t = 0;
    S.resultT = 2.6;
    notes([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.18, "triangle", 0.22]], 0.1);
    rumble(0.3, 0.7, 300, true);
    const stars = calcStars();
    const bonus = S.level * 25 + stars * 15;
    S.stars = stars; S.bonus = bonus;
    addCoins(bonus, "parking");
    S.chCoins += bonus;
    S.chStars += stars;
    const lvl = S.level;
    shared.update(s => {
        s.parkingTotalStars = (s.parkingTotalStars || 0) + stars;
        if (stars === 3) s.parkingPerfectRuns = (s.parkingPerfectRuns || 0) + 1;
        if (lvl > (s.parkingBestLevel || 0)) s.parkingBestLevel = lvl;
    });
    P3.parks++; saveSoon();
    emit("stat", { id: "parks", n: 1 });
    emit("stat", { id: "parks3", n: 1 });          // the weekly "Parallel Pro" (the pull-over's quest, now the course's)
    if (stars === 3) emit("stat", { id: "perfectParks", n: 1 });
    emit("parking:result", { stars, coins: bonus, level: S.level, mode: "challenge", ok: true });
    showBubble(ctx.car.obj, "YAY!", 2.5, 2.4, true, 0);
    PH.vignette(0);
    showBoard(S.c, [stars >= 3 ? "PERFECT!" : "PARKED!", "⭐".repeat(stars) + "☆".repeat(3 - stars), `+${bonus} 💰`], stars >= 3 ? "#2E7D32" : "#1565C0", 3.2);
    H.toast(`🅿️ Level ${S.level}: ${"⭐".repeat(stars)} · +${bonus} 💰`, "gold");
    say(S.c, pick(LINES.yay), 2.6);
}

function fail() {
    if (S.phase !== "drive") return;
    S.result = "fail";
    S.phase = "result"; S.t = 0;
    S.resultT = 3.2;
    A.sfxCrash(0.9);
    setTimeout(wompWomp, 300);
    rumble(1, 1, 450, true);
    S.lives--;
    P3.fails++; saveSoon();
    emit("parking:result", { stars: 0, coins: 0, level: S.level, mode: "challenge", ok: false, fail: S.failHit && S.failHit.who });
    PH.vignette(0);
    const who = S.failHit && S.failHit.who;
    showBoard(S.c, ["CRASH!", FAIL_MSGS[who] || FAIL_MSGS.parked, S.lives > 0 ? `♥ ${S.lives} left` : "no lives left"], "#C62828", 3.6);
    H.toast(`🅿️ CRASH! ${FAIL_MSGS[who] || FAIL_MSGS.parked} · ♥ ${Math.max(0, S.lives)} left`, "red");
    // the angry grandpa climbs out of the car she dinged (or storms over from the sidewalk)
    if (models.parking_angryman) {
        const ang = spawnPerson("parking_angryman");
        const fromCar = S.failHit && S.failHit.car;
        const lc = local(S.c, _b);
        if (fromCar) ang.obj.position.set(fromCar.obj.position.x, 0, fromCar.obj.position.z + 1.7);
        else ang.obj.position.set(lc.x - 4, 0.15, S.L.curbZ - 1.0);
        S.L.G.add(ang.obj);
        S.angry = { person: ang, t: 0 };
    }
}
function removeAngry() { if (S.angry) { S.angry.person.obj.removeFromParent(); S.angry = null; } }

function updateResult(dt, P) {
    const c = S.c;
    drive(dt, P, true);
    S.resultT -= dt;
    const lc = local(c, _a);
    updateCones(dt, false, lc);
    updatePed(dt, false, lc);
    updateTraffic(dt, lc);
    animateLevel(dt);
    if ((P.confirm || P.start) && S.resultT > 0.3 && S.t > 0.4) S.resultT = 0.1;   // ✕ skips
    H.prompt(S.resultT > 0.3 && S.t > 0.4 ? `${glyph("confirm")} continue` : "");
    const car = ctx.car;
    if (S.result === "success") {
        for (let i = 0; i < 2; i++) {
            const col = [[1, 0.5, 0.67], [1, 0.84, 0], [0.31, 0.76, 0.97], [0.5, 0.78, 0.52], [1, 0.72, 0.3]][Math.floor(Math.random() * 5)];
            car.fx.emit(car.pos.x + (Math.random() - 0.5) * 10, 6 + Math.random() * 2, car.pos.z + (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 1.5, -1.5 - Math.random() * 2, (Math.random() - 0.5) * 1.5, 0.28, 2.2, col);
        }
    } else {
        const a = S.angry;
        if (a) {
            a.t += dt;
            const o = a.person.obj;
            const lx = Math.cos(lc.h), lz = -Math.sin(lc.h);
            const side = (o.position.x - lc.x) * lx + (o.position.z - lc.z) * lz >= 0 ? 1 : -1;
            const tx = lc.x + lx * 2.0 * side, tz = lc.z + lz * 2.0 * side;
            const d = Math.hypot(tx - o.position.x, tz - o.position.z);
            if (d > 0.15) {
                const sp = Math.min(d, 2.2 * dt);
                o.position.x += (tx - o.position.x) / d * sp;
                o.position.z += (tz - o.position.z) / d * sp;
                if (o.position.z > S.L.curbZ) o.position.y = 0;
                o.rotation.y += wrapAngle(Math.atan2(tx - o.position.x, tz - o.position.z) - o.rotation.y) * Math.min(1, dt * 10);
                a.person.update(dt, { walk: 2.2 });
            } else {
                o.rotation.y += wrapAngle(Math.atan2(lc.x - o.position.x, lc.z - o.position.z) - o.rotation.y) * Math.min(1, dt * 8);
                a.person.update(dt, { talk: true, wave: true });
                if (!a.yelled) { a.yelled = true; showBubble(o, "WHO TAUGHT YOU\nTO DRIVE!?", 2.4, 99, false); tone(200, 0.15, "sawtooth", 0.08); }
            }
        }
    }
    if (S.resultT > 0) return;
    // what's next
    H.prompt("");
    removeBubble();
    removeAngry();
    if (S.result === "success") {
        if (S.level >= 10) { endRun("victory"); return; }
        S.level++;
    } else if (S.lives <= 0) { endRun("lives"); return; }
    S.phase = "box"; S.t = 0; S.boxT = 0;
    say(c, S.result === "success" ? "Pull out into the lane — next one's tighter!" : pick(LINES.nay), 2.6);
}

// ── between levels: pull out into the lane and stop — the crew re-sets the course round her ─────────
const LANE_Z = 7.2;
const inLane = lc => lc.z > LANE_Z && lc.z < CO.COURSE.farZ && lc.x > CO.COURSE.x0 + 1.5 && lc.x < CO.COURSE.x1;
function updateBox(dt, P) {
    drive(dt, P);
    if (leftCourse()) return;
    S.hitCd = Math.max(0, S.hitCd - dt);
    collideParked(local(S.c, _a), false);
    const lc = local(S.c, _a);
    updateCones(dt, false, lc);
    updatePed(dt, false, lc);
    updateTraffic(dt, lc);
    animateLevel(dt);
    const there = inLane(lc);
    if (!there) { const p = CO.toWorld(S.c, clamp(lc.x, -6, 6), 9.6, _b); beacon("parkBox", p.x, p.z, "#1E88E5", 2.0, 8); } else hideBeacon("parkBox");
    S.boxT = there && ctx.car.speed < 0.6 ? S.boxT + dt : 0;
    H.prompt(there ? `🅿️ Level ${S.level} — stop here…` : `🅿️ Level ${S.level} — pull out into the lane and stop`);
    if (S.boxT >= BOX_STOP) { hideBeacon("parkBox"); H.prompt(""); S.phase = "setup"; S.t = 0; S.built = false; }
}

// ── the HUD: one chip (the level, lives, stars, coins, the clock) + the prompt line ─────────
function chipHtml() {
    const low = S.phase === "drive" && S.timeLeft <= 10;
    const t = S.phase === "drive" || S.phase === "result" ? `<span class="${low ? "pk-low" : ""}">⏱ ${Math.max(0, Math.ceil(S.timeLeft || 0))}s</span>` : "⏱ —";
    return `🅿️ <b>LVL ${S.level}</b> · ♥ ${Math.max(0, S.lives)} · ★ ${S.chStars} · 💰 ${S.chCoins} · ${t}<small>${LOT.LEVEL_NAMES[Math.min(Math.max(S.level, 1) - 1, 9)]}</small>`;
}
let chipEl = null, chipLast = "";
function chip(html) {
    if (!html) { if (chipEl) { chipEl.remove(); chipEl = null; chipLast = ""; } return; }
    if (!chipEl) { chipEl = document.createElement("div"); chipEl.className = "day-chip park-chip"; H.hudSlot("left").appendChild(chipEl); }
    if (html !== chipLast) { chipLast = html; chipEl.innerHTML = html; }
}

// ── the attendant's board (the result, held up over his head) + what he says ─────────
function boardTexture(lines, bg) {
    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = 320;
    const g = cv.getContext("2d");
    g.fillStyle = "#FFF8E1"; g.fillRect(0, 0, 512, 320);
    g.fillStyle = bg; g.fillRect(0, 0, 512, 92);
    g.strokeStyle = "#5D4037"; g.lineWidth = 10; g.strokeRect(5, 5, 502, 310);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#fff"; g.font = "bold 64px Fredoka, Arial, sans-serif"; g.fillText(lines[0], 256, 50, 480);
    g.fillStyle = "#2b1b2e";
    for (let i = 1; i < lines.length; i++) { g.font = `bold ${i === 1 ? 56 : 44}px Fredoka, Arial, sans-serif`; g.fillText(lines[i], 256, 92 + (i - 0.5) * (228 / (lines.length - 1)), 480); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}
function showBoard(c, lines, bg, secs) {
    hideBoard();
    if (!c) return;
    const tex = boardTexture(lines, bg);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
    sp.scale.set(1.9, 1.19, 1);
    sp.renderOrder = 8;
    const at = CO.attendantPoint(c);
    sp.position.set(at.x, 2.75, at.z);
    ctx.scene.add(sp);
    S.board = { sprite: sp, tex, until: ctx.time + secs, c, t: 0 };
}
function hideBoard() {
    const b = S.board;
    if (!b) return;
    b.sprite.removeFromParent(); b.tex.dispose(); b.sprite.material.dispose();
    S.board = null;
}
function boardTick(dt) {
    const b = S.board;
    if (!b) return;
    b.t += dt;
    const k = Math.min(1, b.t / 0.25);
    b.sprite.scale.set(1.9 * k, 1.19 * k, 1);
    b.sprite.position.y = 2.75 + Math.sin(ctx.time * 2.4) * 0.05;
    if (ctx.time > b.until || (b.c && !b.c.chunk)) hideBoard();
}
function say(c, text, secs = 2.6) {
    if (!c || !c.person || !text) return;
    showBubble(c.person.obj, text, 2.45, secs, true);
}

// ── speech bubbles (3D sprites: they read the same in the car and on foot) ─────────
function showBubble(obj, text, y = 2.4, life = 2, temp = true, side = 0) {
    removeBubble();
    const sp = LOT.bubbleSprite(text, { w: text.length > 14 ? 3.4 : 2.6 });
    sp.position.set(side, y, 0);
    sp.scale.multiplyScalar(1 / (obj.scale.x || 1));
    obj.add(sp);
    S.bubble = { sprite: sp, baseY: y, life, temp, obj };
}
function removeBubble() {
    if (!S.bubble) return;
    S.bubble.sprite.removeFromParent();
    S.bubble.sprite.userData.dispose();
    S.bubble = null;
}
hook("hud", dt => { if (!S.active && S.bubble && (S.bubble.life -= dt) <= 0) removeBubble(); });

// ── the lot camera: 🎥 Lot cam (higher, further back: the bay and her car both in view) · Overhead · Chase ─────────
function lotCamera(dt) {
    if (!S.active || !S.c || P3.cam === 2) return false;           // Chase: the regular driving camera
    const c = S.c, car = ctx.car, cam = ctx.camera, portrait = cam.aspect < 1;
    const L = S.L;
    const lc = local(c, _a);
    let fov;
    if (!S.camInit) { S.camPos.copy(cam.position); _look(S.camLook, cam); S.camYaw = car.h; S.camInit = true; }
    if (P3.cam === 1 && L) {
        // overhead: frame Lulu AND her bay, the kerb at the top of the screen (like 2D)
        const bx = (L.zx0 + L.zx1) / 2, bz = (Math.max(L.curbZ, L.zz0) + L.zz1) / 2;
        const tx = lc.x * 0.55 + bx * 0.45, tz = lc.z * 0.55 + bz * 0.45 - 0.8;
        const sep = Math.hypot(lc.x - bx, lc.z - bz);
        const hgt = clamp(9.5 + sep * 0.6, 11, 21) * (portrait ? 1.45 : 1);
        const lk = CO.toWorld(c, tx, tz, _b), ps = CO.toWorld(c, tx, tz + hgt * 0.78, _c);
        v1.set(ps.x, hgt, ps.z); v2.set(lk.x, 0.4, lk.z);
        fov = portrait ? 62 : 50;
    } else {
        // lot cam: behind her heading (eased), high, looking a little ahead — reversing doesn't swing it round
        S.camYaw += wrapAngle(car.h - S.camYaw) * Math.min(1, dt * 2.2);
        const dist = 8.6 * (portrait ? 1.3 : 1), up = 6.4 * (portrait ? 1.25 : 1);
        v1.set(car.pos.x - Math.sin(S.camYaw) * dist, up, car.pos.z - Math.cos(S.camYaw) * dist);
        v2.set(car.pos.x + Math.sin(S.camYaw) * 2.2, 0.4, car.pos.z + Math.cos(S.camYaw) * 2.2);
        fov = portrait ? 70 : 56;
    }
    const rate = S.phase === "setup" ? 2.6 : 4;
    S.camPos.lerp(v1, Math.min(1, dt * rate));
    S.camLook.lerp(v2, Math.min(1, dt * rate * 1.4));
    cam.position.copy(S.camPos);
    const sh = save3d.settings.calm ? 0 : (ctx.G.shake || 0);
    if (sh > 0) { const k = sh * 0.3; cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k; }
    ctx.G.shake = Math.max(0, (ctx.G.shake || 0) - dt * 1.5);
    cam.lookAt(S.camLook);
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
    if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
    return true;
}
function _look(out, cam) { cam.getWorldDirection(out); out.multiplyScalar(8).add(cam.position); return out; }

// ── the pause menu: leave the challenge (she's just driving again, right where she is) ─────────
addMenuItem("pause", { id: "parkLeave", order: 87, cls: "alt", label: "🚗 Leave the Parking Challenge",
    visible: () => ctx.state === "parking" && S.active,
    action: () => { resume(); endRun("quit"); } });

// preload the level's props once she's near a course (so setting out a level never waits)
let preT = 0;
hook("hud", dt => {
    if ((preT -= dt) > 0 || !ctx.car) return;
    preT = 2;
    if (CO.nearestCourse(ctx.car.pos.x, ctx.car.pos.z, 220)) ensureModels(LOT.MODELS).catch(() => {});
});
on("title", () => { if (S.active) { S.active = false; clearLevel(false); } S.mark = null; S.autoAll = false; hideBoard(); });
on("run:start", () => { S.mark = null; hideBoard(); clearOffer(); });

// ── the tests' autopilot: a real reverse parallel park with her car's own physics (the "controls" hook, like the
//    banter autopilot), facing either way along the row — A: along the lane to beside the front car (backing up if
//    she's past it) · B: reverse, full lock, the tail swings in · C: reverse, counter-lock, straight · D: ease to the
//    bay's middle and stop. Between levels it backs out and pulls into the lane. Debug only: never on outside a test.
const WB = 2.56;
hook("controls", ctl => {
    if (!S.autoAll || !S.active || ctx.state !== "parking") return;
    const lc = local(S.c, _c), v = ctx.car.vF;
    const speed = sp => {
        if (sp > 0) { ctl.throttle = v < sp ? 0.8 : 0; ctl.brake = v > sp + 0.5 ? 0.5 : 0; }
        else if (sp < 0) { ctl.throttle = v < sp - 0.3 && v < -0.5 ? 0.4 : 0; ctl.brake = v > sp ? 0.9 : 0; }
        else { ctl.throttle = v < -0.5 ? 0.5 : 0; ctl.brake = v > 0.05 ? 0.7 : 0; }
    };
    ctl.handbrake = false; ctl.analog = true;
    const pursue = (tx, tz, sp) => {
        const err = wrapAngle(lc.h - Math.atan2(tx - lc.x, tz - lc.z));
        ctl.steer = clamp(err * 2.6, -1, 1); speed(sp);
    };
    if (S.phase === "box") {
        const away0 = Math.sign(-Math.sin(lc.h)) || 1;              // +1: facing −X
        const A = S.boxAuto || (S.boxAuto = { away: away0, st: lc.z < 5.2 && S.L ? "u1" : "u2" });
        const away = A.away;
        if (A.st === "u1") {
            // in the bay: back up to the car behind (a little room to swing out)
            const tx = away > 0 ? S.L.zx1 - 2.25 : S.L.zx0 + 2.25;
            const hT = away > 0 ? -Math.PI / 2 : Math.PI / 2, e = wrapAngle(lc.h - hT);
            ctl.steer = clamp(-e * 2.6, -1, 1); speed(-0.6);
            if (away * (tx - lc.x) <= 0.05) A.st = "u2";
            return;
        }
        if (A.st === "u2") {
            // pull out to a spot in the lane, then stop there
            const tx = clamp(lc.x - away * 3, -8, 8), tz = 9.4;
            pursue(tx, tz, 0.9);
            if (inLane(lc) && Math.abs(lc.z - tz) < 1.4) A.st = "stop";
            return;
        }
        speed(0); ctl.steer = 0;
        return;
    }
    S.boxAuto = null;
    if (S.phase !== "drive" || !S.L) return;
    const A = S.auto || (S.auto = { phase: "A", sgn: Math.abs(wrapAngle(lc.h - START_H_LOCAL)) < Math.PI / 2 ? 1 : -1 });
    const sgn = A.sgn, hT = sgn > 0 ? -Math.PI / 2 : Math.PI / 2, e = wrapAngle(lc.h - hT);
    const K = S.autoP || AUTO;
    const bx = (S.L.zx0 + S.L.zx1) / 2 + sgn * K.dx, bz = K.zT;
    const R = WB / Math.tan(0.62 / (1 + 1.1 / 13)), th = Math.acos(1 - K.dz / (2 * R));
    const xA = bx - sgn * 2 * R * Math.sin(th), zA = bz + K.dz;
    // (give way to the pedestrian when she's in front of where the car is going)
    const pd = S.L.ped;
    if (pd && pd.person.obj.visible && pd.state !== "fallen") {
        const o = pd.person.obj.position, dir = Math.sign(v) || (A.phase === "A" ? 1 : -1);
        const ax = (o.x - lc.x) * lc.fx + (o.z - lc.z) * lc.fz, sd = Math.abs((o.x - lc.x) * lc.fz - (o.z - lc.z) * lc.fx);
        if (ax * dir > 0 && Math.abs(ax) < 4.6 && sd < 2.0) { speed(0); return; }
    }
    const xS = xA - sgn * 4.0;
    if (A.phase === "A0") {
        // not enough run-up to line up: back up the lane first (straightening as she goes)
        const xR = xS + sgn * 8, left = sgn * (xR - lc.x);
        const eps = -sgn * clamp((zA - lc.z) * 0.45, -0.5, 0.5);
        ctl.steer = clamp(-wrapAngle(lc.h - (hT + eps)) * 2.6, -1, 1);
        speed(left > 1 ? -1.6 : left > 0.1 ? -0.6 : 0);
        if (left <= 0.1 && Math.abs(v) < 0.1) { A.phase = "A"; tr(A, lc); }
        return;
    }
    if (A.phase === "A" && !A.checked) {
        A.checked = true;
        if (sgn * (lc.x - xS) < 7) { A.phase = "A0"; tr(A, lc); return; }
    }
    if (A.phase === "A") {
        // forward along the lane to a little past the front car, lined up with the lane
        const left = sgn * (lc.x - xS);
        const eps = sgn * clamp((zA - lc.z) * 0.45, -0.7, 0.7);
        const err = wrapAngle(lc.h - (hT + eps));
        ctl.steer = clamp(err * 2.6, -1, 1);
        speed(left > 2.5 ? 2.0 : left > 0.15 ? 0.8 : 0);
        if (left <= 0.15 && Math.abs(v) < 0.1) { A.phase = "A2"; tr(A, lc); }
    } else if (A.phase === "A2") {
        // back up to beside the front car, keeping the line
        const left = sgn * (xA - lc.x);
        const eps = -sgn * clamp((zA - lc.z) * 0.45, -0.5, 0.5);
        const err = wrapAngle(lc.h - (hT + eps));
        ctl.steer = clamp(-err * 2.6, -1, 1);
        speed(left > 1.2 ? -1.2 : left > 0.1 ? -0.5 : 0);
        if (left <= 0.1 && Math.abs(v) < 0.08) { A.phase = "B"; tr(A, lc); }
    } else if (A.phase === "B") {
        ctl.steer = sgn; speed(-1.1);
        corners(lc, CORN);
        const rearZ = Math.min(CORN[2].z, CORN[3].z);
        if (sgn * e >= th || rearZ < S.L.curbZ + 0.25) { A.phase = "C"; tr(A, lc); }
    } else if (A.phase === "C") {
        ctl.steer = -sgn; speed(-1.1);
        if (sgn * e <= 0.03) { A.phase = "D"; tr(A, lc); }
    } else {
        const dx = sgn * (lc.x - bx);
        if (dx > 0.2) { speed(0.5); ctl.steer = clamp(e * 2.6, -1, 1); }
        else if (dx < -0.2) { speed(-0.5); ctl.steer = clamp(-e * 2.6, -1, 1); }
        else { speed(0); ctl.steer = 0; }
    }
}, -200);
const START_H_LOCAL = CO.START_H;
const AUTO = { dz: 1.6, zT: 3.9, dx: 0.3 };
const tr = (A, lc) => (S.trace = S.trace || []).push({ ph: A.phase, x: +lc.x.toFixed(2), z: +lc.z.toFixed(2), h: +lc.h.toFixed(2), v: +ctx.car.vF.toFixed(2) });

// test / debug hook
ctx.parking._debug = S;
ctx.parking.debug = {
    S, CO, LOT,
    /** Her car into the nearest live course's START box (stopped, facing along the row). */
    toBox(c = null) {
        c = c || CO.nearestCourse(ctx.car.pos.x, ctx.car.pos.z, 2000);
        if (!c) return false;
        const p = CO.startPoint(c);
        ctx.car.place(p.x, p.z, CO.hWorld(c, CO.START_H));
        ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0;
        const r = ctx.world.highway || ctx.world.road, n = r.nearest(p.x, p.z, c.s + 160, {});
        ctx.car.s = n.s; ctx.car.d = n.d;
        if (ctx.cam) ctx.cam.snap();
        return true;
    },
    /** Her car placed in the course at local (x, z) with local heading h. */
    place(x, z, h, v = 0) {
        const c = S.c || CO.nearestCourse(ctx.car.pos.x, ctx.car.pos.z, 2000);
        if (!c) return false;
        const p = CO.toWorld(c, x, z, {}), hw = CO.hWorld(c, h);
        ctx.car.place(p.x, p.z, hw);
        ctx.car.vx = Math.sin(hw) * v; ctx.car.vz = Math.cos(hw) * v; ctx.car.vF = v;
        return true;
    },
    /** The bay's middle (local) for the level that's out. */
    bay() { const L = S.L; return L ? { x: (L.zx0 + L.zx1) / 2, z: (Math.max(L.curbZ, L.zz0) + L.zz1) / 2 } : null; },
    local: () => S.c ? local(S.c, {}) : null,
    courses: () => CO.liveCourses().map(c => { const st = CO.startPoint(c), at = CO.attendantPoint(c), bt = CO.boothPoint(c); return { s: c.s, x: st.x, z: st.z, attendant: !!c.person, ax: at.x, az: at.z, bx: bt.x, bz: bt.z }; }),
    /** The autopilot on (parks every level + drives back to the START box) / off. */
    autopark(on = true, p = null) { S.autoAll = !!on; S.auto = null; S.boxAuto = null; S.autoP = p ? Object.assign({}, AUTO, p) : null; return true; },
    endRun, unlock, markCourse,
};
export { S as parkingSession };
