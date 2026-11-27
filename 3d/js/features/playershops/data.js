// features/playershops/data.js — 🏪 EVERY NUMBER for player-owned shops (roadmap 44; the plan: 3d/docs/playershops-plan.md).
// The owner's reactions should be one-line changes here. Stage 1 is client only: nobody buys from her shop yet ("Opening
// soon"); stage 2 (the relay's /shops/*) waits for the owner's OK.

export const ID = "playershops";

// ── how many shops a player may hold (homes don't count; never more than TOTAL) ──
export const CAP = { midwood: 1, lakewood: 3 };
export const TOTAL = 4;
/** How many plain storefronts in a town stand FOR LEASE at any time (the rest stay what they are). */
export const FOR_LEASE = { midwood: 4, lakewood: 6 };

// ── leasing from the landlord (cheap to start, can be lost) ──
export const LEASE = {
    deposit: 300,         // paid when she signs; back in full when she hands the keys back (or the landlord changes the locks)
    perDay: 60,           // per PLAYED day, taken like a mortgage payment the moment she has the coins
    missLetter: 1,        // played days unpaid in a row → a note under the door
    missLocks: 3,         //  … → the landlord changes the locks (her stock goes into boxes at home, the deposit back)
};
// ── buying the building (cash or the bank's mortgage desk — the same plans as a home, never the first-home plan) ──
export const BUY = { lakewood: 14000, midwood: 18000 };
export const BUY_TERMS = [{ days: 20, fee: 0.10 }, { days: 30, fee: 0.15 }];
export const BUY_DOWN = [0.2, 0.35, 0.5];
export const SELL_FEE = 0.10;     // selling the building back (the same 10 % as a home)

// ── the government ──
export const PERMIT_KIND = "shop";        // features/cityhall's permits (the three-window errand; never blocking)
export const TAX_RATE = 0.002;            // of the building's price per played day — inside City Hall's daily tax cap (homes + shops)
/** Midwood: Mayor Marxdani's edict (his voice). Lakewood: Mayor Kugelman's (the opposite). */
export const EDICT = {
    midwood: {
        title: "The People's Retail Fairness Edict",
        poster: ["PEOPLE'S RETAIL", "FAIRNESS EDICT", "ONE SHOP PER PERSON", "— Mayor Marxdani"],
        refuse: "One shop per person. That's the Edict. Mayor Marxdani says if you have two shops, you're a CHAIN, and chains are how it starts.",
        sign: "Mayor Marxdani's office stamps the lease: 'One shop. ONE. The People are watching. Also me.'",
    },
    lakewood: {
        title: "Mayor Kugelman's Open For Business Order",
        poster: ["OPEN FOR BUSINESS", "BUY A SHOP!", "SHOPS = PARKING FEES", "— Mayor Kugelman"],
        refuse: "Three shops is the limit even here. Mayor Kugelman wanted no limit, but the parking authority ran out of meters.",
        sign: "Mayor Kugelman sends a fruit basket: 'Welcome to business! Customers need parking. Parking needs meters. You see where this is going.'",
    },
};

// ── licences: how many shops of each kind a town allows (so the street doesn't repeat) ──
export const KINDS = {
    kugel: { name: "kugel shop", emoji: "🥘", bake: true, color: "#F9A825", goods: ["kugel", "kugelSweet"] },
    cake: { name: "bakery", emoji: "🎂", bake: true, color: "#EC407A", goods: ["cake", "rugelach"] },
    sushi: { name: "sushi bar", emoji: "🍣", bake: false, color: "#26A69A", goods: ["sushi"] },
    handy: { name: "handy things", emoji: "🧰", bake: false, color: "#5D4037", goods: ["pan", "seltzer", "pillow", "blower"] },
    party: { name: "party goods", emoji: "🎉", bake: false, color: "#7E57C2", goods: ["balloon", "chicken", "giftbox"] },
    carcare: { name: "car care", emoji: "🔧", bake: false, color: "#1565C0", goods: ["washToken", "airFresh"] },
};
export const LICENCES = {
    midwood: { kugel: 2, sushi: 1, carcare: 1, party: 1, handy: 1, cake: 1 },
    lakewood: { kugel: 3, sushi: 2, carcare: 2, party: 2, handy: 2, cake: 2 },
};

// ── goods: a houseitems item where one exists (the buyer gets THAT item — ci/houseitems' verbs); `item: null` = a
//    request to ci/houseitems / ci/carcare, shown on the shelf, sold in stage 2 once it exists. `cost` = per unit from
//    the depot (or the ingredients for a baked one); a box holds `box` units. ──
export const GOODS = {
    kugel: { name: "potato kugel", emoji: "🥘", item: "kugel", cost: 12, box: 4, baked: true, stale: 3 },
    kugelSweet: { name: "lokshen kugel", emoji: "🍮", item: "kugel", cost: 14, box: 4, baked: true, stale: 3 },
    cake: { name: "honey cake", emoji: "🍰", item: null, cost: 14, box: 4, baked: true, stale: 3 },
    rugelach: { name: "rugelach", emoji: "🥐", item: null, cost: 10, box: 6, baked: true, stale: 3 },
    sushi: { name: "sushi tray", emoji: "🍣", item: null, cost: 22, box: 4, stale: 2, jfk: true },
    pan: { name: "frying pan", emoji: "🍳", item: "pan", cost: 30, box: 2 },
    seltzer: { name: "seltzer bottle", emoji: "🍾", item: "seltzer", cost: 12, box: 4 },
    pillow: { name: "pillow", emoji: "🛏️", item: "pillow", cost: 18, box: 2 },
    blower: { name: "leaf blower", emoji: "🍂", item: "blower", cost: 40, box: 1 },
    balloon: { name: "water balloons", emoji: "🎈", item: "balloon", cost: 6, box: 6 },
    chicken: { name: "rubber chicken", emoji: "🐔", item: "chicken", cost: 10, box: 4 },
    giftbox: { name: "gift box", emoji: "🎁", item: null, cost: 20, box: 3 },
    washToken: { name: "car-wash token", emoji: "🧽", item: null, cost: 15, box: 5 },
    airFresh: { name: "air freshener", emoji: "🌲", item: null, cost: 8, box: 6 },
};
/** Her price must sit inside cost × [min, max] (baked: the top rises with the stars). */
export const BAND = { min: 1.2, max: 1.8, starTop: [1.5, 1.65, 1.8] };
/** The 15 % the town keeps of every sale (stage 2). */
export const SALES_TAX = 0.15;

// ── the 📦 Wholesale Depot (at every rest area) + what her car carries ──
export const DEPOT = { name: "Feldman's Wholesale Depot", emoji: "📦", who: "Mr. Feldman", sellsBaked: "ingredients", perVisit: 12 };
/** Boxes her car holds, by the car's marque / skin / name (first match wins). Swap in ctx.cars when ci/cars lands. */
export const CARRY = [
    { match: /minivan|ima/i, n: 12 },
    { match: /mazelati/i, n: 2 },
    { match: /tushla/i, n: 5 },
    { match: /.*/, n: 6 },
];
/** Boxes she can carry on foot from the car to the shop at once (the rest wait in the car). */
export const HANDS = 3;

// ── the shop inside ──
export const SHELF = { slots: 24, perSlot: 4 };     // 24 slots × up to 4 units each
export const STOCKROOM = 30;                        // boxes the back room holds
export const BAKE = { secs: 30, perBatch: 4, steps: 3 };   // one ingredients box → 4 baked units, 1–3 ⭐

// ── stage 2 (the relay — waiting for the owner's OK; the numbers the server would keep) ──
export const SALES = {
    ownerDayProfit: 300,   // an owner earns at most this a real day across all her shops
    buyerPerOwner: 150,    // a buyer spends at most this a real day at one owner's shops
    buysPerShop: 3,        // … and buys at most this many times a day in one shop
    minDays: 3,            // a buyer needs a username + this many played days
    clerkShare: 0.10,      // the clerk is paid this share of the day's sales (no sales → no wage)
    selfUse: 3,            // the owner may take this many of her own goods a day, at cost
    idleDays: 14, holdDays: 7,   // the homes rule: unseen → "under renovation" → back on the market
};
