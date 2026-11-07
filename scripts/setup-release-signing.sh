#!/usr/bin/env bash
# Run once in a GitHub Codespace. Never commit or share the generated credentials.
set +x
set -euo pipefail
umask 077

REPO='ARHeritiana/Mikajy'
ENV='release'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="$ROOT/release-key-backup"
KEY="$BACKUP/mikajy-release.jks"
PASSFILE="$BACKUP/signing-password.txt"
ALIAS='mikajy'

die() { echo "ERROR: $*" >&2; exit 1; }
for tool in gh keytool openssl base64 sha256sum; do
  command -v "$tool" >/dev/null 2>&1 || die "Missing $tool. Run in a GitHub Codespace with a JDK and GitHub CLI."
done
gh auth status >/dev/null 2>&1 || die "Sign in with gh auth login, then retry."

# Verify access before generating private material. Preserve existing environment rules.
if ! gh api "repos/$REPO/environments/$ENV" --silent >/dev/null 2>&1; then
  gh api -X PUT "repos/$REPO/environments/$ENV" --silent >/dev/null ||
    die "Unable to create release environment. Check GitHub authorization."
fi
gh secret list -e "$ENV" -R "$REPO" >/dev/null ||
  die "Cannot manage environment secrets. Reauthenticate with appropriate permissions."
gh variable list -e "$ENV" -R "$REPO" >/dev/null ||
  die "Cannot manage environment variables. Check GitHub authorization."

if [[ -e "$KEY" || -e "$PASSFILE" ]]; then
  [[ -f "$KEY" && -f "$PASSFILE" ]] || die "Incomplete local backup. Resolve it manually; no new key was made."
  echo "Reusing the same local signing key. No rotation."
else
  if gh secret list -e "$ENV" -R "$REPO" | awk '{print $1}' | grep -qx MIKAJY_KEYSTORE_B64; then
    echo "WARNING: A release key already exists on GitHub. It will be replaced."
    read -r -p "Type REPLACE SIGNING KEY to continue: " answer
    [[ "$answer" == 'REPLACE SIGNING KEY' ]] || die "Cancelled."
  else
    echo "This creates a NEW signing identity; APKs signed with it cannot normally update installed Mikajy 4.5."
    read -r -p "Type CREATE NEW KEY to continue: " answer
    [[ "$answer" == 'CREATE NEW KEY' ]] || die "Cancelled."
  fi
  mkdir -p "$BACKUP"
  chmod 700 "$BACKUP"
  password="$(openssl rand -hex 32)"
  printf '%s\n' "$password" > "$PASSFILE"
  chmod 600 "$PASSFILE"
  export SIGNING_PASSWORD="$password"
  keytool -genkeypair -noprompt -alias "$ALIAS" -keyalg RSA -keysize 4096 \
    -sigalg SHA256withRSA -validity 10000 -storetype PKCS12 \
    -dname 'CN=Mikajy, O=Mikajy' -keystore "$KEY" \
    -storepass:env SIGNING_PASSWORD -keypass:env SIGNING_PASSWORD
  chmod 600 "$KEY"
  unset SIGNING_PASSWORD password
fi

export SIGNING_PASSWORD="$(cat "$PASSFILE")"
[[ -n "$SIGNING_PASSWORD" ]] || die "Empty local password file."
fingerprint="$(keytool -exportcert -alias "$ALIAS" -keystore "$KEY" \
  -storepass:env SIGNING_PASSWORD | sha256sum | awk '{print toupper($1)}')"
[[ "$fingerprint" =~ ^[0-9A-F]{64}$ ]] || die "Unable to calculate certificate fingerprint."
printf '%s\n' "$fingerprint" > "$BACKUP/certificate-sha256.txt"
chmod 600 "$BACKUP/certificate-sha256.txt"

# GitHub CLI encrypts each secret before storing it in the release environment.
base64 -w 0 "$KEY" | gh secret set MIKAJY_KEYSTORE_B64 -e "$ENV" -R "$REPO"
printf %s "$ALIAS" | gh secret set MIKAJY_ALIAS -e "$ENV" -R "$REPO"
printf %s "$SIGNING_PASSWORD" | gh secret set MIKAJY_STOREPASS -e "$ENV" -R "$REPO"
printf %s "$SIGNING_PASSWORD" | gh secret set MIKAJY_KEYPASS -e "$ENV" -R "$REPO"
unset SIGNING_PASSWORD
gh variable set MIKAJY_CERT_SHA256 -e "$ENV" -R "$REPO" --body "$fingerprint"

for name in MIKAJY_KEYSTORE_B64 MIKAJY_ALIAS MIKAJY_STOREPASS MIKAJY_KEYPASS; do
  gh secret list -e "$ENV" -R "$REPO" | awk '{print $1}' | grep -qx "$name" ||
    die "Could not confirm $name. Rerun to reuse this same local key."
done
[[ "$(gh variable get MIKAJY_CERT_SHA256 -e "$ENV" -R "$REPO")" == "$fingerprint" ]] ||
  die "Could not verify the release certificate variable."

echo "SUCCESS: GitHub is configured to reuse this signing key for future releases."
echo "Public SHA-256 signing certificate fingerprint: $fingerprint"
echo "IMPORTANT: Download and securely back up BOTH files from the Codespace Explorer:"
echo "  release-key-backup/mikajy-release.jks"
echo "  release-key-backup/signing-password.txt"
echo "Keep them private. After securing the backup, delete the Codespace or its private files."
echo "Protect release tags and review environment rules: https://github.com/$REPO/settings/environments"
