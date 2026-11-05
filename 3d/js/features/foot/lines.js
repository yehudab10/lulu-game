// Every line of Lulu-on-foot + wedding dialogue, ported verbatim from the 2D
// game (src/08b-foot-world.js, src/08f-foot-wedding.js). Keep the voice.

export const FOOT_CHASE_TAUNTS = ["STOP! POLICE!", "You can't outrun the LAW!", "Get BACK here!",
    "I do CARDIO, Lulu!", "Freeze! ...okay, RUN then.", "I've got your SHEITEL on file!",
    "End of the line, missy!", "I skipped lunch for THIS!"];

export const FOOT_LULU_CHAT = ["Where do I get a CAR around here?", "Walking. In these flats. Great.",
    "Bubbe's gonna plotz.", "I need a RIDE.", "So many cars... none are MINE.",
    "Is everyone DRUNK today?", "I should've taken the bus.", "These men. Oy.",
    "A car. Any car. Please.", "Cardio counts as a mitzvah, right?"];
export const FOOT_STEAL_LINES = ["Borrowing this! 🚗", "Sorry, EMERGENCY!", "I'll bring it back!",
    "Don't mind if I DO!", "Grand theft... mitzvah?", "Keys were RIGHT there!", "Bubbe needs me!"];
export const FOOT_TALK_LULU = ["Hi! Have you seen a free car?", "Lovely weather for WALKING. ugh.",
    "Gut voch!", "You didn't see anything.", "Nice... whatever that is.", "Can I borrow your car? No? Rude.",
    "Do these flats say 'desperate'?", "I'm not lost, I'm... scenic.", "Got bus fare? A bus? A horse?"];
export const FOOT_PED_REPLY = ["Shalom! 👋", "...do I know you?", "Spare a nickel?", "Walk faster, lady!",
    "Nice day, eh?", "I'm late too!", "Mazel tov! ...for what? dunno.", "Cute bag!",
    "You dropped your... no? okay.", "I LOVE your energy!", "Gut Shabbos! ...it's Tuesday.", "Move along, dear."];
export const FOOT_DRUNK_REPLY = ["Heyyy GORGEOUS! 🍻", "Marry me — I have a CAR! 🚗", "*hiccup* helloooo",
    "You're an ANGEL 😇", "Niiice walk!", "Call me! ...somehow", "Need a LIFT? 😏",
    "Are you a parking ticket? 'Cause FINE.", "I named a SHOT after you!", "You're like my ex but TALLER"];
export const FOOT_PET_LINES = ["Awww! 🐾", "Who's a good boy?!", "So FLUFFY!", "Hi little guy!", "Shoo! ...no, stay!",
    "It LICKED me!", "You're coming HOME with me.", "Is this... a raccoon? Adorable.", "BOOP the snoot!"];
export const AVIGAIL_WALK_LINES = ["Power walk, mama! 💪", "Did you SEE his sheitel?", "We should get coffee.",
    "I'm telling EVERYONE about this.", "Your form is terrible — but cute.", "Two girls, no car, BIG energy!",
    "Should we just steal a convertible?", "My feet hurt ALREADY.", "This is so much cardio.",
    "Ooh, is that a SALON?", "Walk it off, queen. 👑", "I brought snacks. ...I ate them."];
export const FOOT_PARK_GAG = ["Parallel parking... MYSELF! 🅿️", "Excuse me — squeezing IN.",
    "Nailed it. Between two yentas.", "No ticket for THIS spot!", "I fit! ...barely.", "Perfect form, no car needed."];
export const FOOT_HAIL_OK = ["Thanks for the lift! 🚕", "You're a LIFESAVER!", "Bubbe's, and step on it!", "FINALLY, a ride!"];
export const FOOT_HAIL_NO = ["Rude!! 😤", "I had my hand UP!", "...off-duty, sure.", "Fine, I'll WALK. Again."];
export const FOOT_COP_PICKUP = ["🚓 Off the road, ma'am!", "🚓 You're coming with me.",
    "🚓 Pedestrian in traffic — IN you go.", "🚓 Let's chat at the station.",
    "🚓 Jaywalkin'? Cute. Get in.", "🚓 Bored. You'll do. Hop in."];
export const FOOT_HAIL_VEHICLE = { bus: "On a BUS now?! 🚌", ambulance: "WEE-OOO! 🚑", cop: "Driving a COP car?! 🚓", dozer: "He just... HANDED her the steamroller?! 🚜" };
export const FOOT_BUSK_LINES = ["💃 Spare a dime?", "Singin' for my SUPPER!", "Tips for a stranded girl?",
    "I take Venmo!", "ONE-woman band! 🎵", "🎵 Bubbe's on my MIIIND 🎵", "Watch me WERK!"];
export const FOOT_SELFIE_LINES = ["Say cheese, big guy! 🤳", "This is going VIRAL.", "Bubbe won't BELIEVE this!",
    "Filter? You're perfect.", "#Sasquatch #blessed", "Smile! ...do you HAVE teeth?"];
export const FOOT_HIGHFIVE = ["✋ YEAH!", "Up top!", "Nailed it!", "👊 respect", "Don't leave me hangin— oh!"];

// What Lulu mutters when her ride dies and she's stuck on foot.
export const FOOT_INTRO_LINES = {
    wreck: [
        "The car's a MEATBALL.\nTime to borrow one.",
        "Well. That's not buffing out.\nOn foot it is.",
        "RIP, little pink car. 🥀\nYou served me... okay.",
        "The engine went 'kaplooey.'\nThat's the medical term.",
        "Totaled. Bubbe is NOT\nhearing about this.",
        "It's not a car now,\nit's modern ART. Walking!",
        "Four wheels down to zero.\nGuess I'm hoofing it.",
        "She's taking a nap.\nA... permanent nap. 😴",
        "Smoke this color is\nNEVER a good sign.",
        "I'll walk it off. Literally.",
    ],
    copWalk: [
        "Impounded?! Fine. I'll WALK.\n...and find a new ride.",
        "They TOWED my baby!\nBorrowing the next one.",
        "No car, no problem.\n...okay, SOME problem.",
        "The lot wants $400.\nI want a NEW car. Free.",
    ],
    parkingCrash: [
        "That's coming out of\nmy deposit. On foot it is.",
        "I'll just... leave that there.\nWalking now! 🚶‍♀️",
        "Parking is HARD, okay?!\nUgh. Find another.",
    ],
    droveOff: [
        "Parked it. Stretching\nmy legs. 🚶‍♀️",
        "Bored of driving.\nLet's WALK a bit.",
        "Pulled over. Time to\nfind a BETTER ride.",
        "I'll leave it here.\nNobody'll notice. Probably.",
    ],
    // (3D-only: walking out of the jailbreak in the orange jumpsuit)
    jailbreak: [
        "Orange is NOT my color.\nTime to find a ride.",
        "Free! ...on foot. In THIS\noutfit. Keep moving.",
        "Act natural. Natural!\nNobody wears orange. Ugh.",
    ],
};

// leaving a building on foot (the 2D exit-a-building quips)
export const FOOT_EXIT_QUIPS = ["Walking it is. 🚶‍♀️", "No car? No problem.", "Free... and on foot. Ugh."];
export const FOOT_ARREST_PROTEST = ["I was just WALKING!", "This is HARASSMENT!", "...is it the flats?", "Bubbe will hear about THIS."];

export const AVIGAIL_BUSY = ["Can't, mami — date with my Aviel! 💕", "Aviel's taking me to the AQUARIUM!",
    "I'm so in love I can't walk STRAIGHT!", "Aviel called me his 'whole world' — GAH!",
    "We're picking a china pattern, BYE!", "Sorry, Aviel's double-parked!", "He texted 'wyd' — I gotta GO!",
    "Shidduch of the CENTURY, gotta run!", "Aviel learned to PARALLEL PARK for me 😭"];
export const LULU_AVIGAIL_BUSY = ["Ugh, get a ROOM. ...mazel tov tho.", "Third-wheeling? Hard pass.",
    "Tell Aviel I said... be normal.", "Young love. Gross. Adorable. Gross.", "Go, go! ...lucky.",
    "I'll just talk to this hydrant then.", "Everyone's got a ride but ME.", "He learned to PARK? ...show-off."];

export const FOOT_DOOR_NAME = { bar: "BAR", school: "SCHOOL", hospital: "CLINIC", police: "PRECINCT", beach: "BEACH" };

// ── the wedding ───────────────────────────────────────────────────────────
export const WED_BRIDE = [
    "Is my veil straight? IS IT? Somebody check!",
    "WHERE is my mother?! She had the ring— no, the TISSUES!",
    "I'm so happy I could plotz. Don't let me plotz.",
    "Twenty years of bubbe asking 'nu?' — TODAY, Bubbe. TODAY.",
    "If I trip on this gown I'm taking the photographer DOWN.",
    "Lulu! You came! Are you crying? Don't, you'll start ME.",
    "Did the caterer bring TWO briskets? Tell me TWO.",
    "My feet are KILLING me and I haven't even danced yet.",
    "Breathe, Avigail, breathe. ...okay that's enough breathing.",
    "I rehearsed this walk for a MONTH. Watch the legend work.",
    "Aviel looks like he's gonna faint. Same, honestly. SAME.",
    "Is it normal to want a nap at your own wedding?",
    "Somebody tell Tzippy her hat is blocking the WHOLE row.",
];
export const WED_CHOSSON = [
    "...is it too late to— no. No, I'm good. I'm GOOD.",
    "Why are 200 people LOOKING at me. Why. WHY.",
    "I memorized the vows. I forgot the vows. I— there they are.",
    "Is it hot under here or is that just my entire nervous system?",
    "Rabbi, can we do the short version? The SHORT version?",
    "I'm not sweating, YOU'RE— okay I'm sweating a LOT.",
    "She's GORGEOUS. I'm a schlub. How did I— mazel to ME.",
    "*shuckles intensely* davening that I don't drop the ring.",
    "One glass to stomp. One. I've been practicing on bubble wrap.",
    "If I pass out, tell everyone it was 'overcome with JOY.'",
    "Where do I put my HANDS? Why do I have so many hands?",
    "Don't lock knees, don't lock knees, don't lock kn—*sways*",
];
export const WED_GUEST = [
    "She was such a SWEET baby! I changed that punim's diapers!",
    "200 people and ONE brisket?! This is a SCANDAL.",
    "The band! TOO LOUD! ...play it again, it's gorgeous!",
    "Who's the maTCHmaker? I owe her a slap AND a thank-you.",
    "I gave them my GOOD blender. The GOOD one. Remember that.",
    "From the OTHER side they look even more in love. Kineahora!",
    "I'm not crying, I have a SIMCHA in my eye.",
    "Did you see the centerpieces? FOUR feet tall. FOUR.",
    "Nu, when's the viort? I skipped lunch for THIS.",
    "Aviel? Lovely boy. Couldn't park a car to save his life.",
    "Tzippy, SIT DOWN, the kallah is WALKING!",
    "I knew them when they were just a shidduch and a maybe.",
    "Save me a piece of the SECOND brisket. If it exists.",
    "Mazel toooov! *dabs eyes with three tissues at once*",
    "The flowers alone cost more than my FIRST car. Worth it.",
];
export const WED_LULU = [
    "I'm not crying, YOU'RE crying!",
    "Mazel tov!! ...is there a viort? I'm STARVING.",
    "Avigail's getting MARRIED and I'm here in walking shoes. Iconic.",
    "I caught the bouquet — is that legally binding?",
    "She made me PROMISE I'd dance. My knees made no such promise.",
    "Rose petals? On it. I'm basically a flower girl now.",
    "Look at her GO. That's my best friend up there!",
    "Somebody hold me, this is too beautiful... and there's brisket.",
    "I walked here. I'll dance here. I'll EAT here. Worth the blisters.",
    "Aviel better treat her right or he answers to ME and my sneakers.",
    "Kvelling so hard I might levitate. Mazel TOV!",
    "Ten outta ten chuppah. No notes. Pass the rugelach.",
];
export const WED_CHEER = ["MAZEL TOV!", "WOOO!", "SIMAN TOV!", "DANCE!", "L'CHAIM!", "KINEAHORA!"];
export const WED_CIRCLE = [
    "One! ...this is dizzy work.",
    "Two! Aviel, hold STILL.",
    "Three! Halfway-ish? I lost count. Three!",
    "Four! The gown weighs a THOUSooo—four!",
    "Five! Somebody's bubbe is timing this.",
    "Six! ONE more, ONE more!",
    "SEVEN! Done! I'm a DREIDEL, somebody catch me!",
];
export const WED_BOUQUET_WIN = [
    "You're NEXT, Lulu!!",
    "She THREW it RIGHT at you. That's basically a contract.",
    "CAUGHT IT! ...do I have to give it back? I'm keeping it.",
    "The crowd GASPS. Lulu, the people have SPOKEN.",
];
export const WED_BOUQUET_MISS = [
    "...it bounced off your HEAD. The seagull got it. Classic.",
    "SO close! It's fine. You're 'between bouquets' right now.",
    "Tzippy boxed you out. Tzippy plays DIRTY.",
    "Whiffed it! No worries — more cake for the single ladies.",
];

export function pickFrom(list, last = {}, key = "") {
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === last[key]) i = (i + 1) % list.length;
    last[key] = i;
    return list[i];
}
