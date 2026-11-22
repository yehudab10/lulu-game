// features/cityhall/inspect.js — 📋 THE INSPECTOR (stage 3). Inspector Pinchas is features/crime's character (the same name,
// look and memory — `ctx.crime.corruption.who("pinchas")`): if Internal Affairs reassigned him, it's Inspector Pnina (by
// the book) instead; if he's nervous of Lulu, he finds nothing and hurries off; if she's paid him before, he winks.
//   • AT HER HOMES: once a real day, walking within INSPECT_TUNE.near m of one of her homes in a town (solo), now and then
//     (always, when that home is waiting on a permit) he's on the front path with a clipboard: an absurd finding → ✋:
//     📄 show the permit (granted → he leaves, disappointed) · 🙄 write it up (a tiny finding fee on the ledger, within the
//     fee cap) · 🍩 a "donation" (INSPECT_TUNE.donation coins, only if she has them → no finding; `cityhall:corrupt`) ·
//     👋 walk away (nothing happens).
//   • AT THE SHOPS: once a run, walking past the pizza shop / makolet / bakery, he's inspecting it (bubbles only).
import { ctx, on, emit } from "../../core/ctx.js";
import { choose, say } from "../../core/dialog.js";
import { wallet } from "../../core/save.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { ID, INSPECTOR, FINDINGS, INSPECT_LINES as IL, SHOP_INSPECT, INSPECT_TUNE as K } from "./data.js";
import { S, saveSoon, inTown, townId, stat } from "./state.js";
import { charge } from "./fees.js";
import { hasPermit, openPermits } from "./permits.js";

if (!S.insp || typeof S.insp !== "object") S.insp = { day: "", n: 0, donations: 0 };
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
export const IN = { cur: null, shop: null, shopN: 0, shopNext: rand(K.shopGap[0], K.shopGap[1]), force: {}, log: [], t: 0 };
function log(ev, d = {}) { IN.log.push(Object.assign({ ev }, d)); if (IN.log.length > 40) IN.log.shift(); }
const realDay = () => { const d = IN.force.day || new Date(); return typeof d === "string" ? d : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
const solo = () => !(ctx.party && ctx.party.active);
const bubble = (obj, text, sec = 2.6) => { try { if (obj && ctx.foot && ctx.foot.say && !ctx.skipping) ctx.foot.say(obj, text, sec); } catch (e) { /* none */ } };

/** Who inspects today: "pinchas" | "pnina", and his mood with her (crime's memory). */
export function inspector() {
    let mood = "";
    try { mood = (ctx.crime && ctx.crime.corruption && ctx.crime.corruption.who("pinchas").mood) || ""; } catch (e) { mood = ""; }
    if (IN.force.mood != null) mood = IN.force.mood;
    return { id: mood === "gone" ? "pnina" : "pinchas", mood };
}
/** Her homes in the town she's in, with their door in world coords. */
function homesHere() {
    const R = ctx.realestate, T = ctx.town;
    if (!R || !R.owned || !T || !T.plan) return [];
    return R.owned().filter(h => h.town === townId() && !h.seized && !h.lost).map(h => {
        const [, lx, lz] = String(h.id).split(":").map(Number);
        const w = T.plan.world(lx, lz, {});
        return { id: h.id, address: h.address, x: w.x, z: w.z };
    }).filter(h => isFinite(h.x));
}
function spawn(who, x, z, faceX, faceZ) {
    const D = INSPECTOR[who];
    const rec = { who, p: null, x, z, faceX, faceZ };
    ensureModels([D.key, D.fallback]).then(() => {
        if (!rec.alive) return;
        const key = models[D.key] ? D.key : D.fallback;
        if (!models[key]) return;
        rec.p = spawnPerson(key, { colors: D.colors });
        rec.p.obj.position.set(x, 0, z);
        ctx.scene.add(rec.p.obj);
    }).catch(() => {});
    rec.alive = true;
    return rec;
}
function drop(rec) { if (!rec) return; rec.alive = false; if (rec.p && rec.p.obj.parent) rec.p.obj.parent.remove(rec.p.obj); if (rec.rm) rec.rm(); }

// ── at her homes ──
/** Start an inspection at one of her homes now (tests: force). → bool */
export function startInspection(home) {
    if (IN.cur || !home) return false;
    const road = ctx.world && ctx.world.road;
    const n = road ? road.nearest(home.x, home.z, undefined, {}) : null;
    let x = home.x, z = home.z;
    if (n && n.street) {
        // halfway down the front path, then 2.4 m to the side (clear of her mailbox + the path itself)
        const P = road.point(n.s, (Math.sign(n.d) || 1) * (n.street.curb + 1.4), {});
        const tx = P.x - home.x, tz = P.z - home.z, tl = Math.hypot(tx, tz) || 1;
        x = home.x + tx * 0.5 + (-tz / tl) * 2.4; z = home.z + tz * 0.5 + (tx / tl) * 2.4;
    }
    const I = inspector();
    const rec = IN.cur = spawn(I.id, x, z, home.x, home.z);
    Object.assign(rec, { home, mood: I.mood, t: 0, done: false, finding: pick(FINDINGS) });
    rec.rm = ctx.foot && ctx.foot.addSpot ? ctx.foot.addSpot(spot) : null;
    S.insp.day = realDay(); S.insp.n++; saveSoon();
    stat("cityhallInspections");
    emit("cityhall:inspect", { phase: "start", who: I.id, home: home.id });
    log("start", { who: I.id, home: home.id });
    return true;
}
const spot = {
    r: 2.4, short: "INSPECTOR",
    pos() { const c = IN.cur; return c && !c.done && onFoot() ? { x: c.x, z: c.z } : null; },
    label() { const c = IN.cur; return c ? `📋 ${INSPECTOR[c.who].name.toUpperCase()}` : null; },
    act() { talk(); },
};
async function talk() {
    const c = IN.cur;
    if (!c || c.done || ctx.dialogOpen) return;
    const D = INSPECTOR[c.who], o = { emoji: D.emoji, color: "#455A64" };
    c.busy = true;
    if (c.who === "pinchas" && c.mood === "nervous") { await say(D.name, IL.nervous, o); return finish(c, "nervous"); }
    if (c.who === "pinchas" && (c.mood === "bribed" || c.mood === "partner" || S.insp.donations > 0)) { await say(D.name, "Ah, my favourite citizen! Everything's perfect. As always. *wink*", o); return finish(c, "wink"); }
    await say(D.name, `${IL.hello} ${c.finding}`, o);
    if (IN.cur !== c) return;
    const opts = IL.opts.slice();
    const i = await choose(D.name, c.finding, opts, o);
    if (IN.cur !== c) return;
    if (i === 0) {
        if (hasPermit(c.home.id) || (!openPermits().some(p => p.home === c.home.id) && IN.force.permitOk)) { await say(D.name, pick(IL.permit), o); return finish(c, "permit"); }
        await say(D.name, IL.noPermit, o);
        charge("inspection");
        return finish(c, "written");
    }
    if (i === 1) { charge("inspection"); await say(D.name, IL.writeUp, o); return finish(c, "written"); }
    if (i === 2) {
        if (c.who === "pnina") { await say(D.name, IL.pnina, o); charge("inspection"); return finish(c, "written"); }
        if (wallet.coins < K.donation || !wallet.spend(K.donation)) { await say(D.name, IL.broke, o); charge("inspection"); return finish(c, "written"); }
        S.insp.donations = (S.insp.donations || 0) + 1; saveSoon();
        emit("cityhall:corrupt", { who: "pinchas", act: "donation", n: K.donation });
        stat("cityhallDonations");
        await say(D.name, pick(IL.donation), o);
        return finish(c, "donation");
    }
    bubble(c.p && c.p.obj, IL.walk, 2.4);
    return finish(c, "walk");
}
function finish(c, how) {
    c.done = true; c.busy = false; c.t = 0;
    if (c.rm) { c.rm(); c.rm = null; }
    emit("cityhall:inspect", { phase: "done", how, who: c.who, home: c.home.id });
    log("done", { how });
}
export function endInspection() { drop(IN.cur); IN.cur = null; }

// ── at the shops (bubbles only) ──
function shopTick(dt) {
    if (IN.shop) {
        const s = IN.shop; s.t += dt;
        if (s.p) { s.p.update(dt, { talk: s.t % 4 < 2, point: s.t % 4 >= 2 }); if (!s.said && s.t > 1.2) { s.said = true; bubble(s.p.obj, pick(SHOP_INSPECT[s.kind]), 3.2); } }
        const lp = herPos();
        if (s.t > 18 || !lp || Math.hypot(lp.x - s.x, lp.z - s.z) > 70) { drop(s); IN.shop = null; }
        return;
    }
    if (IN.shopN >= K.shopPerRun || !solo()) return;
    if ((IN.shopNext -= dt) > 0) return;
    const lp = herPos(), T = ctx.town;
    if (!lp || !T || !T.spot) return;
    for (const kind of Object.keys(SHOP_INSPECT)) {
        const sp = T.spot(kind);
        if (!sp || sp.x == null) continue;
        const d = Math.hypot(sp.x - lp.x, sp.z - lp.z);
        if (d < 40 && d > 10) {
            const I = inspector();
            if (I.mood === "nervous") return;
            IN.shop = spawn(I.id, sp.x + (sp.ux || 0) * 2.2, sp.z + (sp.uz || 0) * 2.2, sp.x, sp.z);
            Object.assign(IN.shop, { kind, t: 0, said: false });
            IN.shopN++;
            log("shop", { kind });
            return;
        }
    }
}

/** ~every frame from index.js. */
export function inspectTick(dt) {
    if (!inTown()) { if (IN.cur) endInspection(); if (IN.shop) { drop(IN.shop); IN.shop = null; } return; }
    if (ctx.state !== "footRun" || ctx.paused) return;
    const lp = herPos();
    const c = IN.cur;
    if (c) {
        c.t += dt;
        if (c.p) {
            const tx = c.done || !lp ? c.faceX : lp.x, tz = c.done || !lp ? c.faceZ : lp.z;
            c.p.face(tx, tz, dt, 6);
            c.p.update(dt, { talk: !c.done && lp && Math.hypot(lp.x - c.x, lp.z - c.z) < 6, point: !c.done && c.t % 5 > 3.5 });
        }
        const far = !lp || Math.hypot(lp.x - c.x, lp.z - c.z) > 60;
        if ((c.done && c.t > 6) || (far && c.t > 3)) endInspection();
        return;
    }
    if (ctx.enabled(ID) && solo()) shopTick(dt);
    if ((IN.t += dt) < 0.5) return;
    IN.t = 0;
    if (!lp || !solo() || !ctx.enabled(ID) || ctx.dialogOpen || S.insp.day === realDay()) return;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return;
    for (const h of homesHere()) {
        if (Math.hypot(h.x - lp.x, h.z - lp.z) > K.near) continue;
        const waiting = openPermits().some(p => p.home === h.id);
        S.insp.day = realDay(); saveSoon();            // (one roll a real day, whatever it rolls)
        if (IN.force.always || waiting || Math.random() < K.chance) startInspection(h);
        return;
    }
}
export function inspectReset() { endInspection(); if (IN.shop) { drop(IN.shop); IN.shop = null; } IN.shopN = 0; IN.shopNext = rand(K.shopGap[0], K.shopGap[1]); }
export { homesHere };
on("title", () => inspectReset());
