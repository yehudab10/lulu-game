// features/seasons — WHAT DAY IS IT? The device's Hebrew calendar (Intl, like meta's holidays and the
// legacy 2D game), so there is no date table to keep updating.
//
// A Hebrew day starts at nightfall: after (about) sunset the date rolls over to tomorrow's, so the first
// candle of Chanukah is lit on the evening of 24 Kislev — the menorahs in the windows gain a candle each
// evening, not each morning. Sunset is approximated per month for the north-east US (Lakewood / Brooklyn
// local time) — close enough for a game; nobody's davening by it.
//
// today() → a small "what's on" record (see describe()). Previews / tests:
//   ?season=chanukah&night=5        a holiday by id (+ its day / night number)
//   ?seasonDate=2026-12-07T19:30   the real path on a pinned local date-time
//   ctx.seasons.debug.season(id, n) / ctx.seasons.debug.date(iso) at runtime (null = the real clock again)
// In a 🎉 party everyone uses the HOST's day (party.js publishes it; setHostDay()).

const Q = new URLSearchParams(location.search);

// ── the Hebrew date of a civil day (Intl) ────────────────────────────────
let fmt = null;
const hcache = new Map();
export function hebrewOf(date) {
    const k = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
    if (hcache.has(k)) return hcache.get(k);
    let out = null;
    try {
        if (!fmt) fmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { year: "numeric", month: "long", day: "numeric" });
        const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
        let m = null, d = null, y = null;
        for (const p of fmt.formatToParts(noon)) {
            if (p.type === "month") m = p.value;
            else if (p.type === "day") d = parseInt(p.value, 10);
            else if (p.type === "year" || p.type === "relatedYear") y = parseInt(p.value, 10);
        }
        if (m && d) out = { m: normMonth(m), d, y: y || 0 };
    } catch (e) { out = null; }
    if (hcache.size > 400) hcache.clear();
    hcache.set(k, out);
    return out;
}
// (some engines spell the months a little differently: Tishrei, Cheshvan, Teves, Tammuz…)
function normMonth(m) {
    const s = String(m).toLowerCase().replace(/[^a-z ]/g, "");
    if (/^tish/.test(s)) return "Tishri";
    if (/^(hesh|chesh|mar)/.test(s)) return "Heshvan";
    if (/^kis/.test(s)) return "Kislev";
    if (/^tev/.test(s)) return "Tevet";
    if (/^she/.test(s)) return "Shevat";
    if (/^adar ii|^adar 2|^adar sheni|^adar b/.test(s)) return "Adar II";
    if (/^adar i\b|^adar 1|^adar rishon|^adar a/.test(s)) return "Adar I";
    if (/^adar/.test(s)) return "Adar";
    if (/^nis/.test(s)) return "Nisan";
    if (/^iy/.test(s)) return "Iyar";
    if (/^siv/.test(s)) return "Sivan";
    if (/^tam/.test(s)) return "Tamuz";
    if (/^av/.test(s)) return "Av";
    if (/^elul/.test(s)) return "Elul";
    return m;
}
// about when the sun sets (local hour) in the north-east US, by civil month (with daylight time)
const SUNSET = [16.9, 17.5, 18.1, 19.5, 20.1, 20.5, 20.5, 20.0, 19.2, 18.4, 16.8, 16.5];
export const sunsetHour = date => SUNSET[date.getMonth()];

// ── the days that matter ─────────────────────────────────────────────────
// kind: "chag" (a festival — dressing + a greeting), "minor" (festive, work as usual), "fast" (quiet: no dressing),
// "solemn" (Yom Kippur, Tisha B'Av: quiet), "prep" (the days before: things going up), "mourning" (the Three Weeks)
export const DAYS = {
    roshHashana: { name: "Rosh Hashana", emoji: "🍎", greet: "Shana Tova!", kind: "chag", yomtov: true },
    tzomGedaliah: { name: "Tzom Gedalia", emoji: "🕯️", greet: "An easy fast", kind: "fast" },
    yomKippur: { name: "Yom Kippur", emoji: "🕊️", greet: "G'mar chasima tova", kind: "solemn", yomtov: true },
    sukkosPrep: { name: "Before Sukkos", emoji: "🔨", greet: "Sukkahs going up!", kind: "prep" },
    sukkos: { name: "Sukkos", emoji: "🌿", greet: "Chag Sameach!", kind: "chag" },
    simchasTorah: { name: "Shemini Atzeres & Simchas Torah", emoji: "📜", greet: "Chag Sameach!", kind: "chag", yomtov: true },
    chanukah: { name: "Chanukah", emoji: "🕎", greet: "Happy Chanukah!", kind: "minor" },
    asaraBTeves: { name: "Asara B'Teves", emoji: "🕯️", greet: "An easy fast", kind: "fast" },
    tuBishvat: { name: "Tu B'Shvat", emoji: "🌳", greet: "Happy Tu B'Shvat!", kind: "minor" },
    purimPrep: { name: "Before Purim", emoji: "🎁", greet: "Purim is coming!", kind: "prep" },
    taanisEsther: { name: "Taanis Esther", emoji: "📜", greet: "An easy fast — Purim tonight!", kind: "fast" },
    purim: { name: "Purim", emoji: "🎭", greet: "Freilichen Purim!", kind: "minor" },
    pesachPrep: { name: "Before Pesach", emoji: "🧹", greet: "Pesach cleaning!", kind: "prep" },
    erevPesach: { name: "Erev Pesach", emoji: "🔥", greet: "Burning the chametz!", kind: "prep" },
    pesach: { name: "Pesach", emoji: "🫓", greet: "Chag Kasher V'Sameach!", kind: "chag" },
    lagBaomer: { name: "Lag BaOmer", emoji: "🔥", greet: "Happy Lag BaOmer!", kind: "minor" },
    shavuosPrep: { name: "Before Shavuos", emoji: "💐", greet: "Shavuos is coming!", kind: "prep" },
    shavuos: { name: "Shavuos", emoji: "💐", greet: "Chag Sameach!", kind: "chag", yomtov: true },
    tamuz17: { name: "Shiva Asar B'Tamuz", emoji: "🕯️", greet: "An easy fast", kind: "fast" },
    threeWeeks: { name: "The Three Weeks", emoji: "🕯️", greet: "", kind: "mourning" },
    nineDays: { name: "The Nine Days", emoji: "🕯️", greet: "", kind: "mourning" },
    tishaBav: { name: "Tisha B'Av", emoji: "🕯️", greet: "An easy fast", kind: "solemn" },
};
const YOMTOV = { Tishri: [1, 2, 10, 15, 16, 22, 23], Nisan: [15, 16, 21, 22], Sivan: [6, 7] };

/** Which day of the year it is, from the Hebrew date (m, d), the Hebrew day's weekday (0 Sun … 6 Shabbos) and
 *  chanukahDay (1–8, when known) → [ids] (most important first). Pure: tests call it with made-up dates. */
export function classify(m, d, wd, chanukahDay = 0) {
    const out = [];
    const adar = m === "Adar" || m === "Adar II";
    if (m === "Tishri") {
        if (d <= 2) out.push("roshHashana");
        else if (d === 3 && wd !== 6) out.push("tzomGedaliah");
        else if (d === 4 && wd === 0) out.push("tzomGedaliah");
        else if (d === 10) out.push("yomKippur");
        else if (d >= 11 && d <= 14) out.push("sukkosPrep");
        else if (d >= 15 && d <= 21) out.push("sukkos");
        else if (d === 22 || d === 23) out.push("simchasTorah");
    }
    if (chanukahDay >= 1 && chanukahDay <= 8) out.push("chanukah");
    if (m === "Tevet" && d === 10) out.push("asaraBTeves");
    if (m === "Shevat" && d === 15) out.push("tuBishvat");
    if (adar) {
        // Taanis Esther is moved back to Thursday the 11th when the 13th is Shabbos
        if ((d === 13 && wd !== 6) || (d === 11 && wd === 4)) out.push("taanisEsther");
        if (d === 14) out.push("purim");
        else if (d >= 8 && d <= 13) out.push("purimPrep");
    }
    if (m === "Nisan") {
        // the chametz is burned on the morning of the 14th — on Friday the 13th when the 14th is Shabbos
        if ((d === 14 && wd !== 6) || (d === 13 && wd === 5)) out.push("erevPesach");
        if (d >= 1 && d <= 14) out.push("pesachPrep");
        else if (d >= 15 && d <= 22) out.push("pesach");
    }
    if (m === "Iyar" && d === 18) out.push("lagBaomer");
    if (m === "Sivan") {
        if (d >= 3 && d <= 5) out.push("shavuosPrep");
        else if (d === 6 || d === 7) out.push("shavuos");
    }
    // the 17th of Tamuz and the 9th of Av move to Sunday when they fall on Shabbos
    if (m === "Tamuz" && ((d === 17 && wd !== 6) || (d === 18 && wd === 0))) out.push("tamuz17");
    if (m === "Av" && ((d === 9 && wd !== 6) || (d === 10 && wd === 0))) out.push("tishaBav");
    if (!out.includes("tishaBav") && !out.includes("tamuz17")) {
        if (m === "Av" && d <= 9) out.push("nineDays");
        else if ((m === "Tamuz" && d >= 17) || (m === "Av" && d === 10 && wd === 0)) out.push("threeWeeks");
    }
    return out;
}
export const isYomTov = (m, d) => !!(YOMTOV[m] && YOMTOV[m].includes(d));

// ── the clock (real, pinned, or the party host's) ────────────────────────
let pinned = Q.get("seasonDate") || null;
let forced = Q.get("season") ? { id: Q.get("season"), n: Math.max(1, parseInt(Q.get("night") || Q.get("seasonDay") || "1", 10) || 1), wd: Q.has("seasonWd") ? +Q.get("seasonWd") : null, eve: Q.get("seasonEve") !== "0" } : null;
let host = null;          // a party host's day: { f: forced | null, t: "YYYY-MM-DDTHH:MM" local } (party.js)

export function now() {
    if (pinned) { const d = new Date(pinned); if (!isNaN(d)) return d; }
    return new Date();
}
export function setDate(iso) { pinned = iso || null; cache = null; }
export function setForced(id, n = 1, opts = {}) { forced = id ? { id, n: Math.max(1, n | 0), wd: opts.wd != null ? opts.wd : null, eve: opts.eve !== false } : null; cache = null; }
export function setHostDay(h) { const k = h ? JSON.stringify(h) : ""; if (k === hostKey) return false; host = h || null; hostKey = k; cache = null; return true; }
let hostKey = "";
export const hostDay = () => host;
/** What this device would publish to a party (its own day). */
export function myDay() {
    const d = now(), p = n => String(n).padStart(2, "0");
    return { f: forced ? [forced.id, forced.n, forced.wd, forced.eve ? 1 : 0] : null,
        t: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` };
}

// Chanukah's day number (1–8) for the Hebrew day that civil `date` is in (walk back to 25 Kislev)
function chanukahDayOf(date) {
    for (let back = 0; back < 8; back++) {
        const h = hebrewOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() - back, 12));
        if (!h) return 0;
        if (h.m === "Kislev" && h.d === 25) return back + 1;
    }
    return 0;
}

let cache = null;
/** Today: { key, heb: {m, d, y}, wd (the Hebrew day's weekday), evening (after sunset), ids, main, chanukah (1–8),
 *  shabbos, yomtov, erev (Friday afternoon), candles (Shabbos / Yom Tov candles in the windows tonight), forced, source } */
export function today() {
    const src = host ? "host" : forced ? "forced" : pinned ? "pinned" : "device";
    const f = host ? (host.f ? { id: host.f[0], n: host.f[1], wd: host.f[2], eve: !!host.f[3] } : null) : forced;
    const base = host && !host.f ? new Date(host.t) : now();
    const minute = Math.floor(base.getTime() / 60000);
    const key = src + ":" + minute + ":" + (f ? f.id + f.n + ":" + f.wd : "");
    if (cache && cache.k === key) return cache.v;
    let v;
    if (f) v = forcedDay(f, base);
    else v = realDay(isNaN(base) ? new Date() : base);
    v.source = src;
    cache = { k: key, v };
    return v;
}

function realDay(date) {
    const evening = date.getHours() + date.getMinutes() / 60 >= sunsetHour(date);
    const civil = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (evening ? 1 : 0), 12);
    const heb = hebrewOf(civil);
    const wd = civil.getDay();
    const out = { key: `${civil.getFullYear()}-${civil.getMonth() + 1}-${civil.getDate()}`, heb, wd, evening, forced: false };
    if (!heb) return Object.assign(out, { ids: [], main: null, chanukah: 0, shabbos: false, yomtov: false, erev: false, candles: false, none: true });
    const ch = chanukahDayOf(civil);
    return finish(out, classify(heb.m, heb.d, wd, ch), ch, date);
}

// a made-up day for a holiday id (previews / tests): the Hebrew date that id lives on
const FAKE = {
    roshHashana: ["Tishri", 1], tzomGedaliah: ["Tishri", 3], yomKippur: ["Tishri", 10], sukkosPrep: ["Tishri", 12], sukkos: ["Tishri", 15],
    simchasTorah: ["Tishri", 23], chanukah: ["Kislev", 25], asaraBTeves: ["Tevet", 10], tuBishvat: ["Shevat", 15], purimPrep: ["Adar", 10],
    taanisEsther: ["Adar", 13], purim: ["Adar", 14], pesachPrep: ["Nisan", 8], erevPesach: ["Nisan", 14], pesach: ["Nisan", 15], lagBaomer: ["Iyar", 18],
    shavuosPrep: ["Sivan", 4], shavuos: ["Sivan", 6], tamuz17: ["Tamuz", 17], threeWeeks: ["Tamuz", 25], nineDays: ["Av", 5], tishaBav: ["Av", 9],
    shabbos: ["Heshvan", 20], friday: ["Heshvan", 19], none: ["Heshvan", 15],
};
function forcedDay(f, date) {
    const fk = FAKE[f.id] || FAKE.none;
    let [m, d] = fk;
    const n = f.n || 1;
    let ch = 0;
    if (f.id === "chanukah") { ch = Math.min(8, n); d = 24 + ch; if (d > 29) { m = "Tevet"; d -= 29; } }
    else if (n > 1 && f.id !== "shabbos" && f.id !== "friday") d += n - 1;
    // weekday: Shabbos for "shabbos", Friday for "friday", a Tuesday otherwise (unless pinned with seasonWd)
    const wd = f.wd != null ? f.wd : f.id === "shabbos" ? 6 : f.id === "friday" ? 5 : 2;
    const out = { key: `forced-${f.id}-${n}-${wd}`, heb: { m, d, y: 0 }, wd, evening: f.eve, forced: true };
    const ids = classify(m, d, wd, ch);
    // (a preview of a day the classifier puts elsewhere — e.g. Taanis Esther on Shabbos — still shows that id)
    if (FAKE[f.id] && DAYS[f.id] && !ids.includes(f.id)) ids.unshift(f.id);
    return finish(out, ids, ch, date, f.id === "friday");
}

function finish(out, ids, ch, date, fakeFriday = false) {
    const shabbos = out.wd === 6;
    const yomtov = isYomTov(out.heb.m, out.heb.d) && !ids.some(id => DAYS[id] && DAYS[id].kind === "fast");
    // Friday afternoon (before sunset): the erev-Shabbos bustle — not Thursday night, though its Hebrew day is already Friday
    const erev = fakeFriday || (out.wd === 5 && !out.forced && !out.evening && date.getHours() >= 11);
    const main = ids.find(id => DAYS[id] && DAYS[id].kind !== "mourning") || ids[0] || (erev ? "friday" : shabbos ? "shabbos" : null);
    return Object.assign(out, {
        ids, main, chanukah: ch, shabbos, yomtov, erev,
        candles: shabbos || yomtov,                      // Shabbos / Yom Tov candles in the windows after dark
        quiet: ids.some(id => DAYS[id] && (DAYS[id].kind === "fast" || DAYS[id].kind === "solemn" || DAYS[id].kind === "mourning")),
    });
}
