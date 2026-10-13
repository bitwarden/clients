/* eslint-disable */
const path = require("path");

const config = require("./libs/components/tailwind.config.base");
const webConfig = require("./apps/web/tailwind.config");
const browserConfig = require("./apps/browser/tailwind.config");
const desktopConfig = require("./apps/desktop/tailwind.config");

/**
 * Pull together all the tailwind configs for the shared libs and clients for use in Storybook.
 *
 * Do not add new paths here directly. Add shared libs to tailwind.config.base.js, and add
 * app-specific paths to their respective tailwind.config.js file
 */
config.content = [
  ...config.content,
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
