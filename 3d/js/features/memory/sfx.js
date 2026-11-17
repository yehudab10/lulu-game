// features/memory — a tiny WebAudio horn for the grudge car (its own context, like
// banter's other-driver horns). Silent while skipping or with the sound off.
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";

let ac = null, out = null;
function audio() {
    if (save3d.sound === false || ctx.skipping || ctx.TEST) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); } catch (e) { return null; }
        out = ac.createGain();
        out.gain.value = 0.45;
        out.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac.state === "running" ? ac : null;
}

/** An angry "BEEP BEEEEP" (truck: a deep air horn). */
export function honk(kind = "sedan", beeps = 2) {
    const a = audio();
    if (!a) return;
    const truck = kind === "truck", f = truck ? 150 : kind === "van" ? 320 : kind === "cop" ? 520 : 410;
    let t = a.currentTime + 0.02;
    for (let i = 0; i < beeps; i++) {
        const len = i === beeps - 1 ? 0.42 : 0.14;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.012);
        g.gain.setValueAtTime(0.12, t + len - 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        const lp = a.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = truck ? 900 : 2400;
        lp.connect(g); g.connect(out);
        for (const mul of truck ? [1, 1.26, 1.5] : [1, 1.25]) {
            const o = a.createOscillator();
            o.type = truck ? "sawtooth" : "square";
            o.frequency.setValueAtTime(f * mul, t);
            o.connect(lp); o.start(t); o.stop(t + len + 0.02);
        }
        t += len + 0.08;
    }
}
