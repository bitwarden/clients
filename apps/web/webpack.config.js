const { buildConfig } = require("./webpack.base");

module.exports = buildConfig({
  configName: "OSS",
  app: {
    entry: "./src/main.ts",
    entryModule: "src/app/app.module#AppModule",
  },
  tsConfig: "tsconfig.build.json",
});
