// ─────────────────────────────────────────────────────────────────────────
//  features/moves — 🏁 MOVES & TRICKS: a skill ceiling. Easy to play, hard to
//  master: nothing here is required, every move is discoverable by just playing
//  (the handbrake was always "drift"), and each pays more the cleaner it's done.
//
//   drive.js   🌀 drift boost (3 spark tiers → mini-turbo) · 🚀 rocket start ·
//              💨 slipstream / slingshot · 😎 close shaves + the wrong lane ·
//              ↩️ bootlegger · 🚓 PIT maneuver on cruisers
//   air.js     🛹 air tricks on play's ramps: flips (stick ↑↓), barrel rolls
//              (handbrake + steer), play's spins — land straight for a turbo
//   foot.js    🤸 dodge roll · 🏃‍♀️ sprint slide · 🧗‍♀️ vault (one button, i-frames vs cars, MATADOR)
//   common.js  the STYLE COMBO (chain moves inside 3 s; drifting, drafting and the
//              wrong lane are LINKS that hold it open; it banks score × multiplier +
//              nitro + coins from ×3; a crash loses it), the one pooled HUD callout,
//              sparks straight into car.fx, the save, the move list + mastery stars
//   page.js    the 🏁 Moves tab in 📒 Lulu's Scrapbook (how-tos per device, stars,
//              bests, the ON/OFF switch) + the button guide rows
//
//  Moves are skill, not chance — deterministic per player — so they stay ON in a 🎉
//  party. In ?test runs they're off unless a test opts in (&enable=moves), so other
//  features' numbers don't move under them.
//
//  Service: ctx.moves (see ARCHITECTURE.md). Events: moves:move {id, pts, combo, mult} ·
//  moves:bank {n, mult, pts, total, coins, why} · moves:break {n, mult, why} ·
//  moves:turbo {tier, src} · moves:drift {on, dir | tier} · moves:pit {car} · moves:air {tricks, clean…}
//  Stats (shared save.stats): moves3d, movesTurbo1/2/3, movesPerfectStart, movesSlingshot,
//  movesBootleg, movesPit, movesAirTricks, movesCombo3, best movesCombo.
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook } from "../../core/ctx.js";
import {
    S, C, MOVES, MOVE, live, addMove, keepAlive, bank, breakCombo, reset, tickCombo, tickCallout, hideCallout,
    starsOf, callout, calloutInfo, WINDOW, PERF, LOG,
} from "./common.js";
import { D, T, R, DR, W, B, TUNE, turbo } from "./drive.js";
import { X, AIR, airBotched } from "./air.js";
import { FOOT, footMove, footInfo } from "./foot.js";
import "./page.js";

const PLAYING = new Set(["playing", "footRun"]);

ctx.moves = {
    /** Moves are on (the Moves page switch; and in tests only with &enable=moves). */
    get on() { return live(); },
    set on(v) { S.on = !!v; if (!v) { reset(); hideCallout(); } },
    /** The live style combo: { n, pts, mult, t (s left), distinct, kinds }. */
    combo: C,
    /** Another feature can feed the combo (a cab fare's stunt, a dance-off…): addMove(id, pts, label, {color, foot}). */
    addMove, keepAlive, bank, break: breakCombo,
    turbo,                 // turbo(tier 1–3, src) — a mini-turbo
    airBotched,            // play's touchdown asks: landing now would botch a flip / roll?
    footMove,              // start the on-foot move now (roll / slide / vault) → bool
    list: MOVES,
    stars: id => (MOVE[id] ? starsOf(MOVE[id]) : 0),
    save: S,
    /** Open the 🏁 Moves page (in the scrapbook). from: "title" | "pause". */
    openPage(from = "title") { if (ctx.meta && ctx.meta.openScrapbook) ctx.meta.openScrapbook(from, "moves"); },
    get drifting() { return D.on; },
    get driftTier() { return D.on ? D.tier : 0; },
    get turboLeft() { return T.left; },
    debug: { D, T, R, DR, W, B, X, TUNE, AIR, FOOT, WINDOW, PERF, LOG, foot: footInfo, callout: calloutInfo },
};

// the 3D badges (meta's scrapbook): challenges for the keen
on("boot", () => {
    if (!ctx.meta || !ctx.meta.addBadge) return;
    const st = (s, id) => (s.stats && s.stats[id]) || 0, stB = (s, id) => (s.stats && s.stats.best && s.stats.best[id]) || 0;
    const fams = ["drift", "rocket", "slingshot", "nearmiss", "air", "bootleg", "pit", "roll", "slide", "vault"];
    ctx.meta.addBadge({ id: "movesPurple", icon: "🟣", name: "Purple Reign", desc: "Fire 10 PURPLE drift turbos in 3D", prog: s => [st(s, "movesTurbo3"), 10] });
    ctx.meta.addBadge({ id: "movesStyle", icon: "🔗", name: "Style Icon", desc: "Bank a ×6 style combo in 3D", prog: s => [stB(s, "movesCombo"), 6] });
    ctx.meta.addBadge({ id: "movesAll", icon: "🎬", name: "Stunt Double", desc: "Pull off all 10 moves (📒 › 🏁 Moves)", prog: () => [fams.filter(f => (S.n[f] || 0) > 0).length, 10] });
});

// one tick per frame while a HUD is up: the combo window + the callout's fade
hook("hud", dt => {
    if (ctx.paused) return;
    if (PLAYING.has(ctx.state)) tickCombo(dt);
    tickCallout(dt);
});

on("state", ({ from, to }) => {
    if (PLAYING.has(to) || to === "wrecked") return;
    if (PLAYING.has(from) && C.n > 0) bank("scene");      // pulled in somewhere / a cutscene: bank it cleanly
    if (!ctx.states[to] || !ctx.states[to].hud) hideCallout();
});
on("run:start", () => { reset(); hideCallout(); });
on("title", () => { reset(); hideCallout(); });
on("foot:start", () => { if (C.n > 0) keepAlive(WINDOW); });      // climbing out mid-combo doesn't kill it
