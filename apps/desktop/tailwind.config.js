/* eslint-disable @typescript-eslint/no-require-imports */
const config = require("../../libs/components/tailwind.config.base");

config.content = [
  "./src/**/*.{html,ts}",
  "../../libs/components/src/**/*.{html,ts}",
  "../../libs/assets/src/**/*.{html,ts}",
  "../../libs/auth/src/**/*.{html,ts}",
  "../../libs/key-management-ui/src/**/*.{html,ts}",
  "../../libs/angular/src/**/*.{html,ts}",
  "../../libs/vault/src/**/*.{html,ts,mdx}",
  "../../libs/pricing/src/**/*.{html,ts}",
];

module.exports = config;
