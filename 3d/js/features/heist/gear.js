// features/heist — 🕸️ THE COPS' CARTOON GEAR (added on top of law's pursuit, no edits to cops.js):
//
//   STUN NET    in a high-star chase (★★★★, or ★★★ in Lulu's own heist getaway) a chasing cruiser in range
//               lobs a net (heist_net) at where she's GOING — a readable ~0.8 s arc: zig-zag and it lands on
//               the asphalt. A hit drapes it over the car: a blue zap, half her top speed, no nitro, for
//               TUNE.gear.netHold s — then it rips off. Never a heart.
//   SPIKE STRIP the cartoon strip (heist_spikes) tossed across her lane 70–90 m ahead (★★★★ / ★★★ in a
//               heist): change lanes, or it's a flat — streets' flat tyres (ctx.streets.puncture: wobble,
//               sparks, no nitro) when that feature is here, our own slow-down when it isn't — plus a dent
//               (ctx.feel.damage.hit) on her own car. Wears off after TUNE.gear.flat s.
// Streets' 3★+ ROADBLOCKS (with their own spike strips) keep running on the highway when streets is live;
// our strip is the "variant" a single cruiser throws (and the one in town, where there are no roadblocks).
import * as THREE from "three";
import { ctx, on, hook, emit } from "../../core/ctx.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { TUNE } from "./data.js";
import { models, cloneWithColors, need, live, rand, clamp, pt, onFoot, stat, sfx, burst, luluSays, pick } from "./common.js";

const TG = TUNE.gear;
export const GEAR = { netT: rand(5, 8), spikeT: rand(10, 16), flight: null, netted: null, strip: null, flat: null, hint: 0, nets: 0, spikes: 0, drop: [] };
const _a = new THREE.Vector3();

const heistOn = () => !!(ctx.heist && ctx.heist.job && ctx.heist.job.phase === "getaway");
/** Is the gear in play right now (a chase she's driving in, hot enough)? */
function gearOn(min) {
    if (!(ctx.law && ctx.law.chasing) || ctx.state !== "playing" || onFoot()) return false;
    if (!(live() || heistOn())) return false;
    return (ctx.law.wanted || 0) >= (heistOn() ? Math.min(min, 3) : min);
}
/** The chasing cruisers (law's own traffic cars) — read-only. */
function chasers() {
    const out = [];
    for (const c of ctx.traffic.cars) { const u = c.data && c.data.law; if (u && u.mode === "chase" && !c.hit) out.push(c); }
    return out;
}

// ── the stun net ────────────────────────────────────────────────────────
/** Fire a net from cruiser `from` (default: the nearest chaser in range). opts.sure: aim dead on (tests). */
export function fireNet(from = null, opts = {}) {
    if (GEAR.flight || GEAR.netted) return false;
    if (!models.heistNet) { need(["heistNet"]); return false; }
    const car = ctx.car;
    let src = from;
    if (!src) {
        let best = 1e9;
        for (const c of chasers()) { const d = Math.hypot(c.x - car.pos.x, c.z - car.pos.z); if (d > TG.netRange[0] && d < TG.netRange[1] && d < best) { best = d; src = c; } }
    }
    const fromP = src ? _a.set(src.x, 1.7, src.z) : _a.set(car.pos.x - Math.sin(car.h) * 18, 1.7, car.pos.z - Math.cos(car.h) * 18);
    // aim where she'll be when it lands (her velocity now — swerve and it misses)
    const lead = opts.sure ? TG.netFlight : TG.netFlight * 0.95;
    const to = new THREE.Vector3(car.pos.x + car.vx * lead, 0.2, car.pos.z + car.vz * lead);
    const obj = cloneWithColors(models.heistNet);
    obj.position.copy(fromP);
    obj.scale.setScalar(0.35);
    ctx.scene.add(obj);
    GEAR.flight = { obj, from: fromP.clone(), to, t: 0, sure: !!opts.sure };
    sfx.zap();
    if (GEAR.hint < 1) { GEAR.hint++; H.toast("🕸️ STUN NET! Swerve — zig-zag to dodge it", "pink", { key: "heist:net" }); }
    else H.toast("🕸️ NET INCOMING!", "pink", { key: "heist:net" });
    emit("heist:gear", { kind: "net", phase: "fire" });
    return true;
}
function flightTick(dt) {
    const f = GEAR.flight;
    if (!f) return;
    f.t += dt;
    const k = clamp(f.t / TG.netFlight, 0, 1);
    if (f.sure) f.to.set(ctx.car.pos.x, 0.2, ctx.car.pos.z);
    f.obj.position.lerpVectors(f.from, f.to, k);
    f.obj.position.y += Math.sin(k * Math.PI) * 4.5;
    f.obj.scale.setScalar(0.35 + 0.65 * k);
    f.obj.rotation.y += dt * 6;
    if (k < 1) return;
    GEAR.flight = null;
    const car = ctx.car, d = Math.hypot(car.pos.x - f.to.x, car.pos.z - f.to.z);
    if (d < TG.netHit && ctx.state === "playing") netted(f.obj);
    else {
        // a miss: it flops onto the asphalt and lies there a moment
        f.obj.position.y = 0.02; f.obj.rotation.set(0, f.obj.rotation.y, 0); f.obj.scale.setScalar(0.9);
        GEAR.drop.push({ obj: f.obj, t: 3 });
        H.toast("😎 Missed me!", "gold", { key: "heist:net" });
        emit("heist:gear", { kind: "net", phase: "miss" });
    }
}
function netted(obj) {
    const car = ctx.car;
    if (obj.parent) obj.parent.remove(obj);
    car.obj.add(obj);
    obj.position.set(0, 0.25, 0); obj.rotation.set(0, 0, 0); obj.scale.set(0.78, 1.2, 1.55);
    GEAR.netted = { obj, t: 0, noBoostWas: !!ctx.G.noBoost };
    ctx.G.noBoost = true;
    GEAR.nets++;
    sfx.zap();
    rumble(0.6, 0.6, 350, true);
    H.banner("<b>🕸️ NETTED!</b><small>a stun net — half speed for a few seconds, then it rips</small>", 1800, { key: "heist:net", prio: 2 });
    luluSays(pick(["A NET?! Who am I, a FISH?!", "Get it OFF! It's tickling!", "Oh, very mature, officer."]), true);
    stat("heistNetted", 1);
    emit("heist:gear", { kind: "net", phase: "hit" });
}
function nettedTick(dt) {
    const n = GEAR.netted;
    if (!n) return;
    n.t += dt;
    const car = ctx.car;
    if (Math.random() < 0.5) burst(car.pos.x + rand(-1, 1), 1.2, car.pos.z + rand(-1, 1), 2, 2.5, [0.25, 0.77, 1], 0.2, 0.3);
    if (n.t >= TG.netHold) ripNet();
}
export function ripNet() {
    const n = GEAR.netted;
    if (!n) return;
    GEAR.netted = null;
    if (ctx.G) ctx.G.noBoost = n.noBoostWas;
    const car = ctx.car;
    if (n.obj.parent) n.obj.parent.remove(n.obj);
    n.obj.position.set(car.pos.x - Math.sin(car.h) * 4, 0.02, car.pos.z - Math.cos(car.h) * 4);
    n.obj.scale.setScalar(0.9);
    ctx.scene.add(n.obj);
    GEAR.drop.push({ obj: n.obj, t: 2.5 });
    sfx.rip();
    H.toast("✂️ RRRIP — the net's off!", "gold", { key: "heist:net" });
    emit("heist:gear", { kind: "net", phase: "off" });
}

// ── the spike strip ─────────────────────────────────────────────────────
/** Toss a strip across the road `ahead` m in front of her, centred on lane d (default: her lane). */
export function laySpikes(ahead = rand(TG.spikeAhead[0], TG.spikeAhead[1]), d = null) {
    if (GEAR.strip) return false;
    if (!models.heistSpikes) { need(["heistSpikes"]); return false; }
    const car = ctx.car;
    const lane = d != null ? d : (Math.abs(car.d) > 3.5 ? Math.sign(car.d) * 5.25 : Math.sign(car.d || 1) * 1.75);
    const s = car.s + ahead;
    const p = pt(s, lane);
    const obj = cloneWithColors(models.heistSpikes);
    obj.position.set(p.x, 0.01, p.z);
    obj.rotation.y = p.h;
    ctx.scene.add(obj);
    GEAR.strip = { s, d: lane, obj, prevS: car.s, t: 0, hit: false };
    H.banner("<b>🚓 SPIKE STRIP TOSSED!</b><small>change lanes — or it's a flat</small>", 1800, { key: "heist:spikes", prio: 2 });
    emit("heist:gear", { kind: "spikes", phase: "lay", s, d: lane });
    return true;
}
function stripTick(dt) {
    const st = GEAR.strip;
    if (!st) return;
    st.t += dt;
    const car = ctx.car;
    const crossed = (st.prevS < st.s && car.s >= st.s) || (st.prevS > st.s && car.s <= st.s);
    if (crossed && !st.hit && Math.abs(car.d - st.d) < 2.6 && ctx.state === "playing") { st.hit = true; flatTyres(); }
    st.prevS = car.s;
    if (car.s - st.s > 40 || st.t > 30) { if (st.obj.parent) st.obj.parent.remove(st.obj); GEAR.strip = null; }
}
export function flatTyres(dur = TG.flat) {
    GEAR.spikes++;
    stat("heistSpiked", 1);
    try { if (ctx.feel && ctx.feel.damage && !(ctx.foot && ctx.foot.vehicle)) ctx.feel.damage.hit("front"); } catch (e) { /* */ }
    if (ctx.streets && ctx.streets.puncture) { ctx.streets.puncture(dur); emit("heist:gear", { kind: "spikes", phase: "hit", via: "streets" }); return; }
    // (no streets feature: our own flat — a slower top speed, no nitro, a wobble)
    if (!GEAR.flat) GEAR.flat = { t: 0, dur, noBoostWas: !!ctx.G.noBoost };
    else GEAR.flat.t = 0;
    ctx.G.noBoost = true;
    sfx.pop();
    H.banner("<b>🛞 SPIKED!</b><small>flat tyres for a bit — no nitro</small>", 1800, { key: "heist:spikes", prio: 2 });
    emit("heist:gear", { kind: "spikes", phase: "hit", via: "heist" });
}
function flatTick(dt) {
    const f = GEAR.flat;
    if (!f) return;
    f.t += dt;
    if (f.t >= f.dur) { GEAR.flat = null; if (ctx.G) ctx.G.noBoost = f.noBoostWas; H.toast("🛞 Tyres are back!", "gold"); }
}
/** Is she slowed by spikes right now (ours or streets')? */
export function isFlat() { return !!GEAR.flat || !!(ctx.streets && ctx.streets.flat); }

// ── wiring ──────────────────────────────────────────────────────────────
hook("controls", (ctl) => {
    if (!GEAR.netted && !GEAR.flat) return;
    const car = ctx.car, top = 42 * ((car.stats && car.stats.top) || 1);
    const cap = top * (GEAR.netted ? TG.netTop : 0.62);
    if (car.vF > cap) { ctl.throttle = 0; ctl.brake = Math.max(ctl.brake || 0, GEAR.netted ? 0.35 : 0); }
    if (GEAR.netted) ctl.steer = clamp(ctl.steer + Math.sin(ctx.time * 11) * 0.08, -1, 1);
}, 3);
hook("update", (dt, P, controlsOn) => {
    try {
        flightTick(dt); nettedTick(dt); stripTick(dt); flatTick(dt);
        for (let i = GEAR.drop.length - 1; i >= 0; i--) { const d = GEAR.drop[i]; d.t -= dt; if (d.t <= 0) { if (d.obj.parent) d.obj.parent.remove(d.obj); GEAR.drop.splice(i, 1); } }
        if (!controlsOn) return;
        if (gearOn(TG.netStars)) {
            GEAR.netT -= dt;
            if (GEAR.netT <= 0) { GEAR.netT = rand(TG.netEvery[0], TG.netEvery[1]); if (!(ctx.law.searching)) fireNet(); }
        }
        if (gearOn(TG.spikeStars) && !(ctx.town && ctx.town.active && !heistOn())) {
            GEAR.spikeT -= dt;
            if (GEAR.spikeT <= 0) { GEAR.spikeT = rand(TG.spikeEvery[0], TG.spikeEvery[1]); if (!ctx.law.searching && ctx.car.speed > 8) laySpikes(); }
        }
    } catch (e) { console.error("[heist gear]", e); }
});
// the kit loads as soon as a chase gets hot, so the first net / strip is ready when it's due
on("cop:chase", e => { if (e && e.active && (live() || heistOn())) need(["heistNet", "heistSpikes"]); });
function clear() {
    if (GEAR.flight && GEAR.flight.obj.parent) GEAR.flight.obj.parent.remove(GEAR.flight.obj);
    GEAR.flight = null;
    if (GEAR.netted) { const n = GEAR.netted; GEAR.netted = null; if (n.obj.parent) n.obj.parent.remove(n.obj); if (ctx.G) ctx.G.noBoost = n.noBoostWas; }
    if (GEAR.strip && GEAR.strip.obj.parent) GEAR.strip.obj.parent.remove(GEAR.strip.obj);
    GEAR.strip = null;
    if (GEAR.flat) { if (ctx.G) ctx.G.noBoost = GEAR.flat.noBoostWas; GEAR.flat = null; }
    for (const d of GEAR.drop) if (d.obj.parent) d.obj.parent.remove(d.obj);
    GEAR.drop.length = 0;
    GEAR.netT = rand(5, 8); GEAR.spikeT = rand(10, 16);
}
hook("runStart", () => { clear(); GEAR.hint = 0; });
on("title", clear);
on("state", ({ to }) => { if (to !== "playing" && to !== "playPhoto" && (GEAR.netted || GEAR.flight)) { const keep = GEAR.strip; GEAR.strip = null; clear(); GEAR.strip = keep; } });
on("town:enter", () => { if (GEAR.strip && GEAR.strip.obj.parent) GEAR.strip.obj.parent.remove(GEAR.strip.obj); GEAR.strip = null; });
on("town:leave", () => { if (GEAR.strip && GEAR.strip.obj.parent) GEAR.strip.obj.parent.remove(GEAR.strip.obj); GEAR.strip = null; });
