const { withAndroidManifest } = require("@expo/config-plugins");

/** Keep prebuild output aligned with the checked-in native microphone service. */
module.exports = function withForegroundService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = manifest["uses-permission"] || [];
    const permissionName = "android.permission.FOREGROUND_SERVICE_MICROPHONE";
    if (!permissions.some((p) => p.$?.["android:name"] === permissionName)) {
      permissions.push({ $: { "android:name": permissionName } });
      manifest["uses-permission"] = permissions;
    }

    const app = manifest.application[0];
    const services = app.service || [];
    let service = services.find((s) => s.$?.["android:name"]?.includes("CallMonitorService"));
    if (!service) {
      service = { $: {} };
      services.push(service);
    }
    service.$ = {
      ...service.$,
      "android:name": ".CallMonitorService",
      "android:enabled": "true",
      "android:exported": "false",
      "android:foregroundServiceType": "microphone",
      "android:stopWithTask": "false",
    };
    app.service = services;
    return cfg;
  });
};
