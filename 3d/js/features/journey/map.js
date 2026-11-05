// features/journey/map.js — THE ROAD TO VEGAS story map (src/05a-journey.js "storyMap").
// A dusk-lit tabletop diorama: a winding road with a marching gold centre line,
// the five stops as glowing pads with little versions of their real set pieces,
// Lulu's car idling at the NEXT stop, ⭐ for chapter tasks, 🔒 for locked legs.
// The chapter row underneath is a normal controller menu (D-pad ← → , ✕ drives
// that chapter, ○ back); the camera glides to whichever stop is focused.
import * as THREE from "three";
import { ctx, registerState, setState, css } from "../../core/ctx.js";
import { shared } from "../../core/save.js";
import { endRun } from "../../core/driving.js";
import { makeSet } from "../../core/sets.js";
import { models, ensureModels, cloneWithColors, instanced } from "../../models.js";
import { SKINS } from "../../car.js";
import { canvasTex } from "../../world.js";
import { glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import * as SFX from "./sfx.js";
import { STOPS, N_STOPS, STORY_BLURB, cycleMult, stopS, legStartS } from "./data.js";
import { startStory, J } from "./trip.js";
import { curStop } from "./state.js";

css("journey-map", `
.card.jmapc { width: min(980px, 100%); background: rgba(255,248,238,.93); align-self: flex-end; padding: 12px 18px 14px; }
.screen:has(.jmapc) { background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(43,27,46,.35)); align-items: flex-end; }
.jmap .hd { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
.jmap h2 { margin: 0; font-size: 24px; color: #5D4037; letter-spacing: .04em; }
.jmap .tour { background: #7B5E3B; color: #FFE082; border: 2px solid #FFD54F; border-radius: 999px; padding: 2px 12px; font-weight: 700; font-size: 13px; }
.jmap .blurb { font-style: italic; font-size: 14px; opacity: .75; margin: 2px 0 8px; }
.jmap .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.jm-node { border: none; border-radius: 16px; padding: 8px 6px 6px; background: #fff; cursor: pointer; font: 700 13px var(--font); color: var(--ink);
  display: flex; flex-direction: column; align-items: center; gap: 2px; box-shadow: 0 4px 0 rgba(0,0,0,.14); position: relative; transition: transform .08s; }
.jm-node .ic { font-size: 30px; line-height: 1.1; }
.jm-node .nm { font-size: 12px; letter-spacing: .03em; line-height: 1.1; min-height: 2.2em; display: flex; align-items: center; }
.jm-node .bd { font-size: 12px; min-height: 1.2em; }
.jm-node.done { background: #E8F5E9; }
.jm-node.current { background: #FFF8E1; box-shadow: 0 0 0 3px #FFD54F, 0 4px 0 rgba(0,0,0,.14); }
.jm-node.locked { background: #ECEFF1; color: #90A4AE; }
.jm-node.locked .ic { filter: grayscale(1); opacity: .5; }
.jm-node.focus { outline: 4px solid #fff; box-shadow: 0 0 0 7px rgba(233,30,99,.6), 0 4px 0 rgba(0,0,0,.14); transform: scale(1.05); }
.jm-node.deny { animation: jmShake .4s; }
.jm-node .next { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: #FFD54F; color: #3E2723; border-radius: 999px; font-size: 10px; padding: 1px 8px; letter-spacing: .08em; }
.jmap .info { background: #fff; border-radius: 16px; padding: 8px 14px; margin-top: 10px; text-align: left; display: flex; gap: 12px; align-items: center; min-height: 64px; }
.jmap .info .big { font-size: 34px; }
.jmap .info b { font-size: 16px; }
.jmap .info .tk { font-size: 14px; color: #607D8B; font-weight: 600; }
.jmap .info .tk.star { color: #B8860B; }
.jmap .info .st { font-size: 13px; font-weight: 700; }
.jmap .info .st.lock { color: #E57373; } .jmap .info .st.cur { color: #E6A700; } .jmap .info .st.done { color: #43A047; }
.jmapc .menu { margin-top: 8px; flex-direction: row; justify-content: center; }
.jmapc .menu .btn { width: auto; padding: 9px 22px; font-size: 16px; }
@keyframes jmShake { 0%, 100% { transform: none; } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@media (max-width: 640px) { .jmap .row { gap: 4px; } .jm-node .ic { font-size: 22px; } .jm-node .nm { font-size: 9.5px; } .jmap h2 { font-size: 19px; } .jmap .blurb { font-size: 12px; } .jmap .info { padding: 6px 10px; } .jmap .info .big { font-size: 26px; } }
@media (max-height: 520px) { .jmap .blurb { display: none; } .jm-node .ic { font-size: 22px; } .jmap .info { min-height: 0; margin-top: 6px; } }
body.tv .card.jmapc { width: min(1400px, 100%); } body.tv .jm-node .ic { font-size: 48px; } body.tv .jm-node .nm { font-size: 18px; }
body.tv .jmap h2 { font-size: 36px; } body.tv .jmap .info b { font-size: 24px; } body.tv .jmap .info .tk { font-size: 20px; }
`);

// node layout on the table (x right, z toward the camera): a winding S from
// Lakewood (front-left) to Vegas (back-right)
const NODES = [[-14, 6.5], [-4.5, 8.2], [-7.5, 0.2], [4.5, 1.5], [12.5, -6.8]];
const ROAD_PTS = [[-21, 10], ...NODES, [19, -11]];
const MINI = [
    { key: "bubbeHouse", scale: 0.12, off: [1.7, -1.4] },
    { key: "journey_pool", scale: 0.075, off: [1.9, -1.6] },
    { key: "journey_beach", scale: 0.075, off: [-2.0, -1.2] },
    { key: "journey_avigail_house", scale: 0.11, off: [1.9, -1.5] },
    { key: "journey_vegas", scale: 0.1, off: [-1.6, -1.8] },
];

export function nodeState(i, s2 = shared.get()) {
    const ss = s2.storyStop || 0, cyc = s2.storyCycle || 0;
    if (cyc > 0) return i === ss ? "current" : "done";
    if (i < ss) return "done";
    if (i === ss) return "current";
    return "locked";
}

let set = null;
const M = { pads: [], minis: [], stars: [], locks: [], ring: null, car: null, dash: null, look: new THREE.Vector3(), camPos: new THREE.Vector3(), t: 0, focus: 0, from: "title", denyT: 0, denyI: -1 };

function spriteText(text, { bg = "#FFD54F", fg = "#3E2723", w = 256, h = 96, font = 56, round = 40 } = {}) {
    const tex = canvasTex(w, h, (g) => {
        g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, round); g.fill();
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 ${font}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        g.fillText(text, w / 2, h / 2 + 3, w - 16);
    }, false);
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.scale.set(w / h * 0.6, 0.6, 1);
    set.own(tex, m);
    return s;
}
function starSprite() {
    const tex = canvasTex(64, 64, g => {
        g.fillStyle = "#FFD54F"; g.strokeStyle = "#B8860B"; g.lineWidth = 4;
        g.beginPath();
        for (let k = 0; k < 10; k++) { const r = k % 2 ? 13 : 28, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); }
        g.closePath(); g.fill(); g.stroke();
    }, false);
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    set.own(tex, m);
    const s = new THREE.Sprite(m); s.scale.set(0.9, 0.9, 1); return s;
}
function lockSprite() {
    const tex = canvasTex(64, 64, g => {
        g.strokeStyle = "#ECEFF1"; g.lineWidth = 7; g.beginPath(); g.arc(32, 26, 12, Math.PI, 0); g.stroke();
        g.fillStyle = "#ECEFF1"; g.beginPath(); g.roundRect(14, 26, 36, 28, 6); g.fill();
        g.fillStyle = "#607D8B"; g.beginPath(); g.arc(32, 38, 5, 0, 7); g.fill(); g.fillRect(30, 38, 4, 9);
    }, false);
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    set.own(tex, m);
    const s = new THREE.Sprite(m); s.scale.set(0.9, 0.9, 1); return s;
}

function buildSet() {
    set = makeSet({ light: "dusk", sky: "#3A2C4E", fog: [40, 110], fov: 42 });
    set.scene.background = set.own(canvasTex(16, 256, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, "#2A1E3F"); grd.addColorStop(0.45, "#7B4B57"); grd.addColorStop(1, "#C98A5A");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false));
    set.scene.fog.color.set("#8E5A5E");
    set.sun.position.set(-14, 22, 10);
    set.sun.intensity = 2.2;
    set.sun.color.set("#ffd2a0");
    Object.assign(set.sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22 });
    // the table: a painted map of the trip (suburb green → coast blue → dusk lilac → desert sand)
    const tex = set.own(canvasTex(1024, 640, (g, w, h) => {
        const grd = g.createLinearGradient(0, h, w, 0);
        grd.addColorStop(0, "#8DBF6A"); grd.addColorStop(0.28, "#A8D27C"); grd.addColorStop(0.42, "#E9D9A6");
        grd.addColorStop(0.58, "#D8B7C9"); grd.addColorStop(0.72, "#E7C089"); grd.addColorStop(1, "#C98A5A");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        // the ocean near the beach
        g.fillStyle = "#4FA9E0";
        g.beginPath(); g.ellipse(w * 0.17, h * 0.45, w * 0.13, h * 0.13, 0.3, 0, 7); g.fill();
        g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 6;
        g.beginPath(); g.ellipse(w * 0.17, h * 0.45, w * 0.13, h * 0.13, 0.3, 0, 7); g.stroke();
        for (let k = 0; k < 900; k++) {
            g.fillStyle = `rgba(${k % 2 ? "255,255,255" : "60,40,20"},0.06)`;
            g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 0, 7); g.fill();
        }
    }, false));
    const table = new THREE.Mesh(set.own(new THREE.BoxGeometry(48, 1, 30)), set.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })));
    table.position.y = -0.5;
    table.receiveShadow = true;
    set.add(table);
    const rim = new THREE.Mesh(set.own(new THREE.BoxGeometry(49.5, 1.2, 31.5)), set.own(new THREE.MeshStandardMaterial({ color: "#6D4C41", roughness: 0.7 })));
    rim.position.y = -0.75;
    set.add(rim);
    // the road ribbon + its dashed gold centre line
    const curve = new THREE.CatmullRomCurve3(ROAD_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "catmullrom", 0.5);
    const N = 220, pts = curve.getSpacedPoints(N);
    const ribbon = (half, y, vScale) => {
        const pos = [], uv = [], idx = [];
        let len = 0;
        for (let k = 0; k <= N; k++) {
            const p = pts[k], q = pts[Math.min(N, k + 1)], o = pts[Math.max(0, k - 1)];
            const tx = q.x - o.x, tz = q.z - o.z, L = Math.hypot(tx, tz) || 1;
            const nx = -tz / L, nz = tx / L;
            if (k) len += p.distanceTo(pts[k - 1]);
            pos.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
            uv.push(0, len / vScale, 1, len / vScale);
            if (k < N) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        gg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        gg.setIndex(idx);
        gg.computeVertexNormals();
        return set.own(gg);
    };
    const asphalt = new THREE.Mesh(ribbon(0.75, 0.02, 4), set.own(new THREE.MeshStandardMaterial({ color: "#2B3038", roughness: 0.85 })));
    asphalt.receiveShadow = true;
    set.add(asphalt);
    const dashTex = set.own(canvasTex(16, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#FFD54F"; g.fillRect(0, 0, w, h / 2); }));
    dashTex.repeat.set(1, 1);
    const dash = new THREE.Mesh(ribbon(0.07, 0.035, 1.2), set.own(new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, alphaTest: 0.5 })));
    set.add(dash);
    M.dash = dashTex;
    // pads, minis, markers
    M.pads = []; M.minis = []; M.stars = []; M.locks = []; M.nexts = [];
    const padGeo = set.own(new THREE.CylinderGeometry(1.0, 1.1, 0.22, 32));
    NODES.forEach(([x, z], i) => {
        const mat = set.own(new THREE.MeshStandardMaterial({ color: "#263238", roughness: 0.5, emissive: "#000000" }));
        const pad = new THREE.Mesh(padGeo, mat);
        pad.position.set(x, 0.11, z);
        pad.castShadow = pad.receiveShadow = true;
        set.add(pad);
        const ringMat = set.own(new THREE.MeshStandardMaterial({ color: "#66BB6A", emissive: "#66BB6A", emissiveIntensity: 0.6, roughness: 0.4 }));
        const ring = new THREE.Mesh(set.own(new THREE.TorusGeometry(1.08, 0.09, 8, 40).rotateX(Math.PI / 2)), ringMat);
        ring.position.set(x, 0.24, z);
        set.add(ring);
        const icon = spriteText(STOPS[i].icon.length ? ["BUBBE", "HESHY", "BEACH", "AVIGAIL", "VEGAS"][i] : "", { bg: "rgba(24,30,44,.85)", fg: "#FFF5E6", w: 320, h: 80, font: 44, round: 36 });
        icon.position.set(x, 0.75, z + 1.35);
        icon.scale.multiplyScalar(1.15);
        set.add(icon);
        const star = starSprite(); star.position.set(x - 0.9, 1.25, z); set.add(star);
        const lock = lockSprite(); lock.position.set(x, 1.0, z); set.add(lock);
        const next = spriteText("NEXT", { w: 200, h: 80, font: 50 }); next.position.set(x, 1.9, z); set.add(next);
        M.pads.push({ pad, mat, ring, ringMat, icon, x, z });
        M.stars.push(star); M.locks.push(lock); M.nexts.push(next);
    });
    // Lulu's car, parked at the NEXT stop
    const skin = SKINS[ctx.car.skinKey] || SKINS.pink;
    M.car = cloneWithColors(models.lulu, { Body: skin.body, BodyLight: skin.light, BodyDark: skin.dark });
    M.car.scale.setScalar(0.3);
    set.add(M.car);
    const glow = new THREE.Mesh(set.own(new THREE.CircleGeometry(1.4, 24).rotateX(-Math.PI / 2)),
        set.own(new THREE.MeshBasicMaterial({ color: "#FFE69A", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.position.y = 0.03;
    M.car.add(glow);
    glow.scale.setScalar(1 / 0.3);
    // twinkling stars in the dusk sky
    const sp = [];
    for (let k = 0; k < 90; k++) sp.push((Math.random() - 0.5) * 140, 22 + Math.random() * 30, -40 - Math.random() * 30);
    const sg = set.own(new THREE.BufferGeometry());
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    M.sky = new THREE.Points(sg, set.own(new THREE.PointsMaterial({ color: "#FFF8E1", size: 0.35, transparent: true, opacity: 0.8, fog: false })));
    set.add(M.sky);
    addMinis();
    addTrees(curve);
}

function addMinis() {
    MINI.forEach((mi, i) => {
        if (M.minis[i]) return;
        if (!models[mi.key]) return;
        const o = cloneWithColors(models[mi.key]);
        o.scale.setScalar(mi.scale);
        const [x, z] = NODES[i];
        o.position.set(x + mi.off[0], 0, z + mi.off[1]);
        o.rotation.y = 0.35;
        o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        set.add(o);
        M.minis[i] = o;
    });
}

function addTrees(curve) {
    // little trees by region: autumn near Lakewood, palms by the coast, cacti in the desert
    const near = (x, z) => { for (let k = 0; k <= 60; k++) { const p = curve.getPointAt(k / 60); if (Math.hypot(p.x - x, p.z - z) < 2.2) return true; } return false; };
    const groups = [
        { key: "treeRound", n: 22, x: [-22, -2], z: [3, 13], tint: "#E8833A", alt: "#C6452F" },
        { key: "journey_palm", n: 14, x: [-16, 2], z: [-5, 4] },
        { key: "treeRound", n: 10, x: [0, 9], z: [-3, 6], tint: "#5F9A4A" },
        { key: "journey_cactus", n: 16, x: [6, 22], z: [-13, -2] },
    ];
    for (const gdef of groups) {
        if (!models[gdef.key]) continue;
        const spots = [];
        for (let k = 0; k < gdef.n * 3 && spots.length < gdef.n; k++) {
            const x = gdef.x[0] + Math.random() * (gdef.x[1] - gdef.x[0]), z = gdef.z[0] + Math.random() * (gdef.z[1] - gdef.z[0]);
            if (near(x, z) || NODES.some(([nx, nz]) => Math.hypot(nx - x, nz - z) < 3.2)) continue;
            spots.push([x, z, 0.09 + Math.random() * 0.06]);
        }
        const tints = gdef.tint ? ["Leaves"] : [];
        const inst = instanced(models[gdef.key], spots.length, tints);
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
        spots.forEach(([x, z, s], k) => {
            q.setFromAxisAngle(up, Math.random() * 6.28);
            mtx.compose(v.set(x, 0, z), q, sc.setScalar(s));
            inst.set(k, mtx);
            if (gdef.tint) inst.color(k, "Leaves", col.set(k % 3 === 0 && gdef.alt ? gdef.alt : gdef.tint));
        });
        inst.finish();
        set.add(inst.group);
        set.own(inst);
    }
}

function refreshMarkers() {
    const s2 = shared.get();
    const stars = s2.storyStars || {};
    M.pads.forEach((p, i) => {
        const st = nodeState(i, s2);
        p.mat.color.set(st === "locked" ? "#37474F" : "#1E2733");
        p.ringMat.color.set(st === "current" ? "#FFD54F" : st === "done" ? "#66BB6A" : "#78909C");
        p.ringMat.emissive.set(st === "current" ? "#FFC107" : st === "done" ? "#43A047" : "#000000");
        M.stars[i].visible = !!stars[STOPS[i].id];
        M.locks[i].visible = st === "locked";
        M.nexts[i].visible = st === "current";
        if (M.minis[i]) M.minis[i].visible = true;
        if (M.minis[i]) M.minis[i].traverse(n => { if (n.isMesh) n.visible = true; });
    });
    const cur = (s2.storyStop || 0) % N_STOPS;
    const [x, z] = NODES[cur];
    M.car.position.set(x - 1.6, 0, z + 1.0);
    M.car.rotation.y = 2.3;
}

// ── the screen ────────────────────────────────────────────────────────────
function cardHtml() {
    const s2 = shared.get(), cyc = s2.storyCycle || 0, stars = s2.storyStars || {};
    const nodes = STOPS.map((st, i) => {
        const ns = nodeState(i, s2);
        const bd = `${stars[st.id] ? "⭐" : ""}${ns === "done" ? "✓" : ""}${ns === "locked" ? "🔒" : ""}`;
        return `<button class="jm-node nav ${ns}" id="jmN${i}" data-i="${i}">${ns === "current" ? '<span class="next">NEXT</span>' : ""}<span class="ic">${st.icon}</span><span class="nm">${st.name}</span><span class="bd">${bd || "&nbsp;"}</span></button>`;
    }).join("");
    return `<div class="jmap"><div class="hd"><h2>📖 THE ROAD TO VEGAS</h2>${cyc > 0 ? `<span class="tour">TOUR ${cyc + 1}</span>` : ""}</div>
        <p class="blurb">${STORY_BLURB}</p>
        <div class="row">${nodes}</div>
        <div class="info" id="jmInfo"></div>
        <p class="fine" style="margin:6px 0 0">${glyph("confirm")} drive that chapter · ⭐ = chapter task done${cyc > 0 ? " · tours pay more: ×" + (1 + 0.5 * Math.min(cyc, 4)) : ""}</p></div>`;
}
function infoHtml(i) {
    const s2 = shared.get(), st = STOPS[i], ns = nodeState(i, s2), starred = !!(s2.storyStars || {})[st.id];
    const mult = cycleMult(s2.storyCycle || 0);
    const mi = ((stopS(i, mult) - legStartS(i, mult)) / 1609).toFixed(1);
    const best = J.legBest[st.id];
    const stLine = ns === "locked" ? `<span class="st lock">🔒 finish earlier stops first</span>`
        : ns === "current" ? `<span class="st cur">NEXT — your checkpoint · ${glyph("confirm")} drive!</span>`
            : `<span class="st done">✓ reached — ${glyph("confirm")} drive it again</span>`;
    return `<span class="big">${st.icon}</span><div><b>LEG ${i + 1}/${N_STOPS} · ${st.name}</b> <span class="tk">· ${mi} mi${best ? ` · best ${Math.floor(best / 60)}:${String(Math.floor(best % 60)).padStart(2, "0")}` : ""}</span>
        <div class="tk${starred ? " star" : ""}">${starred ? "⭐" : "☆"} ${st.task}</div>${stLine}</div>`;
}

function launch(i) {
    const ns = nodeState(i);
    if (ns === "locked") {
        M.denyI = i; M.denyT = 0.4;
        const b = document.getElementById("jmN" + i);
        if (b) { b.classList.remove("deny"); void b.offsetWidth; b.classList.add("deny"); }
        H.toast("🔒 finish earlier stops first", "red");
        return;
    }
    H.hideScreen();
    if (M.from === "arrived") endRun("map");
    startStory(i);
}

function show() {
    const s2 = shared.get();
    const cur = (s2.storyStop || 0) % N_STOPS;
    const card = H.showScreen(cardHtml(), [{ label: `◀ Back ${glyph("back")}`, cls: "alt", action: back }],
        { wide: true, cls: "jmapc", focus: "jmN" + (M.focus != null ? M.focus : cur), onBack: back });
    card.querySelectorAll(".jm-node").forEach(b => b.addEventListener("click", () => launch(+b.dataset.i)));
    updateInfo(true);
}
function back() {
    H.hideScreen();
    if (M.from === "arrived") setState("arrivedScreen", { back: true });
    else setState("title");
}
let infoFor = -1;
function updateInfo(force) {
    const f = H.screenCard().querySelector(".jm-node.focus");
    if (f) M.focus = +f.dataset.i;
    if (!force && infoFor === M.focus) return;
    infoFor = M.focus;
    const el = document.getElementById("jmInfo");
    if (el) el.innerHTML = infoHtml(M.focus);
}

registerState("storyMap", {
    hud: false, touch: false, world: false,
    enter(data = {}) {
        M.from = data.from || "title";
        M.t = 0;
        const s2 = shared.get();
        M.focus = (s2.storyStop || 0) % N_STOPS;
        if (!set) buildSet();
        refreshMarkers();
        set.show();
        const [x, z] = NODES[M.focus];
        M.look.set(x, 0, z);
        M.camPos.set(x + 2, 13, z + 13);
        A.setMusic("../lulu.mp3");
        SFX.chime(523, 784);
        show();
        // the stop models load lazily; drop the minis in when they arrive
        ensureModels(MINI.map(m => m.key).concat(["journey_palm", "journey_cactus"])).then(() => { if (set) addMinis(); }).catch(() => {});
    },
    exit(next) {
        if (set) set.hide();
        H.hideScreen();
        if (next === "arrivedScreen") { const st = curStop(); if (st) A.setMusic(st.music); }
    },
    update(dt, P) {
        M.t += dt;
        H.menuInput(P);
        if (ctx.state !== "storyMap") return;
        updateInfo(false);
        const [x, z] = NODES[M.focus];
        M.look.lerp(new THREE.Vector3(x + 1.5, 0, z - 1.0), Math.min(1, dt * 3));
        const cam = set.camera;
        const portrait = cam.aspect < 1;
        const want = new THREE.Vector3(M.look.x - 1 + Math.sin(M.t * 0.15) * 1.2, portrait ? 21 : 12.5, M.look.z + (portrait ? 17 : 12.5));
        M.camPos.lerp(want, Math.min(1, dt * 2.5));
        cam.position.copy(M.camPos);
        cam.lookAt(M.look.x, 0, M.look.z + (portrait ? 3 : 2.2));
        // life: marching centre line, pulsing current pad, bobbing car, minis bob in when focused
        M.dash.offset.y = -M.t * 0.8;
        const s2cur = M.nexts.findIndex(n => n.visible);
        M.pads.forEach((p, i) => {
            const isCur = i === s2cur, isF = i === M.focus;
            p.ring.scale.setScalar(isCur ? 1 + Math.sin(M.t * 5) * 0.06 : 1);
            p.ringMat.emissiveIntensity = isCur ? 0.8 + Math.sin(M.t * 5) * 0.4 : 0.5;
            p.pad.position.x = p.x + (M.denyI === i && M.denyT > 0 ? Math.sin(M.denyT * 50) * 0.25 : 0);
            p.pad.position.y = 0.11 + (isF ? 0.12 + Math.sin(M.t * 4) * 0.04 : 0);
            if (M.minis[i]) M.minis[i].position.y = isF ? 0.08 + Math.sin(M.t * 3) * 0.05 : 0;
            M.nexts[i].position.y = 1.9 + Math.sin(M.t * 3) * 0.1;
        });
        if (M.denyT > 0) M.denyT -= dt;
        M.car.position.y = Math.abs(Math.sin(M.t * 2.4)) * 0.04;
        M.sky.material.opacity = 0.55 + Math.sin(M.t * 1.7) * 0.25;
    },
});

/** Open the story map. opts.from: "title" (back → title) | "arrived" (back → the arrival screen). */
export function openMap(opts = {}) { setState("storyMap", opts); }
ctx.journey.openMap = openMap;
