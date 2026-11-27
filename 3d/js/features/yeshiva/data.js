// features/yeshiva — the words (roadmap 45). A PARODY campus, written from the inside by someone who loves the place:
// warm, jokes about PEOPLE (the bochurim, the coffee, the minivans, the mashgiach), never about the Torah, a pasuk, a bracha,
// davening, the aron or anyone's observance. The learning itself is shown with respect — they're good at it. She is never
// thrown out, never humiliated. Vaping / a bottle are light background references only (13+). Nothing here pays coins.
// (scripts/tests3d/yeshiva.js scans this file + stare.js + otd.js for anything holy used as a joke.)

export const NAMES = {
    name: "Beis Medrash Gadol HaMinivan", short: "the yeshiva", title: "🎓 BEIS MEDRASH GADOL HAMINIVAN",
    tagline: {
        weekday: "Seder · quiet please (it's more of a hope)", shiur: "The rosh yeshiva's shiur is on", friday: "Erev Shabbos · packing up",
        shabbos: "Shabbos · very quiet", fast: "An easy fast · the coffee rests", purim: "Purim · mind the shtenders", simchas: "Simchas Torah · mind the shtenders",
    },
};
/** Lulu walking past the campus (one line per visit). */
export const PASS = [
    "The big yeshiva. There are forty minivans in that lot and every one of them is 'just visiting'.",
    "I can hear it from the sidewalk. Six hundred people arguing, politely, at once.",
    "That building has a clock tower. Nobody is on time to it.",
];

// ── the reaction wave, in five beats ────────────────────────────────────
export const BEAT = {
    lobby: [                                    // 1. the doorway: the nearest few stop mid-word
        "…so I said to her— …", "…and the third row's been out since— …", "…forty-two slices, I said, and— …",
    ],
    snap: "📖 *a hundred pages turn at once*",    // 2. every head snaps down
    pillar: ["*BONK* …I'm FINE. The pillar is fine. I meant to do that.", "*BONK* …nobody saw. (Everybody saw.)"],
    hider: ["(…this is a shtender. Nobody's here.)", "(shh. I'm furniture.)"],
    psst: ["Psst — mashgiach!", "Mashgiach, mashgiach —"],
    settle: ["…the hum slowly comes back. Someone coughs. Someone laughs, then stops.", "…a page turns. Another. The room is learning again, a little louder than before."],
};
export const MASHGIACH = {
    hello: "Excuse me — good morning. I'm the mashgiach. May I… help you find someone?",
    options: ["🥪 I'm delivering a lunch", "👀 Just looking around — it's beautiful", "❓ Where's the women's entrance?", "🚪 Wrong building — sorry!"],
    lunch: "Ah! Yossi's lunch. He's — (he consults his clipboard) — in row nine. Asleep. Please, go ahead. Nobody will mind. They'll mind a little. Nobody will say anything.",
    noLunch: "A lunch! How thoughtful. If you have one, whoever it's for will be very glad. Mothers are the best thing that happens to this building.",
    look: "It IS beautiful. Please, look as long as you like. We're only a little… surprised. We don't often get visitors who aren't somebody's mother with a lunch.",
    entrance: "…There isn't one. In a building. Nobody planned for this. May I offer you a coffee? The coffee room is on your left. It is, between us, the real centre of power.",
    leave: "Not at all — please, no apology. Allow me to walk you to the door.",
    goodbye: "Come back any time. We'll be… more prepared. (We won't.)",
    clip: "He writes something on his clipboard. It says 'Visitor: very polite'.",
};

// ── people ───────────────────────────────────────────────────────────────
export const CHAVRUSA = [
    "It's YOUR turn! I bought last time!", "You bought a SMALL coffee. A small coffee doesn't count!",
    "We've been on this daf forty minutes. We've been arguing about the coffee for forty-one.",
    "Wait, wait — go back. Read that Tosfos again. …Okay. …Okay, you're right. Oh, that's beautiful. …Whose turn is the coffee?",
    "Look — I'll buy next time. — You said that last time. — I did buy last time! — A SMALL one.",
    "(They really are good at this. Between coffee arguments, it's something to watch.)",
];
export const VAPER = [
    "It's a humidifier.", "It's… a thing for my sinuses.", "I don't know what you mean. *vapour curls out of his sleeve*",
    "Don't tell the mashgiach. It's a humidifier. He knows it's a humidifier.", "It's a sinus thing. Very… cloudy. Don't look at the cloud.",
];
export const SLEEPER = [
    "*snore* …the Gemara says… *snore*", "He has the page printed on his cheek. He's been learning very… horizontally.",
    "*snore* …you can't… cross the street… *snore*", "Somebody put a coffee next to him. It's cold. It's been cold since the morning seder.",
];
export const CARS = [
    "2003 Odyssey, gray, the third row's been out since the Cohens' simcha. That's Reb Moishe's. The Sienna's the Friedmans'. And that one — that's NOBODY'S. It's been there since Sukkos.",
    "You want to know who's in the building? Look at the lot. Forty minivans, forty families, one spot that's always empty. Nobody knows why. We respect it.",
    "That blue one's been double-parked since before I was born. The driver learns in the back. We bring him coffee.",
];
export const SHIDDUCH = [
    "I have a list. It has a legend. The legend has a legend.", "(He looks at her, then at the spreadsheet, then very quickly at the ceiling.)",
    "Don't look at the spreadsheet. …Okay, look a little. Column F is shoe size.", "I'm not setting anybody up. I'm just… keeping track. For friends. Many friends.",
];
export const PIZZA = [
    "Forty-two slices, two bochurim, one dorm. I do this every night. The elevator's broken, so I run.",
    "Whoever's on the third floor tips in nickels. Rolled. In a sock.", "I know every room by sound. Fourth floor: a guitar. Third floor: the NBA. Second floor: someone's been on the same phone call since August.",
    "Pizza is the whole economy of this building. I am, essentially, the central bank.",
];
export const DIRECTIONS = [
    "The coffee room? Easy. Straight ahead, then left, then right, then left again — no, that's the dorm. Back down. Past the guy who's asleep. Don't stop at the coffee. Right at the pillar. Left at the shtender. And then ask someone else. (That's eleven.)",
    "Where are you trying to go? Oh. Oh. Okay: straight, left, right, left, up, no, down, past the pillar, left, the other left, and then — you'll hear it. You'll hear it. Everyone hears it.",
];
export const COFFEE = {
    open: [
        "A line of eleven bochurim and one urn. Nobody speaks. There is a hierarchy, and the hierarchy is: who is holding the cup.",
        "The coffee room is the real centre of power. Decisions are made here. Mostly 'a small one or a large one'.",
        "Someone has labelled the creamer. Someone else has relabelled it. It's a quiet war, and everybody's caffeinated.",
        "The urn has a sign: 'PLEASE REFILL WHEN EMPTY.' Underneath, in another hand: 'PLEASE DON'T BE THE ONE.'",
    ],
    closed: ["The urn rests today. A sign: 'An easy fast to everyone — the coffee will return, stronger.'"],
};
export const NOTICE = [
    "LOST: one chavrusa. Last seen Tuesday. Answers to 'hey'.",
    "SHIDDUCH RÉSUMÉ: 22, tall, learns nine hours a day, owns a suit, owns a second suit (borrowed). Mother available. Mother VERY available.",
    "WANTED: a ride to Monsey. Offering: a very good vort.", "FOUND: 99 black hats. Please see the wall.",
    "REMINDER: quiet hours are 11 PM – 6 AM. (We think that's a joke. We're not sure.)", "FREE: a mini-fridge. Works. Sometimes. Pick up from room 3C. Don't knock — shout.",
];
export const HATS = [
    "A wall of black hats. Every one the same. Somewhere a man is wearing the wrong one and will never find out.",
    "Row after row of black hats on hooks. Each one has a dent in the same place. It's a yeshiva thing.",
    "There's a gap on the wall — one hook with no hat. Somebody's out there bareheaded and hoping nobody noticed.",
];
export const HAT_BACK = [
    "It fits the gap exactly. A bochur passing by: 'THAT's where it went!' — and walks off, delighted, with no hat.",
    "She hangs it on the empty hook. Click. Somewhere a man is going to have a very good day.",
];
export const DORM = [
    "Thumping from above. A guitar. Someone shouting 'WHO TOOK MY—' and then a long silence. The ceiling shakes politely.",
    "A sign on the stairs: 'DORMS — QUIET HOURS 11 PM TO 6 AM'. Above it, in marker: 'ha.'",
    "The noise from upstairs explains everything about this building.",
];
export const FRIDGE = ["A fridge in the corner with forty identical lunches. Each one has a different name on it, all the same handwriting: 'MOM'."];
export const LCHAIM = {
    plain: ["A little table in the corner: a sponge cake, four plastic cups, a bottle someone's uncle brought. A vort. Somebody's engaged and four friends are trying not to cry.",
        "'L'chaim!' — a small cheer from the corner, then back to the Gemara. It's lovely, and somehow nobody has stopped learning."],
    purim: ["Purim. The corner has a bottle, a lot of cups, and a bochur in a very convincing pirate hat explaining the sugya to a pillar. Nobody's going anywhere. The minivans have the day off."],
    simchas: ["Simchas Torah. The whole room is in a circle and the shtenders have been moved against the wall. Nobody's driving anywhere. It's the best day of the year."],
};
export const OTD_WALL = ["(A hook with a faded name. Somebody used to hang a hat here. People still ask how he's doing.)"];

// ── the parody shiur (the comedy is the FORM — never the Torah; no texts, no pesukim) ──
export const SHIUR = [
    {
        id: "minivan", title: "Where exactly does a minivan END?", steps: [
            "The rosh yeshiva: \"Today's sugya: the minivan. Where does it END? First: define our terms. What IS a minivan?\"",
            "\"The first shita: the minivan ends at the bumper. …But then — a bike rack. Is the bike rack part of the minivan?\" Forty bochurim nod. Different speeds.",
            "\"The second shita: it ends where the sliding door ends. …Unless it's open. Then does it end in the next parking spot?\" (A bochur writes this down with great care.)",
            "\"Now — a TANGENT. Why does every minivan have a sticker of a stick-figure family? Who ARE these people? I once met a man with SEVEN stick figures and no children.\" — twenty minutes pass —",
            "\"Back to the minivan! The third shita: it ends where the DRIVER ends. But the driver doesn't end. He's a gabbai.\" (A pause. The room is very impressed.)",
            "A bochur in the back raises a hand: \"Rebbi? Does the sliding door count if it's STUCK?\" Silence. \"THAT,\" the rosh yeshiva whispers, \"is the real question. We'll take it next week.\"",
            "Everyone leaves nodding at different speeds. One bochur is still writing step two.",
        ],
    },
    {
        id: "doublepark", title: "Is double-parking a ma'aseh or a machshavah?", steps: [
            "The rosh yeshiva: \"Today: double-parking. Is it a DOING — or a THINKING?\"",
            "\"The first shita: it's a doing. You turn the wheel. Obviously. A ma'aseh.\" Forty bochurim nod. Immediately. As one.",
            "\"But the second shita: you didn't PARK. You STOPPED. For a minute. Forever. The intent is everything —\" Half the room nods. The other half is mid-sip.",
            "\"…which reminds me of a story about a man, a bakery, and a very long line for challah. Where was I? Oh, the story is better.\" — twelve minutes pass —",
            "\"So: is it a doing? A thinking? Or — the third shita — a HOPING? Hoping nobody comes.\" (A bochur in row four whispers 'tell me about it'.)",
            "From the back: \"Rebbi — what if you leave the hazards on?\" A long silence. \"Now THAT is a chiddush.\"",
            "They each write something different down. The coffee goes cold. It was a beautiful shiur, and nobody can explain why.",
        ],
    },
];
export const SHIUR_ASK = [
    "(A bochur at the back raises his hand — and the whole shiur takes a very long, happy turn.)",
    "\"…a very good question. We'll take it next week. We say that every week. It's a tradition.\"",
];
export const SHIUR_NO = [
    "The rosh yeshiva's chair is empty, with a Gemara on it and a pair of reading glasses. A sign: 'SHIUR: weekdays 10:00 and 3:00. Come early. Don't.'",
    "A blackboard still has a diagram of a minivan on it, with seven arrows. Somebody added an eighth, in a different colour.",
];
export const BOARD = ["WHERE DOES A MINIVAN END?", "① bumper  ② door  ③ driver", "④ (tangent)  ⑤ gabbai  ⑥ ?"];

// ── the errand: a forgotten lunch ────────────────────────────────────────
export const MOM = {
    offer: [
        "Oh, wonderful — are you going in there? Would you do me a tremendous favour? My Yossi left his lunch. Row nine. He'll be the one asleep. Please. It has a note.",
        "Honey — you look like someone with a minute. My son forgot his lunch AGAIN. Third time this week. He's in the big beis, row nine. He'll say 'Ma?!' Don't mind him.",
    ],
    have: "You've got the lunch! Row nine, sweetheart. He's the one asleep. Thank you so much.",
    done: "Thank you for bringing it! My Yossi called — he says a girl brought it and the whole beis went silent. He's mortified. I'm so proud.",
    bag: "A paper bag, warm, with a note in marker: 'EAT. —MA'.",
};
export const LUNCH_GIVE = [
    "Yossi lifts his head off the Shas. \"…Ma?\" He sees Lulu. He sees the bag. He sees the whole beis very quietly not looking. \"…thank you. Tell her I'm — thank you.\"",
    "\"Row nine!\" someone whispers. Yossi wakes: \"…is that a LUNCH?\" He takes it in both hands like a trophy. \"My mother is a general.\"",
];

// ── L.S.D. — Lakewood Staring Disorder (stare.js): never hostile; a running gag ──
export const STARE = {
    lulu: [
        "…they're all looking. Hi. Yes. It's me. Still me.", "Heads are turning. It's like a very polite sunflower field.",
        "Okay, a beat too long. A WHOLE beat. I counted.", "Everyone in Lakewood stares like it's a hobby. A warm, curious hobby.",
    ],
    car: ["A new car in Lakewood? The WHOLE street is on a slow turn.", "They're not staring at me. They're staring at the car. …they're staring at both."],
    lampshade: ["There's a lampshade on my head and NOBODY has said a word. Lakewood is a very disciplined town."],
    ima: "Ima: \"If you want to know why everyone looked at you — they've always looked at everyone. It's not personal. It's Lakewood.\"",
    contest: {
        offer: "👀 STARE BACK", start: ["Alright. Stare for stare.", "Okay. You blink first."],
        win: ["…okay, okay. You win. (She wins. He looks at his shoes, then at the sky, then at nothing.)", "…fine. FINE. *looks away* You've got a very strong stare. Very… polite."],
        lose: "(She blinked. He doesn't say anything. He doesn't have to.)",
    },
    badge: { name: "Patient Zero", desc: "Be stared at by 4 people at once in Lakewood" },
};

// ── the OTD guys: written with affection, zero contempt either way ───────
export const OTD = {
    sammy: {
        name: "Sammy", where: "lake", icon: "🪑", lines: [
            "Pull up a bench. It's free. Best seat in town, with a view of nobody.",
            "I used to sit in the big beis — row twelve. Still know whose turn it is for coffee. (It's Moshe's.) How's Moshe doing?",
            "People think I left. I didn't leave — I just took the long way to the parking lot.",
            "The swans don't bother anybody. That's the whole deal. I respect that.",
            "Tell Reuven I said hi. Tell him I've still got his old shtender in my garage. He'll know.",
        ],
    },
    yitzy: {
        name: "Yitzy", where: "campusLot", icon: "🚐", lines: [
            "Don't mind me, I'm not loitering. I'm… visiting a car.",
            "Tell the mashgiach Yitzy says hi. He'll pretend he doesn't know me. He taught me half of everything I know.",
            "How's Aryeh doing? Did he get engaged? I've got a speech ready. It's mostly a toast.",
            "Everybody in that building knows my name. I know every minivan in this lot. It's a fair trade.",
            "You're the girl who walked into the beis, aren't you? …Heard about it. Best thing that's happened in there since the coffee machine.",
        ],
    },
    mo: {
        name: "Mo", where: "chair", icon: "🪑", lines: [
            "I own a stool and a story. The stool is better.",
            "Everyone in this town knows my name and nobody knows my occupation. I like it that way.",
            "Ask me how Shmuel's doing. Go on. Nobody asks. I'm always the one who asks.",
            "I've got a cousin in the big yeshiva and a cousin on this bench, and they both think I'm the one who 'went his own way'. They're both right.",
        ],
    },
};
