# CALLOS — Android Plan & Reality Check

The employee app's core job — **read the phone call log, detect SIM/call state, discover recordings, sync in the background** — cannot be done in the Expo **managed / Expo Go** runtime. This document states honestly what works where, and what requires native code.

---

## 1. Hard reality: Expo Go is not enough

- **Expo Go cannot** access `READ_CALL_LOG`, phone-state broadcasts, telephony/SIM APIs, or run a foreground service. These need custom native code.
- Therefore CALLOS must use an **Expo Development Build** (config plugins + custom native modules) or bare React Native. The UI we built runs in Expo Go for demo; the real data features do not.
- **Do not fake success.** Onboarding/permission screens must reflect the actual OS permission result.

## 2. Permissions (declared in `app.json`)
`READ_CALL_LOG`, `READ_PHONE_STATE`, `READ_CONTACTS`, `READ_EXTERNAL_STORAGE`.
Runtime requests required on Android 6+. Android 13+ splits media permissions; storage access for recordings is increasingly restricted (scoped storage).

## 3. Capability matrix

| Capability | Managed/Expo Go | Dev Build + config plugin | Native module (Kotlin) |
|---|---|---|---|
| Read call log | ❌ | ⚠️ via community/native module | ✅ `ContentResolver` on `CallLog.Calls` |
| Incoming/outgoing detection | ❌ | ⚠️ | ✅ `PhoneStateListener`/`TelephonyCallback` |
| SIM identification (dual-SIM) | ❌ | ⚠️ | ✅ `SubscriptionManager` |
| Contacts | ⚠️ `expo-contacts` | ✅ | ✅ |
| Background execution / foreground service | ❌ | ⚠️ | ✅ foreground service + notification |
| Reboot recovery | ❌ | ⚠️ | ✅ `BOOT_COMPLETED` receiver |
| Recording file discovery | ❌ | ⚠️ | ✅ scan OEM dialer paths (brand-specific) |
| Background upload | ⚠️ | ✅ `expo-task-manager`/`expo-background-task` | ✅ WorkManager |

Legend: ✅ supported · ⚠️ possible with extra native/config work · ❌ not possible.

## 4. Recording caveats (OEM + legal)
- Android has **no public API** to record calls since Android 10; CALLOS reads files produced by the **native OEM dialer** (Samsung One UI `.m4a`, etc.). Paths and availability vary by brand/model/region.
- Many regions **require consent** for call recording. This is a legal requirement, not just technical. See Security plan.
- Min support target: **Android 10 (API 29)+** (matches real CALLOS).

## 5. Offline-first sync engine (planned)
```
Android call log → normalize → local SQLite → sync queue (status: pending)
   online → upload batch → server ACK → mark synced
   failure → retry with exponential backoff; never lose data
```
- **Idempotency:** deterministic `client_event_id` per call → server dedupes on `(organization_id, client_event_id)`.
- **Device heartbeat:** periodic `POST /devices/{id}/heartbeat` with battery, permissions, online status.
- Respect battery optimization / Doze; guide user to whitelist the app.

## 6. Sync status (mobile UI)
Show `Synced / Pending / Failed / Last Sync`. Web shows device health: `ONLINE / OFFLINE / SYNC WARNING / PERMISSION WARNING`.

## 7. Build path to APK
```
npx expo install <native deps + config plugins>
npx expo prebuild            # generates android/ for native code
eas build -p android --profile preview   # downloadable .apk
```
Physical-device testing is mandatory before claiming any call-capture feature works.

## 8. Current status
- UI screens: built, run on mock data.
- Native call capture: **not implemented** — Phase 4. Documented, not faked.
