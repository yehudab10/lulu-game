// features/openworld — the two 📱 phone apps (no new buttons, no home tiles):
//   👯 FRIENDS in a 🎉 party's 🌍 Free Roam: where every friend is (🏙️ Lakewood · 120 m),
//             🚀 catch up with one (a warp) or 📍 pin them, start a game, the last scoreboard
//             with 🔁 Rematch. (Solo, 📍 Nearby lists the other drivers around +
//             📤 invite friends + 🌐 go solo — the home grid is full.)
//   📍 NEARBY (always): what's around HERE — people to talk to, landmarks, coins, the way
//             out of town / the next town exit, places up the road — tap one for a map pin;
//             solo, the 🏁 time trial and 📸 photo hunt start here too.
// Both are plain phone views (showScreen rows): D-pad + ✕/○, keyboard, touch.
import { ctx } from "../../core/ctx.js";
import { glyph } from "../../input.js";
import { esc, fmtRace } from "./hud.js";

let E = null;
const V = { party: null, nearby: null };
const mi = m => (m >= 1000 ? `${(m / 1609).toFixed(1)} mi` : `${Math.round(m / 5) * 5} m`);
const row = (id, av, title, sub, meta = "", dis = false, data = "") =>
    `<button class="btn lp-row" id="${id}"${data}${dis ? " disabled" : ""}><span class="lp-av">${av}</span><span class="lp-tx"><b>${title}</b><small>${sub}</small></span>${meta ? `<span class="lp-meta ow-d">${meta}</span>` : ""}</button>`;
function on(el, sel, fn) { el.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => fn(b))); }
function myPos() { const f = ctx.foot && ctx.foot.active && ctx.foot.pos; return f || ctx.car.pos; }
const d2 = p => { const m = myPos(); return Math.hypot(p.x - m.x, p.z - m.z); };

// ── results (both apps) ──────────────────────────────────────────────────
function resultsHtml() {
    const CL = E.CL, g = CL.last;
    if (!g) return `<p class="lp-empty">No games yet.</p>`;
    const G = E.GAMES[g.k], medal = ["🏆", "🥈", "🥉"];
    const best = g.k === "pin" && g.ps.length === 1 ? (CL.newBest ? `<p class="lp-note">⭐ New best to ${esc(g.pin.name)}!${CL.lastBest ? ` (was ${fmtRace(CL.lastBest)})` : ""}</p>` : CL.lastBest ? `<p class="lp-note">Your best: ${fmtRace(CL.lastBest)}</p>` : "") : "";
    return `<div class="lp-card ow-head"><span class="lp-av">${G.emoji}</span><span class="lp-tx"><b>${CL.lastTitle}</b><small>${esc(G.name)}${g.cut ? " · ended early" : ""}</small></span></div>${best}
        <div class="ow-res">${CL.lastRows.map((r, i) => `<button class="btn lp-row${r.uid === E.me() ? " me" : ""}"><span class="rk">${medal[i] || i + 1}</span><span class="lp-tx"><b><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.hex};margin-right:6px"></i>${esc(r.name)}${r.uid === E.me() && r.uid !== "me" ? " (you)" : ""}</b><small>${esc(r.val)}</small></span></button>`).join("")}</div>
        ${row("owRematch", "🔁", "Rematch", `${esc(G.name)} again, from here`)}
        ${row("owDone", "🌍", "Back to roaming", "close the phone")}`;
}
function wireResults(el, api) {
    on(el, "#owRematch", () => { const why = E.requestGame(E.CL.last.k); if (why) api.toast(why); else api.close(); });
    on(el, "#owDone", () => api.close());
}

// ── 📍 Nearby, solo: the other drivers around (the EVERYONE layer) + invite friends + go solo ──
// (in 📍 Nearby, not an app of its own: the phone's home is one full 3 × 3 grid)
function driversHtml() {
    const M = ctx.mp;
    if (!M || !M.setOnline || !M.allowed || E.party()) return "";
    const online = M.online, conn = M.connected && M.room === "lobby";
    const near = conn ? Object.values(M._debug.peers).filter(p => p.onScreen && p.ws != null) : [];
    const others = conn ? Math.max(0, M.riders - 1) : 0;
    let html = `<div class="ow-sec">Other drivers${conn ? ` · ${others} online` : ""}</div>`;
    if (!near.length) html += `<p class="lp-note">${online ? "Nobody near you right now — other drivers show up as see-through ghosts." : "Play online is off — just you out here."}</p>`;
    const clock = M._debug.clock;
    for (const p of near.slice(0, 4)) {
        const rec = p.rec && clock - p.rec.at < 120 ? ` · 🎉 a record: ${Math.round(p.rec.score).toLocaleString()}` : "";   // (never a pop-up: ci/calm)
        html += row("owN_" + esc(p.id), p.m === 1 ? "🚶‍♀️" : "👻", esc(p.name), (p.m === 1 ? "on foot" : "driving") + rec, mi(d2({ x: p.ws, z: p.wd })), false);
    }
    html += row("owInviteSolo", "📤", "Invite friends", "they pop up right next to you · names, games together");
    html += row("owOnline", "🌐", online ? "Go solo" : "Go online", online ? "hide every other driver (⚙️ Settings › Play online)" : "see other drivers out in the world");
    return html;
}
function wireDrivers(el, api) {
    on(el, "#owInviteSolo", () => { api.close(); ctx.party.hostRoam(); });
    on(el, "#owOnline", () => { ctx.mp.setOnline(!ctx.mp.online); api.refresh(); });
}

// ── 👯 PARTY ─────────────────────────────────────────────────────────────
function partyHome(el, api) {
    const g = E.getG(), t = E.now(), host = ctx.party.isHost;
    const mem = E.members().filter(u => u !== E.me());
    let html = `<div class="lp-card ow-head"><span class="lp-av">🌍</span><span class="lp-tx"><b>Free Roam · ${esc(ctx.party.code)}</b><small>${mem.length ? `${mem.length + 1} in the party${host ? " · 👑 you're hosting" : ""}` : "just you so far — share the code!"}</small></span></div>`;
    if (g && g.ph === "in") {                           // an invitation is open: join it (or, as its starter, go now / call it off)
        const G = E.GAMES[g.k], left = Math.max(0, Math.ceil((g.until - t) / 1000)), mine = g.ps.includes(E.me());
        html += `<div class="lp-card"><span class="lp-av">${G.emoji}</span><span class="lp-tx"><b>${esc(G.name)} is starting${g.spot ? " at " + esc(g.spot.name) : ""}</b><small>${g.ps.length} in · ${left} s · ${esc(E.nameOf(g.by))} started it</small></span></div>`;
        if (!mine) html += row("owJoin", "✅", `Join ${esc(G.name)}`, "you'll line up at the start when it goes");
        else if (g.by === E.me()) html += row("owGoNow", "▶", "Start now", `${g.ps.length} playing`) + row("owCallOff", "✖", "Call it off", "nobody minds");
        else html += `<p class="lp-note">✅ You're in — it starts in ${left} s.</p>`;
    }
    if (g && g.ph === "go") {
        const G = E.GAMES[g.k], left = g.k === "kugel" ? "" : ` · ${Math.max(0, Math.ceil((g.t0 + g.dur - t) / 1000))} s left`;
        html += `<div class="lp-card"><span class="lp-av">${G.emoji}</span><span class="lp-tx"><b>${esc(G.name)} is on${left}</b><small>${g.ps.includes(E.me()) ? "you're playing" : "you're in the next one"}</small></span></div>`;
        if (host) html += row("owEnd", "✋", "End this game", "everyone gets the scoreboard");
        if (g.ps.includes(E.me()) && (g.at.zone || "") !== E.zone()) html += row("owBack", "🚀", "Warp back to the game", g.at.zone ? "it's in town" : "it's on the highway");
    }
    if (E.riding()) html += row("owHopH", "🚪", `Hop out of ${esc(E.nameOf(E.riding()))}'s car`, "back in your own");
    html += `<div class="ow-sec">Friends</div>`;
    if (!mem.length) html += `<p class="lp-note">Nobody else yet — the code is <b>${esc(ctx.party.code)}</b>.</p>`;
    for (const u of mem) {
        const p = ctx.party.peer(u), z = E.zoneOfPeer(p), pos = E.posOf(u);
        const where = z ? `${z === E.zone() ? "here in" : "in"} ${esc(townName(z))}` : E.zone() ? "on the highway" : "on the highway";
        const meta = pos ? mi(d2(pos)) : z !== E.zone() ? (z ? "🏙️" : "🛣️") : "";
        const pr = doing(u);
        html += row("owF_" + u, pr ? esc(pr.icon) : "🚗", esc(E.nameOf(u)), (pr ? esc(pr.label) + " · " : "") + where, meta, false, ` data-u="${esc(u)}"`);
    }
    html += `<div class="ow-sec">Games</div>`;
    for (const k of E.ORDER) {
        const G = E.GAMES[k], why = E.blockReason(k);
        html += row("owG_" + k, G.emoji, esc(G.name), esc(why || G.blurb), why ? "" : "Start", !!why && !/already on/.test(why), ` data-k="${k}"`);
    }
    if (E.CL.last) html += `<div class="ow-sec">Last game</div>` + row("owLast", "🏆", E.CL.lastTitle, "the scoreboard · 🔁 rematch");
    html += `<div class="ow-sec">The party</div>`;
    html += row("owInvite", "📤", "Invite friends", `send the link — they pop up right next to you · code ${esc(ctx.party.code)}`);
    html += row("owLeave", "🚪", "Leave the party", "back to the home screen — your friends keep playing");
    if (ctx.mp && ctx.mp.setOnline) html += row("owOnline", "🌐", ctx.mp.online ? "Hide other drivers" : "Show other drivers", ctx.mp.online ? "strangers out in the world are ghosts · just your friends instead" : "see the other drivers out in the world too");
    html += `<p class="lp-fine">Start one here, or walk up to the 🕹️ arcade / 📋 notice board in town — friends opt in, nobody gets dragged along. Honk ${glyph("honk")} to wave at a friend.</p>`;
    el.innerHTML = html;
    on(el, "[data-u]", b => api.open("owparty", { friend: b.dataset.u }));
    on(el, "[data-k]", b => { const why = E.requestGame(b.dataset.k); if (why) api.toast(why); else api.close(); });
    on(el, "#owEnd", () => { E.endGameNow(); api.close(); });
    on(el, "#owJoin", () => { E.optIn(); api.close(); });
    on(el, "#owInvite", async () => { const msg = ctx.party.invite ? await ctx.party.invite() : ""; if (msg) api.toast(msg); });
    on(el, "#owLeave", () => { api.close(); ctx.party.leave(); });
    on(el, "#owGoNow", () => { const g2 = E.getG(); if (g2) E.send("owgo", g2.n); api.close(); });
    on(el, "#owCallOff", () => { const g2 = E.getG(); if (g2) E.send("owx", g2.n); api.close(); });
    on(el, "#owBack", () => { api.close(); E.warpToGame(); });
    on(el, "#owLast", () => api.open("owparty", { results: true }));
    on(el, "#owHopH", () => { api.close(); E.stopRide(); });
    on(el, "#owOnline", () => { ctx.mp.setOnline(!ctx.mp.online); api.open("owparty", null); });
}
function townName(id) { const T = ctx.town && ctx.town.towns; return (T && T[id] && T[id].name) || id; }
/** What a friend is doing (party presence) when it's more than plain driving: { icon, label } | null. */
function doing(uid) {
    const pr = ctx.party && ctx.party.presenceOf ? ctx.party.presenceOf(uid) : null;
    return pr && pr.label && !(pr.mode === "drive" && pr.icon === "🚗") ? pr : null;
}
function friendView(el, api, uid) {
    const p = ctx.party.peer(uid), z = E.zoneOfPeer(p), pos = E.posOf(uid);
    const name = esc(E.nameOf(uid)), pr = doing(uid);
    el.innerHTML = `<div class="lp-card ow-head"><span class="lp-av">${pr ? esc(pr.icon) : "🚗"}</span><span class="lp-tx"><b>${name}</b><small>${pr ? esc(pr.label) + " · " : ""}${z ? "in " + esc(townName(z)) : "on the highway"}${pos ? " · " + mi(d2(pos)) : ""}</small></span></div>
        ${E.riding() === uid ? row("owHop", "🚪", "Hop out", "back in your own car, right beside them") : row("owRide", "🚗", `Ride with ${name}`, "hop in their passenger seat · ✕ to hop out")}
        ${row("owWarp", "🚀", `Catch up with ${name}`, "a puff of glitter and you're right behind them")}
        ${pos ? row("owPinF", "📍", `Pin ${name}`, "a beacon over their car until you meet up") : ""}
        ${row("owBackF", "‹", "Back", "")}`;
    on(el, "#owWarp", () => { api.close(); E.warpToFriend(uid); });
    on(el, "#owRide", () => { const why = E.startRide(uid); if (why) api.toast(why); else api.close(); });
    on(el, "#owHop", () => { api.close(); E.stopRide(); });
    on(el, "#owPinF", () => { E.pin({ uid, name: E.nameOf(uid), icon: "👯", x: 0, z: 0 }); api.close(); });
    on(el, "#owBackF", () => api.open("owparty", null));
}

// ── 📍 NEARBY ────────────────────────────────────────────────────────────
const PERSON_ICON = { brooklyn: "🧳", monsey: "🚐", local: "🏘️", chair: "🪑", agent: "🏠", pizza: "🍕" };
function nearbyHome(el, api) {
    const T = ctx.town, inTown = !!E.zone(), party = E.party();
    let html = "";
    const pn = E.pinned;
    if (pn) html += row("owUnpin", "✖", `Clear the pin: ${esc(pn.name)}`, "the beacon goes away");
    const g = E.getG();
    // things to do (solo — with friends they're in 👯)
    if (!party) {
        html += `<div class="ow-sec">Things to do</div>`;
        if (g && g.ph === "go") html += row("owEndSolo", "✋", `Stop the ${esc(E.GAMES[g.k].name)}`, "no score");
        else {
            for (const k of ["pin", "photo"]) {
                const G = E.GAMES[k], why = E.blockReason(k);
                const sub = k === "pin" ? (inTown ? "a time trial to the far side of town" : "a sprint up the highway") : "stop at 4 sights to snap them";
                html += row("owS_" + k, k === "pin" ? "🏁" : G.emoji, k === "pin" ? "Time trial" : esc(G.name), esc(why || sub), why ? "" : "Go", !!why, ` data-k="${k}"`);
            }
            if (E.CL.last) html += row("owLastS", "🏆", E.CL.lastTitle, "the last result");
        }
    } else if (E.roam()) html += row("owToParty", "👯", "Games with your friends", "Cops & Robbers, Hot Kugel… in the 👯 app");
    if (inTown) {
        const people = (T.people ? T.people() : []).map(p => Object.assign(p, { d: d2(p) })).sort((a, b) => a.d - b.d).slice(0, 5);
        if (people.length) html += `<div class="ow-sec">People to talk to</div>` + people.map((p, i) => row("owP" + i, PERSON_ICON[p.id] || "💬", esc(p.name), "hop out &amp; walk up to talk", mi(p.d), false, ` data-pin="p${i}"`)).join("");
        const sights = E.townSights().map(s => Object.assign(s, { d: d2(s) })).sort((a, b) => a.d - b.d);
        if (sights.length) html += `<div class="ow-sec">Around ${esc(T.name || "town")}</div>` + sights.map((s, i) => row("owT" + i, s.icon, esc(s.name), "a landmark", mi(s.d), false, ` data-pin="t${i}"`)).join("");
        const coins = (T.coins || []).filter(c => !c.taken).map(c => Object.assign({ x: c.x, z: c.z }, { d: d2(c) })).sort((a, b) => a.d - b.d);
        html += `<div class="ow-sec">Coins &amp; the way out</div>`;
        if (coins.length) html += row("owC", "🪙", `${coins.length} coin${coins.length === 1 ? "" : "s"} left in town`, "pin the nearest", mi(coins[0].d), false, ` data-pin="c"`);
        const ex = exitsHere();
        ex.forEach((x, i) => { html += row("owX" + i, "🛣️", esc(x.name), "back to the highway", mi(d2(x)), false, ` data-pin="x${i}"`); });
        V.list = { people, sights, coins, ex };
    } else {
        html += `<div class="ow-sec">Up the road</div>`;
        const items = roadAhead();
        if (!items.length) html += `<p class="lp-note">Just highway for a while. Keep driving 🛣️</p>`;
        html += items.map((it, i) => row("owR" + i, it.icon, esc(it.name), esc(it.sub), mi(it.m), false, ` data-pin="r${i}"`)).join("");
        V.list = { road: items };
    }
    html += driversHtml();
    el.innerHTML = html || `<p class="lp-empty">Nothing around. Suspicious.</p>`;
    wireDrivers(el, api);
    on(el, "#owUnpin", () => { E.unpin(); api.refresh(); });
    on(el, "#owToParty", () => api.open("owparty", null));
    on(el, "#owEndSolo", () => { E.endGameNow(); api.close(); });
    on(el, "#owLastS", () => api.open("nearby", { results: true }));
    on(el, "[data-k]", b => { const why = E.requestGame(b.dataset.k); if (why) api.toast(why); else api.close(); });
    on(el, "[data-pin]", b => {
        const k = b.dataset.pin, L = V.list;
        let def = null;
        if (k[0] === "p") { const p = L.people[+k.slice(1)]; def = { x: p.x, z: p.z, name: p.name, icon: "💬", talk: true }; }
        else if (k[0] === "t") { const s = L.sights[+k.slice(1)]; def = { x: s.x, z: s.z, name: s.name, icon: s.icon }; }
        else if (k === "c") { const c = L.coins[0]; def = { x: c.x, z: c.z, name: "the nearest coin", icon: "🪙" }; }
        else if (k[0] === "x") { const x = L.ex[+k.slice(1)]; def = { x: x.x, z: x.z, name: x.name, icon: "🛣️" }; }
        else if (k[0] === "r") { const r = L.road[+k.slice(1)]; def = { x: r.x, z: r.z, name: r.name, icon: r.icon }; }
        if (def && E.pin(def)) { api.close(); }
    });
}
/** The town's ways back to the highway (world points at the ramp mouths). */
function exitsHere() {
    const T = ctx.town, plan = T && T.plan;
    if (!plan || !plan.def.exits) return [];
    return plan.def.exits.map(e => {
        const st = plan.byName[e.street];
        if (!st || (st.axis !== "ns" && st.axis !== "ew")) return null;
        const along = e.at + e.dir * -10, d = e.dir * 1.75;
        const x = st.axis === "ns" ? st.c - d : along, z = st.axis === "ns" ? along : st.c + d;
        return { x: plan.ORIGIN.x + x, z: plan.ORIGIN.z + z, name: e.name || e.street };
    }).filter(Boolean);
}
/** On the highway: the next town exit, places to pull into, a ringing job, Paint & Pray. */
function roadAhead() {
    const car = ctx.car, road = ctx.world.road, s = car.s, out = [];
    const add = (sAt, d, icon, name, sub) => { if (sAt < s - 20 || sAt > s + 9000) return; const p = road.point(sAt, d, {}); out.push({ x: p.x, z: p.z, m: sAt - s, icon, name, sub }); };
    if (ctx.town && ctx.town.exits) { const e = ctx.town.exits.filter(e => e.s > s - 40).sort((a, b) => a.s - b.s)[0]; if (e) add(e.s + 40, 11, e.emoji || "🏙️", `${e.name} exit`, "take the off-ramp into town"); }
    if (!E.party() && ctx.places && ctx.places.list) {
        try {
            for (const pl of ctx.places.list()) {
                const at = (ctx.places.at(pl.id) || []).filter(x => x > s + 30).sort((a, b) => a - b)[0];
                if (at != null) add(at, 9.5, pl.icon || "📍", pl.name, "pull in and stop");
            }
        } catch (e) { /* optional */ }
    }
    if (!E.party() && ctx.hustle && ctx.hustle.marker && !ctx.hustle.marker.done) add(ctx.hustle.marker.s, 9.5, "☎️", "A job's ringing", "drive into the payphone");
    out.sort((a, b) => a.m - b.m);
    return out.slice(0, 6);
}

export function registerApps(engine) {
    E = engine;
    const tryAdd = () => {
        if (!ctx.phone || !ctx.phone.addApp) return false;
        ctx.phone.addApp({
            id: "owparty", icon: "👯", name: "Friends", order: 15, color: "#7E57C2", color2: "#E91E63",
            visible: () => E.roam(),
            badge: () => { const g = E.getG(); return g && g.ph === "go" ? "!" : null; },
            render(el, api, arg) {
                V.party = arg || null;
                if (arg && arg.results) { el.innerHTML = resultsHtml(); wireResults(el, api); return; }
                if (arg && arg.friend) { friendView(el, api, arg.friend); return; }
                partyHome(el, api);
            },
            back(api) { if (V.party) { V.party = null; api.open("owparty", null); return true; } return false; },
        });
        ctx.phone.addApp({
            id: "nearby", icon: "📍", name: "Nearby", order: 25, color: "#039BE5", color2: "#00897B",
            badge: () => (E.pinned ? "•" : null),
            render(el, api, arg) {
                V.nearby = arg || null;
                if (arg && arg.results) { el.innerHTML = resultsHtml(); wireResults(el, api); return; }
                nearbyHome(el, api);
            },
            back(api) { if (V.nearby) { V.nearby = null; api.open("nearby", null); return true; } return false; },
        });
        return true;
    };
    if (!tryAdd()) import("../../core/ctx.js").then(m => m.on("boot", tryAdd));
}
