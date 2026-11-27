// 🐞 QA sweep, part 18 — POP-UPS ON A PHONE (ci/hud), as a real player with EVERY feature on: the first minutes at
// 412 × 915 (upright) and 667 × 375 (on its side), fingers. A sampler in the page watches, every 6 frames, for anything
// on screen inside the CLEAR WINDOW round the car (H.clearWindow) — a card, a toast, a bubble, a chip — while she has
// control, and for any new card / toast that turns up while an ACTIVITY is on (ctx.engaged()). Reported: what sat in the
// window ≥ 1.5 s, and what popped up during an activity. Plus: the 📱 for a fresh player (7 apps, no unread).
const W = require("../lib/qawatch.js");

const VIEWS = [["upright", 412, 915], ["side", 667, 375]];

module.exports = {
  name: "qa18",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await W.install(t);
    // ── the sampler ──
    await t.L(`(() => {
      const ctx = __lulu3d.ctx, H = __lulu3d.L3 && __lulu3d.L3.H;
      const S = window.__pop = { on: true, sit: {}, cur: {}, during: [], f: 0, view: "" };
      const shown = e => { for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.15) return false; } return true; };
      const SKIP = "canvas, #touch, #touch *, #stickBase, #stickBase *, #footPad, #footPad *, #touchExtra, #touchExtra *, #hud .speedo, #hud .speedo *, #qaOverlay, #qaOverlay *";
      const own = e => { for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true; const c = getComputedStyle(e); const m = /rgba?\\(([^)]+)\\)/.exec(c.backgroundColor); const a = m ? (m[1].split(",")[3] === undefined ? 1 : +m[1].split(",")[3]) : 0; return a > 0.35 || e.tagName === "IMG"; };
      const name = e => { let n = e, path = ""; for (let i = 0; i < 3 && n && n !== document.body; i++, n = n.parentElement) { if (n.id) { path = "#" + n.id + (path ? " › " + path : ""); break; } if (!path) path = n.tagName.toLowerCase() + (n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""); } return path; };
      const ctl = () => !ctx.paused && !ctx.view && (ctx.state === "playing" || (ctx.state === "footRun" && ctx.foot.debug.F && ctx.foot.debug.F.phase === "walk")) && !(ctx.cutscene && ctx.cutscene.active()) && !document.querySelector("#screenCard:not(.hidden)");
      const tick = () => {
        if (!window.__pop) return;
        if (++S.f % 6 === 0 && S.on) {
          const c = H && H.clearWindow ? H.clearWindow() : { x0: 0.3, x1: 0.7, y0: 0.4, y1: 0.9 }, Wd = innerWidth, Hd = innerHeight;
          const X0 = c.x0 * Wd, X1 = c.x1 * Wd, Y0 = c.y0 * Hd, Y1 = c.y1 * Hd;
          const now = {};
          if (ctl()) for (const e of document.body.querySelectorAll("*")) {
            if (e.matches(SKIP)) continue;
            const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
            const ox = Math.min(r.right, X1) - Math.max(r.left, X0), oy = Math.min(r.bottom, Y1) - Math.max(r.top, Y0);
            if (ox < 8 || oy < 8 || !own(e) || !shown(e)) continue;
            const k = name(e); if (now[k]) continue;
            now[k] = (e.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 70) || "(" + Math.round(ox) + "×" + Math.round(oy) + ")";
          }
          for (const k of Object.keys(S.cur)) if (!now[k]) delete S.cur[k];
          for (const [k, txt] of Object.entries(now)) {
            const a = S.cur[k] = S.cur[k] || { f0: S.f, txt };
            const run = S.f - a.f0, key = S.view + " · " + k;
            const b = S.sit[key] = S.sit[key] || { max: 0, txt, state: ctx.state };
            if (run > b.max) { b.max = run; b.txt = txt; b.state = ctx.state; }
          }
        }
        requestAnimationFrame(tick);
      };
      tick();
      // cards / toasts / texts that turn up while an activity is on
      // (only while she has control: a WRECKED! / an arrest card is the result of the activity, not a pop-up over it)
      new MutationObserver(ms => { if (!S.on || !(ctx.engaged && ctx.engaged()) || !ctl()) return; for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || n.matches(SKIP)) continue; const cls = (n.className && typeof n.className === "string") ? n.className : "";
        if (!/toast|jtext|card|banner|bubble|chip/i.test(cls + " " + (n.id || ""))) continue;
        // (shown 10 frames on, not folded into the objective line's badges — a chip the line folds isn't a pop-up)
        const rec = { view: S.view, state: ctx.state, what: (n.id ? "#" + n.id : "") + "." + cls.split(/\\s+/).slice(0, 2).join("."), txt: (n.textContent || "").trim().slice(0, 80), act: ctx.engaged() }, f1 = S.f + 10;
        const later = () => { if (S.f < f1) return requestAnimationFrame(later); if (n.isConnected && shown(n) && !n.closest(".obj-folded") && !n.querySelector(".obj-folded") && !/obj-folded/.test(n.className || "")) S.during.push(rec); };
        requestAnimationFrame(later); }
      }).observe(document.body, { childList: true, subtree: true });
      return true; })()`);
    const view = v => t.L(`(window.__pop.view = ${JSON.stringify(v)}, window.__pop.cur = {}, true)`);
    const walk = async () => t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on her feet", 60000);
    const drive = async (frames, steer = 0.3) => { await t.hold(7, 0.75); for (let i = 0; i < frames; i += 30) { await t.L(`(__pad.axes[0] = ${steer} * Math.sin(${i} / 70), true)`); await t.frames(30); } await t.L(`(__pad.axes[0] = 0, true)`); await t.hold(7, 0); };

    // ── 412 × 915, upright: ▶ PLAY → the porch → a stroll → her car → E 34th St → the highway → Lakewood → on foot ──
    await view("upright");
    await t.click(/PLAY/);
    if (!t.check("▶ PLAY → on her feet at home (upright)", await walk())) return;
    const ph = await g(`({ apps: ctx.phone.apps(), unread: ctx.phone.inbox.unread ? ctx.phone.inbox.unread() : null })`);
    t.check("📱 for a fresh player: 7 apps", ph.apps.length === 7, JSON.stringify(ph.apps));
    t.check("📱 for a fresh player: nothing unread (badge 0)", !ph.unread, JSON.stringify(ph.unread));
    await t.frames(240);
    for (const [x, y, n] of [[0, -1, 60], [1, 0, 40], [0, 1, 60]]) { await t.stick(x, y); await t.frames(n); }
    await t.stick(0, 0);
    if (await g(`ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : false`)) await t.until(`__lulu3d.state === "playing"`, "driving (after the pull-out)", 30000);
    await drive(240);
    await t.shot("upright-e34");
    // out to the highway (the home exit) and a drive
    await W.moved(t);
    await g(`(() => { if (ctx.town.active) ctx.town.leave("highway"); return true; })()`);
    await t.until(`!__lulu3d.ctx.town.active && !__lulu3d.ctx.town.transitioning`, "on the highway", 20000);
    await drive(600, 0.15);
    await t.shot("upright-highway");
    // an activity: a chase (one activity at a time — nothing else may pop up over it)
    await g(`(ctx.law.hold(0), ctx.law.startChase && ctx.law.startChase("SPEEDING", { heat: 2 }), true)`);
    await drive(300, 0.2);
    await t.shot("upright-chase");
    await g(`(ctx.law.standDown && ctx.law.standDown(), ctx.law.hold(99999), true)`);
    // Lakewood, driving + on foot
    await g(`(ctx.town.load("lakewood"), true)`);
    if (await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 90000)) {
      await W.moved(t);
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      if (await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "in Lakewood", 15000)) {
        await drive(300, 0.25);
        await g(`(ctx.foot.start("droveOff"), true)`);
        if (await walk()) { for (const [x, y, n] of [[0, -1, 120], [1, 0, 60], [0, -1, 120]]) { await t.stick(x, y); await t.frames(n); } await t.stick(0, 0); await t.frames(120); }
        await t.shot("upright-lakewood-foot");
      }
    }

    // ── 667 × 375, on its side: the same town, driving + on foot ──
    await t.page.setViewportSize({ width: 667, height: 375 });
    await view("side");
    await t.frames(30);
    if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`); await t.until(`__lulu3d.state === "playing"`, "back in the car", 20000); }
    await drive(300, 0.25);
    await g(`(ctx.foot.start("droveOff"), true)`);
    if (await walk()) { for (const [x, y, n] of [[0, -1, 120], [-1, 0, 60], [0, -1, 120]]) { await t.stick(x, y); await t.frames(n); } await t.stick(0, 0); await t.frames(120); }
    await t.shot("side-lakewood-foot");
    await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("highway"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`);
    await t.frames(30);
    await drive(600, 0.15);
    await g(`(ctx.law.hold(0), ctx.law.startChase && ctx.law.startChase("SPEEDING", { heat: 2 }), true)`);
    await drive(300, 0.2);
    await t.shot("side-chase");
    await g(`(ctx.law.standDown && ctx.law.standDown(), true)`);

    // ── the verdict ──
    const P = await t.L(`(() => { const S = window.__pop; S.on = false; return { sit: Object.entries(S.sit).filter(([k, v]) => v.max >= 45).map(([k, v]) => ({ k, s: +(v.max / 30).toFixed(1), txt: v.txt, state: v.state })).sort((a, b) => b.s - a.s), during: S.during }; })()`);
    console.log("   in the clear window ≥ 1.5 s:\n     " + P.sit.map(x => JSON.stringify(x)).join("\n     "));
    console.log("   popped up during an activity:\n     " + P.during.slice(0, 30).map(x => JSON.stringify(x)).join("\n     "));
    t.check("nothing sits over the car / the road ahead (the clear window) for ≥ 1.5 s while she has control", P.sit.length === 0, JSON.stringify(P.sit.slice(0, 6)));
    t.check("no card / toast / text pops up while an activity is on", P.during.length === 0, JSON.stringify(P.during.slice(0, 6)));
    const r = await W.report(t); W.log(r); W.check(t, "the watchdog, the whole run", r, ["nan", "overlay", "underground", "stuck", "hidden"]);
  },
};
