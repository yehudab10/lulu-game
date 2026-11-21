// 🐞 QA of the weekend's landings, part: a 🎉 party — the test itself is scripts/tests3d/qaweekend.js.
const base = require("./qaweekend.js");
module.exports = Object.assign({}, base, { name: "qaweekend-party", parts: ["party"], viewport: { width: 960, height: 540 }, hasTouch: false });
