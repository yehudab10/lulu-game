// features/rides — every line of text (Teen-rated, the family's voice, Lulu's sass).

// ── 🚓 the cop car ──────────────────────────────────────────────────────
export const MEGAPHONE = [
    "PULL OVER… just kidding. Unless?",
    "THIS IS THE POLICE. Probably.",
    "Ma'am, your sheitel is crooked. Consider this a warning.",
    "STEP AWAY FROM THE KUGEL.",
    "Nobody move! …OK you can move, it's a road.",
    "Attention: Shabbos is in five hours. Act accordingly.",
    "You in the minivan! Nice minivan. Carry on.",
    "I am a REAL officer. I have a hat. Somewhere.",
    "Keep it moving, nothing to see here! (Except me. Look at me.)",
    "Uncle Moishe, if you can hear this — return Ima's Tupperware.",
    "Signal your turns, people! What are we, ANIMALS?",
];
export const SIREN_ON_COP = ["WEE-OOO! Move it, move it!", "Oh, I could get used to this.", "LAW coming through! (Allegedly.)",
    "Bubbe would be SO proud. Or horrified. One of those."];
export const SIREN_OFF = ["OK, OK, siren off. Nobody panic.", "Back to civilian life. Boring."];
export const NO_TARGET = "📣 No one to pull over — have a megaphone line instead!";
export const TICKET_BOOK_EMPTY = "🎫 Ticket book's empty. Even fake cops run out.";
export const SPIKES = ["Spike strip OUT! Enjoy your flat, officer!", "Oops, dropped something. Something POINTY.",
    "That's for the parking ticket in 2019!"];
export const SPIKES_EMPTY = "🛑 No more spike strips in the trunk!";
export const IMPERSONATE_COP = ["HEY! That's not one of OURS!", "Since when do we hire in PINK?!", "That's a stolen cruiser! GET HER!",
    "Badge number?! …She doesn't HAVE a badge number!"];
export const IMPERSONATE_LULU = ["Technically I never SAID I was a cop.", "It's called COMMUNITY policing!", "I was being HELPFUL!"];

// ── 🚑 the ambulance ────────────────────────────────────────────────────
export const SIREN_ON_AMB = ["Make way! It's an EMERGENCY! (Probably.)", "Move it! Somebody needs me!", "Wee-ooo! Doctor Lulu on the way!"];
export const DISPATCHER = "RIVKY (dispatch)";
export const DISPATCH = [
    "Man down on the shoulder — he says it's his back, his wife says it's the cholent.",
    "Lady fainted at a sample sale. The shoes are fine.",
    "Guy tried to clean his own gutters. The ladder won.",
    "Kid stuck a dreidel up his nose. A BIG one.",
    "Uncle fainted at a bris. At… the part.",
    "Bochur sprained his ankle dancing the hora. Alone. In a parking lot.",
    "Someone ate gas-station sushi. On purpose.",
    "Cyclist vs. pothole. The pothole's fine.",
];
export const PATIENT_IN = ["Oy, my BACK!", "Is this covered by insurance?", "Drive gentle, I just ate.", "Are you even a paramedic?!",
    "You're very young for an ambulance driver.", "Do you take Bubbe's insurance? It's a chicken soup plan."];
export const PATIENT_OW = ["OW! The BUMPS!", "Lady, I'm SICK, not cargo!", "My spleen! I felt that in my SPLEEN!", "Was that a pothole or a PERSON?!",
    "I was fine before you DROVE!"];
export const PATIENT_OUT = ["You saved my life! Also, you drive like a maniac.", "I'm telling my rabbi about you.",
    "Here — for the gas. And the trauma.", "Thank you! I'll never eat gas-station sushi again.", "You're an angel! A FAST angel."];
export const PATIENT_LATE = ["Forget it, I'll take a cab.", "I feel better. From the FEAR.", "I healed on my own. Out of spite."];
export const PATCH = ["Band-aid, lollipop, back in the game. 🩹", "Self-care! LITERALLY.", "I'm basically a doctor now. Ima will be thrilled.",
    "Gauze. Tape. Done. Insurance? Never heard of her."];
export const PATCH_FULL = "💪 You're FINE. Drama queen.";
export const PATCH_EMPTY = "🩹 The first-aid kit's empty — even Lulu can't fix that.";
export const ER_PERK = n => `🚑 The paramedics you helped chipped in on the bill: +${n} 💰`;

// ── 🍦 the ice-cream truck ──────────────────────────────────────────────
export const KIDS = ["RAINBOW SPRINKLES!", "Is it kosher?! …IT'S KOSHER!", "Two scoops! Ima said ONE but she's not HERE!",
    "Do you have pareve?", "BRAIN FREEZE!", "I'm paying in NICKELS!", "Chocolate! No, vanilla! No — BOTH!", "Can I pay with a sticker?"];
export const KID_LEFT = ["HEY! COME BACK!", "My ice cream!!", "NOOOO!"];
export const JINGLE_LULU = ["Who wants ice cream?! Exact change only!", "Pareve, milchig, sprinkles — Lulu's got it all!",
    "Ice cream! Get it before Bubbe sees!"];
export const SOLD_OUT = "🍦 Out of sprinkles here — drive on to find more kids!";
export const PULL_OVER_FIRST = "🍦 Pull over and stop first — kids don't chase moving trucks (their Imas said so).";

// ── 🚌 the bus ──────────────────────────────────────────────────────────
export const RIDERS = ["Does this go to Boro Park?", "Is the driver… a TEENAGER?", "I'll sit in the back. FAR back.",
    "Line 18? I've been waiting since PESACH!", "Exact change? I have a coupon.", "Is there Wi-Fi?"];
export const BUS_LULU = ["All aboard the Lulu Express!", "Please hold on. I mean it. HOLD ON.", "Next stop: wherever I feel like!"];

// ── 🚚 / 🏎️ / 🚕 ────────────────────────────────────────────────────────
export const AIRHORN = ["HONNNK! Out of the way, I'm hauling… whatever this is.", "Big horn energy.", "Make way for the BIG girl!"];
export const NITRO = ["Zoom zoom, Bubbe!", "This thing is ILLEGAL. Probably.", "Hold onto your sheitels!"];
export const TAXI_BONUS = n => `🚕 Real-taxi bonus: +${n} 💰`;
