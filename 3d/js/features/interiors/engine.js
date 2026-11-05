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
//   bounds: { x0, x1, z0, z1 }, cam: { dist, height }, ground?(x, z) → y,
//   build(rt), tick?(rt, dt), beforeLeave?(rt) → Promise (e.g. the precinct sneak-out)
// }
import * as THREE from "three";
import { ctx, registerState, setState, emit, on, css } from "../../core/ctx.js";
import { makeSet } from "../../core/sets.js";
import { store, saveSoon, shared, wallet, save3d } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
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

/** Register an interior: ctx.interiors[def.id] = { name, emoji, enter({ exit }) }. */
export function defineInterior(def) {
    ctx.interiors[def.id] = {
        name: def.name, emoji: def.emoji,
        enter(opts = {}) { return enterInterior(def, opts); },
    };
    return def;
}

function enterInterior(def, opts) {
    if (cur) { console.warn("[interiors] already inside", cur.def.id); return false; }
    cur = new Room(def, opts || {});
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
        this.used = {};          // one-per-visit reward flags (the 2D barUsed / rewarded)
        this.data = {};          // scratch for the interior def
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

        def.build(this);
        // a door hotspot for every interior
        if (this.spots.door && !this.hots.some(h => h.id === "door")) {
            this.hot({ id: "door", spot: "door", r: 1.5, label: `🚪 Leave ${def.short || def.name}`, action: rt => rt.leave() });
        }
        if (def.music) A.setMusic(def.music);
        this.updateCamera(0, true);
        H.banner(`${def.emoji} <b>${def.name}</b>${def.tagline ? `<small>${def.tagline}</small>` : ""}`, 2200);
    }

    hintHtml() {
        if (input.device === "touch") return `🕹️ walk · ✋ use · 🚪 leave`;
        return `${glyph("move")} walk · ${glyph("interact")} use · ${glyph("back")} leave`;
    }

    // ── helpers the interior defs use ──
    spot(name) { return this.spots[name] || null; }
    fx(name) { return this.fxs[name] || null; }
    node(name) { return findNodes(this.root, name)[0] || null; }
    add(obj) { this.set.add(obj); return obj; }
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
        const low = q === "low" || (q === "auto" && (pf.console || pf.tv));
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
        const id = this.def.id;
        if (cur === this) cur = null;
        this.dispose();
        setFade(1);
        fadeAway();
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
        if (this.bubbles) this.bubbles.clear();
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
        if (this.fadeIn < 1) {
            this.fadeIn = Math.min(1, this.fadeIn + dt / 0.45);
            setFade(1 - this.fadeIn, "");
        }
        if (this.t > 8 && this.chip) { const h = this.chip.querySelector(".int-hint"); if (h && !h.classList.contains("gone")) h.classList.add("gone"); }
        if (this.leaving) {
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
        this.bubbles.update(dt);
        this.updateCamera(dt, false);
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
            const score = d - facing * 0.6;
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
            const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
            mx = c * ix + s * iy;
            mz = -s * ix + c * iy;
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

    updateCamera(dt, snap) {
        const cam = this.set.camera, L = this.lulu.obj.position, C = this.def.cam || {};
        const aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const k = aspect < 0.7 ? 1.6 : aspect < 1.05 ? 1.3 : 1;
        let dist = (C.dist || 7.4) * k, height = (C.height || 4.6) * k;
        const lk = 1 - Math.exp(-dt * 5);
        this.look.x += ((input.lookX || 0) * 0.75 - this.look.x) * (snap ? 1 : lk);
        this.look.y += ((input.lookY || 0) * 1.6 - this.look.y) * (snap ? 1 : lk);
        V.copy(L);
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
