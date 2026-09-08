const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

// Step 1: Add service to AndroidManifest
function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const services = app.service || [];
    const already = services.some((s) =>
      s.$?.["android:name"]?.includes("CallMonitorService")
    );
    if (!already) {
      services.push({
        $: {
          "android:name": ".CallMonitorService",
          "android:enabled": "true",
          "android:exported": "false",
          "android:foregroundServiceType": "dataSync",
          "android:stopWithTask": "false",
        },
      });
      app.service = services;
    }
    return cfg;
  });
}

// Step 2: Patch MainActivity.kt to start the service
function withMainActivity(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const mainActivityPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java/com/tzmicha/callnexa/MainActivity.kt"
      );
      if (!fs.existsSync(mainActivityPath)) return cfg;

      let content = fs.readFileSync(mainActivityPath, "utf8");

      // Add import if missing
      if (!content.includes("import android.content.Intent")) {
        content = content.replace(
          "import android.os.Build",
          "import android.content.Intent\nimport android.os.Build"
        );
      }

      // Add service start in onCreate if missing
      if (!content.includes("CallMonitorService")) {
        content = content.replace(
          "super.onCreate(null)",
          `super.onCreate(null)
    val svc = Intent(this, CallMonitorService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(svc)
    } else {
      startService(svc)
    }`
        );
      }

      fs.writeFileSync(mainActivityPath, content, "utf8");
      console.log("[withForegroundService] MainActivity.kt patched");
      return cfg;
    },
  ]);
}

module.exports = function withForegroundService(config) {
  config = withManifest(config);
  config = withMainActivity(config);
  return config;
};
