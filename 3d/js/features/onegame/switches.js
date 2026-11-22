// features/onegame/switches.js — what the ONE GAME offers right now (the owner, 2026-11-22: roadmap row 21).
//
//   story     false = the Story Trip ("The Road to Vegas") is HIDDEN: no 🧳 suitcase by the car, no 🗺️ story map (📱 Map
//             app, the Scrapbook drawer row), no road-trip start from anywhere, no mention in Ima's first line; its
//             badges count like secret ones (shown once earned). Saved story progress is untouched — flip it back to
//             true and everything returns where she left it. (The journey engine itself still loads: its stops are
//             places on the map — Bubbe's, the beach… — that other features use.)
//   dinaTile  false = Dina's mode has NO title tile and no ✋ "Play as Dina" on the porch. The ways in are hidden ones:
//             DINA'S ROOM inside the house (✋ Play as Dina — features/decor) and, now and then, Dina's school bus
//             stopping outside the house at the home start (✋ Hop on with Dina — features/onegame/bus.js).
//             true = the old title tile + the porch ✋ come back (the hidden ways in stay too).
//
// A leaf module (no imports): any feature may read it. Tests flip it through ctx.onegame.switches; a preview URL can
// too: ?story=1 / ?dinaTile=1.
const q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(""); } })();
export const ONEGAME = {
    story: q.get("story") === "1",
    dinaTile: q.get("dinaTile") === "1",
};
