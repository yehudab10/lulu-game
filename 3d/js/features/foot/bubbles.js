// Speech bubbles + floating "+1 💰" text pinned to things in the 3D world.
// They're DOM (crisp at any resolution, emoji-friendly) positioned every frame
// by projecting a world point through whichever camera is rendering (the road
// camera on foot, the wedding set's camera at the chuppah).
import * as THREE from "three";
import { css } from "../../core/ctx.js";

css("foot-bubbles", `
#footBubbles { position: fixed; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
#footBubbles.hidden { display: none; }
.fbub { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); max-width: min(260px, 60vw);
  background: #fff; color: var(--ink); border-radius: 16px; padding: 7px 12px; font: 600 15px var(--font); line-height: 1.25;
  text-align: center; white-space: pre-line; box-shadow: 0 3px 0 rgba(0,0,0,.18), 0 6px 18px rgba(0,0,0,.18); }
.fbub::after { content: ""; position: absolute; left: 50%; bottom: -8px; margin-left: -8px; border: 8px solid transparent;
  border-bottom: 0; border-top-color: #fff; }
.fbub.pink { background: #FFE4F1; } .fbub.pink::after { border-top-color: #FFE4F1; }
.fbub.cop { background: #E3EAFF; } .fbub.cop::after { border-top-color: #E3EAFF; }
.fbub.drunk { background: #FFF5D6; } .fbub.drunk::after { border-top-color: #FFF5D6; }
.fbub.big { font-size: 22px; font-weight: 700; color: #C2185B; }
.ffloat { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); font: 700 18px var(--font); white-space: nowrap;
  color: #FFE082; text-shadow: 0 2px 0 rgba(0,0,0,.45), 0 0 10px rgba(0,0,0,.25); }
body.tv .fbub { font-size: 24px; max-width: 420px; padding: 10px 18px; } body.tv .ffloat { font-size: 30px; }
@media (max-width: 600px) { .fbub { font-size: 13px; padding: 6px 10px; } }
`);

const root = document.createElement("div");
root.id = "footBubbles";
root.className = "hidden";
document.body.appendChild(root);

const live = [];   // { el, anchor (Object3D | Vector3), y, until, t0, float }
const _v = new THREE.Vector3();

/** Pin a speech bubble above `anchor` (a person's obj or a Vector3) for `secs`. One per anchor. */
export function bubble(anchor, text, secs = 2.4, { cls = "", y = 2.05 } = {}) {
    if (!anchor || !text) return null;
    for (let i = live.length - 1; i >= 0; i--) if (live[i].anchor === anchor && !live[i].float) kill(i);
    const el = document.createElement("div");
    el.className = "fbub " + cls;
    el.textContent = text;
    root.appendChild(el);
    const b = { el, anchor, y, until: now() + secs, t0: now(), float: false };
    live.push(b);
    return b;
}

/** Rising, fading text at a world point ("+1 💰 tip", "oof!"). */
export function floater(anchor, text, color = "#FFE082", secs = 1.4, y = 2.3) {
    const el = document.createElement("div");
    el.className = "ffloat";
    el.textContent = text;
    el.style.color = color;
    root.appendChild(el);
    const at = anchor.isVector3 ? anchor.clone() : anchor;
    live.push({ el, anchor: at, y, until: now() + secs, t0: now(), float: true, secs });
}

export function hasBubble(anchor) { return live.some(b => b.anchor === anchor && !b.float); }

let clock = 0;
function now() { return clock; }
function kill(i) { live[i].el.remove(); live.splice(i, 1); }

export function clearBubbles() { while (live.length) kill(live.length - 1); }
export function showBubbles(on) { root.classList.toggle("hidden", !on); }

/** Call every frame from the state that owns the camera. */
export function updateBubbles(dt, camera) {
    clock += dt;
    const W = window.innerWidth, H = window.innerHeight;
    for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        if (clock > b.until) { kill(i); continue; }
        const a = b.anchor;
        if (a.isVector3) _v.copy(a); else { a.getWorldPosition(_v); }
        let y = b.y;
        if (b.float) { const k = (clock - b.t0) / b.secs; y += k * 1.1; b.el.style.opacity = String(Math.min(1, 2.2 * (1 - k))); }
        _v.y += y;
        _v.project(camera);
        if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { b.el.style.display = "none"; continue; }
        b.el.style.display = "";
        const x = Math.max(70, Math.min(W - 70, (_v.x * 0.5 + 0.5) * W));
        const sy = Math.max(60, (-_v.y * 0.5 + 0.5) * H);
        b.el.style.transform = `translate(${x.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
    }
}
