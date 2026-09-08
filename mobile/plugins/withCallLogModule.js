const { withDangerousMod } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

const CALL_LOG_MODULE_KT = `package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.provider.CallLog
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class CallLogModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "CallLogModule"

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
                CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION,
                CallLog.Calls.PHONE_ACCOUNT_ID,
            )
            val cursor: Cursor? = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI, projection,
                "\${CallLog.Calls.DATE} >= ?",
                arrayOf(sinceMs.toLong().toString()),
                "\${CallLog.Calls.DATE} DESC"
            )
            cursor?.use {
                val idIdx  = it.getColumnIndex(CallLog.Calls._ID)
                val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                val nameIdx= it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeIdx= it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx= it.getColumnIndex(CallLog.Calls.DATE)
                val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)
                val subIdx = it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
                while (it.moveToNext()) {
                    val map = Arguments.createMap()
                    map.putString("id",             if (idIdx  >= 0) it.getString(idIdx)  else null)
                    map.putString("number",         if (numIdx >= 0) it.getString(numIdx) else null)
                    map.putString("name",           if (nameIdx>= 0) it.getString(nameIdx)else null)
                    map.putInt   ("type",           if (typeIdx>= 0) it.getInt(typeIdx)   else 0)
                    map.putString("date",           if (dateIdx>= 0) it.getString(dateIdx)else null)
                    map.putInt   ("duration",       if (durIdx >= 0) it.getInt(durIdx)    else 0)
                    map.putString("phoneAccountId", if (subIdx >= 0) it.getString(subIdx) else null)
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
}`;

const CALL_LOG_PACKAGE_KT = `package com.tzmicha.callnexa

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CallLogPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(CallLogModule(reactContext))
    }
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}`;

function withCallLogModule(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const srcDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java/com/tzmicha/callnexa"
      );
      fs.mkdirSync(srcDir, { recursive: true });

      // Always write the Kotlin files — overwrite if exists
      fs.writeFileSync(path.join(srcDir, "CallLogModule.kt"),  CALL_LOG_MODULE_KT,  "utf8");
      fs.writeFileSync(path.join(srcDir, "CallLogPackage.kt"), CALL_LOG_PACKAGE_KT, "utf8");
      console.log("[withCallLogModule] CallLogModule.kt + CallLogPackage.kt written");

      // Patch MainApplication.kt
      const mainAppPath = path.join(srcDir, "MainApplication.kt");
      if (!fs.existsSync(mainAppPath)) {
        console.warn("[withCallLogModule] MainApplication.kt not found");
        return cfg;
      }
      let content = fs.readFileSync(mainAppPath, "utf8");
      if (!content.includes("import com.tzmicha.callnexa.CallLogPackage")) {
        content = content.replace(
          "package com.tzmicha.callnexa",
          "package com.tzmicha.callnexa\n\nimport com.tzmicha.callnexa.CallLogPackage"
        );
      }
      if (!content.includes("add(CallLogPackage())")) {
        content = content.replace(
          /PackageList\(this\)\.packages\.apply\s*\{([^}]*)\}/,
          (match, inner) => `PackageList(this).packages.apply {${inner}              add(CallLogPackage())\n            }`
        );
      }
      fs.writeFileSync(mainAppPath, content, "utf8");
      console.log("[withCallLogModule] CallLogPackage registered in MainApplication.kt");
      return cfg;
    },
  ]);
}

module.exports = withCallLogModule;
