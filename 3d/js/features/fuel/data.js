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
/** 🔋 Charging (step 2): fraction a second — 10 → 80 % in 20 s, 80 → 100 % in 15 s — and the chargers' reach (m). */
export const CHARGE = {
    fast: 0.035, fastTo: 0.8, slow: 0.0133,
    r: { tushla: 18, bay: 9, kerb: 6 },    // Tushla's whole forecourt · a rest area's pump bay · the kerbside post
    hold: 5,                               // + this while a session's going (getting out parks the car a step off)
    restD: 28.6,                           // (exits › BAYS.pump.d: the rest area's pump bay, off the highway)
    kerbSpot: "cityhall", kerbOut: 4.5,    // the kerbside charger: out from this town spot's front toward the street
};
/** 🏠 The home charger (Tushla sells it; installed at a home she OWNS). */
export const HOME = { price: 1500, move: 300, cord: 0.3, reach: 25, box: [1.4, 0] };

/** The gauge: the low badge below this fraction. */
export const LOW = 0.15;
/** Step 3 — running dry. RESERVE: past E there are this many km of "fumes" (longer than any gap between two pumps); in a
 *  chase the burn stops with CHASE_KEEP km of it left (cops end chases, not the gauge). An empty car on the shoulder isn't
 *  towed for GRACE real minutes (features/cars asks ctx.fuel.dryGrace). */
export const DRY = { reserveKm: 3, chaseKeepKm: 1, graceMin: 10, warnJob: 0.2 };
/** Getting going again: 📞 Chaverim's splash (free once a real day, then `fee`, on account if she's broke) or 🛢️ a can
 *  from any pump (on foot: `price`, walk it back, pour it in). EVs: Chaverim's portable battery (the same rule). */
export const RESCUE = { chaverim: { wait: 20, splash: 0.15, fee: 10 }, can: { price: 5, amount: 0.15, reach: 30 } };
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
    { id: "hw:fuel:rest0", lap: 5700, name: "PetroLatke (rest area)", sub: "⛽ gas · 🔋 charging" },
    { id: "hw:fuel:gng1", lap: 6900, name: "Yanky's Gas 'n' Go", sub: "⛽ gas · a rugelach" },
    { id: "hw:fuel:rest1", lap: 14200, name: "PetroLatke (rest area)", sub: "⛽ gas · 🔋 charging" },
    { id: "hw:fuel:midwood", lap: 3780, name: "Fill-a-Kvetch (the Midwood exit)", sub: "⛽ gas · 🔋 charging · at the T" },
    { id: "hw:fuel:lakewood", lap: 12180, name: "Fill-a-Kvetch (the Lakewood exit)", sub: "⛽ gas · 🔋 charging · at the T" },
    { id: "hw:charge:tushla", lap: 800, icon: "🔋", name: "Tushla Shlepercharger", sub: "🔋 charging · 4 bays" },
];
/** Cars / rides with no gauge at all: Ima's family minivan never runs out (features/cars › MINIVAN — she drives it as a
 *  borrowed shell, so it's matched as a ride kind too). */
export const NO_GAUGE = new Set(["imaVan", "minivan", "town_minivan", "cars_minivan"]);

export const L = {
    filled: (n, cost) => `⛽ Filled up${cost ? ` — ${cost} 💰` : ""}${n < 0.999 ? ` (${Math.round(n * 100)} %)` : ""}`,
    full: "⛽ Already full. The pump guy looks disappointed.",
    iou: "⛽ \"Pay me next time, sweetheart.\" (a quarter tank on account)",
    owed: "⛽ \"You still owe me from last time, sweetheart.\" (come back with a few coins)",
    iouPaid: n => `⛽ …and ${n} 💰 for last time's IOU. "A mensch!"`,
    low: "⛽ Low fuel",
    empty: "⛽ On E",
    townPump: "Fill-a-Kvetch",
    charging: "🔋 Charging… (get out if you like — it keeps going)",
    charged: cost => `🔋 Charged${cost ? ` — ${cost} 💰` : ""}. *ding*`,
    chargeBroke: "🔋 Out of coins — the charger stopped. (It's not personal. It's a charger.)",
    fumes: "⛽ It's on E. E means 'Enough', right? (Running on fumes — a few km left.)",
    dry: "⛽ *sputter*… Out of gas. Coast onto the shoulder — 📞 Chaverim brings a splash, or walk a 🛢️ can over from a pump.",
    dryEV: "🔋 *a sad little chime*… Out of charge. Coast over — 📞 Chaverim has a portable battery.",
    dryChip: "Out of gas · 📞 Chaverim · 🛢️ a can",
    chavReason: ev => (ev ? "I'm out of charge (for real)" : "I'm out of gas (for real)"),
    chavSub: free => (free ? "a splash to get you to a pump · free today" : "a splash to get you to a pump · 10 💰"),
    chavCall: "📞 Chaverim: \"A splash? Twenty minutes.\" (It's twenty seconds. They say twenty minutes to be safe.)",
    chavHere: ev => (ev ? "🔋 Chaverim's Yossi plugs in a portable battery. +15 %. \"Drive to a charger. NOW.\"" : "⛽ Chaverim's Yossi pours in a splash. +15 %. \"Next pump. Don't be a hero.\""),
    canBuy: "🛢️ A CAN OF GAS — 5 💰",
    canGot: "🛢️ Got a can. Walk it back to the car.",
    canPour: "🛢️ POUR IT IN",
    canDone: "🛢️ Glug glug. +15 %. Now to a pump, for real.",
    jobLow: "⛽ You're almost on E — the nearest pump is pinged on the 📱 Map. (Or go anyway. It's your adventure.)",
    selfLow: "⚡ Low battery — heading to the nearest charger. (Clear the 📍 ping to stop it.)",
    evAtPump: "⛽ Yanky eyes the Tushla: \"Electric? I got a toaster outlet in the back. Try a charger.\"",
};
