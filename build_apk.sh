#!/usr/bin/env bash
# Build Mikajy from the offline WebView page without Gradle.
# By default signs with an externally supplied release keystore.
# MIKAJY_UNSIGNED_ONLY=1 builds an unsigned APK for reproducible CI validation.
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "${ANDROID_JAR:-}" ]]; then
  if [[ -n "$SDK" && -d "$SDK/platforms" ]]; then
    ANDROID_JAR="$(find "$SDK/platforms" -mindepth 2 -maxdepth 2 -name android.jar | sort -V | tail -1)"
  else
    ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
  fi
fi
if [[ ! -f "$ANDROID_JAR" ]]; then
  echo "Android platform android.jar not found; set ANDROID_JAR or ANDROID_SDK_ROOT" >&2
  exit 1
fi
if [[ -n "$SDK" && -d "$SDK/build-tools" ]]; then
  BUILD_TOOLS="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
  export PATH="$BUILD_TOOLS:$PATH"
fi
for cmd in javac aapt zipalign; do
  command -v "$cmd" >/dev/null || { echo "Missing Android build tool: $cmd" >&2; exit 1; }
done

python3 web/build_web.py
cd android
rm -rf out && mkdir -p out/classes out/dex
# Keep -Werror for actionable warnings; legacy Android UI APIs emit known deprecations on current toolchains.
javac --release 8 -encoding UTF-8 -Xlint:all,-options,-deprecation -Werror -cp "$ANDROID_JAR" -d out/classes src/com/mikajy/app/*.java
if command -v d8 >/dev/null; then
  mapfile -d '' classes < <(find out/classes -type f -name '*.class' -print0)
  d8 --min-api 21 --output out/dex "${classes[@]}"
  cp out/dex/classes.dex out/classes.dex
elif command -v dalvik-exchange >/dev/null; then
  dalvik-exchange --dex --output=out/classes.dex out/classes
else
  echo "Need Android d8 or dalvik-exchange to generate classes.dex" >&2
  exit 1
fi
aapt package -f -M AndroidManifest.xml -S res -A assets -I "$ANDROID_JAR" \
  --min-sdk-version 21 --target-sdk-version 34 -F out/unsigned.apk
(cd out && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f 4 out/unsigned.apk out/aligned.apk

# Structural sanity checks on the package we are about to ship.
badging="$(aapt dump badging out/aligned.apk)"
grep -q "^package: name='com.mikajy.app'" <<<"$badging" || { echo "Unexpected package id" >&2; exit 1; }
# Mikajy may request exactly two permissions: INTERNET (update check / download) and REQUEST_INSTALL_PACKAGES
# (handing a verified update to Android's installer). Anything else fails the build.
extra_permissions="$(grep "uses-permission" <<<"$badging" | grep -v -e "'android.permission.INTERNET'" -e "'android.permission.REQUEST_INSTALL_PACKAGES'" || true)"
if [[ -n "$extra_permissions" ]]; then echo "Unexpected permission(s): $extra_permissions" >&2; exit 1; fi
listing="$(unzip -l out/aligned.apk)"   # captured first: `grep -q` in a pipe would SIGPIPE unzip under pipefail
for entry in assets/index.html classes.dex AndroidManifest.xml; do
  grep -q "$entry" <<<"$listing" || { echo "$entry missing from APK" >&2; exit 1; }
done

if [[ "${MIKAJY_UNSIGNED_ONLY:-0}" == "1" ]]; then
  echo "Unsigned packaging verified: android/out/aligned.apk"
  exit 0
fi

command -v apksigner >/dev/null || { echo "Missing apksigner" >&2; exit 1; }
: "${MIKAJY_KEYSTORE:?Set MIKAJY_KEYSTORE to the private release keystore path}"
: "${MIKAJY_ALIAS:?Set MIKAJY_ALIAS to the release signing alias}"
: "${MIKAJY_STOREPASS:?Set MIKAJY_STOREPASS to the keystore password}"
: "${MIKAJY_KEYPASS:?Set MIKAJY_KEYPASS to the key password}"
apksigner sign --ks "$MIKAJY_KEYSTORE" --ks-key-alias "$MIKAJY_ALIAS" \
  --ks-pass "env:MIKAJY_STOREPASS" --key-pass "env:MIKAJY_KEYPASS" \
  --out ../Mikajy.apk out/aligned.apk
rm -f ../Mikajy.apk.idsig
apksigner verify ../Mikajy.apk
echo "Built signed Mikajy.apk"
