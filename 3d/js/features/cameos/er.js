// features/cameos — THE ER (src/10e-hospital.js): a softer landing than game
// over. The ambulance gets there first; Lulu wakes up in the ER, Dr. Shtern
// delivers a (ridiculous) diagnosis, Nurse Tammy — her big sister — clocks her
// (her mood sets the bill), a relative or a weirdo drops by, Lulu picks her
// care (or makes a run for it in a hospital gown), pays the MEDICAL BILL out
// of the shared wallet and is discharged back onto the road. Every visit
// punches the shared ER frequent-flyer card (save.erVisits).
//   ctx.er.admit(reason)   reason: "crash" | "knockout" | anything
import { ctx, on, emit, registerState, setState, pick, rand, css } from "../../core/ctx.js";
import { registerModels } from "../../models.js";
import { makeSet, makeRoom, textPlane } from "../../core/sets.js";
import { say, choose, closeDialog } from "../../core/dialog.js";
import { spawnPerson } from "../../core/people.js";
import { Particles } from "../../car.js";
import { glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import {
    THREE, models, cloneWithColors, findNodes, shared, wallet, bubble, loadModels, clamp, ease, lerp, wait, stat, charge, caption, clearCaptions,
    chips, fade, sfx, SetCam, prop, inHand, onBody, luluHair, roadPoint,
} from "./common.js";
import { resumeDriving } from "./resume.js";

registerModels({
    cameos_ambulance: "cameos_ambulance", cameos_erProps: "cameos_er_props", cameos_doctor: "cameos_doctor", cameos_tammy: "cameos_tammy",
    cameos_raphael: "cameos_raphael", cameos_rabbi: "cameos_rabbi", cameos_clown: "cameos_clown", cameos_zaidy: "cameos_zaidy", cameos_fayge: "cameos_fayge",
});

// ── the 2D ER's script ───────────────────────────────────────────────────
const DIAGNOSES = ["a mild case of the OOFs", "two broken nails and a bruised ego", "whiplash — from your own SASS", "a boo-boo. A BIG boo-boo",
    "a concussion (or you're just like this)", "road rash and a wounded reputation", "one (1) ouchie, doctor's note attached", "a fractured sense of caution"];
const DOC_GREET = ["You're awake! Don't sue us.", "Well well. The famous Lulu.", "BP's high, attitude's higher.", "Welcome back to the land of the living.",
    "You flatlined your DIGNITY, mostly."];
const DOC_REPEAT = ["You AGAIN?! We should charge rent.", "Back so soon? I kept your bed warm.", "Lulu. Of COURSE it's Lulu.", "Third gown this WEEK, young lady.",
    "Frequent-flyer miles don't cover THIS."];
//   lives: hearts gained · gift: free item · risk: chance a cheap fix goes wrong
const HOSP_CARE_POOL = [
    { label: "🩹 Just patch me up", billMul: 1.0, lives: 0, say: "Band-aid, a lollipop, you're golden. Try the BRAKES next time." },
    { label: "💊 The GOOD stuff, doc!", billMul: 2.0, lives: 1, say: "Premium care! Extra heart on the house. Wheee~ 💕" },
    { label: "🩻 Full body scan", billMul: 1.6, lives: 1, say: "Everything's... mostly where it goes. Bonus heart." },
    { label: "💉 Pocket the painkillers", billMul: 1.2, lives: 0, gift: "pepper", say: "*slips a few in her bag* ...for the road. 🌶️" },
    { label: "🧴 Bandage, I'm fine!", billMul: 0.6, lives: 0, risk: 0.4, say: "Barely even bleeding. ...Mostly. Off you go, gonif." },
    { label: "🦴 Set the broken bits", billMul: 1.8, lives: 2, say: "*CRACK CRACK* Good as... 90% new! TWO bonus hearts, brave girl." },
    { label: "🍲 Bubbe's cholent cure", billMul: 0.9, lives: 1, say: "Tammy snuck it in. Cures EVERYTHING. Free heart, bubbeleh. 💕" },
    { label: "🧠 'Am I concussed?'", billMul: 1.3, lives: 0, risk: 0.25, say: "Follow my finger. ...Other finger. Yeah, you're 'fine.'" },
    { label: "✨ Whatever's cheapest", billMul: 0.6, lives: 0, risk: 0.45, say: "Generic everything. Tastes like pennies. Prob'ly fine!" },
    { label: "🫀 Premium VIP suite", billMul: 2.4, lives: 2, gift: "missile", say: "Robe, slippers, a TV — and they 'forgot' a flare in your bag. 🚀" },
    { label: "🩼 The works + crutches", billMul: 2.1, lives: 1, gift: "missile", say: "Crutches you won't use and a parting gift. Don't ask. 🚀" },
];
const HOSP_DASH = { label: "🏃 Skip the bill — RUN!", billMul: 0, dash: true };
const ER_ESCAPES = [
    { attempt: "🪟 She DIVES through the ER window!", visual: "window" },
    { attempt: "🥼 ...struts out in a stolen lab coat.", visual: "coat" },
    { attempt: "♿ Wheelchair getaway — beep beep!", visual: "chair" },
    { attempt: "🛏️ ...rides a runaway gurney like a sled!", visual: "gurney" },
    { attempt: "🌀 ...up into the air vent, spy-movie style!", visual: "vent" },
];
const ER_CLEAN = ["...and she's GONE. Little gonif. 🏃💨", "...vanished. In a HOSPITAL GOWN. Iconic.", "Security was on a bagel break. 🥯",
    "Filmed her own escape for TikTok. #blessed", "Hopped the bus in a gown. Nobody blinked."];
const ER_CAUGHT = [
    { line: "A sweet old lady blocks her — then rips off the shawl: IT'S A COP! 👵🚔", visual: "oldlady" },
    { line: "She bursts outside — into a WALL of waiting cop cars. 🚓🚓🚓", visual: "cars" },
    { line: "The 'doctor' clamps her shoulder — badge under the coat. 🩺🚔", visual: "doccop" },
    { line: "A guard tackles her at the sliding doors. OOF. 🚨", visual: "guard" },
];
const TAMMY_GREET = {
    sweet: ["LULU?! Oh my GOSH — are you OKAY?!", "Of all the ERs in town, you crash into MINE.", "Sit STILL, mamaleh, I've got you. It's me.",
        "My baby sister! ...what did you DO this time?"],
    scold: ["FOUR times this month, Lulu. FOUR.", "I'm telling Ma. And Bubbe. And Abba. ALL of them.", "You'll pay this off babysitting Dina. For a YEAR.",
        "I clock out in five minutes and HERE you are."],
    gossip: ["Did you hear Avigail's ENGAGED? In MY ER you find out.", "You didn't bring me a coffee. Typical Lulu.",
        "Ooh, sit — I have SO much to tell you about Esti.", "I covered your name on the chart. You're WELCOME."],
};
const TAMMY_CARE = {
    sweet: ["There — stitched, kissed, FREE of charge. Don't tell my boss. 💕", "Family discount. Now GO, before a doctor sees this.",
        "All patched. Text Ma you're alive, she's been calling ME."],
    scold: ["Fine. Full price, and I'm rounding UP. 🧾", "Patched. NO discount — maybe THAT'll teach you.", "There. Now drive like you've got a sister who worries."],
    gossip: ["Half off — but you owe me ALL the details. 🤭", "Sister rate. Spill about Avigail and we're square.", "Discounted. Hold still and tell me EVERYTHING."],
};
const CAMEOS = [
    { who: "HILLEL", body: "hillel", emoji: "🧮", color: "#1565C0", sub: "🧮 Tammy's husband — the actuary (between jobs)", hillel: true, lines: [
        "Tammy texted me. Actuarially, Lulu, your crash rate is... off the charts.", "I ran your numbers on the drive over. You're a 94th-percentile risk. Yikes.",
        "I'd put this through insurance, but they, ah... let me go on Tuesday.", "Between jobs right now! But statistically, SOMETHING'll turn up, right?",
        "As your former-ish insurance guy: please, PLEASE stop totaling cars.", "I updated your premium in my head. It made me a little nauseous."] },
    { who: "UNCLE RAPHAEL", body: "raphael", emoji: "💢", color: "#E65100", sub: "💢 your uncle — adores Hillel, not you", lines: [
        "Oy, THIS one. Always was the clumsy little niece, nu?", "Hillel! Mein kind — did you tell her about the turbo I found you? A METSIAH.",
        "Two THOUSAND dollars that part, and feh, never worked. But Hillel TRIED. Good boy.", "Your sister Tammy? Don't get me started. But Hillel — Hillel is FAMILY.",
        "In MY day we didn't crash cars, we DROVE them. Properly.", "I'd lend you gelt for the bill, but, eh... I'm saving it. For Hillel."] },
    { who: "BUBBE", body: "bubbe", emoji: "👵", color: "#8E5CC2", sub: "👵 she brought food. obviously.", lines: [
        "I brought CHOLENT. You'll eat it ALL — you're skin and bones, mamaleh.", "A hospital?! Did they even offer you tea? No? FEH. Barbarians.",
        "I lit a candle for you. And one for the other driver. I'm FAIR.", "Your cousin Esti would NEVER crash. I'm just SAYING, sweetheart.",
        "When I was your age we didn't HAVE cars. We walked. Uphill. BOTH ways.", "Eat. Eat! The nurse is too skinny also. EVERYONE in here, eat!"] },
    { who: "AVIGAIL", body: "avigail", emoji: "💅", color: "#6A1B9A", sub: "💅 your nemesis — here to gloat", lines: [
        "Crashed AGAIN? And here I am — engaged AND completely unscratched. 💍", "I'd sign your cast, but I JUST got my nails done. You understand.",
        "I only came to see if it was as bad as everyone's saying. ...It is. 💅", "Should I post this? For your followers? Oh wait — you have none.",
        "Get well soon-ish. The wedding's Sunday and you are NOT on the list."] },
    { who: "A NOSY DOCTOR", body: "doctor", emoji: "🩺", color: "#00897B", sub: "🩺 not even your doctor", lines: [
        "Second opinion: yep, still reckless. That'll be another 💰50.", "I'm not your doctor. I just heard there was DRAMA. Please, continue.",
        "Good news: you're alive! Bad news: we're fresh out of lollipops.", "We googled your symptoms. WebMD says, and I quote, 'stop doing that.'",
        "Your X-ray is GORGEOUS. Frame-worthy. Still broken, mind you.", "Filing this on insurance? *laughs in medical bill* Oh, you're serious."] },
    { who: "OFFICER KRUPKE", body: "cop", emoji: "👮", color: "#283593", sub: "👮 keeping an eye on you", lines: [
        "Just making sure you didn't ESCAPE. ...Don't get any ideas.", "Officer Krupke. We've MET. Several times. This week, actually.",
        "Heal up quick — your court date waits for NO ONE, ma'am.", "Love the gown. Very 'flight risk.' I'll be right outside. 👮"] },
    { who: "THE RABBI", body: "rabbi", emoji: "✡️", color: "#455A64", sub: "✡️ here for a refuah shleimah", lines: [
        "Refuah shleimah, Lulu. And maybe — just maybe — slow down a little?", "I'm not saying it's a SIGN. But your bumper did say 'HONK FOR MOSHIACH.'",
        "Everyone makes mistakes. You just make yours at eighty miles an hour.", "I'll add you to the Mi Shebeirach. Under the 'frequent flyers' section.",
        "They say G-d watches over fools and children. You, He double-shifts."] },
    { who: "BOZO THE CLOWN", body: "clown", emoji: "🤡", color: "#D32F2F", sub: "🤡 lost from the kids' ward", lines: [
        "Wrong ward — I do the KIDS' floor — but honk honk anyway! 🤡", "Balloon animal? This one's a... totaled sedan. Too soon? 🎈",
        "Why the long face? Oh. Right. The car. ...Tough crowd tonight.", "Knock knock! Who's there? Your insurance adjuster! (It is not.)"] },
    { who: "SOME KID", body: "kid", emoji: "🧒", color: "#2E7D32", sub: "🧒 a little fan, kind of", lines: [
        "Are you the lady who hit the ICE CREAM TRUCK?! You're a LEGEND. 🍦", "My mom says you drive like a 'farkakteh.' What's a farkakteh?",
        "Can I have your wheelchair when you're done? I wanna go FAST.", "I drew you a picture! It's the crash. There's a LOT of red, see?"] },
    { who: "A NOSY ZAIDY", body: "oldman", emoji: "👴", color: "#546E7A", sub: "👴 unimpressed by your generation", lines: [
        "In MY day a fender-bender meant a handshake and a brisket. FEH.", "You drive like your grandmother. And SHE'S banned from the roads!",
        "I had a car just like yours. Once. Before YOU were allowed to drive.", "*adjusts hearing aid* They said you crashed into a WHAT now?"] },
    { who: "SISTER FAYGE", body: "fayge", emoji: "🧂", color: "#00796B", sub: "🧂 your sister — anti-salt, plus baby Chani", lines: [
        "Refuah shleimah! Now — is there SALT in that IV drip? I'll ASK a nurse. 🧂🚫", "I brought you soup. Unsalted, naturally. *gently rocks baby Chani* 👶",
        "Eat something, Lulu, you're all skin and bones — says ME, ironically. 😅", "Shhh, Chani, shhh — the nice lady just crashed, that's ALL, sweetie.",
        "The cafeteria food here? The SODIUM, feh — I'd sooner fast, honestly.", "Hold Chani a moment? ...oh. The whole arm's in a cast. Never mind! 🤱"] },
    { who: "UNCLE YEDIDYA", body: "yedidya", emoji: "🥛", color: "#6D4C41", sub: "🥛 your uncle — raw milk, no vaccines, still single", lines: [
        "You're only sick because they PASTEURIZE everything! Raw milk, refuah shleimah! 🥛", "No shots. NO SHOTS. I'll sign whatever waiver — just keep the needles AWAY.",
        "I brought a jug from the farm. Room temperature, unfiltered, totally illegal. Drink up!", "Forty-two, single, and NEVER been vaccinated. Picture of health, kein ayin hara.",
        "This IV? Probably GMO. I'll go find you an organic one, hold on."] },
    { who: "UNCLE BURRY", body: "burry", emoji: "😎", color: "#2E7D32", sub: "😎 your chill uncle — Lakewood→Vegas, wife + kids", lines: [
        "Whoaa, you okay cuz? ...I brought snacks. Hospital vending machines are a RACKET. 😎", "We're driving to Vegas tomorrow. Heal up quick and COME with, man!",
        "Mindy says refuah shleimah. The kids drew you a card... it's in the van somewhere.", "So chill in here. Great vibes. Little beepy, but great vibes.",
        "You want the desert air, cuz. Dry heat fixes EVERYTHING. Ask my guy."] },
    { who: "UNCLE SHUEY", body: "shuey", emoji: "🩺", color: "#0277BD", sub: "🩺 your uncle — a doctor; divorced, cat R.I.P.", lines: [
        "As a doctor, this is nothing. As your uncle... rough year though, huh? Me too.", "First the divorce, then Fluffy passed... but hey. At least I've got Avraham.",
        "*sniffs* I'm not crying. Doctors don't cry. ...Avraham, say hi to Aunt Lulu.", "I'd write you a prescription but honestly? Some things they don't make a pill for.",
        "Take it from me: buckle up, drive slow, and hug your cat while you still can. 😿"] },
];
const BODY = {   // visitor → model (+ recolour / hand prop)
    hillel: { key: "hillelPerson" }, raphael: { key: "cameos_raphael" }, bubbe: { key: "bubbe", static: true }, avigail: { key: "avigailPerson" },
    doctor: { key: "cameos_doctor", colors: { Top: "#CE93D8", Hair: "#3E2723", Beard: "#3E2723" } }, cop: { key: "copPerson" }, rabbi: { key: "cameos_rabbi" },
    clown: { key: "cameos_clown" }, kid: { key: "npcKid", colors: { Top: "#A5D6A7" } }, oldman: { key: "cameos_zaidy" }, fayge: { key: "cameos_fayge" },
    yedidya: { key: "cameos_yedidya", hand: "MilkJug" }, burry: { key: "cameos_burry" }, shuey: { key: "cameos_shuey" },
};
const DOC = { emoji: "🩺", color: "#00897B" };
const TAMMY = { emoji: "👩‍⚕️", color: "#EC407A" };

function rollOptions() {
    const pool = HOSP_CARE_POOL.slice(), out = [];
    for (let k = 0; k < 2; k++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    out.push(HOSP_DASH);
    return out;
}
function buildVisit() {
    if (Math.random() < 0.28) return [];                 // nobody today
    const first = pick(CAMEOS);
    const out = [{ c: first, text: pick(first.lines) }];
    if (Math.random() < 0.22) {                          // a SECOND well-wisher wanders in
        const second = pick(CAMEOS);
        if (second !== first) out.push({ c: second, text: pick(second.lines) });
    }
    return out;
}

// ── admit ────────────────────────────────────────────────────────────────
let E = null;
export function erVisits() { return shared.get().erVisits || 0; }
/** Wake Lulu up in the ER. Returns true (callers can use it as a reprieve). */
export function admit(reason = "crash", opts = {}) {
    if (E) return true;
    const force = Object.assign({}, (ctx.cameos && ctx.cameos.force) || {}, opts.force || {});
    shared.update(s => { s.erVisits = (s.erVisits || 0) + 1; });
    const visits = erVisits();
    const mood = force.tammy || pick(["sweet", "scold", "gossip"]);
    let visit = buildVisit();
    if (force.visitor) { const c = CAMEOS.find(x => x.body === force.visitor); visit = c ? [{ c, text: pick(c.lines) }] : []; }
    if (force.visitor === false) visit = [];
    E = {
        reason, visits, force, mood, visit, loading: null, prev: ctx.state,
        greet: visits >= 3 && Math.random() < 0.7 ? pick(DOC_REPEAT) : pick(DOC_GREET),
        diagnosis: pick(DIAGNOSES), options: force.options || rollOptions(),
        discount: mood === "sweet" ? 0 : mood === "gossip" ? 0.5 : 1.15,
        tammyGreet: pick(TAMMY_GREET[mood]), tammyCare: pick(TAMMY_CARE[mood]),
        hillelVisited: visit.some(v => v.c.hillel), music: Math.random() < 0.5 ? "../er1.mp3" : "../er2.mp3",
        hearts: ctx.G.hearts || 0,
    };
    const st = luluHair().style;
    const keys = ["cameos_erProps", "cameos_doctor", "cameos_tammy", "copPerson", "npcWoman", "cameos_props"];
    if (st !== "sheitel") keys.push("luluPerson_" + st);
    for (const v of visit) { const b = BODY[v.c.body]; if (b) keys.push(b.key); if (v.c.body === "shuey") keys.push("npcKid", "cameos_catAngel"); }
    E.loading = loadModels(keys);
    emit("er:admit", { reason, visits });
    const intro = force.intro !== undefined ? force.intro : (reason === "crash" && !ctx.view && Math.random() < 0.6);
    if (intro) { E.ambLoading = loadModels(["cameos_ambulance"]); setState("cameosAmbulance"); }
    else setState("cameosER");
    return true;
}
ctx.er = { admit, visits: erVisits, get active() { return !!E; } };

// ── the ambulance ride-in (in the driving world) ─────────────────────────
let amb = null;
registerState("cameosAmbulance", {
    hud: false, touch: false, pausable: false, world: true,
    enter() {
        amb = { t: 0, obj: null, s: 0, speed: 21, lights: [], leaving: false, cam: { from: new THREE.Vector3(), look: new THREE.Vector3() } };
        A.setMusic(null);
        A.updateEngine(0, 0, 0, 0, false, false);
        caption("🚑 AMBULANCE INCOMING…", "gold");
        caption(E && E.reason === "knockout" ? "(out cold on the pavement…)" : "(everything's going dark…)", "");
        sfx.siren();
        (E && E.ambLoading || Promise.resolve()).then(() => {
            if (!amb || !models.cameos_ambulance) return;
            amb.obj = cloneWithColors(models.cameos_ambulance);
            amb.obj.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { o.material = o.material.clone(); amb.lights.push(o.material); } });
            amb.wheels = findNodes(amb.obj, "Wheel_");
            amb.s = ctx.car.s - 70; amb.d = clamp(ctx.car.d, -5.25, 5.25);
            ctx.scene.add(amb.obj);
        });
    },
    exit() { if (amb && amb.obj) ctx.scene.remove(amb.obj); amb = null; clearCaptions(); },
    update(dt, P) {
        if (!amb) return;
        amb.t += dt;
        ctx.car.updateVisual(dt, ctx.time, { steer: 0, throttle: 0, brake: 0 }, false);
        if (amb.obj) {
            const stopS = ctx.car.s - 8;
            amb.speed = Math.max(0, Math.min(amb.speed, Math.sqrt(Math.max(0, stopS - amb.s) * 2 * 9)));
            amb.s += amb.speed * dt;
            const p = roadPoint(amb.s, amb.d);
            amb.obj.position.set(p.x, 0, p.z); amb.obj.rotation.y = p.h;
            for (const w of amb.wheels) w.rotation.x += amb.speed * dt / 0.42;
            amb.lights.forEach((m, i) => { m.emissiveIntensity = Math.sin(amb.t * 13 + (i % 2) * Math.PI) > 0 ? 6 : 0.4; });
            if (Math.floor(amb.t / 0.8) !== Math.floor((amb.t - dt) / 0.8)) sfx.siren();
        }
        if (!amb.leaving && (amb.t > 4.0 || (amb.t > 2.9 && (P.confirm || P.start)))) {
            amb.leaving = true;
            fade(1, 0.5);
            setTimeout(() => { if (ctx.state === "cameosAmbulance") setState("cameosER"); }, 520);
        }
    },
    camera(dt) {
        if (!amb) return false;
        const car = ctx.car, road = ctx.world.road;
        const side = car.d > 0 ? -1 : 1;
        const a = road.point(car.s + 9, car.d + side * 5.5, {});
        const tgt = amb.obj ? amb.obj.position : car.pos;
        amb.cam.from.set(a.x, 1.5, a.z);
        amb.cam.look.set((car.pos.x + tgt.x) / 2, 1.2, (car.pos.z + tgt.z) / 2);
        ctx.cam.cinematic(amb.cam.from, amb.cam.look, dt, 2, 48);
        return true;
    },
});

// ── the ER room ──────────────────────────────────────────────────────────
let set = null, room = null, cast = [];
function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return { c, t, g: c.getContext("2d") };
}
function buildSet() {
    set = makeSet({ light: "indoor", sky: "#DCEEEB" });
    set.hemi.color.set("#F2FFFC"); set.hemi.intensity = 1.45;
    set.sun.intensity = 1.0;
    makeRoom(set, { w: 10, d: 8, h: 3.6, floor: "#A9C9C4", walls: "#CFE7E3", trim: "#6F9B96" });
    const P = models.cameos_erProps;
    const part = n => { const o = findNodes(P, n)[0]; return o ? o.clone(true) : new THREE.Group(); };
    const mat = c => set.own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(set.own(new THREE.BoxGeometry(w, h, d)), mat(c)); m.position.set(x, y, z); m.receiveShadow = true; set.add(m); return m; };
    // wainscot band + rail, ceiling, vinyl floor with seams
    box(10, 1.0, 0.04, "#9FC4BF", 0, 0.5, -3.88); box(10, 0.06, 0.08, "#6F9B96", 0, 1.02, -3.86);
    box(0.04, 1.0, 8, "#9FC4BF", -4.88, 0.5, 0); box(0.04, 1.0, 8, "#9FC4BF", 4.88, 0.5, 0);
    const ceil = new THREE.Mesh(set.own(new THREE.PlaneGeometry(10, 8)), mat("#EEF6F4"));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.6; set.add(ceil);
    const fl = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#B5D3CE"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(0,0,0,0.08)"; g.lineWidth = 2;
        for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); }
        g.fillStyle = "rgba(255,255,255,0.12)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    });
    fl.t.wrapS = fl.t.wrapT = THREE.RepeatWrapping; fl.t.repeat.set(4, 3.2); set.own(fl.t);
    const floor = new THREE.Mesh(set.own(new THREE.PlaneGeometry(10, 8)), set.own(new THREE.MeshStandardMaterial({ map: fl.t, roughness: 0.45 })));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.003; floor.receiveShadow = true; set.add(floor);
    const add = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; set.add(o); return o; };
    const bed = add(part("Bed"), 0, 0, -1.7);
    const monitor = add(part("Monitor"), -1.75, 0, -2.55, 0.45);
    add(part("IVPole"), 0.95, 0, -2.7);
    add(part("Cabinet"), -4.55, 0, -2.3, Math.PI / 2);
    add(part("RedCross"), 0, 2.55, -3.86);
    add(part("Doors"), -2.9, 0, -3.84);
    add(part("Window"), -4.85, 1.75, -0.4, Math.PI / 2);
    add(part("Vent"), 1.7, 3.57, 0.7);
    add(part("Sanitizer"), 1.05, 1.45, -3.84);
    add(part("VisitorChair"), 2.35, 0, -0.1, -2.3);
    const lights = [add(part("Light"), -1.5, 3.56, -1.6), add(part("Light"), 1.5, 3.56, -1.6)];
    const panelMats = [];
    for (const l of lights) l.traverse(o => { if (o.isMesh && o.material.name === "NeonPanel") { o.material = o.material.clone(); panelMats.push(o.material); } });
    const clock = add(part("Clock"), 2.55, 2.75, -3.84);
    const hand = (len, w, c) => { const m = new THREE.Mesh(set.own(new THREE.BoxGeometry(w, len, 0.01)), mat(c)); m.geometry.translate(0, len / 2, 0); m.position.z = 0.035; clock.add(m); return m; };
    const minute = hand(0.2, 0.025, "#37474F"), second = hand(0.24, 0.01, "#E53935");
    // privacy curtain on a rail, gently swaying
    const curtain = new THREE.Group();
    curtain.position.set(3.0, 3.25, -1.2); curtain.rotation.y = Math.PI / 2; set.add(curtain);
    curtain.add(part("CurtainRail"));
    const panels = [];
    for (let i = 0; i < 6; i++) { const c = part("Curtain_" + i); c.position.x = -1.55 + i * 0.6; curtain.add(c); panels.push(c); }
    const chart = textPlane(["E", "F P", "T O Z", "L P E D"], { w: 0.55, h: 0.75, bg: "#ffffff", fg: "#37474F", font: 72 });
    chart.position.set(-1.35, 1.95, -3.86); set.add(chart); set.own(chart.material.map, chart.material);
    // heart monitor: a live EKG on its screen
    const ekg = canvasTex(256, 168, () => {});
    set.own(ekg.t);
    const scr = new THREE.Mesh(set.own(new THREE.PlaneGeometry(0.52, 0.34)), set.own(new THREE.MeshBasicMaterial({ map: ekg.t })));
    scr.position.set(0, 1.46, 0.122); monitor.add(scr);
    // emergency lights for when she's BUSTED
    const red = new THREE.PointLight("#FF1744", 0, 14, 1.4), blue = new THREE.PointLight("#2979FF", 0, 14, 1.4);
    red.position.set(-2.5, 2.6, 1); blue.position.set(2.5, 2.6, 1); set.add(red, blue);
    const fx = new Particles(set.scene, 200);
    room = { bed, monitor, ekg, panelMats, minute, second, panels, red, blue, fx, P };
}
function drawEkg(t) {
    const { g, c } = room.ekg;
    const W = c.width, Hh = c.height;
    g.fillStyle = "#0A140F"; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = "rgba(57,255,122,0.15)"; g.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke(); }
    g.strokeStyle = "#39FF7A"; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= W; x += 4) {
        const tt = (x / W) * 6 + t * 4, beat = tt % 6;
        const y = Hh * 0.45 - (beat > 2.6 && beat < 3.2 ? Math.sin((beat - 2.6) / 0.6 * Math.PI) * 52 : 0);
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = "#39FF7A"; g.font = "bold 24px monospace";
    g.fillText(`${Math.sin(t * 6) > 0 ? "♥" : " "} ${78 + Math.floor(Math.sin(t) * 6)} BPM`, 12, Hh - 14);
    room.ekg.t.needsUpdate = true;
}

/** Lulu lying in bed, propped up: torso reclined on the bed's back section, legs flat. */
function bedLulu() {
    const h = luluHair();
    const key = models["luluPerson_" + h.style] ? "luluPerson_" + h.style : "luluPerson";
    const p = spawnPerson(key, { colors: { Hair: h.color, Top: "#BFE3F0", Bottom: "#BFE3F0" } });
    const th = 0.95;
    p.obj.rotation.x = -th;
    p.obj.position.set(0, 0.8 - 0.8 * Math.cos(th), -1.86 + 0.8 * Math.sin(th));
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(Math.PI / 2 - th));
    p.pose = () => { for (const k of ["Leg_L", "Leg_R"]) { const L = p.limbs[k]; if (L) L.quaternion.copy(L.userData.base).multiply(qx); } };
    return p;
}

registerState("cameosER", {
    hud: false, touch: false, pausable: true, world: false,
    enter() {
        if (!E) { setState("title"); return; }
        E.ready = false;
        A.setMusic(E.music);
        A.updateEngine(0, 0, 0, 0, false, false);
        fade(1, 0);
        (E.loading || Promise.resolve()).then(() => {
            if (!E || ctx.state !== "cameosER") return;
            if (!models.cameos_erProps) { fade(0, 0.4); discharge(E, { hearts: 1, banner: "🩹 <b>Patched up!</b>" }); return; }
            if (!set) buildSet();
            setupCast(E);
            set.show();
            E.ready = true;
            fade(0, 1.2);
            runER(E).catch(err => { console.error("[cameos ER]", err); discharge(E, { hearts: 1 }); });
        });
    },
    exit() {
        closeDialog(); H.hideScreen(); clearCaptions(); chips([]);
        for (const o of cast) if (o.parent) o.parent.remove(o);
        cast = [];
        if (E && E.bubbles) for (const b of E.bubbles) b.dispose();
        if (room) { room.red.intensity = room.blue.intensity = 0; }
        if (set) set.hide();
        E = null;
    },
    update(dt, P) {
        if (!E || !E.ready) return;
        E.t = (E.t || 0) + dt;
        if (H.screenOpen()) H.menuInput(P);
        const t = E.t;
        drawEkg(t);
        if (Math.floor((t * 4 + 3.4) / 6) !== Math.floor(((t - dt) * 4 + 3.4) / 6)) sfx.beep();
        const flick = Math.sin(t * 37) > -0.92 ? 1 : 0.45;
        for (const m of room.panelMats) m.emissiveIntensity = 2.4 * flick;
        room.minute.rotation.z = -t * 0.12; room.second.rotation.z = -t * 1.4;
        room.panels.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.1 + i * 0.6) * 0.03; });
        room.fx.update(dt);
        if (E.busted) { const k = Math.sin(t * 12) > 0; room.red.intensity = k ? 9 : 0; room.blue.intensity = k ? 0 : 9; }
        // the cast
        E.lulu.update(dt, { talk: E.speaker === "lulu" }); E.lulu.pose();
        E.tammy.update(dt, { talk: E.speaker === "tammy", point: E.speaker === "tammy" && Math.sin(t * 2) > 0.6 });
        if (E.doc) { E.doc.update(dt, { talk: E.speaker === "doctor", walk: E.doc.walking ? 1.4 : 0 }); }
        for (const v of E.visitors) v.tick(dt);
        if (E.esc) escapeTick(E, dt);
        for (const b of E.bubbles) b.tick(dt);
        // camera: the bedside two-shot, leaning toward whoever's talking
        const sp = E.speaker === "doctor" && E.doc ? E.doc.obj.position : E.speaker === "tammy" ? E.tammy.obj.position
            : E.speaker === "visitor" && E.curVisitor ? E.curVisitor.obj.position : null;
        if (E.esc) E.cam.to(0.2, 2.6, 4.4, 0, 1.2, -1.0, dt, 1.6);
        else if (sp) E.cam.to(sp.x * 0.35 + 0.2, 1.95, 1.9, sp.x * 0.45, 1.25, -1.6, dt, 1.4);
        else E.cam.to(0.3, 2.3, 2.7, 0, 1.0, -1.7, dt, 1.2);
    },
});

function setupCast(e) {
    e.cast = cast = []; e.visitors = []; e.bubbles = [];
    e.cam = new SetCam(set.camera);
    e.lulu = bedLulu(); set.add(e.lulu.obj); e.cast.push(e.lulu.obj);
    e.tammy = spawnPerson(models.cameos_tammy ? "cameos_tammy" : "npcWoman");
    e.tammy.obj.position.set(-1.12, 0, -1.55); e.tammy.obj.rotation.y = Math.PI / 2;
    set.add(e.tammy.obj); e.cast.push(e.tammy.obj);
    e.doc = spawnPerson(models.cameos_doctor ? "cameos_doctor" : "npcMan");
    e.doc.obj.position.set(1.2, 0, -1.35); e.doc.obj.rotation.y = -Math.PI / 2;
    set.add(e.doc.obj); e.cast.push(e.doc.obj);
    updateChips(e);
}
function updateChips(e) {
    chips([`<span class="coin"></span> <b>${wallet.coins.toLocaleString()}</b>`, `🏥 visit #${e.visits}`]);
}

/** A bedside visitor walks in from behind the curtain. */
function visitor(e, v) {
    const b = BODY[v.c.body] || { key: "npcMan" };
    let obj, p = null;
    if (b.static) {
        obj = cloneWithColors(models[b.key]);
        obj.scale.setScalar(0.88);
    } else {
        p = spawnPerson(models[b.key] ? b.key : "npcMan", { colors: b.colors });
        obj = p.obj;
        if (b.hand) inHand(p, prop("cameos_props", b.hand), "R", [0, -0.5, 0.06]);
    }
    obj.position.set(3.6, 0, 0.6);
    set.add(obj); e.cast.push(obj);
    const arm = b.static ? findNodes(obj, "Arm_Wave")[0] : null;
    const base = arm ? arm.rotation.z : 0;
    let cat = null;
    if (v.c.body === "shuey" && models.cameos_catAngel) {
        cat = cloneWithColors(models.cameos_catAngel);
        cat.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; } });
        set.add(cat); e.cast.push(cat);
    }
    const target = new THREE.Vector3(1.2, 0, -0.75);
    const vis = { obj, p, arriving: true, talking: false,
        tick(dt) {
            const dx = target.x - obj.position.x, dz = target.z - obj.position.z, d = Math.hypot(dx, dz);
            if (d > 0.05) { const st = Math.min(d, 1.5 * dt); obj.position.x += dx / d * st; obj.position.z += dz / d * st; }
            const want = d > 0.05 ? Math.atan2(dx, dz) : Math.atan2(-obj.position.x, -1.7 - obj.position.z);
            obj.rotation.y += Math.atan2(Math.sin(want - obj.rotation.y), Math.cos(want - obj.rotation.y)) * Math.min(1, dt * 6);
            if (p) p.update(dt, { walk: d > 0.05 ? 1.5 : 0, talk: vis.talking });
            if (arm) arm.rotation.z = base + Math.sin(ctx.time * 7) * 0.45;
            if (cat) cat.position.set(obj.position.x, 2.2 + Math.sin(ctx.time * 1.7) * 0.1, obj.position.z);
            vis.arrived = d <= 0.05;
        } };
    e.visitors.push(vis);
    return vis;
}

async function runER(e) {
    const alive = () => E === e && ctx.state === "cameosER";
    caption("🏥 THE ER", "mint big", 2400);
    caption("...beep... beep...", "mint", 2200);
    await wait(1.6);
    if (!alive()) return;
    // Dr. Shtern's diagnosis
    e.speaker = "doctor";
    await say("Dr. Shtern", `${e.greet} You've got ${e.diagnosis}.`, DOC);
    if (!alive()) return;
    // Nurse Tammy — Lulu's big sister — clocks her
    e.speaker = "tammy";
    caption("👩‍⚕️ your big SISTER works here!", "pink", 4200);
    await say("Nurse Tammy", e.tammyGreet, TAMMY);
    if (!alive()) return;
    // the in-laws / wider cast drop by
    if (e.visit.length) {
        e.doc.walking = true;
        e.doc.obj.position.set(2.1, 0, -2.4);
    }
    for (const v of e.visit) {
        if (!alive()) return;
        const vis = visitor(e, v);
        e.curVisitor = vis; e.speaker = "visitor";
        caption(v.c.sub, "", 4200);
        const t0 = ctx.time;
        while (alive() && !vis.arrived && ctx.time - t0 < 3) await wait(0.05);
        vis.talking = true;
        await say(v.c.who, v.text, { emoji: v.c.emoji, color: v.c.color });
        vis.talking = false;
        if (e.visit.length > 1 && v !== e.visit[e.visit.length - 1]) { vis.obj.position.x += 0.9; vis.obj.position.z += 0.7; }
    }
    if (!alive()) return;
    clearCaptions();
    e.doc.walking = false;
    // pick your care
    e.speaker = "tammy";
    const labels = e.options.map(o => o.dash ? `${o.label} <small>(free — RISKY!)</small>` : `${o.label} <small>(~💰${Math.round(40 * o.billMul)})</small>`);
    const k = await choose("Nurse Tammy", "🏥 How do you want your care?", labels, TAMMY);
    if (!alive() || k < 0) return;
    const opt = e.options[k];
    if (opt.dash) await escape(e, alive);
    else await care(e, opt, alive);
}

async function care(e, opt, alive) {
    // Tammy patches her up — the family discount comes off the bill
    let bill = Math.round(rand(25, 55) * opt.billMul * e.discount);
    let claim = 0, claimMsg = null;
    // Hillel "files the claim": sometimes it lands, sometimes he doesn't actually work there anymore
    if (e.hillelVisited && bill > 0) {
        if (Math.random() < 0.55) { claim = Math.round(bill * rand(0.4, 0.6)); bill -= claim; claimMsg = `📋 Hillel filed your claim — APPROVED! −💰${claim}`; }
        else claimMsg = "📋 Hillel's claim DENIED — he doesn't work there anymore. 😬";
    }
    const paid = bill > 0 ? charge(bill) : 0;
    let heartGain = opt.lives || 0, complication = false;
    if (opt.risk && Math.random() < opt.risk) { complication = true; heartGain -= 1; }
    const prev = e.hearts;
    const hearts = clamp(Math.max(1, prev + heartGain), 1, ctx.G.maxHearts || 3);
    let gift = null;
    if (opt.gift === "missile") { shared.update(s => { s.missiles = (s.missiles || 0) + 1; }); gift = "🚀 +1 missile"; }
    else if (opt.gift === "pepper") { shared.update(s => { s.pepperSpray = (s.pepperSpray || 0) + 1; }); gift = "🌶️ +1 pepper spray"; }
    if (gift) emit("cameos:gift", { id: opt.gift });
    e.result = { bill, paid, claim, claimMsg, heartGain, hearts, complication, gift, discount: e.discount, opt };
    if (paid) { A.sfxBump(); H.toast(`🧾 −${paid} 💰 medical bill`, "red"); }
    updateChips(e);
    e.speaker = "tammy";
    await say("Nurse Tammy", e.tammyCare, TAMMY);
    if (!alive()) return;
    e.speaker = "doctor";
    await say("Dr. Shtern", opt.say, DOC);
    if (!alive()) return;
    e.speaker = null;
    await receipt(e);
    if (!alive()) return;
    discharge(e, { hearts, banner: `🩹 <b>Discharged — drive safe!</b>` });
}

function punchCard(visits) {
    const punched = visits % 10, lolli = Math.floor(visits / 10);
    let holes = "";
    for (let p = 0; p < 10; p++) holes += `<span class="hole ${p < punched ? "on" : ""}">${p === 9 && p >= punched ? "🍭" : ""}</span>`;
    return `<div class="punch"><div class="ptitle">🏥 ER FREQUENT FLYER CARD</div><div class="holes">${holes}</div>
        <div class="pfine">${visits} visit${visits === 1 ? "" : "s"} · every 10th earns a lollipop${lolli ? ` · 🍭×${lolli}` : ""}</div></div>`;
}
function receipt(e) {
    const r = e.result;
    const rows = [];
    rows.push(r.bill > 0 ? `<div class="r red">🧾 −${r.paid} 💰 medical bill${r.paid < r.bill ? ` <small>(you only had ${r.paid})</small>` : ""}</div>`
        : `<div class="r green">🩹 on the house — don't tell the boss!</div>`);
    if (r.discount < 1) rows.push(`<div class="r green">👩‍⚕️ family discount applied!</div>`);
    if (r.claimMsg) rows.push(`<div class="r ${r.claim ? "blue" : "orange"}">${r.claimMsg}</div>`);
    if (r.complication) rows.push(`<div class="r red">${r.hearts <= e.hearts ? "💔 complication! −1 heart" : "💔 complication — but you pulled through"}</div>`);
    else if (r.heartGain > 0) rows.push(`<div class="r pink">❤️ +${r.heartGain} heart${r.heartGain > 1 ? "s" : ""}</div>`);
    if (r.gift) rows.push(`<div class="r gold">${r.gift}</div>`);
    if (e.visits % 10 === 0) { rows.push(`<div class="r gold">🍭 A LOLLIPOP! That's visit #${e.visits}!</div>`); sfx.fanfare(); }
    return new Promise(resolve => {
        H.showScreen(`<h2>🏥 Discharged!</h2><div class="erReceipt">${rows.join("")}</div>${punchCard(e.visits)}`,
            [{ label: `🩹 Drive safe! ${glyph("confirm")}`, cls: "", action: () => { H.hideScreen(); resolve(); } }], { onBack: () => { H.hideScreen(); resolve(); } });
    });
}

// ── the bill-skip escape ─────────────────────────────────────────────────
async function escape(e, alive) {
    const force = e.force;
    e.escape = force.escape ? ER_ESCAPES.find(x => x.visual === force.escape) || pick(ER_ESCAPES) : pick(ER_ESCAPES);
    e.caughtGag = force.caughtGag ? ER_CAUGHT.find(x => x.visual === force.caughtGag) || pick(ER_CAUGHT) : pick(ER_CAUGHT);
    e.caught = force.caught !== undefined ? !!force.caught : Math.random() < 0.55;
    e.skippedBill = 30 + Math.floor(Math.random() * 31);
    clearCaptions();
    caption(e.escape.attempt, "gold");
    startEscape(e);
    await wait(2.4);
    if (!alive()) return;
    if (e.caught) {
        // nabbed → the bill she tried to skip gets collected at booking
        e.busted = true;
        e.billCollected = charge(e.skippedBill);
        updateChips(e);
        bust(e);
        rumble(0.6, 0.6, 300, true); sfx.thud();
        clearCaptions();
        caption(e.caughtGag.line, "");
        caption("🚨 BUSTED 🚨", "big");
        if (e.billCollected) caption(`🧾 they collected your 💰${e.billCollected} bill anyway`, "");
        A.sfxSiren(2);
        await wait(2.6);
        if (!alive()) return;
        if (ctx.law && typeof ctx.law.arrest === "function") { ctx.law.arrest(["SKIPPING A MEDICAL BILL", "FLEEING IN A GOWN"], { from: "er" }); }
        else discharge(e, { hearts: 1, banner: `🚨 <b>BUSTED!</b><small>…they let you off with a lecture. And the bill.</small>` });
        return;
    }
    // clean getaway → now a wanted woman
    clearCaptions();
    caption(pick(ER_CLEAN), "gold");
    sfx.fanfare();
    await wait(1.8);
    if (!alive()) return;
    const L = ctx.law;
    if (L) {
        try {
            if (typeof L.addWanted === "function") L.addWanted(["SKIPPING A MEDICAL BILL", "FLEEING THE HOSPITAL"]);
            else if (typeof L.wanted === "number") L.wanted = Math.min(5, L.wanted + 1);
        } catch (err) { /* read-only wanted level */ }
    }
    emit("cameos:wanted", { charges: ["SKIPPING A MEDICAL BILL", "FLEEING THE HOSPITAL"] });
    discharge(e, { hearts: Math.max(1, e.hearts), banner: `🏃 <b>GONE!</b><small>…but you're WANTED now. 🚨</small>` });
}

function startEscape(e) {
    const v = e.escape.visual;
    e.lulu.obj.visible = false;
    const h = luluHair();
    const key = models["luluPerson_" + h.style] ? "luluPerson_" + h.style : "luluPerson";
    const run = spawnPerson(key, { colors: { Hair: h.color, Top: v === "coat" ? "#FAFAFA" : "#BFE3F0", Bottom: "#BFE3F0" } });
    run.obj.position.set(0.9, 0, -0.9);
    set.add(run.obj); e.cast.push(run.obj);
    e.esc = { v, t: 0, run, prop: null, glass: false };
    if (v === "chair") { const c = findNodes(room.P, "Wheelchair")[0].clone(true); set.add(c); e.cast.push(c); e.esc.prop = c; }
    if (v === "gurney") { const g = findNodes(room.P, "Gurney")[0].clone(true); set.add(g); e.cast.push(g); e.esc.prop = g; }
    const say3d = (text, y = 2.0) => { const b = bubble(text, { bg: "#FFFDE7" }); b.position.set(0, y, 0); run.obj.add(b); e.bubbles.push(b); };
    if (v === "coat") say3d("🤫 nothing to see here");
    if (v === "chair" || v === "gurney") say3d("WHEEEEE!", v === "gurney" ? 1.0 : 1.9);
    if (v === "vent") say3d("nnngh— almost—");
}
function escapeTick(e, dt) {
    const s = e.esc, r = s.run, o = r.obj;
    s.t += dt;
    const k = clamp(s.t / 2.3, 0, 1);
    if (s.done) { r.update(dt, s.doneAnim || {}); return; }
    if (s.v === "window") {
        if (s.t < 1.3) { const q = s.t / 1.3; o.position.set(lerp(0.9, -3.9, q), 0, lerp(-0.9, -0.4, q)); o.rotation.y = -Math.PI / 2; r.update(dt, { walk: 4.5 }); }
        else { const q = clamp((s.t - 1.3) / 0.7, 0, 1); o.position.set(lerp(-3.9, -6.6, q), Math.sin(q * Math.PI) * 1.4 + q * 0.6, -0.4); o.rotation.z = q * 1.3; r.update(dt, { cheer: true });
            if (!s.glass && q > 0.35) { s.glass = true; sfx.glass(); caption("CRASH!", "gold", 1200);
                for (let i = 0; i < 30; i++) room.fx.emit(-4.85, 1.4 + Math.random() * 0.8, -0.4 + rand(-0.6, 0.6), rand(-4, -1), rand(1, 4), rand(-1.5, 1.5), 0.08, 1.0, [0.8, 0.93, 0.97]); } }
    } else if (s.v === "coat") {
        o.position.set(lerp(0.9, -2.9, ease(k)), 0, lerp(-0.9, -3.4, ease(k)));
        o.rotation.y = Math.atan2(-3.8, -2.5);
        r.update(dt, { walk: 1.6 });
        if (k >= 1) o.visible = false;
    } else if (s.v === "chair") {
        const x = lerp(-2.4, 6.5, k * k);
        s.prop.position.set(x, 0, 0.7); s.prop.rotation.y = Math.PI / 2;
        o.position.set(x, 0.02, 0.7); o.rotation.y = Math.PI / 2;
        r.update(dt, { sit: true, cheer: true });
        if (Math.random() < 0.5) room.fx.emit(x - 0.4, 0.15, 0.7, -1, 0.4, rand(-0.3, 0.3), 0.25, 0.6, [0.8, 0.83, 0.85]);
    } else if (s.v === "gurney") {
        const x = lerp(-6.5, 6.5, k);
        s.prop.position.set(x, 0, 1.0); s.prop.rotation.y = Math.PI / 2;
        o.position.set(x + 0.8, 0.95, 1.0); o.rotation.set(-Math.PI / 2, Math.PI / 2, 0, "YXZ");
        r.update(dt, { cheer: true });
        if (Math.random() < 0.5) room.fx.emit(x - 0.9, 0.12, 1.0, -1, 0.4, rand(-0.3, 0.3), 0.25, 0.6, [0.8, 0.83, 0.85]);
    } else if (s.v === "vent") {
        if (s.t < 0.7) { const q = s.t / 0.7; o.position.set(lerp(0.9, 1.7, q), 0, lerp(-0.9, 0.7, q)); r.update(dt, { walk: 1.6 }); }
        else { o.position.set(1.7 + Math.sin(s.t * 18) * 0.04, clamp((s.t - 0.7) / 1.6, 0, 1) * 2.4, 0.7); r.update(dt, { cheer: true });
            if (Math.random() < 0.4) room.fx.emit(1.7 + rand(-0.3, 0.3), 3.5, 0.7 + rand(-0.3, 0.3), 0, -0.6, 0, 0.3, 0.8, [0.75, 0.78, 0.8]); }
    }
}
function bust(e) {
    const s = e.esc, gag = e.caughtGag.visual;
    s.done = true;
    // they drag her back into the room either way
    const r = s.run;
    r.obj.visible = true; r.obj.rotation.set(0, 0, 0); r.obj.position.set(0.2, 0, 0.4);
    if (s.prop) s.prop.visible = false;
    s.doneAnim = { cheer: true };
    const at = new THREE.Vector3(0.95, 0, 0.75);
    const spawnCop = () => {
        const c = spawnPerson("copPerson");
        c.obj.position.copy(at); c.obj.rotation.y = -2.2;
        set.add(c.obj); e.cast.push(c.obj);
        const b = bubble("FREEZE! 🚔", { bg: "#FFEBEE", fg: "#B71C1C" }); b.position.set(0, 2.05, 0); c.obj.add(b); e.bubbles.push(b);
        e.visitors.push({ tick(dt) { c.update(dt, { point: true, talk: true }); } });
        return c;
    };
    if (gag === "oldlady") {
        const lady = spawnPerson("npcWoman", { colors: { Hair: "#D9D9DE", Top: "#8D6E63", Bottom: "#5D4037" } });
        lady.obj.position.copy(at); lady.obj.rotation.y = -2.2;
        set.add(lady.obj); e.cast.push(lady.obj);
        e.visitors.push({ tick(dt) { lady.update(dt, { wave: true }); } });
        setTimeout(() => { if (E === e) { lady.obj.visible = false; spawnCop(); } }, 900);
    } else if (gag === "doccop") {
        e.doc.obj.position.copy(at); e.doc.obj.rotation.y = -2.2; e.speaker = "doctor";
        setTimeout(() => { if (E === e) { e.doc.obj.visible = false; spawnCop(); } }, 900);
    } else if (gag === "guard") {
        const c = spawnCop();
        c.obj.position.set(-2.9, 0, -3.0);
        const from = c.obj.position.clone();
        let tt = 0;
        e.visitors.push({ tick(dt) { tt += dt; c.obj.position.lerpVectors(from, at, clamp(tt / 0.6, 0, 1)); if (tt > 0.6) { r.obj.rotation.x = -Math.min(1.4, (tt - 0.6) * 5); c.obj.rotation.x = -Math.min(1.2, (tt - 0.6) * 5); } } });
    } else {
        spawnCop();
        const c2 = spawnPerson("copPerson"); c2.obj.position.set(-0.7, 0, 0.9); c2.obj.rotation.y = 2.4; set.add(c2.obj); e.cast.push(c2.obj);
        e.visitors.push({ tick(dt) { c2.update(dt, { point: true }); } });
    }
}

function discharge(e, { hearts = 1, banner = "" } = {}) {
    if (E !== e) return;
    fade(1, 0.4);
    setTimeout(() => {
        fade(0, 0.7);
        if (E !== e) return;
        if (e.prev === "title") { setState("title"); return; }
        resumeDriving({ hearts, banner });
    }, 420);
}

export function erState() { return E; }

css("cameos-er", `
.erReceipt { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
.erReceipt .r { background: #fff; border-radius: 14px; padding: 8px 12px; font-weight: 700; font-size: 16px; }
.erReceipt .r small { opacity: .6; font-weight: 600; }
.erReceipt .red { color: #C62828; } .erReceipt .green { color: #2E7D32; } .erReceipt .blue { color: #1565C0; }
.erReceipt .orange { color: #E65100; } .erReceipt .pink { color: #D81B60; } .erReceipt .gold { color: #B8860B; }
.punch { background: #E3F2FD; border-radius: 18px; padding: 10px 14px; margin-top: 8px; }
.punch .ptitle { font-weight: 700; color: #0D47A1; letter-spacing: .04em; }
.punch .holes { display: grid; grid-template-columns: repeat(5, 36px); gap: 8px 12px; justify-content: center; margin: 10px 0 6px; }
.punch .hole { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #1565C0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.punch .hole.on { background: radial-gradient(circle, #1565C0 52%, transparent 56%); }
.punch .pfine { font-size: 13px; font-weight: 700; color: #0D47A1; opacity: .8; }
#dialog .opt small { opacity: .7; font-weight: 600; }
body.tv .erReceipt .r { font-size: 22px; } body.tv .punch .holes { grid-template-columns: repeat(5, 48px); } body.tv .punch .hole { width: 46px; height: 46px; }
`);
