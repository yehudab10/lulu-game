// features/airport — ✈️ STAGE 3 in the terminal hall (a stage-2 builder: ctx.airport.terminal.addBuilder):
//   🧳 THE LOST SUITCASE  Mrs. Shpilkes by ARRIVALS — her pink suitcase (pom-pom, FRAGILE: KUGEL) is somewhere in the hall
//                         (on Bubbe's scale, under a tired man's feet by the board, by the plant at the doors) or a
//                         look-alike-bag man (Mr. Pilkes) is doing laps with it. Carry it back: PAY.bag once a real day.
//   🎤 DOVID DOV ON TOUR  now and then (solo only) the arrivals doors open and he walks down the VIP carpet; a fan crowd,
//                         Officer Segal clears a path; ✋ a selfie / an autograph / "strangers"; PAY.dovid once a real day.
//   🚕 A FARE AT ARRIVALS only while a JFK taxi run can be offered (stage 1 in): "Taxi? Are you a taxi?" → booked: she
//                         picks them up at the ARRIVALS kerb when she's back in her car.
// Everyone here is a terminal-crowd record (homes' instanced rigs: no new draw calls); the suitcase is one cloned prop.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import * as H from "../../hud.js";
import { tone, sfx } from "../interiors/fx.js";
import { path } from "./terminal-crowd.js";
import { BAG, DOVID, TAXI, FARES, TUNE } from "./stage3-data.js";
import { claim, taxiWhy, lifetime } from "./stage3.js";
import { saveSoon } from "../../core/save.js";

export const HALL = { forceDovid: null, forceBag: null };
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const partyOn = () => !!(ctx.party && ctx.party.active);
const PINK = "#EC407A";
const S_PERL = { emoji: "😰", color: BAG.color }, S_LULU = { emoji: "💁‍♀️", color: "#AD1457" }, S_DOV = { emoji: "🎤", color: DOVID.color },
    S_GUARD = { emoji: "🛴", color: "#1F3A5F" }, S_FARE = { emoji: "🚕", color: "#F9A825" };
/** Where the lost suitcase can be (room coords): the bag, and the hotspot to grab it from. */
const SPOTS = {
    scale: { x: -25.5, z: -4.3, hx: -25.6, hz: -3.5, ry: 0.4 },
    bench: { x: -9.8, z: -5.6, hx: -9.8, hz: -4.8, ry: -0.3 },
    plant: { x: -25.9, z: 5.6, hx: -25.9, hz: 4.9, ry: 0.9 },
};
const PERL = { x: -10.5, z: -2.7, hx: -10.5, hz: -1.7 };
const FARE_AT = { x: -0.9, z: -1.9, hx: -0.9, hz: -1.2 };
const DOV = { door: { x: -2, z: -6.2 }, back: { x: 3.0, z: -6.1 }, end: { x: 3.0, z: -3.5 }, hot: { x: 3.0, z: -1.3 } };

function say(rt, who, text, st, agent) {
    if (agent) { agent.talkT = 99; agent.faceTo = rt.lulu.obj.position; }
    return rt.say(who, text, st || {}).then(r => { if (agent) { agent.talkT = 0; agent.faceTo = null; } return r; });
}
async function lines(rt, list, styles, agents = {}) {
    for (const [who, text] of list) {
        if (rt.disposed) return;
        await say(rt, who, text, who === "Lulu" ? S_LULU : styles[who] || styles._, agents[who]);
    }
}
/** A clone of one of the terminal's props (Prop_<name>). */
function tprop(name) {
    const src = models.airportTerminalProps && findNodes(models.airportTerminalProps, "Prop_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    return c;
}

// ════ the builder ════════════════════════════════════════════════════════
export function hallBuilder(rt) {
    const d = rt.data;
    if (!d.crowd) return;
    const s3 = d.s3 = { last: rt.t, bag: null, dv: null, fare: null };
    lostBag(rt);
    dovid(rt);
    fareAtDoor(rt);
    // one ticker a frame (a repeating timer at 0 s — the engine runs it after the room's own tick)
    rt.timers.push({ min: 0, max: 0, t: 0, gate: false, fn: () => { try { tick(rt); } catch (e) { console.error("[airport stage3] tick", e); } } });
}

function tick(rt) {
    const d = rt.data, s3 = d.s3;
    if (!s3 || rt.disposed) return;
    const dt = Math.min(0.1, rt.t - s3.last); s3.last = rt.t;
    bagTick(rt, dt);
    dovidTick(rt, dt);
}

// ════ 🧳 the lost suitcase ═══════════════════════════════════════════════
function lostBag(rt) {
    const d = rt.data, C = d.crowd, s3 = d.s3;
    const variant = HALL.forceBag || (ctx.TEST ? "plant" : pick(["scale", "bench", "plant", "lookalike", "lookalike"]));
    HALL.forceBag = null;
    const B = s3.bag = { phase: "ask", variant, obj: null, held: false, said: 0, tired: null, pilkes: null, hot: null };
    B.perl = C.add({ id: "perl", look: "woman", x: PERL.x, z: PERL.z, ry: 0, top: "#7B1FA2", bot: "#311B92", hair: "#3E2723", named: true, pose: { phone: true } });
    // her suitcase: one prop (pink, a pom-pom) — out of sight until the hunt
    const bag = B.obj = tprop("Suitcase");
    bag.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(PINK); rt.own(o.material); o.castShadow = false; } });
    const pom = new THREE.Mesh(rt.own(new THREE.IcosahedronGeometry(0.09, 1)), rt.own(new THREE.MeshStandardMaterial({ color: "#FFF176", roughness: 1 })));
    pom.position.set(0, 0.95, 0); pom.name = "PomPom";
    bag.add(pom);
    bag.visible = false;
    rt.add(bag);
    if (variant === "lookalike") {
        // Mr. Pilkes is already doing laps of the landside with it (well — with HIS. It's hers.)
        const land = path([[-24.5, 2.6], [2.6, 2.6], [2.6, 1.0], [-24.5, 1.0]]);
        B.pilkes = C.add({ id: "pilkes", look: "man", path: land, u: 9, speed: 1.0, top: "#00897B", hair: "#212121", named: true, bag: PINK });
    } else if (variant === "bench") {
        B.tired = C.add({ id: "tired", look: "man", x: -9.15, z: -5.85, ry: 0, top: "#546E7A", named: true, pose: { sit: true } });
    }
    B.hotPerl = rt.hot({ id: "s3_perl", x: PERL.hx, z: PERL.hz, r: 1.3, label: () => BAG.label[B.phase === "carry" ? "give" : B.phase] || BAG.label.ask, action: perlTalk });
    B.hotBag = rt.hot({ id: "s3_bag", x: 0, z: 0, r: 1.1, label: BAG.grab, enabled: () => B.phase === "hunt" && B.variant !== "lookalike", action: grabBag });
    B.hotPilkes = rt.hot({ id: "s3_pilkes", x: -30, z: 0, r: 1.6, label: BAG.lookalike.label, enabled: () => B.phase === "hunt" && B.variant === "lookalike", action: pilkesTalk });
}
function bagTick(rt, dt) {
    const B = rt.data.s3.bag;
    if (!B) return;
    if (B.pilkes && B.hotPilkes) { B.hotPilkes.x = B.pilkes.x; B.hotPilkes.z = B.pilkes.z; }
    // carrying: her hand (a snack can bump it — pick it back up)
    if (B.phase === "carry" && B.obj && !B.obj.parent) { rt.luluHold(B.obj, { y: -0.36, z: 0.1 }); }
    if (B.phase === "ask" && B.perl) { B.said -= dt; if (B.said <= 0 && rt.t > 3) { B.said = rand(14, 20); rt.bubble(pick(["My SUITCASE!", "Has anyone seen a pink suitcase?!", "Oy, my pom-pom…"]), B.perl.anchor, 2.2, { color: BAG.color }); } }
}
async function perlTalk(rt) {
    const d = rt.data, B = d.s3.bag, P = B.perl;
    if (B.phase === "ask") {
        for (const l of BAG.hello) { await say(rt, BAG.who, l, S_PERL, P); if (rt.disposed) return; }
        const i = await rt.choose(BAG.who, BAG.ask, BAG.opts, S_PERL);
        if (rt.disposed || i < 0) return;
        if (i === 1) { await say(rt, BAG.who, BAG.nope, S_PERL, P); return; }
        B.phase = "hunt";
        if (B.variant !== "lookalike") {
            const s = SPOTS[B.variant];
            B.obj.position.set(s.x, 0, s.z); B.obj.rotation.set(0, s.ry, 0); B.obj.visible = true;
            B.hotBag.x = s.hx; B.hotBag.z = s.hz;
        }
        emit("airport:bag", { phase: "ask", variant: B.variant });
        await say(rt, BAG.who, BAG.hints[B.variant], S_PERL, P);
        return;
    }
    if (B.phase === "hunt") { await say(rt, BAG.who, BAG.hints[B.variant], S_PERL, P); return; }
    if (B.phase === "carry") return giveBack(rt);
    await say(rt, BAG.who, BAG.after, S_PERL, P);
}
async function grabBag(rt) {
    const d = rt.data, B = d.s3.bag;
    if (B.phase !== "hunt") return;
    const found = BAG.found[B.variant] || [];
    const agents = { "Bubbe Faigy": d.A && d.A.bubbe, "A tired man": B.tired };
    await lines(rt, found, { "Bubbe Faigy": { emoji: "👵", color: "#6A1B9A" }, "A tired man": { emoji: "😴", color: "#546E7A" }, _: S_LULU }, agents);
    if (rt.disposed) return;
    carry(rt);
}
async function pilkesTalk(rt) {
    const d = rt.data, B = d.s3.bag, P = B.pilkes;
    if (B.phase !== "hunt" || !P) return;
    P.path = null; P.target = null; P.walk = 0; P.faceTo = rt.lulu.obj.position;
    await lines(rt, BAG.lookalike.lines, { "Mr. Pilkes": { emoji: "🧳", color: "#00897B" } }, { "Mr. Pilkes": P });
    if (rt.disposed) return;
    P.bag = null; P.faceTo = null;
    carry(rt);
    // he wanders off to sit down (as promised)
    d.crowd.walkTo(P, -6.6, 4.2, 1.0).then(() => { if (!rt.disposed) { P.pose = { sit: true }; P.ry = Math.PI; } });
}
function carry(rt) {
    const B = rt.data.s3.bag;
    B.phase = "carry";
    B.obj.visible = true;
    B.obj.rotation.set(0, Math.PI / 2, 0);
    B.obj.scale.setScalar(0.72);
    rt.luluHold(B.obj, { y: -0.36, z: 0.1 });
    B.held = true;
    tone(520, 0.08, "triangle", 0.1, 780);
    rt.bubble(pick(BAG.luluCarry), rt.lulu.obj, 2.4);
    emit("airport:bag", { phase: "found", variant: B.variant });
}
async function giveBack(rt) {
    const d = rt.data, B = d.s3.bag, P = B.perl;
    await lines(rt, BAG.give, { [BAG.who]: S_PERL }, { [BAG.who]: P });
    if (rt.disposed) return;
    // the suitcase goes back to her (it stands beside her now: the crowd's instanced bag, pink)
    rt.luluHold(null);
    B.obj.visible = false;
    P.bag = PINK; P.bagI = 6; P.pose = {}; P.cheerT = 2.2;
    B.phase = "done";
    rt.burst(new THREE.Vector3(P.x, 1.7, P.z), ["#EC407A", "#FFF176", "#FFFFFF"], 16, 2.0, 0.06);
    const pay = claim("bag");
    B.pay = pay;
    lifetime.bags = (lifetime.bags || 0) + 1; saveSoon();
    emit("stat", { id: "airportBagsReturned", n: 1 });
    emit("airport:bag", { phase: "return", variant: B.variant, pay });
    if (pay > 0) rt.coins(pay, `+${pay} 💰 Mrs. Shpilkes says thank you`);
    await say(rt, BAG.who, pay > 0 ? BAG.paid : BAG.unpaid, S_PERL, P);
}

// ════ 🎤 Dovid Dov on tour ═══════════════════════════════════════════════
function dovid(rt) {
    const d = rt.data, s3 = d.s3;
    const forced = HALL.forceDovid;
    HALL.forceDovid = null;
    const solo = !partyOn();
    const ok = solo && !d.law && forced !== false && (forced === true || (!ctx.TEST && ctx.enabled("airport") && Math.random() < TUNE.dovidChance));
    const DV = s3.dv = { phase: ok ? "due" : "none", at: rt.t + (forced ? 1.2 : rand(TUNE.dovidAt[0], TUNE.dovidAt[1])), fans: [], stayT: 0, cheerT: 2, met: false };
    // the VIP carpet's own hotspot stays quiet while he's on it (his takes over)
    const vh = rt.hots.find(h => h.id === "vip");
    if (vh) {
        const en = vh.enabled;
        vh.enabled = r => !/^(walk|here|scene|leave)$/.test(DV.phase) && (!en || en(r));
        if (!solo) { const act = vh.action; vh.action = async r => { await act(r); if (!r.disposed) await say(r, "Lulu", DOVID.party, { emoji: "⭐", color: "#C62828" }); }; }
    }
    DV.hot = rt.hot({ id: "s3_dovid", x: DOV.hot.x, z: DOV.hot.z, r: 1.6, label: () => DV.phase === "here" ? DOVID.label : DOVID.labelBusy, enabled: () => DV.phase === "here", action: dovidScene });
}
function dovidTick(rt, dt) {
    const d = rt.data, DV = d.s3.dv;
    if (!DV) return;
    if (DV.phase === "due" && rt.t >= DV.at && !rt.busy && !d.inLine) { if (d.law) { DV.phase = "none"; return; } dovidArrive(rt); return; }
    if (DV.phase === "here" || DV.phase === "walk") {
        DV.cheerT -= dt;
        if (DV.cheerT <= 0 && DV.fans.length) {
            DV.cheerT = rand(2.2, 3.6);
            const f = pick(DV.fans);
            f.cheerT = 1.4;
            if (Math.random() < 0.55) rt.bubble(pick(DOVID.fans), f.anchor, 1.9, { color: "#C62828" });
        }
    }
    if (DV.phase === "here") {
        DV.stayT += dt;
        if (DV.stayT > TUNE.dovidStay && !rt.busy && !ctx.dialogOpen) dovidLeave(rt, false);
    }
}
/** The arrivals doors open; he walks out, along behind the rail and down the red carpet; the fans gather; Segal clears a path. */
function dovidArrive(rt) {
    const d = rt.data, C = d.crowd, DV = d.s3.dv, A = d.A;
    DV.phase = "walk";
    d.doorT = 4.5;                                  // (stage 2's arrivals doors slide open)
    const L = rt.lulu.obj.position;
    rt.bubble(DOVID.pa, new THREE.Vector3(L.x + 1.5, 1.7, L.z - 2.2), 4, { color: "#1F3A5F" });
    tone(660, 0.1, "sine", 0.08, 0); tone(880, 0.12, "sine", 0.08, 0, 0.14); tone(1320, 0.2, "sine", 0.08, 0, 0.3);
    DV.dov = C.add({ id: "dovid", look: "man", x: DOV.door.x, z: DOV.door.z, ry: 0, top: "#1A1A1A", bot: "#1A1A1A", hair: "#3E2723", scale: 1.04, named: true, collide: true });
    DV.roadie = C.add({ id: "roadie", look: "man", x: DOV.door.x - 0.3, z: DOV.door.z, ry: 0, top: "#37474F", bag: "#37474F", named: true, collide: false });
    emit("airport:dovid", { phase: "arrive" });
    // the fans: from the landside, into an arc in front of the carpet (a gap in the middle so she can get to him)
    const arc = [-1.25, -0.8, -0.42, 0.42, 0.8, 1.25].slice(0, TUNE.fans);
    arc.forEach((a, k) => {
        const f = C.add({ id: "fan" + k, look: k === 2 ? "kid" : k % 2 ? "woman" : "man", x: -6 - k * 1.3, z: 1.0 + (k % 3) * 0.9, ry: Math.PI, seed: 0.13 * k + 0.4, named: k < 3 });
        f.collide = false;
        DV.fans.push(f);
        C.walkTo(f, DOV.end.x + Math.sin(a) * 2.0, DOV.end.z + Math.cos(a) * 2.0, 2.4 + k * 0.1).then(() => { if (!rt.disposed) { f.faceTo = { x: DOV.end.x, z: DOV.end.z }; f.collide = true; } });
    });
    // Officer Segal clears a path (round by the exit lane: he does NOT ride through the glass)
    const g = A && A.guard;
    if (g && !d.law) {
        g.path = null; DV.guard = true;
        (async () => {
            await C.walkTo(g, 13.0, 5.1, 3.4); if (rt.disposed) return;
            await C.walkTo(g, 10.5, 5.1, 3.4); if (rt.disposed) return;
            await C.walkTo(g, 5.4, 0.0, 3.6); if (rt.disposed) return;
            g.faceTo = { x: DOV.end.x, z: DOV.end.z };
            rt.bubble(pick(DOVID.guard), g.anchor, 2.4, { color: "#1F3A5F" });
        })().catch(() => { });
    }
    // him: behind the rail to the top of the carpet, then down it
    (async () => {
        await rt.wait(0.6); if (rt.disposed) return;
        C.walkTo(DV.roadie, DOV.back.x - 1.2, DOV.back.z + 0.1, 1.2).then(() => { if (!rt.disposed) DV.roadie.faceTo = { x: DOV.end.x, z: DOV.end.z + 3 }; });
        await C.walkTo(DV.dov, DOV.back.x, DOV.back.z, 1.25); if (rt.disposed) return;
        await C.walkTo(DV.dov, DOV.end.x, DOV.end.z, 0.9); if (rt.disposed) return;
        DV.dov.ry = 0; DV.dov.faceTo = null; DV.dov.waveT = 2.5;
        DV.phase = "here"; DV.stayT = 0;
        emit("airport:dovid", { phase: "here" });
    })().catch(() => { });
}
async function dovidScene(rt) {
    const d = rt.data, DV = d.s3.dv, P = DV.dov;
    if (DV.phase !== "here" || !P) return;
    DV.phase = "scene";
    P.faceTo = rt.lulu.obj.position;
    await say(rt, DOVID.who, DOVID.whisper, S_DOV, P);
    if (rt.disposed) return;
    const i = await rt.choose(DOVID.who, DOVID.ask, DOVID.opts, S_DOV);
    if (rt.disposed) return;
    const choice = ["selfie", "autograph", "strangers"][i] || "strangers";
    if (choice === "selfie") {
        await rt.walkTo(DOV.end.x + 0.55, DOV.end.z + 0.75, 2);
        if (rt.disposed) return;
        rt.lulu.obj.rotation.y = 0; P.faceTo = null; P.ry = 0; P.waveT = 3;
        rt.luluPose = { point: true };
        await say(rt, "Lulu", DOVID.selfie[0][1], S_LULU);
        if (rt.disposed) return;
        H.flash(); tone(1800, 0.05, "square", 0.06); tone(900, 0.08, "triangle", 0.06, 0, 0.06);
        rt.burst(new THREE.Vector3(DOV.end.x + 0.3, 1.9, DOV.end.z + 0.4), ["#FF4081", "#FFD740", "#FFFFFF", "#40C4FF"], 18, 2.2, 0.06);
        DV.selfie = true;
        await say(rt, DOVID.who, DOVID.selfie[1][1], S_DOV, P);
        rt.luluPose = null;
    } else if (choice === "autograph") {
        const kugel = tprop("Kugel");
        rt.luluHold(kugel, { y: -0.45, z: 0.12 });
        await lines(rt, DOVID.autograph, { [DOVID.who]: S_DOV }, { [DOVID.who]: P });
        rt.luluHold(null);
        DV.autograph = true;
    } else {
        await lines(rt, DOVID.strangers, { [DOVID.who]: S_DOV }, { [DOVID.who]: P });
    }
    if (rt.disposed) return;
    // the fans react (they still don't know who he is — or who SHE is)
    DV.fans.forEach((f, k) => { f.cheerT = 1.5; if (k < 2) rt.bubble(DOVID.fanAfter[k % DOVID.fanAfter.length], f.anchor, 2, { color: "#C62828" }); });
    // once a real day: a little gas money; the first time ever: the scrapbook badge (meta, via the stat)
    const pay = claim("dovid");
    DV.pay = pay; DV.met = true; DV.choice = choice;
    lifetime.met = (lifetime.met || 0) + 1; saveSoon();
    emit("stat", { id: "airportDovid", n: 1 });
    emit("airport:dovid", { phase: "meet", choice, pay });
    await say(rt, DOVID.who, pay > 0 ? DOVID.gift : DOVID.noGift, S_DOV, P);
    if (pay > 0 && !rt.disposed) rt.coins(pay, `+${pay} 💰 gas money (from a "stranger" 🤫)`);
    if (rt.disposed) return;
    await say(rt, DOVID.who, DOVID.bye, S_DOV, P);
    dovidLeave(rt, true);
}
/** His car's here: out through the hall to the doors, the roadie behind him, the fans trailing after, Segal back to his patrol. */
function dovidLeave(rt, met) {
    const d = rt.data, C = d.crowd, DV = d.s3.dv;
    if (!DV || DV.phase === "leave" || DV.phase === "gone") return;
    DV.phase = "leave";
    emit("airport:dovid", { phase: "leave", met: !!met });
    const out = a => (async () => {
        if (!a) return;
        a.faceTo = null; a.collide = false;
        await C.walkTo(a, a.x, 0.6, 1.4); if (rt.disposed) return;
        await C.walkTo(a, -26.4, 2.5 + Math.random(), 1.5); if (rt.disposed) return;
        C.remove(a);
    })().catch(() => { });
    out(DV.dov);
    setTimeout(() => out(DV.roadie), 500);
    DV.fans.forEach((f, k) => setTimeout(() => { if (!rt.disposed) out(f); }, 1400 + k * 350));
    if (!met) { const L = rt.lulu.obj.position; rt.bubble(DOVID.leaveAlone, new THREE.Vector3(L.x + 1.5, 1.7, L.z - 2.2), 3.5, { color: "#1F3A5F" }); }
    // Segal goes back to his patrol (stage 2's route) unless she's wanted (then he's busy with HER)
    const g = d.A && d.A.guard, g0 = rt.spot("guard");
    if (g && DV.guard && !d.law && g0) {
        (async () => {
            g.faceTo = null;
            await C.walkTo(g, 10.5, 5.1, 3.2); if (rt.disposed || d.law) return;
            await C.walkTo(g, 13.0, 5.1, 3.2); if (rt.disposed || d.law) return;
            await C.walkTo(g, g0.x - 1.2, -1.4, 2.2); if (rt.disposed || d.law || g.target) return;
            g.path = path([[g0.x - 1.2, -1.4], [g0.x - 1.2, 3.6]], false); g.u = 0; g.speed = 1.0;
        })().catch(() => { });
    }
    setTimeout(() => { if (!rt.disposed && DV.phase === "leave") DV.phase = "gone"; }, 9000);
}

// ════ 🚕 a fare at the arrivals door (only while a JFK taxi run can be offered) ════
function fareAtDoor(rt) {
    const d = rt.data, C = d.crowd, s3 = d.s3;
    if (taxiWhy()) return;                       // (no airport kerb — stage 1 off — or today's runs are done, or a party)
    const f = pick(FARES);
    const a = C.add({ id: "s3_fare", look: f.look === "npcWoman" ? "woman" : "man", x: FARE_AT.x, z: FARE_AT.z, ry: 0, top: f.colors.Top, bot: f.colors.Bottom, hair: f.colors.Hair, bag: true, named: true, pose: { wave: true } });
    const F = s3.fare = { fare: f, a, booked: false };
    F.hot = rt.hot({ id: "s3_fare", x: FARE_AT.hx, z: FARE_AT.hz, r: 1.1, label: TAXI.door.label, enabled: () => !F.booked && !taxiWhy(), action: async rt => {
        await say(rt, f.name, TAXI.door.ask, S_FARE, a);
        if (rt.disposed) return;
        const i = await rt.choose(f.name, f.hello, [TAXI.door.yes, TAXI.door.no], S_FARE);
        if (rt.disposed || i < 0) return;
        if (i === 1) { await say(rt, f.name, TAXI.door.nope, S_FARE, a); return; }
        if (!ctx.airport.stage3.taxi.book(f.id)) return;
        F.booked = true;
        await say(rt, f.name, TAXI.door.booked, S_FARE, a);
        a.pose = {};
        C.walkTo(a, -26.4, 2.4, 1.4).then(() => { if (!rt.disposed) C.remove(a); });
    } });
}
export { SPOTS as BAG_SPOTS, DOV as DOVID_SPOTS, sfx };
