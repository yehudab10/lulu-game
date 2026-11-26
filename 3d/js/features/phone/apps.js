// features/phone — the built-in apps: 🗺️ Map · (💬 Messages: inbox.js) · 📻 Radio ·
// 💼 Jobs · 🎨 Paint & Pray · 📸 Camera. Every one talks to its feature through ctx
// (null-checked) and hides itself when that feature is missing; the random-feature
// apps (Map, Jobs, Paint) also hide in a 🎉 party, where those features are off.
import { ctx } from "../../core/ctx.js";
import { STATIONS, SONGS, JOBS } from "../hustle/data.js";
import { addApp, esc, partyOn } from "./ui.js";
import { ONEGAME } from "../onegame/switches.js";

const inCarNow = () => ctx.state === "playing" && !(ctx.foot && ctx.foot.active);
const miles = m => `${(Math.max(0, m) / 1609).toFixed(1)} mi`;

// 🗺️ the story map (journey) — over the live run, ○ comes straight back (hidden with the Story Trip: onegame/switches.js)
addApp({
    id: "map", icon: "🗺️", name: "Map", order: 10, color: "#26A69A", color2: "#00695C",
    visible: () => ONEGAME.story && !!(ctx.journey && ctx.journey.openMap) && !partyOn(),
    open: () => ctx.journey.openMap({ from: "phone" }),
});

// 📻 the car radio (hustle's radio API)
const quietNow = () => { try { return !!(ctx.seasons && ctx.seasons.radioQuiet && ctx.seasons.radioQuiet()); } catch (e) { return false; } };
addApp({
    id: "radio", icon: "📻", name: "Radio", order: 30, color: "#7E57C2", color2: "#4527A0",
    visible: () => !!(ctx.hustle && ctx.hustle.radio),
    render(el, api) {
        const r = ctx.hustle.radio, cur = r.station, st = r.state ? r.state() : {};
        const song = st.src && SONGS[st.src];
        const ids = new Set(r.stations || STATIONS.map(s => s.id));
        const list = STATIONS.filter(s => ids.has(s.id));
        const now = list.find(s => s.id === cur) || list[0];
        el.innerHTML = `<div class="lp-card lp-now"><span class="lp-eq${cur === "off" ? " off" : ""}"><i></i><i></i><i></i><i></i></span>
                <span class="lp-tx"><b>${esc(now.name)}</b><small>${cur === "off" ? "silence is golden" : song ? "♪ " + esc(song) : esc(now.tag)}</small></span></div>
            ${list.map(s => `<button class="btn lp-row lp-st${s.id === cur ? " on" : ""}" data-st="${s.id}"><span class="lp-av">${s.emoji}</span>
                <span class="lp-tx"><b>${esc(s.name)}</b><small>${esc(s.tag)}</small></span>${s.id === cur ? '<span class="lp-meta">▶</span>' : ""}</button>`).join("")}
            ${quietNow() ? `<p class="lp-note">🕯️ It's the Three Weeks — the radio's music stations are quiet. LULU FM (the game's own driving soundtrack) keeps playing.</p>` : ""}
            ${inCarNow() ? "" : `<p class="lp-note">📻 plays when Lulu's back behind the wheel</p>`}`;
        el.querySelectorAll(".lp-st").forEach(b => b.addEventListener("click", () => {
            if (b.dataset.st !== r.station) r.tune(b.dataset.st);
            api.refresh();
        }));
    },
});

/** Other features' cards at the bottom of 💼 Jobs (the phone stays one 3 × 3 screen — add a card, not an app):
 *  { id, html() → string, bind(el, api) } — features/onegame's 🅿️ Parking Challenge. */
export const JOB_EXTRAS = [];
// 💼 side jobs (hustle) — the same rules as its own offers: Cruise, in a car, no heat
function jobsBlock() {
    const G = ctx.G, h = ctx.hustle;
    if (h.job) return null;
    if (partyOn() ? !(ctx.G.mode === "party" && ctx.party.activity && /^(trip|roam)$/.test(ctx.party.activity.k)) : G.mode !== "cruise") return "Side jobs only work when you're out driving around.";
    if (partyOn() && ctx.town && ctx.town.active) return "Get back on the highway first 🛣️";
    if (!inCarNow()) return "Get back in a car first 🚗";
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted >= 2)) return "Lose the cops first 🚓";
    if (ctx.meta && ctx.meta.calm && ctx.meta.calm()) return "Finish the driving lesson first 📝";
    if (ctx.multiplayer && ctx.multiplayer.inRace) return "Not in the middle of a race!";
    if (ctx.phone && ctx.phone.busy && ctx.phone.busy()) return "You're on a call 📞";
    if (h.marker && !h.marker.done) return "A job's already waiting up the road — follow the beacon ☎️";
    if (h._dbg && h._dbg.pending) return "Finish up the last job first.";
    return null;
}
addApp({
    id: "jobs", icon: "💼", name: "Jobs", order: 40, color: "#FFA000", color2: "#E65100",
    visible: () => !!(ctx.hustle && ctx.hustle.start) && (!partyOn() || ctx.enabled("hustle")),
    badge: () => (ctx.streets && ctx.streets.chop && ctx.streets.chop.job ? "!" : null),
    render(el, api) {
        const h = ctx.hustle, job = h.job, why = jobsBlock();
        let html = "";
        const chop = ctx.streets && ctx.streets.chop && ctx.streets.chop.job;
        if (chop) html += `<div class="lp-card lp-chop"><span class="lp-av">🔧</span><span class="lp-tx"><b>Shmuel's order</b><small>Jack a ${esc(chop.text)} and bring it in. Pays ${chop.pay} coins.</small></span></div>`;
        if (job) {
            const d = job.def || {};
            html += `<div class="lp-card lp-on"><span class="lp-av">${d.emoji || "💼"}</span><span class="lp-tx"><b>On the clock: ${esc(d.name || job.id)}</b><small>${esc(job.intro || d.blurb || "")}</small></span></div>
                <button class="btn lp-row lp-mini" id="lpQuitJob">✋ Quit this job</button>`;
        } else {
            const ids = ["cab", "delivery"].concat(ctx.law && !(partyOn() && !ctx.enabled("law")) ? ["getaway"] : [], h.listed ? h.listed() : []);
            html += ids.filter(id => JOBS[id]).map(id => { const d = JOBS[id]; return `<button class="btn lp-row lp-job" data-job="${id}"${why ? " disabled" : ""}><span class="lp-av" style="--c:${d.color}">${d.emoji}</span>
                <span class="lp-tx"><b>${esc(d.name)}</b><small>${esc(d.blurb)}</small></span>${why ? "" : '<span class="lp-meta lp-go">Take it</span>'}</button>`; }).join("");
            if (why) html += `<p class="lp-note">${esc(why)}</p>`;
            html += `<p class="lp-fine">…or drive into a ringing ☎️ payphone.</p>`;
        }
        for (const x of JOB_EXTRAS) { try { html += x.html() || ""; } catch (e) { console.error("[phone] jobs extra", x.id, e); } }
        el.innerHTML = html;
        for (const x of JOB_EXTRAS) { try { if (x.bind) x.bind(el, api); } catch (e) { console.error("[phone] jobs extra", x.id, e); } }
        el.querySelectorAll(".lp-job").forEach(b => b.addEventListener("click", () => {
            if (jobsBlock()) { api.toast(jobsBlock()); return; }
            const id = b.dataset.job;
            api.close();                              // back on the road, then the job's on
            if (!h.start(id, { via: "phone" }) && ctx.hustle.offer) ctx.hustle.offer(id, "marker");
        }));
        const q = el.querySelector("#lpQuitJob");
        if (q) q.addEventListener("click", () => { api.close(); h.end("quit", "quit"); });
    },
});

// 🎨 Paint & Pray (streets): where's the nearest booth?
addApp({
    id: "paint", icon: "🎨", name: "Paint & Pray", order: 50, color: "#EC407A", color2: "#6A1B9A",
    visible: () => !!(ctx.streets && ctx.streets.paint && ctx.streets.paint.nearest) && !partyOn(),
    render(el) {
        const p = ctx.streets.paint;
        let n = null, cost = 30;
        try { n = inCarNow() || (ctx.foot && ctx.foot.active) ? p.nearest() : null; cost = p.cost(); } catch (e) { n = null; }
        const w = (ctx.law && ctx.law.wanted) || 0;
        el.innerHTML = `<div class="lp-card lp-paint"><span class="lp-av">🙏</span><span class="lp-tx"><b>Moishe's Paint &amp; Pray</b><small>A drive-through respray: new colour, fixed tyres, and the cops forget you</small></span></div>
            <div class="lp-dist">${n ? `<small>the nearest booth</small><b>${miles(n.dist)}</b><small>up the road</small>` : `<small>no booth on this stretch</small><b>🛣️</b><small>keep driving</small>`}</div>
            <p class="lp-note">A respray costs <b>${cost} coins</b>.${w ? ` It clears your ${"★".repeat(w)} too!` : ""}</p>`;
    },
});

// 📸 photo mode (play)
addApp({
    id: "camera", icon: "📸", name: "Camera", order: 60, color: "#546E7A", color2: "#263238",
    visible: () => !!(ctx.play && ctx.play.openPhoto),
    open: () => ctx.play.openPhoto("phone"),
});
