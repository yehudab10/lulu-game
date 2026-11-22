// features/town/towns — every line of text in Lakewood (the town definition points here). Nobody likes Lakewood. Roast the
// TOWN (the traffic, the parking, the construction, the minivans, the buses, the
// prices, the gossip, the chaos), never the people. Parody names only.

// ── signs ────────────────────────────────────────────────────────────────
export const SIGNS = {
    welcome: ["WELCOME TO LAKEWOOD", "Pop.: Yes", "Est. traffic: always"],
    // the interchange's T-junction (the guide board across the STOP sign) + the gas station there
    tee: ["LAKEWOOD →", "Pop.: Yes · Parking: No", "← I-95 (it's not too late)"],
    gas: { name: ["SHMULY'S GAS & GO", "KOSHER · CLOSED SHABBOS"], prices: ["REG 4.19", "KUGEL 6.99", "PARKING: LOL"] },
    advance: ["LAKEWOOD", "NEXT EXIT ½ MI", "(you've been warned)"],
    gantry: ["EXIT 91 · LAKEWOOD", "Pop.: Yes · Parking: No"],
    gore: ["LAKEWOOD ↗", "EXIT"],
    lastChance: ["LAST CHANCE", "TO NOT GO TO", "LAKEWOOD"],
    closed: ["EXIT CLOSED", "you're on the clock"],
    yield: ["YIELD", "lol"],
    bumps: ["SPEED BUMP", "SPEED BUMP · SPEED BUMP", "SPEED BUMP SPEED BUMP"],
    limit: ["SPEED LIMIT", "25", "(ha)"],
    noParking: ["NO PARKING", "ANY TIME · EVER", "DON'T EVEN"],
    construction: ["COMING SOON: 400 LUXURY TOWNHOUSES", "SOLD OUT"],
    construction2: ["COMING SOON:", "MORE OF THIS"],
    billboards: [
        ["YOUR HOUSE.", "WE WANT IT.", "Shmuly Realty · cash · as-is · with you in it"],
        ["WE BUY HOUSES", "CASH · TODAY · BEFORE SHABBOS", "(also your Bubbe's)"],
        ["THIS LOT: SOLD", "NEXT LOT: SOLD", "YOUR LOT: ?"],
    ],
    hall: ["SIMCHA PALACE", "Weddings · Bar Mitzvahs · Gridlock"],
    pizza: ["PIZZA SHMIZZA", "40-MIN WAIT · $6 A SLICE"],
    yeshiva: ["YESHIVA OF CARPOOL LANE", "Shul · Beis Medrash · Minyanim"],
    baisYaakov: ["BAIS YAAKOV OF CARPOOL LANE", "dismissal 3:40 · straight lines · no giggling"],
    buses: ["SCHOOL BUS DEPOT", "a bus leaves every 4 minutes. forever."],
    shops: [
        ["SEFORIM & MORE", "& MORE & MORE"],
        ["SHEITEL SHACK", "walk-ins: never"],
        ["DISCOUNT EVERYTHING", "nothing is discounted"],
        ["CARPOOL CAFÉ", "coffee for the line"],
        ["BAGEL BARN", "open till we run out (7:15 am)"],
        ["THE SUKKAH STORE", "open all year. somehow."],
        ["MINIVAN WASH", "we find the Cheerios"],
        ["SHMUEL'S HARDWARE", "and opinions"],
        ["KUGEL KORNER", "it's a lot of kugel"],
    ],
    exitSouth: ["← HIGHWAY", "Route 9 South · ESCAPE"],
    exitWest: ["HIGHWAY →", "You can leave. Allegedly."],
    toHighway: ["TO HIGHWAY", "(you'll be back)"],
    plaque: ["IN HONOR OF", "THE MINIVAN"],
    bandBus: ["THE MAZEL TONES", "simcha band · 11 players · 1 bus · 0 parking"],
    realty: ["GOLD STANDARD REALTY", "Shprintzy Gold · we sell COZY · se habla Yiddish"],   // features/realestate (uses.realty)
    bank: ["FIRST MINIVAN BANK OF LAKEWOOD", "drive-thru · 9 lanes · still a line"],   // features/heist's bank (uses.bank)
    makolet: ["ZISSY'S MAKOLET & PHARMACY", "milk · kugel pans · pepper spray · bubble wrap"],   // features/shops (uses.makolet)
    dealer: ["UNCLE REFAEL'S PRE-LOVED CARS", "every car checked twice · no haggling"],   // features/shops' dealership (uses.dealer)
    // features/places — the civic buildings (uses.precinct / .court / .hospital / .impound)
    precinct: ["POLICE · PRECINCT 18½", "we bend the rules so you don't have to"],
    court: ["LAKEWOOD MUNICIPAL COURT", "justice · traffic tickets · Tuesdays only"],
    hospital: ["ST. SHLOIMY'S MEDICAL CENTER", "urgent care · ER · free lollipops for brave kids"],
    impound: ["IMPOUND LOT", "authorized vehicles only"],
};

// ── Lulu ─────────────────────────────────────────────────────────────────
export const LULU = {
    enter: ["I swore I'd never come back here. And yet.", "Lakewood. Okay. In and out. Nobody needs to know.", "Every time. EVERY TIME I take this exit."],
    jam: ["Route 9. A parking lot. Shocking.", "I've been in shorter lines at the DMV.", "Is this traffic or a wedding? Both. It's both."],
    circle: ["A traffic circle where nobody yields. Love that for us.", "Round and round. Like the gossip.", "A gold minivan on a pedestal. Of COURSE."],
    bumps: ["Speed bump. Speed bump. SPEED BUMP. My spine!", "Who puts a speed bump every ten feet?!", "That's forty. I'm counting. I'm suing."],
    stopSign: ["It was more of a… rolling suggestion.", "Nobody stops here anyway!", "That stop sign is decorative. Right?"],
    geese: ["Why are the geese chasing me?!", "These geese have a lawyer. I can tell.", "Okay okay OKAY, it's YOUR road!"],
    pizza: ["A forty-minute line. For PIZZA. On a Tuesday.", "Six dollars a slice?! Bubbe would faint."],
    parking: ["Zero spots. ZERO. And a CHAIR?!", "That chair is saving a spot. A CHAIR."],
    construction: ["Four hundred townhouses. On THAT lot. Sure.", "A crane on every block. Lakewood's state bird."],
    hall: ["There's a wedding. There's ALWAYS a wedding.", "Triple-parked for a chasunah. Classic."],
    bus: ["Another school bus. It's nine p.m.!", "How many buses does ONE town need?!"],
    bike: ["He's on an e-bike. Against traffic. With a hat.", "That bochur just passed me. On a BIKE."],
    leave: ["Never again. (Until next time.)", "Free! I'm FREE!", "I'm out! Nobody saw me. …Everybody saw me."],
    sidewalk: ["Parked on the sidewalk. When in Lakewood…"],
    lost: ["Corners! Finally the cops can't see me!", "Lost them in the minivans. They all look the same!"],
};

// ── the group chat (texts) ───────────────────────────────────────────────
export const GROUP = { from: "LAKEWOOD MOMS (312)", emoji: "🗣️", color: "#7E57C2" };
export const GOSSIP = {
    enter: ["Is that Lulu's PINK car on Route 9?? 👀", "Pink convertible just came off the exit. Who's she visiting??", "Pink car's back. Unrelated: does ANYONE know who this Dovid Dov is?? My kids won't stop singing it."],
    stopSign: ["Someone in a PINK car just blew the stop on Carpool. The whole town knew before she got home.", "PINK CAR. STOP SIGN. I have a video.", "She didn't even do the Lakewood half-stop. Not even the half."],
    bumps: ["Somebody took the Carpool Ln bumps at fifty. My kitchen shook.", "Pink car caught AIR on Carpool Ln 😳"],
    crash: ["Pink car hit a silver minivan. That narrows it down to… every minivan.", "Fender bender on Main. Nobody hurt. Everybody talking."],
    jack: ["Someone's driving off in Yanky's minivan and it is NOT Yanky", "Did anyone else just see a carjacking at the stop sign?? In THIS economy?"],
    sidewalk: ["She parked ON THE SIDEWALK. Honestly? Respect."],
    honk: ["Pink car honking on Main. Babies are SLEEPING.", "Who is HONKING?? (everyone. everyone is honking.)"],
    geese: ["The geese got another one 🦢", "Lake Dr geese are ON ONE today"],
    cops: ["Cops chasing a pink car down Main St. Not the first time this week.", "Police chase on Forest Ave. Still faster than carpool."],
    leave: ["She left. Good. More parking for us. (There is no parking.)", "Pink car took the exit. We'll see her next week."],
};
export const BUBBE = { from: "BUBBE", emoji: "👵", color: "#E91E63", lines: [
    "Lakewood?! What did you do wrong?",
    "Don't buy the pizza, it's six dollars a slice! For six dollars I make you a BRISKET.",
    "Call me when you're out. IF you get out.",
] };

// ── people you can talk to on foot ───────────────────────────────────────
export const PEOPLE = {
    brooklyn: { name: "Out-of-towner (Brooklyn)", key: "town_brooklyn", lines: [
        "I came here for a wedding. In 2019. Still looking for parking.",
        "In Brooklyn we have traffic. Here the traffic HAS traffic.",
        "You know what Lakewood needs? A Lakewood bypass. Around Lakewood.",
        "Six dollars for a slice. The slice was sad. I was sad.",
    ] },
    monsey: { name: "Visitor from Monsey", key: "town_mom", colors: { Top: "#00897B", Hair: "#8D6E63", Bottom: "#37474F" }, lines: [
        "We have a traffic circle in Monsey too. Ours has DIGNITY.",
        "I've been at that stop sign twenty minutes. Nobody stops at it. I'm just polite.",
        "The gossip here travels faster than the cars. Which isn't hard.",
        "My cousin moved here for 'the quiet.' I've been honked at nine times.",
    ] },
    local: { name: "A proud local", key: "town_local", lines: [
        "It's not traffic. It's COMMUNITY.",
        "Parking? Of course we have parking. It's called your neighbour's lawn.",
        "Four hundred townhouses is a NEIGHBOURHOOD, not a problem.",
        "Route 9 is moving. Spiritually.",
        "The buses are early! Yesterday's bus. But early!",
    ] },
    chair: { name: "Spot saver", key: "town_mom", lines: [
        "That chair? It's holding the spot for my sister-in-law. She's coming Thursday.",
        "Don't touch the chair. The chair has seniority.",
        "You can park there after the bris. Which bris? There's always a bris.",
    ] },
    agent: { name: "Shmuly (Realty)", key: "town_agent", lines: [
        "Your house. We want it.",
        "Nice car! For sale? Everything's for sale. Is your BUBBE'S house for sale?",
        "Cash offer. Today. As-is. With you still in it.",
        "Sold this corner twice this morning. Different buyers. Same corner.",
    ] },
    pizza: { name: "Last in line", key: "npcMan", colors: { Top: "#5C6BC0", Bottom: "#263238", Hair: "#3E2723" }, lines: [
        "I've been in this line since Mincha.",
        "They're out of plain. They're ALWAYS out of plain.",
        "Six dollars. For a slice. And I'm grateful.",
    ] },
    bochur: { name: "Bochur on an e-bike", key: "town_bochur", lines: [
        "Sorry, sorry! Late for seder! I'm always late for seder.",
        "The bike does forty. The brakes do… maybe.",
        "Stop signs are for cars. I'm a BIKE.",
    ] },
};
export const LULU_REPLY = ["…Sure.", "Okay then.", "That's… a lot.", "I'm just passing through!", "Love that for you.", "Noted. Leaving now."];

// ── voices of the street ─────────────────────────────────────────────────
export const JAM_YELLS = ["MOVE!!", "THERE'S NO LIGHT, WHY ARE WE STOPPED?!", "I'M LATE FOR CARPOOL!", "📣 BEEEEEP", "I can SEE my house from here!", "Yanky? Is that YOU?!", "HONK if you're also stuck", "It's been 40 minutes!"];
export const GOOSE = ["HONK.", "HONK!!!", "🦢 OUR road.", "HONK HONK HONK"];
export const BIKE_YELLS = ["Sorry!", "Coming through!", "LATE FOR SEDER!", "On your left! And right!"];
export const DRIVER_YELLS = ["Watch it, PINKY!", "Out-of-towner!", "It's a STOP SIGN!", "I have NINE KIDS in here!", "Learn to drive!"];

// ── the Lakewood Kvetch (the phone's local news) ─────────────────────────
export const KVETCH_TITLE = "The Lakewood Kvetch";
export const KVETCH = [
    { h: "Route 9 still a parking lot", b: "Experts baffled. Residents not." },
    { h: "Town approves 400 townhouses", b: "On a lot the size of a sukkah." },
    { h: "Traffic circle marks 10 years", b: "Not a single recorded yield." },
    { h: "Man finds parking spot", b: "Town in shock. Spot turned out to be a lawn." },
    { h: "Pizza Shmizza: slice now $6.50", b: "The line got LONGER." },
    { h: "School bus spotted at 11 p.m.", b: "\"It's the 11 o'clock run,\" says nobody." },
    { h: "Local man: \"Not traffic, community\"", b: "Community still not moving." },
    { h: "Weather", b: "Humid, with a 90% chance of a chasunah on Main St." },
    { h: "LOST: one lawn chair", b: "Guarding a spot on Forest Ave. Reward: the spot." },
    { h: "Geese win again", b: "Lake Dr remains under goose control." },
];
export const KVETCH_LIVE = {
    stopSign: { h: "Pink car runs Carpool Ln stop", b: "Video in the comments (312 comments)." },
    jack: { h: "Minivan driven off at stop sign", b: "Owner: \"It had nine car seats. They can keep it.\"" },
    cops: { h: "Police chase through town", b: "Still faster than carpool." },
    geese: { h: "Geese claim another car", b: "\"HONK,\" said the geese." },
};
