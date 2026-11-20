// features/friends — MAKING a friendship (both must say yes), the same way over three channels:
//   "mp"    the EVERYONE room (a stranger's ghost, from 📍 Nearby) — rides in my Shared Road state as d.fr
//   "party" a 🎉 party (a friend in 👯) — rides in my party snapshot extras as x.fr
//   "code"  a friend-code room (👯 › Add by code / a ?friend=CODE link) — rides in that room's state
// A message is one entry of my `fr` list, addressed to one peer of that channel: { to, pk, f, c? } (f = my random
// friend id, in the clear so a BLOCKED player's ask is dropped before anything is sent — it leads nowhere by itself):
//   1. A taps ➕ on B:         A → { to: B, pk: A's fresh ECDH public key }                 ("wants to be friends")
//   2. B says yes (or had also tapped ➕ on A — mutual: no question):
//                              B → { to: A, pk: B's key, c: sealed(B's card) }   the secret = ECDH(B, A's key)
//   3. A derives the same secret, opens B's card, keeps it; A → { to: B, pk, c: sealed(A's card) }; B opens + keeps it.
// Strangers watching the room see two public keys and two sealed blobs — no doorbell, no secret. A card holds only
// { f: random id, n: curated name, sk: car skin, b: doorbell room name }. Entries go stale after 60 s.
import { ctx, emit } from "../../core/ctx.js";
import { keyPair, sharedSecret, seal, open, B64_RE } from "./crypto.js";
import { me, addFriend, isBlocked, friend, full, cleanCard } from "./store.js";
import { myName } from "../multiplayer/net.js";

const LIFE = 60000, DONE_LINGER = 15000, MAX_OUT = 3;
const PEER_RE = /^[A-Za-z0-9_-]{1,24}$/;
/** chans[id] = { myId(), peers() → [{ id, fr }], publish(list), label(peerId) } — registered by index.js */
export const chans = {};
// pairs: key "chan|peer" → { chan, peer, kp, pub, phase: "ask"|"accept"|"sent"|"done", at, secret, theirPk, card, name }
const pairs = new Map();
// incoming asks: key "chan|peer" → { chan, peer, pk, at, declined }
const asks = new Map();
const keyOf = (chan, peer) => chan + "|" + peer;
let busy = false;

export function myCard() {
    const m = me();
    return { f: m.fid, n: myName(), sk: (ctx.car && ctx.car.skinKey) || "pink", b: m.bell };
}

/** ➕ Ask (or answer) peer `peer` on channel `chan`. → "asked" | "accepted" | "full" | "pending" | null */
export async function ask(chan, peer) {
    if (!chans[chan] || !PEER_RE.test(String(peer))) return null;
    if (full()) return "full";
    const k = keyOf(chan, peer);
    const cur = pairs.get(k);
    if (cur && cur.phase !== "done" && Date.now() - cur.at < LIFE) return "pending";
    const kp = await keyPair();
    const p = { chan, peer, kp, pub: kp.pub, phase: "ask", at: Date.now(), secret: null, card: null };
    pairs.set(k, p);
    const inc = asks.get(k);
    if (inc && !inc.declined && Date.now() - inc.at < LIFE) { await answer(p, inc.pk); publish(chan); return "accepted"; }
    publish(chan);
    return "asked";
}
/** ✗ Not now: the ask from that peer is hidden (this session). */
export function decline(chan, peer) { const a = asks.get(keyOf(chan, peer)); if (a) a.declined = true; emit("friends:asks", {}); }
/** Pending asks TO me that I haven't answered: [{ chan, peer, at }]. */
export function incoming(chan) {
    const t = Date.now(), out = [];
    for (const a of asks.values()) if ((!chan || a.chan === chan) && !a.declined && t - a.at < LIFE && !answered(a)) out.push({ chan: a.chan, peer: a.peer, at: a.at });
    return out;
}
const answered = a => { const p = pairs.get(keyOf(a.chan, a.peer)); return !!p && (p.phase === "sent" || p.phase === "done"); };
/** My own outstanding ➕ to that peer: "ask" (waiting for them) | "sent" | "done" | null. */
export function outgoing(chan, peer) { const p = pairs.get(keyOf(chan, peer)); return p && Date.now() - p.at < LIFE + DONE_LINGER ? p.phase : null; }

async function answer(p, theirPk) {
    const secret = await sharedSecret(p.kp.priv, theirPk);
    if (!secret) return;
    p.secret = secret; p.theirPk = theirPk;
    p.card = await seal(secret, myCard());
    p.phase = "sent"; p.at = Date.now();
}

function publish(chan) {
    const c = chans[chan];
    if (!c) return;
    const t = Date.now(), list = [];
    for (const p of pairs.values()) {
        if (p.chan !== chan) continue;
        if (t - p.at > (p.phase === "done" ? DONE_LINGER : LIFE)) { pairs.delete(keyOf(p.chan, p.peer)); continue; }
        const e = { to: p.peer, pk: p.pub, f: me().fid };
        if (p.card) e.c = p.card;
        list.push(e);
    }
    c.publish(list.length ? list.slice(-MAX_OUT) : null);
}

/** Every ~¼ s: read what each peer addressed to me. */
export async function tick() {
    if (busy) return;
    busy = true;
    try {
        for (const chan of Object.keys(chans)) {
            const c = chans[chan], mine = c.myId();
            if (!mine) continue;
            let changed = false;
            for (const peer of c.peers()) {
                const list = Array.isArray(peer.fr) ? peer.fr.slice(0, MAX_OUT) : null;
                if (!list || !PEER_RE.test(String(peer.id))) continue;
                const e = list.find(x => x && x.to === mine && B64_RE.test(x.pk || ""));
                if (!e || (typeof e.f === "string" && isBlocked(e.f))) continue;          // (blocked: as if never sent)
                const k = keyOf(chan, peer.id), p = pairs.get(k);
                if (e.c && p && p.phase !== "done") {
                    // their card: we're friends (step 2 for the asker, step 3 for the answerer)
                    if (!p.secret) await answer(p, e.pk);
                    if (p.theirPk !== e.pk) continue;
                    const card = cleanCard(await open(p.secret, e.c));
                    if (!card) continue;
                    if (isBlocked(card.f)) { pairs.delete(k); changed = true; continue; }
                    const was = friend(card.f);
                    const r = addFriend(card, p.secret);
                    p.phase = "done"; p.at = Date.now(); p.name = card.n;
                    asks.delete(k);
                    changed = true;
                    emit("friends:made", { chan, peer: peer.id, f: card.f, n: card.n, result: r, again: !!was });
                } else if (!e.c && (!p || p.phase === "ask")) {
                    const a = asks.get(k);
                    if (!a || a.pk !== e.pk) {
                        asks.set(k, { chan, peer: peer.id, pk: e.pk, at: Date.now(), declined: !!(a && a.declined) });
                        if (p && p.phase === "ask") { await answer(p, e.pk); changed = true; }      // both tapped ➕: mutual
                        else emit("friends:asks", { chan, peer: peer.id });
                    }
                }
            }
            if (changed) publish(chan);
            else if ([...pairs.values()].some(p => p.chan === chan)) publish(chan);      // (expire stale entries)
        }
    } finally { busy = false; }
}
/** Accept an incoming ask (the ✓). */
export async function accept(chan, peer) {
    const a = asks.get(keyOf(chan, peer));
    if (!a) return null;
    if (full()) return "full";
    const kp = await keyPair();
    const p = { chan, peer, kp, pub: kp.pub, phase: "ask", at: Date.now(), secret: null, card: null };
    pairs.set(keyOf(chan, peer), p);
    await answer(p, a.pk);
    publish(chan);
    return "accepted";
}
/** Forget everything on a channel (left the party / the code room closed). */
export function dropChannel(chan) {
    for (const [k, p] of pairs) if (p.chan === chan) pairs.delete(k);
    for (const [k, a] of asks) if (a.chan === chan) asks.delete(k);
    if (chans[chan]) chans[chan].publish(null);
}
export const debug = () => ({ pairs: [...pairs.values()].map(p => ({ chan: p.chan, peer: p.peer, phase: p.phase })), asks: [...asks.values()].map(a => ({ chan: a.chan, peer: a.peer, declined: a.declined })) });
