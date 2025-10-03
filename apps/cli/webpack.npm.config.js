// We also support building the cli with nx, which uses a different webpack
// config. We support the old npm config here for because the nx
// migration is incomplete. Eventually we'll be dropping support for
// webpack.npm.config and npm builds in general, so if you make changes to
// this config please ensure they are also applied to nx builds. Reach out to
// Platform if you have any questions about this.
const path = require("path");
const { getSharedConfig } = require("./webpack.shared");

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = "development";
}
const ENV = (process.env.ENV = process.env.NODE_ENV);
const mode = ENV;

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
