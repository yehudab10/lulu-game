// features/friends — one small relay room (protocol v1, the same relay as Shared Road / parties): a doorbell she sits
// in, a friend's doorbell we knock at for a moment, a friend-code room. Nothing else rides on it.
//   const r = openRoom("BXXXXXXXXXXX", { stay, name, onHello(id, peers), onPeer(id, d), onLeave(id), onClose() });
//   r.state(d) — my state in that room (the relay passes it on as-is and shows it to anyone who joins later)
//   r.close()
// A room that should STAY (her own doorbell, a live code) reconnects by itself with a backoff (≤ 20 s); a knock doesn't.
import { MP_URL, allowed } from "../multiplayer/net.js";

export const ROOM_RE = /^[A-Z0-9]{1,12}$/;
const OPEN = new Set();
/** Rooms open right now (tests: { id, stay, connected, peers }). */
export const openRooms = () => [...OPEN].map(r => ({ id: r.id, stay: r.stay, connected: r.connected, peers: r.peers.size }));

export function openRoom(id, opts = {}) {
    const r = {
        id, stay: !!opts.stay, ws: null, connected: false, closed: false, me: null, peers: new Map(), mine: null,
        tries: 0, timer: 0, ping: 0,
        state(d) { r.mine = d; if (r.connected) send(r, { t: "s", d }); },
        close() { r.closed = true; clearTimeout(r.timer); clearInterval(r.ping); OPEN.delete(r); try { if (r.ws) r.ws.close(); } catch (e) { /* gone */ } r.ws = null; r.connected = false; },
    };
    if (!ROOM_RE.test(id) || !allowed()) { r.closed = true; setTimeout(() => opts.onClose && opts.onClose(r), 0); return r; }
    OPEN.add(r);
    const go = () => {
        if (r.closed) return;
        let ws;
        try { ws = new WebSocket(MP_URL + "/room/" + id); } catch (e) { retry(); return; }
        r.ws = ws;
        ws.onopen = () => send(r, { t: "j", v: 1, room: id, name: opts.name || "Friend", sk: "pink" });
        ws.onmessage = ev => {
            let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
            if (!m || typeof m !== "object") return;
            if (m.t === "h") {
                r.connected = true; r.tries = 0; r.me = m.id; r.peers.clear();
                for (const p of Array.isArray(m.peers) ? m.peers.slice(0, 24) : []) if (p && p.id) r.peers.set(p.id, p.d && typeof p.d === "object" ? p.d : null);
                if (r.mine) send(r, { t: "s", d: r.mine });
                clearInterval(r.ping); r.ping = setInterval(() => send(r, { t: "pi" }), 25000);
                opts.onHello && opts.onHello(r);
                for (const [pid, d] of r.peers) if (d) opts.onPeer && opts.onPeer(r, pid, d);
            } else if (m.t === "+" && m.id) { r.peers.set(m.id, null); }
            else if (m.t === "s" && m.id && m.d && typeof m.d === "object") { r.peers.set(m.id, m.d); opts.onPeer && opts.onPeer(r, m.id, m.d); }
            else if (m.t === "-" && m.id) { r.peers.delete(m.id); opts.onLeave && opts.onLeave(r, m.id); }
        };
        ws.onclose = () => {
            clearInterval(r.ping);
            if (r.ws !== ws) return;
            r.ws = null; r.connected = false; r.peers.clear();
            if (!r.closed && r.stay) retry();
            else if (!r.closed) { r.closed = true; OPEN.delete(r); opts.onClose && opts.onClose(r); }
        };
        ws.onerror = () => { /* onclose follows */ };
    };
    const retry = () => { if (r.closed) return; r.tries++; r.timer = setTimeout(go, Math.min(20000, 1000 * 2 ** Math.min(5, r.tries)) * (0.7 + Math.random() * 0.6)); };
    go();
    return r;
}
function send(r, obj) { try { if (r.ws && r.ws.readyState === 1) r.ws.send(JSON.stringify(obj)); } catch (e) { /* offline is fine */ } }
