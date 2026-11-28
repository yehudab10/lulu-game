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

export const RIDE = { uid: null, t: 0, seats: new Map(), lost: 0, hidden: null, gap: false, ox: 0, oz: 0 };
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
    RIDE.uid = uid; RIDE.t = 0; RIDE.lost = 0; RIDE.gap = false; RIDE.ox = RIDE.oz = 0; RIDE.last = null; RIDE.vx = RIDE.vz = 0; RIDE.rcPrev = null;
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

/** The driver crossed an ATTACHED town's line (it stands at its interchange, right here): she crosses with them at once,
 *  right where she sits — the same seamless line as driving it herself. (A warp after the 0.8 s wait below froze her car
 *  and then jumped it the ~12 m the driver had gone on — qafriends.) → true when she's on their side of the line now. */
function crossWith(p) {
    const T = ctx.town, z = E.zoneOfPeer(p), car = ctx.car;
    if (!T || !T.enter) return false;
    try {
        if (z && !T.active) {
            const b = (T.standing || []).find(x => x.town === z && x.ready && (!p.x || !p.x.ex || Math.abs(x.exitS - p.x.ex) < 1));
            if (!b) return false;
            T.enter({ town: z, exitS: b.exitS, at: { x: car.pos.x, z: car.pos.z, h: car.h }, speed: car.vF, quiet: true });
        } else if (!z && T.active && T.attached) {
            const hint = T.highwayS != null ? T.highwayS : car.s;     // (a town s is 500 km down the highway)
            T.leave("warp");                              // (nothing moves: the highway's road under her again)
            const n = ctx.world.highway.nearest(car.pos.x, car.pos.z, hint, {});
            car.s = n.s; car.d = n.d;
        } else return false;
    } catch (e) { console.warn("[openworld] ride: across the line", e); return false; }
    return E.zoneOfPeer(p) === E.zone();
}
/** The driver's car isn't drawn this frame (its track refilling — a town line, a respawn): her seat rolls on at its speed
 *  rather than standing still (a frozen picture, then a jump to where the driver got to — qafriends). */
/** Tests: what the ride did lately (frame, event, detail) — qafriends prints it when a jump shows up. */
export const RLOG = [];
function rlog(ev, x = "") { RLOG.push([ctx.frames, ev, x, Math.round(ctx.car.pos.x * 10) / 10, Math.round(ctx.car.pos.z * 10) / 10]); if (RLOG.length > 24) RLOG.shift(); }
function roll(dt) {
    const car = ctx.car, L = RIDE.last;
    // (from where she was last drawn — the car's own physics step may or may not have moved it this frame)
    // (at her own measured speed — the driver's reported velocity can read 0 on a frame)
    if (L) { car.pos.x = L.x + (RIDE.vx || 0) * dt; car.pos.z = L.z + (RIDE.vz || 0) * dt; car.h = L.h; }
    RIDE.last = { x: car.pos.x, z: car.pos.z, h: car.h };
    RIDE.gap = true;
    car.syncObject();
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
        if (crossWith(p)) { rlog("cross"); RIDE.lost = 0; roll(dt); return; }
        roll(dt);
        RIDE.lost += dt;
        // (the town on this screen is still building at its interchange: keep rolling with the driver a while longer — a
        //  warp is a visible jump; only a town that isn't there at all warps after 0.8 s)
        const z = E.zoneOfPeer(p), building = !!z && (ctx.town && ctx.town.standing || []).some(b => b.town === z && !b.ready);
        if (RIDE.lost > (building ? 3 : 0.8)) { rlog("warp", building ? "building" : ""); RIDE.lost = 0; E.warpToFriend(RIDE.uid, true); RIDE.last = null; RIDE.gap = false; RIDE.ox = RIDE.oz = 0; RIDE.rcPrev = null; }   // (a warp is a cut: no glide back)
        return;
    }
    if (!rc || !rc.shown) { roll(dt); return; }
    RIDE.lost = 0;
    // (back from a gap: her seat glides onto the driver's car — never snaps — like a friend's car does, party/remote.js)
    if (RIDE.gap) { RIDE.gap = false; RIDE.ox = car.pos.x - rc.x; RIDE.oz = car.pos.z - rc.z; rlog("back", Math.hypot(RIDE.ox, RIDE.oz).toFixed(1)); if (Math.hypot(RIDE.ox, RIDE.oz) > 40) RIDE.ox = RIDE.oz = 0; RIDE.rcPrev = null; }
    // (the driver's car, as drawn here, can itself hop a few metres when her track changes frames — a town line: her seat
    //  takes the part of the hop the car couldn't have driven into the glide offset instead of jumping with it — qafriends)
    const RP = RIDE.rcPrev;
    if (RP) {
        const jx = rc.x - RP.x, jz = rc.z - RP.z, jl = Math.hypot(jx, jz), lim = Math.max(1.5, Math.abs(rc.speed || 0) * dt * 2 + 0.6);
        if (jl > lim && jl < 40) { const k = (jl - lim) / jl; RIDE.ox -= jx * k; RIDE.oz -= jz * k; rlog("hop", jl.toFixed(1)); }
    }
    RIDE.rcPrev = { x: rc.x, z: rc.z };
    const om = Math.hypot(RIDE.ox, RIDE.oz);
    if (om > 0.01) { const cut = Math.min(om * (1 - Math.exp(-dt / 0.12)), (8 + 2 * om) * dt), f = (om - cut) / om; RIDE.ox *= f; RIDE.oz *= f; } else RIDE.ox = RIDE.oz = 0;
    car.pos.set(rc.x + RIDE.ox, 0, rc.z + RIDE.oz); car.h = rc.h;
    const L = RIDE.last;
    if (L && dt > 0) { const k = 0.25, vx = (car.pos.x - L.x) / dt, vz = (car.pos.z - L.z) / dt; if (Math.hypot(vx, vz) < 60) { RIDE.vx = (RIDE.vx || 0) * (1 - k) + vx * k; RIDE.vz = (RIDE.vz || 0) * (1 - k) + vz * k; } }
    RIDE.last = { x: car.pos.x, z: car.pos.z, h: car.h };
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
    // (her outfit: mine when I'm the rider, a friend's from her party record — features/clothes)
    const me = ctx.party && riderUid === ctx.party.uid, q = !me && ctx.party && ctx.party.peer ? ctx.party.peer(riderUid) : null;
    const person = spawnPerson("luluPerson", { outfit: me ? undefined : (ctx.clothes && q ? ctx.clothes.outfitOf(q) : false) });
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
