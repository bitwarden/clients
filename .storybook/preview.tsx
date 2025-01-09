import { setCompodocJson } from "@storybook/addon-docs/angular";
import { componentWrapperDecorator } from "@storybook/angular";
import type { Preview } from "@storybook/angular";

import docJson from "../documentation.json";
setCompodocJson(docJson);

const decorator = componentWrapperDecorator(
  (story) => {
    return `
    <ng-template #lightPreview>
      <div
        class="theme_light tw-border-2 tw-border-solid tw-border-secondary-300 tw-bg-[#ffffff] tw-px-5 tw-py-10 tw-mb-5"
        *ngIf="theme == 'both' || theme == 'light'"
      >
        ${story}
      </div>
    </ng-template>
    <ng-template #darkPreview>
      <div
        class="theme_dark tw-border-2 tw-border-solid tw-bg-[#1f242e] tw-px-5 tw-py-10"
        *ngIf="theme == 'both' || theme == 'dark'"
      >
        ${story}
      </div>
    </ng-template>
    <ng-template #nordPreview>
      <div
        class="theme_nord tw-border-2 tw-border-solid tw-bg-[#434C5E] tw-px-5 tw-py-10"
        *ngIf="theme == 'nord'">
        ${story}
      </div>
    </ng-template>
    <ng-template #solarizedPreview>
      <div
        class="theme_solarized tw-border-2 tw-border-solid tw-bg-[#002b36] tw-px-5 tw-py-10"
        *ngIf="theme == 'solarized'"
      >
        ${story}
      </div>
    </ng-template>

    <ng-container *ngTemplateOutlet="lightPreview"></ng-container>
    <ng-container *ngTemplateOutlet="darkPreview"></ng-container>
    <ng-container *ngTemplateOutlet="nordPreview"></ng-container>
    <ng-container *ngTemplateOutlet="solarizedPreview"></ng-container>
  `;
  },
  ({ globals }) => {
    return { theme: `${globals["theme"]}` };
  },
);

const preview: Preview = {
  decorators: [decorator],
  globalTypes: {
    theme: {
      description: "Global theme for components",
      defaultValue: "both",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          {
            title: "Light & Dark",
            value: "both",
            icon: "sidebyside",
          },
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
          {
            title: "Nord",
            value: "nord",
            left: "⛰",
          },
          {
            title: "Solarized",
            value: "solarized",
            left: "☯",
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
