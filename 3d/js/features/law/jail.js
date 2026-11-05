// features/law — PRECINCT 18½ and the cell block.
//
//   lawJail  — arrive at the precinct (the cruiser pulls up, the perp walk up
//              the steps) → BOOKING & INTAKE (mugshot flashes in front of the
//              height chart) → the CELL: escape (one shot per stay) / bail /
//              lawyer / court, the cellmate chattering away, a guard pacing the
//              corridor → the LOCKPICK minigame → the animated JAILBREAK
//              (cart · disguise · keys · faint · vent · tunnel) → or SERVING
//              the sentence (mash ✕ to do your time, tally marks on the wall)
//   lawExit  — walking out of the station / courthouse: into her car and off,
//              or on foot (car impounded)
// Same rules, lines and numbers as the 2D src/10d-jail-court.js.
import * as THREE from "three";
import { ctx, on, registerState, setState, emit } from "../../core/ctx.js";
import { models, cloneWithColors, findNodes, registerModels, ensureModels } from "../../models.js";
import { makeSet, textPlane } from "../../core/sets.js";
import { wallet } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { CELLMATE_LINES, CELLMATE_FAMOUS, LULU_CELL_LINES, JAIL_LIFE, JAIL_ESCAPES, EXTRA_CHARGES, SERVE_ACTS, ABBA_RETAIN_LINES } from "./data.js";
import { S, bump, rand, randInt, pick, clamp, bailFor, lawyerFee, lawyerTiers, sentenceDays, releaseFee, chargeCoins, canAfford,
    saveLockup, patchLockup, clearLockup, addWanted, stat } from "./rules.js";
import { Shot, V, runFlow, check, person, lulu, walkTo, faceYaw, frameFor, cuffs, disposeCuffs, JUMPSUIT } from "./scene.js";
import { rig, setRig, startFugitive } from "./cops.js";
import { run, resumeDriving, FORCE } from "./service.js";

registerModels({ lawStation: "law_station", lawCell: "law_cell", lawBooking: "law_booking", lawCellmate: "law_cellmate", lawCart: "law_cart" });
const JAIL_KEYS = ["lawStation", "lawCell", "lawBooking", "lawCellmate", "lawCart", "copPerson"];
const BOOK_X = 40;   // the booking room sits off to the side of the cell block in the same set

// ── the precinct exterior (arrival + walking out) ────────────────────────
let ext = null;
function buildExt() {
    const set = makeSet({ light: "day", sky: "#a9dcff", ground: "#8cbf5e", fog: [60, 160] });
    set.sun.position.set(-14, 22, 18);
    const own = x => set.own(x);
    const station = cloneWithColors(models.lawStation);
    set.add(station);
    const road = new THREE.Mesh(own(new THREE.PlaneGeometry(260, 8.4)), own(new THREE.MeshStandardMaterial({ color: "#5d6169", roughness: 0.95 })));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 10.5); road.receiveShadow = true;
    set.add(road);
    const dashMat = own(new THREE.MeshStandardMaterial({ color: "#f4f4f0", roughness: 0.8 }));
    const dashGeo = own(new THREE.BoxGeometry(3, 0.02, 0.16));
    for (let x = -120; x < 120; x += 9) { const d = new THREE.Mesh(dashGeo, dashMat); d.position.set(x, 0.035, 10.5); set.add(d); }
    const curb = new THREE.Mesh(own(new THREE.BoxGeometry(260, 0.16, 0.3)), own(new THREE.MeshStandardMaterial({ color: "#cfcfc8", roughness: 0.9 })));
    curb.position.set(0, 0.08, 6.35); set.add(curb);
    const far = new THREE.Mesh(own(new THREE.PlaneGeometry(260, 3)), own(new THREE.MeshStandardMaterial({ color: "#b9b3a6", roughness: 0.95 })));
    far.rotation.x = -Math.PI / 2; far.position.set(0, 0.03, 16.2); set.add(far);
    // a few trees + hedges so it sits in the neighbourhood
    const trees = [[-16, -1], [-22, 3], [16, -2], [23, 2], [-30, -6], [31, -5], [-12, 19], [8, 21], [26, 20]];
    trees.forEach(([x, z], i) => {
        const t = cloneWithColors(i % 2 ? models.treePine : models.treeRound);
        t.position.set(x, 0, z); t.scale.setScalar(1.1 + (i % 3) * 0.15); set.add(t);
    });
    for (const x of [-6.5, -4.5, 4.5, 6.5]) { const b = cloneWithColors(models.bush); b.position.set(x, 0, 1.4); b.scale.setScalar(1.1); set.add(b); }
    // the courthouse sign that covers PRECINCT 18½ when she walks out of court
    const courtSign = textPlane(["COUNTY COURTHOUSE"], { w: 6.2, h: 0.9, bg: "#2a2f45", fg: "#F3D27A", font: 72 });
    courtSign.position.set(0, 5.75, 2.36); courtSign.visible = false; set.add(courtSign);
    // the cruiser + Lulu's own car
    const cruiser = cloneWithColors(models.cop);
    const crig = rig(cruiser);
    set.add(cruiser);
    const sk = SKINS[ctx.car.skinKey] || SKINS.pink;
    const lcar = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
    set.add(lcar);
    const driver = findNodes(lcar, "Driver")[0], hairs = findNodes(lcar, "Hair_");
    ext = { set, station, cruiser, crig, lcar, driver, hairs, courtSign, shot: new Shot(set.camera), skin: ctx.car.skinKey };
    return ext;
}
function extShow() {
    if (!ext) buildExt();
    else if (ext.skin !== ctx.car.skinKey) { const sk = SKINS[ctx.car.skinKey] || SKINS.pink;
        ext.lcar.traverse(o => { if (o.isMesh && /^Body/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set(o.material.name === "Body" ? sk.body : o.material.name === "BodyLight" ? sk.light : sk.dark); } });
        ext.skin = ctx.car.skinKey; }
    ext.set.show();
    ext.shot.cut();
    return ext;
}
function showDriverExt(on) {
    if (ext.driver) ext.driver.visible = on;
    for (const h of ext.hairs) h.visible = on && h.name.startsWith("Hair_" + (ctx.car.hairStyle || "sheitel"));
}

// ── the cell block + booking room ────────────────────────────────────────
let J = null;
function buildJail() {
    const set = makeSet({ light: "indoor", sky: "#101319", shadows: true });
    set.hemi.intensity = 0.62;
    set.hemi.color.set("#c7d3ff"); set.hemi.groundColor.set("#3a3530");
    set.sun.intensity = 1.25; set.sun.color.set("#dfe8ff");
    set.sun.position.set(4, 9, 11); set.sun.target.position.set(0, 0, -1.5);
    Object.assign(set.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    const bulb = new THREE.PointLight("#ffd79a", 9, 9, 1.6); bulb.position.set(0, 2.7, -1.5); set.add(bulb);
    const tubeL = new THREE.PointLight("#bcd4ff", 6, 14, 1.4); tubeL.position.set(7.5, 2.8, 2.4); set.add(tubeL);
    const bookL = new THREE.PointLight("#fff2dc", 10, 12, 1.4); bookL.position.set(BOOK_X, 3.1, 0.8); set.add(bookL);
    const cell = cloneWithColors(models.lawCell);
    set.add(cell);
    const gate = findNodes(cell, "Gate")[0];
    const book = cloneWithColors(models.lawBooking);
    book.position.x = BOOK_X;
    set.add(book);
    const flashNode = findNodes(book, "Flash")[0];
    let flashMat = null;
    if (flashNode) flashNode.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); flashMat = o.material; } });
    // tally marks scratched into the left wall (groups of five)
    const tallyGeo = set.own(new THREE.BoxGeometry(0.012, 0.16, 0.012));
    const tallyMat = set.own(new THREE.MeshStandardMaterial({ color: "#e8e4d8", roughness: 0.9 }));
    const tally = new THREE.InstancedMesh(tallyGeo, tallyMat, 150);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 150; i++) {
        const grp = Math.floor(i / 5), k = i % 5, row = Math.floor(grp / 6), col = grp % 6;
        const z0 = -0.7 - col * 0.36, y0 = 2.2 - row * 0.24;
        if (k < 4) { pos.set(-2.06, y0, z0 - k * 0.05); e.set(0, 0, 0); sc.set(1, 1, 1); }
        else { pos.set(-2.055, y0, z0 - 0.075); e.set(1.0, 0, 0); sc.set(1, 1.35, 1); }
        q.setFromEuler(e); m4.compose(pos, q, sc);
        tally.setMatrixAt(i, m4);
    }
    tally.count = 0;
    tally.castShadow = false;
    set.add(tally);
    // the tunnel hole (pudding-spoon escape)
    const hole = new THREE.Mesh(set.own(new THREE.CircleGeometry(0.6, 20)), set.own(new THREE.MeshBasicMaterial({ color: "#120d09" })));
    hole.rotation.x = -Math.PI / 2; hole.position.set(8.6, 0.015, 2.1); hole.visible = false; set.add(hole);
    const dirt = new THREE.Mesh(set.own(new THREE.TorusGeometry(0.66, 0.12, 6, 18)), set.own(new THREE.MeshStandardMaterial({ color: "#5D4037", roughness: 1 })));
    dirt.rotation.x = -Math.PI / 2; dirt.position.copy(hole.position); dirt.visible = false; set.add(dirt);
    const cart = cloneWithColors(models.lawCart);
    cart.visible = false; set.add(cart);
    // the cast
    const me = lulu(true);
    set.add(me.obj);
    const mate = person("lawCellmate", null, "npcMan");
    set.add(mate.obj);
    const guard = person("copPerson", null, "npcMan");
    set.add(guard.obj);
    // her booking placard
    const placard = textPlane(["BRUCK, L.", "#0613"], { w: 0.56, h: 0.32, bg: "#ffffff", fg: "#1a1a1a", font: 96 });
    set.add(placard);
    const keyMesh = new THREE.Mesh(set.own(new THREE.TorusGeometry(0.05, 0.012, 6, 12)), set.own(new THREE.MeshStandardMaterial({ color: "#FFD54F", metalness: 0.9, roughness: 0.3 })));
    keyMesh.visible = false; set.add(keyMesh);
    const capMesh = new THREE.Mesh(set.own(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 14)), set.own(new THREE.MeshStandardMaterial({ color: "#1A237E", roughness: 0.6 })));
    capMesh.visible = false; me.obj.add(capMesh); capMesh.position.set(0, 1.86, 0);
    // a beard that grows with the sentence (the 2D gag)
    const beard = new THREE.Mesh(set.own(new THREE.SphereGeometry(0.13, 12, 8)), set.own(new THREE.MeshStandardMaterial({ color: "#5D4037", roughness: 0.9 })));
    beard.position.set(0, 1.42, 0.12); beard.scale.set(1, 0.001, 0.7); beard.visible = false; me.obj.add(beard);
    // a book for "reading the rulebook"
    const bookProp = new THREE.Mesh(set.own(new THREE.BoxGeometry(0.22, 0.03, 0.3)), set.own(new THREE.MeshStandardMaterial({ color: "#8E2424", roughness: 0.8 })));
    bookProp.visible = false; set.add(bookProp);
    J = { set, cell, gate, book, flashMat, tally, hole, dirt, cart, me, mate, guard, placard, keyMesh, capMesh, beard, bookProp, shot: new Shot(set.camera), placardFor: "" };
    return J;
}
function jailShow() { if (!J) buildJail(); J.set.show(); J.shot.cut(); resetCast(); return J; }
/** Undo any jailbreak staging (crouch, faint, vent, props). */
function resetCast() {
    const j = J;
    j.me.obj.scale.setScalar(1); j.me.obj.rotation.set(0, 0, 0); j.me.obj.visible = true;
    j.capMesh.visible = j.keyMesh.visible = j.cart.visible = j.hole.visible = j.dirt.visible = j.bookProp.visible = false;
    if (j.gate) j.gate.rotation.y = 0;
    j.guard.obj.rotation.set(0, 0, 0);
}

function setPlacard(inmate) {
    if (J.placardFor === inmate) return;
    J.placardFor = inmate;
    const old = J.placard;
    const p = textPlane(["BRUCK, L.", inmate], { w: 0.56, h: 0.32, bg: "#ffffff", fg: "#1a1a1a", font: 96 });
    J.set.scene.remove(old); old.geometry.dispose(); old.material.map.dispose(); old.material.dispose();
    J.set.add(p); J.placard = p;
}

// ── state ────────────────────────────────────────────────────────────────
let st = null, flow = null;
const _v = new THREE.Vector3();

/** Book her (the 2D goToJail): pull in open warrants, maybe an extra charge, bail from the bounty. */
function book(charges) {
    let list = charges && charges.length ? charges.slice() : ["DISTURBING THE PEACE"];
    list = list.concat(S.wanted);
    if (Math.random() < 0.5) list.push(pick(EXTRA_CHARGES));
    list = list.filter((c, i) => list.indexOf(c) === i);
    bump("offenses", 1);
    const bail = bailFor(list);
    const j = { charges: list, bail, inmate: "#" + randInt(1000, 9999), escFails: 0, escUsed: false, abba: Math.random() < 0.35 };
    saveLockup("cell", list, bail, 0, 30, 0, 0, false, { abba: j.abba, mode3d: run.mode, inmate: j.inmate });
    stat("booked", 1);
    return j;
}

registerState("lawJail", {
    hud: false, touch: false, pausable: true, world: false,
    enter(data) {
        document.body.classList.add("law-scene");
        UI.hideAll();
        st = { data, phase: "load", t: 0, cellmateT: 2.5, guardT: 0, courtT: 22, j: null, serve: null, lock: null, esc: null, sResume: data.sResume };
        A.setMusic("../prison.mp3");
        flow = runFlow(f => main(f, data));
    },
    exit() {
        if (flow) flow.kill();
        flow = null;
        document.body.classList.remove("law-scene");
        UI.hideAll();
        H.hideScreen();
        if (ext) { ext.set.hide(); frameFor(ext.set.camera, 0); }
        if (J) { J.set.hide(); frameFor(J.set.camera, 0); }
        window.removeEventListener("pointerdown", onTapAnywhere);
        st = null;
    },
    update(dt, P) {
        if (!st) return;
        st.t += dt;
        if (st.tapped) { P = Object.assign({}, P, { confirm: true, tap: true }); st.tapped = false; }
        if (H.screenOpen()) H.menuInput(P);
        if (flow) flow.tick(dt, st.phase === "pick" || st.phase === "serve" ? {} : P);
        if (st.phase === "pick") updatePick(dt, P);
        else if (st.phase === "serve") updateServe(dt, P);
        else if (st.phase === "cell" || st.phase === "lawyer") updateCell(dt);
        animate(dt);
    },
});

let tapArmed = false;
function onTapAnywhere(e) {
    if (!st || !tapArmed) return;
    if (e.target && e.target.closest && e.target.closest("button, #screenCard, #dialog")) return;
    st.tapped = true;
}

async function main(f, data) {
    if (!JAIL_KEYS.every(k => models[k])) {
        UI.caption("🚓 PRECINCT 18½", "Booking you in…");
        try { await ensureModels(JAIL_KEYS); } catch (e) { console.warn("[law] jail models", e); }
        check(f);
        UI.caption("");
    }
    window.addEventListener("pointerdown", onTapAnywhere);
    if (data.serve) { await serveTime(f, data.serve); return; }
    if (data.resume) {
        const lk = data.resume;
        st.j = { charges: lk.charges && lk.charges.length ? lk.charges : ["DISTURBING THE PEACE"], bail: lk.bail || 60, inmate: lk.inmate || "#" + randInt(1000, 9999),
            escFails: lk.escFails || 0, escUsed: !!lk.escUsed, abba: !!lk.abba };
        await cellPhase(f);
        return;
    }
    if (data.arrive) await arrive(f);
    check(f);
    st.j = book(data.charges);
    emit("law:booked", { charges: st.j.charges, bail: st.j.bail });
    await intake(f);
    await cellPhase(f);
}

// ── arriving at the precinct ─────────────────────────────────────────────
async function arrive(f) {
    st.phase = "arrive";
    const e = extShow();
    e.courtSign.visible = false;
    e.lcar.visible = false;
    e.cruiser.visible = true;
    e.cruiser.position.set(34, 0, 8.1); e.cruiser.rotation.y = -Math.PI / 2;
    st.cruiseV = 16;
    st.ext = { mode: "arrive" };
    UI.caption("🏛️ PRECINCT 18½", "Booking & intake");
    UI.header("🚨 UNDER ARREST 🚨");
    e.shot.set(V(11, 3.6, 19), V(2, 1.8, 6), 48).cut();
    await f.until(() => st.ext.stopped, 6);
    check(f);
    // out of the cruiser and up the steps
    const l = lulu(false), cop = person("copPerson", null, "npcMan");
    l.obj.position.set(-0.6, 0, 6.9); cop.obj.position.set(-1.9, 0, 6.8);
    const cf = cuffs(); l.obj.add(cf); cf.position.set(0, 0.86, 0.2);
    e.set.add(l.obj, cop.obj);
    X.doorThunk();
    st.ext.walkers = [{ p: l, x: -0.3, z: 0.4, speed: 1.6 }, { p: cop, x: 0.7, z: 0.6, speed: 1.6 }];
    e.shot.set(V(5.5, 2.6, 13.5), V(0, 1.6, 3), 46);
    await f.until(() => st.ext.walkers.every(w => w.done), 8);
    await f.sleep(0.3);
    check(f);
    UI.fadeTo(true, 500);
    await f.sleep(0.55);
    check(f);
    e.set.scene.remove(l.obj, cop.obj);
    disposeCuffs(cf);
    e.set.hide();
    UI.header(""); UI.caption("");
    st.ext = null;
}

// ── booking & intake (the mugshot) ───────────────────────────────────────
async function intake(f) {
    st.phase = "intake";
    const j = jailShow();
    setPlacard(st.j.inmate);
    UI.fadeTo(false, 400);
    const me = j.me;
    me.obj.position.set(BOOK_X, 0, -2.25); me.obj.rotation.set(0, 0, 0);
    j.mate.obj.visible = false; j.guard.obj.visible = false;
    st.pose = { who: "intake" };
    j.shot.set(V(BOOK_X + 0.15, 1.42, 1.25), V(BOOK_X, 1.25, -2.4), 42).cut();
    UI.caption("📸 BOOKING & INTAKE", `Inmate ${st.j.inmate} — say cheese!`);
    X.cellSlam();
    await f.sleep(1.0, false);
    snap();
    await f.sleep(0.8);
    st.pose.profile = true;   // turn to the side…
    await f.sleep(0.5);
    snap();
    await f.sleep(1.0, true);
    check(f);
    UI.caption("");
}
function snap() {
    X.shutter();
    UI.flashWhite();
    rumble(0.1, 0.3, 60);
    if (J.flashMat) { J.flashMat.emissiveIntensity = 14; setTimeout(() => { if (J && J.flashMat) J.flashMat.emissiveIntensity = 0.6; }, 140); }
}

// ── the cell: escape / bail / lawyer / court ─────────────────────────────
function cellShot() {
    J.shot.set(V(-0.9, 1.75, 5.4), V(0.25, 1.25, -1.9), 50);
}
async function cellPhase(f) {
    st.phase = "cell";
    const j = jailShow();
    UI.fadeTo(false, 400);
    j.mate.obj.visible = true; j.guard.obj.visible = true;
    j.me.obj.visible = true;
    if (j.gate) j.gate.rotation.y = 0;
    st.pose = { who: "bunk" };
    cellShot(); j.shot.cut();
    st.courtT = 22;
    st.cellmateT = 1.2;
    showCellMenu();
    await f.until(() => st.cellDone, 99999);
    check(f);
}
function cellMenuHtml() {
    const j = st.j, coins = wallet.coins;
    const locked = j.escUsed || j.escFails >= 1;
    const canBail = coins >= j.bail;
    return `<h2>🚔 BOOKED!</h2>
        <p class="fine2"><span class="coin"></span> <b>${coins.toLocaleString()}</b> coins · booked ${S.offenses}× · ${S.convictions} strike${S.convictions === 1 ? "" : "s"}${S.convictions >= 2 ? " ⚠️" : ""}</p>
        <div class="sheet"><b>— CHARGE SHEET —</b>${j.charges.map(c => "• " + c).join("<br>")}</div>
        <div class="law-grid">
            <button class="btn ${locked ? "locked" : ""}" id="lawEsc"><span class="lbl">${locked ? "🔒 Watched" : "🏃 Escape"}<small>${locked ? "the guard's onto you" : "pick the lock — one shot"}</small></span></button>
            <button class="btn gold ${canBail ? "" : "locked"}" id="lawBail"><span class="lbl">💰 Bail ${j.bail}<small>${canBail ? "out now · still WANTED" : "can't make bail 😬"}</small></span></button>
            <button class="btn teal" id="lawLawyer"><span class="lbl">🤵 Lawyer<small>${j.abba ? "Abba's around! ❤️" : "retain counsel"}</small></span></button>
            <button class="btn blue" id="lawCourtBtn"><span class="lbl">⚖️ Court<small>face the judge</small></span></button>
        </div>
        <p class="fine2" id="lawCourtT">⚖️ Court is called in ${Math.ceil(st.courtT)}s</p>`;
}
function showCellMenu(focusId) {
    st.phase = "cell";
    const card = H.showScreen(cellMenuHtml(), [], { focus: focusId || "lawEsc" });
    const on = (id, fn) => { const b = card.querySelector("#" + id); if (b) b.addEventListener("click", fn); };
    on("lawEsc", tryEscape);
    on("lawBail", tryBail);
    on("lawLawyer", showLawyers);
    on("lawCourtBtn", () => goCourt(null));
}
function tryEscape() {
    const j = st.j;
    if (j.escUsed || j.escFails >= 1) { X.deny(); UI.toast("The guard's WATCHING now — no more escapes! 👮", "red"); return; }
    // burn the one attempt the moment she commits (a refresh mid-pick can't rewind it)
    j.escUsed = true;
    saveLockup("cell", j.charges, j.bail, 0, 30, 0, j.escFails, true, { abba: j.abba, mode3d: run.mode, inmate: j.inmate });
    H.hideScreen();
    startPick();
}
function tryBail() {
    const j = st.j;
    if (!canAfford(j.bail)) { X.deny(); UI.toast("Can't make bail! 😬", "red"); return; }
    chargeCoins(j.bail);
    X.coins();
    // out on bail = released PENDING trial: the charges stay open, so she's still WANTED till court
    addWanted(j.charges);
    clearLockup();
    H.hideScreen();
    st.cellDone = true;
    emit("law:release", { how: "bail", paid: j.bail });
    setState("lawExit", { kind: "police", dest: "drive", caption: "💰 Out on bail — but still WANTED 'til court. 🚨", sResume: st.sResume });
}
// the pause overlay borrows the menu card — put ours back when she resumes
on("pause", ({ paused }) => {
    if (paused || !st || ctx.state !== "lawJail") return;
    if (st.phase === "cell") showCellMenu();
    else if (st.phase === "lawyer") showLawyers();
});
function showLawyers() {
    st.phase = "lawyer";
    const j = st.j, tiers = lawyerTiers(j.abba);
    const html = `<h2>🤵 Retain a lawyer</h2><p class="fine2"><span class="coin"></span> <b>${wallet.coins.toLocaleString()}</b> coins · fees scale with your charge sheet & strikes</p>`;
    const btns = tiers.map(t => {
        const fee = lawyerFee(t, j.charges.length), afford = t.free || wallet.coins >= fee;
        return { label: `<span class="lbl">${t.name} ${t.free ? "❤️ FREE" : "💰" + fee}<small>${t.tag}</small></span>`,
            cls: t.free ? "pink" : afford ? "teal" : "locked", action: () => hire(t, fee) };
    });
    btns.push({ label: `‹ Back ${glyph("back")}`, cls: "alt", action: () => showCellMenu("lawLawyer") });
    H.showScreen(html, btns, { onBack: () => showCellMenu("lawLawyer") });
}
function hire(tier, fee) {
    if (tier.free) { UI.toast(pick(ABBA_RETAIN_LINES), "gold"); X.chime(); goCourt(tier); return; }
    if (!canAfford(fee)) { X.deny(); UI.toast(`Can't afford ${tier.name}! 😬`, "red"); return; }
    chargeCoins(fee);
    X.coins();
    UI.toast(`🤵 ${tier.name} retained! −${fee}`, "green");
    goCourt(tier);
}
function goCourt(tier) {
    H.hideScreen();
    st.cellDone = true;
    setState("lawCourt", { charges: st.j.charges, lawyer: tier, sResume: st.sResume });
}
function updateCell(dt) {
    const j = J;
    st.courtT -= dt;
    const el = document.getElementById("lawCourtT");
    if (el) el.textContent = `⚖️ Court is called in ${Math.max(0, Math.ceil(st.courtT))}s`;
    if (st.courtT <= 0 && st.phase === "cell") { goCourt(null); return; }
    st.cellmateT -= dt;
    if (st.cellmateT <= 0) {
        st.cellmateT = rand(4, 7);
        const famous = S.escapes >= 2 && Math.random() < 0.5;
        UI.bubble("mate", j.mate.obj, famous ? pick(CELLMATE_FAMOUS) : pick(CELLMATE_LINES), { who: "CELLMATE", y: 2.0, sec: 3.4 });
        st.mateTalk = 3;
    }
    st.mateTalk = Math.max(0, (st.mateTalk || 0) - dt);
}

// ── the lockpick minigame ────────────────────────────────────────────────
function startPick() {
    const s = S.convictions, j = st.j;
    st.lock = {
        pins: 2 + Math.min(2, s) + Math.min(2, j.escFails), done: 0, pos: 0, dir: 1,
        speed: 0.48 + s * 0.06 + j.escFails * 0.10,
        zoneC: rand(0.25, 0.75), zoneW: Math.max(0.17, 0.36 - s * 0.025 - j.escFails * 0.025),
        misses: 0, maxMiss: 3, result: null, resultT: 0, missFx: 0, armT: 0.25,
    };
    st.phase = "pick";
    st.pose = { who: "pick" };
    J.shot.set(V(1.15, 1.5, 1.75), V(0.36, 1.18, 0.05), 40);
    tapArmed = true;
    X.blip("lulu");
}
function updatePick(dt, P) {
    const lk = st.lock;
    lk.missFx = Math.max(0, lk.missFx - dt);
    lk.armT -= dt;
    const hint = `${glyph("confirm")} when the pick is in the green!`;
    if (lk.result) {
        lk.resultT += dt;
        UI.lockpick(lk, hint);
        if (lk.result === "win" && lk.resultT > 1.0) { UI.lockpick(null); tapArmed = false; startEscape(); }
        else if (lk.result === "lose" && lk.resultT > 1.8) {
            UI.lockpick(null); tapArmed = false;
            const j = st.j;
            j.escFails++;
            if (!j.charges.includes("ATTEMPTED ESCAPE")) j.charges.push("ATTEMPTED ESCAPE");
            saveLockup("cell", j.charges, j.bail, 0, 30, 0, j.escFails, true, { abba: j.abba, mode3d: run.mode, inmate: j.inmate });
            UI.toast("CAUGHT! The guard's watching now. 👮", "red");
            st.pose = { who: "bunk" };
            cellShot();
            showCellMenu("lawBail");
        }
        return;
    }
    // hit-test FIRST against the needle as it was last drawn, then advance (one press = one pick)
    if ((P.confirm || P.interact) && lk.armT <= 0) {
        if (Math.abs(lk.pos - lk.zoneC) < lk.zoneW / 2) {
            lk.done++;
            X.pin(lk.done);
            rumble(0.1, 0.4, 60);
            if (lk.done >= lk.pins) { lk.result = "win"; lk.resultT = 0; X.unlock(); }
            else { lk.zoneC = rand(0.18, 0.82); lk.zoneW = Math.max(0.11, lk.zoneW * 0.86); lk.speed *= 1.05; }
        } else {
            lk.misses++; lk.missFx = 0.5;
            X.miss();
            rumble(0.5, 0.2, 120, true);
            UI.toast("✖ MISS!", "red");
            if (lk.misses >= lk.maxMiss) { lk.result = "lose"; lk.resultT = 0; X.caught(); }
        }
        UI.lockpick(lk, hint);
        return;
    }
    lk.pos += lk.dir * lk.speed * dt;
    if (lk.pos >= 1) { lk.pos = 1; lk.dir = -1; }
    if (lk.pos <= 0) { lk.pos = 0; lk.dir = 1; }
    UI.lockpick(lk, hint);
}

// ── the jailbreak vignette ───────────────────────────────────────────────
function startEscape() {
    const ev = (FORCE.escapeKind && JAIL_ESCAPES.find(e => e.kind === FORCE.escapeKind)) || pick(JAIL_ESCAPES);
    const cap = S.escapes > 0 && ev.alt && Math.random() < 0.7 ? pick(ev.alt) : ev.cap;
    st.esc = { kind: ev.kind, cap, t: 0 };
    st.phase = "escape";
    st.pose = { who: "escape" };
    const j = J;
    j.me.obj.position.set(0.1, 0, -0.7); j.me.obj.rotation.set(0, 0, 0); j.me.obj.scale.setScalar(1);
    j.cart.visible = ev.kind === "cart";
    j.capMesh.visible = ev.kind === "disguise";
    j.hole.visible = j.dirt.visible = ev.kind === "tunnel";
    j.keyMesh.visible = false;
    if (ev.kind === "cart") { j.cart.position.set(0.9, 0, 1.5); j.cart.rotation.y = Math.PI / 2; }
    if (ev.kind === "keys") { j.guard.obj.position.set(6.8, 0.05, 3.05); j.guard.obj.rotation.y = Math.PI; }
    if (ev.kind === "faint") { j.guard.obj.position.set(6.5, 0, 2.2); }
    UI.caption("🏃 JAILBREAK!", cap);
    X.unlock();
    flow = runFlow(f => escapeScript(f));
}
async function escapeScript(f) {
    await f.sleep(2.6);
    check(f);
    await f.sleep(1.6, true);
    check(f);
    // she's out — and the heat carries over / escalates with each prior break
    bump("escapes", 1);
    const escapes = S.escapes;
    const heat = Math.min(30, (escapes - 1) * 7);
    if (st.j && st.j.charges.length) addWanted(st.j.charges);
    saveLockup("fugitive", [], 0, 0, Math.max(8, 55 - heat), heat, 0, false, { mode3d: run.mode });
    stat("jailbreaks", 1);
    emit("law:release", { how: "escape" });
    UI.caption("");
    resumeDriving({ s: st.sResume, fugitive: true, banner: escapes > 1 ? `Break #${escapes} — they're FURIOUS now! 🚨` : "Cops will RECOGNIZE you..." });
    startFugitive(heat);
}

// ── serving the sentence ─────────────────────────────────────────────────
async function serveTime(f, sv) {
    const j = jailShow();
    UI.fadeTo(false, 400);
    const total = sv.total || sentenceDays();
    st.serve = { days: sv.days || 0, serveDays: sv.days || 0, total, rate: clamp(total / 110, 0.8, 1.5), tapCool: 0, act: 0, actT: rand(3.4, 5), clock: 0, banterT: 1.0, who: "mate", lifeT: 5, work: 0 };
    if (!sv.persisted) saveLockup("serving", [], 0, st.serve.days, total, 0, 0, false, { mode3d: run.mode });
    st.phase = "serve";
    st.pose = { who: "serve" };
    j.mate.obj.visible = true; j.guard.obj.visible = true; j.me.obj.visible = true;
    if (j.gate) j.gate.rotation.y = 0;
    j.shot.set(V(0.4, 1.9, 5.0), V(-0.4, 1.2, -1.6), 52).cut();
    tapArmed = true;
    X.cellSlam();
    await f.until(() => st.serve.days >= st.serve.total, 99999);
    check(f);
    tapArmed = false;
    // a modest, capped release fee (court costs) — skims only what she can afford
    const fees = chargeCoins(releaseFee(total));
    clearLockup();
    UI.progress(null); UI.caption("");
    emit("law:release", { how: "served", days: total, fees });
    // walks out of the jail doors — but her car's impounded, so she's on foot
    setState("lawExit", { kind: "jail", dest: "foot", caption: fees > 0 ? `⛓️ Time served · −${fees} 💰 court costs` : "⛓️ Time served — you're free!", footReason: "copWalk", sResume: st.sResume });
}
function updateServe(dt, P) {
    const sv = st.serve;
    sv.serveDays += dt * sv.rate;
    sv.clock += dt;
    sv.tapCool -= dt;
    sv.work = Math.max(0, sv.work - dt);
    if ((P.confirm || P.interact || P.honk || P.tap) && sv.tapCool <= 0 && sv.days < sv.total) {
        sv.serveDays += 1.4; sv.tapCool = 0.10; sv.work = 0.24;
        X.work(sv.days);
        rumble(0.05, 0.25, 40);
        if (Math.random() < 0.5) UI.toast("⛏️ +1 day", "gold");
    }
    const days = Math.min(sv.total, Math.floor(sv.serveDays));
    if (days !== sv.days) { sv.days = days; patchLockup({ days }); }
    sv.actT -= dt;
    if (sv.actT <= 0) { sv.act = (sv.act + 1) % SERVE_ACTS.length; sv.actT = rand(3.4, 5.0); sv.clock = 0; }
    sv.banterT -= dt;
    if (sv.banterT <= 0 && sv.days < sv.total) {
        sv.who = sv.who === "mate" ? "lulu" : "mate";
        sv.banterT = rand(3.6, 5.2);
        UI.bubble("banter", sv.who === "mate" ? J.mate.obj : J.me.obj, pick(sv.who === "mate" ? CELLMATE_LINES : LULU_CELL_LINES),
            { who: sv.who === "mate" ? "CELLMATE" : "LULU", y: 2.0, sec: 2.8 });
    }
    sv.lifeT -= dt;
    if (sv.lifeT <= 0) { sv.lifeT = rand(6, 9); UI.toast(pick(JAIL_LIFE), ""); }
    J.tally.count = Math.min(150, sv.days);
    UI.caption("⛓️ SERVING YOUR SENTENCE", SERVE_ACTS[sv.act]);
    UI.progress(sv.days / sv.total, `DAY ${sv.days} / ${sv.total} · mash ${glyph("confirm")} (or tap) to do your time · car impounded — you walk out free 🚶‍♀️`);
}

// ── animation of the cast ────────────────────────────────────────────────
function animate(dt) {
    const j = J;
    if (st.ext) animateExt(dt);
    if (!j || ctx.view !== j.set.view) {
        if (ext && ctx.view === ext.set.view) { ext.shot.update(dt); frameFor(ext.set.camera, 0); UI.updateBubbles(ext.set.camera); }
        return;
    }
    const me = j.me, mate = j.mate, guard = j.guard, t = st.t;
    const pose = st.pose || {};
    j.placard.visible = pose.who === "intake";
    j.bookProp.visible = false;
    j.beard.visible = pose.who === "serve";
    if (pose.who === "intake") {
        faceYaw(me, pose.profile ? Math.PI / 2 : 0, dt, 6);
        me.update(dt, {});
        _v.set(0, 1.02, 0.2).applyMatrix4(me.obj.matrixWorld);
        j.placard.position.copy(_v);
        j.placard.rotation.y = me.obj.rotation.y;
    } else if (pose.who === "bunk") {
        me.obj.position.set(1.15, 1.3, -1.55); me.obj.rotation.set(0, 0.2, 0);
        me.update(dt, { sit: true, talk: Math.sin(t * 0.7) > 0.85 });
    } else if (pose.who === "pick") {
        me.obj.position.set(0.32, 0, -0.42); me.obj.rotation.set(0, 0, 0);
        me.update(dt, { point: true });
    } else if (pose.who === "serve") {
        animateServe(dt);
    } else if (pose.who === "escape") {
        animateEscape(dt);
    }
    if (pose.who !== "escape" || st.esc.kind === "cart" || st.esc.kind === "vent" || st.esc.kind === "tunnel" || st.esc.kind === "disguise") {
        // the cellmate on the floor, the guard pacing the corridor
        mate.obj.position.set(-1.0, 0, -1.35);
        mate.face(me.obj.position.x, me.obj.position.z, dt, 3);
        mate.update(dt, { talk: (st.mateTalk || 0) > 0 || (st.serve && st.serve.who === "mate" && st.serve.banterT > 1.5) });
        if (!(pose.who === "escape" && st.esc.kind === "disguise")) {
            st.guardT += dt * 0.5;
            const gx = Math.sin(st.guardT) * 4.2;
            guard.obj.position.set(gx, 0, 2.3);
            guard.obj.rotation.y = Math.cos(st.guardT) >= 0 ? Math.PI / 2 : -Math.PI / 2;
            guard.update(dt, { walk: Math.abs(Math.cos(st.guardT)) * 2.1 });
        }
    }
    const portrait = window.innerWidth < window.innerHeight;
    frameFor(j.set.camera, H.screenOpen() ? (portrait ? 1 : 1) : 0);
    j.shot.update(dt);
    UI.updateBubbles(j.set.camera);
}
function animateServe(dt) {
    const j = J, sv = st.serve, me = j.me, t = sv.clock;
    j.beard.scale.set(1, 0.05 + Math.min(1, sv.days / sv.total) * 0.95, 0.7);
    me.obj.rotation.x = 0;
    const work = sv.work > 0;
    if (sv.act === 0) {             // jogging in place
        me.obj.position.set(0.1, Math.abs(Math.sin(t * 7)) * 0.06, -1.3);
        me.obj.rotation.y = 0.3;
        me.update(dt, { walk: 3.2 });
    } else if (sv.act === 1) {      // reading the rulebook on the lower bunk
        me.obj.position.set(1.0, 0.18, -1.7); me.obj.rotation.y = -0.6;
        me.update(dt, { sit: true });
        j.bookProp.visible = true;
        _v.set(0, 0.95, 0.3).applyMatrix4(me.obj.matrixWorld);
        j.bookProp.position.copy(_v); j.bookProp.rotation.set(-0.5, me.obj.rotation.y, 0);
    } else if (sv.act === 2) {      // prison blues
        me.obj.position.set(1.0, 0.18, -1.7); me.obj.rotation.y = -0.5;
        me.update(dt, { sit: true, talk: true });
        if (Math.random() < dt * 1.2) UI.bubble("blues", me.obj, pick(["♪", "♫", "♪ ♫"]), { y: 2.0, sec: 0.9 });
    } else if (sv.act === 3) {      // scratching a tally on the wall
        me.obj.position.set(-1.55, 0, -1.6); me.obj.rotation.y = -Math.PI / 2;
        me.update(dt, { point: true });
    } else {                        // pacing the cell
        const x = Math.sin(t * 1.3) * 1.1;
        me.obj.position.set(x, 0, -1.2);
        me.obj.rotation.y = Math.cos(t * 1.3) >= 0 ? Math.PI / 2 : -Math.PI / 2;
        me.update(dt, { walk: Math.abs(Math.cos(t * 1.3)) * 1.6 });
    }
    if (work) me.obj.position.y += 0.04;
}
function animateEscape(dt) {
    const j = J, e = st.esc, me = j.me, guard = j.guard;
    e.t += dt;
    const t = e.t, p = clamp(t / 3.0, 0, 1), ease = 1 - (1 - p) * (1 - p);
    // the gate swings open toward the corridor
    if (j.gate) j.gate.rotation.y += (-1.55 - j.gate.rotation.y) * Math.min(1, dt * 4);
    const path = (u) => {   // cell → gate → corridor → EXIT (x 10.4)
        if (u < 0.25) return [0.1, -0.7 + (u / 0.25) * 2.9];
        return [0.1 + ((u - 0.25) / 0.75) * 10.2, 2.2];
    };
    let shotX = me.obj.position.x;
    if (e.kind === "cart") {
        const [x, z] = path(ease);
        me.obj.position.set(x - 0.9, 0, z); me.obj.rotation.y = Math.PI / 2;
        me.obj.scale.set(1, 0.82, 1);   // crouched behind it
        me.update(dt, { walk: 2.4 });
        j.cart.position.set(Math.max(0.9, x), 0, Math.max(1.5, z)); j.cart.rotation.y = Math.PI / 2;
    } else if (e.kind === "disguise") {
        guard.obj.position.set(5.2, 0, 3.6); guard.obj.rotation.y = 0;
        guard.update(dt, { talk: true });
        const [x, z] = path(ease); me.obj.position.set(x, 0, z); me.obj.rotation.y = ease < 0.25 ? 0 : Math.PI / 2;
        me.update(dt, { walk: 1.8 });
    } else if (e.kind === "keys") {
        guard.obj.position.set(6.8, 0.05, 3.05); guard.obj.rotation.y = Math.PI;
        guard.update(dt, { sit: true });
        if (Math.random() < dt * 1.5) UI.bubble("zzz", guard.obj, "z z Z", { y: 1.8, sec: 1 });
        const u = p < 0.5 ? clamp(p / 0.5, 0, 1) * 0.62 : 0.62 + clamp((p - 0.5) / 0.5, 0, 1) * 0.38;
        const [x, z] = path(u); me.obj.position.set(x, 0, z); me.obj.rotation.y = u < 0.25 ? 0 : Math.PI / 2;
        me.update(dt, { walk: 1.6 });
        j.keyMesh.visible = p > 0.45;
        if (p > 0.45) { _v.set(0.25, 1.05, 0.2).applyMatrix4(me.obj.matrixWorld); j.keyMesh.position.copy(_v); j.keyMesh.rotation.y = t * 6; }
    } else if (e.kind === "faint") {
        if (p < 0.5) {   // swooned by the bars; the guard rushes in
            me.obj.position.set(0.2, 0.18, -0.9); me.obj.rotation.set(-Math.PI / 2, 0, 0);
            me.update(dt, {});
            walkTo(guard, 0.9, 0.9, 3.6, dt);
            if (Math.random() < dt * 2) UI.bubble("faint", me.obj, "😵", { y: 0.6, sec: 0.6 });
        } else {        // …and she BOLTS past him to the exit
            me.obj.rotation.x = 0;
            guard.face(me.obj.position.x, me.obj.position.z, dt);
            guard.update(dt, { cheer: false });
            if (Math.random() < dt * 2) UI.bubble("huh", guard.obj, "❓", { y: 2.0, sec: 0.6 });
            const u = 0.1 + clamp((p - 0.5) / 0.5, 0, 1) * 0.9;
            const [x, z] = path(u); me.obj.position.set(x, 0, z); me.obj.rotation.y = Math.PI / 2;
            me.update(dt, { walk: 4.5 });
        }
    } else if (e.kind === "vent") {
        const vx = 3.4, vz = 2.0;
        if (p < 0.55) { const u = clamp(p / 0.55, 0, 1) * 0.42; const [x, z] = path(u); me.obj.position.set(Math.min(x, vx), 0, z < 2.0 ? z : vz); me.update(dt, { walk: 2.4 }); me.obj.rotation.y = u < 0.25 ? 0 : Math.PI / 2; }
        else { const sk = clamp(1 - (p - 0.55) / 0.45, 0.05, 1); me.obj.position.set(vx, -(1 - sk) * 1.4, vz); me.obj.scale.setScalar(Math.max(0.3, sk)); me.obj.rotation.y += dt * 9; me.update(dt, { cheer: true }); }
    } else {   // tunnel
        const tx = 8.6, tz = 2.1;
        if (p < 0.5) { const u = clamp(p / 0.5, 0, 1) * 0.82; const [x, z] = path(u); me.obj.position.set(Math.min(x, tx), 0, z); me.update(dt, { walk: 2.4 }); me.obj.rotation.y = u < 0.25 ? 0 : Math.PI / 2; }
        else { const sk = clamp(1 - (p - 0.5) / 0.5, 0.15, 1); me.obj.position.set(tx, -(1 - sk) * 1.7, tz); me.update(dt, { cheer: true }); }
    }
    shotX = clamp(me.obj.position.x, 0, 8);
    J.shot.set(V(shotX - 2.4, 2.2, 5.7), V(shotX + 1.2, 1.0, 1.2), 58);
}

// ── exterior animation (cruiser arriving / Lulu driving off) ─────────────
function animateExt(dt) {
    const e = ext, s = st.ext;
    if (!e || !s) return;
    if (s.mode === "arrive" && !s.stopped) {
        const x = e.cruiser.position.x, stopX = -1.2;
        const v = x > 12 ? 16 : Math.max(0.8, (x - stopX) * 1.6);
        e.cruiser.position.x = Math.max(stopX, x - v * dt);
        setRig(e.crig, true, ctx.time);
        if (e.cruiser.position.x <= stopX + 0.01) { s.stopped = true; X.doorThunk(); }
        e.shot.set(V(e.cruiser.position.x + 10, 3.2, 19), V(e.cruiser.position.x - 2, 1.4, 7), 48);
    } else setRig(e.crig, true, ctx.time);
    for (const w of s.walkers || []) { if (!w.done && walkTo(w.p, w.x, w.z, w.speed, dt)) { w.done = true; if (w.then) w.then(); } else if (w.done) w.p.update(dt, {}); }
}

// ── walking out: lawExit ─────────────────────────────────────────────────
let xst = null, xflow = null;
registerState("lawExit", {
    hud: false, touch: false, pausable: true, world: false,
    enter(data) {
        UI.hideAll();
        xst = { data, t: 0, walkers: [], car: null };
        A.setMusic(data.dest === "foot" ? "../walking.mp3" : "../luludriving.mp3");
        xflow = runFlow(f => exitScript(f, data));
    },
    exit() {
        if (xflow) xflow.kill();
        xflow = null;
        UI.hideAll();
        if (ext) { ext.set.hide(); for (const w of (xst && xst.walkers) || []) ext.set.scene.remove(w.p.obj); }
        xst = null;
    },
    update(dt, P) {
        if (!xst) return;
        xst.t += dt;
        if (xflow) xflow.tick(dt, P);
        const e = ext;
        if (!e) return;
        for (const w of xst.walkers) { if (!w.done && walkTo(w.p, w.x, w.z, w.speed, dt)) w.done = true; else if (w.done) w.p.update(dt, { wave: w.wave }); }
        if (xst.drive) { xst.v = Math.min(18, (xst.v || 0) + dt * 7); e.lcar.position.x -= xst.v * dt; e.lcar.traverse(o => { if (o.name && o.name.startsWith("Wheel_")) o.rotation.x += xst.v * dt / 0.34; }); }
        e.shot.update(dt);
    },
});
async function exitScript(f, data) {
    try { await ensureModels(["lawStation", "copPerson"]); } catch (e) { /* ok */ }
    check(f);
    const e = extShow();
    UI.fadeTo(false, 400);
    e.courtSign.visible = data.kind === "court";
    e.cruiser.visible = data.kind !== "court";
    e.cruiser.position.set(9, 0, 8.1); e.cruiser.rotation.y = -Math.PI / 2;
    const drive = data.dest === "drive";
    e.lcar.visible = drive;
    e.lcar.position.set(-2.6, 0, 8.0); e.lcar.rotation.y = -Math.PI / 2;
    showDriverExt(false);
    const l = lulu(false);
    l.obj.position.set(0, 0.72, 0.2);
    e.set.add(l.obj);
    e.shot.set(V(7, 3.0, 17), V(-0.8, 1.6, 4), 46).cut();
    const quips = drive ? ["Let's ROLL. 🚗", "Outta here!", "Freedom smells like exhaust.", "Back to the road, baby."]
        : ["Walking it is. 🚶‍♀️", "No car? No problem.", "Free... and on foot. Ugh."];
    UI.caption(data.caption || "", pick(quips));
    // down the steps toward the curb
    const w1 = { p: l, x: 0, z: 3.2, speed: 1.6 };
    xst.walkers.push(w1);
    await f.until(() => w1.done, 5);
    check(f);
    l.obj.position.y = 0;
    const w2 = { p: l, x: drive ? -2.0 : 3, z: drive ? 6.85 : 6.0, speed: 1.8 };
    xst.walkers = [w2];
    e.shot.set(V(4.5, 2.4, 14), V(-1.8, 1.2, 7), 46);
    await f.until(() => w2.done, 5);
    check(f);
    if (drive) {
        l.obj.visible = false;
        showDriverExt(true);
        X.doorThunk();
        await f.sleep(0.4);
        xst.drive = true;
        e.shot.set(V(-3, 2.6, 15), V(-14, 1.2, 8), 50);
        await f.sleep(1.4, true);
    } else {
        w2.wave = true;
        await f.sleep(1.2, true);
    }
    check(f);
    UI.fadeTo(true, 600);
    await f.sleep(0.65);
    check(f);
    UI.caption("");
    UI.fadeTo(false, 500);
    if (drive) { resumeDriving({ s: data.sResume, banner: data.caption }); return; }
    // on foot: her car's impounded
    const foot = ctx.foot && ctx.foot.start;
    resumeDriving({ s: data.sResume, banner: data.caption, onPlaced: foot ? () => ctx.foot.start(data.footReason || "copWalk") : null });
}

export { extShow, jailShow };
/** test hook: the live jail scene state (lock, phase, serve…) */
export function jailDebug() { return st; }
