// features/law — the rules: bounty / bail / fees / verdicts, the 3-strikes
// rule, and everything that persists in the SHARED 2D save (convictions,
// offenses, escapes, the open-warrant file `wanted`, and `lockup` — an
// unfinished cell / sentence / fugitive stretch that survives a refresh in
// either version). Same formulas and numbers as src/10d-jail-court.js.
import { emit } from "../../core/ctx.js";
import { shared, wallet, flushShared } from "../../core/save.js";
import { CHARGE_WEIGHT, BOUNTY_CAP, CHARGE_DIALOGUE, CHARGE_DEFENSE, LAWYER_TIERS, ABBA_TIER } from "./data.js";

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── the shared 2D save ───────────────────────────────────────────────────
export const S = {
    get convictions() { return shared.get().convictions || 0; },
    get offenses() { return shared.get().offenses || 0; },
    get escapes() { return shared.get().escapes || 0; },
    get wanted() { const w = shared.get().wanted; return Array.isArray(w) ? w : []; },
    get lockup() { const l = shared.get().lockup; return l && typeof l === "object" ? l : null; },
    get avigailRel() { const r = shared.get().avigailRel; return typeof r === "number" ? r : 50; },
};
export function bump(field, n = 1) { shared.update(s => { s[field] = (s[field] || 0) + n; }); }

/** Persist an unfinished stretch (same shape as the 2D saveLockup). */
export function saveLockup(mode, charges, bail, days, total, fugT, escFails, escUsed, extra = {}) {
    shared.update(s => {
        s.lockup = Object.assign({ mode, charges: charges || [], bail: bail || 0, days: days || 0, total: total || 30, fugT: fugT || 0,
            escFails: escFails || 0, escUsed: !!escUsed }, extra);
    });
}
export function patchLockup(fields) { shared.update(s => { if (s.lockup) Object.assign(s.lockup, fields); }); }
export function clearLockup() { shared.update(s => { s.lockup = null; }); }

/** Open warrants: what she's accused of but hasn't answered for (only a judge clears them). */
export function addWanted(charges) {
    shared.update(s => {
        if (!Array.isArray(s.wanted)) s.wanted = [];
        for (const c of charges || []) if (!s.wanted.includes(c)) s.wanted.push(c);
        // the file keeps only the 8 WORST offenses (pettiest fall off first)
        if (s.wanted.length > 8) {
            s.wanted.sort((a, b) => chargeWeight(b) - chargeWeight(a));
            s.wanted = s.wanted.slice(0, 8);
        }
    });
}
export function clearWanted() { if (S.wanted.length) shared.update(s => { s.wanted = []; }); }

/** Like the 2D chargeCoins: take what she can afford (never into debt). Returns what was paid. */
export function chargeCoins(amount) {
    amount = Math.max(0, Math.round(amount || 0));
    flushShared();
    const pay = Math.min(amount, wallet.coins);
    if (pay > 0) wallet.spend(pay);
    return pay;
}
export function canAfford(n) { return wallet.coins >= n; }

/** A lifetime stat the 2D scrapbook / quests understand (meta forwards it). */
export function stat(id, n = 1) { emit("stat", { id, n }); }

// ── charges & money ──────────────────────────────────────────────────────
export function chargeWeight(c) {
    if (CHARGE_WEIGHT[c] != null) return CHARGE_WEIGHT[c];
    for (const k of Object.keys(CHARGE_WEIGHT)) if (c && c.startsWith(k)) return CHARGE_WEIGHT[k];
    return 2;   // unknown charge = moderate
}
export function bountyFor(charges, convictions = S.convictions) {
    let sum = 0;
    for (const c of charges || []) sum += chargeWeight(c);
    if (sum === 0) sum = 1;
    const strikes = Math.min(convictions || 0, 5);
    return Math.min(BOUNTY_CAP, Math.round(13 * sum * (1 + 0.08 * strikes)));
}
export function worstCharge(charges) {
    let w = null, best = -1;
    for (const c of charges || []) { const cw = chargeWeight(c); if (cw > best) { best = cw; w = c; } }
    return w || "BEING SUSPICIOUS";
}
/** Drama tier 0–3 from the worst charge (a pile of petty ones nudges it to 1). */
export function courtDramaTier(charges) {
    const sev = chargeWeight(worstCharge(charges));
    if (sev >= 4) return 3;
    if (sev >= 3) return 2;
    if (sev >= 2 || (charges && charges.length >= 3)) return 1;
    return 0;
}
export const bailFor = charges => Math.max(15, Math.round(bountyFor(charges) * 0.4));
export const pleaFineFor = charges => Math.max(8, Math.round(bountyFor(charges) * 0.3));
export const bribeCostFor = () => Math.min(120, 45 + Math.min(S.convictions, 5) * 8);
export const lawyerFee = (tier, nCharges) => tier.free ? 0 : Math.round(nCharges * tier.feeMul * (1 + S.convictions * 0.2));
export const sentenceDays = () => Math.min(150, 45 + Math.max(0, (S.convictions || 1) - 1) * 25);
export const releaseFee = total => Math.min(50, 15 + Math.round(total * 0.3));
export function lawyerTiers(abbaAvailable) { return abbaAvailable ? [ABBA_TIER, ...LAWYER_TIERS] : LAWYER_TIERS; }

export function chargeDialogueFor(charges) {
    for (const d of CHARGE_DIALOGUE) for (const c of charges || []) if (c.includes(d.key)) return d;
    return null;
}
export function lawyerChargeArgument(tier, charges) {
    let snip = null;
    for (const d of CHARGE_DEFENSE) { if (charges.some(c => c.includes(d.key))) { snip = d; break; } }
    if (!snip) snip = { arg: "the prosecution's case is, frankly, vibes and hearsay, your honor." };
    const lead = tier.name === "Public Defender" ? "Uh — *checks the wrong file* — your honor, I'll argue that "
        : tier.name === "Abba" ? "Your honor, as her FATHER and her counsel: "
        : tier.name === "Hotshot Lawyer" ? "Your honor, I'll be brief and devastating: "
        : "Your honor, the defense contends ";
    return lead + snip.arg;
}

export function rollVerdict(opt) {
    const r = Math.random();
    let acc = 0;
    for (const [v, p] of opt.outcomes) { acc += p; if (r <= acc) return v; }
    return "fine";
}

/**
 * The 2D "ONE legible deliberation pass": base odds from the chosen defense,
 * then a single bounded shift from the jury-mood lean (± one die of jitter);
 * a mistrial springs her, three strikes is a hard jail.
 */
export function deliberate(court, opt) {
    let verdict = rollVerdict(opt);
    if (court.mistrial) return "dismissed";
    if (court.threeStrikes) return "jail";
    const up = { jail: 0, fine: 1, dismissed: 2 };
    let v = up[verdict];
    const eff = (court.lean || 0) + rand(-0.35, 0.35);
    if (eff <= -1.1) v -= 2; else if (eff <= -0.45) v -= 1;
    else if (eff >= 1.1) v += 2; else if (eff >= 0.45) v += 1;
    v = clamp(v, 0, 2);
    return v === 2 ? "dismissed" : v === 1 ? "fine" : "jail";
}

/** Fugitive heat: 1★ … 5★, one more every 11 s on the lam (2D wantedLevel). */
export const fugitiveStars = fugT => clamp(Math.floor(fugT / 11) + 1, 1, 5);
