// features/airport — every line of text: the signs, the parody airlines, Officer Segal, Lulu.
// Cartoon only (the owner's rule): parody airlines / shops / logos, nothing about real incidents or real
// security procedures. Dovid Dov canon: strangers only wonder who he is; Lulu and the family know (stage 3).

/** The exit number on every board (the towns are 9 and 91). */
export const EXIT_NO = "12";

/** The highway's advance signs, the gantry, the gore, the ramp. */
export const SIGNS = {
    mile: ["✈ JFK AIRPORT", "ALL TERMINALS", "1 MI"],
    half: ["✈ JFK AIRPORT", "TERMINAL 4½ · PARKING", "½ MI · bring snacks"],
    last: ["LAST EXIT BEFORE", "YOUR FLIGHT", "(you don't have a flight)"],
    gantry: ["EXIT 12 ↘", "✈ JFK AIRPORT"],
    thru: ["↑ THRU TRAFFIC", "EVERYWHERE ELSE", "(no boarding pass needed)"],
    gore: ["EXIT ↗", "12 ✈"],
    ramp: ["✈ JFK", "DEPARTURES · ARRIVALS", "PARKING ↗"],
    back: ["↖ TO HIGHWAY", "THANK YOU FOR", "FLYING NOTHING"],
};
/** The airport's own boards (one atlas: features/airport/build.js). */
export const BOARDS = {
    welcome: ["Welcome to JFK", "John F. Kugel International", "est. a long time ago"],
    term: ["JFK INTERNATIONAL · TERMINAL 4½"],
    dep: ["✈↗ DEPARTURES", "Kugel Air · El Oy · Shmear Jet · Nu? Air"],
    arr: ["✈↘ ARRIVALS", "Baggage Claim · Bubbes Waiting Area"],
    soon: ["TERMINAL OPENING SOON", "the kugel is still in the oven", "please enjoy our lovely kerb"],
    guide: ["TERMINAL 4½ ↑", "DEPARTURES · ARRIVALS", "PARKING →"],
    parking: ["SHORT-TERM PARKING", "$∞ / hour", "long-term: also ∞"],
    taxi: ["🚕 TAXI LINE", "honk patiently"],
    shuttle: ["🚌 SHUTTLE", "Kugel Air Park & Fly"],
    noStop: ["NO STOPPING", "(we mean it-ish)", "UNLOADING ONLY"],
    runway: ["⚠ AUTHORIZED PLANES ONLY", "people: not planes", "no exceptions, Lulu"],
    tower: ["TOWER", "we see you"],
    cell: ["📱 CELL PHONE LOT", "wait here, call Ima"],
    exitBack: ["↙ HIGHWAY", "ALL DIRECTIONS", "drive safe, shepsel"],
    airlines: [
        ["✈ KUGEL AIR", "we're baked fresh daily"],
        ["✈ EL OY", "oy, the legroom"],
        ["✈ SHMEAR JET", "spread out a little"],
        ["✈ NU? AIR", "so are we going or not"],
    ],
};
/** The parody liveries: fuselage, tail, stripe + the name on the side. */
export const LIVERIES = [
    { name: "KUGEL AIR", Paint: "#FFF8E7", Tail: "#E0A526", Stripe: "#8D5524" },
    { name: "EL OY", Paint: "#F7FBFF", Tail: "#1E5AA8", Stripe: "#1E5AA8" },
    { name: "SHMEAR JET", Paint: "#FFFFFF", Tail: "#E53935", Stripe: "#FFB300" },
    { name: "NU? AIR", Paint: "#F3F6F8", Tail: "#7B1FA2", Stripe: "#26A69A" },
];

/** The decel-lane cue (a prompt, never a popup). */
export const CUE = {
    decel: `✈ EXIT ${EXIT_NO} · JFK AIRPORT <small>· steer left to stay on the highway</small>`,
    ramp: "✈ JFK · DEPARTURES · ARRIVALS · PARKING",
};
/** The arrival banner (once a visit). */
export const ARRIVE = { title: "✈ JFK International", sub: "Terminal 4½ · kerbside only (for now)" };

/** Lulu, on arrival and walking round. */
export const LULU = {
    arrive: ["JFK! I have no flight. I'm just here for the vibes.", "Airports smell like adventure and pretzels.", "Nobody tell Ima I drove to JFK for fun."],
    door: ["Locked. 'Opening soon.' Story of my life.", "The kugel is STILL in the oven? It's an airport!", "I'll wait. I'm very good at waiting. (I'm not.)"],
    plane: ["THAT ONE'S SO LOW!", "Bye, plane! Bring me back a snow globe!", "Imagine flying. Couldn't be me. (It could be me.)"],
    taxi: ["Every taxi driver here has honked at me. I respect it."],
    again: ["Still not a plane.", "Okay okay, I'm going.", "The fence remembers me."],
};
/** Officer Segal (airport security, on a Segway). Variants rotate; cartoon only. */
export const SEGAL = [
    { guard: ["Ma'am. Ma'am! That side is for PLANES.", "Even the pigeons need a boarding pass."], lulu: "I'm basically a plane. I have a seatbelt." },
    { horn: true, guard: ["Hear that? The Kugel Air jet is honking at you.", "That means 'go back to the kerb'."], lulu: "Rude. But fair." },
    { guard: ["Runway's closed to Lulus.", "It's in the rule book. Page one. Big letters."], lulu: "That's oddly specific." },
    { guard: ["Is that… kugel I smell?", "Never mind. Carry on. Away from the fence."], lulu: "It's my perfume. Eau de Kugel." },
];
