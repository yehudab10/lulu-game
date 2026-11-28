// features/cameras — the numbers and the words. Every fine / day / cap lives here (tune freely).
export const ID = "cameras";

/** Ocean Parkway (Midwood): the owner's numbers, exactly — limit 25, the camera fires ONLY above 35 mph. */
export const PKWY = { town: "midwood", street: "Ocean Pkwy", limit: 25, trigger: 35, fine: 40, at: [95, 200], side: [1, -1], where: "Ocean Parkway" };
/** School zones: every school block (town spots), limit 15, fires above 25 mph — only in school hours (the beacon's on). */
export const SCHOOL = { limit: 15, trigger: 25, fine: 60, spots: { school: "the school on Avenue M", yeshiva: "the cheder on Carpool Lane", baisyaakov: "the Bais Yaakov" }, reach: 45 };
/** School hours (the device clock): Sun–Thu 7:30–16:30 · Fri 7:30–13:00 · never Shabbos or at night. */
export const SCHOOL_HOURS = { week: [7.5, 16.5], friday: [7.5, 13] };
export const TUNE = {
    dayCap: 3,          // tickets a REAL day at most (one bad drive isn't ten fines)
    rearm: 25,          // m past a camera before the same camera can fire again (one ticket per pass)
    mailAfter: 2,       // played days after the flash: the envelope is in her mailbox
    dueAfter: 3,        // played days after it arrives: pay by
    lateFee: 20,        // + this, and a second notice
    summonsAfter: 3,    // played days after the second notice: a summons (Courtroom 2B)
    warrantAfter: 3,    // played days after an unanswered summons: a bench warrant
    warrantUnpaid: 3,   // …or this many unpaid tickets at once
    dismiss: 0.4,       // the judge's chance to dismiss it
    photos: 8,          // pictures kept in the save
};
export const CHARGE = {
    key: "UNPAID SPEED CAMERA TICKETS", name: "UNPAID SPEED CAMERA TICKETS", weight: 2, nudge: "none",
    cop: ["There's a bench warrant on this car. Speed cameras. Lots of them.", "Miss, the camera's been writing to you. You didn't write back."],
    lulu: ["I thought the mail was a CATALOGUE!", "Those photos were very unflattering. I was going to frame them."],
    defense: "my client never received the notices. Her mailbox is shaped like a kugel. The mail carrier was confused.",
    court: [
        { who: "PROSECUTOR", p: "prosecutor", text: "Exhibit A: the photographs. Exhibit B: more photographs. The People rest." },
        { who: "JUDGE", p: "judge", text: "That IS a very pink car. Hard to mistake. Continue." },
    ],
};
export const L = {
    flash: ["…was that a FLASH?", "Did that pole just take my PICTURE?", "Oh no. That was a camera."],
    sign: { pkwy: ["SPEED LIMIT 25", "PHOTO ENFORCED"], school: ["SCHOOL ZONE · 15", "WHEN FLASHING · PHOTO ENFORCED"] },
    // (who writes: the town whose camera flashed — Lakewood's school zones are the City of Lakewood's, not Midwood's borough)
    mailFrom: town => (town === "lakewood" ? "City of Lakewood" : "Borough of Midwood"),
    mailMsg: town => `📬 Mail from the ${town === "lakewood" ? "City of Lakewood" : "Borough of Midwood"}. It's in your mailbox.`,
    ima: "Lulu. There's MAIL for you. From the CITY.",
    chip: "📬 You have mail",
    mailbox: "📬 MAIL FROM THE CITY",
    noticeTitle: n => (n.stage === "late" ? "📬 SECOND NOTICE — Speed camera violation" : n.stage === "summons" ? "⚖️ SUMMONS — Speed camera violation" : "📬 NOTICE — Speed camera violation"),
    noticeBody: t => `${t.where} · ${t.mph} mph in a ${t.limit} zone · ${new Date(t.at).toLocaleDateString()}`,
    fineLine: (t, owed) => `Fine: ${owed} coins. Pay by your ${t.dueIn > 0 ? `next ${t.dueIn} day${t.dueIn === 1 ? "" : "s"} of driving` : "TODAY"} at City Hall's Taxes window or 📞 Contacts › City Hall.`,
    summonsLine: "You're summoned to Courtroom 2B. Fight it, or pay before then.",
    lateLine: n => `A late fee of ${n} coins has been added.`,
    close: "📬 Got it",
    pin: "Pay tickets here",
    court: {
        counsel: { name: "THE BOROUGH ATTORNEY", emoji: "📸", color: "#455A64" },
        title: t => `THE ${t.town === "lakewood" ? "CITY" : "BOROUGH"} v. LULU — SPEED CAMERA, ${t.where.toUpperCase()}`,
        label: "⚖️ Fight your speed-camera ticket",
        docket: t => `📋 NOW: The Borough v. Lulu — ${t.mph} mph on ${t.where}`,
        open: t => `Case 2B: the speed camera on ${t.where} says ${t.mph} in a ${t.limit}. Exhibit A: the photograph.`,
        borough: ["Your honour, the camera never lies. It also never blinks. Very creepy, but accurate.", "The photograph speaks for itself. It says 'PINK'."],
        judgeAsk: "Young lady. Is that your car in Exhibit A?",
        defence: [
            { label: "🎀 \"That's clearly a DIFFERENT pink convertible.\"", judge: "…There IS a smudge. Hm." },
            { label: "📏 \"The camera's miscalibrated. It said a pigeon did 40.\"", judge: "The pigeon has been a problem." },
            { label: "🥘 \"I was rushing a kugel to a shiva house.\"", judge: "A noble kugel. Still: thirty-six." },
        ],
        dismissed: "Dismissed! The court can't be sure that's you. Drive slower anyway.",
        upheld: (n, all) => `Upheld. ${n} coins today${all ? "" : " — what you have; the rest stays owed"}. Next case!`,
    },
    warrantChase: "🚨 BENCH WARRANT — unpaid camera tickets!",
    marxdani: "The People's Lens sees everyone equally! Even me. Especially me. I've had four tickets.",
};
