// Unified input: game controller (Gamepad API), keyboard and touch all feed
// the same normalized controls, so the car code never cares which one you use.
//
// Controller layout (standard mapping, i.e. Xbox / PlayStation / Switch Pro /
// MFi pads in Chrome, Edge, Safari and Firefox):
//   Left stick ........ steer (analog)          D-pad ← → .. steer (digital)
//   RT / R2 ........... gas (analog)            A / ✕ ...... gas (button)
//   LT / L2 ........... brake / reverse         B / ○ ...... brake (button)
//   X / □ ............. handbrake (drift!)      Y / △ ...... change camera
//   RB / R1 ........... nitro boost             LB / L1 .... horn
//   Right stick ....... look around             R3 (click) . look behind
//   Start / Options ... pause                   View / Create  car radio (next station)
//   D-pad ↑ ........... fire (missile)          D-pad ↓ .... item (pepper spray / shield)
//   A / ✕ on foot ..... interact                Touchpad ... 📱 Lulu's phone (PlayStation)
//   L3 ................ PlayStation: the story map shortcut · Xbox / Switch (no touchpad): 📱 the phone
// ON FOOT (input.foot, set by features/foot) a few buttons change meaning — the car's never do:
//   B / ○ ............. JUMP (hold = higher)    X / □ ...... roll · slide · vault (features/moves)
//   Right stick ....... FREE LOOK (it stays)    R3 ......... camera back behind her
//   Y / △ ............. P.emote — RESERVED for the emote wheel (ci/hangout; tap = quick emote, hold = wheel)
//   keyboard: Space jump · C roll · B emote (reserved) · mouse drag look · V camera behind her
//   touch: the JUMP + ROLL buttons (#footPad), a drag anywhere on the picture looks around
// Look drag (mouse on desktop, a finger on a phone): input.lookDX / lookDY (radians this frame) in every state;
// core/camera.js turns it (and the right stick) into a camera that holds where the player leaves it.
// The phone edge (P.phone) also sets P.map: where there's no phone (title, pause menu,
// photo mode) the same button keeps its old "map · scrapbook · album" meaning.
// In menus: D-pad / stick move, A/✕ select, B/○ back, LB/RB switch tabs.
// Rumble: crashes, the rumble strips, off-road and nitro shake the controller
// (Chrome / Edge; Safari doesn't expose vibration yet).

const DEAD = 0.14;
const KEYMAP = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake",
    Space: "handbrake", ShiftLeft: "boost", ShiftRight: "boost", KeyN: "boost",
    KeyH: "honk", KeyC: "camera", KeyP: "pause", Escape: "pause", KeyV: "lookBack",
    KeyM: "fire", KeyF: "fire", KeyG: "item", KeyE: "interact", KeyQ: "tabPrev", KeyR: "tabNext",
    Tab: "phone", KeyU: "music", KeyT: "radio", KeyB: "emote",
    Enter: "confirm", NumpadEnter: "confirm", Backspace: "back",
    // PS5 / TV browsers and some remotes send these for the controller / remote
    BrowserBack: "back", GoBack: "back", MediaPlayPause: "pause", ContextMenu: "pause",
};
// Some TV / console browsers only report legacy keyCodes (no e.code).
const KEYCODES = { 37: "left", 38: "gas", 39: "right", 40: "brake", 13: "confirm", 27: "pause", 8: "back", 461: "back", 10009: "back", 415: "pause" };

const keys = new Set();
const keyEdges = new Set();
const touch = { steer: 0, moveY: 0, gas: false, brake: false, boost: false, honk: false, camEdge: false, edges: new Set(), held: new Set() };
// a look drag on the picture (mouse / finger): pixels since the last frame
const drag = { id: null, type: "", x: 0, y: 0, dx: 0, dy: 0, moved: 0, t0: 0 };
const LOOK_PX = { mouse: 0.0058, touch: 0.0095, pen: 0.0075 };      // radians per CSS pixel
let prevButtons = [];
let navRepeat = { dir: 0, t: 0 };

export const input = {
    // continuous
    steer: 0, throttle: 0, brake: 0, handbrake: false, boost: false, honkHeld: false,
    lookX: 0, lookY: 0, lookBack: false,
    // a look DRAG this frame (radians, mouse / finger on the picture) and whether one is held right now
    lookDX: 0, lookDY: 0, lookDrag: false,
    // on foot (features/foot sets it): Space / ○ / B jump, C / □ / X roll, △ / Y emote — see the header
    foot: false, jumpHeld: false, rollHeld: false, emoteHeld: false,
    // 2-D movement (left stick / WASD / arrows / touch stick): on foot, Dina, menus
    moveX: 0, moveY: 0,
    interactHeld: false, fireHeld: false, backHeld: false,
    // edge-triggered, valid for the frame after update(): confirm back up down navLeft
    // navRight start pause honk camera boost fire item interact map phone tabPrev tabNext music radio
    // + on foot: jump roll emote recentre
    pressed: {},
    // which device the player is using right now: "keyboard" | "gamepad" | "touch"
    device: "keyboard",
    padConnected: false, padName: "", padKind: "xbox", padIndex: -1,
    onDeviceChange: null,
    onPadChange: null,
};

function setDevice(d) {
    if (input.device !== d) {
        input.device = d;
        if (input.onDeviceChange) input.onDeviceChange(d);
    }
}

function padKindFor(id) {
    if (/054c|playstation|dualshock|dualsense|ps[345]/i.test(id)) return "ps";
    if (/057e|nintendo|pro controller|joy-?con/i.test(id)) return "nintendo";
    return "xbox";
}

function activePad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (input.padIndex >= 0 && pads[input.padIndex] && pads[input.padIndex].connected) return pads[input.padIndex];
    for (const p of pads) if (p && p.connected) { input.padIndex = p.index; return p; }
    return null;
}

function refreshPadInfo() {
    const p = activePad();
    const was = input.padConnected;
    input.padConnected = !!p;
    input.padName = p ? p.id.replace(/\s*\(.*?\)\s*/g, " ").trim() || "Controller" : "";
    input.padKind = p ? padKindFor(p.id) : "xbox";
    if (was !== input.padConnected && input.onPadChange) input.onPadChange(input.padConnected);
}

window.addEventListener("gamepadconnected", e => {
    input.padIndex = e.gamepad.index;
    refreshPadInfo();
    setDevice("gamepad");
});
window.addEventListener("gamepaddisconnected", e => {
    if (e.gamepad.index === input.padIndex) input.padIndex = -1;
    refreshPadInfo();
    if (!input.padConnected) setDevice(matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard");
});

function keyAction(e) { return KEYMAP[e.code] || KEYMAP[e.key] || (!e.code ? KEYCODES[e.keyCode] : undefined); }
window.addEventListener("keydown", e => {
    const a = keyAction(e);
    if (a) {
        if (!keys.has(a)) keyEdges.add(a);
        keys.add(a);
        // don't hijack typing in a text box (save codes, room codes…)
        if (!(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) e.preventDefault();
    }
    if (!input.tvKeys) setDevice("keyboard");
});
window.addEventListener("keyup", e => {
    const a = keyAction(e);
    if (a) keys.delete(a);
});
window.addEventListener("blur", () => keys.clear());

// ── touch controls ─────────────────────────────────────────────────────
const TOUCH_DEAD = 0.08;      // the touch stick's dead zone (of its 60 px reach)
export function bindTouch() {
    const zone = document.getElementById("stickZone");
    const knob = document.getElementById("stickKnob");
    const base = document.getElementById("stickBase");
    let stickId = null, cx = 0;
    zone.addEventListener("pointerdown", e => {
        stickId = e.pointerId;
        try { zone.setPointerCapture(e.pointerId); } catch (er) { /* (a pointer the browser already let go of: steer anyway) */ }
        const r = base.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        moveStick(e);
        setDevice("touch");
    });
    let cy = 0;
    const moveStick = e => {
        if (e.pointerId !== stickId) return;
        const dx = Math.max(-60, Math.min(60, e.clientX - cx));
        const dy = Math.max(-60, Math.min(60, e.clientY - cy));
        // (a small dead zone — a thumb resting on the stick's middle drifted her / the car a little; the pads have one too.
        //  Past it the value is rescaled, so a full push is still 1; ci/sweep-phone)
        const m = Math.hypot(dx, dy) / 60, k = m <= TOUCH_DEAD ? 0 : (m - TOUCH_DEAD) / (1 - TOUCH_DEAD) / m;
        touch.steer = dx / 60 * k;
        touch.moveY = dy / 60 * k;
        knob.style.transform = `translate(${dx}px, ${input.stick2d ? dy : 0}px)`;
    };
    zone.addEventListener("pointermove", moveStick);
    const endStick = e => {
        if (e.pointerId !== stickId) return;
        stickId = null; touch.steer = 0; touch.moveY = 0; knob.style.transform = "";
    };
    zone.addEventListener("pointerup", endStick);
    zone.addEventListener("pointercancel", endStick);

    const hold = (id, key) => {
        const el = document.getElementById(id);
        const on = e => { e.preventDefault(); touch[key] = true; el.classList.add("down"); setDevice("touch"); };
        const off = () => { touch[key] = false; el.classList.remove("down"); };
        el.addEventListener("pointerdown", on);
        el.addEventListener("pointerup", off);
        el.addEventListener("pointercancel", off);
        el.addEventListener("pointerleave", off);
    };
    hold("tGas", "gas");
    hold("tBrake", "brake");
    hold("tBoost", "boost");
    hold("tHonk", "honk");
    document.getElementById("tCam").addEventListener("pointerdown", e => {
        e.preventDefault(); touch.camEdge = true; setDevice("touch");
    });
    // on foot: JUMP + ROLL (shown by body.onfoot — features/foot)
    for (const [id, act] of [["tJump", "jump"], ["tRoll", "roll"]]) {
        const el = document.getElementById(id);
        if (!el) continue;
        const on = e => { e.preventDefault(); touch.edges.add(act); touch.held.add(act); el.classList.add("down"); setDevice("touch"); };
        const off = () => { touch.held.delete(act); el.classList.remove("down"); };
        el.addEventListener("pointerdown", on);
        el.addEventListener("pointerup", off);
        el.addEventListener("pointercancel", off);
        el.addEventListener("pointerleave", off);
    }
    bindLookDrag();
    window.addEventListener("touchstart", () => setDevice("touch"), { passive: true });
}

/** Drag the picture to look around: the mouse on a desktop (any button), a finger on a phone (anywhere on the
 *  picture — the stick, the pedals and every button are their own elements, so they never start a look). */
function bindLookDrag() {
    const cv = document.getElementById("scene");
    if (!cv) return;
    cv.addEventListener("pointerdown", e => {
        if (drag.id != null && drag.type === "touch" && e.pointerType === "touch") return;     // (a 2nd finger: moves' tap-the-road)
        drag.id = e.pointerId; drag.type = e.pointerType || "mouse";
        drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; drag.t0 = performance.now();
        if (drag.type === "mouse") { try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } }
    }, { passive: true });
    cv.addEventListener("pointermove", e => {
        if (e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        if (drag.moved < 6) return;            // (a tap stays a tap)
        drag.dx += dx; drag.dy += dy;
        setDevice(drag.type === "touch" ? "touch" : "keyboard");
    }, { passive: true });
    const end = e => { if (e.pointerId === drag.id) { drag.id = null; } };
    cv.addEventListener("pointerup", end, { passive: true });
    cv.addEventListener("pointercancel", end, { passive: true });
    cv.addEventListener("contextmenu", e => { if (input.foot) e.preventDefault(); });
}
/** Did the last finger / mouse press on the picture turn into a look drag? (moves asks before a tap-the-road roll) */
export function lookDragged() { return drag.moved >= 6; }

/**
 * Feature touch buttons (missile, pepper spray, interact hand…), shown in a
 * column above the pedals while their `visible()` returns true.
 *   addTouchButton({ id: "missile", emoji: "🚀", label: "FIRE", action: "fire", visible: () => G.missiles > 0 })
 * `action` names the input edge it fires (P.fire etc.); hold state → input.<action>Held.
 */
const touchButtons = [];
export function addTouchButton(def) {
    let col = document.getElementById("touchExtra");
    if (!col) {
        col = document.createElement("div");
        col.id = "touchExtra";
        document.getElementById("touch").appendChild(col);
    }
    const b = document.createElement("button");
    b.className = "tbtn small";
    b.id = "tx_" + def.id;
    b.innerHTML = `${def.emoji || "⭐"}<small>${def.label || def.id.toUpperCase()}</small>`;
    const on = e => { e.preventDefault(); touch.edges.add(def.action); touch.held.add(def.action); b.classList.add("down"); setDevice("touch"); };
    const off = () => { touch.held.delete(def.action); b.classList.remove("down"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
    col.appendChild(b);
    touchButtons.push({ def, el: b });
    return b;
}
/**
 * The touch BRAKE pedal also reverses (from a stop / rolling back) — its label says
 * which one it does right now. `vF` = the forward speed (m/s) of the car the pedal
 * drives; `mode` "reverse" | "brake" forces a label. A little hysteresis keeps it from
 * flickering around a stop. The driving sim and the parking lot call it every frame.
 */
let pedalMode = "brake";
export function setBrakePedal(vF, mode) {
    const m = mode || (vF > 1.2 ? "brake" : vF < 0.6 ? "reverse" : pedalMode);
    if (m === pedalMode) return m;
    pedalMode = m;
    const el = document.getElementById("tBrake");
    if (el) { el.textContent = m === "reverse" ? "REVERSE" : "BRAKE"; el.classList.toggle("rev", m === "reverse"); }
    return m;
}
export function brakePedal() { return pedalMode; }

/** Called every frame by main.js: show only the buttons whose visible() is true. */
export function refreshTouchButtons() {
    for (const t of touchButtons) {
        const v = !t.def.visible || t.def.visible();
        if (t.el.dataset.v !== String(v)) { t.el.dataset.v = String(v); t.el.style.display = v ? "" : "none"; }
    }
}

function curve(v) {
    const a = Math.abs(v);
    if (a < DEAD) return 0;
    const n = (a - DEAD) / (1 - DEAD);
    return Math.sign(v) * Math.pow(n, 1.35);
}

export function updateInput(dt) {
    const P = {};
    for (const k of keyEdges) P[k] = true;
    keyEdges.clear();

    // keyboard baseline
    let steer = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
    let throttle = keys.has("gas") ? 1 : 0;
    let brake = keys.has("brake") ? 1 : 0;
    let handbrake = keys.has("handbrake");
    let boost = keys.has("boost");
    let honk = keys.has("honk");
    let lookX = 0, lookY = 0, lookBack = keys.has("lookBack");
    let moveX = steer, moveY = (keys.has("brake") ? 1 : 0) - (keys.has("gas") ? 1 : 0);
    let interactHeld = keys.has("interact"), fireHeld = keys.has("fire"), backHeld = keys.has("back");
    if (P.confirm) P.interact = true;
    if (P.left) P.navLeft = true;
    if (P.right) P.navRight = true;
    if (P.gas) P.up = true;
    if (P.brake) P.down = true;
    if (P.handbrake) P.confirm = true;
    if (P.pause) P.back = true;
    // on foot the keyboard's Space is JUMP (the handbrake belongs to the car) and C is the roll · slide · vault
    let jumpHeld = false, rollHeld = false, emoteHeld = keys.has("emote");
    if (input.foot) {
        jumpHeld = keys.has("handbrake"); handbrake = false;
        if (P.handbrake) P.jump = true;
        if (P.camera) P.roll = true;
        rollHeld = keys.has("camera");
        if (P.lookBack) P.recentre = true;
    }

    // gamepad
    const gp = activePad();
    if (gp) {
        if (!input.padConnected) refreshPadInfo();
        const b = i => (gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
        const down = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
        const edge = i => down(i) && !prevButtons[i];
        const ax = i => (gp.axes[i] || 0);

        const sx = curve(ax(0));
        const dpadX = (down(15) ? 1 : 0) - (down(14) ? 1 : 0);
        const rt = Math.max(b(7), down(0) ? 1 : 0);
        const lt = Math.max(b(6), down(1) ? 1 : 0);
        let active = Math.abs(sx) > 0 || dpadX !== 0 || rt > 0.05 || lt > 0.05 ||
            Math.abs(curve(ax(2))) > 0 || Math.abs(curve(ax(3))) > 0;
        for (let i = 0; i < gp.buttons.length; i++) if (down(i)) active = true;
        if (active) setDevice("gamepad");

        if (sx !== 0) steer = sx; else if (dpadX !== 0) steer = dpadX;
        const sy = curve(ax(1));
        const dpadY = (down(13) ? 1 : 0) - (down(12) ? 1 : 0);
        if (sx !== 0 || sy !== 0) { moveX = sx; moveY = sy; }
        else if (dpadX !== 0 || dpadY !== 0) { moveX = dpadX; moveY = dpadY; }
        interactHeld = interactHeld || down(0);
        fireHeld = fireHeld || down(12);
        throttle = Math.max(throttle, rt);
        brake = Math.max(brake, lt);
        handbrake = handbrake || down(2);
        rollHeld = rollHeld || down(2);
        if (input.foot) { jumpHeld = jumpHeld || down(1); emoteHeld = emoteHeld || down(3); }
        boost = boost || down(5);
        honk = honk || down(4);
        lookX = curve(ax(2));
        lookY = curve(ax(3));
        lookBack = lookBack || down(11);
        backHeld = backHeld || down(1);

        if (edge(4)) P.honk = true;
        if (edge(3)) P.camera = true;
        if (edge(8)) P.radio = true;          // View / Create / − : the car radio (was a 2nd camera button)
        if (edge(9)) { P.pause = true; P.start = true; }
        if (edge(0)) { P.confirm = true; P.interact = true; }
        if (edge(1)) P.back = true;
        if (edge(12)) { P.up = true; P.fire = true; }
        if (edge(13)) { P.down = true; P.item = true; }
        if (edge(4)) P.tabPrev = true;
        if (edge(5)) P.tabNext = true;
        if (edge(17)) P.phone = true;                                        // touchpad: 📱 the phone
        if (edge(10)) { if (input.padKind === "ps") P.map = true; else P.phone = true; }   // L3: map (PS) / phone (no touchpad)
        if (edge(14)) P.navLeft = true;
        if (edge(15)) P.navRight = true;
        if (edge(5)) P.boost = true;
        if (edge(2)) P.roll = true;
        if (input.foot) {
            if (edge(1)) P.jump = true;           // ○ / B: nothing else uses it while she walks (P.back stays for menus)
            if (edge(3)) P.emote = true;          // △ / Y: reserved for the emote wheel (P.camera is still set: it does nothing on foot)
            if (edge(11)) P.recentre = true;      // R3: the camera back behind her
        }

        // left stick as menu navigation, with key-repeat
        const syRaw = ax(1);
        const dir = syRaw < -0.6 ? -1 : syRaw > 0.6 ? 1 : 0;
        if (dir !== navRepeat.dir) {
            navRepeat.dir = dir; navRepeat.t = 0.38;
            if (dir < 0) P.up = true; else if (dir > 0) P.down = true;
        } else if (dir !== 0) {
            navRepeat.t -= dt;
            if (navRepeat.t <= 0) { navRepeat.t = 0.16; if (dir < 0) P.up = true; else P.down = true; }
        }
        prevButtons = gp.buttons.map(x => !!(x && (x.pressed || x.value > 0.5)));
    }

    // touch
    if (input.device === "touch" || touch.gas || touch.brake || touch.steer) {
        if (touch.steer) steer = touch.steer;
        if (touch.steer || touch.moveY) { moveX = touch.steer; moveY = touch.moveY; }
        if (touch.gas) throttle = 1;
        if (touch.brake) brake = 1;
        boost = boost || touch.boost;
        honk = honk || touch.honk;
    }
    if (touch.honk && !input._touchHonkPrev) P.honk = true;
    input._touchHonkPrev = touch.honk;
    if (touch.camEdge) { P.camera = true; touch.camEdge = false; }
    for (const a of touch.edges) P[a] = true;
    touch.edges.clear();
    if (P.phone) P.map = true;           // no phone here (title, pause menu…) → the old map / scrapbook button
    if (touch.held.has("interact")) interactHeld = true;
    if (touch.held.has("fire")) fireHeld = true;
    if (touch.held.has("jump")) jumpHeld = true;
    if (touch.held.has("roll")) rollHeld = true;
    // the look drag since the last frame (radians; invert-look is the camera's business)
    const k = LOOK_PX[drag.type] || LOOK_PX.mouse;
    input.lookDX = drag.dx * k; input.lookDY = drag.dy * k;
    input.lookDrag = drag.id != null && drag.moved >= 6;
    drag.dx = 0; drag.dy = 0;
    input.jumpHeld = jumpHeld; input.rollHeld = rollHeld; input.emoteHeld = emoteHeld;

    input.steer = Math.max(-1, Math.min(1, steer));
    input.throttle = throttle;
    input.brake = brake;
    input.handbrake = handbrake;
    input.boost = boost;
    input.honkHeld = honk;
    input.lookX = lookX;
    input.lookY = lookY;
    input.lookBack = lookBack;
    input.moveX = Math.max(-1, Math.min(1, moveX));
    input.moveY = Math.max(-1, Math.min(1, moveY));
    input.interactHeld = interactHeld;
    input.backHeld = backHeld;     // ○/B or Backspace held (hold-to-skip cutscenes)
    input.fireHeld = fireHeld;
    input.pressed = P;
}

// ── rumble ─────────────────────────────────────────────────────────────
// A native haptics sink (features/native: the iPhone's Taptic engine through
// Capacitor's Haptics plugin — iOS has no navigator.vibrate). Touch play only;
// the sink throttles itself. null on the web.
let hapticSink = null;
export function setHapticSink(fn) { hapticSink = fn || null; }
let rumbleUntil = 0;
export function rumble(strong, weak, ms, force) {
    if (input.rumbleOn === false) return;
    const now = performance.now();
    if (!force && now < rumbleUntil - 30) return; // don't spam the actuator
    rumbleUntil = now + ms;
    const gp = activePad();
    const va = gp && gp.vibrationActuator;
    if (va && va.playEffect && input.device === "gamepad") {
        va.playEffect("dual-rumble", { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    } else if (input.device === "touch" && hapticSink) {
        try { hapticSink(strong, weak, ms); } catch (e) { /* haptics never break the game */ }
    } else if (input.device === "touch" && navigator.vibrate && strong > 0.5) {
        navigator.vibrate(Math.min(ms, 120));
    }
}

// Xbox impulse triggers (Chrome/Edge on Windows): feel the brakes / the gas.
export function triggerRumble(left, right, ms) {
    if (input.rumbleOn === false) return;
    const gp = activePad();
    const va = gp && gp.vibrationActuator;
    if (va && va.effects && va.effects.includes && va.effects.includes("trigger-rumble")) {
        va.playEffect("trigger-rumble", { startDelay: 0, duration: ms, strongMagnitude: 0, weakMagnitude: 0,
            leftTrigger: left, rightTrigger: right }).catch(() => {});
    }
}

// ── button glyphs for prompts ─────────────────────────────────────────
const GLYPHS = {
    xbox: { confirm: "A", back: "B", gas: "RT", brake: "LT", handbrake: "X", camera: "Y", boost: "RB", honk: "LB",
        pause: "☰", look: "R-stick", lookBack: "R3", steer: "L-stick", move: "L-stick", fire: "D-pad ↑", item: "D-pad ↓",
        interact: "A", phone: "L3", radio: "View", tabPrev: "LB", tabNext: "RB", reverse: "LT",
        jump: "B", footMove: "X", emote: "Y", recentre: "R3", freeLook: "R-stick" },
    ps: { confirm: "✕", back: "○", gas: "R2", brake: "L2", handbrake: "□", camera: "△", boost: "R1", honk: "L1",
        pause: "OPTIONS", look: "R-stick", lookBack: "R3", steer: "L-stick", move: "L-stick", fire: "D-pad ↑", item: "D-pad ↓",
        interact: "✕", phone: "TOUCHPAD", map: "L3", radio: "CREATE", tabPrev: "L1", tabNext: "R1", reverse: "L2",
        jump: "○", footMove: "□", emote: "△", recentre: "R3", freeLook: "R-stick" },
    nintendo: { confirm: "B", back: "A", gas: "ZR", brake: "ZL", handbrake: "Y", camera: "X", boost: "R", honk: "L",
        pause: "+", look: "R-stick", lookBack: "R3", steer: "L-stick", move: "L-stick", fire: "D-pad ↑", item: "D-pad ↓",
        interact: "B", phone: "L3", radio: "−", tabPrev: "L", tabNext: "R", reverse: "ZL",
        jump: "A", footMove: "Y", emote: "X", recentre: "R3", freeLook: "R-stick" },
    keyboard: { confirm: "Enter", back: "Esc", gas: "↑ / W", brake: "↓ / S", handbrake: "Space", camera: "C", boost: "Shift",
        honk: "H", pause: "P", look: "", lookBack: "V", steer: "← → / A D", music: "U", move: "WASD / arrows",
        fire: "M", item: "G", interact: "E", phone: "Tab", radio: "T", tabPrev: "Q", tabNext: "R", reverse: "↓ / S",
        jump: "Space", footMove: "C", emote: "B", recentre: "V", freeLook: "Mouse drag" },
    touch: { confirm: "Tap", back: "Back", gas: "GAS", brake: "BRAKE", handbrake: "", camera: "CAM", boost: "NITRO",
        honk: "HONK", pause: "❚❚", steer: "STEER", move: "STICK", fire: "🚀", item: "🌶️", interact: "✋", phone: "📱", radio: "📻",
        tabPrev: "◀", tabNext: "▶", reverse: "REVERSE",
        jump: "JUMP", footMove: "ROLL", emote: "😀", recentre: "", freeLook: "drag the picture" },
};

export function glyph(action, device) {
    const d = device || input.device;
    const set = d === "gamepad" ? GLYPHS[input.padKind] : GLYPHS[d] || GLYPHS.keyboard;
    const g = set[action] || GLYPHS.keyboard[action] || action;
    const cls = d === "keyboard" ? "glyph k" : "glyph";
    return `<span class="${cls}">${g}</span>`;
}

export function glyphSet(kind) { return GLYPHS[kind]; }
