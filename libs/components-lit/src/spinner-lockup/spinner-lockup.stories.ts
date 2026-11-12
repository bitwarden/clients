import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./spinner-lockup";

type Args = { variant: string; size: string; orientation: string };

const variants = ["primary", "subtle", "success", "warning", "danger"];
const sizes = ["sm", "md", "base", "lg"];

const lockup = (variant: string, size: string, orientation: string, contrast = false) => html`
  <bit-spinner-lockup variant=${variant} size=${size} orientation=${orientation}>
    <span slot="title" class=${contrast ? "tw-text-fg-contrast" : ""}>Loading</span>
    <span slot="description" class=${contrast ? "tw-text-fg-contrast" : ""}
      >This might take a few minutes.</span
    >
  </bit-spinner-lockup>
`;

const allVariants = (args: Args) => html`
  <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-center">
    ${variants.map((v) => lockup(v, args.size, args.orientation))}
    <div class="tw-bg-bg-contrast-strong tw-gap-8 tw-p-8">
      ${lockup("contrast", args.size, args.orientation, true)}
    </div>
  </div>
`;

const allSizes = (args: Args) => html`
  <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-center">
    ${sizes.map((s) => lockup(args.variant, s, args.orientation))}
  </div>
`;

export default {
  title: "Component Library/Spinner Lockup",
  component: "bit-spinner-lockup",
  args: { variant: "primary", size: "base", orientation: "vertical" },
  argTypes: {
    variant: { control: "select", options: [...variants, "contrast"] },
    size: { control: "radio", options: sizes },
    orientation: { control: "radio", options: ["horizontal", "vertical"] },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=33686-93406",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const PrimaryVariant: Story = {
  render: (args) => lockup(args.variant, args.size, args.orientation),
};

export const AllVerticalVariants: Story = {
  render: allVariants,
  args: { size: "base", orientation: "vertical" },
};

export const AllVerticalSizes: Story = {
  render: allSizes,
  args: { variant: "primary", orientation: "vertical" },
};

export const AllHorizontalVariants: Story = {
  render: allVariants,
  args: { size: "base", orientation: "horizontal" },
};

export const AllHorizontalSizes: Story = {
  render: allSizes,
  args: { variant: "primary", orientation: "horizontal" },
};
