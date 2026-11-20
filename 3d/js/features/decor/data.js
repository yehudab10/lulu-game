// features/decor/data.js — 🛋️ THE CATALOGUE: every spot Lulu can decorate, what goes there and what it costs.
//
// A SLOT is one spot (the bed, the porch, the mailbox…): `where` says if it's outside (seen from the street — the
// home start shows it every time) or in a room of her house; `opts` are the choices, cheapest first. The first
// option of every slot is what the house has today: free and already hers. Everything else is bought ONCE with
// coins and is hers for good — swapping between things she owns is free. Nothing here ever pays coins back
// (AGENTS golden rule 5: a coin SINK only — no refunds, no resale).
//
// Option fields: id, icon, name, price, desc (the picker's one line), set (a themed set it belongs to), plus the
// look: `color` (a paint), `wall` (wallpaper: color + pattern), `couch` (fabric / cushion colours, cover).
// The models are built in code from primitives (props.js — BUILD[slot][opt]).

export const SLOTS = [
    // ── outside (the street sees these) ──
    { id: "door", where: "outside", room: "porch", icon: "🚪", name: "Front door", verb: "Paint the front door", opts: [
        { id: "pink", icon: "🩷", name: "Classic pink", price: 0, color: "#E91E63", desc: "The family pink. Ima picked it. Ima is always right." },
        { id: "mint", icon: "🌿", name: "Mint fresh", price: 40, color: "#5FD3B3", desc: "Like a breath mint, but a door." },
        { id: "sky", icon: "🩵", name: "Sky blue", price: 40, color: "#4FA8F0", desc: "Calm. Serene. Nothing like the driving." },
        { id: "sunny", icon: "🌻", name: "Sunshine yellow", price: 60, color: "#FFC928", desc: "Visible from space. Or at least from Mr. Pinsky's." },
        { id: "purple", icon: "💜", name: "Royal purple", price: 90, color: "#7E3FC0", desc: "A door fit for a queen of the highway." },
        { id: "gold", icon: "✨", name: "Solid gold (paint)", price: 400, color: "#E8B923", metal: 0.85, set: "disco", desc: "Subtle. Like a lighthouse." },
    ] },
    { id: "porch", where: "outside", room: "porch", icon: "🪑", name: "The porch", verb: "Spruce up the porch", opts: [
        { id: "bare", icon: "🪵", name: "Just the bench", price: 0, desc: "A bench, a little table. Honest porch." },
        { id: "mat", icon: "🧺", name: "Welcome mat", price: 25, desc: "It says WIPE YOUR FEET. Signed: IMA." },
        { id: "baskets", icon: "🌺", name: "Hanging flower baskets", price: 70, set: "pink", desc: "Petunias! The bees are THRILLED." },
        { id: "rockers", icon: "🪑", name: "Two rocking chairs", price: 140, set: "bubbe", desc: "For when you're 80. Or just tired." },
        { id: "lights", icon: "💡", name: "Twinkle lights", price: 180, set: "disco", desc: "Little bulbs all along the railing. Magic after dark." },
        { id: "balloons", icon: "🎈", name: "Balloon arch", price: 320, desc: "Every day is a party when you're Lulu." },
    ] },
    { id: "mailbox", where: "outside", room: "yard", icon: "📬", name: "Mailbox", verb: "Jazz up the mailbox", opts: [
        { id: "plain", icon: "📪", name: "The family mailbox", price: 0, desc: "Purple. Dented. Loved." },
        { id: "pink", icon: "🩷", name: "Painted pink", price: 30, set: "pink", desc: "Even the junk mail feels special now." },
        { id: "fish", icon: "🐟", name: "Fish mailbox", price: 90, desc: "The mail goes in its mouth. Don't think about it." },
        { id: "car", icon: "🚗", name: "Mini pink car", price: 220, set: "road", desc: "A tiny version of HER car. Vroom vroom, bills." },
        { id: "kugel", icon: "🥘", name: "Giant kugel", price: 450, desc: "A mailbox shaped like a kugel. Golden. Crispy edges. Iconic." },
    ] },
    { id: "lawn", where: "outside", room: "yard", icon: "🌷", name: "Front yard", verb: "Do the front yard", opts: [
        { id: "none", icon: "🌱", name: "Just grass", price: 0, desc: "Mr. Pinsky says it needs watering." },
        { id: "flamingo", icon: "🦩", name: "A plastic flamingo", price: 20, set: "pink", desc: "Classy. Timeless. Pink." },
        { id: "gnomes", icon: "🧙", name: "Three garden gnomes", price: 75, set: "bubbe", desc: "They watch the street. They know things." },
        { id: "tulips", icon: "🌷", name: "A tulip bed", price: 110, desc: "Red, yellow and pink, all in a row." },
        { id: "birdbath", icon: "🐦", name: "A birdbath", price: 160, desc: "Free spa day for every pigeon in Lakewood." },
        { id: "flock", icon: "🦩", name: "A whole FLOCK of flamingos", price: 600, desc: "Twelve of them. Mr. Pinsky is going to have WORDS." },
    ] },
    // ── inside: Lulu's room ──
    { id: "bed", where: "inside", room: "lulu", icon: "🛏️", name: "Bed", verb: "Change the bed", opts: [
        { id: "basic", icon: "🛏️", name: "The old bed", price: 0, desc: "Blue blanket. A little lumpy. Home." },
        { id: "fluffy", icon: "🩷", name: "Pink & fluffy", price: 80, set: "pink", desc: "Like sleeping inside a cupcake." },
        { id: "kugel", icon: "🥘", name: "Kugel pillow set", price: 120, desc: "Pillows shaped like a potato kugel. Crispy-edge pattern." },
        { id: "racecar", icon: "🏎️", name: "Race-car bed", price: 450, set: "road", desc: "Zero to asleep in 4.2 seconds." },
        { id: "canopy", icon: "👑", name: "Princess canopy", price: 700, desc: "Gauzy curtains. Royal dreams. Do not disturb." },
    ] },
    { id: "wallpaper", where: "inside", room: "lulu", icon: "🎨", name: "Wallpaper", verb: "Redo the walls", opts: [
        { id: "cream", icon: "🤍", name: "Plain cream", price: 0, wall: { color: "#F6EBDD", pat: "plain" }, desc: "The walls came this way." },
        { id: "pink", icon: "🩷", name: "Bubblegum pink", price: 50, wall: { color: "#F9B9D3", pat: "plain" }, set: "pink", desc: "Pinker. Always pinker." },
        { id: "mint", icon: "🌿", name: "Mint stripes", price: 90, wall: { color: "#CDEFE3", pat: "stripes", ink: "#9ED9C4" }, desc: "Fresh, like a new semester." },
        { id: "checker", icon: "🏁", name: "Racing checkers", price: 140, wall: { color: "#FFFFFF", pat: "checks", ink: "#2B2B2B" }, set: "road", desc: "The finish line is wherever she naps." },
        { id: "clouds", icon: "☁️", name: "Sky & clouds", price: 180, wall: { color: "#9FD4F6", pat: "clouds", ink: "#FFFFFF" }, desc: "Head in the clouds, feet on the gas." },
        { id: "glitter", icon: "✨", name: "Gold glitter", price: 380, wall: { color: "#3A2350", pat: "glitter", ink: "#FFD54F" }, set: "disco", desc: "Shiny. It gets EVERYWHERE." },
    ] },
    { id: "art", where: "inside", room: "lulu", icon: "🖼️", name: "Wall art", verb: "Hang something up", opts: [
        { id: "none", icon: "⬜", name: "Bare wall", price: 0, desc: "A nail. Just a nail." },
        { id: "singer", icon: "🎤", name: "Mystery singer poster", price: 35, desc: "The masked singer everyone's talking about. Who IS he? (Lulu just smiles.)" },
        { id: "ticket", icon: "🎫", name: "Framed speeding ticket", price: 60, set: "road", desc: "Her first. A classic. Framed in gold." },
        { id: "map", icon: "🗺️", name: "Road-trip map", price: 120, desc: "Every stop from Lakewood to Vegas, in red string." },
        { id: "bubbe", icon: "👵", name: "Portrait of Bubbe", price: 220, set: "bubbe", desc: "Oil on canvas. Her eyes follow you. With love." },
    ] },
    { id: "rug", where: "inside", room: "lulu", icon: "🟣", name: "Rug", verb: "Pick a rug", opts: [
        { id: "none", icon: "🟫", name: "Bare floor", price: 0, desc: "Wood floor. Cold toes at 6 a.m." },
        { id: "round", icon: "🩷", name: "Round pink rug", price: 45, set: "pink", desc: "Soft, round, perfect for dramatic flops." },
        { id: "road", icon: "🛣️", name: "Road-map play rug", price: 110, set: "road", desc: "Dina's toy cars are not allowed on it. They're on it." },
        { id: "zebra", icon: "🦓", name: "Faux zebra rug", price: 180, desc: "No zebras were harmed. It's polyester." },
        { id: "shag", icon: "🟪", name: "Purple shag", price: 260, set: "disco", desc: "You will lose earrings in here. Worth it." },
    ] },
    { id: "lamp", where: "inside", room: "lulu", icon: "💡", name: "Light", verb: "Change the light", opts: [
        { id: "desk", icon: "💡", name: "Plain lamp", price: 0, desc: "It turns on. It turns off. Great lamp." },
        { id: "lava", icon: "🫧", name: "Lava lamp", price: 70, desc: "Bloop. Bloop. Very relaxing. Bloop." },
        { id: "neon", icon: "🌟", name: "Neon LULU sign", price: 260, desc: "Her name, in pink neon. As it should be." },
        { id: "chandelier", icon: "🕯️", name: "Tiny chandelier", price: 480, set: "bubbe", desc: "Crystal! Fancy! Bubbe approves." },
        { id: "disco", icon: "🪩", name: "Disco ball", price: 550, set: "disco", desc: "Spins. Sparkles. Ima has QUESTIONS." },
    ] },
    { id: "shelf", where: "inside", room: "lulu", icon: "📚", name: "Shelf", verb: "Fill the shelf", opts: [
        { id: "books", icon: "📚", name: "Schoolbooks", price: 0, desc: "Mostly unread. Some highlighted. In pink." },
        { id: "plush", icon: "🧸", name: "Plushie pile", price: 60, set: "pink", desc: "A bear, a bunny, a slightly worried duck." },
        { id: "globes", icon: "🔮", name: "Snow globes", price: 110, desc: "One from every stop. Shake gently." },
        { id: "cars", icon: "🚙", name: "Model cars", price: 200, set: "road", desc: "Every car she's ever wanted. In tiny." },
        { id: "trophies", icon: "🏆", name: "Trophy shelf", price: 320, desc: "'Most Improved Parallel Parker.' She earned it." },
    ] },
    // ── inside: the living room ──
    { id: "couch", where: "inside", room: "living", icon: "🛋️", name: "Family couch", verb: "Redo the couch", opts: [
        { id: "purple", icon: "🛋️", name: "The family couch", price: 0, couch: { fab: "#7E57C2", cush: "#9575CD" }, desc: "Purple. Firm. Has seen things." },
        { id: "plastic", icon: "🫧", name: "Bubbe's plastic cover", price: 40, couch: { fab: "#C8A2C8", cush: "#E1C6E8", cover: true }, set: "bubbe", desc: "It squeaks. It sticks. It's PERFECT." },
        { id: "avocado", icon: "🥑", name: "Avocado green", price: 120, couch: { fab: "#8BA640", cush: "#A8C25A" }, desc: "Very 1974. Very in." },
        { id: "velvet", icon: "🩷", name: "Pink velvet", price: 160, couch: { fab: "#E2558F", cush: "#F48FB1" }, set: "pink", desc: "Soft as a kitten. Do NOT eat on it." },
        { id: "massage", icon: "💆", name: "Massage couch", price: 650, couch: { fab: "#4E342E", cush: "#6D4C41", buzz: true }, desc: "It hums. Abba hasn't left it since Tuesday." },
    ] },
];

/** Themed sets: wear every piece at once and the house notices (a banner, a scrapbook stat — never coins). */
export const SETS = [
    { id: "pink", icon: "🌸", name: "Pink Dream", line: "It's like living inside a strawberry milkshake. PERFECT." },
    { id: "road", icon: "🏎️", name: "Road Queen", line: "The whole room says VROOM. Ima says 'slow down' to the WALLPAPER." },
    { id: "bubbe", icon: "👵", name: "Bubbe Chic", line: "Bubbe would cry. Happy tears. Then cover everything in plastic." },
    { id: "disco", icon: "🪩", name: "Disco Night", line: "Saturday night fever. Well — motzei Shabbos fever." },
];

export const slotById = id => SLOTS.find(s => s.id === id) || null;
export const optOf = (slot, id) => { const s = typeof slot === "string" ? slotById(slot) : slot; return s ? s.opts.find(o => o.id === id) || null : null; };
/** The pieces of a set: [{ slot, opt }]. */
export const setPieces = setId => {
    const out = [];
    for (const s of SLOTS) for (const o of s.opts) if (o.set === setId) out.push({ slot: s.id, opt: o.id });
    return out;
};

// ── what people say ──────────────────────────────────────────────────────
export const LINES = {
    luluBuy: ["Ooh, that's SO me.", "Best. Purchase. Ever.", "Worth every coin. Probably.", "Ima is going to LOVE this. Maybe.",
        "Interior designer Lulu, at your service. 💅", "Okay that looks AMAZING."],
    luluBroke: ["My wallet says no. My heart says yes. My wallet wins.", "Not enough coins… back to the road!", "Ugh. Need more gelt."],
    imaBuy: {
        any: ["Very nice, mamele! Now clean your room.", "Who's paying for— oh, YOU are. Mazel tov!", "Beautiful! Did you dust first?"],
        disco: ["A DISCO BALL? In MY house?!", "Lulu, the neighbours can see it from the STREET."],
        flock: ["TWELVE flamingos? Mr. Pinsky called. TWICE."],
        massage: ["Abba hasn't gotten up since it arrived. Thank you, I think?"],
        bubbe: ["Bubbe's portrait! Oy, she'll be so proud. Take a picture for her!"],
        plastic: ["Plastic on the couch! Finally, someone in this family with SENSE."],
        singer: ["Your brother— I mean, THAT singer. Very talented. Very… mysterious. 🤐"],
        kugel: ["A kugel? For the MAIL?", "My daughter, the kugel artist."],
    },
    ima: ["Lulu! You're home! Are you hungry? You look hungry.", "Did you eat? There's kugel. There's ALWAYS kugel.",
        "Your room is looking very… YOU, mamele.", "Wipe your feet! I just did the floors.", "Call Bubbe, she misses you!",
        "Don't spend all your coins on decorations. Spend SOME on gas."],
    dina: ["Can I have the flamingo when you're done with it?", "Your room is the BEST room. Don't tell Ima I said that.",
        "Ima says dinner's in five minutes. Ima said that an hour ago.", "Can we watch the one with the singing dog again?"],
    set: "✨ SET COMPLETE",
};
