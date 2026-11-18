// features/exits — every line of text at the rest areas. Roast the REST AREA (the food, the
// bathrooms, the prices, the vending machine, the gift shop), never the people. Teen-rated.

/** The rest areas take turns with these names (index k in a run). */
export const NAMES = [
    { name: "THE OY VEY-SIS", sub: "SERVICE PLAZA", short: "the Oy Vey-sis" },
    { name: "KVETCH 'N' STRETCH", sub: "REST AREA", short: "Kvetch 'n' Stretch" },
    { name: "THE SHLEPPER'S REST", sub: "TRAVEL PLAZA", short: "the Shlepper's Rest" },
    { name: "MILE 18 REST AREA", sub: "(PROBABLY MILE 18)", short: "Mile 18 (probably)" },
];

// ── the highway signs (blue service boards) ─────────────────────────────
export const SIGNS = {
    mile: ["REST AREA · 1 MI", "FOOD · GAS · RESTROOMS", "REGRET"],
    half: ["REST AREA · ½ MI", "FOOD · GAS · PICNIC · PET AREA", "LAST CLEAN BATHROOM FOR 40 MI"],
    next: ["REST AREA", "NEXT RIGHT", "(you've earned it)"],
    gore: ["REST AREA ↗", ""],
    back: ["HIGHWAY ↗", "ALL POINTS · NO REFUNDS"],
    trucks: ["TRUCKS · BUSES", "→ THIS WAY →"],
};
// ── the lot's own signs (one atlas) ─────────────────────────────────────
export const LOT = {
    food: ["FOOD COURT", "OPEN 24 HRS · KOSHER-ISH"],
    restroom: ["RESTROOMS", "ABANDON HOPE"],
    vending: ["SNACKS", "EXACT CHANGE · NO REFUNDS"],
    souvenir: ["SOUVENIRS", "DEAL OF THE DAY"],
    mechanic: ["MENDEL'S MUFFLERS", "DENTS · DINGS · REGRETS"],
    gas: ["FILL 'ER UP", "PAY AT PUMP"],
    pets: ["PET AREA", "PLEASE PICK UP AFTER YOUR DOG. AND YOURSELF."],
    picnic: ["PICNIC AREA", "NO BBQ · NO DRAMA"],
    stay: ["2 HR LIMIT", "YES, THAT MEANS YOU"],
};

// ── Lulu, arriving / leaving ─────────────────────────────────────────────
export const LULU = {
    arrive: ["A rest stop! Bathroom, snack, existential crisis. In that order.", "Ooh, a food court. Ima says never eat at a rest stop. Ima isn't here.",
        "Five minutes. Then back on the road. …Ten.", "Road trip rule #1: ALWAYS stop for the gift shop."],
    leave: ["Back on the road! Smelling like fries.", "Okay. Refreshed. Ish.", "That's enough resting. My feet hate resting AND walking."],
    full: ["I'm full. Of hearts AND knishes.", "I'm good, I'm good. I feel AMAZING."],
    broke: ["I'm short. On coins, not height.", "My wallet says no. My stomach says yes. Wallet wins."],
};

// ── the food court (heal for coins) ──────────────────────────────────────
export const FOOD = {
    who: "Counter guy",
    hello: ["Welcome to the food court! Everything's fresh. Fresh-ish. Fresh-adjacent.", "What can I get you? The knishes are from today. Today's a strong word.",
        "Order up! We have pizza, we have knish, we have something called 'the special'."],
    menu: [
        { id: "knish", label: "🥔 Potato knish", cost: 6, hearts: 1, line: "It's warm! It's dense! It's a brick of love. +1 ❤️" },
        { id: "pizza", label: "🍕 Rest-stop pizza", cost: 9, hearts: 1, line: "Eleven dollars for a slice. And somehow it's still worth it. +1 ❤️" },
        { id: "special", label: "🍲 'The Special'", cost: 14, hearts: 2, line: "Nobody knows what it is. It's DELICIOUS. +2 ❤️" },
    ],
    bye: ["Come back soon! Or don't. We're open forever.", "Enjoy! Napkins are by the door. All three of them."],
    fullUp: "Hearts are full, hon. Take a pickle for the road. On the house. 🥒",
};
// ── the restrooms (a gag) ────────────────────────────────────────────────
export const RESTROOM = [
    { say: ["OCCUPIED.", "…still occupied.", "*flush*  …nope, occupied again."], out: "Fine. I'll hold it until Vegas." },
    { say: ["The hand dryer is from 1987.", "WHOOOOOOSH", "…my HAIR."], out: "My blowout. My BEAUTIFUL blowout. 😭" },
    { say: ["No toilet paper.", "There's never toilet paper.", "*finds a napkin from the food court*"], out: "Resourceful. Ima would be proud. Disgusted, but proud." },
    { say: ["Ooh, it's actually clean!", "Like, CLEAN clean.", "Is this… a trap?"], out: "Five stars. Would rest-area again. 🌟" },
];
// ── the vending machines ─────────────────────────────────────────────────
export const VENDING = {
    cost: 3,
    snacks: ["🥨 Pretzels (stale since the Bush administration)", "🍫 A chocolate bar (melted, then re-frozen, then melted)", "🥤 Diet soda (mostly diet)", "🍪 Cookies (\"kosher\", says a sticker)"],
    stuck: ["IT'S STUCK. IT'S HANGING THERE. MOCKING ME.", "The bag is stuck on the spiral. Classic."],
    kick: ["*bonk*  …TWO fell out! JACKPOT! 🎉", "*thwack*  …justice. And a bonus snack."],
    kickFail: "*bonk*  Ow. My FOOT. It's still stuck.",
};
// ── the souvenir stand (one deal a day) ─────────────────────────────────
export const SOUVENIR = {
    who: "Souvenir lady",
    hello: ["Deal of the day, sweetheart! Today only! (Every day only.)", "Postcards, mugs, snow globes of a parking lot… what'll it be?",
        "Everything's half off! Off of what, I don't know."],
    deals: [
        { id: "missile", label: "🚀 Novelty 'souvenir' missile", cost: 35, give: s => { s.missiles = (s.missiles || 0) + 1; }, line: "It's a SOUVENIR. Totally a souvenir. Don't tell the cops." },
        { id: "shield", label: "🛡️ Lucky bumper shield", cost: 40, give: s => { s.shields = (s.shields || 0) + 1; }, line: "Blessed by a rabbi. Probably. He was wearing a hat." },
        { id: "pepper", label: "🌶️ Travel-size pepper spray", cost: 25, give: s => { s.pepperSpray = (s.pepperSpray || 0) + 1; }, line: "For bears. And for people who don't let you merge." },
    ],
    trinkets: ["🧲 an I ❤️ REST AREAS magnet", "☕ a mug that says WORLD'S OKAYEST DRIVER", "🔮 a snow globe of the parking lot", "🧦 socks with the rest area's logo on them"],
    trinketCost: 5,
    bye: ["Drive safe! And tell your friends! Or don't. We get by."],
};
// ── Mendel's Mufflers (drive into the bay: dents out for coins) ─────────
export const MECHANIC = {
    who: "Mendel",
    cost: 20,
    hello: ["Pull in, pull in! Ooh. Who did this to you? Was it a pole? It's always a pole.", "Dents? I LOVE dents. Dents put my kids through yeshiva."],
    done: ["*bang bang bang* Good as new. Newer. Don't look under the hood.", "Fixed! I also found three fries and a hair tie under your seat. No charge."],
    clean: ["Your car's perfect, mamele. Go, go. Come back when you hit something.", "Not a scratch! What, you DRIVE carefully? In THIS economy?"],
    broke: "Twenty coins, sweetheart. I take cash, card, or a really good kugel.",
    reply: ["Thanks Mendel!", "Don't tell my mother.", "It was NOT a pole. (It was a pole.)"],
};
// ── the gas pumps (drive under the canopy and stop: nitro for coins) ─────
export const GAS = {
    who: "Pump jockey",
    cost: 10,
    hello: ["Fill 'er up? Premium, regular, or 'rest-stop prices'?", "Gas is ten coins. Don't ask why. Nobody knows why."],
    done: "⛽ Nitro full! −{cost} 💰",
    full: "⛽ Already full — he cleaned your windshield anyway. +50",
    broke: "⛽ Not enough coins — he gave you a sympathy squirt",
    reply: ["Highway robbery! …Thanks!", "Ten coins. TEN. I'm telling Ima.", "Smells like gas and pretzels in here. Love it."],
};
// ── the picnic tables + the dog run ──────────────────────────────────────
export const PICNIC = ["Five minutes off my feet. Bubbe was right about everything.", "Nature! Picnic tables! A suspicious stain! Paradise.", "This is nice. Why is it nice? I'm suspicious."];
export const DOG = {
    name: "Kugel",
    owner: "Dog walker",
    pet: ["*wag wag wag*", "*happy snort*", "*licks your hand, then the air, then you again*"],
    lulu: ["Who's a good boy? YOU are! And you're named after FOOD!", "Kugel! KUGEL! I'd die for you, Kugel.", "His fur is softer than my life choices."],
    ownerLines: ["His name's Kugel. He's a rescue. He rescued US, really.", "Don't feed him. He already ate a hot dog. With the paper.", "He likes you! He doesn't like anybody. He bit a toll booth once."],
};

// ── the travellers you can talk to (on foot, ✋ TALK) ─────────────────────
export const PEOPLE = {
    trucker: { name: "Big Sal (trucker)", key: "npcMan", colors: { Top: "#C62828", Bottom: "#1A237E", Hair: "#9E9E9E" }, lines: [
        "Eighteen wheels, sweetheart. And they ALL hate Lakewood.",
        "I've eaten at every rest stop from here to Ohio. This one's top five. Bottom five. Both.",
        "Breaker one-nine, there's a pink convertible doing ninety. …Oh, it's you. Hi.",
        "You want trucker advice? Never trust a knish after 9 PM.",
    ] },
    ima: { name: "Exhausted mom", key: "npcWoman", colors: { Top: "#AD1457", Bottom: "#37474F", Hair: "#4E342E" }, lines: [
        "We've been in the car SIX HOURS. Somebody threw up. Somebody always throws up.",
        "'Are we there yet' — forty-one times. I counted. I had time.",
        "Don't make eye contact with my kids. They can smell weakness. And snacks.",
        "My husband said 'shortcut.' That was Tuesday.",
    ] },
    kid: { name: "Bored kid", key: "npcKid", colors: { Top: "#43A047", Bottom: "#1565C0", Hair: "#3E2723" }, lines: [
        "Are we there yet? Are YOU there yet?",
        "I'm not bored. I'm just DONE with life.",
        "The vending machine ate my dollar. I'm in mourning.",
        "Your car is pink! My mom's car is beige. Beige like SADNESS.",
    ] },
    tourist: { name: "Lost tourist", key: "npcMan", colors: { Top: "#FFB300", Bottom: "#5D4037", Hair: "#D7B56D" }, lines: [
        "Excuse me, which way to the Statue of Liberty? …That way? Through LAKEWOOD?",
        "In my country, rest stops have SAUNAS. Here they have… whatever that smell is.",
        "I asked for a 'bagel with a schmear.' They gave me a pretzel and a look.",
        "Photo? Yes! With the pink car! Say 'traffic'!",
    ] },
    bubbe: { name: "Somebody's Bubbe", key: "npcWoman", colors: { Top: "#7E57C2", Bottom: "#455A64", Hair: "#E0E0E0" }, lines: [
        "You're too thin. Here — a hard-boiled egg. I travel with eggs. Don't ask.",
        "In my day rest stops had REST. Now they have WiFi.",
        "You're single? My grandson is a doctor. Well. He's studying. Well. He's thinking about it.",
        "Drive safe, mamele. Call your mother. She worries. I can tell. All mothers worry.",
    ] },
    teen: { name: "Teen on a phone", key: "npcWoman", colors: { Top: "#26C6DA", Bottom: "#212121", Hair: "#6D4C41" }, lines: [
        "Sorry, I'm live. Say hi to my eleven followers.",
        "This rest stop has, like, zero bars. I'm literally in the wilderness.",
        "Omg your car is SO aesthetic. Can I post it? Already did.",
    ] },
    mechanic: { name: "Mendel (mechanic)", key: "npcMan", colors: { Top: "#546E7A", Bottom: "#263238", Hair: "#212121" }, lines: [
        "Drive into the bay and stop. Twenty coins, all the dents out. Cheaper than therapy.",
        "I've seen worse. Not MUCH worse. But worse.",
        "Mufflers, dents, regrets. I fix two of the three.",
    ] },
    souvenir: { name: "Souvenir lady", key: "npcWoman", colors: { Top: "#F06292", Bottom: "#4E342E", Hair: "#BDBDBD" }, lines: [] },
    pump: { name: "Pump jockey", key: "npcMan", colors: { Top: "#1565C0", Bottom: "#37474F", Hair: "#3E2723" }, lines: [
        "Drive under the canopy and stop. Ten coins, tank's full. Nitro's the good stuff.",
        "Don't smoke near the pumps. Don't VAPE near the pumps. Don't KVETCH near the pumps.",
    ] },
    walker: { name: "Dog walker", key: "npcMan", colors: { Top: "#8D6E63", Bottom: "#33691E", Hair: "#5D4037" }, lines: [] },
};
export const LULU_REPLY = ["Ha! Same.", "Love that for you.", "Okay, that's actually so real.", "Noted. Leaving now.", "Safe travels!", "…Wow. Okay."];
