const path = require("path");
const { getSharedConfig } = require("./webpack.shared");

// Original npm/webpack CLI logic
if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = "development";
}
const ENV = (process.env.ENV = process.env.NODE_ENV);
const mode = ENV;

// npm-specific path configuration
const options = {
  env: ENV,
  mode: mode,
  entryPoint: "./src/bw.ts",
  outputPath: path.resolve(__dirname, "build"),
  modulesPath: [path.resolve("../../node_modules")],
  tsconfigPath: "./tsconfig.json",
  localesPath: "./src/locales",
  externalsModulesDir: "../../node_modules",
};

module.exports = getSharedConfig(options);
