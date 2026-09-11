package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

/**
 * SimModule.kt
 *
 * Native Android SIM inventory reader using SubscriptionManager as the PRIMARY source.
 *
 * Key principle:
 *   simSlotIndex  → physical SIM slot (0 = SIM 1, 1 = SIM 2)
 *   subscriptionId → Android subscription identity (e.g. 31, 32)
 *   These two values are NEVER mixed.
 *
 * Exposed methods:
 *   getSimInventory()     → { success, sims[], source, error? }
 *   checkSimPermission()  → { READ_PHONE_STATE, READ_PHONE_NUMBERS, apiLevel, manufacturer, model }
 *   getSimCount()         → { count, apiLevel }
 */
class SimModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SimModule"

    // ── Network type constant → label ─────────────────────────────────────────
    private fun mapNetworkType(type: Int): String = when (type) {
        TelephonyManager.NETWORK_TYPE_GPRS,
        TelephonyManager.NETWORK_TYPE_EDGE,
        TelephonyManager.NETWORK_TYPE_CDMA,
        TelephonyManager.NETWORK_TYPE_1xRTT,
        TelephonyManager.NETWORK_TYPE_IDEN,
        TelephonyManager.NETWORK_TYPE_GSM -> "2G"

        TelephonyManager.NETWORK_TYPE_UMTS,
        TelephonyManager.NETWORK_TYPE_EVDO_0,
        TelephonyManager.NETWORK_TYPE_EVDO_A,
        TelephonyManager.NETWORK_TYPE_HSDPA,
        TelephonyManager.NETWORK_TYPE_HSUPA,
        TelephonyManager.NETWORK_TYPE_HSPA,
        TelephonyManager.NETWORK_TYPE_EVDO_B,
        TelephonyManager.NETWORK_TYPE_EHRPD,
        TelephonyManager.NETWORK_TYPE_HSPAP,
        TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "3G"

        TelephonyManager.NETWORK_TYPE_LTE,
        TelephonyManager.NETWORK_TYPE_IWLAN -> "4G"

        TelephonyManager.NETWORK_TYPE_NR -> "5G"

        else -> "UNKNOWN"
    }

    // ── Permission helpers ────────────────────────────────────────────────────
    private fun hasPhoneState(): Boolean =
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_PHONE_STATE) ==
                PackageManager.PERMISSION_GRANTED

    private fun hasPhoneNumbers(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        return ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.READ_PHONE_NUMBERS
        ) == PackageManager.PERMISSION_GRANTED
    }

    // ── Read phone number for a subscription ─────────────────────────────────
    private fun readPhoneNumber(subInfo: SubscriptionInfo, subManager: SubscriptionManager): String? {
        // Try SubscriptionInfo.number first (API 22+)
        try {
            val n = subInfo.number
            if (!n.isNullOrBlank() && n != "Unknown") return n
        } catch (_: Exception) {}

        // Try TelephonyManager.getLine1Number for this subscription (API 24+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                val tm = reactContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                        as? TelephonyManager
                val tmSub = tm?.createForSubscriptionId(subInfo.subscriptionId)
                val n = tmSub?.line1Number
                if (!n.isNullOrBlank() && n != "Unknown") return n
            } catch (_: Exception) {}
        }

        return null
    }

    // ── Read network type for a subscription ─────────────────────────────────
    private fun readNetworkType(subscriptionId: Int): String {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                val tm = reactContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                        as? TelephonyManager
                val tmSub = tm?.createForSubscriptionId(subscriptionId)
                mapNetworkType(tmSub?.networkType ?: TelephonyManager.NETWORK_TYPE_UNKNOWN)
            } else {
                val tm = reactContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                        as? TelephonyManager
                mapNetworkType(tm?.networkType ?: TelephonyManager.NETWORK_TYPE_UNKNOWN)
            }
        } catch (_: Exception) { "UNKNOWN" }
    }

    // ── Build one SIM map from SubscriptionInfo ───────────────────────────────
    private fun buildSimMap(subInfo: SubscriptionInfo, subManager: SubscriptionManager): WritableMap {
        val map = Arguments.createMap()

        // Physical slot — this is the ONLY source for slot number
        val slot = subInfo.simSlotIndex          // 0-indexed physical slot
        map.putInt("slot", slot)
        map.putInt("display_slot", slot + 1)     // 1-indexed for display

        // Subscription identity — NEVER used as slot
        map.putInt("subscription_id", subInfo.subscriptionId)

        // Carrier info
        val carrierName = subInfo.carrierName?.toString()?.takeIf { it.isNotBlank() }
        val displayName = subInfo.displayName?.toString()?.takeIf { it.isNotBlank() }
        map.putString("carrier_name", carrierName)
        map.putString("display_name", displayName)

        // Phone number — null if unavailable (carrier restriction is normal)
        val phoneNumber = readPhoneNumber(subInfo, subManager)
        map.putString("phone_number", phoneNumber)

        // Country / MCC / MNC
        val countryIso = subInfo.countryIso?.takeIf { it.isNotBlank() }
        map.putString("country_iso", countryIso)

        val mccMnc = subInfo.mccString ?: ""   // API 29+
        val mcc: String?
        val mnc: String?
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && subInfo.mccString != null) {
            mcc = subInfo.mccString
            mnc = subInfo.mncString
        } else {
            // Fallback: parse from mcc+mnc int (deprecated but available pre-Q)
            @Suppress("DEPRECATION")
            val mccInt = subInfo.mcc
            @Suppress("DEPRECATION")
            val mncInt = subInfo.mnc
            mcc = if (mccInt > 0) mccInt.toString() else null
            mnc = if (mncInt >= 0) mncInt.toString() else null
        }
        map.putString("mcc", mcc)
        map.putString("mnc", mnc)

        // Network type (per-subscription)
        map.putString("network_type", readNetworkType(subInfo.subscriptionId))

        // Active state
        val isActive = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                subManager.getActiveSubscriptionInfo(subInfo.subscriptionId) != null
            } catch (_: Exception) { true }
        } else { true }
        map.putBoolean("is_active", isActive)

        // Embedded (eSIM)
        val isEmbedded = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try { subInfo.isEmbedded } catch (_: Exception) { false }
        } else { false }
        map.putBoolean("is_embedded", isEmbedded)

        // Card ID (API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try { map.putInt("card_id", subInfo.cardId) } catch (_: Exception) { map.putNull("card_id") }
        } else { map.putNull("card_id") }

        // Carrier ID (API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try { map.putInt("carrier_id", subInfo.carrierId) } catch (_: Exception) { map.putNull("carrier_id") }
        } else { map.putNull("carrier_id") }

        // Data roaming
        val dataRoaming = try { subInfo.dataRoaming == SubscriptionManager.DATA_ROAMING_ENABLE } catch (_: Exception) { false }
        map.putBoolean("data_roaming", dataRoaming)

        // ICC ID (requires READ_PHONE_STATE; may be null on some OEMs)
        val iccId = try { subInfo.iccId?.takeIf { it.isNotBlank() } } catch (_: Exception) { null }
        map.putString("icc_id", iccId)

        return map
    }

    // ── getSimInventory ───────────────────────────────────────────────────────
    @ReactMethod
    fun getSimInventory(promise: Promise) {
        val result = Arguments.createMap()
        val apiLevel = Build.VERSION.SDK_INT
        val manufacturer = Build.MANUFACTURER ?: "unknown"
        val model = Build.MODEL ?: "unknown"

        // Require READ_PHONE_STATE
        if (!hasPhoneState()) {
            result.putBoolean("success", false)
            result.putArray("sims", Arguments.createArray())
            result.putString("source", "none")
            result.putString("error", "SIM_READ_ERROR: READ_PHONE_STATE not granted")
            result.putString("error_code", "PERMISSION_DENIED")
            result.putInt("api_level", apiLevel)
            result.putString("manufacturer", manufacturer)
            result.putString("model", model)
            promise.resolve(result)
            return
        }

        try {
            val subManager = reactContext.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                    as? SubscriptionManager

            if (subManager == null) {
                result.putBoolean("success", false)
                result.putArray("sims", Arguments.createArray())
                result.putString("source", "none")
                result.putString("error", "SIM_READ_ERROR: SubscriptionManager unavailable (API $apiLevel)")
                result.putString("error_code", "SUBSCRIPTION_MANAGER_NULL")
                result.putInt("api_level", apiLevel)
                result.putString("manufacturer", manufacturer)
                result.putString("model", model)
                promise.resolve(result)
                return
            }

            val activeList: List<SubscriptionInfo>? = try {
                subManager.activeSubscriptionInfoList
            } catch (e: Exception) {
                result.putBoolean("success", false)
                result.putArray("sims", Arguments.createArray())
                result.putString("source", "none")
                result.putString("error", "SIM_READ_ERROR: ${e.message} | API=$apiLevel | $manufacturer $model")
                result.putString("error_code", "SUBSCRIPTION_LIST_EXCEPTION")
                result.putInt("api_level", apiLevel)
                result.putString("manufacturer", manufacturer)
                result.putString("model", model)
                promise.resolve(result)
                return
            }

            if (activeList.isNullOrEmpty()) {
                result.putBoolean("success", true)
                result.putArray("sims", Arguments.createArray())
                result.putString("source", "android_subscription_manager")
                result.putString("error", null)
                result.putInt("api_level", apiLevel)
                result.putString("manufacturer", manufacturer)
                result.putString("model", model)
                promise.resolve(result)
                return
            }

            val simsArray = Arguments.createArray()
            for (subInfo in activeList) {
                simsArray.pushMap(buildSimMap(subInfo, subManager))
            }

            result.putBoolean("success", true)
            result.putArray("sims", simsArray)
            result.putString("source", "android_subscription_manager")
            result.putNull("error")
            result.putInt("api_level", apiLevel)
            result.putString("manufacturer", manufacturer)
            result.putString("model", model)
            promise.resolve(result)

        } catch (e: Exception) {
            result.putBoolean("success", false)
            result.putArray("sims", Arguments.createArray())
            result.putString("source", "none")
            result.putString("error", "SIM_READ_ERROR: ${e.message} | API=$apiLevel | $manufacturer $model")
            result.putString("error_code", "UNEXPECTED_EXCEPTION")
            result.putInt("api_level", apiLevel)
            result.putString("manufacturer", manufacturer)
            result.putString("model", model)
            promise.resolve(result)
        }
    }

    // ── checkSimPermission ────────────────────────────────────────────────────
    @ReactMethod
    fun checkSimPermission(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("READ_PHONE_STATE", hasPhoneState())
        map.putBoolean("READ_PHONE_NUMBERS", hasPhoneNumbers())
        map.putInt("api_level", Build.VERSION.SDK_INT)
        map.putString("manufacturer", Build.MANUFACTURER ?: "unknown")
        map.putString("model", Build.MODEL ?: "unknown")
        promise.resolve(map)
    }

    // ── getSimCount ───────────────────────────────────────────────────────────
    @ReactMethod
    fun getSimCount(promise: Promise) {
        val map = Arguments.createMap()
        map.putInt("api_level", Build.VERSION.SDK_INT)
        if (!hasPhoneState()) {
            map.putInt("count", -1)
            map.putString("error", "READ_PHONE_STATE not granted")
            promise.resolve(map)
            return
        }
        try {
            val subManager = reactContext.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                    as? SubscriptionManager
            val count = subManager?.activeSubscriptionInfoList?.size ?: -1
            map.putInt("count", count)
        } catch (e: Exception) {
            map.putInt("count", -1)
            map.putString("error", e.message)
        }
        promise.resolve(map)
    }
}
