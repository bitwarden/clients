import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { BitFabComponent } from "./fab.component";

export default {
  title: "Component Library/FAB",
  component: BitFabComponent,
  decorators: [],
  args: {
    bitFab: "bwi-plus",
    label: "Add item",
  },
  argTypes: {
    bitFab: {
      control: { type: "text" },
      description: "The icon class to display",
      table: {
        type: { summary: "string" },
      },
    },
    label: {
      control: { type: "text" },
      description: "Accessible label for screen readers and tooltip content",
      table: {
        type: { summary: "string" },
      },
    },
    disabled: {
      control: { type: "boolean" },
      description: "Whether the FAB is disabled",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=48055-109900",
    },
  },
} as Meta<BitFabComponent>;

type BitFabComponentWithHostDirectiveInputs = BitFabComponent & { disabled: boolean };

type Story = StoryObj<BitFabComponentWithHostDirectiveInputs>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" ${formatArgsForCodeSnippet<BitFabComponent>(args)}></button>
    `,
  }),
};

export const Disabled: Story = {
  ...Default,
  args: {
    disabled: true,
  },
};
