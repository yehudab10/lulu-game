// Shared Road — other players in the 3D world, drawn SOLID like friends (stage 3 of roadmap 25, "no ghosts", owner
// 2026-11-27): her own convertible in her paint + hair colour (party/remote.js' CarVisual, baked into one mesh)
// or a walking Lulu in her own outfit (d.hc / d.ot; an old client without them: a top in her skin colour). The file
// keeps its old name. Originally: other riders as translucent ghosts — their ride
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
import { CarVisual } from "../party/remote.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bakeGeometry } from "../../merge.js";

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
    if (p.m === 1) return "foot:" + p.sk + ":" + (p.hc || "") + ":" + (p.ot || "");
    if (!p.vk || p.vk === "car") return "car:" + p.sk + ":" + (p.hc || "");
    if (p.vk === "borrowed") return "borrowed:" + (p.ct || 0) + ":" + (p.co || "");
    if (p.vk === "cop" || EXTRA[p.vk]) return p.vk;
    return "car:" + p.sk;
}

// Another player's RIDE is baked into one solid vertex-coloured mesh (shared per model + paint + hair colour): 1 draw
// call instead of a model's ~22, so the nearest 6 on a busy road cost ~6 calls, not ~130 (a phone). Her paint, her
// hair colour and the visible hairdo are baked in; the wheels don't turn (hard to see at road speed). Glass is left out.
const MERGED = new Map();
let SOLID_MAT = null;
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4(), _cc = new THREE.Color();
const shownIn = (o, top) => { for (let x = o; x && x !== top; x = x.parent) if (!x.visible) return false; return true; };
function bakedRide(src, key) {
    let geo = MERGED.get(key);
    if (!geo) {
        if (!src) return null;
        src.updateMatrixWorld(true);
        _inv.copy(src.matrixWorld).invert();
        const list = [];
        src.traverse(o => {
            if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !shownIn(o, src) || !o.geometry || !o.geometry.attributes.position) return;
            const m = o.material;
            if (!m || Array.isArray(m) || m.map || !m.color || /Glass|Taillight/i.test(m.name || "") || m.transparent) return;
            list.push(bakeGeometry(o.geometry, _mm.multiplyMatrices(_inv, o.matrixWorld), _cc.copy(m.color)));
        });
        geo = list.length ? mergeGeometries(list, false) : null;
        for (const g of list) g.dispose();
        if (!geo) return null;
        geo.computeBoundingSphere();
        MERGED.set(key, geo);
    }
    if (!SOLID_MAT) SOLID_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, SOLID_MAT);
    mesh.castShadow = false; mesh.receiveShadow = false;
    return mesh;
}

function buildGhost(p) {
    const sk = SKINS[p.sk] || SKINS.pink;
    const g = { kind: kindOf(p), obj: new THREE.Group(), mats: [], wheels: [], person: null, burst: null, burstKey: "" };
    let body;
    if (p.m === 1) {
        // her own clothes (features/clothes) + hair; an old client sends neither: a top in her car's colour
        const ot = p.ot && ctx.clothes && ctx.clothes.decode ? p.ot : "";
        const colors = Object.assign(p.hc ? { Hair: p.hc } : {}, ot ? {} : { Top: sk.body });
        g.person = spawnPerson("luluPerson", { colors, outfit: ot ? ctx.clothes.decode(ot) : false });
        body = g.person.obj;
    } else {
        let src, key = g.kind;
        if (EXTRA[p.vk]) {
            const k = EXTRA[p.vk];
            if (models[k]) src = cloneWithColors(models[k]);
            else { ensureModels([k]).then(() => { if (ghosts[p.id]) ghosts[p.id].kind = "stale"; }).catch(() => {}); src = cloneWithColors(models.sedan, { Paint: "#F9A825" }); key += ":stand-in"; }
        } else if (p.vk === "cop") src = cloneWithColors(models.cop);
        else if (p.vk === "borrowed") src = cloneWithColors(models[BORROWED[(p.ct || 0) % BORROWED.length]], { Paint: p.co || "#E53935" });
        else if (!MERGED.has(key)) {
            // her own car: the friends' car visual (her skin, the shown hairdo, her hair colour), baked solid once per look
            const cv = new CarVisual(p.sk);
            if (p.hc) cv.setHair(p.hc);
            src = cv.model;
            const baked = bakedRide(src, key);
            cv.dispose();
            if (baked) body = baked;
        } else body = bakedRide(null, key);
        if (!body) body = bakedRide(src, key) || src;
        if (body === src) { src.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); g.wheels = findNodes(src, "Wheel_"); }
    }
    g.obj.add(body);
    g.body = body;
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

/** At most this many other riders are drawn at once — the nearest ones (see ARCHITECTURE › Everyone in one world):
 *  a ghost car is ~10 draw calls + a name sprite, so 6 keeps a busy road under ~70 extra calls on a phone. The
 *  rest cost nothing: no model, no sprite, until they're among the nearest. */
export const CAP = 6;
const KEEP = 3;                         // seconds a ghost that dropped out of the nearest few stays built (no churn)
let lastShown = 0;
export const ghostStats = () => {
    // (stage 3: no see-through bodies — count any shown body mesh that's still transparent)
    let seeThrough = 0;
    const kinds = [];
    for (const id in ghosts) {
        const g = ghosts[id];
        if (!g || !g.shown) continue;
        kinds.push(g.person ? "foot" : g.kind.split(":")[0]);
        g.body.traverse(o => { if (o.isMesh && o.visible && o.material && o.material.transparent && o.material.opacity < 0.9 && !/Glass|Flame/i.test(o.material.name || "")) seeThrough++; });
    }
    return { built: Object.keys(ghosts).length, shown: lastShown, cap: CAP, kinds, seeThrough };
};

/** Where to draw peer p (→ out {x, z, h}, or false). */
function placeOf(p, me, road, out) {
    const W = p.w && MP.clock - p.w.at < 4 ? p.w : null;
    if (W) {
        if (W.z === "~" || W.z !== me.zone) return false;
        if (W.z === "") {
            if (!road) return false;
            road.point(Math.max(1, W.ca), W.cb, tmp);
            out.x = tmp.x; out.z = tmp.z; out.h = tmp.h + (W.h || 0);
        } else {
            const T = ctx.town, O = T && T.active && T.plan && T.plan.ORIGIN;
            if (!O) return false;
            out.x = O.x + W.ca; out.z = O.z + W.cb; out.h = W.h || 0;
        }
        out.mps = Math.min(30, Math.hypot(W.va, W.vb));
        return true;
    }
    if (me.zone !== "" || !road) return false;          // a 2D rider is on the highway
    const s = Math.max(1, me.s + p.rel / DI_PER_M), d = (p.x - X_MID) / X_PER_M;
    road.point(s, d, tmp);
    out.x = tmp.x; out.z = tmp.z; out.h = tmp.h;
    out.mps = (p.sp || 0) / DI_PER_M;
    return true;
}

const near = [], at = {};
const LOT_R = 16;           // (m around the family house where strangers aren't drawn)
/** Ghosts are drawn while she's out in the world (driving or walking), not on the title or indoors. */
export function updateGhosts(dt, me, show) {
    const road = ctx.world && ctx.world.road;
    const camPos = ctx.camera.position;
    const T = MP.tag;
    // the nearest CAP riders in range (a little stickiness so two at the same distance don't flicker)
    near.length = 0;
    if (show) for (const id in MP.peers) {
        const p = MP.peers[id];
        p.onScreen = false;
        if (!p.seen || p.vis <= 0.01 || Math.abs(p.rel) / DI_PER_M >= VIS_M) continue;
        near.push([Math.abs(p.rel) * (ghosts[id] && ghosts[id].shown ? 0.85 : 1), id]);
    }
    else for (const id in MP.peers) MP.peers[id].onScreen = false;
    near.sort((a, b) => a[0] - b[0]);
    if (near.length > CAP) near.length = CAP;
    let shown = 0;
    for (const [, id] of near) {
        const p = MP.peers[id];
        if (!placeOf(p, me, road, at)) continue;
        // (roadmap 23: everyone's day starts on the same porch — strangers on Ima's lot aren't drawn: ctx.home.near)
        if (ctx.home && ctx.home.near && ctx.home.near(at.x, at.z, LOT_R)) continue;
        let g = ghosts[id];
        if (g && g.kind !== kindOf(p)) { disposeGhost(g); g = ghosts[id] = null; }
        if (!g) g = ghosts[id] = buildGhost(p);
        g.seenAt = MP.clock; g.mark = true;
        if (g.tagName !== p.name) { g.tag.removeFromParent(); g.tag.userData.dispose(); g.tag = nameSprite(p.name, 2.6); g.tag.position.y = p.m === 1 ? 2.35 : 2.75; g.obj.add(g.tag); g.tagName = p.name; }
        g.obj.visible = true; g.shown = true; p.onScreen = true; shown++;
        g.obj.position.set(at.x, 0, at.z);
        g.obj.rotation.y = at.h;
        p.ws = at.x; p.wd = at.z;
        const mps = at.mps;
        if (g.person) g.person.update(dt, { walk: Math.min(3, mps), wave: p.waveT > 0 });
        for (const w of g.wheels) w.rotation.x += mps * dt / 0.34;
        // (solid, like friends: no see-through fade — she's drawn once she's really there, gone once she isn't)
        g.obj.visible = p.vis > 0.35;
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
    lastShown = shown;
    for (const id of Object.keys(ghosts)) {
        const g = ghosts[id];
        if (g && g.mark) { g.mark = false; continue; }
        if (g) { g.obj.visible = false; g.shown = false; }
        if (!MP.peers[id] || !g || MP.clock - (g.seenAt || 0) > KEEP) { if (g) disposeGhost(g); delete ghosts[id]; }
    }
    updateSelf(dt, show);
}

/** Where a shown ghost's name tag is on screen (client px) + its half size, or null. */
export function tagOnScreen(id) {
    const g = ghosts[id], cam = ctx.camera, cv = ctx.renderer && ctx.renderer.domElement;
    if (!g || !g.shown || !g.obj.visible || !g.tag || !cam || !cv) return null;
    const R = cv.getBoundingClientRect();
    g.tag.getWorldPosition(v);
    const dist = v.distanceTo(cam.position);
    v.project(cam);
    if (v.z > 1 || v.z < -1 || dist < 0.5) return null;
    const ppu = R.height / (2 * dist * Math.tan((cam.fov || 60) * Math.PI / 360));
    return { x: R.left + (v.x + 1) / 2 * R.width, y: R.top + (1 - v.y) / 2 * R.height, hw: Math.max(28, g.tag.scale.x * 0.4 * ppu), hh: Math.max(14, g.tag.scale.y * 0.5 * ppu + 8) };
}
/** The ghost whose name tag is under a tap (client px) → its peer id, or null. */
export function ghostAt(cx, cy) {
    let best = null, bd = Infinity;
    for (const id in ghosts) {
        const s = tagOnScreen(id);
        if (!s) continue;
        const dx = Math.abs(cx - s.x), dy = Math.abs(cy - s.y);
        if (dx <= s.hw && dy <= s.hh && dx + dy < bd) { bd = dx + dy; best = id; }
    }
    return best;
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
