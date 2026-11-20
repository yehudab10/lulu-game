// features/decor/props.js — the decorations themselves, built in code from primitives.
//
// Every option is a few boxes / balls / cylinders merged into ONE vertex-coloured mesh per material (a solid
// one, a glowing one for bulbs and neon, a shiny one, a see-through one) — so a placed decoration costs 1–3
// draw calls, and all of them share four materials (no new shaders when you swap). Pictures and mats with
// writing get a small canvas texture (cached, made once). Nothing here runs per frame except the few
// `userData.spin` / `bob` children (the disco ball, the lava lamp) that house.js turns.
//
//   BUILD.outside[slot][opt](kit)   house-local metres (three.js: +Z = toward the street, the porch deck top ≈ 0.4)
//   BUILD.inside[slot][opt](kit)    Lulu's-room metres (the room's middle = 0, the back wall at z = −2.8, floor 0)
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), C = new THREE.Color();

let MATS = null;
/** The four shared materials (never disposed). */
export function mats() {
    if (MATS) return MATS;
    MATS = {
        solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, name: "DecorSolid" }),
        shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.75, name: "DecorShiny" }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, name: "DecorGlow" }),
        glass: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.1, depthWrite: false, name: "DecorGlass" }),
    };
    return MATS;
}

/** A bag of coloured primitives → one mesh per material. */
export class Kit {
    constructor() { this.parts = { solid: [], shiny: [], glow: [], glass: [] }; this.extras = []; this.kids = []; }
    /** o: rx ry rz (radians) · s (uniform scale) · sx sy sz · m: "solid" | "shiny" | "glow" | "glass" */
    add(geo, color, x = 0, y = 0, z = 0, o = {}) {
        E.set(o.rx || 0, o.ry || 0, o.rz || 0);
        Q.setFromEuler(E);
        const s = o.s != null ? o.s : 1;
        S3.set(o.sx != null ? o.sx : s, o.sy != null ? o.sy : s, o.sz != null ? o.sz : s);
        geo.applyMatrix4(M4.compose(P3.set(x, y, z), Q, S3));
        const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
        C.set(color);
        for (let i = 0; i < n; i++) { arr[i * 3] = C.r; arr[i * 3 + 1] = C.g; arr[i * 3 + 2] = C.b; }
        geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
        if (!geo.index) geo = toIndexed(geo);
        this.parts[o.m || "solid"].push(geo);
        return this;
    }
    box(w, h, d, col, x, y, z, o) { return this.add(new THREE.BoxGeometry(w, h, d), col, x, y, z, o); }
    cyl(rt, rb, h, col, x, y, z, o, seg = 12) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o); }
    ball(r, col, x, y, z, o, seg = 10) { return this.add(new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.7))), col, x, y, z, o); }
    cone(r, h, col, x, y, z, o, seg = 10) { return this.add(new THREE.ConeGeometry(r, h, seg), col, x, y, z, o); }
    torus(R, r, col, x, y, z, o, arc = Math.PI * 2, seg = 16) { return this.add(new THREE.TorusGeometry(R, r, 6, seg, arc), col, x, y, z, o); }
    /** A finished mesh that isn't vertex-coloured (a canvas picture). */
    extra(mesh) { this.extras.push(mesh); return mesh; }
    /** A child kit (its own object — for the bits that move: the disco ball, the lava blobs). */
    child(kit, data) { this.kids.push({ kit, data }); return kit; }
    build(name = "Decor", { shadow = false } = {}) {
        const g = new THREE.Group();
        g.name = name;
        const M = mats();
        for (const k of Object.keys(this.parts)) {
            const list = this.parts[k];
            if (!list.length) continue;
            const geo = list.length === 1 ? list[0] : mergeGeometries(list, false);
            if (list.length > 1) for (const p of list) p.dispose();
            geo.computeBoundingSphere();
            const mesh = new THREE.Mesh(geo, M[k]);
            mesh.userData.ownGeometry = true;
            mesh.castShadow = shadow && (k === "solid" || k === "shiny");
            mesh.receiveShadow = k === "solid";
            if (k === "glass") mesh.renderOrder = 2;
            g.add(mesh);
        }
        for (const e of this.extras) g.add(e);
        for (const c of this.kids) { const o = c.kit.build(name + "_part"); Object.assign(o.userData, c.data || {}); g.add(o); }
        return g;
    }
}
function toIndexed(geo) {
    const n = geo.attributes.position.count, idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    geo.setIndex(idx);
    return geo;
}

/** Free a built decoration (geometries + its own canvas materials; the shared materials and cached textures stay). */
export function disposeObj(o) {
    if (!o) return;
    o.removeFromParent();
    o.traverse(m => {
        if (!m.isMesh) return;
        if (m.userData.ownGeometry) m.geometry.dispose();
        if (m.userData.ownMaterial) m.material.dispose();
    });
}

// ── canvas textures (cached for the session) ─────────────────────────────
const TEX = new Map();
export function paintTex(key, w, h, draw, repeat = null) {
    if (TEX.has(key)) return TEX.get(key);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    TEX.set(key, t);
    return t;
}
/** A flat picture plane (its own material on a cached texture). */
function picPlane(tex, w, h, x, y, z, ry = 0, rx = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    m.userData.ownGeometry = true;
    m.userData.ownMaterial = true;
    return m;
}
const FONT = "Fredoka, Arial, sans-serif";
function text(g, t, x, y, size, color, weight = 700) {
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(t, x, y);
}

/** The wallpaper patterns (one texture each; the colour + ink come from the option). */
export function wallTex(w) {
    return paintTex("wall:" + w.pat + ":" + w.color + ":" + (w.ink || ""), 256, 256, (g, W, H) => {
        g.fillStyle = w.color; g.fillRect(0, 0, W, H);
        g.fillStyle = w.ink || w.color;
        if (w.pat === "plain") {
            g.globalAlpha = 0.06; g.fillStyle = "#000";
            for (let i = 0; i < 90; i++) g.fillRect((i * 97) % W, (i * 57) % H, 2, 2);
        } else if (w.pat === "stripes") {
            for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 28, H);
        } else if (w.pat === "checks") {
            for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) if (((x + y) / 32) % 2 === 0) g.fillRect(x, y, 32, 32);
        } else if (w.pat === "clouds") {
            const cloud = (x, y, s) => { for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.7], [0.3, -0.45, 0.75]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill(); } };
            cloud(60, 70, 22); cloud(190, 150, 26); cloud(90, 210, 18); cloud(220, 40, 14);
        } else if (w.pat === "glitter") {
            for (let i = 0; i < 260; i++) { const r = (i * 37) % 7 === 0 ? 2.6 : 1.3; g.globalAlpha = 0.45 + ((i * 13) % 10) / 18; g.beginPath(); g.arc((i * 131) % W, (i * 71 + (i >> 3) * 17) % H, r, 0, Math.PI * 2); g.fill(); }
        }
        g.globalAlpha = 1;
    }, [3, 1.4]);
}

// ── little figures used more than once ───────────────────────────────────
function flamingo(k, x, z, ry = 0, s = 1) {
    const c = Math.cos(ry), sn = Math.sin(ry);
    const at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
    const PINK = "#FF5FA2", LEG = "#E04585";
    for (const lx of [-0.05, 0.05]) { const [px, pz] = at(lx, 0); k.cyl(0.012 * s, 0.012 * s, 0.62 * s, LEG, px, 0.31 * s, pz); }
    const [bx, bz] = at(0, -0.02);
    k.ball(0.17 * s, PINK, bx, 0.72 * s, bz, { sx: 0.75, sy: 0.62, sz: 1.25, ry });
    const [tx, tz] = at(0, -0.24);
    k.cone(0.07 * s, 0.16 * s, PINK, tx, 0.78 * s, tz, { rx: -1.9, ry });
    // the neck: an S of two arcs → just a curved tube up, then the head
    const [nx, nz] = at(0, 0.16);
    k.torus(0.12 * s, 0.022 * s, PINK, nx, 0.86 * s, nz, { ry: ry + Math.PI / 2 }, Math.PI * 1.1, 10);
    const [hx, hz] = at(0, 0.22);
    k.ball(0.06 * s, PINK, hx, 1.06 * s, hz);
    const [kx, kz] = at(0, 0.3);
    k.cone(0.025 * s, 0.1 * s, "#2B2B2B", kx, 1.03 * s, kz, { rx: 2.2, ry });
}
const FLOCK = [[2.6, 8.3, 0.4], [3.3, 9.2, -0.2], [3.0, 10.6, 0.9], [4.0, 8.0, -0.6], [4.4, 10.9, 0.2], [5.3, 8.4, 0.7],
    [5.7, 10.2, -0.9], [6.2, 11.6, 0.1], [7.0, 9.4, -0.3], [7.6, 10.8, 1.1], [3.8, 11.9, -1.2], [5.0, 12.0, 0.5]];
/** The yard pieces she can't walk through: lawn option → [house-local x, z, radius, collider kind] (gnomes are low: she hops them). */
export const YARD_SOLIDS = {
    flamingo: [[5.6, 8.1, 0.22, "pole"]],
    gnomes: [[2.6, 8.2, 0.2, "bench"], [3.2, 8.9, 0.2, "bench"], [3.9, 8.25, 0.2, "bench"]],
    birdbath: [[6.3, 9.8, 0.46, "pole"]],
    flock: FLOCK.map(([x, z]) => [x, z, 0.2, "pole"]),
};
function gnome(k, x, z, coat, ry = 0) {
    k.cone(0.15, 0.32, coat, x, 0.16, z, {}, 10);
    k.ball(0.075, "#F6C9A8", x + Math.sin(ry) * 0.03, 0.36, z + Math.cos(ry) * 0.03);
    k.cone(0.07, 0.16, "#FFFFFF", x + Math.sin(ry) * 0.06, 0.28, z + Math.cos(ry) * 0.06, { rx: Math.PI });
    k.cone(0.08, 0.26, "#E53935", x, 0.53, z, { rz: 0.15 }, 10);
    k.ball(0.022, "#FF8A80", x + Math.sin(ry) * 0.09, 0.36, z + Math.cos(ry) * 0.09);
}
function tinyCar(k, x, y, z, col, s = 1, ry = 0) {
    k.box(0.14 * s, 0.05 * s, 0.26 * s, col, x, y + 0.04 * s, z, { ry });
    k.box(0.11 * s, 0.045 * s, 0.13 * s, "#BFE6FF", x, y + 0.085 * s, z - 0.01 * s, { ry, m: "shiny" });
    for (const [wx, wz] of [[-0.075, -0.08], [0.075, -0.08], [-0.075, 0.08], [0.075, 0.08]]) {
        const c = Math.cos(ry), sn = Math.sin(ry);
        k.cyl(0.028 * s, 0.028 * s, 0.02 * s, "#222", x + (wx * c + wz * sn) * s, y + 0.028 * s, z + (-wx * sn + wz * c) * s, { rz: Math.PI / 2, ry }, 8);
    }
}
function kugelBlock(k, w, h, d, x, y, z, o = {}) {
    k.box(w, h, d, "#E6B055", x, y, z, o);
    k.box(w * 1.02, h * 0.22, d * 1.02, "#B8742E", x, y + h * 0.42, z, o);
    const n = Math.max(3, Math.round(w * d * 40));
    for (let i = 0; i < n; i++) k.ball(Math.min(w, d) * 0.045, "#5B2C16", x + (((i * 37) % 10) / 10 - 0.45) * w * 0.85, y + h * 0.54, z + (((i * 71) % 10) / 10 - 0.45) * d * 0.85, {}, 5);
}

// ═════════════════════════════════════════════════════════════════════════
//  OUTSIDE — house-local (+Z toward the street; the porch deck top is y ≈ 0.4, its front edge z ≈ 6.34;
//  the door is at x 0.6, z 4.04; the steps x −0.3…1.5, z 6.34…7.1; the mailbox x 3.0, z 12.4; the lawn x 2…9)
// ═════════════════════════════════════════════════════════════════════════
const OUT = {
    porch: {
        mat(k) {
            k.box(1.25, 0.025, 0.7, "#7B5A44", 0.6, 0.415, 4.55);
            const tex = paintTex("mat", 256, 144, (g, W, H) => {
                g.fillStyle = "#A1785A"; g.fillRect(0, 0, W, H);
                g.strokeStyle = "#5D4037"; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, H - 20);
                text(g, "WIPE YOUR FEET!", W / 2, H * 0.42, 34, "#3E2723");
                text(g, "— IMA", W / 2, H * 0.72, 26, "#3E2723", 600);
            });
            k.extra(picPlane(tex, 1.1, 0.6, 0.6, 0.43, 4.55, Math.PI, -Math.PI / 2));
        },
        baskets(k) {
            for (const x of [-2.4, 3.1]) {
                k.cyl(0.008, 0.008, 0.5, "#555", x, 2.62, 5.95, {}, 4);
                k.cyl(0.26, 0.17, 0.22, "#8D6E63", x, 2.25, 5.95);
                k.ball(0.24, "#43A047", x, 2.38, 5.95, { sy: 0.6 });
                const cols = ["#FF4081", "#E040FB", "#FF80AB", "#FFFFFF", "#F50057"];
                for (let i = 0; i < 9; i++) { const a = i * 0.7; k.ball(0.06, cols[i % 5], x + Math.cos(a) * 0.2, 2.42 + (i % 3) * 0.03, 5.95 + Math.sin(a) * 0.2, {}, 6); }
                for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; k.ball(0.05, cols[(i + 2) % 5], x + Math.cos(a) * 0.27, 2.12, 5.95 + Math.sin(a) * 0.27, {}, 6); }
            }
        },
        rockers(k) {
            for (const [x, ry] of [[1.95, 0.25], [3.45, -0.25]]) {
                const c = Math.cos(ry), s = Math.sin(ry), z0 = 5.35;
                const at = (lx, lz) => [x + lx * c + lz * s, z0 - lx * s + lz * c];
                const W = "#FAFAFA";
                let [px, pz] = at(0, 0); k.box(0.56, 0.06, 0.5, W, px, 0.86, pz, { ry });
                [px, pz] = at(0, -0.27); k.box(0.56, 0.72, 0.05, W, px, 1.22, pz, { ry, rx: -0.12 });
                for (const lx of [-0.25, 0.25]) {
                    for (const lz of [-0.2, 0.2]) { [px, pz] = at(lx, lz); k.box(0.05, 0.42, 0.05, W, px, 0.63, pz, { ry }); }
                    [px, pz] = at(lx, 0); k.box(0.04, 0.05, 0.78, W, px, 0.43, pz, { ry, rx: 0.05 });
                    [px, pz] = at(lx, 0.02); k.box(0.05, 0.04, 0.42, W, px, 1.05, pz, { ry });
                }
                [px, pz] = at(0, 0.02); k.box(0.48, 0.07, 0.42, "#F48FB1", px, 0.92, pz, { ry });
            }
        },
        lights(k) {
            const cols = ["#FFE082", "#FF80AB", "#80DEEA", "#B9F6CA", "#FFF59D"];
            let i = 0;
            const run = (x0, x1, y, z, sag) => {
                const n = Math.max(3, Math.round((x1 - x0) / 0.32));
                for (let j = 0; j <= n; j++) {
                    const t = j / n, x = x0 + (x1 - x0) * t, yy = y - Math.sin(t * Math.PI) * sag;
                    k.ball(0.045, cols[i++ % cols.length], x, yy, z, { m: "glow" }, 6);
                }
                k.box(x1 - x0, 0.012, 0.012, "#2E7D32", (x0 + x1) / 2, y - sag * 0.6, z);
            };
            run(-3.2, -0.5, 1.33, 6.16, 0.06);
            run(1.7, 3.8, 1.33, 6.16, 0.06);
            run(-3.3, 3.9, 2.78, 6.28, 0.14);
            for (const x of [-3.2, 3.8]) for (let j = 0; j < 7; j++) k.ball(0.04, cols[(i++) % cols.length], x + Math.cos(j * 1.3) * 0.15, 0.6 + j * 0.3, 6.14 + Math.sin(j * 1.3) * 0.15, { m: "glow" }, 6);
        },
        balloons(k) {
            const cols = ["#FF4F9A", "#FFFFFF", "#FFD54F", "#FF80AB", "#B388FF"];
            const cx = 0.6, z = 6.95, rx = 1.3, ry = 2.2, n = 17;
            for (let i = 0; i < n; i++) {
                const a = Math.PI * i / (n - 1);
                const x = cx + Math.cos(a) * rx, y = 0.35 + Math.sin(a) * ry;
                k.ball(0.19, cols[i % cols.length], x, y, z, { sy: 1.15 }, 10);
                k.ball(0.15, cols[(i + 2) % cols.length], x + 0.04, y + 0.06, z + 0.16, { sy: 1.15 }, 8);
            }
            for (const x of [cx - rx, cx + rx]) {
                k.box(0.3, 0.12, 0.3, "#9E9E9E", x, 0.06, z);
                for (let j = 0; j < 3; j++) k.ball(0.17, cols[(j + 1) % cols.length], x + (j - 1) * 0.16, 0.28 + (j % 2) * 0.12, z + 0.1, { sy: 1.15 }, 8);
            }
        },
    },
    mailbox: {
        pink(k) {
            k.box(0.36, 0.26, 0.62, "#FF5FA2", 3.0, 1.15, 12.4);
            k.cyl(0.18, 0.18, 0.62, "#FF5FA2", 3.0, 1.28, 12.4, { rx: Math.PI / 2 }, 14);
            k.box(0.04, 0.34, 0.08, "#FFFFFF", 3.2, 1.38, 12.3);
            k.box(0.06, 0.08, 0.34, "#FFFFFF", 3.2, 1.55, 12.42);
            k.ball(0.07, "#FFFFFF", 3.0, 1.49, 12.4, {}, 8);
        },
        fish(k) {
            const O = "#FF8A3D";
            k.ball(0.32, O, 3.0, 1.25, 12.4, { sx: 0.68, sy: 0.82, sz: 1.35 }, 14);
            k.cone(0.22, 0.34, O, 3.0, 1.25, 11.86, { rx: -Math.PI / 2, sx: 0.4 }, 8);
            k.box(0.04, 0.42, 0.22, "#FF6F00", 3.0, 1.25, 11.66);
            k.box(0.04, 0.22, 0.3, "#FF6F00", 3.0, 1.58, 12.35, { rx: 0.3 });
            k.ball(0.11, "#4E1A12", 3.0, 1.2, 12.82, { sx: 0.9, sy: 0.7, sz: 0.4 }, 10);
            for (const s of [-1, 1]) {
                k.ball(0.07, "#FFFFFF", 3.0 + s * 0.2, 1.38, 12.68, {}, 8);
                k.ball(0.035, "#111111", 3.0 + s * 0.25, 1.39, 12.71, {}, 6);
                k.box(0.02, 0.12, 0.18, "#FF6F00", 3.0 + s * 0.22, 1.12, 12.3, { rz: s * 0.6 });
            }
            for (let i = 0; i < 6; i++) k.ball(0.05, "#FFB74D", 3.0 + (i % 2 ? 0.21 : -0.21), 1.2 + (i % 3) * 0.08, 12.1 + i * 0.07, { sx: 0.3 }, 5);
        },
        car(k) {
            const PK = "#FF4F9A";
            k.box(0.48, 0.26, 0.92, PK, 3.0, 1.15, 12.4);
            k.box(0.44, 0.08, 0.3, PK, 3.0, 1.29, 12.66, { rx: -0.25 });
            k.box(0.4, 0.22, 0.42, "#FFC1DC", 3.0, 1.38, 12.32);
            k.box(0.42, 0.14, 0.3, "#5B7A99", 3.0, 1.39, 12.32, { m: "shiny" });
            k.box(0.41, 0.15, 0.36, "#5B7A99", 3.0, 1.39, 12.32, { m: "shiny", sx: 1.04, sz: 0.85 });
            for (const [x, z] of [[2.77, 12.1], [3.23, 12.1], [2.77, 12.72], [3.23, 12.72]]) k.cyl(0.11, 0.11, 0.08, "#222222", x, 1.04, z, { rz: Math.PI / 2 }, 12);
            for (const x of [2.86, 3.14]) k.ball(0.04, "#FFF59D", x, 1.17, 12.87, { m: "glow" }, 6);
            k.box(0.2, 0.06, 0.02, "#FFFFFF", 3.0, 1.08, 12.87);
        },
        kugel(k) {
            kugelBlock(k, 0.62, 0.42, 0.78, 3.0, 1.2, 12.4);
            k.box(0.16, 0.02, 0.02, "#3E2723", 3.0, 1.15, 12.8);
            k.box(0.025, 0.42, 0.02, "#CFD8DC", 3.12, 1.62, 12.35, { rz: -0.35, m: "shiny" });
            for (const dx of [-0.03, 0, 0.03]) k.box(0.008, 0.12, 0.008, "#CFD8DC", 3.04 + dx, 1.86, 12.35, { rz: -0.35, m: "shiny" });
            k.box(0.04, 0.3, 0.08, "#E53935", 3.33, 1.4, 12.5);
        },
    },
    lawn: {
        flamingo(k) { flamingo(k, 5.6, 8.1, 0.5); },
        gnomes(k) { gnome(k, 2.6, 8.2, "#1E88E5", 0.3); gnome(k, 3.2, 8.9, "#43A047", 0); gnome(k, 3.9, 8.25, "#8E24AA", -0.3); },
        tulips(k) {
            k.box(2.5, 0.12, 0.7, "#5D4037", 3.15, 0.06, 7.05);
            k.box(2.6, 0.08, 0.06, "#BDBDBD", 3.15, 0.08, 7.44);
            const cols = ["#E53935", "#FFD600", "#FF4F9A"];
            for (let i = 0; i < 16; i++) {
                const x = 2.0 + (i % 8) * 0.32 + (i >= 8 ? 0.16 : 0), z = 6.88 + (i >= 8 ? 0.3 : 0);
                k.cyl(0.012, 0.012, 0.36, "#388E3C", x, 0.3, z, {}, 4);
                k.cyl(0.055, 0.035, 0.11, cols[i % 3], x, 0.52, z, {}, 7);
                k.box(0.05, 0.14, 0.012, "#4CAF50", x + 0.03, 0.22, z, { rz: -0.4 });
            }
        },
        birdbath(k) {
            const G = "#C9C4BC";
            k.cyl(0.24, 0.3, 0.08, G, 6.3, 0.04, 9.8);
            k.cyl(0.08, 0.11, 0.7, G, 6.3, 0.42, 9.8);
            k.cyl(0.42, 0.22, 0.14, G, 6.3, 0.84, 9.8, {}, 16);
            k.cyl(0.36, 0.36, 0.02, "#7EC8F2", 6.3, 0.9, 9.8, { m: "shiny" }, 16);
            k.ball(0.07, "#8D6E63", 6.62, 0.98, 9.8, { sz: 1.4 }, 8);
            k.ball(0.045, "#8D6E63", 6.62, 1.06, 9.88, {}, 6);
            k.cone(0.015, 0.05, "#FFA000", 6.62, 1.05, 9.94, { rx: Math.PI / 2 }, 5);
        },
        flock(k) {
            for (const [x, z, r] of FLOCK) flamingo(k, x, z, r, 0.95 + ((x * 7) % 1) * 0.15);
        },
    },
};

// ═════════════════════════════════════════════════════════════════════════
//  INSIDE — Lulu's room (the middle = x 0; back wall z −2.8; the bed x −2.25…−1.15, z −2.7…−0.7;
//  the nightstand x −0.6; the art at x 0.8 on the back wall; the shelf x 2.4; the rug at (0.4, 0.5))
// ═════════════════════════════════════════════════════════════════════════
const BED = { x: -1.7, z: -1.7, w: 1.1, l: 2.0 };
function bedBase(k, frame, blanket, pillow = "#FFFFFF", head = frame) {
    const { x, z, w, l } = BED;
    k.box(w, 0.3, l, frame, x, 0.2, z);
    k.box(w - 0.08, 0.16, l - 0.08, "#FAFAFA", x, 0.42, z);
    k.box(w, 0.07, l * 0.66, blanket, x, 0.53, z + l * 0.17);
    k.box(w + 0.02, 0.3, 0.05, blanket, x, 0.38, z + l / 2 + 0.01);
    k.box(w * 0.66, 0.12, 0.34, pillow, x, 0.56, z - l / 2 + 0.3);
    k.box(w + 0.06, 0.95, 0.08, head, x, 0.48, z - l / 2 - 0.02);
}
function picture(k, tex, w, h, x, y, frame = "#C9A227", fw = 0.06, m = "shiny") {
    const z = -2.73;
    k.box(w + fw * 2, fw, 0.04, frame, x, y + h / 2 + fw / 2, z, { m });
    k.box(w + fw * 2, fw, 0.04, frame, x, y - h / 2 - fw / 2, z, { m });
    k.box(fw, h, 0.04, frame, x - w / 2 - fw / 2, y, z, { m });
    k.box(fw, h, 0.04, frame, x + w / 2 + fw / 2, y, z, { m });
    k.extra(picPlane(tex, w, h, x, y, z + 0.005));
}
const NIGHT = { x: -0.6, z: -2.45 };
const SHELF = { x: 2.4, z: -2.55, ys: [0.07, 0.57, 1.07, 1.57] };

const IN = {
    bed: {
        basic(k) { bedBase(k, "#A1785A", "#4F7CC0"); },
        fluffy(k) {
            bedBase(k, "#FFFFFF", "#FF8FC0", "#FFD1E6", "#FFB3D6");
            const { x, z, w, l } = BED;
            for (let i = 0; i < 9; i++) k.ball(0.08, "#FFB3D6", x - w / 2 + 0.02, 0.52, z - l * 0.15 + i * 0.15, {}, 6);
            for (let i = 0; i < 9; i++) k.ball(0.08, "#FFB3D6", x + w / 2 - 0.02, 0.52, z - l * 0.15 + i * 0.15, {}, 6);
            for (const dx of [-0.2, 0.2]) k.ball(0.17, "#FF4F9A", x + dx, 0.66, z - l / 2 + 0.38, { sz: 0.55 }, 10);
            k.cyl(0.55, 0.55, 0.08, "#FFB3D6", x, 0.95, z - l / 2 - 0.02, { rx: Math.PI / 2, sy: 1 }, 18);
            for (let i = 0; i < 5; i++) k.ball(0.025, "#FFFFFF", x - 0.3 + i * 0.15, 0.95 + (i % 2) * 0.12, z - l / 2 + 0.03, {}, 5);
        },
        kugel(k) {
            bedBase(k, "#A1785A", "#FFE082");
            const { x, z, l } = BED;
            for (const dx of [-0.22, 0.22]) kugelBlock(k, 0.36, 0.16, 0.3, x + dx, 0.66, z - l / 2 + 0.32);
            kugelBlock(k, 0.3, 0.12, 0.24, x, 0.62, z - l / 2 + 0.7, { ry: 0.3 });
        },
        racecar(k) {
            const { x, z, w, l } = BED, PK = "#FF2E7E";
            k.box(w + 0.2, 0.42, l + 0.2, PK, x, 0.27, z);
            k.box(w - 0.04, 0.14, l - 0.2, "#FAFAFA", x, 0.52, z - 0.05);
            k.box(w - 0.02, 0.06, l * 0.55, "#2B2B2B", x, 0.6, z + 0.12);
            k.box(w * 0.6, 0.12, 0.32, "#FFFFFF", x, 0.62, z - l / 2 + 0.3);
            k.box(w + 0.2, 0.55, 0.12, PK, x, 0.55, z - l / 2 - 0.05);
            k.box(w + 0.3, 0.06, 0.26, "#2B2B2B", x, 0.92, z + l / 2 + 0.12);
            for (const s of [-1, 1]) k.box(0.05, 0.42, 0.05, "#2B2B2B", x + s * 0.4, 0.68, z + l / 2 + 0.12);
            for (const s of [-1, 1]) for (const dz of [-0.6, 0.6]) k.cyl(0.24, 0.24, 0.16, "#202020", x + s * (w / 2 + 0.12), 0.24, z + dz, { rz: Math.PI / 2 }, 14);
            for (const s of [-1, 1]) for (const dz of [-0.6, 0.6]) k.cyl(0.11, 0.11, 0.17, "#B0BEC5", x + s * (w / 2 + 0.12), 0.24, z + dz, { rz: Math.PI / 2, m: "shiny" }, 10);
            k.cyl(0.2, 0.2, 0.01, "#FFFFFF", x + w / 2 + 0.105, 0.3, z, { rz: Math.PI / 2 }, 16);
            k.box(0.012, 0.18, 0.04, "#2B2B2B", x + w / 2 + 0.115, 0.3, z);
            for (const s of [-1, 1]) k.ball(0.06, "#FFF59D", x + s * 0.38, 0.38, z + l / 2 + 0.11, { m: "glow" }, 8);
        },
        canopy(k) {
            bedBase(k, "#FFFFFF", "#C8A2E8", "#FFFFFF", "#FFFFFF");
            const { x, z, w, l } = BED, H = 2.15;
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.035, 0.035, H, "#FFFFFF", x + sx * w / 2, H / 2, z + sz * l / 2, {}, 8);
            for (const sz of [-1, 1]) k.box(w, 0.05, 0.05, "#FFFFFF", x, H, z + sz * l / 2);
            for (const sx of [-1, 1]) k.box(0.05, 0.05, l, "#FFFFFF", x + sx * w / 2, H, z);
            for (const sx of [-1, 1]) k.box(0.02, H - 0.25, l * 0.9, "#F8BBD0", x + sx * (w / 2 + 0.02), H / 2 + 0.1, z, { m: "glass" });
            k.box(w, 0.02, l, "#F8BBD0", x, H + 0.02, z, { m: "glass" });
            for (let i = 0; i < 5; i++) k.cone(0.04, 0.12, "#FFD54F", x - 0.2 + i * 0.1, 1.02, z - l / 2 - 0.05, { m: "shiny" }, 5);
            k.box(0.5, 0.06, 0.05, "#FFD54F", x, 0.96, z - l / 2 - 0.05, { m: "shiny" });
        },
    },
    art: {
        singer(k) {
            const tex = paintTex("art:singer", 256, 360, (g, W, H) => {
                const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#2A0F3D"); gr.addColorStop(1, "#7B1FA2");
                g.fillStyle = gr; g.fillRect(0, 0, W, H);
                g.fillStyle = "rgba(255,255,255,0.12)";
                for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(W / 2, 40); g.lineTo(i * 45 - 10, H); g.lineTo(i * 45 + 12, H); g.fill(); }
                g.fillStyle = "#120818";
                g.beginPath(); g.arc(W / 2, 150, 46, 0, Math.PI * 2); g.fill();
                g.beginPath(); g.ellipse(W / 2, 262, 70, 62, 0, Math.PI, 0); g.fill();
                g.fillRect(W / 2 - 70, 262, 140, 40);
                g.fillStyle = "#FFD54F"; g.fillRect(W / 2 + 34, 170, 10, 46); g.beginPath(); g.arc(W / 2 + 39, 166, 14, 0, Math.PI * 2); g.fill();
                text(g, "?", W / 2, 152, 64, "#FF4F9A");
                text(g, "WHO IS HE?", W / 2, 46, 34, "#FFD54F");
                text(g, "the mystery voice", W / 2, 326, 22, "#FFFFFF", 600);
            });
            picture(k, tex, 0.62, 0.88, 0.8, 1.62, "#111111", 0.03, "solid");
        },
        ticket(k) {
            const tex = paintTex("art:ticket", 300, 220, (g, W, H) => {
                g.fillStyle = "#FFFDF4"; g.fillRect(0, 0, W, H);
                g.fillStyle = "#1565C0"; g.fillRect(0, 0, W, 44);
                text(g, "CITATION", W / 2, 23, 28, "#FFFFFF");
                text(g, "SPEED: 87 in a 55", W / 2, 80, 26, "#B71C1C");
                text(g, "DRIVER: LULU", W / 2, 116, 24, "#212121", 600);
                text(g, "VEHICLE: PINK", W / 2, 148, 22, "#212121", 600);
                g.strokeStyle = "#B71C1C"; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, 192, 70, 18, -0.08, 0, Math.PI * 2); g.stroke();
                text(g, "MY FIRST! ♥", W / 2, 192, 20, "#E91E63");
            });
            picture(k, tex, 0.66, 0.48, 0.8, 1.66, "#E8B923", 0.08);
        },
        map(k) {
            const tex = paintTex("art:map", 360, 240, (g, W, H) => {
                g.fillStyle = "#F3E9C6"; g.fillRect(0, 0, W, H);
                g.fillStyle = "#CFE3A8"; for (const [x, y, r] of [[60, 70, 50], [180, 150, 70], [300, 80, 55]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
                g.strokeStyle = "#D32F2F"; g.lineWidth = 4; g.setLineDash([10, 6]);
                g.beginPath(); g.moveTo(320, 60); g.bezierCurveTo(250, 200, 140, 40, 40, 180); g.stroke(); g.setLineDash([]);
                for (const [x, y] of [[320, 60], [252, 120], [170, 96], [100, 140], [40, 180]]) { g.fillStyle = "#D32F2F"; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); }
                text(g, "LAKEWOOD", 310, 30, 20, "#4E342E");
                text(g, "VEGAS!", 52, 214, 24, "#4E342E");
            });
            picture(k, tex, 0.9, 0.6, 0.8, 1.66, "#6D4C41", 0.05, "solid");
        },
        bubbe(k) {
            const tex = paintTex("art:bubbe", 240, 300, (g, W, H) => {
                const gr = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 180); gr.addColorStop(0, "#6D8B74"); gr.addColorStop(1, "#2F3E33");
                g.fillStyle = gr; g.fillRect(0, 0, W, H);
                g.fillStyle = "#5C3B6E"; g.beginPath(); g.ellipse(W / 2, H + 10, 100, 90, 0, Math.PI, 0); g.fill();
                g.fillStyle = "#F2C9A6"; g.beginPath(); g.ellipse(W / 2, 140, 58, 70, 0, 0, Math.PI * 2); g.fill();
                g.fillStyle = "#D9D9D9"; g.beginPath(); g.ellipse(W / 2, 82, 66, 36, 0, Math.PI, 0); g.fill();
                g.beginPath(); g.arc(W / 2, 52, 26, 0, Math.PI * 2); g.fill();
                g.strokeStyle = "#3E2723"; g.lineWidth = 4;
                for (const s of [-1, 1]) { g.beginPath(); g.arc(W / 2 + s * 24, 130, 16, 0, Math.PI * 2); g.stroke(); }
                g.beginPath(); g.moveTo(W / 2 - 8, 130); g.lineTo(W / 2 + 8, 130); g.stroke();
                g.fillStyle = "#3E2723"; for (const s of [-1, 1]) { g.beginPath(); g.arc(W / 2 + s * 24, 131, 4, 0, Math.PI * 2); g.fill(); }
                g.strokeStyle = "#B23A48"; g.lineWidth = 5; g.beginPath(); g.arc(W / 2, 168, 22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
                g.fillStyle = "#FFFFFF"; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(W / 2 - 42 + i * 14, 222, 6, 0, Math.PI * 2); g.fill(); }
            });
            picture(k, tex, 0.6, 0.76, 0.8, 1.64, "#C9A227", 0.11);
            k.ball(0.05, "#E8B923", 0.8, 2.12, -2.72, { m: "shiny" }, 8);
        },
    },
    rug: {
        round(k) {
            k.cyl(1.0, 1.0, 0.02, "#FF8FC0", 0.4, 0.012, 0.5, {}, 28);
            k.cyl(0.72, 0.72, 0.022, "#FFC1DC", 0.4, 0.014, 0.5, {}, 28);
            k.cyl(0.36, 0.36, 0.024, "#FF4F9A", 0.4, 0.016, 0.5, {}, 20);
        },
        road(k) {
            k.box(2.2, 0.02, 1.6, "#7CB860", 0.4, 0.012, 0.5);
            k.box(2.2, 0.022, 0.26, "#555B63", 0.4, 0.014, 0.35);
            k.box(0.26, 0.022, 1.6, "#555B63", -0.15, 0.014, 0.5);
            k.box(0.26, 0.022, 0.9, "#555B63", 1.0, 0.014, 0.85);
            for (let i = 0; i < 8; i++) k.box(0.1, 0.024, 0.02, "#FFEB3B", -0.6 + i * 0.27, 0.016, 0.35);
            for (const [x, z, c] of [[-0.5, 0.95, "#EF5350"], [0.4, 0.95, "#42A5F5"], [0.45, -0.05, "#FFCA28"], [1.3, 0.1, "#AB47BC"]]) {
                k.box(0.2, 0.12, 0.18, c, x, 0.07, z); k.cone(0.16, 0.1, "#795548", x, 0.18, z, { ry: Math.PI / 4 }, 4);
            }
            tinyCar(k, 0.1, 0.02, 0.32, "#FF4F9A", 0.9, Math.PI / 2);
        },
        zebra(k) {
            k.box(2.0, 0.02, 1.3, "#F5F5F0", 0.4, 0.012, 0.5);
            for (let i = 0; i < 9; i++) k.box(0.09, 0.022, 1.25, "#262626", -0.45 + i * 0.21, 0.014, 0.5, { ry: 0.25 * Math.sin(i * 1.7) });
            for (const [dx, dz] of [[-1.05, -0.55], [-1.05, 0.55], [1.05, -0.55], [1.05, 0.55]]) k.box(0.3, 0.02, 0.22, "#F5F5F0", 0.4 + dx, 0.012, 0.5 + dz);
        },
        shag(k) {
            k.cyl(1.1, 1.1, 0.03, "#7E3FC0", 0.4, 0.015, 0.5, {}, 28);
            for (let i = 0; i < 70; i++) {
                const a = i * 2.399, r = Math.sqrt(i / 70) * 1.02;
                k.cone(0.055, 0.09, i % 3 ? "#9C5BD9" : "#B47AE8", 0.4 + Math.cos(a) * r, 0.07, 0.5 + Math.sin(a) * r, {}, 5);
            }
        },
    },
    lamp: {
        desk(k) {
            const { x, z } = NIGHT;
            k.cyl(0.09, 0.11, 0.04, "#455A64", x, 0.55, z);
            k.cyl(0.015, 0.015, 0.34, "#90A4AE", x, 0.74, z, { m: "shiny" });
            k.cyl(0.1, 0.17, 0.2, "#FFF3D6", x, 0.94, z, {}, 14);
            k.ball(0.05, "#FFF8E1", x, 0.88, z, { m: "glow" }, 8);
        },
        lava(k) {
            const { x, z } = NIGHT;
            k.cone(0.1, 0.12, "#37474F", x, 0.59, z, {}, 12);
            k.cyl(0.07, 0.1, 0.36, "#FF80AB", x, 0.83, z, { m: "glass" }, 14);
            k.cone(0.06, 0.08, "#37474F", x, 1.05, z, {}, 12);
            const b = new Kit();
            b.ball(0.045, "#FF6E40", x, 0.78, z, { m: "glow", sy: 1.3 }, 8);
            b.ball(0.035, "#FF9100", x + 0.01, 0.92, z, { m: "glow", sy: 1.2 }, 8);
            k.child(b, { bob: 1 });
        },
        neon(k) {
            const y0 = 1.62, x0 = -1.7, z = -2.72, P = "#FF4FB0", t = 0.035;
            k.box(1.1, 0.42, 0.03, "#2B1B2E", x0, y0 + 0.18, z - 0.01);
            const L = (x) => { k.box(t, 0.28, t, P, x, y0 + 0.18, z + 0.02, { m: "glow" }); k.box(0.14, t, t, P, x + 0.06, y0 + 0.05, z + 0.02, { m: "glow" }); };
            const U = (x) => { k.box(t, 0.26, t, P, x, y0 + 0.19, z + 0.02, { m: "glow" }); k.box(t, 0.26, t, P, x + 0.14, y0 + 0.19, z + 0.02, { m: "glow" }); k.box(0.17, t, t, P, x + 0.07, y0 + 0.05, z + 0.02, { m: "glow" }); };
            L(x0 - 0.4); U(x0 - 0.17); L(x0 + 0.08); U(x0 + 0.29);
            k.ball(0.03, "#FFD1EC", x0 + 0.48, y0 + 0.32, z + 0.02, { m: "glow" }, 6);
        },
        chandelier(k) {
            const x = 0.4, z = 0.4, y = 2.25;
            k.cyl(0.012, 0.012, 0.42, "#C9A227", x, 2.48, z, { m: "shiny" }, 6);
            k.torus(0.3, 0.025, "#C9A227", x, y, z, { rx: Math.PI / 2, m: "shiny" }, Math.PI * 2, 20);
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4, px = x + Math.cos(a) * 0.3, pz = z + Math.sin(a) * 0.3;
                k.cyl(0.018, 0.018, 0.1, "#FFF8E1", px, y + 0.07, pz, {}, 6);
                k.ball(0.02, "#FFE082", px, y + 0.14, pz, { m: "glow" }, 6);
                k.cone(0.025, 0.09, "#E1F5FE", px, y - 0.08, pz, { rx: Math.PI, m: "glass" }, 6);
            }
            k.ball(0.08, "#E1F5FE", x, y - 0.12, z, { m: "glass" }, 10);
        },
        disco(k) {
            const x = 0.4, z = 0.4;
            k.cyl(0.008, 0.008, 0.4, "#9E9E9E", x, 2.5, z, {}, 4);
            const b = new Kit();
            const geo = new THREE.IcosahedronGeometry(0.22, 2), flat = geo.toNonIndexed();
            flat.computeVertexNormals();          // (faceted: every mirror tile catches the light on its own)
            b.add(flat, "#E8EEF4", x, 2.22, z, { m: "shiny" });
            geo.dispose();
            k.child(b, { spin: 1, cx: x, cz: z });
        },
    },
    shelf: {
        books(k) {
            const cols = ["#1A237E", "#7B1F2B", "#1B5E20", "#F9A825", "#FF4F9A", "#5D4037"];
            for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) k.box(0.07, 0.24 + ((i * 3 + r) % 4) * 0.025, 0.24, cols[(i + r * 2) % 6], SHELF.x - 0.3 + i * 0.1, SHELF.ys[r] + 0.13, SHELF.z);
        },
        plush(k) {
            const y = SHELF.ys;
            // a bear
            k.ball(0.13, "#A1785A", SHELF.x - 0.2, y[1] + 0.13, SHELF.z + 0.02); k.ball(0.09, "#A1785A", SHELF.x - 0.2, y[1] + 0.3, SHELF.z + 0.04);
            for (const s of [-1, 1]) k.ball(0.035, "#A1785A", SHELF.x - 0.2 + s * 0.07, y[1] + 0.38, SHELF.z + 0.04);
            k.ball(0.03, "#3E2723", SHELF.x - 0.2, y[1] + 0.29, SHELF.z + 0.13);
            // a bunny
            k.ball(0.12, "#FAFAFA", SHELF.x + 0.18, y[1] + 0.12, SHELF.z + 0.02); k.ball(0.08, "#FAFAFA", SHELF.x + 0.18, y[1] + 0.27, SHELF.z + 0.04);
            for (const s of [-1, 1]) k.ball(0.03, "#FFC1DC", SHELF.x + 0.18 + s * 0.04, y[1] + 0.4, SHELF.z + 0.04, { sy: 2.6 });
            // a slightly worried duck
            k.ball(0.11, "#FFEB3B", SHELF.x, y[2] + 0.11, SHELF.z); k.ball(0.07, "#FFEB3B", SHELF.x, y[2] + 0.25, SHELF.z + 0.03);
            k.cone(0.03, 0.08, "#FF9800", SHELF.x, y[2] + 0.24, SHELF.z + 0.12, { rx: Math.PI / 2 }, 6);
            for (const c of ["#FF80AB", "#80DEEA", "#B39DDB"]) k.ball(0.1, c, SHELF.x - 0.3 + ["#FF80AB", "#80DEEA", "#B39DDB"].indexOf(c) * 0.3, y[0] + 0.1, SHELF.z + 0.02);
        },
        globes(k) {
            for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) {
                const x = SHELF.x - 0.18 + i * 0.36, y = SHELF.ys[r];
                k.cyl(0.08, 0.09, 0.06, "#6D4C41", x, y + 0.03, SHELF.z);
                k.ball(0.085, "#E1F5FE", x, y + 0.14, SHELF.z, { m: "glass" }, 10);
                k.cone(0.04, 0.08, ["#2E7D32", "#E53935", "#FF4F9A", "#1E88E5", "#FFD54F", "#8E24AA"][r * 2 + i], x, y + 0.12, SHELF.z, {}, 6);
            }
        },
        cars(k) {
            const cols = ["#FF4F9A", "#7E3FC0", "#FF7043", "#42A5F5", "#66BB6A", "#E53935", "#E8B923", "#212121"];
            for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) tinyCar(k, SHELF.x - 0.27 + i * 0.27, SHELF.ys[r], SHELF.z, cols[(r * 3 + i) % 8], 1, Math.PI / 2 - 0.3);
        },
        trophies(k) {
            const G = "#E8B923";
            const cup = (x, y, s) => {
                k.box(0.12 * s, 0.06 * s, 0.12 * s, "#4E342E", x, y + 0.03 * s, SHELF.z);
                k.cyl(0.015 * s, 0.02 * s, 0.1 * s, G, x, y + 0.11 * s, SHELF.z, { m: "shiny" }, 6);
                k.cyl(0.07 * s, 0.035 * s, 0.12 * s, G, x, y + 0.22 * s, SHELF.z, { m: "shiny" }, 10);
                for (const sg of [-1, 1]) k.torus(0.035 * s, 0.008 * s, G, x + sg * 0.07 * s, y + 0.23 * s, SHELF.z, { m: "shiny" }, Math.PI * 2, 8);
            };
            cup(SHELF.x - 0.25, SHELF.ys[0], 1.2); cup(SHELF.x + 0.05, SHELF.ys[0], 1.0); cup(SHELF.x + 0.28, SHELF.ys[0], 0.9);
            cup(SHELF.x, SHELF.ys[1], 1.8);
            cup(SHELF.x - 0.2, SHELF.ys[2], 1.1); cup(SHELF.x + 0.22, SHELF.ys[2], 1.3);
            k.box(0.3, 0.06, 0.01, "#FFFFFF", SHELF.x, SHELF.ys[1] + 0.03, SHELF.z + 0.065);
        },
    },
};

/** The couch's see-through cover (Bubbe's plastic), sized to the kit couch at (x, z). */
export function couchCover(k, x, z) {
    k.box(2.32, 0.62, 0.98, "#F3F6FF", x, 0.36, z, { m: "glass" });
    k.box(2.32, 0.5, 0.2, "#F3F6FF", x, 0.86, z - 0.36, { m: "glass" });
}

export const BUILD = { outside: OUT, inside: IN };
/** Build one option (or null when it has no model of its own — a paint, the default). */
export function buildOption(where, slot, opt, name) {
    const fn = BUILD[where] && BUILD[where][slot] && BUILD[where][slot][opt];
    if (!fn) return null;
    const k = new Kit();
    fn(k);
    return k.build(name || `Decor_${slot}_${opt}`, { shadow: where === "inside" });
}
/** Turn the moving bits (in a room's tick). */
export function animate(obj, t, dt) {
    if (!obj) return;
    for (const c of obj.children) {
        if (c.userData.spin) {
            c.rotation.y += dt * 0.9;
            // (rotate about the ball, not the room's origin)
            const cx = c.userData.cx || 0, cz = c.userData.cz || 0, a = c.rotation.y;
            c.position.set(cx - (cx * Math.cos(a) + cz * Math.sin(a)), 0, cz - (-cx * Math.sin(a) + cz * Math.cos(a)));
        }
        if (c.userData.bob) c.position.y = Math.sin(t * 0.7) * 0.06;
    }
}
