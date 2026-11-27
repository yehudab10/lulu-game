// features/playershops/server.js — 🏪 STAGE 2: the relay's /shops/* (server/shops.mjs; the owner approved it 2026-11-27).
// Only REAL players buy: a player's shop lives on the relay (who runs it, its shelf, the till, 👍), and another player
// who walks in buys with her own coins. Asleep until the relay answers GET /shops/config (an old relay / offline / the
// kill switch off → shops stay OPENING SOON, stage 1's behaviour). A ?test page only talks to a relay it names (&mpurl=).
//
// Requests (the free plan): /shops/config once a session (+ every 10 min while off); in a town, /shops/list on the way
// in and every 2 minutes; an owner: /shops/hello every 5 minutes out in the world (+ /shops/view of her own shops to see
// what sold, ≤ 4) and /shops/stock a few seconds after she changes a shelf; a buyer: /shops/view walking in, /shops/buy
// per purchase. Coins: the buyer pays on her phone AFTER the server said yes; the owner's till (85 %) comes to her
// phone through /shops/collect.
import { ctx, emit } from "../../core/ctx.js";
import { MP_URL } from "../multiplayer/net.js";

const QS = new URLSearchParams(location.search);
export const SV = { on: false, base: "", cfg: null, town: null, list: new Map(), probeAt: -1e9, listAt: -1e9, helloAt: -1e9, dirty: new Set(), pushAt: 0, log: [] };
const now = () => performance.now() / 1000;
function base() {
    if (ctx.TEST && !QS.get("mpurl")) return "";
    if (ctx.G && ctx.G.mode === "dina") return "";
    if (ctx.mp && ctx.mp.online === false) return "";
    return String(MP_URL || "").replace(/^ws/, "http");
}
const me = () => (ctx.player && ctx.player.id && ctx.player.secret ? { pid: ctx.player.id(), sec: ctx.player.secret() } : null);
function log(ev, d = {}) { SV.log.push(Object.assign({ at: Date.now(), ev }, d)); if (SV.log.length > 40) SV.log.shift(); }
async function req(path, body) {
    const b = SV.base || base();
    if (!b) throw new Error("off");
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 8000);
    try {
        const r = await fetch(b + path, body ? { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({}, me(), body)), signal: ctl && ctl.signal } : { cache: "no-store", signal: ctl && ctl.signal });     // (a shelf / list read is never served from the browser cache)
        return { st: r.status, j: await r.json().catch(() => null) };
    } finally { clearTimeout(tm); }
}
/** Is the shops relay up (and switched on)? */
export async function probe() {
    SV.probeAt = now();
    if (!base() || !me()) { SV.on = false; return false; }
    try {
        const r = await req("/shops/config");
        SV.on = r.st === 200 && !!(r.j && r.j.cfg) && !r.j.off;
        if (SV.on) { SV.base = base(); SV.cfg = r.j.cfg; emit("playershops:server", { on: true }); }
    } catch (e) { SV.on = false; }
    log("probe", { on: SV.on });
    return SV.on;
}
/** Other players' shops in `town` (sv: the relay's list) → Map id → { k, n, o, z, t } */
export async function list(town) {
    SV.listAt = now(); SV.town = town;
    try {
        const r = await req(`/shops/list?town=${encodeURIComponent(town)}`);
        if (r.st === 200 && r.j && Array.isArray(r.j.list)) {
            const next = new Map();
            for (const x of r.j.list.slice(0, 400)) if (x && typeof x.id === "string" && x.id.startsWith(town + ":")) next.set("shop:" + x.id, { k: x.k, n: String(x.n || "").slice(0, 24), o: String(x.o || "").slice(0, 24), z: !!x.z, t: x.t | 0 });
            SV.list = next;
            emit("playershops:list", { town, n: next.size });
        } else if (r.st === 503) SV.on = false;
    } catch (e) { /* offline: keep the last list */ }
    return SV.list;
}
const wire = id => String(id).replace(/^shop:/, "");
/** Claim before the coins move. → { ok, why, o } (relay off: { ok: true, local: true }) */
export async function claim(id, kind, edictStruck) {
    if (!SV.on) return { ok: true, local: true };
    try {
        const r = await req("/shops/claim", { id: wire(id), kind, edictStruck: !!edictStruck });
        if (r.st === 200 && r.j) return r.j.ok || r.j.why === "mine" ? { ok: true } : { ok: false, why: r.j.why, o: r.j.o };
        return r.st === 429 ? { ok: false, why: "rate" } : { ok: true, local: true };
    } catch (e) { return { ok: true, local: true }; }
}
export async function release(id) { if (!SV.on) return; try { await req("/shops/release", { id: wire(id) }); } catch (e) { /* */ } }
/** Her shelf changed: send it a few seconds later (one request per change burst). */
export function dirty(id) { SV.dirty.add(id); SV.pushAt = now() + 4; }
export async function pushTick(S) {
    if (!SV.on || !SV.dirty.size || now() < SV.pushAt) return;
    const ids = [...SV.dirty]; SV.dirty.clear();
    for (const id of ids) {
        const sh = S.shops[id];
        if (!sh) continue;
        const shelf = sh.shelf.map((x, s) => (x && x.n > 0 ? { s, g: x.g, n: Math.min(4, x.n), p: x.price, st: x.stars || 0 } : null)).filter(Boolean);
        try { const r = await req("/shops/stock", { id: wire(id), shelf }); log("stock", { id, ok: !!(r.j && r.j.ok), why: r.j && r.j.why }); } catch (e) { SV.dirty.add(id); }
    }
}
/** Now and then out in the world: say hello (her shops stay hers), see what sold, bring the till home. → { coins, sold } */
export async function hello(S) {
    SV.helloAt = now();
    if (!SV.on || !Object.keys(S.shops).length) return { coins: 0, sold: 0 };
    let coins = 0, sold = 0;
    try {
        const r = await req("/shops/hello", {});
        if (!(r.st === 200 && r.j)) return { coins: 0, sold: 0 };
        for (const id of Object.keys(S.shops)) {
            const v = await view(id);
            if (!v || !v.ok) continue;
            const sh = S.shops[id], byS = new Map(v.shelf.map(x => [x.s, x]));
            sh.shelf.forEach((x, s) => {
                if (!x || SV.dirty.has(id)) return;
                const left = byS.has(s) ? byS.get(s).n : 0;
                if (left < x.n) { sold += x.n - left; x.n = left; if (left <= 0) sh.shelf[s] = null; }
            });
            sh.thumbs = v.shop.t | 0;
        }
        if (r.j.till > 0) { const c = await req("/shops/collect", {}); coins = c.j && c.j.ok ? c.j.coins | 0 : 0; }
    } catch (e) { /* offline */ }
    log("hello", { coins, sold });
    return { coins, sold };
}
/** A shop's shelf on the relay. → { ok, shop, shelf: [{ s, g, n, p, st, so }], soldOut } | null */
export async function view(id) { try { const r = await req(`/shops/view?id=${encodeURIComponent(wire(id))}`); SV.lastView = { id, st: r.st, j: r.j }; return r.st === 200 ? r.j : null; } catch (e) { return null; } }
/** Buy one from spot `slot` at the price she saw. → { ok, why, g, st, p } */
export async function buy(id, slot, p) {
    if (!SV.on) return { ok: false, why: "off" };
    try { const r = await req("/shops/buy", { id: wire(id), slot, p }); return r.j || { ok: false, why: r.st === 429 ? "rate" : "error" }; } catch (e) { return { ok: false, why: "offline" }; }
}
export async function thumb(id) { try { const r = await req("/shops/thumb", { id: wire(id) }); return !!(r.j && r.j.ok); } catch (e) { return false; } }
export async function report(id) { try { const r = await req("/shops/report", { id: wire(id) }); return !!(r.j && r.j.ok); } catch (e) { return false; } }
export async function rename(id, name) { try { const r = await req("/shops/name", { id: wire(id), name }); return r.j || { ok: false }; } catch (e) { return { ok: false, why: "offline" }; } }
export { now as svNow };
