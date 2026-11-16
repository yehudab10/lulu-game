// features/shabbos — is it erev Shabbos? (the device's LOCAL clock, like meta's holidays)
//
// Friday from about noon until evening → the rush is featured on the title screen.
// Tests / previews pin the clock: ?shabbosDate=2026-11-20T15:00 (local time), or at
// runtime ctx.shabbos.debug.date("2026-11-20T15:00") (null = the real clock again).
import { TUNE } from "./data.js";

const Q = new URLSearchParams(location.search);
let pinned = Q.get("shabbosDate");

export function setNow(iso) { pinned = iso || null; }
/** "Now" as a Date (the pinned clock when there is one). */
export function now() {
    if (pinned) { const d = new Date(pinned); if (!isNaN(d)) return d; }
    return new Date();
}
/** Friday afternoon (TUNE.friday.from ≤ hour < TUNE.friday.to, local time)? */
export function erevShabbos(d = now()) {
    const h = d.getHours();
    return d.getDay() === 5 && h >= TUNE.friday.from && h < TUNE.friday.to;
}
/** Friday at all (the Cruise event is likelier on a Friday). */
export const isFriday = (d = now()) => d.getDay() === 5;
