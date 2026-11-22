// features/shul — the words. Warm and affectionate, written by someone who loves the place. The jokes are about PEOPLE
// (the seat-savers, the kiddush, the announcements, the hats) — never about davening, the Torah, the aron, G-d or
// anyone's observance. Nothing in here pays coins. 12+.

/** Per town: the door's spot name in the town build, what the place is called, and the line at the door. */
export const TOWNS = {
    lakewood: {
        spot: "yeshiva", name: "the Carpool Lane Shul", short: "the shul", title: "🕍 THE CARPOOL LANE SHUL",
        tagline: { weekday: "Mincha soon · we're one short", friday: "Erev Shabbos · setting up", davening: "Shabbos · shhh", kiddush: "Kiddush is open", afternoon: "A quiet Shabbos afternoon", fast: "An easy fast", yk: "G'mar chasima tova" },
    },
    midwood: {
        spot: "shul", name: "Young Israel of East 15½ Street", short: "the shul", title: "🕍 YOUNG ISRAEL OF EAST 15½ STREET",
        tagline: { weekday: "Mincha 4:12 · we need a tenth", friday: "Erev Shabbos · setting up", davening: "Shabbos · shhh", kiddush: "Kiddush is open", afternoon: "A quiet Shabbos afternoon", fast: "An easy fast", yk: "G'mar chasima tova" },
    },
};

/** Lulu walking past the front door (one light bubble per visit). */
export const PASS = [
    "A shul. Somewhere in there a man is counting to nine. Again.",
    "I can smell kugel from the sidewalk. That's either love or the vents.",
    "Every shul has a man by the door who knows everybody's business. And a candy.",
    "Shul's open. Ima says to walk in quietly. Ima has said that since I was four.",
];

/** Her first bubble inside, by what's happening. */
export const ENTER = {
    weekday: ["Women's side, this way. I know the drill.", "Smells like old books and coffee. Good smell."],
    friday: ["Friday! Everybody's running and nobody's sure why.", "Chairs, tables, kugels. Oh, it's one of THOSE Fridays."],
    davening: ["Shhh… everyone's davening. I'll stand quietly at the back.", "It's so peaceful in here. Even my sneakers are being quiet."],
    kiddush: ["I can hear kiddush from here. And the kugel debate.", "Smells like herring. That means they've started."],
    afternoon: ["Quiet in here. Nice."],
    fast: ["Quiet today. An easy fast to everyone.", "It's calm. Everyone's being gentle with each other."],
    yk: ["Everyone's in white. It's so quiet. I'll stand at the back."],
};

// ── people ──────────────────────────────────────────────────────────────
export const GABBAI = {
    weekday: [
        "Lulu! Don't walk away — you know any man who's free for mincha? ANY man? We're at nine. We've been at nine since Tuesday.",
        "Nine. We have nine. I counted twice. I counted the rav twice, it still doesn't work.",
        "I called the pizza store. The pizza guy said he'd come at 4:30. It is 4:41. He's a lovely man.",
        "I'm the gabbai. It means I run the shul, which means I run in circles. Same thing.",
        "A tenth walked in once, Lulu. In 2019. We threw him a party. He never came back.",
        "Mincha is in four minutes. Or eleven. Depends on the tenth.",
    ],
    friday: [
        "Friday! The whole shul's getting ready. Chairs, tables, a hundred kugels, one roll of tape. Guess which we're short of.",
        "I put out a chair for everyone who might come. Then everyone came. Now I'm hunting chairs.",
        "Candle lighting is in an hour, so the shul smells like floor polish and nerves.",
        "Everybody asks me 'what do you need help with?' and then goes home. Except you. You're still here. Hold this.",
    ],
    kiddush: [
        "Kiddush is open! Kichel on the left, herring in the middle, and the kugel — we'll get to the kugel.",
        "Everyone says the kiddush is 'just a little something.' There are four tables.",
        "Lulu, take a plate. Take TWO. They'll only go to the ones who say they're not hungry.",
    ],
    afternoon: ["Quiet afternoon. I'm the gabbai, I'm allowed to sit. For six minutes."],
    fast: ["Quiet today, Lulu. It's an easy fast. Come back tomorrow — the kichel will wait.", "We're a little slow today. That's allowed."],
};
export const GABBAI_AMBIENT = {
    weekday: ["Nine… still nine.", "Anyone? Anyone for a tenth?", "Eleven past. Ten to go. Er— one."],
    friday: ["Who has the tape??", "More chairs!", "Careful, careful — the kugels!"],
    kiddush: ["Plates are on the left!", "Take, take!"],
};

export const CANDY = {
    first: [
        "Come here, sweetheart. Cherry or grape? …Cherry. Good choice. Don't tell the kiddush club.",
        "One lollipop, for the girl with the pink car. Everyone knows the pink car.",
        "Your zaidy used to take the red ones. Here — for you. It's the same jar.",
    ],
    again: [
        "You already had yours today, sweetheart! Come back tomorrow — the jar's not going anywhere.",
        "One a day. Ima's rule and mine. I'm very consistent.",
        "I'd love to! But I've been told — okay, nobody told me, but I know your Ima would say no.",
    ],
    fast: ["Not today, sweetheart — it's a fast. Come back tomorrow, I'll save you the red one.", "Today the jar rests. Tomorrow, double. Well — single. One a day."],
    // (while people are davening he doesn't speak: a wink, a finger to his lips, and the lollipop)
    quiet: "🤫 …a wink, a finger to his lips — and a lollipop slides across the table.",
    quietAgain: "☝️ …he points at the jar, then holds up one finger. One a day. She nods.",
    thanks: ["Mmm. Best part of any shul. 😊", "Cherry. Obviously cherry. 🍭", "Okay. That made my whole day. 🍭"],
    thanksQuiet: ["(thank you!) 🍭", "(you're the best!) 🍭"],
};

export const REBBETZIN = {
    weekday: [
        "You're Ima's Lulu, aren't you? The one with the little sister. How is your mother? Tell her she still has my pan. She'll know which.",
        "I knew your mother when she was your age. She also thought she could parallel park.",
        "Come, sit, have a kichel. They're from the Thursday batch. They're from every Thursday batch.",
        "Your Ima says you drive carefully. I told her I believe her. I crossed my fingers, but I believe her.",
        "Make sure you eat something real. Not just a lollipop. I saw. I see everything. It's a skill.",
    ],
    friday: [
        "Five kugels for a hundred people. Don't ask me how. I don't ask either.",
        "Lulu! Your mother promised me her noodle one. Tell her I'm not mad. I'm just counting.",
    ],
    kiddush: [
        "Take a plate, sweetheart. Everyone's talking about everyone. It's lovely.",
        "Your mother's kugel is the only one that's ever been eaten completely. Don't tell the others.",
    ],
    afternoon: ["A quiet afternoon. Sit with me a minute, Lulu. Tell your Ima I said hello."],
    fast: ["It's an easy fast, sweetheart. Sit next to me. Drink later, not now. Hatzlacha.", "Be gentle with yourself today. That's all the advice I've got."],
    quiet: "💕 …she smiles, waves two fingers, and pats the seat beside her.",
};
export const REBBETZIN_AMBIENT = ["Your mother knows which pan.", "Kichel? There's kichel.", "Sit, sit."];

/** Through the lattice: the man saving seats (not while people are davening). */
export const SAVER = [
    "That bag's for my brother-in-law. And his sons. And a guest. And the guest's guest. It's fine, there's room.",
    "A tallis bag is a legally binding document, Lulu. In this shul. Since 1994.",
    "I'm not saving seats. I'm… holding space. Spiritually.",
    "Six seats. One bag. It's a system. Nobody's ever sat there. That's how you know it works.",
    "They'll come. They always say 'we'll come'. They'll come after kiddush.",
];
/** …and Lulu's own remark about him when he can't talk. */
export const SAVER_LULU = ["Six seats. One bag. The bag is the only one praying for a miracle.", "He's got a guard dog's posture and a tallis bag. Respect."];

export const KID = [
    "He's on lap forty. Nobody knows whose he is. Everybody has fed him.",
    "Every shul has one. In this shul it's him. He goes around the bimah like it's a racetrack — never the same way twice.",
    "He's got a lollipop in one hand and a plan in the other. Both of them are sticky.",
    "He just ran past three grandfathers. They each held out a candy. He took all three. Professional.",
];

export const KIDDUSH_CLUB = [
    "We're not a club. We're just a group of men who happen to love herring at the same time.",
    "Lulu! Try the kugel. Don't ask whose. Just try.",
    "Is it good? — It's… memorable.",
    "I'm only here for the kichel. And the herring. And the kugel. And the conversation.",
    "The herring was perfect this week. We checked. Several times. For accuracy.",
];
export const KIDDUSH_QC = ["Not eating. Quality control.", "I'm just making sure there's enough. There's enough. I'll check again."];

export const TABLE = {
    kiddush: [
        "Herring: check. Kichel: check. The kugel… has a note taped on it that says 'DO NOT ASK'.",
        "She does not ask. She respects the kugel.",
        "The kugel is wobbling. On its own. She decides it's a draft.",
        "Somebody labelled the plates in marker. Somebody else relabelled them. It's a quiet war, and everybody's fed.",
    ],
    setup: [
        "The tablecloth's half on. Someone is deeply committed to the corners.",
        "Plates, plates, plates. A herring with no plate yet, looking nervous.",
        "A sign says 'KUGEL — 5 MIN.' Nobody's sure what happens in five minutes.",
    ],
    bare: ["Just a tablecloth and a jug of water today. An easy fast to everyone."],
    plain: [
        "A long table with a white cloth. Waiting for Shabbos, like everything else here.",
        "A tray of kichel under plastic wrap. Someone's guarding it with a look.",
    ],
};

export const ANNOUNCE = [
    "📢 …and the kiddush this week is sponsored by *crackle* in honor of *screech* …so thank you to *screech*!",
    "📢 Lost: one black hat. Found: ninety-nine black hats. Please come see the rack.",
    "📢 Mazel tov to the… *crackle* …on the birth of a… *crackle* …everyone's very happy, whoever it is!",
    "📢 The raffle winner is number… *feedback squeal* …we'll tell you at kiddush.",
    "📢 Is this thing on? …Is this thing— (“It's on, Moishe.”) …It's on.",
    "📢 A reminder that the parking lot is for cars. *static* The goose is not a car.",
    "📢 …and please, if you borrow a siddur, return it to the s— *crackle* — …that's all.",
];

export const HATS = [
    "A hundred black hats. Every one the same. Somewhere a man is wearing the wrong one and will never know.",
    "She counts. …98, 99, 100. Exactly. Ninety-nine are the right size. The hundredth is the gabbai's.",
    "They've all got the same dent in the same place. It's a shul thing.",
    "One hat on the end is slightly crooked. Somebody has a personality.",
];

export const MEMORIAL = [
    "Little plaques in rows, each with a small light. Someone's zaidy. Someone's mother. She stands a quiet moment.",
    "One light flickers, then steadies. She doesn't say anything. That's allowed in here.",
    "Somebody keeps the bulbs fresh, quietly, every week. That's the part nobody announces.",
];

export const SHELF = [
    "Siddurim and tehillim, the spines worn soft from use. One has a kid's crayon drawing inside the cover. Somebody kept it.",
    "Everything on this shelf has been held a thousand times. She's careful with it.",
];

export const QUIET = [
    "(It's very peaceful in here.)",
    "(She stands very still. Even her sneakers are being quiet.)",
    "(Somewhere a man loses his place and finds it again. Everyone smiles into their siddurim.)",
    "(A baby coos, once. Nobody minds.)",
];

export const MENORAH = (n) => `The menorah's lit by the door — ${n} ${n === 1 ? "candle" : "candles"} tonight, plus the helper.`;
