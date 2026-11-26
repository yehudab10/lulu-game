// 🐞 QA sweep, part 16 — CITY HALL stage 2 (features/cityhall): the Taxes window, the ledger, fees, the lien — with EVERY
// feature on and the QA watchdog (scripts/tests3d/cityhall2.js runs it with the features it needs alone).
const base = require("./cityhall2.js");
module.exports = Object.assign({}, base, { name: "qa16", query: "&enable=all" });
