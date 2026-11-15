// features/play — photo-mode looks. FILTERS are cheap screen-space colour
// grades: a CSS filter on the live canvas (and the same ops baked into the
// saved PNG — via ctx.filter, or a colour matrix where that's unsupported)
// plus a light 2D wash (vignette / haze / grain). FRAMES are 2D overlays.
// drawOverlay() draws wash + frame onto any 2D canvas, so the live preview and
// the saved photo are the same pixels at different sizes.

// ── filters ──────────────────────────────────────────────────────────────
export const FILTERS = [
    { id: "natural", name: "Natural", emoji: "🌤️", ops: [] },
    { id: "golden", name: "Golden Hour", emoji: "🌅", ops: [["sepia", 0.28], ["saturate", 1.45], ["hue-rotate", -10], ["brightness", 1.05], ["contrast", 1.06]] },
    { id: "vintage", name: "Vintage", emoji: "📼", ops: [["sepia", 0.62], ["contrast", 0.9], ["brightness", 1.05], ["saturate", 0.85]] },
    { id: "noir", name: "Noir", emoji: "🎬", ops: [["grayscale", 1], ["contrast", 1.38], ["brightness", 0.94]] },
    { id: "pink", name: "Pink Dream", emoji: "🌸", ops: [["saturate", 1.2], ["hue-rotate", -16], ["brightness", 1.08], ["contrast", 0.95]] },
    { id: "pop", name: "Pop", emoji: "🍭", ops: [["saturate", 1.9], ["contrast", 1.2], ["brightness", 1.03]] },
];
export function filterCss(f) {
    if (!f || !f.ops.length) return "none";
    return f.ops.map(([op, v]) => op === "hue-rotate" ? `hue-rotate(${v}deg)` : `${op}(${v})`).join(" ");
}

// The same ops as a 3×4 colour matrix (Filter Effects spec), for browsers whose 2D
// canvas has no ctx.filter (older Safari).
function opMatrix(op, v) {
    const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    switch (op) {
        case "brightness": return [v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0];
        case "contrast": { const o = 0.5 - 0.5 * v; return [v, 0, 0, o, 0, v, 0, o, 0, 0, v, o]; }
        case "grayscale": { const a = 1 - v; return [0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0, 0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0, 0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a, 0]; }
        case "sepia": { const a = 1 - v; return [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0, 0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0]; }
        case "saturate": return [0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0, 0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0];
        case "hue-rotate": {
            const a = v * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
            return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
                0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
                0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0];
        }
    }
    return I;
}
function mul(a, b) {   // a ∘ b (apply b first)
    const o = new Array(12);
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c];
        o[r * 4 + 3] = a[r * 4] * b[3] + a[r * 4 + 1] * b[7] + a[r * 4 + 2] * b[11] + a[r * 4 + 3];
    }
    return o;
}
/** Bake a filter's colour ops into the pixels of a 2D canvas (fallback path). */
export function applyMatrix(g, w, h, f) {
    if (!f.ops.length) return;
    let M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    for (const [op, v] of f.ops) M = mul(opMatrix(op, v), M);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        d[i] = M[0] * r + M[1] * gg + M[2] * b + M[3] * 255;
        d[i + 1] = M[4] * r + M[5] * gg + M[6] * b + M[7] * 255;
        d[i + 2] = M[8] * r + M[9] * gg + M[10] * b + M[11] * 255;
    }
    g.putImageData(img, 0, 0);
}

let grain = null;
function grainPattern(g) {
    if (!grain) {
        grain = document.createElement("canvas");
        grain.width = grain.height = 160;
        const q = grain.getContext("2d"), im = q.createImageData(160, 160);
        let seed = 7;
        for (let i = 0; i < im.data.length; i += 4) {
            seed = (seed * 16807) % 2147483647;
            const v = seed % 255;
            im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
        }
        q.putImageData(im, 0, 0);
    }
    return g.createPattern(grain, "repeat");
}
function vignette(g, w, h, rgba, inner = 0.45) {
    const r = Math.hypot(w, h) / 2;
    const grd = g.createRadialGradient(w / 2, h / 2, r * inner, w / 2, h / 2, r);
    grd.addColorStop(0, rgba.replace(/[\d.]+\)$/, "0)"));
    grd.addColorStop(1, rgba);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
}
/** The filter's 2D wash (drawn over the colour-graded photo, under the frame). */
function drawWash(g, w, h, f) {
    const u = Math.min(w, h) / 100;
    g.save();
    if (f.id === "golden") {
        const grd = g.createRadialGradient(w * 0.86, h * 0.1, 0, w * 0.86, h * 0.1, Math.max(w, h) * 0.75);
        grd.addColorStop(0, "rgba(255,214,120,0.45)"); grd.addColorStop(0.35, "rgba(255,160,70,0.16)"); grd.addColorStop(1, "rgba(255,120,40,0)");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        vignette(g, w, h, "rgba(110,40,0,0.32)", 0.5);
    } else if (f.id === "vintage") {
        g.fillStyle = "rgba(250,232,200,0.12)"; g.fillRect(0, 0, w, h);
        const leak = g.createLinearGradient(0, 0, w * 0.28, 0);
        leak.addColorStop(0, "rgba(255,110,60,0.22)"); leak.addColorStop(1, "rgba(255,110,60,0)");
        g.fillStyle = leak; g.fillRect(0, 0, w, h);
        vignette(g, w, h, "rgba(55,30,10,0.5)", 0.42);
        g.globalAlpha = 0.07; g.fillStyle = grainPattern(g); g.fillRect(0, 0, w, h);
    } else if (f.id === "noir") {
        vignette(g, w, h, "rgba(0,0,0,0.62)", 0.38);
        g.globalAlpha = 0.06; g.fillStyle = grainPattern(g); g.fillRect(0, 0, w, h);
    } else if (f.id === "pink") {
        g.fillStyle = "rgba(255,120,190,0.13)"; g.fillRect(0, 0, w, h);
        const glow = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.6);
        glow.addColorStop(0, "rgba(255,255,255,0.12)"); glow.addColorStop(1, "rgba(255,180,220,0)");
        g.fillStyle = glow; g.fillRect(0, 0, w, h);
        vignette(g, w, h, "rgba(233,30,140,0.28)", 0.55);
        const rnd = seeded(11);
        for (let i = 0; i < 14; i++) star4(g, w * (0.05 + rnd() * 0.9), h * (0.05 + rnd() * 0.5), u * (0.7 + rnd() * 1.4), "rgba(255,255,255,0.85)");
    } else if (f.id === "pop") {
        vignette(g, w, h, "rgba(20,0,40,0.18)", 0.6);
    }
    g.restore();
}

// ── frames ───────────────────────────────────────────────────────────────
export const FRAMES = [
    { id: "none", name: "No frame", emoji: "⬜" },
    { id: "postcard", name: "Postcard", emoji: "💌" },
    { id: "hearts", name: "Hearts", emoji: "💖" },
    { id: "polaroid", name: "Polaroid", emoji: "🖼️" },
    { id: "wanted", name: "WANTED", emoji: "🤠", needs: info => info.rap },
];

const ROUND = `"Fredoka", "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif`;
const SCRIPT = `"Brush Script MT", "Segoe Script", "Snell Roundhand", "Apple Chancery", cursive`;
const HAND = `"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Marker Felt", cursive`;
const SERIF = `"Rockwell", "Rockwell Extra Bold", "Georgia", "Times New Roman", serif`;

function seeded(a) {
    return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; };
}
function fitFont(g, text, weight, size, family, maxW) {
    let s = size;
    g.font = `${weight} ${s}px ${family}`;
    while (s > 6 && g.measureText(text).width > maxW) { s *= 0.92; g.font = `${weight} ${s}px ${family}`; }
    return s;
}
function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.25);
    g.bezierCurveTo(x - s * 0.5, y + s * 0.55, x - s * 0.1, y + s * 0.7, x, y + s * 0.9);
    g.bezierCurveTo(x + s * 0.1, y + s * 0.7, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.25);
    g.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y, x, y + s * 0.3);
    g.closePath();
}
function star4(g, x, y, r, col) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
    g.fill();
}
/** A rectangular band (outer rect minus inner rect). */
function band(g, x0, y0, x1, y1, t, l, b, r) {
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.rect(x0 + l, y0 + t, x1 - x0 - l - r, y1 - y0 - t - b);
}

function drawPostcard(g, w, h, info) {
    const u = Math.min(w, h) / 100, b = 3.6 * u;
    // airmail border: red / blue diagonal stripes
    g.save();
    band(g, 0, 0, w, h, b, b, b, b);
    g.clip("evenodd");
    g.fillStyle = "#FFFDF7"; g.fillRect(0, 0, w, h);
    const st = 3.2 * u;
    g.translate(0, 0);
    for (let x = -h, i = 0; x < w + h; x += st, i++) {
        const c = i % 4;
        if (c === 1 || c === 3) continue;
        g.fillStyle = c === 0 ? "#E53950" : "#2F6FD6";
        g.beginPath();
        g.moveTo(x, 0); g.lineTo(x + st, 0); g.lineTo(x + st - h, h); g.lineTo(x - h, h);
        g.closePath(); g.fill();
    }
    g.restore();
    g.strokeStyle = "#FFFDF7"; g.lineWidth = 0.9 * u; g.strokeRect(b + 0.45 * u, b + 0.45 * u, w - 2 * b - 0.9 * u, h - 2 * b - 0.9 * u);

    // "Greetings from" + the place, retro postcard lettering
    const place = info.place.toUpperCase();
    const x0 = b + 4 * u, base = h - b - 5 * u;
    g.save();
    g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 1.2 * u; g.shadowOffsetY = 0.4 * u;
    g.font = `italic 700 ${5.2 * u}px ${SCRIPT}`;
    g.fillStyle = "#FFFFFF";
    g.textBaseline = "alphabetic";
    g.fillText("Greetings from", x0 + 0.6 * u, base - 10.5 * u);
    g.restore();
    const size = fitFont(g, place, 800, 11 * u, ROUND, w * 0.66);
    g.save();
    g.lineJoin = "round";
    g.textBaseline = "alphabetic";
    g.font = `800 ${size}px ${ROUND}`;
    g.fillStyle = "rgba(60,10,40,0.5)"; g.fillText(place, x0 + 0.7 * u, base + 0.7 * u);
    g.strokeStyle = "#AD1457"; g.lineWidth = 1.6 * u; g.strokeText(place, x0, base);
    const grd = g.createLinearGradient(0, base - size, 0, base);
    grd.addColorStop(0, "#FFF176"); grd.addColorStop(0.5, "#FFB74D"); grd.addColorStop(1, "#FF4F9A");
    g.fillStyle = grd; g.fillText(place, x0, base);
    g.restore();

    // stamp (scalloped edge) + postmark
    const sw = 13 * u, sh = 16 * u, sx = w - b - sw - 3.2 * u, sy = b + 3 * u;
    g.save();
    g.rotate(0); g.translate(sx + sw / 2, sy + sh / 2); g.rotate(0.05); g.translate(-sw / 2, -sh / 2);
    g.shadowColor = "rgba(0,0,0,0.3)"; g.shadowBlur = 1.5 * u; g.shadowOffsetY = 0.4 * u;
    g.fillStyle = "#FFFFFF";
    const sc = 0.7 * u;
    g.beginPath();
    g.rect(0, 0, sw, sh);
    for (let x = sc; x < sw; x += sc * 2.2) { g.moveTo(x + sc, 0); g.arc(x, 0, sc, 0, Math.PI * 2); g.moveTo(x + sc, sh); g.arc(x, sh, sc, 0, Math.PI * 2); }
    for (let y = sc; y < sh; y += sc * 2.2) { g.moveTo(sc, y); g.arc(0, y, sc, 0, Math.PI * 2); g.moveTo(sw + sc, y); g.arc(sw, y, sc, 0, Math.PI * 2); }
    g.fill();
    g.shadowColor = "transparent";
    const pad = 1.3 * u;
    const sky = g.createLinearGradient(0, pad, 0, sh - pad);
    sky.addColorStop(0, "#8FD3FF"); sky.addColorStop(0.62, "#FFD6EA"); sky.addColorStop(0.62, "#7CCB5B"); sky.addColorStop(1, "#5FA344");
    g.fillStyle = sky; g.fillRect(pad, pad, sw - pad * 2, sh - pad * 2);
    // a tiny pink convertible
    const cx = sw / 2, cy = sh * 0.62;
    g.fillStyle = "#E91E63";
    g.beginPath(); g.roundRect(cx - 4 * u, cy - 1.6 * u, 8 * u, 2.2 * u, 0.9 * u); g.fill();
    g.fillStyle = "#8FD3FF"; g.fillRect(cx - 0.6 * u, cy - 3 * u, 0.4 * u, 1.5 * u);
    g.fillStyle = "#6D4C41"; g.beginPath(); g.arc(cx + 0.9 * u, cy - 2.1 * u, 0.85 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#263238";
    for (const dx of [-2.4, 2.4]) { g.beginPath(); g.arc(cx + dx * u, cy + 0.7 * u, 0.9 * u, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#FFF59D"; g.beginPath(); g.arc(sw * 0.75, sh * 0.25, 1.3 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#AD1457"; g.font = `800 ${2.2 * u}px ${ROUND}`; g.textAlign = "left"; g.fillText("18¢", pad + 0.5 * u, pad + 2.4 * u);
    g.textAlign = "center"; g.font = `800 ${1.7 * u}px ${ROUND}`; g.fillText("LULU AIR MAIL", sw / 2, sh - pad - 0.5 * u);
    g.restore();
    // postmark rings + cancellation waves over the stamp's corner
    g.save();
    g.strokeStyle = "rgba(40,40,70,0.55)"; g.fillStyle = "rgba(40,40,70,0.6)"; g.lineWidth = 0.45 * u;
    const px = sx - 1.5 * u, py = sy + sh * 0.62, pr = 5.4 * u;
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(px, py, pr * 0.72, 0, Math.PI * 2); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${1.5 * u}px ${ROUND}`; g.fillText(info.dateShort, px, py - 0.9 * u);
    g.font = `700 ${1.15 * u}px ${ROUND}`; g.fillText(info.year, px, py + 1.0 * u);
    for (let i = -2; i <= 2; i++) {
        g.beginPath();
        for (let x = 0; x <= 13 * u; x += u) g.lineTo(px - pr - 14 * u + x, py + i * 1.3 * u + Math.sin(x / u * 0.9) * 0.45 * u);
        g.stroke();
    }
    g.restore();
}

function drawHearts(g, w, h, info) {
    const u = Math.min(w, h) / 100;
    vignette(g, w, h, "rgba(255,90,170,0.36)", 0.5);
    const rnd = seeded(29);
    const cols = ["#FF4F9A", "#FF8AC0", "#E91E63", "#FFFFFF", "#FFB3D9"];
    const edge = () => {
        const side = Math.floor(rnd() * 4), t = rnd();
        const m = (2 + rnd() * 7) * u;
        return side === 0 ? [t * w, m] : side === 1 ? [t * w, h - m] : side === 2 ? [m, t * h] : [w - m, t * h];
    };
    for (let i = 0; i < 34; i++) {
        const [x, y] = edge(), s = (2.6 + rnd() * 5.4) * u, rot = (rnd() - 0.5) * 0.8;
        g.save();
        g.translate(x, y); g.rotate(rot);
        heartPath(g, 0, -s * 0.45, s);
        g.fillStyle = cols[i % cols.length];
        g.shadowColor = "rgba(120,0,60,0.25)"; g.shadowBlur = 0.8 * u;
        g.fill();
        g.shadowColor = "transparent";
        g.lineWidth = 0.35 * u; g.strokeStyle = "rgba(255,255,255,0.9)"; g.stroke();
        g.restore();
    }
    for (let i = 0; i < 12; i++) { const [x, y] = edge(); star4(g, x, y, (0.8 + rnd() * 1.2) * u, "rgba(255,255,255,0.95)"); }
    // ribbon banner at the bottom
    const text = "Lulu  ♥  Road Trips";
    g.font = `800 ${4.6 * u}px ${ROUND}`;
    const tw = Math.min(w * 0.7, g.measureText(text).width + 10 * u), bh = 7.4 * u, bx = (w - tw) / 2, by = h - bh - 4.5 * u;
    g.save();
    g.fillStyle = "#AD1457";
    for (const s of [-1, 1]) {
        const ex = s < 0 ? bx - 4 * u : bx + tw + 4 * u, ix = s < 0 ? bx + 1 * u : bx + tw - 1 * u;
        g.beginPath();
        g.moveTo(ix, by + 1.6 * u); g.lineTo(ex, by + 1.6 * u); g.lineTo(ex + s * -2.2 * u, by + bh / 2 + 1.6 * u); g.lineTo(ex, by + bh + 1.6 * u); g.lineTo(ix, by + bh + 1.6 * u);
        g.closePath(); g.fill();
    }
    g.shadowColor = "rgba(0,0,0,0.3)"; g.shadowBlur = 1.2 * u; g.shadowOffsetY = 0.4 * u;
    const grd = g.createLinearGradient(0, by, 0, by + bh);
    grd.addColorStop(0, "#FF6FB1"); grd.addColorStop(1, "#E91E63");
    g.fillStyle = grd;
    g.beginPath(); g.roundRect(bx, by, tw, bh, 1.2 * u); g.fill();
    g.shadowColor = "transparent";
    g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
    fitFont(g, text, 800, 4.6 * u, ROUND, tw - 4 * u);
    g.fillText(text, w / 2, by + bh / 2 + 0.2 * u);
    g.restore();
}

function drawPolaroid(g, w, h, info) {
    const u = Math.min(w, h) / 100, s = 3.4 * u, top = 3.4 * u, bot = 14 * u;
    g.save();
    band(g, 0, 0, w, h, top, s, bot, s);
    g.fillStyle = "#FBFAF6"; g.fill("evenodd");
    // the photo's inner edge shadow
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 0.35 * u;
    g.strokeRect(s, top, w - 2 * s, h - top - bot);
    // a strip of tape
    g.translate(w / 2, top * 0.5); g.rotate(-0.04);
    g.fillStyle = "rgba(255,238,190,0.78)";
    g.fillRect(-9 * u, -2.2 * u, 18 * u, 4.4 * u);
    g.restore();
    // handwritten caption in blue ink
    g.save();
    g.fillStyle = "#24408E"; g.textBaseline = "middle";
    const cap = `${info.who} ♥ ${info.dateLong}`;
    g.textAlign = "left";
    fitFont(g, cap, 400, 5 * u, HAND, w * 0.62);
    g.translate(s + 3 * u, h - bot / 2); g.rotate(-0.012);
    g.fillText(cap, 0, 0);
    g.restore();
    g.save();
    g.fillStyle = "#24408E"; g.textAlign = "right"; g.textBaseline = "middle";
    fitFont(g, `📍 ${info.place}`, 400, 3.2 * u, HAND, w * 0.32);
    g.fillText(`📍 ${info.place}`, w - s - 3 * u, h - bot / 2);
    g.restore();
}

function drawWanted(g, w, h, info) {
    const u = Math.min(w, h) / 100, side = 5 * u, top = 17 * u, bot = 13 * u;
    g.save();
    band(g, 0, 0, w, h, top, side, bot, side);
    g.clip("evenodd");
    g.fillStyle = "#E9D3A2"; g.fillRect(0, 0, w, h);
    // aged paper: soft stains + darker burnt edges
    const rnd = seeded(5);
    for (let i = 0; i < 18; i++) {
        const x = rnd() * w, y = rnd() * h, r = (4 + rnd() * 12) * u;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, "rgba(150,100,40,0.16)"); grd.addColorStop(1, "rgba(150,100,40,0)");
        g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    vignette(g, w, h, "rgba(90,50,10,0.55)", 0.62);
    g.restore();
    g.save();
    g.strokeStyle = "#4E3216"; g.lineWidth = 0.8 * u;
    g.strokeRect(side, top, w - 2 * side, h - top - bot);
    g.lineWidth = 0.3 * u; g.strokeRect(side - 1.4 * u, top - 1.4 * u, w - 2 * side + 2.8 * u, h - top - bot + 2.8 * u);
    g.fillStyle = "#3B2410"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    const ws = fitFont(g, "WANTED", 900, 11 * u, SERIF, w * 0.8);
    g.font = `900 ${ws}px ${SERIF}`;
    g.fillText("WANTED", w / 2, top - 5.4 * u);
    fitFont(g, `FOR ${info.charges}`, 700, 2.6 * u, SERIF, w * 0.86);
    g.fillText(`FOR ${info.charges}`, w / 2, top - 2.1 * u);
    fitFont(g, `REWARD: 500 COINS  ·  LAST SEEN: ${info.place.toUpperCase()}`, 800, 3.3 * u, SERIF, w * 0.86);
    g.fillText(`REWARD: 500 COINS  ·  LAST SEEN: ${info.place.toUpperCase()}`, w / 2, h - bot + 5.6 * u);
    fitFont(g, "Approach with snacks. Suspect is extremely charming.", 400, 2.3 * u, SERIF, w * 0.8);
    g.fillStyle = "#5D3B18";
    g.fillText("Approach with snacks. Suspect is extremely charming.", w / 2, h - bot + 9.4 * u);
    // nails in the corners
    for (const [x, y] of [[side * 0.5, top * 0.32], [w - side * 0.5, top * 0.32], [side * 0.5, h - bot * 0.3], [w - side * 0.5, h - bot * 0.3]]) {
        const grd = g.createRadialGradient(x - 0.3 * u, y - 0.3 * u, 0, x, y, 1.1 * u);
        grd.addColorStop(0, "#E0E0E0"); grd.addColorStop(1, "#424242");
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, 1.1 * u, 0, Math.PI * 2); g.fill();
    }
    g.restore();
}

/** The live overlay canvas: cleared, then the wash + frame. */
export function drawOverlay(g, w, h, filter, frame, info) {
    g.clearRect(0, 0, w, h);
    compositeOverlay(g, w, h, filter, frame, info);
}
/** Wash + frame drawn ON TOP of what's already on a w×h 2D canvas (the saved photo). */
export function compositeOverlay(g, w, h, filter, frame, info) {
    if (filter) drawWash(g, w, h, filter);
    if (!frame || frame.id === "none") return;
    g.save();
    try {
        if (frame.id === "postcard") drawPostcard(g, w, h, info);
        else if (frame.id === "hearts") drawHearts(g, w, h, info);
        else if (frame.id === "polaroid") drawPolaroid(g, w, h, info);
        else if (frame.id === "wanted") drawWanted(g, w, h, info);
    } finally { g.restore(); }
}
