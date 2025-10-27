const path = require("path");
const { buildConfig } = require(path.resolve(__dirname, "../../apps/web/webpack.base"));

module.exports = (webpackConfig, context) => {
  const isNxBuild = context && context.options;
  if (isNxBuild) {
    return buildConfig({
      configName: "Commercial",
      app: {
        entry: context.options.main
          ? path.resolve(context.context.root, context.options.main)
          : path.resolve(__dirname, "src/main.ts"),
        entryModule: "bitwarden_license/bit-web/src/app/app.module#AppModule",
      },
      tsConfig: "bitwarden_license/bit-web/tsconfig.build.json",
      outputPath:
        context.context && context.context.root
          ? path.resolve(context.context.root, context.options.outputPath)
          : context.options.outputPath,
      importAliases: [
        {
          name: "@bitwarden/sdk-internal",
          alias: "@bitwarden/commercial-sdk-internal",
        },
      ],
    });
  } else {
    return buildConfig({
      configName: "Commercial",
      app: {
        entry: path.resolve(__dirname, "src/main.ts"),
        entryModule: "bitwarden_license/bit-web/src/app/app.module#AppModule",
      },
      tsConfig: path.resolve(__dirname, "tsconfig.build.json"),
      importAliases: [
        {
          name: "@bitwarden/sdk-internal",
          alias: "@bitwarden/commercial-sdk-internal",
        },
      ],
    });
  }
};
