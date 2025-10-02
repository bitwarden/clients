const { buildConfig } = require("../../apps/browser/webpack.base");
const path = require("path");

module.exports = (webpackConfig, context) => {
  // Check if this is being called by Nx or directly by webpack CLI
  const isNxBuild = !!(context && context.options);

  let configs;

  if (isNxBuild) {
    // For Nx builds, calculate paths and set context correctly
    const projectRoot = process.cwd();
    const browserAppPath = path.join(projectRoot, "apps/browser");
    const oldCwd = process.cwd();
    process.chdir(browserAppPath);

    try {
      // Use bit-specific configuration directly
      configs = buildConfig({
        configName: "Commercial",
        popup: {
          entry: "../../bitwarden_license/bit-browser/src/popup/main.ts",
          entryModule: "../../bitwarden_license/bit-browser/src/popup/app.module#AppModule",
        },
        background: {
          entry: "../../bitwarden_license/bit-browser/src/platform/background.ts",
        },
        tsConfig: path.resolve(projectRoot, "bitwarden_license/bit-browser/tsconfig.build.json"),
      });

      // Fix each config to work with Nx
      configs.forEach((config) => {
        // Set webpack context to the browser app directory
        config.context = browserAppPath;

        // Override output path for Nx builds
        if (config.output && context.options && context.options.outputPath) {
          config.output.path = path.resolve(projectRoot, context.options.outputPath);
        }

        // Fix babel loader configFile path for Nx builds
        if (config.module && config.module.rules) {
          config.module.rules.forEach((rule) => {
            if (rule.use && Array.isArray(rule.use)) {
              rule.use.forEach((loader) => {
                if (
                  loader.loader === "babel-loader" &&
                  loader.options &&
                  loader.options.configFile
                ) {
                  // Update to use absolute path to babel config
                  loader.options.configFile = path.resolve(projectRoot, "babel.config.json");
                }
              });
            }
          });
        }
      });
    } finally {
      // Always restore the original working directory
      process.chdir(oldCwd);
    }
  } else {
    // Use standard npm configuration for backward compatibility
    configs = buildConfig({
      configName: "Commercial",
      popup: {
        entry: "../../bitwarden_license/bit-browser/src/popup/main.ts",
        entryModule: "../../bitwarden_license/bit-browser/src/popup/app.module#AppModule",
      },
      background: {
        entry: "../../bitwarden_license/bit-browser/src/platform/background.ts",
      },
      tsConfig: "../../bitwarden_license/bit-browser/tsconfig.json",
    });
  }

  return configs;
};
