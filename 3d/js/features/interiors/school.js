// interiors/school.js — "CHEDER ON THE CORNER": a bright cheder hallway. The strict
// Morah, a wandering kid, the principal's office, the BAKE SALE (+6 the first time,
// then +1 ⭐ "one more nosh" every visit), the water fountain, the hallway clock,
// the lost-and-found lockers. The class bell sends a wave of kids running past;
// paper airplanes fly by; the fluorescent lights flicker; sun streams through the
// windows. Lines from src/08d-foot-school-hospital.js.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { defineInterior, pool, pick, rand, randInt, GOLD } from "./engine.js";
import { canvasPlane, drawLines, sfx, tone } from "./fx.js";

const MORAH = pool([
    "A grown woman? In MY hallway?\nWhere is your hall pass?!",
    "We do NOT run in the cheder.\nWe glide, like ladies.",
    "Is this your daughter's class?\nThen why are YOU here, mami?",
    "You forgot your lunchbox in 1994\nand you STILL owe me a note.",
    "No gum. No phones.\nNo... whatever that sheitel is doing.",
    "Recess is over. Sit down.\n...You're forty? Sit down anyway.",
    "Tuck in that shirt, young lady.\nYes, YOU. The tall one.",
    "If you're here for the bake sale,\nthe rugelach are RATIONED.",
    "I taught your husband aleph-bais.\nHe also couldn't sit still.",
    "Detention is for everyone,\nincluding wandering mothers.",
    "Spit out the gum. I can HEAR\nthe gum. There is no gum?\nThere will be.",
    "Walk on the RIGHT, please.\nThis is a one-way hallway.",
]);
const KID = pool([
    "My morah says I'm a tzaddik.\nI told her I'm just hungry.",
    "I have FORTY-SIX stickers.\nWanna see? ...Too bad, they're mine.",
    "I traded my snack for a rock.\nIt's a GOOD rock though.",
    "Is it Shabbos yet? Is it now?\nIs it NOW? How about now?",
    "I know all the brachos.\nWatch — *whispers nothing* — done!",
    "My bubbe gives me soda.\nDon't tell my ima. Or do. I'll deny it.",
    "I'm not crying, YOU'RE crying.\n...okay I dropped my cookie.",
    "I drew you on the wall!\nYou have nineteen fingers. Sorry.",
    "Wanna hear a joke? Why did the\nmatzah— I forgot the rest.",
    "I lost my tooth in the cubbies.\nThe tooth fairy works here, right?",
    "Morah said sharing is caring.\nSo CARE about my homework, please.",
    "I'm hiding from gym.\nYou never saw me. Shhh.",
]);
const PRINCIPAL = pool([
    "The principal will see you now.\n...In 1996, apparently.",
    "Office hours: whenever the rabbi\nfinds his other shoe.",
    "Sign in, sign out, sign a check\nfor the building fund. Mostly that one.",
    "You're being sent to the office.\nAt your big age. Mazel.",
    "The principal is 'in a meeting'\n(napping behind the gemara).",
    "Please hold. The secretary is\non the phone with EVERYONE'S mother.",
    "He'll call your mom.\n...Your mom is already in the parking lot.",
    "We don't have a budget, but we\nhave a LOT of laminated signs.",
    "The office candy dish is empty.\nThe rabbi has a sweet tooth too.",
    "Yes, the heating is broken.\nYes, it's a 'character-building' winter.",
]);
const BAKE = pool([
    "Bake sale! Rugelach two dollars,\nguilt absolutely free.",
    "Babka by the slice — proceeds\nfund the gym we'll never build.",
    "Buy a hamantasch, support the\neighth grade trip to... the lobby.",
    "These cookies are sugar-free.\nThat's a lie, but it's a MITZVAH lie.",
    "Tzedakah jar's right here, mami.\nThe morah is WATCHING.",
    "Last black-and-white cookie!\nFirst come, first kvell.",
    "Macaroons! From Pesach!\n...This Pesach. Probably.",
]);
const FOUNTAIN = pool([
    "The water fountain only does\nlukewarm and 'forehead splash'.",
    "Press the button, get a sip,\nget a free shirt soaking. Classic.",
    "Someone left gum on it again.\nThe eternal cheder mystery.",
    "It's been 'out of order' since\nthe Maccabees, honestly.",
    "Cold water? In THIS school?\nDream bigger, mami.",
    "*sluuurp* ...okay that's enough\nadventure for one hallway.",
    "The handle's sticky. Everything\nin a cheder is sticky. It's halacha.",
    "I filled my water bottle here\nin 2009. Still tastes like 2009.",
]);
const CLOCK = pool([
    "Three more minutes till recess.\nIt's been three minutes for an hour.",
    "This clock runs on cheder time:\nslow before lunch, fast after.",
    "*tick* *tick* *tick*\nthe sound of childhood, honestly.",
    "It's exactly 'snack o'clock'.\nIt's ALWAYS snack o'clock here.",
    "The big hand fell off in '04.\nWe just guess now. Spiritually.",
    "Davening's in five minutes.\nOr fifty. The clock is shy about it.",
]);
const LOCKER = pool([
    "Lost-and-found: forty hats,\nzero owners. A cheder mystery.",
    "Locker 12 has smelled like a\ntuna sandwich since Chanukah.",
    "Someone's gym shoe achieved\nsentience in here. Don't open 6.",
    "A single glove. A yo-yo. A note\nthat says 'sorry morah'. Iconic.",
    "Whose coat is this? It's been\nhere since the boy GRADUATED.",
]);
const KIDPAL = ["#1565C0", "#6A1B9A", "#00897B", "#C62828", "#F9A825"];

const MORAH_S = { emoji: "👩‍🏫", color: "#6D4C41" }, KID_S = { emoji: "🧒", color: "#1565C0" }, OFFICE = { emoji: "🚪", color: "#37474F" },
    BAKE_S = { emoji: "🧁", color: "#E65100" }, WATER = { emoji: "💧", color: "#0277BD" }, CLOCK_S = { emoji: "🕰️", color: "#5D4037" },
    LOCK_S = { emoji: "🧢", color: "#00838F" };

function drawChalk(g, W, H) {
    g.fillStyle = "rgba(255,255,255,0.03)"; g.fillRect(0, 0, W, H);
    drawLines(g, "א ב ג ד", W / 2, H * 0.24, H * 0.2, "#F1F8E9", { font: "Arial, sans-serif" });
    drawLines(g, "שבת = soup", W / 2, H * 0.52, H * 0.15, "#FFF9C4", { font: "Arial, sans-serif" });
    drawLines(g, "Be a mensch!", W / 2, H * 0.78, H * 0.13, "#FFCDD2", { weight: 600 });
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W * 0.08, H * 0.92); g.lineTo(W * 0.3, H * 0.9); g.stroke();
}

const DRAWINGS = [
    (g, W, H) => { g.fillStyle = "#FFD54F"; g.beginPath(); g.arc(W * 0.78, H * 0.22, H * 0.13, 0, 7); g.fill();
        g.fillStyle = "#E57373"; g.fillRect(W * 0.2, H * 0.5, W * 0.4, H * 0.35);
        g.fillStyle = "#8D6E63"; g.beginPath(); g.moveTo(W * 0.15, H * 0.52); g.lineTo(W * 0.4, H * 0.25); g.lineTo(W * 0.65, H * 0.52); g.fill();
        g.fillStyle = "#4FC3F7"; g.fillRect(W * 0.34, H * 0.62, W * 0.12, H * 0.23); },
    (g, W, H) => { stick(g, W * 0.3, H * 0.62, H, "#E91E63"); stick(g, W * 0.62, H * 0.62, H, "#7E57C2");
        drawLines(g, "BUBBE", W / 2, H * 0.14, H * 0.14, "#1565C0", { font: "Comic Sans MS, cursive" }); },
    (g, W, H) => { g.fillStyle = "#F06292"; g.fillRect(W * 0.18, H * 0.45, W * 0.64, H * 0.2);
        g.fillStyle = "#212121"; g.beginPath(); g.arc(W * 0.32, H * 0.68, H * 0.08, 0, 7); g.arc(W * 0.68, H * 0.68, H * 0.08, 0, 7); g.fill();
        drawLines(g, "LULU", W / 2, H * 0.22, H * 0.15, "#C2185B", { font: "Comic Sans MS, cursive" }); },
    (g, W, H) => { g.strokeStyle = "#1E88E5"; g.lineWidth = 6; g.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2, b = a + Math.PI * 2 / 3; g.moveTo(W / 2 + Math.cos(a) * H * 0.32, H * 0.5 + Math.sin(a) * H * 0.32); g.lineTo(W / 2 + Math.cos(b) * H * 0.32, H * 0.5 + Math.sin(b) * H * 0.32); }
        g.stroke(); },
    (g, W, H) => { g.fillStyle = "#FFB300"; g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.28, H * 0.22, 0, 0, 7); g.fill();
        g.fillStyle = "#6D4C41"; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(W * (0.32 + i * 0.09), H * (0.5 + (i % 2) * 0.1), H * 0.03, 0, 7); g.fill(); }
        drawLines(g, "KUGEL ♥", W / 2, H * 0.17, H * 0.13, "#2E7D32", { font: "Comic Sans MS, cursive" }); },
];
function stick(g, x, y, H, c) {
    g.strokeStyle = c; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.arc(x, y - H * 0.28, H * 0.09, 0, 7); g.moveTo(x, y - H * 0.19); g.lineTo(x, y + H * 0.05);
    g.moveTo(x - H * 0.13, y - H * 0.1); g.lineTo(x + H * 0.13, y - H * 0.1);
    g.moveTo(x, y + H * 0.05); g.lineTo(x - H * 0.1, y + H * 0.25); g.moveTo(x, y + H * 0.05); g.lineTo(x + H * 0.1, y + H * 0.25); g.stroke();
}

export default defineInterior({
    id: "school", name: "Cheder on the Corner", short: "the cheder", emoji: "🍎",
    title: "🍎 CHEDER ON THE CORNER", tagline: "No running in the hallway!",
    model: "interiorsSchool", models: ["interiorsMorah", "interiorsChederKid", "npcKid", "npcWoman"],
    music: "../dina.mp3",
    light: "indoor", sky: "#cfe9ff",
    bounds: { x0: -8.6, x1: 8.6, z0: -3.55, z1: 3.6 },
    cam: { dist: 7.0, height: 4.5 },

    build(rt) {
        const set = rt.set, d = rt.data;
        set.hemi.intensity = 1.5;
        set.sun.position.set(4, 14, -10);
        d.panels = [0, 1, 2].map(k => rt.pointLight("panel" + k, "#fffbe8", 7, 9));
        d.panelMats = [];
        rt.root.traverse(o => { if (o.isMesh && /^NeonPanel/.test(o.material.name) && !d.panelMats.includes(o.material)) d.panelMats.push(o.material); });
        for (const m of d.panelMats) { m.userData.base = m.userData.base || m.emissiveIntensity; m.emissiveIntensity = m.userData.base; }
        d.flicker = 1; d.flickT = rand(0.5, 2.5);

        // chalkboard + taped-up drawings
        const cb = rt.fx("chalkboard");
        const chalk = canvasPlane(set, 2.9, 1.12, drawChalk, { px: 512, lit: true });
        chalk.mesh.position.set(cb.x, cb.y, cb.z + 0.02);
        rt.add(chalk.mesh);
        for (let k = 0; k < 5; k++) {
            const f = rt.fx("drawing" + k);
            if (!f) continue;
            const pc = ["#FFCDD2", "#BBDEFB", "#FFF9C4", "#C8E6C9", "#F8BBD0"][k];
            const pl = canvasPlane(set, 0.56, 0.44, (g, W, H) => { g.fillStyle = pc; g.fillRect(0, 0, W, H); DRAWINGS[k](g, W, H);
                g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(W * 0.4, 0, W * 0.2, H * 0.08); }, { px: 256, lit: true });
            pl.mesh.position.set(f.x, f.y, f.z + 0.01);
            pl.mesh.rotation.z = (k % 2 ? 1 : -1) * 0.08;
            rt.add(pl.mesh);
        }
        // sun shafts through the windows, with dust drifting in them
        d.shafts = [];
        for (let k = 0; k < 2; k++) {
            const f = rt.fx("sun" + k);
            const m = rt.own(new THREE.MeshBasicMaterial({ color: "#FFF6C8", transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
            const geo = rt.own(new THREE.PlaneGeometry(1.6, 4.2));
            const sh = new THREE.Mesh(geo, m);
            sh.position.set(f.x + 0.5, 1.25, f.z + 1.55);
            sh.rotation.set(-0.95, 0.15, 0);
            rt.add(sh);
            d.shafts.push(sh);
        }
        rt.every(0.25, 0.5, rt => {
            const f = rt.fx("sun" + randInt(0, 1));
            rt.particles.emit(f.x + rand(-0.6, 0.9), rand(0.6, 2.2), f.z + rand(0.6, 2.4), rand(-0.05, 0.05), rand(-0.05, 0.06), rand(-0.05, 0.05), 0.012, 3, "#FFF8D0", 0);
        }, { gate: false });

        // the hallway clock: always almost recess
        d.hands = rt.node("ClockHands");

        // ── people ──
        rt.person("morah", "interiorsMorah", "morah", { name: "Morah",
            post(p, dt, t) {   // the wagging finger
                const a = p.limbs.Arm_R;
                if (a && Math.sin(t * 0.8) > 0.2) { a.rotateX(-2.3); a.rotateZ(Math.sin(t * 7) * 0.35); }
            } });
        const kid = rt.person("kid", "interiorsChederKid", "kid", { name: "Kid", r: 0.3 });
        d.kidDir = -1;
        rt.person("bakeMom", "npcWoman", { x: rt.spot("bake").x + 0.6, z: rt.spot("bake").z - 1.95, ry: 0 },
            { name: "Bake-sale mom", colors: { Top: "#FFB74D", Bottom: "#5D4037", Hair: "#3E2723" } });

        // ── hotspots ──
        rt.hot({ id: "morah", spot: "morah", who: "morah", r: 1.6, label: "👩‍🏫 Talk to the Morah", action: rt => { tone(196, 0.14, "square", 0.13); return rt.say("Morah", MORAH(), Object.assign({ person: rt.byId.morah }, MORAH_S)); } });
        rt.hot({ id: "kid", spot: "kid", who: "kid", track: true, r: 1.4, label: "🧒 Talk to the kid", action: async rt => {
            tone(740, 0.08, "triangle", 0.14);
            rt.data.kidStop = true;
            await rt.say("Kid", KID(), Object.assign({ person: rt.byId.kid }, KID_S));
            rt.data.kidStop = false;
        } });
        rt.hot({ id: "principal", spot: "principal", r: 1.3, label: "🚪 Knock on the principal's office", action: rt => {
            tone(330, 0.12, "sine", 0.12); tone(330, 0.1, "sine", 0.1, 0, 0.18);
            return rt.say("Principal's office", PRINCIPAL(), OFFICE);
        } });
        rt.hot({ id: "bake", spot: "bake", who: "bakeMom", r: 1.5, label: "🧁 Bake sale", action: async rt => {
            const s = rt.spot("bake"), at = new THREE.Vector3(s.x, 1.1, s.z - 1.2);
            await rt.say("Bake-sale mom", BAKE(), Object.assign({ person: rt.byId.bakeMom }, BAKE_S));
            if (rt.disposed) return;
            if (!rt.used.bake) {               // one-time coin reward for the visit…
                rt.used.bake = true;
                rt.coins(6, "+6 💰 rugelach run!", at);
                rt.burst(at, ["#FFD700", "#FFCC80", "#A1674A"], 10, 2.0, 0.05);
            } else {                           // …then a tiny star for repeat visits
                rt.star(1, "+1 ⭐ one more nosh", at);
                sfx.hop();
            }
        } });
        rt.hot({ id: "fountain", spot: "fountain", r: 1.3, label: "💧 Try the water fountain", action: async rt => {
            tone(520, 0.09, "sine", 0.12, 760);
            const j = rt.fx("fountainJet");
            for (let i = 0; i < 26; i++) rt.particles.emit(j.x, j.y, j.z, rand(-0.15, 0.15), rand(1.6, 2.4), rand(0.4, 0.9), 0.035, 0.7, "#81D4FA", 6);
            return rt.say("Water fountain", FOUNTAIN(), WATER);
        } });
        rt.hot({ id: "clock", spot: "clock", r: 1.3, label: "🕰️ Check the clock", action: rt => { tone(880, 0.06, "triangle", 0.1); return rt.say("The hallway clock", CLOCK(), CLOCK_S); } });
        rt.hot({ id: "locker", spot: "locker", r: 1.4, label: "🧢 Lost-and-found lockers", action: rt => { tone(220, 0.1, "square", 0.12); return rt.say("Lost & found", LOCKER(), LOCK_S); } });

        // ── the class bell → a wave of kids; paper airplanes; runners ──
        d.runners = [];
        d.planes = [];
        rt.every(11, 18, rt => {
            sfx.bell();
            rt.data.bellFlash = 1.2;
            rt.data.wave = 0.9;
            rt.bubble("🔔 BRRRING!", rt.lulu.obj, 1.2, { yOff: 2.4, size: 0.7 });
        }, { first: rand(8, 14) });
        rt.every(6, 12, rt => { if (rt.data.planes.length < 2) spawnPlane(rt); }, { first: rand(4, 8) });
        rt.every(4, 9, rt => { if (rt.data.runners.length < 2) { spawnRunner(rt); if (Math.random() < 0.4) spawnRunner(rt, true); } }, { first: rand(3, 6) });
    },

    tick(rt, dt) {
        const d = rt.data, t = rt.t;
        // the wandering kid paces his stretch of hallway
        const kid = rt.byId.kid, ko = kid.p.obj;
        if (!d.kidStop) {
            ko.position.x += d.kidDir * 0.75 * dt;
            if (ko.position.x < 0.4) { ko.position.x = 0.4; d.kidDir = 1; }
            if (ko.position.x > 4.3) { ko.position.x = 4.3; d.kidDir = -1; }
            ko.rotation.y = d.kidDir > 0 ? Math.PI / 2 : -Math.PI / 2;
            kid.pose.walk = 0.75;
        } else kid.pose.walk = 0;
        // fluorescent flicker (a cheap re-roll, like the 2D)
        d.flickT -= dt;
        if (d.flickT <= 0) {
            d.flicker = Math.random() < 0.25 ? rand(0.55, 0.85) : 1;
            d.flickT = d.flicker < 1 ? rand(0.04, 0.12) : rand(0.8, 3.0);
        }
        const k = d.flicker + (d.bellFlash > 0 ? 0.25 * Math.abs(Math.sin(t * 20)) : 0);
        for (const m of d.panelMats) m.emissiveIntensity = m.userData.base * k;
        for (const l of d.panels) l.intensity = 7 * k;
        if (d.bellFlash > 0) d.bellFlash -= dt;
        if (d.wave > 0) { d.wave -= dt; if (Math.random() < dt * 6 && d.runners.length < 6) spawnRunner(rt); }
        // runners
        for (let i = d.runners.length - 1; i >= 0; i--) {
            const r = d.runners[i], o = r.rec.p.obj;
            o.position.x += r.dir * r.speed * dt;
            if (Math.abs(o.position.x) > 10.5) { rt.set.scene.remove(o); rt.people.splice(rt.people.indexOf(r.rec), 1); d.runners.splice(i, 1); }
        }
        // paper planes
        for (let i = d.planes.length - 1; i >= 0; i--) {
            const p = d.planes[i];
            p.t += dt;
            p.obj.position.x += p.vx * dt;
            p.obj.position.y = p.y + Math.sin(p.t * 6) * 0.12;
            p.obj.rotation.z = Math.sin(p.t * 6) * 0.25;
            if (Math.abs(p.obj.position.x) > 11) { p.obj.removeFromParent(); d.planes.splice(i, 1); }
        }
        // the clock: hands twitch around three-to-recess
        if (d.hands) d.hands.rotation.z = -0.35 + Math.sin(t * 0.2) * 0.02 + (Math.floor(t) % 2 ? 0.01 : 0);
        for (const sh of d.shafts) sh.material.opacity = 0.13 + 0.03 * Math.sin(t * 0.7);
    },
});

function spawnRunner(rt, chase = false) {
    const d = rt.data;
    const fromLeft = Math.random() < 0.5, dir = fromLeft ? 1 : -1;
    const last = chase && d.runners[d.runners.length - 1];
    const x = last ? last.rec.p.obj.position.x - last.dir * 1.6 : (fromLeft ? -10 : 10);
    const z = last ? last.rec.p.obj.position.z : rand(1.4, 3.0);
    const key = Math.random() < 0.5 ? "interiorsChederKid" : "npcKid";
    const rec = rt.person("runner" + Math.random().toString(36).slice(2, 6), key, { x, z, ry: dir > 0 ? Math.PI / 2 : -Math.PI / 2 },
        { colors: { Top: key === "npcKid" ? pick(KIDPAL) : "#FFFFFF", Bottom: pick(["#455A64", "#1565C0", "#37474F"]) }, collide: false, faceLulu: false, pose: { walk: 3.4 } });
    d.runners.push({ rec, dir: last ? last.dir : dir, speed: (last ? last.speed * 1.05 : rand(2.4, 3.6)) });
}

function spawnPlane(rt) {
    const fl = Math.random() < 0.5;
    const obj = rt.prop("Plane");
    obj.scale.setScalar(1.6);
    const y = rand(1.8, 2.9);
    obj.position.set(fl ? -10 : 10, y, rand(-2.5, 1.5));
    obj.rotation.y = fl ? Math.PI / 2 : -Math.PI / 2;
    rt.add(obj);
    rt.data.planes.push({ obj, vx: (fl ? 1 : -1) * rand(3.0, 4.4), y, t: 0 });
}
