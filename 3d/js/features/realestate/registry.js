// features/realestate/registry.js — WHO OWNS WHICH HOUSE: one small interface, so a server-backed registry (the whole
// online world sharing one market — needs the owner's OK, golden rule 3) can replace the local one later without
// touching the rest of the feature.
//
//   claim(id, info) → { ok, why }      she buys it (why: "taken" | "cap" | "bad")
//   release(id, why)                   she sells it / the bank forecloses
//   ownerOf(id) → { me, name, info } | null
//   listFor(town) → [{ id, …info }]    HER houses in that town (null town = everywhere)
//   mine(id) → bool · count() → n
//   onChange(fn) → remover             fn({ id, from, to, why }) — any change, hers or someone else's
//   addSource(src) → remover           another owner list (a 🎉 party's friends today; a server later):
//                                      src = { ownerOf(id) → { name, … } | null, list?() → [{ id, name }] }
//
// The local registry is HER save (store("realestate").owned): ids are position-based house keys (market.js houseId).
import { store, saveSoon } from "../../core/save.js";
import { CAP } from "./data.js";

const S = store("realestate", { owned: {}, sold: [], spent: 0, earned: 0, bought: 0, bills: {}, mortgage: {}, rent: {}, days: {}, met: {}, log: [] });
// (a hand-edited / old save: keep it sane)
for (const k of ["owned", "bills", "mortgage", "rent", "days", "met"]) if (!S[k] || typeof S[k] !== "object" || Array.isArray(S[k])) S[k] = {};
for (const k of ["sold", "log"]) if (!Array.isArray(S[k])) S[k] = [];
for (const [id, h] of Object.entries(S.owned)) if (!h || typeof h !== "object" || typeof h.town !== "string") delete S.owned[id];

const listeners = new Set(), sources = new Set();
function fire(ev) { for (const fn of [...listeners]) { try { fn(ev); } catch (e) { console.error("[realestate] registry listener", e); } } }

export const registry = {
    /** She buys it: her name on it, in her save. */
    claim(id, info = {}) {
        if (!id || typeof id !== "string") return { ok: false, why: "bad" };
        if (S.owned[id]) return { ok: false, why: "mine" };
        const other = this.ownerOf(id);
        if (other && !other.me) return { ok: false, why: "taken", by: other.name };
        if (this.count() >= CAP) return { ok: false, why: "cap" };
        S.owned[id] = Object.assign({ since: Date.now() }, info);
        saveSoon();
        fire({ id, from: null, to: "me", why: info.via || "bought" });
        return { ok: true };
    },
    /** It's no longer hers (sold / foreclosed). → the record that was removed | null */
    release(id, why = "sold") {
        const rec = S.owned[id];
        if (!rec) return null;
        delete S.owned[id];
        saveSoon();
        fire({ id, from: "me", to: null, why });
        return rec;
    },
    ownerOf(id) {
        if (S.owned[id]) return { me: true, name: "Lulu", info: S.owned[id] };
        for (const src of sources) { try { const o = src.ownerOf(id); if (o) return Object.assign({ me: false }, o); } catch (e) { /* a source that broke */ } }
        return null;
    },
    mine: id => !!S.owned[id],
    get: id => S.owned[id] || null,
    count: () => Object.keys(S.owned).length,
    listFor(town = null) { return Object.entries(S.owned).filter(([, h]) => !town || h.town === town).map(([id, h]) => Object.assign({ id }, h)); },
    /** Everyone else's houses the sources know about (friends in a party): [{ id, name }]. */
    others() { const out = []; for (const src of sources) { try { if (src.list) out.push(...src.list()); } catch (e) { /* */ } } return out; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    addSource(src) { sources.add(src); return () => sources.delete(src); },
    /** A source tells us something changed (a friend bought / sold). */
    changed(ev) { fire(Object.assign({ remote: true }, ev)); },
};
export { S };
