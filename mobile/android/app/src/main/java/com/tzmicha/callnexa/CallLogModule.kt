package com.tzmicha.callnexa

import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.CallLog
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class CallLogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallLogModule"

    // ── Permission check ──────────────────────────────────────────────────────
    @ReactMethod
    fun checkPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactContext,
            android.Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    // ── Query helpers ─────────────────────────────────────────────────────────

    private val PROJECTION = arrayOf(
        CallLog.Calls._ID,
        CallLog.Calls.NUMBER,
        CallLog.Calls.CACHED_NAME,
        CallLog.Calls.TYPE,
        CallLog.Calls.DATE,
        CallLog.Calls.DURATION,
        CallLog.Calls.NEW,
        CallLog.Calls.PHONE_ACCOUNT_ID,
        // Optional columns — handled safely
        "is_read",
        "voicemail_uri",
        "cached_number_type",
        "cached_number_label",
        "phone_account_component_name"
    )

    private fun mapType(type: Int): String = when (type) {
        CallLog.Calls.INCOMING_TYPE  -> "incoming"
        CallLog.Calls.OUTGOING_TYPE  -> "outgoing"
        CallLog.Calls.MISSED_TYPE    -> "missed"
        CallLog.Calls.REJECTED_TYPE  -> "rejected"
        CallLog.Calls.BLOCKED_TYPE   -> "blocked"
        CallLog.Calls.VOICEMAIL_TYPE -> "voicemail"
        else                         -> "unknown"
    }

    private fun safeGetString(cursor: Cursor, col: String): String? {
        return try {
            val idx = cursor.getColumnIndex(col)
            if (idx >= 0 && !cursor.isNull(idx)) cursor.getString(idx) else null
        } catch (_: Exception) { null }
    }

    private fun safeGetLong(cursor: Cursor, col: String): Long? {
        return try {
            val idx = cursor.getColumnIndex(col)
            if (idx >= 0 && !cursor.isNull(idx)) cursor.getLong(idx) else null
        } catch (_: Exception) { null }
    }

    private fun safeGetInt(cursor: Cursor, col: String): Int? {
        return try {
            val idx = cursor.getColumnIndex(col)
            if (idx >= 0 && !cursor.isNull(idx)) cursor.getInt(idx) else null
        } catch (_: Exception) { null }
    }

    private fun cursorToMap(cursor: Cursor): WritableMap {
        val map = Arguments.createMap()
        val id       = safeGetLong(cursor, CallLog.Calls._ID)
        val number   = safeGetString(cursor, CallLog.Calls.NUMBER)
        val name     = safeGetString(cursor, CallLog.Calls.CACHED_NAME)
        val typeInt  = safeGetInt(cursor, CallLog.Calls.TYPE) ?: 0
        val date     = safeGetLong(cursor, CallLog.Calls.DATE)
        val duration = safeGetLong(cursor, CallLog.Calls.DURATION)
        val isNew    = safeGetInt(cursor, CallLog.Calls.NEW)
        val accountId = safeGetString(cursor, CallLog.Calls.PHONE_ACCOUNT_ID)

        map.putString("id",              id?.toString())
        map.putString("number",          number ?: "")
        map.putString("name",            name ?: "")
        map.putInt   ("type",            typeInt)
        map.putString("typeName",        mapType(typeInt))
        map.putString("date",            date?.toString() ?: "0")
        map.putString("duration",        (duration ?: 0L).toString())
        map.putInt   ("new",             isNew ?: 0)
        map.putString("phoneAccountId",  accountId ?: "")

        // Optional fields — safe
        map.putString("isRead",          safeGetString(cursor, "is_read"))
        map.putString("voicemailUri",    safeGetString(cursor, "voicemail_uri"))
        map.putString("cachedNumberType",safeGetString(cursor, "cached_number_type"))
        map.putString("cachedNumberLabel",safeGetString(cursor, "cached_number_label"))
        map.putString("phoneAccountComponentName", safeGetString(cursor, "phone_account_component_name"))

        return map
    }

    // ── getCallLogs(sinceMs, limit) ───────────────────────────────────────────
    // Primary method. Queries CallLog.Calls.CONTENT_URI directly.
    // sinceMs = 0 means no date filter (get all).
    // limit = 0 means no limit.
    @ReactMethod
    fun getCallLogs(sinceMs: Double, limit: Int, promise: Promise) {
        if (ContextCompat.checkSelfPermission(
                reactContext, android.Manifest.permission.READ_CALL_LOG
            ) != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "READ_CALL_LOG permission not granted")
            return
        }

        try {
            val selection     = if (sinceMs > 0) "${CallLog.Calls.DATE} >= ?" else null
            val selectionArgs = if (sinceMs > 0) arrayOf(sinceMs.toLong().toString()) else null
            val sortOrder     = "${CallLog.Calls.DATE} DESC" + (if (limit > 0) " LIMIT $limit" else "")

            val cursor: Cursor? = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                null,          // null = all columns (safer than fixed projection on OEM devices)
                selection,
                selectionArgs,
                sortOrder
            )

            val results = Arguments.createArray()
            cursor?.use { c ->
                while (c.moveToNext()) {
                    results.pushMap(cursorToMap(c))
                }
            }

            val out = Arguments.createMap()
            out.putBoolean("success", true)
            out.putBoolean("permissionGranted", true)
            out.putInt("count", results.size())
            out.putArray("records", results)
            promise.resolve(out)

        } catch (e: Exception) {
            val out = Arguments.createMap()
            out.putBoolean("success", false)
            out.putBoolean("permissionGranted", true)
            out.putInt("count", 0)
            out.putArray("records", Arguments.createArray())
            out.putString("error", e.message ?: "Unknown error")
            promise.resolve(out)
        }
    }

    // ── getCallLogsSince(sinceMs) ─────────────────────────────────────────────
    @ReactMethod
    fun getCallLogsSince(sinceMs: Double, promise: Promise) {
        getCallLogs(sinceMs, 0, promise)
    }

    // ── getLatestCallLogs(limit) ──────────────────────────────────────────────
    @ReactMethod
    fun getLatestCallLogs(limit: Int, promise: Promise) {
        getCallLogs(0.0, limit, promise)
    }

    // ── getCallLogCount() ─────────────────────────────────────────────────────
    @ReactMethod
    fun getCallLogCount(promise: Promise) {
        if (ContextCompat.checkSelfPermission(
                reactContext, android.Manifest.permission.READ_CALL_LOG
            ) != PackageManager.PERMISSION_GRANTED) {
            promise.resolve(0)
            return
        }
        try {
            val cursor = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI, arrayOf(CallLog.Calls._ID),
                null, null, null
            )
            val count = cursor?.count ?: 0
            cursor?.close()
            promise.resolve(count)
        } catch (e: Exception) {
            promise.resolve(0)
        }
    }
}
