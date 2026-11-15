// features/banter — the roadside billboards: what they say, and the little
// hand-drawn pictures (plain canvas paths, no emoji fonts needed, so they look
// the same on a phone, a TV or a PS5). Each design is drawn once into a
// 1024×512 canvas and cached.
//
// legs: Story Trip legs it belongs to (0 Bubbe · 1 Heshy · 2 beach · 3 Avigail · 4 Vegas);
// generic: also in Cruise (and as filler on any leg). A design may be a
// function of the shared save (the lawyers know how often you've been arrested).
import { shared } from "../../core/save.js";
import { canvasTex } from "../../world.js";

const FONT = `Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;

export const ADS = [
    // ── generic ──
    { id: "ima", generic: true, bg: ["#E3F2FD", "#BBDEFB"], ink: "#0D47A1", accent: "#E91E63", art: "eyes",
        head: "SLOW DOWN", sub: "IMA IS WATCHING", small: "(she also wants to know if you ate)",
        react: ["She IS watching. I can feel it.", "Hi Ima! I'm doing fifty-five!"] },
    { id: "fabio", generic: true, legs: [3], bg: ["#FCE4EC", "#F8BBD0"], ink: "#880E4F", accent: "#8E24AA", art: "scissors",
        head: "FABIO", sub: "HAIR EMERGENCIES 24/7", small: "Your sheitel called. It's worried.",
        react: ["Fabio, I need you. Desperately.", "My hair IS an emergency."] },
    { id: "lawyer", generic: true, dynamic: lawyer },
    { id: "avigail", generic: true, legs: [3], dynamic: avigail },
    { id: "cholent", generic: true, legs: [0], bg: ["#FFF8E1", "#FFE0B2"], ink: "#4E342E", accent: "#D84315", art: "pot",
        head: "HONK IF YOU", sub: "LOVE CHOLENT", small: "Slow-cooked since Friday",
        react: ["*honks internally*", "Who DOESN'T love cholent?"] },
    { id: "bubbeLimit", generic: true, bg: ["#FFFFFF", "#ECEFF1"], ink: "#212121", accent: "#C62828", art: "sign",
        head: "SPEED LIMIT 70", sub: "BUBBE'S LIMIT: 35", small: "and she brakes for butterflies",
        react: ["Bubbe doesn't even DRIVE.", "Thirty-five?! I'd never get anywhere."] },
    { id: "shidduch", generic: true, bg: ["#FFEBEE", "#FFCDD2"], ink: "#B71C1C", accent: "#AD1457", art: "heart",
        head: "SINGLE?", sub: "YOUR BUBBE ALREADY CALLED US", strip: "SHIDDUCH EXPRESS", small: "We know a guy. He's a dentist.",
        react: ["BUBBE!", "I'm DRIVING, not DATING!"] },
    { id: "sushi", generic: true, bg: ["#E0F7FA", "#B2EBF2"], ink: "#006064", accent: "#F4511E", art: "fish",
        head: "KOSHER SUSHI", sub: "IT'S NOT RAW. IT'S SPIRITUAL.", small: "Now with extra wasabi-chrain",
        react: ["Spiritual fish. Mmm.", "Is that fish wearing a kippah?"] },
    { id: "yourAd", generic: true, bg: ["#FFFDE7", "#FFF59D"], ink: "#3E2723", accent: "#7B1FA2", art: "star",
        head: "YOUR AD HERE", sub: "AVIGAIL ALREADY TRIED TO BUY IT", small: "Call 1-800-NOT-AVIGAIL",
        react: ["Of COURSE she did.", "Classic Avigail."] },
    { id: "callBubbe", generic: true, legs: [0], bg: ["#F3E5F5", "#E1BEE7"], ink: "#4A148C", accent: "#E91E63", art: "phone",
        head: "DID YOU CALL", sub: "YOUR BUBBE BACK?", small: "This billboard is a reminder. And a guilt trip.",
        react: ["…I'll call her at the next stop.", "Even the BILLBOARDS know."] },
    { id: "carwash", generic: true, bg: ["#E1F5FE", "#B3E5FC"], ink: "#01579B", accent: "#00ACC1", art: "bubbles",
        head: "MOISHE'S CAR WASH", sub: "WE GET OUT KUGEL STAINS", small: "and floatie glitter. and sand. mostly sand.",
        react: ["My back seat NEEDS this.", "Moishe, you're a hero."] },
    { id: "pie", generic: true, bg: ["#FBE9E7", "#FFCCBC"], ink: "#4E342E", accent: "#D84315", art: "pie",
        head: "TAMMY'S DINER", sub: "PIE SO GOOD YOU'LL CALL YOUR MOTHER", strip: "NEXT EXIT →",
        react: ["Pie… must… keep… driving.", "Tammy's pie? Don't tempt me."] },
    { id: "trafficSchool", generic: true, bg: ["#FFF3E0", "#FFE0B2"], ink: "#3E2723", accent: "#EF6C00", art: "car",
        head: "TRAFFIC SCHOOL", sub: "LULU, WE SAVED YOU A SEAT", small: "Front row. Next to the window.",
        react: ["Rude. Accurate, but rude.", "How do they know my NAME?"] },
    { id: "morgan", generic: true, legs: [2], bg: ["#F3E5F5", "#FCE4EC"], ink: "#6A1B9A", accent: "#EC407A", art: "unicorn",
        head: "LOST: MORGAN", sub: "PLUSH UNICORN · VERY SOFT", small: "If found: I'm in the back seat. — Dina",
        react: ["Dina, Morgan is in your BACKPACK.", "Aww, Dina made a billboard!"] },
    { id: "sweater", generic: true, bg: ["#E8F5E9", "#C8E6C9"], ink: "#1B5E20", accent: "#E53935", art: "sweater",
        head: "IT'S COLD.", sub: "WEAR A SWEATER.", small: "— Your Mother",
        react: ["It's EIGHTY degrees, Ima.", "…fine. I'll wear the sweater."] },
    // ── leg 0: Bubbe's (erev Shabbos) ──
    { id: "kugel", generic: true, legs: [0], bg: ["#FFF8E1", "#FFE082"], ink: "#5D4037", accent: "#E65100", art: "kugel",
        head: "BUBBE'S KUGEL", sub: "YOU LOOK THIN.", strip: "2 MILES →", small: "Fresh from the oven since 1962",
        react: ["Bubbe has a BILLBOARD now?!", "I don't look thin! …do I?"] },
    { id: "candles", legs: [0], bg: ["#1A237E", "#311B92"], ink: "#FFF8E1", accent: "#FFC107", art: "candles",
        head: "CANDLE LIGHTING SOON", sub: "DRIVE FASTER (SAFELY!)", small: "Bubbe is already standing at the window",
        react: ["I know, I KNOW!", "She's at the window. I can FEEL it."] },
    { id: "challah", legs: [0], bg: ["#FFF3E0", "#FFCC80"], ink: "#4E342E", accent: "#BF360C", art: "challah",
        head: "CHALLAH 4 LESS", sub: "BRAIDED BY BUBBES", small: "Ask about our raisin policy",
        react: ["Raisins in challah. Controversial.", "Now I'm hungry. Thanks, sign."] },
    // ── leg 1: Heshy's pool ──
    { id: "heshyPool", generic: true, legs: [1], bg: ["#E0F7FA", "#80DEEA"], ink: "#01579B", accent: "#FF7043", art: "floatie",
        head: "HESHY'S POOL SUPPLIES", sub: "WE'RE ALWAYS OPEN", small: "(Heshy is always in the pool)",
        react: ["Heshy has a STORE?", "Always in the pool. Accurate."] },
    { id: "cannonball", legs: [1], bg: ["#E3F2FD", "#90CAF9"], ink: "#0D47A1", accent: "#00ACC1", art: "bubbles",
        head: "CANNONBALL ACADEMY", sub: "SPLASH ZONE: EVERYWHERE", small: "Founder & only teacher: Heshy",
        react: ["He's been practicing.", "Heshy, you have a PROBLEM."] },
    { id: "spf", legs: [1, 2], bg: ["#FFFDE7", "#FFF176"], ink: "#E65100", accent: "#F57F17", art: "sun",
        head: "SUNSCREEN", sub: "SPF 100 · IMA'S ORDERS", small: "Reapply every 20 minutes. She'll check.",
        react: ["SPF 100 is basically a coat.", "Ima got to the billboard people."] },
    // ── leg 2: the beach ──
    { id: "seagulls", legs: [2], bg: ["#E1F5FE", "#81D4FA"], ink: "#01579B", accent: "#F9A825", art: "seagull",
        head: "SEAGULL CROSSING", sub: "THEY WILL TAKE YOUR SANDWICH", small: "They know where you parked.",
        react: ["Not my sandwich. Not today.", "I have NO snacks, birds!"] },
    // ── leg 3: Avigail's ──
    { id: "spa", legs: [3], bg: ["#F3E5F5", "#CE93D8"], ink: "#4A148C", accent: "#EC407A", art: "star",
        head: "MANI · PEDI · KUGEL", sub: "THE SPA THAT'S ALSO A DELI", small: "Cucumber eye slices on request (pickled)",
        react: ["Finally, someone gets me.", "Pickled cucumbers on the eyes. Bold."] },
    // ── leg 4: Vegas ──
    { id: "vegas", legs: [4], bg: ["#1A0033", "#4A148C"], ink: "#FFFFFF", accent: "#FFD600", art: "dice",
        head: "WHAT HAPPENS IN VEGAS", sub: "…BUBBE HEARS ABOUT", small: "She has sources.",
        react: ["She hears about EVERYTHING.", "Bubbe's sources are everywhere."] },
    { id: "burry", legs: [4], bg: ["#E8F5E9", "#A5D6A7"], ink: "#1B5E20", accent: "#FF6F00", art: "car",
        head: "BURRY'S BIG MOVE", sub: "LAKEWOOD → VEGAS", small: "Honk if you're bringing kugel",
        react: ["Uncle Burry, we're COMING!", "He put it on a BILLBOARD?"] },
    { id: "fountains", legs: [4], bg: ["#0D47A1", "#1976D2"], ink: "#FFFFFF", accent: "#4DD0E1", art: "fountain",
        head: "DANCING FOUNTAINS", sub: "HESHY, STAY IN THE CAR", small: "This means you, Heshy.",
        react: ["He will NOT stay in the car.", "Heshy's going in. I know it."] },
    { id: "buffet", legs: [4], bg: ["#FFF8E1", "#FFD54F"], ink: "#3E2723", accent: "#C62828", art: "pot",
        head: "KOSHER BUFFET", sub: "ALL YOU CAN EAT · 24/7", small: "Stretchy pants sold at the door",
        react: ["Stretchy pants. Smart.", "All I can eat? Challenge accepted."] },
];

// ── dynamic designs (read the shared save when the billboard is made) ─────
function lawyer() {
    const s = shared.get(), c = s.convictions || 0, o = s.offenses || 0;
    const base = { bg: ["#ECEFF1", "#CFD8DC"], ink: "#263238", accent: "#6D4C41", art: "gavel" };
    if (c >= 5) return Object.assign(base, { key: "lawyer4", head: "THANK YOU, LULU!", sub: "WE BOUGHT A BOAT", small: "— Goldberg & Goldberg, your lawyers",
        strip: "10th ARREST FREE!", react: ["They bought a BOAT?!", "I'm basically funding their retirement."] });
    if (c >= 2) return Object.assign(base, { key: "lawyer3", head: "LULU! IT'S US!", sub: "YOUR LAWYERS", small: "Please. Slow. Down. — Goldberg & Goldberg",
        react: ["They know my NAME?!", "Hi guys! Miss me?"] });
    if (c >= 1 || o >= 1) return Object.assign(base, { key: "lawyer2", head: "ARRESTED? AGAIN?", sub: "GOLDBERG & GOLDBERG", small: "We do payment plans. And rugelach.",
        react: ["AGAIN? It was ONE time! …ish.", "Payment plans. Noted."] });
    return Object.assign(base, { key: "lawyer1", head: "GOLDBERG & GOLDBERG", sub: "ATTORNEYS AT LAW", small: "Arrested? You won't be. You're a good girl.",
        react: ["Don't need 'em! …probably.", "Good girl. That's me."] });
}
function avigail() {
    const s = shared.get(), r = typeof s.avigailRel === "number" ? s.avigailRel : 50;
    const base = { bg: ["#F3E5F5", "#E1BEE7"], ink: "#4A148C", accent: "#AB47BC", art: "heart" };
    if (r >= 65) return Object.assign(base, { key: "avigail3", head: "AVIGAIL ♥ LULU", sub: "BESTIES 4 EVER", small: "(don't make it weird)",
        react: ["Aww! …wait, she paid for this?", "Okay, that's actually sweet."] });
    if (r <= 35) return Object.assign(base, { key: "avigail1", art: "star", head: "AVIGAIL", sub: "PRETTIER THAN WHOEVER'S READING THIS", small: "Paid for by Avigail",
        react: ["She bought a BILLBOARD?! Of COURSE she did.", "Rude. And low-res."] });
    return Object.assign(base, { key: "avigail2", art: "star", head: "AVIGAIL'S BOUTIQUE", sub: "CUTE CAR, I GUESS", small: "Paid for by Avigail",
        react: ["She's SUBTWEETING me with a billboard.", "Cute car, you GUESS?!"] });
}

/** The design as it should look right now (dynamic ones resolved). */
export function resolve(ad) {
    if (!ad.dynamic) return Object.assign({ key: ad.id }, ad);
    return Object.assign({ id: ad.id }, ad.dynamic());
}
export function adById(id) { return ADS.find(a => a.id === id) || null; }

// ── texture ────────────────────────────────────────────────────────────────
/** Paint the billboard face for a resolved design (the caller caches it). */
export function adTexture(d) {
    const t = canvasTex(1024, 512, (g, w, h) => paint(g, w, h, d), false);
    t.anisotropy = 4;
    return t;
}

function paint(g, w, h, d) {
    // background + a soft pattern
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, d.bg[0]); grd.addColorStop(1, d.bg[1]);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.save(); g.globalAlpha = 0.07; g.fillStyle = d.ink;
    for (let y = 18; y < h; y += 36) for (let x = (y / 36 % 2) * 18 + 10; x < w; x += 36) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.restore();
    // frame
    g.strokeStyle = d.accent; g.lineWidth = 12;
    rr(g, 16, 16, w - 32, h - 32, 26); g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.65)"; g.lineWidth = 4;
    rr(g, 30, 30, w - 60, h - 60, 18); g.stroke();
    // picture badge
    const cx = 205, cy = 246, R = 160;
    g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.arc(cx + 6, cy + 9, R, 0, 7); g.fill();
    g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = d.accent; g.lineWidth = 12; g.stroke();
    g.save(); g.beginPath(); g.arc(cx, cy, R - 6, 0, 7); g.clip();
    g.translate(cx, cy); g.scale(R / 150, R / 150);
    try { (ART[d.art] || ART.star)(g, d); } catch (e) { /* a picture never breaks a billboard */ }
    g.restore();
    // words
    const x0 = 400, x1 = 985, mid = (x0 + x1) / 2, tw = x1 - x0;
    const strip = d.strip ? 70 : 0;
    const blocks = [];
    const headLines = wrap(g, d.head, tw, 92, 52, 2);
    blocks.push({ lines: headLines.lines, size: headLines.size, color: d.ink, stroke: true, weight: 700 });
    if (d.sub) { const s = wrap(g, d.sub, tw, 56, 30, 2); blocks.push({ lines: s.lines, size: s.size, color: d.accent, weight: 700 }); }
    if (d.small) { const s = wrap(g, d.small, tw, 30, 20, 2); blocks.push({ lines: s.lines, size: s.size, color: d.ink, alpha: 0.78, weight: 500 }); }
    const gapB = 14;
    let total = 0;
    for (const b of blocks) total += b.lines.length * b.size * 1.08;
    total += gapB * (blocks.length - 1);
    let y = 40 + (h - 80 - strip - total) / 2;
    g.textAlign = "center"; g.textBaseline = "top";
    for (const b of blocks) {
        g.font = `${b.weight} ${b.size}px ${FONT}`;
        for (const ln of b.lines) {
            g.globalAlpha = b.alpha || 1;
            if (b.stroke) { g.lineJoin = "round"; g.lineWidth = Math.max(6, b.size * 0.12); g.strokeStyle = "rgba(255,255,255,0.85)"; g.strokeText(ln, mid, y); }
            g.fillStyle = b.color; g.fillText(ln, mid, y);
            g.globalAlpha = 1;
            y += b.size * 1.08;
        }
        y += gapB;
    }
    if (d.strip) {
        g.fillStyle = d.accent;
        rr(g, x0 + 10, h - 40 - strip, tw - 20, strip - 8, 18); g.fill();
        g.fillStyle = "#FFFFFF";
        const s = fit(g, d.strip, tw - 60, 44, 24, 700);
        g.font = `700 ${s}px ${FONT}`; g.textBaseline = "middle";
        g.fillText(d.strip, mid, h - 44 - strip / 2 + 4);
    }
}

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fit(g, text, maxW, size, min, weight = 700) {
    for (; size > min; size -= 2) { g.font = `${weight} ${size}px ${FONT}`; if (g.measureText(text).width <= maxW) break; }
    return size;
}
/** Fit text into at most maxLines lines of width maxW, shrinking from `size` down to `min`. */
function wrap(g, text, maxW, size, min, maxLines) {
    const words = String(text).split(" ");
    for (; size >= min; size -= 2) {
        g.font = `700 ${size}px ${FONT}`;
        const lines = [];
        let cur = "";
        for (const wd of words) {
            const t = cur ? cur + " " + wd : wd;
            if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = wd; }
        }
        if (cur) lines.push(cur);
        if (lines.length <= maxLines && lines.every(l => g.measureText(l).width <= maxW)) return { lines, size };
    }
    return { lines: [text], size: min };
}

// ── the little pictures (drawn around 0,0 in a ~±140 box) ──────────────────
const ART = {
    eyes(g) {
        for (const s of [-1, 1]) {
            g.fillStyle = "#FFFFFF"; g.strokeStyle = "#263238"; g.lineWidth = 7;
            g.beginPath(); g.ellipse(s * 58, 0, 52, 66, 0, 0, 7); g.fill(); g.stroke();
            g.fillStyle = "#5D4037"; g.beginPath(); g.arc(s * 58 + 14, 12, 28, 0, 7); g.fill();
            g.fillStyle = "#111"; g.beginPath(); g.arc(s * 58 + 16, 14, 15, 0, 7); g.fill();
            g.fillStyle = "#FFF"; g.beginPath(); g.arc(s * 58 + 8, 4, 7, 0, 7); g.fill();
            g.strokeStyle = "#263238"; g.lineWidth = 9; g.lineCap = "round";
            g.beginPath(); g.moveTo(s * 58 - 44, -86 + (s > 0 ? 0 : 6)); g.quadraticCurveTo(s * 58, -112, s * 58 + 44, -86 + (s > 0 ? 8 : 0)); g.stroke();
        }
    },
    scissors(g) {
        g.lineCap = "round";
        g.strokeStyle = "#90A4AE"; g.lineWidth = 22;
        g.beginPath(); g.moveTo(-20, 30); g.lineTo(95, -90); g.stroke();
        g.beginPath(); g.moveTo(20, 30); g.lineTo(-95, -90); g.stroke();
        g.strokeStyle = "#E91E63"; g.lineWidth = 16;
        for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 48, 78, 38, 0, 7); g.stroke(); }
        g.fillStyle = "#37474F"; g.beginPath(); g.arc(0, 8, 10, 0, 7); g.fill();
        g.fillStyle = "#FFD54F";
        for (const [x, y] of [[-100, 10], [100, 0], [0, -110]]) star(g, x, y, 18, 8);
    },
    gavel(g) {
        g.save(); g.rotate(-0.6);
        g.fillStyle = "#8D6E63"; g.fillRect(-12, -10, 24, 140);
        g.fillStyle = "#6D4C41"; rr(g, -70, -60, 140, 62, 14); g.fill();
        g.fillStyle = "#A1887F"; g.fillRect(-74, -52, 16, 46); g.fillRect(58, -52, 16, 46);
        g.restore();
        g.fillStyle = "#5D4037"; rr(g, -90, 92, 180, 30, 10); g.fill();
    },
    heart(g) {
        g.fillStyle = "#E91E63";
        g.beginPath(); g.moveTo(0, 105);
        g.bezierCurveTo(-150, 0, -90, -120, 0, -45);
        g.bezierCurveTo(90, -120, 150, 0, 0, 105); g.fill();
        g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(-52, -38, 22, 14, -0.6, 0, 7); g.fill();
    },
    pot(g) {
        g.strokeStyle = "rgba(120,120,120,0.55)"; g.lineWidth = 9; g.lineCap = "round";
        for (const x of [-40, 0, 40]) { g.beginPath(); g.moveTo(x, -50); g.bezierCurveTo(x - 22, -80, x + 22, -100, x, -130); g.stroke(); }
        g.fillStyle = "#546E7A"; rr(g, -105, -40, 210, 130, 30); g.fill();
        g.fillStyle = "#78909C"; rr(g, -118, -52, 236, 26, 12); g.fill();
        g.fillStyle = "#37474F"; rr(g, -150, -20, 44, 20, 8); g.fill(); rr(g, 106, -20, 44, 20, 8); g.fill();
        g.fillStyle = "#90A4AE"; g.fillRect(-80, 0, 40, 10);
    },
    sign(g) {
        g.fillStyle = "#FFFFFF"; g.strokeStyle = "#111"; g.lineWidth = 8;
        rr(g, -82, -110, 164, 210, 16); g.fill(); g.stroke();
        g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 30px ${FONT}`; g.fillText("BUBBE", 0, -72);
        g.font = `700 92px ${FONT}`; g.fillText("35", 0, 22);
        g.fillStyle = "#C62828"; g.beginPath(); g.arc(70, 92, 30, 0, 7); g.fill();
        g.fillStyle = "#FFF"; g.font = `700 22px ${FONT}`; g.fillText("❤", 70, 94);
    },
    fish(g) {
        g.fillStyle = "#FF8A65";
        g.beginPath(); g.ellipse(-10, 10, 100, 58, 0, 0, 7); g.fill();
        g.beginPath(); g.moveTo(80, 10); g.lineTo(140, -45); g.lineTo(140, 65); g.closePath(); g.fill();
        g.fillStyle = "#FFF"; g.beginPath(); g.arc(-62, -4, 16, 0, 7); g.fill();
        g.fillStyle = "#111"; g.beginPath(); g.arc(-66, -4, 8, 0, 7); g.fill();
        g.strokeStyle = "#E64A19"; g.lineWidth = 6;
        for (const x of [-10, 20, 50]) { g.beginPath(); g.arc(x, 10, 34, -0.9, 0.9); g.stroke(); }
        // a tiny kippah
        g.fillStyle = "#1565C0"; g.beginPath(); g.ellipse(-30, -62, 34, 14, 0, Math.PI, 0); g.fill();
        // rice
        g.fillStyle = "#FFFFFF"; rr(g, -110, 70, 210, 46, 20); g.fill(); g.strokeStyle = "#ECEFF1"; g.lineWidth = 4; g.stroke();
    },
    star(g) {
        g.fillStyle = "#FFC107"; star(g, 0, 0, 120, 52);
        g.fillStyle = "#FFF8E1"; star(g, -18, -22, 26, 12);
        g.fillStyle = "#E91E63"; for (const [x, y] of [[-110, -95], [110, 80], [95, -100]]) star(g, x, y, 20, 9);
    },
    phone(g) {
        g.save(); g.rotate(-0.25);
        g.fillStyle = "#263238"; rr(g, -62, -112, 124, 224, 22); g.fill();
        g.fillStyle = "#81D4FA"; rr(g, -50, -92, 100, 172, 10); g.fill();
        g.fillStyle = "#FFF"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 22px ${FONT}`;
        g.fillText("BUBBE", 0, -50); g.font = `700 16px ${FONT}`; g.fillText("calling…", 0, -22);
        g.fillStyle = "#43A047"; g.beginPath(); g.arc(0, 40, 22, 0, 7); g.fill();
        g.restore();
        g.strokeStyle = "#E91E63"; g.lineWidth = 8; g.lineCap = "round";
        for (const r of [90, 115]) { g.beginPath(); g.arc(20, -30, r, -0.9, -0.3); g.stroke(); g.beginPath(); g.arc(-20, -30, r, Math.PI + 0.3, Math.PI + 0.9); g.stroke(); }
    },
    bubbles(g) {
        g.fillStyle = "#4FC3F7"; rr(g, -120, 20, 240, 70, 26); g.fill();
        g.fillStyle = "#0288D1"; g.beginPath(); g.arc(-70, 92, 22, 0, 7); g.arc(70, 92, 22, 0, 7); g.fill();
        g.fillStyle = "#B3E5FC"; rr(g, -70, -18, 130, 46, 16); g.fill();
        for (const [x, y, r] of [[-90, -60, 30], [-30, -95, 22], [40, -70, 36], [100, -105, 20], [95, -30, 18]]) {
            g.fillStyle = "rgba(255,255,255,0.9)"; g.strokeStyle = "#4DD0E1"; g.lineWidth = 5;
            g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
            g.fillStyle = "#E1F5FE"; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, 7); g.fill();
        }
    },
    pie(g) {
        g.fillStyle = "#FFE0B2"; g.beginPath(); g.ellipse(0, 40, 130, 56, 0, 0, 7); g.fill();
        g.fillStyle = "#D7A15A"; g.beginPath(); g.ellipse(0, 20, 126, 52, 0, 0, 7); g.fill();
        g.strokeStyle = "#B7793A"; g.lineWidth = 7;
        for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 34 - 20, -20); g.lineTo(i * 34 + 20, 60); g.stroke(); }
        g.fillStyle = "#C62828"; g.beginPath(); g.arc(0, -56, 18, 0, 7); g.fill();
        g.strokeStyle = "rgba(150,150,150,0.5)"; g.lineWidth = 7; g.lineCap = "round";
        for (const x of [-50, 50]) { g.beginPath(); g.moveTo(x, -50); g.bezierCurveTo(x - 18, -80, x + 18, -95, x, -125); g.stroke(); }
    },
    car(g) {
        g.fillStyle = "#E91E63"; rr(g, -130, -10, 260, 70, 26); g.fill();
        g.beginPath(); g.moveTo(-70, -10); g.quadraticCurveTo(-40, -80, 30, -78); g.quadraticCurveTo(70, -76, 90, -10); g.fill();
        g.fillStyle = "#B3E5FC"; g.beginPath(); g.moveTo(-50, -12); g.quadraticCurveTo(-28, -62, 20, -62); g.lineTo(20, -12); g.fill();
        g.beginPath(); g.moveTo(32, -62); g.quadraticCurveTo(62, -58, 74, -12); g.lineTo(32, -12); g.fill();
        g.fillStyle = "#263238"; for (const x of [-75, 75]) { g.beginPath(); g.arc(x, 62, 32, 0, 7); g.fill(); }
        g.fillStyle = "#CFD8DC"; for (const x of [-75, 75]) { g.beginPath(); g.arc(x, 62, 13, 0, 7); g.fill(); }
        g.fillStyle = "#FFF59D"; g.beginPath(); g.arc(122, 14, 12, 0, 7); g.fill();
        g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 7; g.lineCap = "round";
        for (const y of [-40, 0, 40]) { g.beginPath(); g.moveTo(-150 - (y === 0 ? 20 : 0), y); g.lineTo(-135, y); g.stroke(); }
    },
    unicorn(g) {
        g.fillStyle = "#FFFFFF"; g.strokeStyle = "#CE93D8"; g.lineWidth = 7;
        g.beginPath(); g.ellipse(0, 30, 82, 92, 0, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(-10, 92, 60, 40, 0, 0, 7); g.fill(); g.stroke();
        g.fillStyle = "#FFD54F"; g.beginPath(); g.moveTo(-18, -55); g.lineTo(0, -140); g.lineTo(18, -55); g.closePath(); g.fill();
        g.strokeStyle = "#FFA000"; g.lineWidth = 4; for (const y of [-75, -95, -115]) { g.beginPath(); g.moveTo(-12, y + 8); g.lineTo(12, y); g.stroke(); }
        g.fillStyle = "#F48FB1"; for (const [x, y, r] of [[-70, -30, 28], [-88, 10, 24], [-80, 50, 22], [70, -36, 26]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.fillStyle = "#111"; for (const x of [-28, 28]) { g.beginPath(); g.arc(x, 20, 9, 0, 7); g.fill(); }
        g.fillStyle = "#F8BBD0"; for (const x of [-42, 42]) { g.beginPath(); g.ellipse(x, 48, 13, 8, 0, 0, 7); g.fill(); }
        g.fillStyle = "#CE93D8"; for (const x of [-24, 4]) { g.beginPath(); g.arc(x, 96, 6, 0, 7); g.fill(); }
    },
    sweater(g) {
        g.fillStyle = "#E53935";
        g.beginPath(); g.moveTo(-60, -95); g.lineTo(60, -95); g.lineTo(130, -40); g.lineTo(105, 10); g.lineTo(78, -8); g.lineTo(78, 110);
        g.lineTo(-78, 110); g.lineTo(-78, -8); g.lineTo(-105, 10); g.lineTo(-130, -40); g.closePath(); g.fill();
        g.fillStyle = "#FFFFFF"; g.beginPath(); g.ellipse(0, -95, 34, 16, 0, 0, Math.PI); g.fill();
        g.fillStyle = "#FFF"; for (let i = -2; i <= 2; i++) star(g, i * 30, 30, 11, 5);
        g.fillStyle = "#B71C1C"; g.fillRect(-78, 90, 156, 20);
    },
    kugel(g) {
        g.strokeStyle = "rgba(150,150,150,0.5)"; g.lineWidth = 8; g.lineCap = "round";
        for (const x of [-50, 0, 50]) { g.beginPath(); g.moveTo(x, -55); g.bezierCurveTo(x - 20, -85, x + 20, -100, x, -130); g.stroke(); }
        g.fillStyle = "#90A4AE"; rr(g, -130, -10, 260, 100, 20); g.fill();
        g.fillStyle = "#FFB74D"; rr(g, -118, -40, 236, 70, 24); g.fill();
        g.fillStyle = "#E65100";
        for (const [x, y] of [[-80, -22], [-40, -10], [0, -26], [40, -14], [82, -24], [-60, 6], [20, 6], [70, 4]]) { g.beginPath(); g.ellipse(x, y, 14, 7, 0.3, 0, 7); g.fill(); }
        g.fillStyle = "#78909C"; rr(g, -160, 0, 36, 22, 8); g.fill(); rr(g, 124, 0, 36, 22, 8); g.fill();
    },
    candles(g) {
        for (const s of [-1, 1]) {
            g.fillStyle = "#CFD8DC"; rr(g, s * 50 - 34, 70, 68, 26, 8); g.fill();
            g.fillStyle = "#B0BEC5"; g.fillRect(s * 50 - 10, 30, 20, 44);
            g.fillStyle = "#FFFFFF"; rr(g, s * 50 - 16, -60, 32, 96, 6); g.fill();
            g.fillStyle = "#FFC107"; g.beginPath(); g.moveTo(s * 50, -120); g.quadraticCurveTo(s * 50 + 22, -82, s * 50, -66); g.quadraticCurveTo(s * 50 - 22, -82, s * 50, -120); g.fill();
            g.fillStyle = "#FFF59D"; g.beginPath(); g.ellipse(s * 50, -82, 7, 12, 0, 0, 7); g.fill();
        }
    },
    challah(g) {
        g.fillStyle = "#C77D2E"; g.strokeStyle = "#8D5524"; g.lineWidth = 5;
        for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * 44, (i % 2) * 8, 40, 52 - Math.abs(i) * 8, i * 0.35, 0, 7); g.fill(); g.stroke(); }
        g.fillStyle = "#FFF8E1"; for (const [x, y] of [[-60, -20], [-20, -30], [30, -24], [70, -12], [0, 10], [-44, 18], [52, 22]]) { g.beginPath(); g.ellipse(x, y, 4, 2.5, 0.5, 0, 7); g.fill(); }
        g.fillStyle = "rgba(255,255,255,0.3)"; g.beginPath(); g.ellipse(-30, -26, 60, 14, -0.1, 0, 7); g.fill();
    },
    floatie(g) {
        g.lineWidth = 58;
        const cols = ["#FF7043", "#FFFFFF"];
        for (let i = 0; i < 8; i++) { g.strokeStyle = cols[i % 2]; g.beginPath(); g.arc(0, 0, 82, i * Math.PI / 4, (i + 1) * Math.PI / 4 + 0.01); g.stroke(); }
        g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 96, 3.6, 4.6); g.stroke();
        g.fillStyle = "#4FC3F7"; g.globalAlpha = 0.6;
        g.beginPath(); g.moveTo(-150, 120); for (let x = -150; x <= 150; x += 30) g.quadraticCurveTo(x + 15, 100, x + 30, 120); g.lineTo(150, 160); g.lineTo(-150, 160); g.fill();
        g.globalAlpha = 1;
    },
    seagull(g) {
        g.fillStyle = "#FFFFFF"; g.strokeStyle = "#78909C"; g.lineWidth = 6;
        g.beginPath(); g.ellipse(0, 20, 70, 44, 0, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.arc(-62, -20, 34, 0, 7); g.fill(); g.stroke();
        g.fillStyle = "#B0BEC5"; g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(60, -90, 130, -40); g.quadraticCurveTo(70, -20, 40, 20); g.fill();
        g.fillStyle = "#FFB300"; g.beginPath(); g.moveTo(-92, -22); g.lineTo(-140, -10); g.lineTo(-92, -6); g.fill();
        g.fillStyle = "#111"; g.beginPath(); g.arc(-70, -28, 6, 0, 7); g.fill();
        // the stolen sandwich
        g.fillStyle = "#FFE0B2"; rr(g, -150, 40, 80, 26, 6); g.fill(); g.fillStyle = "#66BB6A"; g.fillRect(-150, 50, 80, 6);
    },
    sun(g) {
        g.fillStyle = "#FFB300";
        for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * Math.PI / 6); g.beginPath(); g.moveTo(-14, -80); g.lineTo(0, -132); g.lineTo(14, -80); g.fill(); g.restore(); }
        g.fillStyle = "#FFD54F"; g.beginPath(); g.arc(0, 0, 78, 0, 7); g.fill();
        g.fillStyle = "#263238"; rr(g, -56, -20, 48, 28, 10); g.fill(); rr(g, 8, -20, 48, 28, 10); g.fill(); g.fillRect(-10, -12, 20, 6);
        g.strokeStyle = "#E65100"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.arc(0, 22, 30, 0.3, Math.PI - 0.3); g.stroke();
    },
    dice(g) {
        const die = (x, y, a, n) => {
            g.save(); g.translate(x, y); g.rotate(a);
            g.fillStyle = "#FFFFFF"; g.strokeStyle = "#D32F2F"; g.lineWidth = 6; rr(g, -55, -55, 110, 110, 18); g.fill(); g.stroke();
            g.fillStyle = "#D32F2F";
            const P = { 1: [[0, 0]], 3: [[-28, -28], [0, 0], [28, 28]], 5: [[-28, -28], [28, -28], [0, 0], [-28, 28], [28, 28]], 6: [[-28, -30], [28, -30], [-28, 0], [28, 0], [-28, 30], [28, 30]] }[n];
            for (const [px, py] of P) { g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill(); }
            g.restore();
        };
        die(-50, 30, -0.3, 5); die(55, -30, 0.25, 6);
        g.fillStyle = "#FFD600"; star(g, 95, 80, 22, 9); star(g, -100, -80, 18, 8);
    },
    fountain(g) {
        g.strokeStyle = "#4DD0E1"; g.lineWidth = 10; g.lineCap = "round";
        for (const [x, hgt] of [[-70, 90], [0, 130], [70, 90]]) { g.beginPath(); g.moveTo(x, 60); g.quadraticCurveTo(x, 60 - hgt, x + 30, 60 - hgt * 0.4); g.stroke(); g.beginPath(); g.moveTo(x, 60); g.quadraticCurveTo(x, 60 - hgt, x - 30, 60 - hgt * 0.4); g.stroke(); }
        g.fillStyle = "#E0F7FA"; for (const [x, y] of [[-40, -60], [40, -70], [0, -100], [-100, -10], [100, -20]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
        g.fillStyle = "#90A4AE"; rr(g, -130, 56, 260, 40, 14); g.fill();
        g.fillStyle = "#29B6F6"; rr(g, -118, 60, 236, 16, 8); g.fill();
        // a floatie — Heshy's
        g.strokeStyle = "#FF7043"; g.lineWidth = 12; g.beginPath(); g.arc(70, 66, 20, Math.PI, 0); g.stroke();
    },
};
function star(g, x, y, R, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    g.closePath(); g.fill();
}
