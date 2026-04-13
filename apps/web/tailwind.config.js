/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
const path = require("path");

const config = require("../../libs/components/tailwind.config.base");

// Add web-specific paths here. Shared libs should go in tailwind.config.base.js instead
const webContent = [
  path.resolve(__dirname, "./src/**/*.{html,ts,mdx}"),
  path.resolve(__dirname, "../../bitwarden_license/bit-web/src/**/*.{html,ts,mdx}"),
];

config.content = [...config.content, ...webContent];
config.webContent = webContent;
config.corePlugins.preflight = true;

module.exports = config;
