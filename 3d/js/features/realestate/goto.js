// features/realestate/goto.js — 🏠 GO THERE: from anywhere, a soft cut and she's standing at the front door of a home she
// owns, on foot, her own car at the nearest kerb (the owner, 2026-11-26: "players can teleport to their owned houses").
//
//   • the engine's own ways, no new mover: out of a room by its own door (the interiors engine's leave), then
//     ctx.town.warp into the house's town (the lap she's on: ctx.town.exitOf), her car to the kerb (ctx.town.curbSpot),
//     and the same on-foot start a day at her own house uses (ctx.foot.start("home")) — the dissolve hides it.
//   • keyed by the house's FIXED address ("<town>:<lx>:<lz>") — the door is looked up in the town it lands in, so it's the
//     right house on every lap.
//   • free, never a way out of trouble: refused (one plain line) while chased / wanted, on a job, in a game with friends,
//     on a test drive, under arrest / in court / jail / the ER, on the road trip or the Friday rush, in Dina's mode, with
//     her car wrecked / impounded / a borrowed ride under her; and for a home that isn't hers to walk into (the Council's,
//     a tenant's). A short cooldown. With friends: she goes alone (the friend finder points to her).
import { ctx, on, emit, setState } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { dissolve } from "../../core/transition.js";
import { current as roomNow } from "../interiors/engine.js";
import { registry } from "./registry.js";
import { lookup } from "./market.js";
import { tenantOf } from "./rent.js";

export const GO = { cool: 20, last: -1e9, testDrive: false, busy: false, n: 0 };
const now = () => performance.now() / 1000;
on("shops:test", e => { GO.testDrive = e.phase === "start"; });

/** Why she can't go to home `id` right now — "" when she can. friend: a FRIEND's home she's been asked over to (👯 "Come
 *  to my place" — visit.js): the friend's, not hers, so no ownership checks; only out in town with friends. */
export function goBlock(id, { friend = false } = {}) {
    if (friend) {
        if (!(ctx.party && ctx.party.active && ctx.party.activity && ctx.party.activity.k === "roam")) return "Only when you're out in town with friends.";
        if (!id || typeof id !== "string" || !/^(lakewood|midwood):-?\d+:-?\d+$/.test(id)) return "That house isn't there any more.";
    } else {
        const h = registry.get(id);
        if (!h) return "That house isn't yours.";
        if (h.seized || h.lost) return "The Town Council has that house. Win it back in court first.";
        if (tenantOf(id)) return "Your tenants live there now. You can't just walk in!";
    }
    const G = ctx.G || {}, st = ctx.state;
    if (G.mode === "dina" || /^dina/.test(st || "")) return "Not while you're playing as Dina.";
    if (ctx.law && (ctx.law.chasing || (ctx.law.wanted || 0) > 0)) return "Lose the cops first!";
    if (/^law/.test(st || "") || (ctx.civic && ctx.civic.place) || (ctx.er && ctx.er.active)) return "Not right now. Sort this out first.";
    if (ctx.hustle && ctx.hustle.job) return "Finish the job first.";
    if (ctx.heist && ctx.heist.busy && ctx.heist.busy()) return "Finish what you started first.";
    if (GO.testDrive) return "Bring the test car back first.";
    if (ctx.party && ctx.party.active && !(ctx.party.activity && ctx.party.activity.k === "roam")) return "Not in the middle of a game with friends.";
    if (G.mode === "story" && !G.jDone) return "You're on the road trip! Finish it first.";
    if (ctx.shabbos && ctx.shabbos.active) return "Shabbos is coming! Get to Bubbe's first.";
    if (!["playing", "footRun", "interior"].includes(st)) return "Not right now.";
    const r = st === "interior" ? roomNow() : null;
    if (st === "interior" && (!r || r.busy || r.leaving)) return "Finish what you're doing in here first.";
    const F = ctx.foot;
    if (F && F.active && F.vehicle) return "Give back the car you borrowed first.";
    if (F && F.active && F.ownCar && F.ownCar !== "parked" && F.ownCar !== "ok") return "Your car isn't in one piece. Sort that out first.";
    if (F && F.active && F.phase && F.phase !== "walk") return "Not right now.";
    if (GO.busy) return "On your way already!";
    const left = Math.ceil(GO.cool - (now() - GO.last));
    if (left > 0) return `Wait ${left} more second${left === 1 ? "" : "s"}.`;
    if (!ctx.town || typeof ctx.town.warp !== "function" || typeof ctx.town.exitOf !== "function") return "Not right now.";
    return "";
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms) { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await sleep(50); } return !!fn(); }

/** Go to home `id`: → "" (on her way) or the line why not. opts.friend: a friend's home (see goBlock). */
export function goHome(id, opts = {}) {
    const why = goBlock(id, opts);
    if (why) { H.toast(why, "red"); return why; }
    GO.busy = true;
    run(id, opts).catch(e => console.error("[realestate] go there", e)).finally(() => { GO.busy = false; });
    return "";
}

async function run(id, opts = {}) {
    const town = id.split(":")[0], T = ctx.town;
    if (ctx.phone && ctx.phone.isOpen && ctx.phone.closePhone) ctx.phone.closePhone();
    // the town's models (the other town may not be loaded yet)
    if (!T.loaded(town)) { T.load(town); if (!await until(() => T.loaded(town), 20000)) { H.toast("That town isn't ready yet. Try again in a moment.", "red"); return false; } }
    // inside a room: out by its own door first (the engine's leave), then the cut
    if (ctx.state === "interior") {
        const r = roomNow();
        if (r) r.leave();
        if (!await until(() => ctx.state !== "interior", 8000)) return false;
    }
    if (goBlock(id, opts).replace(/^On your way already!$/, "")) return false;       // (something happened on the way out)
    GO.last = now();
    return new Promise(res => dissolve(() => res(land(id, town)), { ms: 650 }));
}

/** The copy of `town` she's nearest to (the lap she's on): in that town → the very copy she stands in; anywhere else →
 *  the closest of its exits, behind or ahead. */
const CUR = { town: null, exitS: null };
on("town:enter", e => { CUR.town = e.town; CUR.exitS = e.exitS; });
on("town:leave", () => { CUR.town = null; });
function exitNear(town) {
    const T = ctx.town;
    const s = T.active && CUR.town != null && CUR.exitS != null ? CUR.exitS : (ctx.car && Number.isFinite(ctx.car.s) ? ctx.car.s : 0);
    if (T.active && CUR.town === town && CUR.exitS != null) return CUR.exitS;
    const ahead = T.exitOf(town, s), PERIOD = 16000;
    const behind = s > PERIOD * 0.5 ? T.exitOf(town, Math.max(0, s - PERIOD)) : null;
    const opts = [ahead, behind].filter(x => x != null);
    return opts.length ? opts.sort((a, b) => Math.abs(a - s) - Math.abs(b - s))[0] : null;
}

function land(id, town) {
    const T = ctx.town, F = ctx.foot;
    const exitS = exitNear(town);
    if (exitS == null) return false;
    if (F && F.active && F.end) F.end("teleport");
    if (ctx.state !== "playing") setState("playing");
    // into the town on the lap she's on, then the door looked up there (its fixed address)
    if (!T.warp({ town, exitS, speed: 0, quiet: true })) return false;
    const rec = lookup(id);
    if (!rec) { console.warn("[realestate] go there: no such door", id); return false; }
    const k = T.curbSpot && T.curbSpot({ near: { x: rec.ap.x, z: rec.ap.z }, minD: 0, maxD: 40, len: 6 });
    if (k) { ctx.car.place(k.x, k.z, k.h); ctx.car.s = k.s; ctx.car.d = k.d; }
    else ctx.car.place(rec.ap.x + rec.nx * 4, rec.ap.z + rec.nz * 4, Math.atan2(rec.ux, rec.uz));
    ctx.car.vx = ctx.car.vz = ctx.car.vF = 0;
    if (ctx.car.showDriver) ctx.car.showDriver(false);
    // (facing her own front door: the camera behind her stays out on the sidewalk — facing the street put it in the house)
    const ap = { x: rec.ap.x, z: rec.ap.z }, face = Math.atan2(-rec.nx, -rec.nz);
    const ok = ctx.foot.start("home", {
        at: ap, face, noIntro: true, drivable: true, line: "", camBlend: 0,
        home: { hazards: false, quiet: () => !!ctx.foot.pos && Math.hypot(ctx.foot.pos.x - ap.x, ctx.foot.pos.z - ap.z) < 40, driveState: "playing" },
    });
    if (ok && ctx.cam && ctx.cam.snap) ctx.cam.snap();
    GO.n++;
    emit("realestate:goto", { id, town, ok: !!ok });
    return !!ok;
}

/** "🏠 Start my days here" (ctx.home.setStartAt) for record `rec` of the town she's in: the door in WORLD coords of the
 *  town copy a new day starts in (the first lap's — world/depart.js warps there), from the house's fixed address — so a
 *  house picked on lap 2+ still starts her day at the right door. */
export function startAtFor(rec) {
    const T = ctx.town, base = { town: rec.town, key: rec.id, label: rec.address, door: { x: rec.ap.x, z: rec.ap.z }, face: Math.atan2(-rec.nx, -rec.nz) };   // (facing her door — see land())
    try {
        const e = (T.exits || []).find(x => x.id === rec.town), P = e && T.placeOf ? T.placeOf(rec.town, e.s) : null;
        if (!P || !T.plan) return base;
        const a = T.plan.local(rec.ap.x, rec.ap.z, {}), b = T.plan.local(rec.ap.x + rec.nx, rec.ap.z + rec.nz, {});
        const co = Math.cos(P.rot), si = Math.sin(P.rot), w = (lx, lz) => ({ x: P.x + lx * co + lz * si, z: P.z - lx * si + lz * co });
        const d = w(a.x, a.z), o = w(b.x, b.z);
        return Object.assign(base, { door: d, face: Math.atan2(d.x - o.x, d.z - o.z) });
    } catch (e) { return base; }
}
