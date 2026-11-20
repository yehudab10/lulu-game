// features/together — WHERE IS EACH FRIEND, as THIS screen can best tell (the friend finder's one source of truth).
//
// locate(uid) → { uid, name, hex, kind, x, z, dist, label, zone, foot } | null
//   kind "here"   they're drawn on my screen (same street / highway): their car or their walking Lulu
//        "door"   they're inside somewhere in my zone: the door they went in (d.x.at, else their parked car d.x.pc)
//        "track"  same zone, not drawn right now (a lagging stream): their last pose
//        "exit"   they're in another zone: the waypoint is the way there — on the highway the exit into their
//                 town (their d.x.ex), in a town the ramp back to the highway
// Strangers (the EVERYONE room's ghosts) are never here: only party members.
// Nothing here sends anything — it reads what the party already publishes (d.w / the flat frame, d.x.z, d.x.ex,
// d.x.at, d.x.pc, d.x.pr) plus `d.x.in` (features/together's own: a friend inside a shared room).
import { ctx } from "../../core/ctx.js";

const OFF = 20000;                         // openworld's flat frame (a town's pose: s = z + OFF, d = −x)
const _p = {};

export const roam = () => !!(ctx.party && ctx.party.active && ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
export const myZone = () => (ctx.town && ctx.town.active ? ctx.town.id || "" : "");
export const zoneOf = p => (p && p.x && typeof p.x.z === "string" ? p.x.z : "");
export function myPos() {
    const f = ctx.foot && ctx.foot.active && ctx.foot.pos;
    return f || (ctx.car && ctx.car.pos) || { x: 0, z: 0 };
}
export function townName(id) { const T = ctx.town && ctx.town.towns; return (T && T[id] && T[id].name) || (id ? id[0].toUpperCase() + id.slice(1) : "town"); }
export function friendHex(uid) { try { return ctx.party.skinHex(ctx.party.skinOf(uid)); } catch (e) { return "#E91E63"; } }
export const friends = () => (ctx.party && ctx.party.active ? ctx.party.members().filter(u => u !== ctx.party.uid) : []);

/** A town's local point → world (an attached town is turned to its interchange: ci/oneworld's plan.world). */
export function toW(plan, lx, lz) { return plan.world ? plan.world(lx, lz, {}) : { x: plan.ORIGIN.x + lx, z: plan.ORIGIN.z + lz }; }
/** …and back. */
export function toL(plan, x, z) {
    const dx = x - plan.ORIGIN.x, dz = z - plan.ORIGIN.z, co = plan.COS == null ? 1 : plan.COS, si = plan.SIN || 0;
    return { x: dx * co - dz * si, z: dx * si + dz * co };
}
/** The ramps out of the town I'm in (world points a little inside each ramp mouth). */
export function townExits() {
    const T = ctx.town, plan = T && T.active && T.plan;
    if (!plan || !plan.def || !plan.def.exits) return [];
    const out = [];
    for (const e of plan.def.exits) {
        const st = plan.byName[e.street];
        if (!st || (st.axis !== "ns" && st.axis !== "ew")) continue;
        const along = e.at + e.dir * -10, d = e.dir * 1.75;
        const x = st.axis === "ns" ? st.c - d : along, z = st.axis === "ns" ? along : st.c + d;
        const w = toW(plan, x, z);
        out.push({ x: w.x, z: w.z, name: e.name || e.street });
    }
    return out;
}

/** What a friend is doing, in a few words ("" while just driving). */
function doing(uid) {
    const pr = ctx.party && ctx.party.presenceOf ? ctx.party.presenceOf(uid) : null;
    if (!pr || !pr.label || (pr.mode === "drive" && pr.icon === "🚗")) return "";
    return pr.label;
}

/** Where friend uid is, from here. */
export function locate(uid) {
    if (!ctx.party || !ctx.party.active || !ctx.car) return null;
    const p = ctx.party.peer(uid);
    if (!p || !ctx.party.fresh(p, 12000)) return null;
    const x = p.x || {}, me = myPos(), Z = myZone(), pz = zoneOf(p);
    const name = ctx.party.displayName(uid), hex = friendHex(uid);
    const out = { uid, name, hex, kind: "", x: 0, z: 0, dist: 0, label: "", zone: pz, foot: Array.isArray(x.f), inside: false };
    const what = doing(uid);
    const done = (kind, px, pz2, label) => { out.kind = kind; out.x = px; out.z = pz2; out.dist = Math.hypot(px - me.x, pz2 - me.z); out.label = label; return out; };
    if (pz === Z) {
        // inside somewhere in my zone: the door
        if (p.m === 7) {
            out.inside = true;
            const at = Array.isArray(x.dr) ? x.dr : Array.isArray(x.at) ? x.at : Array.isArray(x.pc) ? x.pc : null;
            if (at) return done("door", at[0] / 10, at[1] / 10, what || "inside");
        }
        const rc = ctx.party.remoteCar(uid);
        if (rc && rc.shown) return done("here", rc.x, rc.z, what);
        const sm = p.samples && p.samples.length ? p.samples[p.samples.length - 1] : null;
        if (sm && p.m >= 2 && p.m <= 4) {
            if (pz) return done("track", -sm.d, sm.s - OFF, what);
            const road = ctx.world && ctx.world.road;
            if (road) { road.point(sm.s, sm.d, _p); return done("track", _p.x, _p.z, what); }
        }
        return null;
    }
    // another zone: the way there
    const where = pz ? `in ${townName(pz)}` : "on the highway";
    if (!Z) {
        // I'm on the highway, they're in a town: their exit
        const road = ctx.world && ctx.world.road, ex = +x.ex || 0;
        let s = ex > 0 ? ex : 0;
        if (!s && ctx.town && ctx.town.exits) { const e = ctx.town.exits.filter(e => e.town === pz).sort((a, b) => Math.abs(a.s - ctx.car.s) - Math.abs(b.s - ctx.car.s))[0]; if (e) s = e.s; }
        if (!road || !s) return null;
        road.point(s, 7, _p);
        return done("exit", _p.x, _p.z, `${where} · take the ${townName(pz)} exit`);
    }
    // I'm in a town, they're elsewhere: the nearest way out
    const exits = townExits();
    let best = null, bd = 1e9;
    for (const e of exits) { const d = Math.hypot(e.x - me.x, e.z - me.z); if (d < bd) { bd = d; best = e; } }
    if (!best) return null;
    return done("exit", best.x, best.z, `${where} · head out of town`);
}

/** Every friend, nearest first (only the ones this screen can place). */
export function locateAll() {
    const out = [];
    const me = ctx.party && ctx.party.uid, riding = ctx.openworld && ctx.openworld.riding;
    for (const u of friends()) {
        const p = ctx.party.peer(u);
        if (u === riding || (p && p.x && p.x.rd && p.x.rd === me)) continue;      // (in the same car as me: nothing to find)
        const l = locate(u); if (l) out.push(l);
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
}
export const fmtDist = m => (m >= 1000 ? `${(m / 1609).toFixed(1)} mi` : `${Math.max(5, Math.round(m / 5) * 5)} m`);
