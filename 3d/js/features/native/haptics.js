// features/native/haptics.js — the iPhone's Taptic engine for touch play.
// The 3D game's feedback layer is input.js `rumble(strong, weak, ms)` (crashes,
// bumps, nitro, the countdown…): a controller rumbles through the Gamepad API,
// an Android browser buzzes navigator.vibrate — and iOS has neither. In the
// native app this routes touch-play rumbles to @capacitor/haptics (the same
// plugin the classic game's src/10h-haptics.js uses): impact HEAVY / MEDIUM /
// LIGHT by strength, throttled per level so a bumpy shoulder can't turn the
// phone into a massage chair. The ⚙️ Settings "📳 Rumble & haptics" toggle
// (save3d.settings.vibration → input.rumbleOn) still switches it all off —
// rumble() checks it before calling the sink.
import { ctx } from "../../core/ctx.js";
import { setHapticSink } from "../../input.js";
import { plugin } from "./cap.js";

// strength floor, Capacitor impact style, min gap (ms) — like src/10h-haptics.js
const LEVELS = [
    { min: 0.75, style: "HEAVY", gap: 160 },
    { min: 0.45, style: "MEDIUM", gap: 110 },
    { min: 0.2, style: "LIGHT", gap: 120 },
];
const nextAt = {};
const H = { sent: 0, last: null, log: [] };

function sink(strong, weak) {
    const hp = plugin("Haptics");
    if (!hp || typeof hp.impact !== "function") return;
    // the strong motor is the "thunk"; a weak-only buzz (rumble strips, gravel) stays silent
    const k = Math.max(strong || 0, (weak || 0) * 0.5);
    const lvl = LEVELS.find(l => k >= l.min);
    if (!lvl) return;
    const now = performance.now();
    if (now < (nextAt[lvl.style] || 0)) return;
    // a heavy hit also holds back the lighter levels for a moment (one clean thunk)
    for (const l of LEVELS) if (l.min <= lvl.min) nextAt[l.style] = Math.max(nextAt[l.style] || 0, now + lvl.gap);
    H.sent++;
    H.last = lvl.style;
    H.log.push(lvl.style); if (H.log.length > 40) H.log.shift();
    try { const p = hp.impact({ style: lvl.style }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}

// Only in the app with the plugin installed; on the web the sink stays null and
// rumble() keeps its Gamepad API / navigator.vibrate paths.
if (plugin("Haptics")) setHapticSink(sink);

ctx.haptics = {
    get native() { return !!plugin("Haptics"); },
    debug: H,
};
