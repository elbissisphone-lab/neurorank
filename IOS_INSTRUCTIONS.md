# NeuroRank | iOS App Implementation Guide

To convert NeuroRank into a native iOS app using **Xcode** and **SwiftUI**, follow these steps to create a **WebView Wrapper**.

### **Prerequisites**
*   A Mac with **Xcode** installed.
*   Your `routine` web assets (index.html, app.js, style.css, logo.png).

---

### **Step 1: Create a New Xcode Project**
1.  Open Xcode and select **"Create a new Xcode project"**.
2.  Choose **iOS** -> **App**.
3.  Product Name: `NeuroRank`
4.  Interface: **SwiftUI**
5.  Language: **Swift**

### **Step 2: Add Web Assets to Xcode**
1.  In the Xcode project navigator, right-click on the `NeuroRank` folder and select **"New Group"**. Name it `www`.
2.  Drag your `index.html`, `app.js`, `style.css`, and `logo.png` into this `www` group.
3.  Ensure **"Copy items if needed"** is checked and your target is selected.

### **Step 3: Create the WebView Wrapper**
Create a new Swift file named `WebView.swift` and paste this code:

```swift
import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let fileName: String

    func makeUIView(context: Context) -> WKWebView {
        let webConfiguration = WKWebViewConfiguration()
        
        // Allow local file access
        webConfiguration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        let webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.scrollView.isScrollEnabled = true
        webView.allowsBackForwardNavigationGestures = true
        
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = Bundle.main.url(forResource: fileName, withExtension: "html", subdirectory: "www") {
            uiView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }
}
```

### **Step 4: Update ContentView.swift**
Replace the code in `ContentView.swift` to display the WebView:

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea() // Matches NeuroRank theme
            
            WebView(fileName: "index")
                .ignoresSafeArea(.all, edges: .bottom)
        }
    }
}
```

### **Step 5: Configure Permissions**
1.  Go to the **Info** tab of your project settings.
2.  Add **"App Transport Security Settings"**.
3.  Under that, add **"Allow Arbitrary Loads"** and set it to `YES` (required for local file loading).

### **Step 6: Build and Run**
1.  Select an iPhone Simulator or connect your iPhone.
2.  Press **Cmd + R** to run. Your **NeuroRank** app is now a native iOS application!

---

### **Alternative: Unified Cross-Platform (Recommended)**
If you want to manage both Android and iOS from a single place, I recommend migrating to **Capacitor**. 
1.  Run `npm install @capacitor/core @capacitor/cli` in your `routine` folder.
2.  Run `npx cap add ios`.
This will generate the Xcode project for you automatically.