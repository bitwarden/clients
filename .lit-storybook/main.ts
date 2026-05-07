import { createRequire } from "module";
import { dirname, join } from "path";

import type { StorybookConfig } from "@storybook/web-components-vite";
import remarkGfm from "remark-gfm";
import tsconfigPaths from "vite-tsconfig-paths";

const require = createRequire(import.meta.url);

const getAbsolutePath = (value: string): string =>
  dirname(require.resolve(join(value, "package.json")));

const config: StorybookConfig = {
  stories: [
    "../apps/browser/src/autofill/content/components/lit-stories/**/*.lit-stories.@(js|jsx|ts|tsx)",
    "../apps/browser/src/autofill/content/components/lit-stories/**/*.mdx",
    "../libs/ui/byte/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../libs/ui/byte/src/**/*.mdx",
  ],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-designs"),
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
  ],
  framework: {
    name: getAbsolutePath("@storybook/web-components-vite"),
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: async (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tsconfigPaths()],
  }),
};

export default config;
