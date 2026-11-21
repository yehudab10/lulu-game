// (temporary, ci/perf4 — not to be merged)
process.env.ZZ_TIER = "low";
module.exports = Object.assign({}, require("./zzperfab.js"), { name: "zzperfablow" });
