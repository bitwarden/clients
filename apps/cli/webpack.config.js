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

    return buildConfig({
      configName: "OSS",
      entry: context.options.main || "apps/cli/src/bw.ts",
      tsConfig: "tsconfig.base.json",
      outputPath: path.resolve(context.context.root, context.options.outputPath),
      mode: mode,
      env: ENV,
      modulesPath: [path.resolve("node_modules")],
      localesPath: "apps/cli/src/locales",
      externalsModulesDir: "node_modules",
      watch: context.options.watch || false,
    });
  } else {
    // npm build configuration
    if (process.env.NODE_ENV == null) {
      process.env.NODE_ENV = "development";
    }
    const ENV = (process.env.ENV = process.env.NODE_ENV);
    const mode = ENV;

    return buildConfig({
      configName: "OSS",
      entry: "./src/bw.ts",
      tsConfig: "./tsconfig.json",
      outputPath: path.resolve(__dirname, "build"),
      mode: mode,
      env: ENV,
      modulesPath: [path.resolve("../../node_modules")],
      localesPath: "./src/locales",
      externalsModulesDir: "../../node_modules",
    });
  }
};
