// features/houseitems — the data: what each thing she carries out of a house DOES (owner 2026-11-27: "the items that Lulu
// takes from houses are usable"). Each item lists its VERBS, in the order they're tried when she presses the item
// button: the first one that makes sense right there wins.
//
//   BONK   a crook / a cop chasing her within reach: a pickpocket-style thief flat for a moment (crime's porch pirate:
//          foiled), a chasing cop's hat spins off (he stops for a moment, annoyed). Never neighbours, never their kids.
//   EAT    a heart back (≤ CAP.eat a run, on top of homes' cholent cap).
//   DROP   a distraction: a cop chasing her stops to look (CAP.drop seconds), the street notices.
//   GIVE   to a neighbour within reach: a line (to its OWNER: "THAT'S MY KUGEL!" — they remember), Fayge: a thank-you.
//   WEAR   on her head for a joke (again → off).
//   SHOW   hold it up: a reaction.
// `uses`: how many times before it's gone (0 = forever). Nothing here pays coins.

export const ID = "houseitems";
export const BAG_MAX = 3;
export const CAP = { eat: 2, dropStun: 6, bonkStun: 2.6 };

export const ITEMS = {
    pan: { name: "frying pan", emoji: "🍳", prop: "Pan", verbs: ["BONK", "WEAR"], uses: 0 },
    seltzer: { name: "seltzer bottle", emoji: "🍾", prop: "Seltzer", verbs: ["BONK", "SHOW"], uses: 3, bonk: "SPRITZ" },
    chicken: { name: "rubber chicken", emoji: "🐔", prop: "RubberChicken", verbs: ["DROP", "SHOW"], uses: 0, drop: "SQUEAK", keep: true },
    pillow: { name: "pillow", emoji: "🛏️", prop: "Pillow", verbs: ["BONK", "WEAR"], uses: 0, bonk: "THWUMP" },
    kugel: { name: "kugel", emoji: "🥘", prop: "Kugel", verbs: ["GIVE", "EAT", "DROP"], uses: 1, food: true },
    blower: { name: "leaf blower", emoji: "🍂", prop: "LeafBlower", verbs: ["BONK", "SHOW"], uses: 0, bonk: "BLOW" },
    balloon: { name: "water balloon", emoji: "🎈", prop: "WaterBalloon", verbs: ["BONK", "DROP"], uses: 1, bonk: "SPLOOSH" },
};

export const LINES = {
    BONK: {
        thief: ["*BONG* — the thief sees stars. 💫", "*THWACK* ...he's down. Gently. Cartoon-gently."],
        cop: ["*BONK* — his hat spins off. \"…was that a FRYING PAN, ma'am?\"", "*the cop's hat goes round and round* \"HEY!\""],
        none: ["*swings at the air* …practice swing.", "*BONK*… nobody. The air had it coming."],
    },
    SPRITZ: { thief: ["*PSSSHT* — right in the face. \"MY EYES! …it's just seltzer. MY EYES anyway!\""], cop: ["*PSSSHT* — \"That's ASSAULT WITH A BEVERAGE!\""], none: ["*PSSSHT* — refreshing."] },
    THWUMP: { thief: ["*THWUMP* — feathers everywhere. He's too confused to run."], cop: ["*THWUMP* — \"…a PILLOW?!\" (he's more hurt than hurt)"], none: ["*THWUMP* — the air is now feathers."] },
    BLOW: { thief: ["*VRRRRM* — he's blown right off his feet!"], cop: ["*VRRRRM* — his hat's halfway down the block."], none: ["*VRRRRM* — every leaf on the street, relocated."] },
    SPLOOSH: { thief: ["*SPLOOSH* — soaked. He forgets what he was stealing."], cop: ["*SPLOOSH* — \"…I'm putting that in the REPORT.\""], none: ["*SPLOOSH* — the sidewalk is clean now."] },
    EAT: { kugel: ["*eats the kugel straight from the dish* …someone's Bubbe made this with LOVE. ❤️ +1", "*a whole kugel, one fork* …it's a little dry. Still: ❤️ +1"],
        full: ["*one bite* …I can't. I'm SO full. (No more hearts from food this drive.)"] },
    DROP: { food: ["*sets the kugel on the pavement* …he WON'T be able to resist.", "*leaves it on the kerb* Free kugel! Come and get it!"],
        SQUEAK: ["*SQUEEEAK* — everyone turns to look at the rubber chicken.", "*drops the chicken* *SQUEAK* …the whole street stares."], cop: ["\"…is that KUGEL?\" — the cop stops. He has to. It's kugel."] },
    GIVE: { owner: ["THAT'S MY {item}!! From MY {room}! …you know what, keep it. No — GIVE IT. Thank you. …WAIT.", "Is that… MY {item}?! I KNEW something was missing! The NERVE. …thank you for bringing it back, I guess?"],
        neighbour: ["For ME? A {item}? …is this from someone's house? Don't tell me. Thank you!", "Oh! A {item}! Just like the one the Goldbergs lost. What a coincidence."],
        fayge: ["You brought me a {item}? …it's not LOW-sodium, is it? Chani, look what Aunt Lulu brought!"] },
    WEAR: { on: ["*puts the {item} on her head* …stylish? Stylish.", "*wears the {item}* Midwood fashion week starts NOW."], off: ["*takes the {item} off* …the moment has passed."] },
    SHOW: ["*holds up the {item}* Behold.", "*shows everyone the {item}* …nobody asked. She shows them anyway."],
    owner: ["THAT'S MY {item}!!", "HEY! That's OUR {item}! From our KITCHEN!", "Is that— she's got our {item}! MOISHE!"],
};
