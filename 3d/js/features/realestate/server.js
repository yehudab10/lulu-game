// features/realestate/server.js — 🌍 THE WORLD-WIDE PROPERTY REGISTRY, client side (stage 5; the owner approved the shared
// market + the relay change, 2026-11-20). The server (server/homes.mjs) arbitrates WHO OWNS WHICH HOUSE for everyone
// online; coins, mortgages, rent, decorations stay on the device as before.
//
//   • only when the relay HAS the registry: GET /homes/config — an old server answers 404 → we stay on the local
//     registry quietly (and try again in 5 minutes). A ?test page only talks to a relay the test names (&mpurl=).
//   • identity = ctx.player (core/player.js, shared with 👯 friends): a random public id + a device secret (the server
//     keeps a hash); the 💾 save code carries both, so a new phone keeps her homes. Labels are the server's generated
//     "Kugel Kid #37" — never typed text.
//   • a registry SOURCE: the town she's in, everyone's homes (polled every 90 s + on entering) → ownerOf(id) =
//     { name: their label } (strangers' labels only while ⚙️ 🌐 Play online is on; otherwise "a neighbour").
//   • her side: every home she gets is claimed on the server (before the coins move, when the server is up — a home
//     someone else just took is refused; offline buys are claimed later and, if the world got there first, refunded);
//     every home she lets go is released. `hello` (boot + every 10 min) keeps the government's idle clock fresh and
//     brings her list back (a restored phone gets its homes back; a SEIZED home comes back marked).
//   • THE GOVERNMENT: a home the server says is seized (14 days without a login — the Abandoned Kugel Ordinance) is
//     marked `seized` in her save: no key, a notice on the lawn, the Town Council's letter; she can fight it in court
//     (court.js). A home the server dropped after its seizure (nobody appealed) → `lost`: court can still award
//     compensation.
import { ctx, on, emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { MP_URL } from "../multiplayer/net.js";
import { registry, S } from "./registry.js";

const QS = new URLSearchParams(location.search);
export const SV = { on: false, base: "", cfg: null, town: null, list: new Map(), label: null, probeAt: -1e9, pollAt: -1e9, helloAt: -1e9, busy: false, q: [], qAt: 0, log: [] };
const now = () => performance.now() / 1000;

function base() {
    if (ctx.TEST && !QS.get("mpurl")) return "";                  // (a ?test page never touches the real relay)
    if (ctx.G && ctx.G.mode === "dina") return "";
    return String(MP_URL || "").replace(/^ws/, "http");
}
const me = () => (ctx.player && ctx.player.id ? { pid: ctx.player.id(), sec: ctx.player.secret(), name: (ctx.player.label() || "").replace(/ #\d+$/, "") } : null);
async function req(path, body) {
    const b = SV.base || base();
    if (!b) throw new Error("off");
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 8000);
    try {
        const r = await fetch(b + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl && ctl.signal } : { signal: ctl && ctl.signal });
        const j = await r.json().catch(() => null);
        return { st: r.status, j };
    } finally { clearTimeout(tm); }
}

/** Is the shared registry up? (probes now and then) */
export async function probe() {
    SV.probeAt = now();
    const b = base(), id = me();
    if (!b || !id) { SV.on = false; return false; }
    try {
        const r = await req("/homes/config");
        SV.on = r.st === 200 && !!(r.j && r.j.cfg);
        if (SV.on) { SV.base = b; SV.cfg = r.j.cfg; emit("realestate:server", { on: true, cfg: SV.cfg }); }
    } catch (e) { SV.on = false; }
    return SV.on;
}

/** Claim a home on the server before the coins move. → { ok, why, server } (server off / unreachable: ok, queued) */
export async function claim(id) {
    const m = me();
    if (!SV.on || !m) return { ok: true, server: false };
    try {
        const r = await req("/homes/claim", Object.assign({ h: id }, m));
        if (r.st === 429) { await new Promise(res => setTimeout(res, 3200)); return claim(id); }
        if (r.st !== 200 || !r.j) return { ok: true, server: false, queued: true };
        if (r.j.l && ctx.player.setLabel) ctx.player.setLabel(r.j.l);
        if (r.j.ok || r.j.why === "mine") { SV.list.set(id, { l: r.j.l, s: r.j.s, z: 0, mine: true }); return { ok: true, server: true }; }
        return { ok: false, why: r.j.why, by: r.j.l, server: true };
    } catch (e) { return { ok: true, server: false, queued: true }; }
}
/** Queue a release (sold / foreclosed / double-booked / gone): retried until the server has it. */
export function release(id) { SV.list.delete(id); if (!SV.q.some(x => x.op === "release" && x.id === id)) SV.q.push({ op: "release", id }); saveQ(); }
function saveQ() { S.svq = SV.q.slice(-40); saveSoon(); }
async function flush() {
    if (!SV.on || SV.busy || !SV.q.length || now() - SV.qAt < 4) return;
    SV.busy = true; SV.qAt = now();
    const job = SV.q[0], m = me();
    try {
        if (job.op === "release") {
            const r = await req("/homes/release", Object.assign({ h: job.id }, m));
            if (r.st === 200) { SV.q.shift(); saveQ(); }
        } else if (job.op === "claim") {
            const r = await claim(job.id);
            if (r.server) { SV.q.shift(); saveQ(); if (!r.ok) lostTo(job.id, r.by, r.why); else if (S.owned[job.id]) { S.owned[job.id].reg = true; saveSoon(); } }
        }
    } catch (e) { /* next time */ }
    SV.busy = false;
}
/** Someone else got a home first while she bought it offline: every coin back (the double-booking rule). */
function lostTo(id, by, why) {
    const h = S.owned[id];
    if (!h) return;
    emit("realestate:lostTo", { id, by: by || null, why });
    if (ctx.realestate && ctx.realestate.debug && ctx.realestate.debug.refundLost) ctx.realestate.debug.refundLost(id, by);
}

/** hello: the idle clock, my label, my list (restored phones, the government's seizures). */
export async function hello() {
    SV.helloAt = now();
    const m = me();
    if (!SV.on || !m) return null;
    try {
        const r = await req("/homes/hello", m);
        if (r.st !== 200 || !r.j) return null;
        if (r.j.label && ctx.player.setLabel) ctx.player.setLabel(r.j.label);
        if (r.j.cfg) SV.cfg = r.j.cfg;
        reconcile(r.j.mine || []);
        return r.j;
    } catch (e) { return null; }
}
function reconcile(mine) {
    const srv = new Map(mine.map(x => [x.h, x]));
    let changed = false;
    for (const [id, x] of srv) {
        const h = S.owned[id];
        if (!h) {
            // (a restored phone: the server knows a home this device doesn't — it comes back, the address fills in in town)
            const [town, lx, lz] = id.split(":");
            if (registry.count() < ((SV.cfg && SV.cfg.cap) || 10)) { registry.claim(id, { town, lx: +lx, lz: +lz, address: `a house in ${town === "midwood" ? "Midwood" : "Lakewood"}`, paid: 0, price: 0, restored: true, reg: true, since: x.s, via: "restored" }); changed = true; }
            continue;
        }
        if (!h.reg) { h.reg = true; changed = true; }
        if (x.z && !h.seized) { h.seized = Date.now(); changed = true; emit("realestate:seized", { id, address: h.address, town: h.town }); }
        if (!x.z && h.seized) { delete h.seized; changed = true; }
    }
    for (const [id, h] of Object.entries(S.owned)) {
        if (srv.has(id) || h.lost) continue;
        if (h.reg) { h.lost = Date.now(); delete h.seized; changed = true; emit("realestate:seized", { id, address: h.address, town: h.town, lost: true }); }   // (seized + dropped while she was away)
        else if (!SV.q.some(q => q.op === "claim" && q.id === id)) { SV.q.push({ op: "claim", id }); changed = true; }            // (bought offline / before the server: register it)
    }
    if (changed) { saveQ(); saveSoon(); registry.changed({ id: null, why: "server" }); }
}

/** The town she's in: everyone's homes. */
export async function poll(town) {
    SV.pollAt = now();
    if (!SV.on || !town) return;
    try {
        const r = await req(`/homes/list?town=${encodeURIComponent(town)}`);
        if (r.st !== 200 || !r.j || !Array.isArray(r.j.list)) return;
        if (r.j.cfg) SV.cfg = r.j.cfg;
        const next = new Map();
        for (const x of r.j.list.slice(0, 5000)) if (x && typeof x.h === "string" && x.h.startsWith(town + ":")) next.set(x.h, { l: typeof x.l === "string" ? x.l.slice(0, 28) : "", s: x.s, z: x.z ? 1 : 0 });
        const was = SV.list; SV.list = next; SV.town = town;
        let diff = was.size !== next.size;
        if (!diff) for (const [k, v] of next) { const o = was.get(k); if (!o || o.l !== v.l || o.z !== v.z) { diff = true; break; } }
        if (diff) registry.changed({ id: null, why: "server" });
    } catch (e) { /* next poll */ }
}

/** ~2 Hz from index.js: probe / hello / poll / the retry queue. */
export function tick() {
    const t = now(), town = ctx.town && ctx.town.active ? ctx.town.id : null;
    if (!SV.on) { if (t - SV.probeAt > (SV.probeAt < 0 ? 0 : 300)) probe().then(ok => { if (ok) hello(); }); return; }
    if (t - SV.helloAt > 600) hello();
    if (town && (town !== SV.town || t - SV.pollAt > 90)) { SV.town = town; poll(town); }
    flush();
}

// ── the source: other people's homes ──────────────────────────────────────
registry.addSource({
    ownerOf(id) {
        const x = SV.on && SV.list.get(id);
        if (!x || x.mine || registry.mine(id)) return null;
        const show = !(ctx.mp && ctx.mp.online === false);
        return { name: x.z ? "the Town Council" : show && x.l ? x.l : "a neighbour", server: true, seized: !!x.z };
    },
    list() { return SV.on ? [...SV.list.entries()].filter(([id, x]) => !x.mine && !registry.mine(id)).map(([id, x]) => ({ id, name: x.z ? "the Town Council" : x.l, seized: !!x.z, hex: x.z ? "#455A64" : "#90A4AE" })) : []; },
});
// her side: a home she got → claim it if it isn't yet; a home she let go → release it
registry.onChange(ev => {
    if (!ev || ev.remote || !ev.id) return;
    if (ev.to === "me" && S.owned[ev.id] && !S.owned[ev.id].reg && SV.on && !SV.q.some(q => q.id === ev.id)) { SV.q.push({ op: "claim", id: ev.id }); saveQ(); }
    if (ev.from === "me" && SV.on && !/moved/.test(ev.why || "")) release(ev.id);
});
on("boot", () => { if (Array.isArray(S.svq)) SV.q = S.svq.filter(x => x && typeof x.id === "string" && (x.op === "claim" || x.op === "release")).slice(-40); });
on("town:enter", () => { SV.pollAt = -1e9; });
