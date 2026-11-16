// Dina's bedroom (2D: dinaHome). Walk around (stick / D-pad / WASD / drag),
// walk up to something and press ✕ (or tap it): the tablet plays Lulu's game,
// Morgan → the plushie scene, cookie & milk → Cookie Catch (💰10), the sticker
// book, the bed → a nap, the door → back outside (the sister picker). Every
// 20–35 s Mom pops in through the door with a line — hug her for +1 💰.
import * as THREE from "three";
import { ctx, registerState, setState, on, addMenuItem, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { startRun, endRun } from "../../core/driving.js";
import { resume } from "../../core/screens.js";
import { spawnPerson } from "../../core/people.js";
import { input } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { room, SPOTS, ROOM } from "./room.js";
import {
    L, bubble, bubblesDone, floater, updateFloaters, sfx, rand, randPick, clamp, g, isTouch, holdPose, coinsNow,
    bindPointer, unbindPointer, pickAt, pointerPlane, toScreen,
} from "./common.js";

export const COOKIE_FEE = 10;
// the 2D HOME_OBJECTS, as 3D interaction spots (where Dina stands + how close counts)
const OBJECTS = [
    { id: "tablet", label: "Play Lulu's game?", verb: "Play", x: SPOTS.tablet.x, z: SPOTS.tablet.z + 0.75, r: 0.95, anchor: [SPOTS.tablet.x, 1.05, SPOTS.tablet.z] },
    { id: "morgan", label: "Play with Morgan?", verb: "Play", x: SPOTS.morgan.x + 0.7, z: SPOTS.morgan.z + 0.35, r: 1.0, anchor: [SPOTS.morgan.x, 0.85, SPOTS.morgan.z] },
    { id: "snack", label: "Cookie & milk!", verb: "Snack", x: SPOTS.snacks.x, z: SPOTS.snacks.z + 0.75, r: 0.95, anchor: [SPOTS.snacks.x, 1.05, SPOTS.snacks.z] },
    { id: "stickers", label: "Sticker book?", verb: "Open", x: SPOTS.sticker.x, z: SPOTS.sticker.z + 0.75, r: 0.95, anchor: [SPOTS.sticker.x, 0.6, SPOTS.sticker.z] },
    { id: "nap", label: "Take a nap?", verb: "Nap", x: SPOTS.bed.x - 0.4, z: SPOTS.bed.z + 1.75, r: 1.25, anchor: [SPOTS.bed.x, 1.5, SPOTS.bed.z] },
    { id: "outside", label: "Go back outside?", verb: "Go", x: SPOTS.door.x + 0.75, z: SPOTS.door.z, r: 1.0, anchor: [SPOTS.door.x + 0.1, 2.75, SPOTS.door.z] },
];
// the 2D MOM_LINES
export const MOM_LINES = [
    "Dina! Dinner in 5 minutes!", "Did you do your homework, sweetie?",
    "Who wants rugelach? 🥐", "Don't forget to give Morgan a hug!",
    "Is Lulu home yet? She's not answering!", "Lights out at 8, mamele!",
    "Bubbe called — she says hi! 👵", "I love you to the moon! 🌙",
    "Who left the milk out? 🥛", "Shabbos clothes are on the chair!",
];
// furniture Dina can't walk through (x0, z0, x1, z1) + round things (x, z, r)
const BOXES = [[2.8, -4, 4.45, -1.58], [1.98, -3.85, 2.62, -3.25], [-4.35, -3.8, -3.35, -3.1]];
const ROUND = [[SPOTS.snacks.x, SPOTS.snacks.z, 0.42], [SPOTS.tablet.x, SPOTS.tablet.z, 0.45], [SPOTS.morgan.x, SPOTS.morgan.z, 0.35]];
const MOM_DOOR = new THREE.Vector3(SPOTS.door.x + 0.2, 0, SPOTS.door.z), MOM_SPOT = new THREE.Vector3(-3.25, 0, -0.65);

export const Home = { dina: null, mom: null, momVisit: null, momCooldown: 12, msgT: 0, hover: null, ptrHover: null, t: 0, walkTo: null, ptrDown: false };
const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _v = new THREE.Vector3();
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), snap: true };

function ensureCast(rm) {
    if (!Home.dina) {
        Home.dina = spawnPerson("dinaPerson");
        Home.mom = spawnPerson("imaPerson");
        Home.mom.obj.visible = false;
    }
    if (Home.dina.obj.parent !== rm.scene) rm.scene.add(Home.dina.obj);
    if (Home.mom.obj.parent !== rm.scene) rm.scene.add(Home.mom.obj);
}
export function homeDisposed() { Home.dina = null; Home.mom = null; Home.momVisit = null; }

const RETURN_SPOT = {
    morgan: [SPOTS.morgan.x + 0.8, SPOTS.morgan.z + 0.4], nap: [SPOTS.bed.x - 0.6, SPOTS.bed.z + 1.9],
    stickers: [SPOTS.sticker.x, SPOTS.sticker.z + 0.9], cookie: [SPOTS.snacks.x + 0.2, SPOTS.snacks.z + 0.9],
    tablet: [SPOTS.tablet.x + 0.3, SPOTS.tablet.z + 0.9],
};

registerState("dinaHome", {
    hud: false, touch: true, pausable: true, world: false,
    enter(data = {}) {
        const rm = room();
        rm.set.show();
        rm.night(0);
        ensureCast(rm);
        const d = Home.dina, from = data.from || "outside";
        const spot = RETURN_SPOT[from] || [0.6, 2.7];
        d.obj.position.set(spot[0], 0, spot[1]);
        d.obj.rotation.set(0, from in RETURN_SPOT ? 0 : Math.PI, 0);
        d.obj.visible = true;
        // 2D enterDinaHome(): Mom checks in soon after Dina gets home (and after the sticker book / Cookie Catch)
        if (!(from in RETURN_SPOT) || from === "stickers" || from === "cookie" || from === "tablet") {
            Home.momVisit = null;
            Home.mom.obj.visible = false;
            Home.momCooldown = rand(8, 14);
        }
        Home.t = 0; Home.msgT = 0; Home.walkTo = null; Home.ptrDown = false; Home.ptrHover = null;
        cam.snap = true;
        L.show();
        input.stick2d = true;
        document.body.classList.add("dina-room");
        A.setMusic("../dina.mp3");
        bindPointer({ down: onDown, move: onMove, up: () => { Home.ptrDown = false; Home.walkTo = null; } });
    },
    exit() {
        unbindPointer();
        input.stick2d = false;
        Home.ptrHover = null;
        setGlow([]);
        document.body.classList.remove("dina-room", "dina-hot");
        L.clear();
    },
    update(dt, P) {
        const rm = room(), d = Home.dina, o = d.obj;
        Home.t += dt;
        rm.tick(dt, Home.t);
        updateMomVisit(dt);

        // ── walking: stick / D-pad / keys, or toward the finger / mouse ──
        let mx = input.moveX, mz = input.moveY;
        if (Home.walkTo) {
            const dx = Home.walkTo.x - o.position.x, dz = Home.walkTo.z - o.position.z, dd = Math.hypot(dx, dz);
            if (dd > 0.12) { mx = dx / dd; mz = dz / dd; } else if (!Home.ptrDown) Home.walkTo = null;
        }
        const len = Math.hypot(mx, mz);
        let speed = 0;
        if (len > 0.08) {
            const k = Math.min(1, len);
            speed = 2.4 * k;
            o.position.x += mx / len * speed * dt;
            o.position.z += mz / len * speed * dt;
            d.face(o.position.x + mx, o.position.z + mz, dt, 12);
        }
        collide(o.position);
        d.update(dt, { walk: speed });

        // ── what's Dina next to? (Mom first) ──
        let hover = null, best = 1e9;
        const mom = momItem();
        if (mom) {
            const mp = Home.mom.obj.position, dm = Math.hypot(mp.x - o.position.x, mp.z - o.position.z);
            if (dm < 1.4) { hover = mom; best = 0; }
        }
        if (!hover) for (const ob of OBJECTS) {
            const dd = Math.hypot(ob.x - o.position.x, ob.z - o.position.z);
            if (dd < ob.r && dd < best) { best = dd; hover = ob; }
        }
        Home.hover = hover;
        if (hover && (P.interact || P.confirm)) { trigger(hover.id); if (ctx.state !== "dinaHome") return; }
        if (Home.momVisit && Home.momVisit.hugT > 0) {
            d.face(Home.mom.obj.position.x, Home.mom.obj.position.z, dt, 8);
            holdPose(d, -1.35, 0.45);
        }

        // ── HUD + labels ──
        const mv = Home.momVisit;
        L.hud(`<span class="t">🏠 Dina's Bedroom</span><span class="chip gold">💰 ${coinsNow().toLocaleString()}</span>
            <span class="chip" style="color:${mv ? "#FFD54F" : "#B8E0D2"}">${mv ? "Mom: here! 👋" : "Mom: kitchen"}</span>`);
        const camera = rm.set.camera;
        if (hover) bubble("hover", `${hover.label}${isTouch() ? ` <span class="glyph">TAP</span>` : g("interact")}`, _p.set(...hover.anchor), camera, "label");
        // the mouse over an item: the same label (and both glow — the one she's next to, the one under the pointer)
        const ph = Home.ptrHover && Home.ptrHover !== (hover && hover.id) ? (Home.ptrHover === "mom" ? mom : OBJECTS.find(ob => ob.id === Home.ptrHover)) : null;
        if (ph) bubble("ptr", `${ph.label} <span class="glyph">CLICK</span>`, _p.set(...ph.anchor), camera, "label");
        else if (Home.ptrHover === "mom" && !mom) setPtrHover(null);
        setGlow([hover && hover.id, Home.ptrHover].filter(Boolean), Home.t);
        if (mv && mv.phase === 1) bubble("mom", mv.line, _p.set(Home.mom.obj.position.x, 2.3, Home.mom.obj.position.z), camera);
        bubblesDone();
        updateFloaters(dt, camera);
        if (Home.msgT > 0) { Home.msgT -= dt; if (Home.msgT <= 0) L.msg(""); }
        L.prompt(hover ? "" : `<div>${walkHint()}</div>`);

        // ── dollhouse camera, drifting with Dina ──
        const portrait = camera.aspect < 1;
        const tx = o.position.x * (portrait ? 0.75 : 0.32), tz = o.position.z * 0.3 - 0.5;
        _l.set(tx, 0.55, tz);
        _p.set(tx, portrait ? 7.4 : 5.0, tz + (portrait ? 9.2 : 6.3));
        if (cam.snap) { cam.pos.copy(_p); cam.look.copy(_l); cam.snap = false; }
        cam.pos.lerp(_p, Math.min(1, dt * 3)); cam.look.lerp(_l, Math.min(1, dt * 3));
        camera.position.copy(cam.pos); camera.lookAt(cam.look);
        camera.fov = portrait ? 62 : 50; camera.updateProjectionMatrix();
    },
});

function walkHint() {
    if (isTouch()) return `🕹️ Drag to walk · tap an item to play`;
    if (input.device === "gamepad") return `${g("move")} walk · ${g("interact")} use`;
    return `${g("move")} walk · ${g("interact")} / Enter use`;
}

function collide(p) {
    p.x = clamp(p.x, -ROOM.w / 2 + 0.4, ROOM.w / 2 - 0.4);
    p.z = clamp(p.z, -ROOM.d / 2 + 0.45, ROOM.d / 2 - 0.3);
    for (const [x0, z0, x1, z1] of BOXES) {
        const r = 0.25;
        if (p.x > x0 - r && p.x < x1 + r && p.z > z0 - r && p.z < z1 + r) {
            const dl = p.x - (x0 - r), dr = x1 + r - p.x, db = p.z - (z0 - r), df = z1 + r - p.z;
            const m = Math.min(dl, dr, db, df);
            if (m === dl) p.x = x0 - r; else if (m === dr) p.x = x1 + r; else if (m === db) p.z = z0 - r; else p.z = z1 + r;
        }
    }
    const round = Home.momVisit ? ROUND.concat([[Home.mom.obj.position.x, Home.mom.obj.position.z, 0.45]]) : ROUND;
    for (const [x, z, r] of round) {
        const dx = p.x - x, dz = p.z - z, dd = Math.hypot(dx, dz), rr = r + 0.22;
        if (dd < rr && dd > 1e-4) { p.x = x + dx / dd * rr; p.z = z + dz / dd * rr; }
    }
}

// ── Mom pops in (2D: every 20–35 s; tap her for a hug, +1 💰 once per visit) ─
function updateMomVisit(dt) {
    const rm = room(), m = Home.mom;
    if (!Home.momVisit) {
        if (!ctx.enabled("dina")) return;
        Home.momCooldown -= dt;
        if (Home.momCooldown <= 0) {
            Home.momVisit = { phase: 0, t: 0, line: randPick(MOM_LINES), hugged: false, hugT: 0 };
            m.obj.visible = true;
            m.obj.position.copy(MOM_DOOR);
        }
        if (rm.doorLeaf) rm.doorLeaf.rotation.y += (0 - rm.doorLeaf.rotation.y) * Math.min(1, dt * 5);
        return;
    }
    const v = Home.momVisit;
    v.t += dt;
    if (v.hugT > 0) v.hugT -= dt;
    if (v.phase === 0 && v.t > 0.9) { v.phase = 1; v.t = 0; sfx.tone(660, 0.07, "sine", 0.12); }
    else if (v.phase === 1 && v.t > 4.2) { v.phase = 2; v.t = 0; }
    else if (v.phase === 2 && v.t > 0.9) { Home.momVisit = null; m.obj.visible = false; Home.momCooldown = rand(20, 35); return; }
    const k = clamp(v.phase === 0 ? v.t / 0.9 : v.phase === 1 ? 1 : 1 - v.t / 0.9, 0, 1);
    m.obj.position.lerpVectors(MOM_DOOR, MOM_SPOT, k);
    const walking = v.phase !== 1;
    if (walking) m.face(v.phase === 0 ? MOM_SPOT.x : MOM_DOOR.x - 1, v.phase === 0 ? MOM_SPOT.z : MOM_DOOR.z, dt, 10);
    else m.face(Home.dina.obj.position.x, Home.dina.obj.position.z, dt, 5);
    m.update(dt, { walk: walking ? 1.6 : 0, talk: v.phase === 1, wave: v.phase === 1 && v.t < 1.2 });
    if (v.hugT > 0) holdPose(m, -1.0, 0.5);   // arms around Dina
    if (rm.doorLeaf) {
        const want = v.phase === 2 && v.t > 0.7 ? 0 : -1.35;
        rm.doorLeaf.rotation.y += (want - rm.doorLeaf.rotation.y) * Math.min(1, dt * 6);
    }
}

function hugMom() {
    const v = Home.momVisit;
    if (!v || v.phase === 2) return false;
    if (!v.hugged) {
        v.hugged = true;
        wallet.add(1);
        floater("+1 💰 hug!", _v.copy(Home.mom.obj.position).setY(2.0), "#FF80AB");
        emit("stat", { id: "dinaHugs", n: 1 });
    }
    v.hugT = 1.6;
    v.line = "Love you too, Dina! 💕";
    if (v.phase === 1) v.t = Math.min(v.t, 2.4);   // linger a little
    for (let i = 0; i < 3; i++) setTimeout(() => { if (Home.mom) floater("💗", _v.copy(Home.mom.obj.position).setY(1.8 + i * 0.1).add(new THREE.Vector3(i * 0.25 - 0.25, 0, 0)), "#FF80AB", 1.2); }, i * 250);
    sfx.hug();
    return true;
}

// ── routing (2D triggerHomeInteract) ─────────────────────────────────────
export function trigger(action) {
    if (action === "mom") { hugMom(); return; }
    if (action === "morgan") { sfx.tone(600, 0.1, "triangle", 0.2); setState("dinaMorgan"); }
    else if (action === "tablet") { sfx.tone(880, 0.08, "sine", 0.18); playTablet(); }
    else if (action === "nap") setState("dinaNap");
    else if (action === "snack") {
        if (wallet.coins < COOKIE_FEE) {
            L.msg(`Need 💰${COOKIE_FEE} to play Cookie Catch`);
            Home.msgT = 1.8;
            sfx.deny();
        } else setState("dinaCookie");
    } else if (action === "stickers") setState("dinaStickers");
    else if (action === "outside") setState("dinaSelect");
}

// ── touch / mouse: tap an item (or Mom) to use it, drag to walk ──────────
function momItem() {
    const v = Home.momVisit;
    if (!v || v.phase === 2 || !Home.mom) return null;
    const mp = Home.mom.obj.position;
    return { id: "mom", label: v.hugged ? "Hug Mom again?" : "Hug Mom? 💕", verb: "Hug", anchor: [mp.x, 2.25, mp.z] };
}
/** The clickable things: [id, [objects]] — the tablet's pouf counts as the tablet. */
function targets() {
    const rm = room();
    const list = [
        ["tablet", [rm.tablet, rm.pouf]], ["morgan", [rm.morgan]], ["stickers", [rm.sticker]], ["nap", [rm.bed]],
        ["snack", [rm.scene.getObjectByName("SideTable")]], ["outside", [rm.scene.getObjectByName("RoomDoor")]],
    ];
    if (momItem()) list.unshift(["mom", [Home.mom.obj]]);
    return list.map(([id, os]) => [id, os.filter(Boolean)]).filter(t => t[1].length);
}
const _box = new THREE.Box3(), _c = new THREE.Vector3(), _sc = {};
/** An item's on-screen box (its 3D bounding box, projected), or null when it's off-camera. */
function screenRect(objs, camera) {
    _box.makeEmpty();
    for (const o of objs) _box.expandByObject(o);
    if (_box.isEmpty()) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
        _c.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z);
        if (!toScreen(_c, camera, _sc).visible) return null;
        x0 = Math.min(x0, _sc.x); x1 = Math.max(x1, _sc.x); y0 = Math.min(y0, _sc.y); y1 = Math.max(y1, _sc.y);
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
/** Which item a click / tap means: the one it lands on, else the closest one whose on-screen box —
 *  grown to a comfortable size (the tablet and sticker book are tiny on a phone) — holds it. */
function pickItem(e) {
    const camera = room().set.camera, list = targets();
    const hits = pickAt(e, camera, list.flatMap(t => t[1]));
    if (hits.length) for (let o = hits[0].object; o; o = o.parent) { const t = list.find(tt => tt[1].includes(o)); if (t) return t[0]; }
    const finger = e.pointerType === "touch" || e.pointerType === "pen" || isTouch();
    const pad = finger ? 20 : 14, min = finger ? 80 : 56;
    let best = null, bd = 1;
    for (const [id, os] of list) {
        const r = screenRect(os, camera);
        if (!r) continue;
        const hw = Math.max(min, r.w + pad * 2) / 2, hh = Math.max(min, r.h + pad * 2) / 2;
        const d = Math.max(Math.abs(e.clientX - r.cx) / hw, Math.abs(e.clientY - r.cy) / hh);
        if (d <= bd) { bd = d; best = id; }
    }
    return best;
}
function setPtrHover(id) {
    Home.ptrHover = id || null;
    document.body.classList.toggle("dina-hot", !!id);
}
// a soft warm glow on the item Dina's next to / the mouse is over (each item gets its own materials once)
const GLOW = new THREE.Color("#FFC98A"), _gc = new THREE.Color();
let glowing = [];
function glowMats(root) {
    if (!root.userData.glow) {
        const own = new Map();
        root.traverse(o => {
            if (!o.isMesh || !o.material || !o.material.emissive) return;
            let m = own.get(o.material);
            if (!m) { m = o.material.clone(); room().set.own(m); own.set(o.material, m); }
            o.material = m;
        });
        root.userData.glow = [...own.values()].map(m => ({ m, c: m.emissive.clone(), i: m.emissiveIntensity }));
    }
    return root.userData.glow;
}
function setGlow(ids, t = 0) {
    const want = ids.length ? targets().filter(tt => ids.includes(tt[0])).flatMap(tt => tt[1]) : [];
    for (const r of glowing) if (!want.includes(r)) for (const gm of glowMats(r)) { gm.m.emissive.copy(gm.c); gm.m.emissiveIntensity = gm.i; }
    const k = 0.2 + 0.1 * Math.sin(t * 6);
    for (const r of want) for (const gm of glowMats(r)) { gm.m.emissive.copy(gm.c).multiplyScalar(gm.i).add(_gc.copy(GLOW).multiplyScalar(k)); gm.m.emissiveIntensity = 1; }
    glowing = want;
}
function onDown(e) {
    if (ctx.state !== "dinaHome" || ctx.paused || ctx.dialogOpen) return;
    const id = pickItem(e);
    if (id) { setPtrHover(null); trigger(id); return; }
    Home.ptrDown = true;
    onMove(e);
}
function onMove(e) {
    if (ctx.state !== "dinaHome") return;
    if (!Home.ptrDown) {
        // a mouse hovering over an item lights it up and shows its label
        if (e.pointerType === "mouse") setPtrHover(ctx.paused || ctx.dialogOpen || H.screenOpen() ? null : pickItem(e));
        return;
    }
    const p = pointerPlane(e, room().set.camera, 0, "y");
    if (p) Home.walkTo = { x: p.x, z: p.z };
}

// ── the tablet: Lulu's game, played on Dina's tablet ─────────────────────
export const Tablet = { on: false };
function playTablet() {
    Tablet.on = true;
    document.body.classList.add("dina-tablet");
    startRun({ mode: "cruise" });
    H.toast("📱 Dina's playing Lulu's game!", "pink");
}
export function tabletBackHome() {
    if (!Tablet.on) return;
    Tablet.on = false;
    document.body.classList.remove("dina-tablet");
    setState("dinaHome", { from: "tablet" });
}
on("state", ({ to }) => {
    // quitting Lulu's game (title / game-over → title) brings Dina back to her room
    if (Tablet.on && to === "title") tabletBackHome();
});
addMenuItem("pause", {
    id: "dinaTablet", order: 87, cls: "pink", label: "🏠 Back to Dina's room",
    visible: () => Tablet.on,
    action: () => { resume(); endRun("tablet"); tabletBackHome(); },
});
