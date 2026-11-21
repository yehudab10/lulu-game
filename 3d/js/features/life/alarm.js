// features/life — 🚨 CAR ALARMS (round 2). Bumping a parked car in town already shoves it and plays a few rising
// whoops (features/town/parked.js). This adds what you'd SEE and hear next: its hazard lights blink amber for ~5 s, the
// alarm carries on (WHOOP-WHOOP-WHOOP… BEEP BEEP BEEP — positional, it follows the car, ⚙️ 🐦 Street sounds), and
// the owner shows up in a speech bubble — whoever's standing nearest ("Nu?! That's MY car!"), or a window in the
// nearest house ("Turn that thing OFF! People are SLEEPING!"). Never a toast; the line shares life's line budget.
// The lights are glows in puffs.js' mesh (no extra draw call). Local + cosmetic (a party: only the bumper sees it).
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { L, stats, soundsOn, npcLine, homeWorld, rand, countSound } from "./common.js";
import { play } from "./sounds.js";
import { glow } from "./puffs.js";

export const ALARM = { dur: 5.2, blink: 0.5, onFor: 0.28, tailAt: 1.15, lineAt: 1.8, show: 150 };
const OWNER = ["Nu?! That's MY car!", "Who's banging on my minivan?!", "Gevalt — the ALARM! The BABY!", "Again with the alarm?!", "Yanky, is that you?!", "I JUST had it washed!"];
const WINDOW = ["WHOSE car is that?!", "Some of us are trying to DAVEN here!", "Turn that thing OFF!", "Ten years on this block. TEN YEARS."];
const WINDOW_NIGHT = ["Turn that thing OFF! People are SLEEPING!", "It's the middle of the NIGHT!"];
// round 3: a FUMBLED HOTWIRE (foot's `foot:hotwireFail`) sets the alarm off too — the owner has words about THAT
const OWNER_HW = ["HEY! Get away from my car!", "Young lady! That is NOT your car!", "Shomrim! SHOMRIM!", "I can SEE you, you know!", "Nice try. Very nice try."];
const WINDOW_HW = ["I SEE you! Leave the car ALONE!", "I'm calling Shomrim! I'm DIALING!", "Not on MY block!"];
const pick = a => a[Math.floor(Math.random() * a.length)];

export const AL = { list: [], alarms: 0, lines: 0, blinks: 0, hotwires: 0 };
const BOX = new Map();                   // model key → its four lamp corners (model-local), measured once
const _v = new THREE.Vector3(), _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
function corners(key, obj) {
    if (BOX.has(key)) return BOX.get(key);
    const box = new THREE.Box3(), b = new THREE.Box3();
    obj.updateMatrixWorld(true);
    _inv.copy(obj.matrixWorld).invert();
    obj.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        b.copy(o.geometry.boundingBox).applyMatrix4(_rel.multiplyMatrices(_inv, o.matrixWorld));
        box.union(b);
    });
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.9, 0, -2.3), new THREE.Vector3(0.9, 1.6, 2.3));
    const y = box.min.y + (box.max.y - box.min.y) * 0.42, x = box.max.x - 0.14, x0 = box.min.x + 0.14;
    const c = [[x0, y, box.max.z + 0.03], [x, y, box.max.z + 0.03], [x0, y, box.min.z - 0.03], [x, y, box.min.z - 0.03]];
    BOX.set(key, c);
    return c;
}

function start(e, hw) {
    if (!ctx.enabled("life") || !e || !e.obj) return null;
    let a = AL.list.find(x => x.obj === e.obj);
    if (a) { a.t = Math.min(a.t, 0.6); a.said = false; a.hw = hw; if (hw && a.tail) stop(a); return a; }
    if (AL.list.length >= 2) stop(AL.list.shift());
    a = { obj: e.obj, c: corners(e.key || "", e.obj), t: 0, tail: null, said: false, hw, anchor: new THREE.Object3D() };
    AL.list.push(a);
    AL.alarms++; stats.alarms = AL.alarms;
    return a;
}
on("town:parkedHit", e => { if (e && e.alarm) start(e, false); });
// a fumbled hotwire (in town or a car on the highway's shoulder): no shove whoops before it — the alarm starts at once
on("foot:hotwireFail", e => { const a = start(e, true); if (a) { a.t = Math.max(a.t, ALARM.tailAt - 0.15); AL.hotwires++; } });
function stop(a) { if (a && a.tail) { a.tail = a.tail.stop(0.15) || null; } }
/** Who answers: the nearest townsperson, else a window of the nearest house. */
function owner(a) {
    if (!L.town) return false;                     // (the highway's shoulder: nobody around to yell)
    const p = a.obj.getWorldPosition(_v);
    let best = null, bd = 28;
    try { for (const q of (ctx.town.people ? ctx.town.people() : [])) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } } } catch (e) { best = null; }
    if (best) { a.anchor.position.set(best.x, 0, best.z); a.anchor.updateMatrixWorld(); return npcLine(pick(a.hw ? OWNER_HW : OWNER), a.anchor, { dur: 2.6, cls: "angry" }); }
    let home = null; bd = 32;
    try { for (const h of ctx.town.homes || []) { const d = Math.hypot(h.lotX - p.x, h.lotZ - p.z); if (d < bd) { bd = d; home = h; } } } catch (e) { home = null; }
    if (!home) return false;
    const w = homeWorld(home, 0, 4.0, {});
    a.anchor.position.set(w.x, 3.2, w.z); a.anchor.updateMatrixWorld();
    return npcLine(pick(a.hw ? WINDOW_HW : L.night > 0.55 ? WINDOW_NIGHT : WINDOW), a.anchor, { dur: 2.6, cls: "angry" });
}
export function tickAlarm(dt) {
    if (!AL.list.length) return;
    for (let i = AL.list.length - 1; i >= 0; i--) {
        const a = AL.list[i];
        a.t += dt;
        if (a.t > ALARM.dur || !a.obj.parent || !L.on) { stop(a); AL.list.splice(i, 1); continue; }
        if (!a.tail && a.t >= ALARM.tailAt && a.t < ALARM.tailAt + 0.5 && soundsOn() && !L.quiet) { a.tail = play("lifeAlarm", a.obj, { gain: rand(0.9, 1) }); if (a.tail) countSound("lifeAlarm"); }
        if (!a.said && a.t >= ALARM.lineAt) { a.said = true; if (owner(a)) AL.lines++; }
        if ((a.t % ALARM.blink) > ALARM.onFor) continue;
        const m = a.obj.matrixWorld, mx = m.elements[12] - L.x, mz = m.elements[14] - L.z;
        if (mx * mx + mz * mz > ALARM.show * ALARM.show) continue;
        for (const c of a.c) { _v.set(c[0], c[1], c[2]).applyMatrix4(m); glow(_v.x, _v.y, _v.z, 1.0, 0.6, 0.08, 1.1); }
        AL.blinks++;
    }
}
export function alarmClear() { for (const a of AL.list) stop(a); AL.list.length = 0; }
export function alarmInfo() { return { live: AL.list.length, lit: AL.list.some(a => (a.t % ALARM.blink) <= ALARM.onFor), alarms: AL.alarms, hotwires: AL.hotwires, lines: AL.lines, blinks: AL.blinks, tail: AL.list.some(a => a.tail && a.tail.alive) }; }
