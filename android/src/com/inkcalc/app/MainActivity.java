package com.inkcalc.app;
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
        c.setPrimaryClip(ClipData.newPlainText("InkCalc",t)); }});
    }
    @JavascriptInterface public void shareText(final String t){
      runOnUiThread(new Runnable(){ public void run(){
        Intent i=new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT,t);
        startActivity(Intent.createChooser(i,"Share")); }});
    }
    @JavascriptInterface public void shareImage(final String b64){
      runOnUiThread(new Runnable(){ public void run(){
        try{
          File dir=new File(getCacheDir(),"share"); dir.mkdirs();
          File f=new File(dir,"inkcalc.png");
          FileOutputStream o=new FileOutputStream(f); o.write(Base64.decode(b64,Base64.DEFAULT)); o.close();
          Uri u=Uri.parse("content://com.inkcalc.app.share/inkcalc.png?t="+System.currentTimeMillis());
          Intent i=new Intent(Intent.ACTION_SEND); i.setType("image/png"); i.putExtra(Intent.EXTRA_STREAM,u);
          i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
          startActivity(Intent.createChooser(i,"Share image"));
        }catch(Exception e){}
      }});
    }
  }
  @Override protected void onCreate(Bundle b){
    super.onCreate(b);
    w=new WebView(this); setContentView(w);
    WebSettings s=w.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
    w.setOverScrollMode(View.OVER_SCROLL_NEVER);
    w.addJavascriptInterface(new Bridge(),"Android");
    w.loadUrl("file:///android_asset/index.html");
    immersive();
  }
  @Override public void onWindowFocusChanged(boolean f){ super.onWindowFocusChanged(f); if(f) immersive(); }
  @Override public void onBackPressed(){
    w.evaluateJavascript("(window.onBack&&window.onBack())?'1':'0'",new ValueCallback<String>(){
      public void onReceiveValue(String v){ if(v==null||!v.contains("1")) MainActivity.super.onBackPressed(); }});
  }
}
