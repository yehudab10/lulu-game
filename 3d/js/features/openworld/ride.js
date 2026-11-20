// features/openworld — 🚗 RIDE ALONG: hop into a friend's passenger seat (a 🎉 Free Roam).
// The rider's own car vanishes and her camera rides the friend's car as THIS screen
// draws it (the party's interpolated remote car); she publishes `d.x.rd = <driver uid>`,
// so every screen hides her car and sits a Lulu in the driver's passenger seat instead
// (the driver's own car too). Cross a zone (the driver takes the exit) and she warps along.
// ✕ / E (or the 👯 app) hops out: slow → on her feet at the passenger door (her own car parked right there —
// it comes along on every ride, so it's never lost); moving → into her own car alongside, rolling at its speed.
// On foot a friend's passenger door is a ✋ HOP IN spot (features/together/car.js). One passenger a car: first come,
// first served. Fair by design: the driver can't keep her in (✋ always works, and a driver who parks and walks off
// lets her out); she can't steer, brake or honk for them (her honk = a wave); she's never ticketed or chased for the
// driver's driving (law holds while she rides). Strangers never: only party members (Free Roam, not mid-game).
import { ctx, hook, emit, on } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { input, glyph, rumble, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";
import { tone } from "../parking/sfx.js";

export const RIDE = { uid: null, t: 0, seats: new Map(), lost: 0, hidden: null };
/** The rider's own car out of sight (its children: core rewrites car.obj.visible every frame for the i-frame blink). */
function hideCar(on) {
    const o = ctx.car.obj;
    if (on && !RIDE.hidden) { RIDE.hidden = o.children.filter(c => c.visible); for (const c of RIDE.hidden) c.visible = false; }
    else if (on) { for (const c of RIDE.hidden) c.visible = false; }
    else if (RIDE.hidden) { for (const c of RIDE.hidden) c.visible = true; RIDE.hidden = null; }
}
// on a phone: one 🚪 button while she rides (the ✋ button is a walking thing)
addTouchButton({ id: "owHopOut", emoji: "🚪", label: "HOP OUT", action: "interact", visible: () => !!RIDE.uid && ctx.state === "playing" });
let E = null;
export function initRide(engine) { E = engine; }

const roam = () => E && E.roam();
/** Am I riding with someone (their uid) — or null. */
export const riding = () => RIDE.uid;

/** Who sits in driver uid's passenger seat right now (a rider's uid, me included) — or null. */
export function seatOf(uid) {
    if (RIDE.uid === uid) return E.me();
    for (const u of E.members()) { if (u === E.me()) continue; const p = ctx.party.peer(u); if (p && p.x && p.x.rd === uid && ctx.party.fresh(p, 6000)) return u; }
    return null;
}
export function startRide(uid) {
    if (!roam() || RIDE.uid || !uid || uid === E.me()) return "Can't hop in right now";
    if (ctx.foot && ctx.foot.active) return "Get back in a car first 🚗";
    const taken = seatOf(uid);
    if (taken && taken !== E.me()) return `💺 Seat's taken — ${E.nameOf(taken)} called shotgun`;
    const dp = ctx.party.peer(uid);
    if (dp && dp.x && dp.x.rd) return `${E.nameOf(uid)} is a passenger right now`;
    const g = E.getG();
    if (g && g.ph === "go" && g.ps.includes(E.me())) return "Not in the middle of a game!";
    const p = ctx.party.peer(uid);
    if (!p || !ctx.party.fresh(p)) return "📶 Can't see them right now";
    if (E.zoneOfPeer(p) !== E.zone()) E.warpToFriend(uid);
    RIDE.uid = uid; RIDE.t = 0; RIDE.lost = 0;
    E.setRide(uid);
    hideCar(true);
    H.banner(`<b>🚗 Riding with ${E.nameOf(uid)}</b><small>${glyph("interact")} hop out · honk to wave</small>`, 2600, { key: "ow", prio: 2 });
    tone(523, 0.1, "triangle", 0.14, 784);
    emit("stat", { id: "owRides", n: 1 });
    return "";
}
export function stopRide(quiet = false, opts = {}) {
    const uid = RIDE.uid;
    if (!uid) return false;
    RIDE.uid = null;
    E.setRide(null);
    H.prompt("");
    const car = ctx.car, rc = ctx.party && ctx.party.remoteCar(uid), p = ctx.party && ctx.party.peer(uid);
    hideCar(false);
    // the driver parked + walked off (or went inside): out at the kerb by their parked car, on her feet
    const pc = p && p.x && Array.isArray(p.x.pc) ? p.x.pc : null;
    let slow = rc && rc.shown && !rc.foot && Math.abs(rc.speed) < 4;
    if (ctx.TEST && opts.moving != null && rc && rc.shown && !rc.foot) slow = !opts.moving;    // (tests: a crawling page's party-time speeds are tiny)
    if ((pc && (!rc || !rc.shown || rc.foot)) || slow) {
        const x = pc && !slow ? pc[0] / 10 : rc.x, z = pc && !slow ? pc[1] / 10 : rc.z, h = pc && !slow ? pc[2] / 1000 : rc.h;
        const rx = -Math.cos(h), rz = Math.sin(h);
        car.place(x - rx * 3.4, z - rz * 3.4, h);
        const n = ctx.world.road.nearest(car.pos.x, car.pos.z, car.s, {});
        car.s = n.s; car.d = n.d;
        car.vx = car.vz = 0; car.vF = 0;
        car.syncObject();
        if (ctx.cam) ctx.cam.snap();
        if (ctx.party) ctx.party.respawned();
        if (ctx.foot && ctx.foot.start && ctx.state === "playing") { try { ctx.foot.start("parked", { line: quiet ? "" : `Thanks for the lift, ${E.nameOf(uid)}! 👋` }); } catch (e) { console.error("[ride] out", e); } }
        if (!quiet) { tone(784, 0.1, "triangle", 0.14, 523); rumble(0.2, 0.3, 120); }
        emit("openworld:hopout", { uid, how: "foot" });
        return true;
    }
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
    emit("openworld:hopout", { uid, how: "car" });
    return true;
}

// the rider's car follows the driver's (after physics: hooks.update runs after the car step)
hook("update", (dt, P) => {
    if (!RIDE.uid) return;
    if (!roam() || !E.members().includes(RIDE.uid)) { stopRide(true); return; }
    const car = ctx.car, rc = ctx.party.remoteCar(RIDE.uid), p = ctx.party.peer(RIDE.uid);
    RIDE.t += dt;
    if (ctx.law && ctx.law.hold) ctx.law.hold(1);        // (never her ticket / chase: she isn't driving)
    if ((P.interact || P.roll) && RIDE.t > 0.6) { stopRide(); return; }
    // the driver parked and walked off / went inside: she's let out at the kerb
    if (p && ((p.x && Array.isArray(p.x.f)) || p.m === 7) && RIDE.t > 0.6) { stopRide(); return; }
    H.prompt(`${glyph("interact")} 🚪 Hop out`);
    hideCar(true);
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
        const rp = rider === E.me() ? null : ctx.party.peer(rider);
        const em = rider === E.me() ? !!(ctx.emotes && ctx.emotes.active) : !!(rp && rp.x && Array.isArray(rp.x.e));
        s.person.update(dt, { sit: true, wave: !!(rp && (rp.f & 4)) || (rider === E.me() && input.honkHeld) || em });
    }
}
/** Hide a friend's own car while they ride with someone (show filter). */
export const ridingWith = p => (p && p.x && p.x.rd) || null;

// she rides: the driver's speed past a trap is not her ticket
on("speedTrap", info => { if (RIDE.uid && info) { info.handled = true; info.ticketed = false; } });
