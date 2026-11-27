// features/crime — 🧾 STREET-LEVEL CORRUPTION (city hall proper — a mayor, taxes, inspectors' bosses — is ci/cityhall's: it
// gets `crime:corrupt` {who, act} and ctx.crime.corruption to build on).
//
//   🧾 MALKA THE METER MAID — double-parked in town for TUNE.corrupt.malkaAfter s, Malka walks up to her window:
//      🧾 take the ticket (PAY.ticket, a sink) · 🍬 sweet-talk (a chance; better once she likes you; fail = +2) ·
//      🍩 a "donation" to the Meter Maid Fund (PAY.donation: torn up — but now and then it's an I.A. STING → arrested for
//      BRIBING A PUBLIC SERVANT (MINOR)) · 📸 "about this photo of you…" (with evidence: hush money, she's nervous for good).
//   👀 CROOKED MOMENTS she can walk in on (one every gap s while she walks in town, ≤ perRun): Malka taking an envelope from a
//      double-parker, TUVIA'S TOWING hooking up a legally parked minivan ("the hydrant's invisible"), INSPECTOR PINCHAS
//      pocketing a challah "for the inspection". 📸 the phone's Camera (photo mode) with it in frame — or ✋ → "📸 Snap it" —
//      = EVIDENCE (SAVE.evidence, one per character). ✋ → "🤝 want a hand? for a cut" = PAY.cut (≤ cutPerDay a real day) +heat
//      (and now and then it's a sting too).
//   🕵️ EVIDENCE → the 📞 Phone › 🕵️ Internal Affairs: hand it in → PAY.ia 💰 (≤ iaPerDay a real day) and that character is
//      REASSIGNED for good (Malka → Officer Pnina, by the book: tickets only; no more tows / no more "inspections") — OR take
//      it to the character (✋ / at the window) → hush money (PAY.hush, ≤ hushPerDay a real day) +heat, and they're NERVOUS
//      for good (Malka never tickets her again). Every choice is remembered (SAVE.mem + features/memory).
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { CR, SAVE, need, models, PAY, TUNE, LINES, dirty, log, stat, pick, fill, lulu, bubble, mustSee, payCapped, live, walking, onFoot, luluPos, streetAt, chasing } from "./common.js";
import { CHARGES } from "./data.js";
import { Character, ask, mem, remember } from "./street.js";
import { PARK } from "./doublepark.js";

const K = TUNE.corrupt, M = LINES.corrupt;
if (!Array.isArray(SAVE.evidence)) SAVE.evidence = [];
export const CO = { malka: null, scene: null, nextT: K.firstAfter, n: 0, spotRm: null, force: {} };
const WHO = { malka: { name: M.malka, key: "npcWoman", colors: { Shirt: "#1565C0", Pants: "#0D47A1" } },
    tuvia: { name: M.tuvia, key: "npcMan", colors: { Shirt: "#FF6F00", Pants: "#3E2723" } },
    pinchas: { name: M.pinchas, key: "hustle_detective", colors: { Coat: "#455A64" } } };
const moodOf = id => (SAVE.mem[id] && SAVE.mem[id].mood) || "";
const gone = id => moodOf(id) === "gone";
const hasEvidence = id => SAVE.evidence.some(e => e.who === id);
function corrupt(who, act) { emit("crime:corrupt", { who, act }); log("corrupt", { who, act }); }

// ── 🧾 Malka at the window ─────────────────────────────────────────────────
export function corruptReset() { dropMalka(); dropScene(); CO.nextT = K.firstAfter; CO.n = 0; }
function dropMalka() { if (CO.malka) { CO.malka.c.clear(); CO.malka = null; } }
function malkaTick(dt) {
    const P = PARK.on;
    if (!CO.malka) {
        if (!P || P.malka || P.t < K.malkaAfter || ctx.dialogOpen || !live()) return;
        P.malka = true;
        if (moodOf("malka") === "nervous") { log("malka", { phase: "nervous" }); return; }
        const car = ctx.car, sa = streetAt(car.pos.x, car.pos.z, car.s);
        const side = sa ? Math.sign(sa.d) || 1 : 1;
        const c = new Character({ key: "npcWoman", colors: WHO.malka.colors, name: M.malka });
        // she comes up the sidewalk from behind the car
        const bx = car.pos.x - Math.sin(car.h) * 16 + Math.cos(car.h) * side * 3.4, bz = car.pos.z - Math.cos(car.h) * 16 - Math.sin(car.h) * side * 3.4;
        c.place(bx, bz, car.h);
        CO.malka = { c, t: 0, side, asked: false };
        log("malka", { phase: "coming", strict: gone("malka") });
        return;
    }
    const Mk = CO.malka, c = Mk.c;
    Mk.t += dt;
    if (!PARK.on || ctx.state !== "playing") { if (c.obj && !Mk.asked) bubble("Hmph. Next time.", c.obj, { y: 2.1 }); dropMalka(); return; }
    if (!c.keep() || !c.p || Mk.asked) return;
    const car = ctx.car, wx = car.pos.x + Math.cos(car.h) * Mk.side * 1.6, wz = car.pos.z - Math.sin(car.h) * Mk.side * 1.6;
    const dx = wx - c.x, dz = wz - c.z, d = Math.hypot(dx, dz);
    if (d > 0.5) { c.x += dx / d * 1.8 * dt; c.z += dz / d * 1.8 * dt; c.sync(); c.p.face(wx, wz, dt, 6); c.p.update(dt, { walk: 1.8 }); return; }
    c.p.face(car.pos.x, car.pos.z, dt, 6);
    c.p.update(dt, { talk: true });
    if (!ctx.dialogOpen) { Mk.asked = true; ticket(); }
}
/** The ticket card at her window. (Tests call it straight while double-parked.) */
export async function ticket() {
    const strict = gone("malka");
    const name = strict ? M.strict : M.malka;
    const t = PAY.ticket;
    const opts = strict ? [fill(M.ticketOpts[0], { t })] : [fill(M.ticketOpts[0], { t }), M.ticketOpts[1], fill(M.ticketOpts[2], { d: PAY.donation })];
    if (!strict && hasEvidence("malka")) opts.push(M.ticketOpts[3]);
    stat("crimeTickets");
    const i = await ask(`🧾 ${name}`, strict ? fill(M.strictLine, { t }) : M.ticket, opts, "🧾");
    const c = CO.malka && CO.malka.c;
    const say = (txt, cls = "") => { if (c && c.obj) bubble(txt, c.obj, { y: 2.1, cls }); };
    const pay = n => { const k = Math.min(n, wallet.coins); if (k > 0) wallet.spend(k); return k; };
    if (strict || i === 0) { const k = pay(t); log("malka", { phase: "ticket", paid: k, strict }); remember("malka", "tickets"); }
    else if (i === 1) {
        const p = CO.force.sweet != null ? CO.force.sweet : Math.random() < (moodOf("malka") === "friendly" ? 0.7 : 0.35);
        if (p) { say(pick(M.sweetOk), "nice"); remember("malka", "sweet", "friendly"); log("malka", { phase: "sweet", ok: true }); }
        else { const k = pay(PAY.sweetFail); say(fill(M.sweetNo, { n: PAY.sweetFail })); log("malka", { phase: "sweet", ok: false, paid: k }); }
    } else if (i === 2) {
        if (wallet.coins < PAY.donation) { const k = pay(t); log("malka", { phase: "ticket", paid: k }); return; }
        wallet.spend(PAY.donation);
        corrupt("malka", "bribe");
        stat("crimeBribes");
        const sting = CO.force.sting != null ? CO.force.sting : Math.random() < 0.15;
        if (sting) {
            say("Internal Affairs, ma'am. Smile for the camera. 📸", "cop");
            remember("malka", "stung");
            log("malka", { phase: "sting" });
            if (PARK.on) PARK.on.done = true;
            try { if (ctx.law && ctx.law.arrest) ctx.law.arrest([CHARGES.bribery.name, CHARGES.park.name]); } catch (e) { /* no law */ }
            return;
        }
        say(pick(M.tornUp));
        remember("malka", "bribed", moodOf("malka") === "friendly" ? "friendly" : "bribed");
        log("malka", { phase: "donation" });
    } else if (i === 3) hush("malka", say);
}

// ── 👀 crooked moments ────────────────────────────────────────────────────
function dropScene() {
    const S = CO.scene;
    if (!S) return;
    for (const c of S.people) c.clear();
    if (S.truck) S.truck.removeFromParent();
    if (S.rm) S.rm();
    CO.scene = null;
}
/** A crooked moment near her now (tests: kind). → bool */
export function spawnScene(kind = null) {
    if (CO.scene) return false;
    const pool = ["malka", "tuvia", "pinchas"].filter(k => !gone(k) && moodOf(k) !== "nervous");
    kind = kind || pick(pool.length ? pool : ["malka"]);
    if (gone(kind)) return false;
    const lp = luluPos(), road = ctx.world.road;
    const n = road.nearest(lp.x, lp.z, undefined, {}), st = n.street;
    if (!st) return false;
    // up the sidewalk she's walking, 18–45 m ahead (whichever way along is longer)
    const dist = K.near[0] + Math.random() * (K.near[1] - K.near[0]);
    const along = n.s - st.base, dir = (st.a1 - along) > (along - st.a0) ? 1 : -1;
    const sd = Math.sign(n.d) || 1, s = n.s + dir * dist;
    const P = road.point(s, sd * (st.curb + 1.3), {}), Q = road.point(s + 3, sd * (st.curb + 1.3), {});
    const yaw = Math.atan2(Q.x - P.x, Q.z - P.z);
    const S = CO.scene = { kind, x: P.x, z: P.z, t: 0, sayT: 0.6, line: 0, people: [], truck: null, snapped: false, rm: null };
    const crook = new Character({ key: WHO[kind].key, fallback: "npcMan", colors: WHO[kind].colors, name: WHO[kind].name });
    crook.place(P.x + Math.cos(yaw) * 0.6, P.z - Math.sin(yaw) * 0.6, yaw + Math.PI / 2);
    const other = new Character({ key: "npcMan", colors: { Shirt: "#8D6E63" }, name: "someone" });
    other.place(P.x - Math.cos(yaw) * 0.6, P.z + Math.sin(yaw) * 0.6, yaw - Math.PI / 2);
    S.people.push(crook, other);
    if (kind === "tuvia") {
        // the tow truck at the kerb (the plain traffic truck), its "victim" minivan right behind it
        need(["truck"]).then(() => {
            if (CO.scene !== S || !models.truck) return;
            const t = models.truck.clone(true);
            const k = road.point(s + 4, sd * (st.park || st.curb - 1.5), {});
            t.position.set(k.x, 0, k.z); t.rotation.y = yaw + (sd > 0 ? 0 : Math.PI);
            ctx.scene.add(t); S.truck = t;
        }).catch(() => {});
    }
    if (ctx.foot && ctx.foot.addSpot) S.rm = ctx.foot.addSpot(sceneSpot);
    CO.n++;
    stat("crimeCrookedSeen");
    log("scene", { kind, phase: "start" });
    return true;
}
const sceneSpot = {
    r: 2.6, short: M.sceneShort,
    pos() { const S = CO.scene; return S && S.t < K.life && live() ? { x: S.x, z: S.z } : null; },
    label() { return M.sceneSpot; },
    act() { sceneCard(); },
};
async function sceneCard() {
    const S = CO.scene;
    if (!S || ctx.dialogOpen) return;
    const W = WHO[S.kind];
    S.t = Math.min(S.t, K.life - 6);      // (they freeze while she asks)
    const opts = [M.sceneOpts[0], M.sceneOpts[1], M.sceneOpts[2]];
    if (hasEvidence(S.kind)) opts.splice(2, 0, M.sellBack);
    const i = await ask(`👀 ${W.name}`, M.scenes[S.kind].label, opts, "👀");
    if (CO.scene !== S) return;
    const say = (txt, cls = "") => { const c = S.people[0]; if (c && c.obj) bubble(txt, c.obj, { y: 2.1, cls }); };
    if (i === 0) snap(S.kind, "card");
    else if (i === 1) cut(S, say);
    else if (opts[i] === M.sellBack) hush(S.kind, say);
}
function cut(S, say) {
    const sting = CO.force.sting != null ? CO.force.sting : Math.random() < 0.12;
    corrupt(S.kind, "cut");
    if (sting) {
        say("Internal Affairs! Hands where I can see the kugel!", "cop");
        remember(S.kind, "stung");
        log("scene", { kind: S.kind, phase: "sting" });
        try { if (ctx.law && ctx.law.arrest) ctx.law.arrest([CHARGES.bribery.name]); } catch (e) { /* no law */ }
        return;
    }
    const paid = payCapped("cut", PAY.cut, PAY.cutPerDay);
    try { if (ctx.underworld && ctx.underworld.addHeat) ctx.underworld.addHeat(4, "cut"); } catch (e) { /* none */ }
    remember(S.kind, "cut", "partner");
    say(pick(M.cutOk));
    stat("crimeCuts");
    if (paid > 0) mustSee(`🤝 Your cut · +${paid} 💰`, "gold", "crime:corrupt");
    log("scene", { kind: S.kind, phase: "cut", paid });
}
/** Evidence of `who` (the photo / ✋ snap). → bool (new) */
export function snap(who, via = "camera") {
    if (hasEvidence(who)) { mustSee(M.snappedAlready, "", "crime:evidence"); return false; }
    SAVE.evidence.push({ who, what: M.scenes[who].label, via });
    if (SAVE.evidence.length > 6) SAVE.evidence.shift();
    dirty();
    stat("crimeEvidence");
    lulu("Gotcha. 📸", true);
    mustSee(fill(M.snapped, { who: WHO[who].name, what: M.scenes[who].label }), "gold", "crime:evidence");
    log("evidence", { who, via });
    return true;
}
function hush(who, say) {
    const paid = payCapped("hush", PAY.hush, PAY.hushPerDay);
    SAVE.evidence = SAVE.evidence.filter(e => e.who !== who);
    remember(who, "hushed", "nervous");
    corrupt(who, "hush");
    try { if (ctx.underworld && ctx.underworld.addHeat) ctx.underworld.addHeat(5, "hush"); } catch (e) { /* none */ }
    say(pick(M.hushed));
    stat("crimeHush");
    mustSee(`📸 Hush money from ${WHO[who].name}${paid > 0 ? ` · +${paid} 💰` : ""}`, paid > 0 ? "gold" : "", "crime:corrupt");
    log("hush", { who, paid });
}
/** 🕵️ Internal Affairs: hand in the evidence on `who`. → coins paid (−1 = no evidence) */
export function handIn(who) {
    if (!hasEvidence(who)) return -1;
    SAVE.evidence = SAVE.evidence.filter(e => e.who !== who);
    const m = mem(who);
    m.mood = "gone"; m.exposed = (m.exposed || 0) + 1;
    dirty();
    remember(who, "exposed", "gone");
    corrupt(who, "exposed");
    const paid = payCapped("ia", PAY.ia, PAY.iaPerDay);
    stat("crimeExposed");
    mustSee(fill(M.iaThanks, { who: WHO[who].name }) + (paid > 0 ? ` · +${paid} 💰` : ""), "gold", "crime:ia");
    log("ia", { who, paid });
    if (CO.scene && CO.scene.kind === who) dropScene();
    return paid;
}

// ── the camera: a photo with a crooked moment in frame = evidence ────────
const _v = new THREE.Vector3();
on("photo:snap", () => {
    const S = CO.scene;
    if (!S || S.t > K.life + 2) return;
    const cam = ctx.view ? ctx.view.camera : ctx.camera;
    _v.set(S.x, 1.3, S.z);
    const d = cam.position.distanceTo(_v);
    _v.project(cam);
    if (d > K.photoR || _v.z > 1 || Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 0.95) { log("evidence", { who: S.kind, miss: true, d: Math.round(d) }); return; }
    snap(S.kind, "camera");
});

// ── per frame ─────────────────────────────────────────────────────────────
export function corruptTick(dt) {
    malkaTick(dt);
    const S = CO.scene;
    if (S) {
        S.t += dt;
        for (const c of S.people) c.keep();
        const [crook, other] = S.people;
        if (crook.p) { crook.p.face(other.x, other.z, dt, 5); crook.p.update(dt, { talk: S.t < K.life }); }
        if (other.p) { other.p.face(crook.x, crook.z, dt, 5); other.p.update(dt, { talk: S.line % 2 === 1, point: S.kind === "tuvia" }); }
        S.sayT -= dt;
        const lp = luluPos(), near = Math.hypot(lp.x - S.x, lp.z - S.z) < 40;
        if (S.sayT <= 0 && S.t < K.life && near) {
            S.sayT = 3.4;
            const L = M.scenes[S.kind];
            if (S.line % 2 === 0 && crook.obj) bubble(L.lines[(S.line / 2) % L.lines.length], crook.obj, { y: 2.1, dur: 2.8 });
            else if (other.obj) bubble(pick(L.other), other.obj, { y: 2.1, dur: 2.4, cls: "angry" });
            S.line++;
        }
        if (S.t > K.life + 8 || Math.hypot(lp.x - S.x, lp.z - S.z) > 110) dropScene();
        return;
    }
    if (!live() || !walking() || chasing() || CO.n >= K.perRun || ctx.dialogOpen || ctx.engaged()) return;
    CO.nextT -= dt;
    if (CO.nextT > 0) return;
    CO.nextT = K.gap[0] + Math.random() * (K.gap[1] - K.gap[0]);
    spawnScene();
}

// ── 🕵️ Internal Affairs in the 📞 Phone ───────────────────────────────────
let iaWired = false;
export function wireIA() {
    const cm = ctx.community;
    if (iaWired || !cm || !cm.addContact) return;
    iaWired = true;
    const render = el => {
        const ev = SAVE.evidence;
        const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
        el.innerHTML = `<div class="lp-note">🕵️ <b>Sgt. Emes</b> · Internal Affairs. "Bring me something real."</div>`
            + (ev.length ? ev.map(e => `<button class="btn lp-row" data-ia="${esc(e.who)}"><span class="lp-av">📸</span><span class="lp-tx"><b>${esc(WHO[e.who] ? WHO[e.who].name : e.who)}</b><small>${esc(e.what)} · ${esc(M.iaHand)} (+${PAY.ia} 💰)</small></span></button>`).join("")
                : `<p class="lp-empty">${esc(M.iaNone)}</p>`)
            + ["malka", "tuvia", "pinchas"].filter(gone).map(w => `<p class="lp-fine">${esc(fill(M.iaGone, { who: WHO[w].name }))}</p>`).join("");
        el.querySelectorAll("[data-ia]").forEach(b => b.addEventListener("click", () => { handIn(b.dataset.ia); render(el); }));
    };
    cm.addContact({ id: "crimeIA", icon: "🕵️", name: M.ia.replace(/^🕵️\s*/, ""), tag: M.iaTag, color: "#37474F", render });
}
on("boot", wireIA);

/** For city hall (ci/cityhall): who's crooked, who's been exposed / hushed / paid. */
export const corruption = {
    who(id) { return Object.assign({ mood: "" }, SAVE.mem[id] || {}); },
    list() { return ["malka", "tuvia", "pinchas"].map(id => Object.assign({ id, name: WHO[id].name, mood: moodOf(id), evidence: hasEvidence(id) }, SAVE.mem[id] || {})); },
    get evidence() { return SAVE.evidence.map(e => Object.assign({}, e)); },
};
export { CR, onFoot };
