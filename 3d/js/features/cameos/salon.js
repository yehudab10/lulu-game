// features/cameos — THE SALON, "Chez Fabio". Pick a style (sheitel / big &
// bouncy / the 'Avigail') and a colour, with a live preview on Lulu in the
// chair and in a real mirror; Fabio works his magic; the look is saved to the
// SHARED 2D save (luluHair / luluHairStyle) and shows on Lulu in the car
// (car.addHairStyle) and on foot (luluPerson_<style> models).
// Entered from the road (pull into the pink lot and stop) or on foot through
// ctx.interiors.salon (the foot feature shows the door).
import { ctx, on, emit, registerState, setState, addActor, rand, css } from "../../core/ctx.js";
import { registerModels, ensureModels } from "../../models.js";
import { makeSet, makeRoom, textPlane } from "../../core/sets.js";
import { say, closeDialog } from "../../core/dialog.js";
import { spawnPerson } from "../../core/people.js";
import { ribbon, signTexture, facingRoad, worldMaterials, SHOULDER } from "../../world.js";
import { Particles } from "../../car.js";
import { glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import {
    THREE, models, cloneWithColors, findNodes, shared, loadModels, clamp, ease, wait, stat, caption, clearCaptions, chips,
    fade, sfx, SetCam, prop, inHand, onBody, findSpot, sidePanel, luluHair,
} from "./common.js";
import { resumeDriving } from "./resume.js";

registerModels({
    cameos_hairBouncy: "cameos_hair_bouncy", cameos_hairAvigail: "cameos_hair_avigail",
    luluPerson_bouncy: "cameos_lulu_bouncy", luluPerson_avigail: "cameos_lulu_avigail",
    cameos_fabio: "cameos_fabio", cameos_salonProps: "cameos_salon_props", cameos_salonFront: "cameos_salon_front",
});

// ── the 2D salon menu (src/03-art-parking-hud.js) ────────────────────────
export const SALON_COLORS = [
    { label: "PLATINUM", hex: "#F5E6C8", blonde: true, fabio: "PLATINUM?! Like zee DIAMOND of zee HEAD!" },
    { label: "GOLDEN", hex: "#E6B800", blonde: true, fabio: "GOLD! Zee Maccabees would WEEP. In a GOOD way!" },
    { label: "BRUNETTE", hex: "#6B4423", blonde: false, fabio: "Brunette… bold. Brave. Basically a SHEITEL, no?" },
    { label: "JET BLACK", hex: "#1A1A1A", blonde: false, fabio: "So DARK. So MYSTERIOUS. So… Tisha B'Av, non?" },
    { label: "PINK", hex: "#FF6FB5", blonde: false, fabio: "PINK! Zee Bubbe will plotz. Maybe FAINT. Worth it!" },
    { label: "BLUE", hex: "#5B8DEF", blonde: false, fabio: "BLUE?! Zis is not zee mikveh, mon chou!" },
];
const SALON_OUTCOMES = {
    "PLATINUM": "I'm BLONDE! I'm basically a whole new person now!",
    "GOLDEN": "GOLD?! Fabio, I could KISS you. I won't. But I COULD.",
    "BRUNETTE": "Rich, glossy brunette. I look EXPENSIVE. I love it.",
    "JET BLACK": "Sleek. Mysterious. Main-character energy. STUNNING.",
    "PINK": "PINK?! I'm a cotton-candy QUEEN and I OWN it!",
    "BLUE": "Ocean blue! Bold, cool, and TOTALLY my vibe. YES.",
};
const SALON_CONSULT = [
    "Sit, sit! Tell Fabio… what is zee VIBE today?",
    "Mm-hm. MM-hm. I see GREAT trauma in zis hair.",
    "Zis hair has not seen Shabbos in WEEKS, non?",
    "Do not worry. Fabio fixes EVERYTHING. Even your AURA.",
];
export const SALON_STYLES = [
    { label: "ZEE SHEITEL", style: "sheitel", icon: "💁‍♀️", fabio: "Classic. Timeless. Your Bubbe sheds a TEAR." },
    { label: "BIG & BOUNCY", style: "bouncy", icon: "🎀", fabio: "VOLUME! We will need a LARGER doorway!" },
    { label: "THE 'AVIGAIL'", style: "avigail", icon: "🌀", fabio: "Curls to zee HEAVENS! Zee neighbors will TALK." },
];
const SALON_PROCESS_BEATS = [
    "Mixing zee potion…", "I add a PINCH of CHUTZPAH…", "Patience is beauty, mon chou…",
    "Zee foils! Zey SING to me!", "Almost… ALMOST… do not BLINK…",
];
const SALON_OOPS = {
    fabio: "…OKAY zee cat knocked zee bottle. But I MEANT zat!",
    lulu: "MY HAIR. WHAT did you DO. ...okay it's kind of GREAT.",
};
const FABIO = { emoji: "💇‍♂️", color: "#00897B" };
const LULU = { emoji: "💁‍♀️", color: "#E91E63" };

// ── Lulu's hairstyles on the car (and the on-foot models) ────────────────
const CAR_HAIR = { bouncy: "cameos_hairBouncy", avigail: "cameos_hairAvigail" };
const added = new Set();
/** Load + add the salon hairstyles to Lulu-in-the-car (car.addHairStyle). */
export async function ensureHairStyles(styles = Object.keys(CAR_HAIR)) {
    const want = styles.filter(s => CAR_HAIR[s] && !added.has(s));
    if (!want.length) return true;
    if (!await loadModels(want.map(s => CAR_HAIR[s]))) return false;
    for (const s of want) {
        if (added.has(s) || !models[CAR_HAIR[s]]) continue;
        added.add(s);
        ctx.car.addHairStyle(s, models[CAR_HAIR[s]].clone(true));
    }
    return true;
}
/** Apply a look to every Lulu (car now; on-foot model loaded for the foot feature). */
export async function applyHair(color, style) {
    if (style && style !== "sheitel") {
        await ensureHairStyles([style]);
        ensureModels(["luluPerson_" + style]).catch(() => {});
    }
    ctx.car.setHair(color, style);
}
on("boot", () => {
    const h = luluHair();
    if (h.style !== "sheitel") applyHair(h.color, h.style);
});
// the 2D game (or another tab) changed the look → follow it
on("shared:changed", s => {
    const st = s.luluHairStyle || "sheitel";
    if (s.luluHair && (s.luluHair !== ctx.car.hairColor || st !== ctx.car.hairStyle)) applyHair(s.luluHair, st);
});

// ── the roadside storefront: pull into the pink lot and stop ─────────────
let shop = null;
export function salonShopOut() { return !!shop; }
export async function spawnSalonShop(opts = {}) {
    if (shop && !opts.force) return null;
    if (!await loadModels(["cameos_salonFront"])) return null;
    const car = ctx.car, road = ctx.world.road;
    const spot = opts.spot || findSpot(car.s + (opts.ahead || 330), car.s + (opts.ahead || 330) + 140, 1, 21.5, 23, 8.5);
    if (!spot) return null;
    const S = spot.s, D = spot.d;
    const root = new THREE.Group();
    const b = cloneWithColors(models.cameos_salonFront);
    const p = road.point(S, D, {});
    b.position.set(p.x, 0, p.z);
    b.rotation.y = facingRoad(p.h, 1);
    root.add(b);
    const pole = findNodes(b, "Pole")[0];
    // the lot: pink-trimmed paving from the shoulder to the shop door
    const M = worldMaterials();
    const lotGeo = ribbon(road, S - 7.5, S + 7.5, SHOULDER - 0.1, D - 4.2, 0.03, 10);
    const lot = new THREE.Mesh(lotGeo, M.drive);
    lot.receiveShadow = true;
    root.add(lot);
    const stripeMat = new THREE.MeshStandardMaterial({ color: "#F48FB1", roughness: 0.7 });
    const stripes = [];
    for (const off of [-7.4, 7.4]) { const g = ribbon(road, S + off - 0.12, S + off + 0.12, SHOULDER, D - 4.2, 0.04, 10); stripes.push(g); root.add(new THREE.Mesh(g, stripeMat)); }
    // a sign by the road 120 m before, like the 2D "SALON" signs
    const sign = new THREE.Group();
    const sp = road.point(S - 120, 10.8, {});
    sign.position.set(sp.x, 0, sp.z);
    sign.rotation.y = road.at(S - 120).h + Math.PI;
    const tex = signTexture(["💇 CHEZ FABIO", "PULL IN →"], "#AD1457", "#ffffff", 512, 256);
    const boardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.1), [M.metal, M.metal, M.metal, M.metal, boardMat, M.metal]);
    board.position.y = 3.4;
    board.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.3, 8), M.pole);
    post.position.y = 1.65;
    sign.add(board, post);
    root.add(sign);
    ctx.scene.add(root);
    const fwd = { x: Math.sin(p.h), z: Math.cos(p.h) };
    const cols = [-2.6, 0, 2.6].map(o => ({ x: p.x + fwd.x * o, z: p.z + fwd.z * o }));
    let announced = false, t = 0;
    shop = addActor({
        kind: "salonShop", S, D,
        update(dt) {
            t += dt;
            if (pole) pole.rotation.y = t * 2.4;
            const c = ctx.car, rs = S - c.s;
            if (ctx.state !== "playing") return rs > -150;
            if (!announced && rs < 220) {
                announced = true;
                H.banner(`💇 <b>Chez Fabio ahead!</b><small>Pull into the pink lot and stop for a makeover</small>`, 2800);
            }
            const onLot = Math.abs(c.s - S) < 7.6 && c.d > SHOULDER - 0.6 && c.d < D - 3.6;
            if (onLot) H.prompt(c.speed < 4.5 ? `💇 Fabio's ready for you!` : `💇 Stop here — ${glyph("brake")} brake`);
            else if (this.prompted) H.prompt("");
            this.prompted = onLot;
            if (onLot && c.speed < 4.5) {
                H.prompt("");
                startSalon({ from: "drive", s: c.s });
                return false;
            }
            return rs > -150;
        },
        collide(car) {
            let imp = 0;
            for (const c of cols) imp = Math.max(imp, car.collideStatic(c.x, c.z, 3.6));
            return imp ? { impact: imp, why: "Fabio's window. He's DEVASTATED.", source: "house", kind: "house" } : null;
        },
        dispose() {
            ctx.scene.remove(root);
            lotGeo.dispose(); stripes.forEach(g => g.dispose()); stripeMat.dispose(); tex.dispose(); boardMat.dispose();
            board.geometry.dispose(); post.geometry.dispose();
            if (this.prompted) H.prompt("");
            if (shop === this) shop = null;
        },
    });
    return shop;
}

// the foot feature shows a door for every ctx.interiors entry (2D: the salon is a foot-world building)
ctx.interiors.salon = { name: "Chez Fabio", emoji: "💇", enter({ exit } = {}) { startSalon({ from: "foot", exit }); } };

// ── a real mirror: render the room from the mirrored camera (like three's Reflector) ─
class Mirror {
    constructor(w, h, res = 512) {
        this.rt = new THREE.WebGLRenderTarget(res, res, { type: THREE.HalfFloatType });
        this.cam = new THREE.PerspectiveCamera();
        this.tm = new THREE.Matrix4();
        this.mat = new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: this.rt.texture }, textureMatrix: { value: this.tm }, tint: { value: new THREE.Color("#F4F8FF") } },
            vertexShader: "uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
            fragmentShader: "uniform sampler2D tDiffuse; uniform vec3 tint; varying vec4 vUv; void main(){ vec4 c = texture2DProj(tDiffuse, vUv); gl_FragColor = vec4(c.rgb * tint, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
        });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
        this.n = new THREE.Vector3(); this.mp = new THREE.Vector3(); this.cp = new THREE.Vector3(); this.rot = new THREE.Matrix4();
        this.look = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.view = new THREE.Vector3();
        this.plane = new THREE.Plane(); this.clip = new THREE.Vector4(); this.q = new THREE.Vector4();
    }
    render(renderer, scene, camera) {
        const m = this.mesh;
        m.updateMatrixWorld();
        camera.updateMatrixWorld();
        this.mp.setFromMatrixPosition(m.matrixWorld);
        this.cp.setFromMatrixPosition(camera.matrixWorld);
        this.rot.extractRotation(m.matrixWorld);
        this.n.set(0, 0, 1).applyMatrix4(this.rot);
        this.view.subVectors(this.mp, this.cp);
        if (this.view.dot(this.n) > 0) return;
        this.view.reflect(this.n).negate().add(this.mp);
        this.rot.extractRotation(camera.matrixWorld);
        this.look.set(0, 0, -1).applyMatrix4(this.rot).add(this.cp);
        this.tgt.subVectors(this.mp, this.look).reflect(this.n).negate().add(this.mp);
        const vc = this.cam;
        vc.position.copy(this.view);
        vc.up.set(0, 1, 0).applyMatrix4(this.rot).reflect(this.n);
        vc.lookAt(this.tgt);
        vc.far = camera.far;
        vc.updateMatrixWorld();
        vc.projectionMatrix.copy(camera.projectionMatrix);
        this.tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
        this.tm.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse).multiply(m.matrixWorld);
        // oblique near plane = the mirror plane (nothing behind the glass is drawn)
        this.plane.setFromNormalAndCoplanarPoint(this.n, this.mp).applyMatrix4(vc.matrixWorldInverse);
        this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
        const e = vc.projectionMatrix.elements;
        this.q.set((Math.sign(this.clip.x) + e[8]) / e[0], (Math.sign(this.clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
        this.clip.multiplyScalar(2 / this.clip.dot(this.q));
        e[2] = this.clip.x; e[6] = this.clip.y; e[10] = this.clip.z + 1 - 0.003; e[14] = this.clip.w;
        m.visible = false;
        const prevRT = renderer.getRenderTarget(), prevAuto = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(this.rt);
        renderer.state.buffers.depth.setMask(true);
        if (renderer.autoClear === false) renderer.clear();
        renderer.render(scene, vc);
        renderer.shadowMap.autoUpdate = prevAuto;
        renderer.setRenderTarget(prevRT);
        m.visible = true;
    }
    dispose() { this.rt.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); }
}

// ── the salon set ────────────────────────────────────────────────────────
let set = null, room = null, salon = null;
function checker(a, b, n = 8) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), s = 256 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function buildSet() {
    set = makeSet({ light: "indoor", sky: "#FFE0EC" });
    set.sun.intensity = 1.1;
    makeRoom(set, { w: 10, d: 8, h: 3.8, floor: "#ffffff", walls: "#FFC1DA", trim: "#D81B60" });
    const P = models.cameos_salonProps;
    const part = n => { const o = findNodes(P, n)[0]; return o ? o.clone(true) : new THREE.Group(); };
    const tex = set.own(checker("#2B1B2E", "#FFF5F9"));
    tex.repeat.set(5, 4);
    const floor = new THREE.Mesh(set.own(new THREE.PlaneGeometry(10, 8)), set.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.05 })));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; floor.receiveShadow = true;
    set.add(floor);
    // crown moulding band + damask dots on the back wall
    const band = new THREE.Mesh(set.own(new THREE.BoxGeometry(10, 0.16, 0.06)), set.own(new THREE.MeshStandardMaterial({ color: "#F48FB1" })));
    band.position.set(0, 3.7, -3.88); set.add(band);
    const dotMat = set.own(new THREE.MeshStandardMaterial({ color: "#FFE3EE", roughness: 0.9 }));
    const dotGeo = set.own(new THREE.CircleGeometry(0.05, 10));
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, 120);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 15 && k < 120; x++) {
        const px = -4.6 + x * 0.66 + (y % 2) * 0.33, py = 0.5 + y * 0.42;
        if (Math.abs(px) < 1.25 && py > 0.55 && py < 2.55) continue;   // not behind the mirror
        m4.makeTranslation(px, py, -3.885); dots.setMatrixAt(k++, m4);
    }
    dots.count = k; set.add(dots);
    const mirrorFrame = part("Mirror"); mirrorFrame.position.set(0, 0, -3.86); set.add(mirrorFrame);
    const chair = part("Chair"); chair.position.set(0, 0, -2.25); chair.rotation.y = Math.PI; set.add(chair);
    const cart = part("Cart"); cart.position.set(-1.35, 0, -2.3); cart.rotation.y = 0.4; set.add(cart);
    const shelf = part("Shelf"); shelf.position.set(4.78, 1.5, -1.6); shelf.rotation.y = -Math.PI / 2; set.add(shelf);
    const shelf2 = part("Shelf"); shelf2.position.set(4.78, 1.5, 0.2); shelf2.rotation.y = -Math.PI / 2; set.add(shelf2);
    const poster = part("Poster"); poster.position.set(-4.85, 1.9, -1.2); poster.rotation.y = Math.PI / 2; set.add(poster);
    const dryer = part("Dryer"); dryer.position.set(-3.6, 0, -2.9); dryer.rotation.y = 0.5; set.add(dryer);
    const plant = part("Plant"); plant.position.set(4.2, 0, -3.3); set.add(plant);
    const plant2 = part("Plant"); plant2.position.set(-4.3, 0, 1.2); set.add(plant2);
    const sign = textPlane(["✨ CHEZ FABIO ✨"], { w: 3.2, h: 0.5, bg: "#AD1457", fg: "#FFF1F8" });
    sign.position.set(0, 3.25, -3.84); set.add(sign); set.own(sign.material.map, sign.material);
    // the mirror itself + Hollywood glow
    const res = ctx.TEST ? 256 : (ctx.platform && (ctx.platform.console || ctx.platform.tv)) ? 384 : 512;
    const mirror = new Mirror(1.5, 1.7, res);
    mirror.mesh.position.set(0, 1.55, -3.84);
    set.add(mirror.mesh);
    const glow = new THREE.PointLight("#FFE9C4", 5, 7, 1.5); glow.position.set(0, 2.3, -3.2); set.add(glow);
    const fill = new THREE.PointLight("#FF9FCB", 3, 10, 1.5); fill.position.set(2.5, 2.8, 1.5); set.add(fill);
    const fx = new Particles(set.scene, 220);
    room = { mirror, fx, chair, bulbs: [] };
    mirrorFrame.traverse(o => { if (o.isMesh && o.material.name === "NeonBulb") { o.material = o.material.clone(); room.bulbs.push(o.material); } });
}

/** Enter the salon. opts.from: "drive" | "foot"; opts.exit: back-to-foot callback; opts.s: where to resume driving. */
export async function startSalon(opts = {}) {
    if (salon) return;
    salon = { loading: true };
    const ok = await loadModels(["cameos_salonProps", "cameos_fabio", "cameos_props", "luluPerson_bouncy", "luluPerson_avigail"]);
    await ensureHairStyles();
    if (!ok) { salon = null; return; }
    setState("cameosSalon", opts);
}

export const salonState = () => salon;
export const hasFootModel = style => !!models["luluPerson_" + style];

function makeLulu(style, color) {
    const key = style === "sheitel" ? "luluPerson" : "luluPerson_" + style;
    const p = spawnPerson(models[key] ? key : "luluPerson");
    p.hairMats = [];
    p.obj.traverse(o => { if (o.isMesh && o.material.name === "Hair") { o.material = o.material.clone(); o.material.color.set(color); p.hairMats.push(o.material); } });
    p.setColor = c => { for (const m of p.hairMats) m.color.set(c); };
    return p;
}

registerState("cameosSalon", {
    hud: false, touch: false, pausable: true, world: false,
    enter(data) {
        if (!set) buildSet();
        const h = luluHair();
        const S = salon = { loading: false, t: 0, data, phase: 0, style: h.style, color: h.color, preview: null, cam: new SetCam(set.camera),
            sparkle: 0, foils: [], cheer: 0, dance: false, done: false };
        // three Lulus (one per style) share the chair; only the previewed one is visible
        S.lulus = {};
        for (const st of SALON_STYLES) {
            const p = makeLulu(st.style, h.color);
            p.obj.position.set(0, 0.08, -2.2);
            p.obj.rotation.y = Math.PI;      // facing the mirror
            const cape = prop("cameos_salonProps", "Cape");
            onBody(p, cape, [0, 1.3, 0]);
            set.add(p.obj);
            S.lulus[st.style] = p;
        }
        S.fabio = spawnPerson("cameos_fabio");
        S.fabio.obj.position.set(0.95, 0, -1.75);
        S.fabio.obj.rotation.y = -2.3;
        S.scissors = inHand(S.fabio, prop("cameos_props", "Scissors"), "R", [0, -0.46, 0.06]);
        set.add(S.fabio.obj);
        showStyle(S, h.style);
        set.show();
        A.setMusic("../salon.mp3");
        A.updateEngine(0, 0, 0, 0, false, false);
        A.sfxHorn(false);
        fade(1, 0); fade(0, 0.6);
        stat("salon", 1);
        runSalon(S).catch(e => { console.error("[cameos salon]", e); leaveSalon(S); });
    },
    exit() {
        closeDialog();
        H.hideScreen(); sidePanel(false); chips([]); clearCaptions();
        if (salon && salon.lulus) {
            for (const p of Object.values(salon.lulus)) { set.scene.remove(p.obj); p.hairMats.forEach(m => m.dispose()); }
            set.scene.remove(salon.fabio.obj);
            for (const f of salon.foils) f.parent && f.parent.remove(f);
        }
        set.hide();
        salon = null;
    },
    update(dt, P) {
        const S = salon;
        if (!S || S.loading) return;
        S.t += dt;
        if (H.screenOpen()) H.menuInput(P);
        if (S.onFocus) S.onFocus(H.currentFocus());
        const lulu = S.lulus[S.preview || S.style];
        for (const p of Object.values(S.lulus)) p.update(dt, { sit: true, cheer: S.cheer > 0, talk: S.luluTalk });
        S.cheer = Math.max(0, S.cheer - dt);
        // Fabio: snip-snip, sway, and a little dance while the colour takes
        const fab = S.fabio;
        fab.update(dt, { talk: !S.dance, dance: S.dance, point: S.phase === 2 || S.phase === 3 });
        fab.obj.position.x = 0.95 + Math.sin(S.t * 3) * 0.08;
        if (S.dance) { fab.obj.position.x = Math.sin(S.t * 1.6) * 1.1; fab.obj.position.z = -1.6 + Math.cos(S.t * 1.6) * 0.25; }
        fab.face(lulu.obj.position.x, lulu.obj.position.z, dt, 4);
        if (S.scissors && Math.sin(S.t * 6) > 0.92 && S.phase >= 1) sfx.snip();
        // twinkling vanity bulbs
        room.bulbs.forEach((m, i) => { m.emissiveIntensity = 2.2 + 1.2 * Math.sin(S.t * 5 + i * 0.7); });
        // sparkles + confetti
        if (S.sparkle > 0) {
            S.sparkle -= dt;
            const hc = new THREE.Color(S.color);
            for (let i = 0; i < 3; i++) room.fx.emit(rand(-0.4, 0.4), rand(1.0, 1.9), -2.2 + rand(-0.3, 0.3), rand(-0.6, 0.6), rand(0.2, 1.2), rand(-0.6, 0.6),
                0.06, 0.9, Math.random() < 0.5 ? [1, 0.85, 0.3] : [hc.r, hc.g, hc.b]);
        }
        room.fx.update(dt);
        // camera: wide on arrival, then behind the chair looking into the mirror, then the big reveal
        const c = S.cam;
        if (S.phase === 0) c.to(2.6, 2.1, 2.4, 0, 1.2, -2.6, dt, 1.4);
        else if (S.phase === 5) c.to(-0.55 + Math.sin(S.t * 0.4) * 0.3, 1.45, -3.2, 0, 1.25, -2.15, dt, 1.6);
        else c.to(1.25, 1.6, -0.75, -0.2, 1.3, -3.84, dt, 1.8);
        room.mirror.render(ctx.renderer, set.scene, set.camera);
    },
});

function showStyle(S, style, color) {
    S.preview = style;
    for (const [st, p] of Object.entries(S.lulus)) p.obj.visible = st === style;
    if (color) S.lulus[style].setColor(color);
}

/** A side-panel picker; the focused button previews live on Lulu. Resolves with the picked index. */
function panel(html, buttons, onFocus, focus = 0) {
    return new Promise(resolve => {
        sidePanel(true);
        H.showScreen(html, buttons.map((b, i) => Object.assign({}, b, { action: () => { salon && (salon.onFocus = null); H.hideScreen(); sidePanel(false); resolve(i); } })),
            { focus, cls: "salon-card" });
        if (salon) salon.onFocus = onFocus;
    });
}

async function runSalon(S) {
    await wait(0.5);
    await say("Fabio", "Ah, bonjour! You sit in zee chair of GENIUS!", Object.assign({ auto: 3.5 }, FABIO));
    S.phase = 1;
    for (const line of SALON_CONSULT) { if (salon !== S) return; await say("Fabio", line, FABIO); }
    if (salon !== S) return;
    // ── STYLE: "And zee SILHOUETTE, darling?" ──
    S.phase = 2;
    let style = null, color = null;
    while (salon === S && !color) {
        caption("💇‍♂️ And zee SILHOUETTE, darling?", "pink");
        const cur = Math.max(0, SALON_STYLES.findIndex(x => x.style === S.style));
        const si = await panel(`<h2>💇 Chez Fabio</h2><p>And zee <b>SILHOUETTE</b>, darling?</p><p class="fine">${glyph("up")}${glyph("down")} preview · ${glyph("confirm")} pick</p>`,
            SALON_STYLES.map(st => ({ label: `${st.icon} ${st.label}`, cls: "pink" })),
            i => { if (i >= 0 && i < 3) showStyle(S, SALON_STYLES[i].style, S.color); }, cur);
        clearCaptions();
        if (salon !== S) return;
        style = SALON_STYLES[si];
        showStyle(S, style.style, S.color);
        sfx.sting();
        // ── COLOUR: Fabio reacts to the style; every shade is a win ──
        S.phase = 3;
        while (salon === S && !color) {
            const grid = SALON_COLORS.map(c => ({
                label: `<span class="swatch" style="background:${c.hex}"></span><span>${c.label}${c.blonde ? `<small>✨ Fabio's pick</small>` : ""}</span>`, cls: "alt swatchbtn",
            }));
            grid.push({ label: "← Another style", cls: "purple" });
            const ci = await panel(`<h2>🎨 The colour</h2><div class="quote">💇‍♂️ ${style.fabio}</div><p class="fine">Every shade is a look — pick what's YOU 💖</p>`,
                grid, i => { if (i >= 0 && i < SALON_COLORS.length) S.lulus[style.style].setColor(SALON_COLORS[i].hex); else S.lulus[style.style].setColor(S.color); },
                Math.max(0, SALON_COLORS.findIndex(c => c.hex === S.color)));
            if (salon !== S) return;
            if (ci >= SALON_COLORS.length) { S.lulus[style.style].setColor(S.color); break; }   // back to the styles
            const pc = SALON_COLORS[ci];
            S.lulus[style.style].setColor(pc.hex);
            sfx.sting();
            const yes = await panel(`<h2>${pc.label}${pc.blonde ? " ✨" : ""}</h2><div class="quote">💇‍♂️ Go ${pc.label}, darling? A MARVELOUS choice!</div>`,
                [{ label: `YES! GO ${pc.label} ${glyph("confirm")}`, cls: "" }, { label: "← PICK AGAIN", cls: "alt" }], null, 0);
            if (salon !== S) return;
            if (yes === 0) color = pc;
        }
        if (!color) S.phase = 2;
    }
    if (salon !== S) return;
    // ── PROCESS: ~6.4 s of beats while the colour takes ──
    S.phase = 4;
    S.dance = true;
    S.oops = Math.random() < 0.125;      // ~1-in-8 BONUS surprise: the cat knocks the bottle (a treat, not a punishment)
    const lulu = S.lulus[style.style];
    addFoils(S, lulu);
    S.sparkle = 6.4;
    await say("Fabio", color.fabio, Object.assign({ auto: 1.1 }, FABIO));
    for (const beat of SALON_PROCESS_BEATS) {
        if (salon !== S) return;
        await say("Fabio", beat, Object.assign({ auto: 0.6 }, FABIO));
    }
    if (salon !== S) return;
    if (S.oops) await say("Fabio", SALON_OOPS.fabio, Object.assign({ auto: 1.4 }, FABIO));
    // ── REVEAL: commit colour AND shape — shared with the 2D game ──
    S.phase = 5; S.dance = false;
    removeFoils(S);
    S.style = style.style; S.color = color.hex;
    shared.update(s => { s.luluHair = color.hex; s.luluHairStyle = style.style; });
    await applyHair(color.hex, style.style);
    emit("cameos:hair", { color: color.hex, style: style.style });
    S.sparkle = 3; S.cheer = 3.2;
    sfx.fanfare();
    if (color.blonde || S.oops) setTimeout(() => sfx.sting(), 350);
    rumble(0.3, 0.6, 300, true);
    caption(`✨ ${style.label} · ${color.label} ✨`, "gold big", 3800);
    await say("Lulu", S.oops ? SALON_OOPS.lulu : SALON_OUTCOMES[color.label], LULU);
    if (salon !== S) return;
    await say("Fabio", S.oops ? "Zee CAT helped. A BONUS, non?" : "VOILÀ. Thank ZEE ART, darling.", FABIO);
    if (salon !== S) return;
    await panel(`<h2>💖 Gorgeous!</h2><p>Lulu's new look is saved — in the car, on foot, and in the 2D game.</p>`,
        [{ label: `💖 Leave the salon ${glyph("confirm")}`, cls: "pink" }], null, 0);
    leaveSalon(S);
}

function addFoils(S, lulu) {
    const head = lulu.limbs.Body || lulu.obj;
    for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        const f = prop("cameos_salonProps", "Foil");
        f.position.set(Math.cos(a) * 0.2, 1.62 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.2 - 0.02);
        f.rotation.set(0.3, -a, 0);
        head.add(f);
        S.foils.push(f);
    }
}
function removeFoils(S) { for (const f of S.foils) if (f.parent) f.parent.remove(f); S.foils = []; }

function leaveSalon(S) {
    if (salon !== S) return;
    const data = S.data || {};
    fade(1, 0.35);
    setTimeout(() => {
        fade(0, 0.6);
        if (data.from === "foot" && typeof data.exit === "function") {
            // she walked in on foot, she walks back OUT on foot (no free car)
            if (ctx.state === "cameosSalon") { try { data.exit(); } catch (e) { console.error(e); } }
        } else if (ctx.state === "cameosSalon") {
            resumeDriving({ s: data.s, banner: `💇 <b>Looking FABULOUS!</b><small>Thank ZEE ART, darling.</small>` });
        }
    }, 380);
}

css("cameos-salon", `
.card.salon-card .menu { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.card.salon-card .menu .btn { width: 100%; font-size: 16px; padding: 10px 12px; }
.card.salon-card .menu .btn.pink, .card.salon-card .menu .btn.purple { grid-column: 1 / -1; }
.card.salon-card .menu .btn:only-child { grid-column: 1 / -1; }
.btn.swatchbtn { justify-content: flex-start; gap: 10px; background: #fff; color: var(--ink); text-align: left; }
.btn.swatchbtn small { display: block; font-size: 11px; color: #B8860B; }
.swatch { flex: none; width: 30px; height: 30px; border-radius: 50%; box-shadow: inset 0 0 0 3px rgba(0,0,0,.15); }
body.tv .card.salon-card .menu .btn { font-size: 22px; } body.tv .swatch { width: 40px; height: 40px; }
`);
