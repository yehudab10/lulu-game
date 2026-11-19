// features/seasons — 🕎 A WORLD THAT FOLLOWS THE REAL CALENDAR (the 3D game's "seasons", from the device's
// Hebrew calendar — something only this game can do).
//
//   🕎 Chanukah     a menorah in every front window, TONIGHT's candles lit (+ the shamash) — a candle more each evening;
//                   the big public menorah on the lawn by the town hall / the shul; a sufganiyot stall
//   🎭 Purim        a costume parade down the town's main street (crowns, Haman hats, clowns, a walking hamantash),
//                   mishloach manos on the doorsteps, hamantaschen at the stall (from a few days before)
//   🔨🌿 Sukkos     sukkahs going up in the days before (frames, ladders) — then finished, on every duplex's sukkah
//                   deck, in Midwood's front yards and beside the highway houses; the lulav & esrog stall
//   🧹 before Pesach the clean-out piled at the kerb · 🔥 Lag BaOmer bonfires in the fields (cartoon, ringed with
//                   stones, a bucket of water beside) · 💐 Shavuos planters + a flower / cheesecake stall ·
//                   🍎 Rosh Hashana apples & honey · 🌳 Tu B'Shvat dried fruit
//   🕯️ every week   Friday's challah & flowers stall; Shabbos (and Yom Tov) candles in the windows after dark
//   quiet days      fast days, the Three Weeks / Nine Days, Yom Kippur: nothing festive — just a word from Ima
// …plus Ima's 📱 note in the family chat once a day, Lulu's line the first time she sees it, and the ✋ stall treat
// (on foot, or pull up slowly beside it) — its coins once per REAL day at most (golden rule 5).
//
// How it's built (cheap + additive): calendar.js (what day it is) · data.js (what each day dresses) · places.js
// (where: road chunks' `houses`, ctx.town.homes / spot(), homes' doors — hashes of the place, never Math.random) ·
// dress.js (one InstancedMesh per prop kind filled with the nearest ones + one Points per light size, faded by
// atmos' night) · party.js (a 🎉 party uses the HOST's day). Hooks only: chunk:build / chunk:dispose, town:enter /
// town:leave, run:start. ⚙️ Settings → 🕎 Holidays in the world ON / OFF.
//
// Service ctx.seasons: today() · ids · main · on · info() · debug.{season(id, n, opts), date(iso), lit(v), rebuild(),
// treat(), dressed(), D}. Events: seasons:day {main, ids, key} · seasons:dress {where, n} · seasons:treat {id, coins, paid}.
// Stats: seasonsTreats, seasonsTreatCoins. Previews: ?season=chanukah&night=5 · ?seasonDate=2026-12-07T19:30.
import * as THREE from "three";
import { ctx, on, emit, hook, addMenuItem, pick } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { registerModels, ensureModels, models } from "../../models.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { today, setDate, setForced, DAYS } from "./calendar.js";
import { RECIPES, KIND_DEFS, TUNE, AGAIN } from "./data.js";
import { planChunk, planTown, recipesFor } from "./places.js";
import { D, KINDS, addSet, dropSet, dropAll, tick as dressTick, hasSet } from "./dress.js";
import { partyTick, partyDay } from "./party.js";
import { paradeStart, paradeStop, paradeTick, paradeInfo } from "./parade.js";

registerModels({ seasonsProps: "seasons_props" });
Object.assign(KINDS, KIND_DEFS);
// the bonfire's flames lick and lean (its few instances re-fill every frame)
{
    const v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    KINDS.bonfire = Object.assign({}, KINDS.bonfire, { anim: (it, t, m) => {
        const k = 1 + Math.sin(t * 9 + it.x) * 0.12 + Math.sin(t * 23 + it.z) * 0.06;
        m.compose(v.set(it.x, it.y, it.z), q.setFromAxisAngle(up, it.rot + Math.sin(t * 1.7) * 0.25), sc.set(1 + (1 - k) * 0.5, k, 1 + (1 - k) * 0.5));
    } });
}

const SAVE = store("seasons", { on: true, paid: {}, said: {}, ima: {}, treats: 0 });

// ── what's on ────────────────────────────────────────────────────────────
const S = { key: "", day: null, recipes: [], want: false, loading: false, town: null, stands: [], chunks: new Map(), served: new Set(), lastTreat: 0 };
const live = () => SAVE.on !== false && ctx.enabled("seasons");

function current() {
    const p = partyDay();          // in a 🎉 party: the host's day (null until it's known → dress nothing yet)
    if (p === "wait") return null;
    return today();
}
/** Re-read the day; when what we dress changes, take everything down and put the new things up. */
function refresh(force = false) {
    const day = live() ? current() : null;
    const recipes = day ? recipesFor(day) : [];
    const key = day ? day.key + "|" + recipes.map(r => r.id).join(",") + "|" + day.chanukah : "off";
    if (!force && key === S.key) return;
    const prevMain = S.day && S.day.main;
    S.key = key; S.day = day; S.recipes = recipes;
    // stand kinds (one per awning colour)
    for (const r of recipes) if (r.recipe.stand) { const k = "stand:" + r.recipe.stand.awning; if (!KINDS[k]) KINDS[k] = { prop: "Stand", tints: { Awning: r.recipe.stand.awning }, max: 4, R: 260 }; }
    S.want = recipes.some(r => dresses(r.recipe));
    takeDown();
    if (day && (day.main || "") !== (prevMain || "")) emit("seasons:day", { main: day.main, ids: day.ids.slice(), key: day.key });
    if (!S.want) return;
    if (!models.seasonsProps) {
        if (S.loading) return;
        S.loading = true;
        ensureModels(["seasonsProps"]).then(() => { S.loading = false; refresh(true); }).catch(e => { S.loading = false; console.warn("[seasons] models", e); });
        return;
    }
    putUp();
}
const dresses = R => !!(R.windows || R.strings || R.big || R.stand || R.sukkah || R.baskets || R.kerb || R.bonfire || R.planters || R.parade);

function takeDown() {
    for (const [k, c] of S.chunks) { for (const col of c.cols) { const i = c.chunk.colliders.indexOf(col); if (i >= 0) c.chunk.colliders.splice(i, 1); } }
    S.chunks.clear();
    dropAll();
    S.stands = [];
    paradeStop();
}
function putUp() {
    // the highway chunks already built (the ones still building get theirs from chunk:build)
    const W = ctx.world;
    if (W && W.chunks) for (const c of W.chunks.values()) if (!c.building) dressChunk(c, W);
    if (ctx.town && ctx.town.active) dressTown();
}

// ── the highway ──────────────────────────────────────────────────────────
function standKind(it) { if (it.kind === "stand") { const r = S.recipes.find(x => x.id === it.stand); if (r && r.recipe.stand) it.kind = "stand:" + r.recipe.stand.awning; } return it; }
function dressChunk(chunk, world) {
    if (!S.want || !models.seasonsProps || hasSet("c" + chunk.k)) return;
    let plan;
    try { plan = planChunk(chunk, world, S.day, S.recipes); } catch (e) { console.error("[seasons] chunk", e); return; }
    if (!plan.items.length) return;
    plan.items.forEach(standKind);
    const set = addSet("c" + chunk.k, plan.items, { vis: () => chunk.group.visible && !!chunk.group.parent });
    const cols = plan.colliders.map(c => chunk.addCollider(c));
    S.chunks.set(chunk.k, { chunk, cols });
    for (const it of set.items) if (it.stand) S.stands.push(it);
}
on("chunk:build", ({ chunk, world }) => { if (S.want && world && chunk) dressChunk(chunk, world); });
on("chunk:dispose", ({ chunk }) => {
    if (!chunk) return;
    const c = S.chunks.get(chunk.k);
    if (c && c.chunk === chunk) { S.chunks.delete(chunk.k); dropSet("c" + chunk.k); S.stands = S.stands.filter(it => it.set.key !== "c" + chunk.k); }
});

// ── a town ───────────────────────────────────────────────────────────────
function dressTown() {
    if (!S.want || !models.seasonsProps || !ctx.town || !ctx.town.active) return;
    let plan;
    try { plan = planTown(S.day, S.recipes); } catch (e) { console.error("[seasons] town", e); return; }
    plan.items.forEach(standKind);
    const id = ctx.town.id;
    const set = addSet("town", plan.items, { vis: () => !!(ctx.town && ctx.town.active && ctx.town.id === id) });
    for (const it of set.items) if (it.stand) S.stands.push(it);
    if (S.recipes.some(r => r.recipe.parade)) paradeStart(S.day);
    emit("seasons:dress", { where: id, n: plan.items.length });
}
on("town:enter", () => { if (S.want) dressTown(); notice("town"); });
on("town:leave", () => { dropSet("town"); S.stands = S.stands.filter(it => it.set.key !== "town"); paradeStop(); });

// ── noticing it: Ima's 📱 note (once a day) and Lulu's line (the first time she sees it) ──
function dayKey() { return S.day ? (S.day.forced ? S.day.key : S.day.key) + ":" + (S.day.main || "") : ""; }
function notice(where) {
    if (!live() || !S.day || !S.day.main) return;
    const id = S.day.main, R = RECIPES[id];
    if (!R) return;
    const k = dayKey();
    // Ima's note in the family chat (stored in 💬 Messages; the bubble pops while driving)
    if (R.ima && SAVE.ima.k !== k && ctx.phone && ctx.phone.text && where === "run") {
        SAVE.ima = { k };
        saveSoon();
        try { ctx.phone.text({ from: "Ima", emoji: "👩", color: "#EC407A", thread: "mishpacha", msg: R.ima(S.day.chanukah || 1), dur: 6 }); } catch (e) { /* no phone */ }
    }
    // Lulu's line, once per day, once there's something to see
    if (R.lulu && S.want && SAVE.said.k !== k && (where === "town" || where === "see")) {
        SAVE.said = { k };
        saveSoon();
        H.toast(R.lulu(S.day.chanukah || 1), "gold", 4.5);
    }
}
on("run:start", () => {
    refresh();
    S.served.clear();
    // (after the run's first moments, so it doesn't land on the 3-2-1)
    S.noticeT = 4;
});

// ── the stall treat: ✋ on foot, or pull up slowly beside it ──────────────
function nearestStand(x, z, r) {
    let best = null, bd = r;
    for (const it of S.stands) {
        if (it.set.vis && !it.set.vis()) continue;
        const d = Math.hypot(it.x - x, it.z - z);
        if (d < bd) { bd = d; best = it; }
    }
    return best;
}
const standRecipe = it => { const r = S.recipes.find(x => x.id === it.stand); return r && r.recipe.stand; };
function realDayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
/** Serve the treat at stall `it`. Coins: once per REAL day, whichever stall, whatever holiday. */
export function treat(it) {
    const st = it && standRecipe(it);
    if (!st) return null;
    const pk = "t:" + realDayKey();          // (a previewed day doesn't reset it: the cap is the REAL day)
    const paid = !SAVE.paid[pk];
    let coins = 0;
    if (paid) {
        SAVE.paid = { [pk]: 1 };            // (only today's key is kept)
        coins = st.coins | 0;
        if (ctx.G && ctx.state && /playing|footRun/.test(ctx.state)) addCoins(coins, "seasons"); else wallet.add(coins);
    }
    SAVE.treats = (SAVE.treats | 0) + 1;
    saveSoon();
    H.toast(paid ? `${pick(st.lines)} +${coins} 💰` : pick(AGAIN), "gold", 3.6);
    try { A.sfxCoin && paid && A.sfxCoin(); } catch (e) { /* no sound */ }
    emit("stat", { id: "seasonsTreats", n: 1 });
    if (coins) emit("stat", { id: "seasonsTreatCoins", n: coins });
    emit("seasons:treat", { id: it.stand, coins, paid });
    S.lastTreat = ctx.time;
    return { coins, paid };
}
let spotStand = null;
const standSpot = {
    r: 3.2, short: "STALL",
    pos() {
        spotStand = null;
        if (!live() || !S.stands.length || !ctx.foot || !ctx.foot.pos) return null;
        const f = ctx.foot.pos;
        spotStand = nearestStand(f.x, f.z, 3.2);
        return spotStand ? { x: spotStand.x, z: spotStand.z } : null;
    },
    label() { const st = spotStand && standRecipe(spotStand); return st ? st.treat : null; },
    act() { if (spotStand) treat(spotStand); },
};
function driveUp() {
    if (!S.stands.length || !ctx.car || ctx.state !== "playing" || ctx.time - S.lastTreat < 5) return;
    if (Math.abs(ctx.car.speed) > TUNE.driveUp.speed) return;
    const it = nearestStand(ctx.car.pos.x, ctx.car.pos.z, TUNE.driveUp.r);
    if (!it || S.served.has(it)) return;
    S.served.add(it);
    treat(it);
}

// ── per frame ────────────────────────────────────────────────────────────
let lastT = -1;
const _cam = new THREE.Vector3();
function frame(dt) {
    if (!ctx.world || !ctx.camera) return;
    if (ctx.time === lastT) return;
    lastT = ctx.time;
    partyTick(dt, refresh);
    if (live() || S.want) refreshSoon(dt);
    if (!S.want) return;
    _cam.copy(ctx.camera.position);
    const night = ctx.atmos ? ctx.atmos.night || 0 : 0;
    dressTick(dt, night, _cam);
    paradeTick(dt);
    driveUp();
    if (S.noticeT > 0 && (S.noticeT -= dt) <= 0) { notice("run"); if (D.stats.drawn > 0 || D.stats.lights > 0) notice("see"); }
    else if (D.stats.drawn > 0 && S.day && SAVE.said.k !== dayKey()) notice("see");
}
// re-check the date now and then (midnight, sundown, a party host's day)
let reT = 0;
function refreshSoon(dt) { if ((reT -= dt) <= 0) { reT = ctx.TEST ? 0.5 : 20; refresh(); } }
hook("hud", dt => frame(dt));
hook("update", dt => { const def = ctx.states[ctx.state]; if (!def || !def.hud) frame(dt); }, -55);
hook("titleCamera", dt => { frame(dt); return false; }, 30);
const driver = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
driver.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
driver.geometry.setDrawRange(0, 0);
driver.frustumCulled = false;
driver.name = "SeasonsTick";
driver.onBeforeRender = () => { if (lastT !== ctx.time && lastT >= 0) frame(Math.max(0, Math.min(0.05, ctx.time - lastT))); };

on("boot", () => {
    ctx.scene.add(driver);
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(standSpot);
    refresh(true);
    lastT = 0;
});
on("title", () => refresh());

// ── ⚙️ settings ──────────────────────────────────────────────────────────
addMenuItem("settings", {
    id: "seasons", order: 63,
    label: () => `🕎 Holidays in the world <b>${SAVE.on !== false ? "ON" : "OFF"}</b>`,
    action: () => { SAVE.on = SAVE.on === false; saveSoon(); refresh(true); H.toast(SAVE.on ? "🕎 The world follows the Jewish calendar" : "🕎 Holiday dressing off", "", 2.5); },
});
// the home-screen chip for the days meta's greeting doesn't cover (Sukkos prep, Lag BaOmer, Shavuos, Tu B'Shvat…)
addMenuItem("titleInfo", {
    id: "seasonsDay", order: 5.5, bar: true,
    visible: () => {
        if (!live() || !S.day || !S.day.main || !DAYS[S.day.main] || !DAYS[S.day.main].greet) return false;
        try { if (ctx.meta && ctx.meta.holiday && ctx.meta.holiday()) return false; } catch (e) { /* none */ }
        return true;
    },
    label: () => { const d = DAYS[S.day.main]; return `<span class="meta-holiday">${d.emoji} ${d.greet}</span>`; },
});

// ── the service ──────────────────────────────────────────────────────────
ctx.seasons = {
    today: () => S.day,
    get ids() { return S.day ? S.day.ids.slice() : []; },
    get main() { return S.day ? S.day.main : null; },
    get on() { return live(); },
    get dressed() { return S.want; },
    info() {
        return { key: S.key, main: S.day && S.day.main, ids: S.day ? S.day.ids : [], heb: S.day && S.day.heb, chanukah: S.day && S.day.chanukah,
            recipes: S.recipes.map(r => r.id), want: S.want, sets: [...D.sets.keys()], stands: S.stands.length, kinds: [...D.kinds.keys()],
            stats: Object.assign({}, D.stats), lit: D.lit, source: S.day && S.day.source, parade: paradeInfo(), treats: SAVE.treats | 0 };
    },
    debug: {
        /** Preview a day: season("chanukah", 5) · season("purim") · season(null) = the real calendar. opts: { wd, eve }. */
        season(id, n = 1, opts = {}) { setForced(id, n, opts); refresh(true); return S.day && S.day.ids; },
        /** Pin the clock (local ISO) — the real calendar path. null = the real clock. */
        date(iso) { setDate(iso); setForced(null); refresh(true); return S.day && S.day.ids; },
        /** Force the lights: 0..1 (null = follow atmos' night). */
        lit(v) { D.litForce = v == null ? null : +v; return D.litForce; },
        rebuild: () => refresh(true),
        /** Serve the nearest stall's treat (tests): → {coins, paid} | null. */
        treat(x, z) { const p = x != null ? { x, z } : (ctx.foot && ctx.foot.active && ctx.foot.pos) || ctx.car.pos; return treat(nearestStand(p.x, p.z, 1e9)); },
        stands: () => S.stands.map(it => ({ x: it.x, z: it.z, rot: it.rot, id: it.stand, kind: it.kind, set: it.set.key })),
        /** String lights: { strings, bulbs } (sets in view or not). */
        strings: () => { let n = 0, b = 0; for (const s of D.sets.values()) for (const st of s.strings || []) { n++; b += st.pts.length / 3; } return { strings: n, bulbs: b, drawn: D.glows.bulb ? D.glows.bulb.n : 0 }; },
        items: kind => [...D.sets.values()].flatMap(s => s.items).filter(it => !kind || it.kind === kind).map(it => ({ kind: it.kind, x: it.x, y: it.y, z: it.z, s: it.s, lights: it.lights, set: it.set.key })),
        resetPaid() { SAVE.paid = {}; SAVE.said = {}; SAVE.ima = {}; saveSoon(); },
        D, S, SAVE,
    },
};
