// features/carcare/dents.js — 🪠 POP THEM YOURSELF (Bumper to Bumper's 10-coin option): 20 seconds with a plunger. An arrow
// sweeps along a bar; press ✋ (✕ / A / Enter / E / a tap) while it's in the green and a dent pops out. Each dent on the
// car is one target; whatever she pops is popped, the rest stay (Big Mottel will still do them). Lulu stands by her car;
// the car itself shows the dents going (look.js). Controller, keyboard, touch, TV.
import { ctx, css, emit } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { rumble } from "../../input.js";
import { TUNE, L } from "./data.js";

css("carcare-diy", `
.cc-diy { position: fixed; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 40;
  width: min(520px, calc(100vw - 32px)); background: rgba(33,22,40,.88); color: #fff; border-radius: 16px; padding: 10px 14px 12px;
  font: 600 14px system-ui, sans-serif; text-align: center; touch-action: manipulation; user-select: none; }
.cc-diy .cc-top { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; opacity: .92; }
.cc-diy .cc-bar { position: relative; height: 26px; border-radius: 13px; background: #5d4037; overflow: hidden; }
.cc-diy .cc-zone { position: absolute; top: 0; bottom: 0; background: #43A047; border-radius: 6px; }
.cc-diy .cc-arrow { position: absolute; top: -2px; width: 6px; margin-left: -3px; height: 30px; background: #FFEB3B; border-radius: 3px; box-shadow: 0 0 6px #fff; }
.cc-diy .cc-msg { margin-top: 7px; min-height: 18px; font-size: 15px; }
.cc-diy .cc-msg.pop { color: #FFEB3B; }
body.tv .cc-diy { width: 760px; font-size: 22px; } body.tv .cc-diy .cc-bar { height: 40px; } body.tv .cc-diy .cc-arrow { height: 44px; }
`);

const pick = a => a[Math.floor(Math.random() * a.length)];
export const D = { on: false, t: 0, left: 0, popped: 0, x: 0, dir: 1, speed: 0.9, zone: [0.4, 0.6], el: null, tap: false, wasDown: false, msgT: 0 };

function newZone() {
    const w = 0.16 + Math.random() * 0.06, a = 0.08 + Math.random() * (0.84 - w);
    D.zone = [a, a + w];
    D.speed = 0.8 + D.popped * 0.12;
}
function paint() {
    const el = D.el;
    if (!el) return;
    el.querySelector(".cc-time").textContent = `⏱ ${Math.max(0, Math.ceil(TUNE.diySec - D.t))} s`;
    el.querySelector(".cc-left").textContent = `🚗 ${D.left} to go`;
    const z = el.querySelector(".cc-zone");
    z.style.left = (D.zone[0] * 100).toFixed(1) + "%"; z.style.width = ((D.zone[1] - D.zone[0]) * 100).toFixed(1) + "%";
    el.querySelector(".cc-arrow").style.left = (D.x * 100).toFixed(1) + "%";
}
function msg(text, cls = "") { const m = D.el && D.el.querySelector(".cc-msg"); if (m) { m.textContent = text; m.className = "cc-msg " + cls; } D.msgT = 1.2; }

/** Start the game: dents = how many dents (decals) are on the car; onPop() each pop; onEnd(popped). → bool */
export function startDiy(dents, { onPop, onEnd }) {
    if (D.on || !(dents > 0) || !ctx.foot || !ctx.foot.script) return false;
    const ok = ctx.foot.script({
        update(dt, P, F) {
            if (F && F.lulu) F.lulu.update(dt, { walk: 0, talk: D.msgT > 0.6 });
            return tick(dt, P);
        },
        abort() { end(); },
    });
    if (!ok) return false;
    Object.assign(D, { on: true, t: 0, left: dents, popped: 0, x: 0, dir: 1, tap: false, wasDown: true, onPop, onEnd, msgT: 0 });
    newZone();
    const el = document.createElement("div");
    el.className = "cc-diy";
    el.innerHTML = `<div class="cc-top"><span class="cc-time"></span><span>🪠 POP THE DENTS</span><span class="cc-left"></span></div>
      <div class="cc-bar"><div class="cc-zone"></div><div class="cc-arrow"></div></div><div class="cc-msg"></div>`;
    el.addEventListener("pointerdown", e => { e.preventDefault(); D.tap = true; });
    document.body.appendChild(el);
    D.el = el;
    msg(L.diyStart);
    paint();
    emit("carcare:diy", { dents });
    return true;
}
function tick(dt, P) {
    if (!D.on) return false;
    D.t += dt;
    if (D.msgT > 0) D.msgT -= dt;
    D.x += D.dir * D.speed * dt;
    if (D.x > 1) { D.x = 1; D.dir = -1; } else if (D.x < 0) { D.x = 0; D.dir = 1; }
    const down = !!(P && (P.confirm || P.interact));
    const press = (down && !D.wasDown) || D.tap;
    D.wasDown = down; D.tap = false;
    if (press && D.t > 0.25) {
        if (D.x >= D.zone[0] && D.x <= D.zone[1]) {
            D.popped++; D.left--;
            msg(pick(L.diyPop), "pop");
            rumble(0.4, 0.7, 120, true);
            try { if (D.onPop) D.onPop(D.popped); } catch (e) { console.error("[carcare] pop", e); }
            newZone();
        } else { msg(pick(L.diyMiss)); rumble(0.15, 0.2, 80); }
    }
    if (P && P.back && D.t > 0.5) D.t = TUNE.diySec;
    paint();
    if (D.left <= 0 || D.t >= TUNE.diySec) { end(); return false; }
    return true;
}
function end() {
    if (!D.on) return;
    D.on = false;
    if (D.el) { D.el.remove(); D.el = null; }
    const n = D.popped;
    try { if (D.onEnd) D.onEnd(n); } catch (e) { console.error("[carcare] diy end", e); }
    H.toast(n ? L.diyDone.replace("{n}", n === 1 ? "one" : String(n)) : L.diyNone, n ? "gold" : "", { key: "carcare" });
}
/** Tests: press now (as a tap). */
export function diyTap() { D.tap = true; }
