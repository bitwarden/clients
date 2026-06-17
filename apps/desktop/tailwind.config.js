/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const config = require("../../libs/components/tailwind.config.base");

// Add desktop-specific paths here. Shared libs should go in tailwind.config.base.js instead
const desktopContent = [
  path.resolve(__dirname, "./src/**/*.{html,ts,mdx}"),
  // FORK (klappstuhl): the ui-kit primitives live outside the upstream lib list,
  // so their Tailwind classes (e.g. the primary button's tw-bg-fg-brand) must be
  // scanned here or they get purged and render unstyled.
  path.resolve(__dirname, "../../libs/ui-kit/src/**/*.{html,ts}"),
];

config.content = [...config.content, ...desktopContent];
config.desktopContent = desktopContent;

module.exports = config;
