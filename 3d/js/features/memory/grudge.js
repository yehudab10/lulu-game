// features/memory — 😤 GRUDGES: the driver Lulu carjacked comes back.
//
// streets:carjack → we remember the driver (look, a name), the car model and its
// colour. In a LATER run, rarely, the same car (same model, same paint, the same
// person at the wheel) creeps up in the next lane, pulls alongside, honks and yells.
// Then one of: just yells and leaves · tailgates her (brights flashing) · overtakes
// and brake-checks · calls the cops (a mild 1★) · forgives her (the grudge is gone).
// A grudge shows up at most 3 times, never two runs in a row, one per run.
//
// The car is an ordinary traffic car (core traffic, pooled) restyled with the
// remembered paint + a seated person; both are put back the way they were when
// the car is recycled. Crashing into it never costs a heart.
import { ctx, emit } from "../../core/ctx.js";
import { ensureModels, models } from "../../models.js";
import { kindSpec } from "../../traffic.js";
import { spawnPerson } from "../../core/people.js";
import { M, CAP, dirty, live, knobs, chance, pick, rand, clamp, fill, chatter } from "./data.js";
import * as T from "./lines.js";
import { honk } from "./sfx.js";

const PEOPLE = ["npcMan", "npcWoman", "copPerson"];
const TOPS = ["#81C784", "#4FC3F7", "#FFB74D", "#F06292", "#9575CD", "#E57373", "#4DB6AC"];
export const GR = { enc: null, encounters: 0, lastAct: null, sched: -1, tries: 0 };

// ── remembering ───────────────────────────────────────────────────────────
/** A carjack happened (streets:carjack payload) → a new grudge (the list is capped). */
export function addGrudge(e = {}) {
    if (!e || e.kind === undefined) return null;
    const look = e.driver && PEOPLE.includes(e.driver.key) ? e.driver : { key: e.kind === "cop" ? "copPerson" : pick(["npcMan", "npcWoman"]), colors: { Top: pick(TOPS) } };
    const names = T.GRUDGE_NAMES[look.key] || T.GRUDGE_NAMES.npcMan;
    const taken = new Set(M.grudges.map(g => g.name));
    const free = names.filter(n => !taken.has(n));
    const name = e.name || pick(free.length ? free : names);
    const rec = {
        id: "g" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        name, key: look.key, colors: look.colors || null,
        kind: e.kind || "sedan", color: typeof e.color === "string" ? e.color : null,
        run: M.runs, at: Date.now(), seen: 0, lastRun: -99,
    };
    M.grudges.push(rec);
    while (M.grudges.length > CAP.grudges) M.grudges.shift();
    dirty();
    return rec;
}
/** Grudges ripe for a visit this run (made in an EARLIER run, not seen last run). */
export function eligible() {
    return M.grudges.filter(g => g.run < M.runs && M.runs - (g.lastRun ?? -99) >= 2);
}

// ── when ─────────────────────────────────────────────────────────────────
/** Run start: maybe one grudge visit this run (≈ 40 %, 25 % on Quiet chatter), some time after 35–90 s of driving. */
export function scheduleGrudge() {
    GR.sched = -1; GR.tries = 0;
    if (!live() || !eligible().length) return;
    if (!chance(chatter() === "quiet" ? 0.25 : 0.4)) return;
    GR.sched = knobs.always ? 4 : rand(35, 90);
}
export function canMeet() {
    const G = ctx.G || {};
    if (!live() || ctx.state !== "playing" || ctx.paused || GR.enc) return false;
    if (G.tutorial || (ctx.foot && ctx.foot.active)) return false;
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted >= 2)) return false;
    if (ctx.hustle && ctx.hustle.job) return false;
    if (ctx.phone && ctx.phone.busy && ctx.phone.busy()) return false;
    if (ctx.multiplayer && ctx.multiplayer.inRace) return false;
    return ctx.car && ctx.car.speed > 9;
}
export function grudgeTick(dt) {
    if (GR.sched < 0 || ctx.state !== "playing") return;
    GR.sched -= dt;
    if (GR.sched > 0) return;
    if (!canMeet()) { GR.sched = 8; if (++GR.tries > 6) GR.sched = -1; return; }
    GR.sched = -1;
    const list = eligible();
    if (list.length) spawnGrudge(pick(list)).catch(e => console.error("[memory] grudge", e));
}

// ── the car ──────────────────────────────────────────────────────────────
const paintMats = new Map();
function paintMat(orig, hex) {
    const k = orig.uuid + hex;
    let m = paintMats.get(k);
    if (!m) { m = orig.clone(); m.color.set(hex); paintMats.set(k, m); }
    return m;
}
function restyle(c, hex) {
    const undo = [];
    if (!hex || c.kind === "cop") return undo;
    c.obj.traverse(o => {
        if (o.isMesh && o.material && o.material.name === "Paint") { undo.push([o, o.material]); o.material = paintMat(o.material, hex); }
    });
    return undo;
}
/** The driver's seat in car-local coords (x = left, z = forward) — streets knows each model's door. */
function seatOf(kind) {
    const R = ctx.streets && ctx.streets.rides && ctx.streets.rides[kind];
    if (R && R.half) return { x: R.half - 0.42, y: 0.12 + Math.max(0, R.y[0] - 0.42), z: R.fwd - 0.15 };
    return { x: 0.5, y: 0.12, z: 0.05 };
}
const laneOf = d => (d > 3.5 ? 5.25 : 1.75);

/**
 * The grudge car arrives now: rec (a grudge record, default: a random eligible one),
 * opts { act: "yell"|"tailgate"|"brakecheck"|"cops"|"forgive", behind: metres back }.
 * Resolves to the traffic car, or null.
 */
export async function spawnGrudge(rec = null, opts = {}) {
    rec = rec || pick(eligible().length ? eligible() : M.grudges);
    if (!rec || GR.enc || !ctx.traffic || !ctx.car) return null;
    const kind = kindSpec(rec.kind) ? rec.kind : "sedan";
    const spec = kindSpec(kind);
    const key = PEOPLE.includes(rec.key) ? rec.key : "npcMan";
    const token = GR.enc = { loading: true }, run = M.runs;
    try { await ensureModels([spec.model || kind, key]); } catch (e) { if (GR.enc === token) GR.enc = null; return null; }
    if (GR.enc !== token || M.runs !== run) return null;          // a new run started meanwhile
    if (!models[spec.model || kind] || !models[key] || (ctx.state !== "playing" && !opts.force)) { GR.enc = null; return null; }
    const car = ctx.car;
    const lane = laneOf(car.d) > 3.5 ? 1.75 : 5.25;
    const E = { rec, kind, lane, phase: "approach", pt: 0, t: 0, near: 0, said: {}, act: opts.act || knobs.act || pickAct(rec), car: null, person: null, undo: [], gone: false, bubbles: 0 };
    const c = ctx.traffic.add(kind, car.s - (opts.behind ?? 34), lane, 1, Math.max(car.speed, 10) + 7, {
        ai: (dt, cc) => drive(E, dt, cc), data: { memoryGrudge: rec.id }, noNearMiss: true,
        onRemove: () => cleanup(E),
    });
    E.car = c;
    c.onCrash = () => false;                        // a bump with a grudge never costs a heart
    E.undo = restyle(c, rec.color);
    try {
        const p = spawnPerson(key, { colors: key === "copPerson" ? null : rec.colors });
        const seat = seatOf(kind);
        p.obj.position.set(seat.x, seat.y, seat.z);
        p.update(0, { sit: true });
        c.obj.add(p.obj);
        E.person = p;
    } catch (e) { /* no driver model: the car alone still yells */ }
    GR.enc = E;
    GR.encounters++;
    GR.lastAct = E.act;
    rec.seen = (rec.seen || 0) + 1;
    rec.lastRun = M.runs;
    dirty();
    emit("memory:grudge", { name: rec.name, kind, color: rec.color, act: E.act, seen: rec.seen });
    return c;
}
function pickAct(rec) {
    const lawOk = ctx.law && !ctx.law.chasing;
    const w = [["yell", 34], ["tailgate", 20], ["brakecheck", 16], ["cops", lawOk ? 14 : 0], ["forgive", 10 + (rec.seen || 0) * 18]];
    let r = Math.random() * w.reduce((a, b) => a + b[1], 0);
    for (const [k, v] of w) { if ((r -= v) <= 0) return k; }
    return "yell";
}

function say(E, text, cls = "angry", dur = 3) {
    if (!text || ctx.skipping) return false;
    const msg = fill(text, { name: E.rec.name });
    E.bubbles++;
    E.lastLine = msg;
    try { return !!(ctx.banter && ctx.banter.bubble && ctx.banter.bubble(msg, E.car.obj, { cls, dur, y: 2.4 })); } catch (e) { return false; }
}
function luluReply(list) {
    if (chatter() === "quiet" || !chance(0.6) || !ctx.banter || !ctx.banter.say) return;
    try { ctx.banter.say(pick(list)); } catch (e) { /* no banter */ }
}
function go(E, phase) { E.phase = phase; E.pt = 0; }
function flash(E, on) {
    if (!E.car || !E.car.heads) return;
    for (const m of E.car.heads) m.emissiveIntensity = on ? (Math.sin(ctx.time * 26) > 0 ? 12 : 2) : 2;
}

/** The grudge car's driver (a traffic ai): position control along the road + the beats. */
function drive(E, dt, c) {
    const car = ctx.car;
    E.t += dt; E.pt += dt;
    let wantS = car.s + 0.4, wantD = E.lane, top = 40, brake = false;
    const her = laneOf(car.d);
    const clear = Math.abs(c.s - car.s) > 7.5;      // far enough fore / aft to change into her lane
    switch (E.phase) {
        case "approach":
            if (Math.abs(c.s - wantS) < 2.4 && Math.abs(c.d - E.lane) < 0.5) E.near += dt; else E.near = 0;
            if (E.near > 0.35) { go(E, "yell"); honk(E.kind); }
            else if (E.pt > 28) go(E, "leave");
            break;
        case "yell": {
            if (!E.said.yell) {
                E.said.yell = true;
                const kindLines = T.GRUDGE_KIND[E.kind] || [];
                say(E, pick(kindLines.length && Math.random() < 0.45 ? kindLines : T.GRUDGE_YELL));
                if (E.person) E.person.update(0, { sit: true, point: true });
            }
            if (E.pt > 1.6 && !E.said.reply) { E.said.reply = true; if (E.act !== "forgive") luluReply(T.LULU_REPLY); }
            if (E.pt > 3.2) go(E, E.act === "yell" ? "yell2" : E.act);
            break;
        }
        case "yell2":
            if (!E.said.y2) { E.said.y2 = true; if (chatter() !== "quiet") say(E, pick(T.GRUDGE_LEAVE), "angry", 2.2); }
            if (E.pt > 1.4) go(E, "leave");
            break;
        case "tailgate":
            wantS = car.s - 9.5;
            if (c.s < car.s - 6.5) wantD = her;
            flash(E, true);
            if (!E.said.tg && Math.abs(c.d - her) < 0.6) { E.said.tg = true; say(E, pick(T.GRUDGE_TAILGATE)); honk(E.kind, 3); }
            if (E.pt > 7) { flash(E, false); go(E, "leave"); }
            break;
        case "brakecheck":
            if (!E.said.bc0) {
                wantS = car.s + 19; top = car.speed + 12;
                if (c.s > car.s + 9 && clear) wantD = her;
                if (Math.abs(c.d - her) < 0.4 && c.s > car.s + 14) { E.said.bc0 = true; E.bt = 0; }
                if (E.pt > 9) go(E, "leave");
            } else {
                E.bt += dt;
                wantD = her;
                if (E.bt < 1.2) { brake = true; if (!E.said.bc) { E.said.bc = true; say(E, pick(T.GRUDGE_BRAKE)); } }
                else go(E, "leave");
            }
            break;
        case "cops":
            wantS = car.s - 2.5;
            if (!E.said.cop) { E.said.cop = true; say(E, pick(T.GRUDGE_COPS), "cop", 3.2); }
            if (E.pt > 3 && !E.said.called) {
                E.said.called = true;
                if (ctx.law && !ctx.law.chasing && ctx.state === "playing") {
                    try { ctx.law.startChase("GRAND THEFT AUTO (HE SAYS)", { heat: 1, msg: `🚨 ${E.rec.name.toUpperCase()} CALLED IT IN!` }); } catch (e) { /* no law */ }
                }
            }
            if (E.pt > 3.6) go(E, "leave");
            break;
        case "forgive":
            if (!E.said.fg) {
                E.said.fg = true;
                say(E, pick(T.GRUDGE_FORGIVE), "nice", 3.4);
                forgive(E.rec);
                if (E.person) E.person.update(0, { sit: true, wave: true });
                setTimeoutGame(E, 1.8, () => luluReply(T.LULU_FORGIVEN));
            }
            if (E.pt > 3.6) { E.leaveSlow = true; go(E, "leave"); }
            break;
        case "leave":
        default:
            wantS = E.leaveSlow ? car.s - 400 : car.s + 400;
            top = E.leaveSlow ? Math.max(8, car.speed - 6) : 34;
            if (!E.leaveSlow && c.s > car.s + 9) wantD = 5.25;
            break;
    }
    if (E.later && E.t >= E.later.t) { const f = E.later.fn; E.later = null; f(); }
    // speed: chase the wanted slot, gently
    if (brake) c.speed = Math.max(car.speed * 0.5, c.speed - 9 * dt);
    else {
        const err = wantS - c.s;
        const v = car.speed + clamp(err * 0.9, -10, 13);
        c.speed += clamp(v - c.speed, -11 * dt, 8 * dt);
    }
    // never drive INTO her: same lane, too close → match her speed
    if (Math.abs(c.d - car.d) < 2.3) {
        const gap = c.s - car.s;
        if (gap > 0 && gap < 6.5 && !brake) c.speed = Math.max(c.speed, car.speed + 0.5);
        if (gap < 0 && gap > -7) c.speed = Math.min(c.speed, Math.max(0, car.speed - 1));
    }
    c.speed = clamp(c.speed, 0, top);
    c.dTarget = wantD;
    const ds = wantD - c.d;
    c.d += Math.sign(ds) * Math.min(Math.abs(ds), 2.6 * dt);
    c.s += c.speed * dt;
    if (E.person) E.person.update(dt, { sit: true, talk: E.phase !== "leave" && E.phase !== "approach", wave: E.phase === "forgive" });
}
function setTimeoutGame(E, sec, fn) { E.later = { t: E.t + sec, fn }; }

export function forgive(rec) {
    const i = M.grudges.indexOf(rec);
    if (i >= 0) M.grudges.splice(i, 1);
    dirty();
}
function cleanup(E) {
    for (const [o, m] of E.undo) o.material = m;
    E.undo = [];
    if (E.person && E.person.obj.parent) E.person.obj.parent.remove(E.person.obj);
    E.person = null;
    if (E.car && E.car.heads) for (const m of E.car.heads) m.emissiveIntensity = 2;
    E.gone = true;
    if (GR.enc === E) GR.enc = null;
    // a grudge that's had its say three times moves on
    if (E.rec && E.rec.seen >= 3) forgive(E.rec);
}

/** Every driving frame (outside traffic's own loop): recycle a grudge car that's done. */
export function grudgeAfter() {
    const E = GR.enc;
    if (!E || !E.car || E.loading) return;
    const c = E.car, rel = c.s - ctx.car.s;
    if (!ctx.traffic.cars.includes(c)) { if (!E.gone) cleanup(E); return; }
    if (E.phase === "leave" && (rel > 320 || rel < -140)) ctx.traffic.remove(c);
}
/** Run start / title: the traffic is cleared anyway, forget the encounter. */
export function grudgeReset() {
    const E = GR.enc;
    if (E && E.car && !E.gone) { if (ctx.traffic.cars.includes(E.car)) ctx.traffic.remove(E.car); else cleanup(E); }
    GR.enc = null;
}
