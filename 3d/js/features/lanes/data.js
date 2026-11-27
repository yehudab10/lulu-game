// features/lanes/data.js — 🎳 EAST MIDWOOD LANES: every name, line and number (tune here).
import { rng } from "./pins.js";

export const ID = "lanes";
export const NAME = "East Midwood Lanes";

export const TUNE = {
    fee: 12,            // a lane (and the shoes) — a coin sink; nothing here ever pays coins
    knishPrice: 4,      // the snack bar's one snack
    knishBalls: 3,      // …its effect: the next 3 balls, the power meter moves slower (a steadier hand)
    shirtAt: 200,       // a first game of 200+ → the LANES bowling shirt (features/clothes) + a badge
    lanes: 4,
    botSkill: 0.62,     // Sunday League Shimmy (~175 a game)
    botWait: 1.3,       // s — the house bowler walks up
    joinRange: 4.5,     // m — "Join Lulu's lane" shows this close to a lane
};

// WHERE: Midwood, the east end of Avenue M, north side — the run of six fronts ci/storefronts keeps for the alley
// (`BOWLING` in features/storefronts/data.js: x 95…165). With features/storefronts the alley CLAIMS those fronts
// (ctx.storefronts.reservedFor("lanes") + claim: their ✋ walks in here); without it, one ✋ at the middle of the run.
// Local town coordinates: the doors' line on Avenue M's north sidewalk (z), the street to the south (n = −z).
export const DOOR = { town: "midwood", x: 130, z: -46.6, x0: 95, x1: 165 };

export const SHELDON = { name: "Sheldon", key: "npcMan", colors: { Shirt: "#5D4037", Pants: "#3E2723", Skin: "#E0B48F" } };
export const RIVKY = { name: "Rivky", key: "npcWoman", colors: { Top: "#F48FB1", Skirt: "#4A148C" } };
export const SHIMMY = { name: "Sunday League Shimmy", short: "Shimmy", key: "npcMan", colors: { Shirt: "#1565C0", Pants: "#263238" } };

// league night (Tuesday + Thursday evenings): two NPC teams bowl on lanes 3 + 4
export const LEAGUE = {
    days: [2, 4], from: 18, to: 23,
    teams: [
        { name: "The Kosher Kings", c: "#1565C0", bowlers: ["Mendy", "Avromi"] },
        { name: "The Gutter Gedolim", c: "#2E7D32", bowlers: ["Yitzy", "Big Chaim"] },
        { name: "Splits & Kugel", c: "#F9A825", bowlers: ["Moishy", "Leibel"] },
        { name: "Pin Pals of Ave M", c: "#6A1B9A", bowlers: ["Shloimy", "Duvi"] },
    ],
};
/** Tonight's two teams (the same for everyone: by the date). */
export function leagueTonight(key) {
    let h = 0; for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const R = rng(h), a = Math.floor(R() * 4), b = (a + 1 + Math.floor(R() * 3)) % 4;
    return [LEAGUE.teams[a], LEAGUE.teams[b]];
}
// the kids' birthday party (Sundays, daytime): bumpers up on lane 4
export const PARTY = { day: 0, from: 10, to: 17, kid: "Yossi", age: 7 };

export const LINES = {
    hello: [
        "East Midwood Lanes. Shoes are a nine. Everyone's a nine. Don't ask.",
        "Welcome. The lanes are oiled, the shoes are sprayed, the knishes are… present.",
        "Forty years behind this counter. I've seen a man bowl a 300 in a kapote. Nothing surprises me.",
        "You want a lane? Ask. You want a lane FAST? Still ask. It's the same lane.",
    ],
    shoes: [
        "Size nine. They're all nine. Your feet will adjust. Feet are very flexible.",
        "Here — the red-and-blue ones. Sprayed fresh in 1987.",
        "Nine. If they're big, stuff a napkin. If they're small, walk on your toes. Bowling is about ADAPTING.",
    ],
    gutter: [
        "*from the counter* GUTTER. It happens. It happens to you a lot, but it happens.",
        "*Sheldon, not looking up* The gutter's not a lane, sweetheart.",
        "That ball had somewhere better to be.",
        "*Sheldon* I'm writing that one down. For my memoirs. Chapter: \"Why.\"",
    ],
    strike: ["*Sheldon looks up from his paper* …huh.", "STRIKE! *the lights flicker — they always do that*", "*someone at the snack bar claps* STRIKE!"],
    spare: ["Spare! Picked it up. Like a mensch.", "*Sheldon* Clean-up crew. Respect."],
    split: ["Oy, a split.", "*Sheldon* The seven-ten. The Grand Canyon of Avenue M."],
    turkey: ["THREE IN A ROW! A TURKEY! *Rivky rings the snack bar bell*"],
    over: ["Good game. Return the shoes. I count them.", "*Sheldon* Next time, bring a friend. Or a better arm."],
    knish: [
        "One knish. Potato. It steadies the hand. Doctors don't say that, but I say that.",
        "Hot knish! Careful, it's lava inside. That's how you know it's fresh.",
    ],
    knishDone: "Already had your knish today. One a day. That's the rule. Rivky's rule.",
    broke: "No coins, no lane. I'd love to help, but the pins don't reset themselves. Actually they do. But still.",
    trophyCase: [
        "The trophy case. 1994's spot is empty. Somebody walked off with it. I know who. I'm not saying.",
        "Every year since 1961 — except 1994. That's the gap. That's the WOUND.",
    ],
    trophyBack: "My 1994 trophy… *Sheldon takes off his glasses* …you brought it HOME. Thirty years. Rivky, get the good knishes.",
    shimmy: [
        "*Shimmy cracks his knuckles* The house bowler. Sundays, Tuesdays, Thursdays, and whenever someone's alone.",
        "*Shimmy* You want a game? I'll go easy. That's a lie. I don't know how.",
    ],
    shimmyLoses: "*Shimmy* …I let you win. *he did not let her win*",
    shimmyWins: "*Shimmy* Good game. Come back Tuesday. Watch me lose to Big Chaim.",
    league: ["*the league lanes* LET'S GO KINGS!", "*Big Chaim* That's a STRIKE, Yitzy. You can stop pointing.", "*league night* Ten-pin, ten-pin, TEN-PIN!"],
    party: ["*the birthday party on lane 4* HAPPY BIRTHDAY YOSSI!", "*a kid with bumpers bowls a strike* I'M THE BEST IN THE WORLD!", "*Yossi's mother* Who wants cake? Not yet. AFTER bowling."],
    best: n => `Your best here: ${n}. Sheldon wrote it on the board. In pen.`,
    shirt: "A 200 game! *Sheldon reaches under the counter* …the LANES shirt. We don't sell these. You EARN them. It's in your closet.",
    joinAsk: who => `🎳 Join ${who}'s lane`,
};

export const EMOTES = ["🎉", "😬", "👏", "🔥"];
