// Law: hidden speed trap → pursuit (real cruisers, light bars) → escape;
// a second chase → BUSTED → the pull-over choice → arrest cinematic → booking
// → the cell (lawyer menu, lockpick jailbreak) → fugitive run (stars, K9,
// missile, chopper) → refresh keeps the fugitive lockup → arrest → court
// (plea bargain) → back on the road; jail verdict → serving time → walk out;
// a wreck caused by a cop is claimed by law; pepper-spraying a cop = arrest.
const D = `ctx.law._dbg`;
module.exports = {
  name: "law",
  query: "&enable=law",
  save2d: { totalCoins: 3000, convictions: 0, offenses: 0, escapes: 0, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const st = () => t.game(`ctx.state`);
    const log = ev => t.game(`${D}.log.filter(e => e.ev === ${JSON.stringify(ev)})`);
    const save2d = () => t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`);
    // advance any open dialogue: ✕ through lines, pick `choice(text)` when options show
    async function talk(untilCode, label, pickRe = null, max = 160) {
      for (let i = 0; i < max; i++) {
        if (await t.game(untilCode)) return true;
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length && pickRe) {
          const idx = opts.findIndex(o => pickRe.test(o));
          if (idx >= 0) { await t.L(`document.querySelectorAll("#dialog .opt")[${idx}].click()`); await t.frames(3); continue; }
        }
        await t.tap(0);
      }
      t.check(label, false, "never reached: " + untilCode + " · state " + await st());
      return false;
    }
    // tap ✕ through the (skippable) arrest → precinct → booking cutscenes until the cell menu is up
    const CELL = `__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
    const toCell = label => talk(CELL, label, null, 500);
    const placeFast = (ds = 0, v = 38) => t.game(`(() => { const r = ctx.world.road, s = ctx.car.s + ${ds}, p = r.point(s, 1.75, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; return s; })()`);

    t.check("ctx.law service is provided", await t.game(`!!ctx.law && typeof ctx.law.startChase === "function" && typeof ctx.law.arrest === "function"`));
    t.check("built-in speed traps are replaced", await t.game(`ctx.world.config.speedTraps === false`));

    // ── a hidden speed trap catches her speeding ──
    await t.game(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear())`);
    await t.game(`${D}.spawnTrap(70, 1)`);
    await t.frames(4);
    await t.shot("trap-hidden");
    await t.hold(7, 1);
    await placeFast(0, 40);
    await t.until(`__lulu3d.ctx.law.chasing`, "speeding past the hidden cop starts a chase", 60000);
    t.check("speeding past the hidden cop starts a chase", await t.game(`ctx.law.chasing`));
    t.check("cop:chase {active:true} is emitted", (await log("cop:chase")).some(e => e.active));
    t.check("a real cruiser is chasing", await t.game(`${D}.L.units.some(u => u.mode === "chase" && u.car && u.car.ai)`));
    await t.frames(40);
    t.check("the light bar flashes", await t.game(`${D}.L.units.some(u => u.rig && u.rig.on)`));
    await t.shot("chase");

    // ── escape: get far from every cruiser ──
    await t.game(`${D}.L.units.forEach(u => { if (u.car) { u.car.x -= Math.sin(u.car.h) * 300; u.car.z -= Math.cos(u.car.h) * 300; u.car.speed = 0; } })`);
    await t.until(`!__lulu3d.ctx.law.chasing`, "outrunning the cops ends the chase", 60000);
    const ended = (await log("cop:chase")).filter(e => e.active === false);
    t.check("escape → cop:chase {active:false, result:'escaped'}", ended.some(e => e.result === "escaped"), JSON.stringify(ended.slice(-1)));
    t.check("escaping emits the 2D 'escapes2' stat", (await log("stat")).some(e => e.id === "escapes2"));
    await t.hold(7, 0);

    // ── a second chase: she stops → BUSTED → the pull-over ──
    await t.game(`(${D}.L.grace = 0, ${D}.FORCE.bustOutcome = "ticket")`);
    await t.game(`ctx.law.startChase("PASSING A STOPPED SCHOOL BUS", { msg: "🚨 BUS SIGN!" })`);
    t.check("ctx.law.startChase works from another feature", await t.game(`ctx.law.chasing && ctx.law.wanted >= 1`));
    await t.frames(10);
    // stop dead and park the cruiser right behind her
    await t.game(`(() => { const c = ctx.car; c.vx = c.vz = 0; const u = ${D}.L.units.find(u => u.mode === "chase");
        u.car.x = c.pos.x - Math.sin(c.h) * 7; u.car.z = c.pos.z - Math.cos(c.h) * 7; u.car.h = c.h; u.car.speed = 0; })()`);
    await t.until(`__lulu3d.state === "lawBust"`, "stopping with a cop on her tail = BUSTED", 60000);
    t.check("stopping with a cop on her tail = BUSTED", await st() === "lawBust");
    await t.until(`document.querySelectorAll("#dialog .opt").length > 0 || document.querySelector("#dialog.open")`, "the officer talks", 60000);
    await t.frames(10);
    await t.shot("bust-window");
    await talk(`[...document.querySelectorAll("#dialog .opt")].some(b => b.style.visibility !== "hidden")`, "Lulu gets to choose how to play it");
    t.check("Lulu gets to choose how to play it", (await t.L(`document.querySelectorAll("#dialog .opt").length`)) >= 3);
    await t.shot("bust-choice");
    await talk(`__lulu3d.state === "lawArrest"`, "a ticket outcome leads to the arrest", /Slip|snack|charm|Come clean/);
    t.check("booked → the arrest cinematic", await st() === "lawArrest");
    await t.until(`!!document.querySelector("#lawUI .law-head:not(.hidden)")`, "UNDER ARREST header", 30000);
    await t.frames(30);
    await t.shot("arrest-cuffs");
    await t.until(`__lulu3d.state === "lawJail"`, "hauled to the precinct", 400000);
    t.check("hauled to PRECINCT 18½", await st() === "lawJail");
    await t.frames(30);
    await t.shot("precinct");
    // skip ahead to the cell
    await t.until(`__lulu3d.ctx.law._dbg.jail() && ["intake", "cell"].includes(__lulu3d.ctx.law._dbg.jail().phase)`, "booking & intake", 400000);
    await t.frames(25);
    await t.shot("booking");
    await t.until(CELL, "the cell menu", 400000);
    const sv = await save2d();
    t.check("booking counts an offense (shared 2D save)", sv.offenses === 1, `offenses ${sv.offenses}`);
    t.check("the lockup is saved for a refresh (mode 'cell')", sv.lockup && sv.lockup.mode === "cell", JSON.stringify(sv.lockup || null).slice(0, 120));
    t.check("charges carried into the cell", sv.lockup && sv.lockup.charges.includes("PASSING A STOPPED SCHOOL BUS"));
    await t.frames(10);
    await t.shot("cell");
    // lawyer menu with the controller: → (D-pad right, down) + ✕, then ○ back
    await t.game(`document.querySelector("#lawLawyer").click()`);
    await t.frames(3);
    t.check("the lawyer menu lists the 2D tiers", await t.L(`/Public Defender/.test(document.querySelector("#screenCard").textContent) && /Hotshot/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("lawyers");
    await t.tap(1);
    t.check("○ goes back to the cell menu", await t.L(`!!document.querySelector("#lawEsc")`));

    // ── jailbreak: pick the lock ──
    await t.game(`(${D}.FORCE.escapeKind = "keys", document.querySelector("#lawEsc").click())`);
    await t.frames(4);
    t.check("escape starts the lockpick", await t.game(`${D}.jail().phase === "pick"`));
    t.check("the escape attempt is burned at once (no refresh exploit)", (await save2d()).lockup.escUsed === true);
    await t.frames(8);
    await t.shot("lockpick");
    for (let i = 0; i < 8 && await t.game(`${D}.jail() && ${D}.jail().phase === "pick" && !${D}.jail().lock.result`); i++) {
      await t.game(`(() => { const lk = ${D}.jail().lock; lk.pos = lk.zoneC; lk.dir = 0; lk.armT = 0; })()`);
      await t.tap(0);
    }
    t.check("hitting the green zone picks every pin", await t.game(`${D}.jail().lock.result === "win"`));
    await t.until(`__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "escape"`, "the jailbreak vignette plays", 60000);
    await t.frames(30);
    await t.shot("jailbreak");
    await t.until(`["intro", "playing"].includes(__lulu3d.state)`, "back on the road as a fugitive", 120000);
    const sv2 = await save2d();
    t.check("jailbreak counted (shared save.escapes)", sv2.escapes === 1);
    t.check("fugitive lockup persisted", sv2.lockup && sv2.lockup.mode === "fugitive");
    t.check("open charges go on the warrant file", Array.isArray(sv2.wanted) && sv2.wanted.length > 0);
    t.check("ctx.law.fugitive", await t.game(`ctx.law.fugitive && ctx.law.wanted >= 1`));
    await t.until(`__lulu3d.state === "playing"`, "countdown ends", 60000);
    // high heat: K9, missile, chopper
    await t.game(`(${D}.L.fug.t = 60, ${D}.L.grace = 99, ${D}.spawnK9(), ${D}.fireMissile(), ${D}.ensureChopper())`);
    await t.frames(30);
    t.check("5★ brings the chopper", await t.game(`!!${D}.L.chopper`));
    t.check("the HUD shows the FUGITIVE stars", await t.L(`/FUGITIVE/.test((document.querySelector(".law-wanted") || {}).textContent || "")`));
    await t.shot("fugitive-chopper");

    // ── a refresh keeps the fugitive heat (like the 2D lockup) ──
    await t.page.reload();
    await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reboots", 120000);
    await t.frames(5);
    t.check("title card warns she's a FUGITIVE", await t.L(`/FUGITIVE/.test(document.querySelector("#screenCard").textContent)`));
    await t.game(`L3.startRun({ mode: "cruise" })`);
    await t.until(`__lulu3d.state === "playing"`, "drives again", 60000);
    t.check("still a fugitive after the refresh", await t.game(`ctx.law.fugitive`));

    // ── pepper-spraying a cop = assaulting an officer ──
    await t.game(`(${D}.L.grace = 99, ${D}.spawnPatrol({ fast: true, oncoming: false }))`);
    await t.game(`(() => { const u = ${D}.L.units[0]; const c = ctx.car; u.car.free = true; u.car.ai = () => {}; u.car.x = c.pos.x + Math.sin(c.h) * 8; u.car.z = c.pos.z + Math.cos(c.h) * 8; })()`);
    await t.game(`L3.emit("item:use", { id: "pepper", x: ctx.car.pos.x + Math.sin(ctx.car.h) * 8, z: ctx.car.pos.z + Math.cos(ctx.car.h) * 8 })`);
    await t.until(`__lulu3d.state === "lawArrest"`, "pepper-spraying a cop gets her arrested", 30000);
    t.check("pepper-spraying a cop gets her arrested", await st() === "lawArrest");
    t.check("…for ASSAULTING AN OFFICER", (await log("law:arrest")).length >= 0 && await t.L(`/ASSAULTING/.test(document.querySelector("#lawUI .law-head").textContent)`));
    // straight to court (skip the cinematic + booking with ✕)
    await toCell("booked again");
    const before = await save2d();
    await t.game(`(${D}.FORCE.quietCourt = true, ${D}.FORCE.guest = "abba", document.querySelector("#lawCourtBtn").click())`);
    await t.until(`__lulu3d.state === "lawCourt"`, "to court", 30000);
    await t.until(`!!document.querySelector("#dialog.open")`, "the trial opens", 120000);
    await t.frames(20);
    await t.shot("court-judge");
    await talk(`[...document.querySelectorAll("#dialog .opt")].some(b => b.style.visibility !== "hidden")`, "asked how she pleads");
    t.check("how do you plead (3 defenses + plea bargain)", (await t.L(`[...document.querySelectorAll("#dialog .opt")].map(b => b.textContent).join("|")`)).includes("Plea bargain"));
    await t.shot("court-plead");
    await talk(`__lulu3d.state === "lawExit" || __lulu3d.state === "intro" || __lulu3d.state === "playing"`, "the plea is accepted", /Plea bargain/);
    const after = await save2d();
    const verdict = (await log("law:verdict")).slice(-1)[0] || {};
    t.check("plea bargain → a fine", verdict.verdict === "fine" && verdict.plea === true, JSON.stringify(verdict));
    t.check("…paid out of the shared wallet", after.totalCoins < before.totalCoins, `${before.totalCoins} → ${after.totalCoins}`);
    t.check("…and no strike for the plea", (after.convictions || 0) === (before.convictions || 0));
    t.check("court clears the lockup and warrants", !after.lockup && (!after.wanted || after.wanted.length === 0));
    if (await st() === "lawExit") { await t.frames(20); await t.shot("court-exit"); }
    await t.until(`["intro", "playing"].includes(__lulu3d.state)`, "back on the road after court", 300000);
    t.check("back on the road after court", ["intro", "playing"].includes(await st()));

    // ── a jail verdict: serve the sentence, walk out ──
    await t.until(`__lulu3d.state === "playing"`, "playing again", 300000);
    await t.game(`(${D}.FORCE.verdict = "jail", ctx.law.arrest(["GRAND THEFT AUTO", "JOYRIDING"], { skipCinematic: true }))`);
    await toCell("booked for GTA");
    await t.game(`document.querySelector("#lawCourtBtn").click()`);
    await t.until(`!!document.querySelector("#dialog.open")`, "second trial", 120000);
    await talk(`__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "serve"`, "guilty → serving the sentence", /Beg|Plead|Invoke|good girl|OBJECT|Dazzle|Lie|Blame|insanity|Tip|Bribe/);
    t.check("a jail verdict adds a conviction", (await save2d()).convictions === 1);
    t.check("serving is persisted (lockup 'serving')", (await save2d()).lockup.mode === "serving");
    await t.frames(30);
    await t.shot("serving");
    await t.game(`${D}.jail().serve.serveDays = ${D}.jail().serve.total - 2`);
    for (let i = 0; i < 6; i++) await t.tap(0);
    await t.until(`__lulu3d.state === "lawExit" || __lulu3d.state === "intro" || __lulu3d.state === "playing"`, "time served → walk out", 300000);
    t.check("time served clears the lockup", !(await save2d()).lockup);

    // ── a cop-caused wreck is claimed by law (priority 30) ──
    await t.until(`__lulu3d.state === "playing"`, "driving", 300000);
    await t.game(`(ctx.G.invT = 0, ctx.G.hearts = 1, L3.damage(1, "Rammed a cruiser", "cop"))`);
    await t.until(`__lulu3d.state === "lawArrest"`, "wrecking against a cop → arrest", 60000);
    t.check("wrecking against a cop → arrest (hooks.wreck)", await st() === "lawArrest");
    t.check("…for DESTROYING A POLICE CRUISER", await t.L(`/DESTROYING/.test(document.querySelector("#lawUI .law-head").textContent)`));

    // phone portrait: the cell menu doesn't break the layout
    await toCell("cell again");
    await t.page.setViewportSize({ width: 390, height: 800 });
    await t.frames(6);
    t.check("portrait: the cell menu fits on screen", await t.L(`(() => { const r = document.querySelector("#screenCard").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })()`));
    await t.shot("cell-portrait");
  },
};
