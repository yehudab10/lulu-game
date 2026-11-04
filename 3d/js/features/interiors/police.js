// interiors/police.js — "PRECINCT 18½": Officer Pomerantz at the front desk (donut,
// impound talk, a ringing phone), "The Schmear" pacing the holding cell, the MOST
// WANTED board, the precinct coffee machine (+30 coins once), the confession booth,
// the ceiling fan, and the PAY FINES window — settle your charges (50 + 40 a charge)
// and the cops call off the hunt. Leaving sometimes plays the comedic sneak-out
// (tiptoe / army-crawl / mop / fire alarm) — clean getaway or a funny nab, she's
// shooed out either way. Lines from src/08e-foot-police-beach.js.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { shared, wallet } from "../../core/save.js";
import * as H from "../../hud.js";
import { defineInterior, pool, pick, rand, GOLD, force } from "./engine.js";
import { canvasPlane, drawLines, roundRect, sfx, tone } from "./fx.js";

const DESK = pool([
    "Officer Pomerantz, how can I— oh, it's you.",
    "Your car? It's in the lot. $400 to spring it.",
    "Impound's $400, hon. And no, I can't 'round down.'",
    "We don't validate parking. We validate FEELINGS.",
    "You can file a complaint. It goes in this drawer.\n(The drawer is taped shut.)",
    "Lost and found? One umbrella, a herring, and regret.",
    "Sign here. And here. And here. And here. And here.",
    "Yes the donut's a bribe. From me. To me.",
    "Crime's down 2% since I started napping at noon.",
    "Your bubbe called. Twice. She says EAT.",
    "No I will NOT 'just this once' waive the fee.",
    "Press 1 for impound, 2 for snacks, 3 to hear this again.",
    "*phone rings* Precinct 18½, you bend it you mend it.",
    "Coffee's free, justice is not, and the donut is mine.",
    "We're understaffed. It's me, the fan, and a confused perp.",
]);
const PERP = pool([
    "I'm innocent! I only TASTED the kugel display.",
    "They got me for jaywalking. Diagonally. Twice.",
    "Psst — you got a nail file? Or like, a bagel file?",
    "I'm in for excessive parallel parking. It's a crime here.",
    "One phone call and I used it to order a pizza.",
    "I didn't do it. But I'd do it again. The pizza, I mean.",
    "Cell's got no WiFi. THIS is the real punishment.",
    "I'm basically a prisoner of my own bad choices. Relatable?",
    "If you see Heshy out there, tell him I said NOTHING.",
    "They call me 'The Schmear.' I don't know why. (I do.)",
    "Three squares a day and they're all bagels. No complaints.",
    "You bring snacks? No? Worst rescue ever.",
    "I'd shake your hand but, y'know. Bars. Boundaries.",
    "*rattles bars* These? Decorative. The shame's the real cage.",
    "I've counted these bars 400 times. There are eight. Eight!",
    "Pacing's my cardio now. Six steps left, six steps right.",
    "Tell the cop I want my one call. To complain about the bagels.",
]);
const BOARD = pool([
    "MOST WANTED: 7-foot 'Bigfoot.' Last seen... everywhere.",
    "Reward: 200 coins. Distinguishing feature: ENORMOUS.",
    "WANTED: Heshy. Crime: cannonballs in the kiddie pool.",
    "This poster's just a guy in a gorilla suit. Probably.",
    "WANTED for questioning: whoever ate the desk donuts.",
    "Hmm. That sasquatch sketch looks suspiciously fluffy.",
    "Suspect described as 'large, hairy, surprisingly polite.'",
    "Last seen fleeing a salon. With GREAT highlights.",
    "Armed and... fragrant? Smells like pine and chutzpah.",
    "BOLO: a minivan driven 'like a woman possessed.' (Mom.)",
    "There's a crayon 'wanted' poster of Dina. Aww. Denied.",
    "Reward doubles if you bring him in conditioned & calm.",
]);
const COFFEE = pool([
    "FREE precinct coffee! Found 30 coins in the change slot!",
    "Jackpot — the machine coughed up 30 coins. Cop coffee!",
    "It's lukewarm, it's free, it tipped you 30 coins. Win.",
    "Tastes like a stakeout smells. But hey — 30 coins!",
    "The 'cappuccino' button dispenses pure caffeine + coins!",
]);
const COFFEE_AGAIN = "It's lukewarm, it's free. The change slot's empty now, though.";
const CONFESS = pool([
    "\"I confess! I jaywalked!\" ...Cop: \"We all do, hon.\"",
    "\"I double-parked outside Bubbe's!\" Cop: \"Bold. Continue.\"",
    "\"I took the last babka.\" Cop: \"THAT one's a real crime.\"",
    "\"I U-turned where I shouldn't.\" Cop: \"Show-off.\"",
    "\"I sped to make Shabbos.\" Cop: \"...okay that's fair.\"",
    "\"I honked at a goose.\" Cop: \"The goose had it coming.\"",
    "\"I parked in the rabbi's spot.\" Cop: \"...new charges.\"",
    "You confess. The cop yawns. Justice is exhausting.",
]);
const FAN = pool([
    "The fan squeaks once per rotation. It's almost music.",
    "It's been spinning since 1987. Don't ask, no one knows.",
    "Best AC in the building. The ONLY AC in the building.",
    "It wobbles like it's nervous. Same, fan. Same.",
    "A paper airplane's been stuck up there for a year.",
]);
const DISPATCH = [
    "📻 *kkrrt* ...10-91, loose goat on Route 6...",
    "📻 *kkrrt* ...be advised, babka heist in progress...",
    "📻 *kkrrt* ...all units, double-parked minivan, code MOM...",
    "📻 *kkrrt* ...suspect described as tall, hairy, polite...",
    "📻 *kkrrt* ...possible 10-56, man overboard at Shtrand...",
    "📻 *kkrrt* ...requesting backup, the donuts are GONE...",
    "📻 *kkrrt* ...Heshy sighting near the kiddie pool, again...",
];
const ESCAPES = [
    { attempt: "🤫 ...tiptoes past the donut-munching desk cop.", visual: "tiptoe" },
    { attempt: "🪖 ...army-crawls across the precinct floor.", visual: "crawl" },
    { attempt: "🧹 ...grabs a mop — 'just the janitor, officer!'", visual: "mop" },
    { attempt: "🔔 ...yanks the fire alarm and bolts in the chaos!", visual: "alarm" },
];
const CLEAN = ["...waltzed right out the front door. 🚶‍♀️💨", "The cop never looked up from his cruller. 🍩",
    "Out clean — she even swiped a lollipop. 🍭", "Smooth. Nobody saw a thing.", "Strolled past three cops. Confidence is a disguise."];
const CAUGHT = [
    { line: "The desk cop looks up mid-bite: 'Goin' SOMEWHERE?' 🍩👮", visual: "donut" },
    { line: "A K9 clamps onto her pant leg. Good boy. 🐕🚔", visual: "k9" },
    { line: "The front door swings open — backup's already there. 🚓", visual: "backup" },
];
const COP_S = { emoji: "👮", color: "#1A237E" }, PERP_S = { emoji: "🦹", color: "#424242" }, BOARD_S = { emoji: "📌", color: "#B71C1C" },
    COFFEE_S = { emoji: "☕", color: "#5D4037" }, CONF_S = { emoji: "🙊", color: "#7B1FA2" }, FAN_S = { emoji: "🌀", color: "#546E7A" },
    FINES_S = { emoji: "🧾", color: "#C62828" };

// ── charges (the shared 2D save.wanted list, or ctx.law's wanted level) ───
function charges() {
    const list = shared.get().wanted;
    const n = Array.isArray(list) ? list.length : 0;
    const lv = ctx.law && typeof ctx.law.wanted === "number" ? ctx.law.wanted : 0;
    return { n: Math.max(n, lv), list: Array.isArray(list) ? list : [] };
}
export function wantedFee() { const c = charges(); return c.n > 0 ? 50 + c.n * 40 : 0; }
function clearCharges() {
    shared.update(s => { s.wanted = []; });
    if (ctx.law) {
        if (typeof ctx.law.clearWanted === "function") { try { ctx.law.clearWanted(); } catch (e) { console.error(e); } }
        else { try { if (typeof ctx.law.wanted === "number") ctx.law.wanted = 0; } catch (e) { /* read-only getter */ } }
    }
    emit("law:cleared", { by: "fine" });
}

async function settleCharges(rt) {
    const c = charges();
    const cop = rt.byId.deskcop;
    if (c.n <= 0) {
        await rt.say("Fines window", pick(["Your record's clean as a whistle, hon.", "Nothin' on file. Keep it that way.",
            "No charges pending. Don't tempt me to FIND some."]), Object.assign({ person: cop }, FINES_S));
        return;
    }
    const fee = wantedFee();
    const list = c.list.slice(0, 3).join(", ") || "evading the law";
    const i = await rt.choose("Fines window", `On file: ${list}${c.list.length > 3 ? "…" : ""}. Settle up for 💰${fee}?`,
        [`🧾 Pay 💰${fee}`, "🙈 Not today"], Object.assign({ person: cop }, FINES_S));
    if (i !== 0 || rt.disposed) return;
    if (wallet.coins < fee) {
        sfx.deny();
        await rt.say("Fines window", "Can't cover the fine? Then you're STILL wanted, hon.", Object.assign({ person: cop }, FINES_S));
        return;
    }
    if (!rt.pay(fee)) return;
    clearCharges();
    const s = rt.spot("fines");
    rt.burst(new THREE.Vector3(s.x, 1.6, s.z - 0.6), ["#7CFC4F", "#FFFFFF", "#B9F6CA"], 16, 2.2, 0.06);
    H.toast("🧾 record wiped clean!", "gold");
    sfx.coin();
    await rt.say("Fines window", "Paid in full. Charges DROPPED — cops'll leave you be.", Object.assign({ person: cop }, FINES_S));
}

// ── wall art ──────────────────────────────────────────────────────────────
function drawWanted(g, W, H) {
    g.fillStyle = "#E8C79A"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#F5E6C8"; roundRect(g, W * 0.3, H * 0.03, W * 0.4, H * 0.15, 8); g.fill();
    drawLines(g, "MOST WANTED", W / 2, H * 0.105, H * 0.07, "#3A2A12");
    const posters = [["BIGFOOT", "$200", "#6D4C41"], ["HESHY", "CANNONBALLS", "#FF5252"], ["???", "FLUFFY", "#8D6E63"], ["DINA", "(crayon)", "#F48FB1"]];
    const c = charges();
    if (c.n > 0) posters[2] = ["LULU", (c.list[0] || "AT LARGE").slice(0, 18), "#4FC3F7"];
    posters.forEach(([name, sub, col], k) => {
        const x = W * (0.07 + (k % 2) * 0.46), y = H * (0.22 + Math.floor(k / 2) * 0.39), w = W * 0.4, h = H * 0.34;
        g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((k % 2 ? 1 : -1) * 0.04); g.translate(-w / 2, -h / 2);
        g.fillStyle = "#FFF8E1"; g.fillRect(0, 0, w, h);
        drawLines(g, "WANTED", w / 2, h * 0.11, h * 0.1, "#B71C1C");
        g.fillStyle = col; g.beginPath(); g.arc(w / 2, h * 0.45, h * 0.18, 0, 7); g.fill();
        g.fillStyle = "#212121"; g.beginPath(); g.arc(w / 2 - h * 0.06, h * 0.42, h * 0.025, 0, 7); g.arc(w / 2 + h * 0.06, h * 0.42, h * 0.025, 0, 7); g.fill();
        drawLines(g, name, w / 2, h * 0.76, h * 0.12, "#3A2A12");
        drawLines(g, sub, w / 2, h * 0.9, h * 0.08, "#B71C1C", { maxW: w * 0.92 });
        g.fillStyle = "#E53935"; g.beginPath(); g.arc(w / 2, h * 0.02, 6, 0, 7); g.fill();
        g.restore();
    });
}
function drawOfficer(g, W, H) {
    g.fillStyle = "#5D4037"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#B3E5FC"; g.fillRect(W * 0.08, H * 0.06, W * 0.84, H * 0.7);
    g.fillStyle = "#FFE0CC"; g.beginPath(); g.arc(W / 2, H * 0.42, H * 0.15, 0, 7); g.fill();
    g.fillStyle = "#1A237E"; g.fillRect(W * 0.3, H * 0.22, W * 0.4, H * 0.09); g.fillRect(W * 0.28, H * 0.56, W * 0.44, H * 0.2);
    g.fillStyle = "#F48FB1"; g.beginPath(); g.arc(W * 0.7, H * 0.6, H * 0.07, 0, 7); g.fill();
    drawLines(g, "OFFICER O' MONTH", W / 2, H * 0.88, H * 0.09, "#FFD54F");
}
function drawPoster(g, W, H) {
    g.fillStyle = "#1A237E"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#F8BBD0"; g.beginPath(); g.arc(W / 2, H * 0.36, H * 0.18, 0, 7); g.fill();
    g.fillStyle = "#1A237E"; g.beginPath(); g.arc(W / 2, H * 0.36, H * 0.06, 0, 7); g.fill();
    drawLines(g, "PROTECT", W / 2, H * 0.66, H * 0.09, "#FFD54F");
    drawLines(g, "& SERVE", W / 2, H * 0.77, H * 0.09, "#FFD54F");
    drawLines(g, "(SNACKS)", W / 2, H * 0.89, H * 0.07, "#FFFFFF");
}

// ── the sneak-out (mirrors the ER escape) ─────────────────────────────────
async function sneakOut(rt) {
    const go = force.escape != null ? force.escape : (ctx.enabled("interiors") && Math.random() < 0.55);
    if (!go) return;
    const esc = (force.escapeKind && ESCAPES.find(e => e.visual === force.escapeKind)) || pick(ESCAPES);
    const caught = force.caught != null ? force.caught : Math.random() < 0.45;
    const gag = (force.gag && CAUGHT.find(g => g.visual === force.gag)) || pick(CAUGHT);
    const d = rt.data, L = rt.lulu.obj, door = rt.spot("door");
    const cap = document.createElement("div");
    cap.className = "int-caption";
    cap.textContent = esc.attempt;
    rt.extraEl.appendChild(cap);
    rt.focusAt = rt.byId.deskcop.p.obj.position.clone();
    // start back by the desk so the bit plays across the room
    const start = new THREE.Vector3(-1.0, 0, -0.6);
    L.position.copy(start);
    const speed = esc.visual === "crawl" ? 2.4 : esc.visual === "tiptoe" ? 2.0 : esc.visual === "alarm" ? 4.2 : 2.6;
    if (esc.visual === "mop") rt.luluHold("Mop", { y: -0.3, z: 0.25, rx: 0.3 });
    if (esc.visual === "alarm") { sfx.bell(); d.alarm = 2.6; }
    d.escaping = esc.visual;
    rt.lock = true;
    L.rotation.order = "YXZ";
    await rt.runMode({
        t: 0,
        update(rt, dt) {
            this.t += dt;
            const k = Math.min(1, this.t / 2.3);
            L.position.x = start.x + (door.x - 0.6 - start.x) * k;
            L.position.z = start.z + (door.z - start.z) * k;
            L.rotation.y = Math.atan2(door.x - start.x, door.z - start.z);
            if (esc.visual === "crawl") { L.rotation.x = 1.35; L.position.y = 0.22; rt.luluPose = { walk: speed }; }
            else if (esc.visual === "tiptoe") { L.position.y = Math.abs(Math.sin(this.t * 6)) * 0.08; rt.luluPose = { walk: 1.2 }; }
            else rt.luluPose = { walk: speed };
            if ((esc.visual === "crawl" || esc.visual === "alarm") && Math.random() < 0.5)
                rt.particles.emit(L.position.x, 0.1, L.position.z, rand(-0.6, 0.6), rand(0.3, 0.8), rand(-0.6, 0.6), 0.09, 0.5, "#CFD8DC", -0.3);
            rt.focusAt.lerp(L.position, dt * 1.5);
            return this.t >= 2.3;
        },
    });
    L.rotation.x = 0; L.position.y = 0;
    L.rotation.order = "XYZ";
    rt.luluPose = null;
    if (rt.disposed) return;
    if (!caught) {
        cap.textContent = pick(CLEAN);
        H.toast("🏃 Out clean!", "gold");
        tone(659, 0.1, "triangle", 0.2); tone(988, 0.12, "triangle", 0.2, 0, 0.09);
        await rt.wait(1.2);
    } else {
        cap.textContent = gag.line;
        cap.style.color = "#FF8A80";
        tone(200, 0.12, "square", 0.14);
        sfx.womp();
        rt.luluPose = { cheer: false };
        const cop = rt.byId.deskcop;
        if (gag.visual === "donut") {
            cop.pose.sit = false; cop.p.obj.position.y = 0;
            cop.p.face(L.position.x, L.position.z, 1, 1);
            rt.bubble("Goin' SOMEWHERE? 🍩", cop.p.obj, 2.2, { color: "#B71C1C" });
        } else if (gag.visual === "k9") {
            const dog = rt.prop("K9");
            dog.position.set(L.position.x + 0.55, 0, L.position.z + 0.2);
            dog.rotation.y = -Math.PI / 2;
            rt.add(dog);
            d.dog = dog;
            rt.bubble("GRRR! *wag wag*", dog, 2.2, { yOff: 1.0, size: 0.7 });
        } else {
            const back = rt.person("backup", "copPerson", { x: door.x - 0.1, z: door.z, ry: -Math.PI / 2 }, { name: "Backup", faceLulu: true, collide: false });
            back.pose.point = true;
            rt.bubble("Nice try, Lulu. OUT you go.", back.p.obj, 2.2, { color: "#1A237E" });
        }
        H.banner("🚨 <b>NABBED</b> 🚨", 1800);
        await rt.wait(2.2);
        H.toast("😳 ...shooed back to the street.", "pink");
    }
    cap.remove();
    rt.focusAt = null;
    rt.lock = false;
}

export default defineInterior({
    id: "police", name: "Precinct 18½", short: "the precinct", emoji: "🚓",
    title: "🚓 PRECINCT 18½ — POLICE", tagline: "You bend it, you mend it",
    model: "interiorsPolice", models: ["copPerson", "interiorsPerp"],
    music: "../prison.mp3",
    light: "indoor", sky: "#a9bfd4",
    bounds: { x0: -7.6, x1: 7.6, z0: -4.5, z1: 4.6 },
    cam: { dist: 7.4, height: 4.9 },
    beforeLeave: sneakOut,

    build(rt) {
        const set = rt.set, d = rt.data;
        set.hemi.color.set("#e6f0ff"); set.hemi.intensity = 1.35;
        set.sun.color.set("#f4f8ff"); set.sun.intensity = 1.2;
        d.tubes = [0, 1].map(k => rt.pointLight("tube" + k, "#eef6ff", 7, 10));
        d.alarmLight = rt.pointLight("alarm", "#ff1744", 0, 10);
        d.tubeMats = [];
        rt.root.traverse(o => { if (o.isMesh && /^NeonTube/.test(o.material.name) && !d.tubeMats.includes(o.material)) d.tubeMats.push(o.material); });
        for (const m of d.tubeMats) { m.userData.base = m.userData.base || m.emissiveIntensity; m.emissiveIntensity = m.userData.base; }
        d.flick = 1; d.flickT = 0;
        d.fan = rt.node("FanBlades");
        d.bars = rt.node("CellBars");
        d.phone = rt.node("Phone");
        d.phoneT = 0;

        // wall art
        const wf = rt.fx("wanted");
        d.board = canvasPlane(set, 2.3, 1.6, drawWanted, { px: 512, lit: true });
        d.board.mesh.position.set(wf.x - 0.01, wf.y, wf.z);
        d.board.mesh.rotation.y = -Math.PI / 2;
        rt.add(d.board.mesh);
        const of = rt.fx("officer");
        const ph = canvasPlane(set, 0.7, 0.8, drawOfficer, { px: 256, lit: true });
        ph.mesh.position.set(of.x, of.y, of.z + 0.01);
        rt.add(ph.mesh);
        const pf = rt.fx("poster");
        const po = canvasPlane(set, 0.9, 1.2, drawPoster, { px: 256, lit: true });
        po.mesh.position.set(pf.x, pf.y, pf.z + 0.01);
        rt.add(po.mesh);

        // ── people ──
        const cop = rt.person("deskcop", "copPerson", "deskcop", { name: "Officer Pomerantz", pose: { sit: true }, y: 0.3, faceLulu: false, collide: false,
            post(p, dt, t) { if (p.limbs.Arm_R && p.obj.position.y > 0) p.limbs.Arm_R.rotateX(-1.2 - Math.max(0, Math.sin(t * 1.5)) * 0.6); } });
        d.donut = rt.hold(cop.p, "Donut", { y: -0.47, z: 0.05, rx: 1.4 });
        const perp = rt.person("perp", "interiorsPerp", "perp", { name: "The Schmear", collide: false, faceLulu: false });
        d.perpX = perp.home.x;

        // ── hotspots ──
        rt.hot({ id: "desk", spot: "desk", who: "deskcop", r: 1.4, label: "👮 Talk to the desk cop",
            action: rt => rt.say("Officer Pomerantz", DESK(), Object.assign({ person: rt.byId.deskcop }, COP_S)) });
        rt.hot({ id: "fines", spot: "fines", r: 1.2,
            label: () => { const f = wantedFee(); return f ? `🧾 Settle charges · 💰${f}` : "🧾 Fines window (record clean ✓)"; },
            action: settleCharges });
        rt.hot({ id: "cell", spot: "cell", who: "perp", r: 1.5, label: "🦹 Talk to the perp", action: async rt => {
            rt.data.rattle = 0.8;
            await rt.say("The Schmear", PERP(), Object.assign({ person: rt.byId.perp }, PERP_S));
        } });
        rt.hot({ id: "board", spot: "board", r: 1.5, label: "📌 Read the MOST WANTED board", action: rt => { rt.data.board.redraw(); return rt.say("Most Wanted", BOARD(), BOARD_S); } });
        rt.hot({ id: "coffee", spot: "coffee", r: 1.3, label: "☕ Precinct coffee", action: async rt => {
            const s = rt.spot("coffee"), at = new THREE.Vector3(s.x, 1.1, s.z - 0.9);
            for (let i = 0; i < 8; i++) rt.particles.emit(at.x, 0.8, at.z - 0.2, rand(-0.1, 0.1), rand(0.3, 0.6), 0, 0.05, 1.2, "#ECEFF1", -0.2);
            if (!rt.used.coffee) {
                rt.used.coffee = true;
                rt.luluHold("Cup");
                rt.coins(30, "+30", at);
                rt.burst(at, ["#FFD700", "#6F4E37", "#FFF8B0"], 12, 2.0, 0.05);
                await rt.say("Coffee machine", COFFEE(), COFFEE_S);
            } else await rt.say("Coffee machine", COFFEE_AGAIN, COFFEE_S);
        } });
        rt.hot({ id: "confess", spot: "confess", r: 1.3, label: "🙊 Step into the confession box", action: rt => rt.say("Confession box", CONFESS(), CONF_S) });
        rt.hot({ id: "fan", spot: "fan", r: 0.9, label: "🌀 Look up at the ceiling fan", action: rt => rt.say("Ceiling fan", FAN(), FAN_S) });

        // ── ambient precinct life ──
        rt.every(6, 12, rt => { rt.data.phoneT = rand(2, 3.5); }, { first: rand(4, 8) });
        rt.every(8, 14, rt => {
            if (Math.random() < 0.55) {
                rt.bubble(pick(DISPATCH), rt.byId.deskcop.p.obj, 3.2, { color: "#1B5E20", bg: "#E8F5E9", yOff: 2.2, size: 1.15 });
                tone(620, 0.08, "square", 0.05, 760);
            } else haulPast(rt);
        }, { first: rand(6, 11) });
        rt.every(3.5, 6, rt => { if (Math.random() < 0.4) rt.data.rattle = 0.6; }, { gate: false });
    },

    tick(rt, dt) {
        const d = rt.data, t = rt.t;
        if (d.fan) d.fan.rotation.y += dt * 5;
        d.flickT -= dt;
        if (d.flickT <= 0) { d.flickT = rand(0.06, 0.5); d.flick = Math.random() < 0.18 ? rand(0.45, 0.7) : rand(0.92, 1); }
        for (const m of d.tubeMats) m.emissiveIntensity = m.userData.base * d.flick;
        d.tubes[0].intensity = 7 * d.flick;
        // the perp paces his cell and rattles the bars
        const perp = rt.byId.perp;
        if (perp && rt.active !== rt.hots.find(h => h.id === "cell")) {
            const px = d.perpX + Math.sin(t * 1.4) * 1.1;
            const o = perp.p.obj;
            perp.pose.walk = Math.abs(Math.cos(t * 1.4)) * 1.4;
            o.rotation.y = Math.cos(t * 1.4) > 0 ? Math.PI / 2 : -Math.PI / 2;
            o.position.x = px;
        } else if (perp) { perp.pose.walk = 0; perp.p.face(rt.lulu.obj.position.x, rt.lulu.obj.position.z, dt, 5); }
        if (d.rattle > 0) d.rattle -= dt;
        if (d.bars) d.bars.position.x = d.rattle > 0 ? Math.sin(t * 50) * 0.015 : 0;
        // the rotary phone rings
        if (d.phoneT > 0) {
            d.phoneT -= dt;
            if (d.phone) d.phone.position.y = Math.abs(Math.sin(t * 40)) * 0.02;
            if (Math.floor(t * 4) !== d.ringTick) { d.ringTick = Math.floor(t * 4); if (d.ringTick % 2) tone(1180, 0.1, "square", 0.04); }
        } else if (d.phone) d.phone.position.y = 0;
        // the fire alarm (sneak-out)
        if (d.alarm > 0) { d.alarm -= dt; d.alarmLight.intensity = Math.sin(t * 14) > 0 ? 12 : 2; if (Math.floor(t * 3) !== d.alarmTick) { d.alarmTick = Math.floor(t * 3); sfx.bell(); } }
        else d.alarmLight.intensity = 0;
        // the K9 tugging at her pant leg
        if (d.dog) d.dog.rotation.z = Math.sin(t * 20) * 0.08;
        // the perp procession crossing the back hall
        if (d.haul) {
            d.haul.t += dt;
            for (const [k, rec] of d.haul.recs.entries()) {
                rec.p.obj.position.x = d.haul.x0 + d.haul.t * 1.3 - k * 0.9;
                if (rec.p.obj.position.x > d.haul.x1 + 2) rec.p.obj.visible = false;
            }
            if (d.haul.t > 4.5) { for (const rec of d.haul.recs) { rt.set.scene.remove(rec.p.obj); rt.people.splice(rt.people.indexOf(rec), 1); } d.haul = null; }
        }
    },
});

function haulPast(rt) {
    if (rt.data.haul) return;
    const h = rt.fx("hall");
    tone(300, 0.15, "sawtooth", 0.05, 220);
    const cop = rt.person("haulCop" + Math.floor(rt.t), "copPerson", { x: h.x - 2.6, z: h.z, ry: Math.PI / 2 }, { collide: false, faceLulu: false, pose: { walk: 1.3 } });
    const perp = rt.person("haulPerp" + Math.floor(rt.t), "interiorsPerp", { x: h.x - 3.5, z: h.z, ry: Math.PI / 2 }, { collide: false, faceLulu: false, pose: { walk: 1.3 },
        colors: { Hair: "#212121" } });
    rt.data.haul = { recs: [cop, perp], t: 0, x0: h.x - 2.6, x1: h.x + 1.0 };
}
