const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

module.exports = (config, context) => {
  // Handle case where function is called during project graph generation
  if (!context || !context.options) {
    return {
      mode: "development",
      target: "node",
      entry: "./src/bw.ts",
      output: { filename: "bw.js" },
      module: { rules: [] },
      plugins: [],
    };
  }

  // Get options from Nx context
  const mode = context.options.mode || "development";
  const license = context.options.license || "oss";

  // Set environment variables
  process.env.NODE_ENV = mode;
  const ENV = mode;
  process.env.ENV = ENV;

  const envConfig = require("./config/config").load(ENV);
  require("./config/config").log(envConfig);

  // Calculate output path
  const absoluteOutputPath = path.resolve(context.context.root, context.options.outputPath);

  const moduleRules = [
    {
      test: /\.ts$/,
      use: [
        {
          loader: "ts-loader",
          options: {
            configFile: "apps/cli/tsconfig.json",
          },
        },
      ],
      exclude: path.resolve(context.context.root, "node_modules"),
    },
  ];

  const plugins = [
    new CopyWebpackPlugin({
      patterns: [{ from: "apps/cli/src/locales", to: path.join(absoluteOutputPath, "locales") }],
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
      FLAGS: envConfig.flags || {},
      DEV_FLAGS: envConfig.devFlags || {},
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /canvas/,
      contextRegExp: /jsdom$/,
    }),
  ];

  return {
    mode: mode,
    target: "node",
    devtool: mode === "development" ? "eval-source-map" : "source-map",
    node: {
      __dirname: false,
      __filename: false,
    },
    entry: {
      bw: "apps/cli/src/bw.ts",
    },
    optimization: {
      minimize: false,
    },
    resolve: {
      extensions: [".ts", ".js"],
      symlinks: false,
      modules: [path.resolve(context.context.root, "node_modules")],
      plugins: [new TsconfigPathsPlugin({ configFile: "tsconfig.base.json" })],
    },
    output: {
      filename: "[name].js",
      path: absoluteOutputPath,
      clean: true,
    },
    module: { rules: moduleRules },
    plugins: plugins,
    externals: [
      nodeExternals({
        modulesDir: path.resolve(context.context.root, "node_modules"),
        allowlist: [/@bitwarden/],
      }),
    ],
    experiments: {
      asyncWebAssembly: true,
    },
  };
};
