# Prints the iPhone app's updater state from a simulator's app data folder: the game's own notes (localStorage
# luluOtaV1, in WebKit's LocalStorage sqlite, values UTF-16LE) + the updater plugin's settings + its bundle folders.
import glob, json, os, plistlib, sqlite3, sys
data = sys.argv[1]
found = False
for db in glob.glob(os.path.join(data, "Library", "WebKit", "**", "*"), recursive=True):
    if not (db.endswith(".sqlite3") or db.endswith(".localstorage")) or not os.path.isfile(db):
        continue
    try:
        con = sqlite3.connect("file:" + db + "?mode=ro", uri=True)
        rows = con.execute("SELECT key, value FROM ItemTable").fetchall()
    except Exception as e:
        continue
    keys = [r[0] for r in rows]
    for k, v in rows:
        if k != "luluOtaV1":
            continue
        found = True
        s = v.decode("utf-16-le") if isinstance(v, (bytes, bytearray)) else str(v)
        try:
            o = json.loads(s)
        except Exception:
            print("luluOtaV1 (raw):", s[:2000]); continue
        print("db:", os.path.relpath(db, data))
        for f in ("pending", "trying", "bad", "fails", "good", "revert", "storeNote", "builtin", "builtinAt", "haveBuild"):
            print(f"  {f}: {json.dumps(o.get(f))}")
        print("  have:", len((o.get("have") or "").split(",")) if o.get("have") else 0, "hashes")
        print("  log:")
        for line in o.get("log", []):
            print("    " + line)
    print("  (other keys in", os.path.basename(db) + ":", ", ".join(sorted(k for k in keys if k != "luluOtaV1"))[:300] + ")")
if not found:
    print("luluOtaV1: not found (yet) in WebKit LocalStorage")
prefs = glob.glob(os.path.join(data, "Library", "Preferences", "*.plist"))
for p in prefs:
    try:
        d = plistlib.load(open(p, "rb"))
    except Exception:
        continue
    for k, v in d.items():
        kl = k.lower()
        if any(w in kl for w in ("capgo", "updater", "bundle", "next", "fallback", "current", "version", "serverbasepath")) or (isinstance(v, (str, bytes)) and len(k) == 10):
            sv = v.decode("utf-8", "replace") if isinstance(v, bytes) else str(v)
            print(f"  pref {k} = {sv[:300]}")
for root, dirs, files in os.walk(data):
    rel = os.path.relpath(root, data)
    if rel.count(os.sep) > 4:
        continue
    if any(w in rel.lower() for w in ("version", "capgo", "snapshot", "nocloud")):
        print("  dir", rel, f"({len(files)} files, {len(dirs)} dirs)")
