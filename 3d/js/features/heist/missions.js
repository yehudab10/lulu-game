// features/heist — 💰 the bank job with friends as a 👯 › Missions entry (ci/friends stage 2, step 3: ctx.group.invitable).
// The job itself is unchanged (crew.js: planned at a bank's vault, roles, the alarm, the getaway, the host-split take);
// the mission is the invitation + the plan: the one who offered is the LEADER, everyone who says yes is told where to
// meet and what to tap. Joining still needs each friend's OWN heist rules at the vault (one a run, the cooldown).
import { ctx, on } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { blocked } from "./job.js";

const why = () => {
    if (!ctx.enabled("heist")) return "Not on right now";
    const p = ctx.party;
    if (!(p && p.active && p.activity && p.activity.k === "roam")) return "Only out in 🌍 Free Roam with friends";
    return blocked() || "";
};
function brief({ me, by }) {
    let n = "your friend";
    try { n = ctx.party.displayName(by); } catch (e) { /* a name is a nicety */ }
    const town = ctx.town && ctx.town.active ? ctx.town.name || "" : "";
    const where = town ? `${town}'s bank` : "a bank in town";
    const line = me === by ? `Meet your crew in ${where} — ✋ at the vault → 💰 Plan a job with the crew`
        : `Meet ${n} in ${where} — ✋ at the vault → 💰 Join ${n}'s job`;
    H.banner(`<b>💰 The bank job</b><small>${line}</small>`, 5600, { key: "heist" });
}
let reg = false;
function register() {
    if (reg || !ctx.group || !ctx.group.invitable) return reg;
    ctx.group.invitable({ id: "heist.bank", icon: "💰", title: "The bank job", blurb: "plan it at the vault — the take split", max: 4, canStart: why, start: brief });
    return (reg = true);
}
if (!register()) on("boot", register);
