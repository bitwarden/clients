const path = require("path");
const { buildConfig } = require(path.resolve(__dirname, "webpack.base"));

module.exports = (webpackConfig, context) => {
  const isNxBuild = context && context.options;

  if (isNxBuild) {
    return buildConfig({
      configName: "OSS",
      app: {
        entry: context.options.main
          ? path.resolve(context.context.root, context.options.main)
          : path.resolve(__dirname, "src/main.ts"),
        entryModule: "src/app/app.module#AppModule",
      },
      tsConfig: "apps/web/tsconfig.build.json",
      outputPath: path.resolve(context.context.root, context.options.outputPath),
      env: context.options.env,
    });
  } else {
    return buildConfig({
      configName: "OSS",
      app: {
        entry: path.resolve(__dirname, "src/main.ts"),
        entryModule: "src/app/app.module#AppModule",
      },
      tsConfig: "tsconfig.build.json",
    });
  }
};
