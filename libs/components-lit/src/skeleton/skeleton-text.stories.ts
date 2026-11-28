import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./skeleton-text";

type Args = { lines: number };

export default {
  title: "Component Library/Skeleton/Skeleton Text",
  component: "bit-skeleton-text",
  args: { lines: 1 },
  argTypes: {
    lines: { control: { type: "number", min: 1 } },
  },
  render: (args) => html`<bit-skeleton-text lines=${args.lines}></bit-skeleton-text>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Text: Story = {};

export const TextMultiline: Story = { args: { lines: 5 } };
