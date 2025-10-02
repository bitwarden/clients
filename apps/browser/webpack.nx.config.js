// webpack.nx.config.js - Nx-optimized configuration for browser extension
const { buildConfig } = require("./webpack.base");
const path = require("path");

module.exports = (webpackConfig, context) => {
  // Get environment variables from Nx configuration or process.env
  const browser =
    (context && context.options && context.options.env && context.options.env.BROWSER) ||
    process.env.BROWSER ||
    "chrome";
  const manifestVersion =
    (context && context.options && context.options.env && context.options.env.MANIFEST_VERSION) ||
    process.env.MANIFEST_VERSION ||
    "3";
  const nodeEnv =
    (context && context.options && context.options.env && context.options.env.NODE_ENV) ||
    process.env.NODE_ENV ||
    "development";

  // Set environment variables for buildConfig
  process.env.BROWSER = browser;
  process.env.MANIFEST_VERSION = manifestVersion;
  process.env.NODE_ENV = nodeEnv;

  // Calculate paths relative to the project root and browser app
  const projectRoot = process.cwd();
  const browserAppPath = path.join(projectRoot, "apps/browser");

  // Change working directory to apps/browser for proper path resolution
  const oldCwd = process.cwd();
  process.chdir(browserAppPath);

  try {
    // Generate the configuration using the existing buildConfig function
    const configs = buildConfig({
      configName: "OSS",
      popup: {
        entry: "./src/popup/main.ts",
        entryModule: "src/popup/app.module#AppModule",
      },
      background: {
        entry: "./src/platform/background.ts",
      },
      tsConfig: path.join(browserAppPath, "tsconfig.build.json"),
    });

    // Fix each config to work with Nx
    configs.forEach((config) => {
      // Set webpack context to the browser app directory
      config.context = browserAppPath;

      // Override output path for Nx builds
      if (context && context.options && context.options.outputPath) {
        config.output.path = path.resolve(projectRoot, context.options.outputPath);
      }

      // Fix babel loader configFile path for Nx builds
      if (config.module && config.module.rules) {
        config.module.rules.forEach((rule) => {
          if (rule.use && Array.isArray(rule.use)) {
            rule.use.forEach((loader) => {
              if (loader.loader === "babel-loader" && loader.options && loader.options.configFile) {
                // Update to use absolute path to babel config
                loader.options.configFile = path.resolve(projectRoot, "babel.config.json");
              }
            });
          }
        });
      }
    });

    // Return the array of configurations for webpack multi-config builds
    return configs;
  } finally {
    // Always restore the original working directory
    process.chdir(oldCwd);
  }
};
