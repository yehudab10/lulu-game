// features/accounts — 🪪 PLAYER ACCOUNTS + UNIQUE USERNAMES (ci/accounts; the owner, 2026-11-26: "add real usernames into
// the game that players can type when they start the game for the first time and have them be unique … like a real
// multiplayer game"). The server half is server/accounts.mjs (/acct/* on the relay); the name rules are rules.js —
// ONE file, used here for instant feedback and by the server, whose answer counts.
//
//  • ONE account = ctx.player's id + secret (core/player.js, the same pair the property registry uses; the 💾 save code
//    carries both, so a new phone is the same account). `hello` (boot, every 5 min, 👯 opened) makes it on first sight
//    and brings back her name (+ friends, requests, blocks — features/friends reads `ctx.accounts.view`).
//  • THE NAME: the first time she's on the title with the server up, ui.js asks once (3 one-tap ideas, or type one;
//    checked live; "Don't use your real name"; Later). Offline / server down → she plays at once as "Kugel Kid #37"
//    and is asked next time. ⚙️ › 🪪 Your name: change it (once every 30 days), hide other players' names, delete
//    the account. A name the server replaced after reports → asked again.
//  • OTHER PLAYERS' NAMES are never taken from the wire: a player's game sends a short TICKET the server signed for
//    her relay room + connection ("this connection is account X"); everyone else asks the server which name that is
//    (`ghostName`). So nobody can show up under someone else's name. ⚙️ "Other players' names: Off" → colour + number.
//  • 🚩 Report a name (`report`): the server counts different, not-brand-new accounts; enough → the name is replaced.
// Service ctx.accounts — see the bottom. Events: accounts:me {name}, accounts:names, accounts:view.
import { ctx, on, emit } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { MP_URL } from "../multiplayer/net.js";
import * as R from "./rules.js";

const QS = new URLSearchParams(location.search);
export const S = store("accounts", { hide: false, later: 0, off: false, seen: 0 });
// hide  — ⚙️ other players' names off (colour + number, as before accounts)
// later — when she last pressed "Later" on the name card (asked again after a few days, never nagged)
// off   — she deleted her online account: no account is made again until she picks a name herself
export const A = {
    on: false, base: "", view: null, cfg: null, helloAt: -1e9, busy: null, fails: 0,
    tickets: new Map(),            // "ROOM|rid" → { t, exp } (my own, per relay connection)
    names: new Map(),              // "ROOM|rid|ticket" → { n, at } (other players', from the server)
    queue: new Map(),              // "ROOM|rid|ticket" → [room, rid, ticket] waiting to be asked
    hidden: new Set(),             // tickets I reported (hidden on my screen right away)
    lastErr: "",
};
const now = () => Date.now();

function base() {
    if (ctx.TEST && !QS.get("mpurl")) return "";                  // (a ?test page never touches the real relay)
    return String(MP_URL || "").replace(/^ws/, "http");
}
const auth = () => (ctx.player && ctx.player.id ? { pid: ctx.player.id(), sec: ctx.player.secret() } : null);
/** One request to the relay. → { st, j } (st 0 = unreachable) */
export async function req(path, body, ms = 8000) {
    const b = A.base || base();
    if (!b) return { st: 0, j: null };
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), ms);
    try {
        const r = await fetch(b + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl && ctl.signal } : { signal: ctl && ctl.signal });
        const j = await r.json().catch(() => null);
        return { st: r.status, j };
    } catch (e) { return { st: 0, j: null }; }
    finally { clearTimeout(tm); }
}
/** A signed-in request (pid + secret + body); a 429 waits a moment and tries once more. */
export async function call(path, body = {}) {
    const me = auth();
    if (!me) return { st: 0, j: null };
    let r = await req(path, Object.assign({}, body, me));
    if (r.st === 429) { await new Promise(res => setTimeout(res, 700)); r = await req(path, Object.assign({}, body, me)); }
    return r;
}

// ── hello: make / refresh the account, bring back my name (+ friends — features/friends) ──
const extras = [];        // features add to hello's body: fn() → object merged in (friends: pk, claims, cards)
export function addHelloExtra(fn) { extras.push(fn); }
/** → a promise of true (the server answered) / false */
export function hello(force = false) {
    if (S.off) return Promise.resolve(false);              // (she deleted her account: nothing until she picks a name)
    if (A.busy) return A.busy;
    if (!force && now() - A.helloAt < 20000 && A.view) return Promise.resolve(true);
    A.busy = (async () => {
        const body = {};
        for (const fn of extras) { try { Object.assign(body, await fn()); } catch (e) { /* skip */ } }
        const r = await call("/acct/hello", body);
        A.helloAt = now();
        if (r.st !== 200 || !r.j || !r.j.me) {
            A.on = r.st === 403 ? A.on : false; A.fails++;
            if (r.st === 403) A.lastErr = "who";
            return false;
        }
        A.on = true; A.fails = 0; A.base = A.base || base(); A.cfg = r.j.cfg || A.cfg;
        A.view = r.j;
        const me = r.j.me, cached = ctx.player.name();
        if (me.name) {
            if (me.name !== cached) { ctx.player.setName(me.name); dropTickets(); emit("accounts:me", { name: me.name }); }
        } else if (cached && !me.ask) {
            // the server doesn't know my name (a save code from before the server kept it, a reset server): take it back
            const t = await call("/acct/name", { name: cached });
            if (t.j && t.j.ok) { me.name = cached; }
            else { ctx.player.setName(null); dropTickets(); emit("accounts:me", { name: null }); }
        } else if (cached) { ctx.player.setName(null); dropTickets(); emit("accounts:me", { name: null }); }
        emit("accounts:view", { view: A.view });
        return true;
    })().finally(() => { A.busy = null; });
    return A.busy;
}
/** Is a name card due? (no name, or the server replaced it) */
export function needsName() {
    const v = A.view;
    if (!A.on || !v || S.off) return false;
    return !v.me.name || !!v.me.ask;
}

// ── names: check / pick / suggestions ──
/** Live check: → { ok, why, sugg } (why "" when fine; "offline" when the server can't be asked) */
export async function check(name) {
    const local = R.check(name);
    if (local) return { ok: false, why: local, sugg: [] };
    const r = await req("/acct/check?n=" + encodeURIComponent(name));
    if (r.st !== 200 || !r.j) return { ok: false, why: "offline", sugg: [] };
    return { ok: !!r.j.ok, why: r.j.why || "", sugg: r.j.sugg || [] };
}
/** Three free ideas from the server (or made here, unchecked, when it can't be asked). */
export async function ideas(baseName = "") {
    const r = await req("/acct/check?n=" + encodeURIComponent(baseName));
    if (r.st === 200 && r.j && Array.isArray(r.j.sugg) && r.j.sugg.length) return r.j.sugg.slice(0, 3);
    return R.ideas(baseName, 3);
}
/** Take this name. → { ok, why, sugg, next } */
export async function setName(name) {
    const local = R.check(name);
    if (local) return { ok: false, why: local, sugg: [] };
    if (S.off) { S.off = false; saveSoon(); }
    if (!A.view) await hello(true);
    const r = await call("/acct/name", { name });
    if (r.st !== 200 || !r.j) return { ok: false, why: "offline", sugg: [] };
    if (r.j.ok) {
        ctx.player.setName(r.j.name);
        if (A.view) Object.assign(A.view.me, { name: r.j.name, gen: 0, ask: 0, next: r.j.next || 0 });
        dropTickets();
        emit("accounts:me", { name: r.j.name });
    }
    return { ok: !!r.j.ok, why: r.j.why || "", sugg: r.j.sugg || [], next: r.j.next || 0 };
}
/** When can she change it next (ms; 0 = now). */
export const nextChange = () => (A.view && A.view.me ? A.view.me.next || 0 : 0);

// ── tickets: my name for other players (per relay room + connection) ──
const roomKey = room => String(room || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
function dropTickets() { A.tickets.clear(); emit("accounts:ticket", {}); }
/** My ticket for (room, my relay id): cached; null until the server answers (then accounts:ticket fires). */
export function ticketFor(room, rid) {
    if (!rid || !ctx.player.name() || !A.on || S.off) return null;
    const k = roomKey(room) + "|" + rid, c = A.tickets.get(k);
    if (c && (c.t === null || c.exp - now() > 30 * 60000)) return c.t || null;
    if (c && c.busy) return c.t || null;
    const e = c || { t: null, exp: 0 };
    e.busy = true; A.tickets.set(k, e);
    call("/acct/ticket", { room: roomKey(room), rid: String(rid) }).then(r => {
        e.busy = false;
        if (r.st === 200 && r.j && typeof r.j.t === "string") { e.t = r.j.t; e.exp = r.j.exp; emit("accounts:ticket", { room, rid }); }
        else setTimeout(() => { if (A.tickets.get(k) === e && !e.t) A.tickets.delete(k); }, 30000);
    });
    if (A.tickets.size > 20) A.tickets.delete(A.tickets.keys().next().value);
    return e.t;
}
export const TICKET_RE = /^[A-Z2-7]{16}\.[0-9a-z]{1,10}\.[A-Za-z0-9_-]{22}$/;
/** Another player's name from their ticket: the server's answer (cached), or null (unknown / not yet / names off). */
export function ghostName(room, rid, t, { always = false } = {}) {
    if ((S.hide && !always) || typeof t !== "string" || !TICKET_RE.test(t) || A.hidden.has(t)) return null;
    // (a ticket is only good for the room + relay id it was made for — the cache is keyed by all three: the same ticket
    //  heard somewhere else first (her lobby-bridge copy carried her place room's ticket) got a null that stuck for
    //  10 minutes on her real car too — accounts "Pink 56"; sweep-health2. A null is asked again after 30 s)
    const k = roomKey(room) + "|" + String(rid) + "|" + t;
    const c = A.names.get(k);
    if (c && now() - c.at < (c.n ? 10 * 60000 : 30000)) return c.n;
    if (!A.queue.has(k)) A.queue.set(k, [roomKey(room), String(rid), t]);
    return c ? c.n : null;
}
let flushing = false;
async function flushNames() {
    if (flushing || !A.queue.size || !A.on) return;
    flushing = true;
    const batch = [...A.queue].slice(0, 30);
    for (const [k] of batch) A.queue.delete(k);
    const r = await req("/acct/names", { q: batch.map(([, v]) => v) });
    if (r.st === 200 && r.j && Array.isArray(r.j.n)) {
        batch.forEach(([k], i) => { const n = r.j.n[i]; A.names.set(k, { n: typeof n === "string" && !R.shape(n) ? n : null, at: now() }); });
        if (A.names.size > 400) for (const k of [...A.names.keys()].slice(0, 100)) A.names.delete(k);
        emit("accounts:names", {});
    } else for (const [k, v] of batch) A.queue.set(k, v);
    flushing = false;
}
setInterval(() => { flushNames(); }, 600);

/** 🚩 Report a player's name: { f } (an account id) or { t, room, rid } (a ticket). Hidden on my screen right away. */
export async function report(who) {
    if (who && who.t) A.hidden.add(who.t);
    emit("accounts:names", {});
    const body = who && who.f ? { f: who.f } : { t: who.t, room: roomKey(who.room), rid: String(who.rid) };
    const r = await call("/acct/report", body);
    return r.st === 200;
}

/** Delete the account on the server (name, friends, requests, blocks, reports). Her game progress stays. */
export async function deleteAccount() {
    const r = await call("/acct/delete", {});
    if (r.st !== 200) return false;
    S.off = true; saveSoon();
    ctx.player.setName(null);
    A.view = null; dropTickets();
    emit("accounts:deleted", {});
    emit("accounts:me", { name: null });
    return true;
}
export function setHide(v) { S.hide = !!v; saveSoon(); emit("accounts:names", {}); emit("settings", { id: "acctNames" }); }

// ── the loop ──
on("boot", () => { setTimeout(() => hello(true), ctx.TEST ? 200 : 1500); });
setInterval(() => { if (!document.hidden && now() - A.helloAt > (A.on ? 5 * 60000 : 60000 * Math.min(5, 1 + A.fails))) hello(); }, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && now() - A.helloAt > 60000) hello(); });

import "./ui.js";

ctx.accounts = {
    get on() { return A.on; },
    get name() { return ctx.player.name(); },
    get view() { return A.view; },
    get hideNames() { return !!S.hide; }, set hideNames(v) { setHide(v); },
    get off() { return !!S.off; },
    rules: R,
    hello, check, ideas, setName, nextChange, needsName, ticketFor, ghostName, report, deleteAccount, call, addHelloExtra,
    debug: () => ({ on: A.on, base: A.base || base(), view: A.view, tickets: A.tickets.size, names: [...A.names].map(([k, v]) => [k.split("|")[2].slice(0, 6), v.n]), S }),
};
