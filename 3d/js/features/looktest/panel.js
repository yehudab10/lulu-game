// 🎨 LOOK TEST — the little corner panel (only with ?look=2): flip each upgrade between TODAY and NEW on the spot, cycle
// the light (Today · New · Lite sky · Full sky) and the time of day, and read the frames per second (averaged over
// 2 s) — so the owner can compare on a real phone and read the number back. Plain DOM, no game input is taken: the
// buttons are their own elements above the canvas. Top left under the coins; tap 🎨 to fold / unfold it (it starts
// folded on a phone on its side).
import { ctx } from "../../core/ctx.js";

const LIGHT_NAMES = { off: "Today", new: "New", lite: "Lite sky", full: "Full sky" };
const LIGHT_ORDER = ["off", "new", "lite", "full"];
const TIME_ORDER = ["", "noon", "dusk", "night"];
const TIME_NAMES = { "": "Live", noon: "Noon", dusk: "Dusk", night: "Night" };
const TIER_ORDER = ["", "low", "medium", "high"];
const TIER_NAMES = { "": "Auto", low: "Low (weak phones)", medium: "Medium (phones)", high: "High (laptops)" };

export function makePanel(LOOK, LIVE, act) {
    if (document.getElementById("lookPanel")) return;
    const css = document.createElement("style");
    css.textContent = `#lookPanel{position:fixed;left:calc(8px + env(safe-area-inset-left));top:calc(96px + env(safe-area-inset-top));z-index:9999;
      display:flex;flex-direction:column;gap:3px;font:600 11px/1.1 system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none}
      #lookPanel button{min-width:84px;min-height:26px;padding:3px 8px;border:0;border-radius:9px;background:rgba(20,20,30,.72);color:#fff;
      font:inherit;text-align:left;cursor:pointer;touch-action:manipulation}
      #lookPanel button.on{background:rgba(233,30,99,.88)}
      #lookPanel .fps{padding:4px 8px;border-radius:9px;background:rgba(0,0,0,.6);text-align:center;font-variant-numeric:tabular-nums}
      #lookPanel.fold>*:not(.tog):not(.fps){display:none}`;
    document.head.appendChild(css);
    const box = document.createElement("div");
    box.id = "lookPanel";
    if (window.innerHeight < 500) box.classList.add("fold");          // (a phone on its side: folded to 🎨 + the fps line, tap to open)
    const btn = (label, fn, cls = "") => {
        const b = document.createElement("button");
        b.className = cls;
        b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); fn(); paint(); });
        b.addEventListener("pointerdown", e => e.stopPropagation());
        b.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });
        box.appendChild(b);
        b._label = label;
        return b;
    };
    const allNew = () => LIVE.car && LIVE.lulu && LIVE.light !== "off";
    const tog = btn(() => "🎨 Look", () => box.classList.toggle("fold"), "tog");
    const all = btn(() => (allNew() ? "✨ All: New" : "↩ All: Today"), () => {
        const on = !allNew();
        if (LIVE.car !== on) { LIVE.car = on; act.car(); }
        if (LIVE.lulu !== on) { LIVE.lulu = on; act.lulu(); }
        LIVE.light = on ? (LIVE.light === "off" ? "new" : LIVE.light) : "off"; act.light();
    });
    const car = btn(() => `🚗 Car: ${LIVE.car ? "New" : "Today"}`, () => { LIVE.car = !LIVE.car; act.car(); });
    const lulu = btn(() => `🚶‍♀️ Lulu: ${LIVE.lulu ? "New" : "Today"}`, () => { LIVE.lulu = !LIVE.lulu; act.lulu(); });
    const light = btn(() => `💡 Light: ${LIGHT_NAMES[LIVE.light]}`, () => {
        LIVE.light = LIGHT_ORDER[(LIGHT_ORDER.indexOf(LIVE.light) + 1) % LIGHT_ORDER.length]; act.light();
    });
    const time = btn(() => `🕐 Time: ${TIME_NAMES[LIVE.time] || "Live"}`, () => {
        LIVE.time = TIME_ORDER[(TIME_ORDER.indexOf(LIVE.time) + 1) % TIME_ORDER.length]; act.time();
    });
    const tier = btn(() => `🖥️ Level: ${TIER_NAMES[LIVE.tier] || "Auto"}`, () => {
        LIVE.tier = TIER_ORDER[(TIER_ORDER.indexOf(LIVE.tier) + 1) % TIER_ORDER.length]; act.tier();
    });
    const fps = document.createElement("div");
    fps.className = "fps";
    fps.textContent = "… fps";
    box.appendChild(fps);
    function paint() {
        for (const b of [tog, all, car, lulu, light, time, tier]) b.textContent = b._label();
        all.classList.toggle("on", allNew());
        car.classList.toggle("on", LIVE.car);
        lulu.classList.toggle("on", LIVE.lulu);
        light.classList.toggle("on", LIVE.light !== "off");
        time.classList.toggle("on", !!LIVE.time);
        tier.classList.toggle("on", !!LIVE.tier);
    }
    paint();
    document.body.appendChild(box);

    // frames per second, averaged over the last 2 s of REAL frames (not game time), + the graphics level it runs at
    let n = 0, t0 = performance.now();
    const tick = now => {
        n++;
        if (now - t0 >= 2000) {
            const f = n * 1000 / (now - t0);
            const lvl = ctx.gfx ? String(ctx.gfx.tier).toUpperCase() : "";
            fps.textContent = `${f.toFixed(0)} fps · ${(1000 / f).toFixed(1)} ms · ${lvl}`;
            n = 0; t0 = now;
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    ctx.look.panel = { box, paint };
}
