// features/shops/data.js — the places, who runs them, and the words. Wholesome + silly; nothing here pays coins.

/** Uncle Moishe (both lots — "I have a cousin in Brooklyn. The cousin is also me."). */
export const MOISHE = {
    name: "Uncle Moishe",
    colors: { Top: "#8D6E63", Bottom: "#3E2723", Hair: "#9E9E9E" },   // a brown plaid-ish sport coat
    hello: [
        "Lulu! My favourite niece! Don't tell your cousins. Look around, look around!",
        "Every car here was LOVED. Some of them by a rabbi. One by a goat. Don't ask.",
        "Kick the tires! Gently. They're pre-loved, not pre-kicked.",
        "For you? Family price. Which is the price. But with a SMILE.",
    ],
    look: [
        "Low miles! Well — low-ISH. Medium-low. Okay, it's been places.",
        "This one? A dentist drove it. Only to shul. And Costco. And Florida, twice.",
        "Feel that steering wheel. Feel it! That's QUALITY. That's also a little sticky.",
        "I'd buy it myself, but I'm loyal to my minivan. We've been through a lot.",
    ],
    bought: [
        "SOLD! Mazel tov! Drive it like your Bubbe's watching. Because she is. She called.",
        "It's yours! No refunds, no returns, no 'my father said'. Enjoy!",
        "Sold to the lovely young lady! Yossi — the BALLOONS! …We don't have balloons. Imagine balloons.",
    ],
    poor: [
        "Short a few coins? Do a little job, come back. The car will wait. Probably.",
        "I can't do layaway. Your father asked in 2009. The answer is still no.",
    ],
    owned: [
        "That one's already yours! It's in your garage at home, sweetheart.",
        "You bought this one already! I remember. I cried a little.",
    ],
    testStart: [
        "Test drive! One lap, bring it back in one piece. Yossi — her keys go in the jar!",
        "Go, go! Sixty seconds. If you're not back I'm calling your mother.",
    ],
    testBack: [
        "So? You LOVE it. I can see it in your face. Your face says 'buy'.",
        "Back already? And not a scratch! …Is that a scratch? It's dirt. It's dirt.",
        "Yossi parked YOUR car out front. He says it smells like kugel. Nice.",
    ],
    noCar: [
        "A test drive with no car of your own here to leave? Insurance, sweetheart. You understand.",
    ],
    bye: ["Come back soon! Bring friends! Bring money!", "Zei gezunt! Drive safe!"],
};

/** Lulu walking past the lot (once a visit). */
export const PASS_DEALER = [
    "Uncle Moishe's! Every car here has a STORY. Mostly about kugel spills.",
    "Ooh, a ninja-black one. Ima would faint. I want it.",
    "Is that tube guy waving at me? …He's not. He's resting. Same.",
];

/** Her own garage at home (the driveway picker). */
export const GARAGE_LINES = {
    one: "Just my pink baby for now. Uncle Moishe's lot is in Lakewood — the first thing on Route 9!",
    swap: ["New day, new ride. 💅", "Ooh, this one today.", "Driveway fashion show!", "Pink's jealous. Pink'll get over it."],
};

/** Which shop sells what (the 🛍️ Where to shop list: ctx.shops.places()). `town` = where it stands; `where` = the
 *  directions line; `sells` = what you can buy there. Places that aren't built yet still come through the old Shop. */
export const PLACES = [
    { id: "dealer", icon: "🚗", name: "Uncle Moishe's Pre-Loved Cars", sells: "Cars (all 7 for sale) · test drives",
      towns: { lakewood: "Route 9, the first thing in town", midwood: "Coney Island Ave, Brooklyn" }, spot: "dealer" },
    { id: "makolet", icon: "🛒", name: "The makolet (grocery + pharmacy)", sells: "🌶️ Pepper spray · 🛡️ bubble wrap for cars (the shield) · 📱 the Distracted phone plan",
      towns: { lakewood: "Zissy's, on Main St", midwood: "Yanky's 24-Hour, on Avenue J" }, spot: "makolet" },
    { id: "black", icon: "😈", name: "Shmerel's van (the black market)", sells: "🚀 Missiles · 🎆 the Mega 5-Pack · 🌶️ pepper spray",
      towns: { lakewood: "by the construction site on 14th St", midwood: "outside the car service on Coney Island Ave" }, spot: "shopsBlack" },
    { id: "bling", icon: "✨", name: "Moishe's Bling Bay", sells: "📯 6 horns (hear them first) · 🎀 7 car decorations (fitted on your car)",
      towns: { lakewood: "at Uncle Moishe's on Route 9 — the pink neon door", midwood: "at Uncle Moishe's on Coney Island Ave" }, spot: "bling" },
    { id: "garage", icon: "🏠", name: "Your garage at home", sells: "Pick which of your cars to drive",
      home: true },
];

// ── stage 2: the everyday items + the shady ones ─────────────────────────
/** The makolet (grocery + pharmacy) — one per town. In-world names for the items it stocks. */
export const MAKOLET = {
    lakewood: { name: "Zissy's Makolet & Pharmacy", sign: ["ZISSY'S MAKOLET & PHARMACY", "milk · kugel pans · pepper spray · bubble wrap"] },
    midwood: { name: "Yanky's 24-Hour Makolet", sign: ["YANKY'S 24-HOUR MAKOLET", "open 24 hrs · closed Shabbos · it's complicated"] },
    keeper: { lakewood: { name: "Zissy", key: "npcWoman", colors: { Top: "#00897B", Bottom: "#37474F", Hair: "#4E342E" } },
              midwood: { name: "Yanky", key: "npcMan", colors: { Top: "#F5F5F5", Bottom: "#212121", Hair: "#212121" } } },
    stock: ["pepper", "shield", "distracted"],
    names: {
        pepper: { name: "Pepper Spray", desc: "Self-defence, Bubbe-approved. Zaps an animal (or a person!) off the road." },
        shield: { name: "Bubble Wrap for Cars", desc: "As seen on TV! Wraps the whole car: pops instead of you — absorbs one crash." },
        distracted: { name: "The Phone Plan", desc: "A new phone case + the 'Distracted' plan: reversed steering, 2× score. Ima would NOT approve. Solo runs only." },
    },
    hello: ["Welcome, welcome! Milk's in the back, pepper spray's by the register. Don't mix them up.", "Lulu! Your mother was just here. She bought SIX kugel pans. Is everything okay?",
        "We have everything! Except parking. And patience. Mostly everything."],
    bought: ["Bag? Ten cents. …I'm kidding, take the bag.", "Use it in good health! Not ON anyone's health. You know what I mean.", "Tell your mother I said hi. And that the pans were on sale."],
    poor: ["Short? Bring it next time. …I'm kidding, I can't do credit. The last credit was 1987."],
    owned: ["You have the plan already! Don't text and drive. Seriously. It's in the name."],
};
/** The black market: Shmerel (Velvel's cousin) and his van, parked where nobody asks questions. */
export const BLACK = {
    name: "Shmerel's Van (No Questions)",
    where: { lakewood: "by the construction site on 14th St", midwood: "outside the car service on Coney Island Ave" },
    spot: { lakewood: { spot: "construction", ahead: 8 }, midwood: { spot: "carsvc", ahead: -9 } },
    keeper: { name: "Shmerel", key: "npcMan", colors: { Top: "#3E2723", Bottom: "#263238", Hair: "#212121" } },
    stock: ["missile", "megapack", "pepper"],
    names: {
        missile: { name: "Missile", desc: "A 'firework'. Technically. In some countries. Blasts the car right ahead of you." },
        megapack: { name: "Mega 5-Pack", desc: "Five 'fireworks' — save 20 coins! Shmerel: 'Bulk discount. Don't tell Velvel.'" },
        pepper: { name: "Pepper Spray (industrial)", desc: "Same pepper spray, same price — the label's just in Russian." },
    },
    hello: ["Psst. Lulu. Over here. No, don't LOOK over here. Just… come over here.", "Velvel sent you? Velvel didn't send you. Nobody sent you. What do you need?",
        "Fireworks. Totally legal fireworks. In a van. Like legal things are."],
    bought: ["Pleasure doing business. We never met.", "Enjoy! And if anyone asks — it fell off a truck. A LEGAL truck.", "Cash only, no receipt, no refunds, no eye contact."],
    poor: ["That's not enough. I'm shady, not a charity."],
};

// ── stage 3: ✨ Moishe's Bling Bay (horns + car decorations, at the dealership) ──
export const BLING = {
    lulu: ["Oh she's FANCY now. 💅", "Ima's going to say 'what is THAT'. Perfect.", "Honk honk, world. HONK HONK.", "Worth every coin. Probably."],
};
