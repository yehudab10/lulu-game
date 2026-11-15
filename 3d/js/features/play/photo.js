// features/play — 📸 Photo mode (pause menu + title screen).
//
// It's a state ("playPhoto") with its own update, entered with a SOFT switch:
// the frozen state's exit()/enter() never run and no "state" event fires, so
// the run (or walk, cutscene, set…) is exactly as it was when you come back —
// camera, HUD, pause menu and all. If something else changes state meanwhile,
// our exit() hands the frozen state its own exit() so it can tidy up.
//
// A free orbit camera around Lulu (left stick / WASD / drag), zoom (L2·R2 /
// wheel / pinch / Z·X), raise/lower + dutch tilt (right stick / Shift+WASD /
// two-finger drag), colour filters (L1·R1 / Q·R), frames (□ / D-pad↑ / F),
// poses (△ / D-pad ←→ / C), hide UI (D-pad↓ / G / H), album (OPTIONS / Tab),
// ✕ / Enter saves: the 3D frame is rendered once and read straight back (no
// preserveDrawingBuffer), graded, framed, downloaded as a PNG, and a small JPEG
// thumbnail goes into the album (store("play").album, last 6).
import * as THREE from "three";
import { ctx, registerState, setState, addMenuItem, css, emit, on } from "../../core/ctx.js";
import { showPauseMenu } from "../../core/screens.js";
import { shared } from "../../core/save.js";
import { input, glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { SAVE, saveSoon, sfx, stat, ALBUM_MAX, lift, clamp } from "./common.js";
import { FILTERS, FRAMES, filterCss, applyMatrix, drawOverlay, compositeOverlay } from "./frames.js";
import { poseTarget, posesFor, setPose, updatePose, clearPose } from "./poses.js";

const PH = {
    on: false, saved: null, t: 0, lock: 0,
    target: new THREE.Vector3(), lookFrom: new THREE.Vector3(), look: new THREE.Vector3(),
    yaw: 0, pitch: 0.3, dist: 8, rise: 0, roll: 0,
    v: { yaw: 0, pitch: 0, zoom: 0, rise: 0, roll: 0 },
    filter: SAVE.filter | 0, frame: SAVE.frame | 0, pose: 0, poseKind: null,
    ui: true, wheel: 0, padPrev: false, info: null, overlayKey: "",
    lastPhoto: null, downloads: 0, snaps: 0, busy: false, subject: "car",
};

// ── state ──────────────────────────────────────────────────────────────────
registerState("playPhoto", {
    hud: false, touch: false, pausable: false, world: true, driving: false,
    exit(next) { if (PH.on) teardown(next, true); },
    update(dt, P) { photoUpdate(dt, P); },
    camera() { return true; },
});

/** Can photo mode open right now (from the pause menu / title)? */
export function canPhoto() {
    if (PH.on || ctx.dialogOpen || ctx.skipping || !ctx.renderer || !ctx.car) return false;
    const def = ctx.states[ctx.state];
    if (!def || ctx.state === "loading") return false;
    if (ctx.state === "title") return true;
    return !!def.pausable;
}

addMenuItem("pause", { id: "playPhoto", order: 12, cls: "pink", label: "📸 Photo mode", visible: canPhoto, action: () => openPhoto("pause") });
addMenuItem("title", { id: "playPhoto", order: 65, cls: "alt", label: "📸 Photo mode", action: () => openPhoto("title") });

const $ = id => document.getElementById(id);
export function openPhoto(from = "pause") {
    if (!canPhoto()) return false;
    const def = ctx.states[ctx.state];
    const camObj = ctx.view ? ctx.view.camera : ctx.camera;
    const st = ctx.cam && ctx.cam.state;
    const body = document.body.classList;
    PH.saved = {
        from, state: ctx.state, stateT: ctx.stateT, stateData: ctx.stateData, prevState: ctx.prevState, paused: ctx.paused,
        view: ctx.view, camObj, pos: camObj.position.clone(), quat: camObj.quaternion.clone(), up: camObj.up.clone(), fov: camObj.fov, zoom: camObj.zoom,
        cam: st ? { yaw: st.yaw, lookYaw: st.lookYaw, lookPitch: st.lookPitch, orbit: st.orbit, snap: st.snap, pos: st.pos.clone(), look: st.look.clone() } : null,
        carVisible: ctx.car.obj.visible,
        hudHidden: $("hud").classList.contains("hidden"), touchHidden: $("touch").classList.contains("hidden"),
        bodyTouch: body.contains("touch"), inPlay: body.contains("in-play"), titleMode: body.contains("title-mode"),
        canvasFilter: ctx.renderer.domElement.style.filter,
        world: def.world,
    };
    if (H.screenOpen()) H.hideScreen();
    ctx.paused = false;
    // the soft switch (see the header)
    ctx.states.playPhoto.world = def.world !== false;
    ctx.prevState = ctx.state;
    ctx.state = "playPhoto";
    ctx.stateT = 0;
    ctx.stateData = { from };
    H.showHud(false);
    $("touch").classList.add("hidden");
    body.remove("touch", "in-play", "title-mode");
    body.add("play-photo");
    A.sfxHorn(false);
    A.updateEngine(0, 0, 0, 0, false, false);
    if (!ctx.view && (def.driving || PH.saved.state === "title")) ctx.car.obj.visible = true;   // not mid-blink

    PH.on = true; PH.t = 0; PH.lock = 0.22; PH.ui = true; PH.wheel = 0;
    PH.padPrev = !!input.handbrake;
    for (const k in PH.v) PH.v[k] = 0;
    PH.poseKind = poseTarget(PH.saved.state);
    PH.pose = 0;
    PH.info = photoInfo();
    if (!FRAMES[PH.frame] || !frameOk(FRAMES[PH.frame])) PH.frame = 0;
    initCamera(camObj);
    ensureUI();
    ui.root.classList.remove("hidden");
    ui.ui.classList.remove("off");
    applyFilter();
    refreshUI();
    PH.overlayKey = "";
    emit("photo", { open: true, from });
    return true;
}

/** Back to exactly where we were (the pause menu, or the title). */
export function closePhoto() {
    if (!PH.on) return;
    const sv = PH.saved;
    teardown(sv.state, false);
    if (sv.state === "title") { setState("title"); return; }
    ctx.state = sv.state; ctx.stateT = sv.stateT; ctx.stateData = sv.stateData; ctx.prevState = sv.prevState;
    const body = document.body.classList;
    $("hud").classList.toggle("hidden", sv.hudHidden);
    $("touch").classList.toggle("hidden", sv.touchHidden);
    body.toggle("touch", sv.bodyTouch);
    body.toggle("in-play", sv.inPlay);
    body.toggle("title-mode", sv.titleMode);
    if (sv.paused) { ctx.paused = true; showPauseMenu(); }
    emit("photo", { open: false });
}

function teardown(next, external) {
    const sv = PH.saved;
    PH.on = false;
    clearPose();
    if (H.screenOpen()) H.hideScreen();
    if (ui) ui.root.classList.add("hidden");
    document.body.classList.remove("play-photo");
    ctx.renderer.domElement.style.filter = sv.canvasFilter || "";
    const c = sv.camObj;
    c.position.copy(sv.pos); c.quaternion.copy(sv.quat); c.up.copy(sv.up);
    c.fov = sv.fov; c.zoom = sv.zoom; c.updateProjectionMatrix();
    const st = ctx.cam && ctx.cam.state;
    if (st && sv.cam) {
        st.yaw = sv.cam.yaw; st.lookYaw = sv.cam.lookYaw; st.lookPitch = sv.cam.lookPitch; st.orbit = sv.cam.orbit; st.snap = sv.cam.snap;
        st.pos.copy(sv.cam.pos); st.look.copy(sv.cam.look);
    }
    ctx.car.obj.visible = sv.carVisible;
    SAVE.filter = PH.filter; SAVE.frame = PH.frame; saveSoon();
    if (external && next !== sv.state) {
        // someone else switched state under us: the frozen state is being left now
        const fdef = ctx.states[sv.state];
        if (fdef && fdef.exit) { try { fdef.exit(next); } catch (e) { console.error("[photo exit]", e); } }
    }
}

// ── the orbit camera ──────────────────────────────────────────────────────
const _v = new THREE.Vector3(), _dir = new THREE.Vector3();
function subjectPoint(out) {
    const kind = PH.poseKind;
    if (kind === "foot") { const o = ctx.foot.obj; return out.set(o.position.x, o.position.y + 1.0, o.position.z); }
    const def = ctx.states[PH.saved.state];
    if (!ctx.view && (kind === "car" || (def && def.driving) || PH.saved.state === "title")) {
        PH.subject = "car";
        return out.set(ctx.car.pos.x, lift.y + 0.85, ctx.car.pos.z);
    }
    // anything else: the spot the camera was looking at
    PH.subject = "view";
    const cam = PH.saved.camObj;
    cam.getWorldDirection(_dir);
    let t = 6;
    if (_dir.y < -0.05) t = clamp((cam.position.y - 0.9) / -_dir.y, 2, 20);
    return out.copy(cam.position).addScaledVector(_dir, t);
}
function initCamera(cam) {
    subjectPoint(PH.target);
    _v.subVectors(cam.position, PH.target);
    PH.dist = clamp(_v.length(), 1.6, 26);
    PH.yaw = Math.atan2(_v.x, _v.z);
    PH.pitch = clamp(Math.asin(clamp(_v.y / Math.max(0.001, _v.length()), -1, 1)), -0.12, 1.45);
    PH.rise = 0; PH.roll = 0;
    cam.getWorldDirection(_dir);
    PH.lookFrom.copy(cam.position).addScaledVector(_dir, _v.length());
}
function applyCamera() {
    const cam = PH.saved.camObj, T = PH.target;
    const cp = Math.cos(PH.pitch);
    cam.position.set(T.x + Math.sin(PH.yaw) * cp * PH.dist, T.y + PH.rise + Math.sin(PH.pitch) * PH.dist, T.z + Math.cos(PH.yaw) * cp * PH.dist);
    if (cam.position.y < 0.22) cam.position.y = 0.22;
    // glide from where the game camera was looking onto the subject
    const e = Math.min(1, PH.t / 0.45), k = e * e * (3 - 2 * e);
    PH.look.set(T.x, T.y + PH.rise, T.z).lerp(PH.lookFrom, 1 - k);
    cam.up.set(0, 1, 0);
    cam.lookAt(PH.look);
    if (PH.roll) cam.rotateZ(PH.roll);
}

// ── per frame ─────────────────────────────────────────────────────────────
const keys = new Set();
const KEYS = ["KeyZ", "KeyX", "Equal", "Minus", "NumpadAdd", "NumpadSubtract", "KeyH", "BracketLeft", "BracketRight"];
window.addEventListener("keydown", e => { if (PH.on && KEYS.includes(e.code)) { if (!keys.has(e.code)) keys.add("edge:" + e.code); keys.add(e.code); } });
window.addEventListener("keyup", e => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
const keyEdge = c => keys.delete("edge:" + c);
const dz = v => Math.abs(v) < 0.14 ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - 0.14) / 0.86, 1.4);
function pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = input.padIndex >= 0 ? pads[input.padIndex] : null;
    if (p && p.connected) return p;
    for (const q of pads) if (q && q.connected) return q;
    return null;
}
const bval = (gp, i) => gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0;

function photoUpdate(dt, P) {
    PH.t += dt;
    PH.lock = Math.max(0, PH.lock - dt);
    updatePose(dt);
    if (H.screenOpen()) { H.menuInput(P); applyCamera(); return; }      // the album card
    if (PH.lock > 0) P = {};
    const dev = input.device, gp = dev === "gamepad" ? pad() : null;
    const sq = !!input.handbrake && dev === "gamepad", sqEdge = sq && !PH.padPrev;
    PH.padPrev = sq;

    if (P.back) { if (!PH.ui) toggleUI(); else { closePhoto(); return; } }
    if (P.confirm) snap();
    if (P.tabPrev || keyEdge("BracketLeft")) cycleFilter(-1);
    if (P.tabNext || keyEdge("BracketRight")) cycleFilter(1);
    if (P.fire || sqEdge) cycleFrame(1);
    if (P.camera) cyclePose(1);
    if (dev === "gamepad" && P.navLeft) cyclePose(-1);
    if (dev === "gamepad" && P.navRight) cyclePose(1);
    if (P.item || keyEdge("KeyH")) toggleUI();
    if (P.start || P.map) { openAlbum(); return; }

    // sticks / keys → smoothed camera velocities
    let ox = 0, oy = 0, zoom = 0, rise = 0, roll = 0;
    if (gp) {
        ox = dz(gp.axes[0] || 0); oy = dz(gp.axes[1] || 0);
        zoom = bval(gp, 7) - bval(gp, 6);
        rise = -input.lookY * (1); roll = input.lookX;
    } else if (dev === "keyboard") {
        if (input.boost) { rise = -input.moveY; roll = input.moveX; }
        else { ox = input.moveX; oy = input.moveY; }
        zoom = (keys.has("KeyZ") || keys.has("Equal") || keys.has("NumpadAdd") ? 1 : 0) - (keys.has("KeyX") || keys.has("Minus") || keys.has("NumpadSubtract") ? 1 : 0);
    }
    const sm = Math.min(1, dt * 9), V = PH.v;
    V.yaw += (ox * 1.9 - V.yaw) * sm;
    V.pitch += (-oy * 1.1 - V.pitch) * sm;
    V.zoom += (zoom * 1.4 - V.zoom) * sm;
    V.rise += (rise * 1.6 - V.rise) * sm;
    V.roll += (roll * 0.8 - V.roll) * sm;
    PH.yaw += V.yaw * dt;
    PH.pitch = clamp(PH.pitch + V.pitch * dt, -0.12, 1.45);
    PH.dist = clamp(PH.dist * Math.exp(-(V.zoom * dt + PH.wheel)), 1.6, 26);
    PH.wheel = 0;
    PH.rise = clamp(PH.rise + V.rise * dt, -0.8, 4);
    PH.roll = clamp(PH.roll + V.roll * dt, -0.6, 0.6);
    applyCamera();
    drawLiveOverlay();
}

// ── tools ─────────────────────────────────────────────────────────────────
function frameOk(f) { return !f.needs || f.needs(PH.info || {}); }
function cycleFilter(dir) {
    PH.filter = (PH.filter + dir + FILTERS.length) % FILTERS.length;
    applyFilter();
    sfx.click();
    note(`${FILTERS[PH.filter].emoji} ${FILTERS[PH.filter].name}`);
    refreshUI();
}
function cycleFrame(dir) {
    for (let i = 0; i < FRAMES.length; i++) {
        PH.frame = (PH.frame + dir + FRAMES.length) % FRAMES.length;
        if (frameOk(FRAMES[PH.frame])) break;
    }
    sfx.click();
    note(`${FRAMES[PH.frame].emoji} ${FRAMES[PH.frame].name}`);
    refreshUI();
}
function cyclePose(dir) {
    const list = posesFor(PH.poseKind);
    if (!list.length) { note("Nobody to pose here 🙂"); return; }
    PH.pose = (PH.pose + dir + list.length) % list.length;
    setPose(PH.poseKind, list[PH.pose].id);
    sfx.click();
    note(`${list[PH.pose].emoji} ${list[PH.pose].name}`);
    refreshUI();
}
function toggleUI() {
    PH.ui = !PH.ui;
    ui.ui.classList.toggle("off", !PH.ui);
    if (!PH.ui) note("");
}
function applyFilter() {
    ctx.renderer.domElement.style.filter = filterCss(FILTERS[PH.filter]) === "none" ? (PH.saved.canvasFilter || "") : filterCss(FILTERS[PH.filter]);
    PH.overlayKey = "";
}

/** Where are we? (postcard + polaroid captions, the WANTED poster) */
function photoInfo() {
    const G = ctx.G || {}, s2 = shared.get();
    let place = "the open road";
    try {
        const st = ctx.journey && ctx.journey.stop ? ctx.journey.stop() : null;
        if (st) place = G.jArriving || /^arriv/.test(PH.saved ? PH.saved.state : "") ? st.nice : `the road to ${st.nice}`;
    } catch (e) { /* journey optional */ }
    if (PH.saved && /^foot/.test(PH.saved.state)) place = place === "the open road" ? "the sidewalk" : place;
    const now = new Date();
    const M = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][now.getMonth()];
    const wanted = ctx.law && ctx.law.wanted ? ctx.law.wanted : 0;
    const tickets = (G.tickets || 0), offenses = s2.offenses || 0, conv = s2.convictions || 0;
    const charges = [];
    if (tickets) charges.push(`SPEEDING ×${tickets}`);
    if (wanted) charges.push("EVADING THE POLICE");
    if (offenses) charges.push(`${offenses} TRIP${offenses > 1 ? "S" : ""} TO THE PRECINCT`);
    if (conv) charges.push(`${conv} CONVICTION${conv > 1 ? "S" : ""}`);
    charges.push("BEING TOO FABULOUS");
    return {
        place, who: "Lulu's Road Trip",
        dateShort: `${M} ${now.getDate()}`, year: String(now.getFullYear()),
        dateLong: now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        rap: tickets + offenses + conv + wanted > 0, charges: charges.join(" · "),
    };
}

// ── save the photo ────────────────────────────────────────────────────────
export function snap() {
    if (PH.busy) return null;
    PH.busy = true;
    let url = null;
    try {
        const r = ctx.renderer, v = ctx.view, canvas = r.domElement;
        applyCamera();
        // render one fresh frame and read it straight back (the buffer is valid until we yield)
        r.render(v ? v.scene : ctx.scene, v ? v.camera : ctx.camera);
        const W = canvas.width, Hh = canvas.height, k = Math.min(1, 1920 / Math.max(W, Hh));
        const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(Hh * k));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const g = c.getContext("2d");
        const f = FILTERS[PH.filter], fr = FRAMES[PH.frame];
        if (f.ops.length && typeof g.filter === "string") { g.filter = filterCss(f); g.drawImage(canvas, 0, 0, w, h); g.filter = "none"; }
        else { g.drawImage(canvas, 0, 0, w, h); if (f.ops.length) applyMatrix(g, w, h, f); }
        compositeOverlay(g, w, h, f, fr, PH.info);
        url = c.toDataURL("image/png");
        PH.lastPhoto = url;
        PH.snaps++;
        const d = new Date(), pad2 = n => String(n).padStart(2, "0");
        download(url, `lulu-road-trip-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.png`);
        const thumb = addToAlbum(c, w, h, f, fr);
        flash(thumb);
        sfx.shutter();
        rumble(0.15, 0.5, 90, true);
        note("📸 Saved! (and added to your album)");
        SAVE.photos++;
        saveSoon();
        stat("photos", 1);
        emit("photo:snap", { url });
    } catch (e) {
        console.error("[photo] save failed", e);
        note("😕 Couldn't save that one");
    }
    PH.busy = false;
    return url;
}
function download(url, name) {
    try {
        const a = document.createElement("a");
        a.href = url; a.download = name; a.rel = "noopener"; a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        PH.downloads++;
    } catch (e) { console.warn("[photo] download blocked", e); }
}
function addToAlbum(c, w, h, f, fr) {
    const T = 240, tw = w >= h ? T : Math.round(T * w / h), th = w >= h ? Math.round(T * h / w) : T;
    const t = document.createElement("canvas");
    t.width = tw; t.height = th;
    const g = t.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(c, 0, 0, tw, th);
    let img = t.toDataURL("image/jpeg", 0.62);
    if (img.length > 24000) img = t.toDataURL("image/jpeg", 0.42);   // keep localStorage small
    SAVE.album.unshift({ img, t: Date.now(), place: PH.info.place, filter: f.id, frame: fr.id });
    if (SAVE.album.length > ALBUM_MAX) SAVE.album.length = ALBUM_MAX;
    return img;
}

// ── the album (a regular controller-navigable card) ───────────────────────
function albumHtml() {
    const list = SAVE.album;
    const items = list.map((p, i) => {
        const d = new Date(p.t);
        return `<button class="pp-th nav" data-i="${i}"><img src="${p.img}" alt=""><span>${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${esc(p.place || "")}</span></button>`;
    }).join("");
    return `<h2>📒 Lulu's Photo Album</h2>
        <p class="fine">Your last ${ALBUM_MAX} snaps live here on this device · full-size PNGs go to your downloads.</p>
        ${list.length ? `<div class="pp-album">${items}</div>` : `<p class="pp-empty">No photos yet — press ${glyph("confirm")} to snap one!</p>`}`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function openAlbum(focus = 0) {
    ui.ui.classList.add("off");
    const card = H.showScreen(albumHtml(), [
        { label: "🎯 Reset camera", cls: "alt", action: () => { initCamera(PH.saved.camObj); closeAlbum(); } },
        { label: `📸 Back to the camera ${glyph("back")}`, action: closeAlbum },
    ], { onBack: closeAlbum, wide: true, focus });
    card.querySelectorAll(".pp-th").forEach(b => b.addEventListener("click", () => viewPhoto(+b.dataset.i)));
}
function closeAlbum() { H.hideScreen(); ui.ui.classList.toggle("off", !PH.ui); refreshUI(); }
function viewPhoto(i) {
    const p = SAVE.album[i];
    if (!p) return openAlbum();
    const d = new Date(p.t);
    H.showScreen(`<h2>📸 ${esc(p.place || "Road trip")}</h2>
        <div class="pp-view"><img src="${p.img}" alt=""></div>
        <p class="fine">${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · ${esc(p.filter)} · ${esc(p.frame)}</p>`, [
        { label: "⬇ Save this one", action: () => { download(p.img, `lulu-album-${i + 1}.jpg`); note("⬇ Saved"); } },
        { label: "🗑 Delete", cls: "pink", action: () => { SAVE.album.splice(i, 1); saveSoon(); openAlbum(); } },
        { label: `← Album ${glyph("back")}`, cls: "alt", action: () => openAlbum(i) },
    ], { onBack: () => openAlbum(i), wide: true });
}

// ── UI ────────────────────────────────────────────────────────────────────
css("play-photo", `
body.play-photo > :not(#scene):not(#screen):not(#pp-root):not(script):not(style) { visibility: hidden !important; }
#pp-root { position: fixed; inset: 0; font-family: var(--font); color: var(--ink); }
#pp-root.hidden { display: none; }
#pp-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#pp-catch { position: absolute; inset: 0; touch-action: none; cursor: grab; }
#pp-catch:active { cursor: grabbing; }
#pp-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
#pp-flash.go { animation: ppFlash .5s ease-out; }
@keyframes ppFlash { 0% { opacity: .95; } 100% { opacity: 0; } }
#pp-ui { position: absolute; inset: 0; pointer-events: none; transition: opacity .25s; }
#pp-ui.off { opacity: 0; } #pp-ui.off * { pointer-events: none !important; }
.pp-top { position: absolute; top: max(10px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); display: flex; gap: 6px;
  flex-wrap: wrap; max-width: 62vw; align-items: center; }
.pp-badge { background: rgba(20,16,30,.62); color: #fff; border-radius: 999px; padding: 5px 12px; font-weight: 700; letter-spacing: .08em; font-size: 13px; }
.pp-chip { background: var(--glass); border-radius: 999px; padding: 5px 11px; font-weight: 700; font-size: 13px; box-shadow: 0 2px 0 rgba(0,0,0,.15); white-space: nowrap; }
.pp-help { position: absolute; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 92px); left: 0; right: 0; text-align: center; color: #fff;
  font-size: 12px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,.7); padding: 0 12px; }
.pp-help .glyph { transform: scale(.85); }
.pp-note { position: absolute; left: 50%; top: calc(max(10px, env(safe-area-inset-top)) + 46px); transform: translateX(-50%);
  background: rgba(20,16,30,.72); color: #fff; border-radius: 999px; padding: 7px 16px; font-weight: 700; font-size: 15px; white-space: nowrap;
  opacity: 0; transition: opacity .25s; }
.pp-note.show { opacity: 1; }
.pp-bar { position: absolute; left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; gap: 6px;
  align-items: center; justify-content: center; flex-wrap: wrap; pointer-events: auto; background: rgba(20,16,30,.38); padding: 6px 9px;
  border-radius: 22px; width: max-content; max-width: calc(100vw - 20px); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.pp-btn { border: none; background: rgba(255,255,255,.94); color: var(--ink); border-radius: 14px; min-width: 60px; padding: 5px 8px 4px;
  font: 700 11px var(--font); display: flex; flex-direction: column; align-items: center; gap: 1px; cursor: pointer;
  box-shadow: 0 3px 0 rgba(0,0,0,.22); pointer-events: auto; }
.pp-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,.22); }
.pp-btn .e { font-size: 19px; line-height: 1.15; }
.pp-btn .l { max-width: 86px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-btn .glyph { min-width: 19px; height: 17px; font-size: 10px; padding: 0 5px; }
.pp-btn.snap { width: 70px; height: 70px; border-radius: 50%; justify-content: center; background: #fff;
  box-shadow: 0 0 0 4px #FF4FA3, 0 0 0 7px rgba(255,255,255,.85), 0 5px 12px rgba(0,0,0,.35); margin: 0 8px; }
.pp-btn.snap .e { font-size: 26px; }
.pp-btn.dim { opacity: .55; }
.pp-fly { position: absolute; left: 50%; top: 50%; width: 34vw; max-width: 380px; border: 6px solid #fff; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.35);
  transform: translate(-50%, -50%) rotate(-3deg); transition: transform .7s cubic-bezier(.5,-0.2,.3,1), opacity .7s ease-in; pointer-events: none; }
.pp-album { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0 4px; }
.pp-th { border: none; background: #fff; border-radius: 10px; padding: 6px 6px 4px; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.15);
  display: flex; flex-direction: column; gap: 4px; font: 600 12px var(--font); color: var(--ink); transform: rotate(-1deg); }
.pp-th:nth-child(even) { transform: rotate(1.2deg); }
.pp-th img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 4px; background: #eee; }
.pp-th span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-th.focus { outline: 4px solid #fff; box-shadow: 0 0 0 8px rgba(233,30,99,.55); transform: scale(1.05); }
.pp-view img { width: 100%; max-height: 52vh; object-fit: contain; border: 8px solid #fff; border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.25); background: #fff; }
.pp-empty { padding: 26px 0; opacity: .8; }
@media (max-width: 700px) {
  .pp-btn { min-width: 48px; padding: 5px 5px 4px; font-size: 10px; } .pp-btn .e { font-size: 18px; } .pp-btn .l { max-width: 60px; }
  .pp-btn .glyph { display: none; } .pp-btn.snap { width: 62px; height: 62px; order: -1; margin: 0 calc(50% - 31px) 4px; }
  .pp-album { grid-template-columns: repeat(2, 1fr); } .pp-help { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 150px); }
  .pp-top { max-width: calc(100vw - 20px); }
}
body.tv .pp-top { top: 3vh; left: 3vw; } body.tv .pp-badge, body.tv .pp-chip { font-size: 20px; padding: 8px 18px; }
body.tv .pp-help { font-size: 19px; bottom: calc(3vh + 132px); }
body.tv .pp-bar { bottom: 3vh; }
body.tv .pp-btn { min-width: 96px; font-size: 16px; border-radius: 18px; padding: 8px 12px 6px; } body.tv .pp-btn .e { font-size: 30px; }
body.tv .pp-btn .glyph { min-width: 28px; height: 26px; font-size: 14px; } body.tv .pp-btn .l { max-width: 130px; }
body.tv .pp-btn.snap { width: 104px; height: 104px; } body.tv .pp-btn.snap .e { font-size: 40px; }
body.tv .pp-note { font-size: 24px; top: calc(3vh + 70px); } body.tv .pp-th { font-size: 18px; }
`);

let ui = null;
function ensureUI() {
    if (ui) return ui;
    const root = document.createElement("div");
    root.id = "pp-root";
    root.className = "hidden";
    root.innerHTML = `<canvas id="pp-overlay"></canvas><div id="pp-catch"></div><div id="pp-flash"></div>
        <div id="pp-ui"><div class="pp-top"></div><div class="pp-help"></div><div class="pp-note"></div><div class="pp-bar"></div></div>`;
    // before #screen, so the album card (a normal screen) sits on top of us
    document.body.insertBefore(root, $("screen"));
    ui = { root, canvas: root.querySelector("#pp-overlay"), catcher: root.querySelector("#pp-catch"), flash: root.querySelector("#pp-flash"),
        ui: root.querySelector("#pp-ui"), top: root.querySelector(".pp-top"), help: root.querySelector(".pp-help"), note: root.querySelector(".pp-note"),
        bar: root.querySelector(".pp-bar"), noteT: 0 };
    ui.g = ui.canvas.getContext("2d");
    ui.bar.addEventListener("click", e => {
        const b = e.target.closest("[data-act]");
        if (!b || !PH.on || H.screenOpen()) return;
        e.stopPropagation();
        const a = b.dataset.act;
        if (a === "filterPrev") cycleFilter(-1);
        else if (a === "filterNext") cycleFilter(1);
        else if (a === "frame") cycleFrame(1);
        else if (a === "pose") cyclePose(1);
        else if (a === "snap") snap();
        else if (a === "album") openAlbum();
        else if (a === "hide") toggleUI();
        else if (a === "exit") closePhoto();
    });
    bindPointer(ui.catcher);
    return ui;
}
function btn(act, emoji, label, g, cls = "") {
    return `<button class="pp-btn ${cls}" data-act="${act}"><span class="e">${emoji}</span><span class="l">${label}</span>${g || ""}</button>`;
}
export function refreshUI() {
    if (!ui || !PH.on) return;
    const dev = input.device, gpad = dev === "gamepad", kb = dev === "keyboard", touch = dev === "touch";
    const G = (padAct, kbLabel) => touch ? "" : gpad ? glyph(padAct) : kbLabel ? `<span class="glyph k">${kbLabel}</span>` : glyph(padAct);
    const f = FILTERS[PH.filter], fr = FRAMES[PH.frame], poses = posesFor(PH.poseKind), po = poses[PH.pose];
    ui.top.innerHTML = `<span class="pp-badge">📸 PHOTO MODE</span><span class="pp-chip">${f.emoji} ${f.name}</span><span class="pp-chip">${fr.emoji} ${fr.name}</span>${po ? `<span class="pp-chip">${po.emoji} ${po.name}</span>` : ""}`;
    ui.help.innerHTML = gpad
        ? `${glyph("steer")} orbit · ${glyph("look")} height / tilt · ${glyph("brake")}${glyph("gas")} zoom`
        : kb ? `<span class="glyph k">WASD</span> orbit · <span class="glyph k">Shift</span>+<span class="glyph k">WASD</span> height / tilt · <span class="glyph k">Z</span><span class="glyph k">X</span> or wheel: zoom · drag with the mouse`
        : `Drag to orbit · pinch to zoom · two fingers ↕ height`;
    ui.bar.innerHTML =
        btn("filterPrev", "◀", "Filter", G("tabPrev", "Q")) +
        btn("filterNext", f.emoji, f.name, G("tabNext", "R")) +
        btn("frame", fr.emoji, "Frame", G("handbrake", "F")) +
        btn("pose", po ? po.emoji : "💃", "Pose", G("camera", "C"), poses.length ? "" : "dim") +
        btn("snap", "📸", "", G("confirm", "Enter"), "snap") +
        btn("album", "📒", `Album${SAVE.album.length ? " (" + SAVE.album.length + ")" : ""}`, G("pause", "Tab")) +
        btn("hide", "👁️", "Hide UI", G("item", "H")) +
        btn("exit", "✖", "Done", G("back", "Esc"));
}
on("device", () => refreshUI());

let noteTimer = 0;
function note(text) {
    if (!ui) return;
    clearTimeout(noteTimer);
    ui.note.textContent = text;
    ui.note.classList.toggle("show", !!text);
    if (text) noteTimer = setTimeout(() => ui.note.classList.remove("show"), 1500);
}
function flash(thumb) {
    const f = ui.flash;
    f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
    if (!thumb || ctx.TEST) return;
    const img = document.createElement("img");
    img.className = "pp-fly";
    img.src = thumb;
    ui.root.appendChild(img);
    const target = ui.bar.querySelector('[data-act="album"]');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        const r = target ? target.getBoundingClientRect() : { left: innerWidth - 80, top: innerHeight - 60, width: 40, height: 40 };
        const dx = r.left + r.width / 2 - innerWidth / 2, dy = r.top + r.height / 2 - innerHeight / 2;
        img.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(14deg) scale(0.12)`;
        img.style.opacity = "0.2";
    }));
    setTimeout(() => img.remove(), 900);
}

/** Wash + frame preview on the overlay canvas (redrawn only when something changes). */
function drawLiveOverlay() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    const key = `${w}x${h}|${PH.filter}|${PH.frame}`;
    if (key === PH.overlayKey) return;
    PH.overlayKey = key;
    if (ui.canvas.width !== w || ui.canvas.height !== h) { ui.canvas.width = w; ui.canvas.height = h; }
    drawOverlay(ui.g, w, h, FILTERS[PH.filter], FRAMES[PH.frame], PH.info);
}

// ── mouse / touch: drag to orbit, wheel / pinch to zoom, two fingers (or right-drag) for height ──
function bindPointer(el) {
    const pts = new Map();
    let pinch = 0, midY = 0, tap = null;
    el.addEventListener("contextmenu", e => e.preventDefault());
    el.addEventListener("pointerdown", e => {
        if (!PH.on) return;
        el.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey });
        tap = pts.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); midY = (a.y + b.y) / 2; }
    });
    el.addEventListener("pointermove", e => {
        const p = pts.get(e.pointerId);
        if (!p || !PH.on) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 1) {
            if (p.b === 2 || e.shiftKey) { PH.rise = clamp(PH.rise - dy * 0.012, -0.8, 4); PH.roll = clamp(PH.roll + dx * 0.003, -0.6, 0.6); }
            else { PH.yaw -= dx * 0.0065; PH.pitch = clamp(PH.pitch + dy * 0.0055, -0.12, 1.45); }
        } else if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y), my = (a.y + b.y) / 2;
            if (pinch > 0 && d > 0) PH.dist = clamp(PH.dist * pinch / d, 1.6, 26);
            PH.rise = clamp(PH.rise + (my - midY) * 0.012, -0.8, 4);
            pinch = d; midY = my;
        }
    });
    const up = e => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (tap && pts.size === 0 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8 && performance.now() - tap.t < 350 && !PH.ui) toggleUI();
        tap = null;
        if (pts.size < 2) pinch = 0;
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", e => { if (PH.on) { e.preventDefault(); PH.wheel += clamp(-e.deltaY * 0.0012, -0.25, 0.25); } }, { passive: false });
}

// test / debug access
export const photo = {
    get on() { return PH.on; }, get state() { return PH; },
    open: openPhoto, close: closePhoto, snap, cycleFilter, cycleFrame, cyclePose, openAlbum, canPhoto,
};
