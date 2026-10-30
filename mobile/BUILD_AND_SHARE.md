# 📱 CALLOS Mobile APK Build & Distribution Guide

## Quick Start

```bash
cd mobile

# 1. Login to Expo (one time)
eas login

# 2. Build APK for team distribution
eas build -p android --profile customClient
```

**That's it! In ~15 minutes you'll have a download link to share.**

---

## Step-by-Step Instructions

### Step 1: Setup Expo Account

If you don't have an Expo account:

1. Go to https://expo.dev
2. Sign up with GitHub/Google/Email
3. Remember your username & password

### Step 2: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 3: Navigate to Mobile Directory

```bash
cd c:\Users\danie\Desktop\CALL OSS\mobile
```

### Step 4: Login to Expo

```bash
eas login

# You'll be prompted:
# ✔ Expo username: [your-username]
# ✔ Expo password: [your-password]

# If successful:
# ✅ Logged in as [your-username]
```

### Step 5: Check Project Config

```bash
eas project:info

# Should show:
# Project ID: 66cd6c4d-0311-40a4-91c8-ebd924306ced
# Slug: callnexa
# Platform: Android
```

### Step 6: Build APK

```bash
# Option A: Build locally (faster, uses your machine)
eas build -p android --profile customClient --local

# Option B: Build on Expo servers (recommended for consistency)
eas build -p android --profile customClient
```

**Build progress:**
```
Building Android app...
[████░░░░░░░░░░░░░] 20% Downloading build environment...
[████████░░░░░░░░] 40% Configuring...
[████████████░░░░] 60% Building...
[████████████████] 80% Finalizing...
[████████████████] 100% Done!

✅ Build succeeded!
📱 APK ready for download

Download: https://expo.dev/builds/abc123-def456-ghi789
QR Code: [shows QR]
```

---

## Get Your Download Link

After build completes, you'll see:

```
✅ Build finished!
📱 Android APK Build URL: https://expo.dev/builds/abc123...

Share this link with your team!
```

### Option 1: Direct Download

Click the link → Download APK → Share file

### Option 2: QR Code

Scan with phone camera → Auto-download → Install

### Option 3: Expo Dashboard

1. Go to https://expo.dev
2. Login with your account
3. Find "callnexa" project
4. Click latest build
5. Download APK

---

## Team Installation

### For Android Users

**Easy way:**
1. Send APK download link to team
2. They click link on their phone
3. Tap "Install"
4. Done! 🎉

**Manual way:**
```bash
# Download APK first
adb install callingos.apk
```

**Via Google Drive:**
1. Upload APK to Google Drive
2. Share link with team
3. They download and install

---

## What to Share with Team

**Email template:**

```
Subject: CALLOS Mobile App - Ready for Testing

Hi team,

The new CALLOS mobile app is ready for testing!

📱 Download link: [APK download URL]

Setup steps:
1. Download APK from link above
2. Tap to install on your Android device
3. Launch "CallNexa" app
4. Register with email/password
5. Enter company code: TZM-2026-5823

Testing checklist:
✅ App installs successfully
✅ Can register account
✅ App reads Android call logs
✅ Can see your calls in the app
✅ Calls sync to dashboard

Questions? Ask in #dev-callos

Thanks!
```

---

## Build Profiles Explained

### `customClient` (What you'll use)
- ✅ Includes native modules (call log reading)
- ✅ Optimized for testing
- ✅ APK format (easy to install)
- ✅ Recommended for team testing

### `preview`
- Similar to customClient
- For internal distribution

### `production`
- For Google Play Store release
- Requires signing key
- App bundle format

---

## Troubleshooting

### Problem: "eas login failed"

```bash
# Try again with explicit URL
eas login --url https://auth.expo.io

# Or logout first
eas logout
eas login
```

### Problem: "Project not found"

```bash
# Link project to current directory
eas project:configure

# Or check if app.json has correct project ID
cat app.json | grep projectId
```

### Problem: "Build failed"

```bash
# Check dependencies are installed
npm install

# Clear cache
npm cache clean --force
eas build:cache:clean

# Try building locally first
eas build -p android --profile customClient --local
```

### Problem: "APK install fails on device"

```bash
# Check Android version (needs 10+)
# Check "Unknown sources" is enabled in settings
# Try different USB cable or port
adb devices  # Should show your device
```

---

## Previous Builds

To see your build history:

```bash
eas build:list

# Shows:
# Build ID          Status    Platform  Created
# abc123-def456     SUCCESS   android   2 hours ago
# xyz789-uvw456     SUCCESS   android   1 day ago
# ...
```

To download a previous build:

```bash
eas build:view [BUILD_ID]

# Then click "Download APK"
```

---

## Advanced Options

### Force Rebuild

```bash
eas build -p android --profile customClient --clear-cache
```

### Build with Custom Environment

```bash
# Edit .env file first
eas build -p android --profile customClient --env-file .env
```

### Monitor Build in Real-Time

```bash
eas build -p android --profile customClient --verbose
```

---

## Support Links

- **Expo Docs:** https://docs.expo.dev
- **EAS Build Docs:** https://docs.expo.dev/build/introduction
- **GitHub Issues:** Report bugs here
- **Discord:** Expo community support

---

## Next Steps

1. ✅ Build APK (`eas build -p android --profile customClient`)
2. ✅ Get download link
3. ✅ Share with team
4. ✅ Team installs and tests
5. ✅ Collect feedback
6. ✅ Fix bugs → Rebuild → Share again

---

Happy building! 🚀
