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
import { shared } from "../../core/save.js";
import { STOPS, N_STOPS } from "./data.js";
import "./env.js";
import "./phone.js";
import { startStory, J } from "./trip.js";
import { debug as storyDebug } from "./story.js";
import { openMap } from "./map.js";
import { ONEGAME } from "../onegame/switches.js";
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
/* inside the home screen's pink hero tile */
.tile.hero .jtitle { display: flex; flex-direction: column; gap: 5px; margin: 0; }
.tile.hero .jtitle .nx { font-size: 14px; font-weight: 600; }
.tile.hero .jtitle .nx b { color: #fff; }
.tile.hero .jtitle .tour { background: rgba(255,255,255,.25); color: #fff; }
.tile.hero .jtitle .stamps { justify-content: flex-start; gap: 4px; margin: 0; }
.tile.hero .jtitle .stamp { width: 22px; height: 22px; border-radius: 6px; font-size: 13px; border-width: 1.5px; }
.tile.hero .jtitle .stamp.no { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.5); color: rgba(255,255,255,.8); font-size: 11px; }
.tile.hero .jtitle .fb { opacity: .95; margin-left: 4px; }
.tile.hero .jtitle .lock { font-size: 12px; opacity: .9; margin: 0; }
body.tv .tile.hero .jtitle .nx { font-size: 21px; } body.tv .tile.hero .jtitle .stamp { width: 32px; height: 32px; font-size: 19px; }
.jtitle .lock { font-size: 13px; opacity: .75; margin-top: 4px; font-weight: 600; }
.btn .jnew { background: #FF5252; color: #fff; border-radius: 8px; padding: 1px 7px; font-size: 12px; transform: rotate(8deg); animation: jnew 0.8s infinite alternate; }
@keyframes jnew { from { transform: rotate(8deg) scale(1); } to { transform: rotate(8deg) scale(1.12); } }
body.tv .jtitle .nx { font-size: 22px; } body.tv .jtitle .stamp { width: 44px; height: 44px; font-size: 26px; }
`);

// ── no lock any more: ▶ PLAY (the open world) is open from the first second (roadmap 10). The old
// `cruiseUnlocked` flag is still set at the first arrival (the 2D game reads it), but nothing in 3D waits on it.
/** Kept for old callers: the open world is never locked now. */
export function cruiseUnlocked() { return true; }
function hasProgress() { const s = shared.get(); return (s.storyStop || 0) > 0 || (s.storyCycle || 0) > 0 || (Array.isArray(s.postcards) && s.postcards.length > 0); }

// ── the Story Trip line: next stop + postcards (the 🧳 suitcase, onegame.tripLine()) ──
function storySub() {
    const s = shared.get(), cyc = s.storyCycle || 0, nIdx = (s.storyStop || 0) % N_STOPS, st = STOPS[nIdx];
    const pcs = Array.isArray(s.postcards) ? s.postcards : [];
    const stars = Object.values(s.storyStars || {}).filter(Boolean).length;
    let html = `<span class="jtitle"><span class="nx">Next stop: <b>${st.icon} ${st.name}</b> · leg ${nIdx + 1}/${N_STOPS}${cyc > 0 ? `<span class="tour">TOUR ${cyc + 1}</span>` : ""}</span>`;
    if (pcs.length) {
        html += `<span class="stamps">${STOPS.map(x => pcs.includes(x.id) ? `<span class="stamp" style="--acc:${x.accent}" title="${x.name}">${x.icon}</span>` : `<span class="stamp no">?</span>`).join("")}${stars ? `<span class="fb">⭐ ${stars}/5</span>` : ""}</span>`;
    }
    return html + "</span>";
}
// (the Story Trip is no longer a title mode: it starts from inside the world — the 🧳 suitcase by the car at home,
// or a stop on the 📱 phone's 🗺️ Map — features/onegame. Its subtitle html is shared: storySub())
export { storySub };
addMenuItem("title", { id: "storyMap", order: 12, group: "book", short: "Map", label: "🗺️ The Road to Vegas (map)", sub: "every stop, postcard and checkpoint", visible: () => ONEGAME.story && hasProgress(), action: () => openMap({ from: "title" }) });
on("run:start", ({ mode }) => {
    if (mode === "cruise" && !shared.get().cruisePlayed) shared.update(s => { s.cruisePlayed = true; });
});

// test hooks (scripts/tests3d/journey.js) — harmless in the real game
ctx.journey.debug = Object.assign({ imaCall, startStory, openMap }, storyDebug);
