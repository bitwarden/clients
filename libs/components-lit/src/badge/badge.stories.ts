import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "./badge";

type Args = {
  variant: string;
  size: string;
  noTruncate: boolean;
  startIcon?: string;
  tooltip?: string;
  tooltipPosition: string;
};

export default {
  title: "Component Library/Badge",
  component: "bit-badge",
  args: { variant: "primary", size: "large", noTruncate: false, tooltipPosition: "above-center" },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "subtle", "success", "warning", "danger", "accent-primary"],
    },
    size: { control: "radio", options: ["small", "large"] },
    tooltipPosition: {
      control: "select",
      options: ["above-center", "below-center", "left-center", "right-center"],
    },
  },
  render: (args) => html`
    <bit-badge
      variant=${args.variant}
      size=${args.size}
      ?no-truncate=${args.noTruncate}
      start-icon=${args.startIcon ?? nothing}
      tooltip=${args.tooltip ?? nothing}
      tooltip-position=${args.tooltipPosition}
      >Badge text</bit-badge
    >
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const NoStartIcon: Story = {
  render: () => html`
    <p class="tw-mb-2">
      Setting <code>start-icon="none"</code> (or <code>.startIcon=\${null}</code>) prevents the
      variant's default icon from rendering
    </p>
    <bit-badge variant="success" start-icon="none">Badge text</bit-badge>
  `,
};

export const AllVariants: Story = {
  render: () => html`
    <div class="tw-space-y-4">
      ${[
        ["primary", "Primary"],
        ["subtle", "Subtle"],
        ["success", "Success"],
        ["warning", "Warning"],
        ["danger", "Danger"],
        ["accent-primary", "Accent Primary (Has no default icon)"],
      ].map(
        ([variant, label]) => html`
          <div>
            <h3 class="tw-text-sm tw-font-semibold tw-mb-2">${label}</h3>
            <bit-badge variant=${variant}>${label.replace(" (Has no default icon)", "")}</bit-badge>
          </div>
        `,
      )}
    </div>
  `,
};

export const Small: Story = { args: { size: "small", startIcon: "bwi-folder" } };

export const Truncated: Story = {
  render: () => html`
    <div class="tw-flex tw-flex-col tw-gap-4">
      <div>
        <span class="tw-text-main tw-block tw-mb-2"
          >Long text (auto-truncates with tooltip on hover; default behavior):</span
        >
        <bit-badge>This is a very long badge text that will automatically truncate</bit-badge>
      </div>
      <div>
        <span class="tw-text-main tw-block tw-mb-2"
          >Long text (with <code>no-truncate</code>):</span
        >
        <bit-badge no-truncate
          >This is a very long badge text that will NOT automatically truncate</bit-badge
        >
      </div>
      <div>
        <span class="tw-text-main tw-block tw-mb-2"
          >Custom max width (<code>--bit-badge-max-width: 8rem</code>):</span
        >
        <bit-badge style="--bit-badge-max-width: 8rem"
          >This badge truncates at a narrower width</bit-badge
        >
      </div>
    </div>
  `,
};

export const CustomTooltip: Story = {
  args: { tooltip: "Different text than badge text", tooltipPosition: "below-center" },
  render: (args) => html`
    <div class="tw-ms-10">
      <bit-badge
        variant=${args.variant}
        tooltip=${args.tooltip ?? nothing}
        tooltip-position=${args.tooltipPosition}
        >Custom text and position</bit-badge
      >
    </div>
  `,
};
