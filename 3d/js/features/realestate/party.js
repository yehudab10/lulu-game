// features/realestate/party.js — 👯 STAGE 4: HOMES WITH FRIENDS (a 🎉 party's 🌍 Free Roam; the existing relay protocol only).
//
//   • each player publishes the homes they own IN THE TOWN THEY'RE IN, in their snapshot extras:
//       d.x.re = ["l178,240,1h3k", …]   (town letter + the door's local x,z + the minute she bought it in base 36 since
//       2026-01-01; ≤ 10, ~14 bytes each — only while she's in a town where she owns something: the party message has a
//       ~1900-character budget, nothing here is always on)
//   • friends' homes come into the registry as a SOURCE (registry.addSource): ownerOf(id) → { name, uid, hex } — so a
//     friend's home is never listed, can't be bought, gets a mailbox in that friend's colour, and ✋ at its door says
//     whose it is: 👯 JOIN <name> INSIDE when they're in (features/together shares the room — its instance is the
//     house id), "nobody home" otherwise. Visitors look, they don't redecorate; nobody's coins move.
//   • two friends buying the same home at once (a race no listing can stop): the EARLIER purchase keeps it (a tie → the
//     lower uid); the other gets back every coin they paid and a text from the realtor ("double-booked!").
// Strangers (the EVERYONE room) never publish d.x.re to us and are never asked: their homes are their own business.
import { ctx, emit } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { registry, S } from "./registry.js";
import { log } from "./deal.js";
import { SV } from "./server.js";
import { SLOTS } from "../decor/data.js";

// 🛋️ what a friend sees inside a home of hers (roadmap 23 d2): her decorations there, published as d.x.rd — a separate
// key so a client that doesn't know it simply ignores it — one entry per home in this town, parallel to d.x.re:
// "<re entry's id part>:<one base-36 char per decor slot (0 = nothing, k = the slot's k-th option)>"
export const RD_SLOTS = SLOTS.filter(s => ["bed", "lamp", "art", "shelf", "rug", "wallpaper", "door", "porch", "mailbox", "lawn", "couch"].includes(s.id)).map(s => s.id);
const slotOpts = id => (SLOTS.find(s => s.id === id) || { opts: [] }).opts;
function encodeRd(id) {
    const P0 = S.decor[id] || {};
    return RD_SLOTS.map(sl => { const k = slotOpts(sl).findIndex(o => o.id === P0[sl]); return k >= 0 && k < 35 ? (k + 1).toString(36) : "0"; }).join("");
}
function decodeRd(str) {
    if (typeof str !== "string" || str.length > RD_SLOTS.length) return null;
    const out = {};
    RD_SLOTS.forEach((sl, i) => { const k = parseInt(str[i] || "0", 36) - 1, o = slotOpts(sl)[k]; if (k >= 0 && o) out[sl] = o.id; });
    return out;
}

const TOWN_L = { lakewood: "l", midwood: "m" }, L_TOWN = { l: "lakewood", m: "midwood" };
const P = { cache: new Map(), at: 0, sent: "" };      // id → { uid, name, hex, since }
const party = () => !!(ctx.party && ctx.party.active);
export const roam = () => party() && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
const friends = () => (party() ? ctx.party.members().filter(u => u !== ctx.party.uid) : []);
const hexOf = uid => { try { return ctx.party.skinHex(ctx.party.skinOf(uid)); } catch (e) { return "#7E57C2"; } };

const EPOCH = Date.UTC(2026, 0, 1);
const encode = (id, h) => { const [town, x, z] = id.split(":"); const t = TOWN_L[town]; return t && x && z ? `${t}${x | 0},${z | 0},${Math.max(0, Math.floor(((h.since || 0) - EPOCH) / 60000)).toString(36)}` : null; };
function decode(s) {
    if (typeof s !== "string" || s.length > 24) return null;
    const m = /^([lm])(-?\d{1,4}),(-?\d{1,4}),([0-9a-z]{1,7})$/.exec(s);
    return m ? { id: `${L_TOWN[m[1]]}:${+m[2]}:${+m[3]}`, since: EPOCH + parseInt(m[4], 36) * 60000 } : null;
}

/** Called every second or so: publish mine, read my friends', settle a double booking. */
export function tick() {
    if (!party()) { if (P.cache.size) { P.cache.clear(); registry.changed({ id: null, why: "party" }); } P.sent = ""; return; }
    // mine (only the town I'm in — friends see homes where they stand)
    const town = ctx.town && ctx.town.active ? ctx.town.id : null;
    const mine = town ? registry.listFor(town).map(h => encode(h.id, h)).filter(Boolean).slice(0, 10) : [];
    const rd = town ? registry.listFor(town).slice(0, 10).map(h => `${h.id.split(":").slice(1).join(",")}:${encodeRd(h.id)}`) : [];
    const key = mine.join("|") + "#" + rd.join("|");
    if (key !== P.sent) { P.sent = key; try { ctx.party.setX("re", mine.length ? mine : null); ctx.party.setX("rd", rd.length ? rd : null); } catch (e) { /* not connected */ } }
    // theirs
    const next = new Map();
    for (const uid of friends()) {
        const p = ctx.party.peer(uid), a = p && p.x && Array.isArray(p.x.re) ? p.x.re : null;
        if (!a || !ctx.party.fresh(p, 8000)) continue;
        const rdA = p.x && Array.isArray(p.x.rd) ? p.x.rd : [];
        for (const s of a.slice(0, 10)) {
            const d = decode(s);
            if (!d || next.has(d.id)) continue;
            const xz = d.id.split(":").slice(1).join(","), r = rdA.find(e => typeof e === "string" && e.startsWith(xz + ":"));
            next.set(d.id, { uid, name: ctx.party.displayName(uid), hex: hexOf(uid), since: d.since, dc: r ? decodeRd(r.slice(xz.length + 1)) : null });
        }
    }
    let changed = next.size !== P.cache.size;
    if (!changed) for (const [id, o] of next) { const q = P.cache.get(id); if (!q || q.uid !== o.uid || JSON.stringify(q.dc) !== JSON.stringify(o.dc)) { changed = true; break; } }
    P.cache = next;
    // a double booking: the earlier buyer keeps it — unless the world-wide registry is up: then the SERVER decides (the
    // first claim to reach it), and the loser is refunded by server.js (two rules at once could make BOTH let go)
    for (const [id, o] of next) {
        const h = registry.get(id);
        if (!h || SV.on) continue;
        const mineT = EPOCH + Math.max(0, Math.floor(((h.since || 0) - EPOCH) / 60000)) * 60000;
        const iWin = mineT < o.since || (mineT === o.since && String(ctx.party.uid) < String(o.uid));
        if (iWin) continue;
        const m = S.mortgage[id];
        const back = Math.max(0, Math.round(m ? m.paidIn : (h.paid || 0)));
        delete S.mortgage[id]; delete S.rent[id]; delete S.decor[id];
        registry.release(id, "double-booked");
        if (back) wallet.add(back);
        log({ ev: "doubleBooked", id, n: back });
        saveSoon();
        emit("realestate:owner", { id, from: "lulu", to: null, price: back, why: "doubleBooked", address: h.address, town: h.town });
        try { ctx.phone.text({ from: "👩‍💼 Your realtor", need: true, emoji: "🏘️", msg: `OY. ${o.name} signed for ${h.address} a minute before you. Double-booked! Every coin's back in your pocket — ${back}. Come see me, I'll find you something BETTER. 💕`, dur: 4.6 }); } catch (e) { /* no phone */ }
        changed = true;
    }
    if (changed) registry.changed({ id: null, why: "friends" });
}

/** The registry source: my friends' homes. */
registry.addSource({
    ownerOf: id => { const o = P.cache.get(id); return o ? { name: o.name, uid: o.uid, hex: o.hex, friend: true } : null; },
    list: () => [...P.cache.entries()].map(([id, o]) => ({ id, name: o.name, uid: o.uid, hex: o.hex })),
});
export { P };

/** A friend's home `id` (in this town): her decorations there { slot: optId } | null — what a visitor sees inside. */
export function friendDecor(id) { const o = P.cache.get(id); return o && o.dc ? Object.assign({}, o.dc) : null; }
