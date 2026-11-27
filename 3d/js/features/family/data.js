// features/family — the data: who they are, where they are when, what they say. Every number + line is here.
//
// Canon: Lulu's family is Ima, Abba (a lawyer), Dina, Bubbe — and now FAYGE, her older married sister (court already knew
// her: "SISTER FAYGE", low-sodium everything, baby Chani — law/data.js), her husband ASH and their two-year-old CHANI.
// Jokes are about people (Fayge's opinions, Ash's four words a day, a two-year-old's whole vocabulary), never the baby
// in a mean way, never anything holy.

export const ID = "family";

// ── Fayge's household (a basement apartment in Midwood: the side door of the landlords' house on East 15th St,
//    between Avenue M and Avenue L — the house at the town's local (26, −21); the landlords upstairs stay a household) ──
export const FAYGE = {
    key: "midwood:fayge",            // (her own door id: not a position id, so it never clashes with a front door)
    name: "Mandelbaum",
    cast: ["mom", "dad", "baby"],
    names: { mom: "Fayge", dad: "Ash", baby: "Chani" },
    colors: {
        mom: { Top: "#26A69A", Bottom: "#37474F", Hair: "#4E342E", Shoes: "#3E2723" },     // (court's Fayge: teal top, dark hair)
        dad: { Top: "#ECEFF1", Bottom: "#263238", Hair: "#212121", Shoes: "#212121" },     // (a white shirt, a black yarmulke, calm)
        baby: { Top: "#F48FB1", Bottom: "#F8BBD0" },
    },
    town: "midwood",
    host: { lx: 26, lz: -21, model: "town_mw_house" },     // the landlords' house (the town's local frame, its centre)
    street: "East 15th St",
    // the basement stairs, in the house model's frame (x = model +X, z = out the front): down the side, by the driveway
    pit: { x0: 2.85, x1: 3.85, z0: 3.1, z1: 5.6 },
    door: [3.35, 5.35],              // the top of the steps (who answers stands here)
    ap: [3.35, 7.0],                 // where Lulu stands to knock (the driveway, at the top of the steps)
    stroller: [4.35, 6.4],
    rooms: ["kids", "living", "kitchen"],      // a basement: Chani's room, the living room, a kitchen with a table
    palette: ["#F1E7D8", "#E6EEF2"],
    // the playgroup: Morah Leah's driveway (gated: tiny chairs, a rug, chalk), round the corner on Avenue L (the house at local (23, 24), facing Avenue L)
    playgroup: { lx: 23, lz: 24, model: "town_mw_house", yard: [4.6, 6.1] },       // (the driveway, a gate across its mouth)
};

// ── her day (the game clock + the weekday + the calendar: homes/life.js when()) ──
// where: "home" (the basement — scene) · "playgroup" · "makolet" · "bakery" · "clothes" (Avenue J'adore's window) ·
//        "ima" (dropping in at Ima's) · "walk" (a Shabbos walk, past Ima's) · "away" (at Ima's for Shabbos: not drawn)
const ERRANDS = ["makolet", "bakery", "clothes"];
export function dayOf(w) {
    const h = w.hour, wd = w.wd;
    const at = (where, scene = "faygeOut", ash = false) => ({ where, scene, ash });
    if (w.shabbos || w.yomtov) {
        if (h >= 23 || h < 7.5) return at("home", "faygeNight", true);
        if (h >= 14 && h < 17) return at("walk", "faygeOut");
        return at("away", "faygeOut");          // (at Ima's table — she's family, of course she's there)
    }
    if (wd === 5) {                              // Friday
        if (h >= 7 && h < 8.5) return at("home", "faygeMorning", true);
        if (h >= 8.5 && h < 11.5) return at("bakery");
        if (h >= 11.5 && h < 18) return at("home", "faygeFriday", h >= 13);
        if (h >= 18 && h < 23) return at("away", "faygeOut");
        return at("home", "faygeNight", true);
    }
    // Sunday – Thursday
    if (h >= 7 && h < 8.5) return at("home", "faygeMorning", true);
    if (h >= 8.5 && h < 13) return at("playgroup");
    if (h >= 13 && h < 16.5) return at(ERRANDS[(Math.floor((h - 13) / (3.5 / 3)) + wd) % 3]);
    if (h >= 16.5 && h < 17.5) return at("ima");
    if (h >= 17.5 && h < 20) return at("home", "faygeSupper", h >= 18);
    if (h >= 20 && h < 22.5) return at("home", "faygeBedtime", true);
    return at("home", "faygeNight", true);
}
export const PLACE_NAME = { home: "at home", playgroup: "at the playgroup on Avenue L", makolet: "at Yanky's makolet", bakery: "at the bakery on Avenue J",
    clothes: "window-shopping at Avenue J'adore", ima: "at Ima's", walk: "on a Shabbos walk past Ima's", away: "at Ima's" };
/** The note on her door when nobody's home. */
export const NOTE = {
    playgroup: "A note on the door: \"AT PLAYGROUP TILL 1. — F.   P.S. LULU THIS MEANS YOU TOO.\"",
    makolet: "A note on the door: \"MAKOLET. BACK SOON. DON'T TOUCH THE STROLLER (IT'S NOT HERE ANYWAY).\"",
    bakery: "A note on the door: \"BAKERY. If you're Ash: I KNOW you ate the last rugelach.\"",
    clothes: "A note on the door: \"ERRANDS.\" Underneath, smaller: \"(looking at dresses. LOOKING. Looking is free.)\"",
    ima: "A note on the door: \"AT IMA'S. Which you'd know if you LIVED there— oh wait, you do.\"",
    walk: "Quiet. They're out for a Shabbos walk.",
    away: "Dark. A note: \"AT IMA'S FOR SHABBOS. Lulu — you're coming, right? RIGHT?\"",
};

// ── what they say ──
export const KNOCK = {
    open: ["It's open, it's ALWAYS open, it's YOU. Shoes off. Chani's— okay, Chani's awake. Come in.", "Lulu! Come in, come in — mind the step, mind the LEGOS, mind the second step.",
        "I heard the car from the corner. Nobody else parks like that. Come in!"],
    ash: ["...Lulu. Come in.", "*Ash opens the door, nods, and steps aside. That's a whole speech, for Ash.*", "Hey. ...Fayge! It's Lulu."],
    night: ["*the door opens an inch* If you wake her up, Lulu, I swear… *whispering* …come in. QUIETLY.", "*whispers* It's eleven o'clock. …Come in. There's tea. WHISPER tea."],
    friday: ["EREV SHABBOS, Lulu! Come in, take a spoon, taste the kugel. ...it's low-sodium. Taste it anyway."],
};
/** Fayge on Lulu still living at Ima's — by features/decor/moveout's day (a stage index −1 … 6), or her own home. */
export const SISTER = {
    own: ["Look at you, a HOMEOWNER! I'm so proud I could cry. I'm not crying. Chani, stop looking at me.", "Your own place! When do I come over to tell you where the couch goes?"],
    early: ["So. Still at Ima's? No, it's fine. It's FINE. I'm just asking.", "How's Ima? You'd know. You live there. Still."],
    mid: ["Ima called me. She says your room would make a lovely office. I said nothing. I'm saying nothing NOW.", "There's a basement on Avenue M for rent. Not like ours. Better. I'm just saying it EXISTS."],
    late: ["Lulu. Ima rented your room to a BOARDER. With a PLANT. Even Chani has her own room.", "I printed you a listing. Ash printed you a listing. CHANI printed you a listing. ...okay, she scribbled on it."],
};
export const FAYGE_TALK = {
    playgroup: ["Six toddlers, one Chani, one me. Circle time is a war. A cute war.", "Don't make eye contact with the one in the dinosaur hat. He bites. Affectionately."],
    makolet: ["They moved the rice cakes AGAIN. Every week, a treasure hunt.", "Low-sodium soy sauce. Lower-sodium soy sauce. NO-sodium soy sauce. ...feh."],
    bakery: ["One challah for us, one for Ima, one for Ash to eat in the car and pretend he didn't.", "The rugelach are for Shabbos. Chani, the rugelach are for SHABBOS."],
    clothes: ["I'm looking. Looking is free. Ash says looking is how it STARTS.", "That one. No. That one. ...okay, I'll come back with Ima."],
    ima: ["I'm just dropping off soup. LOW-sodium. Ima puts salt in it the minute I leave.", "Ima wants to know if you ate. I said I'd ask. Did you eat?"],
    walk: ["Gut Shabbos! Chani says it too. Chani, say Gut Shabbos. ...she said it in her head."],
    home: ["Sit, sit. Have something. It's low-sodium — you won't taste a thing, that's the point.", "Ash, say hi to Lulu. ...he said it. He says it with his eyebrows."],
    salt: ["NO sodium, feh! Salt is a choice, Lulu. A BAD one.", "You know how much sodium is in a pickle? I'll tell you. TOO MUCH."],
};
export const ASH_TALK = ["Hey.", "...good.", "Coffee?", "*checks Chani's Cheerios against the light, one by one, approves them*",
    "Long day. Very clean lettuce.", "She's right. ...about what? Doesn't matter. She's right.", "*nods* (that's Ash for 'great to see you')"];
export const CHANI = ["NO.", "Lulu! LULU! ...no.", "Mine.", "AGAIN!", "Uh-oh.", "*hands you a soggy Cheerio, with great ceremony*", "Bye-bye! *you haven't left*",
    "*points at you* DAT.", "Wawa! (water)", "*whispers* …shoe."];
export const CHANI_REPLY = ["She likes you. That's how she shows it.", "That means 'I love you, Aunt Lulu.' Probably.", "She's been saying that ALL day. To everyone. To a pigeon."];

// ── tiny jobs (inside features/homes' caps: homes' DAY_CAP for everything together, per job its own cap a real day) ──
export const JOBS = {
    circle: { emoji: "🎵", name: "lead circle time at the playgroup", pay: 5, cap: 1 },
    bags: { emoji: "🛍️", name: "carry Fayge's bags home", pay: 6, cap: 1, deliver: true },
};
export const SONGS = [
    { label: "🚌 \"The Wheels on the Bus\"", lines: ["*six toddlers: \"ROUND AND ROUND!\" (one of them: \"BEEP!\" for the whole song)*", "Chani: AGAIN!"] },
    { label: "🐟 \"Five Little Fish\"", lines: ["*the toddlers count to five. Then to three. Then \"SEVEN!\"*", "Chani: Fishy! FISHY!"] },
    { label: "🦁 Make one up — a lion who eats kugel", lines: ["*\"…and the lion said ROAR, I want MORE kugel!\" — total silence. Then six toddlers ROAR.*", "Fayge: …that's going to be stuck in their heads for a WEEK. I love it."] },
];
export const PLAYGROUP_AMBIENT = ["Clean up, clean up, everybody clean up…", "Who wants to be the line leader? Everybody. Okay.", "Shloimy, the sand is for the SANDBOX.", "Gentle hands! GENTLE hands!", "*a toddler holds up a leaf like it's the Kohinoor diamond*"];
