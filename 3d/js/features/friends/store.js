// features/friends — what's kept on the device (save3d.f.friends, so it rides in the scrapbook's 💾 save code with
// everything else: restore the code on a new phone and the friends are back, and they find her again).
//   me       { fid, bell }   — her random friend id (never shown) + her doorbell's secret room name
//   list     [{ f, n, sk, b, s, at, nb }]  — a friend: their id, curated name, car skin, THEIR doorbell, our shared
//            secret (from the key exchange), when, and nb = "I still owe them my new doorbell" (after a block)
//   blocked  [{ f, n, at }]   — never again (they can't knock: the doorbell they knew is gone)
//   join     "always" | "ask" | "nobody"   — who can hop in next to her
//   hidden   true = appear offline (no doorbell at all)
import { store, saveSoon } from "../../core/save.js";
import { randStr, B64_RE } from "./crypto.js";
import { CURATED_NAMES } from "../multiplayer/net.js";

export const CAP = 30, BLOCK_CAP = 50;
export const FID_RE = /^[A-Z2-9]{10}$/, BELL_RE = /^[A-Z0-9]{11}$/;
export const JOIN = ["always", "ask", "nobody"];
export const S = store("friends", { me: null, list: [], blocked: [], join: "ask", hidden: false });

/** Her identity, made once (a random id; nothing about her). */
export function me() {
    if (!S.me || !FID_RE.test(S.me.fid) || !BELL_RE.test(S.me.bell)) {
        S.me = { fid: randStr(10), bell: randStr(11, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") };
        saveSoon();
    }
    return S.me;
}
export const bellRoom = bell => "B" + bell;
/** A new doorbell (after a remove / block): every friend left is owed the new name the next time we meet. */
export function newBell() {
    me().bell = randStr(11, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    for (const f of S.list) f.nb = 1;
    saveSoon();
}

export const validName = n => CURATED_NAMES.includes(n);
const SKIN_RE = /^[a-z0-9_]{1,24}$/;
/** A friend record from the wire (the sealed card they sent): checked field by field, nothing free-form kept. */
export function cleanCard(c) {
    if (!c || typeof c !== "object") return null;
    if (!FID_RE.test(c.f) || !BELL_RE.test(c.b) || !validName(c.n)) return null;
    return { f: c.f, n: c.n, sk: SKIN_RE.test(c.sk) ? c.sk : "pink", b: c.b };
}

export const friend = fid => S.list.find(x => x.f === fid) || null;
export const isBlocked = fid => S.blocked.some(x => x.f === fid);
export const full = () => S.list.length >= CAP;

/** Add (or refresh) a friend. → "added" | "updated" | "full" | "blocked" | "me" | null */
export function addFriend(card, secret) {
    const c = cleanCard(card);
    if (!c || !B64_RE.test(secret || "")) return null;
    if (c.f === me().fid) return "me";
    if (isBlocked(c.f)) return "blocked";
    const old = friend(c.f);
    if (old) { Object.assign(old, c, { s: secret }); saveSoon(); return "updated"; }
    if (full()) return "full";
    S.list.push(Object.assign(c, { s: secret, at: Date.now() }));
    saveSoon();
    return "added";
}
/** Remove a friend (and change her doorbell: the one they knew stops answering). */
export function removeFriend(fid) {
    const i = S.list.findIndex(x => x.f === fid);
    if (i < 0) return false;
    S.list.splice(i, 1);
    newBell();
    return true;
}
/** Block: removed, and a request from them is never shown again. */
export function block(fid, name) {
    const f = friend(fid);
    if (f) removeFriend(fid);
    if (FID_RE.test(fid) && !isBlocked(fid)) { S.blocked.push({ f: fid, n: validName(name) ? name : (f && f.n) || "", at: Date.now() }); if (S.blocked.length > BLOCK_CAP) S.blocked.shift(); }
    saveSoon();
}
export function unblock(fid) { const i = S.blocked.findIndex(x => x.f === fid); if (i >= 0) { S.blocked.splice(i, 1); saveSoon(); } }
export function setJoin(v) { if (JOIN.includes(v)) { S.join = v; saveSoon(); } }
export function setHidden(v) { S.hidden = !!v; saveSoon(); }

/** "Kugel Kid #37" — 12 curated names are shared by many players, so the list adds a stable little number. */
export function tagOf(fid) { let h = 0; for (const ch of String(fid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 10 + h % 90; }
export const labelOf = f => `${f.n} #${tagOf(f.f)}`;
