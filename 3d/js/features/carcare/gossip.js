// features/carcare/gossip.js — ☕ 24 HR GAS & GOSSIP: Bracha at the window tells Lulu ONE TRUE THING about today, a new one
// each real hour (free). Every fact is read from the feature that makes it true — a protest and its hours (cityhall), the
// mayor's edict (cityhall), the wrong-address picket / public comment night (cityhall's parody days), a wedding at the
// Avenue M Ballroom (family's hall rules), a shop open late tonight (storefronts' hours), where the speed cameras flash
// (cameras) — so the gossip is never wrong. (The pump itself is ci/fuel's.)
import { ctx } from "../../core/ctx.js";
import { GOSSIP } from "./data.js";
import { PROTEST_HOURS } from "../cityhall/data.js";
import { SCHOOL } from "../cameras/data.js";
import { SHOPS as STORE } from "../storefronts/data.js";
import { parse, clock, holyNow } from "../storefronts/hours.js";

const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const ap = h => { h = ((h % 24) + 24) % 24; const hh = Math.floor(h), mm = Math.round((h - hh) * 60), a = hh < 12 ? "am" : "pm"; return `${hh % 12 || 12}${mm ? ":" + String(mm).padStart(2, "0") : ""} ${a}`; };
const span = ([a, b]) => `${ap(a)}–${ap(b)}`;
const title = s => String(s).split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

/** Everything true about today right now: [{ id, text }]. */
export function facts(date = clock()) {
    const out = [], h = date.getHours() + date.getMinutes() / 60, wd = date.getDay();
    const holy = holyNow();
    const C = ctx.cityhall;
    const add = (id, text) => { if (text) out.push({ id, text }); };
    // a protest in town today (its hours) — and Midwood's mayor's edict of the day
    if (C && C.protest && !holy) for (const town of ["midwood", "lakewood"]) {
        const hrs = (PROTEST_HOURS[town] || []).filter(([, b]) => b > h);
        if (!hrs.length) continue;
        let topic = null;
        try { topic = C.protest.topic(town); } catch (e) { topic = null; }
        if (topic && topic.about) add("protest:" + town, fill(GOSSIP.protest, { town: town === "midwood" ? "Midwood" : "Lakewood", hours: hrs.map(span).join(" and "), about: topic.about }));
    }
    if (C && C.mayor31 && C.mayor31.today) {
        let e = null;
        try { e = C.mayor31.today(); } catch (err) { e = null; }
        if (e && e.title) add("edict", fill(GOSSIP.edict, { title: e.title, about: e.about || "" }));
    }
    // the owner's two parodies, on their days
    if (C && C.parody && C.parody.dayOn) {
        try { if (C.parody.dayOn("wa", date) && h < 14) add("wa", GOSSIP.wrong); } catch (e) { /* no parody */ }
        try { if (C.parody.dayOn("pcn", date) && h < 21) add("pcn", GOSSIP.comment); } catch (e) { /* no parody */ }
    }
    // the Avenue M Ballroom: weddings Sunday–Thursday evenings (family/avigail.js › hallNow)
    if (!holy && wd <= 4) add("wedding", h >= 18 ? GOSSIP.weddingNow : GOSSIP.wedding);
    // a shop open late tonight (storefronts' hours: a span today that ends at 11 pm or later)
    if (!holy) {
        const late = [];
        for (const name of Object.keys(STORE)) {
            const R = STORE[name];
            if (!R.hours) continue;
            for (const r of parse(R.hours)) if (r.days.has(wd)) for (const [a, b] of r.spans) if (b >= 23 && a <= h + 6 && b > h) late.push({ name, b });
        }
        if (late.length) { const l = late[(date.getDate() + date.getMonth()) % late.length]; add("late", fill(GOSSIP.late, { shop: title(l.name), till: ap(l.b) })); }
    }
    // the speed cameras: Ocean Parkway always; the school blocks in school hours
    add("pkwy", GOSSIP.pkwy);
    let school = false;
    try { school = !!(ctx.cameras && ctx.cameras.schoolHours && ctx.cameras.schoolHours()); } catch (e) { school = false; }
    if (school) { const names = Object.values(SCHOOL.spots); add("school", fill(GOSSIP.school, { school: names[date.getHours() % names.length] })); }
    if (wd === 5 && h >= 12) add("shabbos", GOSSIP.shabbosSoon);
    return out;
}
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** The real hour's key ("2026-11-27-14") — the gossip changes with it. */
export const hourKey = (d = clock()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
/** This hour's gossip (the same for everyone this hour): { id, text } or null. Prefers the rarer facts over the camera. */
export function gossipNow(date = clock()) {
    const all = facts(date);
    if (!all.length) return null;
    const rare = all.filter(f => f.id !== "pkwy");
    const pool = rare.length ? rare : all;
    return pool[hash(hourKey(date)) % pool.length];
}
