// features/homes — 🎬 SCENES OF HOME LIFE: what a household is doing when she comes to the door (life.js picks one by
// the hour, the weekday, the season and the family's traits; house.js + stage.js stage it in whatever layout the
// house has). A scene is DATA plus one small stage(S) function:
//
//   when(w, home) → weight (0 = not now)        w = life.js when(): { hour, wd, shabbos, friday, motzei, ids, month… }
//   needs(home)   → bool (who must live here)   away(w, home) → kinds not home (work, school, shul, the mountains)
//   rooms         { dining, kids } the layout needs     dad: "dressed" | "towel" | "pyjamas" (default dressed)
//   heard         what she hears / sees from the doorstep (the ✋ door menu's line)
//   knock         answer odds ({ meal, kvetch, kid, nobody, sleepy, scene }) — "scene" = this scene's own `door`
//   door          { who: [kinds], lines: [[…]], invite: bool } — the scene's own answer at the door
//   noPhone       nobody phones anything in (Shabbos)       hush: × how fast they notice (violin practice: 0.6)
//   caught        { kind | "*": what happens when THAT person catches her sneaking } — see stage.js CATCH
//   guest         lines a host says to a guest · treat: what she's served (a bubble)
//   cholent       "ready" | "notYet" | "served" | "none"     lights: "dim" (the 3 am kitchen)
//   ambient       { kind: [lines] } said every few seconds by whoever's home of that kind
//   stage(S)      place people / props (S: stage.js — anchors S.A, S.place, S.seat, S.extra, S.prop, S.zone)
//
// Every joke is about people. What is holy (Shabbos, the candles, a sefer, davening) is never the punchline.
import { has, workday } from "./life.js";

const kidsOf = home => home.cast.filter(k => k === "boy" || k === "girl");
const adultsOf = home => home.cast.filter(k => k === "mom" || k === "dad" || k === "bubbe" || k === "zeidy");
const hasKid = home => kidsOf(home).length > 0;
const between = (h, a, b) => (a <= b ? h >= a && h < b : h >= a || h < b);
const weekday = w => !w.shabbos && !w.yomtov && w.wd >= 0 && w.wd <= 4 || (w.wd === 5 && !w.friday);
const KIDS_AT_SCHOOL = (w) => workday(w) ? ["boy", "girl"] : [];
const ADULTS_AT_WORK = (w) => workday(w) ? ["dad", "mom"] : [];

export const SCENES = {
    // ── the everyday ──────────────────────────────────────────────────────
    ordinary: {
        id: "ordinary", emoji: "🏠", name: "an ordinary day",
        when: w => (w.shabbos || w.yomtov ? 0 : 1),
        heard: ["The radio's on. Someone's arguing with it.", "Somebody's on the phone with their sister. Loudly.", "A vacuum cleaner. Then a dropped Lego. Then a yell."],
        stage() { /* everyone in their usual places */ },
    },
    restDay: {
        id: "restDay", emoji: "📖", name: "a quiet Shabbos / Yom Tov afternoon",
        when: w => (w.shabbos || w.yomtov) && !has(w, "yomKippur") ? 2 : 0,
        noPhone: true,
        heard: ["Quiet. Someone's reading on the couch; two kids are playing a board game and arguing about the rules.", "A peaceful house. A kid is reading a parsha sheet out loud to the cat."],
        knock: { scene: 3, nobody: 1 },
        door: { who: ["mom", "dad", "bubbe", "zeidy"], lines: [["Gut Shabbos! Come in, come in — have a cup of tea. Well, we have hot water from the urn."], ["Good Yom Tov! Come in, sit, there's cake on the table."]], invite: true },
        caught: { "*": "shabbosGuest" },
        guest: ["Sit, sit. There's cake. There's ALWAYS cake.", "We're just relaxing. Do you play Rummikub? You'll learn."],
        treat: "a slice of marble cake from the Shabbos table",
        stage(S) {
            if (S.has("dad")) S.place("dad", S.A.couchSeat(0), { sit: true, prop: "book" });
            if (S.has("zeidy")) S.place("zeidy", S.A.armchair, { sit: true, prop: "book" });
            const kids = S.cast.filter(k => k === "boy" || k === "girl");
            kids.forEach((k, i) => S.place(k, S.A.around(S.A.livingFloor, i + 1), { sit: true, y: -0.35 }));
            if (S.has("mom")) S.seat("mom", 0);
            if (S.has("bubbe")) S.seat("bubbe", 1);
        },
    },
    supper: {
        id: "supper", emoji: "🍽️", name: "supper",
        when: w => !w.shabbos && !w.friday && between(w.hour, 17.5, 20.5) ? 5 : 0,
        needs: home => adultsOf(home).length > 0,
        rooms: { dining: true },
        heard: ["Forks. Clatter. \"Eat your VEGETABLES.\" \"These ARE vegetables, it's a POTATO.\"", "Someone's saying \"SIT. DOWN. AT. THE. TABLE.\" for the fourth time."],
        knock: { meal: 5, kvetch: 1 },
        caught: { bubbe: "eat", mom: "eat", zeidy: "eat" },
        guest: ["Take more. You took a BIRD portion.", "Who wants the last schnitzel? ...Lulu. The guest. FINAL.", "So. You're working? Married? Thinking about it?"],
        treat: "a schnitzel the size of a steering wheel",
        ambient: { mom: ["Elbows!", "Who wants seconds? Nobody? I made SO much.", "Napkin. NAPKIN."], dad: ["Pass the ketchup.", "How was school? ...\"Fine\" is not a story."],
            boy: ["Can I be excused?", "I'm not hungry for THAT."], girl: ["He's kicking me under the table!", "I want the PINK cup."], bubbe: ["Eat! You're skin and bones!"] },
        stage(S) {
            const seats = S.A.table.seats;
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k) && k !== "mom") S.seat(k, i++ % seats.length);
            if (S.has("mom")) S.place("mom", S.A.stove, { path: [S.A.stove, S.A.tableSide] });
            S.prop("platter", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            S.prop("plates", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    homework: {
        id: "homework", emoji: "📚", name: "homework wars",
        when: w => !w.shabbos && !w.friday && weekday(w) && between(w.hour, 15.5, 19) ? 4 : 0,
        needs: hasKid, rooms: { kids: true },
        heard: ["\"WHAT is seven times eight?!\" \"...a NUMBER?\"", "A grown-up voice: \"Just READ the question.\" A small voice: \"I DID. It's WRONG.\""],
        caught: { boy: "homework", girl: "homework" },
        ambient: { mom: ["Show your WORK.", "Erase it properly, it's a HOLE now.", "Rashi doesn't say that. Read it again."], dad: ["When I was your age, we had NO calculators.", "Ask your mother. She's better at fractions."],
            boy: ["This is the hardest homework IN HISTORY.", "Why do I need to know what a TRAIN from Cleveland does?!"], girl: ["I'm DONE. ...except the back page."] },
        stage(S) {
            const kids = S.cast.filter(k => k === "boy" || k === "girl");
            if (kids[0]) S.place(kids[0], S.A.desk, { sit: true });
            if (kids[1]) S.seat(kids[1], 0, true);
            const helper = S.has("mom") ? "mom" : S.has("dad") ? "dad" : S.has("bubbe") ? "bubbe" : null;
            if (helper) S.place(helper, S.A.deskSide, { pose: { point: true, talk: true } });
            S.prop("books", S.A.desk.x + 0.5, S.A.deskTop, S.A.desk.z);
        },
    },
    violin: {
        id: "violin", emoji: "🎻", name: "violin practice",
        when: w => !w.shabbos && !w.yomtov && !w.quiet && between(w.hour, 9.5, 20) ? 1.2 : 0,
        needs: hasKid,
        heard: ["A violin. Or a cat. No — definitely a violin. Probably.", "Someone's playing \"Twinkle Twinkle\" like it owes them money."],
        hush: 0.55,
        caught: { boy: "play", girl: "play" },
        ambient: { "*kid": ["*SKREEEEK*", "*scraaape* ...that was a B.", "*SKREEE-onk* Morah says I'm IMPROVING."], mom: ["Beautiful, sweetie! ...*covers ears*", "From the TOP. Gently. GENTLY."],
            dad: ["I'm so proud. *muffled*", "The neighbours called. They also said beautiful."], bubbe: ["Like Itzhak Perlman! ...if he was in pain."], dog: ["*howls along*"], cat: ["*leaves the room*"] },
        squeak: true,
        stage(S) {
            const kid = S.cast.find(k => k === "boy" || k === "girl");
            S.place(kid, S.A.livingFloor, { ry: 0.4, pose: { point: true }, prop: "violin" });
            for (const k of S.cast) if (k !== kid && !S.animal(k) && k !== "baby") S.place(k, S.A.couchSeat(S.n++), { sit: true, pose: { facepalm: true } });
        },
    },
    mahjongg: {
        id: "mahjongg", emoji: "🀄", name: "Bubbe's mah-jongg",
        when: w => !w.shabbos && !w.friday && !w.yomtov && weekday(w) && between(w.hour, 12, 18) ? 2.5 : 0,
        needs: home => home.cast.includes("bubbe"),
        away: w => ADULTS_AT_WORK(w).concat(KIDS_AT_SCHOOL(w)),
        heard: ["Tiles clacking. \"TWO BAM!\" \"...you can't SAY two bam, it's MY turn.\"", "Three old ladies laughing so hard one of them is coughing."],
        knock: { scene: 4, kvetch: 1 },
        door: { who: ["bubbe"], lines: [["A FOURTH! Finally! Come in, sheifele — do you play?", "Doesn't matter. You'll LEARN. Sit."]], invite: true },
        caught: { bubbe: "dealIn", lady: "dealIn" },
        guest: ["Crak! ...no, that's not how you hold it.", "Mah-jongg! ...no? Feh.", "You're lucky. I don't like it."],
        treat: "a rugelach from the good tin",
        ambient: { bubbe: ["Two bam!", "Crak! I'm crakking!", "Who took my JOKER?!"], lady: ["Mah-JONGG! ...wait, no.", "Rivka, you're cheating.", "I'll pass. I'll PASS."] },
        stage(S) {
            const seats = S.A.table.seats;
            S.seat("bubbe", 0);
            S.extra("lady", seats[1], { sit: true, name: "Mrs. Fishbein", colors: { Top: "#26A69A", Hair: "#E0E0E0" } });
            S.extra("lady", seats[2], { sit: true, name: "Mrs. Lowinger", colors: { Top: "#EC407A", Hair: "#BCAAA4" } });
            S.prop("tiles", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    plumber: {
        id: "plumber", emoji: "🔧", name: "the plumber",
        when: w => !w.shabbos && !w.yomtov && weekday(w) && between(w.hour, 9, 16) ? 1 : 0,
        needs: home => adultsOf(home).length > 0,
        away: w => KIDS_AT_SCHOOL(w).concat(workday(w) ? ["dad"] : []),
        heard: ["A clanking under a sink. A man's voice: \"Who did THIS?\"", "\"It's not the pipe, lady. It's the PIPE.\""],
        knock: { scene: 3, kvetch: 1 },
        door: { who: ["mom", "bubbe", "zeidy"], lines: [["Oh — are you with the plumber? He said he had a helper. Go, go, the kitchen!"]], invite: true },
        caught: { plumber: "apprentice", mom: "apprentice", bubbe: "apprentice" },
        guest: ["He's been here three HOURS. He's had four coffees.", "Don't let him tell you about his boat."],
        ambient: { plumber: ["Hand me the wrench. The OTHER wrench.", "Who put a SPOON down here?", "That's a forty-dollar noise, that is."], mom: ["Is it bad? Just tell me if it's bad.", "Coffee? Another coffee?"], bubbe: ["In my day, we had ONE pipe."] },
        stage(S) {
            S.extra("plumber", S.A.sinkUnder, { sit: true, name: "Moti the plumber", ry: Math.PI });
            const host = S.has("mom") ? "mom" : S.has("bubbe") ? "bubbe" : S.has("zeidy") ? "zeidy" : null;
            if (host) S.place(host, S.A.counter, { ry: 0.6, pose: { talk: true } });
            S.prop("toolbox", S.A.sinkUnder.x - 0.7, 0, S.A.sinkUnder.z + 0.3);
        },
    },
    minivan: {
        id: "minivan", emoji: "🧳", name: "packing the minivan for the mountains",
        when: w => !w.shabbos && !w.yomtov && between(w.hour, 7, 13) ? (w.month >= 5 && w.month <= 7 ? 4 : w.wd === 0 ? 1.2 : 0.3) : 0,
        needs: home => adultsOf(home).length > 0,
        heard: ["\"WHO packed the KUGEL in the SUITCASE?\"", "A zipper losing a fight. A man sitting on a suitcase. Winning, barely."],
        knock: { scene: 4, kvetch: 1 },
        door: { who: ["mom", "dad"], lines: [["We're LEAVING, we're LEAVING! ...is that the car service? No? Then grab a bag, sheifele, you're helping."]], invite: true },
        hush: 0.75,
        caught: { "*kid": "play" },
        ambient: { dad: ["It'll FIT. Everything FITS. Physics is a suggestion.", "*sits on the suitcase* ...CLOSE, you!"], mom: ["Did anyone pack the BABY?", "Passports? We're going to the CATSKILLS. Never mind."],
            "*kid": ["Are we there yet?", "Can the fish come?"], bubbe: ["You'll call when you get there. You'll call when you STOP."] },
        stage(S) {
            const L = S.A.livingFloor;
            S.prop("suitcases", L.x - 0.4, 0, L.z - 0.2);
            if (S.has("dad")) S.place("dad", { x: L.x - 0.4, z: L.z - 0.25, ry: 0.3 }, { sit: true, y: 0.32 });
            if (S.has("mom")) S.place("mom", S.A.door2, { path: [S.A.door2, S.A.stove, S.A.livingFloor] });
            for (const k of S.cast) if ((k === "boy" || k === "girl") && !S.placed(k)) S.place(k, S.A.livingRun(S.n++), { path: [S.A.livingRun(0), S.A.kidsFloor] });
        },
    },
    morning: {
        id: "morning", emoji: "🥪", name: "the morning rush",
        when: w => weekday(w) && between(w.hour, 6.5, 8.6) ? 6 : 0,
        dad: "towel",
        heard: ["\"WHERE'S MY OTHER SHOE?!\" \"WHICH one?\" \"THE OTHER ONE!\"", "A lunchbox slams. Then another. A horn outside: carpool."],
        knock: { scene: 3, kvetch: 1 },
        door: { who: ["mom"], lines: [["Is that CARPOOL?! ...no? Then why are you HERE? Take a lunch, there's extra. *SLAM*"]] },
        hush: 0.8,
        caught: { "*kid": "pact" },
        ambient: { mom: ["SHOES! TZITZIS! LUNCH! GO!", "Who ate the LAST yogurt?!"], dad: ["Has anyone seen my tefillin bag? ...found it. In the FREEZER."], "*kid": ["I can't find my OTHER shoe!", "I don't WANT a tuna sandwich!"] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.counter, { path: [S.A.counter, S.A.door2, S.A.kidsFloor] });
            for (const k of S.cast) if ((k === "boy" || k === "girl") && !S.placed(k)) S.place(k, S.A.livingRun(S.n++), { path: [S.A.livingRun(1), S.A.kidsFloor, S.A.door2], fast: true });
            S.prop("lunchboxes", S.A.counterTop.x, S.A.counterTop.y, S.A.counterTop.z);
        },
    },
    quiet: {
        id: "quiet", emoji: "🤫", name: "a quiet weekday",
        when: w => workday(w) ? 5 : 0,
        away: w => ADULTS_AT_WORK(w).concat(KIDS_AT_SCHOOL(w)),
        heard: ["Quiet. The dishwasher's humming. Someone's left a radio on for the cat.", "Nothing. Just a clock ticking and a dog sighing."],
        stage(S) {
            if (S.has("bubbe")) S.place("bubbe", S.A.stove, {});
            if (S.has("zeidy")) S.place("zeidy", S.A.armchair, { sit: true, sleep: true });
        },
    },
    zeidyNap: {
        id: "zeidyNap", emoji: "📰", name: "Zeidy's nap",
        when: w => !w.shabbos && !w.yomtov && between(w.hour, 13, 17) ? 3 : 0,
        needs: home => home.cast.includes("zeidy"),
        away: w => ADULTS_AT_WORK(w).concat(KIDS_AT_SCHOOL(w)),
        heard: ["Snoring. Deep, confident, Olympic snoring.", "A newspaper rustles. Someone says \"I'm not SLEEPING, I'm RESTING my EYES.\""],
        caught: { zeidy: "cleaning" },
        ambient: { zeidy: ["*snorrrk* ...the PRICES... *zzz*", "I'm not sleeping. *zzz*"] },
        stage(S) {
            S.place("zeidy", S.A.couchLie, { lie: true, sleep: true, prop: "newspaper" });
            if (S.has("bubbe")) S.place("bubbe", S.A.stove, {});
        },
    },
    cereal: {
        id: "cereal", emoji: "🥣", name: "3 a.m. — cereal over the sink",
        when: w => between(w.hour, 0.5, 5.5) ? 12 : 0,
        dad: "pyjamas", lights: "dim",
        heard: ["Dark. Every window's dark… except the kitchen. A spoon. Crunching.", "Silence. Then, very quietly: *crunch crunch crunch*."],
        knock: { sleepy: 5, nobody: 1 },
        caught: { "*": "pact" },
        ambient: { dad: ["*crunch* ...*crunch*", "*whispers* ...the good cereal. The KIDS' cereal."], boy: ["*crunch* ...don't tell Mommy."], mom: ["*crunch* ...shh."] },
        stage(S) {
            const awake = S.has("dad") ? "dad" : S.has("boy") ? "boy" : S.has("mom") ? "mom" : null;
            if (awake) S.place(awake, S.A.sink, { ry: Math.PI, prop: "bowl", awake: true });
            for (const k of S.cast) if (k !== awake && !S.placed(k)) {
                if (k === "boy" || k === "girl") S.place(k, S.A.bunkLie(S.n++), { lie: true, sleep: true });
                else if (S.animal(k)) S.place(k, S.A.rugSpot, { sleep: true });
                else if (k !== "baby") S.place(k, S.A.couchLie, { lie: true, sleep: true });
            }
        },
    },
    bedtime: {
        id: "bedtime", emoji: "🌙", name: "bedtime",
        when: w => !w.shabbos && between(w.hour, 20, 23.5) ? 4 : 0,
        needs: hasKid, rooms: { kids: true }, dad: "pyjamas",
        heard: ["\"ONE more story.\" \"You said that FOUR stories ago.\"", "A small voice: \"I need WATER.\" A big voice: \"You had water.\" \"DIFFERENT water.\""],
        knock: { kvetch: 4, nobody: 1 },
        caught: { boy: "pact", girl: "pact" },
        ambient: { mom: ["...and the little goat went to sleep. THE END. Sleep.", "Shema. Then sleep. Then NOTHING."], boy: ["I'm not tired. *yawns*"], girl: ["Can you leave the light on? A LITTLE?"], dad: ["*washing dishes, humming*"] },
        stage(S) {
            for (const k of S.cast) if ((k === "boy" || k === "girl")) S.place(k, S.A.bunkLie(S.n++), { lie: true, sleep: false });
            if (S.has("mom")) S.place("mom", S.A.bunkSide, { sit: true, pose: { talk: true }, prop: "book" });
            if (S.has("dad")) S.place("dad", S.A.sink, { ry: Math.PI });
        },
    },
    // ── the Shabbos week ──────────────────────────────────────────────────
    erevShabbos: {
        id: "erevShabbos", emoji: "🧽", name: "erev Shabbos panic",
        when: w => w.friday && between(w.hour, 8, 19) ? 9 : 0,
        dad: "towel", rooms: { dining: true },
        heard: ["\"NOBODY WALK ON THE FLOOR!!\" — the floor has just been washed.", "Six people shouting \"WHO TOOK THE GOOD TOWEL?\" and a cholent that smells like heaven."],
        knock: { scene: 4, kvetch: 2 },
        door: { who: ["mom", "bubbe"], lines: [["It's EREV SHABBOS! We're— is that a CHALLAH? No? Then— the FLOOR! Don't step on the FLOOR!", "*SLAM*"]] },
        cholent: "notYet",
        caught: { "*kid": "play" },
        ambient: { mom: ["The FLOOR! It's WET!", "Who's showering? EVERYBODY'S showering!", "Candles in forty minutes! FORTY!"], bubbe: ["The kugel needs ten more minutes. And a prayer."],
            dad: ["I'm going, I'm going! ...where's my hat?"], "*kid": ["Can I lick the bowl?", "I'm CLEAN already! Mostly!"] },
        stage(S) {
            S.zone("wet", S.A.kitchenFloor);
            S.prop("mopBucket", S.A.kitchenFloor.x0 + 0.5, 0, S.A.kitchenFloor.z1 - 0.4);
            S.prop("challah", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            if (S.has("mom")) S.place("mom", S.A.stove, { path: [S.A.stove, S.A.tableSide, S.A.kidsFloor] });
            if (S.has("bubbe")) S.place("bubbe", S.A.counter, {});
        },
    },
    shabbosTable: {
        id: "shabbosTable", emoji: "🕯️", name: "the Shabbos table",
        when: w => w.shabbos && !has(w, "yomKippur") && (between(w.hour, 17.5, 23.5) || between(w.hour, 11.5, 14.5)) ? 10 : 0,
        rooms: { dining: true }, noPhone: true,
        heard: ["Singing. A whole table singing Shalom Aleichem, one uncle a little behind.", "Zemiros. Laughter. Someone saying \"just ONE more vort\" (it's not one)."],
        knock: { scene: 1 },
        door: { who: ["mom", "dad", "bubbe", "zeidy"], lines: [["Gut Shabbos! Come in, come in — there's always room. We'll squeeze."], ["A guest! Gut Shabbos! Sit, sit — the soup's still hot."]], invite: true },
        caught: { "*": "shabbosGuest" },
        cholent: "served",
        guest: ["Gut Shabbos! Sit next to Bubbe, she won't stop talking but she's very nice.", "So — who knows the answer to the parsha sheet question? ...Mendy? MENDY knows.",
            "Have more cholent. Nobody leaves this table hungry. It's a RULE.", "And now Zeidy's dvar Torah. Get comfortable."],
        treat: "a bowl of cholent and a second bowl of cholent",
        ambient: { dad: ["*sings* Ya-ba-bam, ya-ba-bam...", "And the Rashi there says — this is beautiful —"], zeidy: ["When I was a boy in Williamsburg...", "One more vort. A SHORT one."],
            mom: ["More potato kugel? There's more.", "Who wants the end piece?"], "*kid": ["I know the answer! Ask ME!", "Is it time for dessert?"], bubbe: ["You'll eat. Another piece."] },
        stage(S) {
            const seats = S.A.table.seats;
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k)) S.seat(k, i++ % seats.length);
            S.prop("candles", S.A.table.c.x - 0.7, S.A.table.y, S.A.table.c.z - 0.25);
            S.prop("challah", S.A.table.c.x + 0.2, S.A.table.y, S.A.table.c.z);
            S.prop("plates", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    shabbosNap: {
        id: "shabbosNap", emoji: "😴", name: "the Shabbos nap",
        when: w => w.shabbos && !has(w, "yomKippur") && between(w.hour, 14.5, 17.5) ? 10 : 0,
        noPhone: true,
        heard: ["Silence. The deep, holy silence of a whole house asleep after cholent.", "Snoring in four keys. The Shabbos shluf has begun."],
        knock: { sleepy: 4, nobody: 1 },
        caught: { "*": "sleepy" },
        stage(S) {
            for (const k of S.cast) {
                if (k === "boy" || k === "girl") S.place(k, S.A.bunkLie(S.n++), { lie: true, sleep: true });
                else if (k === "dad" || k === "zeidy") { if (!S.taken("couch")) { S.claim("couch"); S.place(k, S.A.couchLie, { lie: true, sleep: true, prop: "hatFace" }); } else S.place(k, S.A.armchair, { sit: true, sleep: true }); }
                else if (k === "mom" || k === "bubbe") S.place(k, S.taken("armchair") ? S.A.tableSeat0 : S.A.armchair, { sit: true, sleep: true });
                else if (S.animal(k)) S.place(k, S.A.rugSpot, { sleep: true });
            }
        },
    },
    kiddush: {
        id: "kiddush", emoji: "🥂", name: "a kiddush being set up",
        when: w => w.shabbos && between(w.hour, 9, 11.5) ? 4 : 0,
        rooms: { dining: true }, noPhone: true,
        away: () => ["dad", "boy", "zeidy"],
        heard: ["Trays sliding, foil crinkling: \"The herring goes on the LEFT.\" A kiddush for after shul.", "\"They'll be back from shul in TWENTY minutes and the kugel's not CUT.\""],
        knock: { scene: 1 },
        door: { who: ["mom", "bubbe"], lines: [["Gut Shabbos! Oh good, hands! Take this tray — the kugels go in a ROW."]], invite: true },
        caught: { "*": "shabbosGuest" },
        guest: ["Taste the kugel. Is it too peppery? Be honest. No — be NICE.", "Twenty people are coming. Forty will come."],
        treat: "a corner piece of potato kugel (the BEST piece)",
        ambient: { mom: ["The herring on the LEFT!", "Who moved the cake?!"], bubbe: ["In my day, a kiddush was a cookie and a l'chaim."], girl: ["Can I have one? ...ONE?"] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.tableSide, { path: [S.A.tableSide, S.A.counter] });
            if (S.has("bubbe")) S.place("bubbe", S.A.tableSide2, { pose: { talk: true } });
            S.prop("kiddushTable", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    pizza: {
        id: "pizza", emoji: "🍕", name: "Motzei Shabbos pizza",
        when: w => w.motzei ? 10 : (w.wd === 0 && between(w.hour, 18, 21) ? 1 : 0),
        dad: "dressed",
        heard: ["\"WHO ordered the MUSHROOM one?!\" Motzei Shabbos — the pizza's here.", "Three pizza boxes and an argument about whose turn it is to pick the topping."],
        knock: { meal: 5, kvetch: 1 },
        caught: { "*": "eat" },
        guest: ["Take a slice! Take two! Shabbos is over, the diet starts Tuesday.", "Gut voch! A gut voch! Pizza?"],
        treat: "a hot slice — the one with the most cheese",
        ambient: { dad: ["Gut voch! Who wants the corner piece?", "A gutte voch!"], mom: ["Plates! We're using PLATES."], "*kid": ["I want the one with OLIVES!", "He took TWO!"] },
        stage(S) {
            const seats = S.A.table.seats;
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k)) S.seat(k, i++ % seats.length);
            S.prop("pizza", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    // ── simchas ───────────────────────────────────────────────────────────
    shevaBrachos: {
        id: "shevaBrachos", emoji: "💐", name: "a sheva brachos being set up",
        when: w => !w.shabbos && !w.friday && !w.quiet && !w.yomtov && between(w.hour, 17, 21) ? 0.6 : 0,
        needs: home => home.cast.includes("mom") || home.cast.includes("bubbe"),
        rooms: { dining: true },
        heard: ["\"The chosson's family is coming in TEN MINUTES and the centrepieces are CROOKED!\"", "Balloons being blown up by someone who's clearly fainting."],
        knock: { scene: 4, kvetch: 1 },
        door: { who: ["mom", "bubbe"], lines: [["Are you the CATERER?! ...no? Doesn't matter — put the salads THERE. Go, go!"]], invite: true },
        caught: { "*": "caterer" },
        guest: ["Straighten that! ...thank you. You have an eye.", "The kallah's cousin is coming. The NICE one."],
        treat: "a stuffed mushroom from the caterer's tray (shh)",
        ambient: { mom: ["Centrepieces CENTRED!", "Who invited the Weisses? ...fine. Two more chairs."], bubbe: ["Seven brachos and seventy salads."], "*kid": ["Can I pop a balloon? Just ONE?"] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.tableSide, { path: [S.A.tableSide, S.A.tableSide2] });
            if (S.has("bubbe")) S.place("bubbe", S.A.tableSide2, { pose: { talk: true } });
            S.prop("simchaTable", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            S.prop("balloons", S.A.livingCorner.x, 0, S.A.livingCorner.z);
        },
    },
    vort: {
        id: "vort", emoji: "💍", name: "a vort",
        when: w => !w.shabbos && !w.quiet && between(w.hour, 19, 23) ? 0.5 : 0,
        rooms: { dining: true },
        heard: ["\"MAZEL TOV!\" — about forty people, a house built for eleven. Someone just got engaged.", "A crowd, cake, and four aunties saying \"I KNEW it!\""],
        knock: { scene: 1 },
        door: { who: ["mom", "dad", "bubbe"], lines: [["MAZEL TOV! Come in, come in! ...are you from his side or her side? Doesn't matter! CAKE!"]], invite: true },
        crowd: true,
        caught: { "*": "eat" },
        guest: ["Mazel tov! You know the kallah? Everyone knows the kallah.", "Have cake. Have MORE cake. It's a vort."],
        treat: "a slice of the engagement cake (the frosting rose)",
        ambient: { guest: ["MAZEL TOV!", "I KNEW it! I said it at the wedding last year!", "Who's next? ...don't look at me."], mom: ["Mazel tov! Thank you! Have cake!"], dad: ["L'chaim! L'CHAIM!"], bubbe: ["Finally! FINALLY!"] },
        stage(S) {
            S.extra("guest", S.A.livingFloor, { name: "an auntie", colors: { Top: "#AB47BC", Hair: "#5D4037" }, pose: { clap: true } });
            S.extra("guestM", S.A.livingRun(2), { name: "an uncle", colors: { Top: "#FFFFFF", Bottom: "#212121", Shoes: "#212121" }, pose: { talk: true } });
            S.extra("guest", S.A.tableSide2, { name: "a cousin", colors: { Top: "#42A5F5", Hair: "#8D6E63" }, pose: { cheer: true } });
            S.prop("cake", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            S.prop("balloons", S.A.livingCorner.x, 0, S.A.livingCorner.z);
        },
    },
    upsherin: {
        id: "upsherin", emoji: "✂️", name: "an upsherin",
        when: w => w.wd === 0 && between(w.hour, 9, 14) ? 2 : (!w.shabbos && !w.friday && between(w.hour, 10, 13) ? 0.25 : 0),
        needs: home => home.cast.includes("boy"),
        heard: ["\"He's THREE! Our little man is THREE!\" — scissors snipping, everyone clapping.", "Applause, a camera flash, and a small boy yelling \"MY HAIR!\""],
        knock: { scene: 1 },
        door: { who: ["mom", "dad", "bubbe"], lines: [["An upsherin! Come in! Everybody gets a snip — it's a segulah! ...for something!"]], invite: true },
        caught: { "*": "honour" },
        guest: ["Look at him! A real little bochur now!", "Take a picture! From his GOOD side."],
        treat: "a honey-dipped letter cookie (aleph — the first one)",
        ambient: { boy: ["My HAIR!", "Is it done? Is it DONE?", "I want a LOLLIPOP!"], mom: ["Look at those PAYOS!"], dad: ["Gently! Gently!"], bubbe: ["Like his Zeidy! Exactly!"] },
        stage(S) {
            S.place("boy", S.A.livingFloor, { sit: true, ry: 0, y: 0.32 });
            S.prop("chair", S.A.livingFloor.x, 0, S.A.livingFloor.z);
            let a = 0;
            for (const k of S.cast) if (k !== "boy" && !S.placed(k) && !S.animal(k) && k !== "baby") S.place(k, S.A.around(S.A.livingFloor, a++), { pose: { clap: true } });
        },
    },
    // ── a house that's FOR SALE (features/realestate lists it; the family lives there until it sells) ──
    forSale: {
        id: "forSale", emoji: "📦", name: "packing up — the house is for sale",
        when: () => 0,          // (never by chance: index.js plays it when ctx.realestate.claims(id) === "listed")
        heard: ["Packing tape. A LOT of packing tape. \"Who labelled this box 'STUFF'?!\"", "\"We are NOT taking the broken toaster to the new house.\" \"It's SENTIMENTAL.\""],
        knock: { scene: 4, kvetch: 1 },
        door: { who: ["mom", "dad", "bubbe"], lines: [["Are you here for the VIEWING? ...no? Come in anyway — take a box. Any box. PLEASE take a box."]], invite: true },
        caught: { "*": "eat" },
        guest: ["We've lived here eleven years. ELEVEN. The kitchen's staying. Obviously.", "Don't tell the buyers about the stair that squeaks. It's CHARMING."],
        treat: "the last of the freezer kugel (\"we're not MOVING it\")",
        ambient: { mom: ["Who packed the PLATES with the SHOES?!", "Label it! LABEL it!"], dad: ["It'll all fit in the van. Physics.", "*tape screech*"], "*kid": ["Can I bring my ROCK collection?", "I'm not GOING. I'm staying with the HOUSE."], bubbe: ["In my day we moved with TWO suitcases."] },
        stage(S) {
            S.prop("boxes", S.A.livingFloor.x - 0.3, 0, S.A.livingFloor.z - 0.5);
            S.prop("boxes", S.A.tableSide.x, 0, S.A.tableSide.z - 0.3);
            if (S.has("dad")) S.place("dad", S.A.livingRun(0), { pose: { point: true } });
            if (S.has("mom")) S.place("mom", S.A.counter, { path: [S.A.counter, S.A.livingRun(1)] });
        },
    },
    // ── the year (the real Hebrew calendar: ctx.seasons) ─────────────────
    chanukahParty: {
        id: "chanukahParty", emoji: "🕎", name: "a Chanukah party",
        when: w => has(w, "chanukah") && !w.shabbos && between(w.hour, 16.5, 23) ? 10 : has(w, "chanukah") && !w.shabbos ? 1.5 : 0,
        rooms: { dining: true },
        heard: ["The menorah's in the window. Inside: latkes sizzling and a kid yelling \"GIMMEL! I WIN!\"", "\"Maoz Tzur\", sung in three different keys, and the smell of fried EVERYTHING."],
        knock: { scene: 5, kvetch: 1 },
        door: { who: ["mom", "bubbe", "dad"], lines: [["Freilichen Chanukah! Come in — the latkes are HOT! Applesauce or sour cream? Wrong answer: BOTH."]], invite: true },
        caught: { "*": "eat" },
        guest: ["Another latke! They're SMALL. Practically air.", "Who wants to spin? Nun, gimmel, hei, shin — I always get SHIN.", "Did you see the menorah? Mendy made it in cheder. Out of BOLTS."],
        treat: "three latkes, a doughnut, and a chocolate coin",
        ambient: { mom: ["Who wants another latke?", "Don't touch the oil, it's HOT!"], bubbe: ["In my day, ONE latke was a party.", "Eat! It's Chanukah!"], dad: ["Nes gadol haya po!", "Who's winning? ...it's always Tzippy."],
            "*kid": ["GIMMEL! I WIN EVERYTHING!", "Shin? AGAIN?!", "Can I have my gelt NOW?"], zeidy: ["When I was a boy, gelt was MONEY. A whole nickel."] },
        stage(S) {
            S.prop("menorah", S.A.window.x, S.A.window.y, S.A.window.z, S.w.chanukah || 1);
            S.prop("latkes", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            const kids = S.cast.filter(k => k === "boy" || k === "girl");
            kids.forEach((k, i) => S.place(k, S.A.around(S.A.livingFloor, i), { sit: true, y: -0.35, pose: { cheer: i === 0 } }));
            if (kids.length) S.prop("dreidels", S.A.livingFloor.x, 0, S.A.livingFloor.z);
            let i = 0;
            for (const k of S.cast) if (!S.placed(k) && k !== "baby" && !S.animal(k)) { if (k === "mom") S.place("mom", S.A.stove, { path: [S.A.stove, S.A.tableSide] }); else S.seat(k, i++); }
        },
    },
    purimSeudah: {
        id: "purimSeudah", emoji: "🎭", name: "the Purim seudah",
        when: w => has(w, "purim") && between(w.hour, 13, 23.5) ? 10 : 0,
        rooms: { dining: true },
        heard: ["Costumes, groggers, an uncle singing \"Shoshanas Yaakov\" for the ninth time. It's the Purim seudah.", "A gorilla, two queens and a hot-dog are eating soup. Purim."],
        knock: { scene: 5, kvetch: 1 },
        door: { who: ["dad", "mom", "bubbe"], lines: [["A GUEST! Freilichen Purim! Come in! Who are you dressed as? ...LULU? Brilliant. Very convincing."]], invite: true },
        caught: { "*": "eat" },
        guest: ["Freilichen Purim! Have a hamantasch. Have FOUR.", "Guess my costume! ...no. No. I'm a TOASTER.", "L'chaim! ...wait, which one is Haman again?"],
        treat: "a hamantasch (poppy seed — the controversial one)",
        ambient: { dad: ["L'CHAIM! Freilichen Purim!", "*sings* Shoshanas Yaakov... from the TOP!"], mom: ["Who took the BIG mishloach manos?!", "Costumes OFF the table!"], "*kid": ["*SPINS GROGGER* HAAAAMAAAAN!", "I'm a FIREFIGHTER! *wooo wooo*"],
            guestM: ["L'chaim! ...which one is Haman? ...is it ME?", "*sings, slightly behind everyone*"], bubbe: ["Who are YOU supposed to be? ...a bubbe? Very good."] },
        costumes: true,
        stage(S) {
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k)) S.seat(k, i++);
            S.extra("guestM", S.A.tableSide2, { name: "Uncle Shmuel", colors: { Top: "#FFD54F", Bottom: "#6A1B9A" }, pose: { cheer: true }, crowd: false });
            S.prop("hamantaschen", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            S.prop("manos", S.A.counterTop.x, S.A.counterTop.y, S.A.counterTop.z);
        },
    },
    purimPrep: {
        id: "purimPrep", emoji: "🎁", name: "packing mishloach manos",
        when: w => (has(w, "purimPrep") || has(w, "taanisEsther")) && !w.shabbos && between(w.hour, 9, 22) ? 6 : 0,
        rooms: { dining: true },
        heard: ["An assembly line: \"Hamantasch — juice box — chocolate — NEXT!\"", "Cellophane crinkling. A LOT of cellophane."],
        knock: { scene: 4, kvetch: 1 },
        door: { who: ["mom", "bubbe"], lines: [["Hands! We need HANDS! Ninety baskets and the ribbon's all knotted. In, in!"]], invite: true },
        caught: { "*": "caterer" },
        guest: ["Hamantasch, juice, chocolate, tie it with the PINK ribbon. Not the blue. Never the blue.", "This one's for the rebbetzin. Make it PRETTY."],
        ambient: { mom: ["Ninety-one! We forgot the Kleins!", "The PINK ribbon!"], "*kid": ["Can I eat ONE? For quality control?", "I'm the ribbon person! I'm the BEST ribbon person!"] },
        stage(S) {
            S.prop("manos", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k)) S.seat(k, i++);
        },
    },
    sukkah: {
        id: "sukkah", emoji: "🌿", name: "everyone's out in the sukkah",
        when: w => (has(w, "sukkos") || has(w, "simchasTorah")) && (between(w.hour, 12, 15) || between(w.hour, 18, 22.5)) ? 9 : 0,
        away: (w, home) => home.cast.filter(k => k !== "baby" && k !== "cat" && k !== "dog" && k !== "zeidy"),
        heard: ["The house is dark, but out back: singing in the sukkah. Lanterns. Somebody dropped a spoon through the schach.", "From the backyard: \"Ushpizin!\" and a whole family laughing."],
        knock: { scene: 1 },
        door: { who: ["boy", "girl", "mom", "dad"], lines: [["*a kid runs round from the yard* We're in the SUKKAH! Mommy says come! ...oh — oh no — it's RAINING! EVERYBODY INSIDE! You too!"]], invite: true, go: "sukkahRain" },
        ambient: { yard: ["*from the sukkah* Ya-ba-bam...!", "*from the yard* Who has the esrog?! Careful with the PITOM!", "*from the sukkah* Ushpizin! Come in, come in!"] },
        stage(S) {
            if (S.has("zeidy")) S.place("zeidy", S.A.armchair, { sit: true, sleep: true });
        },
    },
    sukkahRain: {
        id: "sukkahRain", emoji: "🌧️", name: "rain on the sukkah — everybody inside!",
        when: w => (has(w, "sukkos") || has(w, "simchasTorah")) && (between(w.hour, 12, 15) || between(w.hour, 18, 22.5)) ? 2 : 0,
        rooms: { dining: true },
        heard: ["Rain on the schach. A stampede of people carrying plates into the house.", "\"The SOUP! Save the SOUP!\" — they're running in from the sukkah."],
        knock: { scene: 1 },
        door: { who: ["mom", "dad", "bubbe"], lines: [["Quick, quick, in — it's pouring on the sukkah! Grab a plate on your way!"]], invite: true },
        caught: { "*": "eat" },
        guest: ["Well. We tried. Hashem said not today.", "The soup got extra water. It's a TRADITION now."],
        treat: "a bowl of slightly-rained-in chicken soup",
        ambient: { mom: ["The SOUP! Who has the soup?!", "Towels! Everybody gets a towel!"], dad: ["We'll go back out when it stops. ...it's not stopping."], "*kid": ["My kugel got WET!", "Can we eat in the BATHTUB? It's dry in there."] },
        stage(S) {
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k)) { if (i < 2) S.place(k, S.A.livingRun(i), { path: [S.A.door2, S.A.tableSide], fast: true, prop: "plate" }); else S.seat(k, i); i++; }
            S.prop("plates", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    pesachClean: {
        id: "pesachClean", emoji: "🧹", name: "Pesach cleaning",
        when: w => (has(w, "pesachPrep") || (has(w, "erevPesach") && w.hour < 11)) && !w.shabbos ? 10 : 0,
        dad: "dressed",
        heard: ["A vacuum, a scrub brush, and someone shouting \"I SAW A CRUMB!\" — Pesach cleaning.", "Every cushion is off every couch. A child is inside the oven. (Cleaning it. Supervised.)"],
        knock: { scene: 4, kvetch: 1 },
        door: { who: ["mom", "bubbe"], lines: [["You're here to help? WONDERFUL. Here's a toothbrush. The grout by the fridge. Go."]], invite: true },
        caught: { "*": "toothbrush" },
        task: "scrub",
        guest: ["Every crumb. EVERY crumb. Chametz hides.", "You missed a spot. ...I'm kidding. ...you missed a spot."],
        ambient: { mom: ["CRUMB! I see a CRUMB!", "Who ate a PRETZEL in the living room?!"], dad: ["I found chametz in my COAT. From PURIM."], "*kid": ["I'm vacuuming the CAR! ...the toy car.", "Is this chametz? *holds up a sock*"], bubbe: ["In my day, we cleaned with our BARE HANDS. And a feather."] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.fridge, { pose: { point: true }, prop: "toothbrush" });
            S.prop("cushions", S.A.livingFloor.x - 0.2, 0, S.A.livingFloor.z - 0.4);
            S.prop("mopBucket", S.A.kitchenFloor.x0 + 0.5, 0, S.A.kitchenFloor.z1 - 0.4);
            const kids = S.cast.filter(k => k === "boy" || k === "girl");
            kids.forEach((k, i) => S.place(k, S.A.livingRun(i), { path: [S.A.livingRun(i), S.A.kidsFloor], prop: "toothbrush" }));
        },
    },
    seder: {
        id: "seder", emoji: "🍷", name: "the seder",
        when: w => has(w, "pesach") && (w.hour >= 19 || w.hour < 1) ? 10 : 0,
        rooms: { dining: true }, noPhone: true,
        heard: ["\"Ma nishtana…\" — a small voice, very proud. The seder.", "Singing, a door opening for Eliyahu, a kid checking if the cup went down."],
        knock: { scene: 1 },
        door: { who: ["dad", "mom", "bubbe", "zeidy"], lines: [["Chag sameach! \"Kol dichfin\" — all who are hungry, come and eat! We MEAN it. Come in!"]], invite: true },
        caught: { "*": "shabbosGuest" },
        task: "afikoman",
        guest: ["Chag sameach! You're just in time for the four questions. Mendy's been practising for WEEKS.", "Have more matzah. Pesach is a marathon, not a sprint.", "The afikoman's hidden somewhere. The kids are VERY motivated."],
        treat: "a piece of shmurah matzah and charoses (Bubbe's recipe)",
        cholent: "none",
        ambient: { dad: ["And so we tell the story... ALL of it.", "Who's leaning? Everybody lean!"], zeidy: ["When we left Mitzrayim— well, not ME personally—"], "*kid": ["Ma nishtana halaila hazeh...!", "Did the cup go down? I think the cup went DOWN!"], bubbe: ["Eat slowly, it's matzah, it's not going anywhere."] },
        stage(S) {
            let i = 0;
            for (const k of S.cast) if (k !== "baby" && !S.animal(k)) S.seat(k, i++);
            S.prop("seder", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    yomKippur: {
        id: "yomKippur", emoji: "🕊️", name: "Yom Kippur — everyone at shul",
        when: w => has(w, "yomKippur") ? 20 : 0,
        noPhone: true,
        away: (w, home) => home.cast.filter(k => k === "dad" || k === "mom" || k === "boy" || k === "girl" || k === "zeidy"),
        heard: ["The house is quiet. Everyone's at shul.", "Silent. A note on the fridge: \"Break-fast: bagels at 7:15. Do NOT touch.\""],
        knock: { nobody: 3, sleepy: 1 },
        stage(S) {
            if (S.has("bubbe")) S.place("bubbe", S.A.armchair, { sit: true, sleep: true });
            if (S.has("baby")) S.place("baby", S.A.couchSeat(0), { sit: true, sleep: true });
        },
    },
};

/** Lines by kind with fallbacks: an exact kind, then "*kid" (boy / girl), then "*" (anyone). */
export function linesFor(table, kind) {
    if (!table) return null;
    return table[kind] || ((kind === "boy" || kind === "girl") ? table["*kid"] : null) || table["*"] || null;
}
