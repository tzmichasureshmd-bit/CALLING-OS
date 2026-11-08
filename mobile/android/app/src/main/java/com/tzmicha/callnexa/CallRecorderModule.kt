package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * CallRecorderModule.kt
 *
 * Records all incoming and outgoing calls automatically.
 * Saves recordings to device storage and exposes methods to the React Native layer.
 *
 * Features:
 *   - Auto-record all calls (no user interaction needed)
 *   - Save as .m4a files in app-specific directory
 *   - Emit recording start/stop events to JS layer
 *   - Return recording file path for upload to Supabase
 */
class CallRecorderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CALLNEXA_NATIVE.CallRecorderModule"
        // Use MIC instead of VOICE_CALL - VOICE_CALL is blocked on most devices (Vivo, Samsung, etc.)
        // MIC records from microphone, works best with speakerphone
        private const val AUDIO_SOURCE = MediaRecorder.AudioSource.MIC
        private const val OUTPUT_FORMAT = MediaRecorder.OutputFormat.MPEG_4
        private const val AUDIO_ENCODER = MediaRecorder.AudioEncoder.AAC
    }

    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var currentRecordingPath: String? = null
    private var currentPhoneNumber: String? = null
    
    // ── CallStateListener for automatic recording ────────────────────────────
    private var callStateListener: CallStateListener? = null

    override fun getName() = "CallRecorderModule"
    
    // ── Module Lifecycle: Initialize ──────────────────────────────────────────
    override fun initialize() {
        super.initialize()
        android.util.Log.i(TAG, "Module initialized - ReactContext is ready")
        
        // Initialize CallStateListener with the module's ReactApplicationContext
        try {
            callStateListener = CallStateListener(reactContext)
            callStateListener?.startListening()
            android.util.Log.i(TAG, "✅ CallStateListener initialized and started successfully")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ Failed to initialize CallStateListener: ${e.message}", e)
        }
    }
    
    // ── Module Lifecycle: Cleanup ─────────────────────────────────────────────
    override fun invalidate() {
        android.util.Log.i(TAG, "Module invalidating - cleaning up")
        
        // Stop any active recording
        if (isRecording) {
            try {
                mediaRecorder?.stop()
                mediaRecorder?.release()
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error stopping recorder during cleanup: ${e.message}")
            }
            mediaRecorder = null
            isRecording = false
        }
        
        // Clean up CallStateListener
        callStateListener?.stopListening()
        callStateListener = null
        
        super.invalidate()
    }

    // ── Permission Check ──────────────────────────────────────────────────────

    private fun hasRecordingPermissions(): Boolean {
        val audioPermission = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val phoneStatePermission = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        return audioPermission && phoneStatePermission
    }

    // ── Check Permissions ────────────────────────────────────────────────────

    @ReactMethod
    fun checkRecordingPermissions(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("recordAudioGranted", ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED)
        map.putBoolean("phoneStateGranted", ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED)
        map.putInt("apiLevel", Build.VERSION.SDK_INT)
        promise.resolve(map)
    }

    // ── Start Recording ───────────────────────────────────────────────────────

    @ReactMethod
    fun startRecording(phoneNumber: String, promise: Promise) {
        try {
            if (isRecording) {
                promise.reject("ALREADY_RECORDING", "Recording already in progress")
                return
            }

            if (!hasRecordingPermissions()) {
                promise.reject("PERMISSION_DENIED", "Missing RECORD_AUDIO or READ_PHONE_STATE permission")
                return
            }

            // Create recordings directory in public Music folder (accessible to all apps)
            val recordingsDir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                "Call Recordings"
            )
            if (!recordingsDir.exists()) {
                recordingsDir.mkdirs()
            }

            // Generate filename: YYYYMMDD_HHMMSS_phoneNumber.m4a
            val dateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
            val timestamp = dateFormat.format(Date())
            val sanitizedPhone = phoneNumber.replace(Regex("[^0-9]"), "").takeLast(10)
            val filename = "${timestamp}_$sanitizedPhone.m4a"
            val filepath = File(recordingsDir, filename).absolutePath

            // Initialize MediaRecorder
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(AUDIO_SOURCE)
                setOutputFormat(OUTPUT_FORMAT)
                setAudioEncoder(AUDIO_ENCODER)
                setAudioSamplingRate(16000)
                setAudioEncodingBitRate(128000)
                setOutputFile(filepath)
                prepare()
                start()
            }

            isRecording = true
            currentRecordingPath = filepath
            currentPhoneNumber = phoneNumber

            // Emit event to JS layer
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("callRecordingStarted", Arguments.createMap().apply {
                    putString("filepath", filepath)
                    putString("phoneNumber", phoneNumber)
                    putString("timestamp", timestamp)
                })

            promise.resolve(Arguments.createMap().apply {
                putString("filepath", filepath)
                putBoolean("success", true)
            })
        } catch (e: Exception) {
            promise.reject("RECORDING_ERROR", "Failed to start recording: ${e.message}")
        }
    }

    // ── Stop Recording ────────────────────────────────────────────────────────

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            if (!isRecording || mediaRecorder == null) {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("success", false)
                    putString("error", "No recording in progress")
                })
                return
            }

            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            isRecording = false

            val filepath = currentRecordingPath
            val phoneNumber = currentPhoneNumber

            // Emit event to JS layer
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("callRecordingStopped", Arguments.createMap().apply {
                    putString("filepath", filepath)
                    putString("phoneNumber", phoneNumber)
                })

            currentRecordingPath = null
            currentPhoneNumber = null

            promise.resolve(Arguments.createMap().apply {
                putString("filepath", filepath)
                putBoolean("success", true)
            })
        } catch (e: Exception) {
            isRecording = false
            mediaRecorder = null
            promise.reject("RECORDING_ERROR", "Failed to stop recording: ${e.message}")
        }
    }

    // ── Get Recording Status ──────────────────────────────────────────────────

    @ReactMethod
    fun getRecordingStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("isRecording", isRecording)
            putString("currentFilepath", currentRecordingPath)
            putString("currentPhoneNumber", currentPhoneNumber)
        })
    }

    // ── Get Recent Recordings ─────────────────────────────────────────────────

    @ReactMethod
    fun getRecentRecordings(maxResults: Int, promise: Promise) {
        try {
            val recordingsDir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                "Call Recordings"
            )

            if (!recordingsDir.exists()) {
                promise.resolve(Arguments.createArray())
                return
            }

            val recordings = recordingsDir.listFiles()
                ?.filter { it.isFile && it.extension == "m4a" }
                ?.sortedByDescending { it.lastModified() }
                ?.take(maxResults)
                ?.map { file ->
                    Arguments.createMap().apply {
                        putString("filepath", file.absolutePath)
                        putString("filename", file.name)
                        putDouble("sizeBytes", file.length().toDouble())
                        putDouble("lastModified", file.lastModified().toDouble())
                    }
                } ?: emptyList()

            val array = Arguments.createArray()
            recordings.forEach { array.pushMap(it as WritableMap) }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get recordings: ${e.message}")
        }
    }

    // ── Delete Recording ──────────────────────────────────────────────────────

    @ReactMethod
    fun deleteRecording(filepath: String, promise: Promise) {
        try {
            val file = File(filepath)
            if (file.exists() && file.delete()) {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("success", true)
                })
            } else {
                promise.reject("ERROR", "Failed to delete recording")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Error deleting recording: ${e.message}")
        }
    }
}
