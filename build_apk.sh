#!/usr/bin/env bash
# Build + sign Mikajy.apk without Gradle.
# Tools (Ubuntu/Debian):  sudo apt install openjdk-21-jdk-headless aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange python3
set -euo pipefail
cd "$(dirname "$0")"
J=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
python3 web/build_web.py
cd android
rm -rf out && mkdir -p out/classes
javac --release 8 -cp "$J" -d out/classes src/com/mikajy/app/*.java
dalvik-exchange --dex --output=out/classes.dex out/classes
aapt package -f -M AndroidManifest.xml -S res -A assets -I "$J" --min-sdk-version 21 --target-sdk-version 34 -F out/unsigned.apk
(cd out && aapt add unsigned.apk classes.dex >/dev/null && zipalign -f 4 unsigned.apk aligned.apk)
# Signing key is intentionally excluded from source control.
# Supply it securely for builds: MIKAJY_KEYSTORE, MIKAJY_ALIAS, MIKAJY_STOREPASS, MIKAJY_KEYPASS.
: "${MIKAJY_KEYSTORE:?Set MIKAJY_KEYSTORE to the path of your Android signing keystore}"
: "${MIKAJY_ALIAS:?Set MIKAJY_ALIAS to your signing alias}"
: "${MIKAJY_STOREPASS:?Set MIKAJY_STOREPASS to the keystore password}"
: "${MIKAJY_KEYPASS:?Set MIKAJY_KEYPASS to the key password}"
apksigner sign --ks "$MIKAJY_KEYSTORE" --ks-key-alias "$MIKAJY_ALIAS" \
  --ks-pass "env:MIKAJY_STOREPASS" --key-pass "env:MIKAJY_KEYPASS" \
  --out ../Mikajy.apk out/aligned.apk
rm -f ../Mikajy.apk.idsig
apksigner verify ../Mikajy.apk && echo "built $(cd .. && pwd)/Mikajy.apk"
