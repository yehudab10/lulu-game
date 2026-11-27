// features/cars — every number + every line (tune here).
export const ID = "cars";

export const TUNE = {
    tick: 0.4,              // s between looks at where her cars are (never per frame)
    near: 230, far: 260,    // m: a parked car is built inside `near` of her, taken down past `far` (no cost when far)
    getIn: 3.3,             // m: ✋ reach to a parked car
    moved: 1.0,             // m a parked car must move before its saved spot is written again
    familyR: 10,            // m round Ima's driveway that counts as "at home"
};

export const L = {
    getIn: "🔑 GET IN — your {name}", short: "DRIVE",
    swap: ["Hello, gorgeous. Missed me?", "There you are!", "Right where I left you. Good car.", "Okay, YOU'RE driving today. I mean — I am. In you."],
    // 📱 🗺️ the Map
    head: "🚗 Your cars",
    with: "with you", withFoot: "with you — parked right here", home: "at home",
    left: "parked in {town}", impound: "impounded in {town}",
    here: "{m} m", up: "up the road",
};
