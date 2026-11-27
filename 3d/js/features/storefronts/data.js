// features/storefronts/data.js — EVERY SHOPFRONT HAS A STATE (owner, 2026-11-27: "I want to eventually fill every building
// and property with something. Not every property needs to be filled right away — some of them can be under renovation
// — or closed or something … I don't necessarily want a bunch of stores repeating themselves.")
//
// The towns' storefronts (features/town/build.js: town_shop / town_mw_store, their sign lists in <town>-lines.js) are
// named from short lists, so a street used to repeat its 6–8 names over and over. Now each NAMED shop is real at ONE
// front (the first in its street); every other front gets its own state from here, so no name shows twice in a town:
//   open    a one-joke walk-in (room.js: one shared room, a person, a few lines, ONE small thing to do) — `hours`
//   closed  outside its hours (the game clock = the device's, + the weekday + Shabbos / Yom Tov): the door says so
//   soon    COMING SOON — papered windows, a sign that changes each real week (the joke can tease what's coming)
//   lease   FOR LEASE — reserved for ci/playershops (ctx.storefronts.claim, like realestate claims doors)
//   use     a feature owns it / it's saved for one (ci/cars' car-care row) — `reserved`
//   office  upstairs offices (a sign, no door)
//   gone    CLOSED for good — a thank-you note on the door
// Nothing pays: the few 5-coin things are a coin SINK through features/garage/buy.js (buyExtra).
//
// hours: "D-D h-h, h-h; D h-h" — days 0 (Sun) … 6 (Sat), hours as numbers (6.5 = 6:30, 26 = 2 am the next day).
// Shabbos + Yom Tov (ctx.seasons.day()) close everything unless `shabbos: "motzei"` (opens after it on Saturday night).

const P = (key, name, colors) => ({ key, name, colors });
const MAN = "npcMan", WOMAN = "npcWoman", KID = "npcKid";

/** The one-joke shops, by the name on their sign (line 1). who: [model, name, colours]; pal: [wall, shelves, accent];
 *  hi: what they say; act: her ONE thing ({ label, lines, cost? }); hours; shut: the door's joke when closed. */
export const SHOPS = {
    // ════ MIDWOOD — Avenue J ════
    "SHELF HELP SEFARIM": { emoji: "📚", who: P(MAN, "Reb Zalman", { Top: "#37474f", Bottom: "#212121" }), pal: ["#efe6d2", "#6d4c41", "#1a237e"],
        hi: ["You're looking for something. Everyone's looking for something. Top shelf.", "We have every book. Finding it is a separate service.", "The ladder rolls. Hold on. Everybody forgets to hold on."],
        act: { label: "🪜 Ride the ladder to the top shelf", lines: ["*whoosh* — she rolls the whole length of the shop and stops at exactly the wrong book.", "Top shelf: a book called 'How To Find A Book'. It was on the bottom shelf all along.", "She rolls, she reaches, she sneezes. A cloud of dust that remembers 1974."] },
        hours: "0-4 7-24; 5 7-13", shut: "CLOSED — Reb Zalman is reading. Do not disturb." },
    "THE GEFILTE STATION": { emoji: "🐟", who: P(WOMAN, "Mrs. Fisch", { Top: "#00838f", Bottom: "#37474f" }), pal: ["#e0f2f1", "#90a4ae", "#00695c"],
        hi: ["Fresh! Fresh today. Fresh-ish yesterday.", "Sweet or peppered? Choose carefully. Families have split over less.", "It's not a fish, darling. It's a TRADITION."],
        act: { label: "🍢 A taste on a toothpick", lines: ["Sweet. Polish-style. Mrs. Fisch nods like she's just learned something about your family.", "Peppered. Litvish. Mrs. Fisch looks at you with new respect and some concern.", "Both at once. Mrs. Fisch has to sit down for a minute."] },
        hours: "0-4 6-18; 5 6-13", shut: "GONE FISHING (back tomorrow, 8 am)" },
    "GLATT-ITUDE BUTCHER": { emoji: "🥩", who: P(MAN, "Yidel", { Top: "#ffffff", Bottom: "#b71c1c" }), pal: ["#fafafa", "#b0bec5", "#c62828"],
        hi: ["We take our meat seriously. The jokes, less.", "Brisket for Shabbos? Get in line. The line has a line.", "Number 12! …12? Anyone? 12 went home in 2019."],
        act: { label: "🎫 Take a number", lines: ["You're number 84. They're on 12. A man hands you a folding chair.", "Number 85. The man behind you is 86 and has been here since Pesach.", "Number 37. Oh — that's City Hall's machine. Different line."] },
        hours: "0-4 7-19; 5 7-13", shut: "CLOSED — Yidel's at the shechita. Back tomorrow." },
    "WIG OUT SHEITELS": { emoji: "💇‍♀️", who: P(WOMAN, "Chavi", { Top: "#ad1457", Bottom: "#212121" }), pal: ["#fce4ec", "#f8bbd0", "#880e4f"],
        hi: ["Appointment? No? I'll squeeze you in. In March.", "This one's human hair. That one's MORE human hair.", "Nobody will know it's a sheitel. Everybody will know it's a sheitel."],
        act: { label: "🪞 Try one on in the mirror", lines: ["The mirror shows Lulu with a very serious bob. She looks like she runs a PTA. She looks AMAZING.", "Long and wavy. Chavi says 'gorgeous'. Chavi says that to the mannequins too.", "A bouncy one. She bounces. It bounces later. Chavi takes it back gently."] },
        hours: "0-4 11-17", shut: "BY APPOINTMENT ONLY (Fridays: prayers only)" },
    "RUGELACH RUSH": { emoji: "🥐", who: P(WOMAN, "Bracha", { Top: "#6d4c41", Bottom: "#3e2723" }), pal: ["#fff8e1", "#a1887f", "#e65100"],
        hi: ["Chocolate or cinnamon? Wrong. Both.", "By the pound! Gone by noon! Today we're gone by eleven.", "Fresh out of the oven. Careful, the line bites."],
        act: { label: "🥐 A bag of rugelach — 5 coins", cost: 5, lines: ["A warm paper bag. It's empty by the door. She has no memory of eating them.", "Chocolate ones. She saves one for Ima. She eats it at the corner.", "Cinnamon ones. The bag says 'serves 6'. The bag is lying."] },
        hours: "0-4 6.5-12; 5 6.5-11", shut: "SOLD OUT — come back tomorrow, 6:30 am, bring a friend" },
    "KUGEL KINGDOM": { emoji: "👑", who: P(WOMAN, "the Kugel Queen", { Top: "#6a1b9a", Bottom: "#4a148c" }), pal: ["#f3e5f5", "#ffcc80", "#6a1b9a"],
        hi: ["Bow before the lokshen. Or don't. It's a free country. Mostly.", "Long live the kugel! Which kugel? ALL OF THEM.", "My throne is a step stool. Do not tell the other queens."],
        act: { label: "🥔 Lokshen or potato?", lines: ["Lokshen. The Queen knights her with a spatula. Sir Lulu of the Sweet Noodle.", "Potato. The Queen nods gravely. 'A traditionalist. The realm needs you.'", "'Yerushalmi,' she says. The Queen gasps. The court gasps. Someone drops a pan."] },
        hours: "0-4 7-24; 5 7-14", shut: "THE KINGDOM IS CLOSED — the Queen is baking" },
    "CHOLENT & CHILL": { emoji: "🍲", who: P(MAN, "Heshy B.", { Top: "#4e342e", Bottom: "#263238" }), pal: ["#3e2723", "#5d4037", "#ffb300"],
        hi: ["Thursday night, the cholent's ready. Don't ask how. It's been ready since Tuesday.", "Sit. Eat. Talk about nothing. That's the whole business plan.", "Beans? Barley? A kishke the size of a toddler? We got it."],
        act: { label: "🪑 Sit at the counter with a bowl", lines: ["A bowl the size of a hubcap. Three yeshiva guys at the counter debate if kishke is a vegetable.", "She sits. She eats. She's not hungry anymore. She may never be hungry again.", "Someone starts a niggun. The whole counter joins. The cholent hums along."] },
        hours: "4 19-26", shut: "OPEN THURSDAY NIGHT TILL IT'S GONE (it's not Thursday)" },
    "ERE-V SHABBOS SALE": { emoji: "🏷️", who: P(MAN, "Mottel", { Top: "#fdd835", Bottom: "#37474f" }), pal: ["#fffde7", "#e0e0e0", "#f9a825"],
        hi: ["Everything must go by 3! Including me!", "Candles, napkins, a tablecloth with only one stain — EVERYTHING.", "Last-minute guests? I got forks. I got a folding table. I got a cousin."],
        act: { label: "🎁 The mystery-item table — 5 coins", cost: 5, lines: ["A mystery bag: 40 tealights and a single shoe horn. Mottel calls it 'a set'.", "A mystery bag: a challah cover that says MAZEL TOV ON YOUR BAR MITZVAH, FEIVEL.", "A mystery bag: one (1) napkin ring. 'They're sold separately,' Mottel says, proudly."] },
        hours: "5 8-15", shut: "SEE YOU FRIDAY (everything must go by 3)" },
    // ════ MIDWOOD — Avenue M ════
    "AVENUE M MARKET": { emoji: "🛒", who: P(MAN, "Sal at register 3", { Top: "#2e7d32", Bottom: "#1b5e20" }), pal: ["#f1f8e9", "#c5e1a5", "#2e7d32"],
        hi: ["Register 3 is open. Registers 1 and 2 have been 'closing' since lunch.", "Aisle 7? We don't have an aisle 7. We never had an aisle 7.", "The carts are older than you. Treat them with respect."],
        act: { label: "🛒 Push the cart with the wobbly wheel", lines: ["The cart goes left. She goes right. The cart wins.", "She pushes it down one aisle. It makes a sound like a seagull with opinions.", "The wheel spins on its own, like it's looking for its old family."] },
        hours: "0-4 6-24; 5 6-14; 6 21-24", shabbos: "motzei", shut: "CLOSED — Sal is counting the carts" },
    "SHMATTE SHACK": { emoji: "👕", who: P(WOMAN, "Mrs. Glick", { Top: "#00897b", Bottom: "#455a64" }), pal: ["#e0f7fa", "#80cbc4", "#00695c"],
        hi: ["Nine sizes! Zero in stock! What size?", "That one runs small. They all run small. Everything runs small now.", "Your mother bought here. Her mother bought here. Nobody has ever found the right size."],
        act: { label: "📏 Ask for your size", lines: ["'Let me check the back.' Mrs. Glick goes into the back. Somewhere, a clock ticks.", "'Let me check the back.' Ten minutes. She returns with a hat. 'This is what we have.'", "'Let me check the back.' The back has a back. It's backs all the way down."] },
        hours: "0-4 9-20; 5 9-13", shut: "CLOSED — checking the back" },
    "FLOWERS BY FRIDAY": { emoji: "💐", who: P(WOMAN, "Yehudis", { Top: "#e91e63", Bottom: "#2e7d32" }), pal: ["#fce4ec", "#a5d6a7", "#c2185b"],
        hi: ["Flowers for Shabbos? Thursday, sweetie. Friday we're out.", "Roses are red. Lilies are white. The prices are… seasonal.", "For your mother? I'll make it nicer. I can tell she deserves it."],
        act: { label: "💐 A bouquet — 5 coins", cost: 5, lines: ["A bunch of white lilies. Ima is going to cry. Ima cries at lilies.", "Yellow roses. Yehudis wraps them like they're going to a wedding.", "The last bunch. Slightly wilted. 'Character,' says Yehudis."] },
        hours: "3-4 9-19; 5 7-13", shut: "SOLD OUT BY THURSDAY (open Wed–Fri)" },
    "OPTICAL ILLUSIONS": { emoji: "👓", who: P(MAN, "Dr. Ayin", { Top: "#ffffff", Bottom: "#1565c0" }), pal: ["#e3f2fd", "#bbdefb", "#1565c0"],
        hi: ["Can you read the bottom line? Neither can I. That's why I'm in this business.", "Frames, lenses, regrets. We do all three.", "Look at the dot. Now look at me. Now look at the price tag. Now look at the dot again."],
        act: { label: "👁️ Take the eye test", lines: ["The chart's bottom line says: 'IF YOU CAN READ THIS YOU'RE STANDING TOO CLOSE'.", "E. F P. T O Z. L P E D. …PIZZA? 'Close enough,' says Dr. Ayin.", "Better one, or two? One. Or two? Two. Or one? She doesn't know anymore. Nobody knows."] },
        hours: "0-4 9-19", shut: "CLOSED — we can see you're disappointed" },
    // ════ MIDWOOD — Kings Highway ════
    "99¢ & UP": { emoji: "🦆", who: P(MAN, "Benny", { Top: "#c62828", Bottom: "#263238" }), pal: ["#ffebee", "#ef9a9a", "#c62828"],
        hi: ["Everything ninety-nine cents! And up! Mostly up!", "That? A dollar forty-nine. The sign says 'and up'. This is the up.", "We have it. Whatever it is. Somewhere. Behind the other thing."],
        act: { label: "🦆 A rubber duck — 5 coins", cost: 5, lines: ["A rubber duck in a tiny black hat. It squeaks in a Litvish accent.", "A rubber duck. Benny says it's 'imported'. It says MADE IN THIS STORE on the bottom.", "Two rubber ducks stuck together. 'A set,' says Benny. 'For the price of one. And up.'"] },
        hours: "0-4 0-24; 5 0-14; 6 20.5-24", shabbos: "motzei", shut: "CLOSED (also 99¢ and up)" },
    "FIX-A-PHONE": { emoji: "📱", who: P(MAN, "Moishe", { Top: "#212121", Bottom: "#424242" }), pal: ["#eceff1", "#90a4ae", "#212121"],
        hi: ["Screens, cases, we don't ask. Don't ask.", "How did it crack? Don't tell me. I said don't ask. …Okay, tell me.", "Twenty minutes. Moishe minutes. Could be an hour."],
        act: { label: "📱 Get her screen fixed", lines: ["Moishe fixes it in four seconds with a hairdryer. He charges a story instead of money.", "'Who did this?' 'I dropped it.' 'From where?' 'The highway.' Moishe nods. He's seen worse.", "He hands it back. It's the same phone. It's better somehow. Don't ask."] },
        hours: "0-4 8-24; 5 8-14; 6 20.5-24", shabbos: "motzei", shut: "CLOSED — Moishe is fixing his own phone" },
    "SUSHI SHMUSHI": { emoji: "🍣", who: P(MAN, "Chef Kenji-Yankel", { Top: "#ffffff", Bottom: "#212121" }), pal: ["#212121", "#4e342e", "#d32f2f"],
        hi: ["Kosher sushi. The fish is glatt. The rice is mehadrin. The wasabi is a warning.", "Motzei Shabbos? This place is a MADHOUSE. Today it's quiet. Enjoy.", "We have a roll named after the rabbi. He's never tried it."],
        act: { label: "🍣 A taste of the 'glatt California'", lines: ["Imitation crab. In a kosher place it's an imitation of an imitation. It's delicious.", "Sweet potato tempura roll. A classic. Like a kugel that went to Japan.", "A dab of wasabi. A big dab. She can see through time for a second."] },
        hours: "0-4 12-24; 5 11-14; 6 20.5-25", shabbos: "motzei", shut: "CLOSED — Motzei Shabbos: we open 40 minutes after havdala" },
    "DISCOUNT KINGDOM": { emoji: "🏷️", who: P(WOMAN, "Mrs. Rosen", { Top: "#ffb300", Bottom: "#5d4037" }), pal: ["#fff3e0", "#ffcc80", "#e65100"],
        hi: ["Nothing is discounted. It's the NAME. It's branding.", "That's twenty off! Off of what? Off of more.", "Everything you see, we have in another colour. In the warehouse. Which is my sister's garage."],
        act: { label: "🔍 Browse the 'deals'", lines: ["A sign: 50% OFF. Underneath, a smaller sign: OF NOTHING.", "A toaster, a tallis bag, a lamp shaped like a fish. All the same price somehow.", "A price tag higher than the one at Avenue M Market. On the same thing. Proudly."] },
        hours: "0-4 10-20; 5 10-14", shut: "CLOSED — today's discount: 100%" },
    "GREENGROCER GARY": { emoji: "🥑", who: P(MAN, "Gary", { Top: "#558b2f", Bottom: "#33691e" }), pal: ["#f1f8e9", "#aed581", "#33691e"],
        hi: ["The fruit is fresh. The attitude, ALSO fresh.", "Don't squeeze the avocados. …I SAW that.", "Watermelon? It's November. I have one. It's very expensive and very confused."],
        act: { label: "🥑 Squeeze an avocado", lines: ["She squeezes one. 'HEY!' says Gary, from across the store, with his back turned.", "Ripe. Perfect. She puts it back. Gary sighs like a man betrayed.", "It's a rock. 'Thursday,' says Gary. 'It'll be perfect Thursday. Everything is perfect Thursday.'"] },
        hours: "0-4 6-22; 5 6-15", shut: "CLOSED — Gary is at the market (arguing with tomatoes)" },
    // ════ MIDWOOD — the NEW ones (the copies' fronts) ════
    "PICKLE PARADISE": { list: "avej", sign: ["PICKLE PARADISE", "sour · half-sour · emotionally sour"], emoji: "🥒", who: P(MAN, "Pinny", { Top: "#33691e", Bottom: "#1b5e20" }), pal: ["#f1f8e9", "#7cb342", "#1b5e20"],
        hi: ["Full sour builds character. Half sour builds half a character.", "These barrels are from the Lower East Side. 1951. Don't touch the green one.", "A pickle a day. Doctors hate this one trick. Mostly because of the salt."],
        act: { label: "🥒 Reach into the barrel", lines: ["Full sour. Her whole face folds in half. Pinny applauds.", "Half sour. Crunchy, bright, polite. 'A beginner,' says Pinny, warmly.", "A pickled tomato. Nobody has ever ordered the pickled tomato. Pinny is so happy he cries."] },
        hours: "0-4 0-24; 5 0-14; 6 21-24", shut: "CLOSED — even pickles keep Shabbos" },
    "MAZEL TOV BALLOONS": { list: "avej", sign: ["MAZEL TOV BALLOONS", "helium · mylar · regret"], emoji: "🎈", who: P(WOMAN, "Sury", { Top: "#29b6f6", Bottom: "#5c6bc0" }), pal: ["#e1f5fe", "#f48fb1", "#0277bd"],
        hi: ["Upsherin? Bar mitzvah? Third cousin got engaged? We have a balloon.", "Every balloon says MAZEL TOV. We don't do sad. We only do mazel tov.", "Careful with the helium. Last week Yitzy sang a whole Lecha Dodi like a chipmunk."],
        act: { label: "🎈 Take a sniff of helium", lines: ["'Mazel tov!' she says, like a cartoon mouse. Sury laughs so hard she drops eleven balloons.", "She tries to say something serious. It comes out like a kazoo. The balloons approve.", "Sury hands her a balloon that says MAZEL TOV ON YOUR NEW TOOTH. She doesn't have a new tooth. She takes it anyway."] },
        hours: "0-4 7-24; 5 7-13", shut: "CLOSED — every balloon is at a vort" },
    "SOLE SURVIVOR SHOE REPAIR": { list: "avej", sign: ["SOLE SURVIVOR SHOE REPAIR", "since 1950 · heels while you wait"], emoji: "👞", who: P(MAN, "Old Mr. Katz", { Top: "#795548", Bottom: "#4e342e" }), pal: ["#efebe9", "#8d6e63", "#4e342e"],
        hi: ["Seventy years I fix shoes. They don't make them like they used to. They make them like THIS.", "Leave them, come back Tuesday. Which Tuesday? A Tuesday.", "I resoled the shoes of a man who walked to Lakewood. Twice. He said it was faster than the Parkway."],
        act: { label: "👟 Let him look at her sneakers", lines: ["He looks. He sighs. He says 'nu' in a way that contains a whole novel.", "He taps the heel. 'You drive too much.' How did he — 'I KNOW shoes.'", "He hands back the sneaker and a peppermint. The peppermint is from 1983. It's still good."] },
        hours: "0-4 6-17; 5 6-12", shut: "CLOSED — at the shoemaker's (yes, he has one)" },
    "THE ONE SOCK LAUNDROMAT": { list: "avem", sign: ["THE ONE SOCK LAUNDROMAT", "we lose one. it's policy."], emoji: "🧦", who: P(WOMAN, "Dvora", { Top: "#90caf9", Bottom: "#455a64" }), pal: ["#e3f2fd", "#b0bec5", "#0277bd"],
        hi: ["Wash, dry, fold, and one sock goes to a better place.", "Machine four is haunted. It only does whites. Gently.", "The lost-and-found has eleven thousand socks. None of them match. None of them ever will."],
        act: { label: "🧦 Look in the lost-and-found", lines: ["Eleven thousand socks. One of them is hers. From 2019. She doesn't take it. It's happy here.", "A sock with a little embroidered Magen David. A sock with a dinosaur. A sock with a SECOND sock inside it.", "One glove. One mitten. One oven mitt. Dvora: 'We're branching out.'"] },
        hours: "0-4 0-24; 5 0-14; 6 20-24", shabbos: "motzei", shut: "CLOSED — the dryers are resting" },
    "PERL'S PARTY PLATTERS": { list: "avem", sign: ["PERL'S PARTY PLATTERS", "serves 12 · feeds 40"], emoji: "🥗", who: P(WOMAN, "Perl", { Top: "#ef6c00", Bottom: "#4e342e" }), pal: ["#fff3e0", "#ffcc80", "#e65100"],
        hi: ["A platter for a bris, a vort, a 'we're just having a few people over'. Same platter.", "It says serves 12. It's never served 12. It's served 40 and a neighbour.", "Fruit, fish, dips, a pineapple carved like a swan. The swan is extra."],
        act: { label: "🦢 Admire the pineapple swan", lines: ["The pineapple swan looks at her with dignity. Perl carved it in four minutes. She is a genius.", "'Can I order one?' 'You can't afford the swan,' Perl says kindly. 'Nobody can afford the swan.'", "Perl gives her a taste of the egg salad. It's the best egg salad in Brooklyn and Perl knows it."] },
        hours: "0-4 6-20; 5 6-13", shut: "CLOSED — catering a vort (they're always catering a vort)" },
    "TUTOR TOWN": { list: "avem", sign: ["TUTOR TOWN", "Gemara · SAT · parallel parking"], emoji: "📝", who: P(MAN, "Rabbi Doctor Stern", { Top: "#1a237e", Bottom: "#212121" }), pal: ["#e8eaf6", "#9fa8da", "#1a237e"],
        hi: ["We tutor everything. Gemara, chemistry, how to talk to your mother-in-law.", "Our parallel parking course has a 4% pass rate. In Brooklyn that's very high.", "The SAT? Easy. Finding parking for the SAT? That we can't teach."],
        act: { label: "🚗 A free parallel-parking lesson", lines: ["He draws a diagram: two cars, a spot, and an arrow labelled 'PRAY'.", "'Mirror, signal, cut the wheel, and when in doubt — hazards.' He says this like a law of physics.", "'The secret,' he whispers, 'is to wait for someone to leave. Since 1962, nobody has.'"] },
        hours: "0-4 15-24", shut: "CLOSED — tutoring starts after school (3 pm) and runs till the SAT is over" },
    "THE NOSH PIT": { list: "kh", sign: ["THE NOSH PIT", "snacks · nosh · more nosh"], emoji: "🍿", who: P(KID, "Yanky (Benny's nephew)", { Top: "#ff7043", Bottom: "#37474f" }), pal: ["#fff3e0", "#ffab91", "#d84315"],
        hi: ["Bissli! Bamba! A chocolate bar from a country you've never heard of!", "My uncle says I'm in charge. I'm eleven. I'm VERY in charge.", "We have the sour sticks. You know the ones. The ones that hurt."],
        act: { label: "🥜 Try the bamba", lines: ["Peanut puffs. She's four years old again. Yanky nods: 'Classic.'", "A sour stick. Her face does a thing. Yanky writes it down in a notebook titled 'FACES'.", "A chocolate bar in Hebrew. She can't read it. It's delicious in every language."] },
        hours: "0-4 7-22; 5 7-14", shut: "CLOSED — Yanky's at school (he's very upset about it)" },
    "MR. KEY": { list: "kh", sign: ["MR. KEY", "keys cut · locks fixed · no questions"], emoji: "🔑", who: P(MAN, "Mr. Key", { Top: "#78909c", Bottom: "#37474f" }), pal: ["#eceff1", "#b0bec5", "#37474f"],
        hi: ["Keys cut while you wait. Locks fixed while you wait. Waiting while you wait.", "Locked out? I'll be there in five minutes. Brooklyn minutes. Bring a book.", "Every key in Midwood, I made. Except the one to the parking spots. Nobody has that one."],
        act: { label: "🔑 Watch him cut a key", lines: ["Sparks fly. The machine screams. He hands her a key. 'To what?' 'To possibility.'", "He cuts a key without looking. He doesn't even have a key to copy. It works on something somewhere.", "'This key opens the shul's kitchen,' he says. 'Don't tell the gabbai. He thinks it's magic.'"] },
        hours: "0-4 0-24; 5 0-13; 6 21-24", shut: "BACK IN 5 MIN (locked himself out)" },
    "HAT BOX": { list: "kh", sign: ["HAT BOX", "black · black · navy (bold)"], emoji: "🎩", who: P(MAN, "Mr. Borsalino-Grossman", { Top: "#212121", Bottom: "#212121" }), pal: ["#212121", "#424242", "#e0e0e0"],
        hi: ["We have black. We have black. For the adventurous, a darker black.", "The navy one? Only for the brave. We sold one in 2004. People still talk.", "Brim width is a personal decision. And a family decision. And sometimes a community decision."],
        act: { label: "🎩 Look at the wall of hats", lines: ["Four hundred black hats on a wall. They are all different. He can tell. She cannot.", "He measures her head with a tape. 'Fifty-six. Like my grandfather. Good head.'", "One hat on the wall is navy. It's behind glass. It has a small sign: 'NOT FOR SALE (TOO MUCH)'."] },
        hours: "0-4 10-19; 5 10-13", shut: "CLOSED — all hats at a wedding" },
    "TOY TOWN": { list: "kh", sign: ["TOY TOWN", "batteries not included. or sold."], emoji: "🧸", who: P(WOMAN, "Mrs. Pinter", { Top: "#ab47bc", Bottom: "#5c6bc0" }), pal: ["#f3e5f5", "#ce93d8", "#6a1b9a"],
        hi: ["Toys! Games! A plush challah that sings Shalom Aleichem!", "The batteries? Next door. Next door doesn't have them either.", "That's the last fidget spinner in Brooklyn. I'm not selling it. It's an heirloom now."],
        act: { label: "🧸 Squeeze the singing challah", lines: ["It sings Shalom Aleichem, slightly flat. A toddler in the corner sings along, slightly flatter.", "It sings the first line, then stops. 'It needs batteries,' says Mrs. Pinter. 'Nobody has batteries.'", "It sings. Mrs. Pinter sings. Lulu sings. The store is a small happy choir for six seconds."] },
        hours: "0-4 10-19; 5 10-13", shut: "CLOSED — the toys are having a sleepover" },
    // ════ MIDWOOD — Brooklyn Kollege (the landmark: its own door) ════
    "BROOKLYN KOLLEGE OF KNOWLEDGE": { landmark: "college", sign: ["BROOKLYN KOLLEGE OF KNOWLEDGE", "Est. when the clock was last right"], emoji: "🕓", who: P(WOMAN, "the Registrar", { Top: "#5d4037", Bottom: "#3e2723" }), pal: ["#efebe9", "#a1887f", "#4e342e"],
        hi: ["Registration is open. Registration is always open. Registration has never closed.", "Your transcript? We'll mail it. The mail here is also 4:07.", "Majors: Business, Accounting, Business Accounting, and Talking to the Registrar."],
        act: { label: "🕓 Ask what time it is", lines: ["'4:07,' says the Registrar. She doesn't look at the clock. She doesn't need to.", "'4:07.' 'Still?' 'Always.' The Registrar smiles like a woman who's made peace with it.", "'It's 4:07,' she says, 'and also, enrolment closes at 4:08. You have one minute. You have always had one minute.'"] },
        hours: "0-4 8-22; 5 8-13", shut: "CLOSED — come back at 4:07" },

    // ════ LAKEWOOD ════
    "SEFORIM & MORE": { emoji: "📖", who: P(MAN, "Reb Nosson", { Top: "#263238", Bottom: "#212121" }), pal: ["#ece0c8", "#5d4037", "#263238"],
        hi: ["Seforim. And more. And more. We keep saying 'and more'. It's the brand.", "You want a sefer? Sure. You want a mug that says KOLLEL MOM? Also sure.", "Every chosson in Lakewood buys his gift here. Every kallah returns it here."],
        act: { label: "📚 Look at the shelf marked MORE", lines: ["The MORE shelf: a mezuzah case shaped like a minivan, a Shabbos clock, a cookbook called 'Kugel 2: The Revenge'.", "MORE: a tallis bag, a bag for the tallis bag, a bag for that bag.", "MORE: one (1) bobblehead of a rosh yeshiva. Reb Nosson: 'Don't ask. It sold out.'"] },
        hours: "0-4 8-24; 5 8-13", shut: "CLOSED (and more)" },
    "DISCOUNT EVERYTHING": { emoji: "🌀", who: P(WOMAN, "Tzippy", { Top: "#26a69a", Bottom: "#455a64" }), pal: ["#e0f2f1", "#80cbc4", "#00695c"],
        hi: ["Everything is discounted! Nothing is discounted! Both are true! It's Lakewood!", "We have a cousin store in Midwood. They say the same thing. They're wrong about it differently.", "The fidget spinners are shaped like minivans. They sell themselves. Literally — one rolled out the door."],
        act: { label: "🚐 A minivan fidget spinner — 5 coins", cost: 5, lines: ["A tiny minivan that spins. It has a tiny sliding door. It opens without warning, like a real one.", "She spins it. It spins for eleven minutes. Tzippy is impressed. 'That's a good one.'", "It comes with a tiny sticker: MY OTHER CAR IS ALSO A MINIVAN."] },
        hours: "0-4 0-24; 5 0-14; 6 20-24", shut: "CLOSED — Shabbos (even nothing-discounted needs a rest)" },
    "CARPOOL CAFÉ": { emoji: "☕", who: P(WOMAN, "Malky the barista", { Top: "#6d4c41", Bottom: "#3e2723" }), pal: ["#efebe9", "#a1887f", "#4e342e"],
        hi: ["We're open for carpool. Before it and after it. In between, we nap.", "A latte for the line. Every mother in this line is in a minivan. Every minivan is in this line.", "Cholov Yisroel oat milk? We have it. Don't ask how."],
        act: { label: "🪑 Sit with a coffee for the line", lines: ["She sits by the window and watches forty minivans move eleven feet. It's beautiful, in a way.", "A mother in the next seat is on three phone calls. She waves. She's lovely. She's also driving somehow.", "The coffee is excellent. The line outside moves one car. Everyone in the café cheers."] },
        hours: "0-4 6.5-9.5, 14.5-16.5; 5 6.5-12", shut: "CLOSED — open for carpool only (6:30–9:30, 2:30–4:30)" },
    "BAGEL BARN": { emoji: "🥯", who: P(MAN, "Shloimy", { Top: "#ffcc80", Bottom: "#5d4037" }), pal: ["#fff8e1", "#d7ccc8", "#e65100"],
        hi: ["Fresh at five-thirty. Gone at seven-fifteen. That's the business.", "Everything bagel? We have one. Somebody's eyeing it.", "Shacharis crowd is coming. Order fast. Order now. Order yesterday."],
        act: { label: "🥯 A bagel — 5 coins", cost: 5, lines: ["An everything bagel, warm. She eats it in the doorway. It's still the best thing that happens today.", "A plain bagel with a schmear. Shloimy calls it 'a classic'. The man behind her calls it 'mine'.", "The last sesame. A man in a tallis looks at her with great sadness. She splits it with him."] },
        hours: "0-5 5.5-7.25", shut: "WE RAN OUT (open 5:30–7:15 am — come early)" },
    "THE SUKKAH STORE": { emoji: "🌿", who: P(MAN, "Feivel", { Top: "#2e7d32", Bottom: "#5d4037" }), pal: ["#f1f8e9", "#a5d6a7", "#33691e"],
        hi: ["Open all year! Somehow! Don't ask me how. I don't know how.", "A sukkah in July? It's called planning ahead. My wife calls it something else.", "Walls, s'chach, lights, a plastic fruit that looks too real. The fruit is a bestseller."],
        act: { label: "🍋 Get the sukkah pitch", lines: ["Feivel shows her a pop-up sukkah. It pops up. It keeps popping. It's in the parking lot now.", "'Ten-by-ten, with a window,' he whispers, like it's a secret. 'For the in-laws. They like to see out.'", "He sells her nothing. He's not sad. 'Come back in Elul,' he says. 'Everybody comes back in Elul.'"] },
        hours: "0-4 9-24; 5 9-13", shut: "CLOSED — Feivel is measuring someone's porch" },
    "SHMUEL'S HARDWARE": { emoji: "🔩", who: P(MAN, "Shmuel", { Top: "#8d6e63", Bottom: "#37474f" }), pal: ["#efebe9", "#bcaaa4", "#bf360c"],
        hi: ["Hardware and opinions. The opinions are free. The hardware is not.", "A screw? WHICH screw. There are four thousand screws. Tell me about the wall.", "You're building something? Don't. Hire someone. …I'll sell you the stuff anyway."],
        act: { label: "🔩 Ask for one screw", lines: ["She asks for one screw. Twenty minutes later she knows his views on drywall, the mayor, and his son-in-law.", "He gives her the screw. Free. 'For the lecture,' he says. 'The lecture was the price.'", "'What's it for?' 'A shelf.' Long silence. 'Bring me the shelf.'"] },
        hours: "0-4 8-13, 14-18; 5 8-12", shut: "CLOSED FOR LUNCH (1–2) AND OPINIONS" },
    "KUGEL KORNER": { emoji: "🥘", who: P(WOMAN, "Mrs. Lefkowitz", { Top: "#f57f17", Bottom: "#4e342e" }), pal: ["#fff8e1", "#ffcc80", "#bf360c"],
        hi: ["Friday morning, the kugel. Take a number. The number is 300.", "It's a lot of kugel. That's not a slogan. It's a warning.", "Potato, lokshen, Yerushalmi, broccoli — the broccoli is for the cousins from Monsey."],
        act: { label: "🎫 Join the Friday kugel line", lines: ["She takes number 301. The line wraps around the store, down the block, and back into the store.", "A woman in front of her is buying nine kugels. 'It's a small Shabbos,' she explains.", "Mrs. Lefkowitz slips her a corner piece. The crispy corner. She will think about it for a week."] },
        hours: "5 9-14", shut: "FRIDAYS ONLY (9–2) — it's a lot of kugel" },
    "SIMCHA SNAPS PHOTO": { list: "shops", sign: ["SIMCHA SNAPS PHOTO", "we photoshop the uncle in"], emoji: "📸", who: P(MAN, "Zevi", { Top: "#455a64", Bottom: "#212121" }), pal: ["#eceff1", "#90a4ae", "#263238"],
        hi: ["Weddings, bar mitzvahs, the family picture where everyone blinked.", "Uncle Shmuel missed the photo? Don't worry. He's in it now.", "We do passport photos too. Nobody has ever liked their passport photo. It's a law."],
        act: { label: "📸 Sit for a portrait", lines: ["Zevi takes the photo. He adds a sunset, a chandelier and two cousins she's never met.", "'Smile!' She smiles. 'Smile like it's a wedding!' She smiles harder. Zevi: 'Perfect. Slightly scary.'", "The photo shows her and, somehow, Uncle Shmuel. Nobody is sure who Uncle Shmuel is."] },
        hours: "0-4 10-24; 5 10-13", shut: "CLOSED — Zevi is at a wedding (all of them)" },
    "STROLLER SERVICE CENTER": { list: "shops", sign: ["STROLLER SERVICE CENTER", "tires rotated · cup holders installed"], emoji: "👶", who: P(MAN, "Avrumi", { Top: "#3949ab", Bottom: "#263238" }), pal: ["#e8eaf6", "#9fa8da", "#283593"],
        hi: ["Tune-ups, flats, a double-to-triple conversion. Very popular.", "That stroller has done 40,000 miles. Some of them on the highway. Don't ask.", "We install cup holders. Then cup holders for the cup holders."],
        act: { label: "🛞 Watch a stroller tune-up", lines: ["Avrumi rotates the wheels of a quadruple stroller like it's a pit stop at Le Mans.", "He installs a seventh cup holder on a stroller. The mother cries with joy.", "He test-drives a stroller down the aisle. It drifts. He's very good."] },
        hours: "0-4 6-19; 5 6-12", shut: "CLOSED — out on a stroller tow" },
    "SHMATA & SONS TAILOR": { list: "shops", sign: ["SHMATA & SONS TAILOR", "hems while you wait (a while)"], emoji: "🧵", who: P(MAN, "Mr. Shmata (the son)", { Top: "#6d4c41", Bottom: "#212121" }), pal: ["#efebe9", "#bcaaa4", "#3e2723"],
        hi: ["My father founded this store. His father founded the other store. I founded nothing. I hem.", "A hem, a button, a bekishe let out after Pesach — very common.", "Pins in my mouth means I'm listening. Pins in my hand means I'm judging."],
        act: { label: "🧵 Let him measure her for nothing in particular", lines: ["He measures her. 'You're perfect,' he says. 'Proportionally. Not as a person. As a person I don't know you.'", "He pins her sleeve. 'Too long.' 'I'm not buying anything.' 'Still too long.'", "He writes down her measurements 'for the file'. There is a whole file. For everyone. In Lakewood."] },
        hours: "0-4 7-21; 5 7-12", shut: "CLOSED — the son is at his father's store" },
};

/** Named shops that are NOT a one-joke room: their own state (the name stays on its one front). */
export const NAMED = {
    // saved for ci/carcare (after ci/cars): the four named Coney Island Ave shops + both Minivan Washes (the row's unnamed copies are ordinary fronts) (a wash, a body shop, tires, a muffler, a gas station)
    "MIDWOOD MINIVAN WASH": { state: "use", reserved: "carcare", shut: "BACK IN 5 — under a minivan" },
    "MINIVAN WASH": { state: "use", reserved: "carcare", shut: "BACK IN 5 — finding the Cheerios" },
    "BUMPER TO BUMPER BODY SHOP": { state: "use", reserved: "carcare", shut: "BACK IN 5 — under a Buick" },
    "TIRE-D OF IT TIRES": { state: "use", reserved: "carcare", shut: "BACK IN 5 — tire-d" },
    "CONEY ISLAND AVE MUFFLER": { state: "use", reserved: "carcare", shut: "BACK IN 5 (you'll hear us)" },
    "24 HR GAS & GOSSIP": { state: "use", reserved: "carcare", shut: "OPEN 24 HRS (the gossip; the gas is back in 5)" },
    // the never-open ones
    "SHEITEL SHACK": { state: "closed", shut: "WALK-INS: NEVER — next appointment: 2031" },
    "KINGS HWY SAVINGS BANK": { state: "soon", sign: ["KINGS HWY SAVINGS BANK", "NOW A PHONE STORE — coming soon"] },
};

/** COMING SOON's sign changes each real week (the same for every player and every papered front that week). */
export const SOON = [
    "a store", "a FOURTH sushi place", "something with a long line", "nobody knows. not even us.", "another bank (no)",
    "a pizza place (the other pizza place is furious)", "a shop that sells only lulavs (in March)", "a gym (for the minivans)",
    "your next favourite store", "a playground for adults (it's a bench)", "PARKING (just kidding)", "a store that's ALWAYS open (it's closed)",
];
/** The one long front kept for the bowling alley (another agent will build it): Midwood's Avenue M, the east end. */
export const BOWLING = { town: "midwood", list: "avem", x0: 95, x1: 165, z0: -40, z1: -30, sign: ["COMING SOON: EAST MIDWOOD LANES", "strike while the iron is hot"] };

/** The signs of the fronts that aren't a shop — a handful of textures shared by many fronts (the sign atlas is tight). */
export const FILL_SIGN = {
    midwood: {
        lease: ["FOR LEASE", "call Mendel Brick · Brick by Brick Realty"],
        office: ["ACCOUNTANT · LAWYER", "the accountant's lawyer · 2nd floor"],
        dentist: ["DENTIST UPSTAIRS", "walk-ins welcome (run-outs too)"],
        gone: ["CLOSED", "thank you for 43 years · the landlord says hi"],
    },
    lakewood: {
        lease: ["FOR LEASE", "ask about our minivan parking (there isn't any)"],
        office: ["ACCOUNTANT · KOLLEL OFFICE", "2nd floor · ring twice"],
        dentist: ["ORTHODONTIST UPSTAIRS", "every kid in Lakewood · by appointment"],
        gone: ["CLOSED", "moved to Toms River (it's a whole thing)"],
    },
};
/** What the copies become, in turn (after the street's new shops are placed). */
export const FILL_CYCLE = {
    midwood: ["lease", "soon", "office", "lease", "gone", "soon", "dentist", "lease", "soon", "office"],
    // (Lakewood has 7 copies: 4 FOR LEASE for ci/playershops — 3 shops a player there — spread along Main Street)
    lakewood: ["lease", "soon", "lease", "office", "lease", "gone", "lease"],
};
/** The street directory boards: one per shopping street, by sign list (their titles). */
export const STREETS = {
    midwood: { avej: "AVENUE J", avem: "AVENUE M", kh: "KINGS HIGHWAY", cia: "CONEY ISLAND AVE" },
    lakewood: { shops: "MAIN STREET" },
};
/** Lines Lulu says at a door that won't open (the state's own). */
export const LULU_AT = {
    soon: ["Coming soon. It's been 'coming soon' since I had braces.", "Papered windows. Somebody's building something. Or hiding something.", "The sign changed again. They're having fun with this."],
    lease: ["For lease. Somebody should open something here. …Somebody.", "An empty store. Room for anything. A pickle shop. Another pickle shop."],
    gone: ["Forty-three years. Then — closed. Midwood never forgets. Midwood never shuts up about it either.", "A thank-you note on the door. I'm not crying. It's the wind."],
    use: ["'Back in 5.' I've been here 6.", "Someone's under a car in there. I can see the shoes."],
    office: ["Offices upstairs. The stairs are behind a door that's always locked."],
    dentist: ["A dentist upstairs. I can hear the drill. I'm walking away now."],
};

const SMALL = new Set(["OF", "BY", "AND", "THE", "&", "A"]);
/** "AVENUE M MARKET" → "Avenue M Market" · "SHELF HELP SEFARIM" → "Shelf Help Sefarim" (small words lower, except first). */
export function titleCase(str) {
    return String(str || "").split(" ").map((w, i) => (i > 0 && SMALL.has(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase())).join(" ");
}
