// 🔍 The logic sweep (ci/sweep-logic, 3d/docs/sweeps/sweep-logic.md): the game's rules, coins and state, across features.
//   • the wallet: a negative / NaN / Infinity amount never pays her or poisons the shared save
//   • the one-off coin rewards inside rooms (the precinct's free coffee, the bar's seltzer…) are once a REAL day — a
//     ↺ Restart / a reload (a new run) used to refill them: a 30-coin tap
//   • couch coins in the neighbours' houses: the "closed for today" cap really is a day, not a run
//   • the style combo: mashing ONE move (dodge rolls / taps on the road) builds the score multiplier but no coins; mixed
//     moves still pay; the combo coins stop at a daily cap
const W = `(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`;

module.exports = {
  name: "sweeplogic",
  query: "&enable=moves",
  save2d: { totalCoins: 500, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    const g = t.game;
    await t.frames(10);

    // ── the wallet ──────────────────────────────────────────────────────
    const wal = await t.L(`import("./js/core/save.js").then(async m => {
      const w = m.wallet, c0 = w.coins, out = {};
      out.neg = w.spend(-50); m.flushShared(); out.afterNeg = w.coins - c0;
      out.nan = w.spend(NaN); out.inf = w.spend(Infinity); out.str = w.spend("5");
      w.add(NaN); w.add(Infinity); w.add(-Infinity); m.flushShared();
      out.afterAdd = w.coins - c0;
      out.saved = JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins;
      out.zero = w.spend(0); out.ok = w.spend(5); out.afterOk = w.coins - c0;
      w.add(5); m.flushShared();
      return out;
    })`);
    t.check("wallet: spending a NEGATIVE amount is refused (it used to pay her)", wal.neg === false && wal.afterNeg === 0, JSON.stringify(wal));
    t.check("wallet: NaN / Infinity / a string are refused", wal.nan === false && wal.inf === false && wal.str === false);
    t.check("wallet: adding NaN / ±Infinity changes nothing (the shared save stays a number)", wal.afterAdd === 0 && Number.isFinite(wal.saved), String(wal.saved));
    t.check("wallet: an ordinary spend still works (0 is free, 5 costs 5)", wal.zero === true && wal.ok === true && wal.afterOk === -5);

    // ── one-off room rewards: once a REAL day, not once a run ───────────
    const once = await t.L(`import("./js/features/interiors/engine.js").then(m => {
      const fake = () => ({ used: {}, def: { id: "police" } });
      const a = fake(), first = m.Room.prototype.onceToday.call(a, "coffee"), again = m.Room.prototype.onceToday.call(a, "coffee");
      const b = fake();          // a NEW run (Restart / reload): rt.used starts empty
      const nextRun = m.Room.prototype.onceToday.call(b, "coffee");
      const other = m.Room.prototype.onceToday.call(fake(), "seltzer");
      const saved = !!(m.S.daily && m.S.daily.used && m.S.daily.used.police && m.S.daily.used.police.coffee);
      return { first, again, nextRun, other, saved };
    })`);
    t.check("rooms: the precinct coffee pays the first time today", once.first === true && once.again === false, JSON.stringify(once));
    t.check("rooms: …and NOT again after a Restart / a new run the same day", once.nextRun === false && once.saved, JSON.stringify(once));
    t.check("rooms: another reward in the same room is its own", once.other === true);
    // the real room: the coffee in a new run today is the "again" line, no coins
    await g(`(window.__it = { go(id) { window.__exited = 0; return ctx.interiors[id].enter({ exit: () => { window.__exited++; L3.setState("title"); } }); } }, true)`);
    await g(`__it.go("police")`);
    if (await t.until(`window.__interiors && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.fadeIn >= 1`, "the precinct loads", 60000)) {
      t.check("rooms: a new run's room already knows today's coffee is gone (label / 'again' line agree)", await g(`window.__interiors.room.used.coffee === true`));
      const w0 = await t.L(W);
      await g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === "coffee"); h.action(r, h); return true; })()`);
      for (let i = 0; i < 10; i++) { await t.frames(8); if (await g(`ctx.dialogOpen`)) await t.tap(0); }
      await t.frames(30);
      t.check("rooms: the second coffee today pays nothing", (await t.L(W)) === w0, `${w0} → ${await t.L(W)}`);
      await g(`window.__interiors.room.leave()`);
      await t.until(`__lulu3d.state === "title"`, "out of the precinct", 20000);
    }

    // ── couch coins: a real-day cap ─────────────────────────────────────
    const couch = await t.L(`Promise.all([import("./js/features/homes/house.js"), import("./js/features/homes/data.js")]).then(([h, d]) => {
      const day = h.couchDay(); day.coins = d.COUCH.dayCap;
      return { capKey: "dayCap" in d.COUCH, dayCap: d.COUCH.dayCap, runCap: d.COUCH.runCap, again: h.couchDay().coins, saved: JSON.parse(JSON.stringify(h.couchDay())) };
    })`);
    t.check("homes: couch coins have a REAL-day cap (the lines say 'closed for today')", couch.capKey && couch.dayCap > 0 && couch.again === couch.dayCap, JSON.stringify(couch));

    // ── Ima's list: every errand can be done in the one world (Bubbe's driveway isn't on the Cruise lap) ──
    const day = await g(`(() => {
      const D = ctx.day, seen = new Set();
      for (let k = 0; k < 60; k++) { const d = 20261201 + k; for (const x of D.debug.date(d)) seen.add(x); }
      return { bubbe: seen.has("bubbe"), errands: [...seen].filter(id => D.ITEMS.errand.some(e => e.id === id)) };
    })()`);
    t.check("Ima's list: 60 days of lists never ask for Bubbe's challah (not on the one world's map)", !day.bubbe && day.errands.length >= 2, JSON.stringify(day));
    const swap = await t.L(`import("./js/core/save.js").then(m => { const D = __lulu3d.ctx.day, s = m.save3d.f.day;
      D.debug.date(20270102); s.list[0] = "bubbe"; s.prog = {}; const L = D.list().map(x => x.id); D.debug.date(null); return { L }; })`);
    t.check("Ima's list: an old list with the challah errand gets a doable errand instead", !swap.L.includes("bubbe") && swap.L.length === 3, JSON.stringify(swap));

    // ── the style combo: one move mashed pays no coins; a mix does; a daily cap ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 30000)) {
      await t.frames(20);
      t.check("run coins: addCoins(NaN / Infinity) leaves the HUD's count a number", await g(`(L3.addCoins(NaN, "t"), L3.addCoins(Infinity, "t"), Number.isFinite(ctx.G.coins))`));
      const r = await t.L(`import("./js/features/moves/common.js").then(m => {
        const out = {};
        const chain = ids => { for (const id of ids) m.addMove(id, 100, id); return m.bank("test"); };
        m.S.coinDay = null;
        const mash = chain(Array(22).fill("roll"));
        out.mash = { mult: mash && mash.mult, coins: mash && mash.coins };
        const mix = chain(["drift", "nearmiss", "slingshot", "air", "headon", "drift", "nearmiss", "slingshot", "air", "headon", "pit", "bootleg"]);
        out.mix = { mult: mix && mix.mult, coins: mix && mix.coins };
        m.S.coinDay = { d: m.S.coinDay.d, n: m.COMBO_COINS.dayCap - 3 };
        const capped = chain(["drift", "nearmiss", "slingshot", "air", "headon", "drift", "nearmiss", "slingshot", "air", "headon", "pit", "bootleg"]);
        out.capped = { coins: capped && capped.coins, n: m.S.coinDay.n, cap: m.COMBO_COINS.dayCap };
        return out;
      })`);
      t.check("combo: 22 dodge rolls in a row = a big multiplier…", r.mash.mult >= 10, JSON.stringify(r.mash));
      t.check("combo: …but no coins (mashing one move isn't a coin tap)", r.mash.coins === 0, JSON.stringify(r.mash));
      t.check("combo: a real mix of moves still pays coins", r.mix.coins >= 10, JSON.stringify(r.mix));
      t.check("combo: the coins stop at the daily cap", r.capped.coins === 3 && r.capped.n === r.capped.cap, JSON.stringify(r.capped));
    }

    // ── a returning player: a Classic 2D save (every field the 2D game writes, a fortnight old) + a 3D save from the first
    //    3D week (no feature namespaces yet) → the game boots, ▶ PLAY works, nothing throws, the coins are kept ──
    await g(`(L3.setState("title"), true)`);
    await t.frames(5);
    await t.L(`(() => {
      const old2d = { highScore: 41230, lifetimeScore: 912000, quests: { week: 2944, prog: { escapes2: 1, footDist: 900 }, best: { chain6: 3 }, claimed: {}, notified: {} },
        totalCoins: 777, ownedSkins: ["pink", "purple"], selectedSkin: "purple", missiles: 2, pepperSpray: 1, shields: 0, distractedUnlocked: false,
        parkingBestLevel: 3, parkingTotalStars: 7, parkingUnlocked: true, parkingPerfectRuns: 1, luluHair: "#8B5A2B", luluHairStyle: "bouncy",
        stickerBook: [{ kind: "star", x: 0.4, y: 0.5, rot: 0.1, scale: 1 }], dinaRunsPlayed: 4, footRunsPlayed: 9, footRunHigh: 0.6,
        convictions: 1, offenses: 2, erVisits: 3, dayNum: 20400, streak: 2, tutorialDone: true, hapticsOff: false, musicMuted: false, calmFx: null,
        audioMuted: false, postcards: ["avigail", "heshy"], tripBest: 2, storyStop: 2, storyCycle: 0, storyStars: { avigail: true }, ctrlLayout: null,
        mpAutoOff: false, cruiseUnlocked: true, cruisePlayed: true, horn: "duck", ownedHorns: ["beep", "duck"], decor: "dice", ownedDecor: ["dice"],
        dinaBest: 31, dinaMedals: { gold: 0, silver: 1, bronze: 2 }, cookieBest: 22, storyTaskTour: { avigail: 0 }, stats: { escapes2: 3, best: { chain6: 4 } },
        badges: ["firstDrive"], scrapSeen: 1, lockup: null, wanted: ["SPEEDING"], avigailRel: 55 };
      localStorage.setItem("luluSaveV2", JSON.stringify(old2d));
      localStorage.setItem("lulu3dSave", JSON.stringify({ best: 1200, bestTime: 0, arrivals: 1, cam: 0, music: true, sound: true, settings: { quality: "low", vibration: true } }));
      return true;
    })()`);
    await t.page.reload();
    if (await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "an old save boots to the title", 120000)) {
      t.check("old save: the wallet is kept (777)", await g(`L3.wallet.coins`) === 777, String(await g(`L3.wallet.coins`)));
      await g(`L3.startRun({ mode: "cruise" })`);
      await t.until(`["playing", "footRun"].includes(__lulu3d.state)`, "old save: ▶ PLAY starts", 60000);
      await t.frames(90);
      t.check("old save: still playing a few seconds in", await g(`["playing", "footRun"].includes(ctx.state)`), await g(`ctx.state`));
      t.check("old save: the 3D save filled in its new settings", await g(`(() => { const s = JSON.parse(localStorage.getItem("lulu3dSave") || "{}"); return !!(s.settings && "hudMode" in s.settings && s.f); })()`));
    }
  },
};
