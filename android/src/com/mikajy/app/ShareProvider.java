package com.mikajy.app;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;
public class ShareProvider extends ContentProvider {
  @Override public boolean onCreate(){ return true; }
  @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException {
    if (!"/mikajy.png".equals(uri.getPath()) || !"r".equals(mode)) throw new FileNotFoundException("Invalid shared file");
    File f=new File(new File(getContext().getCacheDir(),"share"),"mikajy.png");
    return ParcelFileDescriptor.open(f,ParcelFileDescriptor.MODE_READ_ONLY);
  }
  @Override public String getType(Uri uri){ return "image/png"; }
  @Override public Cursor query(Uri uri,String[] p,String s,String[] a,String o){
    MatrixCursor c=new MatrixCursor(new String[]{"_display_name","_size"});
    File f=new File(new File(getContext().getCacheDir(),"share"),"mikajy.png");
    c.addRow(new Object[]{"mikajy.png",f.length()}); return c;
  }
  @Override public Uri insert(Uri u,ContentValues v){ return null; }
  @Override public int delete(Uri u,String s,String[] a){ return 0; }
  @Override public int update(Uri u,ContentValues v,String s,String[] a){ return 0; }
}
