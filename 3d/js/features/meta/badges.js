// features/meta — the scrapbook BADGES (port of src/06c-scrapbook.js) + a few
// 3D-only ones. Earned = the 2D test on the SHARED save (with 3D progress
// counted too — a 50k score in 3D is a Road Legend) OR already recorded in
// save.badges, so a badge never un-earns itself (e.g. a lapsed streak).
import { shared, save3d } from "../../core/save.js";
import { SKINS } from "../../car.js";

export const HORN_COUNT = 6;    // src/06d-bling.js HORNS
export const DECOR_COUNT = 7;   // src/06d-bling.js DECOR
export const SKIN_COUNT = Object.keys(SKINS).length;

export const stat = (S, id) => (S.stats && S.stats[id]) || 0;
export const statB = (S, id) => (S.stats && S.stats.best && S.stats.best[id]) || 0;
export const avigailRel = S => (typeof S.avigailRel === "number" ? S.avigailRel : 50);
/** Best single-run score in either version. */
export const bestScore = S => Math.max(S.highScore || 0, statB(S, "best3d"), save3d.best || 0);
const storyStars = S => Object.values(S.storyStars || {}).filter(Boolean).length;
const hasPostcard = (S, id) => (S.postcards || []).includes(id);
const journey3d = () => (save3d.f && save3d.f.journey) || {};

// test(S) → earned?   prog(S) → [current, target]   secret: hidden until earned   three: 3D-only
export const BADGES = [
    { id: "firstRun",  icon: "🚗", name: "Learner's Permit", desc: "Finish your first drive",            test: S => (S.highScore || 0) > 0 || stat(S, "runs3d") > 0 || bestScore(S) > 0 },
    { id: "score10k",  icon: "🔥", name: "Lead Foot",        desc: "Score 10,000 in one run",            prog: S => [bestScore(S), 10000] },
    { id: "score50k",  icon: "🌟", name: "Road Legend",      desc: "Score 50,000 in one run",            prog: S => [bestScore(S), 50000] },
    { id: "chain8",    icon: "😤", name: "Daredevil",        desc: "Chain 8 close calls in one run",     prog: S => [statB(S, "chain6"), 8] },
    { id: "coins300",  icon: "🪙", name: "Coin Vacuum",      desc: "Grab 300 coins in one run",          prog: S => [statB(S, "runCoins250"), 300] },
    { id: "honks50",   icon: "📣", name: "Honk Symphony",    desc: "Honk-scare 50 cars",                 prog: S => [stat(S, "honks10"), 50] },
    { id: "missile25", icon: "🚀", name: "Demolition Diva",  desc: "Missile 25 cars",                    prog: S => [stat(S, "missiles8"), 25] },
    { id: "bubbe",     icon: "🏡", name: "Bubbe's Favorite", desc: "Make it to Bubbe's house",           test: S => hasPostcard(S, "bubbe") || (S.storyStop || 0) > 0 || (S.storyCycle || 0) > 0 || (journey3d().arrivals || 0) > 0 },
    { id: "vegas",     icon: "🎲", name: "Viva Las Vegas",   desc: "Finish the Road to Vegas",           test: S => (S.storyCycle || 0) >= 1 },
    { id: "tours3",    icon: "🗺️", name: "Tour Guide",       desc: "Finish the Road to Vegas 3 times",   prog: S => [S.storyCycle || 0, 3] },
    { id: "postcards", icon: "📮", name: "Postcard Pro",     desc: "Collect all 5 postcards",            prog: S => [(S.postcards || []).length, 5] },
    { id: "stars5",    icon: "⭐", name: "Teacher's Pet",    desc: "Earn all 5 chapter stars",           prog: S => [storyStars(S), 5] },
    { id: "streak7",   icon: "📅", name: "Every Day Driver", desc: "Play 7 days in a row",               prog: S => [S.streak || 0, 7] },
    { id: "escape5",   icon: "🚓", name: "Can't Catch Me",   desc: "Escape 5 cop chases",                prog: S => [stat(S, "escapes2"), 5] },
    { id: "jailbird",  icon: "⛓️", name: "Jailbird",         desc: "Get found guilty in court",          test: S => (S.convictions || 0) >= 1 },
    { id: "strikes3",  icon: "⚖️", name: "Three Strikes",    desc: "Rack up 3 convictions",              prog: S => [S.convictions || 0, 3] },
    { id: "houdini",   icon: "🗝️", name: "Houdini",          desc: "Break out of jail",                  test: S => (S.escapes || 0) >= 1 },
    { id: "dismissed", icon: "🤫", name: "Case Dismissed",   desc: "Walk out of court scot-free",        test: S => stat(S, "dismissed") >= 1 },
    { id: "er5",       icon: "🏥", name: "Frequent Flyer",   desc: "Visit the ER 5 times",               prog: S => [S.erVisits || 0, 5] },
    { id: "bff",       icon: "💜", name: "Besties",          desc: "Max out Avigail's friendship (90+)", prog: S => [avigailRel(S), 90] },
    { id: "nemesis",   icon: "😈", name: "Nemesis",          desc: "Sink Avigail's friendship to 10",    test: S => avigailRel(S) <= 10 },
    { id: "wedding",   icon: "💍", name: "Wedding Crasher",  desc: "Dance at Avigail's wedding",         test: S => stat(S, "weddings") >= 1 },
    { id: "uncles10",  icon: "👨", name: "Uncle Bingo",      desc: "Bump into the uncles 10 times",      prog: S => [stat(S, "uncles3"), 10] },
    { id: "heshy5",    icon: "🏊", name: "Pool Patrol",      desc: "Find Heshy 5 times",                 prog: S => [stat(S, "heshy2"), 5] },
    { id: "salon",     icon: "💇", name: "Fabio's Muse",     desc: "Get a makeover at the salon",        test: S => stat(S, "salon") >= 1 || (!!S.luluHair && S.luluHair !== "#8B5A2B") },
    { id: "imaCalls",  icon: "📞", name: "Ima's Favorite",   desc: "Stay on the phone with Ima 3 times", prog: S => [stat(S, "imaCalls"), 3] },
    { id: "eyesRoad",  icon: "👀", name: "Eyes on the Road", desc: "Honk to decline Ima's call",         test: S => stat(S, "imaDeclines") >= 1 },
    { id: "holiday",   icon: "🕎", name: "Holiday Spirit",   desc: "Open a holiday gift in the game",    test: S => stat(S, "holidayGifts") >= 1 },
    { id: "garage",    icon: "🏎️", name: "Full Garage",      desc: "Own every car in the shop",          prog: S => [(S.ownedSkins || ["pink"]).length, SKIN_COUNT] },
    { id: "hornsAll",  icon: "🎺", name: "DJ Lulu",          desc: "Own every horn in the Bling shop",   prog: S => [(S.ownedHorns || ["beep"]).length, HORN_COUNT] },
    { id: "blingAll",  icon: "💎", name: "Bling Queen",      desc: "Own every piece of car bling",       prog: S => [(S.ownedDecor || []).length, DECOR_COUNT] },
    { id: "walk10k",   icon: "🚶", name: "Leg Day",          desc: "Walk 10,000 on foot",                prog: S => [stat(S, "footDist"), 10000], unit: "dist" },
    { id: "sister",    icon: "🎒", name: "Secret Sister",    desc: "Found the hidden sister",            secret: true, test: S => (S.dinaRunsPlayed || 0) > 0 },
    { id: "dinaGold",  icon: "🥇", name: "Speedy Sister",    desc: "Win a gold medal racing home",       secret: true, test: S => !!(S.dinaMedals && S.dinaMedals.gold) },
    // ── 3D-only (the 2D board ignores these ids) ──
    { id: "drive3d",   icon: "🧊", name: "Third Dimension",  desc: "Finish a drive in Lulu's Road Trip 3D", three: true, test: S => stat(S, "runs3d") >= 1 },
    { id: "nitro50",   icon: "💨", name: "Nitro Junkie",     desc: "Fire the nitro 50 times in 3D",        three: true, prog: S => [stat(S, "boosts3d"), 50] },
    { id: "miles100",  icon: "🛞", name: "Odometer Queen",   desc: "Drive 100 miles in 3D",                three: true, prog: S => [Math.floor(stat(S, "miles3d")), 100] },
];

export function badgeProg(b, S) { try { return b.prog ? b.prog(S) : null; } catch (e) { return null; } }
function liveTest(b, S) {
    try {
        if (b.test) return !!b.test(S);
        const p = b.prog(S);
        return p[0] >= p[1];
    } catch (e) { return false; }
}
export function badgeEarned(b, S = shared.get()) {
    return (Array.isArray(S.badges) && S.badges.includes(b.id)) || liveTest(b, S);
}
/** Board order: every normal badge + secrets already earned. */
export function visibleBadges(S = shared.get()) { return BADGES.filter(b => !b.secret || badgeEarned(b, S)); }
export function badgeTotals(S = shared.get()) {
    let got = 0, tot = 0;
    for (const b of BADGES) {
        const e = badgeEarned(b, S);
        if (b.secret) { if (e) got++; continue; }
        tot++; if (e) got++;
    }
    return { got, tot };
}

/**
 * Record newly earned badges in the shared save.badges. Returns the NEW ones.
 * The very first sync only snapshots (veterans get the 📒 dot, not a pile of toasts).
 */
export function badgeSync() {
    const S = shared.get();
    const first = !Array.isArray(S.badges);
    const have = first ? [] : S.badges;
    const fresh = BADGES.filter(b => !have.includes(b.id) && liveTest(b, S));
    if (!first && !fresh.length) return [];
    shared.update(s => {
        if (!Array.isArray(s.badges)) { s.badges = []; s.scrapSeen = 0; }
        for (const b of fresh) if (!s.badges.includes(b.id)) s.badges.push(b.id);
    });
    return first ? [] : fresh;
}
/** A badge the player hasn't looked at yet (drives the 📒 "!" dot). */
export function scrapHasNew(S = shared.get()) { return Array.isArray(S.badges) && S.badges.length > (S.scrapSeen || 0); }
export function markScrapSeen() {
    shared.update(s => { s.scrapSeen = Array.isArray(s.badges) ? s.badges.length : 0; });
}
