import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import "../berry/berry";
import type { BitOverflowList } from "./overflow-list";
import "./overflow-list";

type Args = { width: number; gap: number; strategy: "end" | "middle"; pinned: number };

const labels = ["Overview", "Members", "Groups", "Collections", "Policies", "Reports", "Billing"];

function onOverflowChange(event: Event) {
  const list = event.currentTarget as BitOverflowList;
  const output = list.parentElement?.querySelector("[data-output]");
  if (output) {
    const hidden = list.overflowItems.map((el) => el.textContent?.trim());
    output.textContent = hidden.length ? `Overflowed: ${hidden.join(", ")}` : "Everything fits";
  }
  const berry = list.querySelector("bit-berry");
  if (berry) {
    berry.value = list.overflow.length;
  }
}

export default {
  title: "Component Library/Overflow List",
  component: "bit-overflow-list",
  args: { width: 480, gap: 8, strategy: "end", pinned: -1 },
  argTypes: {
    width: { control: { type: "range", min: 80, max: 900, step: 10 } },
    strategy: { control: "radio", options: ["end", "middle"] },
    pinned: { control: { type: "number", min: -1, max: labels.length - 1 } },
  },
  render: (args) => html`
    <div
      class="tw-resize-x tw-overflow-hidden tw-rounded tw-border tw-border-solid tw-border-secondary-300 tw-p-2"
      style="width: ${args.width}px; max-width: 100%;"
    >
      <bit-overflow-list
        gap=${args.gap}
        strategy=${args.strategy}
        @overflowChange=${onOverflowChange}
      >
        ${labels.map(
          (label, i) =>
            html`<bit-button button-type="secondary" ?data-overflow-pinned=${i === args.pinned}
              >${label}</bit-button
            >`,
        )}
        <bit-button slot="trigger" button-type="secondary" end-icon="bwi-angle-down"
          >More <bit-berry></bit-berry
        ></bit-button>
      </bit-overflow-list>
      <p class="tw-mt-3 tw-mb-0 tw-text-sm tw-text-muted" data-output></p>
    </div>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

/**
 * Items that don't fit are hidden in place; the trigger reserves its width once anything
 * overflows. Listen to `overflowChange` (or read `overflowItems`) to render the hidden items in a
 * menu. Drag the corner to resize.
 */
export const Default: Story = {};

/** `data-overflow-pinned` keeps an item visible even when items before it overflow. */
export const Pinned: Story = { args: { pinned: 5, width: 420 } };

/** `strategy="middle"` keeps the first and last items and collapses the middle (breadcrumbs). */
export const CollapseMiddle: Story = { args: { strategy: "middle", width: 420 } };

/** When only one item fits it gets `data-overflow-shrink` and truncates. */
export const SingleItemTruncates: Story = { args: { width: 140 } };

export const EverythingFits: Story = { args: { width: 900 } };
