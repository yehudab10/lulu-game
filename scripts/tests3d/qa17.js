// 🐞 QA sweep, part 17 — CITY HALL stages 3–5 (features/cityhall): permits + the inspector, a protest + the rhythm chant,
// the paving-contract story — with EVERY feature on and the QA watchdog (scripts/tests3d/cityhall3.js runs it with the
// features it needs alone).
const base = require("./cityhall3.js");
module.exports = Object.assign({}, base, { name: "qa17", query: "&enable=all" });
