// features/town — the KIT: how a whole town stays cheap.
//
//   Merge   every static piece (buildings, parked minivans, lamps, trees, stop signs…)
//           is baked into per-area clusters of vertex-coloured geometry: one mesh per
//           cluster per look (solid · shiny · glass · lit windows · lamp bulbs), so a
//           block of houses + cars + lamps is 2–4 draw calls, frustum- and shadow-
//           culled as a unit. Tints (Walls / Roof / Paint…) go into the vertex colours.
//   Atlas   every bit of text in town (shop signs, banners, street blades, STOP…) is a
//           cell in ONE canvas texture, and all the sign faces are ONE mesh.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();

/** Each mesh of a template with its transform relative to the template's root (cached on the template). */
export function partsOf(template) {
    if (template.userData.townParts) return template.userData.townParts;
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert();
    const parts = [];
    template.traverse(o => {
        if (!o.isMesh) return;
        const g = o.geometry;
        parts.push({ g, mat: o.material, local: inv.clone().multiply(o.matrixWorld), name: o.material.name || "", node: o.name || "" });
    });
    template.userData.townParts = parts;
    return parts;
}

/** Which merged look a material goes to. */
export function lookOf(mat) {
    const n = mat.name || "";
    if (/^(Window|ShopWindow)$/.test(n)) return "glow";
    if (/^(LampGlow|Neon)/.test(n)) return "lit";
    if (n === "Glass") return "glass";
    if ((mat.metalness || 0) > 0.3 || (mat.roughness != null && mat.roughness < 0.3)) return "shiny";
    return "solid";
}

/** A copy of geometry g (position + normal + colour only), transformed by matrix m, one colour. */
function bakeGeometry(g, m, color) {
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
    _n.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(m);
        P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z;
        if (nor) { _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); N[i * 3] = _v.x; N[i * 3 + 1] = _v.y; N[i * 3 + 2] = _v.z; }
        C[i * 3] = color.r; C[i * 3 + 1] = color.g; C[i * 3 + 2] = color.b;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    if (g.index) out.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
    else { const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; out.setIndex(new THREE.BufferAttribute(idx, 1)); }
    return out;
}

/** Collects static pieces into clusters, then bakes them into a few meshes each. */
export class Merger {
    constructor(cell = 80) { this.cell = cell; this.clusters = new Map(); this.tris = 0; }
    bucket(x, z) {
        const k = Math.floor(x / this.cell) + "," + Math.floor(z / this.cell);
        let b = this.clusters.get(k);
        if (!b) { b = { solid: [], shiny: [], glass: [], glow: [], lit: [] }; this.clusters.set(k, b); }
        return b;
    }
    /**
     * Add a template at world matrix `m`. tints: { MatName: "#hex" | THREE.Color }.
     * opts: { dark: windows stay dark at night, skip: RegExp of node names to leave out, at: [x, z] cluster position }
     */
    add(template, m, tints = null, opts = {}) {
        const parts = partsOf(template);
        const e = m.elements;
        const b = this.bucket(opts.at ? opts.at[0] : e[12], opts.at ? opts.at[1] : e[14]);
        for (const p of parts) {
            if (opts.skip && opts.skip.test(p.node)) continue;
            let look = lookOf(p.mat);
            if (look === "glow" && opts.dark) look = "solid";
            const t = tints && tints[p.name];
            if (t) _c.set(t); else _c.copy(p.mat.color);
            _m.multiplyMatrices(m, p.local);
            b[look].push(bakeGeometry(p.g, _m, _c));
            this.tris += (p.g.index ? p.g.index.count : p.g.attributes.position.count) / 3;
        }
    }
    /** Add raw geometry (already in world space, with a colour attribute) to a look. */
    addGeometry(g, look, x, z) { this.bucket(x, z)[look].push(g); this.tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    /** Bake: → [THREE.Mesh] (one per cluster per look), using the shared look materials. */
    build(mats) {
        const out = [];
        for (const b of this.clusters.values()) {
            for (const look of Object.keys(b)) {
                const list = b[look];
                if (!list.length) continue;
                const g = mergeGeometries(list, false);
                for (const x of list) x.dispose();
                if (!g) continue;
                g.computeBoundingSphere();
                const mesh = new THREE.Mesh(g, mats[look]);
                mesh.castShadow = look === "solid" || look === "shiny";
                mesh.receiveShadow = look !== "lit";
                mesh.matrixAutoUpdate = false;
                mesh.userData.townLook = look;
                if (look === "glass") mesh.renderOrder = 2;
                out.push(mesh);
            }
        }
        this.clusters.clear();
        return out;
    }
}

/** The shared materials of the merged looks (one set per town build). */
export function lookMaterials() {
    return {
        solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }),
        shiny: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.45 }),
        glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }),
        glow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, emissive: new THREE.Color("#ffc46b"), emissiveIntensity: 0 }),
        lit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new THREE.Color("#ffe2a8"), emissiveIntensity: 0.15 }),
    };
}

// ── the sign atlas ───────────────────────────────────────────────────────
const FONT = `Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
export class Atlas {
    constructor(size = 2048) {
        this.size = size;
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.canvas.height = size;
        this.g = this.canvas.getContext("2d");
        this.x = 0; this.y = 0; this.row = 0;
        this.quads = [];   // {pos: [12], uv: [8]}
        this.cache = new Map();
    }
    /** Reserve a w × h px cell → {x, y, w, h} (shelf packing). */
    cell(w, h) {
        const pad = 4;
        if (this.x + w + pad > this.size) { this.x = 0; this.y += this.row + pad; this.row = 0; }
        if (this.y + h > this.size) { console.warn("[town] sign atlas full"); return { x: 0, y: 0, w, h }; }
        const c = { x: this.x, y: this.y, w, h };
        this.x += w + pad; this.row = Math.max(this.row, h);
        return c;
    }
    /**
     * Draw a sign into a new cell (cached by key). spec: { lines: [..], bg, fg, w, h (px), border, radius,
     * sizes: [px per line], font weights, transparent: true (no background) , draw(g, cell) custom }
     */
    sign(spec) {
        const key = spec.key || JSON.stringify([spec.lines, spec.bg, spec.fg, spec.w, spec.h, spec.border, spec.sizes, spec.sub]);
        if (this.cache.has(key)) return this.cache.get(key);
        const w = spec.w || 512, h = spec.h || 256, c = this.cell(w, h), g = this.g;
        g.save();
        g.translate(c.x, c.y);
        g.beginPath(); g.rect(0, 0, w, h); g.clip();
        if (spec.draw) spec.draw(g, w, h);
        else {
            const r = spec.radius != null ? spec.radius : Math.min(w, h) * 0.08;
            if (spec.bg) { g.fillStyle = spec.bg; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, r); g.fill(); }
            if (spec.border) { g.strokeStyle = spec.border; g.lineWidth = Math.max(3, h * 0.035); g.beginPath(); g.roundRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, r * 0.7); g.stroke(); }
            drawLines(g, spec.lines || [], w, h, spec.fg || "#fff", spec.sizes, spec.sub);
        }
        g.restore();
        const uv = { u0: c.x / this.size, v0: 1 - (c.y + h) / this.size, u1: (c.x + w) / this.size, v1: 1 - c.y / this.size };
        this.cache.set(key, uv);
        return uv;
    }
    /** A quad of width w × height h (m), centred at `center`, facing `normalYaw` (rotation.y; the quad's front = +Z), lifted `y`. */
    quad(uv, cx, cy, cz, yaw, w, h, tilt = 0) {
        const hw = w / 2, hh = h / 2;
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt, yaw, 0, "YXZ")).setPosition(cx, cy, cz);
        const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
        const pos = [];
        for (const [x, y] of corners) { _v.set(x, y, 0).applyMatrix4(m); pos.push(_v.x, _v.y, _v.z); }
        const nrm = _v.set(0, 0, 1).applyMatrix3(_n.setFromMatrix4(m)).normalize();
        this.quads.push({ pos, uv: [uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1], n: [nrm.x, nrm.y, nrm.z] });
    }
    /** All the sign faces as one mesh. */
    mesh() {
        const n = this.quads.length;
        const P = new Float32Array(n * 12), U = new Float32Array(n * 8), N = new Float32Array(n * 12), I = [];
        this.quads.forEach((q, k) => {
            P.set(q.pos, k * 12); U.set(q.uv, k * 8);
            for (let i = 0; i < 4; i++) N.set(q.n, k * 12 + i * 3);
            I.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(P, 3));
        g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
        g.setAttribute("uv", new THREE.BufferAttribute(U, 2));
        g.setIndex(I);
        g.computeBoundingSphere();
        const tex = new THREE.CanvasTexture(this.canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, alphaTest: 0.4, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.12 });
        const mesh = new THREE.Mesh(g, mat);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        return mesh;
    }
}

/** Centered lines of text, each fitted to the width; the first line biggest. */
export function drawLines(g, lines, w, h, fg, sizes, sub) {
    const n = lines.length;
    if (!n) return;
    const sz = sizes || lines.map((_, i) => (i === 0 ? 1 : 0.72) * h * (n === 1 ? 0.5 : n === 2 ? 0.34 : 0.26));
    const total = sz.reduce((a, b) => a + b * 1.12, 0);
    let y = (h - total) / 2;
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((line, i) => {
        y += sz[i] * 0.56;
        g.font = `${i === 0 ? 700 : 600} ${Math.round(sz[i])}px ${FONT}`;
        g.fillStyle = Array.isArray(fg) ? fg[i] || fg[0] : fg;
        g.fillText(line, w / 2, y, w * 0.9);
        y += sz[i] * 0.56;
    });
}
