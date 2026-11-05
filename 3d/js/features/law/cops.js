// features/law — the cops on the road.
//
//  • light bars that really flash (per-car emissive LightRed/LightBlue + glow
//    sprites + a red/blue wash on the asphalt) and a WebAudio siren with Doppler
//  • hidden roadside speed traps (copHide timing from the 2D SPAWN_CONFIG),
//    tucked behind a bush, a tree or a billboard, with a RADAR fuse you can brake out of
//  • patrol cars cruising in traffic (both directions — an oncoming cruiser that
//    clocks you pulls a U-turn) and the K9 unit
//  • the pursuit: real cruisers that chase, PIT-nudge and box Lulu in, crash
//    into traffic, get taken out by a good ram; BUSTED / EVADING meters; heat
//    stars that climb (3★ box-ins + K9 dogs, 4★ cop missiles, 5★ the chopper)
//  • APB call-ins, the open-warrant file, and the fugitive stretch after a jailbreak
import * as THREE from "three";
import { ctx, emit, addActor, setState, MPH, wrapAngle } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { models, cloneWithColors, findNodes, registerModels, ensureModels } from "../../models.js";
import { registerKind } from "../../traffic.js";
import { facingRoad, LANES_OURS } from "../../world.js";
import { input, rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { SPAWN, SPEEDING_MPH, APB_FAST, APB_SLOW, COP_PULLOVER } from "./data.js";
import { rand, pick, clamp, S, stat, patchLockup, clearLockup, fugitiveStars } from "./rules.js";

registerModels({ lawBillboard: "law_billboard", lawK9: "law_k9", lawMissile: "law_missile", lawChopper: "law_chopper" });
registerKind("lawK9car", { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.6, model: "cop", colors: { CopPaint: "#20242B", CopWhite: "#3A4048" } });

// ── state ────────────────────────────────────────────────────────────────
export const L = {
    chase: null,        // { reason, charges, msg, heat, t, bust, evade, units: [], hazardT… }
    units: [],          // every cop car we drive: { car, mode, slot, rig, … }
    traps: [],          // hidden roadside cops
    fug: null,          // { t, spot, posterT, copT, k9T, mslT, chopper }   (prison clothes)
    spawnT: {},         // copHide timer
    grace: 0,           // post-escape breather (no cop can pounce)
    apbCool: 22,        // spontaneous call-in cooldown
    wantedSpot: 0, wantedPatrolT: 0,
    patrolT: 0,
    hold: 0,            // ctx.law.hold(): suspend random cop events (tutorials, cutscenes)
    pending: null,      // an arrest requested from inside an event, run next frame
    radar: 0,
};
export const config = { traps: true, patrols: true, apb: true };

const tmpP = {}, tmpN = {}, tmpQ = {};
const _v = new THREE.Vector3();

// ── light bars ───────────────────────────────────────────────────────────
let glowTex = null;
function glow() {
    if (glowTex) return glowTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
}
const washGeo = new THREE.PlaneGeometry(1, 1);
/** Give a cop-car object its own flashable light bar (idempotent; survives traffic pooling). */
export function rig(obj) {
    if (obj.userData.lawRig) return obj.userData.lawRig;
    const red = [], blue = [];
    obj.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const n = o.material.name;
        if (n === "LightRed" || n === "LightBlue") { o.material = o.material.clone(); (n === "LightRed" ? red : blue).push(o.material); }
    });
    const spr = (color, x) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.position.set(x, 1.68, -0.28);
        s.scale.setScalar(2.4);
        s.visible = false;
        obj.add(s);
        return s;
    };
    const wash = new THREE.Mesh(washGeo, new THREE.MeshBasicMaterial({ map: glow(), color: "#ff2244", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    wash.rotation.x = -Math.PI / 2;
    wash.position.y = 0.07;
    wash.scale.setScalar(11);
    wash.visible = false;
    obj.add(wash);
    const r = { red, blue, sr: spr("#ff2a4a", -0.32), sb: spr("#3a7bff", 0.32), wash, on: null };
    obj.userData.lawRig = r;
    setRig(r, false, 0);
    return r;
}
export function setRig(r, on, t) {
    if (!r) return;
    if (!on) {
        if (r.on === false) return;
        r.on = false;
        for (const m of r.red) m.emissiveIntensity = 0.35;
        for (const m of r.blue) m.emissiveIntensity = 0.35;
        r.sr.visible = r.sb.visible = r.wash.visible = false;
        return;
    }
    r.on = true;
    const ph = (t * 1.9) % 1;
    const strobe = x => ((x * 6) % 1) < 0.55;
    const redOn = ph < 0.5 && strobe(ph), blueOn = ph >= 0.5 && strobe(ph - 0.5);
    for (const m of r.red) m.emissiveIntensity = redOn ? 9 : 0.5;
    for (const m of r.blue) m.emissiveIntensity = blueOn ? 9 : 0.5;
    r.sr.visible = redOn; r.sb.visible = blueOn;
    r.wash.visible = redOn || blueOn;
    r.wash.material.color.set(redOn ? "#ff2244" : "#2a62ff");
}

// ── helpers ──────────────────────────────────────────────────────────────
export function speeding() {
    const G = ctx.G;
    return !ctx.foot?.active && input.brake < 0.3 && (ctx.car.speed * MPH > SPEEDING_MPH || G.boosting);
}
/** The tutorial (meta) keeps ambient cop heat off, like the 2D tutorialCalm(). */
function calm() { try { return !!(ctx.meta && ctx.meta.calm && ctx.meta.calm()); } catch (e) { return false; } }
function canPounce() {
    return L.grace <= 0 && L.hold <= 0 && !L.chase && ctx.state === "playing" && !(ctx.G.tutorial) && !calm();
}
export function activeUnits() { return L.units.filter(u => u.car && !u.car.hit && u.mode === "chase"); }
function nearestUnit(list = L.units, onlyChase = false) {
    let best = null, bd = 1e9;
    const p = ctx.car.pos;
    for (const u of list) {
        if (!u.car || (onlyChase && (u.mode !== "chase" || u.car.hit))) continue;
        const d = Math.hypot(u.car.x - p.x, u.car.z - p.z);
        if (d < bd) { bd = d; best = u; }
    }
    return best ? { u: best, d: bd } : null;
}
/** Any cop (parked trap, patrol, cruiser) within r metres of (x, z). */
export function copNear(x, z, r = 40) {
    for (const u of L.units) if (u.car && Math.hypot(u.car.x - x, u.car.z - z) < r) return u;
    for (const t of L.traps) if (!t.gone && Math.hypot(t.x - x, t.z - z) < r) return t;
    return null;
}

// ── cop cars (traffic cars with our AI) ──────────────────────────────────
function addUnit(s, d, dir, speed, opts = {}) {
    const tr = ctx.traffic;
    const kind = opts.k9 ? "lawK9car" : "cop";
    const u = { mode: opts.mode || "patrol", slot: "rear", k9: !!opts.k9, spot: 0, pitT: rand(3, 6), t: 0, vmax: 38, siren: false, downT: 0 };
    const car = tr.add(kind, s, d, dir, speed, {
        keep: opts.mode === "chase", noNearMiss: opts.mode === "chase",
        data: { law: u },
        onRemove: () => { u.car = null; const i = L.units.indexOf(u); if (i >= 0) L.units.splice(i, 1); },
    });
    u.car = car;
    u.rig = rig(car.obj);
    setRig(u.rig, false, 0);
    car.onCrash = e => onCopCrash(u, e);
    L.units.push(u);
    if (opts.mode === "chase") toChase(u, opts.slot || "rear");
    return u;
}
/** Turn any of our cop cars into a pursuer (keeps where it is; oncoming ones U-turn). */
function toChase(u, slot = "rear") {
    const c = u.car;
    u.mode = "chase"; u.slot = slot; u.siren = true;
    c.keep = true; c.noNearMiss = true;
    if (!c.ai) { c.free = true; c.ai = (dt, car) => driveUnit(dt, car, u); }
}
function onCopCrash(u, e) {
    // gentle shoves from a cruiser never cost a heart; a real collision does
    if (u.mode === "chase" && u.car && u.car.hit && !u.downed) {
        u.downed = true;
        UI.say("💥 COP DOWN!", "gold");
        addScore(250, "copDown");
        if (L.chase && !L.chase.charges.includes("DESTROYING A POLICE CRUISER")) L.chase.charges.push("DESTROYING A POLICE CRUISER");
    }
    return e.impact > 8 ? undefined : false;
}

/** Free-mode driver for our cruisers: pursue / box in / pull over / haul away / give up. */
function driveUnit(dt, c, u) {
    const px = c.x, pz = c.z, ph = c.h, ps = c.s;
    steerUnit(dt, c, u);
    // never let a bad frame poison the cruiser (or anything that reads it) with NaN
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.h) || !Number.isFinite(c.speed)) {
        c.x = px; c.z = pz; c.h = Number.isFinite(ph) ? ph : 0; c.s = Number.isFinite(ps) ? ps : ctx.car.s; c.speed = 0;
    }
}
function steerUnit(dt, c, u) {
    const road = ctx.world.road, car = ctx.car;
    u.t += dt;
    road.nearest(c.x, c.z, c.s, tmpN);
    c.s = tmpN.s; c.d = tmpN.d;
    const lv = Math.max(0, car.vF), ls = car.s, ld = car.d;
    let tD = c.d, vT = 0;
    const heat = L.chase ? L.chase.heat : 1;
    if (u.mode === "chase") {
        u.pitT -= dt;
        let want = -7;             // where it wants to sit, relative to Lulu along the road
        let side = 0;
        if (u.slot === "rear2") { want = -15; side = ld > 3.5 ? -3.5 : 3.5; }
        else if (u.slot === "front") want = 11;
        else if (u.slot === "side") { want = -0.5; side = ld > 3.5 ? -3.3 : 3.3; }
        if (u.slot === "rear" && heat >= 2 && u.pitT < 0) { want = -2.4; if (u.pitT < -1.6) u.pitT = rand(4, 7) - heat * 0.4; }
        const err = ls + want - c.s;
        vT = lv + clamp(err * 0.9, -12, 18);
        const behind = c.s < ls - 2;
        if (u.slot === "front" && behind) tD = ld + (ld > 3.5 ? -3.5 : 3.5);   // overtake in the other lane…
        else if (u.slot === "front") { tD = ld; vT = Math.min(vT, lv - 2.5); } // …then merge in front and brake-check
        else tD = ld + side;
        if (u.slot === "side" && Math.abs(err) < 3) tD = ld + Math.sign(side) * 2.5;   // lean on her
        if (Math.hypot(c.x - car.pos.x, c.z - car.pos.z) > 70) tD = clamp(ld, -5.25, 5.25);
        u.vmax = 34 + heat * 2 + (ls - c.s > 160 ? 4 : 0);
    } else if (u.mode === "pull") {             // pull up behind her on the shoulder
        tD = Number.isFinite(u.pullD) ? u.pullD : 7.9;
        const err = (Number.isFinite(u.stopS) ? u.stopS : c.s) - c.s;
        vT = clamp(err * 1.1, 0, 22);
        if (err < 0.4) vT = 0;
        u.vmax = 30;
    } else if (u.mode === "haul") {             // drive Lulu downtown
        tD = 1.75; vT = 30; u.vmax = 32;
    } else if (u.mode === "giveup") {
        tD = clamp(c.d, 7.6, 7.9); vT = 0; u.vmax = 20;
    } else if (u.mode === "park") { vT = 0; u.vmax = 0; }

    // traffic in the way: pass (cops will use any lane) or slow down; bang into it if we can't
    if (u.mode === "chase" || u.mode === "haul") {
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        for (const o of ctx.traffic.cars) {
            if (o === c || o.hit || (o.data && o.data.law)) continue;
            const dx = o.x - c.x, dz = o.z - c.z;
            const lon = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
            if (lon > -1 && lon < 7 + c.speed * 0.6 && Math.abs(lat) < 2.3) {
                const alt = [o.d - 3.5, o.d + 3.5].filter(x => Math.abs(x) <= 5.4).sort((a, b) => Math.abs(a - tD) - Math.abs(b - tD));
                if (alt.length) tD = alt[0];
                if (lon < 9 && o.dir > 0) vT = Math.min(vT, o.speed + 1);
            }
            if (Math.hypot(dx, dz) < 2.1) {            // a real crash with traffic
                o.hit = true; o.hitT = 0; o.vx = fx * c.speed * 0.6; o.vz = fz * c.speed * 0.6; o.spinV = (Math.random() < 0.5 ? -1 : 1) * 3;
                c.hit = true; c.hitT = 0; c.vx = fx * c.speed * 0.4; c.vz = fz * c.speed * 0.4; c.spinV = (Math.random() < 0.5 ? -1 : 1) * 4;
                if (u.mode === "chase" && Math.hypot(c.x - car.pos.x, c.z - car.pos.z) < 120) { UI.say("💥 Cop pile-up!", "gold"); addScore(200, "copPileup"); }
                return;
            }
        }
    }
    vT = Math.min(vT, u.vmax);
    // steer: pure pursuit toward a look-ahead point in the target lane
    const la = Math.max(7, c.speed * 0.55);
    road.point(c.s + la, tD, tmpP);
    const want = Math.atan2(tmpP.x - c.x, tmpP.z - c.z);
    const dh = wrapAngle(want - c.h);
    if (Math.abs(dh) > 0.7) vT = Math.min(vT, 9);
    const v = Math.max(c.speed, 0.01);
    const maxYaw = Math.min(14 / v, v / 6, 2.0) * dt;
    c.h += clamp(dh, -maxYaw, maxYaw);
    c.speed += clamp(vT - c.speed, -16 * dt, 10 * dt);
    c.speed = Math.max(0, c.speed);
    c.x += Math.sin(c.h) * c.speed * dt;
    c.z += Math.cos(c.h) * c.speed * dt;
}

// ── hidden speed traps ───────────────────────────────────────────────────
function tickSpawn(dt) {
    const c = SPAWN.copHide;
    if (L.spawnT.copHide === undefined) L.spawnT.copHide = rand(c.first[0], c.first[1]);
    L.spawnT.copHide -= dt;
    if (L.spawnT.copHide > 0) return false;
    L.spawnT.copHide = rand(c.every[0], c.every[1]);
    return Math.random() < c.chance;
}
export function spawnTrap(sAhead = 240, side = Math.random() < 0.5 ? -1 : 1) {
    const road = ctx.world.road, car = ctx.car;
    const s = car.s + sAhead, dCop = side * rand(11.5, 13);
    const hides = ["bush", "tree"];
    if (models.lawBillboard) hides.push("billboard");
    const hide = pick(hides);
    const g = new THREE.Group();
    road.point(s, dCop, tmpP);
    const h = road.at(s).h;
    const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    const cop = cloneWithColors(models.cop);
    cop.position.set(tmpP.x, 0, tmpP.z);
    // nose angled toward the road and a little forward — ready to pounce
    cop.rotation.y = Math.atan2(-rx * side * 0.8 + fx * 0.6, -rz * side * 0.8 + fz * 0.6);
    const r = rig(cop);
    g.add(cop);
    // the cover, between the cruiser and the approaching traffic
    let prop = null;
    const pd = dCop - side * 3.4;
    road.point(s - 3, pd, tmpQ);
    if (hide === "billboard") {
        prop = cloneWithColors(models.lawBillboard);
        prop.rotation.y = facingRoad(h, side);
        prop.position.set(tmpQ.x, 0, tmpQ.z);
        const face = findNodes(prop, "Face")[0];
        if (face) face.traverse(o => { if (o.isMesh) o.material = billboardAd(); });
    } else if (hide === "tree") {
        prop = cloneWithColors(models.treeRound);
        prop.scale.setScalar(1.25);
        prop.position.set(tmpQ.x, 0, tmpQ.z);
    } else {
        prop = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const b = cloneWithColors(models.bush);
            b.scale.setScalar(1.5 + i * 0.2);
            road.point(s - 4.5 + i * 2.6, pd + (i - 1) * 0.4 * side, tmpQ);
            b.position.set(tmpQ.x, 0, tmpQ.z);
            prop.add(b);
        }
    }
    if (prop) g.add(prop);
    ctx.scene.add(g);
    const trap = { obj: g, cop, rig: r, s, d: dCop, side, hide, x: tmpP.x, z: tmpP.z, h: cop.rotation.y, spot: 0, gone: false, near: false };
    L.traps.push(trap);
    addActor({
        update() { return ctx.car.s - trap.s < 140; },
        collide(pcar) {
            if (trap.gone) return null;
            const imp = pcar.collideStatic(trap.x, trap.z, 1.5);
            return imp ? { impact: imp, why: "You hit a parked COP CAR?!", source: "cop" } : null;
        },
        dispose() { ctx.scene.remove(g); trap.gone = true; trap.dead = true; const i = L.traps.indexOf(trap); if (i >= 0) L.traps.splice(i, 1); },
    });
    return trap;
}
const ADS = [["BUBBE'S CHOLENT", "Hot every Friday · since 1962"], ["HESHY'S POOLS", "Cannonball approved 🏊"], ["DRIVE SAFE", "Bubbe is watching"],
    ["RUGELACH WORLD", "Exit 12 · open late"], ["AVIGAIL'S NAILS", "Fabulous, guaranteed 💅"]];
const adMats = [];
function billboardAd() {
    if (adMats.length < ADS.length) {
        const [a, b] = ADS[adMats.length];
        adMats.push(new THREE.MeshStandardMaterial({ map: posterTexture([a, b], ["#E91E63", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA"][adMats.length], "#fff"), roughness: 0.7 }));
    }
    return pick(adMats);
}
function posterTexture(lines, bg, fg, mug = false) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 14; g.strokeRect(20, 20, 984, 472);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    const x = mug ? 640 : 512;
    g.font = `700 ${mug ? 120 : 110}px Fredoka, Arial, sans-serif`;
    g.fillText(lines[0], x, mug ? 140 : 200, mug ? 680 : 940);
    g.font = "600 60px Fredoka, Arial, sans-serif";
    lines.slice(1).forEach((l, i) => g.fillText(l, x, (mug ? 270 : 340) + i * 80, mug ? 680 : 940));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function updateTraps(dt, controlsOn) {
    const car = ctx.car;
    L.radar = 0;
    for (const t of L.traps) {
        if (t.gone) continue;
        setRig(t.rig, false, 0);
        const rel = car.s - t.s;
        const inView = rel > -70 && rel < 12;
        if (inView) t.near = true;
        if (controlsOn && canPounce() && inView && speeding()) {
            t.spot += dt;
            L.radar = Math.max(L.radar, t.spot / 0.65);
            if (t.spot >= 0.65) { trapToChase(t); return; }
        } else {
            t.spot = Math.max(0, t.spot - dt * 1.5);
            L.radar = Math.max(L.radar, t.spot / 0.65);
        }
        if (t.near && !t.passed && rel > 12) {
            t.passed = true;
            if (controlsOn && !L.chase) { addScore(150, "legal"); H.toast("👮 Nice and legal! +150", "gold"); }
        }
    }
}
/** The parked cruiser pulls out and becomes the pursuer. */
function trapToChase(t) {
    t.gone = true;
    t.obj.remove(t.cop);
    const u = addUnit(t.s, t.d, 1, 0, { mode: "chase" });
    const c = u.car;
    c.free = true; c.x = t.x; c.z = t.z; c.h = t.h;
    c.obj.position.set(c.x, 0, c.z); c.obj.rotation.y = c.h;
    beginChase("SPEEDING", { msg: "🚨 SPEED TRAP!", unit: u });
}

// ── patrols ──────────────────────────────────────────────────────────────
export function spawnPatrol(opts = {}) {
    const car = ctx.car;
    const r = Math.random();
    let u;
    if (opts.oncoming ?? r < 0.45) u = addUnit(car.s + rand(380, 460), pick([-1.75, -5.25]), -1, rand(18, 22), opts);
    else if (opts.fast ?? r < 0.7) u = addUnit(car.s - rand(60, 80), pick(LANES_OURS), 1, rand(29, 33), opts);
    else u = addUnit(car.s + rand(300, 360), pick(LANES_OURS), 1, rand(13, 15), opts);
    if (opts.aggro) { toChase(u, "rear"); u.hunter = true; u.siren = false; }
    return u;
}
function updatePatrols(dt, controlsOn) {
    const car = ctx.car, fug = L.fug;
    for (const u of L.units.slice()) {
        if (!u.car) continue;
        const c = u.car;
        const lit = u.siren && (u.mode === "chase" || u.mode === "pull" || u.mode === "haul" || u.mode === "park");
        setRig(u.rig, lit || u.mode === "park", ctx.time + (u.phase || (u.phase = Math.random())));
        if (c.hit && c.hitT > 2.8 && u.mode === "chase") {       // shake it off and get back in the chase
            c.hit = false; c.speed = 0; c.free = true; c.h = c.obj.rotation.y; u.downed = false;
            if (!c.ai) c.ai = (d, cc) => driveUnit(d, cc, u);
        }
        if (u.mode === "giveup" && (u.t > 22 || car.s - c.s > 170)) { c.keep = false; }
        if (u.flavour) updateFlavourUnit(dt, u);
        if (u.mode !== "patrol" && !u.hunter) continue;
        if (!controlsOn || !canPounce()) { u.spot = Math.max(0, u.spot - dt); continue; }
        const dist = Math.hypot(c.x - car.pos.x, c.z - car.pos.z);
        const sees = dist < (u.hunter ? 45 : 34);
        if (fug) continue;                  // the fugitive "recognised" meter handles these
        if (sees && speeding()) {
            u.spot += dt;
            if (u.spot > 0.7) { toChase(u, "rear"); beginChase("SPEEDING", { msg: u.k9 ? "🐕 K9 UNIT!" : "🚨 PATROL!", unit: u }); return; }
        } else u.spot = Math.max(0, u.spot - dt * 1.5);
    }
}

// ── the pursuit ──────────────────────────────────────────────────────────
/**
 * Start a chase. reason = a plain-language charge ("SPEEDING", "GRAND THEFT AUTO"…).
 * opts: { msg, charges[], heat (stars), unit (an existing cop unit to lead) }
 */
export function beginChase(reason, opts = {}) {
    if (L.chase) {                                   // already running: pile the new charge on, turn up the heat
        if (reason && !L.chase.charges.includes(reason)) L.chase.charges.push(reason);
        for (const c of opts.charges || []) if (!L.chase.charges.includes(c)) L.chase.charges.push(c);
        L.chase.heat = Math.min(5, Math.max(L.chase.heat, opts.heat || 0) + 1);
        UI.say(opts.msg || "🚨 MORE UNITS!", "red");
        return true;
    }
    const fug = !!L.fug;
    const charges = (opts.charges || []).slice();
    const heat = Math.max(1, opts.heat || (fug ? fugitiveStars(L.fug.t) : S.wanted.length ? 2 : 1));
    L.chase = { reason: reason || charges[0] || "RECKLESS DRIVING", charges, explicit: !!(opts.charges && opts.charges.length), heat, t: 0,
        bust: 0, evade: 0, nextHeat: 22, k9T: 3, mslT: 3, reinfT: 0, fug };
    if (!L.chase.charges.length) L.chase.charges.push(L.chase.reason);
    if (opts.unit) { opts.unit.slot = "rear"; if (opts.unit.mode !== "chase") toChase(opts.unit, "rear"); opts.unit.hunter = false; opts.unit.siren = true; }
    else spawnChaser("rear");
    H.banner(`<b>${opts.msg || "🚨 BUSTED!"}</b><small>${L.chase.reason} · floor it to get away!</small>`, 2200);
    X.whoop();
    rumble(0.5, 0.7, 400, true);
    ctx.G.shake = Math.max(ctx.G.shake || 0, 0.4);
    ensureCopModels();
    emit("cop:chase", { active: true, reason: L.chase.reason, heat });
    return true;
}
function spawnChaser(slot) {
    const car = ctx.car;
    const fromAhead = slot === "front" && Math.random() < 0.5;
    const s = fromAhead ? car.s + rand(160, 220) : car.s - rand(70, 95);
    const d = fromAhead ? pick([-1.75, -5.25]) : pick(LANES_OURS);
    const u = addUnit(s, d, fromAhead ? -1 : 1, fromAhead ? 20 : Math.max(20, car.speed + 4), { mode: "chase", slot, k9: L.chase && L.chase.heat >= 4 && Math.random() < 0.4 });
    return u;
}
const SLOTS = ["rear", "front", "side", "rear2"];
function updateChase(dt, controlsOn) {
    const ch = L.chase, car = ctx.car;
    if (!controlsOn) return;
    ch.t += dt;
    // heat climbs the longer she runs (fugitive heat follows her time on the lam)
    if (ch.fug && L.fug) ch.heat = Math.max(ch.heat, fugitiveStars(L.fug.t));
    if (ch.t > ch.nextHeat && ch.heat < 5) { ch.heat++; ch.nextHeat = ch.t + 22; UI.say(`🚨 ${"★".repeat(ch.heat)} MORE UNITS!`, "red"); X.whoop(); }
    // reinforcements by heat: 1 · 2 · 2 · 3 · 4 cruisers
    const want = [0, 1, 2, 2, 3, 4][ch.heat];
    const units = L.units.filter(u => u.mode === "chase" && u.car);
    ch.reinfT -= dt;
    if (units.length < want && ch.reinfT <= 0 && units.length < 4) {
        const taken = new Set(units.map(u => u.slot));
        const slot = SLOTS.find(s => !taken.has(s) && (s !== "front" || ch.heat >= 3) && (s !== "side" || ch.heat >= 3)) || "rear2";
        spawnChaser(slot);
        ch.reinfT = 4;
    }
    // 3★+ the K9 dogs, 4★+ the missiles (2D cadences)
    if (ch.heat >= 3) { ch.k9T -= dt; if (ch.k9T <= 0) { ch.k9T = Math.max(2.2, rand(4.5, 7) - ch.heat * 0.4); if (ctx.enabled("law")) spawnK9(); } }
    if (ch.heat >= 4) { ch.mslT -= dt; if (ch.mslT <= 0) { ch.mslT = Math.max(2.4, rand(4, 6) - (ch.heat - 4) * 0.7); if (ctx.enabled("law")) fireMissile(); } }
    if (ch.heat >= 5) ensureChopper();

    // BUSTED meter: a cruiser on top of her while she's slow (or boxed in)
    const near = nearestUnit(L.units, true);
    const close = units.filter(u => !u.car.hit && Math.hypot(u.car.x - car.pos.x, u.car.z - car.pos.z) < 12).length;
    const sp = car.speed;
    let fill = 0;
    if (near && near.d < 10 && sp < 10) fill = 0.9 * (1 - sp / 10) + (close >= 2 ? 0.45 : 0);
    if (near && near.d < 22 && sp < 2) fill = Math.max(fill, 1.2);
    ch.bust = clamp(ch.bust + (fill > 0 ? fill * dt : -0.5 * dt), 0, 1);
    if (ch.bust >= 1) { bust(near ? near.u : null); return; }
    // EVADING meter: get far enough away from every cruiser (the chopper halves it)
    const gap = near ? near.d : 999;
    const need = 80 + 15 * ch.heat;
    if (gap > need || !units.some(u => !u.car.hit)) ch.evade = clamp(ch.evade + dt / (L.chopper ? 4.4 : 2.2), 0, 1);
    else ch.evade = Math.max(0, ch.evade - dt * 0.6);
    if (ch.evade >= 1) escape();
}

function escape() {
    const ch = L.chase;
    endChase("escaped");
    UI.say("Lost 'em! 😎", "green");
    H.banner(`<b>😎 LOST 'EM!</b><small>${ch.heat > 1 ? `${ch.heat}★ heat shaken off` : "Back to cruising"}</small>`, 2000);
    X.lost();
    addScore(500 * ch.heat, "escape");
    stat("escapes2", 1);
    L.apbCool = rand(12, 20);
    L.grace = 5;
}

/** Wind down: cruisers kill the sirens and drift onto the shoulder. */
export function endChase(result = "ended") {
    const ch = L.chase;
    if (!ch) return;
    L.chase = null;
    for (const u of L.units) {
        if (u.mode === "chase" && u.car) { u.mode = "giveup"; u.siren = false; u.t = 0; u.car.keep = true; }
    }
    removeChopper();
    X.sirenOff();
    emit("cop:chase", { active: false, result, reason: ch.reason });
}

/** She's been run down: hand over to the pull-over scene. */
function bust(u) {
    const ch = L.chase;
    if (!u) u = activeUnits()[0];
    if (!u) { endChase("ended"); return; }
    L.chase = null;
    removeChopper();
    for (const o of L.units) if (o !== u && o.mode === "chase" && o.car) { o.mode = "giveup"; o.siren = true; o.t = 0; }
    emit("cop:chase", { active: false, result: "busted", reason: ch.reason });
    setState("lawBust", { unit: u, reason: ch.reason, charges: ch.explicit ? ch.charges.slice() : null,
        extra: ch.charges.filter(c => c !== ch.reason), fugitive: !!L.fug });
}

// ── random cop events while driving ──────────────────────────────────────
function updateRandom(dt, controlsOn) {
    const G = ctx.G;
    if (!controlsOn || !ctx.enabled("law") || L.hold > 0 || calm()) return;
    // hidden traps
    if (config.traps && tickSpawn(dt) && G.runTime > 15 && !L.chase && L.traps.length < 2) spawnTrap();
    // patrol cars cruising the road (rare)
    const patrols = L.units.filter(u => u.mode === "patrol").length;
    if (config.patrols && G.runTime > 20 && !L.chase && patrols < 1 && Math.random() < dt * 0.03) spawnPatrol({ k9: false });
    // the APB: the longer the run, the more often a cruiser "gets the call"
    if (config.apb && canPounce() && car().speed > 12) {
        L.apbCool -= dt;
        if (L.apbCool <= 0) {
            const lvl = Math.floor(G.runTime / 30);
            if (lvl >= 2) {
                const fast = speeding();
                const chance = clamp(0.14 + 0.07 * (lvl - 2), 0, 0.65) * (fast ? 1.4 : 0.55);
                if (Math.random() < chance) {
                    beginChase(fast ? "RECKLESS DRIVING" : "FAILURE TO PULL OVER", { msg: pick(fast ? APB_FAST : APB_SLOW) });
                    L.apbCool = rand(15, 24) - Math.min(lvl, 7);
                } else L.apbCool = rand(4, 7);
            } else L.apbCool = 6;
        }
    }
    // flavour: a cruiser pulls somebody ELSE over up ahead
    L.flavourT -= dt;
    if (L.flavourT <= 0 && !L.chase) { L.flavourT = rand(45, 80); startFlavour(); }
    // the open-warrant file: any cop who gets a look at her gives chase
    const wanted = S.wanted;
    if (wanted.length && !L.fug && canPounce()) {
        const seen = L.units.some(u => u.car && u.mode === "patrol" && Math.hypot(u.car.x - car().pos.x, u.car.z - car().pos.z) < 40)
            || L.traps.some(t => !t.gone && car().s - t.s > -60 && car().s - t.s < 10);
        if (seen) {
            L.wantedSpot += dt * (speeding() ? 1.2 : 0.55);
            if (L.wantedSpot > 0.7) {
                L.wantedSpot = 0;
                const u = L.units.find(u => u.car && u.mode === "patrol");
                beginChase("OUTSTANDING WARRANT", { msg: "🚨 THAT'S HER — WANTED!", charges: wanted.slice(0, 3), unit: u });
            }
        } else L.wantedSpot = Math.max(0, L.wantedSpot - dt * 0.8);
        L.wantedPatrolT -= dt;
        if (L.wantedPatrolT <= 0) { L.wantedPatrolT = rand(5, 9); if (patrols < 2) spawnPatrol(); }
    }
}
const car = () => ctx.car;

// ── fugitive ─────────────────────────────────────────────────────────────
export function startFugitive(fugT = 0) {
    L.fug = { t: fugT, spot: 0, posterT: 1.2, copT: 2.5, k9T: rand(5, 8), mslT: rand(5, 8), saveT: 1 };
    prisonClothes(true);
}
export function endFugitive(msg) {
    if (!L.fug) return;
    L.fug = null;
    prisonClothes(false);
    for (const u of L.units) if (u.hunter && u.car) { u.hunter = false; u.mode = "giveup"; u.siren = false; u.t = 0; }
    removeChopper();
    if (msg) { H.banner(`<b>${msg}</b>`, 2400); X.lost(); }
}
function updateFugitive(dt, controlsOn) {
    const f = L.fug;
    if (!f || !controlsOn) return;
    f.t += dt;
    const wl = fugitiveStars(f.t);
    // lay-low fallback: survive long enough clean and the heat dies down
    if (f.t > 100 && !L.chase) { clearLockup(); endFugitive("😎 Laid low long enough — heat's off."); return; }
    f.saveT -= dt;
    if (f.saveT <= 0) { f.saveT = 1; patchLockup({ fugT: f.t }); }
    if (!ctx.enabled("law")) return;
    // WANTED posters keep going up
    f.posterT -= dt;
    if (f.posterT <= 0) { f.posterT = rand(7, 12); spawnPoster(); }
    // the heat escalates by stage: trickling cruisers, 3★ hunters, 4★ K9 units
    f.copT -= dt;
    if (f.copT <= 0) {
        f.copT = Math.max(3.4, 8.2 - wl * 0.7);
        if (L.units.filter(u => u.mode === "patrol" || u.hunter).length < 3) {
            const u = spawnPatrol({ k9: wl >= 4 && Math.random() < 0.4 });
            if (wl >= 3 && Math.random() < (wl >= 4 ? 0.7 : 0.2)) { toChase(u, "rear"); u.hunter = true; u.siren = false; }
        }
    }
    if (wl >= 3 && !L.chase) { f.k9T -= dt; if (f.k9T <= 0) { f.k9T = Math.max(2.2, rand(4.5, 7) - wl * 0.4); spawnK9(); } }
    if (wl >= 4 && !L.chase) { f.mslT -= dt; if (f.mslT <= 0) { f.mslT = Math.max(2.4, rand(4, 6) - (wl - 4) * 0.7); fireMissile(); } }
    if (wl >= 5) ensureChopper();
    if (L.chase || L.grace > 0) { f.spot = Math.max(0, f.spot - dt); return; }
    // RECOGNISED → a chase she gets a real shot at out-running
    const bustAt = Math.max(0.7, 1.6 - wl * 0.2);
    const pos = ctx.car.pos;
    const seen = L.units.find(u => u.car && !u.car.hit && Math.hypot(u.car.x - pos.x, u.car.z - pos.z) < 38)
        || L.traps.find(t => !t.gone && ctx.car.s - t.s > -60 && ctx.car.s - t.s < 10);
    if (wl >= 5) {
        f.spot += dt * 1.1;
        if (f.spot > bustAt) { f.spot = 0; beginChase("ESCAPE FROM CUSTODY", { msg: "🚁 SPOTLIGHT — FLOOR IT!", unit: seen && seen.car ? seen : null }); }
        return;
    }
    if (seen) {
        f.spot += dt * (1 + wl * 0.35);
        if (f.spot > bustAt) {
            f.spot = 0;
            if (seen.cop && !seen.car) trapToChaseFug(seen);
            else beginChase("ESCAPE FROM CUSTODY", { msg: "🚨 RECOGNIZED — DRIVE!", unit: seen.car ? seen : null });
        }
    } else f.spot = Math.max(0, f.spot - dt * 0.8);
}
function trapToChaseFug(t) {
    t.gone = true; t.obj.remove(t.cop);
    const u = addUnit(t.s, t.d, 1, 0, { mode: "chase" });
    Object.assign(u.car, { free: true, x: t.x, z: t.z, h: t.h });
    beginChase("ESCAPE FROM CUSTODY", { msg: "🚨 RECOGNIZED — DRIVE!", unit: u });
}

/** Lulu's in the orange jumpsuit (the driver's shirt in the car, too). */
let jumpsuitMat = null;
export function prisonClothes(on) {
    const m = ctx.car && ctx.car.model;
    if (!m) return;
    m.traverse(o => {
        if (!o.isMesh || !o.material) return;
        if (on && o.material.name === "Shirt") {
            if (!jumpsuitMat) { jumpsuitMat = o.material.clone(); jumpsuitMat.color.set("#FF6D2E"); jumpsuitMat.name = "ShirtJumpsuit"; }
            o.userData.lawShirt = o.material; o.material = jumpsuitMat;
        } else if (!on && o.userData.lawShirt) { o.material = o.userData.lawShirt; delete o.userData.lawShirt; }
    });
}

// ── WANTED posters ───────────────────────────────────────────────────────
let mugTex = null;
/** A real 3D mugshot (Lulu in the jumpsuit vs. the height lines) rendered once to a texture. */
export function mugshot() {
    if (mugTex || !models.luluPerson || !ctx.renderer) return mugTex;
    const rt = new THREE.WebGLRenderTarget(256, 256);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color("#C9D3DC");
    sc.add(new THREE.HemisphereLight("#ffffff", "#8a8a8a", 2.2));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.position.set(1, 2, 3); sc.add(sun);
    for (let i = 0; i < 6; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(3, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: "#5c6a78" }));
        line.position.set(0, 1.0 + i * 0.15, -0.6);
        sc.add(line);
    }
    const p = cloneWithColors(models.luluPerson, { Top: "#FF6D2E", Bottom: "#FF6D2E" });
    sc.add(p);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 1.5, 2.2); cam.lookAt(0, 1.42, 0);
    const r = ctx.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(rt); r.render(sc, cam); r.setRenderTarget(prev);
    mugTex = rt.texture;
    return mugTex;
}
let posterMat = null;
function spawnPoster() {
    if (!models.lawBillboard) return;
    const road = ctx.world.road, side = Math.random() < 0.5 ? -1 : 1;
    const s = ctx.car.s + rand(250, 300), d = side * 13.5;
    road.point(s, d, tmpP);
    const h = road.at(s).h;
    const b = cloneWithColors(models.lawBillboard);
    b.position.set(tmpP.x, 0, tmpP.z);
    b.rotation.y = facingRoad(h, side);
    if (!posterMat) posterMat = new THREE.MeshStandardMaterial({ map: posterTexture(["WANTED", "LULU BRUCK", `REWARD 💰${400}`], "#F3E5C0", "#7A1F1A", true), roughness: 0.8 });
    const face = findNodes(b, "Face")[0];
    if (face) face.traverse(o => { if (o.isMesh) o.material = posterMat; });
    const tex = mugshot();
    if (tex) {
        const mug = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: tex }));
        mug.position.set(-1.6, 4.75, 0.08);
        b.add(mug);
        b.userData.mug = mug;
    }
    ctx.scene.add(b);
    const posts = [-2, 2].map(o => { road.point(s + o, d, tmpQ); return { x: tmpQ.x, z: tmpQ.z }; });
    addActor({
        update() { return ctx.car.s - s < 80; },
        collide(pc) {
            for (const q of posts) {
                const imp = pc.collideStatic(q.x, q.z, 0.3);
                if (imp) return { impact: imp, why: "Lulu vs. her own WANTED poster", source: "sign" };
            }
            return null;
        },
        dispose() { ctx.scene.remove(b); if (b.userData.mug) b.userData.mug.geometry.dispose(); },
    });
    UI.say("🪧 WANTED: LULU", "red");
}

// ── K9 dogs ──────────────────────────────────────────────────────────────
export function spawnK9() {
    if (!models.lawK9) { ensureCopModels(); return; }
    const road = ctx.world.road, car = ctx.car;
    // loosed from a cruiser up ahead if there is one, else from the roadside
    const lead = L.units.find(u => u.car && u.car.s > car.s + 20 && u.car.s < car.s + 140);
    let s = lead ? lead.car.s - 3 : car.s + rand(70, 95), d = lead ? lead.car.d : pick([1.75, 5.25, -1.75]);
    const dog = cloneWithColors(models.lawK9);
    dog.scale.setScalar(1.25);
    ctx.scene.add(dog);
    const legs = ["Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR"].map(n => findNodes(dog, n)[0]).filter(Boolean);
    const tail = findNodes(dog, "Tail")[0], head = findNodes(dog, "Head")[0];
    let t = 0, barkT = rand(0.3, 0.9), hit = false;
    X.bark();
    UI.say("🐕 K9 LOOSE!", "gold");
    addActor({
        update(dt) {
            t += dt;
            s -= 9 * dt;
            d += (car.d - d) * Math.min(1, 0.9 * dt);     // soft homing — a lane change can shake the dog
            road.point(s, d, tmpQ);
            const h = road.at(s).h + Math.PI;
            dog.position.set(tmpQ.x, Math.abs(Math.sin(t * 9)) * 0.12, tmpQ.z);
            dog.rotation.y = h;
            legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 18 + (i % 2 ? 0 : Math.PI) + (i > 1 ? 1.2 : 0)) * 0.8; });
            if (tail) tail.rotation.x = Math.sin(t * 14) * 0.5;
            if (head) head.rotation.x = Math.sin(t * 9) * 0.08;
            barkT -= dt;
            if (barkT <= 0) { barkT = rand(0.6, 1.2); if (Math.abs(car.s - s) < 60) X.bark(); }
            return !hit && car.s - s < 40;
        },
        collide(pc) {
            const dx = dog.position.x - pc.pos.x, dz = dog.position.z - pc.pos.z;
            if (hit || dx * dx + dz * dz > 2.6 * 2.6 || ctx.G.invT > 0) return null;
            hit = true;
            UI.say("🐕 CHOMP!", "red");
            return { impact: 8, why: "🐕 The K9 got your bumper!", source: "law:k9" };
        },
        dispose() { ctx.scene.remove(dog); },
    });
}

// ── cop missiles ─────────────────────────────────────────────────────────
export function fireMissile() {
    if (!models.lawMissile) { ensureCopModels(); return; }
    const road = ctx.world.road, car = ctx.car;
    const lead = L.units.find(u => u.car && u.car.s > car.s + 20 && u.car.s < car.s + 160);
    let s = lead ? lead.car.s - 3 : car.s + rand(110, 130), d = lead ? lead.car.d : pick([1.75, 5.25]);
    const m = cloneWithColors(models.lawMissile);
    m.scale.setScalar(1.3);
    ctx.scene.add(m);
    let t = 0, hit = false;
    X.missileLaunch();
    UI.say("🚀 INCOMING!", "red");
    addActor({
        update(dt) {
            t += dt;
            s -= 22 * dt;
            d += (car.d - d) * Math.min(1, 1.25 * dt);
            road.point(s, d, tmpQ);
            const h = road.at(s).h + Math.PI;
            m.position.set(tmpQ.x, 1.0 + Math.sin(t * 7) * 0.05, tmpQ.z);
            m.rotation.set(0, h, Math.sin(t * 9) * 0.3);   // nose (+Z after export) points back down the road at Lulu
            if (Math.random() < 0.8) car.fx.emit(tmpQ.x - Math.sin(h) * 1.1, 1.0, tmpQ.z - Math.cos(h) * 1.1, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.45, 0.5, [1, 0.55 + Math.random() * 0.3, 0.15]);
            return !hit && car.s - s < 30;
        },
        collide(pc) {
            const dx = m.position.x - pc.pos.x, dz = m.position.z - pc.pos.z;
            if (hit || dx * dx + dz * dz > 2.4 * 2.4 || ctx.G.invT > 0) return null;
            hit = true;
            X.boom();
            pc.fx.burst(m.position.x, 1, m.position.z, 30, 7, [1, 0.6, 0.2], 0.7, 0.8);
            pc.fx.burst(m.position.x, 1, m.position.z, 16, 3, [0.4, 0.4, 0.42], 1.6, 1.4);
            return { impact: 11, why: "🚀 A cop MISSILE?! Really?!", source: "law:missile" };
        },
        dispose() { ctx.scene.remove(m); },
    });
}

// ── the chopper (5★) ─────────────────────────────────────────────────────
export function ensureChopper() {
    if (L.chopper || !models.lawChopper) { if (!models.lawChopper) ensureCopModels(); return; }
    const g = cloneWithColors(models.lawChopper);
    g.rotation.order = "YXZ";
    const r = rig(g);
    const rotor = findNodes(g, "Rotor")[0], tail = findNodes(g, "TailRotor")[0];
    // the searchlight: a soft cone + a pool of light on the road (no real light → no shader recompiles)
    const coneMat = new THREE.MeshBasicMaterial({ color: "#fffbe0", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 4.2, 1, 24, 1, true), coneMat);
    const pool = new THREE.Mesh(washGeo, new THREE.MeshBasicMaterial({ map: glow(), color: "#fff6c8", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.scale.setScalar(10);
    ctx.scene.add(g, cone, pool);
    const ch = { g, r, rotor, tail, cone, pool, t: 0, x: ctx.car.pos.x, z: ctx.car.pos.z - 40, thumpT: 0 };
    L.chopper = ch;
    H.banner(`<b>🚁 POLICE AIR UNIT</b><small>They've got eyes in the sky!</small>`, 2000);
    addActor({
        update(dt) {
            if (L.chopper !== ch) return false;
            ch.t += dt;
            const car = ctx.car;
            const tx = car.pos.x - Math.sin(car.h) * 8 + Math.cos(ch.t * 0.4) * 6, tz = car.pos.z - Math.cos(car.h) * 8;
            ch.x += (tx - ch.x) * Math.min(1, dt * 1.6); ch.z += (tz - ch.z) * Math.min(1, dt * 1.6);
            const y = 21 + Math.sin(ch.t * 1.3) * 1.2;
            g.position.set(ch.x, y, ch.z);
            g.rotation.set(0.12, car.h, Math.sin(ch.t * 0.9) * 0.06);   // nose (+Z) leans into the chase
            if (rotor) rotor.rotation.y += dt * 38;
            if (tail) tail.rotation.x += dt * 50;
            setRig(r, true, ctx.time * 1.4);
            const sway = Math.sin(ch.t * 1.1) * 2.5;
            const px = car.pos.x + Math.cos(car.h) * sway, pz = car.pos.z - Math.sin(car.h) * sway;
            pool.position.set(px, 0.08, pz);
            const sx = ch.x, sz = ch.z, sy = y - 0.9;
            const len = Math.hypot(px - sx, sy, pz - sz);
            cone.position.set((sx + px) / 2, sy / 2, (sz + pz) / 2);
            cone.scale.set(1, len, 1);
            cone.lookAt(px, 0, pz); cone.rotateX(Math.PI / 2);
            ch.thumpT -= dt;
            if (ch.thumpT <= 0) { ch.thumpT = 0.09; X.rotorThump(0.5); }
            return true;
        },
        dispose() { ctx.scene.remove(g, cone, pool); cone.geometry.dispose(); coneMat.dispose(); pool.material.dispose(); if (L.chopper === ch) L.chopper = null; },
    });
}
export function removeChopper() { L.chopper = null; }

// ── per-frame (from hooks.update) ────────────────────────────────────────
export function update(dt, P, controlsOn) {
    if (L.grace > 0) L.grace -= dt;
    if (L.hold > 0) L.hold -= dt;
    if (L.pending) { const p = L.pending; L.pending = null; p(); return; }
    if (ctx.state === "arriving" && L.chase) {   // safe at Bubbe's — the cops won't follow her in there
        endChase("safe");
        H.toast("🏡 Safe at Bubbe's! The cops back off.", "pink");
    }
    updateTraps(dt, controlsOn);
    updatePatrols(dt, controlsOn);
    if (L.chase) updateChase(dt, controlsOn);
    updateFugitive(dt, controlsOn);
    updateRandom(dt, controlsOn);
    // the siren follows the nearest lit cruiser
    let loud = 0, closing = 0;
    const p = ctx.car.pos;
    for (const u of L.units) {
        if (!u.car || !u.siren || !(u.mode === "chase" || u.mode === "pull")) continue;
        const c = u.car, d = Math.hypot(c.x - p.x, c.z - p.z);
        const l = Math.pow(clamp(1 - d / 170, 0, 1), 1.4);
        if (l > loud) {
            loud = l;
            const ux = (p.x - c.x) / (d || 1), uz = (p.z - c.z) / (d || 1);
            closing = (Math.sin(c.h) * c.speed - ctx.car.vx) * ux + (Math.cos(c.h) * c.speed - ctx.car.vz) * uz;
        }
    }
    if (L.chase && loud < 0.15) loud = Math.max(loud, 0.15);
    X.sirenUpdate(dt, loud, closing, L.chase && L.chase.bust > 0.3 ? "yelp" : "wail");
}

/** Driving HUD: stars, PURSUIT / FUGITIVE tag, meters. */
// ── flavour: somebody else gets pulled over (2D COP_PULLOVER bickering) ──
export function startFlavour() {
    const car = ctx.car;
    const victim = ctx.traffic.cars.find(c => !c.hit && !c.ai && c.dir > 0 && c.s > car.s + 110 && c.s < car.s + 280 && !(c.data && c.data.law));
    if (!victim) return null;
    const u = addUnit(victim.s - 16, victim.d, 1, victim.speed + 4, { mode: "chase" });
    u.mode = "pull"; u.pullD = 7.9; u.stopS = victim.s - 7.5; u.siren = true; u.flavour = victim; u.talkT = 0;
    victim.keep = true;
    victim.ai = (dt, c) => {
        c.dTarget = 7.9;
        c.d += Math.sign(7.9 - c.d) * Math.min(Math.abs(7.9 - c.d), 2 * dt);
        c.speed = Math.max(0, c.speed - 6 * dt);
        c.s += c.speed * dt;
    };
    return u;
}
function updateFlavourUnit(dt, u) {
    const v = u.flavour, car = ctx.car;
    u.stopS = v.s - 7.5;
    const rel = car.s - v.s;
    u.talkT -= dt;
    if (Math.abs(rel) < 60 && u.talkT <= 0 && v.obj) {
        u.talkT = 2.6;
        u.flip = !u.flip;
        UI.bubble("pull" + (u.id || (u.id = Math.random())), u.flip || !u.car ? v.obj : u.car.obj, pick(COP_PULLOVER), { y: 2.3, sec: 2.4 });
    }
    if (rel > 140) { v.keep = false; if (u.car) u.car.keep = false; u.flavour = null; u.mode = "park"; }
}

export function hud() {
    UI.updateBubbles(ctx.camera);
    const ch = L.chase, f = L.fug;
    if (!ch && !f && L.radar < 0.02 && !S.wanted.length) { UI.wantedHud(null); return; }
    const info = { stars: 0, tag: "", fug: !!f, blink: false };
    if (f) { info.stars = fugitiveStars(f.t); info.tag = "🔒 FUGITIVE"; info.blink = true; info.spot = ch ? 0 : clamp(f.spot / Math.max(0.7, 1.6 - info.stars * 0.2), 0, 1); }
    if (ch) { info.stars = Math.max(info.stars, ch.heat); info.tag = f ? "🔒 FUGITIVE · PURSUIT" : "🚨 PURSUIT"; info.bust = ch.bust; info.evade = ch.evade; info.blink = true; }
    else if (!f && S.wanted.length) { info.tag = "⚠️ WANTED"; info.stars = 0; info.spot = clamp(L.wantedSpot / 0.7, 0, 1); }
    info.radar = ch ? 0 : L.radar;
    UI.wantedHud(info);
}

/** Clear the road side of the law (new run / title). Traffic + actors are cleared by core. */
export function resetRunState() {
    L.chase = null; L.units.length = 0; L.traps.length = 0; L.spawnT = {}; L.grace = 0; L.apbCool = 22;
    L.wantedSpot = 0; L.wantedPatrolT = rand(4, 7); L.pending = null; L.radar = 0; L.chopper = null; L.flavourT = rand(35, 60);
    X.sirenOff();
    UI.wantedHud(null);
}

let modelsAsked = false;
export function ensureCopModels() {
    if (modelsAsked) return;
    modelsAsked = true;
    ensureModels(["copPerson", "lawK9", "lawMissile", "lawChopper", "lawBillboard"]).catch(e => { modelsAsked = false; console.warn("[law] models", e); });
}

/** A unit for scripted scenes: a cruiser that slides up behind Lulu. */
export function scriptedCruiser(sBehind = 26, d = null) {
    const car = ctx.car;
    const u = addUnit(car.s - sBehind, d == null ? car.d : d, 1, Math.max(8, car.speed + 6), { mode: "chase" });
    u.siren = true;
    return u;
}
export { addUnit, toChase, driveUnit };
