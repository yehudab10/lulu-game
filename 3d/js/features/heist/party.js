// features/heist — 🦸‍♀️ FOILING A ROBBERY WITH FRIENDS (a 🎉 party's 🌍 Free Roam town). ci/bankfriends stage 2.
//
// A robbery still happens on ONE screen — the friend whose scheduler drew it (robbery.js: a town's bank / pizza shop /
// bakery / hall; one at a time across the party: nobody starts one while a friend's is on). That screen OWNS it (the
// robber, the getaway car — a local town driver — the cops) and publishes it in its snapshot extras:
//     d.x.rb = [id, phase (1 run · 2 flee · 3 foiled · 4 got away), robber x×10, z×10, car x×10, z×10, car h×1000, prop]
// Every friend in the same town draws it (a robber + a purple getaway car — the car is SOLID on their screen, so a
// friend can really ram it or block it), gets the same one chip + beacon, and can stop it:
//   • RAM it (their screen feels the bump → a "hk" broadcast; the owner counts it only if it sees that friend's car right
//     there on ITS screen), BOX IT IN (the owner sees a friend's car parked against it), or ✋ TACKLE the robber on foot
//     before he reaches the car (the owner checks that friend's walker is beside him).
// THE REWARD is split, never multiplied: the owner works out the solo pay (PAY.foil + the clean / tackle bonuses) and
// asks the party's HOST (`hfo` reliable event) — the host checks the claim (a new robbery id, the helpers are members,
// the pay isn't over the solo maximum, each helper's party foils this session ≤ PAY_CAP) and broadcasts the shares
// (`hfa`, host-only: a non-host's `hfa` is ignored); each screen pays itself its own share once. A crew of 1 gets the
// solo pay; a crew of 3 gets a third each (rounded to 5, ≥ 5). Foiling is helping: no heart, no cop for the crew.
import * as THREE from "three";
import { ctx, on, emit, addActor } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { PAY, PROPS, TUNE } from "./data.js";
import { models, cloneWithColors, need, hold, setChip, setBeacon, fmtM, sfx, confetti, burst, onFoot, luluPos, stat, inParty, partyFree, inTown } from "./common.js";

const MAX_PAY = PAY.foil[1] + PAY.foilClean + PAY.tackle;     // the most one solo foil can pay
export const PAY_CAP = 3;                                         // party foils that pay, per player, per party session (host-counted)
const S = { sendT: 0, sent: "", pup: new Map(), paid: new Set(), host: { seen: new Set(), n: new Map() }, hitT: 0, last: null, claims: [], hkSeq: 0, hkT: 0, hkSeen: new Set() };

const me = () => (ctx.party ? ctx.party.uid : "");
const zone = () => (ctx.town && ctx.town.active ? ctx.town.id || "" : "");
const zoneOf = p => (p && p.x && typeof p.x.z === "string" ? p.x.z : "");
const members = () => (ctx.party && ctx.party.active ? ctx.party.members() : []);
function friendPeers() {
    const out = [];
    for (const u of members()) { if (u === me()) continue; const p = ctx.party.peer(u); if (p && ctx.party.fresh(p, 6000)) out.push(p); }
    return out;
}

// ── the owner's side (robbery.js calls these) ───────────────────────────────────────────
let R = null, friendHit = null;
export function bindRobbery(r, hit) { R = r; friendHit = hit; }

export const PR = {
    /** Is a friend's robbery on (anywhere)? (one at a time across the party) */
    friendRobbery() { return friendPeers().some(p => Array.isArray(p.x && p.x.rb) && (p.x.rb[1] | 0) <= 2); },
    /** A friend's car (driving, in my town) within r m of (x, z) on my screen → their uid, or "". */
    friendCarNear(x, z, r) {
        if (!inParty()) return "";
        for (const p of friendPeers()) {
            if (zoneOf(p) !== zone()) continue;
            const rc = ctx.party.remoteCar(p.uid);
            if (rc && rc.shown && !rc.foot && Math.hypot(rc.x - x, rc.z - z) < r) return p.uid;
        }
        return "";
    },
    /** It's foiled on my screen: the crew = whoever helped + friends close by; the host splits the pay. */
    foiled(ev, how, pay) {
        const crew = new Set(ev.helpers);
        crew.add("me");
        const at = ev.car ? { x: ev.car.x, z: ev.car.z } : luluPos();
        for (const p of friendPeers()) {
            if (zoneOf(p) !== zone()) continue;
            const rc = ctx.party.remoteCar(p.uid);
            if (rc && rc.shown && Math.hypot(rc.x - at.x, rc.z - at.z) < 60) crew.add(p.uid);
        }
        const ids = [...crew].map(u => (u === "me" ? me() : u)).filter((u, i, a) => u && a.indexOf(u) === i).slice(0, 4);
        S.last = { id: ev.id, crew: ids, how, pay };
        ctx.party.sendEvent("hfo", ev.id, how, ids, pay);
        sfx.yay();
        H.banner(`<b>🦸‍♀️ ROBBERY FOILED!</b><small>${ids.length > 1 ? `the crew of ${ids.length} splits the reward` : "the cops take it from here"}</small>`, 2600, { key: "heist:robbery", prio: 3 });
        stat("heistFoils", 1);
        stat("heistPartyFoils", 1);
    },
};

// ── publishing my robbery (the owner) ───────────────────────────────────────────────────
function publish(dt) {
    S.sendT -= dt;
    if (S.sendT > 0) return;
    S.sendT = 0.1;
    const ev = R && R.ev;
    let a = null;
    if (inParty() && ev && ev.where === "town" && ev.ready && ev.phase !== "staged") {
        const ph = ev.phase === "run" ? 1 : ev.phase === "flee" ? 2 : ev.phase === "foiled" ? 3 : 4;
        const ro = ev.robber && ev.robber.obj, c = ev.car;
        const rp = ro ? ro.getWorldPosition(_v) : null;
        a = [ev.id, ph, rp ? Math.round(rp.x * 10) : 0, rp ? Math.round(rp.z * 10) : 0, c ? Math.round(c.x * 10) : 0, c ? Math.round(c.z * 10) : 0,
            c ? Math.round(c.h * 1000) : 0, Math.max(0, PROPS.indexOf(ev.prop))];
    }
    const k = a ? a.join(",") : "";
    if (k !== S.sent) { S.sent = k; ctx.party.setX("rb", a); }
}
const _v = new THREE.Vector3();

// ── a friend's robbery on my screen (puppets, the chip, my ram / tackle) ────────────────
/** My ram / tackle on a friend's robber: a quick broadcast AND ~5 s in my own snapshot (d.x.hk) — a broadcast is a
 *  one-off a slow screen can miss; the snapshot is the latest state, read by the owner whenever it next looks. */
function claimHit(owner, id, how) {
    const seq = (S.hkSeq = (S.hkSeq + 1) % 1000);
    ctx.party.broadcast("hk", owner, id, how);
    ctx.party.setX("hk", [owner, id, how, seq]);
    clearTimeout(S.hkT);
    S.hkT = setTimeout(() => { try { ctx.party.setX("hk", null); } catch (e) { /* left the party */ } }, 5000);
}
class Puppet {
    constructor(uid, a) {
        this.uid = uid; this.id = a[0];
        this.car = models.heistGetaway ? cloneWithColors(models.heistGetaway) : new THREE.Group();
        ctx.scene.add(this.car);
        this.robber = models.heistRobber ? spawnPerson("heistRobber") : null;
        if (this.robber) {
            ctx.scene.add(this.robber.obj);
            hold(this.robber, "MoneyBag", { arm: "Arm_L", y: -0.5, z: 0.05, rx: 0 });
            const pr = PROPS[a[7] | 0] || PROPS[0];
            try { hold(this.robber, pr.id, { arm: "Arm_R", y: -0.47, z: 0.06, rx: -1.4 }); } catch (e) { /* a prop it lacks */ }
        }
        this.cx = a[4] / 10; this.cz = a[5] / 10; this.ch = a[6] / 1000;
        this.rx = a[2] / 10; this.rz = a[3] / 10;
        this.car.position.set(this.cx, 0, this.cz); this.car.rotation.y = this.ch;
        this.a = a; this.hitT = 0;
        // solid on my screen: a friend can really ram it (the owner decides if it counts)
        const self = this;
        this.actor = addActor({
            foot: false,
            update() { return !self.gone; },
            collide(car) {
                const c = self.car.position;
                if ((c.x - car.pos.x) ** 2 + (c.z - car.pos.z) ** 2 > 40) return null;
                const fx = Math.sin(self.ch), fz = Math.cos(self.ch);
                let imp = 0;
                for (const k of [1.3, -1.3]) { const i = car.collideStatic(c.x + fx * k, c.z + fz * k, 0.95); if (i) imp = Math.max(imp, i); }
                if (imp && self.a[1] <= 2 && ctx.time > self.hitT) { self.hitT = ctx.time + 0.6; claimHit(self.uid, self.id, "ram"); sfx.pop(); burst(c.x, 1.0, c.z, 10, 3, [1, 0.85, 0.3], 0.3, 0.6); }
                return imp ? { impact: imp, why: "heist", source: "heist", harmless: true } : null;
            },
            dispose() { self.gone = true; },
        });
        // ✋ TACKLE (on foot, before he's in the car)
        this.spotRm = ctx.foot && ctx.foot.addSpot ? ctx.foot.addSpot({
            pos: () => (self.a[1] === 1 && self.robber ? self.robber.obj.position : null), r: 3.4, first: true,
            label: "🏈 TACKLE HIM!", short: "TACKLE",
            act: () => { claimHit(self.uid, self.id, "tackle"); if (ctx.foot.obj) ctx.foot.say(ctx.foot.obj, "Not on MY sidewalk!", 1.8); sfx.pop(); },
        }) : null;
    }
    update(dt, a) {
        this.a = a;
        const k = Math.min(1, dt * 10);
        this.cx += (a[4] / 10 - this.cx) * k; this.cz += (a[5] / 10 - this.cz) * k;
        let dh = a[6] / 1000 - this.ch; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        this.ch += dh * k;
        this.car.position.set(this.cx, 0, this.cz); this.car.rotation.y = this.ch;
        if (this.robber) {
            const o = this.robber.obj, inCar = a[1] === 2;
            o.visible = !inCar;
            const tx = a[2] / 10, tz = a[3] / 10, dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
            if (d > 6) o.position.set(tx, 0, tz); else { o.position.x += dx * k; o.position.z += dz * k; }
            if (d > 0.05) this.robber.face(tx, tz, dt, 8);
            this.robber.update(dt, a[1] === 3 ? { cheer: true } : { walk: d / Math.max(dt, 0.016) > 0.5 ? 3.8 : 0 });
        }
    }
    dispose() {
        this.gone = true;
        this.car.removeFromParent();
        if (this.robber) this.robber.obj.removeFromParent();
        if (this.spotRm) this.spotRm();
    }
}
function friendsRobberies(dt) {
    const want = new Map();
    if (inParty() && inTown() && !(R && R.ev)) {
        for (const p of friendPeers()) {
            const a = p.x && Array.isArray(p.x.rb) ? p.x.rb : null;
            if (!a || zoneOf(p) !== zone() || ![1, 2, 3].includes(a[1] | 0)) continue;
            if (!a.slice(2, 7).every(Number.isFinite)) continue;
            want.set(p.uid, a);
        }
    }
    for (const [uid, pu] of S.pup) if (!want.has(uid) || want.get(uid)[0] !== pu.id) { pu.dispose(); S.pup.delete(uid); }
    if (!want.size) { if (S.chipOn) { S.chipOn = false; setChip(null); setBeacon(null); } return; }
    if (!models.heistGetaway || !models.heistRobber) { need(["heistGetaway", "heistRobber", "heistProps"]); return; }
    let first = null;
    for (const [uid, a] of want) {
        let pu = S.pup.get(uid);
        if (!pu) { pu = new Puppet(uid, a); S.pup.set(uid, pu); }
        pu.update(dt, a);
        if (!first) first = pu;
    }
    // one chip + one beacon (the same look as her own robbery)
    const a = first.a, who = ctx.party.displayName(first.uid);
    if (a[1] === 1 || a[1] === 2) {
        const tgt = a[1] === 1 && first.robber ? first.robber.obj : { x: first.cx, y: 0, z: first.cz, lift: 2.6 };
        const p = luluPos(), dd = Math.hypot(first.cx - p.x, first.cz - p.z);
        setChip(a[1] === 1 && onFoot() ? "🏈 TACKLE THE ROBBER" : "🦹 STOP THE GETAWAY CAR", `with ${who} · ram it · box it in · ${fmtM(dd)}`, null, "#FF4081");
        setBeacon(tgt, "#FF4081");
        S.chipOn = true;
    } else if (S.chipOn) { S.chipOn = false; setChip(null); setBeacon(null); }
}

// ── the owner hears a friend's claim; checks it against what IT sees ──────────────────────
function claimHolds(ev, c) {
    const rc = ctx.party.remoteCar(c.uid);
    if (!rc || !rc.shown) return false;
    if (c.how === "ram") return !!ev.car && !rc.foot && Math.hypot(rc.x - ev.car.x, rc.z - ev.car.z) < 7.5;
    return ev.phase === "run" && rc.foot && !!ev.robber && Math.hypot(rc.x - ev.robber.obj.position.x, rc.z - ev.robber.obj.position.z) < 4.5;
}
/** A friend's claim from their snapshot (d.x.hk), each one once. */
function addClaim(uid, a) {
    const ev = R && R.ev;
    if (!ev || !Array.isArray(a) || a[0] !== me() || a[1] !== ev.id || (a[2] !== "ram" && a[2] !== "tackle")) return;
    const p = ctx.party.peer(uid);
    if (!p || zoneOf(p) !== zone()) return;
    S.claims = S.claims.filter(c => !(c.uid === uid && c.how === a[2]));
    S.claims.push({ uid, id: ev.id, how: a[2], until: ctx.time + 2 });
}
function checkClaims() {
    const ev = R && R.ev;
    if (ev && (ev.phase === "run" || ev.phase === "flee")) {
        for (const u of ctx.party.members()) {
            if (u === me()) continue;
            const p = ctx.party.peer(u), a = p && p.x && p.x.hk;
            if (!Array.isArray(a)) continue;
            const key = `${u}:${a[1]}:${a[2]}:${a[3]}`;
            if (S.hkSeen.has(key)) continue;
            S.hkSeen.add(key);
            addClaim(u, a);
        }
    }
    if (!S.claims.length) return;
    const keep = [];
    for (const c of S.claims) {
        if (!ev || ev.id !== c.id || ctx.time > c.until || ev.phase === "foiled" || ev.phase === "done") continue;
        if (claimHolds(ev, c)) friendHit(ev, c.uid, c.how);
        else keep.push(c);
    }
    S.claims = keep;
}
on("party:bc", ({ p, k, a }) => {
    if (!inParty() || !p || !Array.isArray(a)) return;
    if (k === "hk") {
        const ev = R && R.ev;
        if (!ev || a[0] !== me() || a[1] !== ev.id || zoneOf(p) !== zone()) return;
        // (their pose reaches me a beat late: keep the claim open ~2 s and check it every frame until it holds)
        addClaim(p.uid, a);
        checkClaims();
        return;
    }
    if (k === "hfa") {
        if (p.uid !== ctx.party.host) return;          // (only the host hands out shares)
        payShare(a);
    }
});
/** The host's answer: [id, owner, how, [[uid, coins], …]] → my share, once. */
function payShare(a) {
    const [id, owner, how, shares] = a;
    const key = owner + ":" + id;
    if (S.paid.has(key) || !Array.isArray(shares)) return;
    const mine = shares.find(s => Array.isArray(s) && s[0] === me());
    S.paid.add(key);
    if (!mine) return;
    const n = Math.max(0, Math.min(MAX_PAY, mine[1] | 0));
    if (!n) { H.toast("🦸‍♀️ Hero work — no more reward money today (the party's limit)", "", { key: "heist:cap" }); return; }
    addCoins(n, "heist:foil");
    sfx.yay();
    const crew = shares.length;
    H.banner(`<b>🦸‍♀️ +${n} 💰 ${crew > 1 ? `your share (a crew of ${crew})` : "for the foil"}</b><small>${how === "tackle" ? "a flying tackle" : how === "box" ? "boxed him in" : how === "ram" ? "rammed to a stop" : "stopped cold"}</small>`, 2600, { key: "heist:robbery", prio: 3 });
    if (owner !== me()) { stat("heistFoils", 1); stat("heistPartyFoils", 1); }
    emit("heist:partyFoil", { id, owner, how, pay: n, crew });
}

// ── the party's host: checks a foil claim, splits the pay, caps it per player ──────────────
if (ctx.party && ctx.party.onHostEvent) ctx.party.onHostEvent((uid, kind, a) => {
    if (kind !== "hfo" || !Array.isArray(a)) return;
    const [id, how, crew, pay] = a;
    const key = uid + ":" + id, mem = members();
    if (S.host.seen.has(key) || !mem.includes(uid) || !Array.isArray(crew) || !crew.length || crew.length > 4) return;
    if (!crew.every(u => typeof u === "string" && mem.includes(u)) || !crew.includes(uid)) return;
    if (!["ram", "pit", "box", "tackle", "spin"].includes(how)) return;
    S.host.seen.add(key);
    const total = Math.max(0, Math.min(MAX_PAY, pay | 0));
    const each = Math.max(5, Math.round(total / crew.length / 5) * 5);
    const shares = crew.map(u => { const n = S.host.n.get(u) || 0; if (n >= PAY_CAP) return [u, 0]; S.host.n.set(u, n + 1); return [u, each]; });
    const msg = [id, uid, how, shares];
    ctx.party.broadcast("hfa", ...msg);
    payShare(msg);                                     // (a broadcast doesn't come back to me)
});
on("party:status", e => { if (e && e.want === false) { for (const pu of S.pup.values()) pu.dispose(); S.pup.clear(); S.host.seen.clear(); S.host.n.clear(); } });

// per frame (with the HUD: driving and walking)
export function partyTick(dt) {
    if (!ctx.party || !ctx.party.active) { if (S.pup.size) { for (const pu of S.pup.values()) pu.dispose(); S.pup.clear(); } return; }
    try { publish(dt); friendsRobberies(dt); checkClaims(); } catch (e) { console.error("[heist party]", e); }
}
export const partyDebug = () => ({ sent: S.sent, puppets: [...S.pup.keys()], paid: [...S.paid], host: { seen: [...S.host.seen], n: Object.fromEntries(S.host.n) }, last: S.last });
