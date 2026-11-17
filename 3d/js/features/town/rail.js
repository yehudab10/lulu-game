// features/town — a RAILWAY ON AN EMBANKMENT (def.rail): Midwood's B/Q, the BMT Brighton Line.
// A long earth berm runs mid-block along the grid's z axis; every street that crosses it passes
// UNDER on a short steel girder bridge (the berm stops, concrete abutments, LOW CLEARANCE); the
// stations sit on top straddling their avenue (side platforms + canopies over four tracks) with a
// brick station house tucked under the bridge; and the trains run on top — the Q stopping
// everywhere, the B (weekdays only) flying past express on the middle tracks.
//
//   buildRail(B)          static: berm, bridges, tracks, fences, stations (into the build's merge)
//                         + the trains (one merged group each, moved per frame)
//   tickRail(T, dt, …)    the trains: run, brake for the station, dwell, chime, rumble overhead
import * as THREE from "three";
import { models } from "../../models.js";
import { Merger } from "./kit.js";
import { PL } from "./plan.js";
import * as SFX from "./sfx.js";

export const RAIL_MODELS = ["town_mw_station", "town_mw_train", "town_mw_pigeon"];
const CAR_LEN = 15.2, PIECE = 40;

export function buildRail(B) {
    const { def, T, merge, col, sign, place, atlas, addColored, own, root } = B;
    const RL = def.rail, x = RL.x, top = RL.top, hb = RL.base / 2, hd = RL.deck / 2;
    // where streets pass under: every street that crosses the line x = RL.x
    const gaps = [];
    for (const st of PL.STREETS) {
        if (st.axis === "ns" || Math.abs(st.ux) < 0.2) continue;
        const a = (x - st.px) / st.ux;
        if (a < st.a0 - 0.1 || a > st.a1 + 0.1) continue;
        const zc = st.pz + st.uz * a, half = (st.walk + 0.7) / Math.abs(st.rz);
        gaps.push({ st, a, zc, z0: zc - half, z1: zc + half });
    }
    gaps.sort((p, q) => p.zc - q.zc);
    T.rail = { gaps, x, top, stations: [] };
    const box = (w, h, d, cx, cy, cz, color, look = "solid") => {
        const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, cy, cz); addColored(merge, g, color, cx, cz, look);
    };
    // the berm between the gaps, in short pieces (each its own cluster, so culling works)
    let zPrev = RL.z0;
    for (const g of [...gaps, { z0: RL.z1, z1: RL.z1 }]) {
        for (let za = zPrev; za < g.z0 - 0.1; za += PIECE) {
            const zb = Math.min(g.z0, za + PIECE);
            addColored(merge, bermGeo(x, za, zb, hb, hd, top), "#6F8F45", x, (za + zb) / 2);
            box(RL.deck, 0.12, zb - za, x, top + 0.06, (za + zb) / 2, "#7D776E");
            for (let z = za; z < zb; z += 2.2) { col(x - hb + 0.6, z, 1.0, "wall"); col(x + hb - 0.6, z, 1.0, "wall"); }
        }
        zPrev = g.z1;
    }
    for (const g of gaps) {
        // concrete abutments where the berm stops, a girder bridge between them
        for (const zz of [g.z0 - 0.5, g.z1 + 0.5]) {
            box(RL.base, top, 1.0, x, top / 2, zz, "#9E9A90");
            for (let xx = x - hb + 0.8; xx <= x + hb - 0.8; xx += 1.6) col(xx, zz, 0.85, "wall");
        }
        const len = g.z1 - g.z0 + 2;
        for (const gx of [-hd + 0.35, -hd / 3, hd / 3, hd - 0.35]) box(0.45, 1.5, len, x + gx, top - 0.8, g.zc, "#2F4F3E");
        box(RL.deck, 0.35, len, x, top - 0.12, g.zc, "#3A4A40");
        for (const s of [-1, 1]) box(0.3, 1.0, len, x + s * (hd - 0.1), top + 0.5, g.zc, "#2F4F3E");     // the parapets
        // LOW CLEARANCE on both faces of the bridge (the street comes at it along x)
        if (def.lines.SIGNS.lowClearance) for (const s of [-1, 1]) {
            sign({ lines: def.lines.SIGNS.lowClearance, bg: "#F9C623", fg: ["#111111", "#5D4037"], w: 720, h: 150 }, x + s * (hd + 0.02), top - 0.8, g.zc, s > 0 ? Math.PI / 2 : -Math.PI / 2, 4.4, 0.9);
        }
    }
    // tracks + tie beds + the fences along the top, in pieces
    for (let za = RL.z0; za < RL.z1; za += PIECE) {
        const zb = Math.min(RL.z1, za + PIECE), zm = (za + zb) / 2, L = zb - za;
        for (const t of RL.tracks) {
            box(2.4, 0.08, L, x + t, top + 0.16, zm, "#5A4A3C", "flat");
            for (const r of [-0.72, 0.72]) box(0.09, 0.14, L, x + t + r, top + 0.27, zm, "#8D8D8D", "flat");
        }
        for (const s of [-1, 1]) {
            box(0.05, 1.7, L, x + s * (hd - 0.15), top + 0.95, zm, "#8E9AA3", "flat");
            for (let z = za; z < zb; z += 4) box(0.08, 1.9, 0.08, x + s * (hd - 0.15), top + 0.95, z, "#6B7780", "flat");
        }
    }
    // stations: platforms + canopies on top, a brick station house under the bridge, green globes, the B/Q bullets
    const bullets = atlas.sign({ key: "BQ", w: 512, h: 256, draw: (g, w, h) => {
        for (const [cx, col2, ch] of [[w * 0.3, "#FF6319", "B"], [w * 0.7, "#FCCC0A", "Q"]]) {
            g.fillStyle = col2; g.beginPath(); g.arc(cx, h / 2, h * 0.42, 0, Math.PI * 2); g.fill();
            g.fillStyle = ch === "Q" ? "#111111" : "#FFFFFF"; g.font = `800 ${h * 0.5}px Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, cx, h / 2 + 4);
        }
    } });
    for (const sd of RL.stations || []) {
        const g = gaps.find(q => q.st.name === sd.street);
        if (!g) continue;
        place("town_mw_station", x, g.zc, 0);
        const nameSpec = { lines: [sd.name], bg: "#111111", fg: "#FFFFFF", w: 768, h: 110, radius: 4 };
        for (const s of [-1, 1]) for (const dz of [-14, 14]) sign(nameSpec, x + s * 6.35, top + 3.1, g.zc + dz, s > 0 ? -Math.PI / 2 : Math.PI / 2, 4.6, 0.66);
        if (def.lines.SIGNS.bqMaybe) sign({ lines: def.lines.SIGNS.bqMaybe, bg: "#1B1B1B", fg: ["#FFB300", "#FF7043"], w: 640, h: 150 }, x + 6.35, top + 3.9, g.zc, -Math.PI / 2, 3.0, 0.7, true);
        // the station house: in the abutment on one side of the street
        const hz = sd.house > 0 ? g.z1 - 0.4 : g.z0 + 0.4, face = sd.house > 0 ? Math.PI : 0, fz = Math.cos(face);     // it faces the street
        box(12, 3.8, 0.8, x, 1.9, hz, "#8E3F33");
        box(12.6, 0.4, 1.2, x, 3.9, hz, "#D7CFC2");
        for (const dx of [-3, 3]) box(2.2, 2.4, 0.2, x + dx, 1.2, hz + fz * 0.42, "#1E2A2E");
        for (let xx = x - 5.6; xx <= x + 5.6; xx += 1.4) col(xx, hz, 0.6, "wall");
        const sz = hz + fz * 0.46;
        sign({ lines: [sd.name, sd.express ? "B · Q (B: weekdays)" : "Q only (the B waves)"], bg: "#111111", fg: ["#FFFFFF", "#BDBDBD"], w: 768, h: 200 }, x, 3.15, sz, face, 4.4, 1.15);
        atlas.quad(bullets, x + 4.6, 3.15, sz, face, 1.6, 0.8);
        for (const dx of [-5.6, 5.6]) {      // the green globes: subway this way
            const p = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6); p.translate(x + dx, 1.3, sz + fz * 0.4); addColored(merge, p, "#2E3B33", x + dx, sz, "flat");
            const gl = new THREE.SphereGeometry(0.26, 10, 8); gl.translate(x + dx, 2.75, sz + fz * 0.4); addColored(merge, gl, "#43A047", x + dx, sz, "lit");
        }
        const spot = { x: x + 4.2, z: sz + fz * 2.4, rot: face, ux: fz, uz: 0, nx: 0, nz: fz };
        T.rail.stations.push({ name: sd.name, zc: g.zc, express: !!sd.express, spot });
        if (!T.spots.station) T.spots.station = spot;
    }
    // under one bridge: the pigeons' office
    const pg = gaps.find(q => q.st.name === RL.pigeons) || gaps[Math.floor(gaps.length / 2)];
    if (pg) {
        const zs = pg.zc + (pg.st.walk - 1.5) / Math.abs(pg.st.rz);
        T.spots.pigeons = { x, z: zs, z0: zs - 0.8, z1: zs + 0.8, x0: x };
        T.spots.underpass = { x, z: pg.zc };
    }
    // the trains: each one merged group (a few draw calls), moved every frame
    if (models.town_mw_train) for (const tc of RL.trains || []) {
        if (tc.weekdays && !weekday()) continue;
        const m = new Merger(1e6);
        for (let k = 0; k < tc.cars; k++) m.add(models.town_mw_train, new THREE.Matrix4().makeTranslation(0, 0, (k - (tc.cars - 1) / 2) * CAR_LEN), { Bullet: tc.color });
        const grp = new THREE.Group();
        grp.name = "Train:" + tc.line;
        for (const mesh of m.build(B.mats)) { mesh.matrixAutoUpdate = false; grp.add(mesh); own.push(mesh.geometry); }
        // the route bullet on both ends
        const tex = bulletTex(tc.line, tc.color);
        const bm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        own.push(tex, bm);
        const half = tc.cars * CAR_LEN / 2;
        for (const s of [-1, 1]) {
            const q = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), bm);
            q.position.set(0, 3.0, s * (half + 0.06)); q.rotation.y = s > 0 ? 0 : Math.PI;
            grp.add(q); own.push(q.geometry);
        }
        grp.position.set(x + tc.track, top + 0.3, 0);
        root.add(grp);
        const stops = (T.rail.stations || []).filter(s => tc.local || s.express).map(s => s.zc);
        const z0 = RL.z0 - half - 30, z1 = RL.z1 + half + 30;
        T.trains.push({ obj: grp, cfg: tc, half, z: tc.dir > 0 ? z0 : z1, z0, z1, v: tc.local ? 13 : 19, vmax: tc.local ? 14 : 21,
            state: "wait", t: tc.local ? 3 : 14, stops, nextStop: null, seen: false });
        grp.visible = false;
    }
}
const weekday = () => { const d = new Date().getDay(); return d >= 1 && d <= 5; };

function bermGeo(x, za, zb, hb, hd, h) {
    // the two grassy slopes (the top is a ballast slab, the ends are abutments or open)
    const P = [], N = [];
    const quad = (a, b, c, d, n) => { P.push(...a, ...c, ...b, ...a, ...d, ...c); for (let i = 0; i < 6; i++) N.push(...n); };
    const sl = Math.hypot(hb - hd, h);
    quad([x - hb, 0, za], [x - hd, h, za], [x - hd, h, zb], [x - hb, 0, zb], [-h / sl, (hb - hd) / sl, 0]);
    quad([x + hb, 0, zb], [x + hd, h, zb], [x + hd, h, za], [x + hb, 0, za], [h / sl, (hb - hd) / sl, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    return g;
}
function bulletTex(letter, color) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = color; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = letter === "Q" ? "#111111" : "#FFFFFF"; g.font = "800 80px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(letter, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Per frame: run the trains. listen(x, z) → the camera / Lulu (world); hooks: { onPass(train), onStop(train, station) }. */
export function tickRail(T, dt, cam, hooks = {}) {
    if (!T.trains.length) return;
    const O = PL.ORIGIN;
    let loud = 0;
    for (const tr of T.trains) {
        const dir = tr.cfg.dir;
        if (tr.state === "wait") {
            tr.t -= dt;
            if (tr.t <= 0) { tr.state = "run"; tr.z = dir > 0 ? tr.z0 : tr.z1; tr.v = tr.vmax; tr.obj.visible = true; tr.served = new Set(); }
            else continue;
        }
        if (tr.state === "dwell") {
            tr.t -= dt;
            if (tr.t <= 0) { tr.state = "run"; if (hooks.onDepart) hooks.onDepart(tr); }
        } else {
            // the next stop ahead (each served once per run)
            let next = null, gap = 1e9;
            for (const z of tr.stops) { const g = (z - tr.z) * dir; if (g > -0.5 && g < gap && !tr.served.has(z)) { gap = g; next = z; } }
            let want = tr.vmax;
            if (next != null) want = Math.min(want, Math.sqrt(2 * 1.4 * Math.max(0, gap)) + 0.4);
            tr.v += Math.max(-3.5 * dt, Math.min(1.6 * dt, want - tr.v));
            tr.z += tr.v * dir * dt;
            if (next != null && gap < 0.6) {
                tr.served.add(next); tr.z = next; tr.v = 0; tr.state = "dwell"; tr.t = 6 + Math.random() * 3;
                if (hooks.onStop) hooks.onStop(tr, next);
            }
            if ((dir > 0 && tr.z > tr.z1) || (dir < 0 && tr.z < tr.z0)) { tr.state = "wait"; tr.t = 18 + Math.random() * 26; tr.obj.visible = false; continue; }
        }
        tr.obj.position.z = tr.z;
        // heard overhead: a rumble by distance to the nearest car of the train
        const wx = O.x + tr.obj.position.x, wz = O.z + Math.max(tr.z - tr.half, Math.min(tr.z + tr.half, cam.z - O.z));
        const dist = Math.hypot(wx - cam.x, wz - cam.z);
        tr.obj.visible = dist < 320;
        if (tr.v > 0.5) loud = Math.max(loud, Math.max(0, 1 - dist / 150) * Math.min(1, tr.v / 10));
        if (!tr.seen && dist < 60 && hooks.onPass) { tr.seen = true; hooks.onPass(tr); }
    }
    SFX.rumble(loud);
}
