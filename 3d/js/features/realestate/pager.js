// features/realestate/pager.js — a long list in the dialogue box, a few rows at a time: the box has no height limit, so
// eight options would run off the top of a landscape phone. ≤ `per` rows + "More ›" + the way back = ≤ 5 buttons.
/** choose(text, options) → index; rows = labels. → the picked row's index, or -1. */
export async function pickPaged(choose, text, rows, { per = 3, back = "‹ Back" } = {}) {
    if (rows.length <= per + 1) { const i = await choose(text, rows.concat([back])); return i >= 0 && i < rows.length ? i : -1; }
    for (let p = 0; ; p = (p + per) % rows.length) {
        const page = rows.slice(p, p + per);
        const more = `More › (${Math.min(rows.length, p + per)} of ${rows.length})`;
        const i = await choose(text, page.concat([more, back]));
        if (i < 0 || i === page.length + 1) return -1;
        if (i < page.length) return p + i;
    }
}
