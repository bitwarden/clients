import { setCompodocJson } from "@storybook/addon-docs/angular";
import { componentWrapperDecorator } from "@storybook/angular";
import type { Preview } from "@storybook/angular";

import docJson from "../documentation.json";
setCompodocJson(docJson);

const decorator = componentWrapperDecorator(
  (story) => {
    return /*html*/ `
      <div
        class="tw-border-2 tw-border-solid tw-px-5 tw-py-10"
        [ngClass]="{
          'tw-bg-[#ffffff] tw-border-secondary-300': theme === 'light',
          'tw-bg-[#1f242e]': theme === 'dark',
        }"
      >
        ${story}
      </div>
  `;
  },
  ({ globals }) => {
    // We need to add the theme class to the body to support body-appended content like popovers and menus
    document.body.classList.remove("theme_light");
    document.body.classList.remove("theme_dark");

    document.body.classList.add(`theme_${globals["theme"]}`);

    return { theme: `${globals["theme"]}` };
  },
);

const preview: Preview = {
  decorators: [decorator],
  globalTypes: {
    theme: {
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          {
            title: "Light",
            value: "light",
            icon: "sun",
          },
          {
            title: "Dark",
            value: "dark",
            icon: "moon",
          },
        ],
        dynamicTitle: true,
      },
    },
  },
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
