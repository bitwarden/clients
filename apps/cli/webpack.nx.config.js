const path = require("path");
const { getSharedConfig } = require("./webpack.shared");

module.exports = (webpackConfig, context) => {
  const mode = context.options.mode || "development";
  if (process.env.NODE_ENV == null) {
    process.env.NODE_ENV = mode;
  }
  const ENV = (process.env.ENV = process.env.NODE_ENV);

  const options = {
    env: ENV,
    mode: mode,
    entryPoint: context.options.main || "apps/cli/src/bw.ts",
    outputPath: path.resolve(context.context.root, context.options.outputPath),
    modulesPath: [path.resolve("node_modules")],
    tsconfigPath: "tsconfig.base.json",
    localesPath: "apps/cli/src/locales",
    externalsModulesDir: "node_modules",
    watch: context.options.watch || false,
  };

  return getSharedConfig(options);
};
