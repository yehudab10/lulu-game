// features/dina — DINA'S WORLD (2D: 07-dina-world, 08-dina-run,
// 09-dina-home-morgan, 09b-sticker-book, 10-dina-nap-salon (nap), 10b-cookie-catch).
//
//   title "👧 Dina" → dinaSelect ("Pick a Bruck Sister!") → dinaBus (school
//   bus intro) → dinaRun (the race home vs Mom) → dinaCaught (porch + medal)
//   → dinaHome (her bedroom) → dinaMorgan · dinaStickers · dinaNap ·
//   dinaCookie · the tablet (Lulu's game) · the door (back to the picker).
//
// Shared 2D save fields: dinaRunsPlayed, dinaMedals, dinaBest, cookieBest,
// stickerBook, and the 💰 wallet (totalCoins — the 2D game's "stars"/stickers
// were folded into coins, and the sticker book spends coins).
//
// Service: ctx.dina = { start(), home(), active, run, cookie }.
// Events: "dina:run" {won, medal, haul, banked…}, "dina:cookie" {score, caught,
// fee}, plus "stat" ids dinaRuns, dinaMedal_<kind>, dinaHugs, morganHugs,
// dinaNaps, stickers, cookies.
import { ctx, on, css, addMenuItem, setState } from "../../core/ctx.js";
import { resume, pause } from "../../core/screens.js";
import * as H from "../../hud.js";
import { L, ensureModels, STREET_MODELS, ROOM_MODELS, unbindPointer, S2, setPauseFn } from "./common.js";
setPauseFn(pause);
import { disposeStreet } from "./street.js";
import { disposeRoom } from "./room.js";
import { Home, homeDisposed, Tablet } from "./home.js";
import { R, debugSpawn } from "./run.js";
import { CK } from "./cookie.js";
import { busTapped, busState } from "./bus.js";
import "./select.js";
import "./morgan.js";
import "./nap.js";
import "./stickers.js";

const DINA_STATES = new Set(["dinaSelect", "dinaBus", "dinaRun", "dinaCaught", "dinaHome", "dinaMorgan", "dinaNap", "dinaStickers", "dinaCookie"]);
const STREET_STATES = new Set(["dinaBus", "dinaRun", "dinaCaught"]);
const ROOM_STATES = new Set(["dinaHome", "dinaMorgan", "dinaNap", "dinaStickers", "dinaCookie"]);

async function start() {
    if (ctx.state === "dinaSelect") return;
    try { await ensureModels(["dinaMorgan", "dinaProps"]); }
    catch (e) { console.error(e); H.toast("Couldn't load Dina's world — check your connection", "red"); return; }
    setState("dinaSelect");
}
async function home() {
    await ensureModels(ROOM_MODELS.concat(["dinaTreats", "dinaKitchen"]));
    setState("dinaHome", { from: "outside" });
}

ctx.dina = {
    start, home,
    get active() { return DINA_STATES.has(ctx.state); },
    get run() { return R; },
    get cookie() { return CK; },
    get home_() { return Home; },
    get tablet() { return Tablet.on; },
    debug: { spawn: debugSpawn, bus: busState },
};

// ── title + pause menu ───────────────────────────────────────────────────
addMenuItem("title", { id: "dina", order: 35, cls: "pink", label: () => `👧 Dina${S2.runsPlayed() > 0 ? " 🏠" : ""}`, action: start });
addMenuItem("pause", {
    id: "dinaRoom", order: 86, cls: "alt", label: "🏠 Dina's room",
    visible: () => ["dinaRun", "dinaCookie"].includes(ctx.state),
    action: () => { resume(); setState("dinaHome", { from: ctx.state === "dinaCookie" ? "cookie" : "outside" }); },
});

// ── leaving Dina's world frees her street + bedroom ─────────────────────
on("state", ({ from, to }) => {
    if (DINA_STATES.has(from) && !STREET_STATES.has(to) && STREET_STATES.has(from)) disposeStreet();
    if (DINA_STATES.has(from) && !DINA_STATES.has(to)) {
        unbindPointer();
        L.show(false);
        disposeStreet();
        if (!Tablet.on) { disposeRoom(); homeDisposed(); }
        document.body.classList.remove("dina-run", "dina-room", "dina-bus", "dina-result-on", "dina-select-on");
    }
    if (to === "dinaBus") canvasTap(true); else if (from === "dinaBus") canvasTap(false);
});
// a tap anywhere skips the bus intro
const cv = document.getElementById("scene");
const onTap = () => { if (ctx.state === "dinaBus") busTapped(); };
function canvasTap(onOff) { if (onOff) cv.addEventListener("pointerdown", onTap); else cv.removeEventListener("pointerdown", onTap); }

css("dina-misc", `
#dinaLayer .dl-skip { position: absolute; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom));
  background: rgba(0,0,0,.55); color: #fff; border-radius: 999px; padding: 7px 16px; font-weight: 700; font-size: 15px; }
#dinaLayer .dl-skip .glyph { background: #fff; color: var(--ink); }
#dinaLayer .dl-pause { right: max(12px, env(safe-area-inset-right)); top: max(10px, env(safe-area-inset-top)); width: 48px; height: 48px;
  padding: 0; justify-content: center; border-radius: 50%; background: var(--glass); color: var(--ink); }
#dinaLayer .dl-back { left: max(12px, env(safe-area-inset-left)); top: calc(max(10px, env(safe-area-inset-top)) + 62px); background: #66BB6A; }
body.tv #dinaLayer .dl-pause { right: max(12px, env(safe-area-inset-right)); top: max(10px, env(safe-area-inset-top)); width: 48px; height: 48px;
  padding: 0; justify-content: center; border-radius: 50%; background: var(--glass); color: var(--ink); }
#dinaLayer .dl-back { font-size: 24px; top: calc(4vh + 90px); left: 3vw; }
body.tv #dinaLayer .dl-skip { font-size: 22px; bottom: 5vh; right: 4vw; }
body.dina-result-on .screen { align-items: flex-end; background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(43,27,46,.35)); }
#screen .card.dina-result { width: min(560px, 100%); padding: 12px 20px 14px; }
#screen .card.dina-result h2 { font-size: 26px; margin: 2px 0 4px; }
#screen .card.dina-result p { margin: 3px 0; }
#screen .card.dina-result .menu { flex-direction: row; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
#screen .card.dina-result .menu .btn { width: auto; min-width: 200px; }
.dina-medal { display: inline-block; font-size: 22px; font-weight: 700; border-radius: 999px; padding: 4px 18px; margin: 2px 0 4px; color: #fff;
  text-shadow: 0 2px 0 rgba(0,0,0,.3); box-shadow: 0 3px 0 rgba(0,0,0,.18); }
.dina-medal.gold { background: linear-gradient(#FFE082, #FFB300); } .dina-medal.silver { background: linear-gradient(#ECEFF1, #90A4AE); }
.dina-medal.bronze { background: linear-gradient(#FFCCBC, #D7834F); }
.dina-best { color: #E65100; font-weight: 700; }
.dina-newbest { display: inline-block; font-size: 22px; font-weight: 700; color: #5D4037; background: #FFEB3B; border-radius: 999px; padding: 3px 16px;
  animation: dinapulse .7s ease-in-out infinite alternate; }
@keyframes dinapulse { to { transform: scale(1.07); } }
.dina-profit { font-size: 34px; font-weight: 700; margin: 6px 0; }
.dina-profit.up { color: #2E7D32; } .dina-profit.down { color: #C62828; }
#screen .card.dina-cookie-result { width: min(460px, 100%); }
body.tv .dina-medal, body.tv .dina-newbest { font-size: 32px; } body.tv .dina-profit { font-size: 48px; }
/* Lulu's game on Dina's tablet: a tablet bezel around the screen */
body.dina-tablet::after { content: ""; position: fixed; inset: 0; border: 10px solid #212121; border-radius: 26px; pointer-events: none;
  box-shadow: inset 0 0 0 2px #555; z-index: 60; }
body.dina-tablet::before { content: "📱 Dina's tablet"; position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); z-index: 61;
  background: #212121; color: #FFD54F; font: 700 11px var(--font); padding: 1px 12px 2px; border-radius: 8px 8px 0 0; pointer-events: none; }
`);
