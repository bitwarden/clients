// webpack.npm.config.js - NPM build configuration for backward compatibility
const { buildConfig } = require("./webpack.base");

module.exports = buildConfig({
  configName: "OSS",
  popup: {
    entry: "./src/popup/main.ts",
    entryModule: "src/popup/app.module#AppModule",
  },
  background: {
    entry: "./src/platform/background.ts",
  },
  tsConfig: "tsconfig.json",
});
