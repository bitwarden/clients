/* eslint-disable */
const path = require("path");

const config = require("./libs/components/tailwind.config.base");
const webConfig = require("./apps/web/tailwind.config");
const browserConfig = require("./apps/browser/tailwind.config");
const desktopConfig = require("./apps/desktop/tailwind.config");

config.content = [
  ...config.libContent,
  ...webConfig.webContent,
  ...browserConfig.browserContent,
  ...desktopConfig.desktopContent,
  path.resolve(__dirname, ".storybook/preview.tsx"),
];

// Safelist is required for dynamic color classes in Storybook color documentation (colors.mdx).
// Tailwind's JIT compiler cannot detect dynamically constructed class names like `tw-bg-${name}`,
// so we must explicitly safelist these patterns to ensure all color utilities are generated.
config.safelist = [
  {
    pattern: /tw-bg-(.*)/,
  },
];

config.corePlugins.preflight = true;

module.exports = config;
