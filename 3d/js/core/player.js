// core/player.js — ONE player identity for every online feature (👯 friends, 🏘️ the property registry, …).
//
//   ctx.player.id()        a random PUBLIC id: 16 base32 chars (A–Z, 2–7), made on first use — nothing about her.
//                          Friends see it (features/friends uses it as the friend id); a server may store it.
//   ctx.player.secret()    a separate random secret (192 bits, base64url) that NEVER leaves the device except to prove
//                          "I am id X" to a server that keeps only its hash (ci/realestate's registry). Never put it in a
//                          party / Shared Road / friends message.
//   ctx.player.label()     what others see: her USERNAME ("Lulu_K" — features/accounts, unique, kept by the server) once she
//                          has one; before that "Kugel Kid #37" — her curated name (the shared save's mpName) + a number
//                          from the id (12 names are shared by many players). setLabel(l) caches one a server handed out.
//   ctx.player.name()      her username or null; setName(n) caches the one the server confirmed (features/accounts only).
//   ctx.player.backup      the 💾 save code (the scrapbook's): code() → a promise of the code, restore(code) → replaces
//                          this device's progress INCLUDING the id + secret (a new phone = the same player), reloads.
//                          add(section, get, set): a feature's own little backup section, snapshotted into the code and
//                          handed back to set(value) on the first boot after a restore.
// Stored in the 3D save as `save3d.player = { id, secret, made, label?, name?, sx? }` — it rides in the save code with the rest.
import { ctx } from "./ctx.js";
import { save3d, saveSoon, shared } from "./save.js";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const ID_RE = /^[A-Z2-7]{16}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32}$/;
const LABEL_RE = /^[A-Za-z' ]{3,24} #\d{1,4}$/;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;

function randB32(n) { const u = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (let i = 0; i < n; i++) s += B32[u[i] & 31]; return s; }
function randSecret() { const u = crypto.getRandomValues(new Uint8Array(24)); let s = ""; for (const b of u) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_"); }
function P() {
    let p = save3d.player;
    if (!p || typeof p !== "object" || !ID_RE.test(p.id) || !SECRET_RE.test(p.secret)) {
        p = save3d.player = { id: randB32(16), secret: randSecret(), made: Date.now() };
        saveSoon();
    }
    return p;
}
/** A small stable number from an id (the "#37" in "Kugel Kid #37"). */
export function tagOf(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 10 + h % 90; }

const SECTIONS = new Map();
export const player = {
    id: () => P().id,
    secret: () => P().secret,
    label() { const p = P(); if (p.name && NAME_RE.test(p.name)) return p.name; return p.label && LABEL_RE.test(p.label) ? p.label : `${shared.get().mpName || "Cholent Boy"} #${tagOf(p.id)}`; },
    /** Her username (features/accounts: the server's, unique + filtered) or null. */
    name() { const p = P(); return p.name && NAME_RE.test(p.name) ? p.name : null; },
    setName(n) { const p = P(); if (n == null) { if (p.name) { delete p.name; saveSoon(); } return true; } if (!NAME_RE.test(String(n))) return false; if (p.name !== n) { p.name = String(n); saveSoon(); } return true; },
    /** Cache a label a server handed out ("Latke Legend #412"); null clears it. → true if kept */
    setLabel(l) { const p = P(); if (l == null) { delete p.label; saveSoon(); return true; } if (!LABEL_RE.test(String(l))) return false; p.label = String(l); saveSoon(); return true; },
    get made() { return P().made; },
    backup: {
        add(section, get, set) {
            if (!/^[a-z0-9_]{1,16}$/.test(section) || typeof get !== "function" || typeof set !== "function") return false;
            SECTIONS.set(section, { get, set });
            const sx = P().sx;
            if (sx && section in sx) { try { set(sx[section]); } catch (e) { console.warn("[player] restore", section, e); } delete sx[section]; saveSoon(); }
            return true;
        },
        /** (meta's saveToCode calls this) every section's value → save3d.player.sx, so it rides in the code. */
        snapshot() {
            const sx = {};
            for (const [k, s] of SECTIONS) { try { sx[k] = s.get(); } catch (e) { /* skip */ } }
            if (Object.keys(sx).length) P().sx = sx; else delete P().sx;
        },
        code: () => import("../features/meta/screens.js").then(m => m.saveToShortCode()),
        /** → a promise of false (not a save code) or true (restoring: the page reloads). */
        restore: code => import("../features/meta/screens.js").then(async m => { const o = (await m.readCode(code)).obj; if (!o) return false; m.applySave(o); return true; }),
    },
};
P();
// (after a restore, snapshot sections are handed back the first time each feature registers — see add())
if (save3d.player && save3d.player.sx && !Object.keys(save3d.player.sx).length) delete save3d.player.sx;
ctx.player = player;
