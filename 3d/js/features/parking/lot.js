// The 3D parking lot: a city street with a row of parallel-parking bays along
// the curb, parked cars, cones, sidewalk props, the security cameras that
// track Lulu, buildings, day/dusk/night lighting — and the dynamic bits (a
// pedestrian, passing traffic, the Boss Level sasquatch, dents, kids with ice
// cream, speech bubbles, the angry grandpa).
//
// COORDINATES. Everything is laid out in the 2D game's lot pixels (480 × 854
// canvas, curb line at y = 150, Lulu starting at (430, 470) facing left) and
// converted at PXM = 17 px per metre:  X = (x − 240) / 17,  Z = (y − 150) / 17.
// 2D heading `rot` (canvas radians) ↔ three.js heading h:  h = π/2 − rot.
// Keeping 2D's pixel layout means a Shared Road party sees the SAME lot (seeded
// by the room code) whether they're playing the 2D or the 3D game, and the
// `pk` poses they broadcast line up.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { makeSet, textPlane } from "../../core/sets.js";
import { models, registerModels, ensureModels, cloneWithColors, findNodes, instanced } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { PlayerCar, SKINS } from "../../car.js";

export const PXM = 17;
export const CAR_W2 = 46, CAR_H2 = 78, W2 = 480, H2 = 854;
export const lotX = x => (x - 240) / PXM;
export const lotZ = y => (y - 150) / PXM;
export const toX2 = X => X * PXM + 240;
export const toY2 = Z => Z * PXM + 150;
export const rotToH = rot => Math.PI / 2 - rot;
export const hToRot = h => Math.PI / 2 - h;

export const ENEMY_COLS = ["#2196F3", "#FF9800", "#9C27B0", "#26A69A", "#EF5350", "#5C6BC0"];
export const LEVEL_NAMES = ["DOWNTOWN BLOCK", "BUSY STREET", "TIGHT SQUEEZE", "CONE ZONE", "RUSH HOUR",
    "DUSK DRIVE", "TIGHT & DARK", "DIAGONAL DANGER", "MIDNIGHT PARK", "BOSS LEVEL"];
const SIGNS = ["LOT A", "P-2", "VISITOR", "2 HR MAX", "PAY HERE", "CUSTOMERS ONLY"];
const TINTS = ["rgba(120,140,90,0.10)", "rgba(90,110,140,0.10)", "rgba(140,110,90,0.10)", "rgba(110,110,120,0.08)", null];

registerModels({
    parking_camera: "parking_camera", parking_cone: "parking_cone", parking_lamp: "parking_lamp",
    parking_hydrant: "parking_hydrant", parking_mailbox: "parking_mailbox", parking_meter: "parking_meter",
    parking_signpost: "parking_signpost", parking_bollard: "parking_bollard", parking_planter: "parking_planter",
    parking_bldg_a: "parking_bldg_a", parking_bldg_b: "parking_bldg_b", parking_icecream: "parking_icecream",
    parking_angryman: "parking_angryman", parking_sasquatch: "parking_sasquatch",
});
const MODELS = ["parking_camera", "parking_cone", "parking_lamp", "parking_hydrant", "parking_mailbox", "parking_meter",
    "parking_signpost", "parking_bollard", "parking_planter", "parking_bldg_a", "parking_bldg_b", "parking_icecream",
    "parking_angryman", "parking_sasquatch", "sedan", "van", "treeRound", "npcWoman", "npcMan", "npcKid", "luluPerson"];

// ── level config (same numbers as src/03-art-parking-hud.js) ─────────────
export function levelConfig(level) {
    const spotW = Math.max(CAR_H2 + 22 - level * 2.2, CAR_H2 + 4);
    const theme = level <= 3 ? "day" : level <= 6 ? "dusk" : "night";
    return {
        level, spotWidth: spotW, theme,
        numCameras: Math.min(1 + Math.floor((level - 1) / 2), 3),
        timeLimit: Math.max(60 - level * 2.5, 25),
        coneInSpot: level >= 4, pedestrian: level >= 5, traffic: level >= 7,
        sasquatchWatcher: level === 10,
    };
}
export function casualConfig(theme = "day") {
    return { level: 0, spotWidth: CAR_H2 + 20, numCameras: 1 + Math.floor(Math.random() * 3), timeLimit: 60,
        theme, coneInSpot: false, pedestrian: false, traffic: false, sasquatchWatcher: false };
}

// ── layouts (ports of setupParkingScene / buildRoadsideParkingLayout) ────
/** Casual pull-over lot: 2–4 parked cars + the open bay, randomized by `rng`. */
export function roadsideLayout(rng, spotIndex, spotWidth) {
    const rf = () => rng();
    const rrange = (a, b) => a + rf() * (b - a);
    const rpick = arr => arr[Math.floor(rf() * arr.length)];
    const depth = CAR_W2 + 16;
    const rowY = Math.round(rrange(152, 196));
    const carsN = 2 + Math.floor(rf() * 3);
    const slots = carsN + 1;
    const parkedPitch = CAR_H2 + 6;
    const margin = 22;
    const rowW = carsN * parkedPitch + spotWidth;
    const slack = Math.max(0, (W2 - 2 * margin) - rowW);
    const side = Math.floor(rf() * 3);
    const startX = margin + (side === 0 ? 0 : side === 2 ? slack : slack / 2);
    const openIdx = ((Math.floor(rf() * slots) + (spotIndex || 0)) % slots + slots) % slots;
    let zone = null, cursor = startX;
    const cars = [];
    for (let s = 0; s < slots; s++) {
        if (s === openIdx) { zone = { x: cursor, y: rowY, w: spotWidth, h: depth }; cursor += spotWidth; }
        else { cars.push({ x: cursor + parkedPitch / 2, y: rowY + depth / 2, rot: 0, color: rpick(ENEMY_COLS) }); cursor += parkedPitch; }
    }
    const style = { tint: rpick(TINTS), sign: rpick(SIGNS) };
    return { zone, cars, style, rowY };
}
/** Challenge mode: the fixed, centred two-car bay. */
export function challengeLayout(spotWidth) {
    const zone = { x: 240 - spotWidth / 2, y: 168, w: spotWidth, h: CAR_W2 + 16 };
    const pick = () => ENEMY_COLS[Math.floor(Math.random() * ENEMY_COLS.length)];
    const cars = [
        { x: zone.x - CAR_H2 / 2 - 6, y: zone.y + zone.h / 2, rot: 0, color: pick() },
        { x: zone.x + zone.w + CAR_H2 / 2 + 6, y: zone.y + zone.h / 2, rot: 0, color: pick() },
    ];
    // fill the rest of the row with decorative parked cars (3D streets look empty otherwise)
    for (let x = cars[0].x - 84; x - 39 > 22; x -= 84) cars.push({ x, y: cars[0].y, rot: 0, color: pick(), deco: true });
    for (let x = cars[1].x + 84; x + 39 < W2 - 22; x += 84) cars.push({ x, y: cars[1].y, rot: 0, color: pick(), deco: true });
    return { zone, cars, style: null, rowY: zone.y };
}
/** 2D's carIsInZone: the car's centre inside the bay, 8 px in from its edges. */
export function centreInZone(zone, x2, y2) {
    return x2 > zone.x + 8 && x2 < zone.x + zone.w - 8 && y2 > zone.y + 8 && y2 < zone.y + zone.h - 8;
}

// ── textures ─────────────────────────────────────────────────────────────
function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4;
    return t;
}
function speckle(g, w, h, n, cols, r) {
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = Math.random() * r + 0.5; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
}
let TEX = null;
function textures() {
    if (TEX) return TEX;
    TEX = {
        asphalt: canvasTexture(256, 256, (g, w, h) => { g.fillStyle = "#6B7B8D"; g.fillRect(0, 0, w, h); speckle(g, w, h, 3200, ["#75859a", "#617081", "#7d8ca0", "#5a6878"], 2); }, [14, 12]),
        sidewalk: canvasTexture(256, 128, (g, w, h) => {
            g.fillStyle = "#BDBDBD"; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, ["#c7c7c7", "#b3b3b3"], 1.6);
            g.strokeStyle = "#9E9E9E"; g.lineWidth = 3;
            g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(1, 0); g.lineTo(1, h); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
        }, [8, 1]),
        oil: canvasTexture(128, 64, g => {
            g.fillStyle = "rgba(30,36,44,0.45)"; g.beginPath(); g.ellipse(56, 32, 46, 22, 0.2, 0, Math.PI * 2); g.fill();
            g.fillStyle = "rgba(30,36,44,0.3)"; g.beginPath(); g.ellipse(100, 40, 16, 9, 0, 0, Math.PI * 2); g.fill();
        }),
        scuff: canvasTexture(128, 64, g => {
            g.strokeStyle = "rgba(40,46,54,0.5)"; g.lineWidth = 7;
            g.beginPath(); g.moveTo(8, 22); g.quadraticCurveTo(64, 4, 120, 10); g.stroke();
            g.beginPath(); g.moveTo(8, 50); g.quadraticCurveTo(64, 32, 120, 38); g.stroke();
        }),
        patch: canvasTexture(64, 64, g => { g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(4, 4, 56, 56); g.strokeStyle = "rgba(20,20,20,0.15)"; g.lineWidth = 2; g.strokeRect(4, 4, 56, 56); }),
        dash: canvasTexture(64, 8, g => { g.fillStyle = "#fff"; g.fillRect(0, 0, 38, 8); }, [1, 1]),
        laser: canvasTexture(8, 64, g => { g.fillStyle = "#fff"; g.fillRect(0, 0, 8, 38); }, [1, 4]),
    };
    return TEX;
}
function gradientSky(top, bottom) {
    return canvasTexture(4, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, top); gr.addColorStop(1, bottom);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
}

/** A rounded speech bubble sprite ("YAY ICE CREAM!", "WHO TAUGHT YOU TO DRIVE!?"). */
export function bubbleSprite(text, { color = "#2b1b2e", bg = "#ffffff", w = 3.2 } = {}) {
    const lines = text.split("\n");
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96 + lines.length * 74;
    const g = c.getContext("2d");
    const H = c.height - 34;
    g.fillStyle = bg; g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 6;
    const r = 40;
    g.beginPath();
    g.moveTo(r + 6, 6); g.lineTo(506 - r, 6); g.quadraticCurveTo(506, 6, 506, 6 + r); g.lineTo(506, H - r);
    g.quadraticCurveTo(506, H, 506 - r, H); g.lineTo(290, H); g.lineTo(250, c.height - 4); g.lineTo(230, H);
    g.lineTo(6 + r, H); g.quadraticCurveTo(6, H, 6, H - r); g.lineTo(6, 6 + r); g.quadraticCurveTo(6, 6, 6 + r, 6); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 60px Fredoka, Arial, sans-serif";
    lines.forEach((t, i) => g.fillText(t, 256, 6 + (H - 6) * (i + 0.5) / lines.length, 470));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(w, w * c.height / 512, 1);
    sp.renderOrder = 10;
    sp.userData.dispose = () => { tex.dispose(); sp.material.dispose(); };
    return sp;
}
/** A dark nametag pill sprite (Shared Road party ghosts). */
export function nameSprite(name, w = 2.4) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const g = c.getContext("2d");
    g.font = "700 54px Fredoka, Arial, sans-serif";
    const tw = Math.min(480, g.measureText(name).width + 50);
    g.fillStyle = "rgba(24,22,38,0.85)";
    const x = 256 - tw / 2;
    g.beginPath(); g.roundRect ? g.roundRect(x, 10, tw, 76, 38) : g.rect(x, 10, tw, 76); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, 256, 50, 460);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(w, w * 96 / 512, 1);
    sp.renderOrder = 9;
    sp.userData.dispose = () => { tex.dispose(); sp.material.dispose(); };
    return sp;
}

// ── themes ───────────────────────────────────────────────────────────────
const THEMES = {
    day: { skyTop: "#8fd0ff", skyBot: "#FFE6A8", hemi: ["#fff4d6", "#6d7a55", 1.35], sun: ["#fff1dc", 2.6], sunPos: [-10, 22, -4],
        bldg: ["#5C6BC0", "#7986CB", "#3F51B5", "#9FA8DA", "#5C6BC0", "#7986CB"], window: null, lamps: 0, fog: "#FFE6A8" },
    dusk: { skyTop: "#5E35B1", skyBot: "#FF7043", hemi: ["#ffc7a8", "#5a4a6a", 1.05], sun: ["#ffb070", 1.7], sunPos: [-22, 9, 6],
        bldg: ["#311B92", "#4527A0", "#1A237E", "#311B92", "#4527A0", "#311B92"], window: "#FFE082", lamps: 0.6, fog: "#c9708a" },
    night: { skyTop: "#0D1B40", skyBot: "#1A237E", hemi: ["#5a6aa0", "#202030", 0.6], sun: ["#9fb0ff", 0.45], sunPos: [8, 20, -10],
        bldg: ["#1A237E", "#283593", "#0D1F47", "#1A237E", "#283593", "#1A237E"], window: "#FFD740", lamps: 1, fog: "#141d45" },
};
const AWNINGS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA"];

// ── the set ──────────────────────────────────────────────────────────────
let LOT = null;
export async function ensureLot() {
    await ensureModels(MODELS);
    if (!LOT) LOT = buildStatic();
    return LOT;
}
export function lotReady() { return !!LOT; }

function buildStatic() {
    const set = makeSet({ light: "day", sky: "#bfe3ff", fov: 50 });
    Object.assign(set.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
    set.sun.shadow.mapSize.set(1536, 1536);
    set.sun.target.position.set(0, 0, 12);
    const T = textures();
    const asphaltMat = set.own(new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.95, color: "#ffffff" }));
    const ground = new THREE.Mesh(set.own(new THREE.PlaneGeometry(110, 90)), asphaltMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 14);
    ground.receiveShadow = true;
    set.add(ground);
    // the 2D game's dashed road centre line (H * 0.55 → y 470)
    const dashGeo = set.own(new THREE.PlaneGeometry(1.2, 0.14));
    const lineMat = set.own(new THREE.MeshStandardMaterial({ color: "#F5F5DC", roughness: 0.6 }));
    const dashes = new THREE.InstancedMesh(dashGeo, lineMat, 40);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (let i = 0; i < 40; i++) dashes.setMatrixAt(i, m4.compose(new THREE.Vector3(-42 + i * 2.15, 0.015, lotZ(470)), q, new THREE.Vector3(1, 1, 1)));
    dashes.receiveShadow = true;
    set.add(dashes);
    const content = new THREE.Group();
    set.add(content);
    const lot = { set, content, asphaltMat, owned: [], stars: null, dashMat: lineMat };
    // far side of the street (sidewalk, curb, shops) — static
    const far = new THREE.Group();
    const FAR = 30.5;
    const farWalk = new THREE.Mesh(set.own(new THREE.BoxGeometry(110, 0.16, 5)),
        set.own(new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.9 })));
    farWalk.position.set(0, 0.08, FAR + 2.5);
    farWalk.receiveShadow = true;
    far.add(farWalk);
    const curbMat = set.own(new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.85 }));
    const farCurb = new THREE.Mesh(set.own(new THREE.BoxGeometry(110, 0.18, 0.3)), curbMat);
    farCurb.position.set(0, 0.09, FAR);
    far.add(farCurb);
    for (let i = -4; i <= 4; i++) {
        const b = cloneWithColors(models[i % 2 ? "parking_bldg_a" : "parking_bldg_b"], { Walls: ["#D7CCC8", "#BCAAA4", "#FFE0B2", "#C5CAE9", "#B2DFDB"][(i + 9) % 5],
            Awning: AWNINGS[(i + 9) % AWNINGS.length] });
        b.position.set(i * 9.6, 0, FAR + 9);
        b.rotation.y = Math.PI;
        far.add(b);
    }
    for (let i = -5; i <= 5; i++) {
        const t = cloneWithColors(models.treeRound);
        t.scale.setScalar(0.62 + (i & 1) * 0.08);
        t.position.set(i * 8 + 4, 0.15, FAR + 1.6);
        far.add(t);
    }
    set.add(far);
    // the bollards closing the street at the lot's ends (2D clamps x to 30..450)
    const nB = 2 * 18;
    const bol = instanced(models.parking_bollard, nB);
    let k = 0;
    for (const sx of [-1, 1]) for (let i = 0; i < 18; i++) {
        m4.makeTranslation(sx * 13.7, 0, 3.6 + i * 1.5);
        bol.set(k++, m4);
    }
    bol.finish();
    set.add(bol.group);
    for (const sx of [-1, 1]) for (const z of [1.2, 29.2]) {
        const p = cloneWithColors(models.parking_planter);
        p.position.set(sx * 13.9, 0, z);
        p.rotation.y = Math.PI / 2;
        set.add(p);
    }
    // stars (night)
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
        const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, r = 160;
        sp.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    lot.stars = new THREE.Points(set.own(sg), set.own(new THREE.PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false })));
    lot.stars.visible = false;
    set.add(lot.stars);
    // Lulu's car for the lot (her own skin + hair), reused every level
    lot.car = new PlayerCar(set.scene, ctx.car ? ctx.car.skinKey : "pink");
    lot.headlight = new THREE.SpotLight("#fff3c4", 0, 26, 0.55, 0.6, 1.2);
    lot.headlight.position.set(0, 0.8, 1.9);
    lot.headlight.target.position.set(0, 0, 9);
    lot.car.obj.add(lot.headlight, lot.headlight.target);
    lot.laserTex = T.laser;
    return lot;
}

// ── per-lot content ──────────────────────────────────────────────────────
function own(lot, ...things) { lot.owned.push(...things); return things[0]; }

/** Throw away the current level's objects (shared model geometry stays). */
export function clearLot(lot) {
    lot.content.traverse(o => { if (o.userData.dispose) o.userData.dispose(); });
    for (const o of lot.content.children.slice()) lot.content.remove(o);
    for (const t of lot.owned) if (t && t.dispose) t.dispose(); else if (t && t.userData && t.userData.dispose) t.userData.dispose();
    lot.owned.length = 0;
    clearDents(lot.car.tilt);
    lot.ghosts = {};
}

/**
 * Build a level. desc = { cfg, layout, theme, lotSign } (from index.js).
 * Returns the per-level runtime object (parked cars, cams, cone, ped…).
 */
export function buildLevel(lot, desc) {
    clearLot(lot);
    const { cfg, layout } = desc;
    const set = lot.set, G = lot.content;
    const th = THEMES[cfg.theme] || THEMES.day;
    const T = textures();
    const zone = layout.zone;
    const curbZ = lotZ(layout.rowY + 10);       // the near curb hugs the parking row
    const zx0 = lotX(zone.x), zx1 = lotX(zone.x + zone.w), zz0 = lotZ(zone.y), zz1 = lotZ(zone.y + zone.h);
    const L = { zone, curbZ, zx0, zx1, zz0, zz1, parked: [], cams: [], cones: [], lamps: [], dentsParked: [], traffic: [], trafficT: 3 };

    // lighting + sky
    set.scene.background = own(lot, gradientSky(th.skyTop, th.skyBot));
    set.hemi.color.set(th.hemi[0]); set.hemi.groundColor.set(th.hemi[1]); set.hemi.intensity = th.hemi[2];
    set.sun.color.set(th.sun[0]); set.sun.intensity = th.sun[1];
    set.sun.position.set(th.sunPos[0], th.sunPos[1], th.sunPos[2] + 12);
    set.scene.fog = new THREE.Fog(th.fog, 45, 120);
    lot.stars.visible = cfg.theme === "night";
    lot.headlight.intensity = cfg.theme === "night" ? 45 : cfg.theme === "dusk" ? 12 : 0;
    // ground tint (each casual lot feels a touch different)
    const tint = layout.style && layout.style.tint ? layout.style.tint.match(/\d+/g).slice(0, 3).map(Number) : null;
    lot.asphaltMat.color.set("#ffffff");
    if (tint) lot.asphaltMat.color.lerp(new THREE.Color(`rgb(${tint[0]},${tint[1]},${tint[2]})`), 0.28);
    if (cfg.theme === "night") lot.asphaltMat.color.multiplyScalar(0.8);

    // ── near side: curb, sidewalk, buildings, props ──
    const near = new THREE.Group();
    near.position.z = curbZ;
    G.add(near);
    const curbMat = own(lot, new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.85 }));
    const curb = new THREE.Mesh(own(lot, new THREE.BoxGeometry(110, 0.18, 0.32)), curbMat);
    curb.position.set(0, 0.09, -0.16); curb.receiveShadow = true; curb.castShadow = true;
    near.add(curb);
    const paint = new THREE.Mesh(own(lot, new THREE.BoxGeometry(110, 0.02, 0.12)), own(lot, new THREE.MeshStandardMaterial({ color: "#FBC02D", roughness: 0.6 })));
    paint.position.set(0, 0.19, -0.08);
    near.add(paint);
    const walkMat = own(lot, new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.9 }));
    const walk = new THREE.Mesh(own(lot, new THREE.BoxGeometry(110, 0.16, 5)), walkMat);
    walk.position.set(0, 0.08, -2.82); walk.receiveShadow = true;
    near.add(walk);
    const winCol = th.window;
    for (let i = -3; i <= 3; i++) {
        const key = i % 2 ? "parking_bldg_b" : "parking_bldg_a";
        const colors = { Walls: th.bldg[(i + 6) % th.bldg.length], Awning: AWNINGS[(i + 7) % AWNINGS.length] };
        if (winCol) colors.Window = winCol;
        const b = cloneWithColors(models[key], colors);
        if (winCol) b.traverse(o => { if (o.isMesh && o.material.name === "Window") { o.material.emissive.set(winCol); o.material.emissiveIntensity = cfg.theme === "night" ? 1.6 : 0.6; } });
        b.position.set(i * 9.4 + (i & 1 ? 0.6 : 0), 0, -9.0);
        near.add(b);
    }
    const prop = (key, x, z, ry = 0, s = 1) => { const o = cloneWithColors(models[key]); o.position.set(x, 0.16, z); o.rotation.y = ry; o.scale.setScalar(s); near.add(o); return o; };
    // the 2D sidewalk furniture, at the same x positions (lamp 70, hydrant 150, sign 232, mailbox 330, meter 430)
    for (const x of [lotX(70), lotX(330) + 3.2]) L.lamps.push(prop("parking_lamp", x, -0.9));
    prop("parking_hydrant", lotX(150), -0.7);
    const sign = prop("parking_signpost", lotX(232) - 2.1, -0.55);
    prop("parking_mailbox", lotX(330), -1.6);
    for (const x of [lotX(430), lotX(130) - 0.4, lotX(300)]) prop("parking_meter", x, -0.42);
    for (const x of [-16, 16.5]) { const t = prop("treeRound", x, -2.4, x, 0.58); t.position.y = 0.16; }
    const signTxt = layout.style && layout.style.sign ? "🅿 " + layout.style.sign : cfg.level ? `LEVEL ${cfg.level}` : "PARKING";
    const plate = textPlane([signTxt], { w: 0.88, h: 0.27, bg: "#0D47A1", fg: "#ffffff", font: 70 });
    own(lot, plate.material.map, plate.material, plate.geometry);
    const anc = findNodes(sign, "Anchor_sign")[0];
    if (anc) anc.add(plate); else { plate.position.set(0, 1.85, 0.1); sign.add(plate); }
    // street lamps glow at dusk / night
    for (const lp of L.lamps) {
        if (th.lamps > 0) {
            const pl = new THREE.PointLight("#ffe29a", 28 * th.lamps, 18, 1.6);
            const a = findNodes(lp, "Anchor_light")[0];
            (a || lp).add(pl);
            if (!a) pl.position.set(0, 4.4, 1);
        }
    }
    setLampGlow(th.lamps);

    // ── security cameras (pole base at the curb, head tracking Lulu) ──
    const camXs = [40, W2 / 2, W2 - 40];
    const idx = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, cfg.numCameras);
    for (const i of idx) {
        const cam = cloneWithColors(models.parking_camera);
        cam.position.set(lotX(camXs[i]) + (i === 1 ? 1.3 : 0), 0.16, -0.45);
        near.add(cam);
        const head = findNodes(cam, "CamHead")[0];
        if (head) head.rotation.order = "YXZ";
        // the tracking laser: a dashed red beam from the lens to the car
        const beamMat = own(lot, new THREE.MeshBasicMaterial({ color: "#ff3b30", map: lot.laserTex.clone(), transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        own(lot, beamMat.map);
        beamMat.map.wrapS = beamMat.map.wrapT = THREE.RepeatWrapping;
        beamMat.map.needsUpdate = true;
        const beamGeo = own(lot, new THREE.PlaneGeometry(0.06, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5));
        const beam = new THREE.Mesh(beamGeo, beamMat);
        const beam2 = new THREE.Mesh(beamGeo, beamMat);
        beam2.rotation.z = Math.PI / 2;
        beam.add(beam2);
        beam.renderOrder = 5;
        if (head) {
            head.updateMatrixWorld(true);
            beam.position.set(0, 0.04, 0.86);   // the lens, in the head's frame
            head.add(beam);
        }
        L.cams.push({ obj: cam, head, beam, beamMat, yaw: 0, pitch: 0.3 });
    }

    // ── painted bays ──
    const white = own(lot, new THREE.MeshStandardMaterial({ color: "#F5F5DC", roughness: 0.6 }));
    const flat = (w, d, mat, x, z, y = 0.012) => {
        const m = new THREE.Mesh(own(lot, new THREE.PlaneGeometry(w, d)), mat);
        m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; G.add(m); return m;
    };
    flat(0.12, zz1 - curbZ + 0.05, white, zx0, (curbZ + zz1) / 2);
    flat(0.12, zz1 - curbZ + 0.05, white, zx1, (curbZ + zz1) / 2);
    flat(28, 0.12, white, 0, zz1 + 0.06);                       // parking-lane edge line
    for (const c of layout.cars) {                               // T marks between the other bays
        for (const s of [-1, 1]) flat(0.1, 0.5, white, lotX(c.x + s * 42), zz1 - 0.2);
    }
    // the dashed outline of HER bay (yellow → green when she's in it)
    L.outlineMat = own(lot, new THREE.MeshStandardMaterial({ color: "#FFEB3B", emissive: "#FFEB3B", emissiveIntensity: 0.35, roughness: 0.5 }));
    const dGeo = own(lot, new THREE.PlaneGeometry(0.47, 0.11).rotateX(-Math.PI / 2));
    const per = [];
    const inset = 0.08, ax0 = zx0 + inset, ax1 = zx1 - inset, az0 = Math.max(curbZ + 0.08, zz0), az1 = zz1 - inset;
    for (let x = ax0; x < ax1 - 0.2; x += 0.82) { per.push([x + 0.235, az0, 0]); per.push([x + 0.235, az1, 0]); }
    for (let z = az0 + 0.3; z < az1 - 0.2; z += 0.82) { per.push([ax0, z + 0.235, 1]); per.push([ax1, z + 0.235, 1]); }
    const outline = new THREE.InstancedMesh(dGeo, L.outlineMat, per.length);
    per.forEach((p, i) => outline.setMatrixAt(i, m4b.compose(v3.set(p[0], 0.018, p[1]), qb.setFromEuler(eb.set(0, p[2] ? Math.PI / 2 : 0, 0)), one)));
    G.add(outline);
    // a bobbing "park here" chevron over the bay
    const chev = new THREE.Mesh(own(lot, new THREE.ConeGeometry(0.42, 0.8, 4)), L.outlineMat);
    chev.rotation.x = Math.PI;
    chev.position.set((zx0 + zx1) / 2, 2.4, (Math.max(curbZ, zz0) + zz1) / 2);
    G.add(chev);
    L.chevron = chev;

    // grime: oil stains, tyre scuffs and a repaved patch, seeded by the lot sign
    let seed = 7;
    const sgn = (layout.style && layout.style.sign) || "LEVEL" + cfg.level;
    for (let i = 0; i < sgn.length; i++) seed = (seed * 31 + sgn.charCodeAt(i)) & 0xffff;
    for (let gd = 0; gd < 7; gd++) {
        const gs = Math.imul(seed * (gd + 3), 2654435761) >>> 0;
        const gx = 30 + (gs % 1000) / 1000 * (W2 - 60), gy = 250 + ((gs >> 10) % 1000) / 1000 * (H2 - 470);
        const kind = gs % 3;
        const tex = kind === 0 ? T.oil : kind === 1 ? T.scuff : T.patch;
        const mat = own(lot, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: "#ffffff" }));
        const s = kind === 2 ? 2.2 + (gs % 30) / 20 : 2.6 + (gs % 14) / 10;
        const m = flat(s, s * (kind === 2 ? 0.7 : 0.5), mat, lotX(gx), Math.min(lotZ(gy), 28), 0.008 + gd * 0.0006);
        m.rotation.z = (gs % 62) / 10;
    }

    // ── parked cars ──
    for (const c of layout.cars) {
        const kind = "sedan";
        const obj = cloneWithColors(models[kind], { Paint: c.color });
        const h = rotToH(c.rot || 0) + (c.flip ? Math.PI : 0);
        obj.position.set(lotX(c.x), 0, lotZ(c.y));
        obj.rotation.y = h;
        G.add(obj);
        const fx = Math.sin(h), fz = Math.cos(h);
        const circles = [-1.45, 0, 1.45].map(o => ({ x: obj.position.x + fx * o, z: obj.position.z + fz * o, r: 0.9 }));
        L.parked.push({ obj, circles, x2: c.x, y2: c.y, dents: [], deco: !!c.deco });
    }

    // ── extras: cone in the bay, the pedestrian, traffic, the Boss Level sasquatch ──
    if (cfg.coneInSpot) {
        const cone = cloneWithColors(models.parking_cone);
        const cx = zone.x + zone.w / 2 + (Math.random() * 30 - 15), cy = zone.y + zone.h / 2 + (Math.random() * 20 - 10);
        cone.position.set(lotX(cx), 0, Math.max(curbZ + 0.4, lotZ(cy)));
        G.add(cone);
        L.cones.push({ obj: cone, r: 0.26, knocked: false, v: new THREE.Vector3(), spin: new THREE.Vector3(), rest: false });
    }
    if (cfg.pedestrian) {
        const key = ["npcWoman", "npcMan", "npcKid"][Math.floor(Math.random() * 3)];
        const p = spawnPerson(key, { colors: { Top: ["#E91E63", "#FFC107", "#43A047", "#2196F3", "#FF5722", "#9C27B0"][Math.floor(Math.random() * 6)] } });
        const dir = Math.random() < 0.5 ? 1 : -1;
        p.obj.position.set(-16 * dir, 0, zz1 + 0.9);
        p.obj.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        p.obj.visible = false;
        G.add(p.obj);
        L.ped = { person: p, dir, speed: 1.4 + Math.random() * 0.6, delay: 2 + Math.random() * 4, state: "walk", t: 0, fallT: 0 };
    }
    if (cfg.sasquatchWatcher) {
        const sq = spawnPerson("parking_sasquatch");
        sq.obj.position.set(-6.2, 0.16, curbZ - 2.2);
        G.add(sq.obj);
        L.sasquatch = sq;
    }
    L.trafficOn = !!cfg.traffic;
    return L;
}

const m4b = new THREE.Matrix4(), v3 = new THREE.Vector3(), qb = new THREE.Quaternion(), eb = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);

let lampGlowMat = null;
function setLampGlow(v) {
    if (!lampGlowMat && models.parking_lamp) models.parking_lamp.traverse(o => { if (o.isMesh && o.material.name === "LampGlow") lampGlowMat = o.material; });
    if (lampGlowMat) lampGlowMat.emissiveIntensity = 0.4 + v * 3;
}

let ledMats = null;
/** Blink every camera's LED + REC dot (shared materials → in sync, like 2D). */
export function blinkLeds(time) {
    if (!ledMats) {
        ledMats = [];
        if (models.parking_camera) models.parking_camera.traverse(o => { if (o.isMesh && /^LightRed/.test(o.material.name)) ledMats.push(o.material); });
    }
    const on = Math.sin(time * 6) > 0;
    for (const m of ledMats) m.emissiveIntensity = on ? 4 : 0.15;
}

// ── traffic (level 7+): cars passing on the far side of the street ──────
export function updateTraffic(lot, L, dt) {
    if (!L.trafficOn) return;
    L.trafficT -= dt;
    if (L.trafficT <= 0) {
        L.trafficT = 5 + Math.random() * 4;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const kind = Math.random() < 0.7 ? "sedan" : "van";
        const obj = cloneWithColors(models[kind], { Paint: ENEMY_COLS[Math.floor(Math.random() * ENEMY_COLS.length)] });
        obj.position.set(-40 * dir, 0, dir > 0 ? 22.6 : 26.4);
        obj.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        lot.content.add(obj);
        L.traffic.push({ obj, dir, speed: 8 + Math.random() * 3, wheels: findNodes(obj, "Wheel_"), len: kind === "van" ? 1.5 : 1.3 });
    }
    for (let i = L.traffic.length - 1; i >= 0; i--) {
        const t = L.traffic[i];
        t.obj.position.x += t.dir * t.speed * dt;
        for (const w of t.wheels) w.rotation.x += t.speed * dt / 0.34;
        if (Math.abs(t.obj.position.x) > 44) { lot.content.remove(t.obj); L.traffic.splice(i, 1); }
    }
}

// ── dents + scratches (the 2D damage decals, now on the actual bodywork) ──
const dentMats = {};
function dentMat(name, color, opts = {}) {
    return dentMats[name] || (dentMats[name] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 }, opts)));
}
const dentGeo = new THREE.CircleGeometry(1, 14);
const scratchGeo = new THREE.PlaneGeometry(1, 0.035);
const shardGeo = new THREE.CircleGeometry(1, 3);
/**
 * A dent at `world` on a car whose body group is `body` (half sizes hx, hz).
 * severity 0..1 grows the splotch; big hits get glass shards.
 */
export function addDent(body, world, severity, { hx = 0.9, hz = 2.05, y = 0.66 } = {}) {
    const local = body.worldToLocal(world.clone());
    const sideHit = Math.abs(local.x) / hx > Math.abs(local.z) / hz;
    const g = new THREE.Group();
    if (sideHit) { g.position.set(Math.sign(local.x) * (hx + 0.012), y, THREE.MathUtils.clamp(local.z, -hz + 0.25, hz - 0.25)); g.rotation.y = Math.sign(local.x) * Math.PI / 2; }
    else { g.position.set(THREE.MathUtils.clamp(local.x, -hx + 0.25, hx - 0.25), y - 0.08, Math.sign(local.z) * (hz + 0.04)); g.rotation.y = local.z > 0 ? 0 : Math.PI; }
    const size = 0.1 + severity * 0.22;
    const a = new THREE.Mesh(dentGeo, dentMat("dent", "#212121"));
    a.scale.set(size * 1.2, size, 1);
    const b = new THREE.Mesh(dentGeo, dentMat("dentIn", "#000000"));
    b.scale.set(size * 0.7, size * 0.5, 1); b.position.z = 0.002;
    g.add(a, b);
    const rot = Math.random() * 3;
    for (let s = 0; s < 3; s++) {
        const sc = new THREE.Mesh(scratchGeo, dentMat("scratch", "#FAFAFA", { roughness: 0.3 }));
        sc.scale.set(size * 2.1, 1, 1); sc.rotation.z = rot + s * 0.3 - 0.3; sc.position.z = 0.004;
        g.add(sc);
    }
    if (severity > 0.45) for (let k = 0; k < 4; k++) {
        const sh = new THREE.Mesh(shardGeo, dentMat("shard", "#B0E0FF", { roughness: 0.1, metalness: 0.3 }));
        sh.scale.setScalar(0.05 + Math.random() * 0.04); sh.rotation.z = Math.random() * 6;
        sh.position.set((Math.random() - 0.5) * size * 2, (Math.random() - 0.5) * size, 0.006);
        g.add(sh);
    }
    g.userData.dent = true;
    body.add(g);
    const list = body.userData.dents || (body.userData.dents = []);
    list.push(g);
    if (list.length > 8) body.remove(list.shift());
    return g;
}
export function clearDents(body) {
    for (const g of body.userData.dents || []) body.remove(g);
    body.userData.dents = [];
}

// ── Lulu's lot car ───────────────────────────────────────────────────────
/** Match the lot car to the road car (skin, hair, salon styles). */
export function syncLotCar(lot) {
    const car = lot.car, src = ctx.car;
    if (!src) return car;
    if (car.skinKey !== src.skinKey && SKINS[src.skinKey]) {
        for (const m of car.taillights || []) m.dispose();
        car.setSkin(src.skinKey);
    }
    for (const [style, obj] of Object.entries(src.extraHair || {})) {
        if (!(car.extraHair && car.extraHair[style])) car.addHairStyle(style, obj.clone(true));
    }
    if (src.hairColor || src.hairStyle) car.setHair(src.hairColor, src.hairStyle);
    car.showDriver(true);
    car.obj.visible = true;
    return car;
}

/** The two kids in the back with their ice creams (after a successful park). */
export function makeKids(lot) {
    if (lot.kids) return lot.kids;
    const k1 = spawnPerson("npcKid", { colors: { Hair: "#FFC107", Top: "#F06292", Bottom: "#7E57C2" }, scale: 0.72 });
    const k2 = spawnPerson("npcKid", { colors: { Hair: "#3E2723", Top: "#1976D2", Bottom: "#455A64" }, scale: 0.72 });
    k1.obj.position.set(-0.4, 0.42, -0.42);
    k2.obj.position.set(0.05, 0.63, -1.32);
    for (const k of [k1, k2]) {
        const arm = k.limbs.Arm_R;
        k.obj.updateMatrixWorld(true);
        if (arm && models.parking_icecream) {
            const box = new THREE.Box3().setFromObject(arm);
            const ice = cloneWithColors(models.parking_icecream, k === k2 ? { Scoop: "#FFFFFF" } : null);
            ice.scale.setScalar(1.5);
            arm.updateMatrixWorld(true);
            const tip = arm.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2));
            ice.position.copy(tip);
            ice.rotation.x = Math.PI;   // arms hang down → flip so the scoop is up when raised
            arm.add(ice);
        }
        k.obj.visible = false;
        lot.car.tilt.add(k.obj);
        k.obj.updateMatrixWorld(true);
    }
    lot.kids = [k1, k2];
    return lot.kids;
}

/** Party members parking in the same lot (Shared Road): translucent nametagged cars. */
export function updateLotGhosts(lot, list, time) {
    lot.ghosts = lot.ghosts || {};
    const seen = new Set();
    for (const p of list || []) {
        seen.add(p.id);
        let g = lot.ghosts[p.id];
        if (!g) {
            const sk = SKINS[p.sk] || SKINS.pink;
            const obj = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
            const mats = new Map();
            obj.traverse(o => {
                if (!o.isMesh) return;
                o.castShadow = false;
                let m = mats.get(o.material);
                if (!m) { m = o.material.clone(); m.transparent = true; m.opacity = 0.5; m.depthWrite = false; mats.set(o.material, m); }
                o.material = m;
            });
            const tag = nameSprite(p.name || "Rider");
            tag.position.y = 2.4;
            obj.add(tag);
            lot.content.add(obj);
            g = lot.ghosts[p.id] = { obj, tag, mats: [...mats.values()] };
            obj.userData.dispose = () => { for (const m of g.mats) m.dispose(); tag.userData.dispose(); };
        }
        g.obj.position.set(lotX(p.x), 0, lotZ(p.y));
        g.obj.rotation.y = rotToH(p.r || 0);
        g.obj.position.y = Math.sin(time * 3 + p.x) * 0.02;
    }
    for (const id of Object.keys(lot.ghosts)) {
        if (seen.has(id)) continue;
        const g = lot.ghosts[id];
        lot.content.remove(g.obj);
        g.obj.userData.dispose();
        delete lot.ghosts[id];
    }
}
