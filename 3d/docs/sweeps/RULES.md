# Shabbos fix sweep (2026-11-27 → 11-28) — rules every sweep agent follows

The owner (a non-coder; see AGENTS.md §2) is away until **2026-11-28 22:00 UTC** and said, verbatim:
"find inconsistencies and bugs and overall game logic flaws and fix them. I'm talking everything… I pretty much just
want fixes in every way for everything. Anything that can be improved for user experience. I will be away so you have
my approval until then." Nobody will answer questions: make sensible calls, write them down, keep going.

This is a FIX sweep, not a feature sprint: bugs, broken or contradictory logic, dead ends, exploits, confusing UX,
wrong text, things that don't match what the game tells the player. No new features, modes, menus or pop-ups.

## Read first
`AGENTS.md` (§2 owner + tone, §3 golden rules, §4 tests + CI, §5 workflow, §6 in-flight table, §7 known issues),
`CLAUDE.md`, the parts of `3d/ARCHITECTURE.md` for your area. The game is the 3D one in `3d/` (three.js r170, plain ES
modules, no build). `src/` + `game.js` are the legacy 2D game: leave them alone.

## The other account
Another account's agents are finishing their own branches right now (they land on main all day). Before editing a
feature folder, check AGENTS.md §6 and `git log -1 --format=%cr origin/ci/<name>` for the branch that owns it: if it moved in
the last ~2 hours and is not LANDED, don't edit that folder — write the bug in your notes file instead ("left for
<branch>"). Landed features with nobody on them are yours to fix. Merge origin/main often.

## How to work
1. Claim: add a `ci/<your-branch>` row to AGENTS.md §6 (what you're sweeping), commit, push to `origin ci/<your-branch>`.
2. Keep a running notes file **`3d/docs/sweeps/<your-branch>.md`**: every finding (what the player sees, where in the
   code), its status (fixed <hash> / left + why). Update and commit it as you go — if a usage limit or a restart stops
   you, this file + your pushed branch are how the work resumes. Push after EVERY commit.
3. Find problems by (a) reading the code for logic errors and contradictions, (b) playing the real flows in headless
   Chromium with the QA watchdog (`scripts/lib/qawatch.js`: `W.install(t)` … `W.check(t, label, await W.report(t))`), on a
   phone viewport (390×844 touch) first — most players are on phones — then desktop / controller, (c) LOOKING at
   screenshots yourself. Think like a 12-year-old player: what is confusing, unfair, broken, or pointless?
4. Fix each one small and safely; add a check for it to a test (the feature's own test file, or your sweep's file).
   Prefer fixing the cause over loosening a test. Never skip / disable a test to get green.
5. Land in SMALL BATCHES as you go (every few fixes), not one big landing at the end: merge origin/main,
   `node build.js --check`, `node scripts/copy-web.js`, the affected tests green, then `git push origin HEAD:main`
   (fast-forward; if main moved, merge again). Each landing: a plain-English line, newest first, under the
   "Shabbos 2026-11-27 → 11-28" heading in `3d/docs/away-log.md` (what the player notices; no code words), and keep
   your §6 row current. After a landing, check the push's Smoke test on main went green; if it's red, fix it first.
6. Stop starting risky changes after 2026-11-28 20:00 UTC; have everything tested and landed by 22:00 UTC, with the
   notes file listing what's left. Then report.

## Tests + CI (CI machines are shared with the other account and are the bottleneck)
- Local: `NODE_PATH=/opt/node-tools/node_modules`; ONE browser at a time on this machine:
  `flock /tmp/lulu3d-browser.lock <cmd>` (never delete a lock another process holds); run long jobs detached
  (`nohup setsid … > log 2>&1 &`) and poll the log. Local software WebGL is slow: use it for your own test file.
- CI: push your branch, then dispatch "3D full suite" (`smoke3d-full.yml`) with `groups` (`;`-separated machines,
  `,`-packed files): ask ONLY for the test files your change can affect + `core,platform`; one dispatch per branch at a
  time (a new one cancels the old); `calm` takes 60–85 min — only when you touched pop-ups / toasts / bubbles. Use the
  GitHub MCP actions tools (load with ToolSearch) or `gh api` to dispatch and read results.
- A red test: re-run once, and check whether it is also red on main, before deciding it's yours.

## Hard rules
- Cartoon only, 12+. No bottomless coin loops: every reward capped. No new pop-ups (the owner wants fewer).
- NEVER touch `server/` or the relay deploy workflow, iOS bundle id / signing / AdMob ids / `submit_to_app_store`.
- No secrets in commits; no PRs; no model names in code or docs. End commit messages with the attribution lines your
  own session instructions give you (Co-Authored-By + Claude-Session); if you were given none, use:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01U7J5Hg32EbkGg1GBdKEbcu
- If a permission check blocks something, don't work around it: note it and move on.

## Report (when done or at the deadline)
What you found and fixed (plain English, most important first), what's left and why, commits on main, CI run IDs,
screenshot paths.
