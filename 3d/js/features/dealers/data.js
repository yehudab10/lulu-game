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
        top: 1.30, acc: 1.25, grip: 1.40, brake: 1.45, nitro: 1.2, perks: ["ceramic", "massage", "cruise"],
        flavor: "So quiet you can hear Bubbe disapproving from the back seat.",
    },
    machatunim: {
        name: "Machatunim GT", price: 38000,
        body: "#F5F5F0", light: "#FFFFFF", dark: "#B0A990", stripe: "#C9A227",
        top: 1.45, acc: 1.45, grip: 1.40, brake: 1.40, nitro: 1.5, perks: ["launch", "selfpark", "concierge", "acc"],
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
    cruise:    { name: "⏱️ Cruise control", price: 700, desc: "❚❚ › Cruise: it holds your speed while you steer. Brake (or swerve hard) to cancel." },
};
/** Built-in perks a car comes with (LUX_CARS.perks) that aren't sold as options. */
export const BUILT_IN = {
    ceramic: "🛑 Ceramic brakes (it's in the brake stat)",
    acc: "🛰️ Adaptive cruise (❚❚ › Cruise: it holds your speed AND keeps a gap to the car ahead)",
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

// ── stage 2: TUSHLA, across the highway (the EV showroom: white, minimalist, no salesmen — a tablet) ──
export const EV = {
    id: "tushla", addr: "hw:tushla", name: "Tushla", full: "Tushla Motors", emoji: "⚡", d: -30,
    tagline: "No engine. No salesmen. No problem.",
    sign: { bg: "#F5F5F5", fg: "#111111", lines: ["TUSHLA", "THE FUTURE · LEFT"] },
};
/** The EV cars: huge acceleration (instant torque), the rest good. All carry the "schlep" hardware (the subscription). */
export const EV_CARS = {
    tushla_nu: {
        name: "Tushla Nu", price: 4000,
        body: "#ECEFF1", light: "#FFFFFF", dark: "#90A4AE", stripe: "#111111",
        top: 1.10, acc: 1.50, grip: 1.10, brake: 1.15, nitro: 1, perks: [],
        flavor: "The cheap one. 'Nu' as in 'nu, so you bought the cheap one'.",
    },
    tushla_oy: {
        name: "Tushla Oy", price: 9000,
        body: "#B71C1C", light: "#E57373", dark: "#5D0F0F", stripe: "#ECEFF1",
        top: 1.20, acc: 1.65, grip: 1.20, brake: 1.20, nitro: 1.1, perks: [],
        flavor: "Doors that open UP. Like eyebrows. At your parking.",
    },
    tushla_shh: {
        name: "Tushla Shh", price: 16000,
        body: "#111111", light: "#424242", dark: "#000000", stripe: "#ECEFF1",
        top: 1.35, acc: 1.80, grip: 1.25, brake: 1.25, nitro: 1.2, perks: [],
        flavor: "Pastrami Mode: 0–60 before the mustard. Silent. Bubbe still hears it.",
    },
    tushla_kugel: {
        name: "Kugeltruck", price: 24000,
        body: "#9E9E9E", light: "#CFD8DC", dark: "#616161", stripe: "#111111",
        top: 1.20, acc: 1.45, grip: 1.50, brake: 1.30, nitro: 1.2, perks: [],
        flavor: "Built like a kugel: square, heavy, and nobody asked for it. Shatterproof*. (*Shatters.)",
    },
};
export const EV_IDS = Object.keys(EV_CARS);
/** ⚡ The Tushla CONFIGURATOR (the owner: "more of a Tesla experience"): everything on one big screen — the model, then
 *  these, the price updating live, ORDER (a fixed price, no haggling), a delivery where it rolls out by itself. Each
 *  option is paid once per car (garage/buy.js buyExtra); "0" = the standard one. Colours are what the car really wears. */
export const EV_CONFIG = {
    paint: [
        { id: "stock", name: "Factory", hex: null, price: 0 },
        { id: "kugel", name: "Pearl Kugel White", hex: "#F2F1EC", price: 300 },
        { id: "cholent", name: "Midnight Cholent", hex: "#1C1B22", price: 300 },
        { id: "seltzer", name: "Seltzer Blue", hex: "#3D8BD4", price: 300 },
        { id: "pepper", name: "Very Red Pepper", hex: "#C62828", price: 450 },
        { id: "challah", name: "Challah Gold", hex: "#C9A227", price: 600 },
    ],
    wheels: [
        { id: "bagel", name: "19\" Aero Bagels", hex: "#3A3A3A", price: 0 },
        { id: "latke", name: "20\" Turbine Latkes", hex: "#B8BCC2", price: 400 },
        { id: "chrome", name: "21\" Shabbos Chrome", hex: "#E8E8E8", price: 800 },
    ],
    interior: [
        { id: "black", name: "All Black (vegan, it says)", hex: "#1E1E1E", price: 0 },
        { id: "cream", name: "Cream (Bubbe's good couch)", hex: "#EFE6D2", price: 500 },
        { id: "slipcover", name: "Plastic Slipcover Edition", hex: "#D8E3E8", price: 50 },
    ],
    horn: [
        { id: "chime", name: "Polite Chime", price: 0 },
        { id: "whoopee", name: "💨 Whoopee Mode", price: 150 },
    ],
    testSecs: 60,                     // the test drive from the screen
    updates: ["⬇️ Software update 2026.47: the turn signals now signal turns.", "⬇️ Software update 2026.48: the cup holder is now 3 % more cup-shaped.",
        "⬇️ Software update 2026.49: fixed — the car no longer says 'Recalculating' at red lights.", "⬇️ Software update 2026.50: added a Shabbos Mode. It's just a candle emoji on the screen."],
};
/** The founder (posts too much). His posts scroll on the showroom's screen + land in the 📱 now and then. */
export const ZEV = {
    name: "Reb Zev Volt", emoji: "🧑‍🚀",
    posts: [
        "Full Schlep Driving next month. Definitely. 100 %. (This month's next month.)",
        "Who needs salesmen when you have a TABLET. 🙃",
        "Kugeltruck pre-orders: 1,000,000. Deliveries: 3. Working on it.",
        "Our cars update overnight. Last night it learned to kvetch.",
        "Funding secured. (My Bubbe said yes.)",
        "The Nu is 0–60 in 'nu, already'.",
    ],
};
/** FULL SCHLEP DRIVING™ (not a real product name — a parody): the subscription. 100 coins per 30 REAL days; cancel any
 *  time (it runs to the end of what she paid); it lapses quietly — never a debt. Only Tushla cars can use it. */
export const SUB = {
    price: 100, days: 30,
    modes: {
        bubbe:   { name: "👵 Bubbe", mph: 50, gap: 40, lanes: false, desc: "50 mph, a big gap, never changes lanes. Signals for a full minute." },
        normal:  { name: "🙂 Normal", mph: 0, gap: 25, lanes: true, desc: "The limit, overtakes when it's clear." },
        // (Meshuga REALLY is: over the limit, tailgates, cuts in, honks — so a camera / a trooper can catch it like any speeder.
        //  That's the joke and the price; still no bonuses or coins. Bubbe + Normal stay law-abiding and ticket-proof.)
        meshuga: { name: "🌶️ Meshuga", mph: 0, over: 12, town: 38, gap: 9, cut: true, honk: true, lanes: true,
            desc: "Over the limit, tailgates, cuts people off, honks. Any tickets are yours. (Tushla is not responsible for Meshuga.)" },
    },
    quirks: [
        "🤖 Phantom brake! …It was a plastic bag. It's fine. It's FINE.",
        "🤖 “I see a pedestrian.” (It's a fire hydrant.)",
        "🤖 Lane-change signal on… for a while… still on…",
        "🤖 It honked at a pigeon. Politely.",
        "🤖 “Recalculating.” (Nothing changed.)",
    ],
};
