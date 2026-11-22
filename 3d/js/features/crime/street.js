// features/crime — shared bits for CRIME THAT ISN'T HERS (stage 2): street characters that only exist while she's near
// (a person spawned within NEAR m, gone past FAR), the beat cop who comes when she reports something (walks in from up
// the street, nabs the perp — cartoon: a hand on the shoulder, "come on, Yanky"), the choice card (core dialog), and the
// 📞 Phone hook (community.addReason) so every one of them can be reported from the phone as well as in person.
import { ctx } from "../../core/ctx.js";
import { choose } from "../../core/dialog.js";
import { CR, SAVE, dirty, log, stat, bubble, need, person, drop, models, luluPos } from "./common.js";

export const NEAR = 90, FAR = 120;

/** A street character at a fixed home: spawned when she's within NEAR, dropped past FAR. def: { key, fallback, colors, name } */
export class Character {
    constructor(def) { this.def = def; this.p = null; this.home = null; this.loading = false; this.x = 0; this.z = 0; this.yaw = 0; }
    place(x, z, yaw) { this.home = { x, z, yaw }; this.x = x; this.z = z; this.yaw = yaw; }
    /** Keep it alive while she's near. → true while spawned */
    keep() {
        const lp = luluPos();
        if (!this.home || !lp) return false;
        const d = Math.hypot(lp.x - this.x, lp.z - this.z);
        if (!this.p && d < NEAR && !this.loading) {
            this.loading = true;
            need([this.def.key, this.def.fallback || "npcMan"]).then(() => {
                this.loading = false;
                if (this.p || !this.home) return;
                this.p = person(this.def.key, this.def.colors || null, this.def.fallback || "npcMan");
                if (!this.p) return;
                this.p.obj.position.set(this.x, 0, this.z);
                this.p.obj.rotation.y = this.yaw;
                ctx.scene.add(this.p.obj);
            });
        } else if (this.p && d > FAR) this.despawn();
        return !!this.p;
    }
    despawn() { if (this.p) { drop(this.p.obj); this.p = null; } }
    clear() { this.despawn(); this.home = null; }
    get obj() { return this.p ? this.p.obj : null; }
    sync() { if (this.p) { this.p.obj.position.set(this.x, 0, this.z); } }
}

/** The choice card over a character (core dialog: works with pad / keys / touch). → Promise<index> */
export function ask(name, text, options, emoji = "🕶️") {
    return choose(name, text, options, { emoji });
}

// ── the beat cop who answers a report ─────────────────────────────────────
export const COPS = [];
/**
 * A cop walks in from up the street toward `perp` (a Character or {x, z, obj}) and nabs him. onNab() when he gets
 * there; the perp's own code decides whether he tried to run. → the cop record
 */
export async function sendCop(perp, onNab, { from = null, speed = 5.2, key = "copPerson", line = "Where is he? WHERE IS HE?" } = {}) {
    await need([key, "copPerson"]);
    const lp = luluPos();
    const p = models[key] ? person(key) : models.copPerson ? person("copPerson") : null;
    if (!p) { if (onNab) onNab(); return null; }
    const tx = perp.x, tz = perp.z;
    const a = Math.atan2(tx - lp.x, tz - lp.z) + (Math.random() < 0.5 ? 1.2 : -1.2);
    const x = from ? from.x : tx + Math.sin(a) * 28, z = from ? from.z : tz + Math.cos(a) * 28;
    p.obj.position.set(x, 0, z);
    ctx.scene.add(p.obj);
    const C = { p, perp, onNab, speed, t: 0, phase: "walk", x, z };
    COPS.push(C);
    bubble(line, p.obj, { cls: "cop", y: 2.1, dur: 2 });
    log("cop", { phase: "sent" });
    return C;
}
export function copsTick(dt) {
    for (let i = COPS.length - 1; i >= 0; i--) {
        const C = COPS[i];
        C.t += dt;
        const o = C.p.obj, tx = C.perp.x, tz = C.perp.z;
        const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
        if (C.phase === "walk") {
            if (d > 1.1) { const k = Math.min(d, C.speed * dt) / d; o.position.x += dx * k; o.position.z += dz * k; C.p.face(tx, tz, dt, 8); C.p.update(dt, { walk: C.speed }); }
            if (d <= 1.1 || C.t > 25) { C.phase = "nab"; C.t = 0; bubble("Come on, you. Again?", o, { cls: "cop", y: 2.1, dur: 2.2 }); try { if (C.onNab) C.onNab(); } catch (e) { console.error("[crime] nab", e); } }
        } else {
            // walks him off (both drift away), then gone
            C.p.update(dt, { walk: 1.4, point: C.t < 1 });
            o.position.x += Math.sin(o.rotation.y + Math.PI) * 1.4 * dt; o.position.z += Math.cos(o.rotation.y + Math.PI) * 1.4 * dt;
            if (C.t > 6) { drop(o); COPS.splice(i, 1); }
        }
    }
}
export function clearCops() { for (const C of COPS) drop(C.p.obj); COPS.length = 0; }

/** What a character remembers about her (SAVE.mem[id]): { met, reported, joined, bought, mood } */
export function mem(id) {
    const m = SAVE.mem[id] || (SAVE.mem[id] = { met: 0, reported: 0, joined: 0, bought: 0, mood: "" });
    return m;
}
export function remember(id, field, mood = null) {
    const m = mem(id);
    m[field] = (m[field] || 0) + 1;
    if (mood) m.mood = mood;
    dirty();
    try { if (ctx.memory && ctx.memory.remember) ctx.memory.remember("crime", { who: id, did: field, town: CR.town }); } catch (e) { /* no memory */ }
}
export { stat };
