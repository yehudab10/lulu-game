// The iPhone app's STABLE update channel — run by .github/workflows/app-updates.yml (not by hand).
//
// Publishes `stable.json` on the bot-only branch `ota` (an orphan branch: one commit, force-pushed — it never
// touches `main`, never triggers Codemagic or the Smoke test, and never collides with agents' pushes). The
// app reads it from https://raw.githubusercontent.com/<repo>/ota/stable.json (3d/js/features/native/ota.js)
// and downloads each file PINNED to the published commit (raw.githubusercontent.com/<repo>/<commit>/<path>),
// so the app gets exactly the green commit even after main has moved on. Every file's SHA-256 is in the
// manifest and the app's updater checks each one.
//
//   OTA_ACTION=promote   OTA_COMMIT=<sha>   a commit whose Smoke test just went green: published if it is newer
//                                           than what's on stable, still on main, and stable isn't held
//   OTA_ACTION=promote-latest OTA_COMMIT=<sha>  the newest green commit on main (manual "promote now"; clears a hold)
//   OTA_ACTION=pin       OTA_COMMIT=<sha>   put this exact commit on stable and HOLD (no automatic promotions)
//   OTA_ACTION=pause                         phones keep what they have, download nothing new
//   OTA_ACTION=revert                        phones go back to the copy bundled in the app at their next launch
//   OTA_ACTION=resume                        clear pause / revert / hold
// Env: GITHUB_REPOSITORY (owner/repo); OTA_DRY=<file> writes the manifest there instead of pushing. Writes a one-line summary to $GITHUB_STEP_SUMMARY when set.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const REPO = process.env.GITHUB_REPOSITORY || "yehudab10/lulu-game";
const ACTION = process.env.OTA_ACTION || "promote";
const COMMIT = (process.env.OTA_COMMIT || "").trim();
const BRANCH = "ota";

const git = (args, opts = {}) => execFileSync("git", args, Object.assign({ cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }, opts)).trim();
const tryGit = (args, opts) => { try { return git(args, opts); } catch (e) { return null; } };
const isAncestor = (a, b) => { try { git(["merge-base", "--is-ancestor", a, b]); return true; } catch (e) { return false; } };
function summary(line) {
    console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
}
function done(line) { summary(line); process.exit(0); }

// ── what's on stable now ─────────────────────────────────────────────────────────────────────────────────────
tryGit(["fetch", "--quiet", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
tryGit(["fetch", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
let current = null;
const raw = tryGit(["show", `origin/${BRANCH}:stable.json`]);
if (raw) { try { current = JSON.parse(raw); } catch (e) { current = null; } }

function resolveCommit(c) {
    const full = c && tryGit(["rev-parse", "--verify", c + "^{commit}"]);
    if (!full) { console.error(`✗ unknown commit "${c}"`); process.exit(1); }
    return full;
}

// ── build the manifest for a commit: check it out, stage www/ with ITS copy-web.js, read the file list ──────
function manifestFor(sha, hold, by) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ota-"));
    git(["worktree", "add", "--detach", dir, sha]);
    try {
        if (!fs.existsSync(path.join(dir, "scripts", "copy-web.js"))) throw new Error("no scripts/copy-web.js at " + sha);
        execFileSync(process.execPath, [path.join(dir, "scripts", "copy-web.js")], { cwd: dir, stdio: "inherit" });
        const listFile = path.join(dir, "www", "ota-build.json");
        if (!fs.existsSync(listFile)) throw new Error(`${sha.slice(0, 7)} is older than the update channel (its copy-web.js writes no www/ota-build.json)`);
        const list = JSON.parse(fs.readFileSync(listFile, "utf8"));
        if (list.startPath && !list.files[list.startPath.replace(/^\//, "")]) throw new Error(`the iOS start page ${list.startPath} is missing from www/`);
        // the files must be byte-identical to the repo at that commit: that's what the pinned URLs serve
        for (const f of Object.keys(list.files)) {
            const blob = execFileSync("git", ["show", `${sha}:${f}`], { cwd: ROOT, maxBuffer: 1 << 30 });
            const h = crypto.createHash("sha256").update(blob).digest("hex");
            if (h !== list.files[f][0]) throw new Error(`www/${f} differs from ${f} in the repo at ${sha.slice(0, 7)} — the pinned download would not match`);
        }
        const when = git(["show", "-s", "--format=%cI", sha]);
        const d = new Date(when);
        const stamp = d.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", ".");
        const history = ((current && current.history) || []).slice(-19);
        const m = {
            schema: 1,
            channel: "stable",
            version: `${stamp}-${sha.slice(0, 7)}`,
            commit: sha,
            committed: when,
            published: new Date().toISOString(),
            appVersion: list.appVersion,
            minNative: list.minNative,
            startPath: list.startPath || "",
            paused: false,
            revert: false,
            hold: !!hold,
            base: `https://raw.githubusercontent.com/${REPO}/${sha}/`,
            bytes: list.bytes,
            files: list.files,
        };
        history.push({ version: m.version, commit: sha, at: m.published, by });
        m.history = history;
        return m;
    } finally {
        tryGit(["worktree", "remove", "--force", dir]);
    }
}

// ── publish: one orphan commit on `ota`, force-pushed ────────────────────────────────────────────────────────
function publish(m, line) {
    if (process.env.OTA_DRY) { fs.writeFileSync(process.env.OTA_DRY, JSON.stringify(m)); done("(dry run) " + line); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ota-pub-"));
    fs.writeFileSync(path.join(dir, "stable.json"), JSON.stringify(m));
    fs.writeFileSync(path.join(dir, "README.md"),
        "# The iPhone app's update channel (bot-only branch)\n\n" +
        "Written by `.github/workflows/app-updates.yml` — do not edit or merge this branch.\n" +
        "`stable.json` = what the app downloads (see IOS_BUILD.md › Updates from the server on `main`).\n\n" +
        `Now: **${m.version}** · paused: ${m.paused} · revert: ${m.revert} · hold: ${m.hold}\n`);
    const env = Object.assign({}, process.env, { GIT_DIR: path.join(ROOT, ".git"), GIT_WORK_TREE: dir, GIT_INDEX_FILE: path.join(dir, ".index") });
    const g = args => execFileSync("git", args, { cwd: dir, env, encoding: "utf8" }).trim();
    g(["add", "stable.json", "README.md"]);
    const tree = g(["write-tree"]);
    const commit = execFileSync("git", ["-c", "user.name=lulu-app-updates", "-c", "user.email=actions@users.noreply.github.com", "commit-tree", tree, "-m", line], { cwd: dir, env, encoding: "utf8" }).trim();
    execFileSync("git", ["push", "--force", "origin", `${commit}:refs/heads/${BRANCH}`], { cwd: ROOT, stdio: "inherit" });
    done("✓ " + line);
}

const label = m => `${m.version}${m.paused ? " (PAUSED)" : ""}${m.revert ? " (REVERT)" : ""}${m.hold ? " (HELD)" : ""}`;

if (ACTION === "pause" || ACTION === "revert" || ACTION === "resume") {
    if (!current) done("nothing on stable yet — nothing to " + ACTION);
    const m = Object.assign({}, current);
    if (ACTION === "pause") m.paused = true;
    if (ACTION === "revert") { m.revert = true; m.paused = false; }
    if (ACTION === "resume") { m.paused = false; m.revert = false; m.hold = false; }
    m.published = new Date().toISOString();
    publish(m, `stable: ${ACTION} → ${label(m)}`);
} else if (ACTION === "pin") {
    const sha = resolveCommit(COMMIT);
    const m = manifestFor(sha, true, "pin");
    publish(m, `stable: PINNED to ${label(m)} (automatic promotions held until "resume")`);
} else if (ACTION === "promote" || ACTION === "promote-latest") {
    const sha = resolveCommit(COMMIT);
    if (!isAncestor(sha, "origin/main")) done(`skip ${sha.slice(0, 7)}: not on main`);
    if (current && ACTION === "promote") {
        if (current.hold) done(`skip ${sha.slice(0, 7)}: stable is held at ${current.version} (run "resume" or "promote-latest")`);
        if (current.paused || current.revert) done(`skip ${sha.slice(0, 7)}: stable is ${current.paused ? "paused" : "reverted"} (run "resume")`);
    }
    if (current && current.commit === sha && !current.hold && !current.paused && !current.revert) done(`skip: ${sha.slice(0, 7)} is already on stable`);
    if (current && ACTION === "promote" && !isAncestor(current.commit, sha)) done(`skip ${sha.slice(0, 7)}: older than stable (${current.version})`);
    const m = manifestFor(sha, false, ACTION);
    publish(m, `stable → ${label(m)} (${(m.bytes / 1048576).toFixed(1)} MB, ${Object.keys(m.files).length} files, needs app ${m.minNative})`);
} else {
    console.error("unknown OTA_ACTION " + ACTION);
    process.exit(1);
}
