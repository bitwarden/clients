import { setCompodocJson } from "@storybook/addon-docs/angular";
import { withThemeByClassName } from "@storybook/addon-themes";
import { applicationConfig, componentWrapperDecorator } from "@storybook/angular";
import type { Preview } from "@storybook/angular";

import docJson from "../documentation.json";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
setCompodocJson(docJson);

const wrapperDecorator = componentWrapperDecorator((story) => {
  return /*html*/ `
    <div class="tw-bg-background tw-px-5 tw-py-10 tw-@container">
      ${story}
    </div>
  `;
});

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
    applicationConfig({
      providers: [provideNoopAnimations()],
    }),
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
};

export default preview;
