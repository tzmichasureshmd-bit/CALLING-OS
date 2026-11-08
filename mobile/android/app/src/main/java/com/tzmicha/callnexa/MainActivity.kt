package com.tzmicha.callnexa

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.core.content.ContextCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)

    // Android 14+ permits a microphone foreground service to start while this
    // activity is visible. Only start after explicit opt-in and permissions.
    val permissionsReady =
      ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
    if (permissionsReady && CallMonitorService.isRecordingEnabled(this)) {
      CallMonitorService.startEnabledMonitor(this)
    }
  }

  override fun onResume() {
    super.onResume()
    // Reconcile a stored ON preference after Android permission changes or
    // process recreation. This runs while the activity is visible, satisfying
    // microphone foreground-service start restrictions on current Android.
    val permissionsReady =
      ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
    if (permissionsReady && CallMonitorService.isRecordingEnabled(this)) {
      CallMonitorService.startEnabledMonitor(this)
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {},
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (android.os.Build.VERSION.SDK_INT <= android.os.Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) super.invokeDefaultOnBackPressed()
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
