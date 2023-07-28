/* eslint-disable no-undef, @typescript-eslint/no-var-requires */
const config = require("../../libs/components/tailwind.config.base");

config.content = ["./src/**/*.{html,ts}", "../../libs/components/src/**/*.{html,ts}"];

module.exports = config;
