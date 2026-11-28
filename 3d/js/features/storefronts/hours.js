// features/storefronts/hours.js — opening hours on the WORLD's clock (worldNow below: today's date — the device's, or one
// tests pin with seasons/calendar.js setDate — at the hour the sky shows) + the weekday + the Jewish calendar
// (ctx.seasons.day(): Shabbos and Yom Tov close every shop, from Friday evening; a `shabbos: "motzei"` shop opens again
// Saturday night after it).
// Format (data.js): "D-D h-h, h-h; D h-h" — days 0 (Sun) … 6 (Sat); hours as numbers (6.5 = 6:30; 26 = 2 am next day).
import { ctx } from "../../core/ctx.js";
import { now as calNow } from "../seasons/calendar.js";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cache = new Map();
/** "0-4 10-19; 5 10-13" → [{ days: Set, spans: [[10, 19]] }, …] */
export function parse(str) {
    if (cache.has(str)) return cache.get(str);
    const out = [];
    for (const part of String(str || "").split(";")) {
        const m = part.trim().match(/^(\d)(?:-(\d))?\s+(.+)$/);
        if (!m) continue;
        const a = +m[1], b = m[2] != null ? +m[2] : a, days = new Set();
        for (let d = a; ; d = (d + 1) % 7) { days.add(d); if (d === b) break; }
        const spans = m[3].split(",").map(s => s.trim().split("-").map(Number)).filter(s => s.length === 2 && s.every(n => !isNaN(n)));
        out.push({ days, spans });
    }
    cache.set(str, out);
    return out;
}
/**
 * The world's clock (ci/sweep-logic2): in a Cruise day the sky runs its own day (features/atmos, ~9 minutes; the 📱's
 * clock and the households' schedules follow it), so the hour of the day comes from THAT clock — a shop said "CLOSED ·
 * opens 7 am" under the noon sun, a school-zone camera flashed under the stars. The date (the weekday, Shabbos, the
 * holidays) stays the real one: the sky's day goes round and round inside it (`date.cycle` — the sky's "tomorrow
 * morning" is still today's weekday). Anywhere else (the title — whose sky already IS the device's time —, a Story
 * Trip, tests without atmos) it's the device's / the pinned time.
 */
export function worldNow() {
    const d = calNow(), A = ctx.atmos;
    if (!A || A.mode !== "cruise" || typeof A.clock !== "number" || ctx.state === "title") return d;
    const h = (7.3 + A.clock * 24) % 24, hh = Math.floor(h);
    const w = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, Math.floor((h - hh) * 60));
    Object.defineProperty(w, "cycle", { value: true });
    return w;
}
export const clock = () => worldNow();
/** Shabbos / Yom Tov right now (the seasons calendar's day — the party host's in a 🎉 party). */
export function holyNow() {
    const d = ctx.seasons && ctx.seasons.day ? ctx.seasons.day() : null;
    return !!(d && (d.shabbos || d.yomtov));
}
/** Is a shop with `hours` open at `date`? (spans past 24 belong to the day they started) */
export function openAt(hours, date = clock(), opts = {}) {
    if (!hours) return true;
    const holy = opts.holy != null ? opts.holy : holyNow();
    if (holy) return false;
    const wd = date.getDay(), h = date.getHours() + date.getMinutes() / 60;
    for (const r of parse(hours)) for (const [a, b] of r.spans) {
        if (r.days.has(wd) && h >= a && h < Math.min(b, 24)) return true;
        // (last night's span runs past midnight — in the sky's day, "last night" was today's weekday too)
        if (b > 24 && r.days.has(date.cycle ? wd : (wd + 6) % 7) && h < b - 24) return true;
    }
    return false;
}
const fmt = h => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60), ap = hh < 12 ? "am" : "pm", h12 = hh % 12 || 12; return mm ? `${h12}:${String(mm).padStart(2, "0")} ${ap}` : `${h12} ${ap}`; };
/** "opens 6:30 am" / "opens Thu 7 pm" — the next opening within a week (Shabbos-aware only roughly: it skips Saturday daytime). */
export function nextOpen(hours, date = clock()) {
    if (!hours) return "";
    if (date.cycle && holyNow()) date = calNow();      // (Shabbos / Yom Tov run on the real clock: it opens after them)
    const wd = date.getDay(), h = date.getHours() + date.getMinutes() / 60;
    // (the sky's day: its next morning is still today's weekday — "opens 7 am", not "opens tomorrow" / "Sun")
    if (date.cycle) {
        let later = null, first = null;
        for (const r of parse(hours)) if (r.days.has(wd)) for (const [a] of r.spans) {
            if (a > h && (later == null || a < later)) later = a;
            if (first == null || a < first) first = a;
        }
        if (first != null) return `opens ${fmt(later != null ? later : first)}`;
    }
    for (let k = 0; k < 8; k++) {
        const d = (wd + k) % 7;
        let best = null;
        for (const r of parse(hours)) if (r.days.has(d)) for (const [a] of r.spans) if ((k > 0 || a > h) && (best == null || a < best)) best = a;
        if (best != null) return k === 0 ? `opens ${fmt(best)}` : k === 1 ? `opens tomorrow ${fmt(best)}` : `opens ${DAY[d]} ${fmt(best)}`;
    }
    return "";
}
/** Today's hours in words, for the street directory: "10 am–7 pm" · "closed today" · "Shabbos — closed". */
export function todayText(hours, date = clock()) {
    if (holyNow()) return "Shabbos — closed";
    if (!hours) return "open";
    const wd = date.getDay(), spans = [];
    for (const r of parse(hours)) if (r.days.has(wd)) for (const [a, b] of r.spans) spans.push(`${fmt(a)}–${fmt(b)}`);
    return spans.length ? spans.join(", ") : "closed today";
}
