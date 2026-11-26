// features/realestate/visit.js — 👯 "COME TO MY PLACE" (roadmap 23 d2: her own home is where friends visit). Out in town
// with friends, she offers it from 👯 › Missions (the group's usual quiet invitation — ctx.group.invitable); everyone who
// says yes gets 🏠 Go there to HER front door (goto.js, the same refusals), and she goes too if she isn't there already.
// Which home: the one her days start at, else the one nearest her, in the town she's in (friends see the homes where she
// stands). The home's id rides along as d.x.rv while the offer is open.
import { ctx, on } from "../../core/ctx.js";
import { registry } from "./registry.js";
import { lookup } from "./market.js";
import { goHome, goBlock } from "./goto.js";

const roam = () => !!(ctx.party && ctx.party.active && ctx.party.activity && ctx.party.activity.k === "roam");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos) || null;

/** The home she'd ask friends over to, in the town she's in → id | null. */
export function myVisitHome() {
    if (!ctx.town || !ctx.town.active) return null;
    const mine = registry.listFor(ctx.town.id).filter(h => !h.seized && !h.lost);
    if (!mine.length) return null;
    const st = ctx.home && ctx.home.startAt;
    if (st && mine.some(h => h.id === st.key)) return st.key;
    const p = herPos();
    const near = mine.map(h => ({ h, r: lookup(h.id) })).filter(x => x.r).sort((a, b) => (p ? Math.hypot(a.r.ap.x - p.x, a.r.ap.z - p.z) - Math.hypot(b.r.ap.x - p.x, b.r.ap.z - p.z) : 0));
    return near.length ? near[0].h.id : mine[0].id;
}
function why() {
    if (!roam()) return "Only when you're out in town with friends.";
    const id = myVisitHome();
    if (!id) return registry.count() ? "Your home is in the other town. Go there first." : "You don't have a place of your own yet.";
    try { ctx.party.setX("rv", id); } catch (e) { /* */ }
    return "";
}
function start({ me, by }) {
    if (me === by) {
        const id = myVisitHome(), r = id && lookup(id), p = herPos();
        try { ctx.party.setX("rv", null); } catch (e) { /* */ }
        if (r && p && Math.hypot(r.ap.x - p.x, r.ap.z - p.z) > 20 && !goBlock(id)) goHome(id);
        return;
    }
    const peer = ctx.party.peer && ctx.party.peer(by), id = peer && peer.x && peer.x.rv;
    if (typeof id === "string") goHome(id, { friend: true });
}
on("boot", () => {
    if (ctx.group && ctx.group.invitable) {
        ctx.group.invitable({ id: "realestate.visit", icon: "🏠", title: "Come to my place", blurb: "Friends who say yes go straight to your front door.", max: 8, canStart: why, start });
    }
});
export { why as visitBlock };
