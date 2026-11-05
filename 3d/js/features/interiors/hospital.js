// interiors/hospital.js — "URGENT CARE — WAITING ROOM" (Maimonides-ish). The
// receptionist (insurance?), the hypochondriac (*kof kof*), the doctor with terrible
// advice, the SNAX machine (60%: +5 snack · 40%: it EATS a coin), Heshy in a sling
// (get-well gelt: ⭐ + 3, once), the fish tank (Dr. Gills), the waiting-room TV.
// A nurse crosses with a clipboard, the NOW SERVING board ticks, an ambulance
// flashes past the window, the IV drips. Lines from src/08d-foot-school-hospital.js.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import * as H from "../../hud.js";
import { defineInterior, pool, pick, rand, randInt, GOLD, force } from "./engine.js";
import { canvasPlane, drawLines, sfx, tone } from "./fx.js";

const RECEPTION = pool([
    "Do you have insurance?\n...A coupon? A blessing? Anything?",
    "Fill out these forms.\nAll forty. Both sides. In pen.",
    "Name? Date of birth?\nMother's maiden complaint?",
    "You're not in the system.\nNobody is. The system is a myth.",
    "Co-pay is twenty dollars\nor one really good piece of babka.",
    "The doctor is running behind.\nBy 'behind' I mean 'last Tuesday'.",
    "Have a seat. And a number.\nAnd a long, contemplative wait.",
    "Is this an emergency or are you\njust cold and want the WiFi?",
    "We take all insurance!\n...We accept none of it. But we TAKE it.",
    "Sign here, here, and here.\nThat last one was a raffle. You won a pen.",
    "Pre-existing condition?\nYes — you exist, and that's a condition.",
    "Please don't cough on the desk.\nCough on the OTHER patients, like normal.",
]);
const PATIENT = pool([
    "I googled my symptoms.\nIt's either a cold or a dragon.",
    "I've been waiting since BREAKFAST.\nI came for breakfast, actually.",
    "Is it warm in here? I'm warm.\nAm I dying? Be honest.",
    "My cousin had a cousin who\nsneezed once. Never recovered. Tragic.",
    "I have a paper cut.\nI think it's spreading to my SOUL.",
    "Do you smell toast? I smell toast.\nThat's a symptom, right? RIGHT?",
    "I'm only here for the vending\nmachine, honestly. Don't tell.",
    "My left pinky feels... opinionated.\nThat can't be good.",
    "I read one medical article\nand now I'm basically a surgeon.",
    "If I die in this chair,\ntell my bubbe I finished the soup.",
    "They called number twelve.\nI'm number nine hundred. We wait.",
    "Is the doctor cute? Asking for\nmy health. Strictly medical reasons.",
]);
const DOCTOR = pool([
    "My professional advice?\nDrink water and stop reading WebMD.",
    "Take two rugelach and call\nyour mother in the morning. Always.",
    "It's probably stress.\nWhose isn't? Next patient!",
    "Have you tried... not doing\nthe thing that hurts? Groundbreaking.",
    "I prescribe a nap and a bagel.\nThat'll be four hundred dollars.",
    "Walk it off. Worst case,\nyou walk it off to the ER. Mazel!",
    "On a scale of one to oy,\nhow much does it hurt?",
    "Good news: you'll live.\nBad news: so will the waiting room.",
    "I went to a very good school.\nMostly for the parking. Say 'ahh'.",
    "That rash? Confidence. You have\ntoo much. Tone it down. Heal.",
    "Stick out your tongue.\n...Lovely. No notes. You're cured.",
    "Two aspirin, one chicken soup,\nand absolutely no more stairs.",
]);
const VEND = pool([
    "C-7... the chips are stuck.\nClassic C-7 behavior.",
    "It took your coin AND your dignity.\nButtons are decorative here.",
    "Press B-4? It dispenses B-5.\nAnd a small existential crisis.",
    "This machine has TRUST issues.\nSo do you now. Welcome.",
    "Kosher snacks only — the machine\nchecks the hechsher, swear to it.",
    "It's leaning forward. Do NOT\nrock it. ...Okay rock it a LITTLE.",
]);
const HESHY = pool([
    "I bellyflopped, Lu. The POOL won.\nThe pool always wins.",
    "I told the lifeguard I was fine.\nI am, medically, NOT fine.",
    "Cannonball gone wrong.\nWorth it. Ten outta ten. Ow.",
    "My back went 'crunch'.\nThe whole shul heard it. Embarrassing.",
    "Slipped on the pool tiles.\nNow I'm a hospital influencer.",
    "They gave me a lollipop AND\na sling. Best day ever, honestly.",
    "Don't tell Ma I dove off the\nhigh board. ...She's behind me, isn't she.",
    "I'm 'between strokes', the doctor\nsaid. I don't even SWIM strokes!",
    "The deep end disrespected me.\nWe have BEEF now. Me and the deep end.",
    "The X-ray guy said 'wow'.\nYou never want the X-ray guy to say 'wow'.",
    "I'm getting a cast! Sign it?\nDraw something kosher. No goats.",
]);
const FISH = pool([
    "This fish has been to more\nappointments than I have.",
    "They named him Dr. Gills.\nHe's the most qualified one here.",
    "*blub* ...he's judging you.\nFish are very judgmental, mami.",
    "The tank's the only thing in here\nwith good circulation. Lucky guy.",
    "One fish. Big tank. Living the\ndream the rest of us only WAIT for.",
    "He saw what's in that vending\nmachine. He's seen things, Lu.",
]);
const TV = pool([
    "It's the news on mute, forever.\nSubtitles two minutes behind. Art.",
    "A cooking show with no sound.\nI THINK that's a brisket. Pray it is.",
    "Channel's stuck on the weather.\nIt's 'partly oy' with a chance of wait.",
    "The remote vanished in 2011.\nWe watch what HaShem decides now.",
    "Daytime TV: where everyone's\ncousin is somehow also their lawyer.",
    "The magazines are from 2006.\nGreat news! The economy's gonna be FINE.",
]);
const DESK_S = { emoji: "📋", color: "#00796B" }, PAT_S = { emoji: "🤧", color: "#2E7D32" }, DOC_S = { emoji: "🩺", color: "#1565C0" },
    VEND_S = { emoji: "🍫", color: "#C62828" }, HESHY_S = { emoji: "🩹", color: "#E53935" }, FISH_S = { emoji: "🐟", color: "#0277BD" },
    TV_S = { emoji: "📺", color: "#455A64" };

function drawTv(g, W, H, f, t) {
    const bgs = ["#263238", "#5D4037", "#37474F", "#4A148C"];
    g.fillStyle = bgs[f]; g.fillRect(0, 0, W, H);
    if (f === 0) {      // news on mute
        g.fillStyle = "#1565C0"; g.fillRect(0, H * 0.7, W, H * 0.3);
        g.fillStyle = "#FFE0CC"; g.beginPath(); g.arc(W / 2, H * 0.45, H * 0.15, 0, 7); g.fill();
        g.fillStyle = "#fff"; g.font = `700 ${H * 0.09}px sans-serif`; g.textAlign = "left";
        g.fillText("…SUBTITLES TWO MINUTES BEHIND…", W - ((t * 70) % (W * 2)), H * 0.88);
    } else if (f === 1) {   // a cooking show (a brisket, hopefully)
        g.fillStyle = "#8D6E63"; g.beginPath(); g.ellipse(W / 2, H * 0.6, W * 0.25, H * 0.15, 0, 0, 7); g.fill();
        g.fillStyle = "#ECEFF1"; g.beginPath(); g.ellipse(W / 2, H * 0.68, W * 0.33, H * 0.1, 0, 0, 7); g.fill();
        drawLines(g, "BRISKET?", W / 2, H * 0.2, H * 0.14, "#FFE082");
    } else if (f === 2) {   // partly oy
        g.fillStyle = "#FFD740"; g.beginPath(); g.arc(W * 0.35, H * 0.45, H * 0.15, 0, 7); g.fill();
        g.fillStyle = "#ECEFF1"; g.beginPath(); g.arc(W * 0.5, H * 0.55, H * 0.13, 0, 7); g.arc(W * 0.62, H * 0.52, H * 0.16, 0, 7); g.fill();
        drawLines(g, "PARTLY OY", W / 2, H * 0.85, H * 0.12, "#fff");
    } else {                // daytime TV
        g.fillStyle = "#FFE0CC"; g.beginPath(); g.arc(W * 0.33, H * 0.5, H * 0.16, 0, 7); g.arc(W * 0.67, H * 0.5, H * 0.16, 0, 7); g.fill();
        drawLines(g, "COUSIN? LAWYER?", W / 2, H * 0.85, H * 0.11, "#FF80AB");
    }
    g.globalAlpha = 0.12; g.fillStyle = "#000"; for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 2); g.globalAlpha = 1;
}
function drawChart(g, W, H) {
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const rows = [["E", 0.2], ["F P", 0.13], ["T O Z", 0.095], ["OY VEY", 0.07], ["בהצלחה", 0.05]];
    rows.forEach(([s, k], i) => drawLines(g, s, W / 2, H * (0.13 + i * 0.18), H * k, i === 4 ? "#888" : "#111", { font: "Arial, sans-serif" }));
}

export default defineInterior({
    id: "hospital", name: "Urgent Care", short: "urgent care", emoji: "🏥",
    title: "🏥 URGENT CARE — WAITING ROOM", tagline: "Maimonides-ish · please take a number",
    model: "interiorsHospital", models: ["interiorsDoctor", "heshyPerson", "npcWoman", "npcMan"],
    music: "../er1.mp3",
    light: "indoor", sky: "#d8f0ee",
    bounds: { x0: -7.6, x1: 7.6, z0: -4.5, z1: 4.6 },
    cam: { dist: 7.3, height: 4.8 },

    build(rt) {
        const set = rt.set, d = rt.data;
        set.hemi.color.set("#f2ffff"); set.hemi.intensity = 1.55;
        set.sun.color.set("#ffffff");
        [0, 1, 2].forEach(k => rt.pointLight("panel" + k, "#eaffff", 5, 9));
        d.lamp = rt.pointLight("lamp", "#ffe082", 4, 5);
        d.amb = rt.pointLight("ambulance", "#ff1744", 0, 9);
        d.ambT = 0;

        // TV + eye chart + NOW SERVING board
        const tvf = rt.fx("tv");
        d.tvFrame = 0;
        d.tv = canvasPlane(set, 1.45, 0.8, (g, W, H, t) => drawTv(g, W, H, d.tvFrame, t), { px: 256 });
        d.tv.mesh.position.set(tvf.x, tvf.y, tvf.z + 0.012);
        rt.add(d.tv.mesh);
        rt.every(2.5, 5, () => { d.tvFrame = (d.tvFrame + 1) % 4; }, { gate: false });
        const ec = rt.fx("eyechart");
        const chart = canvasPlane(set, 0.8, 1.18, drawChart, { px: 256, lit: true });
        chart.mesh.position.set(ec.x + 0.01, ec.y, ec.z);
        chart.mesh.rotation.y = Math.PI / 2;
        rt.add(chart.mesh);
        const ns = rt.fx("nowserving");
        d.serve = randInt(5, 30); d.serveFlash = 0;
        d.board = canvasPlane(set, 1.5, 0.42, (g, W, H) => {
            g.fillStyle = "#102027"; g.fillRect(0, 0, W, H);
            drawLines(g, "NOW SERVING", W * 0.32, H * 0.5, H * 0.26, "#80CBC4");
            drawLines(g, "#" + d.serve, W * 0.8, H * 0.52, H * 0.55, d.serveFlash > 0 ? "#FFEB3B" : "#FF5252", { font: "Courier New, monospace" });
        }, { px: 512 });
        d.board.mesh.position.set(ns.x, ns.y, ns.z + 0.01);
        rt.add(d.board.mesh);
        rt.every(7, 13, () => { d.serve++; d.serveFlash = 0.8; d.board.redraw(); tone(880, 0.07, "sine", 0.1); tone(660, 0.1, "sine", 0.08, 0, 0.1); }, { gate: false });

        // fish in the tank
        const tk = rt.fx("tank");
        d.fish = ["#FF7043", "#FFB300", "#42A5F5"].map((c, k) => {
            const f = rt.prop("Fish");
            f.traverse(o => { if (o.isMesh && o.material.name === "PropFish") { o.material = o.material.clone(); o.material.color.set(c); rt.own(o.material); } });
            f.position.set(tk.x + rand(-0.5, 0.5), tk.y + rand(-0.2, 0.2), tk.z + rand(-0.1, 0.1));
            rt.add(f);
            return { f, vx: (k % 2 ? 1 : -1) * rand(0.12, 0.25), ph: rand(0, 6), base: f.position.y };
        });
        d.tank = tk;
        d.vend = rt.node("VendMachine");
        d.vendShake = 0;

        // ── people ──
        rt.person("receptionist", "npcWoman", { x: 0, z: rt.spot("reception").z - 0.4, ry: 0 }, { name: "Receptionist", colors: { Top: "#4DB6AC", Bottom: "#00695C", Hair: "#6D4C41" } });
        const pat = rt.person("patient", "npcMan", "patient", { name: "Hypochondriac", colors: { Top: "#43A047", Bottom: "#455A64", Hair: "#8D6E63" },
            pose: { sit: true }, y: 0.05, faceLulu: false, collide: false,
            post(p, dt, t, rt) {   // nervous hands, the odd cough
                if (rt.data.cough > 0) { p.obj.rotation.x = Math.sin(rt.data.cough * 30) * 0.06; if (p.limbs.Arm_R) p.limbs.Arm_R.rotateX(-1.6); }
                else p.obj.rotation.x = 0;
            } });
        const heshy = rt.person("heshy", "heshyPerson", "heshy", { name: "Heshy", pose: { sit: true }, y: 0.05, faceLulu: false, collide: false });
        rt.hold(heshy.p, "Sling", { arm: "Arm_L", y: -0.05, z: 0 });
        const doc = rt.person("doctor", "interiorsDoctor", "doctor", { name: "The doctor" });
        rt.hold(doc.p, "Clipboard", { y: -0.42, z: 0.12 });
        doc.post = (p) => { if (p.limbs.Arm_R) p.limbs.Arm_R.rotateX(-0.9); };

        // ── hotspots ──
        const r = rt.spot("reception");
        rt.hot({ id: "reception", x: r.x, z: r.z + 1.9, who: "receptionist", r: 1.5, label: "📋 Talk to the receptionist",
            action: rt => { tone(440, 0.08, "sine", 0.1); return rt.say("Receptionist", RECEPTION(), Object.assign({ person: rt.byId.receptionist }, DESK_S)); } });
        rt.hot({ id: "patient", x: pat.home.x, z: pat.home.z + 0.95, who: "patient", r: 1.1, label: "🤧 Talk to the nervous patient",
            action: rt => { tone(620, 0.07, "triangle", 0.12); return rt.say("Hypochondriac", PATIENT(), Object.assign({ person: rt.byId.patient }, PAT_S)); } });
        rt.hot({ id: "doctor", spot: "doctor", who: "doctor", r: 1.6, label: "🩺 Ask the doctor",
            action: rt => { tone(330, 0.1, "sine", 0.12); return rt.say("The doctor", DOCTOR(), Object.assign({ person: rt.byId.doctor }, DOC_S)); } });
        rt.hot({ id: "vending", spot: "vending", r: 1.3, label: "🍫 Try the SNAX machine", action: vending });
        rt.hot({ id: "heshy", x: heshy.home.x, z: heshy.home.z + 0.95, who: "heshy", r: 1.1, label: "🩹 Visit Heshy", action: async rt => {
            await rt.say("Heshy", HESHY(), Object.assign({ person: rt.byId.heshy }, HESHY_S));
            if (rt.disposed) return;
            if (!rt.used.heshy) {           // a get-well star the first time, flavor after
                rt.used.heshy = true;
                const at = rt.byId.heshy.p.obj.position.clone().setY(1.3);
                rt.star(1, "⭐ get-well star", at);
                rt.coins(3, "+3 💰 get-well gelt!", at);
                sfx.hop();
            } else tone(523, 0.08, "triangle", 0.14);
        } });
        rt.hot({ id: "fish", spot: "fish", r: 1.3, label: "🐟 Look at the fish tank", action: rt => { tone(700, 0.07, "sine", 0.09, 480); return rt.say("Dr. Gills", FISH(), FISH_S); } });
        rt.hot({ id: "tv", spot: "tv", r: 1.4, label: "📺 Watch the waiting-room TV", action: rt => { tone(280, 0.06, "square", 0.08); return rt.say("Waiting-room TV", TV(), TV_S); } });

        // ── ambient life ──
        d.cough = 0;
        rt.every(3, 6, rt => { rt.data.cough = 0.5; tone(220, 0.09, "square", 0.08); tone(180, 0.12, "square", 0.06, 0, 0.1);
            rt.bubble("*kof kof*", pat.p.obj, 1.2, { yOff: 1.6, size: 0.55, color: "#607D8B" }); }, { first: rand(2.5, 5) });
        rt.every(4, 9, rt => { rt.data.vendShake = Math.max(rt.data.vendShake, 0.4); tone(110, 0.12, "sawtooth", 0.06); }, { gate: false });
        rt.every(0.8, 1.6, rt => { const f = rt.fx("drip"); rt.particles.emit(f.x, f.y, f.z, 0, -0.2, 0, 0.018, 0.6, "#4FC3F7", 3); }, { gate: false });
        rt.every(9, 16, rt => { rt.data.ambT = 2.4; tone(960, 0.3, "triangle", 0.04); }, { first: rand(4, 9) });
        d.nurse = null;
        rt.every(7, 13, rt => { if (!rt.data.nurse) spawnNurse(rt); }, { first: rand(4, 8) });
    },

    tick(rt, dt) {
        const d = rt.data, t = rt.t;
        if (d.cough > 0) d.cough -= dt;
        if (d.serveFlash > 0) { d.serveFlash -= dt; if (d.serveFlash <= 0) d.board.redraw(); }
        // the vending machine wobbles on its own (and when you use it)
        if (d.vendShake > 0) d.vendShake -= dt;
        if (d.vend) d.vend.rotation.z = d.vendShake > 0 ? Math.sin(t * 40) * 0.03 * Math.min(1, d.vendShake * 3) : 0;
        // ambulance lights through the window
        if (d.ambT > 0) {
            d.ambT -= dt;
            const red = Math.sin(t * 16) > 0;
            d.amb.color.set(red ? "#ff1744" : "#2979ff");
            d.amb.intensity = 10 * Math.min(1, d.ambT * 2);
        } else d.amb.intensity = 0;
        // fish swim back and forth
        for (const f of d.fish) {
            f.f.position.x += f.vx * dt;
            if (f.f.position.x < d.tank.x - 0.6) f.vx = Math.abs(f.vx);
            if (f.f.position.x > d.tank.x + 0.6) f.vx = -Math.abs(f.vx);
            f.ph += dt;
            f.f.position.y = f.base + Math.sin(f.ph * 1.3) * 0.05;
            f.f.rotation.y = f.vx > 0 ? Math.PI / 2 : -Math.PI / 2;
            f.f.rotation.z = Math.sin(f.ph * 8) * 0.12;
        }
        if (Math.floor(t * 8) !== d.tvTick) { d.tvTick = Math.floor(t * 8); d.tv.redraw(t); }
        // the nurse with her clipboard
        if (d.nurse) {
            const o = d.nurse.rec.p.obj;
            o.position.x += d.nurse.dir * 1.6 * dt;
            if (Math.abs(o.position.x) > 9.5) { rt.set.scene.remove(o); rt.people.splice(rt.people.indexOf(d.nurse.rec), 1); d.nurse = null; }
        }
        // a snack dropping into the tray
        if (d.snack) {
            d.snack.t += dt;
            const o = d.snack.obj;
            o.position.y = Math.max(0.36, d.snack.y0 - d.snack.t * d.snack.t * 6);
            o.rotation.z += dt * 6;
            if (d.snack.t > 1.2) { o.removeFromParent(); d.snack = null; }
        }
    },
});

async function vending(rt) {
    const d = rt.data, s = rt.spot("vending");
    d.vendShake = 0.5;
    tone(150, 0.08, "square", 0.08);
    const at = new THREE.Vector3(s.x - 0.1, 1.0, s.z - 0.6);
    const roll = force.vend || (Math.random() < 0.6 ? "snack" : "eat");
    if (roll === "snack") {                 // 60%: a snack (+5)
        const sn = rt.prop("Snack");
        sn.position.set(s.x - 0.25, 1.3, s.z - 0.75);
        rt.add(sn);
        d.snack = { obj: sn, t: 0, y0: 1.3 };
        rt.coins(5, "+5 💰 snack!", at);
        rt.burst(at, ["#FFD700", "#FF8A65", "#FFF176"], 8, 1.6, 0.05);
    } else if (ctx.G.coins > 0) {           // 40%: it ATE a coin (only if she has run coins)
        ctx.G.coins = Math.max(0, ctx.G.coins - 1);
        wallet.add(-1);
        H.toast("-1 💸 it ATE it!", "red");
        sfx.womp();
    } else {
        H.toast("*clunk* ...nothing.", "");
        tone(150, 0.18, "square", 0.14);
    }
    await rt.say("SNAX machine", VEND(), VEND_S);
}

function spawnNurse(rt) {
    const fromL = Math.random() < 0.5;
    const rec = rt.person("nurse" + Math.floor(rt.t), "npcWoman", { x: fromL ? -9 : 9, z: 3.9, ry: fromL ? Math.PI / 2 : -Math.PI / 2 },
        { colors: { Top: "#F48FB1", Bottom: "#F48FB1", Hair: "#4E342E" }, collide: false, faceLulu: false, pose: { walk: 1.6 } });
    rt.hold(rec.p, "Clipboard", { y: -0.42, z: 0.1 });
    rec.post = p => { if (p.limbs.Arm_R) p.limbs.Arm_R.rotateX(-1.0); };
    rt.data.nurse = { rec, dir: fromL ? 1 : -1 };
}
