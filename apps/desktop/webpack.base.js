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

  const envConfig = configurator.load(NODE_ENV);
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

  const getOutputConfig = (isDev) => ({
    filename: "[name].js",
    path: params.outputPath,
    ...(isDev && { devtoolModuleFilenameTemplate: "[absolute-resource-path]" }),
  });

  const mainConfig = {
    name: "main",
    mode: NODE_ENV,
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
          use: "ts-loader",
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
          { from: path.resolve(__dirname, "src/images"), to: "images" },
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
          use: "ts-loader",
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
        tsConfigPath: params.renderer.tsConfig,
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
