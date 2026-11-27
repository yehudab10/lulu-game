// features/shops/data.js — the places, who runs them, and the words. Wholesome + silly; nothing here pays coins.

/** Uncle Refael (both lots) — gruff, short, a hard bargainer who doesn't do small talk; warm underneath, still funny. */
export const REFAEL = {
    name: "Uncle Refael",
    colors: { Top: "#455A64", Bottom: "#263238", Hair: "#424242" },   // a dark work jacket
    hello: [
        "Lulu. Look, don't touch. …Fine, touch.",
        "You're buying or you're browsing? Browsing is free. Today.",
        "Every car's checked. By me. Twice. Don't ask the mechanic, he talks.",
        "Family price is the price. I don't do discounts. I do quality.",
    ],
    look: [
        "Good engine. Good brakes. The radio picks what it wants. Not my problem.",
        "One owner. A dentist. Drove like a dentist. Slow. Careful. Perfect.",
        "Don't kick the tires. The tires did nothing to you.",
        "It's a good car. I don't say that. So.",
    ],
    bought: [
        "Sold. Keys. Go. …Mazel tov. Drive careful.",
        "Done. No returns. No 'my father said'. Enjoy it, kid.",
        "Yours. Wash it once a week. I'll know.",
    ],
    poor: [
        "Not enough. Go earn it. The car's not going anywhere. Neither am I.",
        "Layaway? No. Your father asked in 2009. Still no.",
    ],
    owned: [
        "You own that one. It's in your garage. Go home, look at it.",
        "Already yours. I remember every sale. Every one.",
    ],
    testStart: [
        "Sixty seconds. Bring it back how you found it. I'm counting.",
        "One lap. No highway. No friends in the back. Go.",
    ],
    testBack: [
        "Back. No scratches. …Good. So? Buy it or don't.",
        "You liked it. I saw. Don't haggle, I don't haggle.",
        "Yossi parked YOUR car out front. Yossi says it smells like kugel. I said nothing.",
    ],
    noCar: [
        "Your car stays here while you test mine. No car to leave? No test. Rules.",
    ],
    bye: ["Go. Drive careful.", "Come back with money. Or don't. I'll be here."],
};

/** Lulu walking past the lot (once a visit). */
export const PASS_DEALER = [
    "Uncle Refael's. He's going to say 'look, don't touch'. He always says that.",
    "Ooh, a ninja-black one. Ima would faint. I want it.",
    "Is that tube guy waving at me? …He's not. He's resting. Same.",
];

/** Her own garage at home (the driveway picker). */
export const GARAGE_LINES = {
    one: "Just my pink baby for now. Uncle Refael's lot is in Lakewood — the first thing on Route 9!",
    swap: ["New day, new ride. 💅", "Ooh, this one today.", "Driveway fashion show!", "Pink's jealous. Pink'll get over it."],
};

/** Which shop sells what (the 🛍️ Where to shop list: ctx.shops.places()). `town` = where it stands; `where` = the
 *  directions line; `sells` = what you can buy there. Places that aren't built yet still come through the old Shop. */
export const PLACES = [
    { id: "dealer", icon: "🚗", name: "Uncle Refael's Pre-Loved Cars", sells: "Cars (all 7 for sale) · test drives",
      towns: { lakewood: "Route 9, the first thing in town", midwood: "Coney Island Ave, Brooklyn" }, spot: "dealer" },
    { id: "makolet", icon: "🛒", name: "The makolet (grocery + pharmacy)", sells: "🌶️ Pepper spray · 🛡️ bubble wrap for cars (the shield) · 📱 the Distracted phone plan",
      towns: { lakewood: "Zissy's, on Main St", midwood: "Yanky's 24-Hour, on Avenue J" }, spot: "makolet" },
    { id: "black", icon: "😈", name: "Shmerel's van (the black market)", sells: "🚀 Missiles · 🎆 the Mega 5-Pack · 🌶️ pepper spray",
      towns: { lakewood: "by the construction site on 14th St", midwood: "outside the car service on Coney Island Ave" }, spot: "shopsBlack" },
    { id: "bling", icon: "✨", name: "Refael's Bling Bay", sells: "📯 6 horns (hear them first) · 🎀 7 car decorations (fitted on your car)",
      towns: { lakewood: "at Uncle Refael's on Route 9 — the pink neon door", midwood: "at Uncle Refael's on Coney Island Ave" }, spot: "bling" },
    { id: "clothes", icon: "👗", name: "Clothing shops", sells: "👚 Tops, skirts, shoes, coats + extras · try on in the fitting room",
      towns: { lakewood: "Simcha's Classic Clothing, on Main St", midwood: "Avenue J'adore, on Avenue J" }, spot: "clothes" },
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

// ── stage 3: ✨ Refael's Bling Bay (horns + car decorations, at the dealership) ──
export const BLING = {
    lulu: ["Oh she's FANCY now. 💅", "Ima's going to say 'what is THAT'. Perfect.", "Honk honk, world. HONK HONK.", "Worth every coin. Probably."],
};

// ── stage 4: 🍕 walk-in shops (rooms.js) — per town; a snack heals one heart, once a run, never free ──
const PIZZA_COMMON = {
    floor: ["#F5F5F5", "#C62828"], wall: "#FFF3E0", trim: "#C62828", counter: "#8D6E63", chair: "#C62828",
    snack: { icon: "🍕", name: "A slice", price: 6 },
    full: ["One slice. I have SELF CONTROL. (I do not have self control. I have a full stomach.)", "If I eat another slice Ima will KNOW. She always knows."],
    poor: ["Six coins, sweetheart. This isn't a charity, it's a PIZZA shop."],
    served: ["One plain slice! Hot! Don't burn your mouth! …You burned your mouth.", "Here. Extra cheese. Don't tell the others."],
    yum: ["Mmm. Worth the forty minutes. Almost. 🍕", "Okay that's GOOD. I'm healed. Emotionally and physically."],
};
export const ROOMS = {
    pizza: {
        lakewood: Object.assign({}, PIZZA_COMMON, {
            name: "Pizza Shmizza", title: "🍕 PIZZA SHMIZZA",
            menu: ["PIZZA SHMIZZA", "PLAIN SLICE · $6", "FRIES · ZA'ATAR FRIES · \"FRIES\"", "WAIT: 40 MIN (MINIMUM)"],
            server: { name: "Mendy", key: "npcMan", colors: { Top: "#FFFFFF", Bottom: "#C62828", Hair: "#3E2723" } },
            line: [{ name: "a dad", key: "npcMan", colors: { Top: "#1A237E", Bottom: "#263238", Hair: "#212121" } },
                { name: "a kid", key: "npcKid", colors: { Top: "#FFB300" } }, { name: "a mom", key: "npcWoman", colors: { Top: "#6A1B9A" } }],
            eater: { name: "Bochur", key: "npcMan", colors: { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723" } },
            lineLines: ["Forty minutes. I've been here since the LAST forty minutes.", "I ordered for nine kids. They're in the minivan. All nine. Waiting.", "Is this the line for the line? I think this is the line for the line."],
            eaterLines: ["Best pizza in Lakewood. Also the only pizza open right now.", "I came for one slice. This is my fourth. Don't judge.", "The secret's in the sauce. The sauce is ketchup. Don't tell anyone."],
            serverLines: ["NUMBER 412! …412? Anyone? Okay, 413!", "Two plain, one fries, NO onions!", "We're out of fries. We're always out of fries.", "Who ordered the pie with EVERYTHING? Everything is olives."],
            wall2: { label: "🖼️ The wall of fame", sign: "WALL OF FAME\n★ a rabbi ate here ★", lines: ["A signed photo: 'Best pizza in Lakewood!' — the owner's mother.", "A framed dollar. And a framed parking ticket. Lakewood's history."] },
        }),
        midwood: Object.assign({}, PIZZA_COMMON, {
            name: "Slice of Sinai", title: "🍕 SLICE OF SINAI", floor: ["#FAFAFA", "#1565C0"], trim: "#1565C0", chair: "#1565C0",
            menu: ["SLICE OF SINAI", "PLAIN · $6 · MOTZEI SHABBOS: $6 + PATIENCE", "BAKED ZITI · KNISH · EGG CREAM", "\"THE BEST IN BROOKLYN\" — US"],
            server: { name: "Shloimy", key: "npcMan", colors: { Top: "#FFFFFF", Bottom: "#1565C0", Hair: "#212121" } },
            line: [{ name: "a Brooklynite", key: "npcMan", colors: { Top: "#3949AB", Bottom: "#263238" } },
                { name: "a bubby", key: "npcWoman", colors: { Top: "#8E24AA" } }, { name: "a kid", key: "npcKid", colors: { Top: "#43A047" } }],
            eater: { name: "Car-service guy", key: "npcMan", colors: { Top: "#212121", Bottom: "#212121", Hair: "#424242" } },
            lineLines: ["Motzei Shabbos rules: the line goes around the block. Twice.", "You're from Lakewood? They have pizza there? Cute.", "I've been in this line since the Q was on time."],
            eaterLines: ["Five minutes! I'm on a break. I'm always 'five minutes'.", "Brooklyn pizza. Thin. Foldable. Like my excuses.", "You came from LAKEWOOD for this? Smart girl."],
            serverLines: ["NEXT! …NEXT! You — yeah you — what'll it be?", "Two slices and an egg cream for the gentleman with the double-parked car!", "We don't do 'gluten-free'. We do 'gluten'."],
            wall2: { label: "🖼️ The wall of fame", sign: "SINCE 1978\n(the oven, not the pizza)", lines: ["A photo of the Q train. Framed. Signed by the Q train.", "'Voted best slice on Avenue J' — by the guy who owns it."] },
        }),
    },
    bakery: {
        midwood: {
            name: "Challah-Day Inn", title: "🥖 CHALLAH-DAY INN", floor: ["#FFF8E1", "#D7CCC8"], wall: "#FFF8E1", trim: "#6D4C41", counter: "#A1887F", chair: "#6D4C41",
            menu: ["CHALLAH-DAY INN", "CHALLAH · RUGELACH · BABKA", "EREV-SHABBOS LINE: OUT THE DOOR", "NO SUBSTITUTIONS · NO EXCEPTIONS"],
            snack: { icon: "🥐", name: "A rugelach", price: 4 },
            full: ["One rugelach. ONE. The babka is staring at me. I will be STRONG."],
            poor: ["Four coins for a rugelach, motek. Babka's more. Everything's more."],
            served: ["Fresh from the oven! Careful, the chocolate's lava.", "Here, take it — and wish your Bubbe a good Shabbos!"],
            yum: ["Chocolate rugelach. Healing powers: confirmed. 🥐", "This is better than Bubbe's. NEVER tell Bubbe."],
            server: { name: "Mrs. Glick", key: "npcWoman", colors: { Top: "#FFFFFF", Bottom: "#6D4C41", Hair: "#5D4037" } },
            line: [{ name: "an erev-Shabbos shopper", key: "town_mom", colors: { Top: "#00695C" } }, { name: "a dad", key: "npcMan", colors: { Top: "#37474F" } },
                { name: "a kid", key: "npcKid", colors: { Top: "#F4511E" } }],
            eater: { name: "Bubby", key: "npcWoman", colors: { Top: "#7B1FA2", Hair: "#BDBDBD" } },
            lineLines: ["Six challahs. Two raisin, two plain, two 'whatever Shmuel likes'.", "They're out of babka. OUT. On a FRIDAY. I'm calling my rabbi.", "Is this the line for the bakery or the fish store? …Yes."],
            eaterLines: ["Sit, sit! You're too thin. Have a rugelach. Have TWO.", "In my day the challah was THIS big. And it cost a nickel.", "You're Lulu? I know your Bubbe! She owes me a kugel recipe."],
            serverLines: ["Raisin or plain? Round or long? Decide, motek, there's a LINE.", "Last babka! …Don't look at me like that. It's spoken for.", "Rugelach fresh out! Chocolate, cinnamon, apricot nobody buys!"],
            wall2: { label: "🖼️ The tzedakah box", sign: "TZEDAKAH\nthank you!", lines: ["A tzedakah box, full of coins and one button. Somebody's having a week.", "A sign: 'We don't do substitutions. We don't do exceptions. We DO love you.'"] },
            chair2: true,
        },
    },
};
