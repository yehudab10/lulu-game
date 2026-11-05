// Bling decorations: Blender models (garage_decor.glb, one Decor_<id> per
// item, each built around the car anchor it bolts onto) attached with
// car.attach(slot, obj), plus their little animations (the fuzzy dice swing
// with the car's real g-forces, the bow wobbles, the crown's gems twinkle,
// the flames flicker, a glint runs up the unicorn horn).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, registerModels, ensureModels, findNodes } from "../../models.js";
import { decorDef } from "./data.js";

registerModels({ garageDecor: "garage_decor", garageProps: "garage_props", garageItems: "garage_items", garageShowroom: "garage_showroom" });

export const loadDecor = () => ensureModels(["garageDecor"]);
export const loadProps = () => ensureModels(["garageProps"]);

function glintTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,240,250,0.8)");
    grd.addColorStop(1, "rgba(255,200,240,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(30, 4, 4, 56); g.fillRect(4, 30, 56, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
let GLINT = null;

/** A fresh clone of a Blender node under `root` (position zeroed — the .blend spreads them out). */
export function cloneNode(root, name) {
    const src = root && findNodes(root, name)[0];
    if (!src) return null;
    const obj = src.clone(true);
    obj.position.set(0, 0, 0);
    return obj;
}

/** A ready-to-attach decoration (null until garage_decor.glb is loaded). */
export function makeDecor(id) {
    const def = decorDef(id);
    if (!def || !models.garageDecor) return null;
    const obj = cloneNode(models.garageDecor, "Decor_" + id);
    if (!obj) return null;
    obj.name = "garageDecor_" + id;
    obj.userData.garageDecor = id;
    obj.userData.slot = def.slot;
    const st = obj.userData.anim = { t: Math.random() * 10, swing: 0, swingV: 0, sway: 0, swayV: 0 };
    st.swingNode = findNodes(obj, "DiceSwing")[0] || null;
    st.bowNode = findNodes(obj, "Bow")[0] || null;
    st.mats = [];
    obj.traverse(o => {
        if (!o.isMesh) return;
        if (/^Neon/.test(o.material.name)) {
            o.material = o.material.clone();
            o.material.userData.base = o.material.emissiveIntensity;
            st.mats.push(o.material);
        }
        if (id === "lashes" || id === "flames") o.castShadow = false;
    });
    if (id === "unicorn") {
        GLINT = GLINT || glintTexture();
        const horn = findNodes(obj, "UnicornHorn")[0];
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLINT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        sp.scale.setScalar(0.22);
        st.glint = sp;
        st.hornBase = horn ? horn.position.clone() : new THREE.Vector3();
        obj.add(sp);
    }
    return obj;
}

const _axis = new THREE.Vector3(0, Math.cos(48 * Math.PI / 180), Math.sin(48 * Math.PI / 180));
/**
 * Animate a decoration. `car` (optional) is a PlayerCar: the dice then swing
 * with its lateral / longitudinal acceleration; without it they sway gently.
 */
export function animateDecor(obj, dt, car = null) {
    const st = obj && obj.userData.anim;
    if (!st) return;
    st.t += dt;
    const t = st.t, id = obj.userData.garageDecor;
    if (st.swingNode) {
        // a damped pendulum (~1.2 Hz) pushed around by the car's g-forces
        const lat = car ? THREE.MathUtils.clamp(car.latAcc || 0, -30, 30) : Math.sin(t * 1.3) * 3;
        const lon = car ? THREE.MathUtils.clamp(car.accelLong || 0, -30, 30) : Math.sin(t * 0.9) * 2;
        st.swingV += (-52 * st.swing - 2.2 * st.swingV + lat * 1.6) * dt;
        st.swayV += (-52 * st.sway - 2.2 * st.swayV + lon * 1.4) * dt;
        st.swing = THREE.MathUtils.clamp(st.swing + st.swingV * dt, -0.9, 0.9);
        st.sway = THREE.MathUtils.clamp(st.sway + st.swayV * dt, -0.7, 0.7);
        st.swingNode.rotation.set(st.sway, 0, st.swing + Math.sin(t * 4) * 0.025);
    }
    if (id === "bow" && st.bowNode) {
        const bump = car ? (car.bump || 0) * 4 : 0;
        st.bowNode.rotation.z = Math.sin(t * 3) * 0.06;
        st.bowNode.scale.set(1, 1 + Math.sin(t * 6) * 0.02 + bump, 1);
    }
    if (st.mats.length) {
        for (const m of st.mats) {
            const b = m.userData.base || 0.5;
            if (id === "flames") m.emissiveIntensity = b * (0.75 + 0.5 * Math.abs(Math.sin(t * 9 + (m.name.length % 3))) + (car && car.boosting ? 1.5 : 0));
            else m.emissiveIntensity = b * (0.6 + 0.8 * (0.5 + 0.5 * Math.sin(t * 5 + m.name.length)));
        }
    }
    if (st.glint) {
        const g = (t * 0.8) % 1;
        st.glint.position.copy(st.hornBase).addScaledVector(_axis, 0.08 + g * 0.66);
        st.glint.material.opacity = 1 - g;
        st.glint.scale.setScalar(0.12 + (1 - g) * 0.14);
    }
}

/** Free what makeDecor cloned (animated materials, the glint sprite). */
export function disposeDecor(obj) {
    const st = obj && obj.userData.anim;
    if (!st) return;
    for (const m of st.mats) m.dispose();
    if (st.glint) st.glint.material.dispose();
    st.mats = [];
}

/**
 * Keep exactly one decoration on a car. `holder` remembers what we attached:
 *   setCarDecor(ctx.car, holder, "crown")   ·   setCarDecor(ctx.car, holder, "none")
 * Only removes an object from a slot if it's still OURS (another feature may
 * have put a holiday hat on Lulu's head since).
 */
export function setCarDecor(car, holder, id) {
    if (holder.id === id && holder.obj) return holder.obj;
    if (holder.obj) {
        const slot = holder.obj.userData.slot;
        if (car.attached && car.attached[slot] === holder.obj) car.attach(slot, null);
        else if (holder.obj.parent) holder.obj.parent.remove(holder.obj);
        disposeDecor(holder.obj);
    }
    holder.obj = null;
    holder.id = id;
    if (!id || id === "none") return null;
    const obj = makeDecor(id);
    if (!obj) { holder.id = null; return null; }   // model not loaded yet — try again later
    car.attach(obj.userData.slot, obj);
    holder.obj = obj;
    return obj;
}

/** Attach a decoration to a plain model clone (the showroom car) by its Anchor_<slot> node. */
export function attachToModel(model, obj) {
    if (!obj) return;
    const a = findNodes(model, "Anchor_" + obj.userData.slot)[0];
    if (a) a.add(obj);
}

export { ctx };
