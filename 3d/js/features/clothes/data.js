// features/clothes/data.js — every piece, price and line of 👗 the clothing shops (roadmap 24). Tune freely.
// A COIN SINK ONLY: nothing here pays, nothing is resold. Prices against ~500–650 coins a played day:
// town shops 40–900 · the JFK luxury house 2,000–25,000 (a long-term flex: one bag costs more than a house).
// Always modest: long sleeves, skirts below the knee — the colours change, the cut doesn't.
// Brands are PARODY names only (never a real label).

/** The slots she wears, in the order the closet lists them. `mat` = the material on her model it recolours. */
export const SLOTS = [
    { id: "top", icon: "👚", name: "Top", mat: "Top" },
    { id: "skirt", icon: "👗", name: "Skirt", mat: "Bottom" },
    { id: "tights", icon: "🧦", name: "Tights", mat: "Tights" },
    { id: "shoes", icon: "👟", name: "Shoes", mat: "Shoes" },
    { id: "outer", icon: "🧥", name: "Coat", mat: "Top" },        // (a coat recolours her sleeves + adds its own shape)
    { id: "acc", icon: "👜", name: "Extra", mat: null },          // (one accessory: a bag, the shades, a headband…)
];
/** Today's Lulu (a save without clothes = exactly this): sky-blue top, long navy skirt, dark tights, pink shoes. */
export const BASE = { top: "#4FC3F7", skirt: "#283593", tights: "#2B2B3A", shoes: "#E91E63" };

/**
 * The pieces. slot · shop (midwood | lakewood | jfk) · price · color · shape (outer: coat | puffer | cardigan | robe ·
 * acc: shades | headband | scarf | pearls | bag | bigbag | coffee) · brand · line (the card's one line).
 */
export const PIECES = [
    // ── MIDWOOD: Avenue J'adore (the trendy boutique) ──
    { id: "mw_coffee", slot: "acc", shape: "coffee", shop: "midwood", price: 60, color: "#A1745B", brand: "Bean There", name: "Iced Oat Latte", icon: "🧋",
      line: "Not for drinking. For holding. Very important." },
    { id: "mw_headband", slot: "acc", shape: "headband", shop: "midwood", price: 120, color: "#1C1C1C", brand: "Maison Motek", name: "Padded Velvet Headband", icon: "🎀",
      line: "Adds two inches of height and four of attitude." },
    { id: "mw_flats", slot: "shoes", shop: "midwood", price: 150, color: "#F4B6C8", brand: "Pointe Taken", name: "Blush Ballet Flats", icon: "🩰",
      line: "Pretty. Painful. Worth it." },
    { id: "mw_shades", slot: "acc", shape: "shades", shop: "midwood", price: 180, color: "#4E342E", brand: "Goldie Gelt", name: "Oversized Sunnies", icon: "🕶️",
      line: "Hides the eyes AND the opinions." },
    { id: "mw_turtle", slot: "top", shop: "midwood", price: 160, color: "#F8BBD0", brand: "Shayna Studio", name: "Blush Turtleneck", icon: "👚",
      line: "Soft enough to forgive everyone." },
    { id: "mw_sweater", slot: "top", shop: "midwood", price: 220, color: "#F3EBD8", brand: "Country Club Kallah", name: "The Cable-Knit Sweater", icon: "🧶",
      line: "Half of the tennis set. Nobody here plays tennis." },
    { id: "mw_tennis", slot: "skirt", shop: "midwood", price: 200, color: "#FAFAFA", brand: "Country Club Kallah", name: "Pleated Tennis Midi", icon: "🎾",
      line: "Below the knee. Above reproach." },
    { id: "mw_satin", slot: "skirt", shop: "midwood", price: 180, color: "#1E1E24", brand: "Maison Motek", name: "Black Satin Midi", icon: "🖤",
      line: "Swishes when she walks. She'll walk a lot." },
    { id: "mw_sneakers", slot: "shoes", shop: "midwood", price: 280, color: "#FFFFFF", brand: "Chunky & Sons", name: "Dad Sneakers", icon: "👟",
      line: "Her father wore these ironically never." },
    { id: "mw_itbag", slot: "acc", shape: "bag", shop: "midwood", price: 480, color: "#E3CBA8", brand: "Goldie Gelt", name: "The It Bag", icon: "👛",
      line: "Holds one lipstick. Diagonally." },
    { id: "mw_puffer", slot: "outer", shape: "puffer", shop: "midwood", price: 650, color: "#F4F4F4", brand: "Kanada Kugel", name: "The Puffer", icon: "🧥",
      line: "Rated for minus forty. Worn at plus sixty." },
    { id: "mw_camel", slot: "outer", shape: "coat", shop: "midwood", price: 900, color: "#C19A6B", brand: "Maison Motek", name: "Camel Long Coat", icon: "🧥",
      line: "The coat that says 'I summer'. It's a verb now." },

    // ── LAKEWOOD: Simcha's Classic Clothing (the yeshivish store) ──
    { id: "lk_tights", slot: "tights", shop: "lakewood", price: 40, color: "#111114", brand: "Simcha's", name: "Black Tights, 60 Denier", icon: "🧦",
      line: "Not forty. Not fifty. Sixty." },
    { id: "lk_nude", slot: "tights", shop: "lakewood", price: 40, color: "#D9AE90", brand: "Simcha's", name: "Nude Tights", icon: "🧦",
      line: "For when you want people to wonder." },
    { id: "lk_blouse", slot: "top", shop: "lakewood", price: 80, color: "#FFFFFF", brand: "Simcha's", name: "White Button-Down", icon: "👔",
      line: "Goes with navy. Goes with black. That's everything." },
    { id: "lk_blue", slot: "top", shop: "lakewood", price: 80, color: "#BBDEFB", brand: "Simcha's", name: "Light-Blue Blouse", icon: "👚",
      line: "Seminary blue. A classic since forever." },
    { id: "lk_navy", slot: "skirt", shop: "lakewood", price: 90, color: "#1A2350", brand: "Simcha's", name: "Navy Pleated Skirt", icon: "👗",
      line: "There are eleven in the store. All navy. All different, apparently." },
    { id: "lk_black", slot: "skirt", shop: "lakewood", price: 90, color: "#1B1B1B", brand: "Simcha's", name: "Black Straight Skirt", icon: "👗",
      line: "Straight. Black. Done. Next customer." },
    { id: "lk_cardigan", slot: "outer", shape: "cardigan", shop: "lakewood", price: 110, color: "#22306B", brand: "Simcha's", name: "Navy Cardigan", icon: "🧶",
      line: "Over everything. Always. Even in July." },
    { id: "lk_shoes", slot: "shoes", shop: "lakewood", price: 120, color: "#1E1A18", brand: "Arch Angel", name: "Sensible Shoes", icon: "👞",
      line: "Arch support for a three-hour Shabbos walk." },
    { id: "lk_pearls", slot: "acc", shape: "pearls", shop: "lakewood", price: 150, color: "#F7F3EA", brand: "Simcha's", name: "Pearls, for the Vort", icon: "📿",
      line: "Every vort. Every sheva brachos. Every Tuesday." },
    { id: "lk_pocketbook", slot: "acc", shape: "bigbag", shop: "lakewood", price: 160, color: "#4A2E22", brand: "Simcha's", name: "The Big Pocketbook", icon: "👜",
      line: "Fits four siddurim, a kugel and somebody's baby." },
    { id: "lk_robe", slot: "outer", shape: "robe", shop: "lakewood", price: 300, color: "#7B1E3A", brand: "Velour Royale", name: "The Shabbos Robe", icon: "👘",
      line: "Velour. A zipper. Royalty, basically." },
    { id: "lk_coat", slot: "outer", shape: "coat", shop: "lakewood", price: 450, color: "#1D2A5C", brand: "Simcha's", name: "Navy Wool Coat", icon: "🧥",
      line: "Lasts twenty years. She'll be told so for all twenty." },

    // ── JFK: Maison de Gelt (the luxury house, Terminal 4½ — a long-term flex: one bag costs more than a house) ──
    { id: "jfk_slippers", slot: "shoes", shop: "jfk", price: 2000, color: "#E9D3A3", brand: "Maison de Gelt", name: "Velvet Loafers", icon: "🥿",
      line: "Hand-stitched by a man named Pierre. Pierre is from Monsey." },
    { id: "jfk_tights", slot: "tights", shop: "jfk", price: 2000, color: "#2A2026", brand: "Maison de Gelt", name: "Silk Tights (Duty Free*)", icon: "🧦",
      line: "*It is not duty free. Nothing here is duty free." },
    { id: "jfk_silk", slot: "top", shop: "jfk", price: 3500, color: "#F3E2C4", brand: "Maison de Gelt", name: "Hand-Ironed Silk Blouse", icon: "👚",
      line: "Ironed by hand. Then ironed again. By a different hand." },
    { id: "jfk_shades", slot: "acc", shape: "shades", shop: "jfk", price: 4000, color: "#1A1410", brand: "Maison de Gelt", name: "Les Lunettes Énormes", icon: "🕶️",
      line: "So big the TSA asked them to go through separately." },
    { id: "jfk_midi", slot: "skirt", shop: "jfk", price: 5000, color: "#120E14", brand: "Maison de Gelt", name: "The Couture Midi", icon: "🖤",
      line: "Below the knee, above your budget." },
    { id: "jfk_wrap", slot: "acc", shape: "scarf", shop: "jfk", price: 6500, color: "#8E1B3A", brand: "Maison de Gelt", name: "Cashmere Travel Wrap", icon: "🧣",
      line: "For the plane. She is not getting on a plane. Still." },
    { id: "jfk_trench", slot: "outer", shape: "coat", shop: "jfk", price: 12000, color: "#D9C29A", brand: "Maison de Gelt", name: "The Gold-Button Trench", icon: "🧥",
      line: "Comes with a garment bag, a certificate and a small speech." },
    { id: "jfk_bag", slot: "acc", shape: "bag", shop: "jfk", price: 25000, color: "#B5121B", brand: "Maison de Gelt", name: "Le Sac Kugel", icon: "👜",
      line: "Costs more than a house. In this game: literally. Holds one kugel." },
];
export const pieceById = id => PIECES.find(p => p.id === id) || null;

/** The shops: which town, the street, the sign, who works there, and the words. */
export const SHOPS = {
    midwood: {
        name: "Avenue J'adore", title: "👗 AVENUE J'ADORE", tagline: "it's SO you",
        where: "Avenue J, between E 8th St and Coney Island Ave",
        sign: ["AVENUE J'ADORE", "boutique · it's SO you · no returns, only exchanges, only Tuesdays"],
        floor: ["#F7EFEA", "#EAD9CF"], wall: "#FBF3EE", trim: "#C9A227", counter: "#F2E3D5", rack: "#C9A227", curtain: "#E8A0B4",
        clerk: { name: "Shayna", key: "npcWoman", colors: { Top: "#1C1C1C", Bottom: "#1C1C1C", Hair: "#E8C15A" } },
        other: [{ name: "a shopper", key: "npcWoman", colors: { Top: "#F5F5F5", Bottom: "#C19A6B", Hair: "#3E2723" } }],
        hello: ["Lulu! Come in, come in. Everything here is SO you. Even the things that aren't.",
            "Okay, I see you. I SEE you. You need the puffer. Everybody needs the puffer.",
            "Welcome to Avenue J'adore! We have three sizes: small, smaller, and 'it runs big'."],
        look: ["Oh that's SO you.", "On you? Stop. STOP.", "That's very you. That's the most you thing I've ever seen.",
            "Gorgeous. Your mother will ask what it cost. Say 'it was on sale'."],
        bought: ["Mazel tov on the purchase! Wear it in good health. And to every vort.", "I'll wrap it. Tissue paper. The good tissue paper.",
            "Done! Tell everyone where you got it. Not the price. The PLACE."],
        poor: ["Sweetie, that's a little more than you have. Window shopping is also shopping."],
        owned: ["You own that! You have taste. Obviously."],
        tried: ["Take your time, the fitting room is all yours. The mirror is VERY flattering. On purpose."],
        other_lines: ["Is the puffer in white? I need it in white. I have it in white. I need another white.",
            "I'm just looking. I've been just looking since nine.", "My husband said one bag. One bag a WEEK, I said."],
        counter: { label: "💳 Pay at the counter", sign: "AVENUE J'ADORE\nexchanges: Tuesdays 2–2:15" },
        wall2: { label: "🪞 The selfie wall", lines: ["A ring light, a neon 'J'ADORE' and a pink wall. Every girl on Avenue J has this photo.",
            "'#AvenueJadore' — 2,400 posts. Same pose. Same wall. Iconic."] },
    },
    lakewood: {
        name: "Simcha's Classic Clothing", title: "👗 SIMCHA'S CLASSIC CLOTHING", tagline: "navy, black, and navy",
        where: "Main St, between Pizza Shmizza and the realtor",
        sign: ["SIMCHA'S CLASSIC CLOTHING", "navy · black · navy · sizes for every simcha"],
        floor: ["#E8E2D6", "#D6CDBD"], wall: "#F2EEE6", trim: "#1D2A5C", counter: "#8D6E63", rack: "#6D4C41", curtain: "#1D2A5C",
        clerk: { name: "Mrs. Rosenbaum", key: "npcWoman", colors: { Top: "#1D2A5C", Bottom: "#1B1B1B", Hair: "#4E342E" } },
        other: [{ name: "a seminary girl", key: "npcWoman", colors: { Top: "#BBDEFB", Bottom: "#1A2350", Hair: "#5D4037" } }],
        hello: ["Come in, sheifele. Who's your mother? …I KNOW your mother! We were in camp together. She was a terrible swimmer.",
            "Navy or black? Don't answer, I'll know when I see you.", "Wipe your feet, mamaleh. The carpet is from before the war. The Gulf war."],
        look: ["Very nice. Very aidel. Your mother will cry.", "This is a good choice. A shidduch choice.",
            "Turn around. …Good. It's long enough. I measured with my eyes.", "Beautiful. It's going to last you till your grandchildren."],
        bought: ["Wear it in good health, sheifele. Bring it back if the hem goes, I'll fix it.", "I'll put it in a bag. A REAL bag. Not a plastic thing.",
            "Done! Tell your mother Mrs. Rosenbaum says hello. She'll know which one."],
        poor: ["Ach, not enough? Come back after Pesach. Everyone has more after Pesach. Actually, no one does."],
        owned: ["You have this already! You want a second, in navy? It IS navy. A second navy."],
        tried: ["Go, go, try. The curtain closes all the way. I had it fixed in 1994."],
        other_lines: ["I need a navy skirt. No — the OTHER navy.", "My seminary sent a list. It says 'navy'. Seventeen times.",
            "Is this black or very dark navy? It matters. It MATTERS."],
        counter: { label: "💳 Pay at the counter", sign: "SIMCHA'S\nthe sheitel macher is UPSTAIRS\n(not us)" },
        wall2: { label: "🪧 The sign by the stairs", lines: ["'SHEITELS: UPSTAIRS. Please do not ask Mrs. Rosenbaum about sheitels.' Someone asked.",
            "'We close early Fridays. Earlier in winter. You'll know.'"] },
    },
};

// (JFK's luxury house: its own room on the same engine — the door is the airport's to give: 3d/docs/airport-plan.md › Sync log)
SHOPS.jfk = {
    name: "Maison de Gelt", title: "👜 MAISON DE GELT", tagline: "duty free (it isn't)",
    where: "JFK, Terminal 4½ — past security, between the gate and the pretzels",
    sign: ["MAISON DE GELT", "paris · milan · terminal 4½"],
    floor: ["#1B1B1F", "#2A2A30"], wall: "#F4EFE6", trim: "#C9A227", counter: "#111114", rack: "#C9A227", curtain: "#5B0F1E",
    clerk: { name: "Giselle (born Gittel)", key: "npcWoman", colors: { Top: "#111114", Bottom: "#111114", Hair: "#1A1A1A" } },
    other: [{ name: "a very rich traveller", key: "npcMan", colors: { Top: "#E9E3D6", Bottom: "#3E2723", Hair: "#BDBDBD" } }],
    hello: ["Bonjour. …Lulu? From Midwood? I'm Gittel. Giselle. Here I'm Giselle.",
        "Welcome to Maison de Gelt. Please don't touch the bag. The bag is resting.",
        "Duty free? Darling, nothing is free. Especially duty."],
    look: ["Magnifique. Also: mamash shayn.", "Très chic. Your Bubbe would say 'for THAT money?'. Ignore her.", "It's you. It's very expensive you."],
    bought: ["Félicitations! I'll wrap it in tissue. Gold tissue. Don't ask.", "Mazel tov. Wear it on the plane you're not taking.",
        "Done! The bag comes with a smaller bag. And a receipt you should hide."],
    poor: ["Ah. You're a little short. A little a lot. Come back when you've sold a house."],
    owned: ["You already own this! You have taste AND money. Rare."],
    tried: ["The fitting room has velvet walls. Also a chair. Also a smaller chair for the bag."],
    other_lines: ["I'll take one in every colour. My jet has a closet.", "Is this duty free? …It's NOT? Then I'll take two, out of spite.",
        "I'm on a layover. Nine hours. I've bought four coats."],
    counter: { label: "💳 Pay at the counter", sign: "MAISON DE GELT\nno refunds · no exchanges\nno touching the bag" },
    wall2: { label: "🖼️ The price list", lines: ["A price list in gold ink. The prices are also in gold ink. Ima would faint.",
        "'All prices include VAT, GST, and a small fee for breathing near the merchandise.'"] },
};

/** Lulu's own lines (tried on · bought · can't afford). */
export const LULU = {
    tried: ["Okay. OKAY. I see it.", "Who IS she? …It's me. I'm she.", "Mirror, mirror… don't answer, I know.", "Ima would say 'it's nice'. Ima says that about everything."],
    bought: ["Mine! 🛍️", "Worth it. Totally worth it. Probably.", "New outfit, new Lulu.", "Don't tell Ima the price. Tell her it was on sale."],
    poor: ["I need more coins. And a job. And a nap.", "So I'll come back. Rich."],
    changed: ["Better.", "Okay, I'm ready for the world.", "Fit check: passed. ✨", "This one today."],
};

/** Timings (seconds) of the changing animation — the curtain + the spin. Skippable at any moment. */
export const ANIM = { curtain: 0.28, spin: 0.55, open: 0.28 };

/** The shopfront as town DATA (features/town/towns/<id>.js › uses.clothes): a storefront between two others, its sign. */
export function clothesUse(town) {
    if (town === "midwood") return { key: "town_mw_store", fallback: "town_mw_store", dims: { w: 10, d: 13, prot: 1.5 }, sign: SHOPS.midwood.sign, spot: "clothes",
        tints: { Walls: "#E9C9CF", Awning: "#C9A227" }, signSize: [8.4, 0.9, 62], signW: 640, signBg: "#FFF5F8", signFg: ["#C2185B", "#8D6E63"],
        with: [-20.8, -10.4, 10.4, 20.8].map(u => ({ key: "town_mw_store", u, list: "avej" })) };
    return { key: "town_shop", fallback: "town_shop", dims: { w: 12, d: 13, prot: 1.5 }, sign: SHOPS.lakewood.sign, spot: "clothes",
        tints: { Walls: "#E6E9F2", Awning: "#1D2A5C" }, signSize: [11.0, 1.0, 100], signBg: "#1D2A5C", signFg: ["#FFFFFF", "#D6DCEF"],
        with: [{ key: "town_shop", u: -13 }, { key: "town_shop", u: 13 }] };
}
