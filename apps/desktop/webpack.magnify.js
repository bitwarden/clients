const path = require("path");
const { buildMagnifyConfig } = require("./webpack.base");

const config = buildMagnifyConfig({
  entry: path.resolve(__dirname, "src/magnify/main.ts"),
  tsConfig: path.resolve(__dirname, "tsconfig.magnify.json"),
  htmlTemplate: path.resolve(__dirname, "src/magnify/index.html"),
  outputPath: path.resolve(__dirname, "build/magnify"),
});

config.devServer = {
  port: 4300,
  hot: true,
  historyApiFallback: true,
};

module.exports = config;
