#!/usr/bin/env bash
# The phases of verify-ota-iphone.yml (needs SIM_ID, RUNNER_TEMP, the built ocr + dump.py).
# built-in copy (old app) → copy B ("OTA COPY B", today's code) → copy C (deliberately broken) → rolled back to B.
set -uo pipefail
SH="$RUNNER_TEMP/shots"; mkdir -p "$SH"
APP=boats.lulu.game
B=$(python3 -c 'import json;print(json.load(open("ota-test/stable.json"))["version"])')
C=$(python3 -c 'import json;print(json.load(open("ota-test/broken.json"))["version"])')
echo "copy B = $B · copy C = $C"
ocr() { xcrun simctl io "$SIM_ID" screenshot "$SH/$1.png" >/dev/null 2>&1; "$RUNNER_TEMP/ocr" "$SH/$1.png" 2>/dev/null; }
dumpstate() { local d; d=$(xcrun simctl get_app_container "$SIM_ID" "$APP" data); python3 "$RUNNER_TEMP/dump.py" "$d"; }
state() { echo "──── updater state after $1"; dumpstate | tee "$SH/$1-state.txt"; }
nlog() { echo "──── native log ($1)"; xcrun simctl spawn "$SIM_ID" log show --last "$2" --style compact --predicate 'process == "App"' 2>/dev/null \
  | grep -iE "capgo|CapacitorUpdater|notifyAppReady|roll ?back|bundle|checksum|manifest" \
  | grep -viE "^Filtering|IOSurface|CoreAnalytics|RunningBoard|coremedia|AVPlayer" | cut -c1-260 | tail -n 80 | tee "$SH/$1-native.txt"; }
# wait until the screen text matches a regex (phase, regex, max tries of 5 s)
see() { for i in $(seq 1 "$3"); do sleep 5; local t; t=$(ocr "$1-$(printf %02d "$i")"); echo "  [$1 +$((i*5))s] ${t:0:220}"
    if grep -qiE "$2" <<<"$t"; then echo "  ✓ $1: saw /$2/ after ~$((i*5)) s"; return 0; fi; done; echo "  ✗ $1: never saw /$2/"; return 1; }
title='PLAY.*(Friends|More|Settings)|(Friends|More|Settings).*PLAY'
# wait until the updater's notes contain a line (label, regex, max tries of 15 s)
notes() { for i in $(seq 1 "$3"); do sleep 15; local s; s=$(dumpstate); local last; last=$(grep -E "^    20" <<<"$s" | tail -1)
    echo "  [$1 notes +$((i*15))s] ${last:-no notes yet}"; if grep -qE "$2" <<<"$s"; then echo "  ✓ $1: notes say /$2/"; return 0; fi; done; echo "  ✗ $1: notes never said /$2/"; return 1; }
launch() { xcrun simctl launch "$SIM_ID" "$APP" >/dev/null; }
stop() { xcrun simctl terminate "$SIM_ID" "$APP" >/dev/null 2>&1; sleep 3; }

applesimutils --byId "$SIM_ID" --bundle "$APP" --setPermissions "userTracking=NO" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$SIM_ID" -b >/dev/null 2>&1 || true

echo "════ P0: the old app's first launch (built-in copy) → downloads copy B in the background"
launch; see P0 "$title" 18; notes P0 "ready for next launch: $B" 16; state P0; stop

echo "════ P1: relaunch → switches to copy B (expect OTA COPY B on the title) → downloads broken copy C"
launch; see P1 "OTA COPY B" 18; see P1t "$title" 6; notes P1 "ready for next launch: $C" 16; state P1; nlog P1 5m; stop

echo "════ P2: relaunch → switches to broken copy C → expect the 'didn't start' panel, then the plugin rolls back to B"
launch; see P2 "didn.t start|keeps restarting" 12; see P2b "OTA COPY B" 18; sleep 10; state P2; nlog P2 4m; stop

echo "════ P3: relaunch → still copy B, C never tried again"
launch; see P3 "OTA COPY B" 18; sleep 25; state P3; stop
echo "════ verdict"
grep -h "^    20" "$SH/P3-state.txt" | tail -n 12
grep -q "rolled back: $C" "$SH/P3-state.txt" && grep -q "\"$C\"" "$SH/P3-state.txt" && echo "✓ C was rolled back and is marked bad" || echo "✗ no rollback note for C"
