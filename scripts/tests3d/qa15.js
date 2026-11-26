// 🐞 QA sweep, part 15 — CITY HALL stage 1 (features/cityhall) the way players get it: both towns' city halls (the door,
// the room, the windows, the mayor's office), the ribbon cutting out in town, with EVERY feature on (cops, cameos,
// pop-ups, town life, crime, households…) and the QA watchdog — scripts/tests3d/cityhall.js runs it with the town alone.
const base = require("./cityhall.js");
module.exports = Object.assign({}, base, { name: "qa15", query: "&enable=all" });
