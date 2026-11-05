// features/law — COPS, PURSUITS, ARREST, JAIL & COURT (port of the 2D game's
// cop / copChase / copBust code in src/05-driving-loop.js and all of
// src/10d-jail-court.js).
//
//   cops.js     hidden speed traps, patrols, the pursuit (real 3D cruisers with
//               flashing light bars + a WebAudio siren), heat stars, K9 dogs,
//               cop missiles, the chopper, APB call-ins, warrants, the fugitive stretch
//   bust.js     the roadside pull-over (Lulu picks how to play it) + copStop
//   arrest.js   the arrest cinematic → haul to PRECINCT 18½
//   jail.js     booking, the cell (escape / bail / lawyer / court), lockpick,
//               jailbreak vignettes, serving the sentence, walking out
//   court.js    the courtroom visual novel (judge, prosecutor, bailiff, jury,
//               gallery, Avigail hostile/friendly), verdicts, 3 strikes
//   rules.js    bounty / bail / fees / verdict maths + the SHARED 2D save fields
//               (convictions, offenses, escapes, wanted, lockup)
//
// Provides ctx.law (see service.js) and emits cop:chase {active}, law:bust,
// law:arrest, law:booked, law:verdict, law:release, stat {escapes2, dismissed…}.
// Claims hooks.wreck at priority 30 only when a cop caused the wreck.
import { ctx, on, hook, setState, addMenuItem, MPH } from "../../core/ctx.js";
import * as H from "../../hud.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { L, update, hud, resetRunState, beginChase, endChase, copNear, startFugitive, endFugitive, prisonClothes, ensureCopModels, activeUnits,
    spawnTrap, spawnPatrol, spawnK9, fireMissile, ensureChopper } from "./cops.js";
import { jailDebug } from "./jail.js";
import { pullOver } from "./bust.js";
import "./arrest.js";
import "./jail.js";
import "./court.js";
import { S } from "./rules.js";
import { law, run, setPullOver } from "./service.js";
import { PEPPER_COP } from "./data.js";

ctx.law = law;
setPullOver(pullOver);
Object.assign(law._dbg, { spawnTrap, spawnPatrol, spawnK9, fireMissile, ensureChopper, startFugitive, jail: jailDebug });
for (const ev of ["cop:chase", "law:bust", "law:arrest", "law:booked", "law:verdict", "law:release", "stat"]) {
    on(ev, p => { const log = law._dbg.log; log.push(Object.assign({ ev }, p)); if (log.length > 80) log.shift(); });
}

const LAW_STATES = new Set(["lawBust", "lawStop", "lawArrest", "lawJail", "lawCourt", "lawExit"]);
const DRIVING = new Set(["playing", "intro", "wrecked", "arriving"]);

// ── boot: our cops replace the core's built-in parked speed traps ────────
on("boot", () => {
    ctx.world.config.speedTraps = false;
    ensureCopModels();   // the officer, K9, missile, chopper, billboard — small, loaded in the background
});

// ── run lifecycle ────────────────────────────────────────────────────────
hook("runStart", () => resetRunState());
on("run:start", ({ mode }) => {
    run.live = true;
    run.mode = mode || "cruise";
    const lk = S.lockup;
    if (lk && lk.mode === "fugitive") startFugitive(lk.fugT || 0);   // a refresh doesn't clear the heat
    else if (L.fug) endFugitive();
});
on("run:end", () => { run.live = false; });

hook("update", (dt, P, controlsOn) => update(dt, P, controlsOn));
hook("hud", () => hud());

let booted = false;
on("state", ({ to }) => {
    if (to === "title") {
        run.live = false;
        if (L.chase) endChase("quit");
        if (L.fug) { L.fug = null; prisonClothes(false); }
        UI.wantedHud(null);
        X.sirenOff();
        if (!booted) {
            booted = true;
            // an unfinished sentence survives a refresh (like the 2D lockup): drop her right back in
            const lk = S.lockup;
            if (lk && lk.mode === "cell") { run.mode = lk.mode3d || "cruise"; setState("lawJail", { resume: lk }); }
            else if (lk && lk.mode === "serving") { run.mode = lk.mode3d || "cruise"; setState("lawJail", { serve: { days: lk.days || 0, total: lk.total || 45, persisted: true } }); }
        }
        return;
    }
    booted = true;
    // a car chase never follows her into a minigame, an interior or on foot
    if (L.chase && !DRIVING.has(to) && !LAW_STATES.has(to)) endChase("left");
    if (!DRIVING.has(to)) UI.wantedHud(null);
    if (!DRIVING.has(to) && !LAW_STATES.has(to)) X.sirenOff();
});

// ── out of hearts: claimed ONLY when a cop caused it (priority 30) ───────
hook("wreck", info => {
    const src = String(info.source || "");
    const ch = L.chase;
    let charges = null;
    if (src === "cop") charges = ["DESTROYING A POLICE CRUISER", "RECKLESS DRIVING"];
    else if (src.startsWith("law:")) charges = L.fug ? ["ESCAPE FROM CUSTODY", "RESISTING ARREST"] : [ch ? ch.reason : "EVADING ARREST", "RESISTING ARREST"];
    else if (ch) {
        // wrecked mid-pursuit with a cruiser right on her tail: they've got her
        const p = ctx.car.pos;
        if (activeUnits().some(u => Math.hypot(u.car.x - p.x, u.car.z - p.z) < 45)) charges = [ch.reason, "RESISTING ARREST"];
    }
    if (!charges) return false;
    if (L.fug && !charges.includes("ESCAPE FROM CUSTODY")) charges.unshift("ESCAPE FROM CUSTODY");
    if (ch) for (const c of ch.charges) if (!charges.includes(c)) charges.push(c);
    setState("lawArrest", { charges });
    return true;
}, 30);

// ── pepper-spraying a cop is a one-way ticket downtown ───────────────────
on("item:use", e => {
    if (!e || e.id !== "pepper") return;
    const car = ctx.car;
    const x = e.x != null ? e.x : car.pos.x + Math.sin(car.h) * 8, z = e.z != null ? e.z : car.pos.z + Math.cos(car.h) * 8;
    if (!copNear(x, z, 14)) return;
    UI.say(PEPPER_COP, "red");
    law.arrest(["ASSAULTING AN OFFICER", "PEPPER-SPRAYING A COP"]);
});

// ── hit and run (only if a cop SEES it) ──────────────────────────────────
on("crash", e => {
    if (!e || ctx.state !== "playing" || L.grace > 0) return;
    const kind = String(e.kind || "");
    if (!/ped|person|walker|hitch|kid|jogger|crossing|guard/i.test(kind)) return;
    const p = ctx.car.pos;
    if (!copNear(p.x, p.z, 70)) return;
    if (ctx.car.speed * MPH > 45 && ctx.G.invT <= 0) law.arrest(["HIT AND RUN", "RECKLESS ENDANGERMENT"]);
    else beginChase("RECKLESS ENDANGERMENT", { msg: "🚨 BUSTED!" });
});

// ── the jumpsuit survives a skin change ──────────────────────────────────
on("skin", () => { if (L.fug) prisonClothes(true); });

// ── title card: open warrants / fugitive status ──────────────────────────
addMenuItem("titleInfo", {
    id: "law",
    label: () => {
        const lk = S.lockup;
        if (lk && lk.mode === "fugitive") return `<p class="fine" style="opacity:.95;color:#E65100"><b>🔒 You're a FUGITIVE — cops will recognise the jumpsuit!</b></p>`;
        const w = S.wanted;
        if (w.length) return `<p class="fine" style="opacity:.9;color:#B71C1C"><b>⚠️ Open warrants:</b> ${w.slice(0, 2).join(", ")}${w.length > 2 ? ` +${w.length - 2}` : ""}</p>`;
        return "";
    },
});

export { law };
