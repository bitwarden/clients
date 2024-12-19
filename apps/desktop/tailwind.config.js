/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
const config = require("../../libs/components/tailwind.config.base");

config.content = [
  "./src/**/*.{html,ts}",
  "../../libs/components/src/**/*.{html,ts}",
  "../../libs/auth/src/**/*.{html,ts}",
  "../../libs/angular/src/**/*.{html,ts}",
  "../../libs/vault/src/**/*.{html,ts}",
];

module.exports = config;
