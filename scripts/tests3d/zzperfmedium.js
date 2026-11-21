// (temporary, ci/perf4: the perf harness at one tier on a CI machine — not to be merged)
Object.assign(process.env, { PERF3D_TIER: "medium", PERF3D_SCENES: "cruise,highway,towndrive,townfoot,middrive,midfoot,attached,foot", PERF3D_ADD: "all", PERF3D_TOP: "40", PERF3D_FRAMES: "40", PERF3D_OUT: require("path").join(__dirname, "..", "..", "smoke-shots", "perf3d-medium.json") });
module.exports = Object.assign({}, require("./perf.js"), { name: "zzperfmedium" });
