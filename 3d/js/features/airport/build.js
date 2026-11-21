// features/airport — DRAWING the airport: its own group in the driving scene, built a small step at a time (a
// generator: index.js gives it ~3 ms a frame from 2.6 km out), dropped once she's 3.2 km away. Nothing here lives in
// the highway's chunks (they come and go 160 m behind her: a 400 m-deep airport would lose its back half as she drove
// round the kerb) — except its COLLIDERS, which ride in the chunks (index.js) so the car's and foot's collision loops find
// them like any roadside prop.
//
// Per build ~25–35 draw calls: one mesh per surface (ramps, the loop, the lot, the walks, gores, paint, apron, taxiway,
// runway), the fence's chain-link (one alpha-tested mesh), every static model merged by the town's kit (terminal, tower,
// jet bridges, the parked planes in their liveries, lamps, trees, the lot's cars, the booth, the gantry, guardrails —
// vertex-coloured, a few looks per 160 m cluster), every face of text one mesh from one atlas.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx } from "../../core/ctx.js";
import { models, registerModels, findNodes } from "../../models.js";
import { canvasTex } from "../../world.js";
import { Merger, Atlas, lookMaterials, drawLines } from "../town/kit.js";
import * as LY from "./layout.js";
import { SIGNS, BOARDS, LIVERIES, EXIT_NO } from "./lines.js";

const OWN = ["airport_facade", "airport_tower", "airport_jetbridge", "airport_plane", "airport_booth", "airport_windsock"];
registerModels(Object.fromEntries(["airport_facade", "airport_tower", "airport_jetbridge", "airport_plane", "airport_taxi", "airport_shuttle",
    "airport_booth", "airport_segway", "airport_guard", "airport_windsock", "airport_suitcase"].map(k => [k, k])));
/** Every model the static build needs (the exits' / town's are registered by those features; treeRound is core). */
export const BUILD_MODELS = [...OWN, "exits_lamp", "exits_gantry", "exits_cushion", "exits_railend", "exits_advisory", "exits_guide", "town_minivan_lod", "town_mw_sedan_lod", "treeRound"];

// ── materials (made once, shared by every build) ─────────────────────────
let M = null;
const off = f => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
function mats() {
    if (M) return M;
    const speck = (g, w, h, n, cols = ["#676b73", "#53575e", "#70747c"]) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); } };
    const asph = (g, w, h) => { g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h); speck(g, w, h, w * h / 20); };
    const T = {
        ramp: canvasTex(128, 256, (g, w, h) => { asph(g, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(5, 0, 5, h); g.fillRect(w - 10, 0, 5, h); }),
        // three one-way lanes: white edges, dashed lane lines (the kerb lane is the right third)
        kerb: canvasTex(192, 256, (g, w, h) => { asph(g, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(4, 0, 4, h); g.fillRect(w - 8, 0, 4, h); for (const x of [w / 3, 2 * w / 3]) g.fillRect(x - 2, 0, 4, h * 0.42); }),
        aisle: canvasTex(128, 256, (g, w, h) => { asph(g, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(4, 0, 4, h); g.fillRect(w - 8, 0, 4, h); g.fillStyle = "#F2C230"; g.fillRect(w / 2 - 2, 0, 4, h * 0.5); }),
        lot: canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#5a5e66"; g.fillRect(0, 0, w, h); speck(g, w, h, 4000); g.fillStyle = "rgba(30,30,34,.18)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 18, 0, 7); g.fill(); } }),
        gore: canvasTex(64, 128, (g, w, h) => { asph(g, w, h); g.strokeStyle = "#f4f4f0"; g.lineWidth = 7; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w / 2, h * 0.25); g.lineTo(w, h * 0.75); g.stroke(); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); }),
        stall: canvasTex(32, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, 3); }),
        dash: canvasTex(8, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h / 3); }),
        walk: canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#cfcac0"; g.fillRect(0, 0, w, h); speck(g, w, h, 900, ["#c3beb4", "#d8d3ca"]); g.fillStyle = "#b9b4aa"; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); }),
        apron: canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#b8b8b2"; g.fillRect(0, 0, w, h); speck(g, w, h, 900, ["#aeaea8", "#c2c2bc"]); g.fillStyle = "#9e9e98"; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); }),
        taxi: canvasTex(128, 256, (g, w, h) => { asph(g, w, h); g.fillStyle = "#F2C230"; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h); }),
        runway: canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#484b50"; g.fillRect(0, 0, w, h); speck(g, w, h, 4000, ["#3f4247", "#55585d"]); g.fillStyle = "#f4f4f0"; g.fillRect(w / 2 - 4, 0, 8, h * 0.5); g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h); }),
        fence: canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = "#B9C2C8"; g.lineWidth = 2.4; for (let k = -w; k < w * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); } }),
    };
    const std = (map, rough, f, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ map, roughness: rough }, off(f), extra));
    M = {
        ramp: std(T.ramp, 0.92, -3), kerb: std(T.kerb, 0.92, -3), aisle: std(T.aisle, 0.92, -3), lot: std(T.lot, 0.95, -2),
        gore: std(T.gore, 0.8, -4), stall: std(T.stall, 0.7, -5, { transparent: true, alphaTest: 0.5 }), dash: std(T.dash, 0.7, -5, { transparent: true, alphaTest: 0.5 }),
        walk: std(T.walk, 0.95, -2), apron: std(T.apron, 0.9, -1), taxi: std(T.taxi, 0.9, -2), runway: std(T.runway, 0.9, -2),
        fence: new THREE.MeshStandardMaterial({ map: T.fence, roughness: 0.6, metalness: 0.4, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
        look: lookMaterials(),
    };
    return M;
}
/** The merged looks' materials (index.js lights the windows / lamps at night). */
export function lookMats() { return mats().look; }

// ── geometry helpers (world space) ───────────────────────────────────────
const _p = {}, _v = new THREE.Vector3(), _m = new THREE.Matrix4();
function geo(pos, uv, idx) {
    // (make the first triangle face up; flip all if not)
    if (idx.length >= 3) {
        const a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3;
        const ux = pos[b] - pos[a], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vz = pos[c + 2] - pos[a + 2];
        if (uz * vx - ux * vz < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
}
/** A ribbon along a world polyline [{x, z, tx, tz, w, v}] (right of travel = (−tz, tx)); w0/w1 override the edges. */
function ribbon(pts, y, vScale, w0 = null, w1 = null) {
    const pos = [], uv = [], idx = [];
    pts.forEach((p, k) => {
        const a = w0 != null ? w0 : -p.w, b = w1 != null ? w1 : p.w;
        pos.push(p.x - p.tz * a, y, p.z + p.tx * a, p.x - p.tz * b, y, p.z + p.tx * b);
        uv.push(0, p.v / vScale, 1, p.v / vScale);
        if (k < pts.length - 1) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    });
    return geo(pos, uv, idx);
}
/** A strip in highway coords between d0(u) and d1(u), u ∈ [a, b] (relative to E). */
function hwStrip(E, a, b, d0, d1, y, vScale = 12) {
    const road = ctx.world.highway, n = Math.max(2, Math.round((b - a) / 2) + 1), pos = [], uv = [], idx = [];
    for (let k = 0; k < n; k++) {
        const u = a + (b - a) * k / (n - 1);
        road.point(E + u, d0(u), _p); pos.push(_p.x, y, _p.z);
        road.point(E + u, d1(u), _p); pos.push(_p.x, y, _p.z);
        uv.push(0, (E + u) / vScale, 1, (E + u) / vScale);
        if (k < n - 1) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    return geo(pos, uv, idx);
}
/** A rectangle in the airport frame (uv in metres / scale). */
function rect(F, f0, f1, r0, r1, y, us, vs) {
    const pos = [], uv = [];
    for (const [f, r] of [[f0, r0], [f1, r0], [f0, r1], [f1, r1]]) { F.world(f, r, _p); pos.push(_p.x, y, _p.z); uv.push(f / us, r / vs); }
    return geo(pos, uv, [0, 1, 2, 1, 3, 2]);
}
function merged(list) { if (!list.length) return null; const g = list.length > 1 ? mergeGeometries(list, false) : list[0]; if (list.length > 1) for (const x of list) x.dispose(); g.computeBoundingSphere(); return g; }

// ── procedural pieces (vertex-coloured, into the Merger's "flat" look) ───
const RAIL = new THREE.Color("#AAB4BC"), POSTC = new THREE.Color("#7E8A93"), FENCEC = new THREE.Color("#8E979E");
function vgeo(pos, nor, col, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
}
/** A box (centre x, y, z; size sx, sy, sz; yaw) appended to arrays. */
function boxInto(A, x, y, z, sx, sy, sz, yaw, c) {
    const co = Math.cos(yaw), si = Math.sin(yaw), base = A.pos.length / 3;
    const corners = [];
    for (const [a, b, e] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) {
        const lx = a * sx / 2, lz = e * sz / 2;
        corners.push([x + lx * co + lz * si, y + b * sy / 2, z - lx * si + lz * co]);
    }
    const faces = [[0, 3, 2, 1, [0, 0, -1]], [4, 5, 6, 7, [0, 0, 1]], [0, 1, 5, 4, [0, -1, 0]], [3, 7, 6, 2, [0, 1, 0]], [0, 4, 7, 3, [-1, 0, 0]], [1, 2, 6, 5, [1, 0, 0]]];
    let k = 0;
    for (const [a, b, cc, d, n] of faces) {
        const nx = n[0] * co + n[2] * si, nz = -n[0] * si + n[2] * co;
        for (const v of [a, b, cc, d]) { A.pos.push(...corners[v]); A.nor.push(nx, n[1], nz); A.col.push(c.r, c.g, c.b); }
        const i = base + k * 4; A.idx.push(i, i + 1, i + 2, i, i + 2, i + 3); k++;
    }
}
/** A W-beam guardrail along world points: one geometry. */
function railGeo(P) {
    const A = { pos: [], nor: [], col: [], idx: [] };
    for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
        boxInto(A, (a.x + b.x) / 2, 0.67, (a.z + b.z) / 2, 0.1, 0.3, L + 0.05, yaw, RAIL);
        if (i % 2 === 0) boxInto(A, a.x, 0.39, a.z, 0.14, 0.78, 0.14, yaw, POSTC);
    }
    return vgeo(A.pos, A.nor, A.col, A.idx);
}
/** The fence's posts, top rail (+ on the runway fence a cartoon barbed outrigger with three wires) → flat geometry, and
 *  the chain-link panels → [positions, uvs] for one alpha-tested mesh. */
function fenceGeo(fences) {
    const A = { pos: [], nor: [], col: [], idx: [] }, pos = [], uv = [], idx = [];
    const H = LY.FENCE_H;
    for (const fc of fences) {
        let v = 0;
        for (let i = 0; i < fc.pts.length - 1; i++) {
            const a = fc.pts[i], b = fc.pts[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
            const n = Math.max(1, Math.ceil(L / 3));
            for (let k = 0; k <= n; k++) { const t = k / n; boxInto(A, a.x + (b.x - a.x) * t, H / 2, a.z + (b.z - a.z) * t, 0.12, H, 0.12, yaw, FENCEC); }
            boxInto(A, (a.x + b.x) / 2, H - 0.05, (a.z + b.z) / 2, 0.07, 0.07, L, yaw, FENCEC);
            if (fc.runway) {
                // (a slanted arm on each post toward the airside + three wires: cartoon, not a real spec)
                const ox = -Math.cos(yaw) * 0.32, oz = Math.sin(yaw) * 0.32;
                for (const w of [0.2, 0.42, 0.64]) boxInto(A, (a.x + b.x) / 2 + ox * w / 0.64, H + w * 0.7, (a.z + b.z) / 2 + oz * w / 0.64, 0.03, 0.03, L, yaw, FENCEC);
            }
            const base = pos.length / 3;
            pos.push(a.x, 0.05, a.z, b.x, 0.05, b.z, b.x, H - 0.05, b.z, a.x, H - 0.05, a.z);
            uv.push(v / 1.2, 0, (v + L) / 1.2, 0, (v + L) / 1.2, H / 1.2, v / 1.2, H / 1.2);
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            v += L;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const nn = new Float32Array(pos.length); for (let i = 1; i < nn.length; i += 3) nn[i] = 1;
    g.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return { posts: vgeo(A.pos, A.nor, A.col, A.idx), mesh: g };
}

// ── the paint on the asphalt: one canvas (EXIT ONLY, an arrow, the kerb words), quads laid flat ──
let PAINT = null;
function paintMat() {
    if (PAINT) return PAINT;
    const words = ["EXIT", "ONLY", "DEPARTURES", "ARRIVALS", "TAXI", "SHUTTLE"];
    const tex = canvasTex(512, 512, (g, w, h) => {
        g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.textAlign = "center"; g.textBaseline = "middle";
        words.forEach((t, i) => { g.font = `800 ${t.length > 6 ? 52 : 70}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`; g.fillText(t, w / 2, 40 + i * 80, w - 16); });
    }, false);
    PAINT = { mat: new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.7, transparent: true, alphaTest: 0.5 }, off(-6))), rows: words };
    return PAINT;
}
/** A flat word on the ground: centre (x, z), reading toward yaw (the driver sees it upright), w × h metres. */
function paintQuad(list, word, x, z, yaw, w, h) {
    const P = paintMat(), i = P.rows.indexOf(word), v0 = 1 - (i * 80 + 80) / 512, v1 = 1 - (i * 80) / 512;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
    const pos = [], uv = [];
    // (bottom of the word nearest the driver: −forward)
    for (const [a, b, uu, vv] of [[-w / 2, -h / 2, 0, v0], [w / 2, -h / 2, 1, v0], [-w / 2, h / 2, 0, v1], [w / 2, h / 2, 1, v1]]) {
        pos.push(x + rx * a + fx * b, 0.05, z + rz * a + fz * b); uv.push(uu, vv);
    }
    list.push(geo(pos, uv, [0, 1, 2, 1, 3, 2]));
}

// ── the atlas cells (per build) ──────────────────────────────────────────
function cellsOf(a) {
    const sign = (key, lines, bg, fg = "#fff", w = 768, h = 320, border = fg) => a.sign({ key, lines, bg, fg, w, h, border });
    const C = {
        ramp: sign("ramp", SIGNS.ramp, "#1f7a46"), gore: sign("gore", SIGNS.gore, "#1f7a46", "#fff", 384, 224), back: sign("back", SIGNS.back, "#1f7a46"),
        gantry: sign("gantry", SIGNS.gantry, "#1f7a46", "#fff", 512, 360), thru: sign("thru", SIGNS.thru, "#1f7a46", "#fff", 640, 300),
        welcome: sign("welcome", BOARDS.welcome, "#F6EEDC", ["#16324F", "#6D4C41"], 768, 256, "#16324F"),
        term: sign("term", BOARDS.term, "#16324F", "#FFFFFF", 1024, 96),
        dep: sign("dep", BOARDS.dep, "#1E5AA8", "#FFFFFF", 1024, 112), arr: sign("arr", BOARDS.arr, "#1E5AA8", "#FFFFFF", 1024, 112),
        soon: sign("soon", BOARDS.soon, "#FFF8E1", ["#C62828", "#37474F"], 512, 256, "#C62828"),
        guide: sign("guide", BOARDS.guide, "#1f7a46", "#fff", 768, 336), parking: sign("parking", BOARDS.parking, "#1565C0", "#fff", 512, 240),
        taxi: sign("taxi", BOARDS.taxi, "#FFC107", "#1B1B1B", 512, 224), shuttle: sign("shuttle", BOARDS.shuttle, "#1E5AA8", "#fff", 512, 224),
        noStop: sign("noStop", BOARDS.noStop, "#FAFAFA", "#C62828", 384, 240), runway: sign("runway", BOARDS.runway, "#FFD600", "#1B1B1B", 512, 224),
        cell: sign("cell", BOARDS.cell, "#1565C0", "#fff", 512, 240), exitBack: sign("exitBack", BOARDS.exitBack, "#1f7a46", "#fff", 640, 280),
        tower: sign("tower", BOARDS.tower, "#16324F", "#fff", 384, 160),
        advisory: a.sign({ key: "advisory", w: 256, h: 320, draw: (g, w, h) => {
            g.clearRect(0, 0, w, h); g.fillStyle = "#FFD600"; g.fillRect(8, 8, w - 16, h - 16); g.strokeStyle = "#111"; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
            g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
            g.font = `800 ${Math.round(h * 0.2)}px Fredoka, Arial, sans-serif`; g.fillText("RAMP", w / 2, h * 0.3, w * 0.84);
            g.font = `800 ${Math.round(h * 0.3)}px Fredoka, Arial, sans-serif`; g.fillText("30", w / 2, h * 0.58, w * 0.84);
            g.font = `800 ${Math.round(h * 0.13)}px Fredoka, Arial, sans-serif`; g.fillText("MPH", w / 2, h * 0.82, w * 0.84);
        } }),
        tab: sign("tab", [`EXIT ${EXIT_NO}`], "#1f7a46", "#fff", 256, 96),
    };
    C.liveries = LIVERIES.map((L, i) => a.sign({ key: "liv" + i, w: 512, h: 96, draw: (g, w, h) => {
        g.clearRect(0, 0, w, h); g.fillStyle = L.Tail; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `800 ${Math.round(h * 0.7)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`; g.fillText(L.name, w / 2, h / 2, w - 12);
    } }));
    C.logos = LIVERIES.map((L, i) => a.sign({ key: "logo" + i, w: 160, h: 160, draw: (g, w, h) => {
        g.clearRect(0, 0, w, h); g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, 7); g.fill();
        g.fillStyle = L.Tail; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${Math.round(h * 0.5)}px Fredoka, Arial, sans-serif`;
        g.fillText(["🥘", "😩", "🥯", "🤷"][i] || "✈", w / 2, h * 0.54);
    } }));
    return C;
}

// ── the build (a generator: one small step per yield) ────────────────────
/**
 * Build airport G (plan.js geometry) into `group`. Yields after every step (~1–3 ms each); returns { atlasMat }.
 * `out` collects what index.js needs to dispose (geometries) and to animate (lit looks).
 */
export function* buildSteps(G, group, out) {
    const MT = mats(), F = G.F, E = G.E;
    const add = (g, mat, { shadow = false, order = 0 } = {}) => {
        if (!g) return null;
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true; m.castShadow = shadow; m.renderOrder = order;
        m.matrixAutoUpdate = false; m.updateMatrix();
        group.add(m); out.geos.push(g);
        return m;
    };
    // ① the interchange's highway-side asphalt (highway coords)
    const ramp = [], gore = [], dash = [], paint = [];
    ramp.push(hwStrip(E, LY.TAPER0, LY.RAMP0 + 2, () => 6.9, u => LY.taperEdge(u), 0.033));
    ramp.push(hwStrip(E, LY.RAMP0, LY.OFF1 + 0.6, u => LY.offD(u) - LY.HALF, u => LY.offD(u) + LY.HALF, 0.034));
    ramp.push(hwStrip(E, LY.ON0 - 0.6, LY.ON1 + 2, u => LY.onD(u) - LY.HALF, u => LY.onD(u) + LY.HALF, 0.034));
    ramp.push(hwStrip(E, LY.ON1 - 2, LY.ACC1, () => 6.9, u => LY.accelEdge(u), 0.033));
    gore.push(hwStrip(E, LY.RAMP0 + 8, LY.RAMP0 + 72, () => 7.0, u => Math.max(7.05, LY.offD(u) - LY.HALF), 0.036, 5));
    gore.push(hwStrip(E, LY.ON1 - 62, LY.ON1 - 6, () => 7.0, u => Math.max(7.05, LY.onD(u) - LY.HALF), 0.036, 5));
    dash.push(hwStrip(E, LY.TAPER0 + 30, LY.RAMP0 + 8, () => 6.84, () => 7.16, 0.037, 6));
    dash.push(hwStrip(E, LY.ON1 - 6, LY.ACC1 - 30, () => 6.84, () => 7.16, 0.037, 6));
    // EXIT ONLY in the decel lane (the words read toward her as she drives up)
    for (const u of [-150, -96]) {
        const p = ctx.world.highway.point(E + u, 9.1, {});
        paintQuad(paint, "ONLY", p.x + Math.sin(p.h) * 2.6, p.z + Math.cos(p.h) * 2.6, p.h, 3.0, 2.0);
        paintQuad(paint, "EXIT", p.x, p.z, p.h, 3.0, 2.0);
    }
    yield "ramps";
    // ② the airport's roads (world polylines)
    for (const rd of G.roads) {
        const mat = rd.tex === "kerb" ? MT.kerb : rd.tex === "aisle" ? MT.aisle : MT.ramp;
        add(ribbon(rd.pts, rd.tex === "aisle" ? 0.036 : 0.035, 12), mat);
        yield "road:" + rd.id;
    }
    add(merged(ramp), MT.ramp); add(merged(gore), MT.gore); add(merged(dash), MT.dash);
    // the kerb words on the kerb lane (read heading +f)
    const kerbYaw = F.yaw(1, 0);
    for (const [word, f] of [["DEPARTURES", -86], ["DEPARTURES", -30], ["ARRIVALS", 30], ["TAXI", LY.STOPS.taxiHead - 8], ["SHUTTLE", LY.STOPS.shuttle + 6]]) {
        F.world(f, LY.KERB_LANE, _p); paintQuad(paint, word, _p.x, _p.z, kerbYaw, word.length > 6 ? 3.0 : 2.6, word.length > 6 ? 7.0 : 3.2);
    }
    add(merged(paint), paintMat().mat);
    yield "paint";
    // ③ the lot, its stall lines, the sidewalks, the apron, the taxiway, the runway (+ its ends)
    const L = LY.LOT;
    add(rect(F, L.f0, L.f1, L.r0 - 0.2, L.r1, 0.03, 9, 9), MT.lot);
    const stalls = LY.STALLS.map(row => {
        const pts = [], step = 2;
        for (let f = row.f0; f <= row.f1 + 0.01; f += step) { const p = F.world(f, row.r, {}); pts.push({ x: p.x, z: p.z, v: f - row.f0, w: 2.4, tx: F.fx, tz: F.fz }); }
        return ribbon(pts, 0.039, LY.STALL_W);
    });
    add(merged(stalls), MT.stall);
    const walks = [rect(F, LY.TERM.f0 - 22, LY.TERM.f1 + 22, LY.WALK.r0, LY.WALK.r1 + 0.4, 0.06, 4, 4)];
    // (the median between the lot and the kerb road, and the islands by the legs: concrete kerbs, the rest grass)
    walks.push(rect(F, L.f0, L.f1, L.r1, L.r1 + 1.2, 0.05, 4, 4));
    add(merged(walks), MT.walk);
    yield "lot";
    add(rect(F, LY.APRON.f0, LY.APRON.f1, LY.APRON.r0, LY.APRON.r1, 0.03, 6, 6), MT.apron);
    {
        const T = LY.TAXIWAY, pts = [];
        for (let f = T.f0; f <= T.f1 + 0.01; f += 4) { const p = F.world(f, T.r, {}); pts.push({ x: p.x, z: p.z, v: f, w: T.w, tx: F.fx, tz: F.fz }); }
        const tw = [ribbon(pts, 0.032, 20)];
        for (const f of [T.f0, T.f1]) {
            const p2 = [];
            for (let r = T.r; r <= LY.RUNWAY.r0 + 1; r += 4) { const p = F.world(f, r, {}); p2.push({ x: p.x, z: p.z, v: r, w: T.w, tx: F.rx, tz: F.rz }); }
            tw.push(ribbon(p2, 0.0325, 20));
        }
        add(merged(tw), MT.taxi);
    }
    {
        const R = LY.RUNWAY, pts = [];
        for (let f = R.f0; f <= R.f1 + 0.01; f += 6) { const p = F.world(f, LY.RUNWAY_R, {}); pts.push({ x: p.x, z: p.z, v: f, w: (R.r1 - R.r0) / 2, tx: F.fx, tz: F.fz }); }
        add(ribbon(pts, 0.03, 60), MT.runway);
    }
    yield "airside";
    // ④ the fence
    const fg = fenceGeo(G.fences);
    add(fg.mesh, MT.fence, { order: 1 });
    yield "fence";
    // ⑤ every static model, merged (+ the faces of text into the atlas)
    const at = new Atlas(1024), C = cellsOf(at), mg = new Merger(160);
    mg.addGeometry(fg.posts, "flat", F.ox, F.oz);
    for (const rp of G.rails) mg.addGeometry(railGeo(rp), "flat", rp[0].x, rp[0].z);
    yield "rails";
    const matAt = (x, z, yaw, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(s, s, s));
    const face = (tpl, anchor, m, cell, w, h, yaw, dy = 0, push = 0.06) => {
        tpl.updateMatrixWorld(true);
        const n = findNodes(tpl, anchor)[0];
        if (!n) return;
        const rel = tpl.matrixWorld.clone().invert().multiply(n.matrixWorld);
        _v.setFromMatrixPosition(rel).applyMatrix4(m);
        at.quad(cell, _v.x + Math.sin(yaw) * push, _v.y + dy, _v.z + Math.cos(yaw) * push, yaw, w, h);
    };
    let n = 0;
    for (const p of LY.propList()) {
        const tpl = models[p.key];
        if (!tpl) continue;
        F.world(p.f, p.r, _p);
        const yaw = F.yaw(p.face[0], p.face[1]), m = matAt(_p.x, _p.z, yaw, p.scale || 1);
        let tint = null;
        if (p.livery != null) { const L = LIVERIES[p.livery % LIVERIES.length]; tint = { Paint: L.Paint, Tail: L.Tail, Stripe: L.Stripe }; }
        mg.add(tpl, m, tint, { at: [_p.x, _p.z], noShadow: !!p.flat });
        if (p.id === "terminal") {
            // (the model's +X is our −f: lay the faces by f, at the anchors' heights)
            const q = (f, r, y, cell, w, h) => { F.world(f, r, _p); at.quad(cell, _p.x, y, _p.z, yaw, w, h); };
            q(0, LY.TERM.r0 - 0.62, 11.8, C.term, 68, 2.3);
            q(-60, LY.TERM.r0 - 0.5, 4.6, C.dep, 21.5, 2.0);
            q(60, LY.TERM.r0 - 0.5, 4.6, C.arr, 21.5, 2.0);
            for (const f of LY.DOORS) q(f, LY.TERM.r0 - 0.2, 1.7, C.soon, 3.6, 1.8);
        } else if (p.id === "tower") face(tpl, "Anchor_sign", m, C.tower, 4.0, 1.6, yaw);
        else if (/^plane/.test(p.id)) {
            const L = (p.livery % LIVERIES.length);
            face(tpl, "Anchor_name", m, C.liveries[L], 7.6, 1.4, yaw - Math.PI / 2, 0, 0.08);
            face(tpl, "Anchor_nameR", m, C.liveries[L], 7.6, 1.4, yaw + Math.PI / 2, 0, 0.08);
            face(tpl, "Anchor_tail", m, C.logos[L], 2.6, 2.6, yaw - Math.PI / 2, 0, 0.42);
            face(tpl, "Anchor_tail", m, C.logos[L], 2.6, 2.6, yaw + Math.PI / 2, 0, 0.01);
        }
        n++; yield "prop:" + (p.id || p.key);
    }
    // the free-standing boards (exits_guide for the big ones, a post for the rest)
    for (const b of LY.BOARD_POSTS) {
        F.world(b.f, b.r, _p);
        const yaw = F.yaw(b.face[0], b.face[1]);
        if (b.big && models.exits_guide) {
            const m = matAt(_p.x, _p.z, yaw);
            mg.add(models.exits_guide, m, null, { at: [_p.x, _p.z] });
            face(models.exits_guide, "Anchor_sign", m, C[b.cell], b.w, b.h, yaw, 0, 0.03);
        } else {
            postInto(mg, _p.x, _p.z, yaw, b.onFence ? 0 : b.y);
            at.quad(C[b.cell], _p.x + Math.sin(yaw) * 0.05, b.y, _p.z + Math.cos(yaw) * 0.05, yaw, b.w, b.h);
        }
    }
    yield "boards";
    // the lot's parked cars (merged, no shadow), the median trees
    for (const c of G.cars) {
        const tpl = models[c.key];
        if (!tpl) continue;
        F.world(c.f, c.r, _p);
        mg.add(tpl, matAt(_p.x, _p.z, F.yaw(0, c.face)), { Paint: c.color, Body: c.color }, { at: [_p.x, _p.z], noShadow: true });
    }
    yield "cars";
    // the interchange's props: the gantry, the gore's crash cushion, the advisory, rail ends, the ramp's guide sign
    interchangeProps(G, mg, at, C, matAt, face);
    yield "interchange";
    const look = MT.look, list = [];
    const it = mg.buildSteps(look, list);
    for (;;) { const r = it.next(); if (r.done) break; yield r.value; }
    for (const mesh of list) { mesh.updateMatrix(); group.add(mesh); out.geos.push(mesh.geometry); }
    yield "merged";
    const ms = atlasSteps(at);
    let sm;
    for (;;) { const r = ms.next(); if (r.done) { sm = r.value; break; } yield r.value; }
    group.add(sm); out.geos.push(sm.geometry); out.atlas = sm.material;
    sm.updateMatrix();
    return out;
}

/** A plain sign post pair under a board at height y (y 0: none — it hangs on the fence). */
function postInto(mg, x, z, yaw, y) {
    if (!y) return;
    const A = { pos: [], nor: [], col: [], idx: [] };
    for (const o of [-0.7, 0.7]) boxInto(A, x + Math.cos(yaw) * o, (y - 0.4) / 2, z - Math.sin(yaw) * o, 0.1, y - 0.4, 0.1, yaw, POSTC);
    mg.addGeometry(vgeo(A.pos, A.nor, A.col, A.idx), "flat", x, z);
}

function interchangeProps(G, mg, at, C, matAt, face) {
    const road = ctx.world.highway, E = G.E;
    // the gantry over the decel lane (its arm reaches left over our lanes)
    if (models.exits_gantry) {
        const p = road.point(E + LY.GANTRY, 13.4, {}), yaw = p.h + Math.PI, m = matAt(p.x, p.z, yaw);
        mg.add(models.exits_gantry, m, null, { at: [p.x, p.z] });
        face(models.exits_gantry, "Anchor_exit", m, C.gantry, 4.1, 2.88, yaw, 0.24, 0.04);
        face(models.exits_gantry, "Anchor_thru", m, C.thru, 6.0, 2.8, yaw, 0, 0.04);
    }
    // the crash cushion at the gore's nose, the RAMP 30 advisory, the ramp's guide board, the way-back board
    const gU = 14, gD = (8.8 + LY.offD(gU) - LY.HALF) / 2;
    if (models.exits_cushion) { const p = road.point(E + gU, gD, {}); mg.add(models.exits_cushion, matAt(p.x, p.z, p.h + Math.PI), null, { at: [p.x, p.z], noShadow: true }); }
    if (models.exits_advisory) { const p = road.point(E - 30, LY.offD(-30) + LY.HALF + 2.0, {}), yaw = p.h + Math.PI, m = matAt(p.x, p.z, yaw); mg.add(models.exits_advisory, m, null, { at: [p.x, p.z] }); face(models.exits_advisory, "Anchor_sign", m, C.advisory, 0.9, 1.15, yaw, 0, 0.03); }
    if (models.exits_guide) {
        for (const [u, dOff, cell] of [[30, LY.HALF + 3.4, C.ramp], [LY.ON0 + 8, -LY.HALF - 3.6, C.back]]) {
            const dOf = u < LY.ON0 ? LY.offD : LY.onD, p = road.point(E + u, dOf(u) + dOff, {}), yaw = p.h + Math.PI, m = matAt(p.x, p.z, yaw);
            mg.add(models.exits_guide, m, null, { at: [p.x, p.z] });
            face(models.exits_guide, "Anchor_sign", m, cell, 4.2, 1.8, yaw, 0, 0.03);
        }
        // the gore's EXIT 12 board on the grass past the paint
        const p = road.point(E + 30, (8.8 + LY.offD(30) - LY.HALF) / 2, {}), yaw = p.h + Math.PI;
        postInto(mg, p.x, p.z, yaw, 2.2);
        at.quad(C.gore, p.x + Math.sin(yaw) * 0.05, 2.2, p.z + Math.cos(yaw) * 0.05, yaw, 2.4, 1.4);
    }
    if (models.exits_railend) for (const rp of G.rails.slice(0, 2)) {
        const a = rp[0], b = rp[1];
        mg.add(models.exits_railend, matAt(a.x, a.z, Math.atan2(a.x - b.x, a.z - b.z)), null, { at: [a.x, a.z], noShadow: true });
    }
}

/** The town kit's Atlas.meshSteps, a CELL a step (each sign's text is a few ms of canvas work in software rendering; six at
 *  once was the build's longest frame). The atlas canvas is drawn once a page and reused by later builds (same cells). */
let ATLAS_TEX = null;
function* atlasSteps(at) {
    let scale = 1;
    while (!at.pack(scale) && scale > 0.3) scale *= 0.9;
    const S = at.size;
    if (!ATLAS_TEX || ATLAS_TEX.n !== at.cells.length) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = S;
        const g = canvas.getContext("2d");
        yield "atlas:canvas";
        for (const c of at.cells) {
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
            yield "atlas:" + (spec.key || "cell");
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        ATLAS_TEX = { tex, n: at.cells.length, mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, alphaTest: 0.4, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.12 }) };
    }
    for (const c of at.cells) c.uv = [c.x / S, 1 - (c.y + c.ph) / S, (c.x + c.pw) / S, 1 - c.y / S];
    const n = at.quads.length;
    const P = new Float32Array(n * 12), U = new Float32Array(n * 8), N = new Float32Array(n * 12), I = [];
    at.quads.forEach((q, k) => {
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
    const mesh = new THREE.Mesh(geo, ATLAS_TEX.mat);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
}
