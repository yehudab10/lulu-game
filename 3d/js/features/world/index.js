// features/world — 🌍 A WORLD, NOT A MENU. The game is one place Lulu lives in;
// the menus are a light layer on top of it.
//
//   🏡 home.js    Lulu's street behind the title menu: the cul-de-sac at the start of the
//                 road, her house (pink door, porch, garage), the pink car nose-out in the driveway,
//                 Lulu chatting with Dina at the porch steps, Mr. Pinsky watering across the
//                 street, a minivan lapping the cul-de-sac. The sky follows the device's
//                 clock (via atmos), lit windows at night, holiday dressing on the house
//                 (a sukkah at Sukkot, a menorah in the window + blue/white lights at
//                 Chanukah, Dina's Purim hat, honey / matzah on the porch table). Back to
//                 the title = she drives home and parks.
//   🚶 depart.js  A RUN STARTS AT HOME, ON FOOT: Cruise / Story leg 1 / the Shabbos Rush from
//                 the title (or Restart) — the camera pushes in behind Lulu at the porch steps,
//                 Ima in the doorway, the car nose-out in the driveway; walk over, ✋ GET IN
//                 (foot's hop-in) and driving off IS the run. No cutscene, no countdown.
//   📍 places.js  Places you pull into from the road (Cruise): ⛽ Gas 'n' Go, 🌄 the
//                 Lookout, and the family's driveways (Bubbe's, Heshy's pool, the beach,
//                 Avigail's, Uncle Burry's). Stop in the bay → a short in-world beat.
//   map.js        🏡 Family & places — a small card (a 📱 phone app when ctx.phone.addApp exists,
//                 else a row in the 📒 Scrapbook drawer): who lives where, visits, family lore.
//   path.js       scripted car paths (Catmull-Rom) + a kinematic ride helper.
//
// Continuity: the car is the same object all the way (paint, decor, dents stay); the
// time of day on the title is the device's local time and Cruise carries it on.
//
// Service: ctx.places { add(def), get(id), list(), spots(), at(id), visits(id), inside, visit(key),
//                       home: { ready, phase, park, parked(), depart: info() }, debug }
// Events:  world:homeStart {mode, first} · world:depart {mode} (she drove off) · world:home {} · world:visit {id, s} · world:holiday {id}
// States:  worldVisit (skippable pull-in beat) — the run's start is foot's "footRun" (reason "home")
// Gating:  the home street is always on (static, deterministic); the pull-out, the places
//          and the live clock need ctx.enabled("world") (tests opt in with &enable=world;
//          a party turns them off).
import { ctx, on, hook } from "../../core/ctx.js";
import { registerModels } from "../../models.js";
import * as H from "../../hud.js";
import { home, homeTick, titleCamera, onTitle, streetVisibility, applyHoliday, placeParked, holidayNow, S_HOME, tendSite, relocate } from "./home.js";
import { store, saveSoon } from "../../core/save.js";
import { departInfo, comeHome } from "./depart.js";
import { placesApi, reservePlaces } from "./places.js";
import { openFamilyMap } from "./map.js";
import "./lapsigns.js";        // 🌍 ci/onemap: real distances on the highway's boards
import "./uturn.js";           // ↺ ci/twoway: a painted U-turn crossover before each exit, for drivers coming down the lap

registerModels({ world_home: "world_home" }, { preload: true });
registerModels({ world_gas: "world_gas", world_lookout: "world_lookout" });

// ── the device's local time → the atmos day clock (0 morning · .18 noon · .41 golden · .7 night · .9 dawn) ──
const CLOCK = [[7, 0.03], [9.5, 0.09], [12.5, 0.18], [16, 0.31], [18.3, 0.41], [19.3, 0.48], [20, 0.535], [21, 0.6], [28.5, 0.83], [29.6, 0.9], [30.3, 0.95], [31, 1.03]];
export function localClock(date = new Date()) {
    let h = date.getHours() + date.getMinutes() / 60;
    if (h < 7) h += 24;
    for (let i = 0; i < CLOCK.length - 1; i++) {
        const [a, ca] = CLOCK[i], [b, cb] = CLOCK[i + 1];
        if (h >= a && h <= b) return ((ca + (cb - ca) * (h - a) / (b - a)) % 1 + 1) % 1;
    }
    return 0.03;
}
let clockOverride = null;

on("boot", () => {
    // the title is a live street, not an attract-mode loop
    const title = ctx.states.title;
    if (title && !title.__world) {
        const orig = title.update;
        title.__world = true;
        title.update = function (dt, P) {
            if (!home.ready) return orig.call(this, dt, P);
            H.menuInput(P);
            tendSite(dt);
            homeTick(dt);
        };
    }
    reservePlaces(ctx.world);
    // atmos keeps the day + weather running on the title, on the device's clock
    if (ctx.atmos && ctx.enabled("world")) ctx.atmos.titleClock = () => clockOverride != null ? clockOverride : localClock();
});
hook("titleCamera", (dt, camera) => titleCamera(dt, camera), -1000);
hook("update", dt => { tendSite(dt); streetVisibility(); }, -90);
hook("hud", dt => { if (!home.ready) tendSite(dt); });
on("state", ({ from, to }) => {
    if (to === "title") onTitle(from);
    streetVisibility();
});
on("run:start", () => streetVisibility());

// ── ctx.home: where Lulu lives (roadmap 14 — the family house on its Midwood lot) ──
const HM = store("home", { startAt: null });
/** Is (x, z) on a lot: inside its w × d rectangle (+pad), from its centre along ux/uz and nx/nz. */
function onLot(sp, x, z, pad = 1) {
    if (!sp) return false;
    const dx = x - sp.x, dz = z - sp.z, a = dx * sp.ux + dz * sp.uz, b = dx * sp.nx + dz * sp.nz;
    return Math.abs(a) <= (sp.w || 14) / 2 + pad && Math.abs(b) <= (sp.d || 24) / 2 + pad;
}
ctx.home = {
    /** "town" (the family house on its lot) | "highway" (the old cul-de-sac — only while the town engine has no lot). */
    get site() { return home.site; },
    /** The town the family house is in ("midwood"), or null on the highway site. */
    get town() { return home.site === "town" ? home.town : null; },
    /** The family lot (world coords: x, z, nx, nz, ux, uz, door, drive, w, d) or null. */
    get lot() { return home.site === "town" ? home.lotSpot : null; },
    /** The name of her street, from the town's data (the lot's spot: `street`) — the owner wants East 34th St. */
    get street() { return home.site === "town" && home.lotSpot ? (home.lotSpot.street || "") : ""; },
    get ready() { return home.ready; },
    /** The parked car's pose in the driveway {x, z, h}. */
    get park() { return home.park ? { x: home.park.x, z: home.park.z, h: home.park.h } : null; },
    /** Inside the family lot? (features/realestate never lists it.) */
    isFamily: (x, z) => onLot(home.lotSpot, x, z, 1),
    /** Within r m of the family house (world distance — works on the highway site too). */
    near(x, z, r = 90) { const h = home.hp; return !!h && Math.hypot(x - h.x, z - h.z) < r; },
    /** Where a day starts (features/realestate: "🏠 Start my day here"): null = the family house, else
     *  { town, key, door: {x, z}, face, label, car?: {x, z, h} }. Persists in the 3D save. */
    get startAt() { return HM.startAt || null; },
    setStartAt(v) { HM.startAt = v && Number.isFinite(v.door && v.door.x) ? Object.assign({}, v) : null; saveSoon(); return HM.startAt; },
    debug: { relocate: force => relocate(!!force), home },
};

ctx.places = Object.assign(placesApi, {
    openMap: back => openFamilyMap(back),
    home: {
        get ready() { return home.ready; },
        get phase() { return home.phase; },
        get park() { return home.park; },
        get people() { return home.people; },
        /** The end of a day (features/day): park, walk up to the porch, the title. opts { line } (a banner). */
        comeHome: opts => comeHome(opts),
        parked() { const c = ctx.car, P = home.park; return !!P && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < 0.6; },
        depart: departInfo,
        holiday: () => { const c = holidayNow(); return c ? c.id : null; },
        get decor() { return Object.fromEntries(Object.entries(home.deco).map(([k, o]) => [k, o.visible])); },
        get extras() { return (home.extras || []).map(o => o.name); },
        S: S_HOME,
        get site() { return home.site; },
    },
    debug: {
        /** Pin the title clock (0..1 or null = the device's time). */
        clock(v) { clockOverride = v == null ? null : v; return clockOverride; },
        localClock,
        parkNow: () => { placeParked(); return true; },
        holiday: () => { home.decoFor = null; return applyHoliday(); },
    },
});
