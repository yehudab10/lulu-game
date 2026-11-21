// features/airport — AIRPORT SECURITY AT THE KERB (the owner's decision 10: "cartoon airport security instead of town
// police; if she's wanted, security slows her and the real cops can catch up").
//
// She's WANTED (law's stars: a chase, a fugitive stretch, or warrants on file she hasn't changed her look since) and in
// the fenced landside → Officer Segal rolls out of the nearest terminal door on his Segway, with Rex (law's K9, who only
// ever finds kugel):
//   • at the wheel: he rides up beside her window and her car is held to a crawl while he's there (`TUNE.carCap`; the
//     throttle eases off, a touch of brake — the "controls" hook every feature uses); mid-chase he keeps the cops'
//     eyes on her (`ctx.law.spot`), so the cruisers that followed her off the exit (chase.js) close in; with warrants
//     but no chase he radios it in (`ctx.law.callIn`) and a cruiser comes looking;
//   • on foot: Rex has her shoelace — she walks / runs at `TUNE.footSlow` while he's at her heels (foot's `bounds.slow`
//     registry); a few seconds in, Segal waves a foot cop over from the doors (`ctx.foot.startChase`).
// He gives up at the landside's edge ("Next time, ma'am!"), when his Segway's battery runs out (`TUNE.maxT`), or when
// she isn't wanted any more. Once a visit (+ a cooldown). Speech bubbles only — no toasts — and it's all on her screen
// (personal, like the law). Never in a 🎉 party, never in Dina's mode (the airport isn't there), never mid-scene.
import * as THREE from "three";
import { ctx, emit, hook, pick } from "../../core/ctx.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as LY from "./layout.js";
import * as L from "./lines.js";
import { inLand } from "./plan.js";

export const TUNE = {
    near: 7,            // m from her: he's "on" her (the car's crawl / Rex's grip)
    segway: 12.5,       // m/s — a cartoon Segway (it has a WARRANTY)
    carCap: 4.5,        // m/s her car is held to while he's beside her (~10 mph)
    footSlow: 0.5,      // × her walk / run while Rex has her shoelace
    spotEvery: 1.0,     // s between "she's HERE" calls to the chasing cops
    radioAt: 3.5,       // s on her before he radios it in (no chase on: a call-in / a foot cop)
    maxT: 32,           // s — his battery
    cool: 45,           // s before he comes again (once a visit anyway)
    lineGap: 4.2,       // s between his lines
};
const MODELS = ["airport_guard", "airport_segway", "lawK9"];

const onFoot = () => !!(ctx.foot && ctx.foot.active);
const lp = () => (onFoot() && ctx.foot.pos) || (ctx.car && ctx.car.pos) || null;
function wanted() {
    const Lw = ctx.law;
    return !!Lw && Lw.wanted > 0 && !(Lw.lowKey && !Lw.chasing);
}
function partyOn() { return !!(ctx.party && ctx.party.active); }

/** The kerb's security, for airport state S (index.js). → { update(dt), reset(), busy, phase, debug } */
export function makeSecurity(S, say) {
    const K = { phase: null, t: 0, guard: null, seg: null, dog: null, legs: [], visit: false, coolT: -1e9, lineT: 0, spotT: 0, radioed: false, on: 0, said: 0 };
    const _f = {};
    K.reset = () => {
        despawn(); K.phase = null; K.visit = false; K.radioed = false;
        if (K.ownNoBoost && ctx.G) { ctx.G.noBoost = false; K.ownNoBoost = false; }
    };
    function despawn() {
        for (const o of [K.guard && K.guard.obj, K.seg, K.dog]) if (o && o.parent) o.parent.remove(o);
        K.guard = null; K.seg = null; K.dog = null; K.legs = [];
    }
    /** Should he come out now? */
    function wants() {
        if (!S.ready || !S.inside || K.visit || ctx.time - K.coolT < TUNE.cool) return false;
        if (partyOn() || ctx.view || !["playing", "footRun"].includes(ctx.state)) return false;
        if (S.joke && S.joke.phase) return false;
        return wanted();
    }
    function start() {
        if (!MODELS.slice(0, 2).every(k => models[k])) { ensureModels(MODELS).catch(() => {}); return false; }
        if (!models.lawK9) ensureModels(["lawK9"]).catch(() => {});
        const G = S.G, p = lp();
        // out of the nearest terminal door
        let best = null, bd = 1e9;
        for (const f of LY.DOORS) { const w = G.F.world(f, LY.TERM.r0 - 1.2, {}); const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd) { bd = d; best = w; } }
        K.guard = spawnPerson("airport_guard", {});
        K.seg = models.airport_segway.clone(true);
        K.guard.obj.position.set(best.x, 0.26, best.z);
        K.seg.position.set(best.x, 0, best.z);
        ctx.scene.add(K.seg); ctx.scene.add(K.guard.obj);
        K.guard.obj.traverse(m => { if (m.isMesh) m.castShadow = false; });
        if (models.lawK9) {
            K.dog = cloneWithColors(models.lawK9);
            K.dog.scale.setScalar(1.1);
            K.dog.position.set(best.x + 1, 0, best.z);
            K.legs = ["Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR"].map(n => findNodes(K.dog, n)[0]).filter(Boolean);
            ctx.scene.add(K.dog);
        }
        K.phase = "in"; K.t = 0; K.on = 0; K.visit = true; K.radioed = false; K.lineT = 0; K.spotT = 0;
        say.over(K.guard.obj, pick(L.SECURITY.spot), 2.6);
        emit("airport:security", { how: "kerb", foot: onFoot(), chase: !!(ctx.law && ctx.law.chasing) });
        emit("stat", { id: "airportSecurity", n: 1 });
        return true;
    }
    function leave(line) {
        if (!K.guard) { K.phase = null; return; }
        if (line) say.over(K.guard.obj, line, 2.6);
        K.phase = "out"; K.t = 0; K.coolT = ctx.time;
    }
    const move = (o, to, speed, dt) => { const dx = to.x - o.position.x, dz = to.z - o.position.z, d = Math.hypot(dx, dz); if (d > 0.05) { const k = Math.min(1, speed * dt / d); o.position.x += dx * k; o.position.z += dz * k; o.rotation.y = Math.atan2(dx, dz); } return d; };
    K.update = (dt) => {
        if (!K.phase) { if (wants()) start(); return; }
        const G = S.G, p = lp(), g = K.guard;
        if (!G || !p || !g) { despawn(); K.phase = null; return; }
        K.t += dt;
        const o = g.obj;
        if (K.phase === "out") {
            // back to the doors
            const home = G.F.world(Math.max(LY.TERM.f0 + 5, Math.min(LY.TERM.f1 - 5, G.F.local(o.position.x, o.position.z, _f).f)), LY.TERM.r0 - 1.2, {});
            const d = move(o, home, 5, dt);
            if (K.dog) move(K.dog, { x: home.x + 1, z: home.z }, 5, dt);
            K.seg.position.set(o.position.x, 0, o.position.z); K.seg.rotation.y = o.rotation.y;
            g.update(dt, {});
            trot(dt, 5);
            if (d < 0.6 || K.t > 25) { despawn(); K.phase = null; }
            return;
        }
        // let her go: out of the landside, not wanted any more, a scene took over, or the battery
        if (!S.inside) { leave(pick(L.SECURITY.gone)); emit("airport:security", { how: "gone" }); return; }
        if (!wanted()) { leave(null); return; }
        if (K.t > TUNE.maxT) { leave("Battery's at 2%… Rex, we're WALKING back."); return; }
        if (ctx.view || !["playing", "footRun"].includes(ctx.state)) return;
        // ride up beside her window (the car: her right… his left: the kerb side) / at her heels on foot
        const foot = onFoot(), h = foot ? (ctx.foot.obj ? ctx.foot.obj.rotation.y : 0) : ctx.car.h;
        const side = foot ? 1.4 : 2.7, back = foot ? 1.2 : 0.6;
        const tgt = { x: p.x - Math.cos(h) * side - Math.sin(h) * back, z: p.z + Math.sin(h) * side - Math.cos(h) * back };
        const d = move(o, tgt, TUNE.segway, dt);
        const dd = Math.hypot(o.position.x - p.x, o.position.z - p.z);
        if (dd < TUNE.near) { o.rotation.y = h; K.on += dt; if (K.phase === "in") { K.phase = "on"; } }
        if (K.dog) {
            const dt2 = { x: p.x - Math.sin(h) * (foot ? 0.7 : 2.2) + Math.cos(h) * 0.4, z: p.z - Math.cos(h) * (foot ? 0.7 : 2.2) - Math.sin(h) * 0.4 };
            move(K.dog, dt2, TUNE.segway * 1.05, dt);
            K.dog.position.y = Math.abs(Math.sin(K.t * 10)) * 0.08;
            trot(dt, 10);
        }
        K.seg.position.set(o.position.x, 0, o.position.z); K.seg.rotation.y = o.rotation.y;
        g.update(dt, { talk: K.phase === "on" && K.lineT > 0 });
        if (K.phase !== "on") return;
        // his lines (a bubble every few seconds), Rex's, Lulu's
        K.lineT -= dt;
        if (K.lineT <= 0) {
            K.lineT = TUNE.lineGap;
            const n = K.said++;
            if (n % 3 === 2) say.lulu(pick(L.SECURITY.lulu), 2.4);
            else if (foot && K.dog && n % 3 === 1) say.over(K.dog, pick(L.SECURITY.dog), 2);
            else say.over(o, pick(foot ? L.SECURITY.foot : L.SECURITY.car), 2.6);
        }
        // the real cops catch up: mid-chase he keeps their eyes on her; no chase → he radios it in once
        const Lw = ctx.law;
        if (Lw && Lw.chasing) { K.spotT -= dt; if (K.spotT <= 0) { K.spotT = TUNE.spotEvery; Lw.spot(TUNE.spotEvery + 0.5); } }
        else if (!K.radioed && K.on > TUNE.radioAt) {
            K.radioed = true;
            say.over(o, L.SECURITY.radio, 2.6);
            const charge = (Lw && Lw.warrants && Lw.warrants[0]) || "RUNNING FROM A SEGWAY";
            if (foot) { if (ctx.foot.startChase) { const w = G.F.world(G.F.local(p.x, p.z, _f).f, LY.TERM.r0 - 1.2, {}); ctx.foot.startChase(w, { charges: [charge, "RUNNING FROM A SEGWAY"] }); } }
            else if (Lw && Lw.callIn) Lw.callIn(charge, { delay: 2 });
            emit("airport:security", { how: "radio" });
        }
    };
    function trot(dt, rate) {
        const ph = K.t * rate;
        K.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0)) * 0.5; });
    }
    /** Is he holding her up right now (beside the car / Rex at her heels)? */
    K.holding = () => K.phase === "on" && !!K.guard && !!lp() && Math.hypot(K.guard.obj.position.x - lp().x, K.guard.obj.position.z - lp().z) < TUNE.near + 1;
    Object.defineProperty(K, "busy", { get: () => !!K.phase });
    // at the wheel: a crawl while he's beside her window (throttle off, a touch of brake above the cap)
    hook("controls", (ctl) => {
        const G = ctx.G, hold = !onFoot() && K.holding() && !!ctx.car;
        // (no nitro past a Segway either — G.noBoost, put back as it was when he lets go)
        if (G && hold && !K.ownNoBoost && !G.noBoost) { G.noBoost = true; K.ownNoBoost = true; }
        if (G && !hold && K.ownNoBoost) { G.noBoost = false; K.ownNoBoost = false; }
        if (!hold) return;
        const v = ctx.car.vF;
        if (v > TUNE.carCap) { ctl.throttle = 0; ctl.brake = Math.max(ctl.brake || 0, Math.min(0.8, (v - TUNE.carCap) * 0.25)); }
        else if (v > TUNE.carCap * 0.8) ctl.throttle = Math.min(ctl.throttle || 0, 0.25);
    }, 40);
    // on foot: Rex has her shoelace
    K.footMul = () => (K.phase === "on" && onFoot() && K.dog && lp() && Math.hypot(K.dog.position.x - lp().x, K.dog.position.z - lp().z) < 1.6) || (K.phase === "on" && onFoot() && !K.dog && K.holding()) ? TUNE.footSlow : 1;
    K.inLand = (x, z) => !!S.G && inLand(S.G, x, z, 2);
    return K;
}
