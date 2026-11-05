// features/journey/story.js — the STORY BEATS on top of each leg (src/05a-journey.js):
//   1. a phone CALL from your destination as the leg starts (ctx.phone card)
//   2. a mid-leg dialogue INTERLUDE (~35%): Lulu pulls onto the shoulder and the
//      scene plays (phone calls to Bubbe / Dina / Burry; Heshy and Avigail in person)
//   3. ONE scripted ROAD EVENT (~60%): Ima's convoy, Heshy's cannonball crossing,
//      the seagull squadron → ice-cream convoy, Avigail's "race you there",
//      Burry's box drop
//   + the beach leg's runaway gear (chapter task) and leg ambience (gulls, fireflies).
// Random / surprise beats are gated with ctx.enabled("journey") (always on in the game).
import * as THREE from "three";
import { ctx, on, hook, emit, registerState, setState, addActor, rand } from "../../core/ctx.js";
import { updateDriving, addCoins } from "../../core/driving.js";
import { say, closeDialog } from "../../core/dialog.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { registerKind, kindSpec } from "../../traffic.js";
import { canvasTex, worldMaterials, LANES_OURS } from "../../world.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import * as SFX from "./sfx.js";
import { STOPS, SPEAKERS, GEAR, GEAR_PLAN, BOX_LABELS, STORY_CALL_DUR, storyCallInfo, storyCallLine, storyTalkScript, bumpAvigail } from "./data.js";
import { isStory, curLeg, legProgress, hasHeat } from "./state.js";
import { task } from "./trip.js";
import { phone } from "./phone.js";
import { env } from "./env.js";

const B = { leg: -1, callT: 0, talkDone: false, eventDone: false, gullT: 8, flies: null, event: null };
const enabled = () => ctx.enabled("journey");

on("journey:leg", ({ index }) => {
    B.leg = index;
    B.callT = index >= 0 ? 0.5 : 0;   // 2D: ~2.6 s into the leg, once the leg banner has faded
    B.talkDone = false;
    B.eventDone = false;
    B.gullT = rand(4, 9);
    B.event = null;
    if (index >= 0) ensureModels(["journey_seagull", "journey_box", "journey_minivan", "journey_icecream", "journey_burry_truck", "journey_avigail_car",
        "journey_kite", "journey_beachball", "journey_sunhat", "journey_floatie", "imaPerson", "heshyPerson", "avigailPerson", "dinaPerson"]).catch(() => {});
});

// ── speech bubbles (3D sprites) ───────────────────────────────────────────
const bubbleTex = new Map();
function bubbleTexture(text, color = "#E91E63") {
    const key = text + color;
    if (bubbleTex.has(key)) return bubbleTex.get(key);
    const t = canvasTex(512, 160, (g, w, h) => {
        g.fillStyle = "rgba(255,255,255,0.97)";
        g.beginPath(); g.roundRect(6, 6, w - 12, h - 40, 34); g.fill();
        g.beginPath(); g.moveTo(w / 2 - 22, h - 36); g.lineTo(w / 2, h - 6); g.lineTo(w / 2 + 22, h - 36); g.fill();
        g.strokeStyle = color; g.lineWidth = 7;
        g.beginPath(); g.roundRect(6, 6, w - 12, h - 40, 34); g.stroke();
        g.fillStyle = "#2b1b2e"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 ${text.length > 24 ? 34 : 42}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        g.fillText(text, w / 2, (h - 34) / 2 + 4, w - 40);
    }, false);
    bubbleTex.set(key, t);
    return t;
}
function bubble(parent, text, y = 3.4, color, scale = 1) {
    const m = new THREE.SpriteMaterial({ map: bubbleTexture(text, color), depthTest: false, transparent: true });
    const s = new THREE.Sprite(m);
    s.scale.set(5.2 * scale, 1.62 * scale, 1);
    s.position.y = y;
    s.renderOrder = 10;
    parent.add(s);
    return { sprite: s, remove() { if (s.parent) s.parent.remove(s); m.dispose(); } };
}

// ── 1. the leg-start phone call ───────────────────────────────────────────
function storyCall(i) {
    const info = storyCallInfo(i);
    return phone.call(Object.assign({}, info, {
        lines: [storyCallLine(i)], ring: 0.7, talk: STORY_CALL_DUR, flip: false, declinable: false,
        talkEmoji: info.emoji, ringText: "", talkSub: "📣 {honk} to hang up",
    }));
}

// ── the per-frame story layer ─────────────────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    const G = ctx.G;
    if (!isStory() || G.jDone || G.jArriving || ctx.state !== "playing") return;
    const i = curLeg(), prog = legProgress();
    if (enabled()) {
        if (B.callT > 0 && (G.jBannerT || 0) <= 0 && (G.jBannerShowT || 0) <= 0) {
            B.callT -= dt;
            if (B.callT <= 0 && !storyCall(i)) B.callT = 2;
        }
        if (!B.talkDone && prog >= 0.35 && prog < 0.8 && !hasHeat() && !phone.busy() && !(ctx.foot && ctx.foot.active)) {
            B.talkDone = true;
            setState("storyTalk", { i });
            return;
        }
        if (!B.eventDone && prog >= 0.6 && prog < 0.92 && !hasHeat()) { B.eventDone = true; fireEvent(i); }
        ambience(dt, i);
    }
    gearTick(dt, i, prog);
}, -5);

// ── 2. the mid-leg interlude ──────────────────────────────────────────────
const talk = { i: -1, phase: "", t: 0, person: null, extra: [], from: new THREE.Vector3(), look: new THREE.Vector3(), smokeT: 0 };
const IN_PERSON = { heshy: "heshyPerson", avigail: "avigailPerson" };

registerState("storyTalk", {
    hud: true, touch: false, driving: true, pausable: false,
    enter({ i }) {
        talk.i = i; talk.phase = "pull"; talk.t = 0;
        const id = STOPS[i].id;
        talk.prevInv = ctx.G.invT || 0;
        ctx.G.invT = Math.max(ctx.G.invT, 99);
        SFX.chime(620, 830);
        H.banner(`${STOPS[i].icon} <b>LEG STORY</b><small>${IN_PERSON[id] ? "pulling over…" : "📞 incoming call — pulling over"}</small>`, 1800);
        ctx.cam.snap();
        // in-person scenes: Heshy / Avigail (+ her smoking car) wait on the shoulder ahead
        const key = IN_PERSON[id];
        if (key && models[key]) {
            const road = ctx.world.road, s = ctx.car.s + Math.max(30, ctx.car.speed * 1.8);
            const p = road.point(s, 11.2, {}), h = road.at(s).h;
            const per = spawnPerson(key, { scale: 1.05 });
            per.obj.position.set(p.x, 0, p.z);
            per.obj.rotation.y = h + Math.PI;
            ctx.scene.add(per.obj);
            talk.person = per;
            if (id === "avigail") {
                const carKey = models.journey_avigail_car ? "journey_avigail_car" : null;
                if (carKey) {
                    const car = cloneWithColors(models[carKey]);
                    const q = road.point(s + 7, 11.6, {});
                    car.position.set(q.x, 0, q.z); car.rotation.y = h + 0.25;
                    ctx.scene.add(car);
                    talk.extra.push(car);
                }
            }
            if (id === "heshy" && models.journey_floatie) {
                const ring = cloneWithColors(models.journey_floatie);
                ring.scale.setScalar(0.34); ring.rotation.x = Math.PI / 2; ring.position.y = 0.95;
                per.obj.add(ring);
            }
        }
    },
    exit() {
        if (ctx.dialogOpen) closeDialog();
        ctx.G.invT = Math.max(2.0, (talk.prevInv || 0) - talk.t);   // a 2 s shield back on the road (2D)
        const dispose = () => {
            if (talk.person) { const o = talk.person.obj; setTimeout(() => o.parent && o.parent.remove(o), 7000); }
            for (const e of talk.extra) setTimeout(() => e.parent && e.parent.remove(e), 7000);
            talk.person = null; talk.extra = [];
        };
        dispose();
        showPhoneProp(false);
    },
    update(dt, P) {
        talk.t += dt;
        const car = ctx.car, road = ctx.world.road;
        if (talk.phase === "pull") {
            // ease onto the shoulder and stop (traffic keeps flowing past)
            const tgt = road.point(car.s + 14, 7.9, {});
            const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z);
            let diff = want - car.h; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
            updateDriving(dt, {}, false, { steer: THREE.MathUtils.clamp(-diff * 3, -1, 1), throttle: 0, brake: car.speed > 3 ? 0.55 : 1, handbrake: false, analog: true });
            if ((car.speed < 0.6 && talk.t > 0.6) || talk.t > 4.2) { talk.phase = "talk"; runScript(); }
        } else {
            updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true });
        }
        if (talk.person) {
            talk.person.face(car.pos.x, car.pos.z, dt);
            talk.person.update(dt, { talk: talk.speaking === STOPS[talk.i].id, wave: talk.phase === "pull" });
        }
        if (talk.extra.length && STOPS[talk.i].id === "avigail") {
            talk.smokeT -= dt;
            if (talk.smokeT <= 0) {
                talk.smokeT = 0.12;
                const c = talk.extra[0].position;
                car.fx.emit(c.x + (Math.random() - 0.5) * 0.6, 1.1, c.z + Math.sin(talk.extra[0].rotation.y) * 1.8, (Math.random() - 0.5) * 0.4, 1.6, (Math.random() - 0.5) * 0.4, 1.0, 2.0, [0.45, 0.45, 0.48]);
            }
        }
    },
    camera(dt) {
        const car = ctx.car, h = car.h;
        const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
        if (talk.person) {
            // a side shot from the road framing Lulu and whoever's on the shoulder
            const p = talk.person.obj.position;
            const mx = (car.pos.x + p.x) / 2, mz = (car.pos.z + p.z) / 2;
            talk.from.set(mx - rx * 9 - fx * 3, 3.0, mz - rz * 9 - fz * 3);
            talk.look.set(mx, 1.4, mz);
        } else {
            // close on Lulu in the driver's seat, phone to her ear
            talk.from.set(car.pos.x - rx * 3.2 + fx * 2.6, 1.9, car.pos.z - rz * 3.2 + fz * 2.6);
            talk.look.set(car.pos.x - rx * 0.38 - fx * 0.3, 1.45, car.pos.z - rz * 0.38 - fz * 0.3);
        }
        ctx.cam.cinematic(talk.from, talk.look, dt, 1.8, 46);
        return true;
    },
});

async function runScript() {
    const i = talk.i, id = STOPS[i].id;
    const lines = storyTalkScript(id);
    showPhoneProp(lines.some(l => l.phone));
    for (const ln of lines) {
        if (ctx.state !== "storyTalk") return;
        const sp = SPEAKERS[ln.who] || { name: "?", emoji: "💬", color: "#333" };
        talk.speaking = ln.who;
        await say((ln.phone ? "📞 " : "") + sp.name, ln.text, { emoji: sp.emoji, color: sp.color });
    }
    talk.speaking = null;
    if (ctx.state !== "storyTalk") return;
    if (id === "avigail") bumpAvigail(6);
    setState("playing");
    H.toast("🚗 back on the road!", "");
}

// Lulu's phone for interlude calls (the phone module shows it for ctx.phone calls)
let propObj = null;
function showPhoneProp(on) {
    const car = ctx.car;
    if (!car || !car.anchors || !car.anchors.head) return;
    if (on && !propObj && models.journey_phone) {
        propObj = cloneWithColors(models.journey_phone);
        propObj.scale.setScalar(1.6);
        propObj.position.set(0.25, -0.3, 0.02);
        propObj.rotation.set(0, 0.25, -0.2);
    }
    if (!propObj) return;
    if (on) car.anchors.head.add(propObj); else if (propObj.parent) propObj.parent.remove(propObj);
}

// ── 3. the scripted road events ───────────────────────────────────────────
registerKind("journey_icecream", { len: 6.4, halfW: 1.15, circles: [-2.2, 0, 2.2], r: 1.2, mass: 3.2, model: "journey_icecream", paint: false });
registerKind("journey_avigail", { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.2, model: "journey_avigail_car", paint: false });

function otherLane() { return ctx.car.d > 3.5 ? LANES_OURS[0] : LANES_OURS[1]; }
function clearLane(d, s0, s1) {
    for (const c of ctx.traffic.cars.slice()) if (c.dir > 0 && !c.ai && Math.abs(c.d - d) < 2 && c.s > s0 && c.s < s1) ctx.traffic.remove(c);
}

function fireEvent(i) {
    const id = STOPS[i].id;
    SFX.pop();
    try {
        if (id === "bubbe") imaConvoy();
        else if (id === "heshy") cannonball();
        else if (id === "beach") gullsAndIceCream();
        else if (id === "avigail") raceYouThere();
        else burryBoxDrop();
    } catch (e) { console.error("[journey event]", e); }
    emit("journey:event", { index: i, id });
}

/** A world-space object that rides alongside Lulu at (car.s + ds, d). */
function pacer(obj, d0) {
    const p = { obj, ds: -14, d: d0, speedAdd: 0, t: 0 };
    ctx.scene.add(obj);
    return p;
}
function placePacer(p, dt) {
    const road = ctx.world.road;
    const s = ctx.car.s + p.ds;
    const q = road.point(s, p.d, {});
    p.obj.position.set(q.x, 0, q.z);
    p.obj.rotation.y = q.h;
    const wheels = p.wheels || (p.wheels = findNodes(p.obj, "Wheel_").map(w => { w.rotation.order = "YXZ"; return w; }));
    for (const w of wheels) w.rotation.x += Math.max(0, ctx.car.speed + p.speedAdd) * dt / 0.36;
}

function imaConvoy() {
    if (!models.journey_minivan) return;
    const d = otherLane();
    clearLane(d, ctx.car.s - 40, ctx.car.s + 60);
    const van = cloneWithColors(models.journey_minivan);
    const p = pacer(van, d);
    let ima = null;
    if (models.imaPerson) {
        ima = spawnPerson("imaPerson", { scale: 0.86 });
        const a = findNodes(van, "Anchor_driver")[0];
        (a || van).add(ima.obj);
        if (!a) ima.obj.position.set(0.42, 0.6, 0.35);
    }
    let said1 = false, said2 = false, honked = false, b = null;
    addActor({
        update(dt) {
            p.t += dt;
            if (p.t < 1.4) p.ds += (0 - p.ds) * Math.min(1, dt * 1.6);
            if (!said1 && p.t > 1.0) { said1 = true; b = bubble(van, "Two hands on the wheel!", 3.6, "#FF80AB"); H.toast("🚐 Ima's convoy!", "pink"); }
            if (!said2 && p.t > 3.6) { said2 = true; if (b) b.remove(); b = bubble(van, "Call your Bubbe when you arrive!!", 3.6, "#FF80AB"); }
            if (p.t > 6.2) {
                if (!honked) { honked = true; SFX.honk(); if (b) { b.remove(); b = null; } }
                p.speedAdd = Math.max(-9, p.speedAdd - dt * 6);
                p.ds += p.speedAdd * dt;
            }
            placePacer(p, dt);
            if (ima) ima.update(dt, { sit: true, talk: p.t < 6, wave: p.t > 6 });
            return p.ds > -70 && ctx.state !== "title";
        },
        dispose() { if (b) b.remove(); if (van.parent) van.parent.remove(van); },
    });
}

function cannonball() {
    if (!models.heshyPerson) return;
    const road = ctx.world.road;
    const s = ctx.car.s + Math.max(90, ctx.car.speed * 3.6);
    const heshy = spawnPerson("heshyPerson", { scale: 1.05 });
    if (models.journey_floatie) {
        const ring = cloneWithColors(models.journey_floatie);
        ring.scale.setScalar(0.34); ring.rotation.x = Math.PI / 2; ring.position.y = 0.95;
        heshy.obj.add(ring);
    }
    ctx.scene.add(heshy.obj);
    // a kiddie pool waiting on the far side of the road
    let pool = null;
    if (models.journey_floatie) {
        pool = cloneWithColors(models.journey_floatie, { TubeOrange: "#29B6F6" });
        pool.scale.setScalar(1.25); pool.rotation.x = Math.PI / 2; pool.position.y = 0.3;
        const q = road.point(s, -12, {});
        pool.position.x = q.x; pool.position.z = q.z;
        const water = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#4FC3F7", roughness: 0.1 }));
        water.position.set(q.x, 0.25, q.z);
        ctx.scene.add(pool, water);
        pool.userData.water = water;
    }
    let d = 11, t = 0, splashed = false;
    H.toast("🏊 is that… HESHY?!", "gold");
    SFX.honk();
    addActor({
        update(dt) {
            t += dt;
            const near = s - ctx.car.s < 95;
            if (near && d > -12) d -= dt * 8.5;
            const q = road.point(s, d, {}), h = road.at(s).h;
            heshy.obj.position.set(q.x, d <= -12 ? -0.55 : 0, q.z);
            heshy.obj.rotation.y = h + Math.PI / 2;   // facing the left-hand side of the road
            heshy.update(dt, d > -12 ? { walk: near ? 8 : 0, wave: !near } : { wave: true });
            if (d <= -12 && !splashed) {
                splashed = true;
                H.toast("CANNONBALL PRACTIIIICE! 💦", "pink");
                SFX.splash();
                ctx.car.fx.burst(q.x, 0.8, q.z, 34, 5, [0.75, 0.92, 1], 0.8, 1.1);
            }
            return ctx.car.s - s < 60;
        },
        dispose() {
            if (heshy.obj.parent) heshy.obj.parent.remove(heshy.obj);
            if (pool) { ctx.scene.remove(pool, pool.userData.water); pool.userData.water.geometry.dispose(); pool.userData.water.material.dispose(); }
        },
    });
}

function gullFlock(n, ahead = 120) {
    if (!models.journey_seagull) return [];
    const road = ctx.world.road, gulls = [];
    for (let k = 0; k < n; k++) {
        const g = cloneWithColors(models.journey_seagull);
        g.scale.setScalar(1.6);
        ctx.scene.add(g);
        gulls.push({ obj: g, s: ctx.car.s + ahead + k * rand(12, 30), d: rand(-9, 9), y: rand(9, 14), vs: -rand(8, 14), t: rand(0, 3),
            wl: findNodes(g, "Wing_L")[0], wr: findNodes(g, "Wing_R")[0] });
    }
    return gulls;
}
function updateGulls(gulls, dt) {
    const road = ctx.world.road, car = ctx.car;
    for (const g of gulls) {
        g.t += dt;
        g.s += g.vs * dt;
        const rel = g.s - car.s;
        g.y += ((rel < 30 ? 3.5 : 9) - g.y) * Math.min(1, dt * 0.8);
        const q = road.point(g.s, g.d + Math.sin(g.t * 1.3) * 1.5, {});
        g.obj.position.set(q.x, g.y, q.z);
        g.obj.rotation.y = q.h + Math.PI;
        const f = Math.sin(g.t * 13) * 0.75;
        if (g.wl) g.wl.rotation.y = -f;
        if (g.wr) g.wr.rotation.y = f;
    }
}
function removeGulls(gulls) { for (const g of gulls) if (g.obj.parent) g.obj.parent.remove(g.obj); }

const COIN_GEO = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 18).rotateX(Math.PI / 2);
/** A pickup coin that follows `anchorFn()` (or stays put) until Lulu grabs it. */
function coinActor(posFn, value = 1, why = "story") {
    const mesh = new THREE.Mesh(COIN_GEO, worldMaterials().coin);
    mesh.castShadow = true;
    ctx.scene.add(mesh);
    let t = 0;
    return addActor({
        update(dt) {
            t += dt;
            const p = posFn();
            if (!p) return false;
            mesh.position.set(p.x, 1.05 + Math.sin(t * 4) * 0.12, p.z);
            mesh.rotation.y = t * 3;
            const dx = p.x - ctx.car.pos.x, dz = p.z - ctx.car.pos.z;
            if (dx * dx + dz * dz < 4.4) {
                addCoins(value, why);
                ctx.G.score += 10 * value;
                A.sfxCoin(0);
                ctx.car.fx.burst(p.x, 1.1, p.z, 6, 2.5, [1, 0.85, 0.3], 0.35, 0.5);
                return false;
            }
            return p.s - ctx.car.s > -40;
        },
        dispose() { ctx.scene.remove(mesh); },
    });
}

function gullsAndIceCream() {
    const gulls = gullFlock(6 + Math.floor(Math.random() * 3), 140);
    H.toast("smell that salt air! 🌊", "pink");
    SFX.squawk();
    let t = 0, convoy = false;
    addActor({
        update(dt) {
            t += dt;
            updateGulls(gulls, dt);
            if (!convoy && t > 2.4) {
                convoy = true;
                if (!models.journey_icecream) return true;
                const lane = LANES_OURS[Math.floor(Math.random() * 2)];
                clearLane(lane, ctx.car.s + 60, ctx.car.s + 360);
                for (let k = 0; k < 3; k++) {
                    const tr = ctx.traffic.add("journey_icecream", ctx.car.s + 150 + k * 34, lane, 1, 11 + Math.random() * 1.5, { keep: true, data: { journeyIce: true } });
                    for (let c = 0; c < 3; c++) {
                        coinActor(() => {
                            if (!ctx.traffic.cars.includes(tr)) return null;
                            const q = ctx.world.road.point(tr.s - 6 - c * 2.6, tr.d, {});
                            q.s = tr.s; return q;
                        }, 1, "icecream");
                    }
                    setTimeout(() => { tr.keep = false; }, 40000);
                }
                SFX.chime(784, 1047);
                H.toast("🍦 ICE CREAM CONVOY!", "gold");
            }
            return t < 14;
        },
        dispose() { removeGulls(gulls); },
    });
}

function raceYouThere() {
    const theirs = kindSpec("avigail");
    const useTheirs = theirs && models[theirs.model || "avigail"];
    const kind = useTheirs ? "avigail" : "journey_avigail";
    if (!models[kindSpec(kind).model || kind]) return;
    const d = otherLane();
    clearLane(d, ctx.car.s - 40, ctx.car.s + 60);
    let t = 0, said1 = false, said2 = false, b = null, bumped = false, awarded = false;
    const car = ctx.traffic.add(kind, ctx.car.s - 10, d, 1, ctx.car.speed, {
        keep: true, noNearMiss: true, data: { journeyAvi: true },
        ai(dt, c) {
            t += dt;
            const target = t < 4.6 ? ctx.car.speed + (ctx.car.s - 2 - c.s) * 0.8 : Math.min(c.speed + dt * 9, ctx.car.speed + 26);
            c.speed += Math.max(-10 * dt, Math.min(12 * dt, target - c.speed));
            c.speed = Math.max(0, c.speed);
            c.s += c.speed * dt;
            c.d += (c.dTarget - c.d) * Math.min(1, dt * 2);
        },
    });
    car.onCrash = () => { bumped = true; };
    let avi = null;
    if (!useTheirs && models.avigailPerson) {
        avi = spawnPerson("avigailPerson", { scale: 0.86 });
        const a = findNodes(car.obj, "Anchor_driver")[0];
        (a || car.obj).add(avi.obj);
    }
    addActor({
        update(dt) {
            if (!said1 && t > 0.9) { said1 = true; b = bubble(car.obj, "Race you to MY house 💅", 3.0, "#CE93D8"); }
            if (!said2 && t > 3.2) { said2 = true; if (b) b.remove(); b = bubble(car.obj, "Loser buys the spritzers!", 3.0, "#CE93D8"); }
            if (t > 6 && b) { b.remove(); b = null; }
            if (avi) avi.update(dt, { sit: true, talk: t < 4.6, wave: t > 4.6 && t < 6 });
            const gone = !ctx.traffic.cars.includes(car) || car.s - ctx.car.s > 260 || car.hit && car.hitT > 4;
            if (gone) {
                if (!awarded) { awarded = true; if (!bumped) { bumpAvigail(2); H.toast("+2 💜 Avigail", "pink"); } }
                return false;
            }
            return true;
        },
        dispose() {
            if (b) b.remove();
            if (avi && avi.obj.parent) avi.obj.parent.remove(avi.obj);
            if (ctx.traffic.cars.includes(car)) ctx.traffic.remove(car);
        },
    });
}

function burryBoxDrop() {
    if (!models.journey_burry_truck || !models.journey_box) return;
    const d = LANES_OURS[Math.floor(Math.random() * 2)];
    clearLane(d, ctx.car.s + 10, ctx.car.s + 140);
    const truck = cloneWithColors(models.journey_burry_truck);
    const p = pacer(truck, d);
    p.ds = 70;
    const boxes = [];
    let t = 0, next = 0.8, dropped = 0, b = bubble(truck, "VEGAS OR BUST!", 4.6, "#8D6E63", 1.1);
    SFX.honk();
    addActor({
        update(dt) {
            t += dt;
            // stay ~40 m ahead, then peel away
            if (t < 8.2) p.ds += (40 - p.ds) * Math.min(1, dt * 0.8);
            else { p.speedAdd = Math.min(18, p.speedAdd + dt * 9); p.ds += p.speedAdd * dt; }
            placePacer(p, dt);
            if (t > 3.5 && b) { b.remove(); b = null; }
            if (t >= next && dropped < 4 && t < 8) {
                next += 1.7;
                const box = cloneWithColors(models.journey_box);
                const rear = ctx.car.s + p.ds - 3.6;
                box.userData = { s: rear, dd: p.d + rand(-0.6, 0.6), y: 1.3, vy: 1.5, vs: Math.max(0, ctx.car.speed * 0.25), spin: rand(-6, 6), li: dropped, landed: false };
                ctx.scene.add(box);
                boxes.push(box);
                dropped++;
                SFX.pop();
            }
            for (let k = boxes.length - 1; k >= 0; k--) {
                const bx = boxes[k], u = bx.userData;
                if (!u.landed) {
                    u.vy -= 14 * dt; u.y += u.vy * dt; u.s += u.vs * dt; u.vs *= Math.exp(-2 * dt);
                    bx.rotation.x += u.spin * dt;
                    if (u.y <= 0) { u.y = 0; if (Math.abs(u.vy) > 2.5) { u.vy = -u.vy * 0.35; u.spin *= 0.5; } else { u.landed = true; bx.rotation.x = Math.round(bx.rotation.x / (Math.PI / 2)) * (Math.PI / 2); } }
                }
                const q = ctx.world.road.point(u.s, u.dd, {});
                bx.position.set(q.x, u.y, q.z);
                bx.rotation.y = q.h + u.li;
                const dx = q.x - ctx.car.pos.x, dz = q.z - ctx.car.pos.z;
                if (dx * dx + dz * dz < 5.5 && u.y < 1.6) {
                    addCoins(6, "burryBox");
                    A.sfxCoin(2);
                    H.toast(`📦 ${BOX_LABELS[u.li]} +6`, "gold");
                    ctx.car.fx.burst(q.x, 0.8, q.z, 10, 3, [0.78, 0.6, 0.42], 0.5, 0.7);
                    ctx.scene.remove(bx); boxes.splice(k, 1);
                } else if (ctx.car.s - u.s > 40) { ctx.scene.remove(bx); boxes.splice(k, 1); }
            }
            return p.ds < 260 || boxes.length > 0;
        },
        dispose() { if (b) b.remove(); ctx.scene.remove(truck); for (const bx of boxes) ctx.scene.remove(bx); },
    });
}

// ── the beach leg's runaway gear (chapter task: catch 3) ──────────────────
function gearTick(dt, i, prog) {
    const t = task.cur;
    if (!t || t.id !== "beach" || (ctx.foot && ctx.foot.active)) return;
    while (t.gearSpawned < GEAR_PLAN.length && prog >= GEAR_PLAN[t.gearSpawned]) {
        if (prog > GEAR_PLAN[t.gearSpawned] + 0.12) { t.gearSpawned++; continue; }   // teleported past it
        spawnGear(t.gearSpawned);
        t.gearSpawned++;
    }
}
const glowGeo = new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2);
let glowMat = null;
const gearLive = [];   // {kind, s, d} of the gear on the road right now (tests read it)
function spawnGear(k) {
    const g = GEAR[k];
    if (!models[g.model]) { ensureModels([g.model]).catch(() => {}); return; }
    const obj = cloneWithColors(models[g.model]);
    const road = ctx.world.road;
    const s = ctx.car.s + Math.max(110, ctx.car.speed * 4);
    let d = LANES_OURS[Math.floor(Math.random() * 2)];
    const scale = g.kind === "ball" ? 1.7 : g.kind === "hat" ? 2.2 : 1.5;
    obj.scale.setScalar(scale);
    if (!glowMat) glowMat = new THREE.MeshBasicMaterial({ color: "#FFE082", transparent: true, opacity: 0.45, depthWrite: false });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    ctx.scene.add(obj, glow);
    let t = 0;
    const d0 = d;
    const live = { kind: g.kind, s, d };
    gearLive.push(live);
    addActor({
        update(dt) {
            t += dt;
            live.d = d;
            // runaway: the ball rolls across the lanes, the kite floats on the wind, the hat tumbles
            if (g.kind === "ball") d = d0 + Math.sin(t * 0.9) * 2.6;
            if (g.kind === "hat") d = d0 + Math.sin(t * 1.6) * 1.2;
            const q = road.point(s, d, {});
            const y = g.kind === "kite" ? 2.3 + Math.sin(t * 2) * 0.4 : g.kind === "ball" ? Math.abs(Math.sin(t * 3.2)) * 0.9 : 0.4 + Math.abs(Math.sin(t * 4)) * 0.4;
            obj.position.set(q.x, y, q.z);
            obj.rotation.y = t * (g.kind === "hat" ? 3 : 0.8);
            if (g.kind === "ball") obj.rotation.x = t * 3;
            if (g.kind === "kite") obj.rotation.z = Math.sin(t * 2.4) * 0.3;
            glow.position.set(q.x, 0.06, q.z);
            glowMat.opacity = 0.3 + Math.sin(t * 5) * 0.15;
            const dx = q.x - ctx.car.pos.x, dz = q.z - ctx.car.pos.z;
            if (dx * dx + dz * dz < 7.5) {
                const tk = task.cur;
                if (tk && tk.id === "beach") tk.gear++;
                addCoins(5, "beachGear");
                A.sfxCoin(4);
                ctx.car.fx.burst(q.x, 1.4, q.z, 12, 3, [1, 0.88, 0.5], 0.5, 0.7);
                H.toast(`🏖️ ${g.name}! ${tk ? tk.gear : 1}/3`, "gold");
                return false;
            }
            return ctx.car.s - s < 50;
        },
        dispose() { ctx.scene.remove(obj, glow); const k2 = gearLive.indexOf(live); if (k2 >= 0) gearLive.splice(k2, 1); },
    });
    H.toast(`${g.emoji} ${g.name} is blowing down the road — grab it!`, "pink");
}

// ── ambience: gull flyovers at the coast, fireflies at dusk ───────────────
let flies = null;
function ambience(dt, i) {
    const id = STOPS[i].id;
    if (id === "beach") {
        B.gullT -= dt;
        if (B.gullT <= 0) {
            B.gullT = rand(14, 22);
            const gulls = gullFlock(2 + Math.floor(Math.random() * 2), 90);
            let t = 0;
            if (gulls.length) {
                SFX.squawk();
                addActor({ update(dt2) { t += dt2; updateGulls(gulls, dt2); return t < 9; }, dispose() { removeGulls(gulls); } });
            }
        }
    }
}
// fireflies: a soft cloud of glowing points over the shoulders while the light is low
function makeFlies() {
    const n = 46, pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const tex = canvasTex(32, 32, (c, w, h) => {
        const grd = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
        grd.addColorStop(0, "rgba(230,255,140,1)"); grd.addColorStop(0.4, "rgba(205,232,107,0.6)"); grd.addColorStop(1, "rgba(205,232,107,0)");
        c.fillStyle = grd; c.fillRect(0, 0, w, h);
    }, false);
    const m = new THREE.PointsMaterial({ size: 0.55, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    const seeds = [];
    for (let k = 0; k < n; k++) seeds.push({ s: null, ds: rand(-30, 90), d: (Math.random() < 0.5 ? -1 : 1) * rand(9.5, 22), y: rand(0.4, 2.2), ph: rand(0, 6.28) });
    ctx.scene.add(pts);
    return { pts, seeds, m };
}
hook("update", (dt) => {
    const want = isStory() && !ctx.G.jDone && curLeg() === 3 ? 1 : env.key === "dusk" ? 0.6 : 0;
    if (!flies && want === 0) return;
    if (!flies) flies = makeFlies();
    flies.m.opacity += (want * 0.9 - flies.m.opacity) * Math.min(1, dt * 0.8);
    flies.pts.visible = flies.m.opacity > 0.02;
    if (!flies.pts.visible) return;
    const road = ctx.world.road, car = ctx.car, a = flies.pts.geometry.attributes.position, q = {}, t = ctx.time;
    flies.seeds.forEach((sd, k) => {
        // world-anchored: each firefly hovers at its own spot; ones left behind hop ahead
        if (sd.s == null || Math.abs(sd.s - car.s) > 400) sd.s = car.s + sd.ds;
        while (sd.s < car.s - 30) sd.s += 120;
        road.point(sd.s + Math.sin(t * 0.4 + sd.ph) * 2, sd.d + Math.cos(t * 0.5 + sd.ph) * 1.2, q);
        a.setXYZ(k, q.x, sd.y + Math.sin(t * 1.3 + sd.ph) * 0.3, q.z);
    });
    a.needsUpdate = true;
    flies.m.size = 0.4 + Math.sin(t * 2.4) * 0.12;
}, -10);

// the test hooks (scripts/tests3d/journey.js)
export const debug = {
    fireEvent, storyCall, spawnGear,
    beats: B,
    gear: gearLive,
};
