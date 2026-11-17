// features/openworld — 🚗 RIDE ALONG: hop into a friend's passenger seat (a 🎉 Free Roam).
// The rider's own car vanishes and her camera rides the friend's car as THIS screen
// draws it (the party's interpolated remote car); she publishes `d.x.rd = <driver uid>`,
// so every screen hides her car and sits a Lulu in the driver's passenger seat instead
// (the driver's own car too). Cross a zone (the driver takes the exit) and she warps along.
// ✕ / E (or the 👯 app) hops out beside the car, rolling at its speed.
import { ctx, hook, emit } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { input, glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { tone } from "../parking/sfx.js";

export const RIDE = { uid: null, t: 0, seats: new Map(), lost: 0 };
let E = null;
export function initRide(engine) { E = engine; }

const roam = () => E && E.roam();
/** Am I riding with someone (their uid) — or null. */
export const riding = () => RIDE.uid;

export function startRide(uid) {
    if (!roam() || RIDE.uid || !uid || uid === E.me()) return "Can't hop in right now";
    if (ctx.foot && ctx.foot.active) return "Get back in a car first 🚗";
    const g = E.getG();
    if (g && g.ph === "go" && g.ps.includes(E.me())) return "Not in the middle of a game!";
    const p = ctx.party.peer(uid);
    if (!p || !ctx.party.fresh(p)) return "📶 Can't see them right now";
    if (E.zoneOfPeer(p) !== E.zone()) E.warpToFriend(uid);
    RIDE.uid = uid; RIDE.t = 0; RIDE.lost = 0;
    E.setRide(uid);
    H.banner(`<b>🚗 Riding with ${E.nameOf(uid)}</b><small>${glyph("interact")} hop out · honk to wave</small>`, 2600, { key: "ow", prio: 2 });
    tone(523, 0.1, "triangle", 0.14, 784);
    emit("stat", { id: "owRides", n: 1 });
    return "";
}
export function stopRide(quiet = false) {
    const uid = RIDE.uid;
    if (!uid) return false;
    RIDE.uid = null;
    E.setRide(null);
    H.prompt("");
    const car = ctx.car, rc = ctx.party && ctx.party.remoteCar(uid);
    car.obj.visible = true;
    if (rc && rc.shown) {
        // out on the passenger side, rolling at the car's speed
        const rx = -Math.cos(rc.h), rz = Math.sin(rc.h);
        car.place(rc.x - rx * 3.4, rc.z - rz * 3.4, rc.h);
        const n = ctx.world.road.nearest(car.pos.x, car.pos.z, car.s, {});
        car.s = n.s; car.d = n.d;
        car.vx = rc.vx; car.vz = rc.vz; car.vF = Math.max(0, rc.speed);
    }
    if (ctx.cam) ctx.cam.snap();
    if (ctx.party) ctx.party.respawned();
    if (!quiet) { H.toast(`👋 Thanks for the lift, ${E.nameOf(uid)}!`, "pink"); tone(784, 0.1, "triangle", 0.14, 523); rumble(0.2, 0.3, 120); }
    return true;
}

// the rider's car follows the driver's (after physics: hooks.update runs after the car step)
hook("update", (dt, P) => {
    if (!RIDE.uid) return;
    if (!roam() || !E.members().includes(RIDE.uid)) { stopRide(true); return; }
    const car = ctx.car, rc = ctx.party.remoteCar(RIDE.uid), p = ctx.party.peer(RIDE.uid);
    RIDE.t += dt;
    if (P.interact && RIDE.t > 0.6) { stopRide(); return; }
    H.prompt(`${glyph("interact")} 🚪 Hop out`);
    car.obj.visible = false;
    if (p && E.zoneOfPeer(p) !== E.zone()) {             // they took the exit: come along
        RIDE.lost += dt;
        if (RIDE.lost > 0.8) { RIDE.lost = 0; E.warpToFriend(RIDE.uid, true); }
        return;
    }
    if (!rc || !rc.shown) return;
    RIDE.lost = 0;
    car.pos.set(rc.x, 0, rc.z); car.h = rc.h;
    car.vx = rc.vx; car.vz = rc.vz; car.vF = rc.speed;
    const n = ctx.world.road.nearest(rc.x, rc.z, car.s, {});
    car.s = n.s; car.d = n.d;
    car.syncObject();
}, 25);
hook("controls", ctl => { if (RIDE.uid) { ctl.throttle = 0; ctl.brake = 0; ctl.steer = 0; ctl.handbrake = false; } });

// ── the passenger: a Lulu in the driver's passenger seat, on every screen ──
function seatFor(riderUid) {
    let s = RIDE.seats.get(riderUid);
    if (s) return s;
    if (!models.luluPerson) return null;
    const person = spawnPerson("luluPerson");
    person.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    person.obj.scale.setScalar(0.86);
    s = { person, host: null };
    RIDE.seats.set(riderUid, s);
    return s;
}
function anchorOf(root) { return findNodes(root, "Anchor_passenger")[0] || null; }
/** Per frame: who rides with whom (me included) → sit them in that car. */
export function tickSeats(dt) {
    const want = new Map();                             // rider → driver
    if (roam()) {
        for (const u of E.members()) {
            if (u === E.me()) { if (RIDE.uid) want.set(u, RIDE.uid); continue; }
            const p = ctx.party.peer(u), rd = p && p.x && p.x.rd;
            if (rd && E.members().includes(rd)) want.set(u, rd);
        }
    }
    for (const [rider, s] of RIDE.seats) if (!want.has(rider)) { s.person.obj.removeFromParent(); s.host = null; }
    for (const [rider, driver] of want) {
        let anchor = null;
        if (driver === E.me()) anchor = ctx.car.anchors && ctx.car.anchors.passenger;
        else {
            const rc = ctx.party.remoteCar(driver);
            if (rc && rc.shown) { if (rc.owAnchorFor !== rc.v.model) { rc.owAnchor = anchorOf(rc.v.model); rc.owAnchorFor = rc.v.model; } anchor = rc.owAnchor; }
        }
        const s = anchor && seatFor(rider);
        if (!s) continue;
        if (s.host !== anchor) { anchor.add(s.person.obj); s.person.obj.position.set(0, -0.33, 0.02); s.person.obj.rotation.set(0, 0, 0); s.host = anchor; }
        s.person.update(dt, { sit: true, wave: !!(ctx.party.peer(rider) && (ctx.party.peer(rider).f & 4)) || (rider === E.me() && input.honkHeld) });
    }
}
/** Hide a friend's own car while they ride with someone (show filter). */
export const ridingWith = p => (p && p.x && p.x.rd) || null;
