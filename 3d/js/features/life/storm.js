// features/life — ⛈️ AFTER THE THUNDER (round 3). atmos already does the storm (the bolt, the flash, the clap, a rumble);
// its `atmos:thunder` {near} (the tiny hook) lets the town answer it:
//   🐕 the dogs: a beat after a clap, a dog on the block starts barking (and the one next door joins in); a close one
//      sets off two
//   💡 the lights: a close clap makes the houses' lit windows flicker for half a second (windows.js' `blip`) — the power
//      nearly went
//   😱 Lulu on foot jumps a little ("EEK! …I meant to do that.") — once a visit, the shared line budget, never a toast
// In town only (on foot or driving through it); the dogs follow ⚙️ 🐦 Street sounds. Local + cosmetic.
import { ctx, on } from "../../core/ctx.js";
import { L, rand, soundsOn, luluLine } from "./common.js";
import { happen } from "./ambience.js";
import { blip } from "./windows.js";

export const STORM = { claps: 0, dogs: 0, blips: 0, eeks: 0, pending: [], said: false };
const EEK = ["EEK! …I meant to do that.", "Okay. OKAY. That one was close. 😳", "Ima, I'm FINE. I'm totally fine. ⛈️"];
const T = new Float64Array(4);        // pending barks: their times (game s), 0 = none

on("atmos:thunder", e => {
    if (!ctx.enabled("life") || !L.on || !L.town) return;
    const near = e && typeof e.near === "number" ? e.near : 0.5;
    STORM.claps++;
    const n = near > 0.5 ? 2 : 1;
    let k = 0;
    for (let i = 0; i < T.length && k < n; i++) if (!T[i]) { T[i] = L.time + rand(0.4, 1.1) + k * rand(0.5, 1.2); k++; }
    if (near > 0.55) { blip(0.5); STORM.blips++; }
    if (L.foot && !STORM.said && near > 0.4 && luluLine(EEK[Math.floor(Math.random() * EEK.length)], 2.2)) { STORM.said = true; STORM.eeks++; }
});
export function tickStorm() {
    for (let i = 0; i < T.length; i++) {
        if (!T[i] || L.time < T[i]) continue;
        T[i] = 0;
        if (!L.on || !L.town || !soundsOn() || L.quiet) continue;
        happen(Math.random() < 0.6 ? "lifeBark" : "lifeBarkSmall");
        STORM.dogs++;
    }
}
export function stormClear() { T.fill(0); STORM.said = false; }
export function stormInfo() { return { claps: STORM.claps, dogs: STORM.dogs, blips: STORM.blips, eeks: STORM.eeks }; }
