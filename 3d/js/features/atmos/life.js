// features/atmos/life.js — AMBIENT LIFE (all procedural three.js, pooled):
//   🐦 bird flocks — pecking in the fields, lined up on the power lines, or a V of
//      geese overhead. Drive close or HONK and they scatter (flaps + chirps).
//      One InstancedMesh for every bird; the wing flap runs in the vertex shader.
//   ✈️ a little prop plane towing a banner with a family message ("CALL YOUR
//      MOTHER — IMA"), crossing slowly ahead so you can actually read it
//   🎈 hot-air balloons drifting far off the road, burners puffing
//   🍂 autumn leaves swirling up behind the car in the leafy (fall) legs
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { canvasTex } from "../../world.js";
import { S, clamp, lerp, smooth, rand, pick, leafTex, say, V1, V2, V3, M4, Q4, C1, P0, UP } from "./common.js";
import { addGlowSource } from "./lights.js";
import * as sfx from "./sfx.js";

const E = new THREE.Euler();
const T = { birds: rand(25, 45), wire: rand(18, 35), geese: rand(60, 110), plane: rand(55, 110), balloon: rand(30, 70) };
export const counts = { scattered: 0, planes: 0, balloons: 0 };

// ═══ birds ════════════════════════════════════════════════════════════════
const MAX_BIRDS = 60;
let birdMesh = null, flapAttr = null;
const birds = [];      // live birds
const flocks = [];
const birdUniforms = { uTime: { value: 0 } };

function birdGeometry() {
    const P = [], W = [];
    const tri = (a, b, c, wa = 0, wb = 0, wc = 0) => { P.push(...a, ...b, ...c); W.push(wa, wb, wc); };
    const nose = [0, 0.02, 0.3], tail = [0, 0.03, -0.26], top = [0, 0.09, 0.02], bot = [0, -0.06, 0.02], l = [-0.075, 0.01, 0.02], r = [0.075, 0.01, 0.02];
    for (const [a, b] of [[top, l], [l, bot], [bot, r], [r, top]]) { tri(nose, a, b); tri(tail, b, a); }
    tri([0, 0.03, -0.22], [-0.11, 0.03, -0.42], [0.11, 0.03, -0.42]);          // tail fan
    for (const s of [-1, 1]) {
        const root0 = [s * 0.05, 0.04, 0.1], root1 = [s * 0.05, 0.04, -0.1], mid0 = [s * 0.3, 0.05, 0.06], mid1 = [s * 0.3, 0.05, -0.12], tip = [s * 0.56, 0.05, -0.08];
        tri(root0, mid0, root1, 0.05, 0.55, 0.05); tri(root1, mid0, mid1, 0.05, 0.55, 0.55); tri(mid0, tip, mid1, 0.55, 1, 0.55);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("aWing", new THREE.Float32BufferAttribute(W, 1));
    g.computeVertexNormals();
    return g;
}
function ensureBirds() {
    if (birdMesh) return;
    const g = birdGeometry();
    flapAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BIRDS * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("iFlap", flapAttr);
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff", side: THREE.DoubleSide });
    mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = birdUniforms.uTime;
        sh.vertexShader = "attribute float aWing; attribute vec3 iFlap; uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
            float wing = step(0.02, aWing);
            transformed.x *= mix(1.0, 0.32, iFlap.z * wing);
            transformed.y += aWing * (sin(uTime * 21.0 + iFlap.y) * 0.34 * iFlap.x - iFlap.z * 0.03);`);
    };
    mat.customProgramCacheKey = () => "atmosBird";
    birdMesh = new THREE.InstancedMesh(g, mat, MAX_BIRDS);
    birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    birdMesh.frustumCulled = false;
    birdMesh.castShadow = false;
    birdMesh.count = 0;
    birdMesh.setColorAt(0, C1.set("#333333"));
    ctx.scene.add(birdMesh);
}

function newBird(x, y, z, yaw, scale, color, mode) {
    if (birds.length >= MAX_BIRDS) return null;
    const b = { x, y, z, vx: 0, vy: 0, vz: 0, yaw, pitch: 0, mode, amp: mode === "fly" || mode === "sky" ? 1 : 0, fold: mode === "perch" ? 1 : 0,
        ph: Math.random() * 6.28, scale, color: new THREE.Color(color), t: 0, peck: rand(0.5, 3), hop: 0, glide: 0 };
    birds.push(b);
    return b;
}
const DARK = ["#3a3a44", "#4b4f5c", "#2e2b33", "#5a5560"], PIGEON = ["#8a8fa0", "#9aa0b0", "#7c8090", "#6f7383"];

/** A flock pecking in the grass a little ahead (kind "ground"), lined up on a wire ("wire"), or a V overhead ("sky"). */
export function spawnFlock(kind = "ground", opts = {}) {
    ensureBirds();
    const road = ctx.world.road, car = ctx.car;
    const f = { kind, birds: [], scattered: false, t: 0, x: 0, z: 0 };
    if (kind === "ground") {
        const s = car.s + (opts.ahead != null ? opts.ahead : rand(110, 190)), side = opts.side || (Math.random() < 0.5 ? -1 : 1), d = side * (opts.d || rand(9.6, 15));
        const p = road.point(s, d, P0);
        f.x = p.x; f.z = p.z;
        const n = opts.n || Math.floor(rand(7, 13)), cols = Math.random() < 0.5 ? DARK : PIGEON;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 2.6;
            const b = newBird(p.x + Math.cos(a) * r, 0.06, p.z + Math.sin(a) * r, Math.random() * 6.28, rand(1.25, 1.6), pick(cols), "perch");
            if (b) f.birds.push(b);
        }
    } else if (kind === "wire") {
        const P = opts.s != null ? opts.s : Math.ceil((car.s + rand(110, 170)) / 46) * 46;
        if (!opts.force && (ctx.world.isReserved(P, 11.5, 6) || ctx.world.isReserved(P + 46, 11.5, 6) || !ctx.world.biomeAt(P).poles)) return null;
        const off = pick([-1.1, 0, 1.1]);
        const a = road.point(P, 11.5, P0), b = road.point(P + 46, 11.5, {});
        const ax = a.x - Math.cos(a.h) * off, az = a.z + Math.sin(a.h) * off, bx = b.x - Math.cos(b.h) * off, bz = b.z + Math.sin(b.h) * off;
        const n = opts.n || Math.floor(rand(5, 10)), t0 = rand(0.18, 0.4);
        for (let i = 0; i < n; i++) {
            const t = t0 + i * rand(0.026, 0.045);
            if (t > 0.85) break;
            const y = 7.7 - Math.sin(t * Math.PI) * 0.9 + 0.06;
            const bird = newBird(ax + (bx - ax) * t, y, az + (bz - az) * t, a.h + (Math.random() < 0.75 ? Math.PI / 2 : -Math.PI / 2) + rand(-0.2, 0.2), rand(0.85, 1.0), pick(DARK), "perch");
            if (bird) { bird.wire = true; f.birds.push(bird); }
        }
        f.x = (ax + bx) / 2; f.z = (az + bz) / 2;
    } else {
        // a V of geese crossing ahead, high up
        const s = car.s + rand(160, 260), side = Math.random() < 0.5 ? -1 : 1;
        const p = road.point(s, side * 150, P0), q = road.point(s + rand(-40, 80), -side * 150, {});
        const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, sp = rand(8, 11);
        const y0 = rand(34, 48), yaw = Math.atan2(ux, uz);
        const n = 7 + 2 * Math.floor(rand(0, 3));
        for (let i = 0; i < n; i++) {
            const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
            const back = Math.abs(k) * 3.4, lat = k * 3.2;
            const b = newBird(p.x - ux * back - uz * lat, y0 + rand(-0.4, 0.4), p.z - uz * back + ux * lat, yaw, rand(2.4, 2.8), pick(["#5d5348", "#6b6052", "#4f463d"]), "sky");
            if (b) { b.vx = ux * sp; b.vz = uz * sp; b.ph = i * 0.5; f.birds.push(b); }
        }
    }
    if (!f.birds.length) return null;
    flocks.push(f);
    return f;
}

/** Make a flock take off (honk, a car too close, Lulu walking up). */
function scatter(f, fromX, fromZ) {
    if (f.scattered || f.kind === "sky") return;
    f.scattered = true;
    counts.scattered++;
    for (const b of f.birds) {
        let dx = b.x - fromX, dz = b.z - fromZ;
        const L = Math.hypot(dx, dz) || 1;
        dx /= L; dz /= L;
        const sp = rand(4.5, 8.5);
        b.vx = dx * sp + rand(-1.5, 1.5); b.vz = dz * sp + rand(-1.5, 1.5);
        b.vy = rand(4, 7.5);
        b.mode = "fly"; b.t = rand(-0.25, 0); b.amp = 1; b.fold = 0;
    }
    const d = Math.hypot(f.x - S.camPos.x, f.z - S.camPos.z);
    if (d < 70) { sfx.flutter(0.12 * clamp(1.4 - d / 50)); sfx.chirps(3 + Math.floor(Math.random() * 3), 0.045 * clamp(1.4 - d / 50)); }
}

function updateBirds(dt) {
    if (!birdMesh) return;
    const car = ctx.car, cam = S.camPos, fast = car.speed > 3;
    const onFoot = !!(ctx.foot && ctx.foot.active);
    for (let i = flocks.length - 1; i >= 0; i--) {
        const f = flocks[i];
        f.t += dt;
        const dx = f.x - car.pos.x, dz = f.z - car.pos.z, d = Math.hypot(dx, dz);
        if (!f.scattered && f.kind !== "sky") {
            const scare = onFoot ? 5.5 : fast ? (f.kind === "wire" ? 30 : 24) : 7;
            if (d < scare) scatter(f, car.pos.x, car.pos.z);
        }
        // forget flocks far behind / long gone
        const behind = (f.x - cam.x) * Math.sin(car.h) + (f.z - cam.z) * Math.cos(car.h) < -60;
        if (f.birds.every(b => b.dead) || (behind && !f.scattered) || f.t > 120) {
            for (const b of f.birds) b.dead = true;
            flocks.splice(i, 1);
        }
    }
    const fa = flapAttr.array;
    let n = 0;
    for (let i = birds.length - 1; i >= 0; i--) {
        const b = birds[i];
        if (b.dead) { birds.splice(i, 1); continue; }
        b.t += dt;
        if (b.mode === "perch") {
            // peck, shuffle, now and then a little hop
            b.peck -= dt;
            if (b.peck < 0) { b.peck = rand(0.6, 2.8); b.pitch = b.wire ? 0 : 0.7; if (!b.wire && Math.random() < 0.3) { b.hop = 0.25; b.yaw += rand(-1, 1); } }
            b.pitch = Math.max(0, b.pitch - dt * 3);
            b.hop = Math.max(0, b.hop - dt);
        } else if (b.mode === "fly") {
            if (b.t > 0) {
                b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
                b.vy = lerp(b.vy, 2.2, Math.min(1, dt * 0.8));
                const sp = Math.hypot(b.vx, b.vz);
                if (sp < 9) { b.vx *= 1 + dt * 0.25; b.vz *= 1 + dt * 0.25; }
                b.yaw = Math.atan2(b.vx, b.vz);
                b.pitch = -Math.atan2(b.vy, Math.max(1, sp)) * 0.6;
                b.glide -= dt;
                if (b.glide < -1.5 && Math.random() < dt * 0.6) b.glide = rand(0.4, 0.9);
                b.amp = b.glide > 0 ? 0.15 : 1;
            }
            const far = Math.hypot(b.x - cam.x, b.z - cam.z);
            if (far > 170 || b.y > 75 || b.t > 16) b.dead = true;
        } else {
            b.x += b.vx * dt; b.z += b.vz * dt;
            b.y += Math.sin(S.time * 0.7 + b.ph) * 0.15 * dt;
            b.amp = Math.sin(S.time * 0.5 + b.ph * 0.2) > -0.3 ? 0.55 : 0.1;
            if (Math.hypot(b.x - cam.x, b.z - cam.z) > 380) b.dead = true;
        }
        if (b.dead) { birds.splice(i, 1); continue; }
        E.set(b.pitch, b.yaw, 0, "YXZ");
        Q4.setFromEuler(E);
        M4.compose(V1.set(b.x, b.y + (b.hop > 0 ? Math.sin(b.hop / 0.25 * Math.PI) * 0.12 : 0), b.z), Q4, V2.setScalar(b.scale));
        birdMesh.setMatrixAt(n, M4);
        birdMesh.setColorAt(n, b.color);
        fa[n * 3] = b.amp; fa[n * 3 + 1] = b.ph; fa[n * 3 + 2] = b.fold;
        n++;
    }
    birdMesh.count = n;
    birdMesh.visible = n > 0;
    birdMesh.instanceMatrix.needsUpdate = true;
    if (birdMesh.instanceColor) birdMesh.instanceColor.needsUpdate = true;
    flapAttr.needsUpdate = true;
    birdUniforms.uTime.value = S.time;
}

on("honk", () => {
    if (!S.active || !ctx.car) return;
    const c = ctx.car.pos;
    for (const f of flocks) if (Math.hypot(f.x - c.x, f.z - c.z) < 90) scatter(f, c.x, c.z);
    // "HONK IF YOU LOVE CHOLENT" — the pilot waggles his wings back
    if (plane && plane.on && !plane.waggle && /HONK/.test(plane.text)) { plane.waggle = 2.2; say("✈️ The pilot waggles his wings at you!", "gold", 3); }
});

// ═══ the banner plane ═════════════════════════════════════════════════════
export const BANNERS = [
    "CALL YOUR MOTHER! — IMA", "BUBBE'S KUGEL: 2 EXITS AHEAD", "LULU, ARE YOU EATING?", "DRIVE SAFE, LULULEH! — BUBBE",
    "WEAR A SWEATER! IT'S COLD! — IMA", "HESHY'S POOL PARTY: SUNDAY. BRING A FLOATIE", "AVIGAIL WAS HERE. OBVIOUSLY.",
    "DINA + MORGAN LOVE LULU", "VEGAS OR BUST! — UNCLE BURRY", "FABIO'S SALON: WALK-INS WELCOME", "PICK UP CHALLAH ON THE WAY HOME",
    "MAZEL TOV ON YOUR DRIVING!", "DID YOU CALL BUBBE BACK?", "HONK IF YOU LOVE CHOLENT",
];
let plane = null;
const BANNER_W = 34, BANNER_H = 5.2;
const bannerTex = new Map();
function bannerTexture(text) {
    if (bannerTex.has(text)) return bannerTex.get(text);
    const t = canvasTex(1024, 160, (g, w, h) => {
        g.fillStyle = "#fffdf6"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#e53935"; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
        g.fillStyle = "#c62828";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `800 ${text.length > 30 ? 66 : 84}px Fredoka, "Arial Rounded MT Bold", "Arial Black", Arial, sans-serif`;
        g.fillText(text, w / 2, h / 2 + 3, w - 110);
        const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3); g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s); g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3); g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35); g.fill(); };
        g.fillStyle = "#ff4f9a"; heart(34, h / 2 - 22, 44); heart(w - 34, h / 2 - 22, 44);
    }, false);
    bannerTex.set(text, t);
    return t;
}
function buildPlane() {
    const red = new THREE.MeshStandardMaterial({ color: "#e53935", roughness: 0.45, metalness: 0.1 });
    const cream = new THREE.MeshStandardMaterial({ color: "#fff3df", roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: "#263238", roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: "#7fc8ff", roughness: 0.1, metalness: 0.3 });
    const g = new THREE.Group();
    const prof = [[0, -3.0], [0.22, -2.9], [0.35, -2.2], [0.5, -1.0], [0.62, 0.4], [0.6, 1.6], [0.5, 2.5], [0.3, 3.0], [0, 3.05]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 14).rotateX(Math.PI / 2), red);
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.635, 0.635, 0.5, 14, 1, true).rotateX(Math.PI / 2), cream);
    stripe.position.z = 0.6; g.add(stripe);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 1.35), cream);
    wing.position.set(0, 0.62, 0.7); g.add(wing);
    for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 1.37), red); tip.position.set(s * 4.1, 0.62, 0.7); g.add(tip); }
    const stab = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.75), cream); stab.position.set(0, 0.1, -2.6); g.add(stab);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.95), red); fin.position.set(0, 0.6, -2.65); fin.rotation.x = -0.25; g.add(fin);
    const win = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1.4), glass); win.position.set(0, 0.42, 1.3); g.add(win);
    for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12).rotateZ(Math.PI / 2), dark); w.position.set(s * 0.75, -0.95, 1.3); g.add(w);
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.08), dark); st.position.set(s * 0.6, -0.65, 1.3); st.rotation.z = s * 0.4; g.add(st);
    }
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 12).rotateX(Math.PI / 2), cream); spinner.position.z = 3.2; g.add(spinner);
    const prop = new THREE.Group(); prop.position.z = 3.12;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.0, 0.05), dark); prop.add(blade);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshBasicMaterial({ color: "#cfd8dc", transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    prop.add(disc);
    g.add(prop);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    // the banner: a waving strip (vertex shader), rope from the tail
    const bannerMat = new THREE.MeshLambertMaterial({ map: bannerTexture(BANNERS[0]), side: THREE.DoubleSide });
    const bu = { uTime: { value: 0 }, uLead: { value: 1 }, uLen: { value: BANNER_W } };
    bannerMat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, bu);
        sh.vertexShader = "uniform float uTime; uniform float uLead; uniform float uLen;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
            float fromLead = clamp((uLen * 0.5 - transformed.x * uLead) / uLen, 0.0, 1.0);
            transformed.z += sin(transformed.x * uLead * 0.45 + uTime * 7.0) * (0.12 + 0.55 * fromLead);
            transformed.y += sin(transformed.x * uLead * 0.3 + uTime * 5.0) * 0.12 * fromLead;`);
    };
    bannerMat.customProgramCacheKey = () => "atmosBanner";
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(BANNER_W, BANNER_H, 44, 2), bannerMat);
    banner.frustumCulled = false;
    const ropeGeo = new THREE.BufferGeometry();
    ropeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
    const rope = new THREE.LineSegments(ropeGeo, new THREE.LineBasicMaterial({ color: "#5d4037" }));
    rope.frustumCulled = false;
    const root = new THREE.Group();
    root.add(g, banner, rope);
    root.visible = false;
    ctx.scene.add(root);
    return { root, body: g, prop, banner, bu, rope, on: false };
}

/** Send the banner plane across (text optional). */
export function spawnPlane(text) {
    if (!plane) plane = buildPlane();
    if (plane.on) return plane;
    const msg = text || pick(BANNERS);
    plane.banner.material.map = bannerTexture(msg);
    plane.banner.material.needsUpdate = true;
    plane.text = msg;
    plane.dir = Math.random() < 0.5 ? -1 : 1;
    plane.d = -plane.dir * 78;
    plane.sRel = 100;
    plane.t = 0;
    plane.on = true;
    plane.said = false;
    plane.waggle = 0;
    plane.root.visible = true;
    counts.planes++;
    return plane;
}
function updatePlane(dt) {
    if (!plane || !plane.on) { if (plane) sfx.propLoop(0); return; }
    const car = ctx.car, road = ctx.world.road;
    plane.t += dt;
    plane.d += plane.dir * 6.2 * dt;
    plane.sRel = Math.max(72, plane.sRel - dt * 1.4);
    const p = road.point(car.s + plane.sRel, plane.d, P0);
    const h = p.h, rx = -Math.cos(h), rz = Math.sin(h), fx = Math.sin(h), fz = Math.cos(h);
    const nx = rx * plane.dir, nz = rz * plane.dir;
    const y = 17 + Math.sin(plane.t * 0.6) * 0.6;
    const b = plane.body;
    b.position.set(p.x, y, p.z);
    b.rotation.set(0, Math.atan2(nx, nz), 0, "YXZ");
    if (plane.waggle > 0) plane.waggle = Math.max(0, plane.waggle - dt);
    b.rotateZ(Math.sin(plane.t * 0.5) * 0.06 - plane.dir * 0.04 + (plane.waggle > 0 ? Math.sin(plane.waggle * 9) * 0.45 * Math.min(1, plane.waggle) : 0));
    plane.prop.rotation.z += dt * 55;
    // the banner trails behind the tail, turned (a little) to face the camera so it reads
    const lead = 3.2 + 7, half = BANNER_W / 2;
    const ex = p.x - nx * lead, ez = p.z - nz * lead;               // the rope's end = the banner's lead edge
    const back = h + Math.PI;
    let turn = Math.atan2(S.camPos.x - ex, S.camPos.z - ez) - back;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const yaw = back + clamp(turn, -0.7, 0.7);
    const lx = Math.cos(yaw) * plane.dir, lz = -Math.sin(yaw) * plane.dir;   // local +x · dir = toward the lead edge
    plane.banner.position.set(ex - lx * half, y - 0.5, ez - lz * half);
    plane.banner.rotation.set(0, yaw, 0);
    plane.bu.uTime.value = S.time;
    plane.bu.uLead.value = plane.dir;       // local +x is road-right: the lead edge is +x when flying right
    // rope: tail → top + bottom of the lead edge
    const r = plane.rope.geometry.attributes.position.array;
    const tx = p.x - nx * 3.0, tz = p.z - nz * 3.0, hh = BANNER_H / 2;
    r.set([tx, y + 0.1, tz, ex, y - 0.5 + hh, ez, tx, y + 0.1, tz, ex, y - 0.5 - hh, ez]);
    plane.rope.geometry.attributes.position.needsUpdate = true;
    const dist = Math.hypot(p.x - S.camPos.x, p.z - S.camPos.z);
    sfx.propLoop(clamp(1.25 - dist / 230) * (ctx.view ? 0 : 1));
    if (!plane.said && Math.abs(plane.d) < 30) plane.said = say("✈️ " + bannerLine(plane.text), "", 6);
    if (Math.abs(plane.d) > 95) { plane.on = false; plane.root.visible = false; sfx.propLoop(0); }
}
function bannerLine(t) { return /IMA|BUBBE|BURRY|AVIGAIL|HESHY|DINA|FABIO/.test(t) ? "A banner from the family…" : "Look up — a banner!"; }

// ═══ hot-air balloons ═════════════════════════════════════════════════════
const BALLOON_COLORS = [["#E53935", "#FFEB3B"], ["#1E88E5", "#FFFFFF"], ["#8E24AA", "#FF80AB"], ["#43A047", "#FFEB3B", "#E53935"],
    ["#FF7043", "#FFF176", "#4FC3F7"], ["#E91E63", "#F8BBD0", "#FFFFFF"], ["#F44336", "#FF9800", "#FFEB3B", "#4CAF50", "#2196F3", "#9C27B0"]];
const balloons = [];
let balloonKit = null;
function kit() {
    if (balloonKit) return balloonKit;
    const prof = [[1.25, 0], [2.6, 1.6], [5.0, 4.8], [6.6, 8.2], [7.1, 10.8], [6.7, 13.4], [5.2, 15.6], [2.9, 17.0], [0.01, 17.5]].map(([r, y]) => new THREE.Vector2(r, y));
    const env = new THREE.LatheGeometry(prof, 16).toNonIndexed();
    env.computeVertexNormals();
    balloonKit = {
        env, segs: 16, perSeg: env.attributes.position.count / 16,
        mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: true }),
        basket: new THREE.BoxGeometry(1.5, 1.1, 1.5).translate(0, -3.3, 0),
        basketMat: new THREE.MeshStandardMaterial({ color: "#a1683a", roughness: 0.9 }),
        rope: new THREE.MeshBasicMaterial({ color: "#5d4037" }),
    };
    return balloonKit;
}
/** A hot-air balloon drifting far off the road ahead. */
export function spawnBalloon(opts = {}) {
    const K = kit(), car = ctx.car, road = ctx.world.road;
    const colors = pick(BALLOON_COLORS).map(c => new THREE.Color(c));
    const geo = K.env.clone();
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) {
        const seg = Math.floor(i / K.perSeg);
        const c = colors[seg % colors.length];
        col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const g = new THREE.Group();
    const env = new THREE.Mesh(geo, K.mat);
    const basket = new THREE.Mesh(K.basket, K.basketMat);
    g.add(env, basket);
    for (const [x, z] of [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]]) {
        const rp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.9, 4), K.rope);
        rp.position.set(x * 1.25, -1.35, z * 1.25); rp.rotation.set(z * 0.18, 0, -x * 0.18);
        g.add(rp);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    const s = car.s + (opts.ahead || rand(320, 620)), side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const p = road.point(s, side * (opts.d || rand(70, 190)), P0);
    const scale = rand(0.85, 1.25);
    g.scale.setScalar(scale);
    const b = { g, x: p.x, z: p.z, y: opts.y || rand(45, 95), vy: rand(-0.3, 0.4), ph: Math.random() * 6, burn: 0, burnT: rand(1, 5), scale, t: 0 };
    g.position.set(b.x, b.y, b.z);
    g.rotation.y = Math.random() * 6.28;
    ctx.scene.add(g);
    balloons.push(b);
    counts.balloons++;
    return b;
}
function updateBalloons(dt) {
    const cam = S.camPos, car = ctx.car;
    for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        b.t += dt;
        b.x += S.wind.x * 0.5 * dt; b.z += S.wind.z * 0.5 * dt;
        b.burnT -= dt;
        if (b.burnT < 0) { b.burn = rand(0.8, 1.6); b.burnT = rand(4, 9); }
        b.burn = Math.max(0, b.burn - dt);
        b.vy = lerp(b.vy, b.burn > 0 ? 0.9 : -0.35, dt * 0.4);
        b.y = clamp(b.y + b.vy * dt, 30, 130);
        b.g.position.set(b.x, b.y + Math.sin(b.t * 0.4 + b.ph) * 0.6, b.z);
        b.g.rotation.y += dt * 0.03;
        const behind = (b.x - cam.x) * Math.sin(car.h) + (b.z - cam.z) * Math.cos(car.h);
        if (behind < -260 || Math.hypot(b.x - cam.x, b.z - cam.z) > 1100 || b.t > 400) {
            ctx.scene.remove(b.g);
            b.g.traverse(o => { if (o.isMesh && o.geometry !== kit().basket) o.geometry.dispose(); });
            balloons.splice(i, 1);
        }
    }
}
addGlowSource(gl => {
    for (const b of balloons) if (b.burn > 0 && S.active) {
        const f = 0.7 + Math.random() * 0.3;
        gl.add(b.x, b.g.position.y - 1.9 * b.scale, b.z, 1.3 * b.scale * f, 1, 0.62, 0.22, (0.5 + S.night) * f);
    }
});

// ═══ autumn leaves ════════════════════════════════════════════════════════
const MAX_LEAVES = 80;
let leafMesh = null;
const leaves = [];
const LEAF_COLS = ["#E8833A", "#C6452F", "#E9B53A", "#D9622B", "#B5651D", "#F2A541"].map(c => new THREE.Color(c));
function ensureLeaves() {
    if (leafMesh) return;
    const mat = new THREE.MeshLambertMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.34), mat, MAX_LEAVES);
    leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    leafMesh.frustumCulled = false; leafMesh.castShadow = false;
    leafMesh.count = 0;
    leafMesh.setColorAt(0, LEAF_COLS[0]);
    ctx.scene.add(leafMesh);
}
function addLeaf(x, y, z, vx, vy, vz) {
    if (leaves.length >= Math.ceil(MAX_LEAVES * Math.max(0.4, S.q))) return;
    leaves.push({ x, y, z, vx, vy, vz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
        sx: rand(-4, 4), sy: rand(-3, 3), sz: rand(-4, 4), ph: Math.random() * 6, life: rand(5, 8), ground: 0, c: pick(LEAF_COLS) });
}
let leafAcc = 0, leafAmb = 0;
function updateLeaves(dt) {
    const car = ctx.car;
    const leafy = S.biome === "fall" && S.rain < 0.6 && S.snow < 0.3;
    if (leafy && dt > 0) {
        ensureLeaves();
        const onFoot = !!(ctx.foot && ctx.foot.active);
        if (!onFoot && car.speed > 9) {
            leafAcc += Math.min(1, car.speed / 32) * 16 * Math.max(0.4, S.q) * dt;
            const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
            while (leafAcc >= 1) {
                leafAcc -= 1;
                const lat = rand(-1.4, 1.4), back = rand(2, 4);
                addLeaf(car.pos.x - fx * back + rx * lat, 0.08, car.pos.z - fz * back + rz * lat,
                    car.vx * 0.18 + rx * lat * rand(0.8, 2), rand(2.2, 4.5), car.vz * 0.18 + rz * lat * rand(0.8, 2));
            }
        }
        // a few drifting down from the roadside trees ahead
        leafAmb += 2.6 * Math.max(0.4, S.q) * dt;
        while (leafAmb >= 1) {
            leafAmb -= 1;
            const p = ctx.world.road.point(car.s + rand(8, 55), (Math.random() < 0.5 ? -1 : 1) * rand(6, 14), P0);
            addLeaf(p.x, rand(4, 8), p.z, S.wind.x * 0.5, -0.4, S.wind.z * 0.5);
        }
    }
    if (!leafMesh) return;
    let n = 0;
    for (let i = leaves.length - 1; i >= 0; i--) {
        const L = leaves[i];
        L.life -= dt;
        if (L.y > 0.03) {
            const drag = Math.exp(-1.6 * dt);
            L.vx = L.vx * drag + (S.wind.x * 0.6 + Math.sin(S.time * 2.3 + L.ph) * 1.4) * dt;
            L.vz = L.vz * drag + (S.wind.z * 0.6 + Math.cos(S.time * 1.9 + L.ph) * 1.4) * dt;
            L.vy = Math.max(-1.1, L.vy * drag - 2.2 * dt);
            L.x += L.vx * dt; L.y += L.vy * dt; L.z += L.vz * dt;
            L.rx += L.sx * dt; L.ry += L.sy * dt; L.rz += L.sz * dt;
            if (L.y <= 0.03) { L.y = 0.03; L.rx = -Math.PI / 2; L.rz = 0; L.life = Math.min(L.life, 2.5); }
        }
        if (L.life <= 0) { leaves.splice(i, 1); continue; }
        E.set(L.rx, L.ry, L.rz);
        Q4.setFromEuler(E);
        M4.compose(V1.set(L.x, L.y, L.z), Q4, V2.setScalar(Math.min(1, L.life * 2)));
        leafMesh.setMatrixAt(n, M4);
        leafMesh.setColorAt(n, L.c);
        n++;
    }
    leafMesh.count = n;
    leafMesh.visible = n > 0;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
}

// ═══ the schedule ═════════════════════════════════════════════════════════
function schedule(dt) {
    if (!ctx.enabled("atmos") || !(ctx.state === "playing" || ctx.state === "footRun")) return;
    const calm = S.rain < 0.1 && S.fog < 0.15 && S.snow < 0.3;
    const day = S.day > 0.6 && S.night < 0.4;
    for (const k in T) T[k] -= dt;
    if (T.birds < 0) { T.birds = rand(28, 55); if (day && S.rain < 0.3 && S.biome !== "strip") spawnFlock("ground"); }
    if (T.wire < 0) { T.wire = rand(22, 45); if (S.rain < 0.4 && S.night < 0.6) spawnFlock("wire"); }
    if (T.geese < 0) { T.geese = rand(70, 140); if (day && calm && S.biome !== "strip") spawnFlock("sky"); }
    if (T.plane < 0) { T.plane = rand(110, 210); if (day && calm) spawnPlane(); }
    if (T.balloon < 0) { T.balloon = rand(80, 160); if (day && calm && balloons.length < 2 && S.biome !== "strip") spawnBalloon(); }
}

export function lifeTick(dt) {
    if (dt > 0) schedule(dt);
    updateBirds(dt);
    updatePlane(dt);
    updateBalloons(dt);
    updateLeaves(dt);
}

/** Everything off the stage (run start, title). */
export function lifeClear() {
    for (const b of birds) b.dead = true;
    birds.length = 0; flocks.length = 0;
    if (birdMesh) { birdMesh.count = 0; birdMesh.visible = false; }
    if (plane) { plane.on = false; plane.root.visible = false; }
    for (const b of balloons) { ctx.scene.remove(b.g); b.g.traverse(o => { if (o.isMesh && o.geometry !== kit().basket) o.geometry.dispose(); }); }
    balloons.length = 0;
    leaves.length = 0;
    if (leafMesh) { leafMesh.count = 0; leafMesh.visible = false; }
    sfx.propLoop(0);
    T.birds = rand(20, 40); T.wire = rand(15, 30); T.geese = rand(50, 100); T.plane = rand(50, 100); T.balloon = rand(25, 60);
}
export function lifeHide() {
    if (birdMesh) birdMesh.visible = false;
    if (plane) plane.root.visible = false;
    for (const b of balloons) b.g.visible = false;
    if (leafMesh) leafMesh.visible = false;
    sfx.propLoop(0);
}
export function lifeShow() {
    if (plane && plane.on) plane.root.visible = true;
    for (const b of balloons) b.g.visible = true;
}

export function lifeInfo() {
    return { birds: birds.length, flocks: flocks.length, flying: birds.filter(b => b.mode !== "perch").length, scattered: counts.scattered,
        plane: !!(plane && plane.on), planeText: plane && plane.on ? plane.text : "", balloons: balloons.length, leaves: leaves.length };
}
