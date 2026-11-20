// ─────────────────────────────────────────────────────────────────────────
//  features/realestate — 🏘️ OWN, BUY AND SELL HOMES (roadmap 16; the owner: "realtors, mortgages yada yada…
//  a maximum of 10 buildings owned per player").
//
//   data.js      every number (prices, the market, the cap, the mortgage / rent / sale rules) + the words
//   registry.js  WHO OWNS WHAT — one small interface (claim / release / ownerOf / listFor / onChange / addSource) so a
//                server-backed registry can replace the local one later (golden rule 3: the owner decides)
//   market.js    every front door of the town as a home: an address, a size, a price; today's value; today's listings
//   signs.js     FOR SALE yard signs + her pink "LULU ♥" mailboxes (4 InstancedMeshes a town, ≤ 4 draw calls)
//   office.js    the realtor's office (one per town on the high street): the realtor, today's listings board
//   house.js     a home from the inside: a VIEWING (the realtor walks her through, oversells) or HER OWN HOUSE
//   rooms.js     the dollhouse rooms both are built from (homes' furniture kit)
//
//  On foot in a town: ✋ at the office door → the office; ✋ at a FOR SALE sign → a viewing (the realtor hurries up the
//  sidewalk: her pitch, the street, the neighbours → 🏠 look inside / 💰 buy / not today); 💰 buy = TWO presses (the
//  ask, then ✍️ sign) and never below 0 coins; ✋ at her own front door → 🔑 straight in (no knocking, no burglary);
//  her mailbox has her name on it. 📞 Phone › 🏘️ the realtor: today's listings + YOUR PLACES (tap = 📍 a pin).
//
//  Service ctx.realestate — see the bottom of this file. Events: realestate:owner {id, from, to, price, why} (a home
//  changed hands — city hall's hook), realestate:view {id}, realestate:enter {id, mode}. Stats: reViewings, reBought,
//  reSpent, reOfficeVisits. Save: store("realestate") (3D-only: the classic 2D game never reads it).
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say, choose } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { CAP, PITCH, PATTER, OFFICE, SIGNING, SOLD, MINE, PASS_SIGN, VIEWING, BASE } from "./data.js";
import { registry, S } from "./registry.js";
import { catalogue, lookup, valueOf, isListed, listings, today, CLOCK, CAT } from "./market.js";
import { layout, counts, clear as clearSigns } from "./signs.js";
import { bindOffice, nameOffice, realtorOf, OFFICE_DEF } from "./office.js";
import { bindHouse, nameHouse, CUR, HOUSE_DEF } from "./house.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString("en-US");
const inTown = () => !!(ctx.town && ctx.town.active);
const townId = () => (inTown() && ctx.town.id) || "lakewood";
const party = () => !!(ctx.party && ctx.party.active) || !!(ctx.G && ctx.G.mode === "party");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
const stat = (id, n = 1) => emit("stat", { id, n });

// ── what's standing in the town she's in ────────────────────────────────
const W = { town: null, day: -1, listed: [], owned: [], t: 0, said: new Set(), busy: false, sign: null, door: null, box: null, rev: 0 };

/** Her houses that stand in this town (matched by id; a house a lot change moved a metre is matched by position). */
function ownedHere() {
    const out = [];
    for (const h of registry.listFor(townId())) {
        let rec = lookup(h.id);
        if (!rec) rec = migrate(h);
        if (rec) out.push(rec);
    }
    return out;
}
/** A lot change shifted her house a little (another feature added a landmark): find it again by position + model. */
function migrate(h) {
    const near = catalogue().filter(r => r.model === h.model && Math.hypot(r.lx - h.lx, r.lz - h.lz) < 3 && !registry.ownerOf(r.id))
        .sort((a, b) => Math.hypot(a.lx - h.lx, a.lz - h.lz) - Math.hypot(b.lx - h.lx, b.lz - h.lz))[0];
    if (!near) return null;
    const old = registry.release(h.id, "moved");
    if (old) registry.claim(near.id, Object.assign({}, old, { lx: near.lx, lz: near.lz, address: near.address, street: near.street, number: near.number, via: "moved" }));
    return near;
}
/** A house of hers that's GONE from the map (a landmark replaced it): the city buys it back at what she paid. */
function compensate() {
    if (!inTown() || !catalogue().length) return;
    for (const h of registry.listFor(townId())) {
        if (lookup(h.id) || migrate(h)) continue;
        const back = Math.max(0, Math.round(h.paid || h.price || 0));
        registry.release(h.id, "demolished");
        if (back) wallet.add(back);
        S.log.push({ t: Date.now(), ev: "compensated", id: h.id, n: back }); if (S.log.length > 30) S.log.shift();
        saveSoon();
        text(`The city needed the lot at ${h.address} for something "important". They bought it back — ${fmt(back)} coins, every one. I'm as shocked as you. 🏛️`, h.town);
    }
}

/** Rebuild the signs / mailboxes (cheap: a few matrices) when the town, the day or an owner changes. */
function refresh(force = false) {
    if (!inTown()) { if (W.town) { clearSigns(); W.town = null; } return; }
    const list = catalogue();
    if (!list.length) return;                // (the town's houses aren't built yet: next tick)
    const d = today();
    if (!force && W.town === townId() && W.day === d && W.rev === CAT.n) return;
    if (W.town !== townId()) compensate();
    W.town = townId(); W.day = d; W.rev = CAT.n;
    W.listed = party() ? [] : listings(d);
    W.owned = ownedHere();
    layout(W.town, W.listed, W.owned);
}
registry.onChange(() => { if (inTown()) refresh(true); });

// ── the ✋ spots (on foot, in a town) ────────────────────────────────────
function canAct() {
    if (!inTown() || !ctx.foot || !ctx.foot.active || ctx.state !== "footRun") return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || ctx.foot.chasing) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return !W.busy;
}
function nearest(list, key, r) {
    const p = herPos();
    if (!p) return null;
    let best = null, bd = r;
    for (const rec of list) { const at = rec[key]; if (!at) continue; const d = Math.hypot(at.x - p.x, at.z - p.z); if (d < bd) { bd = d; best = rec; } }
    return best;
}
// a FOR SALE sign: the viewing
const signSpot = {
    r: 2.4, short: "FOR SALE",
    pos() { W.sign = canAct() ? nearest(W.listed, "sign", 2.4) : null; return W.sign ? W.sign.sign : null; },
    label() { return W.sign ? `🪧 FOR SALE · ${fmt(valueOf(W.sign))} 💰 — VIEW` : null; },
    act() { if (W.sign) viewing(W.sign); },
};
// her own front door: the key
const doorSpot = {
    r: 3.2, short: "MY HOUSE",
    pos() {
        W.door = canAct() && !party() ? nearest(W.owned, "ap", 3.2) : null;
        if (W.door && ctx.interiors.realestateHouse && ctx.interiors.realestateHouse.warm) ctx.interiors.realestateHouse.warm();
        return W.door ? W.door.ap : null;
    },
    label() { return W.door ? "🔑 YOUR HOUSE — GO IN" : null; },
    act() { if (W.door) goIn(W.door, "owner"); },
};
// her mailbox
const boxSpot = {
    r: 1.3, short: "MAIL", first: true,          // (right at the mailbox it wins over her front door, 2 m away)
    pos() { W.box = canAct() ? nearest(W.owned, "mailbox", 1.3) : null; return W.box ? W.box.mailbox : null; },
    label() { return W.box ? "📬 YOUR MAILBOX" : null; },
    act() { if (W.box) mailbox(W.box); },
};
// the realtor's office door
const officeSpot = {
    r: 2.6, short: "REALTOR",
    pos() {
        if (!canAct() || party()) return null;
        const sp = ctx.town.spot && ctx.town.spot("realty"), p = herPos();
        if (!sp || !p) return null;
        if (ctx.interiors.realty && ctx.interiors.realty.warm && Math.hypot(sp.x - p.x, sp.z - p.z) < 24) ctx.interiors.realty.warm();
        return { x: sp.x, z: sp.z };
    },
    label() { return `🏘️ ENTER ${realtorOf(townId()).firm.toUpperCase()}`; },
    act() { enterOffice(); },
};

/** The road position of a point (foot's resume puts her back out on the sidewalk there). */
function roadDoor(at, id) {
    const n = ctx.world.road.nearest(at.x, at.z, ctx.car.s, {});
    const side = Math.sign(n.d) || 1;
    return { id, s: n.s, d: n.d, side };
}
function enterOffice() {
    const sp = ctx.town.spot("realty");
    if (!sp || !ctx.interiors.realty) return false;
    nameOffice(townId());
    const dr = roadDoor(sp, "realty");
    stat("reOfficeVisits");
    emit("realestate:enter", { id: "office", mode: "office" });
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: dr }); };
    return ctx.interiors.realty.enter({ exit, door: "realty", from: "foot" });
}
/** Into a house (a viewing or her own): foot's handoff → the interiors engine; out = back on her front path. */
let INSIDE = null;
function goIn(rec, mode) {
    if (!ctx.foot || !ctx.foot.handoff || !ctx.interiors.realestateHouse) return false;
    nameHouse(rec, mode);
    INSIDE = rec;
    emit("realestate:enter", { id: rec.id, mode });
    if (!ctx.foot.handoff("realestateHouse", roadDoor(rec.ap, "realestateHouse"))) { INSIDE = null; return false; }
    if (mode === "owner") S.met.visits = (S.met.visits || 0) + 1;
    return true;
}
/** Back outside: on her front path, facing the street. */
function backOut() {
    const rec = INSIDE; INSIDE = null;
    const f = ctx.foot && ctx.foot.pos;
    if (!rec || !f) return;
    f.set(rec.ap.x + rec.nx * 0.4, 0.05, rec.ap.z + rec.nz * 0.4);
    if (ctx.foot.obj) { ctx.foot.obj.position.copy(f); ctx.foot.obj.rotation.set(0, Math.atan2(rec.nx, rec.nz), 0); }
    if (ctx.cam && ctx.cam.snap) ctx.cam.snap();
    if (CUR.bought && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(MINE.door), 2.8);
}

// ── the viewing, on the lawn ─────────────────────────────────────────────
/** What the realtor says about this house: her pitch for its size, the street, the neighbours, some patter. */
export function pitch(rec) {
    const out = [pick(PITCH[rec.kind] || PATTER)];
    if (rec.why && rec.why.length) out.push(pick(rec.why));
    if (rec.nbLine) out.push(rec.nbLine);
    out.push(pick(PATTER));
    return out;
}
async function viewing(rec) {
    if (W.busy || !ctx.foot || !ctx.foot.script) return;
    if (party()) { H.toast("🏘️ " + OFFICE.party, "pink"); return; }
    W.busy = true;
    const R = realtorOf(rec.town);
    const sc = { done: false, t: 0, rel: null, from: null, to: null, talk: false };
    const ok = ctx.foot.script({
        update(dt, P, F) {
            sc.t += dt;
            if (F.lulu) { const at = sc.rel ? sc.rel.obj.position : rec.door; F.lulu.face(at.x, at.z, dt, 6); F.lulu.update(dt, { walk: 0, talk: false }); }
            if (sc.rel) {
                const o = sc.rel.obj, k = Math.min(1, sc.t / 1.6);
                o.position.set(sc.from.x + (sc.to.x - sc.from.x) * k, 0.02, sc.from.z + (sc.to.z - sc.from.z) * k);
                if (k < 1) sc.rel.face(sc.to.x, sc.to.z, dt, 10); else if (F.lulu) sc.rel.face(F.lulu.obj.position.x, F.lulu.obj.position.z, dt, 6);
                sc.rel.update(dt, { walk: k < 1 ? 2.6 : 0, talk: ctx.dialogOpen, wave: k >= 1 && sc.t < 2.4 });
            }
            return !sc.done;
        },
        // a framing shot from the sidewalk: Lulu, the realtor and the house (the free camera could sit in a hedge / a tree)
        camera(dt) {
            const cam = ctx.camera;
            if (!sc.cam) {
                const look = new THREE.Vector3();
                cam.getWorldDirection(look).multiplyScalar(6).add(cam.position);
                sc.cam = { pos: cam.position.clone(), look, tgt: new THREE.Vector3(rec.ap.x + rec.nx * 4.6 - rec.ux * 2.2, 2.7, rec.ap.z + rec.nz * 4.6 - rec.uz * 2.2),
                    aim: new THREE.Vector3(rec.ap.x - rec.nx * 1.2 + rec.ux * 0.6, 1.35, rec.ap.z - rec.nz * 1.2 + rec.uz * 0.6) };
            }
            const k = 1 - Math.exp(-dt * 3.5);
            sc.cam.pos.lerp(sc.cam.tgt, k); sc.cam.look.lerp(sc.cam.aim, k);
            cam.position.copy(sc.cam.pos); cam.lookAt(sc.cam.look);
            if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
            return true;
        },
        abort() { sc.done = true; },
    });
    if (!ok) { W.busy = false; return; }
    stat("reViewings");
    emit("realestate:view", { id: rec.id });
    let into = false;
    try {
        const key = R.name === "Mendel Brick" ? "npcMan" : "npcWoman";
        await ensureModels([key]).catch(() => null);
        if (!sc.done) {
            const p = spawnPerson(key, { colors: R.colors });
            p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
            sc.to = { x: rec.ap.x + rec.ux * 1.3 + rec.nx * 0.4, z: rec.ap.z + rec.uz * 1.3 + rec.nz * 0.4 };
            sc.from = { x: sc.to.x + rec.ux * 7, z: sc.to.z + rec.uz * 7 };
            p.obj.position.set(sc.from.x, 0.02, sc.from.z);
            ctx.scene.add(p.obj);
            sc.rel = p; sc.t = 0;
        }
        const v = valueOf(rec);
        await say(R.name, pick(VIEWING.hello), { emoji: R.emoji });
        for (const l of pitch(rec).slice(0, 3)) { if (sc.done) break; await say(R.name, l, { emoji: R.emoji }); }
        while (!sc.done) {
            const i = await choose(R.name, `${rec.address} — ${rec.label}. ${fmt(v)} coins.`, ["🏠 Look inside", `💰 Buy it — ${fmt(v)} 💰`, "🏦 A mortgage?", "✖ Not today"], { emoji: R.emoji });
            if (i === 0) { into = true; break; }
            if (i === 1) { if (await buy(rec, { realtor: R })) break; continue; }
            if (i === 2) { await say(R.name, mortgageLine(rec), { emoji: R.emoji }); continue; }
            await say(R.name, pick(["Think about it! But not too long. My cousin's VERY interested. (He has no money.)", "Sleep on it! On a mattress. In THIS house. Ideally.", "No pressure! (Pressure.)"]), { emoji: R.emoji });
            break;
        }
    } catch (e) { console.error("[realestate] viewing", e); }
    finally {
        if (sc.rel && sc.rel.obj.parent) sc.rel.obj.parent.remove(sc.rel.obj);
        sc.done = true;
        if (!into && ctx.cam && ctx.cam.blend) ctx.cam.blend(0.6);
        W.busy = false;
    }
    if (into) { await nextFrame(); goIn(rec, "viewing"); }
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
function mortgageLine(rec) {
    const bank = ctx.town && ctx.town.spot && ctx.town.spot("bank");
    const v = valueOf(rec);
    return bank ? `A mortgage? The bank on the high street does those. Put down ${fmt(Math.ceil(v * 0.2 / 50) * 50)} and they'll do the rest! (Opening soon — they're still printing the forms.)`
        : "A mortgage? The bank does those. They LOVE paperwork.";
}

// ── buying: two presses (the ask → ✍️ sign), never below 0 ───────────────
/** opts: { rt (inside a room: its say / choose), who (the room's realtor person), realtor } → true if she bought it. */
async function buy(rec, opts = {}) {
    const R = opts.realtor || realtorOf(rec.town);
    const sayF = (t, o = {}) => opts.rt ? opts.rt.say(R.name, t, Object.assign({ emoji: R.emoji, person: opts.who }, o)) : say(R.name, t, Object.assign({ emoji: R.emoji }, o));
    const chooseF = (t, list) => opts.rt ? opts.rt.choose(R.name, t, list, { emoji: R.emoji, person: opts.who }) : choose(R.name, t, list, { emoji: R.emoji });
    if (party()) { await sayF(OFFICE.party); return false; }
    if (registry.mine(rec.id)) { await sayF("It's already yours, sweetheart! I'm good, but I can't sell you the same house twice. (I've tried.)"); return false; }
    if (!isListed(rec)) { await sayF("Ooh — that one's off the market today. Come see what's on the board!"); return false; }
    if (registry.count() >= CAP) { await sayF(OFFICE.capped); return false; }
    const v = valueOf(rec);
    if (wallet.coins < v) { await sayF(`${OFFICE.broke} (You've got ${fmt(wallet.coins)} — this one's ${fmt(v)}.)`); return false; }
    const i = await chooseF(`${pick(SIGNING)} — ${fmt(v)} coins for ${rec.address}?`, [`✍️ Sign — ${fmt(v)} 💰`, "✖ Wait, let me think"]);
    if (i !== 0) return false;
    if (!wallet.spend(v)) { await sayF(OFFICE.broke); return false; }
    const r = registry.claim(rec.id, {
        town: rec.town, address: rec.address, street: rec.street, number: rec.number, kind: rec.kind, label: rec.label, rooms: rec.rooms,
        model: rec.model, lx: rec.lx, lz: rec.lz, price: rec.price, paid: v, day: today(), via: "cash",
    });
    if (!r.ok) { wallet.add(v); await sayF(r.why === "cap" ? OFFICE.capped : "Oy — somebody beat you to it. Signed this morning! Next one's yours, I promise."); return false; }
    S.spent += v; S.bought++;
    S.log.push({ t: Date.now(), ev: "bought", id: rec.id, n: v }); if (S.log.length > 30) S.log.shift();
    saveSoon();
    stat("reBought"); stat("reSpent", v);
    emit("realestate:owner", { id: rec.id, from: null, to: "lulu", price: v, why: "bought", address: rec.address, town: rec.town });
    H.banner(`🔑 <b>YOUR HOUSE!</b><small>${rec.address} · ${rec.label}</small>`, 3200, { key: "re:bought", prio: 3 });
    await sayF(pick(SOLD));
    return true;
}

// ── her mailbox ──────────────────────────────────────────────────────────
async function mailbox(rec) {
    if (W.busy || !ctx.foot || !ctx.foot.script) return;
    W.busy = true;
    const sc = { done: false };
    const ok = ctx.foot.script({ update(dt, P, F) { if (F.lulu) { F.lulu.face(rec.mailbox.x, rec.mailbox.z, dt, 8); F.lulu.update(dt, { walk: 0 }); } return !sc.done; }, abort() { sc.done = true; } });
    try {
        if (!ok) return;
        const bills = (S.bills[rec.id] || []).filter(b => !b.paid);
        const line = bills.length ? `📬 ${bills.length} letter${bills.length === 1 ? "" : "s"}: ${bills.map(b => b.what).join(", ")}.`
            : pick(["📬 Her name on a mailbox. LULU. In LETTERS. She takes a photo. Then three more.", "📬 Empty! Except for a flyer: 'WE BUY HOUSES — CASH!' Lulu: 'I KNOW. I just did.'", "📬 A takeout menu, a coupon for kugel, and a letter for the people who lived here before. Classic."]);
        await say("📬 " + rec.address, line, { emoji: "📬" });
    } finally { sc.done = true; W.busy = false; }
}

// ── walking past: a sign catches her eye (once a visit, sometimes) ────────
function passBy() {
    if (!canAct() || W.passed) return;
    const p = herPos(), r = nearest(W.listed, "sign", 6);
    if (!p || !r) return;
    W.passed = true;
    if (Math.random() < 0.45 && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(PASS_SIGN), 2.8);
}

// ── the 📞 Phone: the realtor's contact (listings + YOUR PLACES; tap = a 📍 pin) ──────
function pinRec(rec) {
    if (!rec || !ctx.openworld || !ctx.openworld.pin) return false;
    const at = rec.sign || rec.ap;
    return ctx.openworld.pin({ x: at.x, z: at.z, name: rec.address, icon: registry.mine(rec.id) ? "🔑" : "🪧" });
}
function contactHtml() {
    const mine = registry.listFor(null), here = inTown() ? townId() : null;
    const R = realtorOf(here || "lakewood");
    let h = `<div class="lp-note">🏘️ <b>${R.name}</b> · ${R.firm}${here ? "" : " (Lakewood) · Brick by Brick (Midwood)"}</div>`;
    h += `<div class="lp-note"><b>🔑 Your places</b> · ${mine.length} / ${CAP}</div>`;
    if (!mine.length) h += `<p class="lp-empty">No houses yet. ${here ? "Look for the FOR SALE signs on the lawns!" : "Drive into Lakewood or Midwood and look for the FOR SALE signs!"}</p>`;
    h += mine.map(m => `<button class="btn lp-row re-mine" data-id="${m.id}"><span class="lp-av">🔑</span><span class="lp-tx"><b>${m.address}</b><small>${m.town === "midwood" ? "Midwood" : "Lakewood"} · ${m.label}${m.town === here ? " · tap = 📍 show me" : ""}</small></span></button>`).join("");
    if (here) {
        const list = party() ? [] : listings();
        h += `<div class="lp-note"><b>🪧 For sale in ${ctx.town.name || here}</b> · new listings every day</div>`;
        h += list.length ? list.slice(0, 8).map(r => `<button class="btn lp-row re-list" data-id="${r.id}"><span class="lp-av">🪧</span><span class="lp-tx"><b>${r.address}</b><small>${r.label} · tap = 📍 show me</small></span><span class="lp-meta">${fmt(valueOf(r))} 💰</span></button>`).join("")
            : `<p class="lp-empty">${party() ? OFFICE.party : "All sold today! Check back tomorrow."}</p>`;
    } else h += `<p class="lp-fine">Listings show up when you're in a town.</p>`;
    return h;
}
function contactRender(el) {
    el.innerHTML = contactHtml();
    el.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => {
        const rec = lookup(b.dataset.id);
        if (!rec) { H.toast("📍 That one's in the other town!", "pink"); return; }
        if (pinRec(rec) && ctx.phone && ctx.phone.closePhone) ctx.phone.closePhone();
    }));
}

// ── wiring ───────────────────────────────────────────────────────────────
const API = { listings: () => (party() ? [] : listings()), valueOf: r => valueOf(r), pitch, buy, pin: pinRec, owns: () => registry.count() > 0, townId, mortgageLine };
bindOffice(API);
bindHouse(API);
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) for (const sp of [officeSpot, signSpot, doorSpot, boxSpot]) ctx.foot.addSpot(sp);
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    // a viewing / her house: when she walks back out, put her on her own front path (foot resumes on the road first)
    const reg = ctx.interiors && ctx.interiors.realestateHouse;
    if (reg && !reg.wrapped) {
        const enter0 = reg.enter.bind(reg);
        reg.wrapped = true;
        reg.enter = (o = {}) => { const exit0 = o.exit; return enter0(Object.assign({}, o, { exit: () => { if (typeof exit0 === "function") exit0(); try { backOut(); } catch (e) { console.error("[realestate] out", e); } } })); };
    }
    if (ctx.community && ctx.community.addContact) {
        const R = REALTOR_CONTACT;
        ctx.community.addContact({ id: "realtor", icon: "🏘️", name: R.name, tag: R.tag, color: "#8D6E63", render: contactRender });
    }
});
const REALTOR_CONTACT = { name: "The realtor", tag: "houses for sale · 🔑 your places" };
on("town:enter", () => { W.said.clear(); W.passed = false; W.town = null; nameOffice(townId()); });
on("town:leave", () => { clearSigns(); W.town = null; W.listed = []; W.owned = []; });
on("title", () => { clearSigns(); W.town = null; });
on("run:start", () => { W.busy = false; });
// (a light check: the town's houses are built a frame or so after town:enter; the day rolls over at midnight)
hook("hud", dt => {
    if ((W.t += dt) < 0.5) return;
    W.t = 0;
    try { refresh(false); passBy(); } catch (e) { console.error("[realestate] tick", e); }
});

// ── the service ──────────────────────────────────────────────────────────
ctx.realestate = {
    /** The registry (claim / release / ownerOf / listFor / onChange / addSource) — see registry.js. */
    registry,
    /** Her homes everywhere: [{ id, town, address, kind, label, paid, day, … }]. */
    owned: () => registry.listFor(null),
    owns: id => registry.mine(id),
    ownerOf: id => registry.ownerOf(id),
    count: () => registry.count(),
    cap: CAP,
    /** Today's listings in the town she's in (catalogue records) · today's value of a home · the real day number. */
    listings: () => listings(),
    valueOf: idOrRec => { const r = typeof idOrRec === "string" ? lookup(idOrRec) : idOrRec; return r ? valueOf(r) : null; },
    today,
    /** Every home of the town she's in (catalogue records) / one by id. */
    homes: () => catalogue(),
    home: id => lookup(id),
    /** A position-based house id for any ctx.town.homes door (features/homes can key households the same way). */
    keyOf(x, z) { const T = ctx.town; if (!T || !T.plan) return null; const L = T.plan.local(x, z, {}); return `${T.def.id}:${Math.round(L.x)}:${Math.round(L.z)}`; },
    /** Is this door spoken for by real estate (hers / for sale)? → "mine" | "listed" | null — features/homes can skip it. */
    claims(id) { const r = lookup(id); return registry.mine(id) ? "mine" : r && W.listed.includes(r) ? "listed" : null; },
    // ── for city hall (ci/cityhall, wave 2): a per-home list of BILLS anything can add a line to. Real estate never
    //    charges them itself; whoever adds a bill decides how it's paid (and must use a two-press confirm). ──
    bills: id => (S.bills[id] || []).slice(),
    addBill(id, bill) { if (!registry.mine(id) || !bill || !bill.what) return false; (S.bills[id] = S.bills[id] || []).push(Object.assign({ at: Date.now(), amount: 0, paid: false }, bill)); if (S.bills[id].length > 20) S.bills[id].shift(); saveSoon(); emit("realestate:bill", { id, bill }); return true; },
    payBill(id, i) { const b = S.bills[id] && S.bills[id][i]; if (!b || b.paid) return false; b.paid = true; saveSoon(); return true; },
    enterOffice, viewing: id => { const r = lookup(id); return r ? viewing(r) : null; }, goIn: (id, mode = "owner") => { const r = lookup(id); return r ? goIn(r, mode) : false; },
    buy: (id, opts) => { const r = lookup(id); return r ? buy(r, opts) : Promise.resolve(false); },
    debug: { W, S, CLOCK, CAT, counts, refresh: () => refresh(true), isListed: id => isListed(lookup(id)), OFFICE_DEF, HOUSE_DEF, CUR, BASE },
};
// tests: a stable handle on the save
