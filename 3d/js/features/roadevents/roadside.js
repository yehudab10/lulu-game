// features/roadevents — roadside scenery with a story (2D "roadsideVeh"): a car
// crumpled into a tree, one that slid off into the mud, one pulled over by a cop
// (lights going), an abandoned one (the driver's off "watering" a bush), one
// broken down with the hood up — plus BILLBOARDS with the 2D game's slogans.
// Built into world chunks (seeded, so a chunk always rebuilds the same).
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { mulberry32, facingRoad, canvasTex } from "../../world.js";
import { BILLBOARDS } from "./config.js";
import { R } from "./state.js";
import { K, models, cloneWithColors, smoke } from "./common.js";
import { spawnPerson } from "../../core/people.js";
import { varRibbon } from "./toll.js";

const STORIES = ["tree", "offtrail", "pulled", "abandoned", "malfunction"];
const PAINTS = ["#42A5F5", "#FFFFFF", "#FFCA28", "#66BB6A", "#EF5350", "#8D6E63", "#9E9E9E", "#26C6DA", "#263238", "#FF8A65", "#BA68C8"];
let MUD = null, HOOD = null;
const billMats = new Map();
function billboardMat(msg) {
    let m = billMats.get(msg);
    if (m) return m;
    const tex = canvasTex(1024, 432, (g, w, h) => {
        const bgs = ["#FFF3E0", "#E3F2FD", "#FCE4EC", "#E8F5E9", "#FFFDE7", "#EDE7F6"];
        g.fillStyle = bgs[msg.length % bgs.length]; g.fillRect(0, 0, w, h);
        g.fillStyle = ["#E91E63", "#1565C0", "#2E7D32", "#6A1B9A", "#E65100"][msg.length % 5];
        g.fillRect(0, h - 46, w, 46);
        g.fillStyle = "#2b1b2e"; g.textAlign = "center"; g.textBaseline = "middle";
        const words = msg.split(" ");
        const lines = [];
        let cur = "";
        for (const wd of words) { if ((cur + " " + wd).trim().length > 14 && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); }
        if (cur) lines.push(cur);
        const size = lines.length > 2 ? 104 : 130;
        g.font = `700 ${size}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        lines.forEach((ln, i) => g.fillText(ln, w / 2, (h - 46) / 2 + (i - (lines.length - 1) / 2) * size * 1.02, w - 60));
    }, false);
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    billMats.set(msg, m);
    return m;
}

function inZone(s) { return R.zoneSched && s > R.zoneSched.s0 - 60 && s < R.zoneSched.s1 + 60; }
function nearHouse(chunk, s, side) { return (chunk.houses || []).some(h => Math.abs(h.s - s) < 16 && Math.sign(h.d) === side); }

on("chunk:build", ({ chunk, world, s0 }) => {
    if (!ctx.enabled("roadevents") || s0 < 300 || !ctx.world) return;
    const r = mulberry32(chunk.k * 7331 + 99);
    const road = world.road, p = {};
    // a roadside story (2D: rural shoulders only, ~every 150–200 m)
    if (r() < 0.42) {
        let s = chunk.s0 + 30 + r() * 140;
        const side = r() < 0.5 ? -1 : 1;
        if (side > 0 && Math.abs(((s % 46) + 46) % 46 - 23) > 17) s += 9;      // keep clear of the power poles
        const story = STORIES[Math.floor(r() * STORIES.length)];
        if (!inZone(s) && !world.isReserved(s, side * 11, 10) && !nearHouse(chunk, s, side)) buildStory(chunk, world, r, s, side, story);
    }
    // a billboard (2D: every 8–18 s)
    if (r() < 0.3 && models[K("billboard")]) {
        const s = chunk.s0 + 20 + r() * 160, side = r() < 0.5 ? -1 : 1, d = side * (19 + r() * 4);
        if (!world.isReserved(s, d, 12) && !nearHouse(chunk, s, side)) {
            const b = cloneWithColors(models[K("billboard")]);
            road.point(s, d, p);
            b.position.set(p.x, 0, p.z);
            b.rotation.y = facingRoad(p.h, side) + (r() - 0.5) * 0.4;
            const mat = billboardMat(BILLBOARDS[Math.floor(r() * BILLBOARDS.length)]);
            b.traverse(o => { if (o.isMesh && o.material.name === "BillboardFace") o.material = mat; });
            chunk.add(b);
            b.updateMatrixWorld(true);
            for (const x of [-2.4, 2.4]) { const v = b.localToWorld(new THREE.Vector3(x, 0, -0.2)); chunk.addCollider({ x: v.x, z: v.z, r: 0.35, kind: "sign" }); }
        }
    }
});

function car(paint, kind = "sedan") { return cloneWithColors(models[kind], { Paint: paint }); }

function buildStory(chunk, world, r, s, side, story) {
    const road = world.road, p = {};
    const paint = PAINTS[Math.floor(r() * PAINTS.length)];
    const kind = r() < 0.7 ? "sedan" : "van";
    const h = road.at(s).h;
    const put = (obj, ss, d, yaw) => { road.point(ss, d, p); obj.position.set(p.x, 0, p.z); obj.rotation.y = h + yaw; chunk.add(obj); return obj; };
    const col = (ss, d, rr, k = "car") => { road.point(ss, d, p); chunk.addCollider({ x: p.x, z: p.z, r: rr, kind: k }); };
    if (story === "tree") {
        const tree = put(cloneWithColors(models.treeRound, { Leaves: "#6CC24A" }), s + 2.6, side * 13.4, r() * 6);
        tree.scale.setScalar(1.05);
        put(car(paint, kind), s - 0.2, side * 11.6, -side * (0.12 + r() * 0.2));
        col(s + 2.6, side * 13.4, 0.6, "tree"); col(s - 0.2, side * 11.6, 1.6);
        const sp = road.point(s + 1.6, side * 12.6, {});
        chunk.onAnimate(() => { if (Math.random() < 0.08) smoke(sp.x, 1.2, sp.z, 1, [0.7, 0.7, 0.72]); });
    } else if (story === "offtrail") {
        put(car(paint, kind), s, side * 13, -side * (0.5 + r() * 0.4));
        col(s, side * 13, 1.6);
        if (!MUD) MUD = new THREE.MeshStandardMaterial({ color: "#5d4329", roughness: 1, transparent: true, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        for (const off of [-0.8, 0.8]) {
            const d0 = x => side * (8.6 + Math.pow(Math.max(0, (x - (s - 16)) / 16), 1.6) * 4.4) + off * 0.5;
            chunk.addMesh(varRibbon(s - 16, s - 1, d0, x => d0(x) + side * 0.35, 0.03, 1), MUD);
        }
    } else if (story === "pulled") {
        put(car(paint, kind), s, side * 10.2, side > 0 ? 0 : Math.PI);
        const cop = put(cloneWithColors(models.cop), s - side * 7.5, side * 10.4, (side > 0 ? 0 : Math.PI) + 0.08);
        col(s, side * 10.2, 1.6); col(s - side * 7.5, side * 10.4, 1.6, "cop");
        const lights = [];
        cop.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) { o.material = o.material.clone(); lights.push(o.material); chunk.own(o.material); } });
        chunk.onAnimate(t => lights.forEach((m, i) => { m.emissiveIntensity = Math.sin(t * 10 + i * Math.PI) > 0 ? 4 : 0.3; }));
        if (models.copPerson) {
            const officer = spawnPerson("copPerson");
            put(officer.obj, s - side * 1.4, side * 8.7, side > 0 ? -Math.PI / 2 + 0.3 : Math.PI / 2 + 0.3);
            chunk.onAnimate(() => officer.update(1 / 60, { talk: true }));
        }
    } else if (story === "abandoned") {
        put(car(paint, kind), s, side * 10.4, side * 0.05);
        col(s, side * 10.4, 1.6);
        const bush = put(cloneWithColors(models.bush), s + 4, side * 14.6, r() * 6);
        if (models.npcMan) {
            const guy = spawnPerson("npcMan", { colors: { Top: PAINTS[Math.floor(r() * PAINTS.length)] } });
            put(guy.obj, s + 4, side * 13.3, side > 0 ? -Math.PI / 2 : Math.PI / 2);
            chunk.onAnimate(t => guy.update(1 / 60, { talk: Math.sin(t) > 0.8 }));
        }
        bush.scale.setScalar(1.2);
    } else {
        const c = put(car(paint, kind), s, side * 10.4, side * 0.04);
        col(s, side * 10.4, 1.6);
        if (!HOOD) { HOOD = new THREE.BoxGeometry(1.5, 0.05, 1.1); HOOD.translate(0, 0, 0.55); }
        const hm = chunk.own(new THREE.MeshStandardMaterial({ color: paint, roughness: 0.4 }));
        const hood = new THREE.Mesh(HOOD, hm);
        hood.position.set(0, 0.98, 1.0);
        hood.rotation.x = -1.0;
        c.add(hood);
        const sp = road.point(s + 1.8, side * 10.4, {});
        chunk.onAnimate(() => { if (Math.random() < 0.1) smoke(sp.x, 1.3, sp.z, 1, [0.5, 0.5, 0.52]); });
        if (models.npcMan) {
            const guy = spawnPerson("npcMan", { colors: { Top: "#FFFFFF" } });
            put(guy.obj, s + 3.4, side * 9.2, side > 0 ? Math.PI * 0.85 : -Math.PI * 0.85);
            chunk.onAnimate(t => guy.update(1 / 60, { talk: true, point: Math.sin(t * 0.7) > 0.5 }));
        }
    }
}
