// features/together — 🚗 IN THE SAME CAR: on foot by a friend's car (stopped or crawling), its PASSENGER door is a ✋
// spot — "🚗 HOP IN with Dina" — never their driver's door (that's theirs: no carjacking a friend). One hop (foot's
// hop-in beat, no cut) and she's riding with them (openworld/ride.js: the seat, the camera, everyone sees her in it).
// Her own car comes along on every ride — hop out and it's right there (parked by the door if the car was slow, or
// she's back in it alongside if it was moving), so it's never lost. One passenger a car: a taken seat says so.
// Friends only (party members in Free Roam); strangers' ghosts are never a car you can get into.
import { ctx, on } from "../../core/ctx.js";
import { roam, friends } from "./where.js";

const S = { near: null };
const CRAWL = 3;           // m/s: a car slower than this can be hopped into

/** Who rides in friend uid's passenger seat (a uid, mine included) — or null. */
function seatOf(uid) {
    const ow = ctx.openworld;
    if (ow && ow.riding === uid) return ctx.party.uid;
    for (const u of friends()) { const p = ctx.party.peer(u); if (p && p.x && p.x.rd === uid && ctx.party.fresh(p, 6000)) return u; }
    return null;
}
/** The passenger door of a friend's car as this screen draws it (their right side). */
function doorOf(rc) {
    const k = 1.45;
    return { x: rc.x - Math.cos(rc.h) * k, z: rc.z + Math.sin(rc.h) * k };
}
const spot = {
    r: 2.2, short: "HOP IN",
    pos() {
        S.near = null;
        if (!roam() || !ctx.foot || !ctx.foot.active || !ctx.foot.pos || ctx.state !== "footRun") return null;
        const g = ctx.openworld && ctx.openworld.game;
        if (g && g.ph === "go" && (g.ps || []).includes(ctx.party.uid)) return null;          // (mid-game: no rides)
        const f = ctx.foot.pos;
        let best = null, bd = 6;
        for (const uid of friends()) {
            const rc = ctx.party.remoteCar(uid), p = ctx.party.peer(uid);
            if (!rc || !rc.shown || rc.foot || !p || (p.x && (p.x.rd || p.x.v)) || Math.abs(rc.speed) > CRAWL) continue;
            const d = doorOf(rc), dist = Math.hypot(d.x - f.x, d.z - f.z);
            if (dist < bd) { bd = dist; best = { uid, rc, d }; }
        }
        S.near = best;
        return best ? best.d : null;
    },
    label() {
        const n = S.near;
        if (!n) return null;
        const taken = seatOf(n.uid);
        return taken ? `💺 SEAT'S TAKEN (${ctx.party.displayName(taken)})` : `🚗 HOP IN with ${ctx.party.displayName(n.uid)}`;
    },
    act() {
        const n = S.near;
        if (!n) return;
        if (seatOf(n.uid)) { if (ctx.foot.bubble && ctx.foot.obj) ctx.foot.bubble(ctx.foot.obj, "Next time — SHOTGUN! 🙋‍♀️", 1.8); return; }
        const { uid, rc } = n;
        ctx.foot.hopInto({ own: true, x: rc.x, z: rc.z, h: rc.h, seat: "passenger" }, {
            after() {
                const why = ctx.openworld.ride(uid);
                if (!why) return;
                // (it didn't take — they drove off / a game started): her own car pulls up beside theirs instead
                const c = ctx.car, h = c.h;
                c.place(c.pos.x - Math.cos(h) * 3.4, c.pos.z + Math.sin(h) * 3.4, h);
                c.vx = c.vz = 0; c.vF = 0; c.syncObject();
            },
        });
    },
};
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(spot); });
export const hopDebug = () => (S.near ? { uid: S.near.uid, x: S.near.d.x, z: S.near.d.z } : null);
