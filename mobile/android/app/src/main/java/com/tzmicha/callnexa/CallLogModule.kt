package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.CallLog
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class CallLogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "CallLogModule"

    // Called by nativeModules.js as _NativeCallLog.getCallLogsSince(sinceMs)
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
                "subscription_id",  // Android 5.1+ SUBSCRIPTION_ID column
            )

            val cursor: Cursor? = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(sinceMs.toLong().toString()),
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                val idIdx     = it.getColumnIndex(CallLog.Calls._ID)
                val numIdx    = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx   = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx   = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx   = it.getColumnIndex(CallLog.Calls.DATE)
                val durIdx    = it.getColumnIndex(CallLog.Calls.DURATION)
                val subIdx    = it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
                val subIdIdx  = it.getColumnIndex("subscription_id")

                while (it.moveToNext()) {
                    val map = Arguments.createMap()
                    map.putString("id",             if (idIdx   >= 0) it.getString(idIdx)   else null)
                    map.putString("number",         if (numIdx  >= 0) it.getString(numIdx)  else null)
                    map.putString("name",           if (nameIdx >= 0) it.getString(nameIdx) else null)
                    map.putInt   ("type",           if (typeIdx >= 0) it.getInt(typeIdx)    else 0)
                    map.putString("date",           if (dateIdx >= 0) it.getString(dateIdx) else null)
                    map.putInt   ("duration",       if (durIdx  >= 0) it.getInt(durIdx)     else 0)
                    map.putString("phoneAccountId", if (subIdx  >= 0) it.getString(subIdx)  else null)
                    // SUBSCRIPTION_ID: the Android subscription identity for this call
                    // This is the primary key for SIM identification — never use as slot
                    val rawSubId = if (subIdIdx >= 0) it.getString(subIdIdx) else null
                    map.putString("subscriptionId", rawSubId)
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

    // Legacy method kept for compatibility
    @ReactMethod
    fun getCallLog(limitDays: Double, promise: Promise) {
        val sinceMs = System.currentTimeMillis() - (limitDays * 24 * 60 * 60 * 1000).toLong()
        getCallLogsSince(sinceMs.toDouble(), promise)
    }
}
