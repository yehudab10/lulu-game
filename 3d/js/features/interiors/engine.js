// interiors/engine.js — the shared runtime for every on-foot interior.
//
// An interior is a def (bar.js, school.js…) handed to defineInterior(). This
// file registers it as ctx.interiors[id] = { name, emoji, enter({ exit }) } and,
// when Lulu walks in, builds a Room: the Blender set (with its Spot_/Col_/
// Light_/Fx_ anchors), Lulu in third person, the characters, the hotspots she
// can use with ✕ / E / ✋, a follow camera, particles, speech bubbles, and the
// fade in/out. Leaving disposes everything and calls the caller's exit().
//
// def = {
//   id, name, short, emoji, title, model, models: [...], music, light, sky, fog,
//   bounds: { x0, x1, z0, z1 }, cam: { dist, height } (ci/doors: only a HINT now — see the camera below; cam.fixed:
//   true keeps the old from-above follow), ceil (m, the camera stays under it; default 3.0), ground?(x, z) → y,
//   build(rt), tick?(rt, dt), beforeLeave?(rt) → Promise (e.g. the precinct sneak-out)
// }
import * as THREE from "three";
import { ctx, registerState, setState, emit, on, css, wrapAngle } from "../../core/ctx.js";
import { makeSet } from "../../core/sets.js";
import { store, saveSoon, shared, wallet, save3d } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { dissolve } from "../../core/transition.js";
import { models, ensureModels, registerModels, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say, choose, isOpen as dialogIsOpen, closeDialog } from "../../core/dialog.js";
import { input, glyph, addTouchButton } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { Particles, Bubbles, sfx, tone } from "./fx.js";

// Lazy models: every set, the props, and the new cast. Nothing here is needed to drive.
registerModels({
    interiorsBar: "interiors_bar", interiorsSchool: "interiors_school", interiorsHospital: "interiors_hospital",
    interiorsPolice: "interiors_police", interiorsBeach: "interiors_beach", interiorsProps: "interiors_props",
    interiorsBartender: "interiors_bartender", interiorsBouncer: "interiors_bouncer", interiorsMorah: "interiors_morah",
    interiorsChederKid: "interiors_cheder_kid", interiorsDoctor: "interiors_doctor", interiorsPerp: "interiors_perp",
    interiorsLifeguard: "interiors_lifeguard", interiorsIceCream: "interiors_icecream",
});

/** This feature's own save: visit counts and mini-activity bests. */
export const S = store("interiors", { visits: {}, danceBest: 0, castles: 0 });
/** The one-off reward flags (`rt.used`), per interior, for the whole RUN: walking out and back in doesn't refill
 *  the free coffee / seltzer / ice cream (that was an endless coin loop). A new run starts them fresh. */
const RUN_USED = {};
on("run:start", () => { for (const k of Object.keys(RUN_USED)) delete RUN_USED[k]; });
/** …and the one-off COIN rewards (rt.onceToday) are once per REAL day (device-local date), saved: ↺ Restart / a reload /
 *  ⌂ title → ▶ PLAY start a new run, so "once a run" alone was still a coin tap (the precinct's free coffee: +30 a lap). */
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function dailyUsed() {
    if (!S.daily || typeof S.daily !== "object" || S.daily.day !== dayKey() || !S.daily.used) { S.daily = { day: dayKey(), used: {} }; saveSoon(); }
    return S.daily.used;
}

export const GOLD = ["#FFD700", "#FFE082", "#FFF59D", "#FFB300"];
export const CONFETTI = ["#FF4081", "#40C4FF", "#FFD740", "#7C4DFF", "#69F0AE"];
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** A line pool that never repeats the previous pick (the 2D polPickLine). */
export function pool(lines) {
    let last = -1;
    return () => {
        let i = Math.floor(Math.random() * lines.length);
        if (lines.length > 1 && i === last) i = (i + 1) % lines.length;
        last = i;
        return lines[i];
    };
}

// test-only knobs (scripts/tests3d/interiors.js forces random outcomes through these)
export const force = {};
if (ctx.TEST) window.__interiors = { force, get room() { return cur; }, S };

// ── DOM: fade curtain, title chip ────────────────────────────────────────
css("interiors", `
#intFade { position: fixed; inset: 0; background: #0d0710; opacity: 0; pointer-events: none; display: flex; align-items: center;
  justify-content: center; color: #fff; font: 700 30px var(--font); letter-spacing: .04em; }
#intFade.on { pointer-events: auto; }
body.lulu-interior #hud .hud-top, body.lulu-interior #hud .hud-br, body.lulu-interior #hud .pill.score { display: none !important; }
body.lulu-interior #touch .pedals { display: none !important; }
body.lulu-interior #stickZone span { visibility: hidden; }
.int-chip { display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
.int-title { background: rgba(43,27,46,.78); color: #FFE082; border-radius: 999px; padding: 6px 18px; font-weight: 700; font-size: 16px;
  letter-spacing: .04em; white-space: nowrap; box-shadow: 0 3px 0 rgba(0,0,0,.2); }
.int-hint { background: rgba(255,248,238,.9); color: var(--ink); border-radius: 999px; padding: 4px 14px; font-weight: 600; font-size: 13px;
  white-space: nowrap; transition: opacity .6s; }
.int-hint.gone { opacity: 0; }
.int-meter { background: rgba(43,27,46,.82); color: #fff; border-radius: 16px; padding: 6px 14px; font-weight: 700; font-size: 15px; text-align: center; }
.int-meter .bar { margin-top: 5px; height: 7px; width: 150px; border-radius: 99px; background: rgba(255,255,255,.2); overflow: hidden; }
.int-meter .bar i { display: block; height: 100%; background: linear-gradient(90deg, #FFD740, #FF4081); }
.int-beat { width: 64px; height: 64px; border-radius: 50%; border: 5px solid #FFD740; display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: 700; color: #fff; background: rgba(43,27,46,.6); }
.int-caption { background: rgba(43,27,46,.88); color: #FFE082; border-radius: 18px; padding: 10px 20px; font-weight: 700; font-size: 18px;
  max-width: min(640px, 88vw); text-align: center; white-space: normal; }
@media (max-width: 560px) { .int-title { font-size: 13px; padding: 5px 12px; } .int-hint { font-size: 11px; } .int-caption { font-size: 15px; } }
body.tv .int-title { font-size: 26px; padding: 10px 28px; } body.tv .int-hint { font-size: 20px; padding: 6px 20px; }
body.tv .int-meter { font-size: 24px; } body.tv .int-caption { font-size: 28px; } body.tv .int-beat { width: 96px; height: 96px; font-size: 40px; }
`);
const fade = document.createElement("div");
fade.id = "intFade";
document.body.insertBefore(fade, document.getElementById("screen"));   // under menus + dialogue, over the HUD
function setFade(v, text) {
    fade.style.transition = "none";
    fade.style.opacity = String(v);
    fade.classList.toggle("on", v > 0.5);
    if (text !== undefined) fade.textContent = text;
}
function fadeAway() { fade.style.transition = "opacity .35s"; fade.style.opacity = "0"; fade.classList.remove("on"); }

// ── touch buttons (shown only inside) ────────────────────────────────────
addTouchButton({ id: "intTalk", emoji: "✋", label: "USE", action: "interact", visible: () => !!(cur && cur.ready && cur.near && !cur.busy) });
addTouchButton({ id: "intLeave", emoji: "🚪", label: "LEAVE", action: "back", visible: () => !!(cur && cur.ready && !cur.busy && !cur.leaving) });

// ── registry + state ─────────────────────────────────────────────────────
let cur = null;           // the Room Lulu is in
let prevStick2d = false;
export const current = () => cur;
// keep the controls hint in step with whatever the player picks up (pad ↔ keys ↔ touch)
on("device", () => { const h = cur && cur.chip && cur.chip.querySelector(".int-hint"); if (h) h.innerHTML = cur.hintHtml(); });

/** Register an interior: ctx.interiors[def.id] = { name, emoji, enter({ exit }), warm(), ready() }. */
export function defineInterior(def) {
    ctx.interiors[def.id] = {
        name: def.name, emoji: def.emoji,
        enter(opts = {}) { return enterInterior(def, opts); },
        /** Fetch its models ahead of time (she's walking up to the door): the step inside is then a SOFT CUT — the
         *  street melts into the room — instead of a black screen. Safe to call again and again. → a promise */
        warm() {
            const hair = shared.get().luluHairStyle || "";
            if (def._warm && def._warmHair === hair) return def._warm;
            def._warmHair = hair; def._warmed = null;
            const hairP = hair ? ensureModels(["luluPerson_" + hair]).catch(() => { /* not a registered style */ }) : Promise.resolve();
            const p = def._warm = Promise.all([ensureModels([def.model, "interiorsProps", "luluPerson", ...(def.models || [])]), hairP])
                .then(() => { if (def._warm === p) def._warmed = hair; })
                .catch(() => { if (def._warm === p) def._warm = null; });
            return p;
        },
        /** Is everything it needs loaded right now (warm() finished for the hair she has today)? */
        ready() { return def._warmed === (shared.get().luluHairStyle || "") && roomKeys(def).all.every(k => !!models[k]); },
    };
    return def;
}
/** The models a room needs; Lulu's own hair style when that model is loaded. */
function roomKeys(def) {
    const s2 = shared.get(), hk = s2.luluHairStyle ? "luluPerson_" + s2.luluHairStyle : null;
    const luluKey = hk && models[hk] ? hk : "luluPerson";
    return { s2, luluKey, all: [def.model, "interiorsProps", luluKey, ...(def.models || [])] };
}

function enterInterior(def, opts) {
    if (cur) { console.warn("[interiors] already inside", cur.def.id); return false; }
    cur = new Room(def, opts || {});
    const room = cur;
    // ci/doors stage 2: she WALKED into the doorway (features/foot walkIn) and the room is built-ready → no fade at all:
    // the swap happens on this frame, the free camera carried over (same pitch; behind her, as she faces in)
    if (ctx.foot && ctx.foot.walkingIn && ctx.interiors[def.id].ready()) {
        room.walked = true;
        setState("interior", { id: def.id });
        if (room.loadNow() || room.disposed) return true;
        room.load();
        return true;
    }
    // Everything's loaded (the door warmed it): a SOFT CUT — the frame of the street melts into the room, no black.
    if (!ctx.skipping && ctx.interiors[def.id].ready()) {
        let ok = false;
        dissolve(() => { setState("interior", { id: def.id }); ok = room.loadNow(); });
        if (ok || room.disposed) return true;
        room.load();          // (couldn't build in place: the loading path, behind its fade)
        return true;
    }
    setState("interior", { id: def.id });
    cur.load();
    return true;
}

registerState("interior", {
    hud: true, touch: true, pausable: true, world: false, driving: false,
    enter() {
        document.body.classList.add("lulu-interior");
        prevStick2d = !!input.stick2d;
        input.stick2d = true;
        H.padHint("");
    },
    exit() {
        document.body.classList.remove("lulu-interior");
        input.stick2d = prevStick2d;
        H.prompt("");
        if (cur) { const r = cur; cur = null; r.dispose(); fadeAway(); }
    },
    update(dt, P) { if (cur) cur.update(dt, P); },
});

// ── the Room ─────────────────────────────────────────────────────────────
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
/**
 * 🎥 THE SAME CAMERA INSIDE AS OUTSIDE (ci/doors stage 1; the owner: "make all buildings walkable like in the same pov
 * as it is now on foot rather then the above pov"). Every room is seen and steered exactly as on foot outdoors: the free
 * third-person rig of core/camera.js (`ctx.cam.orbit` on the room's own camera — the same yaw / pitch, look speed,
 * invert, stick directions; up on the stick = away from the camera; run = the boost / a full push). Done ONCE here, so
 * no room def changes:
 *   • the camera never leaves the room: clipped to the room's box (bounds + the wall's thickness) and under its ceiling,
 *     pulled in toward her rather than through a wall (no lift over her head — there's a ceiling);
 *   • anything small enough to be furniture / a partition / a pillar that stands between the camera and her fades out
 *     (a ray from her head to the lens every other frame; the room's big shell meshes are never faded);
 *   • a chat / a look-at (rt.active, rt.focusAt) turns the camera gently over her shoulder toward who she talks to;
 *   • a mini-game (rt.mode) and `def.cam.fixed` keep the old from-above follow (their framing is part of the game).
 */
const ORBIT = { dist: 4.6, look: 1.25, fov: 60, wall: 0.45, ceil: 3.0, fadeR: 2.6, fadeTo: 0.18 };
// her own see-through when the lens is close: [solid from (m), faded from (m)] per screen shape, and how faded (ci/sweep-phone)
const SELF_FADE = { portrait: [3.0, 1.9], land: [1.6, 1.0], to: 0.12 };
// …and in a chat / at someone's ✋ the camera sits this far (rad) off straight-behind, so she doesn't hide them
const SHOULDER = 0.45;
const RAY = new THREE.Raycaster(), RV = new THREE.Vector3(), RD = new THREE.Vector3(), RS = new THREE.Sphere();

export class Room {
    constructor(def, opts) {
        this.def = def;
        this.opts = opts;
        this.ready = false;
        this.disposed = false;
        this.t = 0;
        this.busy = false;
        this.lock = false;
        this.leaving = false;
        this.near = null;
        this.active = null;
        this.mode = null;
        this.people = [];
        this.byId = {};
        this.hots = [];
        this.timers = [];
        this.lightsList = [];
        this.vel = new THREE.Vector3();
        this.look = { x: 0, y: 0 };
        this.camLook = new THREE.Vector3();
        this.yaw = (def.cam && def.cam.yaw) || 0;
        this.luluPose = null;
        this.used = RUN_USED[def.id] || (RUN_USED[def.id] = {});   // one-off reward flags (the 2D barUsed / rewarded): once per interior per run
        const today = dailyUsed()[def.id];                          // (+ the coin ones already taken today: the labels / "again" lines agree)
        if (today) for (const k of Object.keys(today)) this.used[k] = true;
        this.data = {};          // scratch for the interior def
    }

    /** Everything is already loaded: build now — no fade (the caller's soft cut covers the frame). → built? */
    loadNow() {
        const k = roomKeys(this.def);
        if (!k.all.every(x => !!models[x])) return false;
        try { this.build(k.luluKey, k.s2); }
        catch (e) { console.error("[interiors] build", e); return false; }
        this.soft = true;            // (…and she leaves the same way)
        this.ready = true;
        this.fadeIn = 1;
        setFade(0, "");
        S.visits[this.def.id] = (S.visits[this.def.id] || 0) + 1;
        saveSoon();
        emit("stat", { id: "interiorVisits", n: 1 });
        emit("interior:enter", { id: this.def.id });
        return true;
    }
    async load() {
        setFade(1, `${this.def.emoji}`);
        const s2 = shared.get();
        let luluKey = "luluPerson";
        if (s2.luluHairStyle) {
            try { await ensureModels(["luluPerson_" + s2.luluHairStyle]); luluKey = "luluPerson_" + s2.luluHairStyle; } catch (e) { /* not a registered style */ }
        }
        try {
            await ensureModels([this.def.model, "interiorsProps", luluKey, ...(this.def.models || [])]);
        } catch (e) {
            console.error("[interiors] models", e);
            if (this.disposed) return;
            H.toast("🚪 The door's stuck!", "red");
            this.leaving = true; this.leaveT = 1; this.finishLeave();
            return;
        }
        if (this.disposed) return;
        try { this.build(luluKey, s2); }
        catch (e) {
            console.error("[interiors] build", e);
            this.finishLeave();
            return;
        }
        this.ready = true;
        this.fadeIn = 0;
        S.visits[this.def.id] = (S.visits[this.def.id] || 0) + 1;
        saveSoon();
        emit("stat", { id: "interiorVisits", n: 1 });
        emit("interior:enter", { id: this.def.id });
    }

    build(luluKey, s2) {
        const def = this.def;
        const set = this.set = makeSet({ light: def.light || "indoor", sky: def.sky, fog: def.fog });
        if (def.fov) { set.camera.fov = def.fov; set.camera.updateProjectionMatrix(); }
        const root = this.root = models[def.model].clone(true);
        set.add(root);
        set.show();
        if (def.outdoor && ctx.atmos && ctx.atmos.dress) ctx.atmos.dress(set);    // the beach at night is the beach at night
        root.updateMatrixWorld(true);
        this.spots = {}; this.cols = []; this.fxs = {}; this.lightSpots = {};
        root.traverse(o => {
            const n = o.name || "";
            if (!/^(Spot|Col|Light|Fx)_/.test(n)) return;
            o.getWorldPosition(V);
            // (sets built in one Blender session get ".001"-style duplicate suffixes → "Spot_door001")
            const key = n.slice(n.indexOf("_") + 1).replace(/\.?\d{3}$/, "");
            if (n.startsWith("Spot_")) this.spots[key] = { x: V.x, y: V.y, z: V.z, ry: o.rotation.y };
            else if (n.startsWith("Fx_")) this.fxs[key] = { x: V.x, y: V.y, z: V.z, ry: o.rotation.y, node: o };
            else if (n.startsWith("Light_")) this.lightSpots[key] = V.clone();
            else this.cols.push({ id: key, x0: V.x - o.scale.x, x1: V.x + o.scale.x, z0: V.z - o.scale.z, z1: V.z + o.scale.z, on: true });
        });
        this.particles = new Particles(set);
        this.bubbles = new Bubbles(set);
        this.bounds = def.bounds || { x0: -7, x1: 7, z0: -4.5, z1: 4.5 };

        // Lulu
        this.lulu = spawnPerson(luluKey, { colors: s2.luluHair ? { Hair: s2.luluHair } : null });
        const sp = this.spots.lulu || this.spots.door || { x: 0, z: 0, ry: 0 };
        this.lulu.obj.position.set(sp.x, this.groundAt(sp.x, sp.z), sp.z);
        this.lulu.obj.rotation.y = sp.ry;
        set.add(this.lulu.obj);

        // HUD chip
        const slot = H.hudSlot("center");
        this.chip = document.createElement("div");
        this.chip.className = "int-chip";
        this.chip.innerHTML = `<div class="int-title">${def.title}</div><div class="int-hint">${this.hintHtml()}</div><div class="int-extra"></div>`;
        slot.appendChild(this.chip);
        this.extraEl = this.chip.querySelector(".int-extra");

        // (the street's flavour banners stay outside — the town's WELCOME, a shop's title — this room's own are next)
        if (H.dropBanners) H.dropBanners(b => b.prio <= 1);
        def.build(this);
        // a door hotspot for every interior
        if (this.spots.door && !this.hots.some(h => h.id === "door")) {
            this.hot({ id: "door", spot: "door", r: 1.5, label: `🚪 Leave ${def.short || def.name}`, action: rt => rt.leave() });
        }
        if (def.music) A.setMusic(def.music);
        // (the free camera starts behind her as she comes in through the door, at the pitch it had outside — ci/doors)
        if (this.orbitOn() && ctx.cam && ctx.cam.free) { ctx.cam.free.yaw = this.lulu.obj.rotation.y; ctx.cam.free.release(); }
        // the way out (stage 2): walking back into the door spot, heading out, IS leaving — armed once she's stepped in
        const dsp = this.spots.door;
        if (dsp) {
            const B = this.bounds, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, ox = dsp.x - cx, oz = dsp.z - cz;
            // (out = from the middle of the room toward the door, along the wall's axis)
            this.out = Math.abs(ox) / Math.max(1, B.x1 - B.x0) > Math.abs(oz) / Math.max(1, B.z1 - B.z0) ? { x: Math.sign(ox), z: 0 } : { x: 0, z: Math.sign(oz) || 1 };
            this.outArmed = false;
        }
        this.updateCamera(0, true);
        H.banner(`${def.emoji} <b>${def.name}</b>${def.tagline ? `<small>${def.tagline}</small>` : ""}`, 2200, { key: "room" });
    }

    hintHtml() {
        if (input.device === "touch") return `🕹️ walk · ✋ use · 🚪 leave`;
        return `${glyph("move")} walk · ${glyph("interact")} use · ${glyph("back")} leave`;
    }

    // ── helpers the interior defs use ──
    spot(name) { return this.spots[name] || null; }
    fx(name) { return this.fxs[name] || null; }
    node(name) { return findNodes(this.root, name)[0] || null; }
    add(obj) { this.set.add(obj); (this.built || (this.built = [])).push(obj); return obj; }
    /** What the camera's rays see of the room: its model AND everything its def built in code (rt.add — the houses, the
     *  clothes shop, the lanes… are code-built: before, the lens went through their walls / their front door filled a
     *  phone with one flat colour, and nothing of theirs ever faded). → [Object3D] */
    rayRoots() {
        // (only what's still in the scene: a room that merges its boxes — City Hall's bake() — takes the originals out)
        if (this.built && this.built.some(o => !o.parent)) this.built = this.built.filter(o => o.parent);
        RAY.camera = this.set.camera;
        return this.built && this.built.length ? [this.root, ...this.built] : [this.root];
    }
    own(...x) { return this.set.own(...x); }
    groundAt(x, z) { return this.def.ground ? this.def.ground(x, z) : 0; }

    /** A clone of a prop from interiors_props (Prop_<name>). */
    prop(name) {
        const src = findNodes(models.interiorsProps, "Prop_" + name)[0];
        if (!src) return new THREE.Group();
        const c = src.clone(true);
        c.position.set(0, 0, 0);
        return c;
    }
    /** Put a prop in someone's right hand (Arm_R pivot is the shoulder; the hand is 0.44 m down). */
    hold(person, propName, { arm = "Arm_R", y = -0.47, z = 0.04, rx = 0 } = {}) {
        const a = person.limbs[arm];
        const pr = typeof propName === "string" ? this.prop(propName) : propName;
        pr.position.set(0, y, z);
        pr.rotation.x = rx;
        if (a) a.add(pr);
        return pr;
    }

    /** Lulu holds one thing at a time (a seltzer, a cone, a coffee…). null empties her hand. */
    luluHold(name, opts) {
        if (this.inHand) this.inHand.removeFromParent();
        this.inHand = name ? this.hold(this.lulu, name, opts) : null;
        this.inHandName = name || null;
        return this.inHand;
    }

    /** A point light at Light_<name>. optional lights are skipped (kept off-scene) on low quality / consoles. */
    pointLight(name, color, intensity = 6, distance = 9, decay = 1.6, optional = false) {
        const at = this.lightSpots[name];
        const l = new THREE.PointLight(color, intensity, distance, decay);
        if (at) l.position.copy(at);
        const q = save3d.settings.quality, pf = ctx.platform || {};
        const low = ctx.gfx ? ctx.gfx.tier === "low" : q === "low" || (q === "auto" && (pf.console || pf.tv));
        if (optional && low) return l;
        this.set.add(l);
        this.lightsList.push(l);
        return l;
    }

    /**
     * Add a character at a Spot_. opts: colors, scale, pose {sit, talk…}, y (lift), collide (default true),
     * faceLulu (default true), r (collision radius), post(person, dt, t) for custom limb poses.
     */
    person(id, key, spotName, opts = {}) {
        const s = typeof spotName === "string" ? (this.spots[spotName] || { x: 0, z: 0, ry: 0 }) : spotName;
        const p = spawnPerson(key, { colors: opts.colors || null, scale: opts.scale || 1 });
        p.obj.position.set(s.x, (opts.y || 0) + (s.y || 0), s.z);
        p.obj.rotation.y = s.ry || 0;
        this.set.add(p.obj);
        const rec = { id, p, pose: opts.pose || {}, home: { x: s.x, z: s.z, ry: s.ry || 0 }, collide: opts.collide !== false,
            r: opts.r || 0.38, faceLulu: opts.faceLulu !== false, post: opts.post || null, name: opts.name || id, stool: !!opts.stool };
        this.people.push(rec);
        this.byId[id] = rec;
        return rec;
    }

    /** A hotspot: { id, spot | x,z, r, label (string | fn), who (person id), action(rt, h), enabled?() } */
    hot(h) {
        const s = h.spot ? this.spots[h.spot] : null;
        const rec = Object.assign({ r: 1.4 }, h);
        rec.x = h.x != null ? h.x : s ? s.x : 0;
        rec.z = h.z != null ? h.z : s ? s.z : 0;
        this.hots.push(rec);
        return rec;
    }

    /** Repeating ambient timer: fn(rt) every rand(min,max) s. gate=true → only when ctx.enabled("interiors"). */
    every(min, max, fn, { gate = true, first = null } = {}) {
        this.timers.push({ min, max, fn, gate, t: first != null ? first : rand(min, max) });
    }

    say(who, text, opts = {}) {
        if (this.disposed) return Promise.resolve(-1);
        if (opts.person) this.talker = opts.person;
        return say(who, String(text).replace(/\s*\n\s*/g, " "), opts).then(r => { this.talker = null; return r; });
    }
    choose(who, text, options, opts = {}) {
        if (this.disposed) return Promise.resolve(-1);
        if (opts.person) this.talker = opts.person;
        return choose(who, String(text).replace(/\s*\n\s*/g, " "), options, opts).then(r => { this.talker = null; return r; });
    }

    /** Coins: run coins + the shared wallet (the 2D footCoinsRun / runCoins / save.totalCoins). */
    coins(n, label, at) {
        addCoins(n, "interior:" + this.def.id);
        H.toast(label || `+${n} 💰`, "gold");
        sfx.coin();
        if (at) this.particles.burst(at, GOLD, 14, 2.2, 0.06);
        emit("stat", { id: "interiorCoins", n });
    }
    /** A one-off COIN reward (the free coffee / seltzer / ice cream…): true the first time today for this room + key,
     *  false after — for the rest of the real day, whatever the run. Sets rt.used[key] too. */
    onceToday(key) {
        if (this.used[key]) return false;
        this.used[key] = true;
        const u = dailyUsed(), m = u[this.def.id] || (u[this.def.id] = {});
        if (m[key]) return false;
        m[key] = true;
        saveSoon();
        return true;
    }
    /** ⭐ stars bank into the wallet, like the 2D footAwardStar(). */
    star(n = 1, label, at) {
        wallet.add(n);
        H.toast(label || `+${n} ⭐`, "gold");
        if (at) this.particles.burst(at, ["#FFD700", "#FFFFFF", "#FFF59D"], 10, 1.8, 0.05);
    }
    /** Spend from the wallet (2D chargeCoins). Returns true if paid. */
    pay(n) {
        const ok = wallet.spend(n);
        if (ok) { H.toast(`−${n} 💰`, "red"); tone(520, 0.08, "triangle", 0.1, 330); }
        return ok;
    }
    burst(at, colors = CONFETTI, n = 14, speed = 2.4, size = 0.06) { this.particles.burst(at, colors, n, speed, size); }
    bubble(text, at, secs, opts) { this.bubbles.say(text, at, secs, opts); }
    headOf(id) { const r = this.byId[id]; return r ? r.p.obj : null; }

    /** Walk Lulu to a point (cutscene-style). Resolves on arrival (or after maxT). */
    walkTo(x, z, maxT = 3) {
        return new Promise(res => { this.auto = { x, z, t: maxT, res }; });
    }
    /** Run a mode (mini-activity) that owns input until update(dt, P) returns true. */
    runMode(mode) {
        return new Promise(res => { this.mode = Object.assign({ done: res }, mode); if (mode.start) mode.start(this); });
    }
    wait(secs) { return new Promise(res => this.timers.push({ once: true, t: secs, fn: res, gate: false })); }

    // ── leaving ──
    async askLeave() {
        this.busy = true;
        const i = await this.choose(this.def.name, "Head back outside?", [`🚪 Leave ${this.def.short || ""}`.trim(), "💬 Stay a bit"], { emoji: this.def.emoji });
        this.busy = false;
        if (i === 0) this.leave();
    }
    async leave() {
        if (this.leaving || this.disposed) return;
        if (this.def.beforeLeave) {
            this.busy = true;
            try { await this.def.beforeLeave(this); } catch (e) { console.error("[interiors] beforeLeave", e); }
            this.busy = false;
            if (this.disposed) return;
        }
        this.leaving = true;
        this.leaveT = 0;
        H.prompt("");
        sfx.click();
    }
    finishLeave() {
        if (this.disposed) return;
        const cb = this.opts.exit;
        if (this.walkOut && this.opts.from === "foot" && ctx.foot && ctx.foot.stepOut) ctx.foot.stepOut();
        const id = this.def.id;
        if (cur === this) cur = null;
        this.dispose();
        if (this.soft || this.walkOut) setFade(0, ""); else { setFade(1); fadeAway(); }
        if (ctx.G) ctx.G.invT = Math.max(ctx.G.invT || 0, 2.0);   // 2D: a 2 s shield back on the street
        emit("interior:exit", { id });
        if (typeof cb === "function") {
            A.setMusic("../walking.mp3");
            try { cb(); } catch (e) { console.error("[interiors] exit callback", e); }
        }
        if (ctx.state === "interior") setState("title");
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.mode && this.mode.stop) { try { this.mode.stop(this); } catch (e) { console.error(e); } }
        if (this.def.dispose) { try { this.def.dispose(this); } catch (e) { console.error(e); } }
        if (this.chip) this.chip.remove();
        H.prompt("");
        if (dialogIsOpen()) closeDialog();   // never strand a half-read line on the next screen
        if (H.dropBanners) H.dropBanners(b => b.key === "room");      // (…nor its title banner in the next place)
        if (this.bubbles) this.bubbles.clear();
        if (this.faded) { for (const [o, f] of this.faded) { o.material = f.m0; for (const m of f.ms) m.dispose(); } this.faded.clear(); }
        this.fadeSelf(1, true);
        if (this.orbiting && ctx.cam && ctx.cam.free) ctx.cam.free.release();      // (outside, the street's rig starts fresh)
        if (this.set) {
            this.set.scene.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
            this.set.dispose();
        }
        A.duckMusic(0.32);
    }

    // ── per frame ──
    update(dt, P) {
        if (this.disposed) return;
        this.t += dt;
        if (!this.ready) return;
        // features/houseitems: the thing in her hand / her pepper / a rocket, in THIS room (not homes' houses: there the
        // item button is SNEAK) — a context of its own, or "no rockets indoors"
        if (P && (P.item || P.fire) && this.def.id !== "home" && ctx.houseitems && ctx.houseitems.inRoom) {
            try { if (ctx.houseitems.inRoom(this, P)) { P.item = false; P.fire = false; } } catch (e) { console.error("[interiors] houseitems", e); }
        }
        if (this.fadeIn < 1) {
            this.fadeIn = Math.min(1, this.fadeIn + dt / 0.45);
            setFade(1 - this.fadeIn, "");
        }
        if (this.t > 8 && this.chip) { const h = this.chip.querySelector(".int-hint"); if (h && !h.classList.contains("gone")) h.classList.add("gone"); }
        if (this.leaving) {
            // (she WALKED out of the door: the street, this frame — no fade; ci/doors)
            if (this.walkOut) { this.finishLeave(); return; }
            // (she came in by a soft cut: the room melts back into the street the same way)
            if (this.soft && !ctx.skipping) { dissolve(() => this.finishLeave()); return; }
            this.leaveT += dt;
            setFade(Math.min(1, this.leaveT / 0.4));
            if (this.leaveT >= 0.42) this.finishLeave();
            return;
        }
        if (this.mode) {
            let done = false;
            try { done = this.mode.update(this, dt, P); } catch (e) { console.error("[interiors mode]", e); done = true; }
            if (done) { const m = this.mode; this.mode = null; if (m.stop) m.stop(this); m.done(); }
            P = {};
        }
        this.updateLulu(dt);
        if (P.recentre && this.orbiting) ctx.cam.free.recentre(this.lulu.obj.rotation.y);     // (R3 / V: behind her, as outside)
        this.checkWalkOut();
        // input → hotspot / leave
        const free = !this.busy && !ctx.dialogOpen && !this.mode && !this.lock && !this.auto;
        this.near = free ? this.findNear() : null;
        if (free) {
            if (P.back) this.askLeave();
            else if ((P.interact || P.confirm) && this.near) this.use(this.near);
        }
        H.prompt(this.near ? `${glyph("interact")} ${typeof this.near.label === "function" ? this.near.label(this) : this.near.label}` : "");
        // characters
        const L = this.lulu.obj.position;
        for (const q of this.people) {
            const talking = this.talker === q && ctx.dialogOpen;
            const pose = Object.assign({}, q.pose, talking ? { talk: true } : null);
            if (q.faceLulu && !q.pose.sit && !q.pose.lie && (talking || (this.active && this.active.who === q.id))) q.p.face(L.x, L.z, dt, 5);
            q.p.update(dt, pose);
            if (q.stool && pose.sit) for (const k of ["Leg_L", "Leg_R"]) if (q.p.limbs[k]) q.p.limbs[k].rotateX(0.75);   // feet dangle off a bar stool
            if (q.post) q.post(q.p, dt, this.t, this);
        }
        if (this.def.tick) this.def.tick(this, dt);
        // timers
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const tm = this.timers[i];
            tm.t -= dt;
            if (tm.t > 0) continue;
            if (tm.once) { this.timers.splice(i, 1); tm.fn(); continue; }
            tm.t = rand(tm.min, tm.max);
            if (!tm.gate || ctx.enabled("interiors")) { try { tm.fn(this); } catch (e) { console.error("[interiors timer]", e); } }
        }
        this.particles.update(dt);
        // (the camera first: the bubbles size themselves to the camera's view — fitted against last frame's camera, a
        //  bubble by the till came out 110–120 % of a phone's width while the camera swung in for the purchase)
        this.updateCamera(dt, false);
        this.bubbles.update(dt);
    }

    /** ci/doors stage 2: walking out through the room's door = leaving (no question, no fade). */
    checkWalkOut() {
        const dsp = this.spots.door;
        if (!dsp || !this.out || this.leaving || this.busy || this.mode || this.lock || this.auto || ctx.dialogOpen || this.def.noWalkOut) return;
        const L = this.lulu.obj.position, d = Math.hypot(L.x - dsp.x, L.z - dsp.z);
        if (!this.outArmed) { if (d > 1.8) this.outArmed = true; return; }
        const v = this.vel.x * this.out.x + this.vel.z * this.out.z;
        if (d < 1.0 && v > 1.2) { this.walkOut = true; this.leave(); }
    }
    use(h) {
        this.busy = true;
        this.active = h;
        H.prompt("");
        const L = this.lulu.obj.position;
        const who = h.who && this.byId[h.who];
        const tx = who ? who.p.obj.position.x : h.x, tz = who ? who.p.obj.position.z : h.z;
        this.faceTo = { x: tx, z: tz };
        Promise.resolve().then(() => h.action(this, h)).catch(e => console.error("[interiors action]", e)).finally(() => {
            this.busy = false; this.active = null; this.faceTo = null;
        });
    }

    findNear() {
        const L = this.lulu.obj.position, ry = this.lulu.obj.rotation.y;
        const fx = Math.sin(ry), fz = Math.cos(ry);
        let best = null, bs = 1e9;
        for (const h of this.hots) {
            if (h.enabled && !h.enabled(this)) continue;
            const who = h.who && this.byId[h.who];
            const x = h.track && who ? who.p.obj.position.x : h.x, z = h.track && who ? who.p.obj.position.z : h.z;
            const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
            if (d > h.r) continue;
            const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
            // (the one she FACES wins over one just beside her: two ✋ a step apart — a house's leaf blower + its broom —
            //  standing at one and facing it, the prompt was the other; ci/sweep-phone)
            // (…and a PERSON a little over a thing: the mom behind the seltzer bottle on her counter — facing both, the
            //  prompt was the bottle; stepping right up to the bottle still picks the bottle)
            const score = d - facing * 1.0 - (h.who ? 0.3 : 0);
            if (score < bs) { bs = score; best = h; }
        }
        return best;
    }

    updateLulu(dt) {
        const o = this.lulu.obj;
        let mx = 0, mz = 0, run = 1;
        const canMove = !this.busy && !ctx.dialogOpen && !this.lock && !this.leaving && !this.mode;
        if (this.auto) {
            const dx = this.auto.x - o.position.x, dz = this.auto.z - o.position.z, d = Math.hypot(dx, dz);
            this.auto.t -= dt;
            if (d < 0.12 || this.auto.t <= 0) { const r = this.auto.res; this.auto = null; r(); }
            else { mx = dx / d; mz = dz / d; run = Math.min(1, d * 2); }
        } else if (canMove) {
            const ix = input.moveX, iy = input.moveY;
            if (this.orbiting) {
                // (as on foot: relative to the free camera — up = away from it; a full push / the boost = a run)
                const h = ctx.cam.free.yaw, fx = Math.sin(h), fz = Math.cos(h);
                mx = fx * -iy - fz * ix; mz = fz * -iy + fx * ix;
                if (input.boost || (input.device === "touch" && Math.hypot(ix, iy) > 0.9)) run = 1.45;
            } else {
                const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
                mx = c * ix + s * iy;
                mz = -s * ix + c * iy;
            }
            const m = Math.hypot(mx, mz);
            if (m > 1) { mx /= m; mz /= m; }
        }
        const SPEED = this.def.walkSpeed || 3.4;
        const tx = mx * SPEED * run, tz = mz * SPEED * run;
        const k = 1 - Math.exp(-dt * 12);
        this.vel.x += (tx - this.vel.x) * k;
        this.vel.z += (tz - this.vel.z) * k;
        const p = o.position;
        p.x += this.vel.x * dt;
        p.z += this.vel.z * dt;
        this.collide(p, 0.32);
        p.y += (this.groundAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);
        const sp = Math.hypot(this.vel.x, this.vel.z);
        if (sp > 0.25) this.turnTo(Math.atan2(this.vel.x, this.vel.z), dt, 10);
        else if (this.faceTo) this.turnTo(Math.atan2(this.faceTo.x - p.x, this.faceTo.z - p.z), dt, 8);
        this.lulu.update(dt, Object.assign({ walk: sp }, this.luluPose || {}));
        if (this.def.luluPost) this.def.luluPost(this, dt);
    }
    turnTo(want, dt, rate) {
        const o = this.lulu.obj;
        let d = want - o.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        o.rotation.y += d * Math.min(1, dt * rate);
    }

    collide(p, r) {
        for (const c of this.cols) {
            if (!c.on) continue;
            const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1);
            const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
            if (d2 >= r * r) continue;
            if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
            else {
                const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr, t, b);
                if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r;
            }
        }
        for (const q of this.people) {
            if (!q.collide) continue;
            const qp = q.p.obj.position, dx = p.x - qp.x, dz = p.z - qp.z, d = Math.hypot(dx, dz), rr = r + q.r;
            if (d < rr && d > 1e-4) { p.x = qp.x + dx / d * rr; p.z = qp.z + dz / d * rr; }
        }
        const B = this.bounds;
        p.x = clamp(p.x, B.x0, B.x1);
        p.z = clamp(p.z, B.z0, B.z1);
    }

    /** The free on-foot camera in this room right now (not a mini-game, not a fixed-camera room)? */
    orbitOn() { return !(this.def.cam && this.def.cam.fixed) && !this.mode && !!(ctx.cam && ctx.cam.orbit && ctx.cam.free); }
    /** How far the camera may sit from `tgt` along (dx, dy, dz): inside the room's box + under its ceiling. */
    camClip(tgt, dx, dy, dz, D) {
        const B = this.bounds, C = this.def.cam || {}, w = C.wall != null ? C.wall : ORBIT.wall;
        const ceil = (this.def.ceil || C.ceil || ORBIT.ceil) - 0.25;
        let t = D;
        if (dx > 1e-4) t = Math.min(t, (B.x1 + w - tgt.x) / dx); else if (dx < -1e-4) t = Math.min(t, (B.x0 - w - tgt.x) / dx);
        if (dz > 1e-4) t = Math.min(t, (B.z1 + w - tgt.z) / dz); else if (dz < -1e-4) t = Math.min(t, (B.z0 - w - tgt.z) / dz);
        if (dy > 1e-4) t = Math.min(t, (ceil - tgt.y) / dy);
        // …and the room's own walls (its big shell meshes: a set's walls don't always sit on its walking bounds)
        if (this.root && t > 0.6) {
            RAY.set(RV.set(tgt.x, tgt.y, tgt.z), RD.set(dx, dy, dz).normalize()); RAY.near = 0.2; RAY.far = t + 0.3;
            for (const h of RAY.intersectObjects(this.rayRoots(), true)) {
                if (!h.object.isMesh || (this.fadeable(h.object) && !this.wallLike(h.object))) continue;
                t = Math.min(t, h.distance - 0.3);
                break;
            }
        }
        // (tight: the rig may rise over her head — still under the ceiling, ORBIT.ceil leaves it the room)
        return { d: Math.max(0.6, t), noLift: false };
    }
    /** Floor-to-ceiling (≥ 2.2 m tall — a cell's wall, a partition): the camera stops at it rather than passing through and
     *  fading it (a holding cell's back corner left the lens 0.6 m outside the room). */
    wallLike(o) {
        if (o.userData.wallLike == null) {
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const b = o.geometry.boundingBox, sy = new THREE.Vector3(); o.getWorldScale(sy);
            o.userData.wallLike = (b.max.y - b.min.y) * sy.y >= 2.2;
        }
        return o.userData.wallLike;
    }
    /** Small enough to be furniture / a partition (faded when it's in the way), not the room's shell (clipped to). */
    fadeable(o) {
        if (o.userData.fadeOk == null) {
            if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
            RS.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
            o.userData.fadeOk = RS.radius < ORBIT.fadeR;
        }
        return o.userData.fadeOk;
    }
    /** Fade whatever furniture-sized thing stands between the lens and her (restored once it's clear). */
    fadeOccluders() {
        if (!this.root || (this.fadeTick = (this.fadeTick || 0) + 1) % 2) return;
        const cam = this.set.camera, L = this.lulu.obj.position;
        const faded = this.faded || (this.faded = new Map()), hit = new Set();
        RV.set(L.x, L.y + 1.1, L.z);
        RD.copy(cam.position).sub(RV);
        const far = RD.length() - 0.05;
        if (far > 0.2) {
            RAY.set(RV, RD.normalize()); RAY.near = 0.35; RAY.far = far;
            for (const h of RAY.intersectObjects(this.rayRoots(), true)) {
                const o = h.object;
                if (!o.isMesh || hit.has(o)) continue;
                if (this.fadeable(o)) hit.add(o);        // (the room's shell: never — the camera is clipped to it)
            }
        }
        for (const o of hit) if (!faded.has(o)) {
            const m0 = o.material, ms = (Array.isArray(m0) ? m0 : [m0]).map(m => { const c = m.clone(); c.transparent = true; c.depthWrite = false; return c; });
            faded.set(o, { m0, ms, a: 1 });
            o.material = Array.isArray(m0) ? ms : ms[0];
        }
        for (const [o, f] of faded) {
            const want = hit.has(o) ? ORBIT.fadeTo : 1;
            f.a += (want - f.a) * 0.35;
            if (want === 1 && f.a > 0.97) { o.material = f.m0; for (const m of f.ms) m.dispose(); faded.delete(o); continue; }
            for (const m of f.ms) m.opacity = f.a;
        }
    }
    /** Tests: the first opaque room mesh between the lens and her chest ("" = a clear view). */
    debugBlocked() {
        const cam = this.set.camera, L = this.lulu.obj.position;
        RV.copy(cam.position); RD.set(L.x, L.y + 1.0, L.z).sub(RV);
        const far = RD.length() - 0.3;
        RAY.set(RV, RD.normalize()); RAY.near = 0; RAY.far = far;
        for (const h of RAY.intersectObjects(this.rayRoots(), true)) {
            const m = h.object.material, op = Array.isArray(m) ? m[0].opacity : m.opacity;
            if (h.object.isMesh && h.object.visible && !(op < 0.5)) {
                const o = h.object; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
                const b = o.geometry.boundingBox, sc = new THREE.Vector3(); o.getWorldScale(sc);
                return `${o.name || "mesh"} @${h.distance.toFixed(2)} (${[(b.max.x - b.min.x) * sc.x, (b.max.y - b.min.y) * sc.y, (b.max.z - b.min.z) * sc.z].map(v => v.toFixed(1)).join("×")} at ${h.point.toArray().map(v => v.toFixed(1)).join(",")}; fade ${o.userData.fadeOk}, wall ${o.userData.wallLike})`;
            }
        }
        return "";
    }
    orbitCamera(dt, snap) {
        const cam = this.set.camera, C = this.def.cam || {}, F = ctx.cam.free, L = this.lulu.obj.position;
        if (!this.orbiting) {
            // (back from a mini-game's fixed shot: the rig takes over from the picture on screen, no swing)
            if (!snap) F.fromCamera(cam);
            this.orbiting = true;
            snap = true;
        }
        if (snap) F.release();          // (a snap: the rig's follow point jumps to her this frame)
        // a chat / a look-at: over her shoulder toward them (only while the player leaves the look alone)
        let auto = null, dist = C.orbitDist || ORBIT.dist;
        const who = this.active && this.active.who && this.byId[this.active.who];
        const at = this.focusAt || (who ? who.p.obj.position : this.active ? this.active : null);
        // (standing at someone's ✋ — she walked up to them — the camera eases over her shoulder too: straight behind her,
        //  on a phone held upright her head + back hid the shopkeeper / the mom she's facing; ci/sweep-phone)
        const nw = !at && this.near && this.near.who && this.byId[this.near.who];
        const at2 = at || (nw ? nw.p.obj.position : null);
        if (at2 && Math.hypot(at2.x - L.x, at2.z - L.z) > 0.3) {
            const to = Math.atan2(at2.x - L.x, at2.z - L.z);
            // (a person: over the shoulder — on the side with room for the camera; straight on when neither side has
            //  room (a cramped kitchen: squeezed into a corner the camera rose over her head); a thing — a rack, a focus
            //  point — straight on, as before)
            const off = (who && !this.focusAt) || nw ? this.shoulderOff(to, dist) : 0;
            auto = { yaw: to + off, k: 3 };
            if (at) dist *= 0.85;
        }
        ctx.cam.orbit(this.lulu.obj, { camera: cam, dist, look: ORBIT.look, fov: this.def.fov || ORBIT.fov, auto,
            clip: (tgt, dx, dy, dz, D) => this.camClip(tgt, dx, dy, dz, D) }, snap ? 0 : dt);
        this.fadeOccluders();
        // 📱 a phone held upright in a small room (a shopfront, a stranger's hallway): the walls pull the lens in right behind
        // her and her head + back filled half the screen, hiding who she talks to — close in, she turns see-through
        // (ci/sweep-phone). Landscape / a big room: the camera sits far enough back, she stays solid.
        const P = cam.position, d = Math.hypot(P.x - L.x, P.z - L.z, (P.y - L.y - 1.2) * 0.5);
        const [far, near] = cam.aspect < 1 ? SELF_FADE.portrait : SELF_FADE.land;
        const want = d >= far ? 1 : d <= near ? SELF_FADE.to : SELF_FADE.to + (1 - SELF_FADE.to) * (d - near) / (far - near);
        this.selfA = this.selfA == null ? 1 : this.selfA + (want - this.selfA) * (snap ? 1 : Math.min(1, dt * 8));
        this.fadeSelf(this.selfA);
    }
    /** Lulu herself see-through (a < 1) or solid again (her own materials back; `drop`: the room is going). */
    fadeSelf(a, drop = false) {
        const o = this.lulu && this.lulu.obj;
        if (!o) return;
        const solid = drop || a > 0.985;
        if (solid && !this.selfFaded) return;
        this.selfFaded = !solid;
        o.traverse(m => {
            if (!m.isMesh) return;
            let f = m.userData.selfFade;
            // (her clothes changed under it — the fitting room re-dresses her: start again from what she wears now)
            if (f && m.material !== f.mat) { for (const c of f.ms) c.dispose(); f = m.userData.selfFade = null; }
            if (solid) { if (f) { m.material = f.m0; for (const c of f.ms) c.dispose(); m.userData.selfFade = null; } return; }
            if (!f) {
                const m0 = m.material, ms = (Array.isArray(m0) ? m0 : [m0]).map(x => { const c = x.clone(); c.transparent = true; c.depthWrite = false; return c; });
                f = m.userData.selfFade = { m0, ms, mat: Array.isArray(m0) ? ms : ms[0] };
                m.material = f.mat;
            }
            for (const c of f.ms) c.opacity = a;
        });
    }

    /** Which over-the-shoulder offset (rad) has room for the camera behind her, looking along `to` (re-checked every
     *  ~10 frames; the side it's on is kept unless the other has clearly more room). */
    shoulderOff(to, dist) {
        const S = this.sh || (this.sh = { t: 0, off: 0, to: 0 });
        if (S.t-- > 0 && Math.abs(wrapAngle(S.to - to)) < 0.2) return S.off;
        S.t = 10; S.to = to;
        const L = this.lulu.obj.position, tgt = { x: L.x, y: L.y + ORBIT.look, z: L.z }, p = ctx.cam.free.pitch, cp = Math.cos(p), sp = Math.sin(p);
        const room = a => { const r = this.camClip(tgt, -Math.sin(a) * cp, sp, -Math.cos(a) * cp, dist * 1.3); return r.d; };
        const side = Math.sign(wrapAngle(ctx.cam.free.yaw - to)) || 1;
        const here = room(to + side * SHOULDER), there = room(to - side * SHOULDER);
        const best = there > here + 0.4 ? -side : side, d = Math.max(here, there);
        S.off = d >= 2.4 ? best * SHOULDER : 0;
        return S.off;
    }
    updateCamera(dt, snap) {
        if (this.orbitOn()) return this.orbitCamera(dt, snap);
        if (this.selfFaded) { this.selfA = 1; this.fadeSelf(1); }      // (a mini-game's / a fixed camera's shot: she's solid)
        if (this.orbiting) { this.orbiting = false; if (ctx.cam && ctx.cam.free) ctx.cam.free.release(); }
        const cam = this.set.camera, L = this.lulu.obj.position, C = this.def.cam || {};
        const aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const k = aspect < 0.7 ? 1.6 : aspect < 1.05 ? 1.3 : 1;
        let dist = (C.dist || 7.4) * k, height = (C.height || 4.6) * k;
        const lk = 1 - Math.exp(-dt * 5);
        this.look.x += ((input.lookX || 0) * 0.75 - this.look.x) * (snap ? 1 : lk);
        this.look.y += ((input.lookY || 0) * 1.6 - this.look.y) * (snap ? 1 : lk);
        V.copy(L);
        if (C.centerZ != null) V.z += (C.centerZ - V.z) * (C.centerK != null ? C.centerK : 0.5);   // (a wide room: frame its middle, not just her)
        if (this.focusAt) { V.lerp(this.focusAt, 0.45); dist *= 0.78; height *= 0.82; }
        else if (this.active && !this.mode) {
            const who = this.active.who && this.byId[this.active.who];
            V2.set(who ? who.p.obj.position.x : this.active.x, 0, who ? who.p.obj.position.z : this.active.z);
            V.lerp(V2, 0.4); dist *= 0.84; height *= 0.86;
        }
        const B = this.bounds, m = C.clampX != null ? C.clampX : 2.2;
        V.x = clamp(V.x, Math.min(0, B.x0 + m), Math.max(0, B.x1 - m));
        const yaw = this.yaw + this.look.x;
        V2.set(V.x + Math.sin(yaw) * dist, V.y + height + this.look.y, V.z + Math.cos(yaw) * dist);
        const pk = snap ? 1 : 1 - Math.exp(-dt * 3.2);
        cam.position.lerp(V2, pk);
        V.y += C.lookY != null ? C.lookY : 0.9;
        if (snap) this.camLook.copy(V); else this.camLook.lerp(V, 1 - Math.exp(-dt * 4));
        cam.lookAt(this.camLook);
    }
}
