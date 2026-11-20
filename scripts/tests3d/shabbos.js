// 🕯️ Erev Shabbos Rush (features/shabbos): beat the sunset to Bubbe's before candle-lighting.
//  • Friday (mocked device clock): no title chip any more (roadmap 10) — ▶ PLAY's subtitle says "Erev Shabbos"
//    on a Friday afternoon only, and Ima asks at the door (features/onegame's test drives that); off in a party
//  • start → the countdown in the trip bar (no extra HUD; it survives HUD: Clean) → the sky sinks
//  • Ima calls twice (listen to the whole call: +0:10; a honk declines)
//  • escalation: thicker minivan traffic, people rushing home, shop gates, the LED trailer
//  • Lulu's frantic lines respect Chatter: Quiet
//  • make it: the arrival is ⏭ skippable (candles still get lit), coins by margin, the badge
//  • run out of time: the gentle fail card + retry
//  • the rare Cruise event: Ima's "Oy, it's erev Shabbos!" call turns a Cruise into the rush
//  • layouts: desktop 1280, TV 1080, phone landscape + portrait
const LAYOUTS = [["desktop-1280", 1280, 720, false, false], ["tv-1080", 1920, 1080, true, false],
  ["phone-landscape", 844, 390, false, true], ["phone-portrait", 390, 844, false, true]];

module.exports = {
  name: "shabbos",
  query: "&enable=shabbos,atmos&shabbosDate=2026-11-16T15:00",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 500, cruiseUnlocked: true, cruisePlayed: true },
  save3d: { best: 1000, settings: { quality: "low", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "off", hud: 1, hudMode: "full", chatter: "normal" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const info = () => g(`ctx.shabbos.debug.info()`);
    const props = () => g(`ctx.shabbos.debug.props()`);
    const setSave = code => t.L(`import("./js/core/save.js").then(m => { ${code} })`);
    const tp = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {});
      ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.world.prebuild(${s});
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.cam.snap(); return true; })()`);
    const chip = () => t.L(`/Erev Shabbos/.test((document.getElementById("play") || {}).textContent || "")`);   // (PLAY's Friday subtitle)
    const label = () => t.L(`document.getElementById("tripLabel").textContent`);
    const layouts = async (shot, check) => {
      for (const [name, w, h, tv, touch] of LAYOUTS) {
        await t.page.setViewportSize({ width: w, height: h });
        await setSave(`m.save3d.settings.tv = ${tv ? '"on"' : '"off"'};`);
        await g(`(ctx.applySettings(), true)`);
        if (touch) await t.L(`window.dispatchEvent(new Event("touchstart"))`);
        await t.frames(8);
        if (check) await check(name, w, h);
        await t.shot(`${shot}-${name}`);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await setSave(`m.save3d.settings.tv = "off";`);
      await g(`(ctx.applySettings(), true)`);
      await t.tap(11);
    };
    const onScreen = sel => t.L(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.offsetParent === null) return false;
      const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; })()`);

    t.check("ctx.shabbos service is up", await g(`!!ctx.shabbos && typeof ctx.shabbos.start === "function"`));
    t.check("no new home tile", !(await t.titleItems()).some(l => /shabbos/i.test(l)));

    // ── the Friday title feature (mocked clock) ─────────────────────────────
    t.check("no 🕯️ chip on the title (roadmap 10)", await t.L(`!document.getElementById("shabbosChip")`));
    t.check("Monday afternoon: PLAY says nothing about Shabbos", !(await chip()));
    await g(`ctx.shabbos.debug.date("2026-11-20T21:30")`);
    await g(`L3.openView("home")`);
    await t.frames(3);
    t.check("Friday night (after candles): nothing", !(await chip()));
    await g(`ctx.shabbos.debug.date("2026-11-20T15:00")`);
    await g(`L3.openView("home")`);
    await t.frames(4);
    t.check("Friday afternoon: ▶ PLAY's subtitle says Erev Shabbos", await chip());
    t.check("…and the rush is what Ima asks for at the door", await g(`ctx.shabbos.atDoor()`));
    // party: random / single-player features are off for everyone
    t.check("party source lists shabbos in the OFF set", await t.L(`fetch("./js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"shabbos"/.test(s))`));
    // (flip the party flag inside ONE evaluation: no frame runs, so nothing tries to reach a relay)
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ctxm = m; })`);
    const inParty = await g(`(() => { const N = ctx.party._debug.N; N.want = true;
      try { return { on: ctx.enabled("shabbos"), chip: ctx.shabbos.atDoor(), offer: ctx.shabbos.offer() }; }
      finally { N.want = false; } })()`);
    t.check("in a party: ctx.enabled('shabbos') is false, Ima doesn't ask, no Cruise call", !inParty.on && !inParty.chip && !inParty.offer, JSON.stringify(inParty));
    t.check("…and back on after the party", await g(`ctx.enabled("shabbos") && ctx.shabbos.atDoor()`));
    await layouts("title-friday", async (name, w) => {
      t.check(`${name}: ▶ PLAY (with the Friday line) is on screen`, await onScreen("#play") && await chip());
    });
    await g(`L3.openView("home")`);
    await t.frames(3);

    // ── a rush (ctx.shabbos.start — the world's door / a retry; no home street in this test: the 3-2-1) ──
    await g(`ctx.shabbos.start("title")`);
    if (!await t.until(`__lulu3d.state === "playing"`, "the rush starts")) return;
    let I = await info();
    t.check("a rush is on (mode shabbos, via title)", I.active && I.phase === "drive" && I.via === "title" && await g(`ctx.G.mode`) === "shabbos", JSON.stringify(I));
    t.check("…to Bubbe's house (the journey's stop 0)", I.dest === await g(`Math.round(ctx.journey.stopS(0))`), JSON.stringify(I));
    t.check("…with ~3 minutes on the clock", I.total >= 150 && I.total <= 220, I.total);
    await g(`(ctx.G.invT = 1e5, ctx.atmos.debug.cruise(22), true)`);
    await t.frames(6);
    t.check("the countdown is in the trip bar: 🕯️ Candles in m:ss", /🕯️ Candles in \d:\d\d · \d+\.\d mi/.test(await label()), await label());
    t.check("no extra HUD chip", await t.L(`document.querySelectorAll("#hud .hud-chip").length`) === 0);
    t.check("the sky: a long golden hour to start", Math.abs((await g(`ctx.atmos.clock`)) - 0.37) < 0.02, await g(`ctx.atmos.clock`));
    t.check("…and atmos runs its day off our clock", await g(`ctx.atmos.info().mode`) === "cruise");
    await setSave(`m.save3d.settings.hudMode = "clean";`);
    await g(`(ctx.applySettings(), true)`);
    await t.frames(2);
    t.check("HUD: Clean still shows the countdown", await onScreen("#tripLabel") && /Candles/.test(await label()));
    await setSave(`m.save3d.settings.hudMode = "full";`);
    await g(`(ctx.applySettings(), true)`);

    // ── Ima's two calls ─────────────────────────────────────────────────────
    await t.L(`window.__calls = []`);
    await t.L(`import("./js/core/ctx.js").then(m => m.on("shabbos:call", e => window.__calls.push(e)))`);
    await g(`ctx.shabbos.debug.setFrac(0.25)`);
    await t.until(`__lulu3d.ctx.phone.active && __lulu3d.ctx.phone.active.from === "IMA"`, "Ima's first call rings", 20000);
    t.check("call 1: \"Did you leave yet?!\"", await g(`/Did you leave yet/.test(ctx.phone.active.lines[0])`));
    await t.until(`__lulu3d.ctx.phone.talking`, "…she picks up when it rings out", 20000);
    await t.shot("ima-call-1");
    await t.until(`window.__calls.length >= 1`, "…the whole call plays", 30000);
    I = await info();
    t.check("…a full call: Ima stalls Bubbe (+0:10)", I.bonus === 10 && (await t.L(`window.__calls[0].result`)) === "full", JSON.stringify(I));
    await t.until(`!__lulu3d.ctx.phone.busy()`, "…the line clears", 20000);
    await g(`ctx.shabbos.debug.setFrac(0.61)`);
    await t.until(`__lulu3d.ctx.phone.active && __lulu3d.ctx.phone.active.from === "IMA"`, "Ima's second call rings", 20000);
    t.check("call 2: \"Bubbe is standing by the window\"", await g(`/standing by the window/.test(ctx.phone.active.lines[0])`));
    await t.tap(4);                                         // honk = decline
    await t.until(`window.__calls.length >= 2`, "a honk declines it", 20000);
    t.check("…declined, no bonus", (await t.L(`window.__calls[1].result`)) === "declined" && (await info()).bonus === 10);
    t.check("no third (random) Ima call during the rush", (await info()).ima === 2);

    // ── escalation ──────────────────────────────────────────────────────────
    await t.until(`!__lulu3d.ctx.phone.busy()`, "the line clears again", 20000);
    await g(`ctx.shabbos.debug.setFrac(0.82)`);
    await t.frames(4);
    t.check("traffic thickens (more cars, more minivans)", await g(`ctx.traffic.config.ours >= 9 && ctx.traffic.config.mix.van > 0.42`), JSON.stringify(await g(`ctx.traffic.config`)));
    t.check("the sun is way down (pink sunset)", (await g(`ctx.atmos.clock`)) > 0.46, await g(`ctx.atmos.clock`));
    await t.until(`__lulu3d.ctx.shabbos.debug.props().peds.length > 0`, "people rush home on the sidewalk", 30000);
    await t.until(`__lulu3d.ctx.shabbos.debug.props().sign`, "the LED trailer goes up", 20000);
    t.check("…\"SHABBOS IN\" on the trailer", /SHABBOS IN|CANDLES|GOOD/.test((await props()).sign.text), JSON.stringify((await props()).sign));
    const P0 = await props();
    t.check("storefronts are planned + reserved along the way", P0.planned >= 3 && P0.reserved === P0.planned, JSON.stringify(P0));
    // drive up to the next storefront: its gate is coming down
    const slotS = await t.L(`import("./js/features/shabbos/props.js").then(m => { const s = __lulu3d.ctx.car.s; const sl = m.shops.plan.find(x => x.s > s + 80); return sl ? Math.round(sl.s) : null; })`);
    if (slotS) {
      await tp(slotS - 70, 1.75, 18);
      await t.until(`__lulu3d.ctx.shabbos.debug.props().shops.some(s => s.gate > 0.9)`, "a storefront by the road slams its gate", 15000);
      t.check("…a storefront by the road, gate down", (await props()).shops.length >= 1, JSON.stringify((await props()).shops));
      await t.shot("rush-shops");
    }
    await g(`ctx.banter && ctx.banter.say("The sun is literally setting AT me!")`);
    await t.frames(4);
    await layouts("rush", async (name) => {
      t.check(`${name}: the countdown is on screen`, await onScreen("#tripLabel"));
    });

    // ── Lulu's lines: Quiet keeps to the big moments ────────────────────────
    const lineNow = () => g(`(ctx.shabbos.debug.line(), true)`);
    await setSave(`m.save3d.settings.chatter = "quiet";`);
    let n0 = await g(`ctx.banter.lulu.count`);
    await lineNow(); await t.frames(3);
    t.check("Chatter: Quiet — no small-talk line", (await g(`ctx.banter.lulu.count`)) === n0);
    await setSave(`m.save3d.settings.chatter = "normal";`);
    await g(`(ctx.banter.lulu.last = -99, true)`);
    n0 = await g(`ctx.banter.lulu.count`);
    await lineNow(); await t.frames(3);
    t.check("Chatter: Normal — Lulu says a frantic line", (await g(`ctx.banter.lulu.count`)) > n0, await g(`ctx.banter.line`));

    // ── make it: the arrival (⏭ skippable) + the card ───────────────────────
    const c0 = await g(`ctx.G.coins`);
    const dest = (await info()).dest;
    await g(`ctx.shabbos.debug.setFrac(0.55)`);
    await tp(dest - 130, 1.75, 20);
    if (!await t.until(`__lulu3d.state === "shabbosArrive"`, "pulling up at Bubbe's starts the arrival", 20000)) return;
    t.check("the porch set is on Bubbe's house", (await props()).porch);
    await t.until(`document.getElementById("skipBtn").classList.contains("show")`, "the ⏭ skip pill shows", 10000);
    await t.until(`__lulu3d.ctx.shabbos.debug.props().open > 0.9`, "Bubbe's door swings open", 10000);
    await t.frames(10);
    await t.shot("arrive-door");
    await t.hold(1, 0); await t.frames(2);
    const f0 = await g(`ctx.frames`);
    await t.hold(1, 1);
    await t.until(`__lulu3d.state === "shabbosResult"`, "holding ○ skips to the card", 8000);
    await t.hold(1, 0);
    t.check("…in a blink", (await g(`ctx.frames`)) - f0 < 120);
    t.check("the skipped arrival still lit the candles", (await props()).lit === 2, JSON.stringify(await props()));
    t.check("the card: MADE IT FOR CANDLES", await t.L(`/MADE IT FOR CANDLES/.test(document.getElementById("screenCard").textContent)`));
    I = await info();
    t.check("coins by margin", I.pay >= 25 && (await g(`ctx.G.coins`)) - c0 >= I.pay, JSON.stringify(I));
    t.check("the 🕯️ badge is earned", await g(`(() => { const S = JSON.parse(localStorage.luluSaveV2); return (S.stats && S.stats.shabbosMade) >= 1; })()`));
    t.check("…and named on the card", await t.L(`/Made It for Candles/.test(document.getElementById("screenCard").textContent)`));
    await layouts("made", async (name) => {
      t.check(`${name}: the card fits`, await t.L(`(() => { const c = document.getElementById("screenCard"); const r = c.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && c.scrollHeight <= c.clientHeight + 2; })()`));
    });

    // ── retry → run out of time → the fail card ─────────────────────────────
    await t.click(/Race the sunset again/);
    if (!await t.until(`__lulu3d.state === "playing"`, "retry starts a fresh rush")) return;
    I = await info();
    t.check("…fresh: the clock is full again", I.active && I.phase === "drive" && I.used < 2 && I.bonus === 0, JSON.stringify(I));
    await g(`(ctx.G.invT = 1e5, true)`);
    await g(`ctx.shabbos.debug.setLeft(0.5)`);
    if (!await t.until(`__lulu3d.state === "shabbosResult"`, "the sun wins: the fail card", 10000)) return;
    const txt = await t.L(`document.getElementById("screenCard").textContent`);
    t.check("…a gentle, funny line", /Too late for candles/.test(txt) && /cold cholent|Forever|FINE|not upset|kugel|neighbours/.test(txt), txt.slice(0, 200));
    t.check("…with a retry", /Try again/.test(txt));
    await t.frames(90);                                     // (we jumped the clock: let the sky catch up to dusk)
    t.check("…the sun has set behind the card", (await g(`ctx.atmos.clock`)) > 0.49, await g(`ctx.atmos.clock`));
    const top = await g(`(() => { const c = ctx.world.sky.material.uniforms.top.value; return +(c.r * 0.3 + c.g * 0.59 + c.b * 0.11).toFixed(3); })()`);
    t.check("…and the sky really is dusk (not repainted to day)", top < 0.2, `top luminance ${top}`);
    await t.shot("late");
    await t.click(/Try again/);
    t.check("retry from the fail card", await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.shabbos.active`, "…drives again"));

    // ── the rare Cruise event: "Oy, it's erev Shabbos!" ─────────────────────
    await g(`L3.setState("title")`);
    await t.frames(4);
    t.check("back on the title the rush is torn down", !(await g(`ctx.shabbos.active`)) && await g(`ctx.traffic.config.ours`) <= 6);
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a Cruise starts")) return;
    await g(`(ctx.G.invT = 1e5, ctx.atmos.debug.time("noon"), true)`);
    await tp(600, 1.75, 18);
    await t.frames(4);
    t.check("Ima rings in Cruise", await g(`ctx.shabbos.offer()`));
    t.check("…\"Oy, it's erev Shabbos!\"", await g(`ctx.phone.active && /erev Shabbos/.test(ctx.phone.active.lines[0])`));
    await t.shot("cruise-call");
    await t.until(`__lulu3d.ctx.shabbos.active`, "letting it ring turns the Cruise into the rush", 20000);
    I = await info();
    t.check("…via cruise, a fair clock from here", I.via === "cruise" && I.total > 100 && I.total < 200 && await g(`ctx.G.mode`) === "shabbos", JSON.stringify(I));
    await t.frames(200);
    t.check("…time flies: the sky catches up to golden hour", (await g(`ctx.atmos.clock`)) > 0.33, await g(`ctx.atmos.clock`));
    await g(`L3.setState("title")`);
    await t.frames(4);
    t.check("the Cruise clock comes back after the rush", (await g(`ctx.atmos.clock`)) < 0.3, await g(`ctx.atmos.clock`));
  },
};
