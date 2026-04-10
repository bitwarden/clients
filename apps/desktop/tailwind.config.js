/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

const config = require("../../libs/components/tailwind.config.base");

const desktopContent = [path.resolve(__dirname, "./src/**/*.{html,ts,mdx}")];

config.content = [...config.content, ...desktopContent];
config.desktopContent = desktopContent;

module.exports = config;
