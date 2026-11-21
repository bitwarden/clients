import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { action } from "storybook/actions";

import { sharedArgTypes, sizeArgType, themeModes } from "../shared/shared-story-arg-types";

import "./chip";

type Args = {
  label: string;
  startIcon?: string;
  size?: "small" | "large";
  disabled: boolean;
};

export default {
  title: "Component Library/Chips/Chip",
  component: "bit-chip",
  args: { disabled: false, label: "Chip Label" },
  argTypes: { ...sharedArgTypes, ...sizeArgType },
  render: (args) =>
    html`<bit-chip
      label=${args.label}
      start-icon=${args.startIcon ?? ""}
      size=${args.size ?? "large"}
      ?disabled=${args.disabled}
      @dismissed=${action("dismissed")}
    ></bit-chip>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = { args: { startIcon: "bwi-filter" } };

export const Inactive: Story = { args: { startIcon: "bwi-filter", disabled: true } };

export const Small: Story = { args: { startIcon: "bwi-filter", size: "small" } };

export const WithLongLabel: Story = {
  args: {
    startIcon: "bwi-filter",
    label: "This is a chip with a very long label that should truncate",
  },
};

/** `tw-test-hover` / `tw-test-focus-visible` on the host pin the dismiss button's states. */
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
            <bit-chip label="Chip Label" start-icon="bwi-filter" class=${state}></bit-chip>
            <bit-chip
              label="Chip Label"
              start-icon="bwi-filter"
              size="small"
              class=${state}
            ></bit-chip>
          </div>`,
      )}
      <div class="tw-flex tw-items-center tw-gap-6">
        <span class="tw-text-sm tw-text-fg-body tw-w-24">Inactive</span>
        <bit-chip label="Chip Label" start-icon="bwi-filter" disabled></bit-chip>
        <bit-chip label="Chip Label" start-icon="bwi-filter" size="small" disabled></bit-chip>
      </div>
    </div>
  `,
  parameters: themeModes,
};
