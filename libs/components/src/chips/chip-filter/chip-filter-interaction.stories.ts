import { FormsModule } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { expect, waitFor } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { MenuModule } from "../../menu";
import { I18nMockService } from "../../utils/i18n-mock.service";
import { fullWidthArgType, sharedArgTypes } from "../shared/shared-story-arg-types";

import { ChipFilterComponent } from "./chip-filter.component";

export default {
  title: "Component Library/Chips/Chip Filter/Interaction States",
  component: ChipFilterComponent,
  tags: ["!autodocs"],
  decorators: [
    moduleMetadata({
      imports: [MenuModule, FormsModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              viewItemsIn: (name) => `View items in ${name}`,
              back: "Back",
              backTo: (name) => `Back to ${name}`,
              removeItem: (name) => `Remove ${name}`,
            });
          },
        },
      ],
    }),
  ],
  argTypes: {
    ...sharedArgTypes,
    ...fullWidthArgType,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-29548&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<ChipFilterComponent & { value: any }>;

export const FocusUnselected: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /* html */ `
      <bit-chip-filter
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        [disabled]="disabled"
        data-testid="chip-filter-focus"
      ></bit-chip-filter>
    `,
  }),
  args: {
    options: [
      {
        label: "Foo",
        value: "foo",
        icon: "bwi-folder",
      },
      {
        label: "Bar",
        value: "bar",
        icon: "bwi-exclamation-triangle",
        iconClass: "tw-text-danger",
      },
      {
        label: "Baz",
        value: "baz",
        disabled: true,
      },
    ],
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      const chipFilterFocus = await canvas.findByTestId("chip-filter-focus");

      const chipFilterBtn = chipFilterFocus.querySelector<HTMLButtonElement>("[bit-chip-content]");

      await expect(chipFilterBtn).toBeInTheDocument();

      chipFilterBtn?.focus();

      await expect(chipFilterBtn).toHaveFocus();
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};

export const FocusSelected: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /* html */ `
      <bit-chip-filter
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        [ngModel]="value"
        [disabled]="disabled"
        data-testid="chip-filter-focus"
      ></bit-chip-filter>
    `,
  }),
  args: {
    options: [
      {
        label: "Foo",
        value: "foo",
        icon: "bwi-folder",
      },
      {
        label: "Bar",
        value: "bar",
        icon: "bwi-exclamation-triangle",
        iconClass: "tw-text-danger",
      },
      {
        label: "Baz",
        value: "baz",
        disabled: true,
      },
    ],
    value: "foo",
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      const chipFilterFocus = await canvas.findByTestId("chip-filter-focus");

      const chipFilterBtn = chipFilterFocus.querySelector<HTMLButtonElement>("[bit-chip-content]");

      await expect(chipFilterBtn).toBeInTheDocument();

      chipFilterBtn?.focus();

      await expect(chipFilterBtn).toHaveFocus();
    });
  },
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};
