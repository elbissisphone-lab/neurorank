# NeuroRank | Android App Implementation Guide

To convert NeuroRank into a native Android app using Android Studio, follow these steps to create a **WebView Wrapper**. This will allow your web app to run as a standalone application on your phone.

---

### **Step 1: Create a New Project**
1.  Open **Android Studio**.
2.  Select **New Project** > **Empty Views Activity**.
3.  **Name:** NeuroRank
4.  **Language:** Java (or Kotlin, instructions below are Java for simplicity).
5.  **Minimum SDK:** API 24 (Android 7.0) or higher.

---

### **Step 2: Add Internet Permission**
Open `app/src/main/AndroidManifest.xml` and add this line above the `<application>` tag:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```
And inside the `<application>` tag, add:
```xml
android:hardwareAccelerated="true"
android:usesCleartextTraffic="true"
```

---

### **Step 3: Layout Configuration**
Open `app/src/main/res/layout/activity_main.xml` and replace the content with:
```xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</RelativeLayout>
```

---

### **Step 4: The Logic (MainActivity.java)**
Open `app/src/main/java/com/example/neurorank/MainActivity.java` and use this code:

```java
package com.example.neurorank;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView myWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        myWebView = findViewById(R.id.webview);
        WebSettings webSettings = myWebView.getSettings();
        
        // Essential Settings for NeuroRank
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true); // Crucial for LocalStorage
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);

        myWebView.setWebViewClient(new WebViewClient());

        // Replace with your hosted URL or local asset path
        myWebView.loadUrl("https://your-hosted-site.com/routine/index.html");
    }

    // Ensure "Back" button works in the app
    @Override
    public void onBackPressed() {
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
```

---

### **Step 5: Setting the Icon (logo.png)**
1.  In Android Studio, right-click the `res` folder.
2.  Select **New** > **Image Asset**.
3.  For **Path**, browse and select your `logo.png` from the routine folder.
4.  Adjust scaling so the logo fits nicely in the circle/square.
5.  Click **Next** and **Finish**.

---

### **Step 6: Local Assets (Optional - Offline Mode)**
If you want the app to work without hosting the website:
1.  In your Android Project, right-click `app` > `New` > `Folder` > `Assets Folder`.
2.  Create a folder named `www` inside `assets`.
3.  Copy all files from your `routine` folder (`index.html`, `style.css`, `app.js`) into `assets/www`.
4.  Change the `loadUrl` in `MainActivity.java` to:
    ```java
    myWebView.loadUrl("file:///android_asset/www/index.html");
    ```

---

### **Step 7: Build and Run**
Connect your Android phone via USB (with Developer Mode enabled) and click the **Run** button (Green Play Icon) in Android Studio. Your **NeuroRank** app is now live on your device!
