/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const config = require("../../libs/components/tailwind.config.base");

const browserContent = [path.resolve(__dirname, "./src/**/*.{html,ts,mdx}")];

config.content = [...config.content, ...browserContent];
config.browserContent = browserContent;
config.corePlugins.preflight = true;

module.exports = config;
