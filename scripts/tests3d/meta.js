// features/meta: scrapbook (tabs, badges, portraits, save code both ways with the
// 2D format), weekly quests (same pick as 2D, claim → shared wallet), stat feeds,
// lifetime-score banking, the daily streak, Chanukah / Purim / Pesach car decor
// + the grogger horn, and the first-drive tutorial.
const fs = require("fs");
const path = require("path");

// ── the REAL 2D helpers, lifted from src/ so 3D is checked against them ──
const SRC = path.join(__dirname, "..", "..", "src");
const mp = fs.readFileSync(path.join(SRC, "10f-multiplayer.js"), "utf8");
const qs = fs.readFileSync(path.join(SRC, "06b-quests.js"), "utf8");
const sb = fs.readFileSync(path.join(SRC, "06c-scrapbook.js"), "utf8");
const grab = (src, start, end) => { const a = src.indexOf(start), b = src.indexOf(end, a); return src.slice(a, b); };
const twoD = new Function(`
  ${grab(mp, "function mpHashStr", "// Layout rng")}
  ${grab(qs, "var QUEST_POOL", "// ── Run-end bookkeeping")}
  ${grab(sb, "var SAVE_CODE_PREFIX", "function scrapCopyCode")}
  var save = null;
  function questWeek() { return Math.floor(Math.floor(Date.now() / 86400000) / 7); }
  function activeIds() {
    var rng = mpMulberry(mpHashStr("luluQuestsWk" + questWeek())), pool = QUEST_POOL.map(function (q) { return q.id; }), ids = [];
    for (var p = 0; p < 3 && pool.length > 0; p++) { var i = Math.floor(rng() * pool.length); ids.push(pool[i]); pool.splice(i, 1); }
    return ids;
  }
  return { activeIds: activeIds, QUEST_POOL: QUEST_POOL, codeToSave: codeToSave,
           saveToCode: function (s) { save = s; return saveToCode(); }, questWeek: questWeek };
`)();

const today = Math.floor(Date.now() / 86400000);
const week = twoD.questWeek();
const active = twoD.activeIds();
const def = id => twoD.QUEST_POOL.find(q => q.id === id);
// quest #0 complete-but-unclaimed (to claim), quest #1 untouched
const q0 = def(active[0]);
const seedQuests = { week, prog: {}, best: {}, claimed: {}, notified: {} };
seedQuests[q0.scope === "run" ? "best" : "prog"][q0.id] = q0.target;
seedQuests.notified[q0.id] = true;

// A still close-up of Lulu's car (freezes the game, hides the menus/HUD for the shot).
async function closeup(t, label, { back, side, up, lookBack = 0, lookSide = 0, lookUp = 1.1, fov = 40 }) {
  await t.game(`(() => { const T = ctx.THREE, c = ctx.car, cam = new T.PerspectiveCamera(${fov}, innerWidth / innerHeight, 0.05, 400);
    const f = new T.Vector3(Math.sin(c.h), 0, Math.cos(c.h)), r = new T.Vector3(-Math.cos(c.h), 0, Math.sin(c.h));
    cam.position.copy(c.pos).addScaledVector(f, ${-back}).addScaledVector(r, ${side}); cam.position.y = ${up};
    const L = c.pos.clone().addScaledVector(f, ${-lookBack}).addScaledVector(r, ${lookSide}); cam.lookAt(L.x, ${lookUp}, L.z);
    window.__hid = ["screen", "hud"].filter(id => !document.getElementById(id).classList.contains("hidden"));
    for (const id of window.__hid) document.getElementById(id).classList.add("hidden");
    ctx.paused = true; ctx.view = { scene: ctx.scene, camera: cam }; })()`);
  await t.frames(6);
  await t.shot(label);
  await t.game(`(() => { ctx.view = null; ctx.paused = false; for (const id of window.__hid) document.getElementById(id).classList.remove("hidden"); })()`);
}

module.exports = {
  name: "meta",
  query: "&enable=meta&holiday=chanukah&holidayDay=3",
  save2d: {
    totalCoins: 1000, highScore: 12000, lifetimeScore: 250000, streak: 2, dayNum: today - 1,
    stats: { honks10: 49, escapes2: 1, best: { chain6: 5 } }, badges: ["firstRun"], scrapSeen: 0,
    convictions: 1, offenses: 2, escapes: 1, erVisits: 13, avigailRel: 72, postcards: ["bubbe"],
    ownedSkins: ["pink", "purple"], wanted: ["Speeding", "Grand theft duck", "Honking"], quests: seedQuests,
    luluHair: "#8B5A2B",
  },
  async run(t) {
    const S2 = () => t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`);
    await t.frames(30);

    // ── title: Chanukah greeting, gift, menorah, menu items ──
    t.check("title shows the Chanukah greeting (night 3)", await t.L(`/Happy Chanukah!.*Night 3/.test(document.querySelector("#screenCard").textContent)`));
    t.check("📒 Scrapbook + 📜 Quests on the title", await t.L(`!!document.getElementById("metaScrapbook") && !!document.getElementById("metaQuests")`));
    t.check("scrapbook shows the new-badge dot", await t.L(`!!document.querySelector("#metaScrapbook .meta-dot")`));
    t.check("quests show the claimable dot", await t.L(`!!document.querySelector("#metaQuests .meta-dot")`));
    await t.frames(40);
    let s = await S2();
    t.check("daily Chanukah gelt paid once (+18, holidayGifts stat)", s.totalCoins === 1018 && /^chanukah:/.test(s.holidayGiftKey || "") && s.stats.holidayGifts === 1,
      `coins ${s.totalCoins}, key ${s.holidayGiftKey}, gifts ${s.stats && s.stats.holidayGifts}`);
    const lit = await t.game(`(() => { let m = null; ctx.car.obj.traverse(o => { if (o.name === "MetaHoliday_menorah") m = o; });
      if (!m) return "none"; let n = 0; m.traverse(o => { if (/^Flame_/.test(o.name) && !o.parent.name.startsWith("Flame_") && o.visible) n++; });
      return (m.parent && m.parent.name) + ":" + n; })()`);
    t.check("a 3D menorah rides on the car with tonight's 3 candles + shamash lit", /deck.*:4$/.test(lit), lit);
    const ids3d = await t.L(`import("./js/features/meta/progress.js").then(m => m.questActiveIds())`);
    t.check("quests are the same three as the 2D game this week", JSON.stringify(ids3d) === JSON.stringify(active), ids3d.join(",") + " vs 2D " + active.join(","));
    await t.shot("title");

    // ── scrapbook: tabs with L1/R1, badges, portraits ──
    await t.click(/Scrapbook/);
    t.check("scrapbook opens (kraft-paper book)", await t.L(`!!document.querySelector(".card.meta-book .mb-grid")`));
    s = await S2();
    t.check("opening marks badges seen", (s.scrapSeen || 0) === (s.badges || []).length && s.badges.includes("score10k"), `seen ${s.scrapSeen}, badges ${(s.badges || []).join(",")}`);
    t.check("earned badges glow gold (Lead Foot via the 12k high score)", await t.L(`document.querySelector("#mbB_score10k").classList.contains("got") && !document.querySelector("#mbB_score50k").classList.contains("got")`));
    t.check("secret badges stay hidden", await t.L(`!document.querySelector("#mbB_sister")`));
    // D-pad down into the grid → the info panel follows the cursor
    await t.tap(13); await t.tap(13); await t.frames(2);
    const info = await t.L(`[document.querySelector(".mb-badge.focus") && document.querySelector(".mb-badge.focus").dataset.id, document.querySelector("#mbInfo .mb-info-nm").textContent]`);
    t.check("D-pad focus previews the badge", !!info[0] && info[1].length > 0, info.join(" → "));
    await t.frames(30);
    await t.shot("scrapbook-badges");
    await t.tap(5); await t.frames(3);
    t.check("R1 flips to the Record tab (rap sheet + ER card)", await t.L(`!!document.querySelector("#mbRap") && !!document.querySelector("#mbEr")`));
    t.check("rap sheet stamp + warrants", await t.L(`/REPEAT OFFENDER/.test(document.querySelector("#mbRap").textContent) && /Grand theft duck/.test(document.querySelector("#mbRap").textContent)`));
    t.check("ER punch card: 13 visits → 3 punched + a lollipop", await t.L(`document.querySelectorAll(".mb-punch i.on").length === 3 && /🍭×1/.test(document.querySelector("#mbEr").textContent)`));
    await t.until(`document.querySelectorAll(".mb-pic.ready").length >= 2`, "3D portraits render (mugshot + doctor)", 60000) && t.check("3D portraits render (mugshot + doctor)", true);
    await t.shot("scrapbook-record");
    await t.tap(5); await t.frames(3);
    t.check("Crew tab: Avigail at 72 = Friends", await t.L(`/Friends/.test(document.querySelector("#mbAvi").textContent)`));
    await t.until(`document.querySelectorAll(".mb-pic.ready").length >= 5`, "crew portraits render", 90000);
    await t.shot("scrapbook-crew");
    await t.tap(5); await t.frames(3);
    t.check("Stats tab: records + backup buttons", await t.L(`!!document.querySelector("#mbStats") && !!document.querySelector("#mbCopy") && !!document.querySelector("#mbLoad")`));
    await t.shot("scrapbook-stats");
    await t.tap(4); await t.frames(3);
    t.check("L1 flips back (Crew)", await t.L(`!!document.querySelector("#mbAvi")`));
    await t.tap(5); await t.frames(3);

    // save code made in 3D is a valid 2D code (2D's own codeToSave)
    await t.L(`document.querySelector("#mbCopy").click()`); await t.frames(3);
    const code = await t.L(`document.querySelector("#mbCodeOut").value`);
    const dec = twoD.codeToSave(code);
    t.check("3D save code decodes with the 2D game's codeToSave", !!dec && dec.totalCoins === 1018 && !!dec.lulu3d, code.slice(0, 16) + "…");
    await t.shot("savecode");
    await t.tap(1); await t.frames(3);
    t.check("○ goes back to the Stats tab", await t.L(`!!document.querySelector("#mbStats")`));
    await t.tap(1); await t.frames(3);
    t.check("○ closes the scrapbook to the title", await t.game(`ctx.state === "title"`) && await t.L(`!!document.getElementById("metaScrapbook")`));

    // ── portrait phone + TV layouts of the scrapbook ──
    await t.page.setViewportSize({ width: 390, height: 780 });
    await t.click(/Scrapbook/); await t.frames(20);
    const fits = await t.L(`document.querySelector("#screenCard").scrollWidth <= document.querySelector("#screenCard").clientWidth + 1`);
    t.check("phone portrait: no sideways overflow", fits);
    await t.shot("phone-scrapbook");
    await t.tap(1); await t.frames(2);
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`document.body.classList.add("tv")`);
    await t.click(/Scrapbook/); await t.frames(20);
    await t.shot("tv-scrapbook");
    await t.tap(1); await t.frames(2);
    await t.L(`document.body.classList.remove("tv")`);
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.frames(4);

    // ── weekly quests: claim with ✕ ──
    await t.click(/Quests/); await t.frames(10);
    t.check("quest board lists this week's 3 quests", await t.L(`document.querySelectorAll(".mq-card").length === 3`));
    t.check("the finished quest has a focused CLAIM button", await t.L(`!!document.querySelector(".mq-claim.focus")`));
    await t.shot("quests");
    await t.tap(0); await t.frames(30);
    s = await S2();
    t.check(`✕ claims "${q0.title}" → +${q0.reward} coins in the shared wallet`, s.quests.claimed[q0.id] === true && s.totalCoins === 1018 + q0.reward, `coins ${s.totalCoins}`);
    t.check("card shows ✓ CLAIMED", await t.L(`/CLAIMED/.test(document.querySelector("#mqCard_${q0.id}").textContent)`));
    await t.shot("quests-claimed");
    await t.tap(1); await t.frames(3);

    // ── a drive: streak, tutorial, stats feeds, honk-scare, banking ──
    const coins0 = (await S2()).totalCoins;
    await t.game(`L3.startRun({ mode: "cruise" })`);
    await t.frames(4);
    t.check("streak pill on the HUD", await t.L(`/Day 3 streak/.test((document.querySelector(".meta-streak") || {}).textContent || "")`));
    await t.shot("streak");
    await t.until(`__lulu3d.state === "playing"`, "cruise starts");
    await t.frames(10);
    s = await S2();
    t.check("daily streak: day 3 → +75 coins", s.streak === 3 && s.dayNum === today && s.totalCoins === coins0 + 75, `streak ${s.streak}, day ${s.dayNum}, coins ${coins0} → ${s.totalCoins}`);
    t.check("first-drive tutorial card is up (non-modal)", await t.L(`!!document.querySelector(".meta-tut")`) && await t.game(`ctx.state === "playing" && !ctx.paused && ctx.meta.tutorial`));
    await t.hold(7, 1);
    await t.frames(10);
    await t.shot("tutorial-streak");
    // fast-forward the info beat, then steer to learn STEER
    await t.game(`ctx.meta._tut().t = 99`); await t.frames(3);
    t.check("tutorial moves on to STEER", await t.game(`ctx.meta._tut().step === 1`));
    for (let i = 0; i < 60 && !(await t.game(`ctx.meta._tut().step >= 2`)); i++) { await t.stick(i % 10 < 5 ? -1 : 1); await t.frames(2); }
    await t.stick(0);
    await t.game(`ctx.meta._tut().t = Math.max(ctx.meta._tut().t, 1.3)`); await t.frames(3);
    t.check("steering for real completes STEER", await t.game(`ctx.meta._tut().step >= 2`), `step ${await t.game(`ctx.meta._tut().step`)}`);
    await t.shot("tutorial-speed");
    // skip from the pause menu (controller-friendly)
    await t.tap(9);
    t.check("pause menu offers ⏭ Skip tutorial + Scrapbook + Quests", await t.L(`["Skip tutorial", "Scrapbook", "Quests"].every(w => [...document.querySelectorAll("#screenCard .btn")].some(b => b.textContent.includes(w)))`));
    await t.click(/Skip tutorial/);
    t.check("skipping ends it for good (store meta.tutorialDone)", await t.game(`!ctx.meta.tutorial && !ctx.paused`) &&
      await t.L(`import("./js/core/save.js").then(m => m.save3d.f.meta.tutorialDone === true)`) && !(await t.L(`!!document.querySelector(".meta-tut")`)));

    // honk-scare a car out of Lulu's lane → honks10 49 → 50 (Honk Symphony)
    await t.game(`(() => { ctx.traffic.clear(); ctx.G.invT = 99; const c = ctx.car; ctx.traffic.add("sedan", c.s + 22, 1.75, 1, Math.max(8, c.speed - 4)); ctx.car.d; })()`);
    await t.game(`(() => { const c = ctx.car, p = ctx.world.road.point(c.s, 1.75, {}); c.place(p.x, p.z, p.h); c.vx = Math.sin(p.h) * 14; c.vz = Math.cos(p.h) * 14; })()`);
    await t.frames(2);
    await t.tap(4); await t.frames(30);
    // feeds from other features + core events
    await t.game(`(L3.emit("closeCall", { oncoming: false, combo: 7 }), L3.emit("stat", { id: "escapes2", n: 1 }), L3.emit("stat", { id: "footDist", n: 100 }), L3.emit("stat", { id: "weddings" }))`);
    await t.frames(40);
    s = await S2();
    t.check("honk-scare counted (honks10 → 50)", s.stats.honks10 === 50, `honks10 ${s.stats.honks10}`);
    t.check("stat events feed the shared scrapbook stats (2D ids)", s.stats.escapes2 === 2 && s.stats.weddings === 1 && s.stats.best.chain6 === 7 && s.stats.footDist === 1170,
      `escapes2 ${s.stats.escapes2} weddings ${s.stats.weddings} chain6 ${s.stats.best.chain6} footDist ${s.stats.footDist}`);
    const life0 = s.lifetimeScore;
    await t.game(`(ctx.G.score = 4321, ctx.G.coins = 260, L3.endRun("test"))`);
    await t.frames(40);
    s = await S2();
    t.check("run end banks lifetime score (+4,321)", s.lifetimeScore === life0 + 4321, `${life0} → ${s.lifetimeScore}`);
    t.check("run end banks run bests (coins 260)", s.stats.best.runCoins250 === 260, `${s.stats.best.runCoins250}`);
    t.check("new badges recorded (Honk Symphony, Wedding Crasher)", s.badges.includes("honks50") && s.badges.includes("wedding"), s.badges.join(","));
    await t.game(`L3.setState("title")`); await t.frames(10);

    // ── Purim: party hat + grogger horn ──
    await t.boot("&enable=meta&holiday=purim");
    await t.frames(30);
    const purim = await t.game(`(() => { const f = n => { let m = null; ctx.car.obj.traverse(o => { if (o.name === n) m = o; }); return m && m.parent ? m.parent.name : "none"; };
      return f("MetaHoliday_hat") + "|" + f("MetaHoliday_grogger"); })()`);
    t.check("Purim: party hat on Lulu's head, grogger in the passenger seat", /head/.test(purim.split("|")[0]) && /passenger/.test(purim.split("|")[1]), purim);
    t.check("Purim greeting on the title", await t.L(`/Freilichen Purim!/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("purim-title");
    await t.game(`L3.startRun({ mode: "cruise" })`);
    await t.until(`__lulu3d.state === "playing"`, "purim drive starts");
    t.check("the stock horn is a grogger (customHorn)", await t.game(`ctx.G.customHorn === true && ctx.G.metaGrogger === true`));
    await t.tap(4); await t.frames(2);
    t.check("honk whirls the grogger", await t.game(`(() => { let v = 0; ctx.car.obj.traverse(o => { if (o.name === "Grogger_Spin") v = Math.abs(o.rotation.y); }); return v > 0.05; })()`));
    // a close look at the hat + grogger
    await closeup(t, "purim-closeup", { back: -2.9, side: -1.2, up: 2.5, lookBack: 0.2, lookUp: 1.25, fov: 42 });

    // ── Pesach via the REAL Hebrew calendar (Intl): 2027-04-22 = 15 Nisan ──
    await t.boot("&enable=meta&metaDate=2027-04-22");
    await t.frames(30);
    t.check("Intl Hebrew calendar finds Pesach on 15 Nisan", await t.game(`(ctx.meta.holiday() || {}).h?.id === "pesach" && ctx.meta.holiday().dayNum === 1`));
    const mz = await t.game(`(() => { let m = null; ctx.car.obj.traverse(o => { if (o.name === "MetaHoliday_matzah") m = o; }); return m && m.parent ? m.parent.name : "none"; })()`);
    t.check("Pesach: matzah + Elijah's cup ride on the passenger seat", /passenger/.test(mz), mz);
    await closeup(t, "pesach-closeup", { back: -0.4, side: 2.4, up: 2.6, lookBack: 0.4, lookSide: 0.35, lookUp: 0.95, fov: 42 });

    // ── a Chanukah close-up of the menorah (night 8) ──
    await t.boot("&enable=meta&holiday=chanukah&holidayDay=8");
    await t.frames(20);
    await closeup(t, "menorah-closeup", { back: 3.6, side: 0.9, up: 2.25, lookBack: 1.3, lookUp: 1.25, fov: 36 });

    // ── restore a code made by the 2D game (2D's own saveToCode) ──
    const code2d = twoD.saveToCode({ totalCoins: 4242, highScore: 777, ownedSkins: ["pink", "gold"], badges: ["firstRun"], scrapSeen: 1, stats: { honks10: 3 } });
    await t.click(/Scrapbook/); await t.frames(3);
    await t.tap(4); await t.frames(3);   // L1 from Badges wraps to Stats
    await t.L(`document.querySelector("#mbLoad").click()`); await t.frames(3);
    await t.L(`document.querySelector("#mbCodeIn").value = "nope"`);
    await t.click(/Load this save/);
    t.check("a bad code is refused", await t.L(`/doesn't look like a save code/.test(document.querySelector("#mbErr").textContent)`));
    await t.L(`document.querySelector("#mbCodeIn").value = ${JSON.stringify(code2d)}`);
    await t.click(/Load this save/);
    t.check("confirm screen shows coins → coins", await t.L(`/4,242 coins/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("restore-confirm");
    const nav = t.page.waitForNavigation({ timeout: 60000 }).catch(() => null);
    await t.L(`[...document.querySelectorAll("#screenCard button")].find(b => /Yes, load it/.test(b.textContent)).click()`);
    await nav;
    await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reloads into the restored save", 120000);
    s = await S2();
    t.check("2D save code restored in 3D (coins 4,242 + gold car; backup kept)", s.totalCoins >= 4242 && (s.ownedSkins || []).includes("gold") && !!(await t.L(`localStorage.getItem("luluSaveV2_bak")`)), `coins ${s.totalCoins}`);
  },
};
