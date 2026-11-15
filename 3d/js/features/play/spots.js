// features/play — where the playground things go. Each 200 m road chunk is
// planned with its OWN seeded random (so a rebuilt chunk looks the same and
// the shared chunk `rnd` other features use is untouched): maybe a stunt ramp
// (in a lane or on the shoulder, with sky-dreidels along a good jump), or a
// parked truck with a dreidel tucked just past its nose; plus maybe a dreidel
// pattern — a line on the shoulder, a weave across our lanes, or a risky trio
// in the oncoming lane. All of it only when ctx.enabled("play").
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { models, cloneWithColors } from "../../models.js";
import { mulberry32, CHUNK } from "../../world.js";
import { enabled, worldTick, onWorldTick } from "./common.js";
import { addDreidelAt, removeChunk as dropDreidels } from "./dreidels.js";
import { addRamp, removeChunk as dropRamps, arcY, RAMP } from "./ramps.js";

const RAMP_CHANCE = 0.22, TRUCK_CHANCE = 0.12, PATTERN_CHANCE = 0.6;
const FIRST_S = 400;              // keep the first stretch of every drive clean
const TRUCK_PAINT = ["#ECEFF1", "#90CAF9", "#FFCC80", "#A5D6A7", "#F48FB1", "#B39DDB"];

on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (!enabled()) return;
    chunk.onAnimate(worldTick);
    if (s0 < FIRST_S) return;
    const k = chunk.k;
    const r = mulberry32(k * 7919 + 1301);
    const busy = [];
    const trapS = world.config.speedTraps && k % 6 === 4 ? s0 + 120 : null;
    const free = (a, b, shoulder = false) => {
        if (a < s0 - 60 || b > s1 + 90) return false;
        for (const [x, y] of busy) if (a < y && b > x) return false;
        for (const x of [a, (a + b) / 2, b]) {
            for (const d of [0, 9.5, -9.5, 12, -12]) if (world.isReserved(x, d, 4)) return false;
        }
        if (trapS != null && a < trapS + 35 && b > trapS - 35) return false;
        if (shoulder) for (const sg of world.signs) if (sg.s > a - 14 && sg.s < b + 14) return false;
        return true;
    };
    const coinsIn = (a, b, dMin, dMax) => chunk.coins.some(c => c.s > a - 5 && c.s < b + 5 && c.d >= dMin && c.d <= dMax);

    // 1. a stunt ramp, or a parked truck hiding a dreidel
    const roll = r();
    if (roll < RAMP_CHANCE) {
        for (let t = 0; t < 4; t++) {
            const s = s0 + 35 + r() * 110, w = r();
            const d = w < 0.38 ? 5.25 : w < 0.72 ? 1.75 : 7.85;       // right lane, left lane, shoulder
            // a fairly straight stretch, so the landing stays on the road (shoulder ramps: well clear of the poles)
            const bend = Math.abs(world.road.at(s + 60).h - world.road.at(s - 6).h);
            if (bend > (d > 7 ? 0.08 : 0.16)) continue;
            if (!free(s - 70, s + 70, d > 7) || coinsIn(s - 12, s + 48, d - 2, d + 2)) continue;
            placeRamp(chunk, world, s, d, k);
            busy.push([s - 70, s + 70]);
            break;
        }
    } else if (roll < RAMP_CHANCE + TRUCK_CHANCE) {
        for (let t = 0; t < 4; t++) {
            const s = s0 + 30 + r() * 120;
            if (!free(s - 14, s + 22, true)) continue;
            if ((chunk.houses || []).some(h => h.d > 0 && Math.abs(h.s - s) < 12)) continue;
            placeTruck(chunk, world, s, k, TRUCK_PAINT[Math.floor(r() * TRUCK_PAINT.length)]);
            busy.push([s - 14, s + 22]);
            break;
        }
    }

    // 2. a dreidel pattern
    if (r() < PATTERN_CHANCE) {
        const kind = r(), s = s0 + 20 + r() * 130, side = r();
        if (kind < 0.4) {                                           // a line on the shoulder
            const d = side < 0.8 ? 8.0 : -8.0;
            if (free(s - 4, s + 32, true)) for (let i = 0; i < 5; i++) addDreidelAt(s + i * 7, d, k, d < 0 ? "risky" : "line");
        } else if (kind < 0.7) {                                    // a weave across our lanes
            if (free(s - 4, s + 44) && !coinsIn(s, s + 40, 0, 7)) {
                for (let i = 0; i < 6; i++) addDreidelAt(s + i * 8, 3.5 + Math.sin(i / 5 * Math.PI * 2 + side * 6) * 2.1, k, "line");
            }
        } else {                                                    // risky: the oncoming lane
            const d = side < 0.5 ? -1.75 : -5.25;
            if (free(s - 4, s + 18) && !coinsIn(s, s + 14, d - 2, d + 2)) for (let i = 0; i < 3; i++) addDreidelAt(s + i * 7, d, k, "risky");
        }
    }
});

on("chunk:dispose", ({ chunk }) => { dropDreidels(chunk.k); dropRamps(chunk.k); });

// ── the ramp set piece: ramp + sky dreidels + chevrons + a sign ──────────
let chevMat = null, chevGeo = null;
function chevrons() {
    if (chevMat) return;
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#FFD23F";
    for (const y of [18, 66]) {
        g.beginPath();
        g.moveTo(14, y + 40); g.lineTo(64, y); g.lineTo(114, y + 40); g.lineTo(96, y + 48); g.lineTo(64, y + 22); g.lineTo(32, y + 48);
        g.closePath(); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    chevMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    chevGeo = new THREE.PlaneGeometry(2.4, 2.4);
    chevGeo.rotateX(-Math.PI / 2);
}

export function placeRamp(chunk, world, s, d, k) {
    const ramp = addRamp(chunk, s, d, k);
    if (!ramp) return null;
    const lip = s + RAMP.L / 2;
    // sky dreidels along a ~28 m/s jump (y = the dreidel's tip; its body centre lines up with the car's)
    for (const x of [11, 19, 27]) addDreidelAt(lip + x, d, k, "air", Math.max(0.35, arcY(x) + 0.22));
    if (chunk) {
        chevrons();
        for (const back of [9, 17]) {
            const p = world.road.point(s - RAMP.L / 2 - back, d, {});
            const m = new THREE.Mesh(chevGeo, chevMat);
            m.position.set(p.x, 0.045, p.z);
            m.rotation.y = p.h;
            m.renderOrder = 1;
            chunk.add(m);
        }
        const signS = s - 60;
        if (!world.signs.some(sg => Math.abs(sg.s - signS) < 14) && !world.isReserved(signS, 10.3, 4)) {
            chunk.sign(world, { s: signS, d: 10.3, lines: ["⬆ RAMP", "AHEAD!"], bg: "#FF4FA3", fg: "#ffffff", w: 2.4, h: 1.4 });
        }
    }
    return ramp;
}

// ── a parked truck on the shoulder, hazards blinking, a dreidel past its nose ──
let hazard = null;
export function placeTruck(chunk, world, s, k, paint = "#ECEFF1") {
    if (!models.truck) return;
    const d = 8.75;
    const p = world.road.point(s, d, {});
    const truck = cloneWithColors(models.truck, { Paint: paint });
    truck.position.set(p.x, 0, p.z);
    truck.rotation.y = p.h;
    truck.traverse(o => {
        if (!o.isMesh || !/Taillight|Headlight/.test(o.material.name)) return;
        if (o.material.name === "Taillight") {
            if (!hazard) { hazard = o.material.clone(); hazard.name = "PlayHazard"; hazard.emissive = new THREE.Color("#FF9100"); hazard.color = new THREE.Color("#FFB74D"); }
            o.material = hazard;
        }
    });
    chunk.add(truck);
    for (const off of [-2.6, 0, 2.6]) {
        const q = world.road.point(s + off, d, {});
        chunk.addCollider({ x: q.x, z: q.z, r: 1.25, kind: "playTruck", top: 3.4 });
    }
    // "tucked behind": just past the cab, where you only see it once you're level with the truck
    addDreidelAt(s + 5.8, 8.25, k, "risky");
    addDreidelAt(s + 9.6, 7.85, k, "line");
    addDreidelAt(s + 13.4, 7.45, k, "line");
}
onWorldTick(time => { if (hazard) hazard.emissiveIntensity = Math.sin(time * 6.5) > 0 ? 4 : 0.25; });

/** Which chunk (if built) holds road distance s. */
export function chunkAt(s) {
    return ctx.world && ctx.world.chunks ? ctx.world.chunks.get(Math.floor(s / CHUNK)) || null : null;
}
