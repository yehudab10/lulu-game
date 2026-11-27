// features/clothes/limited.js — 👜 LIMITED PIECES, WORLD-WIDE (roadmap 24 (f); the owner: "limited supply of items rather
// than time based"). A fixed number of each exists in the whole world (data.js › LIMITED); the relay keeps the count
// (server/wear.mjs, golden rule 3's third exception) and hands out numbers: hers is "No. 17 of 50".
//   stockOf(id)     → { limited, total, left, online } — the shelf's tag (the server's stock, cached a minute)
//   buyLimited(p)   reserve on the server (her number is held 5 min) → the coins come off (garage/buy.js, never below 0)
//                   → confirm. A failed pay cancels the hold; a confirm that says the hold ran out gives the coins back.
//                   Between pay and confirm a `pending` note sits in her save: next launch finishes it (or refunds).
//   restore()       /wear/mine at launch + after she gets a name: a numbered piece the server says is hers but this
//                   phone doesn't know (a new phone, a crash) comes back — never charged twice.
// Needs an ACCOUNT with a username (features/accounts). Offline / the relay down: limited pieces say "come back when you're
// online" and everything else in the shop works. No resale, no trading.
import { ctx, on, emit } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { MP_URL } from "../multiplayer/net.js";
import { buyClothes } from "../garage/buy.js";
import { LIMITED, pieceById } from "./data.js";
import { S, owns, addOwned } from "./wear.js";

if (!S.nums || typeof S.nums !== "object") S.nums = {};          // pieceId → her number
if (!S.pending || typeof S.pending !== "object") S.pending = {};  // pieceId → { price, at } (paid, not yet confirmed)

const QS = new URLSearchParams(location.search);
const L = { stock: null, at: -1e9, online: false, busy: null, restored: false };
export const isLimited = id => !!LIMITED[id];

function base() {
    if (ctx.TEST && L.testBase) return L.testBase;                // (tests: a fake relay behind a stubbed fetch)
    if (ctx.TEST && !QS.get("mpurl")) return "";                  // (a ?test page never touches the real relay)
    if (ctx.G && ctx.G.mode === "dina") return "";
    return String(MP_URL || "").replace(/^ws/, "http");
}
const me = () => (ctx.player && ctx.player.id ? { pid: ctx.player.id(), sec: ctx.player.secret() } : null);
/** Does she have an account with a username (the only way to own a numbered piece)? */
export const hasAccount = () => !!((ctx.TEST && L.testAccount) || (ctx.accounts && ctx.accounts.name)) && !!me();
async function req(path, body) {
    const b = base();
    if (!b) throw new Error("off");
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 8000);
    try {
        const r = await fetch(b + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl && ctl.signal } : { signal: ctl && ctl.signal });
        return { st: r.status, j: await r.json().catch(() => null) };
    } finally { clearTimeout(tm); }
}

/** The world's stock (cached a minute; `force` asks now). → the stock map or null (offline / an old relay) */
export async function refresh(force = false) {
    const t = performance.now();
    if (!force && t - L.at < 60000 && L.stock) return L.stock;
    L.at = t;
    try {
        const r = await req("/wear/stock");
        L.online = r.st === 200 && !!(r.j && r.j.stock);
        L.stock = L.online ? r.j.stock : null;
    } catch (e) { L.online = false; L.stock = null; }
    emit("clothes:stock", { online: L.online });
    return L.stock;
}
/** One piece's stock for the shelf: { limited, total, left (null = unknown), online, n (hers) }. (A server-backed counter
 *  is the one source: only this function answers it.) */
export function stockOf(id) {
    const total = LIMITED[id] || 0;
    if (!total) return { limited: false };
    const s = L.stock && L.stock[id];
    return { limited: true, total: s ? s.total : total, left: s ? s.left : null, online: L.online, n: S.nums[id] || null };
}
/** The shelf's short tag + the card's line for a limited piece. */
export function tagOf(id) {
    const s = stockOf(id);
    if (!s.limited) return null;
    if (owns(id) && s.n) return { tag: `No. ${s.n} of ${s.total}`, line: `Yours: No. ${s.n} of ${s.total} in the world.` };
    if (owns(id)) return { tag: "Yours", line: `One of ${s.total} in the world.` };
    if (!s.online || s.left == null) return { tag: "Online only", line: `LIMITED · ${s.total} in the world. Come back when you're online.`, off: true };
    if (s.left <= 0) return { tag: "SOLD OUT", line: `SOLD OUT · all ${s.total} are out there.`, sold: true };
    return { tag: `${s.left} of ${s.total} left`, line: `LIMITED · ${s.left} of ${s.total} left in the world.` };
}

/** Buy a numbered piece: reserve → pay → confirm. → { ok, why: "account" | "offline" | "soldout" | "owned" | "poor" | "expired", n } */
export async function buyLimited(p) {
    if (!p || !isLimited(p.id)) return { ok: false, why: "unknown" };
    if (owns(p.id)) return { ok: false, why: "owned" };
    if (!hasAccount()) return { ok: false, why: "account" };
    if (wallet.coins < p.price) return { ok: false, why: "poor" };
    if (L.busy) return { ok: false, why: "busy" };
    L.busy = p.id;
    try {
        let r;
        try { r = await req("/wear/reserve", Object.assign({ p: p.id }, me())); } catch (e) { return { ok: false, why: "offline" }; }
        if (r.st !== 200 || !r.j) return { ok: false, why: r.st === 403 ? "account" : "offline" };
        if (!r.j.ok) {
            if (r.j.why === "owned") { restoreOne(p.id, r.j.n); return { ok: false, why: "owned", n: r.j.n }; }
            if (r.j.why === "soldout" && L.stock && L.stock[p.id]) L.stock[p.id].left = 0;
            return { ok: false, why: r.j.why || "offline" };
        }
        // her number is held: the coins come off (never below 0) — a failed pay lets the number go
        const paid = buyClothes(p, { owned: owns, give: id => { addOwned(id); S.pending[id] = { price: p.price, at: Date.now() }; saveSoon(); } });
        if (!paid.ok) { req("/wear/cancel", Object.assign({ p: p.id }, me())).catch(() => { }); return paid; }
        return await confirm(p.id, r.j.n);
    } finally { L.busy = null; }
}
/** Finish a paid buy on the server. A hold that ran out → the coins go back + the piece too (never paid for nothing). */
async function confirm(id, nHint) {
    let r;
    try { r = await req("/wear/confirm", Object.assign({ p: id }, me())); } catch (e) { return { ok: true, n: nHint || null, pending: true }; }   // (next launch finishes it)
    if (r.st === 200 && r.j && r.j.ok) {
        S.nums[id] = r.j.n; delete S.pending[id]; saveSoon();
        if (L.stock && L.stock[id] && !r.j.already) L.stock[id].left = Math.max(0, L.stock[id].left - 1);
        emit("clothes:numbered", { id, n: r.j.n });
        return { ok: true, n: r.j.n, total: r.j.total };
    }
    if (r.st === 200 && r.j && r.j.why === "expired") {
        const pd = S.pending[id];
        delete S.pending[id];
        S.owned = S.owned.filter(x => x !== id);
        for (const k of Object.keys(S.wear)) if (S.wear[k] === id) delete S.wear[k];
        if (pd && pd.price) wallet.add(pd.price);           // (her own coins back — not a reward)
        saveSoon();
        return { ok: false, why: "expired" };
    }
    return { ok: true, n: nHint || null, pending: true };
}
function restoreOne(id, n) {
    if (!pieceById(id)) return;
    if (!owns(id)) addOwned(id);
    if (n) S.nums[id] = n;
    saveSoon();
}
/** At launch / after she gets a name: finish paid-but-unconfirmed buys, then bring back what the server says is hers. */
export async function restore() {
    if (!hasAccount() || !base()) return false;
    for (const id of Object.keys(S.pending)) await confirm(id, null);
    let r;
    try { r = await req("/wear/mine", me()); } catch (e) { return false; }
    if (r.st !== 200 || !r.j || !Array.isArray(r.j.mine)) return false;
    if (r.j.stock) { L.stock = r.j.stock; L.online = true; L.at = performance.now(); }
    for (const m of r.j.mine) if (m.st === 2 && isLimited(m.p)) restoreOne(m.p, m.n);
    L.restored = true;
    emit("clothes:restored", {});
    return true;
}
on("accounts:me", ({ name }) => { if (name) restore().catch(() => { }); });
on("boot", () => setTimeout(() => { if (hasAccount()) restore().catch(() => { }); }, 6000));

export const limitedDebug = { L, req, confirm, base };
