package com.tzmicha.callnexa

import com.tzmicha.callnexa.CallLogPackage
import com.tzmicha.callnexa.CallRecorderPackage

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  private var callStateListener: CallStateListener? = null

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
                          add(CallLogPackage())
                          add(CallRecorderPackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    android.util.Log.i("CallNexa", "🚀 MainApplication.onCreate() called")
    
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    
    android.util.Log.i("CallNexa", "📞 Setting up CallStateListener...")
    
    // Initialize call state listener for auto-recording
    // Use ReactInstanceEventListener to ensure context is ready
    reactNativeHost.reactInstanceManager.addReactInstanceEventListener(
      object : com.facebook.react.ReactInstanceManager.ReactInstanceEventListener {
        override fun onReactContextInitialized(context: com.facebook.react.bridge.ReactContext) {
          android.util.Log.i("CallNexa", "⚡ React context initialized, starting CallStateListener...")
          android.os.Handler(mainLooper).post {
            try {
              if (context is com.facebook.react.bridge.ReactApplicationContext) {
                callStateListener = CallStateListener(context)
                callStateListener?.startListening()
                android.util.Log.i("CallNexa", "✅ CallStateListener initialized successfully")
              } else {
                android.util.Log.e("CallNexa", "❌ Context is not ReactApplicationContext")
              }
            } catch (e: Exception) {
              android.util.Log.e("CallNexa", "❌ Failed to initialize CallStateListener: ${e.message}", e)
            }
          }
        }
      }
    )
    
    android.util.Log.i("CallNexa", "✅ ReactInstanceEventListener registered")
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
