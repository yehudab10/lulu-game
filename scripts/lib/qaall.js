// 🐞 QA: run a feature's own test the way players get it — EVERY feature on (&enable=all) — with a COIN GUARD in the page:
// the raw balance (shared save + pending) never below 0, and every coin change logged with its reason (the "coin" event's
// `why`, plus raw wallet.add calls that came from no addCoins) so a new way of paying shows up in the log.
//   module.exports = require("../lib/qaall.js")(require("./moveout.js"), "qa20");
module.exports = (base, name, extra = "") => Object.assign({}, base, {
  name,
  query: "&enable=all" + extra + (/(^|&)mpurl=/.test(base.query || "") ? "&mpurl=" + (base.query.match(/mpurl=([^&]*)/) || [])[1] : ""),
  async run(t) {
    await t.L(`(() => { const L3 = window.__lulu3d, w = L3.wallet, add = w.add.bind(w), G = window.__coinG = { min: Infinity, log: [], raw: [] };
      L3.on("coin", e => { if (e && e.n) G.log.push([e.n, e.why || "?"]); });
      // (wallet.add straight from a feature — a purchase, a payout — with where it came from)
      w.add = n => { add(n); if (n) G.raw.push([n, ((new Error().stack || "").split("\\n")[2] || "").trim().replace(/^at /, "").replace(/\\(?https?:\\/\\/[^/]+\\//, "").slice(0, 90)]); G.min = Math.min(G.min, w.coins); if (G.raw.length > 400) G.raw.shift(); };
      return true; })()`);
    try { await base.run.call(this, t); }
    finally {
      const G = await t.L(`window.__coinG ? { min: window.__coinG.min, log: window.__coinG.log, raw: window.__coinG.raw } : null`).catch(() => null);
      if (G) {
        const by = {}; for (const [n, why] of G.log) { const k = (n > 0 ? "+" : "−") + " " + why; by[k] = (by[k] || 0) + Math.abs(n); }
        console.log(`   coins by reason (${name}):`, JSON.stringify(by));
        const rw = {}; for (const [n, at] of G.raw) { const k = (n > 0 ? "+ " : "− ") + at; rw[k] = (rw[k] || 0) + Math.abs(n); }
        console.log(`   wallet.add by caller (${name}):`, JSON.stringify(rw));
        t.check(`${name}: the coin balance never went below 0`, !(G.min < 0), String(G.min));
      }
    }
  },
});
