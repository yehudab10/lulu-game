// features/impound — every number + every line (tune here).
export const ID = "impound";

/** The release fee (a coin SINK, against ~500–650 coins a played day). The very first impound ever: the "first offence" price. */
export const FEE = { normal: 120, first: 60 };

export const TUNE = {
    lot: { half: 5.6 },                     // m: the lot's walkable half-size inside the fence (the model is 12 × 12)
    sneak: 2.2, run: 3.6,                   // m/s inside (a stick, the run button)
    hotwire: 2.2,                           // s at her car, unseen
    guard: { r: 7.5, deg: 70, turn: [3.2, 5.5], walk: 1.1, awakeR: 9.5, awakeDeg: 95 },
    cam: { r: 9, deg: 40, sweep: 0.55, arc: 1.2 },
    seeFill: 1.6, seeDrain: 0.9,            // the "?" meter: s of being seen to fill (× the inverse), drain per s
    lookLife: 25,                           // s a guard's ⚠️ look stays live (a second spot = the chase)
};

export const CHARGE = {
    key: "GRAND THEFT AUTO (HER OWN CAR)", name: "GRAND THEFT AUTO (HER OWN CAR)", weight: 2, nudge: "help",
    cop: ["You broke into the impound lot. To steal a car. YOUR car.", "Ma'am, the car is evidence. Of you. Being you."],
    lulu: ["It's MY CAR! Look — it's PINK!", "You can't steal what's already yours! …can you?"],
    defense: "your honor, my client is charged with stealing a car from its rightful owner — namely, herself. The prosecution will have to explain how she is both the thief AND the victim. I'll wait.",
    court: [
        { who: "PROSECUTOR", p: "prosecutor", text: "The defendant broke into a police impound lot at night and hotwired a pink convertible." },
        { who: "PROSECUTOR", p: "prosecutor", text: "…the registered owner of which is… *flips page* …the defendant. *flips back* Hm." },
        { who: "JUDGE", p: "judge", text: "Is the victim in the courtroom? *looks at her* …Does the victim wish to press charges against herself?" },
    ],
};

export const L = {
    // the chip on the objective line (the lowest priority)
    chip: "🚗 Your car is impounded", chipSub: "City Hall or the precinct · {fee} 💰",
    chipReady: "🚗 Release slip ✓", chipReadySub: "go to the impound gate",
    // the gate
    gateLabel: "🚗 YOUR CAR (IMPOUNDED)", gateReady: "🧾 SHOW THE RELEASE — get your car",
    gateWho: "THE IMPOUND WINDOW", gateEmoji: "🪟",
    gateAsk: "Name? …Pink convertible. Yeah, it's here. Release fee's {fee}. Or get it stamped at City Hall, same price, longer line.",
    gatePay: "💰 Pay the release — {fee}", gateCityHall: "🏛️ I'll go to City Hall", gateLeave: "👋 Not now",
    broke: "You need {fee} coins and you have {have}. Don't worry — it'll be back at your house by tomorrow. We're not monsters. We're a tow yard.",
    paid: "Stamped, signed, copied in triplicate. Here's your car. Try not to see us again.",
    rolled: "*the gate rattles open — your car rolls out to the kerb*",
    // City Hall's Permits window
    winOpt: "🚗 Vehicle release — {fee} (in triplicate)", winAsk: "A vehicle release. Form VR-7, in triplicate. {fee} coins. Sign here, here, and… here.",
    winYes: "✍️ Sign ×3 — pay {fee}", winNo: "✖ Not now",
    winDone: "*STAMP* *STAMP* *STAMP*. Take this to the impound gate. Don't lose it, we don't have a form for that.",
    // 📞 Contacts › City Hall
    phoneRow: "Release my impounded car", phoneSub: "{fee} coins · tap twice", phoneArm: "Tap again to pay {fee}", phoneDone: "🧾 Release slip ready — show it at the impound gate",
    // the break-in
    panel: "🔩 THE LOOSE FENCE PANEL — sneak in", panelShort: "SNEAK", panelAwake: "🔦 Bruno's EXTRA awake today…",
    in: ["(okay. quiet. QUIET.)", "(it's not stealing if it's yours. Right?)"],
    car: "🔧 HOTWIRE YOUR OWN CAR", wiring: ["(red to… red? Why are they ALL red?)", "(it's my car, why don't I have a KEY?)"],
    guardName: "BRUNO (NIGHT GUARD)",
    guardIdle: ["*munches a sandwich*", "*humming*", "Quiet night. Love a quiet night."],
    look: ["HEY! …huh. Must've been a raccoon.", "Who's there?! …I've got a flashlight and I'm not afraid to point it!"],
    caught: "HEY! THAT'S A POLICE IMPOUND! …and that's YOUR car, isn't it. STOP!",
    clean: "🚗 Got her car back — no fee, no witnesses",
    out: ["Come to mama.", "Nobody saw that. Right? RIGHT?"],
};
