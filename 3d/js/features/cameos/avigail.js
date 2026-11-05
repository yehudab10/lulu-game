// features/cameos — AVIGAIL: the friendship meter (ctx.avigail), her purple
// coupe out on the road (taunts as you pass, sometimes pulled over by a cop),
// Avigail walking by the road → the porch visit (a fresh randomized
// conversation each time, rugelach promise and all) → she rides shotgun (2×).
import { ctx, hook, on, emit, registerState, setState, addActor, removeActor, pick, rand } from "../../core/ctx.js";
import { registerModels, ensureModels } from "../../models.js";
import { registerKind } from "../../traffic.js";
import { LANES_OURS, facingRoad } from "../../world.js";
import { makeSet } from "../../core/sets.js";
import { say, choose, closeDialog } from "../../core/dialog.js";
import { spawnPerson } from "../../core/people.js";
import { glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import {
    THREE, models, cloneWithColors, findNodes, shared, bubble, loadModels, clamp, ease, wait, stat, chips, caption, clearCaptions,
    fade, sfx, SetCam, luluOnFoot, prop, inHand, roadPoint,
} from "./common.js";
import { resumeDriving } from "./resume.js";

registerModels({ cameos_avigailCar: "cameos_avigail_car", cameos_porch: "cameos_porch", cameos_props: "cameos_props" });
registerKind("avigail", { len: 4.4, halfW: 0.9, circles: [1.25, -1.25], r: 0.95, mass: 1.2, model: "cameos_avigailCar", paint: false });

// ── the friendship meter (shared with the 2D game: save.avigailRel 0–100) ─
export function rel() { const v = shared.get().avigailRel; return typeof v === "number" ? v : 50; }
export function bump(d, { quiet = false } = {}) {
    let nv = 50;
    shared.update(s => { const cur = typeof s.avigailRel === "number" ? s.avigailRel : 50; nv = clamp(cur + d, 0, 100); s.avigailRel = nv; });
    emit("avigail:rel", { rel: nv, d });
    if (!quiet && d) H.toast(`${d > 0 ? "+" : ""}${d} 💜 Avigail`, d > 0 ? "pink" : "red");
    return nv;
}
export const relLabel = v => (v >= 65 ? "💜 friends" : v <= 35 ? "⚔️ rivals" : "😤 frenemies");
ctx.avigail = { rel, bump, label: () => relLabel(rel()) };

// ── road banter (src/04-parking-logic.js) ────────────────────────────────
const AVIGAIL_ROAD_TAUNTS = [
    "Nice driving, Bruck. For a LEARNER. 💅", "Oh look, they let YOU back out.",
    "Race you to the light! Kidding. I'd win.", "Is that your PARKING speed?",
    "Love the car. Very... pink.", "Mirror. Signal. MANICURE. 💅"];
const LULU_ROAD_REPLIES = [
    "😏 Hi, Avigail.", "Eyes on the road, princess.", "*waves SWEETLY*",
    "Still owe you rugelach!", "Nice coupe. Aviel pick it?"];
const AVIGAIL_PULLED_YELLS = [
    "This is HARASSMENT, officer!", "Do you KNOW who my father IS?!",
    "I was going the speed of TRAFFIC!", "These plates are DESIGNER!"];
const AVIGAIL_BUMPED = ["MY NAILS!!", "Watch the PAINT, Bruck!", "I'm telling EVERYONE.", "That's a LEASE!"];

const aviCars = new Set();
export function avigailOut() { return aviCars.size > 0 || !!walker || !!pulled; }

/** Avigail's coupe joins the traffic ahead of Lulu (or is pulled over on the shoulder). */
export async function spawnAvigailCar(opts = {}) {
    if (!await loadModels(["cameos_avigailCar"])) return null;
    if (avigailOut() && !opts.force) return null;
    if (opts.pulled ?? Math.random() < 0.3) return spawnPulled(opts);
    const car = ctx.car;
    const d = opts.d ?? pick(LANES_OURS);
    const s = opts.s ?? car.s + rand(200, 280);
    const c = ctx.traffic.add("avigail", s, d, 1, opts.speed ?? rand(13, 17), { data: { avigail: true } });
    const drv = findNodes(c.obj, "Driver")[0];
    if (drv) drv.visible = true;
    aviCars.add(c);
    c.onRemove = () => { aviCars.delete(c); if (c.data.bub) { c.data.bub.dispose(); c.data.bub = null; } };
    return c;
}
function carBubble(c, text, secs = 2.6) {
    if (c.data.bub) c.data.bub.dispose();
    const b = bubble(text, { bg: "#F3E5F5", fg: "#4A148C" });
    b.position.set(0, 2.2, 0);
    c.obj.add(b);
    c.data.bub = b; c.data.bubT = secs;
}

// passing Avigail → the obligatory taunt exchange (+1 💜 — sharing the road thaws the rivalry)
hook("update", (dt, P, controlsOn) => {
    const car = ctx.car;
    for (const c of aviCars) {
        if (c.data.bub) {
            c.data.bub.tick(dt);
            if ((c.data.bubT -= dt) <= 0) { c.data.bub.dispose(); c.data.bub = null; }
        }
        if (!controlsOn || c.hit || c.data.taunted) continue;
        if (Math.abs(c.s - car.s) < 11 && Math.abs(c.d - car.d) < 7) {
            c.data.taunted = true;
            carBubble(c, pick(AVIGAIL_ROAD_TAUNTS));
            setTimeout(() => H.toast(pick(LULU_ROAD_REPLIES), "pink"), 700);
            bump(1);
            stat("avigail3", 1);      // weekly quest: share the road with Avigail
        }
    }
});
on("crash", e => {
    if (e.kind === "avigail" && e.car && aviCars.has(e.car) && e.impact > 3 && !(e.car.data.bubT > 1)) carBubble(e.car, pick(AVIGAIL_BUMPED), 2);
});

// ── pulled over on the shoulder, mid-tantrum at the officer ──────────────
let pulled = null;
function lightsOf(obj) {
    const out = [];
    obj.traverse(o => {
        if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { o.material = o.material.clone(); out.push(o.material); }
    });
    return out;
}
async function spawnPulled(opts = {}) {
    if (!await loadModels(["cameos_avigailCar", "avigailPerson", "copPerson", "cameos_props"])) return null;
    const car = ctx.car, road = ctx.world.road;
    const S = opts.s ?? car.s + rand(330, 420);
    const d = 10.4;
    const root = new THREE.Group();
    const h = road.at(S).h;
    const place = (obj, s, dd, rot = 0) => { const p = road.point(s, dd, {}); obj.position.set(p.x, 0, p.z); obj.rotation.y = road.at(s).h + rot; return p; };
    const av = cloneWithColors(models.cameos_avigailCar);
    const drv = findNodes(av, "Driver")[0];
    if (drv) drv.visible = false;           // she's OUT of the car, yelling
    place(av, S, d, 0.05);
    const cop = cloneWithColors(models.cop);
    place(cop, S - 7.8, d + 0.2, 0.03);
    const lights = lightsOf(cop);
    const her = spawnPerson("avigailPerson");
    place(her.obj, S - 2.6, d + 2.0);
    const officer = spawnPerson("copPerson");
    place(officer.obj, S - 4.6, d + 1.7);
    inHand(officer, prop("cameos_props", "Clipboard"), "R", [0, -0.45, 0.08]);
    root.add(av, cop, her.obj, officer.obj);
    ctx.scene.add(root);
    const yell = bubble(pick(AVIGAIL_PULLED_YELLS), { bg: "#F3E5F5", fg: "#4A148C" });
    yell.position.set(0, 2.15, 0);
    yell.visible = false;
    her.obj.add(yell);
    const cols = [av, cop].map(o => [1.25, -1.25].map(off => ({ x: o.position.x + Math.sin(o.rotation.y) * off, z: o.position.z + Math.cos(o.rotation.y) * off })));
    let t = 0, seen = false, yellT = 0;
    pulled = addActor({
        S, kind: "avigailPulled",
        update(dt) {
            t += dt;
            const rs = S - ctx.car.s;
            for (let i = 0; i < lights.length; i++) lights[i].emissiveIntensity = (Math.sin(t * 14 + (i % 2) * Math.PI) > 0) ? 5 : 0.3;
            her.face(officer.obj.position.x, officer.obj.position.z, dt);
            officer.face(her.obj.position.x, her.obj.position.z, dt);
            her.update(dt, { talk: true, cheer: Math.sin(t * 1.3) > 0.55, point: Math.sin(t * 1.3) < -0.4 });
            officer.update(dt, { talk: Math.sin(t * 0.9) > 0.3 });
            yell.visible = rs < 140 && rs > -30;
            if (yell.visible) {
                yell.tick(dt);
                if ((yellT -= dt) <= 0) { yellT = 3; yell.setText(pick(AVIGAIL_PULLED_YELLS)); }
            }
            // catching Avigail pulled over → +2 💜 (schadenfreude is a bonding experience)
            if (!seen && Math.abs(rs) < 9 && ctx.state === "playing") {
                seen = true;
                bump(2);
                H.toast("😏 Well, well, WELL.", "pink");
                stat("avigail3", 1);
            }
            return rs > -160;
        },
        collide(car) {
            let imp = 0;
            for (const pair of cols) for (const c of pair) imp = Math.max(imp, car.collideStatic(c.x, c.z, 1.0));
            if (!imp) return null;
            // which one did we hit? the nearest pair decides
            const dA = Math.hypot(av.position.x - car.pos.x, av.position.z - car.pos.z);
            const dC = Math.hypot(cop.position.x - car.pos.x, cop.position.z - car.pos.z);
            return dA < dC ? { impact: imp, why: "You rear-ended AVIGAIL. She'll never let it go.", source: "avigail", kind: "avigail" }
                           : { impact: imp, why: "You hit a POLICE CAR. During a traffic stop.", source: "cop", kind: "cop" };
        },
        dispose() { ctx.scene.remove(root); yell.dispose(); for (const m of lights) m.dispose(); if (pulled === this) pulled = null; },
    });
    return pulled;
}

// ── Avigail walking by the road → pull up → the porch visit ──────────────
let walker = null;
export async function spawnAvigailWalker(opts = {}) {
    if (!await loadModels(["avigailPerson"])) return null;
    if (walker && !opts.force) return null;
    const car = ctx.car;
    let s = opts.s ?? car.s + rand(230, 300);
    const d = 8.4;
    const her = spawnPerson("avigailPerson");
    const mark = bubble("💜 Avigail!", { bg: "#7E57C2", fg: "#ffffff", size: 0.8 });
    mark.position.set(0, 2.05, 0);
    her.obj.add(mark);
    ctx.scene.add(her.obj);
    let announced = false, t = 0;
    walker = addActor({
        kind: "avigailWalker",
        update(dt) {
            t += dt;
            s += 1.25 * dt;
            const p = roadPoint(s, d);
            her.obj.position.set(p.x, 0, p.z);
            her.obj.rotation.y = p.h;
            her.update(dt, { walk: 1.25, talk: Math.sin(t * 0.7) > 0.6 });
            mark.tick(dt);
            mark.position.y = 2.05 + Math.sin(t * 3) * 0.08;
            const rs = s - ctx.car.s;
            if (!announced && rs < 170 && ctx.state === "playing") {
                announced = true;
                H.banner(`💜 <b>Avigail's walking by the road!</b><small>Pull up next to her in the right lane</small>`, 2600);
            }
            if (ctx.state === "playing" && Math.abs(rs) < 7.5 && ctx.car.d > 3.2 && ctx.car.d < 11) {
                startPorch({ s });
                return false;
            }
            return rs > -40;      // missed her
        },
        dispose() { ctx.scene.remove(her.obj); mark.dispose(); if (walker === this) walker = null; },
    });
    return walker;
}

// ── the porch scene ──────────────────────────────────────────────────────
// Dialogue pools (src/10-dina-nap-salon.js), assembled FRESH each visit.
const OPENERS = [
    { prompt: "Nobody's home! This is her cat speaking.", expr: "suspicious", rugelachIdx: 2, choices: [
        { label: "Cats can't talk.", reply: "...Meow. Dang it. Hold on, I'm getting dressed.", expr: "annoyed" },
        { label: "I see your feet under the door.", reply: "These are DECORATIVE feet. Very on-trend this season.", expr: "suspicious" },
        { label: "I brought rugelach.", reply: "WHY didn't you LEAD with that?! Door's basically open.", expr: "excited" }] },
    { prompt: "I'm not coming out. I'm in my pajamas and my FEELINGS.", expr: "dramatic", rugelachIdx: 1, choices: [
        { label: "It's 2 in the afternoon.", reply: "Time is a SOCIAL CONSTRUCT, Lulu. So is your invitation.", expr: "smug" },
        { label: "There's rugelach out here.", reply: "...Pajamas ARE a fashion statement. I'll be RIGHT out.", expr: "excited" },
        { label: "Same hat. Let me in.", reply: "Oh you GET it. Ugh, fine. Unlocking the door of doom.", expr: "love" }] },
    { prompt: "State your business! And NO, I did not order a salad.", expr: "suspicious", rugelachIdx: 0, choices: [
        { label: "I literally brought rugelach.", reply: "RUGELACH?! Why are we still TALKING? Move, move, move!", expr: "excited" },
        { label: "It's me, Lulu. Open up.", reply: "'It's me' could be ANYONE. Prove it. ...okay it's you.", expr: "suspicious" },
        { label: "Road trip. Get in the car.", reply: "A road trip? Unannounced?? The AUDACITY. I'm intrigued.", expr: "smug" }] },
];
const MIDDLES = [
    { prompt: "Oh. It's YOU. The ghoster herself, in the FLESH.", expr: "annoyed", choices: [
        { label: "I never ghosted you!", reply: "You left me on read for 9 DAYS, Lulu. NINE.", expr: "annoyed" },
        { label: "I missed your face?", reply: "Don't you 'miss your face' me. ...okay it IS a great face.", expr: "smug" },
        { label: "Ima made me come.", reply: "Your IMA has better manners than you. Tell her I said hi.", expr: "dramatic" }] },
    { prompt: "Nine days! I sat by my phone like it was Shabbos!", expr: "dramatic", choices: [
        { label: "My phone fell in a lake.", reply: "Your phone. In a lake. Walking distance from MY house?", expr: "suspicious" },
        { label: "I was emotionally busy.", reply: "Emotionally busy. Iconic. Unforgivable, but iconic.", expr: "smug" },
        { label: "I sent a thumbs up!", reply: "A THUMBS UP. To 'I think my cholent gained sentience.'", expr: "annoyed" }] },
    { prompt: "And why'd you find me WALKING? I have a CAR.", expr: "annoyed", choices: [
        { label: "Your car broke down again?", reply: "It's RESTING. It's not broken, it's spiritually recharging.", expr: "annoyed" },
        { label: "You walk dramatically tho.", reply: "I walk with PURPOSE. There's a difference, peasant.", expr: "dramatic" },
        { label: "Were you avoiding someone?", reply: "...We do NOT speak of Tzippy from Lev Bais Yaakov. Drive.", expr: "panic" }] },
    { prompt: "Is that your CAR out there? It sounds like a kettle.", expr: "suspicious", choices: [
        { label: "She's vintage.", reply: "She's a HAZARD with a nameplate. I love her already.", expr: "smug" },
        { label: "That's the AC. Probably.", reply: "That is NOT the AC, Lulu. That is a CRY for help.", expr: "panic" },
        { label: "Don't insult my car.", reply: "I'll insult whatever I want. It's in my contract. Get in.", expr: "smug" }] },
    { prompt: "Okay but I'm calling shotgun AND aux. Non-negotiable.", expr: "smug", choices: [
        { label: "You played 1 song for 3 hrs.", reply: "It was a JOURNEY and you weren't emotionally ready.", expr: "dramatic" },
        { label: "Deal — no sad-girl playlist.", reply: "Then I have NOTHING to offer this world. ...Fine. One bop.", expr: "dramatic" },
        { label: "Aux is yours, your majesty.", reply: "Was that sarcasm? I'll allow it. ONCE. Don't push it.", expr: "smug" }] },
    { prompt: "Swear we're not picking up your cousin again.", expr: "suspicious", choices: [
        { label: "I swear on the cholent.", reply: "That's the HOLIEST oath you have. Okay. I believe you.", expr: "excited" },
        { label: "...Define 'picking up.'", reply: "LULU. I KNEW it. Turn the car around— no, fine, GO.", expr: "panic" },
        { label: "He moved to Lakewood.", reply: "Baruch Hashem. Truly. Start the kettle— I mean, the car.", expr: "love" }] },
    { prompt: "Wait. Did you bring snacks OR did you bring DRAMA?", expr: "suspicious", choices: [
        { label: "Why not both?", reply: "...That's the most ME thing you've EVER said. I'm proud.", expr: "love" },
        { label: "Drama, obviously.", reply: "FINALLY. Someone who understands my LIFESTYLE. Get in.", expr: "excited" },
        { label: "Snacks. Always snacks.", reply: "A woman of SUBSTANCE. My respect? Earned. Barely.", expr: "smug" }] },
    { prompt: "I had a DREAM about you. You owed me a casserole.", expr: "dramatic", choices: [
        { label: "Dreams aren't real debts.", reply: "Tell that to my SUBCONSCIOUS. She keeps RECEIPTS, Lulu.", expr: "annoyed" },
        { label: "I'll bake you two.", reply: "TWO casseroles?! Okay now I'm getting in the car FAST.", expr: "love" },
        { label: "That's so specific.", reply: "My dreams have PRODUCTION VALUE. Unlike your texting.", expr: "smug" }] },
    { prompt: "Quick poll: am I the funny friend or the WISE one today?", expr: "smug", choices: [
        { label: "Funny. Definitely funny.", reply: "WRONG. I'm BOTH. This is a trick poll. You failed. Drive.", expr: "annoyed" },
        { label: "Wise AND funny.", reply: "Correct answer. Suspicious speed, though. Were you coached?", expr: "suspicious" },
        { label: "The dramatic one?", reply: "...How DARE you be RIGHT. Ugh. Get in before I cry.", expr: "dramatic" }] },
    { prompt: "I'm bringing my emotional support water bottle. Issue?", expr: "suspicious", choices: [
        { label: "No issue at all.", reply: "Good. She's named Brenda. Brenda gets the cupholder.", expr: "excited" },
        { label: "Does it have a name?", reply: "Obviously. BRENDA. Keep up. She's been through a LOT.", expr: "dramatic" },
        { label: "We're not bringing Brenda.", reply: "Then I'm not bringing ME. ...kidding. Brenda's coming.", expr: "smug" }] },
    { prompt: "Be honest. Is my hair giving 'main character' today?", expr: "dramatic", choices: [
        { label: "It's giving LEGEND.", reply: "I KNOW. But I needed YOU to know that I know. Thank you.", expr: "love" },
        { label: "It's giving... humid.", reply: "Slander! In MY doorway?! Get in before I rethink this.", expr: "annoyed" },
        { label: "Better than mine.", reply: "Finally, some self-awareness. We're gonna get along GREAT.", expr: "smug" }] },
];
const SNACKS = [
    { prompt: "Before I commit: what's the snack situation in there?", expr: "excited", choices: [
        { label: "Rugelach. A whole bag.", reply: "Marry me. Not really. But keep the rugelach coming.", expr: "love" },
        { label: "Half a granola bar.", reply: "Half?? Who ATE the other half in a moving vehicle?? Animal.", expr: "annoyed" },
        { label: "Vibes only.", reply: "'Vibes only' is how friendships END, Lulu. But fine.", expr: "dramatic" }] },
    { prompt: "Non-negotiable: is there something to NOSH on?", expr: "excited", choices: [
        { label: "Rugelach. A whole bag.", reply: "A whole BAG?! I'm welling up. Don't look at me. DRIVE.", expr: "love" },
        { label: "A suspicious mint.", reply: "A MINT? One? Singular?? This is a CRISIS, not a road trip.", expr: "panic" },
        { label: "Gas station pretzels.", reply: "Gas station pretzels are a LOVE LANGUAGE. Fine. I'm in.", expr: "smug" }] },
];
const CLOSERS = [
    "Okay LET'S GO. I'm driving. ...Fine, YOU drive. This time.",
    "If we get snacks on the way, all nine days are forgiven.",
    "I'm only coming for the aux cord and the bit. Mostly the bit.",
    "Buckle up. If we die, I'm telling everyone it was YOUR fault.",
    "Shotgun, aux, AND the last rugelach. That's the deal. Go go go.",
    "Brenda's buckled, I'm buckled, let's make some QUESTIONABLE memories.",
    "I forgive you. Conditionally. The condition is more rugelach.",
];
const RIDE_QUIPS = ["Brenda says slow down. 💧", "Aux is MINE. 🎶", "Is that a pothole or your driving?", "Snack check! ...where's the rugelach?",
    "Wave at them. No, the SASSY wave. 💅", "This is the most fun I've had since Tuesday. Don't tell anyone."];
const EXPR = { suspicious: "🤨", annoyed: "😒", dramatic: "😩", smug: "😏", panic: "😱", love: "🥰", excited: "🤩" };
const AVI = { emoji: "💅", color: "#6A1B9A" };

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** opener (rugelach promise) + 2–3 shuffled middles with the snack step in the back half. */
export function buildAvigailScript() {
    const opener = Object.assign({ isOpener: true }, pick(OPENERS));
    const snack = Object.assign({ isSnack: true }, pick(SNACKS));
    const mids = shuffle(MIDDLES).slice(0, 2 + Math.floor(Math.random() * 2));
    const split = Math.ceil(mids.length / 2);
    return [opener, ...mids.slice(0, split), snack, ...mids.slice(split)];
}

let set = null, setParts = null, porch = null;
function buildSet() {
    set = makeSet({ light: "dusk", sky: "#E9B9C8" });
    set.hemi.intensity = 1.25;
    set.sun.position.set(-10, 14, 10);
    const house = cloneWithColors(models.cameos_porch);
    set.add(house);
    const door = findNodes(house, "Door")[0];
    // warm porch light pooling on the doormat
    const lamp = new THREE.PointLight("#FFD27A", 6, 9, 1.6);
    lamp.position.set(1.25, 2.1, 0.6);
    set.add(lamp);
    // the lawn sits a step below the porch deck; hedges + a sunset backdrop for wide shots
    const lawn = new THREE.Mesh(set.own(new THREE.PlaneGeometry(120, 120)), set.own(new THREE.MeshStandardMaterial({ color: "#7CB342", roughness: 1 })));
    lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.34; lawn.receiveShadow = true;
    set.add(lawn);
    const hedgeMat = set.own(new THREE.MeshStandardMaterial({ color: "#4E8F3A", roughness: 1 }));
    const hedgeGeo = set.own(new THREE.SphereGeometry(1.4, 12, 8));
    for (const x of [-7.5, -6, 6, 7.5]) {
        const hd = new THREE.Mesh(hedgeGeo, hedgeMat);
        hd.position.set(x, 0.3, 1.5); hd.scale.set(1.2, 0.8, 1.1); hd.castShadow = true;
        set.add(hd);
    }
    const back = new THREE.Mesh(set.own(new THREE.PlaneGeometry(90, 40)), set.own(new THREE.MeshBasicMaterial({ color: "#F6C9A8" })));
    back.position.set(0, 12, -14);
    set.add(back);
    setParts = { house, door };
}

export async function startPorch(opts = {}) {
    if (porch) return;
    porch = { loading: true };
    const style = shared.get().luluHairStyle || "sheitel";
    const keys = ["cameos_porch", "avigailPerson"];
    if (style !== "sheitel") keys.push("luluPerson_" + style);
    const ok = await loadModels(keys);
    if (!ok || porch.cancel) { porch = null; return; }
    setState("cameosPorch", opts);
}

// three.js frame: the porch faces +Z (Blender −Y); the house interior is −Z.
registerState("cameosPorch", {
    hud: false, touch: false, pausable: true, world: false,
    enter(data, prev) {
        if (!set) buildSet();
        const p = porch = { loading: false, t: 0, doorOpen: 0, wantOpen: false, expr: "suspicious", step: 0, steps: 0, total: 0,
            rugelach: false, from: prev, data, cam: new SetCam(set.camera), knocking: 0, done: false, door: setParts.door };
        p.lulu = luluOnFoot();
        p.lulu.obj.position.set(0.3, 0, 1.75);
        p.lulu.obj.rotation.y = Math.PI;          // facing the door
        p.her = spawnPerson("avigailPerson");
        p.her.obj.position.set(-0.05, 0, -0.6);   // just inside the doorway
        set.add(p.lulu.obj, p.her.obj);
        if (p.door) p.door.rotation.y = 0;
        set.show();
        A.setMusic("../avigail.mp3");
        A.updateEngine(0, 0, 0, 0, false, false);
        A.sfxHorn(false);
        fade(1, 0); fade(0, 0.6);
        runPorch(p).catch(e => { console.error("[cameos porch]", e); finishPorch(); });
    },
    exit() {
        closeDialog();
        chips([]); clearCaptions();
        if (porch && porch.lulu) set.scene.remove(porch.lulu.obj, porch.her.obj);
        set.hide();
        porch = null;
    },
    update(dt, P) {
        const p = porch;
        if (!p || p.loading) return;
        p.t += dt;
        // the door swings inward on its left hinge
        p.doorOpen += ((p.wantOpen ? 1 : 0) - p.doorOpen) * Math.min(1, dt * 4);
        if (p.door) p.door.rotation.y = ease(p.doorOpen) * 1.75;
        const ex = p.expr;
        p.lulu.update(dt, { point: p.knocking > 0 });
        if (p.knocking > 0) {
            p.knocking -= dt;
            const arm = p.lulu.limbs.Arm_R;
            if (arm) arm.rotateX(Math.sin(p.t * 24) * 0.3);
        }
        p.her.update(dt, { talk: p.doorOpen > 0.5, cheer: ex === "excited" || ex === "love", wave: ex === "dramatic" || ex === "panic",
            point: ex === "annoyed" || ex === "smug" });
        p.her.obj.visible = p.doorOpen > 0.12;    // she's behind the door until it opens
        // camera: a wide establishing shot, then over Lulu's shoulder, drifting in as the chat warms up
        const k = Math.min(1, p.steps / 6);
        if (p.t < 2.0) p.cam.to(-3.4, 2.6, 8.5, 0, 1.4, 0, dt, 1.2);
        else if (p.done) p.cam.to(2.2, 1.9, 5.2, 0, 1.3, 0, dt, 1.5);
        else p.cam.to(1.25 - k * 0.35, 1.9, 4.6 - k * 0.9, -0.15, 1.45, -0.4, dt, 1.8);
    },
});

function updateChips(p) {
    const r = rel();
    const list = [`${relLabel(r)} <small>${r}/100</small>`];
    if (p.rugelach) list.push("🍪 promised");
    if (p.total && !p.done) list.push(`♥ ${Math.min(p.step + 1, p.total)} / ${p.total}`);
    chips(list);
}

async function runPorch(p) {
    await wait(0.8);
    caption("*knock knock knock*", "gold", 2200);
    sfx.knock(); p.knocking = 0.8;
    await say("Lulu", "Knock knock! I KNOW you're home, Avigail.", { emoji: "💁‍♀️", color: "#E91E63", auto: 1.4 });
    if (porch !== p) return;
    p.wantOpen = true;
    A.sfxSelect();
    await wait(0.6);
    const script = buildAvigailScript();
    p.total = script.length;
    for (let i = 0; i < script.length; i++) {
        if (porch !== p) return;
        const step = script[i];
        p.step = i; p.expr = step.expr; p.steps++;
        updateChips(p);
        const k = await choose("Avigail", step.prompt, step.choices.map(c => c.label), Object.assign({}, AVI, { emoji: EXPR[step.expr] }));
        if (porch !== p || k < 0) return;
        const ch = step.choices[k];
        // the door promise pays off later — Avigail never forgets a promised pastry
        if (step.isOpener && k === step.rugelachIdx) { p.rugelach = true; sfx.sting(); }
        p.expr = ch.expr;
        updateChips(p);
        await say("Avigail", ch.reply, Object.assign({}, AVI, { emoji: EXPR[ch.expr], auto: 2.2 }));
    }
    if (porch !== p) return;
    p.done = true; p.expr = "excited";
    updateChips(p);
    sfx.fanfare();
    await say("Avigail", pick(CLOSERS), Object.assign({}, AVI, { emoji: EXPR.excited, auto: 2.2 }));
    finishPorch();
}

function finishPorch() {
    const p = porch;
    if (!p) return;
    // a whole porch visit, survived → the rivalry thaws (+6, +4 more for the rugelach)
    bump(6 + (p.rugelach ? 4 : 0));
    fade(1, 0.4);
    setTimeout(() => {
        fade(0, 0.6);
        resumeDriving({ banner: `💜 <b>AVIGAIL JOINED!</b><small>2× POINTS while she rides shotgun</small>` });
        startRide();
    }, 450);
}

// ── she rides shotgun: 2× points (the 2D game's pointMult = 2) ───────────
const RIDE_SECS = 75;
let ride = null;
export function startRide(secs = RIDE_SECS) {
    stopRide(true);
    if (!models.avigailPerson) return;
    const p = spawnPerson("avigailPerson", { scale: 0.92 });
    const holder = new THREE.Group();
    holder.add(p.obj);
    p.obj.position.set(0, -0.36, 0.05);
    ctx.car.attach("passenger", holder);
    ride = { p, holder, t: secs, quipT: 9, lastScore: ctx.G.score };
    ctx.G.avigailRide = true;
}
export function stopRide(quiet) {
    if (!ride) return;
    if (ctx.car.attached && ctx.car.attached.passenger === ride.holder) ctx.car.attach("passenger", null);
    if (!quiet) H.toast("💅 Drop me here — I have a nail appointment. Bye, Bruck!", "pink");
    ride = null;
    ctx.G.avigailRide = false;
}
export const rideActive = () => !!ride;
hook("update", (dt, P, controlsOn) => {
    if (!ride) return;
    const G = ctx.G;
    ride.p.update(dt, { sit: true, talk: ride.quipT > 7, cheer: G.boosting });
    if (!controlsOn) { ride.lastScore = G.score; return; }
    const gained = G.score - ride.lastScore;
    if (gained > 0) G.score += gained;          // 2× points
    ride.lastScore = G.score;
    if ((ride.quipT -= dt) <= 0) { ride.quipT = rand(11, 16); H.toast(`💜 ${pick(RIDE_QUIPS)}`, "pink"); }
    if ((ride.t -= dt) <= 0) stopRide(false);
});
on("run:start", () => stopRide(true));
on("wreck", () => { if (ride) { H.toast("💜 \"I'm getting out HERE!\"", "pink"); stopRide(true); } });
on("foot:start", () => stopRide(true));

export const AVIGAIL_TEXT = { AVIGAIL_ROAD_TAUNTS, LULU_ROAD_REPLIES, AVIGAIL_PULLED_YELLS, OPENERS, MIDDLES, SNACKS, CLOSERS };
