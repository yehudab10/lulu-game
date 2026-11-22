// The Parking Challenge's full-screen overlays: the red low-time vignette and the red bump flash. (Everything else is
// on the regular driving HUD now: one chip — level · lives · stars · coins · the clock — in the HUD's left slot, the
// hints / HOLD STILL TO PARK on the prompt line, the level card as the HUD banner, the result on the attendant's board.)
// Pure DOM, pointer-events off.
import { css } from "../../core/ctx.js";

css("parking", `
#parkHud { position: fixed; inset: 0; pointer-events: none; z-index: 6; }
#parkHud.hidden { display: none; }
#parkHud .ph-vig { position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(ellipse at center, rgba(244,67,54,0) 55%, rgba(244,67,54,.85) 100%); }
#parkHud .ph-flash { position: absolute; inset: 0; background: #f44336; opacity: 0; }
@keyframes phBlink { 50% { color: #FFEB3B; } }
`);

const root = document.createElement("div");
root.id = "parkHud";
root.className = "hidden";
root.innerHTML = `<div class="ph-vig"></div><div class="ph-flash"></div>`;
const mount = () => document.body.appendChild(root);
if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
const el = { vig: root.querySelector(".ph-vig"), flash: root.querySelector(".ph-flash") };

export const PH = {
    show(on) { root.classList.toggle("hidden", !on); },
    vignette(a) { el.vig.style.opacity = a.toFixed(3); },
    flash(a) { el.flash.style.opacity = (a * 0.35).toFixed(3); },
    hint() { },
    reset() { PH.vignette(0); PH.flash(0); },
};
