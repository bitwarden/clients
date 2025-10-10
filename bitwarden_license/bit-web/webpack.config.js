const { buildConfig } = require("../../apps/web/webpack.base");

module.exports = buildConfig({
  configName: "Commercial",
  app: {
    entry: "../../bitwarden_license/bit-web/src/main.ts",
    entryModule: "../../bitwarden_license/bit-web/src/app/app.module#AppModule",
  },
  tsConfig: "../../bitwarden_license/bit-web/tsconfig.build.json",
});
