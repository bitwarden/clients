const { buildConfig } = require("./webpack.base");

module.exports = buildConfig({
  configName: "OSS",
  renderer: {
    entry: "./src/app/main.ts",
    entryModule: "src/app/app.module#AppModule",
    tsConfig: "./tsconfig.renderer.json",
  },
  main: {
    entry: "./src/entry.ts",
    tsConfig: "./tsconfig.json",
  },
  preload: {
    entry: "./src/preload.ts",
    tsConfig: "./tsconfig.json",
  },
});
