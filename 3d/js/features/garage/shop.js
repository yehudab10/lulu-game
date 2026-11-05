// 🛒 THE SHOP — a tabbed, controller-first shop over a real 3D showroom.
//
//   Cars   all 8 skins (2D prices, handling stats bars, showroom copy);
//          owned / selected skins are SHARED with the 2D game
//   Items  Missile, Mega 5-Pack, Pepper Spray, Bubble Shield, Distracted Mode
//   Bling  the six horns (hear them) + the seven car decorations (try them on)
//
// The showroom (garage_showroom.glb) is a set: the car spins on a gold-rimmed
// turntable under softbox lights and updates LIVE as you browse; items and
// horns pop up on a pedestal. Focus = preview; ✕ on something you don't own
// arms it, ✕ again buys it (the 2D bling "tap to preview, tap again to buy").
// D-pad/stick move · ✕ buy/equip · ○ back · L1/R1 tabs · right stick spins the
// turntable (drag on touch). Works with keyboard (arrows/Enter/Esc/Q/R) and taps.
import * as THREE from "three";
import { ctx, emit, registerState, setState, css, wrapAngle } from "../../core/ctx.js";
import { wallet, shared } from "../../core/save.js";
import { makeSet } from "../../core/sets.js";
import { SKINS, Particles } from "../../car.js";
import { models, ensureModels, findNodes } from "../../models.js";
import { input, glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { SKIN_SHOP, SKIN_KEYS, STAT_ROWS, statFill, skinClass, ITEMS, HORNS, DECOR, decorDef, inv, syncInv, writeShared } from "./data.js";
import * as S from "./sound.js";
import { makeDecor, animateDecor, attachToModel, cloneNode, disposeDecor } from "./decor.js";
import { bubbleMaterial, setDistracted, distracted } from "./items.js";

const TABS = [["cars", "🚗 Cars"], ["items", "🚀 Items"], ["bling", "✨ Bling"]];
const CAM_YAW = 0.62;   // the camera looks at the turntable from the front-right
// framing per preview: R = radius to fit, elev = camera pitch, turn = which side faces the camera
const VIEWS = {
    car:   { t: [0, 0.78, 0], R: 2.75, elev: 0.24, turn: null },
    front: { t: [0, 0.80, 0], R: 1.9, elev: 0.16, turn: 0 },
    rear:  { t: [0, 1.00, 0], R: 2.2, elev: 0.30, turn: Math.PI },
    side:  { t: [0, 0.80, 0], R: 2.45, elev: 0.14, turn: -Math.PI / 2 },
    cabin: { t: [0, 1.12, 0.40], R: 0.95, elev: 0.32, turn: 0.55 },
    head:  { t: [0.38, 1.78, -0.38], R: 1.0, elev: 0.18, turn: -0.75 },
    prop:  { t: [0, 1.42, 0], R: 1.5, elev: 0.2, turn: null },
};
const fmt = n => Math.round(n).toLocaleString();

const shop = {
    open: false, tab: "cars", focusKey: null, focusT: 0, armed: null, set: null, env: null,
    view: "car", show: null, spin: 0, spinV: 0, hold: null, manual: 0, loaded: false,
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), camSnap: true, layoutT: 0,
    region: { cx: 0.5, cy: 0.5, fw: 1, fh: 1 }, coinT: 0, waves: [], popT: 1,
};

// ── state ────────────────────────────────────────────────────────────────
registerState("shop", {
    hud: false, touch: false, pausable: false, world: false,
    enter(data) { openShop((data && data.tab) || "cars"); },
    exit() { closeShop(); },
    update(dt, P) { updateShop(dt, P); },
});
export function leaveShop() { S.sfxClick(); setState("title"); }

function openShop(tab) {
    syncInv();
    shop.open = true;
    shop.tab = TABS.some(t => t[0] === tab) ? tab : "cars";
    shop.armed = null;
    shop.focusKey = null;
    shop.camSnap = true;
    document.body.classList.add("gx-open");
    renderCard(true);
    ensureModels(["garageShowroom", "garageItems", "garageProps", "garageDecor"]).then(() => {
        if (!shop.open) return;
        buildSet();
        previewFor(focusedEl(), true);
    }).catch(e => { console.error("[garage] showroom", e); setMsg("Couldn't load the showroom 😕", "red"); });
}

function closeShop() {
    shop.open = false;
    document.body.classList.remove("gx-open");
    H.hideScreen();
    disposeSet();
    // the real car keeps what you actually own / equipped
    if (ctx.car && ctx.car.skinKey !== inv.selectedSkin) ctx.car.setSkin(inv.selectedSkin);
}

// ══════════════════════════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════════════════════════
const priceTag = p => `💰 ${fmt(p)}`;
function skinState(k) {
    if (inv.selectedSkin === k) return "eq";
    if (inv.ownedSkins.includes(k)) return "own";
    return wallet.coins >= SKIN_SHOP[k].price ? "lock" : "lock poor";
}
function blingOwned(kind, id) { return kind === "horn" ? inv.ownedHorns.includes(id) : inv.ownedDecor.includes(id); }
function blingOn(kind, id) { return kind === "horn" ? inv.horn === id : inv.decor === id; }
const itemDef = id => ITEMS.find(i => i.id === id);
const hornById = id => HORNS.find(h => h.id === id);

function cardInner(kind, id) {
    const armed = shop.armed === kind + ":" + id;
    if (kind === "skin") {
        const sk = SKINS[id], st = skinState(id);
        const tag = st === "eq" ? "✓ EQUIPPED" : st === "own" ? "OWNED" : armed ? "BUY?" : priceTag(SKIN_SHOP[id].price);
        return `<i class="gx-sw" style="background:radial-gradient(circle at 35% 30%, ${sk.light}, ${sk.body} 58%, ${sk.dark})"></i>
            <b>${sk.name}</b><span class="gx-strip">${STAT_ROWS.map(([, k]) => `<i style="--f:${(statFill(sk[k]) * 100).toFixed(0)}%"></i>`).join("")}</span>
            <small>${tag}</small>${st === "eq" ? '<span class="gx-tick">✓</span>' : ""}`;
    }
    if (kind === "item") {
        const it = itemDef(id);
        let tag, cnt = "";
        if (id === "distracted") tag = inv.distractedUnlocked ? (distracted() ? "ON" : "OFF") : armed ? "BUY?" : priceTag(it.price);
        else { tag = priceTag(it.price); cnt = `<em class="gx-cnt">×${inv[it.count]}</em>`; }
        return `<span class="gx-ico">${it.icon}</span><b>${it.title}</b><small>${tag}</small>${cnt}${it.badge ? `<span class="gx-badge">${it.badge}</span>` : ""}`;
    }
    const def = kind === "horn" ? hornById(id) : decorDef(id);
    const owned = blingOwned(kind, id), on = blingOn(kind, id);
    const tag = on ? "✓ ON" : owned ? "OWNED" : armed ? "BUY?" : def.price ? priceTag(def.price) : "FREE";
    return `<span class="gx-ico">${def.icon}</span><b>${def.short || def.name}</b><small>${tag}</small>`;
}
function cardCls(kind, id) {
    let c = "gx-it nav";
    if (kind === "skin") { const st = skinState(id); c += st === "eq" ? " eq" : st === "own" ? " own" : " " + st; }
    else if (kind === "item") {
        const it = itemDef(id);
        if (id === "distracted" && inv.distractedUnlocked) c += distracted() ? " eq" : " own";
        else if (wallet.coins < it.price) c += " poor";
    } else {
        const def = kind === "horn" ? hornById(id) : decorDef(id);
        c += blingOn(kind, id) ? " eq" : blingOwned(kind, id) ? " own" : wallet.coins < def.price ? " lock poor" : " lock";
    }
    if (shop.armed === kind + ":" + id) c += " armed";
    return c;
}
const card = (kind, id) => `<button class="${cardCls(kind, id)}" id="gx_${kind}_${id}" data-kind="${kind}" data-id="${id}">${cardInner(kind, id)}</button>`;

function bodyHtml() {
    if (shop.tab === "cars") return `<div class="gx-grid cars">${SKIN_KEYS.map(k => card("skin", k)).join("")}</div>`;
    if (shop.tab === "items") return `<div class="gx-grid items">${ITEMS.map(i => card("item", i.id)).join("")}</div>`;
    return `<div class="gx-sec">📯 HORNS · ${glyph("confirm")} to hear</div>
        <div class="gx-grid horns">${HORNS.map(h => card("horn", h.id)).join("")}</div>
        <div class="gx-sec">✨ CAR BLING · ${glyph("confirm")} to try on</div>
        <div class="gx-grid decor">${DECOR.map(d => card("decor", d.id)).join("")}</div>`;
}

function renderCard(first = false) {
    const tabs = TABS.map(([id, label]) => `<button class="gx-tab nav${shop.tab === id ? " on" : ""}" id="gx_tab_${id}" data-tab="${id}">${label}</button>`).join("");
    const html = `<div class="gx" id="gx">
        <div class="gx-top">
            <button class="gx-back nav" id="gx_back" aria-label="Back">← <span class="gx-bk">${glyph("back")}</span></button>
            <h2>🛒 SHOP</h2>
            <div class="gx-coins"><span class="coin"></span><b id="gx_coins">${fmt(wallet.coins)}</b></div>
        </div>
        <div class="gx-tabs"><span class="gx-tk">${glyph("tabPrev")}</span>${tabs}<span class="gx-tk">${glyph("tabNext")}</span></div>
        <div class="gx-body" id="gx_body">${bodyHtml()}</div>
        <div class="gx-detail" id="gx_detail"></div>
        <div class="gx-msg" id="gx_msg"></div>
        <div class="gx-hint">${glyph("confirm")} buy / equip · ${glyph("back")} back · ${glyph("tabPrev")} ${glyph("tabNext")} tabs${input.device === "touch" ? " · drag the car to spin it" : input.device === "gamepad" ? " · R-stick spins" : ""}</div>
    </div>`;
    const focus = defaultFocusId();
    H.showScreen(html, [], { onBack: leaveShop, onTab: d => switchTab(d), focus, cls: "gx-card" });
    shop.focusKey = null;
    if (!first) previewFor(focusedEl(), true);
}

function defaultFocusId() {
    if (shop.tab === "cars") return "gx_skin_" + inv.selectedSkin;
    if (shop.tab === "items") return "gx_item_missile";
    return "gx_horn_" + inv.horn;
}

/** Re-render the grid in place (keeps focus on the same card). */
function refreshCards() {
    const body = document.getElementById("gx_body");
    if (!body) return;
    for (const b of body.querySelectorAll("[data-kind]")) {
        const k = b.dataset.kind, id = b.dataset.id;
        const focused = b.classList.contains("focus");
        b.className = cardCls(k, id) + (focused ? " focus" : "");
        b.innerHTML = cardInner(k, id);
    }
    const c = document.getElementById("gx_coins");
    if (c) c.textContent = fmt(wallet.coins);
    renderDetail(focusedEl());
}

function switchTab(dir, to = null) {
    const i = TABS.findIndex(t => t[0] === shop.tab);
    shop.tab = to || TABS[(i + dir + TABS.length) % TABS.length][0];
    shop.armed = null;
    for (const b of document.querySelectorAll(".gx-tab")) b.classList.toggle("on", b.dataset.tab === shop.tab);
    const body = document.getElementById("gx_body");
    if (!body) return;
    body.innerHTML = bodyHtml();
    body.scrollTop = 0;
    H.refreshFocus(true);
    focusEl(document.getElementById(defaultFocusId()));
    S.sfxClick();
}

/** Move the menu focus to an element (hud.js focuses on pointerenter). */
function focusEl(el) {
    if (!el) return;
    H.refreshFocus(true);
    el.dispatchEvent(new Event("pointerenter"));
}
function focusedEl() { const c = H.screenCard(); return c ? c.querySelector(".gx-it.focus") : null; }

function setMsg(text, cls = "") {
    const m = document.getElementById("gx_msg");
    if (!m) return;
    m.className = "gx-msg show " + cls;
    m.innerHTML = text;
    m.style.animation = "none"; void m.offsetWidth; m.style.animation = "";
}

// ── the detail panel for whatever is focused ─────────────────────────────
function actionHtml(kind, id) {
    const ok = glyph("confirm");
    const armed = shop.armed === kind + ":" + id;
    const buy = (price, verb = "BUY") => wallet.coins >= price
        ? (armed ? `<span class="gx-go armed">${ok} again to ${verb} for ${priceTag(price)}</span>` : `<span class="gx-go">${ok} ${verb} ${priceTag(price)}</span>`)
        : `<span class="gx-go poor">${priceTag(price)} — need ${fmt(price - wallet.coins)} more</span>`;
    if (kind === "skin") {
        const st = skinState(id);
        if (st === "eq") return `<span class="gx-go done">✓ EQUIPPED — your ride</span>`;
        if (st === "own") return `<span class="gx-go">${ok} EQUIP</span>`;
        return buy(SKIN_SHOP[id].price);
    }
    if (kind === "item") {
        const it = itemDef(id);
        if (id === "distracted") {
            if (inv.distractedUnlocked) return `<span class="gx-go">${ok} turn it ${distracted() ? "OFF" : "ON"}</span><span class="gx-sub">(also on the title menu)</span>`;
            return buy(it.price, "UNLOCK");
        }
        return wallet.coins >= it.price ? `<span class="gx-go">${ok} BUY ${priceTag(it.price)}</span>` : `<span class="gx-go poor">need ${fmt(it.price - wallet.coins)} more 💰</span>`;
    }
    const def = kind === "horn" ? hornById(id) : decorDef(id);
    if (blingOn(kind, id)) return kind === "horn" ? `<span class="gx-go done">✓ ON · ${ok} hear it</span>` : `<span class="gx-go done">✓ ON · ${ok} take it off</span>`;
    if (blingOwned(kind, id)) return `<span class="gx-go">${ok} ${kind === "horn" ? "EQUIP" : "PUT IT ON"}</span>`;
    return buy(def.price);
}

function renderDetail(el) {
    const d = document.getElementById("gx_detail");
    if (!d) return;
    if (!el) { d.innerHTML = ""; return; }
    const kind = el.dataset.kind, id = el.dataset.id;
    let html = "";
    if (kind === "skin") {
        const sk = SKINS[id];
        const rows = STAT_ROWS.map(([label, k]) => {
            const m = sk[k] || 1, pct = Math.round((m - 1) * 100);
            return `<div class="gx-stat"><span>${label}</span><div class="gx-bar"><i style="width:${(statFill(m) * 100).toFixed(0)}%"></i><u style="left:${(statFill(1) * 100).toFixed(0)}%"></u></div>
                <em class="${pct > 0 ? "up" : pct < 0 ? "down" : ""}">${pct > 0 ? "+" : ""}${pct}%</em></div>`;
        }).join("");
        html = `<div class="gx-dh"><b>${sk.name}</b><span class="gx-class">${skinClass(sk)}</span></div>
            <p class="gx-flavor">${SKIN_SHOP[id].flavor}</p><div class="gx-stats">${rows}</div>`;
    } else if (kind === "item") {
        const it = itemDef(id);
        const pill = it.count ? `<span class="gx-pill">×${inv[it.count]} owned</span>` : inv.distractedUnlocked ? `<span class="gx-pill own">OWNED</span>` : "";
        const how = id === "missile" || id === "megapack" ? `Fire with ${glyph("fire")} while driving.`
            : id === "pepper" ? `Spray with ${glyph("item")} — free if there's nothing to hit.`
            : id === "shield" ? "Automatic: the bubble pops instead of you losing a heart." : it.note;
        html = `<div class="gx-dh"><b>${it.icon} ${it.title}</b>${pill}</div><p class="gx-flavor">${it.desc}</p><p class="gx-note">${how}</p>`;
    } else if (kind === "horn") {
        const h = hornById(id);
        html = `<div class="gx-dh"><b>${h.icon} ${h.name}</b>${inv.horn === id ? '<span class="gx-pill own">ON</span>' : ""}</div>
            <p class="gx-flavor">Lulu's own honk. Honk in a row and it climbs the scale — the Honk Symphony! ♪</p>`;
    } else {
        const dd = decorDef(id);
        html = `<div class="gx-dh"><b>${dd.icon} ${dd.name}</b>${inv.decor === id ? '<span class="gx-pill own">ON</span>' : ""}</div><p class="gx-flavor">${dd.desc}</p>`;
    }
    d.innerHTML = html + `<div class="gx-act">${actionHtml(kind, id)}</div>`;
}

// ── actions (✕ / click / tap on a card) ─────────────────────────────────
function onCard(el) {
    const kind = el.dataset.kind, id = el.dataset.id, key = kind + ":" + id;
    if (kind === "skin") skinAction(id, key);
    else if (kind === "item") itemAction(id, key);
    else blingAction(kind, id, key);
    refreshCards();
}

function confetti() {
    if (!shop.fx) return;
    const cols = [[1, 0.84, 0.25], [1, 0.31, 0.64], [0.31, 0.76, 0.97], [0.65, 0.84, 0.65], [1, 0.67, 0.57]];
    const y = shop.show === "car" ? 1.6 : 1.9;
    for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
        shop.fx.emit((Math.random() - 0.5) * 1.5, y, (Math.random() - 0.5) * 1.5, Math.cos(a) * s, 3 + Math.random() * 5, Math.sin(a) * s, 0.22, 1.6, cols[i % cols.length]);
    }
    shop.popT = 0;
}

function spend(price, armKey) {
    if (wallet.coins < price) {
        S.sfxDeny();
        setMsg(`Need ${fmt(price - wallet.coins)} more coins!`, "red");
        shop.armed = null;
        return false;
    }
    if (shop.armed !== armKey) {
        shop.armed = armKey;
        S.sfxClick();
        setMsg(`Press ${glyph("confirm")} again to buy for ${priceTag(price)}`, "gold");
        return false;
    }
    shop.armed = null;
    if (!wallet.spend(price)) { S.sfxDeny(); setMsg("Not enough coins!", "red"); return false; }
    return true;
}

function skinAction(id, key) {
    const sk = SKINS[id];
    if (inv.ownedSkins.includes(id)) {
        if (inv.selectedSkin === id) { S.sfxClick(); setMsg(`✓ ${sk.name} is your ride`); return; }
        equipSkin(id);
        S.sfxEquip();
        setMsg(`${sk.name} equipped!`, "gold");
        return;
    }
    if (!spend(SKIN_SHOP[id].price, key)) return;
    writeShared(s => {
        s.ownedSkins = Array.isArray(s.ownedSkins) ? s.ownedSkins : ["pink"];
        if (!s.ownedSkins.includes(id)) s.ownedSkins.push(id);
        s.selectedSkin = id;
    });
    equipSkin(id);
    S.sfxBuy(); rumble(0.3, 0.6, 200, true); confetti();
    setMsg(`🎉 ${sk.name} purchased!`, "gold");
    emit("stat", { id: "skinsBought", n: 1 });
}
function equipSkin(id) {
    writeShared(s => { s.selectedSkin = id; });
    if (ctx.car) ctx.car.setSkin(id);
    emit("skin", { key: id });
}

function itemAction(id, key) {
    const it = itemDef(id);
    if (id === "distracted") {
        if (inv.distractedUnlocked) {
            setDistracted(!distracted());
            S.sfxPhone();
            setMsg(`📱 Distracted Mode ${distracted() ? "ON — reversed steering, 2× score!" : "OFF"}`, distracted() ? "pink" : "");
            return;
        }
        if (!spend(it.price, key)) return;
        writeShared(s => { s.distractedUnlocked = true; });
        S.sfxBuy(); rumble(0.3, 0.6, 200, true); confetti();
        setMsg(it.bought + " Toggle it here or on the title menu.", "gold");
        return;
    }
    if (wallet.coins < it.price || !wallet.spend(it.price)) { S.sfxDeny(); setMsg("Not enough coins!", "red"); return; }
    writeShared(s => { s[it.count] = Math.max(0, (s[it.count] | 0)) + it.give; });
    S.sfxBuy(); rumble(0.2, 0.4, 120);
    if (shop.fx) shop.fx.burst(0, 1.9, 0, 26, 3, [1, 0.84, 0.25], 0.25, 0.9);
    shop.popT = 0;
    setMsg(it.bought, "gold");
}

function blingAction(kind, id, key) {
    const def = kind === "horn" ? hornById(id) : decorDef(id);
    if (kind === "horn") { hornPreview(id); shop.focusT = 1; }
    if (blingOwned(kind, id)) {
        shop.armed = null;
        if (kind === "horn") {
            if (inv.horn !== id) { writeShared(s => { s.horn = id; }); setMsg(`${def.name} equipped! 📯`, "gold"); }
        } else if (inv.decor === id) {
            writeShared(s => { s.decor = "none"; });
            S.sfxClick(); setMsg(`${def.name} off.`);
        } else {
            writeShared(s => { s.decor = id; });
            S.sfxEquip(); setMsg(`${def.name} on! ✨`, "gold");
        }
        if (kind === "decor") showCar(previewSkin(), inv.decor);   // 2D: owned taps show what's actually on
        return;
    }
    if (!spend(def.price, key)) return;
    writeShared(s => {
        const f = kind === "horn" ? "ownedHorns" : "ownedDecor";
        s[f] = Array.isArray(s[f]) ? s[f] : (kind === "horn" ? ["beep"] : []);
        if (!s[f].includes(id)) s[f].push(id);
        if (kind === "horn") s.horn = id; else s.decor = id;
    });
    S.sfxBuy(); rumble(0.3, 0.6, 200, true); confetti();
    setMsg(`${def.name} is yours! 🎉`, "gold");
}

// event delegation (the card element persists across showScreen calls)
const screenCardEl = document.getElementById("screenCard");
if (screenCardEl) screenCardEl.addEventListener("click", e => {
    if (!shop.open) return;
    const it = e.target.closest("[data-kind]");
    if (it) { onCard(it); return; }
    const tab = e.target.closest("[data-tab]");
    if (tab) { if (tab.dataset.tab !== shop.tab) switchTab(0, tab.dataset.tab); return; }
    if (e.target.closest("#gx_back")) leaveShop();
});

// drag on the empty part of the screen to spin the turntable (touch / mouse)
const screenEl = document.getElementById("screen");
let drag = null;
if (screenEl) {
    screenEl.addEventListener("pointerdown", e => {
        if (!shop.open || e.target !== screenEl) return;
        drag = { id: e.pointerId, x: e.clientX };
        try { screenEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    screenEl.addEventListener("pointermove", e => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x;
        drag.x = e.clientX;
        shop.spin += dx * 0.012;
        shop.manual = 3;
        shop.hold = null;
    });
    const end = e => { if (drag && e.pointerId === drag.id) drag = null; };
    screenEl.addEventListener("pointerup", end);
    screenEl.addEventListener("pointercancel", end);
}

// ══════════════════════════════════════════════════════════════════════════
//  THE 3D SHOWROOM
// ══════════════════════════════════════════════════════════════════════════
function studioEnv(renderer) {
    const s = new THREE.Scene();
    const own = [];
    const add = (geo, color, k, pos, rot, side = THREE.DoubleSide) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side }));
        m.position.set(...pos); if (rot) m.rotation.set(...rot);
        s.add(m); own.push(geo, m.material);
    };
    add(new THREE.BoxGeometry(34, 16, 34), "#2c373d", 1, [0, 6, 0], null, THREE.BackSide);
    add(new THREE.PlaneGeometry(12, 4), "#ffffff", 4, [0, 13.5, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.PlaneGeometry(5, 7), "#fff1dc", 3, [-15, 5, 5], [0, Math.PI / 2, 0]);
    add(new THREE.PlaneGeometry(5, 7), "#dcecff", 2.4, [15, 5, -3], [0, -Math.PI / 2, 0]);
    add(new THREE.PlaneGeometry(14, 1.2), "#ff4fa3", 2.5, [0, 6, -16.5], null);
    add(new THREE.PlaneGeometry(14, 1.2), "#ffd54f", 1.6, [0, 3, 16.5], [0, Math.PI, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(s, 0.035);
    pm.dispose();
    for (const o of own) o.dispose();
    return rt;
}

function buildSet() {
    if (shop.set) return;
    const set = makeSet({ light: "indoor", sky: "#141b20", fov: 38 });
    shop.set = set;
    set.hemi.intensity = 0.9;
    set.sun.intensity = 2.1;
    set.sun.position.set(3, 14, 7);
    Object.assign(set.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 2, far: 30 });
    set.sun.shadow.camera.updateProjectionMatrix();
    set.sun.shadow.mapSize.set(1024, 1024);
    const key = new THREE.SpotLight("#fff0d8", 55, 30, 0.55, 0.6, 1.4);
    key.position.set(-6, 7.5, 5.5);
    const rim = new THREE.SpotLight("#bfe3ff", 45, 30, 0.6, 0.7, 1.4);
    rim.position.set(5, 6, -7);
    const pinkFill = new THREE.PointLight("#ff4fa3", 6, 14, 1.6);
    pinkFill.position.set(0, 3.5, -8);
    set.add(key, key.target, rim, rim.target, pinkFill);
    try { shop.env = studioEnv(ctx.renderer); set.scene.environment = shop.env.texture; set.scene.environmentIntensity = 0.95; }
    catch (e) { console.warn("[garage] env", e); }

    const room = models.garageShowroom.clone(true);
    set.add(room);
    shop.spinner = new THREE.Group();
    set.add(shop.spinner);
    const tt = findNodes(room, "Turntable")[0];
    const ped = findNodes(room, "Pedestal")[0];
    if (tt) shop.spinner.add(tt);
    if (ped) { shop.spinner.add(ped); ped.visible = false; }
    shop.pedestal = ped;
    room.traverse(o => { if (o.isMesh && /Neon/.test(o.material.name)) o.castShadow = false; });

    // the car (a plain clone of Lulu's car model, repainted live as you browse)
    shop.car = models.lulu.clone(true);
    shop.car.position.y = 0.185;
    shop.paint = new Map();
    for (const w of findNodes(shop.car, "Wheel_F")) { w.rotation.order = "YXZ"; w.rotation.y = 0.32; }
    dressHair(shop.car);
    shop.spinner.add(shop.car);
    shop.carDecor = { id: null, obj: null };

    shop.prop = new THREE.Group();
    shop.prop.position.y = 1.1;
    shop.spinner.add(shop.prop);

    shop.fx = new Particles(set.scene, 260);
    shop.camSnap = true;
    shop.layoutT = 0;
    set.show();
    shop.loaded = true;
}

function disposeSet() {
    const set = shop.set;
    if (!set) return;
    for (const w of shop.waves) w.mesh.material.dispose();
    shop.waves.length = 0;
    if (shop.fx) { shop.fx.geo.dispose(); shop.fx.points.material.dispose(); shop.fx = null; }
    for (const m of shop.paint.values()) m.dispose();
    if (shop.hairMat) shop.hairMat.dispose();
    if (shop.env) { shop.env.dispose(); shop.env = null; }
    if (shop.bubble) { shop.bubble.geometry.dispose(); shop.bubble.material.dispose(); shop.bubble = null; }
    if (shop.carDecor && shop.carDecor.obj) disposeDecor(shop.carDecor.obj);
    shop.carDecor = { id: null, obj: null };
    shop.carSkin = null; shop.propKey = null;
    set.camera.clearViewOffset();
    set.dispose();
    shop.set = null;
    shop.loaded = false;
    shop.show = null;
}

function dressHair(model) {
    const s2 = shared.get();
    const style = s2.luluHairStyle || (ctx.car && ctx.car.hairStyle) || "sheitel";
    const hairs = findNodes(model, "Hair_");
    const extra = ctx.car && ctx.car.extraHair && ctx.car.extraHair[style];
    if (extra && !hairs.some(h => h.name.startsWith("Hair_" + style))) {
        const c = extra.clone(true);
        model.add(c);
        hairs.push(c);
    }
    const has = hairs.some(h => h.name.startsWith("Hair_" + style));
    for (const h of hairs) h.visible = has ? h.name.startsWith("Hair_" + style) : h.name.startsWith("Hair_sheitel");
    if (s2.luluHair) {
        let mat = null;
        model.traverse(o => {
            if (o.isMesh && o.material.name === "Hair") { if (!mat) { mat = o.material.clone(); mat.color.set(s2.luluHair); } o.material = mat; }
        });
        shop.hairMat = mat;
    }
}

function paintCar(key) {
    const sk = SKINS[key] || SKINS.pink;
    const cols = { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark };
    shop.car.traverse(o => {
        if (!o.isMesh) return;
        const base = o.userData.gxBase || (o.userData.gxBase = o.material);
        const hex = cols[base.name];
        if (!hex) return;
        const k = base.uuid + hex;
        let m = shop.paint.get(k);
        if (!m) { m = base.clone(); m.color.set(hex); shop.paint.set(k, m); }
        o.material = m;
    });
    shop.carSkin = key;
}

function showCar(skinKey, decorId) {
    if (!shop.loaded) return;
    const was = shop.show;
    if (shop.carSkin !== skinKey) paintCar(skinKey);
    if (shop.carDecor.id !== decorId) {
        if (shop.carDecor.obj) { if (shop.carDecor.obj.parent) shop.carDecor.obj.parent.remove(shop.carDecor.obj); disposeDecor(shop.carDecor.obj); }
        shop.carDecor = { id: decorId, obj: decorId && decorId !== "none" ? makeDecor(decorId) : null };
        attachToModel(shop.car, shop.carDecor.obj);
        if (was === "car") shop.popT = 0.25;
    }
    shop.car.visible = true;
    shop.prop.visible = false;
    if (shop.pedestal) shop.pedestal.visible = false;
    if (was !== "car") shop.popT = 0;
    shop.show = "car";
}

function showProp(root, node) {
    if (!shop.loaded) return;
    const key = node;
    shop.car.visible = false;
    if (shop.pedestal) shop.pedestal.visible = true;
    shop.prop.visible = true;
    if (shop.propKey === key && shop.show === "prop") return;
    shop.propKey = key;
    shop.show = "prop";
    shop.popT = 0;
    while (shop.prop.children.length) shop.prop.remove(shop.prop.children[0]);
    if (shop.bubble) { shop.bubble.geometry.dispose(); shop.bubble.material.dispose(); shop.bubble = null; }
    const obj = cloneNode(root, node);
    if (!obj) return;
    // fit it on the pedestal
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const sc = THREE.MathUtils.clamp(1.15 / maxDim, 0.6, 7);
    obj.scale.setScalar(sc);
    const holder = new THREE.Group();
    holder.add(obj);
    obj.position.set(-(box.min.x + size.x / 2) * sc, -box.min.y * sc + 0.02, -(box.min.z + size.z / 2) * sc);
    if (node === "Item_missile") { holder.rotation.z = 0.5; holder.position.y = 0.35; }
    shop.prop.add(holder);
    if (node === "Item_shield") {
        shop.bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), bubbleMaterial());
        shop.bubble.material.uniforms.uAlpha.value = 0.8;
        shop.bubble.position.y = 0.05;
        shop.prop.add(shop.bubble);
    }
}

const previewSkin = () => inv.selectedSkin;
function previewDecor(el) { return el && el.dataset.kind === "decor" ? el.dataset.id : inv.decor; }

/** Update the showroom + camera for the focused card. */
function previewFor(el, initial = false) {
    renderDetail(el);
    if (!el) {
        if (initial) { showCar(inv.selectedSkin, inv.decor); setView("car"); }
        return;
    }
    const kind = el.dataset.kind, id = el.dataset.id;
    if (kind === "skin") { showCar(id, inv.decor); setView("car"); }
    else if (kind === "decor") { showCar(previewSkin(), id); setView(decorDef(id).cam); }
    else if (kind === "item") { const it = itemDef(id); showProp(it.model === "Item_missile" || it.model === "Item_phone" ? models.garageProps : models.garageItems, it.model); setView("prop"); }
    else if (kind === "horn") { showProp(models.garageItems, "Horn_" + id); setView("prop"); }
}

function setView(v) {
    if (shop.view === v && shop.hold !== null) return;
    shop.view = v;
    const turn = VIEWS[v].turn;
    shop.hold = turn == null ? null : CAM_YAW + turn;
    shop.manual = 0;
}

function hornPreview(id) {
    S.playHorn(id, 262);
    if (!shop.loaded) return;
    for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 40), new THREE.MeshBasicMaterial({ color: "#FFE082", transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.position.set(0, 1.55, 0);
        shop.set.add(m);
        shop.waves.push({ mesh: m, t: -i * 0.16 });
    }
    shop.popT = 0.3;
}

// ══════════════════════════════════════════════════════════════════════════
//  per-frame
// ══════════════════════════════════════════════════════════════════════════
const _t = new THREE.Vector3(), _p = new THREE.Vector3();
function updateShop(dt, P) {
    H.menuInput(P);
    if (!shop.open) return;
    // focus changes → live preview (and disarm a pending purchase)
    const el = focusedEl();
    const key = el ? el.dataset.kind + ":" + el.dataset.id : null;
    if (el && key !== shop.focusKey) {
        const first = shop.focusKey === null;
        shop.focusKey = key;
        shop.focusT = first ? -99 : 0;
        if (shop.armed && shop.armed !== key) { shop.armed = null; refreshCards(); }
        previewFor(el, first);
    }
    shop.focusT += dt;
    // resting on a horn plays it once
    if (el && el.dataset.kind === "horn" && shop.focusT > 0.35 && shop.focusT - dt <= 0.35) hornPreview(el.dataset.id);
    shop.coinT -= dt;
    if (shop.coinT <= 0) { shop.coinT = 0.5; const c = document.getElementById("gx_coins"); if (c) c.textContent = fmt(wallet.coins); }
    if (!shop.loaded) return;
    animateSet(dt);
}

function animateSet(dt) {
    const set = shop.set, cam = set.camera;
    // turntable: auto spin · right stick / drag · or swing to present a decoration
    const lx = input.lookX || 0;
    if (Math.abs(lx) > 0.05) { shop.spin -= lx * 2.4 * dt; shop.manual = 3; shop.hold = null; }
    shop.manual -= dt;
    if (shop.hold != null && shop.manual <= 0) {
        const d = wrapAngle(shop.hold - shop.spin);
        shop.spin += d * Math.min(1, dt * 3.2);
    } else if (shop.manual <= 0) shop.spin += dt * 0.45;
    shop.spinner.rotation.y = shop.spin;

    // pop-in when the display changes
    shop.popT = Math.min(1, shop.popT + dt * 2.6);
    const p = shop.popT, back = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
    const s = 0.82 + 0.18 * back;
    if (shop.show === "car") { shop.car.scale.setScalar(s); }
    else { shop.prop.scale.setScalar(s); shop.prop.position.y = 1.1 + Math.sin(ctx.time * 1.8) * 0.04; shop.prop.rotation.y = ctx.time * 0.6; }
    if (shop.carDecor.obj) animateDecor(shop.carDecor.obj, dt, null);
    if (shop.bubble) shop.bubble.material.uniforms.uTime.value += dt;
    for (let i = shop.waves.length - 1; i >= 0; i--) {
        const w = shop.waves[i];
        w.t += dt;
        if (w.t < 0) continue;
        const k = w.t / 0.9;
        w.mesh.scale.setScalar(1 + k * 4);
        w.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
        w.mesh.lookAt(cam.position);
        if (k >= 1) { set.scene.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); shop.waves.splice(i, 1); }
    }
    shop.fx.update(dt);

    // camera: frame the view inside the part of the screen the card doesn't cover
    shop.layoutT -= dt;
    if (shop.layoutT <= 0) { shop.layoutT = 0.5; measureLayout(); }
    const V = VIEWS[shop.view] || VIEWS.car;
    _t.set(V.t[0], V.t[1], V.t[2]);
    if (V.t[0] !== 0 || V.t[2] !== 0) _t.applyAxisAngle(THREE.Object3D.DEFAULT_UP, shop.spin);
    const rg = shop.region;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const fit = Math.min(tanV * rg.fh, tanV * cam.aspect * rg.fw);
    const dist = THREE.MathUtils.clamp(V.R / Math.max(0.05, fit) * 1.08, 2.2, 26);
    _p.set(Math.sin(CAM_YAW) * Math.cos(V.elev), Math.sin(V.elev), Math.cos(CAM_YAW) * Math.cos(V.elev)).multiplyScalar(dist).add(_t);
    if (shop.camSnap) { shop.camPos.copy(_p); shop.camLook.copy(_t); shop.camSnap = false; }
    shop.camPos.lerp(_p, Math.min(1, dt * 3));
    shop.camLook.lerp(_t, Math.min(1, dt * 4));
    cam.position.copy(shop.camPos);
    cam.lookAt(shop.camLook);
    const W = window.innerWidth, Hh = window.innerHeight;
    cam.setViewOffset(W, Hh, -(rg.cx - 0.5) * W, -(rg.cy - 0.5) * Hh, W, Hh);
}

/** Where the 3D view should sit: the part of the screen the shop card leaves free. */
function measureLayout() {
    const c = H.screenCard();
    const W = window.innerWidth, Hh = window.innerHeight;
    const r = c ? c.getBoundingClientRect() : null;
    if (!r || !r.width) { shop.region = { cx: 0.5, cy: 0.5, fw: 1, fh: 1 }; return; }
    const portrait = W < Hh * 1.05;
    if (portrait) {
        const free = Math.max(Hh * 0.28, r.top);
        shop.region = { cx: 0.5, cy: free / 2 / Hh, fw: 1, fh: free / Hh };
    } else {
        const free = Math.max(W * 0.3, r.left);
        shop.region = { cx: free / 2 / W, cy: 0.5, fw: free / W, fh: 1 };
    }
}

export const shopDebug = shop;

// ── styles ───────────────────────────────────────────────────────────────
css("garage-shop", `
body.gx-open .screen { background: linear-gradient(90deg, rgba(0,0,0,0) 40%, rgba(10,16,20,.35)); padding: 12px; }
.card.gx-card { background: rgba(28,38,44,.94); color: #ECEFF1; padding: 14px 16px 12px; display: flex; flex-direction: column;
  width: min(560px, 54vw); max-height: calc(100% - 4px); overflow: hidden; border: 2px solid rgba(255,193,7,.45); }
@media (min-aspect-ratio: 21/20) { body.gx-open .screen { justify-content: flex-end; } }
@media (max-aspect-ratio: 21/20) {
  body.gx-open .screen { align-items: flex-end; background: linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(10,16,20,.35)); padding: 8px; }
  .card.gx-card { width: 100%; max-height: 61vh; border-radius: 24px; }
}
.gx { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; gap: 8px; }
.gx-top { display: flex; align-items: center; gap: 10px; }
.gx-top h2 { flex: 1; margin: 0 !important; font-size: 26px !important; color: #FFD700; text-shadow: 0 3px 0 rgba(0,0,0,.4); letter-spacing: .06em; }
.gx-back { border: none; border-radius: 14px; background: #546E7A; color: #fff; font: 700 15px var(--font); padding: 7px 11px; cursor: pointer; display: flex; gap: 6px; align-items: center; }
.gx-back .glyph { background: #fff; color: var(--ink); }
.gx-coins { display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,.35); border-radius: 999px; padding: 5px 12px; font-size: 18px; color: #FFE082; }
.gx-tabs { display: flex; gap: 6px; align-items: center; justify-content: center; }
.gx-tk .glyph { background: rgba(255,255,255,.9); color: var(--ink); }
.gx-tab { flex: 1; border: none; border-radius: 14px; padding: 8px 6px; font: 700 15px var(--font); background: #455A64; color: #ECEFF1; cursor: pointer; }
.gx-tab.on { background: linear-gradient(#FFD54F, #FFB300); color: #1a1400; box-shadow: 0 3px 0 rgba(0,0,0,.3); }
.gx-body { overflow: auto; min-height: 0; flex: 1 1 auto; padding: 4px 3px 6px; overscroll-behavior: contain; }
.gx-sec { font-size: 13px; font-weight: 700; color: #FFE082; letter-spacing: .04em; margin: 4px 0 6px; text-align: left; }
.gx-sec .glyph { min-width: 18px; height: 18px; font-size: 11px; background: #FFE082; color: #1a1400; }
.gx-grid { display: grid; gap: 7px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 6px; }
.gx-grid.items { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.gx-grid.horns { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.gx-it { position: relative; border: none; border-radius: 14px; padding: 8px 4px 7px; background: linear-gradient(#4F636E, #37474F); color: #fff;
  font: 600 12px var(--font); display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; min-width: 0;
  box-shadow: 0 3px 0 rgba(0,0,0,.3); transition: transform .08s; }
.gx-it b { font-size: 12px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.gx-it small { font-size: 11px; font-weight: 700; color: #FFD54F; white-space: nowrap; }
.gx-it.poor small { color: #FF8A80; }
.gx-it.own { background: linear-gradient(#4CAF50, #2E7D32); } .gx-it.own small { color: #E8F5E9; }
.gx-it.eq { background: linear-gradient(#FFD54F, #FFA000); color: #1a1400; } .gx-it.eq small { color: #3a2b00; }
.gx-it.focus { outline: 3px solid #fff; box-shadow: 0 0 0 6px rgba(233,30,99,.65), 0 3px 0 rgba(0,0,0,.3); transform: scale(1.06); z-index: 2; }
.gx-it.armed { animation: gxArm .5s ease-in-out infinite alternate; }
@keyframes gxArm { from { filter: brightness(1); } to { filter: brightness(1.35); } }
.gx-sw { width: 34px; height: 34px; border-radius: 50%; display: block; box-shadow: inset 0 -3px 0 rgba(0,0,0,.25), 0 2px 4px rgba(0,0,0,.4); }
.gx-ico { font-size: 28px; line-height: 1.1; }
.gx-strip { display: flex; gap: 3px; background: rgba(16,22,28,.5); padding: 2px 4px; border-radius: 6px; }
.gx-strip i { width: 6px; height: 11px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(255,255,255,.3); background: linear-gradient(to top, #FFD54F var(--f), rgba(0,0,0,.35) 0); }
.gx-tick { position: absolute; top: 4px; right: 6px; font-size: 13px; font-weight: 700; }
.gx-cnt { position: absolute; top: 3px; right: 5px; font-style: normal; font-size: 11px; font-weight: 700; background: #FFC107; color: #3a2b00; border-radius: 999px; padding: 1px 6px; }
.gx-badge { position: absolute; top: -6px; left: 50%; transform: translateX(-50%) rotate(-4deg); font-size: 8px; font-weight: 700; background: #FFC107; color: #5D3A00; border-radius: 4px; padding: 1px 4px; white-space: nowrap; }
.gx-detail { background: rgba(0,0,0,.28); border-radius: 16px; padding: 9px 12px; text-align: left; min-height: 70px; }
.gx-dh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gx-dh b { font-size: 19px; color: #FFD700; }
.gx-class { background: rgba(255,193,7,.92); color: #1a1400; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 2px 9px; }
.gx-pill { background: #FFC107; color: #3a2b00; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 2px 9px; }
.gx-pill.own { background: #43A047; color: #fff; }
.gx-flavor { font-style: italic; color: #CFD8DC; margin: 4px 0 !important; font-size: 14px !important; }
.gx-note { color: #FFCC80; font-size: 13px !important; margin: 2px 0 !important; }
.gx-note .glyph, .gx-act .glyph, .gx-msg .glyph { background: #fff; color: var(--ink); }
.gx-stats { display: grid; gap: 4px; margin: 4px 0 2px; }
.gx-stat { display: grid; grid-template-columns: 100px 1fr 44px; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: #CFD8DC; }
.gx-bar { position: relative; height: 11px; border-radius: 999px; background: rgba(0,0,0,.45); overflow: hidden; }
.gx-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #FFA000, #FFE082); transform-origin: left; animation: gxGrow .5s ease-out; }
.gx-bar u { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,.6); }
@keyframes gxGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.gx-stat em { font-style: normal; text-align: right; color: #B0BEC5; } .gx-stat em.up { color: #9CCC65; } .gx-stat em.down { color: #EF9A9A; }
.gx-act { margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gx-go { font-weight: 700; font-size: 15px; background: #FFC107; color: #1a1400; border-radius: 12px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 6px; }
.gx-go.armed { background: #FF4FA3; color: #fff; animation: gxArm .5s ease-in-out infinite alternate; }
.gx-go.done { background: #43A047; color: #fff; } .gx-go.poor { background: #8D5B5B; color: #FFE0B2; }
.gx-sub { font-size: 12px; opacity: .7; }
.gx-msg { min-height: 0; font-weight: 700; font-size: 15px; color: #FFD700; opacity: 0; }
.gx-msg.show { animation: gxMsg 2.4s ease-out forwards; } .gx-msg.red { color: #FF8A80; } .gx-msg.pink { color: #FF80AB; }
@keyframes gxMsg { 0% { opacity: 0; transform: translateY(6px); } 8% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: .0; } }
.gx-hint { font-size: 11px; opacity: .65; display: flex; gap: 4px; align-items: center; justify-content: center; flex-wrap: wrap; }
.gx-hint .glyph { min-width: 18px; height: 18px; font-size: 10px; background: rgba(255,255,255,.85); color: var(--ink); }
@media (max-width: 560px) {
  .gx-grid.horns { grid-template-columns: repeat(3, minmax(0, 1fr)); } .gx-grid.items { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .gx-top h2 { font-size: 21px !important; } .gx-stat { grid-template-columns: 86px 1fr 38px; }
}
@media (max-height: 520px) {
  .card.gx-card { padding: 8px 10px; } .gx { gap: 5px; } .gx-top h2 { font-size: 19px !important; }
  .gx-it { padding: 4px 3px; } .gx-sw { width: 24px; height: 24px; } .gx-ico { font-size: 20px; }
  .gx-flavor { display: none; } .gx-detail { padding: 6px 10px; min-height: 0; } .gx-stats { gap: 2px; } .gx-hint { display: none; }
  .gx-tab { padding: 5px; font-size: 13px; }
}
body.tv .card.gx-card { width: min(1000px, 52vw); padding: 24px 28px; }
body.tv .gx-top h2 { font-size: 40px !important; } body.tv .gx-coins { font-size: 26px; } body.tv .gx-tab { font-size: 22px; padding: 12px; }
body.tv .gx-it { font-size: 17px; padding: 12px 6px; border-radius: 18px; } body.tv .gx-it b { font-size: 17px; } body.tv .gx-it small { font-size: 15px; }
body.tv .gx-sw { width: 52px; height: 52px; } body.tv .gx-ico { font-size: 42px; } body.tv .gx-dh b { font-size: 28px; }
body.tv .gx-flavor { font-size: 20px !important; } body.tv .gx-stat { font-size: 15px; grid-template-columns: 150px 1fr 60px; } body.tv .gx-bar { height: 15px; }
body.tv .gx-go { font-size: 22px; } body.tv .gx-sec { font-size: 18px; } body.tv .gx-hint { font-size: 16px; } body.tv .gx-msg { font-size: 22px; }
`);
