import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "./tooltip";
import { tooltip } from "./tooltip-directive";

type Args = { content: string; position: string; describedBy: boolean };

export default {
  title: "Component Library/Tooltip",
  component: "bit-tooltip",
  args: { content: "This is a tooltip", position: "above-center", describedBy: false },
  argTypes: {
    position: {
      control: "select",
      options: ["above-center", "below-center", "left-center", "right-center"],
    },
  },
  render: (args) => html`
    <div class="tw-p-16 tw-text-center">
      <bit-tooltip
        content=${args.content}
        position=${args.position}
        ?described-by=${args.describedBy}
      >
        <bit-button>Hover or focus me</bit-button>
      </bit-tooltip>
    </div>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const AllPositions: Story = {
  render: () => html`
    <div class="tw-grid tw-grid-cols-2 tw-gap-16 tw-p-16">
      ${["above-center", "below-center", "left-center", "right-center"].map(
        (position) => html`
          <bit-tooltip content=${position} position=${position}>
            <bit-button>${position}</bit-button>
          </bit-tooltip>
        `,
      )}
    </div>
  `,
};

export const LitDirective: Story = {
  render: () => html`
    <div class="tw-p-16">
      <button
        class="tw-rounded tw-border tw-px-3 tw-py-1"
        ${tooltip("Added with the tooltip() directive")}
      >
        Native button
      </button>
    </div>
  `,
};

export const DescribedBy: Story = {
  args: { describedBy: true, content: "Also announced as the button's description" },
};

export const LongContent: Story = {
  args: {
    content:
      "This is a much longer tooltip that wraps across several lines to show the maximum width of the bubble.",
  },
};
