// features/airport — ✈️ THE JFK TERMINAL's words: the parody airlines, the departures board, the security line, the
// food court, the gate, the arrivals door, the crowd. Cartoon only (the owner, 2026-11-20): parody airlines, a security
// line that is one long silly gag — nothing about real incidents or real screening. 12+, warm, never mean.

/** The three parody airlines (check-in desks, liveries, the board). */
export const AIRLINES = {
    kugel: {
        name: "Kugel Air", code: "KA", color: "#FFC107", emoji: "🟡",
        motto: "We'll get you there. Eventually.",
        agent: "Kugel Air agent",
        hello: [
            "Welcome to Kugel Air! Where every seat is a window seat if you lean far enough.",
            "Kugel Air, hi! Our planes are like our kugels: heavy, golden, and they ALWAYS land. Eventually.",
            "Kugel Air! We've been on time since 1987. Once. It was beautiful.",
            "Hi hon! Kugel Air — the only airline where the safety card is a recipe card.",
        ],
        ask: [
            ["🎫 Check in", "Destination? …Oh, you're not flying. Then you're the most relaxed person in this building. Mazel tov."],
            ["🍮 What's the meal?", "Kugel. On the way there, kugel. On the way back, a DIFFERENT kugel. We're not animals."],
            ["⏱️ Is it on time?", "Define 'time'. Define 'on'. Okay, it's delayed, but emotionally it's right on schedule."],
        ],
    },
    eloy: {
        name: "El Oy", code: "EO", color: "#29B6F6", emoji: "🔵",
        motto: "Non-stop kvetching.",
        agent: "El Oy agent",
        hello: [
            "El Oy, how can I hhhelp you. Oy. Sorry, long shift.",
            "Welcome to El Oy. Our legroom is cozy. 'Cozy' is the word legal lets us use.",
            "El Oy! Every flight comes with a free sigh. Oyyy. You're welcome.",
            "El Oy, the airline of your mother's worries. 'Did you eat? Take a sweater. Call when you land.'",
        ],
        ask: [
            ["🎫 Check in", "Window or aisle? Doesn't matter — the man next to you will tell you his whole life story either way."],
            ["🧳 Carry-on rules?", "One bag. One personal item. One bag of rugelach that is ALSO a personal item. We don't ask."],
            ["💺 Any upgrades?", "First class is sold out. Business class is sold out. Economy is… a strong word. Here, a free oy."],
        ],
    },
    shmear: {
        name: "Shmear Jet", code: "SJ", color: "#FF7043", emoji: "🟠",
        motto: "Schmeared across the sky.",
        agent: "Shmear Jet agent",
        hello: [
            "Shmear Jet! No line! …That's either great news or a warning. We're still finding out.",
            "Welcome to Shmear Jet, the bagel of airlines: round trip, a hole in the middle of the schedule.",
            "Shmear Jet! Our pilots trained at the finest bakery in Brooklyn. They're GREAT at landings. Soft. Fluffy.",
            "Hi! Shmear Jet. Plain, sesame or everything? …Sorry. Habit. The seats. I meant the seats.",
        ],
        ask: [
            ["🎫 Check in", "Bagel class or Lox class? Lox costs extra but you get a tiny paper cup of capers."],
            ["🥯 Where's everyone?", "They're all at Kugel Air. Something about loyalty points. Their points are made of potato."],
            ["🛫 Where do you fly?", "Wherever the shmear takes us. Mostly Florida. The shmear LOVES Florida."],
        ],
    },
};

/** The departures board (rows cycle through; the status flips now and then). */
export const FLIGHTS = [
    { t: "09:15", f: "KA 613", to: "BOCA RATON", g: "18", s: "DELAYED — PILOT AT A SIMCHA" },
    { t: "09:40", f: "EO 18", to: "TEL AVIV", g: "4", s: "BOARDING (EVENTUALLY)" },
    { t: "10:05", f: "SJ 770", to: "MIAMI — AGAIN", g: "7", s: "ON TIME (ALLEGEDLY)" },
    { t: "10:30", f: "KA 120", to: "MONSEY", g: "2", s: "WHY ARE YOU FLYING TO MONSEY" },
    { t: "10:55", f: "EO 36", to: "LAS VEGAS", g: "12", s: "DELAYED — LOST AT THE BUFFET" },
    { t: "11:20", f: "SJ 3", to: "THE CATSKILLS", g: "9", s: "CANCELLED — KUGEL NOT SET" },
    { t: "11:45", f: "KA 54", to: "LAKEWOOD", g: "1", s: "IT'S 90 MIN BY CAR. JUST DRIVE." },
    { t: "12:10", f: "EO 99", to: "ANTARCTICA", g: "26", s: "WAITING FOR A MINYAN" },
    { t: "12:35", f: "SJ 8", to: "SHEBOYGAN", g: "5", s: "GATE CHANGED. AGAIN." },
    { t: "13:00", f: "KA 7", to: "BUBBE'S", g: "18", s: "ON TIME — SHE'S WAITING" },
    { t: "13:25", f: "EO 4", to: "ORLANDO", g: "11", s: "DELAYED — STROLLER JAM" },
    { t: "13:50", f: "SJ 22", to: "MONTREAL", g: "3", s: "BOARDING — BRING A HAT" },
];
export const STATUSES = [
    "DELAYED — PILOT AT A SIMCHA", "DELAYED — CO-PILOT AT THE SAME SIMCHA", "BOARDING (EVENTUALLY)", "ON TIME (ALLEGEDLY)",
    "GATE CHANGED. AGAIN.", "DELAYED — WAITING FOR A MINYAN", "DELAYED — PLANE IS SHY", "CANCELLED — KUGEL NOT SET",
    "BOARDING — NOT YOU", "DELAYED — SOMEONE'S BUBBE IS TALKING TO THE PILOT", "ON TIME?! (SUSPICIOUS)", "DELAYED — LOOKING FOR A PARKING SPOT",
];
export const BOARD_LULU = [
    "Delayed for a simcha. Honestly? Fair. You don't skip a simcha.",
    "Flight to Lakewood. It's ninety minutes by car. Who IS on that plane?!",
    "'Waiting for a minyan.' There's nine guys at the gate looking around nervously.",
    "Gate changed AGAIN. Somewhere a family with ten kids just turned around.",
    "Cancelled because the kugel isn't set. Safety first.",
    "Every flight is delayed except the one to Bubbe's. Nobody makes Bubbe wait.",
    "'Boarding — not you.' Wow. Personally attacked by a sign.",
];

/** The security line + the BEEP-O-MATIC 3000 (one long silly gag). */
export const LINE = {
    ask: "The security line. It snakes. It loops. Somewhere in there a man has started a small business.",
    wait: "⏳ Wait in line",
    duck: "🏃 Duck under the ropes",
    nah: "💬 Never mind",
    again: "You already got through! (The kugel did not.)",
    captions: [
        "⏳ Hour one. The line moves. Then it reconsiders.",
        "⏳ Hour two. The man in front of you has started a minyan.",
        "⏳ Hour three. A baby in the next lane has learned to walk.",
        "⏳ …okay, four minutes. It FELT like hours.",
    ],
    shuffle: ["Nu?", "It moved!", "…it stopped.", "Is this the line for the line?", "I've been here since Purim.", "Anyone want a rugelach?"],
    outrage: ["NU?!", "The CHUTZPAH!", "Young lady, the LINE!", "I'm telling your mother!", "I've been here since PURIM!", "We have a line-cutter!"],
    guardStop: "Ma'am. MA'AM. The line is a sacred journey. Everyone walks the snake.",
    backOfLine: "😇 Back of the line",
    plead: "🥺 \"My Bubbe's on that flight!\"",
    backLine: "Back of the line. It got longer while I was gone. Of course it did.",
    pleadGuard: "…Is she the one with the hundred-and-forty-pound bag? …Go. GO. Before I change my mind.",
    beepKeys: ["BEEP!", "Keys. In the tray, please. All of them. Even the mystery one."],
    beepKugel: ["BEEP BEEP!", "…Anything ELSE in the bag, ma'am?"],
    luluKugel: "…a kugel. Ima packed it. 'For the flight.' (There is no flight.)",
    dogKugel: "Rex has found the kugel. Eleven years on the job — he has never found anything that ISN'T kugel.",
    beepChutzpah: ["BEEP!", "CHUTZPAH DETECTED"],
    guardChutzpah: "Never seen it go off for THAT before. Impressive, honestly.",
    clear: ["DING! ✅", "You're clear. The kugel stays with Rex. For evidence."],
    luluClear: "Bye, kugel. You were the real passenger all along.",
};
export const GUARD = [
    "Officer Segal, airport security. I ride the Segway so the floor doesn't get tired.",
    "Top speed? Eleven miles an hour. Downhill. With a tailwind. Nobody escapes me. Slowly.",
    "Rex and I have been partners for eleven years. He finds kugel. I find… Rex.",
    "This terminal is safe. I checked under every chair. Found four kippot and a sandwich from 2019.",
    "The Segway's name is Shloimy. Don't touch Shloimy.",
    "I once chased a runaway luggage cart for forty minutes. The cart won. I've made peace with it.",
    "Ma'am, I'm going to need you to have a nice day. That's an order.",
];
export const GUARD_EXIT = ["EXIT ONLY! 🙅", "That's the way OUT, hon!", "Nice try! The line's that way 👉"];
export const DOG = [
    "Rex sniffs you thoroughly… no kugel. He loses all interest in you as a person.",
    "Rex wags. Rex sniffs. Rex sits. That means 'kugel nearby'. There is always a kugel nearby.",
    "You pet Rex. Rex allows it. Professionally.",
    "Rex is off duty. Rex is never off duty. Rex just closed one eye.",
];
export const DOG_GUARDING = "Rex is lying on top of YOUR kugel. He's guarding the evidence. With his whole body.";

/** Bubbe's overweight bag at the Kugel Air scale. */
export const BAG = {
    who: "Bubbe Faigy",
    agentOver: "Ma'am, the bag is 41 pounds over.",
    bubbe: [
        "It's four kugels and a brisket. They're LIGHT kugels.",
        "Over? It's the SAME bag I took in 1974. It was fine in 1974.",
        "That's not weight, that's LOVE. You can't charge for love. …How much do you charge for love?",
    ],
    ask: "Bubbe Faigy looks at you. The agent looks at you. The bag looks at you.",
    opts: ["🧥 Wear Bubbe's sweaters", "🍮 'Lighten' a kugel", "🪑 Sit on the bag"],
    sweaters: "Six sweaters. You are now shaped like a dreidel. The bag lost twelve pounds.",
    sweatersBubbe: "See? Now you're dressed for the plane AND the weather. Close enough, they never check.",
    kugel: "You eat one kugel for Bubbe. The bag is three pounds lighter. Your heart is three pounds heavier.",
    kugelBubbe: "A kugel that light has no calories. That's a Bubbe rule. It's in the Torah. Somewhere.",
    sit: "You sit on the bag to squish it down. The scale goes UP. Way up.",
    sitAgent: "Ma'am. Ma'am. Please get off the bag.",
};

/** The departures board's neighbour: the arrivals door. */
export const ARRIVALS = [
    "A man with eleven suitcases: \"I was gone a WEEKEND.\"",
    "A Zeidy comes out and the whole family screams. He's been in Florida for three days.",
    "A girl runs out and hugs a dog. The dog takes the bag. Good dog.",
    "Someone's Bubbe comes out pushing a cart with a full-size crib on it. \"For the grandchildren. Plural.\"",
    "A man in sunglasses comes out, looks around, sees nobody holding his sign, and gets his OWN sign out.",
    "A family of nine walks out counting heads. They get to ten. They don't ask questions.",
];
export const SIGNS = ["WELCOME HOME ZEIDY!", "MR. & MRS. KUGELMAN", "SHLOMO? (THE TALL ONE)", "TAXI — CHEAP — NOT REALLY"];
export const GREETERS = [
    "\"We made the sign at 4 AM. Zeidy, if you're reading this — we spelled it right this time.\"",
    "\"Mr. Kugelman? No? Are you SURE you're not Mr. Kugelman? You have a very Kugelman face.\"",
    "\"Shlomo is tall. Very tall. If you see a tall man, that's probably Shlomo. Or a very short giraffe.\"",
    "\"Taxi? Cheap! …Cheaper than a helicopter. Let's leave it at that.\"",
];
export const VIP = [
    "A red carpet… roped off… 'RESERVED · VIP.' Somebody famous is coming through here. I can FEEL it.",
    "The man guarding the carpet says it's for 'a very important performer'. He won't say who. He's humming.",
    "Velvet ropes, a red carpet and absolutely nobody on it. The most exclusive empty spot in New York.",
];

/** The food court: Shmuley's deli + the H2-OY! water bar. Snacks restore a heart — at a fixed price, capped. */
export const DELI = {
    who: "Shmuley",
    hello: [
        "Shmuley's Sky-High Deli! The food is kosher, the prices are at cruising altitude.",
        "Welcome! Everything here is fresh. Fresh-ish. Fresher than the airplane food, guaranteed.",
        "Shmuley's! Airport prices, Bubbe portions. Somebody has to suffer and it's the wallet.",
    ],
    menu: [
        { id: "knish", label: "🥟 A knish", price: 8, heal: 1, prop: "Knish", line: "A knish the size of a doorknob. Hot. Potato-y. Worth it." },
        { id: "pastrami", label: "🥪 Pastrami on rye", price: 14, heal: 1, prop: "Pastrami", line: "Pastrami stacked so high it has its own gate number." },
        { id: "pickle", label: "🥒 One (1) pickle", price: 3, heal: 0, prop: "Pickle", line: "Three coins for one pickle. Crunch. …It's a very good pickle, I'll give him that." },
    ],
    nah: "👋 Just looking",
    nahLine: "Just looking is free! For now. We're working on it.",
};
export const WATER = {
    who: "H2-OY! water bar",
    hello: [
        "H2-OY! Water: bottled at sea level, priced at thirty thousand feet.",
        "Hi! Sparkling, still, or 'still sparkling from last week'?",
        "Welcome to H2-OY! Every bottle is blessed by a guy named Mendel. He's very thorough.",
    ],
    menu: [
        { id: "water", label: "💧 A bottle of water", price: 12, heal: 1, prop: "Water", line: "Twelve coins. For WATER. …It's very refreshing. That's the worst part." },
        { id: "tap", label: "🚰 Just tap water?", price: 0, heal: 0, prop: null, line: "Tap water is fifteen. The tap is imported." },
    ],
    nah: "👋 No thanks",
    nahLine: "Stay hydrated! Somewhere cheaper!",
};
export const FOOD = {
    full: "You're full! (Save your coins — Shmuley would never say that, so I'm saying it.)",
    capped: "\"You've had enough, mamaleh.\" — and he NEVER says that. (No more snacks in the terminal today.)",
    broke: "\"You're a few coins short, hon.\" (Airport prices. Everyone's a few coins short.)",
};

/** The gate: GATE 18, the window, the seats, the sleeper, the desk. */
export const GATE = {
    who: "Gate agent",
    desk: [
        "Flight KA 613 to Boca Raton will be boarding soon! …Not you, sweetie. You don't have a ticket. Or a flight.",
        "Boarding soon! Group one: Bubbes. Group two: people carrying food for Bubbes. Group three: everyone else, slowly.",
        "We're just waiting for the pilot. He's at a simcha. He'll be here after the dessert. Or the dancing. Or the bentching.",
        "Can you board? Honey, there's no flight for you yet. But I like your energy. Come back when you have a reason to go somewhere.",
        "This gate has seen everything. A man brought a whole sukkah once. Folded. Carry-on.",
    ],
    window: [
        "A plane takes off. Somewhere up there, somebody's already asking for a second kugel.",
        "The planes look so small from here. And so BIG from the window seat. Physics is weird.",
        "One day I'm getting on one of those. Not today. Today I'm looking at them dramatically.",
        "Kugel Air's plane is yellow. Like a kugel. Branding!",
    ],
    sleeper: [
        "\"Five more minutes, Ima…\" (He's taking up four seats. His bags have the other two.)",
        "\"Zzz… Group… one… zzz…\" He has been 'boarding soon' since Tuesday.",
        "He's asleep across four seats like a very peaceful bridge. Nobody has the heart to move him.",
        "\"I'm not asleep, I'm resting my eyes for the flight.\" (The flight left. Twice.)",
    ],
    sit: ["Ahh. An airport chair. Comfortable in a way that's mostly theoretical.", "Sitting at the gate. Watching planes. Going nowhere. Living the dream.",
        "This is the best seat in the house. Facing the window, next to an outlet that doesn't work."],
    boardingPA: ["📢 Now boarding group one… not you.", "📢 Flight KA 613: boarding soon. Very soon. Ish.", "📢 Will the owner of a yellow kugel please… never mind, Rex has it."],
    boardSign: ["GATE 18 · KA 613", "BOCA RATON", "BOARDING SOON", "— NOT YOU —"],
};
export const FAMILY = [
    "\"…eight, nine — WHERE'S TEN?! …oh, he's holding the stroller. Okay. Everybody hold hands!\"",
    "\"Gate 18! Where's gate 18?!\" (They've walked past gate 18 nine times. It's right there.)",
    "\"Kids, the plane has snacks — no, we're not on the plane yet. NO, the snacks are not on us.\"",
    "\"Tatty, are we there yet?\" \"We haven't LEFT yet.\" \"…are we there yet?\"",
    "\"Who has the passports? …Who has the PASSPORTS? …Oh. I have the passports. Everybody calm down.\"",
];
export const PA = [
    "📢 Would the owner of a blue minivan with 14 car seats please move it. Or explain it.",
    "📢 Reminder: the moving walkway is for walking. It is not a ride. Yes, Dovi, we see you.",
    "📢 Lost and found has a single sock, a shtreimel and someone's whole cholent. Please collect your cholent.",
    "📢 Kugel Air would like to remind passengers that the kugel is not a flotation device.",
    "📢 Flight EO 99 to Antarctica is still waiting for a tenth man. Anybody? Anybody at all?",
    "📢 Paging Mrs. Goldberg — your son called. He says you never call.",
];
export const PA_WANTED = "📢 Would passenger L-U-L-U please stay EXACTLY where she is. Thank you. Don't make Rex run.";

/** If she's WANTED when she walks in: cartoon security slows her, the real cops catch up. */
export const LAW = {
    spot: ["Ma'am! You look EXACTLY like the poster!", "Rex! REX! It's her!", "Halt! …Slowly! I'm on a Segway!"],
    dog: ["Rex has your shoelace.", "Rex is holding on to your sneaker. Very gently. Very firmly."],
    slow: "🐕 Rex has your shoelace — slow going!",
    cops: "🚓 The real cops are here!",
    caught: "Gotcha. Rex did most of the work, we just walked in.",
    escaped: "The cops lost you somewhere between the deli and the duty-free.",
    charge: "RUNNING FROM A SEGWAY",
};

/** Lulu walking in. */
export const ENTER = [
    "JFK! It smells like jet fuel and somebody's tuna sandwich.",
    "An airport! Everybody's either running, sleeping or eating a forty-dollar sandwich.",
    "Terminal 4½. Don't ask what happened to the other half.",
];
