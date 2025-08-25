const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

// Re-use the OSS CLI webpack config function
const webpackConfigFn = require("../../apps/cli/webpack.config");

module.exports = (webpackConfig, context) => {
  // Check if this is being called by Nx or directly by webpack CLI
  const isNxBuild = !!(context && context.options);

  // Get the base config from the OSS CLI
  const config = webpackConfigFn(webpackConfig, context);

  if (isNxBuild) {
    // Nx build - override with context-provided values or defaults
    config.entry = { bw: context.options.main || "bitwarden_license/bit-cli/src/bw.ts" };
    config.resolve.plugins = [new TsconfigPathsPlugin({ configFile: "tsconfig.base.json" })];

    // Update the locales path for bit-cli
    const copyPlugin = config.plugins.find(
      (plugin) => plugin.constructor.name === "CopyWebpackPlugin",
    );
    if (copyPlugin) {
      copyPlugin.patterns = [{ from: "bitwarden_license/bit-cli/src/locales", to: "locales" }];
    }
  } else {
    // Direct webpack CLI build - use original relative paths
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
