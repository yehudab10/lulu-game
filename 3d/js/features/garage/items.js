// In the drive: the equipped horn (+ the 2D "Honk Symphony" chain), missiles
// (a 3D rocket with smoke that homes on the car ahead and blasts it off the
// road), the bubble shield (absorbs one hit), pepper spray (a green cloud at
// the nearest critter / person / cop ahead → item:use for the law & road
// features), Distracted Mode (phone in hand: reversed steering, 2× score),
// the HUD item chips and the touch buttons.
import * as THREE from "three";
import { ctx, on, emit, hook, addActor, pick, wrapAngle } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { Particles } from "../../car.js";
import { LANES_OURS } from "../../world.js";
import { models } from "../../models.js";
import { input, rumble, glyph, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";
import { inv, syncInv, writeShared } from "./data.js";
import * as S from "./sound.js";
import { loadProps, loadDecor, cloneNode, setCarDecor, animateDecor } from "./decor.js";

const PEPPER_ANIMAL = ["🌶️ ZAP!", "Sorry, lil guy!", "Off the road! 🐾", "Pew pew! 🌶️", "Not today, critter!", "Spicy! 🥵", "Shoo!! 💨"];
const PEPPER_PED = ["🤧 MY EYES!", "AGH — SPICY!", "Was that... MACE?!", "I can't SEE!", "Why, Lulu, WHY?!", "*coughing fit*", "I'm CALLING someone!"];
const HONK_REACT = ["Okay okay!", "Geez!", "Rude!", "I'm MOVING!", "Alright!!", "Easy!", "Pushy!"];
const ANIMAL_RE = /animal|deer|moose|elk|duck|goose|geese|cow|dog|cat|bear|squirrel|chicken|hen|horse|turkey|raccoon|skunk|sheep|goat|pig|critter|turtle|frog|bird|gull|fox|rabbit|bunny|sasquatch/i;

const isDriving = () => { const d = ctx.states[ctx.state]; return !!(d && d.driving); };
const G = () => ctx.G;

let fx = null;                       // particles in the driving scene (smoke, spray, sparks)
const missiles = [], blasts = [], sprays = [], debris = [];
const flyers = new Map();            // traffic car → airborne tumble state
const decorHolder = { id: null, obj: null };
let phone = null, phoneOn = false;
let distractedOn = false;            // like the 2D game: a menu toggle, not saved
const honk = { chain: 0, t: 0, cd: 0, pressing: false, heldT: 0, note: 262, last: null };
export const garageDebug = { lastHorn: null, sprays: 0, whiffs: 0, shieldPops: 0 };

// ── textures ─────────────────────────────────────────────────────────────
function radialTex(stops) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [o, col] of stops) grd.addColorStop(o, col);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
let TEX = null;
function tex() {
    if (!TEX) TEX = {
        fire: radialTex([[0, "rgba(255,255,235,1)"], [0.25, "rgba(255,214,90,0.95)"], [0.55, "rgba(255,110,30,0.75)"], [1, "rgba(200,30,10,0)"]]),
        flame: radialTex([[0, "rgba(255,255,230,1)"], [0.35, "rgba(255,170,40,0.9)"], [1, "rgba(255,40,80,0)"]]),
        smoke: radialTex([[0, "rgba(70,64,60,0.85)"], [0.6, "rgba(60,56,54,0.4)"], [1, "rgba(50,50,50,0)"]]),
    };
    return TEX;
}
const additive = map => new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });

// ── boot: particles, the equipped decoration ─────────────────────────────
on("boot", () => {
    fx = new Particles(ctx.scene, 420);
    syncInv();
    applyDecor();
    if (inv.decor !== "none") loadDecor().then(applyDecor).catch(e => console.warn("[garage] decor", e));
});
on("garage:decor", () => { loadDecor().then(applyDecor).catch(() => {}); applyDecor(); });
on("skin", () => applyDecor());
export function applyDecor() { if (ctx.car) setCarDecor(ctx.car, decorHolder, inv.decor); }

// The title screen has no per-frame feature hook, but titleCamera runs every
// frame there: animate the decoration and DON'T claim the camera.
hook("titleCamera", dt => { if (decorHolder.obj) animateDecor(decorHolder.obj, dt, ctx.car); return false; }, -100);

// ── run start ────────────────────────────────────────────────────────────
hook("runStart", (g) => {
    syncInv();
    g.customHorn = true;               // the garage plays Lulu's horn (core's stays quiet)
    g.missilesFired = 0; g.missileHits = 0; g.peppers = 0; g.shieldPops = 0;
    g.distracted = distractedOn && !g.noDistracted;
    g.shieldReady = true;
    g._gxDist = 0;
    honk.chain = 0; honk.t = 0; honk.cd = 0; honk.pressing = false;
    S.holdHorn(false);
    clearFlight();
    if (inv.missiles > 0 || g.distracted) loadProps().catch(() => {});
    addActor(footActor());
}, -20);   // low priority: other features may set G.noDistracted first (friend rooms)

function clearFlight() {
    for (const m of missiles) ctx.scene.remove(m.obj);
    for (const b of blasts) disposeBlast(b);
    for (const d of debris) ctx.scene.remove(d.mesh);
    missiles.length = blasts.length = sprays.length = debris.length = 0;
    for (const c of flyers.keys()) resetCar(c);
    flyers.clear();
}

on("state", ({ to }) => {
    const d = ctx.states[to];
    if (!d || !d.driving) { S.holdHorn(false); honk.pressing = false; }
    if (to === "title" || to === "gameover") { setPhone(false); showBubble(false); }
});

// ── the per-frame drive ──────────────────────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    const g = G();
    if (controlsOn && P.fire) fireMissile();
    if (controlsOn && P.item) usePepper(ctx.car.pos, ctx.car.h, false);
    // Distracted Mode: double the DISTANCE score (2D scoreMult), phone in hand
    const dd = Math.max(0, (g.distance || 0) - (g._gxDist || 0));
    g._gxDist = g.distance || 0;
    if (g.distracted && controlsOn) g.score += dd * (g.boosting ? 1.5 : 1);
    setPhone(!!g.distracted);
    updateHonk(dt, controlsOn);
    updateMissiles(dt);
    updateFlyers(dt);
    updateEffects(dt);
    updateBubble(dt);
    if (decorHolder.obj) animateDecor(decorHolder.obj, dt, ctx.car);
});

// Distracted Mode flips the wheel (Ima's call flips it too — both = normal, like 2D).
hook("controls", ctl => { if (G().distracted) ctl.steer = -ctl.steer; });

// An actor that keeps pepper spray working ON FOOT (actors with foot:true keep updating).
function footActor() {
    return {
        foot: true,
        update(dt) {
            if (ctx.foot && ctx.foot.active && !isDriving()) {
                const p = footPose();
                if (p && input.pressed.item) usePepper(p.pos, p.h, true);
                updateEffects(dt);
            }
            return true;
        },
    };
}
function footPose() {
    const f = ctx.foot;
    const o = f.pos ? { position: f.pos, rotation: { y: f.h || 0 } } : (f.lulu && f.lulu.obj) || (f.person && f.person.obj) || f.obj || null;
    if (!o || !o.position) return null;
    return { pos: o.position, h: f.h != null ? f.h : (o.rotation ? o.rotation.y : 0) };
}

// ══════════════════════════════════════════════════════════════════════════
//  HORNS + the Honk Symphony
// ══════════════════════════════════════════════════════════════════════════
on("honk", () => {
    if (honk.cd > 0) return;
    honk.chain = Math.min(honk.chain + 1, 7);
    honk.t = 1.5;
    honk.cd = 0.32;
    honk.note = S.HONK_NOTES[honk.chain - 1];
    S.playHorn(inv.horn, honk.note);
    garageDebug.lastHorn = inv.horn;
    honk.pressing = true; honk.heldT = 0;
    if (honk.chain >= 4) H.toast(`♪ ${honk.chain}x!`, "gold");
    honkScare();
});

function updateHonk(dt, controlsOn) {
    honk.cd -= dt;
    honk.t -= dt;
    if (honk.t <= 0) honk.chain = 0;
    // lean on the horn: the classic beep and the train horn keep blaring while held
    const holdable = inv.horn === "beep" || inv.horn === "train";
    if (honk.pressing && controlsOn && input.honkHeld) {
        honk.heldT += dt;
        if (holdable && honk.heldT > (inv.horn === "train" ? 0.55 : 0.22) && !S.hornHeld()) S.holdHorn(true, inv.horn, honk.note);
    } else {
        honk.pressing = false;
        if (S.hornHeld()) S.holdHorn(false);
    }
}

// A honk scares nearby cars out of the way by chance — and the chance climbs
// with the chain (2D honkScare). Each scared car feeds the honks10 quest.
function honkScare() {
    const car = ctx.car, tr = ctx.traffic;
    const chance = Math.min(0.16 + honk.chain * 0.10, 0.9);
    const fx0 = Math.sin(car.h), fz0 = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    let said = false;
    for (const c of tr.cars) {
        if (c.hit || c.ai || c.dir < 0) continue;
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
        const lon = dx * fx0 + dz * fz0, lat = dx * rx + dz * rz;
        if (lon < -3 || lon > 22 || Math.abs(lat) > 9) continue;
        if (Math.random() > chance) continue;
        const other = LANES_OURS.find(l => Math.abs(l - c.dTarget) > 1);
        if (other !== undefined && tr.laneFree(c.s, other, 1, 12)) { c.dTarget = other; c.laneCooldown = 4; }
        else c.want = Math.min((c.want || c.speed) + 5, 30);
        emit("stat", { id: "honks10", n: 1 });
        if (!said && Math.random() < 0.4) { said = true; H.toast(`🚗 "${pick(HONK_REACT)}"`); }
    }
}

// ══════════════════════════════════════════════════════════════════════════
//  MISSILES
// ══════════════════════════════════════════════════════════════════════════
function fallbackMissile() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.62, 12), new THREE.MeshStandardMaterial({ color: "#F5F5F5" }));
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 12), new THREE.MeshStandardMaterial({ color: "#E53935" }));
    nose.rotation.x = Math.PI / 2; nose.position.z = 0.43;
    g.add(body, nose);
    return g;
}

function pickTarget(x, z, h, maxLon = 170) {
    const fx0 = Math.sin(h), fz0 = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    let best = null, bs = 1e9;
    for (const c of ctx.traffic.cars) {
        if (c.hit) continue;
        const dx = c.x - x, dz = c.z - z;
        const lon = dx * fx0 + dz * fz0, lat = dx * rx + dz * rz;
        if (lon < 2 || lon > maxLon || Math.abs(lat) > 5 + lon * 0.05) continue;
        const sc = lon + Math.abs(lat) * 6;
        if (sc < bs) { bs = sc; best = c; }
    }
    return best;
}

export function fireMissile() {
    const car = ctx.car;
    if (!isDriving() || !car) return false;
    if (inv.missiles <= 0) {
        S.sfxDeny();
        H.toast("🚀 No missiles! Stock up in the 🛒 Shop", "red");
        return false;
    }
    writeShared(s => { s.missiles = Math.max(0, (s.missiles | 0) - 1); });
    const h = car.h, fx0 = Math.sin(h), fz0 = Math.cos(h);
    const obj = models.garageProps ? cloneNode(models.garageProps, "Item_missile") || fallbackMissile() : fallbackMissile();
    const flame = new THREE.Sprite(additive(tex().flame));
    flame.position.set(0, 0, -0.52);
    flame.scale.set(0.5, 0.5, 1);
    obj.add(flame);
    const m = {
        obj, flame, x: car.pos.x + fx0 * 2.4, y: 0.82, z: car.pos.z + fz0 * 2.4, h, s: car.s,
        speed: Math.max(0, car.vF) + 26, max: Math.max(0, car.vF) + 72, t: 0,
        target: pickTarget(car.pos.x, car.pos.z, h),
    };
    obj.position.set(m.x, m.y, m.z);
    obj.rotation.set(0, h, 0);
    ctx.scene.add(obj);
    missiles.push(m);
    G().missilesFired = (G().missilesFired || 0) + 1;
    S.sfxMissile();
    rumble(0.35, 0.6, 220, true);
    if (fx) fx.burst(m.x - fx0 * 0.6, 0.7, m.z - fz0 * 0.6, 10, 2.2, [0.85, 0.85, 0.88], 1.1, 0.9);
    emit("item:use", { id: "missile", x: car.pos.x, z: car.pos.z });
    emit("stat", { id: "missilesFired", n: 1 });
    return true;
}

const tmpNear = {};
function updateMissiles(dt) {
    const road = ctx.world.road;
    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        m.t += dt;
        m.speed = Math.min(m.max, m.speed + 55 * dt);
        const tg = m.target;
        if (tg && (tg.hit || !ctx.traffic.cars.includes(tg))) m.target = pickTarget(m.x, m.z, m.h, 120);
        let want;
        if (m.target) want = Math.atan2(m.target.x - m.x, m.target.z - m.z);
        else {   // no target: follow the road (curves!) along the lane it launched in
            const n = road.nearest(m.x, m.z, m.s, tmpNear);
            m.s = n.s;
            const p = road.point(n.s + 24, n.d * 0.9, tmpNear);
            want = Math.atan2(p.x - m.x, p.z - m.z);
        }
        const turn = m.target ? 2.6 : 1.4;
        m.h += THREE.MathUtils.clamp(wrapAngle(want - m.h), -turn * dt, turn * dt);
        const fx0 = Math.sin(m.h), fz0 = Math.cos(m.h);
        m.x += fx0 * m.speed * dt;
        m.z += fz0 * m.speed * dt;
        m.obj.position.set(m.x, m.y + Math.sin(m.t * 40) * 0.015, m.z);
        m.obj.rotation.set(0, m.h, 0);
        m.obj.rotateZ(m.t * 9);
        const f = 0.8 + Math.random() * 0.5;
        m.flame.scale.set(0.55 * f, 0.55 * f, 1);
        if (fx) {
            const tx = m.x - fx0 * 0.62, tz = m.z - fz0 * 0.62;
            fx.emit(tx, m.y, tz, (Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8, 1.05, 1.3, [0.97, 0.97, 0.98]);
            fx.emit(tx - fx0 * 0.8, m.y, tz - fz0 * 0.8, (Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6, 0.9, 1.1, [0.9, 0.9, 0.92]);
            if (Math.random() < 0.6) fx.emit(tx, m.y, tz, -fx0 * 2, 0.2, -fz0 * 2, 0.35, 0.25, [1, 0.62, 0.2]);
        }
        // hit a car?
        let hit = null;
        for (const c of ctx.traffic.cars) {
            if (c.hit) continue;
            const dx0 = c.x - m.x, dz0 = c.z - m.z;
            if (dx0 * dx0 + dz0 * dz0 > 64) continue;
            const cfx = Math.sin(c.h), cfz = Math.cos(c.h), rr = (c.spec.r || 1) + 0.45;
            for (const co of c.spec.circles || [0]) {
                const qx = c.x + cfx * co - m.x, qz = c.z + cfz * co - m.z;
                if (qx * qx + qz * qz < rr * rr) { hit = c; break; }
            }
            if (hit) break;
        }
        if (hit) { explode(m, hit); missiles.splice(i, 1); continue; }
        if (m.t > 3.6) { explode(m, null); missiles.splice(i, 1); }
    }
}

function explode(m, car) {
    ctx.scene.remove(m.obj);
    const x = car ? (m.x + car.x) / 2 : m.x, z = car ? (m.z + car.z) / 2 : m.z;
    spawnBlast(x, 0.9, z, car ? 1 : 0.6);
    const near = Math.hypot(x - ctx.car.pos.x, z - ctx.car.pos.z);
    S.sfxExplosion(near < 40 ? 1 : 0.6);
    rumble(0.9, 0.7, 380, true);
    G().shake = Math.max(G().shake || 0, Math.max(0.15, 0.7 - near / 80));
    if (!car) return;
    knock(car, Math.sin(m.h), Math.cos(m.h));
    G().missileHits = (G().missileHits || 0) + 1;
    addScore(50, "missile");
    H.toast("💥 BOOM! +50", "gold");
    emit("missile:hit", { car, x, z });
    emit("stat", { id: "missiles8", n: 1 });   // weekly quest: missile a car
}

/** Blast a traffic car off the road: tumbling, airborne, smoking. */
function knock(c, dx, dz) {
    const mass = (c.spec && c.spec.mass) || 1.2;
    if (!c.hit) {
        c.hit = true; c.hitT = 0;
        c.vx = Math.sin(c.h) * c.speed; c.vz = Math.cos(c.h) * c.speed;
    }
    const k = c.immune ? 0 : 1 / Math.sqrt(mass);
    c.vx += (dx * 24 + (Math.random() - 0.5) * 6) * k;
    c.vz += (dz * 24 + (Math.random() - 0.5) * 6) * k;
    c.spinV = (c.spinV || 0) + (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4) * k;
    flyers.set(c, { y: 0, vy: 10.5 * k, rx: 0, rz: 0, rvx: (Math.random() - 0.5) * 9 * k, rvz: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5) * k, smoke: 7, landed: false });
    if (!c.__gxWrapped) {
        c.__gxWrapped = true;
        const prev = c.onRemove;
        c.onRemove = car => { resetCar(car); flyers.delete(car); car.onRemove = prev; car.__gxWrapped = false; if (prev) prev(car); };
    }
}
function resetCar(c) {
    if (!c || !c.obj) return;
    c.obj.position.y = 0;
    c.obj.rotation.x = 0;
    c.obj.rotation.z = 0;
}

function updateFlyers(dt) {
    for (const [c, f] of flyers) {
        if (!ctx.traffic.cars.includes(c)) { resetCar(c); flyers.delete(c); continue; }
        if (!f.landed) {
            f.vy -= 22 * dt;
            f.y += f.vy * dt;
            f.rx += f.rvx * dt;
            f.rz += f.rvz * dt;
            if (f.y <= 0) {
                f.y = 0;
                if (f.vy < -3.5) { f.vy = -f.vy * 0.3; f.rvx *= 0.45; f.rvz *= 0.45; if (fx) fx.burst(c.x, 0.4, c.z, 10, 3, [0.72, 0.62, 0.45], 1.2, 0.8); }
                else { f.vy = 0; f.landed = true; }
            }
        } else {   // settle on its wheels — or on its roof
            const tx = Math.round(f.rx / Math.PI) * Math.PI, tz = Math.round(f.rz / Math.PI) * Math.PI;
            f.rx += (tx - f.rx) * Math.min(1, dt * 6);
            f.rz += (tz - f.rz) * Math.min(1, dt * 6);
        }
        c.obj.position.y = f.y + (Math.abs(Math.sin(f.rz)) + Math.abs(Math.sin(f.rx))) * 0.6;
        c.obj.rotation.x = f.rx;
        c.obj.rotation.z = f.rz;
        if (f.smoke > 0 && fx) {
            f.smoke -= dt;
            if (Math.random() < 0.7) fx.emit(c.x + (Math.random() - 0.5), f.y + 1.3, c.z + (Math.random() - 0.5), (Math.random() - 0.5) * 0.6, 1.6, (Math.random() - 0.5) * 0.6, 1.4, 1.8, [0.28, 0.27, 0.27]);
            if (Math.random() < 0.3) fx.emit(c.x, f.y + 1.0, c.z, 0, 1.2, 0, 0.5, 0.35, [1, 0.55, 0.15]);
        }
    }
}

// ── explosions ───────────────────────────────────────────────────────────
let ringGeo = null, ringMat = null, chunkGeo = null, chunkMat = null;
function spawnBlast(x, y, z, power) {
    const T = tex();
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const sprites = [];
    // 0: hot additive core flash · 1-3: orange fire billows (normal blending so they read
    // against a bright sky) · 4: the dark smoke ball that rises out of it
    for (let i = 0; i < 5; i++) {
        const sp = new THREE.Sprite(i === 0 ? additive(T.fire) : new THREE.SpriteMaterial({ map: i === 4 ? T.smoke : T.fire, depthWrite: false, transparent: true }));
        if (i === 4) sp.material.opacity = 0;
        sp.position.set((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
        sp.material.rotation = Math.random() * Math.PI * 2;
        sp.userData.s0 = (i === 0 ? 3.2 : 1.6 + i * 0.45) * power;
        sp.renderOrder = 7;
        grp.add(sp);
        sprites.push(sp);
    }
    ringGeo = ringGeo || new THREE.RingGeometry(0.75, 1, 48);
    ringMat = ringMat || new THREE.MeshBasicMaterial({ color: "#FFD180", transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeo, ringMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);
    ctx.scene.add(grp, ring);
    const b = { grp, ring, sprites, t: 0, power };
    blasts.push(b);
    if (fx) {
        fx.burst(x, y, z, Math.round(22 * power), 9, [1, 0.78, 0.32], 0.45, 0.6);
        fx.burst(x, y + 0.4, z, Math.round(16 * power), 3, [0.3, 0.29, 0.29], 2.4, 1.8);
    }
    chunkGeo = chunkGeo || new THREE.BoxGeometry(0.22, 0.12, 0.3);
    chunkMat = chunkMat || new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 0.8 });
    for (let i = 0; i < Math.round(7 * power); i++) {
        const mesh = new THREE.Mesh(chunkGeo, chunkMat);
        mesh.position.set(x, y + 0.3, z);
        const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 6;
        ctx.scene.add(mesh);
        debris.push({ mesh, vx: Math.cos(a) * sp, vy: 5 + Math.random() * 6, vz: Math.sin(a) * sp, t: 0, spin: (Math.random() - 0.5) * 20 });
    }
}
function disposeBlast(b) {
    ctx.scene.remove(b.grp, b.ring);
    for (const s of b.sprites) s.material.dispose();
    b.ring.material.dispose();
}

function updateEffects(dt) {
    for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i];
        b.t += dt;
        const k = b.t / 0.9;
        b.sprites.forEach((sp, j) => {
            const life = j === 0 ? 0.28 : 0.55 + j * 0.1;
            const kk = Math.min(1, b.t / life);
            const s = sp.userData.s0 * (j === 0 ? 0.7 + kk * 1.2 : 0.5 + Math.sqrt(kk) * (j === 4 ? 3.6 : 2.4));
            sp.scale.set(s, s, 1);
            sp.position.y += dt * (j === 4 ? 2.6 : 1.1);
            sp.material.opacity = j === 4 ? Math.min(0.8, b.t * 2.5) * Math.max(0, 1 - k * 0.75) : Math.max(0, 1 - kk * kk);
        });
        const rs = 1 + b.t * 16 * b.power;
        b.ring.scale.set(rs, rs, rs);
        b.ring.material.opacity = Math.max(0, 0.8 - b.t * 2.2);
        if (b.t > 1.4) { disposeBlast(b); blasts.splice(i, 1); }
    }
    for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.t += dt;
        d.vy -= 20 * dt;
        d.mesh.position.x += d.vx * dt; d.mesh.position.y += d.vy * dt; d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += d.spin * dt; d.mesh.rotation.y += d.spin * 0.7 * dt;
        if (d.mesh.position.y < 0.06) { d.mesh.position.y = 0.06; d.vy = Math.abs(d.vy) * 0.25; d.vx *= 0.6; d.vz *= 0.6; d.spin *= 0.5; }
        if (d.t > 2.5) { ctx.scene.remove(d.mesh); debris.splice(i, 1); }
    }
    for (let i = sprays.length - 1; i >= 0; i--) {
        const s = sprays[i];
        s.t -= dt;
        if (fx) for (let k = 0; k < 6; k++) {
            const u = Math.random();
            const px = s.x0 + (s.x1 - s.x0) * u * 0.25, pz = s.z0 + (s.z1 - s.z0) * u * 0.25;
            const vx = (s.x1 - s.x0) * (1.6 + Math.random()), vz = (s.z1 - s.z0) * (1.6 + Math.random());
            fx.emit(px, s.y, pz, vx * 0.5 + (Math.random() - 0.5) * 2, 0.6 + Math.random(), vz * 0.5 + (Math.random() - 0.5) * 2,
                0.7 + Math.random() * 0.6, 0.7, pick([[0.55, 0.9, 0.3], [0.45, 0.82, 0.2], [0.7, 0.95, 0.45], [0.8, 0.9, 0.2]]));
        }
        if (s.t <= 0) sprays.splice(i, 1);
    }
    if (fx) fx.update(dt);
}

// ══════════════════════════════════════════════════════════════════════════
//  PEPPER SPRAY
// ══════════════════════════════════════════════════════════════════════════
function posOf(a) {
    if (!a) return null;
    if (a.obj && a.obj.position) return a.obj.position;
    if (a.pos && a.pos.x != null) return a.pos;
    if (a.person && a.person.obj) return a.person.obj.position;
    if (a.x != null && a.z != null) return a;
    return null;
}
function kindOf(a) {
    return [a.kind, a.type, a.name, a.id, a.what].filter(v => typeof v === "string").join(" ");
}

/**
 * Spray the nearest critter / person / cop ahead (2D firePepperSpray). Emits
 * item:use {id:"pepper", x, z, tx, tz, target, targetKind, hit, line}: a
 * listener that reacts (the law feature near a cop, a road animal…) may set
 * e.hit = true and e.line = "what they shout". A whiff with nothing in range
 * costs nothing.
 */
export function usePepper(pos = ctx.car && ctx.car.pos, h = ctx.car ? ctx.car.h : 0, onFoot = false) {
    if (!pos) return false;
    if (inv.pepperSpray <= 0) {
        S.sfxDeny();
        H.toast("🌶️ No pepper spray! Grab some in the 🛒 Shop", "red");
        return false;
    }
    const fx0 = Math.sin(h), fz0 = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    const RANGE = onFoot ? 9 : 28;
    let best = null, bestD = 1e9, bestKind = null, bestPos = null;
    const consider = (p, kind, obj, pri) => {
        const dx = p.x - pos.x, dz = p.z - pos.z;
        const lon = dx * fx0 + dz * fz0, lat = dx * rx + dz * rz;
        if (lon < -2 || lon > RANGE || Math.abs(lat) > (onFoot ? 4 : 9)) return;
        const d = Math.abs(lon) + Math.abs(lat) + pri;
        if (d < bestD) { bestD = d; best = obj; bestKind = kind; bestPos = p; }
    };
    for (const a of ctx.actors) {
        const p = posOf(a);
        if (!p) continue;
        const k = kindOf(a);
        if (a.kid || /kid|child/i.test(k)) continue;          // never the kids
        consider(p, ANIMAL_RE.test(k) || a.animal ? "animal" : "person", a, ANIMAL_RE.test(k) || a.animal ? 0 : 40);  // animals first (2D)
    }
    for (const c of ctx.traffic ? ctx.traffic.cars : []) if (c.kind === "cop" && !c.hit) consider(c, "cop", c, 20);
    const tx = bestPos ? bestPos.x : pos.x + fx0 * 7, tz = bestPos ? bestPos.z : pos.z + fz0 * 7;
    const e = { id: "pepper", x: pos.x, z: pos.z, tx, tz, dirX: fx0, dirZ: fz0, range: RANGE, onFoot,
        target: best, targetKind: bestKind, hit: false, handled: false, line: null };
    emit("item:use", e);
    const y = onFoot ? 1.3 : 1.25;
    const sx = pos.x + fx0 * (onFoot ? 0.4 : 0.6) + rx * (onFoot ? 0.2 : -0.75), sz = pos.z + fz0 * (onFoot ? 0.4 : 0.6) + rz * (onFoot ? 0.2 : -0.75);
    if (!e.hit && !e.handled && !best) {
        // nothing in range → harmless whiff, no charge spent
        garageDebug.whiffs++;
        sprays.push({ t: 0.12, x0: sx, z0: sz, x1: sx + fx0 * 3, z1: sz + fz0 * 3, y });
        H.toast("🌶️ *whiff!*", "");
        S.sfxWhiff();
        return false;
    }
    writeShared(s => { s.pepperSpray = Math.max(0, (s.pepperSpray | 0) - 1); });
    G().peppers = (G().peppers || 0) + 1;
    garageDebug.sprays++;
    sprays.push({ t: 0.32, x0: sx, z0: sz, x1: tx, z1: tz, y });
    if (fx) { fx.burst(tx, 1.1, tz, 22, 2.6, [0.55, 0.9, 0.3], 1.3, 1.1); fx.burst(tx, 1.3, tz, 10, 1.4, [0.8, 0.95, 0.35], 0.9, 1.3); }
    S.sfxPssst();
    rumble(0.15, 0.4, 120);
    if (best && best.pepper) { try { best.pepper(e); } catch (err) { console.error(err); } }
    const line = e.line || (bestKind === "cop" ? "😡 BIG mistake!" : bestKind === "animal" ? pick(PEPPER_ANIMAL) : pick(PEPPER_PED));
    H.toast(line, bestKind === "cop" ? "red" : "pink");
    emit("stat", { id: "pepper", n: 1 });
    return true;
}

// ══════════════════════════════════════════════════════════════════════════
//  THE BUBBLE SHIELD
// ══════════════════════════════════════════════════════════════════════════
let bubble = null;
const bub = { vis: 0, pop: -1, rearm: 0 };
export function bubbleMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uPop: { value: 0 }, uColor: { value: new THREE.Color("#4FC3F7") } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
            void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
              gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uTime; uniform float uAlpha; uniform float uPop; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vP;
            void main() {
              float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
              float band = 0.5 + 0.5 * sin(vP.y * 18.0 - uTime * 3.0);
              float hex = abs(sin(vP.x * 22.0 + uTime) * sin(vP.z * 22.0 - uTime * 0.7));
              float a = (0.06 + f * 0.85 + band * f * 0.25 + smoothstep(0.92, 1.0, hex) * 0.12 + uPop * 0.5) * uAlpha;
              gl_FragColor = vec4(uColor * (0.8 + f * 0.8 + uPop), a);
            }`,
    });
}
function ensureBubble() {
    if (bubble) return bubble;
    bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), bubbleMaterial());
    bubble.scale.set(1.5, 1.05, 2.75);
    bubble.renderOrder = 6;
    bubble.frustumCulled = false;
    bubble.visible = false;
    ctx.scene.add(bubble);
    return bubble;
}
function showBubble(on) { if (bubble) bubble.visible = on && bubble.visible; if (!on) bub.vis = 0; }

function updateBubble(dt) {
    const g = G(), car = ctx.car;
    const armed = inv.shields > 0 && g.shieldReady !== false && isDriving();
    if (!armed && bub.pop < 0 && !bubble) return;
    ensureBubble();
    if (g.shieldReady === false) { bub.rearm -= dt; if (bub.rearm <= 0) { g.shieldReady = true; if (inv.shields > 0) S.sfxShieldUp(); } }
    bub.vis += ((armed ? 1 : 0) - bub.vis) * Math.min(1, dt * 4);
    const m = bubble.material;
    m.uniforms.uTime.value += dt;
    let s = 1, a = bub.vis * 0.55;
    if (bub.pop >= 0) {
        bub.pop += dt;
        const k = bub.pop / 0.6;
        s = 1 + k * 0.6;
        a = Math.max(0, 1.4 * (1 - k));
        m.uniforms.uPop.value = Math.max(0, 1 - k);
        if (k >= 1) { bub.pop = -1; m.uniforms.uPop.value = 0; }
    }
    m.uniforms.uAlpha.value = a;
    bubble.visible = a > 0.01;
    bubble.position.set(car.pos.x, 0.8 + (car.tilt ? car.tilt.position.y : 0), car.pos.z);
    bubble.rotation.y = car.h;
    bubble.scale.set(1.5 * s, 1.05 * s, 2.75 * s);
}

// Shields veto a lost heart (low priority: scripted invincibility goes first).
hook("damage", info => {
    const g = G();
    if (inv.shields <= 0 || g.shieldReady === false || !isDriving()) return;
    writeShared(s => { s.shields = Math.max(0, (s.shields | 0) - 1); });
    g.shieldReady = false;
    g.shieldPops = (g.shieldPops || 0) + 1;
    garageDebug.shieldPops++;
    bub.rearm = 2.5;
    bub.pop = 0;
    g.invT = Math.max(g.invT || 0, 1.4);
    g.shake = Math.max(g.shake || 0, 0.35);
    const car = ctx.car;
    if (fx) fx.burst(car.pos.x, 1.1, car.pos.z, 26, 6, [0.55, 0.85, 1], 0.5, 0.7);
    S.sfxShieldPop();
    rumble(0.6, 0.8, 260, true);
    H.toast(`🛡️ SHIELD! Saved by the bubble${inv.shields > 0 ? ` · ${inv.shields} left` : ""}`, "pink");
    emit("item:use", { id: "shield", x: car.pos.x, z: car.pos.z, why: info && info.why });
    return false;
}, -10);

/** Pop a shield on purpose (ctx.garage.use("shield")): 4 s of invincibility. */
function useShieldNow() {
    if (!isDriving() || inv.shields <= 0) { S.sfxDeny(); return false; }
    writeShared(s => { s.shields = Math.max(0, (s.shields | 0) - 1); });
    const g = G();
    g.invT = Math.max(g.invT || 0, 4);
    bub.pop = 0; g.shieldReady = false; bub.rearm = 4;
    S.sfxShieldUp();
    emit("item:use", { id: "shield", x: ctx.car.pos.x, z: ctx.car.pos.z, manual: true });
    return true;
}

// ══════════════════════════════════════════════════════════════════════════
//  DISTRACTED MODE (phone in hand)
// ══════════════════════════════════════════════════════════════════════════
function setPhone(on) {
    const car = ctx.car;
    if (!car) return;
    on = on && isDriving() && (!car.driver || car.driver.visible);
    if (on === phoneOn && (!on || phone)) return;
    if (on) {
        if (!models.garageProps) { loadProps().catch(() => {}); return; }
        if (!phone) {
            const p = cloneNode(models.garageProps, "Item_phone");
            phone = new THREE.Group();
            phone.add(p);
            // held up in Lulu's right hand, screen toward her face (anchor = left mirror)
            p.position.set(-0.75, 0.44, -0.22);
            p.rotation.set(0.35, Math.PI - 0.3, 0);
            p.scale.setScalar(1.3);
            phone.userData.slot = "mirrorL";
        }
        car.attach("mirrorL", phone);
        S.sfxPhone();
    } else if (phone && car.attached && car.attached.mirrorL === phone) car.attach("mirrorL", null);
    phoneOn = on;
}

export function setDistracted(on) {
    if (on && !inv.distractedUnlocked) return false;
    distractedOn = !!on;
    if (isDriving()) G().distracted = distractedOn && !G().noDistracted;
    return true;
}
export const distracted = () => distractedOn;

// ══════════════════════════════════════════════════════════════════════════
//  HUD chips + touch buttons
// ══════════════════════════════════════════════════════════════════════════
let hudEl = null, hudKey = "";
hook("hud", () => {
    if (!hudEl) { hudEl = document.createElement("div"); hudEl.className = "gx-hud"; H.hudSlot("right").appendChild(hudEl); }
    const g = G(), touch = input.device === "touch";
    const showGlyph = !touch && isDriving();
    const chips = [];
    if (g.distracted) chips.push(`<div class="hud-chip gx-chip pink">📱 DISTRACTED 2×</div>`);
    if (inv.missiles > 0) chips.push(`<div class="hud-chip gx-chip">🚀 <b>${inv.missiles}</b>${showGlyph ? " " + glyph("fire") : ""}</div>`);
    if (inv.pepperSpray > 0) chips.push(`<div class="hud-chip gx-chip">🌶️ <b>${inv.pepperSpray}</b>${showGlyph ? " " + glyph("item") : ""}</div>`);
    if (inv.shields > 0) chips.push(`<div class="hud-chip gx-chip${g.shieldReady === false ? " dim" : ""}">🛡️ <b>${inv.shields}</b></div>`);
    if (honk.chain > 0 && honk.t > 0) chips.push(`<div class="hud-chip gx-chip honk${honk.chain >= 5 ? " hot" : ""}" style="--p:${Math.max(0, Math.min(1, honk.t / 1.5)).toFixed(2)}">♪<b>${honk.chain}</b></div>`);
    const key = chips.join("") + (honk.chain > 0 ? Math.round(honk.t * 10) : "");
    if (key !== hudKey) { hudKey = key; hudEl.innerHTML = chips.join(""); }
});

addTouchButton({ id: "garage_missile", emoji: "🚀", label: "FIRE", action: "fire", visible: () => inv.missiles > 0 && isDriving() });
addTouchButton({ id: "garage_pepper", emoji: "🌶️", label: "SPRAY", action: "item", visible: () => inv.pepperSpray > 0 && (isDriving() || !!(ctx.foot && ctx.foot.active)) });

export { useShieldNow, decorHolder };
