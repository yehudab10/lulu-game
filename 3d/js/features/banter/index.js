// features/banter — PERSONALITY.
//
//   rig.js         Lulu comes alive in the driver's seat (bops, leans, steers,
//                  flinches, waves, fist-pumps, checks over her shoulder for cops)
//   lulu.js        her one-liners: events → small speech bubbles over her head
//   npc.js         the road talks back: honk replies, wrong-way panic, fists out
//                  of windows, polite wave-bys, roadside folks who wave or gasp
//   billboards.js  funny billboards streamed along the road (ads.js = the ads)
//   bubbles.js     the pooled DOM speech bubbles (small, off the road's centre)
//   lines.js       every line of dialogue
//
// The driver animation always runs (it only follows what the player does);
// everything random — bubbles, other drivers' reactions, onlookers,
// billboards — is gated by ctx.enabled("banter") so other tests stay
// deterministic. Debug / test hooks live on ctx.banter.
import { ctx, on, hook, wrapAngle } from "../../core/ctx.js";
import { quiet, knobs } from "./util.js";
import { updateBubbles, setHeadSource, bubbleRects, npcBubble, luluBubble, hideLulu } from "./bubbles.js";
import { headWorld, rigInfo, gesture, lookAt, flinch, jolt } from "./rig.js";
import { tickLulu, say, luluState, CAT } from "./lulu.js";
import { tickNpc, npcState, forceReply, forcePed, npcPeds, npcArms } from "./npc.js";
import { tickBillboards, bbState, forceBillboard, billboards, placeAt, staticAdIds } from "./billboards.js";

setHeadSource(headWorld);

// after the rig (priority 0) so her head is where it will be drawn
hook("hud", dt => {
    if (ctx.paused || (ctx.state !== "playing" && ctx.state !== "intro" && ctx.state !== "wrecked" && ctx.state !== "arriving")) {
        updateBubbles(dt, false);
        return;
    }
    try { tickLulu(dt); } catch (e) { console.error("[banter] lulu", e); }
    try { tickNpc(dt); } catch (e) { console.error("[banter] npc", e); }
    try { tickBillboards(dt); } catch (e) { console.error("[banter] billboards", e); }
    updateBubbles(dt, !quiet());
}, -10);
on("state", ({ to }) => { if (to !== "playing") updateBubbles(0, false); });

// tests: hold lane d at a speed (ctx.banter.autopilot = { d, speed })
hook("controls", ctl => {
    const ap = ctx.banter.autopilot;
    if (!ap) return;
    const car = ctx.car, tgt = ctx.world.road.point(car.s + 12, ap.d, {});
    const diff = wrapAngle(Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z) - car.h);
    ctl.steer = Math.max(-1, Math.min(1, -diff * 3));
    ctl.throttle = car.speed < ap.speed ? 0.7 : 0;
    ctl.brake = car.vF > ap.speed + 1.5 ? 0.5 : 0;
    ctl.analog = true;
}, 3);

const r4 = q => [q.x, q.y, q.z, q.w].map(v => +v.toFixed(4));
ctx.banter = {
    /** Lulu says a line now: a category ("closeCall", "boring"…) or any text. */
    say(what, info = {}) { return CAT[what] ? say(what, info, { force: true }) : say("custom", {}, { force: true, line: String(what) }); },
    get line() { const b = luluBubble(); return b.on ? b.text : ""; },
    lulu: luluState, npc: npcState, billboards: bbState,
    /** Hang a billboard (id from ads.js, or random) `ahead` metres up the road. */
    billboard(id = null, ahead = 60, side = 1) { const b = forceBillboard(id, ahead, side); return b ? b.design.key : null; },
    /** Party mode: hang design `id` in `chunk` at s / side (the party decides, seeded, so every friend sees the same boards). */
    billboardAt(chunk, s, side, id) { const b = placeAt(chunk, s, side, id); return b ? b.design.key : null; },
    staticAds: () => staticAdIds(),
    activeBillboards() { return billboards().map(b => ({ key: b.design.key, s: Math.round(b.s), side: b.side, chunkS: b.chunk ? b.chunk.s0 : null })); },
    /** Make traffic car #i (or the nearest ahead) answer as if honked at. */
    reply(car = null, n = 1) {
        const c = car || ctx.traffic.cars.filter(x => x.s > ctx.car.s).sort((a, b) => a.s - b.s)[0];
        if (c) forceReply(c, n);
        return !!c;
    },
    npcSay(text, car) { return !!npcBubble(text, (car || ctx.traffic.cars[0]).obj, { cls: "angry" }); },
    ped() { forcePed(); return npcPeds.filter(p => p.on).length; },
    rects: () => bubbleRects(),
    gesture, lookAt, flinch, jolt,
    /** The driver rig and its current pose (tests: does she move?). */
    pose() {
        const R = rigInfo();
        if (!R.ok) return { ok: false };
        if (R.rigid) return { ok: true, rigid: true, driver: r4(R.driver.quaternion) };
        return { ok: true, rigid: false, parts: R.parts, body: r4(R.body.quaternion), head: r4(R.head.quaternion), armL: r4(R.armL.quaternion), armR: r4(R.armR.quaternion), bodyY: +R.body.position.y.toFixed(4) };
    },
    arms: () => npcArms.filter(a => a.car).map(a => a.mode),
    peds: () => npcPeds.filter(p => p.on).map(p => ({ s: Math.round(p.s), d: +p.d.toFixed(2), kid: !!p.look.kid, react: p.react })),
    /** Tests: every dice roll succeeds; forget the throttle and cooldowns. */
    knobs,
    autopilot: null,
    resetThrottle() { luluState.last = -99; luluState.cd = {}; hideLulu(); return true; },
};
