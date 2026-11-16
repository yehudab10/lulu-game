// features/hustle — every line of text, the payouts and the tuning knobs.
//
// Tone: PG-13 cartoon crime comedy in the GTA-satire spirit — sarcastic,
// warm, Jewish-family. Nobody gets hurt, nobody dies; the "crime" is a
// bingo hall "refund" and the worst injury is to Gertie the chicken's pride.

export const ID = "hustle";

// ── tuning ────────────────────────────────────────────────────────────────
export const TUNE = {
    firstOffer: [24, 38],     // s of Cruise driving before the first job shows up
    nextOffer: [55, 95],      // s between offers (after a job, or a missed marker)
    phoneChance: 0.35,        // an offer is a phone call (else a roadside marker)
    markerAhead: 720,         // m ahead a marker is placed (≥ 700: before its chunk is built, so reserve() works)
    markerD: 8.1,             // the glowing pad, on the right shoulder
    propD: 11.2,              // the payphone / job board, just past the shoulder
    padR: 3.1,                // drive within this of the pad's centre to take the job
    stopSpeed: 7.5,           // m/s (≈ 17 mph): slow enough to pick up / drop off
    stopR: 10,                // m from a pickup / drop-off beacon
    setAhead: 720,            // the bingo hall / the safehouse, placed this far ahead
    cabFares: 3,              // fares in a shift
};

export const PAY = {
    fare: [26, 40],           // base per cab fare
    secTip: 1,                // tip per second left on the meter
    nearMiss: 3, jump: 5, crash: -6,
    streak: 12,               // ×n per fare in an on-time streak
    getaway: [230, 300],      // Lulu's cut before lost bags
    bagLost: 0.22,            // each bag that bounces out costs this much of the cut
    heatBonus: 25,            // per ★ of heat shaken off
    delivery: [70, 105],      // base delivery pay (× heat × what's left in the pot)
    deliveryTip: 2,           // per second early
};

// colours (beacons, chips)
export const COLOR = { cab: "#FFC107", getaway: "#66BB6A", delivery: "#FF7043", marker: "#4FC3F7" };

// ── jobs ──────────────────────────────────────────────────────────────────
export const JOBS = {
    cab: { id: "cab", emoji: "🚕", name: "LULU CAB", color: COLOR.cab, from: "DVORAH (dispatch)", fromEmoji: "📟",
        blurb: "Pick up fares, get them there fast. Tips for speed, near misses and air — not for crashes." },
    getaway: { id: "getaway", emoji: "💰", name: "THE GETAWAY", color: COLOR.getaway, from: "UNCLE MOISHE", fromEmoji: "🕶️",
        blurb: "Uncle's crew needs a driver. Pick them up at the bingo hall, lose the cops, reach the safehouse." },
    delivery: { id: "delivery", emoji: "🔥", name: "HOT DELIVERY", color: COLOR.delivery, from: "THE HELP WANTED BOARD", fromEmoji: "📋",
        blurb: "Get the food there HOT. Bumps, potholes and jumps spill it — the customer reviews you." },
};

// ── 🚕 LULU CAB: the fares ────────────────────────────────────────────────
// kind: rush (tight meter, loves speed) · smooth (hates bumps & air) · stunts (tips for content) ·
//       careful (tips for staying under the limit) · follow ("follow that car!")
export const FARES = [
    { id: "groom", name: "Mendel", who: "late for his own wedding", emoji: "🤵", model: "hustle_groom", kind: "rush", time: 0.82,
        dest: "the chuppah at Ateres Chaya Hall",
        lines: {
            board: ["GO GO GO! The kallah is going to KILL me!", "I'm late for my own wedding. Don't ask. DRIVE."],
            fast: ["YES! Faster! I can hear the band warming up!", "Is this nitro? Mazel tov to ME!"],
            slow: ["Why are we going the speed of a shidduch?", "My mother-in-law is STANDING. She never stands."],
            nearMiss: ["I saw my whole life flash by. It was mostly the wedding.", "Close! Like my chances of making it!"],
            jump: ["Were we just AIRBORNE?! Don't tell the rabbi!", "That's one way to break the glass!"],
            crash: ["The suit is RENTED, Lulu!", "Oy — where's my kippah?! …found it."],
            late: ["She's walking down the aisle WITHOUT me!", "Tell them to stall! Start the Electric Slide!"],
            arrive: ["I MADE IT! You're invited! Table nine!", "Mazel tov to me! Here — for the gas!"],
            lateArrive: ["They started the hora without me… it's FINE.", "I made it for dessert. That counts."],
        } },
    { id: "chicken", name: "Shmuel & Gertie", who: "and his emotional-support chicken", emoji: "🐔", model: "hustle_chickenguy", prop: "chicken", kind: "smooth", time: 1.05,
        dest: "the county fair",
        lines: {
            board: ["Easy on the turns — Gertie gets carsick.", "Gertie's an emotional-support chicken. She's VERY supportive."],
            smooth: ["Gertie's purring. Do chickens purr? She's doing something.", "Smooth. Gertie gives you five stars. …Four. She's a tough critic."],
            nearMiss: ["BAWK! — that was me, not Gertie.", "Gertie's feathers just went white. Whiter."],
            jump: ["CHICKENS CAN'T FLY, LULU!", "Gertie just laid an egg. In your car. Congratulations."],
            crash: ["Feathers EVERYWHERE! You owe Gertie an apology!", "She's fine. She's fine! …she's judging you."],
            fast: ["Gertie's comb is blowing in the wind. She loves it.", "Not so fast — she's got a bad wing!"],
            late: ["Gertie's going to miss her heat! Of the fair! The poultry heat!", "Hurry! First prize is a ribbon AND a coupon!"],
            arrive: ["Gertie says thank you. Bawk.", "We'll ride with you again. Gertie insists."],
            lateArrive: ["We missed the judging. Gertie says it's rigged anyway.", "Late, but Gertie forgives you. I don't."],
        } },
    { id: "influencer", name: "@LuxeLeah", who: "is filming EVERYTHING", emoji: "🤳", model: "hustle_influencer", prop: "selfie", kind: "stunts", time: 1.0,
        dest: "a brunch she'll post about for a week",
        lines: {
            board: ["Hi besties! I'm in a CAB! Say hi, cab lady!", "Okay, you have like eleven seconds to be interesting. Go."],
            nearMiss: ["OMG do that again, I wasn't recording!", "That's CONTENT, babe!"],
            jump: ["WE'RE GOING VIRAL!!", "Airborne! Use code LULU for 10% off!"],
            slow: ["Chat says this is boring. Chat is RIGHT.", "Ugh, I'm losing followers. Do something!"],
            crash: ["Wait, do that again — my angle was bad.", "Is my hair okay? The car's fine, I meant my hair."],
            fast: ["Speed run! Like and subscribe!", "My ring light is SCREAMING."],
            late: ["The brunch has started without my content!", "If I'm late, the avocado toast gets cold, and that's on YOU."],
            arrive: ["Like, comment, and subscribe to Lulu!", "Tagging you! You're welcome for the exposure."],
            lateArrive: ["Late is a vibe. A bad vibe, but a vibe.", "I'll just say the traffic was 'iconic'."],
        } },
    { id: "instructor", name: "Mr. Katz", who: "retired driving instructor", emoji: "📋", model: "hustle_instructor", kind: "careful", time: 1.15,
        dest: "his 41st retirement party",
        lines: {
            board: ["Ten and two, young lady. TEN. AND. TWO.", "I taught driving for 41 years. I've seen everything. Twice."],
            fast: ["Is that the speedometer or your blood pressure?", "SLOW DOWN. I'm too old to be early."],
            nearMiss: ["Mirror, signal, SCREAM.", "That's a fail. I'm failing you. Retroactively."],
            careful: ["Hm. Acceptable. Don't let it go to your head.", "Good lane discipline. Who taught you? …Not me, clearly."],
            jump: ["THAT IS NOT IN THE MANUAL!", "I'm writing this down. In red ink."],
            crash: ["Points off! So many points off!", "Back in my day we used the brakes. Recreationally."],
            slow: ["Good. Good. Nobody ever died of the speed limit.", "This is the perfect speed. Write that down."],
            late: ["Late is better than never. Never is also fine, frankly.", "The party starts without me every year. Tradition."],
            arrive: ["A C-minus. Here's a tip: signal more.", "You passed. Barely. Buy a manual."],
            lateArrive: ["Punctuality is a virtue. You have others. Somewhere.", "Late. But alive. I'll allow it."],
        } },
    { id: "detective", name: "Mrs. Feldman, P.I.", who: "says FOLLOW THAT CAR!", emoji: "🕵️‍♀️", model: "hustle_detective", kind: "follow", time: 1.0,
        dest: "wherever HE is going",
        lines: {
            board: ["FOLLOW THAT CAR! The blue one! My husband says he's 'at the gym'!", "Follow that car — and be discreet. Discreet means NOT pink. Too late."],
            close: ["Not so close! He'll see us! …he's singing. Badly.", "Stay back, stay back… okay, TOO back."],
            far: ["We're losing him! Floor it!", "He's getting away! Twenty-eight years of marriage and THIS is how I find out?"],
            nearMiss: ["Ooh, very cinematic. Keep going.", "I've always wanted to say 'step on it'! STEP ON IT!"],
            jump: ["We're tailing him, not jumping him!", "Very subtle, flying the car. VERY subtle."],
            crash: ["Subtle, Lulu. Very subtle.", "That's coming out of the investigation budget."],
            reveal: ["He's going into… a POTTERY class?! He's making me a VASE! Oh, Barry…", "A cooking class! He's learning to make my mother's kugel! I'm crying!"],
            arrive: ["Case closed. You're a natural, kid.", "Here — and if anyone asks, we were never here."],
            lateArrive: ["Case closed. Eventually.", "We lost him twice and found him at a cooking class. Good enough."],
        } },
];

export const CAB = {
    pickupLine: f => `Pick up ${f.name}`,
    toLine: f => f.kind === "follow" ? "Follow that car!" : `${f.name} → ${f.dest}`,
    missed: ["Hey! HEY! I was WAVING!", "You drove right PAST me!", "Cab! CAB! …unbelievable."],
    dispatch: [
        "Fare up ahead — make it snappy, the meter's running.",
        "Got a live one for you. Literally — he's got a chicken.",
        "Next fare's waving on the shoulder. Try not to run them over.",
        "Five stars or no tips, Lulu. That's the business.",
    ],
    next: ["📟 Next fare up ahead!", "📟 Dispatch: another one, hon!", "📟 Meter's still running — next fare!"],
    walkOff: ["I'll WALK!", "This is taking forever. Bye!", "Let me out at the light. Any light!"],
};

// ── 💰 THE GETAWAY ────────────────────────────────────────────────────────
export const CREW = [
    { name: "Big Yossi", colors: { Top: "#455A64", Hat: "#212121" } },
    { name: "Little Yossi", colors: { Top: "#6D4C41", Hat: "#B71C1C" } },
    { name: "Pinchas the Accountant", colors: { Top: "#4A148C", Hat: "#1A237E" } },
];
export const GETAWAY = {
    call: ["Lululeh! Your favourite uncle. Listen — a little business opportunity.",
        "The LUCKY 7 bingo hall owes the boys a 'refund'. Long story. Totally legit.",
        "Just drive. Don't ask. You never ask — that's why you're my favourite."],
    payphone: "Payphone! It's Uncle Moishe: \"Bingo hall, up the road. Bring the convertible. Don't tell your mother.\"",
    toHall: "Drive to the LUCKY 7 BINGO HALL",
    exit: [
        ["BIG YOSSI", "GO GO GO! …wait, I dropped a bag. Okay GO!"],
        ["LITTLE YOSSI", "I won bingo twice on the way out. Is that bad?"],
        ["PINCHAS", "Technically this is a withdrawal."],
        ["BIG YOSSI", "I told them we were from the IRS!"],
    ],
    chase: [
        "Lose 'em, Lulu! I can't go back to jail, I just bought a new couch!",
        "Turn left! No — your OTHER left!",
        "Little Yossi is eating the bingo dabbers again!",
        "Is it too late to say we were kidding?",
        "Pinchas, stop counting the money! …okay, how much?",
        "Faster! The church ladies are chasing us too!",
    ],
    escaped: ["We're clean! …Pinchas, put the dabber down.", "Ha! Amateurs. Okay, the safehouse — it's a 'storage unit'."],
    bagLost: ["A BAG FELL OUT! It's raining bingo money!", "There goes Little Yossi's share!", "Leave it! LEAVE IT! …okay, it's gone."],
    toSafe: "Get to the safehouse (a 'storage unit')",
    loseCops: "Lose the cops!",
    noCopsYet: "Shake the heat before the safehouse!",
    arrive: ["Here's your cut. Don't tell your mother.", "Pleasure doing business. This conversation never happened."],
    pass: [["UNCLE MOISHE", "If anyone asks, you were at Bubbe's."], ["BIG YOSSI", "Same time next week?"], ["PINCHAS", "I filed it under 'charitable giving'."]],
    busted: [["UNCLE MOISHE", "Officer, I've never seen this girl in my life."], ["THE CREW", "We'll WRITE! …we don't know how to write."]],
    wrecked: [["BIG YOSSI", "The bags burst! It's raining bingo cards! SCATTER!"]],
    quit: [["UNCLE MOISHE", "You're out? Fine. More for me. …Love you, call your mother."]],
};

// ── 🔥 HOT DELIVERY ───────────────────────────────────────────────────────
export const FOODS = [
    { id: "cholent", name: "Bubbe's cholent", emoji: "🍲", to: "the Goldbergs' kiddush", who: "MRS. GOLDBERG", spill: 1.0, cool: 1.0,
        board: "HELP WANTED: deliver a cholent. Must own car. Must NOT eat the cholent." },
    { id: "kugel", name: "a potato kugel", emoji: "🥔", to: "Aunt Raizy's book club", who: "AUNT RAIZY", spill: 1.25, cool: 0.9,
        board: "HELP WANTED: kugel courier. The kugel is fragile. Emotionally." },
    { id: "pizza", name: "an extra-large pie", emoji: "🍕", to: "the Shapiros' bar mitzvah afterparty", who: "THE SHAPIROS", spill: 0.75, cool: 1.25,
        board: "HELP WANTED: pizza delivery, 30 minutes or it's FREE (it's free from YOUR pay)." },
];
export const REVIEWS = {
    5: ["\"Hot, whole and on time. Lulu, you're a MIRACLE.\"", "\"Five stars. I'd give six, but my son-in-law says that's 'not how stars work'.\""],
    4: ["\"A little sloshed — like my husband at the kiddush. Still delicious.\"", "\"Very good. Points off for the tire smell.\""],
    3: ["\"It arrived. That's the nicest thing I can say.\"", "\"Lukewarm. Like my feelings about your driving.\""],
    2: ["\"Half a pot. Like half a mitzvah. Doesn't count.\"", "\"Was this delivered by car or by catapult?\""],
    1: ["\"The pot was nearly empty but the car smelled AMAZING.\"", "\"I'm telling your Bubbe.\""],
};
export const DELIVERY = {
    toLine: f => `${f.name} → ${f.to}`,
    spillHit: ["💦 SPLOSH!", "💦 Some of it's on the dashboard now", "💦 That one's going to stain"],
    cold: ["\"Cold? On SHABBOS? I'm calling your mother.\"", "\"It's colder than my sister-in-law.\""],
    spilled: ["\"You brought me a pot. An EMPTY pot. Is this art?\"", "\"Where's the food? Why is your seat so delicious-looking?\""],
    handOff: ["Here it is — still hot!", "Delivery! Watch the lid, it's… emotional."],
};

// ── result screens ────────────────────────────────────────────────────────
export const RESULT = {
    pass: "💼 JOB DONE!",
    fail: "❌ JOB FAILED",
    chutzpah: "😎 CHUTZPAH +1",
    quitToast: "💼 Job abandoned — the meter's off.",
};

// ── phone offers (ctx.phone.call) ─────────────────────────────────────────
export const OFFERS = {
    cab: { from: "DVORAH · LULU CAB", emoji: "📟", color: "#FFC107",
        lines: ["Dvorah from dispatch, hon. I got fares stacking up like plates at a kiddush.", "Three rides, cash tips, and NO, you can't play your music. Fine, you can.", "You in? Just let it ring and I'll put you on the board."] },
    getaway: { from: "UNCLE MOISHE", emoji: "🕶️", color: "#66BB6A", lines: GETAWAY.call },
};

// ── 📻 THE RADIO ──────────────────────────────────────────────────────────
// Every track is one the game already ships (repo root mp3s) — no new audio.
export const SONGS = {
    "../wedding.mp3": "'Siman Tov (Turbo Hora Mix)' — The Lakewood Five",
    "../story-electric.mp3": "'Neon Shabbos' — DJ Kugel",
    "../luludriving.mp3": "'Gas Money' — Lulu & the Left Lane",
    "../story-relax.mp3": "'Kugel for Two' — The Velvet Lokshen",
    "../story-beach.mp3": "'SPF Bubbe' — Sunscreen Sinatra",
    "../salon.mp3": "'Blowout (Fabio's Theme)' — Hair Supply",
    "../avigail.mp3": "'Frenemies Forever' — Avi & the Gails",
    "../lulu.mp3": "the KVETCH 1450 hold music",
};
export const STATIONS = [
    { id: "auto", name: "LULU FM", emoji: "🎵", tag: "the trip's own soundtrack" },
    { id: "simcha", name: "SIMCHA 101.3", emoji: "🕺", tag: "all hora, all the time", dj: "DJ Shloimy",
        tracks: ["../wedding.mp3", "../story-electric.mp3", "../luludriving.mp3"],
        lines: [
            "That was the hora remix. Your bubbe's hip is FINE — she's DANCING.",
            "Shout-out to table nine. Yes, the singles table. We're rooting for you.",
            "Traffic: the left lane is moving like a kiddush buffet line. Pushy, but moving.",
            "Next hour: forty-five uninterrupted minutes of the Electric Slide. You're welcome.",
            "Request line's open! No, Uncle Moishe, we will NOT play the Macarena again.",
            "If you can hear this, you're too close to the speakers. Back up. Mazel tov.",
        ] },
    { id: "lounge", name: "SMOOTH 88.8", emoji: "🍸", tag: "music to schmooze by", dj: "Velvet Yossi",
        tracks: ["../story-relax.mp3", "../story-beach.mp3", "../salon.mp3", "../avigail.mp3"],
        lines: [
            "Smooth 88.8 — music for people who own a candle that smells like 'linen'.",
            "Lean back. Unclench your jaw. You've been clenching since Tuesday.",
            "This one goes out to whoever's eating kugel in their car right now. Bold. Respect.",
            "Velvet Yossi here, reminding you: a slow merge is a classy merge.",
            "It's four o'clock somewhere. Specifically here. It's four o'clock here.",
        ] },
    { id: "talk", name: "KVETCH 1450 AM", emoji: "🎙️", tag: "talk radio for people with opinions", dj: "Dr. Feh", bed: 0.09,
        tracks: ["../lulu.mp3"],
        lines: [
            "You're listening to Kvetch 1450 — if you're not upset, you're not listening.",
            "Weather: hot. Bubbe says take a sweater anyway.",
            "Sports: the Lakewood Kreplach lost 3–1. Coach says they 'played with heart, and no defence'.",
            "Breaking: a local car alarm has been going off since 2019. Neighbours now find it soothing.",
        ],
        segments: [
            [["DR. FEH", "Caller, you're on the air."], ["CALLER", "My mother-in-law parks in MY spot."], ["DR. FEH", "Have you tried moving? Out of state?"]],
            [["DR. FEH", "Ask the Lawyer! Go ahead."], ["CALLER", "Is it illegal to honk at a duck?"], ["LAWYER", "Legally, no. Morally? The duck will remember."]],
            [["DR. FEH", "Next caller."], ["IMA (CALLER)", "Lulu, if you're listening — call your mother."], ["DR. FEH", "Ma'am, this is a talk show."], ["IMA (CALLER)", "And I'm TALKING."]],
            [["DR. FEH", "Hello, you're on Kvetch."], ["BUBBE (CALLER)", "Is this the radio? My granddaughter drives too fast. She knows who she is."]],
            [["DR. FEH", "Caller from the pool?"], ["HESHY (CALLER)", "Yeah hi, is the pool open? …this is the radio? Oh. Love the show."]],
            [["DR. FEH", "Go ahead, caller."], ["AVIGAIL (CALLER)", "Shout-out to my best friend Lulu! …she owes me twenty dollars."]],
            [["DR. FEH", "First-time caller?"], ["UNCLE MOISHE (CALLER)", "Long-time businessman. Anybody need a slightly used bingo machine? No questions."]],
            [["DR. FEH", "Ask Bubbe! The question: is store-bought kugel a sin?"], ["BUBBE", "I'm not saying it is. I'm not saying it isn't."]],
        ] },
    { id: "off", name: "RADIO OFF", emoji: "📴", tag: "just the engine and your thoughts" },
];
export const ADS = [
    "🏛️ BERNIE BERNSTEIN, ATTORNEY AT LAW — Arrested? Accused? Allegedly? Call 1-800-NOT-GUILTY. I went to a real school. Online.",
    "🚗 UNCLE MOISHE'S PRE-LOVED CARS — every car comes with four tires. Most of them match!",
    "💅 FABIO'S SALON — a blowout so big it has its own zip code.",
    "🛡️ OY VEY INSURANCE — because accidents happen. Mostly to you, honestly.",
    "🥘 SHLOMO'S CHOLENT TO GO — slow-cooked for 18 hours, delivered in 18 minutes. Usually.",
    "📱 FLAPPR — the social app where your bubbe can see EVERYTHING. Download today!",
    "🦴 DR. KRAMER, CHIROPRACTOR — did you hit a pothole? Did a pothole hit you? We take insurance.",
    "⛽ GAS-N-GELT — our prices are lower than your expectations.",
    "🎰 VIVA VEGAS — what happens in Vegas gets posted by your cousin.",
    "🏋️ TUSH TONERS GYM — sit less, kvetch more. First month free.",
    "🚕 LULU CAB — we're hiring! Must have car, nerve, and a working horn.",
];
/** Live news the talk station / DJs read when something's happening on the road. */
export const NEWS = {
    chase: ["BREAKING: a high-speed pursuit on the highway. The suspect appears to be… vibing.",
        "Traffic: police are chasing a pink convertible. Everybody else, please continue to merge badly."],
    heist: ["BREAKING: the LUCKY 7 bingo hall reports a 'surprise withdrawal'. Witnesses describe the getaway car as 'adorable'."],
    cab: ["Traffic: reports of a pink cab doing… a LOT. Tip your driver."],
};
/** How Settings › Lulu's chatter shapes the radio talk (gap between messages × , ad odds ×). */
export const CHATTER = { chatty: { gap: 0.6, ads: 1.2 }, normal: { gap: 1, ads: 1 }, quiet: { gap: 2.4, ads: 0.35 } };
export const RADIO = { gap: [16, 26], songLen: [95, 140], firstMsg: [6, 10] };
