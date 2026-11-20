// features/town/towns — every line of text in MIDWOOD, Brooklyn (the town definition points here).
// The running gag: PARKING. There is none. There has never been any. Also: alternate-side,
// double-parking "for one second", the B/Q, Kings Highway at 1 pm on a Sunday, car services
// ("five minutes"), Erev-Shabbos lines, and the sibling rivalry with Lakewood — both ways.
// Roast the NEIGHBOURHOOD (traffic, parking, lines, trains, prices, the rivalry), never the
// people. Every business is a parody name; the street names are real.

// ── signs ────────────────────────────────────────────────────────────────
export const SIGNS = {
    welcome: ["WELCOME TO MIDWOOD", "Parking: LOL", "Twinned with Lakewood (Lakewood did not agree)"],
    tee: ["BROOKLYN · MIDWOOD →", "find parking: 45 min", "← DEAD END (like your parking spot)"],
    gas: { name: ["AVENUE GAS", "CASH ONLY · NO BATHROOM"], prices: ["REG 5.89", "AIR $2", "PARKING: N/A"] },
    advance: ["BROOKLYN · MIDWOOD", "NEXT EXIT ½ MI", "PARKING: LOL"],
    gantry: ["EXIT 9 · OCEAN PKWY · MIDWOOD", "Brooklyn · Parking: LOL"],
    gore: ["MIDWOOD ↗", "EXIT"],
    lastChance: ["LAST EXIT BEFORE", "YOU HAVE TO", "PARALLEL PARK"],
    closed: ["EXIT CLOSED", "(it's Brooklyn, it'll be there)"],
    limit: ["SPEED LIMIT", "25", "(Ocean Pkwy: BENCH)"],
    noParking: ["NO STANDING", "ANY TIME", "(sitting also discouraged)"],
    doubleParking: ["DOUBLE PARKING", "TOLERANCE ZONE: ZERO", "(nobody reads this sign)"],
    minivanDoor: ["CAUTION", "DOUBLE-PARKED MINIVAN", "MAY OPEN SLIDING DOOR WITHOUT WARNING"],
    sunday: ["SUNDAY TRAFFIC AHEAD", "BRING SNACKS"],
    lakewood: ["← LAKEWOOD 64 MI", "↑ REAL PIZZA 0.2 MI"],
    asp: ["8:30–10 AM", "TUES & FRI", "(Yes, You.)"],
    aspSuspended: ["ALTERNATE SIDE SUSPENDED", "HAPPY HOLIDAY", "STILL NOWHERE TO PARK"],
    lowClearance: ["LOW CLEARANCE 12'-6\"", "(the pigeon is 13')"],
    bqMaybe: ["THE B/Q-MAYBE", "Next train: eventually"],
    oneWay: "ONE WAY",
    closedNorth: ["OCEAN PKWY NORTH", "CLOSED FOR A STREET FAIR", "since 1987"],
    exitSouth: ["← HIGHWAY", "Ocean Pkwy South · to the Belt"],
    exitWest: ["HIGHWAY →", "Kings Hwy West · good luck"],
    toHighway: ["TO HIGHWAY", "(you'll be back. for the pizza.)"],
    billboards: [
        ["WE BUY CARS", "(we can't park them either)", "Kings Way Kar Service · 'he's around the corner'"],
        ["MOVING TO LAKEWOOD?", "WE'LL HELP!", "One Way Movers · there is no return trip"],
        ["YOUR PARKING SPOT", "IS NOT HERE", "Brooklyn Parking Authority (est. never)"],
    ],
    // block faces
    pizza: ["SLICE OF SINAI", "Motzei Shabbos line starts here →"],
    bakery: ["CHALLAH-DAY INN BAKERY", "Braided fresh since whenever"],
    carService: ["KINGS WAY KAR SERVICE", "'He's around the corner' · 24 hrs"],
    school: ["EDWARD R. MUMBLE HIGH SCHOOL", "Home of the Mumblers"],
    shul: ["YOUNG ISRAEL OF EAST 15½ STREET", "Mincha 4:12 · we need a tenth"],
    shtiebels: [
        ["THE LITTLE SHTIEBEL THAT COULD", "Mincha 4:12"],
        ["SHTIEBEL #2", "(the other one)"],
        ["KOLLEL OF THE BACK PORCH", "Shiur: 8 pm · cholent: 9 pm"],
        ["BAIS MEDRASH OF THE GARAGE", "Parking: inside, with the seforim"],
    ],
    college: ["BROOKLYN KOLLEGE OF KNOWLEDGE", "Est. when the clock was last right"],
    bank: ["KINGS COUNTY SAVINGS & BAGEL", "since 1931 · free lollipop · fuhgeddaboudit"],   // features/heist's bank (uses.bank)
    makolet: ["YANKY'S 24-HOUR MAKOLET", "open 24 hrs · closed Shabbos · it's complicated"],   // features/shops (uses.makolet)
    dealer: ["UNCLE MOISHE'S PRE-LOVED CARS — BROOKLYN", "the Coney Island Ave branch · we also do tires (badly)"],   // features/shops (uses.dealer)
    // features/places — the civic buildings (uses.precinct / .court / .hospital / .impound)
    precinct: ["POLICE · 70½TH PRECINCT", "courtesy · professionalism · parking"],
    court: ["KINGS COUNTY-ISH CIVIL COURT", "small claims · big feelings"],
    hospital: ["MIDWOOD GENERAL HOSPITAL", "emergency · walk-ins · the wait is the treatment"],
    impound: ["TOW POUND", "you park it, we take it"],
    avej: [
        ["SHELF HELP SEFARIM", "Big books, small store"],
        ["THE GEFILTE STATION", "Fish · Fresh · Probably"],
        ["GLATT-ITUDE BUTCHER", "We take our meat seriously"],
        ["WIG OUT SHEITELS", "Appointments only (Fridays: prayers only)"],
        ["RUGELACH RUSH", "Sold by the pound, gone by noon"],
        ["KUGEL KINGDOM", "Long live the lokshen"],
        ["CHOLENT & CHILL", "Open Thursday night till it's gone"],
        ["ERE-V SHABBOS SALE", "Everything must go by 3 PM"],
    ],
    avem: [
        ["AVENUE M MARKET", "the shopping carts are older than you"],
        ["SHMATTE SHACK", "children's clothes · 9 sizes · 0 in stock"],
        ["MIDWOOD MINIVAN WASH", "we find the Cheerios. all of them."],
        ["FLOWERS BY FRIDAY", "(sold out by Thursday)"],
        ["OPTICAL ILLUSIONS", "eye exams · frames · regrets"],
    ],
    kh: [
        ["99¢ & UP", "mostly up"],
        ["FIX-A-PHONE", "screens · cases · we don't ask"],
        ["SUSHI SHMUSHI", "kosher · glatt · raw"],
        ["KINGS HWY SAVINGS BANK", "est. 1904 · last parking spot 1931"],
        ["DISCOUNT KINGDOM", "nothing is discounted"],
        ["GREENGROCER GARY", "the fruit is fresh. the attitude, also fresh."],
    ],
    cia: [
        ["BUMPER TO BUMPER BODY SHOP", "If it's bent, we meant it"],
        ["TIRE-D OF IT TIRES", "used · new · borrowed"],
        ["CONEY ISLAND AVE MUFFLER", "we can hear you coming"],
        ["24 HR GAS & GOSSIP", "both full service"],
    ],
    apts: [["THE OCEAN ARMS"], ["MIDWOOD MANOR"], ["THE BEVERLY (NOT THAT ONE)"], ["CORTELYOU COURT"], ["THE KINGSWAY"]],
    plaque: ["IN HONOR OF", "THE LAST PARKING SPOT", "(1931–1931)"],
};

// ── Lulu ─────────────────────────────────────────────────────────────────
export const LULU = {
    enter: ["Brooklyn! Okay. Step one: find parking. Ha. Ha ha. Ha.", "Midwood. Where cars come to get double-parked in.", "Ocean Parkway! Bubbe says it used to be farms. It's still farms. Of minivans."],
    jam: ["Kings Highway at one p.m. on a Sunday. I've made a terrible mistake.", "Lakewood traffic? CUTE. This is Kings Highway.", "That bus has been at that stop since the Clinton administration."],
    parking: ["A spot! …No. A hydrant. A hydrant with a minivan parked on it.", "Double-parked, triple-parked… is that a QUADRUPLE?!"],
    hazards: ["Hazards on means it's legal. That's the law. I think. Bubbe said.", "'One second,' she said. In 2023."],
    asp: ["Alternate side! Everybody move to the side that's ALSO full!", "They're all sitting in their cars. Waiting. Like a drive-in movie with no movie."],
    sweeper: ["The street sweeper! Run! RUN!", "That sweeper has more power than the mayor."],
    train: ["The Q! It stops! Everywhere! Forever!", "The B just flew past like it saw a meter maid.", "It's trains all the way down."],
    underpass: ["The underpass: twelve metres of darkness and one pigeon who runs this neighbourhood.", "Something dripped on me. I'm choosing to believe it was water."],
    pizza: ["Forty minutes for a slice. Motzei Shabbos rules.", "There's a line for the line."],
    bakery: ["The challah line has its own zip code.", "Out of rugelach. Out of babka. Out of patience."],
    pkwy: ["Ocean Parkway: six lanes, two malls, zero patience.", "Bubby's Buick has been in the left lane since 1994. It's a landmark now too."],
    college: ["The clock says 4:07. It's ALWAYS 4:07.", "Brooklyn Kollege. Est. when the clock was last right."],
    carsvc: ["Car service! Five minutes! (Five Brooklyn minutes. A fiscal quarter.)", "'He's around the corner.' Which corner? Brooklyn has MANY."],
    oneway: ["It's a one-way street. And I'm going the… other way.", "ONE WAY. They mean it. Probably."],
    stopSign: ["It was a Brooklyn stop. That's a rolling stop with attitude.", "Eleven stop signs to Avenue M and I've met all of them personally."],
    sidewalk: ["Parked on the sidewalk. When in Brooklyn…"],
    leave: ["Out! And I never found parking. Not once.", "Bye, Brooklyn! Save me a slice. And a spot. Mostly a spot.", "Back to the highway, where the lanes have LINES."],
    lost: ["Lost them under the B/Q! Thank you, pigeon!", "One-way streets: the cops can't follow ME the wrong way. Oh wait."],
};

// ── the group chat (texts) ───────────────────────────────────────────────
export const GROUP = { from: "AVE J PARKING ALERTS (1,204)", emoji: "🅿️", color: "#1565C0" };
export const GOSSIP = {
    enter: ["PINK CONVERTIBLE coming up Ocean Pkwy. Does she have a spot?? She does NOT have a spot.", "Spot opening on East 15th — EVERYBODY STAY CALM, NOBODY HONK"],
    stopSign: ["Pink car rolled the stop on Avenue L. Brooklyn stop. Respect.", "Someone in PINK just did a stop sign like it was a suggestion"],
    crash: ["Fender bender on Avenue J. Both cars double-parked. During the crash.", "Pink car tapped a car service. The car service is around the corner. Arguing."],
    jack: ["Someone just drove off in a double-parked minivan. It had its hazards on. Hazards mean it's LEGAL??", "My car's gone. I double-parked for ONE SECOND. (It was 40 minutes.)"],
    sidewalk: ["She parked ON THE SIDEWALK on Avenue M. Honestly? Smart."],
    honk: ["Who's honking on Ocean Pkwy?? (everyone. it's Ocean Pkwy.)", "Honking on Avenue J. In other news, the sun rose.", "Somebody on Avenue J swears Dovid Dov davens in his shul. EVERYBODY on Avenue J swears that."],
    geese: ["The Avenue M pigeon got another one 🐦", "Pigeon under the bridge is ON ONE today"],
    cops: ["Cops chasing a pink car down Coney Island Ave. Still faster than the B68.", "Police chase on Kings Hwy. They're stuck behind a bus. Everyone's stuck behind a bus."],
    leave: ["Pink car took Ocean Pkwy south. Her spot is open!! (there was no spot)", "She left. Somebody grab where she was double-parked."],
    oneway: ["PINK CAR going the WRONG WAY down East 16th 😳", "Someone tell her East 15th goes NORTH. Someone. Anyone."],
    asp: ["ALTERNATE SIDE ALERT: the sweeper is on East 8th. MOVE YOUR CARS. (to where??)", "Sweeper's coming. Everybody into your cars and SIT."],
    train: ["Q is running. B is a rumour.", "Next Q in 2 min (the sign is an optimist)"],
};
export const BUBBE = { from: "BUBBE", emoji: "👵", color: "#E91E63", lines: [
    "Midwood?! Get me a babka from Avenue J. The GOOD place. Not the other place. You know.",
    "Don't park on Ocean Parkway, they'll tow you to Lakewood.",
    "If you see Mrs. Feldman on the bench, you didn't see me. Long story.",
] };

// ── people you can talk to on foot ───────────────────────────────────────
export const PEOPLE = {
    driver: { name: "Car-service guy", key: "town_mw_driver", lines: [
        "Car service! Five minutes!",
        "He's around the corner. Which corner? A corner. Brooklyn has many.",
        "I drove a guy to Lakewood once. He came back with a lawn. I don't know how.",
        "Flat rate to JFK. Flat rate to Lakewood: double, plus therapy.",
        "You want a ride? I'm double-parked. I'm ALWAYS double-parked. It's my office.",
    ] },
    bubby: { name: "Bubby on the bench", key: "town_mw_bubby", lines: [
        "Sit, sit. You came from LAKEWOOD? Sorry for your loss.",
        "This bench? Mine since 1994. The city just doesn't know yet.",
        "In my day Ocean Parkway had horses. Now it has my Buick. Same speed.",
        "You look thin. Go to Avenue J. Bring me a rugelach. Bring yourself two.",
    ] },
    roaster: { name: "Proud Brooklynite", key: "town_brooklyn", lines: [
        "You came from LAKEWOOD? Sorry for your loss.",
        "Lakewood guy says 'we have a driveway.' Cute. I have one too. Shared by three houses and a dumpster.",
        "In Lakewood they say 'the city' like dragons live here. It's Avenue M. There's a bakery.",
        "Brooklyn: walk to six shuls, four pizza stores and the Q. Lakewood: drive to Route 9 and sit.",
        "Lakewood traffic? Cute. Come see Kings Highway at 1 pm on a Sunday.",
    ] },
    cousin: { name: "Cousin who moved to Lakewood", key: "town_local", colors: { Vest: "#5D4037" }, lines: [
        "I moved to Lakewood. I have a LAWN now. I don't know what to do with it. I just look at it.",
        "Brooklyn? You pay a million dollars for a house that touches two other houses.",
        "Where do you PARK here? Oh. You don't. You just… live in the car.",
        "I wear a jacket to visit Avenue J now. It's 'the city'.",
    ] },
    pizza: { name: "Motzei Shabbos pizza line", key: "npcMan", colors: { Top: "#3949AB", Bottom: "#263238", Hair: "#3E2723" }, lines: [
        "Forty minutes. Worth it. Don't tell my cardiologist.",
        "They have pizza in Lakewood too. It's called 'driving back to Brooklyn'.",
        "Is this the line for the pizza or the line for the line?",
    ] },
    bakery: { name: "Erev-Shabbos shopper", key: "town_mom", colors: { Top: "#00695C" }, lines: [
        "Is this the line for the bakery or the fish store? …Yes.",
        "Erev Shabbos, 2:58. The challah line has its own zip code.",
        "Out of rugelach. Out of babka. Out of patience. Come back Sunday.",
        "The florist sold out of everything except one cactus and good wishes.",
    ] },
    asp: { name: "Waiting out alternate side", key: "npcMan", colors: { Top: "#8D6E63", Bottom: "#37474F", Hair: "#212121" }, lines: [
        "I'm not parked. I'm WAITING. Legally that's different. Spiritually, also different.",
        "The sweeper came by already. The sign says I wait till ten. The sign and I have a complicated relationship.",
        "Who moved my car? …Oh. The sweeper did. Spiritually.",
        "Alternate side is suspended for a holiday! We celebrate by double-parking anyway.",
    ] },
    commuter: { name: "Waiting for the Q", key: "npcWoman", colors: { Top: "#FCCC0A" }, lines: [
        "Next Q in 2 minutes. That was 11 minutes ago. The sign is an optimist.",
        "The B? On a Sunday? Sweetheart, the B is a weekday rumour.",
        "Delays because of a train ahead of us. Which is delayed by a train ahead of IT. Trains all the way down.",
    ] },
    student: { name: "Brooklyn Kollege student", key: "npcKid", colors: { Top: "#B71C1C" }, lines: [
        "The clock says 4:07. It's said 4:07 for my entire degree.",
        "I'm majoring in Finding Parking. It's a five-year program.",
        "The quad is beautiful. I've never seen it. I'm always on the B/Q.",
    ] },
    gabbai: { name: "The shul's gabbai", key: "town_agent", colors: { Tie: "#1B5E20" }, lines: [
        "Mincha 4:12! We need a tenth! Have you seen a tenth? About this tall, always late?",
        "Our shul's parking lot is a 1987 Buick. Very exclusive.",
        "Kiddush is at the other shtiebel. Don't tell this shtiebel.",
    ] },
    mechanic: { name: "Coney Island Ave mechanic", key: "town_brooklyn", colors: { Top: "#455A64", Hat: "#1565C0" }, lines: [
        "If your car makes a noise, I already fixed it. Twice. Pay me for the second time.",
        "Pink? Bold. Brooklyn respects bold. Brooklyn also keys bold.",
        "Lakewood cars come in here with grass in the tyres. GRASS.",
    ] },
};
export const LULU_REPLY = ["…Okay!", "Love that for you.", "I'm just passing through!", "Noted. Leaving now.", "That's so Brooklyn.", "Did you ever find parking?"];

// ── voices of the street ─────────────────────────────────────────────────
export const JAM_YELLS = ["MOVE!!", "It's KINGS HIGHWAY, not KINGS PARKING LOT!", "📣 BEEEEEP", "I'm double-parked for ONE SECOND!", "Lakewood traffic? CUTE.", "The light was green in 2019!", "Car service! Five minutes!", "Sunday. Never again. (Next Sunday.)"];
export const GOOSE = ["coo.", "COO.", "🐦 our bridge.", "coo coo (this is a stick-up)"];
export const BIKE_YELLS = ["Sorry!", "Delivery!", "One-way? Not for me!", "Hot pizza coming through!", "On your left! And your right!"];
export const DRIVER_YELLS = ["Watch it, PINKY!", "Out-of-towner!", "It's a ONE-WAY!", "Learn to park!", "Five minutes!"];

// ── the Midwood Kvetch (the phone's local news) ──────────────────────────
export const KVETCH_TITLE = "The Midwood Kvetch";
export const KVETCH = [
    { h: "Man finds parking spot on Avenue J", b: "Spot turns out to be a bus stop. Man keeps it anyway." },
    { h: "Alternate side suspended for a holiday", b: "Neighbourhood double-parks in celebration." },
    { h: "B train sighted on a Saturday", b: "Experts say it was a Q in an orange shirt." },
    { h: "Kings Hwy traffic hits 1 mph", b: "Pedestrians lap cars. Twice." },
    { h: "Ocean Pkwy bench turns 100", b: "Same Bubby sitting on it. 'I was here first.'" },
    { h: "Car service: 'five minutes'", b: "Day three." },
    { h: "Lakewood cousin visits", b: "Wears a jacket. Calls it 'the city'. Leaves before rush hour." },
    { h: "Challah line reaches Avenue K", b: "Shoppers form a minyan while waiting." },
    { h: "Weather", b: "Partly cloudy, with a 90% chance of double parking." },
    { h: "Pigeon under Ave M bridge re-elected", b: "Ran unopposed. Again." },
];
export const KVETCH_LIVE = {
    stopSign: { h: "Pink car rolls stop on Avenue L", b: "'A Brooklyn stop,' say witnesses. 'Respect.'" },
    jack: { h: "Double-parked minivan driven off", b: "Owner: 'The hazards were ON. That's LEGAL.'" },
    cops: { h: "Police chase down Coney Island Ave", b: "Stuck behind the B68. Everyone's stuck behind the B68." },
    oneway: { h: "Pink car goes the wrong way on East 16th", b: "Delivery bikes: 'Welcome to the club.'" },
    geese: { h: "Avenue M pigeon strikes again", b: "\"Coo,\" said the pigeon." },
};
