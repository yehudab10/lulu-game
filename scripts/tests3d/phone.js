// 📱 Lulu's phone (features/phone): open / close on every device, the app grid + focus,
// the Messages inbox (texts land there, unread badges, threads), Radio, Jobs, Map, Camera,
// calls still working, party mode, the touch layout (fewer buttons), layouts, frame cost.
module.exports = {
  name: "phone",
  query: "&enable=phone&story=1",     // (story=1: the 🗺️ story map app — hidden for now, onegame/switches.js)
  viewport: { width: 1280, height: 720 },
  async run(t) {
    const g = t.game;
    const isOpen = () => g(`ctx.phone.isOpen`);
    const focusApp = () => t.L(`(() => { const f = document.querySelector("#screenCard .lp-app.focus"); return f ? f.dataset.app : null; })()`);
    const rect = sel => t.L(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; })()`);
    const clickSel = async sel => { const ok = await t.L(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b) b.click(); return !!b; })()`); await t.frames(2); return ok; };
    const drive = async () => {
      await g(`L3.startRun({ mode: "cruise" })`);
      await t.until(`__lulu3d.state === "playing"`, "drives");
      await g(`(ctx.hustle && ctx.hustle.hold(1e6), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.G.invT = 1e6, true)`);
      await t.frames(4);
    };

    t.check("ctx.phone keeps journey's call / text and gains the app API",
      await g(`["call", "text", "busy", "hangUp", "addApp", "openPhone", "closePhone"].every(k => typeof ctx.phone[k] === "function") && ctx.phone.isOpen === false`));
    t.check("the button guide has a 📱 phone row", await t.L(`import("./js/core/screens.js").then(m => /Lulu's phone/.test(m.controlsHtml()) && /TOUCHPAD|L3/.test(m.controlsHtml()))`));
    await drive();

    // ── keyboard: Tab opens / closes; the game pauses underneath ──────────
    const s0 = await g(`ctx.car.s`);
    await t.key("Tab");
    t.check("keyboard Tab opens the phone", await isOpen());
    t.check("…the game is paused (same state, no state change)", await g(`ctx.paused && ctx.state === "playing"`));
    const ms = await g(`ctx.phone._dbg.PH.openMs`);
    await t.frames(6);   // the slide-up animation
    t.check("…it opens fast (< 200 ms to build)", ms < 200, ms.toFixed(1) + " ms");
    const r = await rect("#screenCard.lphone");
    t.check("desktop: a portrait handset in the bottom-right", !!r && r.r > r.w * 0.8 && r.b > r.h * 0.9 && r.b <= r.h + 1 && r.y >= 0 && (r.b - r.y) > (r.r - r.x) * 1.5, JSON.stringify(r));
    const apps = await g(`ctx.phone.apps()`);
    // (other features add theirs: 👯 Friends, 📍 Nearby, 📞 Phone… — the full game keeps it to 9 (calls / onegame / day check that;
    //  🗞️ Kvetch is a pinned row in 💬 Messages, ctx.phone.addPin); the grid still goes 4 across past 9 so a 10th never falls off)
    t.check("built-in apps: Map, Messages, Radio, Jobs, Camera (≤ 12, one screen)", (apps.includes("map") || apps.includes("lapmap")) && ["messages", "radio", "jobs", "camera"].every(a => apps.includes(a)) && apps.length <= 12, apps.join(","));
    t.check("the grid shows them as big icons", await t.L(`document.querySelectorAll("#screenCard .lp-app").length`) === apps.length);
    const sA = await g(`ctx.car.s`);
    await t.frames(10);
    t.check("…the car doesn't move while it's open", Math.abs(await g(`ctx.car.s`) - sA) < 1e-6 && await g(`ctx.paused`));
    // no heavy re-renders: nothing in the card changes while it just sits there
    await t.L(`(() => { window.__lpMut = 0; window.__lpMO = new MutationObserver(m => { window.__lpMut += m.length; }); window.__lpMO.observe(document.getElementById("screenCard"), { subtree: true, childList: true, attributes: true, characterData: true }); })()`);
    await t.frames(30);
    const muts = await t.L(`(window.__lpMO.disconnect(), window.__lpMut)`);
    t.check("…and nothing re-renders while it's idle (0 DOM mutations in 30 frames)", muts === 0, String(muts));
    await t.shot("desktop-home");
    await t.key("Tab");
    t.check("Tab again closes it", !(await isOpen()) && !(await g(`ctx.paused`)));
    await t.frames(6);
    t.check("…and the drive goes on", (await g(`ctx.car.s`)) >= s0);
    await t.key("Tab"); await t.key("Escape");
    t.check("keyboard Esc on the phone = back (closes it, no pause menu)", !(await isOpen()) && !(await g(`ctx.paused`)));

    // ── controller: L3 (Xbox: no touchpad) + touchpad, D-pad focus, ✕ / ○ ─────
    await t.tap(17);
    t.check("controller touchpad opens the phone", await isOpen());
    const fa = await focusApp();
    t.check("…focus starts on the first app (👯 Friends — multiplayer first, ci/hud)", fa === apps[0], fa + " / " + apps[0]);
    // the grid runs in app order (👯 Friends, 🗺️ Map, 💼 Jobs, 💬 Messages… — ci/hud landing 3)
    await t.tap(15);
    t.check("D-pad → moves to the second app", await focusApp() === apps[1], await focusApp());
    await t.tap(15);
    t.check(`D-pad → moves to the third app (${apps[2]})`, await focusApp() === apps[2], await focusApp());
    await t.tap(13);
    const down = await focusApp();
    t.check("D-pad ↓ moves to the next row", !!down && !apps.slice(0, 3).includes(down), down);
    // D-pad over to 📻 Radio wherever it sits on the grid (row first, then column)
    const ri = apps.indexOf("radio"), cols = await t.L(`getComputedStyle(document.querySelector("#screenCard .lp-grid")).gridTemplateColumns.split(" ").length`);
    for (let i = 0; i < 6; i++) {
      const c = apps.indexOf(await focusApp());
      if (c === ri || c < 0) break;
      const dr = Math.floor(ri / cols) - Math.floor(c / cols);
      await t.tap(dr < 0 ? 12 : dr > 0 ? 13 : ri % cols < c % cols ? 14 : 15);
    }
    t.check("D-pad gets to 📻 Radio", await focusApp() === "radio", await focusApp());
    await t.tap(0);
    t.check("✕ opens the focused app (📻 Radio)", await t.L(`!!document.querySelector("#screenCard .lp-appv .lp-st")`));
    await t.tap(1);
    t.check("○ goes back to the home grid, focus on Radio", await t.L(`!!document.querySelector("#screenCard .lp-grid")`) && await focusApp() === "radio");
    await t.tap(1);
    t.check("○ on the home grid closes the phone", !(await isOpen()) && !(await g(`ctx.paused`)));
    await t.tap(10);
    t.check("Xbox L3 opens it too (no touchpad on that pad)", await isOpen());
    await t.tap(17);
    t.check("…and the touchpad closes it", !(await isOpen()));
    // Start / OPTIONS while it's open → the full pause menu, which has a 📱 Phone item
    await t.tap(17);
    await t.tap(9);
    t.check("OPTIONS on the phone → the pause menu", !(await isOpen()) && await g(`ctx.paused`) && await t.L(`!!document.querySelector(".pause-menu")`));
    t.check("pause: 📱 Phone in the tools grid (the 📻 radio item is gone)", await t.L(`!!document.querySelector(".pm-tools #phone") && !document.querySelector("#hustleRadio")`));
    t.check("pause still fits 720p", await t.L(`(() => { const c = document.getElementById("screenCard"); return c.scrollHeight <= c.clientHeight + 2; })()`));
    await t.shot("pause");
    await clickSel(".pm-tools #phone");
    t.check("…it opens the phone over the pause menu", await isOpen());
    await t.tap(1);
    t.check("○ goes back to the pause menu", !(await isOpen()) && await g(`ctx.paused`) && await t.L(`!!document.querySelector(".pause-menu")`));
    await t.click(/Resume/);
    t.check("resume → driving", !(await g(`ctx.paused`)));

    // ── 💬 Messages: texts land in the inbox, unread badges, threads ────────
    await g(`ctx.phone.inbox.clear()`);
    // (ci/hud landing 3: only texts that need her are kept — filler is a passing bubble that never counts)
    await g(`ctx.phone.text({ from: "Bubbe", msg: "Just checking in, mamele" })`);
    await t.frames(3);
    t.check("a filler text doesn't happen: no card on the HUD, not kept, the 📱 badge stays 0", await t.L(`!/Just checking/.test((document.querySelector("#slot-left .jtext") || {}).textContent || "")`)
      && await g(`ctx.phone.inbox.unread() === 0 && ctx.phone.inbox.threads().length === 0`) && await t.L(`!document.querySelector("#phoneBtn .lp-dot.on")`));
    await t.L(`document.querySelectorAll("#slot-left .jtext").forEach(e => e.remove())`);
    await g(`ctx.phone.text({ from: "Ima", emoji: "👩", msg: "Did you eat? Text me back.", need: true })`);
    await t.frames(3);
    t.check("a text still pops the driving bubble", await t.L(`/Did you eat/.test((document.querySelector("#slot-left .jtext") || {}).textContent || "")`));
    t.check("…and lands in the inbox, unread", await g(`ctx.phone.inbox.unread()`) === 1);
    t.check("…the 📱 corner button shows a 1", await t.L(`(() => { const d = document.querySelector("#phoneBtn .lp-dot"); return !!d && d.classList.contains("on") && d.textContent === "1"; })()`));
    await g(`ctx.phone.text({ from: "IMA", msg: "And wear a sweater.", need: true })`);
    await g(`ctx.phone.text({ from: "Heshy", thread: "mishpacha", msg: "lol", need: true })`);
    t.check("texts group into threads by from (any case) or thread", await g(`ctx.phone.inbox.threads().length`) === 2 && await g(`ctx.phone.inbox.unread("ima")`) === 2, JSON.stringify(await g(`ctx.phone.inbox.threads().map(t => t.k + ":" + t.unread)`)));
    await t.frames(2);
    await t.key("Tab");
    t.check("the 💬 app icon shows 3 unread", await t.L(`(document.querySelector("#lpa_messages .lp-badge") || {}).textContent`) === "3");
    t.check("…and the home screen shows them as notification cards", await t.L(`document.querySelectorAll(".lp-notif").length`) === 2);
    t.check("…while focus stays on the app grid (the last app used)", !!(await focusApp()), await focusApp());
    await t.shot("badge");
    await clickSel("#lpa_messages");
    t.check("Messages lists 2 threads, newest first (Mishpacha)", await t.L(`[...document.querySelectorAll(".lp-thr")].map(b => b.dataset.k).join()`) === "mishpacha,ima");
    await clickSel('.lp-thr[data-k="ima"]');
    t.check("opening a thread shows its messages", await t.L(`document.querySelectorAll(".lp-bub").length`) === 2);
    t.check("…and marks them read", await g(`ctx.phone.inbox.unread()`) === 1);
    await t.shot("thread");
    await t.tap(1);
    t.check("○ in a thread → back to the list", await t.L(`document.querySelectorAll(".lp-thr").length`) === 2);
    await t.tap(1); await t.tap(1);
    t.check("○ ○ closes the phone", !(await isOpen()));
    // tapping the bubble opens that thread
    await g(`ctx.phone.text({ from: "Bubbe", msg: "Call your Bubbe.", need: true })`);
    await t.frames(2);
    await t.L(`[...document.querySelectorAll("#slot-left .jtext")].pop().click()`);
    await t.frames(2);
    t.check("tapping a text bubble opens its thread", await isOpen() && await t.L(`/Call your Bubbe/.test(document.querySelector(".lp-chat").textContent)`));
    await clickSel("#lpBackBtn"); await clickSel("#lpBackBtn"); await clickSel("#lpBackBtn");
    t.check("the ‹ Back button walks back out and closes", !(await isOpen()));
    t.check("the inbox is in the 3D save (kept to the last 50)", await t.L(`import("./js/core/save.js").then(m => m.save3d.f.phone.msgs.length)`) === 4);
    await g(`(() => { for (let i = 0; i < 60; i++) ctx.phone.inbox.post({ from: "Spam" + (i % 3), msg: "#" + i, read: true, need: true }); return true; })()`);
    t.check("…capped at 50", await g(`ctx.phone.inbox.msgs.length`) === 50);
    await g(`ctx.phone.inbox.clear()`);

    // ── 📻 Radio ──────────────────────────────────────────────────────────
    await g(`ctx.hustle.radio.tune("auto")`);
    await t.key("Tab");
    await clickSel("#lpa_radio");
    t.check("Radio lists the stations, LULU FM on", await t.L(`document.querySelectorAll(".lp-st").length`) >= 5 && await t.L(`document.querySelector(".lp-st.on").dataset.st`) === "auto");
    await clickSel('.lp-st[data-st="simcha"]');
    t.check("tapping SIMCHA 101.3 tunes it", await g(`ctx.hustle.radio.station`) === "simcha");
    t.check("…now playing updates in place", await t.L(`/SIMCHA/.test(document.querySelector(".lp-now").textContent) && document.querySelector(".lp-st.on").dataset.st === "simcha"`));
    await t.shot("radio");
    await t.key("Tab");
    t.check("keyboard T still changes station (no phone needed)", (await t.key("KeyT"), await g(`ctx.hustle.radio.station`)) === "lounge");
    await g(`ctx.hustle.radio.tune("auto")`);

    // ── 🗺️ Map: on the one world's lap (a Cruise — ci/onemap) the ONE map: the 16 km loop with every place, real miles ──
    // (while the Story Trip is hidden — this test switches it on for the story map below)
    await t.L(`import("./js/features/onegame/switches.js").then(m => { m.ONEGAME.story = false; return true; })`);
    t.check("Map (one world): the lap map is the 🗺️ while the Story is hidden", (await g(`ctx.phone.apps()`)).includes("lapmap") && !(await g(`ctx.phone.apps()`)).includes("map"));
    await t.key("Tab");
    await clickSel("#lpa_lapmap");
    await t.frames(4);
    t.check("…the lap as a ring + the places with how far up the road", await t.L(`!!document.querySelector("#screenCard canvas.lp-lapmap") && document.querySelectorAll("#screenCard .lp-row").length >= 2 && /\\d+\\.\\d mi|NOW/.test(document.getElementById("screenCard").textContent)`), await t.L(`document.getElementById("screenCard").textContent.slice(0, 200)`));
    await t.shot("lapmap");
    await t.key("Tab");
    await t.frames(4);
    await t.L(`import("./js/features/onegame/switches.js").then(m => { m.ONEGAME.story = true; return true; })`);
    // ── 🗺️ Map: the old story map, over the live run (the Story Trip's road — not on the lap) ──────
    if (await g(`ctx.phone.apps().includes("map")`)) {
    await t.key("Tab");
    const before = await g(`({ s: ctx.car.s, rt: ctx.G.runTime, mode: ctx.G.mode })`);
    await clickSel("#lpa_map");
    t.check("Map opens the story map (journey's)", await t.until(`__lulu3d.state === "storyMap"`, "the story map opens") && await t.L(`!!document.querySelector(".jmap")`));
    t.check("…the phone hands off (closed, not paused)", !(await isOpen()) && !(await g(`ctx.paused`)));
    await g(`(ctx.G.__phoneMark = 1, true)`);
    await t.frames(10);
    t.check("…the run is frozen underneath (no time passes)", JSON.stringify(await g(`({ s: ctx.car.s, rt: ctx.G.runTime, mode: ctx.G.mode })`)) === JSON.stringify(before));
    await t.shot("map");
    await t.tap(1);
    const after = await g(`({ s: ctx.car.s, rt: ctx.G.runTime, mode: ctx.G.mode, mark: ctx.G.__phoneMark })`);
    t.check("○ comes straight back to the same drive", await g(`ctx.state === "playing" && !ctx.view`) && after.mark === 1 && after.mode === before.mode && after.rt - before.rt < 0.5, JSON.stringify([before, after]));
    t.check("…with the HUD back", await t.L(`!document.getElementById("hud").classList.contains("hidden")`));
    }

    // ── 📸 Camera: photo mode ─────────────────────────────────────────────
    await t.key("Tab");
    await clickSel("#lpa_camera");
    t.check("Camera opens photo mode", await g(`ctx.state === "playPhoto"`));
    await g(`(ctx.play.photo.close(), true)`);
    await t.frames(2);
    t.check("…and closes back to the drive", await g(`ctx.state === "playing" && !ctx.paused`));

    // ── 🎨 Paint & Pray ───────────────────────────────────────────────────
    await t.key("Tab");
    t.check("🎨 Paint & Pray isn't on the home screen (a row in 💼 Jobs while she's wanted)", !(await g(`ctx.phone.apps()`)).includes("paint"));
    await g(`ctx.phone._dbg.openApp("paint")`);
    await t.frames(2);
    const booth = await g(`ctx.streets.paint.nearest()`);
    t.check("Paint & Pray shows the nearest booth", await t.L(`/booth/.test(document.querySelector(".lp-dist").textContent)`) &&
      (booth ? await t.L(`/\\d mi/.test(document.querySelector(".lp-dist").textContent)`) : await t.L(`/keep driving/.test(document.querySelector(".lp-dist").textContent)`)), JSON.stringify(booth));
    await t.shot("paint");
    await t.key("Tab");

    // ── 💼 Jobs: take one from the phone ──────────────────────────────────
    await t.key("Tab");
    await clickSel("#lpa_jobs");
    t.check("Jobs lists the side jobs", await t.L(`document.querySelectorAll(".lp-job").length`) >= 2 && await t.L(`!document.querySelector(".lp-job[disabled]")`));
    await t.shot("jobs");
    await clickSel('.lp-job[data-job="delivery"]');
    await t.frames(2);
    t.check("taking 🔥 Hot Delivery starts the job (phone closed)", !(await isOpen()) && await g(`!!ctx.hustle.job && ctx.hustle.job.id === "delivery"`));
    await t.key("Tab");
    await clickSel("#lpa_jobs");
    t.check("…the app now shows the job on the clock + a quit button", await t.L(`!!document.querySelector(".lp-on") && !!document.querySelector("#lpQuitJob")`));
    await t.key("Tab");
    await g(`(ctx.hustle._dbg.J.job.dispose && ctx.hustle._dbg.J.job.dispose(), ctx.hustle._dbg.J.job = null, true)`);
    // not in Story mode
    await g(`L3.startRun({ mode: "story" })`);
    await t.until(`__lulu3d.state === "playing"`, "story drive");
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.G.invT = 1e6, true)`);
    await t.key("Tab");
    await clickSel("#lpa_jobs");
    // (QA 2026-11-27: none takeable → the reason FIRST + one line of what's waiting, no greyed-out rows)
    t.check("in Story the jobs are off (hustle's rules), with a reason first + one line, no dead rows", await t.L(`document.querySelectorAll(".lp-job").length === 0 && !!document.querySelector(".lp-jobswait") && /Cruise|driving around/.test(document.querySelector("#lpApp .lp-note").textContent)`));
    await t.key("Tab");

    // ── calls still work while driving ────────────────────────────────────
    await drive();
    await g(`ctx.journey.debug.imaCall()`);
    await t.frames(3);
    t.check("Ima's call rings on the in-car card", await g(`!!ctx.phone.active && ctx.phone.active.phase === "ring"`) && await t.L(`!!document.querySelector(".jphone")`));
    await t.key("Tab");
    t.check("the phone opens over a ringing call (game paused)", await isOpen());
    await t.key("Tab");
    await t.tap(4);
    t.check("honk still declines it", await g(`!ctx.phone.active || ctx.phone.active.result === "declined"`));
    await t.frames(4);
    t.check("a call still flips steering while talking", await g(`(() => { ctx.phone.hangUp(true); const c = ctx.journey.debug.imaCall(); if (!c) return false; c.t = 999; return true; })()`));
    await t.frames(4);
    t.check("…it picked up", await g(`ctx.phone.talking && ctx.phone.flipped`));
    await g(`(ctx.phone.hangUp(true), true)`);

    // ── 🎉 party: the phone opens, the random-feature apps hide ───────────
    await g(`(window.__pAct = Object.getOwnPropertyDescriptor(ctx.party, "active"), Object.defineProperty(ctx.party, "active", { get: () => true, configurable: true }), true)`);
    await t.key("Tab");
    const papps = await g(`ctx.phone.apps()`);
    t.check("party: the phone still opens", await isOpen());
    t.check("…without Map / Jobs / Paint & Pray", !papps.includes("map") && !papps.includes("jobs") && !papps.includes("paint") && papps.includes("messages"), papps.join(","));
    await t.key("Tab");
    await g(`(Object.defineProperty(ctx.party, "active", window.__pAct), true)`);
    t.check("(party restored)", await g(`!ctx.party.active`));

    // ── addApp contract (render + api) ────────────────────────────────────
    await g(`(ctx.phone.addApp({ id: "testapp", icon: "🧪", name: "Test", order: 70, badge: () => "!", visible: () => !window.__noTestApp, render(el, api) {
      el.innerHTML = '<div class="btn lp-row" id="lkA">A</div><button class="btn lp-row" id="lkB">B</button>';
      el.querySelector("#lkB").addEventListener("click", () => { window.__lkB = (window.__lkB || 0) + 1; api.toast("hi"); api.refresh(); });
    } }), true)`);
    await t.key("Tab");
    t.check("addApp: a feature's app shows on the grid with its badge", await t.L(`(document.querySelector("#lpa_testapp .lp-badge") || {}).textContent`) === "!");
    await g(`ctx.phone.openPhone("testapp")`);
    t.check("openPhone(id) opens it; .btn divs are focusable", await t.L(`document.querySelector("#lkA").classList.contains("focus")`));
    // (the phone's toast is a 1.8 s REAL-time timer — on a slow machine it's gone before a 4-frame tap returns: watch for it
    //  going on instead of reading it afterwards)
    await t.L(`(() => { window.__toastOn = false; const el = document.getElementById("lpToast"); new MutationObserver(() => { if (el.classList.contains("on")) window.__toastOn = true; }).observe(el, { attributes: true, attributeFilter: ["class"] }); return true; })()`);
    await t.tap(13); await t.tap(0);
    t.check("…D-pad + ✕ reach its buttons; api.toast/refresh work", await t.L(`window.__lkB`) === 1 && await t.L(`window.__toastOn === true`));
    await t.key("Tab");
    await t.L(`window.__noTestApp = true`);

    // ── addPin contract: a row in 💬 Messages instead of a 10th app ───────
    await g(`(ctx.phone.addPin({ id: "testpin", order: 99, visible: () => !window.__noTestPin, row: () => ({ icon: "🧪", title: "Test pin", sub: "a pinned row", badge: 2 }),
      render(el) { el.innerHTML = '<div class="lp-note" id="tpView">pinned view</div>'; } }), true)`);
    t.check("addPin: no new app on the grid", !(await g(`ctx.phone.apps()`)).includes("testpin") && (await g(`ctx.phone.pins()`)).includes("testpin"));
    await g(`ctx.phone.openPhone("messages")`);
    await t.frames(2);
    t.check("…its row shows in 💬 Messages (with its badge)", await t.L(`(() => { const b = document.querySelector('[data-pin="testpin"]'); return !!b && /Test pin/.test(b.textContent) && /2/.test((b.querySelector(".lp-badge") || {}).textContent || ""); })()`));
    await clickSel('[data-pin="testpin"]');
    t.check("…tap it: its view, with ‹ All messages", await t.L(`!!document.querySelector("#tpView") && !!document.querySelector("#lpPinBack")`));
    await t.tap(1);
    t.check("…○ goes back to the list", await t.L(`!document.querySelector("#tpView") && !!document.querySelector('[data-pin="testpin"]')`));
    await t.key("Tab");
    await t.L(`window.__noTestPin = true`);

    // ── Mishpacha: the family group chat reacts to the run ────────────────
    await g(`(ctx.G.startS = ctx.car.s - 4000, ctx.G.tickets = 2, ctx.G.coins = 220, L3.endRun("quit"), true)`);
    await t.frames(2);
    const fam = await g(`ctx.phone.inbox.threads().filter(t => t.k === "mishpacha").length`);
    t.check("run end: the family's small talk doesn't fill the phone (ci/hud — filler is never kept)", fam === 0 && await g(`ctx.phone.inbox.unread() === 0`));

    // ── performance: the closed phone costs nothing per frame ─────────────
    await drive();
    const cost = await t.L(`(async () => {
      const L3 = window.__lulu3d, ctx = L3.ctx;
      const ft = async n => { const t0 = performance.now(), f0 = L3.frames; await new Promise(r => { const k = () => L3.frames >= f0 + n ? r() : requestAnimationFrame(k); k(); }); return (performance.now() - t0) / n; };
      const closed = await ft(45);
      ctx.phone.openPhone();
      const open = await ft(45);
      ctx.phone.closePhone();
      return { closed, open };
    })()`);
    t.check("frame time: phone open ≤ closed + 25% (paused: no sim)", cost.open <= cost.closed * 1.25, `closed ${cost.closed.toFixed(1)} ms · open ${cost.open.toFixed(1)} ms per frame (software WebGL)`);

    // ── layouts + touch: fewer buttons, 📱 in the ❚❚ spot ─────────────────
    const visBtns = () => t.L(`[...document.querySelectorAll("#hud button, #touch button")].filter(b => b.offsetParent !== null && b.getBoundingClientRect().width > 2 && getComputedStyle(b).display !== "none" && getComputedStyle(b).visibility !== "hidden").map(b => b.id || b.textContent.trim())`);
    const overlaps = () => t.L(`(() => {
      const sel = "#phoneBtn, .hud-tl .pill, .hud-top, .hud-br .speedo, #stickBase, .pedals .tbtn, #touchExtra button";
      const bs = [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).display !== "none"; });
      const out = [];
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i].getBoundingClientRect(), b = bs[j].getBoundingClientRect();
        if (bs[i].contains(bs[j]) || bs[j].contains(bs[i])) continue;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2 && (bs[i].id === "phoneBtn" || bs[j].id === "phoneBtn" || bs[i].closest("#touchExtra") || bs[j].closest("#touchExtra"))) out.push((bs[i].id || bs[i].className) + " × " + (bs[j].id || bs[j].className));
      }
      return out;
    })()`);
    const layouts = [["desktop", 1280, 720, false, false], ["tv-1080", 1920, 1080, true, false], ["phone-landscape", 844, 390, false, true], ["phone-portrait", 390, 844, false, true], ["phone-se", 375, 667, false, true], ["tv-720", 1280, 720, true, false]];
    for (const [name, w, h, tv, touch] of layouts) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
      if (touch) await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
      else await t.tap(11);
      await g(`(ctx.applySettings(), true)`);
      await t.frames(6);
      t.check(`${name}: 📱 in the corner, ❚❚ tucked into the phone`, await t.L(`document.getElementById("phoneBtn").offsetParent !== null && getComputedStyle(document.getElementById("pauseBtn")).display === "none"`));
      const ov = await overlaps();
      t.check(`${name}: the 📱 / extra buttons overlap nothing`, ov.length === 0, ov.join(" | "));
      if (touch) {
        const btns = await visBtns();
        t.check(`${name}: touch driving buttons: ${btns.length} (was 7: ❚❚ NITRO HONK CAM BRAKE GAS 📻)`, btns.length <= 6 && !btns.includes("tx_radio") && !btns.includes("pauseBtn") && btns.includes("phoneBtn"), btns.join(","));
        await t.shot(`${name}-driving`);
        await clickSel("#phoneBtn");
        t.check(`${name}: tapping 📱 opens the phone`, await isOpen());
      } else {
        await t.shot(`${name}-driving`);
        await t.key("Tab");
        t.check(`${name}: opens`, await isOpen());
      }
      await t.frames(6);
      const pr = await rect("#screenCard.lphone");
      const okPos = h > w ? Math.abs((pr.x + pr.r) / 2 - w / 2) < 4 && pr.b > h * 0.9 : pr.r > w * 0.8 && pr.b > h * 0.9;
      t.check(`${name}: handset fully on screen, ${h > w ? "bottom-centre" : "bottom-right"}`, !!pr && pr.x >= 0 && pr.y >= 0 && pr.r <= w + 1 && pr.b <= h + 1 && okPos, JSON.stringify(pr));
      t.check(`${name}: every app icon visible inside the screen (not under the Back / Menu bar)`, await t.L(`(() => { const s = document.querySelector(".lp-scr").getBoundingClientRect(), f = document.querySelector(".lp-foot"), fb = f ? f.getBoundingClientRect().top : s.bottom; return [...document.querySelectorAll(".lp-app")].every(a => { const r = a.getBoundingClientRect(); return r.top >= s.top - 1 && r.bottom <= Math.min(s.bottom, fb) + 1 && r.left >= s.left - 1 && r.right <= s.right + 1; }); })()`));
      await t.shot(`${name}-phone`);
      if (touch) {
        await t.L(`document.getElementById("screen").click()`);
        await t.frames(2);
        t.check(`${name}: a tap outside the handset closes it`, !(await isOpen()));
      } else { await t.key("Tab"); }
      await clickSel("#phoneBtn");
      await clickSel("#lpa_messages");
      await t.shot(`${name}-messages`);
      await clickSel("#lpMenuBtn");
      t.check(`${name}: ☰ Menu → the pause menu`, !(await isOpen()) && await t.L(`!!document.querySelector(".pause-menu")`));
      await t.click(/Resume/);
    }
    // touch + a stolen ride: ✋ BAIL shows and doesn't crowd anything
    await t.page.setViewportSize({ width: 844, height: 390 });
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await g(`(ctx.applySettings(), ctx.law && (ctx.law.addWarrant ? true : true), true)`);
    if (await g(`!!(ctx.law && ctx.law.startChase)`)) {
      await g(`(ctx.streets.force.bail = true, ctx.law.startChase("test", { heat: 2 }), true)`);
      await t.L(`document.getElementById("tGas").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);   // touch GAS (a pad press would switch the device)
      await t.until(`__lulu3d.ctx.car.speed > 6`, "rolling", 20000);
      const btns = await visBtns();
      const ov = await overlaps();
      t.check("phone landscape, wanted: ✋ BAIL shows, nothing overlaps", btns.includes("tx_streets_bail") && ov.length === 0, btns.join(",") + " / " + ov.join(" | "));
      await t.shot("phone-landscape-bail");
      await t.L(`document.getElementById("tGas").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))`);
      await g(`(ctx.streets.force.bail = false, ctx.law.clearHeat && ctx.law.clearHeat(""), true)`);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
    await g(`(ctx.applySettings(), true)`);
  },
};
