import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./spinner";

type Args = { variant: string; size: string };

export default {
  title: "Component Library/Spinner",
  component: "bit-spinner",
  args: { variant: "primary", size: "base" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "subtle", "success", "warning", "danger", "contrast"],
    },
    size: { control: "radio", options: ["sm", "md", "base", "lg"] },
  },
  render: (args) => html`<bit-spinner variant=${args.variant} size=${args.size}></bit-spinner>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-4">
      ${["sm", "md", "base", "lg"].map((size) => html`<bit-spinner size=${size}></bit-spinner>`)}
    </div>
  `,
};

export const Variants: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-4">
      ${["primary", "subtle", "success", "warning", "danger"].map(
        (variant) => html`<bit-spinner variant=${variant} size="md"></bit-spinner>`,
      )}
      <span class="tw-bg-bg-contrast tw-p-2"
        ><bit-spinner variant="contrast" size="md"></bit-spinner
      ></span>
    </div>
  `,
};
