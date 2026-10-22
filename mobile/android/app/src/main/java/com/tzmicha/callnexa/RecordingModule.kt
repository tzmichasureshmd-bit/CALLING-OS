package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import java.io.File

/**
 * RecordingModule.kt
 *
 * Discovers audio files saved by the device's native phone dialer and
 * associates them with call-log entries using timestamp + duration heuristics.
 *
 * Strategy (in priority order):
 *   1. MediaStore.Audio.Media query — works on Android 10+ regardless of OEM
 *      directory choice. Returns stable _ID, duration, MIME type, file path.
 *   2. Filesystem scan of known OEM directories — fallback for devices where
 *      the dialer does not add recordings to MediaStore (older OEMs).
 *
 * What this module does NOT do:
 *   - It does not initiate or intercept calls.
 *   - It does not access another app's private data directory.
 *   - It does not bypass scoped storage.
 *   - It does not claim a call is recorded merely because a call-log entry exists.
 *   - It does not upload anything — that is the JS layer's responsibility.
 *
 * Exposed React Native methods:
 *   checkRecordingPermission()  → { granted, api_level, manufacturer, model }
 *   findRecordingsForCall(callStartMs, callEndMs, durationSec, phoneNumber)
 *       → { success, recordings[], source, error? }
 *   getRecentRecordings(sinceMs, maxResults)
 *       → { success, recordings[], source, error? }
 */
class RecordingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CallNexa.RecordingModule"

        // Time window around a call within which a recording file is considered
        // a plausible match. Conservative: 30s before call start, 90s after call end.
        // This is a heuristic — not proof of association.
        private const val WINDOW_BEFORE_SEC = 30L
        private const val WINDOW_AFTER_SEC  = 90L

        // Minimum file size to be considered a real recording (not a 0-byte placeholder)
        private const val MIN_FILE_BYTES = 1024L

        // Maximum number of recordings returned per query (prevents runaway scans)
        private const val MAX_RESULTS = 50

        // Known OEM recording directories for filesystem fallback.
        // These are the same paths the JS layer scans, but accessed via Java File API
        // which has the same scoped-storage restrictions — this is a fallback only.
        private val OEM_DIRS = listOf(
            "/storage/emulated/0/Recordings/Call",
            "/storage/emulated/0/Recordings",
            "/storage/emulated/0/CallRecordings",
            "/storage/emulated/0/Call",
            "/storage/emulated/0/Record/Call",
            "/storage/emulated/0/PhoneRecord",
            "/storage/emulated/0/MIUI/sound_recorder/call_rec",
            "/storage/emulated/0/Xiaomi/sound_recorder/call_rec",
            "/storage/emulated/0/Sounds/CallRecord",
            "/storage/emulated/0/Vivo/CallRecord",
            "/storage/emulated/0/ColorOS/Recording",
            "/storage/emulated/0/DCIM/Call Recordings",
            "/storage/emulated/0/OnePlus/CallRecord",
        )

        private val AUDIO_EXTENSIONS = setOf("mp3", "mp4", "m4a", "aac", "wav", "3gp", "amr", "ogg", "webm")

        private val MIME_MAP = mapOf(
            "mp3"  to "audio/mpeg",
            "mp4"  to "audio/mp4",
            "m4a"  to "audio/x-m4a",
            "aac"  to "audio/aac",
            "wav"  to "audio/wav",
            "3gp"  to "audio/3gpp",
            "amr"  to "audio/amr",
            "ogg"  to "audio/ogg",
            "webm" to "audio/webm",
        )
    }

    override fun getName() = "RecordingModule"

    // ── Permission helpers ────────────────────────────────────────────────────

    private fun hasAudioPermission(): Boolean {
        // Android 13+ (API 33): READ_MEDIA_AUDIO replaces READ_EXTERNAL_STORAGE
        val perm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
        return ContextCompat.checkSelfPermission(reactContext, perm) ==
                PackageManager.PERMISSION_GRANTED
    }

    // ── checkRecordingPermission ──────────────────────────────────────────────

    @ReactMethod
    fun checkRecordingPermission(promise: Promise) {
        val map = Arguments.createMap()
        map.putBoolean("granted", hasAudioPermission())
        map.putInt("api_level", Build.VERSION.SDK_INT)
        map.putString("manufacturer", Build.MANUFACTURER ?: "unknown")
        map.putString("model", Build.MODEL ?: "unknown")
        map.putString(
            "required_permission",
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                "READ_MEDIA_AUDIO" else "READ_EXTERNAL_STORAGE"
        )
        promise.resolve(map)
    }

    // ── MediaStore query ──────────────────────────────────────────────────────

    /**
     * Query MediaStore.Audio.Media for audio files modified within [windowStartMs, windowEndMs].
     * Returns a list of WritableMap entries, each representing one audio file.
     *
     * MediaStore is the correct API for Android 10+ (API 29+). It works regardless
     * of which directory the OEM dialer chose to save recordings in.
     */
    private fun queryMediaStore(
        windowStartMs: Long,
        windowEndMs: Long,
        maxResults: Int,
    ): List<WritableMap> {
        val results = mutableListOf<WritableMap>()

        val collection: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        }

        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.DATA,           // absolute path (deprecated API 29 but still populated)
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DURATION,       // milliseconds
            MediaStore.Audio.Media.DATE_MODIFIED,  // seconds since epoch
            MediaStore.Audio.Media.DATE_ADDED,     // seconds since epoch
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.RELATIVE_PATH,  // API 29+
        )

        // Filter: files modified within our window (DATE_MODIFIED is in seconds)
        val windowStartSec = windowStartMs / 1000
        val windowEndSec   = windowEndMs   / 1000

        val selection = "${MediaStore.Audio.Media.DATE_MODIFIED} >= ? AND " +
                        "${MediaStore.Audio.Media.DATE_MODIFIED} <= ? AND " +
                        "${MediaStore.Audio.Media.SIZE} >= ?"
        val selectionArgs = arrayOf(
            windowStartSec.toString(),
            windowEndSec.toString(),
            MIN_FILE_BYTES.toString(),
        )
        val sortOrder = "${MediaStore.Audio.Media.DATE_MODIFIED} DESC"

        var cursor: Cursor? = null
        try {
            cursor = reactContext.contentResolver.query(
                collection, projection, selection, selectionArgs, sortOrder
            )
            cursor?.use { c ->
                val idIdx       = c.getColumnIndex(MediaStore.Audio.Media._ID)
                val nameIdx     = c.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
                val dataIdx     = c.getColumnIndex(MediaStore.Audio.Media.DATA)
                val sizeIdx     = c.getColumnIndex(MediaStore.Audio.Media.SIZE)
                val durIdx      = c.getColumnIndex(MediaStore.Audio.Media.DURATION)
                val modIdx      = c.getColumnIndex(MediaStore.Audio.Media.DATE_MODIFIED)
                val addedIdx    = c.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED)
                val mimeIdx     = c.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE)
                val relPathIdx  = c.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)

                var count = 0
                while (c.moveToNext() && count < maxResults) {
                    val mediaId      = if (idIdx    >= 0) c.getLong(idIdx)    else 0L
                    val displayName  = if (nameIdx  >= 0) c.getString(nameIdx) else null
                    val dataPath     = if (dataIdx  >= 0) c.getString(dataIdx) else null
                    val size         = if (sizeIdx  >= 0) c.getLong(sizeIdx)   else 0L
                    val durMs        = if (durIdx   >= 0) c.getLong(durIdx)    else 0L
                    val modSec       = if (modIdx   >= 0) c.getLong(modIdx)    else 0L
                    val addedSec     = if (addedIdx >= 0) c.getLong(addedIdx)  else 0L
                    val mimeType     = if (mimeIdx  >= 0) c.getString(mimeIdx) else null
                    val relPath      = if (relPathIdx >= 0) c.getString(relPathIdx) else null

                    if (size < MIN_FILE_BYTES) continue

                    // Build content URI for this item (preferred over DATA path on API 29+)
                    val contentUri = Uri.withAppendedPath(collection, mediaId.toString()).toString()

                    val map = Arguments.createMap()
                    map.putString("media_store_id",    mediaId.toString())
                    map.putString("content_uri",       contentUri)
                    map.putString("file_path",         dataPath)   // may be null on API 29+ with scoped storage
                    map.putString("display_name",      displayName)
                    map.putString("relative_path",     relPath)
                    map.putDouble("size_bytes",        size.toDouble())
                    map.putDouble("duration_ms",       durMs.toDouble())
                    map.putDouble("duration_sec",      (durMs / 1000.0))
                    map.putDouble("modified_ms",       modSec * 1000.0)   // convert to ms for JS consistency
                    map.putDouble("added_ms",          addedSec * 1000.0)
                    map.putString("mime_type",         mimeType ?: inferMime(displayName))
                    map.putString("source",            "mediastore")
                    // Stable dedup key: MediaStore _ID is stable for the lifetime of the file
                    map.putString("fingerprint",       "ms:$mediaId")

                    results.add(map)
                    count++
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "[RECORDING_MEDIASTORE] query error: ${e.message}")
        } finally {
            cursor?.close()
        }

        Log.d(TAG, "[RECORDING_MEDIASTORE] found=${results.size} window=${windowStartMs}..${windowEndMs}")
        return results
    }

    // ── Filesystem fallback scan ──────────────────────────────────────────────

    /**
     * Scan known OEM directories for audio files modified within the window.
     * Used only when MediaStore returns nothing (older OEMs that don't index recordings).
     *
     * Note: On Android 10+ with scoped storage, File.listFiles() may return null
     * for directories the app cannot access. This is handled gracefully.
     */
    private fun scanFilesystem(
        windowStartMs: Long,
        windowEndMs: Long,
        maxResults: Int,
    ): List<WritableMap> {
        val results = mutableListOf<WritableMap>()

        for (dirPath in OEM_DIRS) {
            if (results.size >= maxResults) break
            val dir = File(dirPath)
            if (!dir.exists() || !dir.isDirectory) continue

            val files: Array<File>? = try { dir.listFiles() } catch (_: Exception) { null }
            if (files.isNullOrEmpty()) continue

            for (file in files) {
                if (results.size >= maxResults) break
                if (!file.isFile) continue

                val ext = file.extension.lowercase()
                if (ext !in AUDIO_EXTENSIONS) continue
                if (file.length() < MIN_FILE_BYTES) continue

                val modMs = file.lastModified()  // Java File.lastModified() is always milliseconds
                if (modMs < windowStartMs || modMs > windowEndMs) continue

                val map = Arguments.createMap()
                map.putString("media_store_id",    null)
                map.putString("content_uri",       null)
                map.putString("file_path",         file.absolutePath)
                map.putString("display_name",      file.name)
                map.putString("relative_path",     dirPath)
                map.putDouble("size_bytes",        file.length().toDouble())
                map.putDouble("duration_ms",       0.0)   // not available without MediaMetadataRetriever
                map.putDouble("duration_sec",      0.0)
                map.putDouble("modified_ms",       modMs.toDouble())
                map.putDouble("added_ms",          modMs.toDouble())
                map.putString("mime_type",         inferMime(file.name))
                map.putString("source",            "filesystem")
                // Stable dedup key: absolute path + size + modtime
                map.putString("fingerprint",       "fs:${file.absolutePath}:${file.length()}:$modMs")

                results.add(map)
            }
        }

        Log.d(TAG, "[RECORDING_FILESYSTEM] found=${results.size} window=${windowStartMs}..${windowEndMs}")
        return results
    }

    // ── MIME inference ────────────────────────────────────────────────────────

    private fun inferMime(filename: String?): String {
        if (filename == null) return "audio/mp4"
        val ext = filename.substringAfterLast('.', "").lowercase()
        return MIME_MAP[ext] ?: "audio/mp4"
    }

    // ── findRecordingsForCall ─────────────────────────────────────────────────

    /**
     * Find audio files that plausibly correspond to a specific call.
     *
     * Parameters (all from the call-log entry):
     *   callStartMs  — call start time in milliseconds (Unix epoch)
     *   callEndMs    — call end time in milliseconds (0 if unknown/missed)
     *   durationSec  — call duration in seconds (0 for missed/rejected)
     *   phoneNumber  — raw phone number string (used for filename hint matching only)
     *
     * Returns recordings sorted by confidence score (highest first).
     * If multiple recordings score equally, returns all — the caller must decide.
     * Never returns a recording with confidence=0.
     *
     * Confidence scoring:
     *   +3  filename contains last 7 digits of phone number
     *   +2  file modified within ±10s of call end
     *   +1  file modified within the full window
     *   +1  MediaStore duration within 20% of call duration (when both > 0)
     *   -1  file modified before call start (OEM saved early — penalise slightly)
     */
    @ReactMethod
    fun findRecordingsForCall(
        callStartMs: Double,
        callEndMs: Double,
        durationSec: Double,
        phoneNumber: String?,
        promise: Promise,
    ) {
        val result = Arguments.createMap()

        if (!hasAudioPermission()) {
            result.putBoolean("success", false)
            result.putArray("recordings", Arguments.createArray())
            result.putString("source", "none")
            result.putString("error", "Audio storage permission not granted")
            result.putString("error_code", "PERMISSION_DENIED")
            promise.resolve(result)
            return
        }

        try {
            val startMs  = callStartMs.toLong()
            val endMs    = if (callEndMs > 0) callEndMs.toLong()
                           else startMs + (durationSec * 1000).toLong()
            val durSec   = durationSec.toLong()

            val windowStartMs = startMs - WINDOW_BEFORE_SEC * 1000
            val windowEndMs   = endMs   + WINDOW_AFTER_SEC  * 1000

            // Last 7 digits of phone number for filename hint matching
            val digits = phoneNumber
                ?.replace(Regex("[^0-9]"), "")
                ?.takeLast(7)
                ?.takeIf { it.length >= 7 }

            // 1. Try MediaStore first
            var candidates = queryMediaStore(windowStartMs, windowEndMs, MAX_RESULTS)
            var source = "mediastore"

            // 2. Filesystem fallback if MediaStore returned nothing
            if (candidates.isEmpty()) {
                candidates = scanFilesystem(windowStartMs, windowEndMs, MAX_RESULTS)
                source = if (candidates.isEmpty()) "none" else "filesystem"
            }

            if (candidates.isEmpty()) {
                result.putBoolean("success", true)
                result.putArray("recordings", Arguments.createArray())
                result.putString("source", source)
                result.putNull("error")
                Log.i(TAG, "[RECORDING_NOT_FOUND] callStart=$startMs dur=${durSec}s")
                promise.resolve(result)
                return
            }

            // Score and filter candidates
            val scored = candidates.mapNotNull { rec ->
                val modMs   = rec.getDouble("modified_ms").toLong()
                val recDurS = rec.getDouble("duration_sec")
                val name    = rec.getString("display_name") ?: ""

                var score = 0

                // Filename contains phone digits
                if (digits != null && name.contains(digits)) score += 3

                // Modification time proximity to call end
                val callEndActual = if (endMs > startMs) endMs else startMs + durSec * 1000
                val deltaMs = Math.abs(modMs - callEndActual)
                when {
                    deltaMs <= 10_000  -> score += 2   // within 10s of call end
                    deltaMs <= (WINDOW_BEFORE_SEC + durSec + WINDOW_AFTER_SEC) * 1000 -> score += 1
                }

                // Penalise files modified before call start (OEM saved early)
                if (modMs < startMs) score -= 1

                // Duration match (only when both are known and > 0)
                if (durSec > 0 && recDurS > 0) {
                    val ratio = recDurS / durSec.toDouble()
                    if (ratio in 0.8..1.2) score += 1   // within 20%
                }

                if (score <= 0) null else Pair(score, rec)
            }.sortedByDescending { it.first }

            val recordingsArray = Arguments.createArray()
            for ((score, rec) in scored) {
                // Attach confidence score to the map
                val withScore = Arguments.createMap()
                withScore.merge(rec)
                withScore.putInt("confidence_score", score)
                recordingsArray.pushMap(withScore)
            }

            Log.i(TAG, "[RECORDING_FOUND] callStart=$startMs dur=${durSec}s " +
                    "candidates=${candidates.size} matched=${scored.size} source=$source")

            result.putBoolean("success", true)
            result.putArray("recordings", recordingsArray)
            result.putString("source", source)
            result.putNull("error")
            promise.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "[RECORDING_ERROR] findRecordingsForCall: ${e.message}")
            result.putBoolean("success", false)
            result.putArray("recordings", Arguments.createArray())
            result.putString("source", "error")
            result.putString("error", e.message ?: "Unknown error")
            promise.resolve(result)
        }
    }

    // ── getRecentRecordings ───────────────────────────────────────────────────

    /**
     * Return all audio files added/modified since [sinceMs].
     * Used by the diagnostic screen and for pre-fetching the recording list
     * before individual call matching.
     */
    @ReactMethod
    fun getRecentRecordings(sinceMs: Double, maxResults: Double, promise: Promise) {
        val result = Arguments.createMap()

        if (!hasAudioPermission()) {
            result.putBoolean("success", false)
            result.putArray("recordings", Arguments.createArray())
            result.putString("source", "none")
            result.putString("error", "Audio storage permission not granted")
            result.putString("error_code", "PERMISSION_DENIED")
            promise.resolve(result)
            return
        }

        try {
            val since  = sinceMs.toLong()
            val limit  = maxResults.toInt().coerceIn(1, MAX_RESULTS)
            val nowMs  = System.currentTimeMillis()

            var recordings = queryMediaStore(since, nowMs, limit)
            var source = "mediastore"

            if (recordings.isEmpty()) {
                recordings = scanFilesystem(since, nowMs, limit)
                source = if (recordings.isEmpty()) "none" else "filesystem"
            }

            val arr = Arguments.createArray()
            recordings.forEach { arr.pushMap(it) }

            result.putBoolean("success", true)
            result.putArray("recordings", arr)
            result.putString("source", source)
            result.putNull("error")
            promise.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "[RECORDING_ERROR] getRecentRecordings: ${e.message}")
            result.putBoolean("success", false)
            result.putArray("recordings", Arguments.createArray())
            result.putString("source", "error")
            result.putString("error", e.message ?: "Unknown error")
            promise.resolve(result)
        }
    }
}

// ── WritableMap merge helper ──────────────────────────────────────────────────
// React Native's WritableMap has no built-in merge. This copies all keys.
private fun WritableMap.merge(other: ReadableMap) {
    val iter = other.keySetIterator()
    while (iter.hasNextKey()) {
        val key = iter.nextKey()
        when (other.getType(key)) {
            com.facebook.react.bridge.ReadableType.Null    -> putNull(key)
            com.facebook.react.bridge.ReadableType.Boolean -> putBoolean(key, other.getBoolean(key))
            com.facebook.react.bridge.ReadableType.Number  -> putDouble(key, other.getDouble(key))
            com.facebook.react.bridge.ReadableType.String  -> putString(key, other.getString(key))
            com.facebook.react.bridge.ReadableType.Map     -> putMap(key, other.getMap(key))
            com.facebook.react.bridge.ReadableType.Array   -> putArray(key, other.getArray(key))
        }
    }
}
