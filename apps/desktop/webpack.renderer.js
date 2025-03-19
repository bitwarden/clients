const path = require("path");
const webpack = require("webpack");
const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { AngularWebpackPlugin } = require("@ngtools/webpack");
const TerserPlugin = require("terser-webpack-plugin");
const configurator = require("./config/config");

const NODE_ENV = process.env.NODE_ENV == null ? "development" : process.env.NODE_ENV;

console.log("Renderer process config");
const envConfig = configurator.load(NODE_ENV);
configurator.log(envConfig);

const ENV = process.env.ENV == null ? "development" : process.env.ENV;

const common = {
  module: {
    rules: [
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
        test: /\.(jpe?g|png|gif|svg)$/i,
        exclude: /.*(bwi-font)\.svg/,
        generator: {
          filename: "images/[name][ext]",
        },
        type: "asset/resource",
      },
      {
        test: /argon2(-simd)?\.wasm$/,
        loader: "base64-loader",
        type: "javascript/auto",
      },
    ],
  },
  plugins: [],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    symlinks: false,
    modules: [path.resolve("../../node_modules")],
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false,
    },
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "build"),
  },
};

const renderer = {
  mode: NODE_ENV,
  devtool: "source-map",
  target: "web",
  node: {
    __dirname: false,
  },
  entry: {
    "app/main": "./src/app/main.ts",
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
        test: /\.(html)$/,
        loader: "html-loader",
      },
      {
        test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
        exclude: /loading.svg/,
        generator: {
          filename: "fonts/[name][ext]",
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
  plugins: [
    new AngularWebpackPlugin({
      tsConfigPath: "tsconfig.renderer.json",
      entryModule: "src/app/app.module#AppModule",
      sourceMap: true,
    }),
    // ref: https://github.com/angular/angular/issues/20357
    new webpack.ContextReplacementPlugin(
      /\@angular(\\|\/)core(\\|\/)fesm5/,
      path.resolve(__dirname, "./src"),
    ),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
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
    new webpack.EnvironmentPlugin({
      ENV: ENV,
      FLAGS: envConfig.flags,
      DEV_FLAGS: NODE_ENV === "development" ? envConfig.devFlags : {},
      ADDITIONAL_REGIONS: envConfig.additionalRegions ?? [],
    }),
  ],
};

module.exports = merge(common, renderer);
