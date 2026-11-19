// features/streets — 🎨 PAINT & PRAY: Moishe's drive-through spray booth.
//
// Every few kilometres on the right side of the road (with a sign 250 m before
// it). Roll onto the apron and the cutscene takes the wheel: in you go, both
// roll-up doors rattle down, the booth hisses and shakes, puffs of the NEW colour
// leak out of the vents — and you roll out the far end freshly painted, tyres
// fixed and the heat gone (the chase / fugitive stars / a call-in; open court warrants stay on file — only a judge
// clears them — but no patrol recognises the new colour this run). Costs coins (more with more stars); Moishe
// always has something to say. The whole scene runs on game time, so ⏭ skipping
// fast-forwards it and every side effect still happens in order.
// In a 🎉 party the booths come from the party's seeded road plan (ctx.party.road, kind streets:paint — the same
// s on every friend's screen, planned ~1.4 km ahead so the world reserves them before their chunks are built);
// the solo booths stand down. The drive-through is personal (friends keep driving; they see "🎨 at Paint & Pray").
import * as THREE from "three";
import { ctx, on, hook, emit, registerState, setState, addActor } from "../../core/ctx.js";
import { updateDriving } from "../../core/driving.js";
import { wallet, flushShared } from "../../core/save.js";
import { say } from "../../core/dialog.js";
import { spawnPerson } from "../../core/people.js";
import { ribbon, worldMaterials, signTexture, facingRoad, mulberry32, SHOULDER } from "../../world.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { models, need, live, K, clamp, lerp, rand, pick, smooth, toast, stat, sfx, npcSays, luluSays } from "./common.js";
import { currentRide } from "./jack.js";
import { repairTyres, HEAT } from "./heat.js";
import * as T from "./lines.js";

const D = 13.2;              // the booth's centre line (metres right of the road's centre)
const HALF = 8;              // half its length along the road
export const PAINT = { garages: [], mine: new Set(), last: null, jobs: 0, cool: 0, hinted: new Set() };
const tmp = {}, tmpB = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** What a respray costs right now (more stars, more paint). */
export function cost() { const w = (ctx.law && ctx.law.wanted) || 0; return 30 + 15 * w; }

// ── where they are: planned once (seeded), the stretch kept clear of trees ──
function plan() {
    const w = ctx.world, rnd = mulberry32(8128);
    let s = 1650;
    for (let i = 0; i < 60 && s < 120000; i++) {
        let tries = 0;
        while (tries < 8 && blocked(s, w)) { s += 280; tries++; }
        if (tries < 8) addGarage(s, true);
        s += 2300 + rnd() * 1100;
    }
}
function blocked(s, w) {
    for (let x = s - 45; x <= s + 45; x += 15) for (const d of [10, 14, 18, 24]) if (w.isReserved(x, d, 0)) return true;
    return false;
}
function addGarage(s, reserve, party = null) {
    const g = { s, built: null, skip: false, cool: 0, sign: null, party, res: [] };
    if (reserve) {
        ctx.world.reserve(s - 34, s + 34, 1, SHOULDER - 0.3, 30);
        g.res.push(ctx.world.reserved[ctx.world.reserved.length - 1]);
        ctx.world.reserve(s - 262, s - 256, 1, 9.6, 12);          // the sign's spot
        g.res.push(ctx.world.reserved[ctx.world.reserved.length - 1]);
        for (const r of g.res) PAINT.mine.add(r);
    }
    PAINT.garages.push(g);
    return g;
}
// ── 🎉 a party: the booths from the seeded road plan ─────────────────────
const partyRun = () => !!(ctx.party && ctx.party.active && ctx.party.road && ctx.G && ctx.G.mode === "party");
const fullAct = A => !!A && (A.k === "trip" || A.k === "roam");
on("boot", () => {
    if (ctx.party && ctx.party.road) ctx.party.road.claim("streets", { paint: A => (fullAct(A) && live() ? 0.9 : 0) });
});
function planParty() {
    const s = ctx.car.s;
    for (let k = Math.floor((s - 40) / 200); k <= Math.floor((s + 1400) / 200); k++) {
        const sl = ctx.party.road.slot(k);
        if (!sl || sl.id !== "streets" || sl.kind !== "paint" || PAINT.garages.some(g => g.party === sl.key)) continue;
        addGarage(sl.s, true, sl.key);
    }
}
function dropPartyGarages() {
    const w = ctx.world;
    for (const g of PAINT.garages.filter(g => g.party)) {
        unbuild(g);
        for (const r of g.res) { PAINT.mine.delete(r); const i = w ? w.reserved.indexOf(r) : -1; if (i >= 0) w.reserved.splice(i, 1); }
    }
    PAINT.garages = PAINT.garages.filter(g => !g.party);
}
/** Another feature's set piece (a journey stop, a Main Street block…) on the same stretch → skip this one. */
function clash(g) {
    for (const r of ctx.world.reserved) {
        if (PAINT.mine.has(r) || r.side === -1) continue;
        if (r.s1 > g.s - 34 && r.s0 < g.s + 34 && r.dMax > 9 && r.dMin < 30) return true;
    }
    return false;
}

// ── the set piece ───────────────────────────────────────────────────────
function build(g) {
    const rd = ctx.world.road, M = worldMaterials();
    const grp = new THREE.Group();
    const own = [];
    rd.point(g.s, D, tmp);
    const h = rd.at(g.s, tmpB).h;
    const booth = models[K("paint")].clone(true);
    booth.position.set(tmp.x, 0, tmp.z);
    booth.rotation.y = h;
    grp.add(booth);
    const doors = { in: null, out: null };
    booth.traverse(o => { if (o.name.startsWith("Door_In")) doors.in = doors.in || o; if (o.name.startsWith("Door_Out")) doors.out = doors.out || o; });
    for (const d of [doors.in, doors.out]) if (d) d.scale.y = 0.06;
    const vents = [];
    booth.traverse(o => { if (o.name.startsWith("Anchor_vent")) vents.push(o); });
    let halo = null;
    booth.traverse(o => { if (o.isMesh && o.material && o.material.name === "NeonHalo" && !halo) { o.material = o.material.clone(); halo = o.material; own.push(halo); } });
    // the aprons: off the road, through the booth, back onto the road
    for (const [a, b] of [[g.s - 30, g.s - HALF + 0.2], [g.s + HALF - 0.2, g.s + 30]]) {
        const geo = ribbon(rd, a, b, SHOULDER - 0.15, D + 2.9, 0.028, 10);
        const m = new THREE.Mesh(geo, M.drive); m.receiveShadow = true;
        grp.add(m); own.push(geo);
    }
    // the sign, 250 m before
    rd.point(g.s - 259, 10.8, tmp);
    const sh = rd.at(g.s - 259, tmpB).h;
    const sign = new THREE.Group();
    sign.position.set(tmp.x, 0, tmp.z);
    sign.rotation.y = sh + Math.PI;
    const tex = signTexture(["PAINT & PRAY", "DRIVE THRU · 250 m ➜"], "#4A148C", "#FFE082", 512, 256);
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.25 });
    const boardGeo = new THREE.BoxGeometry(3.6, 1.8, 0.08);
    const board = new THREE.Mesh(boardGeo, [M.metal, M.metal, M.metal, M.metal, signMat, M.metal]);
    board.position.y = 3.2; board.castShadow = true;
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8);
    for (const x of [-1.2, 1.2]) { const p = new THREE.Mesh(postGeo, M.metal); p.position.set(x, 1.6, 0.06); sign.add(p); }
    sign.add(board);
    grp.add(sign);
    own.push(signMat, boardGeo, postGeo);          // (the sign texture is world.js's cached one — not ours to dispose)
    // Moishe at the door
    let owner = null;
    if (models[K("owner")]) {
        owner = spawnPerson(K("owner"));
        rd.point(g.s - HALF - 2.4, D - 4.2, tmp);
        owner.obj.position.set(tmp.x, 0.05, tmp.z);
        owner.obj.rotation.y = facingRoad(h, 1);
        grp.add(owner.obj);
    }
    ctx.scene.add(grp);
    // the walls: the car bumps off them (the middle is open, end to end)
    const walls = [];
    for (let s = g.s - HALF + 0.3; s <= g.s + HALF - 0.3; s += 1.25) for (const d of [D - 3.25, D + 3.25]) { rd.point(s, d, tmp); walls.push({ x: tmp.x, z: tmp.z }); }
    const B = { grp, booth, doors, vents, halo, owner, own, walls, h, shake: 0, inDoor: 0.06, outDoor: 0.06 };
    g.built = B;
    B.actor = addActor({
        update(dt) { return tickGarage(g, dt); },
        collide(pc) {
            if (Math.abs(pc.s - g.s) > HALF + 4) return null;
            let imp = 0;
            for (const w of walls) imp = Math.max(imp, pc.collideStatic(w.x, w.z, 0.5));
            return imp ? { impact: imp, why: "Lulu vs. a paint booth", source: "wall", harmless: imp < 9 } : null;
        },
        dispose() { unbuild(g); },
    });
    return B;
}
function unbuild(g) {
    const B = g.built;
    if (!B) return;
    g.built = null;
    ctx.scene.remove(B.grp);
    for (const o of B.own) if (o && o.dispose) o.dispose();
}

// ── per frame (an actor: only while that stretch of road is near) ───────
function tickGarage(g, dt) {
    const B = g.built, car = ctx.car;
    if (!B) return false;
    if (car.s > g.s + 260 || car.s < g.s - 900) return false;
    if (B.halo) B.halo.emissiveIntensity = 3 + Math.sin(ctx.time * 3) * 1.2;
    // doors ease to where they should be
    const busy = ctx.state === "streetsPaint" && P && P.g === g;
    if (!busy) {
        B.inDoor += (0.06 - B.inDoor) * Math.min(1, dt * 3); B.outDoor += (0.06 - B.outDoor) * Math.min(1, dt * 3);
        setDoors(B);
    }
    // Moishe waves you in
    if (B.owner) {
        const near = Math.abs(car.s - (g.s - HALF)) < 45;
        B.owner.face(car.pos.x, car.pos.z, dt, 3);
        B.owner.update(dt, { wave: near && !busy, talk: busy });
    }
    if (g.cool > 0) g.cool -= dt;
    // a pursuit in progress and one coming up: point it out once
    if (ctx.law && ctx.law.chasing && !PAINT.hinted.has(g) && g.s - car.s > 120 && g.s - car.s < 700 && ctx.state === "playing") {
        PAINT.hinted.add(g);
        toast(`🎨 PAINT & PRAY ${Math.round((g.s - car.s) / 10) * 10} m ahead — lose the heat!`, "pink", "streets:pp");
    }
    if (ctx.state === "playing") checkEntry(g, car);
    return true;
}
function setDoors(B) {
    if (B.doors.in) B.doors.in.scale.y = B.inDoor;
    if (B.doors.out) B.doors.out.scale.y = B.outDoor;
}
function checkEntry(g, car) {
    const ds = car.s - g.s;
    const inZone = ds > -27 && ds < -HALF - 0.5 && car.d > SHOULDER - 0.2 && car.d < D + 3 && car.vF > 0.5 && car.speed < 26;
    if (!inZone) { if (g.cool <= 0) g.refused = false; return; }
    if (g.cool > 0) return;
    const c = cost();
    if (wallet.coins < c) {
        if (!g.refused) {
            g.refused = true; g.cool = 4;
            toast(`🎨 Paint & Pray: ${c} 💰 — you've got ${wallet.coins}`, "red", "streets:broke");
            if (g.built && g.built.owner) npcSays(g.built.owner.obj, pick(T.PAINT_BROKE).replace("{cost}", c), { always: true, cls: "" });
        }
        return;
    }
    start(g);
}
export function start(g) {
    if (!g.built) build(g);
    if (!g.built) return false;
    setState("streetsPaint", { g });
    return true;
}

// ── the cutscene ────────────────────────────────────────────────────────
let P = null;
registerState("streetsPaint", {
    hud: false, touch: false, pausable: true, driving: true, world: true, skip: true,
    enter(data) {
        const g = data.g;
        const cur = PAINT.color ? PAINT.color.name : null;
        P = { g, t: 0, phase: "in", tt: 0, stars: (ctx.law && ctx.law.wanted) || 0, cost: cost(), color: pick(T.PAINT_COLORS.filter(c => c.name !== cur)),
            hiss: null, said: false, paid: false, snapFrom: null };
        A.duckMusic(0.2);
        H.prompt("");
    },
    exit() {
        if (!P) return;
        if (P.hiss) P.hiss.stop();
        if (P.g.built) { P.g.built.grp.position.set(0, 0, 0); }
        A.duckMusic(0.32);
        P = null;
    },
    update(dt) {
        if (!P) return;
        const g = P.g, B = g.built;
        if (!B) { setState("playing"); return; }
        P.t += dt; P.tt += dt;
        const car = ctx.car, rd = ctx.world.road;
        if (P.phase === "in") {
            const left = g.s - car.s;
            const look = Math.max(4, Math.min(left, car.speed * 0.8 + 3));
            rd.point(car.s + look, D, tmp);
            const want = Math.atan2(tmp.x - car.pos.x, tmp.z - car.pos.z);
            let diff = want - car.h; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
            const vT = clamp(left * 0.9, 0, 9);
            updateDriving(dt, {}, false, { steer: clamp(-diff * 2.6, -1, 1), throttle: car.speed < vT ? 0.5 : 0, brake: car.speed > vT + 0.8 ? 0.9 : 0, handbrake: false, analog: true });
            if (!P.said && P.tt > 0.5) { P.said = true; say("Moishe", (ctx.memory && ctx.memory.recognize("moishe", { color: P.color.name })) || pick(T.PAINT_HELLO), { emoji: "🧑‍🔧", color: "#4A148C", auto: 2.3 }); }
            if ((left < 0.8 && car.speed < 1.5) || P.tt > 4.2) { P.phase = "settle"; P.tt = 0; P.snapFrom = { x: car.pos.x, z: car.pos.z, h: car.h }; }
        } else if (P.phase === "settle") {
            // ease the last bit dead centre (no pop)
            const k = smooth(P.tt / 0.35);
            rd.point(g.s, D, tmp);
            const h = rd.at(g.s, tmpB).h;
            car.pos.x = lerp(P.snapFrom.x, tmp.x, k); car.pos.z = lerp(P.snapFrom.z, tmp.z, k);
            car.h = P.snapFrom.h + (wrap(h - P.snapFrom.h)) * k;
            car.vx = car.vz = 0;
            updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 0.25, handbrake: false, analog: true });
            if (P.tt >= 0.35) { P.phase = "close"; P.tt = 0; sfx.rattle(1.0); }
        } else if (P.phase === "close") {
            const k = smooth(P.tt / 1.0);
            B.inDoor = lerp(0.06, 1, k); B.outDoor = lerp(0.06, 1, k);
            setDoors(B);
            hold(dt);
            if (P.tt >= 1.0) { P.phase = "spray"; P.tt = 0; P.hiss = sfx.hiss(); payAndPaint(P); }
        } else if (P.phase === "spray") {
            hold(dt);
            if (P.hiss) P.hiss.set(0.14 * (0.6 + 0.4 * Math.sin(P.tt * 9)));
            B.shake = 0.035 * Math.sin(P.tt * 37) * (1 - P.tt / 2.8);
            B.grp.position.set(B.shake, Math.abs(B.shake) * 0.5, -B.shake);
            puffs(P, B, dt);
            if (P.tt >= 2.8) {
                P.phase = "open"; P.tt = 0;
                B.grp.position.set(0, 0, 0);
                if (P.hiss) { P.hiss.stop(); P.hiss = null; }
                sfx.rattle(0.9);
                say("Moishe", P.warrants ? T.PAINT_WARRANT : pick(T.PAINT_DONE), { emoji: "🧑‍🔧", color: "#4A148C", auto: 2.2 });
            }
        } else if (P.phase === "open") {
            const k = smooth(P.tt / 0.9);
            B.outDoor = lerp(1, 0.06, k);
            setDoors(B);
            hold(dt);
            if (P.tt > 0.5 && !P.sparkled) {
                P.sparkled = true;
                sfx.sparkle();
                const c = new THREE.Color(P.color.body);
                car.fx.burst(car.pos.x, 1.3, car.pos.z, 26, 3.2, [1, 1, 0.85], 0.5, 0.9);
                car.fx.burst(car.pos.x, 1.0, car.pos.z, 18, 2.4, [c.r, c.g, c.b], 0.8, 1.0);
                H.banner(`<b>🎨 FRESH PAINT — HEAT'S OFF!</b><small>${P.color.name}${P.stars ? ` · ${P.stars}★ shaken` : ""}</small>`, 2400, { key: "streets:paint", prio: 2 });
            }
            if (P.tt >= 0.9) { P.phase = "out"; P.tt = 0; }
        } else if (P.phase === "out") {
            rd.point(car.s + 9, D - (car.s - g.s > 4 ? 2.5 : 0), tmp);
            const want = Math.atan2(tmp.x - car.pos.x, tmp.z - car.pos.z);
            const diff = wrap(want - car.h);
            updateDriving(dt, {}, false, { steer: clamp(-diff * 2.6, -1, 1), throttle: car.speed < 11 ? 0.6 : 0, brake: 0, handbrake: false, analog: true });
            if (car.s > g.s + HALF + 4.5 || P.tt > 3.2) {
                B.inDoor = 0.06;
                luluSays(pick(["Ooh, I LOVE this colour!", "New car, who dis?", "Officer? Never met her."]), true);
                setState("playing");
            }
        }
    },
    camera(dt) {
        if (!P || !P.g.built) return false;
        const g = P.g, rd = ctx.world.road, car = ctx.car;
        if (P.phase === "in" || P.phase === "settle") {
            rd.point(g.s - 26, 1.0, tmp); _a.set(tmp.x, 3.4, tmp.z);
            rd.point(g.s - HALF - 1, D, tmp); _b.set(tmp.x, 1.6, tmp.z);
            _b.lerp(car.pos, 0.35); _b.y = 1.4;
            ctx.cam.cinematic(_a, _b, dt, 2, 50);
        } else if (P.phase === "close" || P.phase === "spray") {
            rd.point(g.s - 4, -6, tmp); _a.set(tmp.x, 5.2, tmp.z);
            rd.point(g.s, D, tmp); _b.set(tmp.x, 2.6, tmp.z);
            ctx.cam.cinematic(_a, _b, dt, 1.4, 52);
        } else {
            rd.point(g.s + HALF + 13, 7.5, tmp); _a.set(tmp.x, 2.4, tmp.z);
            _b.set(car.pos.x, 1.0, car.pos.z);
            ctx.cam.cinematic(_a, _b, dt, 2.2, 48);
        }
        return true;
    },
});
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function hold(dt) { updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 0.25, handbrake: false, analog: true }); ctx.car.vx = ctx.car.vz = 0; }
function puffs(P, B, dt) {
    const car = ctx.car, c = P.cc || (P.cc = new THREE.Color(P.color.body));
    const col = [c.r, c.g, c.b], white = [0.95, 0.95, 0.98];
    for (const v of B.vents) {
        if (Math.random() < 0.7) {
            v.getWorldPosition(_a);
            car.fx.emit(_a.x, _a.y + 0.3, _a.z, rand(-0.6, 0.6), rand(1.4, 2.6), rand(-0.6, 0.6), 1.6, 1.4, Math.random() < 0.8 ? col : white);
        }
    }
    // colour leaking out under both doors
    const rd = ctx.world.road;
    for (const ds of [-HALF - 0.2, HALF + 0.2]) {
        if (Math.random() < 0.6) {
            rd.point(P.g.s + ds, D + rand(-1.8, 1.8), tmp);
            car.fx.emit(tmp.x, 0.2, tmp.z, rand(-0.5, 0.5) + Math.sign(ds) * 0.8, rand(0.2, 0.7), rand(-0.5, 0.5), 1.1, 1.0, col);
        }
    }
}

// ── the job itself: pay, paint, fix the tyres, lose the heat ────────────
function payAndPaint(P) {
    if (P.paid) return;
    P.paid = true;
    const c = P.cost;
    if (wallet.spend(c)) flushShared();
    toast(`🎨 Paint & Pray −${c} 💰`, "", "streets:pay");
    sfx.chaChing();
    paintCar(P.color);
    repairTyres();
    const law = ctx.law;
    P.warrants = !!(law && law.warrants && law.warrants.length);
    if (law) {
        try { law.clearHeat("🎨 Fresh paint — nobody recognises you!"); } catch (e) { console.error(e); }
        // (a new colour = a new description: the warrant file / a call-in out for the old car don't know her this run)
        try { if (law.changeLook) law.changeLook("paint"); } catch (e) { console.error(e); }
        if (law.hold) law.hold(18);          // (ticks down during the scene too)
    }
    PAINT.jobs++;
    stat("resprays", 1);
    emit("streets:paint", { cost: c, color: P.color.name, cleared: P.stars });
}
const painted = [];
/** Recolour Lulu's car (or the ride she jacked) — a per-run disguise; restored on a new run / skin change. */
export function paintCar(c) {
    restorePaint();
    PAINT.color = c;
    const shell = ctx.foot && ctx.foot.shellObj;
    const root = shell || ctx.car.model;
    const map = shell ? { Paint: c.body, CopPaint: c.body } : { Body: c.body, BodyLight: c.light, BodyDark: c.dark };
    root.traverse(o => {
        if (!o.isMesh || !o.material || !map[o.material.name]) return;
        const m = o.material.clone();
        m.color.set(map[o.material.name]);
        painted.push({ o, orig: o.material, m });
        o.material = m;
    });
    const ride = currentRide();
    if (ride) ride.color = c.body;
}
export function restorePaint() {
    for (const p of painted) { if (p.o.material === p.m) p.o.material = p.orig; p.m.dispose(); }
    painted.length = 0;
    PAINT.color = null;
}

// ── lifecycle ───────────────────────────────────────────────────────────
hook("update", () => {
    if (!live()) return;
    const party = partyRun();
    if (party) planParty();
    if (!models[K("paint")]) return;
    const s = ctx.car.s;
    for (const g of PAINT.garages) {
        if (!g.party !== !party) continue;                 // a party's booths only in a party, the solo ones only solo
        if (g.built || g.skip || s < g.s - 650 || s > g.s + 200) continue;
        if (!g.party && clash(g)) { g.skip = true; continue; }
        build(g);
    }
});
on("boot", () => {
    if (!live()) return;
    plan();
    need(["paint", "owner"]).catch(e => console.error("[streets] paint models", e));
});
hook("runStart", G => {
    restorePaint(); PAINT.hinted.clear(); dropPartyGarages();
    for (const g of PAINT.garages) { g.cool = 0; if (G && G.mode === "party" && g.built) unbuild(g); }
    if (G && G.mode === "party" && live()) need(["paint", "owner"]).catch(() => {});
});
on("skin", () => { painted.length = 0; PAINT.color = null; });
on("title", () => restorePaint());

/** Tests / other features: a garage `ahead` metres up the road right now (no reservation). */
export function garageAhead(ahead = 120) {
    const g = addGarage(ctx.car.s + ahead, false);
    if (models[K("paint")]) build(g);
    return g;
}
export function nearestGarage() {
    const s = ctx.car.s, party = partyRun();
    let best = null;
    for (const g of PAINT.garages) if (!g.skip && !g.party === !party && g.s > s - 20 && (!best || g.s < best.s)) best = g;
    return best ? { s: best.s, dist: best.s - s, built: !!best.built, g: best } : null;
}

