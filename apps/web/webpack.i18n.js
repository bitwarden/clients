const path = require("path");

const { AngularWebpackPlugin } = require("@ngtools/webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackInjector = require("html-webpack-injector");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

const config = require("./config.js");
const pjson = require("./package.json");

const ENV = process.env.ENV == null ? "development" : process.env.ENV;
const NODE_ENV = process.env.NODE_ENV == null ? "development" : process.env.NODE_ENV;
const LOGGING = process.env.LOGGING != "false";

const envConfig = config.load(ENV);
if (LOGGING) {
  config.log(envConfig);
}

const moduleRules = [
  {
    test: /\.(html)$/,
    loader: "html-loader",
  },
  {
    test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
    exclude: /loading(|-white).svg/,
    generator: {
      filename: "fonts/[name].[contenthash][ext]",
    },
    type: "asset/resource",
  },
  {
    test: /\.(jpe?g|png|gif|svg|webp|avif)$/i,
    exclude: /.*(bwi-font)\.svg/,
    generator: {
      filename: "images/[name][ext]",
    },
    type: "asset/resource",
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
    test: /\.[jt]sx?$/,
    use: [
      {
        loader: "@ngtools/webpack",
      },
    ],
  },
  {
    test: /argon2(-simd)?\.wasm$/,
    loader: "base64-loader",
    type: "javascript/auto",
  },
];

const plugins = [
  new HtmlWebpackPlugin({
    template: "./apps/web/src/index.html",
    filename: "index.html",
    chunks: ["theme_head", "app/polyfills", "app/vendor", "app/main", "styles"],
  }),
  new HtmlWebpackInjector(),
  new HtmlWebpackPlugin({
    template: "./apps/web/src/404.html",
    filename: "404.html",
    chunks: ["styles"],
    // 404 page is a wildcard, this ensures it uses absolute paths.
    publicPath: "/",
  }),
  new CopyWebpackPlugin({
    patterns: [
      { from: "./apps/web/src/.nojekyll" },
      { from: "./apps/web/src/manifest.json" },
      { from: "./apps/web/src/favicon.ico" },
      { from: "./apps/web/src/browserconfig.xml" },
      { from: "./apps/web/src/app-id.json" },
      { from: "./apps/web/src/images", to: "images" },
      { from: "./apps/web/src/locales", to: "locales" },
      { from: "./node_modules/qrious/dist/qrious.min.js", to: "scripts" },
      { from: "./node_modules/braintree-web-drop-in/dist/browser/dropin.js", to: "scripts" },
      {
        from: "./apps/web/src/version.json",
        transform(content, path) {
          return content.toString().replace("process.env.APPLICATION_VERSION", pjson.version);
        },
      },
    ],
  }),
  new MiniCssExtractPlugin({
    filename: "[name].[contenthash].css",
    chunkFilename: "[id].[contenthash].css",
  }),
  new webpack.ProvidePlugin({
    process: "process/browser.js",
  }),
  new webpack.EnvironmentPlugin({
    ENV: ENV,
    NODE_ENV: NODE_ENV === "production" ? "production" : "development",
    APPLICATION_VERSION: pjson.version,
    CACHE_TAG: Math.random().toString(36).substring(7),
    URLS: envConfig["urls"] ?? {},
    STRIPE_KEY: envConfig["stripeKey"] ?? "",
    BRAINTREE_KEY: envConfig["braintreeKey"] ?? "",
    PAYPAL_CONFIG: envConfig["paypal"] ?? {},
    FLAGS: envConfig["flags"] ?? {},
    DEV_FLAGS: NODE_ENV === "development" ? envConfig["devFlags"] : {},
    ADDITIONAL_REGIONS: envConfig["additionalRegions"] ?? [],
  }),
  new AngularWebpackPlugin({
    tsconfig: "apps/web/tsconfig.build.json",
    entryModule: "src/app/app.module#AppModule",
    sourceMap: true,
  }),
];

const webpackConfig = {
  mode: NODE_ENV,
  devtool: "source-map",
  target: "web",
  entry: {
    "app/polyfills": "./apps/web/src/polyfills.ts",
    "app/main": "./apps/web/src/main.ts",
    styles: ["./apps/web/src/scss/styles.scss", "./apps/web/src/scss/tailwind.css"],
    theme_head: "./apps/web/src/theme.ts",
  },
  optimization: {
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
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          safari10: true,
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
  },
  resolve: {
    extensions: [".ts", ".js"],
    symlinks: false,
    modules: [path.resolve("../../node_modules")],
    fallback: {
      buffer: false,
      util: require.resolve("util/"),
      assert: false,
      url: false,
      fs: false,
      process: false,
      path: require.resolve("path-browserify"),
    },
  },
  output: {
    filename: "[name].[contenthash].js",
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

module.exports = webpackConfig;
