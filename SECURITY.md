# Security policy

## Reporting a vulnerability
Please report privately through GitHub: **Security → Report a vulnerability** on
<https://github.com/ARHeritiana/Mikajy/security/advisories/new>. Do not open a public issue for security problems.
You will get an answer within a few days.

## Supported versions
Only the newest release receives fixes; the in-app update check delivers them.

## Design summary
- The page is the only content the WebView loads (`file:///android_asset/`); all other navigation is refused and
  the WebView's network loads are blocked. A strict Content-Security-Policy forbids `eval` and remote origins.
- Network use is native only (`UpdateChecker.java`): the optional update check, one HTTPS GET to `api.github.com`,
  size-limited, no redirects, no identifiers sent; and, when the user taps **Get Mikajy Spark x.y**, the download of
  that release's APK and `SHA256SUMS.txt`. Returned links are accepted only inside this project's GitHub releases, in
  Java and again in JavaScript; downloads follow at most 5 redirects, each HTTPS to `github.com`,
  `objects.githubusercontent.com` or `release-assets.githubusercontent.com`, and are capped at 64 MB.
- Updates (`SelfInstaller.java`, permission `REQUEST_INSTALL_PACKAGES`): the downloaded APK is kept only if its SHA-256
  matches the release's `SHA256SUMS.txt` and it is `com.mikajy.app` with a higher `versionCode`; it is then handed to
  Android's `PackageInstaller`. Android asks the user (Android 12+ may let the app update itself without asking) and
  installs it only if it is signed with the same key as the installed app. The checksum guards against corrupt or
  truncated downloads; the signing key is what guarantees authenticity. The download lives in the app cache and is
  deleted at the next start.
- The JavaScript bridge exposes a handful of methods that each validate their input.
- Everything read back from `localStorage` is treated as untrusted and rebuilt field by field.
- Releases are signed in GitHub Actions with a persistent key held only as encrypted environment secrets; the
  workflow pins the certificate fingerprint. No signing material is stored in the repository.
