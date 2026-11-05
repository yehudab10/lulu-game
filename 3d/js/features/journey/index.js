// features/journey — THE STORY TRIP: Lakewood → Bubbe's house → Heshy's pool →
// the beach → Avigail's place → Viva Vegas, on one continuous road (2D distances
// scaled ≈11.7 px per metre; ×1.5 per tour). Ported from src/05a-journey.js,
// src/05b-ima-call.js, the story map/menu in src/06-screens.js and
// storySpawnBias in src/01b-spawn-tuning.js.
//
//   data.js   the script: stops, tasks, greetings, beats, calls, interludes, boons, Ima's lines
//   state.js  per-run helpers (layout ×1.5 per tour, current leg, progress, regions, heat)
//   env.js    the world per leg: biomes, sky/lights, sand, the ocean, set pieces, gates, signs, neon
//   phone.js  ctx.phone (the in-car phone UI) + IMA IS CALLING
//   trip.js   legs, chapter tasks + HUD chip, arrivals, rewards, postcards, checkpoints, boons, ctx.journey
//   story.js  story calls, mid-leg interludes, scripted road events, beach gear, ambience
//   map.js    THE ROAD TO VEGAS story map (3D diorama + controller menu)
//
// Services: ctx.journey { stop(), stopIndex, mode, spawnBias(name), stopS(i), start(i), openMap(), task, progress }
//           ctx.phone   { call(opts), text(opts), active, talking, busy(), hangUp() }
// Events:   journey:leg {index, stop}, journey:arrive {index, stop, reward, storyComplete, taskMet},
//           journey:event {index, id}, journey:region {key, leg}, phone:ring/answer/end, stat (imaCalls, imaDeclines, stops3d, tours3d)
import { ctx, on, addMenuItem, css } from "../../core/ctx.js";
import { save3d, shared } from "../../core/save.js";
import { startRun } from "../../core/driving.js";
import { glyph } from "../../input.js";
import { STOPS, N_STOPS } from "./data.js";
import "./env.js";
import "./phone.js";
import { startStory, J } from "./trip.js";
import { debug as storyDebug } from "./story.js";
import { openMap } from "./map.js";
import { imaCall } from "./phone.js";

css("journey-title", `
.jtitle { margin: 8px 0 2px; }
.jtitle .nx { font-size: 15px; font-weight: 600; }
.jtitle .nx b { color: var(--pink-dark); }
.jtitle .tour { background: #7B5E3B; color: #FFE082; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 700; margin-left: 4px; }
.jtitle .stamps { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.jtitle .stamp { width: 30px; height: 30px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-size: 17px;
  background: rgba(30,40,55,.9); border: 2px solid var(--acc); }
.jtitle .stamp.no { background: rgba(40,44,52,.18); border: 1px dashed rgba(0,0,0,.25); color: rgba(0,0,0,.35); font-size: 13px; font-weight: 700; }
.jtitle .fb { font-size: 12px; opacity: .7; font-weight: 600; margin-left: 6px; }
.jtitle .lock { font-size: 13px; opacity: .75; margin-top: 4px; font-weight: 600; }
.btn .jnew { background: #FF5252; color: #fff; border-radius: 8px; padding: 1px 7px; font-size: 12px; transform: rotate(8deg); animation: jnew 0.8s infinite alternate; }
@keyframes jnew { from { transform: rotate(8deg) scale(1); } to { transform: rotate(8deg) scale(1.12); } }
body.tv .jtitle .nx { font-size: 22px; } body.tv .jtitle .stamp { width: 44px; height: 44px; font-size: 26px; }
`);

// ── onboarding: endless cruise (and the Shared Road) unlock at the first arrival ──
// Same rule as the 2D game: veterans (any prior progress) are unlocked at load.
on("boot", () => {
    const s = shared.get();
    if (!s.cruiseUnlocked && ((s.highScore || 0) > 0 || (s.tripBest || 0) > 0 || (Array.isArray(s.postcards) && s.postcards.length) || save3d.best > 0 || J.arrivals > 0)) {
        shared.update(x => { x.cruiseUnlocked = true; });
    }
});
/** Is endless cruise unlocked? (Test runs that don't opt in to "journey" never lock it.) */
export function cruiseUnlocked() { return !ctx.enabled("journey") || !!shared.get().cruiseUnlocked; }
function hasProgress() { const s = shared.get(); return (s.storyStop || 0) > 0 || (s.storyCycle || 0) > 0 || (Array.isArray(s.postcards) && s.postcards.length > 0); }

// ── title menu ────────────────────────────────────────────────────────────
addMenuItem("title", { id: "story", order: 10, cls: "", label: () => `📖 Story Trip ${glyph("confirm")}`, action: () => startStory() });
addMenuItem("title", { id: "storyMap", order: 12, cls: "alt", label: "🗺️ The Road to Vegas (map)", visible: hasProgress, action: () => openMap({ from: "title" }) });
addMenuItem("title", {
    id: "cruise", order: 20, cls: "",
    visible: cruiseUnlocked,
    label: () => `🛣️ Cruise (endless)${ctx.enabled("journey") && !shared.get().cruisePlayed ? ' <span class="jnew">NEW!</span>' : ""}`,
    action: () => startRun({ mode: "cruise" }),
});
on("run:start", ({ mode }) => {
    if (mode === "cruise" && !shared.get().cruisePlayed) shared.update(s => { s.cruisePlayed = true; });
});

addMenuItem("titleInfo", {
    id: "journey",
    label: () => {
        const s = shared.get(), cyc = s.storyCycle || 0, nIdx = (s.storyStop || 0) % N_STOPS, st = STOPS[nIdx];
        const pcs = Array.isArray(s.postcards) ? s.postcards : [];
        const stars = Object.values(s.storyStars || {}).filter(Boolean).length;
        let html = `<div class="jtitle"><div class="nx">📖 Next stop: <b>${st.icon} ${st.name}</b> · leg ${nIdx + 1}/${N_STOPS}${cyc > 0 ? `<span class="tour">TOUR ${cyc + 1}</span>` : ""}</div>`;
        if (pcs.length) {
            html += `<div class="stamps">${STOPS.map(x => pcs.includes(x.id) ? `<span class="stamp" style="--acc:${x.accent}" title="${x.name}">${x.icon}</span>` : `<span class="stamp no">?</span>`).join("")}
                <span class="fb">✈️ furthest trip: ${s.tripBest || 0} stop${(s.tripBest || 0) === 1 ? "" : "s"} · ⭐ ${stars}/5</span></div>`;
        }
        if (!cruiseUnlocked()) html += `<div class="lock">🔒 Endless cruise unlocks when you reach Bubbe's house</div>`;
        return html + "</div>";
    },
});

// test hooks (scripts/tests3d/journey.js) — harmless in the real game
ctx.journey.debug = Object.assign({ imaCall, startStory, openMap }, storyDebug);
