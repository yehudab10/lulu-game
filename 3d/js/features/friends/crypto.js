// features/friends — the little bit of crypto that keeps friends private (the browser's own WebCrypto, no library).
//
//  • Making a friendship: each side shows a fresh ECDH P-256 PUBLIC key in a shared room (anyone may see it — that's
//    the point of a key exchange); both derive the same 32-byte secret, HKDF'd. Nobody else in the room can.
//  • That secret then seals everything the two ever say at a doorbell (AES-GCM, a fresh 12-byte IV each time), so a
//    third knocker at the same moment, or the relay, reads nothing.
//  • Random ids (the friend id, the doorbell's room name, a friend code) come from crypto.getRandomValues.
// A page that isn't a secure context (plain http on a LAN address) has no crypto.subtle: friends are simply off there.
const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null;
export const cryptoOk = () => !!subtle && (typeof isSecureContext === "undefined" || isSecureContext);

const enc = new TextEncoder(), dec = new TextDecoder();
export function b64(bytes) {
    let s = "";
    const u = new Uint8Array(bytes);
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64(str) {
    const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
}
export const B64_RE = /^[A-Za-z0-9_-]{8,200}$/;

/** n random characters from `alphabet` (unbiased). */
export function randStr(n, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") {
    const out = [], max = 256 - (256 % alphabet.length), buf = new Uint8Array(n * 2);
    while (out.length < n) {
        crypto.getRandomValues(buf);
        for (let i = 0; i < buf.length && out.length < n; i++) if (buf[i] < max) out.push(alphabet[buf[i] % alphabet.length]);
    }
    return out.join("");
}

// ── the key exchange ─────────────────────────────────────────────────────
/** A fresh ECDH pair → { priv (CryptoKey), pub (base64url of the raw 65-byte point) }. */
export async function keyPair() {
    const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const raw = await subtle.exportKey("raw", kp.publicKey);
    return { priv: kp.privateKey, pub: b64(raw) };
}
/** My private key + their public key → the shared secret (base64url, 32 bytes). Null on a bad key. */
export async function sharedSecret(priv, theirPub) {
    try {
        const pub = await subtle.importKey("raw", unb64(theirPub), { name: "ECDH", namedCurve: "P-256" }, false, []);
        const bits = await subtle.deriveBits({ name: "ECDH", public: pub }, priv, 256);
        const hk = await subtle.importKey("raw", bits, "HKDF", false, ["deriveBits"]);
        const out = await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: enc.encode("lulu-friends"), info: enc.encode("v1") }, hk, 256);
        return b64(out);
    } catch (e) { return null; }
}

// ── sealing ──────────────────────────────────────────────────────────────
const KEYS = new Map();
function aesKey(secret) {
    let k = KEYS.get(secret);
    if (!k) { k = subtle.importKey("raw", unb64(secret), "AES-GCM", false, ["encrypt", "decrypt"]); KEYS.set(secret, k); if (KEYS.size > 64) KEYS.delete(KEYS.keys().next().value); }
    return k;
}
/** obj → base64url(iv ‖ AES-GCM(JSON)). */
export async function seal(secret, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(JSON.stringify(obj)));
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(ct), 12);
    return b64(out);
}
/** The reverse; null when it isn't for this secret (or was tampered with). */
export async function open(secret, str) {
    try {
        if (typeof str !== "string" || str.length > 1400) return null;
        const u = unb64(str);
        if (u.length < 13) return null;
        const pt = await subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, await aesKey(secret), u.slice(12));
        const o = JSON.parse(dec.decode(pt));
        return o && typeof o === "object" && !Array.isArray(o) ? o : null;
    } catch (e) { return null; }
}
