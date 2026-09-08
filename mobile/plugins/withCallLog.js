/**
 * withCallLog.js
 *
 * Local Expo config plugin for react-native-call-log.
 *
 * react-native-call-log is a standard RN autolinking module.
 * Its android/src/main/AndroidManifest.xml already declares READ_CALL_LOG.
 * Autolinking registers CallLogPackage automatically — no manual linking needed.
 *
 * This plugin exists solely to satisfy Expo's plugin resolver when
 * "plugins": ["./plugins/withCallLog"] is listed in app.json.
 * It explicitly merges READ_CALL_LOG into the app manifest as a safety net
 * in case the library manifest merge is skipped by any build variant.
 */

const { withAndroidManifest } = require("@expo/config-plugins");

function withCallLog(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const mainApp = manifest.manifest;

    // Ensure uses-permission array exists
    if (!mainApp["uses-permission"]) {
      mainApp["uses-permission"] = [];
    }

    const perms = mainApp["uses-permission"];
    const PERM = "android.permission.READ_CALL_LOG";

    // Idempotent — only add if not already present
    const already = perms.some(
      (p) => p.$?.["android:name"] === PERM
    );
    if (!already) {
      perms.push({ $: { "android:name": PERM } });
    }

    return cfg;
  });
}

module.exports = withCallLog;
