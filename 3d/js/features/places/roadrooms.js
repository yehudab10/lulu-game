// features/places/roadrooms.js — the INSIDES of the roadside places (roadside.js): four small rooms on the interiors
// engine, built from boxes (no Blender set — like features/shops' rooms): Trooper Post 7's front office (+ its first-aid room) (Sgt. Feldman's
// desk, the two-bunk holding cell, the coffee, the MOST WANTED board), the Highway Traffic Court (a trailer: wood panelling,
// the judge's bench, folding chairs, a golf bag), the Hatzalah garage (the ambulance, the cot, the radio, Yossi) and
// the Weigh Station (Officer Dot, a one-bunk lock-up, Judge Pfeffer on a video screen) and Doc-in-a-Box next to it (the desk, the chairs, a vending machine that only hums). Walk-in visits: lines only, nothing pays.
import * as THREE from "three";
import { models } from "../../models.js";
import { defineInterior, pool } from "../interiors/engine.js";
import { canvasPlane, drawLines, tone } from "../interiors/fx.js";

const DOOR = { x: 3.2, z: 3.0 };
function roomKit() {
    const g = new THREE.Group(); g.name = "RoadsideRoomKit";
    const d = new THREE.Object3D(); d.name = "Spot_door"; d.position.set(DOOR.x, 0, DOOR.z); d.rotation.y = Math.PI; g.add(d);
    const l = new THREE.Object3D(); l.name = "Spot_lulu"; l.position.set(DOOR.x, 0, DOOR.z - 0.9); l.rotation.y = Math.PI; g.add(l);
    return g;
}
models.roadside_roomkit = models.roadside_roomkit || roomKit();
const W = 10, D = 7.2, WALL = 3.0;

/** The rooms, as data: walls / floor, furniture boxes [colour, x0, x1, y0, y1, z0, z1], a board, the people, the hotspots. */
const ROOMS = {
    roadsideTrooper: {
        name: "Trooper Post 7", short: "the trooper post", emoji: "🚔", title: "🚔 TROOPER POST 7 — STATE POLICE", tagline: "Sunflower seeds · patience · paperwork",
        wall: "#cfc6ae", trim: "#455a64", floor: ["#9e9e9e", "#b0b0b0"], sky: "#dcd6c4", music: "../story-relax.mp3",
        boxes: [["#6d4c41", -2.6, 0.6, 0, 1.0, -1.9, -1.1], ["#eceff1", -2.7, 0.7, 1.0, 1.06, -2.0, -1.0],                 // the desk
            ["#78909c", -4.9, -4.8, 0, 2.6, -3.6, -0.6], ["#78909c", -4.9, -3.0, 2.5, 2.6, -0.65, -0.55],                     // the cell's frame
            ["#8d6e63", -4.7, -3.2, 0.4, 0.5, -3.5, -2.6], ["#8d6e63", -4.7, -3.2, 1.3, 1.4, -3.5, -2.6],                    // two bunks
            ["#212121", 3.6, 4.4, 0, 1.0, -3.4, -2.8], ["#d32f2f", 3.7, 4.3, 1.0, 1.4, -3.3, -2.9]],                         // the coffee machine
        bars: { x0: -4.9, x1: -2.9, z: -0.6 },
        board: { x: 1.6, y: 1.8, z: -3.55, w: 1.8, h: 1.1, bg: "#fff8e1", fg: "#bf360c", text: "MOST WANTED\nthe guy who\ndrives 41 in\nthe left lane" },
        people: [["sarge", "copPerson", { x: -1.0, z: -2.7, ry: 0 }, { name: "Sgt. Feldman" }],
            ["lenny", "npcMan", { x: -3.9, z: -2.0, ry: Math.PI / 2 }, { name: "Lenny", pose: { sit: true }, y: 0.5, colors: { Top: "#ff7043", Bottom: "#5d4037" }, faceLulu: false, collide: false }]],
        cols: [[-2.7, 0.7, -2.0, -1.0], [-5, -2.9, -3.6, -0.5], [3.5, 4.5, -3.5, -2.7]],
        hots: [
            { id: "sarge", x: -1.0, z: -0.6, who: "sarge", label: "🚔 Talk to Sgt. Feldman", emoji: "🌻", color: "#263238", lines: [
                "*crunch* Sunflower seeds. Forty years. Never once got a ticket. *crunch*",
                "You know what the fastest car on this highway is? The one that gets home. Slow down, kiddo.",
                "The road's a loop. Whatever you're rushing to, it'll come round again in sixteen kilometres.",
                "I wrote a ticket once in '98. Still feel bad about it. Guy was going 66.",
                "Coffee's free. It's free because it's terrible.",
                "We got a two-bunk cell. Lenny's got the top. Don't ask Lenny about the top."] },
            { id: "lenny", x: -2.6, z: -0.2, who: "lenny", label: "🛏️ Talk to Lenny (in the cell)", emoji: "🧔", color: "#e65100", lines: [
                "Double-parked. In THREE states. It's a record. Ask anyone.",
                "I'm not in here, I'm 'between drives'.",
                "The bunk's great. Better than my couch. Don't tell my wife.",
                "Feldman lets me do the crossword. I'm stuck on 'speed limit', six letters.",
                "They let me out Thursdays for bingo. I always win. I think they rig it. For me."] },
            { id: "coffee", x: 4.0, z: -2.2, label: "☕ The coffee machine", emoji: "☕", color: "#5d4037", lines: ["*gurgle* It smells like a tyre. A warm tyre.", "A sticky note: 'DECAF IS A LIE'.", "It's been brewing since the Clinton administration."] },
            { id: "board", x: 1.6, z: -2.6, label: "📋 The MOST WANTED board", emoji: "📋", color: "#bf360c", lines: ["#2: Whoever keeps honking at the geese.", "#3: A minivan with 'BABY ON BOARD' and no baby. Suspicious.", "#1 is a photo of a very slow truck. 'WANTED: TO MOVE OVER'."] },
        ],
    },
    roadsideCourt: {
        name: "the Highway Traffic Court", short: "the traffic court", emoji: "⚖️", title: "⚖️ HIGHWAY TRAFFIC COURT — (IT'S A TRAILER)", tagline: "Judge Kessler presiding · tee time at 2",
        wall: "#a1887f", trim: "#5d4037", floor: ["#6d4c41", "#795548"], sky: "#e8d9c4", music: "../story-relax.mp3",
        boxes: [["#4e342e", -2.0, 2.0, 0, 1.3, -3.2, -2.2], ["#3e2723", -2.1, 2.1, 1.3, 1.38, -3.3, -2.1],                    // the bench
            ["#90a4ae", -3.4, -1.8, 0.45, 0.5, 0.4, 0.9], ["#90a4ae", -1.0, 0.6, 0.45, 0.5, 0.4, 0.9], ["#90a4ae", 1.4, 3.0, 0.45, 0.5, 0.4, 0.9],   // folding chairs
            ["#1b5e20", 2.6, 3.0, 0, 1.0, -3.3, -2.9], ["#cfd8dc", 2.65, 2.95, 1.0, 1.3, -3.25, -2.95],                   // the golf bag
            ["#c62828", -4.6, -4.5, 0, 2.2, -3.4, -3.3]],
        board: { x: -3.2, y: 1.9, z: -3.55, w: 1.6, h: 0.9, bg: "#fffde7", fg: "#4e342e", text: "TODAY'S DOCKET\n1. you\n2. lunch\n3. golf" },
        people: [["judge", "homesDad", { x: 0, z: -2.7, ry: 0 }, { name: "Judge Kessler", colors: { Top: "#212121", Bottom: "#212121", Hair: "#e0e0e0" }, y: 0.4 }],
            ["clerk", "npcWoman", { x: -3.6, z: -1.6, ry: Math.PI / 2 }, { name: "Rhoda, the clerk", colors: { Top: "#7e57c2", Hair: "#ffcc80" }, faceLulu: false, collide: false }]],
        cols: [[-2.1, 2.1, -3.3, -2.0], [2.5, 3.1, -3.4, -2.8]],
        hots: [
            { id: "judge", x: 0, z: -1.2, who: "judge", label: "⚖️ Talk to Judge Kessler", emoji: "⚖️", color: "#212121", lines: [
                "I've got a tee time at two. Whatever you did, it's fine, it's DISMISSED — no it isn't, sit down.",
                "This used to be a real courthouse. Then the road became a loop and we got a trailer. I love the trailer.",
                "Order! …Sorry, habit. There's nobody here. Order anyway.",
                "My handicap is eleven. My patience is about four.",
                "The law is the law. The golf is the golf. Today, the golf."] },
            { id: "clerk", x: -2.6, z: -1.0, who: "clerk", label: "🗂️ Talk to Rhoda, the clerk", emoji: "🗂️", color: "#7e57c2", lines: [
                "Forms are in the drawer. The drawer is in the bathroom. Don't ask.",
                "Fines go in the coffee can. It's a VERY official coffee can.",
                "He's a good judge. Fair. Fast. Mostly fast.",
                "We had a tornado drill last week. The whole court went to Wendy's."] },
            { id: "bag", x: 2.8, z: -2.2, label: "⛳ The golf bag", emoji: "⛳", color: "#1b5e20", lines: ["A putter, a 7-iron and a gavel. In the golf bag.", "A tag on it: 'PROPERTY OF THE COURT (and Marv)'."] },
        ],
    },
    roadsideHatzalah: {
        name: "Hatzalah Highway Station", short: "Hatzalah", emoji: "🚑", title: "🚑 HATZALAH HIGHWAY STATION", tagline: "open 24/6 · calm since 1979",
        wall: "#eceff1", trim: "#1565c0", floor: ["#9e9e9e", "#a8a8a8"], sky: "#e3f2fd", music: "../er1.mp3",
        boxes: [["#ffffff", -4.6, -1.6, 0.4, 2.4, -3.4, 0.6], ["#ff8f00", -4.65, -1.55, 1.3, 1.6, -3.4, 0.6],                 // the ambulance (its back)
            ["#e0e0e0", 0.2, 2.2, 0.55, 0.65, -3.2, -2.4], ["#9e9e9e", 0.3, 2.1, 0, 0.55, -3.1, -2.5],                         // the cot
            ["#37474f", 3.0, 4.6, 0, 0.9, -3.4, -2.6], ["#212121", 3.3, 3.8, 0.9, 1.3, -3.2, -2.8],                           // the radio desk
            ["#d7a86e", 3.4, 4.4, 0.9, 0.95, -2.5, -2.1]],                                                                   // (the rugelach tray)
        board: { x: 1.2, y: 1.9, z: -3.55, w: 1.7, h: 0.9, bg: "#e3f2fd", fg: "#1565c0", text: "DAYS WITHOUT\nPANICKING\n4,816" },
        people: [["yossi", "npcMan", { x: 1.2, z: -1.6, ry: 0 }, { name: "Yossi", colors: { Top: "#ff8f00", Bottom: "#263238", Hair: "#3e2723" } }],
            ["dispatch", "npcWoman", { x: 3.9, z: -2.0, ry: -Math.PI / 2 }, { name: "Malky (dispatch)", pose: { sit: true }, colors: { Top: "#1565c0", Hair: "#5d4037" }, faceLulu: false, collide: false }]],
        cols: [[-4.7, -1.5, -3.5, 0.7], [0.2, 2.2, -3.2, -2.4], [3.0, 4.6, -3.4, -2.0]],
        hots: [
            { id: "yossi", x: 1.2, z: -0.3, who: "yossi", label: "🚑 Talk to Yossi", emoji: "🧘", color: "#ff8f00", lines: [
                "You're fine. Have a rugelach. Everything's fine.",
                "I've seen worse. I've seen MUCH worse. I'm very calm. It's my whole thing.",
                "Breathe in… breathe out… now one more rugelach.",
                "Last week a guy came in with a pickle stuck in a thermos. We saved them both.",
                "The siren's just for show. I'd drive calmly if they let me."] },
            { id: "dispatch", x: 3.0, z: -1.2, who: "dispatch", label: "📻 Talk to Malky (dispatch)", emoji: "📻", color: "#1565c0", lines: [
                "*into the radio* Unit 4, the 'emergency' at exit 12 was a goose. Again.",
                "Coffee? Tea? A stern talking-to? I've got all three.",
                "Yossi has NEVER raised his voice. We tested it. With a kazoo."] },
            { id: "rugelach", x: 3.9, z: -1.6, label: "🥐 The rugelach tray", emoji: "🥐", color: "#8d6e63", lines: ["Chocolate. Of course chocolate. This is a serious medical facility.", "A note: 'FOR PATIENTS. (Yossi, that means not you.)'"] },
        ],
    },
    roadsideFirstAid: {
        name: "the first-aid room", short: "first aid", emoji: "🩹", title: "🩹 TROOPER POST 7 — FIRST AID", tagline: "a cot, a kit, Trooper Ruthie",
        wall: "#f5f5f5", trim: "#b71c1c", floor: ["#cfd8dc", "#eceff1"], sky: "#f5f5f5", music: "../er1.mp3",
        boxes: [["#e0e0e0", -3.0, -1.0, 0.55, 0.65, -3.2, -2.2], ["#9e9e9e", -2.9, -1.1, 0, 0.55, -3.1, -2.3],                // a cot
            ["#ffffff", 1.6, 2.6, 1.2, 1.9, -3.5, -3.2], ["#c62828", 1.95, 2.25, 1.4, 1.7, -3.2, -3.15],                     // the kit on the wall
            ["#6d4c41", 3.0, 4.6, 0, 0.9, -3.4, -2.6]],
        board: { x: -0.6, y: 2.0, z: -3.55, w: 1.5, h: 0.8, bg: "#ffffff", fg: "#b71c1c", text: "FIRST AID\nask for Ruthie" },
        people: [["ruthie", "copPerson", { x: 0.2, z: -2.4, ry: 0 }, { name: "Trooper Ruthie" }]],
        cols: [[-3.0, -1.0, -3.2, -2.2], [3.0, 4.6, -3.4, -2.6]],
        hots: [
            { id: "ruthie", x: 0.2, z: -1.0, who: "ruthie", label: "🩹 Talk to Trooper Ruthie", emoji: "🩹", color: "#b71c1c", lines: [
                "Trooper AND medic. I write the ticket, then I bandage the hand you wrote the angry letter with.",
                "Ice pack? Band-aid? A lollipop? I have all three and a very firm hug policy (it's: ask first).",
                "Most of what comes in here is 'I bumped my head on the vending machine'. It's a mean vending machine.",
                "Breathe. You're fine. The road's a loop, the day is long, and you've got all your fingers. I counted."] },
            { id: "kit", x: 2.1, z: -2.4, label: "🧰 The first-aid kit", emoji: "🧰", color: "#c62828", lines: ["Band-aids, gauze, and one emergency rugelach. Labelled 'EMERGENCY'.", "A sticker on the lid: 'DON'T PANIC — RUTHIE'."] },
            { id: "cot", x: -2.0, z: -1.5, label: "🛏️ The cot", emoji: "🛏️", color: "#607d8b", lines: ["It squeaks. Every cot in the state squeaks. It's the law.", "Somebody carved 'LENNY WAS HERE' in the frame. Of course he was."] },
        ],
    },
    roadsideWeigh: {
        name: "the Weigh Station", short: "the weigh station", emoji: "⚖️", title: "⚖️ THE WEIGH STATION — LOCK-UP & VIDEO COURT", tagline: "trucks weighed · drivers judged · one bunk",
        wall: "#b0bec5", trim: "#37474f", floor: ["#9e9e9e", "#a5a5a5"], sky: "#cfd8dc", music: "../story-relax.mp3",
        boxes: [["#546e7a", -1.0, 2.0, 0, 1.0, -2.2, -1.4], ["#eceff1", -1.1, 2.1, 1.0, 1.06, -2.3, -1.3],                   // the desk
            ["#212121", 2.6, 4.4, 1.2, 2.3, -3.55, -3.45],                                                                    // the video screen
            ["#78909c", -4.9, -4.8, 0, 2.6, -3.6, -1.2], ["#8d6e63", -4.7, -3.4, 0.4, 0.5, -3.5, -2.4],                      // the one-bunk lock-up
            ["#fdd835", -0.6, 1.6, 0, 0.08, 0.6, 1.8]],                                                                      // a scale (for people)
        bars: { x0: -4.9, x1: -3.0, z: -1.2 },
        board: { x: 3.5, y: 1.75, z: -3.4, w: 1.6, h: 0.9, bg: "#0d47a1", fg: "#ffffff", text: "📺 JUDGE PFEFFER\n(you're on mute)" },
        people: [["dot", "copPerson", { x: 0.5, z: -2.8, ry: 0 }, { name: "Officer Dot" }],
            ["trucker", "npcMan", { x: -3.9, z: -2.6, ry: Math.PI / 2 }, { name: "Big Moe (a trucker)", pose: { sit: true }, y: 0.5, colors: { Top: "#c62828", Bottom: "#1a237e", Hair: "#5d4037" }, faceLulu: false, collide: false }]],
        cols: [[-1.1, 2.1, -2.3, -1.3], [-5, -2.9, -3.6, -1.1]],
        hots: [
            { id: "dot", x: 0.5, z: -0.6, who: "dot", label: "⚖️ Talk to Officer Dot", emoji: "⚖️", color: "#37474f", lines: [
                "We weigh the trucks. Sometimes the trucks weigh us. Emotionally.",
                "One bunk. If two of you get arrested, one of you gets the chair. It's a nice chair.",
                "The judge is on the screen. He's in Boca. He's ALWAYS in Boca.",
                "Step on the little scale if you want. It just says 'NICE'. I reprogrammed it."] },
            { id: "trucker", x: -2.7, z: -0.8, who: "trucker", label: "🚛 Talk to Big Moe (in the lock-up)", emoji: "🚛", color: "#c62828", lines: [
                "Overweight. The TRUCK, not me. …Okay, a little me. It was a lot of brisket.",
                "Dot makes great coffee. I'm staying till lunch. Maybe dinner.",
                "Forty years on the road and I've never seen a loop this nice. Sixteen kilometres of pure scenery. Again and again."] },
            { id: "screen", x: 3.5, z: -2.4, label: "📺 Judge Pfeffer (on the screen)", emoji: "📺", color: "#0d47a1", lines: [
                "*frozen mid-sneeze* …chooo. Can you hear me? I can't hear you. Dot, is it the button?",
                "*from Boca, in a visor* Court is in session. The pool is also in session. I'm multitasking.",
                "*the screen says 'Your call is important to us'* …it really is."] },
            { id: "scale", x: 0.5, z: 1.2, label: "⚖️ Step on the little scale", emoji: "⚖️", color: "#f9a825", lines: ["*beep* NICE.", "*beep* NICE. (It always says NICE.)", "*beep* STILL NICE."] },
        ],
    },
    roadsideClinic: {
        name: "Doc-in-a-Box", short: "Doc-in-a-Box", emoji: "🩹", title: "🩹 DOC-IN-A-BOX — URGENT CARE", tagline: "no appointment · no idea · no problem",
        wall: "#c8e6c9", trim: "#00897b", floor: ["#e0f2f1", "#ffffff"], sky: "#e0f2f1", music: "../er1.mp3",
        boxes: [["#00897b", -1.8, 1.8, 0, 1.1, -2.6, -1.8], ["#ffffff", -1.9, 1.9, 1.1, 1.16, -2.7, -1.7],                  // the desk
            ["#80cbc4", -4.6, -2.8, 0.45, 0.5, 0.2, 0.8], ["#80cbc4", -4.6, -2.8, 0.45, 0.5, 1.2, 1.8],                       // waiting chairs
            ["#e53935", 3.8, 4.7, 0, 1.9, -3.4, -2.7], ["#2e7d32", -4.6, -4.0, 0, 1.2, -3.4, -2.8]],                         // vending machine · a plant
        board: { x: 1.8, y: 2.0, z: -3.55, w: 1.5, h: 0.8, bg: "#ffffff", fg: "#00897b", text: "NOW SERVING\nwhoever's here" },
        people: [["dvora", "npcWoman", { x: 0, z: -3.0, ry: 0 }, { name: "Dvora (reception)", colors: { Top: "#00897b", Hair: "#212121" } }],
            ["waiting", "npcMan", { x: -3.7, z: 0.5, ry: Math.PI / 2 }, { name: "A man with a sock on his hand", pose: { sit: true }, colors: { Top: "#fbc02d" }, faceLulu: false, collide: false }]],
        cols: [[-1.9, 1.9, -2.7, -1.7], [3.7, 4.8, -3.5, -2.6]],
        hots: [
            { id: "dvora", x: 0, z: -1.0, who: "dvora", label: "📋 Talk to Dvora", emoji: "📋", color: "#00897b", lines: [
                "Name? Doesn't matter. Insurance? Doesn't matter. Sit anywhere. That matters.",
                "Honey, I've seen a man come in with a TRUMPET stuck on his foot. You're fine.",
                "The doctor's in. He's always in. He lives here. It's a box.",
                "We're open 24 hours. Except lunch. And the other lunch."] },
            { id: "waiting", x: -2.6, z: 0.5, who: "waiting", label: "🧦 Talk to the man with the sock", emoji: "🧦", color: "#f9a825", lines: ["Don't ask about the sock.", "It's a long story. It's a long SOCK.", "I'm next. I've been next for an hour."] },
            { id: "vend", x: 4.2, z: -2.2, label: "🥤 The vending machine", emoji: "🥤", color: "#e53935", lines: ["It hums. It doesn't vend. It just… hums.", "A sign: 'OUT OF ORDER (emotionally)'."] },
        ],
    },
};

function build(rt, R) {
    const M = (c, o = {}) => rt.own(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o)));
    const box = (c, x0, x1, y0, y1, z0, z1) => { const g = rt.own(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)); const m = new THREE.Mesh(g, typeof c === "string" ? M(c) : c); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = true; rt.add(m); return m; };
    rt.bounds = { x0: -W / 2 + 0.35, x1: W / 2 - 0.35, z0: -D / 2 + 0.4, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });
    // floor (checker), three walls, the low front with the door
    const tile = canvasPlane(rt.set, 2, 2, (g, w) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? R.floor[0] : R.floor[1]; g.fillRect(i * s, j * s, s, s); } }, { px: 128 });
    const ft = tile.mesh.material.map; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(W / 2, D / 2);
    box(M("#ffffff", { map: ft }), -W / 2, W / 2, -0.06, 0, -D / 2, D / 2);
    const wall = M(R.wall), trim = M(R.trim);
    box(wall, -W / 2, W / 2, 0, WALL, -D / 2 - 0.14, -D / 2);
    box(wall, -W / 2 - 0.14, -W / 2, 0, WALL, -D / 2, D / 2);
    box(wall, W / 2, W / 2 + 0.14, 0, WALL, -D / 2, D / 2);
    box(trim, -W / 2, W / 2, WALL - 0.35, WALL, -D / 2 + 0.02, -D / 2 + 0.12);
    box(trim, -W / 2, DOOR.x - 0.7, 0, 0.55, D / 2 - 0.06, D / 2 + 0.06);
    box(trim, DOOR.x + 0.7, W / 2, 0, 0.55, D / 2 - 0.06, D / 2 + 0.06);
    col("back", -W, W, -D / 2 - 0.5, -D / 2 + 0.1);
    col("f1", -W, DOOR.x - 0.7, D / 2 - 0.12, D / 2 + 1); col("f2", DOOR.x + 0.7, W, D / 2 - 0.12, D / 2 + 1);
    for (const b of R.boxes) box(...b);
    if (R.bars) for (let x = R.bars.x0 + 0.2; x < R.bars.x1; x += 0.25) box("#607d8b", x - 0.03, x + 0.03, 0, 2.5, R.bars.z - 0.03, R.bars.z + 0.03);
    (R.cols || []).forEach((c, i) => col("c" + i, ...c));
    if (R.board) {
        const B = R.board, p = canvasPlane(rt.set, B.w, B.h, (g, w, h) => { g.fillStyle = B.bg; g.fillRect(0, 0, w, h); drawLines(g, B.text, w / 2, h / 2, h * 0.17, B.fg); }, { px: 256 });
        p.mesh.position.set(B.x, B.y, B.z); rt.add(p.mesh);
    }
    rt.pointLight("tube0", "#fff8e8", 6, 11).position.set(0, 2.8, 0);
    for (const [id, key, at, o] of R.people) rt.person(id, key, at, o);
    for (const h of R.hots) {
        const next = pool(h.lines);
        rt.hot({ id: h.id, x: h.x, z: h.z, who: h.who, r: 1.4, label: h.label,
            action: rt => { tone(520, 0.06, "sine", 0.08); return rt.say(h.who ? rt.byId[h.who].name : h.label.replace(/^\S+\s/, ""), next(), Object.assign({ emoji: h.emoji, color: h.color }, h.who ? { person: rt.byId[h.who] } : {})); } });
    }
}

export const ROOM_DEFS = {};
for (const id of Object.keys(ROOMS)) {
    const R = ROOMS[id];
    const models_ = [...new Set(R.people.map(p => p[1]))];
    ROOM_DEFS[id] = defineInterior({
        id, name: R.name, short: R.short, emoji: R.emoji, title: R.title, tagline: R.tagline,
        model: "roadside_roomkit", models: models_, music: R.music,
        light: "indoor", sky: R.sky,
        bounds: { x0: -W / 2 + 0.35, x1: W / 2 - 0.35, z0: -D / 2 + 0.4, z1: D / 2 - 0.35 },
        cam: { dist: 7.0, height: 4.6 },
        build(rt) { build(rt, R); },
    });
}
/** Which room a roadside door opens: (place id, door) → interior id. */
export function roomFor(placeId, door) {
    if (placeId === "trooper") return { precinct: "roadsideTrooper", court: "roadsideCourt", hospital: "roadsideFirstAid" }[door] || null;
    if (placeId === "weigh") return { precinct: "roadsideWeigh", court: "roadsideWeigh", hospital: "roadsideClinic" }[door] || null;
    if (placeId === "hatzalah") return door === "hospital" ? "roadsideHatzalah" : null;
    return null;
}
