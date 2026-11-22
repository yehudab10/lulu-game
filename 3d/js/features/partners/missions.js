// features/partners — the crimes for two as 👯 › Missions (ci/friends stage 2, step 3: ctx.group.invitable). They still
// happen the way they always did — by DOING them, each on her own screen (index.js); the mission is the invitation +
// the plan: everyone who says yes gets the same short briefing (who does what), and their partner's name.
import { ctx, on } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { PAY } from "./index.js";

const half = k => Math.floor(PAY[k].pot / 2);
const defs = () => [
    { id: "partners.dare", icon: "🎲", title: "Double dare", blurb: `break the same rule together — ${half("dare")} 💰 each`,
      brief: n => `Run the SAME stop sign or speed trap as ${n}, a few seconds apart → DOUBLE DARE (${half("dare")} 💰 each, 3 a day)` },
    { id: "partners.grab", icon: "🚗", title: "Flag & grab", blurb: "one flags a car down, the other jacks it",
      brief: n => `One of you ✋ flags down a car, the other grabs it — then 🚗 hop in together (${half("grab")} 💰 each)` },
    { id: "partners.ring", icon: "🔔", title: "Ring & sneak", blurb: "one sneaks into a house, one rings the bell",
      brief: n => `One sneaks into a house; the other 🔔 rings the bell to cover — get out unseen (${half("ring")} 💰 each)` },
];                                  // (built at boot: index.js imports this file, so PAY isn't ready while it loads)
const why = () => {
    if (!ctx.enabled("partners") || !ctx.law) return "Not on right now";
    const p = ctx.party, k = p && p.active && p.activity && p.activity.k;
    return k === "roam" || k === "trip" ? "" : "Only out in 🌍 Free Roam with friends";
};
function brief(def, { members, me }) {
    const p = ctx.party, others = members.filter(u => u !== me);
    let n = "your partner";
    try { if (others.length) n = others.map(u => p.displayName(u)).join(" + "); } catch (e) { /* a name is a nicety */ }
    H.banner(`<b>${def.icon} ${def.title}</b><small>${def.brief(n)}</small>`, 5200, { key: "partners" });
}
let reg = false;
function register() {
    if (reg || !ctx.group || !ctx.group.invitable) return reg;
    for (const d of defs()) ctx.group.invitable({ id: d.id, icon: d.icon, title: d.title, blurb: d.blurb, max: 2, canStart: why, start: o => brief(d, o) });
    return (reg = true);
}
on("boot", register);
