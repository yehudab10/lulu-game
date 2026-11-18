// features/town/towns — every town you can turn into. Each is plain data (see lakewood.js,
// midwood.js); the engine (plan / build / cars / life / rail / landmarks) and the highway exits
// read it. Add a town: write towns/<id>.js (+ its lines), import it here, add it to INTERCHANGE
// (Cruise's interchanges offer every town listed there, one ramp each after the split), and (if it
// needs new block uses or props) teach build.js's layoutFace / the asset modules about them.
import lakewood from "./lakewood.js";
import midwood from "./midwood.js";

export const TOWNS = { lakewood, midwood };
/** The default town (tests / debug / `ctx.town.enter()` with no town): Lakewood. Kept for callers that index by k. */
export function townFor(k = 0) { return k % 2 ? TOWNS.midwood : TOWNS.lakewood; }

/**
 * Cruise's interchanges: every one offers BOTH towns — one off-ramp that splits after the gore
 * (the inner branch first). `signs` are the interchange's own boards (each town's funny copy is on
 * its own branch); `{no}` / `{label}` in a line fill in per town (joined with " · ").
 */
export const INTERCHANGE = {
    towns: [lakewood, midwood],
    signs: {
        mile: ["EXITS {no}", "{label}", "1 MI"],
        half: ["{no0} {label0} ↗", "{no1} {label1} ↗", "½ MI · totally optional"],
        lastChance: ["LAKEWOOD OR BROOKLYN?", "CHOOSE WISELY", "(or just keep driving)"],
        thru: ["↑ THRU TRAFFIC", "EVERYWHERE ELSE", "(no pressure)"],
        exitOnly: ["EXIT {no} ↘", "{label}", "EXIT ONLY"],
        gore: ["EXIT ↗", "{no}"],
        split: ["↖ {no0} {label0}", "↗ {no1} {label1}"],
    },
};
/** Fill a sign line for a set of towns: {no} → "91 · 9", {label} → "LAKEWOOD · BROOKLYN", {no1} → the second town's… */
export function fillLine(line, towns) {
    return line.replace(/\{(no|label|short)(\d?)\}/g, (_, k, i) => i !== "" ? (towns[+i] ? towns[+i].highway[k] : "") : towns.map(t => t.highway[k]).join(" · "));
}
