// features/crime — 🏷️ THE MATTRESS-TAG RING (on foot; a tip from the Fixer — features/underworld's Fixer, his own 💬 thread).
//
// Once a REAL day, DRIVING into a town (a chance; never while she's hot — underworld's heat over its maxHeat), the Fixer
// texts: "Mattresses on the kerb, <street>. Tags still on. Rip all 4." Four mattresses lean on the kerb 30–110 m from her.
// ✋ RIP THE TAG on each (*RRRIP* — passers-by gasp). All four → PAY.tags.all 💰 (once a REAL day) + a little heat. The risk:
// a cop who SEES a rip — the ⚠️ look, the next one = a foot chase for MATTRESS TAG REMOVAL. The sanitation truck comes
// in TUNE.tags.within s: whatever's left goes with it.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { PAY, TUNE, LINES, SAVE, dirty, log, stat, pick, fill, lulu, bubble, mustSee, bakeBoxes, footCrime, payCapped, live, luluPos, today, streetAt } from "./common.js";
import { CHARGES } from "./data.js";

const K = TUNE.tags, M = LINES.tags;
export const TAGS = { list: [], geos: [], group: null, t: 0, spotRms: [], street: "", done: false };

function fixerText(msg) { try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: "THE FIXER", emoji: "🕶️", color: "#455A64", msg, thread: "fixer", dur: 5 }); } catch (e) { /* no phone */ } }

/** Coming into town: maybe the Fixer has a job (once a real day). force: tests. → bool */
export function maybeTip(force = false) {
    if (TAGS.group || (!force && (SAVE.tagsDay === today() || Math.random() > 0.6))) return false;
    try { const uw = ctx.underworld; if (!force && uw && uw.heat > 70) return false; } catch (e) { /* none */ }
    return place();
}
function place() {
    const lp = luluPos(), T = ctx.town && ctx.town.plan;
    if (!T) return false;
    // a street with a parking lane, a stretch 30–110 m from her
    const road = ctx.world.road;
    let best = null;
    for (const st of T.STREETS) {
        if (!st.parkLane || st.cross.length < 2) continue;
        for (let k = 0; k < st.cross.length - 1; k++) {
            const a = (st.cross[k].a + st.cross[k + 1].a) / 2, len = st.cross[k + 1].a - st.cross[k].a;
            if (len < 34) continue;
            const p = road.point(st.base + a, st.curb + 0.7, {}), d = Math.hypot(p.x - lp.x, p.z - lp.z);
            if (d < K.minD || d > K.maxD) continue;
            if (!best || Math.abs(d - 60) < best.e) best = { st, a, e: Math.abs(d - 60) };
        }
    }
    if (!best) { log("tags", { phase: "noSpot" }); return false; }
    const g = TAGS.group = new THREE.Group();
    g.name = "crimeMattresses";
    const colors = ["#ECEFF1", "#F8BBD0", "#E1F5FE", "#FFF9C4"];
    for (let i = 0; i < K.n; i++) {
        const along = best.a + (i - (K.n - 1) / 2) * 3.2, side = 1;
        const p = road.point(best.st.base + along, side * (best.st.curb + 0.75), {});
        const q = road.point(best.st.base + along + 1, side * (best.st.curb + 0.75), {});
        const yaw = Math.atan2(q.x - p.x, q.z - p.z);
        const m = new THREE.Group();
        m.add(bakeBoxes([
            { w: 1.4, h: 1.9, d: 0.24, y: 0.95, z: 0, rx: -0.18, color: colors[i % colors.length] },
            { w: 1.42, h: 0.06, d: 0.26, y: 0.03, rx: -0.18, color: "#B0BEC5" },
        ], TAGS.geos));
        const tag = bakeBoxes([{ w: 0.16, h: 0.22, d: 0.02, x: 0.55, y: 0.35, z: 0.2, color: "#FFFFFF" }], TAGS.geos);
        m.add(tag);
        m.position.set(p.x, 0, p.z);
        m.rotation.y = yaw + Math.PI / 2;
        g.add(m);
        TAGS.list.push({ i, x: p.x, z: p.z, obj: m, tag, ripped: false });
    }
    ctx.scene.add(g);
    TAGS.t = 0; TAGS.done = false; TAGS.street = best.st.name;
    for (const tg of TAGS.list) TAGS.spotRms.push(ctx.foot && ctx.foot.addSpot ? ctx.foot.addSpot(spotFor(tg)) : () => {});
    SAVE.tagsDay = today(); dirty();
    fixerText(fill(pick(M.tip), { street: best.st.name, n: K.n }));
    log("tags", { phase: "tip", street: best.st.name });
    return true;
}
function spotFor(tg) {
    return {
        r: 1.9, short: M.short, first: false,
        pos() { return !tg.ripped && TAGS.group && live() ? { x: tg.x, z: tg.z } : null; },
        label() { return M.spot; },
        act() { rip(tg); },
    };
}
export function rip(tg) {
    if (!tg || tg.ripped || TAGS.done) return false;
    tg.ripped = true;
    tg.tag.visible = false;
    lulu(pick(M.rip), true);
    // somebody on the street gasps
    try {
        const ppl = ctx.town.people ? ctx.town.people() : [];
        const near = ppl.filter(p => Math.hypot(p.x - tg.x, p.z - tg.z) < 20)[0];
        if (near) { const a = new THREE.Object3D(); a.position.set(near.x, 1.9, near.z); ctx.scene.add(a); bubble(pick(M.gasp), a, { y: 0.1, dur: 1.8 }); setTimeout(() => a.removeFromParent(), 2500); }
    } catch (e) { /* none */ }
    stat("crimeTags");
    const n = TAGS.list.filter(x => x.ripped).length;
    log("tags", { phase: "rip", n });
    if (footCrime("tags", CHARGES.tags.name, { x: tg.x, z: tg.z }) === "chase") { finish("cop"); return true; }
    if (n >= TAGS.list.length) finish("all");
    return true;
}
function finish(why) {
    if (TAGS.done) return;
    TAGS.done = true;
    log("tags", { phase: "end", why });
    if (why === "all") {
        const paid = payCapped("tags", PAY.tags.all, PAY.tags.perDay);
        try { if (ctx.underworld && ctx.underworld.addHeat) ctx.underworld.addHeat(PAY.tags.heat, "tags"); } catch (e) { /* none */ }
        lulu(pick(M.lulu));
        mustSee(fill(M.done, { n: TAGS.list.length }) + (paid > 0 ? ` · +${paid} 💰` : ""), paid > 0 ? "gold" : "", "crime:tags");
        fixerText("Pleasure doing business. Burn the tags. Or frame them. Your call. — F.");
    } else if (why === "late") mustSee(M.late, "", "crime:tags");
}
export function tagsTick(dt) {
    if (!TAGS.group) return;
    TAGS.t += dt;
    if (!TAGS.done && TAGS.t > K.within) finish("late");
    // the truck took them / she's long gone: tidy up
    const lp = luluPos(), far = TAGS.list.every(tg => Math.hypot(tg.x - lp.x, tg.z - lp.z) > 140);
    if ((TAGS.done && far) || TAGS.t > K.within + 60) clearTags();
}
export function clearTags() {
    for (const rm of TAGS.spotRms) rm();
    TAGS.spotRms.length = 0;
    if (TAGS.group) TAGS.group.removeFromParent();
    for (const g of TAGS.geos) g.dispose();
    TAGS.geos.length = 0;
    TAGS.list.length = 0; TAGS.group = null;
}
export { streetAt };
