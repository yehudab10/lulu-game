// UI / UX: the decluttered home screen (fits 720p, phone landscape + portrait and
// TV without scrolling; few big tiles; the rest grouped), the groups with the
// controller (D-pad, ✕, ○, L1/R1) and their focus memory, every title item still
// reachable, the compact pause menu, the notification manager (merged toast
// bursts, a cap, the banner priority queue, nothing new while a dialogue is open)
// and the new settings (HUD: Full / Clean, Lulu's chatter).
const today = Math.floor(Date.now() / 86400000);
// every title item a seasoned player sees (Shared Road needs the online backend, not in tests)
const ITEMS = ["story", "storyMap", "cruise", "shop", "distracted", "dina", "parking", "metaScrapbook", "metaQuests", "playPhoto", "skin", "controls", "settings", "back2d"];

module.exports = {
  name: "ux",
  query: "&enable=banter",
  viewport: { width: 1280, height: 720 },
  save2d: {
    totalCoins: 12345, highScore: 52000, lifetimeScore: 250000, streak: 3, dayNum: today,
    storyStop: 2, storyCycle: 1, postcards: ["bubbe", "heshy"], storyStars: { bubbe: true }, tripBest: 3,
    parkingBestLevel: 3, parkingUnlocked: true, cruiseUnlocked: true, cruisePlayed: true,
    ownedSkins: ["pink", "purple"], distractedUnlocked: true, missiles: 3, shields: 2, wanted: ["Speeding", "Honking"],
  },
  async run(t) {
    const g = t.game;
    const focusId = () => t.L(`(document.querySelector("#screenCard .focus") || {}).id || ""`);
    const view = () => g(`L3.titleView`);
    const fits = () => t.L(`(() => { const c = document.getElementById("screenCard"), r = c.getBoundingClientRect();
      return { ok: c.scrollHeight <= c.clientHeight + 2 && r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1,
               sh: c.scrollHeight, ch: c.clientHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right), w: innerWidth, h: innerHeight }; })()`);
    const smallTaps = () => t.L(`[...document.querySelectorAll("#screenCard button")].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40).map(b => b.id || b.textContent.trim().slice(0, 20))`);
    const H = code => t.game(`(() => { const H = L3.H; return (${code}); })()`);
    /** Walk the D-pad cursor to an element (as a player would). */
    const navTo = async id => {
      for (let i = 0; i < 16; i++) {
        const d = await t.L(`(() => { const f = document.querySelector("#screenCard .focus"), g = document.getElementById(${JSON.stringify(id)});
          if (!f || !g) return "?"; if (f === g) return "";
          const a = f.getBoundingClientRect(), b = g.getBoundingClientRect();
          if (b.top >= a.bottom - 2) return "down"; if (b.bottom <= a.top + 2) return "up"; return b.left > a.left ? "right" : "left"; })()`);
        if (!d || d === "?") return d === "";
        await t.tap({ up: 12, down: 13, left: 14, right: 15 }[d]);
      }
      return (await focusId()) === id;
    };
    await t.frames(10);

    // ── the home screen ─────────────────────────────────────────────────────
    t.check("home: the Story Trip is the hero tile and has the focus", await t.L(`!!document.querySelector("#screenCard .tile.hero#story")`) && await focusId() === "story");
    t.check("home: coins in the top bar", await t.L(`/12,345/.test(document.querySelector(".home-bar").textContent)`));
    t.check("home: the streak is a top-bar chip", await t.L(`/🔥 3/.test(document.querySelector(".home-bar").textContent)`));
    t.check("home: next stop + leg live in the hero's subtitle", await t.L(`/Next stop:.*THE BEACH.*leg 3\\/5/.test(document.querySelector("#story").textContent) && document.querySelectorAll("#story .stamp:not(.no)").length === 2`));
    t.check("home: the controller is a small chip (no footer line)", await t.L(`!!document.querySelector(".home-bar .pad-status.on") && !document.querySelector(".home-foot")`));
    const nBtns = await t.L(`[...document.querySelectorAll("#screenCard button, #screenCard .nav")].filter(b => b.offsetParent).length`);
    t.check("home: a handful of big targets, not a wall of buttons", nBtns <= 10, `${nBtns} buttons`);
    t.check("home: secondary stuff behind 🚗 Garage / 📒 Scrapbook / ⚙️ More", await t.L(`["garage", "book", "more"].every(g => !!document.getElementById("tg_" + g))`));
    t.check("home: the old info lines are gone (next ride bar lives in the shop row)", await t.L(`!document.querySelector("#screenCard .gx-next") && !document.querySelector("#screenCard .tagline")`));
    let f = await fits();
    t.check("home fits 1280×720 without scrolling", f.ok, JSON.stringify(f));
    await t.shot("home-720");

    // every original item is still reachable (in its group's sub-menu)
    const labels = await g(`L3.titleLabels()`);
    const missing = ITEMS.filter(id => !labels.some(i => i.id === id));
    t.check("every title item is still registered + visible", missing.length === 0, missing.join(","));
    const unreachable = [];
    for (const it of labels) {
      await g(`L3.openView(${JSON.stringify(it.group === "play" ? "home" : it.group)})`);
      await t.frames(1);
      if (!await t.L(`(() => { const b = document.querySelector("#screenCard [data-ti=${JSON.stringify(it.id)}]"); return !!b && b.offsetParent !== null; })()`)) unreachable.push(it.id);
    }
    t.check("…and on screen in its group", unreachable.length === 0, unreachable.join(","));
    await g(`L3.openView("home", "story")`);
    await t.frames(2);

    // ── groups with the controller: D-pad, ✕, L1/R1, ○, focus memory ──────────
    t.check("D-pad reaches the 🚗 Garage tile", await navTo("tg_garage"));
    await t.tap(0);
    t.check("✕ opens the Garage sub-menu on its first row", await view() === "garage" && await focusId() === "shop");
    f = await fits();
    t.check("the sub-menu fits 720p", f.ok, JSON.stringify(f));
    await t.shot("garage-720");
    await t.tap(13);
    t.check("D-pad moves within the sub-menu", await focusId() === "distracted");
    await t.tap(5);
    t.check("R1 → the next tab (📒 Scrapbook)", await view() === "book");
    await t.shot("book-720");
    await t.tap(4);
    t.check("L1 → back to the Garage, focus remembered", await view() === "garage" && await focusId() === "distracted");
    await t.tap(1);
    t.check("○ goes home, focus back on the Garage tile", await view() === "home" && await focusId() === "tg_garage");
    await t.tap(0);
    t.check("re-opening the Garage remembers the row", await focusId() === "distracted");
    await t.tap(0);
    t.check("a toggle refreshes its row in place", await t.L(`/Distracted: ON/.test(document.getElementById("distracted").textContent)`) && await focusId() === "distracted");
    await t.tap(0);
    await t.tap(1);
    // ⚙️ More → Settings → ○ → back on the Settings row
    t.check("D-pad → reaches ⚙️ More", await navTo("tg_more"));
    await t.tap(0);
    await navTo("settings");
    await t.tap(0);
    t.check("✕ on ⚙️ Settings opens the settings", await t.L(`!!document.getElementById("set_quality")`));
    f = await fits();
    t.check("settings fit 720p", f.ok, JSON.stringify(f));
    await t.shot("settings-720");
    await t.tap(1);
    t.check("○ comes back to ⚙️ More with Settings focused", await view() === "more" && await focusId() === "settings");
    await t.tap(1);
    t.check("…and ○ again goes home", await view() === "home" && await focusId() === "tg_more");

    // ── other screens / layouts ──────────────────────────────────────────────
    const layouts = [["phone-landscape", 844, 390, false], ["phone-portrait", 390, 844, false], ["tv-1080", 1920, 1080, true]];
    for (const [name, w, h, tv] of layouts) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
      await g(`(ctx.applySettings(), L3.setState("title"), true)`);
      await t.frames(4);
      f = await fits();
      t.check(`home fits ${name} (${w}×${h}) without scrolling`, f.ok, JSON.stringify(f));
      if (name.startsWith("phone")) {
        const small = await smallTaps();
        t.check(`${name}: no tiny tap targets`, small.length === 0, small.join(","));
      }
      await t.shot(`home-${name}`);
      await g(`L3.openView("book")`);
      await t.frames(2);
      f = await fits();
      t.check(`a sub-menu fits ${name}`, f.ok, JSON.stringify(f));
      await t.shot(`book-${name}`);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
    await g(`(ctx.applySettings(), L3.setState("title"), true)`);
    // no controller → a small footer hint instead of the chip
    await t.L(`(window.__pad.connected = false, navigator.getGamepads = () => [null, null, null, null], 0)`);
    await t.frames(4);
    await g(`(L3.setState("title"), true)`);
    await t.frames(2);
    t.check("no pad → a small 'Got a controller?' footer", await t.L(`/Got a controller/.test((document.querySelector(".home-foot") || {}).textContent || "") && !document.querySelector(".home-bar .pad-status")`));
    await t.L(`(window.__pad.connected = true, navigator.getGamepads = () => [window.__pad, null, null, null], 0)`);
    await t.frames(4);

    // ── the pause menu ───────────────────────────────────────────────────────
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.G.invT = 1e6, true)`);
    await t.tap(9);
    t.check("pause: Resume first and focused", await t.L(`document.querySelector(".pm-main .btn").id === "resume"`) && await focusId() === "resume");
    t.check("pause: tools in a compact grid, quit buttons at the bottom", await t.L(`!!document.querySelector(".pm-tools #settings") && !!document.querySelector(".pm-exit #title")`));
    f = await fits();
    t.check("pause fits 720p", f.ok, JSON.stringify(f));
    await t.shot("pause-720");
    await t.click(/Settings/);
    t.check("controls live inside Settings", await t.L(`!!document.getElementById("set_controls")`));
    await t.click(/Button guide/);
    t.check("…the button guide opens", await t.L(`/ACTION/.test(document.querySelector("#screenCard .controls").textContent)`));
    await t.tap(1);
    t.check("○ → back in Settings on the guide row", await focusId() === "set_controls");
    await t.tap(1);
    t.check("○ → back on the pause menu, Settings focused", await focusId() === "settings");

    // ── settings: HUD Full / Clean, Lulu's chatter ──────────────────────────
    await t.click(/Settings/);
    await t.click(/HUD\b(?! size)/);
    t.check("HUD: Clean → body.hud-clean, setting saved", await t.L(`document.body.classList.contains("hud-clean")`) && await t.L(`import("./js/core/save.js").then(m => m.save3d.settings.hudMode)`) === "clean");
    const chat = [];
    for (let i = 0; i < 3; i++) { await t.click(/chatter/); chat.push(await t.L(`import("./js/core/save.js").then(m => m.save3d.settings.chatter)`)); }
    t.check("Lulu's chatter cycles normal → quiet → chatty → normal", chat.join(",") === "quiet,chatty,normal", chat.join(","));
    await t.tap(1); await t.tap(1);
    t.check("resumed", await g(`ctx.paused === false && ctx.state === "playing"`));
    await t.frames(4);
    t.check("clean HUD hides the score pill", await t.L(`getComputedStyle(document.querySelector(".pill.score")).display === "none"`));
    await t.shot("hud-clean");
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.hudMode = "full"; })`);
    await g(`(ctx.applySettings(), true)`);
    t.check("HUD: Full brings the score back", await t.L(`getComputedStyle(document.querySelector(".pill.score")).display !== "none"`));

    // chatter → banter's throttle
    const setChat = v => t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.chatter = "${v}"; })`);
    await g(`(ctx.banter.knobs.always = true, true)`);
    const said = async (combo, chatter, since) => {
      await setChat(chatter);
      return g(`(() => { const D = ctx.banter.lulu, n = D.count; D.cd = {}; D.gap = 8; D.last = ${since === null ? -99 : `ctx.time - ${since}`};
        L3.emit("closeCall", { oncoming: false, combo: ${combo} }); return D.count > n; })()`);
    };
    await t.until(`!__lulu3d.ctx.banter.line`, "no bubble up", 20000);
    t.check("chatty: Lulu talks again sooner (5 s after a line)", await said(1, "chatty", 5));
    await t.until(`!__lulu3d.ctx.banter.line`, "bubble gone", 20000);
    t.check("normal: …but not that soon", !(await said(1, "normal", 5)));
    t.check("quiet: no small talk", !(await said(1, "quiet", null)));
    t.check("quiet: the big moments still get a line", await said(3, "quiet", null));
    await setChat("normal");
    await t.until(`!__lulu3d.ctx.banter.line`, "bubble gone", 20000);
    await g(`(ctx.banter.knobs.always = false, true)`);

    // ── notifications ────────────────────────────────────────────────────────
    await t.until(`__lulu3d.H.notifyState().toasts.length === 0 && !__lulu3d.H.notifyState().banner`, "pop-ups clear", 20000);
    await H(`(H.toast("+5 💰", "gold"), H.toast("+5 💰", "gold"), H.toast("+5 💰", "gold"), true)`);
    let n = await H(`H.notifyState()`);
    t.check("a coin burst merges into one toast: +15 💰", n.toasts.length === 1 && n.toasts[0].text === "+15 💰", JSON.stringify(n.toasts));
    await H(`(H.toast("🚨 WRONG LANE, LULU!", "red"), H.toast("🚨 WRONG LANE, LULU!", "red"), true)`);
    t.check("a repeated toast shows ×2", await t.L(`[...document.querySelectorAll("#toasts .toast")].some(e => /WRONG LANE/.test(e.textContent) && /×2/.test(e.textContent))`));
    await H(`(["🍦 one", "🌭 two", "🥨 three", "🍩 four", "🧁 five"].forEach(s => H.toast(s)), true)`);
    n = await H(`H.notifyState()`);
    t.check("at most 3 toasts at once (the rest wait)", n.toasts.length <= 3 && n.waiting.length >= 1, `${n.toasts.length} shown, ${n.waiting.length} waiting`);
    await t.shot("toasts");
    await t.frames(150);
    n = await H(`H.notifyState()`);
    t.check("stale waiting toasts are dropped, not piled up", n.waiting.length === 0 && n.toasts.length <= 3, JSON.stringify(n));

    await H(`(H.banner("🎫 <b>low A</b>", 3000), H.banner("🚨 <b>IMPORTANT</b>", 2000, { prio: 2 }), H.banner("🚂 <b>low B</b>", 3000), true)`);
    n = await H(`H.notifyState()`);
    t.check("an important banner preempts; others queue (one at a time)", /IMPORTANT/.test(n.banner && n.banner.text) && n.queued.length === 1, JSON.stringify(n.banner) + " q" + n.queued.length);
    await t.until(`/low B/.test((__lulu3d.H.notifyState().banner || {}).text || "")`, "the queued banner shows next", 4000);
    t.check("…then the queued one", /low B/.test(((await H(`H.notifyState()`)).banner || {}).text || ""));
    await H(`(H.hideBanner(), H.banner("<b>3</b>", 900, { key: "cd" }), H.banner("<b>2</b>", 900, { key: "cd" }), true)`);
    t.check("same key replaces in place (3 → 2)", ((await H(`H.notifyState()`)).banner || {}).text === "2");
    await H(`(H.banner("🛑 <b>urgent</b>", 4000, { prio: 3 }), H.banner("🐢 <b>slowpoke</b>", 2000), true)`);
    await t.frames(130);
    n = await H(`H.notifyState()`);
    t.check("a banner that waited too long is dropped", !n.banner && n.queued.length === 0, JSON.stringify(n));

    await t.L(`import("./js/core/dialog.js").then(D => { D.say("Bubbe", "Eat something, you're skin and bones!", { emoji: "👵" }); })`);
    await t.frames(2);
    await H(`(H.toast("🎈 balloon"), H.banner("🎈 <b>BALLOONS</b>", 2500), true)`);
    n = await H(`H.notifyState()`);
    t.check("nothing new pops up while a dialogue is open", !n.toasts.some(x => /balloon/.test(x.text)) && n.waiting.includes("🎈 balloon") && (!n.banner || n.banner.held));
    await t.shot("dialog-quiet");
    await t.L(`import("./js/core/dialog.js").then(D => D.closeDialog())`);
    await t.frames(3);
    n = await H(`H.notifyState()`);
    t.check("…and it shows once the dialogue closes", n.toasts.some(x => /balloon/.test(x.text)) && /BALLOONS/.test((n.banner || {}).text || ""), JSON.stringify(n));
  },
};
