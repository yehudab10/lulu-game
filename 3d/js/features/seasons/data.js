// features/seasons — WHAT EACH DAY LOOKS LIKE. Pure data: tune here.
//
// A recipe per calendar id (calendar.js DAYS). Every field is optional:
//   windows   what stands in the front windows: "menorah" (tonight's candles lit) | "candles" (Shabbos / Yom Tov)
//   upper     the share of UPPER-floor windows that get one too (ground-floor windows always do)
//   big       the big public menorah in the town square (lit from dusk, tonight's count)
//   stand     a market stall: { goods, awning, sign: [lines], bg, fg, treat (the ✋ action), lines (what Lulu says), coins }
//             — in each town (by its bakery / pizza shop / main street) and now and then by the highway
//   sukkah    "done" | "going-up" — sukkahs on the duplexes' sukkah decks, in front yards, beside highway houses
//   baskets   mishloach manos on the doorsteps
//   kerb      the pre-Pesach clean-out piled at the kerb
//   bonfire   Lag BaOmer bonfires out in the fields off the highway
//   planters  greenery + flowers on the porches (Shavuos)
//   strings   the share of houses with blue-and-white string lights along the front eave (Chanukah)
//   groups    people in the world (groups.js): "lulav" (men + boys walking with a lulav + esrog — never on Shabbos),
//             "white" (Yom Kippur: families in white walking quietly to shul), "tashlich" (Rosh Hashana afternoon by
//             the lake / a pond — not on Shabbos), "hakafos" (Simchas Torah: dancing in a ring round a Torah, kids
//             with flags), "collectors" (Purim: costumed bochurim with a pushke at a few doors), "chametz" (erev Pesach:
//             the burning barrel, a firefighter beside it, neighbours with their last bag of bread)
//   musicVan  Purim: a minivan with roof speakers playing a jolly tune round town (solo; it's a town driver)
//   radio     "quiet": the 📻 music stations play no music (the Three Weeks / Nine Days / Tisha B'Av)
//   parade    the Purim costume parade on the town's main street
//   ima       the 📱 note from Ima (once a day, the family chat) · lulu: what Lulu says the first time she sees it
// No recipe = nothing changes in the world (fast days, the Three Weeks, Yom Kippur: quiet on purpose).
export const RECIPES = {
    chanukah: {
        windows: "menorah", upper: 0.5, big: true, strings: 0.45,
        stand: { goods: "Goods_Donuts", awning: "#1E88E5", sign: ["SUFGANIYOT", "fresh jelly doughnuts"], bg: "#1565C0", fg: "#FFFFFF",
            treat: "🍩 GRAB A SUFGANIYAH", lines: ["🍩 Powdered sugar EVERYWHERE. Worth it.", "🍩 Jelly on my chin. Don't tell Avigail.", "🍩 The doughnut guy says I'm his best customer. I'm his ONLY customer."], coins: 10 },
        ima: n => `Tonight is night ${n} of Chanukah 🕎 Be home for candle lighting — Bubbe's making latkes!`,
        lulu: n => n >= 8 ? "🕎 Eight candles in every window. The whole street is GLOWING." : `🕎 Night ${n}! Every window on the street is counting with me.`,
    },
    purimPrep: {
        stand: { goods: "Goods_Hamantaschen", awning: "#7B1FA2", sign: ["HAMANTASCHEN", "poppy · jam · chocolate"], bg: "#6A1B9A", fg: "#FFF3C4",
            treat: "🥟 GRAB A HAMANTASH", lines: ["🥟 Poppy seed or jam? …Both. Obviously.", "🥟 Practice for Purim. I'm VERY committed."], coins: 10 },
        ima: () => "Purim is coming! 🎭 Dina wants to be a fire truck. Not a firefighter. The TRUCK.",
    },
    purim: {
        baskets: 0.55, parade: true,
        stand: { goods: "Goods_Hamantaschen", awning: "#7B1FA2", sign: ["FREILICHEN PURIM!", "hamantaschen for the road"], bg: "#6A1B9A", fg: "#FFF3C4",
            treat: "🥟 GRAB A HAMANTASH", lines: ["🥟 A hamantash for me, a hamantash for the road…", "🥟 The guy in the crown says it's on the house. He's not even the owner."], coins: 12 },
        groups: ["collectors"], musicVan: true,
        ima: () => "Freilichen Purim! 🎭 Don't forget the mishloach manos for the Goldbergs — they're on the dining room table!",
        lulu: () => "🎭 A walking HAMANTASH just waved at me. I love this town.",
    },
    sukkosPrep: {
        sukkah: "going-up",
        stand: { goods: "Goods_Lulavim", awning: "#2E7D32", sign: ["LULAV & ESROG", "check yours here!"], bg: "#1B5E20", fg: "#FFF59D",
            treat: "🌿 ASK ABOUT THE ESROGIM", lines: ["🌿 He says this esrog is 'a beauty'. It's a lemon with a PEDIGREE.", "🌿 He held it up to the light for five minutes. Very serious lemon business."], coins: 10 },
        ima: () => "Abba's putting up the sukkah 🔨 He's asking where the hammer is. Again.",
        lulu: () => "🔨 Every yard's got a sukkah going up. Lakewood sounds like a hammer factory.",
    },
    sukkos: {
        sukkah: "done", groups: ["lulav"],
        ima: () => "Chag Sameach! 🌿 Dinner's in the sukkah tonight — bring a sweater.",
        lulu: () => "🌿 Sukkahs on every deck! Somebody's eating soup in there and LOVING it.",
    },
    simchasTorah: { sukkah: "done", groups: ["hakafos"], ima: () => "Chag Sameach! 📜 Abba danced with the Torah for two hours. He'll be hoarse till Tuesday." },
    roshHashana: {
        windows: "candles", groups: ["tashlich"],
        stand: { goods: "Goods_Apples", awning: "#C62828", sign: ["APPLES & HONEY", "a sweet new year!"], bg: "#B71C1C", fg: "#FFF8E1",
            treat: "🍎 DIP AN APPLE", lines: ["🍎 Apple in honey. A sweet year, guaranteed. Mostly.", "🍎 Sticky fingers on the steering wheel. Sweet new year!"], coins: 10 },
        ima: () => "Shana Tova, Lulu! 🍎 Apples and honey at Bubbe's — a sweet new year!",
    },
    yomKippur: { windows: "candles", groups: ["white"], ima: () => "G'mar chasima tova, sweetheart 🕊️" },
    tuBishvat: {
        stand: { goods: "Goods_Apples", awning: "#558B2F", sign: ["TU B'SHVAT", "dried fruit · figs · dates"], bg: "#33691E", fg: "#FFF8E1",
            treat: "🌳 TRY THE DRIED FRUIT", lines: ["🌳 A fig, a date and a carob. Bubbe would approve.", "🌳 Happy birthday, trees!"], coins: 10 },
        ima: () => "Happy Tu B'Shvat! 🌳 Bubbe bought every dried fruit in Lakewood.",
    },
    pesachPrep: {
        kerb: 0.35,
        ima: () => "Pesach cleaning! 🧹 If you find chametz in the car, it's YOURS to deal with.",
        lulu: () => "🧹 Every kerb in town is piled high. Pesach cleaning is a contact sport.",
    },
    erevPesach: {
        groups: ["chametz"], burn: 0.25,
        ima: () => "Erev Pesach! 🔥 Abba's taking the last of the chametz to the burning. Everything else is KOSHER FOR PESACH. Don't touch anything.",
        lulu: () => "🔥 The whole neighbourhood's out burning their chametz. The fire department's here too. Of course they are.",
    },
    pesach: { windows: "candles", ima: () => "Chag Kasher V'Sameach! 🫓 Matzah, matzah, and — surprise — more matzah." },
    lagBaomer: {
        bonfire: 0.3,
        ima: () => "Happy Lag BaOmer! 🔥 Enjoy the bonfires — from a SAFE distance. I mean it.",
        lulu: () => "🔥 Bonfires in the fields! Somebody's toasting marshmallows on a stick the length of a car.",
    },
    shavuosPrep: {
        stand: { goods: "Goods_Flowers", awning: "#EC407A", sign: ["FLOWERS FOR SHAVUOS", "greenery · roses · lilies"], bg: "#AD1457", fg: "#FFFFFF",
            treat: "💐 SMELL THE FLOWERS", lines: ["💐 Roses for Ima. She's going to cry. She always cries.", "💐 Greenery for the whole house. The house is going to look like a jungle."], coins: 10 },
        planters: 0.3,
        ima: () => "Shavuos is coming 💐 I bought six cheesecakes. Don't ask.",
    },
    shavuos: {
        planters: 0.45, windows: "candles",
        stand: { goods: "Goods_Cheesecake", awning: "#FBC02D", sign: ["CHEESECAKE", "it's tradition!"], bg: "#F9A825", fg: "#3E2723",
            treat: "🍰 TASTE THE CHEESECAKE", lines: ["🍰 Cheesecake for breakfast. It's TRADITION.", "🍰 Strawberry on top. This is a religious experience."], coins: 10 },
        ima: () => "Chag Sameach! 💐 Cheesecake for breakfast — it's tradition.",
    },
    // the quiet days: a word from Ima, nothing in the world
    tzomGedaliah: { ima: () => "It's Tzom Gedalia today — an easy fast, sweetheart 🕯️" },
    asaraBTeves: { ima: () => "Asara B'Teves today — an easy fast to everyone 🕯️" },
    taanisEsther: { ima: () => "Taanis Esther — an easy fast! Purim starts tonight 🎭 (the costumes are in the hall closet)" },
    tamuz17: { radio: "quiet", ima: () => "It's the 17th of Tamuz — an easy fast. The Three Weeks start today 🕯️" },
    threeWeeks: { radio: "quiet", ima: () => "It's the Three Weeks 🕯️ No weddings and no music at Bubbe's till after Tisha B'Av. (Simcha 101.3 is just TALKING now. It's very strange.)" },
    nineDays: { radio: "quiet", ima: () => "The Nine Days 🕯️ Dairy dinners till after Tisha B'Av. Bubbe's making blintzes." },
    tishaBav: { radio: "quiet", ima: () => "Tisha B'Av today. A quiet, sad day — an easy fast, sweetheart 🕯️" },
    // every week
    friday: {
        stand: { goods: "Goods_Challah", awning: "#F57C00", sign: ["CHALLAH & FLOWERS", "for Shabbos!"], bg: "#E65100", fg: "#FFF8E1",
            treat: "💐 FLOWERS FOR SHABBOS", lines: ["💐 Flowers for Shabbos. Ima's going to cry.", "🥖 Warm challah. One for Ima, one for… the car ride."], coins: 8 },
        ima: () => "It's Friday! 🕯️ Challah's in the oven — be home before candle lighting.",
    },
    shabbos: { windows: "candles", ima: () => "Good Shabbos, sweetheart 🕯️" },
};

/** The stall's "come again tomorrow" line once today's treat was paid. */
export const AGAIN = ["😋 Another one? …Fine. No gelt this time, though.", "😋 Seconds! (The free one was earlier.)", "😋 He knows me by name now. Embarrassing."];

/** Purim costumes for the parade (crowd marchers wear one each). */
export const COSTUMES = ["Hat_Crown", "Hat_Crown", "Hat_Tricorn", "Hat_Clown", "Hat_Fire", "Hat_Chef"];
export const PARADE = { marchers: 12, speed: 1.1, groggerEvery: 2.6 };

/** How far / how many of each prop kind are drawn (dress.js KINDS). R: drawn within R m of the camera; max: at once. */
export const KIND_DEFS = {
    menorah: { prop: "WinMenorah", max: 36, R: 48 },
    candles: { prop: "Candlesticks", max: 32, R: 44 },
    bigMenorah: { prop: "BigMenorah", max: 2, R: 420 },
    stand: { prop: "Stand", max: 4, R: 260 },
    sukkah: { prop: "Sukkah", max: 22, R: 170 },
    sukkahFrame: { prop: "SukkahFrame", max: 16, R: 150 },
    basket: { prop: "Basket", max: 24, R: 40 },
    kerb: { prop: "KerbPile", max: 18, R: 140 },
    barrel: { prop: "BurnBarrel", max: 4, R: 300 },
    pond: { prop: "Pond", max: 3, R: 300 },
    bonfire: { prop: "Bonfire", max: 4, R: 420 },
    logBench: { prop: "LogBench", max: 8, R: 200 },
    planter: { prop: "Planter", max: 24, R: 70 },
    banner: { prop: "Banner", max: 1, R: 300, live: true },
};
// the goods on a stall's counter (one kind each)
for (const g of ["Goods_Donuts", "Goods_Hamantaschen", "Goods_Cheesecake", "Goods_Lulavim", "Goods_Apples", "Goods_Challah", "Goods_Flowers"]) KIND_DEFS[g] = { prop: g, max: 4, R: 120 };

/** Tuning. */
export const TUNE = {
    standEveryChunks: 9,        // a highway stall about every N road chunks (hash-picked, never on a reserved stretch)
    standD: 13.6,               // … this far from the centre line (past the shoulder and the power poles' line at 11.5)
    driveUp: { speed: 3.0, r: 9 },  // pull up slowly beside a stall → served through the window
};
