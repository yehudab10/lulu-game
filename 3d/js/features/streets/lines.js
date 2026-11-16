// features/streets — every line of dialogue. PG-13 cartoon crime comedy: sarcastic,
// nobody gets hurt (knocked-over folks see stars and get up ANGRY), no slurs,
// nothing gross, and Dina's world stays out of it.

// Lulu, yanking someone out of their car
export const JACK_LULU = [
    "Sorry! Family emergency!",
    "I'll bring it back! …Probably.",
    "It's a mitzvah to share!",
    "Bubbe needs a ride. You understand.",
    "Think of it as a test drive!",
    "Out! I've got a brisket in the oven!",
    "Don't worry, I have INSURANCE. Somewhere.",
    "Shalom, and thank you for your car!",
];
// …the driver, mid-air
export const JACK_YELP = ["HEY!!", "MY CAR!", "WHAT THE—", "NOT AGAIN!", "I JUST WASHED IT!", "OY!"];

// the driver, after getting up (by reaction)
export const VICTIM = {
    fist: ["You'll hear from my LAWYER!", "I know your MOTHER!", "That car has FEELINGS!", "Hope you like the radio — it's all polka!",
        "My Lexus! Er… my Corolla!", "SHE WAS RIGHT, THIS TOWN IS CRAZY!"],
    yell: ["THAT'S MY CAR!!", "The seat's set for ME!", "Bring it back before Shabbos!", "I didn't even finish my coffee!",
        "Who DOES that?!", "And she didn't even signal!"],
    chase: ["COME BACK WITH MY CAR!", "Wait! My sandwich is in there!", "I'm too old for this!", "STOP! THIEF! …ugh, my knees."],
    call: ["Hello, police?! A lady in a SHEITEL took my car!", "911? Yes, a CARJACKING! She said 'shalom'!",
        "Officer, she was very polite about it, but STILL!"],
};
export const VICTIM_STARS = ["💫", "🌟", "⭐"];

// the cop car flavour
export const JACK_COP_LULU = ["A cop car? Bold. VERY bold.", "Ooh, it has a SIREN!", "Officer, I'm just… borrowing your jurisdiction."];
export const JACK_COP_VICTIM = ["That's a POLICE VEHICLE, ma'am!", "I'm ON DUTY!", "Dispatch?! You will NOT believe this…"];

// the first drive in each kind of ride (handling hint)
export const RIDE_HINT = {
    sedan: "🚗 A sensible sedan. Boring. Perfect.",
    van: "🚐 The minivan floats like a parade balloon!",
    truck: "🚚 Box truck: heavy, slow, unstoppable.",
    cop: "🚓 A real cop car! Lights, camera, CRIME.",
    streets_sports: "🏎️ Sports car: FAST and twitchy — easy on the stick!",
};

// bailing out of a moving car
export const BAIL_LULU = ["I meant to do that.", "Note to self: that hurt.", "TEN out of ten, would bail again!",
    "My sheitel! Is my sheitel OK?!", "Tuck and roll, just like Zeidy taught me!", "Okay. Okay. I'm FINE."];
export const BAIL_TOAST = ["🤸 BAILED OUT!", "🤸 TUCK AND ROLL!", "🤸 DIVE!"];

// spike strips + roadblocks
export const SPIKED = ["POP! POP! There go the tires!", "Spikes?! In THIS economy?!", "Riding on rims — very chic."];
export const ROADBLOCK_BANNER = ["🚧 ROADBLOCK AHEAD!", "🚧 THEY'VE BLOCKED THE ROAD!"];
export const COP_BARK = ["END OF THE ROAD, LULU!", "PULL OVER!", "Nowhere to run!", "Hands where I can see 'em!"];

// PAINT & PRAY (Moishe runs it)
export const PAINT_HELLO = [
    "Welcome to Paint & Pray! You paint, I pray the cops are colour-blind.",
    "New colour, new you, no questions. Questions cost extra.",
    "Drive in, hold still, think innocent thoughts.",
    "Another 'misunderstanding'? Sit tight, sweetheart.",
];
export const PAINT_DONE = [
    "Fresh coat! Your own MOTHER wouldn't recognise it.",
    "Like it never happened. Which, officially, it didn't.",
    "That'll be a mitzvah — and the coins. Mostly the coins.",
    "Drive safe! Or at least drive AWAY.",
];
export const PAINT_BROKE = ["No coins, no miracles, bubbeleh.", "I pray for free. Paint, I charge for.", "Come back with {cost} coins and a better attitude."];
export const PAINT_WARRANT = "The paint covers the car. The warrants — that's between you and the judge.";
export const PAINT_COLORS = [
    { name: "Mint Getaway", body: "#26A69A", light: "#80CBC4", dark: "#00695C" },
    { name: "Undercover Lavender", body: "#9575CD", light: "#D1C4E9", dark: "#4527A0" },
    { name: "Innocent White", body: "#ECEFF1", light: "#FFFFFF", dark: "#90A4AE" },
    { name: "Taxi Yellow", body: "#FDD835", light: "#FFF59D", dark: "#F57F17" },
    { name: "Midnight Navy", body: "#283593", light: "#7986CB", dark: "#1A237E" },
    { name: "Lime Alibi", body: "#9CCC65", light: "#DCEDC8", dark: "#558B2F" },
    { name: "Bubbe's Plum", body: "#8E24AA", light: "#CE93D8", dark: "#4A148C" },
    { name: "Sunset Orange", body: "#FB8C00", light: "#FFCC80", dark: "#E65100" },
    { name: "Grey-Matter Grey", body: "#78909C", light: "#B0BEC5", dark: "#37474F" },
];

// smashable props
export const PROP_NAMES = {
    hydrant: "HYDRANT", mailbox: "MAILBOX", fruitstand: "FRUIT STAND", trashcan: "TRASH CAN",
    newsbox: "NEWS BOX", fence: "PICKET FENCE", phonebooth: "PHONE BOOTH", barrier: "BARRICADE",
};
export const PROP_LULU = {
    hydrant: ["Free car wash!", "Oops — the whole block's getting a bath."],
    fruitstand: ["Fresh produce! Delivered. At 60 mph.", "Five a day, Ima! FIVE A DAY!"],
    mailbox: ["Your mail's been… expedited.", "Return to sender!"],
    phonebooth: ["Who even uses those anymore?!", "Superman's gonna be SO mad."],
    fence: ["Very… open-plan now.", "Sorry, Mrs. Goldfarb!"],
    trashcan: ["Taking out the trash!", "Ew. EW. Ew."],
    newsbox: ["Extra! Extra! Lulu wrecks newsbox!", "Breaking news. Literally."],
};
export const FRUIT_VENDOR = ["MY MELONS!", "Those were ORGANIC!", "You're paying for those mangoes!"];

// the family weighs in (rare texts after a big moment)
export const FAMILY_TEXTS = [
    { from: "Ima", emoji: "👩", msg: "Mrs. Feldman says she saw you take a VAN from a man in a bathrobe. Tell me she's wrong." },
    { from: "Bubbe", emoji: "👵", msg: "In my day we stole HEARTS, not cars. Call me." },
    { from: "Avigail", emoji: "💅", msg: "omg are u on the NEWS rn?? 📺 the helicopter angle is NOT flattering" },
    { from: "Heshy", emoji: "🏊", msg: "Bro. Was that you on the highway? With the cops? Legend. Also don't tell Ima I said that." },
    { from: "Uncle Burry", emoji: "🧔", msg: "Kid, I know a guy who paints cars. Paint & Pray. Tell Moishe I sent you." },
    { from: "Ima", emoji: "👩", msg: "The neighbours are asking why there's a fruit stand on our lawn. Lulu. LULU." },
];

// Shmuel's Chop Shop
export const CHOP_INTRO = [
    "Lulu, it's Shmuel. I need a {want}. No questions, no paperwork, no nonsense.",
    "Shmuel here. A client wants a {want}. Bring it to the shop, I pay cash.",
    "It's Shmuel. Find me a {want} — 'found' being the operative word.",
];
export const CHOP_DONE = ["Beautiful. Like you found it in a cereal box.", "Pleasure doing business. We never met.", "She purrs! I'll take it from here."];
export const CHOP_WRONG = ["That's not what I ordered, sweetheart.", "Close, but my client is VERY particular."];
