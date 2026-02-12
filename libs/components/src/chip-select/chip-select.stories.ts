import { FormsModule } from "@angular/forms";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { getAllByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { MenuModule } from "../menu";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ChipSelectComponent } from "./chip-select.component";

export default {
  title: "Component Library/Chip Select",
  component: ChipSelectComponent,
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
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-29548&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<ChipSelectComponent & { value: any }>;

export const Default: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /* html */ `
      <bit-chip-select
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
      ></bit-chip-select>
      <bit-chip-select
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        [ngModel]="value"
      ></bit-chip-select>
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
        icon: "bwi-exclamation-triangle tw-text-danger",
      },
      {
        label: "Baz",
        value: "baz",
        disabled: true,
      },
    ],
    value: "foo",
  },
};

export const MenuOpen: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /* html */ `
      <bit-chip-select
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        [ngModel]="value"
      ></bit-chip-select>
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
        icon: "bwi-exclamation-triangle tw-text-danger",
      },
      {
        label: "Baz",
        value: "baz",
        disabled: true,
      },
    ],
  },
  play: async (context) => {
    const canvas = context.canvasElement;
    const buttons = getAllByRole(canvas, "button");
    await userEvent.click(buttons[0]);
  },
};

export const FullWidth: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /* html */ `
    <div class="tw-w-40">
      <bit-chip-select
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        [ngModel]="value"
        fullWidth
      ></bit-chip-select>
    </div>
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
        icon: "bwi-exclamation-triangle tw-text-danger",
      },
      {
        label: "Baz",
        value: "baz",
        disabled: true,
      },
    ],
  },
};

export const NestedOptions: Story = {
  ...Default,
  args: {
    options: [
      {
        label: "Foo",
        value: "foo",
        icon: "bwi-folder",
        children: [
          {
            label: "Foo1 very long name of folder but even longer than you thought",
            value: "foo1",
            icon: "bwi-folder",
            children: [
              {
                label: "Foo2",
                value: "foo2",
                icon: "bwi-folder",
                children: [
                  {
                    label: "Foo3",
                    value: "foo3",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "Bar",
        value: "bar",
        icon: "bwi-folder",
      },
      {
        label: "Baz",
        value: "baz",
        icon: "bwi-folder",
      },
    ],
    value: "foo1",
  },
};

export const TextOverflow: Story = {
  ...Default,
  args: {
    options: [
      {
        label: "Fooooooooooooooooooooooooooooooooooooooooooooo",
        value: "foo",
      },
    ],
    value: "foo",
  },
};

export const Disabled: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: /* html */ `
      <bit-chip-select
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        disabled
      ></bit-chip-select>
      <bit-chip-select
        placeholderText="Folder"
        placeholderIcon="bwi-folder"
        [options]="options"
        [ngModel]="value"
        disabled
      ></bit-chip-select>
    `,
  }),
  args: {
    options: [
      {
        label: "Foo",
        value: "foo",
        icon: "bwi-folder",
      },
    ],
    value: "foo",
  },
};
