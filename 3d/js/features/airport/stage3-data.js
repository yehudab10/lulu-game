// features/airport — ✈️ STAGE 3's words + numbers (the owner's decision 8: taxi runs, a lost suitcase, Dovid Dov).
// Every reward is FIXED and CAPPED per real day (the device's local date) — nothing here can be farmed.
// Cartoon only: parody airlines, nothing about real airport incidents or real security procedures.

/** Pay + caps (coins). Each cap is per REAL day; past it the scene still plays, it just pays nothing. */
export const PAY = {
    taxi: 40,            // one JFK taxi run (a fixed fare, no tips, no meter)
    taxiPerDay: 3,       // runs a real day that pay — after that the job isn't offered until tomorrow
    bag: 15,             // returning the lost suitcase — once a real day
    dovid: 10,           // Dovid Dov's "gas money" — once a real day
};
/** Tuning (tests read these). */
export const TUNE = {
    stopSpeed: 7.5,      // m/s: slow enough to pick up / drop off
    stopR: 11,           // m from the kerb pickup / the drop-off
    dropR: 16,           // m from the town landmark
    chat: [9, 14],       // s between a traveller's lines on the way
    dovidChance: 0.4,    // a terminal visit when Dovid Dov is "on tour" (solo only)
    dovidAt: [6, 10],    // s after she walks in before the arrivals doors open for him
    dovidStay: 70,       // s he stands at the end of the carpet before his car's ready
    fans: 6,             // the fan crowd
};

// ═══ 🚕 THE JFK TAXI RUN ═══════════════════════════════════════════════════
export const TAXI_DEF = {
    emoji: "🚕", name: "JFK TAXI RUN", color: "#FFC107", from: "JFK DISPATCH", fromEmoji: "🛬",
    blurb: `A traveller at ARRIVALS needs a ride to Lakewood or Midwood. A fixed fare (${PAY.taxi} 💰), ${PAY.taxiPerDay} runs a day.`,
};
/** The travellers. dest: [town, landmark spot (ctx.town.spot), what it's called]; alt: fallbacks if that spot isn't built. */
export const FARES = [
    { id: "yenta", name: "Mrs. Gittel Blabberman", emoji: "👵", look: "npcWoman", colors: { Top: "#AD1457", Bottom: "#4A148C", Hair: "#ECEFF1" },
        dest: ["lakewood", "hall", "the Simcha Palace"], alt: ["pizza", "bank"],
        hello: "Lulu! Lulu Who-Was-At-The-Feldmans'-Bar-Mitzvah! Take me to the Simcha Palace — there's a vort, and I need to be there FIRST.",
        ride: [
            "So. The Goldbergs' daughter. Engaged. To a DENTIST. From BOCA. I knew before the Goldbergs did.",
            "Twelve hours on the plane, I sat next to a man from Monsey. By the time we landed I'd found him a shidduch AND a plumber.",
            "Don't look now, but that car's driver — his cousin's wife's sister was my neighbour in 1987. Small world. Tiny.",
            "I'm not saying anything. I'm just SAYING.",
            "You know who else drives a pink car? Nobody. I'd know.",
        ],
        crash: "OY! My sheitel! …it's fine, it's fine. It's seen worse. It's seen a Purim party.",
        wrong: "This isn't Lakewood! I know every street in Lakewood. And every person ON every street.",
        bye: "Thank you, sheifele! I'll tell everyone you're a WONDERFUL driver. And some other things. Nice things. Mostly.",
    },
    { id: "bochur", name: "Yanky", emoji: "🎒", look: "npcMan", colors: { Top: "#FAFAFA", Bottom: "#212121", Hair: "#3E2723" },
        dest: ["midwood", "pizza", "the pizza shop"], alt: ["bakery", "bank"],
        hello: "A whole year in yeshiva in Yerushalayim. Two suitcases of seforim, one sock. Please — take me to a slice of New York pizza. I've been DREAMING of it.",
        ride: [
            "The highways here are SO wide. In Yerushalayim this would be a whole neighbourhood. With a shuk on it.",
            "My mother thinks I've grown. I haven't. I just stand up straighter now. Mussar.",
            "I learned the whole of Bava Kamma this year. Ask me anything about oxen. Anything. …Nobody ever asks about the oxen.",
            "Is it normal that everybody here drives? In Yerushalayim I just walked behind a falafel smell until I got somewhere.",
            "I'm going to order a plain slice. No — two. No — a pie. It's been a YEAR.",
        ],
        crash: "Baruch Hashem, baruch Hashem — that's a bracha I learned for THIS.",
        wrong: "Um… I've been away a year, but even I know this isn't Midwood.",
        bye: "If anyone asks, I took the bus. My Rebbe thinks I'm very independent now.",
    },
    { id: "tourist", name: "Gary from Ohio", emoji: "📸", look: "npcMan", colors: { Top: "#FF7043", Bottom: "#5D4037", Hair: "#FFB74D" },
        dest: ["midwood", "college", "\"the Brooklyn Bridge\" (Brooklyn College)"], alt: ["pizza", "bank"],
        hello: "Howdy! First time in New York! Could you take me to the Brooklyn Bridge? The man at the desk said 'Brooklyn' and pointed this way.",
        ride: [
            "Is THAT the Brooklyn Bridge? …That's an overpass. Gotcha. Still pretty!",
            "Back home in Ohio we've got a bridge too. It goes over a creek. Folks come from two whole counties.",
            "Everybody here honks so friendly! Back home a honk means somebody's cow is out.",
            "My wife said 'Gary, don't talk to the driver the whole way.' I said 'Linda, it's NEW YORK.'",
            "So the Brooklyn Bridge — does it have a gift shop? I promised Linda a snow globe.",
        ],
        crash: "Whoa! Is that a New York thing? I'll tell everybody it's a New York thing.",
        wrong: "Huh. The sign says Lakewood. Is THIS Brooklyn? …No? Gotcha. Real nice though!",
        bye: "Brooklyn COLLEGE? Well, I'll be. Linda's going to LOVE that it's educational. Snow globe's still on, right?",
    },
    { id: "zeidy", name: "Mr. Shapiro", emoji: "🍊", look: "npcMan", colors: { Top: "#80DEEA", Bottom: "#ECEFF1", Hair: "#ECEFF1" },
        dest: ["lakewood", "lake", "the lake"], alt: ["pizza", "bank"],
        hello: "Back from Florida! A tan, a sun hat, and twelve grapefruits in my carry-on. Take me to the lake — I want to show the ducks my tan.",
        ride: [
            "In Florida, it's 85 degrees in DECEMBER. Here it's… also a temperature.",
            "I brought back twelve grapefruits. Security said 'sir, that's a lot of grapefruit.' I said 'it's a lot of grandchildren.'",
            "You drive like my late wife, may she rest. Fast, and with OPINIONS.",
            "The Florida ducks don't quack. They kvetch. I've missed the Lakewood ducks.",
        ],
        crash: "Easy! The grapefruits! …the grapefruits are fine. My hip has questions.",
        wrong: "This isn't Lakewood. There's no ducks. I see a pigeon with an ATTITUDE.",
        bye: "Here, take a grapefruit. Take two. Take FOUR. I insist.",
    },
];
export const TAXI = {
    dispatchText: [
        "A traveller at ARRIVALS needs a ride into town. Got a car? It's in 💼 Jobs → ${name}.",
        "Taxi line's around the block. Anybody with four wheels and a pulse — 💼 Jobs → ${name}.",
    ],
    pickup: "Pull up at the ARRIVALS kerb",
    pickupLine: f => `🛬 Pick up ${f.name} at ARRIVALS`,
    toExit: (f, town) => `🛣️ ${f.name} → the ${town} exit`,
    toSpot: f => `📍 Drop ${f.name} at ${f.dest[2]}`,
    wrongTown: (f, town) => `↩️ Wrong town! ${f.name} wants ${town}`,
    noAirport: "The airport's not open yet (stage 1) — no JFK fares.",
    capped: "JFK DISPATCH: \"That's your runs for today, hon — the meter's resting. Come back tomorrow!\"",
    // the terminal's arrivals door: a traveller asks for a ride (only while a taxi run can be offered)
    door: {
        label: "🚕 A traveller needs a ride",
        ask: "Taxi? TAXI? Are you a taxi? You look like you have a car.",
        yes: "🚕 Sure — my car's outside",
        no: "🙅 Not today",
        booked: "Wonderful! I'll be at the kerb by ARRIVALS — the one waving. Everybody's waving. I'll wave MORE.",
        nope: "No? Fine. I'll wait for the shuttle. It comes every 20 minutes. Supposedly. Since Tuesday.",
    },
};

// ═══ 🧳 THE LOST SUITCASE ══════════════════════════════════════════════════
export const BAG = {
    who: "Mrs. Perl Shpilkes", emoji: "🧳", color: "#7B1FA2",
    label: { ask: "😰 A very frazzled traveller", hunt: "😰 Mrs. Shpilkes (still frazzled)", give: "🧳 Give Mrs. Shpilkes her suitcase", done: "😌 Mrs. Shpilkes (un-frazzled)" },
    hello: [
        "My suitcase! It's GONE! It came off the carousel and then it went… somewhere! Without me!",
        "Have you seen a suitcase? Pink. A pom-pom on the handle. A sticker that says FRAGILE: KUGEL.",
    ],
    ask: "You'll help me look? You're an angel. A pink-car angel.",
    opts: ["🔍 I'll find it!", "🙅 Sorry, I'm in a rush"],
    nope: "Go, go. I'll just stand here. Frazzled. It's fine. I'm FINE.",
    hints: {
        scale: "I think I saw an older woman with a VERY big bag near the Kugel Air desk…",
        bench: "Somebody by the departures board was sitting on something pink…",
        plant: "Maybe by the doors? I put it down by a plant to call my sister. The plant was right there. Then my sister said something.",
        lookalike: "A man walked off with a pink bag — I'm SURE it was mine. He's doing laps of the hall!",
    },
    found: {
        scale: [["Bubbe Faigy", "This? I checked it in by mistake. It was too LIGHT to be mine, I should've known."]],
        bench: [["A tired man", "I thought it was a very nice footrest. It's VERY comfortable. Tell her it's very comfortable."]],
        plant: [["Lulu", "Found it! The plant was guarding it. Good plant."]],
    },
    grab: "🧳 Grab the pink suitcase",
    lookalike: {
        name: "Mr. Pilkes", label: "🧳 Excuse me — your suitcase…",
        lines: [
            ["Mr. Pilkes", "My bag? This is my bag. Pink, pom-pom, FRAGILE: KUGEL. Very distinctive."],
            ["Lulu", "…Sir, yours says FRAGILE: KUGEL. Hers says FRAGILE: KUGEL. Look — hers has a NAME TAG."],
            ["Mr. Pilkes", "'Shpilkes.' Huh. Mine says 'Pilkes'. That's… very close. I'm going to need to sit down."],
            ["Mr. Pilkes", "Then where's MINE? …She has it? She's had chopped liver this whole time? Tell her she can keep it."],
        ],
    },
    give: [
        ["Mrs. Perl Shpilkes", "MY SUITCASE! My pom-pom! My KUGEL! You found everything!"],
    ],
    paid: "Here — for your trouble. And a rugelach. The rugelach is the real payment.",
    unpaid: "Here — a rugelach. I'd give you money but I gave it all to the man who sells pretzels. He was very convincing.",
    luluCarry: ["Pink suitcase, coming through! 🧳", "It's heavier than it looks. That's the kugel.", "Nobody steal this. I'm watching you, Rex."],
    after: "Thank you again, sheifele! If you ever lose a suitcase, call me. I'll panic WITH you.",
};

// ═══ 🎤 DOVID DOV ON TOUR ══════════════════════════════════════════════════
// (canon: Dovid Dov is Lulu's brother — the family knows, strangers don't. The fans have NO idea.)
export const DOVID = {
    who: "Dovid Dov", emoji: "🎤", color: "#C62828",
    pa: "📢 Would the red carpet please be extra red. A VIP is arriving. No, we can't say who. We don't KNOW who.",
    guard: ["Make way! VIP coming through! …who IS he?", "Stand back, folks! Behind the rope! Rex, that means you too."],
    fans: [
        "IT'S DOVID DOV!!", "WHO IS HE?! I LOVE HIM!", "Dovid Dov! Sign my boarding pass!", "Is he tall? He looks tall. He's on a carpet.",
        "I heard he's somebody's DENTIST!", "I don't even know his face — I know his VOICE!", "Sing the frum song! Sing the frum song!",
    ],
    label: "🎤 Say hi to Dovid Dov",
    labelBusy: "🎤 Dovid Dov (mobbed by fans)",
    whisper: "*whispers* Lulu?! Don't say my real name. Say my stage name. LOUDLY. They love that.",
    ask: "So — sister. What'll it be?",
    opts: ["🤳 A selfie", "✍️ An autograph (for Ima's fridge)", "🤫 Pretend we're strangers"],
    selfie: [
        ["Lulu", "Say cholent! 📸"],
        ["Dovid Dov", "Cholent! …you cut off half my face. That's fine. Mystery is my whole brand."],
    ],
    autograph: [
        ["Dovid Dov", "What do I sign? …Your KUGEL? Lulu, that's Ima's kugel."],
        ["Lulu", "She'll want it framed. You know she will."],
        ["Dovid Dov", "\"To Ima — call your son. Love, Dovid Dov.\" There. Don't let Rex near it."],
    ],
    strangers: [
        ["Lulu", "*loudly* Big fan! Never met you! Who ARE you?!"],
        ["Dovid Dov", "*loudly* Never seen you before in my LIFE! *whispers* Tell Ima I'm eating."],
    ],
    fanAfter: ["WHO IS SHE?!", "Is she his DENTIST?!", "I want a pink car NOW."],
    gift: "Here — gas money. Don't tell Ima I was in town, she'll make me eat a whole brisket in the car park.",
    noGift: "I'd give you gas money, but I spent all of it on airport pretzels. Tour life, Lulu. Tour life.",
    bye: "My car's here. Love you, don't tell anyone. Especially not the radio.",
    leaveAlone: "📢 The VIP has left the building. We still don't know who he was.",
    party: "The VIP carpet's empty — the board says his flight's delayed. (He hates crowds of FRIENDS.)",
    radioLine: "Rumour: Dovid Dov was spotted at JFK with somebody in a pink jacket. Wildly unconfirmed.",
};

// ═══ the bottom hint in the hall (foot's "find a car to borrow" doesn't belong in a terminal) ═══
export const HINT = (g) => `✈️ Explore the terminal · ${g("interact")} talk / look · ${g("back")} leave`;
