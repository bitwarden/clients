import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import type { BadgeGroupItem } from "./badge-group";
import "./badge-group";

const badges: BadgeGroupItem[] = [
  { label: "Personal", variant: "subtle" },
  { label: "Work", variant: "subtle" },
  { label: "Shared", variant: "success" },
  { label: "Archived", variant: "warning" },
  { label: "Favorite", variant: "primary" },
];

const singleBadge: BadgeGroupItem[] = [{ label: "Personal", variant: "subtle" }];

const variants = ["subtle", "success", "warning", "primary", "danger"] as const;
const manyBadges: BadgeGroupItem[] = Array.from({ length: 30 }, (_, i) => ({
  label: `Label ${i + 1}`,
  variant: variants[i % variants.length],
}));

type Args = { badges: BadgeGroupItem[] };

const renderAt =
  (width: string): Story["render"] =>
  (args) => html`
    <div style="width: ${width};">
      <bit-badge-group .badges=${args.badges}></bit-badge-group>
    </div>
  `;

export default {
  title: "Component Library/Badge/Group",
  component: "bit-badge-group",
  args: { badges },
  render: renderAt("600px"),
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Narrow: Story = { render: renderAt("200px") };

export const WithIcons: Story = {
  render: renderAt("300px"),
  args: {
    badges: [
      { label: "Active", variant: "success", startIcon: "bwi-check-circle" },
      { label: "Expired", variant: "danger" },
      { label: "Draft", variant: "subtle" },
      { label: "Pinned", variant: "primary" },
    ],
  },
};

/** With no badges, the group renders an empty container and no "+N" chip. */
export const Empty: Story = { render: renderAt("300px"), args: { badges: [] } };

/**
 * With many badges in a narrow container, nearly all collapse into the "+N" chip. The popover
 * lists the hidden badges in a column that scrolls past 400px.
 */
export const ScrollingOverflow: Story = {
  render: renderAt("200px"),
  args: { badges: manyBadges },
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector("bit-badge-group");
    await new Promise((resolve) => setTimeout(resolve, 100));
    group?.shadowRoot?.querySelector<HTMLElement>("[data-trigger]")?.click();
  },
};

export const Truncation: Story = {
  render: (args) => html`
    <div>The visible pinned badge should truncate at very small container sizes</div>
    <div class="tw-w-28 tw-border tw-border-solid tw-border-secondary-300">
      <bit-badge-group .badges=${args.badges}></bit-badge-group>
    </div>
    <div class="tw-mt-4 tw-w-20 tw-border tw-border-solid tw-border-secondary-300">
      <bit-badge-group .badges=${singleBadge}></bit-badge-group>
    </div>
  `,
};

/**
 * Drag the bottom-right corner to resize the container and watch badges move in and out of the
 * "+N" chip.
 */
export const Resizable: Story = {
  render: (args) => html`
    <div
      class="tw-resize-x tw-overflow-hidden tw-rounded tw-border tw-border-solid tw-border-secondary-300 tw-p-2"
      style="width: 400px; max-width: 100%;"
    >
      <bit-badge-group .badges=${args.badges}></bit-badge-group>
    </div>
  `,
};
