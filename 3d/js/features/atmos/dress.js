// features/atmos/dress.js — the WORLD'S SKY ON A SET.
//
// A cutscene set (the precinct steps, the parking lot, the wedding lawn…) is its
// own little scene, so it used to show a fixed preset: broad daylight at 2 am, sunshine
// in a storm. Now every outdoor set can wear the sky the player just drove out of:
//
//   look()            → the world's current look (sky gradient, fog, hemi + sun light,
//                       darkness, rain / snow / fog, the time of day) — the last thing the
//                       driving scene showed (our blend in Cruise, the journey's leg in
//                       Story, shabbos's sunset clock…), or the live scene when atmos
//                       isn't ticking (tests without &enable=atmos, a feature turned off)
//   dress(set, opts)  → apply it: a sky dome with that gradient (+ stars at night), the
//                       fog colour (its distance scaled like the world's), the light, the
//                       rain / snow falling round the set's camera, warm lamps at night
//
// The atmos clock doesn't move while a set is up (it only runs while she drives or
// walks), so walking IN and walking OUT of the same place show the same sky — no jumps.
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { S, clamp, smooth, quality, QMUL } from "./common.js";
import { phaseName } from "./sky.js";
import { W, makeRain, makeSnow, MAX_RAIN, MAX_SNOW } from "./weather.js";
import * as sfx from "./sfx.js";

const NOON_NEAR = 160, NOON_FAR = 640;     // the world's daytime fog (sky.js NOON) — set fog scales against it

function blank() {
    return { top: new THREE.Color(), mid: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(), near: NOON_NEAR, far: NOON_FAR,
        hs: new THREE.Color(), hg: new THREE.Color(), hi: 1.35, sc: new THREE.Color(), si: 2.6, lightDir: new THREE.Vector3(0.3, 0.8, -0.2),
        night: 0, day: 1, rain: 0, snow: 0, fogAmt: 0, cloud: 0.3, kind: "clear", clock: 0, phase: "day", src: "none", t: -1 };
}
const snap = blank(), live = blank();
let haveSnap = false;

/** Copy the driving scene's current sky + light into `o` (whatever wrote it last). */
function readScene(o) {
    const w = ctx.world, L = ctx.lights, F = ctx.scene && ctx.scene.fog;
    if (!w || !w.sky || !L) return false;
    const u = w.sky.material.uniforms;
    o.top.copy(u.top.value); o.mid.copy(u.mid.value); o.bottom.copy(u.bottom.value);
    if (F) { o.fog.copy(F.color); o.near = F.near; o.far = F.far; } else { o.fog.copy(o.bottom); o.near = NOON_NEAR; o.far = NOON_FAR; }
    o.hs.copy(L.hemi.color); o.hg.copy(L.hemi.groundColor); o.hi = L.hemi.intensity;
    o.sc.copy(L.sun.color); o.si = L.sun.intensity;
    if (L.sunOffset) o.lightDir.copy(L.sunOffset).normalize();
    return true;
}

/** atmos's tick calls this after it has written the frame's sky (the world is on screen). */
export function snapshotLook() {
    if (!readScene(snap)) return;
    snap.night = S.night; snap.day = S.day; snap.rain = S.rain; snap.snow = S.snow; snap.fogAmt = S.fog; snap.cloud = S.cloud;
    snap.kind = W.kind; snap.clock = S.clock; snap.phase = S.mode === "cruise" ? phaseName(S.clock) : S.night > 0.6 ? "night" : "day";
    snap.src = "atmos"; snap.t = ctx.time;
    haveSnap = true;
}
on("run:start", () => { haveSnap = false; });

/** The world's current look (see the header). Don't keep it: it's reused. */
export function look() {
    if (haveSnap) return snap;
    readScene(live);
    // no atmos tick to tell us: guess the darkness from the light (a night leg, the Strip)
    live.night = clamp((1.75 - live.si) / 1.0);
    live.day = 1 - live.night;
    live.rain = live.snow = live.fogAmt = 0; live.cloud = 0.3; live.kind = "clear";
    live.phase = live.night > 0.6 ? "night" : "day";
    live.src = "scene"; live.t = ctx.time;
    return live;
}

// ── the pieces a dressed set gets (made once per set, reused on every show) ──
const SKY_VS = "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }";
function domeFor(set) {
    // the world's own sky shader (normalised position → any radius works), with our own uniforms
    const src = ctx.world && ctx.world.sky && ctx.world.sky.material;
    const mat = src ? src.clone() : new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
        vertexShader: SKY_VS,
        fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bottom, mid, smoothstep(-0.02, 0.15, h)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}",
    });
    const dome = new THREE.Mesh(set.own(new THREE.SphereGeometry(200, 24, 12)), set.own(mat));
    dome.renderOrder = -2;
    dome.frustumCulled = false;
    dome.onBeforeRender = (r, sc, cam) => { dome.position.copy(cam.position); };
    return dome;
}
function starsFor(set) {
    const n = 420, pos = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y);
        pos.set([Math.cos(a) * r * 180, y * 180, Math.sin(a) * r * 180], i * 3);
    }
    const g = set.own(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = set.own(new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    const pts = new THREE.Points(g, m);
    pts.renderOrder = -1;
    pts.frustumCulled = false;
    pts.onBeforeRender = (r, sc, cam) => { pts.position.copy(cam.position); };
    return pts;
}

let rainingSet = null;
function stopRain(set) { if (!set || rainingSet === set) { rainingSet = null; sfx.rainLoop(0); } }
on("state", () => stopRain(null));      // the next dressed render (if any) starts it again

const C = new THREE.Color();
/**
 * Dress an OUTDOOR set in the world's current sky. Call it every time the set is shown.
 * opts: { sky (dome, default true), stars (true), fog (true), lights (true), weather (true),
 *         lamps: [[x, y, z], …] warm lights that come on after dark, intensity (lamp brightness, 6) }
 * Returns the look it used ({ night, rain, snow, phase, kind, … }).
 */
export function dress(set, opts = {}) {
    if (!set || !set.scene) return null;
    const lk = look();
    const D = set.userData || (set.userData = {});
    let st = D.atmosDress;
    if (!st) {
        const F = set.scene.fog;
        st = D.atmosDress = {
            fog: F ? [F.near, F.far] : null,
            dome: null, stars: null, rain: null, snow: null, lamps: [],
        };
        if (opts.sky !== false) { st.dome = domeFor(set); set.add(st.dome); }
        if (opts.stars !== false) { st.stars = starsFor(set); set.add(st.stars); }
        if (opts.weather !== false) {
            st.rain = makeRain(); st.snow = makeSnow();
            st.rain.material.uniforms.uBox.value.set(26, 14, 26);
            st.snow.material.uniforms.uBox.value.set(30, 16, 30);
            for (const m of [st.rain, st.snow]) {
                set.own(m.geometry, m.material);
                set.add(m);
                m.onBeforeRender = () => {
                    m.material.uniforms.uTime.value = ctx.time;
                    if (m === st.rain && !ctx.skipping) { rainingSet = set; sfx.rainLoop(st.rainLevel * 0.85, "foot"); }
                };
            }
        }
        for (const p of opts.lamps || []) {
            const l = new THREE.PointLight("#ffcf8a", 0, 14, 1.6);
            l.position.set(p[0], p[1], p[2]);
            set.add(l);
            st.lamps.push(l);
        }
        // hiding the set stops its rain on the roof (the next set may be indoors)
        const hide = set.hide;
        set.hide = () => { hide(); stopRain(set); };
    }
    // the sky: dome + background (behind the dome) + stars
    if (st.dome) {
        const u = st.dome.material.uniforms;
        u.top.value.copy(lk.top); u.mid.value.copy(lk.mid); u.bottom.value.copy(lk.bottom);
        st.dome.visible = true;
    }
    if (opts.sky !== false) set.scene.background = (set.scene.background && set.scene.background.isColor ? set.scene.background : new THREE.Color()).copy(lk.mid);
    if (st.stars) {
        const a = smooth(0.45, 0.95, lk.night) * (1 - lk.cloud * 0.55) * (1 - lk.rain) * (1 - lk.fogAmt * 0.95) * (1 - lk.snow * 0.8);
        st.stars.material.opacity = a;
        st.stars.visible = a > 0.01;
    }
    // fog: the world's colour; its distance scales the set's own like the world's against a clear noon
    if (opts.fog !== false) {
        if (st.fog) {
            const kn = clamp(lk.near / NOON_NEAR, 0.02, 1.3), kf = clamp(lk.far / NOON_FAR, 0.04, 1.3);
            const near = st.fog[0] * kn, far = Math.max(near + 8, st.fog[1] * kf);
            if (set.scene.fog) { set.scene.fog.color.copy(lk.fog); set.scene.fog.near = near; set.scene.fog.far = far; }
            else set.scene.fog = new THREE.Fog(lk.fog.getHex(), near, far);
        } else if (lk.fogAmt > 0.05 || lk.rain > 0.3) {
            set.scene.fog = new THREE.Fog(lk.fog.getHex(), 4 + 60 * (1 - lk.fogAmt), 60 + 160 * (1 - lk.fogAmt));
            st.fog = null;
        }
    }
    // the light
    if (opts.lights !== false) {
        set.hemi.color.copy(lk.hs); set.hemi.groundColor.copy(lk.hg); set.hemi.intensity = lk.hi;
        set.sun.color.copy(lk.sc); set.sun.intensity = lk.si;
    }
    // weather round the camera
    const q = QMUL[quality()] || 1;
    st.rainLevel = lk.rain;
    if (st.rain) {
        const ru = st.rain.material.uniforms;
        st.rain.visible = lk.rain > 0.004;
        ru.uAmount.value = lk.rain;
        ru.uStreak.value.set(S.wind.x * 0.05, 1, S.wind.z * 0.05).normalize();
        ru.uLen.value = 0.6;
        ru.uBeam.value = 0;
        ru.uColor.value.set("#e4ecf5").lerp(C.set("#9fb0d0"), lk.night);
        ru.uOpacity.value = 0.6 - lk.night * 0.12;
        st.rain.geometry.setDrawRange(0, Math.ceil(MAX_RAIN * 0.6 * q) * 6);
    }
    if (st.snow) {
        const su = st.snow.material.uniforms;
        st.snow.visible = lk.snow > 0.004;
        su.uAmount.value = lk.snow;
        su.uColor.value.set("#ffffff").lerp(C.set("#c8d2ee"), lk.night);
        st.snow.geometry.setDrawRange(0, Math.ceil(MAX_SNOW * 0.6 * Math.max(0.45, q)) * 6);
    }
    if (!(lk.rain > 0.004)) stopRain(set);
    const lampOn = smooth(0.25, 0.65, Math.max(lk.night, lk.fogAmt * 0.6, lk.rain * 0.5));
    for (const l of st.lamps) l.intensity = lampOn * (opts.intensity || 6);
    D.atmosLook = { night: lk.night, rain: lk.rain, snow: lk.snow, fog: lk.fogAmt, phase: lk.phase, kind: lk.kind, clock: lk.clock, src: lk.src,
        sky: "#" + lk.mid.getHexString(), lamps: lampOn };
    set.scene.userData.atmosLook = D.atmosLook;      // (tests: ctx.view.scene.userData.atmosLook)
    return D.atmosLook;
}

/** Take the world's sky off a set that also plays its own looks (the parking challenge's levels). */
export function undress(set) {
    const st = set && set.userData && set.userData.atmosDress;
    if (!st) return;
    for (const o of [st.dome, st.stars, st.rain, st.snow]) if (o) o.visible = false;
    for (const l of st.lamps) l.intensity = 0;
    stopRain(set);
    set.userData.atmosLook = set.scene.userData.atmosLook = null;
}
