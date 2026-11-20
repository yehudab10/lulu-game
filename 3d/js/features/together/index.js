// ─────────────────────────────────────────────────────────────────────────
//  features/together — 👯 FRIENDS TOGETHER: finding each other in the world, and (stage 2) being in the same
//  building together. Owner, 2026-11-20: "in party mode friends should be able to go to the same house and both
//  be visible to each other. We also need some sort of way for finding friends in the map — need to be clean."
//
//   where.js     where each friend is, from here (drawn · the door they went in · the exit to take)
//   pointers.js  ≤ 3 small edge pointers ("➤ Dina 240 m"), clear of every HUD bit / touch button
//   map.js       the 📱 🗺️ Map in a party: the town / the highway from above, a dot per friend, tap = destination
//
//  The DESTINATION: one soft beam (openworld's beacon look, in the friend's colour) over that friend — or over
//  their door / the exit to take — and their pointer stays on with the distance; it clears when you meet up.
//  Only party members: strangers (the EVERYONE room's ghosts) are never pointed at or on the map.
//  ⚙️ Settings › 🧭 Friend pointers (and the same switch in the map) hides the pointers; the map always works.
//
//  ctx.together = { dest(), setDest(uid), pointersOn(), setPointers(on), locate(uid), locateAll(), debug }
//  Party extras (inside the existing relay `d` packet — no server change): d.x.dr = [x×10, z×10] — the door I
//  went in by (world), while I'm inside a building.
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, emit, addMenuItem } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import * as H from "../../hud.js";
import { tone } from "../interiors/fx.js";
import { beacon, hideBeacon } from "../openworld/marks.js";
import { locate, locateAll, roam, myPos } from "./where.js";
import * as PTR from "./pointers.js";
import * as MAP from "./map.js";

const S = store("together", { pointers: true, dests: 0, met: 0 });
const T = { dest: "", destT: 0, metT: 0, door: null, list: [], listT: 0 };

function setDest(uid) {
    uid = uid ? String(uid) : "";
    if (uid && !(ctx.party && ctx.party.active && ctx.party.members().includes(uid))) return false;
    T.dest = uid; T.destT = 0;
    if (!uid) { hideBeacon("tg"); return true; }
    S.dests++; saveSoon();
    tone(880, 0.08, "triangle", 0.12, 1320);
    emit("together:dest", { uid });
    return true;
}
const pointersOn = () => S.pointers !== false;
function setPointers(v) { S.pointers = !!v; saveSoon(); emit("settings", { id: "friendPointers" }); }

addMenuItem("settings", {
    id: "friendPointers", order: 59,
    label: () => `🧭 Friend pointers <b>${pointersOn() ? "ON" : "OFF"}</b> <small style="opacity:.75">${pointersOn() ? "a small arrow at the edge for each friend in your party" : "the 📱 map still shows them"}</small>`,
    action: () => setPointers(!pointersOn()),
});

// the 📱 🗺️ Map in a party (solo the story map keeps the 🗺️ slot: it hides in a party)
function registerApp() {
    if (!ctx.phone || !ctx.phone.addApp) return false;
    ctx.phone.addApp({
        id: "tgmap", icon: "🗺️", name: "Map", order: 10, color: "#26A69A", color2: "#00695C",
        visible: () => roam(),
        badge: () => (T.dest ? "•" : null),
        render(el, api) { MAP.render(el, api, SVC); T.mapEl = el; },
    });
    return true;
}
if (!registerApp()) on("boot", registerApp);

// d.x.dr: the door I went in by, while I'm inside (friends' pointers + map point at it)
on("state", ({ from, to }) => {
    if (!ctx.party || !ctx.party.active) return;
    if (to === "interior" && from !== "interior") {
        const p = myPos();
        T.door = [Math.round(p.x * 10), Math.round(p.z * 10)];
        ctx.party.setX("dr", T.door);
    } else if (from === "interior" && to !== "interior") { T.door = null; ctx.party.setX("dr", null); }
});
on("party:status", e => { if (e && e.want === false) { setDest(""); PTR.clear(); T.door = null; } });
on("title", () => { setDest(""); PTR.hideAll(); });

// ── per frame (its own rAF: the pointers live over driving AND walking; nothing runs outside a party) ──
let lastW = 0, mapT = 0;
function frame() {
    requestAnimationFrame(frame);
    const w = performance.now(), dt = lastW ? Math.min(0.1, (w - lastW) / 1000) : 1 / 60;
    lastW = w;
    try { tick(dt); } catch (e) { console.error("[together]", e); }
}
function tick(dt) {
    const party = !!(ctx.party && ctx.party.active);
    if (!party || !roam() || !ctx.camera || !ctx.car) { if (T.dest) setDest(""); PTR.hideAll(); return; }
    const st = ctx.state, live = (st === "playing" || st === "footRun") && !ctx.paused && !ctx.view && !H.screenOpen() && !ctx.dialogOpen;
    // where everyone is: 10× a second is plenty (their cars are interpolated, the pointers glide)
    T.listT -= dt;
    if (T.listT <= 0) { T.listT = 0.1; T.list = locateAll(); }
    // the phone's map is open: keep its picture current (2× a second)
    if (ctx.phone && ctx.phone.isOpen && T.mapEl && T.mapEl.isConnected) { mapT -= dt; if (mapT <= 0) { mapT = 0.5; MAP.redraw(T.mapEl, SVC); } }
    // the destination: a beam over them (or their door / the exit), cleared when we meet
    if (T.dest) {
        if (!ctx.party.members().includes(T.dest)) setDest("");
        else {
            const l = T.list.find(q => q.uid === T.dest);
            if (l && !ctx.view) beacon("tg", l.x, l.z, l.hex, 3.2, 30); else hideBeacon("tg");
            if (l && (l.kind === "here" || l.kind === "door") && l.dist < 12 && live) {
                S.met++; saveSoon();
                tone(660, 0.1, "triangle", 0.14, 990);
                emit("together:met", { uid: T.dest });
                setDest("");
            }
        }
    }
    PTR.tick(dt, T.list, T.dest, live && pointersOn());
}
requestAnimationFrame(frame);

const SVC = {
    dest: () => T.dest, setDest, pointersOn, setPointers,
    locate: uid => locate(uid), locateAll: () => locateAll(),
    debug: { T, S, pointers: () => PTR.debug(), avoid: () => PTR.avoidRects(), tick: dt => tick(dt || 1 / 30) },
};
ctx.together = SVC;
