const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { AngularWebpackPlugin } = require("@ngtools/webpack");
const TerserPlugin = require("terser-webpack-plugin");
const { TsconfigPathsPlugin } = require("tsconfig-paths-webpack-plugin");
const configurator = require("./config/config");
const manifest = require("./webpack/manifest");
const AngularCheckPlugin = require("./webpack/angular-check");

module.exports.getEnv = function getEnv(params) {
  const ENV = params.env || (process.env.ENV = process.env.NODE_ENV);
  const manifestVersion = process.env.MANIFEST_VERSION == 3 ? 3 : 2;
  const browser = process.env.BROWSER ?? "chrome";

  return { ENV, manifestVersion, browser };
};

const DEFAULT_PARAMS = {
  outputPath: path.resolve(__dirname, "build"),
};

/**
 * @param {{
 *  configName: string;
 *  popup: {
 *    entry: string;
 *    entryModule: string;
 *  };
 *  background: {
 *    entry: string;
 *  };
 *  tsConfig: string;
 *  outputPath?: string;
 *  mode?: string;
 *  env?: string;
 *  additionalEntries?: { [outputPath: string]: string };
 *  importAliases?: import("webpack").ResolveOptions["alias"];
 * }} params - The input parameters for building the config.
 */
module.exports.buildConfig = function buildConfig(params) {
  params = { ...DEFAULT_PARAMS, ...params };

  if (process.env.NODE_ENV == null) {
    process.env.NODE_ENV = "development";
  }

  const { ENV, manifestVersion, browser } = module.exports.getEnv(params);

  console.log(`Building Manifest Version ${manifestVersion} app - ${params.configName} version`);

  const envConfig = configurator.load(ENV);
  configurator.log(envConfig);

  const moduleRules = [
    {
      test: /\.(html)$/,
      loader: "html-loader",
    },
    {
      test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
      exclude: /loading.svg/,
      generator: {
        filename: "popup/fonts/[name].[contenthash][ext]",
      },
      type: "asset/resource",
    },
    {
      test: /\.(jpe?g|png|gif|svg)$/i,
      exclude: /.*(bwi-font|glyphicons-halflings-regular)\.svg/,
      generator: {
        filename: "popup/images/[name][ext]",
      },
      type: "asset/resource",
    },
    {
      test: /\.css$/,
      use: [
        {
          loader: MiniCssExtractPlugin.loader,
        },
        "css-loader",
        "resolve-url-loader",
        {
          loader: "postcss-loader",
          options: {
            sourceMap: true,
          },
        },
      ],
    },
    {
      test: /\.scss$/,
      use: [
        {
          loader: MiniCssExtractPlugin.loader,
        },
        "css-loader",
        "resolve-url-loader",
        {
          loader: "sass-loader",
          options: {
            sourceMap: true,
          },
        },
      ],
    },
    {
      test: /\.[cm]?js$/,
      use: [
        {
          loader: "babel-loader",
          options: {
            configFile: path.resolve(__dirname, "../../babel.config.json"),
            cacheDirectory: ENV === "development",
            compact: ENV !== "development",
          },
        },
      ],
    },
    {
      test: /\.[jt]sx?$/,
      loader: "@ngtools/webpack",
    },
  ];

  const requiredPlugins = [
    new webpack.DefinePlugin({
      "process.env": {
        ENV: JSON.stringify(ENV),
      },
    }),
    new webpack.EnvironmentPlugin({
      FLAGS: envConfig.flags,
      DEV_FLAGS: ENV === "development" ? envConfig.devFlags : {},
    }),
  ];

  const plugins = [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/popup/index.ejs"),
      filename: "popup/index.html",
      chunks: ["popup/polyfills", "popup/vendor-angular", "popup/vendor", "popup/main"],
      browser: browser,
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/autofill/notification/bar.html"),
      filename: "notification/bar.html",
      chunks: ["notification/bar"],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(
        __dirname,
        "src/autofill/overlay/inline-menu/pages/button/button.html",
      ),
      filename: "overlay/menu-button.html",
      chunks: ["overlay/menu-button"],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/autofill/overlay/inline-menu/pages/list/list.html"),
      filename: "overlay/menu-list.html",
      chunks: ["overlay/menu-list"],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(
        __dirname,
        "src/autofill/overlay/inline-menu/pages/menu-container/menu-container.html",
      ),
      filename: "overlay/menu.html",
      chunks: ["overlay/menu"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from:
            manifestVersion == 3
              ? path.resolve(__dirname, "src/manifest.v3.json")
              : path.resolve(__dirname, "src/manifest.json"),
          to: "manifest.json",
          transform: manifest.transform(browser),
        },
        { from: path.resolve(__dirname, "src/managed_schema.json"), to: "managed_schema.json" },
        { from: path.resolve(__dirname, "src/_locales"), to: "_locales" },
        { from: path.resolve(__dirname, "src/images"), to: "images" },
        { from: path.resolve(__dirname, "src/popup/images"), to: "popup/images" },
        { from: path.resolve(__dirname, "src/autofill/content/autofill.css"), to: "content" },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "chunk-[id].css",
    }),
    new AngularWebpackPlugin({
      tsconfig: params.tsConfig,
      entryModule: params.popup.entryModule,
      sourceMap: true,
    }),
    new webpack.ProvidePlugin({
      process: "process/browser.js",
    }),
    new webpack.SourceMapDevToolPlugin({
      exclude: [/content\/.*/, /notification\/.*/, /overlay\/.*/],
      filename: "[file].map",
    }),
    ...requiredPlugins,
  ];

  /**
   * @type {import("webpack").Configuration}
   * This config compiles everything but the background
   */
  const mainConfig = {
    name: "main",
    mode: ENV,
    devtool: false,

    entry: {
      "popup/polyfills": path.resolve(__dirname, "src/popup/polyfills.ts"),
      "popup/main": params.popup.entry,
      "content/trigger-autofill-script-injection": path.resolve(
        __dirname,
        "src/autofill/content/trigger-autofill-script-injection.ts",
      ),
      "content/bootstrap-autofill": path.resolve(
        __dirname,
        "src/autofill/content/bootstrap-autofill.ts",
      ),
      "content/bootstrap-autofill-overlay": path.resolve(
        __dirname,
        "src/autofill/content/bootstrap-autofill-overlay.ts",
      ),
      "content/bootstrap-autofill-overlay-menu": path.resolve(
        __dirname,
        "src/autofill/content/bootstrap-autofill-overlay-menu.ts",
      ),
      "content/bootstrap-autofill-overlay-notifications": path.resolve(
        __dirname,
        "src/autofill/content/bootstrap-autofill-overlay-notifications.ts",
      ),
      "content/autofiller": path.resolve(__dirname, "src/autofill/content/autofiller.ts"),
      "content/auto-submit-login": path.resolve(
        __dirname,
        "src/autofill/content/auto-submit-login.ts",
      ),
      "content/contextMenuHandler": path.resolve(
        __dirname,
        "src/autofill/content/context-menu-handler.ts",
      ),
      "content/content-message-handler": path.resolve(
        __dirname,
        "src/autofill/content/content-message-handler.ts",
      ),
      "content/fido2-content-script": path.resolve(
        __dirname,
        "src/autofill/fido2/content/fido2-content-script.ts",
      ),
      "content/fido2-page-script": path.resolve(
        __dirname,
        "src/autofill/fido2/content/fido2-page-script.ts",
      ),
      "content/ipc-content-script": path.resolve(
        __dirname,
        "src/platform/ipc/content/ipc-content-script.ts",
      ),
      "notification/bar": path.resolve(__dirname, "src/autofill/notification/bar.ts"),
      "overlay/menu-button": path.resolve(
        __dirname,
        "src/autofill/overlay/inline-menu/pages/button/bootstrap-autofill-inline-menu-button.ts",
      ),
      "overlay/menu-list": path.resolve(
        __dirname,
        "src/autofill/overlay/inline-menu/pages/list/bootstrap-autofill-inline-menu-list.ts",
      ),
      "overlay/menu": path.resolve(
        __dirname,
        "src/autofill/overlay/inline-menu/pages/menu-container/bootstrap-autofill-inline-menu-container.ts",
      ),
      "content/send-on-installed-message": path.resolve(
        __dirname,
        "src/vault/content/send-on-installed-message.ts",
      ),
      "content/send-popup-open-message": path.resolve(
        __dirname,
        "src/vault/content/send-popup-open-message.ts",
      ),
      ...params.additionalEntries,
    },
    cache:
      ENV !== "development"
        ? false
        : {
            type: "filesystem",
            name: "main-cache",
            cacheDirectory: path.resolve(
              __dirname,
              "../../node_modules/.cache/webpack-browser-main",
            ),
            buildDependencies: {
              config: [__filename],
            },
          },
    snapshot: {
      unmanagedPaths: [path.resolve(__dirname, "../../node_modules/@bitwarden/")],
    },
    optimization: {
      minimize: ENV !== "development",
      minimizer: [
        new TerserPlugin({
          exclude: [/content\/.*/, /notification\/.*/, /overlay\/.*/],
          terserOptions: {
            // Replicate Angular CLI behaviour
            compress: {
              global_defs: {
                ngDevMode: false,
                ngI18nClosureMode: false,
              },
            },
          },
        }),
      ],
      splitChunks: {
        cacheGroups: {
          commons: {
            test(module, chunks) {
              return (
                module.resource != null &&
                module.resource.includes(`${path.sep}node_modules${path.sep}`) &&
                !module.resource.includes(`${path.sep}node_modules${path.sep}@angular${path.sep}`)
              );
            },
            name: "popup/vendor",
            chunks: (chunk) => {
              return chunk.name === "popup/main";
            },
          },
          angular: {
            test(module, chunks) {
              return (
                module.resource != null &&
                module.resource.includes(`${path.sep}node_modules${path.sep}@angular${path.sep}`)
              );
            },
            name: "popup/vendor-angular",
            chunks: (chunk) => {
              return chunk.name === "popup/main";
            },
          },
        },
      },
    },
    resolve: {
      extensions: [".ts", ".js"],
      symlinks: false,
      modules: [path.resolve(__dirname, "../../node_modules")],
      fallback: {
        assert: false,
        buffer: require.resolve("buffer/"),
        util: require.resolve("util/"),
        url: require.resolve("url/"),
        fs: false,
        path: require.resolve("path-browserify"),
      },
      cache: true,
      alias: params.importAliases,
    },
    output: {
      filename: "[name].js",
      chunkFilename: "assets/[name].js",
      webassemblyModuleFilename: "assets/[modulehash].wasm",
      path: params.outputPath,
      clean: true,
    },
    module: {
      rules: moduleRules,
    },
    experiments: {
      asyncWebAssembly: true,
    },
    plugins: plugins,
  };

  /**
   * @type {import("webpack").Configuration[]}
   */
  const configs = [];

  if (manifestVersion == 2) {
    mainConfig.optimization.splitChunks.cacheGroups.commons2 = {
      test: /[\\/]node_modules[\\/]/,
      name: "vendor",
      chunks: (chunk) => {
        return chunk.name === "background";
      },
    };

    // Manifest V2 uses Background Pages which requires a html page.
    mainConfig.plugins.push(
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "src/platform/background.html"),
        filename: "background.html",
        chunks: ["vendor", "background"],
      }),
    );

    // Manifest V2 background pages can be run through the regular build pipeline.
    // Since it's a standard webpage.
    mainConfig.entry.background = params.background.entry;
    mainConfig.entry["content/fido2-page-script-delay-append-mv2"] = path.resolve(
      __dirname,
      "src/autofill/fido2/content/fido2-page-script-delay-append.mv2.ts",
    );

    configs.push(mainConfig);
  } else {
    // Firefox does not use the offscreen API
    if (browser !== "firefox") {
      mainConfig.entry["offscreen-document/offscreen-document"] = path.resolve(
        __dirname,
        "src/platform/offscreen-document/offscreen-document.ts",
      );

      mainConfig.plugins.push(
        new HtmlWebpackPlugin({
          template: path.resolve(__dirname, "src/platform/offscreen-document/index.html"),
          filename: "offscreen-document/index.html",
          chunks: ["offscreen-document/offscreen-document"],
        }),
      );
    }

    const target = browser === "firefox" ? "web" : "webworker";

    /**
     * @type {import("webpack").Configuration}
     */
    const backgroundConfig = {
      name: "background",
      mode: ENV,
      devtool: ENV === "development" ? "source-map" : false,

      entry: params.background.entry,
      target: target,
      output: {
        filename: "background.js",
        path: params.outputPath,
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            loader: "ts-loader",
            options: {
              compilerOptions: {
                sourceMap: true,
              },
            },
          },
        ],
      },
      cache:
        ENV !== "development"
          ? false
          : {
              type: "filesystem",
              name: "background-cache",
              cacheDirectory: path.resolve(
                __dirname,
                "../../node_modules/.cache/webpack-browser-background",
              ),
              buildDependencies: {
                config: [__filename],
              },
            },
      snapshot: {
        unmanagedPaths: [path.resolve(__dirname, "../../node_modules/@bitwarden/")],
      },
      experiments: {
        asyncWebAssembly: true,
      },
      resolve: {
        extensions: [".ts", ".js"],
        symlinks: false,
        modules: [path.resolve(__dirname, "../../node_modules")],
        plugins: [new TsconfigPathsPlugin()],
        fallback: {
          fs: false,
          path: require.resolve("path-browserify"),
        },
        cache: true,
        alias: params.importAliases,
      },
      dependencies: ["main"],
      plugins: [...requiredPlugins, new AngularCheckPlugin()],
    };

    // Safari's desktop build process requires a background.html and vendor.js file to exist
    // within the root of the extension. This is a workaround to allow us to build Safari
    // for manifest v2 and v3 without modifying the desktop project structure.
    if (browser === "safari") {
      backgroundConfig.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.resolve(__dirname, "src/safari/mv3/fake-background.html"),
              to: "background.html",
            },
            { from: path.resolve(__dirname, "src/safari/mv3/fake-vendor.js"), to: "vendor.js" },
          ],
        }),
      );
    }

    configs.push(mainConfig);
    configs.push(backgroundConfig);
  }

  return configs;
};
