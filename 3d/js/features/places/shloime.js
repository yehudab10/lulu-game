// features/places — "IN RE: BABY GITTY" (the owner, 2026-11-20: "with the court in Lakewood, there should be a case of a
// guy named Shloime trying to win his baby daughter over in court against his ex wife after she left him with the kid
// one day. Make it humorous."). Five short hearings in Lakewood's Courtroom 2B, one a real day. TONE: warm and silly —
// nobody is a villain (Malky is frazzled and funny, never cruel), the jokes land on the grown-ups' chaos, the paperwork
// and the court, never on the baby or on custody itself; Shloime clearly adores her. Nothing here pays coins.
//
// A step: [who, text] — who is a CAST key below — or { do: action } / { choose: … } for the hearing player (courts.js —
// the case itself is registered there with addCase; a CAST entry's seat + model put the person in the courtroom).

export const CAST = {
    judge: { name: "THE JUDGE", emoji: "👨‍⚖️", color: "#7E57C2", seat: "judge" },
    shloime: { name: "SHLOIME", emoji: "🧔", color: "#1565C0", seat: "petitioner", model: "homesDad", colors: { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723" } },
    malky: { name: "MALKY", emoji: "😩", color: "#AD1457", seat: "respondent", model: "homesMom", colors: { Top: "#AD1457", Hair: "#4E342E" }, fallback: "npcWoman" },
    fishbein: { name: "MR. FISHBEIN (his lawyer)", emoji: "🤓", color: "#6D4C41", seat: "petCounsel", model: "lawLawyer", colors: { Top: "#8D6E63", Hair: "#BDBDBD" } },
    adler: { name: "MRS. ADLER (her lawyer)", emoji: "💼", color: "#C62828", seat: "respCounsel" },
    bailiff: { name: "THE BAILIFF", emoji: "👮", color: "#546E7A", seat: "bailiff" },
    gitty: { name: "BABY GITTY", emoji: "👶", color: "#F06292" },      // (placed by the case's own setup: in someone's arms)
    lulu: { name: "LULU", emoji: "💁‍♀️", color: "#E91E63", seat: "gallery" },
};

export const HEARINGS = [
    { title: "Hearing 1 of 5 — The Filing", steps: [
        ["judge", "Docket 2B. In re: Baby Gitty. Mr. Shloime Pollack, petitioner. Is the petitioner present?"],
        ["shloime", "Present! BOTH of us! *holds her up* Say hi to the judge, Gitty!"],
        { do: "babyCheer" },
        ["gitty", "BAAAAA! 🍼"],
        ["judge", "Let the record show: 'BAAAAA.'"],
        ["fishbein", "Your honor, the petitioner submits Exhibit A— *slides a paper across* —which is… a takeout menu. From Pizza Plus. One moment."],
        ["adler", "Your honor. My client, Ms. Malky Pollack, left the baby with Mr. Pollack for ONE day."],
        ["shloime", "It's been seven months."],
        ["malky", "I said 'watch her for a day'! I never said WHICH day I was coming back!"],
        ["judge", "Ms. Pollack, that is technically true and EXTREMELY concerning."],
        ["malky", "I was overwhelmed, okay? She doesn't sleep! She throws things! She has an ARM!"],
        { do: "babyThrow" },
        ["gitty", "*flings her bottle — it bonks the court clerk* 🍼💥"],
        ["shloime", "Did you SEE that arm? Lakewood Little League. Mark my words."],
        { do: "gavel" },
        ["judge", "Petition received. Continued until tomorrow. Mr. Fishbein — bring a form that isn't a MENU. 🔨"],
        ["lulu", "*whispering, from the gallery* I'm coming back tomorrow. I NEED to know how this ends."],
    ] },
    { title: "Hearing 2 of 5 — The Exhibits", steps: [
        ["fishbein", "Exhibit B, your honor: four hundred photographs of the baby."],
        ["judge", "Four HUNDRED?"],
        ["shloime", "That's just this week. Her first bath. Her second bath. Her first bath AGAIN — she liked it."],
        ["adler", "Objection. Relevance."],
        ["shloime", "Objection to your objection! Look at her FACE!"],
        ["judge", "Sustained. Mr. Pollack, you can't object. You are not a lawyer."],
        ["fishbein", "Neither am I, entirely. I'm finishing online."],
        ["adler", "Ms. Pollack's Exhibit 1: the baby's birth certificate. Mother: Malky. Signed. Notarized. Laminated."],
        ["malky", "I laminate everything when I'm stressed. I laminated my LUNCH."],
        { do: "babyToBailiff" },
        ["bailiff", "*the baby has crawled over and fallen asleep on the bailiff's shoes* …Your honor. I can't move."],
        ["judge", "Then nobody moves. The court will WHISPER until she wakes up. 🤫"],
        ["shloime", "*whispering* She does this. She picks a person. It's an honour, officer."],
        ["malky", "*whispering* She picked the mailman once. We had to wait an hour."],
        ["lulu", "*whispering* This is the best show in Lakewood. And it's FREE."],
    ] },
    { title: "Hearing 3 of 5 — The Character Witness", steps: [
        ["fishbein", "The petitioner calls… *squints at a sticky note* …'the girl in the gallery who keeps coming back'."],
        ["lulu", "ME?!"],
        { do: "luluToStand" },
        ["judge", "Approach the stand. State your name for the record."],
        ["lulu", "Lulu Bruck. I've been arrested, like, a NORMAL amount."],
        ["adler", "Ms. Bruck. Do you know Mr. Pollack personally?"],
        { choose: { who: "lulu", text: "What do I say about Shloime?", options: [
            { label: "🍼 He carries a BABY bottle. Like a responsible man.", then: [["adler", "So you've seen him… hold a bottle."], ["lulu", "With CONFIDENCE."]] },
            { label: "✨ He's a great dad. Source: vibes.", then: [["judge", "The court does not accept 'vibes' as evidence."], ["lulu", "The court is missing out."]] },
            { label: "😉 I don't know him, but the baby winked at me.", then: [["adler", "Babies wink at everyone."], ["lulu", "Not at YOU, I bet."], ["judge", "…Sustained, honestly."]] },
        ] } },
        ["adler", "No further questions. Truly. None at all."],
        ["judge", "The witness may step down. Please. Step down."],
        { do: "luluToGallery" },
        { do: "babyCheer" },
        ["gitty", "*claps for Lulu* 👏👏"],
        ["fishbein", "That went GREAT. Did that go great? I couldn't tell."],
    ] },
    { title: "Hearing 4 of 5 — The First Word", steps: [
        ["adler", "Your honor, the question is simple. Who has been THERE for this child?"],
        ["shloime", "Me! Every night! I learned to braid, your honor. She has four hairs. I braid ALL FOUR."],
        ["malky", "And I was there for the nine months BEFORE that, thank you very much."],
        ["judge", "Both fair points. Perhaps we should hear from the person this is actually about."],
        ["fishbein", "Your honor… she's a baby."],
        ["judge", "Mr. Fishbein, I am AWARE she's a baby."],
        { do: "babyCheer" },
        ["gitty", "*looks at Shloime. Looks at Malky. Takes a big, serious breath…*"],
        ["gitty", "…BAI-LIFF."],
        ["bailiff", "*sniff* …she said my NAME."],
        ["judge", "Her FIRST WORD. In MY courtroom. Somebody write that down. 🥹"],
        { do: "babyToJudge" },
        ["judge", "Give her here. *the judge is now holding the baby* …The court is in recess. A LONG one."],
        ["malky", "She's never said MY name."],
        ["shloime", "She's never said mine either! We're in the same boat, Malky."],
        ["malky", "…We kind of are, huh."],
    ] },
    { title: "Hearing 5 of 5 — The Ruling", steps: [
        ["judge", "*still holding Gitty* I have reviewed the file. All four hundred photographs. And the menu — I ordered from it."],
        ["adler", "Your honor, my client and Mr. Pollack have reached an agreement."],
        ["fishbein", "We HAVE?"],
        ["shloime", "We have. We talked in the hallway. For three hours. Gitty slept on the vending machine."],
        ["malky", "Weekdays with Shloime. Sundays with me. Shabbos we take turns. And he's NOT allowed to braid."],
        ["shloime", "I'll fight that one on appeal."],
        { do: "gavel" },
        ["judge", "SO ORDERED! 🔨 And the bailiff gets visitation. Tuesdays."],
        ["bailiff", "*quietly* Best day of my life."],
        { do: "babyCheer" },
        ["gitty", "BA-BYE! 👋"],
        ["lulu", "*sniff* I'm not crying. The courtroom is just very DUSTY."],
    ] },
];

/** Shloime on the lobby bench, rehearsing (before the case is over). */
export const BENCH_SHLOIME = [
    "*to the baby* Okay. If the judge asks — I'm 'organized'. Can you say 'organized'?",
    "Card one: 'Your honor.' Card two: 'Good morning.' Card three is a picture of her. They're ALL pictures of her.",
    "*bottle in one hand, index cards in the other* I've got this. I've totally got this. I don't got this.",
    "She bit my lawyer. In her defence, he was asking for it.",
    "Malky's not a bad person. She's just… a lot. So am I. So is SHE. *points at the baby*",
];
export const BENCH_DONE_TODAY = [
    "See you tomorrow, Lulu! Same time, same bench, same baby.",
    "That's it for today — the judge has a nap scheduled. So does Gitty.",
];
export const BABY = ["BA! 🍼", "*blows a raspberry* 😛", "*grabs Lulu's finger and won't let go* 🥹", "GAH! *delighted by the ceiling*"];

/** After the case: Shloime around Lakewood with the stroller. */
export const SHLOIME_AFTER = [
    "Lulu! My star witness! (You were terrible.) (Thank you.)",
    "She said 'BAILIFF' again this morning. We're working on 'Abba'.",
    "Malky took her yesterday. I slept fourteen hours. I MISSED her.",
    "Mr. Fishbein passed his online exam! On the fourth try. He's a REAL lawyer now. God help us.",
    "We walk past the courthouse every day. She waves at it. It's her favourite building.",
];
export const BABY_AFTER = ["LU-LU! 👋", "BAI-LIFF! 👮", "BA-BYE! 👋", "*waves from the stroller* 👋"];

// ── Midwood ──
/** Courtroom 2B in Midwood stays locked — what she hears through the door. */
export const MW_DOORS = [
    "🔒 Through the door: \"…and WHO borrowed the lawnmower in 1998?!\" — Kings County-ish small claims. Since 1998.",
    "🔒 \"Your honor, the ladder was IN my driveway!\" \"OBJECTION!\" \"You can't object, Mr. Stein, you're the defendant!\"",
    "🔒 Someone inside is presenting a PowerPoint about a parking spot. It's on slide 94.",
];
/** Abba in the Midwood lobby (he is, apparently, always here). */
export const MW_ABBA = [
    "I have a 2 o'clock. …It's you, isn't it.",
    "Lulu! What are you doing in a COURTHOUSE? …What did you DO? Don't tell me. Tell me later. Tell Ima never.",
    "I'm not even a lawyer, bubbeleh. I just keep showing up. They gave me a parking spot.",
    "Ima packed sandwiches. For the whole courthouse. Take one to the bailiff, he looks pale.",
];

/** Abba as her counsel in Midwood's court (law/court.js asks through ctx.civic.counsel) — no randomness here: the lines
 *  rotate, so the trial's random draws (and its verdicts) are exactly what they would be with any other lawyer. */
export const ABBA_COURT = {
    opening: [
        "Your honor, I'm her FATHER. I changed her diapers. THIS is your hardened criminal? My Lulu-bear?",
        "Before we start — has the court EATEN? Ima sent kugel. There's enough for the jury.",
        "Your honor, Exhibit A: her second-grade report card. 'A pleasure to have in class.' The defence rests. …No wait, I'll keep going.",
    ],
    afterProsecutor: [
        "Objection! To the prosecutor's TONE. As a FATHER.",
        "Young man, does your mother know you talk to people like that?",
        "Your honor, may I approach the prosecutor? …I just want to fix his tie. It's bothering me.",
    ],
    uninvited: [
        "I'm not her lawyer, your honor. I'm her FATHER. I'm just going to SIT here. Loudly.",
        "Nobody hired me. I hired myself. For free. You're welcome, Lulu-bear.",
    ],
    beforeJury: [
        "*offers the bailiff a sandwich from Ima* It's tuna. She made extra. Nu — take.",
        "Ladies and gentlemen of the jury — she slept through the night at SIX WEEKS. Just so you know who you're dealing with.",
    ],
    /** Tried WITH friends (law/crew.js co-defendants): he represents them all. {names} = the friends. */
    codefendants: [
        "Your honor, I'm also representing {names}. Pro bono. Her mother called.",
        "I represent ALL of them. {names} — sit up straight, you too. I don't care whose father I am.",
        "{names}, have you eaten? Nobody answers anything until everybody's eaten.",
    ],
    verdict: {
        dismissed: ["THAT'S MY GIRL! *hugs the bailiff* Wait till I tell Ima! …Actually, let's not tell Ima."],
        fine: ["A fine? FINE. I'll pay it— no. YOU'LL pay it. From the allowance."],
        jail: ["Lulu-bear, I'll bring kugel. Every day. They can't stop me. ❤️"],
    },
};
