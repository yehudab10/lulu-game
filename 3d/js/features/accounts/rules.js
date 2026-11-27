// features/accounts/rules.js — THE USERNAME RULES + THE NAME FILTER, one file for both sides:
//   • the game imports it for instant feedback while she types (and for the suggestions it shows);
//   • the relay (server/accounts.mjs) imports THIS SAME FILE and is the one that decides (authoritative).
// Pure functions only — no DOM, no ctx, no imports — so a Cloudflare Worker, Node and the browser all run it.
//
// The rules (keep 3d/ARCHITECTURE.md › Accounts in step):
//   • 3–16 characters: letters A–Z / a–z, digits 0–9 and "_". Starts with a letter. No "__", no "_" at the end.
//   • Unique IGNORING case, underscores and look-alikes: norm("Lulu_K") === norm("LULUK") === norm("1u1uk").
//   • Not allowed (whatever the spelling: leet digits, stretched letters, underscores between letters): rude words,
//     slurs, sexual words, hate symbols; pretending to be the game's staff (admin, mod, official, support, …);
//     contact details (5+ digits = a phone number; insta / snap / tiktok / discord / whatsapp / gmail / www / "dm me").
// What a check answers: "" (fine) or a reason: "short" | "long" | "chars" | "start" | "under" | "rude" | "staff" | "contact".

export const MIN = 3, MAX = 16;
const SHAPE = /^[A-Za-z][A-Za-z0-9_]*$/;

// look-alikes → one letter (after lower-casing). Only things that LOOK the same: the two-letter ones first.
const PAIRS = [["rn", "m"], ["vv", "w"]];
const ONE = { "0": "o", "1": "i", "l": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" };

/** The uniqueness key: lower-case, underscores dropped, look-alikes folded. ("Lulu_K" → "iuiuk", "LuIuK" too) */
export function norm(name) {
    let s = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [a, b] of PAIRS) s = s.split(a).join(b);
    let out = "";
    for (const ch of s) out += ONE[ch] || ch;
    return out;
}
/** The filter's view: norm + a few more digit tricks, stretched letters squeezed ("Fuuuuck" → "fuck"). */
const MORE = { "9": "g", "6": "g", "2": "z" };
function fold(w) { let s = ""; for (const ch of norm(w)) s += MORE[ch] || ch; return s.replace(/(.)\1+/g, "$1"); }

// ── the lists (folded at load). SUB = anywhere in the name; TOK = a whole word of the name (or the whole name). ──
// SUB holds only words that are never innocent inside a longer word; short / ambiguous ones are TOK so names like
// "Classy", "Grapes", "Annalise", "Something" pass. RAW = patterns on the name as typed (case ignored).
const RUDE_SUB = [
    "fuck", "fuk", "phuck", "fvck", "shit", "shyt", "cunt", "bitch", "biatch", "bastard", "asshole", "arsehole", "dickhead",
    "motherf", "wanker", "twat", "bollock", "bullshit", "douche", "jackass", "dumbass", "fatass", "smartass",
    "nigger", "nigga", "negro", "faggot", "fagot", "retard", "tranny", "wetback", "raghead", "towelhead", "beaner",
    "nazi", "hitler", "swastika", "jihad", "holocaust", "killjew", "killall",
    "porn", "penis", "vagina", "pussy", "titties", "nipple", "dildo", "vibrator", "orgasm", "erotic", "horny", "sexy",
    "milf", "hentai", "nude", "naked", "blowjob", "handjob", "rimjob", "cumshot", "jizz", "semen", "sperm", "rectum",
    "scrotum", "testicle", "masturb", "fetish", "bdsm", "slut", "whore", "hooker", "stripper", "onlyfans",
    "suicide", "killyourself", "rapist", "molest", "pedophile", "incest", "cocaine", "heroin",
];
const RUDE_TOK = [
    "ass", "arse", "asses", "dick", "dik", "cock", "tit", "tits", "fag", "rape", "raped", "sex", "cum", "hoe", "hoes",
    "crap", "piss", "pissed", "damn", "hell", "butt", "fart", "turd", "wtf", "stfu", "gtfo", "omfg", "nsfw", "gay",
    "lesbo", "homo", "kill", "killer", "murder", "die", "dead", "death", "gun", "guns", "bomb", "drug", "drugs",
    "balls", "kink", "thot", "simp", "idiot", "stupid", "loser", "ugly", "fat", "dumb", "moron", "anal", "anus",
    "spic", "paki", "chink", "gook", "kike", "coon", "dyke", "clit", "pimp", "meth", "weed", "beer", "vodka", "drunk",
    "pedo", "kys", "isis", "terror", "terrorist", "heil", "fck",
];
const RUDE_RAW = [/kkk/i, /xxx/i, /boob/i, /(^|[^0-9])(69|420|88)([^0-9]|$)/, /dyke/i, /fck/i, /www/i];
const STAFF_SUB = [
    "admin", "moderator", "official", "support", "helpdesk", "customerservice", "luluteam", "teamlulu", "luluboats",
    "luluofficial", "reallulu", "developer", "gamemaster", "anthropic", "appstore", "staff", "verified",
];
const STAFF_TOK = ["mod", "mods", "dev", "devs", "gm", "ceo", "root", "bot", "team", "owner", "system", "server", "apple", "security"];
const CONTACT_SUB = [
    "instagram", "insta", "snapchat", "tiktok", "discord", "whatsapp", "telegram", "facebook", "twitter",
    "youtube", "twitch", "reddit", "gmail", "yahoo", "hotmail", "outlook", "icloud", "email", "callme",
    "textme", "dmme", "addme", "msgme", "www", "http", "dotcom", "phonenumber",
];
const CONTACT_TOK = ["dm", "ig", "yt", "fb", "sc", "tt", "com", "net", "org", "cell", "snap", "kik", "phone"];

const L = l => l.map(fold).filter(w => w.length >= 2);
const RS = L(RUDE_SUB), RT = new Set(L(RUDE_TOK)), SS = L(STAFF_SUB), STK = new Set(L(STAFF_TOK)),
    CS = L(CONTACT_SUB), CT = new Set(L(CONTACT_TOK));
// friendly words that happen to hold a SUB word: blanked out before the SUB search (folded)
const SAFE_IN = L(["Scunthorpe", "Penistone", "Shitake", "Shiitake", "Snapdragon", "Analyst", "Therapist", "Arsenal",
    "Sexton", "Sussex", "Essex", "Middlesex", "Matsumoto", "Cassandra", "Hancock", "Peacock", "Cockatoo", "Cocktail",
    "Dickens", "Moby", "Classic", "Grasshopper", "Embassy", "Massachusetts", "Assassin", "Bassist", "Passion",
    "Ashitaka", "Nudel", "Denude", "Semester", "Semenov", "Retardant", "Supporter", "Megaphone"]).sort((a, b) => b.length - a.length);

/** A name's words: split on "_", digits and camelCase humps; folded. ("BigDog_99" → ["big", "dog"]) */
function words(name) {
    const raw = String(name || "").replace(/([a-z])([A-Z])/g, "$1 $2").split(/[^A-Za-z]+/).filter(Boolean);
    return raw.map(fold).filter(Boolean);
}
function hitSub(folded, list) {
    let s = folded;
    for (const w of SAFE_IN) if (s.includes(w)) s = s.split(w).join("~");
    return list.some(w => s.includes(w));
}

/** Shape only (no lists): "" | "short" | "long" | "chars" | "start" | "under". */
export function shape(name) {
    const n = String(name == null ? "" : name);
    if (n.length < MIN) return "short";
    if (n.length > MAX) return "long";
    if (!/^[A-Za-z0-9_]+$/.test(n)) return "chars";
    if (!SHAPE.test(n)) return "start";
    if (/__/.test(n) || /_$/.test(n)) return "under";
    return "";
}
/** The full check: shape + the filter. → "" (fine) or a reason. */
export function check(name) {
    const sh = shape(name);
    if (sh) return sh;
    const n = String(name);
    const digits = (n.match(/[0-9]/g) || []).length;
    if (digits >= 5) return "contact";
    if (RUDE_RAW.some(r => r.test(n))) return "rude";
    const f = fold(n), ws = words(n), joined = ws.join("");
    const tok = set => ws.some(w => set.has(w) || set.has(w.replace(/s$/, ""))) || set.has(joined);
    if (hitSub(f, RS) || hitSub(joined, RS) || tok(RT)) return "rude";
    if (hitSub(f, SS) || hitSub(joined, SS) || tok(STK) || /^lulu(team|staff|admin|mod|support|help|official)/.test(f)) return "staff";
    if (hitSub(f, CS) || hitSub(joined, CS) || tok(CT)) return "contact";
    return "";
}

/** A line for each reason (interface text: docs/words.md). */
export const WHY = {
    short: `Use at least ${MIN} letters.`,
    long: `Use ${MAX} characters or fewer.`,
    chars: "Use only letters, numbers and _.",
    start: "Start with a letter.",
    under: "Use one _ at a time, and not at the end.",
    rude: "That name isn't allowed. Try another one.",
    staff: "That sounds like someone who works on the game. Try another one.",
    contact: "Names can't have phone numbers or social media in them.",
    taken: "Someone already has that name.",
    retired: "That name can't be used. Try another one.",
    wait: "You can change your name once a month.",
    offline: "Can't check names right now. Try again in a bit.",
};

// ── suggestions (made the same way on both sides; the server keeps only the free ones) ──
export const ADJ = ["Zippy", "Speedy", "Happy", "Sunny", "Turbo", "Lucky", "Jolly", "Brave", "Silly", "Comfy", "Rocket",
    "Super", "Bouncy", "Sparkly", "Cozy", "Breezy", "Peppy", "Dizzy", "Giggly", "Fluffy", "Snappy", "Mighty", "Chilly"];
export const NOUN = ["Latke", "Kugel", "Babka", "Knish", "Bagel", "Dreidel", "Pickle", "Challah", "Blintz", "Cholent",
    "Rugelach", "Minivan", "Driver", "Racer", "Honker", "Rider", "Comet", "Penguin", "Panda", "Otter", "Llama", "Falcon"];
/** n candidate names from a few random numbers (rnd() in [0, 1)); with a base: variations of it. Not yet checked. */
export function ideas(base, n = 12, rnd = Math.random) {
    const out = [], add = s => { if (s && !out.includes(s) && s.length <= MAX && !shape(s)) out.push(s); };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const b = String(base || "").replace(/[^A-Za-z0-9_]/g, "").replace(/^[^A-Za-z]+/, "").replace(/_+/g, "_").replace(/_$/, "").slice(0, 12);
    const L1 = () => "ABCDEFGHJKLMNPRSTVWZ"[Math.floor(rnd() * 20)];
    const D = k => String(Math.floor(rnd() * Math.pow(10, k))).padStart(k, "0").replace(/^0/, String(1 + Math.floor(rnd() * 9)));
    let guard = 0;
    while (out.length < n && guard++ < n * 8) {
        if (b.length >= 1) {
            const r = out.length % 4;
            add(r === 0 ? `${b}_${L1()}` : r === 1 ? `${b}${L1()}${D(1)}` : r === 2 ? `${b}_${D(2)}` : `${pick(ADJ)}${b}`.slice(0, MAX));
            if (b.length >= MIN && rnd() < 0.3) add(`${b}${D(2)}`);
        } else {
            const a = pick(ADJ), o = pick(NOUN);
            add(rnd() < 0.5 ? `${a}${o}` : rnd() < 0.5 ? `${a}_${o}` : `${o}${D(2)}`);
        }
    }
    return out.filter(s => !check(s));
}
/** A generated name (offline fallback / a name replaced after reports): "Knish4821". */
export function generated(rnd = Math.random) {
    const o = ["Latke", "Kugel", "Babka", "Knish", "Bagel", "Pickle", "Blintz", "Challah"][Math.floor(rnd() * 8)];
    return o + String(1000 + Math.floor(rnd() * 9000));
}
