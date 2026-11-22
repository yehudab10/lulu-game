// features/shops/dealer.js — 🚗 UNCLE REFAEL'S PRE-LOVED CARS: the cars stand on a lot in each town (town data
// `uses.dealer`, shops/lot.js), price boards out front, Uncle Refael at the showroom door. On foot on the sidewalk:
//   ✋ at a car        → the car card: every car on the lot as a tile (D-pad walks the camera down the row), the
//                        focused one's stats bars + flavour line + price; buy = ask, then buy (shops/card.js);
//                        🔑 TEST DRIVE (solo): a soft cut and she's in it at the kerb — 60 s, bring it back;
//                        🔑 DRIVE IT HOME (a car she owns): she drives off in it (her old car goes home).
//   ✋ at the door     → Refael's hello + the card on the cheapest car she doesn't own.
// The focused car is lifted out of the town's merge (its `tag`) and the REAL model stands there while she looks.
// Buying writes the shared save exactly like the old Shop (garage/buy.js): ownedSkins + selectedSkin, so a new car is
// her ride at once — she drives it off the lot (her old one waits in her garage at home).
import * as THREE from "three";
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { models, cloneWithColors, findNodes, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { SKINS } from "../../car.js";
import * as H from "../../hud.js";
import { SKIN_SHOP, STAT_ROWS, statFill, skinClass, inv, syncInv } from "../garage/data.js";
import { buyCar, owns, equipSkin } from "../garage/buy.js";
import { hideTagged } from "../town/kit.js";
import { kerbAt } from "../places/out.js";
import { beacon, hideBeacon } from "../openworld/marks.js";
import { openCard, cardTick, cardOpen, closeCard, cardSay, cardFocus } from "./card.js";
import { LOT } from "./lot.js";
import { REFAEL, PASS_DEALER } from "./data.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString("en-US");
export const TEST = { secs: 60, back: 14 };

// ── where / when ─────────────────────────────────────────────────────────
const inTown = () => !!(ctx.town && ctx.town.active);
const spot = name => (inTown() && ctx.town.spot ? ctx.town.spot(name) : null);
const party = () => !!(ctx.party && ctx.party.active);
const roam = () => party() && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
/** On foot in a town, nothing more urgent going on: the lot is open. */
export function canShop() {
    if (!inTown() || ctx.state !== "footRun" || !ctx.foot || !ctx.foot.pos) return false;
    if (party() && !roam()) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || ctx.foot.chasing) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return !!spot("dealer");
}
const near = (sp, r) => { const p = ctx.foot && ctx.foot.pos; return !!(sp && p && (sp.x - p.x) ** 2 + (sp.z - p.z) ** 2 < r * r); };

// ── the ✋ spots ──────────────────────────────────────────────────────────
function carLabel(k) {
    syncInv();
    const sk = SKINS[k];
    if (inv.ownedSkins.includes(k)) return `🚗 ${sk.name.toUpperCase()} · ✓ YOURS`;
    return `🚗 ${sk.name.toUpperCase()} · ${fmt(SKIN_SHOP[k].price)} 💰`;
}
/** A ✋ spot that reaches as far as she'd naturally stand: `sp` slid toward her along its own axes — u (along the
 *  street) within [u0, u1], n (toward the street) within [n0, n1] — so the prompt is up anywhere in that strip, not only
 *  on the one square metre in front of the board. (She used to get nothing standing next to the car, or next to him.) */
function reach(sp, u0, u1, n0, n1) {
    const p = ctx.foot.pos, dx = p.x - sp.x, dz = p.z - sp.z;
    const u = Math.max(u0, Math.min(u1, dx * sp.ux + dz * sp.uz)), n = Math.max(n0, Math.min(n1, dx * sp.nx + dz * sp.nz));
    return { x: sp.x + sp.ux * u + sp.nx * n, z: sp.z + sp.uz * u + sp.nz * n };
}
function lotSpot(k) {
    return {
        // (her car's whole bay: from the kerb side of the sidewalk to the back of the lot, half a gap either side)
        r: 2.1, short: "CAR",
        pos() {
            if (!canShop() || D.busy) return null;
            const sp = spot("lot_" + k);
            return sp && near(sp, 30) ? reach(sp, 0, 0, -6.2, 2.6) : null;
        },
        label: () => carLabel(k),
        act: () => openLot(k),
    };
}
const doorSpot = {
    // (the door AND the man: he stands 2.2 m along from it, and walking up to HIM is what anyone does first)
    r: 2.4, short: "REFAEL",
    pos() {
        if (!canShop() || D.busy) return null;
        const sp = spot("dealer");
        return sp && near(sp, 30) ? reach(sp, -3.2, 1.2, -1.2, 2.6) : null;
    },
    label: () => "🚗 UNCLE REFAEL'S — BROWSE",
    act() {
        syncInv();
        const k = LOT.filter(x => !inv.ownedSkins.includes(x)).sort((a, b) => SKIN_SHOP[a].price - SKIN_SHOP[b].price)[0] || LOT[0];
        if (D.refael) refaelSay(pick(REFAEL.hello), 3.2);
        return openLot(k);
    },
};

// ── Uncle Refael (spawned when she's near the lot; gone when she's not) ──
const D = { refael: null, lifted: null, script: false, busy: false, said: false, t: 0, cam: null };
function refaelSay(text, sec = 2.8) { if (D.refael && ctx.foot && ctx.foot.say) ctx.foot.say(D.refael.obj, text, sec); }
function refaelTick(dt) {
    const sp = inTown() ? spot("dealer") : null;
    const p = (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
    // (only while she's on foot nearby: a person is ~15 draw calls — the town's budget is measured driving through)
    const want = !!(sp && p && ctx.foot && ctx.foot.active && (ctx.state === "footRun" || cardOpen()) && (sp.x - p.x) ** 2 + (sp.z - p.z) ** 2 < 45 * 45);
    if (!want) { dropRefael(); return; }
    if (!D.refael) {
        if (!models.npcMan) { ensureModels(["npcMan"]).catch(() => {}); return; }
        D.refael = spawnPerson("npcMan", { colors: REFAEL.colors });
        D.refael.obj.name = "UncleRefael";
        ctx.scene.add(D.refael.obj);
        // (beside the door, on the lot side, facing the street)
        D.refael.obj.position.set(sp.x - sp.nx * 0.6 - sp.ux * 2.2, 0, sp.z - sp.nz * 0.6 - sp.uz * 2.2);
        D.refael.obj.rotation.y = Math.atan2(sp.nx, sp.nz);
    }
    const m = D.refael, fp = ctx.foot && ctx.foot.active ? ctx.foot.pos : null;
    const close = fp && (fp.x - m.obj.position.x) ** 2 + (fp.z - m.obj.position.z) ** 2 < 14 * 14;
    if (close) m.face(fp.x, fp.z, dt, 4);
    m.update(dt, { wave: close && !D.said, talk: cardOpen() });
    if (close && !D.said && ctx.state === "footRun") {
        D.said = true;
        refaelSay(pick(REFAEL.hello), 3.4);
    }
    // Lulu walking past, once a visit
    if (!D.passed && fp && sp && near(sp, 18) && !cardOpen()) {
        D.passed = true;
        if (ctx.foot.obj && Math.random() < 0.6) setTimeout(() => { if (ctx.foot && ctx.foot.obj && !D.said) ctx.foot.say(ctx.foot.obj, pick(PASS_DEALER), 2.6); }, 900);
    }
}
function dropRefael() {
    if (!D.refael) return;
    ctx.scene.remove(D.refael.obj);
    D.refael = null;
}

// ── the real car on the lot (the focused one) ────────────────────────────
function lift(k) {
    if (D.lifted && D.lifted.k === k) return;
    drop();
    const sp = spot("lot_" + k);
    if (!sp || !models.lulu) return;
    const sk = SKINS[k];
    const obj = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
    for (const n of [...findNodes(obj, "Driver"), ...findNodes(obj, "Hair_")]) n.visible = false;
    obj.position.set(sp.cx, 0, sp.cz);
    obj.rotation.y = sp.rot;
    obj.name = "LotCar_" + k;
    ctx.scene.add(obj);
    if (sp.tag) hideTagged(sp.tag, true);
    D.lifted = { k, obj, tag: sp.tag || null, sp };
}
function drop() {
    if (!D.lifted) return;
    ctx.scene.remove(D.lifted.obj);
    if (D.lifted.tag) hideTagged(D.lifted.tag, false);
    D.lifted = null;
}
/** Hide / show a car's merged copy (it's out on a test drive). */
function hideLot(k, hide) { const sp = spot("lot_" + k); if (sp && sp.tag) hideTagged(sp.tag, hide); }

// ── the card ─────────────────────────────────────────────────────────────
function statsHtml(k) {
    const sk = SKINS[k], shop = SKIN_SHOP[k];
    const rows = STAT_ROWS.map(([lab, key]) => `<div><span class="sp-stat">${lab}</span><span class="sp-bar"><i style="width:${Math.round(statFill(sk[key]) * 100)}%;background:linear-gradient(90deg, ${sk.dark}, ${sk.body})"></i></span></div>`).join("");
    return `<b>${sk.name}</b><span class="sp-chip">${skinClass(sk)}</span> — <i>${shop.flavor}</i><div class="sp-stats">${rows}</div>`;
}
function canTest() {
    return !party() && !!ctx.foot && (ctx.foot.ownCar === "parked" || ctx.foot.ownCar === "ok") && !TD.on;
}
function tiles() {
    return LOT.map(k => ({
        id: k, name: SKINS[k].name, dot: SKINS[k].body, price: SKIN_SHOP[k].price,
        state: () => (owns("car", k) ? (inv.selectedSkin === k ? "placed" : "owned") : "buy"),
        tag: () => (owns("car", k) ? (inv.selectedSkin === k ? "✓ Driving it" : "Yours") : ""),
        desc: () => owns("car", k) ? pick(REFAEL.owned) : "",
        act: () => { if (owns("car", k) && inv.selectedSkin !== k) cardSay(`Yours! ✋ <b>🔑 Drive it off the lot</b> — or swap any time in your garage at home.`); },
        buy: () => buyHere(k),
    }));
}
function buyHere(k) {
    const r = buyCar(k, { equip: false });
    if (!r.ok) {
        if (r.why === "poor") refaelSay(pick(REFAEL.poor));
        return r;
    }
    const sk = SKINS[k];
    H.toast(`🎉 ${sk.name} is yours! Uncle Refael tosses you the keys 🔑`, "gold", { prio: 3, key: "shopsBuy" });
    refaelSay(pick(REFAEL.bought), 3.4);
    emit("shops:car", { id: k, how: "bought" });
    // (a brand-new car is her ride now — like the old Shop: she drives it off the lot; the old one goes home)
    setTimeout(() => { if (cardOpen()) { closeCard(true); endScript(); } driveOff(k, "bought"); }, 650);
    return r;
}
export function openLot(k) {
    if (!canShop() || D.busy || !ctx.foot.script) return false;
    syncInv();
    const cam = ctx.camera;
    D.cam = { pos: cam.position.clone(), look: new THREE.Vector3(), k };
    cam.getWorldDirection(D.cam.look).multiplyScalar(6).add(cam.position);
    const ok = ctx.foot.script({
        update(dt, P, F) {
            const sp = spot("lot_" + (cardFocus() || k));
            if (F.lulu && sp) { F.lulu.face(sp.cx, sp.cz, dt, 6); F.lulu.update(dt, { walk: 0 }); }
            const open = cardTick(P);
            if (!open) { drop(); D.script = false; }
            return open;
        },
        camera: dt => lotCamera(dt),
        abort() { if (cardOpen()) closeCard(true); drop(); D.script = false; },
    });
    if (!ok) return false;
    D.script = true;
    openCard({
        title: "🚗 Uncle Refael's Pre-Loved Cars",
        head: id => statsHtml(id || k),
        tiles: tiles(),
        focus: k,
        onFocus: id => { lift(id); D.cam.k = id; },
        buttons: [
            { id: "test", label: id => `🔑 Test drive the ${SKINS[id].name}`, visible: id => !owns("car", id) && canTest(), action: id => { closeCard(true); endScript(); startTest(id); } },
            { id: "drive", label: id => `🔑 Drive it off the lot`, visible: id => owns("car", id) && inv.selectedSkin !== id && !party(), action: id => { closeCard(true); endScript(); driveOff(id, "owned"); } },
        ],
        onClose: () => { drop(); },
    });
    emit("stat", { id: "shopsVisits", n: 1 });
    emit("shops:open", { place: "dealer", town: ctx.town.id });
    return true;
}
function endScript() {
    // (the card closed by a button: the foot script ends on its next frame — cardTick returns false)
    drop();
}
function lotCamera(dt) {
    const sp = spot("lot_" + (D.cam && D.cam.k));
    if (!sp) return false;
    const cam = ctx.camera, portrait = cam.aspect < 1;
    // (from the street side, a little toward the lot's far end — away from the showroom, its tube guy and its corner)
    const dsp = spot("dealer"), away = dsp ? Math.sign((sp.cx - dsp.x) * sp.ux + (sp.cz - dsp.z) * sp.uz) || 1 : 1;
    const back = portrait ? 8.2 : 6.4, side = (portrait ? 1.6 : 2.6) * away;
    const tgt = new THREE.Vector3(sp.cx + sp.nx * back + sp.ux * side, portrait ? 3.6 : 2.9, sp.cz + sp.nz * back + sp.uz * side);
    const aim = new THREE.Vector3(sp.cx, portrait ? -1.3 : -0.9, sp.cz);    // (aimed under it: the car sits above the card)
    const k = 1 - Math.exp(-dt * 3.5);
    D.cam.pos.lerp(tgt, k); D.cam.look.lerp(aim, k);
    cam.position.copy(D.cam.pos); cam.lookAt(D.cam.look);
    const fov = portrait ? 66 : 52;
    cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
    if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
    return true;
}

// ── driving one off the lot (a car she owns: for good · a test drive: 60 s) ──
/** Put her in skin k at the kerb in front of its spot (a soft cut). Her own car (wherever she left it) is "brought round". */
function seatAtKerb(k, how) {
    const sp = spot("lot_" + k);
    if (!sp || !ctx.foot || !ctx.foot.drive) return false;
    const kb = kerbAt(sp, 0);
    const swap = () => {
        drop();
        if (ctx.car.skinKey !== k) ctx.car.setSkin(k);
        ctx.foot.drive({ own: true, x: kb.x, z: kb.z, h: kb.h, how });
        if (ctx.car.showDriver) ctx.car.showDriver(true);
    };
    if (ctx.dissolve && !ctx.skipping) ctx.dissolve(swap); else swap();
    return true;
}
function driveOff(k, why) {
    if (!inTown()) { equipSkin(k); return false; }
    equipSkin(k);                      // (the shared save's selectedSkin + the 3D car — before the swap: the stub goes)
    const ok = seatAtKerb(k, "dealer");
    if (ok) {
        hideLot(k, true);
        TD.gone = TD.gone || new Set(); TD.gone.add(k);
        setTimeout(() => H.toast(`🔑 ${SKINS[k].name} — off the lot! Your other cars wait in your garage at home 🏠`, "pink", { prio: 2, key: "shopsDrive" }), 500);
    }
    emit("shops:car", { id: k, how: why === "bought" ? "drove-new" : "drove" });
    return ok;
}

// ── the test drive ───────────────────────────────────────────────────────
const TD = { on: false, k: null, orig: null, t: 0, chip: null, gone: null, ending: false };
export function startTest(k) {
    if (!canTestFrom() || !spot("lot_" + k)) return false;
    Object.assign(TD, { on: true, k, orig: ctx.car.skinKey, t: 0, ending: false, town: ctx.town.id });
    refaelSay(pick(REFAEL.testStart), 3);
    if (!seatAtKerb(k, "testDrive")) { TD.on = false; return false; }
    hideLot(k, true);
    emit("stat", { id: "shopsTestDrives", n: 1 });
    emit("shops:test", { id: k, phase: "start" });
    return true;
}
function canTestFrom() { return canShop() && !party() && (ctx.foot.ownCar === "parked" || ctx.foot.ownCar === "ok"); }
function chip(text) {
    if (!text) { if (TD.chip) { TD.chip.remove(); TD.chip = null; } return; }
    if (!TD.chip) { TD.chip = document.createElement("div"); TD.chip.className = "day-chip shops-chip"; H.hudSlot("left").appendChild(TD.chip); }
    if (TD.chip.dataset.t !== text) { TD.chip.dataset.t = text; TD.chip.innerHTML = text; }
}
function testTick(dt) {
    if (!TD.on || TD.ending) return;
    if (ctx.paused) return;          // (the HUD keeps ticking under the pause menu: the 60 s — and "time's up" — must not)
    const st = ctx.state;
    if (st === "playing") TD.t += dt;
    const left = Math.max(0, TEST.secs - TD.t);
    const sp = inTown() ? spot("lot_" + TD.k) : null;
    const kb = sp ? kerbAt(sp, 0) : null;
    if (kb) beacon("shopsTest", kb.x, kb.z, "#FF4F9A", 2.4, 16); else hideBeacon("shopsTest");
    chip(`🔑 Test drive · <span class="ok">${Math.ceil(left)} s</span><small>bring the ${SKINS[TD.k].name} back to Uncle Refael's</small>`);
    if (!inTown()) { endTest("left"); return; }
    if (st === "footRun") { endTest("out"); return; }
    if (st !== "playing") return;
    const c = ctx.car;
    const back = kb && TD.t > 6 && Math.hypot(c.pos.x - kb.x, c.pos.z - kb.z) < TEST.back && Math.abs(c.speed || c.vF || 0) < 1.6;
    if (back) endTest("back");
    else if (left <= 0) endTest("time");
}
/** End the test drive. why: back (parked at the lot) | time | out (she got out) | left (out of town) | abort (a scene took over). */
export function endTest(why = "back") {
    if (!TD.on || TD.ending) return false;
    TD.ending = true;
    hideBeacon("shopsTest");
    chip("");
    const k = TD.k, orig = TD.orig, finish = () => {
        TD.on = false; TD.ending = false;
        if (!(TD.gone && TD.gone.has(k))) hideLot(k, false);
        emit("shops:test", { id: k, phase: "end", why });
    };
    const restore = () => { if (ctx.car.skinKey !== orig) ctx.car.setSkin(orig); };
    if (why === "abort") { restore(); finish(); return true; }
    if (why === "left") {
        // (she drove it out of town: Yossi swaps them back at the next light — her own car, right where she is)
        const sw = () => { restore(); };
        if (ctx.dissolve && !ctx.skipping) ctx.dissolve(sw); else sw();
        H.toast("📱 Uncle Refael: “Yossi swapped them back at the light. Next time, come back.” 🔑", "", { prio: 2, key: "shopsTest" });
        finish();
        return true;
    }
    // back on the lot: on her feet on the sidewalk by the car's spot, her OWN car at the kerb out front
    const sp = spot("lot_" + k);
    const swap = () => {
        restore();
        if (!sp || !ctx.foot || !ctx.foot.start) return;
        if (ctx.foot.active) ctx.foot.end("shops");
        const kb = kerbAt(sp, 6), c = ctx.car;
        c.place(kb.x, kb.z, kb.h); c.s = kb.s; c.d = kb.d; c.vx = c.vz = c.vF = 0;
        const face = Math.atan2(-sp.nx, -sp.nz);
        ctx.foot.start("droveOff", { at: { x: sp.x - sp.nx * 0.4, z: sp.z - sp.nz * 0.4 }, face, noIntro: true, drivable: true, line: "" });
        D.said = true;
        setTimeout(() => refaelSay(pick(REFAEL.testBack), 3.4), 500);
    };
    try { if (ctx.dissolve && !ctx.skipping) ctx.dissolve(swap); else swap(); } catch (e) { console.error("[shops] test end", e); restore(); }
    finish();
    return true;
}

// ── wiring ───────────────────────────────────────────────────────────────
on("boot", () => {
    if (!ctx.foot || !ctx.foot.addSpot) return;
    ctx.foot.addSpot(doorSpot);
    for (const k of LOT) ctx.foot.addSpot(lotSpot(k));
});
hook("hud", dt => {
    try { refaelTick(dt); testTick(dt); } catch (e) { console.error("[shops] dealer", e); }
});
// (a scene that isn't driving / walking takes over mid test drive — an arrest, the ER, a knock-out: the car goes back)
on("state", ({ to }) => {
    if (TD.on && !TD.ending && !["playing", "footRun", "paused", "intro"].includes(to) && !(ctx.states[to] && ctx.states[to].driving && to !== "wrecked")) endTest("abort");
});
on("wreck", () => { if (TD.on) endTest("abort"); });
on("run:start", () => { if (TD.on) endTest("abort"); TD.gone = null; });
on("title", () => { if (TD.on) endTest("abort"); dropRefael(); drop(); TD.gone = null; });
on("town:enter", () => { D.said = false; D.passed = false; TD.gone = null; });
on("town:leave", () => { dropRefael(); drop(); D.said = false; D.passed = false; });

export const dealerDebug = { D, TD, TEST, openLot, startTest, endTest, canShop, canTest: canTestFrom, lift, drop };
