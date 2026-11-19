// features/underworld — 🫳 THE PICKPOCKET (on foot: the highway's verge or a town's sidewalk).
//
// A skinny guy in a beanie strolls up, "accidentally" bumps her ("Pardon me, miss!") and lifts a few
// coins (TUNE.pickpocket: ~12 % of her wallet, at least 6, never more than TUNE.coinCap) — then legs it
// down the street. She can run him down: close enough, ✋ TACKLE (or just run into him) and he hands
// them back (+ a little extra for the trouble). Shomrim from the 📞 Call app send a guy jogging after
// him. If he gets away, the coins still come home: his mother texts and sends them back with interest.
import { ctx } from "../../core/ctx.js";
import { PICK, COMM, TUNE } from "./data.js";
import { UW, SAVE, dirty, rand, pick, fill, need, models, person, lulu, bubble, toast, banner, log, stat, takeCoins, refund, coins, drop, later } from "./common.js";
import { rivalFor, rivalResult } from "./heat.js";

const tmp = {};
const P = TUNE.pickpocket;
const footPos = () => (ctx.foot && ctx.foot.pos) || null;

/** A pickpocket now (Lulu must be walking). → Promise<encounter | null> */
export async function spawnPickpocket(opts = {}) {
    const F = footPos();
    if (!F || UW.enc) return null;
    const tok = UW.loading = {};
    await need(["uw_pickpocket", "npcMan"]);
    if (UW.loading !== tok) return null;
    UW.loading = null;
    const at = footPos();
    if (!at || UW.enc || !(ctx.foot && ctx.foot.active)) return null;
    const p = person("uw_pickpocket", null, "npcMan");
    if (!p) return null;
    const road = ctx.world.road;
    road.nearest(at.x, at.z, ctx.car.s, tmp);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const E = { kind: "pickpocket", rival: opts.rival || rivalFor("pickpocket"), p, s: tmp.s + dir * rand(P.spawn[0], P.spawn[1]), d: tmp.d + rand(-0.6, 0.6),
        dir: 0, phase: "approach", t: 0, pt: 0, stolen: 0, x: 0, z: 0, said: {}, result: "", runT: 0 };
    const q = road.point(E.s, E.d, tmp);
    E.x = q.x; E.z = q.z;
    p.obj.position.set(E.x, 0, E.z);
    ctx.scene.add(p.obj);
    UW.enc = E;
    stat("uwPickpockets");
    log("encounter", { kind: "pickpocket", rival: E.rival.name, again: !E.rival.fresh });
    return E;
}

/** Every frame (driving AND on foot). */
export function pickTick(dt, E) {
    E.t += dt; E.pt += dt;
    const F = footPos(), p = E.p;
    if (!p) return;
    const onFoot = !!(ctx.foot && ctx.foot.active && F);
    if (!onFoot && E.phase !== "tackled" && E.phase !== "held") {
        // she got back in a car: he's gone (with whatever he took)
        if (E.phase === "run") gone(E);
        else { end(E, "won", "left"); finish(E); }
        return;
    }
    const road = ctx.world.road;
    const dx = F.x - E.x, dz = F.z - E.z, dist = Math.hypot(dx, dz);
    switch (E.phase) {
        case "approach": {
            const sp = P.walk;
            if (dist > 0.05) { E.x += dx / dist * sp * dt; E.z += dz / dist * sp * dt; }
            p.face(F.x, F.z, dt, 8);
            p.update(dt, { walk: sp });
            if (dist < 1.1) bump(E);
            else if (E.pt > 22 || dist > 60) { end(E, "won", "bored"); finish(E); }
            break;
        }
        case "run": {
            E.runT += dt;
            // (he stops to count the coins while she's on the phone to the Shomrim)
            const sp = (E.runT > P.tiredAfter ? P.tired : P.run) * (ctx.dialogOpen ? 0.25 : 1);
            // down the street, away from her (road coords: the highway, or the town street he's on)
            road.nearest(E.x, E.z, E.s, tmp);
            E.s = tmp.s + E.dir * sp * dt;
            const zig = Math.sin(E.runT * 2.2) * 0.4;
            const q = road.point(E.s, E.d + zig, tmp);
            const vx = q.x - E.x, vz = q.z - E.z;
            E.x = q.x; E.z = q.z;
            p.face(E.x + vx * 10, E.z + vz * 10, dt, 10);
            p.update(dt, { walk: sp });
            if (E.runT > 0.6 && E.runT % 3 < dt) bubble(pick(PICK.run), p.obj, { cls: "kid", y: 1.9, dur: 1.6 });
            // (a beat after the bump before she can grab him; never mid-phone-call to the Shomrim)
            if (dist < P.auto && E.runT > 0.9) tackle(E, "lulu");
            else if (!E.shomer && !ctx.dialogOpen && (dist > P.getaway || E.runT > P.life)) gone(E);
            break;
        }
        case "tackled": {
            // flat on his back (cartoon), then up, sheepish, and off
            if (E.pt < 2.6) { p.obj.rotation.x = Math.max(-1.45, p.obj.rotation.x - dt * 8); p.obj.position.y = 0.15; p.update(dt, {}); }
            else {
                p.obj.rotation.x = 0; p.obj.position.y = 0;
                road.nearest(E.x, E.z, E.s, tmp);
                E.s = tmp.s + E.dir * 1.6 * dt;
                const q = road.point(E.s, E.d + 2, tmp);
                E.x = q.x; E.z = q.z;
                p.update(dt, { walk: 1.6, wave: E.pt < 4 });
                if (E.pt > 7) finish(E);
            }
            break;
        }
        case "held":
            p.update(dt, { talk: true });
            if (E.pt > 6) finish(E);
            break;
    }
    if (E.phase !== "tackled" || E.pt >= 2.6) p.obj.position.set(E.x, p.obj.position.y, E.z);
    if (E.shomer) shomerTick(dt, E);
}

function bump(E) {
    E.phase = "run"; E.pt = 0;
    const want = Math.max(P.min, Math.round(coins() * P.frac));
    E.stolen = takeCoins(want, "pickpocket");
    const F = footPos();
    ctx.world.road.nearest(E.x, E.z, E.s, tmp);
    const fs = ctx.world.road.nearest(F.x, F.z, E.s, {}).s;
    E.s = tmp.s;
    E.dir = Math.sign(tmp.s - fs) || 1;
    bubble(!E.rival.fresh ? pick(PICK.again) : pick(PICK.bump), E.p.obj, { cls: "kid", y: 1.9 });
    if (E.stolen > 0) {
        toast(fill(PICK.stole, { n: E.stolen }), "red", "uw:pick");
        later(0.9, () => lulu(pick(PICK.lulu), true));
        banner("🫳 PICKPOCKET!", "run him down — ✋ TACKLE — or call Shomrim (📞)", 2600, "uw:enc");
    } else {
        later(0.9, () => bubble(pick(PICK.lint), E.p.obj, { cls: "kid", y: 1.9 }));
    }
    if (ctx.foot && ctx.foot.bump) { /* (a party-only knock; solo she just staggers) */ }
    log("pick", { stolen: E.stolen });
}

/** Got him. by: "lulu" | "shomrim". */
export function tackle(E = UW.enc, by = "lulu") {
    if (!E || E.kind !== "pickpocket" || E.phase !== "run") return false;
    E.phase = by === "lulu" ? "tackled" : "held"; E.pt = 0;
    const back = refund(E.stolen + (by === "lulu" && E.stolen > 0 ? TUNE.reward.tackle : 0), "pickpocket");
    E.returned = back;
    bubble(pick(PICK.tackled), E.p.obj, { cls: "kid", y: by === "lulu" ? 1.2 : 1.9, dur: 3 });
    if (back > 0) toast(fill(PICK.back, { n: back }), "gold", "uw:pick");
    if (by === "lulu") { later(0.8, () => lulu(pick(PICK.luluTackle), true)); stat("uwTackles"); if (ctx.G) ctx.G.shake = Math.max(ctx.G.shake || 0, 0.3); }
    end(E, "busted", by);
    return true;
}
/** He got away: the coins come back anyway (his mother). */
function gone(E) {
    if (E.result) return;
    const n = E.stolen;
    if (n > 0) {
        toast(fill(PICK.gone, { n }), "", "uw:pick");
        SAVE.owed = (SAVE.owed || 0) + n;
        dirty();
        later(rand(35, 60), () => payOwed());
    }
    end(E, "won", "away");
    finish(E);
}
/** His mother sends the coins back (with interest). */
export function payOwed() {
    const n = SAVE.owed || 0;
    if (n <= 0) return 0;
    SAVE.owed = 0;
    dirty();
    const k = refund(n + 2, "pickpocket");
    try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: "YOSSI'S MOTHER", emoji: "👵", color: "#8E24AA", msg: PICK.mom, thread: "yossi's mother" }); } catch (e) { /* no phone */ }
    toast(`👵 +${k} 💰 — returned with interest`, "gold", "uw:pick");
    log("owed", { n: k });
    return k;
}
function end(E, result, how) {
    if (E.result) return;
    E.result = result; E.how = how;
    rivalResult(E.rival, result);
    log("end", { kind: "pickpocket", result, how, stolen: E.stolen });
}
function finish(E) {
    if (E.p) { drop(E.p.obj); E.p = null; }
    if (E.shomer && E.shomer.p) { drop(E.shomer.p.obj); E.shomer.p = null; }
    if (UW.enc === E) UW.enc = null;
}
export function dropPick(E) { if (E) { if (!E.result) end(E, "won", "reset"); finish(E); } }

// ── the ✋ TACKLE spot (foot's interact button) ───────────────────────────
export const tackleSpot = {
    r: P.tackleR, short: "TACKLE", first: true,     // (urgent: it wins the ✋ button over a door / a car in reach)
    pos() { const E = UW.enc; return E && E.kind === "pickpocket" && E.phase === "run" && E.p ? { x: E.x, z: E.z } : null; },
    label() { return PICK.tackle; },
    act() { tackle(UW.enc, "lulu"); },
};

// ── 🔦 a Shomer jogs after him (the 📞 Call app) ─────────────────────────
export async function shomerAfter(E = UW.enc) {
    if (!E || E.kind !== "pickpocket" || E.phase !== "run" || E.shomer) return false;
    E.shomer = { pending: true };
    await need(["community_shomer"]);
    if (E.phase !== "run" || !E.p) { E.shomer = null; return false; }
    const p = person("community_shomer", null, "npcMan");
    if (!p) { E.shomer = null; return false; }
    const F = footPos() || { x: E.x, z: E.z };
    // (from up the street: he runs straight into him)
    const q = ctx.world.road.point(E.s + E.dir * 26, E.d, tmp);
    p.obj.position.set(q.x || F.x, 0, q.z || F.z);
    ctx.scene.add(p.obj);
    E.shomer = { p, t: 0 };
    bubble(pick(COMM.foot), p.obj, { cls: "cop", y: 1.9, dur: 3 });
    stat("uwShomrimCalls");
    log("shomrim", { phase: "coming", kind: "pickpocket" });
    return true;
}
function shomerTick(dt, E) {
    const S = E.shomer;
    if (!S || !S.p) return;
    S.t += dt;
    const o = S.p.obj.position;
    const dx = E.x - o.x, dz = E.z - o.z, d = Math.hypot(dx, dz);
    if (E.phase === "run") {
        const sp = 7.2;
        if (d > 0.05) { o.x += dx / d * sp * dt; o.z += dz / d * sp * dt; }
        S.p.face(E.x, E.z, dt, 10);
        S.p.update(dt, { walk: sp });
        if (d < 1.3) {
            tackle(E, "shomrim");
            bubble("GOT HIM! …can somebody call the actual police?", S.p.obj, { cls: "cop", y: 1.9, dur: 3 });
            toast(COMM.done, "gold", "uw:shomrim");
            stat("uwShomrimBusts");
            log("shomrim", { phase: "caught", kind: "pickpocket" });
        }
    } else S.p.update(dt, { talk: E.phase === "held" });
}
