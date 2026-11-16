// features/streets — 💥 SMASHABLE STREET PROPS.
//
// Hydrants (a water geyser — and driving through it bounces the car), mailboxes,
// fruit stands (fruit everywhere), trash cans, newspaper boxes, picket fences,
// phone booths, and the police barricades at roadblocks.
//
// Cheap by design: every prop KIND is one instanced mesh set for the whole road
// (a fixed pool of slots), debris is two pooled InstancedMeshes (boxy bits + round
// bits, per-instance colour), nothing is allocated per frame, and props live with
// their 200 m chunk (built in chunk:build from the chunk's own seed, freed in
// chunk:dispose). A "damage $" tally runs per drive; smashing in front of a cop
// gets you wanted. Props are random content: built only when ctx.enabled("streets").
import * as THREE from "three";
import { ctx, on, hook, emit, addActor, css } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { instanced } from "../../models.js";
import { facingRoad, mulberry32 } from "../../world.js";
import { CAR_CIRCLES, CAR_RADIUS } from "../../car.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { models, need, live, K, PROP_KINDS, clamp, rand, pick, smooth, crime, toast, stat, sfx, luluSays, npcSays } from "./common.js";
import * as T from "./lines.js";

// r: collision circles along the model's X axis [offset, radius] · value: $ · fly: the whole thing tumbles away
// slow: speed kept on impact · sound · bits: debris [count, colour, size xyz, flutter | round]
const DEF = {
    hydrant:    { circ: [[0, 0.38]], value: 250, bolted: true, slow: 1, sound: "metal", bits: [[3, "#FFD54F", [0.16, 0.08, 0.16]]] },
    mailbox:    { circ: [[0, 0.45]], value: 120, fly: true, slow: 0.93, sound: "metal", bits: [[12, "#FAFAFA", [0.24, 0.012, 0.16], "flutter"], [3, "#1E5AA8", [0.2, 0.05, 0.3]]] },
    fruitstand: { circ: [[-0.7, 0.75], [0.7, 0.75]], value: 300, slow: 0.86, sound: "wood", vendor: true,
        bits: [[10, "#A1887F", [0.7, 0.05, 0.14]], [6, "#E53935", [0.5, 0.03, 0.4]], [6, "#FAFAFA", [0.5, 0.03, 0.4]],
               [10, "#FB8C00", [0.09, 0.09, 0.09], "round"], [10, "#D32F2F", [0.09, 0.09, 0.09], "round"], [8, "#FDD835", [0.085, 0.085, 0.085], "round"], [8, "#7CB342", [0.085, 0.085, 0.085], "round"]] },
    trashcan:   { circ: [[0, 0.42]], value: 40, fly: true, slow: 0.96, sound: "metal", bits: [[1, "#78909C", [0.7, 0.06, 0.7]], [8, "#A5D6A7", [0.14, 0.1, 0.12]], [5, "#8D6E63", [0.12, 0.08, 0.1]]] },
    newsbox:    { circ: [[0, 0.42]], value: 90, fly: true, slow: 0.94, sound: "metal", bits: [[12, "#ECEFF1", [0.3, 0.012, 0.22], "flutter"]] },
    fence:      { circ: [[-1.05, 0.5], [0, 0.5], [1.05, 0.5]], value: 60, slow: 0.95, sound: "wood", bits: [[10, "#FAFAFA", [0.13, 0.95, 0.04]], [3, "#FAFAFA", [1.0, 0.08, 0.05]]] },
    phonebooth: { circ: [[0, 0.68]], value: 400, slow: 0.8, sound: "glass", bits: [[16, "#B3E5FC", [0.22, 0.3, 0.02]], [6, "#C62828", [0.08, 0.9, 0.08]], [1, "#263238", [0.26, 0.4, 0.1]]] },
    barrier:    { circ: [[-0.9, 0.42], [0, 0.42], [0.9, 0.42]], value: 150, fly: true, slow: 0.92, sound: "wood", police: true, bits: [[6, "#E53935", [0.32, 0.3, 0.07]], [6, "#FAFAFA", [0.32, 0.3, 0.07]]] },
};
const CAP = { hydrant: 20, mailbox: 20, fruitstand: 8, trashcan: 20, newsbox: 16, fence: 24, phonebooth: 8, barrier: 8 };
const MIX = {
    suburbs: { mailbox: 0.28, fence: 0.24, trashcan: 0.2, hydrant: 0.16, newsbox: 0.06, fruitstand: 0.06 },
    fall:    { mailbox: 0.28, fence: 0.26, trashcan: 0.18, hydrant: 0.14, fruitstand: 0.08, newsbox: 0.06 },
    pool:    { fence: 0.24, mailbox: 0.22, trashcan: 0.2, hydrant: 0.16, fruitstand: 0.12, newsbox: 0.06 },
    coast:   { fruitstand: 0.2, trashcan: 0.22, newsbox: 0.16, hydrant: 0.14, phonebooth: 0.12, mailbox: 0.08, fence: 0.08 },
    dusk:    { newsbox: 0.2, hydrant: 0.18, trashcan: 0.18, fruitstand: 0.16, phonebooth: 0.14, mailbox: 0.14 },
    desert:  { phonebooth: 0.34, trashcan: 0.3, fruitstand: 0.22, newsbox: 0.14 },
    strip:   { newsbox: 0.28, hydrant: 0.22, phonebooth: 0.2, trashcan: 0.2, fruitstand: 0.1 },
};
export const PROPS = { pools: {}, ready: false, all: [], byChunk: new Map(), damage: 0, smashed: 0, last: null };
const KINDS = [...PROP_KINDS, "barrier"];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const tmpR = {};

// ── pools ───────────────────────────────────────────────────────────────
function makePool(kind) {
    const tpl = models[K(kind)];
    if (!tpl) return null;
    const inst = instanced(tpl, CAP[kind]);
    for (const im of inst.group.children) { im.frustumCulled = false; im.count = 0; }
    for (let i = 0; i < CAP[kind]; i++) inst.set(i, ZERO);
    inst.finish();
    inst.group.visible = false;          // no draw calls for a kind that isn't on this stretch of road
    ctx.scene.add(inst.group);
    return { inst, free: Array.from({ length: CAP[kind] }, (_, i) => CAP[kind] - 1 - i), taken: new Uint8Array(CAP[kind]), hi: 0, dirty: true };
}
function setHi(pool, h) {
    pool.hi = h;
    for (const im of pool.inst.group.children) im.count = h;
    pool.inst.group.visible = h > 0;
}
export function loadProps() {
    if (PROPS.ready || PROPS.loading) return PROPS.loading;
    PROPS.loading = need(KINDS).then(() => {
        for (const k of KINDS) PROPS.pools[k] = makePool(k);
        PROPS.ready = true;
        initDebris();
    }).catch(e => { PROPS.loading = null; console.error("[streets] props", e); });
    return PROPS.loading;
}
function alloc(kind) {
    const pool = PROPS.pools[kind];
    if (!pool || !pool.free.length) return -1;
    const i = pool.free.pop();
    pool.taken[i] = 1;
    if (i + 1 > pool.hi) setHi(pool, i + 1);
    return i;
}
function release(kind, i) {
    const pool = PROPS.pools[kind];
    if (!pool || i < 0) return;
    pool.inst.set(i, ZERO);
    pool.taken[i] = 0;
    pool.free.push(i);
    let h = pool.hi;
    while (h > 0 && !pool.taken[h - 1]) h--;
    if (h !== pool.hi) setHi(pool, h);
    pool.dirty = true;
}
function writeProp(pr) {
    const pool = PROPS.pools[pr.kind];
    if (!pool || pr.slot < 0) return;
    _e.set(pr.rx, pr.ry, pr.rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(pr.x, pr.y, pr.z), _q, _s.setScalar(pr.sc));
    pool.inst.set(pr.slot, _m);
    pool.dirty = true;
}
function flushPools() {
    for (const k of KINDS) {
        const pool = PROPS.pools[k];
        if (!pool || !pool.dirty) continue;
        pool.dirty = false;
        for (const im of pool.inst.group.children) im.instanceMatrix.needsUpdate = true;
    }
}

/** A prop that isn't part of a chunk (roadblock barricades): lives until smashed + faded, or the run ends. */
export function addLooseProp(kind, x, z, ry) {
    if (!PROPS.ready) { loadProps(); return null; }
    const pr = newProp(kind, x, z, ry, null);
    if (pr) { pr.loose = true; writeProp(pr); }
    return pr;
}
function newProp(kind, x, z, ry, chunk) {
    const slot = alloc(kind);
    if (slot < 0) return null;
    const pr = { kind, def: DEF[kind], slot, x, y: 0, z, ry, rx: 0, rz: 0, sc: 1, chunk, state: "idle", t: 0, vx: 0, vy: 0, vz: 0, spin: 0, spinZ: 0,
        hx: x, hz: z, hry: ry, spent: false, loose: false };
    PROPS.all.push(pr);
    return pr;
}
function dropProp(pr) {
    release(pr.kind, pr.slot);
    pr.slot = -1; pr.state = "gone";
    const i = PROPS.all.indexOf(pr);
    if (i >= 0) PROPS.all.splice(i, 1);
}

// ── placement: clusters along the sidewalk, from the chunk's own seed ────
on("chunk:build", ({ chunk, world, s0, biome }) => {
    if (!live() || !PROPS.ready || s0 < 150) return;
    const rnd = mulberry32(chunk.k * 7717 + 31);
    const mix = MIX[biome && biome.name] || MIX.suburbs;
    const rd = world.road;
    const list = [];
    const clusters = rnd() < 0.85 ? 1 + (rnd() < 0.5 ? 1 : 0) : 0;
    for (let ci = 0; ci < clusters; ci++) {
        const side = rnd() < 0.55 ? 1 : -1;
        let s = s0 + 15 + rnd() * 150;
        const n = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < n; i++, s += 3.5 + rnd() * 5) {
            let r = rnd(), kind = "trashcan";
            for (const [k, w] of Object.entries(mix)) { if ((r -= w) <= 0) { kind = k; break; } }
            const d = side * (kind === "fence" ? 11.3 : kind === "fruitstand" ? 10.3 : 9.4 + rnd() * 0.9);
            if (world.isReserved(s, d, 2.5)) continue;
            rd.point(s, d, tmpR);
            const h = tmpR.h, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
            let blocked = false;
            for (const c of chunk.colliders) {
                const dx = c.x - tmpR.x, dz = c.z - tmpR.z;
                // a house's driveway runs out to the road on ITS side: keep that strip clear
                const house = c.kind === "house" && Math.abs(dx * fx + dz * fz) < 4 && Math.sign(dx * rx + dz * rz) === Math.sign(d);
                if (house || (c.kind !== "house" && dx * dx + dz * dz < (c.r + 1.8) ** 2)) { blocked = true; break; }
            }

            if (blocked) continue;
            const pr = newProp(kind, tmpR.x, tmpR.z, facingRoad(h, side), chunk);
            if (!pr) continue;
            pr.s = s; pr.d = d;
            writeProp(pr);
            list.push(pr);
            // banter's roadside folks keep clear of it (off: the car + foot ignore it, we collide ourselves)
            chunk.addCollider({ x: tmpR.x, z: tmpR.z, r: pr.def.circ.length > 1 ? 1.4 : 0.6, kind: "streetsProp", off: true });
        }
    }
    if (list.length) { PROPS.byChunk.set(chunk, list); flushPools(); }
});
on("chunk:dispose", ({ chunk }) => {
    const list = PROPS.byChunk.get(chunk);
    if (!list) return;
    PROPS.byChunk.delete(chunk);
    for (const pr of list) if (pr.slot >= 0) dropProp(pr);
});

// ── smashing ────────────────────────────────────────────────────────────
function circlesHit(pr, px, pz, rad) {
    const cx = Math.cos(pr.ry), cz = -Math.sin(pr.ry);
    for (const [off, r] of pr.def.circ) {
        const x = pr.x + cx * off, z = pr.z + cz * off;
        const dx = px - x, dz = pz - z, rr = r + rad;
        if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
}
function carTouches(pr, car) {
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    for (const o of CAR_CIRCLES) if (circlesHit(pr, car.pos.x + fx * o, car.pos.z + fz * o, CAR_RADIUS)) return true;
    return false;
}
let copCool = 0, chipEl = null, chipT = 0;
/** Smash `pr` with a hit at velocity (vx, vz). byLulu: it counts on her bill + the cops care. */
export function smash(pr, vx, vz, byLulu = true) {
    const def = pr.def, sp = Math.hypot(vx, vz);
    if (pr.state !== "idle") return false;
    if (def.bolted) {
        if (pr.spent) return false;
        pr.spent = true;
        startGeyser(pr.x, pr.z);
    } else if (def.fly) {
        pr.state = "fly"; pr.t = 0;
        pr.vx = vx * 0.75 + rand(-1.2, 1.2); pr.vz = vz * 0.75 + rand(-1.2, 1.2); pr.vy = 3 + sp * 0.16;
        pr.spin = rand(5, 10) * (Math.random() < 0.5 ? -1 : 1); pr.spinZ = rand(-4, 4);
    } else {
        pr.state = "broken";
        release(pr.kind, pr.slot); pr.slot = -1;
    }
    burstBits(pr, vx, vz);
    sfx[def.sound] && sfx[def.sound]();
    if (pr.kind === "fruitstand") sfx.splat();
    if (!byLulu) return true;
    const value = def.value;
    PROPS.damage += value; PROPS.smashed++;
    const G = ctx.G;
    G.streetDamage = (G.streetDamage || 0) + value;
    addScore(Math.round(value / 2), "smash");
    rumble(0.35, 0.4, 120, true);
    G.shake = Math.max(G.shake || 0, 0.18);
    toast(`💥 ${T.PROP_NAMES[pr.kind] || "SMASH"}! +${value} 💸`, "gold", "streets:dmg");
    showChip();
    if (pr.kind === "fruitstand") vendorYell(pr);
    if (T.PROP_LULU[pr.kind] && Math.random() < 0.5) luluSays(pick(T.PROP_LULU[pr.kind]));
    stat("propsSmashed", 1);
    emit("streets:smash", { kind: pr.kind, value, total: G.streetDamage, x: pr.x, z: pr.z });
    // a cop who saw it: a chase (or, mid-chase, a little more heat — not every mailbox is a star)
    if (copCool <= 0) {
        const law = ctx.law;
        const chasing = law && law.chasing;
        if (!chasing || law.wanted < 3) {
            if (crime(def.police ? "DESTROYING POLICE PROPERTY" : "DESTRUCTION OF PROPERTY", pr.x, pr.z, { r: 55, msg: def.police ? "🚨 THAT'S POLICE PROPERTY!" : "🚨 VANDALISM — A COP SAW THAT!" })) copCool = chasing ? 20 : 8;
        }
    }
    return true;
}
function vendorYell(pr) {
    if (!models.npcMan) return;
    toast(`🍉 "${pick(T.FRUIT_VENDOR)}"`, "", "streets:vendor");
}
function showChip() {
    if (!chipEl || !chipEl.isConnected) {
        chipEl = document.createElement("div");
        chipEl.className = "streets-dmg hud-secondary";
        H.hudSlot("left").appendChild(chipEl);
    }
    chipEl.innerHTML = `💥 Damage <b>$${(ctx.G.streetDamage || 0).toLocaleString()}</b>`;
    chipEl.classList.remove("off");
    chipT = 4.5;
}
css("streets-props", `
.streets-dmg { background: rgba(120, 20, 30, .82); color: #fff; border-radius: 999px; padding: 4px 12px; font-weight: 700; font-size: 14px;
  box-shadow: var(--shadow); white-space: nowrap; transition: opacity .5s, transform .5s; align-self: flex-start; }
.streets-dmg b { color: #FFD54F; }
.streets-dmg.off { opacity: 0; transform: translateX(-8px); }
body.tv .streets-dmg { font-size: 22px; padding: 6px 16px; }
`);

// ── debris: two pooled InstancedMeshes, no per-frame allocation ─────────
const DEB_N = 260, ROUND_N = 90;
const deb = { box: null, round: null, items: [], next: 0, rItems: [], rNext: 0 };
const colorCache = new Map();
function col(hex) { let c = colorCache.get(hex); if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); } return c; }
function initDebris() {
    if (deb.box) return;
    const m1 = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05 });
    deb.box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m1, DEB_N);
    const m2 = new THREE.MeshStandardMaterial({ roughness: 0.45 });
    deb.round = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), m2, ROUND_N);
    for (const im of [deb.box, deb.round]) {
        im.frustumCulled = false; im.count = 0; im.castShadow = true; im.visible = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.setColorAt(0, col("#ffffff"));
        ctx.scene.add(im);
    }
    const mk = () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, sx: 1, sy: 1, sz: 1, life: 0, max: 1, c: null, flutter: false, rest: false });
    deb.items = Array.from({ length: DEB_N }, mk);
    deb.rItems = Array.from({ length: ROUND_N }, mk);
}
function burstBits(pr, vx, vz) {
    if (!deb.box) return;
    const sp = Math.hypot(vx, vz);
    for (const [n, hex, size, mode] of pr.def.bits) {
        const round = mode === "round", list = round ? deb.rItems : deb.items;
        for (let i = 0; i < n; i++) {
            const d = list[round ? deb.rNext++ % ROUND_N : deb.next++ % DEB_N];
            d.on = true; d.rest = false; d.flutter = mode === "flutter";
            d.x = pr.x + rand(-0.4, 0.4); d.y = 0.5 + rand(0, 0.8); d.z = pr.z + rand(-0.4, 0.4);
            const k = round ? 0.5 : 0.6;
            d.vx = vx * k * rand(0.5, 1.1) + rand(-2.5, 2.5); d.vz = vz * k * rand(0.5, 1.1) + rand(-2.5, 2.5);
            d.vy = rand(2, 4.5) + sp * 0.12 * (d.flutter ? 1.4 : 1);
            d.rx = rand(0, 6); d.ry = rand(0, 6); d.rz = rand(0, 6);
            d.wx = rand(-9, 9); d.wy = rand(-6, 6); d.wz = rand(-9, 9);
            d.sx = size[0] * rand(0.75, 1.2); d.sy = size[1] * rand(0.75, 1.2); d.sz = size[2] * rand(0.75, 1.2);
            d.max = d.life = rand(4.5, 6.5) * (d.flutter ? 1.2 : 1);
            d.c = col(hex);
        }
    }
}
function stepBits(list, im, dt, round) {
    let n = 0;
    for (const d of list) {
        if (!d.on) continue;
        d.life -= dt;
        if (d.life <= 0) { d.on = false; continue; }
        const half = round ? d.sy : d.sy / 2;
        if (!d.rest) {
            if (d.flutter) {           // paper: floats down, swaying
                d.vy = Math.max(d.vy - 9 * dt, -1.6);
                d.vx *= Math.exp(-1.8 * dt); d.vz *= Math.exp(-1.8 * dt);
                d.vx += Math.sin(d.life * 5 + d.ry) * 3 * dt;
            } else d.vy -= 16 * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
            if (d.y <= half) {
                d.y = half;
                if (Math.abs(d.vy) < 1.6 || d.flutter) {
                    if (round) { d.vy = 0; d.vx *= Math.exp(-2.2 * dt); d.vz *= Math.exp(-2.2 * dt); if (Math.hypot(d.vx, d.vz) < 0.15) d.rest = true; }
                    else { d.rest = true; d.rx = d.flutter || d.sy < d.sx * 0.5 ? 0 : Math.PI / 2 * Math.round(d.rx / (Math.PI / 2)); d.rz = 0; }
                } else { d.vy = -d.vy * 0.32; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.5; d.wz *= 0.5; }
            }
        }
        const fade = d.life < 0.6 ? d.life / 0.6 : 1;
        _e.set(d.rx, d.ry, d.rz);
        _q.setFromEuler(_e);
        _m.compose(_p.set(d.x, d.y, d.z), _q, _s.set(d.sx * fade, d.sy * fade, d.sz * fade));
        im.setMatrixAt(n, _m);
        im.setColorAt(n, d.c);
        n++;
    }
    im.count = n;
    im.visible = n > 0;
    if (n) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    return n;
}
/** Live debris pieces (tests: they settle, fade and are recycled). */
export function debrisCount() { return deb.box ? deb.items.filter(d => d.on).length + deb.rItems.filter(d => d.on).length : 0; }
export function geysersOn() { return geysers.filter(g => g.on).length; }
function clearDebris() {

    for (const d of deb.items) d.on = false;
    for (const d of deb.rItems) d.on = false;
    if (deb.box) { deb.box.count = 0; deb.round.count = 0; deb.box.visible = deb.round.visible = false; }

}

// ── whole props tumbling away, settling, then shrinking out ─────────────
function stepFlyers(dt) {
    for (let i = PROPS.all.length - 1; i >= 0; i--) {
        const pr = PROPS.all[i];
        if (pr.state === "broken") { if (pr.loose) dropProp(pr); continue; }
        if (pr.state !== "fly" && pr.state !== "down") continue;
        pr.t += dt;
        if (pr.state === "fly") {
            pr.vy -= 16 * dt;
            pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
            pr.rx += pr.spin * dt; pr.rz += pr.spinZ * dt;
            if (pr.y <= 0) {
                pr.y = 0;
                if (Math.abs(pr.vy) < 2.2) { pr.state = "down"; pr.t = 0; pr.rx = Math.PI / 2 * (pr.rx > 0 ? 1 : -1); pr.rz = 0; }
                else { pr.vy = -pr.vy * 0.3; pr.vx *= 0.5; pr.vz *= 0.5; pr.spin *= 0.5; }
            }
        } else if (pr.t > 5) {
            pr.sc = 1 - smooth((pr.t - 5) / 0.6);
            if (pr.sc <= 0.001) { if (pr.loose) dropProp(pr); else { release(pr.kind, pr.slot); pr.slot = -1; pr.state = "gone"; } continue; }
        }
        writeProp(pr);
    }
}

// ── hydrant geysers ─────────────────────────────────────────────────────
const geysers = [];
let geyserGeo = null, geyserMat = null, geyserLoop = null;
function startGeyser(x, z) {
    if (!geyserGeo) {
        geyserGeo = new THREE.CylinderGeometry(0.16, 0.42, 1, 12, 1, true);
        geyserGeo.translate(0, 0.5, 0);
        geyserMat = new THREE.MeshStandardMaterial({ color: "#B3E5FC", emissive: "#4FC3F7", emissiveIntensity: 0.25, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, roughness: 0.15 });
    }
    let g = geysers.find(q => !q.on);
    if (!g) {
        if (geysers.length >= 3) g = geysers[0];
        else { g = { mesh: new THREE.Mesh(geyserGeo, geyserMat.clone()) }; g.mesh.castShadow = false; geysers.push(g); }
    }
    Object.assign(g, { on: true, x, z, t: 0, dur: 7, hopped: false });
    g.mesh.position.set(x, 0.85, z);
    g.mesh.scale.set(1, 0.01, 1);
    ctx.scene.add(g.mesh);
}
const hop = { y: 0, v: 0 };
function stepGeysers(dt) {
    const car = ctx.car;
    let loud = 0;
    for (const g of geysers) {
        if (!g.on) continue;
        g.t += dt;
        const up = smooth(g.t / 0.35), down = 1 - smooth((g.t - (g.dur - 0.8)) / 0.8);
        const hgt = 5.2 * up * down * (1 + Math.sin(g.t * 23) * 0.04);
        g.mesh.scale.set(1 + Math.sin(g.t * 17) * 0.08, Math.max(0.01, hgt), 1 + Math.cos(g.t * 13) * 0.08);
        if (hgt > 0.5) {
            for (let k = 0; k < 2; k++) car.fx.emit(g.x + rand(-0.2, 0.2), 0.85 + hgt, g.z + rand(-0.2, 0.2), rand(-2.4, 2.4), rand(0, 1.5), rand(-2.4, 2.4), 0.55, 1.1, [0.78, 0.9, 1]);
            if (Math.random() < 0.5) car.fx.emit(g.x + rand(-1.5, 1.5), 0.1, g.z + rand(-1.5, 1.5), 0, 0.3, 0, 0.7, 0.6, [0.7, 0.85, 1]);
        }
        const dist = Math.hypot(car.pos.x - g.x, car.pos.z - g.z);
        // the camera passing through the water column mustn't turn the whole screen into a sheet of glass
        const cd = ctx.camera ? Math.hypot(ctx.camera.position.x - g.x, ctx.camera.position.z - g.z) : 99;
        g.mesh.material.opacity = 0.55 * clamp((cd - 0.8) / 3.5, 0.08, 1);

        loud = Math.max(loud, clamp(1 - dist / 45, 0, 1) * up * down);
        // drive through it: WHEEE — the car gets bounced
        if (hgt > 1 && dist < 1.6 && ctx.state === "playing" && hop.y <= 0.001) {
            hop.v = 5.5;
            car.applyImpulse(rand(-1.5, 1.5), rand(-1.5, 1.5), rand(-0.6, 0.6));
            sfx.boing();
            car.fx.burst(g.x, 1.2, g.z, 24, 4, [0.8, 0.92, 1], 0.8, 0.9);
            if (!g.hopped) { g.hopped = true; toast("💦 WHEEE!", "gold", "streets:wheee"); luluSays("Free car wash! WHEEE!"); }
        }
        if (g.t >= g.dur) { g.on = false; ctx.scene.remove(g.mesh); }
    }
    if (loud > 0.01 && !geyserLoop) geyserLoop = sfx.geyser();
    if (geyserLoop) { geyserLoop.set(loud * 0.18); if (loud <= 0.01) { geyserLoop.stop(); geyserLoop = null; } }
}
hook("hud", dt => {
    if (hop.y <= 0 && hop.v <= 0) return;
    hop.v -= 16 * dt;
    hop.y = Math.max(0, hop.y + hop.v * dt);
    if (hop.y <= 0) { hop.v = 0; ctx.G.shake = Math.max(ctx.G.shake || 0, 0.25); }
    if (ctx.state === "playing") { ctx.car.tilt.position.y += hop.y; ctx.car.tilt.rotation.x -= hop.v * 0.02; }
});

// ── the per-frame tick (an actor so it runs while driving AND on foot) ──
function tick(dt) {
    if (copCool > 0) copCool -= dt;
    if (chipT > 0) { chipT -= dt; if (chipT <= 0 && chipEl) chipEl.classList.add("off"); }
    if (!PROPS.ready) return true;
    const car = ctx.car, onFoot = ctx.foot && ctx.foot.active && ctx.state === "footRun";
    const fp = onFoot && ctx.foot.pos;
    for (const pr of PROPS.all) {
        if (pr.state !== "idle") continue;
        if (onFoot) {
            // she can't walk through them (push her out)
            if (Math.abs(pr.x - fp.x) < 3 && Math.abs(pr.z - fp.z) < 3) pushOut(pr, fp);
            continue;
        }
        if (Math.abs(pr.x - car.pos.x) > 7 || Math.abs(pr.z - car.pos.z) > 7) {
            if (pr.kind !== "hydrant") smashByTraffic(pr);
            continue;
        }
        if (!carTouches(pr, car)) continue;
        const sp = car.speed;
        if (pr.def.bolted) {
            // a hydrant doesn't move: she bounces off it (and pops the cap the first time)
            const imp = car.collideStatic(pr.x, pr.z, pr.def.circ[0][1]);
            if (imp > 2.5 && !pr.spent && ctx.state === "playing") smash(pr, car.vx, car.vz);
            if (imp > 2.5) { sfx.boing(); ctx.G.shake = Math.max(ctx.G.shake || 0, 0.3); }
        } else if (sp > 2.5 && ctx.state === "playing") {
            smash(pr, car.vx, car.vz);
            car.vx *= pr.def.slow; car.vz *= pr.def.slow;
        } else car.collideStatic(pr.x, pr.z, pr.def.circ[0][1]);
    }
    stepFlyers(dt);
    stepGeysers(dt);
    if (deb.box) { stepBits(deb.items, deb.box, dt, false); stepBits(deb.rItems, deb.round, dt, true); }
    flushPools();
    return true;
}
function smashByTraffic(pr) {
    for (const c of ctx.traffic.cars) {
        if (!(c.hit || (c.data && c.data.streetsCoast))) continue;
        if (Math.abs(c.x - pr.x) > 4 || Math.abs(c.z - pr.z) > 4) continue;
        const vx = c.hit ? c.vx : Math.sin(c.h) * c.speed, vz = c.hit ? c.vz : Math.cos(c.h) * c.speed;
        if (Math.hypot(vx, vz) < 3) continue;
        if (circlesHit(pr, c.x, c.z, 1.1)) { smash(pr, vx, vz, !!(c.data && c.data.streetsCoast)); return; }
    }
}
function pushOut(pr, p) {
    const cx = Math.cos(pr.ry), cz = -Math.sin(pr.ry);
    for (const [off, r] of pr.def.circ) {
        const x = pr.x + cx * off, z = pr.z + cz * off, rr = r + 0.32;
        const dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        p.x = x + dx / d * rr; p.z = z + dz / d * rr;
    }
}
function startTicker() { addActor({ foot: true, update: tick }); }

/** Smash every prop within r metres of (x, z) — explosions, a heist getaway, the coasting car… */
export function smashNear(x, z, r = 3, vx = 0, vz = 0) {
    let n = 0;
    for (const pr of PROPS.all.slice()) {
        if (pr.state !== "idle" || Math.hypot(pr.x - x, pr.z - z) > r) continue;
        const dx = pr.x - x, dz = pr.z - z, d = Math.hypot(dx, dz) || 1;
        if (smash(pr, vx || dx / d * 8, vz || dz / d * 8)) n++;
    }
    return n;
}

// ── run lifecycle: everything back on its feet, debris gone ─────────────
function resetAll() {
    clearDebris();
    for (const g of geysers) { g.on = false; ctx.scene.remove(g.mesh); }
    if (geyserLoop) { geyserLoop.stop(); geyserLoop = null; }
    hop.y = hop.v = 0;
    for (const pr of PROPS.all.slice()) {
        if (pr.loose) { dropProp(pr); continue; }
        if (pr.state !== "idle") {
            if (pr.slot < 0) pr.slot = alloc(pr.kind);
            if (pr.slot < 0) { dropProp(pr); continue; }
        }
        Object.assign(pr, { state: "idle", x: pr.hx, z: pr.hz, y: 0, ry: pr.hry, rx: 0, rz: 0, sc: 1, spent: false, t: 0 });
        writeProp(pr);
    }
    flushPools();
    PROPS.damage = 0;
    chipT = 0;
    if (chipEl) { chipEl.remove(); chipEl = null; }
}
hook("runStart", G => { resetAll(); G.streetDamage = 0; startTicker(); if (live()) loadProps(); });
on("title", resetAll);
on("boot", () => { if (live()) loadProps(); });
