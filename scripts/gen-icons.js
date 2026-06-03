// One-off: rasterize the SVG car logo into the PNG assets Capacitor / the
// App Store need. Run with `node scripts/gen-icons.js` (requires `sharp`).
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const svg = fs.readFileSync(path.join(ROOT, "icon-512.svg"), "utf8");

// App icon must be a full square with no rounded corners / alpha — Apple masks
// it itself and rejects icons containing transparency.
const iconSquare = svg.replace('rx="80"', 'rx="0"');

(async () => {
  fs.mkdirSync(path.join(ROOT, "assets"), { recursive: true });

  const png1024 = await sharp(Buffer.from(iconSquare))
    .resize(1024, 1024)
    .flatten({ background: "#1a1a2e" })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ROOT, "icon-1024.png"), png1024);
  fs.writeFileSync(path.join(ROOT, "assets", "icon.png"), png1024);

  // Splash: dark canvas with the icon centered and the title beneath it.
  const inner = svg
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "");
  const splash =
    '<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">' +
    '<rect width="2732" height="2732" fill="#1a1a2e"/>' +
    '<g transform="translate(966,706) scale(1.5625)">' + inner + '</g>' +
    '<text x="1366" y="2050" font-family="Arial, sans-serif" font-size="150" font-weight="bold" ' +
    'fill="#FF4FA3" text-anchor="middle">Lulu&apos;s Road Trip</text>' +
    '</svg>';
  const sp = await sharp(Buffer.from(splash))
    .resize(2732, 2732)
    .flatten({ background: "#1a1a2e" })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ROOT, "assets", "splash.png"), sp);
  fs.writeFileSync(path.join(ROOT, "assets", "splash-dark.png"), sp);

  console.log("generated icon-1024.png + assets/{icon,splash,splash-dark}.png");
})().catch((e) => { console.error(e); process.exit(1); });
