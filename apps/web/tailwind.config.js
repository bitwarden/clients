/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
const path = require("path");
const config = require("../../libs/components/tailwind.config.base");

config.content = [
  path.resolve(__dirname, "./src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/components/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/assets/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/auth/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/key-management-ui/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/vault/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/angular/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../libs/tools/generator/components/src/**/*.{html,ts}"),
  path.resolve(__dirname, "../../bitwarden_license/bit-web/src/**/*.{html,ts}"),
];
config.corePlugins.preflight = true;

module.exports = config;
