const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

module.exports = (webpackConfig, context) => {
  // Check if this is being called by Nx or directly by webpack CLI
  const isNxBuild = !!(context && context.options);

  let config;

  if (isNxBuild) {
    // Use Nx configuration as base
    const nxConfig = require("../../apps/cli/webpack.nx.config.js");
    config = nxConfig(webpackConfig, context);

    // Apply bit-cli specific modifications for Nx builds
    config.entry = { bw: context.options.main || "bitwarden_license/bit-cli/src/bw.ts" };
    config.resolve.plugins = [new TsconfigPathsPlugin({ configFile: "tsconfig.base.json" })];

    // Update the locales path for bit-cli in Nx context
    const copyPlugin = config.plugins.find(
      (plugin) => plugin.constructor.name === "CopyWebpackPlugin",
    );
    if (copyPlugin) {
      copyPlugin.patterns = [{ from: "bitwarden_license/bit-cli/src/locales", to: "locales" }];
    }
  } else {
    // Use npm configuration as base
    const npmConfig = require("../../apps/cli/webpack.npm.config.js");
    config = { ...npmConfig };

    // Apply bit-cli specific modifications for npm builds
    config.entry = { bw: "../../bitwarden_license/bit-cli/src/bw.ts" };
    config.resolve.plugins = [
      new TsconfigPathsPlugin({ configFile: "../../bitwarden_license/bit-cli/tsconfig.json" }),
    ];

    // Update the locales path for bit-cli (relative to bit-cli directory)
    const copyPlugin = config.plugins.find(
      (plugin) => plugin.constructor.name === "CopyWebpackPlugin",
    );
    if (copyPlugin) {
      copyPlugin.patterns = [{ from: "./src/locales", to: "locales" }];
    }
  }

  return config;
};
