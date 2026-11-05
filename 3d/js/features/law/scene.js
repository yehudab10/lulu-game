// features/law — little helpers the law scenes share: game-time async flows
// (sleep / until, cancelled when the state exits), people with safe fallbacks,
// walking, eased camera shots, handcuffs, dialogue speakers, and getting the
// driving world quiet for a roadside cutscene.
import * as THREE from "three";
import { ctx, wrapAngle } from "../../core/ctx.js";
import { models, cloneWithColors } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say as dlgSay, choose as dlgChoose, closeDialog, isOpen } from "../../core/dialog.js";
import { SPEAKERS } from "./data.js";
import * as X from "./sfx.js";

export const JUMPSUIT = { Top: "#FF6D2E", Bottom: "#FF6D2E" };

// ── flows ────────────────────────────────────────────────────────────────
/** An async script that runs on game time. Every await checks f.alive. */
export class Flow {
    constructor() { this.alive = true; this.timers = []; this.skip = false; }
    sleep(sec, skippable = false) { return new Promise(r => this.timers.push({ t: sec, r, skippable, pred: null })); }
    until(pred, max = 30) { return new Promise(r => this.timers.push({ t: max, r, pred })); }
    tick(dt, P = {}) {
        const skip = !!(P.confirm || P.interact || P.start);
        for (const w of this.timers.slice()) {
            w.t -= dt;
            let done = w.t <= 0 || (w.skippable && skip);
            if (!done && w.pred) { try { done = !!w.pred(); } catch (e) { done = true; } }
            if (done) { this.timers.splice(this.timers.indexOf(w), 1); w.r(); }
        }
    }
    kill() { this.alive = false; for (const w of this.timers) w.r(); this.timers.length = 0; if (isOpen()) closeDialog(); }
}
export class Dead extends Error {}
/** Run fn(flow); "Dead" (the state left mid-script) is swallowed. */
export function runFlow(fn) {
    const f = new Flow();
    Promise.resolve().then(() => fn(f)).catch(e => { if (!(e instanceof Dead)) console.error("[law flow]", e); });
    return f;
}
export function check(f) { if (!f.alive) throw new Dead(); }

/** A speaker's line through the core dialogue box (auto-advances after `auto` s). */
export async function line(f, who, text, opts = {}) {
    check(f);
    const sp = SPEAKERS[who] || { name: who, emoji: "💬", color: "#555" };
    if (opts.onStart) opts.onStart();
    X.blip(who);
    await dlgSay(opts.name || sp.name, text, { emoji: opts.emoji || sp.emoji, color: sp.color, auto: opts.auto != null ? opts.auto : 0 });
    check(f);
}
export async function ask(f, who, text, options, opts = {}) {
    check(f);
    const sp = SPEAKERS[who] || { name: who, emoji: "💬", color: "#555" };
    const i = await dlgChoose(opts.name || sp.name, text, options, { emoji: opts.emoji || sp.emoji, color: sp.color });
    check(f);
    return Math.max(0, i);
}

// ── people ───────────────────────────────────────────────────────────────
/** spawnPerson with a fallback model if `key` isn't loaded (never throws). */
export function person(key, colors = null, fallback = "luluPerson") {
    const k = models[key] ? key : models[fallback] ? fallback : "luluPerson";
    const p = spawnPerson(k, { colors });
    p.key = k;
    return p;
}
/** On-foot Lulu with her current salon style, optionally in the jumpsuit. */
export function lulu(jumpsuit = false) {
    const style = ctx.car && ctx.car.hairStyle;
    const key = style && models["luluPerson_" + style] ? "luluPerson_" + style : "luluPerson";
    const colors = Object.assign({}, jumpsuit ? JUMPSUIT : {});
    if (ctx.car && ctx.car.hairColor) colors.Hair = ctx.car.hairColor;
    return person(key, colors);
}
/** Step a person toward (x, z). Returns true once there. */
export function walkTo(p, x, z, speed, dt, opts = {}) {
    const o = p.obj;
    if (!Number.isFinite(x) || !Number.isFinite(z)) { p.update(dt, opts); return true; }
    const dx = x - o.position.x, dz = z - o.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) { p.update(dt, opts); return true; }
    const step = Math.min(d, speed * dt);
    o.position.x += dx / d * step;
    o.position.z += dz / d * step;
    p.face(x, z, dt, 10);
    p.update(dt, Object.assign({ walk: speed }, opts));
    return false;
}
export function faceYaw(p, yaw, dt, rate = 8) {
    p.obj.rotation.y += wrapAngle(yaw - p.obj.rotation.y) * Math.min(1, dt * rate);
}

// ── cameras ──────────────────────────────────────────────────────────────
/** An eased camera rig for a set camera (ctx.cam handles the driving one). */
export class Shot {
    constructor(camera) { this.cam = camera; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.fov = 50; this.snap = true; this.shake = 0; }
    set(from, look, fov = 50) { this.toPos = from; this.toLook = look; this.toFov = fov; return this; }
    cut() { this.snap = true; return this; }
    update(dt, rate = 2.2) {
        if (!this.toPos) return;
        if (this.snap) { this.pos.copy(this.toPos); this.look.copy(this.toLook); this.fov = this.toFov; this.snap = false; }
        this.pos.lerp(this.toPos, Math.min(1, dt * rate));
        this.look.lerp(this.toLook, Math.min(1, dt * rate * 1.4));
        this.fov += (this.toFov - this.fov) * Math.min(1, dt * 2.5);
        this.cam.position.copy(this.pos);
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt * 2);
            this.cam.position.x += (Math.random() - 0.5) * this.shake * 0.15;
            this.cam.position.y += (Math.random() - 0.5) * this.shake * 0.15;
        }
        this.cam.lookAt(this.look);
        this.cam.fov = this.fov;
        this.cam.updateProjectionMatrix();
    }
}
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Leave room for a side / bottom menu card: shifts the picture so the action
 * sits in the free part of the screen (call every frame; side = 0 clears).
 */
export function frameFor(camera, side) {
    const W = window.innerWidth, Hh = window.innerHeight;
    if (!side) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); return; }
    if (W >= Hh) camera.setViewOffset(W, Hh, W * 0.2 * side, 0, W, Hh);
    else camera.setViewOffset(W, Hh, 0, Hh * 0.2 * side, W, Hh);
}

// ── props ────────────────────────────────────────────────────────────────
let cuffMat = null;
export function cuffs() {
    if (!cuffMat) cuffMat = new THREE.MeshStandardMaterial({ color: "#C9CED6", metalness: 0.9, roughness: 0.25 });
    const g = new THREE.Group();
    const ring = new THREE.TorusGeometry(0.06, 0.014, 6, 14);
    for (const s of [-1, 1]) { const m = new THREE.Mesh(ring, cuffMat); m.position.x = s * 0.07; g.add(m); }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 5), cuffMat);
    chain.rotation.z = Math.PI / 2;
    g.add(chain);
    g.userData.geos = [ring, chain.geometry];
    return g;
}
export function disposeCuffs(g) { if (g && g.userData.geos) for (const x of g.userData.geos) x.dispose(); }

/** Bring a model template in as a clone (or an empty group if it isn't loaded). */
export function clone(key, colors) { return models[key] ? cloneWithColors(models[key], colors) : new THREE.Group(); }

// ── the driving world during a roadside cutscene ─────────────────────────
let trafficWas = null;
/** Stop new traffic and clear ordinary cars near Lulu so nothing ploughs into the scene. */
export function quietRoad(radius = 140) {
    const tr = ctx.traffic;
    if (trafficWas === null) trafficWas = tr.config.enabled;
    tr.config.enabled = false;
    for (const c of tr.cars.slice()) {
        if ((c.data && c.data.law) || c.ai || c.keep) continue;   // never touch other features' scripted vehicles
        if (Math.abs(c.s - ctx.car.s) < radius) tr.remove(c);
    }
}
export function restoreRoad() {
    if (trafficWas !== null) { ctx.traffic.config.enabled = trafficWas; trafficWas = null; }
}
