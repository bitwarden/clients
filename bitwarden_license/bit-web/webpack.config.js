const { AngularWebpackPlugin } = require("@ngtools/webpack");

module.exports = (webpackConfig, context) => {
  // Check if this is being called by Nx or directly by webpack CLI
  const isNxBuild = !!(context && context.options);

  let config;

  if (isNxBuild) {
    // Use Nx configuration as base
    const nxConfig = require("../../apps/web/webpack.nx.config.js");
    config = nxConfig(webpackConfig, context);

    // Apply bit-web specific modifications for Nx builds
    config.entry["app/main"] = context.options.main || "bitwarden_license/bit-web/src/main.ts";

    // Update Angular plugin for bit-web in Nx context
    const angularPluginIndex = config.plugins.findIndex(
      (plugin) => plugin.constructor.name === "AngularWebpackPlugin",
    );
    if (angularPluginIndex !== -1) {
      config.plugins[angularPluginIndex] = new AngularWebpackPlugin({
        tsconfig: "bitwarden_license/bit-web/tsconfig.build.json",
        entryModule: "bitwarden_license/src/app/app.module#AppModule",
        sourceMap: true,
      });
    }
  } else {
    // Use npm configuration as base
    const npmConfig = require("../../apps/web/webpack.npm.config.js");
    config = { ...npmConfig };

    // Apply bit-web specific modifications for npm builds
    config.entry["app/main"] = "../../bitwarden_license/bit-web/src/main.ts";

    // Update Angular plugin for bit-web (npm builds)
    const angularPluginIndex = config.plugins.findIndex(
      (plugin) => plugin.constructor.name === "AngularWebpackPlugin",
    );
    if (angularPluginIndex !== -1) {
      config.plugins[angularPluginIndex] = new AngularWebpackPlugin({
        tsconfig: "../../bitwarden_license/bit-web/tsconfig.build.json",
        entryModule: "bitwarden_license/src/app/app.module#AppModule",
        sourceMap: true,
      });
    }
  }

  return config;
};
