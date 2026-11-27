// features/cityhall/parodyday.js — WHEN the two roadmap-38 parodies happen (wrongaddress.js, comment.js): a fixed hash of the
// real date (the same for every friend), `rate` of the eligible days each; never on Shabbos, a Friday, Yom Tov or a fast /
// solemn day (and an EVENING event never on the eve of one — after sunset it's already that day). Pure functions of a Date,
// so the test can walk a whole year. Plus the per-day variety picker (a seeded shuffle: the shop, who's there, the signs).
import { hebrewOf, classify, isYomTov, DAYS } from "../seasons/calendar.js";
import { WRONG_ADDRESS as WA, COMMENT_NIGHT as CN } from "./data.js";

/** Test knobs: { date (ISO / Date: "now"), wa / pcn (true / false: force on / off), hour (a fractional hour) }. */
export const PD = { force: {} };
export const now = () => (PD.force.date ? new Date(PD.force.date) : new Date());
export const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
/** The hour, fractional (11:30 = 11.5). */
export const fhour = (d = now()) => (PD.force.hour != null ? PD.force.hour : d.getHours() + d.getMinutes() / 60);
export function h01(s) {
    let h = 2166136261;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}
/** A seeded random stream (mulberry32). */
export function rng(seed) {
    let a = Math.floor(h01(seed) * 4294967296) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(list, r) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const holy = d => {
    const h = hebrewOf(d);
    if (!h) return false;
    const ids = classify(h.m, h.d, d.getDay());
    return isYomTov(h.m, h.d) || ids.some(id => DAYS[id] && (DAYS[id].kind === "fast" || DAYS[id].kind === "solemn"));
};
/** A day neither parody may happen on: Shabbos, a Friday, Yom Tov, a fast / solemn day; `evening` → also the eve of one. */
export function quietDay(date, evening = false) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const wd = d.getDay();
    if (wd === 5 || wd === 6) return true;
    if (holy(d)) return true;
    if (evening && holy(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12))) return true;
    return false;
}
/** Is `kind` ("wa" | "pcn") on this real day (ignoring the hour)? */
export function dayOn(kind, date = now()) {
    const f = PD.force[kind];
    if (f != null) return !!f;
    const C = kind === "wa" ? WA : CN;
    if (quietDay(date, kind === "pcn")) return false;
    return h01(dayKey(date) + ":" + kind) < C.rate;
}
/** …and right now (its hours too)? */
export function onNow(kind, date = now()) {
    const C = kind === "wa" ? WA : CN, h = fhour(date);
    return dayOn(kind, date) && (PD.force[kind] === true && PD.force.hour == null ? true : h >= C.hours[0] && h < C.hours[1]);
}
