// features/airport — PLANES taking off and landing overhead. Cheap by construction:
//   • three planes, INSTANCED (one InstancedMesh per material of the plane model — ~8 draw calls for all of them, the
//     landing gear its own instanced set that folds away to nothing in the air), each in a parody livery;
//   • every plane is a pure function of one clock (the party clock with friends: everyone sees the same jet at the same
//     place): every SLOT seconds an event — a departure (roll down the runway, lift off, a climbing left turn back over
//     the landside and the highway) or an arrival (in from over the highway, line up, touch down, roll out, turn off);
//   • a soft shadow under each (a quad on the ground along the sun) that sweeps across the road as one passes over;
//   • a jet roar on positional audio (A.spatial, the engine's own loop kind), loudest on the take-off roll.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models } from "../../models.js";
import { bakedInstanced } from "./bake.js";
import * as A from "../../audio.js";
import { canvasTex } from "../../world.js";
import * as LY from "./layout.js";
import { LIVERIES } from "./lines.js";

export const PLANES = { n: 3, slot: 32, scale: 1.0, near: 2600 };
// keyframes [t (s), f, r, y] in the airport frame (r: the runway's centre line is RUNWAY_R)
const RW = LY.RUNWAY_R;
const DEP = [[0, -440, RW, 0], [9, -390, RW, 0], [17, -230, RW, 0], [23, -40, RW, 0], [27, 120, RW, 3], [31, 280, RW - 2, 22], [36, 430, RW - 25, 55],
    [41, 520, RW - 95, 90], [47, 520, 140, 130], [53, 430, -20, 170], [60, 260, -190, 215], [70, 0, -380, 280], [82, -300, -560, 350]];
const ARR = [[0, -1500, -700, 380], [11, -1380, -420, 320], [20, -1250, -140, 255], [28, -1080, 120, 190], [36, -860, RW - 15, 120], [43, -640, RW, 62],
    [49, -470, RW, 18], [53, -380, RW, 0.5], [57, -300, RW, 0], [64, -120, RW, 0], [73, 60, RW, 0], [80, 150, RW, 0], [86, 205, LY.TAXIWAY.r + 12, 0], [92, 150, LY.TAXIWAY.r, 0]];
const DUR = { dep: DEP[DEP.length - 1][0], arr: ARR[ARR.length - 1][0] };

/** Position (+ velocity) on a keyframe track at time t: cubic Hermite with Catmull-Rom tangents (C1 in time). */
function sample(K, t, out) {
    let i = 0;
    while (i < K.length - 2 && K[i + 1][0] <= t) i++;
    const a = K[i], b = K[i + 1], h = b[0] - a[0], u = Math.max(0, Math.min(1, (t - a[0]) / h));
    const tan = (k, c) => { const p = K[Math.max(0, k - 1)], q = K[Math.min(K.length - 1, k + 1)]; return (q[c] - p[c]) / Math.max(1e-3, q[0] - p[0]); };
    const u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
    for (const [c, key] of [[1, "f"], [2, "r"], [3, "y"]]) {
        const m0 = tan(i, c) * h, m1 = tan(i + 1, c) * h;
        out[key] = h00 * a[c] + h10 * m0 + h01 * b[c] + h11 * m1;
        out["v" + key] = (d00 * a[c] + d10 * m0 + d01 * b[c] + d11 * m1) / h;
    }
    if (out.y < 0) out.y = 0;
    return out;
}
const h01 = (k, salt) => { let x = Math.imul(k ^ 0x9e3779b9, 0x85ebca6b) ^ salt; x = Math.imul(x ^ x >>> 13, 0xc2b2ae35); return ((x ^ x >>> 16) >>> 0) / 4294967296; };

// ── the jet's roar (positional loop) ─────────────────────────────────────
let defined = false;
function defineSound() {
    if (defined || !A.spatial || !A.spatial.define) return;
    defined = true;
    A.spatial.define("airportJet", { loop: true, ref: 70, max: 1900, gain: 0.85, prio: 2, doppler: 0.45, gen(sr) {
        const n = Math.round(1.6 * sr), b = new Float32Array(n);
        let lp = 0, lp2 = 0, ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / sr, w = Math.random() * 2 - 1;
            lp += (w - lp) * 0.06; lp2 += (lp - lp2) * 0.15;       // a deep roar
            ph += 2 * Math.PI * (2150 + 40 * Math.sin(t * 2 * Math.PI * 1.25)) / sr;
            b[i] = lp2 * 2.6 + (w - lp) * 0.08 + Math.sin(ph) * 0.05;
        }
        // (a loop: fade the ends into each other)
        const f = Math.round(0.08 * sr);
        for (let i = 0; i < f; i++) { const k = i / f; b[i] = b[i] * k + b[n - f + i] * (1 - k); }
        let m = 0; for (let i = 0; i < n - f; i++) m = Math.max(m, Math.abs(b[i]));
        const out = b.slice(0, n - f);
        for (let i = 0; i < out.length; i++) out[i] *= 0.85 / (m || 1);
        return out;
    } });
}

// ── the planes ───────────────────────────────────────────────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _s = new THREE.Vector3(), _pv = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 0), _c = new THREE.Color();
let shadowTex = null;
function shadowMat() {
    if (!shadowTex) shadowTex = canvasTex(128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h); g.fillStyle = "#000";
        // a top-down silhouette: the fuselage, the wings, the tailplane (nose = +y of the texture = the quad's forward)
        g.beginPath(); g.ellipse(w / 2, h / 2, 6, 58, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(w / 2, h * 0.42); g.lineTo(w * 0.04, h * 0.62); g.lineTo(w * 0.06, h * 0.68); g.lineTo(w / 2, h * 0.56); g.lineTo(w * 0.94, h * 0.68); g.lineTo(w * 0.96, h * 0.62); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(w / 2, h * 0.84); g.lineTo(w * 0.32, h * 0.94); g.lineTo(w * 0.68, h * 0.94); g.closePath(); g.fill();
    }, false);
    return new THREE.MeshBasicMaterial({ map: shadowTex, color: "#000", transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
}

/** The live planes of one airport (index.js makes it when the airport is built, disposes it with it). */
export function makePlanes(G, scene) {
    defineSound();
    const tpl = models.airport_plane;
    if (!tpl) return null;
    const group = new THREE.Group();
    group.name = "AirportPlanes";
    // one baked InstancedMesh per livery (+ one for the gear): ~5 draw calls for every plane in the sky
    const liv = LIVERIES.map(L => bakedInstanced(tpl, PLANES.n, { Paint: L.Paint, Tail: L.Tail, Stripe: L.Stripe }, n => n !== "Gear", 0.35));
    const gearIM = bakedInstanced(tpl, PLANES.n, {}, n => n === "Gear", 0.6);
    for (const im of [...liv, gearIM]) group.add(im);
    const Z = new THREE.Matrix4().makeScale(0, 0, 0);
    // (packed: each livery's mesh draws only the planes wearing it this frame — `count` — not hidden copies)
    const used = liv.map(() => 0), _t = new THREE.Matrix4();
    const body = {
        begin() { used.fill(0); },
        set(j, m, li = -1) { if (li >= 0) liv[li].setMatrixAt(used[li]++, _t.copy(m)); },
        finish() { liv.forEach((im, k) => { im.count = used[k]; im.instanceMatrix.needsUpdate = true; }); },
        dispose() { for (const im of liv) im.dispose(); },
    };
    const gear = {
        set(j, m) { gearIM.setMatrixAt(j, m); },
        finish() { gearIM.instanceMatrix.needsUpdate = true; },
        dispose() { gearIM.dispose(); },
    };
    const shadows = [], sound = [], dots = [];
    for (let i = 0; i < PLANES.n; i++) {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(30, 32), shadowMat());
        sh.rotation.order = "YXZ"; sh.rotation.x = -Math.PI / 2; sh.visible = false; sh.renderOrder = 3;
        group.add(sh); shadows.push(sh);
        const dot = new THREE.Object3D(); group.add(dot); dots.push(dot);
        sound.push(null);
    }
    scene.add(group);
    const P = { group, body, gear, shadows, sound, dots, clock: 0, live: [], visibleN: 0 };
    const F = G.F, cur = {};
    P.update = (dt, camPos) => {
        P.clock += dt;
        const T = ctx.party && ctx.party.active && ctx.party.clock ? ctx.party.clock() : P.clock;
        const sun = ctx.lights && ctx.lights.sun, night = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0;
        const sx = sun ? sun.position.x - sun.target.position.x : 0.3, sy = sun ? Math.max(0.2, sun.position.y - sun.target.position.y) : 1, sz = sun ? sun.position.z - sun.target.position.z : 0.3;
        P.live.length = 0; P.visibleN = 0;
        const e0 = Math.floor(T / PLANES.slot);
        body.begin();
        for (let j = 0; j < PLANES.n; j++) {
            // the newest event in slot j that is still going
            let ev = e0 - ((e0 - j) % PLANES.n + PLANES.n) % PLANES.n, tau = T - ev * PLANES.slot;
            const kind = (ev % 2 + 2) % 2 ? "arr" : "dep";
            const on = tau >= 0 && tau <= DUR[kind];
            if (!on) { body.set(j, _m.makeScale(0, 0, 0)); gear.set(j, _m.makeScale(0, 0, 0)); shadows[j].visible = false; stopSound(P, j); continue; }
            sample(kind === "dep" ? DEP : ARR, tau, cur);
            const w = F.world(cur.f, cur.r, {}), vx = cur.vf * F.fx + cur.vr * F.rx, vz = cur.vf * F.fz + cur.vr * F.rz, hs = Math.hypot(vx, vz);
            const yaw = Math.atan2(vx, vz), pitch = Math.atan2(cur.vy, Math.max(1, hs));
            // bank into the turn (from the heading's rate of change)
            const ahead = sample(kind === "dep" ? DEP : ARR, Math.min(DUR[kind], tau + 0.5), {});
            const vx2 = ahead.vf * F.fx + ahead.vr * F.rx, vz2 = ahead.vf * F.fz + ahead.vr * F.rz;
            let dy = Math.atan2(vx2, vz2) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            const bank = cur.y > 8 ? Math.max(-0.5, Math.min(0.5, -dy * 2.2)) : 0;
            _e.set(-pitch, yaw, bank);
            _q.setFromEuler(_e);
            _pv.set(w.x, cur.y, w.z);
            _m.compose(_pv, _q, _s.setScalar(PLANES.scale));
            const li = Math.floor(h01(ev, 7) * LIVERIES.length), L = LIVERIES[li];
            body.set(j, _m, li);
            const gearDown = cur.y < 70 && !(kind === "dep" && tau > 33);
            gear.set(j, gearDown ? _m : _m.makeScale(0, 0, 0));
            dots[j].position.set(w.x, cur.y + 2, w.z);
            const dc = camPos ? Math.hypot(w.x - camPos.x, cur.y - camPos.y, w.z - camPos.z) : 0;
            P.live.push({ i: j, ev, kind, tau, x: w.x, y: cur.y, z: w.z, f: cur.f, r: cur.r, speed: Math.hypot(hs, cur.vy), dist: dc, livery: L.name });
            if (dc < PLANES.near) P.visibleN++;
            // its shadow: along the sun onto the ground, fading as it climbs
            const sh = shadows[j], k = cur.y / sy;
            const gx = w.x - sx * k, gz = w.z - sz * k;
            const op = (1 - Math.min(1, cur.y / 420)) * 0.42 * (1 - night * 0.8);
            sh.visible = op > 0.03 && (!camPos || Math.hypot(gx - camPos.x, gz - camPos.z) < 900);
            if (sh.visible) {
                sh.position.set(gx, 0.09, gz);
                sh.rotation.set(-Math.PI / 2, yaw + Math.PI, 0, "YXZ");     // (the texture's nose = the quad's +Y)
                const sc = PLANES.scale * (1 + cur.y / 600);
                sh.scale.set(sc, sc, 1);
                sh.material.opacity = op;
            }
            // the roar: a loop on the plane while it's near enough to hear
            playSound(P, j, dc, kind === "dep" && tau < 34 ? 1 : 0.7);
        }
        body.finish(); gear.finish();
    };
    P.dispose = () => {
        for (let j = 0; j < PLANES.n; j++) stopSound(P, j);
        scene.remove(group);
        body.dispose(); gear.dispose();
        for (const sh of shadows) { sh.geometry.dispose(); sh.material.dispose(); }
    };
    return P;
}
function playSound(P, j, dist, loud) {
    if (!A.spatial || !A.spatial.ready || ctx.skipping) { stopSound(P, j); return; }
    if (dist > 1700) { stopSound(P, j); return; }
    if (!P.sound[j] || !P.sound[j].alive) P.sound[j] = A.spatial.loop("airportJet", P.dots[j], { gain: loud, prio: 2 });
    else P.sound[j].set({ gain: loud });
}
function stopSound(P, j) { if (P.sound[j]) { try { P.sound[j].stop(); } catch (e) { /* gone */ } P.sound[j] = null; } }
