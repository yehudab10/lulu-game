// features/law — every line, charge, number and odd from the 2D game's
// src/05-driving-loop.js (cops, chases, pull-overs) and src/10d-jail-court.js
// (arrest → booking → cell → courtroom → escape / fugitive), kept verbatim.
// 2D px → 3D metres at ≈11.7 px per m where a distance is involved.

// ── spawn tuning (src/01b-spawn-tuning.js) ───────────────────────────────
export const SPAWN = {
    copHide: { first: [22, 60], every: [35, 75], chance: 0.55 },   // 🚓 hidden roadside speed-trap cop
};
export const SPEED_LIMIT = 70;          // mph on the signs
export const SPEEDING_MPH = 75;         // what the radar actually flags (same tolerance as the core traps)

// ── pull-over (copBust) ──────────────────────────────────────────────────
export const COP_LINE_DUR = 1.55;       // seconds each line lingers (tap to skip)
export const COP_SCENES = [
    // She gets off (bribe / charm / other)
    { outcome: "free", tactic: "snack", title: "LET OFF! 🍀", lines: [
        ["cop", "License and registration."], ["lulu", "Officer... warm rugelach? 🥧"], ["cop", "...is that cinnamon?"],
        ["lulu", "Still warm. 😇"], ["cop", "*takes two* Slow down, kid."]] },
    { outcome: "free", tactic: "bribe", title: "WHAT TICKET? 💸", lines: [
        ["cop", "Know how fast you were going?"], ["lulu", "*slips a $20* Do YOU?"], ["cop", "...I saw nothing."], ["lulu", "Pleasure, officer! 😘"]] },
    { outcome: "free", tactic: "charm", title: "CHARMED! 💕", lines: [
        ["cop", "Step out of the vehicle."], ["lulu", "Anyone say you look like a movie star?"], ["cop", "...my wife says that."],
        ["lulu", "She's RIGHT. 💕"], ["cop", "Ehh. Warning."]] },
    { outcome: "free", tactic: "family", title: "BUBBE KNOWS HIM! 🍲", lines: [
        ["cop", "Name?"], ["lulu", "Bruck. You know my Bubbe?"], ["cop", "...Bubbe Bruck?! The CHOLENT?!"],
        ["lulu", "Fridays at six. 🍲"], ["cop", "Tell her Moishy says hi. GO!"]] },
    { outcome: "free", tactic: "tears", title: "CROCODILE TEARS 😭", lines: [
        ["cop", "That's a big ticket, ma'am."], ["lulu", "*sniffle* It's been SUCH a day"], ["cop", "Oh— no— don't— okay, okay—"],
        ["lulu", "*sniff* ...really?"], ["cop", "Just GO. Please stop crying. 😭"]] },
    // She gets the ticket (→ booked)
    { outcome: "ticket", tactic: "honest", title: "BUSTED! 🚨", lines: [
        ["cop", "Know why I pulled you over?"], ["lulu", "The three reds? Or the speeding?"], ["cop", "...there were THREE?!"], ["lulu", "...two. 😬"]] },
    { outcome: "ticket", tactic: "bribe", title: "BRIBE FAIL! 🚨", lines: [
        ["cop", "License and registration."], ["lulu", "*slips a $20*"], ["cop", "Is this a BRIBE?!"], ["lulu", "...a tip? 😬"]] },
    { outcome: "ticket", tactic: "sass", title: "SASSED! 🚨", lines: [
        ["cop", "Step out of the vehicle."], ["lulu", "I PAY your salary!"], ["cop", "And I write YOUR tickets."], ["lulu", "...fair. 😬"]] },
    // Impounded → she walks (on-foot mode)
    { outcome: "walk", title: "IMPOUNDED! 🚧", lines: [
        ["cop", "This reg expired in 2019."], ["lulu", "It's VINTAGE! 💅"], ["cop", "It's getting TOWED."], ["lulu", "...walking it is. 🚶‍♀️"]] },
    { outcome: "walk", title: "IMPOUNDED! 🚧", lines: [
        ["cop", "Whose car is this?"], ["lulu", "Define 'whose'..."], ["cop", "TOW it."], ["lulu", "Oof. 🚶‍♀️"]] },
    // more LET-OFFs
    { outcome: "free", tactic: "family", title: "COUSIN ESTI?! 💅", lines: [
        ["cop", "Step out, please."], ["lulu", "You went to Esti's wedding!"], ["cop", "...the open bar. Great herring."],
        ["lulu", "Mishpacha! 💕"], ["cop", "Ach, GO already."]] },
    { outcome: "free", tactic: "shabbos", title: "RUNNING LATE! ⏰", lines: [
        ["cop", "What's the rush?"], ["lulu", "Candle-lighting in TEN minutes!"], ["cop", "...oh. OH. GO. DRIVE SAFE— GO!"], ["lulu", "Good Shabbos! 🕯️"]] },
    { outcome: "free", tactic: "snack", title: "DASHBOARD DEAL 🍪", lines: [
        ["cop", "This is a NO-stopping zone."], ["lulu", "Black-and-white cookie? Fresh."], ["cop", "...is the white side bigger?"],
        ["lulu", "For YOU it is. 😇"], ["cop", "Move along."]] },
    // more TICKETS
    { outcome: "ticket", tactic: "honest", title: "NO DICE 🚨", lines: [
        ["cop", "Eighty in a thirty, Bruck."], ["lulu", "I was... rounding DOWN?"], ["cop", "To EIGHTY?"], ["lulu", "...generously. 😬"]] },
    { outcome: "ticket", tactic: "sass", title: "TOO MUCH SASS 🚨", lines: [
        ["cop", "Anything to say for yourself?"], ["lulu", "Love the hat. Very 'mall cop.'"], ["cop", "That'll be EXTRA."], ["lulu", "...worth it. 😬"]] },
    { outcome: "ticket", tactic: "shabbos", title: "PHONE A FRIEND 🚨", lines: [
        ["cop", "Were you TEXTING?"], ["lulu", "It was a VOICE note! Totally legal!"], ["cop", "It is NOT."], ["lulu", "...send. 😬"]] },
    // more IMPOUNDS
    { outcome: "walk", title: "IMPOUNDED! 🚧", lines: [
        ["cop", "Plates don't match the car."], ["lulu", "It's a... costume!"], ["cop", "For the CAR?"], ["lulu", "...walking. 🚶‍♀️"]] },
];
// 3D: after the cop names the charge, Lulu picks HOW she plays it. The 2D odds
// (10% impound · ~22% let off · the rest booked) are the average across these.
export const BUST_TACTICS = [
    { id: "snack",   label: "🥧 Offer him a snack",       free: 0.30 },
    { id: "bribe",   label: "💸 Slip him a $20",          free: 0.30, bribe: true },
    { id: "charm",   label: "💕 Turn on the charm",       free: 0.24 },
    { id: "family",  label: "👵 Name-drop the family",    free: 0.26 },
    { id: "tears",   label: "😭 Turn on the waterworks",  free: 0.22 },
    { id: "shabbos", label: "🕯️ \"It's almost Shabbos!\"", free: 0.20 },
    { id: "sass",    label: "😤 Sass him",                free: 0.06 },
    { id: "honest",  label: "😇 Come clean",              free: 0.12 },
];
export const COP_PULLOVER = ["License & reg!", "Step out!", "Been DRINKING?!", "It was ONE lechaim!",
    "Define 'drunk'...", "I'm FINE officer!", "Blow into this.", "Eyes on the road!",
    "Where's the FIRE?", "You a race car?", "Slow your TUCHUS!", "Registration. NOW."];

// ── Lulu IS the cop (copStop: driving a cruiser, she pulls others over) ──
export const COP_STOP_SCENES = [
    { outcome: "bribe", title: "💵 BRIBE POCKETED!", reward: 30, lines: [
        ["lulu", "License and registration!"], ["driver", "Officer... for the 'coffee fund'? 💵"], ["lulu", "...I take cash."], ["driver", "Pleasure doing business! 😎"]] },
    { outcome: "bribe", title: "💵 KICKBACK!", reward: 35, lines: [
        ["lulu", "Do you know how fast you were going?"], ["driver", "Fast enough to slip you a fifty? 🤑"], ["lulu", "Drive safe, citizen. 😇"]] },
    { outcome: "bribe", title: "💵 'DONATION' MADE", reward: 28, lines: [
        ["lulu", "Step out of the vehicle!"], ["driver", "Rugelach AND twenty bucks? 🥧"], ["lulu", "...for the PRECINCT. Go."]] },
    { outcome: "jail", title: "🚔 HAULED TO JAIL!", reward: 45, lines: [
        ["lulu", "You were FLYING!"], ["driver", "I'm LATE for kiddush!"], ["lulu", "Tell it to the JUDGE!"], ["driver", "Aw, nuts. 🚔"]] },
    { outcome: "jail", title: "🚔 BOOKED!", reward: 40, lines: [
        ["lulu", "You ran THREE red lights!"], ["driver", "They were ...orange-ish?"], ["lulu", "In the car. Let's GO."]] },
    { outcome: "letgo", title: "⚠️ WARNING GIVEN", reward: 8, lines: [
        ["lulu", "Slow it down, bubbeleh."], ["driver", "Yes, officer! Thank you! 🙏"]] },
    { outcome: "letgo", title: "⚠️ LET OFF", reward: 8, lines: [
        ["lulu", "I'll let it slide... once."], ["driver", "You're an ANGEL! 😇"]] },
    { outcome: "runs", title: "💨 THEY BOLTED!", reward: 0, lines: [
        ["lulu", "Step out of the—"], ["driver", "...NEVER!! 🏃💨"], ["lulu", "...oy. 🚓💨"]] },
    { outcome: "runs", title: "💨 RUNNER!", reward: 0, lines: [
        ["lulu", "Pull over NOW!"], ["driver", "Catch me, copper! 😜"]] },
];

// ── arrest cinematic ─────────────────────────────────────────────────────
export const ARREST_LINES = ["YOU'RE UNDER ARREST!", "Hands where I can see 'em!",
    "End of the road, Lulu!", "You're comin' with ME.", "Step out of the vehicle, ma'am.",
    "Book 'em, Danno!", "You have the right to remain... fabulous.", "That's a paddlin'. And a cuffin'."];
export const LULU_ARREST_LINES = ["I was barely OVER the limit!", "Do you KNOW who my Bubbe is?",
    "This is POLICE harassment!", "Can I at least fix my SHEITEL first?",
    "I want my ONE phone call!", "I'm calling my LAWYER. ...do I have one?",
    "Ugh, these cuffs are SO last season.", "I'll be out by Shabbos, you'll SEE."];
export const CUFF_LINES = ["🔗 *CLICK* — gotcha.", "🔗 Cuffs ON. Watch your head.",
    "🔗 You're goin' DOWNTOWN.", "🔗 Easy does it, Ms. Bruck."];
export const CHARGE_DIALOGUE = [
    { key: "GRAND THEFT AUTO", cop: ["That car wasn't YOURS, Lulu!", "Boostin' cars now?! That's a FELONY!", "Hot-wire artist, huh? Cute. Cuffs."],
        lulu: ["I was just BORROWING it!", "It had the keys IN it! ...basically.", "Finders keepers is a LAW, no?"] },
    { key: "JOYRIDING", cop: ["Joyride's OVER, lead-foot.", "Fun's done. Out of the car."],
        lulu: ["It's only a joyride if I'm having FUN. I wasn't!", "Define 'joy.' Loosely."] },
    { key: "PEPPER", cop: ["You MACED me?! MY EYES!", "Assaulting an officer — that's HARD time, lady!"],
        lulu: ["You startled me! Reflexes!", "It was for my SELF-DEFENSE. From YOU."] },
    { key: "ASSAULT", cop: ["You laid hands on an OFFICER.", "Nobody touches the badge, Lulu."],
        lulu: ["I have very ASSERTIVE hands.", "He was ASKING for it, your hon— officer."] },
    { key: "HIT AND RUN", cop: ["You FLED the scene, Bruck!", "Hit somethin' and BOLTED. Classy."],
        lulu: ["I didn't flee, I... left briskly.", "There was NO scene. I made GREAT time though."] },
    { key: "RECKLESS", cop: ["Drivin' like a MANIAC out there!", "Reckless! You coulda killed a GOOSE!"],
        lulu: ["I prefer 'spirited.'", "Reckless? I PARALLEL park flawlessly!"] },
    { key: "SPEEDING", cop: ["Eighty in a forty, Ms. Bruck.", "You blew past me like I was PARKED."],
        lulu: ["Everyone was going slow! ...except me.", "I was keeping up with TRAFFIC. In my MIND."] },
    { key: "ESCAPE", cop: ["Back to the cell, fugitive!", "Thought you could RUN from us?"],
        lulu: ["I was just stretching my legs! For a WEEK!", "The jumpsuit washes me out, I HAD to leave."] },
    { key: "BRIB", cop: ["Tried to BRIBE the law, eh?", "Your 'envelope' just bought you CHARGES."],
        lulu: ["It was a GIFT! For your birthday! ...whenever!", "That wasn't a bribe, it was a... tip."] },
    { key: "EVADING", cop: ["You ran from a HELICOPTER, genius.", "Quite the chase. You LOSE."],
        lulu: ["I waved! That's basically cooperating!", "I thought it was a FAN. Of mine."] },
];
export const CHARGE_DEFENSE = [
    { key: "GRAND THEFT AUTO", arg: "the so-called 'theft' was a spirited TEST-DRIVE — no intent to permanently deprive!" },
    { key: "JOYRIDING", arg: "'joyriding' implies JOY; my client will testify she felt only mild contentment." },
    { key: "PEPPER", arg: "the spray was a textbook reflexive act of SELF-DEFENSE." },
    { key: "ASSAULT", arg: "my client never STRUCK the officer — she GESTURED. Emphatically. It's protected expression." },
    { key: "HIT AND RUN", arg: "she did not 'flee' — she departed to summon HELP. Deeply civic, really." },
    { key: "RECKLESS", arg: "'reckless' is subjective; the record shows only CONFIDENT car-handling." },
    { key: "SPEEDING", arg: "the radar gun was plainly miscalibrated, as these devices notoriously are." },
    { key: "ESCAPE", arg: "one cannot 'escape' a cell whose door was, arguably, left AJAR." },
    { key: "BRIB", arg: "that envelope was a CHARITABLE donation to the policeman's ball. Tax-deductible, even." },
    { key: "EVADING", arg: "my client cannot have EVADED a pursuer she did not know was pursuing her." },
];

// ── the cell ─────────────────────────────────────────────────────────────
export const CELLMATE_LINES = ["What're you in for? 😏", "I'm INNOCENT. ...mostly.",
    "Psst — wanna dig a tunnel?", "The food here is a CRIME too.", "Third time this week!",
    "You got a good lawyer?", "I just jaywalked, I SWEAR.", "They never proved nothin'.",
    "Snitches get... extra pudding.", "First timer, huh? Cute.", "Don't drop the kugel.",
    "Your sister's that ER nurse? My BACK is killin' me.", "Bruck? As in NURSE Tammy Bruck??",
    "Tammy stitched me up once. Sweet girl. Scary needle."];
export const CELLMATE_FAMOUS = ["Wait — YOU'RE the one who keeps BREAKING OUT?! Teach me!",
    "They named a CELL after you. This one. It leaks.", "Back AGAIN? You treat this place like a hotel.",
    "The guards have your FACE on a dartboard, y'know.", "Legend says you tunneled with a SPOON. Is it true??",
    "I lost count of your breakouts. So did the WARDEN. Respect.", "You're famous in here. Sign my jumpsuit?"];
export const JAIL_LIFE = ["🍖 Mystery meat for dinner... again.", "😴 Cellmate snores like a CHAINSAW.",
    "📢 ROLL CALL! Everybody UP.", "🥄 You sculpted a shiv... out of pudding.",
    "💪 Yard time: 200 push-ups.", "🚿 Cold shower. ICE cold.", "📺 The one TV is stuck on C-SPAN.",
    "🐀 You named the cell mouse Heshy.", "✉️ A letter from Bubbe! ...it's a bill.",
    "🔔 Lights out. Then lights ON. Then OUT.", "🧻 Out of toilet paper. AGAIN.",
    "🍮 Traded your pudding for a 'favor'.", "📓 You started a prison memoir. It's just complaints."];
export const LULU_CELL_LINES = ["Bubbe is gonna PLOTZ.", "This jumpsuit is NOT my color.",
    "I get ONE phone call, right?", "I was barely speeding!", "Avigail set me up, I KNOW it.",
    "Is there a kosher option?", "I demand to see a JUDGE.", "These bars clash with everything."];
export const JAIL_ESCAPES = [
    { kind: "cart", cap: "🛒 You stroll out behind the lunch cart like you BELONG here.",
        alt: ["🛒 Nobody questions a woman pushing a cart with PURPOSE.", "🛒 The cart squeaks. You squeak back. You're out."] },
    { kind: "disguise", cap: "👮 Two puddings bought a guard's cap. Salute… and SAUNTER out.",
        alt: ["👮 In the cap you ARE the law. Briefly. Walk tall.", "👮 'Evening, officer.' 'Evening, ME.' Out you go."] },
    { kind: "keys", cap: "🗝️ The guard's snoring — you lift his keys with a hairpin.",
        alt: ["🗝️ He dreams of donuts. You dream of FREEDOM. Click.", "🗝️ Tiptoe, jingle, gone. Sweet dreams, officer."] },
    { kind: "faint", cap: "😵 You fake a faint — the guard rushes in, and you BOLT past him!",
        alt: ["😵 'She's DOWN!' …and then she's GONE. Oscar-worthy.", "😵 One dramatic swoon, one wide-open door. Exit, stage left."] },
    { kind: "vent", cap: "🌀 Up into the air vent, spy-movie style. Don't look down.",
        alt: ["🌀 You shimmy through the ductwork like a glamorous raccoon.", "🌀 Dusty, cramped, ICONIC. The vent delivers you to freedom."] },
    { kind: "tunnel", cap: "🥄 Weeks of pudding-spoon digging pays off. See ya, suckers!",
        alt: ["🥄 You surface in the yard, dirt in your sheitel, FREE.", "🥄 The tunnel smelled like pudding. Worth it. You're out."] },
];
export const EXTRA_CHARGES = ["UNPAID PARKING (47 TICKETS)", "IMPERSONATING A NICE LADY",
    "EXCESSIVE SASS", "JAYWALKING WITH INTENT", "POSSESSION OF RUGELACH",
    "DISTURBING THE PEACE (LOUDLY)", "DRIVING WHILE FABULOUS"];
export const SERVE_ACTS = ["🏃 jogging in place", "📖 reading the rulebook", "🎵 prison blues", "✏️ scratching a tally", "🚶 pacing the cell"];

// ── the courtroom ────────────────────────────────────────────────────────
export const PROSECUTOR_LINES = ["The defendant is a MENACE, your honor!", "We have her DEAD to rights!",
    "Throw the BOOK at her — the WHOLE library!", "She showed NO remorse — only SASS!",
    "The PEOPLE demand justice! And a refund!", "I've never seen a clearer case in my LIFE.",
    "Lock her up and lose the key. Then lose the LOCK.", "Exhibit A: her DRIVING. Exhibit B: her ATTITUDE.",
    "Three witnesses, your honor. All TERRIFIED.", "I rest my case. ...okay I don't, but LOOK at her."];
export const JUDGE_INTROS = ["Order! ORDER in my court!", "This had BETTER be good...",
    "I haven't even had my coffee. Make it QUICK.", "Let's be brief — I tee off at noon.",
    "What FRESH nonsense is this?", "Ms. Bruck. AGAIN. We really must stop meeting like this.",
    "I had a lovely brisket planned. Then THIS case appeared.", "Bailiff, my gavel. ...the HEAVY one.",
    "Settle down. The sooner we start, the sooner I can NAP."];
export const OBJECTIONS = ["OBJECTION! She's making that UP!", "OBJECTION! Leading the jury by the NOSE!",
    "OBJECTION! That's hearsay AND chutzpah!", "OBJECTION — she WINKED at me, your honor!",
    "OBJECTION! The defense is pure FARFEL!", "OBJECTION! She did the SAME thing last TUESDAY!",
    "OBJECTION! Counsel is being... CHARMING. It's distracting!", "OBJECTION! That's not a LAW, that's a VIBE!"];
export const JUDGE_SUSTAIN = ["Sustained. Nice try, Ms. Bruck.", "Sustained! Strike that from the record.",
    "Sustained. I'm not buying what you're selling.", "Sustained. And frankly, RUDE."];
export const JUDGE_OVERRULE = ["Overruled. Sit DOWN, counselor.", "Overruled. Let the woman finish.",
    "Overruled — honestly, I rather LIKED it.", "Overruled. That objection bored me."];
export const COURT_REACTS = ["*the gallery murmurs* 🤔", "*a juror nods slowly...* ", "*the stenographer stops typing to stare*",
    "*someone in the back whispers 'iconic'*", "*the prosecutor's eye TWITCHES*", "*the judge sips coffee, unimpressed*"];
export const COURT_GALLERY_GUESTS = [
    { p: "abba", name: "ABBA", lines: ["THAT'S MY GIRL! ...order, your honor. ❤️", "She's a GOOD girl, I SWEAR!", "Objection! She's my DAUGHTER!"] },
    { p: "hillel", name: "HILLEL", lines: ["Statistically she's ...mostly innocent?", "I'm just here for moral support! 😅", "For the record, I did NOT advise this."] },
    { p: "raphael", name: "UNCLE RAPHAEL", lines: ["Throw the book! ...kidding. Mostly. 😏", "In MY day: a fine and a HANDSHAKE.", "Feh. Where's Hillel? *grumble*"] },
    { p: "bubbe", name: "BUBBE", lines: ["She didn't EAT today! Mercy! 🍲", "My LULULEH wouldn't hurt a FLY!", "I'll bake the judge a cholent — DEAL?"] },
    { p: "avigail", name: "AVIGAIL", lines: ["Guilty, guilty. ...just my opinion. 💅", "I drove here PERFECTLY, by the way.", "Should I livestream the verdict? 🤳"] },
    { p: "fayge", name: "SISTER FAYGE", lines: ["She's a GOOD girl! ...hold the salt. 🧂", "Order! Baby Chani is trying to NAP! 👶", "Acquit her — and NO sodium, feh!"] },
    { p: "yedidya", name: "YEDIDYA", lines: ["Objection! Raw milk cures whatever THIS is!", "She needs a COW, not a courtroom! 🥛", "She's family — and SINGLE, your honor. Hint."] },
    { p: "burry", name: "COUSIN BURRY", lines: ["Chill, your honor... it's all good, man 😎", "In Vegas this isn't even a CRIME, cuz 🎲", "Mindy, you filming this? ...for the kids."] },
    { p: "shuey", name: "DR. SHUEY", lines: ["As a doctor, I advise ...leniency? 🩺", "Go easy — rough year. Divorce, then my CAT. 😿", "Avraham, wave to Aunt Lulu! 👋"] },
];
export const AVIGAIL_FRIEND_LINES = ["She's with ME, your honor. 💜", "Objection! She's my best friend!", "Free her — we have a NAIL appointment. 💅"];
export const AVIGAIL_FRIEND_EVENT = { id: "avigail", nudge: "help", lines: [
    { who: "BAILIFF", p: "bailiff", text: "A character witness takes the stand, your honor!" },
    { who: "AVIGAIL", p: "avigail", text: "This woman drove me to MY OWN WEDDING. She's a mensch. 💜" },
    { who: "JUDGE", p: "judge", text: "...high praise from a bride. Noted FAVORABLY." }] };
export const COURT_EVENTS = [
    { id: "avigail", nudge: "hurt", lines: [
        { who: "BAILIFF", p: "bailiff", text: "A surprise witness takes the stand, your honor!" },
        { who: "AVIGAIL", p: "avigail", text: "She cut me off in the CARPOOL lane. With a SMILE. 😤" },
        { who: "JUDGE", p: "judge", text: "...the court notes the carpool incident. Tsk tsk." }] },
    { id: "bubbe", nudge: "help", lines: [
        { who: "BAILIFF", p: "bailiff", text: "A character witness approaches the bench..." },
        { who: "BUBBE", p: "bubbe", text: "My Lulu?! She brings me SOUP every Shabbos! An ANGEL! 👵" },
        { who: "JUDGE", p: "judge", text: "...I do love a good soup. Noted FAVORABLY." }] },
    { id: "fayge", nudge: "help", lines: [
        { who: "BAILIFF", p: "bailiff", text: "A character witness steps up — baby in arms, your honor." },
        { who: "SISTER FAYGE", p: "fayge", text: "My SISTER drove me to every low-sodium clinic in the COUNTY! A saint! 🧂" },
        { who: "SISTER FAYGE", p: "fayge", text: "*rocks baby* Shhh, Chani, mommy's defending Auntie Lulu... 👶" },
        { who: "JUDGE", p: "judge", text: "...a devoted sister. And such a quiet baby. The court is charmed." }] },
    { id: "phone", nudge: "hurt", charge: "CONTEMPT OF COURT (PHONE)", lines: [
        { who: "JUDGE", p: "judge", text: "Is that a PHONE ringing in MY courtroom?!" },
        { who: "LULU", p: "lulu", text: "One sec— HI IMA! ...no, I'm in COURT. I'll call back! 📞" },
        { who: "JUDGE", p: "judge", text: "CONTEMPT! That's a brand-NEW charge, missy." }] },
    { id: "golf", nudge: "help", lines: [
        { who: "JUDGE", p: "judge", text: "*taps watch* I tee off in twenty minutes. Let's WRAP this." },
        { who: "PROSECUTOR", p: "prosecutor", text: "But your honor — the EVIDENCE—!" },
        { who: "JUDGE", p: "judge", text: "The evidence can WAIT. The ninth hole CANNOT." }] },
    { id: "hair", nudge: "help", lines: [
        { who: "JUDGE", p: "judge", text: "Juror four says you did her... HIGHLIGHTS?" },
        { who: "LULU", p: "lulu", text: "Babka balayage, forty bucks. I'll do YOURS too, your honor. 💇" },
        { who: "JUDGE", p: "judge", text: "...we'll discuss it in chambers. Noted favorably." }] },
    { id: "coffee", nudge: "help", lines: [
        { who: "BAILIFF", p: "bailiff", text: "Your honor — your coffee. Two sugars, splash of oat. ☕" },
        { who: "JUDGE", p: "judge", text: "...ahhh. You know what? Suddenly I feel MERCIFUL." }] },
    { id: "gasp", nudge: "none", lines: [
        { who: "BAILIFF", p: "bailiff", text: "*the entire gallery GASPS in unison* 😱" },
        { who: "JUDGE", p: "judge", text: "ORDER! One more gasp and I CLEAR the room!" }] },
    { id: "faint", nudge: "help", lines: [
        { who: "BAILIFF", p: "bailiff", text: "The STENOGRAPHER just fainted, your honor! 😵" },
        { who: "JUDGE", p: "judge", text: "Someone fetch a juice box! ...we'll go EASY, given the bedlam." }] },
    { id: "fly", nudge: "hurt", lines: [
        { who: "BAILIFF", p: "bailiff", text: "A FLY is loose in the courtroom — total pandemonium! 🪰" },
        { who: "JUDGE", p: "judge", text: "*SWATS the gavel* CONTEMPT! ...the insect. And YOU, a little." }] },
    { id: "objection", nudge: "hurt", lines: [
        { who: "PROSECUTOR", p: "prosecutor", text: "OBJECTION! She's doing JAZZ HANDS at the jury! 🙌" },
        { who: "LULU", p: "lulu", text: "It's called CHARISMA, your honor. Sustained?" },
        { who: "JUDGE", p: "judge", text: "OVERRULED. And stop that. ...mostly." }] },
    { id: "babka", nudge: "help", lines: [
        { who: "BUBBE", p: "bubbe", text: "*wheels a CART of babka into the gallery* Nu, everybody EAT! 🍰" },
        { who: "JUDGE", p: "judge", text: "...is that chocolate? The court will take a SHORT recess. Favorably." }] },
];
export const COURT_MISTRIAL = { id: "mistrial", nudge: "dismiss", lines: [
    { who: "LULU", p: "lulu", text: "Your honor — the bailiff SNEEZED during my oath. MISTRIAL!" },
    { who: "JUDGE", p: "judge", text: "...you know what? I'm hungry. Case DISMISSED. Everybody OUT." }] };

export const LAWYER_TIERS = [
    { name: "Public Defender", feeMul: 6, mitig: 0.25, blunder: 0.28, accent: "#90A4AE", tag: "cheap — might BLUNDER",
        colors: { Top: "#78909C", Bottom: "#546E7A", Tie: "#B0BEC5" },
        says: ["Uh... first day! Is this the right courtroom? 😬", "I... did NOT read the file. Is it bad? It's bad, right?",
            "Objection! ...wait, am I the prosecutor? No? Okay.", "I passed the bar on the THIRD try. We've got this. Maybe.",
            "My other client's also at 2pm, so let's, uh, hustle."] },
    { name: "Local Attorney", feeMul: 19, mitig: 0.58, blunder: 0.05, accent: "#80CBC4", tag: "solid odds",
        colors: { Top: "#00695C", Bottom: "#263238", Tie: "#80CBC4" },
        says: ["We'll fight this. I read MOST of the file. 🤵", "Reasonable doubt is my middle name. Well — it's Steven.",
            "I've won cases like this. ...A few. Some. One. We're good.", "Let me handle the judge — we golf. Badly, but we golf.",
            "Stay calm, look innocent, and let me do the talking."] },
    { name: "Hotshot Lawyer", feeMul: 44, mitig: 0.86, blunder: 0, accent: "#FFD54F", tag: "pricey — best odds",
        colors: { Top: "#212121", Bottom: "#212121", Tie: "#FFD54F" },
        says: ["They don't have a CASE. Watch this. 😎", "I bill more per hour than that fine. Relax.",
            "Your honor, I'll be brief, devastating, and correct.", "I've never lost. Don't check that. Just — trust me. 💼",
            "By the time I'm done, THEY'LL be apologizing to YOU."] },
];
export const ABBA_TIER = { name: "Abba", feeMul: 0, free: true, mitig: 0.80, blunder: 0, accent: "#FFB74D",
    portrait: "abba", tag: "FREE — he's your DAD ❤️",
    says: ["That's my DAUGHTER, your honor. Show a little RACHMONES. ❤️", "I changed her diapers. THIS is who you're prosecuting?",
        "Your honor, between us fathers... let it slide, nu?", "She's a GOOD girl. A FAST girl, but a good one. ❤️"] };
export const ABBA_RETAIN_LINES = ["👨‍⚖️ ABBA took the case — for FREE! ❤️", "👨‍⚖️ \"For you, bubbeleh? No charge.\"",
    "👨‍⚖️ Abba cracks his knuckles. \"Watch THIS.\"", "👨‍⚖️ \"Don't tell Ima how fast you were going.\""];

// The BOUNTY: severity-weighted and capped; bail / fine / plea all derive from it.
export const CHARGE_WEIGHT = {
    "SPEEDING": 1, "DISTURBING THE PEACE": 1, "BEING SUSPICIOUS": 1, "JAYWALKING": 1,
    "RECKLESS DRIVING": 2, "RESISTING ARREST": 2, "ATTEMPTED ESCAPE": 2,
    "ATTEMPTED BRIBERY": 2, "BRIBING A COURT OFFICIAL": 2, "CONTEMPT OF COURT": 2,
    "RUNNING FROM THE LAW": 3, "HIT AND RUN": 3, "JOYRIDING A STEAMROLLER": 3, "ESCAPE FROM CUSTODY": 3,
    "GRAND THEFT AUTO": 4, "VEHICULAR DESTRUCTION": 4,
};
export const BOUNTY_CAP = 400;

export const DEFENSE_POOL = [
    { label: "🥺 Plead & cry", says: "Your honor, it's been SUCH a hard week... 😭", outcomes: [["dismissed", 0.45], ["fine", 0.40], ["jail", 0.15]] },
    { label: "💸 'Tip' the judge", says: "*slides an envelope* For your robe fund 💵", outcomes: [["dismissed", 0.55], ["fine", 0.20], ["jail", 0.25]], bribe: true },
    { label: "🤬 Blame Avigail", says: "AVIGAIL dared me to, your honor!", outcomes: [["dismissed", 0.30], ["fine", 0.50], ["jail", 0.20]] },
    { label: "🧠 Plead insanity", says: "I'm not crazy — the ROAD is! 🌀", outcomes: [["dismissed", 0.35], ["fine", 0.35], ["jail", 0.30]] },
    { label: "👵 Invoke Bubbe", says: "My Bubbe makes the JUDGE'S favorite cholent!", outcomes: [["dismissed", 0.50], ["fine", 0.40], ["jail", 0.10]] },
    { label: "😇 'I'm a good girl'", says: "Me? I've never even SPED, officer— judge!", outcomes: [["dismissed", 0.40], ["fine", 0.45], ["jail", 0.15]] },
    { label: "🎤 OBJECT!", says: "OBJECTION! On the grounds of... vibes. 💅", outcomes: [["dismissed", 0.40], ["fine", 0.40], ["jail", 0.20]] },
    { label: "🍪 Bribe the JURY", says: "*passes rugelach down the jury box* 🍪", outcomes: [["dismissed", 0.55], ["fine", 0.25], ["jail", 0.20]], bribe: true },
    { label: "💃 Dazzle the court", says: "*little tap routine* Charges dropped now? 💃", outcomes: [["dismissed", 0.50], ["fine", 0.30], ["jail", 0.20]] },
    { label: "🤥 Lie (badly)", says: "I wasn't there. Or driving. Or... born.", outcomes: [["dismissed", 0.30], ["fine", 0.40], ["jail", 0.30]] },
    { label: "🙏 Beg for mercy", says: "Mercy! I'll never speed again! ...today.", outcomes: [["dismissed", 0.50], ["fine", 0.40], ["jail", 0.10]] },
];

// ── chases ───────────────────────────────────────────────────────────────
export const APB_FAST = ["📻 SPEEDING REPORTED — PURSUE!", "📻 RECKLESS DRIVER — ALL UNITS!", "🚨 APB ON A PINK CAR!"];
export const APB_SLOW = ["🚨 APB ON A PINK CAR!", "🚓 SOMEONE CALLED IT IN!", "📻 SHE'S BACK AT IT — GO GO GO!"];
export const PEPPER_COP = "😡 BIG mistake!";

// Who speaks, for the dialogue box: name, emoji, colour.
export const SPEAKERS = {
    cop: { name: "OFFICER", emoji: "👮", color: "#1565C0" },
    lulu: { name: "LULU", emoji: "💁‍♀️", color: "#E91E63" },
    driver: { name: "DRIVER", emoji: "😬", color: "#6D4C41" },
    judge: { name: "JUDGE", emoji: "👨‍⚖️", color: "#7E57C2" },
    prosecutor: { name: "PROSECUTOR", emoji: "🧑‍💼", color: "#C62828" },
    bailiff: { name: "BAILIFF", emoji: "👮", color: "#546E7A" },
    avigail: { name: "AVIGAIL", emoji: "💅", color: "#8E24AA" },
    bubbe: { name: "BUBBE", emoji: "👵", color: "#8E5CC2" },
    fayge: { name: "SISTER FAYGE", emoji: "👶", color: "#00897B" },
    cellmate: { name: "CELLMATE", emoji: "🧔", color: "#E64A19" },
    abba: { name: "ABBA", emoji: "👨", color: "#EF6C00" },
    lawyer: { name: "LAWYER", emoji: "🤵", color: "#00695C" },
    guard: { name: "GUARD", emoji: "👮", color: "#455A64" },
};
