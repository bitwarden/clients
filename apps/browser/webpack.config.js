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

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = "development";
}
const ENV = (process.env.ENV = process.env.NODE_ENV);
const manifestVersion = process.env.MANIFEST_VERSION == 3 ? 3 : 2;
const browser = process.env.BROWSER ?? "chrome";

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
          configFile: "../../babel.config.json",
        },
      },
    ],
  },
  {
    test: /\.[jt]sx?$/,
    loader: "@ngtools/webpack",
  },
  {
    test: /argon2(-simd)?\.wasm$/,
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
    template: "./src/popup/index.ejs",
    filename: "popup/index.html",
    chunks: ["popup/polyfills", "popup/vendor-angular", "popup/vendor", "popup/main"],
    browser: browser,
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/notification/bar.html",
    filename: "notification/bar.html",
    chunks: ["notification/bar"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/overlay/inline-menu/pages/button/button.html",
    filename: "overlay/menu-button.html",
    chunks: ["overlay/menu-button"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/overlay/inline-menu/pages/list/list.html",
    filename: "overlay/menu-list.html",
    chunks: ["overlay/menu-list"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/overlay/inline-menu/pages/menu-container/menu-container.html",
    filename: "overlay/menu.html",
    chunks: ["overlay/menu"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/deprecated/overlay/pages/button/legacy-button.html",
    filename: "overlay/button.html",
    chunks: ["overlay/button"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/autofill/deprecated/overlay/pages/list/legacy-list.html",
    filename: "overlay/list.html",
    chunks: ["overlay/list"],
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: manifestVersion == 3 ? "./src/manifest.v3.json" : "./src/manifest.json",
        to: "manifest.json",
        transform: manifest.transform(browser),
      },
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
    "popup/polyfills": "./src/popup/polyfills.ts",
    "popup/main": "./src/popup/main.ts",
    "content/trigger-autofill-script-injection":
      "./src/autofill/content/trigger-autofill-script-injection.ts",
    "content/bootstrap-autofill": "./src/autofill/content/bootstrap-autofill.ts",
    "content/bootstrap-autofill-overlay": "./src/autofill/content/bootstrap-autofill-overlay.ts",
    "content/bootstrap-autofill-overlay-menu":
      "./src/autofill/content/bootstrap-autofill-overlay-menu.ts",
    "content/bootstrap-autofill-overlay-notifications":
      "./src/autofill/content/bootstrap-autofill-overlay-notifications.ts",
    "content/bootstrap-legacy-autofill-overlay":
      "./src/autofill/deprecated/content/bootstrap-legacy-autofill-overlay.ts",
    "content/autofiller": "./src/autofill/content/autofiller.ts",
    "content/auto-submit-login": "./src/autofill/content/auto-submit-login.ts",
    "content/notificationBar": "./src/autofill/content/notification-bar.ts",
    "content/contextMenuHandler": "./src/autofill/content/context-menu-handler.ts",
    "content/content-message-handler": "./src/autofill/content/content-message-handler.ts",
    "content/fido2-content-script": "./src/autofill/fido2/content/fido2-content-script.ts",
    "content/fido2-page-script": "./src/autofill/fido2/content/fido2-page-script.ts",
    "notification/bar": "./src/autofill/notification/bar.ts",
    "overlay/menu-button":
      "./src/autofill/overlay/inline-menu/pages/button/bootstrap-autofill-inline-menu-button.ts",
    "overlay/menu-list":
      "./src/autofill/overlay/inline-menu/pages/list/bootstrap-autofill-inline-menu-list.ts",
    "overlay/menu":
      "./src/autofill/overlay/inline-menu/pages/menu-container/bootstrap-autofill-inline-menu-container.ts",
    "overlay/button":
      "./src/autofill/deprecated/overlay/pages/button/bootstrap-autofill-overlay-button.deprecated.ts",
    "overlay/list":
      "./src/autofill/deprecated/overlay/pages/list/bootstrap-autofill-overlay-list.deprecated.ts",
    "encrypt-worker": "../../libs/common/src/key-management/crypto/services/encrypt.worker.ts",
    "content/send-on-installed-message": "./src/vault/content/send-on-installed-message.ts",
    "content/send-popup-open-message": "./src/vault/content/send-popup-open-message.ts",
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
    chunkFilename: "assets/[name].js",
    webassemblyModuleFilename: "assets/[modulehash].wasm",
    path: path.resolve(__dirname, "build"),
    clean: true,
  },
  module: {
    noParse: /argon2(-simd)?\.wasm$/,
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
      template: "./src/platform/background.html",
      filename: "background.html",
      chunks: ["vendor", "background"],
    }),
  );

  // Manifest V2 background pages can be run through the regular build pipeline.
  // Since it's a standard webpage.
  mainConfig.entry.background = "./src/platform/background.ts";
  mainConfig.entry["content/fido2-page-script-append-mv2"] =
    "./src/autofill/fido2/content/fido2-page-script-append.mv2.ts";
  mainConfig.entry["content/fido2-page-script-delay-append-mv2"] =
    "./src/autofill/fido2/content/fido2-page-script-delay-append.mv2.ts";

  configs.push(mainConfig);
} else {
  // Firefox does not use the offscreen API
  if (browser !== "firefox") {
    mainConfig.entry["offscreen-document/offscreen-document"] =
      "./src/platform/offscreen-document/offscreen-document.ts";

    mainConfig.plugins.push(
      new HtmlWebpackPlugin({
        template: "./src/platform/offscreen-document/index.html",
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
    devtool: false,
    entry: "./src/platform/background.ts",
    target: target,
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
          test: /argon2(-simd)?\.wasm$/,
          loader: "base64-loader",
          type: "javascript/auto",
        },
      ],
      noParse: /argon2(-simd)?\.wasm$/,
    },
    experiments: {
      asyncWebAssembly: true,
    },
    resolve: {
      extensions: [".ts", ".js"],
      symlinks: false,
      modules: [path.resolve("../../node_modules")],
      plugins: [new TsconfigPathsPlugin()],
      fallback: {
        fs: false,
        path: require.resolve("path-browserify"),
      },
    },
    dependencies: ["main"],
    plugins: [...requiredPlugins],
  };

  // Safari's desktop build process requires a background.html and vendor.js file to exist
  // within the root of the extension. This is a workaround to allow us to build Safari
  // for manifest v2 and v3 without modifying the desktop project structure.
  if (browser === "safari") {
    backgroundConfig.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          { from: "./src/safari/mv3/fake-background.html", to: "background.html" },
          { from: "./src/safari/mv3/fake-vendor.js", to: "vendor.js" },
        ],
      }),
    );
  }

  configs.push(mainConfig);
  configs.push(backgroundConfig);
}

module.exports = configs;
