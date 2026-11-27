// features/storefronts/hours.js — opening hours on the game clock (the device's own time — the world's day follows it;
// tests pin it with seasons/calendar.js setDate) + the weekday + the Jewish calendar (ctx.seasons.day(): Shabbos and Yom
// Tov close every shop, from Friday evening; a `shabbos: "motzei"` shop opens again Saturday night after it).
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
export const clock = () => calNow();
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
        if (b > 24 && r.days.has((wd + 6) % 7) && h < b - 24) return true;          // (last night's span runs past midnight)
    }
    return false;
}
const fmt = h => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60), ap = hh < 12 ? "am" : "pm", h12 = hh % 12 || 12; return mm ? `${h12}:${String(mm).padStart(2, "0")} ${ap}` : `${h12} ${ap}`; };
/** "opens 6:30 am" / "opens Thu 7 pm" — the next opening within a week (Shabbos-aware only roughly: it skips Saturday daytime). */
export function nextOpen(hours, date = clock()) {
    if (!hours) return "";
    const wd = date.getDay(), h = date.getHours() + date.getMinutes() / 60;
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
