// features/hustle — where jobs come from: a ringing roadside PAYPHONE or the
// HELP WANTED board (a glowing pad on the shoulder + a beacon: drive into it),
// or Lulu's own phone (ctx.phone.call — honk to say "not now", let it ring to
// take the job). Offers only happen in 🛣️ Cruise (the Story Trip has its own
// chapter tasks, calls and interludes), never in a party, a chase, on foot or
// during the first-drive tutorial — and only when ctx.enabled("hustle").
import { ctx, addActor } from "../../core/ctx.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { TUNE, OFFERS, JOBS, COLOR } from "./data.js";
import { J, startJob } from "./jobs.js";
import { beacons } from "./beacon.js";
import { need, models, cloneWithColors, findNodes, pt, placeFacing, rand, pick, carDist, reserve, solid, unbuiltAhead } from "./util.js";
import * as SFX from "./sfx.js";

export const M = { marker: null, t: rand(...TUNE.firstOffer), offering: false };

/** Which job a marker / call offers (getaway needs the law feature for its heat). */
export function pickJob() {
    const pool = ["cab", "cab", "delivery", "delivery", ...(ctx.law ? ["getaway"] : [])];
    const last = J.last;
    const opts = pool.filter(j => j !== last);
    return pick(opts.length ? opts : pool);
}

export function canOffer() {
    const G = ctx.G;
    if (!ctx.enabled("hustle") || ctx.state !== "playing" || ctx.paused) return false;
    if (G.mode !== "cruise" || J.job || J.pending || M.marker || M.offering) return false;
    if (ctx.party && ctx.party.active) return false;
    if (ctx.foot && ctx.foot.active) return false;
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted >= 2)) return false;
    if (ctx.meta && ctx.meta.calm && ctx.meta.calm()) return false;
    if (ctx.phone && ctx.phone.busy && ctx.phone.busy()) return false;
    if (ctx.multiplayer && ctx.multiplayer.inRace) return false;
    return (G.runTime || 0) > 18;
}

/** Every driving frame: count down to the next offer. */
export function offersTick(dt, controlsOn) {
    if (!controlsOn || !canOffer()) return;
    M.t -= dt;
    if (M.t > 0) return;
    M.t = rand(...TUNE.nextOffer);
    const id = pickJob();
    if (Math.random() < TUNE.phoneChance && id !== "delivery" && ctx.phone) phoneOffer(id);
    else spawnMarker(id);
}
export function offerCooldown(s = null) { M.t = s == null ? rand(...TUNE.nextOffer) : s; }

// ── markers ───────────────────────────────────────────────────────────────
/** Put a mission marker `ahead` metres up the road (payphone for cab / getaway, the board for deliveries). */
export async function spawnMarker(jobId, { ahead = TUNE.markerAhead, s = null } = {}) {
    if (M.marker) return M.marker;
    const kind = jobId === "delivery" ? "board" : "payphone";
    const key = kind === "board" ? "hustle_jobboard" : "hustle_payphone";
    const mk = { jobId, kind, s: s != null ? s : ahead >= 600 ? unbuiltAhead(ahead, 14) : ctx.car.s + ahead, obj: null, pad: null, handset: null, prompted: false, done: false, ringT: 0, t: 0 };
    M.marker = mk;
    const undo = reserve(mk.s - 12, mk.s + 12, 1, 8.5, 20);
    if (!await need([key]) || M.marker !== mk || !ctx.world) { undo(); if (M.marker === mk) M.marker = null; return null; }
    const obj = cloneWithColors(models[key]);
    placeFacing(obj, mk.s, TUNE.propD, 1);
    ctx.scene.add(obj);
    mk.obj = obj;
    mk.handset = findNodes(obj, "Handset")[0] || null;
    const p = pt(mk.s, TUNE.markerD);
    mk.pad = { x: p.x, z: p.z };
    beacons.marker.show(p.x, p.z, JOBS[jobId].color, { pad: true, r: 1.2 });
    const col = solid([{ x: obj.position.x, z: obj.position.z, r: kind === "board" ? 1.1 : 0.7 }], kind === "board" ? "You took the HELP WANTED sign literally" : "You hung up on the payphone. Hard.");
    mk.actor = addActor({
        update(dt) { return markerTick(mk, dt); },
        collide: col,
        dispose() {
            if (obj.parent) obj.parent.remove(obj);
            undo();
            if (M.marker === mk) { M.marker = null; beacons.marker.hide(); }
            if (mk.prompted) H.prompt("");
        },
    });
    return mk;
}

function markerTick(mk, dt) {
    const car = ctx.car;
    mk.t += dt;
    const ahead = mk.s - car.s;
    if (ahead < -60) return false;                       // long gone
    if (mk.done) return ahead > -60;                     // taken: the prop stays as scenery
    if (ahead < -25) { missed(mk); return true; }
    // the payphone rings (and its handset rattles) when she's near
    if (mk.kind === "payphone" && ahead < 170 && ahead > -10) {
        mk.ringT -= dt;
        if (mk.ringT <= 0) { mk.ringT = 2.2; if (ctx.state === "playing") SFX.ring(); }
        if (mk.handset) mk.handset.rotation.z = mk.ringT > 1.7 ? Math.sin(mk.t * 60) * 0.12 : 0;
    }
    // a prompt as she gets close
    const near = ahead < 150 && ahead > -6 && ctx.state === "playing";
    if (near) {
        const d = JOBS[mk.jobId];
        H.prompt(`${mk.kind === "board" ? "📋 HELP WANTED" : "☎️ The payphone's ringing"} — drive into the glow · ${d.emoji} ${d.name}`);
        mk.prompted = true;
    } else if (mk.prompted) { mk.prompted = false; H.prompt(""); }
    // drive into the glowing pad = take the job
    if (ctx.state === "playing" && !J.job && mk.pad && carDist(mk.pad.x, mk.pad.z) < TUNE.padR) take(mk);
    return true;
}
function take(mk) {
    mk.done = true;
    beacons.marker.hide();
    if (mk.prompted) { mk.prompted = false; H.prompt(""); }
    SFX.pickUp();
    if (mk.handset) mk.handset.rotation.z = 0;
    const job = startJob(mk.jobId, { via: mk.kind === "board" ? "board" : "payphone" });
    M.marker = null;
    offerCooldown();
    return job;
}
function missed(mk) {
    mk.done = true;
    beacons.marker.hide();
    if (mk.prompted) { mk.prompted = false; H.prompt(""); }
    M.marker = null;
    offerCooldown(rand(30, 50));
}
export function clearMarker() {
    const mk = M.marker;
    M.marker = null;
    beacons.marker.hide();
    if (mk && mk.actor) { const i = ctx.actors.indexOf(mk.actor); if (i >= 0) { ctx.actors.splice(i, 1); mk.actor.dispose(); } }
}

// ── phone offers ──────────────────────────────────────────────────────────
export function phoneOffer(jobId) {
    const o = OFFERS[jobId];
    if (!o || !ctx.phone || !ctx.phone.call) return spawnMarker(jobId);
    M.offering = true;
    const call = ctx.phone.call({
        from: o.from, emoji: o.emoji, talkEmoji: o.emoji, color: o.color, lines: o.lines, ring: 6, talk: 7.5, flip: false, declinable: true,
        ringText: `📣 ${glyph("honk")} HONK = "Not now!"`, ringSub: `…or let it ring to take the job (${JOBS[jobId].emoji} ${JOBS[jobId].name})`,
        talkSub: "📣 {honk} hangs up",
        doneText: r => r === "full" ? `${JOBS[jobId].emoji} Job's on — follow the beacon!` : r === "declined" ? "\"Fine. Your loss, kiddo.\"" : "\"Rude!\"",
        onDone(r) {
            M.offering = false;
            if (r === "full") { if (ctx.state === "playing") startJob(jobId, { via: "phone", intro: true }); }
            offerCooldown();
        },
    });
    if (!call) { M.offering = false; return spawnMarker(jobId); }
    return call;
}
export { COLOR };
