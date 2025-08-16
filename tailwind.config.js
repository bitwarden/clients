/* eslint-disable */
const config = require("./libs/components/tailwind.config.base");

config.content = [
  "./libs/components/src/**/*.{html,ts,mdx}",
  "./libs/admin-console/src/**/*.{html,ts,mdx}",
  "./libs/auth/src/**/*.{html,ts,mdx}",
  "./libs/billing/src/**/*.{html,ts,mdx}",
  "./libs/assets/src/**/*.{html,ts}",
  "./libs/platform/src/**/*.{html,ts,mdx}",
  "./libs/tools/send/send-ui/src/*.{html,ts,mdx}",
  "./libs/vault/src/**/*.{html,ts,mdx}",
  "./apps/web/src/**/*.{html,ts,mdx}",
  "./bitwarden_license/bit-web/src/**/*.{html,ts,mdx}",
  "./.storybook/preview.js",
];
config.safelist = [
  {
    pattern: /tw-bg-(.*)/,
  },
];

module.exports = config;
