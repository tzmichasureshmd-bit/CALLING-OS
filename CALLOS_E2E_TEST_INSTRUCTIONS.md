# 🚀 CALLOS Full E2E Testing & EAS Build Guide

**Goal:** Run complete end-to-end tests (mobile→backend→web) and build shareable APK for your team.

---

## Part 1: Quick Setup (5 minutes)

### 1.1 Start Backend

```bash
cd backend

# Install if first time
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or .\venv\Scripts\Activate.ps1  # Windows

pip install -r requirements.txt

# Start backend (make sure PostgreSQL is running)
uvicorn app.main:app --reload
```

✅ Backend running at: `http://localhost:8000`

### 1.2 Start Web Dashboard

```bash
cd web
npm run dev
```

✅ Web running at: `http://localhost:5173`

### 1.3 Start Mobile

```bash
cd mobile
npx expo start
# Press 'a' for Android emulator, or scan QR for physical device
```

---

## Part 2: Run E2E Tests (10 minutes)

### 2.1 Automated Test Suite

```bash
cd backend

# Run full E2E test suite
python test_e2e_sync.py
```

**What it tests:**
- ✅ Database connectivity
- ✅ Organization creation
- ✅ User registration
- ✅ Employee setup
- ✅ Device registration
- ✅ JWT token generation
- ✅ Call sync flow
- ✅ Dashboard data retrieval
- ✅ Sync idempotency
- ✅ Device online tracking

**Expected output:**
```
TEST SUMMARY
✅ PASS  Test 1: Database Health
✅ PASS  Test 2: Organization Setup
✅ PASS  Test 3: User Registration
✅ PASS  Test 4: Employee Creation
✅ PASS  Test 5: Device Registration
✅ PASS  Test 6: JWT Token
✅ PASS  Test 7: Call Sync
✅ PASS  Test 8: Dashboard Data
✅ PASS  Test 9: Sync Idempotency
✅ PASS  Test 10: Device Online

Total: 10/10 tests passed ✨
```

---

### 2.2 Manual Mobile Testing

**On the mobile app:**

1. **Register new account:**
   - Email: `test-sync@callos.local`
   - Password: `Test@123`
   - Company Code: `TZM-2026-5823`

2. **Wait for device registration (should happen automatically)**

3. **View Settings tab:**
   - Verify Device ID is shown
   - Verify permissions status
   - Wait for "Last Sync" to update

4. **Check backend logs for sync confirmations:**
   ```bash
   tail -f backend/backend.log | grep SYNC
   ```

**Expected in logs:**
```
[AUTH] user registered: test-sync@callos.local
[DEVICE] device registered: tzm-dev-xyz123...
[HEARTBEAT] device=tzm-dev-xyz123... battery=75% permissions={...}
```

---

### 2.3 Check Dashboard

**On web dashboard:**

1. **Go to "Call Logs"**
2. **Should see test calls** (from E2E test suite)
3. **Click on a call → See full details**

**Expected:**
- ✅ Phone numbers displayed
- ✅ Employee name linked
- ✅ Call type color-coded
- ✅ Duration shown correctly

---

## Part 3: Build EAS APK for Team (15 minutes)

### 3.1 Install EAS CLI

```bash
npm install -g eas-cli
cd mobile
```

### 3.2 Login to Expo Account

```bash
eas login
# Or create account at https://expo.dev
```

### 3.3 Build APK

**Option A: Local build (faster, uses your machine)**
```bash
eas build -p android --profile customClient --local
```

**Option B: Remote build (recommended, uses Expo servers)**
```bash
eas build -p android --profile customClient
```

**Build takes ~10-15 minutes. You'll see:**
```
Building Android app...
[████████░░░░░░░░] 60% Building...

✅ Build successful!
Download APK: https://expo.dev/builds/abc123...
```

### 3.4 Get Download Link & Share

After build completes:

1. **Copy the APK download link**
2. **Share with team via:**
   - Email
   - Slack
   - Google Drive
   - QR code (expo.dev shows one)

**Team members install by:**
```bash
# Option 1: Download from link & tap on Android device
# Option 2: adb install callingos.apk
# Option 3: Scan QR code
```

---

## Part 4: Troubleshooting

### Issue: "Device not found in your organization"

**Fix:**
```bash
# Backend database
psql postgresql://postgres:password@localhost:5432/callos

# Check device exists
SELECT id, employee_id, organization_id FROM devices LIMIT 1;

# If empty, manually register:
INSERT INTO devices (...) VALUES (...)
```

### Issue: Tests fail on "Database connection"

**Fix:**
```bash
# Make sure PostgreSQL is running
createdb callos
python migration_runner.py
```

### Issue: EAS build fails with "Permission denied"

**Fix:**
```bash
# Try local build instead of remote
eas build -p android --profile customClient --local

# Or check Expo account has permissions
eas project:info
```

### Issue: Mobile app crashes on startup

**Fix:**
```bash
# Clear Expo cache
npx expo start --clear

# Or reinstall
npm install
```

---

## Files to Share with Team

When distributing, include:

1. **APK download link** (from EAS build)
2. **Setup guide** (this file)
3. **Test credentials:**
   - Company code: `TZM-2026-5823`
   - Test email: `test-sync@callos.local`
   - Test password: `Test@123`
4. **Backend endpoint:** `https://api.callingos.tzmicha.com/api/v1` (production)
5. **Dashboard URL:** `https://callingos.tzmicha.com` (production)

---

## Quick Commands Reference

```bash
# Start everything
cd backend && uvicorn app.main:app --reload &  # Backend
cd web && npm run dev &                         # Web
cd mobile && npx expo start                     # Mobile

# Run E2E tests
cd backend && python test_e2e_sync.py

# Build APK
cd mobile && eas build -p android --profile customClient

# Check logs
tail -f backend/backend.log

# Query database
psql postgresql://postgres:password@localhost:5432/callos

# Clear mobile cache
npx expo start --clear
```

---

## Success Criteria

✅ All E2E tests pass  
✅ Mobile can read Android call logs (on real device)  
✅ Calls sync to backend within 15 seconds  
✅ Calls appear on web dashboard instantly  
✅ APK builds successfully  
✅ Team can install APK on their devices  

---

## Support

If anything fails:

1. **Check backend logs:** `tail -f backend/backend.log`
2. **Check mobile logs:** Open Expo console (Shift+D in Expo Go)
3. **Check web console:** Browser DevTools (F12)
4. **Query database:** `psql ... -c "SELECT * FROM calls LIMIT 5;"`

Good luck! 🚀
