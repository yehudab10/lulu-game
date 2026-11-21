// features/life — 👣 FRIENDS' FOOTSTEPS (round 2): in a 🎉 party, a friend walking near her is heard as well as seen —
// the same surface-aware steps as hers (steps.js: the sidewalk, a lawn, a puddle, snow, a car roof…), from where they
// are, a little quieter. Read-only through ctx.party (members(), remoteCar(uid): x, z, vx, vz, foot, anim, footY,
// shown — party/remote.js' interpolated pose); nothing is sent. The 4 nearest walking friends within 26 m.
import { ctx } from "../../core/ctx.js";
import { L, stats, soundsOn } from "./common.js";
import { play } from "./sounds.js";
import { point, KIND, RATE } from "./steps.js";
import { puddleAt } from "./puddles.js";

export const FR = { uids: [], listT: 0, near: 0, steps: 0, ph: new Map(), surfT: new Map(), surf: new Map(), fake: null };
/** Tests: a stand-in for ctx.party ({ active, uid, members(), remoteCar(uid) }) — a real party needs two pages + a relay. */
export function fakeParty(p) { FR.fake = p || null; FR.listT = 0; FR.ph.clear(); return !!FR.fake; }
const R = 26, N = 4;

function surfaceAt(x, z, y) {
    if (y > 0.3) return y > 0.85 ? "metal" : "wood";
    if (puddleAt(x, z) > 0.25) return "puddle";
    let s = "asphalt";
    if (L.town && ctx.town.hideSpot) {
        const r = ctx.town.hideSpot(x, z), k = r && r.spot;
        s = k === "walk" ? "concrete" : k === "yard" || k === "mall" ? "grass" : "asphalt";
    } else if (!L.town) s = "gravel";             // the highway on foot: the verge, mostly
    if (L.snow && s !== "metal") return "snow";
    if ((s === "concrete" || s === "asphalt") && L.wet > 0.35) return "wet";
    return s;
}
export function tickFriendSteps(dt) {
    const P = FR.fake || ctx.party;
    FR.near = 0;
    if (!P || !P.active || !P.remoteCar || !L.on) return;
    FR.listT -= dt;
    if (FR.listT <= 0) { FR.listT = 0.5; try { FR.uids = P.members().filter(u => u !== P.uid); } catch (e) { FR.uids = []; } }
    let n = 0;
    for (const uid of FR.uids) {
        if (n >= N) break;
        const rc = P.remoteCar(uid);
        if (!rc || !rc.shown || !rc.foot || !rc.walker) { FR.ph.delete(uid); continue; }
        const dx = rc.x - L.x, dz = rc.z - L.z;
        if (dx * dx + dz * dz > R * R) { FR.ph.set(uid, 0); continue; }
        n++;
        const air = (rc.footY || 0) > 0.05 && (rc.anim === 10);
        const v = Math.hypot(rc.vx || 0, rc.vz || 0);
        if (air || (rc.anim !== 0 && rc.anim !== 3) || v < 0.4) { FR.ph.set(uid, 0); continue; }
        let t = (FR.surfT.get(uid) || 0) - dt;
        if (t <= 0) { t = 0.3; try { FR.surf.set(uid, surfaceAt(rc.x, rc.z, rc.footY || 0)); } catch (e) { FR.surf.set(uid, "asphalt"); } }
        FR.surfT.set(uid, t);
        const before = FR.ph.get(uid) || 0, ph = before + dt * (2.2 + v * 2.4);
        FR.ph.set(uid, ph);
        if (Math.floor(before / Math.PI) === Math.floor(ph / Math.PI)) continue;
        FR.steps++; stats.friendSteps = FR.steps;
        if (!soundsOn() || L.quiet) continue;
        const s = FR.surf.get(uid) || "asphalt";
        play(KIND[s] || "lifeStep", point(rc.x, 0.05 + (rc.footY || 0), rc.z), { gain: (v > 5.5 ? 0.95 : 0.7) * (0.85 + Math.random() * 0.3), rate: (RATE[s] || 1) * (0.9 + Math.random() * 0.2) });
    }
    FR.near = n;
}
export function friendStepInfo() { let last = ""; for (const v of FR.surf.values()) last = v; return { near: FR.near, steps: FR.steps, surf: last }; }
