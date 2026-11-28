// features/party — friends as REAL cars: Lulu's convertible in their own skin
// (opaque, shadows), wheels rolling + steering, the steering wheel turning,
// brake lights, nitro flames, a hand out of the window to wave when they honk,
// a nametag (👑 host · ✓ ready · ⏸ paused · 💤 away · 📶 lagging) and speech
// bubbles for the curated quick-chat / emotes.
//
// Motion: every remote car is drawn ~150 ms in the past (adaptive to the
// sender's packet rhythm + jitter) along the ROAD: s and d are Hermite-
// interpolated between snapshots using the speeds the sender reported (in
// metres per PARTY second, so it is right even when a slow device runs its
// game slower than real time). Past the newest snapshot it extrapolates for
// 0.3 s and then glides to a stop. Any discontinuity (a late packet, a
// correction, a shove that arrives as a jump) is absorbed into an error offset
// that decays in ~0.12 s but never closes faster than a slide (glideRate), so a
// car never pops; only a real respawn or a warp (> 60 m along / 30 m across)
// snaps — behind a sparkle poof.
//
// Performance: models are shared clones (cloneWithColors caches recoloured
// materials), one taillight material per car, canvas sprites redrawn only
// when their text changes, no per-frame allocations in the update path.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, cloneWithColors, findNodes, ensureModels, registerModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { SKINS, KITS } from "../../car.js";
import { makeDecor, attachToModel, animateDecor, disposeDecor, loadDecor } from "../garage/decor.js";
import { now, clock, N, fresh } from "./net.js";

const WHEEL_R = 0.34;

// ── shared bits ──────────────────────────────────────────────────────────
let flameTex = null;
function flameTexture() {
    if (flameTex) return flameTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,230,1)");
    grd.addColorStop(0.35, "rgba(255,170,40,0.9)");
    grd.addColorStop(1, "rgba(255,40,80,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    flameTex = new THREE.CanvasTexture(c);
    return flameTex;
}
let armGeo = null, handGeo = null, armMat = null, sleeveMat = null;
function armParts() {
    if (!armGeo) {
        armGeo = new THREE.CapsuleGeometry(0.075, 0.42, 4, 8); armGeo.translate(0, 0.28, 0);
        handGeo = new THREE.SphereGeometry(0.105, 10, 8); handGeo.translate(0, 0.6, 0);
        armMat = new THREE.MeshStandardMaterial({ color: "#F2C4A0", roughness: 0.7 });
        sleeveMat = new THREE.MeshStandardMaterial({ color: "#E91E63", roughness: 0.8 });
    }
    return { armGeo, handGeo, armMat, sleeveMat };
}

/** A skin's paint for {Body, BodyLight, BodyDark}. */
// ── another player's salon hairdo (features/cameos/salon.js: "sheitel" is the default and never sent) ──
// d.hs (EVERYONE) / the party profile's hs: the style's id. Her car gets the salon's hair piece (car-model space,
// like car.addHairStyle), her walking Lulu the style's own model; both load the first time someone needs them and
// show the default until then (whoever draws her rebuilds when the key below changes).
const STYLE_CAR = { bouncy: "cameos_hairBouncy", avigail: "cameos_hairAvigail" };
// (the same files the salon registers — here too, so another player's hairdo shows without the salon feature loaded)
registerModels({ cameos_hairBouncy: "cameos_hair_bouncy", cameos_hairAvigail: "cameos_hair_avigail", luluPerson_bouncy: "cameos_lulu_bouncy", luluPerson_avigail: "cameos_lulu_avigail" });
const styleTried = new Set();
const tryLoad = k => { if (!models[k] && !styleTried.has(k)) { styleTried.add(k); ensureModels([k]).catch(() => { }); } };
/** A bling decoration id she may send (garage DECOR ids), or null ("none" / junk). */
export const decorOk = v => typeof v === "string" && v !== "none" && /^[a-z0-9_]{1,16}$/.test(v) ? v : null;
let decorTried = false;
/** Is the decorations' model in (starts the load the first time someone needs it)? */
export function decorReady() {
    if (models.garageDecor) return true;
    if (!decorTried) { decorTried = true; loadDecor().catch(() => { }); }
    return false;
}
/** A style id she may send, or null (the default / junk). */
export const styleOk = v => typeof v === "string" && Object.prototype.hasOwnProperty.call(STYLE_CAR, v) ? v : null;
/** The walking Lulu's model key for a style: its own model once loaded (starts the load), else the default. */
export function personKey(style) {
    const s = styleOk(style);
    if (!s) return "luluPerson";
    const k = "luluPerson_" + s;
    tryLoad(k);
    return models[k] ? k : "luluPerson";
}
/** The car's hair piece for a style once loaded (starts the load), else null (the default sheitel shows). */
export function carHairKey(style) {
    const s = styleOk(style);
    if (!s) return null;
    tryLoad(STYLE_CAR[s]);
    return models[STYLE_CAR[s]] ? STYLE_CAR[s] : null;
}
export function skinColors(key) { const s = SKINS[key] || SKINS.pink; return { Body: s.body, BodyLight: s.light, BodyDark: s.dark }; }
export function skinHex(key) { return (SKINS[key] || SKINS.pink).body; }

// ── a canvas sprite whose text we redraw only when it changes ────────────
class Label {
    constructor(w, h, scale, order = 9) {
        this.c = document.createElement("canvas");
        this.c.width = w; this.c.height = h;
        this.tex = new THREE.CanvasTexture(this.c);
        this.tex.colorSpace = THREE.SRGBColorSpace;
        this.sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
        this.sp.renderOrder = order;
        this.base = scale;
        this.aspect = h / w;
        this.sp.scale.set(scale, scale * this.aspect, 1);
        this.key = null;
    }
    dispose() { this.sp.removeFromParent(); this.tex.dispose(); this.sp.material.dispose(); }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

/** Nametag: a dark pill with the player's colour dot, 👑 for the host, status badges. */
export class NameTag extends Label {
    constructor() { super(512, 112, 2.7); }
    set(name, color, o) {
        const host = !!(o && o.host), ready = !!(o && o.ready), status = (o && o.status) || "", me = !!(o && o.me);
        if (this.key && this.n === name && this.col === color && this.h === host && this.r === ready && this.st === status && this.me === me) return;
        this.key = true; this.n = name; this.col = color; this.h = host; this.r = ready; this.st = status; this.me = me;
        const g = this.c.getContext("2d");
        g.clearRect(0, 0, 512, 112);
        const text = (host ? "👑 " : "") + name + (status ? " " + status : ready ? " ✓" : "");
        g.font = "700 50px Fredoka, Arial, sans-serif";
        const tw = Math.min(470, g.measureText(text).width + 92);
        const x = 256 - tw / 2;
        g.fillStyle = me ? "rgba(233,30,99,0.92)" : "rgba(24,22,38,0.86)";
        roundRect(g, x, 12, tw, 82, 41); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 4; g.stroke();
        g.fillStyle = color; g.beginPath(); g.arc(x + 40, 53, 17, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 4; g.stroke();
        g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle";
        g.fillText(text, x + 66, 55, tw - 80);
        this.tex.needsUpdate = true;
    }
}

/** A speech bubble ("Follow me!") or a big emoji over a car. */
export class Bubble extends Label {
    constructor() { super(512, 200, 3.3, 10); this.sp.visible = false; this.life = 0; }
    show(text) {
        this.life = 2.6;
        this.sp.visible = true;
        if (text === this.key) return;
        this.key = text;
        const g = this.c.getContext("2d");
        g.clearRect(0, 0, 512, 200);
        const emoji = [...text].length <= 2;
        if (emoji) {
            g.font = "140px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
            g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(text, 256, 100);
        } else {
            g.font = "700 58px Fredoka, Arial, sans-serif";
            const tw = Math.min(490, g.measureText(text).width + 60);
            g.fillStyle = "#fff";
            roundRect(g, 256 - tw / 2, 20, tw, 120, 50); g.fill();
            g.beginPath(); g.moveTo(236, 138); g.lineTo(256, 182); g.lineTo(282, 138); g.fill();
            g.strokeStyle = "rgba(43,27,46,0.25)"; g.lineWidth = 5; roundRect(g, 256 - tw / 2, 20, tw, 120, 50); g.stroke();
            g.fillStyle = "#2b1b2e"; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(text, 256, 82, 470);
        }
        this.tex.needsUpdate = true;
    }
    update(dt, baseY) {
        if (this.life <= 0) { this.sp.visible = false; return; }
        this.life -= dt;
        const p = 1 - Math.max(0, this.life) / 2.6;
        const pop = p < 0.08 ? p / 0.08 : 1;
        this.sp.position.y = baseY + Math.min(0.4, p * 2);
        this.sp.material.opacity = (this.life < 0.4 ? Math.max(0, this.life / 0.4) : 1) * (this.fade == null ? 1 : this.fade);
        this.sp.scale.set(this.base * this.k * pop, this.base * this.aspect * this.k * pop, 1);
    }
}

// ── a car (used on the road, in the lobby and on the podium) ─────────────
export class CarVisual {
    constructor(skin = "pink") {
        this.root = new THREE.Group();
        this.tilt = new THREE.Group();
        this.root.add(this.tilt);
        this.wheels = [];
        this.taillights = [];
        this.roll = 0; this.steer = 0; this.pitch = 0; this.rollAng = 0;
        this.waveT = 0;
        this.setSkin(skin);
        // nitro flames
        const fm = new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
        this.flames = new THREE.Group();
        for (const x of [-0.42, 0.42]) { const s = new THREE.Sprite(fm); s.position.set(x, 0.45, -2.25); s.scale.set(0.55, 0.55, 1); this.flames.add(s); }
        this.flames.visible = false;
        this.flameMat = fm;
        this.tilt.add(this.flames);
    }
    setSkin(skin) {
        if (this.model && this.skin === skin) return;
        if (this.model) this.tilt.remove(this.model);
        if (this.ride) { this.ride.removeFromParent(); this.ride = null; this.rideKey = null; }
        for (const m of this.taillights) m.dispose();
        this.skin = SKINS[skin] ? skin : "pink";
        this.model = cloneWithColors(models.lulu, skinColors(this.skin));
        this.tilt.add(this.model);
        this.wheels = findNodes(this.model, "Wheel_").map(w => { w.rotation.order = "YXZ"; return { obj: w, front: /Wheel_F/.test(w.name) }; });
        this.sw = findNodes(this.model, "SteeringWheel")[0] || null;
        this.swBase = this.sw ? this.sw.quaternion.clone() : null;
        this.taillights = [];
        this.model.traverse(o => { if (o.isMesh && o.material.name === "Taillight") { o.material = o.material.clone(); this.taillights.push(o.material); } });
        // the default hairdo (setStyle below swaps in her salon style)
        const hairs = findNodes(this.model, "Hair_");
        const has = hairs.some(h => h.name.startsWith("Hair_sheitel"));
        for (const h of hairs) h.visible = has ? h.name.startsWith("Hair_sheitel") : h === hairs[0];
        this.hairMats = [];
        for (const h of hairs) h.traverse(o => { if (o.isMesh && o.material.name === "Hair") { o.material = o.material.clone(); this.hairMats.push(o.material); } });
        this.styleKey = null;                               // (the salon piece went with the old model: setStyle re-adds it)
        if (this.hairStyle) this.setStyle(this.hairStyle);
        this.decorKey = null;                               // (her bling too: setDecor re-adds it)
        if (this.decorId) this.setDecor(this.decorId);
        if (this.hairColor) this.setHair(this.hairColor, true);
        // the waving arm, at her outer shoulder
        const head = findNodes(this.model, "Anchor_head")[0];
        const hp = head ? head.getWorldPosition(new THREE.Vector3()).sub(this.model.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(0.38, 1.6, -0.1);
        const A = armParts();
        if (!this.arm) {
            this.arm = new THREE.Group();
            const a = new THREE.Mesh(A.armGeo, A.armMat), h = new THREE.Mesh(A.handGeo, A.armMat);
            a.castShadow = h.castShadow = true;
            this.arm.add(a, h);
            this.arm.visible = false;
        }
        this.arm.position.set(hp.x + 0.26, hp.y - 0.38, hp.z + 0.02);
        this.tilt.add(this.arm);
    }
    /** A borrowed ride (a jacked truck, a hotwired bus…): its model instead of the convertible. key null → her own car. */
    setRide(key, paint) {
        const k = key ? key + "|" + (paint || "") : null;
        if (k === this.rideKey) return;
        if (key && !models[key]) { if (!this.rideLoading) { this.rideLoading = true; ensureModels([key]).catch(() => { }).finally(() => { this.rideLoading = false; }); } return; }
        if (this.ride) { this.ride.removeFromParent(); this.ride = null; this.rideWheels = []; }
        this.rideKey = k;
        this.model.visible = !key;
        if (!key) return;
        this.ride = cloneWithColors(models[key], paint ? { Paint: paint } : null);
        for (const n of [...findNodes(this.ride, "Driver"), ...findNodes(this.ride, "Hair_")]) n.visible = false;
        this.rideWheels = findNodes(this.ride, "Wheel_").map(w => { w.rotation.order = "YXZ"; return w; });
        this.tilt.add(this.ride);
    }
    /** Her car the way she sees it: the skin's body kit (a Tushla in HER configuration, `ev` = [paint, wheels, interior]) +
     *  her condition (`cc` = [dirt 0..10, dents 0..3], car care). Rebuilds the model only when it changes. */
    setLook(ev, cc) {
        const ok = v => typeof v === "string" && /^[a-z0-9_]{1,16}$/.test(v);
        const E = Array.isArray(ev) && ev.length === 3 && ev.every(ok) ? ev : null;
        const C = Array.isArray(cc) && cc.length === 2 ? [Math.max(0, Math.min(10, cc[0] | 0)), Math.max(0, Math.min(3, cc[1] | 0))] : null;
        const key = this.skin + "|" + (E ? E.join(".") : "") + "|" + (C ? C.join(".") : "");
        if (key === this.lookKey) return;
        if (this.lookKey != null) { const sk = this.skin; if (this.model) this.tilt.remove(this.model); this.model = null; this.skin = null; this.setSkin(sk); if (this.hairColor) this.setHair(this.hairColor, true); }
        this.lookKey = key;
        const sk = SKINS[this.skin];
        if (sk && sk.kit && KITS[sk.kit]) {
            const anchors = {};
            this.model.traverse(o => { if (o.name && o.name.startsWith("Anchor_")) anchors[o.name.slice(7).replace(/\d+$/, "")] = o; });
            try {
                if (sk.kit === "tushla" && ctx.dealers && ctx.dealers.otherKit) ctx.dealers.otherKit(this.model, anchors, sk, E ? { paint: E[0], wheels: E[1], interior: E[2] } : null);
                else KITS[sk.kit](this.model, anchors, sk);
            } catch (e) { console.warn("[party] kit", sk.kit, e); }
        }
        if (C && (C[0] || C[1]) && ctx.carcare && ctx.carcare.dressOther) ctx.carcare.dressOther(this.model, C[0], C[1]);
    }
    /** Her salon hairdo (styleOk ids; null = the default sheitel). Cheap to call every frame: it rebuilds only when the
     *  style changes or its hair piece finishes loading. */
    setStyle(style) {
        const s = styleOk(style), hk = carHairKey(s), key = hk || "";
        this.hairStyle = s;
        if (key === this.styleKey) return;
        this.styleKey = key;
        if (this.styleObj) { this.styleObj.removeFromParent(); this.styleObj = null; }
        const hairs = findNodes(this.model, "Hair_");
        if (hk) {
            const obj = models[hk].clone(true);
            obj.name = "Hair_" + s;
            obj.traverse(o => { if (o.isMesh && o.material.name === "Hair") { o.material = o.material.clone(); this.hairMats.push(o.material); } });
            this.model.add(obj);
            this.styleObj = obj;
            for (const h of hairs) h.visible = false;
            if (this.hairColor) this.setHair(this.hairColor, true);
        } else {
            const has = hairs.some(h => h.name.startsWith("Hair_sheitel"));
            for (const h of hairs) h.visible = has ? h.name.startsWith("Hair_sheitel") : h === hairs[0];
        }
    }
    /** Her bling decoration (garage DECOR id; null = none) at its anchor, like her own car. Cheap every frame: it
     *  rebuilds only when the id changes or the decorations' model finishes loading. */
    setDecor(id) {
        const d = decorOk(id), key = d && decorReady() ? d : "";
        this.decorId = d;
        if (key === this.decorKey) return;
        this.decorKey = key;
        if (this.decorObj) { this.decorObj.removeFromParent(); disposeDecor(this.decorObj); this.decorObj = null; }
        if (!key) return;
        const obj = makeDecor(key);
        if (!obj) return;
        attachToModel(this.model, obj);
        if (obj.parent) this.decorObj = obj; else disposeDecor(obj);
    }
    setHair(color, force) {
        if (!color || (!force && color === this.hairColor)) return;
        this.hairColor = color;
        for (const m of this.hairMats || []) m.color.set(color);
    }
    /** Per frame: speed (m/s), steer −1..1, flags {brake, boost, wave}, accel/lat for body roll. */
    animate(dt, speed, steer, brake, boost, accel = 0, lat = 0) {
        if (this.decorObj) animateDecor(this.decorObj, dt, null);     // (the dice sway, the bow wobbles, neon pulses)
        this.steer += (steer - this.steer) * Math.min(1, dt * 10);
        this.roll += speed * dt / WHEEL_R;
        for (const w of this.wheels) {
            w.obj.rotation.x = this.roll;
            if (w.front) w.obj.rotation.y = -this.steer * 0.5 / (1 + Math.abs(speed) / 25);
        }
        if (this.ride) for (const w of this.rideWheels) w.rotation.x = this.roll;
        if (this.sw) { _q.setFromAxisAngle(_up, this.steer * 1.6); this.sw.quaternion.copy(this.swBase).multiply(_q); }
        for (const m of this.taillights) m.emissiveIntensity = brake ? 4.5 : 1.2;
        this.flames.visible = !!boost;
        if (boost) { const f = 0.75 + Math.random() * 0.5; for (const c of this.flames.children) c.scale.set(0.55 * f, 0.55 * f, 1); }
        const tp = THREE.MathUtils.clamp(-accel * 0.0035, -0.06, 0.05), tr = THREE.MathUtils.clamp(-lat * 0.0042, -0.07, 0.07);
        this.pitch += (tp - this.pitch) * Math.min(1, dt * 6);
        this.rollAng += (tr - this.rollAng) * Math.min(1, dt * 6);
        this.tilt.rotation.set(this.pitch, 0, this.rollAng);
        // wave
        if (this.waveT > 0) {
            this.waveT -= dt;
            this.arm.visible = true;
            this.arm.rotation.set(0, 0, -0.55 + Math.sin(this.waveT * 13) * 0.4);
        } else this.arm.visible = false;
    }
    wave(t = 1.3) { this.waveT = Math.max(this.waveT, t); }
    dispose() {
        this.root.removeFromParent();
        for (const m of this.taillights) m.dispose();
        this.flameMat.dispose();
        if (this.decorObj) disposeDecor(this.decorObj);
    }
}
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

// ── emoji pop (📣 on a honk) ─────────────────────────────────────────────
class Pop extends Label {
    constructor() { super(128, 128, 1.4, 11); this.sp.visible = false; this.life = 0; }
    show(e) {
        this.life = 1.1;
        if (this.key !== e) {
            this.key = e;
            const g = this.c.getContext("2d");
            g.clearRect(0, 0, 128, 128);
            g.font = "96px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
            g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e, 64, 70);
            this.tex.needsUpdate = true;
        }
    }
    update(dt, y, k) {
        if (this.life <= 0) { this.sp.visible = false; return; }
        this.life -= dt;
        const p = 1 - Math.max(0, this.life) / 1.1;
        const s = (1.2 + Math.sin(p * Math.PI) * 0.6) * k;
        this.sp.visible = true;
        this.sp.position.set(-1.1, y + p * 1.2, 0);
        this.sp.scale.set(s, s, 1);
        this.sp.material.opacity = Math.max(0, Math.min(1, 1.15 - p));
    }
}

// ── a friend on the road ─────────────────────────────────────────────────
export class RemoteCar {
    constructor(p) {
        this.uid = p.uid;
        this.v = new CarVisual(p.sk);
        this.tag = new NameTag();
        this.tag.sp.position.y = 2.6;
        this.bubble = new Bubble();
        this.pop = new Pop();
        this.v.root.add(this.tag.sp, this.bubble.sp, this.pop.sp);
        this.v.root.visible = false;
        ctx.scene.add(this.v.root);
        // interpolation state
        this.st = { init: false, rawS: 0, rawD: 0, vS: 0, vD: 0, errS: 0, errD: 0, lastT: 0, delay: 160, ivl: 143, jit: 20, lastSampleT: -1, lastArrive: 0 };
        this.out = { s: 0, d: 0, vs: 0, vd: 0, yaw: 0, steer: 0, y: 0, f: 0, extrap: 0 };
        this.s = 0; this.d = 0; this.x = 0; this.z = 0; this.h = 0; this.speed = 0; this.vx = 0; this.vz = 0;
        this.shown = false; this.honkWas = false; this.bonkCd = 0; this.bonking = false;
        this.foot = false; this.walker = null; this.walkerKey = ""; this.anim = 0;
        this.trace = null;
    }
    dispose() { this.tag.dispose(); this.bubble.dispose(); this.pop.dispose(); this.v.dispose(); }
}

/** Hermite sample of a player's track at party time T (ms). Returns false if there's nothing yet.
 *  free = a 2-D frame (s, d are plain world axes — a town's streets): no lateral clamp, d extrapolates like s. */
export function sampleTrack(S, T, o, free = false) {
    const n = S.length;
    if (!n) return false;
    const last = S[n - 1];
    if (n === 1 || T >= last.t) {
        // extrapolate: constant velocity for 0.3 s, then glide to a stop over 0.4 s
        const dt = Math.max(0, (T - last.t) / 1000);
        let e = dt, vk = 1;
        if (dt > 0.3) { const u = Math.min(1, (dt - 0.3) / 0.4); e = 0.3 + (1 - (1 - u) * (1 - u)) * 0.2; vk = 1 - u; }
        o.s = last.s + last.vs * e; o.d = last.d + last.vd * (free ? e : Math.min(e, 0.25));
        o.vs = last.vs * vk; o.vd = free ? last.vd * vk : dt > 0.25 ? 0 : last.vd;
        o.yaw = last.yaw; o.steer = last.steer; o.y = last.y; o.f = last.f; o.extrap = dt;
        return true;
    }
    let i = n - 2;
    while (i > 0 && S[i].t > T) i--;
    const a = S[i], b = S[i + 1];
    if (T <= a.t) { o.s = a.s; o.d = a.d; o.vs = a.vs; o.vd = a.vd; o.yaw = a.yaw; o.steer = a.steer; o.y = a.y; o.f = a.f; o.extrap = 0; return true; }
    const h = Math.max(0.001, (b.t - a.t) / 1000), u = (T - a.t) / (b.t - a.t);
    // a stretch that moves far more than the reported speeds allow (a shove, a pratfall, a teleport) isn't a curve to
    // draw: step to b at once — step()'s error offset absorbs it and glides it out (≤ glideRate), or snaps a real warp
    if (jumpy(b.s - a.s, a.vs, b.vs, h) || jumpy(b.d - a.d, a.vd, b.vd, h)) {
        o.s = b.s; o.d = b.d; o.vs = b.vs; o.vd = b.vd; o.yaw = b.yaw; o.steer = b.steer; o.y = b.y; o.f = b.f; o.extrap = 0;
        return true;
    }
    hermite(a.s, b.s, a.vs, b.vs, h, u, o, "s", "vs", !free);
    hermite(a.d, b.d, free ? a.vd : clampV(a.vd), free ? b.vd : clampV(b.vd), h, u, o, "d", "vd", false);
    o.yaw = a.yaw + (b.yaw - a.yaw) * u;
    o.steer = a.steer + (b.steer - a.steer) * u;
    o.y = a.y + (b.y - a.y) * u;
    o.f = u < 0.5 ? a.f : b.f;
    o.extrap = 0;
    return true;
}
const clampV = v => Math.max(-8, Math.min(8, v));
const jumpy = (dp, v0, v1, h) => Math.abs(dp) > (Math.max(Math.abs(v0), Math.abs(v1)) + 12) * h + 3;
function hermite(p0, p1, m0, m1, h, u, o, k, kv, mono) {
    const dp = p1 - p0;
    let t0 = m0 * h, t1 = m1 * h;
    if (mono) {
        // Fritsch–Carlson: no overshoot (a car never rolls backwards between two snapshots)
        if (Math.abs(dp) < 1e-6) { t0 = t1 = 0; }
        else {
            const al = t0 / dp, be = t1 / dp;
            if (al < 0) t0 = 0; if (be < 0) t1 = 0;
            const r = al * al + be * be;
            if (r > 9) { const tau = 3 / Math.sqrt(r); t0 *= tau; t1 *= tau; }
        }
    }
    const u2 = u * u, u3 = u2 * u;
    o[k] = (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * t0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * t1;
    o[kv] = ((6 * u2 - 6 * u) * p0 + (3 * u2 - 4 * u + 1) * t0 + (-6 * u2 + 6 * u) * p1 + (3 * u2 - 2 * u) * t1) / h;
}

// ── the manager: one RemoteCar per party member on the road ──────────────
export const cars = new Map();
const tmpP = {};
let lastClock = 0;

/** Called every frame while the party drives. show(p) → should this player's car be on the road?
 *  frameOf(p) → a road-like {point(s, d, out), free} this player's pose is in (null: the world's road). */
export function updateCars(dt, show, decorate, frameOf) {
    const road = ctx.world && ctx.world.road;
    if (!road) return;
    const T0 = clock();
    const dtParty = lastClock ? Math.max(0, Math.min(0.5, (T0 - lastClock) / 1000)) : dt;
    lastClock = T0;
    const cam = ctx.camera.position;
    for (const [uid, p] of N.players) {
        let rc = cars.get(uid);
        const want = show(p);
        if (!want) { if (rc) { rc.v.root.visible = false; rc.shown = false; rc.st.init = false; } continue; }
        if (!rc) { rc = new RemoteCar(p); cars.set(uid, rc); }
        if (rc.v.skin !== p.sk) rc.v.setSkin(p.sk);
        rc.v.setLook(p.x && Array.isArray(p.x.ev) ? p.x.ev : null, p.x && Array.isArray(p.x.cc) ? p.x.cc : null);
        if (p.hc) rc.v.setHair(p.hc);
        rc.v.setStyle(p.hs);
        rc.v.setDecor(p.dc);
        setForm(rc, p);
        if (emoteFn) { try { emoteFn(rc, p); } catch (e) { console.error("[party] emote", e); } }
        if (rc.emote) { rc.emote.t += dtParty; if (rc.emote.t > rc.emote.dur) rc.emote = null; }
        step(rc, p, dtParty, (frameOf && frameOf(p)) || road, cam);
        if (decorate) decorate(rc, p);
    }
    for (const [uid, rc] of cars) if (!N.players.has(uid)) { poof(rc); rc.dispose(); cars.delete(uid); }
}

// a jump bigger than this between snapshots is a real warp (a town cut, a teleport): snap with a poof
const WARP_S = 60, WARP_D = 30, HOP = 25;
// …and never more than this much correction in one frame, however long the frame (the party clock can catch up after a
// stall: a 0.16 s party step at 40 m/s was a 6.4 m one-frame jump on the passenger's screen)
const STEP_MAX = 3;
/** how fast an error is allowed to close (m/s): small ones as before, a big shove as a quick slide */
const glideRate = e => Math.min(40, 8 + 2 * e);
export const remoteTune = { WARP_S, WARP_D, HOP, glideRate };

function step(rc, p, dt, road, cam) {
    const st = rc.st, o = rc.out, S = p.samples;
    // adaptive delay: the sender's rhythm + jitter (ms), eased so render time never jumps
    if (S.length && S[S.length - 1].t !== st.lastSampleT) {
        const t = S[S.length - 1].t, w = now();
        if (st.lastSampleT >= 0) {
            const ivl = t - st.lastSampleT, arr = w - st.lastArrive;
            st.ivl += (Math.min(800, ivl) - st.ivl) * 0.15;
            st.jit += (Math.min(400, Math.abs(arr - ivl)) - st.jit) * 0.15;
        }
        st.lastSampleT = t; st.lastArrive = w;
    }
    const want = Math.max(150, Math.min(450, st.ivl * 1.1 + st.jit * 2 + 15));
    st.delay += (want - st.delay) * Math.min(1, dt * 1.5);
    const T = clock() - st.delay;
    if (!sampleTrack(S, T, o, !!road.free)) {
        // nothing streamed yet: a hello-only player waits invisibly
        rc.v.root.visible = false; rc.shown = false;
        return;
    }
    // smooth corrections (see the header) / snap only on a real respawn or warp: a shove (a pratfall, a bump) that arrives
    // as a jump between snapshots is absorbed into the error and glides out — never a teleport (ci/friends, qafriends)
    const expS = st.rawS + st.vS * dt, expD = st.rawD + st.vD * dt;
    let from = null;                 // a restart of the track (a respawn, a warp, a new frame at the town line, an unstuck rescue)
    if (!st.init || p.respawn || Math.abs(o.s - expS) > WARP_S || Math.abs(o.d - expD) > WARP_D) {
        // …where she was last drawn (a respawn hides the car a frame or two while its track refills): a short hop glides
        // there in world space below; a stale or far one snaps behind a poof
        // (also after a moment hidden — a wreck / pratfall can hide her a frame or two: init is reset, lastAt isn't)
        if (st.lastAt != null && clock() - st.lastAt < 1500) from = [st.lastX, st.lastZ];
        else { if (st.init) poof(rc); if (rc.trace) rc.trace.push({ T, snap: 1 }); }
        st.errS = st.errD = 0; st.init = true; p.respawn = false;
    } else {
        st.errS -= o.s - expS; st.errD -= o.d - expD;
    }
    // ease the error out (τ 0.12 s), but never faster than a slide: at most GLIDE m/s of correction (a slow page's long frame
    // would otherwise apply a whole 15 m correction at once)
    const k = Math.exp(-dt / 0.12), eMag = Math.hypot(st.errS, st.errD);
    if (eMag > 0) {
        const cut = Math.min(eMag * (1 - k), glideRate(eMag) * dt, STEP_MAX), f = (eMag - cut) / eMag;
        st.errS *= f; st.errD *= f;
    }
    if (Math.abs(st.errS) < 1e-4) st.errS = 0;
    if (Math.abs(st.errD) < 1e-4) st.errD = 0;
    st.rawS = o.s; st.rawD = o.d; st.vS = o.vs; st.vD = o.vd;
    const s = Math.max(0, o.s + st.errS), d = o.d + st.errD;
    road.point(s, d, tmpP);
    // her road FRAME changed on my screen (the highway ↔ a town's own grid at the town line, a zone switch): the same
    // (s, d) lands somewhere else — glide from where she was last drawn, like a restart
    if (!from && st.road && st.road !== road && st.lastAt != null && clock() - st.lastAt < 1500) from = [st.lastX, st.lastZ];
    st.road = road;
    // a restart close by (≤ HOP m — the town line's new frame, a small rescue) glides there in world space like any other
    // correction; a far one (a real warp) snaps behind a poof
    if (from) {
        const ox = from[0] - tmpP.x, oz = from[1] - tmpP.z;
        if (Math.hypot(ox, oz) <= HOP) { st.wx = ox; st.wz = oz; }
        else { st.wx = st.wz = 0; poof(rc); if (rc.trace) rc.trace.push({ T, snap: 1 }); }
    }
    const wMag = Math.hypot(st.wx || 0, st.wz || 0);
    if (wMag > 1e-3) {
        const cut = Math.min(wMag * (1 - k), glideRate(wMag) * dt, STEP_MAX), f = (wMag - cut) / wMag;
        st.wx *= f; st.wz *= f;
        tmpP.x += st.wx; tmpP.z += st.wz;
    } else st.wx = st.wz = 0;
    const h = tmpP.h + o.yaw;
    const sp = Math.hypot(o.vs, o.vd);
    const prevSpeed = rc.speed;
    rc.s = s; rc.d = d; rc.x = tmpP.x; rc.z = tmpP.z; rc.h = h; rc.speed = o.vs;
    st.lastX = tmpP.x; st.lastZ = tmpP.z; st.lastAt = clock();
    const fx = Math.sin(tmpP.h), fz = Math.cos(tmpP.h), rx = -Math.cos(tmpP.h), rz = Math.sin(tmpP.h);
    rc.vx = fx * o.vs + rx * o.vd; rc.vz = fz * o.vs + rz * o.vd;
    rc.v.root.position.set(tmpP.x, Math.max(0, o.y), tmpP.z);
    rc.v.root.rotation.y = h;
    const accel = dt > 0 ? (o.vs - prevSpeed) / dt : 0;
    const honk = !!(o.f & 4);
    if (rc.foot) animateWalker(rc, dt, sp, o, honk);
    else rc.v.animate(dt, sp * Math.sign(o.vs || 1), o.steer, !!(o.f & 1), !!(o.f & 2), accel, o.vs * o.steer * 0.4);
    rc.v.root.visible = true; rc.shown = true;
    // honk → 📣 + a wave + their horn when close
    if (honk && !rc.honkWas) { rc.pop.show("📣"); rc.v.wave(); rc.honked = true; }
    rc.honkWas = honk;
    // sprites stay readable at a distance — and get out of the way when a car is right by the camera
    const dist = Math.hypot(tmpP.x - cam.x, tmpP.z - cam.z);
    const kk = Math.max(1, Math.min(4, dist / 14));
    const near = Math.max(0, Math.min(1, (dist - 7) / 8));
    rc.tag.sp.scale.set(rc.tag.base * kk, rc.tag.base * rc.tag.aspect * kk, 1);
    rc.tag.sp.visible = dist < 320 && near > 0.02;
    rc.tag.sp.material.opacity = near;
    rc.tag.sp.position.y = (rc.foot ? 2.35 : 2.6) + (kk - 1) * 0.12;
    rc.bubble.k = Math.min(2.6, kk);
    rc.bubble.fade = 0.35 + 0.65 * near;
    rc.bubble.update(dt, 3.5 + (kk - 1) * 0.35);
    rc.pop.update(dt, 2.2, Math.min(2.5, kk));
    if (rc.bonkCd > 0) rc.bonkCd -= dt;
    if (rc.trace) rc.trace.push({ T: clock(), s, d, ex: o.extrap });
}

// ── a friend ON FOOT: a walking Lulu (their hair, a disguise), the car body hidden ──
// d.x.f = [anim, look]: anim 0 walk/run · 1 roll · 2 slide · 3 vault · 4 knocked flat · 5 dance (busk)
// · 6 wave · 7 busy (hotwire / interact) · 8 sit (sliding into a car) · 9 talk · 10 in the air (a jump); look 0 · 1 jumpsuit
// · 2 old lady · 3 old man; f[2] (optional) = her feet's height in decimetres (a jump, standing on a bench / a car roof)
export const LOOKS = [{}, { Top: "#FF6F00", Bottom: "#E65100" }, { Hair: "#CFCFCF", Top: "#C2185B", Bottom: "#8D6E63" }, { Hair: "#CFCFCF", Top: "#546E7A", Bottom: "#455A64" }];
const look0 = f => (f[1] | 0) === 0;
      // (her own clothes show only out of a disguise / the jumpsuit)
function setForm(rc, p) {
    const f = p.x && Array.isArray(p.x.f) ? p.x.f : null;
    const foot = !!f && !!models.luluPerson;
    if (foot) {
        const ot = !look0(f) || !ctx.clothes ? "" : (p.x && typeof p.x.ot === "string" ? p.x.ot.slice(0, 160) : "");
        const look = Math.max(0, Math.min(3, f[1] | 0)), pk = personKey(p.hs), key = look + "|" + (p.hc || "") + "|" + ot + "|" + pk;
        if (!rc.walker || rc.walkerKey !== key) {
            if (rc.walker) rc.walker.obj.removeFromParent();
            const colors = Object.assign(p.hc ? { Hair: p.hc } : {}, LOOKS[look]);
            rc.walker = spawnPerson(pk, { colors, outfit: ot ? ctx.clothes.decode(ot) : false });   // (her outfit: features/clothes)
            rc.walker.obj.rotation.order = "YXZ";
            rc.walker.obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
            rc.walkerKey = key;
            rc.v.root.add(rc.walker.obj);
        }
        // (what's in her hand / on her head — features/houseitems; not in a disguise / the jumpsuit)
        const hi = look0(f) && p.x && Array.isArray(p.x.hi) ? p.x.hi : null, idOk = v => typeof v === "string" && /^[a-z0-9_]{1,24}$/.test(v) ? v : null;
        if (ctx.houseitems && ctx.houseitems.dressOther) ctx.houseitems.dressOther(rc.walker, hi ? idOk(hi[0]) : null, hi ? idOk(hi[1]) : null);
        rc.anim = f[0] | 0;
        rc.footY = Math.max(0, Math.min(4, (f[2] | 0) / 10));
    }
    if (foot !== rc.foot) {
        rc.foot = foot;
        rc.v.tilt.visible = !foot;
        if (rc.walker) rc.walker.obj.visible = foot;
        rc.noBonkFoot = foot;
    }
    // a borrowed ride (d.x.v = [model key, paint])
    if (!foot) {
        const v = p.x && Array.isArray(p.x.v) && typeof p.x.v[0] === "string" && /^[a-z_0-9]{2,24}$/.test(p.x.v[0]) ? p.x.v : null;
        rc.v.setRide(v ? v[0] : null, v && typeof v[1] === "string" ? v[1].slice(0, 9) : null);
    }
}
function animateWalker(rc, dt, sp, o, honk) { if (rc.walker) poseWalker(rc, rc.walker, dt, sp, rc.anim, rc.footY, honk); }
/** Play a walking Lulu's foot code: st keeps the move's state (rollA, jy, emote); a = anim, footY = her feet's height (m).
 *  Shared by friends' walkers and everyone's (multiplayer/ghosts.js) — one look for the same move. */
export function poseWalker(st, w, dt, sp, a, footY, honk) {
    const rc = st, ob = w.obj;
    rc.footY = footY;
    const ease = k => Math.min(1, dt * k);
    let rx = 0;
    if (a === 1) { rc.rollA = (rc.rollA || 0) + dt * 12.5; rx = rc.rollA; }
    else { rc.rollA = 0; rx = a === 2 ? -1.05 : a === 4 ? -1.5 : sp > 5.3 ? 0.14 : 0; }
    ob.rotation.x = a === 1 ? rx : ob.rotation.x + (rx - ob.rotation.x) * ease(9);
    // her height rides in at ~10 Hz: ease toward it (a jump's arc, up on a bench / a car roof)
    rc.jy = (rc.jy || 0) + ((rc.footY || 0) - (rc.jy || 0)) * ease(14);
    ob.position.y = (a === 1 ? 0.45 * (1 - Math.cos(rc.rollA)) : 0) + rc.jy;
    const em = rc.emote && a === 0 ? rc.emote : null;                // an emote (emotes.js) plays over a plain walk
    if (em) {
        w.update(dt, Object.assign({ walk: sp }, em.pose));
        if (em.hop) ob.position.y += Math.abs(Math.sin(em.t * 7)) * em.hop;
        return;
    }
    w.update(dt, { walk: a === 0 || a === 3 ? sp : 0, dance: a === 5, wave: a === 6 || honk, point: a === 7, sit: a === 8, talk: a === 9, cheer: a === 3, air: a === 10 ? 1 : 0 });
}

// a friend's emote (emotes.js reads d.x.e and sets rc.emote = { i, t, dur, pose, hop })
let emoteFn = null;
export function setEmoteFn(fn) { emoteFn = fn; }

// a sparkle poof when a car (re)appears somewhere new
let poofFn = null;
export function setPoof(fn) { poofFn = fn; }
function poof(rc) { if (poofFn && rc.shown) { try { poofFn(rc.x, rc.z); } catch (e) { /* cosmetic */ } } }

export function hideCars() { for (const rc of cars.values()) { rc.v.root.visible = false; rc.shown = false; rc.st.init = false; } }
export function clearCars() { for (const rc of cars.values()) rc.dispose(); cars.clear(); }

/** Is this remote player's stream healthy right now? */
export function status(p) {
    if (p.f & 8) return "⏸";
    if (p.f & 16) return "💤";
    if (!fresh(p, 1200)) return "📶";
    return "";
}
