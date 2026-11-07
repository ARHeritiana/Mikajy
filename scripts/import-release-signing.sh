#!/usr/bin/env bash
# Import an existing Android signing key into GitHub Actions encrypted environment
# secrets. Run in your own Codespace, not in a CI runner.
set +x
set -euo pipefail
umask 077

REPO='ARHeritiana/Mikajy'
ENVIRONMENT='release'
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="${1:-$ROOT/mikajy-release.jks}"
PASSFILE="${2:-$ROOT/PASSWORD.txt}"
BACKUP="$ROOT/release-key-backup"
ALIAS='mikajy'
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

for cmd in gh keytool python3 base64 sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Missing required tool $cmd"
done
[[ -f "$KEY" && -r "$KEY" ]] || fail "Signing key file not found: $KEY"
[[ -f "$PASSFILE" && -r "$PASSFILE" ]] || fail "Password file not found: $PASSFILE"
for private_file in "$KEY" "$PASSFILE"; do
  if git -C "$ROOT" ls-files --error-unmatch "$private_file" >/dev/null 2>&1; then
    fail "Private file is tracked by Git: $private_file. Remove it from Git first."
  fi
done

# Codespaces' injected token cannot administer secrets. Remove it only from
# this script process and permit interactive personal GitHub authorization.
unset GH_TOKEN GITHUB_TOKEN
authorize() {
  echo "GitHub needs one-time authorization to store encrypted signing secrets."
  echo "Follow GitHub CLI instructions; on mobile open https://github.com/login/device."
  if gh auth status >/dev/null 2>&1; then
    gh auth refresh --scopes repo,workflow ||
      gh auth login --web --scopes repo,workflow ||
      fail "GitHub authorization failed."
  else
    gh auth login --web --scopes repo,workflow ||
      fail "GitHub authorization failed."
  fi
}
if ! gh api "repos/$REPO/environments/$ENVIRONMENT" --silent >/dev/null 2>&1 ||
   ! gh secret list -e "$ENVIRONMENT" -R "$REPO" >/dev/null 2>&1; then
  authorize
fi
# Only CREATE an environment if none exists; never overwrite its protection rules.
if ! gh api "repos/$REPO/environments/$ENVIRONMENT" --silent >/dev/null 2>&1; then
  gh api -X PUT "repos/$REPO/environments/$ENVIRONMENT" --silent >/dev/null ||
    fail "Cannot create the release environment. No credentials uploaded."
fi
gh secret list -e "$ENVIRONMENT" -R "$REPO" >/dev/null ||
  fail "Cannot manage release secrets. No credentials uploaded."

# Interpret common formats LOCALLY, without printing their contents.
export SIGNING_PASSWORD="$(python3 - "$PASSFILE" <<'PY'
import pathlib, re, sys
lines = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig").splitlines()
labels = r"(?:store\s*/\s*key\s*password|store\s*password|key\s*password|keystore\s*password|password|storepass|keypass)"
for line in lines:
    match = re.fullmatch(r"\s*" + labels + r"\s*[:=]\s*(\S+)\s*", line, flags=re.I)
    if match:
        print(match.group(1), end="")
        break
else:
    nonempty = [line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")]
    if len(nonempty) == 1 and not (":" in nonempty[0] or "=" in nonempty[0]):
        print(nonempty[0], end="")
    else:
        raise SystemExit("Unrecognized password-file format; nothing uploaded.")
PY
)"
[[ -n "$SIGNING_PASSWORD" ]] || fail "Password file has no usable password."

# Validate keystore locally before setting any secrets.
fingerprint="$(keytool -exportcert -alias "$ALIAS" -keystore "$KEY" \
  -storepass:env SIGNING_PASSWORD | sha256sum | awk '{print toupper($1)}')"
[[ "$fingerprint" =~ ^[0-9A-F]{64}$ ]] || fail "Invalid key, alias or password."
previous="$(gh variable get MIKAJY_CERT_SHA256 -e "$ENVIRONMENT" -R "$REPO" 2>/dev/null || true)"
if [[ -n "$previous" && "$previous" != "$fingerprint" ]]; then
  echo "WARNING: GitHub holds a different release certificate."
  read -r -p "Type REPLACE KEY to proceed: " answer
  [[ "$answer" == "REPLACE KEY" ]] || fail "Cancelled. GitHub unchanged."
fi

# GitHub CLI encrypts the values; nothing enters a commit or CI log.
base64 -w 0 "$KEY" | gh secret set MIKAJY_KEYSTORE_B64 -e "$ENVIRONMENT" -R "$REPO"
printf '%s' "$ALIAS" | gh secret set MIKAJY_ALIAS -e "$ENVIRONMENT" -R "$REPO"
printf '%s' "$SIGNING_PASSWORD" | gh secret set MIKAJY_STOREPASS -e "$ENVIRONMENT" -R "$REPO"
printf '%s' "$SIGNING_PASSWORD" | gh secret set MIKAJY_KEYPASS -e "$ENVIRONMENT" -R "$REPO"
unset SIGNING_PASSWORD
gh variable set MIKAJY_CERT_SHA256 --body "$fingerprint" -e "$ENVIRONMENT" -R "$REPO"

for name in MIKAJY_KEYSTORE_B64 MIKAJY_ALIAS MIKAJY_STOREPASS MIKAJY_KEYPASS; do
  gh secret list -e "$ENVIRONMENT" -R "$REPO" | awk '{print $1}' | grep -qx "$name" ||
    fail "Cannot confirm secret $name. Retry with the same local files."
done
[[ "$(gh variable get MIKAJY_CERT_SHA256 -e "$ENVIRONMENT" -R "$REPO")" == "$fingerprint" ]] ||
  fail "Cannot confirm public fingerprint."

mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
if [[ "$KEY" != "$BACKUP/mikajy-release.jks" ]]; then cp "$KEY" "$BACKUP/mikajy-release.jks"; fi
if [[ "$PASSFILE" != "$BACKUP/PASSWORD.txt" ]]; then cp "$PASSFILE" "$BACKUP/PASSWORD.txt"; fi
chmod 600 "$BACKUP/mikajy-release.jks" "$BACKUP/PASSWORD.txt"
echo "SUCCESS: Future Mikajy releases will reuse this GitHub-stored signing key."
echo "Keep the two backup files private and download them before deleting Codespaces."
echo "Public certificate SHA-256: $fingerprint"
