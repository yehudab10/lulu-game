// features/life — 📻 THE RADIO LOOKS OUT OF THE WINDOW (round 3). When the weather turns (rain, snow, fog, the rain
// stopping) or the sun goes down while Lulu's driving, the DJ on a talking station (SIMCHA · SMOOTH · KVETCH · DOVID DOV
// FM — not LULU FM, which has no DJ) mentions it the next time they talk, instead of a stock line. Through hustle's
// radio hook (`ctx.hustle.radio.topical(fn)`: fn(station) → a line | null, asked when the station picks what to say
// next) — so it's the radio's own ticker, its own timing, never an extra pop-up. Each topic is offered once, for 70 s.
import { ctx } from "../../core/ctx.js";
import { L } from "./common.js";

const LINES = {
    rain: ["It's coming down out there — wipers on, everybody. Somewhere a bubbe is saying \"I TOLD you to take an umbrella.\"",
        "Rain! Slow down, leave a gap, and no — the puddle doesn't count as a car wash.",
        "Bulletin: it's raining. The umbrella gemach on Main has fourteen umbrellas. All black. Good luck."],
    snow: ["SNOW! Drive slow, and if you see a kid with a sled — wave. You were that kid.",
        "It's snowing! Every shul parking lot is about to become a skating rink. Careful out there."],
    fog: ["Fog's rolling in. If you can't see the car in front of you, that's not a mitzvah — that's a problem. Low beams.",
        "Pea-soup fog out there. Ima says low beams. Ima is right. Ima is always right."],
    clear: ["Rain's done! Look out the window — if there's a rainbow, that one's on the house.",
        "And just like that the sun's back. Roll the window down. Not all the way. Your hair."],
    sunset: ["The sun's going down, folks — headlights on. Somewhere a cholent just went in the oven.",
        "Sunset on the highway. Beautiful. Now eyes back on the road, mamaleh.",
        "Golden hour, everybody. Even the traffic looks nice. Almost."],
    night: ["Late-night drivers, this one's for you. Stay awake — have a coffee. Have TWO, I'm not your mother.",
        "It's dark out. If you're still driving, call your mother. She's up. She's always up."],
};
const BY_STATION = {
    talk: {
        rain: ["Rain. AGAIN. Callers, I don't want to hear about your knees. I KNOW about your knees.", "It's raining and my phone lines are full of people who'd like to complain about it. Line one, you're on."],
        sunset: ["The sun is setting. Another day nobody called in to say thank you. Line two, go ahead."],
        fog: ["Fog. You know what fog is? Fog is a cloud that gave up. Line three."],
    },
    lounge: {
        rain: ["A little rain on the windshield… smooth. Let the wipers keep the beat.", "Raindrops. Velvet Yossi says: slow merge, warm heater, smooth life."],
        sunset: ["The sun goes down… the lights come up… and the music gets smoother. Lean back."],
        night: ["Night drive. Just you, the road, and Velvet Yossi. Keep it smooth."],
    },
    dovid: {
        rain: ["It's raining. The mystery singer is probably somewhere dry. We have NO idea where."],
        sunset: ["Sunset. Somewhere the mystery singer is watching it too. Probably. Who IS he?"],
    },
};
const pick = a => a[Math.floor(Math.random() * a.length)];
export const RD = { hooked: false, weather: "", clock: -1, topic: "", until: 0, said: 0, log: [] };

function offer(kind) { RD.topic = kind; RD.until = L.time + 70; }
/** hustle asks this when a station picks its next line. */
function topical(st) {
    if (!RD.topic || L.time > RD.until || !st || st.id === "auto" || st.id === "off") return null;
    const kind = RD.topic;
    const pool = (BY_STATION[st.id] && BY_STATION[st.id][kind]) || LINES[kind];
    if (!pool) return null;
    RD.topic = ""; RD.said++;
    const line = pick(pool);
    RD.log.push(kind); if (RD.log.length > 8) RD.log.shift();
    return line;
}
/** Every life step: hook up once hustle is there, watch the sky. */
export function tickRadio() {
    if (!RD.hooked && ctx.hustle && ctx.hustle.radio && typeof ctx.hustle.radio.topical === "function") { RD.hooked = true; ctx.hustle.radio.topical(topical); }
    if (L.foot) return;
    const w = L.weather;
    if (RD.weather && w !== RD.weather) {
        if (w === "rain" || w === "snow" || w === "fog") offer(w);
        else if (w === "clear" && RD.weather === "rain") offer("clear");
    }
    RD.weather = w;
    const c = ctx.atmos && typeof ctx.atmos.clock === "number" ? ctx.atmos.clock : -1;
    if (RD.clock >= 0 && c >= 0) {
        if (RD.clock < 0.47 && c >= 0.47 && c < 0.55) offer("sunset");
        else if (RD.clock < 0.66 && c >= 0.66 && c < 0.75) offer("night");
    }
    RD.clock = c;
}
export function radioInfo() { return { hooked: RD.hooked, topic: RD.topic, said: RD.said, log: RD.log.slice() }; }
/** Tests: offer a topic now. */
export function radioOffer(kind) { offer(kind); return kind; }
