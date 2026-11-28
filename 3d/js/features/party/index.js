// ─────────────────────────────────────────────────────────────────────────
//  features/party — 🎉 PARTY WITH FRIENDS (3D only).
//
//  Getting together: one title entry → Host (a 4-letter code + an invite
//  link …/3d/?party=CODE, shared or copied) · Join (a controller-friendly
//  letter keyboard, or just open the link) · Open road (the cross-play
//  Shared Road, folded in here). Up to 8 friends.
//
//  The lobby is a real 3D stage: everyone's car lined up in their own skin
//  with nametags (👑 host, ✓ ready); pick your name / car / horn; the host
//  picks the game:
//    🏡 ROAD TRIP — everyone side by side on the same seeded road, cruising
//       together to Bubbe's house: real opaque cars (wheels, steering, brake
//       lights, nitro flames, honk + a wave), BONK! comedy bumps, a convoy
//       bonus (coins ×2), curated quick-chat + emotes, a group arrival at
//       Bubbe's with a group photo (ctx.play.openPhoto).
//    🏁 RACE — grid start with a countdown synced on the party clock, a
//       finish arch 2.5 km ahead, live position chip, results podium with
//       confetti, Rematch / Back to lobby. Late joiners spectate.
//
//  Everyone sees the same world: party traffic is a pure function of the
//  party seed + clock (traffic.js), random features are switched off for the
//  session (ctx.enabled → false for them), billboards are placed from the
//  party seed, ramps + dreidels are already seeded per chunk.
//
//  Everything you can do alone works too, PERSONAL to each player: walking (foot), the
//  interiors, the law (her own cops, jail, court), carjacking + bailing out, every ride's
//  horn / trick, street mayhem, the rest areas. What friends need to see goes out as presence +
//  snapshot extras (presence.js: a walking Lulu, her parked car, the cruisers on her tail, "🍺 in
//  The Thirsty Scholar"); a shared car she steps out in front of / flags down / rams is CLAIMED
//  (it pulls over the same way on every screen — claimShared) and one she drives off is gone for
//  everyone (claimTraffic).
//
//  Netcode: net.js (relay protocol v1, clock sync, host + migration, reliable
//  events) · remote.js (interpolation + the cars / walkers) · stage.js (lobby/podium)
//  · ui.js (screens, HUD, quick chat) · presence.js (what friends are doing).
//
//  Service: ctx.party = { active, code, seed, clock(), synced, isHost, players,
//    activity, host(), join(code), leave(), openHub(), trafficAt(), … }
//  Events:  party:status, party:act, party:host, party:player, party:bc, stat {partyRaces, partyWins, partyBonks, partyTrips}
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, hook, addMenuItem, registerState, setState, wrapAngle } from "../../core/ctx.js";
import { shared } from "../../core/save.js";
import { resetRun, updateDriving, autoDrive, addCoins, endRun } from "../../core/driving.js";
import { input, glyph, rumble, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";
import * as AU from "../../audio.js";
import { resume, showTitle } from "../../core/screens.js";
import { SKINS, CAR_CIRCLES, CAR_RADIUS } from "../../car.js";
import { signTexture } from "../../world.js";
import { models, instanced } from "../../models.js";
import * as NET from "./net.js";
import { N, clock } from "./net.js";
import * as R from "./remote.js";
import * as T from "./traffic.js";
import * as STG from "./stage.js";
import * as PS from "./presence.js";
import * as U from "./ui.js";
import * as PLAN from "./plan.js";
import "./emotes.js";
import { tone } from "../parking/sfx.js";

const QS = new URLSearchParams(location.search);
export const GRID_S = 60;            // the front row of the grid
export const RACE_LEN = 2500;        // metres to the flag
const RACE_GRACE = 45000;            // ms after the winner before the race closes
const TRIP_GRACE = 150000;           // ms after the first arrival before the trip closes
const ACTS = {
    trip: { emoji: "🏡", name: "Road Trip", blurb: "Convoy to Bubbe's together", go: "Convoy to Bubbe's house!" },
    race: { emoji: "🏁", name: "Race", blurb: "Grid start · 2.5 km to the flag", go: "First to the flag wins!" },
    dash: { emoji: "✨", name: "Dreidel Dash", blurb: "75 s · grab the most golden dreidels", go: "Grab the golden dreidels!" },
    tag: { emoji: "🚓", name: "Cop Tag", blurb: "Bump to tag · least time as cop wins", go: "Don't get caught!" },
};
const ORDER = ["trip", "race", "dash", "tag"];
const DASH_MS = 75000, TAG_MS = 90000, DASH_N = 34;

// ── local session state ──────────────────────────────────────────────────
const P = {
    actId: -1, me: {}, ready: false, rs: 0, pick: "trip", internal: false, respawn: false,
    convoy: { t: 0, grace: 0, on: false }, bonks: 0, lastS: 0, lastT: 0, spectate: null, props: [],
    cache: { name: "", horn: "beep", hair: "", skins: ["pink"], horns: ["beep"], at: -1 }, lobbyKey: "", lobbyFocus: null,
    trace: null, joinMsg: "", lostShown: false, shareMsg: "",
};
const rate = { r: 1, g: -1, w: 0 };
const _cf = new THREE.Vector3(), _cl = new THREE.Vector3();
const tmp = {}, tmpA = {}, poseArr = [0, 0, 0, 0, 0, 0, 0, 0];
const PARTY_STATES = new Set(["partyLobby", "partyGrid", "partyWait", "partySpectate", "partyResults"]);
const inPartyRun = () => N.want && ctx.G.mode === "party";
// 🌍 a group's Free Roam rides on her OWN normal run (ci/friends, the owner 2026-11-27: "friends = the same game, one world"):
// no party run, no reseed — her hearts, coins, car, errand, cops, the ER as when alone; her friends drawn in her world.
// Joining = a teleport to the friend (openworld's roam lightJoin), leaving = she stays where she is. Only an opt-in GAME
// (race, dash, cop tag, road trip) still starts a party run with its own shared world + rules.
const openRun = () => !!ctx.G && ctx.G.mode === "cruise" && !ctx.G.ended && (ctx.state === "playing" || ctx.state === "footRun");
const lightRoam = () => N.want && !!N.A && N.A.k === "roam" && !!ctx.G && ctx.G.mode === "cruise";
const driving = () => N.want && (ctx.state === "partyGrid" || ctx.state === "partyWait" || (ctx.state === "playing" && ctx.G.mode === "party"));
const tripEnd = () => { try { if (ctx.journey && ctx.journey.stopS) return ctx.journey.stopS(0); } catch (e) { /* fall back */ } return 4800; };

// ── the service ──────────────────────────────────────────────────────────
ctx.party = {
    get active() { return N.want; },
    get connected() { return N.connected; },
    get code() { return N.code; },
    get seed() { return NET.worldSeed(); },
    clock: () => clock(),
    get synced() { return NET.clockSynced(); },
    get isHost() { return N.isHost; },
    /** With friends out in the world: a party run (a game, an old client's roam) OR 🌍 on her own run (lightRoam). */
    get inWorld() { return inPartyRun() || lightRoam(); },
    /** 🌍 with friends on her own normal run (no party run). */
    get ownRun() { return lightRoam(); },
    /** Joining from a link: the teleport to the friend is still waiting for her position. */
    get joining() { return !!P.lightPending; },
    get host() { return N.host; },
    get uid() { return N.uid; },
    get players() { return NET.members().map(u => playerInfo(u)); },
    get activity() { return N.A; },
    /** Playing with a friend is possible here (online, the relay set) — the 📱 👯 rows' on/off. */
    get allowed() { return NET.allowed(); },
    hostParty, hostRoam, joinParty, leave,
    /** Join by code; opts.with = the uid to land next to (features/friends' one-tap JOIN). */
    join: (code, opts) => { if (opts && typeof opts.with === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(opts.with)) P.with = opts.with; return joinParty(code); }, openHub, openJoin: code => openJoin(code || ""),
    /** Share / copy the invite link (it lands friends right next to ME in Free Roam). → a promise of the message. */
    invite: () => U.shareInvite(N.code, N.uid),
    /** Who sent the link I joined from (their uid, or "") — Free Roam drops me next to them. */
    get inviter() { return P.with || ""; },
    trafficAt: (T0, s0, s1) => T.trafficAt(T0, s0, s1),
    trafficLive: () => T.trafficLive(),
    // ── for other features' party activities (openworld's 🌍 Free Roam) ──
    /** Register a lobby activity: def = { emoji, name, blurb, go, init?(A) → extra A fields, slotIn?(A) → true when handled,
     *  respawnAt?() → {s, d}, label?() / progress?() (trip bar), show?(p) / frame?(p) / decorate?(rc, p) (friends' cars),
     *  pose?() → {s, d, h} (publish my pose in another frame), planFirst (the world is planned before the billboards),
     *  ownTraffic?() → true while the activity runs its own traffic (no seeded highway cars) }. */
    addActivity(k, def) { if (!k || !def || ACTS[k]) return false; ACTS[k] = def; ORDER.push(k); return true; },
    /** Host: start activity k for everyone now (extra fields ride in the activity, e.g. { fromRoam: 1 }). */
    hostStart: (k, extra) => hostStart(k, extra),
    sendEvent: (k, ...a) => NET.sendEvent(k, ...a),
    broadcast: (k, ...a) => NET.broadcast(k, ...a),
    onHostEvent: fn => NET.onHostEvent(fn),
    setA: next => NET.setA(next),
    members: () => NET.members(),
    peer: uid => N.players.get(uid) || null,
    fresh: (p, ms) => NET.fresh(p, ms),
    setExtra(x) { N.extra = x || null; },
    // ── presence: what each friend is doing (see presence.js) ──
    /** Say what I'm doing: { mode, icon, label } (e.g. { mode: "in", icon: "🍺", label: "in The Thirsty Scholar" });
     *  null → back to the automatic one. Holds until my state changes (opts.sticky: until cleared). Safe outside a party. */
    presence: (p, opts) => PS.setPresence(p, opts),
    /** A friend's presence ({ mode, icon, label } | null) — or mine (uid omitted / mine). */
    presenceOf(uid) { if (!uid || uid === N.uid) { const a = PS.myPresence(); return { mode: a[0], icon: a[1], label: a[2] }; } return PS.presenceOf(N.players.get(uid)); },
    /** One short badge for a friend ("🚶‍♀️", "🍺", "🚨★★"…; "" while just driving). */
    presenceBadge: uid => PS.presenceBadge(N.players.get(uid)),
    /** A per-feature extras key in my snapshots (d.x[k]; null removes it). Keep it tiny. */
    setX: (k, v) => NET.setX(k, v),
    /** A shared party traffic car leaves the traffic for good (carjacked): gone for everyone, a local car on this screen. */
    claimTraffic: c => claimTraffic(c),
    /** Is shared traffic car `key` gone (jacked by someone)? */
    trafficGone: key => T.PT.gone.has(key),
    /** Claim shared car c: it pulls over for me, the same way on every screen, and it's mine to jack / hop into.
     *  opts: { L (stop distance m), dS (where it parks), hail (I flagged it: 🚕 HOP IN), how }. → true when it's stopping. */
    claim: (c, opts) => claimShared(c, opts),
    /** Could I claim shared car c right now (a Road Trip / 🌍 Free Roam run, streets on, a jackable kind, not gone)? */
    canClaim: c => canClaim(c),
    /** Another feature's shared cars can be claimed too: keys "<prefix>:…" go to handler
     *  { add(key, T0, L, dS, by, mine, hail) → bool, kill(key) → car | null, plan(c, opts) → { L, dS }, claimed?(key) }. */
    claimKinds(prefix, handler) { if (prefix && handler) CLAIM.H.set(String(prefix), handler); },
    /** A feature's shared car (openworld's town loops) was bumped: she may have rammed it into pulling over. */
    sharedCrash: (c, e) => onSharedCrash(c, e),
    /** Live claimed cars on this screen (tests): [{ key, s, d, at, mine, kind, speed }] · the pure pose of a claim at T (ms). */
    claimsLive: () => T.claimsLive(),
    claimPose: (key, Tms) => T.claimPose(key, Tms, {}),
    /** A special vehicle joins the SHARED traffic now and then (rides' fleet, streets' coupe): call at boot (the same
     *  order on every screen). w = its share of all cars; on() → is it on (a feature switch, the same on every screen). */
    addTrafficKind: (kind, w, on) => T.addKind(kind, w, on),
    /** Friends' cars as this screen draws them (for cosmetic contact: streets' props): [{ x, z, vx, vz }]. */
    friendCars() { const out = []; for (const rc of R.cars.values()) if (rc.shown && !rc.foot) out.push({ x: rc.x, z: rc.z, vx: rc.vx, vz: rc.vz }); return out; },
    displayName: uid => displayName(uid),
    skinOf: uid => skinOf(uid),
    skinHex: key => R.skinHex(key),
    remoteCar: uid => R.cars.get(uid) || null,
    beginRun: (s, d, speed) => beginRun(s, d, speed),
    placeCar: (s, d, speed) => placeCar(s, d, speed),
    /** My car jumped somewhere new (a warp, another frame): friends snap behind a poof instead of sliding. */
    respawned() { P.rs = (P.rs + 1) % 1000; P.lastS = ctx.car ? ctx.car.s : P.lastS; P.lastT = clock(); },
    visuals: { CarVisual: R.CarVisual, NameTag: R.NameTag, Bubble: R.Bubble },
    _debug: { lightFlag: (c, L = 10) => lightFlag(c, L), N, P, cars: R.cars, clockInfo: NET.clockInfo, blink: NET.blink, setA: NET.setA, start: hostStart, toLobby: hostToLobby, trace: on => {
        P.trace = on ? [] : null; for (const rc of R.cars.values()) rc.trace = on ? [] : null; return true; },
        /** tests: put my car at (s, d) rolling at speed (a respawn: friends see a poof, not a slide) */
        place(s, d = 1.75, speed = 0) { if (lightRoam() && ctx.town && ctx.town.active) ctx.town.leave("highway"); placeCar(s, d, speed); return true; },   // (🌍 on her own run she may start in her home town)
        stageCars: () => STG.carCount(),
        claims: () => [...T.PT.claims].map(([k, c]) => ({ key: k, T0: c.T0, L: c.L, dS: c.dS, by: c.by, mine: c.mine, hail: c.hail, dead: T.PT.dead.has(k) })),
        claimCool: () => { CLAIM.cool = 0; return true; },
        /** the ✋ FLAG IT DOWN candidate right now (tests) */
        flag: () => { const fp = ctx.foot && ctx.foot.pos, f = fp ? flagCandidate(fp) : null; return f ? { key: f.c.data.party, lon: +f.lon.toFixed(1), lat: +f.lat.toFixed(1) } : null; },
        /** what this screen draws for friend uid beyond their car: { parked, cops, tag } */
        world: uid => PS.debugWorld(uid),
        xk: () => JSON.parse(JSON.stringify(N.xk)),
        dash: () => DASH.spots,
        bbPlan: () => [...BB.plan].filter(([k, p]) => p).map(([k, p]) => `${k}:${p.s.toFixed(1)}:${p.side}:${p.id}`),
        traffic: T.PT },
};
PLAN.install(ctx.party);      // rng / seeded / h01 / road (the seeded road plan: plan.js)

// the sky: atmos runs its Cruise day + weather from these in a party (same for everyone)
const DAY_S = 540, WX_BLOCK = 100;
ctx.party.atmosClock = () => {
    const seed = NET.worldSeed();
    const start = 0.04 + ((seed % 1000) / 1000) * 0.3;              // every party starts in daylight
    return ((start + clock() / 1000 / DAY_S) % 1 + 1) % 1;
};
ctx.party.atmosWeather = () => {
    const b = Math.floor(clock() / 1000 / WX_BLOCK);
    if (b < 1) return { kind: "clear", strength: 1 };                // a sunny first impression
    const r = h01(NET.worldSeed() + 7, b), r2 = h01(NET.worldSeed() + 8, b);
    if (r < 0.62) return { kind: "clear", strength: 1 };
    if (r < 0.86) return { kind: "rain", strength: 0.5 + r2 * 0.5 };
    return { kind: "fog", strength: 0.7 + r2 * 0.3 };
};

// random features stay off in a party (every friend must see the same world). The rest are ON but
// party-aware: what everyone sees comes from the seed (plan.js / the party clock), what you DO is yours —
// roadevents · cameos · world · hustle (seeded road plan), community (seeded in 🌍 Free Roam towns),
// memory · banter · meta (personal), 🚶 foot · 🏠 interiors · 🚓 law (personal; what friends need to see goes
// out as presence / extras — presence.js), streets (seeded props + Paint & Pray booths from the road plan; carjack
// via a CLAIMED shared car; roadblocks + chop-shop calls personal), rides (its fleet seeded into the shared traffic;
// patients / kids / riders personal), exits (seeded rest areas; the visit personal), town (🌍 Free Roam's towns:
// seeded life, personal geese / e-bikes). Story (journey), Dina's mode, the 🕯️ Shabbos Rush (it owns the run's goal
// + sky) and ads (the iOS app's AdMob, features/native) stay off with friends. heist: its PERSONAL
// bits (the cops' nets / spikes in her own chase, the moped snatcher, the thief at her parked car) run on a Road Trip /
// Free Roam; robberies + Lulu's own heist stay solo (heist/common.js live()). underworld: only the 🫳 pickpocket on
// foot (personal) runs with friends; its bad-guy cars, roadside stops, the Fixer + heat stay solo (underworld/common.js).
// See ARCHITECTURE › the party parity table.
const OFF = new Set(["journey", "dina", "shabbos", "ads"]);
const baseEnabled = ctx.enabled;
ctx.enabled = id => (N.want && OFF.has(id)) ? false : baseEnabled(id);

// ── players ──────────────────────────────────────────────────────────────
function profileCache() {
    const c = P.cache;
    if (performance.now() - c.at < 1500) return c;
    const s = shared.get();
    c.at = performance.now();
    c.name = NET.NAMES.includes(s.mpName) ? s.mpName : "";
    c.horn = s.horn || "beep";
    c.hair = s.luluHair || "";
    c.skins = (Array.isArray(s.ownedSkins) && s.ownedSkins.length ? s.ownedSkins : ["pink"]).filter(k => SKINS[k]);
    if (!c.skins.includes("pink")) c.skins.unshift("pink");
    c.horns = Array.isArray(s.ownedHorns) && s.ownedHorns.length ? s.ownedHorns.slice() : ["beep"];
    if (!c.horns.includes("beep")) c.horns.unshift("beep");
    return c;
}
on("shared:changed", () => { P.cache.at = -1; });

function nameOf(uid) {
    if (uid === N.uid) return (ctx.player && ctx.player.name && ctx.player.name()) || profileCache().name || NET.myName();
    const p = N.players.get(uid);
    // (features/accounts: their USERNAME — the server says whose ticket this is, never the text they sent)
    const un = p && p.x && p.x.un && p.rid && ctx.accounts && ctx.accounts.ghostName ? ctx.accounts.ghostName(N.room, p.rid, p.x.un, { always: true }) : null;
    if (un) return un;
    return (p && NET.NAMES.includes(p.n) && p.n) || "Friend";
}
/** Display names: a duplicate gets a number so you can tell two Kugel Kids apart (cached, refreshed twice a second). */
const names = { map: new Map(), at: -1 };
function displayName(uid) {
    const t = performance.now();
    if (t - names.at > 500) {
        names.at = t; names.map.clear();
        const list = NET.members(), all = list.map(nameOf);
        list.forEach((u, i) => { const n = all[i], same = all.filter(x => x === n).length; names.map.set(u, same > 1 ? `${n} ${all.slice(0, i + 1).filter(x => x === n).length}` : n); });
    }
    return names.map.get(uid) || nameOf(uid);
}
function skinOf(uid) { if (uid === N.uid) return ctx.car ? ctx.car.skinKey : "pink"; const p = N.players.get(uid); return (p && p.sk) || "pink"; }
function playerInfo(uid) {
    const me = uid === N.uid, p = N.players.get(uid);
    return { uid, me, name: displayName(uid), sk: skinOf(uid), host: uid === N.host, ready: me ? P.ready : !!(p && p.rd),
        status: me ? "" : p ? R.status(p) : "📶", mode: me ? N.mode : p ? p.m : 0 };
}

// ── host / join / leave ──────────────────────────────────────────────────
/** Host a party. opts.act: start that activity as soon as we're connected (🌍 Free Roam — no lobby wall). */
function hostParty(opts = {}) {
    if (!NET.allowed()) { H.toast("Parties need an internet connection", "red"); return false; }
    leaveFriendRoom();
    const keep = !!(opts && opts.act === "roam") && openRun();     // (🌍 from the middle of her run: she keeps it)
    if (!keep) bankSoloRun();
    const code = NET.newCode();
    P.joinMsg = ""; P.lostShown = false;
    NET.start(code, true);
    P.ready = false; P.actId = N.A.id;
    P.autoAct = opts && opts.act && ACTS[opts.act] ? opts.act : null;
    if (!keep) setState("partyLobby");
    return code;
}
/** 🌍 Hang out: host straight into Free Roam (friends who open the link land right next to you). */
function hostRoam() { return hostParty({ act: ACTS.roam ? "roam" : null }); }
function joinParty(code) {
    code = String(code || "").toUpperCase();
    if (!NET.allowed() || !NET.validCode(code)) return false;
    leaveFriendRoom();
    const keep = openRun();                            // (joining from the middle of her run: she keeps it — a teleport)
    if (!keep) bankSoloRun();
    P.joinMsg = ""; P.lostShown = false;
    NET.start(code, false);
    P.ready = false; P.actId = -1;
    if (!keep) setState("partyLobby");
    return true;
}
function leave(toTitle = true) {
    if (!N.want) { if (toTitle && ctx.state !== "title") setState("title"); return; }
    closeRun("party");
    NET.stop(true);
    teardown();
    if (toTitle) {
        if (ctx.paused) resume();
        resetRun({ mode: "cruise" });
        setState("title");
    }
}
// A party keeps the EVERYONE layer (strangers stay in the world as ghosts; friends are the party's own cars) — only a
// Classic-2D FRIEND room is left (one group at a time).
function leaveFriendRoom() { try { const M = ctx.mpNet && ctx.mpNet.MP; if (M && M.want && M.room !== "lobby") ctx.mpNet.disconnect(false); } catch (e) { /* optional */ } }
/** Inviting friends from the middle of a solo drive: bank that run first (score, miles), like any run that ends. */
function bankSoloRun() { try { const G = ctx.G; if (G && !G.ended && G.mode !== "party" && G.runTime > 0 && ctx.state !== "title") endRun("party"); } catch (e) { /* fine */ } }

function teardown() {
    dashSetup(null);
    if (BAR.mine) BAR.mine.visible = false;
    R.clearCars();
    PS.clearAll();
    XP.jk.length = 0;
    T.releaseTraffic();
    clearProps();
    bbClear();
    STG.hide();
    STG.clearStage();
    U.hideHud();
    U.countdown(null);
    U.closeWheel();
    U.setChatKeys(false);
    caption("");
    document.body.classList.remove("party-stage", "party-drive");
    P.actId = -1; P.me = {}; P.ready = false; P.spectate = null; P.autoAct = null;
}

// ── the hub (from the title) ─────────────────────────────────────────────
// Kept slim on purpose (owner, 2026-11-22: "it's literally just supposed to be a play button"): friends playing now →
// ▶ Join; otherwise ONE big "Play with a friend"; a small "Join with a code"; Back. ⚙️ Settings has Play online; the More
// drawer has Classic 2D friends (features/multiplayer). Wording rules: 3d/docs/words.md.
function openHub() {
    const can = NET.allowed();
    const buttons = [];
    // 👯 your friends list first (features/friends): who's playing right now → ▶ Join in one tap
    const F = ctx.friends;
    if (can && F && F.live) {
        if (!HUB.checked) { HUB.checked = true; Promise.resolve(F.check()).then(() => { if (HUB.open && ctx.state === "title") openHub(); }); }
        const on = F.list.filter(f => f.presence && f.presence.on).slice(0, 4);
        for (const f of on) buttons.push({ id: "pt_fj_" + f.f, cls: "pt-big", label: `<span>▶ Join ${U.esc(f.label)}</span><small>${U.esc(f.presence.w || "playing")}</small>`, action: () => hubJoin(f.f) });
    }
    if (can) {
        buttons.push({ id: "pt_roam", cls: on0(buttons) ? "pt-big" : "purple", label: `<span>📤 Play with a friend ${glyph("confirm")}</span><small>Send a link. They'll show up next to you.</small>`, action: hostRoam });
        buttons.push({ id: "pt_join", cls: "alt", label: `<span>🔑 Join with a code</span>`, action: () => openJoin() });
    }
    buttons.push({ id: "pt_back", cls: "alt", label: `<span>Back ${glyph("back")}</span>`, action: () => showTitle(true) });
    const fl = can && F && F.live ? F.list : [];
    const playing = fl.filter(f => f.presence && f.presence.on).length;
    const line = !can ? "Playing with friends needs an internet connection."
        : !(F && F.live) ? ""
        : !fl.length ? "Friends you add show up here."
        : playing ? "" : HUB.checked && fl.some(f => !f.presence) ? "Checking who's playing…"
        : fl.length === 1 ? "Your friend isn't playing right now." : `None of your ${fl.length} friends are playing right now.`;
    const html = `<h2>👯 Friends</h2>${line ? `<p class="pt-sub">${line}</p>` : ""}`;
    HUB.open = true;
    H.showScreen(html, buttons, { onBack: () => { HUB.open = false; HUB.checked = false; showTitle(true); }, focus: buttons[0].id, cls: "pt-card pt-hub" });
}
const HUB = { open: false, checked: false };
on("state", () => { if (ctx.state !== "title") { HUB.open = false; HUB.checked = false; } });
const on0 = btns => !btns.some(b => /^pt_fj_/.test(b.id));
async function hubJoin(fid) {
    H.showScreen(`<h2>👯 Friends</h2><p class="pt-sub">⏳ Knocking…</p>`, [{ id: "pt_back", cls: "alt", label: `Back ${glyph("back")}`, action: openHub }], { onBack: openHub, cls: "pt-card pt-hub" });
    const msg = await ctx.friends.joinFriend(fid, () => H.showScreen(`<h2>👯 Friends</h2><p class="pt-sub">⏳ Waiting for them to say yes…</p>`, [{ id: "pt_back", cls: "alt", label: `Back ${glyph("back")}`, action: openHub }], { onBack: openHub, cls: "pt-card pt-hub" }));
    if (/^🚀/.test(msg)) { HUB.open = false; H.toast(msg, "pink", { prio: 2 }); return; }
    if (ctx.state === "title") { openHub(); if (msg) H.toast(msg, "", { prio: 2 }); }
}
function openJoin(code = "", msg = "", msgCls = "") {
    U.showCodeEntry({ code, msg, msgCls, onDone: c => joinParty(c), onBack: openHub });
}

// title entry (the parallel UX work groups title items; harmless if ignored)
addMenuItem("title", {
    id: "party", group: "play", order: 60, cls: "purple",
    label: () => `👯 Friends${ctx.mp && ctx.mp.connected && ctx.mp.room === "lobby" && ctx.mp.riders > 1 ? ` <small style="opacity:.8">· 🌐 ${ctx.mp.riders - 1} online</small>` : ""}`,
    // (the owner, 2026-11-27: "get rid of the friends button from the main menu since it's supposed to be an in game
    //  thing" — everything it offered is in 📱 👯 Friends now: Play with a friend, Join with a code, join a friend;
    //  an invite link opened from outside still joins straight from the title: autoJoin)
    visible: () => false,
    action: openHub,
});
addMenuItem("pause", { id: "partyLobby", order: 86, cls: "",
    // (a game the group voted for from 🌍 Free Roam goes back to Free Roam — features/friends stage 2; an old-style lobby party → the lobby)
    label: () => (N.A.fromRoam && ACTS.roam ? "🌍 End the game for everyone" : "🏠 Everyone back to the lobby"),
    visible: () => N.want && N.isHost && N.A.k !== "lobby" && N.A.k !== "roam",
    action: () => { resume(); if (N.A.fromRoam && ACTS.roam) hostStart("roam"); else hostToLobby(); } });
addMenuItem("pause", { id: "partyLeave", order: 88, cls: "purple", label: "🚪 Stop playing with friends", visible: () => N.want,
    action: () => { if (lightRoam()) { resume(); leave(false); H.toast("You're playing on your own now.", "", { prio: 1 }); } else leave(); } });   // (on her own run: she stays right where she is)

// ── host actions ─────────────────────────────────────────────────────────
function hostStart(k = P.pick, extra = null) {
    if (!N.isHost || !ACTS[k]) return false;
    const A = N.A, ps = NET.members(), t0 = Math.round(clock() + (ACTS[k].noGrid ? 300 : 5200)), id = (A.id | 0) + 1;
    const next = { k, id, ph: "go", t0, seed: (Math.random() * 4294967295) >>> 0, ps, pick: k, fin: {}, arr: {} };
    if (extra && typeof extra === "object") Object.assign(next, extra);       // (features/friends' votes: { fromRoam: 1 })
    if (k === "dash") Object.assign(next, { dur: DASH_MS, got: {} });
    if (ACTS[k].init) Object.assign(next, ACTS[k].init(next) || {});
    if (k === "tag") Object.assign(next, { dur: TAG_MS, cop: ps[id % ps.length], n: 0, since: t0, ct: {}, guard: t0 + 3000 });
    NET.setA(next);
    return true;
}
function hostToLobby() {
    if (!N.isHost) return;
    const A = N.A;
    NET.setA({ k: "lobby", id: (A.id | 0) + 1, pick: A.pick || P.pick, seed: A.seed });
}
NET.onHostEvent((uid, k, a) => {
    const A = N.A;
    if (!A || A.id !== a[0]) return;
    if (k === "fin" && A.k === "race" && A.ph === "go" && !(A.fin && A.fin[uid] != null)) {
        NET.setA(Object.assign({}, A, { fin: Object.assign({}, A.fin, { [uid]: a[1] | 0 }) }));
    } else if (k === "arr" && A.k === "trip" && A.ph === "go" && !(A.arr && A.arr[uid])) {
        NET.setA(Object.assign({}, A, { arr: Object.assign({}, A.arr, { [uid]: [a[1] | 0, a[2] | 0] }) }));
    } else if (k === "in" && A.k !== "race" && A.ps && !A.ps.includes(uid)) {
        NET.setA(Object.assign({}, A, { ps: A.ps.concat([uid]) }));
    } else if (k === "claim" && A.k === "dash" && A.ph === "go") {
        const i = a[1] | 0;
        if (i >= 0 && i < DASH_N && (A.got || {})[i] == null) NET.setA(Object.assign({}, A, { got: Object.assign({}, A.got, { [i]: uid }) }));
    } else if (k === "tag" && A.k === "tag" && A.ph === "go") {
        const t = clock(), victim = a[2];
        if (A.n === (a[1] | 0) && A.cop === uid && victim !== uid && NET.members().includes(victim) && t >= A.guard) {
            const ct = Object.assign({}, A.ct, { [uid]: ((A.ct || {})[uid] || 0) + Math.round(t - A.since) });
            NET.setA(Object.assign({}, A, { cop: victim, n: A.n + 1, since: Math.round(t), ct, guard: Math.round(t + 2500), by: uid }));
        }
    }
});
function hostTick() {
    const A = N.A;
    if (!A || A.ph !== "go") return;
    const t = clock();
    const mem = new Set(NET.members());
    const crew = (A.ps || []).filter(u => mem.has(u));
    if (A.k === "race") {
        const times = Object.values(A.fin || {});
        const first = times.length ? Math.min(...times) : 0;
        if ((crew.length && crew.every(u => A.fin && A.fin[u] != null)) || (first && t > first + RACE_GRACE) || t > A.t0 + 8 * 60000)
            NET.setA(Object.assign({}, A, { ph: "done", endAt: Math.round(t) }));
    } else if (A.k === "dash") {
        if (t > A.t0 + A.dur || Object.keys(A.got || {}).length >= DASH_N) NET.setA(Object.assign({}, A, { ph: "done", endAt: Math.round(t) }));
    } else if (A.k === "tag") {
        if (t > A.t0 + A.dur) {
            const end = A.t0 + A.dur;
            const ct = Object.assign({}, A.ct, { [A.cop]: ((A.ct || {})[A.cop] || 0) + Math.round(Math.max(0, end - A.since)) });
            NET.setA(Object.assign({}, A, { ph: "done", endAt: Math.round(t), ct }));
        }
    } else if (A.k === "trip") {
        const arr = Object.values(A.arr || {}).map(x => x[0]);
        const first = arr.length ? Math.min(...arr) : 0;
        if ((crew.length && crew.every(u => A.arr && A.arr[u])) || (first && t > first + TRIP_GRACE) || t > A.t0 + 20 * 60000)
            NET.setA(Object.assign({}, A, { ph: "done", endAt: Math.round(t) }));
    }
}

// ── following the host's activity state ──────────────────────────────────
function inFlow() { return N.want && (PARTY_STATES.has(ctx.state) || ((ctx.state === "playing" || ctx.state === "footRun") && ctx.G.mode === "party") || openRun() || ctx.state === "intro"); }
function followActivity() {
    const A = N.A;
    if (!A || !N.connected || !inFlow() || ctx.dialogOpen) return;
    if (!N.host) return;                               // no host heard yet
    if (A.k === "lobby") {
        if (openRun()) { P.actId = A.id; return; }    // (her own run: never pulled into a lobby screen — a game is an invitation)
        if (ctx.state !== "partyLobby") goLobby();
        P.actId = A.id;
        return;
    }
    if (!ACTS[A.k]) return;
    if (A.id !== P.actId) {
        if (!NET.clockSynced()) return;                // timed things wait for the party clock
        P.actId = A.id;
        if (A.ph === "done") { showResults(A); return; }
        enterActivity(A);
        return;
    }
    if (A.ph === "done" && ctx.state !== "partyResults") showResults(A);
}
function goLobby() {
    if (ctx.foot && ctx.foot.active) ctx.foot.end("party");      // (walking when the host called everyone back)
    closeRun("party");
    if (ctx.paused) resume();
    H.hideScreen();
    clearProps();
    T.clearTraffic();
    R.hideCars();
    P.ready = false; P.me = {};
    setState("partyLobby");
}

// ── activities: world prep, grid, slot-in, spectate ──────────────────────
function enterActivity(A) {
    if (ctx.paused) resume();
    H.hideScreen();
    const idx = (A.ps || []).indexOf(N.uid);
    const late = idx < 0 || clock() > A.t0 + 1500;
    P.me = { finished: false, arrived: false, late, coins: 0, place: 0, pend: {}, tagSent: -1 };
    if (A.k === "roam" && ACTS.roam && ACTS.roam.lightJoin) {
        if (openRun()) { lightEnter(A); return; }
        // (from the title / the lobby screen / a game's results: her own run starts at home first, then the teleport)
        P.lightPending = A;
        closeRun("party"); clearProps(); bbClear(); T.releaseTraffic();
        if (ctx.onegame && ctx.onegame.home) ctx.onegame.home({ via: "group" });
        return;
    }
    XP.jk.length = 0; NET.setX("jk", null);
    XC.length = 0; NET.setX("cl", null);
    P.copN = A.n;
    dashSetup(A.k === "dash" ? A : null);
    P.convoy.on = false; P.convoy.t = P.convoy.grace = 0;
    clearProps();
    T.configure(A.seed, A.t0, GRID_S);
    if (A.k === "race") { addArch(GRID_S + 7, ["START"], "#2E7D32"); addArch(GRID_S + RACE_LEN, ["🏁 FINISH 🏁"], "#212121", true); }
    if (A.k === "race" && late) { startSpectate(); return; }
    if (late && ACTS[A.k].slotIn && ACTS[A.k].slotIn(A)) return;
    if (late) { slotIn(A); return; }
    const row = Math.floor(idx / 2), lane = idx % 2;
    beginRun(GRID_S - row * 8.5, lane ? 5.25 : 1.75, 0);
    if (ACTS[A.k].noGrid) {                            // (🌍 Free Roam: nothing to count down to — just go)
        setState("playing");
        H.banner(`<b>${ACTS[A.k].emoji} ${ACTS[A.k].name}</b><small>${ACTS[A.k].go}</small>`, 2600);
        tone(660, 0.12, "triangle", 0.16, 990);
        return;
    }
    setState("partyGrid");
}

/** 🌍 with friends on her own run: in the group, the traffic hers, then (a joiner) off to the friend. */
function lightEnter(A) {
    // (the teleport needs the friend's position: until her snapshots are in, keep it pending — tried each frame, ~20 s max)
    const first = !P.lightTry;
    if (first) { P.lightTry = performance.now(); if (ctx.traffic) ctx.traffic.config.enabled = true; NET.sendEvent("in", A.id); }
    let done = true;
    try { done = ACTS.roam.lightJoin(A) !== false; } catch (e) { console.error("[party] join", e); }
    if (done || performance.now() - P.lightTry > 20000) { P.lightPending = null; P.lightTry = 0; }
}
/** A fresh party run at (s, d): seeded world, our props, the car placed (rolling at `speed`). */
function beginRun(s, d, speed) {
    PK.seen.clear();
    disposeChunks();
    bbReset();
    const first = ACTS[N.A.k] && ACTS[N.A.k].planFirst;    // the run plans its own world (town exits) before the billboards
    if (!first) bbReserveAhead(s + 950, s);
    closeRun("party");
    P.internal = true;
    try { resetRun({ mode: "party", s }); } finally { P.internal = false; }
    P.runLive = true;
    if (first) { disposeChunks(); bbReserveAhead(s + 950, s); }
    ctx.traffic.config.enabled = false;
    placeCar(s, d, speed);
    emit("run:start", { mode: "party", opts: { s, party: true } });
}
function placeCar(s, d, speed = 0) {
    const car = ctx.car, p = ctx.world.road.point(s, d, {});
    car.place(p.x, p.z, p.h);
    car.s = s; car.d = d;
    if (speed) { car.vx = Math.sin(p.h) * speed; car.vz = Math.cos(p.h) * speed; car.vF = speed; }
    car.obj.visible = true;
    bbReserveAhead(s + 950, s);
    ctx.world.prebuild(s);
    if (ctx.cam) ctx.cam.snap();
    P.rs = (P.rs + 1) % 1000;
    P.lastS = s; P.lastT = clock();
}
function disposeChunks() {
    const w = ctx.world;
    for (const [k, c] of w.chunks) { c.dispose(w.scene); w.chunks.delete(k); }
}

/** Late to a road trip: slot in right behind the convoy, rolling at their speed. */
function slotIn(A) {
    const t = clock();
    let minS = Infinity, vs = 0, n = 0;
    for (const p of N.players.values()) {
        if (p.aid !== A.id || p.m < 2 || p.m > 4 || !NET.fresh(p) || !p.samples.length) continue;
        const sm = p.samples[p.samples.length - 1];
        minS = Math.min(minS, sm.s); vs += Math.max(0, sm.vs); n++;
    }
    let s = n ? Math.max(GRID_S, minS - 22) : GRID_S, d = 5.25;
    const speed = n ? Math.min(30, vs / n) : 0;
    for (const dd of [5.25, 1.75]) if (T.laneClear(s, dd, t)) { d = dd; break; }
    beginRun(s, d, speed);
    NET.sendEvent("in", A.id);
    setState("playing");
    H.banner(`<b>🎉 You're in!</b><small>${n ? "Slotted in at the back of the convoy" : ACTS[A.k].go}</small>`, 2400);
    tone(660, 0.12, "triangle", 0.16, 990);
}

function startSpectate() {
    closeRun("party");
    P.spectate = { uid: null, t: 0 };
    disposeChunks();
    bbReset();
    P.internal = true;
    try { resetRun({ mode: "party", s: GRID_S }); } finally { P.internal = false; }
    ctx.car.obj.visible = false;
    setState("partySpectate");
}

// ── props: start / finish arches ─────────────────────────────────────────
let archParts = null;
function addArch(s, lines, bg, checker = false) {
    const road = ctx.world.road, p = road.at(s, {});
    if (!archParts) archParts = { post: new THREE.CylinderGeometry(0.22, 0.26, 7.2, 12), mat: new THREE.MeshStandardMaterial({ color: "#f5f5f5", roughness: 0.5 }), board: new THREE.BoxGeometry(19.6, 2.1, 0.25) };
    const g = new THREE.Group();
    for (const x of [-9.8, 9.8]) { const m = new THREE.Mesh(archParts.post, archParts.mat); m.position.set(x, 3.6, 0); m.castShadow = true; g.add(m); }
    const tex = checker ? checkerTex(lines[0]) : signTexture(lines, bg, "#ffffff", 1024, 128);
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.25 });
    const board = new THREE.Mesh(archParts.board, [archParts.mat, archParts.mat, archParts.mat, archParts.mat, face, face]);
    board.position.y = 7.0; board.castShadow = true;
    g.add(board);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.h + Math.PI;
    ctx.scene.add(g);
    P.props.push({ g, dispose: () => { face.dispose(); if (checker) tex.dispose(); } });
    // a painted line across the road
    const line = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.2), checker ? new THREE.MeshBasicMaterial({ map: checkerLine() }) : new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    line.rotation.x = -Math.PI / 2; line.position.set(p.x, 0.045, p.z); line.rotation.z = -p.h;
    line.renderOrder = 1;
    ctx.scene.add(line);
    P.props.push({ g: line, dispose: () => { line.geometry.dispose(); line.material.dispose(); } });
}
let checkerLineTex = null;
function checkerLine() {
    if (checkerLineTex) return checkerLineTex;
    const c = document.createElement("canvas"); c.width = 256; c.height = 32;
    const g = c.getContext("2d");
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fff"; g.fillRect(x * 16, y * 16, 16, 16); }
    checkerLineTex = new THREE.CanvasTexture(c); checkerLineTex.colorSpace = THREE.SRGBColorSpace;
    return checkerLineTex;
}
function checkerTex(text) {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 128;
    const g = c.getContext("2d");
    for (let x = 0; x < 64; x++) for (let y = 0; y < 8; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#fafafa"; g.fillRect(x * 16, y * 16, 16, 16); }
    g.fillStyle = "#E91E63"; g.fillRect(300, 14, 424, 100);
    g.fillStyle = "#fff"; g.font = "700 72px Fredoka, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 512, 68, 410);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function clearProps() { for (const p of P.props) { p.g.removeFromParent(); try { p.dispose(); } catch (e) { /* fine */ } } P.props.length = 0; }

// ── billboards from the party seed (banter hangs them; we pick the spots) ─
const BB = { plan: new Map(), mine: [] };
function bbReset() { bbClear(); }
function bbClear() {
    const w = ctx.world;
    if (w) for (const r of BB.mine) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
    BB.mine.length = 0; BB.plan.clear();
}
function h01(a, b) { let h = Math.imul(a ^ 0x2545F491, 0x9E3779B1) ^ Math.imul(b + 0x6C8E9CF5, 0x85EBCA77); h ^= h >>> 15; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
function bbReserveAhead(upto, from = ctx.car ? ctx.car.s : 0) {
    if (!ctx.banter || !ctx.banter.billboardAt || !ctx.world) return;
    const ids = ctx.banter.staticAds ? ctx.banter.staticAds() : [];
    if (!ids.length) return;
    const seed = NET.worldSeed(), w = ctx.world;
    const k0 = Math.max(2, Math.floor((from - 200) / 200));
    for (let k = k0; k <= Math.floor(upto / 200); k++) {
        if (BB.plan.has(k)) continue;
        let plan = null;
        if (h01(seed, k) < 0.34) {
            let s = k * 200 + 40 + h01(seed + 1, k) * 120;
            const side = h01(seed + 2, k) < 0.5 ? -1 : 1;
            if (side > 0) { const m = ((s % 46) + 46) % 46; if (m < 17) s += 17 - m; else if (m > 29) s += 46 - m + 17; }
            if (!w.isReserved(s, side * 17.5, 12)) {
                w.reserve(s - 10, s + 10, side, 12.4, 27);
                const res = w.reserved[w.reserved.length - 1];
                BB.mine.push(res);
                plan = { s, side, id: ids[Math.floor(h01(seed + 3, k) * ids.length)] };
            }
        }
        BB.plan.set(k, plan);
    }
}
on("chunk:build", ({ chunk }) => {
    if (!N.want || !ctx.banter || !ctx.banter.billboardAt) return;
    const p = BB.plan.get(chunk.k);
    if (p) { try { ctx.banter.billboardAt(chunk, p.s, p.side, p.id); } catch (e) { console.error("[party] billboard", e); } }
});

// ── shared pickups: a coin / golden dreidel a friend grabs is gone for everyone ──
// Coins + dreidels are seeded per chunk, so "chunk k, coin i" names the same coin on
// every screen. New takes go out as one ephemeral broadcast; late chunks catch up on build.
const PK = { seen: new Set(), out: [] };
const dreidelKey = dr => "g" + dr.k + ":" + Math.round(dr.s * 10) + ":" + Math.round(dr.d * 10);
function scanPickups() {
    const car = ctx.car, out = PK.out;
    out.length = 0;
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - car.s) > 260) continue;
        const cs = ch.coins;
        for (let i = 0; i < cs.length; i++) {
            const c = cs[i];
            if (!c.taken || c._pk) continue;
            c._pk = true;
            const key = "c" + ch.k + ":" + i;
            if (!PK.seen.has(key)) { PK.seen.add(key); out.push(key); }
        }
    }
    const dl = ctx.play && ctx.play.debug && ctx.play.debug.dreidels;
    if (dl) for (const dr of dl) {
        if (!dr.taken || dr._pk || dr.k < 0) continue;
        dr._pk = true;
        const key = dreidelKey(dr);
        if (!PK.seen.has(key)) { PK.seen.add(key); out.push(key); }
    }
    if (out.length) NET.broadcast("k", ...out);
}
function applyPickup(key) {
    if (key[0] === "c") {
        const j = key.indexOf(":"), ch = ctx.world.chunks.get(+key.slice(1, j)), c = ch && ch.coins[+key.slice(j + 1)];
        if (c && !c.taken) { c.taken = true; c._pk = true; }
    } else if (key[0] === "g") {
        const dl = ctx.play && ctx.play.debug && ctx.play.debug.dreidels;
        if (dl) for (const dr of dl) if (!dr.taken && dreidelKey(dr) === key) { dr.taken = true; dr._pk = true; dr.pop = 0.25; }
    }
}
function reapplyPickups(k) {
    const pc = "c" + k + ":", pg = "g" + k + ":";
    for (const key of PK.seen) if (k == null || key.startsWith(pc) || key.startsWith(pg)) applyPickup(key);
}
on("party:bc", ({ k, a }) => {
    if (k !== "k" || !inPartyRun()) return;
    for (const key of a) if (typeof key === "string" && key.length < 32 && !PK.seen.has(key)) { PK.seen.add(key); applyPickup(key); }
});
on("chunk:build", ({ chunk }) => { if (N.want && PK.seen.size) reapplyPickups(chunk.k); });

// ── states ───────────────────────────────────────────────────────────────
registerState("partyLobby", {
    hud: false, touch: false, pausable: false, world: true, driving: false,
    enter() {
        document.body.classList.add("party-stage");
        STG.show("lobby");
        STG.drawBanner(N.code);
        P.lobbyKey = ""; P.lobbyFocus = null;
        AU.setMusic("../story-beach.mp3");
        AU.updateEngine(0, 0, 0, 0, false, false);
        U.setChatKeys(false);
        renderLobby(true);
        warmShaders();
    },
    exit() { document.body.classList.remove("party-stage"); STG.hide(); H.hideScreen(); },
    update(dt, P_) { H.menuInput(P_); },
});

/** Compile the road's shaders while we wait (lobby / countdown), so GO isn't a hitch —
 *  someone who joined straight from a link may never have drawn the road yet. */
let warmAt = -1e9;
function warmShaders() {
    const r = ctx.renderer;
    if (!r || performance.now() - warmAt < 2000) return;
    warmAt = performance.now();
    try { if (r.compileAsync) r.compileAsync(ctx.scene, ctx.camera).catch(() => { }); else r.compile(ctx.scene, ctx.camera); } catch (e) { /* best effort */ }
}

registerState("partyGrid", {
    hud: true, touch: true, pausable: true, driving: true,
    enter() {
        warmShaders();
        AU.setMusic("../luludriving.mp3");
        ctx.G.musicSet = true;
        H.setBoost(ctx.G.boost, input.device === "touch" ? "" : glyph("boost"));
        P.lastCount = null;
    },
    exit() { U.countdown(null); },
    update(dt) {
        updateDriving(dt, {}, false, holdCtl(dt, 0));
        const A = N.A, left = (A.t0 - clock()) / 1000;
        const act = ACTS[A.k] || ACTS.race;
        if (left > 0) {
            const n = Math.ceil(left);
            U.countdown(`${act.emoji} ${act.name.toUpperCase()}`, n > 3 ? "…" : n, n > 3 ? "Get ready!" : act.go);
            if (n !== P.lastCount && n <= 3) { P.lastCount = n; tone(440, 0.12, "square", 0.16); rumble(0.1, 0.2, 80); }
        } else {
            U.countdown(null);
            P.goAt = { party: clock(), wall: Date.now(), t0: A.t0, id: A.id };
            const sub = A.k === "tag" ? (A.cop === N.uid ? "🚓 You're the cop — 3 s head start for them!" : `🚓 ${U.esc(displayName(A.cop))} is the cop — scatter!`) : act.go;
            H.banner(`<b>GO!</b><small>${sub}</small>`, 1600);
            tone(660, 0.18, "triangle", 0.2, 990); rumble(0.3, 0.6, 200, true);
            setState("playing");
        }
    },
});

registerState("partyWait", {
    hud: true, touch: true, pausable: true, driving: true,
    enter() { document.body.classList.add("in-play"); },
    update(dt) { updateDriving(dt, {}, false, waitCtl(dt)); },
});

registerState("partySpectate", {
    hud: false, touch: false, pausable: true, driving: false, world: true,
    enter() { U.setChatKeys(false); },
    exit() { caption(""); if (ctx.car) ctx.car.obj.visible = true; },
    update(dt, P_) {
        const S = P.spectate || (P.spectate = { uid: null, t: 0 });
        const list = [...R.cars.values()].filter(rc => rc.shown).sort((a, b) => b.s - a.s);
        if (P_.navLeft || P_.navRight) {
            const i = list.findIndex(rc => rc.uid === S.uid);
            const j = (i + (P_.navRight ? 1 : -1) + list.length) % Math.max(1, list.length);
            if (list[j]) S.uid = list[j].uid;
        }
        let rc = R.cars.get(S.uid);
        if (!rc || !rc.shown) { rc = list[0] || null; S.uid = rc ? rc.uid : null; }
        if (rc) {
            const car = ctx.car;
            car.pos.set(rc.x, 0, rc.z); car.h = rc.h; car.s = rc.s; car.d = rc.d; car.vx = car.vz = 0;
            car.syncObject();
            car.obj.visible = false;
            T.placeOnly(rc.s, dt);
        }
        caption(rc ? `👀 Watching <b>${U.esc(displayName(rc.uid))}</b> · ◀ ▶ switch · you're in the next one!` : "👀 Spectating — you're in the next one!");
    },
    camera(dt) {
        const rc = P.spectate && R.cars.get(P.spectate.uid);
        if (!rc || !rc.shown) return false;
        ctx.cam.follow(rc.v.root, { dist: 9.5, height: 3.6, look: 1.3, yaw: rc.h, fov: 60 }, dt);
        return true;
    },
});

registerState("partyResults", {
    hud: false, touch: false, pausable: false, driving: false, world: true,
    enter(data) {
        document.body.classList.add("party-stage");
        U.countdown(null); U.closeWheel(); U.setChatKeys(false); U.hideHud();
        AU.updateEngine(0, 0, 0, 0, false, false);
        AU.sfxHorn(false);
        if (data.podium) STG.show("podium"); else { STG.hide(); if (ctx.cam) ctx.cam.snap(); }
        P.resKey = "";
        renderResults(true);
    },
    exit() { document.body.classList.remove("party-stage"); STG.hide(); H.hideScreen(); },
    update(dt, P_) {
        H.menuInput(P_);
        const A = N.A;
        if (A.k === "trip") {
            // the group at Bubbe's: keep the world (and its traffic) alive around us
            T.placeOnly(ctx.car.s, dt);
            const car = ctx.car;
            const n = Math.max(1, Math.ceil(dt / (1 / 120)));
            for (let i = 0; i < n; i++) car.step(dt / n, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true }, { offroad: 0 });
            car.updateVisual(dt, ctx.time, { brake: 0 }, false);
        }
    },
    camera(dt) {
        if (N.A.k !== "trip" || STG.shown()) return false;
        const S = tripEnd(), road = ctx.world.road;
        // just past the gate, across the road: the parked line of friends with Bubbe's house behind
        const from = road.point(S - 43, -12.5, tmpA), fx = from.x, fz = from.z, look = road.point(S + 4, 14, tmp);
        ctx.cam.cinematic(_cf.set(fx, 8.2, fz), _cl.set(look.x, 1.6, look.z), dt, 0.6, 50);
        return true;
    },
});

// car controls while waiting / paused (the shared world never stops)
function holdCtl(dt, speed) {
    const car = ctx.car;
    const c = autoDrive(dt, car.d > 3.5 ? 5.25 : car.d < -3.5 ? -5.25 : car.d < 0 ? -1.75 : 1.75, speed);
    c.throttle = speed > 0 ? c.throttle : 0;
    // hold still: brake while she's still rolling forward, then the HANDBRAKE — never the brake pedal at a standstill
    // (the brake is also reverse: with the phone / pause up in a party the car backed down the highway)
    c.brake = speed > 0 ? c.brake : (car.vF > 0.6 ? 0.6 : 0);
    if (speed <= 0) { c.handbrake = true; if (car.vF < -0.2) c.throttle = 0.25; }
    return c;
}
function waitCtl(dt) {
    const car = ctx.car, me = P.me;
    if (me.park) {
        const road = ctx.world.road, tp = road.point(me.park.s, me.park.d, tmpA);
        const dx = tp.x - car.pos.x, dz = tp.z - car.pos.z, dist = Math.hypot(dx, dz);
        me.parkT = (me.parkT || 0) + dt;
        if (me.parkT > 14 && dist > 3) {   // couldn't get in (overshot): hop into the spot behind a poof
            sparkle(car.pos.x, car.pos.z); placeCar(me.park.s, me.park.d, 0); sparkle(tp.x, tp.z);
            return { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true };
        }
        const want = Math.atan2(dx, dz), diff = wrapAngle(want - car.h);
        const target = dist < 1.4 ? 0 : Math.min(13, dist * 0.7 + 1.5);
        return { steer: Math.max(-1, Math.min(1, -diff * 2.4)), throttle: car.speed < target && Math.abs(diff) < 1.6 ? 0.55 : 0,
            brake: dist < 1.4 || car.speed > target + 1.5 ? 1 : 0, handbrake: false, analog: true };
    }
    return holdCtl(dt, me.finished ? 14 : 0);
}

// ── in the drive (core "playing" + our states) ───────────────────────────
hook("runStart", G => {
    if (G.mode !== "party") return;
    G.noDistracted = true;      // garage: no reversed-steering mode with friends
    G.noPullOver = true;        // parking: no pulling into the minigame mid-party
    // foot: climbing out to walk is fine on a road trip / in free roam — not mid-race or in a timed game
    G.arrived = !!(N.want && N.A && (N.A.k === "race" || N.A.k === "dash" || N.A.k === "tag"));
    G.goText = "";
    if (!P.internal && N.want) P.respawn = true;   // the pause menu's ↺ Restart → respawn with the group
}, 60);
on("state", ({ from, to }) => {
    // back from a personal scene (the station, the court, the ER…) that put her on the road with a 3-2-1:
    // the party never stopped — straight back into it where that scene left her car
    if (to === "intro" && !P.respawn && N.want && ctx.G.mode === "party" && from && !PARTY_STATES.has(from) && from !== "playing" && from !== "title") {
        H.hideBanner();
        const c = ctx.car;
        placeCar(Math.max(GRID_S, c.s), c.d > 3.5 ? 5.25 : 1.75, 12);
        reapplyPickups(null);
        sparkle(c.pos.x, c.pos.z);
        setState(P.me.finished || P.me.arrived ? "partyWait" : "playing");
        H.toast("🎉 Back with the party!", "pink");
        return;
    }
    if (to === "intro" && P.respawn && N.want) {
        P.respawn = false;
        H.hideBanner();
        const at = ACTS[N.A.k] && ACTS[N.A.k].respawnAt ? ACTS[N.A.k].respawnAt() : null;
        const s = at ? at.s : Math.max(GRID_S, P.lastS - 4), d = at ? at.d : 5.25;
        placeCar(s, d, 0);
        reapplyPickups(null);
        sparkle(ctx.car.pos.x, ctx.car.pos.z);
        setState(P.me.finished || P.me.arrived ? "partyWait" : "playing");
        H.toast("↺ Back on the road!", "pink");
        return;
    }
    const partyDrive = N.want && (to === "playing" || to === "partyGrid" || to === "partyWait") && ctx.G.mode === "party";
    document.body.classList.toggle("party-drive", partyDrive);
    if (to === "partyWait" && N.want) document.body.classList.add("in-play");
    U.setChatKeys(N.want && to === "playing");
    if (to === "title" && N.want) leave(false);        // ⌂ Title screen from the pause menu = leave the party
    if (!partyDrive && to !== "partySpectate" && to !== "partyResults") U.hideHud();
});

// no hearts lost with friends: a crash is a bounce (the world must not split)
hook("damage", () => (inPartyRun() ? false : undefined), 90);

hook("update", (dt, P_, controlsOn) => {
    if (!inPartyRun()) {
        if (ctx.traffic) ctx.traffic.leads = lightRoam() ? friendLeads() : null;
        if (lightRoam() && ctx.state === "playing") bonks(dt);      // (friends bump harmlessly on her own run too)
        return;
    }
    P_.fire = false; P_.item = false;                  // missiles / pepper would hit traffic on ONE screen only
    const car = ctx.car, A = N.A, t = clock();
    const own = ACTS[A.k] && ACTS[A.k].ownTraffic && ACTS[A.k].ownTraffic();
    if (!own) { bbReserveAhead(car.s + 950); T.syncTraffic(car.s); }
    scanPickups();
    bonks(dt);
    // finish / arrival (crossing time interpolated inside the frame on the party clock)
    if (ctx.state === "playing" && A.id === P.actId) {
        if (A.k === "race" && !P.me.finished) {
            const fin = GRID_S + RACE_LEN;
            if (car.s >= fin) {
                const f = P.lastS < fin && car.s > P.lastS ? (fin - P.lastS) / (car.s - P.lastS) : 1;
                const ft = Math.round(P.lastT + (t - P.lastT) * f);
                P.me.finished = true; P.me.finishT = ft;
                NET.sendEvent("fin", A.id, ft);
                const place = 1 + Object.values(A.fin || {}).filter(x => x < ft).length;
                P.me.place = place;
                H.banner(`<b>🏁 FINISHED — ${ordinal(place)}!</b><small>${fmtRace(ft - A.t0)}</small>`, 2800);
                tone(523, 0.12, "triangle", 0.2); tone(784, 0.14, "triangle", 0.2, 0, 0.12); tone(1047, 0.2, "triangle", 0.2, 0, 0.26);
                rumble(0.4, 0.7, 300, true);
                for (let i = 0; i < 4; i++) car.fx.burst(car.pos.x, 1.5, car.pos.z, 20, 6, [[1, 0.3, 0.55], [1, 0.85, 0.2], [0.3, 0.75, 1], [0.5, 1, 0.5]][i], 0.5, 1.2);
                if (place === 1) emit("stat", { id: "partyWins", n: 1 });
                emit("stat", { id: "partyRaces", n: 1 });
                setState("partyWait");
            }
        } else if (A.k === "trip" && !P.me.arrived) {
            const end = tripEnd() - 48;
            if (car.s >= end) {
                P.me.arrived = true;
                const order = Object.keys(A.arr || {}).length;
                const slots = [-34, -27, -20, -13, 10, 17, 24, 31];
                P.me.park = { s: tripEnd() + slots[Math.min(7, order)], d: 11.8 };
                P.me.parkT = 0;
                NET.sendEvent("arr", A.id, Math.round(t), ctx.G.coins | 0);
                H.banner(`<b>🏡 You made it to Bubbe's!</b><small>Park up — the gang's on the way</small>`, 2600);
                tone(523, 0.12, "triangle", 0.2); tone(659, 0.14, "triangle", 0.2, 0, 0.12); tone(784, 0.2, "triangle", 0.2, 0, 0.24);
                emit("stat", { id: "partyTrips", n: 1 });
                setState("partyWait");
            }
        }
    }
    if (A.k === "dash" && A.ph === "go" && ctx.state === "playing" && t >= A.t0) dashClaims();
    // convoy (road trip): a friend within 45 m for 2 s → coins ×2
    if (A.k === "trip") {
        let near = false;
        for (const rc of R.cars.values()) if (rc.shown && Math.abs(rc.s - car.s) < 45 && Math.abs(rc.d - car.d) < 12) { near = true; break; }
        const C = P.convoy;
        if (near) { C.grace = 0; C.t += dt; if (!C.on && C.t >= 2) { C.on = true; tone(660, 0.14, "triangle", 0.2, 880); rumble(0.2, 0.4, 150); H.toast("🚗🚗 CONVOY! coins ×2", "gold"); } }
        else if (C.on) { C.grace += dt; if (C.grace > 3) { C.on = false; C.t = 0; } }
        else C.t = 0;
    }
    P.lastS = car.s; P.lastT = t;
}, 40);
on("coin", ({ n, why }) => { if (inPartyRun() && P.convoy.on && why === "road") addCoins(n, "convoy"); });

// 🌍 on her own run each screen has its own traffic: it follows a friend's car like any car ahead (traffic.js leads) —
// it slows behind her or changes lanes, never drives through her from behind. (Town traffic is the shared loops.)
const LEADS = [];
function friendLeads() {
    if (ctx.town && ctx.town.active) return null;
    LEADS.length = 0;
    for (const rc of R.cars.values()) if (rc.shown && !rc.foot) LEADS.push({ s: rc.s, d: rc.d, dir: rc.speed >= 0 ? 1 : -1, speed: Math.abs(rc.speed || 0), hit: false });
    return LEADS.length ? LEADS : null;
}

// BONK! symmetric self-detection: each screen bounces its own car off the friend it sees
function bonks(dt) {
    const car = ctx.car;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    const rr = CAR_RADIUS * 2;
    for (const rc of R.cars.values()) {
        if (rc.shown && rc.foot && !ctx.foot?.active) { pedBonk(rc, dt); rc.bonking = false; continue; }
        if (!rc.shown || rc.noBonk || rc.foot) { rc.bonking = false; continue; }
        const dx0 = rc.x - car.pos.x, dz0 = rc.z - car.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > 36) { rc.bonking = false; continue; }
        const gx = Math.sin(rc.h), gz = Math.cos(rc.h);
        let nx = 0, nz = 0, pen = 0;
        for (const a of CAR_CIRCLES) for (const b of CAR_CIRCLES) {
            const dx = car.pos.x + fx * a - (rc.x + gx * b), dz = car.pos.z + fz * a - (rc.z + gz * b);
            const d2 = dx * dx + dz * dz;
            if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); if (rr - d > pen) { pen = rr - d; nx = dx / d; nz = dz / d; } }
        }
        if (!pen) { rc.bonking = false; continue; }
        car.pos.x += nx * pen * 0.5; car.pos.z += nz * pen * 0.5;      // they push themselves the other half
        const vn = (car.vx - rc.vx) * nx + (car.vz - rc.vz) * nz;
        if (vn < 0) { const j = -1.25 * vn / 2; car.vx += nx * j; car.vz += nz * j; }
        if (!rc.bonking && rc.bonkCd <= 0) {
            const side = nx * -Math.cos(car.h) + nz * Math.sin(car.h);
            car.applyImpulse(nx * 2.6, nz * 2.6, side * 0.35);
            rc.bonkCd = 0.7;
            P.bonks++;
            // (no toast: the bounce, the sparks and the sound are the feedback — a pop-up per bump flooded calm's budget)
            const cx = car.pos.x - nx * 1.0, cz = car.pos.z - nz * 1.0;
            car.fx.burst(cx, 1.0, cz, 16, 4.5, [1, 0.94, 0.46], 0.38, 0.5);
            tone(150, 0.12, "square", 0.22, 90);
            rumble(0.5, 0.6, 180, true);
            emit("stat", { id: "partyBonks", n: 1 });
            // Cop Tag: the cop's own screen reports the tag; the host arbitrates
            const A = N.A;
            if (A.k === "tag" && A.ph === "go" && A.cop === N.uid && P.me.tagSent !== A.n && clock() >= A.guard) {
                P.me.tagSent = A.n;
                NET.sendEvent("tag", A.id, A.n, rc.uid);
            }
        }
        rc.bonking = true;
    }
}

function sparkle(x, z) { if (ctx.car && ctx.car.fx) ctx.car.fx.burst(x, 1.2, z, 26, 4, [1, 0.85, 1], 0.6, 0.9); }
R.setPoof(sparkle);

// ── Dreidel Dash + Cop Tag ───────────────────────────────────────────────
function scoreRows(A) {
    const rows = (A.ps || []).filter(u => u === N.uid || N.players.has(u)).map(u => ({ uid: u, name: displayName(u), sk: skinOf(u), me: u === N.uid, cop: A.k === "tag" && A.cop === u, n: 0 }));
    if (A.k === "dash") { for (const i in A.got || {}) { const r = rows.find(x => x.uid === A.got[i]); if (r) r.n++; } rows.sort((a, b) => b.n - a.n); }
    else {
        for (const r of rows) r.n = ((A.ct || {})[r.uid] || 0) + (A.ph === "go" && A.cop === r.uid ? Math.max(0, clock() - A.since) : 0);
        rows.sort((a, b) => a.n - b.n);
    }
    return rows;
}

// the golden dreidels: seeded spots (same everywhere), one instanced mesh, the host says who got each
const DASH = { inst: null, spots: [], id: -1, m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), sc: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), pop: [] };
function dashSetup(A) {
    if (DASH.inst) { DASH.inst.group.removeFromParent(); DASH.inst.dispose(); DASH.inst = null; }
    DASH.spots.length = 0; DASH.id = -1;
    if (!A) return;
    DASH.id = A.id;
    const lanes = [-5.25, -1.75, 1.75, 5.25, 8.0];
    for (let i = 0; i < DASH_N; i++) {
        const s = GRID_S + 70 + i * 52 + h01(A.seed, i * 3) * 30;
        const d = lanes[Math.floor(h01(A.seed + 1, i) * lanes.length)];
        DASH.spots.push({ s, d, x: 0, z: 0 });
    }
    const road = ctx.world.road;
    for (const sp of DASH.spots) { const p = road.point(sp.s, sp.d, {}); sp.x = p.x; sp.z = p.z; }
    if (models.play_dreidel) {
        DASH.inst = instanced(models.play_dreidel, DASH_N, []);
        DASH.inst.finish();
        for (const im of DASH.inst.group.children) im.frustumCulled = false;   // spread over 2 km: no stale bounding sphere
        ctx.scene.add(DASH.inst.group);
    }
    DASH.pop = new Array(DASH_N).fill(0);
}
function dashTaken(i) { const A = N.A; return (A.got && A.got[i] != null) || !!(P.me.pend && P.me.pend[i]); }
function dashClaims() {
    const car = ctx.car, A = N.A;
    for (let i = 0; i < DASH.spots.length; i++) {
        const sp = DASH.spots[i];
        if (dashTaken(i)) continue;
        const dx = sp.x - car.pos.x, dz = sp.z - car.pos.z;
        if (dx * dx + dz * dz > 6.5) continue;
        P.me.pend[i] = true;                         // vanish now (snappy); the host confirms who was first
        DASH.pop[i] = 0.35;
        NET.sendEvent("claim", A.id, i);
        car.fx.burst(sp.x, 1.2, sp.z, 18, 4, [1, 0.85, 0.25], 0.45, 0.7);
        tone(880 + (Object.keys(P.me.pend).length % 6) * 90, 0.09, "triangle", 0.16, 1320);
        rumble(0, 0.3, 60);
    }
}
function dashTick(dt) {
    const A = N.A;
    if (!DASH.inst || A.k !== "dash" || A.id !== DASH.id || ctx.view) { if (DASH.inst) DASH.inst.group.visible = false; return; }
    DASH.inst.group.visible = true;
    const t = ctx.time;
    for (let i = 0; i < DASH.spots.length; i++) {
        const sp = DASH.spots[i];
        let sc = 1;
        if (dashTaken(i)) { DASH.pop[i] = Math.max(0, DASH.pop[i] - dt); sc = DASH.pop[i] > 0 ? 1 + (0.35 - DASH.pop[i]) * 2 : 0; }
        DASH.q.setFromAxisAngle(DASH.up, t * 4 + i);
        DASH.m.compose(DASH.v.set(sp.x, 0.9 + Math.sin(t * 3 + i) * 0.18, sp.z), DASH.q, DASH.sc.setScalar(sc * 1.6));
        DASH.inst.set(i, DASH.m);
    }
    for (const im of DASH.inst.group.children) im.instanceMatrix.needsUpdate = true;
    // someone else got one I was going for
    if (A.got) for (const i in P.me.pend) if (A.got[i] != null && A.got[i] !== N.uid) { delete P.me.pend[i]; H.toast(`⚡ ${displayName(A.got[i])} got it first!`, ""); }
}

// the cop's light bar (red / blue, flashing) — on a friend's car or on mine
const BAR = { geo: null, red: null, blue: null, mine: null };
function lightBar() {
    if (!BAR.geo) {
        BAR.geo = new THREE.BoxGeometry(0.62, 0.22, 0.34);
        BAR.red = new THREE.MeshStandardMaterial({ color: "#ff1744", emissive: "#ff1744", emissiveIntensity: 2 });
        BAR.blue = new THREE.MeshStandardMaterial({ color: "#2979ff", emissive: "#2979ff", emissiveIntensity: 2 });
    }
    const g = new THREE.Group();
    const r = new THREE.Mesh(BAR.geo, BAR.red), b = new THREE.Mesh(BAR.geo, BAR.blue);
    r.position.x = 0.33; b.position.x = -0.33;
    g.add(r, b);
    g.position.set(0, 1.62, -0.35);
    return g;
}
function copTick() {
    const A = N.A, live = A.k === "tag" && A.ph !== "done" && !ctx.view;
    const flash = Math.floor(performance.now() / 160) % 2;
    if (BAR.red) { BAR.red.emissiveIntensity = flash ? 3.2 : 0.4; BAR.blue.emissiveIntensity = flash ? 0.4 : 3.2; }
    for (const rc of R.cars.values()) {
        const want = live && A.cop === rc.uid;
        if (want && !rc.bar) { rc.bar = lightBar(); rc.v.tilt.add(rc.bar); }
        if (rc.bar) rc.bar.visible = want;
    }
    const me = live && A.cop === N.uid && ctx.car;
    if (me && !BAR.mine) { BAR.mine = lightBar(); ctx.car.tilt.add(BAR.mine); }
    if (BAR.mine) BAR.mine.visible = !!me;
    if (A.k === "tag" && A.n !== P.copN) {
        const was = P.copN;
        P.copN = A.n;
        if (was != null && A.ph === "go" && A.id === P.actId) {
            if (A.cop === N.uid) { H.banner(`<b>🚓 YOU'RE THE COP!</b><small>${U.esc(displayName(A.by || ""))} got you — bump someone!</small>`, 1800); AU.sfxSiren(1.2); rumble(0.6, 0.8, 300, true); }
            else if (A.by === N.uid) { H.toast(`🚓 Tagged ${displayName(A.cop)}! Run!`, "gold"); tone(523, 0.12, "triangle", 0.2, 784); }
            else H.toast(`🚓 ${displayName(A.cop)} is the cop now!`, "");
        }
    }
}

// ── the HUD ──────────────────────────────────────────────────────────────
hook("hud", dt => {
    if (!N.want) return;
    // a paused party keeps the world going: ease to a stop, hold the lane
    if (ctx.paused && driving()) updateDriving(dt, {}, false, ctx.state === "partyWait" ? waitCtl(dt) : holdCtl(dt, 0));
    if (!driving()) { U.hideHud(); return; }
    P.hudT = (P.hudT || 0) - dt;
    if (P.hudT > 0) return;
    P.hudT = 0.2;
    const A = N.A, car = ctx.car;
    if (A.k === "race") {
        const rows = standings();
        const mi = rows.findIndex(r => r.me);
        const toGo = Math.max(0, GRID_S + RACE_LEN - car.s);
        const board = `<div class="t">🏁 RACE</div>` + rows.slice(0, 8).map((r, i) => `<div class="r${r.me ? " me" : ""}${r.dim ? " dim" : ""}"><span>${i + 1}</span><i style="background:${R.skinHex(r.sk)}"></i><span class="n">${U.esc(r.name)}</span><span class="v">${r.fin != null ? "🏁 " + fmtRace(r.fin - A.t0) : r.me ? "" : fmtGap(r.s - car.s)}</span></div>`).join("");
        const chip = P.me.finished ? `🏁 FINISHED · <b>${ordinal(P.me.place || mi + 1)}</b>` : ctx.state === "partyGrid" || rows.length < 2 ? "" : `<b>${ordinal(mi + 1)}</b> of ${rows.length}${toGo < 300 ? " · the flag's right there!" : ""}`;
        U.hud(board, chip, P.me.finished ? "gold" : "place");
    } else if (A.k === "dash" || A.k === "tag") {
        const left = Math.max(0, (A.t0 + A.dur - clock()) / 1000);
        const clockTxt = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
        const rows = scoreRows(A);
        const board = `<div class="t">${ACTS[A.k].emoji} ${A.k === "dash" ? "DREIDELS" : "TIME AS COP"}</div>` + rows.map(r => `<div class="r${r.me ? " me" : ""}"><i style="background:${R.skinHex(r.sk)}"></i><span class="n">${r.cop ? "🚓 " : ""}${U.esc(r.name)}</span><span class="v">${A.k === "dash" ? "✨ " + r.n : Math.round(r.n / 1000) + "s"}</span></div>`).join("");
        let chip = "", cls = "";
        if (ctx.state === "partyGrid") chip = "";
        else if (A.k === "dash") { const me = rows.find(r => r.me); chip = `✨ You've got <b>${me ? me.n : 0}</b>${left < 10 ? ` · ${clockTxt}!` : ""}`; cls = "gold"; }
        else if (A.cop === N.uid) { chip = clock() < A.guard ? `🚓 YOU'RE THE COP! (head start…)` : `🚓 YOU'RE THE COP! Bump a friend`; cls = "pink"; }
        else { chip = `🚓 Avoid ${U.esc(displayName(A.cop))}!`; cls = ""; }
        U.hud(board, chip, cls);
    } else if (A.k === "trip") {
        const rows = NET.members().map(u => { const me = u === N.uid, rc = R.cars.get(u), p = N.players.get(u);
            return { me, name: displayName(u), sk: skinOf(u), s: me ? car.s : rc && rc.shown ? rc.s : null, arr: A.arr && A.arr[u], st: me ? "" : p ? R.status(p) || PS.presenceBadge(p) : "" }; });
        const board = `<div class="t">🏡 TO BUBBE'S</div>` + rows.map(r => `<div class="r${r.me ? " me" : ""}${r.s == null && !r.arr ? " dim" : ""}"><i style="background:${R.skinHex(r.sk)}"></i><span class="n">${U.esc(r.name)}</span><span class="v">${r.arr ? "🏡" : r.st || (r.me || r.s == null ? "" : fmtGap(r.s - car.s))}</span></div>`).join("");
        let chip = "", cls = "";
        if (P.me.arrived) { const wait = rows.filter(r => !r.arr && !r.me).length; chip = wait ? `🏡 You made it! Waiting for ${wait}…` : "🏡 Everyone's here!"; cls = "pink"; }
        else if (P.convoy.on) { chip = "🚗🚗 CONVOY · coins ×2"; cls = "green"; }
        U.hud(rows.length > 1 ? board : "", chip, cls);
    }
    // first seconds: how to chat
    if (ctx.state === "playing" && ctx.G.runTime < 8 && !ctx.TEST) H.padHint(`😀 hold ${glyph("fire")} emotes + quick chat · ${glyph("honk")} honk + wave`);
}, -20);

function standings() {
    const A = N.A, car = ctx.car, rows = [];
    for (const u of A.ps || []) {
        const me = u === N.uid, rc = R.cars.get(u), p = N.players.get(u);
        if (!me && !p) continue;
        rows.push({ uid: u, me, name: displayName(u), sk: skinOf(u), fin: A.fin && A.fin[u] != null ? A.fin[u] : me && P.me.finished ? P.me.finishT : null,
            s: me ? car.s : rc && rc.shown ? rc.s : (p && p.samples.length ? p.samples[p.samples.length - 1].s : 0), dim: !me && (!p || !NET.fresh(p)) });
    }
    rows.sort((a, b) => (a.fin != null) !== (b.fin != null) ? (a.fin != null ? -1 : 1) : a.fin != null ? a.fin - b.fin : b.s - a.s);
    return rows;
}
const ordinal = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
function fmtRace(ms) { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return `${m}:${s.toFixed(1).padStart(4, "0")}`; }
function fmtGap(m) { return Math.abs(m) < 1 ? "·" : (m > 0 ? "+" : "−") + (Math.abs(m) >= 1000 ? (Math.abs(m) / 1000).toFixed(1) + " km" : Math.round(Math.abs(m)) + " m"); }

// the trip bar shows the party goal
on("boot", () => {
    const base = ctx.trip;
    ctx.trip = {
        get prio() { return !inPartyRun() ? (base ? base.prio : null) : N.A && N.A.k === "roam" ? H.OBJ.list - 1 : H.OBJ.timed; },      // (ci/hud: a race / a party game's clock on a phone; 🌍 Free Roam is no clock)
        progress() {
            if (!inPartyRun()) return base ? base.progress() : 1;
            const A = N.A, s = ctx.car.s;
            if (ACTS[A.k] && ACTS[A.k].progress) return ACTS[A.k].progress();
            if (A.k === "race") return (s - GRID_S) / RACE_LEN;
            if (A.dur) return Math.max(0, Math.min(1, (clock() - A.t0) / A.dur));
            if (A.k === "trip") return (s - GRID_S) / (tripEnd() - 48 - GRID_S);
            return 1;
        },
        label() {
            if (!inPartyRun()) return base ? base.label() : "";
            const A = N.A, s = ctx.car.s;
            const icon = document.querySelector(".trip-to");
            if (ACTS[A.k] && ACTS[A.k].label) return ACTS[A.k].label(icon);
            if (A.k === "race") { if (icon && icon.textContent !== "🏁") icon.textContent = "🏁"; const r = Math.max(0, GRID_S + RACE_LEN - s); return `🏁 PARTY RACE · ${r >= 1000 ? (r / 1000).toFixed(1) + " km" : Math.round(r) + " m"} to the flag`; }
            if (A.dur) { const e = ACTS[A.k].emoji; if (icon && icon.textContent !== e) icon.textContent = e; const left = Math.max(0, (A.t0 + A.dur - clock()) / 1000); return `${e} ${ACTS[A.k].name.toUpperCase()} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")} left`; }
            if (icon && icon.textContent !== "🏡") icon.textContent = "🏡";
            return `🏡 BUBBE'S HOUSE · ${(Math.max(0, tripEnd() - s) / 1609).toFixed(1)} mi`;
        },
    };
});

// ── quick chat + emotes: emotes.js (the wheel, gestures on friends' puppets, combos, greetings) ──
// The old quick-chat broadcast ("c": an index into the old phrase list) is still shown when an older page sends it.
on("party:bc", ({ p, k, a }) => {
    if (k !== "c") return;
    const txt = U.LEGACY[a[0] | 0];
    if (!txt) return;
    if (STG.shown()) { STG.say(p.uid, txt); return; }
    const rc = R.cars.get(p.uid);
    if (rc && rc.shown) rc.bubble.show(txt);
    if (!rc || !rc.shown || Math.abs(rc.s - ctx.car.s) > 90) H.toast(`💬 ${displayName(p.uid)}: ${txt}`, "pink");
    tone(880, 0.06, "sine", 0.1);
});

// ── the lobby card ───────────────────────────────────────────────────────
function lobbyModel() {
    const mem = NET.members();
    return { mem, info: mem.map(playerInfo) };
}
function renderLobby(force) {
    if (ctx.state !== "partyLobby") return;
    const conn = N.connected && N.host;
    const lost = N.lost && !N.host;
    const key = [conn ? 1 : 0, lost ? 1 : 0, N.isHost ? 1 : 0, N.A.pick || P.pick].join("|");
    const focusNow = H.screenOpen() && document.querySelector("#screenCard .focus") ? document.querySelector("#screenCard .focus").id : null;
    if (!force && key === P.lobbyKey && H.screenOpen() && document.querySelector("#screenCard.pt-lobby")) {
        const t = performance.now();
        if (t - (P.lobbyAt || 0) > 200) { P.lobbyAt = t; refreshLobbyBits(); }
        return;
    }
    P.lobbyKey = key;
    const code = `<div class="pt-code sm">${[...N.code].map(c => `<span>${c}</span>`).join("")}</div>`;
    if (!conn) {
        const html = lost
            ? `<h2>🤔 No party called ${U.esc(N.code)}</h2><p class="pt-sub">Check the code with your friend — or host your own.</p>${code}`
            : `<h2>🎉 ${N.isHost ? "Setting up your party…" : "Joining the party…"}</h2>${code}<p class="pt-sub">${N.attempts > 1 ? "Can't reach the party server — still trying…" : "Connecting…"}</p>`;
        const btns = lost
            ? [{ id: "pt_retry", cls: "pt-big", label: `🔑 Try another code ${glyph("confirm")}`, action: () => { const c = N.code; leave(false); setState("title"); openJoin(c, "", ""); } },
               { id: "pt_hostinst", cls: "purple", label: "🎉 Host my own party", action: () => { leave(false); hostParty(); } },
               { id: "pt_cancel", cls: "alt", label: `Back ${glyph("back")}`, action: () => leave() }]
            : [{ id: "pt_cancel", cls: "alt", label: `Cancel ${glyph("back")}`, action: () => leave() }];
        H.showScreen(html, btns, { onBack: () => leave(), focus: btns[0].id, cls: "pt-card pt-lobby" });
        return;
    }
    const host = N.isHost;
    const pick = N.A.pick && ACTS[N.A.pick] ? N.A.pick : P.pick;
    if (host) P.pick = pick;
    const act = ACTS[pick];
    const tiles = ORDER.map(k => `<button class="btn${k === pick ? " sel" : ""}" id="pt_act_${k}">${ACTS[k].emoji} ${ACTS[k].name}<small>${ACTS[k].blurb}</small></button>`).join("");
    const html = `<div class="pt-row">${code}<button class="btn pt-invite" id="pt_inv">📤 Invite</button></div>
        <div class="pt-link" id="pt_link">${U.esc(P.shareMsg || U.inviteUrl(N.code, N.uid).replace(/^https?:\/\//, ""))}</div>
        <div class="pt-crew" id="pt_crew"></div>
        <div class="pt-h">You</div>
        <div class="pt-opts"><button class="btn" id="pt_name"></button><button class="btn" id="pt_car"></button><button class="btn" id="pt_horn"></button></div>
        <div class="pt-h">${host ? "Pick a game" : "Next up"}</div>
        ${host ? `<div class="pt-acts">${tiles}</div>` : `<div class="pt-next">${act.emoji} ${act.name}<small>${act.blurb} · the host starts it</small></div>`}
        <div class="menu"><button class="btn pt-big" id="pt_go"></button><button class="btn pt-leave" id="pt_leave">🚪 Leave party</button></div>
        <div class="pt-status" id="pt_status"></div>`;
    const card = H.showScreen(html, [], { onBack: backInLobby, focus: focusNow || P.lobbyFocus || "pt_go", cls: "pt-card pt-lobby" });
    const onc = (id, fn) => { const b = card.querySelector("#" + id); if (b) b.addEventListener("click", () => { AU.sfxSelect(); fn(b); }); };
    onc("pt_inv", async () => { P.shareMsg = await U.shareInvite(N.code, N.uid); const l = document.getElementById("pt_link"); if (l && P.shareMsg) l.textContent = P.shareMsg; if (P.shareMsg) H.toast(P.shareMsg, "gold"); });
    onc("pt_name", () => { const i = NET.NAMES.indexOf(nameOf(N.uid)); NET.setMyName(NET.NAMES[(i + 1) % NET.NAMES.length]); P.cache.at = -1; names.at = -1; refreshLobbyBits(); });
    onc("pt_car", () => {
        const c = profileCache(), i = c.skins.indexOf(ctx.car.skinKey), next = c.skins[(i + 1) % c.skins.length];
        ctx.car.setSkin(next); shared.update(s => { s.selectedSkin = next; }); emit("skin", { key: next }); N.urgent = true; refreshLobbyBits();
    });
    onc("pt_horn", () => {
        const c = profileCache(), i = c.horns.indexOf(c.horn), next = c.horns[(i + 1) % c.horns.length];
        shared.update(s => { s.horn = next; }); P.cache.at = -1; if (ctx.garage) ctx.garage.playHorn(next); N.urgent = true; refreshLobbyBits();
    });
    for (const k of ORDER) onc("pt_act_" + k, () => { if (!N.isHost) return; P.pick = k; NET.setA(Object.assign({}, N.A, { pick: k })); renderLobby(true); });
    onc("pt_go", () => {
        if (N.isHost) { hostStart(P.pick); return; }
        P.ready = !P.ready; N.urgent = true; refreshLobbyBits();
        if (P.ready) { tone(660, 0.1, "triangle", 0.14, 880); STG.wave(N.uid); }
    });
    onc("pt_leave", () => leave());
    refreshLobbyBits();
    H.refreshFocus(true);
}
/** ○ / Esc in the lobby: first hop to "Leave party", a second press leaves (no accidental exits). */
function backInLobby() {
    const f = document.querySelector("#screenCard .focus");
    const lv = document.getElementById("pt_leave");
    if (!lv || (f && f.id === "pt_leave")) { leave(); return; }
    lv.dispatchEvent(new Event("pointerenter"));
    AU.sfxSelect();
}
function refreshLobbyBits() {
    const card = document.getElementById("screenCard");
    if (!card || !card.classList.contains("pt-lobby")) return;
    const { info } = lobbyModel();
    const set = (id, html) => { const el = card.querySelector("#" + id); if (el && el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; } };
    set("pt_crew", info.map(p => `<span class="${p.me ? "me" : ""}${p.status === "📶" ? " dim" : ""}"><i style="background:${R.skinHex(p.sk)}"></i>${p.host ? "👑 " : ""}${U.esc(p.name)}${p.me ? " (you)" : ""}${p.status ? " " + p.status : p.ready && !p.host ? " ✓" : ""}</span>`).join(""));
    const c = profileCache();
    const horn = (ctx.garage && ctx.garage.items && ctx.garage.items().horn) || c.horn;
    const hornName = { beep: "📢 Beep", duck: "🦆 Duck", clown: "🤡 Clown", shofar: "📯 Shofar", cucaracha: "🎺 Cucaracha", train: "🚂 Train" }[horn] || "📢 Beep";
    set("pt_name", `🙂 ${U.esc(nameOf(N.uid))}<small>NAME</small>`);
    set("pt_car", `🚗 ${U.esc((SKINS[ctx.car.skinKey] || SKINS.pink).name)}<small>CAR${c.skins.length > 1 ? "" : " · more in the shop"}</small>`);
    set("pt_horn", `${hornName}<small>HORN</small>`);
    const guests = info.filter(p => !p.host);
    const ready = guests.filter(p => p.ready).length;
    const act = ACTS[N.isHost ? P.pick : (N.A.pick || P.pick)] || ACTS.trip;
    set("pt_go", N.isHost ? `▶ Start ${act.emoji} ${act.name} ${glyph("confirm")}` : P.ready ? `✓ Ready! <small class="d">waiting for the host</small>` : `✓ I'm ready! ${glyph("confirm")}`);
    set("pt_status", N.isHost
        ? (guests.length ? `${ready} of ${guests.length} friend${guests.length === 1 ? "" : "s"} ready · start whenever you like` : `Share the code — friends can join any time`)
        : `👑 ${U.esc(displayName(N.host))} is hosting · ${info.length}/${NET.MAX_PLAYERS} here`);
    // the 3D lineup
    STG.layout(info.map(p => ({ uid: p.uid, sk: p.sk, hc: p.me ? profileCache().hair : (N.players.get(p.uid) || {}).hc, name: p.name, host: p.host, ready: p.ready && !p.host, status: p.status, me: p.me })));
}

// ── results ──────────────────────────────────────────────────────────────
/** My party run is over (results / back to the lobby / leaving / the next game): bank it like any run —
 *  run:end → lifetime score + miles, quests, badges, best (meta), the job / call wrap-ups. Once per run. */
function closeRun(why) {
    const G = ctx.G;
    if (!P.runLive || G.mode !== "party" || G.ended) { P.runLive = false; return; }
    P.runLive = false;
    try { endRun(why); } catch (e) { console.error("[party] endRun", e); }
}
function showResults(A) {
    if (ctx.foot && ctx.foot.active) ctx.foot.end("party");      // (still walking when it ended: back to her car for the photo)
    closeRun("party");
    if (ctx.paused) resume();
    U.countdown(null);
    if (A.k === "trip") {
        // the group shot at Bubbe's: park me in my spot if I'm not there yet
        if (!P.me.arrived || !ctx.world.chunks.size || Math.abs(ctx.car.s - tripEnd()) > 120) {
            const order = Object.keys(A.arr || {}).indexOf(N.uid);
            const slots = [-34, -27, -20, -13, 10, 17, 24, 31];
            if (ctx.G.mode !== "party") { P.internal = true; try { resetRun({ mode: "party", s: tripEnd() }); } finally { P.internal = false; } T.configure(A.seed, A.t0, GRID_S); }
            placeCar(tripEnd() + slots[Math.max(0, Math.min(7, order < 0 ? Object.keys(A.arr || {}).length : order))], 11.8, 0);
            P.me.arrived = true;
        }
        setState("partyResults", { podium: false });
        for (let i = 0; i < 5; i++) setTimeout(() => { if (ctx.state === "partyResults") { const c = ctx.car; c.fx.burst(c.pos.x + (Math.random() - 0.5) * 30, 6, c.pos.z + (Math.random() - 0.5) * 20, 30, 6, [[1, 0.3, 0.55], [1, 0.85, 0.2], [0.3, 0.75, 1], [0.5, 1, 0.5], [0.8, 0.5, 1]][i], 0.6, 1.6); } }, i * 350);
    } else {
        setState("partyResults", { podium: true });
    }
    tone(523, 0.12, "triangle", 0.2); tone(659, 0.14, "triangle", 0.2, 0, 0.12); tone(784, 0.16, "triangle", 0.2, 0, 0.24); tone(1047, 0.24, "triangle", 0.2, 0, 0.38);
}
function resultRows(A) {
    if (A.k === "race") {
        const rows = (A.ps || []).map(u => ({ uid: u, name: displayName(u), sk: skinOf(u), me: u === N.uid,
            t: A.fin && A.fin[u] != null ? A.fin[u] - A.t0 : null,
            s: u === N.uid ? ctx.car.s : (() => { const p = N.players.get(u); return p && p.samples.length ? p.samples[p.samples.length - 1].s : 0; })() }));
        rows.sort((a, b) => (a.t != null) !== (b.t != null) ? (a.t != null ? -1 : 1) : a.t != null ? a.t - b.t : b.s - a.s);
        const win = rows[0] && rows[0].t;
        return rows.map((r, i) => Object.assign(r, { place: i, val: r.t == null ? "DNF" : i === 0 ? fmtRace(r.t) : "+" + ((r.t - win) / 1000).toFixed(1) + "s" }));
    }
    if (A.k === "dash" || A.k === "tag") {
        const rows = scoreRows(A);
        return rows.map((r, i) => Object.assign(r, { place: i, t: 1, val: A.k === "dash" ? `✨ ${r.n}` : `🚓 ${Math.round(r.n / 1000)}s as cop` }));
    }
    const arr = A.arr || {};
    const rows = (A.ps || []).map(u => ({ uid: u, name: displayName(u), sk: skinOf(u), me: u === N.uid, t: arr[u] ? arr[u][0] - A.t0 : null, coins: arr[u] ? arr[u][1] : 0 }));
    rows.sort((a, b) => (a.t != null) !== (b.t != null) ? (a.t != null ? -1 : 1) : (a.t || 0) - (b.t || 0));
    return rows.map((r, i) => Object.assign(r, { place: i, val: r.t == null ? "on the way" : `${fmtRace(r.t)} · 💰 ${r.coins}` }));
}
function renderResults(force) {
    if (ctx.state !== "partyResults") return;
    const A = N.A;
    const key = [A.id, A.v, N.isHost ? 1 : 0].join("|");
    if (!force && key === P.resKey) return;
    P.resKey = key;
    const rows = resultRows(A);
    const medal = ["🏆", "🥈", "🥉"];
    const all = A.k === "trip" && rows.every(r => r.t != null);
    const won = rows[0] && rows[0].me;
    const title = A.k === "trip" ? (all ? "🏡 Everyone made it to Bubbe's!" : "🏡 At Bubbe's house!")
        : A.k === "race" && !(rows[0] && rows[0].t != null) ? "🏁 Race over!"
        : won ? `🏆 You win${A.k === "race" ? " the race" : ""}!` : `${ACTS[A.k].emoji} ${rows[0] ? U.esc(rows[0].name) : ""} wins!`;
    const sub = A.k === "race" ? "Party race · 2.5 km" : A.k === "dash" ? "Dreidel Dash · most golden dreidels" : A.k === "tag" ? "Cop Tag · least time as the cop" : `"Come in, come in — the cholent's hot!" — Bubbe 👵`;
    const list = `<div class="pt-res">${rows.map(r => `<div class="${r.me ? "me" : ""}"><b>${A.k !== "trip" && r.t != null ? (medal[r.place] || r.place + 1) : A.k === "trip" && r.t != null ? r.place + 1 : "·"}</b><span class="n"><i style="background:${R.skinHex(r.sk)}"></i>${U.esc(r.name)}${r.me ? " (you)" : ""}</span><span class="t">${r.val}</span></div>`).join("")}</div>`;
    const html = `<h2>${title}</h2><p class="pt-sub">${sub}</p>${list}${N.isHost ? "" : `<div class="pt-status">👑 ${U.esc(displayName(N.host))} picks what's next…</div>`}`;
    const btns = [];
    if (A.k === "trip" && ctx.play && ctx.play.openPhoto) btns.push({ id: "pt_photo", cls: N.isHost ? "pink" : "pt-big pink", label: `📸 Group photo`, action: () => ctx.play.openPhoto("pause") });
    if (N.isHost) {
        const fr = A.fromRoam && ACTS.roam ? { fromRoam: 1 } : null;     // (a game the group voted for from 🌍 Free Roam: no lobby after)
        if (A.k !== "trip") btns.unshift({ id: "pt_again", cls: "pt-big", label: `🔁 ${A.k === "race" ? "Rematch" : "Play again"} ${glyph("confirm")}`, action: () => hostStart(A.k, fr) });
        else btns.unshift({ id: "pt_again", cls: "pt-big", label: `🏁 Race next ${glyph("confirm")}`, action: () => { P.pick = "race"; hostStart("race", fr); } });
        if (fr) btns.push({ id: "pt_roamback", cls: "purple", label: "🌍 Back to driving around", action: () => hostStart("roam") });
        else btns.push({ id: "pt_lobby", cls: "purple", label: "🏠 Back to the lobby", action: hostToLobby });
    }
    btns.push({ id: "pt_leave2", cls: "alt", label: "🚪 Leave party", action: () => leave() });
    H.showScreen(html, btns, { onBack: () => { }, focus: btns[0].id, cls: "pt-card pt-lobby" });
    if (STG.shown()) STG.layout(rows.map(r => ({ uid: r.uid, sk: r.sk, hc: r.me ? profileCache().hair : (N.players.get(r.uid) || {}).hc, name: r.name, host: r.uid === N.host, rank: r.t != null ? r.place : 9, me: r.me, status: "" })));
}

// a small caption over the screen (spectating)
const cap = document.createElement("div");
cap.style.cssText = "position:fixed;left:50%;top:calc(max(12px, env(safe-area-inset-top)) + 10px);transform:translateX(-50%);z-index:8;display:none;background:rgba(20,16,36,.72);color:#fff;border-radius:999px;padding:7px 16px;font:700 15px var(--font);white-space:nowrap;pointer-events:none";
document.body.appendChild(cap);
let capHtml = "";
function caption(html) { if (html === capHtml) return; capHtml = html; cap.innerHTML = html; cap.style.display = html ? "" : "none"; }

// ── publishing my state ──────────────────────────────────────────────────
function updateRate() {
    const t = performance.now();
    if (rate.g >= 0) {
        const dg = ctx.time - rate.g, dw = (t - rate.w) / 1000;
        if (dw > 0.001 && dw < 0.5 && dg >= 0) rate.r += (Math.max(0.02, Math.min(1.5, dg / dw)) - rate.r) * 0.12;
    }
    rate.g = ctx.time; rate.w = t;
}
function publish() {
    const st = ctx.state, car = ctx.car, c = profileCache();
    const pr = N.profile;
    pr.n = c.name || NET.myName(); pr.sk = car.skinKey; pr.hn = c.horn; pr.hc = c.hair; pr.rd = P.ready ? 1 : 0;
    let m = N.mode;
    const run = (ctx.G && ctx.G.mode === "party" && N.A.k !== "lobby") || lightRoam();
    const foot = st === "footRun" && run && ctx.foot && ctx.foot.active && !!ctx.foot.pos;
    if (st === "partyLobby") m = 1;
    else if (st === "partyGrid") m = 2;
    else if ((st === "playing" && (ctx.G.mode === "party" || lightRoam())) || foot) m = 3;
    else if (st === "partyWait") m = 4;
    else if (st === "partySpectate") m = 5;
    else if (st === "partyResults") m = N.A.k === "trip" ? 4 : 6;
    else if (st === "playPhoto") { /* keep */ }
    else if (run && st !== "title" && st !== "loading") m = 7;     // away in a personal scene (inside, jail, a cutscene): no pose, presence only
    else m = 0;
    N.mode = m;
    if (m >= 2 && m <= 4 && car && ctx.world) {
        const act = ACTS[N.A.k], fr = act && act.pose ? act.pose() : null;   // (another frame: a town's streets)
        const h = fr ? fr.h : ctx.world.road.at(car.s, tmpA).h;
        const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
        const k = rate.r;
        // on foot the car is an invisible anchor that follows her: publish HER (velocity, facing, a hop / vault)
        const fv = foot ? ctx.foot.vel : null;
        const vx = fv ? fv.x : car.vx, vz = fv ? fv.z : car.vz;
        const yaw = foot && ctx.foot.facing != null ? ctx.foot.facing : car.h;
        const y = foot ? Math.max(0, ((ctx.foot.obj && ctx.foot.obj.position.y) || 0.05) - 0.05)
            : ctx.play && ctx.play.jump && ctx.play.jump.y > 0.02 ? ctx.play.jump.y : 0;
        poseArr[0] = Math.round((fr ? fr.s : car.s) * 10); poseArr[1] = Math.round((fr ? fr.d : car.d) * 100);
        poseArr[2] = Math.round((vx * fx + vz * fz) * k * 100); poseArr[3] = Math.round((vx * rx + vz * rz) * k * 100);
        poseArr[4] = Math.round(wrapAngle(yaw - h) * 1000); poseArr[5] = foot ? 0 : Math.round(car.steerVal * 100);
        poseArr[6] = Math.round(y * 100); poseArr[7] = P.rs;
        N.pose = poseArr;
    } else N.pose = null;
    publishExtras(m, foot);
    let f = 0;
    const live = st === "playing" && !ctx.paused;
    if ((live && input.brake > 0.1 && car.vF > 0.5) || (car.accelLong < -4 && car.vF > 0.5) || st === "partyGrid") f |= 1;
    if (car.boosting) f |= 2;
    if (live && input.honkHeld && !U.wheelOpen()) f |= 4;
    if (ctx.paused) f |= 8;
    if (document.hidden) f |= 16;
    N.flags = f;
}
/** Everything friends need to draw what I'm doing beyond my pose (presence.js; ~10×/s, tiny arrays). */
const XP = { at: -1e9, jk: [] };
function publishExtras(m, foot) {
    PS.publishPresence();
    const w = performance.now();
    if (w - XP.at < 90) return;
    XP.at = w;
    const inRun = m >= 2 && m <= 4 || m === 7;
    const F = inRun ? ctx.foot : null, car = ctx.car;
    NET.setX("f", foot && F ? [F.animCode | 0, F.lookCode | 0, F.heightCode | 0] : null);     // (f[2]: her feet's height, dm — a jump, a bench, a car roof)
    NET.setX("un", N.rid && ctx.accounts && ctx.accounts.ticketFor ? ctx.accounts.ticketFor(N.room, N.rid) : null);   // (features/accounts: my name ticket for this room)
    const pr = PS.myPresence();
    // a scene that takes her out of the car right where it stands (a pull-in place, a porch, a side job's scene):
    // friends see her car parked there with the tag over it; jail / court / the ER are elsewhere (no car shown)
    const here = m === 7 && !!car && /^(scene|in|job)$/.test(pr[0]);
    let pk = F && F.active ? F.parkedCar : null;
    if (!pk && here && F) { const v0 = F.vehicle; pk = { x: car.pos.x, z: car.pos.z, h: car.h, key: v0 && v0.kind ? v0.kind : "lulu", paint: v0 && v0.color, wrecked: false }; }
    NET.setX("pc", pk ? [Math.round(pk.x * 10), Math.round(pk.z * 10), Math.round(wrapAngle(pk.h) * 1000), pk.key === "lulu" ? 0 : pk.key, pk.paint || 0, pk.wrecked ? 1 : 0] : null);
    const v = F && !foot && !F.active ? F.vehicle : null;
    NET.setX("v", v && v.kind ? [v.kind, v.color || 0] : null);
    const cops = inRun && m !== 7 && ctx.law && ctx.law.partyUnits ? ctx.law.partyUnits(3) : null;
    NET.setX("cp", cops && cops.length ? cops : null);
    const ws = inRun && ctx.law ? ctx.law.wanted | 0 : 0;
    NET.setX("ws", ws > 0 ? ws : null);
    NET.setX("at", here ? [Math.round(car.pos.x * 10), Math.round(car.pos.z * 10)] : null);
    NET.setX("jk", XP.jk.length ? XP.jk : null);
    NET.setX("cl", XC.length ? XC : null);
}

// ── claiming a SHARED car: it pulls over — the same way on every screen — and it's hers ──
// A shared car never stops on its own (it's a pure function of the clock), so streets' carjack had only a
// split second as one passed. Now when she steps out in front of one, flags one down (✋ FLAG IT DOWN), rams
// one, or pulls one over in a cop car, she CLAIMS it: one broadcast ("cl": key, T0, L×10, dS×10, hail) + d.x.cl
// for late joiners, and every screen takes it out of the conveyor and brakes it onto its shoulder by the same
// pure formula (traffic.js claimPose). It's hers: only her copy can be jacked (or hopped into, when she flagged it
// down); once she drives off in it it's gone for everyone ("j"), and friends see her in that model (d.x.v).
// Keys are the conveyor's ("lane:slot"); another feature's shared cars register a handler for their prefix
// (openworld's town loops: "tw:…").
const CLAIM = { cool: 0, n: 0, H: new Map(), flag: null, hop: null, pending: null };
const XC = [];                       // my last claims, flat for d.x.cl: [key, T0, L×10, dS×10, hail, …] (≤ 4)
const HWY = {
    add: (key, T0, L, dS, by, mine, hail) => T.addClaim(key, T0, L, dS, by, mine, hail),
    kill: key => T.killClaim(key),
    claimed: key => T.PT.claims.has(key),
    /** brake evenly to a stop L m on (≤ ~8 m/s², or `opts.L`), onto the shoulder on its own side */
    plan: (c, opts) => ({ L: Math.max(12, opts.L != null ? opts.L : c.speed * c.speed / 14), dS: Math.sign(c.d || 1) * T.SHOULDER_D }),
};
function claimHandler(key) { const k = String(key), i = k.indexOf(":"); return (i > 0 && CLAIM.H.get(k.slice(0, i))) || HWY; }
/** Claims are a carjack thing: a 🏡 Road Trip / 🌍 Free Roam run (not a race / dash / tag) with streets on. */
/** (🌍 on her own run the town's loop minivans are still the shared ones — openworld/towntraffic — so they claim the same way) */
// 🌍 online with no group at all (ci/friends, the world clock's client half): a town's loop minivans are the SAME on every
// screen (openworld › worldTowns), so they claim the same way — on the world clock, sent as reliable one-time events
// ("tcl" / "tj", multiplayer's ctx.mp.event) to everyone in the same place
const worldClaims = () => !N.want && !!(ctx.openworld && ctx.openworld.worldTowns && ctx.openworld.worldTowns());
const claimClock = () => (worldClaims() && ctx.worldClock ? ctx.worldClock.now() : clock());
const claimWorld = () => inPartyRun() || lightRoam() || worldClaims();
function claimRunOk() { if (worldClaims()) return ctx.enabled("streets"); const A = N.A; return claimWorld() && !!A && A.id === P.actId && (A.k === "trip" || A.k === "roam") && ctx.enabled("streets"); }
function canClaim(c) {
    const key = c && c.data && c.data.party;
    return typeof key === "string" && (!worldClaims() || key.startsWith("tw:")) && !c.data.lightClaim && claimRunOk() && !c.hit && !T.PT.gone.has(key) && !T.PT.dead.has(key) &&
        !(claimHandler(key).claimed && claimHandler(key).claimed(key)) && !!(ctx.streets && ctx.streets.rides && ctx.streets.rides[c.kind]);
}
function claimShared(c, opts = {}) {
    if (!canClaim(c)) return false;
    const key = c.data.party, h = claimHandler(key), pl = h.plan(c, opts);
    if (opts.dS != null) pl.dS = opts.dS;
    pl.L = Math.round(pl.L * 10) / 10; pl.dS = Math.round(pl.dS * 10) / 10;     // (what friends get: the same stop to the cm)
    const T0 = Math.round(claimClock()), hail = opts.hail ? 1 : 0;
    if (!h.add(key, T0, pl.L, pl.dS, N.uid || "me", true, !!hail)) return false;
    const L10 = Math.round(pl.L * 10), d10 = Math.round(pl.dS * 10);
    if (worldClaims()) { if (ctx.mp && ctx.mp.event) ctx.mp.event("tcl", { a: [key, T0, L10, d10, hail] }); }
    else {
        XC.push(key, T0, L10, d10, hail);
        while (XC.length > 20) XC.splice(0, 5);
        NET.setX("cl", XC.slice());
        NET.broadcast("cl", key, T0, L10, d10, hail);
    }
    CLAIM.n++;
    emit("party:claim", { key, how: opts.how || "stop", hail: !!hail });
    emit("stat", { id: "partyClaims", n: 1 });
    return true;
}
/** A friend's claims (a "cl" broadcast or their d.x.cl): the same pull-over on my screen. Idempotent. */
function applyClaims(p, a) {
    if (!Array.isArray(a)) return;
    for (let i = 0; i + 5 <= a.length; i += 5) {
        const key = a[i], T0 = +a[i + 1], L = +a[i + 2] / 10, dS = +a[i + 3] / 10;
        if (typeof key !== "string" || key.length > 40 || !isFinite(T0) || !isFinite(L) || !isFinite(dS) || T.PT.dead.has(key)) continue;
        claimHandler(key).add(key, T0, L, dS, p.uid, false, !!a[i + 4]);
    }
}
on("party:bc", ({ p, k, a }) => { if (k === "cl" && claimWorld() && p.aid === N.A.id) applyClaims(p, a); });
// 🌍 another player online claimed / took a town loop minivan (reliable events — a late one still counts: the claim's
//  pure formula puts the car where it is now)
on("mp:event", e => {
    if (!e || !e.d || !Array.isArray(e.d.a) || !worldClaims()) return;
    if (e.k === "tcl") applyClaims({ uid: "mp:" + e.from }, e.d.a.slice(0, 5));
    else if (e.k === "tj") for (const key of e.d.a.slice(0, 2)) if (typeof key === "string" && key.startsWith("tw:")) dropShared(key);
});
function claimFeedback(c, how) {
    const msg = how === "step" ? "🛑 SCREEEECH — it stopped for you!" : how === "ram" ? "💥 They're pulling over… go get it!" : how === "hail" ? "✋ They're pulling over for you!" : "🚨 Pulling over…";
    H.toast(msg, "gold");
    tone(how === "step" ? 1250 : 520, 0.22, "sawtooth", 0.05, how === "step" ? 900 : 520);
    rumble(0.2, 0.3, 120);
}
/** On foot: she's out in front of a shared car (it can still stop) → claimed. */
function claimStepTick(fp) {
    if (CLAIM.cool > 0 || !claimRunOk() || ctx.foot.phase !== "walk") return;
    for (const c of ctx.traffic.cars) {
        const D = c.data;
        const mine = !!(D && D.partyLane && D.partyLocal && !D.laneStop);       // a car only I have (Shmuel's target): a plain stop
        if (!D || (typeof D.party !== "string" && !mine) || c.hit || c.speed < 3) continue;
        const dx = fp.x - c.x, dz = fp.z - c.z;
        if (Math.abs(dx) > 60 || Math.abs(dz) > 60) continue;
        const fx = Math.sin(c.h), fz = Math.cos(c.h), lon = dx * fx + dz * fz, lat = dx * fz - dz * fx;
        const need = c.speed * c.speed / 18 + 6, far = D.owTown ? 30 : 46;
        if (Math.abs(lat) >= 1.7 || lon <= need || lon >= far) continue;
        if (mine) { laneStop(c, lon - 6); claimFeedback(c, "step"); return; }
        if (canClaim(c) && claimShared(c, { L: lon - 6, how: "step" })) { CLAIM.cool = 2.5; claimFeedback(c, "step"); }
        return;
    }
}
/** My own lane car (no friend has it) stops for me: brake evenly over L m onto the shoulder; then it's jackable. */
function laneStop(c, L) {
    const v0 = Math.max(1, c.speed), a = v0 * v0 / (2 * Math.max(4, L)), dS = Math.sign(c.d || 1) * T.SHOULDER_D;
    c.data.laneStop = true; c.data.streetsHold = true;
    c.ai = (dt, cc) => { cc.speed = Math.max(0, cc.speed - a * dt); cc.s += cc.speed * cc.dir * dt; cc.d += (dS - cc.d) * Math.min(1, dt * 1.4); cc.dTarget = cc.d; };
}
/** ✋ FLAG IT DOWN: a shared car coming her way, beside its path (on the shoulder / the kerb) → it stops right by her. */
function flagCandidate(fp) {
    if (!claimRunOk() || ctx.foot.phase !== "walk") return null;
    let best = null, bl = 1e9;
    for (const c of ctx.traffic.cars) {
        const D = c.data;
        if (!D || typeof D.party !== "string" || c.hit || c.speed < 3) continue;
        const dx = fp.x - c.x, dz = fp.z - c.z;
        if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
        const fx = Math.sin(c.h), fz = Math.cos(c.h), lon = dx * fx + dz * fz, lat = dx * fz - dz * fx;
        if (Math.abs(lat) < 1.9 || Math.abs(lat) > 7 || lon < c.speed * c.speed / 16 + 4 || lon > (D.owTown ? 45 : 85) || lon >= bl || !canClaim(c)) continue;
        best = { c, lon, lat }; bl = lon;
    }
    return best;
}
// ── 🚗 flag & grab on her OWN run (🌍 lightRoam): each screen has its own traffic, so the ONE car two friends do it with
// is shared by the claim itself — she flags a car on her screen (it pulls over), the spot it stopped at + its kind + paint
// go out once ("lcl"), and a friend nearby gets the same car parked there under the same key: jacking it is partners'
// FLAG & GRAB on both screens. A car nobody takes drives off after LC_LIFE s.
const LC = { n: 0 }, LC_LIFE = 90;
function lightFlagCandidate(fp) {
    if (!lightRoam() || !ctx.enabled("streets") || ctx.foot.phase !== "walk") return null;
    let best = null, bl = 1e9;
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.ai || c.free || c.speed < 3 || (c.data && c.data.party)) continue;
        if (!(ctx.streets && ctx.streets.rides && ctx.streets.rides[c.kind])) continue;
        const dx = fp.x - c.x, dz = fp.z - c.z;
        if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
        const fx = Math.sin(c.h), fz = Math.cos(c.h), lon = dx * fx + dz * fz, lat = dx * fz - dz * fx;
        if (Math.abs(lat) < 1.9 || Math.abs(lat) > 7 || lon < c.speed * c.speed / 16 + 4 || lon > 85 || lon >= bl) continue;
        best = { c, lon, lat, light: true }; bl = lon;
    }
    return best;
}
function paintOf(c) { let hex = ""; c.obj.traverse(o => { if (!hex && o.isMesh && o.material && o.material.name === "Paint") hex = "#" + o.material.color.getHexString(); }); return hex; }
function lightFlag(c, L) {
    const key = `lc:${N.uid}:${++LC.n}`;
    c.data = Object.assign(c.data || {}, { party: key, lightClaim: true });
    const a = Math.max(2.5, c.speed * c.speed / (2 * Math.max(4, L)));
    let sent = false, t = 0;
    c.keep = true;
    c.ai = (dt, car) => {
        t += dt;
        if (t > LC_LIFE) { car.ai = null; car.keep = false; return; }       // (nobody took it: it drives on)
        car.speed = Math.max(0, car.speed - a * dt);
        car.s += car.speed * car.dir * dt;
        if (car.speed === 0 && !sent) {
            sent = true;
            NET.broadcast("lcl", key, car.kind, paintOf(car), Math.round(car.x * 10), Math.round(car.z * 10), Math.round(car.h * 1000));
        }
    };
    emit("party:claim", { key, how: "hail", hail: true });
    return true;
}
// a friend flagged a car down near me: the same car, parked where it stopped on her screen (same key: jackable)
on("party:bc", ({ p, k, a }) => {
    if (k !== "lcl" || !lightRoam() || !p || !Array.isArray(a) || typeof a[0] !== "string" || a[0].length > 40) return;
    const key = a[0], kind = a[1], x = (a[3] | 0) / 10, z = (a[4] | 0) / 10, h = (a[5] | 0) / 1000;
    if (!(ctx.streets && ctx.streets.rides && ctx.streets.rides[kind]) || !isFinite(x) || !isFinite(z)) return;
    if (Math.hypot(x - ctx.car.pos.x, z - ctx.car.pos.z) > 400 || ctx.traffic.cars.some(c => c.data && c.data.party === key)) return;
    const n = ctx.traffic.road.nearest(x, z, ctx.car.s, {});
    let t = 0;
    const c = ctx.traffic.add(kind, n.s, n.d, 1, 0, { keep: true, data: { party: key, lightClaim: true }, ai: (dt, car) => { t += dt; car.speed = 0; if (t > LC_LIFE) ctx.traffic.remove(car); } });
    c.free = true; c.x = x; c.z = z; c.h = h;
    if (typeof a[2] === "string" && /^#[0-9a-f]{6}$/i.test(a[2])) c.obj.traverse(o => { if (o.isMesh && o.material && o.material.name === "Paint") { o.material = o.material.clone(); o.material.color.set(a[2]); } });
    ctx.traffic.place(c, 0);
});
const flagSpot = {
    r: 2.6, short: "FLAG",
    pos() {
        const fp = ctx.foot && ctx.foot.pos;
        CLAIM.flag = fp && (N.want || worldClaims()) ? (flagCandidate(fp) || lightFlagCandidate(fp)) : null;
        if (!CLAIM.flag) return null;
        const c = CLAIM.flag.c, s = Math.sign(CLAIM.flag.lat) || 1;
        return { x: fp.x - Math.cos(c.h) * s * 1.1, z: fp.z + Math.sin(c.h) * s * 1.1 };
    },
    label() { return CLAIM.flag ? "✋ FLAG IT DOWN" : null; },
    act() {
        const f = CLAIM.flag;
        if (!f || !ctx.foot.active) return;
        if (f.light) { if (lightFlag(f.c, Math.max(f.c.speed * f.c.speed / 16 + 2, f.lon))) { CLAIM.cool = 2.5; claimFeedback(f.c, "hail"); if (ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, "TAXI!! …or whatever you are!", 1.6); } return; }
        if (claimShared(f.c, { L: Math.max(f.c.speed * f.c.speed / 16 + 2, f.lon), hail: true, how: "hail" })) { CLAIM.cool = 2.5; claimFeedback(f.c, "hail"); if (ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, "TAXI!! …or whatever you are!", 1.6); }
    },
};
/** 🚕 HOP IN: the car she flagged down has stopped — the passenger side, no crime (the driver's door is a carjack). */
function hopCandidate(fp) {
    let best = null, bd = 3.6;
    for (const [key, cl] of T.PT.claims) {
        if (!cl.mine || !cl.hail || T.PT.dead.has(key)) continue;
        const c = T.PT.ccars.get(key);
        if (!c || c.speed > 0.5 || !ctx.traffic.cars.includes(c)) continue;
        const R0 = ctx.streets && ctx.streets.rides && ctx.streets.rides[c.kind], half = (R0 && R0.half) || 0.95;
        const x = c.x - Math.cos(c.h) * (half + 0.6), z = c.z + Math.sin(c.h) * (half + 0.6);    // her right = the passenger door
        const d = Math.hypot(x - fp.x, z - fp.z);
        if (d < bd) { bd = d; best = { c, x, z }; }
    }
    return best;
}
const hopSpot = {
    r: 3.6, short: "HOP IN",
    pos() { const fp = ctx.foot && ctx.foot.pos; CLAIM.hop = fp && N.want && inPartyRun() ? hopCandidate(fp) : null; return CLAIM.hop ? { x: CLAIM.hop.x, z: CLAIM.hop.z } : null; },
    label() { return CLAIM.hop ? "🚕 HOP IN" : null; },
    act() { if (CLAIM.hop) hopIn(CLAIM.hop.c); },
};
function hopIn(c) {
    const R0 = ctx.streets && ctx.streets.rides && ctx.streets.rides[c.kind];
    if (!R0 || !ctx.foot || !ctx.foot.drive || !claimTraffic(c, true)) return false;
    let colors = null;
    c.obj.traverse(o => { if (!colors && o.isMesh && o.material && o.material.name === "Paint" && R0.model !== "cop") colors = { Paint: "#" + o.material.color.getHexString() }; });
    const v = { vtype: R0.vtype || "car", key: R0.model, colors, x: c.x, z: c.z, h: c.h, how: "hail", handling: R0.handling };
    ctx.traffic.remove(c);
    ctx.foot.drive(v);
    if (ctx.law && ctx.law.changeLook && !ctx.law.chasing) { try { ctx.law.changeLook("car"); } catch (e) { console.error(e); } }
    H.toast("🚕 \"Where to, lady?\" — \"Out. I'm driving.\"", "gold");
    emit("stat", { id: "partyHails", n: 1 });
    return true;
}
/** Rammed a shared car hard (driving): it pulls over — hers to jack once she's out. */
function onSharedCrash(c, e) {
    if (!e || e.impact < 5 || CLAIM.cool > 0 || ctx.state !== "playing" || (ctx.foot && ctx.foot.active)) return false;
    if (!claimShared(c, { how: "ram" })) return false;
    CLAIM.cool = 2.5;
    claimFeedback(c, "ram");
    return true;
}
T.PT.onCrash = onSharedCrash;
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(flagSpot); ctx.foot.addSpot(hopSpot); } });

// ── carjacked party cars: gone for everyone ──────────────────────────────
/** I took shared car c (streets' carjack, or I hopped into the one I flagged down): it leaves the shared traffic
 *  for good; on my screen it's a local car now (removed by whoever took it). */
function claimTraffic(c, now = false) {
    const D = c && c.data;
    if ((!N.want && !worldClaims()) || !D) return false;
    let key = null;
    if (typeof D.partyClaim === "string") {
        key = D.partyClaim;
        const h = claimHandler(key), cl = h === HWY ? T.PT.claims.get(key) : null;
        if (cl && !cl.mine) return false;                 // a friend's claim: not mine to take
        // streets' jack is starting: it stays parked on friends' screens until she's in and away (streets:carjack);
        // a cancelled jack hands it back to the claim (traffic.js syncClaims)
        if (!now) { CLAIM.pending = { key, c }; return true; }
        h.kill(key);
    } else if (typeof D.party === "string") {
        key = D.party;
        const h = claimHandler(key);
        if (h === HWY) T.goneCar(key, true); else h.kill(key);
    } else return false;
    D.party = null; D.partyClaim = null; D.owTown = false; D.local = true; D.wasParty = key; c.onRemove = null;
    if (worldClaims()) { if (ctx.mp && ctx.mp.event) ctx.mp.event("tj", { a: [key] }); return true; }
    XP.jk.push(key); if (XP.jk.length > 6) XP.jk.shift();
    NET.setX("jk", XP.jk.slice());
    NET.broadcast("j", key);
    return true;
}
/** A friend took shared car `key`: it vanishes here too (a poof where it was — none for a car they'd claimed:
 *  they're driving off in it right there). */
function dropShared(key) {
    if (typeof key !== "string" || key.length > 40 || T.PT.dead.has(key)) return;
    const h = claimHandler(key);
    const claimed = !!(h.claimed && h.claimed(key));
    if (h === HWY) T.killClaim(key); else h.kill(key);
    T.PT.gone.add(key); T.PT.dead.add(key);
    const tr = ctx.traffic;
    if (!tr) return;
    for (const c of tr.cars.slice()) if (c.data && (c.data.party === key || c.data.partyClaim === key)) { if (!claimed) sparkle(c.x, c.z); tr.remove(c); }
    T.PT.cars.delete(key);
}
on("party:bc", ({ p, k, a }) => { if (k === "j" && claimWorld() && p.aid === N.A.id) for (const key of a) dropShared(key); });
// the jack of a car I'd claimed went through: now it's gone for everyone
on("streets:carjack", () => {
    const pd = CLAIM.pending;
    CLAIM.pending = null;
    if (pd && (N.want || worldClaims()) && !ctx.traffic.cars.includes(pd.c)) claimTraffic(pd.c, true);
});

// ── on foot in a party: the shared traffic keeps coming, coins stay shared, friends can knock her flat ──
function footTick(dt) {
    const car = ctx.car, A = N.A;
    const own = ACTS[A.k] && ACTS[A.k].ownTraffic && ACTS[A.k].ownTraffic();
    if (!own) { bbReserveAhead(car.s + 950); T.syncTraffic(car.s); }
    scanPickups();
    const fp = ctx.foot.pos;
    if (!fp || ctx.paused) return;
    claimStepTick(fp);
    for (const rc of R.cars.values()) {
        if (!rc.shown) continue;
        const dx = fp.x - rc.x, dz = fp.z - rc.z;
        if (dx * dx + dz * dz > 36) continue;
        if (rc.foot) {                                       // two walkers: each screen steps its own Lulu half out of the way
            const d = Math.hypot(dx, dz), rr = 0.66;
            if (d < rr && d > 1e-4) { fp.x += dx / d * (rr - d) * 0.5; fp.z += dz / d * (rr - d) * 0.5; }
            continue;
        }
        // a friend's car: slow → a shove, fast → she's knocked flat (no hearts lost in a party)
        const fx = Math.sin(rc.h), fz = Math.cos(rc.h);
        for (const co of CAR_CIRCLES) {
            const qx = rc.x + fx * co, qz = rc.z + fz * co, ex = fp.x - qx, ez = fp.z - qz, rr = CAR_RADIUS + 0.32;
            const d2 = ex * ex + ez * ez;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 1e-3;
            fp.x = qx + ex / d * rr; fp.z = qz + ez / d * rr;
            const sp = Math.hypot(rc.vx, rc.vz);
            if (sp > 3.2 && (rc.footCd || 0) <= 0 && ctx.foot.bump) {
                rc.footCd = 1.5;
                ctx.foot.bump({ h: Math.atan2(rc.vx, rc.vz), speed: sp, who: displayName(rc.uid) });
                emit("stat", { id: "partyBonks", n: 1 });
            }
            break;
        }
        if (rc.footCd > 0) rc.footCd -= dt;
    }
}
/** Driving into a friend who's walking: on MY screen the car checks up and she gets the blame line;
 *  on HER screen her own Lulu gets knocked flat (footTick) — each screen moves only its own player. */
function pedBonk(rc, dt) {
    const car = ctx.car, fx = Math.sin(car.h), fz = Math.cos(car.h);
    let hit = false;
    for (const a of CAR_CIRCLES) {
        const dx = rc.x - (car.pos.x + fx * a), dz = rc.z - (car.pos.z + fz * a);
        if (dx * dx + dz * dz < (CAR_RADIUS + 0.4) ** 2) { hit = true; break; }
    }
    if (rc.pedCd > 0) rc.pedCd -= dt;
    if (!hit || rc.pedCd > 0) return;
    rc.pedCd = 1.5;
    const sp = Math.hypot(car.vx, car.vz);
    if (sp > 3.2) { car.vx *= 0.55; car.vz *= 0.55; car.vF *= 0.55; }
    H.toast(sp > 3.2 ? `😱 You bonked ${displayName(rc.uid)}! (they'll live)` : `🙋 Hi ${displayName(rc.uid)}!`, sp > 3.2 ? "gold" : "pink");
    tone(sp > 3.2 ? 180 : 660, 0.1, "triangle", 0.18, sp > 3.2 ? 110 : 880);
    if (sp > 3.2) rumble(0.4, 0.5, 160, true);
}

document.addEventListener("visibilitychange", () => {
    if (!N.want) return;
    if (document.hidden) N.flags |= 16; else N.flags &= ~16;
    NET.flush();          // tell the party we're away before the tab goes quiet
});

// ── the per-frame tick (own rAF: runs in every state, paused or not) ─────
let lastW = 0, autoTried = false;
function frame() {
    requestAnimationFrame(frame);
    if (!ctx.car || ctx.state === "loading") return;
    const t = performance.now();
    const dt = lastW ? Math.min(0.1, (t - lastW) / 1000) : 1 / 60;
    lastW = t;
    try {
        if (!autoTried && ctx.state === "title") { autoTried = true; autoJoin(); }
        NET.tick();
        if (!N.want) {
            // 🌍 no group, online: she can still stop a town's shared loop minivan by stepping out in front of it
            if (worldClaims()) {
                if (CLAIM.cool > 0) CLAIM.cool -= dt;
                if (ctx.state === "footRun" && ctx.foot && ctx.foot.active && ctx.foot.pos && !ctx.paused) claimStepTick(ctx.foot.pos);
            }
            return;
        }
        updateRate();
        publish();
        if (N.isHost) hostTick();
        // hosted straight into an activity (🌍 Hang out): start it the moment we're the connected host
        if (P.autoAct && N.isHost && N.connected && N.A && N.A.k === "lobby" && NET.clockSynced()) { const k = P.autoAct; P.autoAct = null; hostStart(k); }
        followActivity();
        // (joined from the title / after a game: her own run just started at home — now the teleport to the friend)
        if (P.lightPending && openRun() && N.A && N.A.id === P.lightPending.id) lightEnter(P.lightPending);
        // full? (the host's roster has no room for us)
        if (N.connected && N.host && !N.isHost && N.roster.length >= NET.MAX_PLAYERS && !N.roster.includes(N.uid) && performance.now() - N.connectedAt > 4000) {
            leave(); H.toast("😕 That party is full (8 friends max)", "red"); return;
        }
        onRoad = !ctx.view && N.A.k !== "lobby";
        R.updateCars(dt, showCar, decorate, frameOf);
        PS.tick(dt, sameWorld, displayName);
        if (claimWorld()) for (const p of N.players.values()) if (p.aid === N.A.id && p.x) {
            if (Array.isArray(p.x.cl)) applyClaims(p, p.x.cl);
            if (Array.isArray(p.x.jk)) for (const key of p.x.jk) dropShared(key);
        }
        if (CLAIM.cool > 0) CLAIM.cool -= dt;
        if (ctx.state === "footRun" && inPartyRun() && ctx.foot && ctx.foot.active) footTick(dt);
        else if (ctx.state === "footRun" && lightRoam() && ctx.foot && ctx.foot.active && ctx.foot.pos && !ctx.paused) claimStepTick(ctx.foot.pos);   // (her own run: her own traffic, the town's shared minivans)
        hornsNearby();
        farewells();
        dashTick(dt);
        copTick();
        if (ctx.state === "partyLobby") { renderLobby(false); STG.tick(dt); }
        else if (ctx.state === "partyResults") { renderResults(false); STG.tick(dt); }
        if (P.trace) P.trace.push({ T: clock(), s: ctx.car.s });
    } catch (e) { console.error("[party] frame", e); }
}
requestAnimationFrame(frame);

let onRoad = false;
/** Draw this friend on the road? (same activity, actually driving / parked, and we're looking at the road) */
function showCar(p) { const act = ACTS[N.A.k]; return onRoad && p.aid === N.A.id && p.m >= 2 && p.m <= 4 && (ctx.state !== "partyResults" || N.A.k === "trip") && (!act || !act.show || act.show(p)); }
/** Is this friend in my world (same activity + zone, I'm looking at the road) — for their parked car, cops, tags. */
function sameWorld(p) { const act = ACTS[N.A.k]; return onRoad && ctx.G && (ctx.G.mode === "party" || lightRoam()) && p.aid === N.A.id && (p.m === 7 || (p.m >= 2 && p.m <= 4)) && (!act || !act.show || act.show(p)); }
function frameOf(p) { const act = ACTS[N.A.k]; return act && act.frame ? act.frame(p) : null; }
function decorate(rc, p) {
    rc.tag.set(displayName(p.uid), R.skinHex(p.sk), { host: p.uid === N.host, status: R.status(p) || PS.presenceBadge(p) });
    const act = ACTS[N.A.k];
    if (act && act.decorate) act.decorate(rc, p);
}
function hornsNearby() {
    for (const rc of R.cars.values()) {
        if (!rc.honked) continue;
        rc.honked = false;
        const dist = Math.hypot(rc.x - ctx.car.pos.x, rc.z - ctx.car.pos.z);
        if (dist > 80 || ctx.view) continue;
        const p = N.players.get(rc.uid);
        if (ctx.garage && ctx.garage.playHorn) ctx.garage.playHorn((p && p.hn) || "beep", 262);
        else { tone(415, 0.18, "square", 0.08); tone(523, 0.18, "square", 0.08); }
    }
}

/** ?party=CODE in the link → join; a reload mid-party → rejoin as the same player. */
function autoJoin() {
    if (!NET.allowed()) return;
    const q = (QS.get("party") || "").toUpperCase();
    const w = QS.get("with") || "";
    if (/^[A-Za-z0-9_-]{1,24}$/.test(w)) P.with = w;
    if (NET.validCode(q)) { joinParty(q); return; }
    try {
        const s = JSON.parse(sessionStorage.getItem("luluParty") || "null");
        if (s && NET.validCode(s.code) && Date.now() - s.at < 15 * 60000) joinParty(s.code);
    } catch (e) { /* nothing to rejoin */ }
}

on("party:status", () => { if (ctx.state === "partyLobby") renderLobby(false); });
on("party:host", e => {
    if (!N.want) return;
    if (e && e.me && !e.fresh) H.toast("👑 You're the host now!", "gold");
    else if (e && e.host && !e.me && N.everConnected && performance.now() - N.connectedAt > 3000) H.toast(`👑 ${displayName(e.host)} is the host now`, "");
    if (ctx.state === "partyResults") renderResults(true);
});
on("party:player", e => {
    if (!N.want || !e || !e.p || !N.connected) return;
    // (one quiet line for the roster — flavour, rationed by the pop-up budget; the 👯 app always has the list)
    const nm = uid => (uid && displayName(uid)) || "A friend";
    if (e.joined && performance.now() - N.connectedAt > 1500) H.toast(`🎉 ${nm(e.uid || e.p.uid)} joined`, "pink", { prio: 1, key: "party:roster" });
    else if (e.back && e.p.saidBye) { e.p.saidBye = false; H.toast(`📶 ${nm(e.uid || e.p.uid)} is back`, "pink", { prio: 1, key: "party:roster" }); }
});
/** A dropped socket usually comes straight back: only say goodbye after 5 s. */
function farewells() {
    const t = performance.now();
    for (const p of N.players.values()) if (p.left && !p.saidBye && t - p.leftAt > 5000) { p.saidBye = true; H.toast(`👋 ${(NET.NAMES.includes(p.n) && p.n) || "A friend"} left`, "", { prio: 1, key: "party:roster" }); }
}
