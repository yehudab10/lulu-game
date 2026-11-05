// Dina's bedroom as a cozy 3D dollhouse room (2D: drawDinaHome): cream
// wallpaper with pink polka dots, honey-wood floor, the window with mint
// curtains + a sunbeam, the BE BRAVE fox poster, her crayon drawing of Mom and
// her holding hands, glow-in-the-dark stars, the pink-quilted bed with a teddy,
// nightstand + lamp, toy chest, the rug, Morgan on the floor, cookie & milk on
// the side table, the tablet with a live mini Lulu game, the sticker book and
// the door with the "DINA'S ROOM" sign. The nap and sticker-book scenes reuse it.
import * as THREE from "three";
import { makeSet } from "../../core/sets.js";
import { prop, node, ownMaterials, canvasTexture, models } from "./common.js";
import { cloneWithColors } from "../../models.js";

export const ROOM = { w: 10, d: 8, h: 3.4 };
// where things stand (x, z) — matching the 2D layout: bed top-right, the row of
// toys along the front, the door on the left wall
export const SPOTS = {
    bed: { x: 3.6, z: -2.75 }, nightstand: { x: 2.3, z: -3.55 }, toyChest: { x: -3.85, z: -3.45 },
    window: { x: -1.5, y: 1.9 }, poster: { x: 0.85, y: 2.0 }, drawing: { x: -3.7, y: 1.75 },
    door: { x: -4.9, z: -1.4 }, rug: { x: 0, z: 1.1 }, morgan: { x: -3.9, z: 1.5 },
    snacks: { x: -2.15, z: 0.9 }, tablet: { x: 0.15, z: 0.75 }, sticker: { x: 2.2, z: 1.05 },
};

let cached = null;
export function room() { return cached || (cached = buildRoom()); }
export function disposeRoom() { if (cached) { cached.dispose(); cached = null; } }

function buildRoom() {
    const set = makeSet({ light: "indoor", sky: "#F6E7D0" });
    const own = (...a) => set.own(...a);
    const scene = set.scene;
    set.sun.position.set(-6, 9, 6);
    Object.assign(set.sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
    set.sun.intensity = 1.5;
    set.hemi.intensity = 1.55;
    const { w, d, h } = ROOM;
    const mat = (o) => own(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, o)));

    // ── wallpaper + floor (canvas textures) ──────────────────────────────
    const wallTex = own(canvasTexture(256, 256, (x, W, H) => {
        x.fillStyle = "#FFE8C8"; x.fillRect(0, 0, W, H);
        x.fillStyle = "rgba(255,170,195,0.55)";
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
            x.beginPath(); x.arc(col * 64 + (row % 2 ? 48 : 16), row * 64 + 32, 7, 0, Math.PI * 2); x.fill();
        }
    }));
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    const floorTex = own(canvasTexture(256, 256, (x, W, H) => {
        x.fillStyle = "#E8B872"; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 8; i++) {
            x.fillStyle = i % 2 ? "#E2B06A" : "#ECBE7A"; x.fillRect(0, i * 32, W, 32);
            x.fillStyle = "#C99A50"; x.fillRect(0, i * 32, W, 2);
            x.fillRect((i * 97) % W, i * 32, 2, 32);
        }
        for (let k = 0; k < 120; k++) { x.fillStyle = "rgba(160,110,60,0.12)"; x.fillRect(Math.random() * W, Math.random() * H, 18, 1); }
    }));
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(w / 2.5, d / 2.5);
    const wallMat = mat({ map: wallTex, roughness: 0.95 });
    const floorMat = mat({ map: floorTex, roughness: 0.7 });
    const plane = (pw, ph, m, x, y, z, ry = 0, rx = 0) => {
        const p = new THREE.Mesh(own(new THREE.PlaneGeometry(pw, ph)), m);
        p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true;
        scene.add(p); return p;
    };
    plane(w, d + 2, floorMat, 0, 0, 1, 0, -Math.PI / 2);
    const back = plane(w, h, wallMat, 0, h / 2, -d / 2);
    const tBack = wallTex.clone(); own(tBack); tBack.repeat.set(w / 1.6, h / 1.6); tBack.needsUpdate = true;
    back.material = mat({ map: tBack, roughness: 0.95 });
    const tSide = wallTex.clone(); own(tSide); tSide.repeat.set(d / 1.6, h / 1.6); tSide.needsUpdate = true;
    const sideMat = mat({ map: tSide, roughness: 0.95 });
    plane(d, h, sideMat, -w / 2, h / 2, 0, Math.PI / 2);
    plane(d, h, sideMat, w / 2, h / 2, 0, -Math.PI / 2);
    const walls = [back.material, sideMat];
    // baseboards + a top trim
    const trim = mat({ color: "#FFFFFF", roughness: 0.6 });
    const bb = (sx, sz, x, z) => { const b = new THREE.Mesh(own(new THREE.BoxGeometry(sx, 0.16, sz)), trim); b.position.set(x, 0.08, z); scene.add(b); };
    bb(w, 0.05, 0, -d / 2 + 0.025); bb(0.05, d, -w / 2 + 0.025, 0); bb(0.05, d, w / 2 - 0.025, 0);
    const top = new THREE.Mesh(own(new THREE.BoxGeometry(w, 0.12, 0.08)), trim); top.position.set(0, h - 0.06, -d / 2 + 0.04); scene.add(top);

    // ── furniture from the Blender room kit ──────────────────────────────
    const put = (name, x, z, ry = 0, y = 0) => { const o = prop("dinaRoom", name); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
    const bed = put("Bed", SPOTS.bed.x, SPOTS.bed.z);
    const quilt = node(bed, "Quilt");
    const nightstand = put("Nightstand", SPOTS.nightstand.x, SPOTS.nightstand.z);
    const lampMats = ownMaterials(nightstand, ["LampShade"]);
    put("ToyChest", SPOTS.toyChest.x, SPOTS.toyChest.z, 0.15);
    const win = put("Window", SPOTS.window.x, -d / 2 + 0.06, 0, SPOTS.window.y);
    const door = put("RoomDoor", SPOTS.door.x, SPOTS.door.z, Math.PI / 2);
    const doorLeaf = node(door, "DoorLeaf");
    put("Rug", SPOTS.rug.x, SPOTS.rug.z);
    put("SideTable", SPOTS.snacks.x, SPOTS.snacks.z, 0.3);
    // the tablet sits on a little pink pouf
    const pouf = new THREE.Mesh(own(new THREE.CylinderGeometry(0.36, 0.4, 0.34, 20)), mat({ color: "#F48FB1", roughness: 0.95 }));
    pouf.position.set(SPOTS.tablet.x, 0.17, SPOTS.tablet.z); pouf.castShadow = true; pouf.receiveShadow = true; scene.add(pouf);
    const tablet = put("Tablet", SPOTS.tablet.x, SPOTS.tablet.z, 0, 0.34);
    const screenMesh = node(tablet, "TabletScreen");
    const sticker = put("StickerBook", SPOTS.sticker.x, SPOTS.sticker.z, -0.25);
    const morgan = cloneWithColors(models.dinaMorgan);
    morgan.scale.setScalar(0.78);
    morgan.position.set(SPOTS.morgan.x, 0, SPOTS.morgan.z);
    morgan.rotation.y = 0.55;
    scene.add(morgan);
    const eyesHappy = node(morgan, "EyesHappy"); if (eyesHappy) eyesHappy.visible = false;

    // ── the tablet's screen: a live mini Lulu game ───────────────────────
    const tabCanvas = document.createElement("canvas"); tabCanvas.width = 160; tabCanvas.height = 110;
    const tabTex = own(new THREE.CanvasTexture(tabCanvas)); tabTex.colorSpace = THREE.SRGBColorSpace;
    // (the Blender screen has no UVs — lay a textured plane over it, same tilt)
    if (screenMesh) screenMesh.visible = false;
    const scr = new THREE.Mesh(own(new THREE.PlaneGeometry(0.43, 0.29)), own(new THREE.MeshBasicMaterial({ map: tabTex })));
    scr.position.set(0, 0.256, -0.037);
    scr.rotation.x = -0.35;
    tablet.add(scr);
    let tabT = 0;
    function drawTablet(dt) {
        tabT += dt;
        const x = tabCanvas.getContext("2d");
        x.fillStyle = "#7CCB7E"; x.fillRect(0, 0, 160, 110);
        x.fillStyle = "#6B7B8D"; x.fillRect(52, 0, 56, 110);
        x.fillStyle = "#F5F5DC";
        for (let k = -1; k < 6; k++) x.fillRect(78, ((k * 24 + tabT * 60) % 130) - 10, 4, 12);
        x.fillStyle = "#E91E63"; x.fillRect(70 + Math.sin(tabT * 1.4) * 14, 76, 18, 26);
        x.fillStyle = "#81D4FA"; x.fillRect(73 + Math.sin(tabT * 1.4) * 14, 80, 12, 7);
        x.fillStyle = "#FFD700"; x.font = "700 15px Fredoka, Arial"; x.textAlign = "center"; x.fillText("LULU", 80, 18);
        tabTex.needsUpdate = true;
    }
    drawTablet(0);

    // ── the window view (day ⇄ night) + sunbeam ──────────────────────────
    const day = own(canvasTexture(256, 288, (x, W, H) => {
        const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#8FD0F2"); g.addColorStop(1, "#D8F0FF");
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = "#FFD54F"; x.beginPath(); x.arc(70, 70, 30, 0, Math.PI * 2); x.fill();
        x.fillStyle = "rgba(255,255,255,0.9)";
        for (const [cx, cy] of [[170, 60], [200, 120]]) { x.beginPath(); x.ellipse(cx, cy, 34, 14, 0, 0, Math.PI * 2); x.ellipse(cx + 22, cy + 4, 22, 11, 0, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = "#9CCC65"; x.beginPath(); x.ellipse(110, H + 20, 190, 70, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#7CB342"; x.beginPath(); x.ellipse(230, H + 30, 120, 60, 0, 0, Math.PI * 2); x.fill();
    }));
    const night = own(canvasTexture(256, 288, (x, W, H) => {
        const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#10164A"); g.addColorStop(1, "#3C3C72");
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = "#FFF8E1";
        for (let i = 0; i < 26; i++) { x.beginPath(); x.arc((i * 53 + 17) % (W - 8) + 4, (i * 37 + 11) % (H - 70) + 6, i % 3 ? 1.6 : 2.6, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = "#FFF3C4"; x.beginPath(); x.arc(W * 0.72, H * 0.28, 26, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#1E2058"; x.beginPath(); x.arc(W * 0.64, H * 0.24, 24, 0, Math.PI * 2); x.fill();   // crescent cut
        x.fillStyle = "#23204E"; x.beginPath(); x.ellipse(W / 2, H + 10, W * 0.8, 70, 0, 0, Math.PI * 2); x.fill();
    }));
    const viewDay = plane(1.36, 1.56, own(new THREE.MeshBasicMaterial({ map: day })), SPOTS.window.x, SPOTS.window.y, -d / 2 + 0.02);
    const viewNight = plane(1.36, 1.56, own(new THREE.MeshBasicMaterial({ map: night, transparent: true, opacity: 0 })), SPOTS.window.x, SPOTS.window.y, -d / 2 + 0.03);
    const beamMat = own(new THREE.MeshBasicMaterial({ color: "#FFE99A", transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const beamGeo = own(new THREE.BufferGeometry());
    const wx = SPOTS.window.x, wy = SPOTS.window.y, wz = -d / 2 + 0.05;
    beamGeo.setAttribute("position", new THREE.Float32BufferAttribute([
        wx - 0.68, wy + 0.78, wz, wx + 0.68, wy + 0.78, wz, wx + 1.4, 0.02, wz + 3.0,
        wx - 0.68, wy + 0.78, wz, wx + 1.4, 0.02, wz + 3.0, wx - 0.2, 0.02, wz + 3.4,
    ], 3));
    const beam = new THREE.Mesh(beamGeo, beamMat);
    scene.add(beam);
    const pool = new THREE.Mesh(own(new THREE.PlaneGeometry(1.7, 1.2)), own(new THREE.MeshBasicMaterial({ color: "#FFF2B8", transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })));
    pool.rotation.x = -Math.PI / 2; pool.rotation.z = 0.3; pool.position.set(wx + 0.6, 0.012, wz + 3.1); scene.add(pool);

    // ── wall art: BE BRAVE fox poster + the crayon drawing ───────────────
    const poster = own(canvasTexture(256, 320, (x, W, H) => {
        x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
        x.strokeStyle = "#5D4037"; x.lineWidth = 10; x.strokeRect(5, 5, W - 10, H - 10);
        x.fillStyle = "#FF7043"; x.beginPath(); x.arc(128, 140, 66, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.moveTo(70, 100); x.lineTo(92, 40); x.lineTo(118, 92); x.fill();
        x.beginPath(); x.moveTo(186, 100); x.lineTo(164, 40); x.lineTo(138, 92); x.fill();
        x.fillStyle = "#FFFFFF"; x.beginPath(); x.ellipse(128, 172, 40, 26, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#2B1B1B"; x.beginPath(); x.arc(104, 130, 7, 0, Math.PI * 2); x.arc(152, 130, 7, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.arc(128, 160, 8, 0, Math.PI * 2); x.fill();
        x.fillStyle = "#5D4037"; x.font = "700 40px Fredoka, Arial"; x.textAlign = "center"; x.fillText("BE BRAVE", 128, 278);
    }));
    plane(0.8, 1.0, mat({ map: poster, roughness: 0.8 }), SPOTS.poster.x, SPOTS.poster.y, -d / 2 + 0.015);
    const drawing = own(canvasTexture(256, 256, (x, W, H) => {
        x.fillStyle = "#FFF59D"; x.fillRect(0, 0, W, H);
        x.strokeStyle = "#5D4037"; x.lineWidth = 5; x.strokeRect(3, 3, W - 6, H - 6);
        x.lineCap = "round"; x.lineWidth = 7;
        // Mom (red) and Dina (blue) holding hands, with a heart
        x.strokeStyle = "#F44336";
        x.beginPath(); x.arc(80, 80, 18, 0, Math.PI * 2); x.moveTo(80, 98); x.lineTo(80, 165); x.moveTo(58, 125); x.lineTo(128, 132);
        x.moveTo(80, 165); x.lineTo(62, 215); x.moveTo(80, 165); x.lineTo(98, 215); x.stroke();
        x.strokeStyle = "#3F51B5";
        x.beginPath(); x.arc(170, 108, 15, 0, Math.PI * 2); x.moveTo(170, 123); x.lineTo(170, 175); x.moveTo(128, 140); x.lineTo(190, 140);
        x.moveTo(170, 175); x.lineTo(155, 215); x.moveTo(170, 175); x.lineTo(185, 215); x.stroke();
        x.fillStyle = "#F44336"; x.font = "700 48px Arial"; x.textAlign = "center"; x.fillText("♥", 126, 70);
    }));
    plane(0.62, 0.62, mat({ map: drawing, roughness: 0.9 }), SPOTS.drawing.x, SPOTS.drawing.y, -d / 2 + 0.015, 0).rotation.z = 0.05;
    const tape = new THREE.Mesh(own(new THREE.PlaneGeometry(0.3, 0.07)), mat({ color: "#FFC896", transparent: true, opacity: 0.75 }));
    tape.position.set(SPOTS.drawing.x, SPOTS.drawing.y + 0.31, -d / 2 + 0.02); scene.add(tape);

    // ── glow-in-the-dark stars high on the walls ─────────────────────────
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.05 : 0.12;
        if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = own(new THREE.ShapeGeometry(starShape));
    const stars = [];
    for (const [x, y, z, ry] of [[-4.2, 3.05, -3.98, 0], [-0.4, 3.15, -3.98, 0], [2.9, 3.0, -3.98, 0], [-4.98, 2.95, 1.2, Math.PI / 2], [4.98, 3.05, 0.4, -Math.PI / 2], [4.98, 2.7, -1.8, -Math.PI / 2]]) {
        const m = own(new THREE.MeshStandardMaterial({ color: "#FFEE58", emissive: "#FFEE58", emissiveIntensity: 0.6, roughness: 0.6 }));
        const s = new THREE.Mesh(starGeo, m); s.position.set(x, y, z); s.rotation.y = ry; scene.add(s);
        stars.push(m);
    }

    // night lighting bits (used by the nap)
    const lampLight = new THREE.PointLight("#FFD27A", 0, 6, 1.5);
    lampLight.position.set(SPOTS.nightstand.x + 0.05, 1.05, SPOTS.nightstand.z + 0.1);
    scene.add(lampLight);
    const moon = new THREE.SpotLight("#C9D6FF", 0, 14, 0.55, 0.6, 1.2);
    moon.position.set(wx, wy + 0.4, -d / 2 + 0.3);
    moon.target.position.set(SPOTS.bed.x - 0.2, 0.7, SPOTS.bed.z + 0.4);
    scene.add(moon, moon.target);

    const R0 = { hemi: set.hemi.intensity, sun: set.sun.intensity };
    const nightCol = new THREE.Color("#4A4F8F"), white = new THREE.Color("#FFFFFF");
    return {
        set, scene, bed, quilt, doorLeaf, morgan, sticker, tablet, stars, lampLight,
        dispose() { set.dispose(); },
        tick(dt, t) {
            drawTablet(dt);
            stars.forEach((m, i) => { m.emissiveIntensity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 + i)); });
        },
        /** 0 = sunny afternoon … 1 = bedtime (lamp dim, moonlight, night sky, stars bright). */
        night(k) {
            set.hemi.intensity = R0.hemi * (1 - k * 0.72);
            set.sun.intensity = R0.sun * (1 - k * 0.92);
            for (const m of walls) m.color.copy(white).lerp(nightCol, k * 0.75);
            floorMat.color.copy(white).lerp(nightCol, k * 0.6);
            viewNight.material.opacity = k;
            beamMat.opacity = 0.12 * (1 - k) + 0.08 * k;
            beamMat.color.set(k > 0.5 ? "#C9D6FF" : "#FFE99A");
            pool.material.opacity = 0.25 * (1 - k * 0.5);
            if (lampMats.LampShade) lampMats.LampShade.emissiveIntensity = 1.6 * ((1 - k) * 0.9 + 0.1);
            lampLight.intensity = 2.2 * ((1 - k) * 0.9 + 0.1) * (k > 0 ? 1 : 0);
            moon.intensity = 18 * k;
            for (const m of stars) m.emissiveIntensity = 0.6 + k * 1.4;
            set.scene.background.set(k > 0.5 ? "#151838" : "#F6E7D0");
        },
    };
}
