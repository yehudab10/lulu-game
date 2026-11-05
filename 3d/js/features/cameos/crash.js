// features/cameos — THE CRASH AFTERMATH (src/05-driving-loop.js: crashPhase,
// angryMan, revengeCar, animalSwarm, crashReprieve, reprieveKind,
// hillelAdjuster, grantSecondChance). Claims every non-cop wreck
// (hooks.wreck, priority 10 — law claims cop wrecks at 30) and plays it in 3D:
//   • a car: its driver storms out of the wreck — angry, scared or heartbroken —
//     yells, and gets flattened by a second car… or, rarely, a funny reprieve:
//     Hillel the (ex-)insurance adjuster settles the claim, the scared driver
//     faints, the sad one shuffles home, a cop nabs the guy, or he chases his hat.
//     A reprieve → Lulu walks on (ctx.foot.start("crashReprieve")).
//   • an animal: its furious kin surround her hurling insults until revenge
//     traffic flings them off the road (always game over, like the 2D game).
//   • anything else (a tree, a pole…): straight to the aftermath.
// Then: the ambulance gets there first (~35%, ctx.er.admit) or game over.
import { ctx, on, hook, emit, registerState, setState, pick, rand, wrapAngle, MPH } from "../../core/ctx.js";
import { registerModels, ensureModels } from "../../models.js";
import { save3d } from "../../core/save.js";
import { spawnPerson } from "../../core/people.js";
import { addCoins } from "../../core/driving.js";
import { say, closeDialog } from "../../core/dialog.js";
import { rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { THREE, models, cloneWithColors, findNodes, bubble, loadModels, clamp, ease, wait, stat, charge, caption, clearCaptions, sfx, prop, inHand, roadPoint } from "./common.js";
import { resumeDriving } from "./resume.js";

registerModels({
    cameos_grandpa: "cameos_grandpa", cameos_business: "cameos_business", cameos_teen: "cameos_teen", cameos_tourist: "cameos_tourist",
    cameos_delivery: "cameos_delivery", cameos_hipster: "cameos_hipster", cameos_duck: "cameos_duck", cameos_raccoon: "cameos_raccoon",
});

// ── what the angry (or scared, or sad) driver yells ──────────────────────
const CAR_YELLS = ["YOU WRECKED MY CAR!!", "MY INSURANCE!!", "20 YEARS, NO CLAIMS — GONE!", "DO YOU SEE THIS DENT?!", "I JUST WAXED THIS!!",
    "THAT'S A LEASE, LADY!!", "I JUST PAID IT OFF!!", "MY WIFE'S GONNA KILL ME!", "FORTY YEARS OF DRIVING!!", "YOU'LL HEAR FROM MY LAWYER!",
    "THAT WAS A CLASSIC!!", "BRAND NEW TIRES!! GONE!", "I NAMED HER BETSY!!", "WHERE'S YOUR LICENSE?!", "MY BUMPER STICKER!!"];
const DRUNK_CAR_YELLS = ["*hic* YOU... YOU DENTED... sumthin'", "WAS THAT... a CAR? or TWO cars?", "I'm FINE to yell at you!",
    "MY... *burp* ...INSHURANCE!", "OFFISHER! ...oh. You're not a cop.", "I only had SIX l'chaims!", "Who moved the ROAD?!"];
const TEXT_CAR_YELLS = ["BRB — wait, MY CAR?!", "I was MID-TEXT!! Rude!", "Hold on, lemme photo the dent.", "Ugh, 1 bar of signal AND no car!",
    "I'll TWEET about this!!", "That's going on my STORY.", "K so anyway— MY CAR IS TOTALED?!"];
const COP_CAR_YELLS = ["That's a CITY vehicle, ma'am!", "You're under ARREST! ...probably.", "RECKLESS DRIVING! Pull o— oh.", "I just WAXED this cruiser!!",
    "Do you KNOW who I am?!", "License and registration. NOW.", "That'll be a VERY big ticket."];
const SCARED_YELLS = ["P-PLEASE don't hurt me!!", "MY HANDS ARE SHAKING!!", "I— I've NEVER crashed before!", "Is everyone OKAY?! oh no—",
    "I'm calling my MOM!!", "Do we... do we EXCHANGE info?!", "I think I might FAINT...", "AAH! my life FLASHED by!!"];
const SAD_YELLS = ["...my car. my beautiful car. 😢", "I just GOT it washed... *sniff*", "why does this ALWAYS happen...", "I can't afford this... again. 💧",
    "it was my zaidy's car...", "*quietly sobbing*", "I'm having the WORST week...", "I only wanted a nice drive..."];
const ANIMAL_INSULTS = ["You DENT my cousin?!", "MURDERER!", "We saw EVERYTHING!", "Justice for Gerald!", "You drive like a SHEEP!", "Honk THIS, lady!",
    "Road HOG!", "My aunt was crossing!", "You'll PAY for this!", "We never forget!", "Off our road!", "Menace!"];
const STRANGER_TYPES = [
    { id: "grandpa", w: 3, model: "cameos_grandpa", yells: CAR_YELLS },
    { id: "businessman", w: 2, model: "cameos_business", yells: ["I have a MEETING in TEN minutes!", "Do you know how MUCH I bill an HOUR?!",
        "My CLIENT is in that car!", "This is a COMPANY lease, you menace!", "I'll have your LICENSE for this!", "I'm late for MY OWN DEPOSITION!"] },
    { id: "teen", w: 2, model: "cameos_teen", yells: ["Bro. BRO. My DAD's gonna KILL me!", "I just GOT my license YESTERDAY!",
        "This is SO going on my STORY!", "My insurance is, like, my MOM!", "You dinged my SUBWOOFER, dude!", "That's a vintage GAME in there!!"] },
    { id: "mom", w: 2, model: "npcWoman", colors: { Top: "#EC407A", Hair: "#5D4037" }, yells: ["There are KIDS in this car!!", "I JUST did the carpool, lady!",
        "My toddler is NAPPING in there!", "You scared the BABY! Shame!", "I have GROCERIES melting, you know!", "Snack time is RUINED now!"] },
    { id: "tourist", w: 1, model: "cameos_tourist", yells: ["Iz zis... how you PARK in zis country?", "My RENTAL! Ze deposit! NOOO!", "Vhere is ze Eiffel Tower?!",
        "I take PHOTO of your bad driving!", "Ze guidebook said NOSING about ZIS!"] },
    { id: "delivery", w: 1, model: "cameos_delivery", yells: ["Forty PACKAGES in there, lady!", "My ROUTE is RUINED now!", "That was a SAME-DAY delivery!",
        "My TIPS! Do you know my TIPS?!", "Customer's gonna ONE-STAR me!"] },
    { id: "hipster", w: 1, model: "cameos_hipster", yells: ["That was a VINTAGE bumper!", "You wouldn't get it, it was ARTISANAL.", "I had a COLD BREW in the cupholder!",
        "My VINYL collection is BACK there!", "This car is IRONIC, actually."] },
];
const HILLEL_GREET = ["Hi, Hillel — I'll be your adjuster today.", "Don't panic! I do this... I DID this for a living.", "Lulu?! Small world. Let me just run the numbers."];
const HILLEL_ASSESS = ["Let me just... assess the damage. Mm. Mm-hm.", "Hold still — running the actuarials...", "One moment, carrying the one... mm-hm."];
const REPRIEVE_MSG = { insurance: "Hillel handled it! 📋", arrest: "They cuffed the guy! 🚓", faint: "He fainted dead away! 😵", weep: "He went home crying. 😢", chase: "You slipped away! 🏃‍♀️" };
const HILLEL = { emoji: "📋", color: "#1565C0" };

const ANIMAL_RE = /duck|goose|raccoon|ostrich|deer|moose|cow|sheep|goat|chicken|turkey|squirrel|\bcat\b|dog|horse|pig|bear|animal|critter|llama|camel/i;
const pickW = list => { let r = Math.random() * list.reduce((a, b) => a + b.w, 0); for (const x of list) if ((r -= x.w) <= 0) return x; return list[0]; };
const rollMood = () => { const r = Math.random(); return r < 0.25 ? "scared" : r < 0.5 ? "sad" : "angry"; };

// ── remember what the FINAL hit was ──────────────────────────────────────
let lastCrash = null, lastCrashT = -99, lastDamage = null, cause = null;
on("crash", e => { lastCrash = e; lastCrashT = ctx.time; if (e.car) e.__otherMph = Math.round((e.car.speed || 0) * MPH); e.__luluMph = Math.round(ctx.car.speed * MPH); });
on("damage", info => { lastDamage = { info, crash: ctx.time - lastCrashT < 0.25 ? lastCrash : null, t: ctx.time }; });
on("run:start", () => { lastDamage = null; cause = null; });

/** What the final hit was: { kind: "car" | "animal" | "other", … } */
export function classify(ld = lastDamage) {
    const e = ld && ld.crash, src = (ld && ld.info && ld.info.source) || "";
    const G = ctx.G;
    if (e && e.car && !ANIMAL_RE.test(e.kind || "")) {
        const c = e.car;
        const behavior = (c.data && c.data.behavior) || c.kind;
        return { kind: "car", car: c, carKind: c.kind, behavior, cop: c.kind === "cop" || behavior === "patrol",
            luluSpeed: e.__luluMph || Math.round(ctx.car.speed * MPH), otherSpeed: e.__otherMph || 0,
            oncoming: !!e.oncoming || c.dir < 0, otherAhead: c.s > ctx.car.s - 0.5, distracted: !!(G.distracted || G.distractedMode) };
    }
    if (e && e.actor) {
        const a = e.actor;
        const k = [e.source, e.kind, a.kind, a.animal, a.type, a.species].filter(x => typeof x === "string").join(" ");
        if (ANIMAL_RE.test(k)) return { kind: "animal", species: /raccoon/i.test(k) ? "raccoon" : "duck", what: k };
        return { kind: "other", what: e.source || a.kind || src };
    }
    if (e && e.collider) return { kind: "other", what: e.collider.kind || src };
    if (ANIMAL_RE.test(src)) return { kind: "animal", species: /raccoon/i.test(src) ? "raccoon" : "duck", what: src };
    return { kind: "other", what: src };
}

// Start loading the scene's cast the moment she's wrecked (the spin-out takes 2.6 s).
on("wreck", () => {
    if (!ctx.enabled("cameos")) return;
    cause = classify();
    const keys = ["hillelPerson", "copPerson", "cameos_props"];
    if (cause.kind === "animal") keys.push(cause.species === "raccoon" ? "cameos_raccoon" : "cameos_duck");
    if (cause.kind === "car") {
        cause.type = cause.cop || /drunk|texting/.test(cause.behavior) ? null : pickW(STRANGER_TYPES);
        keys.push(cause.cop ? "copPerson" : cause.type ? cause.type.model : "npcMan");
        // trading paint with AVIGAIL is a friendship disaster: −10 💜
        if (cause.carKind === "avigail" && ctx.avigail) ctx.avigail.bump(-10);
    }
    cause.loading = loadModels(keys);
});

// ── claim the wreck (law claims cop wrecks first at priority 30) ─────────
hook("wreck", info => {
    if (!ctx.enabled("cameos") || ctx.state !== "wrecked") return false;
    setState("cameosCrash", { info, cause: cause || classify() });
    return true;
}, 10);

// ── the scene ────────────────────────────────────────────────────────────
let S = null;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const flameTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), grd = g.createRadialGradient(32, 36, 2, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,220,1)"); grd.addColorStop(0.35, "rgba(255,160,40,0.9)"); grd.addColorStop(1, "rgba(255,40,40,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
})();

function roadFrame(s) { return ctx.world.road.at(s, {}); }
function placeOnRoad(obj, s, d) { const p = roadPoint(s, d); obj.position.set(p.x, obj.position.y, p.z); return p; }
function carExtent() {
    const car = ctx.car, rh = wrapAngle(car.h - roadFrame(car.s).h);
    return Math.abs(Math.sin(rh)) * 2.0 + Math.abs(Math.cos(rh)) * 0.9;
}
function lightsOf(obj) {
    const out = [];
    obj.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { o.material = o.material.clone(); out.push(o.material); } });
    return out;
}

registerState("cameosCrash", {
    hud: false, touch: false, pausable: false, world: true,
    enter(data) {
        const car = ctx.car, G = ctx.G;
        const c = data.cause || { kind: "other" };
        S = { t: 0, cause: c, info: data.info || {}, ents: [], revenge: [], kin: [], quote: null, force: (ctx.cameos && ctx.cameos.force) || {},
            camA: Math.random() * Math.PI * 2, shot: "orbit", group: new THREE.Group(), fires: [], light: null, smokeT: 0, done: false };
        ctx.scene.add(S.group);
        // everything stops: no new traffic, clear the road around the wreck
        S.trafficWas = ctx.traffic.config.enabled;
        ctx.traffic.config.enabled = false;
        for (const t of ctx.traffic.cars.slice()) if (t !== c.car) ctx.traffic.remove(t);
        A.updateEngine(0, 0, 0, 0, false, false);
        A.sfxHorn(false);
        A.setMusic(null);
        // BOOM — the explosion, a hard flash, smoke that keeps rolling, fire at the hood
        const fx = car.fx;
        fx.burst(car.pos.x, 1, car.pos.z, 40, 9, [1, 0.6, 0.2], 1.3, 0.9);
        fx.burst(car.pos.x, 1, car.pos.z, 24, 3, [0.35, 0.35, 0.38], 2.2, 1.6);
        if (c.car) fx.burst(c.car.x, 1, c.car.z, 24, 6, [1, 0.6, 0.2], 1.1, 0.8);
        sfx.boom(); A.sfxCrash(1.2);
        setTimeout(() => sfx.womp(), 400);
        rumble(1, 1, 600, true);
        H.flash();
        G.shake = 1.2;
        for (let i = 0; i < 3; i++) {
            const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
            f.userData.ph = i * 2.1;
            S.group.add(f); S.fires.push(f);
        }
        S.ext = carExtent();
        runCrash(S).catch(e => { console.error("[cameos crash]", e); endScene(S, "gameover"); });
    },
    exit() {
        if (!S) return;
        closeDialog(); clearCaptions(); H.prompt("");
        ctx.scene.remove(S.group);
        for (const f of S.fires) f.material.dispose();
        for (const e of S.ents) if (e.dispose) e.dispose();
        ctx.traffic.config.enabled = S.trafficWas;
        S = null;
    },
    update(dt) {
        if (!S) return;
        S.t += dt;
        const car = ctx.car;
        car.updateVisual(dt, ctx.time, { steer: 0, throttle: 0, brake: 0 }, false);
        // fire + smoke from both wrecks
        const fwd = _v.set(Math.sin(car.h), 0, Math.cos(car.h));
        S.fires.forEach((f, i) => {
            const fl = 0.8 + Math.sin(ctx.time * 17 + f.userData.ph) * 0.2 + Math.random() * 0.15;
            f.position.set(car.pos.x + fwd.x * (1.3 + i * 0.25) + (i - 1) * 0.35 * fwd.z, 1.05 + i * 0.1, car.pos.z + fwd.z * (1.3 + i * 0.25) - (i - 1) * 0.35 * fwd.x);
            f.scale.set(0.9 * fl, 1.3 * fl, 1);
        });
        if ((S.smokeT -= dt) <= 0) {
            S.smokeT = 0.08;
            const g = 0.3 + Math.random() * 0.25;
            car.fx.emit(car.pos.x + fwd.x * 1.3, 1.2, car.pos.z + fwd.z * 1.3, rand(-0.4, 0.4), rand(1.2, 2.2), rand(-0.4, 0.4), 1.3, 1.8, [g, g, g + 0.02]);
            if (S.cause.car) car.fx.emit(S.cause.car.x, 1.1, S.cause.car.z, rand(-0.4, 0.4), rand(1, 2), rand(-0.4, 0.4), 1.2, 1.6, [g, g, g]);
        }
        for (let i = S.ents.length - 1; i >= 0; i--) if (S.ents[i].update && S.ents[i].update(dt) === false) { const e = S.ents.splice(i, 1)[0]; if (e.dispose) e.dispose(); }
    },
    camera(dt) {
        if (!S) return false;
        const car = ctx.car;
        if (S.shot === "orbit" || !S.focus) {
            const a = S.camA + S.t * 0.32, r = S.cause.kind === "animal" ? 12.5 : 10.5;
            _v.set(car.pos.x + Math.sin(a) * r, S.cause.kind === "animal" ? 6.5 : 4.2, car.pos.z + Math.cos(a) * r);
            _w.set(car.pos.x, 0.9, car.pos.z);
            ctx.cam.cinematic(_v, _w, dt, 1.4, 52);
        } else {
            // a two-shot between Lulu's car and whoever's in focus
            const f = S.focus.isObject3D ? S.focus.position : S.focus.obj ? S.focus.obj.position : S.focus;
            const mx = (car.pos.x + f.x) / 2, mz = (car.pos.z + f.z) / 2;
            let ux = f.x - car.pos.x, uz = f.z - car.pos.z;
            const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L;
            const side = S.camSide || 1, dist = 6.5 + L * 0.6;
            _v.set(mx - uz * dist * side - ux * 1.5, 2.6 + L * 0.08, mz + ux * dist * side - uz * 1.5);
            _w.set(mx, 1.1, mz);
            ctx.cam.cinematic(_v, _w, dt, 1.8, 50);
        }
        // impact shake (the driving camera's shake doesn't run during cutscenes)
        const G = ctx.G, calm = save3d.settings.calm;
        if (G.shake > 0 && !calm) ctx.camera.position.add(_w.set((Math.random() - 0.5) * G.shake * 0.5, (Math.random() - 0.5) * G.shake * 0.3, (Math.random() - 0.5) * G.shake * 0.5));
        G.shake = Math.max(0, (G.shake || 0) - dt * 1.8);
        return true;
    },
});

/** A person in the scene with a simple behaviour (run to a target, yell, faint, fly…). */
function actor(key, opts = {}) {
    const p = models[key] ? spawnPerson(key, { colors: opts.colors, scale: opts.scale || 1 }) : spawnPerson("npcMan", { colors: opts.colors });
    S.group.add(p.obj);
    const e = {
        p, obj: p.obj, mode: "idle", target: null, speed: 4.6, vel: new THREE.Vector3(), spin: 0, t: 0, bub: null, anim: {},
        say(text, o = {}) { if (e.bub) e.bub.dispose(); e.bub = bubble(text, o); e.bub.position.set(0, (opts.scale || 1) * 2.0, 0); p.obj.add(e.bub); },
        hush() { if (e.bub) { e.bub.dispose(); e.bub = null; } },
        update(dt) {
            e.t += dt;
            const o = p.obj;
            if (e.mode === "run" && e.target) {
                const dx = e.target.x - o.position.x, dz = e.target.z - o.position.z, d = Math.hypot(dx, dz);
                if (d < 0.2 || e.t > 7) { o.position.x = e.target.x; o.position.z = e.target.z; e.mode = "arrived"; }
                else { o.position.x += dx / d * Math.min(d, e.speed * dt); o.position.z += dz / d * Math.min(d, e.speed * dt); p.face(e.target.x, e.target.z, dt, 10); }
                p.update(dt, { walk: e.speed });
            } else if (e.mode === "fly") {
                o.position.addScaledVector(e.vel, dt);
                e.vel.y -= 14 * dt;
                o.rotation.x += e.spin * dt; o.rotation.z += e.spin * 0.6 * dt;
                p.update(dt, { cheer: true });
                if (o.position.y < -6) o.visible = false;
            } else if (e.mode === "faint") {
                e.fall = Math.min(Math.PI / 2, (e.fall || 0) + dt * 3.2);
                o.rotation.x = -e.fall;
                p.update(dt, {});
            } else {
                if (e.lookAt) p.face(e.lookAt.x, e.lookAt.z, dt, 6);
                p.update(dt, e.anim);
            }
            if (e.bub) e.bub.tick(dt);
            if (e.extra) e.extra(dt);
        },
        dispose() { e.hush(); S && S.group.remove(p.obj); },
    };
    S.ents.push(e);
    return e;
}

/** A car prop that drives along the road at lane d (revenge cars, the cop). */
function roadCar(model, colors, s, d, speed) {
    const obj = cloneWithColors(models[model], colors);
    S.group.add(obj);
    const wheels = findNodes(obj, "Wheel_");
    const e = {
        obj, s, d, speed, accel: 0, stopAt: null, t: 0,
        update(dt) {
            e.t += dt;
            if (e.stopAt != null) { const left = e.stopAt - e.s; e.speed = Math.max(0, Math.min(e.speed, Math.sqrt(Math.max(0, left) * 2 * 18))); }
            e.speed += e.accel * dt;
            e.s += e.speed * dt;
            const p = roadPoint(e.s, e.d);
            obj.position.set(p.x, 0, p.z); obj.rotation.y = p.h;
            for (const w of wheels) w.rotation.x += e.speed * dt / 0.34;
            if (e.tick) e.tick(dt);
            return !(e.s > ctx.car.s + 140);
        },
        dispose() { S && S.group.remove(obj); },
    };
    e.update(0);
    S.ents.push(e);
    return e;
}

const alive = s => S === s && ctx.state === "cameosCrash";
async function until(s, fn, max = 8) { const t0 = ctx.time; while (alive(s) && !fn() && ctx.time - t0 < max) await wait(0.05); return alive(s); }

async function runCrash(s) {
    await wait(1.4);                       // the explosion
    if (!alive(s)) return;
    if (s.cause.loading) await s.cause.loading;
    if (!alive(s)) return;
    if (s.cause.kind === "car") await carScene(s);
    else if (s.cause.kind === "animal") await animalScene(s);
    else { await wait(0.8); if (alive(s)) aftermath(s); }
}

// ── a car: the driver climbs out ─────────────────────────────────────────
async function carScene(s) {
    const c = s.cause, car = ctx.car, force = s.force;
    const wreck = c.car;
    const themed = c.cop || /drunk|texting/.test(c.behavior);
    const mood = force.mood || (themed ? "angry" : rollMood());
    const type = c.type || (themed ? null : pickW(STRANGER_TYPES));
    const key = c.cop ? "copPerson" : type ? type.model : "npcMan";
    const man = actor(key, { colors: type ? type.colors : c.cop ? null : { Top: pick(["#8D6E63", "#5C6BC0", "#26A69A"]) } });
    s.man = man; man.mood = mood;
    // he flings open the door and storms over from the smoking heap
    const ws = wreck ? ctx.world.road.nearest(wreck.x, wreck.z, car.s, {}) : { s: car.s + 8, d: car.d + 3 };
    const side = Math.sign(ws.d - car.d) || (car.d > 0 ? -1 : 1);
    const start = roadPoint(ws.s, ws.d - side * 1.1);
    man.obj.position.set(start.x, 0, start.z);
    if (wreck) ctx.car.fx.burst(start.x, 1, start.z, 8, 1.5, [0.8, 0.85, 0.88], 0.5, 0.5);
    let td = car.d + side * (s.ext + 1.45);
    if (Math.abs(td) > 10) td = car.d - side * (s.ext + 1.45);
    s.manS = car.s + 0.6; s.manD = td;
    const tgt = roadPoint(s.manS, s.manD);
    man.target = new THREE.Vector3(tgt.x, 0, tgt.z);
    man.mode = "run";
    s.focus = man; s.shot = "two"; s.camSide = -Math.sign(td - car.d) || 1;
    const yell = c.cop ? pick(COP_CAR_YELLS) : /drunk/.test(c.behavior) ? pick(DRUNK_CAR_YELLS) : /texting/.test(c.behavior) ? pick(TEXT_CAR_YELLS)
        : mood === "scared" ? pick(SCARED_YELLS) : mood === "sad" ? pick(SAD_YELLS) : pick(type ? type.yells : CAR_YELLS);
    s.quote = `"${yell}" — ${c.cop ? "the officer 👮" : "the other driver"}`;
    if (!await until(s, () => man.mode === "arrived", 6)) return;
    // he yells
    man.mode = "idle"; man.lookAt = car.pos;
    man.anim = mood === "angry" ? { talk: true, point: true } : mood === "scared" ? { cheer: true, talk: true } : { talk: true };
    man.say(yell, { bg: mood === "angry" ? "#FFEBEE" : mood === "sad" ? "#E3F2FD" : "#FFFDE7", fg: "#2b1b2e" });
    car.fx.burst(man.obj.position.x, 0.2, man.obj.position.z, 6, 1.2, [0.74, 0.67, 0.64], 0.5, 0.5);
    if (mood === "angry") rumble(0.2, 0.4, 200);
    await wait(2.2);
    if (!alive(s)) return;
    // a rare, funny reprieve — likelier when the other driver was drunk or texting
    const sloppy = /drunk|texting/.test(c.behavior);
    let reprieve = force.reprieve !== undefined ? force.reprieve : (Math.random() < (sloppy ? 0.5 : 0.2) ? "yes" : false);
    if (reprieve) {
        let kind = typeof reprieve === "string" && reprieve !== "yes" ? reprieve
            : (Math.random() < 0.4 ? "insurance" : Math.random() < 0.5 ? "arrest" : "chase");
        if (force.reprieve === undefined || force.reprieve === "yes") {
            if (kind !== "insurance" && mood === "scared" && Math.random() < 0.7) kind = "faint";
            else if (kind !== "insurance" && mood === "sad" && Math.random() < 0.7) kind = "weep";
        }
        await reprieveScene(s, kind);
        return;
    }
    // …otherwise: the REVENGE CAR
    const rc = roadCar("sedan", { Paint: pick(["#42A5F5", "#FFCA28", "#66BB6A", "#EF5350", "#26C6DA", "#263238"]) }, s.manS - 75, s.manD, 30);
    s.focus = man; s.shot = "two";
    rc.tick = () => {
        if (rc.hitDone || rc.s < s.manS - 1.6) return;
        rc.hitDone = true;
        // SLAM!
        man.hush();
        man.mode = "fly";
        const f = roadFrame(rc.s);
        man.vel.set(Math.sin(f.h) * 13, 8.5, Math.cos(f.h) * 13);
        man.spin = 9;
        const mp = man.obj.position;
        ctx.car.fx.burst(mp.x, 1, mp.z, 34, 8, [1, 0.6, 0.2], 1.1, 0.8);
        ctx.car.fx.burst(mp.x, 1, mp.z, 16, 3, [0.4, 0.4, 0.42], 1.8, 1.2);
        sfx.boom(); A.sfxCrash(1); setTimeout(() => sfx.womp(), 300);
        ctx.G.shake = 1.0; rumble(0.8, 0.8, 400, true);
        s.slammed = true;
    };
    if (!await until(s, () => s.slammed, 5)) return;
    s.quote = `"${yell}" — the other driver (moments before the second car)`;
    await wait(1.4);
    if (alive(s)) aftermath(s);
}

// ── the funny reprieves ──────────────────────────────────────────────────
async function reprieveScene(s, kind) {
    const man = s.man, car = ctx.car;
    s.reprieve = kind;
    if (kind === "insurance") {
        // Hillel walks up from the shoulder, clipboard in hand, to "handle the claim"
        man.say(pick(["...who's THIS guy?", "Finally, a professional.", "*grumbles*"]), { bg: "#ECEFF1" });
        man.anim = { talk: false };
        const side = -Math.sign(s.manD - car.d) || 1;
        let hd = car.d + side * (s.ext + 1.4);
        if (Math.abs(hd) > 10.5) hd = car.d + side * 2.2;
        const from = roadPoint(car.s - 12, Math.sign(hd) * 10.5);
        const h = actor("hillelPerson");
        h.obj.position.set(from.x, 0, from.z);
        inHand(h.p, prop("cameos_props", "Clipboard"), "L", [0, -0.42, 0.1]);
        const tp = roadPoint(car.s - 1.2, hd);
        h.target = new THREE.Vector3(tp.x, 0, tp.z);
        h.mode = "run"; h.speed = 1.6;
        s.focus = h; s.camSide = side;
        const greet = say("Hillel", pick(HILLEL_GREET), Object.assign({ auto: 2.4 }, HILLEL));
        await until(s, () => h.mode === "arrived", 7);
        h.mode = "idle"; h.lookAt = car.pos; h.anim = { talk: true };
        await greet;
        if (!alive(s)) return;
        h.anim = { talk: true, point: true };
        await say("Hillel", pick(HILLEL_ASSESS), Object.assign({ auto: 2.2 }, HILLEL));
        if (!alive(s)) return;
        // Hillel's actuarial fault calc: who was faster, who hit whom, who was distracted, who was impaired
        const c = s.cause;
        let f = 0.5;
        if (c.otherAhead) f += 0.22; else f -= 0.22;
        if (c.oncoming) f -= 0.12;
        if (c.distracted) f += 0.18;
        if (c.luluSpeed > c.otherSpeed + 14) f += 0.15;
        if (/drunk|texting/.test(c.behavior)) f -= 0.30;
        f = clamp(f, 0.12, 0.9);
        const atFault = s.force.fault !== undefined ? !!s.force.fault : Math.random() < f;
        let line, report, amount;
        if (atFault) {
            amount = 40 + Math.floor(Math.random() * 71);
            report = `You: ${c.luluSpeed}mph · Them: ${c.otherSpeed}mph · ${c.otherAhead ? "you hit the car in FRONT" : "you swerved into them"}`;
            line = pick([`Ran the numbers — this one's on YOU. Deductible's 💰${amount}, sorry kid.`, `Fault's yours, mathematically. 💰${amount} out of pocket, I'm afraid.`,
                `You were doing ${c.luluSpeed}; they weren't. 💰${amount} deductible.`]);
        } else {
            amount = 60 + Math.floor(Math.random() * 91);
            report = `Them: ${c.otherSpeed}mph · You: ${c.luluSpeed}mph · ${c.otherAhead ? "but they cut you off" : "they rear-ended YOU"}${c.oncoming ? ", oncoming" : ""}`;
            line = pick([`Clear fault on THEM. Claim approved — 💰${amount}, enjoy.`, `Not your fault! Pushed it through: 💰${amount}. 📋`,
                `They were in the wrong doing ${c.otherSpeed}. 💰${amount} for you.`]);
        }
        sfx.sting();
        caption(`📋 ${report}`, "mint");
        caption(atFault ? `⚖️ AT FAULT — 💰${amount} deductible` : `✅ NOT YOUR FAULT — 💰${amount} payout`, atFault ? "" : "gold");
        // settle up the moment the verdict is read
        if (atFault) { const paid = charge(amount); H.toast(`📋 −${paid} deductible`, "red"); }
        else { addCoins(amount, "insurance"); A.sfxCoin(4); H.toast(`📋 +${amount} payout!`, "gold"); }
        s.hillel = { atFault, amount };
        man.say(atFault ? "HA! Told you!" : "...fine. FINE.", { bg: "#ECEFF1" });
        await say("Hillel", line, Object.assign({ auto: 2.6 }, HILLEL));
        if (!alive(s)) return;
        clearCaptions();
        return grant(s, kind);
    }
    if (kind === "faint") {
        man.say(pick(["I— I can't... feel my KNEES—", "everything's gone all... spinny...", "I feel FAINT— *wobble*"]), { bg: "#FFFDE7" });
        await wait(1.0);
        if (!alive(s)) return;
        man.mode = "faint";
        await wait(0.55);
        if (!alive(s)) return;
        sfx.thud(); ctx.G.shake = 0.3;
        const mp = man.obj.position;
        car.fx.burst(mp.x, 0.2, mp.z, 8, 1.6, [0.74, 0.67, 0.64], 0.6, 0.6);
        man.hush();
        const stars = bubble("💫 💫", { bg: "rgba(0,0,0,0)", fg: "#FFD54F", tail: false, border: "rgba(0,0,0,0)", size: 0.8 });
        S.group.add(stars);
        const head = new THREE.Vector3(0, 0.15, -1.5).applyEuler(man.obj.rotation).add(mp);
        stars.position.copy(head);
        S.ents.push({ update(dt) { stars.tick(dt); stars.position.y = head.y + 0.3 + Math.sin(ctx.time * 6) * 0.06; }, dispose() { stars.dispose(); } });
        await wait(1.25);
        return alive(s) && grant(s, kind);
    }
    if (kind === "weep") {
        man.say(pick(["*sob* ...I'm just gonna go home.", "I want my MOMMY... 😭", "this is the WORST day... *wail*"]), { bg: "#E3F2FD" });
        const away = roadPoint(s.manS - 30, Math.sign(s.manD || 1) * 9.5);
        man.target = new THREE.Vector3(away.x, 0, away.z);
        man.mode = "run"; man.speed = 1.6;
        let tearT = 0;
        man.extra = dt => {
            if ((tearT -= dt) > 0) return;
            tearT = 0.18;
            const p = man.obj.position;
            car.fx.emit(p.x, 1.6, p.z, rand(-0.4, 0.4), 0.6, rand(-0.4, 0.4), 0.12, 0.7, [0.5, 0.78, 0.94]);
        };
        await wait(3.6);
        return alive(s) && grant(s, kind);
    }
    if (kind === "arrest") {
        // a cop screeches in to nab the angry man
        man.say("Wait— officer?!", { bg: "#FFEBEE" });
        man.anim = { cheer: true, talk: true };
        const side = Math.sign(s.manD - car.d) || 1;
        const copD = clamp(s.manD + side * 2.4, -9.5, 9.5);
        const cop = roadCar("cop", null, s.manS - 60, copD, 26);
        cop.stopAt = s.manS + 1.5;
        const lights = lightsOf(cop.obj);
        let lt = 0;
        cop.tick = dt => { lt += dt; lights.forEach((m, i) => { m.emissiveIntensity = Math.sin(lt * 14 + (i % 2) * Math.PI) > 0 ? 5 : 0.3; }); };
        A.sfxSiren(2.2);
        s.focus = cop.obj;
        await until(s, () => cop.speed < 0.2 && cop.s > s.manS - 5, 6);
        if (!alive(s)) return;
        const copBub = bubble(pick(["You're NICKED!", "Book him, boys!", "Down to the station!"]), { bg: "#E8EAF6", fg: "#1A237E" });
        copBub.position.set(0, 2.4, 0); cop.obj.add(copBub);
        S.ents.push({ update(dt) { copBub.tick(dt); }, dispose() { copBub.dispose(); } });
        await wait(1.1);
        if (!alive(s)) return;
        // haul him off
        const door = cop.obj.position;
        man.hush(); man.target = new THREE.Vector3(door.x, 0, door.z); man.mode = "run"; man.speed = 2.2;
        await until(s, () => man.mode === "arrived", 3);
        man.obj.visible = false;
        cop.stopAt = null; cop.accel = 9; cop.speed = 2;
        s.focus = cop.obj;
        await wait(1.6);
        return alive(s) && grant(s, kind);
    }
    // "chase": the man got distracted and bolts off down the road
    const why = pick(["HEY! COME BACK!", "MY HAT! MY HAT!", "STOP! THIEF!", "THAT'S MY DOG!"]);
    man.say(why, { bg: "#FFF3E0" });
    const far = roadPoint(s.manS + 45, s.manD);
    man.target = new THREE.Vector3(far.x, 0, far.z);
    man.mode = "run"; man.speed = 5.2;
    if (/HAT/.test(why) && models.cameos_props) {
        const hat = prop("cameos_props", "Hat");
        S.group.add(hat);
        let hs = s.manS + 1.5, ht = 0;
        S.ents.push({ update(dt) {
            ht += dt; hs += 6.2 * dt;
            const p = roadPoint(hs, s.manD + Math.sin(ht * 2) * 0.6);
            hat.position.set(p.x, 0.25 + Math.abs(Math.sin(ht * 5)) * 1.2, p.z);
            hat.rotation.set(ht * 4, ht * 2, ht * 3);
        }, dispose() { S && S.group.remove(hat); } });
    }
    await wait(3.0);
    return alive(s) && grant(s, kind);
}

async function grant(s, kind) {
    if (!alive(s)) return;
    H.banner(`<b>SECOND CHANCE!</b><small>${REPRIEVE_MSG[kind] || "You slipped away! 🏃‍♀️"}</small>`, 2600);
    sfx.fanfare();
    rumble(0.3, 0.6, 300, true);
    s.granted = kind;
    emit("cameos:reprieve", { kind });
    await wait(1.8);
    if (!alive(s)) return;
    endScene(s, "reprieve");
}

// ── an animal: its furious kin ───────────────────────────────────────────
async function animalScene(s) {
    const car = ctx.car, key = s.cause.species === "raccoon" ? "cameos_raccoon" : "cameos_duck";
    const n = 6 + Math.floor(Math.random() * 3);
    const dMin = s.ext + 1.5;
    s.shot = "orbit";
    for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const ds = -4.5 + (Math.floor(i / 2) / Math.max(1, Math.ceil(n / 2) - 1)) * 9 + rand(-0.6, 0.6);
        let d = car.d + side * (dMin + rand(0, 1.6));
        if (Math.abs(d) > 11) d = car.d - side * (dMin + rand(0, 1.6));
        const k = actor(key, { scale: key === "cameos_duck" ? 1.5 : 1.25 });
        k.s = car.s + ds; k.d = d; k.state = "taunt"; k.ph = rand(0, 6);
        placeOnRoad(k.obj, k.s, k.d);
        k.base = k.obj.position.clone();
        k.lookAt = car.pos;
        k.anim = { talk: true };
        k.extra = dt => {
            if (k.state !== "taunt") return;
            k.ph += dt;
            k.obj.position.y = Math.abs(Math.sin(k.ph * 5)) * 0.22;      // angry little hops
            k.anim = { talk: true, cheer: Math.sin(k.ph * 2.3) > 0.4 };
        };
        s.kin.push(k);
    }
    const species = s.cause.species === "raccoon" ? "raccoons 🦝" : "ducks 🦆";
    let lastInsult = pick(ANIMAL_INSULTS);
    let bubbleT = 0, spawnT = 0.6;
    const t0 = ctx.time;
    while (alive(s)) {
        const dt = 0.05;
        await wait(dt);
        const left = s.kin.filter(k => k.state === "taunt");
        // a few insults at a time, rotating
        if ((bubbleT -= dt) <= 0) {
            bubbleT = 2.4;
            for (const k of s.kin) k.hush();
            left.slice().sort(() => Math.random() - 0.5).slice(0, 3).forEach(k => { lastInsult = pick(ANIMAL_INSULTS); k.say(lastInsult, { bg: "#FFEBEE", size: 0.8 }); });
        }
        // revenge cars barrel down the road at the survivors
        if ((spawnT -= dt) <= 0 && s.revenge.filter(r => r.s < car.s + 60).length < 5 && left.length) {
            spawnT = rand(0.45, 0.9);
            const target = pick(left);
            const rc = roadCar("sedan", { Paint: pick(["#42A5F5", "#FFFFFF", "#FFCA28", "#66BB6A", "#EF5350", "#8D6E63", "#26C6DA"]) }, car.s - 70, target.d + rand(-0.3, 0.3), rand(28, 36));
            rc.tick = () => {
                for (const k of s.kin) {
                    if (k.state !== "taunt" || Math.abs(k.d - rc.d) > 1.3 || Math.abs(k.s - rc.s) > 2.3) continue;
                    k.state = "hit"; k.hush();
                    const f = roadFrame(rc.s);
                    k.mode = "fly"; k.vel.set(Math.sin(f.h) * rand(9, 14) + rand(-3, 3), rand(5, 8), Math.cos(f.h) * rand(9, 14) + rand(-3, 3)); k.spin = rand(8, 14);
                    const p = k.obj.position;
                    ctx.car.fx.burst(p.x, 0.7, p.z, 12, 3, [0.98, 0.98, 0.98], 0.25, 0.9);     // a puff of feathers / fur
                    sfx.womp(); A.sfxBump();
                }
            };
            s.revenge.push(rc);
        }
        if (!left.length || ctx.time - t0 > 7) break;
    }
    if (!alive(s)) return;
    s.quote = `"${lastInsult}" — the ${species}`;
    await wait(1.3);
    if (!alive(s)) return;
    endScene(s, "gameover");      // an animal wreck is always game over (like the 2D game)
}

// ── the aftermath fork: the ER (~35%) or game over ───────────────────────
function aftermath(s) {
    const c = s.cause;
    if (c.cop && ctx.law && ctx.law.arrest) { endScene(s, "arrest"); return; }
    const er = s.force.er !== undefined ? !!s.force.er : Math.random() < 0.35;
    endScene(s, er && ctx.er ? "er" : "gameover");
}

const OTHER_QUOTES = {
    tree: "Lulu vs. a tree: the tree won. 🌳", pole: "The pole had the right of way. ⚡", house: "Somebody's living room has a new door. 🏠",
};
function endScene(s, how) {
    if (S !== s || s.done) return;
    s.done = how;
    emit("cameos:crashEnd", { how, cause: s.cause.kind, reprieve: s.granted || null });
    const quote = s.quote || OTHER_QUOTES[s.cause.what] || null;
    if (how === "reprieve") {
        if (ctx.foot && typeof ctx.foot.start === "function") { ctx.foot.start("crashReprieve", { from: "cameos" }); return; }
        // no on-foot feature: somehow… the car still starts
        resumeDriving({ hearts: 1, banner: `🔧 <b>Somehow… the car still starts!</b><small>${REPRIEVE_MSG[s.granted] || ""}</small>` });
        return;
    }
    if (how === "arrest") { ctx.law.arrest(["DESTROYING A POLICE CRUISER", "RECKLESS DRIVING"], { from: "cameos" }); return; }
    if (how === "er") { ctx.er.admit("crash"); return; }
    setState("gameover", quote ? { quote, why: s.info.why, source: s.info.source } : Object.assign({}, s.info, { G: undefined }));
}

export function crashScene() { return S; }
