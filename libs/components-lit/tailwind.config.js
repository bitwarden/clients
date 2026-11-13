/* eslint-disable */
const path = require("path");
const plugin = require("tailwindcss/plugin");

const config = require("../components/tailwind.config.base");

config.content = [
  path.resolve(__dirname, "src/**/*.{ts,css,mdx}"),
  path.resolve(__dirname, ".storybook/*.ts"),
  path.resolve(__dirname, "../assets/src/svg/**/*.ts"),
];

// Shadow roots don't inherit the document's preflight, so each component sheet carries its own.
config.corePlugins = { ...config.corePlugins, preflight: true };

// `.bit-compact &` can't match across a shadow boundary; the custom property inherits instead.
config.plugins = [
  ...config.plugins,
  plugin(({ addVariant }) => {
    addVariant("bit-compact", "@container style(--bit-compact: 1)");
  }),
];

module.exports = config;
