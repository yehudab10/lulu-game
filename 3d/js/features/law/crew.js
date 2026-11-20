// features/law — 🔗 PARTNERS IN CRIME: the law's party behaviour for friends who break the law TOGETHER.
//
// In a 🎉 party the law is personal (each friend's own cops, chase, arrest, cell and court). This layer joins two to
// four friends into a CREW when they're in it together, and from then on they share the trouble:
//
//   TOGETHER  (the host decides, from what each friend reports about HERSELF):
//             • both are seen breaking the law — a chase starts (car or on foot) — within CREW_TUNE.crimeMs of each
//               other and within CREW_TUNE.near metres, in the same zone (the highway / the same town), or
//             • every one of them asked for the same partnership (`ctx.law.crew.partners(uids, why)` — a crime for
//               two, ci/bankfriends' bank job) within optMs.
//             A crew is only ever adopted by a screen whose OWN player is in trouble (chasing) or asked for it: a
//             friend can never put me in a crew, raise my stars, or get me arrested. Strangers are never party members.
//   WANTED    one wanted level: each member's chase is raised to the crew's highest stars (never lowered); 🔗 on the
//             HUD with the partners' names. Losing them counts for the CREW: nobody's "LOST 'EM" lands while a partner
//             is still seen (her meter waits at the top), it lands for everyone once they're all out of sight.
//             SPLIT UP (more than splitD m apart for splitMs): the cops stay on ONE — whoever they can still see; if
//             they see both, the one with more stars; then whoever's driving; then the first to have been seen. The
//             other slips away (her chase ends: "they went after …") and the crew is over.
//   CAUGHT    caught together = taken into custody (cuffed: lawArrest / straight to booking) within bustMs of each
//             other in the same zone — or, once a partner's been caught, ✋ GIVE YOURSELF UP within giveR of her (on
//             foot), or stopping right beside her (≤ stopR, stopped stopSec) while her own chase is still on.
//             Caught together → the same precinct, the SAME CELL: each screen draws the partner(s) in the cell with
//             her name (sitting on the second bunk), their emotes (the cell card's 👋 🙌 🤦 💃), one court clock
//             (it waits for a partner who's on her way in), and the release WAITS at the door (≤ waitDoor) so they
//             walk out of the precinct / courthouse side by side (on the highway: side by side down the road).
//             Every coin, charge, bail, verdict stays each player's own, computed on her own screen from her own
//             save — exactly the solo rules.
//
// On the wire (existing relay protocol only — party snapshots + reliable host events + the host's activity state):
//   d.x.pz = [crew n, stars, flags, evade %, x×10, z×10]   my own status (~7 Hz while it changes)
//   events → host: pzc [x10, z10, zone] a chase began · pzp [why, …uids] I want this partnership · pzb [n, zone, s]
//            I'm in custody · pzx [n] I'm out of this crew
//   host state: activity.pz = { n, c: [{ n, ps, why, t, ph: wanted | done, b: {uid: [t, zone, s]}, b0, z, sR, fin,
//            caught, drop, end }] }
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { models, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { L, escape } from "./cops.js";
import { JUMPSUIT } from "./scene.js";
import * as UI from "./ui.js";
import { wallet } from "../../core/save.js";
import { chargeCoins } from "./rules.js";

const TM = ctx.TEST ? 3 : 1;          // (a crawling ?test page gets longer real-time windows)
export const CREW_TUNE = {
    crimeMs: 8000 * TM,      // two chases starting this close together in time…
    near: 45,                // …and this close (m), same zone = partners
    bustMs: 20000 * TM,      // caught within this of the first = caught together
    giveR: 35,               // ✋ GIVE YOURSELF UP: this close to where she was caught (m)
    stopR: 20, stopSec: 2.5, // stopping this close beside a caught partner, mid-chase, this long = caught too
    splitD: 150, splitMs: 5000 * TM,
    max: 4,
    optMs: 15000 * TM,       // partners(): everyone names the same set within this
    waitCell: 40,            // (game s) the cell's court clock waits this long for a partner on her way in
    waitDoor: 10,            // (game s) the release waits this long at the door for a partner
    escapedMs: 6000,         // a wanted crew nobody's chasing any more for this long is over
    keepMs: 20000,           // a finished crew stays in the host's list this long (late readers)
};
const F_CAR = 1, F_SEEN = 2, F_SEARCH = 4, F_FOOT = 8, F_CUSTODY = 16, F_CELL = 32, F_COURT = 64, F_EXIT = 128, F_DRIVE = 256, F_BREAK = 512, F_VOTE = 1024;
const CUSTODY = new Set(["lawArrest", "lawJail", "lawCourt", "lawExit", "placesArrive"]);
const FREE = new Set(["playing", "footRun"]);

const C = { pubT: 0, sent: "", chasing: false, adopted: 0, refused: new Set(), toldDrop: new Set(), opt: new Map(), busted: 0,
    give: null, giveFor: 0, stopT: 0, crimeAt: 0, host: { crimes: new Map(), opt: new Map(), splitT: new Map(), quietT: new Map(), outT: new Map(), tickT: 0 },
    cell: { mates: new Map(), allHere: false, waitT: 0, emote: null, seq: 50 }, door: { t: 0 } };

// ── small helpers ────────────────────────────────────────────────────────
const P = () => ctx.party;
/** A party where the law runs (🌍 Free Roam / 🏡 Road Trip — it stands down in races, dash, tag). */
export function crewParty() { const p = P(); return !!(p && p.active && p.activity && (p.activity.k === "roam" || p.activity.k === "trip")); }
const me = () => P().uid;
const now = () => P().clock();
const zone = () => (ctx.town && ctx.town.active ? ctx.town.id || "" : "");
const clone = o => JSON.parse(JSON.stringify(o));
const nameOf = uid => { try { return P().displayName(uid); } catch (e) { return "your partner"; } };
export const names = list => list.map(nameOf).join(" & ");
function myPos() { const f = ctx.foot && ctx.foot.active && ctx.foot.pos; return f || (ctx.car && ctx.car.pos) || { x: 0, z: 0 }; }
function chasingNow() { return !!L.chase || !!(ctx.foot && ctx.foot.active && ctx.foot.chasing); }
function crews() { const A = P() && P().activity; return (A && A.pz && Array.isArray(A.pz.c)) ? A.pz.c : []; }
/** The crew I'm in right now (host state), or null. */
export function myCrew() {
    if (!crewParty()) return null;
    const u = me();
    return crews().find(c => c.ph !== "done" && c.ps.includes(u) && C.adopted === c.n) || null;
}
/** A peer's published status: { n, heat, f, ev, x, z } | null (stale / not there). */
function statusOf(uid) {
    if (uid === me()) return mine();
    const p = P().peer(uid);
    const a = p && P().fresh(p, 6000) && p.x && Array.isArray(p.x.pz) ? p.x.pz : null;
    if (!a || a.length < 6 || !a.every(Number.isFinite)) return null;
    return { n: a[0] | 0, heat: Math.max(0, Math.min(5, a[1] | 0)), f: a[2] | 0, ev: Math.max(0, Math.min(100, a[3] | 0)) / 100, x: a[4] / 10, z: a[5] / 10,
        v: Math.max(0, Math.min(3, a[6] | 0)), bail: Math.max(0, Math.min(99999, a[7] | 0)), zone: typeof p.x.z === "string" ? p.x.z : "" };
}
function mine() {
    const ch = L.chase, st = ctx.state, foot = !!(ctx.foot && ctx.foot.active && ctx.foot.chasing);
    let f = 0;
    if (ch) { f |= F_CAR; if (ch.searching) f |= F_SEARCH; else f |= F_SEEN; }
    if (foot) f |= F_FOOT | F_SEEN;
    if (CUSTODY.has(st)) f |= F_CUSTODY;
    if (st === "lawJail" && C.inCell) f |= F_CELL;
    if (st === "lawCourt") f |= F_COURT;
    if (st === "lawExit") f |= F_EXIT;
    if (st === "playing") f |= F_DRIVE;
    if (st === "lawJail" && C.breakOn) f |= F_BREAK;
    if (st === "lawJail" && C.cell.vote) f |= F_VOTE;
    const p = myPos(), c = crews().find(k => k.ph !== "done" && k.ps.includes(me()) && C.adopted === k.n);
    return { n: c ? c.n : 0, heat: ch ? ch.heat | 0 : 0, f, ev: ch ? ch.evade : 0, x: p.x, z: p.z, v: C.verdict | 0, bail: (f & F_CELL) ? C.bail | 0 : 0, zone: zone() };
}
/** Partners still in the party (not me). */
function mates(c) { if (!c) return []; const mem = P().members(), u = me(); return c.ps.filter(x => x !== u && mem.includes(x)); }

// ── the host: who's in it together ───────────────────────────────────────
function hostSet(fn) {
    const A = P().activity;
    const pz = A && A.pz ? clone(A.pz) : { n: 0, c: [] };
    if (fn(pz) === false) return;
    P().setA(Object.assign({}, P().activity, { pz }));
}
const activeOf = (pz, uid) => pz.c.find(c => c.ph !== "done" && c.ps.includes(uid)) || null;
function newCrew(pz, ps, why) {
    pz.n = (pz.n | 0) + 1;
    const c = { n: pz.n, ps: ps.slice(0, CREW_TUNE.max), why: why || "", t: Math.round(now()), ph: "wanted", b: {}, b0: 0, z: null, sR: null, fin: false, caught: [], drop: "", end: 0 };
    pz.c.push(c);
    return c;
}
function hostEvent(uid, k, a) {
    if (!crewParty() || !P().isHost || !/^pz/.test(k)) return;
    const t = now(), mem = P().members(), HS = C.host;
    if (!mem.includes(uid)) return;
    if (k === "pzh" || k === "pzha") { hostHelp(uid, k, a); return; }
    if (k === "pzc") {
        // a chase began for uid at (x, z) in a zone: anyone else whose chase began close by, a moment ago?
        const cr = { t, x: (a[0] | 0) / 10, z: (a[1] | 0) / 10, zone: typeof a[2] === "string" ? a[2].slice(0, 24) : "" };
        if (!Number.isFinite(cr.x) || !Number.isFinite(cr.z)) return;
        HS.crimes.set(uid, cr);
        let other = null;
        for (const [u, o] of HS.crimes) {
            if (u === uid || !mem.includes(u) || t - o.t > CREW_TUNE.crimeMs || o.zone !== cr.zone) continue;
            if (Math.hypot(o.x - cr.x, o.z - cr.z) > CREW_TUNE.near) continue;
            other = u; break;
        }
        if (!other) return;
        hostSet(pz => {
            const ca = activeOf(pz, uid), cb = activeOf(pz, other);
            if (ca && cb) return false;                                    // (each already in one: leave it)
            if (!ca && !cb) { newCrew(pz, [other, uid], ""); return; }
            const c = ca || cb, add = ca ? other : uid;
            if (c.b0 || c.ps.length >= CREW_TUNE.max) return false;
            c.ps.push(add);
        });
        return;
    }
    if (k === "pzp") {
        // an explicit partnership: everyone named asks for the same set
        const why = typeof a[0] === "string" ? a[0].slice(0, 40) : "";
        const ps = [...new Set(a.slice(1).filter(x => typeof x === "string"))].sort();
        if (ps.length < 2 || ps.length > CREW_TUNE.max || !ps.includes(uid) || !ps.every(u => mem.includes(u))) return;
        const key = ps.join("|");
        HS.opt.set(uid, { key, t, why });
        if (!ps.every(u => { const o = HS.opt.get(u); return o && o.key === key && t - o.t <= CREW_TUNE.optMs; })) return;
        for (const u of ps) HS.opt.delete(u);
        hostSet(pz => {
            const live = ps.map(u => activeOf(pz, u)).filter(Boolean);
            if (live.length && live.every(c => c === live[0]) && ps.every(u => live[0].ps.includes(u))) return false;   // (already)
            for (const c of live) { c.ps = c.ps.filter(u => !ps.includes(u)); if (c.ps.length < 2 && !c.b0) { c.ph = "done"; c.end = Math.round(t); } }
            newCrew(pz, ps, why);
        });
        return;
    }
    if (k === "pzb") {
        // uid is in custody (crew n): caught together = within bustMs of the first, in the same zone
        const n = a[0] | 0, z = typeof a[1] === "string" ? a[1].slice(0, 24) : "", s = Number.isFinite(a[2]) ? +a[2] : null;
        hostSet(pz => {
            const c = pz.c.find(x => x.n === n);
            if (!c || c.ph === "done" || !c.ps.includes(uid) || c.b[uid] || c.fin) return false;
            c.b[uid] = [Math.round(t), z, s];
            if (!c.b0) { c.b0 = Math.round(t); c.z = z; c.sR = s != null ? Math.round(s + 200) : null; }
            c.caught = c.ps.filter(u => c.b[u] && c.b[u][0] - c.b0 <= CREW_TUNE.bustMs && c.b[u][1] === c.z);
        });
        return;
    }
    if (k === "pzx") {
        const n = a[0] | 0;
        hostSet(pz => {
            const c = pz.c.find(x => x.n === n);
            if (!c || c.ph === "done" || !c.ps.includes(uid)) return false;
            if (c.b[uid] && c.caught.includes(uid)) return false;          // (caught: she's in it till the cell's done)
            c.ps = c.ps.filter(u => u !== uid);
            if (c.ps.length < 2 && c.caught.length < 2) { c.ph = "done"; c.end = Math.round(t); }
        });
    }
}
/** The host's clock work (~5 Hz): leavers, the caught window, splitting up, a crew that got away, old records. */
function hostTick(dt) {
    const HS = C.host;
    HS.tickT -= dt;
    if (HS.tickT > 0 || !P().isHost) return;
    HS.tickT = 0.2;
    const pz0 = P().activity && P().activity.pz;
    if (!pz0 || (!pz0.c.length && !pz0.h)) return;
    const t = now(), mem = P().members();
    let changed = false;
    const pz = clone(pz0);
    if (pz.h) for (const k of Object.keys(pz.h)) if (t - pz.h[k].t > 40000 * TM) { delete pz.h[k]; changed = true; }
    pz.c = pz.c.filter(c => !(c.ph === "done" && t - c.end > CREW_TUNE.keepMs));
    if (pz.c.length !== pz0.c.length) changed = true;
    for (const c of pz.c) {
        if (c.ph === "done") continue;
        const end = why => { c.ph = "done"; c.end = Math.round(t); c.why2 = why; changed = true; };
        // someone left the party (closed the app): never trapped — the others carry on alone
        const left = c.ps.filter(u => !mem.includes(u));
        if (left.length) { c.ps = c.ps.filter(u => mem.includes(u)); c.caught = c.caught.filter(u => mem.includes(u)); changed = true; }
        if (c.ps.length < 2) { end("left"); continue; }
        if (c.b0) {
            if (!c.fin && t - c.b0 > CREW_TUNE.bustMs) { c.fin = true; changed = true; }
            // everyone caught is out again (or never got to the cell): the story's over
            const inside = c.caught.some(u => { const s = statusOf(u); return !s || (s.f & F_CUSTODY); });
            const k = "o" + c.n;
            if (c.fin && !inside) { HS.outT.set(k, (HS.outT.get(k) || 0) + 0.2); if (HS.outT.get(k) > 4) { HS.outT.delete(k); end("out"); } }
            else HS.outT.delete(k);
            if (c.fin && c.caught.length < 2 && !inside) end("alone");
            continue;
        }
        const st = c.ps.map(u => [u, statusOf(u)]).filter(([, s]) => s);
        // got away: nobody's chased for a while (a crew made for a crime for two lives at least 30 s: the job may come first)
        const qk = "q" + c.n;
        if (st.length && st.every(([, s]) => !(s.f & (F_CAR | F_FOOT | F_CUSTODY))) && (!c.why || t - c.t > 30000 * TM)) { HS.quietT.set(qk, (HS.quietT.get(qk) || 0) + 200); if (HS.quietT.get(qk) > CREW_TUNE.escapedMs) { HS.quietT.delete(qk); end("escaped"); continue; } }
        else HS.quietT.delete(qk);
        // split up: the cops pick one
        const chased = st.filter(([, s]) => s.f & (F_CAR | F_FOOT));
        let far = false;
        for (let i = 0; i < chased.length && !far; i++) for (let j = i + 1; j < chased.length; j++) if (Math.hypot(chased[i][1].x - chased[j][1].x, chased[i][1].z - chased[j][1].z) > CREW_TUNE.splitD) { far = true; break; }
        const sk = "s" + c.n;
        if (!far) { HS.splitT.delete(sk); continue; }
        HS.splitT.set(sk, (HS.splitT.get(sk) || 0) + 200);
        if (HS.splitT.get(sk) < CREW_TUNE.splitMs) continue;
        HS.splitT.delete(sk);
        const keep = pickKept(chased, c);
        c.keep = keep;
        c.drop = chased.map(([u]) => u).filter(u => u !== keep).join(",");
        end("split");
    }
    if (changed) P().setA(Object.assign({}, P().activity, { pz }));
}
/** Split up: who the cops stay on — the one they can SEE; both seen → more stars; then whoever's driving; then the order they joined. */
export function pickKept(list, c) {
    const rank = ([u, s]) => [s.f & F_SEEN ? 1 : 0, s.heat, s.f & F_DRIVE ? 1 : 0, -c.ps.indexOf(u)];
    let best = null, br = null;
    for (const e of list) {
        const r = rank(e);
        if (!br || r[0] > br[0] || (r[0] === br[0] && (r[1] > br[1] || (r[1] === br[1] && (r[2] > br[2] || (r[2] === br[2] && r[3] > br[3])))))) { best = e[0]; br = r; }
    }
    return best;
}
// (law loads before the party feature: listen once everything's booted)
on("boot", () => { if (ctx.party && ctx.party.onHostEvent) ctx.party.onHostEvent((uid, k, a) => { try { hostEvent(uid, k, a); } catch (e) { console.error("[law crew] host", e); } }); });

// ── me: per frame ────────────────────────────────────────────────────────
function tick(dt) {
    if (!crewParty()) {
        if (C.sent) { C.sent = ""; try { P() && P().setX && P().setX("pz", null); } catch (e) { /* gone */ } }
        if (C.give) { C.give(); C.give = null; }
        if (C.spring) { C.spring(); C.spring = null; }
        C.adopted = 0; C.chasing = false; C.busted = 0;
        return;
    }
    hostTick(dt);
    // a new trouble of my own: tell the host where (it pairs it with a friend's)
    const ch = chasingNow();
    if (ch && !C.chasing && FREE.has(ctx.state)) { const p = myPos(); P().sendEvent("pzc", Math.round(p.x * 10), Math.round(p.z * 10), zone()); C.crimeAt = now(); }
    C.chasing = ch;
    const u = me();
    // a crew with me in it: adopt it only if I'm really in trouble (or asked for it) — nobody else can put me in one
    for (const c of crews()) {
        if (c.ph === "done" || !c.ps.includes(u) || C.adopted === c.n || C.refused.has(c.n)) continue;
        const opted = C.opt.has(c.n) || [...C.opt.values()].some(o => o.key === [...c.ps].sort().join("|") && now() - o.t < CREW_TUNE.optMs * 2);
        if (chasingNow() || opted || CUSTODY.has(ctx.state)) {
            C.adopted = c.n; C.busted = 0;
            const m = mates(c);
            H.toast(`🔗 PARTNERS IN CRIME — you & ${names(m)}${c.why ? ` · ${c.why}` : ""}: one wanted level`, "gold", { prio: 3, key: "crew" });
            emit("law:crew", { n: c.n, ps: c.ps.slice(), why: c.why, mates: m });
            emit("stat", { id: "crewFormed", n: 1 });
        } else { C.refused.add(c.n); P().sendEvent("pzx", c.n); }
    }
    // the crew I adopted ended (or the host forgot it)
    const live = crews().find(c => c.n === C.adopted);
    if (C.adopted && (!live || live.ph === "done")) {
        if (live && live.why2 === "split" && String(live.drop || "").split(",").includes(u) && !C.toldDrop.has(live.n)) {
            C.toldDrop.add(live.n);
            if (L.chase) escape("split", `they went after ${nameOf(live.keep)} 🔗`);
            else if (ctx.foot && ctx.foot.chasing && ctx.foot.dropChase) ctx.foot.dropChase();
            emit("law:crewSplit", { n: live.n, kept: live.keep, me: false });
        } else if (live && live.why2 === "split" && live.keep === u) {
            H.toast(`🚨 You split up — the cops stuck with YOU. ${names(mates(live))} slipped away!`, "red", { prio: 3, key: "crew" });
            emit("law:crewSplit", { n: live.n, kept: u, me: true });
        }
        C.adopted = 0;
    }
    const c = myCrew();
    if (c && !c.b0) shareHeat(c);
    if (c) giveUp(c, dt); else if (C.give) { C.give(); C.give = null; }
    helpTick();
    springSpot();
    publish(dt);
}
/** One wanted level: my chase climbs to the crew's highest stars (never down; one star a second at most). */
function shareHeat(c) {
    if (!L.chase) return;
    let hi = 0;
    for (const u of mates(c)) { const s = statusOf(u); if (s && s.n === c.n && (s.f & F_CAR)) hi = Math.max(hi, s.heat); }
    if (hi > L.chase.heat && (C.heatAt || 0) + 1 <= ctx.time) { L.chase.heat = Math.min(5, L.chase.heat + 1); C.heatAt = ctx.time; L.chase.nextHeat = L.chase.seenT + 8; }
}
/** A partner's been caught: ✋ GIVE YOURSELF UP beside her (on foot), or stop beside her mid-chase = cuffed too. */
function giveUp(c, dt) {
    const u = me();
    const caughtMate = c.b0 && !c.fin && !c.b[u] ? mates(c).find(x => c.b[x]) : null;
    const s = caughtMate ? statusOf(caughtMate) : null;
    const p = myPos();
    const near = s ? Math.hypot(s.x - p.x, s.z - p.z) : 1e9;
    const free = FREE.has(ctx.state) && !ctx.paused;
    // on foot: the ✋ spot (urgent — it wins the button)
    if (caughtMate && free && ctx.foot && ctx.foot.active && near < CREW_TUNE.giveR) {
        if (!C.give || C.giveFor !== c.n) {
            if (C.give) C.give();
            C.giveFor = c.n;
            C.give = ctx.foot.addSpot({ first: true, r: CREW_TUNE.giveR, pos: () => myPos(), label: () => `🚔 GIVE YOURSELF UP with ${nameOf(caughtMate)}`, short: "GIVE UP", act: () => surrender(c) });
        }
    } else if (C.give) { C.give(); C.give = null; }
    // stopped right beside her while the cops are still on you: they cuff you both
    const sp = ctx.foot && ctx.foot.active ? (ctx.foot.vel ? Math.hypot(ctx.foot.vel.x, ctx.foot.vel.z) : 0) : (ctx.car ? ctx.car.speed : 0);
    if (caughtMate && free && chasingNow() && near < CREW_TUNE.stopR && sp < 1) C.stopT += dt; else C.stopT = 0;
    if (C.stopT > CREW_TUNE.stopSec) { C.stopT = 0; surrender(c, true); }
}
/** Into custody with the crew (she chose to, or stopped beside her caught partner with the cops on her). */
function surrender(c, stopped = false) {
    if (!c || !FREE.has(ctx.state)) return false;
    const charges = L.chase ? L.chase.charges.slice() : ["AIDING AND ABETTING"];
    if (!charges.includes("AIDING AND ABETTING")) charges.push("AIDING AND ABETTING");
    const mate = mates(c).find(x => c.b[x]);
    H.toast(stopped ? `🚔 You stopped right beside ${nameOf(mate)} — they cuff you both!` : `🔗 Ride or die — you give yourself up with ${nameOf(mate)}.`, "pink", { prio: 3, key: "crew" });
    emit("stat", { id: "crewSurrenders", n: 1 });
    if (C.give) { C.give(); C.give = null; }
    return ctx.law.arrest(charges, ctx.foot && ctx.foot.active ? { onFoot: true, x: ctx.foot.pos.x, z: ctx.foot.pos.z, h: ctx.foot.facing } : {});
}
function publish(dt) {
    C.pubT -= dt;
    if (C.pubT > 0) return;
    C.pubT = 0.14;
    const s = mine();
    const a = [s.n, s.heat, s.f, Math.round(s.ev * 100), Math.round(s.x * 10), Math.round(s.z * 10), s.v, s.bail];
    const key = s.n || s.f ? a.join(",") : "";
    if (key === C.sent) return;
    C.sent = key;
    P().setX("pz", key ? a : null);
}

// into custody: tell the host (the caught-together window)
on("state", ({ from, to, data }) => {
    if (!crewParty()) return;
    if (to === "lawJail" || to === "lawArrest") {
        const c = myCrew();
        if (c && !CUSTODY.has(from) && !(data && (data.resume || data.serve)) && C.busted !== c.n) {
            C.busted = c.n;
            P().sendEvent("pzb", c.n, zone(), ctx.car && Number.isFinite(ctx.car.s) ? Math.round(ctx.car.s) : 0);
            emit("law:crewCaught", { n: c.n });
        }
    }
    if (!CUSTODY.has(to)) { C.inCell = false; C.cell.allHere = false; C.cell.waitT = 0; C.door.t = 0; C.verdict = 0; C.bail = 0; C.cell.vote = ""; C.breakOn = false; }
    if (to !== "lawJail") C.inCell = false;
});
// (the verdict rides in my status: a co-defendant's courtroom says how it went for me — 1 dismissed · 2 fined · 3 jail)
on("law:verdict", e => { C.verdict = e && e.verdict === "dismissed" ? 1 : e && e.verdict === "fine" ? 2 : e && e.verdict === "jail" ? 3 : 0; });
on("party:status", e => { if (e && e.want === false) { C.adopted = 0; C.refused.clear(); C.opt.clear(); C.host.crimes.clear(); C.host.opt.clear(); } });

// ── the escape waits for the crew (cops.js updateChase asks) ──────────────
/** True while a partner is still SEEN (or close to it): my "LOST 'EM" waits for her. */
L.crewHold = () => {
    const c = myCrew();
    if (!c || c.b0) return false;
    for (const u of mates(c)) {
        const s = statusOf(u);
        if (!s || s.n !== c.n) continue;
        if (s.f & F_FOOT) return u;
        if ((s.f & F_CAR) && !((s.f & F_SEARCH) && s.ev >= 0.9)) return u;
    }
    return false;
};
/** The 🔗 line under the stars. */
L.crewHud = () => {
    const c = myCrew();
    if (!c) return null;
    const m = mates(c);
    if (!m.length) return null;
    const caught = c.b0 && !c.fin && !c.b[me()] ? m.find(x => c.b[x]) : null;
    if (caught) return { tag: `🔗 ${nameOf(caught)} GOT CAUGHT`, hint: ctx.foot && ctx.foot.active ? "✋ give yourself up beside her — or slip away" : "stop beside her = go in together · or drive on" };
    const hold = L.chase && L.chase.searching && L.chase.evade > 0.9 ? L.crewHold() : false;
    return { tag: `🔗 PARTNERS · ${names(m)}`, hint: hold ? `🔗 wait — they can still see ${nameOf(hold)}` : "" };
};

// ── the cell: the partner(s) on the second bunk, emotes, one court clock (law/jail.js calls these) ──
const _v = new THREE.Vector3();
/** The partners caught with me (still in the party), or []. */
export function cellMates() {
    const c = myCrew();
    if (!c || !c.b[me()] || !c.caught.includes(me())) return [];
    return mates(c).filter(u => c.caught.includes(u) || (!c.fin && !c.b[u]));
}
/** Is partner uid sitting in the cell right now (her screen says so)? */
function inCellNow(uid) { const s = statusOf(uid); return !!(s && (s.f & F_CELL)); }
/** For jail.js's cell: the court clock (waits for a partner on her way in), a line for the card. */
export function cellInfo(dt, bail = 0) {
    C.inCell = true;
    C.bail = bail | 0;
    const list = cellMates();
    if (!list.length) return null;
    const c = myCrew();
    const coming = list.filter(u => !inCellNow(u) && (c.b[u] ? statusOf(u) && (statusOf(u).f & F_CUSTODY) && !(statusOf(u).f & (F_COURT | F_EXIT)) : !c.fin));
    C.cell.waitT += dt;
    const waiting = coming.length > 0 && C.cell.waitT < CREW_TUNE.waitCell;
    let reset = false;
    if (!waiting && !C.cell.allHere) { C.cell.allHere = true; reset = list.some(inCellNow); }
    return { mates: list, here: list.filter(inCellNow), waiting, reset, line: waiting ? `🔗 ${names(coming)} is on the way in — court waits` : `🔗 Cellmates: you & ${names(list.filter(inCellNow).length ? list.filter(inCellNow) : list)}` };
}
/** Draw the partners in the cell set (jail.js's animate). */
export function cellTick(dt, J) {
    const want = new Set(C.inCell ? cellMates().filter(inCellNow) : []);
    for (const [uid, m] of C.cell.mates) if (!want.has(uid) || m.set !== J.set) { m.dispose(); C.cell.mates.delete(uid); }
    if (want.size && !models.luluPerson) { ensureModels(["luluPerson"]).catch(() => { }); return; }
    let i = 0;
    for (const uid of want) {
        let m = C.cell.mates.get(uid);
        if (!m) { m = new CellMate(uid, J.set); C.cell.mates.set(uid, m); X_in(uid); }
        m.update(dt, i++);
    }
    // my own gesture in the cell (the card's buttons): my Lulu does it; friends see it via d.x.e
    const E = C.cell.emote;
    if (E) {
        E.t += dt;
        if (E.t > E.dur) { C.cell.emote = null; P().setX("e", null); }
        else { J.me.update(0, Object.assign({ sit: true }, E.pose)); }
    }
}
function X_in(uid) { emit("law:crewCell", { uid }); }
const SEATS = [[-0.15, 0, -0.95, 0.3], [0.5, 0, 0.1, -0.4], [-0.6, 0, 0.3, 0.6]];
class CellMate {
    constructor(uid, set, seats = SEATS) {
        this.uid = uid; this.set = set; this.emKey = ""; this.em = null; this.seats = seats;
        const p = P().peer(uid) || {};
        const colors = Object.assign({}, JUMPSUIT, p.hc ? { Hair: p.hc } : {});
        this.person = spawnPerson("luluPerson", { colors });
        set.add(this.person.obj);
        const NT = P().visuals && P().visuals.NameTag;
        this.tag = NT ? new NT() : null;
        if (this.tag) { let hex = "#E91E63"; try { hex = P().skinHex(P().skinOf(uid)); } catch (e) { /* default */ } this.tag.set(nameOf(uid), hex, {}); set.add(this.tag.sp); }
        UI.bubble("crew:" + uid, this.person.obj, pickLine(), { who: nameOf(uid).toUpperCase(), y: 2.05, sec: 2.6 });
    }
    update(dt, i, talking = false) {
        const o = this.person.obj, S = this.seats[i % this.seats.length];
        o.position.set(S[0], S[1], S[2]); o.rotation.y = S[3];
        const p = P().peer(this.uid);
        const e = p && p.x && Array.isArray(p.x.e) ? p.x.e : null, ek = e ? (e[0] | 0) + ":" + (e[1] | 0) : "";
        if (ek && ek !== this.emKey) {
            this.emKey = ek;
            const E = EMOTE[e[0] | 0];
            if (E) { this.em = { E, t: 0 }; UI.bubble("crew:" + this.uid, o, E.say === E.e ? E.e : `${E.e} ${E.say}`, { who: nameOf(this.uid).toUpperCase(), y: 2.05, sec: 2.4 }); emit("party:emote", { uid: this.uid, i: e[0] | 0, id: E.id, me: false, cell: true }); }
        } else if (!ek) this.emKey = "";
        if (this.em) { this.em.t += dt; if (this.em.t > (this.em.E.dur || 2.6)) this.em = null; }
        this.person.update(dt, this.em ? Object.assign({}, this.em.E.pose) : { sit: false, talk: talking || Math.sin(ctx.time * 0.9 + i) > 0.9 });
        if (this.em && this.em.E.hop) o.position.y += Math.abs(Math.sin(this.em.t * 7)) * this.em.E.hop;
        if (this.tag) {
            this.tag.sp.position.set(o.position.x, 2.2, o.position.z);
            this.tag.sp.scale.set(this.tag.base * 0.5, this.tag.base * this.tag.aspect * 0.5, 1);
        }
    }
    dispose() { this.person.obj.removeFromParent(); if (this.tag) { this.tag.sp.removeFromParent(); this.tag.dispose(); } }
}
// (the party's 8 gestures — the same slots as party/emotes.js, so a friend's d.x.e reads the same everywhere)
const EMOTE = [
    { id: "hi", e: "👋", say: "Hi!", pose: { wave: true } }, { id: "follow", e: "👉", say: "Follow me!", pose: { point: true } },
    { id: "wait", e: "✋", say: "Wait up!", pose: { stop: true } }, { id: "cheer", e: "🙌", say: "Woohoo!", pose: { cheer: true }, hop: 0.16 },
    { id: "dance", e: "💃", say: "💃", pose: { dance: true }, dur: 4 }, { id: "facepalm", e: "🤦", say: "Oy vey!", pose: { facepalm: true } },
    { id: "mazel", e: "🥂", say: "Mazel tov!", pose: { cheer: true }, hop: 0.24 }, { id: "gg", e: "👏", say: "GG!", pose: { clap: true } },
];
/** The cell card's emote buttons: 👋 🙌 🤦 💃 (slots 0, 3, 5, 4). */
export const CELL_EMOTES = [0, 3, 5, 4];
export function cellEmote(i, J) {
    const E = EMOTE[i];
    if (!E || !crewParty()) return false;
    if (C.cell.emote && C.cell.emote.t < 0.9) return false;
    C.cell.seq = C.cell.seq >= 99 ? 50 : C.cell.seq + 1;
    C.cell.emote = { i, t: 0, dur: E.dur || 2.6, pose: E.pose };
    P().setX("e", [i, C.cell.seq]);
    if (J && J.me) UI.bubble("crew:me", J.me.obj, E.say === E.e ? E.e : `${E.e} ${E.say}`, { y: 2.0, sec: 2.2 });
    emit("party:emote", { uid: me(), i, id: E.id, me: true, cell: true });
    return true;
}
const LINES = ["Fancy meeting you here.", "This is all your fault.", "Same time next week?", "Nice jumpsuit. 🧡", "Don't tell Ima.", "We are SO grounded."];
function pickLine() { return LINES[Math.floor(Math.random() * LINES.length)]; }

// ── stage 2: the cell's choice (court together, or BREAK OUT together) ───
/** I want to break out with my cellmates (the cell card's 🏃): my vote. → "go" (everyone here voted) | "wait" | "" (no crew). */
export function voteBreak() {
    const here = cellMates().filter(inCellNow);
    if (!here.length) return "";
    if (!C.cell.vote) { C.cell.vote = "break"; emit("law:crewVote", { vote: "break" }); }
    return breakAgreed() ? "go" : "wait";
}
/** Everyone in the cell with me voted 🏃 (and I did). */
export function breakAgreed() {
    if (C.cell.vote !== "break") return false;
    const here = cellMates().filter(inCellNow);
    return here.length > 0 && here.every(u => { const s = statusOf(u); return !!(s && ((s.f & F_VOTE) || (s.f & F_BREAK))); });
}
/** Who in the cell is asking to break out (their vote's in, mine isn't) → names | "". */
export function breakAsk() {
    if (C.cell.vote) return "";
    const v = cellMates().filter(u => { const s = statusOf(u); return s && (s.f & F_CELL) && (s.f & F_VOTE); });
    return v.length ? names(v) : "";
}
/** The lock gets easier with a partner making a scene for the guard (each still picks her OWN lock, her own result). */
export function breakEase(lk) {
    const here = cellMates().filter(u => { const s = statusOf(u); return s && (s.f & (F_CELL | F_BREAK)); });
    if (!here.length) return "";
    lk.pins = Math.max(2, lk.pins - 1); lk.zoneW = Math.min(0.5, lk.zoneW + 0.08); lk.speed *= 0.9;
    return names(here);
}
export function setBreaking(on) { C.breakOn = !!on; }
/** A partner still picking / running (her jailbreak's not over yet) → names | "" — jail.js waits for her at the door. */
export function breakingMates() {
    const list = cellMates().filter(u => { const s = statusOf(u); return s && (s.f & F_BREAK) && (s.f & F_CUSTODY); });
    return list.length ? names(list) : "";
}
/** Partners who didn't make it out (back in the cell). */
export function leftInside() { return cellMates().filter(u => { const s = statusOf(u); return s && (s.f & F_CELL) && !(s.f & F_BREAK); }); }

// ── helping a friend who's inside: 💰 bail her out at the desk · 🔓 spring her from the door ──
// helper → host: pzh [target, "bail" | "spring", amount] · the target's screen (her consent / her own release) → host: pzha [id]
// host state: activity.pz.h = { [target]: { id, by, k, amt, t, ok } }. Coins: the HELPER pays from her own wallet, on her own
// screen, only once the target's screen says it took it (ok); the target never gets coins. Nothing is minted anywhere.
function hostHelp(uid, k, a) {
    const t = now();
    if (k === "pzh") {
        const target = typeof a[0] === "string" ? a[0] : "", kind = a[1] === "spring" ? "spring" : a[1] === "bail" ? "bail" : "";
        const amt = Math.max(0, Math.min(99999, a[2] | 0));
        const ts = statusOf(target);
        if (!kind || target === uid || !P().members().includes(target) || !ts || !(ts.f & F_CELL)) return;
        if (kind === "bail" && amt < ts.bail) return;
        hostSet(pz => { pz.hn = (pz.hn | 0) + 1; pz.h = pz.h || {}; pz.h[target] = { id: pz.hn, by: uid, k: kind, amt, t: Math.round(t), ok: 0 }; });
    } else if (k === "pzha") {
        const id = a[0] | 0;
        hostSet(pz => { const h = pz.h && pz.h[uid]; if (!h || h.id !== id || h.ok) return false; h.ok = 1; h.okT = Math.round(t); });
    }
}
function helpOf(target) { const A = P() && P().activity; return A && A.pz && A.pz.h ? A.pz.h[target] || null : null; }
/** Friends sitting in a cell in THIS town (a precinct I can walk into): [{ uid, name, bail, crew }]. */
export function friendsInside() {
    if (!crewParty()) return [];
    const out = [], c = myCrew(), z = zone();
    for (const u of P().members()) {
        if (u === me()) continue;
        const s = statusOf(u);
        if (!s || !(s.f & F_CELL) || s.zone !== z) continue;
        out.push({ uid: u, name: nameOf(u), bail: s.bail, crew: !!(c && c.caught.includes(u)) });
    }
    return out;
}
/** 💰 Bail friend uid out from MY wallet (interiors' precinct desk). → "" | why not */
export function bailOut(uid) {
    const f = friendsInside().find(x => x.uid === uid);
    if (!f) return "She's not in a cell here.";
    if (!f.bail) return "No bail set yet.";
    if (wallet.coins < f.bail) return `Bail's 💰${f.bail} — you're short.`;
    C.helpSent = { target: uid, k: "bail", amt: f.bail, at: now() };
    P().sendEvent("pzh", uid, "bail", f.bail);
    return "";
}
/** 🔓 Spring a partner from the precinct door. → "" | why not */
export function springOut(uid) {
    const f = friendsInside().find(x => x.uid === uid);
    if (!f) return "She's not in a cell here.";
    C.helpSent = { target: uid, k: "spring", amt: 0, at: now() };
    P().sendEvent("pzh", uid, "spring", 0);
    return "";
}
/** The cell side: a friend's help addressed to me that I haven't answered → { id, by, name, k, amt } | null. */
export function helpOffer() {
    const h = crewParty() ? helpOf(me()) : null;
    if (!h || h.ok || C.helpSeen === h.id || now() - h.t > 30000 * TM) return null;
    return { id: h.id, by: h.by, name: nameOf(h.by), k: h.k, amt: h.amt };
}
/** I took it (bail: I'm out · spring: I'm running). */
export function helpTaken(id) { C.helpSeen = id; P().sendEvent("pzha", id); }
/** Helper side, per frame: the target's screen took my help → pay / own up (once). */
function helpTick() {
    const hs = C.helpSent;
    if (!hs) return;
    const h = helpOf(hs.target);
    if (h && h.by === me() && h.ok && C.helpDone !== h.id) {
        C.helpDone = h.id; C.helpSent = null;
        const name = nameOf(hs.target);
        if (hs.k === "bail") {
            const paid = Math.min(hs.amt, HELP.wallet ? HELP.wallet.coins : hs.amt);
            if (HELP.charge) HELP.charge(paid);
            H.toast(`💰 You bailed out ${name} (−${paid}) — see her at the door!`, "gold", { prio: 3, key: "crew" });
            emit("law:crewBail", { uid: hs.target, paid });
            emit("stat", { id: "crewBails", n: 1 });
        } else {
            if (ctx.law && ctx.law.addWarrant) ctx.law.addWarrant(["AIDING AN ESCAPE"]);
            H.toast(`🔓 ${name} is OUT — run for it!`, "pink", { prio: 3, key: "crew" });
            emit("law:crewSpring", { uid: hs.target });
            emit("stat", { id: "crewSprings", n: 1 });
        }
    } else if (now() - hs.at > 30000 * TM) C.helpSent = null;
}
/** (jail.js hands its wallet hooks over: the helper's coins are charged by the law's own rules.) */
export const HELP = { wallet, charge: chargeCoins };
/** On foot at the precinct door, a partner still inside: ✋ 🔓 SPRING <name>. */
function springSpot() {
    const want = ctx.foot && ctx.foot.active && ctx.civic && ctx.civic.spot && ctx.town && ctx.town.active && FREE.has(ctx.state);
    const f = want ? friendsInside().find(x => x.crew) : null;
    if (f && !C.spring) {
        C.spring = ctx.foot.addSpot({ r: 2.6, pos: () => { const sp = ctx.civic.spot("precinct"); return sp ? { x: sp.x - sp.nx * 1.2, z: sp.z - sp.nz * 1.2 } : null; },
            label: () => { const g = friendsInside().find(x => x.crew); return g ? `🔓 SPRING ${g.name}` : ""; }, short: "SPRING",
            act: () => { const g = friendsInside().find(x => x.crew); if (g) { const why = springOut(g.uid); H.toast(why || `🔓 You rattle the back door — ${g.name}, GO!`, why ? "red" : "pink", { key: "crew" }); } } });
    } else if (!f && C.spring) { C.spring(); C.spring = null; }
}

// ── the courtroom: co-defendants (court.js calls these) ───────────────────
/** Partners caught with me who are in court right now (her screen says so). */
export function courtMates() { return cellMates().filter(u => { const s = statusOf(u); return s && (s.f & F_COURT); }); }
/** A partner's verdict, once her court's had it ("" until then). */
export function mateVerdict(uid) { const s = statusOf(uid); const v = s ? s.v : 0; return v === 1 ? "CASE DISMISSED" : v === 2 ? "FINED" : v === 3 ? "GUILTY — the clink" : ""; }
export const nameOfMate = uid => nameOf(uid);
const COURT_SEATS = [[-4.45, 0, -0.35, Math.PI], [-4.45, 0, 0.75, Math.PI], [-5.4, 0, -0.35, Math.PI]];
/** Draw the co-defendants beside her (court.js's animate). */
export function courtTick(dt, set, talk) {
    const want = new Set(courtMates());
    const M = C.court || (C.court = new Map());
    for (const [uid, m] of M) if (!want.has(uid) || m.set !== set) { m.dispose(); M.delete(uid); }
    if (want.size && !models.luluPerson) { ensureModels(["luluPerson"]).catch(() => { }); return; }
    let i = 0;
    for (const uid of want) {
        let m = M.get(uid);
        if (!m) { m = new CellMate(uid, set, COURT_SEATS); M.set(uid, m); }
        m.update(dt, i++, talk === uid);
    }
}
export function courtClear() { if (C.court) { for (const m of C.court.values()) m.dispose(); C.court.clear(); } }
export function mateBubble(uid, text) { const M = C.court; const m = M && M.get(uid); if (m) UI.bubble("crew:" + uid, m.person.obj, text, { who: nameOf(uid).toUpperCase(), y: 2.05, sec: 2.8 }); }

// ── out of the door together (jail.js's lawExit asks) ────────────────────
/** While a partner caught with me is still inside (not yet walking out): wait at the door, ≤ waitDoor game s. → her name | "" */
export function doorWait(dt) {
    const list = cellMates();
    if (!list.length) return "";
    C.door.t += dt;
    if (C.door.t > CREW_TUNE.waitDoor) return "";
    const c = myCrew();
    const inside = list.filter(u => c.b[u] && (() => { const s = statusOf(u); return s && (s.f & F_CUSTODY) && !(s.f & F_EXIT); })());
    return inside.length ? names(inside) : "";
}
/** Where I stand on the way out: the partners side by side (0, +1.6 m, −1.6 m…). */
export function doorSide() {
    const c = myCrew();
    if (!c || !c.caught.includes(me()) || c.caught.length < 2) return 0;
    const i = c.caught.indexOf(me());
    return i === 0 ? 0 : (i % 2 ? 1.6 : -1.6) * Math.ceil(i / 2);
}
/** On the highway (no town took us): the crew comes back to the road at one spot, a car length or two apart. */
export function crewResume(s) {
    const c = myCrew();
    if (!c || !c.caught.includes(me()) || c.caught.length < 2 || !Number.isFinite(c.sR)) return s;
    return c.sR + c.caught.indexOf(me()) * 14;
}

// ── the service (ctx.law.crew) ───────────────────────────────────────────
export const crewApi = {
    /** The crew I'm in: { n, mates: [uid], why, caught: [uid], phase: wanted | caught } | null. */
    current() { const c = myCrew(); return c ? { n: c.n, mates: mates(c), why: c.why, caught: c.caught.slice(), phase: c.b0 ? "caught" : "wanted", fin: !!c.fin } : null; },
    /** "These players are partners for this crime": call it on EACH player's screen (her own consent) with the same
     *  list (uids, me included) — the host makes them a crew once everyone has asked. why = the crime's name. */
    partners(uids, why = "") {
        if (!crewParty() || !Array.isArray(uids)) return false;
        const ps = [...new Set(uids)].filter(x => typeof x === "string");
        if (!ps.includes(me()) || ps.length < 2) return false;
        C.opt.set("p" + Math.round(now()), { key: [...ps].sort().join("|"), t: now() });
        P().sendEvent("pzp", String(why || ""), ...ps);
        return true;
    },
    /** "The crew is wanted at level N for reason R" — call it on each member's own screen: her own chase starts (or
     *  climbs) to N stars; the crew's shared level does the rest. */
    wanted(n = 2, reason = "") {
        const c = myCrew();
        if (!c) return false;
        if (L.chase) { L.chase.heat = Math.max(L.chase.heat, Math.min(5, n | 0)); if (reason && !L.chase.charges.includes(reason)) L.chase.charges.push(reason); return true; }
        return ctx.law.startChase(reason || "AIDING AND ABETTING", { heat: Math.min(5, n | 0), msg: "🚨 WANTED — THE WHOLE CREW!" });
    },
    /** Bust the crew (every member's own screen arrests her — call it on each) or just this member: her arrest goes
     *  into the shared flow (the same precinct, the same cell). → bool */
    bust(charges = []) {
        const c = myCrew();
        if (!c || !FREE.has(ctx.state)) return false;
        return ctx.law.arrest(charges && charges.length ? charges : [c.why || "CONSPIRACY"], ctx.foot && ctx.foot.active ? { onFoot: true, x: ctx.foot.pos.x, z: ctx.foot.pos.z, h: ctx.foot.facing } : {});
    },
    /** 🍌 A peel from my passenger (features/partners): the nearest cruiser chasing me spins out. → bool */
    peel() {
        if (!L.chase || !ctx.car) return false;
        const p = ctx.car.pos;
        let best = null, bd = 60;
        for (const u of L.units) { const c = u.car; if (!c || u.mode !== "chase" || c.hit) continue; const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
        if (!best) return false;
        best.hit = true; best.spinV = (Math.random() < 0.5 ? -1 : 1) * 7; best.hitT = -2.5;
        emit("stat", { id: "crewPeelHits", n: 1 });
        return true;
    },
    /** I'm out of this crew (it ends for me; a caught member stays till the cell's done). */
    leave() { const c = myCrew(); if (!c) return false; P().sendEvent("pzx", c.n); C.refused.add(c.n); C.adopted = 0; return true; },
    /** Friends in a cell in this town (the precinct desk offers to bail them out): [{ uid, name, bail, crew }]. */
    friendsInside: () => friendsInside(),
    /** 💰 Bail friend uid out from MY OWN wallet (paid only once her screen takes it). → "" | why not */
    bailOut: uid => bailOut(uid),
    /** 🔓 Spring a partner (caught with me) from the precinct door. → "" | why not */
    springOut: uid => springOut(uid),
    tune: CREW_TUNE,
    debug: { C, hostEvent: (uid, k, a) => hostEvent(uid, k, a), crews: () => clone(crews()), status: uid => statusOf(uid || me()), cell: () => [...C.cell.mates.keys()], court: () => (C.court ? [...C.court.keys()] : []), hold: () => L.crewHold(), hud: () => L.crewHud(), giveSpot: () => !!C.give, pickKept },
};

// its own rAF (the status rides over driving, walking and the law's scenes alike; nothing runs outside a party)
let lastW = 0;
function frame() {
    requestAnimationFrame(frame);
    const w = performance.now(), dt = lastW ? Math.min(0.1, (w - lastW) / 1000) : 1 / 60;
    lastW = w;
    try { tick(dt); } catch (e) { console.error("[law crew]", e); }
}
requestAnimationFrame(frame);
