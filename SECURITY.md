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
- The single network request is the optional update check made natively (`UpdateChecker.java`): one HTTPS GET to
  `api.github.com`, size-limited, no redirects, no identifiers sent. Returned links are accepted only inside
  this project's GitHub releases, in Java and again in JavaScript.
- The JavaScript bridge exposes a handful of methods that each validate their input.
- Everything read back from `localStorage` is treated as untrusted and rebuilt field by field.
- Releases are signed in GitHub Actions with a persistent key held only as encrypted environment secrets; the
  workflow pins the certificate fingerprint. No signing material is stored in the repository.
