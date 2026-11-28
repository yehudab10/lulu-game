// ─────────────────────────────────────────────────────────────────────────
//  features/cameras — 📸 SPEED CAMERAS (roadmap 36; the owner 2026-11-27: "speed cameras … only on ocean parkway for now at
//  25mph and only trigger if going above 35mph … a flash … a few days later it'll come in the mail to one of lulus houses with
//  the pic attached and the fine … court or cops will come after her … then u can also add speed cameras to all schools as
//  well with maybe a 15mph limit for that block").
//
//  • THE CAMERAS (built on town:enter, disposed on leave; a grey box on a pole + its sign, school ones with a yellow beacon):
//    Ocean Parkway (Midwood) — 2 poles, limit 25, fires ONLY above 35 mph (data.js PKWY). Every school block (town spots
//    "school" / "yeshiva" / "baisyaakov") — limit 15, fires above 25 mph, only in school hours (the beacon flashes = it's on).
//    Her own car or a borrowed one; one ticket per pass (re-armed TUNE.rearm m past); ≤ TUNE.dayCap a real day; never in a
//    chase (the cops already have her), never in Dina's mode / a minigame run; a self-driving car keeps the limit.
//  • THE FLASH: one soft white pop on the screen + the car lit for a moment (reduced motion: a gentler fade), and the PICTURE:
//    the scene rendered small from the pole, a ~5 kB JPEG kept with the ticket (≤ TUNE.photos). No pop-up: the flash, and at
//    most Lulu's "…was that a FLASH?".
//  • THE MAIL, counted in PLAYED days (City Hall's ledger clock, tax.js — can't be dodged by not playing, never missed by playing
//    rarely): TUNE.mailAfter played days later the envelope is in the mailbox of the home her day starts at (Ima's — Ima says
//    so — or her own house's). One `need: true` 💬 line + the objective line's lowest slot "📬 You have mail" until she reads
//    it. ✋ at the mailbox → the notice card: the photo, where, the speed, the fine, the pay-by day. The fine is a line on City
//    Hall's ledger (kind "fine"): paid at the Taxes window / 📞 Contacts › City Hall like property tax, never below 0.
//  • THE LADDER: unpaid by the due day → a late fee + a SECOND NOTICE → TUNE.summonsAfter later a SUMMONS: a case in that
//    town's Courtroom 2B (the photo is Exhibit A; dismissed TUNE.dismiss, else upheld: she pays what she has) → summons
//    ignored TUNE.warrantAfter played days, or TUNE.warrantUnpaid tickets unpaid at once → a BENCH WARRANT on law's own file
//    (ctx.law.addWarrant — a cop who gets a good look at her lights her up; only a judge clears it; the charge UNPAID SPEED
//    CAMERA TICKETS has its own court lines); the arrest serves it (those tickets are closed). Licence points: none (the warrant already has teeth).
//  ctx.cameras { cams, tickets(), unread(), mailbox(), read(), schoolHours(), debug } · events cameras:<flash|mail|late|summons|
//  ruled|warrant|served> · stats camFlashes, camPaid…
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on, emit, hook, css, MPH } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { say } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { ID, PKWY, SCHOOL, SCHOOL_HOURS, TUNE, CHARGE, L } from "./data.js";
import { worldNow, holyNow } from "../storefronts/hours.js";

export const S = store(ID, { day: "", n: 0, seq: 0, tickets: [], warrant: false });
if (!Array.isArray(S.tickets)) S.tickets = [];
export const CM = { cams: [], town: null, force: {}, log: [], t: 0, flashT: 0, light: null, chip: null, chipTxt: "", spotRm: null, pinRm: null };
function log(ev, d = {}) { CM.log.push(Object.assign({ ev, t: +ctx.time.toFixed(2) }, d)); if (CM.log.length > 80) CM.log.shift(); emit("cameras:" + ev, d); }
const stat = (id, n = 1) => emit("stat", { id, n });
const pick = a => a[Math.floor(Math.random() * a.length)];
const inTown = () => !!(ctx.town && ctx.town.active);
const realDay = () => { const d = CM.force.day || new Date(); return typeof d === "string" ? d : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const TAX = () => (ctx.cityhall && ctx.cityhall.tax) || null;
/** The played-day clock (City Hall's ledger — the same rule as the property tax). */
const played = () => { const T = TAX(); return T && T.ledger ? T.ledger.played || 0 : 0; };
const billOf = ref => { const T = TAX(); return T && T.ledger ? T.ledger.bills.find(b => b.ref === ref) || null : null; };
const owedOf = t => (t.refs || []).reduce((a, r) => { const b = billOf(r); return a + (b && !b.paid ? b.amount : 0); }, 0);
const open = t => !["paid", "dismissed", "served"].includes(t.stage);

/** School hours on the world's clock (Sun–Thu 7:30–16:30 · Fri 7:30–13:00; never Shabbos or at night) — the hour the sky
 *  shows in a Cruise day, the real date (storefronts/hours.js worldNow: a school camera flashed under the stars). */
export function schoolHours() {
    if (CM.force.school != null) return !!CM.force.school;
    const d = worldNow(), h = d.getHours() + d.getMinutes() / 60, wd = d.getDay();
    if (wd === 6 || holyNow()) return false;          // (Shabbos / Yom Tov by the real calendar: Friday night too)
    const [a, b] = wd === 5 ? SCHOOL_HOURS.friday : SCHOOL_HOURS.week;
    return h >= a && h < b;
}

// ── the poles ──
let bakedMat = null;
function bake(parts) {
    const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    for (const b of parts) {
        const g = b.cyl ? new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 8) : new THREE.BoxGeometry(b.w, b.h, b.d);
        g.applyMatrix4(m.compose(p.set(b.x, b.y, b.z), q.identity(), s));
        c.set(b.color);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        geos.push(g.index ? g.toNonIndexed() : g);
    }
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    return new THREE.Mesh(geo, bakedMat);
}
function signPlane(lines, bg, fg) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 160; const g = cv.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 256, 160); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, 244, 148);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 34px Fredoka, Arial, sans-serif"; g.fillText(lines[0], 128, 58, 230);
    g.font = "700 20px Fredoka, Arial, sans-serif"; g.fillText(lines[1], 128, 112, 236);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    mesh.userData.tex = tex;
    return mesh;
}
/** A pole at (x, z) facing yaw (local +z = toward the street). */
function pole(cam, x, z, yaw) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw;
    g.add(bake([
        { cyl: true, w: 0.12, h: 4.2, x: 0, y: 2.1, z: 0, color: "#78838C" },
        { w: 0.55, h: 0.42, d: 0.6, x: 0, y: 4.0, z: 0.25, color: "#6E7378" },
        { w: 0.18, h: 0.18, d: 0.04, x: 0, y: 4.0, z: 0.56, color: "#1B1B1B" },
    ]));
    const sign = cam.kind === "pkwy" ? signPlane(L.sign.pkwy, "#FFFFFF", "#1B1B1B") : signPlane(L.sign.school, "#FDD835", "#1B1B1B");
    sign.position.set(0, 2.6, 0.08); g.add(sign);
    cam.sign = sign;
    if (cam.kind === "school") {
        const bm = new THREE.MeshStandardMaterial({ color: "#FFC107", emissive: "#FFB300", emissiveIntensity: 0 });
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bm); b.position.set(0, 3.25, 0.1); g.add(b);
        cam.beacon = b;
    }
    ctx.scene.add(g);
    cam.group = g;
}
function dropCams() {
    for (const c of CM.cams) {
        if (c.group) { ctx.scene.remove(c.group); c.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== bakedMat) o.material.dispose(); } }); }
        if (c.sign) c.sign.userData.tex.dispose();
    }
    CM.cams = []; CM.town = null;
}
/** Build the cameras for the town she's in (returns false until its spots exist). */
export function buildCams() {
    const T = ctx.town;
    if (!inTown() || !T.plan || !T.spot) return false;
    const key = `${T.id}@${Math.round(T.plan.ORIGIN.x)},${Math.round(T.plan.ORIGIN.z)}`;      // (a town placed somewhere new = new poles)
    if (CM.town === key) return true;
    dropCams();
    const road = ctx.world && ctx.world.road;
    // Ocean Parkway
    if (T.id === PKWY.town) {
        const st = T.plan.byName && T.plan.byName[PKWY.street];
        if (st && st.axis === "ns") PKWY.at.forEach((z, i) => {
            const side = PKWY.side[i], w = T.plan.world(st.c + side * (st.outer + 1.0), z, {});
            const cam = { kind: "pkwy", town: T.id, i, where: PKWY.where, limit: PKWY.limit, trigger: PKWY.trigger, fine: PKWY.fine, x: w.x, z: w.z, st, lz: z, armed: true };
            const c0 = T.plan.world(st.c, z, {});
            pole(cam, w.x, w.z, Math.atan2(c0.x - w.x, c0.z - w.z));
            CM.cams.push(cam);
        });
    }
    // every school block
    for (const [key, where] of Object.entries(SCHOOL.spots)) {
        const sp = T.spot(key);
        if (!sp || sp.nx == null || !road) continue;
        const n0 = road.nearest(sp.x, sp.z, undefined, {});
        if (!n0 || !n0.street) continue;
        const x = sp.x + sp.ux * 7 + sp.nx * 0.6, z = sp.z + sp.uz * 7 + sp.nz * 0.6;
        const cam = { kind: "school", town: T.id, key, where: where.replace(/^the /, "").replace(/^./, c => c.toUpperCase()), limit: SCHOOL.limit, trigger: SCHOOL.trigger, fine: SCHOOL.fine,
            x, z, street: n0.street, s0: n0.s, armed: true };
        pole(cam, x, z, Math.atan2(sp.nx, sp.nz));
        CM.cams.push(cam);
    }
    CM.town = key;
    log("built", { town: T.id, n: CM.cams.length });
    return true;
}
const _n = {};
/** Is the car inside this camera's zone? */
function inZone(cam, x, z) {
    if (cam.kind === "pkwy") {
        const L0 = ctx.town.plan.local(x, z, {});
        return Math.abs(L0.x - cam.st.c) < cam.st.outer + 1 && Math.abs(L0.z - cam.lz) < 6;
    }
    const n = ctx.world.road.nearest(x, z, ctx.car.s, _n);
    return n.street === cam.street && Math.abs(n.s - cam.s0) < SCHOOL.reach;
}
const live = () => (cam => cam.kind !== "school" || schoolHours());

/** Can a camera ticket her right now (not a chase, not Dina, not a minigame, a car she drives herself)? → "" = yes, else why not */
function noTicket() {
    if (!ctx.enabled(ID)) return "off";
    if (ctx.state !== "playing") return "state:" + ctx.state;
    if (ctx.law && (ctx.law.chasing || ctx.law.fugitive)) return "chase";
    const m = ctx.G && ctx.G.mode;
    if (m && !/^(cruise|story)$/.test(m)) return "mode:" + m;
    if (ctx.car && (ctx.car.selfDrive || ctx.car.autopilot)) return "self";      // (a self-driving car keeps the limit)
    return "";
}

// ── the flash + the picture ──
css("cameras", `#camFlash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 40; transition: opacity .35s ease-out; }
#camFlash.soft { transition: opacity .9s ease-out; }
.cam-notice img { width: 100%; max-width: 320px; border-radius: 8px; border: 3px solid #263238; display: block; margin: 6px auto; image-rendering: auto; }
.cam-notice h2 { margin: 0 0 4px; } .cam-notice p { margin: 4px 0; }`);
function flash() {
    let el = document.getElementById("camFlash");
    if (!el) { el = document.createElement("div"); el.id = "camFlash"; document.body.appendChild(el); }
    const soft = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    el.className = soft ? "soft" : "";
    el.style.transition = "none"; el.style.opacity = soft ? "0.22" : "0.55";
    void el.offsetWidth;
    el.style.transition = ""; el.style.opacity = "0";
}
/** Render a small picture of her car from the pole → a JPEG data URL (~5 kB). */
function snapshot(cam, mph) {
    try {
        const r = ctx.renderer, W = 192, Hh = 112;
        const target = new THREE.WebGLRenderTarget(W, Hh);
        const c = new THREE.PerspectiveCamera(32, W / Hh, 0.5, 300);
        const car = ctx.car.pos;
        c.position.set(cam.x, 4.0, cam.z); c.lookAt(car.x, 0.7, car.z);
        const prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
        r.setClearColor("#B9D7EC", 1);                                          // (the sky is drawn elsewhere: a pale sky behind)
        r.setRenderTarget(target); r.clear(); r.render(ctx.scene, c); r.setRenderTarget(prev);
        r.setClearColor(cc, ca);
        const buf = new Uint8Array(W * Hh * 4);
        r.readRenderTargetPixels(target, 0, 0, W, Hh, buf);
        target.dispose();
        const cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
        const g = cv.getContext("2d"), img = g.createImageData(W, Hh);
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
            const s = ((Hh - 1 - y) * W + x) * 4, d = (y * W + x) * 4;
            for (let k = 0; k < 3; k++) img.data[d + k] = Math.min(255, 255 * Math.pow(buf[s + k] / 255, 1 / 2.2) * 1.08);
            img.data[d + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, Hh - 18, W, 18);
        g.fillStyle = "#FFEB3B"; g.font = "bold 12px monospace"; g.textBaseline = "middle";
        g.fillText(`${mph} MPH · LIMIT ${cam.limit} · ${cam.where.toUpperCase()}`.slice(0, 30), 5, Hh - 9);
        return cv.toDataURL("image/jpeg", 0.6);
    } catch (e) { console.warn("[cameras] snapshot", e); return ""; }
}
/** The camera fires: the flash, the picture, the ticket (it's mailed later). → the ticket or null */
export function fire(cam, mph) {
    const d = realDay();
    if (S.day !== d) { S.day = d; S.n = 0; }
    if (S.n >= TUNE.dayCap) { log("capped", { mph }); return null; }
    S.n++;
    flash();
    if (CM.light) { CM.light.position.set(ctx.car.pos.x, 3, ctx.car.pos.z); CM.light.intensity = 40; CM.flashT = 0.15; }
    const t = { id: ++S.seq, town: cam.town, cam: cam.kind + (cam.key || cam.i), kind: cam.kind, where: cam.where, mph: Math.round(mph), limit: cam.limit, fine: cam.fine,
        at: Date.now(), t0: played(), stage: "new", refs: [], unread: false, photo: snapshot(cam, Math.round(mph)) };
    S.tickets.push(t);
    // (the pictures are capped: the oldest CLOSED ticket's photo goes first; tickets themselves stay a short list)
    const withPhoto = S.tickets.filter(x => x.photo);
    for (let i = 0; withPhoto.length - i > TUNE.photos; i++) { const o = withPhoto.find(x => !open(x) && x.photo) || withPhoto[i]; o.photo = ""; }
    while (S.tickets.length > 30) { const i = S.tickets.findIndex(x => !open(x)); if (i < 0) break; S.tickets.splice(i, 1); }
    saveSoon();
    stat("camFlashes");
    try { if (ctx.banter && ctx.banter.say && H.bubbleOk && H.bubbleOk(2.4)) ctx.banter.say(pick(L.flash)); } catch (e) { /* none */ }
    log("flash", { id: t.id, mph: t.mph, kind: cam.kind, town: cam.town });
    return t;
}

// ── the ladder (every new PLAYED day — City Hall's cityhall:day) ──
function addFine(t, what, amount) {
    const T = TAX();
    if (!T || !T.addLine) return null;
    const b = T.addLine("fine", what, amount, { ticket: t.id });
    t.refs.push(b.ref);
    return b;
}
function mailOut(t, stage) {
    t.unread = true; t.notice = stage;
    return true;
}
export function ladder() {
    const P = played();
    let mailed = 0, mailTown = null;
    for (const t of S.tickets) {
        if (!open(t)) continue;
        if (t.refs.length && owedOf(t) === 0) { t.stage = "paid"; t.unread = false; stat("camPaid"); log("paid", { id: t.id }); continue; }
        if (t.stage === "new" && P >= t.t0 + TUNE.mailAfter) {
            t.stage = "mailed"; t.dueAt = P + TUNE.dueAfter;
            addFine(t, `📸 Speed camera — ${t.where} (${t.mph} mph)`, t.fine);
            mailed += mailOut(t, "mailed"); mailTown = mailTown || t.town; log("mail", { id: t.id });
        } else if (t.stage === "mailed" && P >= t.dueAt) {
            t.stage = "late"; t.lateAt = P;
            addFine(t, `📸 Late fee — ${t.where}`, TUNE.lateFee);
            mailed += mailOut(t, "late"); mailTown = mailTown || t.town; log("late", { id: t.id });
        } else if (t.stage === "late" && P >= t.lateAt + TUNE.summonsAfter) {
            t.stage = "summons"; t.summonsAt = P;
            mailed += mailOut(t, "summons"); mailTown = mailTown || t.town; addCase(t); log("summons", { id: t.id });
        } else if (t.stage === "summons" && P >= t.summonsAt + TUNE.warrantAfter && !S.warrant) warrant("summons");
    }
    // (overdue ones only: a notice that just arrived isn't "unpaid" yet)
    const unpaid = S.tickets.filter(t => open(t) && (t.stage === "late" || t.stage === "summons") && owedOf(t) > 0).length;
    if (unpaid >= TUNE.warrantUnpaid && !S.warrant) warrant("unpaid");
    if (mailed) {
        try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: L.mailFrom(mailTown), emoji: "📬", color: "#455A64", msg: L.mailMsg(mailTown), thread: "City Hall", need: true, dur: 5 }); } catch (e) { /* no phone */ }
        // Ima's one line, when the day starts at the family house and she's at the door
        try { const ima = !(ctx.home && ctx.home.startAt) && ctx.places && ctx.places.home && ctx.places.home.people && ctx.places.home.people.ima; if (ima && ima.obj && ima.obj.visible && ctx.foot && ctx.foot.say) ctx.foot.say(ima.obj, L.ima, 3.2); } catch (e) { /* none */ }
    }
    saveSoon();
}
on("cityhall:day", () => { try { ladder(); } catch (e) { console.error("[cameras] ladder", e); } });
on("cityhall:paid", () => { try { for (const t of S.tickets) if (open(t) && t.refs.length && owedOf(t) === 0) { t.stage = "paid"; t.unread = false; stat("camPaid"); log("paid", { id: t.id }); } saveSoon(); } catch (e) { /* none */ } });

// ── ⚖️ the summons: a case in that town's Courtroom 2B ──
const added = new Set();
function addCase(t) {
    const C = ctx.civic && ctx.civic.courts, K = L.court;
    if (!C || !C.addCase) return false;
    const cid = "cameras:" + t.id;
    if (added.has(cid)) return true;
    added.add(cid);
    C.addCase({
        id: cid, town: t.town, oneADay: false, solo: true, priority: 7,
        title: K.title(t), label: K.label, docket: () => K.docket(t),
        available: () => { const x = S.tickets.find(y => y.id === t.id); return !!x && x.stage === "summons"; },
        cast: { borough: Object.assign({ seat: "respCounsel", model: "npcMan", colors: { Top: "#455A64", Bottom: "#263238" } }, K.counsel) },
        acts: { ruling: async () => { const r = rule(t.id); await say("THE JUDGE", r.dismissed ? K.dismissed : K.upheld(r.n, r.all), { emoji: "👨‍⚖️", color: "#7E57C2" }); } },
        hearings: [{ title: t.where, steps: [
            ["bailiff", K.open(t)], ["borough", pick(K.borough)], { do: "gavel" }, ["judge", K.judgeAsk], { do: "luluToStand" },
            { choose: { who: "lulu", text: "Your defence:", options: K.defence.map(d => ({ label: d.label, then: [["judge", d.judge]] })) } },
            { do: "ruling" }, { do: "gavel" }, { do: "luluToGallery" },
        ] }],
    });
    return true;
}
on("boot", () => setTimeout(() => { for (const t of S.tickets) if (t.stage === "summons") addCase(t); }, 0));
/** The court's ruling on ticket id: dismissed (TUNE.dismiss) → its lines waived; upheld → she pays what she has. */
export function rule(id, dismissed = null) {
    const t = S.tickets.find(x => x.id === id);
    if (!t || t.stage !== "summons") return { none: true };
    const won = dismissed != null ? !!dismissed : CM.force.dismiss != null ? !!CM.force.dismiss : Math.random() < TUNE.dismiss;
    let n = 0;
    if (won) { for (const r of t.refs) { const b = billOf(r); if (b && !b.paid) { b.paid = true; b.waived = true; } } t.stage = "dismissed"; }
    else {
        for (const r of t.refs) {
            const b = billOf(r);
            if (!b || b.paid) continue;
            const k = Math.min(b.amount, Math.max(0, Math.floor(wallet.coins)));
            if (k > 0 && wallet.spend(k)) { b.amount -= k; n += k; }
            if (b.amount <= 0) b.paid = true;
        }
        t.stage = owedOf(t) === 0 ? "paid" : "ruled";
    }
    t.unread = false;
    try { const T = TAX(); if (T && T.ledger) saveSoon(); } catch (e) { /* none */ }
    saveSoon();
    log("ruled", { id, dismissed: won, n });
    stat(won ? "camDismissed" : "camUpheld");
    return { dismissed: won, n, all: owedOf(t) === 0 };
}

// ── the bench warrant: law's own warrant file (a cop who gets a good look at her lights her up; only a judge clears it) ──
function warrant(why) {
    S.warrant = true;
    try { if (ctx.law && ctx.law.addWarrant) ctx.law.addWarrant(CHARGE.name); } catch (e) { /* no law */ }
    stat("camWarrants"); log("warrant", { why });
}
// arrested while the warrant's on file → it's served: the open tickets are closed (court clears the file)
on("law:arrest", () => {
    if (!S.warrant) return;
    S.warrant = false;
    for (const t of S.tickets) if (open(t) && t.stage !== "new") { for (const r of t.refs) { const b = billOf(r); if (b && !b.paid) { b.paid = true; b.waived = true; } } t.stage = "served"; t.unread = false; }
    saveSoon();
    log("served", {});
});
on("boot", () => { try { if (ctx.law && ctx.law.addCharge) ctx.law.addCharge(CHARGE); } catch (e) { /* no law */ } });

// ── the mailbox: where her day starts (Ima's, or her own house's) ──
const _v = new THREE.Vector3();
export function mailbox() {
    const H0 = ctx.home;
    if (!H0) return null;
    const st = H0.startAt;
    if (st && st.door) return { town: st.town, x: st.door.x, z: st.door.z, own: true };
    if (!H0.town) return null;
    // the family house's mailbox (house-local x 3.0, z 12.4 — decor/props.js), else the lot's door
    const h = H0.debug && H0.debug.home && H0.debug.home.house;
    if (h) { h.updateMatrixWorld(); const w = h.localToWorld(_v.set(3.0, 0, 12.4)); return { town: H0.town, x: w.x, z: w.z, own: false }; }
    const L0 = H0.lot, d = L0 && (L0.door || L0);
    return d && isFinite(d.x) ? { town: H0.town, x: d.x, z: d.z, own: false } : null;
}
export const unread = () => S.tickets.filter(t => t.unread);
const mailSpot = {
    r: 2.2, first: true, short: "MAIL",
    pos() {
        if (!unread().length || !(ctx.foot && ctx.foot.active && ctx.state === "footRun") || !inTown()) return null;
        const m = mailbox();
        return m && m.town === ctx.town.id ? { x: m.x, z: m.z } : null;
    },
    label() { return L.mailbox; },
    act() { read(); },
};
/** Open the notices waiting in the mailbox (a card: each photo, where, the speed, the fine, the pay-by). */
export function read() {
    const list = unread();
    if (!list.length) return false;
    const P = played();
    const html = `<div class="cam-notice">` + list.map(t => {
        const owed = owedOf(t);
        t.dueIn = t.dueAt != null ? Math.max(0, t.dueAt - P) : 0;
        return `<h2>${L.noticeTitle({ stage: t.stage })}</h2>${t.photo ? `<img alt="the camera's photo" src="${t.photo}">` : ""}<p><b>${L.noticeBody(t)}</b></p>`
            + (t.stage === "late" ? `<p>${L.lateLine(TUNE.lateFee)}</p>` : "") + (t.stage === "summons" ? `<p>${L.summonsLine}</p>` : `<p>${L.fineLine(t, owed)}</p>`);
    }).join("<hr>") + `</div>`;
    for (const t of list) t.unread = false;
    saveSoon();
    log("read", { n: list.length });
    const close = () => H.hideScreen && H.hideScreen();
    try { H.showScreen(html, [{ label: L.close, action: close }], { onBack: close, wide: true, cls: "cam-card" }); } catch (e) { console.error("[cameras] card", e); }
    return true;
}

// ── the objective line's lowest slot + the 📱 Map pin ──
function chipTick() {
    const want = unread().length > 0;
    if (!CM.chip && want) {
        CM.chip = document.createElement("div"); CM.chip.className = "day-chip cam-chip";
        H.hudSlot("left").appendChild(CM.chip);
        H.objective(CM.chip, { prio: H.OBJ.info, id: "cammail", icon: "📬" });
    }
    const txt = want ? L.chip : "";
    if (CM.chip && CM.chipTxt !== txt) { CM.chipTxt = txt; CM.chip.innerHTML = txt; CM.chip.classList.toggle("hidden", !txt); }
    try {
        const P = ctx.pins, ow = S.tickets.find(t => open(t) && owedOf(t) > 0), owe = !!ow;
        if (P && P.add && owe && !CM.pinRm) CM.pinRm = P.add({ id: "cameras", icon: "📸", label: L.pin, cat: "mine", town: ow.town, spot: "cityhall" });
        else if (CM.pinRm && !owe) { if (typeof CM.pinRm === "function") CM.pinRm(); else if (P && P.remove) P.remove("cameras"); CM.pinRm = null; }
    } catch (e) { /* no pins */ }
}

// ── wiring ──
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) CM.spotRm = ctx.foot.addSpot(mailSpot);
    CM.light = new THREE.PointLight("#ffffff", 0, 14, 1.6);
    ctx.scene.add(CM.light);
});
on("town:leave", () => dropCams());
on("title", () => dropCams());
const _p = { x: 0, z: 0 };
/** One camera check (tests call it with a speed: the same path the frame tick takes). */
export function check(cam, mph, x = ctx.car.pos.x, z = ctx.car.pos.z) {
    _p.x = x; _p.z = z;
    const inside = inZone(cam, x, z);
    if (inside) {
        if (cam.armed && mph > cam.trigger && live()(cam)) {
            const why = noTicket();
            if (!why) { cam.armed = false; return fire(cam, mph); }
            if (CM.why !== why) { CM.why = why; log("skip", { why }); }
        }
    } else if (!cam.armed && Math.hypot(x - cam.x, z - cam.z) > TUNE.rearm) cam.armed = true;
    return null;
}
hook("hud", dt => {
    try {
        if (CM.flashT > 0 && (CM.flashT -= dt) <= 0 && CM.light) CM.light.intensity = 0;
        if ((CM.t += dt) >= 0.25) { CM.t = 0; chipTick(); }
        if (!inTown()) return;
        if ((CM.t2 = (CM.t2 || 0) + dt) >= 0.5) { CM.t2 = 0; buildCams(); }
        // the school beacons blink in school hours (the camera's on)
        const on1 = schoolHours(), blink = on1 && (ctx.time % 1) < 0.5;
        for (const c of CM.cams) if (c.beacon) c.beacon.material.emissiveIntensity = blink ? 2.2 : 0;
        if (ctx.state !== "playing" || !ctx.car) return;
        const mph = Math.abs(ctx.car.speed || 0) * MPH;
        if (!CM.force.manual) for (const c of CM.cams) check(c, mph);        // (tests drive check() themselves)
    } catch (e) { console.error("[cameras] tick", e); }
});

ctx.cameras = {
    get cams() { return CM.cams.map(c => ({ kind: c.kind, town: c.town, where: c.where, limit: c.limit, trigger: c.trigger, fine: c.fine, x: c.x, z: c.z, armed: c.armed })); },
    tickets: () => S.tickets.map(t => Object.assign({ owed: owedOf(t) }, t)),
    unread: () => unread().length, mailbox, read, schoolHours,
    get warrant() { return S.warrant; },
    debug: { S, CM, buildCams, check, fire, ladder, rule, owedOf, inZone, addCase },
};
