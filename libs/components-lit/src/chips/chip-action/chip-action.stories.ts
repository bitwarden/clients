import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import {
  sharedArgTypes,
  sizeArgType,
  themeModes,
  variantArgType,
} from "../shared/shared-story-arg-types";

import "./chip-action";

type Args = {
  label: string;
  startIcon?: string;
  variant?: string;
  size?: string;
  disabled: boolean;
};

const variants = ["primary", "subtle", "accent-primary", "accent-secondary"] as const;

export default {
  title: "Component Library/Chips/Chip Action",
  component: "bit-chip-action",
  args: { disabled: false, label: "Chip Label" },
  argTypes: { ...sharedArgTypes, ...variantArgType, ...sizeArgType },
  render: (args) =>
    html`<bit-chip-action
      label=${args.label}
      start-icon=${args.startIcon ?? ""}
      variant=${args.variant ?? "primary"}
      size=${args.size ?? "large"}
      ?disabled=${args.disabled}
    ></bit-chip-action>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const WithStartIcon: Story = { args: { startIcon: "bwi-check-circle" } };

export const Inactive: Story = { args: { startIcon: "bwi-filter", disabled: true } };

export const WithLongLabel: Story = {
  args: {
    startIcon: "bwi-filter",
    label: "This is a chip action with a very long label that should truncate",
  },
};

/** With `href`, the chip renders a link. */
export const AsLink: Story = {
  render: () =>
    html`<bit-chip-action
      href="#"
      label="View all"
      start-icon="bwi-angle-right"
    ></bit-chip-action>`,
};

export const AllVariants: Story = {
  render: () => html`
    <div class="tw-space-y-4">
      <div>
        <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Primary</h3>
        <bit-chip-action label="Primary" variant="primary" start-icon="bwi-check"></bit-chip-action>
      </div>
      <div>
        <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Subtle</h3>
        <bit-chip-action label="Subtle" variant="subtle" start-icon="bwi-folder"></bit-chip-action>
      </div>
      <div>
        <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Primary</h3>
        <bit-chip-action
          label="Accent Primary"
          variant="accent-primary"
          start-icon="bwi-info-circle"
        ></bit-chip-action>
      </div>
      <div>
        <h3 class="tw-text-sm tw-font-semibold tw-mb-2">Accent Secondary</h3>
        <bit-chip-action
          label="Accent Secondary"
          variant="accent-secondary"
          start-icon="bwi-exclamation-triangle"
        ></bit-chip-action>
      </div>
    </div>
  `,
  parameters: themeModes,
};

const variantName = (variant: string) =>
  variant
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

export const AllSizes: Story = {
  render: () => html`
    <div class="tw-space-y-4">
      ${(["small", "large"] as const).map(
        (size) =>
          html`<div>
            <h3 class="tw-text-sm tw-font-semibold tw-mb-2">${variantName(size)}</h3>
            <div class="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
              ${variants.map(
                (variant) =>
                  html`<bit-chip-action
                    label="${variantName(size)} ${variantName(variant)}"
                    size=${size}
                    variant=${variant}
                    start-icon="bwi-tag"
                  ></bit-chip-action>`,
              )}
            </div>
          </div>`,
      )}
    </div>
  `,
};

export const InteractionStates: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-6">
      ${(
        [
          ["Default", ""],
          ["Hover", "tw-test-hover"],
          ["Focus", "tw-test-focus-visible"],
        ] as const
      ).map(
        ([name, state]) =>
          html`<div class="tw-flex tw-items-center tw-gap-6">
            <span class="tw-text-sm tw-text-fg-body tw-w-24">${name}</span>
            ${variants.map(
              (variant) =>
                html`<bit-chip-action
                  label="Chip Label"
                  start-icon="bwi-tag"
                  variant=${variant}
                  class=${state}
                ></bit-chip-action>`,
            )}
          </div>`,
      )}
    </div>
  `,
  parameters: themeModes,
};
