// interiors/bar.js — "THE THIRSTY SCHOLAR": Sol the bartender (free seltzer ⭐),
// Big Schlomo the bouncer, two tipsy regulars (one clinks glasses: "my round!"),
// the guy passed out on the bar ("🔑? ...it's a chip clip."), the jukebox (a
// dance-floor rhythm boogie), the TV, neon, the disco ball — and LIQUID COURAGE
// (💰35): a 20-second gold shield + double points on her next drive.
// All lines are the 2D game's (src/08c-foot-bar.js).
import * as THREE from "three";
import { ctx, hook, on } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { defineInterior, pool, pick, randInt, rand, S, GOLD, CONFETTI, force } from "./engine.js";
import { canvasPlane, drawLines, roundRect, sfx, tone, klezmer } from "./fx.js";

const BARTENDER = pool([
    "We don't serve drivers here.\nWhat'll it be, walker?",
    "Seltzer's on the house, mamaleh.\nYou look parched AND parked-out.",
    "A nice egg cream? No alcohol,\nyour mother would plotz.",
    "You want a pickle with that?\nWe got a whole barrel, take TWO.",
    "Last call was twenty years ago.\nI just like the company.",
    "Drink up, but slow — you've got\na long walk to Bubbe's yet.",
    "On the house. Tell your cousin\nI said the brisket was dry.",
    "Club soda, lime, and a side of\nunsolicited advice. Free of charge.",
    "You're too good for this place.\nSo is everybody. Here's a seltzer.",
    "I poured you a water. Hydrate.\nYou're no good to anyone fainted.",
    "Happy hour? Honey, every hour\nI see you is a happy hour.",
    "We're out of the good stuff,\nso I'm giving you the GREAT stuff.",
    "No tab, no tip, no trouble.\nJust drink your seltzer, bubbeleh.",
    "I'll cut you off after this — it's\nwater, but principles are principles.",
    "I been polishing this same glass\nsince Tuesday. It's a meditation.",
    "You hear about Murray? No? Good.\nSit. I'll tell you EVERYTHING.",
    "Top shelf is just for show. The\nreal good stuff's under the bar.",
    "Two olives or three? In this\neconomy I'm giving you FOUR.",
    "I knew your grandmother. Tough\nlady. Tipped in advice. Sit down.",
    "Cranberry, soda, splash of lime.\nWe call it 'the designated driver.'",
]);
const DRUNK_LINES = [
    "You're like my ex... but PRETTIER!",
    "Marry me — I HAVE A CAR!\n(...it's my mom's. Still counts.)",
    "Are you an angel? 'Cause I just\nfell off this stool for you.",
    "I'd give you my number but I\nforgot it. And my name. And here.",
    "You, me, the early-bird special.\nWhaddya say, sweetheart?",
    "My therapist says I shouldn't\nflirt. My therapist is ME.",
    "Is it hot in here or did you\njust walk in? ...it's both.",
    "I love you. I love everyone.\nBut especially you. And that lamp.",
    "Wanna split an appetizer and\nmaybe the rest of our lives?",
    "I'm not drunk, I'm just very\nemotionally available right now.",
    "You had me at 'leave me alone.'\nThat's flirting, right?",
    "I once parallel parked PERFECTLY.\nOne time. Marry me anyway.",
    "Beautiful AND you walked here?\nLow maintenance! Mom would LOVE you.",
    "Hey... hey. Hey. ...I forgot.\nBut you're great. Hey.",
    "I'm a CATCH. I floss. Sometimes.\nWeekly. Monthly. ...I own floss.",
    "Are you a parking spot? 'Cause\nI been circling you all night.",
    "I'd walk you home but the room's\nbeen walking ME for an hour.",
    "Roses are red, this seltzer's\nflat, will you marry... what was I—",
    "I have prospects! A cousin in\nflooring! He owes me twenty bucks!",
    "Your eyes are like two olives.\nI mean that as the highest praise.",
];
const DRUNK_A = pool(DRUNK_LINES), DRUNK_B = pool(DRUNK_LINES);
const PASSED = pool([
    "(snoring)  ...five more minutes,\nBubbe... the brisket can wait...",
    "(mumbling)  ...I told you the\nGPS was wrong... I TOLD you...",
    "Zzzz... no thank you, I'm full...\nokay one more knish... zzzz...",
    "(snore)  ...check, please...\nno wait, YOU pay... zzzz...",
    "...the Mets... they'll win it...\nany decade now... zzzz...",
    "Mmf... tell my wife the lawn\ncan mow ITSELF... zzzzz...",
    "(snoring)  ...I'm not asleep...\nI'm just resting my whole face...",
    "...one egg cream too many...\nworth it... totally worth it... zzz",
    "Zzz... put it on Murray's tab...\nMurray's good for it... zzz...",
    "(mumble)  ...I'll drive... I'm FINE\nto... drive... *thunk* ...zzz",
    "...is it Shabbos yet... wake me\nfor the candles... only then... zzz",
    "(snore)  ...refinance the... the...\nthe whole... zzz... ask my broker...",
    "Mmf... the WiFi password is\n'password'... don't tell... zzzz...",
    "...just resting my eyes... and my\nface... and my entire... zzz...",
]);
const BOUNCER = pool([
    "ID? ...nah, you got an honest\nface. Go on in, kid.",
    "No funny business. I've thrown\nout TOUGHER bubbes than you.",
    "You break it, you bought it.\nYou cry, I get the manager. Me.",
    "I look mean but I cry at\nweddings. Don't tell nobody.",
    "House rules: be nice, tip Sol,\nand NOBODY touches the jukebox volume.",
    "You need a ride later? ...no.\nI walk everywhere. Keeps me humble.",
    "Behave, and the seltzer flows.\nMisbehave, and... well, also seltzer.",
    "I've seen it all in this joint.\nTwice. On a Tuesday. Go in.",
    "You're cleared. Tell the bartender\nBig Schlomo says hi.",
    "Trouble? In MY bar? Over my\nvery large, very gentle body.",
    "Coat check's broke. Just hold\nyour coat. Builds character.",
    "I do the door AND the books.\nTax season I'm a TEDDY bear.",
    "You look like you walk safe.\nI respect that. Go on, sweetheart.",
    "Last guy who started something?\nI made him apologize to his MOTHER.",
]);
const JUKEBOX = pool([
    "BOOGIE TIME! Klezmer remix,\nbaby — shake what Bubbe gave ya!",
    "This song was number one at\nyour cousin's bar mitzvah. CLASSIC.",
    "♪ ...and that's why you ALWAYS\ncall your mother ♪  (it's a banger)",
    "Free play! Somebody jammed a\nbutton mitzvah token in there.",
    "Disco never died — it just moved\nto a bar in the old neighborhood.",
    "Hora breakdown incoming! Grab\na chair, we're lifting SOMEBODY.",
    "The good stuff: side A is\nFrank, side B is more Frank.",
    "Dance like nobody's filming —\nbecause Aunt Rivka definitely is.",
    "♪ ...she's got a brand new... NOTHING,\nher car's wrecked ♪ ...too soon?",
    "Cha-cha slide, but it's just\neveryone arguing about parking.",
    "Turn it UP! ...okay, Schlomo said\nturn it down. We compromise: medium.",
    "B-12: the slow one. B-13:\nALSO the slow one. We don't judge.",
    "It only plays one song but\nit's the GOOD one. Press it again.",
]);
const CLINK = pool([
    "L'CHAIM! To you, to me,\nto Bubbe's brisket! 🥂",
    "To health! And to NEVER\nparking downtown again!",
    "Mazel! ...what're we toasting?\nDoesn't matter. MAZEL!",
    "To absent friends, present\nseltzer, and YOUR good face!",
    "Drink! ...it's water, but the\nSPIRIT is one hundred proof!",
    "To the chef! To the bartender!\nTo whoever invented the PICKLE!",
]);
const COURAGE_FEE = 35;
const COURAGE_LINES = ["One 'liquid courage,' coming up. Drive bold, mamaleh! 🍺",
    "On the rocks of RECKLESSNESS. Go get 'em, kid.",
    "Bottoms up — you're invincible now. (Legally: you're NOT.)",
    "L'chaim! Points double when you've got moxie like THAT."];
const TV_CHANNELS = [
    { label: "4 : 4", fg: "#FFEB3B", bg: "#1B5E20", scan: "#A5D6A7" },
    { label: "♥ LIVE", fg: "#FF80AB", bg: "#4A148C", scan: "#CE93D8" },
    { label: "NEWS", fg: "#FFFFFF", bg: "#0D47A1", scan: "#90CAF9" },
    { label: "$$$", fg: "#69F0AE", bg: "#1B5E20", scan: "#A5D6A7" },
    { label: "WX 72°", fg: "#FFD740", bg: "#37474F", scan: "#B0BEC5" },
];

const SOL = { emoji: "🍸", color: "#8E1E3C" }, SCHLOMO = { emoji: "🕴️", color: "#37474F" }, TIPSY = { emoji: "🥴", color: "#E65100" },
    SNOOZE = { emoji: "😴", color: "#5C6BC0" }, JUKE = { emoji: "🎵", color: "#FF8F00" }, LULU = { emoji: "💁‍♀️", color: "#E91E63" };

// ── LIQUID COURAGE: shield + 2× score while DRIVING (the 2D courageT) ─────
export const courage = { t: 0, last: 0, lastFrame: -9, chip: null, shield: null };
const driving = () => ctx.state === "playing" && !(ctx.foot && ctx.foot.active);
on("title", () => { courage.t = 0; });   // a fresh game clears it (the 2D resetGame); a borrowed car keeps it
hook("damage", () => (courage.t > 0 && driving() ? false : undefined), 15);
hook("update", (dt, P, controlsOn) => {
    if (courage.t <= 0 || !driving()) return;
    const G = ctx.G;
    if (courage.lastFrame === ctx.frames - 1) {
        const gain = G.score - courage.last;
        if (gain > 0 && gain < 20000) G.score += gain;            // double points
    }
    courage.last = G.score;
    courage.lastFrame = ctx.frames;
    courage.t = Math.max(0, courage.t - dt);
    if (courage.t <= 0) H.toast("🍺 courage wore off", "pink");
}, -50);
hook("hud", () => {
    const on = courage.t > 0 && driving();
    if (on && !courage.chip) {
        courage.chip = document.createElement("div");
        courage.chip.className = "int-meter";
        courage.chip.innerHTML = `🍺 COURAGE ×2<div class="bar"><i></i></div>`;
        H.hudSlot("center").appendChild(courage.chip);
    }
    if (courage.chip) {
        courage.chip.style.display = on ? "" : "none";
        if (on) courage.chip.querySelector("i").style.width = (courage.t / 20 * 100).toFixed(1) + "%";
    }
    // a gold bubble around the car for the whole buff
    if (on && !courage.shield && ctx.scene) {
        courage.shield = new THREE.Mesh(new THREE.SphereGeometry(2.9, 24, 16),
            new THREE.MeshBasicMaterial({ color: "#FFD54F", transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
        courage.shield.scale.set(1, 0.62, 1.25);
        ctx.scene.add(courage.shield);
    }
    if (courage.shield) {
        courage.shield.visible = on;
        if (on) {
            courage.shield.position.set(ctx.car.pos.x, 0.9, ctx.car.pos.z);
            courage.shield.rotation.y = ctx.car.h;
            courage.shield.material.opacity = 0.12 + 0.06 * Math.sin(ctx.time * 9);
        }
    }
});

async function buyCourage(rt) {
    const sol = rt.byId.bartender;
    if (courage.t > 0) { await rt.say("Sol", "Easy, tiger — you've still got a buzz on. Go DRIVE.", Object.assign({ person: sol }, SOL)); return; }
    if (wallet.coins < COURAGE_FEE) {
        sfx.deny();
        await rt.say("Sol", "No coins, no courage. House doesn't run a tab, hon.", Object.assign({ person: sol }, SOL));
        return;
    }
    if (!rt.pay(COURAGE_FEE)) return;
    courage.t = 20;
    courage.lastFrame = -9;
    const tap = rt.spot("courage");
    rt.burst(new THREE.Vector3(tap.x, 1.6, tap.z - 0.7), GOLD, 16, 1.6, 0.06);
    tone(523, 0.1, "triangle", 0.12, 784);
    rt.data.flash = 0.8;
    H.toast("🍺 LIQUID COURAGE — next drive!", "gold");
    rt.luluHold("Beer");
    await rt.say("Sol", pick(COURAGE_LINES), Object.assign({ person: sol }, SOL));
}

// ── the jukebox dance (a little rhythm boogie on the disco floor) ─────────
async function jukebox(rt) {
    await rt.say("Jukebox", JUKEBOX(), JUKE);
    if (rt.disposed) return;
    const f = rt.spot("dancefloor");
    await rt.walkTo(f.x, f.z, 2.5);
    if (rt.disposed) return;
    const k = klezmer(16, 150);
    A.duckMusic(0.05);
    H.banner(`💃 <b>BOOGIE TIME!</b><small>Tap ${glyph("interact")} on the beat</small>`, 1500);
    tone(330, 0.12, "square", 0.1, 660);
    rt.burst(new THREE.Vector3(f.x, 1.0, f.z), CONFETTI, 18, 2.4, 0.07);
    let ring = null;
    const mode = {
        t: -0.5, hits: 0, judged: new Set(), beats: 16, spb: k.spb, lastBeat: -1,
        start(rt) {
            rt.luluPose = { dance: true };
            rt.data.dancing = true;
            ring = document.createElement("div");
            ring.className = "int-beat";
            ring.innerHTML = glyph("interact");
            rt.extraEl.appendChild(ring);
        },
        clock() { return k.ac ? k.ac.currentTime - k.t0 : this.t; },
        update(rt, dt, P) {
            this.t += dt;
            const ct = this.clock(), b = ct / this.spb, i = Math.round(b), ph = (b - i) * this.spb;
            const beatNow = Math.floor(b);
            if (beatNow !== this.lastBeat && beatNow >= 0 && beatNow < this.beats) {
                this.lastBeat = beatNow;
                rt.data.beatPulse = 1;
                if (!k.ac) tone(beatNow % 2 ? 220 : 147, 0.1, "triangle", 0.1);
            }
            if (ring) {
                const s = 1 + Math.max(0, 0.35 - Math.abs(ph) * 2.5);
                ring.style.transform = `scale(${s.toFixed(3)})`;
                ring.style.borderColor = Math.abs(ph) < 0.12 ? "#69F0AE" : "#FFD740";
            }
            if (P.interact || P.confirm) {
                if (i >= 0 && i < this.beats && Math.abs(ph) < 0.14 && !this.judged.has(i)) {
                    this.judged.add(i); this.hits++;
                    H.toast(pick(["PERFECT! ✨", "ON BEAT! 💃", "SHAKE IT! 🕺", "MAZEL! ✨"]), "gold");
                    rt.burst(rt.lulu.obj.position.clone().setY(1.2), CONFETTI, 10, 2.0, 0.05);
                    tone(880 + this.hits * 30, 0.06, "square", 0.06);
                } else tone(196, 0.05, "square", 0.04);
            }
            if (Math.random() < dt * 14) rt.burst(rt.lulu.obj.position.clone().setY(0.2), CONFETTI, 1, 1.2, 0.04);
            return ct >= this.beats * this.spb + 0.25;
        },
        stop(rt) {
            rt.luluPose = null;
            rt.data.dancing = false;
            if (ring) ring.remove();
            A.duckMusic(0.32);
            k.stop();
        },
    };
    await rt.runMode(mode);
    if (rt.disposed) return;
    const n = mode.hits;
    if (n > S.danceBest) { S.danceBest = n; saveSoon(); }
    const line = n >= 12 ? `🕺 BUBBE-APPROVED MOVES! ${n}/16 on the beat!`
        : n >= 6 ? `💃 Not bad! Aunt Rivka filmed it. ${n}/16 on the beat.`
        : `😅 Dance like nobody's watching… they were. ${n}/16 on the beat.`;
    H.toast(line.split("!")[0] + "!", n >= 12 ? "big" : "pink");
    for (const q of rt.people) if (!q.pose.sit && !q.pose.lie) q.cheerT = 1.6;
    if (n >= 12) sfx.fanfare();
    await rt.say("Lulu", line, LULU);
}

// ── TV ────────────────────────────────────────────────────────────────────
function drawTv(g, W, H, ch, t) {
    g.fillStyle = ch.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = ch.scan;
    if (ch.label === "4 : 4") {
        g.fillStyle = "#2E7D32"; g.fillRect(0, H * 0.45, W, H * 0.55);
        g.strokeStyle = "#E8F5E9"; g.lineWidth = 4; g.beginPath(); g.moveTo(W * 0.5, H * 0.45); g.lineTo(W * 0.5, H); g.stroke();
        for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? "#FFFFFF" : "#E53935"; g.beginPath(); g.arc(W * (0.2 + k * 0.2) + Math.sin(t + k) * 10, H * 0.7, 10, 0, 7); g.fill(); }
    } else if (ch.label === "♥ LIVE") {
        for (const [x, c] of [[0.35, "#FFE0CC"], [0.65, "#D7A15A"]]) { g.fillStyle = c; g.beginPath(); g.arc(W * x, H * 0.55, H * 0.18, 0, 7); g.fill(); }
        g.fillStyle = "#FF4081"; g.font = `${H * 0.22}px sans-serif`; g.textAlign = "center"; g.fillText("♥", W / 2, H * 0.35);
    } else if (ch.label === "NEWS") {
        g.fillStyle = "#1565C0"; g.fillRect(0, H * 0.62, W, H * 0.38);
        g.fillStyle = "#FFE0CC"; g.beginPath(); g.arc(W * 0.5, H * 0.42, H * 0.15, 0, 7); g.fill();
        g.fillStyle = "#263238"; g.fillRect(W * 0.38, H * 0.55, W * 0.24, H * 0.2);
        g.fillStyle = "#FFEB3B"; g.fillRect(0, H * 0.86, W, H * 0.1);
        g.fillStyle = "#000"; g.font = `700 ${H * 0.08}px sans-serif`; g.textAlign = "left";
        g.fillText("BREAKING: LOCAL BUBBE STILL WAITING ·  BRISKET DRY ·  ", W - ((t * 90) % (W * 2)), H * 0.93);
    } else if (ch.label === "$$$") {
        g.strokeStyle = "#69F0AE"; g.lineWidth = 6; g.beginPath();
        for (let x = 0; x <= 10; x++) g.lineTo(W * x / 10, H * (0.75 - x * 0.04 + Math.sin(x * 1.7 + t) * 0.08));
        g.stroke();
    } else {
        g.fillStyle = "#FFD740"; g.beginPath(); g.arc(W * 0.3, H * 0.5, H * 0.16, 0, 7); g.fill();
        g.fillStyle = "#ECEFF1"; g.beginPath(); g.arc(W * 0.42, H * 0.58, H * 0.12, 0, 7); g.arc(W * 0.52, H * 0.56, H * 0.15, 0, 7); g.fill();
    }
    g.globalAlpha = 0.12; g.fillStyle = "#000";
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
    g.globalAlpha = 1;
    drawLines(g, ch.label, W * 0.5, H * 0.17, H * 0.16, ch.fg, { stroke: "#000", lw: 6 });
}

// ── the set ───────────────────────────────────────────────────────────────
export default defineInterior({
    id: "bar", name: "The Thirsty Scholar", short: "the bar", emoji: "🍸",
    title: "🍸 THE THIRSTY SCHOLAR — BAR", tagline: "Seltzer's on the house",
    model: "interiorsBar", models: ["interiorsBartender", "interiorsBouncer", "npcMan", "npcWoman"],
    music: "../story-electric.mp3",
    light: "night", sky: "#1a0d18",
    bounds: { x0: -7.6, x1: 7.6, z0: -4.6, z1: 4.6 },
    cam: { dist: 7.4, height: 4.9 },

    build(rt) {
        const set = rt.set, d = rt.data;
        set.hemi.color.set("#8a6a9a"); set.hemi.groundColor.set("#3a2028"); set.hemi.intensity = 1.0;
        set.sun.color.set("#ffcfa0"); set.sun.intensity = 0.7;
        d.pendants = [0, 1, 2].map(k => rt.pointLight("pendant" + k, "#ffc98a", 9, 7));
        d.neon = [rt.pointLight("neonTitle", "#ff4fa3", 7, 7, 1.6, true), rt.pointLight("neonChaim", "#40c4ff", 6, 6, 1.6, true), rt.pointLight("neonOpen", "#69f0ae", 4, 5, 1.6, true)];
        d.juke = rt.pointLight("juke", "#ffb300", 4, 5, 1.6, true);
        d.disco = rt.pointLight("disco", "#ff80ff", 4, 8);
        d.neonMats = [];
        rt.root.traverse(o => { if (o.isMesh && /^Neon(Pink|Blue|Green)/.test(o.material.name) && !d.neonMats.includes(o.material)) d.neonMats.push(o.material); });
        for (const m of d.neonMats) { m.userData.base = m.userData.base || m.emissiveIntensity; m.emissiveIntensity = m.userData.base; }

        // the disco floor: 4×4 glowing tiles
        const f = rt.fx("dancefloor");
        d.tiles = new THREE.InstancedMesh(rt.own(new THREE.PlaneGeometry(0.94, 0.94)), rt.own(new THREE.MeshBasicMaterial({ toneMapped: false })), 16);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        for (let i = 0; i < 16; i++) {
            m4.compose(new THREE.Vector3(f.x - 1.5 + (i % 4), 0.012, f.z - 1.5 + Math.floor(i / 4)), q, new THREE.Vector3(1, 1, 1));
            d.tiles.setMatrixAt(i, m4);
            d.tiles.setColorAt(i, new THREE.Color("#444"));
        }
        d.tiles.receiveShadow = false;
        rt.add(d.tiles);
        // disco beams sweeping from the ball
        d.ball = rt.node("DiscoBall");
        d.beams = [];
        const beamGeo = rt.own(new THREE.ConeGeometry(0.9, 3.2, 20, 1, true));
        beamGeo.translate(0, -1.6, 0);
        ["#FF4081", "#40C4FF", "#FFD740"].forEach((c, k) => {
            const mat = rt.own(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            const b = new THREE.Mesh(beamGeo, mat);
            b.position.copy(d.ball ? d.ball.position : new THREE.Vector3(f.x, 3.3, f.z));
            b.rotation.order = "YXZ";
            b.userData = { ph: k * 2.1, spd: 0.6 + k * 0.25 };
            rt.add(b);
            d.beams.push(b);
        });
        // the wall TV
        const tv = rt.fx("tv");
        d.ch = 0;
        d.tv = canvasPlane(set, 1.34, 0.76, (g, W, H, t) => drawTv(g, W, H, TV_CHANNELS[d.ch], t), { px: 256 });
        d.tv.mesh.position.set(tv.x, tv.y, tv.z + 0.012);
        rt.add(d.tv.mesh);
        rt.every(3.5, 6.5, () => { d.ch = (d.ch + 1) % TV_CHANNELS.length; tone(280, 0.04, "square", 0.04); }, { gate: false });

        // ── the regulars ──
        const sol = rt.person("bartender", "interiorsBartender", "bartender", { name: "Sol",
            post(p, dt, t) {   // polish a glass, then pour (the 2D bartender's loop)
                const a = p.limbs.Arm_R, l = p.limbs.Arm_L;
                const polishing = (t * 0.35) % 2 < 1;
                if (a) a.rotateX(polishing ? -0.9 : -1.3 + Math.sin(t * 2) * 0.1);
                if (a) a.rotateZ(polishing ? Math.sin(t * 8) * 0.35 : 0.5);
                if (l) l.rotateX(polishing ? -0.8 : -0.2);
            } });
        rt.hold(sol.p, "Glass", { y: -0.44 });
        rt.person("bouncer", "interiorsBouncer", "bouncer", { name: "Big Schlomo", r: 0.55,
            post(p) { for (const [k, s] of [["Arm_L", -1], ["Arm_R", 1]]) if (p.limbs[k]) { p.limbs[k].rotateX(-1.15); p.limbs[k].rotateZ(s * 0.8); } } });
        const wob = (amp) => (p, dt, t) => { p.obj.rotation.z = Math.sin(t * 1.7) * amp; };
        const drunkA = rt.person("drunkA", "npcMan", "drunkA", { name: "Tipsy regular", colors: { Top: "#FF8A65", Bottom: "#37474F", Hair: "#5D4037" },
            post: (p, dt, t, rt) => { wob(0.07)(p, dt, t); if (p.limbs.Arm_R && !rt.data.dancing) p.limbs.Arm_R.rotateX(-0.7); } });
        rt.hold(drunkA.p, "Beer", { y: -0.46 });
        const drunkB = rt.person("drunkB", "npcMan", "drunkB", { name: "Tipsy regular", colors: { Top: "#4DB6AC", Bottom: "#263238", Hair: "#212121" },
            post: (p, dt, t, rt) => {
                wob(0.05)(p, dt, t + 1.7);
                const a = p.limbs.Arm_R;
                if (a) a.rotateX(rt.data.clinkT > 0 || rt.data.toastT > 0 ? -2.5 : -0.75);
            } });
        rt.hold(drunkB.p, "Beer", { y: -0.46 });
        // the guy passed out on the bar: sat on a stool, slumped over his arms
        const passed = rt.person("passed", "npcMan", "passed", { name: "Passed-out guy", colors: { Top: "#7986CB", Bottom: "#3E2723", Hair: "#9E9E9E" },
            pose: { sit: true }, faceLulu: false, collide: false, stool: true });
        d.passedPivot = slump(rt, passed, 0.36, 0.95);
        const p1 = rt.person("patron1", "npcWoman", "patron1", { colors: { Top: "#F06292", Bottom: "#4A148C", Hair: "#212121" }, pose: { sit: true },
            y: 0.36, faceLulu: false, collide: false, stool: true,
            post: (p, dt, t, rt) => {
                const s = rt.data.stumbleT || 0;
                const k = s > 0 ? Math.sin(Math.min(1, (1.3 - s) / 0.5) * Math.PI / 2) * (s < 0.4 ? s / 0.4 : 1) : 0;
                p.obj.rotation.z = k * 0.9;
                p.obj.position.y = 0.36 - k * 0.3;
                p.obj.position.x = p1.home.x + k * 0.35;
            } });
        rt.hold(p1.p, "Seltzer", { y: -0.45 });
        rt.person("patron2", "npcMan", "patron2", { colors: { Top: "#FFD54F", Bottom: "#5D4037", Hair: "#3E2723" }, pose: { sit: true, talk: true }, y: 0.36, faceLulu: false, collide: false, stool: true });
        rt.person("patron3", "npcWoman", "patron3", { colors: { Top: "#9575CD", Bottom: "#263238", Hair: "#8D6E63" }, pose: { sit: true }, y: 0.36, faceLulu: false, collide: false, stool: true });

        // ── hotspots ──
        rt.hot({ id: "bouncer", spot: "bouncer", who: "bouncer", r: 1.8, label: "🕴️ Talk to Big Schlomo",
            action: rt => rt.say("Big Schlomo", BOUNCER(), Object.assign({ person: rt.byId.bouncer }, SCHLOMO)) });
        rt.hot({ id: "jukebox", spot: "jukebox", r: 1.5, label: "🎵 Play the jukebox", action: jukebox });
        rt.hot({ id: "drunkA", spot: "drunkA", who: "drunkA", r: 1.6, label: "🥴 Talk to the tipsy regular",
            action: rt => rt.say("Tipsy regular", DRUNK_A(), Object.assign({ person: rt.byId.drunkA }, TIPSY)) });
        rt.hot({ id: "passed", spot: "passedTalk", r: 1.0, label: "😴 Poke the snoozing guy", action: async rt => {
            const at = rt.spot("passed");
            await rt.say("Passed-out guy", PASSED(), SNOOZE);
            if (!rt.used.passed && !rt.disposed) {   // he "offers" his car keys in his sleep. It's a chip clip.
                rt.used.passed = true;
                rt.coins(2, "🔑? ...it's a chip clip. +2", new THREE.Vector3(at.x, 1.3, at.z));
                sfx.womp();
            }
        } });
        rt.hot({ id: "drunkB", spot: "drunkB", who: "drunkB", r: 1.3, label: "🥂 Clink glasses", action: async rt => {
            rt.data.clinkT = 1.4;
            sfx.clink();
            const at = rt.byId.drunkB.p.obj.position;
            rt.burst(new THREE.Vector3(at.x, 2.0, at.z), ["#FFE082"], 10, 1.2, 0.04);
            if (!rt.inHand) rt.luluHold("Seltzer");
            await rt.say("Tipsy regular", CLINK(), Object.assign({ person: rt.byId.drunkB }, TIPSY));
            if (!rt.used.clink && !rt.disposed) {
                rt.used.clink = true;
                const n = force.clink || randInt(3, 6);
                rt.coins(n, `+${n} 🪙 "my round!"`, new THREE.Vector3(at.x, 1.6, at.z));
            }
        } });
        rt.hot({ id: "bartender", spot: "solTalk", who: "bartender", r: 1.15, label: "🍸 Talk to Sol the bartender", action: async rt => {
            await rt.say("Sol", BARTENDER(), Object.assign({ person: rt.byId.bartender }, SOL));
            if (!rt.used.seltzer && !rt.disposed) {   // free seltzer → a ⭐ AND a couple coins
                rt.used.seltzer = true;
                const at = rt.byId.bartender.p.obj.position;
                rt.star(1, "🥤 FREE SELTZER ⭐", new THREE.Vector3(at.x, 1.6, at.z + 1));
                rt.coins(3, "+3 💰", null);
                tone(660, 0.1, "sine", 0.12, 990);
                rt.luluHold("Seltzer");
            }
        } });
        rt.hot({ id: "courage", spot: "courage", r: 0.95,
            label: () => courage.t > 0 ? "🍺 Got a buzz — go drive bold!" : `🍺 Liquid courage · 💰${COURAGE_FEE} (shield + 2× next drive)`,
            action: buyCourage });

        // ── micro-events: a room-wide L'CHAIM! toast, or a regular sliding off a stool ──
        rt.every(7, 13, rt => {
            if (Math.random() < 0.5) {
                rt.data.toastT = 1.8;
                rt.bubble("🥂 L'CHAIM! 🥂", rt.byId.drunkB.p.obj, 1.8, { color: "#5D4037", bg: "#FFE082" });
                tone(523, 0.1, "triangle", 0.12, 784); tone(659, 0.14, "sine", 0.1, 988, 0.1);
                for (const q of rt.people) if (!q.pose.sit) q.cheerT = 1.5;
                rt.burst(new THREE.Vector3(0, 2.2, -1), GOLD, 18, 3, 0.05);
            } else {
                rt.data.stumbleT = 1.3;
                rt.bubble("WHOOPS!", rt.byId.patron1.p.obj, 1.3, { color: "#5D4037", bg: "#FFD740" });
                tone(rand(180, 260), 0.14, "sawtooth", 0.08, 90);
                sfx.womp();
            }
        }, { first: rand(5, 9) });
        rt.every(2.2, 4.5, () => tone(rand(700, 1100), 0.05, "sine", 0.05), { gate: false });   // bottle clinks
        rt.every(3.5, 5, rt => rt.bubble("z Z z…", passed.p.obj.parent, 2.2, { yOff: 1.0, size: 0.6, color: "#5C6BC0" }), { gate: false, first: 1.5 });
    },

    tick(rt, dt) {
        const d = rt.data, t = rt.t;
        if (d.clinkT > 0) d.clinkT -= dt;
        if (d.toastT > 0) d.toastT -= dt;
        if (d.stumbleT > 0) d.stumbleT -= dt;
        if (d.flash > 0) d.flash -= dt;
        d.beatPulse = Math.max(0, (d.beatPulse || 0) - dt * 3);
        for (const q of rt.people) {
            if (q.cheerT > 0) { q.cheerT -= dt; q.pose.cheer = q.cheerT > 0; }
            if (!q.pose.sit && q.id !== "bartender" && q.id !== "bouncer") q.pose.dance = !!d.dancing;
        }
        // disco floor
        const c = new THREE.Color();
        const fast = d.dancing ? 3 : 1;
        for (let i = 0; i < 16; i++) {
            const k = Math.floor(t * 2.2 * fast + (i % 4) * 0.7 + Math.floor(i / 4) * 1.3 + (i * 7) % 3) % 5;
            c.set(CONFETTI[k]).multiplyScalar(0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 5 * fast + i)) + (d.dancing ? 0.3 * d.beatPulse : 0));
            d.tiles.setColorAt(i, c);
        }
        d.tiles.instanceColor.needsUpdate = true;
        if (d.ball) d.ball.rotation.y += dt * (d.dancing ? 2.4 : 0.8);
        for (const b of d.beams) {
            const u = b.userData;
            b.rotation.y = t * u.spd * (d.dancing ? 2 : 1) + u.ph;
            b.rotation.x = 0.45 + Math.sin(t * 0.7 + u.ph) * 0.2;
            b.material.opacity = (d.dancing ? 0.2 : 0.09) + 0.04 * Math.sin(t * 3 + u.ph);
        }
        d.disco.intensity = (d.dancing ? 9 : 4) + Math.sin(t * 6) * 1.5;
        d.disco.color.setHSL((t * 0.15) % 1, 0.8, 0.6);
        d.juke.intensity = 3.5 + Math.sin(t * 4) * 1.2 + (d.dancing ? 3 * d.beatPulse : 0);
        // neon: buzz with a rare dropout (the 2D flicker)
        const flick = Math.sin(t * 9) > -0.97 ? 1 : 0.25;
        for (const m of d.neonMats) m.emissiveIntensity = m.userData.base * flick * (d.flash > 0 ? 1.6 : 1);
        d.neon[0].intensity = 7 * flick;
        if (Math.floor(t * 10) !== d.tvFrame) { d.tvFrame = Math.floor(t * 10); d.tv.redraw(t); }
    },

    dispose(rt) {
        // the neon materials are shared with the cached model: put them back
        for (const m of rt.data.neonMats || []) m.emissiveIntensity = m.userData.base;
    },
});

/** Re-parent a seated person under a pivot at the hips and lean them forward (head on the bar). */
function slump(rt, rec, lift, lean) {
    const o = rec.p.obj, hip = lift + 0.45;
    const g = new THREE.Group();
    g.position.set(o.position.x, hip, o.position.z);
    g.rotation.order = "YXZ";
    g.rotation.set(lean, o.rotation.y, 0);
    rt.add(g);
    g.add(o);
    o.position.set(0, -0.45, 0);
    o.rotation.set(0, 0, 0);
    return g;
}
