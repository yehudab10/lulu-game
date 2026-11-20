// features/calm — 🧘 A CALM SCREEN (the owner, 2026-11-20: "lesser pop ups, especially in party mode").
//
// The pop-up budget itself lives in ONE place, hud.js (every feature's H.toast goes through it: priorities, one toast
// at a time on a phone, flavour toasts dropped rather than queued, coalescing — see THE BUDGET there). This module
// tells it two things every frame-ish:
//   quiet — with friends (a 🎉 party) or with strangers' ghosts around (the EVERYONE layer): flavour toasts much rarer
//   busy  — a chase, a dialogue, a scene that isn't the open road: flavour toasts are dropped
// and makes Lulu's chatter default to QUIET with friends (⚙️ Settings › 💬 Lulu's chatter stays the player's: we only
// switch a "normal" to "quiet" for the party and switch it back after — chatterAuto marks that it was us).
import { ctx, on, hook } from "../../core/ctx.js";
import { input } from "../../input.js";
import { save3d, saveSoon } from "../../core/save.js";
import * as H from "../../hud.js";

const party = () => !!(ctx.party && ctx.party.active);
const quiet = () => party() || !!(ctx.mp && ctx.mp.connected && ctx.mp.near > 0);
function busy() {
    const st = ctx.state, def = ctx.states[st] || {};
    if (ctx.dialogOpen) return true;
    if (!(def.driving || st === "footRun")) return true;                       // a scene, a menu, an interior…
    if (ctx.law && ctx.law.chasing) return true;                               // a chase: eyes on the road
    return false;
}
// she pressed a button: a toast in the next second answers it (the budget treats it as normal, not flavour)
let pressT = -9;
const pressedNow = () => { const P = input.pressed; if (P) for (const k in P) if (P[k]) return true; return false; };
hook("update", () => { if (pressedNow()) pressT = ctx.time; }, 1000);
const gate = { quiet: false, busy: false, chase: false, acted: false };
H.setCalmGate(() => {
    gate.quiet = quiet(); gate.busy = busy(); gate.chase = !!(ctx.law && ctx.law.chasing);
    gate.acted = pressedNow() || ctx.time - pressT < 1;
    return gate;
});

// ── 💬 chatter: QUIET by default with friends ─────────────────────────────
const S = () => save3d.settings || (save3d.settings = {});
function partyChatter(inParty) {
    const s = S();
    if (inParty && (s.chatter || "normal") === "normal") { s.chatter = "quiet"; s.chatterAuto = true; saveSoon(); }
    else if (!inParty && s.chatterAuto) { if (s.chatter === "quiet") s.chatter = "normal"; delete s.chatterAuto; saveSoon(); }
}
on("party:status", e => partyChatter(!!(e && e.want)));
on("boot", () => partyChatter(party()));                    // (a save from inside a party: put it back)
on("settings", e => { if (e && e.id === "chatter") { delete S().chatterAuto; saveSoon(); } });   // the player chose: theirs now

ctx.calm = {
    /** Is it "quiet" now (friends / strangers around)? */ get quiet() { return quiet(); },
    /** Is she busy (chase, scene, dialogue)? */ get busy() { return busy(); },
    /** The budget's counters (tests): toasts + bubbles shown / dropped. */ stats: () => { const n = H.notifyState(); return { shown: n.shown, dropped: n.dropped, bubbles: H.bubbleStats() }; },
};
