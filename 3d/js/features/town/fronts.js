// features/town/fronts.js — the storefronts' namer hook (features/storefronts sets it): the town engine asks it, in build
// order, what each shopfront's sign says and what state it's in, so a street never repeats a name. Without a namer the
// fronts keep their sign lists' names (the old behaviour).
export const FRONTS = { namer: null };
/** fn({ town, list, lines, x, z, i }, memo) → { lines, state, … } | null — memo is one object per town build. */
export function setFrontNamer(fn) { FRONTS.namer = fn; }
