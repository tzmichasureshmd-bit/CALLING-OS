package com.tzmicha.callnexa

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.bridge.ReactContext

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  
  companion object {
    private const val TAG = "CallNexa.MainActivity"
    private var callStateListener: CallStateListener? = null
    private var isListenerInitialized = false
  }
  
  override fun onCreate(savedInstanceState: Bundle?) {
    Log.i(TAG, "MAINACTIVITY: MainActivity.onCreate() called")
    System.out.println("CallNexa MAINACTIVITY: MainActivity.onCreate() called")
    
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    
    // Start call monitor service
    val svc = Intent(this, CallMonitorService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(svc)
    } else {
      startService(svc)
    }
    
    // Initialize CallStateListener for auto-recording
    initializeCallStateListener()
  }
  
  private fun initializeCallStateListener() {
    if (isListenerInitialized) {
      Log.i(TAG, "CallStateListener already initialized, skipping")
      return
    }
    
    Log.i(TAG, "ACTIVITY_INIT: Attempting to initialize CallStateListener from MainActivity")
    System.out.println("CallNexa ACTIVITY_INIT: Initializing CallStateListener")
    
    try {
      // Get React context from the application
      val app = application as? MainApplication
      if (app != null) {
        val reactContext = app.reactNativeHost.reactInstanceManager.currentReactContext
        
        if (reactContext != null) {
          // Context is ready, initialize immediately
          callStateListener = CallStateListener(reactContext as com.facebook.react.bridge.ReactApplicationContext)
          callStateListener?.startListening()
          isListenerInitialized = true
          Log.i(TAG, "ACTIVITY_SUCCESS: CallStateListener initialized from MainActivity")
          System.out.println("CallNexa ACTIVITY_SUCCESS: CallStateListener initialized")
        } else {
          // Context not ready yet, wait for it
          Log.i(TAG, "ACTIVITY_WAIT: React context not ready, adding listener")
          app.reactNativeHost.reactInstanceManager.addReactInstanceEventListener(
            object : com.facebook.react.ReactInstanceManager.ReactInstanceEventListener {
              override fun onReactContextInitialized(context: ReactContext) {
                Log.i(TAG, "ACTIVITY_REACT: React context ready in MainActivity listener")
                android.os.Handler(mainLooper).post {
                  if (!isListenerInitialized) {
                    try {
                      callStateListener = CallStateListener(context as com.facebook.react.bridge.ReactApplicationContext)
                      callStateListener?.startListening()
                      isListenerInitialized = true
                      Log.i(TAG, "ACTIVITY_SUCCESS_DELAYED: CallStateListener initialized from MainActivity after context ready")
                      System.out.println("CallNexa ACTIVITY_SUCCESS_DELAYED: CallStateListener initialized")
                    } catch (e: Exception) {
                      Log.e(TAG, "ACTIVITY_ERROR: Failed to initialize CallStateListener: ${e.message}", e)
                      e.printStackTrace()
                    }
                  }
                }
              }
            }
          )
        }
      } else {
        Log.e(TAG, "ACTIVITY_ERROR: Application is not MainApplication")
      }
    } catch (e: Exception) {
      Log.e(TAG, "ACTIVITY_ERROR: Exception initializing CallStateListener: ${e.message}", e)
      e.printStackTrace()
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
