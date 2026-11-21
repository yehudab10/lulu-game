// features/play — ✨ Golden Dreidels: spinning, sparkly collectibles on the
// road. All of them share one InstancedMesh per material (2 draw calls) and
// one twinkling point cloud. Pick-ups: sparkle + chime + a HUD chip counter
// for the run; the lifetime total lives in store("play"), and every 18 (חי,
// "chai") pays out coins, a confetti burst and a golden trail for the run.
import * as THREE from "three";
import { ctx, on, hook, css } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { models, instanced } from "../../models.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { SAVE, saveSoon, sfx, stat, lift, onWorldTick, DREIDEL_SVG } from "./common.js";
import { confetti, sparkleMaterial } from "./fx.js";

export const CHAI = 18;              // a milestone every 18 golden dreidels
export const CHAI_COINS = 36;        // double chai
const MAX = 160;                     // live dreidels on the road at once (≈4 chunks)
const SCALE = 0.85;
const PICK_R2 = 2.2 * 2.2;           // pickup radius (m²), horizontal
const BODY_Y = 0.62 * SCALE;         // body centre above the dreidel's tip

/** Every dreidel on the road: { x, y, z, s, d, k (chunk), kind, taken, pop, ph } */
export const list = [];
let inst = null, meshes = [], sparkles = null, sparkGeo = null;

// ── setup (needs the scene + the model) ───────────────────────────────────
on("boot", () => {
    if (!models.play_dreidel) return;
    inst = instanced(models.play_dreidel, MAX, []);
    meshes = inst.group.children.filter(o => o.isInstancedMesh);
    for (const im of meshes) {
        im.count = 0;
        im.frustumCulled = false;
        im.castShadow = true;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // a warm inner glow so they read as "magic gold" even in shade
        if (im.material.name === "DreidelGold") {
            im.material = im.material.clone();
            im.material.emissive = new THREE.Color("#7a4a00");
            im.material.emissiveIntensity = 0.55;
            im.material.envMapIntensity = 1.2;
        }
    }
    inst.group.name = "playDreidels";
    ctx.scene.add(inst.group);

    // 3 points per dreidel: two orbiting glints + a soft halo
    sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(MAX * 3), 1).setUsage(THREE.DynamicDrawUsage));
    sparkGeo.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(MAX * 3), 1));
    sparkGeo.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(MAX * 3), 1));
    const ph = sparkGeo.attributes.aPhase.array, kind = sparkGeo.attributes.aKind.array;
    for (let i = 0; i < MAX * 3; i++) { ph[i] = (i * 0.618) % 1; kind[i] = i % 3 === 2 ? 1 : 0; }
    sparkGeo.setDrawRange(0, 0);
    sparkles = new THREE.Points(sparkGeo, sparkleMaterial("#FFE08A"));
    sparkles.frustumCulled = false;
    sparkles.renderOrder = 2;
    ctx.scene.add(sparkles);
});

// ── spawning (spots.js decides where) ─────────────────────────────────────
export function addDreidel(x, y, z, s, d, k, kind = "line") {
    if (list.length >= MAX) return null;
    const dr = { x, y, z, s, d, k, kind, taken: false, pop: 0, ph: (s * 0.37) % 6.28 };
    list.push(dr);
    return dr;
}
/** Put a dreidel at road (s, d), `y` metres up (0 = hovering just above the road). */
export function addDreidelAt(s, d, k, kind = "line", y = 0.35) {
    const p = ctx.world.road.point(s, d, {});
    return addDreidel(p.x, y, p.z, s, d, k, kind);
}
export function removeChunk(k) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].k === k) list.splice(i, 1);
}
/** A fresh run: every dreidel on the road is back. */
export function resetTaken() { for (const dr of list) { dr.taken = false; dr.pop = 0; } }

// ── per-frame visuals ─────────────────────────────────────────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _sc = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), TILT = new THREE.Vector3(1, 0, 0);
onWorldTick((time, dt) => {
    if (!inst) return;
    const car = ctx.car, cam = ctx.camera;
    const pos = sparkGeo.attributes.position.array, size = sparkGeo.attributes.aSize.array;
    let n = 0;
    for (const dr of list) {
        if (Math.abs(dr.s - car.s) > 360) continue;
        let sc = SCALE, y = dr.y + Math.sin(time * 2.4 + dr.ph) * 0.12;
        if (dr.taken) {
            if (dr.pop <= 0) continue;
            dr.pop = Math.max(0, dr.pop - dt);
            const u = 1 - dr.pop / 0.32;              // pop: swell, shoot up, vanish
            sc = SCALE * (1 + u * 0.8) * (1 - u * u);
            y += u * 1.8;
        }
        // spin like a real dreidel: fast about its own axis, tilted, slowly precessing
        const spin = time * (dr.taken ? 16 : 4.2) + dr.ph;
        _q.setFromAxisAngle(UP, time * 1.3 + dr.ph);
        _q2.setFromAxisAngle(TILT, 0.13);
        _q.multiply(_q2);
        _q2.setFromAxisAngle(UP, spin);
        _q.multiply(_q2);
        _m.compose(_v.set(dr.x, y, dr.z), _q, _sc.setScalar(sc));
        inst.set(n, _m);
        // sparkles: two glints circling the body + a warm halo
        const k = n * 9, a = time * 2.1 + dr.ph, cy = y + BODY_Y * (sc / SCALE);
        pos[k] = dr.x + Math.cos(a) * 0.55; pos[k + 1] = cy + 0.25 + Math.sin(time * 3 + dr.ph) * 0.2; pos[k + 2] = dr.z + Math.sin(a) * 0.55;
        pos[k + 3] = dr.x - Math.cos(a) * 0.5; pos[k + 4] = cy - 0.2; pos[k + 5] = dr.z - Math.sin(a) * 0.5;
        pos[k + 6] = dr.x; pos[k + 7] = cy; pos[k + 8] = dr.z;
        const vis = dr.taken ? 0 : 1;
        size[n * 3] = 0.42 * vis; size[n * 3 + 1] = 0.34 * vis; size[n * 3 + 2] = (dr.kind === "risky" || dr.kind === "air" ? 2.6 : 2.1) * vis;
        if (++n >= MAX) break;
    }
    for (const im of meshes) { im.count = n; im.instanceMatrix.needsUpdate = true; }
    sparkGeo.setDrawRange(0, n * 3);
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.aSize.needsUpdate = true;
    const u = sparkles.material.uniforms;
    u.uTime.value = time;
    const hgt = ctx.renderer ? ctx.renderer.domElement.height : innerHeight;
    u.uScale.value = hgt * 0.5 / Math.tan((cam.fov * Math.PI / 180) / 2);
});

// ── pickups (driving only: respects pause, slow-mo, cutscenes) ────────────
let streak = 0, streakT = 0, toastT = 0;
hook("update", (dt, P, controlsOn) => {
    streakT -= dt;
    if (!list.length || ctx.state === "title") return;
    const car = ctx.car, cy = lift.y + 0.75;
    for (const dr of list) {
        if (dr.taken || Math.abs(dr.s - car.s) > 9) continue;
        const dx = dr.x - car.pos.x, dz = dr.z - car.pos.z;
        if (dx * dx + dz * dz > PICK_R2) continue;
        if (Math.abs(dr.y + BODY_Y - cy) > 1.5) continue;     // flying over / under it
        collect(dr);
    }
});

export function collect(dr) {
    const G = ctx.G, car = ctx.car;
    dr.taken = true; dr.pop = 0.32;
    streak = streakT > 0 ? streak + 1 : 0;
    streakT = 1.4;
    G.playDreidels = (G.playDreidels || 0) + 1;
    SAVE.dreidels++;
    saveSoon();
    const risky = dr.kind === "risky", air = dr.kind === "air";
    G.score += risky ? 150 : air ? 120 : 60;
    G.boost = Math.min(1, (G.boost || 0) + 0.03);
    sfx.chime(streak);
    rumble(0.05, 0.35, 70);
    const by = dr.y + BODY_Y;
    car.fx.burst(dr.x, by, dr.z, 16, 3.4, [1, 0.84, 0.32], 0.42, 0.7);
    car.fx.burst(dr.x, by, dr.z, 6, 1.4, [1, 1, 0.9], 0.7, 0.45);
    bumpChip();
    stat("dreidels", 1);
    if (SAVE.dreidels % CHAI === 0) milestone();
    else if (ctx.time > toastT) {
        toastT = ctx.time + 8;            // (one toast for a run of dreidels — the HUD chip counts every one; each re-count was a new pop-up)
        H.toast(risky ? `😱 RISKY DREIDEL! ✨ ${G.playDreidels}` : air ? `🛹 SKY DREIDEL! ✨ ${G.playDreidels}` : `✨ Golden dreidel ×${G.playDreidels}`, risky ? "pink" : "gold");
    }
}

function milestone() {
    const G = ctx.G, car = ctx.car;
    SAVE.milestones++;
    saveSoon();
    addCoins(CHAI_COINS, "dreidels");
    G.playTrail = true;
    confetti(car.pos.x, lift.y + 1.6, car.pos.z, 90, car.vx, car.vz, 6.5);
    sfx.jingle();
    rumble(0.6, 0.8, 380, true);
    H.banner(`🎉 <b>CHAI! ${SAVE.dreidels} golden dreidels</b><small>+${CHAI_COINS} coins · a golden trail for this drive ✨</small>`, 3200);
    stat("dreidelChai", 1);
}

// ── the golden trail (milestone reward, for the rest of the run) ─────────
let trailAcc = 0;
hook("update", dt => {
    const G = ctx.G, car = ctx.car;
    if (!G.playTrail || car.speed < 3) return;
    trailAcc += dt * Math.min(70, 18 + car.speed * 1.6);
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    while (trailAcc >= 1) {
        trailAcc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = car.pos.x - fx * 2.0 + rx * side * 0.75, z = car.pos.z - fz * 2.0 + rz * side * 0.75;
        car.fx.emit(x, 0.3 + lift.y, z, -car.vx * 0.08 + (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.6, -car.vz * 0.08 + (Math.random() - 0.5) * 0.6,
            0.32, 0.65, Math.random() < 0.25 ? [1, 1, 0.92] : [1, 0.8, 0.22]);
    }
});

// ── HUD chip: ✨ dreidel count for this run ───────────────────────────────
css("play-dreidel", `
.pl-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 8px; }
.pl-chip .pl-dr { width: 18px; height: 22px; filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)); }
.pl-chip b { font-size: 17px; color: #8a5a00; }
.pl-chip.bump { animation: plBump .45s cubic-bezier(.3,1.8,.5,1); }
.pl-chip.chai { background: linear-gradient(90deg, #FFF3C4, #FFE08A, #FFF3C4); background-size: 200% 100%; animation: plShine 1.6s linear infinite; }
@keyframes plBump { 0% { transform: scale(1); } 40% { transform: scale(1.28) rotate(-4deg); } 100% { transform: scale(1); } }
@keyframes plShine { from { background-position: 0 0; } to { background-position: 200% 0; } }
body.tv .pl-chip .pl-dr { width: 26px; height: 32px; } body.tv .pl-chip b { font-size: 24px; }
`);
let chip = null, chipN = -1;
function ensureChip() {
    if (chip && chip.isConnected) return chip;
    chip = document.createElement("div");
    chip.className = "hud-chip pl-chip hud-secondary";     // a per-drive collectible: hidden by Settings › HUD: Clean
    chip.innerHTML = `${DREIDEL_SVG}<b>0</b>`;
    chip.title = "Golden dreidels this drive";
    H.hudSlot("left").appendChild(chip);
    chipN = -1;
    return chip;
}
function bumpChip() {
    const c = ensureChip();
    c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump");
}
hook("hud", () => {
    const n = ctx.G.playDreidels || 0;
    if (!n) { if (chip) chip.style.display = "none"; chipN = 0; return; }
    const c = ensureChip();
    c.style.display = "";
    if (n !== chipN) { chipN = n; c.querySelector("b").textContent = n; }
    c.classList.toggle("chai", !!ctx.G.playTrail);
});

hook("runStart", G => { G.playDreidels = 0; G.playTrail = false; streak = 0; resetTaken(); });
