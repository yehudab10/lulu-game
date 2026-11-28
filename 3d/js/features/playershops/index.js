// features/playershops — 🏪 PLAYER-OWNED SHOPS (roadmap 44, stage 1: client only). The plan: 3d/docs/playershops-plan.md.
//
// A few of each town's PLAIN storefronts (ctx.town.stores — decoration until now) stand FOR LEASE. On foot, ✋ at one:
// Mr. Gelbfish the landlord — LEASE it (a deposit + a small payment each day she plays; miss three and he changes the
// locks) or BUY the building (cash or the bank's mortgage desk plans: realestate/mortgage.js › takeFor — one bank, one
// set of rules). She picks what kind of shop from the town's LICENCES (a few per kind, so the street doesn't repeat);
// Midwood allows ONE shop per player (Mayor Marxdani's edict), Lakewood three. City Hall wants a permit (its errand);
// a building she owns pays property tax with her homes (cityhall/tax.js reads taxed()).
//
// Selling is the new mechanic: she STOCKS it — boxes from 📦 Feldman's Wholesale Depot at any rest area (as many as her
// car holds: CARRY), carried in from the car three at a time — or BAKES (kugel / cakes: one ingredients box → 4 with 1–3
// ⭐), then shelves them BY HAND, slot by slot, at a price inside the band. Food goes stale after a few real days.
// Nobody buys yet: only REAL players will (stage 2, the relay — waiting for the owner's OK), so her shop says OPENING
// SOON. Friends in a party can walk in and look round (d.x.ps). Every number: data.js.
import * as THREE from "three";
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { say, choose } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { SKINS } from "../../car.js";
import { CAP, TOTAL, FOR_LEASE, LEASE, BUY, BUY_TERMS, BUY_DOWN, SELL_FEE, PERMIT_KIND, TAX_RATE, EDICT, KINDS, LICENCES, GOODS,
    BAND, DEPOT, CARRY, HANDS, SHELF, STOCKROOM, ID, HEARING } from "./data.js";
import { addressAt } from "../realestate/market.js";
import * as MG from "../realestate/mortgage.js";
import { bindRoom, enterShop, ROOM } from "./room.js";
import { depotSpot, depotTick, bindDepot, depotTalk, DEPOT_STATE } from "./depot.js";
import { publish, friendShops, SHOP_PARTY, bindParty } from "./party.js";
import * as SVR from "./server.js";
import * as HR from "./hearing.js";

export const S = store(ID, { shops: {}, car: [], home: [], met: {}, day: null, log: [] });
if (!S.shops || typeof S.shops !== "object") S.shops = {};
if (!Array.isArray(S.car)) S.car = [];
if (!Array.isArray(S.home)) S.home = [];
if (!S.met) S.met = {};
const fmt = n => Math.round(n).toLocaleString("en-US");
const EDICT_ID = "shops";      // (cityhall/data.js › EDICTS — Marxdani's Retail Fairness Edict)
const LANDLORD = { who: "Mr. Gelbfish", emoji: "🧔", color: "#6D4C41" };
const o = { emoji: LANDLORD.emoji, color: LANDLORD.color };
export const today = () => (ctx.realestate && ctx.realestate.today ? ctx.realestate.today() : Math.floor(Date.now() / 86400000));
export function log(ev, data = {}) { S.log.push(Object.assign({ at: Date.now(), ev }, data)); if (S.log.length > 60) S.log.shift(); }
const party = () => !!(ctx.party && ctx.party.active);

// ── the storefronts of the town she's in ─────────────────────────────────────────────────────────────────────────
const W = { fronts: [], key: "", forLease: new Set(), t: 0, at: null, near: null, group: null, built: "" };
const townId = () => (ctx.town && ctx.town.active ? (ctx.town.def && ctx.town.def.base ? ctx.town.def.base.id : ctx.town.id) : null);
/** "shop:<town>:<lx>:<lz>" — lap-free, like a home's id. */
const idOf = (town, s) => `shop:${town}:${Math.round(s.lx)}:${Math.round(s.lz)}`;
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
/** The plain storefronts here as records (world coords of the copy she's in). */
export function fronts() {
    const T = ctx.town, town = townId();
    if (!town || !T.stores) return [];
    const list = T.stores;
    const nSF = ctx.storefronts && ctx.storefronts.debug && ctx.storefronts.debug.F ? ctx.storefronts.debug.F.list.length : 0;     // (re-match once its list is built)
    const key = `${town}@${list.length ? Math.round(list[0].x) + "," + Math.round(list[0].z) : 0}|${nSF}`;
    if (W.key === key && W.fronts.length) return W.fronts;
    W.key = key;
    W.fronts = list.map(s => {
        const id = idOf(town, s), nx = s.nx, nz = s.nz;
        const door = s.door || { x: s.lotX + nx * 0.4, z: s.lotZ + nz * 0.4 };
        return { id, town, key: s.key, x: s.x, z: s.z, nx, nz, ux: s.ux, uz: s.uz, rot: s.rot, w: s.w, door,
            ap: { x: door.x + nx * 1.6, z: door.z + nz * 1.6 }, anchor: s.anchor, sign: s.sign, address: addressAt(s.lx, s.lz) || "the high street" };
    });
    // ci/storefronts (on main): it owns every front's state — match its fronts to ours by the door (its ids are "town:i")
    // and offer exactly ITS FOR LEASE fronts; without it, a fixed few per town (by the week)
    const SF = ctx.storefronts;
    if (SF && SF.fronts) {
        const theirs = SF.fronts();
        for (const f of W.fronts) {
            let best = null, bd = 6;
            for (const t of theirs) { if (!t.door) continue; const d = Math.hypot(t.door.x - f.door.x, t.door.z - f.door.z); if (d < bd) { bd = d; best = t; } }
            f.sid = best ? best.id : null;
        }
        W.sfKey = key;
        W.forLease = leaseSet();
        return W.fronts;
    }
    const wk = Math.floor(today() / 7);
    const pickN = FOR_LEASE[town] || 4;
    W.forLease = new Set(W.fronts.slice().sort((a, b) => hash(a.id + ":" + wk) - hash(b.id + ":" + wk)).slice(0, pickN).map(f => f.id));
    return W.fronts;
}
const frontById = id => fronts().find(f => f.id === id) || null;
// ── ci/storefronts: its FOR LEASE fronts are ours to offer; we claim the ones we show (lease offers, her shops, others'
//    shops) so its ✋ shows our line and calls our enter — and our own ✋ spots stand down (one ✋ per door) ──
const CL = new Map();          // its front id → what we claimed it as ("lease" | "mine" | "other:<id>")
function leaseSet() {
    const SF = ctx.storefronts, out = new Set();
    if (!SF || !SF.leasable) return out;
    const ids = new Set(SF.leasable().map(l => l.id));
    for (const [sid, what] of CL) if (what === "lease") ids.add(sid);       // (ours are claimed: leasable() leaves them out)
    for (const f of W.fronts) if (f.sid && ids.has(f.sid)) out.add(f.id);
    return out;
}
const sfOn = () => !!(ctx.storefronts && ctx.storefronts.claim && W.fronts.some(f => f.sid));
function syncClaims() {
    const SF = ctx.storefronts;
    if (!SF || !SF.claim) return;
    const want = new Map();
    const oth = others();
    for (const f of W.fronts) {
        if (!f.sid) continue;
        if (S.shops[f.id]) want.set(f.sid, ["mine", f]);
        else { const x = oth.find(o => o.id === f.id); if (x) want.set(f.sid, ["other:" + x.id + (x.z ? ":z" : ""), f, x]); else if (W.forLease.has(f.id)) want.set(f.sid, ["lease", f]); }
    }
    for (const [sid, what] of CL) if (!want.has(sid) || want.get(sid)[0] !== what) { SF.release(sid); CL.delete(sid); }
    for (const [sid, [what, f, x]] of want) {
        if (CL.get(sid) === what) continue;
        const spec = what === "mine" ? { get label() { const n = S.car.length && carNear(f) ? Math.min(HANDS, S.car.length) : 0; return n ? `🏪 YOUR SHOP — CARRY ${n} BOX${n === 1 ? "" : "ES"} IN` : "🏪 YOUR SHOP — GO IN"; }, enter: () => goIn(f, "owner") }
            : what === "lease" ? { label: `🪧 FOR LEASE — ${f.address}`, enter: () => { landlord(f); return true; } }
            : x.z ? { label: "🚧 UNDER RENOVATION", enter: () => { if (ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, "Under renovation. The owner hasn't been by in weeks.", 2.6); return true; } }
            : { get label() { const y = others().find(o => o.id === x.id) || x, nm = (y.shopName || y.name + "'S").toUpperCase(); return y.server && SVR.SV.on ? (y.op === false ? `🔒 ${nm} — CLOSED (back soon)` : `🛍️ SHOP AT ${nm}${y.at ? " — SHE'S IN!" : ""}`) : `👀 LOOK ROUND ${y.name.toUpperCase()}'S SHOP`; }, enter: () => { visitShop(f, others().find(o => o.id === x.id) || x); return true; } };
        SF.claim(sid, spec); CL.set(sid, what);
    }
}
function dropClaims() { const SF = ctx.storefronts; if (SF && SF.release) for (const sid of CL.keys()) SF.release(sid); CL.clear(); }
export const mine = () => Object.entries(S.shops).map(([id, s]) => Object.assign({ id }, s));
/** Other players' shops here: friends in a party (d.x.ps) + everyone's on the relay (stage 2). [{ id, town, kind, name, server?, z?, shelf? }] */
export function others() {
    const out = friendShops().slice();
    for (const [id, x] of SVR.SV.list) if (!S.shops[id] && !out.some(o => o.id === id)) out.push({ id, town: id.split(":")[1], kind: x.k, name: x.o || "A neighbour", shopName: x.n, server: true, z: x.z, t: x.t, op: x.op, at: x.at, c: x.c });
    return out;
}
export const owns = id => !!S.shops[id];
const inTown = town => mine().filter(s => s.town === town);
/** For lease right now (not hers, not a friend's). */
export const leasable = () => fronts().filter(f => W.forLease.has(f.id) && !S.shops[f.id] && !others().some(x => x.id === f.id));
/** How many shops of `kind` the town still licenses (her own count; stage 2: everyone's, on the relay). */
export function licencesLeft(town, kind) {
    const all = (LICENCES[town] || {})[kind] || 0;
    const used = inTown(town).filter(s => s.kind === kind).length + others().filter(x => x.town === town && x.kind === kind).length;
    return Math.max(0, all - used);
}
/** How many shops a town allows her: Midwood's one becomes two once the court strikes Marxdani's edict down. */
export function capOf(town) {
    let n = CAP[town] || 1;
    try { if (town === "midwood" && ctx.cityhall && ctx.cityhall.mayor31 && ctx.cityhall.mayor31.struck && ctx.cityhall.mayor31.struck(EDICT_ID)) n += 1; } catch (e) { /* */ }
    return n;
}
/** Why she can't take another shop in `town` ("" = she can). */
export function capBlock(town) {
    if (mine().length >= TOTAL) return `${TOTAL} shops is the most anyone can run. Even the Rebbetzin only has three.`;
    if (inTown(town).length >= capOf(town)) return (EDICT[town] || EDICT.lakewood).refuse;
    return "";
}

// ── signing ──────────────────────────────────────────────────────────────────────────────────────────────────────
let busy = false;
async function landlord(f) {
    if (busy || !f) return;
    busy = true;
    try {
        const town = f.town, E = EDICT[town] || EDICT.lakewood;
        await say(LANDLORD.who, `${f.address}. A lovely shop. The last tenant sold umbrellas. In a drought. Lease it or buy the building.`, o);
        const why = capBlock(town);
        if (why) {
            await say(LANDLORD.who, why, o);
            // (Midwood's one-shop edict: she can appeal it in Courtroom 2B — stage 4, hearing.js)
            if (town === "midwood" && inTown(town).length >= capOf(town) && mine().length < TOTAL && !HR.struck()) {
                if (HR.filed()) { await say(LANDLORD.who, "Your appeal's on the docket. Courtroom 2B, the Midwood courthouse. Go! Argue! Win!", o); return; }
                const wait = HR.fileBlock();
                if (wait) { await say(LANDLORD.who, wait, o); return; }
                const k = await choose(LANDLORD.who, "Unless… you take the edict to court. People have won. People have also lost. It's a court.", [HEARING.file, "✖ Not today"], o);
                if (k === 0 && HR.file()) await say(LANDLORD.who, HEARING.filed, o);
            }
            return;
        }
        const price = BUY[town] || BUY.lakewood;
        const i = await choose(LANDLORD.who, `Lease: ${fmt(LEASE.deposit)} deposit now, then ${LEASE.perDay} a day you play. Buy: ${fmt(price)} for the whole building.`,
            [`📝 Lease it — ${fmt(LEASE.deposit)} 💰 now`, `🏦 Buy the building — ${fmt(price)} 💰`, "✖ Not today"], o);
        if (i === 0) await lease(f);
        else if (i === 1) await buyBuilding(f, price);
    } finally { busy = false; }
}
/** What will she sell? → kind | null (only kinds the town still licenses) */
async function pickKind(f) {
    const town = f.town, ids = Object.keys(KINDS).filter(k => licencesLeft(town, k) > 0);
    if (!ids.length) { await say(LANDLORD.who, "The licence office says every kind of shop is taken in this town. Ask again next week.", o); return null; }
    const i = await choose(LANDLORD.who, "And what will you sell? The licence office only allows a few of each kind.",
        ids.map(k => `${KINDS[k].emoji} A ${KINDS[k].name} (${licencesLeft(town, k)} licence${licencesLeft(town, k) === 1 ? "" : "s"} left)`).concat(["✖ Never mind"]), o);
    return i >= 0 && i < ids.length ? ids[i] : null;
}
async function lease(f) {
    const kind = await pickKind(f);
    if (!kind) return;
    if (wallet.coins < LEASE.deposit) { await say(LANDLORD.who, `The deposit's ${fmt(LEASE.deposit)}. You have ${fmt(wallet.coins)}. I can count. Come back.`, o); return; }
    const j = await choose(LANDLORD.who, `${KINDS[kind].emoji} A ${KINDS[kind].name} at ${f.address}. ${fmt(LEASE.deposit)} now, back when you hand me the keys. ${LEASE.perDay} a day you play. Miss ${LEASE.missLocks} days and I change the locks.`,
        [`✅ Sign the lease — ${fmt(LEASE.deposit)} 💰`, "✖ Not yet"], o);
    if (j !== 0) return;
    if (!await serverClaim(f, kind)) return;
    if (!wallet.spend(LEASE.deposit)) { SVR.release(f.id); return; }
    open(f, kind, { how: "lease", deposit: LEASE.deposit });
    await afterSign(f, kind);
}
async function buyBuilding(f, price) {
    const kind = await pickKind(f);
    if (!kind) return;
    const plans = [];
    for (const d of BUY_DOWN) for (const t of BUY_TERMS) plans.push(MG.plan(price, d, t, BUY_DOWN[0]));
    const rows = [`💰 Cash — ${fmt(price)} 💰`].concat(plans.map(p => `🏦 ${fmt(p.down)} down, then ${fmt(p.perDay)} a day for ${p.days} days`), ["✖ Not yet"]);
    const i = await choose(LANDLORD.who, "Cash, or the bank? Their mortgage desk does shops the same as homes.", rows, o);
    if (i < 0 || i >= rows.length - 1) return;
    if (i === 0) {
        if (wallet.coins < price) { await say(LANDLORD.who, `It's ${fmt(price)}. You have ${fmt(wallet.coins)}. The bank does mortgages, you know.`, o); return; }
        const j = await choose(LANDLORD.who, `${f.address}, the whole building, for ${fmt(price)}. Sure?`, [`✅ Buy it — ${fmt(price)} 💰`, "✖ Not yet"], o);
        if (j !== 0 || !await serverClaim(f, kind)) return;
        if (!wallet.spend(price)) { SVR.release(f.id); return; }
        open(f, kind, { how: "own", price, paid: price });
    } else {
        const p = plans[i - 1];
        if (wallet.coins < p.down) { await say(LANDLORD.who, `The bank wants ${fmt(p.down)} down. You have ${fmt(wallet.coins)}.`, o); return; }
        const j = await choose(LANDLORD.who, `${fmt(p.down)} down now, then ${fmt(p.perDay)} a day you play, ${p.days} days (the bank's fee: ${fmt(p.fee)}). Miss three days and the bank takes it back.`,
            [`✅ Sign — ${fmt(p.down)} 💰 down`, "✖ Not yet"], o);
        if (j !== 0 || !await serverClaim(f, kind)) return;
        const id = f.id;
        S.shops[id] = { pending: true };          // (so the bank's kind check sees it as hers)
        const r = MG.takeFor(id, { address: f.address, town: f.town }, p);
        delete S.shops[id];
        if (!r.ok) { SVR.release(id); await say(LANDLORD.who, "The bank said no. They didn't say why. Banks never say why.", o); return; }
        open(f, kind, { how: "own", price, paid: p.down, mortgage: true });
    }
    await afterSign(f, kind);
}
/** The world-wide registry says yes first (taken / the edict / licences / the cap) — before any coin moves. */
async function serverClaim(f, kind) {
    const c = await SVR.claim(f.id, kind, capOf("midwood") > (CAP.midwood || 1));
    if (c.ok) return true;
    const E = EDICT[f.town] || EDICT.lakewood;
    const line = c.why === "taken" ? `Oy. ${c.o || "Somebody"} JUST signed for this one. A minute ago. The ink's still wet.`
        : c.why === "edict" || c.why === "cap" ? E.refuse
        : c.why === "licence" ? "The licence office says that kind is all taken in this town. Pick something else."
        : "The town's computer is thinking. Try again in a moment.";
    await say(LANDLORD.who, line, o);
    W.built = "";
    return false;
}
function open(f, kind, extra) {
    const d = today();
    S.shops[f.id] = Object.assign({ town: f.town, kind, address: f.address, since: Date.now(), day: d, last: d, due: false, missed: 0,
        shelf: new Array(SHELF.slots).fill(null), stock: [], name: `Lulu's ${KINDS[kind].name}` }, extra);
    try { if (ctx.cityhall && ctx.cityhall.permits && ctx.cityhall.permits.need) ctx.cityhall.permits.need(PERMIT_KIND, f.id); } catch (e) { /* no city hall */ }
    log("open", { id: f.id, kind, how: extra.how });
    emit("playershops:open", { id: f.id, kind, how: extra.how, town: f.town });
    emit("stat", { id: "shopsOpened", n: 1 });
    saveSoon();
    W.built = "";
}
async function afterSign(f, kind) {
    const E = EDICT[f.town] || EDICT.lakewood;
    await say(LANDLORD.who, "Mazel tov. The keys. Don't lose them, I only have the one copy. And the other copy.", o);
    await say("City Hall", E.sign, { emoji: "🏛️", color: "#455A64" });
    await say("Lulu", `My own ${KINDS[kind].name}! Next: stock from the 📦 Wholesale Depot at a rest area${KINDS[kind].bake ? ", or bake it myself in the back" : ""}. And a permit from City Hall.`, { emoji: "💁‍♀️" });
}
/** Give it back: a lease → the deposit back; a building → sold at its price less the fee and what the bank's still owed. */
export function release(id, why = "keys") {
    const s = S.shops[id];
    if (!s) return 0;
    let back = 0;
    if (s.how === "lease") back = s.deposit || 0;
    else if (why === "sold") {
        const m = (MG.mortgages().find(x => x.id === id));
        back = Math.max(0, Math.round((s.price || 0) * (1 - SELL_FEE)) - (m ? MG.owed(m) : 0));
    }
    // what's on the shelves + in the back room goes home in boxes
    for (const x of (s.stock || []).concat((s.shelf || []).filter(Boolean))) S.home.push({ g: x.g, n: x.n, stars: x.stars || 0 });
    if (S.home.length > 60) S.home.splice(0, S.home.length - 60);
    delete S.shops[id];
    SVR.release(id);
    if (why === "sold" && MG.mortgages().some(x => x.id === id)) { try { delete ctx.realestate.debug.S.mortgage[id]; } catch (e) { /* */ } }
    if (back) wallet.add(back);
    log("release", { id, why, back });
    emit("playershops:release", { id, why, back });
    saveSoon();
    W.built = "";
    return back;
}
MG.addKind("shop", {
    owns: id => !!S.shops[id],
    value: id => (S.shops[id] && S.shops[id].price) || 0,
    release: (id, why) => release(id, why),
});

// ── the days she plays: the lease, food going stale ──────────────────────────────────────────────────────────────
function dayTick() {
    const d = today();
    if (S.day === d) return;
    const first = S.day == null;
    S.day = d;
    if (first) { saveSoon(); return; }
    for (const s of mine()) {
        const sh = S.shops[s.id];
        // stale food: gone from the shelves + the back room
        const fresh = x => !x || !GOODS[x.g] || !GOODS[x.g].stale || d - (x.day || d) < GOODS[x.g].stale;
        const before = (sh.stock || []).length + sh.shelf.filter(Boolean).length;
        sh.stock = (sh.stock || []).filter(fresh);
        sh.shelf = sh.shelf.map(x => (fresh(x) ? x : null));
        const lost = before - sh.stock.length - sh.shelf.filter(Boolean).length;
        if (lost) SVR.dirty(s.id);
        if (lost) text(`🗑️ ${lost} thing${lost === 1 ? "" : "s"} went stale at ${sh.address}. Into the bin. The pigeons say thank you.`);
        if (sh.how !== "lease") continue;
        if (d > sh.last) {
            if (sh.due) {
                sh.missed = (sh.missed || 0) + 1;
                if (sh.missed >= LEASE.missLocks) { const back = release(s.id, "locks"); text(`🔒 Mr. Gelbfish changed the locks at ${sh.address}. Your stock is in boxes at home. Deposit back: ${fmt(back)}.`); continue; }
                if (sh.missed >= LEASE.missLetter) text(`📄 A note under the shop door: "Rent. ${LEASE.perDay}. Please. — Gelbfish"`);
            }
            sh.last = d; sh.due = true;
        }
    }
    saveSoon();
}
function payTick() {
    for (const s of mine()) {
        const sh = S.shops[s.id];
        if (sh.how === "lease" && sh.due && wallet.coins >= LEASE.perDay && wallet.spend(LEASE.perDay)) { sh.due = false; sh.missed = 0; sh.paid = (sh.paid || 0) + LEASE.perDay; log("rent", { id: s.id, n: LEASE.perDay }); saveSoon(); }
    }
}
function text(msg) { try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: `${LANDLORD.emoji} ${LANDLORD.who}`, emoji: "🏪", color: LANDLORD.color, msg, thread: "realtor", need: true, dur: 4.4 }); } catch (e) { /* */ } }

// ── stock: the car → the back room → the shelves ─────────────────────────────────────────────────────────────────
/** Boxes her car holds (by its marque / skin / name). */
export function carCap() {
    let tag = "";
    try {
        const k = ctx.car && ctx.car.skinKey, def = k ? SKINS[k] : null, pc = ctx.foot && ctx.foot.parkedCar;
        tag = [pc && pc.key, k, def && def.marque, def && def.kit, def && def.name].filter(Boolean).join(" ");
    } catch (e) { tag = ""; }
    for (const c of CARRY) if (c.match.test(tag)) return c.n;
    return 6;
}
export const carBoxes = () => S.car.length;
/** Carry boxes from her car into shop `id` (≤ HANDS a trip, ≤ the back room's room). → how many */
export function carryIn(id) {
    const sh = S.shops[id];
    if (!sh || !S.car.length) return 0;
    const room = STOCKROOM - (sh.stock || []).length;
    const n = Math.max(0, Math.min(HANDS, S.car.length, room));
    for (let k = 0; k < n; k++) { const b = S.car.shift(); sh.stock.push({ g: b.g, n: b.n, stars: b.stars || 0, day: b.day || today(), ing: !!b.ing }); }
    if (n) { log("carry", { id, n }); saveSoon(); }
    return n;
}
/** A box of `g` into her car (the depot). → bool */
export function loadCar(g, ing = false) {
    if (S.car.length >= carCap()) return false;
    S.car.push({ g, n: ing ? 1 : GOODS[g].box, day: today(), ing });
    saveSoon();
    return true;
}
/** The price band for good g (and stars). → [lo, hi] */
export function band(g, stars = 0) {
    const c = GOODS[g].cost;
    const top = GOODS[g].baked ? BAND.starTop[Math.max(0, Math.min(2, (stars || 1) - 1))] : BAND.max;
    return [Math.ceil(c * BAND.min), Math.floor(c * top)];
}
/** Shelve: the back room's stock item `k` → shelf slot `slot` at `price` (≤ perSlot units). → bool */
export function shelve(id, k, slot, price) {
    const sh = S.shops[id], it = sh && sh.stock[k];
    if (!it || it.ing || slot < 0 || slot >= SHELF.slots) return false;
    const cur = sh.shelf[slot];
    if (cur && (cur.g !== it.g || (cur.stars || 0) !== (it.stars || 0))) return false;
    const [lo, hi] = band(it.g, it.stars);
    const p = Math.max(lo, Math.min(hi, Math.round(price)));
    const have = cur ? cur.n : 0, take = Math.min(SHELF.perSlot - have, it.n);
    if (take <= 0) return false;
    sh.shelf[slot] = { g: it.g, n: have + take, price: p, stars: it.stars || 0, day: Math.min(it.day || today(), cur ? cur.day : Infinity) };
    it.n -= take;
    if (it.n <= 0) sh.stock.splice(k, 1);
    log("shelve", { id, g: it.g, slot, n: take, p });
    saveSoon();
    emit("playershops:shelve", { id, slot });
    SVR.dirty(id);
    return true;
}
/** Off a shelf back into the back room. */
export function unshelve(id, slot) {
    const sh = S.shops[id], x = sh && sh.shelf[slot];
    if (!x) return false;
    if (sh.stock.length >= STOCKROOM) return false;
    sh.stock.push({ g: x.g, n: x.n, stars: x.stars, day: x.day });
    sh.shelf[slot] = null;
    saveSoon();
    SVR.dirty(id);
    return true;
}
/** Bake: one ingredients box of `g` → BAKE units with `stars` (the room's oven game decides the stars). */
export function bakeDone(id, k, stars) {
    const sh = S.shops[id], it = sh && sh.stock[k];
    if (!it || !it.ing) return false;
    sh.stock.splice(k, 1);
    sh.stock.push({ g: it.g, n: 4, stars: Math.max(1, Math.min(3, stars | 0)), day: today() });
    log("bake", { id, g: it.g, stars });
    emit("stat", { id: "shopBakes", n: 1 });
    saveSoon();
    return true;
}
/** Buildings she owns (City Hall taxes these with her homes; a lease isn't taxed). */
export const taxed = () => mine().filter(s => s.how === "own").map(s => ({ id: s.id, address: `🏪 ${s.address}`, price: Math.round((s.price || 0) * TAX_RATE / 0.002) }));     // (City Hall bills its own rate × price: scaled so a shop pays TAX_RATE)
/** Has City Hall stamped her permit for this shop? */
export const permitted = id => { try { return !!(ctx.cityhall && ctx.cityhall.permits && ctx.cityhall.permits.has(id)); } catch (e) { return false; } };

// ── in town: the FOR LEASE posters, her shop's sign, the ✋ spots ───────────────────────────────────────────────────
const TEX = new Map();
function plateTex(lines, bg, fg, wide = false) {
    const k = lines.join("|") + bg + wide;
    if (TEX.has(k)) return TEX.get(k);
    const c = document.createElement("canvas"); c.width = wide ? 1024 : 512; c.height = wide ? 120 : 256;
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = fg; g.lineWidth = wide ? 6 : 10; g.strokeRect(5, 5, c.width - 10, c.height - 10);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    if (wide) {     // a shop sign: one line, the name big + the status small
        const a = lines[0], b = lines[1] ? "  ·  " + lines[1] : "";
        g.font = "bold 62px sans-serif"; let wa = g.measureText(a).width; g.font = "bold 34px sans-serif"; let wb = g.measureText(b).width;
        const k = Math.min(1, (c.width - 48) / (wa + wb)), fa = Math.floor(62 * k), fb = Math.floor(34 * k);
        wa *= k; wb *= k;
        const x0 = c.width / 2 - (wa + wb) / 2;
        g.textAlign = "left"; g.font = `bold ${fa}px sans-serif`; g.fillText(a, x0, 64); g.font = `bold ${fb}px sans-serif`; g.globalAlpha = 0.85; g.fillText(b, x0 + wa, 66); g.globalAlpha = 1;
    } else {
        const n = lines.length;
        lines.forEach((l, i) => { g.font = `bold ${i === 0 ? 54 : 34}px sans-serif`; g.fillText(l, 256, 128 + (i - (n - 1) / 2) * (n > 2 ? 62 : 72)); });
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    TEX.set(k, t);
    return t;
}
const GEO = { poster: null };
function poster(f, lines, bg, fg, w = 1.6, h = 0.8, y = 1.55, at = null, wide = false) {
    GEO.poster = GEO.poster || new THREE.PlaneGeometry(1, 1);
    const m = new THREE.Mesh(GEO.poster, new THREE.MeshBasicMaterial({ map: plateTex(lines, bg, fg, wide), toneMapped: false }));
    m.scale.set(w, h, 1);
    const p = at || { x: f.door.x + f.nx * 0.08, y, z: f.door.z + f.nz * 0.08 };
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = Math.atan2(f.nx, f.nz);
    m.name = "PS_" + f.id;
    return m;
}
function layout() {
    const town = townId();
    if (!town || !ctx.scene) { clearSigns(); return; }
    const L = fronts();
    const fr = others();
    const key = `${W.key}|${[...W.forLease].join(",")}|${Object.keys(S.shops).map(id => id + (S.shops[id].kind || "")).join(",")}|${fr.map(x => x.id + x.kind + x.name + (x.z ? "z" : "")).join(",")}|${SVR.SV.on}`;
    if (W.built === key && W.group) return;
    clearSigns();
    W.built = key;
    W.group = new THREE.Group(); W.group.name = "PlayerShops";
    for (const f of L) {
        const sh = S.shops[f.id], fs = fr.find(x => x.id === f.id);
        if (sh || fs) {
            const k = KINDS[(sh || fs).kind] || KINDS.kugel;
            const name = sh ? sh.name.toUpperCase() : fs.shopName ? fs.shopName.toUpperCase() : `${fs.name.toUpperCase()}'S ${k.name.toUpperCase()}`;
            const status = fs && fs.z ? "🚧 UNDER RENOVATION" : SVR.SV.on ? "OPEN" : "OPENING SOON";
            const at = f.anchor ? { x: f.anchor.x + f.nx * 0.06, y: f.anchor.y, z: f.anchor.z + f.nz * 0.06 } : null;
            // (over the storefront's own sign band: town_mw_store's is 8.4 × 0.9, town_shop's 10 × 0.98)
            const big = f.key === "town_mw_store" ? [8.7, 1.02] : [10.3, 1.1];
            W.group.add(poster(f, [`${k.emoji} ${name}`.slice(0, 30), status], fs && fs.z ? "#607D8B" : k.color, "#FFFFFF", big[0], big[1], 3.2, at, true));
        } else if (W.forLease.has(f.id) && !f.sid) {
            W.group.add(poster(f, ["FOR LEASE", "ask Mr. Gelbfish", "✋ at the door"], "#FFF8E1", "#B71C1C"));
        }
    }
    ctx.scene.add(W.group);
}
function clearSigns() { if (W.group) { W.group.removeFromParent(); W.group.traverse(m => { if (m.material) m.material.dispose(); }); } W.group = null; W.built = ""; }
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
const canAct = () => !!(townId() && ctx.state === "footRun" && ctx.foot && ctx.foot.active && ctx.foot.phase === "walk");
function nearestFront(list, r) {
    const p = herPos(); if (!p) return null;
    let best = null, bd = r;
    for (const f of list) { const d = Math.hypot(f.ap.x - p.x, f.ap.z - p.z); if (d < bd) { bd = d; best = f; } }
    return best;
}
const leaseSpot = {
    r: 2.6, short: "FOR LEASE",
    pos() { W.near = canAct() && !sfOn() ? nearestFront(leasable(), 2.6) : null; return W.near ? W.near.ap : null; },
    label() { return W.near ? `🪧 FOR LEASE — ${W.near.address}` : null; },
    act() { if (W.near) landlord(W.near); },
};
const shopSpot = {
    r: 2.8, short: "MY SHOP", door: true,
    pos() { W.mine = canAct() ? nearestFront(fronts().filter(f => S.shops[f.id] && !(sfOn() && f.sid)), 2.8) : null; return W.mine ? W.mine.ap : null; },
    label() {
        if (!W.mine) return null;
        const n = S.car.length && carNear(W.mine) ? Math.min(HANDS, S.car.length) : 0;
        return n ? `🏪 YOUR SHOP — CARRY ${n} BOX${n === 1 ? "" : "ES"} IN` : "🏪 YOUR SHOP — GO IN";
    },
    act() { if (W.mine) goIn(W.mine, "owner"); },
};
const friendSpot = {
    r: 2.8, short: "SHOP", door: true,
    pos() { W.fr = canAct() ? nearestFront(fronts().filter(f => !(sfOn() && f.sid) && others().some(x => x.id === f.id && !x.z)), 2.8) : null; return W.fr ? W.fr.ap : null; },
    label() {
        const x = W.fr && others().find(s => s.id === W.fr.id);
        if (!x) return null;
        return x.server && SVR.SV.on ? `🛍️ SHOP AT ${(x.shopName || x.name + "'S").toUpperCase()}` : `👀 LOOK ROUND ${x.name.toUpperCase()}'S SHOP`;
    },
    act() { const x = W.fr && others().find(s => s.id === W.fr.id); if (x) visitShop(W.fr, x); },
};
/** Into another player's shop: a friend's (looking) or, with the relay up, anyone's (buying). */
async function visitShop(f, x) {
    if (x.server && SVR.SV.on) {
        const v = await SVR.view(f.id);
        if (v && v.ok && v.shop && v.shop.op === 0) { if (ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, `Locked. A note: "Back soon! — ${v.shop.o || "the owner"}". No clerk either.`, 2.8); return; }
        if (!v || !v.ok) { if (ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, "Closed. The sign says 'back in 5 minutes'. It always says that.", 2.6); return; }
        const shelf = new Array(SHELF.slots).fill(null);
        for (const it of v.shelf || []) if (it.s >= 0 && it.s < SHELF.slots && GOODS[it.g]) shelf[it.s] = { g: it.g, n: it.n, price: it.p, stars: it.st, so: !!it.so };
        return enterShop(f, "shop", { id: f.id, name: v.shop.o || x.name, shopName: v.shop.n, kind: v.shop.k, shelf, thumbs: v.shop.t | 0, at: !!v.shop.at, clerk: !!v.shop.c });
    }
    return goIn(f, "visit", x);
}
/** Is her car parked within 30 m of the shop (so she can carry boxes in)? */
function carNear(f) {
    const pc = ctx.foot && ctx.foot.parkedCar, p = pc ? { x: pc.x, z: pc.z } : null;
    return !!(p && Math.hypot(p.x - f.door.x, p.z - f.door.z) < 30);
}
function goIn(f, mode, friend = null) {
    if (mode === "owner") {
        const n = carNear(f) ? carryIn(f.id) : 0;
        if (n && ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, `${n} box${n === 1 ? "" : "es"} in. ${S.car.length ? S.car.length + " still in the car." : "That's the lot!"}`, 2.6);
    }
    return enterShop(f, mode, friend);
}

// ── 📍 the Map (ctx.pins): her shops (always shown) + everyone's she's walked past, with their 👍 ──
const PIN = { key: "", ids: new Set() };
function pinTick() {
    const P = ctx.pins;
    if (!P || !P.add) return;
    const rows = mine().map(sh => ({ id: "pshop:" + sh.id, town: sh.town, local: sh.id.split(":").slice(2).map(Number), cat: "mine", icon: (KINDS[sh.kind] || KINDS.kugel).emoji,
        name: sh.name, sub: `${sh.how === "lease" ? "your shop (leased)" : "your shop"}${sh.thumbs ? " · " + sh.thumbs + " 👍" : ""}`, group: sh.town }));
    for (const [id, x] of SVR.SV.list) if (!S.shops[id] && !x.z) rows.push({ id: "pshop:" + id, town: id.split(":")[1], local: id.split(":").slice(2).map(Number), cat: "shops",
        icon: (KINDS[x.k] || KINDS.kugel).emoji, name: x.n || `${x.o || "A neighbour"}'s ${(KINDS[x.k] || KINDS.kugel).name}`, sub: `${x.t ? x.t + " 👍 · " : ""}${x.op === false ? "closed right now" : "open"}`, group: id.split(":")[1] });
    const key = rows.map(r => r.id + r.sub + r.name).join("|");
    if (key === PIN.key) return;
    PIN.key = key;
    const now = new Set(rows.map(r => r.id));
    for (const id of PIN.ids) if (!now.has(id)) P.remove(id);
    for (const r of rows) P.add(r);
    PIN.ids = now;
}

// ── stage 2: the relay (server.js) ──
/** Her hello: what sold comes off her shelves, the till comes to her phone. */
function helloNow() {
    return SVR.hello(S).then(r => {
        if (r.coins > 0) { wallet.add(r.coins); log("till", { n: r.coins }); text(`🛎️ Your shop${mine().length > 1 ? "s" : ""} sold ${r.sold || "some"} thing${r.sold === 1 ? "" : "s"} while you were out. The till: ${fmt(r.coins)} coins (the town kept its 15 %).`); }
        if (r.sold) { saveSoon(); W.built = ""; }
        return r;
    });
}
const SVT = { busy: false };
function serverTick() {
    if (SVT.busy) return;
    const t = SVR.svNow(), V = SVR.SV;
    let job = null;
    if (!V.on) { if (t - V.probeAt > (V.probeAt < 0 ? 3 : 600)) job = SVR.probe(); }
    else if (townId() && (V.town !== townId() || t - V.listAt > 120)) job = SVR.list(townId()).then(() => { W.built = ""; });
    else if ((ctx.state === "playing" || ctx.state === "footRun") && t - V.helloAt > 300 && Object.keys(S.shops).length) job = helloNow();
    else job = SVR.pushTick(S);
    if (job && job.then) { SVT.busy = true; job.catch(() => null).finally(() => { SVT.busy = false; }); }
}

// ── the API ──────────────────────────────────────────────────────────────────────────────────────────────────────
bindRoom({ S, shelve, unshelve, band, bakeDone, release, permitted, today, SVR });
bindParty(S);
HR.bindHearing({ S, today, log });
bindDepot({ mine, carBoxes, carCap, loadCar });
ctx.playershops = {
    mine, owns, others, fronts, leasable, licencesLeft, capBlock, capOf, carCap, carBoxes, taxed, permitted,
    /** ci/storefronts: is this storefront ours? → null | { state: "lease" | "player", name, kind, owner } */
    claim(frontId) {
        const id = String(frontId).startsWith("shop:") ? frontId : "shop:" + frontId;
        const s = S.shops[id]; if (s) return { state: "player", name: s.name, kind: s.kind, owner: "me" };
        const fs = others().find(x => x.id === id); if (fs) return { state: "player", name: fs.name, kind: fs.kind, owner: fs.uid || "player" };
        return W.forLease.has(id) ? { state: "lease" } : null;
    },
    debug: { S, W, CL, syncClaims, helloNow, SVR, HR, others, visitShop, fronts, landlord, enterShop, depotTalk, DEPOT_STATE, capOf, open, release, loadCar, carryIn, shelve, unshelve, bakeDone, band, dayTick, layout, ROOM, today, frontById, SHOP_PARTY, clear() { S.shops = {}; S.car = []; S.home = []; S.day = null; saveSoon(); W.built = ""; return true; } },
};
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) for (const sp of [leaseSpot, shopSpot, friendSpot, depotSpot]) ctx.foot.addSpot(sp);
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
});
on("town:leave", () => { clearSigns(); dropClaims(); });
on("title", clearSigns);
on("town:enter", () => { W.key = ""; W.built = ""; dropClaims(); });
hook("hud", dt => {
    if ((W.t += dt) < 0.5) return;
    W.t = 0;
    // (each step on its own: one failing never stops the others — the claims must follow the party / the relay)
    const step = (name, fn) => { try { fn(); } catch (e) { W.err = `${name}: ${e && e.message}`; console.error("[playershops] " + name, e); } };
    if (ctx.state === "playing" || ctx.state === "footRun") { step("day", dayTick); step("pay", payTick); }
    step("party", publish);            // (first: friends' shops as they are NOW, then the signs + claims follow them)
    if (townId()) { step("layout", layout); step("claims", syncClaims); } else { step("clear", () => { if (W.group) clearSigns(); if (CL.size) dropClaims(); }); }
    step("depot", depotTick);
    step("server", serverTick);
    step("pins", pinTick);
});
