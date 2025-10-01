const { AngularWebpackPlugin } = require("@ngtools/webpack");

const webpackConfig = require("../../apps/web/webpack.config");

webpackConfig.entry["app/main"] = "../../bitwarden_license/bit-web/src/main.ts";
webpackConfig.plugins[webpackConfig.plugins.length - 1] = new AngularWebpackPlugin({
  tsconfig: "../../bitwarden_license/bit-web/tsconfig.build.json",
  entryModule: "bitwarden_license/src/app/app.module#AppModule",
  sourceMap: true,
});

module.exports = webpackConfig;
