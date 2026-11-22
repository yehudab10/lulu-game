// features/friends — 👯 THE GROUP (ci/friends stage 2, step 1): "being with friends" is a GROUP you're in while you
// play, not a mode. Today the group IS the 🎉 party (`ctx.party`: the transport, the seeded shared world, the members)
// — this is the one switch every feature should read from now on instead of `ctx.party.active`, so the party can
// dissolve into the world later (forming by joining a friend, leaving with one tap, missions as invitations) without
// touching every feature again.
//   ctx.group.active     with friends right now (the party is on)
//   ctx.group.roaming    …and out in the open world together (🌍 Free Roam), not a lobby activity (race, road trip…)
//   ctx.group.members    [{ uid, name, me, friend }] — friend = on MY friends list (their x.fid)
//   ctx.group.size       how many, me included (0 when alone)
//   ctx.group.leave()    leave the group (today: the party; you keep your friends list)
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
    leave() { const p = P(); if (p && p.active) p.leave(); },
    invite() { const p = P(); return p && p.invite ? p.invite() : Promise.resolve(""); },
    isFriend(uid) { const f = fidOf(uid); return !!(f && friend(f)); },
};
ctx.group = group;
let was = false;
on("party:status", () => { const a = group.active; if (a !== was) { was = a; emit("group:status", { active: a }); } });
