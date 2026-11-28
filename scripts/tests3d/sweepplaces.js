// 🔎 The places sweep, part 1 — MIDWOOD on a phone (390 × 844, touch): every room behind a town door (the precinct, the
// courthouse, Midwood General, Young Israel, Borough Hall, the bank, the pizza shop, the bakery, the clothes shop, the
// realtor, the makolet, Bling Bay, East Midwood Lanes…) walked into with the real ✋, audited (scripts/lib/sweepplaces.js:
// every ✋ reachable + does something + can be finished, nothing stacked, nobody inside furniture, the dialog fits the
// phone) and left by the same door. Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweep/.
const { make, W } = require("../lib/sweepplaces.js");

module.exports = {
  name: "sweepplaces",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 5000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t);
    await W.install(t);
    if (!await S.start()) return;
    const only = process.env.SWEEP_ROOMS ? process.env.SWEEP_ROOMS.split(",") : null;
    await S.sweepTown(process.env.SWEEP_TOWN || "midwood", { only, extrasIn: "hospital" });
    await S.persisted();
  },
};
