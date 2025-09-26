const path = require("path");
const { buildConfig } = require("../../apps/web/webpack.base");

module.exports = buildConfig({
  configName: "Commercial",
  main: {
    entry: path.resolve(__dirname, "src/main.ts"),
    entryModule: "bitwarden_license/src/app/app.module#AppModule",
  },
  tsConfig: path.resolve(__dirname, "tsconfig.build.json"),
});
