// features/party — PRESENCE: what each friend is doing, and the bits of their world
// that friends should see even though the scene itself is personal.
//
//  • my presence  — ctx.party.presence({ mode, icon, label }) from any feature (or the
//                   automatic one from the state I'm in: 🚗 driving · 🚶‍♀️ on foot · 🍺 in
//                   The Thirsty Scholar · 🚔 in jail · ⚖️ in court · 🏥 in the ER · 🎬 a
//                   cutscene…). Rides in my snapshots as d.x.pr = [mode, icon, label].
//  • friends' world layer (THIS screen draws them):
//      🚗 the car a walking friend left behind (d.x.pc: world x/z ×10, heading ×1000,
//         model key + paint for a borrowed ride, wrecked) — hazards blinking
//      🚓 the cruisers chasing a friend (d.x.cp: up to 3 poses, world x/z ×10 + heading):
//         puppet cop cars with law's flashing light bar + a located siren, interpolated
//         ~200 ms in the past between snapshots
//      🏷 a friend who's inside somewhere (m = 7, d.x.at): their nametag over the door /
//         their parked car, with the presence ("🍺 in The Thirsty Scholar")
//  The highway's world coordinates are the same on every screen (the road is built from
//  one fixed seed) and a town sits at the same exit for everyone in 🌍 Free Roam, so
//  these extras are plain world x/z — no frame conversion, ~20 bytes each.
import * as THREE from "three";
import { ctx, wrapAngle } from "../../core/ctx.js";
import { models, cloneWithColors, findNodes, ensureModels } from "../../models.js";
import * as AU from "../../audio.js";
import { N, clock, fresh, setX } from "./net.js";
import * as R from "./remote.js";

// ── my presence ──────────────────────────────────────────────────────────
const ME = { explicit: null, expState: "", sticky: false, pr: null };
/** Another feature says what I'm doing. p = { mode, icon, label } (null → back to the automatic one).
 *  It holds until my state changes (opts.sticky: until cleared). */
export function setPresence(p, opts = {}) {
    if (!p) { ME.explicit = null; return true; }
    ME.explicit = { mode: String(p.mode || "scene").slice(0, 10), icon: String(p.icon || "🎬").slice(0, 8), label: String(p.label || "").slice(0, 40) };
    ME.expState = ctx.state; ME.sticky = !!opts.sticky;
    return true;
}
const V_ICON = { cop: "🚓", ambulance: "🚑", bus: "🚌", dozer: "🚜" };
const K_ICON = { truck: "🚚", van: "🚐", streets_sports: "🏎️" };
/** What a ride looks like as an emoji (its model key / vtype). */
export function rideIcon(kind, vtype) {
    if (!kind) return "🚗";
    if (/ice/.test(kind)) return "🍦";
    if (/taxi|cab/.test(kind)) return "🚕";
    return K_ICON[kind] || V_ICON[vtype] || V_ICON[kind] || (/bus/.test(kind) ? "🚌" : /amb/.test(kind) ? "🚑" : "🚗");
}
const AUTO = {
    footRun: ["foot", "🚶‍♀️", "on foot"],
    lawBust: ["law", "🚨", "getting pulled over"],
    lawStop: ["law", "🚓", "pulling someone over"],
    lawArrest: ["jail", "🚔", "under arrest"],
    lawJail: ["jail", "🚔", "in jail"],
    lawCourt: ["court", "⚖️", "in court"],
    lawExit: ["jail", "🚔", "getting out of jail"],
    cameosER: ["er", "🏥", "in the ER"],
    cameosAmbulance: ["er", "🚑", "in an ambulance"],
    footWedding: ["scene", "💍", "at Avigail's wedding"],
    streetsPaint: ["scene", "🎨", "at Paint & Pray"],
    playPhoto: ["scene", "📸", "taking a photo"],
    partyLobby: ["lobby", "🎉", "in the lobby"],
    partySpectate: ["watch", "👀", "watching"],
    partyResults: ["done", "🏁", "at the finish"],
    partyWait: ["done", "🏁", "waiting for the gang"],
};
/** My presence right now: [mode, icon, label]. */
export function myPresence() {
    const st = ctx.state;
    if (ME.explicit && !ME.sticky && ME.expState !== st) ME.explicit = null;
    if (ME.explicit) return [ME.explicit.mode, ME.explicit.icon, ME.explicit.label];
    if (st === "playing" || st === "partyGrid" || st === "intro") {
        const w = ctx.law ? ctx.law.wanted | 0 : 0;
        const v = ctx.foot && ctx.foot.vehicle;
        if (ctx.law && ctx.law.chasing) return ["chase", "🚨", `on the run ${"★".repeat(Math.max(1, w))}`];
        if (v) {
            const r = ctx.rides && ctx.rides.current, nm = r && r.def && r.def.name ? String(r.def.name).toLowerCase() : "";
            return ["drive", rideIcon(v.kind, v.vtype), nm ? `driving a ${nm}` : "driving a “borrowed” ride"];
        }
        return ["drive", "🚗", "driving"];
    }
    if (st === "interior") {
        const id = ctx.stateData && ctx.stateData.id, reg = id && ctx.interiors && ctx.interiors[id];
        return ["in", (reg && reg.emoji) || "🚪", `in ${(reg && reg.name) || "a building"}`];
    }
    if (AUTO[st]) return AUTO[st];
    return ["scene", "🎬", "in a cutscene"];
}
/** Publish it (once per frame from the party tick; the array only changes when the presence does). */
export function publishPresence() {
    const p = myPresence();
    const cur = ME.pr;
    if (!cur || cur[0] !== p[0] || cur[1] !== p[1] || cur[2] !== p[2]) { ME.pr = p.slice(); setX("pr", ME.pr); }
    return ME.pr;
}
/** A friend's presence (from their snapshot) → { mode, icon, label } | null. */
export function presenceOf(p) {
    const x = p && p.x, a = x && Array.isArray(x.pr) ? x.pr : null;
    if (!a) return null;
    return { mode: String(a[0] || ""), icon: String(a[1] || "").slice(0, 8), label: String(a[2] || "").slice(0, 40) };
}
/** One short status chip for a friend's nametag / the boards: "" when they're just driving. */
export function presenceBadge(p) {
    const pr = presenceOf(p);
    const ws = p && p.x && (p.x.ws | 0);
    const stars = ws > 0 ? "🚨" + "★".repeat(Math.min(5, ws)) : "";
    if (!pr || pr.mode === "drive" || pr.mode === "chase") return stars || (pr && pr.mode === "drive" && pr.icon !== "🚗" ? pr.icon : "");
    return pr.icon + (stars ? " " + stars : "");
}

// ── friends' world layer ─────────────────────────────────────────────────
const W = new Map();            // uid → { parked, cops: [], tag, seq }
const tmpV = new THREE.Vector3();
let hazGeo = null, hazMat = null;
function hazards(obj, len = 1.95, half = 0.72) {
    if (!hazGeo) { hazGeo = new THREE.SphereGeometry(0.09, 10, 8); hazMat = new THREE.MeshStandardMaterial({ color: "#FFB300", emissive: "#FFB300", emissiveIntensity: 2.5 }); }
    const out = [];
    for (const sx of [-half, half]) for (const sz of [-len, len]) { const b = new THREE.Mesh(hazGeo, hazMat); b.position.set(sx, 0.78, sz); obj.add(b); out.push(b); }
    return out;
}

/** The car a walking friend left: their own convertible (their skin) or the borrowed ride's model. */
class ParkedCar {
    constructor() { this.root = new THREE.Group(); this.key = null; this.obj = null; this.haz = []; this.root.visible = false; ctx.scene.add(this.root); }
    set(key, skin, paint, hair) {
        const k = key + "|" + skin + "|" + paint;
        if (k === this.key) return true;
        let obj = null;
        if (key === "lulu") {
            obj = cloneWithColors(models.lulu, R.skinColors(skin));
            for (const n of [...findNodes(obj, "Driver"), ...findNodes(obj, "Hair_")]) n.visible = false;
        } else if (models[key]) obj = cloneWithColors(models[key], paint ? { Paint: paint } : null);
        else { ensureModels([key]).catch(() => { }); return false; }
        if (this.obj) this.root.remove(this.obj);
        this.obj = obj; this.key = k;
        this.root.add(obj);
        for (const h of this.haz) h.removeFromParent();
        this.haz = hazards(obj, key === "foot_bus" ? 5.2 : 1.95, key === "foot_bus" ? 1.2 : 0.72);
        return true;
    }
    dispose() { this.root.removeFromParent(); }
}

/** A puppet cruiser chasing a friend (their screen owns the AI; we only draw it). */
class Puppet {
    constructor() {
        this.obj = cloneWithColors(models.cop, null);
        this.obj.visible = false;
        ctx.scene.add(this.obj);
        this.bar = ctx.law && ctx.law.lightBar ? ctx.law.lightBar(this.obj) : null;
        this.a = null; this.b = null; this.snd = null; this.phase = Math.random();
        this.wheels = findNodes(this.obj, "Wheel_");
    }
    push(t, x, z, h) {
        if (this.b && t <= this.b.t) return;
        this.a = this.b || { t: t - 140, x, z, h };
        this.b = { t, x, z, h };
    }
    dispose() { if (this.snd) { try { this.snd.stop(); } catch (e) { /* gone */ } } this.obj.removeFromParent(); }
}

let tagCache = new Map();
function tagFor(uid) {
    let t = tagCache.get(uid);
    if (!t) { t = new R.NameTag(); t.sp.visible = false; ctx.scene.add(t.sp); tagCache.set(uid, t); }
    return t;
}

/**
 * Per frame (from the party's rAF): show / move what each friend's snapshot says.
 * sameWorld(p) → is this friend in my world right now (same activity + zone, I'm looking at the road)?
 * nameOf(uid) → their display name.
 */
export function tick(dt, sameWorld, nameOf) {
    if (!ctx.scene || !ctx.camera) return;
    const T = clock() - 200, cam = ctx.camera.position;
    let sirens = 0;
    for (const [uid, p] of N.players) {
        let w = W.get(uid);
        const x = p.x || null;
        const here = !!x && sameWorld(p) && fresh(p, 8000);
        const pc = here && Array.isArray(x.pc) ? x.pc : null, cp = here && Array.isArray(x.cp) ? x.cp : null;
        const away = here && p.m === 7;
        if (!w) { if (!pc && !cp && !away) continue; w = { parked: null, cops: [], seq: -1 }; W.set(uid, w); }
        // 🚗 the parked car
        if (pc && pc.length >= 3) {
            if (!w.parked) w.parked = new ParkedCar();
            const key = typeof pc[3] === "string" && /^[a-z_0-9]{2,24}$/.test(pc[3]) ? pc[3] : "lulu";
            const ok = w.parked.set(key, p.sk, typeof pc[4] === "string" ? pc[4].slice(0, 9) : null, p.hc);
            const o = w.parked.root;
            o.visible = ok;
            o.position.set(pc[0] / 10, 0, pc[1] / 10);
            o.rotation.y = pc[2] / 1000;
            const on = Math.sin(ctx.time * 6) > 0;
            for (const b of w.parked.haz) b.visible = on;
        } else if (w.parked) w.parked.root.visible = false;
        // 🚓 the cruisers on their tail
        const n = cp ? Math.min(3, Math.floor(cp.length / 3)) : 0;
        if (cp && p.q !== w.seq && models.cop) {
            w.seq = p.q;
            const t = p.samples && p.samples.length ? p.samples[p.samples.length - 1].t : clock() - 60;
            for (let i = 0; i < n; i++) {
                if (!w.cops[i]) w.cops[i] = new Puppet();
                w.cops[i].push(t, cp[i * 3] / 10, cp[i * 3 + 1] / 10, cp[i * 3 + 2] / 1000);
            }
        }
        for (let i = 0; i < w.cops.length; i++) {
            const pu = w.cops[i];
            const live = i < n && pu.a && pu.b;
            if (!live) { pu.obj.visible = false; if (pu.snd) { pu.snd = pu.snd.stop() || null; } if (i >= n) { pu.a = pu.b = null; } continue; }
            const span = Math.max(1, pu.b.t - pu.a.t), u = Math.max(0, Math.min(1.4, (T - pu.a.t) / span));
            const px = pu.a.x + (pu.b.x - pu.a.x) * u, pz = pu.a.z + (pu.b.z - pu.a.z) * u;
            const ph = pu.a.h + wrapAngle(pu.b.h - pu.a.h) * Math.min(1, u);
            const moved = Math.hypot(px - pu.obj.position.x, pz - pu.obj.position.z);
            pu.obj.position.set(px, 0, pz);
            pu.obj.rotation.y = ph;
            pu.obj.visible = true;
            for (const wh of pu.wheels) wh.rotation.x += moved / 0.34;
            if (pu.bar) pu.bar.set(true, ctx.time + pu.phase);
            const near = Math.hypot(px - cam.x, pz - cam.z) < 200;
            if (near && sirens < 2 && AU.spatial && AU.spatial.ready) {
                sirens++;
                if (!pu.snd || !pu.snd.alive) pu.snd = AU.spatial.loop("siren", pu.obj, { gain: 0.6 });
            } else if (pu.snd) { pu.snd = pu.snd.stop() || null; }
        }
        // 🏷 inside somewhere: the nametag over their parked car / the door they went in
        const tag = (away || (w.tag && w.tag.sp.visible)) ? tagFor(uid) : null;
        if (tag) {
            const at = away ? (pc ? tmpV.set(pc[0] / 10, 0, pc[1] / 10) : Array.isArray(x.at) ? tmpV.set(x.at[0] / 10, 0, x.at[1] / 10) : null) : null;
            if (!at) tag.sp.visible = false;
            else {
                const pr = presenceOf(p);
                tag.set(nameOf(uid), R.skinHex(p.sk), { status: pr ? `${pr.icon} ${pr.label}` : "" });
                const dist = Math.hypot(at.x - cam.x, at.z - cam.z), k = Math.max(1, Math.min(4, dist / 14));
                tag.sp.position.set(at.x, 3.1 + (k - 1) * 0.15, at.z);
                tag.sp.scale.set(tag.base * k * 1.25, tag.base * tag.aspect * k * 1.25, 1);
                tag.sp.visible = dist < 320;
            }
            w.tag = tag;
        }
    }
    // friends who left the party
    for (const [uid, w] of W) if (!N.players.has(uid)) { dropWorld(uid, w); }
}
function dropWorld(uid, w) {
    if (w.parked) w.parked.dispose();
    for (const pu of w.cops) pu.dispose();
    const t = tagCache.get(uid);
    if (t) { t.dispose(); tagCache.delete(uid); }
    W.delete(uid);
}
/** Hide everything (the lobby, a set on screen). */
export function hideAll() {
    for (const w of W.values()) {
        if (w.parked) w.parked.root.visible = false;
        for (const pu of w.cops) { pu.obj.visible = false; if (pu.snd) pu.snd = pu.snd.stop() || null; }
    }
    for (const t of tagCache.values()) t.sp.visible = false;
}
/** Leave the party: dispose all of it. */
export function clearAll() { for (const [uid, w] of [...W]) dropWorld(uid, w); ME.explicit = null; ME.pr = null; }
/** Debug (tests): what this screen draws for friend uid. */
export function debugWorld(uid) {
    const w = W.get(uid);
    if (!w) return null;
    return {
        parked: w.parked && w.parked.root.visible ? { x: w.parked.root.position.x, z: w.parked.root.position.z, key: w.parked.key } : null,
        cops: w.cops.filter(pu => pu.obj.visible).map(pu => ({ x: +pu.obj.position.x.toFixed(1), z: +pu.obj.position.z.toFixed(1), lit: !!(pu.bar) })),
        tag: !!(w.tag && w.tag.sp.visible),
    };
}
