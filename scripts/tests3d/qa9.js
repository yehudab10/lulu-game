// 🐞 QA sweep, part 9 — REAL ESTATE (features/realestate) the way players get it: the whole `realestate` journey (the
// realtor, a viewing, buying, going in at her own door, the mortgage desk in the bank, decorating, rent, selling) with
// EVERY feature on (cops, cameos, pop-ups, town life…) and the QA watchdog — scripts/tests3d/realestate.js runs it with
// the town alone.
const base = require("./realestate.js");
module.exports = Object.assign({}, base, { name: "qa9", query: "&enable=all" });
