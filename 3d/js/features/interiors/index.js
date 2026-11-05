// features/interiors — the buildings Lulu can walk into while she's on foot
// (port of src/08c-foot-bar.js, 08d-foot-school-hospital.js, 08e-foot-police-beach.js
// and the footInterior contract in 08b-foot-world.js).
//
// Provides, at import time:
//   ctx.interiors.bar | school | hospital | police | beach = { name, emoji, enter({ exit }) }
//     enter() fades into that interior's 3D set (state "interior"); leaving through the
//     door (or ○ / Backspace → "Head back outside?") disposes the set and calls exit()
//     so the caller resumes its walking state (no exit → back to the title screen).
// Events: interior:enter {id} · interior:exit {id} · stat {id: "interiorVisits" | "interiorCoins"}
// Consumes: ctx.law (settle charges at the precinct), ctx.G hearts (rest at the beach cabana),
//           the shared wallet, hooks.update/damage/hud (the bar's liquid-courage buff while driving).
import "./bar.js";
import "./school.js";
import "./hospital.js";
import "./police.js";
import "./beach.js";
