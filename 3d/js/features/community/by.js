// features/community — 🎀 THE BAIS YAAKOV: a two-storey brick school on Carpool Ln (the town
// engine builds it from Lakewood's `uses` data; the model is ours). At dismissal the girls
// file out and walk the carpool line in single file while the menahel watches from the gate.
//
// BLEND IN (on foot, with heat — WANTED stars, a cop on foot, Shomrim on her tail): ✋ by the
// line → Lulu's in a navy skirt + light-blue blouse, walking at the back. A short rhythm
// game: STEP on the beat (✕ / A · E · 👟), and FREEZE when the menahel turns to look (any
// press = a giggle). The pursuer walks right past. Ten clean steps and a survived look and
// the heat's off; too suspicious and the menahel blows her cover. ⏭ skip = a perfect walk.
import * as THREE from "three";
import { ctx, emit, css } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { models } from "../../models.js";
import { input, glyph, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";
import { CM, on, onFoot, luluPos, rand, pick, clamp, wrap, getPerson, putPerson, bubble, luluSay, sfx, stat, townCfg, hintOnce } from "./common.js";
import { endShomrim } from "./shomrim.js";
import { BY } from "./lines.js";

const HAIRS = ["#4E342E", "#3E2723", "#1A1A1A", "#6D4C41", "#8D6E63", "#5D4037", "#2B1B14"];
const SPACING = 1.3, SPEED = 0.95, HALF = 12;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = { x: 0, z: 0, hx: 0, hz: 1 };
const PERIOD = 0.8, WINDOW = 0.21, NEED = 10;

css("community-by", `
.cm-blend { background: rgba(31, 45, 99, .92); color: #fff; border-radius: 16px; padding: 7px 14px 8px; text-align: center; min-width: min(300px, 84vw);
  max-width: 86vw; box-shadow: var(--shadow); font-weight: 700; pointer-events: none; }
.cm-blend b { display: block; font-size: 15px; letter-spacing: .03em; }
.cm-blend .dots { display: flex; gap: 4px; justify-content: center; margin: 5px 0 4px; }
.cm-blend .dots i { width: 13px; height: 13px; border-radius: 50%; background: rgba(255,255,255,.22); }
.cm-blend .dots i.on { background: #9CC8EE; } .cm-blend .dots i.now { box-shadow: 0 0 0 3px #FFD54F; }
.cm-blend .sus { height: 7px; border-radius: 99px; background: rgba(0,0,0,.35); overflow: hidden; margin-top: 3px; }
.cm-blend .sus i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #7CFC4F, #FFD740, #FF5252); }
.cm-blend small { display: block; font-size: 12px; opacity: .92; margin-top: 3px; font-weight: 600; }
.cm-blend.look { background: rgba(183, 28, 28, .94); }
.cm-blend .glyph { min-width: 20px; height: 20px; font-size: 11px; background: #fff; color: var(--ink); }
body.tv .cm-blend { min-width: 420px; padding: 12px 22px; } body.tv .cm-blend b { font-size: 24px; } body.tv .cm-blend small { font-size: 17px; }
body.tv .cm-blend .dots i { width: 20px; height: 20px; }
.cm-chip { background: rgba(26, 42, 108, .9); color: #fff; border-radius: 14px; padding: 5px 12px 6px; font-weight: 700; font-size: 13.5px; text-align: center;
  box-shadow: var(--shadow); min-width: 210px; pointer-events: none; }
.cm-chip i { display: block; height: 6px; border-radius: 99px; background: rgba(0,0,0,.35); margin-top: 4px; overflow: hidden; }
.cm-chip i b { display: block; height: 100%; background: #FFB300; border-radius: 99px; }
body.tv .cm-chip { font-size: 20px; min-width: 320px; }
`);

const inTown = () => !!(ctx.town && ctx.town.active);
export function heat() {
    const law = ctx.law;
    return !!((law && (law.wanted > 0 || law.fugitive)) || CM.chase || (ctx.foot && ctx.foot.chasing));
}

/** A point on the carpool-line loop (param p in metres), world coords + heading. */
function loopAt(by, p, out = _q) {
    const L = by.L, S = by.spot;
    p = ((p % L) + L) % L;
    let u, n, du = 0, dn = 0;
    const seg = 2 * HALF, turn = 1.6;
    if (p < seg) { u = -HALF + p; n = 0.3; du = 1; }
    else if (p < seg + turn) { u = HALF; n = 0.3 - (p - seg); dn = -1; }
    else if (p < 2 * seg + turn) { u = HALF - (p - seg - turn); n = -1.3; du = -1; }
    else { u = -HALF; n = -1.3 + (p - 2 * seg - turn); dn = 1; }
    out.x = S.x + S.ux * u + S.nx * n; out.z = S.z + S.uz * u + S.nz * n;
    out.hx = S.ux * du + S.nx * dn; out.hz = S.uz * du + S.nz * dn;
    return out;
}

// ── the line (spawned when she's near, pooled people) ────────────────────
function spawnLine(cfg, spot) {
    const by = CM.by = { spot, L: 4 * HALF + 3.2, girls: [], menahel: null, t: 0, head: 0, lookT: rand(4, 7), look: 0, blend: null, talkT: 0, lineT: rand(2, 5) };
    const n = cfg.by.girls || 7;
    for (let k = 0; k < n; k++) {
        const p = getPerson(models.community_bygirl ? "community_bygirl" : "npcKid", { Hair: HAIRS[k % HAIRS.length] });
        if (!p) continue;
        by.girls.push({ p, off: -k * SPACING, said: 0 });
    }
    by.menahel = getPerson(models.community_menahel ? "community_menahel" : "npcMan");
    if (by.menahel) {
        by.menahel.obj.position.set(spot.x + spot.ux * -1.6 - spot.nx * 1.9, 0, spot.z + spot.uz * -1.6 - spot.nz * 1.9);
        by.menahel.obj.rotation.y = Math.atan2(spot.nx, spot.nz);
    }
    emit("community:by", { phase: "line" });
}
export function clearLine() {
    const by = CM.by;
    if (!by) return;
    if (by.blend) endBlend(by, "abort");
    for (const g of by.girls) putPerson(g.p);
    putPerson(by.menahel);
    putPerson(by.pursuer);
    CM.by = null;
}

export function tickBY(dt) {
    const cfg = townCfg();
    if (!cfg || !cfg.by) { if (CM.by) clearLine(); return; }
    const spot = CM.bySpot || (CM.bySpot = ctx.town.spot(cfg.by.spot));     // (cached per visit)
    if (!spot) return;
    const lp = luluPos(), d = Math.hypot(spot.x - lp.x, spot.z - lp.z);
    if (!CM.by) { if (d < 75 && CM.loaded) spawnLine(cfg, spot); return; }
    const by = CM.by;
    if (d > 95 && !by.blend) { clearLine(); return; }
    by.t += dt;
    if (!by.blend) by.head += SPEED * dt;
    // the menahel looks along the line now and then (in the minigame it's the big moment)
    const m = by.menahel;
    if (m) {
        const lookAtLine = by.look > 0;
        const face = lookAtLine ? Math.atan2(lp.x - m.obj.position.x, lp.z - m.obj.position.z) : Math.atan2(spot.nx, spot.nz) + Math.sin(by.t * 0.4) * 0.5;
        m.obj.rotation.y += wrap(face - m.obj.rotation.y) * Math.min(1, dt * (lookAtLine ? 9 : 2));
        m.update(dt, { talk: by.lineT < 1.2, point: lookAtLine });
        by.lineT -= dt;
        if (by.lineT <= 0) { by.lineT = rand(6, 10); if (d < 30) bubble(m.obj, pick(BY.lineUp), 2.4, "cop"); }
    }
    for (const g of by.girls) {
        const q = loopAt(by, by.head + g.off);
        g.p.obj.position.set(q.x, 0, q.z);
        g.p.obj.rotation.y = Math.atan2(q.hx, q.hz);
        g.p.update(dt, { walk: by.blend && by.blend.phase !== "walk" ? 0 : SPEED, talk: Math.sin(by.t * 0.8 + g.off) > 0.85 });
    }
    // chatter as she walks by
    by.talkT -= dt;
    if (d < 12 && by.talkT <= 0 && !by.blend) { by.talkT = rand(5, 8); const g = pick(by.girls); if (g) bubble(g.p.obj, pick(BY.girls), 2.2, "kid"); }
    if (onFoot() && heat() && d < 40 && !by.blend) hintOnce("by", `<b>${BY.hint}</b><small>walk up to the line · ${glyph("interact")} ${BY.prompt}</small>`, 4200);
    if (by.pursuer && !by.blend) {
        const P = by.pursuer;
        P.t += dt;
        if (P.t > 6) { by.pursuer = putPerson(P.p) && null; }
    }
}

// ── ✋ on foot: blend in (with heat) · talk to the girls (without) ─────────
export const bySpot = {
    r: 3.6, short: "BLEND",
    pos() {
        const by = CM.by;
        if (!by || by.blend || !onFoot() || !by.girls.length) return null;
        const t = by.girls[by.girls.length - 1].p.obj.position;
        return { x: t.x, z: t.z };
    },
    label() { return CM.by && !CM.by.blend ? (heat() ? BY.prompt : "💬 SAY HI TO THE GIRLS") : null; },
    act() {
        const by = CM.by;
        if (!by) return;
        if (!heat()) { const g = pick(by.girls); if (g) bubble(g.p.obj, pick(BY.talk), 2.4, "kid"); return; }
        startBlend(by);
    },
};

// ── the minigame ─────────────────────────────────────────────────────────
let stepBtn = null, card = null;
export function bootBY() {
    stepBtn = addTouchButton({ id: "cm_step", emoji: "👟", label: "STEP", action: "interact",
        visible: () => ctx.state === "footRun" && !!(CM.by && CM.by.blend && CM.by.blend.phase === "walk") });
}
export function startBlend(by = CM.by, opts = {}) {
    if (!by || by.blend || !onFoot() || !ctx.foot.script) return false;
    const tail = by.girls[by.girls.length - 1];
    const B = by.blend = { t: 0, phase: "join", p: (tail ? tail.off : 0) - SPACING, beatN: 0, hit: new Set(), ok: 0, sus: 0, looks: 0, lookT: rand(2.6, 3.6), look: 0, warn: 0,
        auto: !!opts.auto, result: null, from: ctx.foot.pos.clone(), colors: [], lastPress: -9 };
    const ok = ctx.foot.script({
        update: (dt, P) => { if (by.blend !== B) return false; return stepBlend(by, B, dt, P); },
        camera: dt => { if (by.blend !== B) return false; blendCam(by, dt); return true; },
        abort: () => { if (by.blend === B) endBlend(by, "abort"); },
    });
    if (!ok) { by.blend = null; return false; }
    if (ctx.cutscene) ctx.cutscene.begin("communityBlend", { onSkip: () => { if (by.blend === B) B.auto = true; } });
    if (ctx.foot.dropChase) ctx.foot.dropChase();
    disguise(B, true);
    H.toast(BY.disguise, "pink", { key: "cm-by" });
    sfx.good();
    // the pursuer: a cop (or a Shomer) walks right past the line, looking for a pink convertible lady
    if (!by.pursuer) {
        const key = CM.chase ? "community_shomer" : "copPerson";
        const p = getPerson(models[key] ? key : "npcMan");
        if (p) { by.pursuer = { p, t: 0 }; const q = loopAt(by, by.head + 12); p.obj.position.set(q.x + by.spot.nx * 2.2 + by.spot.ux * 14, 0, q.z + by.spot.nz * 2.2 + by.spot.uz * 14); }
    }
    emit("community:by", { phase: "blend" });
    stat("communityBlendTries", 1);
    return true;
}
function disguise(B, on) {
    const o = ctx.foot.obj;
    if (!o) return;
    if (on) {
        o.traverse(m => {
            if (!m.isMesh || !m.material) return;
            const c = { Top: "#9CC8EE", Bottom: "#1F2D63", Tights: "#1F2D63", Skirt: "#1F2D63" }[m.material.name];
            if (!c) return;
            B.colors.push({ m, orig: m.material });
            m.material = m.material.clone();
            m.material.color.set(c);
        });
    } else {
        for (const { m, orig } of B.colors) { if (m.material !== orig) { m.material.dispose(); m.material = orig; } }
        B.colors.length = 0;
    }
}
function blendCam(by, dt) {
    const lp = ctx.foot.pos, S = by.spot;
    _a.set(lp.x + S.nx * 6.2 - S.ux * 2.2, 4.8, lp.z + S.nz * 6.2 - S.uz * 2.2);   // (high enough to clear the parked minivans)
    _b.set(lp.x + S.ux * 1.5, 1.1, lp.z + S.uz * 1.5);
    ctx.cam.cinematic(_a, _b, dt, 2.2, 52);
}

function stepBlend(by, B, dt, P) {
    B.t += dt;
    const L1 = ctx.foot.person, F = ctx.foot.pos;
    const target = loopAt(by, by.head + B.p);
    if (B.phase === "join") {
        // slip in at the back of the line
        const dx = target.x - F.x, dz = target.z - F.z, d = Math.hypot(dx, dz);
        const k = Math.min(d, 3.4 * dt) / (d || 1);
        F.x += dx * k; F.z += dz * k;
        if (L1) { L1.obj.position.set(F.x, 0.05, F.z); L1.face(target.x, target.z, dt, 10); L1.update(dt, { walk: d > 0.2 ? 3 : 0 }); }
        by.head += SPEED * dt;
        if (d < 0.3 || B.t > 2.4) { B.phase = "walk"; B.t = 0; luluSay(pick(BY.lulu), 2.6); }
        render(by, B);
        return true;
    }
    if (B.phase === "end") {
        B.endT = (B.endT || 0) + dt;
        if (L1) L1.update(dt, {});
        if (B.endT > 1.2) { endBlend(by, B.result); return false; }
        return true;
    }
    // walking in the line, in step
    by.head += SPEED * dt;
    F.x = target.x; F.z = target.z;
    if (L1) { L1.obj.position.set(F.x, 0.05, F.z); L1.obj.rotation.y = Math.atan2(target.hx, target.hz); L1.update(dt, { walk: B.look > 0 ? 0 : SPEED }); }
    const pressed = !!(P && P.interact);
    // the menahel's look: a warning beat, then she must not move a muscle
    if (B.look > 0) {
        B.look -= dt;
        by.look = B.look;
        const press = B.auto ? false : pressed;
        if (press) { B.sus += 0.3; sfx.bad(); bubble(L1 && L1.obj, pick(BY.giggle), 1.2, "pink"); if (by.menahel) bubble(by.menahel.obj, pick(BY.suspicious), 2, "cop"); }
        if (B.look <= 0) { B.looks++; by.look = 0; B.lookT = rand(3.2, 4.8); B.nextBeat = B.t + 0.4; sfx.good(); }
    } else {
        B.lookT -= dt;
        if (B.lookT <= 0 && B.ok >= 2) { B.look = 1.5; by.look = 1.5; sfx.tick(true); if (by.menahel) bubble(by.menahel.obj, "👀", 1.4, "cop"); }
        if (B.nextBeat == null) B.nextBeat = B.t + 0.5;
        // the beat: hit it in the window (auto = ⏭ skip / tests: perfect)
        const dtB = B.t - B.nextBeat;
        if (B.auto && Math.abs(dtB) < 0.05) hit(B);
        else if (pressed && B.t - B.lastPress > 0.12) {
            B.lastPress = B.t;
            if (Math.abs(dtB) <= WINDOW) hit(B);
            else if (dtB < -WINDOW) { B.sus += 0.12; sfx.bad(); }
        }
        if (dtB > WINDOW) {
            if (!B.hit.has(B.beatN)) { B.sus += 0.1; }
            B.beatN++; B.nextBeat += PERIOD;
            sfx.tick(false);
        }
    }
    B.sus = clamp(B.sus - dt * 0.02, 0, 1.2);
    // the pursuer strolls past, none the wiser
    const Pp = by.pursuer;
    if (Pp) {
        Pp.t += dt;
        const o = Pp.p.obj, S = by.spot;
        o.position.x -= S.ux * 1.6 * dt; o.position.z -= S.uz * 1.6 * dt;
        Pp.p.obj.rotation.y = Math.atan2(-S.ux, -S.uz) + Math.sin(Pp.t * 2) * 0.6;
        Pp.p.update(dt, { walk: 1.6 });
        if (!Pp.said && Pp.t > 2.2) { Pp.said = true; bubble(o, pick(BY.pursuer), 2.8, "cop"); }
    }
    if (B.sus >= 1) { fail(by, B); return true; }
    if (B.ok >= NEED && B.looks >= 1) { win(by, B); return true; }
    render(by, B);
    return true;
}
function hit(B) {
    if (B.hit.has(B.beatN)) return;
    B.hit.add(B.beatN);
    B.ok++;
    B.sus = Math.max(0, B.sus - 0.04);
    sfx.tick(true);
}
function win(by, B) {
    B.phase = "end"; B.result = "win";
    if (by.menahel) bubble(by.menahel.obj, "Good, girls. Very straight. Very good.", 2.4, "cop");
    sfx.win();
    H.banner(`<b>${pick(BY.win)}</b><small>the heat's off — act natural</small>`, 2600, { key: "community-by", prio: 2 });
    try { if (ctx.law && ctx.law.clearHeat) ctx.law.clearHeat("🎀 Blended right in — the heat's off!"); } catch (e) { console.error(e); }
    if (ctx.foot.dropChase) ctx.foot.dropChase();
    if (CM.chase) endShomrim("blend");
    addScore(400, "blendIn");
    stat("communityBlends", 1);
    CM.stats.blends++;
    if (CM.save) { CM.save.blends = (CM.save.blends || 0) + 1; if (CM.saveSoon) CM.saveSoon(); }
    render(by, B, true);
}
function fail(by, B) {
    B.phase = "end"; B.result = "fail";
    if (by.menahel) bubble(by.menahel.obj, pick(BY.caught), 2.8, "cop");
    sfx.bad();
    H.toast("🎀 Cover blown!", "red");
    render(by, B, true);
}
export function endBlend(by, result) {
    const B = by.blend;
    if (!B) return;
    by.blend = null;
    by.look = 0;
    if (ctx.cutscene) ctx.cutscene.end("communityBlend");
    if (card) { card.remove(); card = null; }
    if (ctx.foot && ctx.foot.active) disguise(B, false);
    if (result === "fail") {
        // the pursuer turns round: RUN
        const Pp = by.pursuer;
        if (ctx.law && ctx.law.wanted > 0 && ctx.foot.startChase) ctx.foot.startChase(Pp ? { x: Pp.p.obj.position.x, z: Pp.p.obj.position.z } : null);
        if (CM.chase) CM.chase.unseenT = 0;
    }
    if (by.pursuer) by.pursuer = putPerson(by.pursuer.p);
    emit("community:by", { phase: "end", result });
}
function render(by, B, final = false) {
    if (!card) { card = document.createElement("div"); card.className = "cm-blend"; H.hudSlot("center").appendChild(card); }
    const look = B.look > 0;
    const dots = Array.from({ length: NEED }, (_, i) => `<i class="${i < B.ok ? "on" : ""}${i === B.ok && !final ? " now" : ""}"></i>`).join("");
    const k = B.nextBeat != null ? clamp(1 - Math.abs(B.t - B.nextBeat) / PERIOD, 0, 1) : 0;
    const how = look ? BY.look : B.phase === "join" ? "slipping into the line…" : `${glyph("interact")} STEP on the beat ${"•".repeat(Math.round(k * 3))}`;
    const html = `<b>${final ? (B.result === "win" ? "🎀 BLENDED IN" : "🙅‍♀️ COVER BLOWN") : BY.title}</b><div class="dots">${dots}</div><div class="sus"><i style="width:${(clamp(B.sus, 0, 1) * 100).toFixed(0)}%"></i></div><small>${final ? "" : how}</small>`;
    card.classList.toggle("look", look);
    if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
}
