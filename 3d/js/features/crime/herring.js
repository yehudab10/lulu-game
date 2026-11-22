// features/crime — 🐟 THE KIDDUSH HEIST (on foot, opt-in). ON THE STREET ONLY: a folding table the kiddush club set up on
// the SIDEWALK outside the hall (or the bakery) — nothing inside a shul is ever a crime scene (ci/shul builds the shuls).
//
// Reb Getzel, the gabbai, guards the GOOD herring (wine sauce) and keeps turning to argue with his friend about the kichel.
// ✋ SWIPE while he's looking away (his view cone: TUNE.herring.coneDeg / coneR) → walk off `away` m with it, unseen →
// "Mendy across the street pays": PAY.herring.pay 💰 (once a REAL day). Seen swiping (or with it in her hands inside his cone
// before she's away) → "GANEF! The HERRING!": he snatches it back — and a cop who SEES it gives the ⚠️ look, then a chase
// for PETTY HERRING THEFT.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { PAY, TUNE, LINES, log, stat, pick, lulu, bubble, mustSee, bakeBoxes, townSpot, footCrime, payCapped, live, onFoot, luluPos, paidToday } from "./common.js";
import { CHARGES } from "./data.js";
import { Character } from "./street.js";

const K = TUNE.herring, M = LINES.herring;
export const HER = { table: null, jar: null, geos: [], at: null, getzel: null, buddy: null, look: 0, lookT: 3, carry: null, spotRm: null, chatT: 4, said: false };

export function buildHerring() {
    clearHerring();
    const at = townSpot(["hall", "bakery", "pizza"], -9, 1.3);
    if (!at) return false;
    HER.at = at;
    const g = new THREE.Group();
    g.add(bakeBoxes([
        { w: 1.6, h: 0.05, d: 0.7, y: 0.76, color: "#FFFFFF" },
        { w: 1.62, h: 0.3, d: 0.72, y: 0.62, color: "#E3F2FD" },                     // the tablecloth's skirt
        { w: 0.05, h: 0.6, d: 0.05, x: -0.7, y: 0.3, z: -0.28, color: "#9E9E9E" }, { w: 0.05, h: 0.6, d: 0.05, x: 0.7, y: 0.3, z: -0.28, color: "#9E9E9E" },
        { w: 0.05, h: 0.6, d: 0.05, x: -0.7, y: 0.3, z: 0.28, color: "#9E9E9E" }, { w: 0.05, h: 0.6, d: 0.05, x: 0.7, y: 0.3, z: 0.28, color: "#9E9E9E" },
        { w: 0.3, h: 0.04, d: 0.3, x: -0.45, y: 0.8, color: "#FFE0B2" },             // the kichel plate
        { w: 0.08, h: 0.28, d: 0.08, x: 0.5, y: 0.92, color: "#4E342E" },             // the l'chaim bottle
        { w: 0.14, h: 0.12, d: 0.14, x: -0.05, y: 0.84, color: "#FFF8E1" },           // the cream-sauce one (nobody wants it)
    ], HER.geos));
    HER.jar = bakeBoxes([{ w: 0.16, h: 0.2, d: 0.16, y: 0.1, color: "#B71C1C" }, { w: 0.17, h: 0.04, d: 0.17, y: 0.22, color: "#FFD54F" }], HER.geos);
    HER.jar.position.set(0.18, 0.78, 0);
    g.add(HER.jar);
    g.position.set(at.x, 0, at.z);
    g.rotation.y = at.yaw;
    ctx.scene.add(g);
    HER.table = g;
    HER.getzel = new Character({ key: "npcMan", colors: { Shirt: "#FFFFFF", Pants: "#111111", Hat: "#111111" }, name: M.gabbai });
    HER.getzel.place(at.x - at.nx * 0.8 + at.ux * 0.4, at.z - at.nz * 0.8 + at.uz * 0.4, at.yaw);
    HER.buddy = new Character({ key: "npcMan", colors: { Shirt: "#ECEFF1", Pants: "#263238" }, name: "Shmerel" });
    HER.buddy.place(at.x - at.nx * 0.6 + at.ux * 1.9, at.z - at.nz * 0.6 + at.uz * 1.9, at.yaw - Math.PI / 2);
    HER.carry = null; HER.gone = false; HER.look = 0; HER.lookT = K.lookTurn[0];
    if (ctx.foot && ctx.foot.addSpot) HER.spotRm = ctx.foot.addSpot(spot);
    log("herring", { phase: "built", key: at.key });
    return true;
}
export function clearHerring() {
    if (HER.spotRm) { HER.spotRm(); HER.spotRm = null; }
    if (HER.getzel) HER.getzel.clear();
    if (HER.buddy) HER.buddy.clear();
    if (HER.table) HER.table.removeFromParent();
    if (HER.carry && HER.jar) HER.jar.removeFromParent();
    for (const g of HER.geos) g.dispose();
    HER.geos.length = 0;
    Object.assign(HER, { table: null, jar: null, getzel: null, buddy: null, carry: null, at: null });
}
/** Is (x, z) inside Getzel's view cone right now? */
export function getzelSees(x, z) {
    const g = HER.getzel;
    if (!g || !g.p) return false;
    const yaw = g.p.obj.rotation.y, dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz);
    if (d > K.coneR) return false;
    if (d < 1.2) return true;
    const a = Math.atan2(dx, dz) - yaw, w = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(w) < (K.coneDeg * Math.PI / 180) / 2;
}
const jarAt = () => { const v = new THREE.Vector3(); HER.jar.getWorldPosition(v); return v; };
const spot = {
    r: K.grabR + 0.6, short: M.short,
    pos() { if (!HER.table || HER.carry || HER.gone || !live() || !HER.getzel.p) return null; const v = jarAt(); return { x: v.x + HER.at.nx * 0.7, z: v.z + HER.at.nz * 0.7 }; },
    label() { const lp = luluPos(); return getzelSees(lp.x, lp.z) ? M.wait : M.spot; },
    act() { swipe(); },
};

export function swipe() {
    if (!HER.table || HER.carry || !onFoot()) return false;
    const lp = luluPos();
    stat("crimeHerringTries");
    if (getzelSees(lp.x, lp.z)) { caught("swipe"); return false; }
    HER.carry = { t: 0, x0: lp.x, z0: lp.z };
    HER.table.remove(HER.jar);
    const me = ctx.foot.obj;
    if (me) { me.add(HER.jar); HER.jar.position.set(0.2, 0.95, 0.3); }
    lulu(pick(M.swiped), true);
    log("herring", { phase: "swipe" });
    return true;
}
function caught(why) {
    const g = HER.getzel;
    if (g && g.obj) bubble(pick(M.caught), g.obj, { y: 2.2, cls: "angry", dur: 2.4 });
    if (HER.carry) { HER.carry = null; HER.jar.removeFromParent(); HER.table.add(HER.jar); HER.jar.position.set(0.18, 0.78, 0); }
    HER.lookT = 6; HER.look = 0;           // (he's watching you NOW)
    stat("crimeHerringCaught");
    log("herring", { phase: "caught", why });
    const lp = luluPos();
    footCrime("herring", CHARGES.herring.name, lp);
}
export function herringTick(dt) {
    if (!HER.table) return;
    const on = HER.getzel.keep();
    HER.buddy.keep();
    if (!on) return;
    const g = HER.getzel, b = HER.buddy, at = HER.at, lp = luluPos();
    // he looks at the table (+ the street) … then turns to argue about the kichel
    HER.lookT -= dt;
    if (HER.lookT <= 0) { HER.look = HER.look ? 0 : 1; HER.lookT = K.lookTurn[0] + Math.random() * (K.lookTurn[1] - K.lookTurn[0]); }
    const want = HER.look ? Math.atan2(b.x - g.x, b.z - g.z) : at.yaw;
    const o = g.p.obj, dy = Math.atan2(Math.sin(want - o.rotation.y), Math.cos(want - o.rotation.y));
    o.rotation.y += dy * Math.min(1, dt * 5);
    g.p.update(dt, { talk: HER.look === 1 });
    if (b.p) { b.p.face(g.x, g.z, dt, 4); b.p.update(dt, { talk: HER.look === 1 && Math.sin(ctx.time * 2) > 0 }); }
    HER.chatT -= dt;
    if (HER.chatT <= 0) { HER.chatT = 7 + Math.random() * 5; if (Math.hypot(lp.x - g.x, lp.z - g.z) < 25) bubble(pick(M.chatter), HER.look ? b.obj : g.obj, { y: 2.1, cls: "nice", dur: 1.8 }); }
    if (!HER.said && Math.hypot(lp.x - g.x, lp.z - g.z) < 9) { HER.said = true; lulu(pick(M.lulu)); }
    // carrying it away
    const C = HER.carry;
    if (!C) return;
    C.t += dt;
    if (!onFoot()) { clean(); return; }
    const d = Math.hypot(lp.x - at.x, lp.z - at.z);
    if (d < K.coneR && getzelSees(lp.x, lp.z) && C.t > 0.3) { caught("seen"); return; }
    if (d > K.away) clean();
}
function clean() {
    HER.carry = null; HER.gone = true;
    if (HER.jar) HER.jar.removeFromParent();
    stat("crimeHerring");
    const paid = payCapped("herring", PAY.herring.pay, PAY.herring.perDay);
    mustSee(M.clean + (paid > 0 ? ` · +${paid} 💰` : ""), paid > 0 ? "gold" : "", "crime:herring");
    log("herring", { phase: "clean", paid });
    // (a fresh jar on the table next time she's in town — the club always has more)
}
export const herringPaidToday = () => paidToday("herring");
