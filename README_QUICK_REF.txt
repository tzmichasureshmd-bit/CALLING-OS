================================================================================
  CALLOS QUICK REFERENCE - What You Have & How to Use It
================================================================================

📦 NEW FILES CREATED:

Testing:
  ✅ backend/test_e2e_sync.py               - 10 automated E2E tests
  ✅ CALLOS_E2E_TEST_INSTRUCTIONS.md        - Complete testing guide

Building:
  ✅ mobile/BUILD_AND_SHARE.md              - APK build & share guide
  ✅ DEPLOYMENT_CHECKLIST.md                - Pre-deployment checklist

Quick Start:
  ✅ QUICK_START.sh                         - One-command start (Linux/Mac)
  ✅ QUICK_START.bat                        - One-command start (Windows)

Documentation:
  ✅ This file                              - Quick reference

================================================================================
  QUICK START (Choose One)
================================================================================

OPTION 1: RUN TESTS (10 minutes)
  Windows: QUICK_START.bat, then cd backend && python test_e2e_sync.py
  Linux/Mac: bash QUICK_START.sh, then cd backend && python test_e2e_sync.py

OPTION 2: BUILD APK (20 minutes)
  cd mobile
  npm install -g eas-cli
  eas login
  eas build -p android --profile customClient
  → Get download link → Share with team

OPTION 3: FULL FLOW (40 minutes)
  Run Option 1 (tests), then Option 2 (build)

================================================================================
  VERIFY EVERYTHING WORKS
================================================================================

Backend:
  curl http://localhost:8000/health
  Expected: {"status": "healthy", "version": "1.0.0"}

Tests:
  python backend/test_e2e_sync.py
  Expected: "Total: 10/10 tests passed ✨"

Web Dashboard:
  http://localhost:5173
  Expected: Sees test calls from E2E tests

Mobile:
  Register account → Check device in Settings
  Expected: Device ID shown, syncing every 15s

================================================================================
  SHARE WITH TEAM
================================================================================

1. Build APK:
   eas build -p android --profile customClient

2. Copy download link from build output

3. Email/Slack to team:
   - APK download link
   - Company code: TZM-2026-5823
   - Setup instructions (see CALLOS_E2E_TEST_INSTRUCTIONS.md)

4. Team installation:
   - Download APK from link
   - Tap to install
   - Register account
   - Done!

================================================================================
  TROUBLESHOOTING
================================================================================

Tests fail: "Database connection"
  → Make sure PostgreSQL is running
  → Run: createdb callos
  → Then: python backend/test_e2e_sync.py

APK build fails: "Project not found"
  → cd mobile
  → eas project:configure

Mobile can't reach backend
  → Check mobile/.env EXPO_PUBLIC_API_URL
  → For emulator: http://10.0.2.2:8000/api/v1
  → For device: http://YOUR_IP:8000/api/v1

Calls don't appear on web
  → Check they're in database: SELECT COUNT(*) FROM calls;
  → Remove all filters on Call Logs page
  → Hard refresh web: Ctrl+Shift+R

================================================================================
  COMMANDS CHEAT SHEET
================================================================================

Start everything:
  QUICK_START.bat         (Windows)
  bash QUICK_START.sh     (Linux/Mac)

Run E2E tests:
  python backend/test_e2e_sync.py

Build APK:
  cd mobile && eas build -p android --profile customClient

Check backend health:
  curl http://localhost:8000/health

View backend logs:
  tail -f backend/backend.log

Query database:
  psql postgresql://localhost:5432/callos
  SELECT COUNT(*) FROM calls;

Stop all services:
  taskkill /IM node.exe /F    (Windows)
  pkill -f "uvicorn|npm|expo" (Linux/Mac)

================================================================================
  IMPORTANT NOTES
================================================================================

✅ EAS is pre-configured - no manual setup needed
✅ All permissions declared in app.json
✅ Tests verify the ENTIRE sync pipeline works
✅ APK ready to share immediately after build
✅ Quick Start handles all setup automatically

Company Code (for team): TZM-2026-5823

================================================================================
  WHAT GETS TESTED (10 Tests)
================================================================================

1. Database connectivity
2. Organization creation
3. User registration
4. Employee setup
5. Device registration
6. JWT token generation
7. Call sync from mobile to backend
8. Dashboard data retrieval
9. Sync idempotency (duplicate prevention)
10. Device online status

Expected Result: ✅ All 10 PASS

================================================================================
  NEXT STEPS
================================================================================

1. Run tests:
   python backend/test_e2e_sync.py

2. If all pass → Build APK:
   cd mobile && eas build -p android --profile customClient

3. Share download link with team

4. Team tests on their devices

5. Done! 🎉

================================================================================
  FILES REFERENCE
================================================================================

Testing:
  Read: CALLOS_E2E_TEST_INSTRUCTIONS.md
  Run: python backend/test_e2e_sync.py

Building:
  Read: mobile/BUILD_AND_SHARE.md
  Run: cd mobile && eas build -p android --profile customClient

Deploying:
  Read: DEPLOYMENT_CHECKLIST.md
  Before production, go through all items

Quick Start:
  Run: QUICK_START.bat (Windows) or bash QUICK_START.sh (Linux/Mac)
  Starts backend, web, and mobile automatically

================================================================================
  YOU'RE ALL SET! 🚀
================================================================================

Next action: Run tests or build APK

Questions? Check the detailed guides:
  - CALLOS_E2E_TEST_INSTRUCTIONS.md
  - mobile/BUILD_AND_SHARE.md
  - DEPLOYMENT_CHECKLIST.md

Good luck! 🎉
