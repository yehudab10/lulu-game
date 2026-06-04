    // ── Spawn tuning (EDIT ME) ───────────────────────────────
    // Rarity/timing for the random "encounter" events in Lulu's driving game.
    // Everything here is safe to tweak — just edit the numbers and rebuild
    // (`node build.js`). Core obstacles (cars/cones/coins) are NOT here; they
    // stay frequent. These are the special, occasional events.
    //
    //   first:  [min,max] seconds before the event can FIRST appear in a run.
    //           Randomized per run, so the ORDER of events differs every time.
    //   every:  [min,max] seconds between attempts after that.
    //   chance: 0..1 probability an attempt actually spawns (lower = rarer).
    //
    // Want something rarer?  → raise `every` and/or lower `chance`.
    // Want it more common?   → lower `every` and/or raise `chance`.
    var SPAWN_CONFIG = {
        parkingSign: { first: [25, 75],  every: [55, 100], chance: 0.50 }, // 🅿 parking challenge offer
        iceCream:    { first: [30, 85],  every: [65, 115], chance: 0.50 }, // 🍦 ice-cream bonus
        avigail:     { first: [25, 80],  every: [60, 110], chance: 0.45 }, // Avigail pickup
        salon:       { first: [30, 85],  every: [65, 115], chance: 0.45 }, // 💇 salon scene
        sasquatch:   { first: [40, 100], every: [75, 150], chance: 0.35 }, // 🦶 sasquatch easter egg
        heshyPool:   { first: [25, 70],  every: [40, 80],  chance: 0.50 }, // 🏊 Heshy-in-the-pool easter egg
        heart:       { first: [15, 35],  every: [20, 40],  chance: 0.60 }  // ❤️ extra-life pickup
    };

    // Per-event countdown timers, (re)initialized at the start of each run.
    var spawnTimers = {};
    function initSpawnTimers() {
        for (var key in SPAWN_CONFIG) {
            var c = SPAWN_CONFIG[key];
            spawnTimers[key] = rand(c.first[0], c.first[1]);
        }
    }
    // Counts down `name`'s timer; when it elapses, resets it and rolls `chance`.
    // Returns true only on the frames the event should actually spawn.
    function tickSpawn(name, dt) {
        var c = SPAWN_CONFIG[name];
        if (!c) return false;
        if (spawnTimers[name] === undefined) spawnTimers[name] = rand(c.first[0], c.first[1]);
        spawnTimers[name] -= dt;
        if (spawnTimers[name] > 0) return false;
        spawnTimers[name] = rand(c.every[0], c.every[1]);
        return Math.random() < c.chance;
    }
