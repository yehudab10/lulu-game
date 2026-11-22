// features/partners — the crimes for two as 👯 › Missions (ci/friends stage 2, step 3: ctx.group.invitable). They still
// happen the way they always did — by DOING them, each on her own screen (index.js); the mission is the invitation +
// the plan: everyone who says yes gets the same short briefing (who does what), and their partner's name.
import { ctx, on } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { PAY } from "./index.js";

const half = k => Math.floor(PAY[k].pot / 2);
const defs = () => [
    { id: "partners.dare", icon: "🎲", title: "Double dare", blurb: `Break the same rule together. You each get ${half("dare")} coins.`,
      brief: n => `Run the same stop sign or speed trap as ${n}, a few seconds apart. You each get ${half("dare")} coins, up to 3 times a day.` },
    { id: "partners.grab", icon: "🚗", title: "Flag & grab", blurb: "One of you stops a car, the other takes it.",
      brief: n => `One of you waves down a car and the other takes it. Then get in together. You each get ${half("grab")} coins.` },
    { id: "partners.ring", icon: "🔔", title: "Ring & sneak", blurb: "One of you sneaks into a house, the other rings the bell.",
      brief: n => `One of you sneaks into a house. The other rings the bell so nobody sees. Get out without being seen and you each get ${half("ring")} coins.` },
];                                  // (built at boot: index.js imports this file, so PAY isn't ready while it loads)
const why = () => {
    if (!ctx.enabled("partners") || !ctx.law) return "This is off right now.";
    const p = ctx.party, k = p && p.active && p.activity && p.activity.k;
    return k === "roam" || k === "trip" ? "" : "You can only do this with friends.";
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
