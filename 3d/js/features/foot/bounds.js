// features/foot/bounds.js — the SHAPE of being on foot (still chill, but not endless).
//
// Walking used to be free in every direction: an invisible wall 60 m out that
// she ground against, and nothing ever asking her to get back in a car. Now:
//
// SOFT WORLD EDGES (by |d|, metres from the centre line; houses sit at 23–33 m):
//   30 m  TALL GRASS (waist-high clumps) — she wades, ~70 % speed
//   42 m  THE MUD (soft sand in the desert) — squelch, ~45 % speed; linger and the mosquitoes find her
//   52 m  THE FENCE LINE — split rails, barbed wire, "NO TRESPASSING — THIS MEANS YOU, LULU".
//         Get within ~2 m and something turns her back: a territorial goose, a farm
//         dog, a sprinkler, mosquitoes. She turns and RUNS back toward the road for
//         a beat (input eased over, never a wall), and any push outward right at the
//         fence is damped smoothly, so she slides along it instead of grinding.
// GENTLE NUDGES BACK INTO A CAR (an "aimless" clock that runs while she just walks;
//   off-road it runs faster, doing something — talking, petting, busking, a door — winds it back):
//   ~40 s  sore feet ("these shoes were NOT made for this"): she walks slower, and a
//          bench shows up on the verge ahead (sit = feet better, maybe a heart)
//   ~70 s  Ima texts ("why is your location in a FIELD")
//   ~95 s  a ride pulls onto the shoulder beside her (a neighbour, a van, the Lakewood
//          Local bus): ✋ HOP IN, or it leaves after a while ("Suit yourself!")
//   then Ima / a ride every ~45 s, never two nudges within NUDGE.gap seconds
//   + walking IN the lanes for a while: a cop pulls alongside — "Ma'am, this is a
//     HIGHWAY." Keep at it and it's a mild ★ (a JAYWALKING warrant via ctx.law).
//
// None of it runs inside interiors / the wedding / anyone's cutscene (footRun isn't
// updating then), during a foot chase or any law flow (chases keep their own rules —
// only the fence itself stays solid, smoothly), in the Lakewood town (ctx.town.active)
// or a party (both fall back to the old far fence). The nudges are surprises, so they're
// gated with ctx.enabled("foot") && ctx.enabled("footbounds") (tests opt in).
import * as THREE from "three";
import { ctx, emit, pick, rand } from "../../core/ctx.js";
import { models, registerModels, ensureModels, instanced, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { facingRoad, HALF_ROAD } from "../../world.js";
import { registerKind } from "../../traffic.js";
import { audio } from "../../audio.js";
import { glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { heal, pavedAt } from "../../core/driving.js";
import { bubble, floater, hasBubble } from "./bubbles.js";

/** The terrain bands (|d| in metres) — tune here. */
export const EDGE = {
    grass: 30, grassFull: 35,     // tall grass fades in between these
    mud: 42, mudFull: 45,         // the mud
    fence: 52,                    // the fence line
    shoo: 50.2,                   // closer than this → something turns her back
    slowGrass: 0.7, slowMud: 0.45,
    mudLinger: 7,                 // seconds wallowing in the mud before the mosquitoes come
    shooDur: 1.5,                 // seconds she's turned round and running back
    oldFence: 60,                 // the old invisible fence (town / party fallback)
};
/** The nudges (seconds on the aimless clock) — tune here. */
export const NUDGE = {
    feet: 40, ima: 70, ride: 95, every: 45,
    gap: 22,                       // never two nudges closer than this (real seconds)
    offroad: 1.6,                  // the clock runs this much faster off the road (|d| > 14)
    engaged: 25,                   // doing something winds the clock back this much
    sore: 0.78,                    // walking speed with sore feet
    rideWait: 16,                  // how long a ride waits on the shoulder
    laneWarn: 10, laneStar: 12,    // seconds walking IN the lanes → a cop's warning → a mild ★
};

const LINES = {
    grass: ["Tall grass. Ticks. Love that for me. 🙄", "This is how horror movies start.", "Nature is SO itchy."],
    scrub: ["Tumbleweeds. Real ones. Huh.", "Is that a SNAKE? It's a stick. ...It moved.", "The desert is just a big beach with no water."],
    mud: ["These were SUEDE. Were. 😭", "SQUELCH. My shoe is GONE. ...found it.", "I'm in a MUD. On PURPOSE?!"],
    sand: ["Sand. In my shoes. Forever now.", "It's like a beach but nobody's HAPPY."],
    goose: ["NOPE. NOPE. NOPE.", "OK OK I'M GOING!!", "IT HAS TEETH ON ITS TONGUE!", "Not the goose. ANYTHING but the goose."],
    gooseSays: ["HONK!!", "HONK HONK!", "HSSSSSS 🪿", "HONK. (this means you, Lulu)"],
    dog: ["Good boy! GOOD BOY! ...bad boy!", "I'm LEAVING, I'm leaving!", "Bubbe, if I don't make it, the jewelry's yours."],
    dogSays: ["WOOF! WOOF!", "GRRRR 🐕", "BARK BARK!"],
    farmer: ["GET OFF MY LAND!", "Again with the city people!", "That's a PRIVATE field, missy!"],
    sprinkler: ["MY BLOWOUT!! 😱 That was SIXTY DOLLARS!", "Who waters a FIELD?!", "I'm baptised. Great. Wrong religion."],
    mosquito: ["They're eating me ALIVE. I'm a BUFFET. 🦟", "Jersey's state bird. Of COURSE.", "Ow. Ow. OW. I'm going!"],
    sore: ["These shoes were NOT made for this. 👠", "My feet are filing a COMPLAINT.", "I can feel my heels in my SOUL.", "Blisters. On my blisters. 😩"],
    sit: ["Ahhh. Bubbe was right about orthopedic shoes.", "Five minutes. Then I'm borrowing a car.", "This bench is my new best friend."],
    imaField: ["Lulu. Why is your location in a FIELD. 📍", "Find My says you're in a CORNFIELD. Are you being abducted?? Text back.",
        "Your little dot is in the middle of NOWHERE. Mrs. Klein's son went to a field once. Became a FARMER."],
    imaRoad: ["Why is your dot moving at 3 miles an hour?? Are you WALKING on the HIGHWAY?!",
        "I'm looking at your location. You're WALKING. Lulu. We have a CAR. I PAID for that car.",
        "Call me. Or get in a car and THEN call me. Hands-free!!",
        "Tatty says hitchhiking is how his cousin met his wife. That is NOT an endorsement."],
    rides: {
        sedan: ["Lulu?! Is that YOU? Get in, sweetie, you look like a lost GPS.", "Hop in! Your mother called me. Your mother called EVERYONE."],
        van: ["Need a lift? I'm going wherever you're going. My kids don't call.", "Carpool! There's a car seat. Sit on it. Nobody's judging."],
        truck: ["Hop in! Don't mind the chickens. They don't mind you.", "Need a lift? I haul sod. You look like you could use some."],
        foot_ridebus: ["🚌 Driver's on lunch. He says you can drive. He trusts you. He shouldn't."],
    },
    rideLeave: ["Suit yourself! 🙄", "Your loss, mamaleh!", "OK, enjoy your WALK. Weirdo."],
    cop: ["Ma'am. This is a HIGHWAY. 🚓", "Ma'am, the shoulder. Use the SHOULDER.", "Ma'am, this isn't a sidewalk, it's the interstate."],
};

registerModels({ foot_fence: "foot_fence", foot_trespass: "foot_trespass", foot_grass: "foot_grass", foot_mud: "foot_mud", foot_goose: "foot_goose" });
registerKind("foot_ridebus", { len: 10.6, halfW: 1.25, circles: [-3.6, -1.2, 1.2, 3.6], r: 1.3, mass: 5, model: "foot_bus", paint: false });
const MODELS = ["foot_fence", "foot_trespass", "foot_grass", "foot_mud", "foot_goose", "foot_bench"];

// ── tiny helpers (no per-frame allocation) ───────────────────────────────
const _p = {}, _n = {}, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(a, b) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function road() { return ctx.world.road; }
function chasing(F) { return !!(F.chase || (ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || F.disguise === "prison"); }
/** The soft edges apply (not in the town / a party — they have their own streets and rules). */
function edgesOn() { return !(ctx.town && ctx.town.active) && !(ctx.party && ctx.party.active); }
/** On someone's grounds off the highway (a rest area's lot / lawn — core's paved registry): no wilderness there. */
function onGrounds(F) { return Math.abs(F.d) > HALF_ROAD && pavedAt(F.s, F.d) >= 1; }
/** Terrain + shoos (not during a chase: chases keep their own rules). */
function calm(F) { return edgesOn() && F.phase === "walk" && !chasing(F) && !onGrounds(F); }
/** The nudges: calm, not mid-dialogue, and opted in (random surprises are test-gated). */
function nudgesOn(F) {
    return calm(F) && !ctx.dialogOpen && !H.screenOpen() && !(ctx.phone && ctx.phone.isOpen) && ctx.enabled("foot") && ctx.enabled("footbounds");
}
function dry() { const b = ctx.world.biomeAt(ctx.car ? ctx.car.s : 0) || {}; return b.name === "desert" || b.name === "strip"; }

// ── tiny synth (own context, after core audio unlocked) ───────────────────
let ac = null, out = null;
function actx() {
    if (!audio.ready || ctx.skipping) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC(); out = ac.createGain(); out.gain.value = 0.6; out.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
}
function tone(freq, dur, type = "sine", vol = 0.12, when = 0, slide = 0) {
    const a = actx(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03);
}
let noiseBuf = null;
function hiss(dur, freq, vol, when = 0) {
    const a = actx(); if (!a) return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = a.currentTime + when, src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(out); src.start(t); src.stop(t + dur + 0.05);
}
const SFX = {
    honk() { tone(430, 0.16, "sawtooth", 0.09, 0, 330); tone(410, 0.2, "sawtooth", 0.09, 0.2, 300); },
    bark() { tone(380, 0.08, "sawtooth", 0.12, 0, 240); tone(330, 0.1, "sawtooth", 0.11, 0.12, 200); },
    spray() { hiss(1.1, 3200, 0.16); },
    buzz() { tone(620, 0.5, "sawtooth", 0.03, 0, 660); tone(700, 0.45, "sawtooth", 0.025, 0.15, 640); },
    squelch() { hiss(0.18, 420, 0.25); tone(220, 0.14, "sine", 0.08, 0, 120); },
    chirp() { tone(900, 0.12, "sine", 0.1, 0, 1320); tone(1320, 0.12, "sine", 0.1, 0.16, 900); },
    sigh() { tone(330, 0.5, "sine", 0.06, 0, 220); },
};

// ── the scenery out there (pooled, foot-only: placed around her, re-laid as she moves) ──
const GRASS_N = 170, MUD_N = 40, FENCE_N = 76;
const V = { group: null, grass: null, mud: null, fence: null, signs: [], cell: null, biome: null, built: false };
function buildVisuals() {
    if (V.built || !models.foot_fence || !models.foot_grass || !models.foot_mud || !models.foot_trespass) return;
    V.built = true;
    V.group = new THREE.Group();
    V.group.name = "footBounds";
    V.fence = instanced(models.foot_fence, FENCE_N);
    V.grass = instanced(models.foot_grass, GRASS_N);
    V.mud = instanced(models.foot_mud, MUD_N);
    for (const inst of [V.fence, V.grass, V.mud]) {
        inst.finish();
        for (const im of inst.group.children) { im.frustumCulled = false; im.count = 0; }
        V.group.add(inst.group);
    }
    for (const im of V.mud.group.children) { im.castShadow = false; im.receiveShadow = true; }
    for (let i = 0; i < 2; i++) { const s = models.foot_trespass.clone(true); s.visible = false; V.signs.push(s); V.group.add(s); }
}
function setCount(inst, n) { for (const im of inst.group.children) { im.count = n; im.instanceMatrix.needsUpdate = true; } }
function tintFor(isDry) {
    const set = (inst, name, hex) => { for (const im of inst.group.children) if (im.material.name === name) im.material.color.set(hex); };
    set(V.grass, "TallGrass", isDry ? "#C2AE6E" : "#8DB255");
    set(V.grass, "GrassSeed", isDry ? "#E6D3A0" : "#D8C27A");
    set(V.mud, "Mud", isDry ? "#D9BC8C" : "#6B4A33");
    set(V.mud, "MudDark", isDry ? "#C9A877" : "#4A3222");
    set(V.mud, "MudWater", isDry ? "#E3C99B" : "#8C7A62");
}
function nearHouse(x, z, r) {
    for (const ch of ctx.world.activeChunks()) {
        for (const hh of ch.houses || []) if ((hh.x - x) ** 2 + (hh.z - z) ** 2 < r * r) return true;
    }
    return false;
}
function place(inst, i, x, z, rot, sc) {
    _q.setFromAxisAngle(UP, rot);
    _m.compose(_v.set(x, 0, z), _q, _s.setScalar(sc));
    inst.set(i, _m);
}
/** Lay the fence / grass / mud / signs out around her (only when she crosses a 3 m cell). */
function layout(F, force) {
    if (!V.built) return;
    const show = edgesOn();
    V.group.visible = show;
    if (!show) return;
    const cell = Math.floor(F.s / 3), isDry = dry();
    if (!force && cell === V.cell && isDry === V.biome) return;
    V.cell = cell;
    if (isDry !== V.biome) { V.biome = isDry; tintFor(isDry); }
    const rd = road(), w = ctx.world;
    // fence: 4 m sections, 60 m behind → 90 m ahead
    let n = 0;
    const f0 = Math.floor((F.s - 60) / 4);
    for (const side of [-1, 1]) {
        for (let k = 0; k < FENCE_N / 2 && n < FENCE_N; k++) {
            const s = (f0 + k) * 4 + 2;
            if (s < 4 || w.isReserved(s, side * EDGE.fence, 3)) continue;
            rd.point(s, side * EDGE.fence, _p);
            place(V.fence, n++, _p.x, _p.z, facingRoad(_p.h, side), 1);
        }
    }
    setCount(V.fence, n);
    // tall grass: two clumps per 3 m cell per side (deterministic, so it never shuffles)
    n = 0;
    for (const side of [-1, 1]) {
        for (let c = cell - 14; c <= cell + 27 && n < GRASS_N; c++) {
            for (let j = 0; j < 2 && n < GRASS_N; j++) {
                const h1 = hash(c * 2 + j, side + 7), h2 = hash(c * 2 + j, side + 19), h3 = hash(c * 2 + j, side + 31);
                const s = c * 3 + h1 * 3, d = side * (EDGE.grass + 0.5 + h2 * (EDGE.mudFull - EDGE.grass));
                if (s < 4 || w.isReserved(s, d, 2)) continue;
                rd.point(s, d, _p);
                if (nearHouse(_p.x, _p.z, 6.4)) continue;
                const edge = smooth(EDGE.grass, EDGE.grassFull, Math.abs(d));
                place(V.grass, n++, _p.x, _p.z, h3 * 6.28, (0.55 + 0.75 * edge) * (0.85 + h3 * 0.4));
            }
        }
    }
    setCount(V.grass, n);
    // mud: a patch every ~7 m per side
    n = 0;
    const m0 = Math.floor((F.s - 40) / 7);
    for (const side of [-1, 1]) {
        for (let k = 0; k < MUD_N / 2 && n < MUD_N; k++) {
            const c = m0 + k, h1 = hash(c, side + 101), h2 = hash(c, side + 113);
            const s = c * 7 + h1 * 3, d = side * (EDGE.mud + 2.6 + h2 * 3.2);
            if (s < 4 || w.isReserved(s, d, 3)) continue;
            rd.point(s, d, _p);
            place(V.mud, n++, _p.x, _p.z, _p.h + Math.PI / 2 + (h2 - 0.5) * 0.6, 1 + h1 * 0.45);
        }
    }
    setCount(V.mud, n);
    // NO TRESPASSING signs, one per side, just inside the fence ahead of her
    for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, sg = V.signs[i];
        const s = Math.round((F.s + 20 + i * 45) / 90) * 90 - i * 45 + 2;
        const d = side * (EDGE.fence - 0.7);
        sg.visible = s > 4 && !w.isReserved(s, d, 3);
        if (!sg.visible) continue;
        rd.point(s, d, _p);
        sg.position.set(_p.x, 0, _p.z);
        sg.rotation.y = facingRoad(_p.h, side);
    }
}

// ── the session ──────────────────────────────────────────────────────────
let current = null;          // () => F (set by index.js)
export function attach(getF) { current = getF; }

export function begin(F) {
    F.bx = {
        aim: 0, step: 0, next: NUDGE.feet, gapT: 0, count: 0, log: [],
        sore: false, soreK: 1, bench: null, ride: null, cop: null,
        laneT: 0, warned: false, starred: false,
        zone: "road", said: {}, mudT: 0, fxT: 0, quipT: 0,
        shoo: null, shooN: 0, shooCool: 0, critter: null, shoos: 0,
        spots: [],
    };
    ensureModels(MODELS).then(() => {
        buildVisuals();
        if (V.built && current && current() === F) { if (!V.group.parent) ctx.scene.add(V.group); layout(F, true); }
    }).catch(e => console.error("[foot] bounds models", e));
    if (ctx.law) ensureModels(["lawK9"]).catch(() => {});
    if (V.built) { ctx.scene.add(V.group); V.cell = null; layout(F, true); }
}

export function finish(F) {
    const B = F && F.bx;
    if (V.group && V.group.parent) V.group.parent.remove(V.group);
    if (!B) return;
    for (const rm of B.spots) rm();
    B.spots.length = 0;
    removeCritter(B);
    if (B.bench) { ctx.scene.remove(B.bench.obj); B.bench = null; }
    for (const k of ["ride", "cop"]) {
        const r = B[k];
        if (r && ctx.traffic.cars.includes(r.car)) leave(r);
        B[k] = null;
    }
    F.bx = null;
}

/** Something to do happened (talk, pet, busk, a door…): wind the aimless clock back. */
export function engaged(F, kind) {
    const B = F && F.bx;
    if (!B) return;
    B.aim = Math.max(0, B.aim - NUDGE.engaged);
    if (B.next - B.aim > NUDGE.every * 2) B.next = B.aim + NUDGE.every;
}

/** Speed multiplier for her walk/run right now (terrain × sore feet). */
export function speedMul(F) {
    const B = F.bx;
    if (!B) return 1;
    let k = B.soreK;
    if (B.shoo) return k * 0.92;          // adrenaline: the goose doesn't care about the mud, and neither does she
    if (calm(F)) {
        const ad = Math.abs(F.d);
        k *= 1 - (1 - EDGE.slowGrass) * smooth(EDGE.grass, EDGE.grassFull, ad);
        k *= 1 - (1 - EDGE.slowMud / EDGE.slowGrass) * smooth(EDGE.mud, EDGE.mudFull, ad);
    }
    return k;
}

/**
 * Turned round by a critter: override her wanted direction (toward the road, keeping
 * a little of her along-road motion). Writes out.x/out.z; returns true while it steers.
 */
export function steer(F, wx, wz, outV) {
    const B = F.bx;
    if (!B || !B.shoo) return false;
    const sh = B.shoo, h = F.h;
    const fx = Math.sin(h), fz = Math.cos(h);
    const along = clamp(wx * fx + wz * fz, -0.4, 0.4);
    // inward = −(outward normal) = (cos h · side, −sin h · side)
    const ix = Math.cos(h) * sh.side, iz = -Math.sin(h) * sh.side;
    const k = Math.min(1, sh.t / 0.25);          // ease the turn in over a quarter second
    let x = wx * (1 - k) + (ix + fx * along) * k, z = wz * (1 - k) + (iz + fz * along) * k;
    const l = Math.hypot(x, z) || 1;
    outV.x = x / l; outV.z = z / l;
    return true;
}

/**
 * After her velocity is set: right at the fence, the outward part of her velocity fades
 * smoothly to zero (she slides along it — no grinding). Also the town / party far fence.
 */
export function damp(F) {
    if (!F.bx || !edgesOn() || onGrounds(F)) return;
    const ad = Math.abs(F.d), side = Math.sign(F.d) || 1;
    const start = EDGE.fence - 2.0, stop = EDGE.fence - 0.5;
    if (ad < start) return;
    const nx = -Math.cos(F.h) * side, nz = Math.sin(F.h) * side;
    const vo = F.vel.x * nx + F.vel.z * nz;
    if (vo <= 0) return;
    const k = clamp((stop - ad) / (stop - start), 0, 1);
    const cut = vo * (1 - k * k);
    F.vel.x -= nx * cut; F.vel.z -= nz * cut;
}

/** Position limit (after the move). The soft edges keep her well inside it; it's only a safety net. */
export function limit(F, near, dt = 1 / 30) {
    // (F.outLim: she got out of a car parked out past the fence — the car drives the fields to 70 m — so she may walk
    //  where it stands; and the push back in is a quick glide, never a jump: stepping off a lawn's grounds, the limit
    //  falls from the old fence to the new one, and snapping that in one frame was a teleport of up to 8 m)
    const lim = Math.max((F.bx && edgesOn() && !onGrounds(F)) ? EDGE.fence - 0.35 : EDGE.oldFence, F.outLim || 0);
    const ad = Math.abs(near.d);
    if (ad <= lim) return;
    const push = Math.min(ad - lim, 12 * dt) * Math.sign(near.d);
    F.pos.x += Math.cos(near.h) * push; F.pos.z -= Math.sin(near.h) * push;
}

/** A little suffix for the ON FOOT chip. */
export function chip(F) { return F.bx && F.bx.sore ? ` <small>· 🦶 sore feet</small>` : ""; }

// ── per frame ────────────────────────────────────────────────────────────
export function update(F, dt) {
    const B = F.bx;
    if (!B) return;
    if (V.built && !V.group.parent && edgesOn()) { ctx.scene.add(V.group); V.cell = null; }
    layout(F, false);
    if (B.gapT > 0) B.gapT -= dt;
    if (B.shooCool > 0) B.shooCool -= dt;
    B.soreK += ((B.sore ? NUDGE.sore : 1) - B.soreK) * Math.min(1, dt * 1.5);
    updateCritter(F, B, dt);
    updateBench(F, B, dt);
    updatePull(F, B, B.ride, dt);
    updatePull(F, B, B.cop, dt);
    if (B.shoo) {
        B.shoo.t += dt;
        shooFx(F, B, dt);
        if (B.shoo.t >= B.shoo.dur || !calm(F)) { B.shoo = null; B.shooCool = 0.4; }
    }
    if (!calm(F)) { B.zone = onGrounds(F) && F.phase === "walk" && !chasing(F) ? "grounds" : "busy"; return; }
    terrain(F, B, dt);
    nudges(F, B, dt);
}

function terrain(F, B, dt) {
    const ad = Math.abs(F.d), side = Math.sign(F.d) || 1;
    const zone = ad >= EDGE.mud ? "mud" : ad >= EDGE.grass ? "grass" : ad > 9 ? "verge" : ad > HALF_ROAD ? "shoulder" : "lanes";
    const sp = Math.hypot(F.vel.x, F.vel.z);
    if (zone !== B.zone) {
        if ((zone === "grass" || zone === "mud") && !B.said[zone]) {
            B.said[zone] = true;
            const isDry = dry();
            if (!hasBubble(F.lulu.obj)) bubble(F.lulu.obj, pick(zone === "mud" ? (isDry ? LINES.sand : LINES.mud) : (isDry ? LINES.scrub : LINES.grass)), 2.4);
            if (zone === "mud") { floater(F.lulu.obj, isDry ? "🏜️ soft sand" : "SQUELCH 🥾", "#D7B98E", 1.4, 2.7); SFX.squelch(); }
        }
        B.zone = zone;
    }
    B.mudT = zone === "mud" ? B.mudT + dt : Math.max(0, B.mudT - dt * 2);
    // wading FX
    B.fxT -= dt;
    if (sp > 0.6 && (zone === "grass" || zone === "mud") && B.fxT <= 0) {
        B.fxT = zone === "mud" ? 0.12 : 0.2;
        const col = zone === "mud" ? (dry() ? [0.85, 0.74, 0.55] : [0.36, 0.25, 0.16]) : [0.55, 0.7, 0.33];
        ctx.car.fx.emit(F.pos.x + rand(-0.2, 0.2), 0.15, F.pos.z + rand(-0.2, 0.2), rand(-0.8, 0.8), rand(1.2, 2.4), rand(-0.8, 0.8), zone === "mud" ? 0.22 : 0.16, 0.5, col);
        if (zone === "mud" && Math.random() < 0.08) SFX.squelch();
    }
    // the edge: something turns her back
    if (!B.shoo && B.shooCool <= 0) {
        if (ad > EDGE.shoo) startShoo(F, B, side, null);
        else if (B.mudT > EDGE.mudLinger) startShoo(F, B, side, "mosquito");
    }
}

// ── the shoo ─────────────────────────────────────────────────────────────
const SHOO_ORDER = ["goose", "sprinkler", "dog", "mosquito"];
function startShoo(F, B, side, kind) {
    if (!kind) {
        kind = SHOO_ORDER[B.shooN % SHOO_ORDER.length];
        B.shooN++;
        if (kind === "dog" && !models.lawK9) kind = "goose";
        if (kind === "goose" && !models.foot_goose) kind = "sprinkler";
    }
    B.shoo = { kind, side, t: 0, dur: EDGE.shooDur + (kind === "dog" ? 0.4 : 0) };
    B.shoos++;
    B.mudT = 0;
    const L1 = F.lulu.obj;
    if (kind === "goose" || kind === "dog") spawnCritter(F, B, kind, side);   // (a sprinkler / mosquitoes let the last critter waddle off)
    if (kind === "goose") { SFX.honk(); bubble(L1, pick(LINES.goose), 1.9); }
    else if (kind === "dog") { SFX.bark(); bubble(L1, pick(LINES.dog), 2.0); }
    else if (kind === "sprinkler") { SFX.spray(); floater(L1, "💦 PSSHT-T-T-T-T", "#81D4FA", 1.5, 2.8); bubble(L1, pick(LINES.sprinkler), 2.2); }
    else { SFX.buzz(); floater(L1, "🦟🦟🦟 bzzzz", "#FFFFFF", 1.5, 2.8); bubble(L1, pick(LINES.mosquito), 2.2); }
    rumble(0.25, 0.4, 160);
    F.waveT = Math.max(F.waveT || 0, 1.0);    // arms up, flailing
    if (B.shoos === 1) H.toast("🌾 Only geese out here. The fun’s by the road!", "gold");
    emit("foot:shoo", { kind });
    emit("stat", { id: "footShooed", n: 1 });
}
function shooFx(F, B, dt) {
    const sh = B.shoo, p = F.pos;
    if (sh.kind === "sprinkler" && sh.t < 1.2) {
        // a jet arcing in from the fence line
        rd2(F.s, sh.side * (EDGE.fence - 0.5));
        const dx = p.x - _p.x, dz = p.z - _p.z, l = Math.hypot(dx, dz) || 1;
        for (let i = 0; i < 3; i++) ctx.car.fx.emit(_p.x, 0.4, _p.z, dx / l * rand(5, 8), rand(4.5, 6), dz / l * rand(5, 8), 0.16, 0.9, [0.62, 0.84, 1]);
    } else if (sh.kind === "mosquito") {
        for (let i = 0; i < 2; i++) {
            const a = rand(0, 6.28);
            ctx.car.fx.emit(p.x + Math.cos(a) * 0.6, rand(1.2, 1.9), p.z + Math.sin(a) * 0.6, -Math.sin(a) * 2, rand(-0.3, 0.3), Math.cos(a) * 2, 0.06, 0.4, [0.12, 0.12, 0.12]);
        }
    }
}
function rd2(s, d) { road().point(s, d, _p); return _p; }

// the goose (or the farm dog) that sees her off
function spawnCritter(F, B, kind, side) {
    if (B.critter && B.critter.kind === kind) {
        const c = B.critter; c.phase = "charge"; c.t = 0; c.side = side; return;
    }
    removeCritter(B);
    let p = null;
    try {
        if (kind === "goose") p = spawnPerson("foot_goose", { scale: 1.15 });
        else {
            p = spawnPerson("lawK9", { colors: { Vest: "#B08A63", Badge: "#B08A63", Eye: "#1B1B1B" } });
            p.obj.traverse(o => { if (o.isMesh && o.material.name === "Eye" && o.material.emissive) o.material.emissive.setRGB(0, 0, 0); });
        }
    } catch (e) { return; }
    rd2(F.s + 2.5, side * (EDGE.fence + 1.4));
    p.obj.position.set(_p.x, 0, _p.z);
    ctx.scene.add(p.obj);
    B.critter = {
        kind, p, side, t: 0, phase: "charge", sayT: 0.3, s: F.s,
        wings: [findNodes(p.obj, "Wing_L")[0], findNodes(p.obj, "Wing_R")[0]], neck: findNodes(p.obj, "Neck")[0],
    };
    if (kind === "dog") bubble(p.obj, pick(LINES.farmer), 2.2, { y: 1.6 });
}
function removeCritter(B) {
    if (B.critter) { ctx.scene.remove(B.critter.p.obj); B.critter = null; }
}
function updateCritter(F, B, dt) {
    const c = B.critter;
    if (!c) return;
    c.t += dt;
    const o = c.p.obj, goose = c.kind === "goose";
    const near = road().nearest(o.position.x, o.position.z, c.s, _n);
    c.s = near.s;
    let speed = 0, tx = F.pos.x, tz = F.pos.z;
    if (c.phase === "charge") {
        speed = goose ? 6.4 : 7.4;
        const dx = F.pos.x - o.position.x, dz = F.pos.z - o.position.z, dist = Math.hypot(dx, dz);
        if (dist < 1.4 || Math.abs(near.d) < EDGE.fence - 9) speed = 0;
        if (c.t > EDGE.shooDur + 0.8) { c.phase = "stand"; c.t = 0; }
    } else if (c.phase === "stand") {
        if (c.t > 2.6) { c.phase = "leave"; c.t = 0; }
    } else {
        rd2(c.s, c.side * (EDGE.fence + 3));
        tx = _p.x; tz = _p.z;
        speed = goose ? 1.6 : 2.4;
        if (Math.abs(near.d) > EDGE.fence + 2.5 || c.t > 8) { removeCritter(B); return; }
    }
    if (speed > 0) {
        const dx = tx - o.position.x, dz = tz - o.position.z, l = Math.hypot(dx, dz);
        if (l > 0.05) { const k = Math.min(l, speed * dt) / l; o.position.x += dx * k; o.position.z += dz * k; }
    }
    c.p.face(tx, tz, dt, 10);
    // hop the fence on the way in / out
    const fd = Math.abs(Math.abs(near.d) - EDGE.fence);
    o.position.y = fd < 1.0 && speed > 0 ? Math.sin((1 - fd) * Math.PI / 2) * (goose ? 1.1 : 0.9) : 0;
    c.p.update(dt, { walk: speed * 0.6 });
    const flap = c.phase === "leave" ? 0.15 : 0.9;
    if (c.wings[0]) c.wings[0].rotation.y = -Math.abs(Math.sin(ctx.time * 16)) * flap;
    if (c.wings[1]) c.wings[1].rotation.y = Math.abs(Math.sin(ctx.time * 16)) * flap;
    if (c.neck) c.neck.rotation.x = c.phase === "leave" ? 0 : 0.35 + Math.sin(ctx.time * 9) * 0.15;
    if (!goose) o.position.y += Math.abs(Math.sin(ctx.time * 14)) * 0.06 * (speed > 0 ? 1 : 0.2);
    c.sayT -= dt;
    if (c.sayT <= 0 && c.phase !== "leave") {
        c.sayT = 1.3;
        bubble(o, pick(goose ? LINES.gooseSays : LINES.dogSays), 1.1, { y: goose ? 1.25 : 1.4 });
        if (goose) SFX.honk(); else SFX.bark();
    }
}

// ── the nudges ───────────────────────────────────────────────────────────
function nudges(F, B, dt) {
    if (!nudgesOn(F)) return;
    const ad = Math.abs(F.d), off = ad > 14;
    B.aim += dt * (off ? NUDGE.offroad : 1);
    // walking down the travel lanes
    if (ad < HALF_ROAD - 0.4) B.laneT += dt; else B.laneT = Math.max(0, B.laneT - dt * 0.5);
    if (B.gapT > 0) return;
    // (only for a law-abiding Lulu: with a warrant out, a cop pulling up beside her is an arrest, not a nudge)
    const clean = !(ctx.law && ctx.law.wanted > 0);
    if (clean && !B.warned && B.laneT >= NUDGE.laneWarn && !B.cop) { if (copWarn(F, B)) return; }
    if (B.warned && !B.starred && B.laneT >= NUDGE.laneStar) { jaywalkStar(F, B); return; }
    if (B.aim < B.next) return;
    let kind = B.step === 0 ? "feet" : B.step === 1 ? "ima" : (B.step % 2 === 0 ? "ride" : "ima");
    if (kind === "ride" && (off || B.ride || !rideOffer(F, B))) kind = "ima";
    if (kind === "feet") soreFeet(F, B);
    else if (kind === "ima") imaText(F, B, off);
    fired(B, kind);
    B.step++;
    B.next = B.step === 1 ? NUDGE.ima : B.step === 2 ? NUDGE.ride : NUDGE.ride + NUDGE.every * (B.step - 2);
}
function fired(B, kind) {
    B.gapT = NUDGE.gap;
    B.count++;
    B.log.push(kind);
    emit("foot:nudge", { kind });
}

function soreFeet(F, B) {
    B.sore = true;
    bubble(F.lulu.obj, pick(LINES.sore), 2.6);
    floater(F.lulu.obj, "🦶 sore feet — slower", "#FFCC80", 1.8, 2.75);
    SFX.sigh();
    spawnBench(F, B);
}

function imaText(F, B, off) {
    const msg = pick(off ? LINES.imaField : LINES.imaRoad);
    if (ctx.phone && ctx.phone.text) { try { ctx.phone.text({ from: "IMA", emoji: "📱", color: "#E91E63", msg, dur: 5 }); return; } catch (e) { console.error(e); } }
    H.toast(`📱 IMA: ${msg}`, "pink");
}

// a bench on the verge just ahead (her side): ✋ SIT
function spawnBench(F, B) {
    if (B.bench || !models.foot_bench) return;
    const side = Math.sign(F.d) || 1, rd = road(), w = ctx.world;
    let s = F.s + 14;
    for (let i = 0; i < 6 && w.isReserved(s, side * 11.2, 1.5); i++) s += 9;
    rd.point(s, side * 11.2, _p);
    const obj = models.foot_bench.clone(true);
    obj.position.set(_p.x, 0, _p.z);
    obj.rotation.y = facingRoad(_p.h, side);
    ctx.scene.add(obj);
    const fx = Math.sin(obj.rotation.y), fz = Math.cos(obj.rotation.y);
    const bench = B.bench = { obj, s, side, x: _p.x, z: _p.z, sx: _p.x + fx * 0.75, sz: _p.z + fz * 0.75 };
    const rm = ctx.foot.addSpot({
        pos: () => ({ x: bench.sx, z: bench.sz }), r: 2.2, short: "SIT",
        label: () => (F.bx && F.bx.sore ? "🪑 SIT — rest your feet" : "🪑 SIT A SEC"),
        act: () => sitDown(F, bench),
    });
    B.spots.push(rm);
    bench.rm = rm;
}
function updateBench(F, B, dt) {
    const b = B.bench;
    if (!b || Math.abs(b.s - F.s) < 90) return;
    ctx.scene.remove(b.obj);
    if (b.rm) { b.rm(); B.spots.splice(B.spots.indexOf(b.rm), 1); }
    B.bench = null;
}
function sitDown(F, bench) {
    const B = F.bx;
    if (!B) return;
    let t = 0, said = false;
    const L1 = F.lulu;
    ctx.foot.script({
        update(dt) {
            t += dt;
            const o = L1.obj;
            if (t < 0.7) {   // shuffle over and turn round
                o.position.x += (bench.sx - o.position.x) * Math.min(1, dt * 6);
                o.position.z += (bench.sz - o.position.z) * Math.min(1, dt * 6);
                L1.face(bench.sx * 2 - bench.x, bench.sz * 2 - bench.z, dt, 10);
                L1.update(dt, { walk: 1.5 });
            } else {
                o.position.x += (bench.x + (bench.sx - bench.x) * 0.25 - o.position.x) * Math.min(1, dt * 8);
                o.position.z += (bench.z + (bench.sz - bench.z) * 0.25 - o.position.z) * Math.min(1, dt * 8);
                o.rotation.y = bench.obj.rotation.y;
                L1.update(dt, { sit: t < 3.4 });
                if (!said) {
                    said = true;
                    bubble(o, pick(LINES.sit), 2.4);
                    SFX.sigh();
                }
            }
            F.pos.set(o.position.x, 0, o.position.z);
            if (t < 3.6) return true;
            if (F.bx) {
                const wasSore = F.bx.sore;
                F.bx.sore = false;
                F.bx.aim = Math.max(0, F.bx.aim - 30);
                if (wasSore) floater(o, "🦶 feet: better", "#A5D6A7", 1.5, 2.6);
                if (wasSore && ctx.G.hearts < ctx.G.maxHearts) { heal(1); H.toast("❤️ +1 HEART — a good sit", "pink"); }
            }
            emit("stat", { id: "footBenchSits", n: 1 });
            return false;
        },
    });
}

// ── something pulls up on the shoulder beside her (a ride, or a cop) ──────
function pullUp(F, kind, { side, ahead = 4, onStop, wait = 4, data = {} }) {
    const T = ctx.traffic, dir = side >= 0 ? 1 : -1;
    const lane = dir * 5.25, shoulder = dir * (kind === "foot_ridebus" ? 8.2 : 7.9);
    let a = ahead;
    // don't stop on top of a parked car / her own car on that shoulder
    const busy = s => F.parked.some(pc => pc.side === dir && Math.abs(pc.s - s) < 9) || (F.car && F.car.stub && T.cars.includes(F.car.stub) && Math.abs(F.car.stub.s - s) < 9 && Math.sign(F.car.stub.d) === dir);
    for (let i = 0; i < 4 && busy(F.s + dir * a); i++) a += 10;
    const r = { kind, dir, lane, shoulder, ahead: a, phase: "in", t: 0, wait, onStop, data, car: null, said: false };
    r.car = T.add(kind, F.s - dir * 70, lane, dir, 16, { ai: (dt, c) => pullAi(F, r, dt, c), noNearMiss: true, keep: true });
    r.car.data.footPull = true;
    return r;
}
function pullAi(F, r, dt, c) {
    r.t += dt;
    if (r.phase === "in") {
        // aim for a spot just ahead of her; once close, commit to it (so a car pulling up beside
        // a Lulu who keeps walking still comes to a stop instead of crawling along forever)
        let target = r.stopS != null ? r.stopS : F.s + r.dir * r.ahead;
        if (r.stopS == null && (target - c.s) * r.dir < 12) r.stopS = target;
        const dist = (target - c.s) * r.dir;
        const want = Math.min(16, Math.sqrt(2 * 5 * Math.max(0, dist)));
        c.speed += clamp(want - c.speed, -9 * dt, 6 * dt);
        if (dist < 0.2) c.speed = Math.max(0, c.speed - 10 * dt);
        c.s += c.speed * r.dir * dt;
        if (dist < 22) { c.dTarget = r.shoulder; c.d += clamp(r.shoulder - c.d, -2.2 * dt, 2.2 * dt); }
        if (dist < 1.2 && c.speed < 0.4) { c.speed = 0; r.phase = "wait"; r.t = 0; if (r.onStop) r.onStop(r); }
    } else if (r.phase === "wait") {
        c.speed = 0;
        if (r.t > r.wait) { r.phase = "out"; r.t = 0; if (r.onLeave) r.onLeave(r); }
    } else {
        c.dTarget = r.lane;
        c.d += clamp(r.lane - c.d, -1.6 * dt, 1.6 * dt);
        c.speed = Math.min(18, c.speed + 5 * dt);
        c.s += c.speed * r.dir * dt;
        if (Math.abs(c.d - r.lane) < 0.05) { c.ai = null; c.keep = false; c.want = c.base = 18; }
    }
}
function updatePull(F, B, r, dt) {
    if (!r) return;
    if (!ctx.traffic.cars.includes(r.car)) {   // gone (driven off, or she got in)
        if (B.ride === r) B.ride = null;
        if (B.cop === r) B.cop = null;
        if (r.rm) { r.rm(); const i = B.spots.indexOf(r.rm); if (i >= 0) B.spots.splice(i, 1); r.rm = null; }
    }
}
function leave(r) {
    if (r.rm) { r.rm(); r.rm = null; }
    r.phase = "out"; r.t = 0;
    if (!r.car.ai) return;
    // keep driving it after the session ends (the ai closure only needs F.s while arriving)
}

function rideOffer(F, B) {
    if (!ctx.traffic || !models.sedan) return false;
    const side = Math.sign(F.d) || 1;
    const kind = models.foot_bus && Math.random() < 0.22 ? "foot_ridebus" : pick(["sedan", "sedan", "van", "truck"]);
    const r = pullUp(F, kind, {
        side, ahead: 4.5, wait: NUDGE.rideWait,
        onStop: rr => {
            const line = pick(LINES.rides[kind] || LINES.rides.sedan);
            ctx.foot.say(rr.car.obj, line, 3.2);
            A_beep();
            rr.rm = ctx.foot.addSpot({
                pos: () => (ctx.traffic.cars.includes(rr.car) ? { x: rr.car.x, z: rr.car.z } : null), r: kind === "foot_ridebus" ? 6.5 : 4.4,
                label: kind === "foot_ridebus" ? "🚌 HOP ON — free ride!" : "🚗 HOP IN — free ride!", short: "RIDE",
                act: () => hopIn(F, rr),
            });
            B.spots.push(rr.rm);
        },
    });
    r.onLeave = rr => {
        if (rr.rm) { rr.rm(); const i = B.spots.indexOf(rr.rm); if (i >= 0) B.spots.splice(i, 1); rr.rm = null; }
        ctx.foot.say(rr.car.obj, pick(LINES.rideLeave), 1.8);
        B.aim = Math.max(B.aim, B.next - NUDGE.every);   // no rush for the next one
    };
    B.ride = r;
    return true;
}
function A_beep() { tone(520, 0.12, "square", 0.05); tone(520, 0.12, "square", 0.05, 0.2); }
function hopIn(F, r) {
    const c = r.car;
    if (!ctx.traffic.cars.includes(c)) return;
    let colors = null;
    c.obj.traverse(o => { if (!colors && o.isMesh && o.material.name === "Paint") colors = { Paint: "#" + o.material.color.getHexString() }; });
    const bus = r.kind === "foot_ridebus";
    const v = { vtype: bus ? "bus" : "car", key: bus ? "foot_bus" : (c.spec.model || r.kind), colors, x: c.x, z: c.z, h: c.h, how: "hail" };
    ctx.traffic.remove(c);
    emit("stat", { id: "footRides", n: 1 });
    ctx.foot.drive(v);
    H.toast(bus ? "🚌 The bus has a NEW driver!" : "🚗 Free ride! (She's driving, of course.)", "gold");
}

// "Ma'am, this is a HIGHWAY."
function copWarn(F, B) {
    if (!models.cop) return false;
    const side = Math.sign(F.d) || 1;
    B.cop = pullUp(F, "cop", {
        side, ahead: 6, wait: 3.2,
        onStop: rr => {
            SFX.chirp();
            ctx.foot.say(rr.car.obj, pick(LINES.cop), 2.6, { cls: "cop" });
            H.toast("🚓 Warning: use the SHOULDER", "red");
            // the warning counts once it's been said; the clock to the ★ starts now
            if (F.bx === B) { B.warned = true; B.laneT = 0; B.gapT = Math.max(B.gapT, NUDGE.gap); }
        },
    });
    B.laneT = 0;
    fired(B, "cop");
    return true;
}
function jaywalkStar(F, B) {
    B.starred = true;
    B.laneT = 0;
    F.chaseCool = Math.max(F.chaseCool || 0, 25);   // a MILD ★: a ticket on file, not a foot chase on the spot
    fired(B, "star");
    SFX.chirp();
    if (ctx.law && ctx.law.addWarrant) {
        try { ctx.law.addWarrant(["JAYWALKING"]); } catch (e) { console.error(e); }
        H.toast("⭐ JAYWALKING. Mild. Embarrassing.", "red");
    } else H.toast("🚓 THE SHOULDER, Lulu.", "red");
    emit("foot:crime", { charges: ["JAYWALKING"], seen: true });
}

// ── test / debug surface (ctx.foot.bounds) ───────────────────────────────
export const api = {
    EDGE, NUDGE,
    get state() { const F = current && current(); return F ? F.bx : null; },
    /** Which band she's standing in: lanes | shoulder | verge | grass | mud | grounds (a rest area's lot / lawn) (busy: a chase / a scripted moment). */
    get zone() { const F = current && current(); return F && F.bx ? F.bx.zone : null; },
    get visuals() { return V.built ? { fence: V.fence.group.children[0].count, grass: V.grass.group.children[0].count, mud: V.mud.group.children[0].count, shown: !!(V.group.parent && V.group.visible) } : null; },
    debug: {
        shoo(kind) { const F = current && current(); if (!F || !F.bx) return false; startShoo(F, F.bx, Math.sign(F.d) || 1, kind || null); return true; },
        aim(v) { const F = current && current(); if (F && F.bx) F.bx.aim = v; },
    },
};
