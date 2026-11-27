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
import { RUN, VISIT, prepare, roomInfo, applyItem, DEF, plural, distract, debugSpot } from "./house.js";
import { current as currentRoom } from "../interiors/engine.js";
import { SURNAMES, FIRST, KINDS, PEOPLE_MODELS, KNOCK, LOCKED, UNLOCKED, TOWN_CFG, CHARGE, CHARGE_EXTRA, CALL_MSG, COURT_DIALOGUE, COURT_DEFENSE } from "./data.js";
import { identity, sceneFor, presentCast, when, opinion, OPINION_LINE, byName, LIFE, clockFor, rngOf as lifeRng, hash as lifeHash, TRAITS } from "./life.js";
import { SCENES } from "./scenes.js";
import { JOBS, DAY_CAP, payJob, initVisits, ledger, offerFor, offerHint, offerLabel, askLines, markDone, startDelivery, delivery, deliveryFor, deliveryLabel, finishDelivery, thanksLines,
    cancelDelivery, porchHook, invited, useInvite, VISITS } from "./visits.js";
import { HOOKS as CROWD_HOOKS } from "./crowd.js";

registerModels(Object.assign({ homesKit: "homes_kit", homesItems: "homes_items", homesStreet: "homes_street", homesMail: "homes_mail", homesDelivery: "homes_delivery" }, PEOPLE_MODELS));

/** Persistent: every family Lulu has met (≤ 60), her souvenirs. */
const S = store("homes", { fam: {}, souvenirs: [], moved: {}, mig: {} });
const HS = { homes: [], byId: new Map(), town: null, actor: false, scene: null, force: {}, log: [] };

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
/** A door's family: a pure function of the door's STABLE id (town + where it stands — the same people every run, and
 *  the same people when a landmark replaces a house down the street). */
function family(id) {
    const seed = hash(id), R = rngOf(seed);
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

/** The STABLE id of a front door: the town + the door's position in the town's own (local) frame, to the metre —
 *  "midwood:-212:131". The same scheme as features/realestate (market.js houseId / ctx.realestate.keyOf), so a house
 *  is one id for both. (Not the index in ctx.town.homes: that shifts when another feature puts a landmark on a lot.) */
export function doorId(town, x, z) {
    const P = ctx.town && ctx.town.plan;
    const L = P && P.local ? P.local(x, z, {}) : { x, z };
    return `${town}:${Math.round(L.x)}:${Math.round(L.z)}`;
}
function buildDoors() {
    HS.homes = [];
    HS.byId = new Map();
    const t = ctx.town, def = t && t.def;
    if (!def) return;
    HS.town = def.id;
    const list = t.homes || [];
    const mig = !(S.mig && S.mig[def.id]);
    list.forEach((h, i) => {
        const D = DOORS[h.key];
        if (!D) return;
        const mx = -h.ux, mz = -h.uz;            // the model's +X in the world is −u
        D.d.forEach(([lx, lz], j) => {
            const door = { x: h.x + mx * lx + h.nx * lz, z: h.z + mz * lx + h.nz * lz };
            const id = doorId(def.id, door.x, door.z);
            if (HS.byId.has(id)) return;
            const t2 = (door.x - h.lotX) * h.ux + (door.z - h.lotZ) * h.uz;
            const lot = { x: h.lotX + h.ux * t2, z: h.lotZ + h.uz * t2 };
            // (+ the frontage's axes: the ✋ reaches across the front path, step → sidewalk — ci/doors › doorReach)
            const ap = { x: lot.x + h.nx * 0.7, z: lot.z + h.nz * 0.7, ux: h.ux, uz: h.uz, nx: h.nx, nz: h.nz };
            // (saves from before stable ids: the family was keyed by its index — move it over once)
            const old = `${def.id}:${i}:${j}`;
            if (mig && S.fam[old] && !S.fam[id]) { S.fam[id] = S.fam[old]; delete S.fam[old]; }
            const fam = family(id);
            if (S.fam[id] && S.fam[id].name && S.fam[id].name !== fam.name) {       // (a family she already knows keeps its name)
                const was = fam.name; fam.name = S.fam[id].name;
                for (const k of Object.keys(fam.names)) fam.names[k] = fam.names[k].replace(was, fam.name);
            }
            const home = identity(Object.assign({ i: HS.homes.length, house: i, j, key: id, id, model: h.key, door, lot, ap, ux: h.ux, uz: h.uz, nx: h.nx, nz: h.nz,
                w: D.d.length > 1 ? 5.2 : h.w, lightY: D.light, town: def.id, dark: !!h.dark }, fam));
            HS.homes.push(home); HS.byId.set(id, home);
        });
    });
    if (mig) { (S.mig = S.mig || {})[def.id] = 1; saveSoon(); }
    markNeighbours();
    // households other features bring (features/family: Fayge's basement) — their own door, cast, scenes and door menu
    for (const fn of SPECIAL) {
        let list = [];
        try { list = fn(def.id, t) || []; } catch (e) { console.warn("[homes] household", e); }
        for (const x of list) {
            if (!x || !x.key || HS.byId.has(x.key)) continue;
            const home = Object.assign({ i: HS.homes.length, house: -1, j: 0, id: x.key, model: "special", w: 3, lightY: 2.2, town: def.id, dark: false,
                traits: ["hosts", "bakers"], seed: hash(x.key), names: {} }, x);
            HS.homes.push(home); HS.byId.set(home.key, home);
        }
    }
}
/** Households other features add: fn(townId, ctx.town) → [{ key, name, cast, names, colors?, door, ap, lot, nx, nz, ux, uz,
 *  label?, scenes? ({id: scene def}), scene?(w, home) → a scene id, menu?(api) — its own ✋ door menu, talk?(kind, V) → a line }]. */
const SPECIAL = [];
/** Lulu's next-door neighbours (ci/hometown: her family's house is the "luluHome" spot): the doors either side on her
 *  street + across it are THE NEIGHBOURS — hosts + bakers who know her name from day one. */
function markNeighbours() {
    const sp = ctx.town && ctx.town.spot ? ctx.town.spot("luluHome") : null;
    if (!sp) return;
    const at = sp.door || sp;
    const near = HS.homes.map(h => [h, Math.hypot(h.ap.x - at.x, h.ap.z - at.z)]).filter(([h, d]) => d > 3 && d < 45 && !isLulus(h)).sort((a, b) => a[1] - b[1]).slice(0, 4);
    for (const [h] of near) { h.neighbour = true; h.traits = ["hosts", "bakers"]; }
}

// ── who lives here? (features/realestate · ci/hometown · ci/crime) ───────
// A door belongs to its household unless something else has claimed it. Claimers are functions (id, home) → a status
// string or null; the first non-null wins. Any status means homes GIVES UP that door: no family inside, no porch scene,
// nobody answers a knock, no break-in, no ✋ from homes (the claimer brings its own). Statuses real estate uses:
//   "mine" (Lulu owns it) · "listed" / "packing" (for sale, the family packing up) · "empty" · "rented" · "friend" —
// plus homes' own: "lulu" (her family's house, ci/hometown) and "moved" (a family moved out: ctx.homes.moveOut).
const CLAIM = { fns: [] };
function claimOf(h) {
    if (!h) return null;
    if (S.moved && S.moved[h.key]) return "moved";
    if (isLulus(h)) return "lulu";
    for (const f of CLAIM.fns) { try { const v = f(h.key, h); if (v) return String(v); } catch (e) { /* a claimer's bug never breaks a door */ } }
    return null;
}
function isLulus(h) {
    try { if (ctx.home && typeof ctx.home.isFamily === "function") return !!ctx.home.isFamily(h.door.x, h.door.z); } catch (e) { /* */ }
    const sp = ctx.town && ctx.town.spot ? (ctx.town.spot("home") || ctx.town.spot("luluHome")) : null;
    return !!(sp && Math.hypot(sp.x - h.door.x, sp.z - h.door.z) < 6);
}
const lived = h => !claimOf(h);
/** The crowd + its porch scenes only at doors a family lives behind (re-run when a claim changes). */
function crowdHomes() { return HS.homes.filter(h => lived(h) && !h.special); }

// ── town in / out ────────────────────────────────────────────────────────
on("town:enter", () => {
    buildDoors();
    ensureModels(["copPerson"]).catch(() => { });      // (a foot chase from a house: the cop on foot)
    if (!ctx.enabled("homes")) return;
    const id = HS.town, visit = (HS.visit = (HS.visit || 0) + 1);
    ensureModels(CROWD_MODELS).then(() => {
        if (!ctx.town || !ctx.town.active || ctx.town.id !== id || HS.visit !== visit) return;
        startCrowd(null, ctx.town.def, crowdHomes(), { drives: ctx.town.drives || [] });
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
on("town:leave", () => { shareScene(null); stopCrowd(); HS.homes = []; HS.byId = new Map(); HS.visit = (HS.visit || 0) + 1; });
on("run:start", () => { RUN.couch.clear(); RUN.souvenir.clear(); RUN.cholent.clear(); RUN.coins = 0; RUN.hearts = 0; CR.burgled = null; });
on("honk", () => { if (CR.on) crowdHonk(); });
// 📦 features/crime's porch pirate: the family remembers how it went (she got it back · she kept it · it's gone)
on("crime:porch", e => {
    if (!e || !e.id || !["back", "kept", "gone"].includes(e.phase)) return;
    const h = HS.byId.get(e.id);
    const rec = h ? rec0(h) : S.fam[e.id];
    if (!rec) return;
    rec.pkg = e.phase;
    if (e.phase === "back") rec.favours = (rec.favours | 0) + 1;
    if (e.phase === "kept") rec.kept = (rec.kept | 0) + 1;
    saveSoon();
});

// ── the front doors: a ✋ spot on foot ───────────────────────────────────
let nearHome = null;
/** A house's door strip (ci/doors): narrow along the street (a duplex has two doors side by side), from the step out to
 *  the sidewalk — walking down the pavement doesn't put every house on the ✋. */
const HOME_DOOR = { w: 0.8, inn: 1.2, out: 1.6 };
const doorSpot = {
    r: 2.6, short: "HOUSE",
    pos() {
        nearHome = null;
        if (!ctx.town || !ctx.town.active || !ctx.foot || !ctx.foot.pos || !HS.homes.length || !ctx.enabled("homes")) return null;
        const f = ctx.foot.pos;
        let bd = 2.6, best = null;
        for (const h of HS.homes) {
            if (Math.abs(h.ap.x - f.x) > 8 || Math.abs(h.ap.z - f.z) > 8) continue;
            const a = ctx.foot.doorReach ? ctx.foot.doorReach(h.ap, HOME_DOOR) : h.ap, d = Math.hypot(a.x - f.x, a.z - f.z);
            if (d < bd) { bd = d; nearHome = h; best = a; }
        }
        if (nearHome && !lived(nearHome)) nearHome = null;      // (real estate / her own house: their ✋, not ours)
        if (nearHome && ctx.interiors && ctx.interiors.home && ctx.interiors.home.warm) ctx.interiors.home.warm();     // (at a door: its inside loads now)
        return nearHome ? best : null;
    },
    label() {
        if (!nearHome) return null;
        const n = plural(nearHome.name).toUpperCase();
        if (nearHome.label) return typeof nearHome.label === "function" ? nearHome.label(nearHome) : nearHome.label;
        return deliveryFor(nearHome) ? `${JOBS[deliveryFor(nearHome).type].emoji} THE ${n} — DELIVER` : invited(nearHome) ? `🙋 THE ${n} — WAVING YOU IN` : `🏠 THE ${n}`;
    },
    act() { if (nearHome) doorMenu(nearHome); },
};
initVisits({ S, lived: h => lived(h) && !h.special, homes: () => HS.homes.filter(h => !h.special), byId: k => HS.byId.get(k), rec: h => rec0(h) });
CROWD_HOOKS.porch = (p, d) => { try { return porchHook(p, d); } catch (e) { return null; } };
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
            if (sc.go) { const g = sc.go; sc.go = null; sc.done = true; clearAns(sc); go(g.home, g.mode, g.via, g.scene, g.job); return false; }
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
        if (home.menu) { await specialMenu(home, sc); return; }
        const rec = S.fam[home.key];
        const scn = sceneNow(home);
        HS.doorScene = { key: home.key, sc: scn };
        // the choices, most specific first: a friend inside · covering for a sneaking friend · a delivery for THIS door ·
        // they waved her in · a job they could use a hand with · then knock / try the door / a window / leave
        const opts = [];
        const add = (label, fn) => opts.push({ label, fn });
        // a friend (🎉 party) is inside this house right now: go in with them (features/together shares the room)
        const pal = ctx.together && ctx.together.friendIn ? ctx.together.friendIn("home", home.key) : null;
        if (pal) add(`👯 Join ${pal} inside`, () => { sc.go = { home, mode: "guest", via: "door", scene: scn }; emit("stat", { id: "homesJoins", n: 1 }); return true; });
        // 🔗 a friend SNEAKING around in there: ring the bell to pull everyone to the door for her (features/partners)
        const sneak = ctx.partners && ctx.partners.palInside ? ctx.partners.palInside(home.key) : null;
        if (sneak) add(`🔔 Ring the bell — cover for ${pal || ctx.party.displayName(sneak)}`, () => { tone(880, 0.12, "sine", 0.1); tone(660, 0.16, "sine", 0.1, 0, 0.14); ctx.partners.ring(home.key); H.toast(`🔔 Ding-dong! Everyone's coming to the door — go, ${ctx.party.displayName(sneak)}!`, "pink"); sc.done = true; return true; });
        const dlv = deliveryFor(home);
        if (dlv) add(deliveryLabel(dlv), async () => { await deliverAt(home, sc, dlv); return true; });
        if (invited(home)) add("🙋 Go in — they waved you in", () => { useInvite(home); emit("stat", { id: "homesWaveIns", n: 1 }); sc.go = { home, mode: "guest", via: "door", scene: scn }; return true; });
        const job = !delivery() ? offerFor(home, scn.w, scn) : null;
        if (job && opinion(rec, home) !== "furious") add(offerLabel(job), async () => { await offerHand(home, sc, scn, job); return true; });
        add("✊ Knock", async () => { await knock(home, sc); return true; });
        add("🔑 Try the door", () => {
            const cfg = TOWN_CFG[home.town] || TOWN_CFG.lakewood;
            const changed = rec && rec.burgled > 0;
            tone(300, 0.08, "square", 0.06); tone(260, 0.08, "square", 0.06, 0, 0.12);
            const open = HS.force.unlocked != null ? HS.force.unlocked : !changed && Math.random() < cfg.unlocked;
            if (open) { H.toast(pick(UNLOCKED), "gold"); sc.go = { home, mode: "sneak", via: "door", scene: scn }; return true; }
            H.toast(changed ? "🔒 They changed the LOCKS. Since... you." : pick(LOCKED), "pink");
            sc.done = true; return true;
        });
        add("🪟 Sneak in a window", () => { sc.go = { home, mode: "sneak", via: "window", scene: scn }; return true; });
        add("✖ Leave it", () => { sc.done = true; return true; });
        const line = pal ? `${pal} is in there right now.` : [job ? offerHint(home, job) : "", doorLine(home, scn, rec)].filter(Boolean).join(" ");
        const i = await choose(`🏠 The ${plural(home.name)}`, line, opts.map(o => o.label), { emoji: scn.def.emoji || "🏠" });
        if (i < 0 || !opts[i]) { sc.done = true; return; }
        await opts[i].fn();
    } catch (e) { console.error("[homes] door", e); if (sc) sc.done = true; }
    finally { HS.busy = false; }
}
/** A household with its own door menu (features/family): homes keeps the doorstep, the answer at the door, the way in. */
async function specialMenu(home, sc) {
    const scn = sceneNow(home);
    HS.doorScene = { key: home.key, sc: scn };
    const dlv = deliveryFor(home);
    const api = {
        home, scene: scn, here: presentCast(home, scn, scn.w), delivery: dlv, rec: rec0(home),
        deliver: () => deliverAt(home, sc, dlv),
        finish: () => finishDelivery(home),
        knock: async () => { sc.knock = true; sc.t = 0; for (let k = 0; k < 3; k++) tone(170, 0.07, "triangle", 0.18, 0, k * 0.18); emit("stat", { id: "homesKnocks", n: 1 }); rec0(home).knocks = (rec0(home).knocks | 0) + 1; await waitGame(sc, 1.1); return !sc.done; },
        answer: kind => answerAt(sc, home, kind),
        wait: sec => waitGame(sc, sec),
        go: (scene = null, job = null) => { sc.go = { home, mode: "guest", via: "door", scene: scene ? sceneFor(home, scn.w, scene) : scn, job }; },
        get done() { return sc.done; },
    };
    await home.menu(api);
    if (!sc.go) { clearAns(sc); sc.done = true; }
}
/** 🤝 She offers a hand: someone comes to the door and explains; inside jobs go in as a guest with the job. */
async function offerHand(home, sc, scn, job) {
    const here = presentCast(home, scn, scn.w).filter(k => KINDS[k] && KINDS[k].adult);
    const kind = job.type === "glasses" ? (here.find(k => k === "bubbe" || k === "zeidy") || here[0]) : (here.find(k => k === "mom") || here[0]);
    if (!kind) { H.toast("🤝 Nobody answers. Maybe later.", "pink"); sc.done = true; return; }
    await answerAt(sc, home, kind);
    const who = home.names[kind] || `The ${plural(home.name)}`, em = KINDS[kind].emoji;
    for (const l of askLines(home, job)) { await say(who, l, { emoji: em }); if (sc.done) return; }
    emit("homes:offer", { key: home.key, type: job.type });
    if (JOBS[job.type].deliver) {
        startDelivery(home, job);
        const to = HS.byId.get(job.to);
        await say("Lulu", `${JOBS[job.type].emoji} To the ${plural(job.toName)}' — ${to ? Math.round(Math.hypot(to.ap.x - home.ap.x, to.ap.z - home.ap.z)) + " m that way" : "down the street"}. Follow the glow!`, { emoji: "💁‍♀️" });
        clearAns(sc); sc.done = true; return;
    }
    markDone(home);
    sc.go = { home, mode: "guest", via: "door", scene: scn, job };
}
/** 📬 / 🥘 At the right door with the delivery. */
async function deliverAt(home, sc, d) {
    const scn = sceneNow(home), here = presentCast(home, scn, scn.w).filter(k => KINDS[k] && !KINDS[k].animal && k !== "baby");
    const kind = here.find(k => KINDS[k].adult) || here[0];
    if (kind) await answerAt(sc, home, kind);
    const who = kind ? (home.names[kind] || `The ${plural(home.name)}`) : "🏠";
    const pay = finishDelivery(home);
    if (kind) { for (const l of thanksLines(home, d)) await say(who, l, { emoji: KINDS[kind].emoji }); }
    else H.toast(`${JOBS[d.type].emoji} Left it on the step with a note. "From Lulu." ❤️`, "gold");
    if (!pay) H.toast("🤝 No coins for that one today — just the warm fuzzies.", "", { key: "homes:job" });
    clearAns(sc); sc.done = true;
}
async function knock(home, sc) {
    sc.knock = true; sc.t = 0;
    for (let k = 0; k < 3; k++) tone(170, 0.07, "triangle", 0.18, 0, k * 0.18);
    emit("stat", { id: "homesKnocks", n: 1 });
    await waitGame(sc, 1.3);
    const rec = S.fam[home.key];
    const cfg = TOWN_CFG[home.town] || TOWN_CFG.lakewood;
    const scn = (HS.doorScene && HS.doorScene.key === home.key && HS.doorScene.sc) || sceneNow(home);
    const sd = scn.def, here = presentCast(home, scn, scn.w);
    const people = here.filter(k => KINDS[k] && !KINDS[k].animal && k !== "baby");
    rec0(home).knocks = (rec0(home).knocks | 0) + 1;
    let outcome = HS.force.knock || null;
    if (!outcome && !people.length) outcome = "nobody";
    if (!outcome && rec && rec.burgled > 0 && !sd.noPhone) outcome = "again_bad";
    else if (!outcome && rec && rec.guest > 0 && sd.id !== "cereal" && sd.id !== "shabbosNap") outcome = sd.door && sd.door.invite ? "scene" : "again_good";
    if (!outcome) {
        const odds = sd.knock || cfg.knock;
        let r = Math.random() * Object.values(odds).reduce((a, b) => a + b, 0); outcome = "nobody";
        for (const [k, w] of Object.entries(odds)) { r -= w; if (r <= 0) { outcome = k; break; } }
    }
    if (outcome === "kid" && !people.some(k => k === "boy" || k === "girl")) outcome = "kvetch";
    if (outcome === "scene" && !sd.door) outcome = "meal";
    const adult = k => KINDS[k] && KINDS[k].adult;
    const kind = outcome === "kid" ? people.find(k => k === "boy" || k === "girl") : outcome === "nobody" ? null
        : outcome === "scene" ? (sd.door.who.find(k => people.includes(k)) || people.find(adult) || people[0])
        : (people.find(k => k === (outcome === "meal" ? "mom" : "bubbe")) || people.find(adult) || people[0]);
    if (outcome !== "nobody" && !kind) outcome = "nobody";
    if (kind) { await answerAt(sc, home, kind); tone(220, 0.12, "sine", 0.08, 330); }
    let lines = outcome === "scene" ? pick(sd.door.lines) : pick(KNOCK[outcome] || KNOCK.kvetch);
    // a family that likes her says her NAME
    if (kind && byName(rec, home) && outcome !== "again_bad" && outcome !== "sleepy") lines = [pick(GREET_BY_NAME).replace("{who}", "Lulu")].concat(lines);
    // …and the package (features/crime's porch pirate) — said once
    if (kind && rec && rec.pkg && outcome !== "sleepy") { lines = [PKG_LINE[rec.pkg]].concat(lines); rec.pkg = null; saveSoon(); }
    const who = kind ? (home.names[kind] || `The ${plural(home.name)}`) : "🏠";
    emit("homes:knock", { key: home.key, outcome, who: kind, scene: sd.id });
    if (outcome.startsWith("again")) emit("homes:recognized", { key: home.key, how: "knock", good: outcome === "again_good" });
    HS.log.push({ ev: "knock", outcome, key: home.key });
    for (const l of lines) {
        if (l === "*SLAM*" || l.startsWith("*SLAM*")) { tone(110, 0.2, "square", 0.2, 70); clearAns(sc); H.toast(`🚪 ${l}`, "pink"); continue; }
        await say(who, l, { emoji: kind ? KINDS[kind].emoji : sd.emoji || "🏠" });
        if (sc.done) return;
    }
    if (outcome === "again_bad" && Math.random() < 0.5) reportCall(home, [CHARGE], { msg: CALL_MSG(home.name), quiet: false, from: "knock" });
    if (outcome === "meal" || outcome === "again_good" || (outcome === "scene" && sd.door.invite)) {
        const i = await choose(who, sd.noPhone ? "Gut Shabbos — come in!" : "Come in, come in!", ["🍽️ Go in (as a guest)", "🙏 \"Thanks, I can't stay\""], { emoji: KINDS[kind].emoji });
        if (i === 0) { sc.go = { home, mode: "guest", via: "door", scene: outcome === "scene" && sd.door.go ? sceneFor(home, scn.w, sd.door.go) : scn }; return; }
        await say(who, sd.noPhone ? "Gut Shabbos! Next week, then. We'll set a place." : "Your loss. There was KUGEL.", { emoji: KINDS[kind].emoji });
    } else if (outcome === "kid") { sc.go = { home, mode: "kid", via: "door", scene: scn }; return; }
    clearAns(sc);
    sc.done = true;
}
function isNight() { return !!(ctx.atmos && ctx.atmos.night > 0.5); }
/** The family's saved record (made on first contact). */
function rec0(home) { return S.fam[home.key] || (S.fam[home.key] = { name: home.name, town: home.town, visits: 0, seen: 0, burgled: 0, guest: 0, items: [], at: Date.now() }); }
/** The scene going on behind a door right now (tests can pin one: HS.force.scene). */
function sceneNow(home) {
    let force = HS.force.scene || null;
    // a house real estate has LISTED: the family's still there, packing (it gives the door up once it sells — a claim)
    if (!force) { try { if (ctx.realestate && ctx.realestate.claims && ctx.realestate.claims(home.key) === "listed") force = "forSale"; } catch (e) { /* no real estate */ } }
    const w = when();
    if (!force && home.scene) { try { force = home.scene(w, home) || null; } catch (e) { force = null; } }
    let mask = null;
    if (!force) { const f = friendScene(home); if (f) { force = f[1]; if (typeof f[2] === "number") w.hour = f[2] / 10; if (typeof f[3] === "number") mask = f[3]; } }
    const sc = sceneFor(home, w, force);
    if (mask != null) sc.mask = mask;          // (exactly who's home on their screen — our own day may not have arrived yet)
    return sc;
}
/** 👯 A friend is inside this house right now: the scene THEY walked into (d.x.hs = [door id, scene id, hour×10, who's-home bits] — a few bytes, only
 *  while inside), so a friend who follows a minute later meets the same household doing the same thing. */
function friendScene(home) {
    try {
        if (!ctx.party || !ctx.party.active || !ctx.party.members) return null;
        for (const uid of ctx.party.members()) {
            if (uid === ctx.party.uid) continue;
            const p = ctx.party.peer(uid), a = p && p.x && p.x.hs;
            if (Array.isArray(a) && a[0] === home.key && (SCENES[a[1]] || (home.scenes && home.scenes[a[1]])) && ctx.party.fresh(p, 8000)) return a;
        }
    } catch (e) { /* no party */ }
    return null;
}
function shareScene(v) { try { if (ctx.party && ctx.party.active && ctx.party.setX) ctx.party.setX("hs", v); } catch (e) { /* no party */ } }
const PKG_LINE = { back: "YOU! You got my package back from that GONIF! A hero! In MY doorway!",
    gone: "Did you SEE who took my package?! ...you didn't? Nobody EVER sees anything on this street.",
    kept: "...I KNOW it was you. The package. I have a doorbell camera. ...it's broken. But I KNOW." };
const GREET_BY_NAME = ["{who}! It's {who}! Come here, let me look at you!", "Oh, {who}! Our {who}! You're always welcome here.", "{who}! Perfect timing, as usual!"];
/** The door menu's line: what she hears from the step + what they think of her. */
function doorLine(home, sc, rec) {
    const sd = sc.def, R = lifeRng(lifeHash(home.key + sc.seed));
    const heard = sd.heard && sd.heard.length ? sd.heard[Math.floor(R() * sd.heard.length)] : "";
    const op = home.neighbour ? "Your next-door neighbours." + (opinion(rec, home) === "loves" ? " They adore you." : "") : OPINION_LINE[opinion(rec, home)] || "";
    const people = presentCast(home, sc, sc.w).filter(k => KINDS[k] && !KINDS[k].animal);
    const who = !people.length ? "The lights are off. Nobody's home… probably." : "";
    return [heard || who, op].filter(Boolean).join(" ") || `${home.cast.length} live here. The lights are ${isNight() ? "on" : "off"}.`;
}

/** Into the house (from the doorstep scene, inside foot's frame). */
function go(home, mode, via, scene = null, job = null) {
    const rec = S.fam[home.key];
    const recognized = !!(rec && rec.seen > 0);
    if (recognized) emit("homes:recognized", { key: home.key, how: "inside" });
    const sc = scene || (HS.doorScene && HS.doorScene.key === home.key && HS.doorScene.sc) || sceneNow(home);
    HS.doorScene = null;
    let cast = sc.mask != null ? home.cast.filter((k, i) => sc.mask & (1 << i)) : presentCast(home, sc, sc.w);
    if (mode === "kid" && !cast.some(k => k === "boy" || k === "girl")) cast = cast.concat(home.cast.filter(k => k === "boy" || k === "girl").slice(0, 1));
    if (job && job.type === "babysit") cast = home.cast.filter(k => !(KINDS[k] && KINDS[k].adult));      // (the parents stepped out)
    if (job && job.type === "glasses" && !cast.some(k => k === "bubbe" || k === "zeidy")) cast = cast.concat(home.cast.filter(k => k === "bubbe" || k === "zeidy").slice(0, 1));
    if (!job) shareScene([home.key, sc.def.id, Math.round((sc.w ? sc.w.hour : 12) * 10), home.cast.reduce((m, k, i) => m | (cast.includes(k) ? 1 << i : 0), 0)]);
    prepare({ home, mode, via, recognized, fam: rec || null, noCatch: !!HS.force.noCatch, scene: job ? { def: SCENES.ordinary, seed: sc.seed, w: sc.w } : sc, cast, job });
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
    shareScene(null);
    const L = VISIT.last, home = HS.inside;
    HS.inside = null;
    if (!L || !home) return;
    const f = ctx.foot && ctx.foot.pos;
    if (f) {
        const out = L.exit === "window"
            ? { x: home.lot.x + home.ux * (home.w / 2 + 0.6) + home.nx * 0.8, z: home.lot.z + home.uz * (home.w / 2 + 0.6) + home.nz * 0.8 }
            : { x: home.ap.x + home.nx * 1.4, z: home.ap.z + home.nz * 1.4 };      // (a step down the path: the camera behind her stays clear of a porch roof)
        f.set(out.x, 0.05, out.z);
        if (ctx.foot.obj) { ctx.foot.obj.position.copy(f); ctx.foot.obj.rotation.set(0, Math.atan2(home.nx, home.nz), 0); }
        if (ctx.cam && ctx.cam.snap) ctx.cam.snap();
    }
    if (L.exit === "window") { emit("stat", { id: "homesWindowExits", n: 1 }); H.toast("🌸 Out the window — into the hydrangeas!", "gold"); }
    // the family remembers
    const rec = rec0(home);
    rec.visits++; rec.at = Date.now();
    if (L.spotted || L.startMode === "guest" || L.startMode === "kid" || L.converted) rec.seen++;
    const welcomed = L.mode === "guest" && (L.startMode === "guest" || L.converted);
    const broke = !welcomed && (L.startMode !== "guest" || L.mode !== "guest");
    if (broke && (L.spotted || L.looted.length || L.used.length)) rec.burgled++;
    if (welcomed) { rec.guest++; if (L.startMode !== "guest") emit("stat", { id: "homesGuest", n: 1 }); }
    if (L.scene) { rec.last = L.scene; (rec.scenes = rec.scenes || []).includes(L.scene) || rec.scenes.push(L.scene); if (rec.scenes.length > 12) rec.scenes.shift(); }
    if (L.caughtBy && L.caughtBy.length) rec.caught = L.caughtBy[L.caughtBy.length - 1].how;
    if (L.favour) rec.favours = (rec.favours | 0) + 1;
    for (const u of L.used) if (!rec.items.includes(u)) rec.items.push(u);
    const keys = Object.keys(S.fam);
    if (keys.length > 60) { keys.sort((a, b) => S.fam[a].at - S.fam[b].at); for (const k of keys.slice(0, keys.length - 60)) delete S.fam[k]; }
    saveSoon();
    if (L.reported) rec.reported = (rec.reported | 0) + 1;
    if (broke && (L.spotted || L.looted.length)) CR.burgled = home.name;
    try { if (ctx.memory && ctx.memory.remember && broke) ctx.memory.remember("homes", { fam: home.name, town: home.town, spotted: !!L.spotted, reported: !!L.reported, items: L.used.slice(0, 4) }); } catch (e) { /* no memory */ }
    emit("homes:exit", { key: home.key, name: home.name, exit: L.exit, reported: !!L.reported, spotted: !!L.spotted, scene: L.scene || null, guest: welcomed,
        held: L.held || null, own: !!(home.family || claimOf(home) === "mine") });
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
    /** This town's front doors: [{ i, key (= id, stable: town + position), name, cast, ap: {x, z} (where to stand), door, model,
     *  status: null (a family lives here) | a claim ("mine", "listed", "moved", "lulu"…) }]. */
    homes: () => HS.homes.map(h => ({ i: h.i, key: h.key, id: h.key, name: h.name, cast: h.cast.slice(), traits: h.traits.slice(), ap: Object.assign({}, h.ap), door: Object.assign({}, h.door), model: h.model, status: claimOf(h) })),
    // ── who lives here? (features/realestate, ci/hometown, ci/crime) ──
    /** The stable id of the door at world x/z in the town she's in (the same as ctx.realestate.keyOf). */
    idAt: (x, z) => (ctx.town && ctx.town.def ? doorId(ctx.town.def.id, x, z) : null),
    /** Who lives behind door `id` (the town she's in): { id, name, family: "the Goldbergs", cast, names, ap, door, status }
     *  — status null = the household is home; otherwise the door is claimed (see claim()) and nobody of ours lives there. */
    household(id) { const h = HS.byId.get(id); return h ? { id: h.key, name: h.name, family: `the ${plural(h.name)}`, cast: h.cast.slice(), names: Object.assign({}, h.names), ap: Object.assign({}, h.ap), door: Object.assign({}, h.door), status: claimOf(h) } : null; },
    /** The household of the nearest door within r metres of x/z (porch thieves, deliveries…) | null. */
    householdAt(x, z, r = 6) { let b = null, bd = r; for (const h of HS.homes) { const d = Math.hypot(h.ap.x - x, h.ap.z - z); if (d < bd) { bd = d; b = h; } } return b ? ctx.homes.household(b.key) : null; },
    /** Does a family live behind door `id` right now? (false: claimed / moved out / not a door of this town) */
    livedIn: id => { const h = HS.byId.get(id); return !!h && lived(h); },
    /** Mark doors as someone else's: fn(id, home) → null (the family's) | a status string ("mine", "listed", "packing",
     *  "empty", "rented", "friend"…). Homes gives those doors up entirely. Returns an unregister function. */
    /** features/houseitems: a family saw her USING their stolen thing (they remember: cooler) / she gave it back (a favour). */
    noticed(key, item) { const h = HS.byId.get(key); const r = h ? rec0(h) : S.fam[key]; if (!r) return false; r.kept = (r.kept | 0) + 1; r.seen = (r.seen | 0) + 1; saveSoon(); emit("homes:noticed", { key, item }); return true; },
    returned(key, item) { const h = HS.byId.get(key); const r = h ? rec0(h) : S.fam[key]; if (!r) return false; r.favours = (r.favours | 0) + 1; saveSoon(); emit("homes:returned", { key, item }); return true; },
    /** Another feature's small jobs on homes' ledger (features/family): add({ type: { emoji, name, pay, cap, deliver? } }),
     *  pay(type) → coins actually paid (inside the job's cap + homes' DAY_CAP), errand({ type, to, fromName, label }) → a
     *  delivery to door `to` (the beacon + its ✋ menu). */
    jobsAdd(o) { for (const [k, v] of Object.entries(o || {})) if (!JOBS[k]) JOBS[k] = v; return true; },
    pay: (type, factor = 1) => (JOBS[type] ? payJob(type, factor) : 0),
    paid: type => (ledger().n[type] | 0),
    errand(job) { if (!job || !JOBS[job.type] || delivery()) return false; const to = HS.byId.get(job.to); startDelivery({ key: `errand:${job.type}`, name: job.fromName || "" }, Object.assign({ from: `errand:${job.type}`, toName: to ? to.name : "" }, job)); return true; },
    /** A household another feature brings (features/family) — see SPECIAL above; the town's doors are rebuilt. */
    addHousehold(fn) { if (typeof fn !== "function") return () => { }; SPECIAL.push(fn); if (ctx.town && ctx.town.active) buildDoors(); return () => { const k = SPECIAL.indexOf(fn); if (k >= 0) SPECIAL.splice(k, 1); }; },
    claim(fn) { if (typeof fn !== "function") return () => { }; CLAIM.fns.push(fn); return () => { const k = CLAIM.fns.indexOf(fn); if (k >= 0) CLAIM.fns.splice(k, 1); }; },
    /** A claim changed (a house bought / sold / listed): the porch scenes follow on the next town visit, the ✋ at once. */
    refresh() { if (CR.on && ctx.town && ctx.town.active) { stopCrowd(); startCrowd(null, ctx.town.def, crowdHomes(), { drives: ctx.town.drives || [] }); crowdActor(); } return true; },
    /** The family moves out of door `id` for good (real estate bought them out) — saved; moveIn(id) undoes it. */
    moveOut(id, why = "sold") { if (!id) return false; (S.moved = S.moved || {})[id] = { at: Date.now(), why }; delete S.fam[id]; saveSoon(); emit("homes:moved", { id, out: true, why }); return true; },
    moveIn(id) { if (!id || !S.moved || !S.moved[id]) return false; delete S.moved[id]; saveSoon(); emit("homes:moved", { id, out: false }); return true; },
    /** Straight in (on foot in town): mode "sneak" | "guest" | "kid", via "door" | "window". */
    enter(i, mode = "sneak", via = "door") { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; if (!h || !lived(h) || !ctx.foot || !ctx.foot.active) return false; const sc = doorstep(h); if (!sc) return false; sc.go = { home: h, mode, via }; return true; },
    /** Knock at door i (the doorstep scene). */
    knock(i) { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; if (!h || !lived(h)) return false; const sc = doorstep(h); if (!sc) return false; knock(h, sc).catch(e => console.error(e)); return true; },
    /** 🔔 The doorbell rang (a friend covering for her — features/partners): everyone inside comes to the door for `sec`. → n */
    distract(sec = 12, line) { return VISIT.cur ? distract(currentRoom(), sec, line) : 0; },
    /** Today's homes jobs ledger: { d, n: {type: count}, coins (of DAY_CAP), done } · the job tables · the delivery she's carrying. */
    jobs: () => Object.assign({ cap: DAY_CAP, table: JOBS }, JSON.parse(JSON.stringify(ledger()))),
    get delivery() { const d = delivery(); return d ? Object.assign({}, d) : null; },
    /** What a family remembers about her: { visits, seen, burgled, guest, favours, items, last (scene), … } | null. */
    family: key => S.fam[key] ? Object.assign({}, S.fam[key]) : null,
    /** What they think of her: "stranger" | "knows" | "likes" | "loves" | "wary" | "furious". */
    opinion: key => opinion(S.fam[key], HS.byId.get(key)),
    /** What's going on behind door `id` right now: { id: scene id, name, emoji, heard } | null. */
    sceneAt(id) { const h = HS.byId.get(id); if (!h || !lived(h)) return null; const sc = sceneNow(h); return { id: sc.def.id, name: sc.def.name, emoji: sc.def.emoji, here: presentCast(h, sc, sc.w), traits: h.traits.slice() }; },
    crowd: () => crowdInfo(),
    debug: {
        HS, S, RUN, VISIT, CR, TUNE, force: HS.force, room: roomInfo, DEF,
        /** Use item `id` on the resident of `kind` in the house she's in (tests). */
        use(id, kind) { const c = VISIT.cur; const r = c && c.V.res.find(q => q.kind === kind); return r ? applyItem(c.rt, r, id) : null; },
        /** Put Lulu right in front of a resident (tests). */
        near(kind, dist = 1.0) { const c = VISIT.cur; const r = c && c.V.res.find(q => q.kind === kind); if (!r) return false; const o = r.p.obj; c.rt.lulu.obj.position.set(o.position.x + Math.sin(o.rotation.y) * dist, 0, o.position.z + Math.cos(o.rotation.y) * dist); return true; },
        report: (i, charges) => reportCall(HS.homes[i], charges || [CHARGE]),
        startCrowd: () => { if (!(ctx.town && ctx.town.active)) return false; const r = startCrowd(null, ctx.town.def, crowdHomes(), { drives: ctx.town.drives || [] }); crowdActor(); return r; },
        stopCrowd,
        notice: debugSpot,
        /** Pin the scene every house plays (tests / previews): an id from SCENES, or null. */
        scene(id) { HS.force.scene = id || null; return id ? !!SCENES[id] : true; },
        /** Set the game clock to an hour (0–24) — the sky and the households follow. */
        hour(h) { if (ctx.atmos && ctx.atmos.debug && ctx.atmos.debug.time) ctx.atmos.debug.time(clockFor(h)); return h; },
        VISITS, offerFor: i => { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; return h ? offerFor(h, when(), sceneNow(h)) : null; },
        /** Start a job at door i now (tests): { type, to? } → true */
        job(i, type, to = null) { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; if (!h) return false; const job = { type, from: h.key }; if (to) { const t = HS.byId.get(to); Object.assign(job, { to, toName: t ? t.name : "?" }); }
            if (JOBS[type].deliver) { startDelivery(h, job); return true; } if (!ctx.foot || !ctx.foot.active) return false; const sc = doorstep(h); if (!sc) return false; sc.go = { home: h, mode: "guest", via: "door", scene: sceneNow(h), job }; return true; },
        /** Open door i's ✋ menu (tests). */
        door(i) { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; if (!h) return false; doorMenu(h); return true; },
        porch: (i, d = 3) => { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; return h ? porchHook({ home: h }, d) : null; },
        invited: i => { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; return !!h && invited(h); },
        label: () => doorSpot.label(),
        deliver(i) { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; return h ? finishDelivery(h) : null; },
        when, LIFE, SCENES, TRAITS, sceneNow: i => { const h = typeof i === "string" ? HS.byId.get(i) : HS.homes[i]; return h ? sceneNow(h).def.id : null; },
        doors: () => HS.homes.length, claimOf: i => claimOf(typeof i === "string" ? HS.byId.get(i) : HS.homes[i]), CLAIM,
        /** Rebuild the door list from ctx.town.homes (tests: a landmark replaced a house). */
        rebuild: () => { buildDoors(); return HS.homes.length; },
        spot: () => { const p = doorSpot.pos(); return p ? { x: p.x, z: p.z, key: nearHome && nearHome.key } : null; },
    },
};
export { HS };
