// features/hustle — 👯 SIDE JOBS FOR TWO (ci/friends stage 2, step 3: missions together). With friends in 🌍 Free Roam,
// 👯 › Missions lists 🚕 Lulu Cab · 🔥 Hot Delivery · 💰 The Getaway "for two" (ctx.group.invitable — features/friends):
//   • the one who offers it DRIVES — the normal job, in her car;
//   • a friend who opts in NAVIGATES — hops into her passenger seat (openworld's ride-along) and handles the fares;
//   • the pay is the job's normal pay, SPLIT between the crew (the driver keeps her share; each fare / the job's
//     total is shared out the moment it's paid) — never more than the solo job pays (golden rule 5), the job's own
//     caps and limits unchanged. The shares travel in the driver's party state — x.hc = [jobKey, totalEach, crew]
//     (a running total: a lost packet costs nothing, each navigator credits only what's new since it last looked).
import { ctx, on, emit } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { addCoins } from "../../core/driving.js";

const T = { crew: null, key: "", total: 0, clearAt: 0, driver: null, got: new Map(), was: "" };
const PER_JOB_MAX = 5000;                            // a sanity cap on what one job's shares can add up to
const JOB_DEF = {
    cab: { icon: "🚕", title: "Lulu Cab for two", blurb: "one drives, one navigates — every fare split" },
    delivery: { icon: "🔥", title: "Hot Delivery for two", blurb: "one drives, one holds the dish — the pay split" },
    getaway: { icon: "💰", title: "The Getaway for two", blurb: "a driver + a lookout — the cut split" },
};

/** The pay line of a job (cab.js / delivery.js / getaway.js): → what the DRIVER keeps (the full pay when solo). */
export function payCrew(job, pay) {
    const crew = job && Array.isArray(job.crew) ? job.crew : null;
    if (!crew || crew.length < 2 || !(pay > 0) || !(ctx.party && ctx.party.active) || job.crewKey !== T.key) return pay;
    const each = Math.floor(pay / crew.length), mine = pay - each * (crew.length - 1);
    T.total += each;
    ctx.party.setX("hc", [T.key, T.total, crew.filter(u => u !== ctx.party.uid)]);
    emit("hustle:share", { id: job.def && job.def.id, pay, mine, each, crew: crew.length });
    return mine;
}

const why = id => {
    if (!ctx.hustle || !ctx.enabled("hustle")) return "Side jobs aren't on right now";
    if (ctx.hustle.job) return "Finish the job you're on first 💼";
    if (ctx.state !== "playing" || (ctx.foot && ctx.foot.active)) return "Get behind the wheel first 🚗";
    if (id === "getaway" && !(ctx.law && ctx.enabled("law"))) return "No cops, no getaway";
    return "";
};
function start(id, { members, me, by }) {
    if (me === by) {
        const job = ctx.hustle.start(id, { via: "group" });
        if (!job) { H.toast("💼 Couldn't start the job right now", "", { prio: 2 }); return; }
        job.crew = members.slice();
        T.crew = members.slice();
        T.key = job.crewKey = Math.random().toString(36).slice(2, 8);
        T.total = 0; T.clearAt = 0;
        ctx.party.setX("hc", [T.key, 0, members.filter(u => u !== me)]);
        return;
    }
    T.driver = by;
    const P = ctx.party, name = (P && P.players.find(m => m.uid === by) || {}).name || "your friend";
    const r = ctx.openworld && ctx.openworld.ride ? ctx.openworld.ride(by) : "";
    H.toast(r ? `${JOB_DEF[id].icon} You're the crew — ${r}` : `${JOB_DEF[id].icon} Riding with ${name} — your share of the pay comes to you`, "pink", { prio: 2 });
}
let reg = false;
function register() {
    if (reg || !ctx.group || !ctx.group.invitable || !ctx.hustle) return reg;
    for (const id of Object.keys(JOB_DEF)) ctx.group.invitable(Object.assign({ id: "hustle." + id, max: 2, canStart: () => why(id), start: o => start(id, o) }, JOB_DEF[id]));
    return (reg = true);
}
if (!register()) on("boot", register);

// the driver's job ended: the crew sees the last total for a few seconds more, then it's cleared
on("hustle:end", () => { if (T.crew) { T.crew = null; T.clearAt = Date.now() + 6000; } });
function clear() { T.crew = null; T.driver = null; T.key = ""; T.total = 0; T.clearAt = 0; T.got.clear(); T.was = ""; }
// a navigator: credit my share of whatever the driver's running total has added (real time: it's network)
setInterval(() => {
    const P = ctx.party;
    if (!P || !P.active) { if (T.key || T.driver) clear(); return; }
    if (T.clearAt && Date.now() > T.clearAt) { T.clearAt = 0; T.key = ""; P.setX("hc", null); }
    if (!T.driver) return;
    const q = P.peer(T.driver), hc = q && q.x && q.x.hc;
    const live = Array.isArray(hc) && typeof hc[0] === "string" && Array.isArray(hc[2]) && hc[2].includes(P.uid);
    if (live) {
        T.was = hc[0];
        const had = T.got.get(hc[0]) || 0, tot = Math.min(PER_JOB_MAX, Math.max(0, Math.round(+hc[1] || 0))), add = tot - had;
        if (add > 0) {
            T.got.set(hc[0], tot);
            addCoins(add, "hustle");
            H.toast(`💼 +${add} 💰 — your share`, "gold", { prio: 2 });
            emit("hustle:shareIn", { from: T.driver, add, total: tot });
        }
    } else if (T.was && q && q.x) { T.was = ""; T.driver = null; H.toast("💼 Shift over — nice teamwork", "", { prio: 1 }); }
}, 500);
on("party:status", e => { if (!(e && e.want)) clear(); });
export const togetherDebug = () => ({ crew: T.crew, key: T.key, total: T.total, driver: T.driver, got: [...T.got] });
