// features/roadevents — roadside treats: the ICE-CREAM STAND (2D ice-cream sign,
// +5), the ICE-CREAM TRUCK (+12–25, kids crowding the window and dashing across
// the road toward it, the jingle) and the DRIVE-THRU (+20–45 🍔).
// You collect by hugging the shoulder past the glowing pickup.
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { facingRoad } from "../../world.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { PAY, SERVER_LINES, SCOOP_LINES } from "./config.js";
import { defineEvent, inc, count, R } from "./state.js";
import { K, need, pt, place, rnd, rint, pick, clamp, claimSlot, reserve, makePiece, findNodes, bubble, marker, sfx, stat, confetti, personColors, solid, models, cloneWithColors } from "./common.js";
import { addPed, seat } from "./passengers.js";

const _w = new THREE.Vector3();

/** A floating, spinning pickup (burger / cone) with a soft glow disc under it. */
function pickupMarker(P, key, s, d, scale = 1) {
    const g = new THREE.Group();
    const obj = cloneWithColors(models[K(key)]);
    obj.scale.setScalar(scale);
    g.add(obj);
    const glow = new THREE.Mesh(P.own(new THREE.CircleGeometry(1.25, 24)), P.own(new THREE.MeshBasicMaterial({ color: "#FFD54F", transparent: true, opacity: 0.35, depthWrite: false })));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.2;
    g.add(glow);
    place(g, s, d, 0, 1.25);
    P.add(g);
    return { g, obj, glow, base: g.position.y };
}
function spinMarker(m, t) {
    m.obj.rotation.y = t * 2.2;
    m.g.position.y = m.base + Math.sin(t * 3) * 0.15;
    m.glow.material.opacity = 0.25 + Math.sin(t * 6) * 0.12;
}
/** Food flies into the car and rides on the passenger seat for a bit. */
function foodToCar(src, secs = 5) {
    const car = ctx.car;
    const obj = src.clone();
    obj.scale.setScalar(0.5);
    car.tilt.add(obj);
    obj.position.set(-0.3, 1.15, 0.5);
    let t = 0;
    addActor({ update(dt) { t += dt; obj.rotation.y += dt * 1.5; return t < secs; }, dispose() { if (obj.parent) obj.parent.remove(obj); } });
}

// ── the ice-cream stand (SPAWN_CONFIG.iceCream) ─────────────────────────────
export async function spawnIceStand(opts = {}) {
    await need(["icecream_stand", "treat", "roadevents_vendor"]);
    const slot = claimSlot(30, 30, opts);
    const s = slot.s, side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const P = makePiece("iceStand");
    P.later(slot.release);
    reserve(s - 20, s + 20, side, 8.8, 18);
    const road = ctx.world.road;
    const stand = cloneWithColors(models[K("icecream_stand")]);
    const sp = pt(s, side * 11.2);
    stand.position.set(sp.x, 0, sp.z);
    stand.rotation.y = facingRoad(sp.h, side);
    P.add(stand);
    const vendor = spawnPerson(K("vendor"));
    const vp = pt(s - 0.4, side * 12.3);
    vendor.obj.position.set(vp.x, 0, vp.z);
    vendor.obj.rotation.y = facingRoad(vp.h, side);
    P.add(vendor.obj);
    const mk = pickupMarker(P, "treat", s, side * 8.1, 1.3);
    const label = marker("🍦", mk.g, 1.4);
    P.later(() => label.remove());
    const solids = [{ ...pt(s, side * 11.2), r: 1.0 }];
    const E = { s, side, taken: false, t: 0 };
    inc("iceCream");
    addActor({
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car;
            if (!E.taken) spinMarker(mk, E.t);
            vendor.update(dt, { wave: Math.abs(s - car.s) < 60 && !E.taken });
            vendor.face(car.pos.x, car.pos.z, dt, 2);
            if (!E.taken && Math.abs(s - car.s) < 4 && side * car.d > 6.4 && ctx.state === "playing") {
                E.taken = true;
                mk.g.visible = false; label.remove();
                addCoins(PAY.iceCreamSign, "icecream");
                H.toast(`🍦 ICE CREAM! +${PAY.iceCreamSign}`, "pink");
                bubble(pick(SCOOP_LINES), vendor.obj, { t: 2.2, y: 2.3, cls: "pink" });
                sfx.buy();
                rumble(0.1, 0.4, 100);
                confetti(car.pos.x, car.pos.z, 30);
                for (const r of seat.riders) r.waveT = -0.1;     // everyone in the car celebrates
                foodToCar(mk.obj, 4);
                stat("iceCreams", 1);
                count("iceCreams");
            }
            return car.s < s + 160;
        },
        collide(car) {
            if (Math.abs(s - car.s) > 8) return null;
            let w = 0;
            for (const c of solids) w = Math.max(w, solid(c.x, c.z, c.r));
            return w > 2 ? { impact: w * 0.7, why: "Brain freeze! (you hit the cart)", source: "icecream" } : null;
        },
        dispose() { P.disposePiece(); inc("iceCream", -1); },
    });
    return E;
}
defineEvent("iceCream", { label: "Ice-cream stand", emoji: "🍦", models: ["icecream_stand", "treat", "vendor"], spawn: spawnIceStand, setPiece: true });

// ── the ice-cream truck ────────────────────────────────────────────────────
export async function spawnIceTruck(opts = {}) {
    await need(["icecream_truck", "treat", "vendor", "npcKid"]);
    const slot = claimSlot(60, 40, opts);
    const s = slot.s, side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const P = makePiece("iceTruck");
    P.later(slot.release);
    reserve(s - 40, s + 40, side, 8.8, 18);
    const truck = cloneWithColors(models[K("icecream_truck")]);
    place(truck, s, side * 10.5, side > 0 ? 0 : Math.PI);
    P.add(truck);
    const vendor = spawnPerson(K("vendor"));
    const anc = findNodes(truck, "Anchor_server")[0];
    (anc || truck).add(vendor.obj);
    vendor.obj.rotation.y = Math.PI / 2;
    // kids clustered at the serving window (2D: 2–3), plus 1–2 dashing across the road
    const kids = [];
    for (let i = 0, n = rint(2, 3); i < n; i++) {
        const k = spawnPerson("npcKid", { colors: personColors() });
        place(k.obj, s + rnd(-2.2, 2.2), side * rnd(8.4, 9.1), side > 0 ? Math.PI / 2 : -Math.PI / 2);
        k.obj.rotation.y += rnd(-0.4, 0.4);
        P.add(k.obj);
        kids.push(k);
    }
    const mk = pickupMarker(P, "treat", s, side * 6.3, 1.2);
    const label = marker("🍦", mk.g, 1.4);
    P.later(() => label.remove());
    const solids = [];
    for (let a = -2.6; a <= 2.61; a += 1.3) solids.push({ ...pt(s + a, side * 10.5), r: 1.25 });
    const E = { s, side, taken: false, t: 0, jingled: false, noteT: 0, dashed: false };
    inc("iceTruck");
    count("iceTrucks");
    addActor({
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car, ahead = s - car.s;
            if (!E.taken) spinMarker(mk, E.t);
            vendor.update(dt, { talk: true, wave: Math.sin(E.t * 0.8) > 0.6 });
            kids.forEach((k, i) => k.update(dt, { cheer: Math.sin(E.t * 2 + i * 2) > 0, wave: i === 0 && Math.sin(E.t * 1.3) > 0.4 }));
            if (ahead < 240 && ahead > -20) {
                E.noteT -= dt;
                if (E.noteT <= 0) { E.noteT = 4.2; sfx.jingle(); bubble(pick(["♪ ♫ ♪", "♫ ♪", "♪ ♪ ♫"]), truck, { t: 2, y: 4.4, cls: "pink" }); }
            }
            // kids dash across toward the truck (watch out! — they always dodge)
            if (!E.dashed && ahead < 150 && ctx.state === "playing") {
                E.dashed = true;
                for (let k = 0, n = rint(1, 2); k < n; k++) addPed({ s: s - rnd(4, 24), d: -side * rnd(7, 9), vx: side * rnd(2.6, 3.4), kind: "kid", model: "npcKid" });
            }
            if (!E.taken && Math.abs(ahead) < 5 && side * car.d > 4.4 && ctx.state === "playing") {
                E.taken = true;
                mk.g.visible = false; label.remove();
                const scoop = rint(PAY.iceTruck[0], PAY.iceTruck[1]);
                addCoins(scoop, "icecream");
                addScore(scoop * 4, "icecream");
                H.toast(`🍦 +${scoop}`, "pink");
                bubble(pick(SCOOP_LINES), vendor.obj, { t: 2.4, y: 2.2, cls: "pink" });
                sfx.buy();
                rumble(0.1, 0.4, 100);
                foodToCar(mk.obj, 5);
                stat("iceTrucks", 1);
                count("scoops");
            }
            return car.s < s + 180;
        },
        collide(car) {
            if (Math.abs(s - car.s) > 9) return null;
            let w = 0;
            for (const c of solids) { const dx = c.x - car.pos.x, dz = c.z - car.pos.z; if (dx * dx + dz * dz < 12) w = Math.max(w, solid(c.x, c.z, c.r)); }
            return w > 2 ? { impact: w * 0.8, why: "Lulu vs. the ice-cream truck: everybody screams", source: "icecream" } : null;
        },
        dispose() { P.disposePiece(); inc("iceTruck", -1); },
    });
    return E;
}
defineEvent("iceTruck", { label: "Ice-cream truck", emoji: "🚚", models: ["icecream_truck", "treat", "vendor", "npcKid"], spawn: spawnIceTruck, setPiece: true });

// ── the drive-thru (SPAWN_CONFIG.driveThru) ────────────────────────────────
export async function spawnDriveThru(opts = {}) {
    await need(["drivethru", "menuboard", "burger", "vendor"]);
    const slot = claimSlot(60, 50, opts);
    const s = slot.s, side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const P = makePiece("driveThru");
    P.later(slot.release);
    reserve(s - 45, s + 45, side, 8.8, 34);
    const b = cloneWithColors(models[K("drivethru")]);
    const bp = pt(s, side * 18);
    b.position.set(bp.x, 0, bp.z);
    b.rotation.y = facingRoad(bp.h, side);
    P.add(b);
    b.updateMatrixWorld(true);
    // the server in the window
    const server = spawnPerson(K("vendor"), { colors: { Top: "#D32F2F", ChefHat: "#FFFFFF" } });
    const anc = findNodes(b, "Anchor_server")[0];
    (anc || b).add(server.obj);
    // where the window is on the road
    (anc || b).getWorldPosition(_w);
    const wn = ctx.world.road.nearest(_w.x, _w.z, s);
    const sw = wn.s;
    // the order lane: a stripe of drive surface from the shoulder to the window + menu board
    const lane = new THREE.Mesh(P.own(new THREE.PlaneGeometry(4.2, 7.2)), P.own(new THREE.MeshStandardMaterial({ color: "#a9a49a", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
    lane.rotation.x = -Math.PI / 2;
    const lg = place(new THREE.Group(), sw, side * 11.2, 0, 0.02);
    lg.add(lane);
    P.add(lg);
    const menu = cloneWithColors(models[K("menuboard")]);
    const mp = pt(sw - 9, side * 10.2);
    menu.position.set(mp.x, 0, mp.z);
    menu.rotation.y = facingRoad(mp.h, side);
    P.add(menu);
    const mk = pickupMarker(P, "burger", sw, side * 8.0, 1.25);
    const label = marker("🍔 <small>ORDER</small>", mk.g, 1.5);
    P.later(() => label.remove());
    const solids = [{ ...pt(s, side * 18), r: 4.6 }, { ...mp, r: 0.8 }];
    const E = { s: sw, side, taken: false, t: 0 };
    inc("driveThru");
    count("driveThrus");
    addActor({
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car, ahead = sw - car.s;
            if (!E.taken) spinMarker(mk, E.t);
            server.update(dt, { talk: Math.abs(ahead) < 30, wave: !E.taken && ahead < 60 && ahead > 0 && Math.sin(E.t * 1.6) > 0.3 });
            if (!E.taken && Math.abs(ahead) < 4.5 && side * car.d > 6.2 && ctx.state === "playing") {
                E.taken = true;
                mk.g.visible = false; label.remove();
                const meal = rint(PAY.driveThru[0], PAY.driveThru[1]);
                addCoins(meal, "drivethru");
                addScore(meal * 4, "drivethru");
                H.toast(`🍔 +${meal}`, "gold");
                bubble(pick(SERVER_LINES), server.obj, { t: 2.4, y: 2.2, cls: "gold" });
                sfx.buy();
                rumble(0.1, 0.4, 100);
                foodToCar(mk.obj, 6);
                stat("driveThrus", 1);
                count("meals");
            }
            return car.s < s + 200;
        },
        collide(car) {
            if (Math.abs(s - car.s) > 14) return null;
            let w = 0;
            for (const c of solids) { const dx = c.x - car.pos.x, dz = c.z - car.pos.z; if (dx * dx + dz * dz < (c.r + 2) ** 2) w = Math.max(w, solid(c.x, c.z, c.r)); }
            return w > 2 ? { impact: w * 0.8, why: "That's NOT the drive-thru lane!", source: "drivethru" } : null;
        },
        dispose() { P.disposePiece(); inc("driveThru", -1); },
    });
    return E;
}
defineEvent("driveThru", { label: "Drive-thru", emoji: "🍔", models: ["drivethru", "menuboard", "burger", "vendor"], spawn: spawnDriveThru, setPiece: true });
