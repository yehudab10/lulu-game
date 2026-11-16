// features/hustle — 📻 THE CAR RADIO.
//
//   LULU FM (default: whatever the game plays — each Story leg's music, the Cruise track)
//   🕺 SIMCHA 101.3 · 🍸 SMOOTH 88.8 · 🎙️ KVETCH 1450 AM (talk + call-ins) · 📴 off
//
// The stations reuse the music the game already ships (no new audio). DJ chatter,
// parody ads and call-in shows appear as a small, short-lived TICKER under the pause
// button (top right: sky, never the road); Settings › Lulu's chatter → Quiet means
// fewer ads and less talk, HUD style Clean hides the ticker (.hud-secondary).
// The station is remembered in the save (store("hustle").station).
//
// It only steers the music while Lulu is IN the car (driving states, not on foot);
// scenes (court, the salon, the ER…) still set their own music, and we take over
// again when she's back behind the wheel.
import { ctx, on, emit } from "../../core/ctx.js";
import { save3d, saveSoon, store } from "../../core/save.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { STATIONS, SONGS, ADS, NEWS, CHATTER, RADIO } from "./data.js";
import { tickerShow, tickerHide, tickerGone, tickerLayout, ticker, esc } from "./ui.js";
import { rand, pick } from "./util.js";
import * as SFX from "./sfx.js";

export const S = store("hustle", { station: "auto" });
if (!STATIONS.some(s => s.id === S.station)) S.station = "auto";
const BY_ID = Object.fromEntries(STATIONS.map(s => [s.id, s]));
const IN_CAR = new Set(["playing", "intro", "wrecked", "arriving", "hustleResult", "hustleHeist"]);
const DEFAULT_SRC = "../luludriving.mp3";

const R = {
    idx: {},              // station id → current track index
    songT: 0,             // seconds left in the current song
    msgT: rand(...RADIO.firstMsg),
    showT: 0,             // seconds the ticker stays up
    queue: [],            // pending ticker lines (a talk segment plays line by line)
    ov: { on: false, src: null, gameSrc: null },
    fade: null,           // { t, dur, from, to, then }
    lastAd: -99, news: {},
    log: [],              // the last few ticker lines (tests)
};

export const station = () => BY_ID[S.station] || BY_ID.auto;
const chatter = () => CHATTER[(save3d.settings && save3d.settings.chatter) || "normal"] || CHATTER.normal;
const vol = st => (st.bed || 0.32);
export function inCar() { return IN_CAR.has(ctx.state) && !(ctx.foot && ctx.foot.active) && !ctx.view; }
function track(st) {
    if (!st.tracks || !st.tracks.length) return null;
    const i = (R.idx[st.id] || 0) % st.tracks.length;
    return st.tracks[i];
}
const musicSrc = () => (typeof A.musicSrc === "function" ? A.musicSrc() : R.ov.src);

/** Make the music match the station (cheap when nothing changed). */
export function apply() {
    if (!inCar()) { R.ov.on = false; return; }
    const st = station(), ov = R.ov;
    const cur = musicSrc();
    if (st.id === "auto") {
        if (ov.on) {
            ov.on = false;
            if (cur === ov.src) A.setMusic(ov.gameSrc || ctx.G.music || DEFAULT_SRC);
            A.duckMusic(ctx.paused ? 0.12 : 0.32);
        }
        return;
    }
    const want = st.id === "off" ? null : track(st);
    if (ov.on && cur === want) return;
    if (cur !== ov.src) ov.gameSrc = cur;          // someone else picked this music: that's the game's choice
    ov.on = true;
    ov.src = want;
    A.setMusic(want);
    if (want) A.duckMusic(ctx.paused ? 0.12 : vol(st));
    R.songT = rand(...RADIO.songLen);
}

/** Next station (dir ±1). Static, the ticker, the save. */
export function cycle(dir = 1) {
    const i = STATIONS.findIndex(s => s.id === S.station);
    const next = STATIONS[(i + dir + STATIONS.length) % STATIONS.length];
    tune(next.id);
    return next;
}
export function tune(id) {
    if (!BY_ID[id]) return false;
    S.station = id;
    saveSoon();
    if (!A.audio.musicOn && id !== "off" && id !== "auto") { save3d.music = A.toggleMusic(); }
    SFX.radioStatic();
    R.fade = null;
    R.queue.length = 0;
    apply();
    const st = station();
    const song = st.tracks && st.tracks.length ? SONGS[track(st)] : "";
    say(st, song ? `🎵 ${song}` : esc(st.tag), 3.2, true);
    R.msgT = Math.max(R.msgT, 7);
    if (document.body.classList.contains("hud-clean")) H.toast(`📻 ${st.name}`, "", { key: "hs-radio" });
    emit("hustle:radio", { station: id });
    return true;
}

/** Put a line on the ticker for `secs` (game time). */
function say(st, html, secs, force = false) {
    if (!force && (!inCar() || ctx.state !== "playing" || ctx.paused)) return false;
    tickerShow(st, html, st.id === "simcha" ? "#FF80AB" : st.id === "lounge" ? "#B39DDB" : st.id === "talk" ? "#FFD54F" : st.id === "off" ? "#90A4AE" : "#80DEEA");
    R.showT = secs;
    R.log.push({ st: st.id, text: html.replace(/<[^>]+>/g, ""), t: +ctx.time.toFixed(1) });
    if (R.log.length > 20) R.log.shift();
    return true;
}
const secsFor = text => Math.min(9, 4.2 + text.length / 24);

/** What the station says next: a DJ line, an ad, a talk segment, live news. */
function nextMessage(st) {
    const ch = chatter();
    if (st.id === "off" || st.id === "auto") return null;
    // live news beats everything (once per event)
    const law = ctx.law;
    if (law && law.chasing && !R.news.chase && Math.random() < 0.8) { R.news.chase = true; return { lines: [["NEWS", pick(NEWS.chase)]] }; }
    if (ctx.hustle && ctx.hustle.job && ctx.hustle.job.id === "getaway" && ctx.hustle.job.heisted && !R.news.heist) { R.news.heist = true; return { lines: [["NEWS", NEWS.heist[0]]] }; }
    const adOdds = (st.id === "talk" ? 0.45 : 0.3) * ch.ads;
    if (Math.random() < adOdds && ctx.time - R.lastAd > 25) { R.lastAd = ctx.time; return { ad: pick(ADS) }; }
    if (st.id === "talk" && st.segments && Math.random() < 0.6) return { lines: pick(st.segments) };
    return { lines: [[st.dj || "DJ", pick(st.lines)]] };
}
function showNext(st) {
    const q = R.queue.shift();
    if (!q) return false;
    const html = q.ad ? `<b>AD</b> ${esc(q.ad)}` : `<b>${esc(q.who)}:</b> ${esc(q.text)}`;
    const ok = say(st, html, secsFor(q.ad || q.text));
    if (ok && st.id === "talk" && !q.ad) SFX.babble(Math.min(14, 5 + Math.floor((q.text || "").length / 9)), /BUBBE|UNCLE|DR/.test(q.who || ""));
    return ok;
}

/** Every driving frame (from index.js). */
export function radioTick(dt, P) {
    if (P && P.radio && ctx.state === "playing" && inCar()) cycle(1);
    apply();
    // volume fades between songs
    if (R.fade) {
        const f = R.fade;
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        A.duckMusic(f.from + (f.to - f.from) * k);
        if (k >= 1) { R.fade = null; if (f.then) f.then(); }
    }
    // the ticker's own clock
    if (R.showT > 0) { R.showT -= dt; tickerLayout(dt); if (R.showT <= 0) { if (!R.queue.length) tickerHide(); } }
    const st = station();
    if (ctx.state !== "playing" || !inCar() || ctx.paused) return;
    if (st.id === "auto" || st.id === "off") return;
    // song rotation: fade out, next track, the DJ says what's on
    if (st.tracks && st.tracks.length > 1) {
        R.songT -= dt;
        if (R.songT <= 0 && !R.fade) {
            R.songT = rand(...RADIO.songLen);
            const v = vol(st);
            R.fade = { t: 0, dur: 1.2, from: v, to: 0.02, then: () => {
                R.idx[st.id] = ((R.idx[st.id] || 0) + 1) % st.tracks.length;
                apply();
                A.duckMusic(0.02);
                R.fade = { t: 0, dur: 1.4, from: 0.02, to: v };
                if (ctx.enabled("hustle")) say(st, `<b>${esc(st.dj)}:</b> up next — ${esc(SONGS[track(st)] || "a classic")}`, 4.5);
            } };
        }
    }
    // a line plays out (talk segments line by line), then the next message is a while away
    if (R.showT <= 0.15 && R.queue.length) { showNext(st); return; }
    if (!ctx.enabled("hustle")) return;              // random chatter: tests opt in
    R.msgT -= dt;
    if (R.msgT > 0 || R.showT > 0) return;
    const ch = chatter();
    R.msgT = rand(...RADIO.gap) * ch.gap;
    if (ctx.dialogOpen || H.screenOpen()) return;
    const m = nextMessage(st);
    if (!m) return;
    if (m.ad) R.queue.push({ ad: m.ad });
    else for (const [who, text] of m.lines) R.queue.push({ who, text });
    showNext(st);
}

// ── lifecycle ─────────────────────────────────────────────────────────────
on("state", ({ to }) => {
    if (IN_CAR.has(to)) apply();
    else { R.ov.on = false; R.queue.length = 0; }
    if (to !== "playing") { R.queue.length = 0; R.showT = 0; tickerHide(true); }     // the ticker is a driving thing
});
on("run:start", () => { R.news = {}; R.queue.length = 0; R.msgT = rand(...RADIO.firstMsg); tickerHide(true); });
on("pause", ({ paused }) => {
    if (paused) { tickerHide(true); return; }
    const st = station();
    if (R.ov.on && st.id !== "off" && st.id !== "auto") A.duckMusic(vol(st));
});
on("cop:chase", ({ active }) => { if (!active) R.news.chase = false; });
on("settings", () => { if (document.body.classList.contains("hud-clean")) tickerGone(); });
// the ticker is a tap target too (touch: tap it to change the station)
on("boot", () => {
    const t = ticker();
    t.addEventListener("click", e => { e.stopPropagation(); if (ctx.state === "playing" && inCar()) cycle(1); });
});

export const radio = {
    get station() { return S.station; },
    get name() { return station().name; },
    stations: STATIONS.map(s => s.id),
    cycle, tune,
    /** What the radio is doing (tests). */
    state() { return { station: S.station, override: R.ov.on, src: musicSrc(), gameSrc: R.ov.gameSrc, msgT: +R.msgT.toFixed(1), showT: +R.showT.toFixed(1), queue: R.queue.length, log: R.log.slice() }; },
    /** Tests: say something now. */
    debugSay(kind = "dj") {
        const st = station();
        if (st.id === "auto" || st.id === "off") return false;
        R.queue.length = 0;
        if (kind === "ad") R.queue.push({ ad: ADS[0] });
        else if (kind === "talk" && st.segments) for (const [who, text] of st.segments[0]) R.queue.push({ who, text });
        else R.queue.push({ who: st.dj, text: st.lines[0] });
        R.showT = 0;
        return showNext(st);
    },
    /** Tests: fast-forward the message clock. */
    debugMsgT(v) { R.msgT = v; return true; },
};
