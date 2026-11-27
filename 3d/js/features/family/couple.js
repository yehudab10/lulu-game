// features/family — 🤫 SHLOIME + TOBY: the secret couple, a slow thread found in the world (never a pop-up).
//
// One BEAT a real day (couple-data.js BEATS, in order): on the hours a beat allows (never Shabbos / Yom Tov) the two of
// them are out at that beat's place — a little table outside Midwood's pizza shop, Lakewood's makolet, the lake, the far
// end of Midwood's municipal lot, Lakewood's pizza shop (Toby, needing a ride), and finally Ima on her porch with a Look.
// From a distance: they're terrible at hiding (bubbles). Up close: a ✋ → the beat (dialog, a choice, sometimes a near
// miss — Raizy, Fayge — where Lulu picks a ridiculous cover; every one works, badly). The drop-off beat is a ride: a
// soft beacon round the corner from Toby's house; she hops out there. Progress is saved (store "family".couple); the
// last beat → 🤫 Secret Keeper (meta/badges). Story only: nothing here pays coins.
import { ctx, on, emit, addActor } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { models, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say, choose } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { beacon, hideBeacon } from "../openworld/marks.js";
import { when } from "../homes/life.js";
import { SAVE, live as faygeLive, log } from "./fayge.js";
import { ID } from "./data.js";
import { PEOPLE, BEATS, SECRET_DONE, COUPLE_AFTER } from "./couple-data.js";

const C = SAVE.couple || (SAVE.couple = { n: 0, day: "", cover: [], picks: [] });
if (!Array.isArray(C.cover)) C.cover = [];
if (!Array.isArray(C.picks)) C.picks = [];
export const CP = { beat: null, at: null, ppl: {}, str: null, t: 0, busy: false, ride: null, force: {}, saidT: 0, extra: null };
const pick = a => a[Math.floor(Math.random() * a.length)];
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
const MODELS = ["homesDad", "homesMom", "homesBaby", "imaPerson"];

/** The beat that's out in the world right now (or null): the next one, not already one today, its town + hours. */
export function beatNow() {
    if (!ctx.enabled(ID) || !(ctx.town && ctx.town.active) || (ctx.G && ctx.G.mode === "dina") || /^dina/.test(ctx.state || "")) return null;
    if (CP.ride) return null;
    const w = when();
    if (w.shabbos || w.yomtov) return null;
    if (C.n >= BEATS.length) return null;
    if (C.day === today() && !CP.force.anyDay) return null;
    const b = BEATS[C.n];
    if (b.town !== ctx.town.id) return null;
    if (!CP.force.anyHour && !(w.hour >= b.hours[0] && w.hour < b.hours[1])) return null;
    return b;
}

// ── where a beat stands ─────────────────────────────────────────────────
function placeFor(b) {
    const T = ctx.town, sp = T && T.spot && T.spot(b.spot);
    if (!sp) return null;
    const nx = sp.nx, nz = sp.nz, ux = sp.ux != null ? sp.ux : nz, uz = sp.uz != null ? sp.uz : -nx;
    let ox = sp.x, oz = sp.z;
    if (b.door && sp.door && typeof sp.door === "object") { ox = sp.door.x; oz = sp.door.z; }
    const x = ox + ux * (b.u || 0) + nx * (b.door ? 1.0 : b.n || 0), z = oz + uz * (b.u || 0) + nz * (b.door ? 1.0 : b.n || 0);
    return { x, z, ux, uz, nx, nz, yaw: Math.atan2(nx, nz) };
}
function person(key) {
    const P = PEOPLE[key];
    if (!models[P.model]) return null;
    const p = spawnPerson(P.model, { colors: P.colors || null });
    p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    ctx.scene.add(p.obj);
    return p;
}
function clear() {
    for (const p of Object.values(CP.ppl)) if (p && p.obj.parent) p.obj.parent.remove(p.obj);
    if (CP.str && CP.str.parent) CP.str.parent.remove(CP.str);
    for (const w of CP.extraP || []) if (w.p.obj.parent) w.p.obj.parent.remove(w.p.obj);
    CP.ppl = {}; CP.str = null; CP.beat = null; CP.at = null; CP.extraP = []; CP.extra = null;
}
function spawn(b) {
    clear();
    const at = placeFor(b);
    if (!at || !MODELS.every(k => models[k])) return false;
    CP.beat = b; CP.at = at;
    const set = (p, x, z, yaw) => { p.obj.position.set(x, 0, z); p.obj.rotation.y = yaw; };
    const W = (u, n) => ({ x: at.x + at.ux * u + at.nx * n, z: at.z + at.uz * u + at.nz * n });
    for (const k of b.who) if (k !== "gitty") CP.ppl[k] = person(k);
    const S = CP.ppl.shloime, T = CP.ppl.toby;
    if (b.table && S && T) {          // two chairs at a little table, facing each other along the shop front
        const a = W(-0.6, 0), c = W(0.6, 0);
        set(S, a.x, a.z, Math.atan2(at.ux, at.uz)); set(T, c.x, c.z, Math.atan2(-at.ux, -at.uz));
        CP.sit = true;
    } else if (b.apart && S && T) {    // "strangers": three metres apart, both studying the shop window
        const a = W(-1.5, 0), c = W(1.5, 0);
        set(S, a.x, a.z, at.yaw + Math.PI); set(T, c.x, c.z, at.yaw + Math.PI); CP.sit = false;
    } else {
        const a = W(-0.5, 0), c = W(0.5, 0);
        if (S) set(S, a.x, a.z, at.yaw); if (T) set(T, c.x, c.z, at.yaw);
        if (CP.ppl.ima) set(CP.ppl.ima, at.x, at.z, at.yaw);
        CP.sit = false;
    }
    if (b.who.includes("gitty") && S) {
        const st = makeStroller(), q = W(b.table ? -0.6 : -1.3, b.table ? 0.9 : 0.5);
        st.position.set(q.x, 0, q.z); st.rotation.y = at.yaw; ctx.scene.add(st); CP.str = st;
        const gt = person("gitty");
        if (gt) { gt.obj.position.set(q.x, 0.42, q.z); gt.obj.rotation.y = at.yaw; gt.obj.scale.setScalar(0.9); CP.ppl.gitty = gt; }
    }
    log("couple:place", { beat: b.id });
    return true;
}
let strollerFn = null;
export function setStroller(fn) { strollerFn = fn; }
const makeStroller = () => strollerFn();

// ── the tick ─────────────────────────────────────────────────────────────
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos) || null;
function tick(dt) {
    CP.t += dt;
    if (CP.ride) return rideTick();
    const b = CP.busy ? CP.beat : beatNow();
    if (b !== CP.beat) {
        const me = herPos();
        const near = me && CP.at && Math.hypot(CP.at.x - me.x, CP.at.z - me.z) < 25;
        if (!b || !near || !CP.beat) { if (b) spawn(b); else clear(); }
    }
    if (!CP.beat) return;
    const me = herPos();
    if (!me) return;
    const d = Math.hypot(CP.at.x - me.x, CP.at.z - me.z);
    if (d > 70) return;
    const S = CP.ppl.shloime, T = CP.ppl.toby, I = CP.ppl.ima, G = CP.ppl.gitty;
    const talk = CP.busy;
    if (CP.beat.walk && !talk && S && T) {        // a slow walk along the lake, the stroller in front
        const s = Math.sin(CP.t * 0.1) * 7, dir = Math.cos(CP.t * 0.1) >= 0 ? 1 : -1, yaw = Math.atan2(CP.at.ux * dir, CP.at.uz * dir);
        S.obj.position.set(CP.at.x + CP.at.ux * s - CP.at.nx * 0.5, 0, CP.at.z + CP.at.uz * s - CP.at.nz * 0.5); S.obj.rotation.y = yaw;
        T.obj.position.set(CP.at.x + CP.at.ux * s + CP.at.nx * 0.5, 0, CP.at.z + CP.at.uz * s + CP.at.nz * 0.5); T.obj.rotation.y = yaw;
        if (CP.str) { CP.str.position.set(S.obj.position.x + Math.sin(yaw) * 0.8, 0, S.obj.position.z + Math.cos(yaw) * 0.8); CP.str.rotation.y = yaw; if (G) { G.obj.position.set(CP.str.position.x, 0.42, CP.str.position.z); G.obj.rotation.y = yaw; } }
        S.update(dt, { walk: 0.8 }); T.update(dt, { walk: 0.8 });
    } else {
        if (S) S.update(dt, { sit: CP.sit, talk: talk || Math.sin(CP.t * 0.8) > 0.4 });
        if (T) T.update(dt, { sit: CP.sit, talk: talk || Math.sin(CP.t * 0.8 + 2) > 0.4 });
        if (I) I.update(dt, { talk });
    }
    if (G) G.update(dt, { sit: true, wave: d < 6 && Math.sin(CP.t * 1.4) > 0.6 });
    for (const x of CP.extraP || []) x.tick(dt);
    if (d < 16 && !talk && !ctx.dialogOpen && CP.t - CP.saidT > 7 && CP.beat.far) {
        CP.saidT = CP.t;
        const who = S || T || I;
        if (who) bubble(pick(CP.beat.far), who.obj);
    }
}
function bubble(text, obj, dur = 2.8) {
    try { if (ctx.banter && ctx.banter.bubble && ctx.banter.bubble(text, obj, { dur, y: 2.1, cls: "nice" })) return true; } catch (e) { /* */ }
    try { if (ctx.foot && ctx.foot.say) return !!ctx.foot.say(obj, text, dur); } catch (e) { /* */ }
    return false;
}

// ── ✋ the beat ──────────────────────────────────────────────────────────
const spot = {
    r: 2.6, short: "WHO'S THAT",
    pos() {
        if (!CP.beat || CP.busy || !ctx.foot || !ctx.foot.pos) return null;
        const f = ctx.foot.pos;
        for (const p of Object.values(CP.ppl)) if (p && Math.hypot(p.obj.position.x - f.x, p.obj.position.z - f.z) < 2.6) return { x: p.obj.position.x, z: p.obj.position.z };
        return null;
    },
    label: () => (CP.beat ? CP.beat.label : null),
    act() { play().catch(e => { console.error("[family] beat", e); CP.busy = false; }); },
};
const NAME = k => (k === "lulu" ? "Lulu" : PEOPLE[k] ? PEOPLE[k].name : k);
const EMO = k => (k === "lulu" ? "💁‍♀️" : PEOPLE[k] ? PEOPLE[k].emoji : "💬");
async function lines(L, st) { for (const [k, text] of L || []) { await say(NAME(k), text, { emoji: EMO(k) }); if (st.done) return false; } return true; }
function hold() {
    const st = { done: false };
    const ok = ctx.foot.script({
        update(dt, P, F) {
            const T = CP.ppl.toby || CP.ppl.ima || CP.ppl.shloime;
            if (F.lulu && T) { F.lulu.face(T.obj.position.x, T.obj.position.z, dt, 8); F.lulu.update(dt, { walk: 0, talk: ctx.dialogOpen }); }
            return !st.done;
        },
        abort() { st.done = true; },
    });
    return ok ? st : null;
}
/** Someone walks up (Raizy / Fayge) for a near miss: in from `from` metres along the street, stops, and later leaves. */
function walker(key, from) {
    const p = person(key);
    if (!p) return null;
    const at = CP.at, x0 = at.x + at.ux * from + at.nx * 1.2, z0 = at.z + at.uz * from + at.nz * 1.2, x1 = at.x + at.ux * 3.2 + at.nx * 1.2, z1 = at.z + at.uz * 3.2 + at.nz * 1.2;
    p.obj.position.set(x0, 0, z0);
    const w = { key, p, k: 0, dir: 1, tick(dt) {
        const tx = this.dir > 0 ? x1 : x0, tz = this.dir > 0 ? z1 : z0, o = p.obj.position;
        const d = Math.hypot(tx - o.x, tz - o.z);
        if (d > 0.1) { const s = Math.min(d, dt * 2.6); o.x += (tx - o.x) / d * s; o.z += (tz - o.z) / d * s; p.obj.rotation.y = Math.atan2(tx - o.x, tz - o.z); p.update(dt, { walk: 1.6 }); }
        else { p.update(dt, { talk: ctx.dialogOpen }); if (this.dir < 0) { this.gone = true; if (p.obj.parent) p.obj.parent.remove(p.obj); } }
    } };
    (CP.extraP = CP.extraP || []).push(w);
    CP.extra = w;
    return w;
}
const waitFor = (fn, max = 8) => new Promise(res => { const t0 = CP.t; const id = setInterval(() => { if (fn() || CP.t - t0 > max) { clearInterval(id); res(); } }, 50); });
export async function play() {
    const b = CP.beat;
    if (!b || CP.busy) return false;
    const st = hold();
    if (!st) return false;
    CP.busy = true;
    const k = C.n;
    try {
        if (!await lines(b.lines, st)) return false;
        let pickI = -1;
        if (b.choose) {
            pickI = await choose(b.label.replace(/^👀 /, ""), b.choose.q, b.choose.options, { emoji: "🤫" });
            if (pickI < 0 || st.done) return false;
            if (b.decline && pickI === b.choose.options.length - 1) { await lines(b.decline, st); C.day = today(); saveSoon(); log("couple:decline", { beat: b.id }); return true; }
            if (b.result && b.result[pickI]) await lines(b.result[pickI], st);
        }
        if (b.cover) {
            const w = walker(b.cover.who, b.cover.from);
            await waitFor(() => !w || Math.hypot(w.p.obj.position.x - CP.at.x, w.p.obj.position.z - CP.at.z) < 4);
            if (!await lines(b.cover.approach, st)) return false;
            const i = await choose("🤫 COVER FOR THEM!", b.cover.q, b.cover.options, { emoji: "😱" });
            if (st.done) return false;
            const j = Math.max(0, i);
            C.cover[k] = j; saveSoon();
            log("couple:cover", { beat: b.id, pick: j });
            await lines(b.cover.replies[j], st);
            await lines(b.cover.leave, st);
            if (w) w.dir = -1;
        }
        C.picks[k] = pickI;
        if (b.ride) { await lines([], st); startRide(b); return true; }
        await lines(b.after, st);
        done(b);
        return true;
    } finally { st.done = true; CP.busy = false; }
}
function done(b) {
    C.n = Math.max(C.n, BEATS.indexOf(b) + 1); C.day = today(); saveSoon();
    emit("stat", { id: "familySecret", n: 1 });
    log("couple:beat", { beat: b.id, n: C.n });
    if (C.n >= BEATS.length) { H.toast(SECRET_DONE, "gold", { key: "family:secret", prio: 2 }); emit("stat", { id: "familySecretKept", n: 1 }); }
}

// ── 🚗 the drop-off: round the corner from Toby's house ──────────────────
function rideTarget(b) {
    if (!(ctx.town && ctx.town.active && ctx.town.id === b.ride.town && ctx.town.plan)) return null;
    return ctx.town.plan.world(b.ride.lx, b.ride.lz, {});
}
function startRide(b) {
    clear();
    CP.ride = { b, t: 0 };
    log("couple:ride", { beat: b.id });
}
function rideTick() {
    const R = CP.ride, b = R.b, at = rideTarget(b);
    if (!at) { hideBeacon("family:ride"); return; }
    beacon("family:ride", at.x, at.z, "#B39DDB", 1.6, 7);
    const me = herPos();
    if (!me || R.busy) return;
    const slow = (ctx.foot && ctx.foot.active) || !ctx.car || Math.abs(ctx.car.speed || 0) < 4;
    if (Math.hypot(me.x - at.x, me.z - at.z) < 12 && slow) {
        R.busy = true;
        hideBeacon("family:ride");
        (async () => {
            const T = person("toby");
            if (T) { T.obj.position.set(me.x + 1.2, 0, me.z + 1.2); CP.ppl.toby = T; }
            for (const [k, text] of b.arrive) await say(NAME(k), text, { emoji: EMO(k) });
            CP.ride = null;
            if (T && T.obj.parent) T.obj.parent.remove(T.obj);
            CP.ppl = {};
            done(b);
        })().catch(e => { console.error("[family] ride", e); CP.ride = null; });
    }
}

export function initCouple() {
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(spot);
}
on("town:enter", () => {
    if (!ctx.enabled(ID)) return;
    ensureModels(MODELS).catch(() => { });
    if (!CP.on) { CP.on = true; addActor({ foot: true, update: dt => { try { tick(dt); } catch (e) { console.error("[family] couple", e); } return CP.on; }, dispose() { CP.on = false; } }); }
});
on("town:leave", () => { clear(); hideBeacon("family:ride"); });
on("run:start", () => { if (CP.ride) { CP.ride = null; hideBeacon("family:ride"); } });      // (a new run: Toby took the bus — the beat waits)
export { C as COUPLE, COUPLE_AFTER, spot as COUPLE_SPOT };
