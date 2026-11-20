// features/partners — 🔗 CRIMES FOR TWO (ci/partners): small cartoon crimes that are funny with a friend, in a 🎉 party's
// 🌍 Free Roam / 🏡 Road Trip. Every one is OPT-IN by doing it (nobody is ever dragged in: each player does her own part on
// her own screen) and turns the two into PARTNERS (law/crew.js — `ctx.law.crew.partners`, each screen asking for itself):
// one wanted level, caught together → the same cell, court as co-defendants, a jailbreak for two.
//
//   🎲 DOUBLE DARE    both get a ⚠️ warning / a chase for the SAME thing (a stop sign, a speed trap…) within dareMs + dareR
//                     of each other → "DOUBLE DARE!" — PAY.dare.pot split between them (15 💰 each for two), ≤ 3 a real day
//   🚗 FLAG & GRAB    one ✋ FLAGS DOWN a car (the party's claim, 🚕 hail) and a friend JACKS it within grabMs → partners;
//                     the flagger can 🚗 HOP IN beside her (features/together) — PAY.grab.pot split, ≤ 2 a run each
//   🔔 RING & SNEAK   a friend is sneaking around inside a house; at its door the menu offers "🔔 Ring the bell — cover for
//                     <name>": everyone inside comes to the door for ringSec (their view cones off) on HER screen; she gets
//                     out unseen within ringMs → "CLEAN JOB" — PAY.ring.pot split, ≤ 2 a run each
//   🍌 GETAWAY PEELS  riding in a friend's car while the cops chase HER: 🍌 PEEL (the horn button) tosses a banana peel out of
//                     the window — the nearest cruiser behind spins out on the driver's screen; ≤ peelMax a ride; no coins
//
// Coins (AGENTS golden rule 5): a fixed POT per job SPLIT between the partners (never multiplied by the party), each share
// paid on its own player's screen into her own wallet, each capped (per run / per real day, on her own device) — so a
// friend can't pay you, a hacked page can only ever pay ITSELF its capped share, and nothing scales with how many join.
// On the wire: party broadcasts only (the existing relay protocol): pzd [charge, x10, z10] · pzf [key, x10, z10] ·
// pzg [key, flagger] · pzr [house key] · pzs [house key, ringer] · pzt [driver].
import { ctx, on, emit } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { store, saveSoon } from "../../core/save.js";
import { input, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";

const TM = ctx.TEST ? 3 : 1;
export const PAY = {
    dare: { pot: 30, perDay: 3, name: "🎲 DOUBLE DARE" },
    grab: { pot: 30, perRun: 2, name: "🚗 FLAG & GRAB" },
    ring: { pot: 20, perRun: 2, name: "🔔 RING & SNEAK" },
    peel: { pot: 0, perRide: 3, name: "🍌 GETAWAY PEELS" },
};
export const TUNE = { dareMs: 6000 * TM, dareR: 40, grabMs: 20000 * TM, grabR: 25, ringSec: 12, ringMs: 90000 * TM, peelMax: 3 };

const S = store("partners", { day: "", dare: 0, jobs: 0, coins: 0 });
const R = { grab: 0, ring: 0, peels: 0, rideWith: "", mine: [], theirs: [], flag: null, flags: new Map(), paid: new Set(), rung: null, rang: null };

const P = () => ctx.party;
const party = () => { const p = P(); return !!(p && p.active && p.activity && (p.activity.k === "roam" || p.activity.k === "trip")); };
const me = () => P().uid;
const now = () => P().clock();
const isFriend = uid => typeof uid === "string" && uid !== me() && P().members().includes(uid);
const nameOf = uid => { try { return P().displayName(uid); } catch (e) { return "your partner"; } };
function myPos() { const f = ctx.foot && ctx.foot.active && ctx.foot.pos; return f || (ctx.car && ctx.car.pos) || { x: 0, z: 0 }; }
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

/** My share of a job's pot (split between n partners), capped. → coins paid. */
function payShare(kind, n, withUid, extra = "") {
    const J = PAY[kind];
    let cut = J.pot > 0 ? Math.floor(J.pot / Math.max(2, n)) : 0;
    if (kind === "dare") { if (S.day !== today()) { S.day = today(); S.dare = 0; } if (S.dare >= J.perDay) cut = 0; else S.dare++; }
    if (kind === "grab") { if (R.grab >= J.perRun) cut = 0; else R.grab++; }
    if (kind === "ring") { if (R.ring >= J.perRun) cut = 0; else R.ring++; }
    if (cut > 0) { addCoins(cut, "partners:" + kind); S.coins += cut; }
    S.jobs++; saveSoon();
    H.toast(`🔗 ${J.name}${extra} — with ${nameOf(withUid)}${cut > 0 ? ` · +${cut} 💰 (your half)` : ""}`, "gold", { prio: 3, key: "partners" });
    emit("partners:job", { kind, with: withUid, coins: cut });
    emit("stat", { id: "partnerJobs", n: 1 });
    return cut;
}
/** A party broadcast is ephemeral (repeated ~1.5 s): on a slow phone it can miss — the ones that settle a job go out
 *  three times (now, +2 s, +5 s); every handler below ignores a repeat. */
function shout(k, ...a) {
    P().broadcast(k, ...a);
    for (const ms of [2000, 5000]) setTimeout(() => { try { if (party()) P().broadcast(k, ...a); } catch (e) { /* left */ } }, ms);
}
function partners(uid, why) { try { return ctx.law && ctx.law.crew ? ctx.law.crew.partners([me(), uid], why) : false; } catch (e) { return false; } }

// ── 🎲 DOUBLE DARE ───────────────────────────────────────────────────────
function myOffence(charge) {
    if (!party() || !charge) return;
    const p = myPos(), o = { charge: String(charge), t: now(), x: p.x, z: p.z };
    R.mine.push(o); if (R.mine.length > 6) R.mine.shift();
    P().broadcast("pzd", o.charge.slice(0, 40), Math.round(p.x * 10), Math.round(p.z * 10));
    for (const th of R.theirs) tryDare(o, th);
}
function tryDare(mine, th) {
    if (mine.charge !== th.charge || Math.abs(mine.t - th.t) > TUNE.dareMs || Math.hypot(mine.x - th.x, mine.z - th.z) > TUNE.dareR) return;
    const k = "d:" + th.uid + ":" + Math.floor(Math.min(mine.t, th.t) / (TUNE.dareMs * 2));
    if (R.paid.has(k)) return;
    R.paid.add(k);
    payShare("dare", 2, th.uid, ` (${mine.charge.toLowerCase()})`);
}
on("law:warning", e => myOffence(e && e.charge));
on("cop:chase", e => { if (e && e.active) myOffence(e.reason); });

// ── 🚗 FLAG & GRAB ───────────────────────────────────────────────────────
on("party:claim", e => {
    if (!party() || !e || !e.hail || !e.key) return;
    const p = myPos();
    R.flag = { key: String(e.key), t: now() };
    shout("pzf", R.flag.key, Math.round(p.x * 10), Math.round(p.z * 10));
});
on("streets:carjack", e => {
    if (!party() || !e || !e.key) return;
    const f = R.flags.get(String(e.key));
    const p = myPos();
    R.why = !f ? "no flag" : now() - f.t > TUNE.grabMs ? "late" : !isFriend(f.uid) ? "not a friend" : Math.hypot(f.x - p.x, f.z - p.z) > TUNE.grabR + 20 ? `far ${Math.round(Math.hypot(f.x - p.x, f.z - p.z))}` : "";
    if (R.why) return;
    R.flags.delete(String(e.key));
    partners(f.uid, "FLAG & GRAB");
    shout("pzg", String(e.key), f.uid);
    payShare("grab", 2, f.uid);
});

// ── 🔔 RING & SNEAK (homes' door menu calls ctx.partners.ring) ───────────
/** The friend sneaking around inside house `key` right now (her uid) — or null. */
function palInside(key) {
    for (const u of P().members()) {
        if (u === me()) continue;
        const p = P().peer(u), a = p && p.x && Array.isArray(p.x.in) ? p.x.in : null;
        if (a && a[0] === "home" && String(a[1] || "") === String(key) && P().fresh(p, 6000)) return u;
    }
    return null;
}
function ring(key) {
    if (!party()) return false;
    const pal = palInside(key);
    if (!pal) return false;
    R.rang = { key: String(key), uid: pal, t: now() };
    partners(pal, "RING & SNEAK");
    shout("pzr", String(key));
    emit("partners:ring", { key, pal });
    return true;
}

// ── 🍌 GETAWAY PEELS: the horn button while she rides in a chased friend's car ──
function driverChased(uid) { const p = uid && P().peer(uid), a = p && p.x && Array.isArray(p.x.pz) ? p.x.pz : null; return !!(a && (a[2] & 1)); }
function riding() { const ow = ctx.openworld; return ow && ow.riding ? ow.riding : ""; }
function peelOk() { const d = riding(); return party() && !!d && driverChased(d) && R.peels < TUNE.peelMax && ctx.state === "playing"; }
addTouchButton({ id: "pzPeel", emoji: "🍌", label: "PEEL", action: "honk", visible: () => peelOk() });
function peel() {
    const d = riding();
    if (!peelOk()) return false;
    R.peels++;
    partners(d, "GETAWAY");
    P().broadcast("pzt", d);
    H.toast(`🍌 Peel out the window! (${TUNE.peelMax - R.peels} left)`, "gold", { key: "partners" });
    emit("partners:peel", { driver: d, n: R.peels });
    emit("stat", { id: "partnerPeels", n: 1 });
    return true;
}

// ── everything friends broadcast ─────────────────────────────────────────
on("party:bc", ({ p, k, a }) => {
    if (!party() || !p || !isFriend(p.uid) || !/^pz[dfgrst]$/.test(k) || !Array.isArray(a)) return;
    const uid = p.uid;
    if (k === "pzd") {
        const th = { uid, charge: String(a[0] || "").slice(0, 40), t: now(), x: (a[1] | 0) / 10, z: (a[2] | 0) / 10 };
        if (!th.charge) return;
        R.theirs.push(th); if (R.theirs.length > 8) R.theirs.shift();
        for (const m of R.mine) tryDare(m, th);
    } else if (k === "pzf") {
        if (!R.flags.has(String(a[0]))) R.flags.set(String(a[0]), { uid, t: now(), x: (a[1] | 0) / 10, z: (a[2] | 0) / 10 });
        if (R.flags.size > 8) R.flags.delete(R.flags.keys().next().value);
    } else if (k === "pzg") {
        // a friend jacked the car I flagged down: we're in it together
        if (a[1] !== me() || !R.flag || R.flag.key !== String(a[0]) || now() - R.flag.t > TUNE.grabMs) return;
        R.flag = null;
        partners(uid, "FLAG & GRAB");
        payShare("grab", 2, uid);
    } else if (k === "pzr") {
        // a friend rang the bell of the house I'm sneaking around in: everyone goes to the door
        const h = ctx.homes && ctx.homes.house;
        if (!h || String(h.key) !== String(a[0]) || h.mode === "guest") return;
        if (R.rung && R.rung.key === String(a[0]) && R.rung.uid === uid && now() - R.rung.t < 8000 * TM) return;      // (a repeat)
        const n = ctx.homes.distract ? ctx.homes.distract(TUNE.ringSec, "🔔 Who's at the DOOR?!") : 0;
        R.rung = { key: String(a[0]), uid, t: now() };
        partners(uid, "RING & SNEAK");
        H.toast(`🔔 ${nameOf(uid)} rang the bell — everyone's at the door. GO!`, "pink", { prio: 3, key: "partners" });
        emit("partners:rung", { key: a[0], by: uid, n });
    } else if (k === "pzs") {
        // she got out clean after I rang for her
        if (a[1] !== me() || !R.rang || R.rang.key !== String(a[0]) || R.rang.uid !== uid || now() - R.rang.t > TUNE.ringMs) return;
        R.rang = null;
        payShare("ring", 2, uid, " · CLEAN JOB");
    } else if (k === "pzt") {
        // my passenger tossed a peel: the nearest cruiser behind me spins out
        if (a[0] !== me() || !ctx.law || !ctx.law.chasing) return;
        const ok = ctx.law.crew && ctx.law.crew.peel ? ctx.law.crew.peel() : false;
        if (ok) { partners(uid, "GETAWAY"); H.toast(`🍌 ${nameOf(uid)} peeled a cruiser!`, "gold", { key: "partners" }); }
        emit("partners:peeled", { by: uid, hit: !!ok });
    }
});
on("homes:exit", e => {
    const r = R.rung;
    if (!party() || !r || !e || String(e.key) !== r.key) return;
    R.rung = null;
    if (e.reported || e.spotted || now() - r.t > TUNE.ringMs || !isFriend(r.uid)) return;
    shout("pzs", r.key, r.uid);
    payShare("ring", 2, r.uid, " · CLEAN JOB");
});
on("run:start", () => { R.grab = 0; R.ring = 0; R.peels = 0; R.paid.clear(); });
on("state", ({ to }) => { if (to === "playing") { const d = riding(); if (d !== R.rideWith) { R.rideWith = d; R.peels = 0; } } });
// the horn while riding in a chased friend's car = a peel (her own car's horn isn't hers to honk from the passenger seat)
let lastHonk = false;
function frame() {
    requestAnimationFrame(frame);
    const h = !!(input.pressed && input.pressed.honk);
    if (h && !lastHonk && peelOk()) peel();
    lastHonk = h;
}
requestAnimationFrame(frame);

ctx.partners = {
    PAY, TUNE,
    /** homes' door menu: ring the bell of house `key` to cover for the friend sneaking around inside. → bool */
    ring: key => ring(key),
    /** The friend sneaking around in house `key` (uid) — or null (homes asks before offering the bell). */
    palInside: key => (party() ? palInside(key) : null),
    /** 🍌 toss a peel (riding in a chased friend's car). → bool */
    peel: () => peel(),
    get peelOk() { return peelOk(); },
    debug: { S, R, offence: c => myOffence(c), flag: key => { const p = myPos(); R.flag = { key, t: now() }; shout("pzf", key, Math.round(p.x * 10), Math.round(p.z * 10)); return true; },
        jack: key => { emit("streets:carjack", { key, kind: "sedan", x: myPos().x, z: myPos().z, witnessed: false }); return true; },
        resetCaps() { S.day = ""; S.dare = 0; R.grab = 0; R.ring = 0; R.peels = 0; R.paid.clear(); saveSoon(); return true; } },
};
