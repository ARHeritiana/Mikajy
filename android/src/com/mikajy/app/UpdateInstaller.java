package com.mikajy.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

import javax.net.ssl.HttpsURLConnection;

/**
 * Updates inside the app: downloads the release APK over HTTPS (GitHub and its release CDN only), checks it against the release's
 * SHA256SUMS.txt, and hands it to Android's package installer, which asks the user once and replaces the app. Nothing leaves the app.
 * Android itself refuses an APK signed with a different key or with an older version code.
 */
final class UpdateInstaller {
  /** Progress and outcome, reported to the page: "downloading" (pct), "installing", "failed" (reason). */
  interface Listener { void state(String state, int pct, String reason); }

  private static final int TIMEOUT_MS = 15000;
  private static final long MAX_APK_BYTES = 120L * 1024 * 1024;
  private static final int MAX_HOPS = 5;
  private static final String DIR = "update";

  private UpdateInstaller() {}

  /** An asset link of this project's releases that points at an APK. */
  static boolean isApkUrl(String url) {
    return UpdateChecker.isReleaseUrl(url) && url.contains("/download/") && url.endsWith(".apk");
  }

  /** GitHub serves release files from github.com and a *.githubusercontent.com CDN; nothing else is ever followed. */
  static boolean isAllowedHost(URL url) {
    String host = url.getHost().toLowerCase(Locale.ROOT);
    return "https".equals(url.getProtocol()) && url.getPort() == -1 && (host.equals("github.com") || host.endsWith(".githubusercontent.com"));
  }

  static String sumsUrl(String apkUrl) { return apkUrl.substring(0, apkUrl.lastIndexOf('/') + 1) + "SHA256SUMS.txt"; }

  static String fileName(String apkUrl) { return apkUrl.substring(apkUrl.lastIndexOf('/') + 1); }

  /** Finds the digest of `name` in the text of a SHA256SUMS file ("<64 hex>  name"), lower case, or null. */
  static String digestFor(String sums, String name) {
    for (String line : sums.split("\\r?\\n")) {
      String[] parts = line.trim().split("\\s+", 2);
      if (parts.length == 2 && parts[0].matches("[0-9a-fA-F]{64}") && parts[1].replaceFirst("^\\*", "").equals(name)) {
        return parts[0].toLowerCase(Locale.ROOT);
      }
    }
    return null;
  }

  private static HttpsURLConnection open(String start) throws IOException {
    String current = start;
    for (int hop = 0; hop <= MAX_HOPS; hop++) {
      URL url = new URL(current);
      if (!isAllowedHost(url)) throw new IOException("host not allowed");
      HttpsURLConnection http = (HttpsURLConnection) url.openConnection();
      http.setConnectTimeout(TIMEOUT_MS);
      http.setReadTimeout(TIMEOUT_MS);
      http.setInstanceFollowRedirects(false);
      http.setRequestProperty("User-Agent", "Mikajy-update");
      int code = http.getResponseCode();
      if (code == HttpURLConnection.HTTP_OK) return http;
      String location = http.getHeaderField("Location");
      http.disconnect();
      if (code >= 300 && code < 400 && location != null) { current = new URL(url, location).toString(); continue; }
      throw new IOException("HTTP " + code);
    }
    throw new IOException("too many redirects");
  }

  /** The release's checksum for this APK, or null when the release has no usable SHA256SUMS.txt. */
  private static String expectedDigest(String apkUrl) {
    HttpsURLConnection http = null;
    try {
      http = open(sumsUrl(apkUrl));
      try (InputStream in = http.getInputStream()) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int n;
        while ((n = in.read(buffer)) > 0) { out.write(buffer, 0, n); if (out.size() > 64 * 1024) return null; }
        return digestFor(new String(out.toByteArray(), StandardCharsets.UTF_8), fileName(apkUrl));
      }
    } catch (IOException e) {
      return null;
    } finally {
      if (http != null) http.disconnect();
    }
  }

  static File target(Context context) { return new File(new File(context.getCacheDir(), DIR), "update.apk"); }

  /** Removes a leftover download. */
  static void clear(Context context) {
    File[] files = target(context).getParentFile().listFiles();
    if (files != null) for (File f : files) //noinspection ResultOfMethodCallIgnored
      f.delete();
  }

  /** Downloads and verifies the APK; blocking. */
  static File download(Context context, String apkUrl, Listener listener) throws IOException {
    File apk = target(context);
    File dir = apk.getParentFile();
    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("no cache directory");
    clear(context);
    String expected = expectedDigest(apkUrl);
    MessageDigest sha;
    try { sha = MessageDigest.getInstance("SHA-256"); } catch (NoSuchAlgorithmException e) { throw new IOException(e); }
    HttpsURLConnection http = open(apkUrl);
    try (InputStream in = http.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
      long total = http.getContentLength(), done = 0;
      byte[] buffer = new byte[16 * 1024];
      int n, last = -1;
      while ((n = in.read(buffer)) > 0) {
        out.write(buffer, 0, n);
        sha.update(buffer, 0, n);
        done += n;
        if (done > MAX_APK_BYTES) throw new IOException("file too large");
        int pct = total > 0 ? (int) (done * 100 / total) : 0;
        if (pct != last && (pct % 2 == 0 || pct == 100)) { last = pct; listener.state("downloading", pct, ""); }
      }
      if (total > 0 && done != total) throw new IOException("incomplete download");
    } catch (IOException e) {
      clear(context);
      throw e;
    } finally {
      http.disconnect();
    }
    StringBuilder hex = new StringBuilder();
    for (byte b : sha.digest()) hex.append(String.format(Locale.ROOT, "%02x", b));
    if (expected != null && !expected.equals(hex.toString())) { clear(context); throw new IOException("checksum mismatch"); }
    return apk;
  }

  static String resultAction(Context context) { return context.getPackageName() + ".UPDATE_RESULT"; }

  /** Streams the APK into a package-installer session and commits it; Android then asks the user to confirm. */
  static void install(Context context, File apk) throws IOException {
    PackageInstaller installer = context.getPackageManager().getPackageInstaller();
    PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
    params.setAppPackageName(context.getPackageName());
    if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
    int id = installer.createSession(params);
    try (PackageInstaller.Session session = installer.openSession(id)) {
      try (InputStream in = new java.io.FileInputStream(apk); OutputStream out = session.openWrite("mikajy", 0, apk.length())) {
        byte[] buffer = new byte[64 * 1024];
        int n;
        while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        session.fsync(out);
      }
      Intent result = new Intent(resultAction(context)).setPackage(context.getPackageName());
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
      session.commit(PendingIntent.getBroadcast(context, id, result, flags).getIntentSender());
    } catch (IOException | RuntimeException e) {
      installer.abandonSession(id);
      throw e instanceof IOException ? (IOException) e : new IOException(e);
    }
  }
}
