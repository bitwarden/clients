const { buildConfig } = require("./webpack.base");

module.exports = buildConfig({
  configName: "OSS",
  entry: "./src/bw.ts",
  tsConfig: "./tsconfig.json",
});
