const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { AngularWebpackPlugin } = require("@ngtools/webpack");
const TerserPlugin = require("terser-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const { EnvironmentPlugin, DefinePlugin } = require("webpack");
const configurator = require(path.resolve(__dirname, "config/config"));

module.exports.getEnv = function getEnv() {
  const NODE_ENV = process.env.NODE_ENV == null ? "development" : process.env.NODE_ENV;
  const ENV = process.env.ENV == null ? "development" : process.env.ENV;

  return { NODE_ENV, ENV };
};

const DEFAULT_PARAMS = {
  outputPath: process.env.OUTPUT_PATH
    ? path.isAbsolute(process.env.OUTPUT_PATH)
      ? process.env.OUTPUT_PATH
      : path.resolve(__dirname, process.env.OUTPUT_PATH)
    : path.resolve(__dirname, "build"),
};

/**
 * @param {{
 *  configName: string;
 *  renderer: {
 *    entry: string;
 *    entryModule: string;
 *    tsConfig: string;
 *  };
 *  main: {
 *    entry: string;
 *    tsConfig: string;
 *  };
 *  preload: {
 *    entry: string;
 *    tsConfig: string;
 *  };
 *  outputPath?: string;
 * }} params
 */
module.exports.buildConfig = function buildConfig(params) {
  params = { ...DEFAULT_PARAMS, ...params };
  const { NODE_ENV, ENV } = module.exports.getEnv();

  console.log(`Building ${params.configName} Desktop App`);

  const envConfig = configurator.load(NODE_ENV, process.env.CHANNEL);
  configurator.log(envConfig);

  const commonConfig = {
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      symlinks: false,
      modules: [
        path.resolve(__dirname, "../../node_modules"),
        path.resolve(process.cwd(), "node_modules"),
      ],
    },
  };

  // When the @bitwarden SDK is linked to a local build (a `file:` dependency or
  // `npm link`, which npm materializes as a symlink under node_modules), rebuilding
  // the SDK does not get picked up by `--watch` for two independent reasons, both of
  // which must be addressed:
  //
  //  1. Webpack treats node_modules as "managed" by default and validates those
  //     packages by their package.json version rather than by file content. The
  //     local SDK build keeps a static version, so a rebuild looks unchanged and the
  //     stale module is served from cache. Excluding the SDK from managedPaths makes
  //     webpack content-hash it like first-party source.
  //  2. resolve.symlinks is false, so webpack watches the SDK via its node_modules
  //     symlink path, but macOS FSEvents delivers change events against the SDK's
  //     real path, so the native watcher never sees the rebuild. Polling observes
  //     the files directly and catches it.
  //
  // Both are gated on the SDK actually being a local symlink: a normal install pulls
  // the SDK from the registry as a plain directory, where managed-path caching is
  // correct and polling would only waste CPU.
  const sdkLinkPaths = [
    path.resolve(__dirname, "../../node_modules/@bitwarden/sdk-internal"),
    path.resolve(process.cwd(), "node_modules/@bitwarden/sdk-internal"),
  ];
  const isLocalLinkedSdk = sdkLinkPaths.some((p) => {
    try {
      return fs.lstatSync(p).isSymbolicLink();
    } catch {
      return false;
    }
  });
  const localSdkWatch = isLocalLinkedSdk
    ? {
        snapshot: {
          managedPaths: [
            /^(.+?[\\/]node_modules[\\/](?!@bitwarden[\\/](commercial-)?sdk-internal[\\/]))/,
          ],
        },
        watchOptions: {
          poll: 1000,
        },
      }
    : {};

  const getOutputConfig = (isDev) => ({
    filename: "[name].js",
    path: params.outputPath,
    ...(isDev && { devtoolModuleFilenameTemplate: "[absolute-resource-path]" }),
  });

  const mainConfig = {
    name: "main",
    mode: NODE_ENV,
    ...localSdkWatch,
    target: "electron-main",
    node: {
      __dirname: false,
      __filename: false,
    },
    entry: {
      main: params.main.entry,
    },
    optimization: {
      minimize: false,
    },
    output: getOutputConfig(NODE_ENV === "development"),
    devtool: NODE_ENV === "development" ? "cheap-source-map" : false,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: { configFile: params.main.tsConfig },
          },
          exclude: /node_modules\/(?!(@bitwarden)\/).*/,
        },
        {
          test: /\.node$/,
          loader: "node-loader",
        },
      ],
    },
    experiments: {
      asyncWebAssembly: true,
    },
    resolve: {
      ...commonConfig.resolve,
      plugins: [new TsconfigPathsPlugin({ configFile: params.main.tsConfig })],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          path.resolve(__dirname, "src/package.json"),
          // For beta builds (CHANNEL=beta), *_beta.{png,ico} variants overwrite their
          // default siblings so the runtime tray/window icons resolve to beta assets
          // without any code changes. Non-beta builds filter *_beta.* out entirely.
          {
            from: path.resolve(__dirname, "src/images"),
            to: "images",
            filter: (resourcePath) => !/_beta\.(png|ico)$/.test(resourcePath),
          },
          ...(process.env.CHANNEL === "beta"
            ? [
                {
                  context: path.resolve(__dirname, "src/images"),
                  from: "*_beta.{png,ico}",
                  to({ absoluteFilename }) {
                    return path.join(
                      "images",
                      path.basename(absoluteFilename).replace("_beta", ""),
                    );
                  },
                  force: true,
                },
              ]
            : []),
          { from: path.resolve(__dirname, "src/locales"), to: "locales" },
        ],
      }),
      new DefinePlugin({
        BIT_ENVIRONMENT: JSON.stringify(NODE_ENV),
      }),
      new EnvironmentPlugin({
        FLAGS: envConfig.flags,
        DEV_FLAGS: NODE_ENV === "development" ? envConfig.devFlags : {},
      }),
    ],
    externals: {
      "electron-reload": "commonjs2 electron-reload",
      "@bitwarden/desktop-napi": "commonjs2 @bitwarden/desktop-napi",
    },
  };

  const preloadConfig = {
    name: "preload",
    mode: NODE_ENV,
    ...localSdkWatch,
    target: "electron-preload",
    node: {
      __dirname: false,
      __filename: false,
    },
    entry: {
      preload: params.preload.entry,
    },
    optimization: {
      minimize: false,
    },
    output: getOutputConfig(NODE_ENV === "development"),
    devtool: NODE_ENV === "development" ? "cheap-source-map" : false,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: { configFile: params.preload.tsConfig },
          },
          exclude: /node_modules\/(?!(@bitwarden)\/).*/,
        },
      ],
    },
    resolve: {
      ...commonConfig.resolve,
      plugins: [new TsconfigPathsPlugin({ configFile: params.preload.tsConfig })],
    },
    plugins: [
      new DefinePlugin({
        BIT_ENVIRONMENT: JSON.stringify(NODE_ENV),
      }),
    ],
  };

  const rendererConfig = {
    name: "renderer",
    mode: NODE_ENV,
    ...localSdkWatch,
    devtool: "source-map",
    target: "web",
    node: {
      __dirname: false,
    },
    entry: {
      "app/main": params.renderer.entry,
    },
    output: {
      filename: "[name].js",
      path: params.outputPath,
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
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
            test: /[\\/]node_modules[\\/]/,
            name: "app/vendor",
            chunks: (chunk) => {
              return chunk.name === "app/main";
            },
          },
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.[cm]?js$/,
          exclude: /\.wasm\.js$/,
          use: [
            {
              loader: "babel-loader",
              options: {
                configFile: path.resolve(__dirname, "../../babel.config.json"),
              },
            },
          ],
        },
        {
          test: /\.[jt]sx?$/,
          loader: "@ngtools/webpack",
        },
        {
          test: /\.(html)$/,
          loader: "html-loader",
        },
        {
          test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
          exclude: /loading.svg/,
          generator: {
            filename: "fonts/[name].[contenthash][ext]",
          },
          type: "asset/resource",
        },
        {
          test: /\.(jpe?g|png|gif|svg)$/i,
          exclude: /.*(bwi-font)\.svg/,
          generator: {
            filename: "images/[name][ext]",
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
              options: {
                publicPath: "../",
              },
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
        // Hide System.import warnings. ref: https://github.com/angular/angular/issues/21560
        {
          test: /[\/\\]@angular[\/\\].+\.js$/,
          parser: { system: true },
        },
      ],
    },
    experiments: {
      asyncWebAssembly: true,
    },
    resolve: {
      ...commonConfig.resolve,
      fallback: {
        path: require.resolve("path-browserify"),
        fs: false,
      },
    },
    plugins: [
      new AngularWebpackPlugin({
        tsconfig: params.renderer.tsConfig,
        entryModule: params.renderer.entryModule,
        sourceMap: true,
      }),
      // ref: https://github.com/angular/angular/issues/20357
      new webpack.ContextReplacementPlugin(
        /\@angular(\\|\/)core(\\|\/)fesm5/,
        path.resolve(__dirname, "./src"),
      ),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "src/index.html"),
        filename: "index.html",
        chunks: ["app/vendor", "app/main"],
      }),
      new webpack.SourceMapDevToolPlugin({
        include: ["app/main.js"],
      }),
      new MiniCssExtractPlugin({
        filename: "[name].[contenthash].css",
        chunkFilename: "[id].[contenthash].css",
      }),
      new webpack.DefinePlugin({
        BIT_ENVIRONMENT: JSON.stringify(NODE_ENV),
      }),
      new webpack.EnvironmentPlugin({
        ENV: ENV,
        FLAGS: envConfig.flags,
        DEV_FLAGS: NODE_ENV === "development" ? envConfig.devFlags : {},
        ADDITIONAL_REGIONS: envConfig.additionalRegions ?? [],
      }),
    ],
  };

  return [mainConfig, rendererConfig, preloadConfig];
};
