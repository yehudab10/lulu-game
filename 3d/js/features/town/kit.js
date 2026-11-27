// features/town — the KIT: how a whole town stays cheap.
//
//   Merge   every static piece (buildings, parked minivans, lamps, trees, stop signs…)
//           is baked into per-area clusters of vertex-coloured geometry: one mesh per
//           cluster per look (solid · no-shadow · glass · lit windows · lamp bulbs · and the
//           far looks for a city's skyline: no shadow, seen from much further away), so a
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
    if (/^(LampGlow|Neon)/.test(n) || /^(Globe|CrossRed|AmbLight|EmergencyRed)$/.test(n)) return "lit";   // (the precinct lamps, the hospital crosses + ambulance bay: glow with the night, no new draw call)
    if (n === "Glass") return "glass";
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

/** A baked piece with just position + normal + colour (+ index): mergeSteps can take it. */
const plainBake = g => { const k = Object.keys(g.attributes); return k.length === 3 && g.attributes.position && g.attributes.normal && g.attributes.color && g.attributes.position.itemSize === 3
    && g.attributes.normal.itemSize === 3 && g.attributes.color.itemSize === 3 && !g.morphAttributes.position; };
/** mergeGeometries for plain bakes, as a generator: yields every ~40k vertices copied → (return) the merged geometry. */
function* mergeSteps(list) {
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let v = 0, i = 0, since = 0;
    for (const g of list) {
        const n = g.attributes.position.count;
        P.set(g.attributes.position.array.subarray(0, n * 3), v * 3);
        N.set(g.attributes.normal.array.subarray(0, n * 3), v * 3);
        C.set(g.attributes.color.array.subarray(0, n * 3), v * 3);
        if (g.index) { const src = g.index.array, m = g.index.count; for (let k = 0; k < m; k++) I[i + k] = src[k] + v; i += m; }
        else { for (let k = 0; k < n; k++) I[i + k] = v + k; i += n; }
        v += n; since += n;
        if (since > 40000) { since = 0; yield; }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    return out;
}

/** Collects static pieces into clusters, then bakes them into a few meshes each. */
export class Merger {
    /** cell: cluster size (m). Small cells let the town cull by distance and by its blocks (index.js), and keep
     *  the shadow pass around her to a few clusters. */
    constructor(cell = 60) { this.cell = cell; this.clusters = new Map(); this.tris = 0; }
    list(x, z, look) {
        const c = this.cell, i = Math.floor(x / c), j = Math.floor(z / c);
        const k = look + ":" + i + "," + j;
        let l = this.clusters.get(k);
        if (!l) { l = []; l.look = look; l.cell = { x0: i * c, z0: j * c, x1: (i + 1) * c, z1: (j + 1) * c }; this.clusters.set(k, l); }
        return l;
    }
    /**
     * Add a template at world matrix `m`. tints: { MatName: "#hex" | THREE.Color }.
     * opts: { dark: windows stay dark at night, skip: RegExp of node names to leave out, at: [x, z] cluster position,
     *         noShadow: casts no shadow (parked cars, the woods: their many triangles stay out of the shadow pass),
     *         tag: an object — build() fills tag.parts with [{ mesh, start, count }] (its vertex ranges, so one piece can be hidden later) }
     */
    add(template, m, tints = null, opts = {}) {
        const parts = partsOf(template);
        const e = m.elements, bx = opts.at ? opts.at[0] : e[12], bz = opts.at ? opts.at[1] : e[14];
        for (const p of parts) {
            if (opts.skip && opts.skip.test(p.node)) continue;
            let look = lookOf(p.mat);
            if (look === "glow" && opts.dark) look = "solid";
            if (look === "solid" && opts.noShadow) look = "flat";
            const t = tints && tints[p.name];
            if (t) _c.set(t); else _c.copy(p.mat.color);
            _m.multiplyMatrices(m, p.local);
            const bg = bakeGeometry(p.g, _m, _c);
            if (opts.tag) bg.userData.tag = opts.tag;
            this.list(bx, bz, look).push(bg);
            this.tris += (p.g.index ? p.g.index.count : p.g.attributes.position.count) / 3;
        }
    }
    /** Add raw geometry (already in world space, with a colour attribute) to a look. */
    addGeometry(g, look, x, z) { this.list(x, z, look).push(g); this.tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
    /** Bake: → [THREE.Mesh] (one per cluster per look), using the shared look materials. */
    build(mats) {
        const out = [], g = this.buildSteps(mats, out);
        while (!g.next().done);
        return out;
    }
    /** build() a cluster at a time (a generator: yields after each merged mesh, pushes them onto `out`). */
    *buildSteps(mats, out) {
        for (const list of this.clusters.values()) {
            {
                const look = list.look;
                if (!list.length) continue;
                const tagged = [];
                let at = 0;
                for (const x of list) { const n = x.attributes.position.count; if (x.userData.tag) tagged.push({ tag: x.userData.tag, start: at, count: n }); at += n; }
                // (a big cluster — a row of woods, a kerb of parked cars — is merged a slice at a time: index.js builds a
                //  town over many frames, and one mergeGeometries of 100k+ vertices is a frame on its own)
                let g = null;
                if (list.every(plainBake)) { const it = mergeSteps(list); for (;;) { const r = it.next(); if (r.done) { g = r.value; break; } yield "merge:" + look + "…"; } }
                else g = mergeGeometries(list, false);
                for (const x of list) x.dispose();
                if (!g) continue;
                g.computeBoundingSphere();
                const mesh = new THREE.Mesh(g, mats[look === "flat" || look === "far" ? "solid" : look === "farglow" ? "glow" : look]);
                mesh.castShadow = look === "solid";
                mesh.receiveShadow = look !== "lit" && look !== "far" && look !== "farglow";
                mesh.matrixAutoUpdate = false;
                mesh.userData.townLook = look;
                mesh.userData.cell = list.cell;      // (for the town's distance + block-occlusion culling)
                if (look === "glass") mesh.renderOrder = 2;
                for (const t of tagged) (t.tag.parts || (t.tag.parts = [])).push({ mesh, start: t.start, count: t.count });
                out.push(mesh);
                yield "merge:" + look;
            }
        }
        this.clusters.clear();
    }
}

/** Hide (or show again) one tagged piece of a merged mesh: its vertices collapse onto its first one (no draw-call change). */
export function hideTagged(tag, hide = true) {
    for (const p of tag.parts || []) {
        const pos = p.mesh.geometry.attributes.position;
        if (hide && !p.saved) p.saved = pos.array.slice(p.start * 3, (p.start + p.count) * 3);
        if (!hide && !p.saved) continue;
        if (hide) { const x = pos.array[p.start * 3], y = pos.array[p.start * 3 + 1], z = pos.array[p.start * 3 + 2]; for (let i = p.start; i < p.start + p.count; i++) pos.setXYZ(i, x, y, z); }
        else { pos.array.set(p.saved, p.start * 3); p.saved = null; }
        pos.needsUpdate = true;
    }
}

/** The shared materials of the merged looks (one set per town build). */
export function lookMaterials() {
    return {
        solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }),
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
        this.cells = [];     // every distinct sign (drawn at mesh() time, packed tallest-first)
        this.quads = [];     // {cell, pos: [12], n: [3]}
        this.cache = new Map();
    }
    /**
     * A sign cell (cached by key; drawn later, when everything is packed). spec: { lines: [..], bg, fg,
     * w, h (px), border, radius, sizes: [px per line], key, draw(g, w, h) custom }
     */
    sign(spec) {
        const key = spec.key || JSON.stringify([spec.lines, spec.bg, spec.fg, spec.w, spec.h, spec.border, spec.sizes, spec.sub]);
        if (this.cache.has(key)) return this.cache.get(key);
        const cell = { spec, w: spec.w || 512, h: spec.h || 256 };
        this.cells.push(cell);
        this.cache.set(key, cell);
        return cell;
    }
    /** A quad of w × h metres showing `cell`, centred at (cx, cy, cz), facing yaw (its front = +Z). */
    quad(cell, cx, cy, cz, yaw, w, h, tilt = 0) {
        const hw = w / 2, hh = h / 2;
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tilt, yaw, 0, "YXZ")).setPosition(cx, cy, cz);
        const pos = [];
        for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) { _v.set(x, y, 0).applyMatrix4(m); pos.push(_v.x, _v.y, _v.z); }
        const nrm = _v.set(0, 0, 1).applyMatrix3(_n.setFromMatrix4(m)).normalize();
        this.quads.push({ cell, pos, n: [nrm.x, nrm.y, nrm.z] });
    }
    /** Shelf-pack every cell (tallest first) at `scale`; false if they don't fit. */
    pack(scale) {
        const pad = 4, S = this.size;
        let x = 0, y = 0, row = 0;
        for (const c of [...this.cells].sort((a, b) => b.h - a.h)) {
            const w = Math.ceil(c.w * scale), h = Math.ceil(c.h * scale);
            if (x + w > S) { x = 0; y += row + pad; row = 0; }
            if (y + h > S) return false;
            Object.assign(c, { x, y, pw: w, ph: h });
            x += w + pad; row = Math.max(row, h);
        }
        return true;
    }
    /** Draw every cell into one canvas (shrunk to fit if need be), and all the sign faces as ONE mesh. */
    mesh() {
        const g = this.meshSteps();
        for (;;) { const r = g.next(); if (r.done) return r.value; }
    }
    /** mesh() a few signs at a time (a generator: drawing a town's every sign is a frame's work on its own) → (return) the mesh. */
    *meshSteps() {
        let scale = 1;
        // (the largest scale that packs — a bisection: a town just over a fixed step keeps most of its sharpness)
        if (!this.pack(1)) {
            let lo = 0.3, hi = 1;
            for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (this.pack(m)) lo = m; else hi = m; }
            scale = lo;
            this.pack(scale);
        }
        this.scale = scale;          // (1 = every sign at full size; < 1 = the town's signs were shrunk to fit — tests read it)
        const S = this.size, canvas = document.createElement("canvas");
        canvas.width = canvas.height = S;
        const g = canvas.getContext("2d");
        let k = 0;
        for (const c of this.cells) {
            if (++k % 6 === 0) yield "atlas";
            const spec = c.spec, w = c.w, h = c.h;
            g.save();
            g.translate(c.x, c.y); g.scale(c.pw / w, c.ph / h);
            g.beginPath(); g.rect(0, 0, w, h); g.clip();
            if (spec.draw) spec.draw(g, w, h);
            else {
                const r = spec.radius != null ? spec.radius : Math.min(w, h) * 0.08;
                if (spec.bg) { g.fillStyle = spec.bg; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, r); g.fill(); }
                if (spec.border) { g.strokeStyle = spec.border; g.lineWidth = Math.max(3, h * 0.035); g.beginPath(); g.roundRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, r * 0.7); g.stroke(); }
                drawLines(g, spec.lines || [], w, h, spec.fg || "#fff", spec.sizes, spec.sub);
            }
            g.restore();
            c.uv = [c.x / S, 1 - (c.y + c.ph) / S, (c.x + c.pw) / S, 1 - c.y / S];
        }
        this.scale = scale;
        const n = this.quads.length;
        const P = new Float32Array(n * 12), U = new Float32Array(n * 8), N = new Float32Array(n * 12), I = [];
        this.quads.forEach((q, k) => {
            const [u0, v0, u1, v1] = q.cell.uv;
            P.set(q.pos, k * 12); U.set([u0, v0, u1, v0, u1, v1, u0, v1], k * 8);
            for (let i = 0; i < 4; i++) N.set(q.n, k * 12 + i * 3);
            I.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(U, 2));
        geo.setIndex(I);
        geo.computeBoundingSphere();
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, alphaTest: 0.4, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.12 });
        const mesh = new THREE.Mesh(geo, mat);
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
