import { dirname, join } from "path";

import { StorybookConfig } from "@storybook/angular";
import remarkGfm from "remark-gfm";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

const config: StorybookConfig = {
  stories: [
    "../libs/auth/src/**/*.mdx",
    "../libs/auth/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../libs/dirt/card/src/**/*.mdx",
    "../libs/dirt/card/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../libs/pricing/src/**/*.mdx",
    "../libs/pricing/src/**/*.stories.@(js|jsx|ts|tsx)",
    "../libs/tools/send/send-ui/src/**/*.mdx",
    "../libs/tools/send/send-ui/src/**/*.stories.@(js|jsx|ts|tsx)",
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
    "../libs/angular/src/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-designs"),
    getAbsolutePath("@storybook/addon-themes"),
    {
      // @storybook/addon-docs is part of @storybook/addon-essentials
       
      name: getAbsolutePath("@storybook/addon-docs"),
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
    name: getAbsolutePath("@storybook/angular"),
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
  docs: {},
  staticDirs: ["../apps/web/src/images"],
};

export default config;

// Recommended for mono-repositories
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}
