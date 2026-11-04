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
//   Start / Options ... pause                   View / Share  change camera
//   D-pad ↑ ........... fire (missile)          D-pad ↓ .... item (pepper spray / shield)
//   A / ✕ on foot ..... interact                Touchpad / L3  map / scrapbook
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
    Tab: "map", KeyU: "music",
    Enter: "confirm", NumpadEnter: "confirm", Backspace: "back",
    // PS5 / TV browsers and some remotes send these for the controller / remote
    BrowserBack: "back", GoBack: "back", MediaPlayPause: "pause", ContextMenu: "pause",
};
// Some TV / console browsers only report legacy keyCodes (no e.code).
const KEYCODES = { 37: "left", 38: "gas", 39: "right", 40: "brake", 13: "confirm", 27: "pause", 8: "back", 461: "back", 10009: "back", 415: "pause" };

const keys = new Set();
const keyEdges = new Set();
const touch = { steer: 0, moveY: 0, gas: false, brake: false, boost: false, honk: false, camEdge: false, edges: new Set(), held: new Set() };
let prevButtons = [];
let navRepeat = { dir: 0, t: 0 };

export const input = {
    // continuous
    steer: 0, throttle: 0, brake: 0, handbrake: false, boost: false, honkHeld: false,
    lookX: 0, lookY: 0, lookBack: false,
    // 2-D movement (left stick / WASD / arrows / touch stick): on foot, Dina, menus
    moveX: 0, moveY: 0,
    interactHeld: false, fireHeld: false,
    // edge-triggered, valid for the frame after update(): confirm back up down navLeft
    // navRight start pause honk camera boost fire item interact map tabPrev tabNext music
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
export function bindTouch() {
    const zone = document.getElementById("stickZone");
    const knob = document.getElementById("stickKnob");
    const base = document.getElementById("stickBase");
    let stickId = null, cx = 0;
    zone.addEventListener("pointerdown", e => {
        stickId = e.pointerId;
        zone.setPointerCapture(e.pointerId);
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
        touch.steer = dx / 60;
        touch.moveY = dy / 60;
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
    window.addEventListener("touchstart", () => setDevice("touch"), { passive: true });
}

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
    let interactHeld = keys.has("interact"), fireHeld = keys.has("fire");
    if (P.confirm) P.interact = true;
    if (P.left) P.navLeft = true;
    if (P.right) P.navRight = true;
    if (P.gas) P.up = true;
    if (P.brake) P.down = true;
    if (P.handbrake) P.confirm = true;
    if (P.pause) P.back = true;

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
        boost = boost || down(5);
        honk = honk || down(4);
        lookX = curve(ax(2));
        lookY = curve(ax(3));
        lookBack = lookBack || down(11);

        if (edge(4)) P.honk = true;
        if (edge(3) || edge(8)) P.camera = true;
        if (edge(9)) { P.pause = true; P.start = true; }
        if (edge(0)) { P.confirm = true; P.interact = true; }
        if (edge(1)) P.back = true;
        if (edge(12)) { P.up = true; P.fire = true; }
        if (edge(13)) { P.down = true; P.item = true; }
        if (edge(4)) P.tabPrev = true;
        if (edge(5)) P.tabNext = true;
        if (edge(17) || edge(10)) P.map = true;
        if (edge(14)) P.navLeft = true;
        if (edge(15)) P.navRight = true;
        if (edge(5)) P.boost = true;

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
    if (touch.held.has("interact")) interactHeld = true;
    if (touch.held.has("fire")) fireHeld = true;

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
    input.fireHeld = fireHeld;
    input.pressed = P;
}

// ── rumble ─────────────────────────────────────────────────────────────
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
        interact: "A", map: "View", tabPrev: "LB", tabNext: "RB" },
    ps: { confirm: "✕", back: "○", gas: "R2", brake: "L2", handbrake: "□", camera: "△", boost: "R1", honk: "L1",
        pause: "OPTIONS", look: "R-stick", lookBack: "R3", steer: "L-stick", move: "L-stick", fire: "D-pad ↑", item: "D-pad ↓",
        interact: "✕", map: "TOUCHPAD", tabPrev: "L1", tabNext: "R1" },
    nintendo: { confirm: "B", back: "A", gas: "ZR", brake: "ZL", handbrake: "Y", camera: "X", boost: "R", honk: "L",
        pause: "+", look: "R-stick", lookBack: "R3", steer: "L-stick", move: "L-stick", fire: "D-pad ↑", item: "D-pad ↓",
        interact: "B", map: "−", tabPrev: "L", tabNext: "R" },
    keyboard: { confirm: "Enter", back: "Esc", gas: "↑ / W", brake: "↓ / S", handbrake: "Space", camera: "C", boost: "Shift",
        honk: "H", pause: "P", look: "", lookBack: "V", steer: "← → / A D", music: "U", move: "WASD / arrows",
        fire: "M", item: "G", interact: "E", map: "Tab", tabPrev: "Q", tabNext: "R" },
    touch: { confirm: "Tap", back: "Back", gas: "GAS", brake: "BRAKE", handbrake: "", camera: "CAM", boost: "NITRO",
        honk: "HONK", pause: "❚❚", steer: "STEER", move: "STICK", fire: "🚀", item: "🧴", interact: "✋", map: "📒",
        tabPrev: "◀", tabNext: "▶" },
};

export function glyph(action, device) {
    const d = device || input.device;
    const set = d === "gamepad" ? GLYPHS[input.padKind] : GLYPHS[d] || GLYPHS.keyboard;
    const g = set[action] || GLYPHS.keyboard[action] || action;
    const cls = d === "keyboard" ? "glyph k" : "glyph";
    return `<span class="${cls}">${g}</span>`;
}

export function glyphSet(kind) { return GLYPHS[kind]; }
