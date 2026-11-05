// Dina's run home (2D: dinaRun + dinaCaught) as a third-person 3D race down
// the sidewalk, faithful to the 2D numbers: 45 s nominal (7200 px → 180 m at
// Dina's 40 px/m), sprint ⚡ (3 s meter, ×2 speed, recharges 0.6/s only while
// not held), slow 🐢 (×0.5), stumbles (×0.3), Mom closing in (faster each run:
// dinaDiff = 1 + 0.12·(run−1), max 2.2), the nine sidewalk hazards + Mrs.
// Greenblatt, and every run ending in a medal on the porch.
import * as THREE from "three";
import { ctx, registerState, setState, emit } from "../../core/ctx.js";
import { shared, wallet, flushShared } from "../../core/save.js";
import { spawnPerson } from "../../core/people.js";
import { input, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { street, cast, camTo, RUN_LEN, HOME_Z } from "./street.js";
import {
    L, bubble, bubblesDone, floater, updateFloaters, toScreen, sfx, rand, randInt, randPick, rnd, clamp, lerp, easeOutBack,
    prop, node, ownMaterials, attach, poseLimb, g, isTouch, models,
} from "./common.js";

export const PXM = 40;                        // Dina's world: px per metre (her 46 px sprite = 1.12 m tall)
export const DURATION = 45;                   // nominal seconds (2D DINA_RUN_DURATION)
const BASE = 160 / PXM;                       // 4 m/s (2D DINA_BASE_SCROLL 160 px/s)
const LANES = [-70 / PXM, 0, 70 / PXM];       // lateral u (right = +): left grass, sidewalk, right grass
const UMAX = 95 / PXM, STEER = 280 / PXM;
const SPAWN_AHEAD = 694 / PXM;                // 2D spawns at y = -40 with Dina at y = H - 200
const DESPAWN = 260 / PXM;                    // …and drops them 60 px below the screen
export const MEDAL_HAUL = 10, WIN_BONUS = 25;
const TYPES = ["hydrant", "dog", "butterfly", "squirrel", "kickball", "sprinkler", "hopscotch", "mailbox", "cat"];
const CHATS = {
    sprint: ["Zoooom!", "Catch me!", "Wheee!"], stumble: ["Whoops!", "Oof!", "Almost!"],
    home: ["Home! Home!", "Almost there!"], idle: ["La la la~", "Hi doggy!", "So fast!", "Race ya!"],
};
const MOM_SAYS = ["Dinaaaa!", "Wait up!", "Honey!", "Hold on!"];

/** Progressive difficulty from the number of runs played (shared 2D save). */
export function difficulty(runsPlayed) {
    const level = (runsPlayed || 0) + 1;
    return { level, diff: Math.min(1 + (level - 1) * 0.12, 2.2) };
}
/** Every run earns a medal: 🥇 win with a 10+ haul · 🥈 a win OR a 10+ haul · 🥉 anything else. */
export function medalFor(won, haul) {
    const big = haul >= MEDAL_HAUL;
    return won && big ? "gold" : (won || big) ? "silver" : "bronze";
}

export const R = { active: false };
const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _w = new THREE.Vector3();
let shadowGeo = null, shadowMat = null;

// ── hazards (3D) ─────────────────────────────────────────────────────────
function makeHazard(type, u, z) {
    const st = street();
    const hz = { type, u, z, r: type === "greenblatt" ? 18 : 14, t: 0, hit: false, obj: null, vx: 0, vy: 0, vz: 0, y: 0, spin: 0, greeted: false };
    let o;
    switch (type) {
        case "hydrant": o = prop("dinaProps", "Hydrant"); o.scale.setScalar(1.15); break;
        case "mailbox": o = prop("dinaProps", "Mailbox"); o.rotation.y = Math.PI; break;
        case "dog": o = prop("dinaProps", "Dog"); o.rotation.y = Math.PI + rand(-0.4, 0.4); hz.tail = node(o, "DogTail"); break;
        case "butterfly": o = prop("dinaProps", "Butterfly"); o.scale.setScalar(1.5); hz.wl = node(o, "Wing_L"); hz.wr = node(o, "Wing_R"); hz.y = 0.85; break;
        case "squirrel": o = prop("dinaProps", "Squirrel"); o.scale.setScalar(1.7); o.rotation.y = Math.PI + rand(-0.6, 0.6); break;
        case "kickball": o = prop("dinaProps", "Kickball"); o.scale.setScalar(1.1); break;
        case "sprinkler": o = prop("dinaProps", "Sprinkler"); hz.head = node(o, "SprinklerHead"); break;
        case "hopscotch": o = prop("dinaProps", "Hopscotch"); o.scale.setScalar(1.2); break;
        case "cat": o = prop("dinaProps", "Cat"); o.rotation.y = Math.PI / 2 + rand(-0.5, 0.5); o.scale.setScalar(1.25); break;
        case "greenblatt": {
            const p = spawnPerson("dinaGreenblatt");
            const paddle = prop("dinaProps", "StopPaddle");
            paddle.rotation.x = Math.PI / 2;   // upright once her arm points forward
            attach(p, "Arm_R", paddle, 0, -0.44, 0.02);
            hz.person = p;
            o = p.obj;
            o.rotation.y = Math.PI;
            break;
        }
    }
    o.position.set(-u, 0, z);
    o.userData.baseScale = o.scale.x;
    o.scale.setScalar(0.001);
    st.scene.add(o);
    hz.obj = o;
    if (!shadowGeo) {
        shadowGeo = new THREE.CircleGeometry(1, 20);
        shadowMat = new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.2, depthWrite: false });
    }
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.scale.setScalar((hz.r + 4) / PXM * 1.1);
    sh.position.set(-u, 0.09, z);
    st.scene.add(sh);
    hz.shadow = sh;
    return hz;
}
function removeHazard(hz) {
    const st = street();
    st.scene.remove(hz.obj);
    st.scene.remove(hz.shadow);
}

function spawnHazard() {
    const z = R.z + SPAWN_AHEAD;
    if (z > RUN_LEN - 1.5) return;
    // Mrs. Greenblatt appears once per run, around the midpoint, always on the sidewalk
    if (!R.greenblatt && R.distance > 0.4 && R.distance < 0.6 && rnd() < 0.4) {
        R.greenblatt = true;
        R.hazards.push(makeHazard("greenblatt", LANES[1], z));
        return;
    }
    R.hazards.push(makeHazard(randPick(TYPES), LANES[randInt(0, 2)], z));
}

function hitHazard(hz) {
    const st = street(), d = R.dina;
    const at = _w.set(-hz.u, 0.9, hz.z);
    switch (hz.type) {
        case "hydrant": case "kickball": case "squirrel": case "mailbox":
            d.stumble = 0.5;
            st.cam.shake = 0.25;
            st.fx.burst(at.set(-hz.u, 0.5, hz.z), 14, { speed: 2.4, colors: ["#FFFFFF", "#FFEB3B", "#FFB74D"], size: 0.1, life: 0.5 });
            sfx.thud();
            rumble(0.5, 0.4, 160, true);
            if (hz.type === "kickball") { hz.vz = R.speed * 1.4 + 3; hz.vy = 3.2; hz.vx = rand(-1, 1); hz.spin = 12; }
            if (hz.type === "squirrel") { hz.vx = (hz.u > 0 ? -1 : 1) * 3.5; hz.vz = 1.5; }
            if (hz.type === "mailbox") hz.wobble = 1;
            R.chat("stumble");
            break;
        case "dog":
            d.stumble = 1.5;
            R.coins += 2;
            st.cam.shake = 0.4;
            sfx.dogBark();
            rumble(0.6, 0.6, 220, true);
            floater("+2 🐕", at, "#FFB74D");
            hz.happy = 1.5;
            break;
        case "butterfly":
            R.coins += 1;
            sfx.tone(1500, 0.08, "sine", 0.15);
            floater("+1 🦋", at, "#FF80AB");
            hz.vy = 1.6; hz.vz = 1.2; hz.vx = rand(-1, 1);
            break;
        case "sprinkler":
            d.sprint = Math.min(3, d.sprint + 1);
            sfx.tone(440, 0.1, "sine", 0.18);
            floater("+⚡", at, "#4FC3F7");
            st.fx.burst(at.set(-hz.u, 0.6, hz.z), 22, { speed: 2.2, colors: ["#4FC3F7", "#B3E5FC", "#FFFFFF"], size: 0.09, life: 0.6, gravity: 6 });
            break;
        case "hopscotch":
            R.stickers++;
            sfx.hop();
            floater("+⭐ sticker", at, "#FFD700");
            d.hopT = 0.45;
            break;
        case "cat":
            R.coins += 1;
            sfx.tone(600, 0.1, "sine", 0.12);
            floater("+1 🐱", at, "#FF8A65");
            hz.happy = 1.2;
            break;
        case "greenblatt":
            if (!hz.greeted) {
                // the crossing guard hands Dina a tootsie roll
                R.coins += 5;
                R.stickers += 1;
                hz.greeted = true;
                sfx.chime();
                floater("🍬 +5", at.set(-hz.u, 1.7, hz.z), "#FFD700");
                d.stumble = 0.4;
                hz.thanks = 1.6;
            }
            break;
    }
}

// ── the run ──────────────────────────────────────────────────────────────
function startRun(data) {
    const st = cast();
    st.set.show();
    const lvl = difficulty(shared.get().dinaRunsPlayed);
    shared.update(s => { s.dinaRunsPlayed = lvl.level; });
    Object.assign(R, {
        active: true, level: lvl.level, diff: lvl.diff, timer: 0, z: 0, distance: 0, coins: 0, stickers: 0, speed: BASE,
        hazards: [], greenblatt: false, spawnT: 0, ended: false, result: null,
        mom: { distance: 1, says: 0, sayTimer: rand(4, 8), x: 0, z: -9 },
        dina: { u: 0, sprint: 3, stumble: 0, chatTimer: rand(3, 6), chat: "", chatLife: 0, hopT: 0 },
        chat(kind) { R.dina.chat = randPick(CHATS[kind]); R.dina.chatLife = 1.6; R.dina.chatTimer = rand(4, 8); },
    });
    const d = st.dina;
    d.obj.visible = true;
    d.obj.position.set(0, 0, 0);
    d.obj.rotation.set(0, 0, 0);
    st.mom.obj.visible = true;
    st.mom.obj.position.set(0, 0, -9);
    st.mom.obj.rotation.set(0, 0, 0);
    if (!data || !data.fromBus) st.cam.snap = true;
    R.person = d;
    R.sprintEl = L.add(`<i></i><b></b>`, "dl-sprint");
    L.pauseButton();
    R.hintT = 4.5;
    L.show();
    input.stick2d = true;
    document.body.classList.add("dina-run");
    A.setMusic("../dina.mp3");
    emit("stat", { id: "dinaRuns", n: 1 });
}

/** Test/debug: drop a hazard `ahead` metres in front of Dina, in her lane. */
export function debugSpawn(type, ahead = 3) {
    if (!R.active) return false;
    const hz = makeHazard(type, R.dina.u, R.z + ahead);
    hz.t = 1;
    R.hazards.push(hz);
    return true;
}

function clearHazards() {
    for (const hz of R.hazards || []) removeHazard(hz);
    R.hazards = [];
}

registerState("dinaRun", {
    hud: false, touch: true, pausable: true, world: false,
    enter(data) { startRun(data); },
    exit(next) {
        input.stick2d = false;
        document.body.classList.remove("dina-run");
        if (next !== "dinaCaught") clearHazards();
        R.active = false;
        L.clear();
    },
    update(dt, P) {
        const st = street(), d = R.dina, mom = R.mom, person = R.person;
        R.timer += dt;
        st.fx.update(dt);

        // Sprint / slow. The meter only RECHARGES when you're NOT holding sprint —
        // otherwise holding it on an empty bar would refill and re-engage forever.
        const wantSprint = input.throttle > 0.3 || input.moveY < -0.55;
        const sprint = wantSprint && d.sprint > 0;
        if (sprint) d.sprint = Math.max(0, d.sprint - dt);
        else if (!wantSprint) d.sprint = Math.min(3, d.sprint + dt * 0.6);
        const slow = !wantSprint && (input.brake > 0.3 || input.moveY > 0.55);

        // ONE source of truth for motion (2D: dinaScrollY)
        let mult = sprint ? 2.0 : slow ? 0.5 : 1.0;
        if (d.stumble > 0) { mult *= 0.3; d.stumble = Math.max(0, d.stumble - dt); }
        R.speed = BASE * mult;
        R.z += R.speed * dt;
        R.distance = Math.min(R.z / RUN_LEN, 1);

        // steering: left stick / D-pad / ← → / the touch stick, smooth like Lulu's car
        d.u = clamp(d.u + input.moveX * STEER * dt, -UMAX, UMAX);

        // hazards: denser as the run goes on (and on higher run levels)
        R.spawnT -= dt;
        if (R.spawnT <= 0 && R.timer < DURATION - 4) {
            const prog = R.distance;
            R.spawnT = rand(0.9, 1.6) * (1 - prog * 0.55) / R.diff;
            spawnHazard();
            if (prog > 0.5 && rnd() < 0.35 * prog * R.diff) spawnHazard();
        }
        const reach = (hz) => (hz.r + 15) / PXM;
        for (let i = R.hazards.length - 1; i >= 0; i--) {
            const hz = R.hazards[i];
            hz.t += dt;
            if (hz.z < R.z - DESPAWN && !(hz.vz > 0 && hz.z > R.z - 30)) { removeHazard(hz); R.hazards.splice(i, 1); continue; }
            if (!hz.hit) {
                const du = d.u - hz.u, dz = R.z - hz.z;
                if (du * du + dz * dz < reach(hz) * reach(hz)) { hz.hit = true; hitHazard(hz); }
            }
            animateHazard(hz, dt);
        }

        // Mom chase — a real RACE: she gains steadily (faster on higher runs);
        // only sprinting buys distance back; mistakes let her surge.
        const ramp = (0.012 + R.distance * 0.022) * R.diff;
        mom.distance = Math.max(0, mom.distance - ramp * dt);
        if (sprint) mom.distance = Math.min(1, mom.distance + 0.075 * dt);
        if (d.stumble > 0) mom.distance = Math.max(0, mom.distance - 0.16 * dt);
        if (slow) mom.distance = Math.max(0, mom.distance - 0.06 * dt);
        if (R.timer > DURATION - 8) mom.distance = Math.max(0, mom.distance - 0.04 * dt);
        mom.sayTimer -= dt;
        if (mom.sayTimer <= 0) { mom.says = (mom.says + 1) % 4; mom.sayTimer = rand(4, 8); }

        // Dina's cheerful chatter
        d.chatTimer -= dt;
        if (d.chatLife > 0) d.chatLife -= dt;
        if (d.chatTimer <= 0) R.chat(sprint ? "sprint" : d.stumble > 0 ? "stumble" : R.distance > 0.7 ? "home" : "idle");

        // ── the people ──
        const o = person.obj;
        o.position.set(-d.u, 0, R.z);
        d.hopT = Math.max(0, d.hopT - dt);
        o.position.y = d.hopT > 0 ? Math.sin((1 - d.hopT / 0.45) * Math.PI) * 0.4 : 0;
        o.rotation.set(sprint ? 0.14 : 0.05, -input.moveX * 0.25, d.stumble > 0 ? Math.sin(R.timer * 22) * 0.12 : 0);
        person.update(dt, { walk: R.speed * 1.15 });
        if (R.timer % 0.32 < dt && !d.stumble) sfx.step();
        const mo = R.person && st.mom.obj;
        mom.z = R.z - (1.6 + mom.distance * 6.2);
        mom.x += (o.position.x - mom.x) * Math.min(1, dt * 2);
        mo.position.set(mom.x, 0, mom.z);
        mo.rotation.set(0.08, 0, 0);
        st.mom.update(dt, { walk: R.speed * 1.05, wave: mom.sayTimer < 1 });

        // ── HUD, bubbles, glow ──
        hud(sprint);
        const cam = st.set.camera;
        if (d.chatLife > 0) bubble("dina", d.chat, _p.set(o.position.x, 2.25, o.position.z), cam);
        if (mom.sayTimer < 1) bubble("mom", "👩 " + MOM_SAYS[mom.says], _p.set(mom.x, 2.15, mom.z), cam, "", { x: 0.5, y: 0.8 });
        if (mom.distance < 0.15) bubble("alert", "!", _p.set(o.position.x + 0.35, 1.6, o.position.z), cam, "alert");
        for (const hz of R.hazards) {
            if (hz.type !== "greenblatt") continue;
            const ahead = hz.z - R.z;
            if (!hz.greeted && ahead > 3 && ahead < 16) bubble("gb", "Hi mamaleh!", _p.set(-hz.u, 2.05, hz.z), cam);
            if (hz.thanks > 0) bubble("gb", "🍬 Here, mamaleh!", _p.set(-hz.u, 2.05, hz.z), cam);
        }
        bubblesDone();
        updateFloaters(dt, cam);
        if (mom.distance < 0.3) {
            const glow = (0.3 - mom.distance) / 0.3;
            L.tint("radial-gradient(ellipse at center, rgba(255,200,0,0) 35%, rgba(255,170,0,.75) 100%)", (glow * 0.8).toFixed(3));
        } else L.tint("transparent", 0);
        sprintBar(sprint, cam);
        R.hintT -= dt;
        L.prompt(R.hintT > 0 ? `<div>${controlsHint()}</div>` : "");

        // ── camera: behind Dina, pulling back when Mom is close so you see her coming ──
        const close = clamp((0.42 - mom.distance) / 0.42, 0, 1);
        const portrait = cam.aspect < 1;
        const back = (5.0 + close * 2.4) * (portrait ? 1.25 : 1), up = (2.9 + close * 0.9) * (portrait ? 1.12 : 1);
        camTo(_p.set(o.position.x * 0.55, up, R.z - back), _l.set(o.position.x * 0.7, 0.85, R.z + 4.5), dt, 4, 58 + (sprint ? 6 : 0));
        st.sunFollow(0, R.z);

        // ── endings ──
        if (R.distance >= 1) { finish(true); return; }
        if (mom.distance <= 0) { finish(false); return; }
    },
});

function animateHazard(hz, dt) {
    const o = hz.obj, base = o.userData.baseScale;
    const k = Math.min(1, hz.t / 0.3);
    o.scale.setScalar(base * Math.max(0.001, easeOutBack(k)));
    // the telegraph: a pulsing ground shadow until you reach it
    const ahead = hz.z - R.z;
    hz.shadow.visible = !hz.hit && ahead > 0.3;
    shadowMat.opacity = (0.35 + 0.25 * Math.sin(R.timer * 12)) * 0.45;
    hz.shadow.position.set(-hz.u, 0.09, hz.z);
    switch (hz.type) {
        case "dog":
            if (hz.tail) hz.tail.rotation.y = Math.sin(hz.t * (hz.happy > 0 ? 26 : 10)) * 0.6;
            hz.happy = Math.max(0, (hz.happy || 0) - dt);
            o.position.y = hz.happy > 0 ? Math.abs(Math.sin(hz.t * 9)) * 0.25 : 0;
            break;
        case "butterfly": {
            const f = Math.sin(hz.t * 25) * 0.9;
            if (hz.wl) hz.wl.rotation.z = f;
            if (hz.wr) hz.wr.rotation.z = -f;
            hz.y += hz.vy * dt;
            o.position.y = hz.y + Math.sin(hz.t * 3) * 0.12;
            o.position.x += hz.vx * dt; hz.z += hz.vz * dt;
            o.rotation.y = Math.PI + Math.sin(hz.t * 1.3) * 0.5;
            break;
        }
        case "sprinkler": if (hz.head) hz.head.rotation.y += dt * 2.5; break;
        case "cat":
            hz.happy = Math.max(0, (hz.happy || 0) - dt);
            o.position.y = hz.happy > 0 ? Math.abs(Math.sin(hz.t * 8)) * 0.1 : 0;
            break;
        case "mailbox":
            hz.wobble = Math.max(0, (hz.wobble || 0) - dt * 1.5);
            o.rotation.z = Math.sin(hz.t * 18) * 0.18 * (hz.wobble || 0);
            break;
        case "greenblatt": {
            hz.thanks = Math.max(0, (hz.thanks || 0) - dt);
            hz.person.face(-R.dina.u, R.z, dt, 4);
            hz.person.update(dt, { talk: hz.thanks > 0 || (!hz.greeted && ahead < 16) });
            poseLimb(hz.person, "Arm_R", -1.35 + Math.sin(hz.t * 2) * 0.12, 0.05);   // STOP paddle up
            if (hz.thanks > 0) poseLimb(hz.person, "Arm_L", -1.2, -0.2);               // …and a tootsie roll
            break;
        }
    }
    if (hz.vx || hz.vz || hz.vy) {
        if (hz.type === "kickball") { hz.vy -= 9.8 * dt; hz.y = Math.max(0, hz.y + hz.vy * dt); if (hz.y === 0) hz.vy = Math.abs(hz.vy) * 0.55; o.rotation.x += hz.spin * dt; }
        if (hz.type !== "butterfly") { o.position.x += hz.vx * dt; hz.z += hz.vz * dt; o.position.y = hz.type === "kickball" ? hz.y : o.position.y; }
    }
    o.position.z = hz.z;
    if (hz.type !== "butterfly" && hz.type !== "kickball" && hz.type !== "squirrel") o.position.x = -hz.u;
}

function hud(sprint) {
    const d = R.dina, pct = (R.distance * 100).toFixed(1), left = Math.max(0, Math.ceil(DURATION - R.timer));
    const m = R.mom.distance, momCol = m > 0.5 ? "#7CFC4F" : m > 0.25 ? "#FFC107" : "#FF5252";
    const pips = "▰".repeat(Math.ceil(m * 5)) + "▱".repeat(5 - Math.ceil(m * 5));
    L.hud(`<span class="t">⏱ ${left}s</span><span class="chip">⚡ ${d.sprint.toFixed(1)}s</span>
        <div class="dl-bar"><i style="width:${pct}%"></i><b style="left:${pct}%">👧</b><b style="left:100%">🏠</b></div>
        <span class="chip" style="color:${momCol}">👩 ${pips}</span>
        <span class="chip gold">⭐ ${R.stickers}</span><span class="chip gold">💰 ${R.coins}</span><span class="chip">Run #${R.level}</span>`);
}
const _s = {};
function sprintBar(sprint, cam) {
    const el = R.sprintEl;
    if (!el) return;
    const o = R.person.obj;
    toScreen(_w.set(o.position.x, -0.05, o.position.z), cam, _s);
    const f = clamp(R.dina.sprint / 3, 0, 1);
    el.style.left = _s.x.toFixed(1) + "px";
    el.style.top = (_s.y + 10).toFixed(1) + "px";
    const i = el.firstChild, b = el.lastChild;
    i.style.width = (f * 62).toFixed(1) + "px";
    i.style.background = f > 0.5 ? "#7CFC4F" : f > 0.2 ? "#FFC107" : "#FF5252";
    b.textContent = sprint && f > 0.05 ? "⚡" : "";
}
function controlsHint() {
    if (input.device === "touch") return `🕹️ Stick to dodge · hold ⚡ SPRINT · 🐢 SLOW — beat Mom home!`;
    if (input.device === "gamepad") return `${g("move")} dodge · hold ${g("confirm")}/${g("gas")} sprint ⚡ · ${g("brake")} slow 🐢 — beat Mom home!`;
    return `${g("steer")} dodge · hold ${g("gas")} sprint ⚡ · ${g("brake")} slow 🐢 — beat Mom home!`;
}

// ── banking + the porch ending ───────────────────────────────────────────
/** Bank what Dina earned into the shared save (coins + stickers → the 💰 wallet; win bonus 25). */
export function bankRun(won, coinsRun, stickers) {
    const winBonus = won ? WIN_BONUS : 0;
    const coins = coinsRun + winBonus;
    wallet.add(coins + stickers);
    const haul = coinsRun + stickers;
    const medal = medalFor(won, haul);
    let prevBest = 0;
    shared.update(s => {
        if (!s.dinaMedals || typeof s.dinaMedals !== "object") s.dinaMedals = { gold: 0, silver: 0, bronze: 0 };
        s.dinaMedals[medal] = (s.dinaMedals[medal] || 0) + 1;
        prevBest = s.dinaBest || 0;
        if (haul > prevBest) s.dinaBest = haul;
    });
    flushShared();
    const res = { won, winBonus, coins, stars: stickers, banked: coins + stickers, haul, medal, newBest: haul > prevBest && prevBest > 0, best: Math.max(prevBest, haul) };
    emit("stat", { id: "dinaMedal_" + medal, n: 1 });
    emit("dina:run", res);
    return res;
}

function finish(won) {
    if (R.ended) return;
    R.ended = true;
    R.result = bankRun(won, R.coins, R.stickers);
    if (won) sfx.win(); else sfx.tone(440, 0.18, "sine", 0.2);
    setState("dinaCaught", R.result);
}

const C = { t: 0, medal: null, res: null };
const MEDAL_COLS = { gold: ["#FFC107", "#8D6E00"], silver: ["#CFD8DC", "#546E7A"], bronze: ["#D7834F", "#7B3F1D"] };
const CONFETTI = ["#FF4FA3", "#FFD700", "#4FC3F7", "#7CFC4F", "#FF8A65", "#BA68C8"];

registerState("dinaCaught", {
    hud: false, touch: false, pausable: false, world: false,
    enter(res) {
        const st = cast();
        st.set.show();
        clearHazards();
        C.t = 0; C.res = res;
        const d = st.dina, m = st.mom;
        const porchZ = HOME_Z - 5.5;
        d.obj.visible = true;
        d.obj.position.set(res.won ? 0 : 0.35, 0.25, porchZ);
        d.obj.rotation.set(0, Math.PI, 0);
        m.obj.visible = !res.won;
        m.obj.position.set(-0.45, 0.25, porchZ + 0.1);
        m.obj.rotation.set(0, Math.PI, 0);
        // the medal, hovering by the door
        const md = prop("dinaProps", "Medal");
        const mats = ownMaterials(md, ["MedalMetal", "MedalRim"]);
        const [c1, c2] = MEDAL_COLS[res.medal];
        mats.MedalMetal.color.set(c1); mats.MedalRim.color.set(c2);
        for (const n of [1, 2, 3]) { const k = node(md, "Num" + n); if (k) k.visible = n === { gold: 1, silver: 2, bronze: 3 }[res.medal]; }
        md.position.set(-1.6, 1.9, porchZ - 0.4);
        md.scale.setScalar(0.001);
        md.rotation.y = Math.PI;
        st.scene.add(md);
        C.medal = md;
        st.cam.snap = true;
        if (res.won) for (let i = 0; i < 60; i++) st.fx.emit(rand(-3, 3), rand(3, 5), porchZ + rand(-2.5, 1), rand(-0.6, 0.6), rand(-1, 0.5), rand(-0.5, 0.5), 0.13, rand(2, 3.5), randPick(CONFETTI), 1.2);
        document.body.classList.add("dina-result-on");
        L.show();
        const title = res.won ? "YOU MADE IT HOME! 🏆" : "MOM CAUGHT UP! 🤗";
        const label = { gold: "🥇 GOLD!", silver: "🥈 SILVER!", bronze: "🥉 BRONZE!" }[res.medal];
        H.showScreen(`<h2>${title}</h2>
            <div class="dina-medal ${res.medal}">${label}</div>
            <p class="${res.newBest ? "dina-best" : ""}">${res.newBest ? `⭐ NEW BEST HAUL: ${res.haul}!` : `Haul ${res.haul} · best ${res.best}`}</p>
            <p><b>Banked: 💰 ${res.banked}</b>${res.winBonus ? ` (+${res.winBonus} win bonus!)` : ""}</p>
            <p class="fine">Added to your bank: ${wallet.coins.toLocaleString()} 💰 — shared with Lulu's road trip</p>`,
            [
                { label: `🏠 Go inside ${g("confirm")}`, cls: "pink", action: () => setState("dinaHome", { from: "run" }) },
                { label: "↺ Race home again", cls: "alt", action: () => setState("dinaRun") },
            ], { cls: "dina-result", onBack: () => setState("dinaHome", { from: "run" }) });
    },
    exit() {
        const st = street();
        if (C.medal) { st.scene.remove(C.medal); C.medal = null; }
        st.mom.obj.visible = false;
        document.body.classList.remove("dina-result-on");
        H.hideScreen();
        L.clear();
    },
    update(dt, P) {
        const st = street(), d = st.dina, m = st.mom, res = C.res;
        C.t += dt;
        st.fx.update(dt);
        H.menuInput(P);
        const porchZ = HOME_Z - 5.5;
        if (res.won) {
            // victory hops that settle, then hands up
            const jump = Math.abs(Math.sin(C.t * 6)) * 0.45 * Math.max(0, 1 - C.t / 2.2);
            d.obj.position.y = 0.25 + jump;
            d.update(dt, { cheer: C.t < 2.6, wave: C.t >= 2.6 });
            if (C.t < 2.0 && Math.random() < 0.5) st.fx.emit(rand(-3, 3), 4.5, porchZ + rand(-2, 1), rand(-0.4, 0.4), -0.5, 0, 0.13, 3, randPick(CONFETTI), 1.2);
        } else {
            // holding hands with Mom
            d.update(dt, { talk: C.t < 2 });
            poseLimb(d, "Arm_L", -0.25, 0.55);
            m.update(dt, { talk: C.t > 1 && C.t < 3 });
            poseLimb(m, "Arm_R", -0.2, -0.42);
        }
        const msg = res.won ? "I BEAT YOU,\nMOM!" : "Fine,\nlet's walk\ntogether.";
        bubble("dina", msg, _p.set(d.obj.position.x, d.obj.position.y + 1.55, porchZ), st.set.camera);
        bubblesDone();
        if (C.medal) {
            const k = clamp(C.t / 0.6, 0, 1);
            C.medal.scale.setScalar(Math.max(0.001, easeOutBack(k)) * 1.6);
            C.medal.rotation.y = Math.PI + Math.sin(C.t * 1.6) * 0.6;
            C.medal.rotation.z = Math.sin(C.t * 3) * 0.08;
        }
        const portrait = st.set.camera.aspect < 1;
        camTo(_p.set(-0.3, 2.1, porchZ - (portrait ? 8.5 : 6.4) + Math.min(C.t, 6) * 0.12), _l.set(-0.3, 1.45, porchZ + 0.5), dt, 2, 50);
        st.sunFollow(0, porchZ);
        if (C.t > 14) setState("dinaHome", { from: "run" });   // a gentle auto "tap to enter home"
    },
});
