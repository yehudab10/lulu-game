// interiors/beach.js — "SHTRAND-BY-THE-SEA": the lifeguard on her tower, the ice
// cream stand (+25 and a ⭐, once — and a cone in Lulu's hand… until the sneaky
// seagull gets it), the seagull, the sandcastle kids (help build the sand-shul, a
// tower at a time), Heshy cannonballing in the surf, a beach ball to bop, kites,
// waves — and the CABANA: rest & heal (💰40 → full hearts for the next drive).
// Lines from src/08e-foot-police-beach.js.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { heal } from "../../core/driving.js";
import * as H from "../../hud.js";
import { defineInterior, pool, pick, rand, S, GOLD, CONFETTI, force } from "./engine.js";
import { canvasPlane, sfx, tone } from "./fx.js";

const LIFEGUARD = pool([
    "No running on the boardwalk! ...Okay a little jog. Fine.",
    "Sunscreen check! SPF 50 or you answer to your bubbe.",
    "Rip current's mild today. The DRAMA current, though — wild.",
    "I rescued a beach ball earlier. True hero work.",
    "If you see a 7-foot swimmer, that's not a wave. That's Heshy.",
    "Whistle's just for show. I mostly point dramatically.",
    "Stay hydrated! Lemonade counts. Ice cream... debatable.",
    "I've got my eye on those seagulls. They KNOW what they did.",
    "Shark? Nah. That's just Heshy doing the breaststroke. Badly.",
    "Beach closes at sundown for Shabbos. Tide's been told.",
    "Buddy system, hon. Where's your buddy? ...the seagull? No.",
    "I'm 90% lifeguard, 10% sandcastle inspector.",
    "*scans with binoculars* ...yep, that's still Heshy. Floating.",
    "Kite's flying low. Somebody tell the seagull it's not lunch.",
    "Beach ball's loose again. Third escape this hour. Tenacious.",
    "I count heads every ten minutes. Heshy counts as three.",
]);
const ICECREAM = pool([
    "One cone, on the house! Found 25 coins under the cart!",
    "Free scoop + the tip jar tipped YOU 25 coins. Cool day!",
    "Vanilla? Got it. And 25 coins fell out the change drawer!",
    "Rainbow sprinkles AND 25 coins? Best beach day ever!",
    "Cone's free 'cause it's melting fast — and here's 25 coins!",
]);
const ICECREAM_AGAIN = ["Back for seconds? The cone's on me — the coins, not so much.", "Another scoop! (The change drawer's empty now, mamaleh.)"];
const GULL = pool([
    "MINE. MINE. MINE. (It took your imaginary fries.)",
    "The seagull eyes your snack. You have no snack. It's furious.",
    "It stole a chip from someone three towels over. Legend.",
    "SQUAWK. Translation: 'gimme the bagel, lady.'",
    "This gull has committed more crimes than the perp downtown.",
    "It's not a seagull. It's a feathered tax collector.",
    "You blink. Your hot dog is gone. It was always gone.",
    "The gull tilts its head. It's planning something. Run.",
    "Beach rule #1: never make eye contact with the seagull.",
    "It dropped a fry on you as tribute. ...or an insult.",
    "SQUAWK SQUAWK (it's just saying 'good shabbos,' probably).",
    "It's eyeing the kite. It thinks the kite is a giant rival gull.",
    "It chased the beach ball into the surf. Bold. Wet. Foolish.",
    "Four gulls just flew off in formation. This one's the general.",
]);
const CASTLE = pool([
    "Kids: \"It's a SHUL made of sand! No shoes inside!\"",
    "\"We built a moat! It's for the crabs to do laps!\"",
    "\"Don't step on the east wing, that's the kiddush room!\"",
    "\"The tower fell. We're calling it 'modern art' now.\"",
    "\"A wave ate the drawbridge. We blame Heshy.\"",
    "\"This bucket is our hard hat AND our crown.\"",
    "\"We need 9 more castles for a minyan of castles!\"",
    "\"Wanna help? You can be in charge of the seashell windows.\"",
    "\"Mom said one more hour. We're building a SECOND castle.\"",
    "\"It's not sand in your sandwich. It's seasoning.\"",
]);
const HESHY = pool([
    "Heshy: \"CANNONBALL!\" (There is no diving board. He found a way.)",
    "\"Look, Lulu, no hands!\" (He is doing a doggy paddle. Slowly.)",
    "\"The ocean's basically a giant kiddie pool, change my mind!\"",
    "\"I'm not lost, I'm exploring! ...which way's the shore?\"",
    "\"Watch this!\" *belly flop* *seagulls applaud sarcastically*",
    "\"I brought floaties for my floaties. Safety first!\"",
    "\"The lifeguard keeps whistling at me. I think she's a fan.\"",
    "\"Tell Bubbe I'll be there for dinner — soon as I find my towel.\"",
    "\"I caught a fish! ...with my swim trunks. It's still in there.\"",
    "\"Marco! ...Polo? ...anyone? ...I'm just gonna float here.\"",
    "\"CANNONBALL incoming — cover your snacks!\" *KERSPLASH*",
    "\"The waves keep pushing me back. I think they're shy.\"",
    "\"I'm doing the backstroke! ...into the buoy. Repeatedly.\"",
    "\"Is that a beach ball or my lunch? Only one way to find out.\"",
]);
const HEAL_FEE = 40;
const GUARD_S = { emoji: "🛟", color: "#E53935" }, ICE_S = { emoji: "🍦", color: "#EC407A" }, GULL_S = { emoji: "🐦", color: "#546E7A" },
    KIDS_S = { emoji: "🏰", color: "#F9A825" }, HESHY_S = { emoji: "🏊", color: "#0288D1" }, CABANA_S = { emoji: "⛱️", color: "#00796B" };

// ground: the boardwalk planks sit a touch above the sand; the wet sand slopes into the sea
function ground(x, z) {
    if (z > 6.05) return 0.1;
    if (z < -6.0) return -0.1 * Math.min(4, -6.0 - z);
    return 0;
}

export default defineInterior({
    id: "beach", name: "Shtrand-by-the-Sea", short: "the beach", emoji: "🏖️",
    title: "🏖️ SHTRAND-BY-THE-SEA — BEACH", tagline: "Sun, sea, and Heshy",
    model: "interiorsBeach", models: ["interiorsLifeguard", "interiorsIceCream", "heshyPerson", "npcKid", "npcWoman"],
    music: "../story-beach.mp3",
    light: "day", sky: "#8ED3FF", fog: [45, 140],
    bounds: { x0: -16.5, x1: 16.5, z0: -6.6, z1: 8.6 },
    cam: { dist: 8.6, height: 5.6, clampX: 5 },
    ground,
    walkSpeed: 3.8,
    // standing still in the sun, Lulu shields her eyes now and then (the 2D bchLuluShade)
    luluPost(rt, dt) {
        const d = rt.data;
        d.shadeT = (d.shadeT == null ? 4 : d.shadeT) - dt;
        const idle = !rt.busy && !rt.luluPose && Math.hypot(rt.vel.x, rt.vel.z) < 0.2 && !rt.inHand;
        if (d.shadeT < 0 && idle) { const a = rt.lulu.limbs.Arm_R; if (a) { a.rotateX(-2.5); a.rotateZ(0.55); } }
        if (d.shadeT <= -1.2) d.shadeT = rand(4, 8);
    },

    build(rt) {
        const set = rt.set, d = rt.data;
        set.sun.position.set(10, 22, -16);
        set.sun.intensity = 2.8;
        Object.assign(set.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, far: 80 });
        set.sun.shadow.camera.updateProjectionMatrix();
        // the sea: a big plane whose vertices roll as waves
        const sea = rt.fx("sea");
        const geo = rt.own(new THREE.PlaneGeometry(90, 70, 60, 30));
        geo.rotateX(-Math.PI / 2);
        d.seaBase = Float32Array.from(geo.attributes.position.array);
        d.sea = new THREE.Mesh(geo, rt.own(new THREE.MeshStandardMaterial({ color: "#1EA7E8", roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.9 })));
        d.sea.position.set(0, -0.14, sea.z - 35 + 1.5);
        d.sea.receiveShadow = true;
        rt.add(d.sea);
        // the foam line that washes up and back (and the big wave every so often)
        const foamGeo = rt.own(new THREE.PlaneGeometry(90, 1.6, 40, 1));
        foamGeo.rotateX(-Math.PI / 2);
        d.foam = new THREE.Mesh(foamGeo, rt.own(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.6, depthWrite: false })));
        d.foam.position.set(0, -0.02, -6.4);
        rt.add(d.foam);
        d.bigWave = 0;

        // kite (diamond + bows) on a long string held by a kid on the sand
        const k = rt.spot("kite");
        d.kite = new THREE.Group();
        const diamond = new THREE.Shape([new THREE.Vector2(0, 0.8), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, -0.9), new THREE.Vector2(-0.55, 0)]);
        const kmesh = new THREE.Mesh(rt.own(new THREE.ShapeGeometry(diamond)), rt.own(new THREE.MeshStandardMaterial({ color: "#FF4081", side: THREE.DoubleSide, roughness: 0.6 })));
        d.kite.add(kmesh);
        const k2 = new THREE.Mesh(rt.own(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.8), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, 0)]))),
            rt.own(new THREE.MeshStandardMaterial({ color: "#FFEB3B", side: THREE.DoubleSide, roughness: 0.6 })));
        k2.position.z = 0.01;
        d.kite.add(k2);
        for (let i = 0; i < 4; i++) {
            const bow = new THREE.Mesh(rt.own(new THREE.SphereGeometry(0.09, 6, 4)), rt.own(new THREE.MeshStandardMaterial({ color: CONFETTI[i] })));
            bow.position.set(0, -1.1 - i * 0.35, 0);
            d.kite.add(bow);
        }
        d.kite.position.set(k.x, k.y, k.z);
        rt.add(d.kite);
        d.kiteBase = d.kite.position.clone();
        const flier = rt.person("flier", "npcKid", { x: -3.4, z: 2.2, ry: Math.PI }, { colors: { Top: "#26C6DA", Bottom: "#FF7043" }, faceLulu: false });
        flier.post = p => { if (p.limbs.Arm_R) p.limbs.Arm_R.rotateX(-2.2); };
        const lineGeo = rt.own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
        d.string = new THREE.Line(lineGeo, rt.own(new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8 })));
        rt.add(d.string);

        // gulls circling overhead + the sneaky one on the sand
        d.gulls = [];
        for (let i = 0; i < 4; i++) {
            const g = rt.prop("Gull");
            g.scale.setScalar(1.3);
            rt.add(g);
            d.gulls.push({ g, r: rand(6, 14), h: rand(6, 10), sp: rand(0.25, 0.45) * (i % 2 ? 1 : -1), ph: rand(0, 6), cx: rand(-6, 6), cz: rand(-12, -4) });
        }
        const gs = rt.spot("gull");
        d.gull = rt.prop("Gull");
        d.gull.scale.setScalar(1.6);
        d.gull.position.set(gs.x, 0, gs.z);
        d.gull.rotation.y = gs.ry;
        rt.add(d.gull);
        d.gullHome = d.gull.position.clone();
        d.gullT = 0;

        // the beach ball
        const bs = rt.spot("ball");
        d.ball = rt.prop("Ball");
        d.ball.position.set(bs.x, 0.3, bs.z);
        rt.add(d.ball);
        d.bv = new THREE.Vector3(0.6, 0, 0.2);

        // the sandcastle: towers appear as Lulu helps
        d.castle = [1, 2, 3, 4, 5].map(i => rt.node("Castle_" + i)).filter(Boolean);
        d.castleN = 0;
        for (const c of d.castle) { c.visible = false; c.scale.setScalar(0.01); }

        // ── people ──
        const lg = rt.person("lifeguard", "interiorsLifeguard", "lifeguard", { name: "Lifeguard", collide: false, faceLulu: false,
            post(p, dt, t, rt) {   // scan the horizon with binoculars now and then
                const scan = (t * 0.25) % 2 < 1;
                if (scan && p.limbs.Arm_R) p.limbs.Arm_R.rotateX(-2.3);
                if (scan && p.limbs.Arm_L) p.limbs.Arm_L.rotateX(-2.3);
                p.obj.rotation.y = rt.spot("lifeguard").ry + (scan ? Math.sin(t * 0.8) * 0.6 : 0);
            } });
        rt.hold(lg.p, "Binoculars", { y: -0.47, z: 0.08 });
        const body = lg.p.limbs.Body;
        if (body) { const w = rt.prop("Whistle"); w.position.set(0, 1.12, 0.17); body.add(w); }
        rt.person("vendor", "interiorsIceCream", "vendor", { name: "Ice-cream man", collide: false });
        rt.person("kid1", "npcKid", "kid1", { colors: { Top: "#FFEB3B", Bottom: "#E91E63" }, pose: { sit: true }, y: -0.3, faceLulu: false, collide: false });
        rt.person("kid2", "npcKid", "kid2", { colors: { Top: "#81D4FA", Bottom: "#3949AB", Hair: "#212121" }, pose: { sit: true }, y: -0.3, faceLulu: false, collide: false });
        const sb = rt.spot("sunbather");
        const sun = rt.person("sunbather", "npcWoman", { x: sb.x, z: sb.z, ry: 0 }, { colors: { Top: "#FF7043", Bottom: "#FF7043", Hair: "#FFD54F" }, faceLulu: false, collide: false });
        sun.p.obj.rotation.set(-Math.PI / 2, sb.ry, 0, "YXZ");
        sun.p.obj.position.set(sb.x, 0.16, sb.z + 0.8);
        const hs = rt.spot("heshy");
        const heshy = rt.person("heshy", "heshyPerson", "heshy", { name: "Heshy", collide: false, faceLulu: false });
        heshy.p.obj.position.y = -0.95;
        d.heshyY = -0.95; d.cannon = 0;
        d.heshyHome = new THREE.Vector3(hs.x, -0.95, hs.z);
        heshy.post = (p, dt, t) => { if (p.limbs.Arm_R && d.cannon <= 0) { p.limbs.Arm_R.rotateX(-2.6); p.limbs.Arm_R.rotateZ(Math.sin(t * 5) * 0.4); } };

        // ── hotspots ──
        rt.hot({ id: "lifeguard", spot: "lifeguardTalk", r: 1.6, label: "🛟 Talk to the lifeguard", action: rt => { sfx.whistle(); return rt.say("Lifeguard", LIFEGUARD(), GUARD_S); } });
        rt.hot({ id: "icecream", spot: "icecream", who: "vendor", r: 1.5, label: () => rt.used.icecream ? "🍦 Another scoop" : "🍦 Ice cream stand", action: async rt => {
            const s = rt.spot("icecream"), at = new THREE.Vector3(s.x, 1.3, s.z - 1.2);
            if (!rt.used.icecream) {
                rt.used.icecream = true;
                rt.coins(25, "+25 ⭐", at);
                wallet.add(1);   // a little beach-day star too (the 2D footAwardStar)
                tone(880, 0.12, "sine", 0.12, 1320);
                rt.burst(at, ["#FFD700", "#FF80AB", "#4FC3F7", "#FFF8B0"], 16, 2.4, 0.06);
                rt.luluHold("Cone");
                await rt.say("Ice-cream man", ICECREAM(), Object.assign({ person: rt.byId.vendor }, ICE_S));
            } else {
                rt.luluHold("Cone");
                await rt.say("Ice-cream man", pick(ICECREAM_AGAIN), Object.assign({ person: rt.byId.vendor }, ICE_S));
            }
        } });
        rt.hot({ id: "gull", x: gs.x, z: gs.z, r: 1.5, label: "🐦 Face down the seagull", action: async rt => {
            tone(1400, 0.08, "square", 0.06, 900); tone(1300, 0.1, "square", 0.05, 800, 0.12);
            rt.data.gullFlap = 1.2;
            const hadCone = rt.inHandName === "Cone";
            await rt.say("Sneaky seagull", hadCone ? "MINE. MINE. MINE. (It took your ice cream. For REAL this time.)" : GULL(), GULL_S);
            if (hadCone && !rt.disposed) {        // the gull snatches the cone and makes off with it
                rt.luluHold(null);
                const cone = rt.prop("Cone");
                cone.position.set(0, 0.42, -0.35);
                rt.data.gull.add(cone);
                rt.data.gullSteal = { t: 0, cone };
                H.toast("🐦 SQUAWK! (bye, cone)", "pink");
                sfx.womp();
            }
        } });
        rt.hot({ id: "castle", spot: "castle", r: 1.6, label: () => rt.data.castleN < 5 ? "🏰 Help build the sand-shul" : "🏰 Admire the sand-shul", action: async rt => {
            await rt.say("Sandcastle kids", CASTLE(), KIDS_S);
            if (rt.disposed) return;
            if (rt.data.castleN < rt.data.castle.length) {
                const c = rt.data.castle[rt.data.castleN++];
                c.visible = true;
                rt.data.grow = { c, t: 0 };
                const s = rt.spot("castle");
                rt.burst(new THREE.Vector3(s.x - 0.4, 0.6, s.z - 1.6), ["#EBCB86", "#F7DFA6", "#D9B979"], 14, 1.6, 0.06);
                for (const id of ["kid1", "kid2"]) rt.byId[id].cheerT = 1.2;
                tone(523 + rt.data.castleN * 60, 0.1, "triangle", 0.12);
                if (rt.data.castleN === rt.data.castle.length) {
                    S.castles = (S.castles || 0) + 1;
                    saveSoon();
                    H.toast("🏰 Sand-shul complete! The kids kvell.", "big");
                    sfx.fanfare();
                }
            }
        } });
        rt.hot({ id: "heshy", spot: "heshyTalk", r: 1.8, label: "🏊 Call out to Heshy", action: rt => {
            rt.data.heshyWave = 2;
            return rt.say("Heshy", HESHY().replace(/^Heshy: /, ""), Object.assign({ person: rt.byId.heshy }, HESHY_S));
        } });
        rt.hot({ id: "ball", x: bs.x, z: bs.z, track: true, r: 1.3, label: "🏐 Bop the beach ball", action: rt => {
            const d = rt.data, b = d.ball.position;
            d.bv.set((b.x < rt.lulu.obj.position.x ? -1 : 1) * rand(1.2, 2.4), rand(5, 6.5), rand(-1.5, 0.5));
            tone(660, 0.07, "sine", 0.1, 880);
            rt.bubble(pick(["boing!", "bonk!", "whee!"]), d.ball, 1.0, { yOff: 0.7, size: 0.5, color: "#FF4081" });
        } });
        rt.hot({ id: "cabana", spot: "cabana", r: 1.5,
            label: () => (ctx.G.hearts >= ctx.G.maxHearts ? "⛱️ Cabana (hearts full ✓)" : `⛱️ Rest & heal · 💰${HEAL_FEE}`), action: restHeal });

        // ── ambient: Heshy's cannonballs, the big wave ──
        rt.every(6, 11, rt => { rt.data.cannon = 1.1; tone(160, 0.18, "sine", 0.06, 90); }, { first: rand(5, 9) });
        rt.every(8, 14, rt => { rt.data.bigWave = 2.4; }, { first: rand(7, 12) });
        rt.every(2.5, 5, () => tone(rand(1300, 1600), 0.06, "square", 0.025, 900), { gate: false });   // distant gulls
    },

    tick(rt, dt) {
        const d = rt.data, t = rt.t;
        // waves
        const pos = d.sea.geometry.attributes.position, a = pos.array, b = d.seaBase;
        for (let i = 0; i < a.length; i += 3) a[i + 1] = b[i + 1] + Math.sin(b[i] * 0.35 + t * 1.3) * 0.08 + Math.sin(b[i + 2] * 0.5 - t * 1.7) * 0.1;
        pos.needsUpdate = true;
        if (d.bigWave > 0) d.bigWave -= dt;
        const surge = d.bigWave > 0 ? Math.sin((1 - d.bigWave / 2.4) * Math.PI) * 2.4 : 0;
        d.foam.position.z = -6.4 + Math.sin(t * 0.9) * 0.6 + surge;
        d.foam.material.opacity = 0.45 + 0.2 * Math.sin(t * 0.9 + 1);
        // kite + its string
        d.kite.position.set(d.kiteBase.x + Math.sin(t * 0.7) * 1.2, d.kiteBase.y + Math.sin(t * 1.1) * 0.5, d.kiteBase.z);
        d.kite.rotation.z = Math.sin(t * 0.9) * 0.35;
        const fl = rt.byId.flier.p.obj.position, sa = d.string.geometry.attributes.position;
        sa.setXYZ(0, fl.x, 1.35, fl.z); sa.setXYZ(1, d.kite.position.x, d.kite.position.y - 0.9, d.kite.position.z); sa.needsUpdate = true;
        // gulls overhead
        for (const g of d.gulls) {
            const an = g.ph + t * g.sp;
            g.g.position.set(g.cx + Math.cos(an) * g.r, g.h + Math.sin(t + g.ph) * 0.4, g.cz + Math.sin(an) * g.r * 0.5);
            g.g.rotation.y = an + (g.sp > 0 ? 0 : Math.PI);
            flap(g.g, t * 9 + g.ph, 0.6);
        }
        // the sneaky gull hops about (or makes off with the cone)
        const gull = d.gull;
        if (d.gullSteal) {
            const s = d.gullSteal;
            s.t += dt;
            if (s.t < 3) { gull.position.y += dt * 2.6; gull.position.x += dt * 3; flap(gull, t * 14, 0.9); }
            else if (s.t < 6) { if (s.cone.parent) s.cone.removeFromParent(); gull.position.lerp(d.gullHome, dt * 1.2); flap(gull, t * 12, 0.7); }
            else { gull.position.copy(d.gullHome); d.gullSteal = null; }
        } else {
            d.gullT -= dt;
            if (d.gullT <= 0) { d.gullT = rand(1.2, 3); d.hop = 0.35; gull.rotation.y += rand(-0.8, 0.8); }
            if (d.hop > 0) { d.hop -= dt; gull.position.y = Math.sin((0.35 - d.hop) / 0.35 * Math.PI) * 0.18; }
            const fl2 = d.gullFlap > 0;
            if (fl2) d.gullFlap -= dt;
            flap(gull, t * 16, fl2 ? 0.9 : 0.05);
        }
        // the beach ball: gravity, bounce on the sand, kicked along when Lulu walks into it
        const ball = d.ball, bp = ball.position, L = rt.lulu.obj.position;
        d.bv.y -= 14 * dt;
        bp.addScaledVector(d.bv, dt);
        if (bp.y < 0.3) { bp.y = 0.3; d.bv.y = Math.abs(d.bv.y) > 1.2 ? -d.bv.y * 0.55 : 0; d.bv.x *= 0.92; d.bv.z *= 0.92; }
        const dx = bp.x - L.x, dz = bp.z - L.z, dd = Math.hypot(dx, dz);
        if (dd < 0.65 && dd > 0.01 && bp.y < 0.9) { d.bv.x += dx / dd * 3.2; d.bv.z += dz / dd * 3.2; d.bv.y = Math.max(d.bv.y, 2.2); tone(520, 0.05, "sine", 0.06); }
        const B = rt.bounds;
        if (bp.x < B.x0) { bp.x = B.x0; d.bv.x = Math.abs(d.bv.x); } if (bp.x > B.x1) { bp.x = B.x1; d.bv.x = -Math.abs(d.bv.x); }
        if (bp.z < -6) { bp.z = -6; d.bv.z = Math.abs(d.bv.z); } if (bp.z > 5.6) { bp.z = 5.6; d.bv.z = -Math.abs(d.bv.z); }
        ball.rotation.x += d.bv.z * dt * 3; ball.rotation.z -= d.bv.x * dt * 3;
        const bh = rt.hots.find(h => h.id === "ball"); if (bh) { bh.x = bp.x; bh.z = bp.z; }
        // Heshy bobbing — and the occasional CANNONBALL
        const hz = rt.byId.heshy.p.obj;
        if (d.cannon > 0) {
            d.cannon -= dt;
            const k = 1 - d.cannon / 1.1;
            hz.position.y = d.heshyHome.y + Math.sin(k * Math.PI) * 2.0;
            hz.rotation.x = k * Math.PI * 2;
            if (d.cannon <= 0) {
                hz.rotation.x = 0;
                sfx.splash();
                rt.burst(new THREE.Vector3(d.heshyHome.x, 0, d.heshyHome.z), ["#FFFFFF", "#B3E5FC", "#4FC3F7"], 26, 3.5, 0.09);
                rt.bubble("KERSPLASH!", hz, 1.4, { yOff: 2.0, size: 0.7, color: "#0277BD" });
            }
        } else hz.position.y = d.heshyHome.y + Math.sin(t * 1.6) * 0.08;
        if (d.heshyWave > 0) d.heshyWave -= dt;
        // castle towers grow in
        if (d.grow) { d.grow.t += dt; const s = Math.min(1, d.grow.t / 0.45); d.grow.c.scale.setScalar(0.01 + s * 0.99 * (1 + Math.sin(s * Math.PI) * 0.15)); if (s >= 1) d.grow = null; }
        for (const id of ["kid1", "kid2"]) { const q = rt.byId[id]; if (q.cheerT > 0) { q.cheerT -= dt; q.pose.cheer = q.cheerT > 0; } }
    },
});

function flap(g, ph, amp) {
    const wl = g.getObjectByName("Wing_L") || g.children.find(c => /^Wing_L/.test(c.name));
    const wr = g.getObjectByName("Wing_R") || g.children.find(c => /^Wing_R/.test(c.name));
    if (wl) wl.rotation.y = -Math.sin(ph) * amp;
    if (wr) wr.rotation.y = Math.sin(ph) * amp;
}

async function restHeal(rt) {
    const G = ctx.G;
    if (G.hearts >= G.maxHearts) {
        await rt.say("Cabana", pick(["You're already fresh as a daisy, mamaleh.", "Hearts are full — go enjoy the waves!"]), CABANA_S);
        return;
    }
    if (wallet.coins < HEAL_FEE) {
        sfx.deny();
        await rt.say("Cabana", "A cabana costs coins, bubbeleh. Come back richer.", CABANA_S);
        return;
    }
    if (!rt.pay(HEAL_FEE)) return;
    // a lie-down in the sun on the lounger
    const lo = rt.spot("lounge");
    const L = rt.lulu.obj;
    rt.lock = true;
    const back = L.position.clone();
    L.position.set(lo.x, 0.55, lo.z);
    L.rotation.set(-Math.PI / 2 + 0.55, lo.ry, 0, "YXZ");
    rt.focusAt = L.position.clone();
    heal(G.maxHearts - G.hearts);
    H.toast("❤ rested — hearts refilled!", "pink");
    sfx.coin();
    rt.burst(new THREE.Vector3(lo.x, 1.2, lo.z), ["#FF80AB", "#FFFFFF", "#FF4081"], 16, 1.8, 0.06);
    await rt.say("Cabana", "Ahhh. Sun, sea, and full hearts. Drive safe now!", CABANA_S);
    L.rotation.set(0, lo.ry + Math.PI, 0, "XYZ");
    L.position.copy(back);
    rt.focusAt = null;
    rt.lock = false;
}
