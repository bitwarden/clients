import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { onResize } from "./resize-observer";

export default {
  title: "Component Library/Resize Observer",
} satisfies Meta;

type Story = StoryObj;

/** Drag the box's corner to resize it; the size readout updates via `onResize()`. */
export const Default: Story = {
  render: () => html`
    <div
      class="tw-resize tw-overflow-auto tw-border tw-border-solid tw-border-border-base tw-rounded-xl tw-p-4 tw-w-64 tw-h-32"
      ${onResize((entry) => {
        const output = (entry.target as HTMLElement).querySelector("output");
        if (output) {
          const { width, height } = entry.contentRect;
          output.textContent = `${Math.round(width)} × ${Math.round(height)}`;
        }
      })}
    >
      Content size: <output></output>
    </div>
  `,
};
