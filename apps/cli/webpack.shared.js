const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const config = require("./config/config");

const getSharedConfig = (options) => {
  const {
    env,
    mode,
    entryPoint,
    outputPath,
    modulesPath,
    tsconfigPath,
    localesPath,
    externalsModulesDir,
    watch = false,
  } = options;

  const envConfig = config.load(env);
  config.log(envConfig);

  const webpackConfig = {
    mode: mode,
    target: "node",
    devtool: env === "development" ? "eval-source-map" : "source-map",
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
    module: { rules: getModuleRules() },
    plugins: getPlugins(env, envConfig, localesPath),
    externals: getExternals(externalsModulesDir),
    experiments: {
      asyncWebAssembly: true,
    },
  };

  if (watch) {
    webpackConfig.watch = true;
    webpackConfig.watchOptions = {
      ignored: /node_modules/,
      poll: 1000,
    };
  }

  return webpackConfig;
};

const getModuleRules = () => {
  return [
    {
      test: /\.ts$/,
      use: "ts-loader",
      exclude: path.resolve(__dirname, "node_modules"),
    },
  ];
};

const getPlugins = (env, envConfig, localesPath) => {
  return [
    new CopyWebpackPlugin({
      patterns: [{ from: localesPath, to: "locales" }],
    }),
    new webpack.DefinePlugin({
      "process.env.BWCLI_ENV": JSON.stringify(env),
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
      ENV: env,
      BWCLI_ENV: env,
      FLAGS: envConfig.flags,
      DEV_FLAGS: envConfig.devFlags,
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /canvas/,
      contextRegExp: /jsdom$/,
    }),
  ];
};

const getExternals = (externalsModulesDir) => {
  return [
    nodeExternals({
      modulesDir: externalsModulesDir,
      allowlist: [/@bitwarden/],
    }),
  ];
};

module.exports = {
  getSharedConfig,
  getModuleRules,
  getPlugins,
  getExternals,
};
