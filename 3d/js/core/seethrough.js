// 🌳 SEE-THROUGH LEAVES (ci/sweep-camera): a tree's leaves between the camera and Lulu (or her car) are cut away in a
// soft, dithered tube along the line of sight — the way third-person games keep foliage from filling the screen.
//
// Why a cut and not the camera's clip: the camera keeps OUT of the walls (core/camera.js orbit / the chase cam's carClip,
// foot/jump.js camClip), but pulling it in for every street tree that passes behind her popped it in and out along a
// row of trees — and NOT pulling it in left a screen full of olive green on a phone (the leaves 1–3 m from the lens,
// her behind them: qaweekend's "Lakewood on foot" shot at the Feldmans' door). Leaves are soft: they just thin out.
//
// Only LEAVES (and bushes / hedges' brush) and tree trunks are cut, never a wall: the town's merged scenery is one material, so its leaf
// vertices carry a flag in their colour (red + LEAF_FLAG — features/town/kit.js bakes it, the patched shader takes it back
// off); the highway's merged leaves have a material of their own (merge.js), cut whole, and its trunks are flagged.
//
//   seeThrough(material, { all })  patch a material (all: every fragment counts as a leaf)
//   SEE.set(a, b) / SEE.off()       the line of sight this frame: a = the camera, b = what it looks at (core/camera.js)
import * as THREE from "three";

/** Added to a vertex's red channel by the scenery bakers (real colours are 0–1): a tree's leaves or its trunk (a street
 *  tree's trunk between the lens and her hid her completely on Ocean Parkway; the camera pulled in to a kerb's tree line
 *  sat in one — the bottom of a phone one brown wall). */
export const LEAF_FLAG = 4;
/** Does a scenery material's parts get the flag (by its name)? → the flag or 0. */
export const seeFlag = name => /Leaves|^Brush$|^Bush|^(Bark|PalmBark)$/i.test(name || "") ? LEAF_FLAG : 0;
export const SEE_TUBE = { r0: 1.15, r1: 0.6, short: 0.35, minY: 0.3 };

const U = {
    uSeeA: { value: new THREE.Vector3() }, uSeeB: { value: new THREE.Vector3() },
    uSeeOn: { value: 0 }, uSeeR: { value: new THREE.Vector2(SEE_TUBE.r0, SEE_TUBE.r1) }, uSeeMinY: { value: SEE_TUBE.minY },
};
const _d = new THREE.Vector3();
export const SEE = {
    /** The line of sight this frame: from the camera `a` to the point `b` it frames (her chest / the car). */
    set(a, b) {
        _d.subVectors(a, b);
        const L = _d.length();
        if (!(L > 0.8) || !Number.isFinite(L)) { U.uSeeOn.value = 0; return; }
        U.uSeeA.value.copy(a);
        U.uSeeB.value.copy(b).addScaledVector(_d, SEE_TUBE.short / L);
        U.uSeeOn.value = 1;
    },
    off() { U.uSeeOn.value = 0; },
    get on() { return U.uSeeOn.value > 0.5; },
    /** Tests: the tube right now. */
    get debug() { return { on: U.uSeeOn.value, a: U.uSeeA.value.toArray(), b: U.uSeeB.value.toArray() }; },
};

const VERT_PARS = "varying vec3 vSeeW;\nvarying float vSee;\n";
const FRAG_PARS = "varying vec3 vSeeW;\nvarying float vSee;\nuniform vec3 uSeeA;\nuniform vec3 uSeeB;\nuniform float uSeeOn;\nuniform vec2 uSeeR;\nuniform float uSeeMinY;\n";
const FRAG_CUT = `
    if (uSeeOn > 0.5 && vSee > 0.5 && vSeeW.y > uSeeMinY) {
        vec3 ab = uSeeB - uSeeA;
        float h = dot(vSeeW - uSeeA, ab) / max(dot(ab, ab), 1e-4);
        if (h > 0.0 && h < 1.0) {
            float r = mix(uSeeR.x, uSeeR.y, h);
            float d = length(vSeeW - uSeeA - ab * h);
            float k = 1.0 - smoothstep(r * 0.55, r, d);
            // (screen-space dither: a soft edge without transparency — no sorting, it stays one draw)
            float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (k > n) discard;
        }
    }`;

/** Patch a merged-scenery material so its leaves are cut along the line of sight. Composes with an existing
 *  onBeforeCompile (the wind sway: core/gfx.js), whichever is added first. */
export function seeThrough(m, { all = false } = {}) {
    if (!m || m.userData.seeThrough) return m;
    m.userData.seeThrough = all ? "all" : "flag";
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, r) {
        if (prev) prev.call(this, sh, r);
        Object.assign(sh.uniforms, U);
        sh.vertexShader = VERT_PARS + sh.vertexShader
            .replace("#include <color_vertex>", `#include <color_vertex>
    vSee = ${all ? "1.0" : "0.0"};
    #ifdef USE_COLOR
        if (vColor.r > ${(LEAF_FLAG - 1).toFixed(1)}) { vColor.r -= ${LEAF_FLAG.toFixed(1)}; vSee = 1.0; }
    #endif`)
            .replace("#include <project_vertex>", `#include <project_vertex>
    {
        vec4 sw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
        #endif
        vSeeW = (modelMatrix * sw).xyz;
    }`);
        sh.fragmentShader = FRAG_PARS + sh.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>" + FRAG_CUT);
    };
    m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : "") + "|see3" + (all ? "a" : "f"); };
    m.needsUpdate = true;
    return m;
}
/** Tests / the probe: is this material patched? */
export const isSeeThrough = m => !!(m && m.userData && m.userData.seeThrough);
