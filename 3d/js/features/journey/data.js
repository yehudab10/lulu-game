// features/journey/data.js — the Story Trip's script: the five stops, their
// chapter tasks, greetings, story beats, calls, interludes and boons, ported
// word-for-word from the 2D game (src/05a-journey.js), plus the road layout.
//
// Distances: the 2D legs are scrollOffset pixels; 3D uses ≈11.67 px per metre
// (Bubbe's house: 56,000 px → 4,800 m). One continuous road: each stop sits
// at the running total of the legs before it, ×1.5 per tour (storyCycle).
import { ctx, pick } from "../../core/ctx.js";
import { shared } from "../../core/save.js";

export const PX_PER_M = 56000 / 4800;

/** Avigail friendship 0–100: the cameos feature's ctx.avigail if present, else the shared 2D save. */
export function avigailRel() {
    try { if (ctx.avigail && ctx.avigail.rel) return ctx.avigail.rel(); } catch (e) { /* fall back */ }
    const r = shared.get().avigailRel;
    return typeof r === "number" ? r : 50;
}
/** bumpAvigailRel(d): through ctx.avigail when the cameos feature is there (it shows the "+4 💜"). */
export function bumpAvigail(d) {
    try { if (ctx.avigail && ctx.avigail.bump) { ctx.avigail.bump(d); return; } } catch (e) { /* fall back */ }
    shared.update(s => { s.avigailRel = Math.max(0, Math.min(100, (typeof s.avigailRel === "number" ? s.avigailRel : 50) + d)); });
}

export const STOPS = [
    {
        id: "bubbe", name: "BUBBE'S HOUSE", nice: "Bubbe's house", icon: "🏡", dist: 56000, reward: 60,
        task: "Grocery run: collect 40 coins on the way",
        greet: () => "LULULEH! You made it! Come, EAT — the cholent's hot! 🍲",
        greeter: "Bubbe", greeterEmoji: "👵", accent: "#FFCC80", ink: "#8D5A2B",
        music: "../story-relax.mp3", vibe: "🍂 Friday afternoon — erev Shabbos rush",
        beat: "*hands over the POT* Guard it with your LIFE. Or at least both hands.",
        boon: { id: "cholent", emoji: "🍲", label: "Bubbe's cholent", desc: "+1 ❤️ for the next leg" },
    },
    {
        id: "heshy", name: "HESHY'S POOL", nice: "Heshy's pool", icon: "🏊", dist: 74000, reward: 80,
        task: "Impress Heshy: chain 3 close calls",
        greet: () => "CANNONBAAALL! 💦 ...oh hey Lulu! Towel? Snack? Floatie?",
        greeter: "Heshy", greeterEmoji: "🏊", accent: "#80D8FF", ink: "#0277BD",
        music: "../story-beach.mp3", vibe: "☀️ high summer — pool weather",
        beat: "*throws floatie in your trunk* Fountain research, here we come.",
        boon: { id: "floatie", emoji: "🛟", label: "floatie shield", desc: "8 s of invincibility" },
    },
    {
        id: "beach", name: "THE BEACH", nice: "the beach", icon: "🏖️", dist: 103000, reward: 100,
        task: "Catch the sisters' runaway beach gear (3)",
        greet: () => "Salt air, seagulls, zero traffic. You EARNED this, Bruck.",
        greeter: "The Beach", greeterEmoji: "🐦", accent: "#FFE082", ink: "#B8860B",
        music: "../story-beach.mp3", vibe: "🌊 sea breeze — gulls overhead",
        beat: "*Morgan is rescued, sandy but fine* Dina says you're a hero.",
        boon: { id: "icecream", emoji: "🍦", label: "ice cream", desc: "sugar rush: 5 s of free nitro" },
    },
    {
        id: "avigail", name: "AVIGAIL'S PLACE", nice: "Avigail's place", icon: "💅", dist: 131000, reward: 125,
        task: "Stay classy: don't bump Avigail's car",
        greet: () => {
            const r = avigailRel();
            if (r >= 65) return "BESTIE! I made spritzers! 💜";
            if (r <= 35) return "...you drove ALL this way? Obsessed with me much? 💅";
            return "Oh. It's you. Cute car, I guess. Come in, whatever. 💅";
        },
        greeter: "Avigail", greeterEmoji: "💅", accent: "#CE93D8", ink: "#6A1B9A",
        music: "../story-relax.mp3", vibe: "🌆 golden dusk — boutique hour",
        beat: "*gets in* If anyone asks, I was never stranded.",
        boon: { id: "spritzer", emoji: "🥂", label: "spritzer", desc: "spritzer confidence: ×2 score for 15 s" },
    },
    {
        id: "vegas", name: "VIVA VEGAS", nice: "Viva Vegas", icon: "🎲", dist: 177000, reward: 200,
        task: "Guard the pot: arrive without losing a heart",
        greet: () => "You DROVE it?! Lakewood to VEGAS, baby! Mindy, the kids — LULU'S HERE! 🎲",
        greeter: "Uncle Burry", greeterEmoji: "😎", accent: "#A5D6A7", ink: "#2E7D32",
        music: "../story-electric.mp3", vibe: "🌵 desert heat → 🌃 neon night", nightAt: 0.55,
        beat: "*the whole mishpacha jumps out* SURPRIIIISE! ...wait, WE'RE the surprise!",
        boon: { id: "dice", emoji: "🎲", label: "lucky dice", desc: "roll for 25–100 coins, right now" },
    },
];
export const N_STOPS = STOPS.length;
for (const st of STOPS) st.leg = Math.round(st.dist / PX_PER_M);   // 4800, 6343, 8829, 11229, 15171 m

export const EPILOGUE = "The pot made it. The cholent happened. Heshy found the fountains. Avigail caught the bouquet — wrong party, still counts. And Burry cried twice. (He says it was the desert air.)";
export const STORY_BLURB = "Burry's leaving Lakewood. Bubbe has a plan. You have a car.";

// ── layout (metres along the one continuous road) ─────────────────────────
export function cycleMult(cycle) { return Math.pow(1.5, cycle || 0); }
/** Where stop i sits for a given tour multiplier. */
export function stopS(i, mult = 1) {
    let s = 0;
    for (let j = 0; j <= i; j++) s += STOPS[j].leg;
    return s * mult;
}
/** Where a leg run (story map / checkpoint) starts: just past the previous stop. */
export function legStartS(i, mult = 1) { return i <= 0 ? 12 : stopS(i - 1, mult) + 34; }
export const PULL_IN = 90;      // the pull-in starts this far before the stop
export const GATE_BACK = 45;    // the finish gate stands this far before the stop

// ── story phone calls (leg start) ─────────────────────────────────────────
export function storyCallInfo(i) {
    const id = STOPS[i].id;
    if (id === "bubbe") return { from: "BUBBE", emoji: "👵", color: "#FFCC80" };
    if (id === "heshy") return { from: "HESHY", emoji: "🏊", color: "#80D8FF" };
    if (id === "beach") return { from: "THE BEACH", emoji: "🐦", color: "#FFE082" };
    if (id === "avigail") return { from: "AVIGAIL", emoji: "💅", color: "#CE93D8" };
    return { from: "BURRY", emoji: "😎", color: "#A5D6A7" };
}
export function storyCallLine(i) {
    const id = STOPS[i].id;
    if (id === "bubbe") return pick(["Come straight here, Lululeh — I have a MISSION for you.",
        "The kugel is in the oven and I have NEWS. Drive."]);
    if (id === "heshy") return pick(["It's about Vegas... we need to talk. Poolside. Obviously.",
        "Bring goggles. And your listening ears."]);
    if (id === "beach") return pick(["*SQUAWK* (a seagull has stolen someone's sandwich)",
        "*URGENT seagull noises re: a buried plushie*"]);
    if (id === "avigail") {
        const r = avigailRel();
        if (r >= 65) return "Bestie, my engine's making a noise like your singing. Come quick 💜";
        if (r <= 35) return "I do NOT need help. But if you HAPPENED to drive by...";
        return "Hypothetically, if my car exploded, what's your ETA?";
    }
    return pick(["Cuz, the van's packed! Mostly. The kids packed themselves. Send help.",
        "Mindy says drive safe. The kids say drive FAST. I say SNACKS."]);
}

// ── mid-leg dialogue interludes (~35% into each leg) ─────────────────────
export function storyTalkScript(id) {
    if (id === "bubbe") return [
        { who: "bubbe", phone: true, text: "Lululeh. Listen close. The POT comes to Vegas." },
        { who: "lulu", phone: true, text: "The heirloom pot?? The one Zaidy schlepped from—" },
        { who: "bubbe", phone: true, text: "Sunday we surprise Burry. The whole mishpacha. The pot MAKES the cholent that makes the party." },
        { who: "lulu", phone: true, text: "No pressure or anything!!" },
        { who: "bubbe", phone: true, text: "Pressure? You're a BRUCK. Drive." },
    ];
    if (id === "heshy") return [
        { who: "heshy", text: "Lulu. Real talk. Vegas has... NO water." },
        { who: "lulu", text: "Heshy. They have POOLS. Famous ones. With FOUNTAINS." },
        { who: "heshy", text: "...fountains?" },
        { who: "lulu", text: "Dancing ones. CHOREOGRAPHED." },
        { who: "heshy", text: "...Pack the floatie. I'M IN. 🏊" },
    ];
    if (id === "beach") return [
        { who: "dina", phone: true, text: "LULU. Emergency. Morgan is IN THE SAND." },
        { who: "lulu", phone: true, text: "How deep are we talking?" },
        { who: "dina", phone: true, text: "Tail-deep. Tammy says it's 'fine.' It is NOT fine." },
        { who: "fayge", phone: true, text: "(background) Nobody panic! Chani's napping!" },
        { who: "lulu", phone: true, text: "Morgan rescue squad, en route. NOBODY digs without me." },
    ];
    if (id === "avigail") {
        const r = avigailRel();
        if (r <= 35) return [
            { who: "avigail", text: "Don't. Say. Anything." },
            { who: "lulu", text: "Wasn't gonna. ...Jumper cables?" },
            { who: "avigail", text: "...Fine. But this never happened." },
            { who: "lulu", text: "What never happened? 😇" },
        ];
        if (r >= 65) return [
            { who: "avigail", text: "BESTIE. My car did a thing." },
            { who: "lulu", text: "A smoking thing." },
            { who: "avigail", text: "Get me to my own party?" },
            { who: "lulu", text: "Hop in, drama queen. 💜" },
        ];
        return [
            { who: "avigail", text: "Of COURSE you'd drive by right now." },
            { who: "lulu", text: "Need a hand, or just an audience?" },
            { who: "avigail", text: "...Both. Obviously." },
            { who: "lulu", text: "Buckle up, frenemy." },
        ];
    }
    return [
        { who: "burry", phone: true, text: "Cuz... everyone's really coming? For ME?" },
        { who: "lulu", phone: true, text: "The WHOLE mishpacha. Even Avigail." },
        { who: "burry", phone: true, text: "I told Mindy this town never surprised me once. ...I gotta write a toast. What rhymes with 'Lakewood'?" },
        { who: "lulu", phone: true, text: "Focus on the ROAD— wait, that's me. GOTTA GO!" },
    ];
}
export const SPEAKERS = {
    bubbe: { name: "Bubbe", emoji: "👵", color: "#B8860B" },
    lulu: { name: "Lulu", emoji: "💁‍♀️", color: "#E91E63" },
    heshy: { name: "Heshy", emoji: "🏊", color: "#0277BD" },
    dina: { name: "Dina", emoji: "👧", color: "#D81B60" },
    fayge: { name: "Fayge", emoji: "👩", color: "#3949AB" },
    avigail: { name: "Avigail", emoji: "💅", color: "#7B1FA2" },
    burry: { name: "Burry", emoji: "😎", color: "#2E7D32" },
};

// ── chapter tasks ─────────────────────────────────────────────────────────
export const TASK_GOAL = { bubbe: 40, heshy: 3, beach: 3 };
export const GEAR = [
    { kind: "kite", name: "Dina's kite", emoji: "🪁", model: "journey_kite" },
    { kind: "ball", name: "the beach ball", emoji: "🏖️", model: "journey_beachball" },
    { kind: "hat", name: "the sun hat", emoji: "👒", model: "journey_sunhat" },
];
export const GEAR_PLAN = [0.30, 0.50, 0.70];
export const BOX_LABELS = ["caught the lava lamp!", "the dice clock!", "Mindy's blender!", "a kid's shoe??"];

// ── Ima is calling (src/05b-ima-call.js) ─────────────────────────────────
export const IMA_CALL_LINES = [
    "Hi mamele! Are you EATING?", "Did you call Bubbe back?",
    "Are you wearing a sweater? It's cold!", "Tammy says hi. Don't tell Esti.",
    "Who is this Avigail I keep hearing about?", "Abba wants to know if the car's okay.",
    "Pick up challah on the way home!", "Your cousin got engaged! Just saying.",
    "Did Dina tell you about her sticker book?", "Wait — are you DRIVING right now?!",
];
export const IMA_RING_DUR = 2.4, IMA_TALK_DUR = 7.2, IMA_DONE_DUR = 2.2;
export const STORY_CALL_DUR = 4.6;

// SPAWN_CONFIG.imaCall (src/01b-spawn-tuning.js) — first / every in seconds, chance per attempt.
export const IMA_SPAWN = { first: [45, 110], every: [110, 200], chance: 0.45 };

/** storySpawnBias port: a subtle per-leg spawn multiplier other features can ask for. */
export function spawnBiasFor(legIdx, name) {
    if (legIdx === 0) {                       // Bubbe's leg (erev Shabbos)
        if (name === "pedestrian") return 1.8;
        if (name === "heart") return 1.3;
    }
    if (legIdx === 1 && name === "heshyPool") return 3;
    if (legIdx === 2 && name === "iceCream") return 3;
    if (legIdx === 3 && name === "avigailCar") return 3;
    if (legIdx === 4 && (name === "toll" || name === "parade")) return 2;
    return 1;
}
