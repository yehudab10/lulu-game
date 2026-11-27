// features/together — FRIENDS IN THE SAME BUILDING SEE EACH OTHER.
//
// Every walk-in place runs on the interiors engine (interiors/engine.js: a Room with its own little scene), so this
// is ONE layer over all of them — no per-building netcode:
//   • me: while I'm inside a SHARED room in a 🎉 party, my spot in that room rides in my snapshot extras:
//         d.x.in = [room id, instance, x×100, z×100, facing×100, pose bits]   (~7 Hz, ~40 bytes)
//     (instance: which one — a house's "town:house:door", whose home for Lulu's house; "" = the door I came in by,
//      d.x.dr, tells two bars apart)
//   • friends: anyone in my party whose d.x.in is MY room is drawn in my room's scene: their Lulu (hair, jumpsuit),
//     walking where they walk (eased ~220 ms behind, like the street), their pose (sitting, dancing, crouching,
//     talking), their emotes (d.x.e — the same 8 gestures + phrase bubbles) and their nametag. They come in at the
//     door and walk out through it.
// What stays each screen's own: the room's people and their scripts (the bartender, the residents and their
// view cones, the cholent), every reward and every bill. A friend can't spend my coins, get me spotted, arrested
// or locked in — nothing they do reaches my room's logic: on my screen they're a visitor nobody reacts to.
// Strangers are never inside with you (only party members ever publish / match d.x.in).
// Cost: a friend inside is one Person rig (a handful of draw calls) + one nametag sprite; nothing when alone.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { models, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { current } from "../interiors/engine.js";
import { tone } from "../interiors/fx.js";
import { EMOTES } from "../party/emotes.js";
import { friends, friendHex, zoneOf } from "./where.js";

/** A friend's outfit, compact (features/clothes: d.x.ot) — "" for none / an old client. */
const otOf = p => (p && p.x && typeof p.x.ot === "string" ? p.x.ot.slice(0, 160) : "");

/** Which rooms friends share, and how two copies of a room are told apart. */
export const SHARED = {
    home: () => (ctx.homes && ctx.homes.house ? ctx.homes.house.key : null),       // a house in town: its door
    bar: () => "", school: () => "", hospital: () => "", police: () => "", beach: () => "",       // the roadside doors: by the door (d.x.dr)
    courthouse: () => "",                                       // (places: the town's precinct / hospital reuse police / hospital — the door tells them apart)
    shul: () => "",                                             // (features/shul: the town's shul — the door tells two copies apart)
    bank: () => (ctx.town && ctx.town.active ? ctx.town.id || "" : null),     // the town's bank (heist): one lobby per town
    shopsPizza: () => (ctx.town && ctx.town.active ? ctx.town.id || "" : null), shopsBakery: () => (ctx.town && ctx.town.active ? ctx.town.id || "" : null),   // (features/shops: the walk-in shops, one per town)
    terminal: () => "jfk",                                      // ✈️ the JFK terminal (features/airport): one hall
    clothesShop: () => (ctx.clothes && ctx.clothes.shopNow ? ctx.clothes.shopNow() : null),   // 👗 features/clothes: one per town (+ JFK's luxury house)
    lanes: () => "midwood",                                     // 🎳 features/lanes: East Midwood Lanes (one alley — its games are shared, net.js)
};
/** …and the ones that stay personal for now (with why) — ARCHITECTURE › the party parity table. */
export const NOT_SHARED = {
    luluHome: "Ima's house is family only (roadmap 23, ci/moveout): everyone has her own copy, friends get a refusal at the door",
};

const DOOR_MATCH = 25;          // two friends' doors this close (m) = the same building
const LAG = 220;                // draw friends this far in the past (ms) — the same idea as the street's interpolation
const M = { rt: null, id: "", inst: "", mates: new Map(), sendT: 0, sent: null, myDoor: null };
const _a = [0, 0, 0, 0, 0, 0];

/** My room right now: { rt, id, inst } — a shared room in a party — or null. */
export function myRoom() {
    if (!ctx.party || !ctx.party.active || ctx.state !== "interior") return null;
    const rt = current();
    if (!rt || !rt.ready || rt.disposed || !rt.set) return null;
    const f = SHARED[rt.def.id];
    if (!f) return null;
    const inst = f();
    if (inst == null) return null;
    return { rt, id: rt.def.id, inst: String(inst) };
}
export const setMyDoor = d => { M.myDoor = d; };

/** Pose bits of my Lulu in the room (what friends need to draw her like I see her). */
function myBits(rt) {
    const p = rt.luluPose || {}, o = rt.lulu.obj;
    return (p.sit ? 1 : 0) | (p.dance ? 2 : 0) | (p.point ? 4 : 0) | (p.cheer ? 8 : 0) | (o.scale.y < 0.88 ? 16 : 0) | (ctx.dialogOpen ? 32 : 0);
}
function poseOf(bits, walk) {
    return { walk, sit: !!(bits & 1), dance: !!(bits & 2), point: !!(bits & 4), cheer: !!(bits & 8), talk: !!(bits & 32) };
}

/** Is friend p in my room? */
function inMine(p, R) {
    const a = p && p.x && Array.isArray(p.x.in) ? p.x.in : null;
    if (!a || a[0] !== R.id || p.m !== 7) return false;
    if (zoneOf(p) !== (ctx.town && ctx.town.active ? ctx.town.id || "" : "")) return false;
    const d = p.x.dr, m = M.myDoor;
    // (a town can stand at more than one interchange: the same house / bank key in another copy is another room.
    //  Off the towns (the airport's one terminal) there is only one copy: the instance key alone decides.)
    const far = !!zoneOf(p) && Array.isArray(d) && !!m && Math.hypot(d[0] / 10 - m[0] / 10, d[1] / 10 - m[1] / 10) > 80;
    if (R.inst || a[1]) return String(a[1] || "") === R.inst && !far;
    return Array.isArray(d) && !!m && Math.hypot(d[0] / 10 - m[0] / 10, d[1] / 10 - m[1] / 10) < DOOR_MATCH;
}

class Mate {
    constructor(uid, rt, p) {
        this.uid = uid; this.rt = rt; this.buf = []; this.leaving = 0; this.gone = false; this.emKey = ""; this.em = null; this.key = "";
        const colors = p.hc ? { Hair: p.hc } : null;
        this.ot = otOf(p);
        this.person = spawnPerson("luluPerson", { colors, outfit: this.ot && ctx.clothes ? ctx.clothes.decode(this.ot) : false });
        this.person.obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
        rt.set.add(this.person.obj);
        const NT = ctx.party.visuals && ctx.party.visuals.NameTag;
        this.tag = NT ? new NT() : null;
        if (this.tag) { this.tag.set(ctx.party.displayName(uid), friendHex(uid), {}); rt.set.add(this.tag.sp); }
        this.vx = 0; this.vz = 0;
    }
    push(a) {
        if (!(Number.isFinite(a[2]) && Number.isFinite(a[3]) && Number.isFinite(a[4]))) return;
        if (Math.abs(a[2]) > 10000 || Math.abs(a[3]) > 10000) return;        // (a room is ±30 m: anything else is junk)
        const k = a[2] + "," + a[3] + "," + a[4] + "," + a[5];
        if (k === this.key && this.buf.length) { this.buf[this.buf.length - 1].t2 = performance.now(); return; }
        this.key = k;
        this.buf.push({ t: performance.now(), x: a[2] / 100, z: a[3] / 100, ry: a[4] / 100, bits: a[5] | 0 });
        if (this.buf.length > 12) this.buf.shift();
    }
    update(dt, p) {
        const o = this.person.obj, rt = this.rt;
        // (she changed in the fitting room while I watched: her new outfit, in place)
        const ot = otOf(p);
        if (ot !== this.ot && ctx.clothes) { this.ot = ot; ctx.clothes.dress(o, ot ? ctx.clothes.decode(ot) : {}); }
        let walk = 0, bits = 0;
        if (this.leaving > 0) {
            // out through the door: walk to it, then gone
            const d = rt.spots.door || { x: o.position.x, z: o.position.z };
            const dx = d.x - o.position.x, dz = d.z - o.position.z, dist = Math.hypot(dx, dz);
            this.leaving -= dt;
            if (dist > 0.2 && this.leaving > 0) { const k = Math.min(dist, 3.2 * dt) / dist; o.position.x += dx * k; o.position.z += dz * k; turn(o, Math.atan2(dx, dz), dt); walk = 3.2; }
            else { this.gone = true; return; }
        } else if (this.buf.length) {
            const T = performance.now() - LAG, B = this.buf;
            let i = B.length - 1;
            while (i > 0 && B[i].t > T) i--;
            const s0 = B[i], s1 = B[Math.min(B.length - 1, i + 1)];
            const u = s1 === s0 ? 1 : Math.max(0, Math.min(1, (T - s0.t) / Math.max(1, s1.t - s0.t)));
            const x = s0.x + (s1.x - s0.x) * u, z = s0.z + (s1.z - s0.z) * u;
            const px = o.position.x, pz = o.position.z;
            if (!this.placed) { o.position.set(x, rt.groundAt(x, z), z); o.rotation.y = s0.ry; this.placed = true; }
            else { o.position.x = x; o.position.z = z; o.position.y += (rt.groundAt(x, z) - o.position.y) * Math.min(1, dt * 12); }
            const sp = dt > 0 ? Math.hypot(o.position.x - px, o.position.z - pz) / dt : 0;
            this.sp = (this.sp || 0) + (sp - (this.sp || 0)) * Math.min(1, dt * 8);
            walk = this.sp > 0.25 ? this.sp : 0;
            turn(o, s0.ry + wrap(s1.ry - s0.ry) * u, dt, walk > 0.3 ? 12 : 8);
            bits = s1.bits;
        }
        // crouching (sneaking in a house): the same squash my own Lulu does
        o.scale.y += ((bits & 16 ? 0.74 : 1) - o.scale.y) * Math.min(1, dt * 9);
        // an emote (the party's 8 gestures)
        const e = p && p.x && Array.isArray(p.x.e) ? p.x.e : null, ek = e ? (e[0] | 0) + ":" + (e[1] | 0) : "";
        if (ek && ek !== this.emKey) {
            this.emKey = ek;
            const E = EMOTES[e[0] | 0];
            if (E) { this.em = { E, t: 0 }; if (rt.bubbles) rt.bubbles.say(E.say === E.e ? E.e : `${E.e} ${E.say}`, o, 2.4); emit("party:emote", { uid: this.uid, i: e[0] | 0, id: E.id, me: false, room: true }); }
        } else if (!ek) this.emKey = "";
        if (this.em) { this.em.t += dt; if (this.em.t > (this.em.E.dur || 2.6) || walk > 0.6) this.em = null; }
        const pose = this.em ? Object.assign({ walk }, this.em.E.pose) : poseOf(bits, walk);
        this.person.update(dt, pose);
        if (this.em && this.em.E.hop) o.position.y += Math.abs(Math.sin(this.em.t * 7)) * this.em.E.hop;
        // the nametag: over her head, readable from the room's camera, out of the way when the camera's close
        if (this.tag) {
            const cam = rt.set.camera.position, dist = Math.hypot(o.position.x - cam.x, o.position.z - cam.z);
            // (∝ distance: the same size on screen at any range — with a floor, a friend standing by the lens put her
            //  name across a phone in giant letters; right on top of the camera it's hidden)
            const k = Math.min(1.2, dist / 9);
            this.tag.sp.position.set(o.position.x, o.position.y + 2.25 * o.scale.y, o.position.z);
            this.tag.sp.scale.set(this.tag.base * k * 0.62, this.tag.base * this.tag.aspect * k * 0.62, 1);
            this.tag.sp.visible = dist > 1.6 && !(rt.bubbles && rt.bubbles.list && rt.bubbles.list.some(b => b.at === o));
        }
    }
    dispose() { this.person.obj.removeFromParent(); if (this.tag) this.tag.dispose(); }
}
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function turn(o, want, dt, rate = 10) { o.rotation.y += wrap(want - o.rotation.y) * Math.min(1, dt * rate); }

function clearMates() { for (const m of M.mates.values()) m.dispose(); M.mates.clear(); }

/** Per frame (features/together's rAF). */
export function tick(dt) {
    const R = myRoom();
    // ── publish my spot (or stop) ──
    if (R) {
        M.sendT -= dt;
        if (M.sendT <= 0) {
            M.sendT = 0.1;
            const o = R.rt.lulu.obj;
            _a[0] = R.id; _a[1] = R.inst; _a[2] = Math.round(o.position.x * 100); _a[3] = Math.round(o.position.z * 100);
            _a[4] = Math.round(wrap(o.rotation.y) * 100); _a[5] = myBits(R.rt);
            const k = _a.join("|");
            if (k !== M.sent) { M.sent = k; ctx.party.setX("in", _a.slice()); }
        }
    } else if (M.sent) { M.sent = null; if (ctx.party && ctx.party.setX) ctx.party.setX("in", null); }
    // ── a new room (or none): drop the old visitors ──
    const rt = R ? R.rt : null;
    if (rt !== M.rt) { clearMates(); M.rt = rt; M.id = R ? R.id : ""; M.inst = R ? R.inst : ""; M.t = 0; }
    if (!R) return;
    M.t = (M.t || 0) + dt;
    if (!models.luluPerson) { ensureModels(["luluPerson"]).catch(() => { }); return; }
    const here = new Set();
    for (const uid of friends()) {
        const p = ctx.party.peer(uid);
        if (!p || !ctx.party.fresh(p, 8000) || !inMine(p, R)) continue;
        here.add(uid);
        let m = M.mates.get(uid);
        if (!m || m.leaving > 0) {
            if (m) { m.dispose(); }
            m = new Mate(uid, rt, p);
            M.mates.set(uid, m);
            if (M.t > 1.2) { tone(330, 0.08, "triangle", 0.08, 440); emit("together:in", { uid, room: R.id }); }       // (a friend walks in — not the ones already here when I did)
        }
        m.push(p.x.in);
    }
    for (const [uid, m] of M.mates) {
        if (!here.has(uid) && !m.leaving) { m.leaving = 1.6; emit("together:out", { uid, room: R.id }); }
        m.update(dt, ctx.party.peer(uid));
        if (m.gone) { m.dispose(); M.mates.delete(uid); }
    }
}
/** A friend inside room `id` / instance `inst` right now (in my zone) → their name, or null (homes' door menu asks). */
export function friendIn(id, inst) {
    if (!ctx.party || !ctx.party.active) return null;
    const Z = ctx.town && ctx.town.active ? ctx.town.id || "" : "";
    for (const uid of friends()) {
        const p = ctx.party.peer(uid), a = p && p.x && Array.isArray(p.x.in) ? p.x.in : null;
        if (!a || p.m !== 7 || !ctx.party.fresh(p, 6000) || a[0] !== id || String(a[1] || "") !== String(inst) || zoneOf(p) !== Z) continue;
        const d = p.x.dr, me = ctx.foot && ctx.foot.pos;
        if (Array.isArray(d) && me && Math.hypot(d[0] / 10 - me.x, d[1] / 10 - me.z) > 80) continue;     // (another copy of this town)
        return ctx.party.displayName(uid);
    }
    return null;
}
/** My own emote inside a shared room (party/emotes.js asks): her phrase bubble · her pose on top of the room's. */
export function roomSay(text) { const R = myRoom(); if (R && R.rt.bubbles) R.rt.bubbles.say(text, R.rt.lulu.obj, 2.4); }
export function roomPose(E, t) {
    const R = myRoom();
    if (!R) return;
    const l = R.rt.lulu, sp = Math.hypot(R.rt.vel.x, R.rt.vel.z);
    l.update(0, Object.assign({ walk: sp }, E.pose));
    if (E.hop) l.obj.position.y = R.rt.groundAt(l.obj.position.x, l.obj.position.z) + Math.abs(Math.sin(t * 7)) * E.hop;
}
/** Tests: who this screen draws in my room, and where (room coordinates). */
export function debug() {
    const out = [];
    for (const [uid, m] of M.mates) { const o = m.person.obj; out.push({ uid, x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2), leaving: m.leaving > 0, visible: o.visible && !!o.parent, tag: !!(m.tag && m.tag.sp.parent) }); }
    return { room: M.id, inst: M.inst, mates: out, sent: M.sent };
}
on("party:status", e => { if (e && e.want === false) { clearMates(); M.rt = null; M.sent = null; } });
