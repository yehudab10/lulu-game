// A SOFT CUT between two places — ctx.dissolve(swap, { ms }).
//
// Some changes of place can't be animated: a town is a street grid far from the highway, so taking its exit is
// a teleport; so is a warp to a friend. Instead of a fade to black (or a hard cut), the frame on screen is frozen
// onto an overlay, swap() runs behind it (the teleport, a district swap — even a long building frame), and the
// overlay melts away over the new picture. It reads as one continuous shot that changes scenery.
//
// Use it only when the next place is READY (its models loaded): the overlay is a frozen frame, and a frozen frame
// that lasts seconds looks like a hang — waiting on a download still wants a real fade with a label.
// Where a snapshot can't be taken (skipping a cutscene, a hidden tab, no renderer) swap() simply runs.
import { ctx } from "./ctx.js";

let el = null, g2 = null, gen = 0;
function ensure() {
    if (el) return;
    el = document.createElement("canvas");
    el.id = "softCut";
    el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;display:none";
    (document.getElementById("scene") || document.body.firstChild).after(el);
    g2 = el.getContext("2d");
}

/** Freeze the picture, run swap() behind it, melt into whatever is drawn next. → swap()'s return value. */
export function dissolve(swap, { ms = 420 } = {}) {
    const r = ctx.renderer;
    let shown = false;
    if (r && !ctx.skipping && !document.hidden) {
        try {
            ensure();
            const src = r.domElement;
            const w = Math.max(2, Math.min(src.width, 1280)), h = Math.max(2, Math.round(src.height * w / Math.max(1, src.width)));
            if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
            const v = ctx.view;
            r.render(v ? v.scene : ctx.scene, v ? v.camera : ctx.camera);      // (the drawing buffer is only readable right after a draw)
            g2.drawImage(src, 0, 0, w, h);
            el.style.transition = "none";
            el.style.display = "block";
            el.style.opacity = "1";
            shown = true;
        } catch (e) { shown = false; if (el) el.style.display = "none"; }
    }
    try { return swap(); }
    finally {
        if (shown) {
            const id = ++gen;
            // two frames on the new picture is underneath: melt
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (id !== gen) return;
                el.style.transition = `opacity ${ms}ms ease-out`;
                el.style.opacity = "0";
                setTimeout(() => { if (id === gen) el.style.display = "none"; }, ms + 80);
            }));
        }
    }
}
/** Is a soft cut on screen right now? (tests) */
export const dissolving = () => !!el && el.style.display !== "none";
ctx.dissolve = dissolve;
