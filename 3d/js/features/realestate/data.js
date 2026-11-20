// features/realestate — the numbers and the words. EVERY price / cap / fee lives here (tune freely).
// Cartoon, wholesome + silly (12+). Nothing here is real estate advice. 😇

// ── what a home costs ────────────────────────────────────────────────────
// (a player earns roughly 1,000–2,000 coins in a 30–45 minute session: a first home in cash ≈ a week or two of play;
//  with a mortgage she can move in after a day or two. Cars cost 150–2,500, decorating 500–1,800.)
/** Base price of ONE front door (one home), by the house model it's in. */
export const BASE = {
    town_mw_rowhouse: { price: 7000, kind: "rowhouse", label: "rowhouse", rooms: 2, blurb: "a cozy Brooklyn rowhouse" },
    town_townhouses: { price: 9000, kind: "townhouse", label: "townhouse", rooms: 2, blurb: "a townhouse with a shared wall (and shared opinions)" },
    town_duplex: { price: 11000, kind: "duplex", label: "duplex half", rooms: 3, blurb: "half a duplex — the GOOD half" },
    town_mw_house: { price: 16000, kind: "house", label: "detached house", rooms: 3, blurb: "a whole house. Walls on every side. Yours." },
};
/** Street adjustments (by the street the front door faces) — × price, with the realtor's spin on it. */
export const STREETS = {
    // Lakewood
    "Lake Dr": { f: 1.4, spin: "Lake views! If you stand on a chair. On the roof." },
    "Forest Ave": { f: 1.2, spin: "Forest Ave. Trees. Prestige. A squirrel who's been here longer than the house." },
    "Route 9": { f: 0.85, spin: "Route 9 — you'll never miss a bus. You'll HEAR every bus. Convenient!" },
    "County Line Rd": { f: 0.9, spin: "County Line Road. Practically two towns for the price of one." },
    "Main St": { f: 0.95, spin: "Main Street! Walk to everything. Everything walks past you. Vibrant!" },
    // Midwood
    "Ocean Pkwy": { f: 1.6, spin: "OCEAN PARKWAY. Say it slowly. Ocean… Parkway. That's the sound of prestige." },
    "Ocean Ave": { f: 1.1, spin: "Ocean Avenue — pre-war charm. Which war? Does it matter? CHARM." },
    "Kings Hwy": { f: 0.85, spin: "Kings Highway! Royal name. Royal traffic. Royal… honking." },
    "Coney Island Ave": { f: 0.9, spin: "Coney Island Ave. Steps from everything. Also, the everything is loud." },
    "Avenue J": { f: 1.05, spin: "Avenue J. Pizza on the corner. Need I say more? I need not." },
};
/** Next to the B/Q embankment (Midwood, |x − rail| < 40 m local): × this. */
export const NEAR_TRAIN = { f: 0.8, spin: "The Q train goes by every 8 minutes. It's like a lullaby. A LOUD lullaby. You get used to it! (You don't.)" };
/** Within 45 m of the precinct / courthouse: × this. */
export const NEAR_COPS = { f: 0.9, spin: "The precinct's right there. VERY safe block. Very… observed." };
/** The neighbours (a per-house hash: ~1 in 3 houses has one) — × price + the realtor's line. */
export const NEIGHBOURS = [
    { id: "drummer", f: 0.9, line: "The neighbour plays the drums. Only on weekdays. And weekends. He's VERY dedicated." },
    { id: "kugel", f: 1.1, line: "Next door: Mrs. Rosenbaum. Her kugel won a ribbon. She brings it over. UNPROMPTED." },
    { id: "rooster", f: 0.92, line: "The neighbours have a rooster. In Brooklyn. Nobody knows how. Alarm clock included!" },
    { id: "rebbetzin", f: 1.08, line: "The Rebbetzin lives across the street. Your Shabbos guests are basically guaranteed." },
    { id: "gnomes", f: 0.95, line: "The house next door has 112 lawn gnomes. They're part of the community now." },
    { id: "chef", f: 1.12, line: "Your neighbour is a CATERER. Leftovers every Sunday. Trust me. TRUST me." },
    { id: "kids", f: 0.94, line: "Eleven kids next door. Never a dull moment. Never a quiet one either." },
];
export const ROUND = 50;                  // prices round to this

// ── the market ───────────────────────────────────────────────────────────
export const MARKET = {
    perTown: 7,           // about this many homes are for sale in a town on any real day
    listDays: 4,          // a listing stays up this many real days (staggered per house)
    // today's value = price × (1 + drift × wave(day)): the value of a house never moves more than ±drift, so the
    // highest is at most (1 + drift) / (1 − drift) ≈ 7.3 % over the lowest (+ the rounding to 50) — and selling costs
    // SALE.fee (10 %): buy-then-sell ALWAYS loses at least ~3 % (no arbitrage loop).
    drift: 0.035,
    period: 23,           // real days for a full swing
};
/** Selling back through the realtor (stage 3): today's value − this share ("my commission, the lawyer, the lawyer's lawyer"). */
export const SALE = { fee: 0.10 };
/** The most buildings one player may own (the owner's number). */
export const CAP = 10;

// ── the mortgage (stage 2; the bank's mortgage desk) ─────────────────────
export const MORTGAGE = {
    minDown: 0.20,                                   // at least 20 % down
    terms: [{ days: 10, fee: 0.05 }, { days: 20, fee: 0.10 }, { days: 30, fee: 0.15 }],   // played days · the bank's flat fee on the loan
    // missed PLAYED days in a row: 1 → a stern letter, 2 → the realtor's "we should talk", 3 → a friendly foreclosure
    missLetter: 1, missTalk: 2, missForeclose: 3,
    // foreclosure: she gets back whichever is MORE — what the house sells for after the bank is paid, or this share of
    // everything she paid in (down payment + payments)
    forecloseRefund: 0.5,
    earlyDiscount: 0.5,                              // paying off early skips half of the bank's remaining fee
};

// ── rent (stage 3) ───────────────────────────────────────────────────────
export const RENT = {
    share: 0.01,          // a tenant pays 1 % of the house's value per PLAYED day…
    dayCap: 150,          // …but ALL her houses together pay at most this per played day
    pileDays: 3,          // uncollected rent piles up in the mailbox for at most this many days' worth
};

// ── the realtors (one per town) ──────────────────────────────────────────
export const REALTORS = {
    lakewood: {
        name: "Shprintzy Gold", firm: "Gold Standard Realty", emoji: "👩‍💼",
        sign: ["GOLD STANDARD REALTY", "Shprintzy Gold · we sell COZY · se habla Yiddish"],
        colors: { Top: "#C2185B", Bottom: "#37474F", Hair: "#4E342E" },
        signBg: "#3E2723", signFg: ["#FFD54F", "#FFF3E0"],
    },
    midwood: {
        name: "Mendel Brick", firm: "Brick by Brick Realty", emoji: "🧑‍💼",
        sign: ["BRICK BY BRICK REALTY", "Mendel Brick · up-and-coming since 1962"],
        colors: { Top: "#1565C0", Bottom: "#263238", Hair: "#212121" },
        signBg: "#1B3A2B", signFg: ["#FFFFFF", "#C8E6C9"],
    },
};
/** The yard sign on every listed house (the board's canvas, per town). */
export const YARD = {
    lakewood: { lines: ["FOR SALE", "Gold Standard Realty"], bg: "#FFFFFF", fg: ["#C62828", "#3E2723"], band: "#C2185B" },
    midwood: { lines: ["FOR SALE", "Brick by Brick Realty"], bg: "#FFFFFF", fg: ["#C62828", "#1B3A2B"], band: "#1565C0" },
};

// ── the patter ───────────────────────────────────────────────────────────
/** What a realtor says about a home of each size (she oversells). "Cozy" means tiny. */
export const PITCH = {
    rowhouse: [
        "Cozy! It's COZY. You can reach the fridge from the bed. That's called efficiency.",
        "Intimate. Charming. Compact. Those are three words for small, and I'm using all of them.",
        "Open plan! The kitchen is the living room is the bedroom. Very modern. Very… one room.",
    ],
    townhouse: [
        "A townhouse! You share a wall with the neighbours. Free heating. Free gossip.",
        "Two whole floors. The stairs are a feature. A cardio feature.",
        "Look at this light! There's a window. There's ANOTHER window. I'm getting emotional.",
    ],
    duplex: [
        "Half a duplex — but the BETTER half. The other half knows it. They're jealous.",
        "A deck! Sukkah-ready! Do you know how rare a sukkah-ready deck is? I'll tell you: very.",
        "Three rooms! One for you, one for your stuff, one for your OTHER stuff.",
    ],
    house: [
        "A WHOLE house. No shared walls. You could practice the shofar at 3 a.m. Don't. But you COULD.",
        "Detached! Like a very calm person. This house has inner peace.",
        "A front yard, a back yard, and a side yard. That's three yards. That's a lot of yard.",
    ],
};
/** General realtor filler — the up-and-coming block, the motivated sellers, the "character". */
export const PATTER = [
    "This block? Up-and-coming. It's been up-and-coming since 1962. Any day now it'll ARRIVE.",
    "The sellers are MOTIVATED. Very motivated. They've already moved to Monsey. Emotionally.",
    "It has character! The character is mostly in the plumbing.",
    "Needs a little TLC. Mostly the T. Some of the L. Not much C.",
    "Between you and me? There's another offer. From my cousin. He has no money. But STILL.",
    "Walking distance to shul, the pizza store AND the bakery. That's the holy trinity, sweetheart.",
    "The basement is finished! Well. It's ended. That's a kind of finished.",
    "Original fixtures! From the original… sometime.",
];
/** Walking her through a viewing (a line per room). */
export const VIEWING = {
    hello: [
        "You must be Lulu! I've heard SO much. Mostly from the police scanner. Come, come!",
        "Lulu! Darling! Shoes on, shoes off, whatever — just come SEE.",
        "You came! Perfect timing. The sun hits the house JUST right at… whatever time it is now.",
    ],
    living: [
        "The living room! Picture it: you, a couch, guests who never leave. PARADISE.",
        "Look at these floors. Real wood! Or a very convincing photo of wood.",
    ],
    kitchen: [
        "The kitchen! Two sinks. Milchig, fleishig — and the third one's for PAREVE. Kidding. There's no third one.",
        "A stove! With knobs! Most of them work!",
    ],
    bedroom: [
        "The bedroom. Fits a bed! A small bed. A bed-adjacent object.",
        "Closet space! Enough for one season. Pick a season.",
    ],
    close: [
        "So? Can you see yourself here? I can see you here. I can see you SIGNING here.",
        "It won't last. Nothing lasts! Except the forms. The forms last forever.",
    ],
};
/** The office: the realtor at her desk. */
export const OFFICE = {
    hello: [
        "Welcome, welcome! Sit, sit! Not THAT chair, that chair's for clients who already signed.",
        "Lulu! Looking for a place? A starter home? A forever home? A 'my parents can't find me' home?",
        "Come in! Coffee? We have coffee. We have a coffee MACHINE. It's mostly decorative.",
    ],
    talk: [
        "Everything on the board is a gem. Some gems are… cozier than others.",
        "Location, location, location. Also: price. Also: does the oven work. But mostly location.",
        "You want a mortgage? Talk to the bank. They LOVE paperwork. They have a whole floor of it.",
        "I sold a house on Lake Drive yesterday. The buyer cried. Happy tears. Mostly.",
        "My commission? Don't worry about my commission. I'll worry about my commission.",
        "Real estate is about TRUST, Lulu. Now trust me: buy the one with the yellow door.",
    ],
    owns: [
        "My favourite client! How's the house? Still standing? Wonderful. That's what we promised.",
        "A homeowner! Look at you. All grown up. With a MAILBOX.",
    ],
    capped: "TEN houses?! Lulu. Sweetheart. Even I don't own ten houses. That's the limit — the town clerk would have a heart attack.",
    broke: "Not quite enough coins for this one, sweetheart. Keep driving, keep saving — or the bank's got a mortgage desk!",
    party: "Business is a solo thing for now, sweetheart — come back when it's just us.",
};
/** Buying: the paperwork comedy (stage 1 = cash; stage 2 adds the bank's forty signatures). */
export const SIGNING = [
    "Initial here. And here. And here. And here. And… I'll tell you when to stop.",
    "Sign here, here, and — no, that's my lunch order. Here.",
    "This one says you promise not to paint the house purple. It's a formality. Don't paint it purple.",
];
export const SOLD = [
    "MAZEL TOV! It's yours! Here are your keys. Don't lose them. I have a guy, but he's expensive.",
    "SOLD! To the lovely young lady with the pink car! Here — keys! Mailbox key! A spare! A spare for the spare!",
    "Done! A homeowner! Your mother is going to CRY. Go call her. No — sign this first. NOW go call her.",
];
/** Her own house: Lulu's lines at the door / inside. */
export const MINE = {
    door: ["My house. MY house. I'm never going to get tired of saying that.", "Home sweet second home. 🏠", "Hi house! It's me! Your owner!"],
    inside: ["It echoes! Because it's MINE and EMPTY. I love it.", "This is where the couch goes. When I have a couch.", "I could get a cat. I'm not going to. But I COULD."],
};
/** Lulu walking past a FOR SALE sign (once a visit, sometimes). */
export const PASS_SIGN = [
    "A house for sale… I could be a HOMEOWNER. A home-owning adult. Ugh. Exciting!",
    "'Cozy.' That means tiny. I know realtor talk now.",
    "For sale! I wonder if it has a two-car driveway. For my one car. And my dreams.",
];

// ── the bank's mortgage desk (stage 2) ───────────────────────────────────
export const BANKERS = {
    lakewood: { name: "Mr. Pinkus", title: "Loan Officer (and Notary, and Assistant Notary)", emoji: "👨‍💼", key: "npcMan",
        colors: { Top: "#37474F", Bottom: "#263238", Hair: "#BDBDBD" }, bank: "First Minivan Bank" },
    midwood: { name: "Mrs. Teitelbaum", title: "Senior Mortgage Specialist, 41 years", emoji: "👩‍💼", key: "npcWoman",
        colors: { Top: "#4A148C", Bottom: "#212121", Hair: "#9E9E9E" }, bank: "Kings County Savings & Bagel" },
};
export const BANK_LINES = {
    hello: [
        "A MORTGAGE? Sit, sit. Do you have a pen? Do you have forty pens? You'll need forty pens.",
        "Welcome to the mortgage desk. The line is short because nobody can find it. You found it! Already you qualify.",
        "Ah, a future homeowner. I can always tell. It's the look of someone about to sign a LOT of things.",
    ],
    paper: [
        "Initial here. And here. Here. Here, here, here… and a blood sample. Kidding! (Not kidding. Kidding.)",
        "This form says you've read this form. This one says you've read THAT one. It's forms all the way down.",
        "Sign here, date here, and here you write your mother's maiden name, your favourite kugel, and a haiku.",
        "Form 27-B: 'I understand that the bank is not responsible for the neighbour's rooster.' Sign.",
    ],
    terms: "The bank takes your payment by itself, ONCE a day — only on days you play. Days you don't play? Nothing. We wait. We're patient. We're a bank.",
    done: [
        "MAZEL TOV! You're a homeowner AND a borrower. Two words that make a mother very proud and very nervous.",
        "Done! Here's your copy. And your copy of the copy. Don't lose them. We won't make new ones. (We will. It takes six weeks.)",
    ],
    paidOff: [
        "PAID OFF! Free and clear! The house is ALL yours! I'm stamping it. *STAMP*. That's the best sound in banking.",
        "Paid in full! You know how rare that is? I'm going to tell my wife about you.",
    ],
    nothing: "You don't owe us a thing. Enjoy it. It won't last — nothing at a bank does. (Joke! Bank joke.)",
    broke: "For a down payment we need the coins up front, sweetheart. Save up a little and come back — the forms will still be here. They're ALWAYS here.",
    noList: "No homes for sale here today! Ask the realtor — the listings change every day.",
    party: "Mortgages are a one-on-one thing, dear. Come back when it's just you.",
};
/** The bank's texts (📱 Messages, thread "bank"): payments, the letters, the foreclosure. */
export const BANK_TEXTS = {
    paid: (n, of, amt, left) => `Payment ${n} of ${of} received: ${amt} coins. ${left > 0 ? `${left} to go!` : "That's the LAST one!"} 🏦`,
    letter: (addr, amt) => `Dear Valued Customer, we did not receive yesterday's payment of ${amt} coins for ${addr}. This is a STERN letter. Please feel sternly addressed. 📄`,
    talk: addr => `Lulu, it's Shprintzy. The bank called me about ${addr}. Two days missed. We should talk. Not a big talk. A medium talk. ☕`,
    foreclose: (addr, back) => `We're sorry — after three missed days in a row, ${addr} goes back to the bank. Friendly foreclosure! You get back ${back} coins. We'll miss you. The forms won't. 🏦💔`,
    paidOff: addr => `${addr} is PAID OFF. Free and clear! Frame this text. 🏦🎉`,
};

// ── tenants (stage 3): the realtor finds one; rent piles up in that home's mailbox (RENT caps it) ──
export const TENANTS = [
    { name: "Shmerel", emoji: "🎺", key: "npcMan", colors: { Top: "#6D4C41" }, line: "Rent's in the mailbox! Also I practise the shofar at 6 a.m. For Elul. It's ALWAYS Elul for me.", lines: ["Is it okay if I keep a goat? A small one. A mini-goat.", "The faucet drips in G-sharp. I've been composing."] },
    { name: "Mrs. Feigenbaum", emoji: "👵", key: "npcWoman", colors: { Top: "#8E24AA", Hair: "#BDBDBD" }, line: "Your rent, darling. Exact change. In a kugel tin. Return the tin.", lines: ["You look thin. Sit. Eat. It's YOUR house, I'm just living in it.", "I re-arranged the kitchen. It's better now. Don't argue."] },
    { name: "a yeshiva bochur", emoji: "📚", key: "npcMan", colors: { Top: "#FAFAFA", Bottom: "#212121" }, line: "Rent! On time! Mostly! My mother made me.", lines: ["I only eat cereal. Is that a lease violation?", "The basement is PERFECT for learning. And for napping. Mostly napping."] },
    { name: "the Kleins (newlyweds)", emoji: "💍", key: "npcWoman", colors: { Top: "#F48FB1" }, line: "We LOVE it here! Here's the rent! And a thank-you card! And a second card thanking you for the first card!", lines: ["We painted the bathroom 'Blush Kugel'. Hope that's okay!", "Our sheva brachos are next week. In your living room. You're invited!"] },
    { name: "Dr. Gross (a dentist)", emoji: "🦷", key: "npcMan", colors: { Top: "#B3E5FC" }, line: "Rent. Also: you should floss. I can tell from here.", lines: ["Very quiet house. Excellent for teeth.", "I put a lollipop ban on the porch. For the neighbourhood's own good."] },
];
export const RENT_LINES = {
    found: (who, addr) => `Found you a tenant for ${addr}: ${who}! They move in tomorrow. Rent goes in the mailbox — go collect it, it doesn't walk itself over. 📬`,
    collect: (n) => `📬 Rent check: ${n} coins!`,
    empty: "📬 No rent yet — tenants pay once a day you play, into this mailbox.",
    out: "Done — the tenant's packing. They'll miss you. They'll miss the mini-goat more.",
};
export const SELL_LINES = {
    ask: "Selling? Already? Okay. I'll find a buyer. I ALWAYS find a buyer. It's a gift. And a curse.",
    done: [
        "SOLD! To a lovely family from Monsey. They cried. I cried. The house didn't cry, it's a house.",
        "SOLD! The buyer asked about the neighbours. I said 'they're FASCINATING'. Not a lie!",
    ],
    rule: "My fee is 10 %. Commission, the lawyer, the lawyer's lawyer, and a little something for the sign guy.",
};

// ── THE GOVERNMENT (stage 5/6; the knobs themselves live on the server: server/homes.mjs CONFIG) ──
export const COUNCIL = {
    from: "🏛️ The Town Council", fine: "Subject to change if the government decides differently.",
    seized: (addr, ord, days) => `NOTICE: by order of ${ord} (${days} days without a visit = "abandoned kugel"), ${addr} has been taken for the public good and is now a Municipal Kugel Storage Facility. You may contest this at the courthouse. Subject to change if the government decides differently. 🏛️`,
    lost: addr => `NOTICE: ${addr}, seized under the Abandoned Kugel Ordinance, has been returned to the market. You may still petition the court for compensation. Subject to change if the government decides differently. 🏛️`,
    amended: (ord, date) => `The Council has amended ${ord} (${date}). Please re-read your deed. You won't. Nobody does. 🏛️`,
    taken: by => `Oy — ${by || "someone"} JUST signed for that one. The whole world's buying in this town! Let's find you another.`,
    held: "That one's held by the Town Council right now — the Abandoned Kugel Ordinance. Don't ask. Nobody understands it. Not even the Council.",
    full: "The registry office says the town's full! (The Council is 'reviewing the situation'.)",
};
export const SEIZED_SIGN = { lines: ["SEIZED", "Municipal Kugel Storage"], bg: "#FFF8E1", fg: ["#B71C1C", "#37474F"], band: "#455A64" };
