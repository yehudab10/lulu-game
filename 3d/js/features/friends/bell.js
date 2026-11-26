// features/friends — THE DOORBELL: presence + join across rooms with the existing relay (no server change).
//
// Every player has a private relay room named by a long random secret (store.js me().bell) that only her friends
// know. While she plays — with at least one friend, not "appear offline", not in Dina's mode — her game sits quietly
// in it (one idle socket) with the state { o: 1 }. A friend's game KNOCKS for a moment (👯 opened, once at boot):
//   knock  → { k: { f: their friend id, c: sealed({ q: "where" | "join", ts, nn: nonce, n, sk, w, nb? }) } }
//   answer ← { o: 1, r: [{ to: their peer id, c: sealed({ on, w, i, j, code?, u?, wait?, no? }) }] }
// sealed = AES-GCM with that friendship's own secret: anyone else at the doorbell (or the relay) reads nothing.
// A knock that isn't from a current friend, doesn't open, is stale (> 10 min) or replays a nonce gets no answer.
// Knocking also tells HER that the friend is on (and where) — presence both ways, no extra traffic.
// Both sides also say which ghost they are in the EVERYONE room (`m`: the relay's random connection id there) — sealed,
// so only a friend can tell that "Pink 42" is really her friend: her ghost is labelled 👯 + the friend's name
// (multiplayer's labelFor ← byMp). Strangers see the same random label as ever.
import { ctx, emit } from "../../core/ctx.js";
import { seal, open, randStr } from "./crypto.js";
import { openRoom } from "./room.js";
import { S, me, bellRoom, friend, isBlocked, BELL_RE, validName, labelOf, ready } from "./store.js";
import { myName } from "../multiplayer/net.js";

const SKEW = 10 * 60000, REPLY_LIFE = 30000, KNOCK_MS = 6000, JOIN_MS = 30000, PARALLEL = 3;
/** What I know about each friend right now: fid → { on, w, i, j, at, from: "knock" | "knocked" } */
export const seen = new Map();
const nonces = new Map();                // fid → recent nonces (replays get nothing)
const B = { room: null, bell: "", replies: [], asks: [] };      // my doorbell; asks = friends waiting for "ask me"

// ── where am I (a few words, for my friends only) ─────────────────────────
export function where() {
    const pr = ctx.party && ctx.party.presenceOf ? ctx.party.presenceOf() : null;
    const town = ctx.town && ctx.town.id, T = ctx.town && ctx.town.towns;
    const place = town ? `in ${(T && T[town] && T[town].name) || town}` : "on the highway";
    let label = pr && pr.label ? pr.label : "playing";
    if (pr && pr.mode === "drive" && pr.icon === "🚗") label = "";
    const w = label && pr.mode === "in" ? label : label ? `${place} · ${label}` : place;
    const out = { w: String(w).slice(0, 48), i: String((pr && pr.icon) || "🚗").slice(0, 8) };
    const M = ctx.mp;
    if (M && M.connected && M.room === "lobby" && validM(M.myId)) out.m = M.myId;        // (which ghost I am in EVERYONE)
    return out;
}
const M_RE = /^[A-Za-z0-9_-]{1,24}$/;
const validM = m => typeof m === "string" && M_RE.test(m);
/** A ghost in the EVERYONE room → my friend's label if it's one of my friends (they told me, sealed), else null. */
export function byMp(id) {
    if (!validM(id)) return null;
    const t = Date.now();
    for (const [fid, v] of seen) if (v.on && v.m === id && t - v.at < 45 * 60000) { const f = friend(fid); if (f) return labelOf(f); }
    return null;
}
const dinaMode = () => /^dina/.test(ctx.state || "") || !!(ctx.G && ctx.G.mode === "dina");
/** Out in the open world (where a friend can land next to her). */
const inWorld = () => { const d = ctx.states[ctx.state] || {}; return !!(d.driving || ctx.state === "footRun") && !ctx.dialogOpen; };

// ── my doorbell ───────────────────────────────────────────────────────────
export function bellWanted() { return !S.hidden && S.list.length > 0 && !dinaMode() && !!(ctx.mp && ctx.mp.allowed); }
export function tickBell() {
    const want = bellWanted(), bell = me().bell;
    if (B.room && (!want || B.bell !== bell)) { B.room.close(); B.room = null; B.replies = []; }
    if (!want || B.room) return;
    B.bell = bell;
    B.room = openRoom(bellRoom(bell), { stay: true, name: "Friend", onPeer: onKnock, onLeave: (r, pid) => dropAsk(pid) });
    B.room.state({ o: 1 });
}
export const bellOpen = () => !!(B.room && B.room.connected);
function reply(pid, c) {
    const t = Date.now();
    B.replies = B.replies.filter(x => x.to !== pid && t - x.at < REPLY_LIFE).slice(-3);
    B.replies.push({ to: pid, c, at: t });
    if (B.room) B.room.state({ o: 1, r: B.replies.map(x => ({ to: x.to, c: x.c })) });
}
async function onKnock(r, pid, d) {
    const k = d && d.k;
    if (!k || typeof k.f !== "string" || typeof k.c !== "string") return;
    const f = friend(k.f);
    if (!f || !f.s || isBlocked(k.f)) return;
    const q = await open(f.s, k.c);
    if (!q || typeof q.ts !== "number" || Math.abs(Date.now() - q.ts) > SKEW || typeof q.nn !== "string") return;
    const seenN = nonces.get(f.f) || [];
    if (seenN.includes(q.nn)) return;
    seenN.push(q.nn); if (seenN.length > 24) seenN.shift(); nonces.set(f.f, seenN);
    // they're on: refresh what I know (their name / car may have changed; they reached my CURRENT doorbell)
    if (validName(q.n)) f.n = q.n;
    if (typeof q.sk === "string" && /^[a-z0-9_]{1,24}$/.test(q.sk)) f.sk = q.sk;
    if (typeof q.nb === "string" && BELL_RE.test(q.nb)) f.b = q.nb;
    f.nb = 0;
    seen.set(f.f, { on: true, w: typeof q.w === "string" ? q.w.slice(0, 48) : "", i: typeof q.i === "string" ? q.i.slice(0, 8) : "🚗", m: validM(q.m) ? q.m : "", at: Date.now(), from: "knocked" });
    emit("friends:presence", { f: f.f });
    const base = Object.assign({ on: 1, j: S.join, re: q.nn }, where());
    if (q.q !== "join") { reply(pid, await seal(f.s, base)); return; }
    // a friend wants to hop in next to me
    if (S.join === "nobody") { reply(pid, await seal(f.s, Object.assign(base, { no: "nobody" }))); return; }
    if (!inWorld()) { reply(pid, await seal(f.s, Object.assign(base, { no: "busy" }))); return; }
    if (S.join === "always") { await letIn(f, pid, base); return; }
    // ask me: one quiet chip + the 👯 app; they wait (≤ 30 s)
    B.asks = B.asks.filter(a => a.f !== f.f);
    B.asks.push({ f: f.f, pid, at: Date.now(), base });
    reply(pid, await seal(f.s, Object.assign({}, base, { wait: 1 })));
    emit("friends:joinAsk", { f: f.f, n: labelOf(f) });
}
function dropAsk(pid) { const n = B.asks.length; B.asks = B.asks.filter(a => a.pid !== pid); if (n !== B.asks.length) emit("friends:joinAsk", {}); }
/** Friends waiting for my yes: [{ f, at }] (fresh ones). */
export function joinAsks() { const t = Date.now(); B.asks = B.asks.filter(a => t - a.at < JOIN_MS && friend(a.f)); return B.asks.map(a => ({ f: a.f, at: a.at })); }
/** ✓ / ✗ on a friend's join ask. */
export async function answerJoin(fid, yes) {
    const a = B.asks.find(x => x.f === fid), f = friend(fid);
    B.asks = B.asks.filter(x => x.f !== fid);
    emit("friends:joinAsk", {});
    if (!a || !f) return false;
    if (!yes) { reply(a.pid, await seal(f.s, Object.assign({}, a.base, { no: "ask" }))); return true; }
    if (!inWorld()) { reply(a.pid, await seal(f.s, Object.assign({}, a.base, { no: "busy" }))); return false; }
    await letIn(f, a.pid, a.base);
    return true;
}
/** Make sure I'm in a party (a silent 🌍 Free Roam if not) and hand the friend its code + my seat. */
async function letIn(f, pid, base) {
    const P = ctx.party;
    if (!P) return;
    if (!P.active) { if (!P.hostRoam || P.hostRoam() === false) { reply(pid, await seal(f.s, Object.assign(base, { no: "busy" }))); return; } }
    const t0 = Date.now();
    while (!(P.connected && P.code && P.uid) && Date.now() - t0 < 12000) await new Promise(r => setTimeout(r, 200));
    if (!(P.connected && P.code)) { reply(pid, await seal(f.s, Object.assign(base, { no: "busy" }))); return; }
    reply(pid, await seal(f.s, Object.assign(base, { code: P.code, u: P.uid })));
    emit("friends:letIn", { f: f.f });
}

// ── knocking at a friend's doorbell ───────────────────────────────────────
/** → { on: false } | { on: true, w, i, j, code?, u?, no? }   (q "where" | "join") */
export function knock(f, q = "where", onWait = null) {
    if (!ready(f)) return Promise.resolve({ on: false });              // (a server friendship whose card hasn't come yet)
    return new Promise(resolve => {
        let done = false, owner = null, sent = false, nn = randStr(8), waiting = false;
        const finish = v => {
            if (done) return; done = true; clearTimeout(timer); r.close();
            const t = Date.now();
            if (v && v.on) seen.set(f.f, { on: true, w: v.w || "", i: v.i || "🚗", j: v.j || "ask", m: validM(v.m) ? v.m : "", at: t, from: "knock" });
            else if (v) seen.set(f.f, { on: false, at: t, from: "knock" });
            emit("friends:presence", { f: f.f });
            resolve(v || { on: false });
        };
        let timer = setTimeout(() => finish(owner ? null : { on: false }), KNOCK_MS);
        const r = openRoom(bellRoom(f.b), {
            name: "Friend",
            onHello: rm => { owner = [...rm.peers].find(([, d]) => d && d.o === 1); if (!owner) setTimeout(() => { if (!sent && !done) finish({ on: false }); }, 1500); else go(rm); },
            onPeer: async (rm, pid, d) => {
                if (!d || d.o !== 1) return;
                if (!owner) { owner = [pid, d]; go(rm); }
                const mine = Array.isArray(d.r) ? d.r.find(x => x && x.to === rm.me) : null;
                if (!mine) return;
                const v = await open(f.s, mine.c);
                if (!v || v.re !== nn) return;
                if (v.wait) { if (!waiting) { waiting = true; clearTimeout(timer); timer = setTimeout(() => finish(Object.assign(v, { no: "ask", wait: 0 })), JOIN_MS); if (onWait) onWait(); } return; }
                if (f.nb) f.nb = 0;                 // (my new doorbell went with the knock)
                finish(v);
            },
            onClose: () => finish(null),
        });
        async function go(rm) {
            if (sent) return; sent = true;
            const m = me(), body = Object.assign({ q, ts: Date.now(), nn, n: myName(), sk: (ctx.car && ctx.car.skinKey) || "pink" }, where());
            if (f.nb) body.nb = m.bell;
            rm.state({ k: { f: m.fid, c: await seal(f.s, body) } });
        }
    });
}
/** Knock at every friend's door (a few at a time): who's on, and where. */
let checking = null;
export function checkAll() {
    if (checking) return checking;
    if (!(ctx.mp && ctx.mp.allowed) || S.hidden || dinaMode()) return Promise.resolve();
    const list = S.list.filter(ready);
    checking = (async () => {
        const run = async () => { while (list.length) { const f = list.shift(); if (friend(f.f)) await knock(f, "where"); } };
        await Promise.all(Array.from({ length: PARALLEL }, run));
    })().finally(() => { checking = null; emit("friends:checked", {}); });
    return checking;
}
export const checkingNow = () => !!checking;
export const debug = () => ({ bell: B.bell, open: bellOpen(), replies: B.replies.length, asks: B.asks.map(a => a.f), seen: [...seen].map(([f, v]) => ({ f, on: v.on, w: v.w })) });
