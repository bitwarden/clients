import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "./icon-tile";

type Args = {
  icon: string;
  variant: string;
  emphasis: string;
  size: string;
  color?: string;
  label?: string;
};

const semantic = ["primary", "success", "danger", "warning", "dark"];
const decorative = ["brand", "teal", "green", "orange", "red", "purple", "gray"];
const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export default {
  title: "Component Library/Icon Tile",
  component: "bit-icon-tile",
  args: { icon: "bwi-star", variant: "primary", emphasis: "subtle", size: "base" },
  argTypes: {
    variant: { control: "select", options: [...semantic, ...decorative] },
    emphasis: { control: "select", options: ["subtle", "bold"] },
    size: { control: "select", options: ["xs", "sm", "base", "lg", "xl"] },
    color: { control: "color" },
    label: { control: "text" },
  },
  render: (args) => html`
    <bit-icon-tile
      icon=${args.icon}
      variant=${args.variant}
      emphasis=${args.emphasis}
      size=${args.size}
      color=${args.color ?? nothing}
      label=${args.label ?? nothing}
    ></bit-icon-tile>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

const tileRow = (variants: string[], emphasis = "subtle") => html`
  <div class="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
    ${variants.map(
      (variant) => html`
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-clock" variant=${variant} emphasis=${emphasis}></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">${capitalize(variant)}</span>
        </div>
      `,
    )}
  </div>
`;

export const AllVariants: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-8">
      <div>
        <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Semantic</h3>
        ${tileRow(semantic)}
      </div>
      <div>
        <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Decorative — Subtle</h3>
        ${tileRow(decorative)}
      </div>
      <div>
        <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Decorative — Bold</h3>
        ${tileRow(decorative, "bold")}
      </div>
    </div>
  `,
};

export const CustomColor: Story = { args: { color: "#f8e71c" } };

export const AllSizes: Story = {
  render: () => html`
    <div class="tw-flex tw-gap-4 tw-items-end">
      ${[
        ["xs", "XS (16px)"],
        ["sm", "SM (24px)"],
        ["base", "Base (32px)"],
        ["lg", "LG (48px)"],
        ["xl", "XL (64px)"],
      ].map(
        ([size, label]) => html`
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
            <bit-icon-tile icon="bwi-star" variant="primary" size=${size}></bit-icon-tile>
            <span class="tw-text-sm tw-text-muted">${label}</span>
          </div>
        `,
      )}
    </div>
  `,
};
