// features/lanes/room.js — 🎳 THE ALLEY: a room on the interiors engine, built from boxes (merged by colour: a handful of
// draw calls), 4 lanes, every pin of every lane in ONE instanced mesh, the rolling balls in another, a scoreboard over
// each lane (a small canvas, redrawn only when its game changes), Sheldon at the counter, Rivky at the snack bar, the
// trophy case with the gap where 1994 was, league night (Tue + Thu evenings, two NPC teams on lanes 3 + 4) and a kids'
// birthday party on Sundays (bumpers up on lane 4).
//
// Each lane shows ONE game: mine (I'm on its roster), a player's here (their published state, net.js), or the house's
// (league / party / the bowler Shimmy plays her against). A lane plays the balls of its game in order (game.js › order)
// — the ball down the lane, the pins flying (pins.js › roll), the rack swept and set — so every screen in the room
// watches the same game. Nothing here pays coins.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, emit } from "../../core/ctx.js";
import { models } from "../../models.js";
import { defineInterior, pick } from "../interiors/engine.js";
import { canvasPlane, drawLines, tone } from "../interiors/fx.js";
import { LANE, PINS, ALL, roll, lineAt, countOf, rng, botThrow } from "./pins.js";
import { order, sheetOf, BOT } from "./game.js";
import { TUNE, NAME, LINES, SHELDON, RIVKY, SHIMMY, LEAGUE, PARTY, leagueTonight } from "./data.js";

export const PITCH = 1.75;
export const laneX = k => (k - 2.5) * PITCH;
const W = 11, ZBACK = -LANE.L - 2.2, ZFRONT = 9.0, CEIL = 3.4;
export const DOOR = { x: 2.6, z: ZFRONT - 0.3 };
export const COUNTER = { x: -3.4, z: 7.5 };
export const SNACK = { x: 4.55, z: 6.0 };
export const CASE = { x: -5.15, z: 5.4 };
export const APPROACH_Z = 1.3;          // where a bowler stands, set
const RACK_T = 0.55;

function roomKit() {
    const g = new THREE.Group();
    g.name = "LanesRoomKit";
    const d = new THREE.Object3D(); d.name = "Spot_door"; d.position.set(DOOR.x, 0, DOOR.z); d.rotation.y = Math.PI; g.add(d);
    const l = new THREE.Object3D(); l.name = "Spot_lulu"; l.position.set(DOOR.x, 0, DOOR.z - 2.4); g.add(l);      // (she faces the lanes: set in build — a spot's ry only reads back within ±90°)
    return g;
}
models.lanes_roomkit = models.lanes_roomkit || roomKit();

// ── a pin (a lathe, white with the red neck stripes as vertex colours) + a ball ──
function pinGeometry() {
    const pts = [[0, 0.38], [0.026, 0.372], [0.033, 0.335], [0.025, 0.30], [0.022, 0.27], [0.04, 0.215], [0.058, 0.155], [0.06, 0.11], [0.045, 0.04], [0.03, 0.002], [0, 0]]
        .map(([r, y]) => new THREE.Vector2(r, y));          // (top → bottom: the faces point outward)
    const g = new THREE.LatheGeometry(pts, 12);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), red = (y > 0.262 && y < 0.284) || (y > 0.292 && y < 0.304);
        col.set(red ? [0.8, 0.05, 0.08] : [0.97, 0.96, 0.93], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.scale(1.3, 1.3, 1.3);                // (a touch bigger than life: they read from the foul line on a phone)
    return g;
}

/** The static boxes, grouped by colour → one mesh per colour (a few draw calls for the whole alley). */
function kit(rt) {
    const groups = new Map();
    const api = {
        box(w, h, d, color, x, y, z, o = {}) {
            const g = new THREE.BoxGeometry(w, h, d);
            if (o.ry) g.rotateY(o.ry);
            g.translate(x, y, z);
            const key = color + (o.emissive ? "*" : "") + (o.glass ? "~" : "");
            if (!groups.has(key)) groups.set(key, { color, o, list: [] });
            groups.get(key).list.push(g.index ? g.toNonIndexed() : g);
            return api;
        },
        finish() {
            for (const { color, o, list } of groups.values()) {
                const merged = mergeGeometries(list, false);
                for (const g of list) g.dispose();
                const m = rt.own(o.emissive ? new THREE.MeshBasicMaterial({ color, toneMapped: false })
                    : o.glass ? new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false })
                        : new THREE.MeshStandardMaterial({ color, roughness: o.rough != null ? o.rough : 0.75, metalness: o.metal || 0 }));
                const mesh = new THREE.Mesh(rt.own(merged), m);
                mesh.receiveShadow = !o.emissive && !o.glass;
                mesh.name = "lanes_" + color;
                rt.add(mesh);
            }
            groups.clear();
        },
    };
    return api;
}

/** The lane's wood (one canvas for all four): boards, the foul line, the dots + arrows. */
function laneTexture(rt, lenFar, lenNear) {
    const c = document.createElement("canvas"); c.width = 128; c.height = 1024;
    const g = c.getContext("2d"), H = c.height, total = lenFar + lenNear, zc = z => ((lenFar - z) / total) * H;     // z: + toward her
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? "#D9A86C" : "#CF9C5E"; g.fillRect(i * 8, 0, 8, H); }
    g.fillStyle = "rgba(120,70,20,.18)"; for (let y = 0; y < H; y += 37) g.fillRect(0, y, 128, 1);
    // the pin deck (lighter) + the foul line
    g.fillStyle = "#E6C08A"; g.fillRect(0, 0, 128, zc(-LANE.L + 0.4));
    g.fillStyle = "#1B1B1B"; g.fillRect(0, zc(0) - 3, 128, 6);
    // the approach dots + the arrows
    g.fillStyle = "#3E2723";
    for (const zz of [1.8, 3.4]) for (let i = 1; i < 7; i++) { g.beginPath(); g.arc(i * 128 / 7, zc(zz), 2.5, 0, 7); g.fill(); }
    for (let i = 1; i < 7; i++) { const x = i * 128 / 7, y = zc(-4.6 - Math.abs(i - 3.5) * 0.35); g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x - 4, y); g.lineTo(x + 4, y); g.fill(); }
    const t = rt.own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return rt.own(new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.05 }));
}
function carpetTexture(rt) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#1A1033"; g.fillRect(0, 0, 256, 256);
    const R = rng(1961);
    const cols = ["#FF4F9A", "#6FE3FF", "#FFD54F", "#7CFF6B"];
    for (let i = 0; i < 40; i++) {
        g.strokeStyle = cols[i % 4]; g.lineWidth = 3; g.globalAlpha = 0.75;
        const x = R() * 256, y = R() * 256;
        if (i % 3 === 0) { g.beginPath(); g.arc(x, y, 6 + R() * 8, 0, 7); g.stroke(); }
        else if (i % 3 === 1) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + 6); g.lineTo(x + 2, y + 16); g.closePath(); g.stroke(); }
        else { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 12, x + 22, y); g.stroke(); }
    }
    const t = rt.own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2);
    return rt.own(new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
}

// ── the lanes' moving parts ──────────────────────────────────────────────
// V.lanes[k] = { k, x, game, src: "" | "mine" | "peer" | "house", key, shown, anim, standing, rack, board, names }
export const V = { rt: null, lanes: [], pins: null, balls: null, house: [], said: 0, onBall: null };
const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), E3 = new THREE.Euler(), C3 = new THREE.Color();

function buildLanes(rt, K) {
    const lenFar = LANE.L + 1.1, lenNear = 4.3;
    const wood = laneTexture(rt, lenFar, lenNear);
    // the lane surfaces (approach + lane + deck), one mesh
    const lg = [];
    for (let k = 1; k <= TUNE.lanes; k++) {
        const g = new THREE.PlaneGeometry(LANE.half * 2, lenFar + lenNear); g.rotateX(-Math.PI / 2);
        g.translate(laneX(k), 0.005, (lenNear - lenFar) / 2); lg.push(g);
    }
    const lm = new THREE.Mesh(rt.own(mergeGeometries(lg, false)), wood); lm.receiveShadow = true; lm.name = "lanes_wood"; rt.add(lm);
    for (const g of lg) g.dispose();
    for (let k = 1; k <= TUNE.lanes; k++) {
        const x = laneX(k);
        // the gutters (just below the lane), the capping between lanes, the kickbacks by the deck
        for (const s of [-1, 1]) K.box(0.22, 0.02, lenFar, "#5A5F66", x + s * (LANE.half + 0.11), -0.06, -lenFar / 2, { metal: 0.6, rough: 0.35 });
    }
    for (let k = 0; k <= TUNE.lanes; k++) {
        const x = laneX(k) + PITCH / 2, edge = k === 0 || k === TUNE.lanes;
        K.box(edge ? 0.3 : PITCH - LANE.half * 2 - 0.44, 0.05, lenFar, "#ECE3D2", x, 0.02, -lenFar / 2);
        K.box(0.12, 0.7, 2.0, "#3A2A4A", x, 0.35, -LANE.L - 0.4);            // the kickbacks
    }
    // the pit + the masking unit over it (with its neon) + the back wall
    K.box(W, 0.4, 1.0, "#0E0E12", 0, -0.2, -LANE.L - 1.6);
    K.box(PITCH * TUNE.lanes + 0.4, 1.3, 0.35, "#25163F", 0, 1.75, -LANE.L - 1.15);
    K.box(PITCH * TUNE.lanes + 0.4, 0.06, 0.05, "#FF4F9A", 0, 1.12, -LANE.L - 0.96, { emissive: true });
    K.box(PITCH * TUNE.lanes + 0.4, 0.06, 0.05, "#6FE3FF", 0, 2.38, -LANE.L - 0.96, { emissive: true });
    // the ball returns (between lanes 1–2 and 3–4) + the scorer's tables + the benches (70s orange + teal)
    for (const x of [laneX(1) + PITCH / 2, laneX(3) + PITCH / 2]) {
        K.box(0.55, 0.62, 1.1, "#3B3F46", x, 0.31, 2.3, { metal: 0.4, rough: 0.4 });
        K.box(0.6, 0.06, 1.15, "#8E99A6", x, 0.65, 2.3, { metal: 0.7, rough: 0.3 });
        K.box(0.9, 0.7, 0.5, "#5D4037", x, 0.35, 3.55);
        K.box(2.6, 0.42, 0.55, "#E65100", x, 0.21, 4.4); K.box(2.6, 0.5, 0.12, "#00897B", x, 0.55, 4.7);
    }
    // the pins (all lanes, one instanced mesh) + the rolling balls (one instanced mesh) + the balls waiting on the returns
    const pinG = rt.own(pinGeometry());
    const pins = new THREE.InstancedMesh(pinG, rt.own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 })), TUNE.lanes * 10);
    pins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pins.castShadow = false; pins.name = "lanes_pins";
    rt.add(pins);
    const ballG = rt.own(new THREE.SphereGeometry(LANE.ballR, 18, 12));
    const balls = new THREE.InstancedMesh(ballG, rt.own(new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.1 })), TUNE.lanes + 1);
    balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage); balls.name = "lanes_balls"; balls.frustumCulled = false;
    for (let i = 0; i <= TUNE.lanes; i++) { balls.setColorAt(i, C3.set("#E91E63")); M4.makeScale(0, 0, 0); balls.setMatrixAt(i, M4); }
    rt.add(balls);
    const rack = new THREE.InstancedMesh(ballG, rt.own(new THREE.MeshStandardMaterial({ roughness: 0.2 })), 8);
    ["#1565C0", "#2E7D32", "#6A1B9A", "#E91E63", "#F9A825", "#212121", "#00838F", "#C62828"].forEach((c, i) => {
        const x = [laneX(1) + PITCH / 2, laneX(3) + PITCH / 2][i >> 2], j = i & 3;
        M4.makeTranslation(x - 0.15 + (j & 1) * 0.3, 0.78, 2.0 + (j >> 1) * 0.28); rack.setMatrixAt(i, M4); rack.setColorAt(i, C3.set(c));
    });
    rt.add(rack);
    V.pins = pins; V.balls = balls;
    // the lanes' state + a scoreboard over each one (facing the bowlers)
    V.lanes = [null];
    for (let k = 1; k <= TUNE.lanes; k++) {
        const board = canvasPlane(rt.set, 1.55, 0.53, () => { }, { px: 512 });
        board.mesh.position.set(laneX(k), 2.92, -0.7);
        rt.add(board.mesh);
        K.box(1.66, 0.62, 0.08, "#101010", laneX(k), 2.92, -0.76);
        K.box(0.04, 0.2, 0.04, "#101010", laneX(k), 3.3, -0.76);
        V.lanes.push({ k, x: laneX(k), game: null, src: "", key: "", shown: 0, anim: null, standing: ALL, rack: 0, board, boardKey: "", bumpers: false, ballColor: "#E91E63" });
        setRack(V.lanes[k], ALL);
    }
}

/** Pins of lane L as `mask` standing (the others hidden). */
function setRack(L, mask, rise = 0) {
    L.standing = mask;
    for (let i = 0; i < 10; i++) {
        const up = !!(mask & (1 << i));
        P3.set(L.x + PINS[i].x, rise, -PINS[i].y);
        S3.setScalar(up ? 1 : 0);
        M4.compose(P3, Q4.identity(), S3);
        V.pins.setMatrixAt((L.k - 1) * 10 + i, M4);
    }
    V.pins.instanceMatrix.needsUpdate = true;
}

/** Show `game` on lane k (src: "mine" | "peer" | "house"); null = an empty lane, the rack set. A new game → no replay. */
export function showGame(k, game, src, opts = {}) {
    const L = V.lanes[k];
    if (!L) return;
    const key = game ? `${src}:${game.gid}` : "";
    if (key !== L.key) {
        L.key = key; L.game = game; L.src = src; L.anim = null; L.rack = 0;
        if (game) {
            const o = order(game);
            L.shown = opts.replay ? 0 : o.seq.length;
            setRack(L, o.next && o.sheets[o.next] ? o.sheets[o.next].standing : ALL);
        } else { L.shown = 0; setRack(L, ALL); }
        L.ballColor = opts.color || "#E91E63";
        L.boardKey = "";
    } else L.game = game;
    if (opts.names) L.names = opts.names;
    L.bumpers = !!opts.bumpers;
}
/** Is lane k idle (every ball it knows about has been played out)? */
export function laneIdle(k) {
    const L = V.lanes[k];
    if (!L || !L.game) return true;
    return !L.anim && L.rack <= 0 && L.shown >= order(L.game).seq.length;
}

function startBall(L, e) {
    const t = { x: e.ball.x, aim: e.ball.aim, p: e.ball.p, s: e.ball.s };
    const r = roll(e.standing, t);
    const down = e.ball.down & e.standing;                  // (the thrower's screen decided: that's what falls)
    const hits = r.hits.filter(h => down & (1 << h.i));
    const late = Math.max(r.hits.length ? Math.max(...r.hits.map(h => h.t)) : 0, (LANE.L + LANE.deck) / r.speed);
    for (let i = 0; i < 10; i++) if ((down & (1 << i)) && !hits.some(h => h.i === i)) hits.push({ i, t: late, dx: 0, dy: 1, d: 0.25, e: 1 });   // (it fell on their screen: it falls here)
    L.anim = { t: 0, e, r, down, hits, end: Math.max((LANE.L + LANE.deck) / r.speed, late + 0.8) + 0.5, crashed: false, gutterSaid: false };
    tone(70, 0.6, "sawtooth", 0.035, 55);
}

function ballPos(A, t, L) {
    const r = A.r, D = r.D, y = Math.min(LANE.L + LANE.deck + 0.2, D.v * t);
    let x;
    if (r.gutter >= 0 && y >= r.gutter) x = Math.sign(r.endX) * (LANE.half + 0.11);
    else if (y <= LANE.L - 0.3) x = lineAt(D, y).x;
    else { const a = lineAt(D, LANE.L - 0.3).x, u = (y - (LANE.L - 0.3)) / (LANE.deck + 0.3); x = a + (r.endX - a) * Math.min(1, u); }
    if (L.bumpers) x = Math.max(-LANE.half + LANE.ballR, Math.min(LANE.half - LANE.ballR, x));
    const yy = r.gutter >= 0 && y >= r.gutter ? LANE.ballR - 0.06 : LANE.ballR;
    return { x: L.x + x, y: y > LANE.L + LANE.deck ? -0.3 : yy, z: -y, rolled: y };
}

function tickLane(L, dt) {
    const k = L.k;
    if (L.rack > 0) {
        L.rack -= dt;
        const u = 1 - Math.max(0, L.rack) / RACK_T;
        setRack(L, L.standing, -0.4 * (1 - u));
        if (L.rack <= 0) setRack(L, L.standing, 0);
        return;
    }
    if (!L.game) { M4.makeScale(0, 0, 0); V.balls.setMatrixAt(k, M4); V.balls.instanceMatrix.needsUpdate = true; return; }
    if (!L.anim) {
        const o = order(L.game);
        if (L.shown < o.seq.length) startBall(L, o.seq[L.shown]);
        else return;
    }
    const A = L.anim;
    A.t += dt;
    // the ball
    const b = ballPos(A, A.t, L);
    if (b.rolled < LANE.L + LANE.deck + 0.1) {
        E3.set(-A.t * A.r.D.v / LANE.ballR, 0, 0);
        M4.compose(P3.set(b.x, b.y, b.z), Q4.setFromEuler(E3), S3.setScalar(1));
    } else M4.makeScale(0, 0, 0);
    V.balls.setMatrixAt(k, M4);
    V.balls.setColorAt(k, C3.set(L.ballColor));
    V.balls.instanceMatrix.needsUpdate = true; if (V.balls.instanceColor) V.balls.instanceColor.needsUpdate = true;
    if (A.r.gutter >= 0 && b.rolled >= A.r.gutter && !A.gutterSaid) { A.gutterSaid = true; if (V.onBall) V.onBall(L, A, "gutter"); }
    // the pins: the standing ones stay, the knocked ones fly / tip / drop into the pit
    for (let i = 0; i < 10; i++) {
        const idx = (k - 1) * 10 + i, up = !!(A.e.standing & (1 << i));
        if (!up) continue;
        const h = A.hits.find(q => q.i === i);
        P3.set(L.x + PINS[i].x, 0, -PINS[i].y); Q4.identity(); S3.setScalar(1);
        if (h && A.t >= h.t) {
            const tau = A.t - h.t, u = Math.min(1, tau / 0.45), ease = 1 - (1 - u) * (1 - u);
            const px = PINS[i].x + h.dx * h.d * ease, py = PINS[i].y + h.dy * h.d * ease;
            const pit = py > LANE.L + LANE.deck - 0.05;
            P3.set(L.x + px, pit ? -Math.min(0.6, tau * 1.6) : Math.sin(u * Math.PI) * 0.12, -py);
            const tilt = Math.min(Math.PI / 2, tau * 7);
            Q4.setFromAxisAngle(P3.clone().set(h.dy, 0, h.dx).normalize(), tilt);
            if (!A.crashed) { A.crashed = true; for (let n = 0; n < 4; n++) tone(160 + Math.random() * 260, 0.09, "triangle", 0.05, 90, n * 0.03); }
        }
        M4.compose(P3, Q4, S3);
        V.pins.setMatrixAt(idx, M4);
    }
    V.pins.instanceMatrix.needsUpdate = true;
    if (A.t < A.end) return;
    // settled: the knocked pins are swept; the next ball's rack (a new frame → a fresh rack, rising)
    L.anim = null;
    L.shown++;
    const o = order(L.game);
    const e = A.e, sheet = sheetOf(L.game.balls[e.uid].slice(0, e.k + 1), L.game.frames);
    const next = o.next && o.sheets[o.next] ? o.sheets[o.next].standing : ALL;
    if (V.onBall) V.onBall(L, A, "done", sheet);
    const fresh = sheet.ball === 0;
    setRack(L, fresh ? next : (A.e.standing & ~A.down), 0);
    if (fresh || next === ALL) { L.standing = next; L.rack = RACK_T; }
    L.boardKey = "";
}

// ── the scoreboards ──────────────────────────────────────────────────────
function drawBoard(L, nameOf) {
    const G = L.game, key = G ? `${L.key}|${L.shown}|${G.roster.join(",")}|${L.names || ""}` : `-${L.names || ""}`;
    if (key === L.boardKey) return;
    L.boardKey = key;
    const { g, canvas } = L.board, w = canvas.width, h = canvas.height;
    g.fillStyle = "#0B0820"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FF4F9A"; g.font = "700 20px Fredoka, Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(`LANE ${L.k}`, 10, 16);
    if (!G) {
        g.fillStyle = "#6FE3FF"; g.textAlign = "center"; g.font = "700 30px Fredoka, Arial, sans-serif";
        g.fillText(L.names || "OPEN — ask Sheldon", w / 2, h / 2 + 8);
        L.board.tex ? (L.board.tex.needsUpdate = true) : (L.board.mesh.material.map.needsUpdate = true);
        return;
    }
    const o = order(G), nF = G.frames;
    // (the balls not played out yet on this screen aren't on the board yet either)
    const shownBy = {};
    for (let i = 0; i < Math.min(L.shown, o.seq.length); i++) shownBy[o.seq[i].uid] = (shownBy[o.seq[i].uid] || 0) + 1;
    g.fillStyle = "#6FE3FF"; g.textAlign = "right"; g.fillText(nF === 3 ? "QUICK GAME · 3 FRAMES" : "10 FRAMES", w - 10, 16);
    const rows = G.roster.slice(0, 4), rh = Math.min(36, (h - 34) / Math.max(1, rows.length)), bx = 104, bw = (w - bx - 54) / nF;
    rows.forEach((u, r) => {
        const y = 32 + r * rh, sh = sheetOf((G.balls[u] || []).slice(0, shownBy[u] || 0), nF);
        const turn = L.shown >= o.seq.length && o.next === u;
        g.fillStyle = turn ? "#3A1E5C" : r % 2 ? "#15102E" : "#1C1538"; g.fillRect(4, y, w - 8, rh - 2);
        g.fillStyle = turn ? "#FFD54F" : "#FFFFFF"; g.textAlign = "left"; g.font = `700 ${Math.round(rh * 0.5)}px Fredoka, Arial, sans-serif`;
        g.fillText((turn ? "▶ " : "") + String(nameOf(u)).slice(0, 9), 8, y + rh / 2);
        for (let f = 0; f < nF; f++) {
            const x = bx + f * bw, fr = sh.frames[f];
            g.strokeStyle = "#4B3B7A"; g.lineWidth = 1; g.strokeRect(x, y + 1, bw, rh - 4);
            if (!fr) continue;
            g.fillStyle = "#FFD54F"; g.font = `700 ${Math.round(rh * 0.36)}px Fredoka, Arial, sans-serif`; g.textAlign = "right";
            g.fillText(fr.marks.join(" "), x + bw - 3, y + rh * 0.3);
            if (fr.score != null) { g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.font = `700 ${Math.round(rh * 0.38)}px Fredoka, Arial, sans-serif`; g.fillText(String(fr.score), x + bw / 2, y + rh * 0.72); }
        }
        g.fillStyle = "#7CFF6B"; g.textAlign = "right"; g.font = `700 ${Math.round(rh * 0.5)}px Fredoka, Arial, sans-serif`;
        g.fillText(String(sh.total), w - 8, y + rh / 2);
    });
    L.board.mesh.material.map.needsUpdate = true;
}

// ── the house's lanes: league night, the birthday party ──────────────────
function houseGame(k, ros, gid) { const balls = {}; for (const u of ros) balls[u] = []; return { lane: k, gid, frames: 10, owner: "~house", roster: ros, balls, house: true }; }
function tickHouse(rt, dt) {
    for (const H of V.house) {
        const L = V.lanes[H.k];
        if (!L || L.src !== "house" || L.key !== `house:${H.game.gid}`) continue;
        if (!laneIdle(H.k)) continue;
        const o = order(H.game);
        if (!o.next) { H.game = houseGame(H.k, H.game.roster, H.game.gid + "+"); showGame(H.k, H.game, "house", { color: H.color, names: H.names, bumpers: H.bumpers }); continue; }
        H.wait = (H.wait || 0) - dt;
        if (H.wait > 0) continue;
        H.wait = H.kids ? 3.5 + Math.random() * 3 : 2.5 + Math.random() * 4;
        const st = o.sheets[o.next].standing;
        const t = botThrow(H.R, H.kids ? 0.15 : 0.55, st);
        if (H.kids) t.p = Math.min(t.p, 8);
        let r = roll(st, t);
        if (H.bumpers && r.gutter >= 0) { t.x = 17; t.aim = 17; r = roll(st, t); }       // (bumpers: it bounces back in)
        H.game.balls[o.next].push(Object.assign(t, { down: r.down & st }));
        const who = H.people[H.game.roster.indexOf(o.next)];
        if (who) { who.pose.cheer = false; who.p.obj.position.z = APPROACH_Z - 0.4; setTimeout(() => { if (!rt.disposed) who.p.obj.position.z = who.home.z; }, 1600); }
    }
}
export function addHouse(rt, now) {
    V.house = [];
    const lg = now.wd != null && LEAGUE.days.includes(now.wd) && now.hour >= LEAGUE.from && now.hour < LEAGUE.to;
    const party = now.wd === PARTY.day && now.hour >= PARTY.from && now.hour < PARTY.to && !lg;
    if (lg) {
        const teams = leagueTonight(now.key || "");
        teams.forEach((tm, i) => {
            const k = 3 + i, ros = tm.bowlers.map((n, j) => `~${i}${j}`);
            const people = tm.bowlers.map((n, j) => rt.person(`league${i}${j}`, "npcMan", { x: laneX(k) + (j ? 0.55 : -0.55), z: 4.2, ry: Math.PI }, { name: n, colors: { Shirt: tm.c, Pants: "#263238" } }));
            const H = { k, game: houseGame(k, ros, `lg${i}`), color: tm.c, names: tm.name, people, R: rng(1000 + i * 77 + (now.hour | 0)), wait: 2 + i * 2 };
            V.house.push(H);
            showGame(k, H.game, "house", { color: H.color, names: H.names });
        });
        rt.every(14, 26, r => { if (!r.disposed) r.bubble(pick(LINES.league), (pick(V.house).people[0] || {}).p.obj, 2.6); }, { first: 6 });
    } else if (party) {
        const k = 4, ros = ["~k0", "~k1", "~k2"];
        const people = ros.map((u, j) => rt.person(`kid${j}`, "npcKid", { x: laneX(k) - 0.6 + j * 0.6, z: 4.25, ry: Math.PI }, { name: ["Yossi", "Malky", "Dovi"][j] }));
        people.push(rt.person("partyMom", "npcWoman", { x: laneX(k) + 1.2, z: 5.3, ry: Math.PI }, { name: "Yossi's mother", colors: { Top: "#80DEEA", Skirt: "#37474F" } }));
        // the party table: a cake + balloons
        const K = kit(rt);
        K.box(1.4, 0.75, 0.8, "#ECEFF1", laneX(k), 0.37, 6.2).box(0.4, 0.2, 0.4, "#F8BBD0", laneX(k), 0.85, 6.2);
        ["#E91E63", "#FFC107", "#03A9F4"].forEach((c, i) => K.box(0.28, 0.34, 0.28, c, laneX(k) - 0.5 + i * 0.5, 1.9 + (i % 2) * 0.15, 6.4, { emissive: false }));
        K.finish();
        const H = { k, game: houseGame(k, ros, "party"), color: "#FFC107", names: `🎂 YOSSI'S ${PARTY.age}TH!`, people, R: rng(7), wait: 3, kids: true, bumpers: true };
        V.house.push(H);
        showGame(k, H.game, "house", { color: H.color, names: H.names, bumpers: true });
        // the bumpers (raised along lane 4's gutters)
        const B = kit(rt);
        for (const s of [-1, 1]) B.box(0.06, 0.14, LANE.L, "#FFEB3B", laneX(k) + s * (LANE.half + 0.03), 0.07, -LANE.L / 2);
        B.finish();
        rt.every(12, 22, r => { if (!r.disposed) r.bubble(pick(LINES.party), people[Math.floor(Math.random() * 3)].p.obj, 2.6); }, { first: 4 });
    }
    return { league: lg, party };
}

// ── the room ─────────────────────────────────────────────────────────────
function build(rt) {
    V.rt = rt;
    rt.lulu.obj.rotation.y = Math.PI;          // (in through the door, facing the lanes — the camera starts behind her)
    if (ctx.G) ctx.G.hint = null;
    rt.bounds = { x0: -W / 2 + 0.4, x1: W / 2 - 0.4, z0: 0.35, z1: ZFRONT - 0.3 };
    rt.cols.length = 0;
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });
    const K = kit(rt);
    // the shell: the concourse carpet, the walls, the ceiling (with light panels), the neon
    const carpet = carpetTexture(rt);
    const fl = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(W, ZFRONT - 3.9)), carpet); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.001, (ZFRONT + 3.9) / 2); fl.receiveShadow = true; rt.add(fl);
    K.box(W, 0.05, ZFRONT - ZBACK, "#2B2238", 0, -0.03, (ZFRONT + ZBACK) / 2);
    K.box(0.2, CEIL, ZFRONT - ZBACK, "#3D2A55", -W / 2, CEIL / 2, (ZFRONT + ZBACK) / 2);
    K.box(0.2, CEIL, ZFRONT - ZBACK, "#3D2A55", W / 2, CEIL / 2, (ZFRONT + ZBACK) / 2);
    K.box(W, CEIL, 0.2, "#1A1033", 0, CEIL / 2, ZBACK);
    K.box(DOOR.x - 0.6 + W / 2, CEIL, 0.2, "#3D2A55", (-W / 2 + DOOR.x - 0.6) / 2, CEIL / 2, ZFRONT);
    K.box(W / 2 - DOOR.x - 0.6, CEIL, 0.2, "#3D2A55", (DOOR.x + 0.6 + W / 2) / 2, CEIL / 2, ZFRONT);
    K.box(1.2, CEIL - 2.3, 0.2, "#3D2A55", DOOR.x, (CEIL + 2.3) / 2, ZFRONT);
    K.box(W, 0.1, ZFRONT - ZBACK, "#17111F", 0, CEIL + 0.05, (ZFRONT + ZBACK) / 2);
    for (let z = 6; z > ZBACK + 2; z -= 4) K.box(1.4, 0.03, 0.5, "#FFF3D6", 0, CEIL - 0.01, z, { emissive: true });
    for (const s of [-1, 1]) { K.box(0.04, 0.05, ZFRONT - ZBACK - 1, "#FF4F9A", s * (W / 2 - 0.12), 2.7, (ZFRONT + ZBACK) / 2, { emissive: true }); K.box(0.04, 0.05, ZFRONT - ZBACK - 1, "#6FE3FF", s * (W / 2 - 0.12), 2.5, (ZFRONT + ZBACK) / 2, { emissive: true }); }
    col("front1", -W, DOOR.x - 0.6, ZFRONT - 0.15, ZFRONT + 1); col("front2", DOOR.x + 0.6, W, ZFRONT - 0.15, ZFRONT + 1);
    buildLanes(rt, K);
    col("returnA", laneX(1) + PITCH / 2 - 0.35, laneX(1) + PITCH / 2 + 0.35, 1.7, 2.9); col("returnB", laneX(3) + PITCH / 2 - 0.35, laneX(3) + PITCH / 2 + 0.35, 1.7, 2.9);
    col("benchA", laneX(1) + PITCH / 2 - 1.3, laneX(1) + PITCH / 2 + 1.3, 4.1, 4.8); col("benchB", laneX(3) + PITCH / 2 - 1.3, laneX(3) + PITCH / 2 + 1.3, 4.1, 4.8);
    // the counter (Sheldon) + the shoe cubbies behind him
    K.box(3.0, 1.05, 0.7, "#6D4C41", COUNTER.x, 0.52, COUNTER.z).box(3.1, 0.06, 0.8, "#D7CCC8", COUNTER.x, 1.07, COUNTER.z);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) K.box(0.36, 0.3, 0.3, "#4E342E", COUNTER.x - 1.0 + i * 0.4, 1.3 + j * 0.34, ZFRONT - 0.3).box(0.26, 0.1, 0.22, j % 2 ? "#C62828" : "#1565C0", COUNTER.x - 1.0 + i * 0.4, 1.2 + j * 0.34, ZFRONT - 0.32);
    col("counter", COUNTER.x - 1.55, COUNTER.x + 1.55, COUNTER.z - 0.4, ZFRONT);
    rt.person("sheldon", SHELDON.key, { x: COUNTER.x + 0.2, z: COUNTER.z + 0.65, ry: Math.PI }, { name: SHELDON.name, colors: SHELDON.colors });
    const sign = canvasPlane(rt.set, 2.8, 0.7, (g, w, h) => { g.fillStyle = "#1A1033"; g.fillRect(0, 0, w, h); drawLines(g, "SHOES · LANES · SHELDON", w / 2, h / 2, Math.round(h / 3), "#FF4F9A", { maxW: w * 0.94 }); }, { px: 512 });
    sign.mesh.position.set(COUNTER.x, 2.7, ZFRONT - 0.12); sign.mesh.rotation.y = Math.PI; rt.add(sign.mesh);
    // the snack bar (Rivky) + the knish warmer + its menu
    K.box(0.7, 1.05, 2.4, "#00897B", SNACK.x, 0.52, SNACK.z).box(0.8, 0.06, 2.5, "#FFE082", SNACK.x, 1.07, SNACK.z);
    K.box(0.45, 0.35, 0.5, "#B0BEC5", SNACK.x, 1.27, SNACK.z - 0.6, { metal: 0.6 }).box(0.36, 0.06, 0.4, "#D4A055", SNACK.x, 1.2, SNACK.z - 0.6);
    col("snack", SNACK.x - 0.4, W, SNACK.z - 1.25, SNACK.z + 1.25);
    rt.person("rivky", RIVKY.key, { x: SNACK.x + 0.6, z: SNACK.z + 0.3, ry: -Math.PI / 2 }, { name: RIVKY.name, colors: RIVKY.colors });
    const menu = canvasPlane(rt.set, 2.2, 0.8, (g, w, h) => { g.fillStyle = "#FFF8E1"; g.fillRect(0, 0, w, h); drawLines(g, `🥔 KNISH · ${TUNE.knishPrice}\n(steadies the hand)`, w / 2, h / 2, Math.round(h / 4.2), "#BF360C", { maxW: w * 0.92 }); }, { px: 512 });
    menu.mesh.position.set(W / 2 - 0.12, 2.3, SNACK.z); menu.mesh.rotation.y = -Math.PI / 2; rt.add(menu.mesh);
    // the trophy case: glass, two shelves, a row of trophies — and the gap where 1994 was
    K.box(0.5, 2.0, 2.2, "#4E342E", CASE.x, 1.0, CASE.z).box(0.52, 1.5, 2.1, "#CFE8F2", CASE.x + 0.02, 1.15, CASE.z, { glass: true });
    for (const y of [0.85, 1.45]) K.box(0.4, 0.03, 2.0, "#8D6E63", CASE.x + 0.05, y, CASE.z);
    const slots = 7;
    for (let i = 0; i < slots; i++) for (const y of [0.87, 1.47]) {
        const z = CASE.z - 0.85 + i * (1.7 / (slots - 1));
        if (y > 1 && i === 3) continue;            // (1994)
        K.box(0.12, 0.04, 0.12, "#3E2723", CASE.x + 0.05, y + 0.03, z).box(0.04, 0.15, 0.04, "#FFD54F", CASE.x + 0.05, y + 0.12, z, { metal: 0.8, rough: 0.3 }).box(0.09, 0.06, 0.09, "#FFC107", CASE.x + 0.05, y + 0.22, z, { metal: 0.8, rough: 0.3 });
    }
    col("case", -W, CASE.x + 0.3, CASE.z - 1.15, CASE.z + 1.15);
    // (the 1994 trophy, back in its spot once she's brought it home)
    const back = new THREE.Group();
    const gold = rt.own(new THREE.MeshStandardMaterial({ color: "#FFC107", metalness: 0.85, roughness: 0.25 }));
    const t1 = new THREE.Mesh(rt.own(new THREE.BoxGeometry(0.05, 0.18, 0.05)), gold); t1.position.y = 0.12; back.add(t1);
    const t2 = new THREE.Mesh(rt.own(new THREE.SphereGeometry(0.07, 12, 8)), gold); t2.position.y = 0.25; back.add(t2);
    back.position.set(CASE.x + 0.05, 1.47, CASE.z - 0.85 + 3 * (1.7 / (slots - 1)));
    rt.add(back);
    rt.data.trophy = back;
    // the high scores board (her best, with her name)
    const hs = canvasPlane(rt.set, 1.8, 1.1, () => { }, { px: 512 });
    hs.mesh.position.set(-W / 2 + 0.12, 2.25, 2.6); hs.mesh.rotation.y = Math.PI / 2; rt.add(hs.mesh);
    rt.data.hiscore = hs;
    K.finish();
    rt.def.ceil = CEIL - 0.15;
}

function tick(rt, dt) {
    for (let k = 1; k < V.lanes.length; k++) tickLane(V.lanes[k], dt * (V.speed || 1));     // (tests: V.speed plays the lanes faster)
    tickHouse(rt, dt);
    if (V.tick) V.tick(rt, dt);
}

export const LANES_DEF = defineInterior({
    id: "lanes", name: NAME, short: "the lanes", emoji: "🎳", title: "🎳 EAST MIDWOOD LANES", model: "lanes_roomkit",
    tagline: "", models: ["npcWoman", "npcMan", "npcKid", "luluPerson"], light: "indoor", ceil: CEIL - 0.15,
    cam: { dist: 7.4, height: 4.4, lookY: 0.9, clampX: 2.2 }, walkSpeed: 3.4,
    build: r => { build(r); if (V.build) V.build(r); }, tick,
    dispose(r) { if (V.dispose) V.dispose(r); V.rt = null; V.house = []; },
});

export { drawBoard, kit, SHIMMY };
