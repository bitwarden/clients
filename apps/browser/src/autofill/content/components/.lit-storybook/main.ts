import { createRequire } from "module";
import { dirname, join } from "path";

import type { StorybookConfig } from "@storybook/web-components-vite";
import remarkGfm from "remark-gfm";
import tsconfigPaths from "vite-tsconfig-paths";

const require = createRequire(import.meta.url);

const getAbsolutePath = (value: string): string =>
  dirname(require.resolve(join(value, "package.json")));

const config: StorybookConfig = {
  stories: ["../lit-stories/**/*.lit-stories.@(js|jsx|ts|tsx)", "../lit-stories/**/*.mdx"],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
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
  env: (existingConfig) => ({
    ...existingConfig,
    FLAGS: JSON.stringify({}),
  }),
  viteFinal: async (config) => {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), tsconfigPaths()],
    };
  },
};

export default config;
