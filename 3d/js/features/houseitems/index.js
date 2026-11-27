// ─────────────────────────────────────────────────────────────────────────
//  features/houseitems — 🍳 THE THINGS SHE TAKES FROM HOUSES DO SOMETHING (roadmap 32 · stage D; the owner 2026-11-27).
//
//  Whatever she's holding when she leaves a house (features/homes — out of the door or a window) comes with her: a
//  small bag of ≤ BAG_MAX things, one IN HAND (drawn in her hand on foot). The item button (D-pad ↓ / G / the touch
//  button) USES it — the first of its VERBS (data.js) that makes sense right here: BONK a crook or a chasing cop, GIVE
//  it to a neighbour (its OWNER recognises it), EAT it (a heart, capped a run), DROP it (a chasing cop stops to look),
//  WEAR it, SHOW it. Press twice quickly (or the 🔄 touch button) to swap what's in hand. Used-up things are gone.
//  Taking it was what the law says (homes' BURGLARY); using it in front of its owner → "THAT'S MY PAN!" (homes
//  remembers). Things from Fayge's are hers. Nothing pays coins; no toasts — a bubble, a sound, the animation.
//
//  ctx.houseitems { bag, hand, inHand, add(id, from), use(), swap(), drop(i), debug }
//  Events: houseitems:add {id, from, stolen} · houseitems:use {id, verb, target} · houseitems:gone {id}
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, addActor } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { heal } from "../../core/driving.js";
import { input, addTouchButton } from "../../input.js";
import { models, ensureModels } from "../../models.js";
import { ID, BAG_MAX, CAP, ITEMS, LINES } from "./data.js";
import { makeProp } from "./props.js";
import { shared } from "../../core/save.js";
import { tone } from "../interiors/fx.js";
import { dropBad } from "../underworld/badguys.js";
import { PORCH, tackle } from "../crime/porch.js";

const S = store("houseitems", { bag: [], hand: 0 });
if (!Array.isArray(S.bag)) S.bag = [];
const R = { eat: 0, prop: null, propId: "", worn: null, pressT: -1, log: [], force: {} };
const pick = a => a[Math.floor(Math.random() * a.length)];
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const log = (ev, d = {}) => { R.log.push(Object.assign({ ev }, d)); if (R.log.length > 60) R.log.shift(); emit("houseitems:" + ev, d); };
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun" && ctx.foot.phase === "walk");
const F = () => (ctx.foot && ctx.foot.debug && ctx.foot.debug.F) || null;
// (the hand can also hold the 🌶️ pepper spray she bought: the slot after the bag — then the item button is garage's spray)
const cur = () => (S.hand < S.bag.length ? S.bag[S.hand] : null);
const pepperN = () => { try { return shared.get().pepperSpray | 0; } catch (e) { return 0; } };
const slots = () => S.bag.length + (pepperN() > 0 ? 1 : 0);
const driving = () => !!(ctx.state === "playing" && ctx.car && !(ctx.foot && ctx.foot.active));

// ── the bag ──────────────────────────────────────────────────────────────
export function add(id, from = null, stolen = true) {
    if (!ITEMS[id]) return false;
    if (S.bag.length >= BAG_MAX) S.bag.shift();         // (a full bag: the oldest thing is left behind — "no room")
    S.bag.push({ id, from, stolen: !!stolen, uses: ITEMS[id].uses || 0 });
    S.hand = S.bag.length - 1;
    saveSoon();
    log("add", { id, from, stolen: !!stolen });
    return true;
}
function gone(i = S.hand) {
    const it = S.bag[i];
    if (!it) return;
    S.bag.splice(i, 1);
    S.hand = Math.max(0, Math.min(S.hand, S.bag.length - 1));
    saveSoon();
    log("gone", { id: it.id });
}
export function swap() {
    const n = slots();
    if (n < 2) return false;
    S.hand = (S.hand + 1) % n; saveSoon();
    const it = cur();
    const line = it ? `*swaps to the ${ITEMS[it.id].name}* ${ITEMS[it.id].emoji}` : "*swaps to the pepper spray* 🌶️";
    if (driving()) carSay(line); else say(line);
    return true;
}
function carSay(text) { try { if (ctx.banter && ctx.banter.say) ctx.banter.say(text); } catch (e) { /* no banter */ } }

// ── what's near ──────────────────────────────────────────────────────────
function herPos() { return ctx.foot && ctx.foot.pos; }
/** A crook or a chasing cop within reach: { kind: "thief" | "cop", x, z, obj, hit() } | null */
function bonkTarget() {
    const me = herPos();
    if (!me) return null;
    if (R.force.target) return R.force.target;
    const f = F();
    if (f && f.chase && f.chase.p) {          // the foot chase's cop
        const o = f.chase.p.obj.position;
        if (Math.hypot(o.x - me.x, o.z - me.z) < 3.2) return { kind: "cop", obj: f.chase.p.obj, hit: () => { f.chase.stunT = CAP.bonkStun; } };
    }
    for (const fn of TARGETS) { try { const t = fn(me); if (t) return t; } catch (e) { /* a target's bug never breaks the bag */ } }
    return null;
}
const TARGETS = [];
// crime's porch pirate (features/crime/porch.js): a BONK foils him, as a tackle would
TARGETS.push(me => {
    const E = PORCH.E;
    if (!E || !E.p || E.phase !== "run") return null;
    const o = E.p.obj.position;
    return Math.hypot(o.x - me.x, o.z - me.z) < 3.2 ? { kind: "thief", obj: E.p.obj, hit: () => tackle("lulu") } : null;
});
/** Other features: fn(herPos) → { kind: "thief" | "cop", obj, hit() } | null */
export function addTarget(fn) { if (typeof fn === "function") TARGETS.push(fn); }
/** A neighbour within reach (homes' crowd), or Fayge: { kind: "fayge" | "neighbour", owner: bool, obj } */
function giveTarget(it) {
    const me = herPos();
    if (!me) return null;
    if (R.force.give) return R.force.give;
    const fy = ctx.family && ctx.family.fayge;
    if (fy && Math.hypot(fy.x - me.x, fy.z - me.z) < 2.6) return { kind: "fayge", obj: anchor(fy.x, fy.z, 2.0) };
    const peds = ctx.homes && ctx.homes.debug && ctx.homes.debug.CR && ctx.homes.debug.CR.peds || [];
    let best = null, bd = 2.4;
    for (const p of peds) {
        if (p.look === "kid" || p.type === "dog" || p.type === "scooter" || p.x == null) continue;
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        if (d < bd) { bd = d; best = p; }
    }
    if (!best) return null;
    return { kind: "neighbour", owner: !!(it.from && best.home && best.home.key === it.from), obj: anchor(best.x, best.z, 2.0), ped: best };
}
/** Is the item's owner household's door within sight (12 m)? → the door's world point | null */
function ownerNear(it) {
    if (!it.from || !it.stolen || !ctx.homes) return null;
    const h = ctx.homes.household && ctx.homes.household(it.from);
    const me = herPos();
    if (!h || h.status || !me) return null;
    return Math.hypot(h.ap.x - me.x, h.ap.z - me.z) < 12 ? h : null;
}
let tmp = [];
function anchor(x, z, y = 2.0) {
    const o = new THREE.Object3D(); o.position.set(x, y - 2.0, z); ctx.scene.add(o); tmp.push({ o, t: 4 });
    return o;
}
function say(text, obj = null, dur = 2.6) {
    try { if (ctx.foot && ctx.foot.say) return !!ctx.foot.say(obj || ctx.foot.obj, text, dur); } catch (e) { /* */ }
    return false;
}

// ── use ──────────────────────────────────────────────────────────────────
/** Use what's in hand: the first verb that makes sense here. → { verb, target } | null */
export function use() {
    const it = cur();
    if (!it || !onFoot()) return null;
    const D = ITEMS[it.id], name = D.name;
    let verb = null, target = null;
    for (const v of D.verbs) {
        if (v === "BONK") { const t = bonkTarget(); if (t) { verb = v; target = t; break; } }
        else if (v === "GIVE") { const t = giveTarget(it); if (t && (!D.giveOwnerOnly || t.owner || t.kind === "fayge")) { verb = v; target = t; break; } }
        else if (v === "EAT") { if (ctx.G && ctx.G.hearts < ctx.G.maxHearts) { verb = v; break; } }
        else if (v === "DROP") { verb = v; break; }
        else { verb = v; break; }       // WEAR / SHOW: always
    }
    if (!verb) verb = D.verbs.includes("SHOW") ? "SHOW" : D.verbs[D.verbs.length - 1];
    const L = LINES[D[verb.toLowerCase()] || verb] || LINES[verb];
    let consumed = false;
    if (verb === "BONK") {
        const pool = target ? (L[target.kind] || L.thief) : L.none;
        say(pick(pool), target ? target.obj : null);
        try { target && target.hit && target.hit(); } catch (e) { console.error("[houseitems] bonk", e); }
        if (target && target.obj && target.kind === "cop") spin(target.obj);
        consumed = !!it.uses && --it.uses <= 0;
    } else if (verb === "EAT") {
        const full = R.eat >= CAP.eat;
        say(fill(pick(full ? LINES.EAT.full : LINES.EAT.kugel), { item: name }).replace(/kugel/g, name));
        if (!full) { try { heal(1); } catch (e) { /* no run */ } R.eat++; }
        consumed = true;
    } else if (verb === "DROP") {
        const f = F();
        if (D.food) { say(pick(LINES.DROP.food)); if (f && f.chase) { f.chase.stunT = CAP.dropStun; if (f.chase.p) say(pick(LINES.DROP.cop), f.chase.p.obj); } consumed = true; dropProp(it.id); }
        else { say(pick(LINES.DROP.SQUEAK)); if (f && f.chase) f.chase.stunT = CAP.dropStun / 2; }
        if (D.uses) consumed = --it.uses <= 0 || consumed;
    } else if (verb === "GIVE") {
        const pool = target.kind === "fayge" ? LINES.GIVE.fayge : target.owner ? LINES.GIVE.owner : LINES.GIVE.neighbour;
        say(fill(pick(pool), { item: name.toUpperCase(), room: "KITCHEN" }), target.obj, 3.2);
        if (target.owner && ctx.homes && ctx.homes.returned) ctx.homes.returned(it.from, it.id);
        consumed = true;
    } else if (verb === "WEAR") {
        wear(it.id);
    } else {
        say(fill(pick(LINES.SHOW), { item: name }));
    }
    // in front of its owner: they notice (homes remembers)
    const own = verb !== "GIVE" ? ownerNear(it) : null;
    if (own) {
        say(fill(pick(LINES.owner), { item: name.toUpperCase() }), anchor(own.ap.x, own.ap.z, 2.2), 2.8);
        if (ctx.homes && ctx.homes.noticed) ctx.homes.noticed(it.from, it.id);
        log("owner", { id: it.id, from: it.from });
    }
    log("use", { id: it.id, verb, target: target ? target.kind : null });
    emit("stat", { id: "houseItemUses", n: 1 });
    if (consumed) { if (R.worn && R.worn.id === it.id) unwear(); gone(); }
    syncProp(true);
    return { verb, target: target ? target.kind : null };
}
function spin(obj) { const t0 = performance.now(); const id = setInterval(() => { const k = (performance.now() - t0) / 600; obj.rotation.y += 0.5; if (k > 1) clearInterval(id); }, 30); }
function dropProp(id) {
    const me = herPos();
    if (!me) return;
    const p = propOf(id);
    if (!p) return;
    p.position.set(me.x + Math.sin(ctx.foot.obj.rotation.y) * 0.7, 0.05, me.z + Math.cos(ctx.foot.obj.rotation.y) * 0.7);
    ctx.scene.add(p);
    tmp.push({ o: p, t: 20 });
}

// ── the prop in her hand / on her head ───────────────────────────────────
function propOf(id) {
    const D = ITEMS[id];
    if (D && D.make) return makeProp(D.make);
    const src = models.homesItems;
    if (!D || !src) return null;
    let node = null;
    src.traverse(o => { if (!node && o.name === "Prop_" + D.prop) node = o; });
    if (!node) return null;
    const c = node.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
    return c;
}
function luluPerson() { const f = F(); return f && f.lulu; }
function syncProp(force = false) {
    const it = onFoot() ? cur() : null;
    const want = it && !(R.worn && R.worn.id === it.id) ? it.id : "";
    if (!force && want === R.propId && (!R.prop || R.prop.parent)) return;
    if (R.prop && R.prop.parent) R.prop.parent.remove(R.prop);
    R.prop = null; R.propId = want;
    const p = luluPerson();
    if (!want || !p) return;
    const o = propOf(want);
    if (!o) return;
    const arm = p.limbs && p.limbs.Arm_R;
    if (!arm) return;
    o.position.set(0, -0.47, 0.06);
    arm.add(o);
    R.prop = o;
}
function wear(id) {
    if (R.worn && R.worn.id === id) { unwear(); say(fill(pick(LINES.WEAR.off), { item: ITEMS[id].name })); return; }
    unwear();
    const p = luluPerson();
    const o = propOf(id);
    const body = p && (p.limbs && p.limbs.Body);
    if (o && body) { o.position.set(0, 1.62, 0); o.rotation.set(Math.PI, 0, 0); body.add(o); R.worn = { id, o }; }
    say(fill(pick(LINES.WEAR.on), { item: ITEMS[id].name }));
}
function unwear() { if (R.worn && R.worn.o.parent) R.worn.o.parent.remove(R.worn.o); R.worn = null; }

// ── wiring ───────────────────────────────────────────────────────────────
// homes: what she walked out holding comes with her (her own things at Fayge's / her own homes aren't stolen)
on("homes:exit", e => {
    if (!ctx.enabled(ID) || !e || !e.held || !ITEMS[e.held]) return;
    add(e.held, e.key, !e.own);
});
on("run:start", () => { R.eat = 0; unwear(); });
on("foot:start", () => { ensureModels(["homesItems"]).catch(() => { }); });
addTouchButton({ id: "hi_use", emoji: "🎒", label: "USE", action: "item", visible: () => onFoot() && !!cur() });
addTouchButton({ id: "hi_swap", emoji: "🔄", label: "SWAP", action: "itemSwap", visible: () => (onFoot() || driving()) && slots() > 1 });
let actorOn = false;
function actor() {
    if (actorOn) return;
    actorOn = true;
    addActor({
        foot: true,
        update(dt) {
            for (const x of tmp) { x.t -= dt; if (x.v) { x.v.y -= 9.8 * dt; x.o.position.x += x.v.x * dt; x.o.position.y = Math.max(0.05, x.o.position.y + x.v.y * dt); x.o.position.z += x.v.z * dt; if (x.o.position.y <= 0.05) x.v = null; } }
            tmp = tmp.filter(x => { if (x.t > 0) return true; if (x.o.parent) x.o.parent.remove(x.o); return false; });
            const f = F();
            if (f && f.chase && f.chase.stunT > 0) f.chase.stunT -= dt;
            if (!ctx.enabled(ID)) return true;
            syncProp();
            if (driving() && !ctx.dialogOpen) {          // at the wheel: one press = the hand item's car use (no double-press: eyes on the road)
                const P = input.pressed || {};
                if (P.itemSwap) swap();
                else if (P.item && carHand()) useCar();
                R.pressT = -1;
                return true;
            }
            if (!onFoot() || ctx.dialogOpen) { R.pressT = -1; return true; }
            const P = input.pressed || {};
            if (P.itemSwap) { swap(); syncProp(true); }
            // the item button: once = use (after a beat), twice quickly = swap
            // (the window: 0.3 s or 8 frames, whichever is longer — a slow phone's frames are long)
            if (P.item && cur()) {
                if (R.pressT >= 0) { R.pressT = -1; swap(); syncProp(true); }
                else { R.pressT = 0; R.pressF = 0; }
            } else if (R.pressT >= 0) {
                R.pressT += dt; R.pressF++;
                if (R.pressT > 0.3 && R.pressF > 8) { R.pressT = -1; use(); }
            }
            return true;
        },
        dispose() { actorOn = false; },
    });
}
on("foot:start", () => actor());
on("boot", () => {
    actor();
    // the round-2 items are pickups in every house (two a house) — homes stages them, with their code-built props
    for (const [id, D] of Object.entries(ITEMS)) {
        if (!D.make || !D.pickup || !ctx.homes || !ctx.homes.addPickup) continue;
        ctx.homes.addPickup(id, { name: D.name, emoji: D.emoji, verb: (D.bonk || D.verbs[0]), fx: D.food ? "eat" : D.verbs[0] === "BONK" ? "dizzy" : "laugh", stun: D.food ? 8 : 2.6,
            uses: D.uses || 0, sfx: D.verbs[0] === "BONK" ? "bonk" : "poof", surface: D.pickup, make: () => makeProp(D.make), react: { "*": REACT_IN[id] || REACT_IN._ } });
    }
});
// inside a house, used on a resident (homes' REACT table: one line for everyone)
const REACT_IN = {
    rollingpin: { line: "A ROLLING PIN?! That's for DOUGH! Not for— *BONK* ...for DOUGH. 💫", lulu: "It's very good for dough. And this." },
    rugelach: { line: "Is that MY rugelach?! ...it's good, right? It's good. Take another.", lulu: "Mmf. Amazing." },
    challah: { line: "That's for SHABBOS! ...fine. One piece. The END piece.", lulu: "The end piece is the BEST piece." },
    lampshade: { line: "*stares at the lampshade on your head* ...I'm not going to ask.", lulu: "Don't ask. It's a look." },
    trophy: { line: "My TROPHY?! 1994! I bowled a 212! Put it DOWN!", lulu: "212! Impressive! ...it's going back on the shelf." },
    hat: { line: "That's my GOOD hat! The SHABBOS one! Off! OFF!", lulu: "It's very slimming, though." },
    broom: { line: "*SWEEP* — she sweeps your feet. \"Out! OUT! The floor is CLEAN!\"", lulu: "Just helping! Helping!" },
    spray: { line: "*psst psst* — \"I'm not a FERN!\"", lulu: "You look a little dry." },
    _: { line: "...?!", lulu: "Oops." },
};

// ── 🚗 from the car: the hand item's car use (data.js `car`) ─────────────
/** The hand item can do something from the car (the pepper slot / no car use: the item button stays garage's). */
function carHand() { const it = cur(); return !!(it && ITEMS[it.id].car && ctx.enabled(ID)); }
export function useCar() {
    const it = cur();
    if (!it || !driving()) return null;
    const D = ITEMS[it.id], kind = D.car, L = LINES.CAR, name = D.name, f = { item: name, ITEM: name.toUpperCase() };
    let consumed = false, target = null;
    if (kind === "TOSS") {
        target = tossTarget(it.id);
        carSay(fill(pick(target ? L.TOSS[target.kind] : L.TOSS.none), f));
        try { target && target.hit && target.hit(); } catch (e) { console.error("[houseitems] toss", e); }
        tossProp(it.id);
        consumed = true;
    } else if (kind === "HORN") {
        R.chickenHorn = true;
        carSay(pick(L.HORN));
        consumed = true;
    } else if (kind === "GIVE_AVIGAIL") {
        if (ctx.G && ctx.G.avigailRide) { carSay(fill(pick(L.GIVE_AVIGAIL), f)); try { ctx.avigail && ctx.avigail.bump(4, { quiet: true }); } catch (e) { /* */ } consumed = true; target = { kind: "avigail" }; }
        else carSay(fill(pick(L.noAvigail), f));
    } else if (kind === "WEAR") {
        if (R.carWorn === it.id) { ctx.car.attach("head", null); R.carWorn = null; carSay(fill(pick(L.WEAR.off), f)); }
        else { const o = propOf(it.id); if (o) { o.position.set(0, 0.08, 0); ctx.car.attach("head", o); } R.carWorn = it.id; carSay(fill(pick(L.WEAR.on), f)); }
    } else carSay(fill(pick(L.none), f));
    log("use", { id: it.id, verb: "CAR:" + kind, target: target ? target.kind : null, car: true });
    emit("stat", { id: "houseItemUses", n: 1 });
    if (consumed) gone();
    return { verb: "CAR:" + kind, target: target ? target.kind : null };
}
/** Who a tossed thing lands near: a cruiser behind her (it swerves for it — food) · a road-rager (a water balloon: soaked). */
function tossTarget(id) {
    const car = ctx.car;
    if (R.force.toss) return R.force.toss;
    if (id === "balloon") {
        const E = ctx.underworld && ctx.underworld.debug && ctx.underworld.debug.E;
        if (E && E.kind === "rager" && E.car && Math.abs(E.car.s - car.s) < 35) return { kind: "rager", hit: () => { setTimeout(() => { try { dropBad(E); } catch (e) { /* */ } }, 1500); } };
        return null;
    }
    if (!ITEMS[id].food) return null;
    for (const c of ctx.traffic.cars) {
        if (!/cop/.test(c.kind) || c.hit) continue;
        const ds = car.s - c.s;
        if (ds > 0 && ds < 45) return { kind: "cop", car: c, hit: () => { c.speed *= 0.4; c.d += (Math.random() < 0.5 ? -1 : 1) * 1.6; if (c.data) c.data.kugelT = 3; } };
    }
    return null;
}
function tossProp(id) {
    const o = propOf(id);
    if (!o || !ctx.car) return;
    const c = ctx.car, side = 1;
    o.position.set(c.pos.x + Math.cos(c.h) * side * 1.2, 1.0, c.pos.z - Math.sin(c.h) * side * 1.2);
    ctx.scene.add(o);
    const v = { x: Math.cos(c.h) * 3 - Math.sin(c.h) * 2, y: 3.5, z: -Math.sin(c.h) * 3 - Math.cos(c.h) * 2 };
    tmp.push({ o, t: 6, v });
}
on("honk", () => { if (R.chickenHorn && driving()) { tone(1500, 0.3, "sawtooth", 0.05, 1800); tone(1200, 0.25, "sawtooth", 0.04, 950, 0.28); } });
on("run:start", () => { R.chickenHorn = false; R.carWorn = null; });

ctx.houseitems = {
    get bag() { return S.bag.map(x => Object.assign({}, x, { name: ITEMS[x.id].name, emoji: ITEMS[x.id].emoji })); },
    get hand() { const it = cur(); return it ? it.id : null; },
    /** Is something in her hand (on foot)? The pepper spray yields the item button to it. */
    get inHand() { return onFoot() && !!cur() && ctx.enabled(ID); },
    /** At the wheel with a car-usable thing in hand: the item button is ours (garage's pepper waits). */
    get carHand() { return driving() && carHand(); },
    useCar, slots: () => slots(),
    add, use, swap, addTarget,
    debug: { S, R, ITEMS, CAP, clear() { S.bag = []; S.hand = 0; R.eat = 0; unwear(); syncProp(true); saveSoon(); return true; }, prop: () => !!(R.prop && R.prop.parent), worn: () => (R.worn ? R.worn.id : null) },
};
