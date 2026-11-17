// features/shabbos — the script + tuning for the Erev Shabbos Rush.
// Every line of text and every number lives here.

export const TUNE = {
    // time budget: base + metres / pace (a full run from Lakewood ≈ 3:06 → ~58 mph average)
    baseT: 15, pace: 28, minT: 75,
    // the sky (atmos clock 0..1): golden hour → candles at sunset (pink) → dusk if she's late
    clockStart: 0.37, clockCandles: 0.485, clockLate: 0.53,
    pullIn: 90,                 // the arrival starts this far before Bubbe's house
    imaCalls: [0.24, 0.6],      // when Ima rings (fraction of the time used)
    imaBonus: 10,               // listen to the whole call → Ima stalls Bubbe: +10 s
    // escalation (u = fraction of the time used)
    trafficOurs: [5, 10], trafficOnc: [3, 6],
    pedFrom: 0.08, pedGap: [13, 3.5], pedMax: 3,
    shopsFrom: 0.3, shopEvery: 430,
    signAt: [0.5, 0.8],
    // pay: margin in seconds → coins
    pay: { base: 25, perSec: 3, max: 220 },
    // the rare Cruise event ("Oy, it's erev Shabbos!")
    cruise: { firstAt: [28, 70], chance: 0.08, fridayChance: 0.35, minLeft: 1700, minS: 150 },
    // Friday on the title (device clock, local time)
    friday: { from: 12, to: 20 },
};

// the minivan rush: more vans as the sun goes down
export const MIX_LATE = { sedan: 0.42, van: 0.48, truck: 0.1 };

// ── Ima (two calls) ────────────────────────────────────────────────────────
export const IMA_CALLS = [
    {
        lines: ["Did you leave yet?! Lulu. LULU. Did you LEAVE?", "Bubbe's been ready since Tuesday. TUESDAY.", "Don't speed. But hurry. But don't speed."],
        done: { full: "Ima stalls Bubbe: \"Light the OVEN first, Ma\" ⏱️ +0:10", declined: "\"I'm DRIVING, Ima!\" — \"GOOD. DRIVE!\"", hungup: "Hung up on Ima on erev Shabbos. Bold." },
    },
    {
        lines: ["Bubbe is standing by the window.", "She's holding the matches, Lulu. She's not lighting. She's HOLDING.", "She says she's not worried. She's VERY worried."],
        done: { full: "Ima: \"I told her you're parking.\" ⏱️ +0:10", declined: "Ima: \"Fine! I'll tell Bubbe you're 'on your way.'\"", hungup: "Ima: \"…I'll tell her the line dropped.\"" },
    },
];

// the rare Cruise event: Ima calls out of the blue
export const ERUV_CALL = {
    lines: ["Oy, Lulu! It's erev Shabbos! Did you FORGET?!", "Bubbe lights at sunset. SUNSET, Lulu. Look up!", "Go straight to Bubbe's. Don't stop for coffee."],
    ringText: "🕯️ \"It's erev Shabbos!\"",
};

// ── Lulu at the wheel (via the banter feature), by how late it's getting ────
export const LULU_LINES = {
    calm: [
        "Plenty of time. Plenty. Of. Time.",
        "Bubbe said \"come early.\" This IS early. For me.",
        "The cholent's been on since Thursday. It'll keep.",
        "Golden hour! Avigail would want a selfie. NO TIME, Avigail.",
    ],
    hurry: [
        "Why is EVERYONE on this road?!",
        "Every minivan in Lakewood is out here!",
        "Is that man running with a cholent pot?!",
        "Ima's gonna say \"I told you to leave at noon.\"",
        "Sir, your challah is not more important than my challah!",
    ],
    frantic: [
        "The sun is literally setting AT me!",
        "Move, move, MOVE — it's EREV SHABBOS!",
        "If I'm late Bubbe will \"not say anything.\" LOUDLY.",
        "I know it's last minute, but so am I!",
        "Shops closing, sun going, Lulu… GOING!",
    ],
    minute: "ONE MINUTE?! Somebody stall Bubbe!",
    last: "Ten seconds! Bubbe, hold the match!!",
};

// what the people rushing home shout (NPC bubbles; skipped on Quiet chatter)
export const PED_SAYS = {
    challah: ["Two challahs! TWO!", "Good Shabbos! Can't stop!", "Still warm! Don't look at it!"],
    cholent: ["It's still HOT!", "Coming through! Hot cholent!", "Fourteen hours of beans, lady!"],
    bekishe: ["MIKVAH CLOSES IN TEN!", "Good Shabbos! Excuse me! GOOD SHABBOS!", "My towel! Where's my — oh, it's on me."],
};

export const SHOP_NAMES = [
    { name: "BUBBE-LICIOUS BAKERY", bg: "#6D4C41", fg: "#FFE0B2" },
    { name: "MOISHE'S HARDWARE", bg: "#1B5E20", fg: "#FFF8E1" },
    { name: "KUGEL KING", bg: "#F9A825", fg: "#3E2723" },
    { name: "SHLOIMY'S SHOES", bg: "#283593", fg: "#FFFFFF" },
    { name: "FISHEL'S FISH", bg: "#00838F", fg: "#E0F7FA" },
];

// ── made it ─────────────────────────────────────────────────────────────────
export const IMA_PORCH = "She's HERE! Ma, she made it — light, LIGHT!";
export function bubbeLine(margin) {
    if (margin >= 60) return "Lululeh! EARLY?! Who are you, and what did you do with my granddaughter?";
    if (margin >= 20) return "Just in time, mamele! Come, cover your eyes, we're lighting!";
    return "With SECONDS to spare! My heart, Lulu. My HEART. Good Shabbos!";
}
export function marginTag(margin) {
    if (margin >= 60) return "🌟 EARLY! (Bubbe is shocked)";
    if (margin >= 20) return "🕯️ Right on time";
    return "😅 By a whisker";
}

// ── late ────────────────────────────────────────────────────────────────────
export const LATE_LINES = [
    "You'll be eating cold cholent.",
    "Bubbe lit without you. She'll mention it. Forever.",
    "Ima has already texted the whole family: \"She's FINE. She's just LATE.\"",
    "Bubbe's \"I'm not upset\" face has been activated.",
    "Heshy ate your kugel. \"It was getting cold,\" he says.",
    "Bubbe told the neighbours you're \"working very hard.\" She's not happy about it.",
];
