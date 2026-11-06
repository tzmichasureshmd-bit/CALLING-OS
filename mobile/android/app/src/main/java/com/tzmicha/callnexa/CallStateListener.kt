package com.tzmicha.callnexa

import android.content.Context
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * CallStateListener.kt
 *
 * Monitors phone call state changes and triggers call recording automatically.
 * Supports both old PhoneStateListener (API <31) and new TelephonyCallback (API 31+).
 */
class CallStateListener(private val reactContext: ReactApplicationContext) {

    companion object {
        private const val TAG = "CallNexa.CallStateListener"
    }

    private val telephonyManager: TelephonyManager =
        reactContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

    private var isCallActive = false
    private var currentPhoneNumber: String? = null

    // ── Start Monitoring ──────────────────────────────────────────────────────

    fun startListening() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ (API 31+): Use TelephonyCallback
            val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) {
                    handleCallStateChange(state)
                }
            }
            telephonyManager.registerTelephonyCallback(
                reactContext.mainExecutor,
                callback
            )
        } else {
            // Android 11 and below: Use PhoneStateListener
            @Suppress("DEPRECATION")
            val listener = object : PhoneStateListener() {
                @Deprecated("Deprecated in API 31")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    currentPhoneNumber = phoneNumber
                    handleCallStateChange(state)
                }
            }
            @Suppress("DEPRECATION")
            telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        }

        Log.i(TAG, "Call state monitoring started")
    }

    // ── Handle Call State Changes ─────────────────────────────────────────────

    private fun handleCallStateChange(state: Int) {
        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                // Incoming call ringing
                Log.i(TAG, "Call state: RINGING")
                emitEvent("callStateChanged", Arguments.createMap().apply {
                    putString("state", "ringing")
                    putString("phoneNumber", currentPhoneNumber)
                })
            }

            TelephonyManager.CALL_STATE_OFFHOOK -> {
                // Call active (answered or outgoing)
                if (!isCallActive) {
                    isCallActive = true
                    Log.i(TAG, "Call state: OFFHOOK (call started)")
                    
                    // Emit event to start recording
                    emitEvent("callStarted", Arguments.createMap().apply {
                        putString("phoneNumber", currentPhoneNumber ?: "unknown")
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    })
                }
            }

            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended
                if (isCallActive) {
                    isCallActive = false
                    Log.i(TAG, "Call state: IDLE (call ended)")
                    
                    // Emit event to stop recording
                    emitEvent("callEnded", Arguments.createMap().apply {
                        putString("phoneNumber", currentPhoneNumber)
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    })
                    
                    currentPhoneNumber = null
                }
            }
        }
    }

    // ── Emit Event to React Native ────────────────────────────────────────────

    private fun emitEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(eventName, params)
    }
}
