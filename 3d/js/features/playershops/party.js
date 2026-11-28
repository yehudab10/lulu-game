// features/playershops/party.js — 👯 friends look round each other's shops (stage 1: looking only; buying is stage 2,
// real players through the relay). In a party she publishes her shops as d.x.ps — a short string each:
//   "<town>:<lx>:<lz>|<kind>|<shelf>"   shelf = 24 slots × 2 chars: the good's index in GOODS (base 36) + units (0–4)
// A friend's screen shows that front as HER shop (sign + 👀 LOOK ROUND) and its shelves as she stocked them.
// Strangers never see d.x.ps (party extras only reach the party).
import { ctx } from "../../core/ctx.js";
import { GOODS, KINDS, SHELF } from "./data.js";

const GK = Object.keys(GOODS);
const party = () => !!(ctx.party && ctx.party.active);
const friends = () => (party() && ctx.party.members ? ctx.party.members().filter(u => u !== ctx.party.uid) : []);
export const SHOP_PARTY = { sent: "", cache: [], at: 0 };
let S = null;
export function bindParty(state) { S = state; }

export function encodeShelf(shelf) {
    return (shelf || []).slice(0, SHELF.slots).map(x => (x && GK.indexOf(x.g) >= 0 ? GK.indexOf(x.g).toString(36) + Math.min(9, x.n | 0) : "--")).join("");
}
export function decodeShelf(str) {
    const out = new Array(SHELF.slots).fill(null);
    if (typeof str !== "string") return out;
    for (let i = 0; i < SHELF.slots; i++) {
        const c = str.slice(i * 2, i * 2 + 2);
        if (c.length < 2 || c === "--") continue;
        const g = GK[parseInt(c[0], 36)], n = parseInt(c[1], 10);
        if (g && n > 0) out[i] = { g, n: Math.min(SHELF.perSlot, n) };
    }
    return out;
}
/** Publish hers (only what changed). */
export function publish() {
    if (!party() || !S) { SHOP_PARTY.cache = []; return; }
    const mine = Object.entries(S.shops).map(([id, s]) => `${id.slice(5)}|${s.kind}|${encodeShelf(s.shelf)}`).slice(0, 4);
    const key = mine.join(";");
    if (key !== SHOP_PARTY.sent) { SHOP_PARTY.sent = key; try { ctx.party.setX("ps", mine.length ? mine : null); } catch (e) { /* not connected */ } }
    read();
}
function read() {
    const out = [];
    for (const uid of friends()) {
        const p = ctx.party.peer(uid), a = p && p.x && Array.isArray(p.x.ps) ? p.x.ps : null;
        if (!a || (ctx.party.fresh && !ctx.party.fresh(p, 8000))) continue;
        for (const s of a.slice(0, 4)) {
            if (typeof s !== "string") continue;
            const [where, kind, shelf] = s.split("|");
            const parts = (where || "").split(":");
            if (parts.length !== 3 || !KINDS[kind] || out.some(x => x.id === "shop:" + where)) continue;
            out.push({ id: "shop:" + where, town: parts[0], uid, kind, name: ctx.party.displayName ? ctx.party.displayName(uid) : "A friend", shelf: decodeShelf(shelf) });
        }
    }
    SHOP_PARTY.cache = out;
}
/** Friends' shops (in this party): [{ id, town, uid, kind, name, shelf }] */
export const friendShops = () => SHOP_PARTY.cache;
