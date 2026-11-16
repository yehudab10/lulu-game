// features/world — 🌍 A WORLD, NOT A MENU. The game is one place Lulu lives in;
// the menus are a light layer on top of it.
//
//   🏡 home.js    Lulu's street behind the title menu: the cul-de-sac at the start of the
//                 road, her house (pink door, porch, garage), the pink car in the driveway,
//                 Lulu chatting with Dina on the porch step, Mr. Pinsky watering across the
//                 street, a minivan lapping the cul-de-sac. The sky follows the device's
//                 clock (via atmos), lit windows at night, holiday dressing on the house
//                 (a sukkah at Sukkot, a menorah in the window + blue/white lights at
//                 Chanukah, Dina's Purim hat, honey / matzah on the porch table). Back to
//                 the title = she drives home and parks.
//   🚗 depart.js  Cruise / Story leg 1 from the title: Lulu hops in, backs out of the
//                 driveway and pulls away; the camera swoops from the title shot into the
//                 chase cam. Skippable (⏭ / hold ○), ✕ jumps straight to the road.
//   📍 places.js  Places you pull into from the road (Cruise): ⛽ Gas 'n' Go, 🌄 the
//                 Lookout, and the family's driveways (Bubbe's, Heshy's pool, the beach,
//                 Avigail's, Uncle Burry's). Stop in the bay → a short in-world beat.
//   path.js       scripted car paths (Catmull-Rom) + a kinematic ride helper.
//
// Continuity: the car is the same object all the way (paint, decor, dents stay); the
// time of day on the title is the device's local time and Cruise carries it on.
//
// Service: ctx.places { add(def), get(id), list(), spots(), at(id), visits(id), inside, visit(key),
//                       home: { ready, phase, park, parked(), depart: info() }, debug }
// Events:  world:depart {mode} · world:home {} · world:visit {id, s} · world:holiday {id}
// States:  worldDepart (skippable pull-out) · worldVisit (skippable pull-in beat)
// Gating:  the home street is always on (static, deterministic); the pull-out, the places
//          and the live clock need ctx.enabled("world") (tests opt in with &enable=world;
//          a party turns them off).
import { ctx, on, hook } from "../../core/ctx.js";
import { registerModels } from "../../models.js";
import * as H from "../../hud.js";
import { home, homeTick, titleCamera, onTitle, streetVisibility, applyHoliday, placeParked, holidayNow, S_HOME } from "./home.js";
import { departInfo } from "./depart.js";
import { placesApi, reservePlaces } from "./places.js";

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
            homeTick(dt);
        };
    }
    reservePlaces(ctx.world);
    // atmos keeps the day + weather running on the title, on the device's clock
    if (ctx.atmos && ctx.enabled("world")) ctx.atmos.titleClock = () => clockOverride != null ? clockOverride : localClock();
});
hook("titleCamera", (dt, camera) => titleCamera(dt, camera), -1000);
hook("update", () => streetVisibility(), -90);
on("state", ({ from, to }) => {
    if (to === "title") onTitle(from);
    streetVisibility();
});
on("run:start", () => streetVisibility());

ctx.places = Object.assign(placesApi, {
    home: {
        get ready() { return home.ready; },
        get phase() { return home.phase; },
        get park() { return home.park; },
        parked() { const c = ctx.car, P = home.park; return !!P && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < 0.6; },
        depart: departInfo,
        holiday: () => { const c = holidayNow(); return c ? c.id : null; },
        get decor() { return Object.fromEntries(Object.entries(home.deco).map(([k, o]) => [k, o.visible])); },
        get extras() { return (home.extras || []).map(o => o.name); },
        S: S_HOME,
    },
    debug: {
        /** Pin the title clock (0..1 or null = the device's time). */
        clock(v) { clockOverride = v == null ? null : v; return clockOverride; },
        localClock,
        parkNow: () => { placeParked(); return true; },
        holiday: () => { home.decoFor = null; return applyHoliday(); },
    },
});
