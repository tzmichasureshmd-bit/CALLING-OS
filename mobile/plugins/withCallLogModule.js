/**
 * withCallLogModule.js
 *
 * Expo config plugin — ensures CallLogPackage (with both CallLogModule and
 * SimModule) is registered in MainApplication.kt.
 *
 * IMPORTANT: This plugin does NOT write or overwrite CallLogModule.kt,
 * CallLogPackage.kt, or SimModule.kt. Those files live in
 * android/app/src/main/java/com/tzmicha/callnexa/ and are the authoritative
 * source. Overwriting them at build time would destroy the ContentObserver,
 * subscription_id query, checkPermission(), addListener/removeListeners, and
 * SimModule registration.
 *
 * This plugin only patches MainApplication.kt to add the import and
 * add(CallLogPackage()) call if they are not already present.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

function withCallLogModule(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const srcDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java/com/tzmicha/callnexa"
      );

      const mainAppPath = path.join(srcDir, "MainApplication.kt");
      if (!fs.existsSync(mainAppPath)) {
        console.warn("[withCallLogModule] MainApplication.kt not found — skipping patch");
        return cfg;
      }

      let content = fs.readFileSync(mainAppPath, "utf8");
      let changed = false;

      // Add import if missing
      if (!content.includes("import com.tzmicha.callnexa.CallLogPackage")) {
        content = content.replace(
          /^(package com\.tzmicha\.callnexa)/m,
          "$1\n\nimport com.tzmicha.callnexa.CallLogPackage"
        );
        changed = true;
      }

      // Add add(CallLogPackage()) inside getPackages() if missing
      if (!content.includes("add(CallLogPackage())")) {
        content = content.replace(
          /PackageList\(this\)\.packages\.apply\s*\{([^}]*)\}/,
          (match, inner) =>
            `PackageList(this).packages.apply {${inner}              add(CallLogPackage())\n            }`
        );
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(mainAppPath, content, "utf8");
        console.log("[withCallLogModule] CallLogPackage registered in MainApplication.kt");
      } else {
        console.log("[withCallLogModule] MainApplication.kt already up to date");
      }

      return cfg;
    },
  ]);
}

module.exports = withCallLogModule;
