// ─────────────────────────────────────────────────────────────────────────
//  features/homes — 🏠 LIVING TOWNS + BREAKING INTO HOUSES (Lakewood, Midwood; 🌍 Free Roam towns too).
//
//   crowd.js   the living town: instanced crowds on every sidewalk, porches, lawns, driveways, e-bikes,
//              porch lights at night, kids playing + a distant ice-cream truck; they wave, gossip, scatter, yell
//   house.js   a house from the inside (the interiors engine's Room, procedural rooms from homes_kit.glb):
//              residents with view cones + a "?"→"!" meter, items to grab and use on them, loot, the phone
//   rig.js     instanced rigs (people / dogs / props in ~5 draw calls each, a 70-triangle LOD figure)
//   data.js    families, lines, the item × resident reaction table, the knock outcomes, court lines
//
//  On foot in a town every front door is a ✋ spot: ✊ KNOCK (a kvetchy neighbour, a family mid-meal who
//  invites her in, a kid, nobody home — or a family that REMEMBERS her), 🔑 TRY THE DOOR, 🪟 SNEAK IN A
//  WINDOW. Out the door or out a window. A resident who gets to the phone calls it in: 📞 a law call-in, or
//  an instant foot chase when a cop is near; BURGLARY goes to court with its own lines; the family remembers.
//
//  ctx.homes { inside, house, homes(), enter(i, mode, via), knock(i), family(key), crowd(), debug }
//  Events: homes:enter {key, name, mode, via} · homes:exit {key, name, exit, reported} · homes:knock {key, outcome} ·
//          homes:use {item, who, fx, line} · homes:spotted · homes:called · homes:report {key, charges, chase} ·
//          homes:couch {coins, capped} · homes:grab · homes:cholent · homes:souvenir · homes:hit · homes:recognized ·
//          homes:wave · homes:gossip · homes:scatter · homes:honked · homes:talk · homes:jingle
//  Stats: homesVisits, homesBreakIns, homesItemUses, homesCouchCoins, homesSpotted, homesReported, homesWindowExits,
//         homesKnocks, homesGuest, homesCholent, homesSouvenirs, homesScatters, homesGossip, homesChats, homesLemonade
//  Random content (the crowd, ambient sound) is gated by ctx.enabled("homes").
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, addActor, pick } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { models, ensureModels, registerModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say, choose } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { tone } from "../interiors/fx.js";
import { C as CR, CROWD_MODELS, startCrowd, stopCrowd, tickCrowd, crowdHonk, crowdTalkSpot, crowdInfo, TUNE } from "./crowd.js";
import { RUN, VISIT, prepare, roomInfo, applyItem, DEF, plural, distract } from "./house.js";
import { current as currentRoom } from "../interiors/engine.js";
import { SURNAMES, FIRST, KINDS, PEOPLE_MODELS, KNOCK, LOCKED, UNLOCKED, TOWN_CFG, CHARGE, CHARGE_EXTRA, CALL_MSG, COURT_DIALOGUE, COURT_DEFENSE } from "./data.js";

registerModels(Object.assign({ homesKit: "homes_kit", homesItems: "homes_items", homesStreet: "homes_street", homesMail: "homes_mail", homesDelivery: "homes_delivery" }, PEOPLE_MODELS));

/** Persistent: every family Lulu has met (≤ 60), her souvenirs. */
const S = store("homes", { fam: {}, souvenirs: [] });
const HS = { homes: [], town: null, actor: false, scene: null, force: {}, log: [] };

// ── the doors of a town ──────────────────────────────────────────────────
// door positions in each model's frame (three.js: x = model +X, z = out the front), from the Blender builders
const DOORS = {
    town_duplex: { d: [[-2.8, 5.04], [2.8, 5.04]], light: 2.9 },
    town_townhouses: { d: [[-3.9, 5.74], [1.6, 5.74], [7.1, 5.74]], light: 2.4 },
    town_mw_house: { d: [[-2.15, 7.55]], light: 3.1 },
    town_mw_rowhouse: { d: [[-3.6, 5.55], [1.6, 5.55], [6.8, 5.55]], light: 3.0 },
};
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngOf(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
/** A door's family: a pure function of town + house + door (the same people every run). */
function family(town, i, j) {
    const seed = hash(`${town}:${i}:${j}`), R = rngOf(seed);
    const name = SURNAMES[Math.floor(R() * SURNAMES.length)];
    const cast = [];
    const a = R();
    if (a < 0.4) cast.push("dad", "mom"); else if (a < 0.6) cast.push("bubbe"); else if (a < 0.8) cast.push("mom", "bubbe"); else cast.push("dad", "bubbe");
    if (R() < 0.7) cast.push(R() < 0.5 ? "boy" : "girl");
    if (R() < 0.35 && cast.length < 4) cast.push(cast.includes("boy") ? "girl" : "boy");
    if (R() < 0.3 && cast.length < 5) cast.push("baby");
    if (R() < 0.35 && cast.length < 5) cast.push("cat"); else if (R() < 0.35 && cast.length < 5) cast.push("dog");
    const names = {};
    for (const k of cast) names[k] = k === "dad" || k === "mom" ? `${pick2(FIRST[k], R)} ${name}` : pick2(FIRST[k] || [k], R);
    return { name, cast, names, seed };
}
const pick2 = (a, R) => a[Math.floor(R() * a.length)];

function buildDoors() {
    HS.homes = [];
    const t = ctx.town, def = t && t.def;
    if (!def) return;
    HS.town = def.id;
    const list = t.homes || [];
    list.forEach((h, i) => {
        const D = DOORS[h.key];
        if (!D) return;
        const mx = -h.ux, mz = -h.uz;            // the model's +X in the world is −u
        D.d.forEach(([lx, lz], j) => {
            const door = { x: h.x + mx * lx + h.nx * lz, z: h.z + mz * lx + h.nz * lz };
            const t2 = (door.x - h.lotX) * h.ux + (door.z - h.lotZ) * h.uz;
            const lot = { x: h.lotX + h.ux * t2, z: h.lotZ + h.uz * t2 };
            const ap = { x: lot.x + h.nx * 0.7, z: lot.z + h.nz * 0.7 };
            const fam = family(def.id, i, j);
            HS.homes.push(Object.assign({ i: HS.homes.length, house: i, j, key: `${def.id}:${i}:${j}`, model: h.key, door, lot, ap, ux: h.ux, uz: h.uz, nx: h.nx, nz: h.nz,
                w: D.d.length > 1 ? 5.2 : h.w, lightY: D.light, town: def.id }, fam));
        });
    });
}

// ── town in / out ────────────────────────────────────────────────────────
on("town:enter", () => {
    buildDoors();
    ensureModels(["copPerson"]).catch(() => { });      // (a foot chase from a house: the cop on foot)
    if (!ctx.enabled("homes")) return;
    const id = HS.town, visit = (HS.visit = (HS.visit || 0) + 1);
    ensureModels(CROWD_MODELS).then(() => {
        if (!ctx.town || !ctx.town.active || ctx.town.id !== id || HS.visit !== visit) return;
        startCrowd(null, ctx.town.def, HS.homes, { drives: ctx.town.drives || [] });
        crowdActor();
    }).catch(e => console.warn("[homes] crowd models", e));
});
/** The crowd's per-frame tick (an actor that ends itself once the crowd stops — so (re)start it with every crowd). */
function crowdActor() {
    if (HS.actor) return;
    HS.actor = true;
    addActor({ foot: true, update: dt => { try { tickCrowd(dt); } catch (e) { console.error("[homes] crowd", e); } if (!CR.on) HS.actor = false; return CR.on; },
        dispose() { HS.actor = false; } });      // (cleared from outside — a new run: the next crowd adds it again)
}
on("town:leave", () => { stopCrowd(); HS.homes = []; HS.visit = (HS.visit || 0) + 1; });
on("run:start", () => { RUN.couch.clear(); RUN.souvenir.clear(); RUN.cholent.clear(); RUN.coins = 0; CR.burgled = null; });
on("honk", () => { if (CR.on) crowdHonk(); });

// ── the front doors: a ✋ spot on foot ───────────────────────────────────
let nearHome = null;
const doorSpot = {
    r: 2.6, short: "HOUSE",
    pos() {
        nearHome = null;
        if (!ctx.town || !ctx.town.active || !ctx.foot || !ctx.foot.pos || !HS.homes.length || !ctx.enabled("homes")) return null;
        const f = ctx.foot.pos;
        let bd = 2.6;
        for (const h of HS.homes) { const d = Math.hypot(h.ap.x - f.x, h.ap.z - f.z); if (d < bd) { bd = d; nearHome = h; } }
        if (nearHome && ctx.interiors && ctx.interiors.home && ctx.interiors.home.warm) ctx.interiors.home.warm();     // (at a door: its inside loads now)
        return nearHome ? { x: nearHome.ap.x, z: nearHome.ap.z } : null;
    },
    label() { return nearHome ? `🏠 THE ${plural(nearHome.name).toUpperCase()}` : null; },
    act() { if (nearHome) doorMenu(nearHome); },
};
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(doorSpot); ctx.foot.addSpot(crowdTalkSpot); }
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    // BURGLARY in court: law's charge tables get our lines (law/data.js), added once
    import("../law/data.js").then(L => {
        // (the lists are in priority order — the first charge that matches picks the lines: BURGLARY goes right under
        //  heist's BANK HEIST, above car theft / speeding / evading)
        const below = (list, key) => list.findIndex(d => d.key === key) + 1;
        if (!L.CHARGE_DIALOGUE.some(d => d.key === COURT_DIALOGUE.key)) L.CHARGE_DIALOGUE.splice(below(L.CHARGE_DIALOGUE, "BANK HEIST"), 0, COURT_DIALOGUE);
        if (!L.CHARGE_DEFENSE.some(d => d.key === COURT_DEFENSE.key)) L.CHARGE_DEFENSE.splice(below(L.CHARGE_DEFENSE, "BANK HEIST"), 0, COURT_DEFENSE);
        if (L.CHARGE_WEIGHT && L.CHARGE_WEIGHT.BURGLARY == null) Object.assign(L.CHARGE_WEIGHT, { "BURGLARY": 3, "STEALING CHOLENT": 1, "ASSAULT WITH A FRYING PAN": 2, "UNLAWFUL SPRITZING": 1 });
    }).catch(() => { /* no law feature */ });
    // the interiors registration (house.js) → wrap enter so we know when she's back outside, and where
    const reg = ctx.interiors && ctx.interiors.home;
    if (reg && !reg.wrapped) {
        const enter0 = reg.enter.bind(reg);
        reg.wrapped = true;
        reg.enter = (opts = {}) => {
            const exit0 = opts.exit;
            return enter0(Object.assign({}, opts, { exit: () => { if (typeof exit0 === "function") exit0(); try { backOutside(); } catch (e) { console.error("[homes] outside", e); } } }));
        };
    }
});

/** Hold her on the doorstep while a doorstep scene plays (foot.script); resolves when `scene.done`. */
function doorstep(home, ans = null) {
    const sc = { home, done: false, t: 0, ans, go: null };
    HS.scene = sc;
    const ok = ctx.foot.script({
        update(dt, P, F) {
            sc.t += dt;
            if (F.lulu) { F.lulu.face(home.door.x, home.door.z, dt, 8); F.lulu.update(dt, { walk: 0, talk: !!sc.talk, wave: sc.t < 0.6 && !!sc.knock }); }
            if (sc.ans) { sc.ans.p.update(dt, { talk: ctx.dialogOpen }); }
            if (sc.go) { const g = sc.go; sc.go = null; sc.done = true; clearAns(sc); go(g.home, g.mode, g.via); return false; }
            if (sc.waitT != null && sc.t >= sc.waitT) { sc.waitT = null; const r = sc.waitRes; sc.waitRes = null; r(); }
            return !sc.done;
        },
        abort() { sc.done = true; clearAns(sc); },
    });
    return ok ? sc : null;
}
const waitGame = (sc, sec) => new Promise(res => { sc.waitT = sc.t + sec; sc.waitRes = res; });
function clearAns(sc) { if (sc.ans) { if (sc.ans.p.obj.parent) sc.ans.p.obj.parent.remove(sc.ans.p.obj); sc.ans = null; } }
async function answerAt(sc, home, kind) {
    const K = KINDS[kind] || KINDS.mom;
    try { await ensureModels([K.key]); } catch (e) { return null; }
    if (sc.done) return null;
    const p = spawnPerson(K.key);
    p.obj.position.set(home.door.x + home.nx * 0.35, home.model === "town_mw_house" ? 0.7 : home.model === "town_mw_rowhouse" ? 0.95 : 0.35, home.door.z + home.nz * 0.35);
    p.obj.rotation.y = Math.atan2(home.nx, home.nz);
    p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    ctx.scene.add(p.obj);
    sc.ans = { p, kind };
    return sc.ans;
}

/** The ✋ menu at a front door. */
async function doorMenu(home) {
    if (HS.busy) return;
    HS.busy = true;
    const sc = doorstep(home);
    try {
        if (!sc) return;
        const rec = S.fam[home.key];
        // a friend (🎉 party) is inside this house right now: go in with them (features/together shares the room)
        const pal = ctx.together && ctx.together.friendIn ? ctx.together.friendIn("home", home.key) : null;
        const opts = ["✊ Knock", "🔑 Try the door", "🪟 Sneak in a window", "✖ Leave it"];
        // 🔗 a friend SNEAKING around in there: ring the bell to pull everyone to the door for her (features/partners)
        const sneak = ctx.partners && ctx.partners.palInside ? ctx.partners.palInside(home.key) : null;
        if (sneak) opts.unshift(`🔔 Ring the bell — cover for ${pal || ctx.party.displayName(sneak)}`);
        if (pal) opts.unshift(`👯 Join ${pal} inside`);
        let i = await choose(`🏠 The ${plural(home.name)}`, pal ? `${pal} is in there right now.` : rec && rec.seen ? `You've been here before. They remember you.` : `${home.cast.length} live here. The lights are ${isNight() ? "on" : "off"}.`,
            opts, { emoji: "🏠" });
        if (pal) { if (i === 0) { sc.go = { home, mode: "guest", via: "door" }; emit("stat", { id: "homesJoins", n: 1 }); return; } i = i < 0 ? i : i - 1; }
        if (sneak) {
            if (i === 0) { tone(880, 0.12, "sine", 0.1); tone(660, 0.16, "sine", 0.1, 0, 0.14); ctx.partners.ring(home.key); H.toast(`🔔 Ding-dong! Everyone's coming to the door — go, ${ctx.party.displayName(sneak)}!`, "pink"); sc.done = true; return; }
            i = i < 0 ? i : i - 1;
        }
        if (i === 0) await knock(home, sc);
        else if (i === 1) {
            const cfg = TOWN_CFG[home.town] || TOWN_CFG.lakewood;
            const changed = rec && rec.burgled > 0;
            tone(300, 0.08, "square", 0.06); tone(260, 0.08, "square", 0.06, 0, 0.12);
            const open = HS.force.unlocked != null ? HS.force.unlocked : !changed && Math.random() < cfg.unlocked;
            if (open) { H.toast(pick(UNLOCKED), "gold"); sc.go = { home, mode: "sneak", via: "door" }; return; }
            H.toast(changed ? "🔒 They changed the LOCKS. Since... you." : pick(LOCKED), "pink");
            sc.done = true;
        } else if (i === 2) { sc.go = { home, mode: "sneak", via: "window" }; return; }
        else sc.done = true;
    } catch (e) { console.error("[homes] door", e); if (sc) sc.done = true; }
    finally { HS.busy = false; }
}
async function knock(home, sc) {
    sc.knock = true; sc.t = 0;
    for (let k = 0; k < 3; k++) tone(170, 0.07, "triangle", 0.18, 0, k * 0.18);
    emit("stat", { id: "homesKnocks", n: 1 });
    await waitGame(sc, 1.3);
    const rec = S.fam[home.key];
    const cfg = TOWN_CFG[home.town] || TOWN_CFG.lakewood;
    let outcome = HS.force.knock || null;
    if (!outcome && rec && rec.burgled > 0) outcome = "again_bad";
    else if (!outcome && rec && rec.guest > 0) outcome = "again_good";
    if (!outcome) { let r = Math.random(); outcome = "nobody"; for (const [k, w] of Object.entries(cfg.knock)) { r -= w; if (r <= 0) { outcome = k; break; } } }
    const kind = outcome === "kid" ? (home.cast.find(k => k === "boy" || k === "girl") || "boy") : outcome === "nobody" ? null
        : (home.cast.find(k => k === (outcome === "meal" ? "mom" : "bubbe")) || home.cast.find(k => KINDS[k] && KINDS[k].adult) || "mom");
    if (kind) { await answerAt(sc, home, kind); tone(220, 0.12, "sine", 0.08, 330); }
    const lines = pick(KNOCK[outcome]);
    const who = kind ? (home.names[kind] || `The ${plural(home.name)}`) : "🏠";
    emit("homes:knock", { key: home.key, outcome, who: kind });
    if (outcome.startsWith("again")) emit("homes:recognized", { key: home.key, how: "knock", good: outcome === "again_good" });
    HS.log.push({ ev: "knock", outcome, key: home.key });
    for (const l of lines) {
        if (l === "*SLAM*" || l.startsWith("*SLAM*")) { tone(110, 0.2, "square", 0.2, 70); clearAns(sc); H.toast(`🚪 ${l}`, "pink"); continue; }
        await say(who, l, { emoji: kind ? KINDS[kind].emoji : "🏠" });
        if (sc.done) return;
    }
    if (outcome === "again_bad" && Math.random() < 0.5) reportCall(home, [CHARGE], { msg: CALL_MSG(home.name), quiet: false, from: "knock" });
    if (outcome === "meal" || outcome === "again_good") {
        const i = await choose(who, "Come in, come in!", ["🍽️ Go in (as a guest)", "🙏 \"Thanks, I can't stay\""], { emoji: KINDS[kind].emoji });
        if (i === 0) { sc.go = { home, mode: "guest", via: "door" }; return; }
        await say(who, "Your loss. There was KUGEL.", { emoji: KINDS[kind].emoji });
    } else if (outcome === "kid") { sc.go = { home, mode: "kid", via: "door" }; return; }
    clearAns(sc);
    sc.done = true;
}
function isNight() { return !!(ctx.atmos && ctx.atmos.night > 0.5); }

/** Into the house (from the doorstep scene, inside foot's frame). */
function go(home, mode, via) {
    const rec = S.fam[home.key];
    const recognized = !!(rec && rec.seen > 0);
    if (recognized) emit("homes:recognized", { key: home.key, how: "inside" });
    prepare({ home, mode, via, recognized, fam: rec || null });
    HS.inside = home;
    // where she comes back out (foot's resume reads road coords; backOutside() fine-tunes it)
    const rd = ctx.world.road, n = rd.nearest(home.ap.x, home.ap.z, ctx.foot.debug && ctx.foot.debug.F ? ctx.foot.debug.F.s : null, {});
    const side = Math.sign(n.d) || 1;
    const door = { s: n.s, d: n.d + side * 1.4, side, id: "home" };
    if (!ctx.foot.handoff || !ctx.foot.handoff("home", door)) { HS.inside = null; H.toast("🚪 The door's stuck!", "red"); return false; }
    emit("stat", { id: "homesVisits", n: 1 });
    if (mode !== "guest") emit("stat", { id: "homesBreakIns", n: 1 });
    else emit("stat", { id: "homesGuest", n: 1 });
    return true;
}

/** Back on the street: where she lands, and what the family does about it. */
function backOutside() {
    const L = VISIT.last, home = HS.inside;
    HS.inside = null;
    if (!L || !home) return;
    const f = ctx.foot && ctx.foot.pos;
    if (f) {
        const out = L.exit === "window"
            ? { x: home.lot.x + home.ux * (home.w / 2 + 0.6) + home.nx * 0.8, z: home.lot.z + home.uz * (home.w / 2 + 0.6) + home.nz * 0.8 }
            : { x: home.ap.x + home.nx * 0.3, z: home.ap.z + home.nz * 0.3 };
        f.set(out.x, 0.05, out.z);
        if (ctx.foot.obj) { ctx.foot.obj.position.copy(f); ctx.foot.obj.rotation.set(0, Math.atan2(home.nx, home.nz), 0); }
        if (ctx.cam && ctx.cam.snap) ctx.cam.snap();
    }
    if (L.exit === "window") { emit("stat", { id: "homesWindowExits", n: 1 }); H.toast("🌸 Out the window — into the hydrangeas!", "gold"); }
    // the family remembers
    const rec = S.fam[home.key] || (S.fam[home.key] = { name: home.name, town: home.town, visits: 0, seen: 0, burgled: 0, guest: 0, items: [], at: 0 });
    rec.visits++; rec.at = Date.now();
    if (L.spotted || L.startMode === "guest" || L.startMode === "kid") rec.seen++;
    const broke = L.startMode !== "guest" || L.mode !== "guest";
    if (broke && (L.spotted || L.looted.length || L.used.length)) rec.burgled++;
    if (L.startMode === "guest" && L.mode === "guest") rec.guest++;
    for (const u of L.used) if (!rec.items.includes(u)) rec.items.push(u);
    const keys = Object.keys(S.fam);
    if (keys.length > 60) { keys.sort((a, b) => S.fam[a].at - S.fam[b].at); for (const k of keys.slice(0, keys.length - 60)) delete S.fam[k]; }
    saveSoon();
    if (broke && (L.spotted || L.looted.length)) CR.burgled = home.name;
    try { if (ctx.memory && ctx.memory.remember && broke) ctx.memory.remember("homes", { fam: home.name, town: home.town, spotted: !!L.spotted, reported: !!L.reported, items: L.used.slice(0, 4) }); } catch (e) { /* no memory */ }
    emit("homes:exit", { key: home.key, name: home.name, exit: L.exit, reported: !!L.reported, spotted: !!L.spotted });
    HS.log.push({ ev: "exit", key: home.key, exit: L.exit, reported: L.reported });
    // the group chat always knows
    if (L.spotted && broke) groupText(L.reported ? `🚨 The ${plural(home.name)} just called the Shomrim. Someone was IN THEIR HOUSE. With a ${L.used[0] || "seltzer"}.` : `👀 Chani says somebody was creeping around the ${plural(home.name)}'. Lock your doors, ladies.`);
    if (L.reported) {
        const charges = [CHARGE, ...L.used.map(u => CHARGE_EXTRA[u]).filter(Boolean), ...(L.charges.includes("cholent") ? [CHARGE_EXTRA.cholent] : [])];
        reportCall(home, [...new Set(charges)], { msg: CALL_MSG(home.name) });
    }
}
function groupText(msg) {
    const G = ctx.town && ctx.town.def && ctx.town.def.lines && ctx.town.def.lines.GROUP;
    try { if (G && ctx.phone && ctx.phone.text) ctx.phone.text({ from: G.from, emoji: G.emoji, color: G.color, msg, dur: 4.4 }); } catch (e) { /* no phone */ }
}
/** The call: a cop near the house → a foot chase right now (with the charges); otherwise law's call-in (📞 REPORTED). */
function reportCall(home, charges, { msg } = {}) {
    const law = ctx.law;
    let chase = false;
    const at = home.ap;
    let cop = null;
    const pat = ctx.town && ctx.town.debug && ctx.town.debug.C && ctx.town.debug.C.patrol;
    if (HS.force.cop || (pat && ctx.traffic.cars.includes(pat) && Math.hypot(pat.x - at.x, pat.z - at.z) < 90)) cop = pat ? { x: pat.x, z: pat.z } : { x: at.x + home.nx * 22, z: at.z + home.nz * 22 };
    else if (law && law.copNear && law.copNear(at.x, at.z, 80)) cop = { x: at.x + home.nx * 18, z: at.z + home.nz * 18 };
    if (cop && ctx.foot && ctx.foot.active && ctx.foot.startChase) {
        chase = ctx.foot.startChase(cop, { charges });
        if (chase) H.banner(`<b>🚨 A COP WAS RIGHT THERE!</b><small>the ${plural(home.name)} pointed — RUN!</small>`, 2600, { key: "homes:cop", prio: 3 });
    }
    if (!chase && law && law.callIn) {
        for (const c of charges) law.callIn(c, { msg: msg || CALL_MSG(home.name) });
    }
    emit("homes:report", { key: home.key, name: home.name, charges, chase });
    emit("stat", { id: "homesReported", n: 1 });
    HS.log.push({ ev: "report", key: home.key, chase, charges });
    return chase ? "chase" : "callIn";
}

// ── the service ──────────────────────────────────────────────────────────
ctx.homes = {
    /** Is she inside a house right now? */
    get inside() { return !!VISIT.cur; },
    /** The house she's in: { name, key, mode } | null. */
    get house() { const c = VISIT.cur; return c ? { name: c.home.name, key: c.home.key, mode: c.mode } : null; },
    /** This town's front doors: [{ i, key, name, cast, ap: {x, z} (where to stand), door, model }]. */
    homes: () => HS.homes.map(h => ({ i: h.i, key: h.key, name: h.name, cast: h.cast.slice(), ap: Object.assign({}, h.ap), door: Object.assign({}, h.door), model: h.model })),
    /** Straight in (on foot in town): mode "sneak" | "guest" | "kid", via "door" | "window". */
    enter(i, mode = "sneak", via = "door") { const h = HS.homes[i]; if (!h || !ctx.foot || !ctx.foot.active) return false; const sc = doorstep(h); if (!sc) return false; sc.go = { home: h, mode, via }; return true; },
    /** Knock at door i (the doorstep scene). */
    knock(i) { const h = HS.homes[i]; if (!h) return false; const sc = doorstep(h); if (!sc) return false; knock(h, sc).catch(e => console.error(e)); return true; },
    /** 🔔 The doorbell rang (a friend covering for her — features/partners): everyone inside comes to the door for `sec`. → n */
    distract(sec = 12, line) { return VISIT.cur ? distract(currentRoom(), sec, line) : 0; },
    /** What a family remembers about her: { visits, seen, burgled, guest, items } | null. */
    family: key => S.fam[key] ? Object.assign({}, S.fam[key]) : null,
    crowd: () => crowdInfo(),
    debug: {
        HS, S, RUN, VISIT, CR, TUNE, force: HS.force, room: roomInfo, DEF,
        /** Use item `id` on the resident of `kind` in the house she's in (tests). */
        use(id, kind) { const c = VISIT.cur; const r = c && c.V.res.find(q => q.kind === kind); return r ? applyItem(c.rt, r, id) : null; },
        /** Put Lulu right in front of a resident (tests). */
        near(kind, dist = 1.0) { const c = VISIT.cur; const r = c && c.V.res.find(q => q.kind === kind); if (!r) return false; const o = r.p.obj; c.rt.lulu.obj.position.set(o.position.x + Math.sin(o.rotation.y) * dist, 0, o.position.z + Math.cos(o.rotation.y) * dist); return true; },
        report: (i, charges) => reportCall(HS.homes[i], charges || [CHARGE]),
        startCrowd: () => { if (!(ctx.town && ctx.town.active)) return false; const r = startCrowd(null, ctx.town.def, HS.homes, { drives: ctx.town.drives || [] }); crowdActor(); return r; },
        stopCrowd,
        doors: () => HS.homes.length,
    },
};
export { HS };
