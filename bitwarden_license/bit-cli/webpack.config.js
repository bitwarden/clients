const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

module.exports = (webpackConfig, context) => {
  const isNxBuild = !!(context && context.options);

  let config;

  if (isNxBuild) {
    const nxConfig = require("../../apps/cli/webpack.nx.config.js");
    config = nxConfig(webpackConfig, context);

    config.entry = { bw: context.options.main || "bitwarden_license/bit-cli/src/bw.ts" };
    config.resolve.plugins = [new TsconfigPathsPlugin({ configFile: "tsconfig.base.json" })];

    const copyPlugin = config.plugins.find(
      (plugin) => plugin.constructor.name === "CopyWebpackPlugin",
    );
    if (copyPlugin) {
      copyPlugin.patterns = [{ from: "bitwarden_license/bit-cli/src/locales", to: "locales" }];
    }
  } else {
    const npmConfig = require("../../apps/cli/webpack.npm.config.js");
    config = { ...npmConfig };

    config.entry = { bw: "../../bitwarden_license/bit-cli/src/bw.ts" };
    config.resolve.plugins = [
      new TsconfigPathsPlugin({ configFile: "../../bitwarden_license/bit-cli/tsconfig.json" }),
    ];

    const copyPlugin = config.plugins.find(
      (plugin) => plugin.constructor.name === "CopyWebpackPlugin",
    );
    if (copyPlugin) {
      copyPlugin.patterns = [{ from: "./src/locales", to: "locales" }];
    }
  }

  return config;
};
