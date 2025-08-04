const fs = require("fs");
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
    test: /\.[cm]?js$/,
    use: [
      {
        loader: "babel-loader",
        options: {
          configFile: "../../babel.config.json",
          cacheDirectory: NODE_ENV !== "production",
        },
      },
    ],
  },
  {
    test: /\.[jt]sx?$/,
    loader: "@ngtools/webpack",
  },
];

const plugins = [
  new HtmlWebpackPlugin({
    template: "./src/index.html",
    filename: "index.html",
    chunks: ["theme_head", "app/polyfills", "app/vendor", "app/main", "styles"],
  }),
  new HtmlWebpackInjector(),
  new HtmlWebpackPlugin({
    template: "./src/connectors/webauthn.html",
    filename: "webauthn-connector.html",
    chunks: ["connectors/webauthn", "styles"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/connectors/webauthn-mobile.html",
    filename: "webauthn-mobile-connector.html",
    chunks: ["connectors/webauthn", "styles"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/connectors/webauthn-fallback.html",
    filename: "webauthn-fallback-connector.html",
    chunks: ["connectors/webauthn-fallback", "styles"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/connectors/sso.html",
    filename: "sso-connector.html",
    chunks: ["connectors/sso", "styles"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/connectors/redirect.html",
    filename: "redirect-connector.html",
    chunks: ["connectors/redirect", "styles"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/connectors/duo-redirect.html",
    filename: "duo-redirect-connector.html",
    chunks: ["connectors/duo-redirect", "styles"],
  }),
  new HtmlWebpackPlugin({
    template: "./src/404.html",
    filename: "404.html",
    chunks: ["styles"],
    // 404 page is a wildcard, this ensures it uses absolute paths.
    publicPath: "/",
  }),
  new CopyWebpackPlugin({
    patterns: [
      { from: "./src/.nojekyll" },
      { from: "./src/manifest.json" },
      { from: "./src/favicon.ico" },
      { from: "./src/browserconfig.xml" },
      { from: "./src/app-id.json" },
      { from: "./src/images", to: "images" },
      { from: "./src/locales", to: "locales" },
      { from: "../../node_modules/qrious/dist/qrious.min.js", to: "scripts" },
      { from: "../../node_modules/braintree-web-drop-in/dist/browser/dropin.js", to: "scripts" },
      {
        from: "./src/version.json",
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
    tsconfig: "tsconfig.build.json",
    entryModule: "src/app/app.module#AppModule",
    sourceMap: true,
  }),
];

// ref: https://webpack.js.org/configuration/dev-server/#devserver
let certSuffix = fs.existsSync("dev-server.local.pem") ? ".local" : ".shared";
const devServer =
  NODE_ENV !== "development"
    ? {}
    : {
        server: {
          type: "https",
          options: {
            key: fs.readFileSync("dev-server" + certSuffix + ".pem"),
            cert: fs.readFileSync("dev-server" + certSuffix + ".pem"),
          },
        },
        // host: '192.168.1.9',
        proxy: [
          {
            context: ["/api"],
            target: envConfig.dev?.proxyApi,
            pathRewrite: { "^/api": "" },
            secure: false,
            changeOrigin: true,
          },
          {
            context: ["/identity"],
            target: envConfig.dev?.proxyIdentity,
            pathRewrite: { "^/identity": "" },
            secure: false,
            changeOrigin: true,
          },
          {
            context: ["/events"],
            target: envConfig.dev?.proxyEvents,
            pathRewrite: { "^/events": "" },
            secure: false,
            changeOrigin: true,
          },
          {
            context: ["/notifications"],
            target: envConfig.dev?.proxyNotifications,
            pathRewrite: { "^/notifications": "" },
            secure: false,
            changeOrigin: true,
            ws: true,
          },
          {
            context: ["/icons"],
            target: envConfig.dev?.proxyIcons,
            pathRewrite: { "^/icons": "" },
            secure: false,
            changeOrigin: true,
          },
        ],
        headers: (req) => {
          if (!req.originalUrl.includes("connector.html")) {
            return {
              "Content-Security-Policy": `
                default-src 'self'
                ;script-src
                  'self'
                  'wasm-unsafe-eval'
                  'sha256-ryoU+5+IUZTuUyTElqkrQGBJXr1brEv6r2CA62WUw8w='
                  https://js.stripe.com
                  https://js.braintreegateway.com
                  https://www.paypalobjects.com
                ;style-src
                  'self'
                  https://assets.braintreegateway.com
                  https://*.paypal.com
                  ${"'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='" /* date input polyfill */}
                  ${"'sha256-JVRXyYPueLWdwGwY9m/7u4QlZ1xeQdqUj2t8OVIzZE4='" /* date input polyfill */}
                  ${"'sha256-EnIJNDxVnh0++RytXJOkU0sqtLDFt1nYUDOfeJ5SKxg='" /* ng-select */}
                  ${"'sha256-dbBsIsz2pJ5loaLjhE6xWlmhYdjl6ghbwnGSCr4YObs='" /* cdk-virtual-scroll */}
                  ${"'sha256-S+uMh1G1SNQDAMG3seBmknQ26Wh+KSEoKdsNiy0joEE='" /* cdk-visually-hidden */}
                ;img-src
                  'self'
                  data:
                  https://icons.bitwarden.net
                  https://*.paypal.com
                  https://www.paypalobjects.com
                  https://q.stripe.com
                  https://haveibeenpwned.com
                ;media-src
                  'self'
                  https://assets.bitwarden.com
                ;child-src
                  'self'
                  https://js.stripe.com
                  https://assets.braintreegateway.com
                  https://*.paypal.com
                  https://*.duosecurity.com
                ;frame-src
                  'self'
                  https://js.stripe.com
                  https://assets.braintreegateway.com
                  https://*.paypal.com
                  https://*.duosecurity.com
                ;connect-src
                  'self'
                  ${envConfig.dev.wsConnectSrc ?? ""}
                  wss://notifications.bitwarden.com
                  https://notifications.bitwarden.com
                  https://cdn.bitwarden.net
                  https://api.pwnedpasswords.com
                  https://api.2fa.directory/v3/totp.json
                  https://api.stripe.com
                  https://www.paypal.com
                  https://api.sandbox.braintreegateway.com
                  https://api.braintreegateway.com
                  https://client-analytics.braintreegateway.com
                  https://*.braintree-api.com
                  https://*.blob.core.windows.net
                  http://127.0.0.1:10000
                  https://app.simplelogin.io/api/alias/random/new
                  https://quack.duckduckgo.com/api/email/addresses
                  https://app.addy.io/api/v1/aliases
                  https://api.fastmail.com
                  https://api.forwardemail.net
                  http://localhost:5000
                ;object-src
                  'self'
                  blob:
                ;`
                .replace(/\n/g, " ")
                .replace(/ +(?= )/g, ""),
            };
          }
        },
        hot: false,
        port: envConfig.dev?.port ?? 8080,
        allowedHosts: envConfig.dev?.allowedHosts ?? "auto",
        client: {
          overlay: {
            errors: true,
            warnings: false,
            runtimeErrors: false,
          },
        },
      };

const webpackConfig = {
  mode: NODE_ENV,
  devtool: "source-map",
  devServer: devServer,
  target: "web",
  entry: {
    "app/polyfills": "./src/polyfills.ts",
    "app/main": "./src/main.ts",
    "connectors/webauthn": "./src/connectors/webauthn.ts",
    "connectors/webauthn-fallback": "./src/connectors/webauthn-fallback.ts",
    "connectors/sso": "./src/connectors/sso.ts",
    "connectors/duo-redirect": "./src/connectors/duo-redirect.ts",
    "connectors/redirect": "./src/connectors/redirect.ts",
    styles: ["./src/scss/styles.scss", "./src/scss/tailwind.css"],
    theme_head: "./src/theme.ts",
  },
  cache:
    NODE_ENV === "production"
      ? false
      : {
          type: "filesystem",
          allowCollectingMemory: true,
          cacheDirectory: path.resolve(__dirname, "../../node_modules/.cache/webpack"),
          buildDependencies: {
            config: [__filename],
          },
        },
  snapshot: {
    unmanagedPaths: [path.resolve(__dirname, "../../node_modules/@bitwarden/")],
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
    minimize: NODE_ENV === "production",
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
    rules: moduleRules,
  },
  experiments: {
    asyncWebAssembly: true,
  },
  plugins: plugins,
};

module.exports = webpackConfig;
