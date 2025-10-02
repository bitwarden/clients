const { buildConfig } = require("../../apps/cli/webpack.base");

module.exports = buildConfig({
  configName: "Commercial",
  entry: "../../bitwarden_license/bit-cli/src/bw.ts",
  tsConfig: "../../bitwarden_license/bit-cli/tsconfig.json",
});
