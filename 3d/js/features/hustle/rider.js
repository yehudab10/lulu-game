// features/hustle — riders: fares and the crew get in and out of Lulu's car with
// ONE eased animation each (a walk-and-hop into the seat, a hop out onto the curb).
// Seating reuses roadevents' passenger seat (ctx.roadevents.seat / unseat — the
// same slots the hitchhikers use); without roadevents we fall back to our own
// holder on the car's passenger anchor.
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { burst } from "./util.js";
import * as SFX from "./sfx.js";

const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);    // easeInOutCubic
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const SIT = { sit: true };

// ── own seat (fallback when roadevents isn't there / its seat is taken) ──────
let holder = null;
const ownSeat = [];
function ownSeatOf(person) { return ownSeat.indexOf(person); }
function holderGroup() {
    const anc = ctx.car && ctx.car.anchors && ctx.car.anchors.passenger;
    if (!anc) return null;
    if (!holder) { holder = new THREE.Group(); holder.name = "hustle_riders"; }
    if (holder.parent !== anc) anc.add(holder);
    return holder;
}
const OWN_SLOTS = [[0, -0.33, 0.02], [0.0, -0.06, -0.86], [0.76, -0.06, -0.86], [0.38, 0.04, -1.3]];

/** Seat a person (pose(dt) → Person.update opts while seated). Returns true when seated. */
export function seat(person, { who = "", pose = null } = {}) {
    const re = ctx.roadevents;
    if (re && re.seat && re.unseat) {
        if (re.seat(person, { bonus: false, keep: true, who, pose })) { person.__seat = "re"; return true; }
    }
    const g = holderGroup();
    if (!g) return false;
    const k = Math.min(ownSeat.length, OWN_SLOTS.length - 1);
    person.obj.position.set(...OWN_SLOTS[k]);
    person.obj.rotation.set(0, 0, 0);
    person.obj.scale.setScalar(0.86);
    g.add(person.obj);
    ownSeat.push(person);
    person.__seat = "own";
    person.__pose = pose;
    return true;
}
/** Take a person out of the seat (no animation). */
export function unseat(person) {
    if (person.__seat === "re" && ctx.roadevents && ctx.roadevents.unseat) ctx.roadevents.unseat(person);
    const i = ownSeatOf(person);
    if (i >= 0) { ownSeat.splice(i, 1); ownSeat.forEach((p, k) => p.obj.position.set(...OWN_SLOTS[k])); }
    if (person.obj.parent) person.obj.parent.remove(person.obj);
    person.__seat = null;
}
/** Our fallback seat animates its riders (roadevents animates its own). */
export function updateOwnSeat(dt) {
    for (const p of ownSeat) p.update(dt, (p.__pose && p.__pose(dt)) || SIT);
}
export function clearOwnSeat() {
    for (const p of ownSeat.slice()) unseat(p);
    if (holder && holder.parent) holder.parent.remove(holder);
}

/** The passenger seat in world space (where a boarding rider lands). */
export function seatWorld(out) {
    const anc = ctx.car.anchors && ctx.car.anchors.passenger;
    if (anc) { anc.getWorldPosition(out); out.y -= 0.25; }
    else out.set(ctx.car.pos.x, 0.6, ctx.car.pos.z);
    return out;
}

/**
 * ONE eased move into the car: from where they stand, they stride toward the
 * passenger door and hop in (ease-in-out position + a little arc), turning to
 * face forward as they land. Then they're seated. opts: dur, who, pose, onDone().
 * Returns the actor (removed when done).
 */
export function boardRider(person, { dur = 1.15, who = "", pose = null, onDone = null, arc = 0.85 } = {}) {
    const obj = person.obj;
    if (!obj.parent) ctx.scene.add(obj);
    const from = obj.position.clone();
    const fromRot = obj.rotation.y;
    const sc0 = obj.scale.x;
    let t = 0, done = false;
    SFX.hop();
    return addActor({
        foot: true,
        update(dt) {
            if (done) return false;
            t += dt;
            const k = Math.min(1, t / dur), e = ease(k);
            seatWorld(_b);
            _a.lerpVectors(from, _b, e);
            _a.y = from.y + (_b.y - from.y) * e + Math.sin(Math.PI * k) * arc;
            obj.position.copy(_a);
            // turn toward the car while striding, then line up with it for the landing
            const toCar = Math.atan2(_b.x - from.x, _b.z - from.z);
            const yaw = k < 0.55 ? lerpAngle(fromRot, toCar, ease(k / 0.55)) : lerpAngle(toCar, ctx.car.h, ease((k - 0.55) / 0.45));
            obj.rotation.set(0, yaw, 0);
            obj.scale.setScalar(sc0 + (0.86 - sc0) * e);
            person.update(dt, k < 0.6 ? { walk: 3.2 * (1 - k) } : { sit: k > 0.85, cheer: k > 0.6 && k <= 0.85 });
            if (k >= 1) {
                done = true;
                if (obj.parent) obj.parent.remove(obj);
                obj.rotation.set(0, 0, 0);
                const ok = seat(person, { who, pose });
                SFX.plop();
                if (onDone) { try { onDone(ok); } catch (e) { console.error("[hustle] board", e); } }
                return false;
            }
            return true;
        },
    });
}

/**
 * ONE eased hop out of the car onto the curb at (x, z) — then they linger,
 * facing the car (waving, cheering) for `linger` seconds and go.
 * opts: dur, linger, mood: "wave" | "cheer" | "storm" (stomp off), onLand(), keepAlive (don't dispose)
 */
export function unboardRider(person, x, z, { dur = 0.95, linger = 3.5, mood = "wave", onLand = null, walkAway = 0 } = {}) {
    const obj = person.obj;
    seatWorld(_c);
    unseat(person);
    obj.position.copy(_c);
    obj.scale.setScalar(0.86);
    obj.rotation.set(0, ctx.car.h, 0);
    ctx.scene.add(obj);
    const from = _c.clone(), to = new THREE.Vector3(x, 0, z);
    const fromRot = ctx.car.h;
    const away = Math.atan2(to.x - from.x, to.z - from.z);
    let t = 0, landed = false, tl = 0;
    SFX.hop();
    return addActor({
        foot: true,
        update(dt) {
            t += dt;
            const car = ctx.car;
            if (!landed) {
                const k = Math.min(1, t / dur), e = ease(k);
                obj.position.lerpVectors(from, to, e);
                obj.position.y = from.y * (1 - e) + Math.sin(Math.PI * k) * 0.75;
                obj.rotation.y = lerpAngle(fromRot, away, ease(Math.min(1, k * 1.6)));
                obj.scale.setScalar(0.86 + 0.14 * e);
                person.update(dt, { cheer: k < 0.5, walk: k > 0.5 ? 2.2 : 0 });
                if (k >= 1) {
                    landed = true;
                    burst(to.x, 0.2, to.z, 6, 1.6, [0.75, 0.72, 0.66], 0.35, 0.5);
                    if (onLand) { try { onLand(); } catch (e) { console.error("[hustle] land", e); } }
                }
                return true;
            }
            tl += dt;
            if (walkAway > 0 && tl > linger * 0.45) {
                // stroll off the road, away from the car
                obj.rotation.y = lerpAngle(obj.rotation.y, away, Math.min(1, dt * 4));
                obj.position.x += Math.sin(obj.rotation.y) * walkAway * dt;
                obj.position.z += Math.cos(obj.rotation.y) * walkAway * dt;
                person.update(dt, { walk: walkAway });
            } else {
                person.face(car.pos.x, car.pos.z, dt, 4);
                person.update(dt, mood === "cheer" ? { cheer: true } : mood === "storm" ? { walk: 0, point: true } : { wave: true });
            }
            return tl < linger;
        },
        dispose() { if (obj.parent) obj.parent.remove(obj); },
    });
}

function lerpAngle(a, b, k) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
}
export { ease, lerpAngle };
