const path = require("path");
const { buildConfig } = require("../../apps/desktop/webpack.base");

module.exports = (webpackConfig, context) => {
  // Detect if called by Nx (context parameter exists)
  const isNxBuild = context && context.options;

  if (isNxBuild) {
    return buildConfig({
      configName: "Commercial",
      renderer: {
        entry: "",
        entryModule: "",
        tsConfig: "",
      },
      main: {
        entry: path.resolve(__dirname, "src/entry.ts"),
        tsConfig: path.resolve(context.context.root, "bitwarden_license/bit-desktop/tsconfig.json"),
      },
      outputPath: path.resolve(context.context.root, context.options.outputPath),
    });
  } else {
    return buildConfig({
      configName: "Commercial",
      renderer: {
        entry: path.resolve(__dirname, "src/app/main.ts"),
        entryModule: "src/app/app.module#AppModule",
        tsConfig: path.resolve(__dirname, "tsconfig.renderer.json"),
      },
      main: {
        entry: path.resolve(__dirname, "src/entry.ts"),
        tsConfig: path.resolve(__dirname, "tsconfig.json"),
      },
      preload: {
        entry: path.resolve(__dirname, "src/preload.ts"),
        tsConfig: path.resolve(__dirname, "tsconfig.json"),
      },
    });
  }
};
