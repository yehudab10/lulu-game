// features/hustle — SIDE JOBS IN A 🎉 PARTY (Road Trip + 🌍 Free Roam, on the highway).
//
// Jobs are personal: my cab fare rides in MY car, my cholent delivery is MY problem, the pay
// is mine. But the ☎️ payphones + 📋 HELP WANTED boards on the shoulder are part of the world,
// so they come from the party's seeded road plan (ctx.party.road, shared with roadevents +
// cameos): every friend drives past the same ringing payphone at the same s. Whoever drives
// into its glow takes the job — on THEIR screen; a friend still sees it ringing on theirs
// (each screen has its own copy, nothing to arbitrate). If I'm already on a job, it isn't
// built for me (a busy phone line). My own 📱 still rings at random — nobody else hears it —
// and the 💼 Jobs app works as usual. Friends see "🚕 on a cab job" over my car while I work
// (ctx.party.presence, when it's there).
import { ctx, hook, on } from "../../core/ctx.js";
import { J } from "./jobs.js";
import { M, spawnMarker, partyRoad, lawOn } from "./markers.js";
import { JOBS } from "./data.js";

const CH = 200;
const P = { done: new Set(), log: [] };
const full = A => !!A && (A.k === "trip" || A.k === "roam");
on("boot", () => {
    if (!ctx.party || !ctx.party.road) return;
    ctx.party.road.claim("hustle", { payphone: A => (full(A) ? 0.55 : 0), board: A => (full(A) ? 0.45 : 0) });
});
on("run:start", () => { P.done.clear(); P.log.length = 0; });

/** The job a planned marker offers (the same for everyone). */
export function jobFor(sl) {
    if (sl.kind === "board") return "delivery";
    return lawOn() && ctx.party.h01("hustleJob", sl.k) < 0.3 ? "getaway" : "cab";
}

hook("update", (dt, _P, controlsOn) => {
    if (!(ctx.party && ctx.party.active && ctx.party.road) || ctx.G.mode !== "party" || !controlsOn || ctx.state !== "playing" || !ctx.enabled("hustle")) return;
    const car = ctx.car;
    for (let k = Math.floor((car.s - 40) / CH); k <= Math.floor((car.s + 1000) / CH); k++) {
        const sl = ctx.party.road.slot(k);
        if (!sl || sl.id !== "hustle" || P.done.has(sl.key)) continue;
        if (car.s < sl.s - 950) continue;                       // (built ~950 m out: before its chunk, like solo's unbuilt spot)
        P.done.add(sl.key);
        const id = jobFor(sl);
        P.log.push({ key: sl.key, job: id, s: Math.round(sl.s * 10) / 10, built: false });
        if (sl.s - car.s < 300 || J.job || J.pending || M.marker || !partyRoad()) continue;   // busy / too late: not for me
        P.log[P.log.length - 1].built = true;
        spawnMarker(id, { s: sl.s }).catch(e => console.error("[hustle] party marker", e));
    }
}, 2);

// friends see what I'm up to (the other party work's ctx.party.presence — optional)
on("hustle:start", ({ id }) => {
    if (!(ctx.party && ctx.party.active) || !ctx.party.presence) return;
    const d = JOBS[id] || {};
    ctx.party.presence({ mode: "job", label: `on a ${d.name || "side job"}`, icon: d.emoji || "💼" });
});
on("hustle:end", () => { if (ctx.party && ctx.party.active && ctx.party.presence) ctx.party.presence(null); });

export const partyDebug = { log: P.log, done: P.done, jobFor };
