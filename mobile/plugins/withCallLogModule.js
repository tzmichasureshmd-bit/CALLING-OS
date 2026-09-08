/**
 * withCallLogModule.js
 *
 * Expo config plugin that ensures CallLogPackage is registered in
 * MainApplication.kt after every expo prebuild.
 *
 * This is required because expo prebuild regenerates MainApplication.kt
 * from a template, which would remove any manual edits.
 *
 * This plugin uses withDangerousMod to patch the generated file.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs   = require("fs");
const path = require("path");

function withCallLogModule(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const mainAppPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java/com/tzmicha/callnexa/MainApplication.kt"
      );

      if (!fs.existsSync(mainAppPath)) {
        console.warn("[withCallLogModule] MainApplication.kt not found at:", mainAppPath);
        return cfg;
      }

      let content = fs.readFileSync(mainAppPath, "utf8");

      // 1. Add CallLogPackage import if missing
      if (!content.includes("import com.tzmicha.callnexa.CallLogPackage")) {
        content = content.replace(
          "package com.tzmicha.callnexa",
          "package com.tzmicha.callnexa\n\nimport com.tzmicha.callnexa.CallLogPackage"
        );
      }

      // 2. Add add(CallLogPackage()) inside getPackages() if missing
      if (!content.includes("add(CallLogPackage())")) {
        content = content.replace(
          /PackageList\(this\)\.packages\.apply\s*\{([^}]*)\}/,
          (match, inner) => {
            return `PackageList(this).packages.apply {${inner}              add(CallLogPackage())\n            }`;
          }
        );
      }

      fs.writeFileSync(mainAppPath, content, "utf8");
      console.log("[withCallLogModule] CallLogPackage registered in MainApplication.kt");

      // 3. Copy CallLogModule.kt and CallLogPackage.kt if they don't exist
      // (they should already be there from the repo, but ensure they're present)
      const srcDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java/com/tzmicha/callnexa"
      );

      const moduleFile  = path.join(srcDir, "CallLogModule.kt");
      const packageFile = path.join(srcDir, "CallLogPackage.kt");

      if (!fs.existsSync(moduleFile)) {
        console.warn("[withCallLogModule] CallLogModule.kt missing — prebuild may have deleted it");
      }
      if (!fs.existsSync(packageFile)) {
        console.warn("[withCallLogModule] CallLogPackage.kt missing — prebuild may have deleted it");
      }

      return cfg;
    },
  ]);
}

module.exports = withCallLogModule;
