// 🐞 QA of the weekend's landings, part: the airport (`?airport=1`) — the test itself is scripts/tests3d/qaweekend.js.
const base = require("./qaweekend.js");
module.exports = Object.assign({}, base, { name: "qaweekend-air", parts: ["airport"], query: base.query + "&airport=1", viewport: { width: 1280, height: 720 }, hasTouch: false });
