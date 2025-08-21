/* eslint-disable */
const config = require("./tailwind.config.base");

config.content = [
  "libs/components/src/**/*.{html,ts,mdx}",
  "libs/auth/src/**/*.{html,ts,mdx}",
  "libs/vault/src/**/*.{html,ts,mdx}",
  "apps/web/src/**/*.{html,ts,mdx}",
  "apps/browser/src/**/*.{html,ts,mdx}",
  "bitwarden_license/bit-web/src/**/*.{html,ts,mdx}",
  ".storybook/preview.tsx",
];
config.safelist = [
  {
    pattern: /tw-bg-(.*)/,
  },
];

module.exports = config;
