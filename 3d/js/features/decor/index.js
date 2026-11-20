// features/decor — 🛋️ SOMEWHERE FOR COINS TO GO (roadmap step 9): Lulu's own house, and decorating it.
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
import { buildOption, disposeObj } from "./props.js";
import { openPicker, pickerTick, pickerOpen, closePicker, pickerSlot } from "./picker.js";
import { bindHouse, houseShow, houseBurst, houseReact, houseRoom, houseVisit, HOUSE_ID, HOUSE_SPOTS } from "./house.js";

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
// ── a visit with friends: whose house this is, and its decorations ──
const VIS = { owner: "", placed: null };
const DC_SLOTS = SLOTS.filter(s => s.where === "inside" || s.id === "door");
/** What's placed in the house I'm in (a friend's house on a visit, else mine). */
function visitPlaced(slot) { return (VIS.placed && VIS.placed[slot]) || placed(slot); }
const encodeDc = () => DC_SLOTS.map(s => Math.max(0, s.opts.findIndex(o => o.id === visitPlaced(s.id))));
function decodeDc(a) {
    if (!Array.isArray(a) || a.length !== DC_SLOTS.length) return null;
    const out = {};
    DC_SLOTS.forEach((s, i) => { const k = a[i] | 0; if (k >= 0 && k < s.opts.length) out[s.id] = s.opts[k].id; });
    return out;
}
/** A friend who's inside Lulu's house right now (in the same world): { owner, placed } | null. */
function friendInside() {
    const P = ctx.party;
    if (!P || !P.active) return null;
    for (const u of P.members()) {
        if (u === P.uid) continue;
        const p = P.peer(u), x = p && p.x;
        if (!x || p.m !== 7 || !P.fresh(p, 6000) || !Array.isArray(x.in) || x.in[0] !== HOUSE_ID || (typeof x.z === "string" && x.z)) continue;
        const pl = decodeDc(x.dc);
        if (pl) return { owner: String(x.in[1] || u).slice(0, 12), placed: pl };
    }
    return null;
}

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
    // a little celebration where it landed
    if (price >= 300) A.sfxFanfare(); else { A.sfxCloseCall(5); setTimeout(() => A.sfxCloseCall(8), 110); }
    rumble(0.25, 0.5, 160, true);
    if (s.where === "inside" || slot === "door") { houseBurst(slot); houseReact(slot, id); }
    if (s.where === "outside") outsideBurst(slot);
    if (s.where === "outside" && !houseRoom()) luluSay(pick(LINES.luluBuy));
    return { ok: true, why: "bought" };
}
/** Put something she owns in its spot (free). */
export function place(slot, id, bought = false) {
    if (!owns(slot, id) || !allowed()) return false;
    S.placed[slot] = id;
    saveSoon();
    apply(slot, id);
    emit("decor:place", { slot, opt: id, bought });
    checkSets(slot);
    return true;
}
/** Show an option in the world (a preview), or `null` = back to what's placed. */
function preview(slot, id) { apply(slot, id == null ? placed(slot) : id); }
function apply(slot, id) {
    const s = slotById(slot);
    if (!s) return;
    if (s.where === "outside") outsideShow(slot, id);
    if (s.where === "inside" || slot === "door") houseShow(slot, id);
}
const pickerApi = () => ({ owns, placed, buy, place, preview });

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
    for (const s of SLOTS) if (s.where === "outside") outsideShow(s.id, placed(s.id));
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
}
/** After a picker outside: free the previews, keep what's placed. */
function outsideTrim(slot) {
    const cache = OUT.cache[slot];
    if (!cache) return;
    const keep = placed(slot);
    for (const k of Object.keys(cache)) if (k !== keep) { disposeObj(cache[k]); if (cache[k]) cache[k].traverse(m => { if (m.isMesh && m.userData.ownMaterial) m.material.dispose(); }); delete cache[k]; }
}
function outsideBurst(slot) {
    const c = OUT_SPOTS[slot];
    if (!c || !ctx.car || !ctx.car.fx) return;
    const p = at(c.look[0], c.look[2], c.look[1]);
    const cols = [[1, 0.31, 0.6], [1, 0.84, 0.31], [0.5, 0.87, 0.92], [1, 1, 1]];
    for (let i = 0; i < 22; i++) ctx.car.fx.emit(p.x + (Math.random() - 0.5) * 1.2, p.y + 0.4, p.z + (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.3, 0.9, cols[i % 4]);
}

// ── the ✋ spots on foot ──────────────────────────────────────────────────
// house-local: where she stands (x, z, r) and how the camera frames it while she picks (cam / look, x y z)
const OUT_SPOTS = {
    porch: { x: -1.7, z: 6.7, r: 1.6, cam: [1.4, 2.7, 12.2], look: [0.1, 1.2, 5.3] },
    mailbox: { x: 3.0, z: 11.5, r: 1.6, cam: [5.6, 2.0, 15.4], look: [3.0, 1.0, 12.3] },
    lawn: { x: 4.4, z: 8.6, r: 1.9, cam: [2.6, 3.4, 16.8], look: [5.0, 0.4, 9.6] },
};
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
    label: () => "🏠 GO INSIDE",
    act() { enter(); },
};
function slotSpot(id) {
    const c = OUT_SPOTS[id], slot = slotById(id);
    return {
        r: c.r, short: "DECOR",
        pos() { if (!nearHome()) return null; const w = at(c.x, c.z); return { x: w.x, z: w.z }; },
        label: () => `${slot.icon} ${slot.verb.toUpperCase()}`,
        act() { pickOutside(id); },
    };
}
on("boot", () => {
    try { outsideInit(); } catch (e) { console.error("[decor] outside", e); }
    if (ctx.foot && ctx.foot.addSpot) {
        ctx.foot.addSpot(doorSpot);
        for (const id of Object.keys(OUT_SPOTS)) ctx.foot.addSpot(slotSpot(id));
    }
    bindHouse({ owns, placed: visitPlaced, buy, place, preview, allowed, pickerApi, visits: () => S.visits, visited: () => { S.visits++; saveSoon(); emit("stat", { id: "decorVisits", n: 1 }); } });
    // her own house's exit: back on the porch steps, facing the street (foot's resume only knows road coords)
    const reg = ctx.interiors && ctx.interiors[HOUSE_ID];
    if (reg && !reg.wrapped) {
        const enter0 = reg.enter.bind(reg);
        reg.wrapped = true;
        reg.enter = (opts = {}) => {
            const exit0 = opts.exit;
            const P = ctx.party;
            houseVisit(!allowed());
            if (P && P.active) { P.setX("dc", encodeDc()); }
            return enter0(Object.assign({}, opts, { exit: () => {
                if (P && P.setX) P.setX("dc", null);
                VIS.owner = ""; VIS.placed = null;
                if (typeof exit0 === "function") exit0();
                try { backOnPorch(); } catch (e) { console.error("[decor] porch", e); }
            } }));
        };
    }
});

/** ✋ GO INSIDE: through the front door (foot hands her to the interiors engine; a soft cut when it's warmed). */
export function enter() {
    if (!nearHome(true) || !ctx.foot.handoff || !ctx.world) return false;
    // with friends: a visit to the house of whoever's already inside, else mine (they'll see my decorations)
    const P = ctx.party, fr = P && P.active ? friendInside() : null;
    VIS.owner = fr ? fr.owner : P && P.active ? P.uid : "";
    VIS.placed = fr ? fr.placed : null;
    const st = at(0.6, 7.1);
    const n = ctx.world.road.nearest(st.x, st.z, S_HOME, {});
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

/** ✋ at the porch / the mailbox / the yard: the picker, the camera on it, Lulu waits. */
function pickOutside(id) {
    const slot = slotById(id), c = OUT_SPOTS[id];
    if (!slot || !c || !allowed() || !ctx.foot || !ctx.foot.script) return false;
    const cam = ctx.camera, P0 = { pos: cam.position.clone(), look: new THREE.Vector3(), started: false };
    cam.getWorldDirection(P0.look).multiplyScalar(6).add(cam.position);
    const tgtPos = at(c.cam[0], c.cam[2], c.cam[1]).clone(), look = at(c.look[0], c.look[2], c.look[1]).clone();
    const aim = look.clone(); aim.y -= 0.9;            // (aim under it: the item sits above the card)
    const ok = ctx.foot.script({
        update(dt, P, F) {
            if (F.lulu) { F.lulu.face(look.x, look.z, dt, 6); F.lulu.update(dt, { walk: 0 }); }
            const open = pickerTick(P);
            if (!open) outsideTrim(id);
            return open;
        },
        camera(dt) {
            const k = 1 - Math.exp(-dt * 3.5);
            P0.pos.lerp(tgtPos, k); P0.look.lerp(aim, k);
            cam.position.copy(P0.pos); cam.lookAt(P0.look);
            const fov = cam.aspect < 1 ? 68 : 52;
            cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
            if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
            return true;
        },
        abort() { if (pickerOpen()) closePicker(true); outsideTrim(id); },
    });
    if (!ok) return false;
    openPicker(slot, pickerApi(), null);
    return true;
}
// the first couple of home starts before she's ever been in: one gentle toast that the house is open (gated: a popup)
on("world:homeStart", () => {
    if (S.visits > 0 || (S.nudges || 0) >= 2 || !ctx.enabled("decor") || !allowed()) return;
    S.nudges = (S.nudges || 0) + 1; saveSoon();
    const t0 = ctx.time;
    const tick = () => {
        if (ctx.state !== "footRun" || S.visits > 0) return;
        if (ctx.time - t0 < 7) { setTimeout(tick, 500); return; }
        H.toast("🛋️ Your house is open! ✋ at the front door — spend coins decorating", "pink", { key: "decorNudge" });
    };
    setTimeout(tick, 500);
});
on("foot:end", () => { if (pickerOpen() && !houseRoom()) closePicker(true); });

// ── the service ──────────────────────────────────────────────────────────
ctx.decor = {
    owns, placed, buy, place, allowed, enter, canEnter,
    /** On a visit with friends: whose house this is (a party uid; "" solo / outside). */
    visitOwner: () => (houseRoom() ? VIS.owner : null),
    /** Is the house I'm in a friend's (on a visit)? */
    get visiting() { return !!(houseRoom() && VIS.owner && ctx.party && VIS.owner !== ctx.party.uid); },
    get slots() { return SLOTS; },
    get spent() { return S.spent; },
    get sets() { return S.sets.slice(); },
    /** Open the picker for a slot where she is (inside: that room's spot; outside: its ✋ spot). */
    pick(slot) {
        const s = slotById(slot);
        if (!s) return false;
        if (houseRoom()) { const rt = houseRoom(), h = rt.hots.find(x => x.id === "slot:" + slot || (slot === "door" && x.id === "door")); if (!h) return false; rt.use(h); return true; }
        return pickOutside(slot);
    },
    debug: {
        S,
        get pickerSlot() { return pickerSlot(); },
        /** What the street shows right now ("slot:option" — a preview counts). */
        outside: () => { const out = []; for (const [s, c] of Object.entries(OUT.cache)) for (const [k, o] of Object.entries(c)) if (o && o.visible) out.push(s + ":" + k); return out; },
        outsideObj: slot => OUT.objs[slot] || null,
        doorColor: () => OUT.doorMat ? "#" + OUT.doorMat.color.getHexString() : null,
        calls: () => { let n = 0; if (OUT.root) OUT.root.traverse(o => { if (o.isMesh && o.visible) { let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) n++; } }); return n; },
        spotAt: id => { const c = id === "door" ? DOOR : OUT_SPOTS[id]; if (!c || !home.house) return null; const w = at(c.x, c.z); return { x: w.x, z: w.z }; },
        houseSpots: HOUSE_SPOTS,
        /** A world point in the house's own metres (+Z = toward the street). */
        houseLocal: p => { if (!home.house) return null; home.house.updateMatrixWorld(); const v = home.house.worldToLocal(new THREE.Vector3(p.x, p.y || 0, p.z)); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) }; },
        room: () => houseRoom(),
        /** Forget everything bought (tests only). */
        reset() { S.owned = {}; S.placed = {}; S.spent = 0; S.bought = 0; S.sets = []; saveSoon(); for (const s of SLOTS) apply(s.id, placed(s.id)); },
    },
};
