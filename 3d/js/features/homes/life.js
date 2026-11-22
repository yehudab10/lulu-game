// features/homes — 🏡 HOUSEHOLDS WITH A LIFE: who they are, what they think of Lulu, and what is going on inside
// right now.
//
//   identity   a door's family is a pure function of its STABLE id (index.js family()): the surname, the cast, the
//              first names — plus here two TRAITS (bakers, a musical family, neat freaks, night owls…) and maybe a
//              Zeidy. The same family every run, on every screen.
//   opinion    what they think of her, from the saved record (store("homes").fam): guest visits and favours warm
//              them up, break-ins cool them down → "stranger" · "knows her" · "likes her" · "loves her" · "wary" ·
//              "furious". A family that likes her greets her BY NAME.
//   schedule   when() reads the hour (the game's clock — the sky she sees, the phone's time; a 🎉 party shares it),
//              the weekday + the Jewish calendar (ctx.seasons.day(): the host's day in a party) → sceneFor(home)
//              picks one of SCENES (scenes.js) — seeded by the house + the day + a two-hour slot, so friends at the
//              same door see the same scene and the same house differs as the evening goes on.
import { ctx } from "../../core/ctx.js";
import { SCENES } from "./scenes.js";

export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

/** Household traits (two each): they tilt which scenes a house plays, and colour the door + the lines. */
export const TRAITS = {
    bakers: { label: "always something in the oven", scenes: { supper: 1.4, kiddush: 1.6, bake: 3 } },
    musical: { label: "a musical family (allegedly)", scenes: { violin: 4 } },
    neat: { label: "neat freaks", scenes: { erevShabbos: 1.6, pesachClean: 2 } },
    loud: { label: "LOUD", scenes: { supper: 1.3, homework: 1.5 } },
    learners: { label: "a learning family", scenes: { shabbosTable: 1.3, homework: 1.3 } },
    hosts: { label: "always have guests", scenes: { shabbosTable: 1.5, vort: 2, shevaBrachos: 2, kiddush: 1.5 } },
    nightOwls: { label: "night owls", scenes: { cereal: 2.5, pizza: 1.3 } },
    handy: { label: "the house is always half-fixed", scenes: { plumber: 3 } },
    travellers: { label: "always on the way somewhere", scenes: { minivan: 3 } },
    games: { label: "board-game people", scenes: { mahjongg: 2.5 } },
};
const TRAIT_IDS = Object.keys(TRAITS);

/** The identity extras for a household (pure: id → the same answer everywhere). Mutates + returns `home`. */
export function identity(home) {
    if (home.traits) return home;
    const R = rngOf(hash(home.key + ":life"));
    const a = TRAIT_IDS[Math.floor(R() * TRAIT_IDS.length)];
    let b = TRAIT_IDS[Math.floor(R() * TRAIT_IDS.length)];
    if (b === a) b = TRAIT_IDS[(TRAIT_IDS.indexOf(a) + 3) % TRAIT_IDS.length];
    home.traits = [a, b];
    // Zeidy lives here too (sometimes, with Bubbe)
    if (home.cast.includes("bubbe") && !home.cast.includes("zeidy") && R() < 0.45 && home.cast.length < 6) {
        home.cast = home.cast.slice(); home.cast.push("zeidy");
        home.names = Object.assign({}, home.names, { zeidy: "Zeidy " + ["Berel", "Yankel", "Hershel", "Avrum", "Fishel"][Math.floor(R() * 5)] });
    }
    return home;
}

// ── what they think of her ──────────────────────────────────────────────
/** A family's warmth toward Lulu from its saved record: + guest visits, favours, gifts; − break-ins, reports. */
export function warmth(rec) {
    if (!rec) return 0;
    return (rec.guest | 0) * 1 + (rec.favours | 0) * 1.5 + (rec.gifts | 0) * 0.5 - (rec.burgled | 0) * 2 - (rec.reported | 0) - (rec.kept | 0) * 1.5;
}
export function opinion(rec, home = null) {
    const nb = !!(home && home.neighbour);
    if (!rec || !(rec.visits || rec.favours || rec.knocks)) return nb ? "likes" : "stranger";
    const w = warmth(rec) + (nb ? 2 : 0);
    if (w <= -3) return "furious";
    if (w < 0) return "wary";
    if (w >= 4) return "loves";
    if (w >= 1.5) return "likes";
    return "knows";
}
export const OPINION_LINE = {
    stranger: "", knows: "They know your face.", likes: "They like you here.", loves: "You're practically family.",
    wary: "They watch you through the curtains.", furious: "The curtains twitch. Three locks click.",
};
/** Does this family greet her by name? (a favour done, or two good visits) */
export const byName = (rec, home = null) => (home && home.neighbour && warmth(rec) > -2) || (!!rec && (rec.favours > 0 || warmth(rec) >= 2) && warmth(rec) > 0);

// ── the clock + the calendar ─────────────────────────────────────────────
export const LIFE = { force: null };
/** The hour on the game's clock (the same formula as the 📱 phone: atmos 0.03 ≈ 8 am, sunset ≈ 7 pm, night ≈ midnight). */
export function gameHour() {
    if (LIFE.force && LIFE.force.hour != null) return LIFE.force.hour;
    const c = ctx.atmos && typeof ctx.atmos.clock === "number" ? ctx.atmos.clock : null;
    if (c == null) { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
    return (7.3 + c * 24) % 24;
}
/** The atmos clock for an hour (tests / the debug hook). */
export const clockFor = h => ((((h - 7.3) / 24) % 1) + 1) % 1;
/** Now: { hour, wd (0 Sun … 6 Shabbos), shabbos, friday (erev Shabbos afternoon), motzei, ids (the calendar's), key, month, yomtov, quiet } */
export function when() {
    const F = LIFE.force || {};
    const d = ctx.seasons && ctx.seasons.day ? ctx.seasons.day() : null;
    const now = new Date();
    const hour = gameHour();
    const wd = F.wd != null ? F.wd : d ? d.wd : now.getDay();
    const ids = F.ids || (d ? d.ids.slice() : []);
    const shabbos = F.shabbos != null ? F.shabbos : d ? !!d.shabbos : wd === 6;
    const friday = F.friday != null ? F.friday : d ? !!d.erev : wd === 5 && now.getHours() >= 11;
    const motzei = F.motzei != null ? F.motzei : d ? d.wd === 0 && !!d.evening && (hour >= 17 || hour < 3) : false;
    return { hour, wd, shabbos, friday, motzei, ids, key: d ? d.key : `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`,
        month: now.getMonth(), yomtov: !!(d && d.yomtov), quiet: !!(d && d.quiet), chanukah: d ? d.chanukah | 0 : 0 };
}
export const has = (w, id) => w.ids.includes(id);
/** School / work hours on a weekday (the adults out, the kids at school). */
export const workday = w => !w.shabbos && !w.yomtov && w.wd >= 0 && w.wd <= 5 && w.hour >= 8.5 && w.hour < 15.5 && !(w.wd === 5 && w.hour >= 13) && w.wd !== 0;

// ── the scene for a house, now ───────────────────────────────────────────
/** The party's shared seed (friends at one door see one scene); solo: "". */
function partySeed() { try { return ctx.party && ctx.party.active && ctx.party.seed != null ? String(ctx.party.seed) : ""; } catch (e) { return ""; } }
/** Which scene a household is in right now: { def, seed, w } (def = a SCENES entry). force: a scene id (tests / previews). */
export function sceneFor(home, w = when(), force = null) {
    identity(home);
    if (force && SCENES[force]) return { def: SCENES[force], seed: hash(home.key + ":" + force), w };
    // a house the town left DARK (town/build.js \`dark\`: features/life never lights its windows): after dark, they're out
    if (home.dark && (w.hour >= 17.5 || w.hour < 6) && !w.shabbos && !w.yomtov) return { def: SCENES.out, seed: hash(home.key + ":out"), w };
    const slot = Math.floor(w.hour / 2);
    const seed = hash(`${home.key}|${w.key}|${slot}|${partySeed()}`);
    const R = rngOf(seed);
    const list = [];
    let total = 0;
    for (const def of Object.values(SCENES)) {
        if (def.needs && !def.needs(home)) continue;
        let wt = 0;
        try { wt = def.when(w, home) || 0; } catch (e) { wt = 0; }
        if (wt <= 0) continue;
        for (const t of home.traits) { const m = TRAITS[t].scenes[def.id]; if (m) wt *= m; }
        list.push([def, wt]); total += wt;
    }
    if (!list.length) return { def: SCENES.ordinary, seed, w };
    let r = R() * total;
    for (const [def, wt] of list) { r -= wt; if (r <= 0) return { def, seed, w }; }
    return { def: list[list.length - 1][0], seed, w };
}
/** Who is home for a scene (the scene's own `away` list — work, school, the mountains — or everyone). */
export function presentCast(home, scene, w) {
    const away = scene.def.away ? scene.def.away(w, home) || [] : [];
    return home.cast.filter(k => !away.includes(k));
}
