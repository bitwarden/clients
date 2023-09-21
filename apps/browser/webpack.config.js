const path = require("path");
const webpack = require("webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { AngularWebpackPlugin } = require("@ngtools/webpack");
const TerserPlugin = require("terser-webpack-plugin");
const { TsconfigPathsPlugin } = require("tsconfig-paths-webpack-plugin");
const configurator = require("./config/config");

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = "development";
}
const ENV = (process.env.ENV = process.env.NODE_ENV);
const manifestVersion = process.env.MANIFEST_VERSION == 3 ? 3 : 2;

console.log(`Building Manifest Version ${manifestVersion} app`);

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
      filename: "popup/fonts/[name][ext]",
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
      "postcss-loader",
    ],
  },
  {
    test: /\.scss$/,
    use: [
      {
        loader: MiniCssExtractPlugin.loader,
      },
      "css-loader",
      "sass-loader",
    ],
  },
  {
    test: /\.[cm]?js$/,
    use: [
      {
        loader: "babel-loader",
        options: {
          configFile: false,
          plugins: ["@angular/compiler-cli/linker/babel"],
        },
      },
    ],
  },
  {
    test: /\.[jt]sx?$/,
    loader: "@ngtools/webpack",
  },
  {
    test: /\.wasm$/,
    loader: "base64-loader",
    type: "javascript/auto",
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
    template: "./src/popup/index.html",
    filename: "popup/index.html",
    chunks: ["popup/polyfills", "popup/vendor-angular", "popup/vendor", "popup/main"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/notification/bar.html",
    filename: "notification/bar.html",
    chunks: ["notification/bar"],
  }),
  new CopyWebpackPlugin({
    patterns: [
      manifestVersion == 3
        ? { from: "./src/manifest.v3.json", to: "manifest.json" }
        : "./src/manifest.json",
      { from: "./src/managed_schema.json", to: "managed_schema.json" },
      { from: "./src/_locales", to: "_locales" },
      { from: "./src/images", to: "images" },
      { from: "./src/popup/images", to: "popup/images" },
      { from: "./src/autofill/content/autofill.css", to: "content" },
    ],
  }),
  new MiniCssExtractPlugin({
    filename: "[name].css",
    chunkFilename: "chunk-[id].css",
  }),
  new AngularWebpackPlugin({
    tsConfigPath: "tsconfig.json",
    entryModule: "src/popup/app.module#AppModule",
    sourceMap: true,
  }),
  new CleanWebpackPlugin({
    cleanAfterEveryBuildPatterns: ["!popup/fonts/**/*"],
  }),
  new webpack.ProvidePlugin({
    process: "process/browser.js",
  }),
  new webpack.SourceMapDevToolPlugin({
    exclude: [/content\/.*/, /notification\/.*/],
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
    "popup/polyfills": "./src/popup/polyfills.ts",
    "popup/main": "./src/popup/main.ts",
    "content/trigger-autofill-script-injection":
      "./src/autofill/content/trigger-autofill-script-injection.ts",
    "content/autofill": "./src/autofill/content/autofill.js",
    "content/autofill-init": "./src/autofill/content/autofill-init.ts",
    "content/autofiller": "./src/autofill/content/autofiller.ts",
    "content/notificationBar": "./src/autofill/content/notification-bar.ts",
    "content/contextMenuHandler": "./src/autofill/content/context-menu-handler.ts",
    "content/message_handler": "./src/autofill/content/message_handler.ts",
    "notification/bar": "./src/autofill/notification/bar.ts",
    "encrypt-worker": "../../libs/common/src/platform/services/cryptography/encrypt.worker.ts",
  },
  optimization: {
    minimize: ENV !== "development",
    minimizer: [
      new TerserPlugin({
        exclude: [/content\/.*/, /notification\/.*/],
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
    modules: [path.resolve("../../node_modules")],
    fallback: {
      assert: false,
      buffer: require.resolve("buffer/"),
      util: require.resolve("util/"),
      url: require.resolve("url/"),
      fs: false,
      path: require.resolve("path-browserify"),
    },
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
  module: {
    noParse: /\.wasm$/,
    rules: moduleRules,
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
      template: "./src/platform/background.html",
      filename: "background.html",
      chunks: ["vendor", "background"],
    })
  );

  // Manifest V2 background pages can be run through the regular build pipeline.
  // Since it's a standard webpage.
  mainConfig.entry.background = "./src/platform/background.ts";

  configs.push(mainConfig);
} else {
  // Manifest v3 needs an extra helper for utilities in the content script.
  // The javascript output of this should be added to manifest.v3.json
  mainConfig.entry["content/misc-utils"] = "./src/autofill/content/misc-utils.ts";

  /**
   * @type {import("webpack").Configuration}
   */
  const backgroundConfig = {
    name: "background",
    mode: ENV,
    devtool: false,
    entry: "./src/platform/background.ts",
    target: "webworker",
    output: {
      filename: "background.js",
      path: path.resolve(__dirname, "build"),
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader",
        },
        {
          test: /\.wasm$/,
          loader: "base64-loader",
          type: "javascript/auto",
        },
      ],
      noParse: /\.wasm$/,
    },
    resolve: {
      extensions: [".ts", ".js"],
      symlinks: false,
      modules: [path.resolve("../../node_modules")],
      plugins: [new TsconfigPathsPlugin()],
      fallback: {
        fs: false,
        path: false,
      },
    },
    dependencies: ["main"],
    plugins: [...requiredPlugins],
  };

  configs.push(mainConfig);
  configs.push(backgroundConfig);
}

module.exports = configs;
