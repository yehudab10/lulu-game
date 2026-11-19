// 📈 Perf harness: boots the representative scenes and records what the renderer and the JS
// side cost there, so an optimisation (or a regression) shows up as numbers, not a feeling.
//
//   scenes   cruise (a busy Cruise highway at noon) · rain (the same at night in a storm) ·
//            town (Lakewood's Main St) · rest (a rest-area lot) · foot (on foot on the highway) ·
//            interior (The Thirsty Scholar) · party (a 🌍 Free Roam convoy: two real pages on the
//            LOCAL relay) — each: draw calls, triangles (avg / max), textures, geometries, programs,
//            JS ms per frame split into update (everything in rAF but the render) and render, the
//            wall-clock frame, and DOM mutations per frame (HUD writes)
//   drive    a long Cruise drive (chunks streaming in and out) sampling renderer.info.memory,
//            programs, scene objects and the JS heap (after a forced GC): anything that keeps
//            growing is a leak. The checks fail on geometry / texture / material growth.
//
// Software WebGL in the container is slow — compare the numbers between runs (calls, tris, JS ms),
// not the fps. Math.random is seeded so two runs see the same road events.
//
//   node scripts/perf3d.js                       # this file, prints the table, writes smoke-shots/perf3d-<tier>.json
//   node scripts/perf3d.js --compare a.json b.json
//   PERF3D_TIER=low|medium|high|auto  PERF3D_DRIVE=<game seconds> (120 for the full 2-minute drive)
//   PERF3D_SCENES=cruise,rain,…  PERF3D_FRAMES=<frames per scene>  PERF3D_OUT=<file>  PERF3D_ADD=<features>  PERF3D_QUERY=<&flags>
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const TIER = process.env.PERF3D_TIER || "high";
const DRIVE = +(process.env.PERF3D_DRIVE || 40);
const FRAMES = +(process.env.PERF3D_FRAMES || 60);
const SCENES = (process.env.PERF3D_SCENES || "cruise,rain,rest,town,foot,interior,drive,party").split(",");
const FEATURES = "bloom,roadevents,cameos,banter,atmos,world,town,exits,law,feel,streets,rides,community,memory,hustle,play,foot,interiors,party,openworld";
const PORT = 25000 + (process.pid % 20000);
const RELAY = `ws://127.0.0.1:${PORT}`;
// (PERF3D_ADD: more features to enable, PERF3D_QUERY: more URL flags — e.g. PERF3D_ADD=seasons PERF3D_QUERY="&season=chanukah&night=8")
const Q = `&enable=${FEATURES}${process.env.PERF3D_ADD ? "," + process.env.PERF3D_ADD : ""}&mpurl=${encodeURIComponent(RELAY)}${process.env.PERF3D_QUERY || ""}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SETTINGS = { quality: TIER, vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "off", hud: 1, hudMode: "full", chatter: "normal" };

// Installed before the game's scripts: a seeded Math.random, a timer around every rAF callback
// (the JS work of a frame) and a DOM-mutation counter.
const PROBE = `(() => {
  let a = 1234567;
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const PF = window.__pfx = { on: false, js: 0, mut: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const t0 = performance.now(); try { cb(ts); } finally { if (PF.on) PF.js += performance.now() - t0; } });
  const mo = new MutationObserver(list => { if (PF.on) PF.mut += list.length; });
  document.addEventListener("DOMContentLoaded", () => mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }));
})()`;

let relay = null;
function startRelay() {
  return new Promise((resolve, reject) => {
    relay = spawn(process.execPath, [path.join(__dirname, "..", "..", "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ["ignore", "pipe", "pipe"] });
    let done = false;
    const ok = () => { if (!done) { done = true; resolve(); } };
    relay.stdout.on("data", d => { if (/listen/i.test(String(d))) ok(); });
    relay.on("error", reject);
    setTimeout(ok, 1500);
  });
}
process.on("exit", () => { try { relay && relay.kill(); } catch (e) { } });

module.exports = {
  name: "perf",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [], missiles: 0, shields: 0, pepperSpray: 0, mpName: "Perf Pal" },
  save3d: { best: 1000, settings: SETTINGS, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const R = { tier: TIER, when: new Date().toISOString(), viewport: "1280x720", frames: FRAMES, scenes: {}, drive: null };
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    // reload with the probe in place (seeded random from the very first script)
    await t.page.addInitScript(PROBE);
    if (!await t.boot()) return;
    const cdp = await t.page.context().newCDPSession(t.page);
    await cdp.send("HeapProfiler.enable").catch(() => { });
    const heapMB = async () => { try { await cdp.send("HeapProfiler.collectGarbage"); const h = await cdp.send("Runtime.getHeapUsage"); return +(h.usedSize / 1048576).toFixed(1); } catch (e) { return null; } };

    await t.L(`Promise.all([import("./js/core/ctx.js"), import("./js/core/driving.js")]).then(([m, d]) => {
      window.__perfDrive = 0;   // m/s: hold the lane at this speed (0 = hands off)
      m.hook("controls", (ctl, dt) => { if (window.__perfDrive > 0) Object.assign(ctl, d.autoDrive(dt, 5.25, window.__perfDrive)); }, 1001);
      m.hook("damage", () => false, 9999);     // nothing ends the measurement early
    })`);
    // one scene's numbers over n frames
    const measure = async (n = FRAMES) => {
      await t.L(`(() => { const r = __lulu3d.renderer;
        if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true;
          // (every render call's time counts — post passes too — but the draw counts are the game scene's own render)
          r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; const dt = performance.now() - t0; P.ren += dt;
            const C = __lulu3d.ctx; if (s !== C.scene && !(C.view && s === C.view.scene)) return; P.n++; P.rl.push(dt);
            P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, ren: 0, rl: [], calls: 0, tris: 0, maxCalls: 0, maxTris: 0, w0: performance.now() };
        Object.assign(window.__pfx, { on: true, js: 0, mut: 0 }); })()`);
      await t.frames(n);
      return t.L(`(() => { const P = window.__pf, X = window.__pfx, r = __lulu3d.renderer, L3 = __lulu3d; window.__pf = null; X.on = false;
        const sc = L3.ctx.view ? L3.ctx.view.scene : L3.ctx.scene; let meshes = 0, vis = 0, inst = 0, lights = 0, shadowLights = 0; const mats = new Set();
        sc.traverse(o => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { meshes++; if (o.isInstancedMesh) inst++; for (const m of [].concat(o.material)) if (m) mats.add(m); }
          if (o.isLight) { lights++; if (o.castShadow) shadowLights++; } });
        sc.traverseVisible(o => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) vis++; });
        return { frames: P.n, calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris,
          frameMs: +((performance.now() - P.w0) / P.n).toFixed(1), jsMs: +(X.js / P.n).toFixed(2), renderMs: +(P.ren / P.n).toFixed(2), renderMed: +P.rl.sort((a, b) => a - b)[P.rl.length >> 1].toFixed(2), updateMs: +((X.js - P.ren) / P.n).toFixed(2),
          domMut: +(X.mut / P.n).toFixed(1), textures: r.info.memory.textures, geometries: r.info.memory.geometries, programs: (r.info.programs || []).length,
          meshes, visible: vis, instanced: inst, materials: mats.size, lights, shadowLights, shadows: r.shadowMap.enabled, pixelRatio: r.getPixelRatio(),
          cars: L3.traffic.cars.length, state: L3.state }; })()`);
    };
    // what's on screen, grouped (named ancestor · material): draws (main pass) + triangles, the top 14 by draws
    const breakdown = () => t.L(`import("three").then(THREE => { const L3 = __lulu3d, cam = L3.ctx.view ? L3.ctx.view.camera : L3.ctx.camera, sc = L3.ctx.view ? L3.ctx.view.scene : L3.ctx.scene;
        const F = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); const by = {};
        sc.traverseVisible(o => { if (!(o.isMesh || o.isLine || o.isPoints)) return; if (o.frustumCulled && o.geometry && !(o.isInstancedMesh ? (o.boundingSphere || o.computeBoundingSphere() || o.boundingSphere) && F.intersectsSphere(o.boundingSphere.clone().applyMatrix4(o.matrixWorld)) : F.intersectsObject(o))) return;
          let a = o, name = ""; for (let i = 0; i < 6 && a && !name; i++) { name = a.name || (a.userData && a.userData.townLook ? "town:" + a.userData.townLook : ""); a = a.parent; }
          const mats = [].concat(o.material), k = (name || o.type) + " · " + (mats[0] && mats[0].name || (mats[0] && mats[0].type) || "");
          const g = o.geometry, n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0), ic = o.isInstancedMesh ? o.count : (g.isInstancedBufferGeometry ? g.instanceCount : 1);
          const b = by[k] || (by[k] = { draws: 0, tris: 0, shadow: 0 }); b.draws += Math.max(1, g.groups.length || 1); b.tris += Math.round(n / 3 * ic); if (o.castShadow) b.shadow++; });
        return Object.entries(by).sort((a, b) => b[1].draws - a[1].draws || b[1].tris - a[1].tris).slice(0, ${Math.max(14, +process.env.PERF3D_TOP || 0)}).map(([k, v]) => k + " = " + v.draws + "d/" + v.tris + "t" + (v.shadow ? "/" + v.shadow + "s" : "")); })`);
    const record = async (key, n) => { const m = await measure(n); if (process.env.PERF3D_TOP) { m.top = await breakdown(); for (const l of m.top) console.log(`      ${key}: ${l}`); } R.scenes[key] = m; console.log(`   PERF ${key} ${JSON.stringify(m)}`); await t.shot(`${TIER}-${key}`); return m; };
    const place = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.car.vF = ${v}; ctx.world.prebuild(${s}); ctx.cam.snap && ctx.cam.snap(); return true; })()`);
    const want = k => SCENES.includes(k);
    const toPlaying = async () => { if (await g(`L3.state !== "playing"`)) { await g(`L3.setState("playing")`); await t.frames(3); } };

    // ── a busy Cruise highway at noon ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
    await g(`(window.__perfDrive = 27, true)`);
    await t.frames(90);
    if (want("cruise")) await step("cruise", () => record("cruise"));

    // ── night + a storm ──
    if (want("rain")) await step("rain", async () => {
      await g(`(ctx.atmos.debug.time("night"), ctx.atmos.debug.weather("rain", 1, true), true)`);
      await t.frames(40);
      await record("rain");
      await g(`(ctx.atmos.debug.weather("clear", 1, true), ctx.atmos.debug.time("noon"), true)`);
      await t.frames(10);
    });

    // ── a rest-area lot ──
    if (want("rest")) await step("rest", async () => {
      await g(`(window.__perfDrive = 0, true)`);
      const RS = await g(`ctx.exits.debug.restAhead(500)`);
      if (!t.check("a rest area can be planned", typeof RS === "number", String(RS))) return;
      await place(RS + 40, 27, 0);
      await g(`(ctx.car.h = ctx.world.road.at(${RS} + 40).h, true)`);
      await t.frames(30);
      await record("rest");
      await place(RS + 900, 5.25, 20);
      await t.frames(10);
    });

    // ── Lakewood: Main St ──
    if (want("town")) await step("town", async () => {
      await g(`(window.__perfDrive = 0, true)`);
      await t.until(`__lulu3d.ctx.town.debug.S.loaded`, "town models loaded", 120000);
      await toPlaying();
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active`, "into Lakewood", 10000)) return;
      await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
      await g(`ctx.town.debug.place("Main St", 60, 1.75, 0, 1)`);
      await t.frames(40);
      await record("town");
      await g(`ctx.town.leave("reset")`);
      await t.frames(10);
      await toPlaying();
    });

    // ── on foot on the highway ──
    if (want("foot")) await step("foot", async () => {
      await g(`(window.__perfDrive = 0, true)`);
      await toPlaying();
      await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 30, p = r.point(s, 7.7, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; return true; })()`);
      await t.frames(5);
      await g(`ctx.foot.start("droveOff", { noIntro: true })`);
      if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 30000)) return;
      await t.stick(0, -1);
      await t.frames(20);
      await record("foot");
      await t.stick(0, 0);
    });

    // ── an interior (the bar) ──
    if (want("interior")) await step("interior", async () => {
      await g(`(window.__perfDrive = 0, window.__out = 0, ctx.interiors.bar.enter({ exit: () => { window.__out = 1; } }), true)`);
      if (!await t.until(`window.__interiors && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.fadeIn >= 1`, "the bar loads", 60000)) return;
      await t.stick(0.4, -1);
      await t.frames(10);
      await record("interior");
      await t.stick(0, 0);
    });

    // ── a long drive: does anything keep growing as chunks stream in and out? ──
    if (want("drive")) await step("drive", async () => {
      await g(`L3.setState("title")`);
      await t.frames(5);
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing"`, "the drive starts")) return;
      await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(false), ctx.law && ctx.law.hold && ctx.law.hold(9999), window.__perfDrive = 34, true)`);
      await t.page.setViewportSize({ width: 480, height: 270 });   // (the leak drive is about memory, not pixels)
      await t.frames(60);
      // leak tracker: every geometry / material / texture seen in the scene, by where it was (its named ancestors);
      // later: the ones no longer in the scene and never disposed are orphans (they hold GPU memory forever)
      await t.L(`import("three").then(THREE => { if (window.__lk) return; const K = window.__lk = { seen: new Map(), disposed: new Set(), top: null };
        for (const C of [THREE.BufferGeometry, THREE.Material, THREE.Texture]) { const d = C.prototype.dispose; C.prototype.dispose = function () { K.disposed.add(this.uuid); return d.apply(this, arguments); }; }
        const path = o => { const p = []; for (let a = o; a && p.length < 4; a = a.parent) if (a.name) p.push(a.name); return (p.reverse().join("/") || o.type); };
        // (a texture's size / a material's map size + colour: tells a sign face from a billboard from a prop)
        const desc = x => { const im = x.isTexture ? x.image : x.map && x.map.image; return (im && im.width ? " " + im.width + "×" + im.height : "") + (x.isMaterial && x.color ? " #" + x.color.getHexString() : ""); };
        K.scan = () => { const live = new Set(), top = {}; const sc = __lulu3d.ctx.scene;
          const key = ch => { if (ch.name) return ch.name; let f = ""; ch.traverse(o => { if (!f && o !== ch && o.name) f = o.name; }); return ch.type + (f ? "<" + f + ">" : ""); };
          const count = (k, ch) => { let n = 0; ch.traverse(() => n++); const e = top[k] || (top[k] = [0, 0]); e[0]++; e[1] += n; };
          for (const ch of sc.children) { if (ch.name === "chunk") { for (const c2 of ch.children) count("chunk>" + key(c2), c2); } else count(key(ch), ch); }
          sc.traverse(o => { const add = (x, kind) => { if (!x || !x.uuid) return; live.add(x.uuid); if (!K.seen.has(x.uuid)) K.seen.set(x.uuid, { kind, at: path(o) + " · " + (kind === "geo" ? (x.type || "") : (x.name || x.type)) + desc(x) }); };
            if (o.geometry) add(o.geometry, "geo"); for (const m of [].concat(o.material || [])) { add(m, "mat"); if (m) for (const k of ["map", "emissiveMap", "alphaMap", "normalMap"]) if (m[k]) add(m[k], "tex"); } });
          return { live, top }; };
        K.orphans = () => { const { live, top } = K.scan(); const by = {}; for (const [u, v] of K.seen) if (!live.has(u) && !K.disposed.has(u)) { const k = v.kind + " " + v.at; by[k] = (by[k] || 0) + 1; }
          return { by: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 14), top }; };
        setInterval(() => K.scan(), 700); })`);
      const sample = async () => Object.assign(await g(`(() => { const r = L3.renderer; let objs = 0; const mats = new Set(); ctx.scene.traverse(o => { objs++; if (o.material) for (const m of [].concat(o.material)) mats.add(m); });
          return { t: +ctx.G.runTime.toFixed(0), s: Math.round(ctx.car.s), chunks: ctx.world.chunks.size, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: (r.info.programs || []).length, objects: objs, materials: mats.size, cars: ctx.traffic.cars.length, actors: (ctx.actors || []).length }; })()`), { heapMB: await heapMB() });
      const S = [await sample()];
      const top0 = await t.L(`window.__lk ? window.__lk.scan().top : {}`);
      const N = Math.max(2, Math.round(DRIVE / 10));
      let hops = 0;
      for (let i = 0; i < N; i++) {
        await t.frames(300); S.push(await sample());
        // held up (a toll, a train, a parade…): hop on, the drive is about chunks streaming
        const a = S[S.length - 2], b = S[S.length - 1];
        if (b.s - a.s < 120) { hops++; await place(b.s + 300, 5.25, 25); await t.frames(5); }
      }
      R.hops = hops;
      await g(`(window.__perfDrive = 0, true)`);
      await t.page.setViewportSize({ width: 1280, height: 720 });
      R.drive = S;
      const lk = await t.L(`window.__lk ? window.__lk.orphans() : null`);
      if (lk) { R.orphans = lk.by; console.log("   ORPHANS (left the scene, never disposed): " + JSON.stringify(lk.by)); const z = [0, 0];
        R.growth = Object.entries(lk.top).map(([k, n]) => [k, (top0[k] || z).join("×"), n.join("×"), n[1] - (top0[k] || z)[1]]).filter(e => e[3] > 0).sort((a, b) => b[3] - a[3]).slice(0, 20);
        console.log("   SCENE growth (what [entries × objects] start → end): " + JSON.stringify(R.growth)); }
      for (const s of S) console.log(`   DRIVE ${JSON.stringify(s)}`);
      // the first sample is after the start's chunks are built; compare the steady second half
      const mid = S[Math.floor(S.length / 2)], end = S[S.length - 1];
      const dist = end.s - S[0].s;
      t.check("the drive streamed chunks", dist > DRIVE * 12, `${dist} m`);
      // a LEAK = something that left the scene and was never disposed (pooled traffic cars park a few here: that's fine).
      // What's live in the scene can grow with what's on the road (events, people, pools) — logged above, not a failure.
      const orphan = kind => (lk ? lk.by : []).filter(([k]) => k.startsWith(kind + " ")).reduce((a, [, n]) => a + n, 0);
      t.check("no geometry leak: ≤ 30 geometries left the scene undisposed", orphan("geo") <= 30, String(orphan("geo")));
      t.check("no material leak: ≤ 40 materials left the scene undisposed", orphan("mat") <= 40, String(orphan("mat")));
      t.check("no texture leak: ≤ 6 textures left the scene undisposed", orphan("tex") <= 6, String(orphan("tex")));
      t.check("textures stay flat over the second half of the drive (≤ +8)", end.textures - mid.textures <= 8, `${mid.textures} → ${end.textures}`);
    });

    // ── a 🎉 party: Free Roam convoy on the highway (two real pages on the LOCAL relay) ──
    if (want("party")) await step("party", async () => {
      await startRelay();
      let guest = null;
      try {
        await g(`(ctx.town.active && ctx.town.leave("reset"), L3.state !== "title" && L3.setState("title"), true)`);
        await t.frames(6);
        await t.click(/Party with friends/);
        await t.click(/Host a party/);
        if (!await t.until(`__lulu3d.state === "partyLobby" && __lulu3d.ctx.party.connected && __lulu3d.ctx.party.isHost`, "host: lobby", 60000)) return;
        const code = await g(`ctx.party.code`);
        const browser = t.page.context().browser();
        guest = await browser.newPage({ viewport: { width: 480, height: 270 } });
        await guest.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
        await guest.addInitScript(() => { if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify({ totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" })); sessionStorage.setItem("__seeded", "1"); });
        const base = t.page.url().split("/3d/")[0];
        await guest.goto(`${base}/3d/?test${Q}&party=${code}`);
        const gUntil = async (code, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await guest.evaluate(`(() => { try { const ctx = window.__lulu3d && __lulu3d.ctx; return !!(${code}); } catch (e) { return false; } })()`).catch(() => false)) return true; await sleep(200); } return false; };
        if (!t.check("the friend joins from the link", await gUntil(`ctx.state === "partyLobby" && ctx.party.connected`))) return;
        await t.until(`__lulu3d.ctx.party.players.length === 2`, "two in the lobby", 60000);
        await t.L(`document.getElementById("pt_act_roam") && document.getElementById("pt_act_roam").click()`);
        await sleep(300);
        await t.L(`document.getElementById("pt_go") && document.getElementById("pt_go").click()`);
        if (!await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.party.activity.k === "roam"`, "free roam: GO", 60000)) return;
        await gUntil(`ctx.state === "playing"`, 60000);
        await g(`(window.__perfDrive = 22, true)`);
        await guest.evaluate(`import("./js/core/ctx.js").then(m => import("./js/core/driving.js").then(d => m.hook("controls", (ctl, dt) => Object.assign(ctl, d.autoDrive(dt, 1.75, 22)), 1001)))`);
        await t.frames(60);
        t.check("the friend's car is in my world", await g(`ctx.party.players.length === 2`));
        await record("party");
        await g(`(window.__perfDrive = 0, true)`);
      } finally {
        if (guest) { try { await guest.close(); } catch (e) { } }
        try { relay.kill(); } catch (e) { }
      }
    });

    // the table + the JSON
    const keys = ["calls", "maxCalls", "tris", "jsMs", "updateMs", "renderMs", "frameMs", "domMut", "textures", "geometries", "programs", "visible", "materials"];
    console.log(`   ${"scene".padEnd(9)}${keys.map(k => k.padStart(11)).join("")}`);
    for (const [k, m] of Object.entries(R.scenes)) console.log(`   ${k.padEnd(9)}${keys.map(c => String(m[c]).padStart(11)).join("")}`);
    const out = process.env.PERF3D_OUT || path.join(__dirname, "..", "..", "smoke-shots", `perf3d-${TIER}.json`);
    try { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(R, null, 1)); console.log(`   (wrote ${path.relative(process.cwd(), out)})`); } catch (e) { }
    t.check("every scene measured", SCENES.filter(k => k !== "drive").every(k => R.scenes[k]), Object.keys(R.scenes).join(","));
  },
};
