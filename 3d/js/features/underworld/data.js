// features/underworld — every knob, number and line of text.
//
// Tone: a cartoon family comedy (the App Store's 12+). Nobody gets hurt beyond the game's own
// knock-down / heart rules; the "crimes" are a kugel fund, 40 lbs of gefilte fish and a stolen
// bumper; the props are water pistols, banana "guns" and baguettes. Bad guys bluster, honk and
// get pulled over; nobody is hurt.

export const ID = "underworld";

// ── 🎛️ SPAWN: how often things happen (the owner's knobs) ──────────────────
// Everything is in seconds of RUN time (the game's clock while she drives / walks).
// Settings › 😈 Bad guys multiplies every chance below by RATES[mode] (Off 0 · Rare 0.5 · Normal 1 · Often 2);
// in a test or the console: ctx.underworld.SPAWN.rate = 3 (or ?test&enable=underworld&uwrate=3).
export const SPAWN = {
    rate: 1,                     // × every chance (set from Settings; tests poke it)
    firstAfter: 60,              // nothing underworld in the first minute of a run
    gap: [150, 260],             // s between bad-guy encounters — at most ONE every few minutes
    roll: 0.6,                   // when the gap is up: the chance one shows up (else try again in `retry`)
    retry: [30, 50],
    drive: { rager: 1, gang: 1 },   // which bad guy while she DRIVES (weights; highway only)
    foot: { pickpocket: 1 },        // …and on FOOT (the highway or a town)
    crooked: {                   // 🍩 Officer Krupnik and the Policeman's Kugel Fund
        warn: 0.35,              // a ⚠️ WARNING: the chance he waits on the shoulder ahead with an "offer"
        bust: 0.30,              // a pull-over (only from a 1–2★ chase): the chance the officer's open to a donation
        sting: 0.22,             // a paid bribe is an Internal Affairs STING (more with heat: + 0.15 × heat 0–1)
        price: [30, 50],         // the "donation"
        cool: 150,               // s before he offers again
        maxStars: 2,             // no "donations" from a chase hotter than this
    },
    mechanic: {                  // 🔧 Velvel's No-Questions Auto (a roadside shack, highway)
        first: 120, every: [220, 380], chance: 0.6,
        fix: 18, paint: 12,      // cheap! (Chaverim is free but slow, Moishe's respray is 30+)
        hot: 0.5,                // the parts / paint were "hot": cops recognise the car later this run
        buy: { sedan: 70, van: 80, truck: 110, streets_sports: 150, cop: 140, foot_ambulance: 120, foot_bus: 90, foot_dozer: 160 },
        report: 0.3,             // selling him a jacked car: the chance a neighbour calls it in
    },
    fixer: {                     // 🕶️ the Fixer's dirty jobs (Cruise only)
        first: 100, every: [210, 330], chance: 0.55,
        maxHeat: 85,             // "Lay low, kid" — no new offers above this heat
    },
};
export const RATES = { off: 0, rare: 0.5, normal: 1, often: 2 };
export const RATE_ORDER = ["normal", "often", "off", "rare"];
export const RATE_LABEL = { off: "OFF", rare: "RARE", normal: "NORMAL", often: "OFTEN" };

// ── tuning ───────────────────────────────────────────────────────────────
export const TUNE = {
    heat: {
        max: 100,
        cool: 0.2,               // per s of play (100 → 0 in ~8 min)
        coolAway: 2,             // per real minute away from the game
        add: { package: 18, wheelman: 30, tail: 15, bribe: 6, sting: 20, sell: 12, hotParts: 4 },
        // what high heat does to the law while it lasts (scaled by heat/100): cops see further,
        // a ⚠️ warning drains slower, the warrant file spots her quicker
        sight: 0.35, decay: 0.5, warrant: 0.4,
        levels: [[0, "😇 CLEAN"], [20, "🌡️ WARM"], [50, "🔥 HOT"], [80, "🚨 SCORCHING"]],
    },
    coinCap: 30,                 // the most a bad guy can ever take at once (always recoverable)
    pickpocket: { min: 6, frac: 0.12, walk: 1.3, run: 5.4, tired: 3.9, tiredAfter: 5, getaway: 46, life: 45, tackleR: 2.2, auto: 1.05, spawn: [13, 17] },
    rager: { life: 48, outrun: 140, outrunFor: 2.5, top: 0.95, bumpEvery: [5, 8], flat: 0.4, startBehind: 55 },
    gang: { tail: [32, 46], lose: 160, loseFor: 2, gap: 24, top: 0.97, startBehind: 70 },
    copBust: { sees: 52, seeFor: 0.5 },   // a cop with eyes on a bad guy this long pulls him over
    shomrim: { arrive: 30, catchR: 13 },
    reward: { bust: 25, tackle: 4, shomrim: 15, escape: 10 },
    deal: { stop: 7.5, r: 4.2 },          // stop this slow, this close to a pull-in pad to talk
};

// ── the cast (recurring: names come back as rivals) ─────────────────────
export const COLORS = { fixer: "#455A64", cop: "#1565C0", mechanic: "#F57F17", bad: "#C62828", gang: "#7B1FA2" };
export const CAST = {
    krupnik: { name: "OFFICER KRUPNIK", emoji: "🍩", color: "#1565C0" },
    feldman: { name: "AGENT FELDMAN (I.A.)", emoji: "🕵️", color: "#37474F" },
    velvel: { name: "VELVEL", emoji: "🔧", color: "#F57F17" },
    fixer: { name: "THE FIXER", emoji: "🕶️", color: "#455A64" },
    shomer: { name: "SHOMRIM", emoji: "🔦", color: "#C8F02A" },
};
export const RIVAL_NAMES = {
    rager: ["Big Mordy", "Shloime 'the Horn' Gold", "Vinny Two-Lanes", "Mr. Brakelights"],
    gang: ["the Kugel Kartel", "the Cholent Crew", "the Babka Boys", "the Gefilte Gang"],
    pickpocket: ["Yossi Fingers", "Light-Fingered Leibel", "Pinny the Pocket", "Slick Shmuly"],
};
// the gang car's paint jobs (the Paint material) + Lulu's name for it
export const GANG_PAINT = [["#7B1FA2", "purple"], ["#00897B", "teal"], ["#F06292", "bubblegum-pink"], ["#FB8C00", "tangerine"]];
export const TAIL_PAINT = "#78909C";   // the Fixer's "lose a tail" job: a forgettable grey

// ── 🍩 the crooked cop ───────────────────────────────────────────────────
export const COP = {
    warnBanner: "🍩 Officer Krupnik waves from the shoulder ahead…",
    warnSub: "pull in by his cruiser to make that warning “disappear” · drive by = no thanks",
    prompt: "🍩 Pull in by Officer Krupnik's cruiser",
    passed: ["Your loss, Bruck! 🍩", "Suit yourself! The kugel fund will survive!", "Drive SAFE now. …ish."],
    pitch: [
        [["cop", "That warning back there? Paperwork. So much paperwork."], ["cop", "Unless… you'd like to make a donation to the Policeman's Kugel Fund. 🍩 {price} coins, and the warning gets… lost."]],
        [["cop", "Nice convertible. Shame about that warning."], ["cop", "Y'know, the Policeman's Kugel Fund is a little short this month. {price} coins and I forget your face."]],
        [["cop", "Ma'am. I could write this up…"], ["cop", "…or you could support the Policeman's Kugel Fund. Lokshen kugel doesn't buy itself. {price} coins."]],
    ],
    bustPitch: [
        ["cop", "…buuut. The Policeman's Kugel Fund is accepting donations. {price} coins and this never happened. 🍩"],
        ["cop", "…unless you'd like to support the Policeman's Kugel Fund? {price} coins. Very tax-deductible. Probably."],
    ],
    ask: "A “donation” to the Kugel Fund?",
    pay: "💸 “Donate” {price} 💰",
    refuse: "🙅‍♀️ No thank you, officer",
    broke: "😬 I've only got {coins} coins…",
    paid: [
        [["lulu", "For the kugel. Obviously."], ["cop", "Obviously. Warning? What warning? Drive safe, citizen. 🍩"]],
        [["lulu", "*slides the coins over* …is it potato or lokshen?"], ["cop", "Both. We're not animals. You're free to go."]],
    ],
    paidBust: [
        [["lulu", "For the kugel fund. Mazel tov on the kugel."], ["cop", "Pleasure. I never saw you. *pockets it* 🍩"]],
    ],
    refused: [
        [["lulu", "I'll take my chances with the paperwork, officer."], ["cop", "Your loss. *crumples the form* …I mean, carry on."]],
        [["lulu", "Bubbe says never pay for kugel you didn't taste."], ["cop", "…Bubbe's a smart woman. Fine."]],
    ],
    sting: [
        [["lulu", "For the kugel fund. 💸"], ["cop", "*rips off his mustache* AGENT FELDMAN, INTERNAL AFFAIRS! You just bribed a FAKE crooked cop!"], ["lulu", "That's ENTRAPMENT! …is it? It feels like entrapment."]],
        [["lulu", "Here. Buy the good raisins."], ["cop", "*taps his lapel* Did you get that, Feldman?"], ["feldman", "*from the bushes* GOT IT! Internal Affairs! Hands where we can see 'em!"]],
    ],
    stingBanner: "🕵️ IT WAS A STING!",
    stingSub: "Internal Affairs! The kugel fund was a SETUP",
    paidToast: "🍩 The warning got… lost.",
    charge: "BRIBING AN OFFICER (KUGEL FUND)",
    chargeKey: "KUGEL FUND",
    // the arrest + the courtroom (law.addCharge)
    arrestCop: ["Bribing an officer. With KUGEL money.", "The Kugel Fund was a SETUP, Bruck. Internal Affairs sends its regards."],
    arrestLulu: ["I thought it was for CHARITY!", "In my defense, the kugel was PROMISED."],
    defense: "my client believed in good faith that the Policeman's Kugel Fund was a real charity. Have you SEEN the kugel? Exhibit B, your honor.",
    court: [
        { who: "BAILIFF", p: "bailiff", text: "The prosecution calls… Exhibit A. *wheels in a single kugel on a cart*" },
        { who: "PROSECUTOR", p: "prosecutor", text: "The so-called 'Kugel Fund', your honor. Note the BITE mark. Somebody already ate the evidence." },
        { who: "JUDGE", p: "judge", text: "…is that lokshen? *sniffs* With RAISINS? The court will allow it. *takes a fork* Order. ORDER." },
    ],
};

// ── 🔧 Velvel's No-Questions Auto ────────────────────────────────────────
export const MECH = {
    sign: ["VELVEL'S 🔧", "NO-QUESTIONS AUTO"],
    banner: "🔧 VELVEL'S NO-QUESTIONS AUTO ahead",
    sub: "cheap fixes · cheaper paint · he buys “borrowed” cars — pull onto his pad",
    prompt: "🔧 Pull onto Velvel's pad",
    hello: ["Velvel. Cash only, no questions, no receipts. What'll it be?", "Welcome to Velvel's! Where every part has a past. 😏", "Don't ask where the parts come from and I won't ask where the CAR comes from."],
    ask: "What'll it be?",
    fix: "🔧 Fix 'er up — {price} 💰 (parts “fell off a truck”)",
    paint: "🎨 Quick paint job — {price} 💰 (no questions)",
    sell: "💰 Sell him this {ride} — +{pay} 💰",
    look: "🙅‍♀️ Just looking",
    broke: "“Come back when you've got {price} coins, sweetheart.”",
    fixed: ["Good as new! …good as SOMEBODY'S new.", "New bumper, new mirror, new tyre. Don't drive past the junkyard, they'll want 'em back."],
    painted: ["{color}! Paint's from a, uh, school bus. Fresh off it.", "{color}. Nobody'll recognise you. Probably."],
    sold: ["Pleasure doing business. My cousin brings your car round. 😏", "I'll have it in eleven pieces by Shabbos. Here's your car back."],
    bye: ["Come back when you need something HOT. I mean CHEAP.", "Velvel's! Tell your friends. Actually don't."],
    colors: [
        { name: "school-bus yellow", body: "#FDD835", light: "#FFF176", dark: "#F9A825" },
        { name: "getaway grey", body: "#78909C", light: "#B0BEC5", dark: "#455A64" },
        { name: "ambulance white", body: "#F5F5F5", light: "#FFFFFF", dark: "#BDBDBD" },
        { name: "pickle green", body: "#7CB342", light: "#AED581", dark: "#558B2F" },
    ],
    hotCharge: "DRIVING ON STOLEN PARTS",
    hotWarn: "🚓 “Hey — that bumper was reported STOLEN…”",
    hotMsg: "🚨 THAT'S A HOT BUMPER!",
    sellCall: "📞 Velvel's neighbour called it in!",
    sellCharge: "SELLING A “BORROWED” CAR",
};

// ── 🕶️ the Fixer: dirty jobs (registered with hustle's job framework) ────
export const JOB_DEFS = {
    uw_package: { emoji: "📦", name: "THE PACKAGE", color: "#8D6E63", from: "THE FIXER", fromEmoji: "🕶️",
        blurb: "Pick up a package. Deliver it. Don't open it. Don't SMELL it. (+heat)" },
    uw_wheelman: { emoji: "🧤", name: "THE WHEELMAN", color: "#455A64", from: "THE FIXER", fromEmoji: "🕶️",
        blurb: "Fingers Feivel needs a ride from the back door of Kosher Kingdom. Lose the cops, drop him off. (++heat)" },
    uw_tail: { emoji: "🕶️", name: "LOSE THE TAIL", color: "#607D8B", from: "THE FIXER", fromEmoji: "🕶️",
        blurb: "Somebody's following the client's car. That's your car now. Lose them. (+heat)" },
};
export const PAY = { package: [110, 150], wheelman: [180, 230], wheelStar: 20, tail: [110, 140], tailTime: 70, packageTime: 80 };
export const PACKAGES = [
    "40 lbs of gefilte fish. Still twitching. (It's not. It's jelly.)",
    "300 left socks. Just left ones. Don't ask.",
    "A crate of contraband esrogim. Very lemony. Very illegal-ish.",
    "Bubbe Feiga's SECRET cholent recipe, on a floppy disk.",
    "A VHS tape: 'Shloimy's Bar Mitzvah, 1987, Part 4 of 9'.",
    "Two thousand rubber ducks dressed as the Rebbe's chassidim.",
    "One (1) single, extremely smug pickle.",
    "A whole wedding's worth of leftover rugelach. Still warm.",
];
export const FIXER = {
    text: [
        "Payphone up the road. Answer it. — a friend 🕶️",
        "Got work for you. Payphone, mile ahead. Ring ring. 🕶️",
        "You want to make some coins? Payphone. Up ahead. Don't tell your mother. 🕶️",
    ],
    tooHot: "You're too hot, kid. Lay low a while. I'll call YOU. 🕶️",
    cool: "Heat's off. The phone works again, if you know what I mean. 🕶️",
    pickup: { package: "📦 Pick up the package at the dead drop", wheelman: "🧤 Pick up Fingers Feivel behind Kosher Kingdom", tail: "🕶️ Lose the grey sedan!" },
    deliver: "📦 Deliver it — don't shake it",
    lose: "🚨 Lose the cops!",
    drop: "🧤 Drop Feivel at the laundromat",
    squish: ["*the package goes SQUELCH*", "*something in the box sloshes*", "*a muffled quack from the box*"],
    feivel: ["Nice and easy… NOT that easy, GO!", "I only took the MACAROONS, I swear!", "Left! Right! The OTHER left!", "My mother thinks I'm at shiur."],
    feivelBye: "Pleasure, Lulu. If anybody asks, I was at shiur.",
    tail: ["They're still back there…", "Grey sedan. Sunglasses. At NIGHT. Subtle.", "Lose them, Lulu!"],
    lost: "😎 Lost the tail!",
    timeout: { package: "The client went with another courier. A pigeon.", tail: "They followed you all the way to Bubbe's. Awkward." },
    bustedText: "I never met you. Who is this. 🕶️",
    doneText: ["Clean work, kid. Coins are in the usual place (your pocket). 🕶️", "The client is happy. The client is NEVER happy. Good job. 🕶️"],
};

// ── 😡 the road-rager ────────────────────────────────────────────────────
export const RAGER = {
    banner: "😡 ROAD RAGE!",
    sub: "outrun him — or lead him past a cop 🚓",
    honk: ["MOVE IT, LADY!", "LEFT LANE IS FOR PASSING!", "ARE YOU BLIND?!", "LEARN TO DRIVE!", "I'M LATE FOR MY KID'S RECITAL!"],
    bump: ["*BUMP* HA!", "Get off MY road!", "This is a 2004 Silverado, LADY!", "BAGUETTE TO THE FACE! …it's stale."],
    again: ["YOU AGAIN?! Round TWO!", "Remember ME?! I remember YOU!", "Pink convertible! I NEVER forget a pink convertible!"],
    lulu: ["Oy, a tailgater. Not today, buddy.", "Is he… shaking a BAGUETTE at me?", "Sir, this is a HIGHWAY, not your living room!", "Somebody needs a nap. And a hug."],
    luluFlat: "My TYRE! Who's gonna call Chaverim? …me. I'm gonna call Chaverim.",
    giveUp: ["Ugh, FORGET it! You're not WORTH it!", "I'm calling my therapist!"],
    outrun: ["See ya, Mr. Horn! 😎", "Bye-bye, Baguette Man!"],
    escaped: "😎 Left the road-rager in the dust!",
    flat: "🛞 FLAT TYRE! He clipped your wheel",
    flatSub: "call Chaverim from your 📱 (📞 Call) — or limp on it",
};

// ── 😎 the gang car ──────────────────────────────────────────────────────
export const GANG = {
    banner: "😎 A {color} car is TAILING you…",
    sub: "lose it — or lead it past a cop so they pull it over",
    lines: ["Nice convertible. Shame if somebody… complimented it.", "The boss wants a WORD. Just one. It's 'hi'.", "We're not following you! We're… also going this way.", "*waves a water pistol menacingly*", "*a banana pointed out the window like a gun*"],
    side: ["*waves a banana out the window* Bang. …it's a BANANA.", "*squirts a water pistol at your mirror* 💦", "Nice car. NICE car. Very… pink.", "*points two fingers at his eyes, then at you* …we're WATCHING. Also, your tyre's low."],
    again: ["It's HER again! Boss said bring her a fruit basket. As a THREAT."],
    lulu: ["Is that {color} car following me?", "Okay, they're DEFINITELY following me.", "Why is there a giant plush kugel on that roof?", "Is that a BANANA? Is he pointing a banana at me?"],
    giveUp: ["Boss says wrong pink convertible. Our bad! 👋", "We'll get you next time, Bruck! …we'll WAVE."],
    lost: "😎 Lost the {name}!",
};

// ── 🫳 the pickpocket ────────────────────────────────────────────────────
export const PICK = {
    bump: ["Oops! Pardon me, miss!", "Sorry! Didn't see ya!", "Excuse me, coming through!"],
    stole: "💸 −{n} 💰 — your pocket's lighter!",
    lulu: ["Hey! My COINS!", "HEY! Get back here!", "That's my gas money, you little—!"],
    lint: ["…lint? She's got LINT?!", "Not even a coin! What kind of road trip is this?"],
    run: ["Can't catch me!", "Too slow, lady!", "Wheee!"],
    again: ["Oh no. Not HER again. She TACKLES."],
    tackle: "🤼 TACKLE",
    tackled: ["Oof! FINE! Take 'em! …and my gum.", "OW! Okay okay, here! Don't tell my mother!"],
    luluTackle: ["Gotcha! Nobody steals from Lulu Bruck!", "TOUCHDOWN! …I mean, citizen's arrest!"],
    back: "🤼 Got 'em back! +{n} 💰",
    gone: "💨 He got away with {n} 💰…",
    mom: "My Yossi took your coins?! I'm SO sorry. Sending them back with interest. — his mother 👵",
};

// ── 🔦 Shomrim / 🔧 Chaverim tie-ins (the 📞 Call app) ───────────────────
export const COMM = {
    rager: { icon: "😡", label: "Report a road-rager", sub: "he's right behind me!" },
    gang: { icon: "😎", label: "A car is following me", sub: "they LOVE this" },
    pickpocket: { icon: "🫳", label: "A pickpocket took my coins!", sub: "Shomrim on foot. They jog." },
    flat: { icon: "🛞", label: "A road-rager gave me a flat", sub: "a new tyre, a bracha" },
    lines: {
        car: ["Shomrim! A car's harassing you? We're coming. We've been WAITING for this.", "Lights on. Antennas UP. Stay in your lane, we'll handle this."],
        foot: ["A pickpocket? On OUR watch? Stay right there. Moishe's jogging over. He's fast. For Moishe."],
        flat: ["Chaverim. A road-rager? Nebach. Somebody's two minutes away with a tyre."],
    },
    caught: ["SHOMRIM! Pull over! We have you on VIDEO! …lens cap. We have you on AUDIO!", "Sir! Step out of the vehicle! We can't make you, but we'd LOVE it."],
    badCaught: ["Who ARE you guys?!", "Aw, nuts. Not the Shomrim.", "I want my LAWYER! …and a cholent."],
    foot: ["STOP! Shomrim! I'm… *wheeze* …not running anymore. YOU stop."],
    done: "🔦 Shomrim held him for the cops!",
    late: "🔦 Shomrim lost him by the bagel place…",
};

// ── 🚓 a real cop pulls a bad guy over ───────────────────────────────────
export const COPBUST = {
    banner: "🚓 The cops pulled HIM over!",
    sub: "you led him right past a cruiser 😇",
    cop: ["License and registration, tough guy.", "Sir, were you just shaking a BAGUETTE at that lady?", "Out of the car. Slowly. Leave the banana."],
    bad: ["Officer, SHE started it!", "This is a misunderstanding!", "Can I at LEAST finish my baguette?"],
    lulu: ["Have a NICE day, sir! 😇", "Justice! Delicious justice!", "Bye-bye! Drive safe!"],
};

// ── 🧠 rivals & memory texts ─────────────────────────────────────────────
export const MEMO = {
    bustedText: { rager: "My lawyer says I'm not allowed to text you. This isn't a text. — {name}", gang: "The boss says no hard feelings. The boss lies. — {name}", pickpocket: "I'm going straight now. Straight to my mother's. — {name}" },
    escapedText: { rager: "You got LUCKY, pink convertible. — {name}", gang: "We'll find you, Lulu. We have your license plate. And a fruit basket. — {name}" },
};

// ── 📒 scrapbook page ────────────────────────────────────────────────────
export const PAGE = {
    title: "🕶️ The Underworld",
    note: "Heat cools while you drive clean. High heat = cops on alert.",
    empty: "No rivals yet. Keep it that way? 😇",
};
