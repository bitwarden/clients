import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { VaultFabComponent } from "./fab.component";

export default {
  title: "Vault/FAB",
  component: VaultFabComponent,
  args: {
    vaultFab: "bwi-plus",
    label: "Add item",
  },
  argTypes: {
    vaultFab: {
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
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=48055-109900",
    },
  },
} as Meta<VaultFabComponent>;

type Story = StoryObj<VaultFabComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <button type="button" ${formatArgsForCodeSnippet<VaultFabComponent>(args)}></button>
    `,
  }),
};
