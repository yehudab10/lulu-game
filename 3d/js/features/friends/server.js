// features/friends — 🪪 THE FRIENDS LIST ON THE SERVER (ci/accounts, stage 2; the owner, 2026-11-26: "make the friends
// thing work even if a player is offline"). The list, friend REQUESTS and blocks live on the relay per account
// (server/accounts.mjs); this file keeps the device's list (store.js — what presence / JOIN / missions use) in step.
//
//  • ➕ Add a friend by USERNAME (or from Nearby when the driver has a name): a request that WAITS on the server for a
//    player who is offline. She sees it next time she opens the game (a quiet badge on 👯), says yes / no later.
//  • A friendship made on the server has no doorbell yet: each side seals its card ({ f, n, sk, b } — the same card the
//    in-person handshake sends) with the secret both can derive from their long-term keys (ECDH P-256: my private key,
//    kept in this store and in the 💾 save code, + their PUBLIC key from the server), and posts it on the friendship;
//    the other side opens it at its next hello. The server only ever holds the sealed note.
//  • MIGRATION (friends made before accounts): every on-device friend is "claimed" at hello; when the other side
//    claims back (they updated too) the server has the friendship. Nothing is lost if one side updates first — the
//    device list keeps working through the doorbells as before; a friend the SERVER once confirmed and then dropped
//    (they removed or blocked me) leaves my list too.
//  • remove / block / unblock and "who can send me requests" go to the server as well as the device.
import { ctx, on, emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { b64, unb64, sharedSecret, seal, open, B64_RE } from "./crypto.js";
import * as ST from "./store.js";
import { myCard } from "./handshake.js";

const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
const V = { busy: false, again: false, lastSig: "", keyP: null };
const acc = () => ctx.accounts || null;
export const serverOn = () => !!(acc() && acc().on && !acc().off);

// ── my long-term key pair (made once; JWK in the store, so the save code carries it) ──
async function myKeys() {
    if (V.keyP) return V.keyP;
    V.keyP = (async () => {
        const S = ST.S;
        if (S.ek && S.ek.jwk && S.ek.pub) {
            try {
                const priv = await subtle.importKey("jwk", S.ek.jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
                return { priv, pub: S.ek.pub };
            } catch (e) { /* remake below */ }
        }
        const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
        const jwk = await subtle.exportKey("jwk", kp.privateKey), pub = b64(await subtle.exportKey("raw", kp.publicKey));
        S.ek = { jwk: { kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y }, pub };
        saveSoon();
        return { priv: await subtle.importKey("jwk", S.ek.jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]), pub };
    })().catch(e => { V.keyP = null; throw e; });
    return V.keyP;
}

// ── what my hello carries: my public key, the friends I still claim, my sealed cards ──
const due = new Map();           // fid → sealed card to post next hello
if (ctx.accounts && ctx.accounts.addHelloExtra) install(); else on("boot", install);
function install() {
    if (!ctx.accounts || !ctx.accounts.addHelloExtra || V.installed) return;
    V.installed = true;
    ctx.accounts.addHelloExtra(async () => {
        if (!subtle) return {};
        const out = { pk: (await myKeys()).pub };
        const claims = ST.S.list.filter(f => !f.sv).map(f => f.f);
        if (claims.length) out.claims = claims.slice(0, 40);
        if (due.size) { out.cards = Object.fromEntries(due); due.clear(); }
        return out;
    });
}

/** The server's view → my device list. */
async function reconcile(view) {
    if (!view || !subtle) return;
    if (V.busy) { V.again = true; return; }
    V.busy = true;
    try {
        const S = ST.S, mine = ST.me();
        let changed = false, needHello = false;
        const onServer = new Set();
        for (const F of view.friends || []) {
            if (!ST.FID_RE.test(F.f) || F.f === mine.fid) continue;
            if ((S.rm || []).includes(F.f)) continue;             // (I removed them; the server hears it below)
            onServer.add(F.f);
            let f = ST.friend(F.f);
            if (!f) {
                if (ST.isBlocked(F.f)) continue;                     // (the block reaches the server below)
                if (S.list.length >= ST.CAP) continue;
                f = { f: F.f, n: "Cholent Boy", sk: "pink", at: F.at || Date.now() };
                S.list.push(f); changed = true;
                emit("friends:made", { f: F.f, n: f.n, result: "server" });
            }
            if (!f.sv) { f.sv = 1; changed = true; }
            if (F.n !== (f.u || null)) { if (F.n) f.u = F.n; else delete f.u; changed = true; }
            if (!f.s && typeof F.pk === "string" && B64_RE.test(F.pk)) {
                const s = await sharedSecret((await myKeys()).priv, F.pk);
                if (s) { f.s = s; changed = true; }
            }
            if (f.s && typeof F.c === "string" && F.c !== f.cin) {
                const card = await open(f.s, F.c), c = ST.cleanCard(card);
                if (c && c.f === f.f) { f.b = c.b; f.n = c.n; f.sk = c.sk; f.cin = F.c; changed = true; }
            }
            // my card for them: not on the server yet, or my doorbell changed since I posted it
            if (f.s && (!F.mine || f.pb !== mine.bell)) {
                due.set(f.f, await seal(f.s, myCard()));
                f.pb = mine.bell; needHello = true; changed = true;
            }
        }
        // a friend the server confirmed once and doesn't list any more: they removed / blocked me
        for (const f of S.list.slice()) if (f.sv && !onServer.has(f.f)) { S.list.splice(S.list.indexOf(f), 1); changed = true; emit("friends:gone", { f: f.f }); }
        // blocks: the server's + mine (a block made before accounts goes up once)
        const sb = new Set((view.blocks || []).map(b => b.f));
        for (const b of view.blocks || []) if (!ST.isBlocked(b.f) && ST.FID_RE.test(b.f)) { S.blocked.push({ f: b.f, n: "", u: b.n || "", at: b.at || Date.now() }); changed = true; }
        for (const b of S.blocked) if (!sb.has(b.f) && !b.up) { b.up = 1; acc().call("/acct/block", { f: b.f }); changed = true; }
        // removals made while the server couldn't be reached go up now
        for (const fid of (S.rm || []).slice()) acc().call("/acct/remove", { f: fid }).then(r => { if (r.st === 200) { S.rm = (S.rm || []).filter(x => x !== fid); saveSoon(); } });
        if (changed) saveSoon();
        const sig = JSON.stringify([(view.inReq || []).map(r => r.f), (view.outReq || []).map(r => r.f), [...onServer]]);
        if (changed || sig !== V.lastSig) { V.lastSig = sig; emit("friends:server", { view }); }
        if (needHello) setTimeout(() => acc() && acc().hello(true), ctx.TEST ? 200 : 1200);
    } finally {
        V.busy = false;
        if (V.again) { V.again = false; reconcile(acc() && acc().view); }
    }
}
on("accounts:view", e => { reconcile(e && e.view).catch(err => console.warn("[friends] sync", err)); });
// a friendship made in person (Nearby / a party / a code) → the server learns it at the next hello (a claim from each side)
on("friends:made", e => { if (e && e.result !== "server" && serverOn()) setTimeout(() => acc().hello(true), ctx.TEST ? 300 : 1500); });
// she deleted her online account: the friends list went with it
on("accounts:deleted", () => { ST.S.list.length = 0; ST.newBell(); saveSoon(); emit("friends:server", {}); });

// ── requests ──
/** → the server's waiting requests: { inReq: [{ f, n, at }], outReq: [...] } */
export function requests() { const v = acc() && acc().view; return { inReq: (v && v.inReq) || [], outReq: (v && v.outReq) || [] }; }
export const badge = () => (serverOn() ? requests().inReq.filter(r => !ST.isBlocked(r.f)).length : 0);
const after = async r => { await acc().hello(true); return r; };
/** ➕ Ask by username (`{ to }`) or a ghost's ticket (`{ t, room, rid }`). → the server's why: sent | friends | none | self | closed | full | outfull | busy | slow | offline */
export async function ask(who) {
    if (!serverOn()) return "offline";
    const r = await acc().call("/acct/ask", who);
    if (r.st === 429) return "slow";
    if (r.st !== 200 || !r.j) return "offline";
    if (r.j.f && ST.S.rm) ST.S.rm = ST.S.rm.filter(x => x !== r.j.f);
    return after(r.j.why || (r.j.ok ? "sent" : "none"));
}
export async function answer(fid, yes) {
    if (!serverOn()) return "offline";
    if (yes && ST.S.rm) ST.S.rm = ST.S.rm.filter(x => x !== fid);
    const r = await acc().call("/acct/answer", { f: fid, yes: !!yes });
    if (r.st !== 200 || !r.j) return "offline";
    return after(r.j.why || "gone");
}
export async function cancel(fid) { if (!serverOn()) return false; await acc().call("/acct/cancel", { f: fid }); await after(0); return true; }
export function removed(fid) {
    const S = ST.S;
    S.rm = (S.rm || []).filter(x => x !== fid).concat(fid).slice(-40); saveSoon();
    if (serverOn()) acc().call("/acct/remove", { f: fid }).then(r => { if (r.st === 200) { S.rm = S.rm.filter(x => x !== fid); saveSoon(); } acc().hello(true); });
}
export function blocked(fid) { const b = ST.S.blocked.find(x => x.f === fid); if (b) b.up = 1; if (serverOn()) acc().call("/acct/block", { f: fid }).then(() => acc().hello(true)); }
export function unblocked(fid) { if (serverOn()) acc().call("/acct/unblock", { f: fid }).then(() => acc().hello(true)); }
export const WHO = ["everyone", "fof", "nobody"];
export const who = () => { const v = acc() && acc().view; return WHO[(v && v.me && v.me.who) || 0]; };
export async function setWho(w) {
    const i = WHO.indexOf(w);
    if (i < 0 || !serverOn()) return false;
    const r = await acc().call("/acct/set", { who: i });
    if (r.st === 200 && acc().view) acc().view.me.who = i;
    emit("friends:server", {});
    return r.st === 200;
}
export { reconcile, myKeys };
