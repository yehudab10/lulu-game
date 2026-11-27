// features/family — 🏠 FAYGE'S BASEMENT, from the inside: her household's own scenes on features/homes' engine (the same
// staging API as homes/scenes.js — S.place / S.seat / S.prop / anchors S.A). Played by the clock (data.js dayOf), never
// by chance; she always comes in as family (a guest who doesn't knock twice).
const away = list => (w, home) => home.cast.filter(k => list(w).includes(k));

export const SCENES = {
    faygeMorning: {
        id: "faygeMorning", emoji: "🥣", name: "the morning at Fayge's",
        heard: ["\"ASH. Your LUNCH.\" \"…got it.\" \"That's CHANI'S lunch.\""],
        guest: ["Snack bag: rice cakes, Cheerios, a banana, a spare banana, a spare spare banana. Chani's a growing girl.", "You want coffee? Ash made it. It's very strong. Ash doesn't talk, he makes coffee."],
        treat: "a rice cake (\"it's basically a cracker that gave up\")",
        ambient: { mom: ["Shoes, Chani. SHOES. …one is a start.", "Snack bag, wipes, spare clothes, spare spare clothes…", "Ash, keys! …in your hand. Okay."], dad: ["…bye.", "*kisses Chani on the head, finds his keys in the fridge*"], baby: ["NO shoes!", "Mine!", "Uh-oh."] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.counter, { path: [S.A.counter, S.A.door2, S.A.kidsFloor] });
            if (S.has("dad")) S.place("dad", S.A.livingRun(0), { path: [S.A.livingRun(0), S.A.livingRun(1)] });
            S.prop("lunchboxes", S.A.counterTop.x, S.A.counterTop.y, S.A.counterTop.z);
        },
    },
    faygeSupper: {
        id: "faygeSupper", emoji: "🍽️", name: "supper at Fayge's",
        away: away(w => (w.hour < 18 ? ["dad"] : [])),
        heard: ["\"It's LOW-sodium, Ash.\" \"…mm.\" \"You LIKE it.\" \"…mm.\""],
        guest: ["Sit! There's schnitzel. Low-sodium breading. It's a whole thing, I'll explain.", "Eat, eat. Ash, pass Lulu the— he's passing. Ash is a great passer."],
        treat: "a low-sodium schnitzel (\"you can't taste the salt because there ISN'T any. That's the POINT.\")",
        ambient: { mom: ["Chani, the peas go IN your mouth. In.", "More? There's more. There's ALWAYS more.", "No salt shaker, Lulu. I see you looking for it."], dad: ["Good.", "…very good.", "*quietly salts his own plate under the table*"], baby: ["NO peas!", "*drops a pea, watches it go* Uh-oh.", "AGAIN!"] },
        stage(S) {
            if (S.has("dad")) S.seat("dad", 0);
            if (S.has("mom")) S.place("mom", S.A.stove, { path: [S.A.stove, S.A.tableSide] });
            S.prop("platter", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
            S.prop("plates", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    faygeBedtime: {
        id: "faygeBedtime", emoji: "🌙", name: "Chani's bedtime",
        heard: ["A small voice: \"AGAIN!\" A tired voice: \"…the last time. The LAST last time.\""],
        guest: ["Shh — she's ALMOST asleep. Almost. Ash is singing. Ash only sings to Chani. Don't tell anyone.", "Sit. Whisper. If she hears your voice she'll want to PLAY."],
        treat: "a cup of tea, whispered",
        ambient: { dad: ["*sings very, very softly — Ash has a lovely voice; nobody outside this room knows*"], mom: ["…and the little bunny went to sleep. And so does CHANI.", "Ash, sing the one with the boat."], baby: ["Again!", "*yawns* …no.", "Wawa!"] },
        stage(S) {
            if (S.has("baby")) S.place("baby", S.A.bunkLie(0), { lie: true });
            if (S.has("dad")) S.place("dad", S.A.bunkSide, { sit: true, pose: { talk: true } });
            if (S.has("mom")) S.place("mom", S.A.couchSeat(0), { sit: true });
        },
    },
    faygeNight: {
        id: "faygeNight", emoji: "🌑", name: "the middle of the night at Fayge's", lights: "dim",
        heard: ["Silence. Then, very far away, a tiny voice: \"…Mommy?\" Then silence again."],
        guest: ["*whispers* She wouldn't sleep in her crib. So we're ALL on the couch. Welcome.", "*whispers* Tea? Whisper tea."],
        treat: "a cup of whisper tea",
        ambient: { mom: ["*whispers* …don't. Move.", "*whispers* if she wakes up, you're doing the next one."], dad: ["*snores, very politely*"] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.couchSeat(0), { sit: true });
            if (S.has("baby")) S.place("baby", S.A.couchSeat(1), { sit: true, sleep: true });
            if (S.has("dad")) S.place("dad", S.A.armchair, { sit: true, sleep: true });
        },
    },
    faygeFriday: {
        id: "faygeFriday", emoji: "🍲", name: "Friday at Fayge's — cooking for Ima's",
        away: away(w => (w.hour < 13 ? ["dad"] : [])),
        heard: ["\"It's for IMA'S table. Low-sodium. She'll salt it. I KNOW she'll salt it.\""],
        guest: ["Taste. TASTE. …well? It's low-sodium. Your face says it's low-sodium.", "We're bringing the kugel and the salad to Ima. You're bringing yourself. Don't be late."],
        treat: "a spoon of low-sodium potato kugel",
        ambient: { mom: ["Kugel in, salad done, Chani bathed, Chani UN-bathed…", "Ash, the lettuce! Did you check the—of course you checked."], dad: ["*holds a lettuce leaf up to the lightbox, very seriously*", "…clean."], baby: ["Kugel!", "MINE kugel!"] },
        stage(S) {
            if (S.has("mom")) S.place("mom", S.A.stove, { path: [S.A.stove, S.A.counter] });
            if (S.has("dad")) S.place("dad", S.A.tableSide, {});
            S.prop("challah", S.A.table.c.x, S.A.table.y, S.A.table.c.z);
        },
    },
    faygeOut: {
        id: "faygeOut", emoji: "📝", name: "nobody home at Fayge's",
        away: (w, home) => home.cast.slice(),
        heard: [""],
        stage() { },
    },
};
