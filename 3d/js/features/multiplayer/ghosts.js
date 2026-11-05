// Shared Road — other riders as translucent GHOSTS in the 3D world: their ride
// in their own skin colour (Lulu's convertible, a borrowed sedan / van / truck,
// a cop car, the school bus, an ambulance, the steamroller) or a walking Lulu
// when they're on foot — plus a nametag, emoji bursts (📣 honk, 👋 wave, the six
// emotes), the red TAG halo on whoever is IT, and the same halo / burst over
// Lulu's own car. Placed on the 3D road from the relayed 2D coordinates
// (see net.js for the scale).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, registerModels, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { SKINS } from "../../car.js";
import { MP, DI_PER_M, X_PER_M, X_MID, VIS_M } from "./net.js";
import { nameSprite } from "../parking/lot.js";

registerModels({
    multiplayer_bus: "multiplayer_bus", multiplayer_ambulance: "multiplayer_ambulance",
    multiplayer_dozer: "multiplayer_dozer", multiplayer_flag: "multiplayer_flag",
});
const EXTRA = { bus: "multiplayer_bus", ambulance: "multiplayer_ambulance", dozer: "multiplayer_dozer" };
const BORROWED = ["sedan", "sedan", "sedan", "van", "sedan", "van", "truck", "sedan", "van"];

const ghosts = {};
let self = null;
const tmp = {}, v = new THREE.Vector3();

function kindOf(p) {
    if (p.m === 1) return "foot:" + p.sk;
    if (p.vk === "borrowed") return "borrowed:" + (p.ct || 0) + ":" + (p.co || "");
    if (p.vk === "cop" || EXTRA[p.vk]) return p.vk;
    return "car:" + p.sk;
}

function ghostify(obj, tint) {
    const mats = [];
    const seen = new Map();
    obj.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = false; o.receiveShadow = false;
        let m = seen.get(o.material);
        if (!m) {
            m = o.material.clone();
            m.transparent = true;
            m.opacity = 0.55;
            m.depthWrite = true;
            if (m.emissive) { m.emissive.lerp(new THREE.Color(tint), 0.35); m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.35); }
            m.userData.baseOpacity = /Glass/.test(m.name) ? 0.25 : 0.55;
            seen.set(o.material, m);
            mats.push(m);
        }
        o.material = m;
        o.renderOrder = 2;
    });
    return mats;
}

function buildGhost(p) {
    const sk = SKINS[p.sk] || SKINS.pink;
    const g = { kind: kindOf(p), obj: new THREE.Group(), mats: [], wheels: [], person: null, burst: null, burstKey: "" };
    let body;
    if (p.m === 1) {
        g.person = spawnPerson("luluPerson", { colors: { Top: sk.body } });
        body = g.person.obj;
    } else if (EXTRA[p.vk]) {
        const key = EXTRA[p.vk];
        if (models[key]) body = cloneWithColors(models[key]);
        else { ensureModels([key]).then(() => { if (ghosts[p.id]) ghosts[p.id].kind = "stale"; }).catch(() => {}); body = cloneWithColors(models.sedan, { Paint: "#F9A825" }); }
    } else if (p.vk === "cop") body = cloneWithColors(models.cop);
    else if (p.vk === "borrowed") body = cloneWithColors(models[BORROWED[(p.ct || 0) % BORROWED.length]], { Paint: p.co || "#E53935" });
    else body = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
    g.obj.add(body);
    g.body = body;
    g.mats = ghostify(body, sk.body);
    g.wheels = findNodes(body, "Wheel_");
    for (const w of g.wheels) w.rotation.order = "YXZ";
    g.tag = nameSprite(p.name || "Rider", 2.6);
    g.tag.position.y = p.m === 1 ? 2.35 : EXTRA[p.vk] ? 3.9 : 2.75;
    g.obj.add(g.tag);
    g.tagName = p.name;
    // the TAG halo (hidden unless this peer is IT)
    g.ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.5, 40), new THREE.MeshBasicMaterial({ color: "#FF1744", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    g.ring.rotation.x = -Math.PI / 2;
    g.ring.position.y = 0.06;
    g.ring.visible = false;
    g.obj.add(g.ring);
    g.obj.visible = false;
    ctx.scene.add(g.obj);
    return g;
}

function disposeGhost(g) {
    ctx.scene.remove(g.obj);
    for (const m of g.mats) m.dispose();
    g.tag.userData.dispose();
    g.ring.geometry.dispose(); g.ring.material.dispose();
    if (g.burst) disposeBurst(g.burst);
}

// ── emoji bursts (canvas sprite, redrawn only when the emoji changes) ──────
function makeBurst() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.renderOrder = 11;
    return { sp, c, tex, emoji: "" };
}
function setBurst(b, emoji) {
    if (b.emoji === emoji) return;
    b.emoji = emoji;
    const g = b.c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.font = "96px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, 64, 70);
    b.tex.needsUpdate = true;
}
function disposeBurst(b) { b.sp.removeFromParent(); b.tex.dispose(); b.sp.material.dispose(); }
/** life 1.1 → 0 (like 2D mpDrawEmojiBurst): rise, pop, fade. */
function drawBurst(holder, g, emoji, life, baseY, scale = 1) {
    if (!emoji || life <= 0) { if (g.burst) g.burst.sp.visible = false; return; }
    if (!g.burst) { g.burst = makeBurst(); holder.add(g.burst.sp); }
    setBurst(g.burst, emoji);
    const p = Math.max(0, Math.min(1, 1 - life / 1.1));
    const s = (1.3 + Math.sin(p * Math.PI) * 0.6) * scale;
    g.burst.sp.visible = true;
    g.burst.sp.position.set(0, baseY + p * 1.4, 0);
    g.burst.sp.scale.set(s, s, 1);
    g.burst.sp.material.opacity = Math.max(0, Math.min(1, 1.15 - p));
}

/** Ghosts are drawn while a run is on screen (driving or walking), not on the title. */
export function updateGhosts(dt, me, show) {
    const road = ctx.world && ctx.world.road;
    const camPos = ctx.camera.position;
    const T = MP.tag;
    for (const id in MP.peers) {
        const p = MP.peers[id];
        let g = ghosts[id];
        if (g && g.kind !== kindOf(p)) { disposeGhost(g); g = ghosts[id] = null; }
        if (!g) g = ghosts[id] = buildGhost(p);
        if (g.tagName !== p.name) { g.tag.removeFromParent(); g.tag.userData.dispose(); g.tag = nameSprite(p.name, 2.6); g.tag.position.y = p.m === 1 ? 2.35 : 2.75; g.obj.add(g.tag); g.tagName = p.name; }
        const ds = p.rel / DI_PER_M;
        const vis = show && road && p.seen && Math.abs(ds) < VIS_M && p.vis > 0.01;
        g.obj.visible = !!vis;
        p.onScreen = !!vis;
        if (!vis) continue;
        const s = Math.max(1, me.s + ds), d = (p.x - X_MID) / X_PER_M;
        road.point(s, d, tmp);
        g.obj.position.set(tmp.x, 0, tmp.z);
        g.obj.rotation.y = tmp.h;
        p.ws = s; p.wd = d;
        const mps = (p.sp || 0) / DI_PER_M;
        if (g.person) g.person.update(dt, { walk: Math.min(3, mps), wave: p.waveT > 0 });
        for (const w of g.wheels) w.rotation.x += mps * dt / 0.34;
        // fade in/out + a gentle shimmer
        const op = p.vis * (0.85 + Math.sin(MP.clock * 3 + id.charCodeAt(0)) * 0.08);
        for (const m of g.mats) m.opacity = m.userData.baseOpacity * op;
        // nametag stays readable at distance
        const dist = v.copy(g.obj.position).distanceTo(camPos);
        const k = Math.max(1, Math.min(6, dist / 15));
        g.tag.scale.set(2.6 * k, 2.6 * k * 96 / 512, 1);
        g.tag.material.opacity = p.vis;
        // emoji bursts: emote > honk > wave
        const em = p.emT > 0 ? [p.emEmoji || "❤️", p.emT] : p.honkT > 0 ? ["📣", p.honkT] : p.waveT > 0 ? ["👋", p.waveT] : null;
        drawBurst(g.obj, g, em && em[0], em ? em[1] : 0, g.tag.position.y + 0.6 * k, Math.min(3, k));
        // TAG halo
        const isIt = T && !T.over && !T.itIsMe && T.itPeer === id;
        g.ring.visible = !!isIt;
        if (isIt) { const hp = 0.5 + 0.5 * Math.sin(MP.clock * 7); g.ring.scale.setScalar(1 + hp * 0.15); g.ring.material.opacity = 0.35 + 0.4 * hp; }
    }
    for (const id of Object.keys(ghosts)) if (!MP.peers[id]) { if (ghosts[id]) disposeGhost(ghosts[id]); delete ghosts[id]; }
    updateSelf(dt, show);
}

export function clearGhosts() {
    for (const id of Object.keys(ghosts)) { if (ghosts[id]) disposeGhost(ghosts[id]); delete ghosts[id]; }
}

// my own IT halo + emote burst over Lulu's car
function updateSelf(dt, show) {
    const car = ctx.car;
    if (!car) return;
    if (!self) {
        self = { obj: new THREE.Group(), burst: null };
        self.ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.65, 40), new THREE.MeshBasicMaterial({ color: "#FF1744", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
        self.ring.rotation.x = -Math.PI / 2;
        self.ring.position.y = 0.07;
        self.obj.add(self.ring);
        self.itTag = nameSprite("🏷 IT", 1.4);
        self.itTag.position.y = 3.0;
        self.obj.add(self.itTag);
        ctx.scene.add(self.obj);
    }
    self.obj.position.set(car.pos.x, 0, car.pos.z);
    const T = MP.tag, it = show && T && !T.over && T.itIsMe;
    self.ring.visible = self.itTag.visible = !!it;
    if (it) { const hp = 0.5 + 0.5 * Math.sin(MP.clock * 7); self.ring.scale.setScalar(1 + hp * 0.12); self.ring.material.opacity = 0.35 + 0.4 * hp; }
    const b = MP.myBurst;
    drawBurst(self.obj, self, show && b ? b.emoji : null, b ? b.t : 0, 2.9, 1.5);
}
