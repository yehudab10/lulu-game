// features/crime — every knob + every line (tune here). See index.js for the catalogue.
export const ID = "crime";

/** What each crime pays and its cap (AGENTS golden rule 5: nothing repeatable for free). Per REAL day = the device's date. */
export const PAY = {
    cart: { base: 4, perM: 1 / 12, perScatter: 2, maxRide: 15, ridesPerDay: 2, name: "🛒 SHOPPING-CART JOYRIDE" },
    jaywalk: { from: 2, each: 2, perDay: 12, name: "🚶‍♀️ JAYWALKING SPREE" },
    park: { perHonk: 1, maxStop: 8, order: 3, perDay: 16, name: "🅿️ DOUBLE-PARKING EMPIRE" },
    // ── stage 2: crime that isn't hers ──
    monte: { bet: 3, playsPerDay: 3, report: 8, shill: 2, shillMax: 8, heat: 4, name: "🥄 FIND THE KUGEL" },
    watch: { price: 6, buysPerDay: 1, report: 6, name: "⌚ THE COAT OF WATCHES" },
    porch: { back: 6, perDay: 12, shomrim: 3, keep: 4, keepPerDay: 4, name: "📦 THE PORCH PIRATE" },
    // ── stage 3 ──
    tags: { all: 12, perDay: 12, heat: 3, name: "🏷️ THE MATTRESS-TAG RING" },
    herring: { pay: 8, perDay: 8, name: "🐟 THE KIDDUSH HEIST" },
    air: { sale: 2, perDay: 10, permit: 4, name: "🌬️ AUTHENTIC AIR" },
    // corruption: a ticket, a "donation", hush money, Internal Affairs' thank-you (each character once — then they're gone)
    ticket: 10, sweetFail: 12, donation: 5, hush: 8, hushPerDay: 8, ia: 10, iaPerDay: 20, cut: 4, cutPerDay: 8,
};

export const TUNE = {
    // the law, on foot: a cop who SEES a petty thing gives a ⚠️ look first; again within susLife s = the foot chase
    susLife: 30,
    copSight: 46,               // m — law units + the town's patrol car (clear line of sight)
    // 🛒 the cart
    cart: { r: 2.2, top: 9.5, accel: 3.2, steer: 2.6, drag: 0.35, life: 22, scatterR: 2.6, minRide: 6 },
    // 🚶‍♀️ jaywalking: across the street mid-block (≥ midBlock m from any crossing) in ≤ crossMax s; combo window
    jay: { midBlock: 11, crossMax: 9, combo: 14, dodgeR: 4.2, dodgeSpeed: 3 },
    // 🅿️ double-parking: stopped in a travel lane on a shop street; a honk = a town car stuck behind her
    park: { stopFor: 1.6, honkR: 26, honkEvery: 3.2, orderAt: 24, midwoodGrace: 40, lakewoodGrace: 14 },
    // 🥄 the cups: a cop this close folds the table; back after backAfter s clear; the shill's marks
    monte: { copR: 40, backAfter: 45, swaps: 6, swapSec: 0.38, markEvery: 5, marks: 4 },
    // ⌚ the watch guy paces a stretch of sidewalk; a cop this close and he's gone for a while
    watch: { copR: 34, pace: 9, speed: 0.9, backAfter: 60 },
    // 📦 the porch pirate: the first after firstAfter s of walking in town, then every gap s, ≤ perRun a run
    tags: { n: 4, within: 120, every: 1, chance: 1, minD: 30, maxD: 110, lookEvery: 0.6 },
    herring: { coneDeg: 70, coneR: 9, lookTurn: [3.5, 6], away: 22, grabR: 1.6 },
    air: { shift: 30, buyerEvery: 6, inspectorAt: 12, inspectorChance: 0.6 },
    // the corruption scenes she can walk in on (and photograph): one every gap s while she walks in town, ≤ perRun
    corrupt: { firstAfter: 60, gap: [90, 160], perRun: 3, life: 18, near: [18, 45], photoR: 34, malkaAfter: 12 },
    porch: { firstAfter: 45, gap: [80, 150], perRun: 2, doorMin: 12, doorMax: 45, walk: 2.4, run: 5.6, tired: 3.8, tiredAfter: 7, getaway: 55, life: 30, tackleR: 1.9, auto: 1.0 },
};

// ── charges (law.addCharge: the arrest lines, the lawyer, a courtroom event that always plays) ──
export const CHARGES = {
    cart: {
        key: "SHOPPING CART", name: "GRAND THEFT SHOPPING CART", weight: 1, nudge: "help",
        cop: ["A shopping cart. Down the MIDDLE of the avenue.", "Ma'am, that cart has a wobbly wheel AND a record now."],
        lulu: ["It was RETURNING itself!", "I was bringing it back. Fast."],
        defense: "my client was RETURNING the cart, your honor. Downhill. With enthusiasm. The store got it back — eventually — with only one wobbly wheel, which it always had.",
        court: [
            { who: "BAILIFF", p: "bailiff", text: "Exhibit A, your honor. *pushes in a shopping cart; one wheel squeaks the whole way*" },
            { who: "PROSECUTOR", p: "prosecutor", text: "Clocked at 21 miles an hour. In a SHOPPING CART. Past a crossing guard." },
            { who: "JUDGE", p: "judge", text: "…does it still have the quarter in it? *checks* It does. Order. ORDER." },
        ],
    },
    jaywalk: {
        key: "JAYWALKING", name: "SERIAL JAYWALKING", weight: 1, nudge: "help",
        cop: ["The crosswalk was RIGHT THERE. I pointed at it.", "Seven times. Mid-block. Every single one."],
        lulu: ["The crosswalk was SO far. Like forty feet.", "I looked both ways! Twice!"],
        defense: "my client looked both ways, your honor — repeatedly. The crosswalk was forty feet away. Forty. Feet. In those shoes.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "The People present a map, your honor. Red line: the crosswalk. Pink zigzag: the defendant." },
            { who: "JUDGE", p: "judge", text: "That's not a route. That's a SIGNATURE." },
        ],
    },
    park: {
        key: "DOUBLE PARKING", name: "DOUBLE PARKING (\"ONE SECOND\")", weight: 1, nudge: "help",
        cop: ["Double-parked. Eleven cars stuck behind you.", "'One second', she said. It's been FORTY."],
        lulu: ["My hazards were ON!", "Everyone does it! It's practically a LANE!"],
        defense: "my client's hazards were ON, your honor. In this borough, as the court well knows, that is practically a parking permit.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "Witness statement from a Mr. Glick, car four in the line: 'HONK. HONK. HOOOONK.' Unquote." },
            { who: "JUDGE", p: "judge", text: "Were the hazards on? *nods slowly* …I'll allow it. Partly." },
        ],
    },
};

Object.assign(CHARGES, {
    monte: {
        key: "MONTE", name: "CONSPIRACY TO MONTE (KUGEL)", weight: 2, nudge: "help",
        cop: ["The SHILL. Of course you're the shill.", "Three cups and a kugel. Who's the brains here? …Don't answer."],
        lulu: ["I was just WINNING a lot!", "I didn't know it was rigged! …The third time."],
        defense: "my client was a satisfied CUSTOMER, your honor. Several times. In a row. Loudly. That is not a crime — it's enthusiasm.",
        court: [
            { who: "BAILIFF", p: "bailiff", text: "Exhibit A: three paper cups. Exhibit B: one kugel, found up a sleeve." },
            { who: "PROSECUTOR", p: "prosecutor", text: "Your honor, I'll show the jury. Watch the kugel. Watch it… *shuffles* …where is it?" },
            { who: "JUDGE", p: "judge", text: "…the MIDDLE one. *lifts it* …it's EMPTY. Mister Prosecutor, empty your SLEEVES." },
        ],
    },
    porch: {
        key: "PORCH PACKAGE", name: "PORCH PACKAGE THEFT", weight: 2, nudge: "help",
        cop: ["The doorbell camera has you in 4K, miss.", "A package off a porch. With the family WATCHING."],
        lulu: ["I was holding it for safekeeping!", "It said 'deliver to: whoever'!"],
        defense: "my client merely KEPT the package from a known porch pirate, your honor. Safekeeping. She simply… forgot to give it back. For a while.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "The People present the doorbell footage. *a blurry pink smudge waves at the camera*" },
            { who: "BAILIFF", p: "bailiff", text: "The contents of the package, your honor: forty-eight rolls of toilet paper and a challah cover." },
            { who: "JUDGE", p: "judge", text: "…from the BIG wholesale place? *writes something down* For the record, that's a GOOD price. Proceed." },
        ],
    },
});

Object.assign(CHARGES, {
    tags: {
        key: "MATTRESS TAG", name: "MATTRESS TAG REMOVAL", weight: 1, nudge: "help",
        cop: ["'UNDER PENALTY OF LAW.' It's right there ON the tag.", "Four mattresses. Four tags. One very guilty face."],
        lulu: ["They were ITCHY!", "I'm the CONSUMER! It says the consumer can!"],
        defense: "the tag says, your honor — and I quote — 'except by the consumer.' My client consumes. Constantly. Mostly kugel.",
        court: [
            { who: "BAILIFF", p: "bailiff", text: "Exhibit A: four mattress tags in a ziplock bag. *holds it up very carefully*" },
            { who: "JUDGE", p: "judge", text: "Do NOT open that bag in my courtroom. I have a mattress at home. I have FEELINGS about this." },
        ],
    },
    herring: {
        key: "HERRING", name: "PETTY HERRING THEFT", weight: 1, nudge: "help",
        cop: ["The GOOD herring. In wine sauce. Have you no shame?", "The kiddush club filed a complaint. All nine of them. Separately."],
        lulu: ["It was for a FRIEND!", "The cream-sauce one was RIGHT THERE and I left it!"],
        defense: "my client liberated the herring from the street, your honor — never from inside the shul. On the sidewalk, herring is, legally speaking, fair game. I think.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "Witness for the People: Reb Getzel, gabbai of the kiddush club. He's… still upset." },
            { who: "JUDGE", p: "judge", text: "Wine sauce or cream sauce? …WINE? *gasps* Order. ORDER IN THE COURT." },
        ],
    },
    air: {
        key: "SELLING AIR", name: "SELLING AIR WITHOUT A PERMIT", weight: 1, nudge: "help",
        cop: ["Jars. Of AIR. For money.", "The inspector says you didn't have a permit. For AIR."],
        lulu: ["It's AUTHENTIC!", "People were HAPPY! One lady cried!"],
        defense: "my client sold an authentic, locally sourced product, your honor. If the court would open Exhibit A, it would smell the Garden State itself.",
        court: [
            { who: "BAILIFF", p: "bailiff", text: "Exhibit A: one jar. Label: 'GENUINE LAKEWOOD AIR — limited edition.'" },
            { who: "JUDGE", p: "judge", text: "*opens it, sniffs* …cholent. And a minivan. Yes, that's authentic. Case— no. Continue." },
        ],
    },
    bribery: {
        key: "BRIBING A PUBLIC SERVANT", name: "BRIBING A PUBLIC SERVANT (MINOR)", weight: 2, nudge: "help",
        cop: ["A 'donation'. To the meter maid. In an ENVELOPE.", "Internal Affairs has photos, miss. Lots of them."],
        lulu: ["It was a TIP! For excellent ticketing!", "I thought it was a fundraiser!"],
        defense: "my client believed in good faith that the Meter Maid Kugel Fund was a registered charity. It has a LOGO, your honor.",
        court: [
            { who: "PROSECUTOR", p: "prosecutor", text: "The People present one envelope, marked 'NOT A BRIBE' in pink marker." },
            { who: "JUDGE", p: "judge", text: "…'not a bribe.' Well, it SAYS so. Was there kugel in it? There's always kugel in it." },
        ],
    },
});

// ── lines ─────────────────────────────────────────────────────────────────
export const LINES = {
    // the cop's ⚠️ look (on foot, the first petty thing he sees)
    warn: {
        cart: ["🚓 \"Is that… a SHOPPING CART?\"", "🚓 \"Ma'am. The cart. Off the street.\""],
        jaywalk: ["🚓 \"Crosswalk's RIGHT THERE.\"", "🚓 \"I saw that. Once is a warning.\"", "🚓 \"Corner. Light. Walk. It's not hard.\""],
        park: ["🚓 \"Move it or lose it, hazards.\"", "🚓 \"You're blocking the whole avenue!\""],
    },
    chase: { cart: "🚨 THE CART COP!", jaywalk: "🚨 JAYWALKER!", park: "🚨 THAT'S IT — DOUBLE PARKING!" },
    cart: {
        spot: "🛒 Ride the runaway cart",
        short: "RIDE",
        on: ["WHEEEEE!", "This is NOT returning it!", "Brakes? BRAKES?!"],
        scatter: ["WATCH IT!", "Oy, a CART!", "Meshugge!", "My challah!"],
        crash: ["…I'm okay!", "Ten out of ten. Would cart again."],
        done: "{name} — {m} m · {n} scattered",
        capped: "🛒 Pure joy. (No more coins from carts today.)",
        owner: ["My CART! Bring back my cart!", "That's a quarter cart, young lady!"],
        hint: "steer with the stick · it stops by itself",
    },
    jaywalk: {
        combo: "🚶‍♀️ JAYWALK ×{n}",
        dodge: "😅 CLOSE ONE",
        first: ["Mid-block. Living dangerously.", "The crosswalk is a suggestion."],
        honk: ["HEY! Crosswalk!", "*HOOONK*", "Look where you're walking!"],
    },
    park: {
        prompt: "🅿️ Double-park — \"one second\"",
        start: ["One second! ONE SECOND!", "Hazards on. Totally legal."],
        honk: ["*HONK*", "*HOOONK*", "MOVE IT!", "Lady, the HAZARDS aren't a permit!", "One second my foot!"],
        order: "🍕 The order's ready — the counter guy brings it out",
        done: "{name} — {n} cars held up",
        legal: ["🚓 \"…hazards are on. Carry on.\"", "🚓 *shrugs at the hazards* — it's Midwood."],
        capped: "🅿️ (Enough honking for today — no more coins from it.)",
    },
    copSees: "👮 A cop saw that!",
    monte: {
        dealer: "YANKY THREE-CUPS",
        spot: "🥄 \"Find the kugel!\"",
        pitch: ["Find the kugel, win the kugel! Three cups, one kugel, NO tricks!", "Step right up, sweetheart. Even Berel wins, and Berel is NOT smart.", "Keep your eye on the kugel. The KUGEL. Not my sleeves."],
        hiPartner: ["My favourite partner! Again? The marks LOVED you.", "Ah, the professional. Shift's open if you want it."],
        play: "🎲 Play — {n} 💰", report: "📞 Report him (911)", shill: "🤝 Be his shill — split the take", leave: "🚶‍♀️ Walk away",
        shuffle: ["Round and round she goes…", "Watch closely. CLOSELY.", "Faster than a bochur at a kiddush!"],
        which: "Where's the kugel?", cups: ["⬅️ Left", "⬆️ Middle", "➡️ Right"],
        lost: ["…EMPTY?! I SAW it go in there!", "That's IMPOSSIBLE. I was watching!", "Rigged. One hundred percent rigged."],
        sleeve: ["So close! Again? *a lokshen pokes out of his sleeve*", "Ooh, unlucky! *pats his very lumpy sleeve*"],
        noMore: "Nah, you're too good for me today. Come back tomorrow. *sweats*",
        broke: "No coins, no kugel, sweetheart.",
        bye: ["Your loss! Literally!", "Tell your friends! Not the ones in uniform."],
        nabbed: ["It's a GAME of SKILL, officer!", "I was just… FOLDING the table! For good!", "Berel! BEREL! …Berel's gone."],
        reportDone: "🥄 Yanky's off to the precinct — a good citizen's thank-you",
        call911: ["911, what's your emergency?", "A three-cup game? With a KUGEL? …We're sending somebody. He's hungry."],
        shillLulu: ["(okay. act natural. WIN LOUDLY.)", "I'm a regular customer. I LOVE this game."],
        shillWin: ["I WON! AGAIN! Who knew!", "This game is SO fair!", "Easy money, everybody! Step up!"],
        mark: ["Ooh, let me try!", "How hard can it be?", "Three cups? I'm a grandfather, I've got this."],
        shillPaid: "🤝 Yanky slips you your cut",
        shillDone: "Enough shilling for one day, partner. The marks are getting suspicious.",
        berel: ["I WON! Again! What are the odds!", "This guy's a GENIUS — and so am I!", "Kugel! I found the kugel!"],
        fold: ["Cheese it! It's the cops!", "*folds the table in one move* …nice weather, huh?", "Nothing to see! Just a man and his… table."],
        snitch: ["Not YOU again.", "Oh no. The SNITCH. Table's closed.", "I don't know you. I've never had a table in my life."],
        phoneLabel: "Report the three-cup game", phoneSub: "on the corner · \"find the kugel\"",
    },
    watch: {
        name: "SHMULY ROLECKS",
        spot: "⌚ \"Psst — wanna buy a watch?\"",
        pitch: ["Rolecks. Rolecks. ROLECKS. Genuine fake.", "Psst. Watches. Tell time, mostly.", "For you? Special price. For everyone? Same price."],
        buy: "⌚ Buy a \"Rolecks\" — {n} 💰", report: "📞 Report him (911)", no: "🙅‍♀️ No thanks",
        bought: ["It's ticking… BACKWARDS.", "The second hand fell off. Classy.", "My wrist is turning green. That means it's real gold. Right?"],
        noMore: "One per customer, sweetheart. They're LIMITED. *opens the other side of the coat*",
        broke: "No money? No time. Get it? Time?",
        bye: ["Your loss. Mine are waterproof. Probably.", "Tick tock, sweetheart."],
        run: ["*coat flaps open* I GOTTA GO!", "Watches? What watches?"],
        nabbed: ["They're GIFTS, officer! I'm very generous!", "Officer! Have you got the time? …I do. Forty times."],
        reportDone: "⌚ Shmuly's watches are evidence now — the precinct says thanks",
        call911: ["911?", "A man with forty watches in his coat. …Again? That guy. Sending a car."],
        phoneLabel: "Report the guy with the watch coat", phoneSub: "\"Rolecks\" · genuine fake",
    },
    porch: {
        thief: "PORCH PIRATE",
        spotted: "📦 PORCH PIRATE!", spottedSub: "✋ tackle him · 📞 Shomrim · or let it go",
        grab: ["Ooh, a box. Mine now.", "*whistles* Just picking up my… package.", "Is it a challah cover? I hope it's a challah cover."],
        run: ["Can't catch me!", "Finders keepers!", "It's MY package! My name is… Package!"],
        tackle: "📦 TACKLE THE PORCH PIRATE", tackled: ["Oof! Fine! FINE! Take your box!", "It was PROBABLY toilet paper anyway!"],
        pick: "📦 Pick up the {fam}' package", carry: "📦 Return it to the {fam}' door", ret: "📦 RETURN",
        thanks: ["Our package! Oy, you're a LIFESAVER!", "The challah cover! Thank you, sweetheart! Take a rugelach!", "You got it BACK? Come in, come in — have a cholent!"],
        backDone: "📦 The {fam} got their package back",
        again: ["You again! Our package angel!", "It's the girl who brought our box back!"],
        gone: "📦 The porch pirate got away with the {fam}' package",
        group: ["📦 The {fam}' package walked off their porch. AGAIN. Who's watching the cameras?", "📦 Porch pirate on the block! Lock your boxes, ladies."],
        shomrimDone: "🔦 Shomrim got the {fam}' package back",
        kept: "📦 You kept it. It's… {what}",
        keptWhat: ["48 rolls of toilet paper", "a challah cover with somebody else's name on it", "4 pounds of farfel", "a very large bottle of seltzer", "a single slipper"],
        keepCall: "📞 The {fam}' doorbell camera saw you",
        callLines: ["Shomrim! A porch pirate? On THIS block?! We're coming. Moishe's stretching."],
        phoneLabel: "Report the porch pirate", phoneSub: "running down the block with a box",
        lulu: ["HEY! That's not yours!", "Drop the box, buddy!"],
    },
    tags: {
        tip: ["Mattresses on the kerb, {street}. Tags still on. Rip all {n} before the sanitation truck. Don't ask why. — F.", "Job for you: {n} mattresses on {street}. The tags. ALL of them. Quick. — F."],
        spot: "🏷️ RIP THE TAG", short: "RIP",
        rip: ["*RRRRIIIIP*", "*RIIIP* …under penalty of LAW!", "*rrrip* ...free at last."],
        gasp: ["Did she just—", "THE TAG?!", "Under PENALTY OF LAW, young lady!", "Somebody call somebody!"],
        done: "🏷️ All {n} tags — the Fixer pays",
        late: "🏷️ The sanitation truck got there first",
        lulu: ["It's MY mattress now. Spiritually.", "The tag said not to. So I did."],
    },
    herring: {
        gabbai: "REB GETZEL",
        table: "🐟 The kiddush table (the GOOD herring)",
        spot: "🐟 Swipe the good herring", short: "SWIPE", wait: "🐟 (wait till he looks away…)",
        swiped: ["(got it — act natural, walk away)", "(wine sauce. The GOOD one.)"],
        caught: ["GANEF! The HERRING!", "That's the KIDDUSH CLUB's herring!", "Put down the herring, young lady!"],
        clean: "🐟 Clean getaway with the herring — Mendy across the street pays",
        chatter: ["L'chaim! L'chaim!", "Who brought the kichel?", "Don't touch the wine-sauce one, it's for after.", "Nu, where's the herring from?"],
        lulu: ["Nobody's watching the herring…", "(the herring calls to me)"],
    },
    air: {
        stand: "🌬️ Sell authentic {town} air", short: "SELL",
        open: ["Fresh {town} air! Hand-jarred this morning!", "Authentic! Locally sourced! Gluten-free!"],
        pitch: "A customer! Pitch it:",
        pitches: { lakewood: ["🌲 \"Pine Barrens, aged in a minivan!\"", "🥘 \"A hint of Shabbos cholent!\"", "🚗 \"Captured on Route 9 at rush hour!\""],
            midwood: ["🍕 \"Avenue J, notes of pizza!\"", "🚇 \"Straight off the Q train!\"", "🥯 \"Brooklyn bagel, everything-flavoured!\""] },
        bought: ["I'll take TWO!", "My bubbe will LOVE this.", "Is it kosher? …Close enough!", "Smells like home. Somebody's home."],
        inspector: "INSPECTOR PINCHAS",
        permit: "Do we have a PERMIT for this… air?",
        permitOpts: ["💸 \"A donation\" — {n} 💰", "📄 \"Of course I have a permit!\"", "🏃‍♀️ Grab the jars and run"],
        winked: ["What jars? I didn't see any jars. *pockets it*", "Air? What air? I'm not even HERE."],
        believed: "Hm. Very… official. Carry on. *squints*",
        notBelieved: "That's a NAPKIN. That's a napkin with 'PERMIT' on it.",
        done: "🌬️ Sold out — {n} jars of air",
        capped: "🌬️ (Nobody's buying air twice in a day)",
    },
    corrupt: {
        malka: "MALKA THE METER MAID",
        tuvia: "TUVIA'S TOWING",
        pinchas: "INSPECTOR PINCHAS",
        ticket: "Double-parked, sweetheart. That's a ticket.",
        ticketOpts: ["🧾 Take the ticket — {t} 💰", "🍬 Sweet-talk her", "🍩 A \"donation\" to the Meter Maid Fund — {d} 💰", "📸 About this photo of you…"],
        sweetOk: ["Fine. FINE. The hazards are… very nice hazards.", "Oy, you're a sweetheart. Go. GO before I change my mind."],
        sweetNo: "Flattery is +2. That's a {n} 💰 ticket now.",
        tornUp: ["*tears it up* What ticket? I never saw you. *pockets it*", "Very generous! The Fund thanks you! *tears it up*"],
        hushed: ["*goes pale* …you know what, your parking is PERFECT. Here. For your… trouble.", "Shhh. SHHH. Here. Forget the photo. Forget ME."],
        nervous: "*sees you, walks the OTHER way very fast*",
        strict: "OFFICER PNINA (BY THE BOOK)",
        strictLine: "I don't do 'donations'. I do TICKETS. That's {t} 💰.",
        scenes: {
            malka: { label: "taking a \"donation\" from a double-parker", lines: ["Envelope? For the Fund? How THOUGHTFUL. *tears up his ticket*", "Nobody saw that. Right? RIGHT?"], other: ["Thanks, Malka! Same time next week!"] },
            tuvia: { label: "towing a LEGALLY parked minivan", lines: ["Hydrant? Sure there's a hydrant. It's… invisible. Hook it up!", "Forty for the tow, sixty for the 'storage', and Malka gets her cut."], other: ["THAT'S MY MINIVAN! I was parked LEGALLY!"] },
            pinchas: { label: "pocketing a challah \"for the inspection\"", lines: ["Health inspection! *takes a challah* …and this one. For testing.", "Everything's in order. *takes the babka too*"], other: ["…every week. EVERY week he 'inspects'."] },
        },
        sceneSpot: "👀 What's going on here?", sceneShort: "LOOK",
        sceneOpts: ["📸 Snap it (evidence)", "🤝 \"Want a hand? For a cut…\"", "🚶‍♀️ Not my business"],
        snapped: "📸 Evidence: {who} {what}",
        snappedAlready: "📸 (you've already got that one)",
        cutOk: ["Smart girl. Here's your cut. *wink*", "A partner! Nobody saw nothing."],
        ia: "🕵️ Internal Affairs",
        iaTag: "Sgt. Emes · hand in evidence",
        iaNone: "No evidence yet. Photograph something crooked (📸 the Camera app, or walk up to it) and bring it here.",
        iaThanks: "🕵️ Internal Affairs: \"{who}? We've been watching… we'll take it from here.\"",
        iaGone: "{who} has been… reassigned. To the parking lot of a parking lot.",
        iaHand: "Hand it in",
        sellBack: "📸 About this photo… (hush money)",
    },
};
