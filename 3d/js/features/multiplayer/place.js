// features/multiplayer/place.js — 🌍 ROOMS BY PLACE (ci/oneserver step 3; the plan: 3d/docs/oneserver-plan.md › b).
// ONLY when the relay says so (GET /world/config → place: 1 — it stays 0 until the owner is on Cloudflare's Paid plan).
// Without it, nothing here runs and EVERYONE stays the old lobby…lobby8 rooms.
//
//  • THE ROOM IS THE PLACE: the highway lap in 2 km stretches ("WL0" … "WL7"), each town ("WTMIDWOOD"…). Two players
//    in the same spot are always in the same room. A full room (40, the relay's cap) splits: "WL3" → "WL3X2" → "WL3X3"…
//  • NO BLINK AT A BOUNDARY: within 320 m (the drawing range) of the next stretch the game also LISTENS there (a join with lo: 1 — it hears
//    everything, says nothing, costs nothing: messages out are free). Players heard that way are the same entries
//    (keyed "ROOM:id") as when she then joins that room, so nobody pops in or out as she crosses.
//  • OLD COPIES OF THE GAME still see her: a BRIDGE in the old "lobby" room sends her state every 2 s (marked pl: 1
//    so new copies ignore it there — they see her in the place room) and hears old copies' players.
// net.js owns the main socket; this file decides the room, and runs the listener + the bridge (Sub sockets) whose
// messages go through net.js's handle(msg, src).
// 2 km stretches: every room change is a new connection, and each one counts on Cloudflare's free daily allowance —
// at highway speed 500 m stretches cost ~+70 % on the budget, 2 km ones ~+15 %. Players are drawn only within a few
// hundred metres anyway (nearest few), so a bigger room shows nothing extra.
export const SEG = 2000, EDGE = 320, LAP = 16000;   // (EDGE = net.js VIS_M: anyone close enough to draw is heard)
const SPLITS = ["", "X2", "X3", "X4", "X5", "X6"];   // a full room splits: "WL3" → "WL3X2" → "WL3X3"…

/** The place room for my world spot (`me.w` = [zone, a, b, h]) → "WL7" / "WTMIDWOOD", or null (hidden / unknown). */
export function roomFor(w) {
    if (!Array.isArray(w)) return null;
    const z = w[0];
    if (z === "~") return null;
    if (z === "") return "WL" + segOf(w[1]);
    if (typeof z === "string" && /^[a-z0-9_]{1,24}$/.test(z)) return ("WT" + z.toUpperCase().replace(/[^A-Z0-9]/g, "")).slice(0, 10);
    return null;
}
const segOf = s => Math.floor((((Number(s) || 0) % LAP) + LAP) % LAP / SEG);
/** The neighbouring segment to listen to when she's within EDGE of it (highway only), or null. */
export function edgeFor(w) {
    if (!Array.isArray(w) || w[0] !== "") return null;
    const s = (((Number(w[1]) || 0) % LAP) + LAP) % LAP, seg = Math.floor(s / SEG), into = s - seg * SEG, n = LAP / SEG;
    if (into < EDGE) return "WL" + ((seg - 1 + n) % n);
    if (into > SEG - EDGE) return "WL" + ((seg + 1) % n);
    return null;
}
/** The room's base (without its split): "WL3X3" → "WL3". */
export const baseOf = room => String(room || "").replace(/X\d$/, "");
export const isPlace = room => /^W[A-Z0-9]{1,11}$/.test(String(room || ""));
/** The next split of a full room, or null when every split is full. */
export function nextSplit(room) {
    const base = baseOf(room), cur = String(room).slice(base.length);
    const i = SPLITS.indexOf(cur);
    return i >= 0 && i < SPLITS.length - 1 ? (base + SPLITS[i + 1]).slice(0, 12) : null;
}

/**
 * A secondary socket (the listener or the bridge): joins `room`, hands every message to onMsg(msg, sub), reconnects
 * itself (2 s) while wanted. listen = a listen-only join.
 */
export class Sub {
    constructor(url, room, { listen, name, sk, onMsg, onDown }) {
        this.url = url; this.room = room; this.listen = !!listen; this.name = name; this.sk = sk; this.onMsg = onMsg; this.onDown = onDown;
        this.ws = null; this.connected = false; this.myId = null; this.closed = false; this.full = false; this.retry = 0;
        this.open();
    }
    open() {
        if (this.closed) return;
        try {
            const ws = this.ws = new WebSocket(this.url + "/room/" + encodeURIComponent(this.room));
            ws.onopen = () => { const j = { t: "j", v: 1, room: this.room, name: this.name, sk: this.sk }; if (this.listen) j.lo = 1; try { ws.send(JSON.stringify(j)); } catch (e) { /* closing */ } };
            ws.onmessage = ev => {
                let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
                if (!m || !m.t) return;
                if (m.t === "h") { this.connected = true; this.myId = m.id; }
                try { this.onMsg(m, this); } catch (e) { console.error("[mp place]", e); }
            };
            ws.onclose = ev => {
                if (this.ws !== ws) return;
                this.connected = false; this.ws = null;
                if (ev && ev.code === 4001) this.full = true;
                if (this.onDown) this.onDown(this);
                if (!this.closed && !this.full) this.retry = setTimeout(() => this.open(), 2000);
            };
            ws.onerror = () => { };
        } catch (e) { this.retry = setTimeout(() => this.open(), 2000); }
    }
    send(o) { try { if (this.ws && this.ws.readyState === 1 && this.connected) this.ws.send(JSON.stringify(o)); } catch (e) { /* offline */ } }
    close() { this.closed = true; clearTimeout(this.retry); const ws = this.ws; this.ws = null; this.connected = false; if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* gone */ } } if (this.onDown) this.onDown(this); }
}
