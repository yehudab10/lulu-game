// features/crime — 🚶‍♀️ THE JAYWALKING SPREE (on foot, self-inflicted).
//
// Crossing a town street MID-BLOCK (≥ TUNE.jay.midBlock m from any crossing), kerb to kerb in ≤ crossMax s, is a
// jaywalk. Another within `combo` s grows the combo (JAYWALK ×2, ×3…, a bubble over her); a car whizzing by within dodgeR
// mid-crossing is a 😅 CLOSE ONE. When the combo lapses: from ×PAY.jaywalk.from on, PAY.jaywalk.each a crossing (+1 a
// close one), ≤ perDay coins a REAL day — one must-see line. The risk: every crossing a cop SEES is the ⚠️ look, the
// next one while it's live a foot chase for SERIAL JAYWALKING. Never in a chase (she's running for it anyway).
import { ctx } from "../../core/ctx.js";
import { PAY, TUNE, LINES, log, stat, pick, fill, lulu, bubble, mustSee, streetAt, footCrime, payCapped, walking, chasing } from "./common.js";
import { CHARGES } from "./data.js";

const J = TUNE.jay;
export const JAY = { side: 0, st: -1, kerbT: 0, cross: null, combo: 0, lastT: -99, pend: 0, dodges: 0, total: 0 };

export function resetJay() { Object.assign(JAY, { side: 0, st: -1, kerbT: 0, cross: null, combo: 0, lastT: -99, pend: 0, dodges: 0 }); }

/** Every frame while she walks in town. */
export function jayTick(dt, on) {
    if (JAY.combo && ctx.time - JAY.lastT > J.combo) settle();
    if (!on || !walking() || chasing()) { JAY.cross = null; return; }
    const F = ctx.foot.pos;
    const sa = streetAt(F.x, F.z, ctx.foot.debug && ctx.foot.debug.F ? ctx.foot.debug.F.s : undefined);
    if (!sa) { JAY.cross = null; return; }
    const kerb = sa.curb + 0.3, side = Math.sign(sa.d);
    if (Math.abs(sa.d) > kerb && Math.abs(sa.d) < sa.walk + 1.5) {
        // on a sidewalk: did she just finish a crossing from the other one?
        const c = JAY.cross;
        if (c && c.st === sa.st.id && c.side === -side && ctx.time - c.t0 <= J.crossMax && c.mid >= J.midBlock) jaywalk(c, F);
        JAY.cross = null;
        JAY.side = side; JAY.st = sa.st.id; JAY.kerbT = ctx.time;
        return;
    }
    if (Math.abs(sa.d) <= kerb) {
        // in the street: the crossing that started at the kerb she just left
        let c = JAY.cross;
        if (!c || c.st !== sa.st.id) {
            if (JAY.st !== sa.st.id || ctx.time - JAY.kerbT > 2.5) { JAY.cross = null; return; }
            c = JAY.cross = { st: sa.st.id, side: JAY.side, t0: ctx.time, mid: 1e9, dodge: false };
        }
        c.mid = Math.min(c.mid, sa.mid);
        if (!c.dodge) for (const car of ctx.traffic.cars) {
            if (car.speed > J.dodgeSpeed && Math.hypot(car.x - F.x, car.z - F.z) < J.dodgeR) { c.dodge = true; break; }
        }
    }
}

function jaywalk(c, at) {
    JAY.combo = ctx.time - JAY.lastT <= J.combo ? JAY.combo + 1 : 1;
    JAY.lastT = ctx.time;
    JAY.total++;
    if (JAY.combo >= PAY.jaywalk.from) JAY.pend += PAY.jaywalk.each + (c.dodge ? 1 : 0);
    if (c.dodge) JAY.dodges++;
    stat("crimeJaywalks");
    const me = ctx.foot.obj;
    if (JAY.combo >= 2) bubble(fill(LINES.jaywalk.combo, { n: JAY.combo }) + (c.dodge ? " · " + LINES.jaywalk.dodge : ""), me, { y: 2.3, cls: "nice", dur: 1.6 });
    else if (c.dodge) bubble(LINES.jaywalk.dodge, me, { y: 2.3, cls: "nice", dur: 1.4 });
    else if (Math.random() < 0.5) lulu(pick(LINES.jaywalk.first));
    log("jaywalk", { n: JAY.combo, dodge: c.dodge, mid: Math.round(c.mid) });
    if (footCrime("jaywalk", CHARGES.jaywalk.name, { x: at.x, z: at.z }) === "chase") settle(true);
}

/** The combo's over: pay it (capped a real day). */
function settle(busted = false) {
    const n = JAY.combo, want = JAY.pend;
    JAY.combo = 0; JAY.pend = 0;
    if (busted || n < PAY.jaywalk.from) return 0;
    const paid = payCapped("jaywalk", want, PAY.jaywalk.perDay);
    stat("crimeJaywalkSprees");
    mustSee(`${PAY.jaywalk.name} ×${n}${paid > 0 ? ` · +${paid} 💰` : " · (no more coins for it today)"}`, paid > 0 ? "gold" : "", "crime:jay");
    log("jaywalk", { settle: n, paid });
    return paid;
}
export { settle as settleJay };
