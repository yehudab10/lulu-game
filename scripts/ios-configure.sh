#!/usr/bin/env bash
# Finishes the generated iOS project for an App Store build — run by codemagic.yaml AFTER `npx cap sync ios` and
# the icon step (ios/ is regenerated every build, so all of this is re-applied every time). macOS only (PlistBuddy,
# Xcode's ruby). The AdMob app id, the ATT text, orientation, the status bar and the audio session stay in their
# own codemagic.yaml steps — this script never touches them.
#
#   1. the app version (CFBundleShortVersionString) = package.json "version" (2.0.0 …) — the over-the-air updater
#      compares it with each update's "minNative", so it MUST be right (IOS_BUILD.md › Updates from the server)
#   2. Info.plist: the home-screen name, ITSAppUsesNonExemptEncryption = NO (export compliance, see IOS_BUILD.md),
#      SKAdNetworkItems (Google's list, ios-config/skadnetwork.txt)
#   3. the app's privacy manifest (ios-config/PrivacyInfo.xcprivacy) copied in AND added to the App target
#   4. checks: every plugin from package.json made it into the Xcode project; the app icon is there
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo; echo "✗ ios-configure: $*" >&2; exit 1; }
PLIST="ios/App/App/Info.plist"
PBX="ios/App/App.xcodeproj/project.pbxproj"
[ -f "$PLIST" ] || fail "no $PLIST — did 'npx cap add ios' / 'npx cap sync ios' run first?"
[ -f "$PBX" ]   || fail "no $PBX — the iOS project wasn't generated."
PB=/usr/libexec/PlistBuddy
setp() { "$PB" -c "Set :$1 $3" "$PLIST" 2>/dev/null || "$PB" -c "Add :$1 $2 $3" "$PLIST"; }

# 1. version
VERSION=$(node -p "require('./package.json').version")
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || fail "package.json version '$VERSION' is not like 2.0.0"
perl -pi -e "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $VERSION;/g" "$PBX"
setp CFBundleShortVersionString string "$VERSION"
echo "✓ app version $VERSION"

# 2. Info.plist
NAME=$("$PB" -c "Print :CFBundleDisplayName" "$PLIST" 2>/dev/null || echo "")
if [ -z "$NAME" ] || [ "$NAME" = "My App" ]; then setp CFBundleDisplayName string "Lulu's Road Trip"; fi
setp ITSAppUsesNonExemptEncryption bool false
"$PB" -c "Delete :SKAdNetworkItems" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :SKAdNetworkItems array" "$PLIST"
i=0
while read -r id; do
  [ -z "$id" ] && continue
  "$PB" -c "Add :SKAdNetworkItems:$i dict" "$PLIST"
  "$PB" -c "Add :SKAdNetworkItems:$i:SKAdNetworkIdentifier string $id" "$PLIST"
  i=$((i + 1))
done < ios-config/skadnetwork.txt
[ "$i" -gt 0 ] || fail "ios-config/skadnetwork.txt is empty"
"$PB" -c "Print :GADApplicationIdentifier" "$PLIST" >/dev/null 2>&1 || fail "GADApplicationIdentifier missing — the 'Inject AdMob App ID' step must run before this one."
"$PB" -c "Print :NSUserTrackingUsageDescription" "$PLIST" >/dev/null 2>&1 || fail "NSUserTrackingUsageDescription (the ATT prompt text) missing."
plutil -lint "$PLIST" >/dev/null || fail "Info.plist is not valid after editing"
echo "✓ Info.plist: encryption = exempt (NO), $i SKAdNetwork ids, AdMob id + ATT text present"

# 3. privacy manifest → ios/App/App/ + the App target's resources
cp ios-config/PrivacyInfo.xcprivacy ios/App/App/PrivacyInfo.xcprivacy
plutil -lint ios/App/App/PrivacyInfo.xcprivacy >/dev/null || fail "PrivacyInfo.xcprivacy is not a valid plist"
if ! grep -q "PrivacyInfo.xcprivacy" "$PBX"; then
  ruby -e '
    begin
      require "xcodeproj"
    rescue LoadError
      Gem.install("xcodeproj") rescue nil
      require "xcodeproj"
    end
    project = Xcodeproj::Project.open("ios/App/App.xcodeproj")
    target = project.targets.find { |t| t.name == "App" } or abort("no App target")
    group = project.main_group.find_subpath("App", false) or abort("no App group")
    ref = group.new_reference("PrivacyInfo.xcprivacy")
    target.resources_build_phase.add_file_reference(ref, true)
    project.save
  ' || fail "could not add PrivacyInfo.xcprivacy to the Xcode project (ruby gem 'xcodeproj' missing?)"
fi
grep -q "PrivacyInfo.xcprivacy in Resources" "$PBX" || fail "PrivacyInfo.xcprivacy is not in the App target's resources"
echo "✓ privacy manifest in the App target"

# 4. checks: plugins + icon
SPM="ios/App/CapApp-SPM/Package.swift"
if [ -f "$SPM" ]; then
  for p in CapacitorCommunityAdmob CapacitorApp CapacitorHaptics CapacitorNetwork CapgoCapacitorUpdater; do
    grep -q "$p" "$SPM" || fail "plugin $p is not in $SPM — 'npx cap sync ios' didn't pick it up (is it in package.json and was 'npm ci' run?)"
  done
  echo "✓ plugins: AdMob, App, Haptics, Network, the updater (Swift Package Manager)"
else
  echo "! $SPM not found — not a Swift Package Manager project? (skipping the plugin check)"
fi
ICON=$(ls ios/App/App/Assets.xcassets/AppIcon.appiconset/*.png 2>/dev/null | head -1 || true)
[ -n "$ICON" ] || fail "no app icon in AppIcon.appiconset — did the icon step run?"
if sips -g hasAlpha "$ICON" 2>/dev/null | grep -q "hasAlpha: yes"; then fail "the app icon $ICON has transparency — App Store icons must not (assets/icon.png must be a flat 1024×1024 PNG)"; fi
echo "✓ app icon ($(basename "$ICON"), no transparency)"
echo "✓ ios-configure done"
