import { setCompodocJson } from "@storybook/addon-docs/angular";
import { withThemeByClassName } from "@storybook/addon-themes";
import { componentWrapperDecorator } from "@storybook/angular";
import type { Preview } from "@storybook/angular";

import docJson from "../documentation.json";
setCompodocJson(docJson);

const wrapperDecorator = componentWrapperDecorator((story) => {
  return /*html*/ `
      <div class="tw-border-2 tw-border-solid tw-border-secondary-300 tw-px-5 tw-py-10 story-wrapper">
        ${story}
      </div>
  `;
});

const preview: Preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        light: "theme_light [&_.story-wrapper]:tw-bg-[#ffffff]",
        dark: "theme_dark [&_.story-wrapper]:tw-bg-[#1f242e]",
      },
      defaultTheme: "light",
    }),
    wrapperDecorator,
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
        order: ["Documentation", ["Introduction", "Colors", "Icons"], "Component Library"],
      },
    },
    docs: { source: { type: "dynamic", excludeDecorators: true } },
  },
  tags: ["autodocs"],
};

export default preview;
