// features/dealers/data.js — the parody marques, their cars, the options, the nonsense, and the words. Every number
// that matters is here. Invented names only (no real brand, logo, model or feature names). Nothing here pays coins.

/** Where the dealerships stand on the 16 km lap (world.js LAP): once a lap, the same place every lap / friend. */
export const LAP_M = 800;
/** The luxury showroom: a pull-off on the right; the EV showroom faces it across the highway (stage 2). */
export const LUX = {
    id: "mazelati", addr: "hw:mazelati", name: "Mazelati", full: "Mazelati of Monsey", emoji: "🏎️", d: 30,
    tagline: "Hand-built in Monsey, Italy",
    sign: { bg: "#1B1B1B", lines: ["MAZELATI", "HAND-BUILT IN MONSEY, ITALY", "NEXT RIGHT"] },
};

/** The cars (car.js SKINS takes the stats + paint; garage/data.js SKIN_SHOP the price + flavour).
 *  Uncle Refael's cars run 0.9–1.30 a stat (the Ninja ~1.15–1.18 on all four) and top out at 2,500. */
export const LUX_CARS = {
    shabbatino: {
        name: "Shabbatino GT", price: 6000,
        body: "#0D1B2A", light: "#415A77", dark: "#000814", stripe: "#C9A227",
        top: 1.30, acc: 1.25, grip: 1.25, brake: 1.25, nitro: 1.2, perks: [],
        flavor: "Seven speeds, one rule: arrive before candle lighting.",
    },
    geltspyder: {
        name: "Gelt Spyder", price: 12000,
        body: "#C9A227", light: "#FFE08A", dark: "#7A5C00", stripe: "#1B1B1B",
        top: 1.40, acc: 1.40, grip: 1.20, brake: 1.20, nitro: 1.3, perks: ["launch"],
        flavor: "Gold-flake paint. The chocolate kind would melt.",
    },
    kvetchtoria: {
        name: "Kvetchtoria", price: 18000,
        body: "#4A0E2E", light: "#8E3B63", dark: "#24051A", stripe: "#E8D5A3",
        top: 1.30, acc: 1.25, grip: 1.40, brake: 1.45, nitro: 1.2, perks: ["ceramic", "massage"],
        flavor: "So quiet you can hear Bubbe disapproving from the back seat.",
    },
    machatunim: {
        name: "Machatunim GT", price: 38000,
        body: "#F5F5F0", light: "#FFFFFF", dark: "#B0A990", stripe: "#C9A227",
        top: 1.45, acc: 1.45, grip: 1.40, brake: 1.40, nitro: 1.5, perks: ["launch", "selfpark", "concierge"],
        flavor: "The in-laws will judge it. Let them. You're driving.",
    },
};
export const LUX_IDS = Object.keys(LUX_CARS);

/** Options that DO something (once per car; small, capped, never a coin source). `on` = the cars that can take it. */
export const OPTIONS = {
    launch:    { name: "🚀 Launch control", price: 1500, desc: "From a stop, floor it: an easy rocket start, every time." },
    tank:      { name: "🔋 Bigger nitro tank", price: 1200, desc: "Nitro lasts 30 % longer." },
    massage:   { name: "💆 Massage seats", price: 900, desc: "Stopped for 20 s with a heart missing: +1 ♥. Once a run." },
    fridge:    { name: "🥂 The champagne fridge", price: 400, desc: "It's seltzer. A fizzy sip of nitro, once a run, when you stop." },
    concierge: { name: "🛎️ The concierge horn", price: 300, desc: "Honk and the car says something classy." },
};
/** Built-in perks a car comes with (LUX_CARS.perks) that aren't sold as options. */
export const BUILT_IN = {
    ceramic: "🛑 Ceramic brakes (it's in the brake stat)",
    selfpark: "🅿️ Self-park: in the Parking Challenge, once a level, it parks itself (scores ★, no level bonus)",
};
/** The F&I office's nonsense: costs coins, does NOTHING but a joke line (Sal remembers what she fell for). */
export const NONSENSE = {
    undercoat: { name: "🛡️ Undercoating", price: 250, pitch: "Protects the bottom of the car. From what? From the GROUND, my friend.", after: "Your undercoating is holding up beautifully. Underneath. Where nobody sees it." },
    nitrogen:  { name: "🎈 Nitrogen in the tyres", price: 150, pitch: "Regular air is 78 % nitrogen. Ours is 100 %. That's 22 % more air.", after: "How are the nitrogen tyres? Lighter, right? You feel it. Everybody feels it." },
    vin:       { name: "🔢 VIN etching", price: 200, pitch: "We etch the car's number on the windows. So the windows know whose they are.", after: "The windows still know their number? Good. Loyal windows." },
    platinum:  { name: "💎 The Platinum Peace of Mind", price: 600, pitch: "Covers anything that could go wrong. Except what goes wrong. That's Gold.", after: "Platinum Peace of Mind! How's your peace? Your mind? Both platinum? Beautiful." },
};

/** Sal Mazel, the salesman (silk tie, calls everyone "my friend"). */
export const SAL = {
    name: "Sal Mazel", emoji: "🤵", color: "#C9A227",
    colors: { Top: "#1B1B1B", Bottom: "#1B1B1B", Hair: "#212121" },
    hello: [
        "My friend! Welcome to Mazelati. Hand-built in Monsey, Italy. It's a real place. Look it up. Don't look it up.",
        "Ah, a woman of TASTE. I could tell from the parking lot. You parked at an angle. Confident.",
        "Please, touch everything. In this showroom we don't say 'look don't touch'. That's the OTHER place.",
    ],
    sticker: ["The sticker is {p}. And for you, today, because I like your face… it's still {p}. But I SAY it nicer.",
        "{p}. And that's before I fall in love with you as a customer, which is happening right now."],
    counter: ["{c}?! My friend, I have children. Okay, I have a cat. She has expensive taste. …{n}.",
        "Oy. You're killing me. You're KILLING me. {n}, and I'm doing it with tears."],
    firm: ["Look at me. Look at my tie. Would a man in this tie lie to you? {n}. Final. Probably."],
    manager: ["Wait — wait. Don't go. Let me talk to my manager.", "*he walks into an office with no one in it, closes the door, and sighs loudly*",
        "Okay. My manager says I'm crazy. {n}. Don't tell anyone."],
    lost: ["You know what? You pushed. I respect it. But the price is back to {p}. That's business, my friend.",
        "That's an insult to the car. The car heard you. {p}, and the car wants an apology."],
    deal: ["MAZEL TOV! Now come — the finance office. Just a few small things. Very small. Tiny.", "Sold! You won't regret it. You might. But not today!"],
    fni: "Welcome to the F&I office. F and I. Fabulous and… Important. Let me walk you through a few PACKAGES.",
    fniNo: ["No? You're sure? It's your peace of mind, my friend. Not mine. Mine is fine.", "Okay, okay. Smart. You're too smart. I hate it."],
    fniYes: ["Excellent choice. Truly. One of the choices of all time.", "You'll thank me. Maybe not out loud."],
    poor: "We have a phrase in Monsey, Italy: 'come back with the coins'. It's very old.",
    bye: ["Come back soon! The cars miss you already. I miss you already.", "Ciao! Shalom! Ciao-lom!"],
    tradeIn: "Your trade-in? I give you {t}. I know, it's generous. I'm a generous man. Ask my cat.",
};

/** The haggle's numbers: the best a deal can get + how much pushing he takes. */
export const HAGGLE = {
    floor: 0.85,                  // never below sticker × 0.85
    steps: [0.95, 0.90],          // her counters: −5 %, −10 %
    patience: 3,                  // pushes before he loses it (a counter costs 1, "final offer" 2)
    managerBonus: 0.05,           // walking toward the door with a counter on the table → "let me talk to my manager": 5 % more off (once; bounded by the floor)
    tradeIn: 0.25,                // a trade-in is worth 25 % of what she paid (never a profit)
};
