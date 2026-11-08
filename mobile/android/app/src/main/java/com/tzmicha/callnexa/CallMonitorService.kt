package com.tzmicha.callnexa

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Native owner for automatic connected-call recording.
 *
 * The service stays independent of the React Native screen lifecycle. It reads
 * the explicit Settings preference at every OFFHOOK event, records into the
 * public Music/Call Recordings collection, and finalizes the file on IDLE.
 */
class CallMonitorService : Service() {

    companion object {
        private const val TAG = "CALLNEXA_NATIVE.CallMonitorService"
        private const val CHANNEL_ID = "callnexa_recording"
        private const val NOTIFICATION_ID = 1001

        const val PREFS_NAME = "callnexa_recording_preferences"
        const val PREF_RECORDING_ENABLED = "recording_enabled"
        const val ACTION_ENABLE = "com.tzmicha.callnexa.ENABLE_RECORDING_MONITOR"
        const val ACTION_DISABLE = "com.tzmicha.callnexa.DISABLE_RECORDING_MONITOR"

        private const val MIME_TYPE = "audio/mp4"
        private const val MIN_FILE_BYTES = 1024L
        private const val CALL_STATE_WATCHDOG_MS = 30_000L

        @Volatile
        private var activeInstance: CallMonitorService? = null

        fun isRecordingEnabled(context: Context): Boolean =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(PREF_RECORDING_ENABLED, false)

        fun startEnabledMonitor(context: Context) {
            if (!isRecordingEnabled(context)) return
            val intent = Intent(context, CallMonitorService::class.java).setAction(ACTION_ENABLE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(context, intent)
            } else {
                context.startService(intent)
            }
        }

        fun disableMonitor(context: Context) {
            val running = activeInstance
            if (running != null) {
                running.disableAndStop()
            } else {
                context.stopService(Intent(context, CallMonitorService::class.java))
            }
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var telephonyManager: TelephonyManager
    private var telephonyListener: Any? = null
    private var listenerRegistered = false
    private var callActive = false

    private var recorder: MediaRecorder? = null
    private var recordingUri: Uri? = null
    private var recordingDescriptor: ParcelFileDescriptor? = null
    private var legacyRecordingFile: File? = null
    private var recordingName: String? = null
    private var recordingStartedAt = 0L

    private val callStateWatchdog = object : Runnable {
        @Suppress("DEPRECATION")
        override fun run() {
            if (recorder == null) return
            try {
                if (telephonyManager.callState == TelephonyManager.CALL_STATE_IDLE) {
                    Log.w(TAG, "[RECORDER_WATCHDOG_STOP] phone state is IDLE")
                    callActive = false
                    stopRecording(discard = false)
                    return
                }
            } catch (e: Exception) {
                Log.w(TAG, "[RECORDER_WATCHDOG_WARNING] ${e.message}")
            }
            mainHandler.postDelayed(this, CALL_STATE_WATCHDOG_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        activeInstance = this
        telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Monitoring connected calls"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_DISABLE || !isRecordingEnabled(this)) {
            disableAndStop()
            return START_NOT_STICKY
        }

        if (!hasRequiredPermissions()) {
            Log.e(TAG, "[MONITOR_PERMISSION_MISSING] RECORD_AUDIO or READ_PHONE_STATE")
            updateNotification("Open CallNexa and allow Phone and Microphone permissions")
            unregisterCallStateListener()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        registerCallStateListener()
        return START_STICKY
    }

    private fun disableAndStop() {
        Log.i(TAG, "[MONITOR_DISABLED]")
        stopRecording(discard = true)
        unregisterCallStateListener()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        // Preserve a valid recording if Android stops the service unexpectedly.
        stopRecording(discard = false)
        unregisterCallStateListener()
        if (activeInstance === this) activeInstance = null
        super.onDestroy()
    }

    private fun hasRequiredPermissions(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

    private fun registerCallStateListener() {
        if (listenerRegistered) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                    override fun onCallStateChanged(state: Int) = handleCallState(state)
                }
                telephonyListener = callback
                telephonyManager.registerTelephonyCallback(mainExecutor, callback)
            } else {
                @Suppress("DEPRECATION")
                val listener = object : PhoneStateListener() {
                    @Deprecated("Deprecated in API 31")
                    override fun onCallStateChanged(state: Int, phoneNumber: String?) = handleCallState(state)
                }
                telephonyListener = listener
                @Suppress("DEPRECATION")
                telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            }
            listenerRegistered = true
            Log.i(TAG, "[MONITOR_STARTED] native call-state listener registered")
        } catch (e: Exception) {
            Log.e(TAG, "[MONITOR_START_FAILED] ${e.message}", e)
        }
    }

    private fun unregisterCallStateListener() {
        if (!listenerRegistered) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (telephonyListener as? TelephonyCallback)?.let(telephonyManager::unregisterTelephonyCallback)
            } else {
                @Suppress("DEPRECATION")
                (telephonyListener as? PhoneStateListener)?.let {
                    telephonyManager.listen(it, PhoneStateListener.LISTEN_NONE)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[MONITOR_STOP_WARNING] ${e.message}")
        } finally {
            telephonyListener = null
            listenerRegistered = false
        }
    }

    @Synchronized
    private fun handleCallState(state: Int) {
        Log.i(TAG, "[CALL_STATE] state=$state active=$callActive")
        when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (!callActive) {
                    callActive = true
                    if (isRecordingEnabled(this)) startRecording()
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (callActive) {
                    callActive = false
                    stopRecording(discard = false)
                }
            }
        }
    }

    @Synchronized
    private fun startRecording() {
        if (recorder != null || !hasRequiredPermissions() || !isRecordingEnabled(this)) return

        recordingStartedAt = System.currentTimeMillis()
        recordingName = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date(recordingStartedAt)) + "_.m4a"

        try {
            createRecordingDestination(recordingName!!)
            val sources = intArrayOf(MediaRecorder.AudioSource.VOICE_CALL, MediaRecorder.AudioSource.MIC)
            var lastError: Throwable? = null

            for (source in sources) {
                var candidate: MediaRecorder? = null
                try {
                    closeDescriptor()
                    val output = openRecordingOutput()
                    val configuredRecorder = MediaRecorder()
                    candidate = configuredRecorder
                    configuredRecorder.apply {
                        setAudioSource(source)
                        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                        setAudioSamplingRate(16_000)
                        setAudioEncodingBitRate(128_000)
                        setOutputFile(output)
                        prepare()
                        start()
                    }
                    recorder = candidate
                    mainHandler.postDelayed(callStateWatchdog, CALL_STATE_WATCHDOG_MS)
                    val sourceName = if (source == MediaRecorder.AudioSource.VOICE_CALL) "VOICE_CALL" else "MIC"
                    Log.i(TAG, "[RECORDER_STARTED] source=$sourceName name=$recordingName")
                    updateNotification("Recording connected call")
                    return
                } catch (e: Throwable) {
                    lastError = e
                    Log.w(TAG, "[RECORDER_SOURCE_FAILED] source=$source error=${e.message}")
                    try { candidate?.release() } catch (_: Exception) {}
                    recorder = null
                    closeDescriptor()
                }
            }

            Log.e(TAG, "[RECORDER_START_FAILED] ${lastError?.message}")
            cleanupDestination()
            resetRecordingState()
            updateNotification("Monitoring connected calls")
        } catch (e: Throwable) {
            Log.e(TAG, "[RECORDER_START_FAILED] ${e.message}", e)
            try { recorder?.release() } catch (_: Exception) {}
            recorder = null
            closeDescriptor()
            cleanupDestination()
            resetRecordingState()
        }
    }

    private fun createRecordingDestination(name: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Audio.Media.DISPLAY_NAME, name)
                put(MediaStore.Audio.Media.MIME_TYPE, MIME_TYPE)
                put(MediaStore.Audio.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MUSIC}/Call Recordings")
                put(MediaStore.Audio.Media.IS_PENDING, 1)
            }
            recordingUri = contentResolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Could not create recording in MediaStore")
        } else {
            val directory = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC),
                "Call Recordings",
            )
            if (!directory.exists() && !directory.mkdirs()) {
                throw IllegalStateException("Could not create Music/Call Recordings")
            }
            legacyRecordingFile = File(directory, name)
        }
    }

    private fun openRecordingOutput(): java.io.FileDescriptor {
        val uri = recordingUri
        if (uri != null) {
            val descriptor = contentResolver.openFileDescriptor(uri, "rwt")
                ?: throw IllegalStateException("Could not open MediaStore recording")
            recordingDescriptor = descriptor
            return descriptor.fileDescriptor
        }
        val legacyFile = legacyRecordingFile
            ?: throw IllegalStateException("Recording destination is missing")
        recordingDescriptor = ParcelFileDescriptor.open(
            legacyFile,
            ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE,
        )
        return recordingDescriptor!!.fileDescriptor
    }

    @Synchronized
    private fun stopRecording(discard: Boolean) {
        val activeRecorder = recorder
        if (activeRecorder == null && recordingUri == null && legacyRecordingFile == null) return

        mainHandler.removeCallbacks(callStateWatchdog)
        var validStop = !discard && activeRecorder != null
        try {
            if (activeRecorder != null) {
                if (discard) {
                    activeRecorder.reset()
                } else {
                    activeRecorder.stop()
                }
            }
        } catch (e: Exception) {
            validStop = false
            Log.w(TAG, "[RECORDER_STOP_FAILED] ${e.message}")
        } finally {
            try { activeRecorder?.release() } catch (_: Exception) {}
            recorder = null
            closeDescriptor()
        }

        if (validStop && recordingSize() >= MIN_FILE_BYTES) {
            publishRecording()
            Log.i(TAG, "[RECORDER_STOPPED] name=$recordingName durationMs=${System.currentTimeMillis() - recordingStartedAt}")
        } else {
            cleanupDestination()
            Log.i(TAG, "[RECORDER_DISCARDED] requested=$discard")
        }

        resetRecordingState()
        updateNotification("Monitoring connected calls")
    }

    private fun recordingSize(): Long {
        recordingUri?.let { uri ->
            try {
                contentResolver.query(uri, arrayOf(MediaStore.Audio.Media.SIZE), null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) return cursor.getLong(0)
                }
            } catch (_: Exception) {}
        }
        return legacyRecordingFile?.length() ?: 0L
    }

    private fun publishRecording() {
        recordingUri?.let { uri ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Audio.Media.IS_PENDING, 0)
                    put(MediaStore.Audio.Media.DATE_MODIFIED, System.currentTimeMillis() / 1000)
                }
                contentResolver.update(uri, values, null, null)
            }
        }
        legacyRecordingFile?.let { file ->
            MediaScannerConnection.scanFile(this, arrayOf(file.absolutePath), arrayOf(MIME_TYPE), null)
        }
    }

    private fun cleanupDestination() {
        recordingUri?.let { uri ->
            try { contentResolver.delete(uri, null, null) } catch (_: Exception) {}
        }
        legacyRecordingFile?.let { file ->
            try { if (file.exists()) file.delete() } catch (_: Exception) {}
        }
    }

    private fun closeDescriptor() {
        try { recordingDescriptor?.close() } catch (_: Exception) {}
        recordingDescriptor = null
    }

    private fun resetRecordingState() {
        recordingUri = null
        legacyRecordingFile = null
        recordingName = null
        recordingStartedAt = 0L
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Call recording",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps automatic call recording active"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun getLaunchIntent(): PendingIntent {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent(this, Class.forName("$packageName.MainActivity"))
        launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getActivity(this, 0, launchIntent, flags)
    }

    private fun buildNotification(body: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CallNexa")
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(getLaunchIntent())
            .build()

    private fun updateNotification(body: String) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification(body))
    }
}
