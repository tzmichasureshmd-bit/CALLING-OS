package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.database.Cursor
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallLogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG         = "CallNexa.CallLogModule"
        private const val EVENT_NAME  = "callLogChanged"
        private const val DEBOUNCE_MS = 1500L
    }

    override fun getName() = "CallLogModule"

    // ── Background thread — created lazily in startObserving() ───────────────
    private var observerThread:  HandlerThread?    = null
    private var observerHandler: Handler?          = null
    private var callLogObserver: ContentObserver?  = null
    private var debounceRunnable: Runnable?        = null

    // Last Android call-log _id seen — prevents duplicate events for the same row.
    @Volatile private var lastKnownId: String? = null
    @Volatile private var observerRegistered: Boolean = false

    // ── Register ContentObserver ──────────────────────────────────────────────
    @ReactMethod
    fun startObserving(promise: Promise) {
        if (observerRegistered) {
            promise.resolve(true)
            return
        }
        try {
            // Start background thread lazily — only when actually needed.
            val thread = HandlerThread("CallLogObserver").also { it.start() }
            val handler = Handler(thread.looper)
            observerThread  = thread
            observerHandler = handler

            // Create the observer with the background handler so onChange()
            // is called on the background thread — no main-thread DB work.
            val observer = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean, uri: Uri?) {
                    // Debounce: Android fires multiple callbacks per call end.
                    debounceRunnable?.let { handler.removeCallbacks(it) }
                    val r = Runnable { checkAndEmitNewCall() }
                    debounceRunnable = r
                    handler.postDelayed(r, DEBOUNCE_MS)
                }
            }
            callLogObserver = observer

            reactContext.contentResolver.registerContentObserver(
                CallLog.Calls.CONTENT_URI,
                true,   // notifyForDescendants — catches all call-log changes
                observer
            )
            observerRegistered = true

            // Seed lastKnownId on background thread so the first onChange
            // doesn't fire for calls that already existed before we started.
            handler.post { seedLastKnownId() }

            Log.i(TAG, "[CALL_LOG_OBSERVER_EVENT] registered on CallLog.Calls.CONTENT_URI ts=${System.currentTimeMillis()}")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "[CALL_LOG_OBSERVER_EVENT] registration failed: ${e.message}")
            promise.resolve(false)
        }
    }

    // ── Unregister ContentObserver ────────────────────────────────────────────
    @ReactMethod
    fun stopObserving(promise: Promise) {
        unregisterObserver()
        promise.resolve(true)
    }

    private fun unregisterObserver() {
        val observer = callLogObserver
        if (observerRegistered && observer != null) {
            try {
                reactContext.contentResolver.unregisterContentObserver(observer)
                Log.i(TAG, "[CALL_LOG_OBSERVER_EVENT] unregistered ts=${System.currentTimeMillis()}")
            } catch (e: Exception) {
                Log.w(TAG, "[CALL_LOG_OBSERVER_EVENT] unregister error: ${e.message}")
            }
            observerRegistered = false
        }
        debounceRunnable?.let { observerHandler?.removeCallbacks(it) }
        debounceRunnable = null
        callLogObserver  = null
        observerThread?.quitSafely()
        observerThread  = null
        observerHandler = null
    }

    // ── Seed lastKnownId — runs on background thread ──────────────────────────
    private fun seedLastKnownId() {
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG)
            != PackageManager.PERMISSION_GRANTED) return
        try {
            val cursor: Cursor? = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                null, null,
                "${CallLog.Calls.DATE} DESC"
            )
            cursor?.use {
                if (it.moveToFirst()) {
                    val idx = it.getColumnIndex(CallLog.Calls._ID)
                    if (idx >= 0) {
                        lastKnownId = it.getString(idx)
                        Log.d(TAG, "[CALL_LOG_OBSERVER_EVENT] seeded lastKnownId=$lastKnownId")
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[CALL_LOG_OBSERVER_EVENT] seedLastKnownId error: ${e.message}")
        }
    }

    // ── Check for a genuinely new call log row — runs on background thread ────
    private fun checkAndEmitNewCall() {
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG)
            != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "[CALL_LOG_OBSERVER_EVENT] READ_CALL_LOG not granted — skipping")
            return
        }
        try {
            Log.d(TAG, "[CALL_LOG_QUERY_STARTED] querying latest entry ts=${System.currentTimeMillis()}")
            val cursor: Cursor? = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                ),
                null, null,
                "${CallLog.Calls.DATE} DESC"
            )
            cursor?.use {
                if (it.moveToFirst()) {
                    val idIdx  = it.getColumnIndex(CallLog.Calls._ID)
                    val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                    val typIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                    val datIdx = it.getColumnIndex(CallLog.Calls.DATE)
                    val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)

                    // Guard every index — missing columns must not crash
                    val latestId = if (idIdx  >= 0) it.getString(idIdx)  else null
                    val number   = if (numIdx >= 0) it.getString(numIdx) ?: "unknown" else "unknown"
                    val callType = if (typIdx >= 0) it.getInt(typIdx)    else 0
                    val callDate = if (datIdx >= 0) it.getLong(datIdx)   else 0L
                    val duration = if (durIdx >= 0) it.getInt(durIdx)    else 0

                    if (latestId != null && latestId != lastKnownId) {
                        lastKnownId = latestId
                        Log.i(TAG,
                            "[CALL_LOG_DETECTED] id=$latestId type=$callType " +
                            "date=$callDate dur=${duration}s num=***${number.takeLast(4)} " +
                            "ts=${System.currentTimeMillis()}"
                        )
                        emitEvent(EVENT_NAME, latestId)
                    } else {
                        Log.d(TAG, "[CALL_LOG_OBSERVER_EVENT] no new entry (latest=$latestId known=$lastKnownId)")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[CALL_LOG_QUERY_STARTED] query error: ${e.message}")
        }
    }

    // ── Emit event to React Native JS ─────────────────────────────────────────
    private fun emitEvent(eventName: String, data: String) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, data)
            Log.i(TAG, "[CALL_LOG_QUEUED] emitted '$eventName' data=$data ts=${System.currentTimeMillis()}")
        } catch (e: Exception) {
            Log.e(TAG, "[CALL_LOG_QUEUED] emit failed: ${e.message}")
        }
    }

    // ── Required for RN event emitter (Old + New Architecture) ───────────────
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── Query call logs since timestamp ───────────────────────────────────────
    @ReactMethod
    fun getCallLogsSince(sinceMs: Double, promise: Promise) {
        try {
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_CALL_LOG)
                != PackageManager.PERMISSION_GRANTED) {
                val result = Arguments.createMap()
                result.putBoolean("success", false)
                result.putString("error", "READ_CALL_LOG permission not granted")
                result.putArray("records", Arguments.createArray())
                promise.resolve(result)
                return
            }

            val records = Arguments.createArray()
            val projection = arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.PHONE_ACCOUNT_ID,
            )

            val cursor: Cursor? = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(sinceMs.toLong().toString()),
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                val idIdx    = it.getColumnIndex(CallLog.Calls._ID)
                val numIdx   = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx  = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx  = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx  = it.getColumnIndex(CallLog.Calls.DATE)
                val durIdx   = it.getColumnIndex(CallLog.Calls.DURATION)
                val subIdx   = it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)

                while (it.moveToNext()) {
                    val map = Arguments.createMap()
                    map.putString("id",             if (idIdx    >= 0) it.getString(idIdx)    else null)
                    map.putString("number",         if (numIdx   >= 0) it.getString(numIdx)   else null)
                    map.putString("name",           if (nameIdx  >= 0) it.getString(nameIdx)  else null)
                    map.putInt   ("type",           if (typeIdx  >= 0) it.getInt(typeIdx)     else 0)
                    map.putString("date",           if (dateIdx  >= 0) it.getString(dateIdx)  else null)
                    map.putInt   ("duration",       if (durIdx   >= 0) it.getInt(durIdx)      else 0)
                    val phoneAccountId = if (subIdx >= 0) it.getString(subIdx) else null
                    map.putString("phoneAccountId", phoneAccountId)
                    // PHONE_ACCOUNT_ID is OEM-defined. Expose it as a subscription
                    // ID only when it has Android's normal numeric subscription shape.
                    map.putString(
                        "subscriptionId",
                        phoneAccountId?.takeIf { value -> value.all(Char::isDigit) },
                    )
                    records.pushMap(map)
                }
            }

            val result = Arguments.createMap()
            result.putBoolean("success", true)
            result.putArray("records", records)
            promise.resolve(result)
        } catch (e: Exception) {
            val result = Arguments.createMap()
            result.putBoolean("success", false)
            result.putString("error", e.message ?: "Unknown error")
            result.putArray("records", Arguments.createArray())
            promise.resolve(result)
        }
    }

    @ReactMethod
    fun getCallLog(limitDays: Double, promise: Promise) {
        val sinceMs = System.currentTimeMillis() - (limitDays * 24 * 60 * 60 * 1000).toLong()
        getCallLogsSince(sinceMs.toDouble(), promise)
    }

    @ReactMethod
    fun checkPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    // ── Module teardown ───────────────────────────────────────────────────────
    override fun invalidate() {
        super.invalidate()
        unregisterObserver()
    }
}
