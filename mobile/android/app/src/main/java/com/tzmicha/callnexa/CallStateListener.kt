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
        private const val TAG = "CALLNEXA_NATIVE.CallStateListener"
    }

    private val telephonyManager: TelephonyManager =
        reactContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

    private var isCallActive = false
    private var currentPhoneNumber: String? = null
    private var telephonyCallback: Any? = null  // Holds callback or listener reference
    private var isListening = false

    // ── Start Monitoring ──────────────────────────────────────────────────────

    fun startListening() {
        if (isListening) {
            android.util.Log.w(TAG, "Already listening, skipping duplicate registration")
            return
        }
        
        android.util.Log.i(TAG, "Starting call state monitoring...")
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ (API 31+): Use TelephonyCallback
            val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) {
                    handleCallStateChange(state)
                }
            }
            telephonyCallback = callback
            telephonyManager.registerTelephonyCallback(
                reactContext.mainExecutor,
                callback
            )
            android.util.Log.i(TAG, "Registered TelephonyCallback (API 31+)")
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
            telephonyCallback = listener
            @Suppress("DEPRECATION")
            telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            android.util.Log.i(TAG, "Registered PhoneStateListener (API < 31)")
        }

        isListening = true
        android.util.Log.i(TAG, "✅ Call state monitoring started successfully")
    }
    
    // ── Stop Monitoring ───────────────────────────────────────────────────────
    
    fun stopListening() {
        if (!isListening) {
            return
        }
        
        android.util.Log.i(TAG, "Stopping call state monitoring...")
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (telephonyCallback as? TelephonyCallback)?.let {
                    telephonyManager.unregisterTelephonyCallback(it)
                }
            } else {
                @Suppress("DEPRECATION")
                (telephonyCallback as? PhoneStateListener)?.let {
                    telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
                }
            }
            android.util.Log.i(TAG, "✅ Call state monitoring stopped")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error stopping listener: ${e.message}", e)
        }
        
        telephonyCallback = null
        isListening = false
    }

    // ── Handle Call State Changes ─────────────────────────────────────────────

    private fun handleCallStateChange(state: Int) {
        android.util.Log.d(TAG, "Call state changed: $state")
        
        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                // Incoming call ringing
                android.util.Log.i(TAG, "📞 Call state: RINGING")
                emitEvent("callStateChanged", Arguments.createMap().apply {
                    putString("state", "ringing")
                    putString("phoneNumber", currentPhoneNumber)
                })
            }

            TelephonyManager.CALL_STATE_OFFHOOK -> {
                // Call active (answered or outgoing)
                if (!isCallActive) {
                    isCallActive = true
                    android.util.Log.i(TAG, "🟢 Call state: OFFHOOK (call started) - phone: ${currentPhoneNumber ?: "unknown"}")
                    
                    // Emit event to start recording
                    val eventData = Arguments.createMap().apply {
                        putString("phoneNumber", currentPhoneNumber ?: "unknown")
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    }
                    emitEvent("callStarted", eventData)
                    android.util.Log.i(TAG, "📤 Emitted 'callStarted' event to JavaScript")
                }
            }

            TelephonyManager.CALL_STATE_IDLE -> {
                // Call ended
                if (isCallActive) {
                    isCallActive = false
                    android.util.Log.i(TAG, "🔴 Call state: IDLE (call ended)")
                    
                    // Emit event to stop recording
                    val eventData = Arguments.createMap().apply {
                        putString("phoneNumber", currentPhoneNumber)
                        putDouble("timestamp", System.currentTimeMillis().toDouble())
                    }
                    emitEvent("callEnded", eventData)
                    android.util.Log.i(TAG, "📤 Emitted 'callEnded' event to JavaScript")
                    
                    currentPhoneNumber = null
                }
            }
        }
    }

    // ── Emit Event to React Native ────────────────────────────────────────────

    private fun emitEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
            android.util.Log.d(TAG, "Event '$eventName' emitted successfully")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ Failed to emit event $eventName: ${e.message}", e)
        }
    }
}
