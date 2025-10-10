const path = require("path");
const { buildConfig } = require("./webpack.base");

module.exports = (webpackConfig, context) => {
  const isNxBuild = context && context.options;

  if (isNxBuild) {
    return buildConfig({
      configName: "OSS",
      renderer: {
        entry: path.resolve(__dirname, "src/app/main.ts"),
        entryModule: "src/app/app.module#AppModule",
        tsConfig: "apps/desktop/tsconfig.renderer.json",
      },
      main: {
        entry: path.resolve(__dirname, "src/entry.ts"),
        tsConfig: "apps/desktop/tsconfig.json",
      },
      preload: {
        entry: path.resolve(__dirname, "src/preload.ts"),
        tsConfig: "apps/desktop/tsconfig.json",
      },
      outputPath: path.resolve(context.context.root, context.options.outputPath),
    });
  } else {
    return buildConfig({
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
  }
};
