// The Parking Challenge's KIT: the ten levels' numbers, the challenge's bay layout, the speech-bubble / name sprites,
// dents on the bodywork and the security cameras' blinking LEDs. (The old separate roadside lot — its own set, sky,
// street and buildings — is gone: the challenge is played on a real lot in the world, course.js.)
//
// COORDINATES. Levels are laid out in the 2D game's lot pixels (480 × 854 canvas, curb line at y = 150) and
// converted at PXM = 17 px per metre:  X = (x − 240) / 17,  Z = (y − 150) / 17 — the course's LOCAL frame
// (course.js turns it into the world). 2D heading `rot` (canvas radians) ↔ local heading h:  h = π/2 − rot.
import * as THREE from "three";
import { models, registerModels } from "../../models.js";

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

registerModels({
    parking_camera: "parking_camera", parking_cone: "parking_cone", parking_lamp: "parking_lamp",
    parking_hydrant: "parking_hydrant", parking_mailbox: "parking_mailbox", parking_meter: "parking_meter",
    parking_signpost: "parking_signpost", parking_bollard: "parking_bollard", parking_planter: "parking_planter",
    parking_bldg_a: "parking_bldg_a", parking_bldg_b: "parking_bldg_b", parking_icecream: "parking_icecream",
    parking_angryman: "parking_angryman", parking_sasquatch: "parking_sasquatch",
});
export const MODELS = ["parking_camera", "parking_cone", "parking_angryman", "parking_sasquatch", "sedan", "van", "npcWoman", "npcMan", "npcKid"];

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
let LASER = null;
/** The security cameras' dashed tracking-laser texture. */
export function laserTex() {
    if (LASER) return LASER;
    const c = document.createElement("canvas");
    c.width = 8; c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 8, 38);
    LASER = new THREE.CanvasTexture(c);
    LASER.colorSpace = THREE.SRGBColorSpace;
    LASER.wrapS = LASER.wrapT = THREE.RepeatWrapping;
    LASER.repeat.set(1, 4);
    return LASER;
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
