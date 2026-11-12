/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const config = require("../../libs/components/tailwind.config.base");

// Add desktop-specific paths here. Shared libs should go in tailwind.config.base.js instead
const desktopContent = [
  path.resolve(__dirname, "./src/**/*.{html,ts,mdx}"),
  path.resolve(__dirname, "../../bitwarden_license/bit-desktop/src/**/*.{html,ts,mdx}"),
  path.resolve(__dirname, "../../bitwarden_license/bit-pam-components/src/**/*.{html,ts}"),
];

config.content = [...config.content, ...desktopContent];
config.desktopContent = desktopContent;

module.exports = config;
