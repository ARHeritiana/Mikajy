package com.mikajy.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.PackageInstaller;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.os.Build;
import android.provider.Settings;
import java.util.concurrent.atomic.AtomicBoolean;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Immersive, offline-first WebView shell. The page is loaded from the APK's assets only; every other
 * navigation is refused and the WebView's network loads are blocked. The one network use is the optional
 * update check in {@link UpdateChecker}, run natively and reported to the page through the bridge.
 */
public class MainActivity extends Activity {
  private static final String TAG = "Mikajy";
  private static final String PAGE = "file:///android_asset/index.html";
  private static final String ASSET_PREFIX = "file:///android_asset/";
  private static final int MAX_TEXT_CHARS = 256 * 1024;
  private static final int MAX_BASE64_CHARS = 8 * 1024 * 1024;
  private static final int MAX_PNG_BYTES = 6 * 1024 * 1024;
  private static final byte[] PNG_MAGIC = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};

  private WebView web;
  private ExecutorService io;
  private ExecutorService net;
  private final AtomicBoolean updating = new AtomicBoolean();
  private BroadcastReceiver installResult;

  private void reportUpdate(final String state, final int pct, final String reason) {
    final String json;
    try { json = new JSONObject().put("state", state).put("pct", pct).put("reason", reason).toString(); } catch (org.json.JSONException e) { return; }
    runOnUiThread(new Runnable() { @Override public void run() {
      if (web != null) web.evaluateJavascript("window.onUpdateState&&window.onUpdateState(" + JSONObject.quote(json) + ")", null);
    }});
  }

  private void immersive() {
    getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
  }

  static boolean isPng(byte[] data) {
    if (data == null || data.length < PNG_MAGIC.length) return false;
    for (int i = 0; i < PNG_MAGIC.length; i++) if (data[i] != PNG_MAGIC[i]) return false;
    return true;
  }

  /** Methods exposed to the (local, trusted) page. Each one validates its input. */
  public class Bridge {
    @JavascriptInterface public void copy(final String text) {
      if (text == null || text.length() > MAX_TEXT_CHARS) return;
      runOnUiThread(new Runnable() { @Override public void run() {
        ClipboardManager clip = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clip != null) clip.setPrimaryClip(ClipData.newPlainText("Mikajy", text));
      }});
    }

    @JavascriptInterface public void shareText(final String text) {
      if (text == null || text.length() > MAX_TEXT_CHARS) return;
      runOnUiThread(new Runnable() { @Override public void run() {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(send, "Share"));
      }});
    }

    @JavascriptInterface public void shareImage(final String base64) {
      if (base64 == null || base64.length() > MAX_BASE64_CHARS) return;
      io.execute(new Runnable() { @Override public void run() {
        try {
          final byte[] image = Base64.decode(base64, Base64.DEFAULT);
          if (image.length > MAX_PNG_BYTES || !isPng(image)) return;
          File dir = ShareProvider.shareDir(MainActivity.this);
          if (!dir.isDirectory() && !dir.mkdirs()) return;
          try (FileOutputStream out = new FileOutputStream(new File(dir, ShareProvider.FILE_NAME))) {
            out.write(image);
          }
          runOnUiThread(new Runnable() { @Override public void run() {
            Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + ShareProvider.FILE_NAME
                + "?t=" + System.currentTimeMillis());
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(send, "Share image"));
          }});
        } catch (IllegalArgumentException | IOException e) {
          Log.e(TAG, "Image sharing failed", e);
        }
      }});
    }

    /** The installed versionName, e.g. "5.0". */
    @JavascriptInterface public String version() {
      try {
        String name = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        return name == null ? "" : name;
      } catch (PackageManager.NameNotFoundException e) {
        return "";
      }
    }

    /** True when this shell can download and install an update itself, without opening a browser. */
    @JavascriptInterface public boolean canInstallUpdates() { return Build.VERSION.SDK_INT >= 21; }

    /**
     * Downloads the release APK inside the app, verifies it and hands it to the system installer. Progress arrives in
     * window.onUpdateState({state: "downloading"|"installing"|"permission"|"failed", pct, reason}).
     */
    @JavascriptInterface public void installUpdate(final String url) {
      if (!UpdateInstaller.isApkUrl(url) || net == null) return;
      if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
        reportUpdate("permission", 0, "");
        runOnUiThread(new Runnable() { @Override public void run() {
          try {
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
          } catch (ActivityNotFoundException e) { Log.e(TAG, "No settings screen for install permission", e); }
        }});
        return;
      }
      if (!updating.compareAndSet(false, true)) return;
      net.execute(new Runnable() { @Override public void run() {
        try {
          reportUpdate("downloading", 0, "");
          File apk = UpdateInstaller.download(MainActivity.this, url, new UpdateInstaller.Listener() {
            @Override public void state(String state, int pct, String reason) { reportUpdate(state, pct, reason); }
          });
          reportUpdate("installing", 100, "");
          UpdateInstaller.install(MainActivity.this, apk);
        } catch (IOException | RuntimeException e) {
          Log.e(TAG, "Update failed", e);
          reportUpdate("failed", 0, String.valueOf(e.getMessage()));
        } finally {
          updating.set(false);
        }
      }});
    }

    /** Asks GitHub for the newest release; the answer arrives asynchronously in window.onUpdateResult(json). */
    @JavascriptInterface public void checkForUpdates() {
      final ExecutorService worker = net;
      if (worker == null) return;
      worker.execute(new Runnable() { @Override public void run() {
        final String answer = UpdateChecker.check();
        runOnUiThread(new Runnable() { @Override public void run() {
          if (web != null) {
            web.evaluateJavascript("window.onUpdateResult&&window.onUpdateResult(" + JSONObject.quote(answer) + ")", null);
          }
        }});
      }});
    }

    /** Opens a release page or APK link in the system browser. Refuses anything outside this project's releases. */
    @JavascriptInterface public void openUpdate(final String url) {
      if (!UpdateChecker.isReleaseUrl(url)) return;
      runOnUiThread(new Runnable() { @Override public void run() {
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) {
          Log.e(TAG, "No browser for the update link", e);
        }
      }});
    }
  }

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    io = Executors.newSingleThreadExecutor();
    net = Executors.newSingleThreadExecutor();
    installResult = new BroadcastReceiver() {
      @Override public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
          Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
          if (confirm != null) startActivity(confirm);
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
          reportUpdate("failed", 0, String.valueOf(intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)));
        }
      }
    };
    IntentFilter filter = new IntentFilter(UpdateInstaller.resultAction(this));
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(installResult, filter, Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(installResult, filter);
    io.execute(new Runnable() { @Override public void run() { UpdateInstaller.clear(MainActivity.this); }});
    // The shared PNG is only needed for the lifetime of one share action; drop leftovers.
    io.execute(new Runnable() { @Override public void run() { ShareProvider.clear(MainActivity.this); }});

    web = new WebView(this);
    web.setBackgroundColor(Color.BLACK);
    getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK));
    setContentView(web);

    WebView.setWebContentsDebuggingEnabled(false);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);          // the app is JavaScript
    s.setDomStorageEnabled(true);          // settings, history, personalisation
    s.setAllowFileAccess(false);           // file:///android_asset stays reachable regardless
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setAllowContentAccess(false);
    s.setGeolocationEnabled(false);
    s.setSaveFormData(false);
    s.setJavaScriptCanOpenWindowsAutomatically(false);
    s.setSupportMultipleWindows(false);
    s.setBlockNetworkLoads(true);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return url == null || !url.startsWith(ASSET_PREFIX);
      }
    });
    web.setOverScrollMode(View.OVER_SCROLL_NEVER);
    web.addJavascriptInterface(new Bridge(), "Android");
    web.loadUrl(PAGE);
    immersive();
  }

  @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

  @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

  @Override protected void onDestroy() {
    if (installResult != null) { try { unregisterReceiver(installResult); } catch (IllegalArgumentException e) { /* already gone */ } installResult = null; }
    if (io != null) { io.shutdown(); io = null; }
    if (net != null) { net.shutdown(); net = null; }
    if (web != null) {
      web.removeJavascriptInterface("Android");
      web.destroy();
      web = null;
    }
    super.onDestroy();
  }

  @Override public void onWindowFocusChanged(boolean focus) {
    super.onWindowFocusChanged(focus);
    if (focus) immersive();
  }

  @Override public void onBackPressed() {
    if (web == null) { super.onBackPressed(); return; }
    web.evaluateJavascript("(window.onBack&&window.onBack())?'1':'0'", new ValueCallback<String>() {
      @Override public void onReceiveValue(String result) {
        if (!"\"1\"".equals(result)) MainActivity.super.onBackPressed();
      }
    });
  }
}
