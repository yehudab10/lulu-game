// features/homes — DATA: who lives where, what they say, and what every household item does to
// every kind of resident. Plain tables; house.js / index.js / crowd.js read them.

// ── the families (a door's family is a pure hash of town + house index: the same door, the same family, every run) ──
export const SURNAMES = ["Goldberg", "Friedman", "Klein", "Schwartz", "Rosen", "Weiss", "Katz", "Levy", "Gross", "Adler", "Berkowitz",
    "Feldman", "Horowitz", "Kaplan", "Lipschitz", "Mandelbaum", "Perlstein", "Rubin", "Shapiro", "Teitelbaum", "Wolf", "Zilberman",
    "Pinkus", "Blumenthal", "Hirsch", "Eisen", "Fishbein", "Gutman", "Kessler", "Lowinger"];
export const FIRST = { dad: ["Moishe", "Yanky", "Shloimy", "Duvid", "Chaim", "Ari", "Shmuel"], mom: ["Rivky", "Chani", "Malky", "Esty", "Suri", "Faigy", "Goldy"],
    bubbe: ["Bubbe Rochel", "Bubbe Hindy", "Bubbe Perel", "Bubbe Chaya"], boy: ["Yossi", "Mendy", "Shimmy", "Dovi", "Zevi"], girl: ["Tzippy", "Raizy", "Brochi", "Shaindy", "Leah"],
    baby: ["Baby Moishy", "Baby Ruchy", "the baby"], cat: ["Kugel", "Shmutz", "Latke", "Tzimmes"], dog: ["Cholent", "Gribbenes", "Pupik", "Knish"] };
/** Resident kinds: the model, how they see (range m, half-angle rad, speed of noticing), and how they react. */
export const KINDS = {
    bubbe: { key: "homesBubbe", emoji: "👵", see: 4.6, cone: 0.85, gain: 1.0, speed: 1.6, adult: true, caller: 3, fights: "pin", h: 1.5 },
    dad: { key: "homesDad", emoji: "🧔", see: 6.0, cone: 0.8, gain: 1.15, speed: 2.0, adult: true, caller: 1, h: 1.72 },
    mom: { key: "homesMom", emoji: "👩", see: 6.2, cone: 0.85, gain: 1.25, speed: 2.1, adult: true, caller: 2, h: 1.62 },
    boy: { key: "homesBoy", emoji: "👦", see: 5.4, cone: 0.95, gain: 1.1, speed: 2.4, fights: "nerf", h: 1.18 },
    girl: { key: "homesGirl", emoji: "👧", see: 5.4, cone: 0.95, gain: 1.2, speed: 2.4, fights: "pillow", h: 1.12 },
    baby: { key: "homesBaby", emoji: "👶", see: 3.4, cone: 1.2, gain: 0.9, speed: 0, giggles: true, h: 0.72 },
    cat: { key: "homesCat", emoji: "🐈", see: 3.6, cone: 1.3, gain: 0.8, speed: 2.6, animal: true, h: 0.5 },
    dog: { key: "homesDog", emoji: "🐕", see: 3.4, cone: Math.PI, gain: 1.3, speed: 2.8, animal: true, nose: true, h: 0.6 },
    // households + scenes (life.js / scenes.js): the same rigs, recoloured — `like` = whose lines they borrow
    zeidy: { key: "homesDad", like: "dad", emoji: "👴", see: 3.2, cone: 0.7, gain: 0.7, speed: 1.1, adult: true, caller: 4, h: 1.66,
        colors: { Top: "#FFFFFF", Bottom: "#263238", Shoes: "#212121", Hair: "#E0E0E0", Beard: "#F5F5F5" } },
    lady: { key: "homesBubbe", like: "bubbe", emoji: "👵", see: 4.2, cone: 0.85, gain: 0.9, speed: 1.4, adult: true, caller: 5, h: 1.5 },
    plumber: { key: "homesDad", like: "dad", emoji: "🔧", see: 4.2, cone: 0.8, gain: 0.85, speed: 1.8, adult: true, caller: 9, nocall: true, h: 1.72,
        colors: { Top: "#1565C0", Bottom: "#1565C0", Shoes: "#4E342E", Kippah: "#1565C0" } },
    guest: { key: "homesMom", like: "mom", emoji: "🙋‍♀️", see: 5, cone: 0.85, gain: 0.8, speed: 1.6, adult: true, caller: 9, nocall: true, crowd: true, h: 1.62 },
    guestM: { key: "homesDad", like: "dad", emoji: "🙋‍♂️", see: 5, cone: 0.85, gain: 0.8, speed: 1.6, adult: true, caller: 9, nocall: true, crowd: true, h: 1.72 },
};
/** homes_dad is modelled in a towel: a dressed one (a scene's dad, Zeidy, the plumber) says "tie" where the towel was. */
export const dressLine = (r, line) => (r && r.dressed !== false && /towel/i.test(line || "") && (r.kind === "dad" || r.K.like === "dad")
    ? String(line).replace(/a towel/gi, "my good tie").replace(/towel/gi, "tie") : line);
export const PEOPLE_MODELS = { homesBubbe: "homes_bubbe", homesDad: "homes_dad", homesMom: "homes_mom", homesBoy: "homes_boy", homesGirl: "homes_girl",
    homesBaby: "homes_baby", homesCat: "homes_cat", homesDog: "homes_dog" };

// ── the items ──
// fx: dizzy (stars) · wet (drips, sputter) · laugh · feathers (a pillow fight) · eat (distracted, eating) · blown (pushed back) ·
//     sneeze (a pepper cloud) · startle (a jump) · fooled (the disguise) — every effect is a cartoon: nobody is hurt.
export const ITEMS = {
    pan: { name: "frying pan", emoji: "🍳", prop: "Pan", verb: "BONK", fx: "dizzy", stun: 4.2, uses: 0, room: "kitchen", sfx: "bonk" },
    seltzer: { name: "seltzer bottle", emoji: "🍾", prop: "Seltzer", verb: "SPRITZ", fx: "wet", stun: 2.6, uses: 3, room: "kitchen", sfx: "spray" },
    chicken: { name: "rubber chicken", emoji: "🐔", prop: "RubberChicken", verb: "SQUEAK", fx: "laugh", stun: 3.2, uses: 0, room: "kids", sfx: "squeak" },
    pillow: { name: "pillow", emoji: "🛏️", prop: "Pillow", verb: "THWUMP", fx: "feathers", stun: 2.2, uses: 0, room: "living", sfx: "poof" },
    kugel: { name: "kugel", emoji: "🥘", prop: "Kugel", verb: "OFFER", fx: "eat", stun: 11, uses: 1, room: "dining", sfx: "nom" },
    blower: { name: "leaf blower", emoji: "🍂", prop: "LeafBlower", verb: "BLOW", fx: "blown", stun: 2.6, uses: 0, room: "living", sfx: "blower" },
    balloon: { name: "water balloon", emoji: "🎈", prop: "WaterBalloon", verb: "SPLOOSH", fx: "wet", stun: 3.0, uses: 1, room: "kids", sfx: "splash" },
    // her own (no pickup: from the ✋ menu next to someone)
    pepper: { name: "pepper spray", emoji: "🌶️", prop: "Pepper", verb: "SPRAY", fx: "sneeze", stun: 4.0, own: true, sfx: "spray" },
    horn: { name: "her horn", emoji: "📯", prop: "AirHorn", verb: "HONK", fx: "startle", stun: 1.8, own: true, sfx: "horn" },
    disguise: { name: "a disguise", emoji: "🥸", prop: "Disguise", verb: "DISGUISE", fx: "fooled", stun: 12, own: true, sfx: "poof" },
};
export const PICKUP_ORDER = ["pan", "seltzer", "chicken", "pillow", "kugel", "blower", "balloon"];
/** Pickups other features add (features/houseitems — ctx.homes.addPickup): [{ id, prop, surface, make() }] */
export const EXTRA = [];

// ── item × resident: a line from them, a quip from her (★ = they fight back) ──
// Every item has a line for every kind; `fx` overrides the item's default where the kind reacts differently.
export const REACT = {
    pan: {
        bubbe: { line: "BONG! ...I see Shabbos candles. Seven of them. 🕯️", lulu: "Sorry, Bubbe! It's NON-STICK!" },
        dad: { line: "OY— *clutches towel* — DON'T— LOOK— ⭐⭐", lulu: "I'm not looking! I'm BONKING!" },
        mom: { line: "That's my GOOD pan! The FLEISHIG one!! 💫", lulu: "...I'll kasher it. Promise." },
        boy: { line: "WHOA. Do it AGAIN! ...no wait, everything's spinning.", lulu: "Gentle bonk! Gentle!" },
        girl: { line: "I'm telling TATTY!! ...after the room stops spinning.", lulu: "A tiny one! A tap!" },
        baby: { fx: "laugh", line: "*BONG* ...BA! BA! AGAIN! 🤣", lulu: "...you LIKE that?!" },
        cat: { fx: "startle", line: "*MRRROWR* — up the curtains! 🙀", lulu: "I MISSED, I MISSED—" },
        dog: { fx: "startle", line: "*yelp* — hides under the Shabbos table 🐕", lulu: "Aww, no, I'm sorry, puppy!" },
    },
    seltzer: {
        bubbe: { line: "PFFSSHT! ...My SHEITEL! It's a SET sheitel!!", lulu: "Refreshing though, right?" },
        dad: { line: "I JUST got out of the shower!! 🚿", lulu: "So you're... rinsed?" },
        mom: { line: "On the LINEN?! It's for YOM TOV!", lulu: "Seltzer gets stains OUT. Ask anyone." },
        boy: { line: "HAHA— AAACK— it's in my NOSE—", lulu: "Bubbly! Like a party!" },
        girl: { line: "My HAIR! I had BRAIDS!", lulu: "Wet look's in this year." },
        baby: { fx: "laugh", line: "*sputters* ...giggles uncontrollably 💦", lulu: "Okay that was adorable." },
        cat: { line: "*HISSSS* — the cat leaves. Forever. Or till dinner.", lulu: "Cats hate seltzer. Noted." },
        dog: { fx: "laugh", line: "*tries to drink it out of the air* 🐕💦", lulu: "Good boy! ...good DRINKER." },
    },
    chicken: {
        bubbe: { line: "*SQUEAK* ...HAHAHA, oy, my HEART — again! 🤣", lulu: "Bubbe's got JOKES." },
        dad: { line: "Is that... Mendy's chicken?! *snort* — stop, I'm in a TOWEL—", lulu: "Classic comedy never dies." },
        mom: { line: "*tries not to laugh* ...I am VERY angry. *squeak* HAHA", lulu: "You're cracking!" },
        boy: { line: "MY CHICKEN!! ...it's FUNNIER when you do it. HAHA", lulu: "Squeak squeak, kiddo." },
        girl: { line: "EWW it's so silly HAHAHA", lulu: "The chicken has spoken." },
        baby: { line: "*shrieks with joy* 🐔🤣🤣", lulu: "Best audience in Lakewood." },
        cat: { fx: "startle", line: "*the cat attacks the chicken* 🐈⚔️🐔", lulu: "It's not REAL— oh you know." },
        dog: { fx: "eat", line: "*steals the chicken, runs a victory lap* 🐕🐔", lulu: "HEY! That was my WEAPON!" },
    },
    pillow: {
        bubbe: { fx: "dizzy", line: "*THWUMP* ...I'll get you, you NOODNIK!", lulu: "PILLOW FIGHT! PILLOW FIGHT!" },
        dad: { line: "*THWUMP* — PILLOW FIGHT?! ...one hand on the towel, ONE hand—", lulu: "Fair fight! Mostly." },
        mom: { line: "Feathers! EVERYWHERE! It's EREV SHABBOS!", lulu: "Downy! Like a cloud!" },
        boy: { fight: true, line: "PILLOW WAAAR!! ⚔️ *grabs one*", lulu: "Oh it's ON." },
        girl: { fight: true, line: "*THWUMPS back* HAH! Take THAT!", lulu: "Okay, OKAY, you win!" },
        baby: { fx: "laugh", line: "*buried in pillow* ...BA! 🤣", lulu: "A soft landing!" },
        cat: { fx: "eat", line: "*the cat claims the pillow. It is the cat's pillow now.* 😼", lulu: "...fair." },
        dog: { fx: "laugh", line: "*shakes the pillow to death. Feathers. Snow.* 🐕❄️", lulu: "RIP pillow." },
    },
    kugel: {
        bubbe: { line: "*a bite* ...Who made this? Too much pepper. *eats the whole corner*", lulu: "She's distracted! Go go go!" },
        dad: { line: "Is this the LOKSHEN?! *sits down, forgets everything*", lulu: "Works every time." },
        mom: { line: "Is that MY kugel? ...it's GOOD, actually. *keeps eating*", lulu: "Compliments to the chef. You." },
        boy: { line: "KUGEL!! *face-first* 🥘", lulu: "Chew, buddy, chew." },
        girl: { line: "I only like the CRISPY corners! *takes all four*", lulu: "Corner girl. Respect." },
        baby: { line: "*kugel EVERYWHERE. Mostly the hair.* 🥘👶", lulu: "Some got in the mouth!" },
        cat: { line: "*sniffs. Eats the raisins only.* 🐈", lulu: "A connoisseur." },
        dog: { line: "*the whole kugel. Gone. Best friends now.* 🐕💕", lulu: "You and me, Cholent. Forever." },
    },
    blower: {
        bubbe: { line: "WHOOOSH— my SNOOD!! I look like Einstein!! 🌪️", lulu: "Volume! Body! Gorgeous!" },
        dad: { line: "THE TOWEL— HOLDING THE TOWEL— WHOOOO—", lulu: "Hold on tight, Moishe!!" },
        mom: { line: "The CHALLAH COVER! It's on the CEILING FAN!", lulu: "Fall cleaning!" },
        boy: { line: "WHEEEE!! *skids across the floor on his socks* 🧦", lulu: "Socks on hardwood. Physics!" },
        girl: { line: "My hair's a TORNADO!! 🌪️", lulu: "Salon-quality blowout!" },
        baby: { fx: "laugh", line: "*cheeks flapping* BWAHAHAHA 🤣", lulu: "Wind tunnel baby!" },
        cat: { line: "*slides across the kitchen floor, outraged* 🐈💨", lulu: "Weeee, kitty!" },
        dog: { fx: "laugh", line: "*bites the air. Ears flapping. Best day ever.* 🐕💨", lulu: "Good boy! Windy boy!" },
    },
    balloon: {
        bubbe: { line: "SPLOOSH! ...I'm calling your MOTHER. I KNOW your mother.", lulu: "Everybody knows my mother." },
        dad: { line: "SPLOOSH! ...well. I was already wet.", lulu: "Efficient!" },
        mom: { line: "SPLOOSH! On the CARPET?! We just had it CLEANED!", lulu: "Steam clean! You're welcome!" },
        boy: { fight: true, line: "WATER WAR!! I have SIX MORE under my bed!", lulu: "...uh oh." },
        girl: { line: "SPLOOSH! ...MOMMYYY!! 😭 ...actually it's kind of fun", lulu: "Summer's early!" },
        baby: { fx: "laugh", line: "*splash* BA!! BATH!! 🛁", lulu: "Bath time, baby!" },
        cat: { line: "*SOAKED. Will remember this. Forever.* 🙀💦", lulu: "Sorry, sorry, SORRY—" },
        dog: { fx: "laugh", line: "*catches it in its mouth. POP. Delighted.* 🐕", lulu: "Did you just— okay." },
    },
    pepper: {
        bubbe: { line: "ACHOO! ...is that PAPRIKA?! For the CHOLENT?! ACHOO!", lulu: "Bless you! ...bless you!" },
        dad: { line: "AH— AH— ACHOO!! *the towel nearly goes* — CHOO!", lulu: "Gesundheit!!" },
        mom: { line: "*sneezing* I'm— ACHOO— calling— ACHOO—", lulu: "Shhh, rest your nose." },
        boy: { line: "ACHOO! Do it again, it's like a ROLLER COASTER for my nose!", lulu: "...weird kid." },
        girl: { line: "ACHOO! ...ACHOO! ...I sneeze in THREES. ACHOO!", lulu: "Good to know." },
        baby: { fx: "laugh", line: "*tiny sneeze* ...tch! *giggles* 🤧", lulu: "Cutest sneeze ever." },
        cat: { line: "*offended sneeze. Leaves the room with dignity.* 🐈", lulu: "Shabbat shalom to you too." },
        dog: { line: "*sneezes, rolls on the rug, sneezes* 🐕🤧", lulu: "Sorry, puppy nose!" },
    },
    horn: {
        bubbe: { line: "HONK! — *jumps a foot in the air* — is it the MOSHIACH?!", lulu: "...not yet, Bubbe." },
        dad: { line: "HONK!! *jumps* — WHO'S DOUBLE-PARKED?!", lulu: "Lakewood reflexes!" },
        mom: { line: "HONK! *drops the soup ladle* THE CARPOOL!! Is it MY day?!", lulu: "It's always somebody's day." },
        boy: { line: "HONK! Cool!! Can I try?! Can I— HONK!", lulu: "No! ...okay one." },
        girl: { line: "HONK! *hands over ears* TOO LOUD!", lulu: "Sorry, sweetie!" },
        baby: { fx: "laugh", line: "*HONK* ...BA!! HONK!! 🤣", lulu: "A car person. Like me." },
        cat: { line: "*vertical leap. Clings to the ceiling.* 🙀", lulu: "How is that even—" },
        dog: { line: "*HOOOWWLS along* AWOOOOO 🐕🎶", lulu: "Duet!!" },
    },
    disguise: {
        bubbe: { line: "Tante Rivka?! You came for Shabbos! Sit, SIT, I'll make a plate!", lulu: "*in a voice* Yes, dahlink, it's me." },
        dad: { line: "Oh! Rabbi... Feinstein? I'm— I'll get DRESSED—", lulu: "*deep voice* Take your time, my son." },
        mom: { line: "Oh! You must be from the SCHOOL! Is this about the tuition?!", lulu: "*fake mustache wobbles* ...yes." },
        boy: { line: "Zaidy?? ...Zaidy, your nose fell OFF.", lulu: "*panics* Allergies!" },
        girl: { line: "You're not my Tante. Tante has a REAL mustache.", lulu: "...rude, but fair." },
        baby: { fx: "laugh", line: "*grabs the fake nose. Keeps it.* 🤣", lulu: "That was a rental!" },
        cat: { fx: "startle", line: "*the cat is not fooled. The cat is never fooled.* 😾", lulu: "Shh. Our secret." },
        dog: { fx: "startle", line: "*sniffs. Knows EXACTLY who you are. Barks.* 🐕", lulu: "Traitor nose." },
    },
};

/** When a resident first SPOTS her (the "!") — one shocked line per kind (the second set: they REMEMBER her). */
export const SPOTTED = {
    bubbe: ["GEVALT!! A GONIF!! In my KITCHEN!!", "VUS?! WHO ARE YOU? Are you HUNGRY?!", "MOISHE! There's a GIRL in the HOUSE!"],
    dad: ["WHO— WHAT— DON'T LOOK, I'M IN A TOWEL!!", "RIVKY!! CALL THE SHOMRIM!! ...and hand me a ROBE!", "Is this... a home invasion or a COLLECTOR?!"],
    mom: ["AAAAH! Kids, BEHIND ME!", "Who LET you in?! ...was it YOSSI?!", "Do you have an APPOINTMENT?!"],
    boy: ["A BURGLAR!! ...COOL!!", "MOMMY! A ROBBER! Can I keep her?!", "I'm getting my BLASTER!"],
    girl: ["MOMMYYYYYYY!!!", "There's a LADY and she's SNEAKING!", "I'm TELLING!!"],
    baby: ["*points* BA! 👉", "*giggles at you*", "*waves a soggy cracker*"],
    cat: ["*HISSSSS* 🙀", "*arched back, tail like a bottle brush*", "*stares. Judges.*"],
    dog: ["WOOF WOOF WOOF WOOF!! 🐕", "*BARK BARK* — the whole house is awake now", "*growls... tail wagging though*"],
};
SPOTTED.zeidy = ["Eh? Who's there? ...Shprintza? Is that you? You got TALL.", "A GONIF! ...where are my glasses? I can't see the gonif!"];
SPOTTED.lady = ["A STRANGER! Hide the TILES!", "Gertie! There's a GIRL! ...is she single?"];
SPOTTED.plumber = ["Whoa! Who're you? ...not my business. I'm just the plumber."];
SPOTTED.guest = ["Oh! Hello! Are you the cousin from Monsey?"]; SPOTTED.guestM = ["Mazel tov! ...who are you?"];
export const SPOTTED_AGAIN = {
    bubbe: ["YOU AGAIN?! I'm hiding the KUGEL!", "The SELTZER girl! Moishe, get the ROLLING PIN!"],
    dad: ["NOT AGAIN! I JUST got a new towel!", "The SAME LADY! I'm calling. I'm CALLING!"],
    mom: ["I KNEW you'd be back! I changed the LOCKS!", "YOU! I told the WHOLE carpool about you!"],
    boy: ["SHE'S BACK!! Best day EVER!", "Remember me?! I've been PRACTICING!"],
    girl: ["MOMMY, IT'S HER AGAIN!!", "I drew you! You're on the FRIDGE! As a WARNING!"],
    baby: ["*recognizes you, claps* BA! 👏", "*waves*"],
    cat: ["*remembers. Hisses with history.* 🙀", "*the cat has been waiting for this*"],
    dog: ["*recognizes you, WAGS* (no help at all) 🐕", "WOOF! (it's a happy woof)"],
};
SPOTTED_AGAIN.zeidy = ["YOU again! The tall Shprintza!"];
/** The "?" — something's off. */
export const SUSPICIOUS = {
    bubbe: ["Moishe? Is that you?", "Who's there? Hello?", "I heard something... the mice again?"],
    dad: ["Kids? Is someone up?", "Hello...?", "Did someone leave the door open?"],
    mom: ["Yossi, is that you?! You should be ASLEEP!", "Hm?", "Who's in the kitchen?"],
    boy: ["Huh? Ghosts?!", "Who's there?", "Is it Eliyahu Hanavi?!"],
    girl: ["Hello? ...mommy?", "I heard something!", "Shimmy, stop being SPOOKY."],
    baby: ["*looks at you*", "Ba?"],
    cat: ["*ears up*", "*stares at the doorway*"],
    dog: ["*sniff sniff sniff*", "*low woof?*"],
};
SUSPICIOUS.zeidy = ["Eh? Who's walking? ...the mice again.", "Hm? *adjusts glasses* ...a coat rack. Probably."];
/** Fight-back lines (bubbe's rolling pin, the boy's blaster, the girl's pillow). */
export const FIGHT = {
    pin: ["OUT OF MY KITCHEN!! *swings the rolling pin*", "I've rolled ten thousand rugelach — I can roll YOU!", "TAKE A RUGELACH AND GO!!"],
    nerf: ["PEW PEW PEW!! 🔫", "FOAM JUSTICE!!", "I'm the SHOMRIM now!!"],
    pillow: ["THWUMP! HAH!", "PILLOW POWER!!", "You can't beat a GIRL in a pillow fight!"],
};
export const LULU_HIT = { pin: ["OW! Okay okay I'm GOING!", "Stars! I see STARS! 💫", "Bubbe's got an ARM!"], nerf: ["OW! ...it's FOAM. Still!", "Foam to the FOREHEAD!", "Rude, but well-aimed."],
    pillow: ["Fwump! Feathers in my MOUTH!", "Okay you WIN!"] };

/** Answering the door (a knock): who answers and how. */
export const KNOCK = {
    kvetch: [
        ["Do you know what TIME it is?! People are EATING!", "We don't BUY anything! We have a mezuzah, we GAVE already!", "*SLAM*"],
        ["If this is about the parking — that's NOT my minivan. It's my brother-in-law's.", "*SLAM*"],
        ["Are you collecting? For WHAT? ...I gave at the shul. TWICE.", "*SLAM*"],
    ],
    meal: [
        ["Oh! A guest! Come in, come in, we're just sitting down!", "You'll eat something. You're too THIN."],
        ["Lulu? Lulu BRUCK? Your Bubbe's friend? Come, there's soup!", "Sit, sit. Don't sit THERE, that's Zaidy's chair."],
    ],
    kid: [
        ["*a tiny face in the door* ...MOMMY! THERE'S A LADY!", "*nobody comes* ...you can come in. Mommy's on the PHONE."],
        ["Are you the babysitter? You're LATE.", "Come in! I'll show you my LEGO!"],
    ],
    nobody: [["*knock knock* ...nobody home. The lights are off.", "(…the window's open a crack, though.)"]],
    sleepy: [["*a light flicks on upstairs* ...do you KNOW what time it is? *the light flicks off*", "(...the window's open a crack, though.)"],
        ["*a muffled voice* ...if this is about the Shabbos clock, it's set. Good NIGHT.", "*silence*"]],
    again_bad: [["YOU!! The one from LAST TIME!", "I'm calling the Shomrim! I have them on SPEED DIAL!", "*SLAM*"],
        ["Oh no. Oh no no no. NOT the seltzer lady.", "*SLAM* *three locks click*"]],
    again_good: [["Lulu! You're back! Come in, come in, there's leftover kugel!", "You were such a nice guest last time."]],
};
export const LOCKED = ["🔒 Locked. Who LOCKS a door in Lakewood?!", "🔒 Locked. And a chain. Paranoid.", "🔒 Locked. Rude, honestly."];
export const UNLOCKED = ["🔓 Unlocked. Of COURSE it's unlocked.", "🔓 The door just... opens. Nobody locks anything here.", "🔓 Open. There's a note: 'BACK IN 5 — THE KEY IS UNDER THE MAT'."];
export const WINDOW_IN = ["*squeeze* ...ooh, the window's open a crack.", "*climbs in over a radiator* Elegant. Very elegant.", "*tumbles in onto a pile of laundry* ...SOFT landing."];
export const WINDOW_OUT = ["*dives out the window into the hydrangeas* 🌸", "*parkour!* ...into a bush. Nailed it.", "*rolls out over the sill* — tucks — LANDS! 🙌"];
export const DOOR_OUT = ["*strolls out the front door* Have a GOOD Shabbos!", "*backs out slowly, waving*", "*closes the door politely behind her*"];

/** Lulu talking to a calm resident (guest mode, or before they've noticed she's an intruder). */
export const TALK = {
    bubbe: ["You'll eat? You'll eat. Sit.", "In MY day we didn't break in. We KNOCKED. Like MENSCHEN.", "Are you married? I have a GRANDSON."],
    dad: ["I'm just— I'll go put something on.", "Did you see the game? ...the Daf Yomi siyum, I mean.", "Make yourself at home. Not THAT home."],
    mom: ["Shoes OFF, please, the carpet's new.", "Do you want a coffee? Seltzer? A COAT?", "The kids LOVE you. That's suspicious."],
    boy: ["Wanna see my Lego shul? It has a MECHITZA.", "Do you have a car? Is it FAST?", "My chicken squeaks. Wanna hear?"],
    girl: ["I'm making you a bracelet. It's PINK.", "Are you a princess? You look like a princess robber.", "My sister took my markers."],
    baby: ["*grabs your finger* BA.", "*offers you a slobbery cheerio*"],
    cat: ["*ignores you completely*", "*sits on your foot. You live here now.*"],
    dog: ["*rolls over for belly rubs*", "*brings you a slipper*"],
};

TALK.zeidy = ["When I was your age I walked to cheder. Uphill. In the SNOW.", "You know who I knew? Everybody. I knew EVERYBODY.", "Sit, sit. Have a sucking candy. They're from 1987. Still good."];
TALK.lady = ["Are you single? I have a NEPHEW.", "Two bam. ...oh, you're not playing."]; TALK.plumber = ["Don't flush. Whatever you do. DON'T FLUSH.", "I've seen things in pipes, kid. THINGS."];
TALK.guest = ["Mazel tov! Isn't it wonderful?", "Have you tried the cake? Try the CAKE."]; TALK.guestM = ["L'chaim!", "I knew them when they were THIS big."];
/** Loot: the couch (CAPPED: once per house per run, and a run cap across houses). */
export const COUCH = { min: 3, max: 8, runCap: 30 };
export const COUCH_LINES = ["*digs in the cushions* ...coins! And a LEGO. And a pacifier.", "*rummages* Ooh — coins! And three hundred cheerios.", "*finds coins under a cushion* (and somebody's tefillin bag — putting that BACK)"];
export const COUCH_EMPTY = ["*digs* ...just lint and a hair clip. Somebody beat you to it. (You. It was you.)", "*digs* ...crumbs. Only crumbs. From PESACH."];
export const COUCH_CAPPED = ["*digs* ...nothing. Every couch in town is cleaned out. Is that... on you?", "*digs* ...the cushion's empty. Lakewood's pockets are closed for today."];
export const SOUVENIRS = [
    { id: "globe", name: "a Lakewood snow globe", emoji: "🔮" }, { id: "drawing", name: "a kid's fridge drawing (it's you, as a robber)", emoji: "🖍️" },
    { id: "magnet", name: "a 'KOSHER KITCHEN' fridge magnet", emoji: "🧲" }, { id: "hat", name: "a black hat off the coat rack", emoji: "🎩" },
    { id: "spoon", name: "the cholent spoon", emoji: "🥄" }, { id: "napkin", name: "a bentcher from someone's wedding", emoji: "📘" },
];
export const CHOLENT = ["*a spoonful of cholent* ...it's been on since FRIDAY. It's PERFECT. ❤️ +1", "*eats the cholent straight from the pot* ...the kishke. THE KISHKE. ❤️ +1"];
/** Cholent hearts are capped per RUN across every house (≈200 doors must not be ≈200 hearts). */
export const CHOLENT_CAP = 3;
export const CHOLENT_FULL = ["*one more spoonful* ...okay. I'm FULL. Like, cholent-coma full. (No more hearts from cholent today.)", "*a tiny taste* ...I physically cannot. Four cholents is a LIFESTYLE."];
export const CHOLENT_NOT_YET = ["*lifts the lid* ...it's not even READY. It has to go all night. Still smells like heaven though.", "*peeks* Beans. Raw-ish beans. Tomorrow this will be GLORIOUS."];
export const WET_FLOOR = ["THE FLOOR!! I JUST WASHED IT!!", "FOOTPRINTS! On my FLOOR! On EREV SHABBOS!", "WHO is walking on my WET FLOOR?!", "Socks! SOCKS! Not SHOES!"];
export const CHOLENT_SEEN = ["THAT'S FOR SHABBOS!!", "Get your SPOON out of my CHOLENT!", "At least use a BOWL!"];

/** Consequences. */
export const CHARGE = "BURGLARY (BREAKING & ENTERING)";
export const CHARGE_EXTRA = { cholent: "STEALING CHOLENT", pan: "ASSAULT WITH A FRYING PAN", seltzer: "UNLAWFUL SPRITZING", balloon: "UNLAWFUL SPRITZING" };
export const CALL_MSG = n => `📞 THE ${(/(s|z|x|sh|ch)$/i.test(n) ? n + "es" : n + "s").toUpperCase()} CALLED IT IN`;
export const CALL_LINES = ["Hello, Shomrim? There's a GIRL in my HOUSE. She has a SELTZER.", "Yes, Lakewood police? I'd like to report a... a SPRITZING.",
    "Hello? Chaverim? ...no, I don't need a jump start, I need a BURGLAR REMOVED.", "Officer? She ate the KUGEL. ALL of it."];
/** Court: added to law's charge dialogue + defense at boot (law/data.js tables). */
export const COURT_DIALOGUE = { key: "BURGLARY", cop: ["Breaking and entering, Bruck! In a TOWEL district!", "The Goldbergs gave a full statement. And a kugel.", "A family of six, a cat and a very confused dog. All witnesses."],
    lulu: ["I KNOCKED! ...eventually.", "The door was OPEN! It's LAKEWOOD! Nobody locks!", "I was invited! By a five-year-old. That COUNTS."] };
export const COURT_DEFENSE = { key: "BURGLARY", arg: "my client entered the dwelling to RETURN a rubber chicken, and was overcome by the aroma of cholent. Who among us, your honor?" };

/** The knock outcome odds by town (nobody locks in Lakewood). */
export const TOWN_CFG = {
    lakewood: { unlocked: 0.72, knock: { kvetch: 0.3, meal: 0.32, kid: 0.25, nobody: 0.13 }, label: "Lakewood" },
    midwood: { unlocked: 0.38, knock: { kvetch: 0.42, meal: 0.24, kid: 0.2, nobody: 0.14 }, label: "Midwood" },
};

// ── the living town: what people say ──
export const PED = {
    wave: ["Good Shabbos!", "Hi!", "Gut voch!", "Hello, sheifele!", "Nice day!", "Hi Lulu!", "*waves*", "Shalom!"],
    gossip: ["Is that THE Lulu?!", "That's her! The one from the group chat!", "Don't look. DON'T LOOK. It's HER.", "I heard she broke into the {fam}' house!",
        "Lock your doors, Chani. It's Lulu.", "My cousin says she spritzes people.", "She's SHORTER than in the Kvetch."],
    scatter: ["AAAH!", "SLOW DOWN!!", "There are KIDS here!!", "Meshugene!!", "My STROLLER!!", "Who taught you to DRIVE?!"],
    honk: ["We HEAR you!", "It's a RESIDENTIAL street!", "Honking won't make the minivan move!", "SHHH! The baby's SLEEPING!", "Nice horn. Very LOUD.", "Gevalt, the NOISE!"],
    honkNu: ["Nu?!", "NU?! What?!", "Nu, so go already!", "Oy — my HEART!", "*jumps a foot in the air*"],          // (ci/life2)
    honkKid: ["BEEP BEEP! 👋", "Do it AGAIN!", "HONK AGAIN! HONK AGAIN!", "Hi Lulu!! 👋", "*waves with both arms*"],
    talk: ["Do you know the Friedmans? Lovely people. Their son's a lawyer.", "I'm walking to the bakery before the challah runs out.", "Watch the geese. They have no FEAR.",
        "You're new? You'll come for a meal.", "The parking? Don't get me STARTED.", "My husband's learning. I'm walking. It's a system.", "Carpool's in ten minutes. I'm LATE.",
        "Is that a PINK car? Nice. Very... visible."],
    lemonade: ["Lemonade! 25 cents! For tzedakah!", "It's REAL lemons! Mostly!", "Buy a cup! I'm saving for a SCOOTER!"],
    washer: ["Gotta shine it for Shabbos.", "Twelve kids, ONE minivan. Respect it.", "Don't touch the paint!"],
    reader: ["*turns a page*", "Hmph. The Kvetch says it'll rain.", "Did you see this? The PRICES."],
    rake: ["The leaves come back EVERY year. Every year!", "Raking for Sukkos... wait."],
    shovel: ["Snow on a Friday. Typical.", "Watch the ice, sheifele!"],
    hose: ["The tomatoes need it. Look at them.", "Careful — wet lawn!"],
    kids: ["You're IT!", "No fair!", "Throw it to ME!", "Can she play?!"],
    mail: ["Morning! Nothing but bills for you.", "Twenty-two Goldbergs on this route. TWENTY-TWO."],
};
export const CROWD = {
    lakewood: { walkers: 34, porches: 0.42, bikes: 3, mix: { man: 3, bochur: 4, woman: 3, pair: 3, stroller: 4, scooter: 3, dog: 3, mail: 1 },
        porchMix: { reader: 3, chatters: 3, family: 2, washer: 3, lemonade: 2, yard: 3, kids: 3 } },
    midwood: { walkers: 38, porches: 0.3, bikes: 5, mix: { man: 4, bochur: 3, woman: 4, pair: 3, stroller: 3, scooter: 2, dog: 3, mail: 1, shopper: 4 },
        porchMix: { reader: 4, chatters: 3, family: 2, washer: 1, lemonade: 1, yard: 2, kids: 3 } },
};
export const TOPS = ["#81C784", "#4FC3F7", "#FFB74D", "#F06292", "#9575CD", "#FFFFFF", "#4DB6AC", "#FFD54F", "#90A4AE", "#E57373", "#A1887F"];
export const BOTTOMS = ["#37474F", "#283593", "#212121", "#5D4037", "#1565C0", "#455A64", "#4A148C", "#263238"];
export const HAIRS = ["#3E2723", "#212121", "#5D4037", "#8D6E63", "#C49A6C", "#1B1B1B", "#795548"];
export const SHEITELS = ["#4E342E", "#3E2723", "#6D4C41", "#212121", "#8D6E63"];
