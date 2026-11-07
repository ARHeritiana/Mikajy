#!/usr/bin/env bash
# Create a NEW private release keystore (do this once; back it up; never commit it).
# Usage: ./tools_make_keystore.sh path/to/mikajy-release.jks
set -euo pipefail
out="${1:?usage: $0 path/to/mikajy-release.jks}"
[[ ! -e "$out" ]] || { echo "$out already exists - refusing to overwrite a signing key" >&2; exit 1; }
pass="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
KS_PASS="$pass" keytool -genkeypair -keystore "$out" -alias mikajy -keyalg RSA -keysize 4096 \
  -validity 10000 -dname "CN=Mikajy, O=Mikajy" -storepass:env KS_PASS -keypass:env KS_PASS
cat <<MSG
Created $out
  export MIKAJY_KEYSTORE=$out MIKAJY_ALIAS=mikajy MIKAJY_STOREPASS='$pass' MIKAJY_KEYPASS='$pass'
Store the password in a password manager and back up the keystore: updates require the same key.
MSG
