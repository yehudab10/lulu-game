// features/community — every line of text. Affectionate roast of the TOWN and the
// org stereotypes everybody already jokes about (Chaverim will fix anything, Shomrim
// really want to be cops, Hatzalah arrives before you hang up). Generic org names, our
// own livery, no real chapters, no real people. Bais Yaakov girls are minors: the
// blend-in is a crowd-hiding gag about walking in a straight line. That's it.

// ── the orgs (phone contacts + vehicle labels) ───────────────────────────
export const ORGS = {
    chaverim: { name: "Chaverim", emoji: "🚗", color: "#FFB300", tag: "roadside chesed · lockouts · flats · jumps · gas", call: "CHAVERIM DISPATCH" },
    hatzalah: { name: "Hatzalah", emoji: "🚑", color: "#E53935", tag: "volunteer EMS · faster than you can hang up", call: "HATZALAH" },
    shomrim: { name: "Shomrim", emoji: "🔦", color: "#3949AB", tag: "civilian patrol · not police · VERY close to police", call: "SHOMRIM HOTLINE" },
    police: { name: "911", emoji: "🚨", color: "#B71C1C", tag: "the real cops. the actual ones.", call: "911" },
    ima: { name: "Ima", emoji: "👩", color: "#E91E63", tag: "she picks up on the first ring. always.", call: "IMA" },
};

// ── Lulu notices them ────────────────────────────────────────────────────
export const LULU_SEES = {
    chaverim: ["Chaverim. If my car breaks down, I know who's coming.", "Amber lights. Somebody's getting a jump start.", "Chaverim: they'll unlock your car, fix your flat, AND set you up with their nephew."],
    shomrim: ["Shomrim. Three antennas. For what?!", "Is that a cop? …No. It REALLY wants to be.", "A Crown Vic with a light bar and a clipboard. Lakewood's finest-ish."],
    hatzalah: ["Hatzalah. Somebody stubbed a toe and they're already there.", "There goes Hatzalah. Faster than me. In a VAN.", "Hatzalah! I didn't even crash yet."],
    approach: ["Volunteer cars. We must be getting close to Lakewood.", "Chaverim, Shomrim, Hatzalah… yep. Lakewood's coming up."],
};

// ── roadside scenes (other people's problems) ────────────────────────────
export const SCENES = {
    flat: {
        org: "chaverim", label: "a minivan with a FLAT", icon: "🛞",
        waiting: ["Flat tire. Nine car seats. Zero spares.", "Does ANYONE have Chaverim's number?!", "My husband said he'd 'look at it.' In 2019."],
        plead: ["Hi! Do you have Chaverim's number?", "Are you Chaverim? You look like Chaverim. You're not Chaverim."],
        worker: ["Spare's on. Torque's good. Your tires are from the Clinton administration.", "Lug nuts, check. Now: are you dating anyone? My nephew—", "Done. Drive slow. Ha. Just kidding, it's Lakewood."],
        thanks: ["Tizku l'mitzvos!! I'm sending you a kugel.", "You're a tzaddik. A TZADDIK.", "I'm putting you in the group chat. As a GOOD thing."],
    },
    lockout: {
        org: "chaverim", label: "somebody LOCKED OUT", icon: "🔑",
        waiting: ["Keys are IN the car. The car is running. So is the baby's iPad.", "Locked out. Again. Third time this week.", "The keys are right there. RIGHT THERE."],
        plead: ["Do you know how to break into a car? Asking for… me.", "You look like someone who knows Chaverim."],
        worker: ["Slim jim, two seconds. Don't tell anybody how easy that was.", "Open. Maybe put a spare key in your shoe? Everybody does.", "Popped it. Your car seats are… very sticky."],
        thanks: ["You saved Shabbos. Not technically. But spiritually.", "Tizku l'mitzvos! Take a rugelach. Take two."],
    },
    battery: {
        org: "chaverim", label: "a dead BATTERY", icon: "🔋",
        waiting: ["Dead battery. Somebody left the dome light on. (It was me.)", "It just goes click click click.", "Is it the battery or the alternator? I don't know what either is."],
        plead: ["Do you have jumper cables? Or Chaverim? Or a husband who isn't 'on a call'?"],
        worker: ["Red on red, black on black, a little tehillim on the side.", "Try it now. …There she goes!", "Battery's from the Lakewood Bicentennial. Replace it."],
        thanks: ["You're an angel. A volunteer angel. With jumper cables.", "Tizku l'mitzvos! Running! It's RUNNING!"],
    },
    hurt: {
        org: "hatzalah", label: "a bochur who fell off his E-BIKE", icon: "🤕",
        waiting: ["Ow. Ow. Is it bleeding? It's not bleeding. Ow.", "I was going like thirty. On the sidewalk. Against traffic.", "Don't tell my mother. She'll take the bike. TAKE THE BIKE."],
        plead: ["Can you call Hatzalah? Don't tell them it was the bike."],
        worker: ["Scraped knee. Big scrape. Hero scrape. You'll live.", "Follow my finger. Good. Now stop riding against traffic.", "A band-aid and some Gatorade. And a helmet. A HELMET."],
        thanks: ["Thanks! …Can I still ride home?", "Baruch Hashem. Okay. Bye. Don't tell my mother."],
    },
};
export const ARRIVE_FAST = ["Hatzalah's here. You haven't even hung up.", "How. HOW are they already here.", "Forty seconds. Hatzalah got here in forty seconds."];
export const CHESED = ["🤝 A mitzvah! The whole town will know by tonight.", "🤝 Chesed! Bubbe would be SO proud.", "🤝 You called it in. Somebody's mother is sending you a kugel."];
export const GOSSIP_CHESED = ["Pink car stopped to help a minivan with a flat?? Who IS she", "The pink-car girl called Chaverim for Mrs. Klein. I'm reconsidering everything.", "Just saw the pink car call Hatzalah for a bochur on an e-bike. Respect."];

// ── Chaverim help Lulu ───────────────────────────────────────────────────
export const ASSIST = {
    arrive: ["Chaverim! We saw the smoke from Route 9.", "Need a hand? We're Chaverim. We ALWAYS have a hand.", "That's a lot of dents. Like, a LOT."],
    work: ["Pop the hood. …Oh. Oh no. Okay. Okay, I've seen worse. Once.", "Duct tape, zip ties, and a little emunah.", "You hit WHAT? A minivan? Which one. Never mind, they're all the same."],
    done: ["Good as new. Well — good as 'used.' Drive slow.", "Fixed! No charge. Tizku l'mitzvos. Also: do you have a shidduch?", "All better. Don't tell my wife I was out till midnight for a stranger's convertible."],
    lulu: ["You guys are AMAZING.", "Can I pay you? In… rugelach?", "Okay I take back everything I said about Lakewood. Some of it."],
    gas: ["Out of gas? We brought a can. AND a kugel.", "Here — premium. Don't ask what's in it.", "Topped you up. Nitro's in the green can. Don't tell the Shomrim."],
    unlock: ["Car won't start? Lemme see… you just had it in DRIVE.", "Jump start, a new fuse, and a bracha. Hop in!", "Ran it off our battery. You're good. Go, go!"],
    tow: ["Stuck? We'll pull you out. We've pulled out worse. We've pulled out a BUS.", "Hooked up. Hang on. Hold your coffee."],
    leave: ["Drive safe! Not too safe, it's Lakewood.", "Call us anytime. Literally anytime. We don't sleep."],
    offer: "🚗 Chaverim pulling up behind you…",
    cancel: "Okay, never mind! Drive safe! 👋",
};

// ── Hatzalah help Lulu ───────────────────────────────────────────────────
export const PATCH = {
    arrive: ["Hatzalah. We were already on the block. We're always already on the block.", "Who called? You called. We're here. That was it.", "Don't move. Okay, move. Let's look at you."],
    work: ["Any pain? Dizziness? Did you eat today? You didn't eat today.", "Follow my finger. Good. Again. Good. Now eat this granola bar.", "Some bumps, some bruises, a LOT of drama."],
    done: ["You're fine. Drink water. Eat something. Call your mother.", "Patched up! Here — a granola bar AND a sucking candy.", "All good. If anything hurts, call us. If nothing hurts, call your mother."],
    fine: ["You're FINE. Not a scratch. You called Hatzalah for… nothing?", "We came anyway. We always come. Eat something."],
    // (the heart cap: help.js HEAL — they still come, they just won't patch her up again so soon)
    capped: ["We JUST patched you. Sit. Drink water. Stop hitting things.", "Again? You're our best customer. That's not a compliment. Rest a bit.", "You're fine. You're bruised, but you're fine. Go slower and call your mother."],
};

// ── Shomrim ──────────────────────────────────────────────────────────────
export const SHOMRIM = {
    start: ["🔦 SHOMRIM ON YOUR TAIL!", "🔦 SHOMRIM SAW THAT!", "🔦 A CROWN VIC WITH A LIGHT BAR!"],
    startSub: ["not police · VERY close to police", "they're calling it in…", "three antennas. they mean business."],
    join: "🔦 SHOMRIM JOIN THE CHASE",
    radio: ["📻 \"She's heading down {street}!\"", "📻 \"Pink convertible, {street}, going like a bus!\"", "📻 \"Unit 4, she's on {street}! Unit 4? Yanky?!\"", "📻 \"Visual on the suspect, {street}. Over. Do we say over?\"", "📻 \"{street}! She's on {street}! Somebody tell the real cops!\""],
    shout: ["We're not police, but we ARE calling them!", "Ma'am! MA'AM! Please pull over! …Please?", "I'm filming this! On my flip phone! In HD! (not HD)", "Stop! In the name of… the neighborhood!", "License and— no wait, we can't ask that.", "You're on camera! Probably! The lens cap might be on!", "Pull over, we just want to talk! And maybe call the police!"],
    callIn: "📞 SHOMRIM CALLED IT IN",
    callInSub: "the real cops are on the way",
    lost: ["📻 \"Lost her by the bagel place.\"", "📻 \"Lost visual. It's the minivans. They all look the same.\"", "📻 \"She's gone. Back to the kiddush, everyone.\""],
    giveUp: "📻 \"Fine. FINE. We'll get her next time.\"",
    hold: {
        title: "🔦 BOXED IN BY SHOMRIM",
        open: [
            ["SHOMER", "Ma'am! Please stay in the vehicle! We're not police—"],
            ["SHOMER #2", "—but we ARE calling them!"],
            ["SHOMER", "Yanky, are you filming?"],
            ["SHOMER #2", "I'm filming! The lens cap is on, but I'm filming!"],
        ],
        ask: "We have to hold you here until the police arrive. Would you like some water? A babka?",
        options: ["😇 \"I'm on my way to a shiur!\"", "👵 \"My Bubbe lives on Forest Ave!\"", "📱 \"Is that a FLIP PHONE?\"", "💨 Floor it!"],
        shiurOk: ["SHOMER", "A shiur? Which shiur? …You know what, it's fine. Go. Learn something."],
        shiurNo: ["SHOMER", "A shiur. In a pink convertible. At sixty miles an hour. No."],
        bubbeOk: ["SHOMER", "Wait — BUBBE BRUCK's granddaughter?! Go, go! Send regards! Tell her the kugel was perfect!"],
        bubbeNo: ["SHOMER", "Everybody's Bubbe lives on Forest Ave. Nice try."],
        flip: ["SHOMER #2", "It's a KOSHER phone. It's a lifestyle. …That's it, we're calling them."],
        floorOk: ["SHOMER", "She's going around the Crown Vic! SHE'S GOING AROUND THE CROWN VIC!"],
        floorNo: ["SHOMER", "You can't floor it, you're boxed in. That's what boxing in IS."],
        cops: ["SHOMER", "Here they are. Officers! We held her for you! …Can we have a badge? A sticker? Anything?"],
        free: "😮‍💨 Talked your way out!",
        let: "🔦 The Shomrim let you go (with a brochure)",
    },
    foot: ["Ma'am! Stop! Please walk… slower!", "She's on foot! I'm also on foot! This is a foot chase!", "Don't run! It's a very hot day to be running!"],
    report: {
        lines: ["Shomrim hotline, what's the situation?", "A suspicious car? What kind?", "A silver minivan? Ma'am, that's every car."],
        self: ["Shomrim hotline. A suspicious… pink convertible? Driving like a maniac?", "Wait. Ma'am. Are you calling from… a pink convertible?", "ALL UNITS! SHE'S REPORTING HERSELF!"],
        arrive: ["We checked it out. It was Yanky. It's always Yanky.", "Suspicious car investigated. It was a carpool. Very suspicious. Very late.", "False alarm. But thank you! We LOVE a call."],
        geese: ["We don't do geese. Nobody does geese.", "The geese? Ma'am. We have families."],
    },
};

// ── 911 ──────────────────────────────────────────────────────────────────
export const POLICE = {
    parked: ["911, what's your emergency?", "Minivans triple-parked on Main St?", "Ma'am… that's just Lakewood. Please hold for… no. No, we're hanging up."],
    geese: ["911. Geese. Okay. Ma'am, are the geese armed?", "We'll send a car. Not for the geese. To watch."],
    self: ["911, what's your emergency?", "A pink convertible driving like a maniac… What's the plate?", "Ma'am. We're tracing the call. It's coming from INSIDE the pink convertible."],
    selfFoot: ["911, what's your emergency?", "A wanted woman on foot near you? Can you describe her?", "Ma'am… you just described yourself. Stay right there."],
    surrender: ["911. You'd like to… turn yourself in? Oh, thank goodness.", "Stay where you are. A car's coming. Do NOT run.", "(Honestly? Respect.)"],
};

// ── the Bais Yaakov ──────────────────────────────────────────────────────
export const BY = {
    hint: "🎀 Bais Yaakov dismissal — blend into the line to lose the heat",
    prompt: "🎀 BLEND IN",
    disguise: "🎀 Navy skirt, light-blue blouse, ponytail. NOBODY will know.",
    title: "🎀 BLEND IN WITH THE BAIS YAAKOV LINE",
    howTo: "step on the beat · freeze when the menahel looks",
    menahel: "MENAHEL",
    look: "👀 THE MENAHEL IS LOOKING — DON'T MOVE",
    lineUp: ["Girls, a STRAIGHT line please!", "Single file! Single! File!", "No running in the line, no giggling in the line, no LINE in the line— wait.", "Who's chewing gum? I can hear gum."],
    suspicious: ["Hm. New girl?", "Is that girl… wearing sneakers?", "Excuse me, which class are you in?"],
    giggle: ["*giggle*", "*snort*", "*hehe*"],
    caught: ["YOU! Which class are you in?! …Where's your ruler?!", "That is NOT a regulation skirt length! That's not even a regulation PERSON!"],
    win: ["🎀 Blended right in. The cops walked right past.", "🎀 Nobody looks twice at a Bais Yaakov line. Nobody."],
    pursuer: ["Has anyone seen a woman in a pink— no, these are schoolgirls. Never mind.", "She's gotta be around here somewhere…", "All these girls look the same! In a good way! Professionally!"],
    girls: ["Is she new?", "She's OLD. Like thirty.", "Shh! Morah's looking!", "I like her ponytail.", "Is she in tenth? She looks like she's in tenth."],
    lulu: ["Just a normal… student… walking in a normal… line.", "Don't giggle. Don't giggle. DON'T GIGGLE.", "Twenty-eight years old. Tenth grade. Totally normal."],
    talk: ["Morah says no talking to strangers. You're a stranger.", "Are you lost? You look lost. And old."],
};

// ── Lulu's lines on the phone ────────────────────────────────────────────
export const LULU_CALL = {
    chaverim: "Hi, Chaverim? I need… you know. Help. With the car. Again.",
    hatzalah: "Hatzalah? Yeah, hi, it's — oh you're already here?",
    shomrim: "Shomrim? I'd like to report a… situation.",
    police: "Hi, 911? Yeah, it's… about Lakewood.",
    ima: "Hi Ima! No, nothing's wrong. I just— hi.",
};
export const NOTHING = "Nothing to report right now — drive around a bit.";
/** When there's honestly nothing to call an org about right now: one line, in their voice (by org; .road = off town). */
export const NOTHING_BY = {
    chaverim: "\"You're on FOOT. We fix cars. …Want us to look at your shoes?\"",
    hatzalah: "\"Not a scratch? Then why are you calling? …Eat something.\"",
    shomrim: "\"Nothing suspicious? In LAKEWOOD? Keep looking. It's out there.\"",
    shomrimRoad: "\"Shomrim patrols the NEIGHBOURHOOD. This is a highway. …Call us from town. We're ALWAYS in town.\"",
    police: NOTHING,
};
/** What the dispatcher says when she calls (in a town / out on the road). Lines name the town (common.js local()). */
export const DISPATCH = {
    chaverim: { town: "Chaverim, where are you? …Okay. Don't move. Somebody's two minutes away. Somebody's ALWAYS two minutes away.",
        road: "Chaverim. You're on the Parkway? …We see you. We see EVERYTHING from Route 9. Somebody's on the way.",
        midwood: "Chaverim! Where are you? …Coney Island Ave? Somebody's double-parked right around the corner. Don't move." },
    hatzalah: { town: "Hatzalah. Where are you? …We see you. Turn around.",
        road: "Hatzalah. The Parkway? We were already on the Parkway. We're ALWAYS already on the Parkway.",
        midwood: "Hatzalah. We were at the pizza shop on Avenue J. We're always at the pizza shop on Avenue J. Coming." },
    shomrim: { town: "Shomrim hotline, what's the situation?", midwood: "Shomrim, Midwood! We saw you from Kings Hwy. We see everything from Kings Hwy." },
    /** In the car at speed: help is coming, she has to stop for it. */
    pullOver: "🛑 Pull over and stop — they'll find you",
};
/** Ima, on the phone (one call; no reward — she just wants her to wear a sweater). */
export const IMA_CALL = [
    ["Are you wearing a sweater?", "It's freezing out. I can hear that it's freezing. Put on a sweater.", "Okay. Love you. SWEATER."],
    ["Did you eat? You didn't eat. There's kugel in the fridge.", "And take a sweater. It's going to get cold. It's ALWAYS going to get cold."],
    ["You're driving? Hang up! …No, wait, are you wearing a sweater?", "Okay. Now hang up. Drive carefully. Sweater!"],
];
