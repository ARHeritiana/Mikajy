package com.mikajy.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;

/**
 * Installs a downloaded, checksum-verified update through Android's own installer (PackageInstaller session).
 * Android shows its "update this app?" confirmation unless it lets an app update itself silently (Android 12+),
 * and Android itself refuses any APK not signed with the same key as the installed app.
 *
 * The app is compiled against API 23, so the few newer APIs are reached by reflection or by their documented
 * constant values; on older Android versions they are simply not used.
 */
final class SelfInstaller {
  static final String ACTION_STATUS = "com.mikajy.app.INSTALL_STATUS";
  private static final String UNKNOWN_SOURCES = "android.settings.MANAGE_UNKNOWN_APP_SOURCES";   // Settings, API 26
  private static final int FLAG_MUTABLE = 0x02000000;                                               // PendingIntent, API 31
  private static final int USER_ACTION_NOT_REQUIRED = 2;                                            // SessionParams, API 31

  private SelfInstaller() {}

  /** Directory for the downloaded update (app cache; emptied at every start). */
  static File dir(Context c) { return new File(c.getCacheDir(), "update"); }

  static void clear(Context c) {
    File[] files = dir(c).listFiles();
    if (files != null) for (File f : files) if (!f.delete()) f.deleteOnExit();
  }

  /** null when `apk` is this app at a higher versionCode, otherwise "package". */
  @SuppressWarnings("deprecation")
  static String checkArchive(Context c, File apk) {
    PackageManager pm = c.getPackageManager();
    PackageInfo next = pm.getPackageArchiveInfo(apk.getPath(), 0);
    if (next == null || !c.getPackageName().equals(next.packageName)) return "package";
    try {
      PackageInfo now = pm.getPackageInfo(c.getPackageName(), 0);
      return next.versionCode > now.versionCode ? null : "package";
    } catch (PackageManager.NameNotFoundException e) {
      return "package";
    }
  }

  /** Android 8+ asks the user once to allow this app to install apps ("Install unknown apps"). */
  static boolean mayInstall(Context c) {
    if (Build.VERSION.SDK_INT < 26) return true;
    try {
      Method m = PackageManager.class.getMethod("canRequestPackageInstalls");
      return Boolean.TRUE.equals(m.invoke(c.getPackageManager()));
    } catch (ReflectiveOperationException | RuntimeException e) {
      return false;
    }
  }

  static void askPermission(Activity a) {
    a.startActivity(new Intent(UNKNOWN_SOURCES, Uri.parse("package:" + a.getPackageName())));
  }

  /** Blocking (file copy); call from a background thread. The outcome arrives at the activity as ACTION_STATUS. */
  static void install(Activity a, File apk) throws IOException {
    PackageInstaller installer = a.getPackageManager().getPackageInstaller();
    PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
    params.setAppPackageName(a.getPackageName());
    params.setSize(apk.length());
    if (Build.VERSION.SDK_INT >= 31) {
      try {   // Let Android skip the confirmation where it allows an app to update itself.
        PackageInstaller.SessionParams.class.getMethod("setRequireUserAction", int.class).invoke(params, USER_ACTION_NOT_REQUIRED);
      } catch (ReflectiveOperationException | RuntimeException e) {
        // Not available: Android asks for confirmation as usual.
      }
    }
    int id = installer.createSession(params);
    try (PackageInstaller.Session session = installer.openSession(id)) {
      try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
        byte[] buffer = new byte[64 * 1024];
        int n;
        while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        session.fsync(out);
      }
      Intent status = new Intent(a, MainActivity.class).setAction(ACTION_STATUS).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? FLAG_MUTABLE : 0);   // Android fills in the result
      session.commit(PendingIntent.getActivity(a, 0, status, flags).getIntentSender());
    } catch (IOException | RuntimeException e) {
      installer.abandonSession(id);
      throw e;
    }
  }

  /**
   * Handles an ACTION_STATUS intent: shows Android's confirmation when it is needed. Returns the state for the page:
   * "confirm", "installed", "aborted" or "install" (Android refused it: e.g. a different signing key).
   */
  @SuppressWarnings("deprecation")
  static String onStatus(Activity a, Intent i) {
    int status = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      Intent confirm = i.getParcelableExtra(Intent.EXTRA_INTENT);
      if (confirm == null) return "install";
      a.startActivity(confirm);
      return "confirm";
    }
    if (status == PackageInstaller.STATUS_SUCCESS) return "installed";
    if (status == PackageInstaller.STATUS_FAILURE_ABORTED) return "aborted";
    return "install";
  }
}
