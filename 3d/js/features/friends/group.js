// features/friends — 👯 THE GROUP (ci/friends stage 2, step 1): "being with friends" is a GROUP you're in while you
// play, not a mode. Today the group IS the 🎉 party (`ctx.party`: the transport, the seeded shared world, the members)
// — this is the one switch every feature should read from now on instead of `ctx.party.active`, so the party can
// dissolve into the world later (forming by joining a friend, leaving with one tap, missions as invitations) without
// touching every feature again.
//   ctx.group.active     with friends right now (the party is on)
//   ctx.group.roaming    …and out in the open world together (🌍 Free Roam), not a lobby activity (race, road trip…)
//   ctx.group.members    [{ uid, name, me, friend }] — friend = on MY friends list (their x.fid)
//   ctx.group.size       how many, me included (0 when alone)
//   ctx.group.leave()    leave the group with one tap and carry on alone: back home on foot (onegame's "everything
//                        ends back home"), not the title screen; your friends keep playing; the friends list stays
//   ctx.group.away       (step 2) a line when she's pulled into a town none of her friends are in — friends' ui shows
//                        it as ONE quiet chip ("leave the group?" — never automatic: the tap only opens 👯)
//   ctx.group.invite()   📤 share the link (→ a promise of the message)
//   ctx.group.isFriend(uid)
// Events: group:status { active } (on every party:status change).
import { ctx, on, emit } from "../../core/ctx.js";
import { friend } from "./store.js";

const P = () => ctx.party || null;
const fidOf = uid => { const p = P(), q = p && p.peer ? p.peer(uid) : null; return (q && q.x && q.x.fid) || null; };

export const group = {
    get active() { const p = P(); return !!(p && p.active); },
    get roaming() { const p = P(); return !!(p && p.active && ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns()); },
    get members() {
        const p = P();
        if (!p || !p.active) return [];
        return p.players.map(m => ({ uid: m.uid, name: m.name, me: !!m.me, friend: !m.me && !!(fidOf(m.uid) && friend(fidOf(m.uid))) }));
    },
    get size() { const p = P(); return p && p.active ? p.players.length : 0; },
    leave() {
        const p = P();
        if (!p || !p.active) return false;
        if (ctx.onegame && ctx.onegame.home) { p.leave(false); ctx.onegame.home({ via: "group" }); }
        else p.leave();
        emit("group:left", {});
        return true;
    },
    get away() { return awayLine(); },
    invite() { const p = P(); return p && p.invite ? p.invite() : Promise.resolve(""); },
    isFriend(uid) { const f = fidOf(uid); return !!(f && friend(f)); },
};
ctx.group = group;
// step 4: the lobby games as invitations (vote.js) — ctx.group.vote = { propose(k) → "" | why, yes(), callOff(), current(), LOBBY }
import * as VOTE from "./vote.js";
group.vote = { propose: k => VOTE.propose(k), yes: () => VOTE.voteYes(), callOff: () => VOTE.callOff(), current: () => VOTE.current(), LOBBY: VOTE.LOBBY };

// ── step 2: "your friends went another way" ───────────────────────────────
/** Pure: my town zone + where my friends are → the chip's line ("" = nothing to say). */
export function awayFrom(myZone, friends, townName = z => z) {
    if (!myZone || !friends || !friends.length) return "";
    if (friends.some(f => (f.zone || "") === myZone)) return "";
    const there = [...new Set(friends.map(f => f.zone || ""))];
    const where = there.length === 1 ? (there[0] ? `in ${townName(there[0])}` : "on the highway") : "elsewhere";
    return `🚪 Your friends are ${where} — leave the group? · 📱 👯`;
}
const AW = { zone: null, since: 0, shown: "", until: 0 };
function awayLine() {
    if (!group.roaming || !ctx.together || !ctx.together.locateAll || !ctx.openworld) return "";
    const z = ctx.openworld.zone || "", t = performance.now();
    if (z !== AW.zone) { AW.zone = z; AW.since = t; AW.until = 0; }
    if (!z || t - AW.since < 12000) return "";                 // (just pulled in: give them a moment to follow)
    const T = ctx.town && ctx.town.towns;
    const line = awayFrom(z, ctx.together.locateAll(), id => (T && T[id] && T[id].name) || id);
    if (!line) { AW.shown = ""; return ""; }
    if (AW.shown !== z) { AW.shown = z; AW.until = t + 9000; }  // once per town, ~9 s
    return t < AW.until ? line : "";
}
let was = false;
on("party:status", () => { const a = group.active; if (a !== was) { was = a; emit("group:status", { active: a }); } });
