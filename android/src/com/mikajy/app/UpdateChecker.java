package com.mikajy.app;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.regex.Pattern;

import javax.net.ssl.HttpsURLConnection;

/**
 * The only network code in Mikajy Spark (plain Java, tested on the desktop).
 * <ul>
 * <li>{@link #check()} asks GitHub for the newest published release and returns a small JSON string for the page:
 *     {"ok":true,"tag":"v5.1","url":"...","apk":"...","sums":"..."} or {"ok":false,"reason":"offline"|"error"}.</li>
 * <li>{@link #download} fetches that release's APK and its SHA256SUMS.txt and keeps the APK only if the checksum matches.</li>
 * </ul>
 * Nothing about the user or the device is sent, and the WebView itself never touches the network. Every link handed
 * out stays inside this project's GitHub releases; downloads follow redirects only over HTTPS to GitHub's own hosts.
 */
final class UpdateChecker {
  static final String RELEASES = "https://github.com/ARHeritiana/Mikajy-Spark/releases/";
  private static final String LATEST = "https://api.github.com/repos/ARHeritiana/Mikajy-Spark/releases/latest";
  private static final int TIMEOUT_MS = 8000;
  private static final int MAX_BYTES = 512 * 1024;
  private static final Pattern TAG = Pattern.compile("^v[0-9]{1,4}(\\.[0-9]{1,4}){1,2}$");
  private static final Pattern SHA256 = Pattern.compile("^[0-9a-f]{64}$");
  /** github.com serves the release link and redirects the download to its asset storage. */
  private static final String[] DOWNLOAD_HOSTS = {"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"};
  static final long MAX_APK_BYTES = 64L * 1024 * 1024;
  private static final int MAX_SUMS_BYTES = 64 * 1024;
  private static final int MAX_REDIRECTS = 5;

  /** Download progress, in bytes (total is -1 when the server does not say). */
  interface Progress { void update(long done, long total); }

  /** A request the downloader refuses to make (wrong host, scheme, size): never reported as "offline". */
  static final class Refused extends IOException {
    private static final long serialVersionUID = 1L;
    Refused(String why) { super(why); }
  }

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
      return parse(read(http.getInputStream(), MAX_BYTES));
    } catch (IOException e) {
      return failure("offline");
    } catch (RuntimeException e) {
      return failure("error");
    } finally {
      if (http != null) http.disconnect();
    }
  }

  private static String read(InputStream in, int max) throws IOException {
    try (InputStream stream = in) {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      byte[] buffer = new byte[8192];
      int n;
      while ((n = stream.read(buffer)) > 0) {
        out.write(buffer, 0, n);
        if (out.size() > max) throw new Refused("response too large");
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
      String apk = "", sums = "";
      JSONArray assets = release.optJSONArray("assets");
      for (int i = 0; assets != null && i < assets.length(); i++) {
        JSONObject asset = assets.optJSONObject(i);
        if (asset == null) continue;
        String link = asset.optString("browser_download_url", ""), name = asset.optString("name", "");
        if (!isReleaseUrl(link)) continue;
        if (apk.isEmpty() && name.endsWith(".apk")) apk = link;
        if (sums.isEmpty() && "SHA256SUMS.txt".equals(name)) sums = link;
      }
      return new JSONObject().put("ok", true).put("tag", tag).put("url", page).put("apk", apk).put("sums", sums).toString();
    } catch (JSONException e) {
      return failure("error");
    }
  }

  /** HTTPS on the default port, to one of GitHub's download hosts, without credentials in the URL. */
  static boolean isDownloadUrl(String url) {
    if (url == null || url.length() > 2048) return false;
    try {
      URL u = new URL(url);
      if (!"https".equals(u.getProtocol()) || u.getUserInfo() != null || (u.getPort() != -1 && u.getPort() != 443)) return false;
      String host = u.getHost().toLowerCase(Locale.ROOT);
      for (String h : DOWNLOAD_HOSTS) if (h.equals(host)) return true;
      return false;
    } catch (MalformedURLException e) {
      return false;
    }
  }

  /** Last path segment of a link ("…/download/v5.1/Mikajy-Spark-5.1.apk" -> "Mikajy-Spark-5.1.apk"). */
  static String fileName(String url) {
    int q = url.indexOf('?');
    String path = q < 0 ? url : url.substring(0, q);
    return path.substring(path.lastIndexOf('/') + 1);
  }

  /** The SHA-256 listed for `name` in a sha256sum file ("<64 hex>  <name>" per line), lower case, or null. */
  static String expectedSha256(String sums, String name) {
    if (sums == null || name == null || name.isEmpty()) return null;
    for (String line : sums.split("\\r?\\n")) {
      String[] parts = line.trim().split("\\s+");
      if (parts.length != 2) continue;
      String hash = parts[0].toLowerCase(Locale.ROOT), file = parts[1].startsWith("*") ? parts[1].substring(1) : parts[1];
      if (SHA256.matcher(hash).matches() && file.equals(name)) return hash;
    }
    return null;
  }

  static String hex(byte[] bytes) {
    StringBuilder out = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
    return out.toString();
  }

  /** Content-Length, or -1 (getContentLengthLong needs Android 7; the app supports Android 5). */
  private static long contentLength(HttpURLConnection http) {
    try {
      String v = http.getHeaderField("Content-Length");
      return v == null ? -1 : Long.parseLong(v.trim());
    } catch (NumberFormatException e) {
      return -1;
    }
  }

  /** Opens `url` for reading, following at most a few redirects, each of which must stay on a download host. */
  private static HttpsURLConnection open(String url) throws IOException {
    String at = url;
    for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isDownloadUrl(at)) throw new Refused("not a download host");
      HttpURLConnection raw = (HttpURLConnection) new URL(at).openConnection();
      if (!(raw instanceof HttpsURLConnection)) { raw.disconnect(); throw new Refused("not https"); }
      HttpsURLConnection http = (HttpsURLConnection) raw;
      http.setConnectTimeout(TIMEOUT_MS);
      http.setReadTimeout(4 * TIMEOUT_MS);
      http.setInstanceFollowRedirects(false);
      http.setRequestProperty("User-Agent", "Mikajy-update-check");
      int code = http.getResponseCode();
      if (code == HttpURLConnection.HTTP_OK) return http;
      String location = http.getHeaderField("Location");
      http.disconnect();
      boolean redirect = code == 301 || code == 302 || code == 303 || code == 307 || code == 308;
      if (!redirect || location == null) throw new IOException("HTTP " + code);
      at = new URL(new URL(at), location).toString();
    }
    throw new Refused("too many redirects");
  }

  /**
   * Blocking; call from a background thread. Downloads the release APK to `dest` and keeps it only if its SHA-256 matches
   * the release's SHA256SUMS.txt. Returns "ok", or why not: "offline", "checksum" (no or wrong checksum) or "error".
   */
  static String download(String apkUrl, String sumsUrl, File dest, Progress progress) {
    if (!isReleaseUrl(apkUrl) || !isReleaseUrl(sumsUrl) || !apkUrl.endsWith(".apk")) return "error";
    HttpsURLConnection http = null;
    try {
      http = open(sumsUrl);
      String expected = expectedSha256(read(http.getInputStream(), MAX_SUMS_BYTES), fileName(apkUrl));
      http.disconnect();
      http = null;
      if (expected == null) return "checksum";

      http = open(apkUrl);
      long total = contentLength(http);
      if (total > MAX_APK_BYTES) throw new Refused("too large");
      MessageDigest sha = MessageDigest.getInstance("SHA-256");
      long done = 0;
      try (InputStream in = http.getInputStream(); OutputStream out = new FileOutputStream(dest)) {
        byte[] buffer = new byte[64 * 1024];
        int n;
        while ((n = in.read(buffer)) > 0) {
          done += n;
          if (done > MAX_APK_BYTES) throw new Refused("too large");
          sha.update(buffer, 0, n);
          out.write(buffer, 0, n);
          if (progress != null) progress.update(done, total);
        }
      }
      if (total >= 0 && done != total) throw new IOException("truncated");
      if (!expected.equals(hex(sha.digest()))) { dest.delete(); return "checksum"; }
      return "ok";
    } catch (Refused e) {
      dest.delete();
      return "error";
    } catch (IOException e) {
      dest.delete();
      return "offline";
    } catch (NoSuchAlgorithmException | RuntimeException e) {
      dest.delete();
      return "error";
    } finally {
      if (http != null) http.disconnect();
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
