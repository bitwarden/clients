const path = require("path");
const { buildConfig } = require("../../apps/browser/webpack.base");

module.exports = buildConfig({
  configName: "Commercial",
  popup: {
    entry: "./src/popup/main.ts",
    entryModule: "../../bitwarden_license/bit-browser/src/popup/app.module#AppModule",
  },
  background: {
    entry: "./src/platform/background.ts",
  },
  tsConfig: "./tsconfig.json",
  contextPath: __dirname,
});
