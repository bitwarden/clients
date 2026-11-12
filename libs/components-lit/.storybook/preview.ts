import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/web-components-vite";
import { html } from "lit";

import { setTranslator } from "../src/core/i18n";
import "../src/styles/document.css";

import { storybookTranslator } from "./storybook-i18n";

setTranslator(storybookTranslator);

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        light: "theme_light",
        dark: "theme_dark",
      },
      defaultTheme: "light",
      parentSelector: "html",
    }),
    (story) => html`<div class="tw-bg-bg-primary tw-px-5 tw-py-10 tw-@container">${story()}</div>`,
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    options: {
      storySort: {
        method: "alphabetical",
        order: ["Documentation", ["Introduction", "*"], "Component Library"],
      },
    },
    docs: {
      source: {
        excludeDecorators: true,
      },
    },
    backgrounds: {
      disabled: true,
    },
  },
  tags: ["autodocs"],
};

export default preview;
