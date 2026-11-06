#!/usr/bin/env bash
# Build + sign InkCalc.apk without Gradle.
# Tools (Ubuntu/Debian):  sudo apt install openjdk-21-jdk-headless aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange python3
set -euo pipefail
cd "$(dirname "$0")"
J=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
python3 web/build_web.py
cd android
rm -rf out && mkdir -p out/classes
javac --release 8 -cp "$J" -d out/classes src/com/inkcalc/app/*.java
dalvik-exchange --dex --output=out/classes.dex out/classes
aapt package -f -M AndroidManifest.xml -S res -A assets -I "$J" --min-sdk-version 21 --target-sdk-version 34 -F out/unsigned.apk
(cd out && aapt add unsigned.apk classes.dex >/dev/null && zipalign -f 4 unsigned.apk aligned.apk)
# For releases, supply INKCALC_KEYSTORE, INKCALC_KEY_ALIAS and INKCALC_KEY_PASSWORD.
# Use a local, generated debug keystore by default. Never commit signing keys.
KEYSTORE=${INKCALC_KEYSTORE:-.debug-signing.jks}
KEY_ALIAS=${INKCALC_KEY_ALIAS:-inkcalc}
KEY_PASS=${INKCALC_KEY_PASSWORD:-inkcalc-debug-local}
if [ ! -f "$KEYSTORE" ]; then
  if [ -n "${INKCALC_KEYSTORE:-}" ]; then
    echo "Signing keystore not found: $KEYSTORE" >&2; exit 1
  fi
  keytool -genkeypair -noprompt -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 3650 -storepass "$KEY_PASS" \
    -keypass "$KEY_PASS" -dname "CN=InkCalc Debug"
fi
apksigner sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "pass:$KEY_PASS" --key-pass "pass:$KEY_PASS" \
  --out ../InkCalc.apk out/aligned.apk
rm -f ../InkCalc.apk.idsig
apksigner verify ../InkCalc.apk && echo "built $(cd .. && pwd)/InkCalc.apk"
