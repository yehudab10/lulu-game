// features/realestate/office.js — 🏘️ THE REALTOR'S OFFICE (one per town, a shopfront on the high street): the
// realtor at her desk (a character: the patter, "cozy" = tiny, the up-and-coming block), today's LISTINGS board on
// the wall (✋ → pick one → her pitch → 📍 show me where / 💰 buy it now), a waiting area. Lines + buying only.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { defineInterior, pick, pool } from "../interiors/engine.js";
import { rooms, W, D } from "./rooms.js";
import { REALTORS, OFFICE, PATTER } from "./data.js";

let API = null;                     // index.js: { listings(), valueOf(rec), pitch(rec) → [lines], buy(rec, rt), pin(rec), owns(), townId() }
export function bindOffice(api) { API = api; }

const patter = pool(PATTER), talk = pool(OFFICE.talk);
const fmt = n => Math.round(n).toLocaleString("en-US");
export const realtorOf = town => REALTORS[town] || REALTORS.lakewood;

export const OFFICE_DEF = defineInterior({
    id: "realty", name: "the realtor's", short: "the office", emoji: "🏘️",
    title: "🏘️ GOLD STANDARD REALTY", tagline: "we sell cozy",
    model: "homesKit", models: ["npcWoman", "npcMan"], music: "../story-relax.mp3",
    light: "indoor", cam: { dist: 6.6, height: 5.2, lookY: 0.8, clampX: 2.2 }, walkSpeed: 3.5,
    build, tick,
});
/** Dress the office for the town she's in (the firm's name on the chip). */
export function nameOffice(town) {
    const R = realtorOf(town);
    OFFICE_DEF.name = R.firm; OFFICE_DEF.title = `🏘️ ${R.firm.toUpperCase()}`; OFFICE_DEF.tagline = R.sign[1].split("·").slice(1).join("·").trim();
    if (ctx.interiors.realty) ctx.interiors.realty.name = R.firm;
}

function boardTex(rows, title) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 384;
    const g = c.getContext("2d");
    g.fillStyle = "#2E3B2F"; g.fillRect(0, 0, 512, 384);
    g.strokeStyle = "#B08D57"; g.lineWidth = 14; g.strokeRect(7, 7, 498, 370);
    g.fillStyle = "#FFE082"; g.font = "bold 34px sans-serif"; g.textAlign = "center"; g.fillText(title, 256, 50);
    g.textAlign = "left"; g.font = "bold 21px sans-serif";
    rows.slice(0, 8).forEach((r, i) => {
        const y = 92 + i * 36;
        g.fillStyle = "#FFFFFF"; g.fillText(r[0], 28, y);
        g.fillStyle = "#A5D6A7"; g.textAlign = "right"; g.fillText(r[1], 486, y); g.textAlign = "left";
    });
    if (!rows.length) { g.fillStyle = "#FFFFFF"; g.font = "bold 24px sans-serif"; g.fillText("Everything's sold! Come back tomorrow.", 40, 190); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function build(rt) {
    const town = API ? API.townId() : "lakewood", R = realtorOf(town);
    const V = rt.data.V = { said: false };
    rt.root.visible = false;
    const B = rooms(rt, 2, { floors: ["#B58457", "#8D6E63"], walls: ["#ECE3D2", "#E3D7C3"], door: 0, doorDx: 1.4 });
    const [OF, WA] = B.cx, bz = -D / 2;
    // the office: her desk, two client chairs, a bookcase, the plant, the LISTINGS board
    B.put("Desk", OF - 0.6, -1.0, 0, 1.6, 0.8);
    B.put("Chair", OF - 0.6, -1.85, 0);
    B.put("Chair", OF - 1.1, -0.1, Math.PI); B.put("Chair", OF - 0.1, -0.1, Math.PI);
    B.put("Bookcase", OF - 2.35, bz + 0.3, 0, 1.0, 0.45);
    B.put("Plant", OF + 2.55, bz + 0.45, 0, 0.4, 0.4);
    B.put("FloorLamp", OF - 2.4, 1.6, 0, 0.3, 0.3);
    const list = API ? API.listings() : [];
    V.list = list;
    const tex = rt.own(boardTex(list.map(r => [`${r.address} · ${r.label}`, `${fmt(API.valueOf(r))} 💰`]), "TODAY'S LISTINGS"));
    const board = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(2.4, 1.8)), rt.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })));
    board.position.set(OF + 1.25, 1.55, bz + 0.01); rt.add(board);
    // a "SOLD!" sign as decor + her name over the desk
    const nameTex = (() => { const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d");
        g.fillStyle = R.signBg; g.fillRect(0, 0, 512, 96); g.fillStyle = R.signFg[0]; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(R.firm.toUpperCase(), 256, 50);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const np = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(1.7, 0.32)), rt.own(new THREE.MeshStandardMaterial({ map: rt.own(nameTex), roughness: 0.7 })));
    np.position.set(OF - 0.95, 2.3, bz + 0.01); rt.add(np);
    // the waiting area: a couch, a coat rack, a coffee table with brochures, a framed picture, the "coffee machine"
    B.put("Couch", WA - 0.4, bz + 0.75, 0, 2.2, 0.9);
    B.put("CoffeeTable", WA - 0.4, 0.3, 0, 1.1, 0.6);
    B.put("CoatRack", WA + 2.3, 1.7, 0, 0.4, 0.4);
    const pic = (() => { const o = B.put("Picture", WA + 1.6, bz + 0.02, 0); o.position.y = 1.6; return o; })();
    void pic;
    B.box(0.5, 1.1, 0.45, "#455A64", WA + 2.2, 0.55, bz + 0.35); B.box(0.36, 0.24, 0.3, "#212121", WA + 2.2, 1.22, bz + 0.33);
    B.col("coffee", WA + 1.9, WA + 2.5, bz, bz + 0.6);
    for (let k = 0; k < 3; k++) B.box(0.28, 0.02, 0.2, ["#FFCDD2", "#C8E6C9", "#BBDEFB"][k], WA - 0.7 + k * 0.3, 0.47 + k * 0.021, 0.3);

    // the realtor at the desk
    try {
        rt.person("realtor", R.name === "Mendel Brick" ? "npcMan" : "npcWoman", { x: OF - 0.6, z: -1.75, ry: 0 }, { name: R.name, colors: R.colors, pose: {} });
        rt.hot({ id: "realtor", x: OF - 0.6, z: -0.2, who: "realtor", r: 1.5, label: () => `💬 Talk to ${R.name.split(" ")[0]}`, action: talkRealtor });
    } catch (e) { console.warn("[realestate] realtor", e); }
    rt.hot({ id: "board", x: OF + 1.25, z: bz + 0.95, r: 1.3, label: "📋 Today's listings", action: openBoard });
    rt.hot({ id: "coffee", x: WA + 2.2, z: bz + 1.0, r: 1.0, label: "☕ The coffee machine", action: r => r.say("Lulu", pick(["It's a coffee machine. It makes a noise. It does NOT make coffee.", "*gurgle* …that's all it does. Gurgle.", "There's a sign: 'COFFEE FOR CLIENTS WHO SIGN'. Rude."]), { emoji: "☕" }) });
    rt.hot({ id: "brochures", x: WA - 0.4, z: 1.0, r: 1.2, label: "📰 The brochures", action: r => r.say("A brochure", pick(["'LIVE THE DREAM — 2 BR, 1 BA, 0 PARKING'", "'CHARMING FIXER-UPPER (needs: everything)'", "'STEPS FROM THE SHUL!' (412 steps. They counted.)", "'MOTIVATED SELLER!!!' (the seller is a goose)"]), { emoji: "📰" }) });
    // Lulu: in through the front door
    rt.lulu.obj.position.set(B.doorX, 0, D / 2 - 0.9);
    rt.lulu.obj.rotation.y = Math.PI;
    rt.wait(0.8).then(() => {
        if (rt.disposed || !rt.byId.realtor) return;
        rt.bubble(API && API.owns() ? pick(OFFICE.owns) : pick(OFFICE.hello), rt.byId.realtor.p.obj, 3.4);
    });
}

async function talkRealtor(rt) {
    const town = API ? API.townId() : "lakewood", R = realtorOf(town), who = rt.byId.realtor;
    const line = API && API.owns() && Math.random() < 0.4 ? pick(OFFICE.owns) : Math.random() < 0.5 ? patter() : talk();
    await rt.say(R.name, line, { emoji: R.emoji, person: who });
    const mine = API && API.owns();
    const opts = ["📋 Show me what's for sale"].concat(mine ? ["🔑 My places — sell / a tenant"] : [], ["💬 Just saying hi"]);
    const i = await rt.choose(R.name, "So! What can I do for you?", opts, { emoji: R.emoji, person: who });
    if (i === 0) return openBoard(rt);
    if (mine && i === 1) return API.myPlaces(rt, who, R);
}

/** The board: today's listings → one → her pitch → show me / buy. */
async function openBoard(rt) {
    const town = API ? API.townId() : "lakewood", R = realtorOf(town), who = rt.byId.realtor;
    const list = rt.data.V.list || [];
    if (!list.length) { await rt.say(R.name, "Everything's SOLD! I'm that good. Come back tomorrow, new listings every day.", { emoji: R.emoji, person: who }); return; }
    const opts = list.slice(0, 7).map(r => `🏠 ${r.address} — ${r.label}, ${fmt(API.valueOf(r))} 💰`);
    opts.push("✖ Never mind");
    const i = await rt.choose(R.name, "Today's beauties. Every one a gem. Some gems are… cozier.", opts, { emoji: R.emoji, person: who });
    const rec = i >= 0 && i < list.length && i < 7 ? list[i] : null;
    if (!rec) return;
    for (const l of API.pitch(rec).slice(0, 2)) { await rt.say(R.name, l, { emoji: R.emoji, person: who }); if (rt.disposed) return; }
    const j = await rt.choose(R.name, `${rec.address}. ${fmt(API.valueOf(rec))} coins. A STEAL.`, ["📍 Show me where it is", `💰 Buy it now — ${fmt(API.valueOf(rec))} 💰`, "‹ Back"], { emoji: R.emoji, person: who });
    if (j === 0) { API.pin(rec); await rt.say(R.name, "There — on your phone! Walk over, the sign's on the lawn. I'll meet you there. I'm FAST.", { emoji: R.emoji, person: who }); }
    else if (j === 1) await API.buy(rec, { rt, who, realtor: R });
}

function tick(rt, dt) { void rt; void dt; }
export { W };
