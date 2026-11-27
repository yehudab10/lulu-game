// 🐞 QA sweep, part 26 — THE 📱 PHONE, END TO END (roadmap 39; the owner, 2026-11-27: "go over every phone feature and make
// sure that everything works properly and to fix any bugs or remove unnecessary clutter buttons"). EVERY feature on, a phone
// upright (412 × 915, fingers) — qa26b.js runs the same fit checks on its side (667 × 375) — plus a controller:
//   • every app opens on foot and driving; every control FITS (inside the handset, ≥ 40 px, no clipped text, no "undefined" /
//     "coming soon"); the game is paused underneath
//   • 📞 Contacts: no doubled icon (🕵️ 🕵️ Internal Affairs); a contact opened from the bottom of the list starts the focus
//     on ITS first control (it was ‹ Contacts); ○ goes back to the list ON the row she came from
//   • 💼 Jobs: none takeable (on foot) → the reason FIRST + one line of what's waiting, no greyed-out rows; wanted → 🎨 Paint
//     & Pray is the FIRST row
//   • 💬 Messages: no "🏠 My house · 0 things" row with nothing bought (it said to decorate Ima's house — she can't); with a
//     thing bought → the row + "packed in boxes" until her own home
//   • 🗺️ Map: ONE tap on a place pings it (the phone closes); a tap on the pinned place clears it; the filter chips ≥ 40 px
//   • 📻 Radio: the station survives closing + reopening; ⚙️ Music off → the card says so, a tap on a station turns it on
//   • 📸 Camera: snap → in the album, ✖ Done → back where she was
//   • a controller: the touchpad opens it, the D-pad reaches every app, ○ backs out one level then closes; a City Hall bill
//     paid with two ✕
//   • no phone in Dina's mode
const W = require("../lib/qawatch.js");

const FIT = `(() => {
  const card = document.getElementById("screenCard");
  if (!card || !card.classList.contains("lphone")) return { open: false };
  const sr = card.querySelector(".lp-scr").getBoundingClientRect();
  const clipOf = b => [b, ...b.querySelectorAll("*")].some(e => { const cs = getComputedStyle(e); return (cs.textOverflow === "ellipsis" || cs.overflow === "hidden" || cs.overflowX === "hidden") && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && e.textContent.trim(); });
  const bad = [];
  for (const b of card.querySelectorAll("#lpBody button, #lpBody .nav")) {
    if (b.offsetParent === null) continue;
    const r = b.getBoundingClientRect(), t = b.textContent.replace(/\\s+/g, " ").trim().slice(0, 28);
    if (r.height < 40 - 0.5 || r.width < 40 - 0.5) bad.push("small " + Math.round(r.width) + "×" + Math.round(r.height) + " " + t);
    if (r.left < sr.left - 1 || r.right > sr.right + 1) bad.push("outside " + t);
    if (clipOf(b)) bad.push("clipped " + t);
  }
  const odd = [...card.querySelectorAll("#lpBody *")].filter(e => e.children.length === 0 && e.offsetParent !== null).map(e => e.textContent.trim()).filter(s => /coming soon|undefined|NaN|\\bnull\\b|\\[object/i.test(s));
  const inVp = sr.left >= -1 && sr.top >= -1 && sr.right <= innerWidth + 1 && sr.bottom <= innerHeight + 1;
  const head = card.querySelector(".lp-head b");
  return { open: true, app: head ? head.textContent : "HOME", bad: bad.concat(odd.map(s => "text: " + s)), inVp };
})()`;

async function openP(t, app) {
  await t.game(`(ctx.phone.isOpen && ctx.phone.closePhone(), true)`); await t.frames(3);
  const ok = await t.game(`ctx.phone.openPhone(${app ? JSON.stringify(app) : ""})`); await t.frames(6);
  return ok;
}
/** Every app on the home screen opens and fits (📸 is a hand-off: photo mode, closed again). */
async function fitAll(t, tag) {
  const g = t.game;
  t.check(`${tag}: the phone opens`, await openP(t));
  const home = await t.L(FIT);
  t.check(`${tag}: the home screen fits (inside the screen, every app ≥ 40 px)`, home.open && home.inVp && !home.bad.length, JSON.stringify(home));
  await t.shot(`${tag.replace(/\W+/g, "-")}-home`);
  const s0 = await g(`ctx.car.s`), st0 = await g(`L3.state`);
  await t.frames(20);
  t.check(`${tag}: the game stays paused while she reads`, Math.abs((await g(`ctx.car.s`)) - s0) < 0.01 && await g(`ctx.paused`) && (await g(`L3.state`)) === st0);
  for (const a of await g(`ctx.phone.apps()`)) {
    await openP(t);
    await g(`ctx.phone._dbg.openApp(${JSON.stringify(a)})`); await t.frames(6);
    if (!(await g(`ctx.phone.isOpen`))) {      // (📸: a hand-off — photo mode; back out of it)
      await t.until(`__lulu3d.state === "playPhoto" && __lulu3d.ctx.play.photo.on`, `${tag}: ${a} → photo mode`, 8000);
      await t.frames(4);
      await g(`(ctx.play.photo.close(), true)`);
      await t.until(`__lulu3d.state === ${JSON.stringify(st0)}`, `${tag}: out of ${a} again`, 8000); await t.frames(6); continue;
    }
    const f = await t.L(FIT);
    t.check(`${tag}: ${a} fits (≥ 40 px, inside the handset, nothing clipped / undefined)`, f.open && f.inVp && !f.bad.length, JSON.stringify(f.bad.slice(0, 5)));
    await t.shot(`${tag.replace(/\W+/g, "-")}-${a}`);
  }
  await g(`(ctx.phone.closePhone(), true)`); await t.frames(4);
}

module.exports = {
  name: "qa26",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 900, cruiseUnlocked: true, convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  FIT, openP, fitAll,
  async run(t) { try { await this.body(t); } finally { W.dropRelayErrors(t); } },
  async body(t) {
    const g = t.game;
    const L = s => t.L(s);
    await L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await W.install(t);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "▶ PLAY: at home", 60000)) return;
    await t.frames(30);
    if (!process.env.QA26_DBG) await fitAll(t, "on foot");

    // ── 📞 Contacts ──
    await openP(t, "community");
    const names = await L(`[...document.querySelectorAll("#lpApp [data-org], #lpApp [data-ct]")].map(b => [b.querySelector(".lp-av").textContent.trim(), b.querySelector("b").textContent.trim()])`);
    const dbl = names.filter(([ic, nm]) => ic && nm.startsWith(ic));
    t.check("📞 Contacts: no contact repeats its own icon (🕵️ 🕵️ Internal Affairs)", names.length >= 6 && !dbl.length, JSON.stringify(dbl));
    const last = await L(`(() => { const r = [...document.querySelectorAll("#lpApp [data-ct]")].pop(); if (!r) return null; __lulu3d.H.setFocus(r); r.click(); return r.dataset.ct; })()`);
    await t.frames(4);
    const f1 = await L(`(() => { const f = document.querySelector("#lpApp .focus"); return f ? f.id || f.textContent.slice(0, 20) : "NONE"; })()`);
    const nBtn = await L(`[...document.querySelectorAll("#lpApp button")].filter(b => !b.disabled && b.offsetParent).length`);
    t.check(`…a contact opened from the bottom of the list (${last}) starts on its own first control, not ‹ Contacts`, nBtn <= 1 || f1 !== "cmBack", `${f1} (${nBtn} buttons)`);
    await t.tap(1);
    const back = await L(`(() => { const f = document.querySelector("#lpApp .focus"); return { list: document.querySelectorAll("#lpApp [data-org]").length, on: f && f.dataset ? f.dataset.ct || f.dataset.org || "" : "" }; })()`);
    t.check("…○ goes back to the list, ON the contact she came from", back.list >= 4 && back.on === last, JSON.stringify(back));

    // ── 💼 Jobs on foot ──
    await openP(t, "jobs");
    const jobs = await L(`(() => { const a = document.getElementById("lpApp"); const first = a.firstElementChild; return { first: first && first.className, txt: first && first.textContent, dead: a.querySelectorAll(".lp-job[disabled]").length, wait: !!a.querySelector(".lp-jobswait") }; })()`);
    t.check("💼 Jobs on foot: the reason FIRST, one line of what's waiting, no greyed-out rows", /lp-note/.test(jobs.first) && /car/.test(jobs.txt) && !jobs.dead && jobs.wait, JSON.stringify(jobs));

    // ── 💬 Messages: the 🏠 row ──
    await openP(t, "messages");
    t.check("💬 Messages: no 🏠 My house row with nothing bought", !(await L(`!!document.querySelector("#lpApp #lpHouse")`)));
    await g(`((ctx.decor.debug.S.owned.bed = ["fluffy"]), true)`);
    await openP(t, "messages");
    const hb = await L(`!!document.querySelector("#lpApp #lpHouse")`);
    if (hb) { await L(`document.querySelector("#lpApp #lpHouse").click()`); await t.frames(4); }
    const ht = await L(`(document.getElementById("lpApp") || {}).textContent || ""`);
    t.check("…a thing bought → the row, and it says where her things are (boxed until her own home)", hb && /Pink & fluffy/.test(ht) && /boxes/.test(ht) && !/to decorate/.test(ht), ht.slice(0, 200));
    await g(`((ctx.decor.debug.S.owned.bed = []), true)`);

    // ── 🗺️ Map: one tap pings ──
    await openP(t, "lapmap");
    const chip = await L(`(() => { const c = document.querySelector("#lpApp [data-pcat]"); return c ? Math.round(c.getBoundingClientRect().height) : 0; })()`);
    t.check("🗺️ Map: the filter chips are ≥ 40 px tall", chip >= 40, chip);
    const pid = await L(`(() => { const r = [...document.querySelectorAll("#lpApp [data-pin]")].find(b => /makolet|clothes|pizza/.test(b.dataset.pin)) || document.querySelector("#lpApp [data-pin]"); if (!r) return null; r.click(); return r.dataset.pin; })()`);
    await t.frames(8);
    t.check("…ONE tap on a place pings it and the phone closes", !!pid && await g(`ctx.pins.current === ${JSON.stringify(pid)} && !ctx.phone.isOpen`), pid);
    await openP(t, "lapmap");
    await L(`document.querySelector('#lpApp [data-pin="${pid}"]').click()`); await t.frames(6);
    t.check("…a tap on the pinned place clears it (the phone stays open)", await g(`!ctx.pins.current && ctx.phone.isOpen`));

    // ── 📻 Radio ──
    await openP(t, "radio");
    await L(`document.querySelector('#lpApp [data-st="simcha"]').click()`); await t.frames(4);
    await openP(t, "radio");
    t.check("📻 Radio: the station survives closing + reopening the phone", await g(`ctx.hustle.radio.station === "simcha"`) && await L(`!!document.querySelector('#lpApp .lp-st.on[data-st="simcha"]')`));
    await L(`import("./js/audio.js").then(A => { if (A.audio.musicOn) A.toggleMusic(); return true; })`);
    await openP(t, "radio");
    t.check("…⚙️ Music off → the card says so (not a song playing)", /Music is off/.test(await L(`document.querySelector("#lpApp .lp-now").textContent`)));
    await L(`document.querySelector('#lpApp [data-st="simcha"]').click()`); await t.frames(4);
    t.check("…a tap on the station turns the music back on", await L(`import("./js/audio.js").then(A => A.audio.musicOn)`));
    await L(`document.querySelector('#lpApp [data-st="auto"]').click()`); await t.frames(4);

    // ── 📸 Camera ──
    const al0 = await L(`import("./js/features/play/common.js").then(m => m.SAVE.album.length)`);
    await openP(t, "camera");
    t.check("📸 Camera: photo mode", await t.until(`__lulu3d.state === "playPhoto"`, "photo mode", 8000));
    await t.frames(10);
    await L(`(() => { const b = document.querySelector('[data-act="snap"]'); if (b) b.click(); return !!b; })()`);
    await t.frames(20);
    t.check("…a snap lands in the album", (await L(`import("./js/features/play/common.js").then(m => m.SAVE.album.length)`)) === Math.min(6, al0 + 1));
    await L(`(() => { const b = document.querySelector('[data-act="exit"]'); if (b) b.click(); return !!b; })()`);
    t.check("…✖ Done → back on foot where she was", await t.until(`__lulu3d.state === "footRun"`, "back on foot", 8000));
    await t.frames(6);

    // ── a controller ──
    await t.tap(17); await t.frames(6);
    t.check("🎮 the touchpad opens the phone", await g(`ctx.phone.isOpen`));
    const seen = new Set([await L(`(document.querySelector("#screenCard .lp-app.focus") || { dataset: {} }).dataset.app`)]);
    await L(`__lulu3d.H.setFocus(document.querySelector("#screenCard .lp-app"))`);        // (from the first app: a snake through the grid)
    seen.add(await L(`document.querySelector("#screenCard .lp-app").dataset.app`));
    for (const d of [15, 15, 13, 14, 14, 13, 15, 15, 12, 12]) { await t.tap(d); seen.add(await L(`(document.querySelector("#screenCard .lp-app.focus") || { dataset: {} }).dataset.app`));
      if (process.env.QA26_DBG) console.log("   pad", d, await L(`(() => { const f = document.querySelector(".focus"); return f ? f.tagName + "#" + f.id + "." + f.className + " " + f.textContent.slice(0, 20) : "NONE"; })()`), await g("ctx.phone.isOpen"), await g("L3.state")); }
    const apps = await g(`ctx.phone.apps()`);
    t.check("…the D-pad reaches every app", apps.every(a => seen.has(a)), [...seen].join(","));
    await L(`__lulu3d.H.setFocus(document.getElementById("lpa_community"))`); await t.tap(0); await t.frames(4);
    const inApp = await L(`(document.querySelector("#screenCard .lp-head b") || {}).textContent`);
    await t.tap(1);
    const lvl1 = await L(`!!document.querySelector("#screenCard .lp-home")`);
    await t.tap(1);
    t.check("…✕ opens an app, ○ goes home, ○ again closes the phone", inApp === "Contacts" && lvl1 && !(await g(`ctx.phone.isOpen`)), `${inApp} ${lvl1}`);
    // a bill, paid with two ✕
    await L(`import("./js/features/cityhall/tax.js").then(m => { m.addLine("tax", "Property tax (test)", 40); return true; })`);
    const c0 = await g(`L3.wallet.coins`);
    await t.tap(17); await t.frames(6);
    await L(`__lulu3d.H.setFocus(document.getElementById("lpa_community"))`); await t.tap(0); await t.frames(4);
    await L(`__lulu3d.H.setFocus(document.querySelector('#lpApp [data-ct="cityhall"]'))`); await t.tap(0); await t.frames(4);
    const fPay = await L(`(document.querySelector("#lpApp .focus") || {}).id`);
    t.check("🏛️ City Hall with a bill: the focus starts ON ✍️ Pay", fPay === "chPay", fPay);
    await t.tap(0); await t.frames(4); await t.tap(0); await t.frames(4);
    t.check("…two ✕ pay it (40 coins, nothing owed after)", (await g(`L3.wallet.coins`)) === c0 - 40 && (await L(`import("./js/features/cityhall/tax.js").then(m => m.owed())`)) === 0, `${c0} → ${await g(`L3.wallet.coins`)}`);
    await g(`(ctx.phone.closePhone(), true)`); await t.frames(4);
    await t.hold(7, 0);

    // ── driving, then wanted ──
    await g(`(ctx.foot.active && ctx.foot.end && ctx.foot.end("test"), L3.startRun({ mode: "cruise", quick: true }))`);
    if (await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "driving", 20000)) {
      await t.frames(20);
      await g(`(ctx.G.invT = 1e6, ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
      await fitAll(t, "driving");
      await g(`(ctx.law.startChase("SPEEDING", { heat: 2 }), true)`); await t.frames(6);
      await openP(t, "jobs");
      const top = await L(`(() => { const a = document.getElementById("lpApp"); return a.firstElementChild ? a.firstElementChild.id || a.firstElementChild.className : ""; })()`);
      const paintOn = await g(`!!(ctx.streets && ctx.streets.paint && ctx.streets.paint.nearest)`);
      t.check("💼 Jobs while wanted: 🎨 Paint & Pray is the FIRST row", !paintOn || top === "lpPaint", top);
      await t.shot("wanted-jobs");
      await g(`(ctx.phone.closePhone(), true)`);
    }

    // ── Dina's mode: no phone ──
    await g(`(ctx.law.clear && ctx.law.clear(), L3.setState("title"), true)`); await t.frames(10);
    await g(`(ctx.dina.start(), true)`);
    if (await t.until(`__lulu3d.ctx.dina.active`, "Dina's mode", 30000)) {
      await t.frames(20);
      t.check("👧 Dina's mode: no phone (it doesn't open, no 📱 button)", !(await g(`ctx.phone.openPhone()`)) && !(await L(`(() => { const b = document.getElementById("phoneBtn"); return !!b && b.offsetParent !== null && getComputedStyle(b).display !== "none"; })()`)));
    }
  },
};
