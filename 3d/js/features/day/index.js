// features/day — 📝 A DAY IN LULU'S LIFE (roadmap step 6).
//
// A reason to play each day, in the world rather than a menu. A Cruise that starts at home
// (world's home start) hands Lulu IMA'S LIST for today — one errand at a real place up the
// road, a way to earn a little gelt, and something silly — in Ima's own words at the door.
// The list lives in a small chip on the HUD (the next thing + how far), a soft light column
// stands over the place she's heading for, and each tick is a toast + a few coins. When it's
// all done: "🏠 Home for dinner!" — the column moves to her own driveway; pulling in (or walking
// up) is the day's ending: Ima on the porch, Dina cheering, a dinner bonus.
//
// THE RULES (coin economy, AGENTS golden rule 5): the list is the SAME all day (seeded by the
// device's local date) and each item pays ONCE a day; the dinner bonus once a day. A new list
// tomorrow. Nothing here repeats within a day, so nothing can be farmed.
//
// Items (data below — add more freely):
//   errand  (kind "place")  a real place you pull into: ⛽ Gas 'n' Go, 🌄 the Lookout, 🏡 Bubbe's
//                           — done on world's `world:visit` {id}
//   job     (kind "job")    any side job passed (hustle's 📞 payphones / 📋 boards) — `hustle:end` result "pass"
//   silly   (kind "stat")   counted from the shared `stat` events: pet an animal, 5 close calls,
//                           chat with strangers on foot, pop into a shop on foot…
// Off in a 🎉 party, in Story / the Shabbos Rush (they have their own goals) and in ?test runs
// unless &enable=day.
//
// Service: ctx.day { active, list(), today, done(id), complete, home, imaLine(G), debug }.
// Events: day:start {list}, day:tick {id, pay}, day:home {pay}. Stats: dayItems, dayDone.
import * as THREE from "three";
import { ctx, on, emit, hook, css, pick } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";

const DAY = store("day", { day: -1, list: [], prog: {}, paid: [], home: false, days: 0, best: 0 });
export const PAY = { item: 15, home: 40 };

const ITEMS = {
    errand: [
        { id: "gas", kind: "place", place: "gas", icon: "⛽", text: "Fill up at Gas 'n' Go", ima: "fill up the tank — it's on EMPTY again" },
        { id: "lookout", kind: "place", place: "lookout", icon: "📸", text: "A photo of the lake for Bubbe (the Lookout)", ima: "send Bubbe a picture of the lake from the Lookout" },
        { id: "bubbe", kind: "place", place: "family_bubbe", icon: "🥖", text: "Drop off Bubbe's challah", ima: "drop the challah at Bubbe's" },
    ],
    job: [
        { id: "job", kind: "job", icon: "💼", text: "Earn some gelt: a side job (📞 payphone / 📋 board)", ima: "do a little job — gelt doesn't grow on trees" },
    ],
    silly: [
        { id: "pet", kind: "stat", stat: "pets", n: 1, icon: "🐾", text: "Pet an animal (Dina wants to hear ALL about it)", ima: "Dina says pet a dog for her. Don't ask me" },
        { id: "close", kind: "stat", stat: "closeCalls", n: 5, icon: "😎", text: "5 close calls (do NOT tell Ima)", ima: "and NO close calls! ...Dina dared you? Oy" },
        { id: "chat", kind: "stat", stat: "footChats", n: 2, icon: "💬", text: "Say hi to 2 people on foot", ima: "be friendly — say hi to people, it's a mitzvah" },
        { id: "inside", kind: "stat", stat: "footInteriors", n: 1, icon: "🚪", text: "Pop into a shop on foot", ima: "go inside somewhere, get some air conditioning" },
    ],
};
const ALL = [...ITEMS.errand, ...ITEMS.job, ...ITEMS.silly];
const byId = id => ALL.find(x => x.id === id);

const S = { active: false, beacon: null, chip: null, chipText: "", homeT: 0, dateOverride: null };

// ── today ────────────────────────────────────────────────────────────────
function today() {
    if (S.dateOverride != null) return S.dateOverride;
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function hash(n, k) { let h = (n * 2654435761 + k * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; }
/** Today's list (the same all day, seeded by the date). */
function listFor(d) {
    return [ITEMS.errand[hash(d, 1) % ITEMS.errand.length].id, ITEMS.job[hash(d, 2) % ITEMS.job.length].id, ITEMS.silly[hash(d, 3) % ITEMS.silly.length].id];
}
function ensureToday() {
    const d = today();
    if (DAY.day === d && DAY.list.length) return;
    DAY.day = d; DAY.list = listFor(d); DAY.prog = {}; DAY.paid = []; DAY.home = false;
    saveSoon();
}
const isDone = id => (DAY.prog[id] || 0) >= ((byId(id) || {}).n || 1);
const complete = () => DAY.list.length > 0 && DAY.list.every(isDone);

/** Ima's line at the door for today's list. */
function imaLine() {
    ensureToday();
    if (DAY.home) return pick(["Back again? Dinner's in the fridge. Drive SAFE!", "You did everything already — go have FUN. Carefully!"]);
    const todo = DAY.list.filter(id => !isDone(id)).map(byId);
    if (!todo.length) return "Everything's done? Then come HOME for dinner! 🍲";
    const parts = todo.map(it => it.ima);
    return `Lulu! Today: ${parts.slice(0, -1).join(", ")}${parts.length > 1 ? " — and " : ""}${parts[parts.length - 1]}. Home for dinner! 💕`;
}

// ── on / off ─────────────────────────────────────────────────────────────
function allowed() {
    const G = ctx.G;
    return ctx.enabled("day") && !(ctx.party && ctx.party.active) && G && G.mode === "cruise";
}
on("world:homeStart", ({ mode }) => {
    if (mode !== "cruise" || !allowed()) { S.active = false; return; }
    ensureToday();
    S.active = !DAY.home;
    if (S.active) emit("day:start", { list: DAY.list.slice() });
});
on("run:start", () => { S.active = false; clearChip(); hideBeacon(); });
on("state", ({ to }) => { if (to === "title") { S.active = false; clearChip(); hideBeacon(); } });

// ── progress ─────────────────────────────────────────────────────────────
function bump(id, n = 1) {
    if (!S.active || !DAY.list.includes(id) || isDone(id)) return;
    DAY.prog[id] = (DAY.prog[id] || 0) + n;
    saveSoon();
    const it = byId(id);
    if (!isDone(id)) { if ((it.n || 1) > 1) H.toast(`${it.icon} ${DAY.prog[id]}/${it.n} — Ima's list`, ""); return; }
    let pay = 0;
    if (!DAY.paid.includes(id)) { DAY.paid.push(id); pay = PAY.item; addCoins(pay, "day"); emit("stat", { id: "dayItems", n: 1 }); }
    if (!ctx.skipping) A.sfxCoin(5);
    H.toast(`✅ ${it.icon} ${it.text.replace(/ \(.*\)$/, "")}${pay ? ` +${pay} 💰` : ""}`, "gold");
    emit("day:tick", { id, pay });
    if (complete()) H.banner(`📝 <b>IMA'S LIST — DONE!</b><small>🏠 home for dinner</small>`, 2600);
    S.chipText = "";
}
on("world:visit", e => { for (const id of DAY.list) { const it = byId(id); if (it && it.kind === "place" && e && e.id === it.place) bump(id); } });
on("hustle:end", e => { if (e && e.result === "pass") for (const id of DAY.list) if ((byId(id) || {}).kind === "job") bump(id); });
on("stat", e => { if (!e) return; for (const id of DAY.list) { const it = byId(id); if (it && it.kind === "stat" && it.stat === e.id) bump(id, e.n || 1); } });

// ── the HUD chip + the light column ──────────────────────────────────────
css("day", `
.day-chip { background: rgba(255,253,245,.94); color: #3b2140; border-radius: 16px; padding: 6px 12px; margin-top: 6px; font-weight: 700; font-size: 14px;
  box-shadow: 0 2px 0 rgba(0,0,0,.12); max-width: 300px; line-height: 1.25; }
.day-chip small { display: block; font-weight: 600; opacity: .72; font-size: 12px; }
.day-chip .ok { color: #2E7D32; }
body.tv .day-chip { font-size: 20px; max-width: 440px; } body.tv .day-chip small { font-size: 16px; }
`);
function clearChip() { if (S.chip) { S.chip.remove(); S.chip = null; S.chipText = ""; } }
const MI = 1609;
function nearestS(placeId) {
    const at = ctx.places && ctx.places.at ? ctx.places.at(placeId) || [] : [];
    const s = ctx.car.s;
    let best = null;
    for (const x of at) if (best == null || Math.abs(x - s) < Math.abs(best - s)) best = x;
    return best;
}
function target() {
    if (!S.active) return null;
    const todo = DAY.list.filter(id => !isDone(id)).map(byId);
    if (!todo.length) {
        const P = ctx.places && ctx.places.home && ctx.places.home.park;
        return P ? { kind: "home", s: P.s, x: P.x, z: P.z, label: "🏠 Home for dinner!" } : null;
    }
    const place = todo.find(it => it.kind === "place");
    if (place) {
        const s = nearestS(place.place);
        const spot = ctx.places && ctx.places.spots ? ctx.places.spots().find(sp => sp.id === place.place && Math.abs(sp.s - (s || 0)) < 5) : null;
        return { kind: "place", s, x: spot ? spot.x : null, z: spot ? spot.z : null, label: `${place.icon} ${place.text}`, it: place };
    }
    return { kind: todo[0].kind, label: `${todo[0].icon} ${todo[0].text}`, it: todo[0] };
}
function chipTick() {
    const def = ctx.states[ctx.state];
    if (!S.active || !def || !def.hud) { clearChip(); return; }
    const t = target();
    const n = DAY.list.filter(isDone).length;
    const far = t && t.s != null ? Math.abs(t.s - ctx.car.s) : null;
    const dist = far != null ? (far > 300 ? ` · ${(far / MI).toFixed(1)} mi${t.s < ctx.car.s ? " back" : ""}` : far > 25 ? ` · ${Math.round(far)} m` : " · here!") : "";
    const txt = `📝 Ima's list <span class="ok">${n}/${DAY.list.length}</span><small>${t ? t.label + dist : ""}</small>`;
    if (!S.chip) { S.chip = document.createElement("div"); S.chip.className = "day-chip"; H.hudSlot("left").appendChild(S.chip); S.chipText = ""; }
    if (txt !== S.chipText) { S.chipText = txt; S.chip.innerHTML = txt; }
}
function beacon() {
    if (S.beacon) return S.beacon;
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 28, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: "#FFD54F", transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.y = 14;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), new THREE.MeshBasicMaterial({ color: "#FF4F9A", transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    g.add(col, ring);
    g.name = "DayBeacon";
    g.visible = false;
    ctx.scene.add(g);
    S.beacon = g;
    return g;
}
function hideBeacon() { if (S.beacon) S.beacon.visible = false; }
function beaconTick(dt) {
    const t = target();
    const b = beacon();
    const on = !!(t && t.x != null && Math.hypot(t.x - ctx.car.pos.x, t.z - ctx.car.pos.z) < 450 && (t.kind !== "home" || ctx.state !== "footRun" || Math.hypot(t.x - ctx.car.pos.x, t.z - ctx.car.pos.z) > 4));
    b.visible = on;
    if (!on) return;
    b.position.set(t.x, 0, t.z);
    const k = 1 + Math.sin(ctx.time * 3) * 0.06;
    b.children[1].scale.set(k, k, k);
}

// ── home for dinner: the day's ending ────────────────────────────────────
function homeTick(dt) {
    if (!S.active || !complete() || DAY.home) return;
    const P = ctx.places && ctx.places.home && ctx.places.home.park;
    if (!P) return;
    const c = ctx.car, d = Math.hypot(c.pos.x - P.x, c.pos.z - P.z);
    const slow = ctx.state === "footRun" || c.speed < 2.2;
    S.homeT = d < 7 && slow && (ctx.state === "playing" || ctx.state === "footRun") ? S.homeT + dt : 0;
    if (S.homeT < 0.5) return;
    DAY.home = true;
    DAY.days++;
    saveSoon();
    let pay = 0;
    if (!DAY.paid.includes("home")) { DAY.paid.push("home"); pay = PAY.home; addCoins(pay, "dayHome"); }
    emit("stat", { id: "dayDone", n: 1 });
    if (!ctx.skipping) A.sfxFanfare && A.sfxFanfare();
    H.banner(`🏠 <b>HOME FOR DINNER!</b><small>Ima's list, done${pay ? ` · +${pay} 💰` : ""} · see you tomorrow 💕</small>`, 3200, { prio: 2 });
    const ima = ctx.places.home.people && ctx.places.home.people.ima;
    if (ima && ctx.banter && ctx.banter.bubble) {
        ima.obj.visible = true;
        ctx.banter.bubble(pick(["My errand girl! Wash your hands, dinner's ready! 🍲", "Everything?! Who ARE you? Sit, eat!", "Bubbe called — she LOVED it. Now EAT."]), ima.obj, { dur: 3.4, y: 1.9, cls: "nice" });
    }
    emit("day:home", { pay });
    S.active = false;
    clearChip(); hideBeacon();
}

hook("hud", dt => {
    if (!S.active) { if (S.chip) clearChip(); if (S.beacon && S.beacon.visible) hideBeacon(); return; }
    chipTick();
    beaconTick(dt);
    homeTick(dt);
});

// ── the service ──────────────────────────────────────────────────────────
ctx.day = {
    get active() { return S.active; },
    get today() { ensureToday(); return DAY.day; },
    list: () => { ensureToday(); return DAY.list.map(id => ({ id, done: isDone(id), prog: DAY.prog[id] || 0, n: (byId(id) || {}).n || 1, text: (byId(id) || {}).text })); },
    done: id => isDone(id),
    get complete() { return complete(); },
    get home() { return DAY.home; },
    imaLine: () => allowed() ? imaLine() : null,
    PAY, ITEMS,
    debug: {
        DAY, S,
        /** Pretend it's another day (yyyymmdd) — or null for the real date. */
        date(v) { S.dateOverride = v == null ? null : v; ensureToday(); return DAY.list.slice(); },
        target: () => { const t = target(); return t && { kind: t.kind, s: t.s, x: t.x, z: t.z, label: t.label }; },
        beacon: () => !!(S.beacon && S.beacon.visible),
        chip: () => S.chip ? S.chip.textContent : "",
        activate() { ensureToday(); S.active = !DAY.home; return S.active; },
    },
};
