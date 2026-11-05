// features/law — the courtroom, as a 3D visual novel.
//
// ALL RISE → the judge (distractible, hungry, late for golf) and the prosecutor
// open, the gallery erupts on a serious case, retained counsel argues the
// actual charge → "And how do you plead, Ms. Bruck?" (three defenses + a plea
// bargain, prices on the buttons) → maybe an OBJECTION → maybe a courtroom
// EVENT (Avigail testifies — hostile, or FOR her once they're friends; Bubbe,
// Sister Fayge, Ima on the phone, the golf tee time, a MISTRIAL…) → the jury
// deliberates under a visible JURY MOOD meter → the verdict: dismissed / fine
// / jail, convictions and the 3-strikes rule, then out of the courthouse.
// Every line, number and odd from src/10d-jail-court.js.
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { models, cloneWithColors, findNodes, registerModels, ensureModels } from "../../models.js";
import { makeSet } from "../../core/sets.js";
import { wallet } from "../../core/save.js";
import { rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { PROSECUTOR_LINES, JUDGE_INTROS, OBJECTIONS, JUDGE_SUSTAIN, JUDGE_OVERRULE, COURT_REACTS, COURT_GALLERY_GUESTS,
    AVIGAIL_FRIEND_LINES, AVIGAIL_FRIEND_EVENT, COURT_EVENTS, COURT_MISTRIAL, DEFENSE_POOL, SPEAKERS } from "./data.js";
import { S, bump, rand, pick, clamp, bountyFor, worstCharge, courtDramaTier, pleaFineFor, bribeCostFor, deliberate, chargeCoins,
    lawyerChargeArgument, clearWanted, clearLockup, sentenceDays, stat } from "./rules.js";
import { Shot, V, runFlow, check, line, ask, person, lulu } from "./scene.js";
import { FORCE } from "./service.js";

registerModels({ lawCourt: "law_court", lawJudge: "law_judge", lawProsecutor: "law_prosecutor", lawLawyer: "law_lawyer", lawAbba: "law_abba" });
const COURT_KEYS = ["lawCourt", "lawJudge", "lawProsecutor", "lawLawyer", "lawAbba", "copPerson", "npcWoman", "npcMan", "npcKid",
    "avigailPerson", "hillelPerson", "imaPerson"];

// positions (three.js coords: x, y, z = Blender x, z, −y)
const POS = {
    judge: [0, 1.32, -6.6, 0], prosecutor: [3.25, 0, -0.35, Math.PI], lulu: [-3.25, 0, -0.35, Math.PI], lawyer: [-1.95, 0, -0.35, Math.PI],
    bailiff: [-5.7, 0, -3.6, Math.PI / 2], witness: [3.9, 0.3, -5.05, -Math.PI / 4], clerk: [-4.0, 0.06, -5.35, 0],
};
const SHOTS = {
    wide: [[0, 4.6, 10.5], [0, 1.9, -3.0], 50],
    judge: [[0.9, 2.25, -2.0], [0, 2.85, -6.6], 38],
    prosecutor: [[2.1, 1.75, -3.1], [3.25, 1.35, -0.35], 40],
    lulu: [[-2.1, 1.75, -3.1], [-3.25, 1.3, -0.35], 40],
    lawyer: [[-0.8, 1.75, -3.1], [-1.95, 1.35, -0.35], 40],
    bailiff: [[-3.3, 1.9, -1.4], [-5.7, 1.5, -3.6], 40],
    witness: [[1.5, 2.1, -2.1], [3.9, 1.9, -5.05], 40],
    jury: [[2.4, 2.1, 1.7], [6.4, 1.0, -1.0], 46],
    plead: [[-4.2, 2.1, 1.9], [-0.4, 2.3, -6.4], 46],
};

let C = null;
function build() {
    const set = makeSet({ light: "indoor", sky: "#2a1d16", shadows: true });
    set.hemi.intensity = 1.05;
    set.sun.position.set(-14, 12, -2); set.sun.target.position.set(0, 0, -2);
    set.sun.color.set("#ffe8c2"); set.sun.intensity = 1.9;
    Object.assign(set.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
    const warm = new THREE.PointLight("#ffd9a0", 14, 18, 1.3); warm.position.set(0, 4.6, -4.0); set.add(warm);
    const fill = new THREE.PointLight("#ffe7c4", 8, 16, 1.3); fill.position.set(0, 4.2, 2.5); set.add(fill);
    const room = cloneWithColors(models.lawCourt);
    set.add(room);
    const gavel = findNodes(room, "Gavel")[0];
    const P = (key, colors, fb = "npcMan") => { const p = person(key, colors, fb); set.add(p.obj); return p; };
    const place = (p, [x, y, z, r]) => { p.obj.position.set(x, y, z); p.obj.rotation.y = r; return p; };
    const judge = place(P("lawJudge"), POS.judge); judge.obj.scale.setScalar(1.08);
    const prosecutor = place(P("lawProsecutor"), POS.prosecutor);
    const bailiff = place(P("copPerson"), POS.bailiff);
    const clerk = place(P("npcWoman", { Top: "#B0BEC5", Hair: "#212121" }, "npcWoman"), POS.clerk);
    clerk.update(0.01, { sit: true });
    const me = place(lulu(true), POS.lulu);
    set.add(me.obj);
    // the jury (two rows of the jury box, facing the well)
    const TOPS = ["#E57373", "#64B5F6", "#81C784", "#FFD54F", "#BA68C8", "#4DB6AC", "#FF8A65", "#A1887F", "#90A4AE", "#F06292"];
    const HAIR = ["#3E2723", "#212121", "#8D6E63", "#D7CCC8", "#5D4037", "#E0C068"];
    const jurors = [];
    [[5.85, 0.07], [7.4, 0.52]].forEach(([x, y], row) => {
        for (let i = 0; i < 4; i++) {
            if (row === 1 && i === 3) continue;
            const key = (i + row) % 2 ? "npcWoman" : "npcMan";
            const j = place(P(key, { Top: pick(TOPS), Bottom: pick(["#37474F", "#263238", "#5D4037", "#283593"]), Hair: pick(HAIR) }, key), [x, y, 0.9 - i * 1.3, -Math.PI / 2]);
            j.update(0.01, { sit: true });
            jurors.push(j);
        }
    });
    // the gallery
    const crowd = [];
    for (let row = 0; row < 4; row++) {
        for (const side of [-1, 1]) {
            for (let k = 0; k < 3; k++) {
                if (Math.random() < 0.35) continue;
                const key = pick(["npcWoman", "npcMan", "npcMan", "npcWoman", "npcKid"]);
                const x = side * (2.2 + k * 1.7 + Math.random() * 0.4);
                if (row === 0 && side < 0 && k === 0) continue;   // the family seat
                const p = place(P(key, { Top: pick(TOPS), Hair: pick(HAIR) }, key), [x, 0.07, 3.0 + row * 1.7 - 0.05, Math.PI]);
                p.update(0.01, { sit: true });
                crowd.push(p);
            }
        }
    }
    C = { set, room, gavel, judge, prosecutor, bailiff, clerk, me, jurors, crowd, lawyer: null, witness: null, guest: null, shot: new Shot(set.camera) };
    return C;
}

// ── state ────────────────────────────────────────────────────────────────
let st = null, flow = null;
registerState("lawCourt", {
    hud: false, touch: false, pausable: true, world: false,
    enter(data) {
        UI.hideAll();
        st = { data, t: 0, speaker: null, gavel: 0, guestT: 0, guestCool: 0 };
        A.setMusic("../court.mp3");
        flow = runFlow(f => trial(f, data));
    },
    exit() {
        if (flow) flow.kill();
        flow = null;
        UI.hideAll();
        if (C) {
            C.set.hide();
            for (const k of ["lawyer", "witness", "guest"]) if (C[k]) { C.set.scene.remove(C[k].obj); C[k] = null; }
        }
        st = null;
    },
    update(dt, P) {
        if (!st) return;
        st.t += dt;
        if (flow) flow.tick(dt, P);
        if (!C || ctx.view !== C.set.view) return;
        animate(dt);
    },
});

function addFactor(court, label, amt) {
    court.lean = (court.lean || 0) + amt;
    court.factors.push({ t: label, a: amt });
    UI.juryMeter(court);
}
function bang(n = 1) {
    st.gavel = 0.45;
    X.gavel();
    if (n > 1) setTimeout(() => { if (st) { st.gavel = 0.45; X.gavel(); } }, 260);
    C.shot.shake = 0.5;
    rumble(0.3, 0.2, 90);
}
function shotFor(p) {
    const s = SHOTS[p] || (p === "lawyer" || p === "abba" ? SHOTS.lawyer : ["avigail", "bubbe", "fayge"].includes(p) ? SHOTS.witness : p === "guest" ? null : SHOTS.wide);
    if (p === "guest" && C.guest) { const g = C.guest.obj.position; C.shot.set(V(g.x + 1.0, 1.55, g.z - 2.6), V(g.x, 1.05, g.z), 42); return; }
    C.shot.set(V(...s[0]), V(...s[1]), s[2]);
}
async function say(f, p, text, opts = {}) {
    st.speaker = p;
    shotFor(p);
    const name = opts.name || (SPEAKERS[p] ? SPEAKERS[p].name : p.toUpperCase());
    await line(f, SPEAKERS[p] ? p : "lawyer", text, { name, emoji: opts.emoji });
    st.speaker = null;
}

function witnessFor(p) {
    if (C.witness && C.witness.p === p) return;
    if (C.witness) { C.set.scene.remove(C.witness.obj); C.witness = null; }
    let w = null;
    if (p === "avigail") w = person("avigailPerson", null, "npcWoman");
    else if (p === "fayge") w = person("npcWoman", { Top: "#26A69A", Bottom: "#37474F", Hair: "#4E342E" }, "npcWoman");
    else if (p === "bubbe" && models.bubbe) { const o = cloneWithColors(models.bubbe); w = { obj: o, update() {}, face() {}, static: true }; o.scale.setScalar(1.0); }
    else if (p === "bubbe") w = person("imaPerson", { Top: "#8E5CC2", Hair: "#D9D9DE" }, "npcWoman");
    if (!w) return;
    w.p = p;
    const [x, y, z, r] = POS.witness;
    w.obj.position.set(x, y, z); w.obj.rotation.y = r;
    C.set.add(w.obj);
    C.witness = w;
}
function guestPerson(p) {
    const map = { abba: ["lawAbba"], hillel: ["hillelPerson"], avigail: ["avigailPerson"], bubbe: ["imaPerson", { Top: "#8E5CC2", Hair: "#D9D9DE" }],
        raphael: ["npcMan", { Top: "#6D4C41", Hair: "#BDBDBD" }], fayge: ["npcWoman", { Top: "#26A69A", Hair: "#4E342E" }],
        yedidya: ["npcMan", { Top: "#F5F5F5", Hair: "#8D6E63" }], burry: ["npcMan", { Top: "#43A047", Hair: "#212121" }],
        shuey: ["npcMan", { Top: "#90CAF9", Hair: "#5D4037" }] };
    const [key, colors] = map[p] || ["npcMan"];
    if (p === "bubbe" && models.bubbe) { const o = cloneWithColors(models.bubbe); return { obj: o, update() {}, face() {}, static: true }; }
    return person(key, colors || null, "npcMan");
}

async function trial(f, data) {
    if (!COURT_KEYS.every(k => models[k])) {
        UI.caption("⚖️ COUNTY COURTHOUSE", "Court is now in session…");
        try { await ensureModels(COURT_KEYS); } catch (e) { console.warn("[law] court models", e); }
        check(f);
        UI.caption("");
    }
    if (!C) build();
    C.set.show();
    UI.fadeTo(false, 400);
    const cl = data.charges && data.charges.length ? data.charges.slice() : ["BEING SUSPICIOUS"];
    const tier = data.lawyer || null;
    const strk = Math.min(S.convictions, 5);
    // counsel at Lulu's side
    if (tier) {
        const lw = tier.free ? person("lawAbba", null, "npcMan") : person("lawLawyer", tier.colors || null, "npcMan");
        const [x, y, z, r] = POS.lawyer;
        lw.obj.position.set(x, y, z); lw.obj.rotation.y = r;
        C.set.add(lw.obj);
        C.lawyer = lw;
    }
    // family in the gallery, blurting support (or heckling)
    const gg = FORCE.guest ? COURT_GALLERY_GUESTS.find(g => g.p === FORCE.guest) : Math.random() < 0.5 ? pick(COURT_GALLERY_GUESTS) : null;
    const ggLines = gg ? (gg.p === "avigail" && S.avigailRel >= 65 ? AVIGAIL_FRIEND_LINES : gg.lines) : null;
    if (gg) {
        const g = guestPerson(gg.p);
        g.obj.position.set(-2.2, 0.07, 2.95); g.obj.rotation.y = Math.PI;
        if (g.update && !g.static) g.update(0.01, { sit: true });
        C.set.add(g.obj);
        C.guest = g;
        st.guest = { name: gg.name, lines: ggLines };
        st.guestT = 2.6; st.guestCool = rand(7, 11);
    }
    // the jury-mood meter starts with everything known walking in
    const court = { charges: cl, lean: 0, factors: [], threeStrikes: false, mistrial: false, dramaTier: courtDramaTier(cl) };
    st.court = court;
    if (strk >= 2) { court.threeStrikes = true; addFactor(court, `⚖️ ${strk} strikes — no mercy`, -1.5); }
    else if (strk === 1) addFactor(court, "⚖️ a prior strike", -0.45);
    if (cl.length >= 4) addFactor(court, "📜 a LONG charge sheet", -0.4);
    if (tier) addFactor(court, `🤵 ${tier.name}`, 0.3 + (tier.mitig || 0) * 0.7);

    // ALL RISE
    C.shot.set(V(...SHOTS.wide[0]), V(...SHOTS.wide[1]), SHOTS.wide[2]).cut();
    UI.caption("⚖️ ALL RISE", "Court is now in session");
    await f.sleep(1.5, true);
    check(f);
    UI.caption("");
    bang(court.dramaTier >= 2 ? 2 : 1);

    const tierD = court.dramaTier, worst = worstCharge(cl), listStr = cl.join(", "), more = cl.length > 1;
    const flourish = tierD >= 3 ? ` ${worst}?! In all my YEARS — the most BRAZEN case of my CAREER!!${more ? " The FULL sheet: " + listStr + "." : " 😤"}`
        : tierD === 2 ? ` ${worst} — the sheer AUDACITY, your honor!${more ? " (Also: " + listStr + ".)" : ""}`
        : tierD === 1 ? ` The charges: ${listStr}.`
        : ` ...just ${listStr}. *barely looks up* 🥱`;
    await say(f, "judge", tierD >= 3 ? "A case like THIS in MY court?! *SLAMS gavel*" : pick(JUDGE_INTROS));
    if (tierD >= 3) bang(2);
    await say(f, "prosecutor", pick(PROSECUTOR_LINES) + flourish);
    if (tierD >= 2) {
        crowdUproar(2.5);
        await say(f, "bailiff", "*the gallery ERUPTS — gasps, boos, a dropped kugel* 😱");
        bang(2);
        await say(f, "judge", "ORDER! ORDER!! One more outburst and I CLEAR this courtroom! 🔨");
    } else if (tierD === 1) {
        await say(f, "bailiff", "*a low murmur ripples through the gallery* 🤫");
    }
    if (tier) {
        const nm = tier.name.toUpperCase(), emo = tier.free ? "👨" : "🤵";
        await say(f, tier.free ? "abba" : "lawyer", pick(tier.says), { name: nm, emoji: emo });
        await say(f, tier.free ? "abba" : "lawyer", lawyerChargeArgument(tier, cl), { name: nm, emoji: emo });
    }

    // how do you plead?
    const pool = DEFENSE_POOL.slice(), opts = [];
    for (let k = 0; k < 3 && pool.length; k++) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const pleaFine = pleaFineFor(cl), bribeCost = bribeCostFor();
    opts.push({ label: "🤝 Plea bargain", says: "Fine, fine — I'll take the DEAL, your honor. 🤝", plea: true, cost: pleaFine });
    const labels = opts.map(o => o.plea ? `${o.label} <small>(💰${o.cost} fine, no strike)</small>` : o.bribe ? `${o.label} <small>(costs 💰${bribeCost})</small>` : o.label);
    st.speaker = "judge";
    C.shot.set(V(...SHOTS.plead[0]), V(...SHOTS.plead[1]), SHOTS.plead[2]);
    const pickI = await ask(f, "judge", `And how do you plead, Ms. Bruck? (💰 ${wallet.coins.toLocaleString()} coins)`, labels);
    st.speaker = null;
    const opt = Object.assign({}, opts[pickI], opts[pickI].bribe ? { cost: bribeCost } : {});
    X.blip("lulu");
    await say(f, "lulu", opt.says);

    // the prosecutor sometimes leaps up to OBJECT before the ruling
    if (!FORCE.quietCourt && Math.random() < 0.5) {
        const sustain = Math.random() < 0.5;
        if (sustain) addFactor(court, "🚫 objection SUSTAINED", -0.5); else addFactor(court, "✅ objection overruled", 0.4);
        X.gavel();
        UI.caption("OBJECTION!");
        await say(f, "prosecutor", pick(OBJECTIONS));
        UI.caption("");
        await say(f, "judge", pick(sustain ? JUDGE_SUSTAIN : JUDGE_OVERRULE));
    }

    // ~40% (more for worse crimes) a courtroom EVENT interrupts
    const evChance = clamp(0.32 + 0.16 * tierD, 0.32, 0.9);
    if (FORCE.event || (!FORCE.quietCourt && Math.random() < evChance)) {
        let ev = await playEvent(f, court, FORCE.event ? [...COURT_EVENTS, COURT_MISTRIAL].find(e => e.id === FORCE.event) : null);
        if (tierD >= 2 && !FORCE.event && Math.random() < 0.55) {
            let e2 = pickEvent(), guard = 0;
            while (e2.id === ev.id && guard++ < 6) e2 = pickEvent();
            bang(2);
            ev = await playEvent(f, court, e2);
        }
    }
    if (C.witness) { C.set.scene.remove(C.witness.obj); C.witness = null; }

    // the jury deliberates
    st.speaker = "jury";
    shotFor("jury");
    UI.caption("🤔 The jury deliberates…");
    UI.bubble("react", C.jurors[2] ? C.jurors[2].obj : C.judge.obj, pick(COURT_REACTS), { y: 1.7, sec: 1.8 });
    await f.sleep(1.9);
    check(f);
    UI.caption("");
    st.speaker = null;

    // ── the verdict ──
    const strikes = S.convictions;
    let verdict, fine = 0, vt, bribeFlop = false;
    if (opt.plea) {
        verdict = "fine";
        fine = opt.cost;
        vt = `Deal accepted. Reduced to a 💰${fine} fine. Don't make me regret it. 🤝`;
    } else {
        if (tier && Math.random() < (tier.blunder || 0)) addFactor(court, "🤦 counsel BLUNDERED", -(0.45 + (tier.mitig || 0) * 0.7));
        verdict = deliberate(court, opt);
        if (opt.bribe) {
            chargeCoins(opt.cost || 50);
            if (Math.random() < 0.6) verdict = "dismissed";
            else { bribeFlop = true; verdict = "fine"; }
        }
        if (FORCE.verdict) { verdict = FORCE.verdict; bribeFlop = false; }
        if (verdict === "fine") fine = bribeFlop ? Math.max(8, Math.round(bountyFor(court.charges) * 0.3)) : bountyFor(court.charges);
        if (verdict !== "dismissed") bump("convictions", 1);
        else stat("dismissed", 1);
        vt = bribeFlop ? `Hmph — THAT'S your offer? Just a small fine then. Now scram. 😒 (💰${fine})`
            : verdict === "dismissed" ? (opt.bribe ? "Case... 'dismissed.' *quietly pockets the envelope* 🤫" : "CASE DISMISSED! Now get outta my court. 🎉")
            : verdict === "jail" ? (strikes >= 2 ? "THREE STRIKES! You're doing HARD time! ⛓️" : "GUILTY! Off to the clink, missy! ⛓️")
            : `GUILTY! That'll be 💰${fine}. See the clerk on your way out. 💸`;
    }
    bang(1);
    if (verdict === "dismissed") X.triumphant(); else X.wompWomp();
    const big = verdict === "dismissed" ? "⚖️ CASE DISMISSED! 🎉" : verdict === "jail" ? (strikes >= 2 && !opt.plea ? "⛓️ THREE STRIKES!" : "⛓️ GUILTY!") : "💸 GUILTY — FINED";
    st.verdict = verdict;
    UI.caption(big);
    if (verdict === "dismissed") crowdUproar(3, true);
    await say(f, "judge", vt);
    // consequence
    let paid = 0, couldnt = false;
    if (verdict === "fine") {
        couldnt = fine > wallet.coins;
        paid = chargeCoins(fine);
        X.coins();
    }
    emit("law:verdict", { verdict, fine, paid, charges: court.charges, plea: !!opt.plea });
    UI.caption(big, verdict === "fine" ? (couldnt ? `Couldn't cover it all — paid 💰${paid}` : `Paid 💰${paid}`) : verdict === "jail" ? `${sentenceDays()} days · car impounded` : "Free to go!");
    await f.sleep(1.6, true);
    check(f);
    UI.caption("");
    clearWanted();                      // she's answered to a judge — the slate is clean
    if (verdict !== "jail") clearLockup();
    UI.fadeTo(true, 500);
    await f.sleep(0.55);
    check(f);
    UI.fadeTo(false, 400);
    if (verdict === "jail") { setState("lawJail", { serve: { days: 0, total: sentenceDays() }, sResume: data.sResume }); return; }
    setState("lawExit", { kind: "court", dest: "drive", caption: verdict === "dismissed" ? "⚖️ DISMISSED — free to go!" : "💸 Fine paid. Drive safer!", sResume: data.sResume });
}

function pickEvent() { return Math.random() < 0.10 ? COURT_MISTRIAL : pick(COURT_EVENTS); }
async function playEvent(f, court, forced) {
    let ev = forced || pickEvent();
    // a befriended Avigail's "surprise witness" moment flips to HELPING her
    if (ev.id === "avigail" && S.avigailRel >= 65) ev = AVIGAIL_FRIEND_EVENT;
    if (ev.nudge === "dismiss") { court.mistrial = true; addFactor(court, "💥 MISTRIAL!", 2); }
    else if (ev.nudge === "help") addFactor(court, "💞 the court is CHARMED", 0.55);
    else if (ev.nudge === "hurt") addFactor(court, "😤 the court is ANNOYED", -0.55);
    if (ev.charge && !court.charges.includes(ev.charge)) court.charges.push(ev.charge);
    const id = ev.id;
    if (id === "phone") X.ringRing(); else if (id === "mistrial") X.triumphant(); else if (id === "gasp") { X.gasp(); crowdUproar(2); }
    else if (id === "avigail") X.ominous(); else if (id === "bubbe") X.chime(); else X.blip("judge");
    if (court.dramaTier >= 2) bang(1);
    for (const ln of ev.lines) {
        if (["avigail", "bubbe", "fayge"].includes(ln.p)) witnessFor(ln.p);
        await say(f, ln.p, ln.text, { name: ln.who });
    }
    return ev;
}

let uproarT = 0, cheer = false;
function crowdUproar(sec, happy = false) { uproarT = sec; cheer = happy; }

// ── animation ────────────────────────────────────────────────────────────
function animate(dt) {
    const sp = st.speaker;
    C.judge.update(dt, { talk: sp === "judge" });
    C.judge.face(C.me.obj.position.x * 0.5, 4, dt, 2);
    C.prosecutor.update(dt, { talk: sp === "prosecutor", point: sp === "prosecutor" && st.t % 4 < 2 });
    C.bailiff.update(dt, { talk: sp === "bailiff" });
    C.me.update(dt, { talk: sp === "lulu", cheer: st.verdict === "dismissed" });
    if (C.lawyer) C.lawyer.update(dt, { talk: sp === "lawyer" || sp === "abba", point: (sp === "lawyer" || sp === "abba") && st.t % 3 < 1.2 });
    if (C.witness && !C.witness.static) { C.witness.update(dt, { talk: sp === C.witness.p }); }
    if (C.guest && !C.guest.static) C.guest.update(dt, { sit: true, talk: st.guestT > 0 });
    // the jury reacts while deliberating
    if (sp === "jury") for (const j of C.jurors) j.update(dt, { sit: true, talk: true });
    // uproar: the gallery jumps up and down
    if (uproarT > 0) {
        uproarT -= dt;
        for (const p of C.crowd) p.update(dt, { sit: !cheer && uproarT < 0.2, cheer: cheer || Math.sin(st.t * 3 + p.obj.position.x) > 0.3 });
        if (uproarT <= 0) for (const p of C.crowd) p.update(0.01, { sit: true });
    }
    // the gavel
    if (C.gavel) {
        st.gavel = Math.max(0, st.gavel - dt);
        const k = st.gavel > 0 ? Math.sin((1 - st.gavel / 0.45) * Math.PI) : 0;
        C.gavel.rotation.z = k * 1.0;
    }
    // the gallery guest blurts now and then
    if (st.guest) {
        if (st.guestT > 0) {
            if (!st.guestShown) { st.guestShown = true; UI.bubble("guest", C.guest.obj, pick(st.guest.lines), { who: st.guest.name, y: 1.45, sec: 2.6 }); }
            st.guestT -= dt;
        } else {
            st.guestShown = false;
            st.guestCool -= dt;
            if (st.guestCool <= 0) { st.guestT = 2.6; st.guestCool = st.court && st.court.dramaTier >= 2 ? rand(4, 7) : rand(8, 13); }
        }
    }
    C.shot.update(dt, 2.6);
    UI.updateBubbles(C.set.camera);
}
