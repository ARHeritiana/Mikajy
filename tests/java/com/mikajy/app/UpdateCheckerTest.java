package com.mikajy.app;

import org.json.JSONObject;

/** Plain-Java checks for the update answer parser and the release-URL guard (no Android needed). */
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

    check(UpdateChecker.isReleaseUrl(R + "tag/v5.1"), "release url accepted");
    check(!UpdateChecker.isReleaseUrl(null), "null refused");
    check(!UpdateChecker.isReleaseUrl("http://github.com/ARHeritiana/Mikajy/releases/x"), "plain http refused");
    check(!UpdateChecker.isReleaseUrl("https://github.com/ARHeritiana/Mikajy-evil/releases/x"), "look-alike repo refused");
    check(!UpdateChecker.isReleaseUrl(R + "../../../evil"), "path traversal refused");
    check(!UpdateChecker.isReleaseUrl("file:///sdcard/x"), "file url refused");
    check(!UpdateChecker.isReleaseUrl("intent://x#Intent;end"), "intent url refused");

    if (failures > 0) { System.err.println(failures + " failure(s)"); System.exit(1); }
    System.out.println("UpdateChecker: all checks passed");
  }
}
