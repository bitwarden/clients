const { buildConfig } = require("../../apps/browser/webpack.base");

module.exports = buildConfig({
  configName: "Commercial",
  popup: {
    entry: "../../bitwarden_license/bit-browser/src/popup/main.ts",
    entryModule: "../../bitwarden_license/bit-browser/src/popup/app.module#AppModule",
  },
  background: {
    entry: "../../bitwarden_license/bit-browser/src/platform/background.ts",
  },
  tsConfig: "../../bitwarden_license/bit-browser/tsconfig.json",
});
