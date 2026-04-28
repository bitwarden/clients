/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const config = require("../../libs/components/tailwind.config.base");

// Add browser-specific paths here. Shared libs should go in tailwind.config.base.js instead
const browserContent = [path.resolve(__dirname, "./src/**/*.{html,ts,mdx}")];

config.content = [...config.content, ...browserContent];
config.browserContent = browserContent;
config.corePlugins.preflight = true;

module.exports = config;
