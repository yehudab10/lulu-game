// features/pins — the places that exist today, registered into ctx.pins on boot. Names come from each feature's own data
// (nothing is re-typed here); a place is { id, name, icon, cat, town?, spot?, lap?, sub }. New places don't belong in this
// file: a feature calls ctx.pins.add({...}) itself (see index.js).
//   cat   "shops" · "town" · "help" · "mine"  (the map's filter row)
//   town  "midwood" | "lakewood" + spot = the town build's spot name (ctx.town.spot) — its door / front
//   lap   a lap metre on the highway (rest areas, JFK) — group "highway" / "jfk"
import { MAKOLET, ROOMS, BLACK } from "../shops/data.js";
import { SHOPS as CLOTHES } from "../clothes/data.js";
import { BANK } from "../heist/data.js";
import { NAMES as CIVIC } from "../places/data.js";
import { TOWNS as HALL } from "../cityhall/data.js";
import { TOWNS as SHUL } from "../shul/data.js";
import { REALTORS } from "../realestate/data.js";
import { REST } from "../exits/index.js";
import { NAMES as REST_NAMES } from "../exits/lines.js";

const nm = (o, k = "name") => (o && o[k]) || "";

/** The town places, per town (id = `${town}:${key}`). */
function townPlaces(town) {
    const out = [];
    const add = (key, cat, icon, name, sub, spot = key) => { if (name) out.push({ id: `${town}:${key}`, town, spot, cat, icon, name, sub }); };
    add("dealer", "shops", "🚗", "Uncle Refael's Pre-Loved Cars", "cars · test drives");
    add("bling", "shops", "✨", "Refael's Bling Bay", "horns + car decorations");
    add("makolet", "shops", "🛒", nm(MAKOLET[town]), "pepper spray · the shield · the phone plan");
    add("clothes", "shops", "👗", nm(CLOTHES[town]), "clothes · the fitting room");
    add("pizza", "shops", "🍕", nm(ROOMS.pizza && ROOMS.pizza[town]), "a slice (once a run)");
    if (ROOMS.bakery && ROOMS.bakery[town]) add("bakery", "shops", "🥖", nm(ROOMS.bakery[town]), "a rugelach (once a run)");
    const van = BLACK.spot && BLACK.spot[town];
    if (van) add("van", "shops", "😈", "Shmerel's van", "missiles · no questions", van.spot);
    add("realty", "town", "🏘️", REALTORS[town] ? REALTORS[town].firm : "the realtor's", "homes for sale");
    add("bank", "town", BANK[town] ? BANK[town].emoji : "🏦", nm(BANK[town]), "the bank");
    add("cityhall", "town", "🏛️", nm(HALL[town]), "permits · taxes · complaints");
    if (SHUL[town]) add("shul", "town", "🕍", SHUL[town].name.replace(/^the /, "The "), "the shul", SHUL[town].spot);
    add("precinct", "help", "🚓", nm(CIVIC[town] && CIVIC[town].precinct).replace(/^the /, "The "), "police · the impound lot");
    add("court", "help", "⚖️", nm(CIVIC[town] && CIVIC[town].court), "the courthouse");
    add("hospital", "help", "🏥", nm(CIVIC[town] && CIVIC[town].hospital), "urgent care");
    return out;
}

/** Everything known today (the registry adds her own homes live — index.js). */
export function seed() {
    const out = [{ id: "home:ima", town: "midwood", spot: "luluHome", cat: "mine", icon: "🏡", name: "Ima's house", sub: "home · E 34th St", home: true }];
    for (const t of ["midwood", "lakewood"]) out.push(...townPlaces(t));
    REST.lap.forEach((m, i) => out.push({ id: `hw:rest:${i}`, lap: m, cat: "help", icon: "🅿️", name: (REST_NAMES[i % REST_NAMES.length] || {}).short || "Rest area",
        sub: "rest area · 🅿️ the Parking Challenge booth", group: "highway", arrive: "rest" }));
    out.push({ id: "hw:jfk", lap: "jfk", cat: "town", icon: "✈️", name: "JFK", sub: "EXIT 12 · Terminal 4½", group: "jfk", arrive: "jfk" });
    out.push({ id: "jfk:gelt", lap: "jfk", cat: "shops", icon: "👜", name: "Maison de Gelt", sub: "luxury · inside Terminal 4½", group: "jfk", arrive: "jfk" });
    return out;
}
