// (temporary, ci/perf4 — not to be merged): A/B with a CPU profile on the town scenes
Object.assign(process.env, { ZZ_TIER: "low", ZZ_SCENES: "cruise,towndrive,middrive,attached", ZZ_PROFILE: "1" });
module.exports = Object.assign({}, require("./zzperfab.js"), { name: "zzprof" });
