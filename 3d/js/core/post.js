// HIGH only: a small, soft bloom on whatever is brighter than white — headlights, tail lights,
// neon, lit windows, the atmos light flares, the nitro flame, the sun. The scene renders into an
// HDR target (MSAA), the bright part is pulled out and blurred down a 5-level pyramid (dual
// filter: 4 taps a level) and back up, then ONE pass adds it and does the tone mapping + sRGB
// that three would otherwise have done straight to the canvas. ~12 tiny draw calls a frame.
//
//   post.render(scene, camera)      instead of renderer.render (app.js, when the tier has post)
//   post.dispose()                  dropping to a tier without it frees the targets
import * as THREE from "three";

const VERT = "varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; uniform float uKnee; uniform float uPre; varying vec2 vUv;
void main() {
    vec2 o = uTexel;
    vec3 c = texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb
        + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
    c /= 8.0;
    if (uPre > 0.5) {   // soft-knee threshold: only what's brighter than white blooms
        float l = max(c.r, max(c.g, c.b));
        float soft = clamp(l - uThr + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
        c *= max(soft, l - uThr) / max(l, 1e-4);
    }
    gl_FragColor = vec4(min(c, vec3(32.0)), 1.0);
}`;
const UP = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
    vec2 o = uTexel;
    vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb
        + texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb
        + (texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb
        + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb) * 2.0;
    gl_FragColor = vec4(c / 12.0, 1.0);
}`;
const COMP = `uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uStrength; varying vec2 vUv;
void main() {
    vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uStrength;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

const LEVELS = 5;
const tri = new THREE.BufferGeometry();
tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function pass(frag, uniforms, opts = {}) {
    const m = new THREE.ShaderMaterial(Object.assign({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false }, opts));
    const mesh = new THREE.Mesh(tri, m);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { m, scene };
}

export class Post {
    /** Rendering into a half-float target needs the colour-buffer-float extensions (else: no bloom, plain rendering). */
    static supported(renderer) {
        try { const e = renderer.extensions; return !!(e.has("EXT_color_buffer_float") || e.has("EXT_color_buffer_half_float")); } catch (err) { return false; }
    }
    constructor(renderer) {
        this.r = renderer;
        this.w = 0; this.h = 0;
        this.strength = 0.42;
        this.threshold = 1.0;
        this.scene = null; this.mips = [];
        this.down = pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 1 }, uKnee: { value: 0.6 }, uPre: { value: 0 } });
        this.up = pass(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
        this.comp = pass(COMP, { tScene: { value: null }, tBloom: { value: null }, uStrength: { value: 0.4 } }, { toneMapped: true });
        this._v = new THREE.Vector2();
    }
    size(w, h) {
        if (w === this.w && h === this.h && this.scene) return;
        this.dispose();
        this.w = w; this.h = h;
        const opts = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
        this.scene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
        let mw = w, mh = h;
        for (let i = 0; i < LEVELS; i++) { mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); this.mips.push(new THREE.WebGLRenderTarget(mw, mh, opts)); }
    }
    render(scene, camera) {
        const r = this.r;
        r.getDrawingBufferSize(this._v);
        this.size(this._v.x, this._v.y);
        const prev = r.getRenderTarget(), autoClear = r.autoClear;
        r.setRenderTarget(this.scene);
        r.render(scene, camera);
        r.autoClear = true;
        // bright pass + down the pyramid
        const D = this.down.m.uniforms;
        D.uThr.value = this.threshold;
        let src = this.scene.texture, sw = this.w, sh = this.h;
        for (let i = 0; i < LEVELS; i++) {
            D.tSrc.value = src; D.uTexel.value.set(1 / sw, 1 / sh); D.uPre.value = i === 0 ? 1 : 0;
            r.setRenderTarget(this.mips[i]);
            r.render(this.down.scene, qcam);
            src = this.mips[i].texture; sw = this.mips[i].width; sh = this.mips[i].height;
        }
        // …and back up, adding each level into the one above it
        const U = this.up.m.uniforms;
        r.autoClear = false;
        for (let i = LEVELS - 1; i > 0; i--) {
            U.tSrc.value = this.mips[i].texture; U.uTexel.value.set(1 / this.mips[i].width, 1 / this.mips[i].height);
            r.setRenderTarget(this.mips[i - 1]);
            r.render(this.up.scene, qcam);
        }
        r.autoClear = true;
        const C = this.comp.m.uniforms;
        C.tScene.value = this.scene.texture; C.tBloom.value = this.mips[0].texture; C.uStrength.value = this.strength;
        r.setRenderTarget(prev);
        r.render(this.comp.scene, qcam);
        r.autoClear = autoClear;
    }
    /** Free the render targets (the passes are tiny and stay). */
    dispose() {
        if (this.scene) this.scene.dispose();
        for (const m of this.mips) m.dispose();
        this.scene = null; this.mips = []; this.w = this.h = 0;
    }
}
