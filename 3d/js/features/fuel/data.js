// features/fuel — EVERY NUMBER for ⛽ gas + 🔋 charging (the owner approved the plan 2026-11-27: "a real necessary
// thing but doesn't become a huge burden"). Tune freely; nothing else in the feature hard-codes a number.

/** How far a full tank / a full charge goes (km). The lap is 16 km; mixed play is ~2 min of play per km. */
export const RANGE = {
    base: 64,                // Uncle Refael's cars (pink & co.): 4 laps ≈ 35 min flat-out highway, ≈ 50–60 min of normal play
    lux: 48,                 // a Mazelati drinks more (premium only)
    machatunim: 44,          // …"it's a V12, darling"
    ev: 80,                  // a Tushla
    tushla_nu: 72,           // the cheap one
    tushla_kugel: 60,        // heavy
};
/** Nitro burns this many times the gas while it's lit (EVs have no nitro). */
export const NITRO_BURN = 3;

/** Prices (coins) for a FULL tank / charge from empty; a partial fill is pro rata, rounded up, at least 1. */
export const PRICE = { gas: 30, lux: 45, machatunim: 55, charge: 15 };
/** With 0 coins the attendant fronts this much of a tank "on account" — one IOU at a time, paid off at the next paid fill. */
export const IOU = 0.25;

/** How long things take (s). */
export const TIME = { fill: 4 };

/** The gauge: the low badge below this fraction. */
export const LOW = 0.15;
/** A borrowed / hotwired car's tank: a random level in this range (kept for that ride). */
export const BORROWED = [0.3, 0.9];

/** The pumps (lap metres on the 16 km lap). Gas 'n' Go + the rest areas are drive-up bays that already exist (world /
 *  exits: their visit fills the tank); the towns' pumps are the gas stations standing at each interchange's T. */
export const PUMPS = {
    bays: ["gas", "exits_pump"],                 // ctx.places ids whose visit fills her up
    // the towns' pad: ON the paved cross road, alongside the station (its canopy stands 15 m off it at d 64 — solid, and at
    // the world's edge): stop within `pad` m of (u = the cross road's canopy-side edge, d) and the attendant walks over
    towns: { d: 64, pad: 8 },
};
/** The ⛽ places on the 📱 Map (ctx.pins, "help": always shown). */
export const PINS = [
    { id: "hw:fuel:gng0", lap: 1300, name: "Yanky's Gas 'n' Go", sub: "⛽ gas · a rugelach" },
    { id: "hw:fuel:rest0", lap: 5700, name: "PetroLatke (rest area)", sub: "⛽ gas" },
    { id: "hw:fuel:gng1", lap: 6900, name: "Yanky's Gas 'n' Go", sub: "⛽ gas · a rugelach" },
    { id: "hw:fuel:rest1", lap: 14200, name: "PetroLatke (rest area)", sub: "⛽ gas" },
    { id: "hw:fuel:midwood", lap: 3780, name: "Fill-a-Kvetch (the Midwood exit)", sub: "⛽ gas · at the T" },
    { id: "hw:fuel:lakewood", lap: 12180, name: "Fill-a-Kvetch (the Lakewood exit)", sub: "⛽ gas · at the T" },
];
/** Cars with no gauge at all (Ima's minivan never runs out). */
export const NO_GAUGE = new Set(["imaVan", "minivan"]);

export const L = {
    filled: (n, cost) => `⛽ Filled up${cost ? ` — ${cost} 💰` : ""}${n < 0.999 ? ` (${Math.round(n * 100)} %)` : ""}`,
    full: "⛽ Already full. The pump guy looks disappointed.",
    iou: "⛽ \"Pay me next time, sweetheart.\" (a quarter tank on account)",
    owed: "⛽ \"You still owe me from last time, sweetheart.\" (come back with a few coins)",
    iouPaid: n => `⛽ …and ${n} 💰 for last time's IOU. "A mensch!"`,
    low: "⛽ Low fuel",
    empty: "⛽ On E",
    townPump: "Fill-a-Kvetch",
};
