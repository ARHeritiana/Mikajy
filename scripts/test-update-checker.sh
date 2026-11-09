#!/usr/bin/env bash
# Compile android/.../UpdateChecker.java with -Werror and exercise its parser/URL guard on desktop Java.
# Needs a JDK and network access to fetch org.json (pinned by SHA-256) once.
set -euo pipefail
cd "$(dirname "$0")/.."
JSON_URL='https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar'
JSON_SHA256='3cf6cd6892e32e2b4c1c39e0f52f5248a2f5b37646fdfbb79a66b46b618414ed'
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
curl -fsSL "$JSON_URL" -o "$work/json.jar"
echo "$JSON_SHA256  $work/json.jar" | sha256sum -c --quiet
mkdir -p "$work/out"
javac --release 8 -encoding UTF-8 -Xlint:all,-options -Werror -cp "$work/json.jar:${ANDROID_JAR:-$(find "${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}/platforms" -name android.jar | sort -V | tail -1)}" -d "$work/out" \
  android/src/com/mikajy/app/UpdateChecker.java android/src/com/mikajy/app/UpdateInstaller.java tests/java/com/mikajy/app/UpdateCheckerTest.java
java -cp "$work/json.jar:$work/out" com.mikajy.app.UpdateCheckerTest
