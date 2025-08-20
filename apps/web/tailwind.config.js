/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
const config = require("../../libs/components/tailwind.config.base");

config.content = [
  "./src/**/*.{html,ts}",
  "../../libs/components/src/**/*.{html,ts}",
  "../../libs/auth/src/**/*.{html,ts}",
  "../../libs/key-management-ui/src/**/*.{html,ts}",
  "../../libs/vault/src/**/*.{html,ts}",
  "../../libs/angular/src/**/*.{html,ts}",
  "../../libs/tools/generator/components/src/**/*.{html,ts}",
  "../../bitwarden_license/bit-web/src/**/*.{html,ts}",
];

config.plugins = [...config.plugins, require("@tailwindcss/container-queries")];
config.theme.extend = {
  ...config.theme.extend,
  container: {
    "@5xl": "1100px",
  },
};

module.exports = config;
