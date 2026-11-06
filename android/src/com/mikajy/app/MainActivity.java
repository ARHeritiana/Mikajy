package com.mikajy.app;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
public class MainActivity extends Activity {
  WebView w;
  void immersive(){
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
  }
  public class Bridge {
    @JavascriptInterface public void copy(final String t){
      runOnUiThread(new Runnable(){ public void run(){
        ClipboardManager c=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        c.setPrimaryClip(ClipData.newPlainText("Mikajy",t)); }});
    }
    @JavascriptInterface public void shareText(final String t){
      runOnUiThread(new Runnable(){ public void run(){
        Intent i=new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT,t);
        startActivity(Intent.createChooser(i,"Share")); }});
    }
    @JavascriptInterface public void shareImage(final String b64){
      if (b64 == null || b64.length() > 8 * 1024 * 1024) return;
      runOnUiThread(new Runnable(){ public void run(){
        try{
          byte[] image=Base64.decode(b64,Base64.DEFAULT);
          if (image.length < 8 || image.length > 6 * 1024 * 1024
              || (image[0] & 255) != 137 || image[1] != 80 || image[2] != 78 || image[3] != 71
              || image[4] != 13 || image[5] != 10 || image[6] != 26 || image[7] != 10) return;
          File dir=new File(getCacheDir(),"share");
          if (!dir.isDirectory() && !dir.mkdirs()) return;
          File f=new File(dir,"mikajy.png");
          try (FileOutputStream o=new FileOutputStream(f)) { o.write(image); }
          Uri u=Uri.parse("content://com.mikajy.app.share/mikajy.png?t="+System.currentTimeMillis());
          Intent i=new Intent(Intent.ACTION_SEND); i.setType("image/png"); i.putExtra(Intent.EXTRA_STREAM,u);
          i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(Intent.createChooser(i,"Share image"));
        }catch(Exception e){ Log.e("Mikajy","Image sharing failed",e); }
      }});
    }
  }
  @Override protected void onCreate(Bundle b){
    super.onCreate(b);
    w=new WebView(this); w.setBackgroundColor(0xFF000000); getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(0xFF000000)); setContentView(w);
    WebSettings s=w.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setAllowContentAccess(false);
    s.setJavaScriptCanOpenWindowsAutomatically(false);
    s.setSupportMultipleWindows(false);
    s.setBlockNetworkLoads(true);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    w.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view,String url) {
        return !url.startsWith("file:///android_asset/");
      }
    });
    w.setOverScrollMode(View.OVER_SCROLL_NEVER);
    w.addJavascriptInterface(new Bridge(),"Android");
    w.loadUrl("file:///android_asset/index.html");
    immersive();
  }
  @Override protected void onDestroy(){
    if (w!=null){ w.removeJavascriptInterface("Android"); w.destroy(); w=null; }
    super.onDestroy();
  }
  @Override public void onWindowFocusChanged(boolean f){ super.onWindowFocusChanged(f); if(f) immersive(); }
  @Override public void onBackPressed(){
    w.evaluateJavascript("(window.onBack&&window.onBack())?'1':'0'",new ValueCallback<String>(){
      public void onReceiveValue(String v){ if(v==null||!v.contains("1")) MainActivity.super.onBackPressed(); }});
  }
}
