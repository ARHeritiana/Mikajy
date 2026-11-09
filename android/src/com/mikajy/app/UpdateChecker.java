package com.mikajy.app;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import javax.net.ssl.HttpsURLConnection;

/**
 * The only network code in Mikajy Spark. It asks GitHub for the newest published release and returns
 * a small JSON string for the page to interpret: {"ok":true,"tag":"v5.1","url":"...","apk":"..."}
 * or {"ok":false,"reason":"offline"|"error"}. Nothing about the user or the device is sent, and
 * the WebView itself never touches the network. Every returned URL stays inside this project's
 * GitHub releases.
 */
final class UpdateChecker {
  static final String RELEASES = "https://github.com/ARHeritiana/Mikajy-Spark/releases/";
  private static final String LATEST = "https://api.github.com/repos/ARHeritiana/Mikajy-Spark/releases/latest";
  private static final int TIMEOUT_MS = 8000;
  private static final int MAX_BYTES = 512 * 1024;
  private static final Pattern TAG = Pattern.compile("^v[0-9]{1,4}(\\.[0-9]{1,4}){1,2}$");

  private UpdateChecker() {}

  /** Only https links into this project's releases may be opened or returned. */
  static boolean isReleaseUrl(String url) {
    return url != null && url.length() < 512 && url.startsWith(RELEASES) && url.indexOf('\\') < 0 && !url.contains("..");
  }

  /** Blocking; call from a background thread. Never throws. */
  static String check() {
    HttpsURLConnection http = null;
    try {
      URL url = new URL(LATEST);
      HttpURLConnection raw = (HttpURLConnection) url.openConnection();
      if (!(raw instanceof HttpsURLConnection)) return failure("error");
      http = (HttpsURLConnection) raw;
      http.setConnectTimeout(TIMEOUT_MS);
      http.setReadTimeout(TIMEOUT_MS);
      http.setInstanceFollowRedirects(false);
      http.setRequestProperty("Accept", "application/vnd.github+json");
      http.setRequestProperty("User-Agent", "Mikajy-update-check");
      if (http.getResponseCode() != HttpURLConnection.HTTP_OK) return failure("error");
      return parse(read(http.getInputStream()));
    } catch (IOException e) {
      return failure("offline");
    } catch (RuntimeException e) {
      return failure("error");
    } finally {
      if (http != null) http.disconnect();
    }
  }

  private static String read(InputStream in) throws IOException {
    try (InputStream stream = in) {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      byte[] buffer = new byte[8192];
      int n;
      while ((n = stream.read(buffer)) > 0) {
        out.write(buffer, 0, n);
        if (out.size() > MAX_BYTES) throw new IOException("response too large");
      }
      return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
  }

  /** Visible for tests: turns GitHub's release JSON into the small answer handed to the page. */
  static String parse(String body) {
    try {
      JSONObject release = new JSONObject(body);
      String tag = release.optString("tag_name", "");
      if (!TAG.matcher(tag).matches() || release.optBoolean("draft") || release.optBoolean("prerelease")) {
        return failure("error");
      }
      String page = release.optString("html_url", "");
      if (!isReleaseUrl(page)) page = RELEASES + "latest";
      String apk = "";
      JSONArray assets = release.optJSONArray("assets");
      for (int i = 0; assets != null && i < assets.length(); i++) {
        JSONObject asset = assets.optJSONObject(i);
        if (asset == null) continue;
        String link = asset.optString("browser_download_url", "");
        if (asset.optString("name", "").endsWith(".apk") && isReleaseUrl(link)) { apk = link; break; }
      }
      return new JSONObject().put("ok", true).put("tag", tag).put("url", page).put("apk", apk).toString();
    } catch (JSONException e) {
      return failure("error");
    }
  }

  private static String failure(String reason) {
    try {
      return new JSONObject().put("ok", false).put("reason", reason).toString();
    } catch (JSONException e) {
      return "{\"ok\":false,\"reason\":\"error\"}";
    }
  }
}
