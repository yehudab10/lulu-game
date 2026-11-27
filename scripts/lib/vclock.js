// THE PAGE'S CLOCK UNDER THE FAST TEST CLOCK (scripts/smoke3d.js; the game side is 3d/js/core/testclock.js).
//
// Installed as an init script — before any game module runs — on every page a fast-clock test opens. It makes the
// page's clocks follow GAME time once the game loop starts: setTimeout / setInterval, performance.now() and the rAF
// timestamp all advance 1/30 s per game step, exactly as for a player at a steady 30 fps. (Date.now() / new Date()
// stay on the REAL wall clock: it is the one clock every device and the relay share — the party clock, presence,
// "seen 2 minutes ago" — and it's also the calendar. A per-page game-time Date put two friends' pages 18 s apart.)
// So a 1 s save timer, a 2 s toast or a "5 minutes since…" check takes the same GAME time it does for a player,
// however fast the test runs. Before the first step (loading the models) and while an ad holds the game they run on
// real time. Within one step the clock moves with real time for at most a few ms (so a "work for 2.5 ms" budget
// loop still ends), and it never goes backwards.
//
// Timers fire after each game frame (the game's frame calls pump()), each followed by a few microtask turns, as in the
// browser; an exception in one is re-thrown on a real timer so it still shows as a page error.
/* eslint-disable no-global-assign */
function installVirtualClock(cfg) {
  window.__luluFast = cfg;
  // A page that talks to the (test) relay keeps a REAL performance.now() (+ rAF timestamp): its net code reads
  // performance.timeOrigin + now() as the wall clock it shares with the relay and the other pages (the party clock,
  // presence). Its TIMERS still follow game time — a chip refreshed every 400 ms must refresh as often per game
  // frame as it does for a player, or "4 frames later the chip says…" depends on how fast the test machine is.
  const realClock = /[?&]mpurl=/.test(location.search);
  const R = {
    now: performance.now.bind(performance), ST: window.setTimeout.bind(window), CT: window.clearTimeout.bind(window),
    raf: window.requestAnimationFrame.bind(window),
  };
  window.__luluRealNow = R.now;
  const CAP = 4;                 // (ms of real time the clock may move inside one step)
  const V = { started: false, base: 0, s0: 0, last: 0, q: new Map(), id: 1e9, armT: 0, idleAt: 0, inPump: false };
  function now() {
    const r = R.now();
    const t = V.started ? V.base + Math.min(CAP, Math.max(0, r - V.s0)) : r;
    if (t > V.last) V.last = t;
    return V.last;
  }
  // ── timers ──
  function add(fn, ms, a, every) {
    const id = V.id++;
    // (set from inside a timer: at least 4 ms later, as browsers clamp nested timers — so a setTimeout(0) chain runs
    //  ~8 links between two frames, as it does for a player, not one per frame)
    const d = Math.max(V.inPump ? 4 : 0, +ms || 0);
    V.q.set(id, { at: now() + d, fn, a, every });
    arm();
    return id;
  }
  function arm() {             // (before the game loop runs: fire on real time)
    if (V.started || V.armT || !V.q.size) return;
    let due = Infinity;
    for (const e of V.q.values()) if (e.at < due) due = e.at;
    V.armT = R.ST(() => { V.armT = 0; pump(); }, Math.max(0, due - R.now()));
  }
  let pumping = null;
  const FRAME = 1000 / 30;
  /** Fire every timer that comes due before the next game frame, in due order — including ones those timers set —
   *  the way a browser runs its timer tasks between two frames. While one runs, the clock reads its due time.
   *  Returns a promise that settles after their microtasks. */
  function pump() {
    if (pumping) return pumping;
    pumping = (async () => {
      const horizon = V.started ? V.base + FRAME : R.now();
      for (let guard = 0; guard < 5000; guard++) {
        let id = 0, e = null;
        for (const [k, x] of V.q) if (x.at <= horizon && (!e || x.at < e.at || (x.at === e.at && k < id))) { id = k; e = x; }
        if (!e) break;
        if (V.started && e.at > V.last) V.last = e.at;
        if (e.every) e.at += Math.max(4, e.every); else V.q.delete(id);
        V.inPump = true;
        try { e.fn(...e.a); } catch (err) { R.ST(() => { throw err; }, 0); } finally { V.inPump = false; }
        for (let k = 0; k < 4; k++) await null;
      }
    })().finally(() => { pumping = null; arm(); });
    return pumping;
  }
  window.setTimeout = (fn, ms, ...a) => typeof fn === "function" ? add(fn, ms, a, 0) : R.ST(fn, ms, ...a);
  window.setInterval = (fn, ms, ...a) => typeof fn === "function" ? add(fn, ms, a, Math.max(1, +ms || 0)) : R.ST(fn, ms, ...a);
  window.clearTimeout = window.clearInterval = id => { if (!V.q.delete(id)) R.CT(id); };
  // ── clocks ──
  if (!realClock) performance.now = now;
  if (!realClock) window.requestAnimationFrame = cb => R.raf(() => cb(now()));
  // ── the game drives it (3d/js/core/testclock.js) ──
  window.__luluClock = {
    /** The game loop's first step: from here on, time moves with the game. */
    start() { if (V.started) return; V.base = now(); V.s0 = R.now(); V.started = true; if (V.armT) { R.CT(V.armT); V.armT = 0; } },
    /** One step of game time (ms) — before the step runs, as a new frame's time. */
    advance(ms) { V.base = Math.max(V.base + ms, V.last); V.s0 = R.now(); V.idleAt = 0; },
    /** An ad holds the game: the clock follows REAL time (as it would for a player looking at the ad). */
    idle() { const r = R.now(); const d = V.idleAt ? Math.min(250, r - V.idleAt) : 0; V.idleAt = r; V.base = Math.max(V.base + d, V.last); V.s0 = r; return pump(); },
    pump,
    get started() { return V.started; },
    get pending() { return V.q.size; },
    real: R.now,
  };
}
module.exports = { installVirtualClock };
