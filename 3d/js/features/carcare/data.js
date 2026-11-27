// features/carcare — every number + every line (tune here). Roadmap 43 (b): the Coney Island Ave row made real on ctx.cars.
// Sinks only, small prices (a played day earns ~500–650): nothing punishing — dirt and dents never stop a car working, a
// worn tire is just an all-season one again, the car never breaks down.
export const ID = "carcare";

export const PRICE = {
    wash: 8,            // 🧽 the Minivan Wash (both towns)
    dent: 25,           // 🔧 Bumper to Bumper: per dent level
    diy: 10,            // 🛠️ …or pop them out yourself (20 s, a plunger)
    sport: 60,          // 🛞 Tire-d of It
    rain: 50,
    all: 0,             //    (the all-season set back on: they kept them in the back)
    refit: 0.5,         //    the same set again once it's worn: half price
    loud: 30,           // 🔊 Coney Island Ave Muffler
    quiet: 30,
    stock: 0,
};

export const TUNE = {
    tick: 0.4,                  // s between looks (dirt, the car's dress, the attendants) — never per frame
    dirtKm: 40,                 // km of dry driving from clean to as dirty as it gets
    rainMul: 3,                 // × while the road is wet (ctx.atmos.wet)
    puddle: 0.03,               // a splash through a puddle
    dirty: 0.6,                 // from here it's "dirty": cops look a little sooner, Ima says something
    shineMin: 10,               // real minutes a fresh wash sparkles (no dirt while it does)
    minivanDirt: 0.45,          // Ima's minivan: always a bit dirty (never "dirty" enough for the cops)
    dentMax: 3,                 // dent levels (2 dents each)
    carNear: 35,                // m: her car has to be this close to the shop for them to work on it
    copLookDirty: 1.1,          // × how fast a cop's look lands on a dirty car (~10 % sooner)
    copLookQuiet: 0.85,         // × with a QUIET muffler at night (spotted ~15 % later)
    copHearLoud: 1.2,           // × how far they still hear her with a LOUD muffler
    popSpeed: 12,               // m/s: lifting off above this with a LOUD muffler → pops
    popGap: 1.4,                // s between pop bursts
    wearDays: 3,                // real days for a set of Sport / Rain tires to wear back to all-season
    staffNear: 45, staffFar: 60, // m: an attendant stands at the door while she's on foot this close
    diySec: 20,                 // the DIY dent game
};

/** Tires: grip (dry, wet) and top-speed multipliers, fresh. They fade toward 1 as the set wears (TUNE.wearDays). */
export const TIRES = {
    all:   { name: "All-season", emoji: "🛞", dry: 1.00, wet: 1.00, top: 1.00, desc: "The ones it came with. Fine. Fine is fine." },
    sport: { name: "Sport", emoji: "🏁", dry: 1.12, wet: 0.92, top: 1.00, desc: "More grip on a dry road — a little less in the rain. Wears in about 3 days." },
    rain:  { name: "Rain", emoji: "🌧️", dry: 1.00, wet: 1.18, top: 0.98, desc: "The best grip on a wet road. Top speed −2 %. Wears in about 3 days." },
};
export const MUFFLERS = {
    stock: { name: "Stock", emoji: "🔇", desc: "Normal. Quiet-ish. Nobody looks." },
    loud:  { name: "LOUD", emoji: "🔊", desc: "POP POP POP when she lifts off. Cops hear her 20 % farther away." },
    quiet: { name: "QUIET", emoji: "🤫", desc: "Whisper-quiet. At night the cops spot her about 15 % later." },
};

/** The fronts (by the name on their sign — storefronts' NAMED rows kept for us) → which shop it is. hours: storefronts' format. */
export const SHOPS = {
    "MIDWOOD MINIVAN WASH": { kind: "wash", emoji: "🧽", who: ["npcMan", "Hershel", { Top: "#0277BD", Bottom: "#263238" }], hours: "0-4 7-21; 5 7-14; 6 20-24" },
    "MINIVAN WASH": { kind: "wash", emoji: "🧽", who: ["npcWoman", "Gitty", { Top: "#00897B", Bottom: "#37474F" }], hours: "0-4 7-21; 5 7-14; 6 20-24" },
    "BUMPER TO BUMPER BODY SHOP": { kind: "body", emoji: "🔧", who: ["npcMan", "Big Mottel", { Top: "#455A64", Bottom: "#212121" }], hours: "0-4 7-19; 5 7-13" },
    "TIRE-D OF IT TIRES": { kind: "tires", emoji: "🛞", who: ["npcMan", "Yossi Tread", { Top: "#F9A825", Bottom: "#3E2723" }], hours: "0-4 7-20; 5 7-13" },
    "CONEY ISLAND AVE MUFFLER": { kind: "muffler", emoji: "🔊", who: ["npcMan", "Shaya", { Top: "#B71C1C", Bottom: "#212121" }], hours: "0-4 8-20; 5 8-13" },
    "24 HR GAS & GOSSIP": { kind: "gossip", emoji: "⛽", who: ["npcWoman", "Bracha", { Top: "#6A1B9A", Bottom: "#424242" }], hours: "0-6 0-24" },
};

export const L = {
    label: {
        wash: "🧽 {name} — WASH · {price} 💰", body: "🔧 {name} — DENTS", tires: "🛞 {name} — TIRES", muffler: "🔊 {name} — MUFFLERS",
        gossip: "☕ {name} — WHAT'S NEW?", closed: "🕐 {name}: CLOSED · {when}",
    },
    short: { wash: "WASH", body: "DENTS", tires: "TIRES", muffler: "MUFFLER", gossip: "GOSSIP" },
    title: { wash: "🧽 {name}", body: "🔧 {name}", tires: "🛞 {name}", muffler: "🔊 {name}" },
    noCar: [
        "Bring the car, honey. We wash cars, not ideas.",
        "Where's the car? …You walked here? To a CAR place?",
        "No car, no service. I don't make the rules. I make the foam.",
    ],
    minivan: [
        "Ima's minivan? Nobody touches Ima's minivan. The dirt is load-bearing.",
        "That's your mother's van. There's a system in there. We don't disturb the system.",
    ],
    notHers: "That's not your car, Lulu. We only work on cars with a nice owner. You're nice. It's not yours.",
    // the wash
    washHead: "Your {name}: {state}.",
    dirtState: ["sparkling ✨", "clean", "a little dusty", "dirty", "VERY dirty — someone wrote CLEAN ME on it"],
    washTile: "Full wash", washDesc: "Soap, brushes, a towel, a little air freshener shaped like a pickle. It sparkles for 10 minutes.",
    washed: ["✨ Sparkling! Hershel says it's the cleanest car on the avenue. He says that to everyone. He means it every time.",
        "✨ Clean! They found two Cheerios, a pacifier and a parking ticket from 2019. You can have the pacifier.",
        "✨ Shiny! The foam got everywhere. The car is clean. Hershel is not."],
    alreadyClean: "It's already sparkling. Any cleaner and it'll be see-through.",
    // the body shop
    bodyHead: "Your {name}: {state}.",
    dentState: ["not a scratch", "one little dent", "a few dents", "it looks like it lost an argument with a shopping cart"],
    fixTile: "Fix one dent", fixAllTile: "Fix them all", diyTile: "Pop them yourself",
    fixDesc: "Big Mottel taps it out. {price} 💰 a dent.",
    diyDesc: "A plunger and 20 seconds. Press when the arrow's in the green. Whatever you pop is popped.",
    fixed: ["🔧 Good as new. Better. Big Mottel signed the bumper. Don't tell anyone.", "🔧 Fixed! He hit it with a hammer once and the dent just… left. Respect."],
    noDents: "No dents. Come back after Ocean Parkway.",
    diyStart: "🪠 Pop the dents! Press ✋ when the arrow is in the green.",
    diyPop: ["POP!", "THUNK!", "boing", "POP! (nice)"],
    diyMiss: ["…nothing.", "the plunger slipped", "the car felt that"],
    diyDone: "🪠 You popped {n}! Big Mottel nods slowly. 'You have the hands.'",
    diyNone: "🪠 Nothing popped. Big Mottel says the plunger was upside down. It wasn't. He's being kind.",
    // the tires
    tireHead: "On your {name}: <b>{tire}</b>{wear}.",
    tireWear: " · {pct} % tread left", tireWorn: " · worn down to all-season grip — a new set is half price",
    tireDone: ["🛞 New {tire} tires! Yossi kicks one. 'Good tire.' He kicks all of them. He loves them.", "🛞 {tire} tires on. Yossi says to drive careful for the first ten minutes. Why? 'Tradition.'"],
    // the mufflers
    mufHead: "On your {name}: <b>{muf}</b>.",
    mufDone: { loud: "🔊 LOUD muffler on! Shaya revs it. A car alarm across the street goes off. Shaya is so proud.",
        quiet: "🤫 QUIET muffler on. Shaya revs it. Nothing. He checks it's on. It's on. Spooky.",
        stock: "🔇 Back to stock. Shaya looks sad. He'll keep the loud one 'for a friend'." },
    // the gas station (the pump is ci/fuel's)
    gossipHi: ["Bracha leans out of the window.", "Bracha lowers her magazine.", "Bracha puts down her phone. This is important."],
    gossipNone: "Nothing today. NOTHING. Do you know how hard that is for me?",
    gossipSame: "That's today's. Come back next hour, I'll have more. I always have more.",
    // Ima, at the door, when the car's dirty (once a real day)
    ima: ["Your car is filthy. The Minivan Wash is 8 coins. I'm just saying. I'm saying it.",
        "Mrs. Feldman asked me if you drove through a farm. Lulu. WASH THE CAR.",
        "Somebody wrote 'WASH ME' on your car. It's my handwriting. Wash it."],
    // the 📱 Map
    pin: { wash: "car wash", body: "body shop", tires: "tires", muffler: "mufflers", gossip: "24-hour gas · gossip" },
};

/** Gossip: one TRUE thing about today (new each real hour) — the line for each kind of fact. */
export const GOSSIP = {
    protest: "There's a protest in {town} today ({hours}). {about} Bring a sign. Or a snack.",
    edict: "Did you hear? The mayor's new thing: {title}. {about}",
    wedding: "Big wedding at the Avenue M Ballroom tonight, from 6. Avigail's going to be impossible. Bouquet's up for grabs.",
    weddingNow: "There's a wedding at the Avenue M Ballroom RIGHT NOW. I can hear the band from here. Go, go!",
    wrong: "Around lunchtime there's a whole crowd picketing the wrong shop again. The flyer had the wrong address. It always has the wrong address.",
    comment: "Public comment night at Lakewood City Hall tonight. Somebody's going to talk about the pothole for forty minutes. Bring popcorn.",
    late: "{shop} is open till {till} tonight. I know. I was surprised too.",
    pkwy: "The speed camera on Ocean Parkway is still there. 25 limit, it flashes over 35. Mrs. Klein got three. In one day.",
    school: "School's in — the cameras by {school} flash over 25. Slow down there, honey.",
    shabbosSoon: "Shabbos is coming in. Everything's closing. Get your challah NOW.",
};
