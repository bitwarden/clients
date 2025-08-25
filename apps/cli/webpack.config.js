const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const config = require("./config/config");

module.exports = (webpackConfig, context) => {
  // Check if this is being called by Nx (context will be provided) or directly by webpack CLI
  const isNxBuild = !!(context && context.options);

  // Set environment based on context mode or fall back to existing logic
  let mode, ENV;
  if (isNxBuild) {
    mode = context.options.mode || "development";
    if (process.env.NODE_ENV == null) {
      process.env.NODE_ENV = mode;
    }
    ENV = process.env.ENV = process.env.NODE_ENV;
  } else {
    // Original npm/webpack CLI logic
    if (process.env.NODE_ENV == null) {
      process.env.NODE_ENV = "development";
    }
    ENV = process.env.ENV = process.env.NODE_ENV;
    mode = ENV;
  }

  const envConfig = config.load(ENV);
  config.log(envConfig);

  // Determine output path - use Nx context if available, otherwise original logic
  let outputPath;
  if (isNxBuild) {
    outputPath = path.resolve(context.context.root, context.options.outputPath);
  } else {
    outputPath = path.resolve(__dirname, "build");
  }

  // Determine entry point - use Nx context if available, otherwise original logic
  let entryPoint;
  if (isNxBuild) {
    entryPoint = context.options.main || "apps/cli/src/bw.ts";
  } else {
    entryPoint = "./src/bw.ts";
  }

  // Determine module resolution path - use Nx context if available, otherwise original logic
  let modulesPath, tsconfigPath, localesPath;
  if (isNxBuild) {
    modulesPath = [path.resolve("node_modules")];
    tsconfigPath = "tsconfig.base.json";
    localesPath = "apps/cli/src/locales";
  } else {
    modulesPath = [path.resolve("../../node_modules")];
    tsconfigPath = "./tsconfig.json";
    localesPath = "./src/locales";
  }

  const moduleRules = [
    {
      test: /\.ts$/,
      use: "ts-loader",
      exclude: path.resolve(__dirname, "node_modules"),
    },
  ];

  const plugins = [
    new CopyWebpackPlugin({
      patterns: [{ from: localesPath, to: "locales" }],
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

  const externalsModulesDir = isNxBuild ? "node_modules" : "../../node_modules";

  return {
    mode: mode,
    target: "node",
    devtool: ENV === "development" ? "eval-source-map" : "source-map",
    node: {
      __dirname: false,
      __filename: false,
    },
    entry: {
      bw: entryPoint,
    },
    optimization: {
      minimize: false,
    },
    resolve: {
      extensions: [".ts", ".js"],
      symlinks: false,
      modules: modulesPath,
      plugins: [new TsconfigPathsPlugin({ configFile: tsconfigPath })],
    },
    output: {
      filename: "[name].js",
      path: outputPath,
      clean: true,
    },
    module: { rules: moduleRules },
    plugins: plugins,
    externals: [
      nodeExternals({
        modulesDir: externalsModulesDir,
        allowlist: [/@bitwarden/],
      }),
    ],
    experiments: {
      asyncWebAssembly: true,
    },
  };
};
