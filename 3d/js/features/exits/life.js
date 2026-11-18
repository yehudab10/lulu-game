// features/exits — LIFE at the rest area: the travellers (pooled, only near her), Kugel the dog,
// the ✋ on-foot spots (talk, the food court, the restrooms, the vending machines, the souvenir
// stand, the picnic tables, the dog) and the two drive-up bays (ctx.places: the gas pump, Mendel's).
import * as THREE from "three";
import { ctx, emit, pick, rand } from "../../core/ctx.js";
import { store, saveSoon, shared, wallet, flushShared, save3d } from "../../core/save.js";
import { heal, addScore } from "../../core/driving.js";
import { models, ensureModels, registerModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { choose, say } from "../../core/dialog.js";
import { rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import * as LY from "./layout.js";
import * as L from "./lines.js";
import { at } from "./build.js";

registerModels({ lawK9: "law_k9" });
export const PEOPLE_MODELS = ["npcMan", "npcWoman", "npcKid"];
export const saved = store("exits", { visits: 0, dealDay: -1, meals: 0, kicks: 0, restroom: 0 });

/** The live cast of the rest area she's at (or null). */
export const LIFE = { R: null, people: [], dog: null, dummies: [], busy: false, vend: { stuck: false }, rested: false, near: null, gag: 0, spot: null };
const _q = {};
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
const quiet = () => (save3d.settings.chatter || "normal") === "quiet";
/** Small game-time timers (they pause / skip with the game). */
const timers = [];
export function later(sec, fn) { timers.push({ at: ctx.time + sec, fn }); }

// ── say things ───────────────────────────────────────────────────────────
/** Over a person / object: foot's bubbles on foot, banter's bubble at the wheel, else a toast. */
export function sayOver(obj, text, sec = 3, who = "") {
    if (!text) return;
    if (onFoot() && ctx.foot.say) { ctx.foot.say(obj, text, sec); return; }
    let ok = false;
    if (obj && ctx.banter && ctx.banter.bubble) { try { ok = ctx.banter.bubble(text, obj, { dur: sec, y: 2.0 }); } catch (e) { ok = false; } }
    if (!ok) H.toast(`${who ? who + ": " : ""}${text}`, "pink");
}
/** Lulu says something (over her on foot, banter's line at the wheel). */
export function luluSays(text, sec = 2.8) {
    if (!text || quiet()) return;
    if (onFoot() && ctx.foot.obj) { ctx.foot.say(ctx.foot.obj, text, sec); return; }
    if (ctx.banter && ctx.banter.say) { try { ctx.banter.say(text); return; } catch (e) { /* toast */ } }
    H.toast(`💬 ${text}`);
}

// ── spawn / despawn the cast ─────────────────────────────────────────────
let loading = false;
export function spawnCast(R) {
    if (LIFE.R === R) return;
    despawnCast();
    if (!PEOPLE_MODELS.every(k => models[k])) { if (!loading) { loading = true; ensureModels(PEOPLE_MODELS).catch(() => {}).finally(() => { loading = false; }); } return; }
    if (!models.lawK9) ensureModels(["lawK9"]).catch(() => {});
    LIFE.R = R; LIFE.vend.stuck = false; LIFE.rested = false;
    for (const pa of LY.PEOPLE_AT) {
        const def = L.PEOPLE[pa.id];
        if (!def) continue;
        const p = spawnPerson(def.key, { colors: def.colors, scale: pa.scale || 1 });
        at(R, pa.u, pa.d, "road", _q);
        p.obj.position.set(_q.x, 0.05, _q.z);
        const f = at(R, pa.face[0], pa.face[1], "road", {});
        p.obj.rotation.y = Math.atan2(f.x - _q.x, f.z - _q.z);
        p.obj.traverse(m => { if (m.isMesh) m.castShadow = false; });      // (travellers cast no shadow, like the townsfolk)
        ctx.scene.add(p.obj);
        LIFE.people.push({ id: pa.id, name: def.name, p, lines: def.lines && def.lines.length ? def.lines : null, k: 0, talkT: 0, waveT: 0, t: rand(0, 5), home: { x: _q.x, z: _q.z, h: p.obj.rotation.y } });
    }
    // dummies at the doors (speech bubbles come out of the restroom)
    for (const k of ["restroom", "food"]) {
        const sp = LY.SPOTS[k], o = new THREE.Object3D();
        at(R, sp.u, sp.d + 0.8, "road", _q);
        o.position.set(_q.x, 0, _q.z);
        ctx.scene.add(o);
        LIFE.dummies.push(o); LIFE[k + "Obj"] = o;
    }
}
export function despawnCast() {
    timers.length = 0;
    for (const r of LIFE.people) r.p.obj.removeFromParent();
    LIFE.people.length = 0;
    if (LIFE.dog) { LIFE.dog.obj.removeFromParent(); LIFE.dog = null; }
    for (const o of LIFE.dummies) o.removeFromParent();
    LIFE.dummies.length = 0;
    LIFE.R = null; LIFE.busy = false;
}
function spawnDog(R) {
    if (LIFE.dog || !models.lawK9) return;
    const o = models.lawK9.clone(true);
    at(R, LY.DOG_AT.u, LY.DOG_AT.d, "along", _q);
    o.position.set(_q.x, 0, _q.z);
    o.rotation.y = _q.yaw;
    o.scale.setScalar(0.85);
    ctx.scene.add(o);
    LIFE.dog = { obj: o, cx: _q.x, cz: _q.z, t: 0, petT: 0 };
}

/** Per frame (driving and on foot) while she's near a rest area. */
export function tickLife(dt) {
    for (let i = timers.length - 1; i >= 0; i--) if (ctx.time >= timers[i].at) { const t = timers.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error("[exits]", e); } }
    const R = LIFE.R;
    if (!R) return;
    if (!LIFE.dog) spawnDog(R);
    const cam = ctx.camera.position;
    for (const r of LIFE.people) {
        const o = r.p.obj;
        o.visible = Math.hypot(o.position.x - cam.x, o.position.z - cam.z) < 40;      // (~3–4k triangles each: only the near ones)
        if (!o.visible) continue;
        r.t += dt;
        if (r.talkT > 0) r.talkT -= dt;
        if (r.waveT > 0) r.waveT -= dt;
        if (r.talkT <= 0 && Math.abs(o.rotation.y - r.home.h) > 0.01) o.rotation.y += (r.home.h - o.rotation.y) * Math.min(1, dt * 2);
        r.p.update(dt, { talk: r.talkT > 0 || (r.id === "ima" && Math.sin(r.t * 0.8) > 0.4) || (r.id === "teen" && Math.sin(r.t * 0.5) > 0), wave: r.waveT > 0 || (r.id === "pump" && Math.sin(r.t * 0.4) > 0.93) });
    }
    if (LIFE.dog) {
        const D = LIFE.dog, o = D.obj;
        D.t += dt;
        if (D.petT > 0) { D.petT -= dt; o.position.y = Math.abs(Math.sin(D.t * 14)) * 0.08; o.rotation.z = Math.sin(D.t * 20) * 0.05; }
        else {
            // trot a lazy loop round the run
            const a = D.t * 0.35, x = D.cx + Math.cos(a) * 3.2, z = D.cz + Math.sin(a) * 2.2;
            o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z);
            o.position.set(x, Math.abs(Math.sin(D.t * 9)) * 0.04, z);
            o.rotation.z = 0;
        }
    }
}

// ── the ✋ spot (one, for everything at the rest area: foot picks the nearest interactable) ──
function nearest() {
    const R = LIFE.R;
    if (!R || !onFoot() || LIFE.busy) return null;
    const f = ctx.foot.pos;
    let best = null, bd = 9;
    const consider = (kind, ent, x, z, r, label, short) => { const d = Math.hypot(x - f.x, z - f.z); if (d < r && d < bd) { bd = d; best = { kind, ent, x, z, label, short }; } };
    for (const r of LIFE.people) if (r.lines) consider("talk", r, r.p.obj.position.x, r.p.obj.position.z, 2.3, `💬 ${r.name}`, "TALK");
    if (LIFE.dog) consider("dog", LIFE.dog, LIFE.dog.obj.position.x, LIFE.dog.obj.position.z, 2.2, `🐾 PET ${L.DOG.name.toUpperCase()}`, "PET");
    const S = LY.SPOTS;
    const pt = (sp, kind, label, short) => { at(R, sp.u, sp.d, "road", _q); consider(kind, sp, _q.x, _q.z, sp.r || 2.2, label, short); };
    pt(S.food, "food", "🍔 FOOD COURT", "FOOD");
    pt(S.restroom, "restroom", "🚻 RESTROOMS", "🚻");
    pt(S.vending, "vending", LIFE.vend.stuck ? "👊 KICK THE MACHINE" : `🥤 SNACKS · ${L.VENDING.cost} 💰`, LIFE.vend.stuck ? "KICK" : "SNACK");
    pt(S.souvenir, "souvenir", "🛍️ SOUVENIRS · deal of the day", "SHOP");
    for (const sp of S.picnic) pt(Object.assign({ r: 2.0 }, sp), "picnic", "🧺 SIT A MINUTE", "SIT");
    return best;
}
export const restSpot = {
    r: 3.0, short: "✋",
    pos() { LIFE.spot = nearest(); if (LIFE.spot) this.short = LIFE.spot.short; return LIFE.spot ? { x: LIFE.spot.x, z: LIFE.spot.z } : null; },
    label() { return LIFE.spot ? LIFE.spot.label : null; },
    act() { const s = LIFE.spot; if (s) act(s); },
};
function act(s) {
    try {
        if (s.kind === "talk") return talk(s.ent);
        if (s.kind === "dog") return petDog();
        if (s.kind === "food") return food();
        if (s.kind === "restroom") return restroom();
        if (s.kind === "vending") return vending();
        if (s.kind === "souvenir") return souvenir();
        if (s.kind === "picnic") return picnic(s.ent);
    } catch (e) { console.error("[exits]", e); LIFE.busy = false; }
}
/** (tests) do whatever's at a spot kind right now, as if she'd pressed ✋ there. */
export function actAt(kind) { const s = nearest(); return s && s.kind === kind ? (act(s), true) : false; }

function stat(id, n = 1) { emit("stat", { id, n }); }
function pay(n) {
    if (wallet.coins < n) return false;
    if (!wallet.spend(n)) return false;
    flushShared();
    if (!ctx.skipping) A.sfxCoin(2);
    return true;
}

// ── the people ───────────────────────────────────────────────────────────
function talk(r) {
    const line = r.lines[r.k++ % r.lines.length];
    r.talkT = 3.2;
    const o = r.p.obj, f = ctx.foot.pos;
    o.rotation.y = Math.atan2(f.x - o.position.x, f.z - o.position.z);
    sayOver(o, line, 3.6, r.name);
    if (Math.random() < 0.45) later(2.6, () => { if (onFoot()) luluSays(pick(L.LULU_REPLY), 2.2); });
    emit("exits:talk", { id: r.id, line });
    stat("restTalks");
}
function petDog() {
    const D = LIFE.dog;
    D.petT = 2.4;
    sayOver(D.obj, pick(L.DOG.pet), 2.2);
    luluSays(pick(L.DOG.lulu), 2.6);
    const w = LIFE.people.find(r => r.id === "walker");
    if (w && Math.random() < 0.6) { w.talkT = 2.6; sayOver(w.p.obj, pick(L.DOG.ownerLines), 3.2, L.DOG.owner); }
    rumble(0.1, 0.3, 120);
    emit("exits:dog", {});
    stat("restDogPets");
}

// ── the food court: hearts for coins ─────────────────────────────────────
async function food() {
    if (LIFE.busy) return;
    LIFE.busy = true;
    const G = ctx.G, F = L.FOOD;
    try {
        const opts = F.menu.map(m => `${m.label} — ${m.cost} 💰 · +${m.hearts} ❤️`).concat(["🙅‍♀️ Just looking"]);
        const i = await choose(F.who, pick(F.hello), opts, { emoji: "🍔", color: "#2E7D5B" });
        const m = F.menu[i];
        if (!m) { await say(F.who, pick(F.bye), { emoji: "🍔", color: "#2E7D5B" }); return; }
        if (G.hearts >= G.maxHearts) { await say(F.who, F.fullUp, { emoji: "🍔", color: "#2E7D5B" }); addScore(25, "pickle"); luluSays(pick(L.LULU.full)); return; }
        if (!pay(m.cost)) { H.toast(`🍔 ${m.cost} 💰 — you've got ${wallet.coins}`, "red"); luluSays(pick(L.LULU.broke)); return; }
        heal(Math.min(m.hearts, G.maxHearts - G.hearts));
        H.toast(`${m.label} −${m.cost} 💰 · +${m.hearts} ❤️`, "pink");
        saved.meals++; saveSoon();
        emit("exits:food", { id: m.id, cost: m.cost });
        stat("restMeals");
        await say("Lulu", m.line, { emoji: "😋", color: "#C2185B" });
    } finally { LIFE.busy = false; }
}

// ── the restrooms: a gag (she pops in; the door does the talking) ────────
function restroom() {
    if (LIFE.busy || !ctx.foot.script) return;
    const gag = L.RESTROOM[saved.restroom++ % L.RESTROOM.length];
    saveSoon();
    const door = LIFE.restroomObj;
    let t = 0, said = 0;
    LIFE.busy = true;
    const done = () => { const F = ctx.foot.debug && ctx.foot.debug.F; if (F && F.lulu) F.lulu.obj.visible = true; LIFE.busy = false; };
    const ok = ctx.foot.script({
        update(dt, P, F) {
            t += dt;
            if (F.lulu) F.lulu.obj.visible = t < 0.35 || t > 4.2;
            const beats = [0.5, 1.7, 2.9];
            while (said < beats.length && t >= beats[said]) { if (door) ctx.foot.say(door, gag.say[said], 1.3); said++; }
            if (t > 4.3 && said === 3) { said++; ctx.foot.say(F.lulu.obj, gag.out, 3.0); }
            if (t > 4.6) { done(); return false; }
            return true;
        },
        abort() { done(); },
    });
    if (!ok) { LIFE.busy = false; return; }
    if (!ctx.skipping) A.sfxBump();
    emit("exits:restroom", { gag: L.RESTROOM.indexOf(gag) });
    stat("restRestrooms");
}

// ── the vending machines: a snack (nitro), and sometimes it sticks ───────
function vending() {
    const G = ctx.G, V = L.VENDING;
    if (LIFE.vend.stuck) {
        LIFE.vend.stuck = false;
        rumble(0.4, 0.5, 160);
        if (!ctx.skipping) A.sfxBump();
        if (Math.random() < 0.65) {
            luluSays(pick(V.kick), 2.6);
            G.boost = Math.min(1, (G.boost || 0) + 0.5);
            addScore(50, "vending");
            H.toast("🥨🥨 TWO snacks! +nitro", "gold");
            emit("exits:vending", { result: "kick" });
            saved.kicks++; saveSoon();
            stat("restKicks");
        } else { luluSays(V.kickFail, 2.4); emit("exits:vending", { result: "ow" }); }
        return;
    }
    if (!pay(V.cost)) { H.toast(`🥤 ${V.cost} 💰 — exact change only`, "red"); luluSays(pick(L.LULU.broke)); return; }
    if (Math.random() < 0.35) { LIFE.vend.stuck = true; luluSays(pick(V.stuck), 2.6); emit("exits:vending", { result: "stuck" }); return; }
    G.boost = Math.min(1, (G.boost || 0) + 0.25);
    H.toast(`${pick(V.snacks)} · +nitro`, "gold");
    emit("exits:vending", { result: "snack" });
    stat("restSnacks");
}

// ── the souvenir stand: one deal a day, trinkets any time ────────────────
export const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
export const dealOfDay = () => L.SOUVENIR.deals[dayNum() % L.SOUVENIR.deals.length];
async function souvenir() {
    if (LIFE.busy) return;
    LIFE.busy = true;
    const S = L.SOUVENIR, deal = dealOfDay(), sold = saved.dealDay === dayNum();
    const vendor = LIFE.people.find(r => r.id === "souvenir");
    if (vendor) vendor.talkT = 3;
    try {
        const opts = [sold ? `${deal.label} — SOLD OUT (back tomorrow)` : `⭐ ${deal.label} — ${deal.cost} 💰 (deal of the day)`, `🎁 A souvenir — ${S.trinketCost} 💰`, "🙅‍♀️ Just looking"];
        const i = await choose(S.who, pick(S.hello), opts, { emoji: "🛍️", color: "#6A1B9A" });
        if (i === 0 && !sold) {
            if (!pay(deal.cost)) { H.toast(`🛍️ ${deal.cost} 💰 — you've got ${wallet.coins}`, "red"); return; }
            shared.update(s => deal.give(s));
            saved.dealDay = dayNum(); saveSoon();
            H.toast(`${deal.label} −${deal.cost} 💰`, "gold");
            emit("exits:souvenir", { id: deal.id });
            stat("restSouvenirs");
            await say(S.who, deal.line, { emoji: "🛍️", color: "#6A1B9A" });
        } else if (i === 1) {
            if (!pay(S.trinketCost)) { H.toast(`🎁 ${S.trinketCost} 💰 — you've got ${wallet.coins}`, "red"); return; }
            const what = pick(S.trinkets);
            H.toast(`🎁 You bought ${what}`, "pink");
            addScore(30, "souvenir");
            emit("exits:souvenir", { id: "trinket", what });
            stat("restSouvenirs");
            luluSays("Bubbe's gonna LOVE this. (Bubbe's gonna re-gift this.)", 2.8);
        } else await say(S.who, pick(S.bye), { emoji: "🛍️", color: "#6A1B9A" });
    } finally { LIFE.busy = false; }
}

// ── the picnic tables: sit a minute (once a visit: a heart if she's hurt) ──
function picnic(sp) {
    if (LIFE.busy || !ctx.foot.script) return;
    const R = LIFE.R, seat = at(R, sp.u, sp.d - 0.15, "road", {}), table = at(R, sp.u, sp.d + 0.75, "road", {});
    let t = 0;
    LIFE.busy = true;
    const ok = ctx.foot.script({
        update(dt, P, F) {
            t += dt;
            const o = F.lulu.obj;
            F.pos.set(seat.x, 0, seat.z);
            o.position.set(seat.x, 0.05, seat.z);
            o.rotation.y = Math.atan2(table.x - seat.x, table.z - seat.z);
            F.lulu.update(dt, { sit: true });
            if (t > 3.2 || (t > 0.8 && (P.back || P.interact))) { LIFE.busy = false; return false; }
            return true;
        },
        abort() { LIFE.busy = false; },
    });
    if (!ok) { LIFE.busy = false; return; }
    luluSays(pick(L.PICNIC), 3);
    const G = ctx.G;
    if (!LIFE.rested && G.hearts < G.maxHearts) { LIFE.rested = true; heal(1); H.toast("🧺 A real sit-down: +1 ❤️", "pink"); }
    emit("exits:picnic", {});
    stat("restPicnics");
}

// ── the drive-up bays (ctx.places): the pump and Mendel's ────────────────
const byId = id => LIFE.people.find(r => r.id === id);
function hostObj(id, sp) {
    const r = byId(id);
    if (r) return r.p.obj;
    if (!sp.hostDummy) { sp.hostDummy = new THREE.Object3D(); sp.hostDummy.position.set(sp.x, 0, sp.z); sp.chunk.add(sp.hostDummy); }
    return sp.hostDummy;
}
export function registerBays(restS) {
    const P = ctx.places;
    if (!P || !P.add) return;
    const B = LY.BAYS;
    const cam = (u, d) => (sp, t, pos, look) => {
        const R = { s: sp.s - u }, c = at(R, u - 11, d - 9, "road", {}), l = at(R, u + 1, d + 1.5, "road", {});
        pos.set(c.x, 3.6, c.z); look.set(l.x, 1.2, l.z);
    };
    P.add({
        id: "exits_pump", name: "the rest-area pumps", icon: "⛽", verb: `fill up · ${L.GAS.cost} 💰`, kind: "rest",
        where: mode => restS(mode).map(s => s + B.pump.u),
        d: B.pump.d, bay: { half: B.pump.half, d0: B.pump.d0, d1: B.pump.d1 },
        host: sp => { const o = hostObj("pump", sp); return { x: o.position.x, y: 1.5, z: o.position.z }; },
        cam: cam(B.pump.u, B.pump.d), dur: 3.4,
        beats: [
            { t: 0.25, run: sp => { const r = byId("pump"); if (r) r.talkT = 2.4; sayOver(hostObj("pump", sp), pick(L.GAS.hello), 2.6, L.GAS.who); } },
            { t: 1.4, run: () => {
                const G = ctx.G;
                let result;
                if ((G.boost || 0) > 0.98) { addScore(50, "pump"); H.toast(L.GAS.full, "gold"); result = "full"; }
                else if (pay(L.GAS.cost)) { G.boost = 1; H.toast(L.GAS.done.replace("{cost}", L.GAS.cost), "gold"); result = "filled"; stat("restFills"); }
                else { G.boost = Math.min(1, (G.boost || 0) + 0.3); H.toast(L.GAS.broke, "red"); result = "broke"; }
                rumble(0.1, 0.3, 120);
                emit("exits:pump", { result });
            } },
            { t: 2.2, run: () => luluSays(pick(L.GAS.reply)) },
        ],
    });
    P.add({
        id: "exits_garage", name: "Mendel's Mufflers", icon: "🔧", verb: `Mendel's · dents out ${L.MECHANIC.cost} 💰`, kind: "rest",
        where: mode => restS(mode).map(s => s + B.garage.u),
        d: B.garage.d, bay: { half: B.garage.half, d0: B.garage.d0, d1: B.garage.d1 },
        host: sp => { const o = hostObj("mechanic", sp); return { x: o.position.x, y: 1.5, z: o.position.z }; },
        cam: cam(B.garage.u, B.garage.d - 4), dur: 3.6,
        beats: [
            { t: 0.25, run: sp => { const r = byId("mechanic"); if (r) r.talkT = 2.6; const dmg = ctx.feel && ctx.feel.damage && ctx.feel.damage.k > 0; sayOver(hostObj("mechanic", sp), pick(dmg ? L.MECHANIC.hello : L.MECHANIC.clean), 2.8, L.MECHANIC.who); } },
            { t: 1.6, run: sp => {
                const D = ctx.feel && ctx.feel.damage, flat = !!(ctx.streets && ctx.streets.flat);
                let result = "clean";
                if ((D && D.k > 0) || flat) {
                    if (pay(L.MECHANIC.cost)) {
                        if (D && D.k > 0) D.repair("mechanic");
                        if (flat && ctx.streets.repairTyres) ctx.streets.repairTyres();
                        result = "fixed";
                        H.toast(`🔧 Mendel fixed it all · −${L.MECHANIC.cost} 💰`, "gold");
                        if (ctx.car && ctx.car.fx) for (let i = 0; i < 3; i++) ctx.car.fx.burst(ctx.car.pos.x, 0.8, ctx.car.pos.z, 6, 3, [1, 0.8, 0.3], 0.3, 0.4);
                        sayOver(hostObj("mechanic", sp), pick(L.MECHANIC.done), 2.4, L.MECHANIC.who);
                        stat("restRepairs");
                    } else { result = "broke"; H.toast(L.MECHANIC.broke, "red"); }
                }
                emit("exits:mechanic", { result });
            } },
            { t: 2.5, run: () => luluSays(pick(L.MECHANIC.reply)) },
        ],
    });
}
