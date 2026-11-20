// 🐞 The QA WATCHDOG (scripts/tests3d/qa*.js): a test-side per-frame monitor for the glitches a player sees.
// It lives in the test page only (no cost in the shipped game). Install it once after boot:
//
//   const W = require("../lib/qawatch.js");
//   await W.install(t);                 // starts watching
//   … drive a flow …
//   const r = await W.report(t);        // { issues: [{ kind, f, state, msg }], counts }
//   W.check(t, "the home start", r);    // one ✓ / ✗ per kind of glitch, the first few as detail
//   await W.reset(t);                   // start a new segment
//
// What it flags (each once per episode, with the frame + state):
//   jump      Lulu (on foot), the car (driving) or the camera (outside a skippable cutscene: its cuts are editing) moved
//             more than a few metres in ONE frame while no
//             declared cut covered it (the soft-cut overlay, an opaque fade, a set on screen, a state change that frame)
//   nan       a NaN / Infinity position (Lulu, the car, the camera)
//   overlay   a full-screen opaque overlay (any fixed element covering the screen: #townFade, #footWash, #intFade,
//             #cameosFade, #lawFade, #softCut, the loading card…) up for more than 4 s, or up while she has control
//   flat      the rendered picture is one flat colour while she's in the world (camera inside something / looking at nothing)
//   underground  the camera below the ground
//   inwall    the camera inside a solid collider (on foot: a circle collider ≥ 0.8 m of the active chunks — a thin pole or a
//             street tree's trunk doesn't count, the game's camera brushes past those on purpose — / a town block)
//   hidden    Lulu (on foot, walking) or the car (driving) invisible for more than ~1/3 s while she has control
//   stuck     a state that isn't a free-roaming one (playing / footRun / interior / title) lasting more than 60 s
//   nocontrol control taken away for more than 4 s outside a skippable scene / a dialog / a set / the pause menu
//   invisible the stick pushed hard for ~2/3 s, she isn't moving, and nothing solid (a collider, a car) is within reach
//   inside    Lulu standing inside a solid collider (circle / town block) for more than ~1/2 s while walking
//
// W.opts (page-side window.__qa.opts) tune the thresholds; W.allow(t, kind, re) ignores a known, explained case.
const SRC = String.raw`
(() => {
  if (window.__qa) return true;
  const L3 = window.__lulu3d, ctx = L3.ctx;
  const Q = window.__qa = {
    on: true, issues: [], counts: {}, ep: {}, last: null, f: -1, overlayF: 0, overlayCtl: 0, hidF: 0, insideF: 0,
    stateSince: 0, pushF: 0, leafF: 0, stateName: null, noCtl: 0, prevState: null, stateChangeF: -9, cutF: -9, notes: [], allow: [],
    opts: { footJump: 3.0, carJump: 4.0, camJump: 5.0, overlaySecs: 4, stuckSecs: 60, noCtlSecs: 4, flatEvery: 12, flatStd: 3.0 },
  };
  const flag = (kind, msg, key = kind) => {
    if (Q.allow.some(a => a.kind === kind && a.re.test(msg))) return;
    Q.counts[kind] = (Q.counts[kind] || 0) + 1;
    // one entry per episode: the same key again within 60 frames extends it
    const e = Q.ep[key];
    if (e && ctx.frames - e.lastF < 60) { e.lastF = ctx.frames; e.n++; return; }
    const it = { kind, f: ctx.frames, t: +ctx.time.toFixed(2), state: ctx.state, msg, n: 1, lastF: ctx.frames };
    Q.ep[key] = it;
    if (Q.issues.length < 400) Q.issues.push(it);
  };
  Q.flag = flag;
  // declared cuts: a town swap (the real ramp hides it behind a soft cut; a test's ctx.town.enter() doesn't)
  for (const ev of ["town:enter", "town:leave"]) L3.on(ev, () => { Q.cutF = ctx.frames + 1; });
  const fin = v => v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  const P = v => v ? [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)] : null;
  const covered = () => {
    // an opaque full-screen element (≥ 90 % of the screen, opacity × background alpha ≥ 0.5)
    const W = innerWidth, H = innerHeight, out = [];
    for (const el of document.querySelectorAll("body > *, #screen")) {
      if (!el.getBoundingClientRect) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || (cs.position !== "fixed" && cs.position !== "absolute")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < W * 0.9 || r.height < H * 0.9) continue;
      let op = 1;
      for (let n = el; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity;
      if (op < 0.5) continue;
      let solid = el.tagName === "CANVAS" && el.id !== "scene" && el.id !== "gx";
      const bg = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (bg) { const a = bg[1].split(",").map(Number); if ((a.length < 4 || a[3] >= 0.6)) solid = true; }
      if (cs.backgroundImage && cs.backgroundImage !== "none" && !/gradient/.test(cs.backgroundImage)) solid = true;
      if (solid) out.push(el.id || el.className || el.tagName);
    }
    return out;
  };
  Q.covered = covered;
  const control = () => {
    if (ctx.paused || ctx.dialogOpen || ctx.view || ctx.skipping) return false;
    if (L3.H && L3.H.screenOpen && L3.H.screenOpen()) return false;
    if (ctx.state === "playing" || ctx.state === "worldPullOut") return true;
    if (ctx.state === "footRun") { const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F; return !!(F && (F.phase === "walk" || F.phase === "hotwire")); }
    return false;
  };
  Q.control = control;
  const softCutUp = () => { const s = document.getElementById("softCut"); return !!(s && s.style.display === "block" && +s.style.opacity > 0.05); };
  const gl = () => ctx.renderer && ctx.renderer.getContext();
  const px = new Uint8Array(4);
  function flatFrame() {
    const g = gl(); if (!g) return null;
    const cv = ctx.renderer.domElement, w = g.drawingBufferWidth, h = g.drawingBufferHeight;
    const prev = g.getParameter(g.FRAMEBUFFER_BINDING);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    const lum = [];
    for (let i = 1; i <= 5; i++) for (let j = 1; j <= 7; j++) {
      g.readPixels(Math.floor(w * j / 8), Math.floor(h * i / 6), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
      lum.push(0.3 * px[0] + 0.59 * px[1] + 0.11 * px[2]);
    }
    g.bindFramebuffer(g.FRAMEBUFFER, prev);
    const m = lum.reduce((a, b) => a + b, 0) / lum.length;
    const sd = Math.sqrt(lum.reduce((a, b) => a + (b - m) * (b - m), 0) / lum.length);
    return { m: +m.toFixed(1), sd: +sd.toFixed(2) };
  }
  Q.flatFrame = flatFrame;
  // town blocks (world rects) + the chunk circles round a point
  function solidAt(x, z, y = 1.0, pad = 0, minR = 0) {
    const w = ctx.world; if (!w) return null;
    for (const ch of w.activeChunks()) for (const c of ch.colliders || []) {
      if (c.off || c.r < minR) continue;
      // (heights as the game's camera clip sees them: a house 7.5 m, anything else solid 4.5 m, low things their own)
      const low = { bench: 0.55, chair: 0.5, rail: 0.8, car: 0.95 }, top = c.kind === "car" && c.r > 1.1 ? 4.5 : (low[c.kind] != null ? low[c.kind] : c.kind === "house" ? 7.5 : 4.5);
      if (y > top) continue;
      if (c.kind === "house" && ctx.town && ctx.town.active) continue;     // (a town block's ring stands in front of its houses: the block rects below are the wall)
      const dx = x - c.x, dz = z - c.z, cr = c.kind === "island" ? Math.min(c.r, 2.8) : c.r;     // (the circle's lawn: only its statue stands tall)
      if (dx * dx + dz * dz < (cr - pad) * (cr - pad)) return "circle:" + (c.kind || "?") + "@" + c.x.toFixed(1) + "," + c.z.toFixed(1) + " r" + c.r.toFixed(1);
    }
    const T = ctx.town;
    if (T && T.active) {
      const pl = T.plan, Lc = pl && pl.local ? pl.local(x, z, {}) : null;
      if (Lc) for (const r of pl.OCCLUDERS) {
        const lx = Lc.x, lz = Lc.z;
        if (lx > r.x0 + pad && lx < r.x1 - pad && lz > r.z0 + pad && lz < r.z1 - pad) return "block@" + ((r.x0 + r.x1) / 2).toFixed(0) + "," + ((r.z0 + r.z1) / 2).toFixed(0);
      }
    }
    return null;
  }
  Q.solidAt = solidAt;
  function tick() {
    requestAnimationFrame(tick);
    if (!Q.on || !ctx.world || !ctx.car) return;
    const f = ctx.frames;
    if (f === Q.f) return;
    const dF = f - Q.f; Q.f = f;
    // (in a 🎉 party friends' cars move on the REAL clock: on a crawling test page a friend's car you ride in covers
    //  speed × real time between two frames — allow for that, up to a fast car's 45 m/s)
    const wNow = performance.now(), realDt = Q.wLast ? (wNow - Q.wLast) / 1000 : 0; Q.wLast = wNow;
    const rt = ctx.party && ctx.party.active ? Math.max(1, 45 * realDt / Q.opts.carJump) : 1;
    const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F;
    const foot = ctx.state === "footRun" && F && F.pos ? F.pos : null;
    const car = ctx.car.pos, camP = ctx.camera.position;
    const st = ctx.state;
    if (st !== Q.stateName) { Q.prevState = Q.stateName; Q.stateName = st; Q.stateSince = ctx.time; Q.stateChangeF = f; }
    const cov = covered();
    const soft = softCutUp();
    if (soft || cov.length || ctx.view) Q.cutF = f;
    // (a wall came between her and the camera: it comes in at once, by design — like any third-person game)
    const cd = ctx.cam && ctx.cam.free ? ctx.cam.free.clipD : 99, ccd = ctx.cam && ctx.cam.carClipD != null ? ctx.cam.carClipD : 99;
    if ((Q.clipD != null && cd < Q.clipD - 2) || (Q.carClipD != null && ccd < Q.carClipD - 2)) Q.cutF = f;
    Q.clipD = cd; Q.carClipD = ccd;
    if (ctx.cam && ctx.cam.mode !== Q.camMode) { if (Q.camMode != null) Q.cutF = f; Q.camMode = ctx.cam.mode; }     // (△ / Y: another camera view is a cut)
    const cutNear = f - Q.cutF <= 2 || f - Q.stateChangeF <= 2 || ctx.skipping;
    // NaN
    for (const [n, v] of [["lulu", foot], ["car", car], ["camera", camP]]) if (v && !fin(v)) flag("nan", n + " position is not a number", "nan:" + n);
    // one-frame jumps
    const cur = { foot: foot ? foot.clone() : null, car: car.clone(), cam: camP.clone(), st, view: !!ctx.view };
    if (Q.last && dF === 1 && !cutNear && !Q.last.view && !cur.view) {
      const d = (a, b) => a && b ? Math.hypot(a.x - b.x, a.z - b.z) : 0;
      const df = d(cur.foot, Q.last.foot), dc = d(cur.car, Q.last.car), dk = cur.cam.distanceTo(Q.last.cam);
      if (cur.foot && Q.last.foot && df > Q.opts.footJump) flag("jump", "Lulu moved " + df.toFixed(1) + " m in one frame " + JSON.stringify(P(Q.last.foot)) + "→" + JSON.stringify(P(cur.foot)) +
        " (phase " + F.phase + ", s " + (+F.s).toFixed(1) + ", d " + (+F.d).toFixed(1) + ", town " + !!(ctx.town && ctx.town.active) + ", road " + (ctx.world.road === ctx.world.highway ? "highway" : "district") + ")", "jump:foot");
      if (st === "playing" && Q.last.st === "playing" && dc > Q.opts.carJump * rt) flag("jump", "the car moved " + dc.toFixed(1) + " m in one frame " + JSON.stringify(P(Q.last.car)) + "→" + JSON.stringify(P(cur.car)), "jump:car");
      const cutscene = (() => { const d = ctx.states[st] || {}; return typeof d.skip === "function" ? d.skip() : !!d.skip; })() || (ctx.cutscene && ctx.cutscene.active());
      // (a cutscene's single cut is editing; the camera covering > 5 m a frame for 4+ frames running is a SWOOP — through
      //  whatever stands between — anywhere)
      Q.swoopF = dk > Q.opts.camJump * rt ? (Q.swoopF || 0) + 1 : 0;
      if (Q.swoopF >= 4) flag("jump", "the camera swoops (" + Q.swoopF + " frames at > " + Q.opts.camJump + " m a frame) " + JSON.stringify(P(Q.last.cam)) + "→" + JSON.stringify(P(cur.cam)), "jump:swoop");
      if (dk > Q.opts.camJump * rt && !cutscene) flag("jump", "the camera moved " + dk.toFixed(1) + " m in one frame " + JSON.stringify(P(Q.last.cam)) + "→" + JSON.stringify(P(cur.cam)), "jump:cam");
    }
    Q.last = cur;
    const ctl = control();
    // overlays
    if (cov.length) { Q.overlayF += dF; if (ctl) Q.overlayCtl += dF; else Q.overlayCtl = 0; } else { Q.overlayF = 0; Q.overlayCtl = 0; }
    if (Q.overlayF > Q.opts.overlaySecs * 30) flag("overlay", cov.join("+") + " covers the screen for " + (Q.overlayF / 30).toFixed(1) + " s", "overlay:long");
    if (Q.overlayCtl > 30) flag("overlay", cov.join("+") + " covers the screen while she has control (" + (Q.overlayCtl / 30).toFixed(1) + " s)", "overlay:ctl");
    // camera
    if (!ctx.view && (st === "playing" || st === "footRun")) {
      if (camP.y < 0.15) flag("underground", "camera y " + camP.y.toFixed(2), "ug");
      // (on foot anywhere; in the car only in a town — the driving camera's walls are a town thing)
      const who = foot || (st === "playing" && ctx.town && ctx.town.active ? ctx.car.pos : null);
      let leaf = null;
      if (who) for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders || []) {
        if (c.kind !== "tree" || c.off || camP.y < 2.0 || camP.y > 7.5) continue;
        const R = Math.min(3.8, Math.max(c.r * 4.6 + 0.2, c.r < 0.42 ? 2.4 : 3.4)) - 0.3;     // (as foot/jump.js canopyR, a touch inside)
        if ((who.x - c.x) ** 2 + (who.z - c.z) ** 2 < (R + 0.6) ** 2) continue;     // (she's under it herself: the camera behind her may pass its edge)
        if ((camP.x - c.x) ** 2 + (camP.z - c.z) ** 2 < R * R) { leaf = "@" + c.x.toFixed(1) + "," + c.z.toFixed(1) + " (cam " + JSON.stringify(P(camP)) + ")"; break; }
      }
      // (a camera on the move brushing through leaves for a moment is fine; PARKED in them — a green / black screen — isn't)
      if (leaf) Q.leafF += dF; else Q.leafF = 0;
      if (Q.leafF > 12) flag("inwall", "the camera stays inside a tree's leaves " + leaf, "inwall:tree");
      if (who) { const s = solidAt(camP.x, camP.z, camP.y, 0.05, 0.8); if (s) flag("inwall", "the camera is inside " + s + " (cam " + JSON.stringify(P(camP)) + (foot ? ", Lulu " : ", car ") + JSON.stringify(P(who)) + ")", foot ? "inwall" : "inwall:car"); }
      const look = ctx.camera.getWorldDirection(Q._dir || (Q._dir = camP.clone()));
      if (f % Q.opts.flatEvery === 0 && !cov.length && !soft && look.y > -0.55) {      // (looking straight down at a lot / a lawn is flat on purpose)
        const fl = flatFrame();
        if (fl && fl.sd < Q.opts.flatStd) flag("flat", "the picture is one flat colour (mean " + fl.m + ", sd " + fl.sd + ") cam " + JSON.stringify(P(camP)), "flat");
      }
    }
    // Lulu / the car hidden while she has control
    if (ctl && ((st === "footRun" && F && F.lulu && !F.lulu.obj.visible) || (st === "playing" && !ctx.car.obj.visible))) Q.hidF += dF; else Q.hidF = 0;
    if (Q.hidF > 10) flag("hidden", (st === "footRun" ? "Lulu" : "the car") + " is invisible while she has control", "hidden");
    // standing inside something solid
    if (ctl && foot && F.phase === "walk" && !F.air) {
      const s = solidAt(foot.x, foot.z, (F.y || 0) + 0.3, 0.15);
      if (s) Q.insideF += dF; else Q.insideF = 0;
      if (Q.insideF > 15) flag("inside", "Lulu stands inside " + s + " at " + JSON.stringify(P(foot)), "inside");
    } else Q.insideF = 0;
    // an invisible wall: the stick pushed hard, she's on her feet and not moving, and nothing solid within reach
    const inp = L3.input || {};
    if (ctl && foot && F.phase === "walk" && Math.hypot(inp.moveX || 0, inp.moveY || 0) > 0.7 && !F.air && !(F.buskT > 0) && Math.hypot(F.vel.x, F.vel.z) < 0.3) Q.pushF += dF; else Q.pushF = 0;
    if (Q.pushF > 20) {
      let near = solidAt(foot.x, foot.z, 0.3, -1.0);
      if (!near) for (const c of ctx.traffic.cars) if (Math.hypot(c.x - foot.x, c.z - foot.z) < 3.5) { near = "car"; break; }
      if (!near) for (const pc of F.parked || []) if (Math.hypot(pc.x - foot.x, pc.z - foot.z) < 3.5) { near = "parked"; break; }
      if (!near && !(F.booth)) flag("invisible", "Lulu can't move (stick pushed) and nothing is in her way at " + JSON.stringify(P(foot)) + " d " + (F.d || 0).toFixed(1), "invisible");
    }
    // stuck states / control taken away
    const roam = { playing: 1, footRun: 1, interior: 1, title: 1 };
    if (!roam[st] && !ctx.paused && ctx.time - Q.stateSince > Q.opts.stuckSecs) flag("stuck", "state " + st + " for " + (ctx.time - Q.stateSince).toFixed(0) + " s", "stuck:" + st);
    const def = ctx.states[st] || {};
    const excused = ctx.paused || ctx.dialogOpen || ctx.view || (ctx.cutscene && ctx.cutscene.active()) || (typeof def.skip === "function" ? def.skip() : !!def.skip) || st === "title" || st === "interior" || (L3.H && L3.H.screenOpen && L3.H.screenOpen());
    if (!ctl && !excused) Q.noCtl += dF; else Q.noCtl = 0;
    if (Q.noCtl > Q.opts.noCtlSecs * 30) flag("nocontrol", "no control for " + (Q.noCtl / 30).toFixed(1) + " s in " + st + (F ? " (foot phase " + F.phase + ")" : ""), "noctl:" + st + (F ? F.phase : ""));
  }
  requestAnimationFrame(tick);
  return true;
})()`;

module.exports = {
  async install(t) { return t.L(SRC); },
  async reset(t) { return t.L(`(window.__qa.issues = [], window.__qa.counts = {}, window.__qa.ep = {}, window.__qa.last = null, window.__qa.overlayF = window.__qa.noCtl = window.__qa.hidF = window.__qa.insideF = 0, window.__qa.stateSince = __lulu3d.ctx.time, true)`); },
  async report(t) { return t.L(`({ issues: window.__qa.issues.map(i => ({ kind: i.kind, f: i.f, t: i.t, state: i.state, msg: i.msg, n: i.n })), counts: window.__qa.counts })`); },
  /** Ignore a known, explained case: kind + a regex source on the message. */
  async allow(t, kind, re) { return t.L(`(window.__qa.allow.push({ kind: ${JSON.stringify(kind)}, re: new RegExp(${JSON.stringify(re)}) }), true)`); },
  /** The test itself just moved her / the car (a debug teleport): that's a declared cut, not a glitch. */
  async moved(t) { return t.L(`(window.__qa.cutF = __lulu3d.ctx.frames + 2, window.__qa.last = null, true)`); },
  async pause(t, on = false) { return t.L(`(window.__qa.on = ${!!on}, window.__qa.last = null, true)`); },
  /** One check per glitch kind in `kinds` (default: all) for a segment; prints every issue as detail. */
  check(t, label, r, kinds = ["jump", "nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "nocontrol", "inside", "invisible"]) {
    let ok = true;
    for (const k of kinds) {
      const its = r.issues.filter(i => i.kind === k);
      if (!its.length) continue;
      ok = false;
      t.check(`${label}: no ${k} glitch`, false, its.slice(0, 4).map(i => `f${i.f} ${i.state}: ${i.msg}${i.n > 1 ? " ×" + i.n : ""}`).join(" | "));
    }
    if (ok) t.check(`${label}: the watchdog saw nothing wrong`, true);
    return ok;
  },
  /** `&enable=all` also turns on the 🎉 Shared Road presence, which dials the REAL relay server: when that server is down
   *  its WebSocket error is the outside world's, not the game's — drop just those from the page-error list. */
  dropRelayErrors(t) { for (let i = t.errors.length - 1; i >= 0; i--) if (/WebSocket connection to 'wss:\/\/lulu-shared-road/.test(t.errors[i])) t.errors.splice(i, 1); },
  log(r) { for (const i of r.issues) console.log(`    · [${i.kind}] f${i.f} t${i.t} ${i.state}: ${i.msg}${i.n > 1 ? " ×" + i.n : ""}`); },
};
