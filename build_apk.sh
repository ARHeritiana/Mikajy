#!/usr/bin/env bash
# Build + sign Mikajy.apk without Gradle.
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
# demo keystore (CN=InkCalc, password 'inkcalc'). Create your own for real releases:
#   keytool -genkeypair -keystore my.jks -alias ink -keyalg RSA -keysize 2048 -validity 10000
apksigner sign --ks ink.jks --ks-pass pass:inkcalc --key-pass pass:inkcalc --out ../Mikajy.apk out/aligned.apk
rm -f ../Mikajy.apk.idsig
apksigner verify ../Mikajy.apk && echo "built $(cd .. && pwd)/Mikajy.apk"
