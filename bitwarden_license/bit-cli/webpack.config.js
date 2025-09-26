const path = require("path");
const { buildConfig } = require("../../apps/cli/webpack.base");

module.exports = buildConfig({
  configName: "Commercial",
  entry: {
    bw: path.resolve(__dirname, "src/bw.ts"),
  },
  tsConfig: path.resolve(__dirname, "tsconfig.json"),
});
