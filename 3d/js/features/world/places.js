// features/world/places.js — PLACES YOU CAN PULL INTO. The road isn't just
// scenery: a few spots along Cruise are real places — ⛽ Gas 'n' Go, 🌄 the
// Lookout over the lake, and the family's own driveways (Bubbe's, Heshy's pool,
// Avigail's porch… — the houses journey builds along the one continuous road).
// No menu jump: pull off the road into the bay and STOP. A short, skippable
// in-world beat plays (the host says something, a small reward, Lulu's reply),
// then she drives on from right there. Each spot works once per run.
//
// A generic registry, so other features (a town, a second town later) can add
// places without touching this file:
//   ctx.places.add({ id, name, icon, kind, where(mode) → [s…], d, bay: {half, d0, d1},
//                    model, sign: {lines, bg}, colliders(spot) → [{x, z, r}],
//                    host(spot) → {x, y, z}, cam(spot, t, pos, look), dur, beats: [{t, run(spot)}] })
import * as THREE from "three";
import { ctx, on, emit, hook, registerState, setState, pick } from "../../core/ctx.js";
import { save3d, store, saveSoon } from "../../core/save.js";
import { heal, addCoins, addScore } from "../../core/driving.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { facingRoad } from "../../world.js";
import { spawnPerson } from "../../core/people.js";
import { input, glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { ease } from "./path.js";

export const saved = store("world", { visits: {}, photoTip: false });

const PLACES = new Map();      // id → def
const SPOTS = new Map();       // id@s → live spot {place, s, x, z, h, rot, obj, anchors, chunk, people}
const V = { inside: null, still: 0, prompt: false, ownNoPull: false, visited: new Set(), spot: null, t: 0, beat: 0, said: false };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

export function addPlace(def) {
    PLACES.set(def.id, Object.assign({ kind: "pullin", side: 1, d: 15, bay: { half: 7, d0: 9, d1: 15 }, dur: 3.4, beats: [] }, def));
    return def;
}
const quiet = () => (save3d.settings.chatter || "normal") === "quiet";
const modeNow = () => ctx.G.mode || "cruise";
function positions(place, mode) { try { return (place.where && place.where(mode)) || []; } catch (e) { return []; } }

/** Say something over a person / point in the world (banter's bubble, else a toast). */
export function sayAt(text, target, opts = {}) {
    let ok = false;
    if (target && ctx.banter && ctx.banter.bubble) { try { ok = ctx.banter.bubble(text, target, Object.assign({ dur: 2.6, y: 2.0 }, opts)); } catch (e) { ok = false; } }
    if (!ok) H.toast(`${opts.who ? opts.who + ": " : ""}${text}`, opts.cls === "angry" ? "red" : "pink");
}
function luluLine(text) {
    if (quiet()) return;
    if (ctx.banter && ctx.banter.say) { try { ctx.banter.say(text); return; } catch (e) { /* toast */ } }
    H.toast(`💬 ${text}`);
}

// ── fixed spots along Cruise (metres). Kept clear of the family stops and the coast's ocean side. ──
const GAS_AT = [1300, 6900, 21800, 34000, 44000];
const LOOK_AT = [2400, 8200, 24800, 38800];
for (let s = 50000; s < 400000; s += 9000) { GAS_AT.push(s); LOOK_AT.push(s + 4500); }

// ── building spots as chunks stream in ───────────────────────────────────
const deadChunks = new WeakSet();
on("chunk:dispose", ({ chunk }) => {
    deadChunks.add(chunk);
    for (const [k, sp] of SPOTS) if (sp.chunk === chunk) { for (const p of sp.people || []) p.obj.removeFromParent(); SPOTS.delete(k); }
});

on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (!ctx.enabled("world")) return;
    const mode = modeNow();
    for (const place of PLACES.values()) {
        for (const s of positions(place, mode)) {
            if (place.sign && s - 190 >= s0 && s - 190 < s1) chunk.sign(world, Object.assign({ s: s - 190, d: 10.4 }, place.sign));
            if (s < s0 || s >= s1) continue;
            const road = world.road, p = road.point(s, place.d, {}), h = road.at(s).h;
            const spot = { key: place.id + "@" + Math.round(s), place, s, x: p.x, z: p.z, h, rot: facingRoad(h, place.side), chunk, obj: null, anchors: {}, people: [] };
            SPOTS.set(spot.key, spot);
            if (place.model) {
                ensureModels([place.model]).then(() => {
                    if (deadChunks.has(chunk) || !models[place.model]) return;
                    const o = cloneWithColors(models[place.model]);
                    o.position.set(p.x, 0, p.z);
                    o.rotation.y = spot.rot;
                    chunk.add(o);
                    o.updateMatrixWorld(true);
                    spot.obj = o;
                    for (const n of findNodes(o, "Anchor_")) spot.anchors[n.name.replace(/^Anchor_/, "").replace(/\d+$/, "")] = n.getWorldPosition(new THREE.Vector3());
                    if (place.built) try { place.built(spot, chunk); } catch (e) { console.error("[world place]", e); }
                }).catch(e => console.warn("[world] place model", e));
            }
            // colliders are known up front (model-local metres → world)
            for (const c of place.colliders ? place.colliders(spot) : []) chunk.addCollider(Object.assign({ kind: "prop" }, c));
        }
    }
});

/** Model-local (three.js metres, +Z = toward the road) → world, for a spot. */
export function local(spot, x, z, out = {}) {
    const c = Math.cos(spot.rot), s = Math.sin(spot.rot);
    out.x = spot.x + x * c + z * s;
    out.z = spot.z - x * s + z * c;
    return out;
}

// ── pulling in ──────────────────────────────────────────────────────────
function inBay(spot) {
    const car = ctx.car, b = spot.place.bay;
    if (Math.abs(car.s - spot.s) > b.half) return false;
    const d = car.d * spot.place.side;
    return d >= b.d0 && d <= b.d1;
}
function canVisit() {
    const G = ctx.G;
    if (ctx.state !== "playing" || !ctx.enabled("world") || G.ended || G.tutorial) return false;
    if (ctx.party && ctx.party.active) return false;
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted > 0)) return false;
    if (ctx.foot && ctx.foot.active) return false;
    return true;
}
function clearPrompt() { if (V.prompt) { H.prompt(""); V.prompt = false; } }
function leaveBay() {
    if (V.ownNoPull) { ctx.G.noPullOver = false; V.ownNoPull = false; }
    V.inside = null; V.still = 0;
    clearPrompt();
}

hook("update", (dt, P, controlsOn) => {
    if (!controlsOn || !canVisit()) { if (V.inside) leaveBay(); return; }
    const car = ctx.car;
    let found = null;
    for (const sp of SPOTS.values()) {
        if (Math.abs(car.s - sp.s) > 30) continue;
        if (!V.visited.has(sp.key) && inBay(sp)) { found = sp; break; }
    }
    if (found !== V.inside) { leaveBay(); V.inside = found; }
    if (!found) return;
    // in the bay: no parking-minigame prompt here, a small hint, and STOP to visit
    if (!ctx.G.noPullOver) { ctx.G.noPullOver = true; V.ownNoPull = true; }
    if (car.speed > 1.2) {
        V.still = 0;
        if (!V.prompt) { H.prompt(`🛑 Stop here · ${found.place.icon} ${found.place.verb || found.place.name}`); V.prompt = true; }
        return;
    }
    V.still += dt;
    if (V.still > 0.35) { leaveBay(); visit(found); }
}, -20);

on("run:start", () => { V.visited.clear(); leaveBay(); warm(); });
on("state", ({ to }) => { if (to !== "playing" && to !== "worldVisit" && V.inside) leaveBay(); });

function warm() {
    if (!ctx.enabled("world") || modeNow() !== "cruise") return;
    const keys = [...new Set([...PLACES.values()].map(p => p.model).filter(Boolean).concat(["npcMan"]))];
    ensureModels(keys).catch(() => {});
}

/** Start the visit beat at a spot (also the test hook). */
export function visit(spot) {
    V.visited.add(spot.key);
    V.spot = spot; V.t = 0; V.beat = 0; V.said = false;
    saved.visits[spot.place.id] = (saved.visits[spot.place.id] || 0) + 1;
    saveSoon();
    emit("stat", { id: "placeVisits", n: 1 });
    emit("world:visit", { id: spot.place.id, s: spot.s });
    setState("worldVisit", { spot: spot.key });
}

registerState("worldVisit", {
    hud: false, touch: false, pausable: true, driving: false, world: true,
    skip: true,
    enter() {
        const car = ctx.car;
        car.vx = car.vz = car.vF = car.vR = car.spin = 0;
        A.updateEngine(0, 0, 0, 0, false, false);
        if (ctx.cam) ctx.cam.snap();
        V.camPos = ctx.camera.position.clone();
        V.camLook = ctx.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(12).add(ctx.camera.position);
    },
    update(dt, P) {
        const sp = V.spot, car = ctx.car;
        if (!sp) { setState("playing"); return; }
        V.t += dt;
        car.vx = car.vz = car.vF = car.vR = 0;
        car.updateVisual(dt, ctx.time, { steer: 0, throttle: 0, brake: 0.4, handbrake: false }, false);
        const beats = sp.place.beats;
        while (V.beat < beats.length && V.t >= beats[V.beat].t) {
            try { beats[V.beat].run(sp); } catch (e) { console.error("[world visit]", e); }
            V.beat++;
        }
        for (const p of sp.people || []) p.update(dt, p.mood || {});
        if (V.t >= sp.place.dur) { V.spot = null; setState("playing"); }
    },
    camera(dt) {
        const sp = V.spot, cam = ctx.camera;
        if (!sp) return false;
        if (sp.place.cam) sp.place.cam(sp, V.t, v1, v2);
        else {
            const road = ctx.world.road, p = road.point(sp.s - 9, 3.5, {}), hp = sp.place.host ? sp.place.host(sp) : { x: sp.x, y: 1.4, z: sp.z };
            v1.set(p.x, 3.2, p.z);
            v2.set((ctx.car.pos.x + hp.x) / 2, 1.4, (ctx.car.pos.z + hp.z) / 2);
        }
        const k = Math.min(1, dt * 2.4);
        V.camPos.lerp(v1, k); V.camLook.lerp(v2, k);
        cam.position.copy(V.camPos);
        cam.lookAt(V.camLook);
        cam.fov += (54 + (cam.aspect < 1 ? 14 : 0) - cam.fov) * Math.min(1, dt * 2);
        cam.updateProjectionMatrix();
        return true;
    },
    exit() { if (ctx.cam) { ctx.cam.state.pos.copy(ctx.camera.position); ctx.cam.state.yaw = ctx.car.h; ctx.cam.state.snap = false; } },
});

// ── the places ──────────────────────────────────────────────────────────
const hostObj = sp => {
    if (sp.people && sp.people[0]) return sp.people[0].obj;
    if (!sp.hostDummy) { sp.hostDummy = new THREE.Object3D(); const h = sp.place.host ? sp.place.host(sp) : { x: sp.x, y: 1.4, z: sp.z }; sp.hostDummy.position.set(h.x, 0, h.z); sp.chunk.add(sp.hostDummy); }
    return sp.hostDummy;
};

// ⛽ Gas 'n' Go — Yanky fills the tank (nitro to full) and hands over a rugelach (+1 ❤️ if she's hurt)
addPlace({
    id: "gas", name: "Gas 'n' Go", icon: "⛽", verb: "fill up at Gas 'n' Go", model: "world_gas",
    where: mode => mode === "cruise" ? GAS_AT : [],
    d: 15.2, bay: { half: 9, d0: 8.6, d1: 14.6 },
    sign: { lines: ["GAS 'N' GO", "NEXT RIGHT"], bg: "#E53935" },
    colliders: sp => {
        const out = [];
        for (const x of [-4, -2, 0, 2, 4]) out.push(Object.assign(local(sp, x, 0.4), { r: 0.62 }));
        for (const x of [-6.5, 6.5]) out.push(Object.assign(local(sp, x, 1.4), { r: 0.32 }));
        for (const x of [-1.6, 1.5, 4.6]) out.push(Object.assign(local(sp, x, -5.3), { r: 2.3, kind: "house" }));
        out.push(Object.assign(local(sp, 8.6, 5.4), { r: 0.3, kind: "sign" }));
        return out;
    },
    built(sp, chunk) {
        ensureModels(["npcMan"]).then(() => {
            if (deadChunks.has(chunk) || !SPOTS.has(sp.key)) return;
            const p = spawnPerson("npcMan", { colors: { Top: "#E53935", Bottom: "#37474F", Hair: "#3E2723" } });
            const a = sp.anchors.attendant || local(sp, -1.2, -0.35);
            p.obj.position.set(a.x, 0.22, a.z);
            p.obj.rotation.y = sp.rot;
            p.mood = { talk: false };
            chunk.add(p.obj);
            sp.people.push(p);
            let last = 0;
            chunk.onAnimate(t => { const dt = Math.min(0.1, t - last); last = t; if (ctx.state !== "worldVisit") p.update(dt, { wave: Math.sin(t * 0.5) > 0.9 }); });
        }).catch(() => {});
    },
    host: sp => sp.anchors.attendant || Object.assign(local(sp, -1.2, -0.35), { y: 1.5 }),
    dur: 3.6,
    beats: [
        { t: 0.25, run: sp => { if (sp.people[0]) sp.people[0].mood = { talk: true }; sayAt(pick(["Fill 'er up? Nitro's on the house. The rugelach is two dollars.", "Yanky's Gas 'n' Go! Premium, regular, or 'Ima's paying'?", "You again! Your mother called. Twice. Here — free squeegee."]), hostObj(sp), { who: "Yanky" }); } },
        { t: 1.5, run: () => {
            const G = ctx.G;
            G.boost = 1;
            if (G.hearts < G.maxHearts) { heal(1); H.toast("🥐 Rugelach! +1 ❤️ · ⛽ nitro full", "pink"); }
            else { addScore(100, "gas"); H.toast("⛽ Tank full — nitro topped up! +100", "gold"); }
            if (!ctx.skipping) A.sfxCoin(4);
            rumble(0.1, 0.3, 120);
            emit("stat", { id: "gasStops", n: 1 });
        } },
        { t: 2.1, run: sp => { if (sp.people[0]) sp.people[0].mood = { wave: true }; luluLine(pick(["Put it on Ima's card. She'll never know. She'll know.", "Thanks Yanky! Tell your wife the kugel was 10/10.", "A full tank and a rugelach. Living the dream."])); } },
    ],
});

// 🌄 The Lookout — pull in, the camera drifts out over the lake, Lulu has a moment
addPlace({
    id: "lookout", name: "the Lookout", icon: "🌄", verb: "take in the view", model: "world_lookout",
    where: mode => mode === "cruise" ? LOOK_AT : [],
    d: 15.2, bay: { half: 7.5, d0: 8.6, d1: 16 },
    sign: { lines: ["SCENIC", "LOOKOUT", "NEXT RIGHT"], bg: "#6D4C41" },
    colliders: sp => {
        const out = [];
        for (let x = -8; x <= 8; x += 2) out.push(Object.assign(local(sp, x, -2.4), { r: 0.28, kind: "pole" }));
        out.push(Object.assign(local(sp, -3.5, -1.5), { r: 1.0 }), Object.assign(local(sp, 3, -1.6), { r: 0.4, kind: "pole" }));
        out.push(Object.assign(local(sp, -6.6, 5.6), { r: 0.3, kind: "sign" }));
        return out;
    },
    dur: 4.2,
    cam(sp, t, pos, look) {
        // from behind the car, out over the fence to the lake and the hills, panning slowly
        const back = local(sp, 0, 8.5), view = sp.anchors.view || Object.assign(local(sp, 0, -30), { y: 2 });
        const pan = (ease(t / 4.2) - 0.5) * 14;
        const vv = local(sp, pan, -30);
        pos.set(back.x, 4.2 - ease(t / 4.2) * 0.8, back.z);
        look.set(vv.x, 2.5, vv.z);
        return view;
    },
    beats: [
        { t: 0.8, run: () => luluLine(pick(["Okay. Okay, that's actually gorgeous.", "Lakewood looks so small from up here. And so loud.", "Five minutes of peace. Nobody call me. …Ima's calling."])) },
        { t: 2.2, run: () => {
            addScore(150, "lookout");
            H.toast("🌄 What a view! +150", "gold");
            emit("stat", { id: "lookouts", n: 1 });
            if (!saved.photoTip && ctx.play) { saved.photoTip = true; saveSoon(); H.toast(`📸 Tip: pause → Photo mode for a postcard`, ""); }
        } },
    ],
});

// 🏡 The family's driveways (journey builds the houses along the one road; in Cruise you can drop in)
const FAMILY = {
    bubbe: { who: "Bubbe", host: [3.2, 15.6], lines: ["Lululeh! Driving PAST?! Take a kugel. TAKE IT.", "You look thin. Here — for the road. Don't argue."],
        reward() { const G = ctx.G; if (G.hearts < G.maxHearts) { heal(1); H.toast("🍲 Bubbe's kugel: +1 ❤️", "pink"); } else { addCoins(20, "bubbe"); H.toast("👵 Bubbe slipped you +20 coins", "gold"); } },
        reply: ["Love you Bubbe! I'll call! (I won't call.)", "Bubbe, I literally just ate. …Fine."] },
    heshy: { who: "Heshy", host: [0, 21], lines: ["CANNONBAAALL! …oh hey Lulu! Towel? Floatie? Snack?", "Lulu! Fountain research update: still researching."],
        reward() { ctx.G.boost = 1; H.toast("🛟 Heshy's floatie of power: nitro full", "pink"); },
        reply: ["Heshy, you're dripping on my CAR.", "Love the energy. Hate the splash zone."] },
    beach: { who: "The beach", host: [0, 20], lines: ["*seagulls* SKRAAA. SKRAAAA."],
        reward() { addScore(120, "beach"); H.toast("🏖️ Sea air: +120", "gold"); },
        reply: ["Salt air. Zero traffic. I'm never leaving. (Leaving in 3 seconds.)"] },
    avigail: { who: "Avigail", host: [2.5, 16], lines: ["Oh. You just… stopped by? Cute. 💅", "Bestie!! I was JUST talking about you. Nicely. Mostly."],
        reward() { if (ctx.avigail && ctx.avigail.bump) ctx.avigail.bump(2); H.toast("💅 Avigail +2 💜", "pink"); },
        reply: ["Love the nails. Gotta run!", "Spritzers later? Spritzers later."] },
    vegas: { who: "Uncle Burry", host: [2, 18], lines: ["LULU! Drove all this way to say hi?! Here — a chip for luck! 🎲"],
        reward() { addCoins(25, "burry"); H.toast("🎲 Uncle Burry's lucky chip: +25 coins", "gold"); },
        reply: ["Don't tell Bubbe about the chip.", "Love you, Uncle Burry. Wear sunscreen."] },
};
function familyStops(mode) {
    if (mode !== "cruise" || !ctx.journey || !ctx.journey.stopS || !ctx.journey.stops) return [];
    return ctx.journey.stops.map((st, i) => ({ id: st.id, s: ctx.journey.stopS(i) })).filter(x => FAMILY[x.id]);
}
for (const id of Object.keys(FAMILY)) {
    const F = FAMILY[id];
    addPlace({
        id: "family_" + id, kind: "family", name: F.who === "The beach" ? "the beach" : `${F.who}'s`, icon: "🏡", verb: F.who === "The beach" ? "stop at the beach" : `drop in on ${F.who}`,
        where: mode => familyStops(mode).filter(x => x.id === id).map(x => x.s),
        d: 12, bay: { half: 4.2, d0: 8.4, d1: 15.5 },
        host: sp => { const p = ctx.world.road.point(sp.s + F.host[0], F.host[1], {}); return { x: p.x, y: 1.6, z: p.z }; },
        dur: 3.6,
        beats: [
            { t: 0.3, run: sp => sayAt(pick(F.lines), hostObj(sp), { who: F.who }) },
            { t: 1.6, run: sp => { F.reward(); emit("stat", { id: "familyVisits", n: 1 }); if (!ctx.skipping) A.sfxCoin(3); } },
            { t: 2.2, run: () => luluLine(pick(F.reply)) },
        ],
    });
}

// ── service ─────────────────────────────────────────────────────────────
export const placesApi = {
    add: addPlace,
    get: id => PLACES.get(id) || null,
    list: () => [...PLACES.values()].map(p => ({ id: p.id, name: p.name, icon: p.icon, kind: p.kind })),
    /** Live spots near the car (built chunks): [{key, id, s, d}] */
    spots: () => [...SPOTS.values()].map(s => ({ key: s.key, id: s.place.id, s: s.s, built: !!s.obj })),
    /** Where place `id` is in the current mode (metres along the road). */
    at: id => { const p = PLACES.get(id); return p ? positions(p, modeNow()) : []; },
    visits: id => saved.visits[id] || 0,
    get inside() { return V.inside ? V.inside.place.id : null; },
    visit: key => { const sp = SPOTS.get(key); if (!sp) return false; visit(sp); return true; },
};

/** Keep the clear stretches for the fixed spots (trees off the bay + the lake). */
export function reservePlaces(world) {
    for (const s of GAS_AT) world.reserve(s - 14, s + 14, 1, 8.5, 30);
    for (const s of LOOK_AT) world.reserve(s - 80, s + 80, 1, 8.5, 170);
}
