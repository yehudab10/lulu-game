// features/town — LIFE on the streets: the people (talk to them on foot; they heckle as
// she drives by), the geese that run at cars (or a town's timid flock: Midwood's pigeons
// under the bridge), bochurim on e-bikes weaving through traffic (or delivery bikes the
// wrong way down a one-way), speed bumps that rattle her teeth, the 4-way stops nobody
// stops at, one-way streets she goes down the wrong way, the patrol car that saw ALL of it,
// and the group chat that knew before she got home.
// Everything here reads the town's data (def.people / flock / geese / bikes / notices / lines).
import * as THREE from "three";
import { ctx, emit, pick } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { models, findNodes, cloneWithColors } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import * as SFX from "./sfx.js";
import { PL, LANE, toLocal, streetOfS, streetPoint, streetCoords, nodeAlong, movesFrom, headingOf, segmentBlocked } from "./plan.js";
import { C } from "./cars.js";

export const LIFE = { on: false, T: null, def: null, people: [], geese: [], bikes: [], said: new Set(), told: {}, gossipT: 0, live: [],
    bumps: 0, stopsRun: 0, prev: null, appr: null, yellT: 3, sightT: 0, witness: false, talk: null, honkT: 0, firstLines: [], wrongT: 0, wrongSt: null, wrongCalm: 0 };
export const PEOPLE_MODELS = ["town_brooklyn", "town_local", "town_mom", "town_agent", "town_bochur", "town_goose", "town_ebike", "npcMan", "npcWoman", "npcKid"];

const TOPS = ["#81C784", "#4FC3F7", "#FFB74D", "#F06292", "#9575CD", "#FFFFFF", "#4DB6AC", "#FFD54F", "#90A4AE"];
const BOTTOMS = ["#37474F", "#283593", "#212121", "#5D4037", "#1565C0", "#455A64"];
const _v = new THREE.Vector3(), _l = {}, _c = {};
const W = (lx, lz) => _v.set(PL.ORIGIN.x + lx, 0, PL.ORIGIN.z + lz);
const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.foot.pos);
function luluPos() { return onFoot() ? ctx.foot.pos : ctx.car.pos; }

// ── voices ───────────────────────────────────────────────────────────────
/** Lulu says one of her lines for `cat` (big = a story beat: still said on Quiet, sometimes). */
export function luluSay(cat, big = false) {
    const pool = LIFE.def && LIFE.def.lines.LULU[cat];
    if (!pool || ctx.skipping) return false;
    const c = chatter();
    if (c === "quiet" && !(big && Math.random() < 0.6)) return false;
    if (c === "normal" && !big && Math.random() < 0.3) return false;
    const k = (LIFE.told[cat] = (LIFE.told[cat] || 0) + 1) - 1;
    const text = pool[k % pool.length];
    try {
        if (onFoot() && ctx.foot.say && ctx.foot.obj) return !!ctx.foot.say(ctx.foot.obj, text, 3);
        if (ctx.banter && ctx.banter.say) return !!ctx.banter.say(text);
    } catch (e) { console.error("[town] say", e); }
    H.toast(`💬 ${text}`, "pink");
    return true;
}
/** The group chat pings (or a toast without the phone). One of each kind, twice a visit at most. */
export function gossip(kind, force = false) {
    const L = LIFE.def && LIFE.def.lines;
    if (!L || !L.GOSSIP[kind]) return false;
    const n = LIFE.told["g:" + kind] || 0;
    if (!force && (ctx.time < LIFE.gossipT || n >= 2)) return false;
    LIFE.told["g:" + kind] = n + 1;
    LIFE.gossipT = ctx.time + 9;
    const msg = L.GOSSIP[kind][n % L.GOSSIP[kind].length];
    if (L.KVETCH_LIVE && L.KVETCH_LIVE[kind]) LIFE.live.unshift(Object.assign({ t: Date.now() }, L.KVETCH_LIVE[kind]));
    SFX.ping();
    try {
        if (ctx.phone && ctx.phone.text) { ctx.phone.text({ from: L.GROUP.from, emoji: L.GROUP.emoji, color: L.GROUP.color, msg, dur: 4.6 }); }
        else H.toast(`${L.GROUP.emoji} ${msg}`, "");
    } catch (e) { H.toast(`${L.GROUP.emoji} ${msg}`, ""); }
    emit("town:gossip", { kind, msg });
    emit("stat", { id: "townGossip", n: 1 });
    return true;
}
function bubble(obj, text, dur = 2.6, cls = "angry") {
    if (!obj || !text || ctx.skipping) return;
    if (onFoot() && ctx.foot.say) { ctx.foot.say(obj, text, dur); return; }
    if (ctx.banter && ctx.banter.bubble) ctx.banter.bubble(text, obj, { dur, cls });
}

// ── setup / teardown ─────────────────────────────────────────────────────
export function startLife(T, def) {
    stopLife();
    Object.assign(LIFE, { on: true, T, def, said: new Set(), told: {}, gossipT: ctx.time + 3, bumps: 0, stopsRun: 0, prev: null, appr: null, yellT: 2, sightT: 0, witness: false, talk: null, wrongT: 0, wrongSt: null, wrongCalm: 0 });
    const L = def.lines;
    // people at their spots
    for (const p of def.people || []) {
        const spot = T.spots[p.at];
        const who = L.PEOPLE[p.id];
        if (!spot || !who) continue;
        const [u, n] = p.off || [0, 0];
        let base = spot.ux != null ? { x: spot.x + spot.ux * u + spot.nx * n, z: spot.z + spot.uz * u + spot.nz * n } : { x: spot.x + u, z: spot.z + n };
        let face = spot.cx != null ? Math.atan2(spot.cx - base.x, spot.cz - base.z) : spot.nx != null ? Math.atan2(spot.nx, spot.nz) : (spot.rot || 0) + Math.PI;
        if (spot.bench) { face = spot.rot; base = { x: spot.x - Math.sin(face) * 0.12, z: spot.z - Math.cos(face) * 0.12 }; }     // sitting on it
        const person = addPerson(models[who.key] ? who.key : "npcMan", base.x, base.z, face, who.colors, { id: p.id, lines: who.lines, name: who.name, alt: p.alt, sit: !!spot.bench });
        // the pizza line: a queue down the sidewalk
        if (p.line && spot.ux != null) {
            const n = (p.friday && new Date().getDay() === 5) ? p.friday : p.line;     // (Erev Shabbos: the challah line has its own zip code)
            for (let k = 1; k <= n; k++) {
                const key = pick(["npcMan", "npcWoman", "npcMan", "npcKid", "town_local"]);
                addPerson(models[key] ? key : "npcMan", base.x - spot.ux * k * 0.95 * -1, base.z - spot.uz * k * 0.95 * -1, Math.atan2(spot.ux, spot.uz),
                    key === "town_local" ? null : { Top: pick(TOPS), Bottom: pick(BOTTOMS) }, { extra: true });
            }
            if (person) person.face = Math.atan2(spot.ux, spot.uz);
        }
    }
    // geese on the shore (or the town's own flock: { model, spot, n, timid })
    const FL = def.flock || { model: "town_goose", spot: "lake", n: def.geese || 0 };
    const lake = T.spots[FL.spot];
    LIFE.timid = !!FL.timid;
    if (lake && models[FL.model]) for (let k = 0; k < (FL.n || 0); k++) {
        const g = cloneWithColors(models[FL.model]);
        const x = lake.x - 3 + Math.random() * 6, z = lake.z0 + Math.random() * (lake.z1 - lake.z0);
        g.position.copy(W(x, z)); g.rotation.y = Math.random() * 6;
        T.root.parent.add(g);
        LIFE.geese.push({ obj: g, x, z, h: g.rotation.y, home: { x, z }, mode: "graze", t: Math.random() * 5, honkT: 0, neck: findNodes(g, "Neck")[0], wings: [findNodes(g, "Wing_L")[0], findNodes(g, "Wing_R")[0]], legs: [findNodes(g, "Leg_L")[0], findNodes(g, "Leg_R")[0]], fly: 0 });
    }
    // bochurim on e-bikes
    const rider = def.bikeRider || "town_bochur";
    if (models.town_ebike && models[rider]) for (let k = 0; k < (def.bikes || 0); k++) {
        const st = PL.STREETS[(k * 3 + 1) % PL.STREETS.length];
        const along = st.cross.length ? (st.cross[0].a + st.cross[st.cross.length - 1].a) / 2 + k * 9 : 0;
        const grp = new THREE.Group();
        const bike = cloneWithColors(models.town_ebike);
        grp.add(bike);
        const rider = spawnPerson(def.bikeRider || "town_bochur");
        rider.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
        rider.obj.position.set(0, 0.42, 0.18);
        grp.add(rider.obj);
        grp.rotation.order = "YXZ";
        T.root.parent.add(grp);
        LIFE.bikes.push({ obj: grp, rider, wheels: [...findNodes(bike, "Wheel_F"), ...findNodes(bike, "Wheel_R")], st, dir: k % 2 ? 1 : -1, along, d: 2.6, speed: 9 + Math.random() * 3, t: Math.random() * 9, hitT: 0, h: 0, lastNode: null });
    }
    // anchors for the jam's yelling
    LIFE.jamAnchors = [0, 1, 2].map(() => { const o = new THREE.Object3D(); T.root.add(o); return o; });
}
function addPerson(key, x, z, face, colors, info) {
    if (!models[key]) return null;
    const p = spawnPerson(key, { colors: colors || null });
    p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    p.obj.position.copy(W(x, z));
    p.obj.rotation.y = face;
    LIFE.T.root.parent.add(p.obj);
    const rec = Object.assign({ p, x, z, face, k: 0, talkT: 0, heckleT: 0, idle: Math.random() * 6 }, info);
    LIFE.people.push(rec);
    return rec;
}
export function stopLife() {
    for (const r of LIFE.people) if (r.p.obj.parent) r.p.obj.parent.remove(r.p.obj);
    for (const g of LIFE.geese) if (g.obj.parent) g.obj.parent.remove(g.obj);
    for (const b of LIFE.bikes) if (b.obj.parent) b.obj.parent.remove(b.obj);
    LIFE.people.length = 0; LIFE.geese.length = 0; LIFE.bikes.length = 0;
    LIFE.on = false; LIFE.T = null; LIFE.talk = null;
}

// ── on foot: talk to people ──────────────────────────────────────────────
let near = null;
export const talkSpot = {
    r: 2.4, short: "TALK",
    pos() {
        near = null;
        if (!LIFE.on || !onFoot()) return null;
        const f = ctx.foot.pos;
        let bd = 3.2;
        for (const r of LIFE.people) {
            if (!r.lines) continue;
            const d = Math.hypot(r.p.obj.position.x - f.x, r.p.obj.position.z - f.z);
            if (d < bd) { bd = d; near = r; }
        }
        return near ? { x: near.p.obj.position.x, z: near.p.obj.position.z } : null;
    },
    label() { return near ? `💬 ${near.name || "TALK"}` : null; },
    act() { if (near) talkTo(near); },
};
export function talkTo(r) {
    const line = r.lines[r.k++ % r.lines.length];
    r.talkT = 3.2;
    r.p.obj.rotation.y = Math.atan2(ctx.foot.pos.x - r.p.obj.position.x, ctx.foot.pos.z - r.p.obj.position.z);
    if (ctx.foot && ctx.foot.say) ctx.foot.say(r.p.obj, line, 3.4);
    LIFE.talk = { t: 0, r, replied: false };
    emit("town:talk", { id: r.id, line });
    emit("stat", { id: "townTalks", n: 1 });
    return line;
}

// ── per frame ────────────────────────────────────────────────────────────
export function tickLife(dt) {
    if (!LIFE.on) return;
    const T = LIFE.T, def = LIFE.def, L = def.lines, cam = ctx.camera.position;
    const lp = luluPos(), foot = onFoot(), car = ctx.car;
    // people: idle, talk, heckle her as she drives by; far ones are hidden (cheap LOD)
    for (const r of LIFE.people) {
        const o = r.p.obj, dc = Math.hypot(o.position.x - cam.x, o.position.z - cam.z);
        o.visible = dc < (r.extra ? 30 : 42);       // townsfolk are ~5k triangles each: only the near ones
        if (!o.visible) continue;
        if (r.talkT > 0) r.talkT -= dt;
        r.idle += dt;
        r.p.update(dt, { talk: r.talkT > 0 || (r.extra && Math.sin(r.idle * 0.7) > 0.6), wave: r.waveT > 0, sit: !!r.sit });
        if (r.waveT > 0) r.waveT -= dt;
        if (!foot && r.lines && ctx.time > r.heckleT) {
            const d = Math.hypot(o.position.x - lp.x, o.position.z - lp.z);
            if (d < 16 && car.speed > 2) { r.heckleT = ctx.time + 22; r.talkT = 2.4; bubble(o, r.lines[r.k++ % r.lines.length], 2.8, "nice"); }
        }
    }
    if (LIFE.talk) {
        const tk = LIFE.talk;
        tk.t += dt;
        if (!tk.replied && tk.t > 2.2 && foot && ctx.foot.obj) { tk.replied = true; ctx.foot.say(ctx.foot.obj, pick(L.LULU_REPLY), 2.2); }
        if (tk.t > 4) LIFE.talk = null;
    }
    tickGeese(dt, lp, foot);
    tickBikes(dt, lp, foot);
    tickJam(dt, lp, foot);
    if (!foot) { tickBumps(dt); tickStops(dt); tickOneway(dt); }
    tickPatrol(dt, foot);
    tickNotices(lp, foot);
}

function tickNotices(lp, foot) {
    // first sight of each landmark → one line from Lulu
    const T = LIFE.T, S = T.spots;
    toLocal(lp.x, lp.z, _l);
    const seen = (key, x, z, r, cat, big) => {
        if (LIFE.said.has(key) || Math.hypot(x - _l.x, z - _l.z) > r) return;
        LIFE.said.add(key);
        luluSay(cat, big);
    };
    if (T.jam.length) seen("jam", T.jam[0].x, T.jam[0].z - 20, 34, "jam", true);
    if (PL.circle) seen("circle", PL.circle.x, PL.circle.z, 32, "circle", true);
    if (S.pizza) seen("pizza", S.pizza.x, S.pizza.z, 22, "pizza");
    if (S.hall) seen("hall", S.hall.x, S.hall.z, 30, "hall");
    if (S.construction) seen("construction", S.construction.x, S.construction.z, 34, "construction");
    if (S.chair) seen("chair", S.chair.x, S.chair.z, 16, "parking");
    for (const c of C.cars) if (c.kind === "town_bus") seen("bus", c.x - PL.ORIGIN.x, c.z - PL.ORIGIN.z, 16, "bus");
    for (const b of LIFE.bikes) seen("bike", b.obj.position.x - PL.ORIGIN.x, b.obj.position.z - PL.ORIGIN.z, 9, "bike");
    // the town's own landmarks (def.notices: a build spot, or a kind of vehicle coming by)
    for (const n of LIFE.def.notices || []) {
        if (n.spot && S[n.spot]) seen(n.spot, S[n.spot].x, S[n.spot].z, n.r || 24, n.cat, n.big);
        if (n.kind && !LIFE.said.has(n.kind)) for (const c of C.cars) if (c.kind === n.kind && Math.hypot(c.x - PL.ORIGIN.x - _l.x, c.z - PL.ORIGIN.z - _l.z) < (n.r || 24)) {
            seen(n.kind, c.x - PL.ORIGIN.x, c.z - PL.ORIGIN.z, n.r || 24, n.cat, n.big);
            if (n.gossip) gossip(n.gossip);
            break;
        }
    }
}

// ── geese ────────────────────────────────────────────────────────────────
function tickGeese(dt, lp, foot) {
    const car = ctx.car;
    toLocal(lp.x, lp.z, _l);
    for (const g of LIFE.geese) {
        g.t += dt;
        const dx = _l.x - g.x, dz = _l.z - g.z, dist = Math.hypot(dx, dz);
        if (LIFE.timid) {
            // pigeons don't charge: they burst up when she gets close, and come back to the same spot (it's THEIR spot)
            if ((g.mode === "graze" || g.mode === "home") && dist < (foot ? 3.2 : 9)) {
                g.mode = "fly"; g.fly = 1.6 + Math.random() * 0.8; SFX.coo(Math.max(0.2, 1 - dist / 30));
                if (Math.random() < 0.3) bubble(g.obj, pick(LIFE.def.lines.GOOSE), 1.4);
                if (!LIFE.said.has("geese")) { LIFE.said.add("geese"); luluSay("geese", true); gossip("geese"); emit("town:geese", {}); }
            }
        } else if (g.mode === "graze" && dist < 24 && ctx.enabled("town")) { g.mode = "charge"; g.chaseT = 0; if (!LIFE.said.has("geese")) { LIFE.said.add("geese"); luluSay("geese", true); } }
        let sp = 0, want = g.h;
        if (g.mode === "charge") {
            g.chaseT += dt;
            want = Math.atan2(dx, dz); sp = 5.2;
            g.honkT -= dt;
            if (g.honkT <= 0) { g.honkT = 0.7 + Math.random() * 0.6; SFX.goose(Math.max(0.15, 1 - dist / 40)); if (Math.random() < 0.35) bubble(g.obj, pick(LIFE.def.lines.GOOSE), 1.4); }
            if (dist < (foot ? 1.0 : 2.0)) {
                // contact: the goose wins (no damage, all dignity)
                if (!foot && car.speed > 6) { g.mode = "fly"; g.fly = 1.4; car.fx.burst(g.obj.position.x, 0.8, g.obj.position.z, 14, 3, [0.9, 0.9, 0.88], 0.4, 0.9); }
                else { g.mode = "peck"; g.peckT = 1.2; }
                if (!foot) { car.vx *= 0.82; car.vz *= 0.82; ctx.G.shake = Math.max(ctx.G.shake || 0, 0.25); rumble(0.2, 0.4, 120); }
                else if (ctx.foot.pos) { ctx.foot.pos.x += dx / (dist || 1) * 0.6; ctx.foot.pos.z += dz / (dist || 1) * 0.6; }
                gossip("geese");
                emit("town:geese", {});
            }
            if (g.chaseT > 11 || dist > 46) g.mode = "home";
        } else if (g.mode === "peck") { g.peckT -= dt; want = Math.atan2(dx, dz); if (g.peckT <= 0) g.mode = dist < 3 ? "charge" : "home"; }
        else if (g.mode === "fly" || g.mode === "flee") {
            g.fly -= dt; sp = g.mode === "fly" ? 7 : 6; want = Math.atan2(-dx, -dz);
            if (g.fly <= 0) g.mode = "home";
        } else if (g.mode === "home") {
            const hx = g.home.x - g.x, hz = g.home.z - g.z;
            want = Math.atan2(hx, hz); sp = 2.4;
            if (Math.hypot(hx, hz) < 1) g.mode = "graze";
        } else if (Math.sin(g.t * 0.6 + g.home.z) > 0.7) { sp = 0.6; want = g.h + Math.sin(g.t) * 0.02; }
        let dh = want - g.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        g.h += dh * Math.min(1, dt * 6);
        g.x += Math.sin(g.h) * sp * dt; g.z += Math.cos(g.h) * sp * dt;
        g.obj.visible = Math.hypot(g.obj.position.x - ctx.camera.position.x, g.obj.position.z - ctx.camera.position.z) < 70;
        const y = g.mode === "fly" ? Math.sin(Math.max(0, g.fly) / 1.4 * Math.PI) * 2.2 : 0;
        g.obj.position.set(PL.ORIGIN.x + g.x, y, PL.ORIGIN.z + g.z);
        g.obj.rotation.y = g.h;
        const flap = g.mode === "charge" || g.mode === "fly" || g.mode === "flee";
        if (g.neck) g.neck.rotation.x = g.mode === "charge" ? -0.7 + Math.sin(g.t * 9) * 0.15 : g.mode === "peck" ? -1.0 + Math.abs(Math.sin(g.t * 12)) * 0.6 : Math.sin(g.t * 1.3) * 0.4 - 0.2;
        g.wings.forEach((w, i) => { if (w) w.rotation.y = flap ? (i ? -1 : 1) * (0.4 + Math.sin(g.t * 18) * 0.5) : 0; });
        g.legs.forEach((l, i) => { if (l) l.rotation.x = sp > 0.3 ? Math.sin(g.t * 14 + i * Math.PI) * 0.7 : 0; });
    }
}
/** Honking scatters the geese. */
export function honked() {
    const lp = luluPos();
    toLocal(lp.x, lp.z, _l);
    for (const g of LIFE.geese) if (Math.hypot(_l.x - g.x, _l.z - g.z) < 30) { g.mode = "flee"; g.fly = 2.5; }
    // …and honking in Lakewood is a group-chat event
    if (Math.random() < 0.35) gossip("honk");
}

// ── e-bikes ──────────────────────────────────────────────────────────────
function tickBikes(dt, lp, foot) {
    const car = ctx.car, Lb = LIFE.def.lines.BIKE_YELLS;
    for (const b of LIFE.bikes) {
        b.t += dt;
        const st = b.st;
        let along = b.along + b.dir * b.speed * dt;
        // at a crossing: anywhere goes (stop signs are for cars)
        for (const c of st.cross) {
            if ((b.along - c.a) * (along - c.a) <= 0 && c.node !== b.lastNode) {
                b.lastNode = c.node;
                const moves = movesFrom(c.node).filter(m => m.node && !(m.street === st.id && m.dir === -b.dir));
                const m = moves.length ? pick(moves) : null;
                if (m && m.street !== st.id) {
                    const nst = PL.STREETS[m.street];
                    streetCoords(nst, b.obj.position.x - PL.ORIGIN.x, b.obj.position.z - PL.ORIGIN.z, _c);
                    b.st = nst; b.dir = m.dir; along = nodeAlong(nst, c.node) + m.dir * 0.6; b.d = _c.d;
                } else if (!m) b.dir = -b.dir;
                break;
            }
        }
        if (along < b.st.a0 + 3 || along > b.st.a1 - 3) { b.dir = -b.dir; along = Math.max(b.st.a0 + 3, Math.min(b.st.a1 - 3, along)); }
        b.along = along;
        // weave: the lane edge, the parking lane, sometimes the wrong side
        const lane = b.dir * (2.7 + Math.sin(b.t * 0.55) * 1.3) * (Math.sin(b.t * 0.13) > 0.85 ? -1 : 1);
        b.d += (lane - b.d) * Math.min(1, dt * 1.2);
        const p = streetPoint(b.st, b.along, b.d, _l);
        const wx = PL.ORIGIN.x + p.x, wz = PL.ORIGIN.z + p.z;
        const want = headingOf(b.st, b.dir) + (lane - b.d) * 0.06 * b.dir;
        let dh = want - b.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        b.h += dh * Math.min(1, dt * 5);
        b.obj.position.set(wx, 0, wz);
        b.obj.rotation.y = b.h;
        b.hitT = Math.max(0, b.hitT - dt);
        b.obj.rotation.z = b.hitT > 0 ? Math.sin(b.hitT * 18) * 0.25 : Math.sin(b.t * 0.55) * 0.06;
        for (const w of b.wheels) w.rotation.x += b.speed * dt / 0.34;
        b.rider.update(dt, { sit: true, talk: b.hitT > 0 });
        // close shaves with Lulu
        const dist = Math.hypot(wx - lp.x, wz - lp.z);
        if (dist < (foot ? 1.2 : 2.0) && b.hitT <= 0) {
            b.hitT = 1.6;
            SFX.bell();
            bubble(b.obj, pick(Lb), 1.8);
            if (!foot && car.speed > 3) { A.sfxBump(); ctx.G.shake = Math.max(ctx.G.shake || 0, 0.18); car.vx *= 0.93; car.vz *= 0.93; }
            emit("town:bike", {});
        }
        b.speed = b.hitT > 0 ? 5 : 9 + Math.sin(b.t * 0.3) * 2.5;
    }
}

// ── the jam on Route 9 (and the honking) ────────────────────────────────
function tickJam(dt, lp, foot) {
    const T = LIFE.T;
    if (!T.jam.length) return;
    LIFE.yellT -= dt;
    if (LIFE.yellT > 0) return;
    LIFE.yellT = 2.2 + Math.random() * 2.5;
    toLocal(lp.x, lp.z, _l);
    const close = T.jam.filter(j => Math.hypot(j.x - _l.x, j.z - _l.z) < 55);
    if (!close.length) return;
    const j = pick(close), a = LIFE.jamAnchors[Math.floor(Math.random() * LIFE.jamAnchors.length)];
    a.position.set(j.x, 2.1, j.z);
    a.updateMatrixWorld(true);
    SFX.minivanHorn(Math.max(0.2, 1 - Math.hypot(j.x - _l.x, j.z - _l.z) / 60));
    if (Math.random() < 0.6) bubble(a, pick(LIFE.def.lines.JAM_YELLS), 2.2);
}

// ── speed bumps ──────────────────────────────────────────────────────────
function tickBumps() {
    const car = ctx.car, st = streetOfS(car.s);
    const prev = LIFE.prev;
    LIFE.prev = st ? { st, along: car.s - st.base } : null;
    if (!st || !prev || prev.st !== st) return;
    const along = car.s - st.base;
    for (const b of LIFE.T.bumps) {
        if (b.street !== st.id || (prev.along - b.along) * (along - b.along) > 0 || Math.abs(car.d) > st.outer) continue;
        const sp = car.speed;
        if (sp < 3) continue;
        LIFE.bumps++;
        ctx.G.shake = Math.max(ctx.G.shake || 0, Math.min(0.9, 0.12 + sp / 28));
        car.pitch = (car.pitch || 0) - Math.min(0.12, sp / 200);
        rumble(Math.min(1, sp / 25), 0.6, 130, true);
        SFX.thunk(sp / 18);
        if (LIFE.bumps === 3 || LIFE.bumps === 11 || LIFE.bumps === 30) luluSay("bumps", LIFE.bumps === 3);
        if (sp > 17) { gossip("bumps"); if (sp > 20) H.toast("💨 SPEED BUMP AIRTIME", "gold"); }
        emit("town:bump", { speed: sp });
    }
}

// ── 4-way stops: did she stop? (nobody does, but still) ─────────────────
function tickStops(dt) {
    const car = ctx.car, st = streetOfS(car.s);
    if (!st) { LIFE.appr = null; return; }
    const along = car.s - st.base, vAlong = (car.vx * Math.sin(st.h) + car.vz * Math.cos(st.h));
    const dir = vAlong >= 0 ? 1 : -1;
    // the stop line ahead in her direction of travel
    let stop = null, dist = 1e9;
    for (const s of LIFE.T.stops) {
        if (s.street !== st.id || s.dir !== dir) continue;
        const dd = (s.along - along) * dir;
        if (dd > -2 && dd < dist) { dist = dd; stop = s; }
    }
    const a = LIFE.appr;
    if (a && a.stop !== stop && a.dist < 3 && Math.abs(car.d) < st.outer) {
        // she just crossed a.stop's line
        if (a.minV > 3.2 && car.speed > 4.5) ranStop(a.stop);
        else if (a.minV <= 1.0) { ctx.G.score += 50; }
    }
    if (!stop || dist > 22) { LIFE.appr = null; return; }
    if (!a || a.stop !== stop) LIFE.appr = { stop, minV: car.speed, dist };
    else { a.minV = Math.min(a.minV, car.speed); a.dist = dist; }
}
function ranStop(stop) {
    LIFE.stopsRun++;
    emit("town:stopSign", { street: PL.STREETS[stop.street].name });
    emit("stat", { id: "townStopSigns", n: 1 });
    if (LIFE.stopsRun === 1 || Math.random() < 0.3) luluSay("stopSign");
    gossip("stopSign");
    if (patrolSees()) crime("RUNNING A STOP SIGN", "🚨 YOU RAN THE STOP — AND THE PATROL SAW!");
}

// ── one-way streets: the wrong way (delivery bikes do it; when SHE does it, the block notices) ──
function tickOneway(dt) {
    const car = ctx.car, st = streetOfS(car.s);
    if (!st || !st.oneway || Math.abs(car.d) > st.curb + 1) { LIFE.wrongCalm += dt; if (LIFE.wrongCalm > 4) { LIFE.wrongT = 0; LIFE.wrongSt = null; } return; }
    const v = (car.vx * Math.sin(st.h) + car.vz * Math.cos(st.h)) * st.oneway;
    if (v > -3) { LIFE.wrongCalm += dt; if (LIFE.wrongCalm > 4) { LIFE.wrongT = 0; LIFE.wrongSt = null; } return; }
    LIFE.wrongCalm = 0;
    LIFE.wrongT += dt;
    if (LIFE.wrongT < 1.3 || LIFE.wrongSt === st) return;
    LIFE.wrongSt = st;
    emit("town:oneway", { street: st.name });
    emit("stat", { id: "townWrongWay", n: 1 });
    luluSay("oneway");
    gossip("oneway");
    if (patrolSees()) crime("WRONG WAY ON A ONE-WAY", "🚨 WRONG WAY — AND THE PATROL SAW!");
}

// ── the patrol car ───────────────────────────────────────────────────────
export function patrolSees(r = 52) {
    const p = C.patrol;
    if (!p || p.hit || !ctx.traffic.cars.includes(p)) return false;
    const lp = luluPos();
    if (Math.hypot(p.x - lp.x, p.z - lp.z) > r) return false;
    toLocal(p.x, p.z, _l); const ax = _l.x, az = _l.z;
    toLocal(lp.x, lp.z, _l);
    return !segmentBlocked(ax, az, _l.x, _l.z);
}
/** The patrol saw a crime: a chase starts and the patrol car itself takes up the pursuit. */
export function crime(charge, msg, heat = 1) {
    const law = ctx.law;
    if (!law || !law.startChase || law.chasing || ctx.state !== "playing") return false;
    LIFE.witness = true;
    law.startChase(charge, { msg, heat });
    LIFE.witness = false;
    gossip("cops");
    return true;
}
function tickPatrol(dt, foot) {
    if (foot || !C.patrol || (ctx.law && ctx.law.chasing)) { LIFE.sightT = 0; return; }
    const mph = ctx.car.speed * 2.23694;
    if (mph > (LIFE.def.speedingMph || 48) && patrolSees(46)) {
        LIFE.sightT += dt;
        if (LIFE.sightT > 0.7) { LIFE.sightT = 0; crime(`SPEEDING (${LIFE.def.speedLimitMph || 25} ZONE)`, `🚨 ${Math.round(mph)} IN A ${LIFE.def.speedLimitMph || 25}?!`); }
    } else LIFE.sightT = Math.max(0, LIFE.sightT - dt);
}
