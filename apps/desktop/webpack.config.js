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
        tsConfig: path.resolve(context.context.root, "apps/desktop/tsconfig.renderer.json"),
      },
      main: {
        entry: path.resolve(__dirname, "src/entry.ts"),
        tsConfig: path.resolve(context.context.root, "apps/desktop/tsconfig.main.json"),
      },
      preload: {
        entry: path.resolve(__dirname, "src/preload.ts"),
        tsConfig: path.resolve(context.context.root, "apps/desktop/tsconfig.preload.json"),
      },
      magnify: {
        entry: path.resolve(__dirname, "src/magnify/main.ts"),
        tsConfig: path.resolve(context.context.root, "apps/desktop/tsconfig.magnify.json"),
        htmlTemplate: path.resolve(__dirname, "src/magnify/index.html"),
      },
      magnifyPreload: {
        entry: path.resolve(__dirname, "src/magnify/preload.ts"),
        tsConfig: path.resolve(context.context.root, "apps/desktop/tsconfig.magnify-preload.json"),
      },
      outputPath: path.resolve(context.context.root, context.options.outputPath),
    });
  } else {
    return buildConfig({
      configName: "OSS",
      renderer: {
        entry: path.resolve(__dirname, "src/app/main.ts"),
        entryModule: "src/app/app.module#AppModule",
        tsConfig: path.resolve(__dirname, "tsconfig.renderer.json"),
      },
      main: {
        entry: path.resolve(__dirname, "src/entry.ts"),
        tsConfig: path.resolve(__dirname, "tsconfig.main.json"),
      },
      preload: {
        entry: path.resolve(__dirname, "src/preload.ts"),
        tsConfig: path.resolve(__dirname, "tsconfig.preload.json"),
      },
      magnify: {
        entry: path.resolve(__dirname, "src/magnify/main.ts"),
        tsConfig: path.resolve(__dirname, "tsconfig.magnify.json"),
        htmlTemplate: path.resolve(__dirname, "src/magnify/index.html"),
      },
      magnifyPreload: {
        entry: path.resolve(__dirname, "src/magnify/preload.ts"),
        tsConfig: path.resolve(__dirname, "tsconfig.magnify-preload.json"),
      },
    });
  }
};
