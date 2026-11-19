// features/seasons — 🎉 IN A PARTY EVERYONE SEES THE SAME DAY: the host's.
//
// A friend's device can be on another date (a time zone, a wrong clock, a preview link), so every player publishes
// their own day in their snapshot extras (`d.x.cal` = { f: forced preview | null, t: local "YYYY-MM-DDTHH:MM" }) and
// everyone dresses the world for the HOST's. Until the host's day is known, a guest dresses nothing (no flicker from
// one holiday to another). Everything placed is a hash of the place (places.js), never Math.random, so the same
// house gets the same menorah on every screen.
import { ctx } from "../../core/ctx.js";
import { myDay, setHostDay, hostDay } from "./calendar.js";

let pubT = 0, wasParty = false;
const inParty = () => !!(ctx.party && ctx.party.active);

/** Every frame (seasons/index.js): publish my day, adopt the host's. refresh(force) when it changed. */
export function partyTick(dt, refresh) {
    if (!inParty()) {
        if (wasParty) { wasParty = false; setHostDay(null); try { ctx.party && ctx.party.setX && ctx.party.setX("cal", null); } catch (e) { /* gone */ } refresh(true); }
        return;
    }
    if (!wasParty) { wasParty = true; pubT = 0; refresh(true); }
    if ((pubT -= dt) <= 0) {
        pubT = 2;
        try { ctx.party.setX("cal", myDay()); } catch (e) { /* not connected */ }
    }
    let changed = false;
    if (ctx.party.isHost) changed = setHostDay(null);
    else {
        const h = hostCal();
        if (h) changed = setHostDay(h);
    }
    if (changed) refresh(true);
}
function hostCal() {
    try {
        const p = ctx.party.peer && ctx.party.host ? ctx.party.peer(ctx.party.host) : null;
        const c = p && p.x && p.x.cal;
        if (!c || typeof c.t !== "string") return null;
        return { f: Array.isArray(c.f) ? [String(c.f[0]).slice(0, 24), c.f[1] | 0, c.f[2] == null ? null : c.f[2] | 0, c.f[3] ? 1 : 0] : null, t: c.t.slice(0, 16) };
    } catch (e) { return null; }
}
/** null = use my own day · "wait" = a guest who doesn't know the host's day yet. */
export function partyDay() {
    if (!inParty() || ctx.party.isHost) return null;
    return hostDay() ? null : "wait";
}
