// features/memory — every line the world says when it remembers Lulu.
// Short, specific, Jewish-family comedy. {name} / {n} / {color} are filled in.

// ── 😤 the carjacked driver comes back ───────────────────────────────────
export const GRUDGE_NAMES = {
    npcMan: ["Shloimy", "Hershel", "Yitzy", "Mr. Pomerantz", "Dovid-Leib", "Mordy"],
    npcWoman: ["Mrs. Blumenfeld", "Tzippy", "Rivky", "Chaya Sara", "Mrs. Teitelbaum", "Faigy"],
    copPerson: ["Officer Plotkin", "Sergeant Weisz"],
};
export const GRUDGE_YELL = [
    "THAT'S MY CAR'S COUSIN, YOU MANIAC!",
    "I had to take the BUS, Lulu. The BUS.",
    "Remember me?! Because my BACK remembers YOU!",
    "You left my kugel on the seat! WHERE IS MY KUGEL?!",
    "My insurance agent laughed for TEN MINUTES!",
    "My therapist said to let it go… I'M NOT LETTING IT GO!",
    "I told my rabbi. He said 'forgive'. He didn't SEE you!",
    "{name} NEVER FORGETS! {name} also never got the cupholder back!",
];
export const GRUDGE_KIND = {
    van: ["My MINIVAN, Lulu! The car seats were IN it!", "Six kids walked to cheder because of you!"],
    truck: ["You took a BOX TRUCK. Who DOES that?!", "Forty cases of grape juice, Lulu. FORTY."],
    streets_sports: ["Do you know what that car COST? …It's leased. But STILL!", "Zero to sixty in four seconds — and zero to STOLEN in two!"],
    cop: ["THAT WAS A DEPARTMENT VEHICLE, LULU!", "I walked back to the precinct. In THESE shoes!"],
};
export const GRUDGE_TAILGATE = ["How do you like it, HUH?!", "I'm RIGHT here! Feel watched? GOOD!", "Tailgating is a SPIRITUAL practice now."];
export const GRUDGE_BRAKE = ["OOPS! My foot SLIPPED! Like your hands on MY DOOR!", "BRAKE CHECK! That's for the car!", "Whoops! Was that rude? I learned from THE BEST!"];
export const GRUDGE_COPS = ["Hello, police? She's in a pink car. Yes. AGAIN. 📞", "I'm calling it in! Officer? It's HER! 📞", "📞 Yes, I'll hold. I've got ALL DAY."];
export const GRUDGE_FORGIVE = [
    "You know what? New car's nicer. We're even. …MOSTLY even. 🕊️",
    "Shabbos is coming. I forgive you. Don't make me regret it. 🕊️",
    "My wife says I talk about you too much. I'm letting it GO. 🕊️",
];
export const GRUDGE_LEAVE = ["And SIGNAL next time!", "This isn't OVER!", "I'm telling your MOTHER!", "Hmph!"];
export const LULU_REPLY = [
    "Sorry! It was an EMERGENCY! …Of fashion.",
    "Do I know you? …Oh. OH.",
    "In my defense — no, I've got nothing.",
    "I returned it! …Spiritually.",
];
export const LULU_FORGIVEN = ["Aww. Mazel tov on the new car!", "See? Everybody wins!"];

// ── 📱 cab fares text afterwards ─────────────────────────────────────────
// each fare: { from, emoji, color, ok: [lines when delivered], bad: [lines when they bailed] }
export const FARE_TEXTS = {
    groom: { from: "MENDEL (the groom)", emoji: "🤵", color: "#5C6BC0",
        ok: ["📸 [wedding photo] Me under the chuppah, only 4 minutes late. My mother-in-law says you're invited to the bris. In nine months. She's PLANNING.",
            "📸 [wedding photo] The rabbi asked who the girl in the pink car was. I said 'a miracle'. He said 'a SPEEDING miracle'."],
        bad: ["📸 [wedding photo] We got married anyway. In every picture I'm sweating like a cholent. Thanks for NOTHING."] },
    chicken: { from: "SHMUEL & GERTIE", emoji: "🐔", color: "#8D6E63",
        ok: ["Gertie update: she laid an egg. A STRESS egg. We're calling it 'the Lulu'.", "Gertie is doing much better. She only screams at pink cars now."],
        bad: ["Gertie hasn't spoken since the ride. She's a chicken, she never spoke. But it's DIFFERENT now."] },
    influencer: { from: "@LuxeLeah", emoji: "🤳", color: "#EC407A",
        ok: ["ur famous now 💅 also pls venmo me for the dry cleaning", "tagged u 💅 'my cab driver is UNHINGED' — 40k views. the dry cleaning bill is ALSO viral"],
        bad: ["posted u as 'worst cab ever 💀' it's my most viewed post lol ty. still want the dry cleaning $$"] },
    instructor: { from: "MR. KATZ", emoji: "📋", color: "#607D8B",
        ok: ["Your shift, graded. Signalling: D. Enthusiasm: A. Lane discipline: see me after class. Overall: C+. I've had worse. I've had Avigail.",
            "Final grade: B−. Points off for 'vibes'. I don't know what vibes are, but yours were too much."],
        bad: ["Final grade: INCOMPLETE. Like your stops."] },
    detective: { from: "MRS. FELDMAN, P.I.", emoji: "🕵️‍♀️", color: "#6D4C41",
        ok: ["Case closed. He WAS cheating — at mahjong. Your fee's in the mail. The mail is slow."],
        bad: ["Lost him. Now I have to follow YOU. Kidding. …Am I?"] },
};
export const DELIVERY_TEXTS = {
    cholent: { from: "MRS. GOLDBERG", emoji: "🍲", color: "#6D4C41",
        bad: ["I updated my review to ZERO stars. The app doesn't allow zero. I CALLED them.", "Re: your 1★. The kiddush ate crackers. CRACKERS, Lulu."],
        good: ["We're ordering again Shabbos. Specifically YOU. Wear something nice."] },
    kugel: { from: "AUNT RAIZY", emoji: "🥔", color: "#FFA000",
        bad: ["Book club discussed your kugel instead of the book. 1★. It was a better discussion, honestly."],
        good: ["The book club voted. You're our kugel girl now. There's no way out."] },
    pizza: { from: "THE SHAPIROS", emoji: "🍕", color: "#E53935",
        bad: ["The bar mitzvah boy wants to know if you do birthdays. His mother does NOT."],
        good: ["Best pizza delivery EVER. The bar mitzvah boy wants to be you when he grows up. We're worried."] },
};
export const MOISHE_TEXTS = {
    clean: ["About the getaway: your aunt thinks we were at bingo. We WERE at bingo. Don't make it weird. 🕶️"],
    lost: ["You dropped {n} bag(s), kid. Big Yossi cried. Little Yossi cried harder. 🕶️"],
    fail: ["Lawyers are expensive, bubbeleh. Next time: LESS brakes. 🕶️"],
};

// ── 💜 Avigail on Lulu's notoriety ───────────────────────────────────────
export const AVI_TEXT = {
    arrests: ["Saw your mugshot on the precinct board. Your hair looked AMAZING. I hate it. 💅",
        "{n} arrests? My mother asked if we're still friends. I said 'frenemies with a RECORD'."],
    stars: ["You were on the NEWS. With a HELICOPTER. Do you know how hard I've worked for a helicopter?",
        "{n} stars?! My cousin's a cop. He says your name like it's a curse word. It's kind of iconic."],
    escapes: ["Lost the cops AGAIN? Teach me. For research. 💅"],
    carjacks: ["Lulu. Did you STEAL a CAR? My cousin's carpool is in SHAMBLES."],
    er: ["Heard you're on a first-name basis with the ER nurses. Get well soon or whatever. 💜"],
};
export const AVI_ROAD = [
    "Oh look, it's AMERICA'S MOST WANTED. 💅",
    "Should I call your lawyer or will you? 💅",
    "Saw your face on a billboard. Not a FLATTERING one.",
    "Is this car stolen? Asking for the police.",
];
export const AVI_PORCH = {
    arrests: "Before you come in — is this a social visit or are you hiding from the police?",
    stars: "Lulu. There was a HELICOPTER over my house last week. Was that you? Don't answer.",
    escapes: "My mother saw you on the news and asked if you're 'still that nice girl'. I said no comment.",
    carjacks: "Whose car is THAT? …Actually, don't tell me. I want deniability.",
    er: "You look good for someone who lives at the ER. 💅",
};

// ── 👮 small recognitions ────────────────────────────────────────────────
export const COP_AGAIN = [
    "Oh, it's YOU again.",
    "Oh, it's YOU again. We have a mug at the station with your face on it.",
    "Oh, it's YOU again. That's arrest number {n}. We're on a first-name basis, Lulu.",
];
export const PAINT_AGAIN = [
    "{color} again? Bold.",
    "{color} AGAIN? The cops have that one on file now, bubbeleh.",
];
export const PAINT_BACK = [
    "Back already? Last time {prev}. Today you look like a {color} girl.",
    "You again! What happened to the {prev}? …Don't tell me. I pray better not knowing.",
];
export const HITCH = {
    pickAfterPass: ["Oh, NOW you stop? Last time you left me in the DUST!", "I remember you! You drove RIGHT past me! …Bubbe's, please."],
    pickAgain: ["Same seat as last time! I'm not keeping count. ({n}.)", "You again! We should split the gas. I won't, but we SHOULD."],
    passAgain: ["AGAIN?! I'm writing this DOWN!", "That's {n} times, Lulu! I have a NOTEBOOK!"],
    passAfterRide: ["Lulu?! We had something SPECIAL!"],
    dropAgain: ["Same corner as last time! You're very consistent.", "Drop-off number {n}! I'm telling Bubbe you're a mensch."],
};

// ── 🪧 the WANTED billboard ──────────────────────────────────────────────
export const POSTER = {
    wanted: { head: "WANTED: LULU", sub: "REWARD: 36 COINS AND A KUGEL",
        small: { plain: "Approach with snacks. Suspect is extremely charming.", stars: "Last seen at {n}★, waving at the helicopter.",
            escape: "Last seen losing six cruisers in a pink blur.", jail: "Escaped custody. Took the good blanket." },
        react: ["Is that ME? …Okay, good angle, honestly.", "36 coins?! I'm worth at LEAST forty.", "A KUGEL? Now I'm tempted to turn myself in."] },
    honk: { head: "SEEN HER?", sub: "DON'T HONK. SHE HONKS BACK.", small: "Tips: 1-800-OY-VEY-COP. Rugelach accepted. (Rugelach is NOT a bribe.)",
        react: ["I DO honk back. That's fair.", "Who calls that number?! …Avigail. It's Avigail."] },
    free: { head: "FREE LULU!", sub: "SHE WAS ONLY GOING 90", small: "Paid for by the Lulu Fan Club (4 members, one is a chicken)",
        react: ["I have a FAN CLUB?!", "Gertie! You joined!", "Ninety is basically seventy in Vegas."] },
};
