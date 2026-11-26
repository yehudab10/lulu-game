// features/decor — 🛋️ SOMEWHERE FOR COINS TO GO (roadmap step 9): the family house, and the decorating catalogue.
//
// ROADMAP 23 (ci/moveout, the owner 2026-11-26): the family house on E 34th St is IMA'S — "not their own, more like a
// temporary place until they settle on their own". So there's NO decorating there any more: the house and the street
// always look the way Ima keeps them (every slot's first option), the ✋ porch / mailbox / yard spots and the room's
// redecorate spots are gone, and friends don't come in (moveout.js: a refusal at the door). The CATALOGUE, the
// wallet and ownership stay here: `buy` is what features/realestate's own homes call, and everything she ever bought
// stays hers (`owns`) — packed in boxes in her room at Ima's (moveout.js) and free to put up in a home she owns.
// The rest of this header is the old design (kept for the catalogue / props / picker, which own homes still use):
//
// A run starts at home on foot (features/world). Her FRONT DOOR is a ✋ spot now: GO INSIDE is a soft cut (the
// house is warmed while she stands on the porch) into her own house (house.js — the kitchen with Ima, the living
// room, LULU'S ROOM). Outside, the porch, the mailbox and the front yard are ✋ spots too. At any of them the
// picker card (picker.js) offers what can go THERE, with prices: moving over a choice previews it in place, a
// first press on something new asks "Buy · 120 💰?", the second buys it — it appears at once and stays (saved).
// What's outside (the door's colour, the porch, the mailbox, the flamingos…) is seen every time the game starts.
//
// THE RULES: a coin SINK only (AGENTS golden rule 5). Buying spends from the shared wallet (`wallet.spend`, which
// never goes below 0); everything bought is hers for good and swapping between owned things is free; nothing
// here pays coins, refunds or resells. Themed SETS (data.js) are only noticed — a banner + a scrapbook stat.
// Personal: in a 🎉 party nothing is sold and nothing is moved (your decorations still show outside on your own
// screen). With friends in 🌍 Free Roam the house is a place to HANG OUT (features/together): ✋ GO INSIDE works,
// and the first friend through the door hosts the visit — whoever comes in after sees THAT friend's decorations
// (d.x.dc, published by everyone inside) and the friends inside see each other. Looking only: no picker, no
// buying, nobody's coins. Dina's mode never comes here.
//
// Perf: each placed decoration is ONE merged vertex-coloured mesh per material (props.js: 1–3 draw calls, four
// shared materials); the outside ones hang off the home street's group (hidden with it ~900 m away); nothing
// runs per frame outside the house except the four ✋ spots' distance checks while she's on foot near home.
//
// Service ctx.decor: owns(slot, opt) · placed(slot) · buy(slot, opt) → {ok, why} · place(slot, opt) · allowed() ·
// slots · spent · enter() · pick(slot) · debug. Events: decor:buy {slot, opt, price} · decor:place {slot, opt} ·
// decor:set {id}. Stats: decorBought, decorSpent, decorSets, decorVisits. Save: store("decor").
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { home, S_HOME } from "../world/home.js";
import { SLOTS, SETS, slotById, optOf, setPieces, LINES } from "./data.js";
import { buildOption, disposeObj, YARD_SOLIDS } from "./props.js";
import { pickerOpen, closePicker, pickerSlot } from "./picker.js";
import { bindHouse, houseRoom, HOUSE_ID, HOUSE_SPOTS } from "./house.js";
import "./moveout.js";              // (roadmap 23: Ima's house is temporary — boxes, hints, no friends inside)

const S = store("decor", { owned: {}, placed: {}, spent: 0, bought: 0, sets: [], visits: 0, nudges: 0 });
// (a hand-edited / old save: keep only what the catalogue knows)
for (const k of Object.keys(S.owned)) if (!slotById(k) || !Array.isArray(S.owned[k])) delete S.owned[k];
for (const k of Object.keys(S.placed)) if (!slotById(k)) delete S.placed[k];
if (!Array.isArray(S.sets)) S.sets = [];

const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString("en-US");

// ── owning + placing ─────────────────────────────────────────────────────
const isDefault = (slot, id) => { const s = slotById(slot); return !!s && s.opts[0].id === id; };
export function owns(slot, id) { return isDefault(slot, id) || !!(S.owned[slot] && S.owned[slot].includes(id)); }
export function placed(slot) {
    const s = slotById(slot);
    if (!s) return null;
    const id = S.placed[slot];
    return id && optOf(s, id) && owns(slot, id) ? id : s.opts[0].id;
}
/** Decorating is personal: never in a 🎉 party. */
export function allowed() { return !(ctx.party && ctx.party.active) && (!ctx.G || ctx.G.mode !== "party"); }
/** Going inside: solo, or with friends in 🌍 Free Roam (a visit — features/together shares the room). */
export function canEnter() {
    if (allowed()) return true;
    return !!(ctx.party && ctx.party.active && ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
}
/** What Ima's house shows for a slot: always Ima's own (the first option) — nobody decorates Ima's house. */
const imas = slot => { const s = slotById(slot); return s ? s.opts[0].id : null; };

/** Buy something (the picker's second press). → { ok, why: "party" | "bad" | "coins" | "owned" } */
export function buy(slot, id) {
    const s = slotById(slot), o = optOf(s, id);
    if (!s || !o) return { ok: false, why: "bad" };
    if (!allowed()) return { ok: false, why: "party" };
    if (owns(slot, id)) { place(slot, id); return { ok: true, why: "owned" }; }
    const price = Math.max(0, Math.round(o.price || 0));
    if (price > 0 && !wallet.spend(price)) {
        const short = price - wallet.coins;
        H.toast(`💸 ${fmt(short)} more coins for the ${o.name}`, "red", { key: "decorBroke" });
        luluSay(pick(LINES.luluBroke));
        A.sfxBump();
        return { ok: false, why: "coins" };
    }
    (S.owned[slot] = S.owned[slot] || []).push(id);
    S.spent += price; S.bought++;
    saveSoon();
    H.toast(`🛍️ ${o.icon} ${o.name}  −${fmt(price)} 💰`, "gold");
    emit("stat", { id: "decorBought", n: 1 });
    if (price > 0) emit("stat", { id: "decorSpent", n: price });
    emit("decor:buy", { slot, opt: id, price });
    place(slot, id, true);
    // a little celebration (it lands in a home of her own — features/realestate shows it there)
    if (price >= 300) A.sfxFanfare(); else { A.sfxCloseCall(5); setTimeout(() => A.sfxCloseCall(8), 110); }
    rumble(0.25, 0.5, 160, true);
    return { ok: true, why: "bought" };
}
/** Her pick for a slot (free) — what goes up in a home of her own (Ima's house never shows it). */
export function place(slot, id, bought = false) {
    if (!owns(slot, id) || !allowed()) return false;
    S.placed[slot] = id;
    saveSoon();
    emit("decor:place", { slot, opt: id, bought });
    checkSets(slot);
    return true;
}

function checkSets(slot) {
    for (const st of SETS) {
        const pieces = setPieces(st.id);
        if (!pieces.some(p => p.slot === slot) || !pieces.every(p => placed(p.slot) === p.opt)) continue;
        if (!S.sets.includes(st.id)) {
            S.sets.push(st.id); saveSoon();
            H.banner(`${st.icon} <b>${st.name} — SET COMPLETE!</b><small>${st.line}</small>`, 4200, { prio: 2, key: "decorSet" });
            A.sfxFanfare();
            emit("stat", { id: "decorSets", n: 1 });
            emit("decor:set", { id: st.id });
        } else H.toast(`${st.icon} ${st.name} — all together again ✨`, "gold");
    }
}

function luluSay(text) {
    if (!text) return;
    const rt = houseRoom();
    if (rt && rt.lulu) { rt.bubble(text, rt.lulu.obj, 2.4); return; }
    if (ctx.state === "footRun" && ctx.foot && ctx.foot.bubble && ctx.foot.obj) { ctx.foot.bubble(ctx.foot.obj, text, 2.4); return; }
}

// ═════════════════════════════════════════════════════════════════════════
//  OUTSIDE — the door's paint + the porch / mailbox / yard decorations, on the home street's group
// ═════════════════════════════════════════════════════════════════════════
const OUT = { root: null, doorMat: null, cache: {}, objs: {} };
const v1 = new THREE.Vector3();
/** House-local → world (house.js metres: +Z = toward the street). */
function at(lx, lz, ly = 0) { home.house.updateMatrixWorld(); return home.house.localToWorld(v1.set(lx, ly, lz)); }

function outsideInit() {
    if (OUT.root || !home.ready || !home.house) return !!OUT.root;
    const g = new THREE.Group();
    g.name = "DecorOutside";
    g.position.copy(home.house.position);
    g.rotation.copy(home.house.rotation);
    home.group.add(g);
    OUT.root = g;
    // the front door's paint: its own copy of the house's door material (the mailbox flag shares it — cute)
    home.house.traverse(o => {
        if (!o.isMesh || !o.material || o.material.name !== "HomeDoor") return;
        if (!OUT.doorMat) { OUT.doorMat = o.material.clone(); OUT.doorBase = { r: o.material.roughness, m: o.material.metalness }; }
        o.material = OUT.doorMat;
    });
    for (const s of SLOTS) if (s.where === "outside") outsideShow(s.id, imas(s.id));
    return true;
}
function outsideShow(slot, id) {
    if (!OUT.root && !outsideInit()) return;
    const s = slotById(slot), o = optOf(s, id) || s.opts[0];
    if (slot === "door") {
        if (OUT.doorMat) { OUT.doorMat.color.set(o.color); OUT.doorMat.metalness = o.metal || OUT.doorBase.m || 0; OUT.doorMat.roughness = o.metal ? 0.28 : OUT.doorBase.r; }
        return;
    }
    const cache = OUT.cache[slot] || (OUT.cache[slot] = {});
    if (!(o.id in cache)) {
        const obj = buildOption("outside", slot, o.id);
        if (obj) OUT.root.add(obj);
        cache[o.id] = obj;
    }
    for (const k of Object.keys(cache)) if (cache[k]) cache[k].visible = k === o.id;
    OUT.objs[slot] = cache[o.id];
    (OUT.shown || (OUT.shown = {}))[slot] = o.id;
    if (slot === "lawn") yardSync();
}
// ── the yard pieces are SOLID (flamingos, birdbath: a wall; gnomes: low — she hops them) ──
// One collider per possible piece on chunk 0 (the home street's chunk, rebuilt → added again), switched with `off`
// to follow whichever lawn option is showing (a picker preview too).
let YARD = [];
function yardSync() {
    const id = OUT.shown && OUT.shown.lawn;
    for (const y of YARD) y.c.off = y.opt !== id;
}
on("chunk:build", ({ chunk }) => {
    if (chunk.k !== 0 || !home.ready || !home.house) return;
    YARD = [];
    for (const [opt, list] of Object.entries(YARD_SOLIDS)) for (const [lx, lz, r, kind] of list) {
        const p = at(lx, lz);
        YARD.push({ opt, c: chunk.addCollider({ x: p.x, z: p.z, r, kind, off: true }) });
    }
    yardSync();
});
// ── the ✋ front door on foot (the porch / mailbox / yard spots are gone: nobody decorates Ima's house) ──
const DOOR = { x: 0.6, z: 5.0, r: 1.5 };
const FT = { t: 0, warmed: false };
on("state", ({ to }) => { if (to === "footRun") FT.t = ctx.time; });

function nearHome(door = false) {
    if (!home.ready || !home.house || !home.group.visible || ctx.state !== "footRun" || !(door ? canEnter() : allowed())) return false;
    if (!ctx.foot || !ctx.foot.pos || ctx.foot.chasing) return false;
    const p = ctx.foot.pos, h = home.house.position;
    return (p.x - h.x) ** 2 + (p.z - h.z) ** 2 < 32 * 32;
}
const doorSpot = {
    r: DOOR.r, short: "HOME",
    pos() {
        if (!nearHome(true)) return null;
        const w = at(DOOR.x, DOOR.z);
        // (the house loads while she's on the porch — but not in the run's first seconds: the camera's still gliding in)
        const reg = ctx.interiors && ctx.interiors[HOUSE_ID];
        if (reg && reg.warm && ctx.time - FT.t > 1.6) { const p = ctx.foot.pos; if ((p.x - w.x) ** 2 + (p.z - w.z) ** 2 < 9 * 9) reg.warm(); }
        return { x: w.x, z: w.z };
    },
    // (with friends: a friend's already inside HER copy of Ima's — ring the bell instead: moveout.js's refusal)
    label: () => (ctx.moveout && ctx.moveout.friendHome() ? "🔔 RING THE BELL" : "🏠 GO INSIDE"),
    act() { if (ctx.moveout && ctx.moveout.friendHome()) { ctx.moveout.refuse(); return; } enter(); },
};
on("boot", () => {
    // (her house is on a Midwood street — roadmap 14: its inside plays IN the town, the town standing outside)
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    try { outsideInit(); } catch (e) { console.error("[decor] outside", e); }
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(doorSpot);
    bindHouse({ owns, placed: imas, buy, place, allowed, visits: () => S.visits, visited: () => { S.visits++; saveSoon(); emit("stat", { id: "decorVisits", n: 1 }); } });
    // her family's house's exit: back on the porch steps, facing the street (foot's resume only knows road coords)
    const reg = ctx.interiors && ctx.interiors[HOUSE_ID];
    if (reg && !reg.wrapped) {
        const enter0 = reg.enter.bind(reg);
        reg.wrapped = true;
        reg.enter = (opts = {}) => {
            const exit0 = opts.exit;
            return enter0(Object.assign({}, opts, { exit: () => {
                if (typeof exit0 === "function") exit0();
                try { backOnPorch(); } catch (e) { console.error("[decor] porch", e); }
            } }));
        };
    }
});

/** ✋ GO INSIDE: through the front door (foot hands her to the interiors engine; a soft cut when it's warmed). Always
 *  HER OWN copy of the house — with friends too (they each have their own; nobody visits — roadmap 23). */
export function enter() {
    if (!nearHome(true) || !ctx.foot.handoff || !ctx.world) return false;
    const st = at(0.6, 7.1);
    // (in town — the house is on its Midwood lot: the town's own streets, near where she stands — like a town house's
    //  door, features/homes; the highway's home s would take her out of the town on the way in)
    const F = ctx.foot.debug && ctx.foot.debug.F;
    const n = ctx.world.road.nearest(st.x, st.z, home.site === "town" ? (F ? F.s : null) : S_HOME, {});
    const side = Math.sign(n.d) || 1;
    const door = { s: n.s, d: n.d + side * 1.4, side, id: HOUSE_ID };
    if (!ctx.foot.handoff(HOUSE_ID, door)) return false;
    A.sfxSelect();
    return true;
}
function backOnPorch() {
    if (!ctx.foot || !ctx.foot.pos || !home.house) return;
    const p = at(0.6, 7.0);
    ctx.foot.pos.set(p.x, 0.05, p.z);
    // she comes out facing her car (down the front of the house): the camera then sits out on the lawn behind
    // her — facing the street would put it behind her INSIDE the house (the free camera has no collision)
    const car = ctx.foot.parkedCar, r = home.house.rotation.y;
    const yaw = car && Math.hypot(car.x - p.x, car.z - p.z) < 25 ? Math.atan2(car.x - p.x, car.z - p.z) : Math.atan2(-Math.cos(r), Math.sin(r));
    if (ctx.foot.obj) { ctx.foot.obj.position.copy(ctx.foot.pos); ctx.foot.obj.rotation.set(0, yaw, 0); }
    if (ctx.cam && ctx.cam.snap) ctx.cam.snap();
    if (ctx.cam && ctx.cam.free) ctx.cam.free.yaw = yaw;
}
on("foot:end", () => { if (pickerOpen() && !houseRoom()) closePicker(true); });

// ── the service ──────────────────────────────────────────────────────────
ctx.decor = {
    owns, placed, buy, place, allowed, enter, canEnter,
    /** (roadmap 23: nobody visits Ima's house — always her own copy) */
    visitOwner: () => null,
    get visiting() { return false; },
    get slots() { return SLOTS; },
    get spent() { return S.spent; },
    get sets() { return S.sets.slice(); },
    /** For the 📱 "My house" page: what she has bought, and how close each themed set is → { bought: [{slot, icon, name}], sets: [{ id, icon, name, have, need, done, missing: [names] }], spent }. */
    summary() {
        const bought = [];
        for (const s of SLOTS) for (const o of s.opts) if (!isDefault(s.id, o.id) && owns(s.id, o.id)) bought.push({ slot: s.id, icon: o.icon, name: o.name, where: s.name, placed: placed(s.id) === o.id });
        const sets = SETS.map(st => {
            const pcs = setPieces(st.id), got = pcs.filter(p => owns(p.slot, p.opt)), miss = pcs.filter(p => !owns(p.slot, p.opt));
            return { id: st.id, icon: st.icon, name: st.name, have: got.length, need: pcs.length, done: S.sets.includes(st.id), missing: miss.map(p => optOf(p.slot, p.opt).name) };
        });
        return { bought, sets, spent: S.spent };
    },
    /** (roadmap 23: no picker at Ima's — her own homes have theirs, features/realestate) */
    pick() { return false; },
    debug: {
        S,
        get pickerSlot() { return pickerSlot(); },
        /** What the street shows right now ("slot:option" — a preview counts). */
        outside: () => { const out = []; for (const [s, c] of Object.entries(OUT.cache)) for (const [k, o] of Object.entries(c)) if (o && o.visible) out.push(s + ":" + k); return out; },
        /** The yard's solid pieces right now (the ones that are showing): [{ opt, x, z, r, kind }]. */
        yard: () => YARD.filter(y => !y.c.off).map(y => ({ opt: y.opt, x: y.c.x, z: y.c.z, r: y.c.r, kind: y.c.kind })),
        outsideObj: slot => OUT.objs[slot] || null,
        doorColor: () => OUT.doorMat ? "#" + OUT.doorMat.color.getHexString() : null,
        calls: () => { let n = 0; if (OUT.root) OUT.root.traverse(o => { if (o.isMesh && o.visible) { let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) n++; } }); return n; },
        spotAt: id => { const c = id === "door" ? DOOR : null; if (!c || !home.house) return null; const w = at(c.x, c.z); return { x: w.x, z: w.z }; },
        houseSpots: HOUSE_SPOTS,
        /** A world point in the house's own metres (+Z = toward the street). */
        houseLocal: p => { if (!home.house) return null; home.house.updateMatrixWorld(); const v = home.house.worldToLocal(new THREE.Vector3(p.x, p.y || 0, p.z)); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) }; },
        room: () => houseRoom(),
        /** Forget everything bought (tests only). */
        reset() { S.owned = {}; S.placed = {}; S.spent = 0; S.bought = 0; S.sets = []; saveSoon(); },
    },
};
