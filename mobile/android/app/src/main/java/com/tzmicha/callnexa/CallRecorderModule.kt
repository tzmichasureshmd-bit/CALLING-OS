package com.tzmicha.callnexa

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
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
 *   - Save .m4a files in the public Music/Call Recordings folder
 *   - Emit recording start/stop events to JS layer
 *   - Return recording file path for upload to Supabase
 */
class CallRecorderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CALLNEXA_NATIVE.CallRecorderModule"
        private const val AUDIO_SOURCE_PRIMARY = MediaRecorder.AudioSource.VOICE_CALL
        private const val AUDIO_SOURCE_FALLBACK = MediaRecorder.AudioSource.MIC
        private const val OUTPUT_FORMAT = MediaRecorder.OutputFormat.MPEG_4
        private const val AUDIO_ENCODER = MediaRecorder.AudioEncoder.AAC

        /**
         * Probe whether VOICE_CALL source is usable on this device.
         * Creates a throwaway MediaRecorder, tries prepare(), then immediately
         * resets — no file is written. Returns true only if prepare() succeeds.
         */
        fun isVoiceCallSourceSupported(): Boolean {
            return try {
                val probe = MediaRecorder()
                probe.setAudioSource(MediaRecorder.AudioSource.VOICE_CALL)
                probe.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                probe.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                probe.setOutputFile("/dev/null")
                probe.prepare()
                probe.reset()
                probe.release()
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var currentRecordingPath: String? = null
    private var currentPhoneNumber: String? = null
    private var recordingUri: Uri? = null
    private var recordingDescriptor: ParcelFileDescriptor? = null
    private var legacyRecordingFile: File? = null

    override fun getName() = "CallRecorderModule"
    
    // ── Module Lifecycle: Cleanup ─────────────────────────────────────────────
    override fun invalidate() {
        if (isRecording) {
            try { mediaRecorder?.reset() } catch (_: Exception) {}
            try { mediaRecorder?.release() } catch (_: Exception) {}
            mediaRecorder = null
            isRecording = false
            closeDescriptor()
        }
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
        map.putString("manufacturer", Build.MANUFACTURER ?: "unknown")
        map.putString("model", Build.MODEL ?: "unknown")
        map.putBoolean("voiceCallSourceSupported", isVoiceCallSourceSupported())
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

            val dateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
            val timestamp = dateFormat.format(Date())
            val sanitizedPhone = phoneNumber.replace(Regex("[^0-9]"), "").takeLast(10)
            val filename = "${timestamp}_$sanitizedPhone.m4a"

            // Create recording destination — MediaStore on API 29+, legacy File below
            val outputFd: java.io.FileDescriptor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Audio.Media.DISPLAY_NAME, filename)
                    put(MediaStore.Audio.Media.MIME_TYPE, "audio/mp4")
                    put(MediaStore.Audio.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MUSIC}/Call Recordings")
                    put(MediaStore.Audio.Media.IS_PENDING, 1)
                }
                val uri = reactContext.contentResolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
                    ?: run { promise.reject("STORAGE_ERROR", "Could not create MediaStore entry"); return }
                recordingUri = uri
                val pfd = reactContext.contentResolver.openFileDescriptor(uri, "rwt")
                    ?: run { promise.reject("STORAGE_ERROR", "Could not open MediaStore file"); return }
                recordingDescriptor = pfd
                pfd.fileDescriptor
            } else {
                val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "Call Recordings")
                if (!dir.exists() && !dir.mkdirs()) { promise.reject("STORAGE_ERROR", "Could not create Music/Call Recordings"); return }
                val file = File(dir, filename)
                legacyRecordingFile = file
                currentRecordingPath = file.absolutePath
                val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE)
                recordingDescriptor = pfd
                pfd.fileDescriptor
            }

            // Try VOICE_CALL first if supported, fall back to MIC
            val sources = if (isVoiceCallSourceSupported()) {
                intArrayOf(AUDIO_SOURCE_PRIMARY, AUDIO_SOURCE_FALLBACK)
            } else {
                android.util.Log.i(TAG, "[RECORDER_VOICE_CALL_UNSUPPORTED] using MIC only")
                intArrayOf(AUDIO_SOURCE_FALLBACK)
            }
            var recordingStarted = false
            var lastError: String? = null
            for (source in sources) {
                try {
                    mediaRecorder = MediaRecorder().apply {
                        setAudioSource(source)
                        setOutputFormat(OUTPUT_FORMAT)
                        setAudioEncoder(AUDIO_ENCODER)
                        setAudioSamplingRate(16000)
                        setAudioEncodingBitRate(128000)
                        setOutputFile(outputFd)
                        prepare()
                        start()
                    }
                    recordingStarted = true
                    android.util.Log.i(TAG, "✅ Recording started source=${if (source == AUDIO_SOURCE_PRIMARY) "VOICE_CALL" else "MIC"} file=$filename")
                    break
                } catch (e: Exception) {
                    lastError = e.message
                    android.util.Log.w(TAG, "⚠️ source=$source failed: ${e.message}")
                    try { mediaRecorder?.release() } catch (_: Exception) {}
                    mediaRecorder = null
                }
            }

            if (!recordingStarted) {
                closeDescriptor()
                cleanupDestination()
                promise.reject("RECORDING_ERROR", "Both VOICE_CALL and MIC failed: $lastError")
                return
            }

            isRecording = true
            currentPhoneNumber = phoneNumber
            // For API 29+ the path is resolved after publishing; use filename as reference
            if (currentRecordingPath == null) currentRecordingPath = filename

            // Emit event to JS layer
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("callRecordingStarted", Arguments.createMap().apply {
                    putString("filepath", currentRecordingPath)
                    putString("phoneNumber", phoneNumber)
                    putString("timestamp", timestamp)
                })

            promise.resolve(Arguments.createMap().apply {
                putString("filepath", currentRecordingPath)
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

            // Guard against stop() throwing on very short / empty recordings
            try {
                mediaRecorder?.stop()
            } catch (e: Exception) {
                android.util.Log.w(TAG, "stop() threw — resetting: ${e.message}")
                try { mediaRecorder?.reset() } catch (_: Exception) {}
            }
            try { mediaRecorder?.release() } catch (_: Exception) {}
            mediaRecorder = null
            isRecording = false

            // Publish to MediaStore (API 29+) or scan legacy file
            val filepath = currentRecordingPath
            recordingUri?.let { uri ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Audio.Media.IS_PENDING, 0)
                        put(MediaStore.Audio.Media.DATE_MODIFIED, System.currentTimeMillis() / 1000)
                    }
                    try { reactContext.contentResolver.update(uri, values, null, null) } catch (_: Exception) {}
                }
            }
            closeDescriptor()
            legacyRecordingFile?.let { file ->
                try { MediaScannerConnection.scanFile(reactContext, arrayOf(file.absolutePath), arrayOf("audio/mp4"), null) } catch (_: Exception) {}
            }

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
            recordingUri = null
            legacyRecordingFile = null

            promise.resolve(Arguments.createMap().apply {
                putString("filepath", filepath)
                putBoolean("success", true)
            })
        } catch (e: Exception) {
            isRecording = false
            try { mediaRecorder?.release() } catch (_: Exception) {}
            mediaRecorder = null
            closeDescriptor()
            promise.reject("RECORDING_ERROR", "Failed to stop recording: ${e.message}")
        }
    }

    private fun closeDescriptor() {
        try { recordingDescriptor?.close() } catch (_: Exception) {}
        recordingDescriptor = null
    }

    private fun cleanupDestination() {
        recordingUri?.let { try { reactContext.contentResolver.delete(it, null, null) } catch (_: Exception) {} }
        legacyRecordingFile?.let { try { if (it.exists()) it.delete() } catch (_: Exception) {} }
        recordingUri = null
        legacyRecordingFile = null
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
