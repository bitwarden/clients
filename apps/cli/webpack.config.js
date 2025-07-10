const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const config = require("./config/config");

if (process.env.NODE_ENV == null) {
  process.env.NODE_ENV = "development";
}
const ENV = (process.env.ENV = process.env.NODE_ENV);

const envConfig = config.load(ENV);
config.log(envConfig);

const moduleRules = [
  {
    test: /\.ts$/,
    use: "ts-loader",
    exclude: path.resolve(__dirname, "node_modules"),
  },
];

const plugins = [
  new CopyWebpackPlugin({
    patterns: [{ from: "./src/locales", to: "locales" }],
  }),
  new webpack.DefinePlugin({
    "process.env.BWCLI_ENV": JSON.stringify(ENV),
  }),
  new webpack.BannerPlugin({
    banner: "#!/usr/bin/env node",
    raw: true,
  }),
  new webpack.IgnorePlugin({
    resourceRegExp: /^encoding$/,
    contextRegExp: /node-fetch/,
  }),
  new webpack.EnvironmentPlugin({
    ENV: ENV,
    BWCLI_ENV: ENV,
    FLAGS: envConfig.flags,
    DEV_FLAGS: envConfig.devFlags,
  }),
  new webpack.IgnorePlugin({
    resourceRegExp: /canvas/,
    contextRegExp: /jsdom$/,
  }),
];

const webpackConfig = {
  mode: ENV,
  target: "node",
  devtool: ENV === "development" ? "eval-source-map" : "source-map",
  node: {
    __dirname: false,
    __filename: false,
  },
  entry: {
    bw: "./src/bw.ts",
  },
  optimization: {
    minimize: false,
  },
  resolve: {
    extensions: [".ts", ".js"],
    symlinks: false,
    modules: [path.resolve("../../node_modules")],
    plugins: [new TsconfigPathsPlugin({ configFile: "./tsconfig.json" })],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
    clean: true,
  },
  module: { rules: moduleRules },
  plugins: plugins,
  externals: [
    nodeExternals({
      modulesDir: "../../node_modules",
      allowlist: [/@bitwarden/],
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
  },
};

module.exports = webpackConfig;
