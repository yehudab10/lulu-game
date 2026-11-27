// features/clothes/airdoor.js — 👜 MAISON DE GELT's front door at JFK (the owner, 2026-11-27: "I don't see why u can't have
// another agent work on the airport one" — allowed for the store's door only). A shopfront sign on Terminal 4½'s
// front, at the far end of the doors (landside frame f ≈ 88, the pavement in front of the facade), and a ✋ spot that
// walks her in (the same room engine as the town shops, dressed as "jfk"). Out again = the same spot on the pavement
// (no road door: the landside is the airport's own frame — foot simply keeps her where she stood).
// The airport gives one helper, ctx.airport.at(f, r); everything else is here. The sign is ONE plane (one draw call).
import * as THREE from "three";
import { ctx, on, emit, setState } from "../../core/ctx.js";
import { SHOPS } from "./data.js";
import { enterAs } from "./shop.js";

const AT = { f: 88, r: 201.6, signR: 202.93, y: 3.35 };     // (TERM.r0 = 203: the facade; the doors are at f −75 … 75)
/** The door is open (stage 3 landed with the relay's limited-piece counter). `?maison=0` shuts it (a quick off switch). */
export const OPEN = { on: new URLSearchParams(location.search).get("maison") !== "0" };
const D = { sign: null, at: null, outAt: null, outT: 0 };

function signMesh() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 160;
    const g = c.getContext("2d");
    g.fillStyle = "#111114"; g.fillRect(0, 0, 512, 160);
    g.strokeStyle = "#C9A227"; g.lineWidth = 8; g.strokeRect(8, 8, 496, 144);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#E8C766"; g.font = `700 58px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`; g.fillText(SHOPS.jfk.sign[0], 256, 64);
    g.fillStyle = "#F4EFE6"; g.font = `600 26px Fredoka, Arial, sans-serif`; g.fillText(SHOPS.jfk.sign[1], 256, 120);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: "#3A2A08", emissiveIntensity: 0.4 }));
    m.name = "MaisonDeGeltSign";
    return m;
}
/** Keep the sign on the terminal while the landside is built (it drops + rebuilds as she drives the lap). */
function tick() {
    const A = ctx.airport, on = OPEN.on && !!(A && A.at && A.on && ctx.scene);
    const sp = on ? A.at(AT.f, AT.signR) : null;
    if (!sp) { if (D.sign) { D.sign.removeFromParent(); } D.at = null; return; }
    if (!D.sign) D.sign = signMesh();
    if (D.sign.parent !== ctx.scene) ctx.scene.add(D.sign);
    D.sign.position.set(sp.x, AT.y, sp.z); D.sign.rotation.set(0, sp.h, 0);
    D.at = A.at(AT.f, AT.r);
}
setInterval(() => { try { tick(); } catch (e) { /* the airport's own business */ } }, 800);
on("title", () => { if (D.sign) D.sign.removeFromParent(); D.at = null; });

function doorPos() {
    if (!D.at || ctx.state !== "footRun" || !ctx.interiors || !ctx.interiors.clothesShop) return null;
    if (!(ctx.airport && ctx.airport.inside)) return null;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return null;
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (party && !roam) return null;
    const p = ctx.foot && ctx.foot.pos;
    if (!p) return null;
    if (D.outAt && ctx.time < D.outT && Math.hypot(p.x - D.outAt.x, p.z - D.outAt.z) < 4) return null;
    const d = Math.hypot(D.at.x - p.x, D.at.z - p.z);
    if (d < 24 && ctx.interiors.clothesShop.warm) ctx.interiors.clothesShop.warm();
    return d < 30 ? { x: D.at.x, z: D.at.z } : null;
}
export function enterMaison() {
    if (!D.at) return false;
    const at = { x: D.at.x, z: D.at.z };
    emit("shops:open", { place: "clothes", town: "jfk" });
    emit("stat", { id: "footInteriors", n: 1 });
    return enterAs("jfk", { exit: () => { setState("footRun", { resume: "interior" }); D.outAt = at; D.outT = ctx.time + 8; } });
}
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({ pos: () => doorPos(), r: 3.0, short: "MAISON", label: () => `👜 GO INTO ${SHOPS.jfk.name.toUpperCase()}`, act: () => enterMaison() });
});
export const airDebug = { D, AT, OPEN, tick, doorPos, enterMaison };
