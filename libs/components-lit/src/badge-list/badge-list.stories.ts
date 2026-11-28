import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./badge-list";

type Args = { variant: string; items: string[]; maxItems?: number; noTruncate: boolean };

export default {
  title: "Component Library/Badge/List (Deprecated)",
  component: "bit-badge-list",
  args: {
    variant: "primary",
    maxItems: 3,
    items: ["Badge 1", "Badge 2", "Badge 3", "Badge 4", "Badge 5"],
    noTruncate: true,
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "subtle", "success", "warning", "danger", "accent-primary"],
    },
  },
  render: (args) => html`
    <bit-badge-list
      variant=${args.variant}
      .items=${args.items}
      .maxItems=${args.maxItems}
      ?no-truncate=${args.noTruncate}
    ></bit-badge-list>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Truncated: Story = {
  args: {
    items: ["Badge 1", "Badge 2 containing lengthy text", "Badge 3", "Badge 4", "Badge 5"],
    noTruncate: false,
  },
};
