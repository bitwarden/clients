import * as prettierPluginOxc from "@prettier/plugin-oxc";

/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  plugins: [prettierPluginOxc],
  printWidth: 100,
  overrides: [
    {
      files: "*.mdx",
      options: {
        proseWrap: "always",
      },
    },
  ],
};

export default config;
