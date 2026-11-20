// features/places — the words. Cartoon, wholesome + silly (12+). Nothing here pays coins.

/** Per town: what each building is called inside (the interiors' titles) + Lulu's first-sight line. */
export const NAMES = {
    lakewood: {
        precinct: { name: "Precinct 18½", title: "🚓 PRECINCT 18½ — POLICE", tagline: "You bend it, you mend it" },
        court: { name: "Lakewood Municipal Court", title: "⚖️ LAKEWOOD MUNICIPAL COURT — LOBBY", tagline: "Traffic court · Tuesdays · bring a sandwich" },
        hospital: { name: "St. Shloimy's", title: "🏥 ST. SHLOIMY'S — URGENT CARE", tagline: "please take a number (the number is 412)" },
    },
    midwood: {
        precinct: { name: "the 70½th Precinct", title: "🚓 70½TH PRECINCT — POLICE", tagline: "Courtesy · professionalism · parking" },
        court: { name: "Kings County-ish Civil Court", title: "⚖️ KINGS COUNTY-ISH CIVIL COURT — LOBBY", tagline: "small claims · big feelings" },
        hospital: { name: "Midwood General", title: "🏥 MIDWOOD GENERAL — URGENT CARE", tagline: "the wait IS the treatment" },
    },
};

/** Lulu walking past (a light bubble, once per building per visit). */
export const PASS = {
    precinct: ["Precinct. Keep walking. Act natural. 😇", "I know that desk cop. He knows me. We don't talk about it.", "Officer Pomerantz is eating a donut in there. I can FEEL it."],
    court: ["The courthouse. I've been. It was a whole thing.", "Justice is blind. The judge is just near-sighted.", "Columns. Very serious. Very 'you'll be hearing from us.'"],
    hospital: ["St. Somebody's. My second home, apparently.", "Nurse Tammy's on today. I can hear her from here.", "Free lollipops for brave kids. I'm brave. I'm a kid. Sort of."],
    impound: ["The impound. Where cars go to think about what they did.", "Every car in there has a story. Mostly double-parking."],
};

// ── the courthouse lobby (lobby.js) ──
export const CLERK = [
    "Clerk of Court. Take a number. The number is 'later'.",
    "Your case isn't on today's docket. Your NAME is, though. In pencil.",
    "Form 27-B goes with 27-A. Unless it's a Tuesday. Is it a Tuesday?",
    "We close at 4. It's 3:58. Talk fast.",
    "Jury duty? Bring a book. Bring two books. Bring a pillow.",
    "No, you can't 'just ask the judge real quick.'",
    "Stamp, stamp, stamp. That's the job. I love the job.",
    "Small claims is down the hall. Big claims are also down the hall. Same room.",
];
export const BAILIFF = [
    "Keys, phone, belt, coins, kugel — in the tray.",
    "*BEEP* ...that's your earrings. And possibly your attitude.",
    "No running in the courthouse. No skipping either. No twirling.",
    "Court's not in session, miss. Unless you're here to confess something?",
    "I've been a bailiff 22 years. I've seen things. Mostly sandwiches.",
    "The metal detector's been beeping since 1997. Nobody knows why.",
];
export const DOCKET = [
    "📋 9:00 — PEOPLE v. A GOOSE (failure to yield)",
    "📋 9:30 — The Double-Parking Hearings (all 340 of them)",
    "📋 10:00 — Shmulik v. Shmulik (both claim the chair spot)",
    "📋 11:00 — THE MINIVAN THAT WASN'T THERE (closed session)",
    "📋 1:00 — lunch (very long)",
    "📋 2:00 — People v. Mrs. Klein's Lawn Ornament",
    "📋 3:00 — whoever's still awake",
];
export const BENCH = [
    "I'm here for a parking ticket. I've been here since Pesach.",
    "My lawyer said 'wear something nice'. This IS nice.",
    "If they call 'Goldberg', wake me up. If they call 'Goldberg, M.' — let me sleep.",
    "Third time this month. The judge sends me a birthday card now.",
    "I'm not nervous. *sweats in kosher*",
];
export const DOORS = [
    "🔒 Locked. Court's not in session. (A sign says: 'ALL RISE — but not now.')",
    "🔒 You hear snoring through the door. That's either the jury or the judge.",
    "🔒 Locked. Someone left a kugel on the bench in there. You can smell it.",
];
export const FOUNTAIN = [
    "The water fountain gives exactly one sip, then thinks about it.",
    "Ice cold. Suspiciously cold. Like the judge's stare.",
    "*sip* ...tastes like due process.",
];
export const DETECTOR = [
    "You walk through. *BEEEEEP*. You walk back. *BEEEEEP*. It just likes you.",
    "*beep* — your bobby pins. All 47 of them.",
    "It beeps. The bailiff shrugs. Freedom!",
];
export const PORTRAIT = [
    "Judge Feldman, 1962–1989. Never once ran on time.",
    "A portrait of a judge looking disappointed. In ADVANCE.",
    "The plaque says 'Justice delayed is justice… hold on, I'll be right there.'",
];

// ── the impound gate (places/index.js) ──
export const IMPOUND_GATE = [
    "🚧 IMPOUND LOT. Authorized vehicles only. (The cruisers are authorized. You are not.)",
    "🚧 Through the slats: a minivan, a moped and a shopping cart with a parking ticket.",
];
export const IMPOUND_MINE = [
    "There's my car! Behind a FENCE. Like a zoo exhibit. 'The Pink Convertible, in captivity.' 😤",
    "My baby's in there. Hang on, sweetie — they'll let you out tomorrow. 🚗💕",
    "Impounded. They'll give it back at home. Ima's going to have WORDS. 🙄",
];
