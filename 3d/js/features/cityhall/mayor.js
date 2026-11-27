// features/cityhall/mayor.js — 📢 MIDWOOD'S NEW MAYOR (roadmap 31): a FICTIONAL communist-wannabe planner (name: data.js ›
// PEOPLESKY, one constant). Pure policy satire, tied to no real person; every edict lands on EVERYONE equally — the joke
// is a one-size-fits-all planner who doesn't know the neighbourhood he governs. The residents win small victories.
//   • TODAY'S EDICT (`todayEdict()`, the real day, skipping struck ones): Midwood's protests are about it (protest.js asks
//     `edictTopic()`), the notice board shows it, the Complaints window has a line for it (COMPLAINT_EXTRAS), the staff
//     roll their eyes (the secretary, now and then).
//   • COURTROOM 2B (Midwood): a case per edict (`ctx.civic.courts.addCase`): Lulu speaks for the neighbours → the edict is
//     STRUCK DOWN for good (S.struck). One hearing a real day; nothing pays.
//   • PICKLEMAN lost by 3 votes: his pickle stand outside Borough Hall, demanding a recount every day (✋, lines only).
// Coin rules unchanged: nothing here pays or charges (the complaint filing fee is the existing one, inside the ≤ 10 cap).
// No new pop-ups or texts: dialogue + bubbles through the budget only.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on, emit } from "../../core/ctx.js";
import { say } from "../../core/dialog.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { EDICTS, MAYOR31, PICKLEMAN as PK, EDICT_COURT as EC, BOARD } from "./data.js";
import { LOBBY_BUILDERS, COMPLAINT_EXTRAS } from "./lobby.js";
import { S, saveSoon, inTown, townId, stat } from "./state.js";

if (!S.struck || typeof S.struck !== "object") S.struck = {};
const pick = a => a[Math.floor(Math.random() * a.length)];
export const MY = { force: {}, log: [], stand: null, said: false };
function log(ev, d = {}) { MY.log.push(Object.assign({ ev }, d)); if (MY.log.length > 40) MY.log.shift(); }
const dayNo = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000) + (MY.force.dayOffset || 0); };

/** Today's edict (the real day; struck ones are skipped) — or null when every one is struck down. */
export function todayEdict() {
    if (MY.force.edict) return EDICTS.find(e => e.id === MY.force.edict) || null;
    const live = EDICTS.filter(e => !S.struck[e.id]);
    return live.length ? live[dayNo() % live.length] : null;
}
/** Midwood's protest topic today (protest.js): the edict, as a picket line in front of Borough Hall. */
export function edictTopic() {
    const e = todayEdict();
    return e ? { id: "edict:" + e.id, at: "cityhall", signs: e.signs, chant: e.chant, about: e.about } : null;
}
/** Strike an edict down (the court's ruling). → bool */
export function strike(id) {
    if (!id || S.struck[id]) return false;
    S.struck[id] = Date.now(); saveSoon();
    stat("cityhallEdictsStruck");
    emit("cityhall:edict", { phase: "struck", id });
    log("struck", { id });
    return true;
}

// ── in Borough Hall: the notice board, the Complaints window, the staff ──
LOBBY_BUILDERS.push((rt, B, I) => {
    if (I.town !== "midwood") return;
    const board = rt.hots.find(h => h.id === "board");
    if (board) {
        const prev = board.action;
        board.action = async r => {
            const e = todayEdict(), struck = EDICTS.filter(x => S.struck[x.id]);
            if (Math.random() < 0.55 || MY.force.board) {
                const line = e ? e.notice : struck.length ? MAYOR31.struckNotice(pick(struck)) : pick(BOARD.midwood);
                return r.say("The notice board", line, { emoji: "📜", color: "#8E2B2B" });
            }
            return prev(r);
        };
    }
    const sec = rt.hots.find(h => h.id === "secretary");
    if (sec) {
        const prev = sec.action;
        sec.action = r => (Math.random() < 0.4 ? r.say(String(typeof sec.label === "function" ? sec.label() : sec.label).replace(/^💬 /, ""), pick(MAYOR31.staff), { emoji: "🙄", person: r.byId.secretary, color: "#6A1B9A" }) : prev(r));
    }
});
COMPLAINT_EXTRAS.push(town => {
    const e = town === "midwood" ? todayEdict() : null;
    return e ? [{ opt: MAYOR31.complaint.opt, reply: MAYOR31.complaint.reply(e) }] : null;
});

// ── ⚖️ Courtroom 2B: strike today's edict down ──
const added = new Set();
export function addEdictCase() {
    const C = ctx.civic && ctx.civic.courts, e = todayEdict();
    if (!C || !C.addCase || !e) return false;
    const cid = "cityhall:edict:" + e.id;
    if (added.has(cid)) return true;
    added.add(cid);
    C.addCase({
        id: cid, town: "midwood", oneADay: true, solo: true, priority: 5,
        title: EC.title(e), label: EC.label, docket: () => EC.docket(e),
        available: () => !S.struck[e.id] && todayEdict() === e,
        cast: { people: Object.assign({ seat: "respCounsel", model: "npcMan", colors: { Top: "#8E2B2B", Bottom: "#263238" } }, EC.counsel) },
        acts: {
            ruling: async H => {
                const ok = strike(e.id);
                H.struck = ok;
                await say("THE JUDGE", EC.ruling(e), { emoji: "👨‍⚖️", color: "#7E57C2" });
            },
        },
        hearings: [{
            title: e.title,
            steps: [
                ["bailiff", EC.open(e)],
                ["people", pick(EC.people)],
                { do: "gavel" },
                ["judge", EC.judgeAsk],
                { do: "luluToStand" },
                { choose: { who: "lulu", text: "Your argument:", options: EC.defence.map(d => ({ label: d.label, then: [["judge", d.judge]] })) } },
                { do: "ruling" },
                { do: "gavel" },
                ["lulu", EC.lulu],
                { do: "luluToGallery" },
            ],
        }],
    });
    log("case", { id: e.id });
    return true;
}
on("boot", () => setTimeout(addEdictCase, 0));
on("town:enter", () => addEdictCase());
on("cityhall:edict", () => addEdictCase());

// ── 🥒 Pickleman's pickle stand outside Borough Hall ──
let bakedMat = null;
function bake(parts) {
    const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color();
    for (const b of parts) {
        const g = b.cyl ? new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 10) : new THREE.BoxGeometry(b.w, b.h, b.d);
        e.set(0, 0, 0); q.setFromEuler(e); p.set(b.x, b.y, b.z);
        g.applyMatrix4(m.compose(p, q, sc));
        c.set(b.color);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        geos.push(g.index ? g.toNonIndexed() : g);
    }
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    return new THREE.Mesh(geo, bakedMat);
}
function signMesh(lines) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96; const g = cv.getContext("2d");
    g.fillStyle = "#FFFDE7"; g.fillRect(0, 0, 256, 96); g.fillStyle = "#2E7D32"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "700 30px Fredoka, Arial, sans-serif"; g.fillText(lines[0], 128, 32, 240);
    g.font = "700 20px Fredoka, Arial, sans-serif"; g.fillText(lines[1], 128, 72, 240);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.49), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    mesh.userData.tex = tex;
    return mesh;
}
/** Put the stand up (Midwood, near Borough Hall's door). → bool */
export function standStart() {
    if (MY.stand || !inTown() || townId() !== "midwood") return false;
    const sp = ctx.town.spot && ctx.town.spot("cityhall");
    if (!sp || sp.nx == null) return false;
    const x = sp.x + sp.ux * 15.5 + sp.nx * 1.6, z = sp.z + sp.uz * 15.5 + sp.nz * 1.6;
    const g = new THREE.Group(); g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(sp.nx, sp.nz);       // (local +z faces the street)
    g.add(bake([
        { w: 1.5, h: 0.9, d: 0.7, x: 0, y: 0.45, z: 0, color: "#6D4C41" }, { w: 1.6, h: 0.06, d: 0.8, x: 0, y: 0.93, z: 0, color: "#8D6E63" },
        { cyl: true, w: 0.34, h: 0.45, x: -0.45, y: 1.18, z: 0.05, color: "#9CCC65" }, { cyl: true, w: 0.34, h: 0.45, x: 0.05, y: 1.18, z: 0.05, color: "#AED581" },
        { cyl: true, w: 0.36, h: 0.06, x: -0.45, y: 1.43, z: 0.05, color: "#C62828" }, { cyl: true, w: 0.36, h: 0.06, x: 0.05, y: 1.43, z: 0.05, color: "#C62828" },
        { w: 0.05, h: 1.4, d: 0.05, x: 0.65, y: 1.6, z: -0.2, color: "#9E9E9E" },
    ]));
    const sign = signMesh(["RECOUNT NOW!", "lost by 3 · free pickle"]);
    sign.position.set(0.65, 2.15, -0.18); g.add(sign);
    ctx.scene.add(g);
    const st = MY.stand = { x, z, g, sign, p: null, t: 0, rm: null };
    ensureModels(["npcMan"]).then(() => {
        if (MY.stand !== st || !models.npcMan) return;
        st.p = spawnPerson("npcMan", { colors: PK.colors });
        const w = g.localToWorld(new THREE.Vector3(-0.1, 0, -0.75));
        st.p.obj.position.set(w.x, 0, w.z); st.p.obj.rotation.y = g.rotation.y;
        ctx.scene.add(st.p.obj);
    }).catch(() => {});
    if (ctx.foot && ctx.foot.addSpot) st.rm = ctx.foot.addSpot(standSpot);
    log("stand", {});
    return true;
}
const standSpot = {
    r: 2.4, short: "RECOUNT",
    pos() { const st = MY.stand; return st && ctx.foot && ctx.foot.active && ctx.state === "footRun" ? { x: st.x, z: st.z } : null; },
    label() { return PK.spot; },
    act() { talkPickleman(); },
};
let line = 0;
async function talkPickleman() {
    if (ctx.dialogOpen) return;
    stat("cityhallRecounts");
    log("talk", {});
    await say(PK.name, PK.lines[(line++) % PK.lines.length], { emoji: PK.emoji, color: "#2E7D32" });
}
export function standStop() {
    const st = MY.stand;
    if (!st) return;
    MY.stand = null;
    if (st.rm) st.rm();
    if (st.p && st.p.obj.parent) st.p.obj.parent.remove(st.p.obj);
    if (st.g.parent) st.g.parent.remove(st.g);
    st.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== bakedMat) o.material.dispose(); } });
    st.sign.userData.tex.dispose();
}
/** ~every frame from index.js. */
export function mayorTick(dt) {
    const want = inTown() && townId() === "midwood" && ctx.state !== "interior";
    if (!want) { if (MY.stand && (!inTown() || townId() !== "midwood")) standStop(); return; }
    if (!MY.stand) { standStart(); return; }
    const st = MY.stand, lp = ctx.foot && ctx.foot.active && ctx.foot.pos;
    if (ctx.paused || ctx.state !== "footRun") return;
    st.t += dt;
    if (st.p) st.p.update(dt, { talk: st.t % 7 < 2.5, wave: st.t % 7 > 5.5 });
    if (lp && !MY.said && Math.hypot(lp.x - st.x, lp.z - st.z) < 16) {
        MY.said = true;
        try { if (st.p && ctx.foot.say && Math.random() < 0.7) ctx.foot.say(st.p.obj, pick(PK.hello), 2.4); } catch (e) { /* none */ }
    }
}
on("town:enter", () => { MY.said = false; });
on("town:leave", () => standStop());
on("title", () => standStop());
