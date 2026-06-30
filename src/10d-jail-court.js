    // ════════════════════════════════════════════════════════════
    //  JAIL → COURTROOM → ESCAPE → FUGITIVE  (RPG-style presentation)
    //  Booked offenders cool off in a detailed cell (escape / bail / court),
    //  then face a scripted courtroom that plays out through a visual-novel
    //  dialogue box (portraits + nameplates) with a real judge, jury, and
    //  prosecutor. Verdicts: dismissed / fine / jail. Escape → fugitive on the
    //  road with WANTED posters and cops who re-arrest her.
    // ════════════════════════════════════════════════════════════

    var jail = null;
    var court = null;
    var arrest = null;          // the "you're under arrest" cinematic before booking
    var prisonClothes = false;
    var fugitiveT = 0;
    var fugitiveSpot = 0;
    var wantedPosterT = 0;
    var fugCopT = 0;            // escalating cop-spawn timer while a fugitive
    var fugChopperX = 0;        // police chopper x (tracks Lulu at 5★)
    var fugDisguise = null;     // the rare roadside DISGUISE pickup (shakes the heat)
    var fugDisguiseT = 0;       // delay until the next disguise can appear
    var copK9s = [];            // K9 dogs loosed into the street (3★+)
    var copMissiles = [];       // missiles cop cars fire at her (4★+)
    var copK9T = 0, copMslT = 0;   // spawn cadences for the above

    var ARREST_LINES = ["YOU'RE UNDER ARREST!", "Hands where I can see 'em!",
        "End of the road, Lulu!", "You're comin' with ME.", "Step out of the vehicle, ma'am.",
        "Book 'em, Danno!", "You have the right to remain... fabulous.", "That's a paddlin'. And a cuffin'."];
    // Lulu's sassy retort while she's being collared — paired with the cop's line.
    var LULU_ARREST_LINES = ["I was barely OVER the limit!", "Do you KNOW who my Bubbe is?",
        "This is POLICE harassment!", "Can I at least fix my SHEITEL first?",
        "I want my ONE phone call!", "I'm calling my LAWYER. ...do I have one?",
        "Ugh, these cuffs are SO last season.", "I'll be out by Shabbos, you'll SEE."];
    var CUFF_LINES = ["🔗 *CLICK* — gotcha.", "🔗 Cuffs ON. Watch your head.",
        "🔗 You're goin' DOWNTOWN.", "🔗 Easy does it, Ms. Bruck."];
    // Crime-specific cop barks + Lulu retorts, keyed by a substring of the charge.
    // First matching charge wins; otherwise we fall back to the generic pools above.
    var CHARGE_DIALOGUE = [
        { key: "GRAND THEFT AUTO", cop: ["That car wasn't YOURS, Lulu!", "Boostin' cars now?! That's a FELONY!", "Hot-wire artist, huh? Cute. Cuffs."],
                                   lulu: ["I was just BORROWING it!", "It had the keys IN it! ...basically.", "Finders keepers is a LAW, no?"] },
        { key: "JOYRIDING",       cop: ["Joyride's OVER, lead-foot.", "Fun's done. Out of the car."],
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
                          lulu: ["I waved! That's basically cooperating!", "I thought it was a FAN. Of mine."] }
    ];
    function chargeDialogueFor(charges) {
        if (charges) for (var d = 0; d < CHARGE_DIALOGUE.length; d++)
            for (var c = 0; c < charges.length; c++)
                if (charges[c].indexOf(CHARGE_DIALOGUE[d].key) >= 0) return CHARGE_DIALOGUE[d];
        return null;
    }
    // A lawyer's actual ARGUMENT against a specific charge — so retained counsel
    // visibly defends the real crime at stake, not just generic flavor.
    var CHARGE_DEFENSE = [
        { key: "GRAND THEFT AUTO", arg: "the so-called 'theft' was a spirited TEST-DRIVE — no intent to permanently deprive!" },
        { key: "JOYRIDING", arg: "'joyriding' implies JOY; my client will testify she felt only mild contentment." },
        { key: "PEPPER", arg: "the spray was a textbook reflexive act of SELF-DEFENSE." },
        { key: "ASSAULT", arg: "my client never STRUCK the officer — she GESTURED. Emphatically. It's protected expression." },
        { key: "HIT AND RUN", arg: "she did not 'flee' — she departed to summon HELP. Deeply civic, really." },
        { key: "RECKLESS", arg: "'reckless' is subjective; the record shows only CONFIDENT car-handling." },
        { key: "SPEEDING", arg: "the radar gun was plainly miscalibrated, as these devices notoriously are." },
        { key: "ESCAPE", arg: "one cannot 'escape' a cell whose door was, arguably, left AJAR." },
        { key: "BRIB", arg: "that envelope was a CHARITABLE donation to the policeman's ball. Tax-deductible, even." },
        { key: "EVADING", arg: "my client cannot have EVADED a pursuer she did not know was pursuing her." }
    ];
    function lawyerChargeArgument(tier, charges) {
        var snip = null;
        for (var d = 0; d < CHARGE_DEFENSE.length && !snip; d++)
            for (var c = 0; c < charges.length; c++)
                if (charges[c].indexOf(CHARGE_DEFENSE[d].key) >= 0) { snip = CHARGE_DEFENSE[d]; break; }
        if (!snip) snip = { arg: "the prosecution's case is, frankly, vibes and hearsay, your honor." };
        var lead = tier.name === "Public Defender" ? "Uh — *checks the wrong file* — your honor, I'll argue that "
                 : tier.name === "Abba" ? "Your honor, as her FATHER and her counsel: "
                 : tier.name === "Hotshot Lawyer" ? "Your honor, I'll be brief and devastating: "
                 : "Your honor, the defense contends ";
        return lead + snip.arg;
    }

    // ── Content pools ────────────────────────────────────────
    var CELLMATE_LINES = ["What're you in for? 😏", "I'm INNOCENT. ...mostly.",
        "Psst — wanna dig a tunnel?", "The food here is a CRIME too.", "Third time this week!",
        "You got a good lawyer?", "I just jaywalked, I SWEAR.", "They never proved nothin'.",
        "Snitches get... extra pudding.", "First timer, huh? Cute.", "Don't drop the kugel.",
        "Your sister's that ER nurse? My BACK is killin' me.", "Bruck? As in NURSE Tammy Bruck??",
        "Tammy stitched me up once. Sweet girl. Scary needle."];
    // What the cellblock says once Lulu's a KNOWN repeat escape artist.
    var CELLMATE_FAMOUS = ["Wait — YOU'RE the one who keeps BREAKING OUT?! Teach me!",
        "They named a CELL after you. This one. It leaks.", "Back AGAIN? You treat this place like a hotel.",
        "The guards have your FACE on a dartboard, y'know.", "Legend says you tunneled with a SPOON. Is it true??",
        "I lost count of your breakouts. So did the WARDEN. Respect.", "You're famous in here. Sign my jumpsuit?"];
    // Flavor for the "doing your time" montage — keeps the grind entertaining.
    var JAIL_LIFE = ["🍖 Mystery meat for dinner... again.", "😴 Cellmate snores like a CHAINSAW.",
        "📢 ROLL CALL! Everybody UP.", "🥄 You sculpted a shiv... out of pudding.",
        "💪 Yard time: 200 push-ups.", "🚿 Cold shower. ICE cold.", "📺 The one TV is stuck on C-SPAN.",
        "🐀 You named the cell mouse Heshy.", "✉️ A letter from Bubbe! ...it's a bill.",
        "🔔 Lights out. Then lights ON. Then OUT.", "🧻 Out of toilet paper. AGAIN.",
        "🍮 Traded your pudding for a 'favor'.", "📓 You started a prison memoir. It's just complaints."];
    var LULU_CELL_LINES = ["Bubbe is gonna PLOTZ.", "This jumpsuit is NOT my color.",
        "I get ONE phone call, right?", "I was barely speeding!", "Avigail set me up, I KNOW it.",
        "Is there a kosher option?", "I demand to see a JUDGE.", "These bars clash with everything."];
    var ESCAPE_METHODS = [
        "You fake a fainting spell — the guard panics and you SLIP right out. 🏃",
        "Bedsheet rope out the window. Bubbe taught you to knot. 🪢",
        "You stroll out behind the lunch cart like you BELONG there. 🛒",
        "The guard's asleep. You lift his keys with a hairpin. 🗝️",
        "You trade a cellmate two puddings for a guard uniform. 👮"];
    // Each escape now PLAYS OUT as an animated top-down vignette (see drawJailEscape).
    // `cap` is the punchline shown over it; `alt` lines add variety on repeat breaks.
    var JAIL_ESCAPES = [
        { kind: "cart",     cap: "🛒 You stroll out behind the lunch cart like you BELONG here.",
                            alt: ["🛒 Nobody questions a woman pushing a cart with PURPOSE.", "🛒 The cart squeaks. You squeak back. You're out."] },
        { kind: "disguise", cap: "👮 Two puddings bought a guard's cap. Salute… and SAUNTER out.",
                            alt: ["👮 In the cap you ARE the law. Briefly. Walk tall.", "👮 'Evening, officer.' 'Evening, ME.' Out you go."] },
        { kind: "keys",     cap: "🗝️ The guard's snoring — you lift his keys with a hairpin.",
                            alt: ["🗝️ He dreams of donuts. You dream of FREEDOM. Click.", "🗝️ Tiptoe, jingle, gone. Sweet dreams, officer."] },
        { kind: "faint",    cap: "😵 You fake a faint — the guard rushes in, and you BOLT past him!",
                            alt: ["😵 'She's DOWN!' …and then she's GONE. Oscar-worthy.", "😵 One dramatic swoon, one wide-open door. Exit, stage left."] },
        { kind: "vent",     cap: "🌀 Up into the air vent, spy-movie style. Don't look down.",
                            alt: ["🌀 You shimmy through the ductwork like a glamorous raccoon.", "🌀 Dusty, cramped, ICONIC. The vent delivers you to freedom."] },
        { kind: "tunnel",   cap: "🥄 Weeks of pudding-spoon digging pays off. See ya, suckers!",
                            alt: ["🥄 You surface in the yard, dirt in your sheitel, FREE.", "🥄 The tunnel smelled like pudding. Worth it. You're out."] }
    ];
    var EXTRA_CHARGES = ["UNPAID PARKING (47 TICKETS)", "IMPERSONATING A NICE LADY",
        "EXCESSIVE SASS", "JAYWALKING WITH INTENT", "POSSESSION OF RUGELACH",
        "DISTURBING THE PEACE (LOUDLY)", "DRIVING WHILE FABULOUS"];
    var PROSECUTOR_LINES = ["The defendant is a MENACE, your honor!", "We have her DEAD to rights!",
        "Throw the BOOK at her — the WHOLE library!", "She showed NO remorse — only SASS!",
        "The PEOPLE demand justice! And a refund!", "I've never seen a clearer case in my LIFE.",
        "Lock her up and lose the key. Then lose the LOCK.", "Exhibit A: her DRIVING. Exhibit B: her ATTITUDE.",
        "Three witnesses, your honor. All TERRIFIED.", "I rest my case. ...okay I don't, but LOOK at her."];
    // The judge — distractible, hungry, eternally late for golf.
    var JUDGE_INTROS = ["Order! ORDER in my court!", "This had BETTER be good...",
        "I haven't even had my coffee. Make it QUICK.", "Let's be brief — I tee off at noon.",
        "What FRESH nonsense is this?", "Ms. Bruck. AGAIN. We really must stop meeting like this.",
        "I had a lovely brisket planned. Then THIS case appeared.", "Bailiff, my gavel. ...the HEAVY one.",
        "Settle down. The sooner we start, the sooner I can NAP."];
    var OBJECTIONS = ["OBJECTION! She's making that UP!", "OBJECTION! Leading the jury by the NOSE!",
        "OBJECTION! That's hearsay AND chutzpah!", "OBJECTION — she WINKED at me, your honor!",
        "OBJECTION! The defense is pure FARFEL!", "OBJECTION! She did the SAME thing last TUESDAY!",
        "OBJECTION! Counsel is being... CHARMING. It's distracting!", "OBJECTION! That's not a LAW, that's a VIBE!"];
    var JUDGE_SUSTAIN = ["Sustained. Nice try, Ms. Bruck.", "Sustained! Strike that from the record.",
        "Sustained. I'm not buying what you're selling.", "Sustained. And frankly, RUDE."];
    var JUDGE_OVERRULE = ["Overruled. Sit DOWN, counselor.", "Overruled. Let the woman finish.",
        "Overruled — honestly, I rather LIKED it.", "Overruled. That objection bored me."];
    // Reactions the judge/gallery toss out after Lulu's plea (pure flavor).
    var COURT_REACTS = ["*the gallery murmurs* 🤔", "*a juror nods slowly...* ", "*the stenographer stops typing to stare*",
        "*someone in the back whispers 'iconic'*", "*the prosecutor's eye TWITCHES*", "*the judge sips coffee, unimpressed*"];

    // Family who turn up in the gallery to watch the trial — one lit, recognizable
    // face among the dark spectator silhouettes, blurting support (or heckling).
    var COURT_GALLERY_GUESTS = [
        { p: "abba",    accent: "#FFD180", lines: ["THAT'S MY GIRL!\n...order, your honor. ❤️", "She's a GOOD\ngirl, I SWEAR!", "Objection! She's\nmy DAUGHTER!"] },
        { p: "hillel",  accent: "#BBDEFB", lines: ["Statistically she's\n...mostly innocent?", "I'm just here for\nmoral support! 😅", "For the record, I\ndid NOT advise this."] },
        { p: "raphael", accent: "#FFCC80", lines: ["Throw the book!\n...kidding. Mostly. 😏", "In MY day: a fine\nand a HANDSHAKE.", "Feh. Where's\nHillel? *grumble*"] },
        { p: "bubbe",   accent: "#D7C29A", lines: ["She didn't EAT\ntoday! Mercy! 🍲", "My LULULEH wouldn't\nhurt a FLY!", "I'll bake the judge\na cholent — DEAL?"] },
        { p: "avigail", accent: "#CE93D8", lines: ["Guilty, guilty.\n...just my opinion. 💅", "I drove here\nPERFECTLY, by the way.", "Should I livestream\nthe verdict? 🤳"] }
    ];

    // ── Random courtroom EVENTS — a small chance (~40%) something dramatic
    //    interrupts the trial. Each plays a few lines and NUDGES the verdict:
    //    "help" (lean acquittal) · "hurt" (lean guilty) · "dismiss" (instant out)
    //    · charge adds a fresh charge. Mistrial is rare. ──
    var COURT_EVENTS = [
        { id: "avigail", nudge: "hurt", lines: [
            { who: "BAILIFF", p: "cop", accent: "#90A4AE", text: "A surprise witness takes the stand, your honor!" },
            { who: "AVIGAIL", p: "avigail", accent: "#CE93D8", text: "She cut me off in the CARPOOL lane. With a SMILE. 😤" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "...the court notes the carpool incident. Tsk tsk." } ] },
        { id: "bubbe", nudge: "help", lines: [
            { who: "BAILIFF", p: "cop", accent: "#90A4AE", text: "A character witness approaches the bench..." },
            { who: "BUBBE", p: "bubbe", accent: "#FFCC80", text: "My Lulu?! She brings me SOUP every Shabbos! An ANGEL! 👵" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "...I do love a good soup. Noted FAVORABLY." } ] },
        { id: "phone", nudge: "hurt", charge: "CONTEMPT OF COURT (PHONE)", lines: [
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "Is that a PHONE ringing in MY courtroom?!" },
            { who: "LULU", p: "lulu", accent: "#F48FB1", text: "One sec— HI IMA! ...no, I'm in COURT. I'll call back! 📞" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "CONTEMPT! That's a brand-NEW charge, missy." } ] },
        { id: "golf", nudge: "help", lines: [
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "*taps watch* I tee off in twenty minutes. Let's WRAP this." },
            { who: "PROSECUTOR", p: "prosecutor", accent: "#EF9A9A", text: "But your honor — the EVIDENCE—!" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "The evidence can WAIT. The ninth hole CANNOT." } ] },
        { id: "hair", nudge: "help", lines: [
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "Juror four says you did her... HIGHLIGHTS?" },
            { who: "LULU", p: "lulu", accent: "#F48FB1", text: "Babka balayage, forty bucks. I'll do YOURS too, your honor. 💇" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "...we'll discuss it in chambers. Noted favorably." } ] },
        { id: "coffee", nudge: "help", lines: [
            { who: "BAILIFF", p: "cop", accent: "#90A4AE", text: "Your honor — your coffee. Two sugars, splash of oat. ☕" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "...ahhh. You know what? Suddenly I feel MERCIFUL." } ] },
        { id: "gasp", nudge: "none", lines: [
            { who: "BAILIFF", p: "cop", accent: "#90A4AE", text: "*the entire gallery GASPS in unison* 😱" },
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "ORDER! One more gasp and I CLEAR the room!" } ] }
    ];
    var COURT_MISTRIAL = { id: "mistrial", nudge: "dismiss", lines: [
        { who: "LULU", p: "lulu", accent: "#F48FB1", text: "Your honor — the bailiff SNEEZED during my oath. MISTRIAL!" },
        { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "...you know what? I'm hungry. Case DISMISSED. Everybody OUT." } ] };
    function pickCourtEvent() { return Math.random() < 0.10 ? COURT_MISTRIAL : randPick(COURT_EVENTS); }
    // Hire-a-lawyer tiers — you get what you pay for. feeMul is per-charge.
    var LAWYER_TIERS = [
        { name: "Public Defender", feeMul: 6, mitig: 0.25, blunder: 0.28, accent: "#90A4AE", tag: "cheap — might BLUNDER",
          says: ["Uh... first day! Is this the right courtroom? 😬",
                 "I... did NOT read the file. Is it bad? It's bad, right?",
                 "Objection! ...wait, am I the prosecutor? No? Okay.",
                 "I passed the bar on the THIRD try. We've got this. Maybe.",
                 "My other client's also at 2pm, so let's, uh, hustle."] },
        { name: "Local Attorney", feeMul: 19, mitig: 0.58, blunder: 0.05, accent: "#80CBC4", tag: "solid odds",
          says: ["We'll fight this. I read MOST of the file. 🤵",
                 "Reasonable doubt is my middle name. Well — it's Steven.",
                 "I've won cases like this. ...A few. Some. One. We're good.",
                 "Let me handle the judge — we golf. Badly, but we golf.",
                 "Stay calm, look innocent, and let me do the talking."] },
        { name: "Hotshot Lawyer", feeMul: 44, mitig: 0.86, blunder: 0, accent: "#FFD54F", tag: "pricey — best odds",
          says: ["They don't have a CASE. Watch this. 😎",
                 "I bill more per hour than that fine. Relax.",
                 "Your honor, I'll be brief, devastating, and correct.",
                 "I've never lost. Don't check that. Just — trust me. 💼",
                 "By the time I'm done, THEY'LL be apologizing to YOU."] }
    ];
    // ABBA — Lulu's dad. Turns out he passed the bar "years ago, for fun." When
    // he happens to be available (a treat — not every sentence) he takes her case
    // for FREE because she's his little girl. Fights HARD; near-hotshot odds.
    var ABBA_TIER = { name: "Abba", feeMul: 0, free: true, mitig: 0.80, blunder: 0, accent: "#FFB74D",
        portrait: "abba", tag: "FREE — he's your DAD ❤️",
        says: ["That's my DAUGHTER, your honor. Show a little RACHMONES. ❤️",
               "I changed her diapers. THIS is who you're prosecuting?",
               "Your honor, between us fathers... let it slide, nu?",
               "She's a GOOD girl. A FAST girl, but a good one. ❤️"] };
    var ABBA_RETAIN_LINES = ["👨‍⚖️ ABBA took the case — for FREE! ❤️", "👨‍⚖️ \"For you, bubbeleh? No charge.\"",
        "👨‍⚖️ Abba cracks his knuckles. \"Watch THIS.\"", "👨‍⚖️ \"Don't tell Ima how fast you were going.\""];
    // The lawyer options Lulu can see this sentence (Abba only sometimes shows).
    function activeLawyerTiers() { return (jail && jail.abbaAvailable) ? [ABBA_TIER].concat(LAWYER_TIERS) : LAWYER_TIERS; }

    // ── BOUNTY: one severity-weighted, CAPPED number drives every cost ──
    // Proven model (Skyrim / RDR2): what you owe scales with how BAD the crimes
    // were, not just how many charges stacked up, and it's hard-capped so it can
    // never spiral past a few good runs' worth of coins. Bail / fine / plea all
    // derive from this, so costs never stack into an unpayable wall.
    var CHARGE_WEIGHT = {
        "SPEEDING": 1, "DISTURBING THE PEACE": 1, "BEING SUSPICIOUS": 1, "JAYWALKING": 1,
        "RECKLESS DRIVING": 2, "RESISTING ARREST": 2, "ATTEMPTED ESCAPE": 2,
        "ATTEMPTED BRIBERY": 2, "BRIBING A COURT OFFICIAL": 2, "CONTEMPT OF COURT": 2,
        "RUNNING FROM THE LAW": 3, "HIT AND RUN": 3, "JOYRIDING A STEAMROLLER": 3, "ESCAPE FROM CUSTODY": 3,
        "GRAND THEFT AUTO": 4, "VEHICULAR DESTRUCTION": 4
    };
    var BOUNTY_CAP = 400;   // hard ceiling — a real sting, never a debt wall
    function chargeWeight(c) { return CHARGE_WEIGHT[c] || 2; }   // unknown charge = moderate
    function bountyFor(charges) {
        var sum = 0, n = charges ? charges.length : 0;
        for (var i = 0; i < n; i++) sum += chargeWeight(charges[i]);
        if (sum === 0) sum = 1;
        var strikes = Math.min(save.convictions || 0, 5);
        return Math.min(BOUNTY_CAP, Math.round(13 * sum * (1 + 0.08 * strikes)));
    }

    var DEFENSE_POOL = [
        { label: "🥺 Plead & cry", says: "Your honor, it's been SUCH a hard week... 😭",
          outcomes: [["dismissed", 0.45], ["fine", 0.40], ["jail", 0.15]] },
        { label: "💸 'Tip' the judge", says: "*slides an envelope* For your robe fund 💵",
          outcomes: [["dismissed", 0.55], ["fine", 0.20], ["jail", 0.25]], bribe: true },
        { label: "🤬 Blame Avigail", says: "AVIGAIL dared me to, your honor!",
          outcomes: [["dismissed", 0.30], ["fine", 0.50], ["jail", 0.20]] },
        { label: "🧠 Plead insanity", says: "I'm not crazy — the ROAD is! 🌀",
          outcomes: [["dismissed", 0.35], ["fine", 0.35], ["jail", 0.30]] },
        { label: "👵 Invoke Bubbe", says: "My Bubbe makes the JUDGE'S favorite cholent!",
          outcomes: [["dismissed", 0.50], ["fine", 0.40], ["jail", 0.10]] },
        { label: "😇 'I'm a good girl'", says: "Me? I've never even SPED, officer— judge!",
          outcomes: [["dismissed", 0.40], ["fine", 0.45], ["jail", 0.15]] },
        { label: "🎤 OBJECT!", says: "OBJECTION! On the grounds of... vibes. 💅",
          outcomes: [["dismissed", 0.40], ["fine", 0.40], ["jail", 0.20]] },
        { label: "🍪 Bribe the JURY", says: "*passes rugelach down the jury box* 🍪",
          outcomes: [["dismissed", 0.55], ["fine", 0.25], ["jail", 0.20]], bribe: true },
        { label: "💃 Dazzle the court", says: "*little tap routine* Charges dropped now? 💃",
          outcomes: [["dismissed", 0.50], ["fine", 0.30], ["jail", 0.20]] },
        { label: "🤥 Lie (badly)", says: "I wasn't there. Or driving. Or... born.",
          outcomes: [["dismissed", 0.30], ["fine", 0.40], ["jail", 0.30]] },
        { label: "🙏 Beg for mercy", says: "Mercy! I'll never speed again! ...today.",
          outcomes: [["dismissed", 0.50], ["fine", 0.40], ["jail", 0.10]] }
    ];

    // ── Persistence (survives a page refresh) ────────────────
    function saveLockup(mode, charges, bail, days, total, fugT, escFails, escUsed) {
        save.lockup = { mode: mode, charges: charges || [], bail: bail || 0, days: days || 0, total: total || 30, fugT: fugT || 0,
                        escFails: escFails || 0, escUsed: !!escUsed };
        persistSave();
    }
    function clearLockup() { save.lockup = null; persistSave(); }
    // Called once at boot: if she had an unfinished sentence, drop her right back
    // into it instead of the menu.
    function resumeLockup() {
        if (!save.lockup) return false;
        var lk = save.lockup;                                // capture before resetGame wipes it
        if (typeof resetGame === "function") resetGame();    // ready the road for her release
        save.lockup = lk;                                    // restore (resetGame cleared it)
        if (lk.mode === "fugitive") {
            prisonClothes = true; fugitiveT = lk.fugT || 0; fugitiveSpot = 0; wantedPosterT = 1.5; fugCopT = 3; fugDisguise = null; fugDisguiseT = rand(12, 20);
            state = "playing"; return true;
        }
        if (lk.mode === "serving") {
            jail = { phase: 9, t: (lk.days || 0) / 8.5, days: lk.days || 0, total: lk.total || 30,
                     charges: [], cellmateLine: "", cellmateT: 99, flash: 0, bail: 0 };
            state = "jailCell"; return true;
        }
        jail = { charges: lk.charges || ["DISTURBING THE PEACE"], phase: 1, t: 0,
                 cellmateLine: randPick(CELLMATE_LINES), cellmateT: 4.0, escapeMethod: "",
                 flash: 0, bail: lk.bail || 60, inmate: "#" + randInt(1000, 9999), camFlash: 0,
                 // Restore the breakout state so refreshing the page can't hand out a
                 // fresh escape attempt (the old exploit: reload → unlimited tries).
                 escapeFails: lk.escFails || 0, escUsed: !!lk.escUsed, lock: null };
        state = "jailCell"; return true;
    }

    // ── Arrest cinematic ─────────────────────────────────────
    //  A full beat: cruiser pulls up → officer struts over → a little back-and-
    //  forth (cop barks, Lulu sasses) → she's CUFFED (animated) → perp-walked to
    //  the cruiser → and you watch it DRIVE her to the nearest police station,
    //  which scrolls into view. THEN she's booked. No sudden cut to jail.
    // opts.fromBust: she was just pulled over (the copBust scene already played
    // the cop dialogue), so we skip the whole approach/banter/cuffing and go
    // STRAIGHT to the drive to the station — no second cop scene, just the haul-in.
    function beginArrest(charges, opts) {
        opts = opts || {};
        // Busted → the steamroller is impounded; she won't roll out of jail in it.
        if (typeof playerVehicle !== "undefined" && playerVehicle === "dozer") { playerVehicle = null; dozerTimer = 0; }
        var onFoot = (state === "footRun" || state === "footInterior");
        var py = (player && player.y) || PLAYER_Y;
        var px = (player ? player.x : W / 2);
        var fromLeft = px > W / 2;                  // cop approaches from her open side
        // crime-specific banter when we can match a charge; generic otherwise
        var cd = chargeDialogueFor(charges);
        arrest = {
            charges: charges, t: 0, phase: opts.fromBust ? 5 : 0, onFoot: onFoot,
            px: px, py: py,                         // her (abandoned) car / start spot
            outX: px + (fromLeft ? -26 : 26), outY: py + 2,   // where she stands once pulled out
            lx: px + (fromLeft ? -26 : 26), ly: py + 2,       // her live standing position
            copX: clamp(px + (fromLeft ? -52 : 52), ROAD_L + 30, ROAD_R - 30),
            copY: py + 190,                         // cruiser slides up from behind
            fromLeft: fromLeft, officer: null,
            copLine: cd ? randPick(cd.cop) : randPick(ARREST_LINES),
            luluLine: cd ? randPick(cd.lulu) : randPick(LULU_ARREST_LINES),
            cuffLine: randPick(CUFF_LINES), dialStep: 0,
            cuffT: 0, walkP: opts.fromBust ? 1 : 0, cuffed: !!opts.fromBust,
            scroll: 0, station: null, fade: 0
        };
        // from a pull-over: jump to the haul-in — pre-place the cruiser + station.
        if (opts.fromBust) {
            arrest.copX = clamp(px, ROAD_L + 30, ROAD_R - 30);
            arrest.station = { x: (fromLeft ? ROAD_R + 56 : ROAD_L - 56), y: -176, side: fromLeft ? 1 : -1,
                               kind: "policeStation", w: 112, h: 168, lit: true, seed: 42 };
            playTone(220, 0.08, "square", 0.12);   // *thunk* — door shuts, off we go
        }
        copChase = null; copBust = null; copStop = null;
        if (typeof playWompWomp === "function") playWompWomp();
        playTone(900, 0.12, "sine", 0.13, 1320);
        setTimeout(function () { playTone(1320, 0.12, "sine", 0.13, 900); }, 160);
        state = "arrest";
    }

    function updateArrest(dt) {
        arrest.t += dt;
        if (shakeTimer > 0) shakeTimer -= dt;
        var a = arrest;
        if (a.phase === 0) {                        // cruiser slides up behind her
            a.copY = lerp(a.copY, a.py + 64, Math.min(1, 4 * dt));
            if (a.t > 1.0) {
                a.phase = 1; a.t = 0;
                a.officer = { x: a.fromLeft ? -30 : W + 30, y: a.py + 16,
                              targetX: a.px + (a.fromLeft ? -40 : 40),
                              time: 0, state: "running", runDir: a.fromLeft ? 1 : -1, cop: true };
            }
            return;
        }
        if (a.phase === 1) {                        // officer struts over to her
            var o = a.officer; o.time += dt;
            var dx = o.targetX - o.x;
            if (Math.abs(dx) > 4) { o.x += (dx >= 0 ? 1 : -1) * 170 * dt; o.runDir = dx >= 0 ? 1 : -1; }
            else { o.x = o.targetX; o.state = "yelling"; a.phase = 2; a.t = 0; playTone(330, 0.05, "square", 0.1); }
            return;
        }
        if (a.phase === 2) {                        // back-and-forth: cop barks, Lulu sasses
            a.officer.time += dt;
            // consume BOTH (a tap queues each) so one tap advances exactly one line.
            var tClick = consumeClick(), tAct = consumeAction(), tap = !!(tClick || tAct);
            if (a.dialStep === 0 && (tap || a.t > 1.9)) { a.dialStep = 1; a.t = 0; playTone(520, 0.05, "triangle", 0.1); return; }
            if (a.dialStep === 1 && (tap || a.t > 1.9)) { a.phase = 3; a.t = 0; a.officer.state = "yelling"; return; }
            return;
        }
        if (a.phase === 3) {                        // CUFFING — rings snap on, *click*
            a.officer.time += dt;
            a.cuffT = Math.min(1, a.cuffT + dt / 1.0);
            if (!a.cuffed && a.cuffT >= 0.55) {     // the snap
                a.cuffed = true; playTone(1200, 0.05, "square", 0.13); shakeTimer = 0.18; shakeIntensity = 3;
                setTimeout(function () { playTone(1500, 0.04, "square", 0.12); }, 70);
            }
            if (a.t > 1.7) { a.phase = 4; a.t = 0; }
            return;
        }
        if (a.phase === 4) {                        // perp walk to the cruiser, then loaded in
            a.officer.time += dt;
            a.walkP = Math.min(1, a.walkP + dt / 1.7);
            // she + the officer walk from where she's standing over to the cruiser door
            a.lx = lerp(a.outX, a.copX + (a.fromLeft ? 16 : -16), a.walkP);
            a.ly = lerp(a.outY, a.copY - 6, a.walkP);
            a.officer.x = a.lx + (a.fromLeft ? -16 : 16); a.officer.y = a.ly + 2;
            a.officer.runDir = a.fromLeft ? -1 : 1; a.officer.state = a.walkP < 0.98 ? "running" : "yelling";
            if (a.walkP >= 1 && a.t > 0.5) {        // door shut → roll out
                a.phase = 5; a.t = 0;
                playTone(220, 0.08, "square", 0.12);   // *thunk* door
                // she's driven up to the big precinct house for booking.
                a.station = { x: (a.fromLeft ? ROAD_R + 56 : ROAD_L - 56), y: -176, side: a.fromLeft ? 1 : -1,
                              kind: "policeStation", w: 112, h: 168, lit: true, seed: 42 };
            }
            return;
        }
        if (a.phase === 5) {                        // DRIVE to the nearest station
            var driveSpd = 360 + Math.min(260, a.t * 150);
            a.scroll += driveSpd * dt;
            if (a.station) a.station.y += driveSpd * dt;
            // once the station is alongside, the cruiser veers in and we fade
            var pullingIn = a.station && a.station.y > H * 0.46;
            if (pullingIn) {
                a.copX = lerp(a.copX, a.station.x + (a.fromLeft ? -36 : 36), Math.min(1, 2.4 * dt));
                a.fade = Math.min(1, a.fade + dt / 0.7);
            }
            if (a.fade >= 1) { var ch = a.charges; arrest = null; goToJail(ch); }
            return;
        }
    }

    function drawArrest() {
        var a = arrest;
        // shake for the cuff snap / drive
        ctx.save();
        if (shakeTimer > 0) ctx.translate(rand(-shakeIntensity, shakeIntensity), rand(-shakeIntensity, shakeIntensity));

        if (typeof drawRoad === "function") drawRoad(scrollOffset + (a.scroll || 0));
        if (typeof drawDecorations === "function") drawDecorations(gameTime);

        // the police station scrolling into view during the drive
        if (a.station && typeof drawBuilding === "function") {
            // a driveway leading from the road up to the precinct steps
            ctx.fillStyle = "#9E9E9E";
            ctx.fillRect(a.station.x + (a.fromLeft ? -a.station.w / 2 : a.station.w / 2 - 28) + (a.fromLeft ? 4 : -4), a.station.y + a.station.h - 4, 24, 30);
            drawBuilding(a.station);
            // bold floating label + arrow so it unmistakably reads as the destination
            if (a.station.y > -40) {
                var lblY = clamp(a.station.y - 14, 30, H - 40);
                drawText("⬇ PRECINCT 18½", a.station.x, lblY, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 4);
            }
        }

        // siren light-wash over the whole scene
        var sirN = Math.sin(gameTime * 9), redOn = sirN > 0, washA = 0.12 + Math.abs(sirN) * 0.18;
        var wg = ctx.createLinearGradient(redOn ? 0 : W, 0, redOn ? W : 0, 0);
        wg.addColorStop(0, (redOn ? "rgba(255,40,40," : "rgba(40,90,255,") + washA + ")");
        wg.addColorStop(0.55, (redOn ? "rgba(255,40,40," : "rgba(40,90,255,") + (washA * 0.25) + ")");
        wg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);

        if (a.phase === 5) {
            // driving shot: just the cruiser (Lulu's inside) rolling to the station.
            // Lulu's worried face in the back window so it's clearly HER being hauled off.
            drawCopCar(a.copX, H * 0.6, gameTime * 5);
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(a.copX, H * 0.6 + 12, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = C.skin || "#FFD9C0"; ctx.beginPath(); ctx.arc(a.copX, H * 0.6 + 12, 4.4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // clear, persistent "she's being taken in" header
            drawArrestHeader(true);
            drawText("🚓  TAKING LULU TO THE STATION", W / 2, H * 0.155, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 5);
            // a little progress bar: how close the cruiser is to the precinct
            var prog = clamp(((a.station ? a.station.y : 0) / (H * 0.5)) * 0.7 + a.fade * 0.3, 0, 1);
            var bw = W * 0.6, bx = (W - bw) / 2, by = H * 0.155 + 22;
            ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(bx, by, bw, 12, 6); ctx.fill();
            ctx.fillStyle = "#FF5252"; roundRect(bx + 2, by + 2, (bw - 4) * prog, 8, 4); ctx.fill();
            drawText("🚗 ———→ 🏛️ PRECINCT 18½", W / 2, by + 30, "bold 11px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
            if (a.fade > 0) { ctx.fillStyle = "rgba(8,6,20," + a.fade + ")"; ctx.fillRect(0, 0, W, H); }
            return;
        }

        // she's in her car for the first beat; once pulled out (phase ≥ 2) the car
        // isn't drawn (drawLuluCar always seats her, which would double her up).
        if (!a.onFoot && a.phase < 2 && typeof drawPlayerVehicleAt === "function") drawPlayerVehicleAt(a.px, a.py, 0, gameTime, false);
        // the cruiser she'll be loaded into
        drawCopCar(a.copX, a.copY, gameTime * 3);

        // Lulu — in her car for the first beat, then standing once pulled out
        if (a.phase <= 1 && !a.onFoot) {
            // (already drawn above as the car)
        } else if (typeof drawLuluTopDown === "function") {
            drawLuluTopDown(a.lx, a.ly, a.phase === 4 ? gameTime * 5 : gameTime * 2, "cry");
            if (a.cuffed || a.cuffT > 0) drawArrestCuffs(a.lx, a.ly + 8, a.cuffT);
        }
        if (a.officer) drawAngryMan(a.officer.x, a.officer.y, a.officer.time, a.officer.state, a.officer.runDir, true);

        ctx.restore();

        // ── persistent "UNDER ARREST" header so it's never ambiguous what's
        //    happening (she's being taken in, not just pulled over / released) ──
        if (a.phase >= 1) drawArrestHeader(false);

        // ── dialogue / captions ──
        if (a.phase === 2) {
            if (a.dialStep === 0) drawArrestBubble("👮 OFFICER", a.copLine, "#FF5252");
            else drawArrestBubble("💃 LULU", a.luluLine, "#FF4FA3");
            var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 5));
            ctx.globalAlpha = bl; drawText("▾ tap", W / 2, H * 0.30, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2); ctx.globalAlpha = 1;
        } else if (a.phase === 3) {
            drawText(a.cuffLine, W / 2, H * 0.15, "bold 20px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 5);
            if (a.cuffed) drawText("You're being BOOKED...", W / 2, H * 0.15 + 28, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 3);
        } else if (a.phase === 4) {
            drawText("🚶‍♀️ Into the cruiser...", W / 2, H * 0.15, "bold 18px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 4);
        } else if (a.phase >= 1) {
            drawText(a.copLine, W / 2, H * 0.15, "bold 22px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 6);
        }
    }

    // A bold pulsing "UNDER ARREST" banner pinned to the top of the arrest
    // cutscene, so players always know Lulu is being hauled in (not let go).
    function drawArrestHeader(enroute) {
        var pulse = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 4));
        var bw = 250, bx = (W - bw) / 2, by = SAFE_TOP + 8, bh = 30;
        ctx.fillStyle = "rgba(150,20,20," + (0.78 + 0.18 * pulse) + ")";
        roundRect(bx, by, bw, bh, 8); ctx.fill();
        ctx.strokeStyle = "rgba(255,210,80," + (0.55 + 0.4 * pulse) + ")"; ctx.lineWidth = 2;
        roundRect(bx, by, bw, bh, 8); ctx.stroke();
        drawText("🚨 UNDER ARREST 🚨", W / 2, by + bh / 2, "bold 16px 'Segoe UI', Arial, sans-serif", "#FFFFFF", "#000", 3);
    }

    // Two cuff rings + chain that pop in and snap together (t: 0→1).
    function drawArrestCuffs(x, y, t) {
        var pop = clamp(t / 0.5, 0, 1), snap = clamp((t - 0.4) / 0.3, 0, 1);
        var sep = lerp(8, 3.6, snap), r = 3.2 * pop;
        if (r <= 0.1) return;
        ctx.save(); ctx.translate(x, y);
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-sep + 2.4, 0); ctx.lineTo(sep - 2.4, 0); ctx.stroke();   // chain
        for (var s = -1; s <= 1; s += 2) {
            ctx.strokeStyle = "#ECEFF1"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(s * sep, 0, r, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = "#78909C"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(s * sep, 0, r, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        }
        if (snap > 0 && snap < 1) {   // glint flash on the snap
            ctx.globalAlpha = (1 - snap); ctx.fillStyle = "#FFFFFF";
            ctx.beginPath(); ctx.arc(0, -1, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // A speech card centered on screen for the arrest back-and-forth.
    function drawArrestBubble(who, text, accent) {
        ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
        var tw = Math.min(W - 48, ctx.measureText(text).width + 40), bx = W / 2 - tw / 2, by = H * 0.20, bh = 50;
        ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(bx + 3, by + 4, tw, bh, 12); ctx.fill();
        var g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, "#2A2336"); g.addColorStop(1, "#171121");
        ctx.fillStyle = g; roundRect(bx, by, tw, bh, 12); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2.5; roundRect(bx, by, tw, bh, 12); ctx.stroke();
        ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
        var nw = ctx.measureText(who).width + 18;
        ctx.fillStyle = accent; roundRect(bx + 14, by - 11, nw, 20, 6); ctx.fill();
        drawText(who, bx + 14 + nw / 2, by + 0, "bold 11px 'Segoe UI', Arial, sans-serif", "#1A1230", null, 0);
        drawText(text, W / 2, by + 32, "bold 16px 'Segoe UI', Arial, sans-serif", "#F3E9FF", "#000", 3);
    }

    // ── Entry: book her ──────────────────────────────────────
    function goToJail(charges) {
        var list = (charges && charges.length ? charges.slice() : ["DISTURBING THE PEACE"]);
        // Pull in any OUTSTANDING accusations — now's when she answers for them all.
        if (save.wanted && save.wanted.length) list = list.concat(save.wanted);
        if (Math.random() < 0.5) list.push(randPick(EXTRA_CHARGES));
        list = list.filter(function (c, i) { return list.indexOf(c) === i; });
        save.offenses = (save.offenses || 0) + 1;
        var strikes = save.convictions || 0;
        // Bail climbs with how wanted she is (priors + strikes).
        // Bail = ~40% of the capped bounty — a fast-track to skip the wait (charges
        // stay open till court). Severity-weighted + capped, so it can't balloon.
        var bail = Math.max(15, Math.round(bountyFor(list) * 0.4));
        jail = { charges: list, phase: 0, t: 0, cellmateLine: randPick(CELLMATE_LINES), cellmateT: 4.0,
                 escapeMethod: "", flash: 0.3, bail: bail, inmate: "#" + randInt(1000, 9999),
                 camFlash: 0, escapeFails: 0, lock: null,
                 abbaAvailable: Math.random() < 0.35,   // a treat: Abba's free counsel, sometimes
                 lawyerFee: Math.round(list.length * randInt(18, 28) * (1 + strikes * 0.3)) };
        copChase = null; copBust = null; copStop = null;
        saveLockup("cell", list, bail, 0);
        if (typeof playWompWomp === "function") playWompWomp();
        playTone(110, 0.5, "square", 0.12);
        setTimeout(function () { playTone(80, 0.4, "square", 0.12); }, 220);
        state = "jailCell";
    }

    // ── Button rects: a 2×2 grid above the dialogue box ──
    function cellBtnW() { return (W - 38) / 2; }
    function cellEscapeRect() { return { x: 14, y: H - 232, w: cellBtnW(), h: 42 }; }
    function cellBailRect() { return { x: 24 + cellBtnW(), y: H - 232, w: cellBtnW(), h: 42 }; }
    function cellLawyerRect() { return { x: 14, y: H - 184, w: cellBtnW(), h: 42 }; }
    function cellCourtRect() { return { x: 24 + cellBtnW(), y: H - 184, w: cellBtnW(), h: 42 }; }
    function lawyerFee(tier) { return Math.round((jail.charges.length) * tier.feeMul * (1 + (save.convictions || 0) * 0.2)); }
    function lawyerTierRect(i, n) {
        n = n || 3;
        var top = n >= 4 ? H - 232 : H - 214;
        var gap = n >= 4 ? 44 : 54;
        var h   = n >= 4 ? 38 : 48;
        return { x: 28, y: top + i * gap, w: W - 56, h: h };
    }
    function lawyerBackRect() { return { x: W / 2 - 60, y: H - 52, w: 120, h: 38 }; }
    function courtOptRect(i) { return { x: 22, y: H - 176 + i * 40, w: W - 44, h: 36 }; }

    // ════════════════ JAIL CELL ════════════════
    function startLockpick() {
        // Drop the tap that OPENED the minigame so its queued action doesn't leak
        // in as an instant (unwanted) first pick.
        consumeClick(); consumeAction();
        var s = save.convictions || 0;
        jail.lock = {
            pins: 2 + Math.min(2, s) + Math.min(2, jail.escapeFails),   // harder for repeat offenders
            done: 0, pos: 0, dir: 1,
            speed: 0.48 + s * 0.06 + jail.escapeFails * 0.10,           // gentler — the marker was too fast
            zoneC: rand(0.25, 0.75), zoneW: Math.max(0.17, 0.36 - s * 0.025 - jail.escapeFails * 0.025),
            misses: 0, maxMiss: 3, result: null, resultT: 0
        };
        jail.phase = 3; jail.t = 0;
    }

    function updateJailCell(dt) {
        if (jail.flash > 0) jail.flash -= dt;
        if (jail.camFlash > 0) jail.camFlash -= dt;
        jail.t += dt;
        jail.cellmateT -= dt;
        if (jail.cellmateT <= 0) {
            jail.cellmateLine = ((save.escapes || 0) >= 2 && Math.random() < 0.5) ? randPick(CELLMATE_FAMOUS) : randPick(CELLMATE_LINES);
            jail.cellmateT = rand(4, 7);
        }

        if (jail.phase === 0) {                 // INTAKE — mugshot booking
            if (Math.abs(jail.t - 1.0) < dt && jail.camFlash <= 0) { jail.camFlash = 0.4; playTone(1400, 0.04, "sine", 0.12); }
            var intakeTap = consumeTap();
            if (jail.t > 2.8 || intakeTap) { jail.phase = 1; jail.t = 0; }
            return;
        }
        if (jail.phase === 1) {                 // deciding: escape / bail / lawyer / court
            var click = consumeClick();
            if (click) {
                var er = cellEscapeRect(), br = cellBailRect(), lr = cellLawyerRect(), cr = cellCourtRect();
                if (pointInRect(click.x, click.y, er.x, er.y, er.w, er.h)) {
                    // ONE shot at a breakout per stay — blow it and the guard watches you.
                    if (jail.escUsed) { playTone(180, 0.15, "square", 0.15); spawnFloater(W / 2, H * 0.4, "The guard's WATCHING now — no more escapes! 👮", "#FF8A80"); return; }
                    // Burn the one attempt the MOMENT she commits, and persist it — so a
                    // page refresh mid-pick can't rewind to a fresh try.
                    jail.escUsed = true;
                    saveLockup("cell", jail.charges, jail.bail, 0, 0, 0, jail.escapeFails, true);
                    startLockpick(); playTone(330, 0.05, "square", 0.1); return;
                }
                if (pointInRect(click.x, click.y, lr.x, lr.y, lr.w, lr.h)) { jail.phase = 4; jail.t = 0; playTone(440, 0.05, "sine", 0.1); return; }
                if (pointInRect(click.x, click.y, br.x, br.y, br.w, br.h)) {
                    if (save.totalCoins >= jail.bail) {
                        var paid = chargeCoins(jail.bail);   // bail out of her coins
                        // Out on bail = released PENDING trial: the charges stay open,
                        // so she's still WANTED until she actually faces a judge.
                        addWanted(jail.charges);
                        clearLockup(); jail = null; prisonClothes = false;
                        beginExitScene("police", "drive", "💰 Out on bail — but still WANTED 'til court. 🚨");
                    } else {
                        playTone(180, 0.15, "square", 0.15);
                        spawnFloater(W / 2, H * 0.42, "Can't make bail! 😬", "#FF8A80");
                    }
                    return;
                }
                if (pointInRect(click.x, click.y, cr.x, cr.y, cr.w, cr.h)) { openCourt(jail.charges); return; }
            }
            if (jail.t > 22) { openCourt(jail.charges); return; }
            return;
        }
        if (jail.phase === 4) {                 // LAWYER tier menu
            var lc = consumeClick();
            if (lc) {
                var tiers = activeLawyerTiers();
                for (var ti = 0; ti < tiers.length; ti++) {
                    var tr = lawyerTierRect(ti, tiers.length);
                    if (pointInRect(lc.x, lc.y, tr.x, tr.y, tr.w, tr.h)) {
                        var tier = tiers[ti], fee = tier.free ? 0 : lawyerFee(tier);
                        if (tier.free) {
                            spawnFloater(W / 2, H * 0.40, randPick(ABBA_RETAIN_LINES), "#FFD180");
                            playTone(523, 0.08, "triangle", 0.14); setTimeout(function () { playTone(784, 0.1, "triangle", 0.16); }, 110);
                            openCourt(jail.charges, tier);
                        } else if (save.totalCoins >= fee) {
                            chargeCoins(fee);   // lawyer's retainer out of her coins
                            spawnFloater(W / 2, H * 0.40, "🤵 " + tier.name + " retained! −" + fee, "#7CFC4F");
                            openCourt(jail.charges, tier);
                        } else { playTone(180, 0.15, "square", 0.15); spawnFloater(W / 2, H * 0.40, "Can't afford " + tier.name + "! 😬", "#FF8A80"); }
                        return;
                    }
                }
                var bk = lawyerBackRect();
                if (pointInRect(lc.x, lc.y, bk.x, bk.y, bk.w, bk.h)) { jail.phase = 1; jail.t = 0; return; }
            }
            return;
        }
        if (jail.phase === 3) {                 // LOCKPICK minigame
            var lk = jail.lock;
            if (lk.missFx > 0) lk.missFx -= dt;
            if (lk.result) {
                lk.resultT += dt;
                if (lk.result === "win" && lk.resultT > 1.0) {
                    var ev = randPick(JAIL_ESCAPES);
                    // repeat breakouts pull from the alt punchlines for variety
                    var cap = ((save.escapes || 0) > 0 && ev.alt && Math.random() < 0.7) ? randPick(ev.alt) : ev.cap;
                    jail.escape = { kind: ev.kind, cap: cap }; jail.escapeMethod = cap;
                    jail.phase = 2; jail.t = 0;
                }
                else if (lk.result === "lose" && lk.resultT > 1.8) {
                    jail.escapeFails++;
                    if (jail.charges.indexOf("ATTEMPTED ESCAPE") < 0) jail.charges.push("ATTEMPTED ESCAPE");
                    saveLockup("cell", jail.charges, jail.bail, 0, 0, 0, jail.escapeFails, true);
                    jail.phase = 1; jail.t = 0; jail.lock = null;
                    spawnFloater(W / 2, H * 0.4, "CAUGHT! The guard's watching now. 👮", "#FF8A80");
                }
                return;
            }
            // Hit-test FIRST — against lk.pos exactly as it was last DRAWN — so the
            // check matches what the player saw, then advance. ONE tap = ONE pick:
            // a tap queues BOTH a click and an action, so consume both in the same
            // frame, or the leftover fires a phantom second pick next frame (marker
            // already moved → guaranteed miss; that's what felt impossible to sync).
            var lkClick = consumeClick(), lkAct = consumeAction();
            if (lkClick || lkAct) {
                if (Math.abs(lk.pos - lk.zoneC) < lk.zoneW / 2) {
                    lk.done++; playTone(740 + lk.done * 80, 0.06, "sine", 0.12);
                    if (lk.done >= lk.pins) { lk.result = "win"; lk.resultT = 0; playTone(988, 0.14, "triangle", 0.2); }
                    else { lk.zoneC = rand(0.18, 0.82); lk.zoneW = Math.max(0.11, lk.zoneW * 0.86); lk.speed *= 1.05; }
                } else {
                    lk.misses++; lk.missFx = 0.5; playTone(150, 0.12, "square", 0.16);
                    spawnFloater(W / 2, H * 0.34 + 70, "✖ MISS!", "#FF1744");
                    if (lk.misses >= lk.maxMiss) { lk.result = "lose"; lk.resultT = 0; playTone(90, 0.3, "square", 0.16); }
                }
                return;   // don't also advance on the tap frame — keeps the hit crisp
            }
            lk.pos += lk.dir * lk.speed * dt;
            if (lk.pos >= 1) { lk.pos = 1; lk.dir = -1; }
            if (lk.pos <= 0) { lk.pos = 0; lk.dir = 1; }
            return;
        }
        if (jail.phase === 2) {                 // jailbreak — the animated escape vignette
            if (typeof updateParticles === "function") updateParticles(dt);
            if (jail.t > 4.2 || (jail.t > 2.6 && consumeTap())) {
                // She's out — and her fugitive HEAT carries over / escalates with each
                // prior break (no more wiping the slate to 1★ every time she runs).
                save.escapes = (save.escapes || 0) + 1; persistSave();
                // Each break starts a little hotter than the last, but RAMPS gently
                // (≈1★→1★→2★→2★→3★) instead of vaulting straight to 4★ — she should
                // climb the heat ladder, not skip to the top the instant she's out.
                var heat = Math.min(30, (save.escapes - 1) * 7);   // 0, 7, 14, 21, 28…
                // She broke out FROM these charges — they're still outstanding, so
                // they ride onto her wanted file (so the next charge sheet remembers
                // everything instead of resetting to just "ESCAPE").
                if (typeof addWanted === "function" && jail.charges && jail.charges.length) addWanted(jail.charges);
                prisonClothes = true; fugitiveT = heat; fugitiveSpot = 0; wantedPosterT = 1.2; fugCopT = 2.5; fugDisguise = null; fugDisguiseT = rand(12, 20);
                saveLockup("fugitive", [], 0, 0, Math.max(8, 55 - heat), 0);
                jail = null;
                if (typeof returnToDriving === "function") returnToDriving();
                spawnFloater(player.x, player.y - 50, "🏃 JAILBREAK!", "#FFD54F");
                spawnFloater(player.x, player.y - 28, save.escapes > 1
                    ? "Break #" + save.escapes + " — they're FURIOUS now! 🚨" : "Cops will RECOGNIZE you...", "#FF8A80");
                return;
            }
            return;
        }
        if (jail.phase === 9) {                 // serving the sentence — DOING HARD TIME
            // Doing time DRAGS now. A day ticks by slowly on its own; tapping is
            // "hard labor" that grinds a little time off faster (mash to endure
            // it). The sentence is much longer than before, and on release the
            // system skims court costs off whatever coins she had. It's a real
            // setback — not a 3-second skip.
            if (jail.serveDays === undefined) jail.serveDays = jail.days || 0;
            // Passive time now crawls — TAPPING is how you actually do your time.
            // Ignore it and you'll rot here; tap and you grind through ~10x faster.
            if (jail.serveRate === undefined) jail.serveRate = clamp(jail.total / 110, 0.8, 1.5);
            jail.serveDays += dt * jail.serveRate;
            jail.actClock = (jail.actClock || 0) + dt;
            if (jail.tapCool > 0) jail.tapCool -= dt;
            if (jail.workFx > 0) jail.workFx -= dt;
            if (consumeTap() && (jail.tapCool || 0) <= 0 && jail.days < jail.total) {
                jail.serveDays += 1.4; jail.tapCool = 0.10; jail.workFx = 0.24;   // a tap = real progress
                spawnFloater(W / 2 + rand(-46, 46), H * 0.5, "⛏️ +1 day", "#FFE082");
                playTone(360 + (jail.days % 6) * 26, 0.04, "square", 0.08);
            }
            jail.days = Math.min(jail.total, Math.floor(jail.serveDays));
            // cycle her activity every few seconds (push-ups / reading / etc.)
            jail.actT = (jail.actT === undefined ? 0 : jail.actT) - dt;
            if (jail.actT <= 0) { jail.act = ((jail.act === undefined ? -1 : jail.act) + 1) % SERVE_ACTS.length; jail.actT = rand(3.4, 5.0); jail.actClock = 0; }
            // cellmate ↔ Lulu banter bubbles
            jail.banterT = (jail.banterT === undefined ? 1.0 : jail.banterT) - dt;
            if (jail.banterShowT > 0) jail.banterShowT -= dt;
            if (jail.banterT <= 0 && jail.days < jail.total) {
                jail.banterWho = (jail.banterWho === "mate") ? "lulu" : "mate";
                jail.banterTxt = randPick(jail.banterWho === "mate" ? CELLMATE_LINES : LULU_CELL_LINES);
                jail.banterShowT = 2.8; jail.banterT = rand(3.6, 5.2);
            }
            if (save.lockup && save.lockup.mode === "serving" && save.lockup.days !== jail.days) {
                save.lockup.days = jail.days; persistSave();      // keep the served days on disk
            }
            if (jail.days >= jail.total) {
                // Serving time is the ALWAYS-AVAILABLE, no-cash path out (proven model:
                // Skyrim jail costs time, not gold). No surprise "court costs" skim — the
                // sentence + impounded car IS the punishment, so she can never be
                // soft-locked by a fine she can't pay.
                clearLockup(); jail = null;
                // walks out the jail doors — but her car's impounded, so she's on foot
                beginExitScene("jail", "foot", "⛓️ Time served — you're free!", "copWalk");
                return;
            }
        }
    }

    // A believable, composed cell that scales to any screen height. Viewer is
    // in the corridor: cell interior behind the bars, a guard pacing in front.
    function drawCellRoom(rt, rb, servedDays, servePose) {
        var floorTop = rb - Math.max(76, (rb - rt) * 0.26);
        // back wall (concrete) — fills everything above the floor
        var wall = ctx.createLinearGradient(0, 0, 0, floorTop);
        wall.addColorStop(0, "#48525E"); wall.addColorStop(1, "#2F3740");
        ctx.fillStyle = wall; ctx.fillRect(0, 0, W, floorTop);
        ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 1.5;
        for (var hy = 20; hy < floorTop; hy += 28) { ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke(); }
        for (var vy = 20; vy < floorTop; vy += 28) {
            var off = (Math.floor(vy / 28) % 2) ? 28 : 0;
            for (var vx = off; vx < W; vx += 56) { ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(vx, vy + 28); ctx.stroke(); }
        }
        // floor
        var fl = ctx.createLinearGradient(0, floorTop, 0, H);
        fl.addColorStop(0, "#3A434C"); fl.addColorStop(1, "#1E242A");
        ctx.fillStyle = fl; ctx.fillRect(0, floorTop, W, H - floorTop);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, floorTop, W, 4);
        ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
        for (var sx = 0; sx <= W; sx += 54) { ctx.beginPath(); ctx.moveTo(sx, floorTop); ctx.lineTo(sx + (sx - W / 2) * 0.18, H); ctx.stroke(); }

        // hanging caged light
        ctx.strokeStyle = "#1B1E24"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.5, rt - 2); ctx.lineTo(W * 0.5, rt + 16); ctx.stroke();
        ctx.fillStyle = "rgba(255,240,180,0.45)"; ctx.beginPath(); ctx.arc(W * 0.5, rt + 24, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFE082"; ctx.beginPath(); ctx.arc(W * 0.5, rt + 22, 6, 0, Math.PI * 2); ctx.fill();

        // barred moonlit window
        var winW = 92, winX = W / 2 - winW / 2, winY = rt + 30, winH = 60;
        ctx.fillStyle = "#0E1A2C"; roundRect(winX, winY, winW, winH, 6); ctx.fill();
        ctx.fillStyle = "#FFF8E1"; ctx.beginPath(); ctx.arc(winX + winW - 24, winY + 22, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0E1A2C"; ctx.beginPath(); ctx.arc(winX + winW - 20, winY + 18, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; for (var st = 0; st < 5; st++) ctx.fillRect(winX + 10 + st * 13, winY + 12 + (st % 2) * 18, 2, 2);
        ctx.fillStyle = "#5B6876"; ctx.fillRect(winX - 4, winY + winH, winW + 8, 5);
        ctx.strokeStyle = "#6B7886"; ctx.lineWidth = 4;
        for (var wb = 1; wb < 4; wb++) { var wbx = winX + wb * (winW / 4); ctx.beginPath(); ctx.moveTo(wbx, winY); ctx.lineTo(wbx, winY + winH); ctx.stroke(); }

        // graffiti spread around
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.font = "italic 12px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "left";
        ctx.fillText("LULU WUZ HERE", 24, winY + winH + 46);
        ctx.fillText("FREE THE FLATS", W - 150, winY + winH + 84);

        // tally marks (serving)
        if (servedDays > 0) {
            ctx.strokeStyle = "rgba(255,255,255,0.62)"; ctx.lineWidth = 2;
            var ty0 = winY + winH + 30;
            for (var d = 0; d < servedDays; d++) {
                var grp = Math.floor(d / 5), inG = d % 5, gx = 38 + grp * 40, gy = ty0;
                if (inG < 4) { ctx.beginPath(); ctx.moveTo(gx + inG * 5, gy); ctx.lineTo(gx + inG * 5, gy + 18); ctx.stroke(); }
                else { ctx.beginPath(); ctx.moveTo(gx - 3, gy + 16); ctx.lineTo(gx + 17, gy + 2); ctx.stroke(); }
            }
        }

        // bunk bed (two-tier) on the right, standing on the floor
        var bedW = 116, bedX = W - bedW - 12, lowY = floorTop - 18, upY = lowY - 74;
        ctx.fillStyle = "#37414B"; ctx.fillRect(bedX, upY - 6, 7, lowY - upY + 24); ctx.fillRect(bedX + bedW - 7, upY - 6, 7, lowY - upY + 24);
        ctx.fillStyle = "#4A5560"; roundRect(bedX, upY, bedW, 13, 3); ctx.fill();
        ctx.fillStyle = "#90A4AE"; roundRect(bedX + 4, upY - 8, bedW - 8, 9, 3); ctx.fill();
        ctx.fillStyle = "#B0BEC5"; roundRect(bedX + 6, upY - 10, 28, 9, 3); ctx.fill();
        ctx.fillStyle = "#4A5560"; roundRect(bedX, lowY, bedW, 13, 3); ctx.fill();
        ctx.fillStyle = "#78848F"; roundRect(bedX + 4, lowY - 7, bedW - 8, 8, 3); ctx.fill();

        // steel sink on the left
        var sinkY = floorTop - 2;
        ctx.fillStyle = "#8593A0"; roundRect(20, sinkY - 42, 34, 42, 6); ctx.fill();
        ctx.fillStyle = "#AEB9C2"; ctx.beginPath(); ctx.ellipse(37, sinkY - 38, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6B7682"; ctx.fillRect(35, sinkY - 50, 4, 9);

        // the prisoners (behind the bars)
        if (servePose) drawServingLulu(servePose, floorTop, rb, bedX, bedW, upY, lowY);   // doing her time, activities + beard
        else drawPrisoner(bedX + bedW / 2, upY - 12, gameTime, "lulu");                   // Lulu on the upper bunk (deciding)
        drawPrisoner(W * 0.27, floorTop + (rb - floorTop) * 0.34, gameTime + 1, "mate");  // cellmate on the floor

        // ── the front gate ──
        drawCellBars(rt, rb);

        // a guard paces the corridor IN FRONT of the bars
        var gx = W / 2 + Math.sin(gameTime * 0.5) * (W * 0.30);
        drawAngryMan(gx, floorTop + (rb - floorTop) * 0.5, gameTime, "running", Math.cos(gameTime * 0.5) >= 0 ? 1 : -1, true);
    }

    var SERVE_ACTS = ["🏃 jogging in place", "📖 reading the rulebook", "🎵 prison blues", "✏️ scratching a tally", "🚶 pacing the cell"];
    // Lulu DOING HER TIME — a cycling activity + a beard that grows with the
    // sentence. Drawn behind the bars (drawCellRoom adds them after).
    function drawServingLulu(pose, floorTop, rb, bedX, bedW, upY, lowY) {
        var b = pose.beard, t = pose.t, act = pose.act;
        var fy = floorTop + (rb - floorTop) * 0.42, hx = W * 0.6;
        if (act === 0) {                 // JOGGING IN PLACE (upright bob)
            var jog = Math.abs(Math.sin(t * 7)) * 6;
            drawPrisoner(hx, fy - jog, gameTime * 2.2, "lulu", b);
            // little dust puffs at her feet
            ctx.fillStyle = "rgba(180,190,200,0.35)";
            ctx.beginPath(); ctx.arc(hx - 8, fy + 22, 3 + jog * 0.3, 0, Math.PI * 2); ctx.arc(hx + 8, fy + 22, 3 + jog * 0.3, 0, Math.PI * 2); ctx.fill();
        } else if (act === 1) {          // READING
            drawPrisoner(hx, fy, gameTime * 0.4, "lulu", b);
            ctx.save(); ctx.translate(hx, fy + 6); ctx.rotate(-0.15);
            ctx.fillStyle = "#5D4037"; roundRect(-13, 0, 26, 17, 2); ctx.fill();
            ctx.fillStyle = "#ECEFF1"; roundRect(-11, 2, 10, 13, 1); ctx.fill(); roundRect(1, 2, 10, 13, 1); ctx.fill();
            ctx.restore();
        } else if (act === 2) {          // HARMONICA
            drawPrisoner(hx, fy, gameTime, "lulu", b);
            ctx.fillStyle = "#B0BEC5"; roundRect(hx - 7, fy - 12, 14, 4, 1); ctx.fill();
            drawText("♪", hx + 16, fy - 20 - Math.sin(t * 4) * 4, "bold 14px Arial", "#FFE082", "#000", 2);
            drawText("♫", hx + 28, fy - 28 - Math.cos(t * 3) * 4, "bold 11px Arial", "#FFD54F", "#000", 2);
        } else if (act === 3) {          // TALLY scratching
            drawPrisoner(hx, fy, gameTime * 0.4, "lulu", b);
            var scr = Math.sin(t * 9) * 3;
            ctx.strokeStyle = C.skin; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(hx + 11, fy - 6); ctx.lineTo(hx + 22 + scr, fy - 15); ctx.stroke(); ctx.lineCap = "butt";
            ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
            for (var sm = 0; sm < 3; sm++) { ctx.beginPath(); ctx.moveTo(hx + 24 + sm * 3, fy - 20); ctx.lineTo(hx + 24 + sm * 3, fy - 10); ctx.stroke(); }
        } else {                          // PACING
            var px = hx + Math.sin(t * 1.3) * W * 0.15;
            drawPrisoner(px, fy, gameTime * 1.6, "lulu", b);
        }
    }

    function drawCellBars(rt, rb) {
        var n = Math.max(5, Math.round(W / 60)), gap = W / n;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        for (var i = 0; i <= n; i++) ctx.fillRect(i * gap + 3, rt, 8, rb - rt);   // cast shadow
        for (var i2 = 0; i2 <= n; i2++) {
            var x = i2 * gap, g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
            g.addColorStop(0, "#15181D"); g.addColorStop(0.45, "#454C55"); g.addColorStop(0.55, "#5C656F"); g.addColorStop(1, "#15181D");
            ctx.fillStyle = g; roundRect(x - 5, rt, 10, rb - rt, 3); ctx.fill();
        }
        var rails = [rt + 6, (rt + rb) / 2, rb - 12];
        for (var r = 0; r < rails.length; r++) {
            var ry = rails[r], g2 = ctx.createLinearGradient(0, ry, 0, ry + 12);
            g2.addColorStop(0, "#5C656F"); g2.addColorStop(0.5, "#3A4048"); g2.addColorStop(1, "#15181D");
            ctx.fillStyle = g2; roundRect(0, ry, W, 12, 2); ctx.fill();
        }
        // heavy padlock on the gate
        var lx = W / 2, ly = (rt + rb) / 2 + 8;
        ctx.strokeStyle = "#11141A"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly, 8, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "#0E1014"; roundRect(lx - 12, ly, 24, 22, 4); ctx.fill();
        ctx.fillStyle = "#FFC107"; ctx.beginPath(); ctx.arc(lx, ly + 11, 3.2, 0, Math.PI * 2); ctx.fill();
    }

    // ── The animated JAILBREAK vignette (top-down prison corridor) ──
    // A random escape plays out: she slips out behind a lunch cart, struts past a
    // guard in a stolen cap, lifts a snoozing guard's keys, fakes a faint and
    // bolts, shimmies up a vent, or surfaces from a pudding-spoon tunnel.
    function escCorridor() {
        var fg = ctx.createLinearGradient(0, 0, 0, H);
        fg.addColorStop(0, "#6C7278"); fg.addColorStop(1, "#4C525A");
        ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
        // floor tile seams
        ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 2;
        for (var gx = 0; gx <= W; gx += 56) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
        for (var gy = 60; gy < H; gy += 56) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
        var midY = H * 0.52;
        // open cell on the LEFT (her starting spot) — back wall + bars + swung door
        ctx.fillStyle = "#23272C"; ctx.fillRect(0, midY - 92, 30, 184);
        ctx.strokeStyle = "#AEB6BD"; ctx.lineWidth = 4;
        for (var bx = 9; bx <= 27; bx += 9) { ctx.beginPath(); ctx.moveTo(bx, midY - 88); ctx.lineTo(bx, midY + 6); ctx.stroke(); }
        ctx.save(); ctx.translate(30, midY + 10); ctx.rotate(-0.5);   // the swung-open barred door
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 4;
        for (var dbx = 0; dbx < 40; dbx += 9) { ctx.beginPath(); ctx.moveTo(dbx, 0); ctx.lineTo(dbx, 40); ctx.stroke(); }
        ctx.strokeRect(0, 0, 36, 40); ctx.restore();
        // EXIT door on the RIGHT
        ctx.fillStyle = "#4E342E"; roundRect(W - 30, midY - 52, 30, 104, 4); ctx.fill();
        ctx.fillStyle = "#3E2723"; roundRect(W - 26, midY - 46, 22, 92, 3); ctx.fill();
        ctx.fillStyle = "#FFC107"; ctx.beginPath(); ctx.arc(W - 22, midY, 3, 0, Math.PI * 2); ctx.fill();   // knob
        ctx.fillStyle = "#1B5E20"; roundRect(W - 70, midY - 74, 56, 17, 3); ctx.fill();
        drawText("EXIT", W - 42, midY - 65, "bold 12px 'Segoe UI', Arial", "#FFF", "#000", 2);
        return midY;
    }
    function escSleepGuard(x, y, t) {
        // a guard slumped in a chair, snoring (top-downish)
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(x, y + 14, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5D4037"; roundRect(x - 14, y - 6, 28, 22, 4); ctx.fill();          // chair back
        ctx.fillStyle = "#1A237E"; roundRect(x - 11, y - 2, 22, 20, 5); ctx.fill();          // navy torso
        ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(x, y + 6, 1.8, 0, Math.PI * 2); ctx.fill();  // badge
        ctx.fillStyle = (typeof C !== "undefined" && C.skin) || "#FFD9C0"; ctx.beginPath(); ctx.arc(x, y - 6, 7, 0, Math.PI * 2); ctx.fill();  // head (tipped back)
        ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.arc(x, y - 9, 7, Math.PI, 0); ctx.fill();        // cap
        // Zzz
        var zf = (t * 1.2) % 1;
        ctx.globalAlpha = 1 - zf;
        drawText("z", x + 12 + zf * 8, y - 12 - zf * 14, "bold " + (10 + zf * 6) + "px Arial", "#E1F5FE", "#000", 1);
        ctx.globalAlpha = 1;
    }
    function escCart(x, y) {
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(x, y + 20, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#B0BEC5"; roundRect(x - 20, y - 18, 40, 38, 4); ctx.fill();          // cart body
        ctx.fillStyle = "#90A4AE"; roundRect(x - 20, y - 18, 40, 4, 2); ctx.fill();
        ctx.fillStyle = "#CFD8DC"; roundRect(x - 16, y - 12, 32, 9, 2); ctx.fill();           // tray 1
        ctx.fillStyle = "#FFE0B2"; roundRect(x - 14, y - 10, 12, 5, 1); ctx.fill();           // a sad bread roll
        ctx.fillStyle = "#CFD8DC"; roundRect(x - 16, y + 1, 32, 9, 2); ctx.fill();            // tray 2
        ctx.fillStyle = "#A5D6A7"; roundRect(x + 2, y + 3, 10, 5, 1); ctx.fill();             // mystery green
        ctx.fillStyle = "#37474F"; ctx.beginPath(); ctx.arc(x - 14, y + 20, 4, 0, Math.PI * 2); ctx.arc(x + 14, y + 20, 4, 0, Math.PI * 2); ctx.fill();  // wheels
    }
    function drawJailEscape() {
        var esc = jail.escape || { kind: "cart", cap: "🏃 You're OUT!" }, t = jail.t;
        var p = clamp(t / 3.0, 0, 1), ease = 1 - (1 - p) * (1 - p);
        var midY = escCorridor();
        var cellX = 52, exitX = W - 52, lx, ly = midY;

        if (esc.kind === "cart") {
            var cx = lerp(cellX - 6, exitX - 18, ease);
            drawLuluTopDown(cx - 26, ly + 4, t * 3, "run");      // ducking along behind it
            escCart(cx, ly);
        } else if (esc.kind === "disguise") {
            drawAngryMan(W * 0.52, ly - 52, t, "talk", -1, true);  // an oblivious guard, looking away
            lx = lerp(cellX, exitX, ease);
            drawLuluTopDown(lx, ly, t * 2.4, "run");
            ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.arc(lx, ly - 17, 7.5, Math.PI, 0); ctx.fill();   // stolen cap
            ctx.fillStyle = "#0D1442"; ctx.fillRect(lx - 8, ly - 17, 16, 2);
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(lx, ly - 20, 1.6, 0, Math.PI * 2); ctx.fill();
        } else if (esc.kind === "keys") {
            escSleepGuard(W * 0.52, ly - 6, t);
            lx = p < 0.5 ? lerp(cellX, W * 0.52 - 26, clamp(p / 0.5, 0, 1)) : lerp(W * 0.52 - 26, exitX, clamp((p - 0.5) / 0.5, 0, 1));
            drawLuluTopDown(lx, ly + 10, t * 2.0, "run");
            if (p > 0.45 && p < 0.62) { drawText("🗝️", lx + 12, ly - 2, "16px Arial", "#FFD54F", "#000", 2);  // lifted keys + jingle
                if (Math.random() < 0.4) particles.push({ x: lx + 12, y: ly - 4, vx: rand(-20, 20), vy: rand(-30, -8), life: 0, maxLife: 0.5, size: rand(2, 3), color: "#FFE082", gravity: 120 }); }
        } else if (esc.kind === "faint") {
            var gp = clamp(p / 0.5, 0, 1);
            var gx = lerp(exitX, cellX + 46, gp);
            if (p < 0.5) {   // swooned by the cell; guard rushing in
                drawAngryMan(gx, ly - 6, t, "running", -1, true);
                ctx.save(); ctx.translate(cellX + 24, ly + 8); ctx.rotate(1.4);
                drawLuluTopDown(0, 0, 0, "cry"); ctx.restore();
                drawText("😵", cellX + 24, ly - 18, "18px Arial", "#FFEB3B", "#000", 2);
            } else {        // sprang up — BOLTS past him to the exit
                drawAngryMan(cellX + 46, ly - 6, t, "yelling", 1, true);
                drawText("❓", cellX + 46, ly - 26, "16px Arial", "#FFF", "#000", 2);
                lx = lerp(cellX + 30, exitX, clamp((p - 0.5) / 0.5, 0, 1));
                drawLuluTopDown(lx, ly + 8, t * 3.2, "run");
            }
        } else if (esc.kind === "vent") {
            var vx = W * 0.54;
            // floor vent grate
            ctx.fillStyle = "#263238"; roundRect(vx - 16, ly - 12, 32, 26, 3); ctx.fill();
            ctx.strokeStyle = "#546E7A"; ctx.lineWidth = 2;
            for (var vs = ly - 8; vs < ly + 12; vs += 5) { ctx.beginPath(); ctx.moveTo(vx - 13, vs); ctx.lineTo(vx + 13, vs); ctx.stroke(); }
            if (p < 0.55) { lx = lerp(cellX, vx, clamp(p / 0.55, 0, 1)); drawLuluTopDown(lx, ly, t * 2.4, "run"); }
            else { var sc = clamp(1 - (p - 0.55) / 0.45, 0.1, 1); ctx.save(); ctx.translate(vx, ly - 2); ctx.scale(sc, sc); drawLuluTopDown(0, 0, t * 4, "panic"); ctx.restore();
                if (p > 0.6) drawText("🌀", vx, ly - 22, (12 + (1 - sc) * 12) + "px Arial", "#B3E5FC", "#000", 2); }
        } else {   // tunnel
            var tx = exitX - 40;
            ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.ellipse(tx, ly + 2, 20, 13, 0, 0, Math.PI * 2); ctx.fill();   // dirt hole
            ctx.fillStyle = "#1B0F0A"; ctx.beginPath(); ctx.ellipse(tx, ly + 2, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
            if (p < 0.5) { lx = lerp(cellX, tx - 4, clamp(p / 0.5, 0, 1)); drawLuluTopDown(lx, ly, t * 2.2, "run"); }
            else { var sk = clamp(1 - (p - 0.5) / 0.5, 0.15, 1); ctx.save(); ctx.translate(tx, ly + 2 + (1 - sk) * 8); ctx.scale(sk, sk); drawLuluTopDown(0, 0, t * 3, "panic"); ctx.restore();
                if (Math.random() < 0.5) particles.push({ x: tx + rand(-12, 12), y: ly, vx: rand(-40, 40), vy: rand(-70, -20), life: 0, maxLife: 0.6, size: rand(2, 4), color: randPick(["#5D4037", "#795548", "#3E2723"]), gravity: 240 }); }
        }
        if (typeof drawParticles === "function") drawParticles();

        // title + caption banner
        var pulse = Math.sin(gameTime * 8) > 0;
        drawText("🏃 JAILBREAK!", W / 2, SAFE_TOP + 30, "bold 26px 'Segoe UI', Arial, sans-serif", pulse ? "#7CFC4F" : "#B9F6CA", "#000", 5);
        ctx.fillStyle = "rgba(0,0,0,0.62)"; roundRect(20, H - 116, W - 40, 60, 12); ctx.fill();
        ctx.strokeStyle = "#7CFC4F"; ctx.lineWidth = 2; roundRect(20, H - 116, W - 40, 60, 12); ctx.stroke();
        wrapCentered(esc.cap, W / 2, H - 96, W - 64, 15, "#FFFFFF");
        if (t > 2.6) { ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(gameTime * 4));
            drawText("▾ tap", W / 2, H - 40, "bold 12px 'Segoe UI', Arial", "#7CFC4F", "#000", 2); ctx.globalAlpha = 1; }
    }

    function drawJailCell() {
        if (jail.phase === 0) { drawIntake(); return; }
        var serving = (jail.phase === 9);
        var rt = serving ? 100 : (140 + jail.charges.length * 15);
        var rb = (jail.phase === 1 || jail.phase === 4) ? H - 242 : H - 140;
        var servePose = serving ? { act: jail.act || 0, t: jail.actClock || 0,
            beard: clamp(jail.days / Math.max(1, jail.total), 0, 1), workFx: jail.workFx || 0 } : null;
        drawCellRoom(rt, rb, serving ? Math.min(jail.total, jail.days) : 0, servePose);

        if (jail.flash > 0) { ctx.fillStyle = "rgba(255,255,255," + (jail.flash / 0.3 * 0.5) + ")"; ctx.fillRect(0, 0, W, H); }

        // ── serving the sentence ──
        if (serving) {
            var total = jail.total || 30, day = Math.min(jail.days, total);
            // banter bubbles over the speaker (figures already drawn in the cell)
            var sFloorTop = rb - Math.max(76, (rb - rt) * 0.26), sFy = sFloorTop + (rb - sFloorTop) * 0.42;
            if (jail.banterShowT > 0 && jail.banterTxt) {
                if (jail.banterWho === "mate") drawSpeechBubble(W * 0.27, sFloorTop + (rb - sFloorTop) * 0.34 - 40, jail.banterTxt, gameTime);
                else drawSpeechBubble(clamp(W * 0.6, 80, W - 80), sFy - 46, jail.banterTxt, gameTime);
            }
            drawText("⛓️ SERVING YOUR SENTENCE", W / 2, 34, "bold 24px 'Segoe UI', Arial, sans-serif", "#FF7043", "#000", 5);
            // current activity (clean status line under the title)
            drawText(SERVE_ACTS[jail.act || 0], W / 2, 58, "bold 12px 'Segoe UI', Arial, sans-serif", "#FFCC80", "#000", 3);
            ctx.fillStyle = "rgba(0,0,0,0.66)"; roundRect(W / 2 - 130, H - 134, 260, 92, 12); ctx.fill();
            ctx.strokeStyle = "#FF7043"; ctx.lineWidth = 2; roundRect(W / 2 - 130, H - 134, 260, 92, 12); ctx.stroke();
            drawText("DAY " + day + " / " + total, W / 2, H - 110, "bold 22px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 4);
            ctx.fillStyle = "rgba(255,255,255,0.25)"; roundRect(W / 2 - 104, H - 94, 208, 10, 5); ctx.fill();
            ctx.fillStyle = "#FF7043"; roundRect(W / 2 - 104, H - 94, 208 * (day / total), 10, 5); ctx.fill();
            // tap-to-grind prompt (pulses; brighter right after a tap). Make it
            // clear you tap the SCREEN — there's no special button to hunt for.
            var grindBl = (jail.workFx > 0 ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(gameTime * 5)));
            ctx.globalAlpha = grindBl;
            drawFitText("👆 TAP ANYWHERE to do your time", W / 2, H - 72, 240, 13, "#FFE082", "#000");
            ctx.globalAlpha = 1;
            drawFitText("car impounded — you walk out free 🚶‍♀️", W / 2, H - 54, 240, 11, "#FFCC80", "#000");
            return;
        }

        // ── arrival title + charge sheet (parchment) ──
        drawText("🚔 BOOKED!", W / 2, 30, "bold 30px 'Segoe UI', Arial, sans-serif", "#FF7043", "#000", 6);
        drawCoinHud(14, 14);   // her coin bank — bail/lawyer/fees come out of it
        var sy = 116, sh = 22 + jail.charges.length * 15;
        ctx.fillStyle = "#E8DBB5"; roundRect(W / 2 - 130, sy, 260, sh, 6); ctx.fill();
        ctx.strokeStyle = "#9E8A5A"; ctx.lineWidth = 2; roundRect(W / 2 - 130, sy, 260, sh, 6); ctx.stroke();
        drawText("— CHARGE SHEET —", W / 2, sy + 12, "bold 11px 'Segoe UI', Arial, sans-serif", "#7A1F1A", null, 0);
        for (var c = 0; c < jail.charges.length; c++)
            drawText("• " + jail.charges[c], W / 2, sy + 27 + c * 15, "bold 10px 'Segoe UI', Arial, sans-serif", "#3E2723", null, 0);

        if (jail.phase === 1) {
            // 2×2 action grid + the cellmate chatting in a dialogue box
            var er = cellEscapeRect(), br = cellBailRect(), lr = cellLawyerRect(), cr = cellCourtRect();
            var glow = Math.sin(gameTime * 6) > 0;
            var locked = jail.escapeFails >= 1;
            drawButton(er.x, er.y, er.w, er.h, locked ? "🔒 Watched" : "🏃 Escape",
                locked ? { bg: "#757575", bgDark: "#424242", small: true } : { bg: glow ? "#66BB6A" : "#4CAF50", bgDark: "#2E7D32", small: true });
            var canBail = save.totalCoins >= jail.bail;
            drawButton(br.x, br.y, br.w, br.h, "💰 Bail " + jail.bail, { bg: canBail ? "#FFB300" : "#757575", bgDark: canBail ? "#EF6C00" : "#424242", small: true });
            // No single price here — the lawyer screen lists each tier's own fee.
            drawButton(lr.x, lr.y, lr.w, lr.h, "🤵 Lawyer", { bg: "#26A69A", bgDark: "#00695C", small: true });
            drawButton(cr.x, cr.y, cr.w, cr.h, "⚖️ Court", { bg: "#42A5F5", bgDark: "#0D47A1", small: true });
            drawDialogueBox("CELLMATE", jail.cellmateLine, "cellmate", "#90A4AE", false);
        } else if (jail.phase === 4) {
            // lawyer tier picker
            ctx.fillStyle = "rgba(10,14,20,0.88)"; roundRect(14, H - 252, W - 28, 242, 14); ctx.fill();
            ctx.strokeStyle = "#26A69A"; ctx.lineWidth = 2; roundRect(14, H - 252, W - 28, 242, 14); ctx.stroke();
            drawText("🤵 RETAIN A LAWYER", W / 2, H - 236, "bold 17px 'Segoe UI', Arial, sans-serif", "#80CBC4", "#000", 4);
            var lawTiers = activeLawyerTiers();
            for (var ti = 0; ti < lawTiers.length; ti++) {
                var tier = lawTiers[ti], tr = lawyerTierRect(ti, lawTiers.length);
                var fee = tier.free ? 0 : lawyerFee(tier), afford = tier.free || save.totalCoins >= fee;
                var tierBg = tier.free ? "#5D4037" : (afford ? "#37474F" : "#2A2A2A");
                var tierBgD = tier.free ? "#4E342E" : (afford ? "#263238" : "#1A1A1A");
                drawButton(tr.x, tr.y, tr.w, tr.h, "", { bg: tierBg, bgDark: tierBgD, small: true });
                drawText(tier.name + (tier.free ? "  ❤️ FREE" : "  💰" + fee), tr.x + tr.w / 2, tr.y + (lawTiers.length >= 4 ? 13 : 16),
                    "bold 14px 'Segoe UI', Arial, sans-serif", afford ? tier.accent : "#777", "#000", 3);
                drawText(tier.tag, tr.x + tr.w / 2, tr.y + (lawTiers.length >= 4 ? 28 : 35), "italic 11px 'Segoe UI', Arial, sans-serif", "#CFD8DC", "#000", 2);
            }
            var bk = lawyerBackRect();
            drawButton(bk.x, bk.y, bk.w, bk.h, "‹ Back", { bg: "#546E7A", bgDark: "#37474F", small: true });
        } else if (jail.phase === 3) {
            drawLockpick();
        } else if (jail.phase === 2) {
            drawJailEscape();
        }
    }

    // The booking/mugshot intake before the cell — a full booking room.
    function drawIntake() {
        var floorY = Math.min(H * 0.78, H - 150);
        var groundY = floorY - 8;                 // where Lulu's feet stand
        // institutional tiled wall
        var bg = ctx.createLinearGradient(0, 0, 0, floorY);
        bg.addColorStop(0, "#5E6975"); bg.addColorStop(1, "#3E4751");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, floorY);
        ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
        for (var tx = 0; tx <= W; tx += 46) { ctx.beginPath(); ctx.moveTo(tx, 84); ctx.lineTo(tx, floorY); ctx.stroke(); }
        for (var tyy = 84; tyy < floorY; tyy += 46) { ctx.beginPath(); ctx.moveTo(0, tyy); ctx.lineTo(W, tyy); ctx.stroke(); }
        // floor
        var fg = ctx.createLinearGradient(0, floorY, 0, H);
        fg.addColorStop(0, "#39424C"); fg.addColorStop(1, "#222a31");
        ctx.fillStyle = fg; ctx.fillRect(0, floorY, W, H - floorY);
        ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, floorY, W, 4);

        // ── the HEIGHT CHART behind Lulu (tall, integrated into the wall) ──
        var chW = 142, chX = W / 2 - chW / 2, chTop = 96, chBot = groundY;
        ctx.fillStyle = "#9AA6B2"; roundRect(chX, chTop, chW, chBot - chTop, 3); ctx.fill();
        ctx.fillStyle = "#C4CDD6"; ctx.fillRect(chX, chTop, chW, 6);
        ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2; ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "left";
        var feet = 7;
        for (var ft = 0; ft <= feet; ft++) {
            var ly = chBot - (ft / feet) * (chBot - chTop - 8) - 6;
            var major = true;
            ctx.beginPath(); ctx.moveTo(chX + 4, ly); ctx.lineTo(chX + (major ? 22 : 12), ly); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(chX + chW - 22, ly); ctx.lineTo(chX + chW - 4, ly); ctx.stroke();
            ctx.fillStyle = "#37414B"; ctx.fillText(ft + "'", chX + 6, ly - 3);
            // half-foot ticks
            if (ft < feet) { var ly2 = ly - (1 / feet) * (chBot - chTop - 8) / 2; ctx.beginPath(); ctx.moveTo(chX + 4, ly2); ctx.lineTo(chX + 12, ly2); ctx.stroke(); }
        }

        // ── Lulu front-on, BIGGER, holding her booking placard ──
        ctx.save(); ctx.translate(W / 2, groundY - 30); ctx.scale(1.7, 1.7);
        drawPrisoner(0, 0, gameTime * 0.5, "lulu");
        ctx.restore();
        var plY = groundY - 16;
        ctx.fillStyle = "#FFF"; roundRect(W / 2 - 42, plY, 84, 32, 3); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.strokeRect(W / 2 - 42, plY, 84, 32);
        ctx.fillStyle = "#222"; ctx.fillRect(W / 2 - 42, plY, 84, 3);
        drawText("BRUCK, L.", W / 2, plY + 12, "bold 11px 'Segoe UI', Arial, sans-serif", "#111", null, 0);
        drawText(jail.inmate || "#0613", W / 2, plY + 25, "bold 12px 'Segoe UI', Arial, sans-serif", "#C62828", null, 0);

        // ── a proper press camera on a tripod ──
        var camX = W - 70, camY = groundY - 110;
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(camX, camY + 14); ctx.lineTo(camX - 18, groundY); ctx.moveTo(camX, camY + 14); ctx.lineTo(camX + 18, groundY); ctx.moveTo(camX, camY + 14); ctx.lineTo(camX, groundY - 4); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.fillStyle = "#2B2B2B"; roundRect(camX - 22, camY - 14, 40, 30, 4); ctx.fill();   // body
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(camX - 28, camY + 2, 9, 0, Math.PI * 2); ctx.fill(); // lens
        ctx.fillStyle = "#4FC3F7"; ctx.beginPath(); ctx.arc(camX - 28, camY + 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#37474F"; roundRect(camX - 10, camY - 26, 20, 12, 2); ctx.fill();    // flash housing
        ctx.fillStyle = jail.camFlash > 0 ? "#FFFFFF" : "#FFF59D"; ctx.beginPath(); ctx.arc(camX, camY - 20, 5, 0, Math.PI * 2); ctx.fill();

        // booking desk + ink pad in the foreground corner
        ctx.fillStyle = "#5D4037"; roundRect(-10, groundY - 18, 80, 60, 4); ctx.fill();
        ctx.fillStyle = "#4E342E"; roundRect(-10, groundY - 18, 80, 8, 4); ctx.fill();
        ctx.fillStyle = "#263238"; roundRect(14, groundY - 10, 28, 18, 2); ctx.fill();        // ink pad
        ctx.fillStyle = "#455A64"; roundRect(18, groundY - 6, 20, 10, 1); ctx.fill();

        // title + flash + tap
        drawText("📸 BOOKING & INTAKE", W / 2, 44, "bold 24px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 5);
        drawText("Inmate " + (jail.inmate || "#0613") + " — say cheese!", W / 2, 70, "bold 13px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 3);
        if (jail.camFlash > 0) { ctx.fillStyle = "rgba(255,255,255," + clamp(jail.camFlash / 0.4, 0, 1) + ")"; ctx.fillRect(0, 0, W, H); }
        var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 5));
        ctx.globalAlpha = bl; drawText("tap to continue ▸", W / 2, H - 40, "bold 13px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 2); ctx.globalAlpha = 1;
    }

    // The escape lockpick timing minigame.
    function drawLockpick() {
        var lk = jail.lock, br = pickBarRect();
        var boxY = H * 0.34, boxH = 200;
        // a hot red flash over the whole box on a fresh miss
        var missF = clamp((lk.missFx || 0) / 0.5, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,0.82)"; roundRect(W / 2 - 170, boxY, 340, boxH, 14); ctx.fill();
        ctx.strokeStyle = missF > 0 ? "#FF1744" : "#FFD54F"; ctx.lineWidth = 2 + missF * 3; roundRect(W / 2 - 170, boxY, 340, boxH, 14); ctx.stroke();
        drawText("🔓 PICK THE LOCK", W / 2, boxY + 24, "bold 20px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 4);
        drawText("TAP when the pick is in the green!", W / 2, boxY + 45, "bold 12px 'Segoe UI', Arial, sans-serif", "#ECEFF1", "#000", 2);

        // ── STRIKES: big, bright red X's right under the title so they're unmissable ──
        var sx0 = W / 2 - (lk.maxMiss - 1) * 22, sy = boxY + 72;
        drawText("STRIKES", W / 2 - (lk.maxMiss) * 22 - 16, sy, "bold 11px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 2, "right");
        for (var m = 0; m < lk.maxMiss; m++) {
            var hit = m < lk.misses, cx = sx0 + m * 44;
            // empty slot ring
            ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, sy, 13, 0, Math.PI * 2); ctx.stroke();
            if (hit) {
                // the most-recent miss pops bigger
                var fresh = (m === lk.misses - 1) ? missF : 0;
                var sc = 1 + fresh * 0.7;
                ctx.save(); ctx.translate(cx, sy); ctx.scale(sc, sc);
                ctx.fillStyle = "rgba(255,23,68,0.28)"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                drawText("✖", 0, 0, "bold 26px Arial", "#FF1744", "#000", 3);
                ctx.restore();
            }
        }

        // the bar
        ctx.fillStyle = "#263238"; roundRect(br.x, br.y, br.w, br.h, 6); ctx.fill();
        ctx.fillStyle = "#66BB6A"; roundRect(br.x + (lk.zoneC - lk.zoneW / 2) * br.w, br.y, lk.zoneW * br.w, br.h, 4); ctx.fill();
        // moving pick
        var mx = br.x + lk.pos * br.w;
        ctx.fillStyle = "#FFEB3B"; ctx.fillRect(mx - 2, br.y - 8, 4, br.h + 16);
        ctx.beginPath(); ctx.moveTo(mx, br.y - 8); ctx.lineTo(mx - 6, br.y - 18); ctx.lineTo(mx + 6, br.y - 18); ctx.fill();
        // pins progress
        for (var p = 0; p < lk.pins; p++) {
            ctx.fillStyle = p < lk.done ? "#66BB6A" : "#546E7A";
            ctx.beginPath(); ctx.arc(W / 2 - (lk.pins - 1) * 12 + p * 24, br.y + 50, 6, 0, Math.PI * 2); ctx.fill();
        }
        if (lk.result === "win") drawText("🔓 CLICK! You're out!", W / 2, boxY + 178, "bold 18px 'Segoe UI', Arial, sans-serif", "#7CFC4F", "#000", 4);
        else if (lk.result === "lose") drawText("🚨 CAUGHT! Back to your cell.", W / 2, boxY + 178, "bold 16px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 4);
        // a quick red wash across the whole screen on the miss for extra "ouch"
        if (missF > 0) { ctx.fillStyle = "rgba(255,23,68," + (missF * 0.16) + ")"; ctx.fillRect(0, 0, W, H); }
    }

    // ════════════════ COURTROOM ════════════════
    function openCourt(charges, lawyerTier) {
        var pool = DEFENSE_POOL.slice(), opts = [];
        // If she already RETAINED counsel, "Demand a lawyer" makes no sense — drop it.
        if (lawyerTier) pool = pool.filter(function (o) { return !o.demandLawyer; });
        for (var k = 0; k < 3 && pool.length; k++) opts.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
        var cl = (charges && charges.length ? charges.slice() : ["BEING SUSPICIOUS"]);
        // Up-front prices so the player sees the cost ON the button (no surprises):
        //   plea  = a small settlement, bribe = a flat, affordable gamble.
        var strk = Math.min(save.convictions || 0, 5);
        var pleaFine = Math.max(8, Math.round(bountyFor(cl) * 0.3));
        var bribeCost = Math.min(120, 45 + strk * 8);
        // a guaranteed-but-cheap way out: cop to a lesser charge for a small fine
        opts.push({ label: "🤝 Plea bargain", says: "Fine, fine — I'll take the DEAL, your honor. 🤝", plea: true, cost: pleaFine });
        for (var oi = 0; oi < opts.length; oi++) {
            if (opts[oi].bribe) opts[oi] = { label: opts[oi].label, says: opts[oi].says, outcomes: opts[oi].outcomes, bribe: true, cost: bribeCost };
        }
        var lines = [
            { who: "JUDGE", p: "judge", accent: "#B39DDB", text: randPick(JUDGE_INTROS) },
            { who: "PROSECUTOR", p: "prosecutor", accent: "#EF9A9A", text: randPick(PROSECUTOR_LINES) + " The charges: " + cl.join(", ") + "!" }
        ];
        if (lawyerTier) {
            lines.push({ who: lawyerTier.name.toUpperCase(), p: lawyerTier.portrait || "lawyer", accent: lawyerTier.accent, text: lawyerTier.says ? randPick(lawyerTier.says) : lawyerTier.say });
            // …then the lawyer actually ARGUES the specific charge(s) at stake.
            lines.push({ who: lawyerTier.name.toUpperCase(), p: lawyerTier.portrait || "lawyer", accent: lawyerTier.accent, text: lawyerChargeArgument(lawyerTier, cl) });
        }
        lines.push({ who: "JUDGE", p: "judge", accent: "#B39DDB", text: "And how do you plead, Ms. Bruck?" });
        var gg = Math.random() < 0.5 ? randPick(COURT_GALLERY_GUESTS) : null;
        court = { charges: cl, options: opts, choice: -1, verdict: null, fine: 0, applied: false,
                  galleryGuest: gg ? { p: gg.p, accent: gg.accent, line: randPick(gg.lines) } : null,
                  galleryGuestLines: gg ? gg.lines : null, guestT: gg ? 2.6 : 0, guestCool: rand(7, 11),
                  phase: 0, t: 0, gavel: 0, banner: 0, li: 0, typeT: 0,
                  lawyer: !!lawyerTier, lawyerMitig: lawyerTier ? lawyerTier.mitig : 0,
                  lawyerBlunder: lawyerTier ? lawyerTier.blunder : 0, lawyerName: lawyerTier ? lawyerTier.name : null,
                  objected: false, objResult: null, objLines: null, objLi: 0, objStamp: 0,
                  lines: lines };
        jail = null; state = "courtroom"; playTone(523, 0.12, "triangle", 0.16);
    }

    function rollVerdict(opt) {
        var r = Math.random(), acc = 0;
        for (var i = 0; i < opt.outcomes.length; i++) { acc += opt.outcomes[i][1]; if (r <= acc) return opt.outcomes[i][0]; }
        return "fine";
    }

    // Typewriter reveal for the dialogue box.
    var DLG_CPS = 45;
    function courtTyped(full) { return full.slice(0, Math.floor(court.typeT * DLG_CPS)); }
    function courtDone(full) { return Math.floor(court.typeT * DLG_CPS) >= full.length; }

    // Guilty + jail time = she actually DOES the time, then walks out with her
    // car impounded (→ on-foot mode). Sentence length scales with strikes.
    function serveTime() {
        prisonClothes = false;
        // Longer sentences that climb hard with priors — a real stretch now.
        var total = Math.min(150, 45 + Math.max(0, (save.convictions || 1) - 1) * 25);
        jail = { phase: 9, t: 0, days: 0, serveDays: 0, total: total, charges: [], cellmateLine: "", cellmateT: 99, flash: 0, bail: 0 };
        saveLockup("serving", [], 0, 0, total);
        state = "jailCell";
        playTone(110, 0.4, "square", 0.1);
    }

    // ── Escape lockpick minigame geometry ────────────────────
    function pickBarRect() { return { x: W / 2 - 150, y: H * 0.5, w: 300, h: 26 }; }
    function escapeBtnRect() { return { x: W / 2 - 90, y: H - 92, w: 180, h: 48 }; }

    // After Lulu's plea (and any objection), ~40% of the time a random courtroom
    // EVENT interrupts before the jury deliberates; otherwise straight to verdict.
    function courtAfterArgument() {
        if (!court.eventUsed && Math.random() < 0.4) {
            court.eventUsed = true;
            court.event = pickCourtEvent();
            court.eventLi = 0; court.evStamp = 0.6;
            if (court.event.charge && court.charges.indexOf(court.event.charge) < 0) court.charges.push(court.event.charge);
            court.phase = 36; court.t = 0; court.typeT = 0;
            // a distinct sting per event so the interruption lands
            var evId = court.event.id;
            if (evId === "phone") { playTone(1180, 0.12, "sine", 0.13); setTimeout(function () { playTone(1180, 0.12, "sine", 0.13); }, 220); setTimeout(function () { playTone(1180, 0.12, "sine", 0.13); }, 440); }   // ring ring ring
            else if (evId === "mistrial") { playTone(523, 0.1, "triangle", 0.16); setTimeout(function () { playTone(784, 0.14, "triangle", 0.16); }, 120); setTimeout(function () { playTone(1047, 0.18, "triangle", 0.16); }, 260); }   // triumphant
            else if (evId === "gasp") { playTone(300, 0.35, "sine", 0.11, 720); }                          // rising gasp
            else if (evId === "avigail") { playTone(160, 0.22, "sawtooth", 0.15, 110); }                   // ominous
            else if (evId === "bubbe") { playTone(587, 0.12, "triangle", 0.12); setTimeout(function () { playTone(880, 0.16, "triangle", 0.12); }, 130); }   // warm chime
            else playTone(440, 0.1, "triangle", 0.14);
        } else {
            court.phase = 4; court.t = 0;
        }
    }

    function updateCourtroom(dt) {
        court.t += dt;
        court.typeT += dt;
        if (court.gavel > 0) court.gavel -= dt;
        if (court.banner > 0) court.banner -= dt;
        // The gallery guest only blurts now and then — a brief heckle that clears,
        // not a caption parked on screen the whole trial.
        if (court.galleryGuest) {
            if (court.guestT > 0) court.guestT -= dt;
            else { court.guestCool -= dt; if (court.guestCool <= 0) { court.guestT = 2.6; court.guestCool = rand(8, 13); court.galleryGuest.line = randPick(court.galleryGuestLines); } }
        }

        if (court.phase === 0) {                     // ALL RISE
            if (court.t > 1.5) { court.phase = 1; court.t = 0; court.typeT = 0; court.gavel = 0.3; playTone(150, 0.12, "square", 0.18); }
            return;
        }
        if (court.phase === 1) {                     // intro dialogue (judge → pros → judge)
            if (consumeTap()) {
                if (!courtDone(court.lines[court.li].text)) { court.typeT = 999; return; }   // reveal first
                court.li++; court.typeT = 0;
                if (court.li >= court.lines.length) { court.phase = 2; court.t = 0; }
                else playTone(court.lines[court.li].p === "judge" ? 300 : 380, 0.04, "sine", 0.06);
            }
            return;
        }
        if (court.phase === 2) {                     // pick a defense
            var click = consumeClick();
            if (click) for (var i = 0; i < court.options.length; i++) {
                var r = courtOptRect(i);
                if (pointInRect(click.x, click.y, r.x, r.y, r.w, r.h)) {
                    court.choice = i; court.phase = 3; court.t = 0; court.typeT = 0;
                    court.defLine = { who: "LULU", p: "lulu", accent: "#F48FB1", text: court.options[i].says };
                    playTone(660, 0.06, "sine", 0.1); return;
                }
            }
            return;
        }
        if (court.phase === 3) {                     // Lulu's defense line
            if (consumeTap()) {
                if (!courtDone(court.defLine.text)) { court.typeT = 999; return; }
                // The prosecutor sometimes leaps up to OBJECT before the ruling.
                if (!court.objected && Math.random() < 0.5) {
                    court.objected = true;
                    court.objResult = Math.random() < 0.5 ? "sustain" : "overrule";
                    court.objLines = [
                        { who: "PROSECUTOR", p: "prosecutor", accent: "#EF9A9A", text: randPick(OBJECTIONS) },
                        { who: "JUDGE", p: "judge", accent: "#B39DDB", text: randPick(court.objResult === "sustain" ? JUDGE_SUSTAIN : JUDGE_OVERRULE) }
                    ];
                    court.objLi = 0; court.phase = 35; court.t = 0; court.typeT = 0; court.objStamp = 0.6;
                    playTone(200, 0.12, "square", 0.16);
                } else {
                    courtAfterArgument();
                }
            }
            return;
        }
        if (court.phase === 36) {                    // a random courtroom EVENT
            if (court.evStamp > 0) court.evStamp -= dt;
            if (consumeTap()) {
                if (!courtDone(court.event.lines[court.eventLi].text)) { court.typeT = 999; return; }
                court.eventLi++; court.typeT = 0;
                if (court.eventLi >= court.event.lines.length) { court.phase = 4; court.t = 0; }
                else playTone(court.event.lines[court.eventLi].p === "judge" ? 300 : 380, 0.04, "sine", 0.06);
            }
            return;
        }
        if (court.phase === 35) {                    // OBJECTION exchange
            if (court.objStamp > 0) court.objStamp -= dt;
            if (consumeTap()) {
                if (!courtDone(court.objLines[court.objLi].text)) { court.typeT = 999; return; }
                court.objLi++; court.typeT = 0;
                if (court.objLi >= court.objLines.length) { courtAfterArgument(); }
                else { court.objStamp = 0; playTone(300, 0.04, "sine", 0.06); }
            }
            return;
        }
        if (court.phase === 4) {                     // jury deliberates → verdict
            if (court.t > 1.9) {
                var opt = court.options[court.choice];
                var strikes = save.convictions || 0;
                if (opt.plea) {
                    // Plea bargain: cop to a lesser charge for a guaranteed small fine.
                    court.verdict = "fine";
                    court.fine = opt.cost || Math.max(8, Math.round(bountyFor(court.charges) * 0.3));
                    // A plea bargain is the lenient way out — it should NOT add a strike
                    // (that double-punished the cheap option and snowballed toward jail).
                    court.verdictLine = { who: "JUDGE", p: "judge", accent: "#B39DDB", text: "Deal accepted. Lesser charge, 💰" + court.fine + " fine. Don't make me regret it. 🤝" };
                    court.phase = 5; court.t = 0; court.typeT = 0; court.gavel = 0.4; court.banner = 0.55;
                    playTone(150, 0.16, "square", 0.18); playTone(523, 0.2, "triangle", 0.16);
                    return;
                }
                court.verdict = rollVerdict(opt);
                // A sustained objection hurts her; an overruled one helps.
                if (court.objResult === "sustain" && court.verdict === "dismissed" && Math.random() < 0.6) court.verdict = "fine";
                if (court.objResult === "overrule" && court.verdict !== "dismissed" && Math.random() < 0.35) court.verdict = "dismissed";
                // STRIKES: repeat offenders get no mercy. 3rd strike = real jail.
                if (strikes >= 2) court.verdict = "jail";
                else if (strikes >= 1 && court.verdict === "dismissed" && Math.random() < 0.5) court.verdict = "fine";
                if (court.charges.length >= 4 && court.verdict === "dismissed" && Math.random() < 0.5) court.verdict = "fine";
                // A retained lawyer fights it down — by how much depends on the tier.
                // Cheap counsel can BLUNDER and not help (you get what you pay for).
                if (court.lawyer) {
                    if (Math.random() < court.lawyerBlunder) {
                        if (court.verdict === "dismissed" && Math.random() < 0.5) court.verdict = "fine";
                    } else {
                        if (court.verdict === "jail" && Math.random() < court.lawyerMitig) court.verdict = "fine";
                        if (court.verdict === "fine" && Math.random() < court.lawyerMitig * 0.7) court.verdict = "dismissed";
                    }
                }
                // a random courtroom EVENT can swing it (mistrial springs her outright)
                if (court.event) {
                    var nd = court.event.nudge;
                    if (nd === "dismiss") court.verdict = "dismissed";
                    else if (nd === "help") { if (court.verdict === "jail" && Math.random() < 0.5) court.verdict = "fine"; else if (court.verdict === "fine" && Math.random() < 0.45) court.verdict = "dismissed"; }
                    else if (nd === "hurt") { if (court.verdict === "dismissed" && Math.random() < 0.5) court.verdict = "fine"; else if (court.verdict === "fine" && Math.random() < 0.3) court.verdict = "jail"; }
                }
                // ── BRIBERY: she actually PAYS, and it's a real gamble ──
                if (opt.bribe) {
                    court.bribePaid = chargeCoins(opt.cost || 50);     // the flat bribe (shown on the button)
                    if (Math.random() < 0.6) {                         // a real gamble again (flop = just a small fine)
                        court.bribeWorked = true;
                        court.verdict = "dismissed";                   // the judge looks the other way
                    } else {                                           // flopped — just a small slap, NOT jail
                        court.bribeFlop = true;
                        court.verdict = "fine";
                        court.smallFine = true;
                    }
                }
                if (court.verdict === "fine") {        // money punishment (jail = time + car instead)
                    // Severity-weighted + capped; a flopped bribe is only a small fine.
                    court.fine = court.smallFine ? Math.max(8, Math.round(bountyFor(court.charges) * 0.3))
                                                 : bountyFor(court.charges);
                }
                if (court.verdict !== "dismissed") { save.convictions = (save.convictions || 0) + 1; persistSave(); }
                var vt = court.bribeFlop ? "Hmph — THAT'S your offer? Just a small fine then. Now scram. 😒 (💰" + court.fine + ")"
                       : court.verdict === "dismissed" ? (opt.bribe ? "Case... 'dismissed.' *quietly pockets the envelope* 🤫" : "CASE DISMISSED! Now get outta my court. 🎉")
                       : court.verdict === "jail" ? (strikes >= 2 ? "THREE STRIKES! You're doing HARD time! ⛓️" : "GUILTY! Off to the clink, missy! ⛓️")
                       : "GUILTY! That'll be 💰" + court.fine + ". See the clerk on your way out. 💸";
                court.verdictLine = { who: "JUDGE", p: "judge", accent: "#B39DDB", text: vt };
                court.phase = 5; court.t = 0; court.typeT = 0; court.gavel = 0.4; court.banner = 0.55;
                playTone(150, 0.16, "square", 0.18);
                playTone(court.verdict === "dismissed" ? 880 : 200, 0.22, "triangle", 0.16);
                return;
            }
            return;
        }
        if (court.phase === 5) {                     // verdict delivered → consequence
            if (!court.applied) {
                court.applied = true;
                if (court.verdict === "fine") {
                    court.couldnt = court.fine > save.totalCoins;
                    court.paid = chargeCoins(court.fine);   // out of her coins (cash-register drop)
                }
            }
            if (court.t > 0.7 && consumeTap()) {
                if (!courtDone(court.verdictLine.text)) { court.typeT = 999; return; }
                var v = court.verdict; court = null;
                clearWanted();   // she's answered to a judge — the slate is clean
                if (v !== "jail") clearLockup();   // jail keeps a lockup (serveTime resets it)
                if (v === "jail") { serveTime(); return; }     // actually do the time → walk out, no car
                prisonClothes = false;
                // walk out of the courthouse and drive off
                beginExitScene("court", "drive",
                    v === "dismissed" ? "⚖️ DISMISSED — free to go!" : "💸 Fine paid. Drive safer!");
            }
        }
    }

    // A tall arched window with cool daylight on the back wall.
    function drawCourtWindow(cx, top, w, h) {
        ctx.fillStyle = "#2E1D14"; roundRect(cx - w / 2 - 4, top - 4, w + 8, h + 8, w / 2); ctx.fill();
        var sky = ctx.createLinearGradient(0, top, 0, top + h);
        sky.addColorStop(0, "#9FC2D8"); sky.addColorStop(1, "#5E7E96");
        ctx.save(); roundRect(cx - w / 2, top, w, h, w / 2); ctx.clip();
        ctx.fillStyle = sky; ctx.fillRect(cx - w / 2, top, w, h);
        // a couple of soft light streaks
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.save(); ctx.translate(cx, top + h / 2); ctx.rotate(-0.5);
        ctx.fillRect(-6, -h, 5, h * 2); ctx.fillRect(6, -h, 3, h * 2); ctx.restore();
        ctx.restore();
        // muntins (cross bars)
        ctx.strokeStyle = "#2E1D14"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top + h);
        ctx.moveTo(cx - w / 2, top + h * 0.34); ctx.lineTo(cx + w / 2, top + h * 0.34);
        ctx.moveTo(cx - w / 2, top + h * 0.67); ctx.lineTo(cx + w / 2, top + h * 0.67); ctx.stroke();
    }

    // Perspective wood floor: a board fan converging to a vanishing point on the
    // horizon, plus faint cross-seams that bunch up toward the back. This single
    // trick is what gives the room real depth on any screen height.
    function drawCourtPerspFloor(topY, frontY) {
        var fg = ctx.createLinearGradient(0, topY, 0, frontY);
        fg.addColorStop(0, "#6A4830"); fg.addColorStop(0.45, "#553A28"); fg.addColorStop(1, "#3A271A");
        ctx.fillStyle = fg; ctx.fillRect(0, topY, W, frontY - topY);
        ctx.save(); ctx.beginPath(); ctx.rect(0, topY, W, frontY - topY); ctx.clip();
        // radiating boards
        ctx.strokeStyle = "rgba(0,0,0,0.20)"; ctx.lineWidth = 1.5;
        for (var bx = -W * 0.5; bx <= W * 1.5; bx += W / 10) {
            ctx.beginPath(); ctx.moveTo(W / 2, topY - 26); ctx.lineTo(bx, frontY + 6); ctx.stroke();
        }
        // a faint warm highlight board down the middle
        ctx.strokeStyle = "rgba(255,224,170,0.05)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(W / 2, topY - 26); ctx.lineTo(W / 2, frontY + 6); ctx.stroke();
        // cross-seams, tighter toward the horizon
        var seams = [0.10, 0.24, 0.42, 0.66, 0.95];
        ctx.strokeStyle = "rgba(0,0,0,0.14)"; ctx.lineWidth = 1.5;
        for (var s = 0; s < seams.length; s++) {
            var yy = topY + (frontY - topY) * seams[s];
            ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
        }
        ctx.restore();
    }

    // The jury box: a raised, slightly-angled platform against the left wall.
    function drawCourtJury(x, topY, react) {
        var w = 126, h = 66;
        // platform base (front face, angled toward the viewer)
        ctx.fillStyle = "#33210F"; ctx.beginPath();
        ctx.moveTo(x, topY + h); ctx.lineTo(x + w, topY + h - 8);
        ctx.lineTo(x + w, topY + h + 26); ctx.lineTo(x, topY + h + 34); ctx.closePath(); ctx.fill();
        // box back panel
        ctx.fillStyle = "#4E342E"; ctx.beginPath();
        ctx.moveTo(x, topY); ctx.lineTo(x + w, topY + 6);
        ctx.lineTo(x + w, topY + h - 8); ctx.lineTo(x, topY + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(x, topY, 5, h);   // inner shade
        // two rows of jurors, riding the slope
        for (var r = 0; r < 2; r++) for (var c = 0; c < 4; c++)
            drawJuror(x + 22 + c * 27, topY + 24 + r * 22 + c * 1.6, r * 4 + c, react);
        // front rail (angled)
        ctx.fillStyle = "#6D4C32"; ctx.beginPath();
        ctx.moveTo(x, topY + h - 2); ctx.lineTo(x + w, topY + h - 10);
        ctx.lineTo(x + w, topY + h - 2); ctx.lineTo(x, topY + h + 6); ctx.closePath(); ctx.fill();
        // plate
        ctx.fillStyle = "#2E1D14"; roundRect(x + w / 2 - 24, topY + h + 8, 48, 13, 3); ctx.fill();
        drawText("JURY", x + w / 2, topY + h + 15, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
    }

    // A counsel table seen at a slight angle (parallelogram top), with a folder.
    function drawCounselTable(cx, baseY, accent) {
        var tw = 80, th = 15;
        ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.ellipse(cx, baseY + 30, tw * 0.58, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6B4A2F"; ctx.beginPath();
        ctx.moveTo(cx - tw / 2, baseY); ctx.lineTo(cx + tw / 2, baseY);
        ctx.lineTo(cx + tw / 2 - 9, baseY - 11); ctx.lineTo(cx - tw / 2 - 9, baseY - 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#4E3420"; ctx.fillRect(cx - tw / 2, baseY, tw, th);
        ctx.fillStyle = "#3A2718"; ctx.fillRect(cx - tw / 2, baseY + th, tw, 3);
        ctx.fillStyle = "#2E1D14"; ctx.fillRect(cx - tw / 2 + 5, baseY + th, 5, 16); ctx.fillRect(cx + tw / 2 - 10, baseY + th, 5, 16);
        // papers + a colored case folder
        ctx.fillStyle = "#ECECEC"; ctx.save(); ctx.translate(cx - 12, baseY - 5); ctx.rotate(-0.12); ctx.fillRect(-9, -3, 18, 6); ctx.restore();
        ctx.fillStyle = accent; ctx.fillRect(cx + 4, baseY - 8, 17, 5);
    }

    // The bar/railing across the front of the well, with a gap for the aisle.
    function drawCourtBar(y) {
        ctx.fillStyle = "#5A3E28"; ctx.fillRect(0, y, W, 7);
        ctx.fillStyle = "#3A2718"; ctx.fillRect(0, y + 7, W, 4);
        ctx.fillStyle = "#6D4C32";
        for (var bx = 14; bx < W; bx += 26) {
            if (Math.abs(bx + 2 - W / 2) < 34) continue;   // leave the center aisle open
            ctx.fillRect(bx, y + 11, 5, 20);
        }
        ctx.fillStyle = "#3A2718"; ctx.fillRect(0, y + 30, W, 4);
    }

    // Big, dark, slightly-warm-rimmed audience heads framing the very foreground —
    // we're watching from a gallery seat. Replaces the old flat grid of heads.
    function drawGalleryFG(frontY) {
        // four big audience heads peeking up over the bar, framing the foreground.
        var seats = [0.11, 0.36, 0.64, 0.89];
        var guest = (typeof court !== "undefined" && court) ? court.galleryGuest : null;
        var guestSeat = 2;   // the family member sits just right of centre
        for (var i = 0; i < seats.length; i++) {
            var gx = seats[i] * W, sc = 1.55 + (i % 2) * 0.3, gy = frontY - 6 + (i % 2) * 8;
            if (guest && i === guestSeat) {
                // a LIT, recognizable family face among the dark silhouettes
                ctx.save(); ctx.translate(gx, gy + 2); ctx.scale(1.12, 1.12);
                ctx.fillStyle = "rgba(0,0,0,0.5)"; roundRect(-26, 4, 52, 50, 14); ctx.fill();   // seat shadow
                drawPortrait(guest.p, 0, -2, 50, Math.sin(gameTime * 5) > 0);
                ctx.restore();
                continue;
            }
            ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc);
            ctx.fillStyle = "#130E0A";
            roundRect(-30, -4, 60, 54, 15); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -8, 18, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "rgba(255,201,130,0.13)"; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.arc(0, -8, 18, Math.PI * 1.1, Math.PI * 1.92); ctx.stroke();
            ctx.restore();
        }
        // the guest's little outburst — only while they're actively piping up
        if (guest && guest.line && court.guestT > 0) {
            var bx = clamp(seats[guestSeat] * W, 130, W - 130);
            drawSpeechBubble(bx, frontY - 84, guest.line, gameTime);
        }
    }

    function drawCourtroom() {
        // ════ Grand courtroom built for depth: a perspective floor + red aisle
        // carpet receding to the bench, a raised jury box & counsel tables in the
        // well, and large out-of-focus gallery silhouettes framing the foreground
        // (POV: we're sitting in the gallery). Fills any screen height naturally. ════
        var reserve = 128;                                   // bottom band for the dialogue box
        var wallBot = 172;                                   // horizon / far edge of the floor
        var floorFront = Math.max(wallBot + 250, H - reserve);
        var spanH = floorFront - wallBot;

        // — back wall: warm wood paneling —
        var wall = ctx.createLinearGradient(0, 0, 0, wallBot);
        wall.addColorStop(0, "#6E4B36"); wall.addColorStop(1, "#553A2A");
        ctx.fillStyle = wall; ctx.fillRect(0, 0, W, wallBot);
        ctx.fillStyle = "rgba(0,0,0,0.13)"; for (var p = 22; p < W; p += 40) ctx.fillRect(p, 0, 2, wallBot);
        ctx.fillStyle = "rgba(255,232,200,0.05)"; for (var p2 = 24; p2 < W; p2 += 40) ctx.fillRect(p2, 0, 1, wallBot);
        // overhead warm light cone onto the bench
        var cone = ctx.createLinearGradient(0, 0, 0, wallBot + 120);
        cone.addColorStop(0, "rgba(255,226,150,0.20)"); cone.addColorStop(1, "rgba(255,226,150,0)");
        ctx.fillStyle = cone; ctx.beginPath();
        ctx.moveTo(W / 2 - 26, 0); ctx.lineTo(W / 2 + 26, 0);
        ctx.lineTo(W / 2 + 135, wallBot + 110); ctx.lineTo(W / 2 - 135, wallBot + 110); ctx.closePath(); ctx.fill();
        // arched window (left) + diegetic case docket (right) flank the seal
        drawCourtWindow(48, 28, 34, 104);
        // great seal — raised, faintly glowing
        var sgl = ctx.createRadialGradient(W / 2, 44, 4, W / 2, 44, 42);
        sgl.addColorStop(0, "rgba(255,213,79,0.30)"); sgl.addColorStop(1, "rgba(255,213,79,0)");
        ctx.fillStyle = sgl; ctx.beginPath(); ctx.arc(W / 2, 44, 42, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2E1D14"; ctx.beginPath(); ctx.arc(W / 2, 42, 23, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(W / 2, 42, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#D4AF37"; ctx.beginPath(); ctx.arc(W / 2, 42, 18, 0.1, Math.PI - 0.1); ctx.fill();
        drawText("⚖", W / 2, 45, "bold 21px Arial", "#3E2723", null, 0);
        // flags flanking the seal
        ctx.fillStyle = "#8D6E63"; ctx.fillRect(W / 2 - 48, 22, 3, 44); ctx.fillRect(W / 2 + 45, 22, 3, 44);
        ctx.fillStyle = "#1565C0"; ctx.beginPath(); ctx.moveTo(W / 2 - 45, 24); ctx.quadraticCurveTo(W / 2 - 30, 30, W / 2 - 16, 24);
        ctx.lineTo(W / 2 - 16, 44); ctx.quadraticCurveTo(W / 2 - 30, 50, W / 2 - 45, 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#C62828"; ctx.beginPath(); ctx.moveTo(W / 2 + 16, 24); ctx.quadraticCurveTo(W / 2 + 30, 30, W / 2 + 45, 24);
        ctx.lineTo(W / 2 + 45, 44); ctx.quadraticCurveTo(W / 2 + 30, 50, W / 2 + 16, 44); ctx.closePath(); ctx.fill();
        // ribbon banner (tucked just under the seal, above the judge)
        ctx.fillStyle = "#5A1A18"; roundRect(W / 2 - 58, 60, 116, 13, 3); ctx.fill();
        ctx.fillStyle = "#3E0F0E"; ctx.beginPath(); ctx.moveTo(W / 2 - 58, 73); ctx.lineTo(W / 2 - 66, 79); ctx.lineTo(W / 2 - 58, 69); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W / 2 + 58, 73); ctx.lineTo(W / 2 + 66, 79); ctx.lineTo(W / 2 + 58, 69); ctx.fill();
        drawText("IN JUSTICE WE TRUST", W / 2, 67, "bold 8px 'Segoe UI', Arial, sans-serif", "#F0D8A0", "#000", 1);
        // wainscot rail where the wall meets the floor
        ctx.fillStyle = "#3A2718"; ctx.fillRect(0, wallBot - 8, W, 8);
        ctx.fillStyle = "#241509"; ctx.fillRect(0, wallBot, W, 3);

        // — perspective floor + red aisle carpet —
        drawCourtPerspFloor(wallBot, floorFront);
        var carBackY = wallBot - 4, carBackH = 14, carFrontH = 42, carFrontY = floorFront + 26;
        ctx.beginPath();
        ctx.moveTo(W / 2 - carBackH, carBackY); ctx.lineTo(W / 2 + carBackH, carBackY);
        ctx.lineTo(W / 2 + carFrontH, carFrontY); ctx.lineTo(W / 2 - carFrontH, carFrontY); ctx.closePath();
        var cg = ctx.createLinearGradient(0, carBackY, 0, carFrontY);
        cg.addColorStop(0, "#8A2F2A"); cg.addColorStop(1, "#5C1B19");
        ctx.fillStyle = cg; ctx.fill();
        // carpet gold trim + center sheen
        ctx.strokeStyle = "rgba(214,175,80,0.55)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W / 2 - carBackH + 4, carBackY); ctx.lineTo(W / 2 - carFrontH + 7, carFrontY);
        ctx.moveTo(W / 2 + carBackH - 4, carBackY); ctx.lineTo(W / 2 + carFrontH - 7, carFrontY); ctx.stroke();
        ctx.strokeStyle = "rgba(255,210,180,0.10)"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(W / 2, carBackY); ctx.lineTo(W / 2, carFrontY); ctx.stroke();

        // — raised dais under the judge's bench —
        var benchTopY = 84;
        ctx.fillStyle = "#33210F"; ctx.beginPath();
        ctx.moveTo(W / 2 - 116, wallBot); ctx.lineTo(W / 2 + 116, wallBot);
        ctx.lineTo(W / 2 + 100, wallBot - 22); ctx.lineTo(W / 2 - 100, wallBot - 22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#4A3220"; ctx.fillRect(W / 2 - 100, wallBot - 25, 200, 4);
        // two carpeted steps up to the bench
        for (var st = 0; st < 2; st++) {
            ctx.fillStyle = st % 2 ? "#7A2824" : "#6A201D";
            ctx.fillRect(W / 2 - 30 - st * 8, wallBot + 2 + st * 9, 60 + st * 16, 8);
        }

        // — the bench + judge (back, center) —
        drawBenchJudge(W / 2, benchTopY + 6, court.gavel > 0);
        if (court.gavel > 0) drawText("BANG!", W / 2 + 66, benchTopY + 4, "bold 13px Arial", "#FFD54F", "#000", 3);

        // — jury box (back-left, raised) —
        var jReact = court.phase >= 5 ? (court.verdict === "dismissed" ? "free" : "guilty")
                   : (court.phase === 4 ? "deliberate" : "watch");
        drawCourtJury(6, 150, jReact);

        // — counsel tables in the well; Lulu front & center at the lectern —
        var tableY = wallBot + spanH * 0.28;
        var lecternY = Math.max(tableY + 130, floorFront - 170);   // close to camera; the aisle recedes ABOVE her
        var prosTalk = (court.phase === 1 && court.li === 1);
        drawCounselTable(W * 0.78, tableY, "#C62828");      // prosecution
        drawProsecutor(W * 0.80, tableY + 4, gameTime, prosTalk);
        if (court.lawyer) {
            drawCounselTable(W * 0.20, tableY, "#26A69A");  // defense
            drawProsecutor(W * 0.20, tableY + 4, gameTime + 3, false, "DEFENSE");
        }
        // a soft spotlight pool picks Lulu out as the focal figure
        var pool = ctx.createRadialGradient(W / 2, lecternY + 4, 6, W / 2, lecternY + 4, 96);
        pool.addColorStop(0, "rgba(255,232,170,0.18)"); pool.addColorStop(1, "rgba(255,232,170,0)");
        ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(W / 2, lecternY + 14, 80, 60, 0, 0, Math.PI * 2); ctx.fill();
        // Lulu at the lectern, scaled up as the closest, most prominent figure
        ctx.save(); ctx.translate(W / 2, lecternY); ctx.scale(1.28, 1.28);
        drawDefendant(0, 0); ctx.restore();

        // — the bar + foreground gallery silhouettes (our POV) —
        drawCourtBar(floorFront - 40);
        drawGalleryFG(floorFront);

        // soft vignette to focus the eye on the lit bench
        var vg = ctx.createRadialGradient(W / 2, wallBot, 60, W / 2, H * 0.5, H * 0.72);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.42)");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

        // — case docket placard on the right wall (diegetic charge sheet) —
        var dkW = 134, dkX = W - dkW - 10, dkY = 30;
        var dkH = 26 + court.charges.length * 13 + ((save.convictions || 0) > 0 ? 15 : 0);
        ctx.fillStyle = "#2E1D14"; roundRect(dkX - 3, dkY - 3, dkW + 6, dkH + 6, 5); ctx.fill();
        ctx.fillStyle = "rgba(20,12,6,0.92)"; roundRect(dkX, dkY, dkW, dkH, 4); ctx.fill();
        ctx.strokeStyle = "#6D4C32"; ctx.lineWidth = 1.5; roundRect(dkX, dkY, dkW, dkH, 4); ctx.stroke();
        drawText("📋 CASE DOCKET", dkX + dkW / 2, dkY + 13, "bold 9px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 2);
        ctx.strokeStyle = "rgba(255,213,79,0.25)"; ctx.beginPath(); ctx.moveTo(dkX + 8, dkY + 18); ctx.lineTo(dkX + dkW - 8, dkY + 18); ctx.stroke();
        for (var c = 0; c < court.charges.length; c++)
            drawText("• " + court.charges[c], dkX + dkW / 2, dkY + 30 + c * 13, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 1);
        var pri = save.convictions || 0;
        if (pri > 0)
            drawText(pri >= 2 ? "⚠️ 3RD STRIKE — NO MERCY" : "PRIORS: " + pri + " strike" + (pri > 1 ? "s" : ""),
                dkX + dkW / 2, dkY + 33 + court.charges.length * 13, "bold 8px 'Segoe UI', Arial, sans-serif", pri >= 2 ? "#FF5252" : "#FFB300", "#000", 2);
        // her coin bank, under the docket — so the fine visibly comes out of it
        drawCoinHud(W - 116, dkY + dkH + 8);

        // ── phase overlays ──
        if (court.phase === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
            var rise = 1 + Math.max(0, 0.3 - court.t) * 1.2;
            ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(rise, rise);
            drawText("⚖️ ALL RISE ⚖️", 0, 0, "bold 30px 'Segoe UI', Arial, sans-serif", "#FFF", "#000", 6); ctx.restore();
        } else if (court.phase === 1) {
            var ln = court.lines[court.li];
            var d1 = courtDone(ln.text);
            drawDialogueBox(ln.who, courtTyped(ln.text), ln.p, ln.accent, d1, !d1);
        } else if (court.phase === 2) {
            // RPG choice menu
            ctx.fillStyle = "rgba(20,12,30,0.80)"; roundRect(14, H - 210, W - 28, 200, 12); ctx.fill();
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 2; roundRect(14, H - 210, W - 28, 200, 12); ctx.stroke();
            drawText("⚖️  How do you plead, Ms. Bruck?", W / 2, H - 192, "bold 14px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
            for (var i = 0; i < court.options.length; i++) {
                var r = courtOptRect(i), plea = court.options[i].plea;
                // Show the price right on the button for the options that cost coins.
                var oLbl = court.options[i].label + (court.options[i].cost ? "  (💰" + court.options[i].cost + ")" : "");
                drawButton(r.x, r.y, r.w, r.h, oLbl,
                    plea ? { bg: "#26A69A", bgDark: "#00695C", small: true } : { bg: "#7E57C2", bgDark: "#4527A0", small: true });
            }
        } else if (court.phase === 3) {
            var d3 = courtDone(court.defLine.text);
            drawDialogueBox(court.defLine.who, courtTyped(court.defLine.text), court.defLine.p, court.defLine.accent, d3, !d3);
        } else if (court.phase === 35) {
            // OBJECTION! — a slam stamp on the prosecutor's beat, then the judge rules
            if (court.objLi === 0 && court.objStamp > 0) {
                var os = 1 + court.objStamp * 2.5;
                ctx.save(); ctx.translate(W / 2, H * 0.34); ctx.rotate(0.06); ctx.scale(os, os); ctx.globalAlpha = clamp(1 - court.objStamp, 0, 1) + 0.4;
                ctx.strokeStyle = "#FF5252"; ctx.lineWidth = 4; roundRect(-130, -26, 260, 52, 8); ctx.stroke();
                drawText("OBJECTION!", 0, 0, "bold 32px 'Segoe UI', Arial, sans-serif", "#FF5252", "#000", 5); ctx.restore();
            }
            var ol = court.objLines[court.objLi];
            var dO = courtDone(ol.text);
            drawDialogueBox(ol.who, courtTyped(ol.text), ol.p, ol.accent, dO, !dO);
        } else if (court.phase === 36) {
            // a "❗ HOLD ON ❗" stamp on the first beat, then the event plays out
            if (court.eventLi === 0 && court.evStamp > 0) {
                var es = 1 + court.evStamp * 2;
                ctx.save(); ctx.translate(W / 2, H * 0.32); ctx.rotate(-0.05); ctx.scale(es, es); ctx.globalAlpha = clamp(1 - court.evStamp, 0, 1) + 0.4;
                ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 4; roundRect(-120, -24, 240, 48, 8); ctx.stroke();
                drawText("❗ HOLD ON ❗", 0, 0, "bold 26px 'Segoe UI', Arial, sans-serif", "#FFD54F", "#000", 5); ctx.restore();
            }
            var el = court.event.lines[court.eventLi];
            var dE = courtDone(el.text);
            drawDialogueBox(el.who, courtTyped(el.text), el.p, el.accent, dE, !dE);
        } else if (court.phase === 4) {
            ctx.fillStyle = "rgba(0,0,0,0.55)"; roundRect(W / 2 - 140, H - 70, 280, 34, 10); ctx.fill();
            var dots = ".".repeat(1 + (Math.floor(court.t * 3) % 3));
            drawText("⚖️ The jury deliberates" + dots, W / 2, H - 53, "bold 15px 'Segoe UI', Arial, sans-serif", "#FFE082", "#000", 3);
        } else if (court.phase === 5) {
            // slam-down verdict stamp, then the judge delivers it in the box
            if (court.banner > 0) {
                var col = court.verdict === "dismissed" ? "#7CFC4F" : court.verdict === "jail" ? "#FF5252" : "#FFB300";
                var sc = 1 + court.banner * 3;
                ctx.save(); ctx.translate(W / 2, H * 0.34); ctx.rotate(-0.08); ctx.scale(sc, sc); ctx.globalAlpha = clamp(1 - court.banner, 0, 1) + 0.3;
                ctx.strokeStyle = col; ctx.lineWidth = 4; roundRect(-120, -26, 240, 52, 8); ctx.stroke();
                drawText(court.verdict === "dismissed" ? "DISMISSED" : "GUILTY", 0, 0, "bold 34px 'Segoe UI', Arial, sans-serif", col, "#000", 5);
                ctx.restore();
            }
            var d5 = courtDone(court.verdictLine.text);
            drawDialogueBox(court.verdictLine.who, courtTyped(court.verdictLine.text), court.verdictLine.p, court.verdictLine.accent, court.t > 0.7 && d5, !d5);
            var vy5 = H - 150;
            if (court.verdict === "fine" && court.applied) {
                drawText("−" + court.paid + " 💰" + (court.couldnt ? "  (rest = community service!)" : ""),
                    W / 2, vy5, "bold 14px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
                vy5 -= 18;
            } else if (court.verdict === "jail") {
                drawText("⛓️ Off to serve your time...", W / 2, vy5, "bold 13px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 3);
                vy5 -= 18;
            }
            // show the bribe she paid (win OR lose — the cash always leaves her hands)
            if (court.bribePaid > 0)
                drawText((court.bribeFlop ? "💸 −" + court.bribePaid + " 💰 bribe — barely landed!" : "🤫 −" + court.bribePaid + " 💰 'donation'"),
                    W / 2, vy5, "bold 13px 'Segoe UI', Arial, sans-serif", court.bribeFlop ? "#FFB300" : "#CE93D8", "#000", 3);
        }
    }

    // ════════════════ FUGITIVE ════════════════
    // Wanted level (1–5★) climbs the longer she stays on the lam.
    function wantedLevel() { return prisonClothes ? clamp(Math.floor(fugitiveT / 11) + 1, 1, 5) : 0; }

    // ── Outstanding accusations (the "wanted" file) ─────────────
    // Things Lulu is accused of but hasn't answered for. Escaping the ER (or any
    // skip) files charges here; cops who spot her give chase until she's finally
    // hauled before a judge and the case is RESOLVED — only a court clears these.
    function isWanted() { return !!(save.wanted && save.wanted.length); }
    function addWanted(charges) {
        if (!save.wanted) save.wanted = [];
        for (var i = 0; i < charges.length; i++) if (save.wanted.indexOf(charges[i]) < 0) save.wanted.push(charges[i]);
        persistSave();
    }
    function clearWanted() { if (save.wanted && save.wanted.length) { save.wanted = []; persistSave(); } }

    function updateFugitive(dt) {
        if (!prisonClothes) { copK9s = []; copMissiles = []; return; }
        fugitiveT += dt;
        // (The DISGUISE that sheds the heat now lives on the SHOULDER and is only
        //  reachable ON FOOT — see footDisguise in the foot world. While driving,
        //  the lay-low fallback below is the only way the heat dies down by itself.)
        var wlNow = wantedLevel();
        // Lay-low FALLBACK: only if she somehow survives a very long time clean does
        // the heat finally die down on its own (the disguise is the real way out).
        if (fugitiveT > 100) { prisonClothes = false; fugitiveSpot = 0; fugDisguise = null; clearLockup(); spawnFloater(player.x, player.y - 50, "😎 Laid low long enough — heat's off.", "#7CFC4F"); return; }
        if (save.lockup && save.lockup.mode === "fugitive" && Math.floor(fugitiveT) !== Math.floor(save.lockup.fugT)) {
            save.lockup.fugT = fugitiveT; persistSave();
        }
        var wl = wantedLevel();
        // WANTED posters keep going up.
        wantedPosterT -= dt;
        if (wantedPosterT <= 0 && typeof billboards !== "undefined") {
            wantedPosterT = rand(7, 12);
            var side = Math.random() < 0.5 ? -1 : 1;
            billboards.push({ x: side > 0 ? W - 50 : 50, y: -120, side: side, msg: "WANTED: LULU", parallax: rand(0.7, 0.9), wanted: true });
        }
        // The heat escalates by STAGE, not just volume: low stars trickle a few
        // cruisers; 3★ brings AGGRESSIVE hunter units that steer at her; 4★ adds a
        // K9 unit; 5★ is the chopper (below). Spawn cadence is gentler than before
        // so it's tense, not a wall of identical cars.
        fugCopT -= dt;
        if (fugCopT <= 0) {
            fugCopT = Math.max(3.4, 8.2 - wl * 0.7);
            if (typeof spawnPatrolCar === "function") {
                var pc = spawnPatrolCar();
                // 3★+ : some cruisers turn into hunters that track her lane.
                if (pc && wl >= 3 && Math.random() < (wl >= 4 ? 0.7 : 0.20)) pc.aggro = true;   // 3★ eases in (was 0.45)
            }
            if (wl >= 4 && typeof spawnK9Unit === "function" && Math.random() < 0.4) spawnK9Unit();
            if (wl >= 4 && typeof spawnRoadCop === "function" && Math.random() < 0.4) spawnRoadCop();
        }
        // 3★+ : cops turn K9 dogs LOOSE into the street to run her down.
        if (wl >= 3) { copK9T -= dt; if (copK9T <= 0) { copK9T = Math.max(2.2, rand(4.5, 7) - wl * 0.4); spawnCopK9(); } }
        // 4★+ : cruisers start FIRING MISSILES at her (dodge by lane-changing).
        if (wl >= 4) { copMslT -= dt; if (copMslT <= 0) { copMslT = Math.max(2.4, rand(4, 6) - (wl - 4) * 0.7); fireCopMissile(); } }
        // A chase (or its pull-over) already owns the moment — don't double up,
        // and let the recognition meter cool while she's actively running.
        // …and a fresh escape buys a breather here too — no instant re-recognition.
        if (copChase || copBust || (typeof postEscapeGrace !== "undefined" && postEscapeGrace > 0)) { fugitiveSpot = Math.max(0, fugitiveSpot - dt); return; }
        var seen = (typeof copInView === "function" && copInView());
        if (!seen) for (var i = 0; i < obstacles.length; i++) {
            var o = obstacles[i];
            if (o.type === "car" && o.behavior === "patrol" && Math.abs(o.y - player.y) < 200) { seen = o; break; }
        }
        // Being recognized no longer means instant cuffs — it kicks off a CHASE she
        // gets a real shot at out-running (floor it to open a gap). She only goes
        // back inside if a cruiser actually runs her down. The chopper at 5★ just
        // makes them lock on faster.
        var bustAt = Math.max(0.7, 1.6 - wl * 0.2);
        if (wl >= 5) {
            fugChopperX = lerp(fugChopperX || player.x, player.x, Math.min(1, 2.2 * dt));
            fugitiveSpot += dt * 1.1;
            if (fugitiveSpot > bustAt) { fugitiveSpot = 0; if (typeof beginCopChase === "function") beginCopChase(player.x, "🚁 SPOTLIGHT — FLOOR IT!"); return; }
            return;
        }
        if (seen) { fugitiveSpot += dt * (1 + wl * 0.35); if (fugitiveSpot > bustAt) { fugitiveSpot = 0; if (typeof beginCopChase === "function") beginCopChase(player.x, "🚨 RECOGNIZED — DRIVE!"); return; } }
        else fugitiveSpot = Math.max(0, fugitiveSpot - dt * 0.8);
    }

    // ── K9 dogs + cop-car missiles (the high-heat hazards) ──
    function spawnCopK9() {
        var sx = LANES[randInt(0, 2)], sy = -36;
        for (var i = 0; i < obstacles.length; i++) { var o = obstacles[i]; if (o.type === "car" && o.behavior === "patrol" && o.y > -30 && o.y < player.y - 10) { sx = o.x; sy = o.y + 28; break; } }
        copK9s.push({ x: sx, y: sy, t: 0, hitW: 18, hitH: 16, bark: rand(0.3, 0.9) });
        if (typeof playDogBark === "function") playDogBark();
        spawnFloater(sx, sy - 16, "🐕 K9 LOOSE!", "#FFCC80");
    }
    function fireCopMissile() {
        var sx = LANES[randInt(0, 2)], sy = -28;
        for (var i = 0; i < obstacles.length; i++) { var o = obstacles[i]; if (o.type === "car" && o.behavior === "patrol" && o.y > -30 && o.y < player.y - 10) { sx = o.x; sy = o.y + 18; break; } }
        copMissiles.push({ x: sx, y: sy, t: 0, hitW: 11, hitH: 22 });
        playTone(300, 0.1, "sawtooth", 0.12, 140);
        spawnFloater(sx, sy - 14, "🚀 INCOMING!", "#FF8A80");
    }
    function updateCopHazards(dt) {
        // K9 dogs bound at her from up the road; she can sidestep them.
        for (var i = copK9s.length - 1; i >= 0; i--) {
            var k = copK9s[i]; k.t += dt; k.bark -= dt;
            if (k.bark <= 0) { k.bark = rand(0.6, 1.2); if (typeof playDogBark === "function" && Math.abs(k.y - player.y) < 240) playDogBark(); }
            k.x = lerp(k.x, player.x, Math.min(1, 0.9 * dt));   // soft homing — a lane-change can shake the dog
            k.y += (gameSpeed * 1.1 + 70) * dt;
            if (k.y > H + 50) { copK9s.splice(i, 1); continue; }
            if (invincibleTimer <= 0 && aabb(player.x, player.y, CAR_W * 0.6, CAR_H * 0.6, k.x, k.y, k.hitW, k.hitH)) {
                spawnFloater(k.x, k.y - 18, "🐕 CHOMP!", "#FF5252"); copK9s.splice(i, 1);
                if (typeof hitPlayer === "function") hitPlayer({ x: k.x, y: k.y });
                if (state !== "playing") return;
            }
        }
        // Cop missiles streak down with WEAK homing (lane-change to dodge).
        for (var m = copMissiles.length - 1; m >= 0; m--) {
            var ms = copMissiles[m]; ms.t += dt;
            ms.x = lerp(ms.x, player.x, Math.min(1, 1.25 * dt));
            ms.y += 320 * dt;
            if (Math.random() < 0.7) particles.push({ x: ms.x + rand(-3, 3), y: ms.y - 12, vx: rand(-18, 18), vy: rand(20, 50), life: 0, maxLife: 0.4, size: rand(2, 4), color: randPick(["#FFB300", "#FF7043", "#9E9E9E"]), gravity: 0 });
            if (ms.y > H + 40) { copMissiles.splice(m, 1); continue; }
            if (invincibleTimer <= 0 && aabb(player.x, player.y, CAR_W * 0.6, CAR_H * 0.6, ms.x, ms.y, ms.hitW, ms.hitH)) {
                spawnCrashBurst(ms.x, ms.y, true); if (typeof playExplosion === "function") playExplosion();
                copMissiles.splice(m, 1);
                if (typeof hitPlayer === "function") hitPlayer({ x: ms.x, y: ms.y });
                if (state !== "playing") return;
            }
        }
    }
    // A proper K9 (German-Shepherd) bounding head-first at her — drawn in the same
    // clean outline-and-fill style as the game's other animals (duck/raccoon), but
    // snarling: tan body with a black saddle, a navy police vest + gold badge,
    // pointed ears, bared teeth and fierce yellow eyes under angry brows.
    function drawCopK9(x, y, t) {
        var run = Math.sin(t * 16), run2 = Math.cos(t * 16);
        ctx.save(); ctx.translate(x, y);
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.beginPath(); ctx.ellipse(0, 11, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
        // tail trailing up/back, wagging
        ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(run * 5, -15, run * 9, -19); ctx.stroke();
        // legs (galloping — front/back animate out of phase)
        ctx.strokeStyle = "#4E342E"; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-9 - run * 2, 4); ctx.moveTo(6, -2); ctx.lineTo(9 + run2 * 2, 4);
        ctx.moveTo(-5, 5); ctx.lineTo(-7 - run2 * 3, 13); ctx.moveTo(5, 5); ctx.lineTo(7 + run * 3, 13); ctx.stroke();
        ctx.lineCap = "butt";
        // body — tan underbody + black shepherd saddle
        ctx.fillStyle = "#A1887F"; roundRect(-8, -8, 16, 16, 7); ctx.fill();
        ctx.fillStyle = "#3E2723"; roundRect(-8, -8, 16, 9, 7); ctx.fill();
        // navy police vest band + gold badge
        ctx.fillStyle = "#1A237E"; ctx.fillRect(-8, -3, 16, 4);
        ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(0, -1, 2, 0, Math.PI * 2); ctx.fill();
        // head toward her (down)
        ctx.fillStyle = "#6D4C41"; ctx.beginPath(); ctx.arc(0, 9, 6.5, 0, Math.PI * 2); ctx.fill();
        // pointed ears
        ctx.fillStyle = "#4E342E";
        ctx.beginPath(); ctx.moveTo(-6, 5); ctx.lineTo(-7, -1); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, 5); ctx.lineTo(7, -1); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
        // muzzle + nose
        ctx.fillStyle = "#4E342E"; roundRect(-3, 11, 6, 5, 2); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, 16, 1.8, 0, Math.PI * 2); ctx.fill();
        // bared teeth (snarl)
        ctx.fillStyle = "#FFF";
        ctx.beginPath(); ctx.moveTo(-2.5, 13.4); ctx.lineTo(-1.5, 15.4); ctx.lineTo(-0.5, 13.4); ctx.closePath();
        ctx.moveTo(2.5, 13.4); ctx.lineTo(1.5, 15.4); ctx.lineTo(0.5, 13.4); ctx.closePath(); ctx.fill();
        // fierce yellow eyes + pupils + angry brows
        ctx.fillStyle = "#FFEB3B"; ctx.beginPath(); ctx.arc(-2.6, 8.5, 1.4, 0, Math.PI * 2); ctx.arc(2.6, 8.5, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, 8.9, 0.7, 0, Math.PI * 2); ctx.arc(2.6, 8.9, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-4.6, 6.3); ctx.lineTo(-1.2, 7.6); ctx.moveTo(4.6, 6.3); ctx.lineTo(1.2, 7.6); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
    }
    // The cop missile — same clean rocket silhouette as the player's own missile,
    // but liveried as police ordnance and meaner: dark navy body, a red/blue stripe,
    // swept tail fins, and a dark-red nose with a pulsing red targeting eye. It flies
    // DOWNWARD at her, so the nose points down and the exhaust streams up behind it.
    function drawCopMissile(x, y, t) {
        var flicker = 1 + Math.sin(t * 30) * 0.35;
        ctx.save(); ctx.translate(x, y);
        // exhaust trail (behind = up)
        ctx.fillStyle = "rgba(255,120,40,0.55)"; ctx.beginPath(); ctx.ellipse(0, -16, 5, 11 * flicker, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,200,40,0.8)"; ctx.beginPath(); ctx.ellipse(0, -13, 3.2, 7 * flicker, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.ellipse(0, -11, 1.6, 4 * flicker, 0, 0, Math.PI * 2); ctx.fill();
        // swept tail fins
        ctx.fillStyle = "#263238";
        ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-8, -12); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(8, -12); ctx.lineTo(4, -4); ctx.closePath(); ctx.fill();
        // body — navy shell + charcoal inset
        ctx.fillStyle = "#1A237E"; roundRect(-4.5, -11, 9, 22, 3); ctx.fill();
        ctx.fillStyle = "#37474F"; roundRect(-3.5, -10, 7, 20, 2); ctx.fill();
        // red/blue police stripe
        ctx.fillStyle = "#D32F2F"; ctx.fillRect(-4.5, -4, 9, 2.4);
        ctx.fillStyle = "#1565C0"; ctx.fillRect(-4.5, -1.4, 9, 2.4);
        // menacing dark-red nose cone (down)
        ctx.fillStyle = "#B71C1C"; ctx.beginPath(); ctx.moveTo(-4.5, 9); ctx.lineTo(0, 16); ctx.lineTo(4.5, 9); ctx.closePath(); ctx.fill();
        // pulsing red targeting eye
        ctx.fillStyle = "rgba(255,40,40," + (0.55 + 0.45 * Math.abs(Math.sin(t * 18))) + ")";
        ctx.beginPath(); ctx.arc(0, 8, 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function drawCopHazards() {
        for (var i = 0; i < copK9s.length; i++) drawCopK9(copK9s[i].x, copK9s[i].y, copK9s[i].t);
        for (var m = 0; m < copMissiles.length; m++) drawCopMissile(copMissiles[m].x, copMissiles[m].y, copMissiles[m].t);
    }

    // The police chopper + tracking spotlight (drawn over the road at 5★).
    // A proper menacing top-down gunship-ish silhouette: fuselage with a tinted
    // cockpit, tail boom + spinning tail rotor, landing skids, red/blue belly
    // strobes, a sweeping searchlight, and a motion-blurred main rotor disc.
    function drawFugChopper() {
        if (!prisonClothes || wantedLevel() < 5) return;
        var cx = fugChopperX || player.x, cy = H * 0.19 + Math.sin(gameTime * 2) * 5;
        var px = player.x, py = player.y;
        // ── sweeping searchlight cone + ground pool ──
        var sway = Math.sin(gameTime * 1.3) * 12, tx = px + sway;
        var sg = ctx.createLinearGradient(cx, cy, tx, py);
        sg.addColorStop(0, "rgba(255,250,200,0.52)"); sg.addColorStop(1, "rgba(255,250,200,0.04)");
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.moveTo(cx - 8, cy + 16); ctx.lineTo(tx - 54, py + 28); ctx.lineTo(tx + 54, py + 28); ctx.lineTo(cx + 8, cy + 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,250,200,0.16)"; ctx.beginPath(); ctx.ellipse(tx, py, 56, 22, 0, 0, Math.PI * 2); ctx.fill();
        // ── soft shadow under the aircraft ──
        ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(cx, cy + 44, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(cx, cy);
        // tail boom (sweeps up/back) + vertical fin + spinning tail rotor
        ctx.fillStyle = "#252C32"; roundRect(-4, -54, 8, 42, 4); ctx.fill();
        ctx.fillStyle = "#171C20"; ctx.beginPath(); ctx.moveTo(-4, -52); ctx.lineTo(-12, -58); ctx.lineTo(-4, -44); ctx.closePath(); ctx.fill();
        var trot = gameTime * 46;
        ctx.strokeStyle = "rgba(205,210,215,0.6)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-7 - Math.cos(trot) * 8, -52); ctx.lineTo(-7 + Math.cos(trot) * 8, -52); ctx.stroke();
        // landing skids
        ctx.strokeStyle = "#37424A"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-17, -2); ctx.lineTo(-17, 22); ctx.moveTo(17, -2); ctx.lineTo(17, 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(-17, 6); ctx.moveTo(9, 6); ctx.lineTo(17, 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9, 16); ctx.lineTo(-17, 16); ctx.moveTo(9, 16); ctx.lineTo(17, 16); ctx.stroke();
        // fuselage — sleek, nose toward the road (down)
        var bodyG = ctx.createLinearGradient(-15, 0, 15, 0);
        bodyG.addColorStop(0, "#0E141A"); bodyG.addColorStop(0.5, "#39454E"); bodyG.addColorStop(1, "#0E141A");
        ctx.fillStyle = bodyG; ctx.beginPath();
        ctx.moveTo(0, 32);
        ctx.quadraticCurveTo(-15, 18, -13, -6);
        ctx.quadraticCurveTo(-12, -16, 0, -16);
        ctx.quadraticCurveTo(12, -16, 13, -6);
        ctx.quadraticCurveTo(15, 18, 0, 32);
        ctx.closePath(); ctx.fill();
        // tinted cockpit glass at the nose
        ctx.fillStyle = "#5E94C4"; ctx.beginPath();
        ctx.moveTo(0, 28); ctx.quadraticCurveTo(-9, 14, -7, 2); ctx.quadraticCurveTo(0, -1, 7, 2); ctx.quadraticCurveTo(9, 14, 0, 28); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.28)"; roundRect(-5, 5, 3.5, 12, 2); ctx.fill();
        // white POLICE band across the body
        ctx.fillStyle = "#F4F6F8"; roundRect(-13, -11, 26, 8, 2); ctx.fill();
        drawText("POLICE", 0, -7, "bold 6px Arial", "#0D1B5E", null, 0);
        // red/blue belly strobes with halos
        var sir = Math.sin(gameTime * 11) > 0;
        ctx.fillStyle = sir ? "rgba(255,23,68,0.22)" : "rgba(41,121,255,0.22)";
        ctx.beginPath(); ctx.arc(sir ? -11 : 11, 18, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sir ? "#FF1744" : "#7A1320"; ctx.beginPath(); ctx.arc(-11, 18, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sir ? "#0D2A6B" : "#2979FF"; ctx.beginPath(); ctx.arc(11, 18, 2.6, 0, Math.PI * 2); ctx.fill();
        // MAIN ROTOR — translucent blur disc + two blades whirling over the hub
        var mrot = gameTime * 32, rw = 46;
        ctx.fillStyle = "rgba(185,195,205,0.09)"; ctx.beginPath(); ctx.arc(0, 4, rw, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(228,233,238,0.5)"; ctx.lineWidth = 3;
        for (var bld = 0; bld < 2; bld++) {
            var a = mrot + bld * Math.PI / 2;
            ctx.beginPath(); ctx.moveTo(-Math.cos(a) * rw, 4 - Math.sin(a) * rw * 0.5); ctx.lineTo(Math.cos(a) * rw, 4 + Math.sin(a) * rw * 0.5); ctx.stroke();
        }
        ctx.fillStyle = "#0B1014"; ctx.beginPath(); ctx.arc(0, 4, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#37424A"; ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.lineCap = "butt";
        var lp = Math.sin(gameTime * 8) > 0;
        drawText("🚁 POLICE AIR UNIT", cx, cy - 60, "bold 9px 'Segoe UI', Arial, sans-serif", lp ? "#FF5252" : "#FFEB3B", "#000", 3);
    }

    // The roadside DISGUISE pickup — a glam clothes rack glowing on the shoulder.
    function drawFugDisguise() {
        if (!fugDisguise || fugDisguise.got) return;
        var d = fugDisguise, gx = d.x, gy = d.y, bob = Math.sin(d.t * 4) * 2;
        var gl = 0.30 + 0.28 * Math.abs(Math.sin(d.t * 5));
        ctx.fillStyle = "rgba(206,147,216," + gl + ")"; ctx.beginPath(); ctx.arc(gx, gy, 28, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(gx, gy + bob);
        // rack bar + stand
        ctx.strokeStyle = "#B0BEC5"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-17, -15); ctx.lineTo(17, -15); ctx.moveTo(0, -15); ctx.lineTo(0, 17); ctx.stroke();
        ctx.fillStyle = "#78848C"; ctx.beginPath(); ctx.moveTo(-9, 17); ctx.lineTo(9, 17); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
        // glam dress on a hanger
        ctx.fillStyle = "#EC407A"; ctx.beginPath(); ctx.moveTo(-10, -11); ctx.lineTo(10, -11); ctx.lineTo(13, 9); ctx.lineTo(-13, 9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.moveTo(-10, -11); ctx.lineTo(-3, -11); ctx.lineTo(-7, 9); ctx.lineTo(-13, 9); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -13, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();  // hanger hook
        // wig + shades perched on top
        ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(0, -19, 6.5, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#212121"; roundRect(-6, -20, 12, 4, 2); ctx.fill();
        ctx.restore();
        var pulse2 = Math.sin(d.t * 6) > 0;
        drawText("🥸 GRAB — new look!", gx, gy - 32, "bold 10px 'Segoe UI', Arial", pulse2 ? "#F3E5F5" : "#E1BEE7", "#000", 3);
    }

    function drawFugitiveHUD() {
        if (!prisonClothes) return;
        drawFugChopper();
        var wl = wantedLevel();
        var pulse = Math.sin(gameTime * 8) > 0;
        drawText("🔒 FUGITIVE", W / 2, SAFE_TOP + 56, "bold 14px 'Segoe UI', Arial, sans-serif", pulse ? "#FF5252" : "#FFEB3B", "#000", 3);
        // wanted stars
        var stars = "";
        for (var s = 0; s < 5; s++) stars += (s < wl ? "★" : "☆");
        drawText(stars, W / 2, SAFE_TOP + 74, "bold 15px Arial", wl >= 4 ? "#FF5252" : "#FFD54F", "#000", 3);
        if (fugitiveSpot > 0.05) {
            var bustAt = Math.max(0.7, 1.6 - wl * 0.2);
            var w = 120, x = W / 2 - w / 2, y = SAFE_TOP + 84;
            ctx.fillStyle = "rgba(0,0,0,0.4)"; roundRect(x, y, w, 6, 3); ctx.fill();
            ctx.fillStyle = "#FF5252"; roundRect(x, y, w * clamp(fugitiveSpot / bustAt, 0, 1), 6, 3); ctx.fill();
            drawText("👀 SPOTTED!", W / 2, y + 18, "bold 10px 'Segoe UI', Arial, sans-serif", "#FF8A80", "#000", 2);
        }
    }

    // ════════════════ RPG dialogue box + portraits ════════════════
    function wrapLines(text, maxW, font) {
        ctx.font = font;
        var words = text.split(" "), line = "", out = [];
        for (var i = 0; i < words.length; i++) {
            var test = line ? line + " " + words[i] : words[i];
            if (ctx.measureText(test).width > maxW && line) { out.push(line); line = words[i]; } else line = test;
        }
        if (line) out.push(line);
        return out;
    }
    function wrapCentered(text, cx, cy, maxW, lh, col) {
        var lines = wrapLines(text, maxW, "13px 'Segoe UI', Arial, sans-serif");
        for (var l = 0; l < lines.length; l++) drawText(lines[l], cx, cy + l * lh, "13px 'Segoe UI', Arial, sans-serif", col || "#FFF", "#000", 2);
    }

    function drawDialogueBox(name, text, ptype, accent, advance, talking) {
        var bh = 116, by = H - bh - 12, bx = 12, bw = W - 24;
        ctx.fillStyle = "rgba(0,0,0,0.35)"; roundRect(bx + 3, by + 4, bw, bh, 14); ctx.fill();
        var g = ctx.createLinearGradient(0, by, 0, by + bh);
        g.addColorStop(0, "#2A2336"); g.addColorStop(1, "#171121");
        ctx.fillStyle = g; roundRect(bx, by, bw, bh, 14); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 3; roundRect(bx, by, bw, bh, 14); ctx.stroke();
        // portrait
        var pf = 84, px = bx + 12, py = by + bh / 2 - pf / 2;
        ctx.save(); roundRect(px, py, pf, pf, 10); ctx.clip();
        var pg = ctx.createLinearGradient(0, py, 0, py + pf); pg.addColorStop(0, "#473A5E"); pg.addColorStop(1, "#2A2238");
        ctx.fillStyle = pg; ctx.fillRect(px, py, pf, pf);
        drawPortrait(ptype, px + pf / 2, py + pf / 2 + 8, pf - 8, talking);
        ctx.restore();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; roundRect(px, py, pf, pf, 10); ctx.stroke();
        // nameplate tab
        ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
        var nw = ctx.measureText(name).width + 24;
        ctx.fillStyle = accent; roundRect(px + pf + 10, by - 13, nw, 24, 6); ctx.fill();
        drawText(name, px + pf + 10 + nw / 2, by - 1, "bold 13px 'Segoe UI', Arial, sans-serif", "#1A1230", null, 0);
        // wrapped body text (left-aligned)
        var tx = px + pf + 22, tw = bx + bw - 16 - tx;
        var lines = wrapLines(text, tw, "15px 'Segoe UI', Arial, sans-serif");
        for (var i = 0; i < lines.length; i++)
            drawText(lines[i], tx, by + 30 + i * 21, "15px 'Segoe UI', Arial, sans-serif", "#F3E9FF", "#000", 2, "left");
        // typewriter caret at the end of the last line while still revealing
        if (talking && lines.length) {
            ctx.font = "15px 'Segoe UI', Arial, sans-serif";
            var cw = ctx.measureText(lines[lines.length - 1]).width;
            if (Math.sin(gameTime * 12) > 0)
                drawText("▌", tx + cw + 3, by + 30 + (lines.length - 1) * 21, "15px 'Segoe UI', Arial, sans-serif", accent, null, 0, "left");
        }
        if (advance) {
            var bl = 0.4 + 0.6 * Math.abs(Math.sin(gameTime * 5));
            ctx.globalAlpha = bl;
            drawText("▾ tap", bx + bw - 36, by + bh - 14, "bold 12px 'Segoe UI', Arial, sans-serif", accent, "#000", 2);
            ctx.globalAlpha = 1;
        }
    }

    // Head-and-shoulders portraits for the dialogue box.
    function drawPortrait(type, cx, cy, s, talking) {
        var hr = s * 0.26;
        // shoulders/clothes
        var clothes = type === "judge" ? "#1A1A1A" : type === "prosecutor" ? "#26323A"
                    : type === "lawyer" ? "#37474F" : type === "doctor" ? "#ECEFF1"
                    : type === "tammy" ? "#26A69A" : type === "avigail" ? "#7E57C2" : type === "bubbe" ? "#8D6E63"
                    : type === "hillel" ? "#BBDEFB" : type === "raphael" ? "#6A1B9A" : type === "abba" ? "#4E342E"
                    : type === "rabbi" ? "#1A1A1A" : type === "clown" ? "#E53935" : type === "kid" ? "#FFB74D" : type === "oldman" ? "#6D4C41"
                    : type === "cellmate" ? "#ECEFF1" : type === "cop" ? "#1A237E" : "#37474F";
        ctx.fillStyle = clothes; roundRect(cx - s * 0.36, cy + hr * 0.55, s * 0.72, s * 0.55, 10); ctx.fill();
        if (type === "lulu" || type === "cellmate") {   // prison stripes on the shoulders
            ctx.fillStyle = "#37474F";
            for (var st = 0; st < 3; st++) ctx.fillRect(cx - s * 0.36, cy + hr * 0.7 + st * 7, s * 0.72, 3);
        }
        // neck + head
        ctx.fillStyle = C.skin; ctx.fillRect(cx - 5, cy + hr * 0.2, 10, hr * 0.7);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx, cy, hr + 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.fill();
        // eyes (common)
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.05, hr * 0.18, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.05, hr * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.10, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.10, 0, Math.PI * 2); ctx.fill();

        if (type === "judge") {
            ctx.fillStyle = "#ECEFF1";              // big powdered wig
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.3, hr * 1.15, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx - hr, cy + hr * 0.2, hr * 0.42, hr * 0.95, 0, 0, Math.PI * 2); ctx.ellipse(cx + hr, cy + hr * 0.2, hr * 0.42, hr * 0.95, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1.5;   // glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(cx - 3, cy + hr * 0.55); ctx.lineTo(cx, cy + hr); ctx.lineTo(cx + 3, cy + hr * 0.55); ctx.fill(); // collar bands
        } else if (type === "prosecutor") {
            ctx.fillStyle = "#212121";              // slicked hair
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 1.02, Math.PI, 0); ctx.fill();
            ctx.fillRect(cx - hr, cy - hr * 0.25, hr * 2, hr * 0.3);
            ctx.fillStyle = "#3E2723"; ctx.fillRect(cx - hr * 0.5, cy + hr * 0.45, hr, 2.5);  // thin mustache
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.6, 1); ctx.fill();
            ctx.fillStyle = "#C62828"; ctx.beginPath(); ctx.moveTo(cx - 2.5, cy + hr * 0.6); ctx.lineTo(cx, cy + hr * 1.1); ctx.lineTo(cx + 2.5, cy + hr * 0.6); ctx.fill(); // tie
        } else if (type === "lawyer") {
            ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 1.0, Math.PI, 0); ctx.fill(); // neat hair
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.6, 1); ctx.fill();
            ctx.fillStyle = "#26A69A"; ctx.beginPath(); ctx.moveTo(cx - 2.5, cy + hr * 0.6); ctx.lineTo(cx, cy + hr * 1.1); ctx.lineTo(cx + 2.5, cy + hr * 0.6); ctx.fill(); // teal tie
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 1;   // smart glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.22, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.22, 0, Math.PI * 2); ctx.stroke();
        } else if (type === "doctor") {
            ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 0.98, Math.PI, 0); ctx.fill(); // hair
            ctx.strokeStyle = "#455A64"; ctx.lineWidth = 1.6;   // stethoscope
            ctx.beginPath(); ctx.moveTo(cx - hr * 0.3, cy + hr * 0.5); ctx.quadraticCurveTo(cx, cy + hr * 1.1, cx + hr * 0.3, cy + hr * 0.5); ctx.stroke();
            ctx.fillStyle = "#90A4AE"; ctx.beginPath(); ctx.arc(cx + hr * 0.32, cy + hr * 0.55, hr * 0.12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 1;     // glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.22, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.22, 0, Math.PI * 2); ctx.stroke();
        } else if (type === "tammy") {
            // Lulu's sister: Bruck-family hair + rosy cheeks, topped with a nurse cap
            ctx.fillStyle = (typeof save !== "undefined" && save.luluHair) || "#8B5A2B";
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 1.05, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx - hr * 0.92, cy + hr * 0.22, hr * 0.36, hr * 0.88, -0.2, 0, Math.PI * 2); ctx.ellipse(cx + hr * 0.92, cy + hr * 0.22, hr * 0.36, hr * 0.88, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(cx - hr * 0.72, cy - hr * 0.92); ctx.lineTo(cx + hr * 0.72, cy - hr * 0.92); ctx.lineTo(cx + hr * 0.5, cy - hr * 1.42); ctx.lineTo(cx - hr * 0.5, cy - hr * 1.42); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#E53935"; ctx.fillRect(cx - hr * 0.1, cy - hr * 1.38, hr * 0.2, hr * 0.42); ctx.fillRect(cx - hr * 0.24, cy - hr * 1.22, hr * 0.48, hr * 0.16);
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(cx - hr * 0.5, cy + hr * 0.25, hr * 0.18, 0, Math.PI * 2); ctx.arc(cx + hr * 0.5, cy + hr * 0.25, hr * 0.18, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.55, 1); ctx.fill();   // white V-neck
        } else if (type === "avigail") {
            // Lulu's rival — sleek dark hair, smug arched brows, a hoop earring
            ctx.fillStyle = "#241712";
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.28, hr * 1.08, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx - hr * 0.95, cy + hr * 0.35, hr * 0.34, hr * 1.0, -0.15, 0, Math.PI * 2); ctx.ellipse(cx + hr * 0.95, cy + hr * 0.35, hr * 0.34, hr * 1.0, 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = shadeColor("#241712", 26); ctx.fillRect(cx - hr * 0.6, cy - hr * 0.5, hr * 1.2, hr * 0.16);   // side-part sheen
            ctx.strokeStyle = "#241712"; ctx.lineWidth = 1.4;   // arched smug brows
            ctx.beginPath(); ctx.moveTo(cx - hr * 0.5, cy - hr * 0.34); ctx.quadraticCurveTo(cx - hr * 0.34, cy - hr * 0.48, cx - hr * 0.18, cy - hr * 0.36);
            ctx.moveTo(cx + hr * 0.18, cy - hr * 0.36); ctx.quadraticCurveTo(cx + hr * 0.34, cy - hr * 0.48, cx + hr * 0.5, cy - hr * 0.34); ctx.stroke();
            ctx.strokeStyle = "#FFD54F"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx + hr * 0.86, cy + hr * 0.5, hr * 0.16, 0, Math.PI * 2); ctx.stroke();  // hoop earring
        } else if (type === "bubbe") {
            // sweet old lady — gray hair under a headscarf, round glasses
            ctx.fillStyle = "#CFD8DC"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.2, hr * 0.95, Math.PI, 0); ctx.fill();    // gray hair peek
            ctx.fillStyle = "#A1887F"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.32, hr * 1.12, Math.PI * 1.05, -0.05); ctx.fill();   // headscarf over the top
            ctx.fillStyle = "#8D6E63"; ctx.beginPath(); ctx.moveTo(cx + hr * 0.9, cy - hr * 0.5); ctx.lineTo(cx + hr * 1.15, cy + hr * 0.3); ctx.lineTo(cx + hr * 0.7, cy + hr * 0.1); ctx.closePath(); ctx.fill();  // scarf knot
            ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1.4;   // round granny glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.moveTo(cx - hr * 0.08, cy - hr * 0.02); ctx.lineTo(cx + hr * 0.08, cy - hr * 0.02); ctx.stroke();
            ctx.fillStyle = "rgba(255,140,140,0.45)"; ctx.beginPath(); ctx.arc(cx - hr * 0.55, cy + hr * 0.28, hr * 0.2, 0, Math.PI * 2); ctx.arc(cx + hr * 0.55, cy + hr * 0.28, hr * 0.2, 0, Math.PI * 2); ctx.fill();
        } else if (type === "hillel") {
            // thinning brown hair + black yarmulke, glasses, worried brows, crooked tie
            ctx.fillStyle = "#4E342E";
            ctx.beginPath(); ctx.arc(cx - hr * 0.5, cy - hr * 0.3, hr * 0.46, Math.PI, 0); ctx.arc(cx + hr * 0.5, cy - hr * 0.3, hr * 0.46, Math.PI, 0); ctx.fill();
            ctx.fillRect(cx - hr * 1.0, cy - hr * 0.3, hr * 0.28, hr * 0.6); ctx.fillRect(cx + hr * 0.72, cy - hr * 0.3, hr * 0.28, hr * 0.6);
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.66, hr * 0.44, Math.PI, 0); ctx.fill();   // yarmulke
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 1.3;   // glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.26, 0, Math.PI * 2); ctx.moveTo(cx - hr * 0.08, cy - hr * 0.02); ctx.lineTo(cx + hr * 0.08, cy - hr * 0.02); ctx.stroke();
            ctx.strokeStyle = "#4E342E"; ctx.lineWidth = 1.3;   // worried brows
            ctx.beginPath(); ctx.moveTo(cx - hr * 0.5, cy - hr * 0.42); ctx.lineTo(cx - hr * 0.16, cy - hr * 0.3); ctx.moveTo(cx + hr * 0.16, cy - hr * 0.3); ctx.lineTo(cx + hr * 0.5, cy - hr * 0.42); ctx.stroke();
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.55, 1); ctx.fill();   // collar
            ctx.save(); ctx.translate(cx, cy + hr * 0.6); ctx.rotate(0.2);
            ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.moveTo(-2.8, 0); ctx.lineTo(2.8, 0); ctx.lineTo(2, hr * 0.62); ctx.lineTo(-2, hr * 0.62); ctx.closePath(); ctx.fill(); ctx.restore();
            ctx.fillStyle = "rgba(130,200,240,0.9)"; ctx.beginPath(); ctx.arc(cx + hr * 0.62, cy + hr * 0.12, hr * 0.12, 0, Math.PI * 2); ctx.fill();   // sweat
        } else if (type === "raphael") {
            // balding gray sides + shiny pate, heavy brows, thick mustache, gold chain
            ctx.fillStyle = "#455A64";
            ctx.beginPath(); ctx.arc(cx - hr * 0.66, cy - hr * 0.18, hr * 0.5, Math.PI * 0.6, Math.PI * 1.9); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + hr * 0.66, cy - hr * 0.18, hr * 0.5, Math.PI * 1.1, Math.PI * 0.4); ctx.fill();
            ctx.fillRect(cx - hr * 1.02, cy - hr * 0.22, hr * 0.28, hr * 0.7); ctx.fillRect(cx + hr * 0.74, cy - hr * 0.22, hr * 0.28, hr * 0.7);
            ctx.fillStyle = "rgba(255,255,255,0.13)"; ctx.beginPath(); ctx.ellipse(cx - hr * 0.12, cy - hr * 0.5, hr * 0.32, hr * 0.15, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 2;   // heavy brows
            ctx.beginPath(); ctx.moveTo(cx - hr * 0.55, cy - hr * 0.3); ctx.lineTo(cx - hr * 0.12, cy - hr * 0.22); ctx.moveTo(cx + hr * 0.12, cy - hr * 0.22); ctx.lineTo(cx + hr * 0.55, cy - hr * 0.3); ctx.stroke();
            ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.ellipse(cx, cy + hr * 0.34, hr * 0.5, hr * 0.18, 0, 0, Math.PI * 2); ctx.fill();   // mustache
            ctx.fillStyle = "#4A148C"; ctx.beginPath(); ctx.moveTo(cx, cy + hr * 0.5); ctx.lineTo(cx - hr * 0.42, cy + hr * 1.1); ctx.lineTo(cx + hr * 0.42, cy + hr * 1.1); ctx.closePath(); ctx.fill();   // open collar
            ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy + hr * 0.55, hr * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
            ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(cx, cy + hr * 0.95, hr * 0.12, 0, Math.PI * 2); ctx.fill();
        } else if (type === "abba") {
            // Lulu's dad — graying brown hair, a knit kippah, a full groomed beard,
            // glasses, and a tie (he's lawyering today). Warm and proud.
            ctx.fillStyle = "#6D4C41"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.28, hr * 1.04, Math.PI, 0); ctx.fill();   // hair
            ctx.fillStyle = "#9E9E9E"; ctx.fillRect(cx - hr * 0.92, cy - hr * 0.42, hr * 0.26, hr * 0.5); ctx.fillRect(cx + hr * 0.66, cy - hr * 0.42, hr * 0.26, hr * 0.5);   // gray temples
            // knit kippah on the crown
            ctx.fillStyle = "#1565C0"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.6, hr * 0.5, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = "#0D47A1"; ctx.lineWidth = 0.8;
            for (var kk = -2; kk <= 2; kk++) { ctx.beginPath(); ctx.moveTo(cx + kk * hr * 0.18, cy - hr * 0.6); ctx.lineTo(cx + kk * hr * 0.18, cy - hr * 1.02); ctx.stroke(); }
            // full beard framing the lower face (below the eyes) + sideburns
            ctx.fillStyle = "#6D4C41";
            ctx.beginPath(); ctx.arc(cx, cy + hr * 0.12, hr * 0.95, 0.08 * Math.PI, 0.92 * Math.PI); ctx.closePath(); ctx.fill();
            ctx.fillRect(cx - hr * 0.92, cy - hr * 0.18, hr * 0.2, hr * 0.6); ctx.fillRect(cx + hr * 0.72, cy - hr * 0.18, hr * 0.2, hr * 0.6);
            // glasses
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.24, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.24, 0, Math.PI * 2); ctx.moveTo(cx - hr * 0.1, cy - hr * 0.02); ctx.lineTo(cx + hr * 0.1, cy - hr * 0.02); ctx.stroke();
            // warm brows + a tie
            ctx.strokeStyle = "#5D4037"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(cx - hr * 0.5, cy - hr * 0.32); ctx.lineTo(cx - hr * 0.16, cy - hr * 0.36); ctx.moveTo(cx + hr * 0.16, cy - hr * 0.36); ctx.lineTo(cx + hr * 0.5, cy - hr * 0.32); ctx.stroke();
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.5, 1); ctx.fill();
            ctx.fillStyle = "#B71C1C"; ctx.beginPath(); ctx.moveTo(cx - 2.5, cy + hr * 0.6); ctx.lineTo(cx, cy + hr * 1.1); ctx.lineTo(cx + 2.5, cy + hr * 0.6); ctx.fill();
        } else if (type === "rabbi") {
            // black hat + full gray beard + glasses
            ctx.fillStyle = "#9E9E9E"; ctx.beginPath(); ctx.arc(cx, cy + hr * 0.12, hr * 0.95, 0.06 * Math.PI, 0.94 * Math.PI); ctx.closePath(); ctx.fill();   // beard
            ctx.fillRect(cx - hr * 0.92, cy - hr * 0.15, hr * 0.2, hr * 0.6); ctx.fillRect(cx + hr * 0.72, cy - hr * 0.15, hr * 0.2, hr * 0.6);
            ctx.fillStyle = "#1A1A1A"; ctx.fillRect(cx - hr * 1.15, cy - hr * 0.66, hr * 2.3, hr * 0.22);   // hat brim
            ctx.fillStyle = "#0A0A0A"; roundRect(cx - hr * 0.78, cy - hr * 1.28, hr * 1.56, hr * 0.7, 3); ctx.fill();   // hat crown
            ctx.strokeStyle = "#263238"; ctx.lineWidth = 1.3;   // glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.04, hr * 0.24, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.04, hr * 0.24, 0, Math.PI * 2); ctx.moveTo(cx - hr * 0.1, cy - hr * 0.04); ctx.lineTo(cx + hr * 0.1, cy - hr * 0.04); ctx.stroke();
            ctx.fillStyle = "#FFF"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.55, 1); ctx.fill();   // white shirt
        } else if (type === "clown") {
            // rainbow wig, white face, red nose, big grin
            ctx.fillStyle = "#FFF6F2"; ctx.beginPath(); ctx.arc(cx, cy, hr * 0.96, 0, Math.PI * 2); ctx.fill();   // white face over skin
            var wc = ["#E53935", "#FB8C00", "#FDD835", "#43A047", "#1E88E5"];
            for (var cw = 0; cw < 5; cw++) { ctx.fillStyle = wc[cw]; ctx.beginPath(); ctx.arc(cx - hr * 0.8 + cw * hr * 0.4, cy - hr * 0.35, hr * 0.42, Math.PI, 0); ctx.fill(); }   // rainbow tufts
            ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.05, hr * 0.13, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.05, hr * 0.13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#1565C0"; ctx.beginPath(); ctx.moveTo(cx - hr * 0.5, cy - hr * 0.3); ctx.lineTo(cx - hr * 0.18, cy - hr * 0.05); ctx.lineTo(cx - hr * 0.5, cy + hr * 0.05); ctx.fill();   // diamond eye paint
            ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(cx, cy + hr * 0.18, hr * 0.2, 0, Math.PI * 2); ctx.fill();   // red nose
            ctx.fillStyle = "#FFEB3B"; roundRect(cx - hr * 0.5, cy + hr * 0.55, hr, hr * 0.5, 6); ctx.fill();   // polka collar
            ctx.fillStyle = "#E53935"; ctx.beginPath(); ctx.arc(cx - hr * 0.2, cy + hr * 0.75, hr * 0.1, 0, Math.PI * 2); ctx.arc(cx + hr * 0.2, cy + hr * 0.75, hr * 0.1, 0, Math.PI * 2); ctx.fill();
        } else if (type === "kid") {
            // little kid: short hair / kippah, big eyes already drawn, rosy cheeks
            ctx.fillStyle = "#5D4037"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.3, hr * 1.0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#3949AB"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.62, hr * 0.4, Math.PI, 0); ctx.fill();   // little kippah
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(cx - hr * 0.5, cy + hr * 0.22, hr * 0.16, 0, Math.PI * 2); ctx.arc(cx + hr * 0.5, cy + hr * 0.22, hr * 0.16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#66BB6A"; roundRect(cx - 4, cy + hr * 0.55, 8, hr * 0.5, 1); ctx.fill();   // striped tee
        } else if (type === "oldman") {
            // bald combover, bushy gray brows + mustache, big glasses, cardigan
            ctx.fillStyle = "#CFD8DC"; ctx.beginPath(); ctx.arc(cx - hr * 0.66, cy - hr * 0.18, hr * 0.42, Math.PI * 0.6, Math.PI * 1.9); ctx.fill(); ctx.beginPath(); ctx.arc(cx + hr * 0.66, cy - hr * 0.18, hr * 0.42, Math.PI * 1.1, Math.PI * 0.4); ctx.fill();
            ctx.fillStyle = "#E0E0E0"; ctx.fillRect(cx - hr * 0.5, cy - hr * 0.5, hr, hr * 0.16);   // thin combover strand
            ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1.4;   // big glasses
            ctx.beginPath(); ctx.arc(cx - hr * 0.34, cy - hr * 0.02, hr * 0.28, 0, Math.PI * 2); ctx.arc(cx + hr * 0.34, cy - hr * 0.02, hr * 0.28, 0, Math.PI * 2); ctx.moveTo(cx - hr * 0.06, cy - hr * 0.02); ctx.lineTo(cx + hr * 0.06, cy - hr * 0.02); ctx.stroke();
            ctx.strokeStyle = "#CFD8DC"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - hr * 0.55, cy - hr * 0.34); ctx.lineTo(cx - hr * 0.12, cy - hr * 0.3); ctx.moveTo(cx + hr * 0.12, cy - hr * 0.3); ctx.lineTo(cx + hr * 0.55, cy - hr * 0.34); ctx.stroke();   // bushy brows
            ctx.fillStyle = "#CFD8DC"; ctx.beginPath(); ctx.ellipse(cx, cy + hr * 0.34, hr * 0.46, hr * 0.18, 0, 0, Math.PI * 2); ctx.fill();   // mustache
            ctx.fillStyle = "#795548"; roundRect(cx - s * 0.36, cy + hr * 0.55, s * 0.72, s * 0.4, 8); ctx.fill();   // cardigan collar bit
        } else if (type === "cellmate") {
            ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.2, hr * 1.0, Math.PI, 0); ctx.fill(); // beanie
            ctx.fillRect(cx - hr, cy - hr * 0.2, hr * 2, hr * 0.28);
            ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(cx - hr * 0.5, cy + hr * 0.5, hr, hr * 0.4); // stubble
        } else if (type === "cop") {
            ctx.fillStyle = "#3E2723"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.15, hr * 0.95, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#0D1B5E"; ctx.beginPath(); ctx.ellipse(cx, cy - hr * 0.7, hr * 1.05, hr * 0.4, 0, 0, Math.PI * 2); ctx.fill(); // cap
            ctx.fillStyle = "#1A237E"; ctx.beginPath(); ctx.ellipse(cx, cy - hr * 0.95, hr * 0.9, hr * 0.5, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#FFD54F"; ctx.beginPath(); ctx.arc(cx, cy - hr * 0.85, hr * 0.16, 0, Math.PI * 2); ctx.fill();
        } else {                                    // lulu
            ctx.fillStyle = (typeof save !== "undefined" && save.luluHair) || "#8B5A2B";
            ctx.beginPath(); ctx.arc(cx, cy - hr * 0.25, hr * 1.05, Math.PI, 0); ctx.fill();
            ctx.beginPath(); ctx.ellipse(cx - hr * 0.95, cy + hr * 0.25, hr * 0.4, hr * 0.95, -0.2, 0, Math.PI * 2); ctx.ellipse(cx + hr * 0.95, cy + hr * 0.25, hr * 0.4, hr * 0.95, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(cx - hr * 0.5, cy + hr * 0.25, hr * 0.18, 0, Math.PI * 2); ctx.arc(cx + hr * 0.5, cy + hr * 0.25, hr * 0.18, 0, Math.PI * 2); ctx.fill();
        }
        // mouth — flaps open/closed while talking, neutral otherwise
        var my = cy + hr * (type === "prosecutor" || type === "raphael" ? 0.62 : 0.5);
        if (talking) {
            var open = hr * (0.08 + Math.abs(Math.sin(gameTime * 15)) * 0.16);
            ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.ellipse(cx, my, hr * 0.2, open, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(cx, my - hr * 0.1, hr * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        }
    }

    // ── Courtroom figures ────────────────────────────────────
    function drawBenchJudge(cx, topY, banging) {
        var bw = 196, bx = cx - bw / 2;
        // raised bench
        ctx.fillStyle = "#4E342E"; roundRect(bx, topY + 26, bw, 60, 6); ctx.fill();
        ctx.fillStyle = "#3E2723"; roundRect(bx, topY + 26, bw, 12, 6); ctx.fill();
        ctx.fillStyle = "#5D4037"; roundRect(bx + 18, topY + 44, bw - 36, 34, 4); ctx.fill();
        drawText("⚖", cx, topY + 62, "bold 20px Arial", "#3E2723", null, 0);
        // judge above the bench
        ctx.fillStyle = "#1A1A1A"; roundRect(cx - 24, topY + 2, 48, 32, 8); ctx.fill();           // robe
        ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.moveTo(cx - 4, topY + 8); ctx.lineTo(cx, topY + 22); ctx.lineTo(cx + 4, topY + 8); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx, topY - 2, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(cx, topY - 2, 9.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; ctx.beginPath(); ctx.arc(cx, topY - 5, 11, Math.PI, 0); ctx.fill();    // wig
        ctx.beginPath(); ctx.ellipse(cx - 10, topY + 2, 4, 9, 0, 0, Math.PI * 2); ctx.ellipse(cx + 10, topY + 2, 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx - 3.4, topY - 2, 2.6, 0, Math.PI * 2); ctx.arc(cx + 3.4, topY - 2, 2.6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(cx - 3.4, topY - 2, 1, 0, Math.PI * 2); ctx.arc(cx + 3.4, topY - 2, 1, 0, Math.PI * 2); ctx.fill();
        // gavel
        ctx.save(); ctx.translate(cx + 34, topY + 30); ctx.rotate(banging ? -0.4 : -1.0);
        ctx.fillStyle = C.skin; roundRect(-2, 0, 4, 11, 2); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(-6, -12, 12, 8, 2); ctx.fill();
        ctx.restore();
        // nameplate
        ctx.fillStyle = "#2E1F18"; roundRect(cx - 46, topY + 88, 92, 14, 3); ctx.fill();
        drawText("THE HON. JUDGE", cx, topY + 95, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
    }

    function drawJuryBox(x, y, react) {
        ctx.fillStyle = "#4E342E"; roundRect(x, y, 122, 74, 6); ctx.fill();
        for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) drawJuror(x + 24 + c * 37, y + 22 + r * 26, r * 3 + c, react);
        ctx.fillStyle = "#5D4037"; roundRect(x, y + 46, 122, 9, 2); ctx.fill();   // front rail
        ctx.fillStyle = "#3E2723"; roundRect(x + 36, y + 64, 50, 12, 2); ctx.fill();
        drawText("JURY", x + 61, y + 71, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFD54F", null, 0);
    }

    // A single juror who REACTS: watches, leans-in to deliberate, gasps at a
    // guilty verdict, or relaxes/smiles at a dismissal.
    function drawJuror(x, y, seed, react) {
        var skin = ["#F4C9A0", "#E8B98A", "#D9A875", "#C68642"][seed % 4];
        var hair = ["#3E2723", "#5D4037", "#8D6E63", "#212121", "#BDBDBD", "#6D4C41"][seed % 6];
        var shirt = ["#5C6BC0", "#26A69A", "#EF5350", "#8D6E63", "#7E57C2", "#66BB6A"][(seed * 2) % 6];
        var bob = Math.sin(gameTime * 1.6 + seed) * 1;
        var lean = react === "deliberate" ? Math.sin(gameTime * 3 + seed * 1.7) * 2.5 : 0;
        var wide = react === "guilty";
        ctx.save(); ctx.translate(x + lean, y + bob);
        ctx.fillStyle = shirt; roundRect(-9, 4, 18, 13, 4); ctx.fill();
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -2, 6.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -4, 6.8, Math.PI, 0); ctx.fill();
        if (seed % 3 === 0) ctx.fillRect(-7, -4, 14, 2.5);
        // eyes
        if (wide) { ctx.fillStyle = "#FFF"; ctx.beginPath(); ctx.arc(-2.4, -2, 1.9, 0, Math.PI * 2); ctx.arc(2.4, -2, 1.9, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.4, -2, wide ? 1.3 : 1.1, 0, Math.PI * 2); ctx.arc(2.4, -2, wide ? 1.3 : 1.1, 0, Math.PI * 2); ctx.fill();
        // brows + mouth by reaction
        if (react === "guilty") {
            ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -5.6); ctx.lineTo(-1, -5); ctx.moveTo(1, -5); ctx.lineTo(4, -5.6); ctx.stroke();
            ctx.fillStyle = "#5D2A2A"; ctx.beginPath(); ctx.arc(0, 2, 1.4, 0, Math.PI * 2); ctx.fill();   // gasp
        } else if (react === "free") {
            ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, 1, 2, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke(); // smile
        } else if (react === "deliberate") {
            ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(3.5, 3, 2, 0, Math.PI * 2); ctx.fill();        // hand to chin (whisper)
            if (seed % 2 === 0) { ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-1, -4); ctx.moveTo(1, -4); ctx.lineTo(4, -5); ctx.stroke(); }
        } else if (seed % 2 === 0) {
            ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-1, -4); ctx.moveTo(1, -4); ctx.lineTo(4, -5); ctx.stroke(); // skeptical
        }
        ctx.restore();
    }

    function drawProsecutor(x, y, t, pointing, label) {
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0, 26, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1C2429"; roundRect(-7, 12, 6, 16, 2); ctx.fill(); roundRect(1, 12, 6, 16, 2); ctx.fill();   // trousers
        ctx.fillStyle = "#212121"; roundRect(-8, 26, 8, 4, 2); ctx.fill(); roundRect(0, 26, 8, 4, 2); ctx.fill();      // shoes
        ctx.fillStyle = "#26323A"; roundRect(-12, -10, 24, 24, 5); ctx.fill();                                          // suit
        ctx.fillStyle = "#FFF"; roundRect(-3, -9, 6, 20, 1); ctx.fill();                                                // shirt
        ctx.fillStyle = "#C62828"; ctx.beginPath(); ctx.moveTo(-2.5, -8); ctx.lineTo(0, 8); ctx.lineTo(2.5, -8); ctx.fill(); // tie
        // pointing arm (accusing) / resting arm
        ctx.save(); ctx.translate(-11, -7); ctx.rotate(pointing ? -1.0 + Math.sin(t * 12) * 0.05 : -0.1);
        ctx.fillStyle = "#26323A"; roundRect(-3, -2, 6, 17, 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, 16, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#26323A"; roundRect(8, -6, 5, 15, 2); ctx.fill();
        // head
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 7.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#212121"; ctx.beginPath(); ctx.arc(0, -20, 8, Math.PI, 0); ctx.fill(); ctx.fillRect(-8, -20, 16, 2);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-2.6, -18, 1.1, 0, Math.PI * 2); ctx.arc(2.6, -18, 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; ctx.fillRect(-3.5, -13, 7, 1.8);   // mustache
        ctx.restore();
        if (label !== null)
            drawText(label || "PROSECUTOR", x, y + 36, "bold 8px 'Segoe UI', Arial, sans-serif", "#FFCDD2", "#000", 2);
    }

    function drawDefendant(cx, py) {
        // podium + Lulu (striped) behind it
        drawPrisoner(cx, py - 4, gameTime, "lulu");
        ctx.fillStyle = "#5D4037"; roundRect(cx - 30, py + 10, 60, 34, 4); ctx.fill();
        ctx.fillStyle = "#4E342E"; roundRect(cx - 30, py + 10, 60, 8, 3); ctx.fill();
        ctx.fillStyle = "#8D6E63"; roundRect(cx - 22, py + 22, 44, 18, 2); ctx.fill();
        ctx.fillStyle = "#3E2723"; drawText("⚖", cx, py + 31, "bold 12px Arial", "#3E2723", null, 0);
        drawText("THE DEFENDANT", cx, py + 52, "bold 8px 'Segoe UI', Arial, sans-serif", "#F8BBD0", "#000", 2);
    }

    // A seated striped-jumpsuit prisoner ("lulu" = hair + cheeks, "mate" = beanie).
    function drawPrisoner(x, y, t, who, beard) {
        ctx.save(); ctx.translate(x, y);
        var bob = Math.sin(t * 2 + (who === "lulu" ? 1 : 0)) * 1.5; ctx.translate(0, bob);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 24, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#E8E8E8"; roundRect(-9, 12, 7, 14, 2); ctx.fill(); roundRect(2, 12, 7, 14, 2); ctx.fill();
        ctx.fillStyle = "#ECEFF1"; roundRect(-13, -10, 26, 24, 6); ctx.fill();
        ctx.fillStyle = "#37474F"; for (var s = 0; s < 4; s++) ctx.fillRect(-13, -8 + s * 6, 26, 3);
        ctx.fillStyle = "#ECEFF1"; roundRect(-16, -8, 5, 16, 2); ctx.fill(); roundRect(11, -8, 5, 16, 2); ctx.fill();
        ctx.fillStyle = "#37474F"; ctx.fillRect(-16, -2, 5, 3); ctx.fillRect(11, -2, 5, 3);
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.skin; ctx.beginPath(); ctx.arc(0, -18, 8.6, 0, Math.PI * 2); ctx.fill();
        if (who === "lulu") {
            ctx.fillStyle = save.luluHair || "#8B5A2B";
            ctx.beginPath(); ctx.arc(0, -21, 9, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-8, -16, 3.5, 7, -0.3, 0, Math.PI * 2); ctx.ellipse(8, -16, 3.5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,140,140,0.5)"; ctx.beginPath(); ctx.arc(-4, -15, 1.6, 0, Math.PI * 2); ctx.arc(4, -15, 1.6, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = "#455A64"; ctx.beginPath(); ctx.arc(0, -21, 9, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(-9, -21, 18, 3);
        }
        ctx.fillStyle = "#1A1A1A"; ctx.beginPath(); ctx.arc(-3, -18, 1.3, 0, Math.PI * 2); ctx.arc(3, -18, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#5D2A2A"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, -11, 3, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        // a beard that GROWS the longer she's been locked up (0..1)
        if (beard > 0) {
            var bl = 4 + beard * 15;
            ctx.fillStyle = shadeColor(save.luluHair || "#8B5A2B", -14);
            ctx.beginPath();
            ctx.moveTo(-7.5, -15);
            ctx.quadraticCurveTo(-8.5, -13 + bl, 0, -11 + bl);
            ctx.quadraticCurveTo(8.5, -13 + bl, 7.5, -15);
            ctx.quadraticCurveTo(0, -10, -7.5, -15);
            ctx.fill();
            // moustache scruff so it reads as a beard, not a bib
            ctx.fillRect(-6, -15, 12, 2.5);
        }
        ctx.restore();
    }
