import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import type { StorybookConfig } from "@storybook/web-components-vite";
import remarkGfm from "remark-gfm";
import tailwindcss from "tailwindcss";
import tsconfigPaths from "vite-tsconfig-paths";

const require = createRequire(import.meta.url);

const getAbsolutePath = (value: string): string =>
  dirname(require.resolve(join(value, "package.json")));

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../../..");

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|js)"],
  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-designs"),
    getAbsolutePath("@storybook/addon-themes"),
    {
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
    name: getAbsolutePath("@storybook/web-components-vite"),
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  staticDirs: [{ from: "../../../apps/web/src/images", to: "/images" }],
  viteFinal: async (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tsconfigPaths({ root: repoRoot })],
    resolve: {
      ...config.resolve,
      alias: [
        // The shared theme and icon stylesheets use webpack's `~` module prefix in `url()`s.
        {
          find: /^~@bitwarden\/components\/(.*)$/,
          replacement: `${repoRoot}/libs/components/$1`,
        },
        { find: /^~@bitwarden\/angular\/(.*)$/, replacement: `${repoRoot}/libs/angular/$1` },
      ],
    },
    css: {
      ...config.css,
      postcss: {
        plugins: [tailwindcss({ config: resolve(configDir, "../tailwind.config.js") })],
      },
    },
  }),
};

export default config;
