// 🪪 ACCOUNTS + UNIQUE USERNAMES (ci/accounts) — real pages against the LOCAL relay (server/local-relay.js runs the same
// server/accounts.mjs the production worker runs; never production).
//   OFFLINE FIRST START  the page boots with the relay down: no name card, PLAY works at once under "Kugel Kid #NN"
//   NAMED LATER          the relay comes up → back on the title → the card asks (fits a 360×800 phone), 3 one-tap ideas,
//                        "Don't use your real name"; a rude name → instant "isn't allowed"; a TAKEN name (B has it, any
//                        case) → "Someone already has that name. Try …" + fresh ideas; a tap on an idea → that's her name
//   NAMES ON CARS        A and B out in the world: each sees the other's USERNAME over the car (from the server, by ticket);
//                        a ghost that sends a forged ticket stays colour + number; ⚙️ Other players' names Off → colour +
//                        number; 🚩 Report this name (Nearby) → hidden on A's screen at once
//   REPORTS              three day-old accounts report B → B's name is replaced; B's page, CLOSED and REOPENED → the card
//                        says it was reported; B picks a new one at once (no 30-day wait)
//   CHANGE               A changes her name in ⚙️ › 🪪 Your name: refused within 30 days (the date shown), fine after
//   NEW PHONE            A's 💾 save code on a fresh page → the same account id + name
//   DELETE               ⚙️ › Delete my online account → the server frees the name; no new account is made by itself
//   CONTROLLER           the card works with the pad: ✕ on an idea takes it
const { startRelay, waitOn, framesOn, setWallCap } = require("../lib/party3d.js");
const PORT = 30500 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const HTTP = `http://127.0.0.1:${PORT}`;
const Q0 = `&enable=multiplayer,party,openworld,foot,atmos,phone,friends&mpurl=${encodeURIComponent(URL)}`;
const Q = Q0 + "&acctname=1";                          // (only pages that should be ASKED for a name carry this)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const rid = () => Array.from({ length: 16 }, () => B32[Math.floor(Math.random() * 32)]).join("");
const rsec = () => Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"[Math.floor(Math.random() * 64)]).join("");
async function api(p, body) { await sleep(450); const r = await fetch(HTTP + p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); return { st: r.status, j: await r.json().catch(() => null) }; }
const CARD_FITS = `(() => { const c = document.getElementById("screenCard"); if (!c) return "no card"; const r = c.getBoundingClientRect();
  const out = r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
  const btns = [...c.querySelectorAll("button, input")].filter(b => b.offsetParent !== null).map(b => b.getBoundingClientRect());
  const clipped = btns.some(b => b.bottom > Math.min(innerHeight, r.bottom) + 1 || b.right > innerWidth + 1);
  return out || clipped ? JSON.stringify({ r: [r.left, r.top, r.right, r.bottom].map(Math.round), w: innerWidth, h: innerHeight, sh: c.scrollHeight, ch: c.clientHeight }) : ""; })()`;
const IDEAS = `[...document.querySelectorAll("#acctIdeas [data-n]")].map(b => b.dataset.n)`;
const WHY = `(document.getElementById("acctWhy") || {}).textContent || ""`;

/** A page with its own storage (a "phone"): seeded with `store` = { luluSaveV2, lulu3dSave } strings, if given. */
async function phone(t, label, store, viewport = { width: 640, height: 360 }, query = Q) {
  const browser = t.page.context().browser();
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { const x = m.text(); if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(x)) errors.push(x); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(({ store }) => {
    if (!sessionStorage.getItem("__seeded")) for (const k in store) if (store[k] != null) localStorage.setItem(k, store[k]);
    sessionStorage.setItem("__seeded", "1");
  }, { store: store || { luluSaveV2: JSON.stringify({ totalCoins: 0, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Latke Legend" }) } });
  const base = t.page.url().split("/3d/")[0];
  await page.goto(`${base}/3d/?test${query}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`);
  const P = {
    label, page, errors,
    L: code => page.evaluate(code),
    game: code => page.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`),
    frames: n => framesOn(page, n),
    async until(code, what, ms = 90000) {
      if (await waitOn(page, `(() => { try { return !!(${code}); } catch (e) { return false; } })()`, ms)) return true;
      t.check(`${label}: ${what}`, false, "timed out in " + await page.evaluate(`window.__lulu3d && (__lulu3d.state + " @ frame " + __lulu3d.frames)`).catch(() => "?"));
      return false;
    },
    storage: () => page.evaluate(`import("./js/core/save.js").then(m => { m.saveNow(); return { luluSaveV2: localStorage.getItem("luluSaveV2"), lulu3dSave: localStorage.getItem("lulu3dSave") }; })`),
  };
  await P.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots to the title");
  return P;
}
const tWrap = t => ({ label: "A", page: t.page, errors: t.errors, L: t.L, game: t.game, frames: n => t.frames(n), until: (c, w, ms) => t.until(c, "A: " + w, ms) });

module.exports = {
  name: "accounts",
  viewport: { width: 360, height: 800 },                 // a small phone held upright
  query: Q,
  save2d: { totalCoins: 50, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    setWallCap(8 * 60000);
    const pages = [];
    let relay = null;
    try { relay = await body(t, pages, r => { relay = r; }); }
    catch (e) { t.check("accounts threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of pages) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      if (relay) relay.kill();
    }
  },
};

async function body(t, pages, keep) {
  const A = tWrap(t);
  // ── OFFLINE FIRST START (the relay isn't up yet) ──
  await t.frames(90);
  t.check("offline first start: no name card", !await t.L(`!!document.getElementById("acctIdeas")`));
  t.check("offline: she plays under a generated name", /^[A-Za-z' ]+ #\d+$/.test(await t.game(`ctx.player.label()`)) && !await t.game(`ctx.accounts.on`), await t.game(`ctx.player.label()`));
  await t.click(/PLAY/);
  t.check("offline: PLAY starts at once", await t.until(`__lulu3d.state !== "title"`, "PLAY leaves the title", 20000));

  // ── the relay comes up: asked "later" — next time on the title ──
  const relay = await startRelay(PORT); keep(relay);
  t.check("A: the account is made once the relay is up", await t.game(`ctx.accounts.hello(true)`) && await t.game(`ctx.accounts.on && !!ctx.accounts.view && ctx.accounts.view.me.name === null`));
  t.check("…but no card while she's playing", !await t.L(`!!document.getElementById("acctIdeas")`));
  await t.game(`L3.setState("title")`);
  if (!await t.until(`document.querySelectorAll("#acctIdeas [data-n]").length === 3`, "back on the title, the name card asks with 3 ideas", 20000)) return relay;
  const fit = await t.L(CARD_FITS);
  t.check("the card fits a 360×800 phone", fit === "", fit);
  t.check("it says don't use your real name", await t.L(`/Don't use your real name/.test(document.getElementById("screenCard").textContent)`));
  await t.shot("name-card-phone");
  // B (another phone) takes a name first
  const B = await phone(t, "B", null, undefined, Q0); pages.push(B);
  await B.until(`ctx.accounts.on`, "B: account up");
  const nameB = "zz_test_Bee" + "abcdefghjk"[Math.floor(Math.random() * 10)] + "x";
  t.check("B takes a name in code (the same call the card makes)", (await B.game(`ctx.accounts.setName(${JSON.stringify(nameB)})`)).ok === true);
  // A types: rude → instant; taken (any case) → ideas
  const type = v => t.page.fill("#acctIn", v);
  await type("Big_Ass");
  t.check("a rude name → 'isn't allowed' at once (no server needed)", /isn't allowed/.test(await t.L(WHY)), await t.L(WHY));
  await type(nameB.toUpperCase());
  await t.until(`/already has that name/.test(${WHY})`, "a taken name (any case) → 'Someone already has that name'", 20000);
  t.check("…with ideas to try", /Try \w+/.test(await t.L(WHY)) && (await t.L(IDEAS)).length >= 1, await t.L(WHY));
  await type("Lulu12345");
  t.check("a phone number → refused", /phone numbers/.test(await t.L(WHY)), await t.L(WHY));
  // controller: focus the first idea with the D-pad and press ✕
  await type("");
  const pick = (await t.L(IDEAS))[0];
  await t.L(`document.getElementById("acctIdea0") && document.getElementById("acctIdea0").scrollIntoView()`);
  await t.L(`(() => { const b = document.getElementById("acctIdea0"); return b && b.classList.contains("focus"); })()`) || await t.tap(12);
  for (let k = 0; k < 6 && !await t.L(`(() => { const b = document.getElementById("acctIdea0"); return !!(b && b.classList.contains("focus")); })()`); k++) await t.tap(12);
  const pickNow = await t.L(`(document.querySelector("#acctIdeas .focus") || {}).dataset?.n || ""`);
  await t.tap(0);
  t.check("✕ on an idea takes it (controller)", await t.until(`__lulu3d.ctx.player.name() === ${JSON.stringify(pickNow || pick)}`, "the idea became her name", 20000) && !await t.L(`!!document.getElementById("acctIdeas")`), pickNow || pick);
  t.check("back on the title after picking", await t.until(`!!document.querySelector("#screenCard [data-title-seq]")`, "the title again", 10000));
  const nameA = await t.game(`ctx.player.name()`);
  t.check("the label others see is the username now", await t.game(`ctx.player.label()`) === nameA);
  t.check("the card doesn't come back on the next title", (await t.game(`L3.setState("title")`), await t.frames(60), !await t.L(`!!document.getElementById("acctIdeas")`)));

  // ── names over cars (EVERYONE) ──
  const drive = async (P, s, d) => {
    await P.game(`L3.startRun({ mode: "cruise", quick: true })`);
    await P.until(`__lulu3d.state === "playing"`, `${P.label}: cruise starts`);
    await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.G.invT = 999, ctx.traffic.clear(), ctx.traffic.config.enabled = false, (() => { const p = ctx.world.road.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; })(), true)`);
  };
  await drive(A, 400, 1.75); await drive(B, 420, -1.75);
  await A.until(`ctx.mp._debug.connected && Object.keys(ctx.mp._debug.peers).length >= 1`, "A sees B in the world", 300000);
  const peerB = `Object.values(ctx.mp._debug.peers)[0]`;
  t.check("A sees B's USERNAME over B's car (the server's, by ticket)", await A.until(`${peerB}.name === ${JSON.stringify(nameB)}`, "B's name over the car", 120000), await t.game(`${peerB}.name`));
  t.check("B sees A's username", await B.until(`Object.values(ctx.mp._debug.peers)[0].name === ${JSON.stringify(nameA)}`, "A's name on B's screen", 120000));
  // a forged ticket (B's id with a made-up signature) from a raw relay client stays a colour + number
  const forged = await rawGhost(URL, (await B.game(`ctx.player.id()`)) + ".zzzzzz.AAAAAAAAAAAAAAAAAAAAAA");
  await A.until(`Object.values(ctx.mp._debug.peers).length >= 2`, "A sees the raw ghost", 120000);
  await t.frames(60);
  const raw = await t.game(`Object.values(ctx.mp._debug.peers).find(p => p.un && p.un.endsWith("AAAAAAAAAAAAAAAAAAAAAA"))?.name || "?"`);
  t.check("a forged ticket never shows a name (colour + number)", /^[A-Z][a-z]+ \d+$/.test(raw) && raw !== nameB, raw);
  forged.close();
  // ⚙️ Other players' names Off
  await t.game(`ctx.accounts.hideNames = true`);
  t.check("Other players' names Off → colour + number", await A.until(`/^[A-Z][a-z]+ \\d+$/.test(${peerB}.name)`, "B is a colour + number", 10000), await t.game(`${peerB}.name`));
  await t.game(`ctx.accounts.hideNames = false`);
  await A.until(`${peerB}.name === ${JSON.stringify(nameB)}`, "names back on");
  // 🚩 from Nearby
  const bid = await t.game(`Object.keys(ctx.mp._debug.peers).find(k => ctx.mp._debug.peers[k].name === ${JSON.stringify(nameB)})`);
  await t.game(`ctx.phone.openPhone("nearby", { driver: ${JSON.stringify(bid)}, name: ${JSON.stringify(nameB)} })`);
  t.check("Nearby › a named driver has 🚩 Report this name", await A.until(`!!document.getElementById("frRep")`, "the report row", 10000));
  await t.L(`document.getElementById("frRep").click()`);
  t.check("reported → hidden on A's screen at once", await A.until(`/^[A-Z][a-z]+ \\d+$/.test(ctx.mp._debug.peers[${JSON.stringify(bid)}].name)`, "B hidden for A", 10000));
  await t.game(`ctx.phone.closePhone && ctx.phone.closePhone()`);

  // ── REPORTS: three day-old accounts → B's name is replaced; B's page closed + reopened gets the card ──
  const bPid = await B.game(`ctx.player.id()`);
  const bStore = await B.storage();
  await B.page.close(); pages.splice(pages.indexOf(B), 1);
  const reporters = [];
  for (let k = 0; k < 3; k++) { const X = { pid: rid(), sec: rsec() }; await api("/acct/hello", X); reporters.push(X); }
  await api("/acct/_clock", { offset: 2 * 86400000 });
  for (const X of reporters) await api("/acct/report", { ...X, f: bPid });
  const chk = await api("/acct/check?n=" + nameB);
  t.check("after 3 reports B's old name is retired", chk.j && chk.j.why === "retired", JSON.stringify(chk.j));
  const B2 = await phone(t, "B (reopened)", bStore); pages.push(B2);
  t.check("B reopened: same account", await B2.game(`ctx.player.id()`) === bPid);
  t.check("B reopened: the card says her name was reported", await B2.until(`/reported your name/.test((document.getElementById("screenCard") || {}).textContent || "")`, "the reported card", 30000));
  t.check("B's old name isn't shown any more", await B2.game(`ctx.player.name()`) !== nameB);
  const idea = (await B2.L(IDEAS))[0];
  await B2.L(`document.getElementById("acctIdea0").click()`);
  t.check("B picks a new one at once (no 30-day wait)", await B2.until(`ctx.player.name() === ${JSON.stringify(idea)}`, "B's new name", 20000));

  // ── CHANGE: within 30 days → refused with the date; after → fine ──
  await t.game(`L3.setState("title")`); await t.frames(10);
  const r1 = await t.game(`ctx.accounts.setName("zz_test_Again")`);
  t.check("changing within 30 days → wait (with the date)", r1.ok === false && r1.why === "wait" && r1.next > Date.now(), JSON.stringify(r1));
  await api("/acct/_clock", { offset: 31 * 86400000 });
  const newA = "zz_test_A" + "pqrstvwxyz"[Math.floor(Math.random() * 10)] + "q";
  const r2 = await t.game(`ctx.accounts.setName(${JSON.stringify(newA)})`);
  t.check("after 30 days the name changes", r2.ok === true && await t.game(`ctx.player.name()`) === newA, JSON.stringify(r2));
  await api("/acct/_clock", { offset: 0 });
  // ── NEW PHONE: the save code ──
  const code = await t.game(`ctx.player.backup.code()`);
  const D = await phone(t, "D (new phone)", null, undefined, Q0); pages.push(D);
  await D.until(`ctx.accounts.on`, "D: online");
  await D.game(`ctx.player.backup.restore(${JSON.stringify(code)})`);
  await sleep(1500);
  await D.until(`window.__lulu3d && __lulu3d.state === "title"`, "D: reloaded");
  t.check("new phone: the same account id", await D.game(`ctx.player.id()`) === await t.game(`ctx.player.id()`));
  t.check("new phone: the same name (from the server)", await D.until(`ctx.accounts.on && ctx.player.name() === ${JSON.stringify(newA)}`, "D: A's name", 30000));
  t.check("new phone: no name card (she has one)", (await D.frames(40), !await D.L(`!!document.getElementById("acctIdeas")`)));

  // ── DELETE ──
  t.check("delete my online account", await D.game(`ctx.accounts.deleteAccount()`) === true);
  const freed = await api("/acct/check?n=" + newA);
  t.check("…the server freed the name", freed.j && freed.j.ok === true, JSON.stringify(freed.j));
  t.check("…and no new account is made by itself", await D.game(`ctx.accounts.hello(true)`) === false && await D.game(`ctx.accounts.off`) === true);
  return relay;
}

/** A raw relay client in EVERYONE that sends a (forged) name ticket. */
function rawGhost(url, ticket) {
  let WS = globalThis.WebSocket;
  if (!WS) { try { WS = require("ws"); } catch (e) { WS = require("../../server/node_modules/ws"); } }
  const ws = new WS(url + "/room/LOBBY");
  let iv = null;
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: "j", v: 1, room: "LOBBY", name: "Kugel Kid", sk: "gold" }));
    iv = setInterval(() => { try { ws.send(JSON.stringify({ t: "s", d: { m: 0, x: 240, di: 0, sp: 0, vk: "car", w: ["", 410, 0, 0], un: ticket } })); } catch (e) { } }, 250);
  };
  return { close: () => { clearInterval(iv); try { ws.close(); } catch (e) { } } };
}
