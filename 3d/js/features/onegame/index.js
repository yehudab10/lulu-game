// ─────────────────────────────────────────────────────────────────────────
//  features/onegame — 🎮 ONE GAME, NOT A MENU OF MODES (roadmap 10)
//
//  The owner (2026-11-20): "Too many modes is too confusing for most players. I'd rather the main
//  thing be the open world." So the title has ONE big ▶ PLAY (the open world: a "cruise" run that
//  starts at home on foot — core/screens.js) + two small tiles (👯 Friends · 👧 Dina), and the old
//  modes are things you START FROM INSIDE THE WORLD, and that END BACK IN IT:
//
//   🧳 THE ROAD TRIP (the Story Trip, "The Road to Vegas") — a suitcase by the car in the driveway
//      ("✋ ROAD TRIP TO VEGAS — continue: 🏖️ The Beach"), and the 📱 phone's 🗺️ Map (tap a stop).
//      Leg 1 starts right where she stands at home (Ima's story line, then the car); a later leg is a
//      soft cut to that leg's start, rolling (no 3-2-1). "Call it a trip" / the trip card → back home.
//      The journey engine is unchanged: it's still its own run type (G.mode "story") with the same saves.
//   🅿️ THE PARKING CHALLENGE — PLAYED on a real lot: the course in every rest area's truck lot (features/parking:
//      pull into the START box by the attendant and it begins, no cut). The booth's ✋ (on foot) unlocks it (1,000 💰,
//      once) and the 📱 💼 Jobs card marks the course (a light) — neither moves her anywhere.
//   🕯️ THE EREV SHABBOS RUSH — on a real Friday afternoon it's what Ima asks for at the door; getting in
//      the car starts it (features/shabbos `atDoor`). Walk away instead and it's an ordinary day.
//   👧 DINA — ✋ on Dina on the porch step → "Play as Dina" (her mode itself is untouched); picking
//      Lulu again on her picker walks you back out of the front door (features/dina `ret`).
//   🏠 BACK HOME — ctx.onegame.home(): a soft cut to Lulu on foot at her porch (a fresh open-world run).
//      Every "⌂ Title screen" a mode used to end on is "🏠 Head home" now; the pause menu still has the title.
//
//  Service: ctx.onegame { home(opts), roadTrip(via, leg?), tripBlock(), parking(via), dina(), info(), debug }
//  Events:  onegame:home {via} · onegame:trip {via, leg} · onegame:parking {via} · onegame:dina {}
//  Stats (3D save "onegame"): trips, booth, dina, homes. Nothing here pays coins.
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, hook, setState, pick } from "../../core/ctx.js";
import { store, saveSoon, shared, wallet } from "../../core/save.js";
import { startRun } from "../../core/driving.js";
import { dissolve } from "../../core/transition.js";
import { resume } from "../../core/screens.js";
import { choose, say } from "../../core/dialog.js";
import { input, glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { home } from "../world/home.js";
import { STOPS, N_STOPS } from "../journey/data.js";
import { storySub } from "../journey/index.js";
import { partyOn, esc } from "../phone/ui.js";
import { JOB_EXTRAS } from "../phone/apps.js";
import { ensureModels } from "../../models.js";
import { UNLOCK_COST, parkBlock as parkBlockOf } from "../parking/index.js";

const OG = store("onegame", { trips: 0, booth: 0, dina: 0, homes: 0 });
const solo = () => !(ctx.party && ctx.party.active) && !(ctx.G && ctx.G.mode === "party");
const v1 = new THREE.Vector3();

// ── 🏠 back home: a fresh open-world run, on foot at her porch ───────────
const BACK = {
    any: ["Back already? Good. Now go DO something! 💕", "Mamele! You're home! ...You're leaving again, aren't you."],
    trip: ["Back from the road! Bubbe says you drive like a MANIAC. 💕", "You're home! Did you eat? You didn't eat."],
    dina: ["Dina says you're 'no fun'. I said you're DRIVING. Go!", "Thank you for playing with your sister, mamele. 💕"],
    parking: ["Parking, schmarking. Can you park in MY driveway?"],
    shabbos: ["Good Shabbos, mamele! Next week — leave EARLIER. 🕯️"],
};
/** Back in the world at home, on foot. opts: { via, line, camBlend (glide instead of a soft cut) }. */
function goHome(opts = {}) {
    const via = opts.via || "";
    if (ctx.paused) resume();
    H.hideScreen();
    OG.homes++; saveSoon();
    emit("onegame:home", { via });
    const line = opts.line != null ? opts.line : pick(BACK[via] || BACK.any);
    const run = () => startRun({ mode: "cruise", home: true, homeLine: line, camBlend: opts.camBlend || 0 });
    if (opts.camBlend) run(); else dissolve(run, { ms: 650 });
    return true;
}

// ── 🧳 the road trip ─────────────────────────────────────────────────────
/** Why the road trip can't start right now ("" = it can). */
function tripBlock() {
    if (!ctx.journey || !ctx.journey.start) return "No road trip in this build";
    if (!solo()) return "The road trip is a solo thing — leave the party first 🎉";
    const G = ctx.G || {};
    if (G.mode === "story" && !G.jDone && G.started && !G.ended) return "You're ON the road trip! Next stop's up the road 🚗";
    if (ctx.shabbos && ctx.shabbos.active) return "Candles first — Bubbe's waiting! 🕯️";
    if (ctx.law && (ctx.law.chasing || (ctx.law.wanted || 0) > 0)) return "Lose the cops first 🚓";
    if (ctx.hustle && ctx.hustle.job) return "Finish the job first 💼";
    return "";
}
const nextLeg = () => (shared.get().storyStop || 0) % N_STOPS;
function nearHome(r = 14) {
    const P = home.park;
    return !!(home.ready && P && Math.hypot(ctx.car.pos.x - P.x, ctx.car.pos.z - P.z) < r);
}
/** Start the road trip (the Story Trip) from inside the world: leg 1 at home, a later leg rolling at its start. */
function roadTrip(via = "suitcase", leg = null) {
    const why = tripBlock();
    if (why) { H.toast(why, "red"); return false; }
    const L = leg == null ? nextLeg() : Math.max(0, Math.min(N_STOPS - 1, leg | 0));
    // (standing at home: leg 1 starts right here — no walk back to the porch)
    const F = ctx.foot;
    const here = L === 0 && ctx.state === "footRun" && F && F.active && nearHome(16) ? { x: ctx.car.pos.x, z: ctx.car.pos.z, face: ctx.foot.facing } : null;
    OG.trips++; saveSoon();
    emit("onegame:trip", { via, leg: L });
    if (ctx.paused) resume();
    H.hideScreen();
    const go = () => ctx.journey.start(L, L === 0 ? { home: true, homeAt: here, camBlend: here ? 0.5 : undefined } : { rolling: true });
    // (standing at home, or on the title for leg 1: the camera just glides — the same place)
    if (here || (L === 0 && ctx.state === "title")) go(); else dissolve(go, { ms: 650 });
    return true;
}

// a later leg (or a road-trip leg from the 📱): already rolling, no 3-2-1 (ARCHITECTURE › Flow)
hook("runStart", (G, opts) => {
    if (!opts || !opts.rolling || G.introStart) return;
    G.introStart = () => rollingStart();
}, -120);
function rollingStart() {
    const G = ctx.G, car = ctx.car, sp = 15;
    car.vx = Math.sin(car.h) * sp; car.vz = Math.cos(car.h) * sp;
    G.invT = Math.max(G.invT || 0, 2.5); G.invSoft = true;
    H.setBoost(G.boost, input.device === "touch" ? "" : glyph("boost"));
    if (!G.musicSet) A.setMusic(G.music || "../luludriving.mp3");
    H.banner(`<b>On the road!</b>${G.goText ? `<small>${G.goText}</small>` : ""}`, 1600, { key: "countdown" });
    setState("playing");
    return true;
}

// the suitcase: by the car in the driveway (a little pink case with a gold ring round it)
const SC = { obj: null, ring: null, pos: new THREE.Vector3(), built: false };
function buildSuitcase() {
    if (SC.built || !home.ready || !home.park || !home.group) return;
    SC.built = true;
    const P = home.park, fx = Math.sin(P.h), fz = Math.cos(P.h), lx = Math.cos(P.h), lz = -Math.sin(P.h);
    // the passenger side, by the rear wheel (the driver's door is where she hops in)
    SC.pos.set(P.x - lx * 1.75 - fx * 1.35, 0, P.z - lz * 1.75 - fz * 1.35);
    const g = new THREE.Group();
    g.name = "OneGameSuitcase";
    const pink = new THREE.MeshStandardMaterial({ color: "#FF5FA2", roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: "#8E2456", roughness: 0.7 });
    const gold = new THREE.MeshStandardMaterial({ color: "#FFD54F", roughness: 0.4, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.26), pink);
    body.position.y = 0.42; body.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.28), dark);
    band.position.y = 0.42;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 14, Math.PI), dark);
    handle.position.y = 0.76;
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.02), gold);
    tag.position.set(0.12, 0.6, 0.14); tag.rotation.z = 0.25;
    const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), dark);
    w1.rotation.z = Math.PI / 2; w1.position.set(-0.17, 0.05, 0);
    const w2 = w1.clone(); w2.position.x = 0.17;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 28), new THREE.MeshBasicMaterial({ color: "#FFD54F", transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    g.add(body, band, handle, tag, w1, w2, ring);
    g.position.copy(SC.pos);
    g.rotation.y = P.h + 0.5;
    home.group.add(g);
    SC.obj = g; SC.ring = ring;
}
function suitcaseTick() {
    if (!SC.obj) return;
    const show = solo() && !!(ctx.journey && ctx.journey.start);
    SC.obj.visible = show;
    if (!show) return;
    const k = 1 + Math.sin(ctx.time * 3) * 0.07;
    SC.ring.scale.set(k, k, k);
    SC.ring.visible = ctx.state === "footRun" && !(ctx.G.mode === "story");
}
const suitcaseSpot = {
    r: 1.5,
    pos: () => (SC.obj && SC.obj.visible && ctx.state === "footRun" && ctx.G.mode !== "story" && nearHome(9) ? SC.pos : null),
    label: () => {
        const L = nextLeg(), st = STOPS[L];
        return `🧳 ROAD TRIP TO VEGAS — ${L === 0 && !(shared.get().storyCycle || 0) ? "first stop" : "continue"}: ${st.icon} ${st.name}`;
    },
    short: "ROAD TRIP",
    act: () => roadTrip("suitcase"),
};

// ── 👧 Dina on the porch step ────────────────────────────────────────────
const DS = { r: 1.6 };
const dinaSpot = {
    r: 1.6,
    pos: () => {
        const d = home.people.dina;
        if (!d || !d.obj.visible || ctx.state !== "footRun" || !solo() || !(ctx.dina && ctx.dina.start) || !nearHome(40)) return null;
        dinaSpot.r = DS.r;
        return d.obj.getWorldPosition(v1);
    },
    label: "👧 PLAY AS DINA",
    short: "DINA",
    act: () => playDina(),
};
function playDina() {
    if (!ctx.dina || !ctx.dina.start || !solo()) return false;
    OG.dina++; saveSoon();
    emit("onegame:dina", {});
    if (ctx.foot && ctx.foot.say && home.people.dina) ctx.foot.say(home.people.dina.obj, pick(["YAY! My turn! 🎉", "Lulu! Watch me, watch me!", "Race you home from the bus! 🚌"]), 1.6, { y: 1.3 });
    ctx.dina.start({ ret: "world" });
    return true;
}
// (the spot's range: never reaches her starting spot at the bottom of the steps — no accidental ✋ at the start)
function tuneDinaRange() {
    const d = home.people.dina, st = home.anchors && (home.anchors.steps || home.anchors.lulu);
    if (!d || !st) return;
    const p = d.obj.getWorldPosition(v1), gap = Math.hypot(p.x - st.x, p.z - st.z);
    DS.r = Math.max(0.9, Math.min(1.6, gap - 0.35));
}

// ── 🅿️ the parking booth: the attendant's booth stands at the Parking Challenge's course in every rest area's truck
// lot (features/parking/course.js — the challenge is PLAYED there, on the real lot). On foot, ✋ at the booth: the
// attendant unlocks it (once, 1,000 💰) and sends her for her car; in the car, pulling into the START box starts it. ──
const BT = { list: [] };
const liveBooths = () => (ctx.parking && ctx.parking.debug ? ctx.parking.debug.courses() : []);
const boothSpot = {
    r: 2.2,
    pos: () => {
        if (ctx.state !== "footRun" || !solo() || !(ctx.parking && ctx.parking.debug)) return null;
        const CO = ctx.parking.debug.CO;
        let best = null, bd = 9;
        for (const c of CO.liveCourses()) { const p = CO.boothPoint(c), d = Math.hypot(p.x - ctx.foot.pos.x, p.z - ctx.foot.pos.z); if (d < bd) { bd = d; best = p; } }
        boothSpot.cur = best;
        return best ? { x: best.x, z: best.z } : null;
    },
    label: () => parkingUnlocked() ? "🅿️ PARKING CHALLENGE — 10 levels" : `🅿️ PARKING CHALLENGE — 🔒 ${UNLOCK_COST.toLocaleString()} 💰`,
    short: "PARKING",
    act: () => boothTalk(),
};
const parkingUnlocked = () => !!shared.get().parkingUnlocked;
const ATT = { who: "Parking attendant", emoji: "🅿️", color: "#1565C0" };
let boothBusy = false;
async function boothTalk() {
    if (boothBusy) return;
    boothBusy = true;
    try {
        const o = { emoji: ATT.emoji, color: ATT.color };
        if (!parkingUnlocked()) {
            const have = wallet.coins;
            const i = await choose(ATT.who, `Ten levels of parallel parking — tighter spots, nosy cameras, cones, pedestrians… and Sasquatch. A one-time ${UNLOCK_COST.toLocaleString()} 💰 and it's yours forever.`,
                [have >= UNLOCK_COST ? `🔓 Unlock it — ${UNLOCK_COST.toLocaleString()} 💰` : `🔒 ${UNLOCK_COST.toLocaleString()} 💰 (you've got ${have.toLocaleString()})`, "🙅‍♀️ Not now"], o);
            if (i !== 0) return;
            if (!unlockParking()) { await say(ATT.who, "Come back with the coins, sweetheart. Jobs on the 📱 pay — and so do the levels, once you're in!", o); return; }
            await say(ATT.who, "Unlocked! Now go get your car and pull into the START box. Level one's a nice wide spot. …They get worse. 😬", o);
        } else {
            const best = shared.get().parkingBestLevel || 0;
            await say(ATT.who, best ? `Back for more? Your best is level ${best} of 10. Bring your car round — pull into the START box.` : "Ten levels. Three lives. No dents. Bring your car round and pull into the START box!", o);
        }
        startParking("booth");
    } finally { boothBusy = false; }
}
function unlockParking() {
    if (parkingUnlocked()) return true;
    return !!(ctx.parking && ctx.parking.debug && ctx.parking.debug.unlock());
}
/** Why the parking challenge can't start right now ("" = it can). */
function parkBlock() {
    if (!ctx.parking || !ctx.parking.start) return "No parking in this build";
    if (!["footRun", "playing", "parking"].includes(ctx.state)) return "Not right now";
    return parkBlockOf();
}
/** The challenge from inside the world: at a START box it begins; anywhere else the course is marked (a light). */
function startParking(via) {
    const why = parkBlock();
    if (why) { H.toast(why, "red"); return false; }
    if (!parkingUnlocked()) { H.toast(`🔒 Unlock the Parking Challenge first (${UNLOCK_COST.toLocaleString()} 💰)`, "red"); return false; }
    OG.booth++; saveSoon();
    if (ctx.paused) resume();
    ctx.parking.start({ challenge: true, from: via });
    return true;
}

// ── 📱 the phone (it stays one 3 × 3 screen — no new apps): the 🧳 road trip is the 🗺️ Map app (a stop launches that
// leg through roadTrip — journey/map.js), the 🅿️ Parking Challenge is a card at the bottom of 💼 Jobs ──
function parkHtml() {
    if (partyOn() || !(ctx.parking && ctx.parking.start)) return "";
    const s2 = shared.get(), unlocked = parkingUnlocked(), why = parkBlock();
    return `<div class="lp-card lp-park"><span class="lp-av">🅿️</span><span class="lp-tx"><b>Parking Challenge</b><small>${unlocked ? (s2.parkingBestLevel ? `best: level ${s2.parkingBestLevel} of 10` : "ten levels of parallel parking") : "ten levels · tighter spots, cameras, cones… Sasquatch"}</small></span></div>
        ${unlocked ? `<button class="btn lp-row" id="lpPark"${why ? " disabled" : ""}><span class="lp-av">📍</span><span class="lp-tx"><b>Show me the course</b><small>pull into the START box by the attendant</small></span>${why ? "" : '<span class="lp-meta lp-go">Go</span>'}</button>`
            : `<button class="btn lp-row" id="lpParkUnlock"><span class="lp-av">🔓</span><span class="lp-tx"><b>Unlock — ${UNLOCK_COST.toLocaleString()} 💰</b><small>once, forever · you have ${wallet.coins.toLocaleString()}</small></span></button>`}
        <p class="lp-fine">Every rest area has one — in the truck lot, by the garage.</p>
        ${why && unlocked ? `<p class="lp-note">${esc(why)}</p>` : ""}`;
}
JOB_EXTRAS.push({
    id: "parking",
    html: parkHtml,
    bind(el, api) {
        const p = el.querySelector("#lpPark");
        if (p) p.addEventListener("click", () => { const w = parkBlock(); if (w) { api.toast(w); return; } api.close(); startParking("phone"); });
        const u = el.querySelector("#lpParkUnlock");
        if (u) u.addEventListener("click", () => { if (unlockParking()) { api.toast("🅿️ Unlocked!"); api.refresh(); } else api.toast(`🔒 ${UNLOCK_COST.toLocaleString()} 💰 — jobs on the 📱 pay`); });
    },
});

// ── wiring ───────────────────────────────────────────────────────────────
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(suitcaseSpot); ctx.foot.addSpot(dinaSpot); ctx.foot.addSpot(boothSpot); }
    ensureModels(["npcMan"]).catch(() => {});
});
hook("hud", dt => {
    if (!SC.built) { buildSuitcase(); tuneDinaRange(); }
    suitcaseTick();
});
on("state", () => { if (!SC.built) { buildSuitcase(); tuneDinaRange(); } suitcaseTick(); });

// ── the service ──────────────────────────────────────────────────────────
ctx.onegame = {
    /** Back in the world at home, on foot (opts: { via, line, camBlend }). */
    home: goHome,
    /** The road trip from inside the world: via "suitcase" | "phone" | "map" | …; leg (default: the checkpoint). */
    roadTrip, tripBlock,
    /** The parking challenge from inside the world (via "booth" | "phone"). */
    parking: startParking, parkBlock,
    /** Dina from the porch. */
    dina: playDina,
    /** The road trip's line (next stop, leg, tour, postcard stamps) as html — the 📱 app, the tests. */
    tripLine: () => storySub(),
    info: () => ({ suitcase: !!(SC.obj && SC.obj.visible), booths: liveBooths().map(b => ({ s: b.s, x: b.x, z: b.z, attendant: b.attendant })), ...OG }),
    debug: { OG, SC, BT, suitcaseSpot, dinaSpot, boothSpot, unlockParking, nearHome },
};
