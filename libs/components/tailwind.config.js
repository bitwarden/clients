/* eslint-disable */
const config = require("./tailwind.config.base");

config.content = [
  "libs/components/src/**/*.{html,ts,mdx}",
  "libs/assets/src/**/*.{html,ts,mdx}",
  "libs/auth/src/**/*.{html,ts,mdx}",
  "libs/vault/src/**/*.{html,ts,mdx}",
  "apps/web/src/**/*.{html,ts,mdx}",
  "apps/browser/src/**/*.{html,ts,mdx}",
  "bitwarden_license/bit-web/src/**/*.{html,ts,mdx}",
  ".storybook/preview.tsx",
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
