// features/roadevents — tuning + every line of dialogue, ported from the 2D
// game (src/01b-spawn-tuning.js SPAWN_CONFIG, src/04-parking-logic.js spawners,
// src/05-driving-loop.js updatePlaying). 2D pixels → metres at ≈11.7 px per m.

// ── Spawn tuning (EDIT ME) ─────────────────────────────────────────────────
// Same table, timings and chances as the 2D game's SPAWN_CONFIG.
//   first:  [min,max] seconds before the event can FIRST appear in a run
//   every:  [min,max] seconds between attempts after that
//   chance: 0..1 probability an attempt actually spawns
// Entries marked (other feature) belong to cameos / law / journey / parking —
// they can share these timers through ctx.roadevents.tickSpawn(name, dt).
export const SPAWN_CONFIG = {
    pedestrian:  { first: [12, 30],  every: [20, 38],   chance: 0.70 }, // 🚶 walkers → passenger coin bonus
    parkingSign: { first: [25, 75],  every: [55, 100],  chance: 0.00 }, // 🅿 DISABLED in 2D too (parking = pull-over)
    iceCream:    { first: [30, 85],  every: [65, 115],  chance: 0.50 }, // 🍦 ice-cream stand bonus
    avigail:     { first: [40, 110], every: [110, 190], chance: 0.40 }, // (cameos) Avigail porch visit
    avigailCar:  { first: [30, 70],  every: [55, 110],  chance: 0.50 }, // (cameos) Avigail out driving
    salon:       { first: [30, 85],  every: [65, 115],  chance: 0.45 }, // (cameos) salon
    sasquatch:   { first: [40, 100], every: [75, 150],  chance: 0.35 }, // (cameos) sasquatch
    copHide:     { first: [22, 60],  every: [35, 75],   chance: 0.55 }, // (law) hidden speed-trap cop
    heshyPool:   { first: [25, 70],  every: [40, 80],   chance: 0.50 }, // (cameos) Heshy's pool
    heart:       { first: [15, 35],  every: [20, 40],   chance: 0.60 }, // ❤️ extra-life pickup (core has hearts too)
    toll:        { first: [45, 90],  every: [60, 120],  chance: 0.55 }, // 🎫 toll-booth gauntlet
    train:       { first: [55, 110], every: [70, 140],  chance: 0.55 }, // 🚂 railroad crossing
    driveThru:   { first: [35, 80],  every: [55, 110],  chance: 0.55 }, // 🍔 drive-thru bonus
    parade:      { first: [60, 120], every: [90, 170],  chance: 0.45 }, // 🎉 parade / marathon crowd
    uncle:       { first: [35, 90],  every: [80, 150],  chance: 0.40 }, // (cameos) Uncle sighting
    imaCall:     { first: [45, 110], every: [110, 200], chance: 0.45 }, // (journey) Ima calls
};
// The events this feature spawns from the table (the rest are shared timers only).
export const OWN_SPAWNS = ["pedestrian", "iceCream", "toll", "train", "driveThru", "parade"];

// Minimum run time (s) before each event (2D `gameTime > N` guards).
export const MIN_TIME = { pedestrian: 15, iceCream: 30, toll: 25, train: 30, driveThru: 20, parade: 30 };

// The 2D game's other cadences ("spawnClocks" and per-second odds).
export const RATES = {
    cone:        [2.5, 5],      // s between stray cones (× speed factor)
    puddle:      [4, 8],        // s between puddles
    animal:      [8, 14],       // s between animal crossings (from 30 s; ostrich after 60 s)
    duckParade:  0.15,          // chance the animal is a duck parade (after 45 s)
    hitch:       [28, 60],      // s between hitchhikers (from 20 s)
    iceTruck:    0.012,         // per second (×4 near schools / markets), from 18 s
    busStop:     0.012,         // per second (school zone 0.10), from 25 s
    guard:       0.011,         // per second (school zone 0.09), from 25 s
    schoolBus:   0.02,          // per second (school zone 0.22), from 15 s
    convoy:      0.012,         // per second (school zone 0.05), from 40 s
    ambulance:   0.004,         // per second outside the hospital zone (hospital: 0.5)
    crash:       [7, 16],       // s before the first fender bender (then 10–22)
    dozerNpc:    0.05,          // chance per check of a steamroller trundling by (construction: 0.5)
    fuel:        0.7,           // per second in the gas zone (max 2 cans)
    malfunction: 0.03,          // share of new cars that act up (one at a time)
};

// Payouts (2D numbers).
export const PAY = {
    passengerSecs: 30,          // 2× coins while someone rides along
    maxPassengers: 4,
    hitch: 15,
    iceCreamSign: 5,
    iceTruck: [12, 25],         // coins; score × 4
    driveThru: [20, 45],        // coins; score × 4
    toll: 60,                   // score
    tollCrash: 1,               // hearts
    busStopDina: 60,            // coins (+300 score)
    safeStop: 40,               // score
    crushScore: 60, crushCoins: 3,
    dozerSecs: 13,              // diesel
    nitroSecs: 3.5, nitroMax: 9,
    courageSecs: 20,
    trainWait: 100,             // 3D extra: patient at the gate
    duckWait: 150,              // 3D extra: let the ducklings cross
};

// The steamroller is SLOW (2D DOZER_SPEED 235 px/s ≈ 20 m/s).
export const DOZER_TOP = 20;

// Road zones (2D ZONE_* — the road-event side of them): every ~940 m of
// country road (11000 px ± (−3000, +5000)) a themed stretch of 600–940 m.
export const ZONE_GAP = [11000 / 11.7 - 256, 11000 / 11.7 + 427];
export const ZONE_LEN = [7000 / 11.7, 11000 / 11.7];
export const ZONES = ["construction", "school", "gas", "market", "bars", "downtown", "hospital"];
export const ZONE_WEIGHT = { bars: 2 };
export const ZONE_NAMES = {
    bars: "Bar District 🍸", school: "School Zone 🏫", downtown: "Downtown 🏙️", hospital: "Hospital 🏥",
    construction: "Construction 🚧", gas: "Gas Station ⛽", market: "Farmers Market 🧺",
};
export const ZONE_SIGNS = {
    construction: { lines: ["ROAD WORK", "AHEAD"], bg: "#FF8F00", fg: "#111111" },
    school: { lines: ["SCHOOL ZONE", "SLOW DOWN"], bg: "#C6FF00", fg: "#111111" },
    gas: { lines: ["GAS · FOOD", "NEXT EXIT"], bg: "#1565C0" },
    market: { lines: ["FARMERS", "MARKET ➜"], bg: "#2E7D32" },
    bars: { lines: ["BAR DISTRICT", "DRIVE SOBER!"], bg: "#6A1B9A" },
    downtown: { lines: ["DOWNTOWN", "LAKEWOOD"], bg: "#1f7a46" },
    hospital: { lines: ["HOSPITAL", "QUIET ZONE ⛑"], bg: "#1565C0" },
};

// ── lines (2D, verbatim) ───────────────────────────────────────────────────
export const KO_NAMES = ["Shua", "Esti", "Random British guy", "Leah"];
export const KO_LINES = [" was knocked down!", " went flying!", " ate dirt!", " got bonked!", " did a backflip!"];
export const HITCH_LINES = ["Bubbe's, please! 🙏", "You're a MENSCH!", "Thanks, doll!", "I owe you a kugel!",
    "FINALLY someone stopped!", "To the wedding — STEP ON IT!", "Gut Shabbos, lifesaver!"];
export const HONK_REACT = ["Okay okay!", "Geez!", "Rude!", "I'm MOVING!", "Alright!!", "Easy!", "Pushy!"];
export const DRUNK_QUIPS = ["WOOO!", "*hic* sorry!", "I'm FINE to drive!", "Is it Purim?!",
    "Who moved the road?", "One more lechaim!", "Whose lane is this??", "I see TWO Lulus!",
    "The road is WAVY!", "I'm not drunk, YOU are!", "Designated... nah.", "Wheee, bumper cars!",
    "Which pedal stops?", "Shhh, don't tell Ima.", "I drive BETTER like this!", "*burp* 'scuse me",
    "Is this Mario Kart?", "Left is the new right!", "Lanes are a suggestion!", "I LOVE everybody!",
    "Was that a stop sign?", "Catch me if you can, ociffer!", "My car, my rules!", "Spinny spinny!",
    "I only had... eleven.", "Honk if you love cholent!", "The lines keep MOVING!", "Weee-ooo weee-ooo... no cops right?"];
export const RUDE_QUIPS = ["LEARN TO DRIVE!", "MY LANE!!", "Signal much?!", "Drive like my BUBBE!",
    "Off the road!", "MOVE IT!", "Watch it, lady!", "Oy, this DRIVER..."];
export const DODGE_QUIPS = ["WHOA!", "Yikes!", "Careful!!", "Hey now!", "Meshugga!"];
export const RAGE_QUIPS = ["MOVE IT!!", "I'm LATE!", "OUTTA MY WAY!", "GO GO GO!",
    "Some of us WORK!", "LEARN TO DRIVE!", "TODAY, people!!"];
export const BUS_QUIPS = ["Kids on board!", "Slow it down!", "Beep beep!", "Mind the children!", "No passing!"];
export const BUS_STOP_QUIPS = ["STOP for the bus!", "Kids crossing!!", "You BLEW my sign!", "Where's the FIRE?!", "Report that plate!"];
export const COP_BUS_SNARK = ["Ran a bus sign, huh?", "Cute. PULL OVER.", "Kids were CROSSING!", "That's a big ticket."];
export const GUARD_QUIPS = ["SLOW DOWN!", "Kids crossing!!", "Eyes UP, driver!", "STOP means STOP!", "Not on MY watch!"];
export const BAR_CATCALLS = ["Heyyy gorgeous! 🍻", "Niiice ride, sweetheart!", "Gimme a liiift?",
    "You're SO pretty!", "Marry me, Lulu! 💍", "*wolf whistle*", "Hubba hubba!",
    "Lookin' GOOD!", "Call me! ...somehow", "Is it hot or is it you?",
    "*hiccup* hellooo!", "Drive me home, cutie?", "My NUMBER is— *burp*",
    "Smile for me, doll!", "Best car in TOWN! 🚗", "Are you an angel? 😇",
    "Pull OVER, beautiful!", "I LOVE you, Lulu!! 💕"];
export const CAR_ARGUE = ["YOU were TEXTING!", "Look at my BUMPER!!", "I had the RIGHT of way!",
    "You came outta NOWHERE!", "My cousin's a LAWYER!", "Watch where you're GOING!",
    "This is a LEASE!", "You owe me a FENDER!", "I just WAXED this!", "Call your INSURANCE!",
    "Were you even LOOKING?!", "Unbelievable!", "My BACK! ...actually it's fine.",
    "Off the road, BOTH of you!", "I'm filming this!", "Says the guy in REVERSE!"];
export const DRAMA_COP_LINES = ["🚓 BREAK IT UP!", "🚓 Move it ALONG!", "🚓 Who called this in?",
    "🚓 Licenses. Both of ya.", "🚓 Nobody's hurt? GO.", "🚓 Off the road, folks!"];
export const CRASH_FLOATERS = ["💥 FENDER BENDER!", "💥 CRUNCH!", "💥 OOF!", "💥 SMASH!"];
export const CRUSH_LINES = ["SPLAT! 💀", "FLATTENED!", "PANCAKED! 🥞", "CRUNCH! 💀"];
export const DUCK_SAYS = ["Excuse me!", "*quack quack*", "We have right of way!", "Have a blessed day."];
export const BILLBOARDS = ["SLOW DOWN, LULU!", "FREE PICKLES NEXT EXIT", "OSTRICH CROSSING 500ft", "DRIVE LIKE GRANDMA",
    "HONK IF U LOVE COINS", "ICE CREAM AHEAD", "CAUTION: KIDS w/ FORKS", "WANTED: ANGRY OLD MAN", "LULU.BOATS",
    "RACCOON YARD SALE TODAY", "WASH YOUR CAR. NOW.", "BEWARE OF SASQUATCH", "NURSE OF THE YEAR: T. BRUCK",
    "TAMMY SAYS: BUCKLE UP!", "ER VISITS DOWN 0%. THX LULU"];

// 3D-only flavour (in the same voice)
export const TOLL_LINES = ["Exact change, hon!", "Have a blessed drive!", "E-ZPass? Never heard of her.", "Drive safe, mamele!", "That'll be a smile. 😊"];
export const TOLL_CRASH = ["You were supposed to PAY!", "MY GATE!!", "That's coming out of your deposit!", "Oy, the PAPERWORK…"];
export const SERVER_LINES = ["Enjoy, hon! 🍔", "Extra pickles, like always!", "Fries are on the house!", "Come back soon, Lulu!"];
export const SCOOP_LINES = ["One scoop or SIX?", "Sprinkles on the house! 🍦", "For the birthday girl!", "Brain freeze special!"];
export const ENGINEER_LINES = ["Thanks for waiting! 🚂", "CHOO CHOO!", "Next stop: Bubbe's!", "Toot toot, Lulu!"];
export const ANIMAL_HIT = {
    duck: ["Lulu vs. a duck: the duck called a lawyer", "QUACK! (that's duck for 'sue')"],
    raccoon: ["The raccoon had RIGHT of way!", "Lulu vs. a raccoon: it was a draw"],
    ostrich: ["An OSTRICH?! On the parkway?!", "Lulu vs. an ostrich: the ostrich won"],
};
export const ANIMAL_HONK = ["*bolts*", "!!!", "*scurries*", "Sheesh!"];
export const PARADE_KINDS = {
    parade: { title: "🎉 PARADE! Mind the crowd!", banner: "🎉 LAKEWOOD PARADE 🎉", back: "HAPPY PARADE DAY!" },
    marathon: { title: "🏃 MARATHON! Mind the runners!", banner: "🏃 LAKEWOOD MARATHON 🏃", back: "GO RUNNERS GO!" },
};
export const PARADE_CHEERS = ["WOOO!", "Mazel tov!", "Go go GO!", "Looking good!", "🎉🎉🎉", "Kol hakavod!"];
export const COURAGE_DONE = "🍺 courage wore off";
