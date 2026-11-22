// features/realestate/deal.js — closing a purchase (cash or a mortgage): the registry claim, the books, the event,
// ONE must-see banner. Shared by the realtor (index.js) and the bank's mortgage desk (mortgage.js).
import { emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import * as H from "../../hud.js";
import { registry, S } from "./registry.js";
import { today } from "./market.js";

export function log(ev) { S.log.push(Object.assign({ t: Date.now() }, ev)); if (S.log.length > 30) S.log.shift(); saveSoon(); }

/** She now owns `rec`, having paid `paid` coins today (all of it, or the down payment). → { ok, why } */
export function finalize(rec, paid, via = "cash", extra = null) {
    const r = registry.claim(rec.id, Object.assign({
        town: rec.town, address: rec.address, street: rec.street, number: rec.number, kind: rec.kind, label: rec.label, rooms: rec.rooms,
        model: rec.model, lx: rec.lx, lz: rec.lz, price: rec.price, paid, day: today(), via,
    }, extra || {}));
    if (!r.ok) return r;
    S.spent += paid; S.bought++;
    log({ ev: "bought", id: rec.id, n: paid, via });
    emit("stat", { id: "reBought", n: 1 }); emit("stat", { id: "reSpent", n: paid });
    emit("realestate:owner", { id: rec.id, from: null, to: "lulu", price: paid, why: via === "mortgage" ? "mortgage" : "bought", address: rec.address, town: rec.town });
    H.banner(`🔑 <b>YOUR HOUSE!</b><small>${rec.address} · ${rec.label}${via === "mortgage" ? " · 🏦 mortgage" : ""}</small>`, 3200, { key: "re:bought", prio: 3 });
    return r;
}
