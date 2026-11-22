// features/cityhall — the words and the numbers. Cartoon, wholesome + silly (12+). No real politicians, no real parties,
// no real-world politics: the mayors are made up and every issue is a LOCAL, absurd one.

export const ID = "cityhall";

/** Per town: the building, its mayor, the colours. */
export const TOWNS = {
    lakewood: {
        name: "Lakewood City Hall", short: "city hall",
        title: "🏛️ LAKEWOOD CITY HALL", tagline: "Please take a number",
        sign: ["LAKEWOOD CITY HALL", "permits · taxes · complaints · ribbons"],
        signBg: "#F7F3EA", signFg: ["#1F2D63", "#6D4C41"],
        tints: { Walls: "#E9DFC9", Trim: "#FBF8F0", Roof: "#5D6B78", Accent: "#1F2D63" },
        mayor: {
            name: "Mayor Fishel Kugelman", short: "Mayor Kugelman", emoji: "🎩",
            colors: { Top: "#263238", Bottom: "#212121", Hair: "#9E9E9E" },
        },
        secretary: { name: "Mrs. Tziporah Gold", colors: { Top: "#7E57C2", Bottom: "#37474F", Hair: "#4E342E" } },
    },
    midwood: {
        name: "Midwood Borough Hall", short: "borough hall",
        title: "🏛️ MIDWOOD BOROUGH HALL", tagline: "Now serving: 37",
        sign: ["MIDWOOD BOROUGH HALL", "est. whenever · now serving 37"],
        signBg: "#1B3A2B", signFg: ["#E8C766", "#F5F1E6"],
        tints: { Walls: "#C9B9A0", Trim: "#EDE6D8", Roof: "#3F6B4F", Accent: "#1B3A2B" },
        mayor: {
            name: "Mayor Hershel Pickleman", short: "Mayor Pickleman", emoji: "🥒",
            colors: { Top: "#3E4A3D", Bottom: "#1B1B1B", Hair: "#5D4037" },
        },
        secretary: { name: "Mrs. Rivky Fein", colors: { Top: "#00897B", Bottom: "#263238", Hair: "#212121" } },
    },
};

/** Lulu walking past the building (once a visit, a light bubble). */
export const PASS = [
    "City hall. Where forms go to have more forms.",
    "The clock on the tower says ten to five. It always says ten to five.",
    "There's a statue of the mayor out front. The mayor paid for it. The mayor unveiled it.",
    "I could pay my parking tickets in there. Or I could keep walking. Keep walking.",
];

// ── the lobby ──
export const TICKET = {
    nowServing: 37,
    pulls: [
        "You're number {n}. They're on 37.",
        "Number {n}. The sign still says 37.",
        "Number {n}. A man next to you says he's been 38 since Chanukah.",
        "Number {n}. The machine also gives you a little paper cut.",
    ],
    tooMany: "The machine is out of paper. It blames you.",
};
export const WINDOWS = [
    { id: "permits", label: "PERMITS", emoji: "📝" },
    { id: "taxes", label: "TAXES", emoji: "💰" },
    { id: "complaints", label: "COMPLAINTS", emoji: "📣" },
];
export const CLOSED = [
    "The sign says BACK IN 5 MINUTES. The sign is very dusty.",
    "BACK IN 5 MINUTES. Someone wrote 'since 2009' under it.",
    "You knock. A voice says 'five minutes'. Nobody's there.",
];
export const CLERKS = {
    permits: [
        "Permits! What would you like to do? Wait — don't tell me. You need a permit to ask.",
        "Form 14-C is for porches. 14-D is for porches that WANT to be decks.",
        "Want to paint your door? Permit. Change the colour back? Second permit.",
        "We stamp. It's what we do. *stamp*",
    ],
    taxes: [
        "Taxes window. No, you can't pay in kugel. We asked.",
        "If you owned a home, I'd have a bill for you. You'd love it.",
        "We take coins, coins, or coins. Exact change is appreciated.",
        "The mayor says taxes are LOW. The mayor doesn't pay them.",
    ],
    complaints: [
        "Complaints. Take a form. Write small, we're running out of paper.",
        "Your complaint goes in the box. The box goes to the mayor. The mayor goes to lunch.",
        "Is it about the geese? It's always about the geese.",
        "We get a lot of complaints about the complaints window. I file those too.",
    ],
};
/** "📣 File a complaint" → the options + what the clerk says back. */
export const COMPLAINTS = [
    { opt: "🪿 The geese", reply: "The geese. Yes. Number 4,112 this year. The geese have a lawyer now." },
    { opt: "🚗 Double parking", reply: "Double parking! Noted. The man who takes these notes is double-parked right now." },
    { opt: "🕳️ The pothole on my street", reply: "The mayor cut a ribbon for that pothole. It's an official pothole now." },
    { opt: "📢 This window", reply: "A complaint about Complaints. I'll file it under 'brave'." },
];
export const BOARD = {
    lakewood: [
        "📌 NOTICE: The geese on Lake Dr are NOT to be fed. The geese have been told.",
        "📌 Ribbon cutting Tuesday: the new bench outside the bakery. Bring scissors (we lost ours).",
        "📌 Lost: one minivan, silver. Last seen: everywhere.",
        "📌 Town meeting moved to Thursday. Then Wednesday. Then nobody knows.",
        "📌 Reminder: the Kugel Ordinance is a real thing. Ask at the Taxes window.",
    ],
    midwood: [
        "📌 Alternate-side parking: Tuesdays and Fridays. And some Mondays. Good luck.",
        "📌 Mayor Pickleman's office hours: 9 to 9:15.",
        "📌 FOUND: a stroller on Avenue J. It's a double. It's huge. Please collect it.",
        "📌 The Q train is late. This is not news. This is a lifestyle.",
        "📌 Pizza tasting committee seeks volunteers. Many volunteers. Very many.",
    ],
};
/** The people waiting on the benches (two per visit). */
export const WAITING = [
    { name: "A man holding ticket 38", line: "Thirty-eight. Since Chanukah. I've made friends here. I've LOST friends here.", colors: { Top: "#5C6BC0" } },
    { name: "A lady knitting", line: "I'm on my third scarf. The line is on its first person.", colors: { Top: "#EF9A9A" } },
    { name: "A man with a folder", line: "I need a permit to apply for a permit. This folder is the application for the application.", colors: { Top: "#8D6E63" } },
    { name: "A bubbe with a thermos", line: "I brought soup. I'm not sharing. I'm here till Pesach.", colors: { Top: "#AB47BC" } },
];
export const SECRETARY = [
    "The mayor is VERY busy. He's in there. Being busy.",
    "Do you have an appointment? Nobody does. Go on in.",
    "If he offers you a pen with his name on it, take it. He has nine thousand.",
    "He's practising his ribbon cutting. Knock first.",
];
export const OUT_CUTTING = "The mayor's out. Ribbon cutting. He'll be back when the ribbon's cut.";

// ── the mayors ──
export const MAYOR = {
    lakewood: {
        hello: ["Ah! A voter! Or a future voter. Or a friend of a voter. Welcome!", "Fishel Kugelman. Mayor. Ribbon cutter. You've seen my statue?"],
        done: [
            "What have I done for this town? I cut the ribbon on the new pothole on Route 9. A beautiful pothole.",
            "I opened a bench. A BENCH. People sit on it every day. You're welcome.",
            "I named a speed bump after my mother. She's very proud. She drives around it.",
        ],
        selfie: "A selfie? Wait — my good side. That's the other side. Hold on. *turns* Perfect.",
        bye: ["Remember: Kugelman! It's like kugel, but a man!", "Tell your friends. Tell your friends' friends. Mostly tell their parents."],
        poster: ["RE-ELECT", "MAYOR KUGELMAN", "He cut it. He'll cut it again."],
    },
    midwood: {
        hello: ["Hershel Pickleman. Mayor of Midwood. Nobody else ran, so — mayor!", "Come in, come in! I just got back from the bakery. Official business."],
        done: [
            "What have I done? I held a press conference at the bakery. Very important. Very crumbly.",
            "I put up a sign saying DON'T BLOCK THE BOX. Then I put up nine more. Very clear now.",
            "Midwood is the second-best town on this road. I want to make it the first-best. Somehow.",
        ],
        selfie: "A selfie! Get the posters in the back. All of them. There. History.",
        bye: ["Vote Pickleman! You can't, there's no election. But in spirit!", "Grab a pickle on your way out. They're in the jar. They're for voters."],
        poster: ["MAYOR PICKLEMAN", "IS WORKING FOR YOU", "(he's at the bakery)"],
    },
};

// ── ribbon cuttings out in town (ribbon.js) ──
/** What the mayor is opening today (absurd, tiny, local). */
export const RIBBONS = {
    lakewood: [
        { what: "the new pothole", speech: "This pothole will serve our town for many years!" },
        { what: "a bench", speech: "A bench! For sitting! On! Today we sit as one!" },
        { what: "a speed bump", speech: "I name this speed bump… Bump Kugelman!" },
        { what: "a parking meter", speech: "A meter! Feed it coins! It is always hungry, like our town!" },
    ],
    midwood: [
        { what: "a new trash can", speech: "This trash can will hold so much trash. Midwood trash!" },
        { what: "a fire hydrant", speech: "A hydrant! Do not park here. Everyone will park here. It's tradition." },
        { what: "a crosswalk", speech: "Stripes! White ones! Walk on them, Midwood! Walk proud!" },
        { what: "a bike rack", speech: "A bike rack! Nobody has a bike. But if you DID…" },
    ],
};
export const RIBBON_CROWD = ["👏", "Mazel tov!", "Speech!", "*polite clapping*", "Is there food?", "Is that it?"];
export const RIBBON_LULU = [
    "He's cutting a ribbon for a pothole. Our tax money at work.",
    "Is that… the mayor? Opening a trash can? Iconic.",
    "Somebody give that man smaller scissors.",
];
export const RIBBON_HELP = {
    ask: "You! Young lady! Hold the other end of the ribbon! For the town!",
    opts: ["🎀 Hold the ribbon", "📸 Take a photo", "🚶‍♀️ Keep walking"],
    held: "*SNIP* — and the crowd goes mild!",
    photo: "Got it. The mayor, mid-snip, eyes closed. Perfect.",
    walk: "She keeps walking. The mayor cuts it himself. With some difficulty.",
};
/** Timing: one ribbon cutting at most every `gap` s on foot in town, ≤ perRun a run. */
export const RIBBON_TUNE = { gap: [150, 260], firstAfter: 45, perRun: 2, near: [22, 40], life: 40 };

// ── stage 2: property tax, silly fees, the lien (tax.js, fees.js) ────────────────────────────────────────────────
// A GENTLE coin sink: billed only on days she actually plays, never taken by itself (she pays at the Taxes window or
// from the 📞 Phone), never below 0, never takes a home away (real estate's Abandoned Kugel Ordinance is the only thing
// that touches ownership). Unpaid bills only get letters, a silly lien notice and — if she likes — a day in court.
export const TAX = {
    rate: 0.002,          // of a home's value, per played day (a 7,000 rowhouse ≈ 14 · a 16,000 house ≈ 32)
    dayCap: 50,           // at most this much tax a played day across ALL her homes (scaled down to fit)
    owedCapDays: 7,       // unpaid tax stops growing at this many days' worth (the town gets bored)
    letterAt: 3,          // played days a tax bill can sit unpaid before the stern letter
    lienAt: 6,            // … before the lien notice (+ the lien fee below, and a case in Courtroom 2B)
    lienFee: 10,          // "lien processing" (a silly fee on the lien; the court can waive it)
};
/** Silly fees: tiny, jokes, at most FEE_CAP a real day in total, mailed to the 📱 inbox quietly. Unpaid ones simply expire
 *  after `expire` played days ("the city lost the paperwork") — no letters, no lien, nothing else. */
export const FEE_CAP = 10;
export const FEES = {
    honk: { what: "🔊 Loud-honk surcharge", amount: 2, why: "We counted six honks in thirty seconds. That's a lot of honk." },
    hydrant: { what: "🚒 Parking near a hydrant (in spirit)", amount: 3, why: "There was no hydrant. But there COULD have been." },
    porch: { what: "🪑 Porch-sitting licence", amount: 3, why: "You own a porch. Sitting on it requires a licence. You're welcome." },
    complaint: { what: "📣 Complaint filing fee", amount: 1, why: "Your complaint has been received. So has this fee." },
};
export const FEE_TUNE = { expire: 7, honkN: 6, honkWindow: 30, hydrantChance: 0.3, porchChance: 0.4 };
export const TAX_LINES = {
    from: "City Hall", emoji: "🏛️", color: "#455A64",
    bill: (n, homes) => `Your property tax for today: ${n} coins for ${homes === 1 ? "your home" : homes + " homes"}. Pay at the Taxes window, or in 📞 Phone › City Hall.`,
    fee: f => `${f.what}: ${f.amount} coins. ${f.why}`,
    letter: n => `A STERN LETTER. You owe ${n} coins in property tax. Please pay soon. We're not angry. We're disappointed.`,
    lien: (n, fee) => `LIEN NOTICE. You owe ${n} coins, so the town has put a lien on your mailbox flag. Lien processing: ${fee} coins. You can pay, or fight it in Courtroom 2B.`,
    paid: n => `Thank you! ${n} coins received. The mayor will spend it wisely. (He won't.)`,
    lifted: "Good news: the lien on your mailbox flag is lifted. The flag may go up again.",
    expired: "We lost the paperwork on some of your fees. Consider them forgiven. Please don't tell anyone.",
};
/** The Taxes window (and the phone contact) when there's something to pay. */
export const TAX_WINDOW = {
    nothing: ["You don't owe the town a thing! That's rare. I'm going to frame this moment.", "All paid up. Go enjoy your town. It's partly yours now."],
    owe: (n, k) => `You owe ${n} coins — ${k} ${k === 1 ? "bill" : "bills"}. Would you like to pay?`,
    payAll: n => `💰 Pay it all — ${n} 💰`,
    payPart: n => `💰 Pay what I can — ${n} 💰`,
    confirm: n => `✍️ Pay — ${n} 💰`,
    list: "📋 What are these for?",
    later: "‹ Not today",
    broke: "You can't cover even one bill right now. That's okay. The town will wait. The town is very patient. Mostly.",
    done: ["*stamp* PAID. Look at you. A model citizen.", "*stamp stamp* Done! The stamp is my favourite part."],
};
/** ⚖️ Fighting the lien in Courtroom 2B (one hearing; won = the lien fee waived + the lien lifted; lost = pay the bills
 *  now — only as much as she has). */
export const LIEN_COURT = {
    counsel: { name: "THE TOWN ATTORNEY", emoji: "📁", color: "#455A64" },
    open: "Case number 412: The Town versus Lulu. The matter of the mailbox-flag lien.",
    town: ["Your honour, the defendant owes property tax. We have a spreadsheet. It has COLOURS.", "Your honour, the town needs this money. The mayor has ribbons to buy."],
    judgeAsk: "Young lady. What do you have to say about this lien?",
    defence: [
        { label: "📬 \"A lien on my mailbox FLAG? Is that even a thing?\"", judge: "…I'll be honest. I had to look it up." },
        { label: "🥧 \"I'll pay. I was busy. I brought kugel.\"", judge: "The court does not accept kugel. The court would like to see the kugel." },
        { label: "🧾 \"The city lost my paperwork. Twice.\"", judge: "That does sound like the city." },
    ],
    won: "Lien LIFTED, and the lien fee waived. Pay your tax when you can. Next case!",
    lost: (n, all) => `The lien stands. The defendant pays ${n} coins today${all ? "" : " — what she has — and the rest when she can"}. Next case!`,
    nothing: "There's nothing to rule on. The lien has been paid. Why are we all here? Go home, everybody.",
    docket: "📋 NOW: The Town v. Lulu — the mailbox-flag lien",
    label: "⚖️ Fight the lien on your mailbox flag",
    win: 0.5,
};
export const CONTACT = { name: "City Hall", tag: "property tax · fees · pay here" };
