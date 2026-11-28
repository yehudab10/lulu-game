// 📱 The phone sweep, part 5 — part 1 (the first five minutes, empty save) on a SMALL phone on its side (667 × 375,
// fingers): the same checks — one hint at a time, the car in the picture, nothing off the sides, the tutorial's card and
// the 📱 banner never together. Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweepphone/land-*.
const P1 = require("./sweepphone.js");

module.exports = Object.assign({}, P1, { name: "sweepphone5", viewport: { width: 667, height: 375 }, tag: "land-" });
