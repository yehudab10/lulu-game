// features/heist — every number and every line.
//
// Tone (the owner's call): CARTOON ONLY. The robbers wave a banana, a water pistol, a confetti
// blaster or a baguette; nobody is ever shot or hurt beyond the game's usual knock-down / heart
// rules; the cops bring a stun net and a spike strip. Family comedy, 12+.

export const ID = "heist";

// ── the coin economy (for scale) ──────────────────────────────────────────
// Cars in the shop: 150 · 300 · 450 · 600 · 900 · 1500 (Golden Lux) · 2500 (Black Ninja).
// Side jobs: a cab fare 26–40 (+ tips), Uncle Moishe's getaway 230–300 + 25/★, a chop-shop car 90–180.
// Bail / fines: the bounty is 13 × the charges' weight (cap 400); the precinct fines window 50 + 40 a charge.
// So: foiling a robbery ≈ a good cab fare; a clean cartoon heist ≈ 1.2–2× the getaway job (the risk is a
// real 3–4★ chase, an arrest + a conviction, and a warrant that follows her), at most ONE a run and one
// every HEIST.cooldownMin minutes — 3–6 clean heists for the Ninja, not one. A snatcher never takes more
// than SNATCH.capFrac of the wallet, capped at SNATCH.cap coins, and catching him refunds it all + a bonus.
export const PAY = {
    foil: [55, 80],          // stopping a getaway car (rams / a PIT / boxing it in)
    foilClean: 20,           // …without losing a heart doing it
    tackle: 35,              // …on foot: a flying tackle before he reaches the car (on top of foil)
    snatchBonus: 15,         // caught the moped snatcher: the coins back + this
    carBonus: 20,            // yanked the car thief out of her car: + this
};
export const HEIST = {
    base: { lakewood: 360, midwood: 420 },   // the take before the plan's multiplier and lost bags
    bags: 3,                 // money bags in the back seat; a hard crash bounces one out
    bagLost: 0.2,            // each lost bag costs this much of the take
    bagImpact: 9,            // m/s: a crash at least this hard loses a bag (max 2 lost)
    heatBonus: 30,           // per ★ at the moment she shakes them
    cooldownMin: 20,         // real minutes between heists (store("heist").lastJob)
    arriveR: 15,             // m from the bank's door: pull up out front…
    arriveV: 5,              // …slower than this (m/s)
    warrant: "BANK HEIST (WITH A BANANA)",
};
/** The getaway plans (picked after casing the bank). stars = the chase's heat at the door. */
export const PLANS = [
    { id: "quiet", emoji: "🤫", name: "THE QUIET ONE", stars: 2, mul: 0.75, blurb: "a silent alarm (it's Bubbe's hearing aid) · ★★ · 0.75× take" },
    { id: "classic", emoji: "🏎️", name: "THE CLASSIC", stars: 3, mul: 1.0, blurb: "in, out, floor it · ★★★ · 1× take" },
    { id: "loud", emoji: "🚀", name: "THE LOUD ONE", stars: 4, mul: 1.35, nitro: true, blurb: "a full nitro tank + a LOT of cops · ★★★★ · 1.35× take" },
];

// ── tuning ────────────────────────────────────────────────────────────────
export const TUNE = {
    robbery: {
        first: [70, 120],    // s of driving before the first robbery can happen (Cruise / a town)
        every: [140, 220],   // s between robberies
        townR: [35, 170],    // m: a town's bank / shop has to be this far from her to stage one
        storeAhead: 720,     // m: the highway's mini-mart goes up this far ahead (before its chunk is built)
        trigger: 95,         // m from the store / bank when the robber bursts out
        rams: 3,             // rams to stop the getaway car (a PIT or boxing it in stops it at once)
        boxT: 1.4,           // s the getaway car sits stuck with her car right there = boxed in
        hwySpeed: 0.8,       // × her unboosted top speed (she can catch it; nitro makes it easy)
        townCruise: 12,      // m/s on the town's streets (it still stops at stop signs: it's Lakewood)
        maxT: 80,            // s before they get away
        lostR: 320,          // m: that far ahead of her and they're gone
    },
    snatch: {
        first: [80, 140], every: [150, 260],
        still: 2.4,          // s stopped (a stop sign, a jam, the rest-area lot, parked) before a moped creeps up
        warn: 1.7,           // s to react: HONK / drive off / (on foot) ✋ clutch the purse
        capFrac: 0.12,       // never more than this share of the wallet…
        cap: 45,             // …and never more than this many coins
        minWallet: 15,       // a wallet this thin isn't worth his time
        speedCar: 15,        // m/s the moped flees at (her car is much faster)
        speedTown: 11,
        speedFoot: 6.6,      // on foot she runs 7.6 m/s — and the moped sputters
        catchCar: 3.4,       // m: clip him with the car
        catchFoot: 1.9,      // m: grab him on foot
        maxT: 40, lostR: 230,
    },
    theft: {
        away: [9, 14],       // s she's > far m from her parked car before a thief tries it
        far: 24,
        warn: 3.4,           // s to get back within saveR
        saveR: 8,
        drive: 8.6,          // m/s when the car goes (he can't work the clutch: it lurches + stalls)
        stallEvery: [2.6, 3.8], stallFor: [0.9, 1.4],
        yankR: 4.4,          // m: ✋ YANK HIM OUT
        maxT: 45,            // s — then he ditches it on the shoulder
        chance: 0.5,         // per check (each away window)
    },
    tip: { after: 240, chance: 0.35, every: [180, 300] },   // the payphone tip (Cruise): s of driving / odds / s between tries
    gear: {
        netStars: 4,         // stun nets from this many ★ (3★ in a heist getaway)
        netEvery: [9, 14],   // s between nets
        netRange: [9, 36],   // m: a cruiser this far from her can fire
        netFlight: 0.8,      // s in the air (zig-zag to dodge)
        netHit: 2.6,         // m: lands this close = netted
        netHold: 3.0,        // s netted
        netTop: 0.5,         // × her top speed while netted
        spikeStars: 4, spikeEvery: [22, 30], spikeAhead: [70, 90],
        flat: 9,             // s on the rims (streets' flat tyres when it's there)
    },
};

// ── lines ─────────────────────────────────────────────────────────────────
export const PROPS = [
    { id: "Banana", name: "a BANANA", says: ["Nobody move! This banana is LOADED!", "Hands up! …it's a banana. But STILL."] },
    { id: "WaterPistol", name: "a WATER PISTOL", says: ["Freeze or you get SPLASHED!", "I'm not afraid to get you DAMP!"] },
    { id: "Baguette", name: "a BAGUETTE", says: ["Zis is a stick-up! …of bread!", "One step closer and you get CARBS!"] },
    { id: "Confetti", name: "a CONFETTI BLASTER", says: ["Nobody move or it's a PARTY!", "Stay back! This thing is FESTIVE!"] },
];
export const ROBBER_NAMES = ["Benny the Bagel", "Two-Ton Tony", "Sticky Shloimy", "Dougie Donuts", "Vinnie Vanilla", "Moe the Mumbler"];
export const STORE_NAMES = { bank: "the bank", pizza: "the pizza shop", bakery: "the bakery", hall: "the wedding hall", store: "the Kosher Quik-Mart" };

export const ROBBERY = {
    banner: (where, prop) => `<b>🚨 ROBBERY AT ${where.toUpperCase()}!</b><small>a guy in stripes with ${prop} · stop the getaway car — ram it, PIT it or box it in</small>`,
    footBanner: (where) => `<b>🚨 ROBBERY AT ${where.toUpperCase()}!</b><small>✋ TACKLE him before he reaches the car!</small>`,
    lulu: ["Oh, NO you don't!", "Not in MY town!", "Somebody stop him! …fine, ME.", "Is that a BANANA?!", "Hold my kugel."],
    foiled: ["*hands up* OK OK! It's a BANANA, officer!", "I want my lawyer. And my mother.", "Curse you, pink convertible!", "This is the worst getaway of my career. It was my first."],
    cop: ["Nice driving, ma'am! We'll take it from here.", "Collar's ours. You're the hero of the day!", "Banana's evidence now. Thanks, Miss Bruck!"],
    escaped: "🚓 They got away… the cops have it from here.",
    hero: ["The whole block saw that. Ima's going to hear about it in nine minutes.", "Hero of the neighbourhood! Somebody get this woman a kugel.", "Caught a crook. In heels. Before lunch."],
};
export const SNATCH = {
    rider: "ZIPPY",
    warn: "<b>🛵 A MOPED'S CREEPING UP!</b><small>{honk} HONK or drive off — he's after your coins</small>",
    warnFoot: "<b>🛵 A MOPED'S CREEPING UP!</b><small>{interact} clutch your purse!</small>",
    creep: ["Nice purse, lady…", "Don't mind me…", "Whatcha got there?"],
    dodged: ["Not today, Zippy!", "Hands OFF, moped boy!", "My Bubbe taught me that one."],
    grab: (n) => `<b>🛵 SNATCHED! −${n} 💰</b><small>chase him down — clip the moped to get it back</small>`,
    caught: ["OW! My moped! My dignity!", "OK OK, take it back!", "Worst. Snatch. Ever."],
    lulu: ["GIVE THAT BACK!", "That's my GAS money!", "Oh you did NOT."],
    lost: (n) => `<b>🛵 He got away with ${n} 💰</b><small>(a cheap lesson — Ima will say she told you so)</small>`,
};
export const THEFT = {
    warn: "<b>🚨 SOMEONE'S AT YOUR CAR!</b><small>run back to it — quick!</small>",
    thief: ["Nice wheels… don't mind if I do.", "Ooh, pink. My color.", "Keys in it? Lucky me."],
    bolt: ["Yikes — she's BACK!", "I was just admiring it!"],
    gone: "<b>🚗 HE'S DRIVING OFF IN YOUR CAR!</b><small>run after it — it lurches, he can't work the clutch · ✋ YANK HIM OUT</small>",
    yank: ["OUT of my car!", "That's MY pink convertible!", "Bye-bye, bandit!"],
    thiefOut: ["OK! It stalls ANYWAY!", "Who drives a stick?!"],
    ditched: "<b>🚗 He ditched your car up the road</b><small>the radio was stuck on LULU FM — he couldn't take it. Walk on up, it's fine.</small>",
};
export const JOB = {
    tip: { from: "SHMULIK (A PAYPHONE)", emoji: "☎️", color: "#66BB6A",
        lines: ["Psst. It's Shmulik. From a payphone. Don't ask which one.", "The banks off the next exit? The guard naps 2:15 to 2:45. Every day.",
            "Walk in with something FESTIVE, walk out with the bags. Let it ring and the tip's yours."] },
    caseLines: ["The guard naps from 2:15 to 2:45. It says so ON THE SIGN.", "The vault's on a timer. The timer's a kitchen timer.", "The silent alarm is Bubbe's old hearing aid. It whistles.", "Teller window three: 'BACK IN 5 MIN.' Since 2009."],
    planAsk: "📝 Bank cased! Pull a cartoon heist? (totally optional — sirens, stars, the works)",
    nah: "😇 Nah — I'm a good girl",
    nahLine: ["Good. Ima would DIE.", "Just here for the lollipop. Honest."],
    onBanner: "<b>💰 THE JOB IS ON</b><small>get in a car and pull up out front of the bank</small>",
    cooldown: m => `The vault's timer says: come back in ${m} min. (one heist at a time, Lulu)`,
    oneRun: "One heist a run, Lulu. Bubbe's heart can't take two.",
    cut: [
        ["LULU", "This is a stick-up… of RUGELACH! Everybody stay calm and nobody touch the babka!"],
        ["TELLER", "Sweetie, the rugelach is for the CUSTOMERS. …fine, take the bags. Take a lollipop too."],
        ["GUARD", "*SNORT* …wha— is it 2:45? HEY! HEY! …I'm going back to sleep."],
        ["LULU", "*FOOMP* 🎉 Confetti everywhere! Thank you, have a nice day!"],
    ],
    go: "<b>🚨 GO GO GO!</b><small>lose the cops: break their line of sight, hide, take an exit, change your look</small>",
    paid: (n, stars) => `<b>😎 CLEAN GETAWAY! +${n} 💰</b><small>${stars}★ shaken · the warrant's on file now — lie low</small>`,
    busted: "<b>🚔 BUSTED WITH THE BAGS</b><small>the rugelach is evidence now</small>",
    failed: "<b>💸 The job's off</b><small>the bags went back to the bank</small>",
    lulu: ["Is this what Bubbe meant by 'make a withdrawal'?", "Act natural. ACT NATURAL.", "I am SO grounded."],
};
export const BANK = {
    lakewood: { name: "First Minivan Bank of Lakewood", emoji: "🏦", tagline: "drive-thru · 9 lanes · still a line" },
    midwood: { name: "Kings County Savings & Bagel", emoji: "🥯", tagline: "since 1931 · free lollipop · fuhgeddaboudit" },
};
export const TELLER = ["Next! …you're the only one in line? We'll still take a while.", "Deposit, withdrawal, or are you here for the lollipops? Everyone's here for the lollipops.",
    "Your balance is… *squints* …a number. Have a nice day!", "We close at 3. We stop caring at 2:30.", "The pen's on a chain. Don't ask what happened to the last pen.",
    "Would you like to open a savings account? It comes with a toaster. The toaster's been on back-order since 1998."];
export const TELLER_BK = ["Next! What, you need an engraved invitation?", "Bagel with your deposit? We got sesame, everything, and 'don't ask'.", "Lollipop's free. The pen is NOT. Put it back, sweetheart.",
    "Your account's fine. Your PARKING outside is not my problem.", "We been on Avenue J since '31. Ask my mother, she opened the first account."];
export const GUARD = ["Zzz… *snort* …two more minutes, Ma…", "Zzz… no… the vault… is shaped like… a kugel…", "*snore* …I'm awake. I'm guarding. Zzz…", "Zzz… don't… touch… the lollipops…"];
export const LINE = ["I've been in this line since Chanukah.", "Is that teller ALIVE? Blink twice.", "I'm only here for the lollipop.", "My cousin says the guard naps. Not my business.", "Do NOT cut the line. I have a cane and I will USE it.", "I'm depositing a check from my grandson. It's for $5. I'm SO proud."];
export const FOUNDER = ["'OUR FOUNDER, Mr. Hershel Gelt. He trusted no one. Not even the bank.'", "A portrait of the founder. His eyes follow your wallet."];
export const LOLLY = ["A free lollipop! Raspberry. This bank gets it.", "Lollipop acquired. Best transaction all week.", "Another lollipop? The jar says ONE. The jar is judgemental."];
export const VAULT_OK = "🔒 The vault. It hums. It might be the guard.";
