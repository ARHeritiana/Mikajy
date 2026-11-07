# Releasing Mikajy

Releases are built, tested, **signed and published by GitHub Actions** from a version tag.
The app's built-in update check (Settings → *Check for updates*, and once a day when online)
reads the newest GitHub Release, so publishing a release is what delivers an update.

## Cutting a release

1. Update `android:versionName` (e.g. `5.1`) and raise `android:versionCode` in `android/AndroidManifest.xml`,
   and `version` in `package.json`.
2. Move the `Unreleased` notes in `CHANGELOG.md` under the new version.
3. Merge to `main` once CI is green, then tag and push: `git tag v5.1 && git push origin v5.1`.
4. `release.yml` re-runs every test, builds, signs with the persistent key, checks the certificate fingerprint
   against `MIKAJY_CERT_SHA256`, and publishes `Mikajy-5.1.apk` plus `SHA256SUMS.txt`.
5. Installed apps pick the release up within a day (or immediately via *Check for updates*) and offer the
   download link. Installation is done by the user in the system installer; the app never installs silently.

An installed app can only be updated by an APK signed with the **same key** and a higher `versionCode`.

## Release signing
A signing key must **not** be committed. Keep the signing keystore safely backed up; Android requires the same signing key for updates to an installed package. If you installed an APK signed with a different key or package ID, it cannot be updated in place.

## Automated signed releases (GitHub Actions)

The tag-triggered workflow `.github/workflows/release.yml` reruns all
mathematical, browser and unsigned Android tests **before** signing. On success,
it builds and signs an APK using the *same* key on every future release,
verifies the pinned public certificate fingerprint and publishes the APK with
`SHA256SUMS.txt` on GitHub Releases.

### First-time setup: generate a new key inside GitHub Codespaces

**This intentionally replaces the old Mikajy 4.5 signing identity.** A new APK
signed with this key cannot ordinarily update an installed 4.5 APK in place.
Uninstalling the old app may erase its locally saved history and training data.

1. On [Mikajy](https://github.com/ARHeritiana/Mikajy), choose **Code →
   Codespaces → Create codespace on main**.
2. In the Codespaces terminal, run:
   ```bash
   bash scripts/setup-release-signing.sh
   ```
   The script creates the GitHub Actions `release` environment if necessary,
   generates a **new** 4096-bit RSA signing key and a random 256-bit password,
   and uploads the keystore and credentials to GitHub as *encrypted environment
   secrets*. It stores the new certificate fingerprint as the environment
   variable `MIKAJY_CERT_SHA256`, required by the release workflow.
   The script asks you to explicitly confirm creating/replacing the key.
   It is safe to rerun after an interrupted upload: **it reuses the local key**
   instead of generating another one.
3. If the GitHub CLI reports insufficient permissions, authenticate your
   personal account inside the Codespace (do not paste tokens into this repo):
   ```bash
   unset GH_TOKEN GITHUB_TOKEN
   gh auth login --web -s repo,workflow
   bash scripts/setup-release-signing.sh
   ```
   Grant access only if you recognize the GitHub authorization prompt.
4. **Before deleting your Codespace, download both private backup files**
   from the file explorer and store them securely:
   `release-key-backup/mikajy-release.jks` and
   `release-key-backup/signing-password.txt`. The backup folder is
   git-ignored, not committed, and locally permission-restricted. The password
   file is sensitive; never paste it into issues, commits or chat.
   GitHub Actions secrets cannot be read back in plaintext if lost.
5. Consider requiring approval and protecting the release tags using
   [GitHub's release environment settings](https://github.com/ARHeritiana/Mikajy/settings/environments).
   The script will not silently reset any existing environment rules.

The setup creates:
- Environment secrets: `MIKAJY_KEYSTORE_B64`, `MIKAJY_ALIAS`,
  `MIKAJY_STOREPASS`, `MIKAJY_KEYPASS`.
- Environment variable: `MIKAJY_CERT_SHA256` (a public fingerprint, not a secret).


### Import an existing keystore instead of generating one

If you already have `mikajy-release.jks` and `PASSWORD.txt`, you do **not**
need to generate another signing key. Upload both files privately into the
root of your existing **GitHub Codespace** using the Codespaces file explorer
(**Upload Files**); never upload them through GitHub's repository file editor,
a public release, or a Git commit. They are covered by `.gitignore`.

Run:

```bash
git pull --ff-only
bash scripts/import-release-signing.sh
```

The import script reads the credentials **only inside your Codespace**, validates
the keystore locally, and sends the bytes directly to encrypted GitHub Actions
`release` environment secrets. Neither the assistant nor the repository
receives the contents. If GitHub requires authorization, follow the one-time
device-login prompt. The imported key is retained for later releases, and its
public certificate fingerprint is pinned. Keep private backups and remove
temporary uploads after successful import. If secrets were already configured
with a different certificate, the script requests explicit confirmation before
replacing them.

### Publishing later versions

Increment `android:versionCode` above 15 and update
`android:versionName` (e.g. `5.1`) in
`android/AndroidManifest.xml`. After merging and testing the changes,
push the matching tag (e.g. `v5.1`). GitHub Actions then verifies, signs,
and publishes `Mikajy-5.1.apk` and its SHA-256 checksum to
[GitHub Releases](https://github.com/ARHeritiana/Mikajy/releases).

**Do not rerun the setup in a fresh Codespace to make ordinary releases.**
That could create a different identity. The encrypted secrets persist across
releases. Keep the backup safely for disaster recovery.
