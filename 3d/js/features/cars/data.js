// features/cars — every number + every line (tune here).
export const ID = "cars";

export const TUNE = {
    tick: 0.4,              // s between looks at where her cars are (never per frame)
    near: 230, far: 260,    // m: a parked car is built inside `near` of her, taken down past `far` (no cost when far)
    getIn: 3.3,             // m: ✋ reach to a parked car
    moved: 1.0,             // m a parked car must move before its saved spot is written again
    familyR: 10,            // m round Ima's driveway that counts as "at home"
    slots: 7,               // Ima's kerb spaces (her driveway holds the car she's using; the rest stand along her street)
    atHouse: 45,            // m from a house she owns: a car parked that close is "there" for a day that starts there
    // ── Tuvia's Towing (stage 3) ──
    hwLot: 12,              // m off the highway's centre line: past this it's a lot (a rest area, a roadside / dealer lot, JFK) — legal parking
    hwNear: 300, hwAway: 120,     // highway lanes / shoulder: towed once she's been > hwNear m away for hwAway s (or left the highway)
    zoneNear: 120, zoneAway: 120, // a town's travel lane / a no-parking stretch: the same, closer in (or she left the town)
    days: 3,                // real days anywhere else (never at Ima's or a house she owns, never a dealer's lot)
    deliver: 40,            // 📞 Tuvia brings a LEFT car home (not an impounded one — that's the police)
};
/** The towed car's release at the impound gate (features/impound: FEE.tow) — a tow is not an arrest. */
export const TOW_FEE = 60;
/** Ima's family minivan: the never-stuck ride when none of her cars is at home (slow, a borrowed shell — not hers to sell or mod). */
export const MINIVAN = { key: "town_minivan", handling: { top: 0.72, acc: 0.62, grip: 0.92, brake: 0.95 } };

export const L = {
    getIn: "🔑 GET IN — your {name}", short: "DRIVE",
    swap: ["Hello, gorgeous. Missed me?", "There you are!", "Right where I left you. Good car.", "Okay, YOU'RE driving today. I mean — I am. In you."],
    // 📱 🗺️ the Map
    head: "🚗 Your cars",
    with: "with you", withFoot: "with you — parked right here", home: "at home",
    left: "parked in {town}", impound: "impounded in {town}",
    here: "{m} m", up: "up the road",
    hwLeft: "parked on the highway", hwLot: "parked off the highway", dealer: "waiting at {name}",
    towedAt: "towed — at the {town} impound ({fee} at the gate)",
    // Tuvia's Towing (📞 + the message when he tows)
    tuvia: "Tuvia's Towing", tuviaTag: "brings your car home · {fee} 💰", tuviaEmoji: "🚛",
    towed: {
        highway: "Hey, it's Tuvia. Your {name} was sitting on the highway shoulder — that's a no-no. It's at the {town} impound now. {fee} coins at the gate. 🚛",
        zone: "Tuvia here. Your {name} was parked in a no-parking spot in {from}. Towed it to the {town} impound. {fee} coins at the gate, the window's open. 🚛",
        days: "Tuvia here. Your {name} sat in {from} for {days} days and the neighbours called. It's at the {town} impound — {fee} coins at the gate. 🚛",
    },
    wreck: "Chaverim towed your wrecked {name} home — no charge, give tzedakah. 🔧 (Abba says it's fine. Mostly.)",
    rowHead: "Your cars out there:", rowBring: "🚛 Bring my {name} home — {fee} 💰", rowArm: "Tap again — {fee} 💰 to bring it home",
    rowImp: "{name}: at the {town} impound — that's the police lot, I can't touch it", rowNone: "All your cars are home or with you. Call me when they're not! 🚛",
    rowBroke: "That's {fee} coins, honey. You've got {have}.",
    delivered: "Your {name} is at Ima's — parked on her street. She says hi. And that it's blocking the recycling. 🚛",
    minivan: ["No car at home… Ima's minivan it is. 🙄", "Ima's minivan. Again. (Bring it back with gas in it!)"],
    brokeKeep: "You need {fee} coins and you have {have}. It's not going anywhere — literally, that's the whole point of an impound.",
};
