// The neighbourhood Dina runs home through: Lev Bais Yaakov school + the bus
// stop at the start, a long leafy sidewalk with picket fences and front lawns
// (houses on both sides, the street on her left), and HER house at the end of
// the road with the "HOME ♥" sign. One set, shared by the bus intro, the run
// and the porch ending; built lazily, disposed when Dina goes inside.
//
// Coordinates: Dina runs toward +Z along the sidewalk centre (x = 0). Screen-
// right while running is -X, so her lateral "u" (right = +) maps to x = -u.
import * as THREE from "three";
import { makeSet } from "../../core/sets.js";
import { ctx } from "../../core/ctx.js";
import { spawnPerson } from "../../core/people.js";
import { save3d } from "../../core/save.js";
import { models, prop, canvasTexture, rand, randPick, rnd, attach, Fx } from "./common.js";
import { instanced, cloneWithColors } from "../../models.js";

export const RUN_LEN = 180;          // 2D: 7200 px at Dina's own sprite scale (40 px per m)
export const HOME_Z = RUN_LEN + 11.6; // her house (the front gate is at RUN_LEN)
export const BUS_STOP_Z = -2;        // where the bus pulls up (its centre)

const HOUSE_COLS = [["#FFE0B2", "#C0504D"], ["#C8E6C9", "#5D7A8C"], ["#FFCCBC", "#6D4C41"], ["#E1BEE7", "#4E5B6E"],
    ["#FFF9C4", "#B5533C"], ["#B3E5FC", "#7B5537"], ["#F8BBD0", "#5D4037"], ["#DCEDC8", "#8D6E63"]];

let cached = null;
export function street() { return cached || (cached = buildStreet()); }
export function disposeStreet() { if (cached) { cached.dispose(); cached = null; } }

function buildStreet() {
    const set = makeSet({ light: "day", fog: [38, 150] });
    const own = (...a) => set.own(...a);
    const scene = set.scene;
    // sky: the 2D game's warm gradient
    const sky = own(canvasTexture(16, 256, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#7EC8F5"); g.addColorStop(0.55, "#CBEBFF"); g.addColorStop(1, "#FFE6C4");
        x.fillStyle = g; x.fillRect(0, 0, w, h);
    }));
    scene.background = sky;
    scene.fog.color.set("#F4E6D0");
    set.sun.intensity = 2.4;
    set.hemi.intensity = 1.25;
    Object.assign(set.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });

    const mat = (c, o = {}) => own(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o)));
    const box = (sx, sy, sz, m, x, y, z, shadow = false) => {
        const b = new THREE.Mesh(own(new THREE.BoxGeometry(sx, sy, sz)), m);
        b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow;
        scene.add(b); return b;
    };
    const Z0 = -70, Z1 = HOME_Z + 50, ZM = (Z0 + Z1) / 2, ZL = Z1 - Z0;

    // ── ground: mowed lawn stripes (2D #7CB342 / #9CCC65) ─────────────────
    const grassTex = own(canvasTexture(128, 128, (x, w, h) => {
        x.fillStyle = "#7CB342"; x.fillRect(0, 0, w, h);
        x.fillStyle = "#8BC34A"; x.fillRect(0, 0, w, h / 2);
        for (let i = 0; i < 260; i++) {
            x.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
            x.fillRect(Math.random() * w, Math.random() * h, 2, 3);
        }
    }));
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(30, ZL / 4);
    const ground = new THREE.Mesh(own(new THREE.PlaneGeometry(120, ZL)), mat("#ffffff", { map: grassTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, ZM);
    ground.receiveShadow = true;
    scene.add(ground);

    // ── the sidewalk (expansion joints every 2 m) ────────────────────────
    const walkTex = own(canvasTexture(128, 128, (x, w, h) => {
        x.fillStyle = "#D7D5C8"; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
        x.fillStyle = "#A9A79B"; x.fillRect(0, 0, w, 3);
        x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(0, 0, 3, h); x.fillRect(w - 3, 0, 3, h);
    }));
    walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping;
    const walkLen = RUN_LEN + 2 - Z0;
    walkTex.repeat.set(1, walkLen / 2);
    const walk = box(2.4, 0.08, walkLen, mat("#ffffff", { map: walkTex }), 0, 0.04, (Z0 + RUN_LEN + 2) / 2);
    walk.castShadow = false;
    // far-side sidewalk
    const walk2Tex = walkTex.clone(); own(walk2Tex); walk2Tex.repeat.set(1, (RUN_LEN - Z0) / 2); walk2Tex.needsUpdate = true;
    box(2.0, 0.08, RUN_LEN - Z0, mat("#ffffff", { map: walk2Tex }), 11.3, 0.04, (Z0 + RUN_LEN) / 2);

    // ── the street on her left, ending in a little turnaround ────────────
    const asphalt = mat("#6B7B8D", { roughness: 0.95 });
    const roadLen = RUN_LEN - 3 - Z0;
    box(7.0, 0.04, roadLen, asphalt, 6.8, 0.02, Z0 + roadLen / 2);
    const end = new THREE.Mesh(own(new THREE.CircleGeometry(3.5, 24, 0, Math.PI)), asphalt);
    end.rotation.x = -Math.PI / 2; end.rotation.z = Math.PI;
    end.position.set(6.8, 0.04, RUN_LEN - 3);
    end.receiveShadow = true; scene.add(end);
    const dash = mat("#F5F5DC", { roughness: 0.6 });
    const dashes = new THREE.InstancedMesh(own(new THREE.BoxGeometry(0.14, 0.02, 2.2)), dash, Math.ceil(roadLen / 5.5));
    for (let i = 0; i < dashes.count; i++) dashes.setMatrixAt(i, new THREE.Matrix4().makeTranslation(6.8, 0.05, Z0 + 2 + i * 5.5));
    dashes.receiveShadow = true;
    scene.add(dashes);
    const curb = mat("#BDBDBD", { roughness: 0.8 });
    box(0.25, 0.16, roadLen, curb, 3.18, 0.08, Z0 + roadLen / 2);
    box(0.25, 0.16, roadLen, curb, 10.42, 0.08, Z0 + roadLen / 2);
    // the yellow bus-stop curb (2D #FBC02D)
    box(0.27, 0.17, 18, mat("#FBC02D", { roughness: 0.7 }), 3.18, 0.085, BUS_STOP_Z + 2);

    // ── picket fences (one InstancedMesh for every picket) ───────────────
    const picketGeo = own(new THREE.BoxGeometry(0.1, 0.9, 0.04));
    picketGeo.translate(0, 0.45, 0);
    const picketMat = mat("#FFF8E8", { roughness: 0.7 });
    const pickets = [], rails = [];
    const fenceRun = (x, z0, z1) => {
        for (let z = z0; z < z1; z += 0.34) pickets.push([x, z]);
        rails.push([x, z0, z1]);
    };
    // near side (screen-right): yards with a gate gap at each house's front walk
    const nearHouses = [];
    for (let z = 10; z < RUN_LEN - 14; z += 15) nearHouses.push(z + rand(-1.5, 1.5));
    let zPrev = 4;
    for (const hz of nearHouses) { fenceRun(-3.7, zPrev, hz - 0.8); zPrev = hz + 0.8; }
    fenceRun(-3.7, zPrev, RUN_LEN - 0.5);
    fenceRun(-3.7, Z0, -16);     // before the school
    // far side, behind the far sidewalk
    const farHouses = [];
    for (let z = -50; z < RUN_LEN - 8; z += 14) farHouses.push(z + rand(-1.5, 1.5));
    zPrev = Z0;
    for (const hz of farHouses) { fenceRun(12.75, zPrev, hz - 0.8); zPrev = hz + 0.8; }
    const pm = new THREE.InstancedMesh(picketGeo, picketMat, pickets.length);
    const m4 = new THREE.Matrix4();
    pickets.forEach(([x, z], i) => pm.setMatrixAt(i, m4.makeTranslation(x, 0, z)));
    pm.castShadow = true; pm.receiveShadow = true;
    scene.add(pm);
    const railGeo = own(new THREE.BoxGeometry(0.05, 0.07, 1));
    const rm = new THREE.InstancedMesh(railGeo, picketMat, rails.length * 2);
    let ri = 0;
    for (const [x, z0, z1] of rails) for (const y of [0.3, 0.68]) {
        rm.setMatrixAt(ri++, m4.compose(new THREE.Vector3(x + 0.04 * Math.sign(-x), y, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(1, 1, Math.max(0.1, z1 - z0))));
    }
    rm.castShadow = true;
    scene.add(rm);

    // ── houses (instanced core house, tinted walls + roofs) ──────────────
    const homes = [];
    for (const z of nearHouses) homes.push({ x: -12.5, z, ry: Math.PI / 2 });
    for (const z of farHouses) homes.push({ x: 20, z, ry: -Math.PI / 2 });
    const H = instanced(models.house, homes.length, ["Walls", "Roof"]);
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    homes.forEach((h, i) => {
        H.set(i, m4.compose(new THREE.Vector3(h.x, 0, h.z), q.setFromAxisAngle(up, h.ry), one));
        const c = HOUSE_COLS[i % HOUSE_COLS.length];
        H.color(i, "Walls", new THREE.Color(c[0]));
        H.color(i, "Roof", new THREE.Color(c[1]));
    });
    H.finish();
    scene.add(H.group);
    // front walks from each near house to its gate
    const pathMat = mat("#D7CCC8");
    const paths = new THREE.InstancedMesh(own(new THREE.BoxGeometry(5.0, 0.03, 1.3)), pathMat, nearHouses.length);
    nearHouses.forEach((z, i) => paths.setMatrixAt(i, m4.makeTranslation(-6.2, 0.015, z)));
    paths.receiveShadow = true;
    scene.add(paths);

    // ── trees + bushes + flowers along the verges ────────────────────────
    const trees = [];
    let side = 0;
    for (let z = -40; z < RUN_LEN - 6; z += 12) {
        const atStop = z > -26 && z < 16;    // keep the bus stop + schoolyard open
        if (!atStop) trees.push([side % 2 ? 2.75 : -3.15, z + rand(-1, 1), rand(0.68, 0.82)]);
        side++;
        if (!atStop && rnd() < 0.5) trees.push([rand(-9, -7), z + 6, rand(0.8, 1.05)]);     // in the front yards
        trees.push([rand(14, 16), z + 3, rand(0.8, 1.1)]);
    }
    const T = instanced(models.treeRound, trees.length, ["Leaves"]);
    trees.forEach(([x, z, s], i) => {
        T.set(i, m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, i * 1.7), new THREE.Vector3(s, s, s)));
        T.color(i, "Leaves", new THREE.Color().setHSL(0.27 + (i % 5) * 0.015, 0.55, 0.42 + (i % 3) * 0.05));
    });
    T.finish(); scene.add(T.group);
    const bushes = [];
    for (let z = -30; z < RUN_LEN - 4; z += 5.5) {
        if (rnd() < 0.55) bushes.push([-4.5 - rand(0, 0.6), z + rand(-1, 1), rand(0.5, 0.8)]);
        if (rnd() < 0.4) bushes.push([13.5 + rand(0, 0.6), z + rand(-1, 1), rand(0.5, 0.8)]);
    }
    const B = instanced(models.bush, bushes.length, ["Leaves"]);
    bushes.forEach(([x, z, s], i) => {
        B.set(i, m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, i), new THREE.Vector3(s, s, s)));
        B.color(i, "Leaves", new THREE.Color().setHSL(0.3, 0.5, 0.36 + (i % 4) * 0.04));
    });
    B.finish(); scene.add(B.group);
    const flowers = [];
    for (let z = -20; z < RUN_LEN; z += 0.9) {
        if (rnd() < 0.6) flowers.push([-3.95 - rand(0, 0.4), z + rand(-0.3, 0.3)]);
        if (rnd() < 0.18) flowers.push([rand(-2.9, -1.6), z]);
        if (rnd() < 0.15) flowers.push([rand(1.6, 2.6), z]);
    }
    const fm = new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(0.09, 0)), mat("#ffffff", { roughness: 0.6 }), flowers.length);
    const FC = ["#FFD54F", "#FF6F91", "#BA68C8", "#FF8A65", "#FFFFFF", "#4FC3F7"].map(c => new THREE.Color(c));
    flowers.forEach(([x, z], i) => { fm.setMatrixAt(i, m4.makeTranslation(x, 0.12 + (i % 3) * 0.03, z)); fm.setColorAt(i, FC[i % FC.length]); });
    scene.add(fm);

    // ── parked cars on the far side ──────────────────────────────────────
    const CARS = ["#42A5F5", "#EF5350", "#66BB6A", "#FFCA28", "#AB47BC", "#26C6DA", "#ECEFF1"];
    for (const [z, kind] of [[24, "sedan"], [47, "van"], [78, "sedan"], [104, "sedan"], [131, "van"], [160, "sedan"]]) {
        const c = cloneWithColors(models[kind], { Paint: randPick(CARS) });
        c.position.set(9.0, 0, z);
        c.rotation.y = Math.PI;
        scene.add(c);
    }
    // street lamps on the left verge
    const poleMat = mat("#5D6770", { roughness: 0.5, metalness: 0.4 });
    const lampMat = own(new THREE.MeshStandardMaterial({ color: "#FFF8E1", emissive: "#FFE9A8", emissiveIntensity: 0.4 }));
    for (let z = 20; z < RUN_LEN - 10; z += 36) {
        const pole = new THREE.Mesh(own(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8)), poleMat);
        pole.position.set(2.85, 2.1, z); pole.castShadow = true; scene.add(pole);
        const arm = new THREE.Mesh(own(new THREE.BoxGeometry(0.9, 0.06, 0.06)), poleMat);
        arm.position.set(2.45, 4.15, z); scene.add(arm);
        const lamp = new THREE.Mesh(own(new THREE.SphereGeometry(0.18, 12, 8)), lampMat);
        lamp.position.set(2.0, 4.05, z); scene.add(lamp);
    }

    // ── the school + the bus stop sign ───────────────────────────────────
    const school = cloneWithColors(models.dinaSchool);
    school.position.set(-14.5, 0, -6);
    school.rotation.y = Math.PI / 2;
    scene.add(school);
    box(5.2, 0.03, 2.2, pathMat, -6.6, 0.015, -6);
    const signTex = own(canvasTexture(256, 320, (x, w, h) => {
        x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, w, h);
        x.fillStyle = "#FBC02D"; x.fillRect(10, 10, w - 20, h - 20);
        x.fillStyle = "#1A1A1A"; x.textAlign = "center";
        x.font = "700 54px Fredoka, Arial"; x.fillText("SCHOOL", w / 2, 92); x.fillText("BUS", w / 2, 156); x.fillText("STOP", w / 2, 220);
        x.font = "64px Arial"; x.fillText("🚌", w / 2, 296);
    }));
    const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(0.62, 0.78)), mat("#ffffff", { map: signTex, roughness: 0.6, side: THREE.DoubleSide }));
    sign.position.set(2.55, 2.1, -9.5); sign.rotation.y = -Math.PI / 2;
    scene.add(sign);
    const signPole = new THREE.Mesh(own(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8)), poleMat);
    signPole.position.set(2.58, 1.25, -9.5); signPole.castShadow = true; scene.add(signPole);

    // ── Dina's house at the end of the street ────────────────────────────
    const home = cloneWithColors(models.dinaHouse);
    home.position.set(0, 0, HOME_Z);
    home.rotation.y = Math.PI;
    scene.add(home);
    // her yard's side fences (the front fence + gate is part of the model)
    fenceSide(-4.6); fenceSide(4.6);
    function fenceSide(x) {
        const run = new THREE.InstancedMesh(picketGeo, picketMat, 30);
        for (let i = 0; i < 30; i++) run.setMatrixAt(i, m4.makeTranslation(x, 0, RUN_LEN + 0.3 + i * 0.34));
        run.castShadow = true; scene.add(run);
    }
    const porchLight = new THREE.PointLight("#FFD58A", 6, 9, 1.6);
    porchLight.position.set(0, 2.6, HOME_Z - 5.6);
    scene.add(porchLight);

    return {
        set, scene, home, dina: null, mom: null, fx: null, cam: null,
        dispose() { if (this.fx) this.fx.dispose(); H.dispose(); T.dispose(); B.dispose(); set.dispose(); },
        /** Keep the sun's shadow box centred on the action. */
        sunFollow(x, z) {
            set.sun.position.set(x - 14, 26, z - 10);
            set.sun.target.position.set(x, 0, z + 4);
        },
    };
}

// ── the cast + a camera rig for the street scenes ────────────────────────
/** Dina (with her backpack) and Mom (with her handbag), created once per street. */
export function cast() {
    const st = street();
    if (!st.dina) {
        st.dina = spawnPerson("dinaPerson");
        attach(st.dina, "Body", prop("dinaProps", "Backpack"), 0, 0.78, -0.17);
        st.scene.add(st.dina.obj);
        st.mom = spawnPerson("imaPerson");
        const bag = prop("dinaProps", "Handbag");
        attach(st.mom, "Arm_L", bag, 0.02, -0.5, 0.03);
        st.mom.obj.visible = false;
        st.scene.add(st.mom.obj);
        st.fx = new Fx(st.scene, 500);
        st.cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), snap: true, shake: 0 };
    }
    return st;
}
/** Ease the street camera toward a shot. */
export function camTo(pos, look, dt, rate = 3, fov = 55) {
    const st = street(), c = st.cam, camera = st.set.camera;
    if (c.snap) { c.pos.copy(pos); c.look.copy(look); c.snap = false; }
    c.pos.lerp(pos, Math.min(1, dt * rate));
    c.look.lerp(look, Math.min(1, dt * rate * 1.4));
    camera.position.copy(c.pos);
    if (c.shake > 0 && !save3d.settings.calm) {
        const k = c.shake * 0.5;
        camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k;
    }
    c.shake = Math.max(0, c.shake - dt);
    camera.lookAt(c.look);
    const portrait = camera.aspect < 1;
    const f = fov + (portrait ? 16 : 0);
    camera.fov += (f - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
}
