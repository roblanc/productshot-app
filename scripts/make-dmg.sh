#!/usr/bin/env bash
# Turns the app electron-builder made into dist/ProductShot.dmg. macOS only:
# codesign and hdiutil are Apple's tools.
#
#   npm run build:app && bash scripts/make-dmg.sh
#
# The app is signed ad hoc, not with a Developer ID. That is the minimum an
# Apple Silicon Mac will run at all: without it the merged universal binary
# carries a broken signature and macOS calls the app "damaged" with no way
# past it. Ad hoc, a downloaded copy still shows "Apple could not verify…",
# and System Settings → Privacy & Security → Open Anyway lets it through once.
# README.md says what changes when there is a Developer ID.
set -euo pipefail
cd "$(dirname "$0")/.."

APP="$(ls -d dist/mac*/"Product Shot.app" 2>/dev/null | head -1)"
if [ -z "$APP" ]; then
  echo "No Product Shot.app under dist/. Run: npm run build:app" >&2
  exit 1
fi
BIN="$APP/Contents/MacOS/Product Shot"

codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# Both chips, or half the Macs out there cannot open it.
ARCHS="$(lipo -archs "$BIN")"
echo "architectures: $ARCHS"
case "$ARCHS" in
  *x86_64*arm64* | *arm64*x86_64*) ;;
  *) echo "Expected a universal binary, got: $ARCHS" >&2; exit 1 ;;
esac

# Start the signed app, reach the site, render the editor, encode H.264.
"$BIN" --smoke-test

STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f dist/ProductShot.dmg
hdiutil create -volname "Product Shot" -srcfolder "$STAGE" -ov -format UDZO dist/ProductShot.dmg
hdiutil verify dist/ProductShot.dmg
ls -lh dist/ProductShot.dmg
