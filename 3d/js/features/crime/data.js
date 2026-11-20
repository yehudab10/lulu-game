// features/crime — every knob + every line (tune here). See index.js for the catalogue.
export const ID = "crime";

/** What each crime pays and its cap (AGENTS golden rule 5: nothing repeatable for free). Per REAL day = the device's date. */
export const PAY = {
    cart: { base: 4, perM: 1 / 12, perScatter: 2, maxRide: 15, ridesPerDay: 2, name: "🛒 SHOPPING-CART JOYRIDE" },
    jaywalk: { from: 2, each: 2, perDay: 12, name: "🚶‍♀️ JAYWALKING SPREE" },
    park: { perHonk: 1, maxStop: 8, order: 3, perDay: 16, name: "🅿️ DOUBLE-PARKING EMPIRE" },
};

export const TUNE = {
    // the law, on foot: a cop who SEES a petty thing gives a ⚠️ look first; again within susLife s = the foot chase
    susLife: 30,
    copSight: 46,               // m — law units + the town's patrol car (clear line of sight)
    // 🛒 the cart
    cart: { r: 2.2, top: 9.5, accel: 3.2, steer: 2.6, drag: 0.35, life: 22, scatterR: 2.6, minRide: 6 },
    // 🚶‍♀️ jaywalking: across the street mid-block (≥ midBlock m from any crossing) in ≤ crossMax s; combo window
    jay: { midBlock: 11, crossMax: 9, combo: 14, dodgeR: 4.2, dodgeSpeed: 3 },
    // 🅿️ double-parking: stopped in a travel lane on a shop street; a honk = a town car stuck behind her
    park: { stopFor: 1.6, honkR: 26, honkEvery: 3.2, orderAt: 24, midwoodGrace: 40, lakewoodGrace: 14 },
};

// ── charges (law.addCharge: the arrest lines, the lawyer, a courtroom event that always plays) ──
export const CHARGES = {
    cart: {
        key: "SHOPPING CART", name: "GRAND THEFT SHOPPING CART", weight: 1, nudge: "help",
        cop: ["A shopping cart. Down the MIDDLE of the avenue.", "Ma'am, that cart has a wobbly wheel AND a record now."],
        lulu: ["It was RETURNING itself!", "I was bringing it back. Fast."],
        defense: "my client was RETURNING the cart, your honor. Downhill. With enthusiasm. The store got it back — eventually — with only one wobbly wheel, which it always had.",
        court: [
            { who: "BAILIFF", p: "bailiff", text: "Exhibit A, your honor. *pushes in a shopping cart; one wheel squeaks the whole way*" },
            { who: "PROSECUTOR", p: "prosecutor", text: "Clocked at 21 miles an hour. In a SHOPPING CART. Past a crossing guard." },
            { who: "JUDGE", p: "judge", text: "…does it still have the quarter in it? *checks* It does. Order. ORDER." },
        ],
    },
    jaywalk: {
        key: "JAYWALKING", name: "SERIAL JAYWALKING", weight: 1, nudge: "help",
        cop: ["The crosswalk was RIGHT THERE. I pointed at it.", "Seven times. Mid-block. Every single one."],
        lulu: ["The crosswalk was SO far. Like forty feet.", "I looked both ways! Twice!"],
        defense: "my client looked both ways, your honor — repeatedly. The crosswalk was forty feet away. Forty. Feet. In those shoes.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "The People present a map, your honor. Red line: the crosswalk. Pink zigzag: the defendant." },
            { who: "JUDGE", p: "judge", text: "That's not a route. That's a SIGNATURE." },
        ],
    },
    park: {
        key: "DOUBLE PARKING", name: "DOUBLE PARKING (\"ONE SECOND\")", weight: 1, nudge: "help",
        cop: ["Double-parked. Eleven cars stuck behind you.", "'One second', she said. It's been FORTY."],
        lulu: ["My hazards were ON!", "Everyone does it! It's practically a LANE!"],
        defense: "my client's hazards were ON, your honor. In this borough, as the court well knows, that is practically a parking permit.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "Witness statement from a Mr. Glick, car four in the line: 'HONK. HONK. HOOOONK.' Unquote." },
            { who: "JUDGE", p: "judge", text: "Were the hazards on? *nods slowly* …I'll allow it. Partly." },
        ],
    },
};

// ── lines ─────────────────────────────────────────────────────────────────
export const LINES = {
    // the cop's ⚠️ look (on foot, the first petty thing he sees)
    warn: {
        cart: ["🚓 \"Is that… a SHOPPING CART?\"", "🚓 \"Ma'am. The cart. Off the street.\""],
        jaywalk: ["🚓 \"Crosswalk's RIGHT THERE.\"", "🚓 \"I saw that. Once is a warning.\"", "🚓 \"Corner. Light. Walk. It's not hard.\""],
        park: ["🚓 \"Move it or lose it, hazards.\"", "🚓 \"You're blocking the whole avenue!\""],
    },
    chase: { cart: "🚨 THE CART COP!", jaywalk: "🚨 JAYWALKER!", park: "🚨 THAT'S IT — DOUBLE PARKING!" },
    cart: {
        spot: "🛒 Ride the runaway cart",
        short: "RIDE",
        on: ["WHEEEEE!", "This is NOT returning it!", "Brakes? BRAKES?!"],
        scatter: ["WATCH IT!", "Oy, a CART!", "Meshugge!", "My challah!"],
        crash: ["…I'm okay!", "Ten out of ten. Would cart again."],
        done: "{name} — {m} m · {n} scattered",
        capped: "🛒 Pure joy. (No more coins from carts today.)",
        owner: ["My CART! Bring back my cart!", "That's a quarter cart, young lady!"],
        hint: "steer with the stick · it stops by itself",
    },
    jaywalk: {
        combo: "🚶‍♀️ JAYWALK ×{n}",
        dodge: "😅 CLOSE ONE",
        first: ["Mid-block. Living dangerously.", "The crosswalk is a suggestion."],
        honk: ["HEY! Crosswalk!", "*HOOONK*", "Look where you're walking!"],
    },
    park: {
        prompt: "🅿️ Double-park — \"one second\"",
        start: ["One second! ONE SECOND!", "Hazards on. Totally legal."],
        honk: ["*HONK*", "*HOOONK*", "MOVE IT!", "Lady, the HAZARDS aren't a permit!", "One second my foot!"],
        order: "🍕 The order's ready — the counter guy brings it out",
        done: "{name} — {n} cars held up",
        legal: ["🚓 \"…hazards are on. Carry on.\"", "🚓 *shrugs at the hazards* — it's Midwood."],
        capped: "🅿️ (Enough honking for today — no more coins from it.)",
    },
    copSees: "👮 A cop saw that!",
};
