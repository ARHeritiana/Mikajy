package com.mikajy.app;

import org.json.JSONObject;

/** Plain-Java checks for the update answer parser, the URL guards and the checksum parser (no Android needed). */
public final class UpdateCheckerTest {
  private static final String R = UpdateChecker.RELEASES;
  private static int failures;

  private static void check(boolean condition, String what) {
    if (!condition) { failures++; System.err.println("FAIL: " + what); }
  }

  private static String release(String tag, String htmlUrl, String apkUrl, boolean prerelease) {
    return "{\"tag_name\":\"" + tag + "\",\"html_url\":\"" + htmlUrl + "\",\"draft\":false,\"prerelease\":" + prerelease
        + ",\"assets\":[{\"name\":\"SHA256SUMS.txt\",\"browser_download_url\":\"" + R + "download/" + tag + "/SHA256SUMS.txt\"},"
        + "{\"name\":\"Mikajy.apk\",\"browser_download_url\":\"" + apkUrl + "\"}]}";
  }

  public static void main(String[] args) throws Exception {
    JSONObject ok = new JSONObject(UpdateChecker.parse(release("v5.1", R + "tag/v5.1", R + "download/v5.1/Mikajy.apk", false)));
    check(ok.getBoolean("ok") && "v5.1".equals(ok.getString("tag")), "valid release accepted");
    check((R + "download/v5.1/Mikajy.apk").equals(ok.getString("apk")), "apk link picked");
    check((R + "tag/v5.1").equals(ok.getString("url")), "page link kept");

    JSONObject foreign = new JSONObject(UpdateChecker.parse(release("v5.1", "https://evil.example/x", "https://evil.example/a.apk", false)));
    check(foreign.getBoolean("ok") && (R + "latest").equals(foreign.getString("url")) && foreign.getString("apk").isEmpty(),
        "foreign links are replaced");

    for (String bad : new String[] {"latest", "v5", "v5.x", "5.1", "v5.1.2.3", "v1.2<script>"}) {
      check(!new JSONObject(UpdateChecker.parse(release(bad, R + "x", R + "y.apk", false))).getBoolean("ok"), "tag rejected: " + bad);
    }
    check(!new JSONObject(UpdateChecker.parse(release("v5.1", R + "x", R + "y.apk", true))).getBoolean("ok"), "prerelease ignored");
    check(!new JSONObject(UpdateChecker.parse("not json")).getBoolean("ok"), "garbage rejected");
    check(!new JSONObject(UpdateChecker.parse("{}")).getBoolean("ok"), "empty object rejected");

    check((R + "download/v5.1/SHA256SUMS.txt").equals(ok.getString("sums")), "checksum file picked");

    // Downloads: only HTTPS to GitHub's download hosts (the release link redirects to its asset storage).
    check(UpdateChecker.isDownloadUrl(R + "download/v5.1/Mikajy-Spark-5.1.apk"), "release download accepted");
    check(UpdateChecker.isDownloadUrl("https://objects.githubusercontent.com/github-production-release-asset/1?x=1"), "asset host accepted");
    check(UpdateChecker.isDownloadUrl("https://release-assets.githubusercontent.com/x"), "new asset host accepted");
    for (String bad : new String[] {"http://github.com/x", "https://evil.example/x.apk", "https://github.com.evil.example/x",
        "https://user:pw@github.com/x", "https://github.com:8443/x", "ftp://github.com/x", "not a url", null}) {
      check(!UpdateChecker.isDownloadUrl(bad), "download refused: " + bad);
    }
    check("error".equals(UpdateChecker.download("https://evil.example/a.apk", R + "download/v5.1/SHA256SUMS.txt",
        new java.io.File("never-written.apk"), null)), "download of a foreign link refused before any request");
    check("error".equals(UpdateChecker.download(R + "download/v5.1/notes.txt", R + "download/v5.1/SHA256SUMS.txt",
        new java.io.File("never-written.apk"), null)), "download of a non-APK refused");

    // Checksums, as written by `sha256sum` in release.yml.
    String hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    String sums = hash.toUpperCase() + "  Mikajy-Spark-5.1.apk\r\n" + hash.replace('0', 'f') + " *Other.apk\n";
    check(hash.equals(UpdateChecker.expectedSha256(sums, "Mikajy-Spark-5.1.apk")), "checksum found (upper case, CRLF)");
    check(hash.replace('0', 'f').equals(UpdateChecker.expectedSha256(sums, "Other.apk")), "binary-mode line read");
    check(UpdateChecker.expectedSha256(sums, "Mikajy-Spark-5.2.apk") == null, "missing file has no checksum");
    check(UpdateChecker.expectedSha256("abc  Mikajy-Spark-5.1.apk", "Mikajy-Spark-5.1.apk") == null, "malformed hash refused");
    check(UpdateChecker.expectedSha256(null, "x") == null, "no checksum file");
    check("Mikajy-Spark-5.1.apk".equals(UpdateChecker.fileName(R + "download/v5.1/Mikajy-Spark-5.1.apk?x=1")), "file name");
    check("00ff".equals(UpdateChecker.hex(new byte[] {0, (byte) 255})), "hex");

    check(UpdateChecker.isReleaseUrl(R + "tag/v5.1"), "release url accepted");
    check(!UpdateChecker.isReleaseUrl(null), "null refused");
    check(!UpdateChecker.isReleaseUrl("http://github.com/ARHeritiana/Mikajy-Spark/releases/x"), "plain http refused");
    check(!UpdateChecker.isReleaseUrl("https://github.com/ARHeritiana/Mikajy-Spark-evil/releases/x"), "look-alike repo refused");
    check(!UpdateChecker.isReleaseUrl(R + "../../../evil"), "path traversal refused");
    check(!UpdateChecker.isReleaseUrl("file:///sdcard/x"), "file url refused");
    check(!UpdateChecker.isReleaseUrl("intent://x#Intent;end"), "intent url refused");

    if (failures > 0) { System.err.println(failures + " failure(s)"); System.exit(1); }
    System.out.println("UpdateChecker: all checks passed");
  }
}
