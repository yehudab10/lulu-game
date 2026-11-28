// ─────────────────────────────────────────────────────────────────────────
//  features/carcare — 🚗 THE CAR-CARE ROW (roadmap 43 b; owner-approved plan, 2026-11-27). Midwood's Coney Island Ave
//  shopfronts made real, plus both Minivan Washes — each car's CONDITION is saved with ctx.cars (`ctx.cars.care(key)`):
//   🧽 MINIVAN WASH (Midwood's on Avenue M, Lakewood's on Main St) — 8 coins. Dirt builds with distance (× 3 in the rain,
//      a bit more for every puddle she drives through); a dirty car (≥ 0.6) draws a cop's look ~10 % sooner and gets an
//      Ima comment at the door (once a real day). A wash sparkles for 10 real minutes (no dirt while it does).
//   🔧 BUMPER TO BUMPER BODY SHOP — every lost heart in her own car is a dent level (≤ 3, 2 dent decals each). 25 a level
//      at the counter, or 10 to pop them herself (a 20 s plunger game, dents.js).
//   🛞 TIRE-D OF IT TIRES — All-season (the default, free) · Sport 60 (more dry grip, less in the rain) · Rain 50 (the best
//      wet grip, top speed −2 %). A set wears back to all-season over ~3 real days; the same set again is half price.
//   🔊 CONEY ISLAND AVE MUFFLER — Stock · LOUD 30 (pops when she lifts off; cops hear her 20 % farther) · QUIET 30 (at
//      night the cops spot her ~15 % later).
//   ☕ 24 HR GAS & GOSSIP — Bracha tells her one TRUE thing about today, new each real hour, free (gossip.js). The pump is
//      ci/fuel's.
//  Sinks only; nothing punishing: dirt and dents never stop a car working, a worn tire is an all-season one, the car
//  never breaks. Ima's minivan is always a bit dirty (and nobody touches it). Friends don't see dirt / dents: the relay
//  only carries the car's model key, and nothing more is sent (no network traffic of our own).
//  The fronts are storefronts' (NAMED rows kept for "carcare"): we claim them (ctx.storefronts.claim) — their ✋ is ours;
//  an attendant stands at the door while she's on foot nearby; the places go on the 📱 Map once she's been (ctx.pins).
//  Hooks we add elsewhere: car.js `car.mods` { grip, top } (tires) · law's "copLook" / "copHear" multipliers.
//
//  ctx.carcare = { cond(key), mine(), wash(key), fix(key, n), fit(key, tire), muffler(key, id), gossip(), debug }
//  events carcare:service { kind, key, id, price } · carcare:dent { key, dents } · carcare:diy
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import * as A from "../../audio.js";
import { SKINS } from "../../car.js";
import { spawnPerson } from "../../core/people.js";
import { models } from "../../models.js";
import { buyExtra } from "../garage/buy.js";
import { openCard, cardTick, cardOpen, closeCard, cardSay, repaint } from "../shops/card.js";
import { openAt, nextOpen } from "../storefronts/hours.js";
import { NAMED } from "../storefronts/data.js";
import { ID, PRICE, TUNE, TIRES, MUFFLERS, SHOPS, L } from "./data.js";
import { paintLook, dentLook, grime, bodyPoint, lookDebug } from "./look.js";
import { startDiy, D as DIY, diyTap } from "./dents.js";
import { gossipNow, facts, hourKey } from "./gossip.js";

const SAVE = store(ID, { pins: {}, imaDay: "", told: "", washes: 0, fixes: 0, diy: 0 });
const S = { t: 0, town: null, claims: [], staff: new Map(), look: 1, hear: 1, splash: -1, popT: 0, pops: [], acc: 0, twT: 0, log: [], local: {}, saveT: 0 };
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const log = (ev, d = {}) => { S.log.push(Object.assign({ ev, t: +(ctx.time || 0).toFixed(2) }, d)); if (S.log.length > 60) S.log.shift(); };
const on_ = () => ctx.enabled(ID) && !!ctx.G && ctx.G.mode !== "dina";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const nameOf = k => (SKINS[k] ? SKINS[k].name : k);
const footF = () => (ctx.foot && ctx.foot.debug ? ctx.foot.debug.F : null);
const titleCase = s => String(s).split(" ").map((w, i) => (i && /^(OF|THE|&|AND)$/.test(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");

// ── a car's condition (saved with ctx.cars) ──
const DEF = { dirt: 0, dents: 0, tire: "all", tireAt: 0, muf: "stock", shine: 0 };
/** Car k's condition: { dirt 0..1, dents 0..3, tire, tireAt (ms), muf, shine (ms it sparkles until) } — the live record. */
export function cond(k) {
    const c = (ctx.cars && ctx.cars.care && ctx.cars.care(k)) || (S.local[k] || (S.local[k] = {}));
    for (const f of Object.keys(DEF)) if (c[f] == null || (typeof c[f] !== typeof DEF[f])) c[f] = DEF[f];
    if (!TIRES[c.tire]) c.tire = "all";
    if (!MUFFLERS[c.muf]) c.muf = "stock";
    return c;
}
const owned = k => !!SKINS[k] && ((ctx.cars && ctx.cars.care) ? !!ctx.cars.care(k) : true);
const shining = c => c.shine > Date.now();
/** How worn a set of tires is: 0 (new) … 1 (all-season again). */
export function wear(c) { return c.tire === "all" ? 0 : clamp((Date.now() - (c.tireAt || 0)) / (TUNE.wearDays * 864e5)); }

/** The key of her OWN car while she's driving it (not a borrowed shell, a ride, the minivan, Dina's mode) — else "". */
export function mine() {
    if (!on_()) return "";
    const car = ctx.car;
    if (!car || !car.model || !car.model.visible) return "";
    if (ctx.streets && ctx.streets.ride) return "";
    if (ctx.foot && ctx.foot.vehicle) return "";
    const k = car.skinKey;
    return owned(k) ? k : "";
}

// ── dirt: distance (× rain), puddles ──
hook("update", (dt, P, controlsOn) => {
    if (ctx.state !== "playing") return;
    const k = mine();
    if (!k) return;
    const car = ctx.car, c = cond(k);
    // LOUD muffler: lifting off at speed → a few pops
    const was = S.acc; S.acc = car.accelLong || 0;
    if (c.muf === "loud" && Math.abs(car.vF || car.speed) > TUNE.popSpeed && was > 1.5 && S.acc < -0.5 && ctx.time > S.popT) {
        S.popT = ctx.time + TUNE.popGap;
        const n = 2 + (Math.random() * 2 | 0);
        for (let i = 0; i < n; i++) S.pops.push(ctx.time + 0.05 + i * (0.09 + Math.random() * 0.07));
    }
    const m = Math.abs(car.speed || 0) * dt;
    if (m <= 0.001) return;
    addDirt(c, m, (ctx.atmos && ctx.atmos.wet) || 0);
    if ((S.saveT += dt) > 5) { S.saveT = 0; saveSoon(); }
});
/** m metres driven on a road this wet (0..1) — not while a fresh wash sparkles. */
export function addDirt(c, m, wet = 0) {
    if (shining(c)) return c.dirt;
    return (c.dirt = clamp(c.dirt + m / 1000 / TUNE.dirtKm * (1 + (TUNE.rainMul - 1) * clamp(wet))));
}
function puddles() {
    const st = ctx.life && ctx.life.debug && ctx.life.debug.stats;
    const n = st ? st.carSplashes | 0 : 0;
    if (S.splash < 0) { S.splash = n; return; }
    if (n > S.splash) {
        const k = mine();
        if (k) { const c = cond(k); if (!shining(c)) { c.dirt = clamp(c.dirt + TUNE.puddle * (n - S.splash)); saveSoon(); } }
        S.splash = n;
    }
}
// ── dents: every lost heart in her own car ──
on("damage", () => {
    const k = mine();
    if (!k) return;
    const c = cond(k);
    if (c.dents >= TUNE.dentMax) return;
    c.dents++;
    saveSoon();
    log("dent", { key: k, dents: c.dents });
    emit("carcare:dent", { key: k, dents: c.dents });
});

// ── what it does on the road: tires (car.mods), the law's look / hearing ──
function mods(k) {
    const c = cond(k), t = TIRES[c.tire], f = 1 - wear(c), wet = clamp((ctx.atmos && ctx.atmos.wet) || 0);
    const g = t.dry + (t.wet - t.dry) * wet;
    return { grip: 1 + (g - 1) * f, top: 1 + (t.top - 1) * f };
}
function lawMuls() {
    const k = mine();
    S.look = 1; S.hear = 1;
    if (!k) return;
    const c = cond(k);
    if (c.dirt >= TUNE.dirty && !shining(c)) S.look *= TUNE.copLookDirty;
    if (c.muf === "quiet" && ctx.atmos && ctx.atmos.night > 0.5) S.look *= TUNE.copLookQuiet;
    if (c.muf === "loud") S.hear *= TUNE.copHearLoud;
}
hook("copLook", () => S.look);
hook("copHear", () => S.hear);

// ── how it looks: her car (driving), her car parked on foot, her other parked cars, Ima's minivan ──
const _p = new THREE.Vector3();
function dressAll() {
    const list = [];
    const car = ctx.car;
    if (car && car.model && on_() && owned(car.skinKey)) list.push([car.model, car.skinKey]);
    const F = footF();
    if (F && F.car && F.car.stub && F.car.stub.obj) {
        if (F.car.key === "lulu" && car && owned(car.skinKey)) list.push([F.car.stub.obj, car.skinKey]);
        else if (F.car.key === "town_minivan") grime(F.car.stub.obj, TUNE.minivanDirt);
    }
    // (Ima's minivan while she's driving it: foot's shell on her car)
    if (car && ctx.foot && ctx.foot.vehicle && ctx.foot.vehicle.kind === "town_minivan")
        for (const o of car.tilt.children) if (o !== car.model && o !== car.flames && o.visible) grime(o, TUNE.minivanDirt);
    if (ctx.cars && ctx.cars.props) for (const p of ctx.cars.props()) list.push([p.obj, p.key]);
    for (const [obj, k] of list) dress(obj, k);
    return list;
}
function dress(obj, k) {
    const c = cond(k), sh = shining(c) ? 1 : 0;
    const sig = `${k}|${Math.round(c.dirt * 20)}|${sh}|${c.dents}`;
    if (obj.userData.careSig === sig) return;
    obj.userData.careSig = sig;
    paintLook(obj, sh ? 0 : c.dirt, sh);
    dentLook(obj, c.dents * 2);
}
on("cars:prop", e => { if (e && e.obj && on_()) { e.obj.userData.careSig = null; dress(e.obj, e.key); } });
on("skin", () => { S.t = TUNE.tick; });
// a fresh wash twinkles
function twinkle(list, dt) {
    if ((S.twT -= dt) > 0) return;
    S.twT = 0.22;
    const cam = ctx.camera, fx = ctx.car && ctx.car.fx;
    if (!cam || !fx || ctx.skipping) return;
    for (const [obj, k] of list) {
        if (!obj.visible || !obj.parent || !shining(cond(k))) continue;
        obj.getWorldPosition(_p);
        if (_p.distanceTo(cam.position) > 45) continue;
        bodyPoint(obj, _p);
        fx.burst(_p.x, _p.y + 0.15, _p.z, 1, 0.3, [1, 1, 0.85], 0.32, 0.45);
    }
}

// ── the shops: claim storefronts' kept fronts ──
function frontsHere() {
    const SF = ctx.storefronts;
    if (!SF || !SF.debug || !ctx.town || !ctx.town.active) return [];
    return SF.debug.F.list.filter(f => f.st && f.st.reserved === "carcare" && f.st.named && SHOPS[f.st.named] && f.door);
}
function shopOpen(f) { return openAt(SHOPS[f.st.named].hours); }
function claimTown() {
    const SF = ctx.storefronts;
    const id = ctx.town && ctx.town.active ? ctx.town.id : null;
    if (id === S.town) return;
    dropStaff();
    S.town = id; S.claims = [];
    if (!id || !SF || !SF.claim) return;
    for (const f of frontsHere()) {
        const R = SHOPS[f.st.named], name = titleCase(f.name);
        SF.claim(f.id, {
            get label() {
                if (!shopOpen(f)) return fill(L.label.closed, { name: name.toUpperCase(), when: nextOpen(R.hours) || "back soon" });
                return fill(L.label[R.kind], { name: name.toUpperCase(), price: PRICE.wash });
            },
            enter: () => act(f),
        });
        S.claims.push(f);
        if (f.dlx != null && ctx.pins && ctx.pins.add) {
            const pid = "carcare:" + f.id;
            SAVE.pins[pid] = { town: id, local: [+f.dlx.toFixed(1), +f.dlz.toFixed(1)], name, kind: R.kind };
            addPin(pid, SAVE.pins[pid]);
        }
    }
    saveSoon();
    log("claim", { town: id, n: S.claims.length });
}
function addPin(id, p) {
    try { ctx.pins.add({ id, name: p.name, icon: SHOPS[Object.keys(SHOPS).find(n => SHOPS[n].kind === p.kind)].emoji, cat: "shops", town: p.town, local: p.local, sub: L.pin[p.kind] }); }
    catch (e) { /* no pins */ }
}
on("boot", () => { if (ctx.pins && ctx.pins.add) for (const [id, p] of Object.entries(SAVE.pins || {})) addPin(id, p); });
on("town:leave", () => { dropStaff(); S.town = null; });
on("title", () => { dropStaff(); S.town = null; });

// ── the people at the doors (only while she's on foot nearby) ──
function staffPos(f) {
    return { x: f.door.x + f.ux * 1.8 + f.nx * 0.5, z: f.door.z + f.uz * 1.8 + f.nz * 0.5, h: Math.atan2(f.nx, f.nz) };
}
function staffTick(dt) {
    const foot = ctx.foot && ctx.foot.active && ctx.foot.pos;
    for (const f of S.claims) {
        const st = S.staff.get(f.id);
        const d = foot ? Math.hypot(f.door.x - foot.x, f.door.z - foot.z) : 1e9;
        if (!st && d < TUNE.staffNear && shopOpen(f)) {
            const [key, nm, colors] = SHOPS[f.st.named].who;
            if (!models[key]) continue;
            const p = spawnPerson(key, { colors });
            p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
            const sp = staffPos(f);
            p.obj.position.set(sp.x, 0, sp.z); p.obj.rotation.y = sp.h;
            ctx.scene.add(p.obj);
            S.staff.set(f.id, { p, name: nm, talk: 0 });
        } else if (st && (d > TUNE.staffFar || !shopOpen(f))) {
            st.p.obj.removeFromParent(); S.staff.delete(f.id);
        }
    }
}
hook("hud", dt => { if (S.staff.size) for (const st of S.staff.values()) { if (st.talk > 0) st.talk -= dt; st.p.update(dt, { walk: 0, talk: st.talk > 0 }); } });
function dropStaff() { for (const st of S.staff.values()) st.p.obj.removeFromParent(); S.staff.clear(); }
function staffSay(f, text, dur = 4) {
    const st = S.staff.get(f.id);
    if (st) st.talk = Math.min(dur, 2.5);
    const target = st ? st.p.obj : ctx.foot && ctx.foot.obj;
    try {
        if (ctx.banter && ctx.banter.bubble && target) { ctx.banter.bubble(text, target, { dur }); return; }
        if (ctx.foot && ctx.foot.say && target) ctx.foot.say(target, text, dur);
    } catch (e) { console.error("[carcare] say", e); }
}

// ── which car is at the shop ──
/** Her car near this front: { key, obj } — or { why: "none" | "minivan" | "borrowed" }. */
export function carAt(f) {
    const at = f.door, near = (x, z) => Math.hypot(x - at.x, z - at.z) <= TUNE.carNear;
    const F = footF(), car = ctx.car;
    let best = null, bd = 1e9, why = "none";
    const consider = (key, obj, x, z) => { const d = Math.hypot(x - at.x, z - at.z); if (d < bd) { bd = d; best = { key, obj }; } };
    if (F && F.car && F.car.stub) {
        const s = F.car.stub;
        if (near(s.x, s.z)) {
            if (F.car.key === "lulu" && car && owned(car.skinKey)) consider(car.skinKey, s.obj, s.x, s.z);
            else why = F.car.key === "town_minivan" ? "minivan" : "borrowed";
        }
    }
    if (ctx.cars && ctx.cars.props) for (const p of ctx.cars.props()) if (near(p.x, p.z)) consider(p.key, p.obj, p.x, p.z);
    return best || { why };
}

// ── ✋ at a front ──
function act(f) {
    if (!on_()) return false;
    const R = SHOPS[f.st.named];
    if (!shopOpen(f)) { staffSay(f, `"${((NAMED[f.st.named] || {}).shut || "CLOSED")}" — ${nextOpen(R.hours) || "back soon"}`, 3); return true; }
    if (R.kind === "gossip") return gossip(f);
    const t = carAt(f);
    if (!t.key) { staffSay(f, t.why === "minivan" ? pick(L.minivan) : t.why === "borrowed" ? L.notHers : pick(L.noCar)); return true; }
    const spec = { wash: washCard, body: bodyCard, tires: tireCard, muffler: mufCard }[R.kind](f, t);
    return withCard(spec);
}
function withCard(spec) {
    if (cardOpen() || !ctx.foot || !ctx.foot.script) return false;
    const ok = ctx.foot.script({
        update(dt, P, Fo) { if (Fo && Fo.lulu) Fo.lulu.update(dt, { walk: 0 }); return cardTick(P); },
        abort() { if (cardOpen()) closeCard(true); },
    });
    if (!ok) return false;
    openCard(spec);
    return true;
}
const served = (kind, key, id, price) => { emit("carcare:service", { kind, key, id, price }); log("service", { kind, key, id, price }); };

// 🧽 the wash
export function wash(k) {
    const c = cond(k);
    c.dirt = 0; c.shine = Date.now() + TUNE.shineMin * 60000;
    SAVE.washes++; saveSoon();
    S.t = TUNE.tick;
    emit("stat", { id: "carWashes", n: 1 });
    return true;
}
function foam(obj) {
    const fx = ctx.car && ctx.car.fx;
    if (!fx || !obj) return;
    for (let i = 0; i < 6; i++) { bodyPoint(obj, _p); fx.burst(_p.x, _p.y + 0.2, _p.z, 6, 1.4, [0.95, 0.97, 1], 0.6, 0.9); }
}
function dirtWord(c) { return shining(c) ? L.dirtState[0] : L.dirtState[c.dirt < 0.15 ? 1 : c.dirt < 0.4 ? 2 : c.dirt < 0.8 ? 3 : 4]; }
function washCard(f, t) {
    const c = cond(t.key);
    return {
        title: fill(L.title.wash, { name: titleCase(f.name) }),
        head: () => fill(L.washHead, { name: nameOf(t.key), state: dirtWord(c) }),
        tiles: [{ id: "wash", icon: "🧽", name: L.washTile, price: PRICE.wash, desc: L.washDesc,
            state: () => (shining(c) ? "na" : "buy"), act: () => cardSay(L.alreadyClean),
            buy: () => {
                const r = buyExtra(ID, "wash", PRICE.wash);
                if (!r.ok) return r;
                wash(t.key); foam(t.obj); t.obj.userData.careSig = null; dress(t.obj, t.key);
                served("wash", t.key, "wash", PRICE.wash);
                staffSay(f, pick(L.washed), 4.5);
                cardSay(pick(L.washed));
                return { ok: true };
            } }],
        focus: "wash",
    };
}
// 🔧 the body shop
export function fix(k, n = 1) {
    const c = cond(k);
    const was = c.dents;
    c.dents = Math.max(0, c.dents - n);
    if (c.dents !== was) { SAVE.fixes += was - c.dents; saveSoon(); S.t = TUNE.tick; }
    return was - c.dents;
}
function dentWord(c) { return L.dentState[clamp(c.dents, 0, 3)]; }
function bodyCard(f, t) {
    const c = cond(t.key);
    const redress = () => { t.obj.userData.careSig = null; dress(t.obj, t.key); };
    return {
        title: fill(L.title.body, { name: titleCase(f.name) }),
        head: () => fill(L.bodyHead, { name: nameOf(t.key), state: dentWord(c) }),
        tiles: [
            { id: "one", icon: "🔧", name: L.fixTile, price: PRICE.dent, desc: fill(L.fixDesc, { price: PRICE.dent }),
                state: () => (c.dents > 0 ? "buy" : "na"), act: () => cardSay(L.noDents),
                buy: () => { const r = buyExtra(ID, "dent", PRICE.dent); if (!r.ok) return r; fix(t.key, 1); redress(); served("body", t.key, "one", PRICE.dent); cardSay(pick(L.fixed)); return { ok: true }; } },
            { id: "all", icon: "🛠️", name: L.fixAllTile, get price() { return PRICE.dent * Math.max(1, c.dents); }, desc: fill(L.fixDesc, { price: PRICE.dent }),
                state: () => (c.dents > 1 ? "buy" : "na"), act: () => cardSay(c.dents ? fill(L.fixDesc, { price: PRICE.dent }) : L.noDents),
                buy: () => { const p = PRICE.dent * c.dents; const r = buyExtra(ID, "dents", p); if (!r.ok) return r; fix(t.key, c.dents); redress(); served("body", t.key, "all", p); cardSay(pick(L.fixed)); return { ok: true }; } },
            { id: "diy", icon: "🪠", name: L.diyTile, price: PRICE.diy, desc: L.diyDesc,
                state: () => (c.dents > 0 ? "buy" : "na"), act: () => cardSay(L.noDents),
                buy: () => {
                    const r = buyExtra(ID, "diy", PRICE.diy);
                    if (!r.ok) return r;
                    served("body", t.key, "diy", PRICE.diy);
                    SAVE.diy++; saveSoon();
                    closeCard(true);
                    // two dent decals a level: every second pop takes a level off
                    let decals = c.dents * 2;
                    startDiy(decals, {
                        onPop: () => { decals--; const lv = Math.ceil(decals / 2); if (lv < c.dents) fix(t.key, c.dents - lv); t.obj.userData.careSig = null; dentLook(t.obj, decals); },
                        onEnd: () => { redress(); },
                    });
                    return { ok: true };
                } },
        ],
        focus: c.dents > 1 ? "all" : "one",
    };
}
// 🛞 the tires
export function fit(k, id) {
    const c = cond(k);
    if (!TIRES[id]) return false;
    c.tire = id; c.tireAt = Date.now();
    saveSoon();
    return true;
}
function tirePrice(c, id) { const p = PRICE[id] || 0; return c.tire === id && wear(c) >= 1 ? Math.round(p * PRICE.refit) : p; }
function tireCard(f, t) {
    const c = cond(t.key);
    const head = () => {
        const w = wear(c), wr = c.tire === "all" ? "" : w >= 1 ? L.tireWorn : fill(L.tireWear, { pct: Math.round((1 - w) * 100) });
        return fill(L.tireHead, { name: nameOf(t.key), tire: TIRES[c.tire].name, wear: wr });
    };
    return {
        title: fill(L.title.tires, { name: titleCase(f.name) }), head,
        tiles: Object.keys(TIRES).map(id => ({ id, icon: TIRES[id].emoji, name: TIRES[id].name, get price() { return tirePrice(c, id); }, desc: TIRES[id].desc,
            state: () => (c.tire === id && (id === "all" || wear(c) < 1) ? "placed" : "buy"),
            buy: () => {
                const p = tirePrice(c, id);
                const r = buyExtra(ID, "tire:" + id, p);
                if (!r.ok) return r;
                fit(t.key, id); served("tires", t.key, id, p);
                cardSay(fill(pick(L.tireDone), { tire: TIRES[id].name }));
                return { ok: true };
            } })),
        focus: c.tire === "all" ? "sport" : c.tire,
    };
}
// 🔊 the mufflers
export function muffler(k, id) {
    const c = cond(k);
    if (!MUFFLERS[id]) return false;
    c.muf = id; saveSoon();
    return true;
}
function mufCard(f, t) {
    const c = cond(t.key);
    return {
        title: fill(L.title.muffler, { name: titleCase(f.name) }),
        head: () => fill(L.mufHead, { name: nameOf(t.key), muf: MUFFLERS[c.muf].name }),
        tiles: Object.keys(MUFFLERS).map(id => ({ id, icon: MUFFLERS[id].emoji, name: MUFFLERS[id].name, price: PRICE[id] || 0, desc: MUFFLERS[id].desc,
            state: () => (c.muf === id ? "placed" : "buy"),
            buy: () => {
                const r = buyExtra(ID, "muffler:" + id, PRICE[id] || 0);
                if (!r.ok) return r;
                muffler(t.key, id); served("muffler", t.key, id, PRICE[id] || 0);
                if (id === "loud") { A.sfxPop(0.8); setTimeout(() => A.sfxPop(1), 140); }
                cardSay(L.mufDone[id]);
                return { ok: true };
            } })),
        focus: c.muf === "stock" ? "loud" : c.muf,
    };
}
// ☕ the gossip
export function gossip(f = null) {
    const g = gossipNow();
    const hk = hourKey();
    let text;
    if (!g) text = L.gossipNone;
    else if (SAVE.told === hk + "|" + g.id) text = L.gossipSame + " " + g.text;
    else { text = g.text; SAVE.told = hk + "|" + g.id; saveSoon(); emit("stat", { id: "gossipHeard", n: 1 }); }
    if (f) staffSay(f, text, 6);
    log("gossip", { id: g ? g.id : null });
    emit("carcare:gossip", { id: g ? g.id : null, text });
    return { id: g ? g.id : null, text };
}

// ── Ima, at the door: the car's dirty (once a real day) ──
on("foot:start", e => {
    if (!e || e.reason !== "home" || !on_() || SAVE.imaDay === today()) return;
    const k = ctx.car && ctx.car.skinKey;
    if (!owned(k)) return;
    const c = cond(k);
    if (c.dirt < TUNE.dirty || shining(c)) return;
    SAVE.imaDay = today(); saveSoon();
    setTimeout(() => {
        // (a line that answers what she just did — walked out to a filthy car: shown as a card, not kept in Messages)
        let shown = false;
        try { if (ctx.phone && ctx.phone.text) shown = !!ctx.phone.text({ from: "Ima", emoji: "👩", color: "#EC407A", msg: pick(L.ima), dur: 5, react: true }); }
        catch (err) { /* no phone */ }
        log("imaText", { shown });
    }, 2500);
    log("ima", { key: k });
});

// ── the tick ──
hook("hud", dt => {
    // pops due (LOUD muffler)
    if (S.pops.length && ctx.time >= S.pops[0]) {
        S.pops.shift();
        const car = ctx.car;
        if (car && ctx.state === "playing") {
            A.sfxPop(0.7 + Math.random() * 0.3);
            const bx = car.pos.x - Math.sin(car.h) * 2.3, bz = car.pos.z - Math.cos(car.h) * 2.3;
            if (car.fx && !ctx.skipping) car.fx.burst(bx, 0.45, bz, 5, 2.2, [1, 0.6, 0.2], 0.35, 0.25);
            S.popN = (S.popN || 0) + 1;
            emit("carcare:pop", {});
        }
    }
    if ((S.t += dt) < TUNE.tick) { if (S.list) twinkle(S.list, dt); return; }
    const step = S.t; S.t = 0;
    if (!ctx.enabled(ID)) { if (ctx.car && ctx.car.mods) ctx.car.mods = null; S.look = S.hear = 1; return; }
    try {
        puddles();
        const k = mine();
        if (ctx.car) ctx.car.mods = k ? mods(k) : null;
        lawMuls();
        claimTown();
        if (S.claims.length) staffTick(step);
        S.list = dressAll();
        twinkle(S.list, step);
    } catch (e) { console.error("[carcare] tick", e); }
});

ctx.carcare = {
    cond: k => (SKINS[k] ? cond(k) : null), mine, wash, fix, fit, muffler, gossip, wear: k => wear(cond(k)),
    /** What other players see of car k (multiplayer's d.cc): [dirt 0..10, dents 0..3] — a fresh wash shows clean; null
     *  when it isn't one of hers. */
    look(k) { if (!on_() || !SKINS[k] || !owned(k)) return null; const c = cond(k); return [shining(c) ? 0 : Math.round(Math.min(1, c.dirt) * 10), Math.max(0, Math.min(3, c.dents | 0))]; },
    /** Dress another player's car copy (a clone of the lulu model): her dirt (0..10) on the paint, her dents (0..3). */
    dressOther(obj, dirt10, dents) { if (!obj) return; if (dirt10) paintLook(obj, Math.min(10, dirt10) / 10, 0); if (dents) dentLook(obj, Math.min(3, dents) * 2); },
    get look() { return S.look; }, get hear() { return S.hear; },
    debug: { S, SAVE, D: DIY, diyTap, addDirt, lawMuls, facts, gossipNow, carAt, frontsHere, act, dressAll, mods, lookDebug, staffTick, claimTown },
};
