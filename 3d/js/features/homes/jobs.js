// features/homes — 🤝 the INSIDE jobs (visits.js offers them at the door; house.js builds the house as a guest
// visit with hm.job set and calls setupJob):
//   🛍️ groceries  three bags by the front door → the kitchen counter, one at a time (she carries one)
//   👓 glasses    four places to look; three funny finds, one pair of glasses (on Bubbe's head, sometimes)
//   🍼 babysit    the parents step out for sixty seconds; every few seconds a kid starts some mischief (a "!" over
//                 them) — go and settle them down. A calm house pays in full; chaos pays half (still capped).
import { emit } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { tone } from "../interiors/fx.js";
import { Kit } from "../decor/props.js";
import { payJob, JOBS } from "./visits.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const D = 5.6;
function own(rt, g) { g.traverse(o => { if (o.isMesh && o.geometry) rt.own(o.geometry); }); return g; }
function bagKit(k, x, y, z) { k.box(0.3, 0.36, 0.2, "#D7B98E", x, y + 0.18, z); k.ball(0.07, "#FFEB3B", x - 0.05, y + 0.38, z); k.cyl(0.03, 0.03, 0.18, "#4CAF50", x + 0.07, y + 0.42, z); }

/** Set up the job inside the house (after the residents are built). h: { heldProp, treat, finish(text) } */
export function setupJob(rt, V, job, h) {
    V.job = { type: job.type, done: false, t: 0, paid: 0 };
    const J = V.job;
    const host = () => V.res.find(r => r.K.adult && !r.K.crowd) || V.res.find(r => !r.K.animal);
    const done = (line, factor = 1) => {
        if (J.done) return;
        J.done = true;
        const hr = host();
        J.paid = payJob(job.type, factor);
        if (J.paid) { H.toast(`${JOBS[job.type].emoji} +${J.paid} 💰 — a favour for the ${V.home.name}s`, "gold", { key: "homes:job" }); rt.burst({ x: rt.lulu.obj.position.x, y: 1.4, z: rt.lulu.obj.position.z }, ["#FFD700", "#FFF59D", "#FFFFFF"], 12, 2, 0.05); }
        if (hr) rt.bubble(line, hr.p.obj, 3.2); else rt.bubble(line, rt.lulu.obj, 3);
        tone(660, 0.1, "triangle", 0.09); tone(990, 0.16, "triangle", 0.09, 0, 0.12);
        V.favour = true;
        emit("homes:jobDone", { type: job.type, paid: J.paid, key: V.home.key });
    };
    const door = rt.spots.door;
    if (job.type === "groceries") {
        J.left = 3; J.carrying = false;
        const k = new Kit();
        for (let i = 0; i < 3; i++) bagKit(k, door.x - 0.7 + i * 0.36, 0, door.z - 0.25);
        J.bags = own(rt, k.build("Groceries")); rt.add(J.bags);
        const ct = V.A.counter;
        rt.hot({ id: "job_bag", x: door.x - 0.35, z: door.z - 0.5, r: 1.3, label: () => `🛍️ Grab a grocery bag (${J.left} left)`, enabled: () => !J.done && !J.carrying && J.left > 0,
            action: r2 => { J.carrying = true; const b = new Kit(); bagKit(b, 0, -0.2, 0.05); r2.luluHold(own(r2, b.build("Bag")), { y: -0.3, z: 0.06 }); const m = J.bags.children; if (m.length) J.bags.scale.x = Math.max(0.05, (J.left - 1) / 3); tone(300, 0.08, "triangle", 0.06); } });
        rt.hot({ id: "job_put", x: ct.x, z: ct.z + 0.2, r: 1.3, label: "🧺 Put the groceries away", enabled: () => !J.done && J.carrying,
            action: r2 => {
                J.carrying = false; J.left--; r2.luluHold(null);
                r2.bubble(pick(["*the eggs survive* ...MOSTLY.", "Milk, challah, nine kinds of seltzer…", "Who buys FOUR jars of pickles? ...this family. This family does."]), r2.lulu.obj, 2.2);
                if (J.left <= 0) { J.bags.visible = false; done(pick(["All of it! You're an angel. A strong angel. Here — for your trouble.", "Done already?! My husband takes an HOUR. And he forgets the milk."])); }
            } });
    } else if (job.type === "glasses") {
        const S = V.surf, spots = [["couch", "🛋️ Look under the cushions", S.couch], ["coat", "🧥 Check the coat pockets", S.coat], ["fridge", "🧊 Look in the fridge (why not)", S.fridge],
            ["table", "🍽️ Look under the table", S.table || S.ktable], ["bunk", "🛏️ Look under the bed", S.bunk], ["desk", "📚 Look on the desk", S.desk]].filter(s => s[2]);
        const use = spots.slice(0, 4);
        const right = Math.floor(Math.random() * use.length);
        const funny = ["A single sock. Where's the other one? Nobody knows.", "Three pacifiers and a Purim mask from 2019.", "A LEGO. You step on it. You don't scream. You're a professional.",
            "A dollar! ...with a note: 'for TZEDAKAH'. You put it back.", "The TV remote! They've been looking for this since Chanukah.", "A whole bag of rugelach. Hidden. Someone's hiding RUGELACH."];
        J.looked = 0;
        use.forEach(([id, label, at], i) => rt.hot({ id: "job_look_" + id, x: at.x, z: at.z + (at.y ? 0.55 : 0), r: 1.25, label, enabled: () => !J.done && !(J.checked && J.checked[id]),
            action: r2 => {
                (J.checked = J.checked || {})[id] = 1; J.looked++;
                if (i === right || J.looked >= use.length) { const hr = host(); done(pick(["My GLASSES! Where were they? ...don't tell me. I don't want to know.", "You found them! Now I can see how much you've GROWN!", "Oh! They were THERE? I looked there! ...I looked there without my glasses."])); if (hr) hr.rec.pose = { cheer: true }; }
                else r2.bubble(pick(funny), r2.lulu.obj, 2.4);
            } }));
    } else if (job.type === "babysit") {
        J.left = 60; J.chaos = 0; J.next = 4; J.settled = 0;
        const kids = V.res.filter(r => r.kind === "boy" || r.kind === "girl" || r.kind === "baby");
        for (const r of kids) if (r.kind !== "baby") { r.roam = true; r.path = null; r.fast = true; r.sit = false; r.pose0 = null; }
        J.kids = kids;
        rt.timers.push({ once: true, t: 0.6, gate: false, fn: () => { if (!rt.disposed) rt.bubble("*the door clicks shut* ...just me and the kids. Sixty seconds. How bad can it be? 😬", rt.lulu.obj, 3); } });
        V.jobLabel = r => r.mischief ? `🧸 Settle ${r.name} down` : null;
        V.jobUse = (r2, r) => {
            if (!r.mischief) return false;
            r.mischief = null; J.settled++;
            r2.bubble(pick(["Okay, okay! ...can we do it AGAIN later?", "*puts the marker down* ...it was ART.", "Fine. FINE. *flops onto the couch*"]), r.p.obj, 2.2);
            r2.bubble(pick(["Crisis averted.", "Nobody saw that. NOBODY.", "I'm SO good at this."]), r2.lulu.obj, 1.8);
            tone(520, 0.08, "triangle", 0.07);
            return true;
        };
        J.tick = (r2, dt) => {
            if (J.done) return;
            J.left -= dt; J.next -= dt;
            const busy = kids.filter(r => r.mischief);
            J.chaos += dt * busy.length;
            if (J.next <= 0) {
                J.next = 5 + Math.random() * 3;
                const free = kids.filter(r => !r.mischief && r.kind !== "baby");
                const k = free.length ? free[Math.floor(Math.random() * free.length)] : null;
                if (k) { k.mischief = pick(["I'm drawing on the WALL! It's a MURAL!", "I'm feeding the fish! ALL of the food!", "I'm making SOUP! In the TOILET!", "Watch me JUMP off the couch!", "I'm giving the cat a HAIRCUT!"]); r2.bubble(k.mischief, k.p.obj, 2.6); tone(900, 0.1, "square", 0.04, 1200); }
                else if (kids.some(r => r.kind === "baby")) r2.bubble("*the baby: WAAAAH* (it's fine. It's fine!)", kids.find(r => r.kind === "baby").p.obj, 2);
            }
            if (J.left <= 0) {
                const calm = J.chaos < 14;
                if (calm) done(pick(["They're ALIVE! And CLEAN! What did you DO? Here — take this.", "You're hired. Forever. Here — for your trouble."]));
                else done("I was gone ONE MINUTE. Why is the cat BALD? ...thank you anyway, sheifele. Here — half. For the CAT.", 0.5);
                V.jobLabel = null;
            }
        };
    }
    return J;
}
/** The job's HUD line (or "") — house.js puts it in the meter box. */
export function jobHud(V) {
    const J = V.job;
    if (!J) return "";
    if (J.done) return `<small style="display:block;font-weight:700">${J.paid ? `🤝 Done! +${J.paid} 💰` : "🤝 Done — they're grateful"}</small>`;
    if (J.type === "groceries") return `<small style="display:block;font-weight:700">🛍️ ${J.left} bag${J.left === 1 ? "" : "s"} to the kitchen</small>`;
    if (J.type === "glasses") return `<small style="display:block;font-weight:700">👓 Find the glasses</small>`;
    if (J.type === "babysit") return `<small style="display:block;font-weight:700">🍼 ${Math.max(0, Math.ceil(J.left))} s · chaos ${"🔥".repeat(Math.min(3, Math.floor(J.chaos / 5)))}</small>`;
    return "";
}
