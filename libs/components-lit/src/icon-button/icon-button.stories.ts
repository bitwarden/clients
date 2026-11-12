import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { ButtonTypes } from "../button/button-styles";
import "./icon-button";

type Args = {
  icon: string;
  label: string;
  buttonType: string;
  size: string;
  disabled: boolean;
  loading: boolean;
};

export default {
  title: "Component Library/Icon Button",
  component: "bit-icon-button",
  args: {
    icon: "bwi-star",
    label: "Favorite",
    buttonType: "primaryGhost",
    size: "default",
    disabled: false,
    loading: false,
  },
  argTypes: {
    buttonType: { control: "select", options: Object.values(ButtonTypes) },
    size: { control: "radio", options: ["xsmall", "small", "default", "large"] },
  },
  render: (args) => html`
    <bit-icon-button
      icon=${args.icon}
      label=${args.label}
      button-type=${args.buttonType}
      size=${args.size}
      ?disabled=${args.disabled}
      ?loading=${args.loading}
    ></bit-icon-button>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-2">
      ${["xsmall", "small", "default", "large"].map(
        (size) =>
          html`<bit-icon-button
            icon="bwi-pencil"
            label="Edit (${size})"
            size=${size}
          ></bit-icon-button>`,
      )}
    </div>
  `,
};

export const Variants: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
      ${Object.values(ButtonTypes)
        .filter((type) => !type.startsWith("contrast") && type !== "side-nav")
        .map(
          (type) =>
            html`<bit-icon-button
              icon="bwi-trash"
              label=${type}
              button-type=${type}
            ></bit-icon-button>`,
        )}
    </div>
  `,
};

export const Disabled: Story = { args: { disabled: true } };

export const Loading: Story = { args: { loading: true } };

export const CustomTooltip: Story = {
  render: () =>
    html`<bit-icon-button
      icon="bwi-clone"
      label="Copy password"
      tooltip="Copies to your clipboard for 30 seconds"
      tooltip-position="below-center"
    ></bit-icon-button>`,
};
