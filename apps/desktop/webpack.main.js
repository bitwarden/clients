const path = require("path");
const { merge } = require("webpack-merge");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const configurator = require("./config/config");
const { EnvironmentPlugin } = require("webpack");

const NODE_ENV = process.env.NODE_ENV == null ? "development" : process.env.NODE_ENV;

console.log("Main process config");
const envConfig = configurator.load(NODE_ENV);
configurator.log(envConfig);

const common = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules\/(?!(@bitwarden)\/).*/,
      },
    ],
  },
  plugins: [],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    plugins: [new TsconfigPathsPlugin({ configFile: "./tsconfig.json" })],
  },
};

const prod = {
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
};

const dev = {
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
    devtoolModuleFilenameTemplate: "[absolute-resource-path]",
  },
  devtool: "cheap-source-map",
};

const main = {
  mode: NODE_ENV,
  target: "electron-main",
  node: {
    __dirname: false,
    __filename: false,
  },
  entry: {
    main: "./src/entry.ts",
  },
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: "node-loader",
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        "./src/package.json",
        { from: "./src/images", to: "images" },
        { from: "./src/locales", to: "locales" },
      ],
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

module.exports = merge(common, NODE_ENV === "development" ? dev : prod, main);
