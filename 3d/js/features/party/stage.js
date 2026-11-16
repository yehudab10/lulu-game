// features/party — the 3D party stage: a sunny lot with a balloon arch and
// bunting where everyone's car lines up for the LOBBY (opaque, their own skin,
// nametags with 👑 / ✓), and the PODIUM after a race or a road trip (1-2-3
// blocks, the rest parked behind, confetti). Built once, lazily, as a set
// (ctx.view) so the road world stays untouched underneath.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { makeSet } from "../../core/sets.js";
import { models, cloneWithColors } from "../../models.js";
import { CarVisual, NameTag, Bubble, skinHex } from "./remote.js";

let S = null;      // the set + everything in it
const BAY = 3.6;

function canvasPlane(w, h, draw, px = 1024) {
    const c = document.createElement("canvas");
    c.width = px; c.height = Math.round(px * h / w);
    draw(c.getContext("2d"), c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, transparent: true }));
    m.userData.redraw = fn => { fn(c.getContext("2d"), c.width, c.height); t.needsUpdate = true; };
    return m;
}

function build() {
    const set = makeSet({ light: "day", sky: "#9fd8ff", ground: "#86c95f", fog: [70, 160] });
    set.sun.position.set(-10, 22, 14);
    set.sun.target.position.set(0, 0, 0);
    const own = (...a) => set.own(...a);
    // asphalt lot + bay lines
    const lot = new THREE.Mesh(own(new THREE.PlaneGeometry(40, 26)), own(new THREE.MeshStandardMaterial({ color: "#6b6f78", roughness: 0.95 })));
    lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.01, -3); lot.receiveShadow = true;
    set.add(lot);
    const lineMat = own(new THREE.MeshBasicMaterial({ color: "#f5f3ea" }));
    const lineGeo = own(new THREE.PlaneGeometry(0.14, 5.4));
    for (let row = 0; row < 2; row++) for (let i = 0; i <= 4; i++) {
        const l = new THREE.Mesh(lineGeo, lineMat);
        l.rotation.x = -Math.PI / 2;
        l.position.set((i - 2) * BAY, 0.02, row === 0 ? 0 : -6.6);
        set.add(l);
    }
    // the balloon arch + banner behind the cars
    const arch = new THREE.Group();
    const poleMat = own(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }));
    const poleGeo = own(new THREE.CylinderGeometry(0.18, 0.22, 7, 12));
    for (const x of [-9.5, 9.5]) { const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(x, 3.5, -11); p.castShadow = true; arch.add(p); }
    const banner = canvasPlane(17, 2.6, () => {});
    banner.position.set(0, 6.0, -11);
    arch.add(banner);
    S = { set, banner };
    drawBanner("");
    const balloonGeo = own(new THREE.SphereGeometry(0.62, 16, 12));
    const BAL = ["#E91E63", "#FFC107", "#42A5F5", "#66BB6A", "#AB47BC", "#FF7043"].map(c => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05 })));
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(balloonGeo, BAL[(i + (side > 0 ? 3 : 0)) % BAL.length]);
        b.position.set(side * 9.5 + (i % 2 ? 0.55 : -0.55) * (i < 8 ? 1 : 0), 0.9 + i * 0.78, -11 + (i % 3 - 1) * 0.35);
        b.scale.set(1, 1.15, 1);
        b.castShadow = true;
        arch.add(b);
    }
    // bunting
    const flagGeo = own(new THREE.BufferGeometry());
    flagGeo.setAttribute("position", new THREE.Float32BufferAttribute([-0.32, 0, 0, 0.32, 0, 0, 0, -0.62, 0], 3));
    flagGeo.computeVertexNormals();
    for (let i = 0; i < 26; i++) {
        const f = new THREE.Mesh(flagGeo, BAL[i % BAL.length]);
        const x = -9 + i * 0.72;
        f.position.set(x, 7.15 - Math.sin((i / 25) * Math.PI) * 0.9, -10.9);
        arch.add(f);
    }
    set.add(arch);
    // a few trees + bushes around
    if (models.treeRound) for (const [x, z, s] of [[-16, -12, 1.3], [15, -14, 1.5], [-21, -4, 1.1], [21, -3, 1.2], [-13, -20, 1.6], [12, -21, 1.4]]) {
        const t = cloneWithColors(models.treeRound); t.position.set(x, 0, z); t.scale.setScalar(s); set.add(t);
    }
    if (models.bush) for (const [x, z] of [[-11.5, -9], [11.5, -9], [-7, -12.5], [7, -12.5]]) { const b = cloneWithColors(models.bush); b.position.set(x, 0, z); set.add(b); }
    // the podium (hidden in the lobby)
    const pod = new THREE.Group();
    const PODC = ["#FFC107", "#B0BEC5", "#D7A86E"];
    const blocks = [[0, 1.3], [-4.2, 0.85], [4.2, 0.5]];
    blocks.forEach(([x, h], i) => {
        const m = new THREE.Mesh(own(new THREE.BoxGeometry(3.9, h, 5.4)), own(new THREE.MeshStandardMaterial({ color: PODC[i], roughness: 0.45, metalness: i === 0 ? 0.25 : 0.1 })));
        m.position.set(x, h / 2, -1.6); m.castShadow = m.receiveShadow = true;
        pod.add(m);
        const num = canvasPlane(1.4, 1.4, (g, w, hh) => { g.clearRect(0, 0, w, hh); g.fillStyle = "#fff"; g.font = `700 ${w * 0.8}px Fredoka, Arial`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(i + 1), w / 2, hh * 0.55); }, 256);
        num.position.set(x, h / 2, 1.12);
        pod.add(num);
    });
    pod.visible = false;
    set.add(pod);
    S.pod = pod;
    S.podTops = blocks.map(([x, h]) => new THREE.Vector3(x, h, -1.6));
    // confetti
    S.conf = makeConfetti(set);
    S.cars = new Map();     // uid → { v: CarVisual, tag, bubble }
    S.t = 0;
    S.mode = "lobby";
    return S;
}

export function drawBanner(code) {
    if (!S) return;
    S.banner.userData.redraw((g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#E91E63";
        g.beginPath(); if (g.roundRect) g.roundRect(6, 6, w - 12, h - 12, 46); else g.rect(6, 6, w - 12, h - 12); g.fill();
        g.lineWidth = 10; g.strokeStyle = "#FFE082"; g.stroke();
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 ${h * 0.46}px Fredoka, Arial, sans-serif`;
        g.fillText(code ? `🎉 PARTY · ${code}` : "🎉 LULU'S PARTY", w / 2, h * 0.54, w - 60);
    });
}

// ── confetti: one InstancedMesh, no per-frame allocations ───────────────
function makeConfetti(set) {
    const N = 220;
    const geo = set.own(new THREE.PlaneGeometry(0.16, 0.24));
    const mat = set.own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const im = new THREE.InstancedMesh(geo, mat, N);
    im.frustumCulled = false;
    const cols = ["#E91E63", "#FFC107", "#42A5F5", "#66BB6A", "#AB47BC", "#FF7043", "#FFFFFF"].map(c => new THREE.Color(c));
    const P = new Float32Array(N * 3), V = new Float32Array(N * 3), R = new Float32Array(N * 3), W = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) im.setColorAt(i, cols[i % cols.length]);
    const C = { im, N, P, V, R, W, on: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) };
    C.reset = i => {
        P[i * 3] = (Math.random() - 0.5) * 18; P[i * 3 + 1] = 8 + Math.random() * 10; P[i * 3 + 2] = -2 + (Math.random() - 0.5) * 10;
        V[i * 3] = (Math.random() - 0.5) * 1.5; V[i * 3 + 1] = -(1.4 + Math.random() * 1.6); V[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
        R[i * 3] = Math.random() * 6; R[i * 3 + 1] = Math.random() * 6; R[i * 3 + 2] = Math.random() * 6;
        W[i * 3] = (Math.random() - 0.5) * 9; W[i * 3 + 1] = (Math.random() - 0.5) * 7; W[i * 3 + 2] = (Math.random() - 0.5) * 9;
    };
    for (let i = 0; i < N; i++) { C.reset(i); P[i * 3 + 1] = Math.random() * 18; }
    im.visible = false;
    set.add(im);
    return C;
}
function tickConfetti(C, dt) {
    if (!C.im.visible) return;
    const { P, V, R, W, m, q, e, v, one } = C;
    for (let i = 0; i < C.N; i++) {
        const k = i * 3;
        P[k] += (V[k] + Math.sin(S.t * 2 + i) * 0.6) * dt; P[k + 1] += V[k + 1] * dt; P[k + 2] += V[k + 2] * dt;
        R[k] += W[k] * dt; R[k + 1] += W[k + 1] * dt; R[k + 2] += W[k + 2] * dt;
        if (P[k + 1] < 0.05) { if (C.on > 0) C.reset(i); else P[k + 1] = -5; }
        q.setFromEuler(e.set(R[k], R[k + 1], R[k + 2]));
        m.compose(v.set(P[k], P[k + 1], P[k + 2]), q, one);
        C.im.setMatrixAt(i, m);
    }
    C.im.instanceMatrix.needsUpdate = true;
}

// ── show / layout ────────────────────────────────────────────────────────
/** Lobby slot i: two rows of four (front row first), each row centred. */
function slotPos(i, n) {
    const row = i < 4 ? 0 : 1, j = i % 4;
    const inRow = row === 0 ? Math.min(4, n) : n - 4;
    return { x: (j - (inRow - 1) / 2) * BAY, z: row === 0 ? 0 : -6.6 };
}

export function show(mode = "lobby") {
    if (!S) build();
    S.mode = mode;
    S.set.show();
    S.pod.visible = mode === "podium";
    S.conf.im.visible = mode === "podium";
    S.conf.on = mode === "podium" ? 6 : 0;
    if (mode === "podium") for (let i = 0; i < S.conf.N; i++) { S.conf.reset(i); S.conf.P[i * 3 + 1] += 4 + Math.random() * 8; }
    S.t = 0;
}
export function hide() { if (S) S.set.hide(); }
export const shown = () => !!S && ctx.view === S.set.view;

/**
 * Line the cars up. list: [{uid, sk, hc, name, host, ready, status, me, rank (podium place 0..)}].
 */
export function layout(list) {
    if (!S) build();
    const seen = new Set();
    const n = list.length;
    let behind = 0;
    list.forEach((e, i) => {
        seen.add(e.uid);
        let c = S.cars.get(e.uid);
        if (!c) {
            c = { v: new CarVisual(e.sk), tag: new NameTag(), bubble: new Bubble(), bob: Math.random() * 6 };
            c.bubble.k = 1;
            c.tag.sp.position.y = 2.65;
            c.v.root.add(c.tag.sp, c.bubble.sp);
            c.v.root.rotation.y = 0;            // facing the camera (+Z)
            S.set.add(c.v.root);
            S.cars.set(e.uid, c);
        }
        if (c.v.skin !== e.sk) c.v.setSkin(e.sk);
        if (e.hc) c.v.setHair(e.hc);
        c.tag.set(e.name, skinHex(e.sk), { host: e.host, ready: e.ready, status: e.status, me: e.me });
        if (S.mode === "podium" && e.rank != null && e.rank < 3) {
            const p = S.podTops[e.rank];
            c.target = { x: p.x, y: p.y, z: p.z, ry: 0 };
        } else if (S.mode === "podium") {
            c.target = { x: (behind - (n - 4) / 2) * BAY, y: 0, z: -8.6, ry: 0 }; behind++;
        } else {
            const p = slotPos(i, n);
            c.target = { x: p.x, y: 0, z: p.z, ry: 0 };
        }
    });
    for (const [uid, c] of S.cars) if (!seen.has(uid)) { c.tag.dispose(); c.bubble.dispose(); c.v.dispose(); S.cars.delete(uid); }
}

export function say(uid, text) { const c = S && S.cars.get(uid); if (c) c.bubble.show(text); }
export function wave(uid) { const c = S && S.cars.get(uid); if (c) c.v.wave(); }

/** Per frame while the stage shows: settle cars into place, bob, camera. portrait: card at the bottom. */
export function tick(dt, { cardSide = "left" } = {}) {
    if (!S || !shown()) return;
    S.t += dt;
    let minX = 1e9, maxX = -1e9, n = 0;
    for (const c of S.cars.values()) {
        const t = c.target;
        if (!t) continue;
        const r = c.v.root;
        if (!c.placed) { r.position.set(t.x, t.y + 3, t.z); c.placed = true; }
        r.position.x += (t.x - r.position.x) * Math.min(1, dt * 5);
        r.position.z += (t.z - r.position.z) * Math.min(1, dt * 5);
        r.position.y += (t.y - r.position.y) * Math.min(1, dt * 7);
        c.bob += dt;
        c.v.animate(dt, 0, Math.sin(c.bob * 0.9) * 0.25, false, false, 0, 0);
        c.v.tilt.position.y = Math.max(0, Math.sin(c.bob * 2.3)) * 0.03;
        c.bubble.update(dt, 3.4);
        minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); n++;
    }
    tickConfetti(S.conf, dt);
    // camera: frame the cars; on a wide screen keep them right of the card
    const cam = S.set.camera;
    const aspect = cam.aspect;
    const podium = S.mode === "podium";
    const span = n ? Math.max(8, maxX - minX + 6) : 10;
    const portrait = aspect < 1;
    const dist = (podium ? 10.5 : 13) + span * (portrait ? 0.95 : 0.42);
    const cx = n ? (minX + maxX) / 2 : 0;
    const sway = Math.sin(S.t * 0.25) * 0.08;
    const yaw = sway + (cardSide === "left" && !portrait ? -0.12 : 0);
    cam.position.set(cx + Math.sin(yaw) * dist, (podium ? 5.2 : 6.8) + (portrait ? 4 : 0), 2 + Math.cos(yaw) * dist);
    // aim off-centre so the lineup sits beside (or above) the menu card
    const offX = cardSide === "left" && !portrait ? -span * (podium ? 0.5 : 0.42) - (podium ? 2.6 : 2) : 0;
    const offY = portrait ? -4.2 : 0;
    cam.lookAt(cx + offX, 1.2 + offY + (podium ? 0.6 : 0), -2.5);
    cam.fov = portrait ? 62 : 46;
    cam.updateProjectionMatrix();
}

export function clearStage() {
    if (!S) return;
    for (const c of S.cars.values()) { c.tag.dispose(); c.bubble.dispose(); c.v.dispose(); }
    S.cars.clear();
}
export const carCount = () => (S ? S.cars.size : 0);
