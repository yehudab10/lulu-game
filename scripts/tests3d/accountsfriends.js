// 🪪👯 FRIENDS THAT WORK OFFLINE (ci/accounts stage 2) — real pages, some CLOSED and REOPENED, against the LOCAL relay.
//   REQUEST    A types B's name in 👯 › Add a friend by name while B's page is CLOSED → "Sent!"; B reopens → a quiet
//              badge on 👯 (no pop-up) → 👯 lists "A wants to be friends" → Be friends; A's page (closed meanwhile)
//              reopens → B is on A's list under B's name; their sealed cards cross on the server → A can knock at B's
//              doorbell (presence: "playing")
//   DECLINE    C asks A, A says no thanks → nothing tells C; C asking again doesn't reach A
//   BLOCK      B blocks C (from C's request) → C's next ask never arrives; the block is on the server
//   REMOVE     A removes B → B's list drops A after its next hello
//   WHO        A sets "Nobody" → D's ask is refused ("They aren't taking friend requests.")
//   MIGRATION  E and F were friends on their phones before accounts: E updates first (nothing lost, nothing shown on
//              the server yet), then F → the server has the friendship; both keep each other
const { startRelay, waitOn, framesOn, setWallCap } = require("../lib/party3d.js");
const PORT = 31500 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const HTTP = `http://127.0.0.1:${PORT}`;
const Q = `&enable=multiplayer,party,openworld,foot,atmos,phone,friends&mpurl=${encodeURIComponent(URL)}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const POPS = `[...document.querySelectorAll(".toast, #banner:not(.hidden), #frChip, #owChip")].filter(e => e.offsetParent !== null).map(e => e.textContent).join(" | ")`;
const letters = n => Array.from({ length: n }, () => "abcdefghjkmnpqrstvwxyz"[Math.floor(Math.random() * 22)]).join("");

async function phone(t, label, store) {
  const browser = t.page.context().browser();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { const x = m.text(); if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(x)) errors.push(x); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(({ store }) => {
    if (!sessionStorage.getItem("__seeded")) for (const k in store) if (store[k] != null) localStorage.setItem(k, store[k]);
    sessionStorage.setItem("__seeded", "1");
  }, { store: store || { luluSaveV2: JSON.stringify({ totalCoins: 0, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Latke Legend" }) } });
  const base = t.page.url().split("/3d/")[0];
  await page.goto(`${base}/3d/?test${Q}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`);
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
    async close() { const s = await P.storage(); await page.close(); return s; },
  };
  await P.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots to the title");
  await P.until(`ctx.accounts.on`, "account up");
  return P;
}
async function named(P, base) {
  const n = (base + letters(5)).slice(0, 15);
  const r = await P.game(`ctx.accounts.setName(${JSON.stringify(n)})`);
  return r && r.ok ? n : null;
}
async function play(P) {
  await P.game(`L3.startRun({ mode: "cruise", quick: true })`);
  await P.until(`__lulu3d.state === "playing"`, `${P.label}: drives`);
  await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.G.invT = 999, ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
}
const inList = (P, fid) => P.game(`ctx.friends.list.some(f => f.f === ${JSON.stringify(fid)})`);

module.exports = {
  name: "accountsfriends",
  viewport: { width: 640, height: 360 },
  query: "",
  async run(t) {
    setWallCap(10 * 60000);
    const relay = await startRelay(PORT);
    const pages = [];
    const open = async (label, store) => { const P = await phone(t, label, store); pages.push(P); return P; };
    const close = async P => { pages.splice(pages.indexOf(P), 1); t.check(`${P.label}: no page errors`, P.errors.length === 0, P.errors.slice(0, 3).join(" | ").slice(0, 600)); return P.close(); };
    try {
      // ── REQUEST while B is closed ──
      let A = await open("A"), B = await open("B");
      const nameA = await named(A, "zz_test_A"), nameB = await named(B, "zz_test_B");
      t.check("A and B have names", !!nameA && !!nameB);
      const idA = await A.game(`ctx.player.id()`), idB = await B.game(`ctx.player.id()`);
      let bStore = await close(B);
      await play(A);
      await A.game(`(ctx.phone.openPhone("friends", { add: 1 }), true)`);
      await A.until(`!!document.getElementById("frName")`, "👯 › Add a friend by name");
      await A.page.fill("#frName", nameB.toLowerCase());
      await A.L(`document.getElementById("frSendName").click()`);
      t.check("A: 'Sent! They'll see it next time they play.'", await A.until(`/Sent!/.test((document.getElementById("frAddMsg") || {}).textContent || "")`, "the sent line", 30000));
      await A.game(`ctx.phone.closePhone && ctx.phone.closePhone()`);
      let aStore = await close(A);
      B = await open("B (reopened)", bStore);
      t.check("B reopened: a badge of 1 on 👯", await B.until(`ctx.friends.badge === 1`, "the badge", 30000));
      t.check("…and no pop-up about it", !/friend/i.test(await B.L(POPS)), await B.L(POPS));
      await play(B);
      await B.game(`(ctx.phone.openPhone("friends"), true)`);
      t.check("B: 👯 lists 'A wants to be friends'", await B.until(`[...document.querySelectorAll("[data-rq]")].some(b => b.textContent.includes(${JSON.stringify(nameA)}))`, "the request row", 20000));
      await B.L(`document.querySelector("[data-rq]").click()`);
      await B.until(`!!document.getElementById("frRy")`, "the request page");
      await B.L(`document.getElementById("frRy").click()`);
      t.check("B: A is on B's list (under A's name)", await B.until(`ctx.friends.list.some(f => f.f === ${JSON.stringify(idA)} && f.label === ${JSON.stringify(nameA)})`, "A on B's list", 30000));
      t.check("B: the badge is gone", await B.game(`ctx.friends.badge`) === 0);
      A = await open("A (reopened)", aStore);
      t.check("A reopened: B is on A's list under B's name", await A.until(`ctx.friends.list.some(f => f.f === ${JSON.stringify(idB)} && f.label === ${JSON.stringify(nameB)})`, "B on A's list", 30000));
      // the sealed cards cross (A posts at its hello; B picks it up at ITS next hello)
      await A.until(`ctx.friends.server && (() => { const f = ctx.friends.list.find(x => x.f === ${JSON.stringify(idB)}); return !!f; })()`, "A has B");
      await B.game(`ctx.accounts.hello(true)`); await sleep(800); await A.game(`ctx.accounts.hello(true)`); await sleep(800); await B.game(`ctx.accounts.hello(true)`);
      const ready = P => P.game(`import("./js/features/friends/store.js").then(m => m.S.list.filter(m.ready).map(f => f.f))`).catch(() => []);
      t.check("both have each other's doorbell (sealed cards crossed on the server)", await A.until(`true`, "") && (await (async () => { for (let k = 0; k < 20; k++) { const a = await A.L(`import("./js/features/friends/store.js").then(m => m.S.list.filter(m.ready).map(f => f.f))`), b = await B.L(`import("./js/features/friends/store.js").then(m => m.S.list.filter(m.ready).map(f => f.f))`); if (a.includes(idB) && b.includes(idA)) return true; await A.game(`ctx.accounts.hello(true)`); await B.game(`ctx.accounts.hello(true)`); await sleep(700); } return false; })()));
      // presence: B in the world (doorbell open) → A's knock says "playing"
      await B.game(`(ctx.phone.closePhone && ctx.phone.closePhone(), true)`);
      t.check("A knocks: B is playing (the doorbell works for a friendship made on the server)", await A.until(`(ctx.friends.check(), (ctx.friends.list.find(f => f.f === ${JSON.stringify(idB)}) || {}).presence?.on === true)`, "B on", 60000));

      // ── DECLINE ──
      const C = await open("C"); const nameC = await named(C, "zz_test_C"); const idC = await C.game(`ctx.player.id()`);
      t.check("C asks A", await C.game(`ctx.friends.askByName(${JSON.stringify(nameA)})`) === "sent");
      await A.until(`ctx.accounts.hello(true).then(() => 0) && ctx.friends.badge === 1`, "A gets C's request", 30000);
      t.check("A says no thanks", await A.game(`ctx.friends.answer(${JSON.stringify(idC)}, false)`) === "declined");
      t.check("…C isn't told (still waiting)", await C.until(`ctx.accounts.hello(true).then(() => 0) && ctx.friends.requests.outReq.some(r => r.f === ${JSON.stringify(idA)})`, "C still waiting", 20000));
      await C.game(`ctx.friends.askByName(${JSON.stringify(nameA)})`);
      await A.game(`ctx.accounts.hello(true)`); await sleep(500);
      t.check("…asking again doesn't reach A", await A.game(`ctx.friends.badge`) === 0);

      // ── BLOCK (from a request) ──
      await C.game(`ctx.friends.askByName(${JSON.stringify(nameB)})`);
      await B.until(`ctx.accounts.hello(true).then(() => 0) && ctx.friends.badge === 1`, "B gets C's request", 30000);
      await B.game(`(ctx.friends.answer(${JSON.stringify(idC)}, false), ctx.friends.block(${JSON.stringify(idC)}, ""), true)`);
      await sleep(1500);
      const bl = await fetch(HTTP + "/acct/check?n=" + nameC).then(r => r.json());
      t.check("B's block is on the server", await B.until(`ctx.accounts.hello(true).then(() => 0) && (ctx.accounts.view.blocks || []).some(b => b.f === ${JSON.stringify(idC)})`, "the server block", 20000), JSON.stringify(bl));
      await C.game(`ctx.friends.cancel(${JSON.stringify(idB)})`); await sleep(500);
      await C.game(`ctx.friends.askByName(${JSON.stringify(nameB)})`);
      await B.game(`ctx.accounts.hello(true)`); await sleep(500);
      t.check("…C's next ask never arrives", await B.game(`ctx.friends.badge`) === 0);

      // ── WHO ──
      await A.game(`ctx.friends.setWho("nobody")`);
      // (a fresh asker: C was already declined by A, and a declined ask stays a silent "sent")
      const Dx = { pid: Array.from({ length: 16 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)]).join(""), sec: Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("") };
      const post = (p, b) => fetch(HTTP + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
      await post("/acct/hello", Dx); await sleep(500); await post("/acct/name", { ...Dx, name: ("zz_test_D" + letters(5)).slice(0, 15) }); await sleep(500);
      const nob = await post("/acct/ask", { ...Dx, to: nameA });
      t.check("'Nobody' → refused ('They aren't taking friend requests.')", nob && nob.why === "closed", JSON.stringify(nob));
      await A.game(`ctx.friends.setWho("everyone")`);

      // ── REMOVE ──
      await A.game(`ctx.friends.remove(${JSON.stringify(idB)})`);
      t.check("A removes B → gone from A", !await inList(A, idB));
      t.check("…and from B after its next hello", await B.until(`ctx.accounts.hello(true).then(() => 0) && !ctx.friends.list.some(f => f.f === ${JSON.stringify(idA)})`, "B drops A", 30000));
      await A.game(`ctx.accounts.hello(true)`); await sleep(600);
      t.check("…and doesn't come back on A", !await inList(A, idB));

      // ── MIGRATION of an on-device friendship ──
      const E = await open("E"), F = await open("F");
      const idE = await E.game(`ctx.player.id()`), idF = await F.game(`ctx.player.id()`);
      const bellE = await E.L(`import("./js/features/friends/store.js").then(m => m.me().bell)`), bellF = await F.L(`import("./js/features/friends/store.js").then(m => m.me().bell)`);
      const secret = "A".repeat(43);
      const inject = (P, fid, bell) => P.L(`import("./js/features/friends/store.js").then(m => { m.S.list.push({ f: ${JSON.stringify(fid)}, n: "Kugel Kid", sk: "pink", b: ${JSON.stringify(bell)}, s: ${JSON.stringify(secret)}, at: Date.now() }); return import("./js/core/save.js").then(s => { s.saveNow(); return true; }); })`);
      await inject(E, idF, bellF); await inject(F, idE, bellE);
      const fStore = await close(F);
      await E.game(`ctx.accounts.hello(true)`); await sleep(600);
      t.check("E updated first: E keeps F; the server only has E's claim", await inList(E, idF) && await E.game(`(ctx.accounts.view.claims || []).includes(${JSON.stringify(idF)}) && !ctx.accounts.view.friends.length`));
      const F2 = await open("F (updated)", fStore);
      await F2.until(`(ctx.accounts.view.friends || []).some(f => f.f === ${JSON.stringify(idE)})`, "F: the server has E", 30000);
      t.check("F updates too → the server has the friendship", await F2.game(`ctx.accounts.view.friends.some(f => f.f === ${JSON.stringify(idE)})`));
      t.check("both keep each other (with the old doorbells + secret)", await inList(F2, idE) && await E.until(`ctx.accounts.hello(true).then(() => 0) && ctx.friends.list.some(f => f.f === ${JSON.stringify(idF)})`, "E keeps F") && await F2.L(`import("./js/features/friends/store.js").then(m => { const f = m.friend(${JSON.stringify(idE)}); return !!f && f.s === ${JSON.stringify(secret)} && f.sv === 1; })`));
    } catch (e) {
      t.check("accountsfriends threw", false, String(e && e.stack || e).slice(0, 500));
    } finally {
      for (const g of pages) { t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).join(" | ").slice(0, 600)); try { await g.page.close(); } catch (e) { } }
      relay.kill();
    }
  },
};
