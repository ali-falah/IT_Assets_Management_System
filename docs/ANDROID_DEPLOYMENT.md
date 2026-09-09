# Android Build & Deployment Guide (Debug & Production)

This guide covers everything you need to build, sign, and install the **IT Assets Management System** Android application using Tauri 2 and Angular.

---

## 1. Prerequisites & Environment Setup

Tauri requires the Rust toolchain, Java 21, the Android SDK, and NDK. Run these commands (or add them to your `~/.bashrc`):

```bash
export JAVA_HOME=/home/ali/jdk21
export ANDROID_HOME=/home/ali/Android/Sdk
export NDK_HOME=/home/ali/Android/Sdk/ndk/29.0.13846066
export PATH="$HOME/.cargo/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Verify your setup:
```bash
adb --version
cargo --version
java -version
```

---

## 2. Fast Build vs. Universal Build

- **Target `aarch64` (Recommended & 4x Faster)**: Modern Android phones (Samsung, Xiaomi, Pixel, etc.) use 64-bit ARM (`aarch64`). Specifying `--target aarch64` compiles only this architecture, saving several minutes per build.
- **Universal (All Architectures)**: Omitting `--target` builds for `aarch64`, `armv7`, `i686`, and `x86_64` into a single APK.

---

## 3. Workflow A: Debug Build (Instant Testing)

Use this when you want to quickly test changes on your phone. Debug builds are **automatically self-signed** with Android's default keystore.

### Step 1: Run the Build
```bash
cd "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/frontend"

# Fast build (64-bit ARM phones):
npx tauri android build --debug --apk --target aarch64

# Universal build (all phones & emulators):
npx tauri android build --debug --apk
```

### Step 2: Output Location
- **For `aarch64`**:
  `src-tauri/gen/android/app/build/outputs/apk/arm64-v8a/debug/app-arm64-v8a-debug.apk`
- **For Universal**:
  `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

---

## 4. Workflow B: Production Release Build

Use this when building the official release package (app ID `com.icc.itassets`).

### Step 1: Run the Release Build
```bash
cd "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/frontend"

# Fast 64-bit ARM release:
npx tauri android build --apk --target aarch64

# Or Universal release:
npm run tauri:build
```

### Step 2: Sign the Release APK
Android requires every APK to be signed. If you haven't configured a formal production keystore yet, sign it with your local development keystore:

```bash
# Locate the apksigner tool
APKSIGNER=$(ls -1d /home/ali/Android/Sdk/build-tools/*/apksigner | tail -n 1)

# Sign the APK
$APKSIGNER sign \
  --ks ~/.android/debug.keystore \
  --ks-pass pass:android \
  --key-pass pass:android \
  "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
```

*(If you built `--target aarch64`, point the path to `.../apk/arm64-v8a/release/app-arm64-v8a-release-unsigned.apk`)*.

---

## 5. Installing the APK on Your Device

### Method 1: Direct USB Install via `adb` (Fastest)

1. Connect your phone via USB.
2. Enable **USB Debugging** in Android Settings -> *Developer Options*.
3. Check that your device is recognized:
   ```bash
   adb devices
   ```
4. Install or upgrade the application (`-r` replaces existing installation while keeping app data):
   ```bash
   # For Debug:
   adb install -r "src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"

   # For Production:
   adb install -r "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
   ```
5. Launch the app directly from your terminal:
   ```bash
   adb shell monkey -p com.icc.itassets -c android.intent.category.LAUNCHER 1
   ```

### Method 2: Manual File Transfer (No USB Debugging Needed)

1. Copy the `.apk` file to your phone via USB file transfer, Telegram, WhatsApp, or Google Drive.
2. In your phone's File Manager, tap the `.apk`.
3. Tap **Install** (allow *"Install unknown apps"* if prompted).

---

## 6. Useful Troubleshooting Tips

| Error / Issue | Cause | Solution |
| :--- | :--- | :--- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Signing certificates mismatch between debug and release builds. | Uninstall the previous version from your phone first: `adb uninstall com.icc.itassets` or `adb uninstall com.icc.itassets.debug`. |
| `INSTALL_PARSE_FAILED_NO_CERTIFICATES` | The release APK was not signed before installing. | Run Step 4 (`$APKSIGNER sign ...`) before running `adb install`. |
| `adb: no devices/emulators found` | Phone is not in USB debugging mode or cable is charge-only. | Unplug and replug cable, ensure *File Transfer (MTP)* is chosen, and authorize the USB debugging dialog on the phone screen. |
| Port 4200 / live dev mode | Testing live webview changes without building APK each time. | Run `npm run tauri:dev` with your phone connected. |

---

## 7. Quick All-In-One Script (Copy & Paste)

```bash
#!/bin/bash
set -e

export JAVA_HOME=/home/ali/jdk21
export ANDROID_HOME=/home/ali/Android/Sdk
export NDK_HOME=/home/ali/Android/Sdk/ndk/29.0.13846066
export PATH="$HOME/.cargo/bin:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "/home/ali/Desktop/MyActiveCodes/IT Assets Inventory/frontend"

echo "==> Building Android Debug APK..."
npx tauri android build --debug --apk --target aarch64

APK="src-tauri/gen/android/app/build/outputs/apk/arm64-v8a/debug/app-arm64-v8a-debug.apk"

if adb get-state 1>/dev/null 2>&1; then
    echo "==> Installing on connected device..."
    adb install -r "$APK"
    adb shell monkey -p com.icc.itassets.debug -c android.intent.category.LAUNCHER 1
    echo "==> Done! App launched."
else
    echo "==> Build complete. APK is ready at:"
    echo "$PWD/$APK"
fi
```
