/**
 * withSimCards.js
 *
 * Local Expo config plugin for react-native-sim-cards-manager.
 *
 * react-native-sim-cards-manager is a standard RN autolinking module.
 * Its android/src/main/AndroidManifest.xml is empty (no permissions declared).
 * READ_PHONE_STATE is required to read SIM subscription info.
 * Autolinking registers SimCardsManagerPackage automatically.
 *
 * This plugin:
 * 1. Satisfies Expo's plugin resolver.
 * 2. Ensures READ_PHONE_STATE is present in the merged manifest.
 */

const { withAndroidManifest } = require("@expo/config-plugins");

function withSimCards(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const mainApp = manifest.manifest;

    if (!mainApp["uses-permission"]) {
      mainApp["uses-permission"] = [];
    }

    const perms = mainApp["uses-permission"];

    const REQUIRED = [
      "android.permission.READ_PHONE_STATE",
      "android.permission.READ_PHONE_NUMBERS",
      "android.permission.READ_CONTACTS",
    ];

    for (const PERM of REQUIRED) {
      const already = perms.some((p) => p.$?.["android:name"] === PERM);
      if (!already) {
        perms.push({ $: { "android:name": PERM } });
      }
    }

    return cfg;
  });
}

module.exports = withSimCards;
