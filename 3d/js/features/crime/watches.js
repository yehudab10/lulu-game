// features/crime — ⌚ THE COAT OF WATCHES — crime that isn't hers.
//
// Shmuly "Rolecks" paces a stretch of sidewalk up the avenue from the pizza shop / the bakery, opening his coat at
// anyone who slows down. A cop within sight (TUNE.watch.copR) and he's off round the corner for a minute.
// ✋ → the card: ⌚ BUY ONE (PAY.watch.price 💰 — a coin sink, once a REAL day; it's ticking backwards) · 📞 REPORT HIM
// (or from the 📞 Phone › 911 while she's near) → a beat cop walks over and nabs him: PAY.watch.report 💰 once a REAL
// day; Shmuly remembers (he crosses the street when he sees her) · 🙅‍♀️ no thanks.
import { ctx } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { PAY, TUNE, LINES, log, stat, pick, fill, lulu, bubble, mustSee, townSpot, copWatching, payCapped, live, luluPos, today } from "./common.js";
import { Character, ask, sendCop, mem, remember } from "./street.js";

const K = TUNE.watch, M = LINES.watch;
export const WATCH = { guy: null, at: null, u: 0, dir: 1, state: "out", awayT: 0, lookT: 0, spotRm: null, reported: false, talkT: 0 };

export function buildWatch() {
    clearWatch();
    const at = townSpot(["bakery", "pizza", "bank"], 20, 1.6);
    if (!at) return false;
    WATCH.at = at; WATCH.u = 0; WATCH.dir = 1; WATCH.state = "out"; WATCH.reported = false;
    WATCH.guy = new Character({ key: "uw_pickpocket", fallback: "npcMan", colors: { Coat: "#3E2723", Shirt: "#5D4037" }, name: M.name });
    WATCH.guy.place(at.x, at.z, at.yaw);
    if (ctx.foot && ctx.foot.addSpot) WATCH.spotRm = ctx.foot.addSpot(spot);
    log("watch", { phase: "built", key: at.key });
    return true;
}
export function clearWatch() {
    if (WATCH.spotRm) { WATCH.spotRm(); WATCH.spotRm = null; }
    if (WATCH.guy) WATCH.guy.clear();
    WATCH.guy = null; WATCH.at = null;
}
const here = () => WATCH.guy && WATCH.guy.p && WATCH.state === "out";
const spot = {
    r: 2.0, short: "WATCH",
    pos() { return here() && live() && mem("shmuly").mood !== "snitch" ? { x: WATCH.guy.x, z: WATCH.guy.z } : null; },
    label() { return M.spot; },
    act() { card(); },
};

async function card() {
    if (!here() || ctx.dialogOpen) return;
    const g = WATCH.guy, m = mem("shmuly");
    m.met++;
    WATCH.talkT = 6;
    const i = await ask(`⌚ ${M.name}`, pick(M.pitch), [fill(M.buy, { n: PAY.watch.price }), M.report, M.no], "⌚");
    if (!here()) return;
    if (i === 0) buy();
    else if (i === 1) report("person");
    else if (g.obj) bubble(pick(M.bye), g.obj, { y: 2.1 });
}
function buy() {
    const m = mem("shmuly"), g = WATCH.guy;
    if (m.boughtDay === today()) { bubble(M.noMore, g.obj, { y: 2.1 }); return; }
    if (wallet.coins < PAY.watch.price || !wallet.spend(PAY.watch.price)) { bubble(M.broke, g.obj, { y: 2.1 }); return; }
    m.boughtDay = today();
    remember("shmuly", "bought", m.mood === "snitch" ? "snitch" : "customer");
    lulu(pick(M.bought), true);
    stat("crimeWatches");
    log("watch", { phase: "bought", price: PAY.watch.price });
}
export function report(via = "person") {
    if (!here() || WATCH.reported) return false;
    WATCH.reported = true;
    const g = WATCH.guy;
    const go = () => sendCop(g, () => {
        WATCH.state = "busted";
        if (g.obj) bubble(pick(M.nabbed), g.obj, { y: 2.1, dur: 2.4 });
        remember("shmuly", "reported", "snitch");
        const paid = payCapped("watch:report", PAY.watch.report, PAY.watch.report);
        stat("crimeReports");
        mustSee(paid > 0 ? `${M.reportDone} · +${paid} 💰` : M.reportDone, paid > 0 ? "gold" : "", "crime:watch");
        log("watch", { phase: "reported", via, paid });
    });
    log("watch", { phase: "report", via });
    if (via === "person" && ctx.community && ctx.community.callOut) ctx.community.callOut("police", M.call911, go);
    else go();
    return true;
}

export function watchTick(dt) {
    const g = WATCH.guy;
    if (!g || !WATCH.at) return;
    if (!g.keep()) return;
    const at = WATCH.at, p = g.p;
    if (WATCH.state === "busted") { p.obj.visible = false; return; }
    if (WATCH.state === "away") {
        p.obj.visible = false;
        WATCH.awayT -= dt;
        if (WATCH.awayT <= 0 && !copWatching(at.x, at.z, K.copR)) { WATCH.state = "out"; p.obj.visible = true; log("watch", { phase: "back" }); }
        return;
    }
    // paces the sidewalk (stops to talk while she's at the card)
    WATCH.talkT -= dt;
    const lp = luluPos(), snitch = mem("shmuly").mood === "snitch";
    if (WATCH.talkT <= 0) {
        WATCH.u += WATCH.dir * K.speed * dt;
        if (Math.abs(WATCH.u) > K.pace) WATCH.dir = -Math.sign(WATCH.u);
        g.x = at.x + at.ux * WATCH.u; g.z = at.z + at.uz * WATCH.u;
        g.sync();
        p.face(g.x + at.ux * WATCH.dir, g.z + at.uz * WATCH.dir, dt, 6);
        p.update(dt, { walk: K.speed });
    } else { p.face(lp.x, lp.z, dt, 6); p.update(dt, { talk: true }); }
    WATCH.lookT -= dt;
    if (WATCH.lookT > 0) return;
    WATCH.lookT = 0.5;
    const near = Math.hypot(lp.x - g.x, lp.z - g.z);
    if (!WATCH.reported && (copWatching(g.x, g.z, K.copR) || (snitch && near < 8))) {
        WATCH.state = "away"; WATCH.awayT = K.backAfter;
        if (near < 30) bubble(pick(M.run), p.obj, { y: 2.1, dur: 1.6 });
        stat("crimeWatchRuns");
        log("watch", { phase: "away", why: snitch ? "snitch" : "cop" });
    }
}
export function watchReason() {
    if (!here() || WATCH.reported || !live()) return null;
    const lp = luluPos();
    if (Math.hypot(lp.x - WATCH.guy.x, lp.z - WATCH.guy.z) > 60) return null;
    return { id: "crimeWatch", icon: "⌚", label: M.phoneLabel, sub: M.phoneSub, run: () => ctx.community.callOut("police", M.call911, () => report("phone")) };
}
