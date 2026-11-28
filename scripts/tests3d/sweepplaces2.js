// 🔎 The places sweep, part 2 — LAKEWOOD with a controller at 1280 × 720: every room behind a town door (the precinct,
// the courthouse, St. Shloimy's, the shul, City Hall, the bank, the pizza shop, the clothes shop, the realtor, Zissy's
// makolet, Bling Bay, the impound gate…) walked into with the real ✋ and audited as in part 1 (scripts/lib/sweepplaces.js).
const { make, W } = require("../lib/sweepplaces.js");

module.exports = {
  name: "sweepplaces2",
  viewport: { width: 1280, height: 720 },
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
    await S.sweepTown("lakewood", { only, extrasIn: "bank" });
    await S.persisted();
  },
};
