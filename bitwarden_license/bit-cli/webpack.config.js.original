const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

// Re-use the OSS CLI webpack config
const webpackConfig = require("../../apps/cli/webpack.config");

// Update paths to use the bit-cli entrypoint and tsconfig
webpackConfig.entry = { bw: "../../bitwarden_license/bit-cli/src/bw.ts" };
webpackConfig.resolve.plugins = [
  new TsconfigPathsPlugin({ configFile: "../../bitwarden_license/bit-cli/tsconfig.json" }),
];

module.exports = webpackConfig;
