import { StorybookConfig } from "@storybook/angular";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";
import remarkGfm from "remark-gfm";

const config: StorybookConfig = {
  stories: [
    "../libs/auth/src/**/*.mdx",
    "../libs/auth/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../libs/vault/src/**/*.mdx",
    "../libs/vault/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../libs/components/src/**/*.mdx",
    "../libs/components/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../apps/web/src/**/*.mdx",
    "../apps/web/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../apps/browser/src/**/*.mdx",
    "../apps/browser/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../bitwarden_license/bit-web/src/**/*.mdx",
    "../bitwarden_license/bit-web/src/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-designs",
    "@storybook/addon-interactions",
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
    name: "@storybook/angular",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  env: (config) => ({
    ...config,
    FLAGS: JSON.stringify({}),
  }),
  webpackFinal: async (config, { configType }) => {
    if (config.resolve) {
      config.resolve.plugins = [new TsconfigPathsPlugin()] as any;
    }
    return config;
  },
  docs: {
    autodocs: true,
  },
};

export default config;
