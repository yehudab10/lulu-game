// 🎮 ONE GAME, NOT A MENU OF MODES (roadmap 10, features/onegame + core/screens.js).
//
//  • A fresh save: the title has ONE big ▶ PLAY + one small play tile (👯 Friends — 👧 Dina's is hidden for now), no
//    "More to play", no Story Trip / Cruise / Parking Challenge / Shabbos chip — PLAY isn't locked, and a
//    first-time player is walking at home within a few seconds.
//  • HIDDEN FOR NOW (the owner, 2026-11-22 — features/onegame/switches.js): the Story Trip (no suitcase, no 📱 story map,
//    no road-trip start, Ima's first line just the car) and Dina's porch ✋. Then each switch is flipped ON and the old
//    ways in are played through, so their content stays covered (Dina's room + her school bus: scripts/tests3d/hidden.js).
//  • The road trip: ✋ the 🧳 suitcase by the car → the Story Trip's leg 1 starts right where she stands (no title,
//    no countdown); a stop on the 📱 🗺️ Map → that leg starts ROLLING at its start (no 3-2-1); "Call it a
//    trip" → 🏠 Head home → on her feet at home again.
//  • The parking challenge: the 🅿️ booth stands at a rest area's course (✋ → the attendant → unlock → the course is
//    marked, she stays on foot); in the car the START box starts it, ❚❚ › Leave → driving there; its card in the 📱 💼
//    Jobs app marks the course; the phone keeps its 9 apps.
//  • Dina: ✋ on Dina on the porch → her picker → pick Lulu → back home on foot; the Dina tile → back to the title.
//  • A Friday afternoon: PLAY's subtitle says so, Ima asks at the door, getting in the car starts the rush;
//    the rush's card → 🏠 Head home.
//  • The new home screen fits a phone (portrait + landscape) and the 720p / 1080p TV layouts.
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

module.exports = {
  name: "onegame",
  query: "&enable=world,foot,party,exits,shabbos",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 40, ownedSkins: ["pink"], selectedSkin: "pink" },     // a brand-new player (Cruise never unlocked)
  async run(t) {
    const g = t.game;
    const st = () => g(`ctx.state`);
    const label = () => g(`((ctx.foot.debug.interactables() || {}).label || "")`);
    // (a teleport on foot: her road coords too, or foot's safety-net limit would pull her back toward the road)
    const place = (x, z, hint = null) => g(`(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(${x}, ${z}, ${hint == null ? "F.s" : hint}, {});
      F.pos.set(${x}, 0.05, ${z}); F.s = n.s; F.d = n.d; F.vel.set(0, 0, 0); return true; })()`);
    const shared = code => t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { ${code} }); return true; })`);
    const focusId = () => t.L(`(document.querySelector("#screenCard .focus") || {}).id || ""`);
    const fits = () => t.L(`(() => { const c = document.getElementById("screenCard"), r = c.getBoundingClientRect();
      return { ok: c.scrollHeight <= c.clientHeight + 2 && r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1,
               sh: c.scrollHeight, ch: c.clientHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), w: innerWidth, h: innerHeight }; })()`);
    await t.frames(10);

    // ── the title ───────────────────────────────────────────────────────────
    const home = await t.L(`(() => { const ids = sel => [...document.querySelectorAll(sel)].map(b => b.id);
      return { hero: ids("#screenCard .tile.hero"), tiles: ids("#screenCard .home-tiles .tile"), groups: ids("#screenCard .home-groups .tile"),
               chip: !!document.getElementById("shabbosChip"), text: document.querySelector("#screenCard .home").textContent }; })()`);
    t.check("title: ONE big ▶ PLAY hero", home.hero.length === 1 && home.hero[0] === "play" && /PLAY/.test(home.text), home.hero.join(","));
    t.check("title: no small play tiles — 👯 Friends lives in the game now, 👧 Dina's is hidden for now", home.tiles.length === 0, home.tiles.join(","));
    t.check("title: no 'More to play' overflow", !home.groups.includes("tg_play") && !/More to play/.test(home.text), home.groups.join(","));
    const labels = (await t.titleItems()).join(" | ");
    t.check("title: no Story Trip / Cruise / Parking Challenge items", !/Story Trip|Cruise|Parking Challenge/.test(labels), labels);
    t.check("title: no Shabbos chip", !home.chip);
    t.check("title: no Road to Vegas map (hidden — and no progress yet)", !/Road to Vegas/.test(labels));
    t.check("title: PLAY has the focus", await focusId() === "play", await focusId());
    await t.shot("title");

    // ── PLAY: a first-time player is walking at home within seconds ──────────
    // (an ordinary weekday: on a REAL Friday afternoon Ima would ask for the Shabbos rush instead — that's tested below)
    await g(`(ctx.shabbos && ctx.shabbos.debug && ctx.shabbos.debug.date && ctx.shabbos.debug.date("2026-11-18T15:00"), true)`);
    const f0 = await g(`ctx.frames`);
    await t.tap(0);
    t.check("✕ on PLAY → on foot at home (never locked)", await t.until(`__lulu3d.state === "footRun"`, "footRun", 4000));
    const S0 = await g(`({ frames: ctx.frames - ${f0}, mode: ctx.G.mode, reason: ctx.foot.debug.F.reason, phase: ctx.foot.phase, card: L3.H.screenOpen() })`);
    t.check("…walking within a few seconds, no card", S0.phase === "walk" && S0.frames <= 90 && !S0.card, JSON.stringify(S0));
    t.check("…it's the open world (a 'cruise' run, reason 'home')", S0.mode === "cruise" && S0.reason === "home");
    await t.frames(30);
    const dep = await g(`ctx.places.home.depart()`);
    t.check("Ima's first line: just the car (no suitcase — the Story Trip is hidden)", /car/i.test(dep.line) && !/suitcase|Bubbe/i.test(dep.line), dep.line);
    t.check("hidden: no 🧳 suitcase by the car", !(await g(`ctx.onegame.info()`)).suitcase);
    t.check("hidden: no 🗺️ story map in the 📱", !(await g(`ctx.phone.apps()`)).includes("map"));
    t.check("hidden: the road trip won't start (from anywhere)", !!(await g(`ctx.onegame.tripBlock()`)) && !(await g(`ctx.onegame.roadTrip("test")`)) && (await g(`ctx.G.mode`)) === "cruise");
    // ── …and with the switch ON, the old ways in (ONEGAME.story) ──
    await g(`(ctx.onegame.switches.story = true, true)`);
    await t.frames(3);
    const info = await g(`ctx.onegame.info()`);
    t.check("story ON: the 🧳 suitcase stands by the car", info.suitcase);

    // ── 🧳 the suitcase → the road trip, right here ──────────────────────────
    const sc = await g(`({ x: ctx.onegame.debug.SC.pos.x, z: ctx.onegame.debug.SC.pos.z })`);
    await place(sc.x + 0.6, sc.z);
    await t.frames(4);
    const lb = await label();
    t.check("at the suitcase: ✋ ROAD TRIP TO VEGAS — first stop", /ROAD TRIP TO VEGAS.*first stop.*Bubbe/i.test(lb), lb);
    await t.shot("suitcase");
    await t.tap(0);
    t.check("✋ → the road trip starts (Story mode, on foot, at home)", await t.until(`__lulu3d.ctx.G.mode === "story" && __lulu3d.state === "footRun"`, "story", 3000));
    const T1 = await g(`({ leg: ctx.G.jLeg, x: ctx.foot.pos.x, z: ctx.foot.pos.z, reason: ctx.foot.debug.F.reason, card: L3.H.screenOpen() })`);
    t.check("…leg 1, right where she stood (no walk back to the porch, no card)", T1.leg === 0 && near(T1, sc) < 2.2 && !T1.card && T1.reason === "home", JSON.stringify(T1));
    t.check("…the suitcase's ✋ is gone while she's on the trip", !/ROAD TRIP/.test(await label()));
    await g(`ctx.foot.debug.getIn()`);
    t.check("…and she drives off on it", await t.until(`["worldPullOut", "playing"].includes(__lulu3d.state) && __lulu3d.ctx.G.mode === "story"`, "story car", 3000));

    // ── "Call it a trip" → 🏠 Head home ───────────────────────────────────────
    await g(`(L3.endRun("trip"), L3.setState("tripDone"), true)`);
    await t.frames(3);
    t.check("the trip card has 🏠 Head home (not the title)", await t.L(`!!document.getElementById("jHome") && !/Title screen/.test(document.getElementById("screenCard").textContent)`));
    await t.L(`document.getElementById("jHome").click()`);
    t.check("🏠 Head home → on her feet at home again (Cruise)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.G.mode === "cruise" && __lulu3d.ctx.foot.debug.F.reason === "home"`, "home", 3000));

    // ── 📱 the 🗺️ Map: a stop launches that leg ROLLING at its start ─────────
    await shared(`s.storyStop = 2; s.postcards = ["bubbe", "heshy"];`);
    const apps = await g(`ctx.phone.apps()`);
    t.check("the 📱 keeps ≤ 9 apps (no new Road Trip / Parking apps)", apps.length <= 9 && !apps.some(a => /roadtrip|todo|parking/.test(a)), apps.join(","));
    await g(`ctx.phone.openPhone("map")`);
    await t.until(`__lulu3d.state === "storyMap"`, "the map opens", 4000);
    await t.frames(20);
    t.check("…the map is on the next stop (THE BEACH)", await t.L(`/THE BEACH/i.test(document.getElementById("jmInfo").textContent)`));
    await t.shot("phone-map");
    const states = [];
    await t.tap(0);                     // ✕ on the focused stop
    for (let i = 0; i < 40; i++) { states.push(await st()); if (states[states.length - 1] === "playing") break; await t.frames(1); }
    const T2 = await g(`({ mode: ctx.G.mode, leg: ctx.G.jLeg, s: ctx.car.s, start: ctx.journey.stopS(1) + 34, v: ctx.car.speed })`);
    t.check("🗺️ → leg 3 rolling at its start (no 3-2-1)", T2.mode === "story" && T2.leg === 2 && Math.abs(T2.s - T2.start) < 30 && !states.includes("intro") && states.includes("playing"), JSON.stringify(T2) + " " + [...new Set(states)].join(">"));
    await t.frames(4);
    t.check("…already moving", (await g(`ctx.car.speed`)) > 4);
    await g(`(L3.endRun("trip"), L3.setState("tripDone"), true)`);
    await t.frames(2);
    await t.L(`document.getElementById("jHome").click()`);
    t.check("…and home again", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.G.mode === "cruise"`, "home 2", 3000));

    // ── 👧 Dina on the porch: hidden for now (no ✋), then with ONEGAME.dinaTile ON ──
    await g(`(ctx.onegame.switches.story = false, true)`);
    const dHidden = await g(`ctx.onegame.debug.dinaSpot.pos() === null`);
    t.check("hidden: no ✋ PLAY AS DINA on the porch", dHidden);
    await g(`(ctx.onegame.switches.dinaTile = true, true)`);
    const dn = await g(`(() => { const p = ctx.onegame.debug.dinaSpot.pos(); return p && { x: p.x, z: p.z }; })()`);
    const startLabel = await label();
    t.check("at the porch steps (the start): no accidental ✋ PLAY AS DINA", !/DINA/.test(startLabel), startLabel);
    await place(dn.x + 0.5, dn.z + 0.5);
    await t.frames(4);
    const ld = await label();
    t.check("next to Dina: ✋ PLAY AS DINA", /PLAY AS DINA/.test(ld), ld);
    await t.tap(0);
    t.check("✋ → Dina's picker", await t.until(`__lulu3d.state === "dinaSelect"`, "dinaSelect", 6000));
    await t.frames(4);
    await t.L(`document.getElementById("dsLulu").click()`);
    t.check("pick Lulu → back on her feet at home (not the title)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.reason === "home"`, "dina home", 4000));
    await g(`(ctx.onegame.switches.dinaTile = false, true)`);

    // ── 🅿️ the parking booth at a rest area: it stands at the course (the challenge is PLAYED on the lot) ───
    await shared(`s.totalCoins = 1500;`);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "cruise", 4000);
    await g(`ctx.exits.debug.restAhead(260)`);
    t.check("a rest area gets a 🅿️ booth (at its Parking Challenge course)", await t.until(`__lulu3d.ctx.onegame.info().booths.length > 0`, "booth", 8000));
    const bo = (await g(`ctx.parking.debug.courses()`))[0];
    await g(`ctx.foot.start("droveOff", { noIntro: true })`);
    await t.until(`__lulu3d.state === "footRun"`, "on foot", 3000);
    await place(bo.bx, bo.bz, bo.s + 160);
    await t.frames(6);
    const lp = await label();
    t.check("at the booth: ✋ PARKING CHALLENGE (locked: the price)", /PARKING CHALLENGE.*1,000/.test(lp), lp);
    t.check("…the attendant is there", (await g(`ctx.onegame.info()`)).booths.some(b => b.attendant));
    await t.shot("booth");
    await t.tap(0);
    await t.until(`!!document.querySelector("#dialog .opt")`, "attendant asks", 3000);
    await t.frames(30);
    await t.L(`document.querySelector("#dialog .opt").click()`);          // 🔓 Unlock
    await t.frames(10);
    for (let i = 0; i < 12 && await t.L(`!!document.querySelector("#dialog:not(.hidden)")`); i++) { await t.tap(0); await t.frames(6); }
    t.check("unlock (−1,000 💰) → she's still on her feet at the lot, the course is marked (no teleport, no scene)",
      (await st()) === "footRun" && await t.L(`import("./js/core/save.js").then(m => !!m.shared.get().parkingUnlocked)`) && await g(`!!ctx.parking._debug.mark`), await st());
    // in her car: pulling into the START box starts it, and leaving puts her straight back to driving
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`__lulu3d.state === "playing"`, "driving", 3000);
    await g(`ctx.parking.debug.toBox()`);
    t.check("in the car: pulling into the START box starts the challenge (a driving state, in the world)", await t.until(`__lulu3d.state === "parking"`, "parking", 8000) && await g(`!ctx.view && ctx.states.parking.driving === true`));
    await t.until(`__lulu3d.ctx.parking._debug.phase === "drive"`, "level 1", 8000);
    await t.key("Escape");
    t.check("the pause menu offers 'Leave the Parking Challenge'", await t.L(`!!document.querySelector('[data-pi="parkLeave"]')`));
    await t.L(`document.querySelector('[data-pi="parkLeave"]').click()`);
    t.check("…→ driving again, right there on the lot", await t.until(`__lulu3d.state === "playing"`, "back driving", 3000));

    // ── 📱 Parking from the car: the card marks the course ───────────────────
    await g(`(ctx.parking.debug.place(-4, 13, -Math.PI / 2), ctx.parking._debug.mark = null, true)`);      // (out of the START box: there, pulling up IS the start)
    await t.frames(4);
    await g(`ctx.phone.openPhone("jobs")`);
    await t.frames(3);
    t.check("📱 💼 Jobs has the 🅿️ Parking Challenge card", await t.L(`!!document.getElementById("lpPark")`));
    await t.L(`document.getElementById("lpPark").click()`);
    await t.frames(4);
    t.check("📱 'Show me the course' → the course is marked, she's still driving", await g(`ctx.state === "playing" && !!ctx.parking._debug.mark`));

    // ── the 👧 Dina tile (with ONEGAME.dinaTile ON) → back to the title ───────
    await g(`(ctx.onegame.switches.dinaTile = true, L3.setState("title"), true)`);
    await t.frames(4);
    await t.click(/Dina/);
    await t.until(`__lulu3d.state === "dinaSelect"`, "dina tile", 6000);
    await t.frames(4);
    await t.L(`document.getElementById("dsLulu").click()`);
    t.check("the Dina tile → pick Lulu → the title (as before)", await t.until(`__lulu3d.state === "title"`, "title", 3000));
    await g(`(ctx.onegame.switches.dinaTile = false, L3.setState("title"), true)`);

    // ── the layouts: phone portrait + landscape, TV 720p / 1080p ─────────────
    const layouts = [["phone-portrait", 390, 844, false], ["phone-landscape", 844, 390, false], ["tv-1080", 1920, 1080, true], ["tv-720", 1280, 720, true]];
    for (const [name, w, h, tv] of layouts) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
      await g(`(ctx.applySettings(), L3.setState("title"), true)`);
      await t.frames(4);
      const f = await fits();
      t.check(`the new home fits ${name} (${w}×${h})`, f.ok, JSON.stringify(f));
      const hero = await t.L(`(() => { const r = document.getElementById("play").getBoundingClientRect(), d = (document.querySelector("#screenCard .home-tiles .tile") || document.querySelector("#screenCard .home-groups .tile")).getBoundingClientRect(); return { h: r.height, w: r.width, dh: d.height }; })()`);
      t.check(`${name}: PLAY is the biggest button`, hero.h >= hero.dh && hero.h >= 44, JSON.stringify(hero));
      await t.shot(`home-${name}`);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);

    // ── a Friday afternoon: Ima asks at the door ─────────────────────────────
    await g(`(ctx.shabbos.debug.date("2026-11-20T15:00"), ctx.applySettings(), L3.setState("title"), true)`);
    await t.frames(4);
    t.check("Friday: PLAY's subtitle says Erev Shabbos", await t.L(`/Erev Shabbos/.test(document.getElementById("play").textContent)`));
    t.check("…and there's still no chip / extra tile", await t.L(`!document.getElementById("shabbosChip") && document.querySelectorAll("#screenCard .home-tiles .tile").length === 0`));
    await t.click(/PLAY/);
    await t.until(`__lulu3d.state === "footRun"`, "friday home", 4000);
    await t.frames(30);
    const fl = await g(`ctx.places.home.depart().line`);
    t.check("Ima's line at the door is the Shabbos rush", /candle|sun|Shabbos/i.test(fl), fl);
    t.check("…not Ima's list today", !(await g(`ctx.day ? ctx.day.active : false`)));
    // walking away from the ask (instead of the car): Ima answers with a "not this week" exchange, once
    const pcar = await g(`(() => { const c = ctx.foot.parkedCar; return { x: c.x, z: c.z }; })()`);
    await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${pcar.x} + 15, 0, ${pcar.z} + 4); F.vel.set(0, 0, 0); return true; })()`);
    await t.frames(80);
    const nl = await g(`ctx.places.home.depart().line`);
    t.check("walking off from Friday's ask: Ima answers (not this week)", /CHOLENT|Friday|EREV|Shabbos|sweater/i.test(nl) && !/candle-lighting is SOON|won't wait and neither/.test(nl), nl);
    await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${pcar.x}, 0, ${pcar.z} + 2.2); F.vel.set(0, 0, 0); return true; })()`);
    await t.frames(6);
    await g(`ctx.foot.debug.getIn()`);
    t.check("getting in the car starts the 🕯️ rush", await t.until(`__lulu3d.ctx.shabbos.active && __lulu3d.ctx.G.mode === "shabbos"`, "rush", 3000));
    t.check("…from home (via 'home')", (await g(`ctx.shabbos.debug.info().via`)) === "home");
    await g(`(L3.setState("playing"), ctx.shabbos.debug.setLeft(0.1), true)`);     // (out of the driveway: the clock runs while she drives)
    t.check("late → the card", await t.until(`__lulu3d.state === "shabbosResult"`, "result", 6000));
    t.check("the card has 🏠 Head home (not the title)", await t.L(`/Head home/.test(document.getElementById("shbTitle").textContent)`));
    await t.L(`document.getElementById("shbTitle").click()`);
    t.check("…→ on her feet at home", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.reason === "home"`, "rush home", 4000));
    await g(`ctx.shabbos.debug.date(null)`);
  },
};
