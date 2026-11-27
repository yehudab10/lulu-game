// features/together — from OUTSIDE: a friend who walks into a building is seen stepping in through the door.
// (The party hides a friend the moment they're inside — d.m = 7 — so without this they'd just blink out on the
// doorstep.) When a walking friend I can see goes inside, a stand-in of them takes the last two steps through the
// door (~0.6 s) and is gone; their nametag then waits over the door (party/presence.js) until they come back out —
// at the door. One Person rig for those 0.6 s; nothing otherwise.
import { ctx, emit } from "../../core/ctx.js";
import { models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";

const L = new Map();          // uid → { x, z, h, hc, seen } (the last place I drew them walking)
const steps = [];             // the stand-ins walking in

export function tick(dt) {
    const P = ctx.party;
    if (!P || !P.active || !ctx.scene) { clear(); return; }
    for (const uid of P.members()) {
        if (uid === P.uid) continue;
        const rc = P.remoteCar(uid), p = P.peer(uid);
        if (rc && rc.shown && rc.foot) { L.set(uid, { x: rc.x, z: rc.z, h: rc.h, hc: p && p.hc, ot: p && p.x && typeof p.x.ot === "string" ? p.x.ot : "", at: performance.now() }); continue; }
        const last = L.get(uid);
        if (!last) continue;
        // gone from the street: inside (m 7, presence "in") within a moment of the last step I drew — not a warp,
        // not a scene elsewhere (the presence can land a snapshot after they vanish: wait up to 4 s for it (a slow device))
        if (performance.now() - last.at > 4000 || !p) { L.delete(uid); continue; }
        const pr = P.presenceOf(uid);
        if (p.m !== 7 || !pr || pr.mode !== "in") continue;
        L.delete(uid);
        if (ctx.view || !models.luluPerson) continue;
        try {
            const q = spawnPerson("luluPerson", { colors: last.hc ? { Hair: last.hc } : null, outfit: last.ot && ctx.clothes ? ctx.clothes.decode(last.ot) : false });
            q.obj.position.set(last.x, 0.05, last.z);
            q.obj.rotation.y = last.h;
            ctx.scene.add(q.obj);
            steps.push({ q, t: 0, fx: Math.sin(last.h), fz: Math.cos(last.h), uid });
            emit("together:stepin", { uid });
        } catch (e) { /* cosmetic */ }
    }
    for (let i = steps.length - 1; i >= 0; i--) {
        const s = steps[i];
        s.t += dt;
        s.q.obj.position.x += s.fx * 2.2 * dt;
        s.q.obj.position.z += s.fz * 2.2 * dt;
        s.q.update(dt, { walk: 2.2 });
        if (s.t > 0.6 || ctx.view) { s.q.obj.removeFromParent(); steps.splice(i, 1); }
    }
}
function clear() { L.clear(); for (const s of steps) s.q.obj.removeFromParent(); steps.length = 0; }
/** Tests: the stand-ins stepping in right now ([uid]). */
export const stepping = () => steps.map(s => s.uid);
