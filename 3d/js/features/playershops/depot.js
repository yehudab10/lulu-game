// features/playershops/depot.js — 📦 FELDMAN'S WHOLESALE DEPOT: a pallet stand in every rest area's truck lot, beside the
// 🅿️ booth (features/parking/course.js's frame). On foot, ✋: Mr. Feldman sells boxes for the kinds of shop she runs —
// goods by the box, ingredients for the baked ones — into HER CAR, as many as it holds (CARRY in data.js: Ima's minivan
// 12, most cars 6, a Mazelati 2). Every box is two presses (pick it, then ✅ load it). Coins only go out here.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { say, choose } from "../../core/dialog.js";
import { liveCourses, toWorld, COURSE } from "../parking/course.js";
import { DEPOT, GOODS, KINDS, BAKE } from "./data.js";

const fmt = n => Math.round(n).toLocaleString("en-US");
const who = { emoji: DEPOT.emoji, color: "#795548" };
/** Where the stand is in a course's frame (local X, Z): past the booth, on the lot. */
const AT = { x: COURSE.booth.x + 4.2, z: COURSE.booth.z + 0.6 };
const D = { list: [], near: null, busy: false, group: null, at: null };
let API = null;
export function bindDepot(api) { API = api; }

/** What one box of good g costs at the depot (baked: the ingredients for one batch). */
export const boxCost = g => (GOODS[g].baked ? GOODS[g].cost * BAKE.perBatch : GOODS[g].cost * GOODS[g].box);

function stand() {
    const g = new THREE.Group(); g.name = "PS_Depot";
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const box = (w, h, d, c, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; g.add(m); return m; };
    box(2.4, 0.14, 1.4, "#8D6E63", 0, 0.07, 0);
    [[-0.6, 0.38, -0.2], [0.1, 0.38, 0.2], [0.75, 0.38, -0.25], [-0.25, 0.98, 0], [0.45, 0.98, 0.05]].forEach(([x, y, z], i) => box(0.6, 0.48, 0.5, ["#C8A165", "#BF9A5E", "#D1AB70"][i % 3], x, y, z, i * 0.17));
    box(0.08, 2.4, 0.08, "#455A64", -1.4, 1.2, -0.6);
    const c = document.createElement("canvas"); c.width = 512; c.height = 192;
    const x = c.getContext("2d");
    x.fillStyle = "#4E342E"; x.fillRect(0, 0, 512, 192); x.strokeStyle = "#FFE082"; x.lineWidth = 8; x.strokeRect(6, 6, 500, 180);
    x.fillStyle = "#FFE082"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = "bold 50px sans-serif"; x.fillText("📦 FELDMAN'S", 256, 66);
    x.fillStyle = "#FFFFFF"; x.font = "bold 34px sans-serif"; x.fillText("WHOLESALE · shop owners only", 256, 136);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.75), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.DoubleSide }));
    sg.position.set(-1.4, 2.55, -0.6); g.add(sg);
    return g;
}
/** Keep the stand at the live course nearest her (one stand; cheap). */
export function depotTick() {
    const list = (() => { try { return liveCourses(); } catch (e) { return []; } })();
    const p = (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
    let best = null, bd = 400;
    if (p) for (const c of list) { const w = toWorld(c, AT.x, AT.z, {}); const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd) { bd = d; best = c; } }
    if (!best || ctx.town && ctx.town.active) { if (D.group) { D.group.removeFromParent(); } D.at = null; return; }
    if (!D.group) D.group = stand();
    if (D.at !== best) {
        const w = toWorld(best, AT.x, AT.z, {});
        D.group.position.set(w.x, 0, w.z);
        D.group.rotation.y = best.phi;
        D.at = best;
    }
    if (!D.group.parent && ctx.scene) ctx.scene.add(D.group);
}
const spotOf = c => toWorld(c, AT.x - 1.6, AT.z, {});
export const depotSpot = {
    r: 2.6, short: "DEPOT",
    pos() {
        D.near = null;
        if (!D.at || ctx.state !== "footRun" || !(ctx.foot && ctx.foot.active && ctx.foot.phase === "walk")) return null;
        const s = spotOf(D.at), p = ctx.foot.pos;
        if (Math.hypot(s.x - p.x, s.z - p.z) > 2.6) return null;
        D.near = s;
        return s;
    },
    label() { return D.near ? `📦 FELDMAN'S WHOLESALE — car: ${API ? API.carBoxes() : 0} of ${API ? API.carCap() : 6} boxes` : null; },
    act() { if (D.near) talk(); },
};
async function talk() {
    if (D.busy || !API) return;
    D.busy = true;
    try {
        const kinds = [...new Set(API.mine().map(s => s.kind))];
        if (!kinds.length) { await say(DEPOT.who, "Wholesale is for shop owners, sweetheart. Get a shop first — FOR LEASE signs in town. Then come see me.", who); return; }
        let n = 0;
        while (n < DEPOT.perVisit) {
            const goods = [...new Set(kinds.flatMap(k => KINDS[k].goods))];
            const room = API.carCap() - API.carBoxes();
            if (room <= 0) { await say(DEPOT.who, "Your car's full. I could tie a box to the roof, but then I'd have to watch you drive.", who); return; }
            const rows = goods.map(g => `${GOODS[g].emoji} ${GOODS[g].baked ? "Ingredients: " + GOODS[g].name + " (bakes " + BAKE.perBatch + ")" : GOODS[g].name + " ×" + GOODS[g].box}${GOODS[g].jfk ? " — off the JFK truck" : ""} — ${fmt(boxCost(g))} 💰`);
            const i = await choose(DEPOT.who, `Room for ${room} more box${room === 1 ? "" : "es"} in your car. What'll it be?`, rows.concat(["✖ That's all"]), who);
            if (i < 0 || i >= goods.length) return;
            const g = goods[i], cost = boxCost(g);
            if (wallet.coins < cost) { await say(DEPOT.who, `That's ${fmt(cost)}. You've got ${fmt(wallet.coins)}. I don't do credit. I did credit once. Never again.`, who); continue; }
            const j = await choose(DEPOT.who, `One box: ${GOODS[g].emoji} ${GOODS[g].name}. ${fmt(cost)} coins.`, [`✅ Load it — ${fmt(cost)} 💰`, "‹ Back"], who);
            if (j !== 0) continue;
            if (!wallet.spend(cost)) continue;
            if (!API.loadCar(g, !!GOODS[g].baked)) { wallet.add(cost); await say(DEPOT.who, "It won't fit. Physics. I don't make the rules.", who); return; }
            n++;
        }
        await say(DEPOT.who, "That's your limit for today's visit. Drive safe. The boxes aren't strapped down.", who);
    } finally { D.busy = false; }
}
export { D as DEPOT_STATE, talk as depotTalk };
