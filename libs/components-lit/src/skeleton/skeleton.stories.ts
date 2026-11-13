import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./skeleton";

type Args = { edgeShape: string };

export default {
  title: "Component Library/Skeleton/Skeleton",
  component: "bit-skeleton",
  args: { edgeShape: "box" },
  argTypes: {
    edgeShape: { control: { type: "radio" }, options: ["box", "circle"] },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const BoxEdgeShape: Story = {
  render: (args) => html`
    <div class="tw-mb-4">Examples of different size shapes with edgeShape=${args.edgeShape}</div>
    <div class="tw-flex tw-flex-row tw-gap-8 tw-items-center">
      <bit-skeleton edge-shape=${args.edgeShape} class="tw-size-32"></bit-skeleton>
      <bit-skeleton edge-shape=${args.edgeShape} class="tw-w-40 tw-h-5"></bit-skeleton>
    </div>
  `,
  args: { edgeShape: "box" },
};

export const CircleEdgeShape: Story = {
  ...BoxEdgeShape,
  args: { edgeShape: "circle" },
};
