import { setCompodocJson } from "@storybook/addon-docs/angular";
import { withThemeByClassName } from "@storybook/addon-themes";
import { componentWrapperDecorator } from "@storybook/angular";
import type { Preview } from "@storybook/angular";
import isChromatic from "chromatic/isChromatic";

import docJson from "../documentation.json";
setCompodocJson(docJson);

const wrapperDecorator = componentWrapperDecorator((story) => {
  return /*html*/ `
    <div class="tw-bg-background tw-px-5 tw-py-10">
      ${story}
    </div>
  `;
});

export const loaders = [
  async () => {
    const font = new FontFace("Inter", 'url("/fonts/inter.woff2") format("woff2")', {
      weight: "100 900",
      featureSettings: '"ss02"',
    });

    await font.load();
    document.fonts.add(font);

    await document.fonts.ready;

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {};
  },
];

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        light: "theme_light",
        dark: "theme_dark",
      },
      defaultTheme: "light",
    }),
    wrapperDecorator,
  ],
  parameters: {
    a11y: {
      element: "#storybook-root",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    options: {
      storySort: {
        method: "alphabetical",
        order: ["Documentation", ["Introduction", "Colors", "Icons"], "Component Library"],
      },
    },
    docs: {
      source: {
        type: "dynamic",
        excludeDecorators: true,
      },
    },
    backgrounds: {
      disable: true,
    },
  },
  tags: ["autodocs"],
  loaders,
};

export default preview;
