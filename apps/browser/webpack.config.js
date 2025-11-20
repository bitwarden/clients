const path = require("path");
const { buildConfig } = require("./webpack.base");

module.exports = (webpackConfig, context) => {
  // Detect if called by Nx (context parameter exists)
  const isNxBuild = context && context.options;

  if (isNxBuild) {
    // Nx build configuration
    const mode = context.options.mode || "development";
    if (process.env.NODE_ENV == null) {
      process.env.NODE_ENV = mode;
    }
    const ENV = (process.env.ENV = process.env.NODE_ENV);

    // Set environment variables from Nx context
    if (context.options.env) {
      Object.keys(context.options.env).forEach((key) => {
        process.env[key] = context.options.env[key];
      });
    }

    return buildConfig({
      configName: "OSS",
      popup: {
        entry: path.resolve(__dirname, "src/popup/main.ts"),
        entryModule: "src/popup/app.module#AppModule",
      },
      background: {
        entry: path.resolve(__dirname, "src/platform/background.ts"),
      },
      tsConfig: path.resolve(__dirname, "tsconfig.json"),
      outputPath:
        context.context && context.context.root
          ? path.resolve(context.context.root, context.options.outputPath)
          : context.options.outputPath,
      mode: mode,
      env: ENV,
    });
  } else {
    // npm build configuration
    return buildConfig({
      configName: "OSS",
      popup: {
        entry: path.resolve(__dirname, "src/popup/main.ts"),
        entryModule: "src/popup/app.module#AppModule",
      },
      background: {
        entry: path.resolve(__dirname, "src/platform/background.ts"),
      },
      tsConfig: "tsconfig.json",
    });
  }
};
