// features/moves — shared plumbing: the save, the move list (names, how-tos,
// mastery goals), the STYLE COMBO engine, the pooled HUD callout, spark
// particles written straight into the car's particle pool (no allocation),
// and the little rumble / DualSense helpers.
import { ctx, emit, css } from "../../core/ctx.js";
import { store, saveSoon, save3d } from "../../core/save.js";
import { addScore, addCoins } from "../../core/driving.js";
import { input, rumble as padRumble, triggerRumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";

export const ID = "moves";

/** 3D-only progress (lulu3dSave → f.moves). */
export const S = store(ID, {
    on: true,          // the Moves page's toggle (off = the classic handbrake, no tricks)
    n: {},             // lifetime count per move id
    q: {},             // quality counters: drift3 (purple turbos), perfect (rocket), matador…
    best: {},          // personal bests: comboScore, comboMult, comboLen, wrongway (s), air (tricks in one jump), …
    seen: {},          // first-time hint shown per move
});
for (const k of ["n", "q", "best", "seen"]) if (!S[k] || typeof S[k] !== "object") S[k] = {};
export { saveSoon };

/** Moves are live in real play; in ?test runs only when the test opts in (&enable=moves). */
export const live = () => S.on !== false && ctx.enabled(ID);

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const touch = () => input.device === "touch";

// ── the moves: what the Moves page lists (glyph keys → input.js glyphSet) ──
// how: { pad: html with {glyph} tokens, key: keyboard, touch: touch } — rendered per device by page.js
// stars: three goals, each (S) → [current, target]
export const MOVES = [
    { id: "drift", icon: "🌀", name: "Drift boost", where: "car", link: true,
      blurb: "Hold the handbrake through a turn at speed. Sparks charge BLUE → ORANGE → PURPLE — let go for a mini-turbo. Steer into the drift to charge faster, counter-steer to straighten the line.",
      how: { pad: "hold {handbrake} + steer at speed · release", key: "hold Space + steer · release", touch: "hold BRAKE + steer hard at speed · release" },
      stars: [S => [S.n.drift || 0, 1, "any mini-turbo"], S => [S.q.drift2 || 0, 1, "an ORANGE turbo"], S => [S.q.drift3 || 0, 10, "10 PURPLE turbos"]] },
    { id: "rocket", icon: "🚀", name: "Rocket start", where: "car",
      blurb: "Hit the gas right as the countdown says GO (the end of the 1, or as Lulu pulls into her lane). Too early and the wheels just spin.",
      how: { pad: "{gas} on the GO", key: "↑ / W on the GO", touch: "GAS on the GO" },
      stars: [S => [S.n.rocket || 0, 1, "any launch"], S => [S.q.perfect || 0, 1, "a PERFECT start"], S => [S.q.perfect || 0, 10, "10 perfect starts"]] },
    { id: "slingshot", icon: "💨", name: "Slipstream", where: "car", link: true,
      blurb: "Tuck in right behind a car or truck to charge the draft (trucks charge fastest), then pull out to slingshot past.",
      how: { pad: "tailgate · then swerve out", key: "tailgate · then swerve out", touch: "tailgate · then swerve out" },
      stars: [S => [S.n.slingshot || 0, 1, "one slingshot"], S => [S.n.slingshot || 0, 15, "15 slingshots"], S => [S.best.slingCombo || 0, 3, "3 in one combo"]] },
    { id: "nearmiss", icon: "😎", name: "Close shaves", where: "car",
      blurb: "Skim past cars at speed. Head-on dodges in the oncoming lanes are worth double — and driving on the wrong side keeps a combo alive.",
      how: { pad: "squeeze past at speed", key: "squeeze past at speed", touch: "squeeze past at speed" },
      stars: [S => [S.n.nearmiss || 0, 1, "one close shave"], S => [(S.n.nearmiss || 0) + (S.n.headon || 0), 40, "40 close shaves"], S => [S.best.wrongway || 0, 20, "20 s on the wrong side"]] },
    { id: "air", icon: "🛹", name: "Air tricks", where: "car",
      blurb: "Off a stunt ramp: steer to spin, flick the stick ↑/↓ to flip, hold the handbrake + steer to barrel roll. Land straight for a turbo — land mid-trick and you wobble.",
      how: { pad: "in the air: {steer} spin · flick ↑↓ flip · {handbrake}+steer roll", key: "in the air: ← → spin · tap W/S flip · Space + ← → roll", touch: "in the air: stick ← → spin · ↑↓ flip · BRAKE + steer roll" },
      stars: [S => [S.n.air || 0, 1, "land a trick"], S => [S.best.air || 0, 2, "2 tricks in one jump"], S => [S.best.air || 0, 4, "4 tricks in one jump"]] },
    { id: "bootleg", icon: "↩️", name: "Bootlegger", where: "car",
      blurb: "Reverse fast, then flick the wheel and yank the handbrake: Lulu whips round 180° and drives off the other way.",
      how: { pad: "reverse fast ({brake}) · steer + {handbrake}", key: "reverse fast (S) · steer + Space", touch: "reverse fast · steer hard + GAS" },
      stars: [S => [S.n.bootleg || 0, 1, "one bootlegger"], S => [S.n.bootleg || 0, 5, "5 bootleggers"], S => [S.q.bootlegFast || 0, 3, "3 at full reverse"]] },
    { id: "pit", icon: "🚓", name: "PIT maneuver", where: "car",
      blurb: "In a chase, nudge a cruiser's back corner at an angle (gently!) and it spins out of the pursuit for a few seconds.",
      how: { pad: "tap a cruiser's rear corner", key: "tap a cruiser's rear corner", touch: "tap a cruiser's rear corner" },
      stars: [S => [S.n.pit || 0, 1, "one PIT"], S => [S.n.pit || 0, 8, "8 PITs"], S => [S.best.pitCombo || 0, 2, "2 in one combo"]] },
    { id: "roll", icon: "🤸", name: "Dodge roll", where: "foot",
      blurb: "On foot: roll out of the way — a split second where cars can't touch her. Roll right past a car's bumper for a MATADOR!",
      how: { pad: "on foot: {footMove}", key: "on foot: C", touch: "on foot: ROLL (or tap the road)" },
      stars: [S => [S.n.roll || 0, 1, "one roll"], S => [S.q.matador || 0, 1, "a MATADOR"], S => [S.q.matador || 0, 10, "10 matadors"]] },
    { id: "slide", icon: "🏃‍♀️", name: "Sprint slide", where: "foot",
      blurb: "Sprinting? The same button slides — fast, low and untouchable for a moment. Slide into a vault to chain them.",
      how: { pad: "sprint ({boost}) + {footMove} · {jump} mid-slide = LONG JUMP", key: "Shift + C · Space mid-slide = LONG JUMP", touch: "full-tilt stick + ROLL · JUMP mid-slide = LONG JUMP" },
      stars: [S => [S.n.slide || 0, 1, "one slide"], S => [S.n.slide || 0, 25, "25 slides"], S => [S.best.footCombo || 0, 5, "a ×5 combo on foot"]] },
    { id: "vault", icon: "🧗‍♀️", name: "Vault", where: "foot",
      blurb: "Running at a parked or stopped car? The same button hops right over the hood.",
      how: { pad: "at a car: {footMove}", key: "at a car: C", touch: "at a car: ROLL" },
      stars: [S => [S.n.vault || 0, 1, "one vault"], S => [S.n.vault || 0, 10, "10 vaults"], S => [S.best.vaultCombo || 0, 3, "3 in one combo"]] },
    { id: "jump", icon: "🦘", name: "Jumps", where: "foot",
      blurb: "On foot: jump (hold the button to go higher). Hop over a guardrail or a bench, land up on a bench or a parked car's hood — and from the hood up onto the roof. Jump out of a slide for a LONG JUMP; press roll in the air to roll out of the landing.",
      how: { pad: "on foot: {jump} (hold = higher)", key: "on foot: Space (hold = higher)", touch: "on foot: JUMP" },
      stars: [S => [(S.n.hop || 0) + (S.n.perch || 0), 1, "hop over or onto something"], S => [S.n.longjump || 0, 1, "a LONG JUMP out of a slide"], S => [S.q.roofs || 0, 3, "3 car roofs"]] },
    { id: "combo", icon: "🔗", name: "Style combo", where: "any", meta: true,
      blurb: "Every move inside a few seconds of the last one builds the combo — different moves raise the multiplier faster than repeats. Drifting, drafting and the wrong lane keep it alive. When it ends cleanly it banks: score × multiplier, nitro, and coins from ×3 up. A crash loses it.",
      how: { pad: "chain moves", key: "chain moves", touch: "chain moves" },
      stars: [S => [S.best.comboMult || 0, 3, "a ×3 combo"], S => [S.best.comboMult || 0, 6, "a ×6 combo"], S => [S.best.comboMult || 0, 10, "a ×10 combo"]] },
];
export const MOVE = Object.fromEntries(MOVES.map(m => [m.id, m]));
/** Which move-page entry a combo move id counts toward (headon → nearmiss, wrongway → nearmiss…). */
export const FAMILY = { drift: "drift", rocket: "rocket", slingshot: "slingshot", nearmiss: "nearmiss", headon: "nearmiss", wrongway: "nearmiss",
    air: "air", bootleg: "bootleg", pit: "pit", roll: "roll", matador: "roll", slide: "slide", vault: "vault",
    hop: "jump", perch: "jump", longjump: "jump" };
export function starsOf(m) {
    let n = 0;
    for (const g of m.stars) { const [c, t] = g(S); if (c >= t) n++; else break; }
    return n;
}

// ── the STYLE COMBO ───────────────────────────────────────────────────────
export const WINDOW = 3.0;               // seconds to land the next move
/** Cost of our per-frame hooks (ms summed + frames), for the perf numbers in tests. Also a short log of banks / breaks. */
export const PERF = { ms: 0, n: 0, max: 0 };
export const LOG = [];
function log(e) { LOG.push(e); if (LOG.length > 12) LOG.shift(); }
export const C = {
    n: 0, pts: 0, mult: 1, t: 0, distinct: 0, last: "", rep: 0, foot: false,
    kinds: Object.create(null),          // id → count in this chain
};
function multOf() { return Math.min(12, 1 + 0.5 * (C.n - 1) + 0.5 * (C.distinct - 1)); }

/** A move landed: add it to the chain (repeats are worth less, new kinds raise the multiplier faster). */
export function addMove(id, pts, label, opts = {}) {
    if (!live()) return 0;
    if (ctx.G && ctx.G.selfDriving) return 0;          // (the self-driving car earns no style — features/dealers)
    if (id === C.last) C.rep++; else C.rep = 0;
    C.last = id;
    pts = Math.round(pts * Math.pow(0.72, Math.min(4, C.rep)));
    if (!C.kinds[id]) { C.kinds[id] = 0; C.distinct++; }
    C.kinds[id]++;
    C.n++;
    C.pts += pts;
    addScore(pts, "move");                       // the move's own points land now; the multiplier is what the combo risks
    C.mult = multOf();
    C.t = Math.max(C.t, WINDOW);
    if (opts.foot) C.foot = true;
    // lifetime + first-time hint
    S.n[id] = (S.n[id] || 0) + 1;
    const fam = FAMILY[id] || id;
    if (fam !== id) S.n[fam] = S.n[fam] || 0;
    if (id === "slingshot") bestOf("slingCombo", C.kinds[id]);
    if (id === "pit") bestOf("pitCombo", C.kinds[id]);
    if (id === "vault") bestOf("vaultCombo", C.kinds[id]);
    saveSoon();
    emit("stat", { id: "moves3d", n: 1 });
    callout(label, C.n > 1 ? `×${fmtMult(C.mult)} · ${(C.pts).toLocaleString()}` : `+${pts.toLocaleString()}`, opts.color || "", 1.6);
    if (!ctx.skipping) A.sfxCloseCall(Math.min(10, 2 + C.n));
    firstTime(fam);
    emit("moves:move", { id, pts, combo: C.n, mult: C.mult });
    return pts;
}
export const fmtMult = m => (Math.round(m * 10) / 10).toString();
/** A link move is active this frame: the combo can't run out while it lasts. */
export function keepAlive(sec = 0.9) { if (C.n > 0) C.t = Math.max(C.t, sec); }
export function bestOf(key, v) { if (v > (S.best[key] || 0)) { S.best[key] = Math.round(v * 100) / 100; saveSoon(); return true; } return false; }
export function quality(key, n = 1) { S.q[key] = (S.q[key] || 0) + n; saveSoon(); }

/** The combo ran out cleanly: score × multiplier, a nitro top-up, coins from ×3. */
export function bank(why = "time") {
    if (C.n <= 0) return null;
    const G = ctx.G;
    const total = Math.round(C.pts * C.mult);
    const res = { n: C.n, mult: C.mult, pts: C.pts, total, coins: 0, why };
    if (C.n >= 2) {
        addScore(total - C.pts, "combo");          // the moves' own points are already in (each move scored as it landed)
        if (!C.foot && G.boost != null) G.boost = Math.min(1, G.boost + Math.min(0.5, 0.035 * C.n));
        if (C.mult >= 3) { res.coins = Math.min(40, Math.round((C.mult - 2) * 3)); addCoins(res.coins, "combo"); }
        H.toast(`🔗 COMBO ×${fmtMult(C.mult)} · +${total.toLocaleString()}${res.coins ? ` · +${res.coins} 💰` : ""}`, C.mult >= 3 ? "gold" : "", { merge: false });
        callout(`COMBO ×${fmtMult(C.mult)}`, `+${total.toLocaleString()}${res.coins ? ` · +${res.coins} 💰` : ""}`, "gold", 1.8);
        if (!ctx.skipping) A.sfxCoin(Math.min(12, C.n));
        rumble(0.25, 0.6, 160, true);
        flashPad(C.mult >= 6 ? [180, 90, 255] : [255, 200, 40], 0.35);
        let rec = bestOf("comboMult", C.mult);
        rec = bestOf("comboScore", total) || rec;
        bestOf("comboLen", C.n);
        if (C.foot) bestOf("footCombo", C.mult);
        emit("stat", { id: "movesCombo", best: Math.floor(C.mult) });
        if (C.mult >= 3) emit("stat", { id: "movesCombo3", n: 1 });
        if (rec && C.mult >= 3) setTimeout(() => H.toast("🏆 New combo record!", "gold"), 0);
        firstTime("combo");
    }
    log({ type: "bank", n: res.n, mult: res.mult, total: res.total, coins: res.coins, why });
    emit("moves:bank", res);
    reset();
    return res;
}
/** A crash (or a botched landing) loses the chain. */
export function breakCombo(why = "crash") {
    if (C.n <= 0) return;
    if (C.n >= 2 && live()) {
        H.toast(`💥 COMBO LOST ×${fmtMult(C.mult)}`, "red", { merge: false });
        callout("COMBO LOST", why === "botch" ? "bailed the landing" : "", "red", 1.2);
    }
    log({ type: "break", n: C.n, mult: C.mult, why });
    emit("moves:break", { n: C.n, mult: C.mult, why });
    reset();
}
export function reset() {
    C.n = 0; C.pts = 0; C.mult = 1; C.t = 0; C.distinct = 0; C.last = ""; C.rep = 0; C.foot = false;
    for (const k in C.kinds) delete C.kinds[k];
}
/** Once per frame from the HUD tick: the combo window. */
export function tickCombo(dt) {
    if (C.n <= 0) return;
    C.t -= dt;
    if (C.t <= 0) bank("time");
}

// ── first time you pull a move off: a hint pointing at the Moves page ─────
export function firstTime(fam) {
    if (!fam || S.seen[fam]) return;
    S.seen[fam] = 1;
    saveSoon();
    const m = MOVE[fam];
    if (!m || !live()) return;
    H.banner(`<b>${m.icon} NEW MOVE: ${m.name.toUpperCase()}!</b><small>Practise it: Moves, in your Scrapbook</small>`, 2600, { key: "movesNew" });
}

// ── controller feel ─────────────────────────────────────────────────────
export function rumble(strong, weak, ms, force) {
    if (save3d.settings && save3d.settings.vibration === false) return;
    padRumble(strong, weak, ms, force);
}
export function triggerTick(left, right, ms) {
    if (save3d.settings && save3d.settings.vibration === false) return;
    triggerRumble(left, right, ms);
}
/** DualSense light bar flash (features/dualsense, when connected). */
export function flashPad(rgb, sec) {
    try { if (ctx.dualsense && ctx.dualsense.flash) ctx.dualsense.flash(rgb, sec); } catch (e) { /* optional */ }
}

// ── sparks: written straight into the car's particle pool (no allocation) ──
export const TIER_RGB = [[0.95, 0.95, 0.95], [0.35, 0.72, 1.0], [1.0, 0.58, 0.12], [0.78, 0.36, 1.0]];
export const TIER_CSS = ["#ECEFF1", "#4FC3F7", "#FF9800", "#C77DFF"];
export const TIER_NAME = ["", "BLUE", "ORANGE", "PURPLE"];
export function spark(x, y, z, vx, vy, vz, size, life, rgb) {
    const fx = ctx.car && ctx.car.fx;
    if (!fx) return;
    const i = fx.i++ % fx.max, k = i * 3;
    fx.p[k] = x; fx.p[k + 1] = y; fx.p[k + 2] = z;
    fx.v[k] = vx; fx.v[k + 1] = vy; fx.v[k + 2] = vz;
    fx.col[k] = rgb[0]; fx.col[k + 1] = rgb[1]; fx.col[k + 2] = rgb[2];
    fx.size[i] = size; fx.grow[i] = size * 0.3;
    fx.life[i] = fx.maxLife[i] = life;
}

// ── the HUD callout: ONE pooled element, transient, fades out ─────────────
css(ID, `
#mvCall { position: absolute; left: 50%; top: 30%; transform: translate(-50%, 0); text-align: center; pointer-events: none;
  opacity: 0; transition: opacity .25s ease, transform .25s ease; z-index: 3; white-space: nowrap; }
#mvCall.on { opacity: 1; transform: translate(-50%, -6px); }
#mvCall .mv-n { display: block; font: 900 clamp(18px, 3.4vmin, 30px)/1.05 var(--font, system-ui); letter-spacing: .04em; color: #fff;
  text-shadow: 0 2px 0 rgba(0,0,0,.55), 0 0 14px var(--mvc, rgba(255,255,255,.35)); -webkit-text-stroke: 1px rgba(0,0,0,.25); }
#mvCall .mv-s { display: block; margin-top: 2px; font: 700 clamp(13px, 2.2vmin, 19px)/1.1 var(--font, system-ui); color: #FFF8E1; text-shadow: 0 1px 0 rgba(0,0,0,.6); }
#mvCall .mv-m { display: block; width: clamp(90px, 16vmin, 170px); height: 7px; margin: 5px auto 0; border-radius: 4px; background: rgba(0,0,0,.35);
  overflow: hidden; opacity: 0; transition: opacity .2s; }
#mvCall .mv-m.on { opacity: 1; }
#mvCall .mv-m i { display: block; height: 100%; width: 0; border-radius: 4px; background: var(--mvc, #fff); }
#mvCall.pop .mv-n { animation: mvPop .32s ease-out; }
@keyframes mvPop { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
@media (max-aspect-ratio: 1/1) { #mvCall { top: 25%; } }
body.tv #mvCall .mv-n { font-size: 44px; } body.tv #mvCall .mv-s { font-size: 26px; } body.tv #mvCall .mv-m { width: 240px; height: 10px; }
body.calm #mvCall.pop .mv-n { animation: none; }
`);
const CO = { el: null, n: null, s: null, m: null, mi: null, t: 0, on: false, name: "", sub: "", color: "", meter: -1, meterCol: "" };
function ensureCall() {
    if (CO.el) return CO.el;
    const hud = document.getElementById("hud");
    if (!hud) return null;
    const el = document.createElement("div");
    el.id = "mvCall";
    el.innerHTML = `<b class="mv-n"></b><span class="mv-s hud-secondary"></span><span class="mv-m"><i></i></span>`;
    hud.appendChild(el);
    CO.el = el; CO.n = el.querySelector(".mv-n"); CO.s = el.querySelector(".mv-s"); CO.m = el.querySelector(".mv-m"); CO.mi = CO.m.firstChild;
    return el;
}
/** Show a move name (+ a secondary line, hidden in HUD Clean) for `dur` seconds. */
export function callout(name, sub = "", color = "", dur = 1.4) {
    if (!ensureCall() || ctx.skipping) return;
    if (name !== CO.name) { CO.n.textContent = name; CO.name = name; CO.el.classList.remove("pop"); void CO.el.offsetWidth; CO.el.classList.add("pop"); }
    if (sub !== CO.sub) { CO.s.textContent = sub; CO.sub = sub; }
    setColor(color);
    CO.t = dur;
    if (!CO.on) { CO.on = true; CO.el.classList.add("on"); }
}
/** A charge meter under the callout (drift sparks, the draft): frac 0..1, < 0 hides it. Cheap to call every frame. */
export function meter(frac, color, name) {
    if (!ensureCall()) return;
    if (frac < 0) {
        if (CO.meter >= 0) { CO.meter = -1; CO.m.classList.remove("on"); }
        return;
    }
    const q = Math.round(clamp(frac, 0, 1) * 40) / 40;
    if (CO.meter < 0) CO.m.classList.add("on");
    if (q !== CO.meter) { CO.meter = q; CO.mi.style.width = (q * 100).toFixed(1) + "%"; }
    if (name && name !== CO.name) { CO.n.textContent = name; CO.name = name; }
    if (color) setColor(color);
    CO.t = Math.max(CO.t, 0.25);
    if (!CO.on) { CO.on = true; CO.el.classList.add("on"); }
}
function setColor(c) {
    if (c === CO.color) return;
    CO.color = c;
    const css = c === "gold" ? "#FFD54F" : c === "red" ? "#FF5252" : c === "pink" ? "#FF4081" : c || "";
    CO.el.style.setProperty("--mvc", css || "rgba(255,255,255,.35)");
}
export function tickCallout(dt) {
    if (!CO.on) return;
    CO.t -= dt;
    if (CO.t <= 0) { CO.on = false; CO.el.classList.remove("on"); if (CO.meter >= 0) { CO.meter = -1; CO.m.classList.remove("on"); } }
}
export function hideCallout() {
    if (!CO.el) return;
    CO.t = 0; CO.on = false; CO.el.classList.remove("on");
    CO.meter = -1; CO.m.classList.remove("on");
}
export const calloutInfo = () => ({ on: CO.on, name: CO.name, sub: CO.sub, meter: CO.meter });
