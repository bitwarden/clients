import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import type { StorybookConfig } from "@storybook/web-components-webpack5";
import remarkGfm from "remark-gfm";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);

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
          configFile: resolve(currentDirectory, "../../../../../tsconfig.json"),
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
      config.module.rules.push({
        test: /\.scss$/,
        use: [require.resolve("css-loader"), require.resolve("sass-loader")],
      });
    }
    return config;
  },
  docs: {},
};

export default config;
