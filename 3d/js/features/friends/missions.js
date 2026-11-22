// features/friends — 👯 STAGE 2 step 3: MISSIONS TOGETHER — the API a feature uses so friends can join the thing she's
// doing (a side job, Ima's list, a road-trip leg, a crime for two, the bank job…). Each feature adopts it in its own
// branch; this file is only the plumbing, on the party's own channel (no new network):
//
//   ctx.group.invitable({
//       id: "hustle.delivery",            // unique, [a-z0-9._-]{1,32}
//       icon: "🔥", title: "Hot Delivery", blurb: "two drivers, one hot pizza",
//       max: 4,                            // most players (incl. the one who offers it), default 8
//       canStart() → "" | why not,         // on the OFFERER's screen (e.g. "Finish the job first")
//       start({ members, me, by, seed })   // runs on EVERY participant's screen at the same moment
//   })
//   ctx.group.offer(id) → "" | why        offer it (👯 › Missions, or the feature's own button)
//   ctx.group.joinOffer() / goNow() / callOffOffer() / offerNow()
//
// Rules (golden rule 5 — never multiplied by the group): rewards are the FEATURE's own rules — per player as solo, or a
// pot split / capped the way that feature says. Nobody is pulled in: an offer is ONE quiet chip for the others (the friends
// chip) + a ✅ row in 👯; whoever opts in within 30 s plays (the offerer can ▶ go now once one friend is in), everyone
// else carries on. Host-run: offers / opt-ins are reliable host events (gmp id · gmy n · gmg n · gmx n), the host publishes
// the open offer as its snapshot extra x.gm = [n, id, byUid, inUids, untilClock] and the start as a broadcast gms [n, id,
// inUids, seed, byUid] that every participant's client turns into def.start(...).
import { ctx, on, emit } from "../../core/ctx.js";

const LIFE = 30000, ID_RE = /^[a-z0-9._-]{1,32}$/;
const DEFS = new Map();
const P = () => ctx.party || null;
const roaming = () => !!(ctx.group && ctx.group.roaming);
const O = { n: 0, id: "", by: "", ins: [], until: 0 };        // the host's open offer
const started = new Set();                                   // offer numbers already started here

export function invitable(def) {
    if (!def || !ID_RE.test(def.id || "") || typeof def.start !== "function") return false;
    DEFS.set(def.id, Object.assign({ icon: "🤝", title: def.id, blurb: "", max: 8, canStart: () => "" }, def));
    emit("group:missions", {});
    return true;
}
export const list = () => [...DEFS.values()];

function publish() { const p = P(); if (p && p.setX) p.setX("gm", O.id ? [O.n, O.id, O.by, O.ins.slice(0, 8), Math.round(O.until)] : null); emit("group:offer", {}); }
function startNow() {
    const p = P();
    if (!O.id || !p) return;
    const n = O.n, id = O.id, ins = O.ins.slice(), seed = (Math.random() * 4294967295) >>> 0, by = O.by;
    O.id = ""; publish();
    if (ins.length < 2) return;                              // (nobody joined: it just closes)
    p.broadcast("gms", n, id, ins, seed, by);
    begin(n, id, ins, seed, by);
}
function onHost(uid, kind, a) {
    const p = P();
    if (!p || !p.isHost || !/^gm/.test(kind)) return;
    const t = p.clock();
    if (kind === "gmp") {
        if (!roaming() || typeof a[0] !== "string" || !ID_RE.test(a[0]) || (O.id && t < O.until)) return;
        Object.assign(O, { n: O.n + 1, id: a[0], by: uid, ins: [uid], until: t + LIFE });
        publish();
    } else if (kind === "gmy") {
        const def = DEFS.get(O.id);
        if (!O.id || a[0] !== O.n || t > O.until || O.ins.includes(uid)) return;
        if (def && O.ins.length >= def.max) return;
        O.ins.push(uid); publish();
        if (def && O.ins.length >= def.max) startNow();
    } else if (kind === "gmg") {
        if (O.id && a[0] === O.n && uid === O.by) startNow();
    } else if (kind === "gmx") {
        if (O.id && a[0] === O.n && uid === O.by) { O.id = ""; publish(); }
    }
}
function begin(n, id, ins, seed, by) {
    const p = P(), def = DEFS.get(id);
    if (!p || started.has(n + ":" + id)) return;
    started.add(n + ":" + id);
    if (!def || !ins.includes(p.uid)) return;                 // (not mine to play: carry on)
    try { def.start({ members: ins.slice(), me: p.uid, by, seed }); } catch (e) { console.error("[friends] mission start", id, e); }
    emit("group:missionStart", { id, members: ins.slice() });
}
let wired = false;
function wire() {
    const p = P();
    if (wired || !p || !p.onHostEvent) return;
    wired = true;
    p.onHostEvent(onHost);
}
wire(); on("boot", wire);
on("party:bc", ({ k, a, p: from }) => {
    if (k !== "gms" || !Array.isArray(a)) return;
    const p = P();
    if (!p || !from || from.uid !== p.host) return;           // (only the host starts a mission)
    const [n, id, ins, seed, by] = a;
    if (typeof n !== "number" || !ID_RE.test(String(id)) || !Array.isArray(ins)) return;
    const mem = ins.filter(u => typeof u === "string").slice(0, 8);
    begin(n, id, mem, seed >>> 0, typeof by === "string" && mem.includes(by) ? by : null);
});
on("party:status", e => { if (!(e && e.want)) { O.id = ""; started.clear(); } });
setInterval(() => {
    const p = P();
    if (!p || !p.active || !p.isHost || !O.id) return;
    if (!roaming()) { O.id = ""; publish(); return; }
    if (p.clock() > O.until) startNow();                      // the window closed: whoever's in, plays
}, 500);

/** The open offer, as everyone sees it: { n, id, def, by, ins, left, mine, iAmIn } | null */
export function offerNow() {
    const p = P();
    if (!p || !p.active || !roaming()) return null;
    let a = null;
    if (p.isHost) a = O.id ? [O.n, O.id, O.by, O.ins, O.until] : null;
    else { const h = p.peer(p.host); a = h && h.x && Array.isArray(h.x.gm) ? h.x.gm : null; }
    if (!a || !DEFS.has(a[1])) return null;
    const left = Math.max(0, Math.round((a[4] - p.clock()) / 1000));
    if (!left) return null;
    const ins = Array.isArray(a[3]) ? a[3] : [];
    return { n: a[0], id: a[1], def: DEFS.get(a[1]), by: a[2], ins, left, mine: a[2] === p.uid, iAmIn: ins.includes(p.uid) };
}
export function offer(id) {
    const p = P(), def = DEFS.get(id);
    if (!def) return "No such mission";
    if (!roaming()) return "Missions start when you're playing with friends";
    if (p.members().length < 2) return "Wait for a friend first 👯";
    if (offerNow()) return "Another one's open right now";
    const why = def.canStart ? def.canStart() : "";
    if (why) return why;
    p.sendEvent("gmp", id);
    return "";
}
export function joinOffer() { const o = offerNow(), p = P(); if (o && !o.iAmIn) p.sendEvent("gmy", o.n); return !!o; }
export function goNow() { const o = offerNow(), p = P(); if (o && o.mine && o.ins.length >= 2) p.sendEvent("gmg", o.n); return !!o; }
export function callOffOffer() { const o = offerNow(), p = P(); if (o && o.mine) p.sendEvent("gmx", o.n); return !!o; }
export function chipLine() {
    const o = offerNow(), p = P();
    if (!o || o.iAmIn) return "";
    const by = p.players.find(m => m.uid === o.by);
    return `${o.def.icon} ${by ? by.name : "A friend"}: ${o.def.title} — join? · 📱 👯`;
}
