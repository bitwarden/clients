import path, { dirname, join } from "path";

import type { StorybookConfig } from "@storybook/web-components-webpack5";
import remarkGfm from "remark-gfm";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

const getAbsolutePath = (value: string): string =>
  dirname(require.resolve(join(value, "package.json")));

const config: StorybookConfig = {
  stories: ["../lit-stories/**/*.lit-stories.@(js|jsx|ts|tsx)", "../lit-stories/**/*.mdx"],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-designs"),
    getAbsolutePath("@storybook/addon-interactions"),
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
    name: getAbsolutePath("@storybook/web-components-webpack5"),
    options: {
      legacyRootApi: true,
    },
  },
  core: {
    disableTelemetry: true,
  },
  env: (existingConfig) => ({
    ...existingConfig,
    FLAGS: JSON.stringify({}),
  }),
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.plugins = [
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, "../../../../../tsconfig.json"),
        }),
      ] as any;
    }

    if (config.module && config.module.rules) {
      config.module.rules.push({
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: require.resolve("ts-loader"),
          },
        ],
      });
    }
    return config;
  },
  docs: {},
};

export default config;
