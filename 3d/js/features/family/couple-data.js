// features/family — 🤫 SHLOIME + TOBY: the data. A secret (and a sweet one): Shloime Pollack (Lakewood — the single dad of
// Courtroom 2B, Baby Gitty's father; places/shloime.js) and Toby (Lulu's cousin from Brooklyn: her family's on East 8th St
// in Midwood) are quietly seeing each other. Why it's a secret: years ago, as teenagers, Shloime went out with Toby's
// older sister RAIZY — and Toby's family (her mother, Aunt Brochie, above all) could NOT handle that. Lulu finds out by
// accident and ends up covering for them. Wholesome, shidduch-appropriate (they meet in public, Gitty comes along),
// kind: nobody is laughed at for being in love, the secret never blows up cruelly. Story only — nothing pays coins.

export const PEOPLE = {
    shloime: { name: "Shloime", emoji: "🧔", model: "homesDad", colors: { Top: "#FFFFFF", Bottom: "#212121", Hair: "#3E2723", Shoes: "#212121" } },
    toby: { name: "Toby", emoji: "👩", model: "homesMom", colors: { Top: "#5C6BC0", Bottom: "#263238", Hair: "#6D4C41", Shoes: "#3E2723" } },
    gitty: { name: "Baby Gitty", emoji: "👶", model: "homesBaby", colors: { Top: "#F06292", Bottom: "#F8BBD0" } },
    raizy: { name: "Raizy", emoji: "👩‍🦱", model: "homesMom", colors: { Top: "#8E24AA", Bottom: "#37474F", Hair: "#212121", Shoes: "#212121" } },
    fayge: { name: "Fayge", emoji: "👩", model: "homesMom", colors: { Top: "#26A69A", Bottom: "#37474F", Hair: "#4E342E", Shoes: "#3E2723" } },
    ima: { name: "Ima", emoji: "👩", model: "imaPerson" },
};

/**
 * The beats, in order, one a real day. Each: where (town + a named town spot, u along its face, n out to the street),
 * when (game hours; never Shabbos / Yom Tov), who is there, what's said. `cover`: a near-miss — a choice of
 * ridiculous excuses, every one of which works (badly).
 */
export const BEATS = [
    {
        id: "pizza", town: "midwood", spot: "pizza", u: -3.6, n: 2.4, hours: [12, 21], who: ["shloime", "toby", "gitty"], table: true,
        label: "👀 SHLOIME… AND TOBY?!", far: ["*two people at the little table outside the pizza shop, sharing ONE slice, very carefully not looking at each other*", "*Shloime is hiding behind a menu. Upside down.*"],
        lines: [
            ["lulu", "TOBY?! And… is that Shloime Pollack? From LAKEWOOD? With Baby Gitty?"],
            ["toby", "LULU! Hi! Hi. We're… this is… we're discussing pizza. Professionally."],
            ["shloime", "Very professionally. I'm— she's— I'm getting a second opinion. On the crust."],
            ["gitty", "BA! 🍕"],
            ["toby", "Okay. Okay okay okay. Lulu. You can't tell ANYONE. Not Ima, not your Ima, not MY Ima — especially not my Ima."],
            ["lulu", "Why? He's lovely! The whole of Lakewood knows he brought four hundred photos of his baby to COURT."],
            ["toby", "It's… complicated. Very complicated. Swear?"],
        ],
        choose: { q: "Toby is holding her breath. So is Shloime. Gitty is holding a crust.", options: ["🤞 \"I swear. My lips are sealed.\"", "🤐 \"…sealed with CHEESE.\""] },
        after: [["toby", "Thank you thank you thank you. I'll explain. One day. Not today."], ["shloime", "Gitty says thank you too. …She said BA. It means thank you."]],
    },
    {
        id: "makolet", town: "lakewood", spot: "makolet", u: 2.6, n: 2.2, hours: [10, 19], who: ["shloime", "toby", "gitty"], apart: true,
        label: "👀 SHLOIME + TOBY — \"NOT TOGETHER\"", far: ["*two people reading the SAME sale flyer from opposite ends, very loudly not knowing each other*", "Shloime: \"What a… normal… stranger. Lovely weather, stranger.\""],
        lines: [
            ["shloime", "*loudly* Oh! Hello, random young lady I have never met! What brings YOU to the makolet?"],
            ["toby", "*loudly* Groceries! Which I'm buying ALONE! Hi, Lulu. *whispers* Lakewood has eyes. Everyone's aunt shops here."],
            ["lulu", "*whispers* You're whispering next to a baby who knows your name."],
            ["gitty", "TO-BY! 👋"],
            ["shloime", "…She's very advanced. She calls everybody Toby. *to a passing lady* Isn't that right? …She left."],
        ],
        choose: { q: "A lady with a cart is coming down the aisle. Help them look like strangers?", options: ["🕵️ Play along: \"Have you two MET? No? What a shame!\"", "📢 Blow it: \"HI TOBY! HI SHLOIME!\" (then pretend harder)"] },
        result: [[["toby", "*gasps theatrically* NO! We've never met! I'm Toby! A stranger!"], ["shloime", "Shloime! Also a stranger! What a coincidence, our strangeness!"]],
            [["toby", "LULU! …*to the lady* she's my cousin, she's very confused, she's been in the sun."], ["shloime", "*hides behind the cereal* I'm not here. I'm a box of Cheerios."]]],
        after: [["toby", "*whispers* It's not that he's not wonderful. He IS. It's that… he knew my family. Before. A LONG time before."], ["lulu", "Before WHAT?"], ["toby", "Next time. Shh. Cart lady."]],
    },
    {
        id: "lake", town: "lakewood", spot: "lake", u: 0, n: 3.6, hours: [15, 20], who: ["shloime", "toby", "gitty"], walk: true,
        label: "👀 SHLOIME + TOBY — BY THE LAKE", far: ["*a stroller, two people, a walk by the lake — and an EXTREMELY casual distance between them*"],
        lines: [
            ["toby", "Lulu! Okay. You've earned it. Sit. …The reason. Twelve years ago Shloime went out with my SISTER."],
            ["lulu", "RAIZY?!"],
            ["shloime", "We were seventeen! It lasted one Chol HaMoed. I bought her a pretzel. She said I chewed loud."],
            ["toby", "And my mother never, EVER got over it. 'That Pollack boy.' Every Pesach. At the table. Twelve years."],
            ["shloime", "Brochie still sends my mother a card every Rosh Hashana. It says 'HAPPY NEW YEAR.' In a TONE."],
        ],
        cover: {
            who: "raizy", from: 12,
            approach: [["toby", "…oh no. Oh NO. That's Raizy. With the twins. LULU, DO SOMETHING."], ["raizy", "TOBY?! What are you doing in Lakewood? And who's— is that SHLOIME POLLACK?!"]],
            q: "Raizy is ten steps away and squinting. Cover for them!",
            options: ["🚗 \"They're my DRIVING instructors. Both of them. I'm very bad.\"", "⚖️ \"He's my LAWYER. From court. I'm very guilty.\"", "👯 \"That's not Toby. That's my twin. …Toby's other twin.\""],
            replies: [
                [["raizy", "…Shloime Pollack teaches DRIVING? He crashed my father's car in 1999. …Well, that explains a lot about how YOU drive, Lulu."]],
                [["raizy", "Shloime's a LAWYER now? He couldn't pay for a pretzel without help. …Mazel tov, Shloime. I guess."]],
                [["raizy", "Toby doesn't HAVE a twin. …Do I have a twin? Is it ME? *wanders off, shaken* Twins, come. Let's go home and count."]],
            ],
            leave: [["raizy", "Anyway, gotta go, the twins need a nap, I need a nap, everybody needs a nap. Bye Toby! Bye… whoever!"]],
        },
        after: [["toby", "*exhales for about a minute* You're the BEST cousin in the history of cousins."], ["shloime", "I chewed quietly the WHOLE time. Did you notice? Quietly."]],
    },
    {
        id: "lookout", town: "midwood", spot: "parkLot", u: 6, n: -8, hours: [13, 20], who: ["shloime", "toby", "gitty"],
        label: "👀 SHLOIME + TOBY — THE FAR END OF THE LOT", far: ["*the far corner of the municipal lot: two people talking very seriously, a stroller, and a big sign that says NO LOITERING*"],
        lines: [
            ["toby", "Lulu! Thank goodness. Can you keep a lookout? Ten minutes. We just need to TALK without hiding behind a cereal box."],
            ["shloime", "About… things. Serious things. Like Gitty meeting Toby properly. And Toby meeting… Gitty properly."],
            ["gitty", "TO-BY! 💕"],
        ],
        cover: {
            who: "fayge", from: 14,
            approach: [["lulu", "*whispers* …Lookout report: FAYGE. With the stroller. Coming this way. Fast."], ["fayge", "LULU? What are you doing in the PARKING LOT? Who's that behind the—"]],
            q: "Fayge's coming down the row of cars. Distract her!",
            options: ["🍬 \"Fayge! Chani DROPPED something! …back at the bakery!\"", "🏠 \"I'm looking at APARTMENTS. In the lot. It's a… parking-lot apartment.\"", "🧂 \"Did you know they sell SALT at the makolet now? Like, a LOT of it?\""],
            replies: [
                [["fayge", "WHAT? Her pink sock? The GOOD pink sock? Chani, we're going back. …Bye, Lulu. Don't loiter."]],
                [["fayge", "An APARTMENT?! Finally! In a parking— no. You know what, I'm not going to ask. I'm going to tell Ima you're LOOKING. *beams, leaves*"]],
                [["fayge", "SALT?! In MY makolet? I need to speak to Yanky. I need to speak to Yanky RIGHT NOW. *wheels off at speed*"]],
            ],
            leave: [],
        },
        after: [["toby", "That was FAYGE?! Oh, she'd tell my mother in a heartbeat. …Would she?"], ["lulu", "Fayge? She tells everyone everything. …Except the important things. She's weird like that."],
            ["shloime", "We decided. Gitty's going to meet Toby on purpose. With cake. And then… we'll see. 🥹"]],
    },
    {
        id: "dropoff", town: "lakewood", spot: "pizza", u: 3.2, n: 2.4, hours: [16, 21], who: ["toby"], ride: { town: "midwood", lx: -150, lz: -5 },
        label: "👀 TOBY — NEEDS A RIDE", far: ["*Toby, alone outside the pizza shop, with a scarf over her head like a movie spy*"],
        lines: [
            ["toby", "Lulu! Shloime had to run, Gitty had a… situation. A diaper situation. Can you drive me back to Brooklyn?"],
            ["toby", "Not to my DOOR. My mother watches the street like a hawk. A hawk with binoculars. Round the corner — E 8th and Avenue L."],
        ],
        choose: { q: "Drive Toby home (well, round the corner from home)?", options: ["🚗 \"Hop in. I'll go the long way. The SPY way.\"", "🙈 \"Sorry, Toby — I can't right now.\""] },
        decline: [["toby", "That's okay! I'll take the bus. With my scarf. Nobody will ever know. …Tomorrow?"]],
        arrive: [["toby", "Here! Stop here! …Okay, scarf off. Normal face. Do I look like I've been at the LIBRARY?"], ["lulu", "You look like you've been on a date in Lakewood."],
            ["toby", "LULU! …Thank you. Really. For everything. You're the only one who knows. And you're keeping it. 💜"]],
    },
    {
        id: "ima", town: "midwood", spot: "luluHome", door: true, hours: [17.5, 21.5], who: ["ima"],
        label: "👩 IMA — ON THE PORCH, WITH A LOOK", far: ["*Ima on the porch, waiting. Ima has a LOOK.*"],
        lines: [
            ["ima", "Lulu. Sit. …Brochie called. She says Toby's been at the LIBRARY a lot lately."],
            ["ima", "Four times this week. Toby. Who returned a library book in 2009 and still hasn't recovered. …You'd know something, maybe?"],
        ],
        choose: { q: "Ima is very good at this. Ima raised YOU.", options: ["📚 \"She's… really into books now. Big books. About… lakes.\"", "🤷 \"Ima, I know NOTHING. I'm a cloud. Clouds don't know things.\"", "🍲 \"Is that kugel I smell?\" (change the subject)"] },
        result: [[["ima", "Lakes. LAKES. …Lakewood has a lake. *narrows her eyes* Hm. Go wash up."]],
            [["ima", "A cloud. My daughter, the cloud. Clouds don't eat kugel, then. …I'm joking, come eat."]],
            [["ima", "It IS kugel. …Fine. Keep your secrets. I had secrets too, once. Abba was one of them. 😌"]]],
        after: [["ima", "Whatever it is — if it makes Toby happy, it's a good thing. Tell her… no. Don't tell her anything. I said nothing. Kugel?"]],
    },
];
export const SECRET_DONE = "🤫 You kept Shloime + Toby's secret — every day of it. (Secret Keeper)";
export const COUPLE_AFTER = { toby: ["*whispers* Gitty called me 'TO-BY' at shul. Twice. I nearly fainted.", "Raizy asked if I'm seeing someone. I said 'only the library'."],
    shloime: ["Gitty drew Toby a picture. It's a circle. It's a LOVELY circle.", "Fishbein says I'm allowed to be happy. He's a real lawyer now, so it's legal."] };
