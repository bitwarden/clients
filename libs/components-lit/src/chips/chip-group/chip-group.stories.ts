import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { action } from "storybook/actions";

import "./chip-group";
import type { BitChipGroup, ChipGroupItem } from "./chip-group";

type Args = { chips: ChipGroupItem[] };

const chips: ChipGroupItem[] = [
  { id: "personal", label: "Personal", variant: "subtle" },
  { id: "work", label: "Work", variant: "subtle" },
  { id: "shared", label: "Shared", variant: "subtle" },
  { id: "archived", label: "Archived", variant: "subtle" },
  { id: "favorite", label: "Favorite", variant: "subtle" },
];

const singleChip: ChipGroupItem[] = [{ id: "personal", label: "Personal", variant: "subtle" }];

const variants = ["primary", "subtle", "accent-primary", "accent-secondary"] as const;
const manyChips: ChipGroupItem[] = Array.from({ length: 30 }, (_, i) => ({
  id: `label-${i + 1}`,
  label: `Label ${i + 1}`,
  variant: variants[i % variants.length],
}));

const group = (items: ChipGroupItem[], width: string) =>
  html`<div style="width: ${width};">
    <bit-chip-group
      .chips=${items}
      @chipSelect=${(e: CustomEvent<ChipGroupItem>) => action("chipSelect")(e.detail)}
    ></bit-chip-group>
  </div>`;

export default {
  title: "Component Library/Chips/Chip Group",
  component: "bit-chip-group",
  args: { chips },
  render: (args) => group(args.chips, "600px"),
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Narrow: Story = { render: (args) => group(args.chips, "200px") };

export const WithIcons: Story = {
  render: (args) => group(args.chips, "300px"),
  args: {
    chips: [
      {
        id: "engineering",
        label: "Engineering",
        variant: "subtle",
        startIcon: "bwi-shared-folder",
      },
      { id: "design", label: "Design", variant: "subtle", startIcon: "bwi-shared-folder" },
      { id: "support", label: "Support", variant: "subtle", startIcon: "bwi-shared-folder" },
      { id: "sales", label: "Sales", variant: "subtle", startIcon: "bwi-shared-folder" },
    ],
  },
};

/**
 * Each chip carries a dismiss button. `accessibleName` qualifies the dismiss button and tooltip
 * when the visible label leans on its icon for context. This story removes dismissed chips, as a
 * consumer would.
 */
export const Dismissible: Story = {
  render: (args) =>
    html`<div style="width: 300px;">
      <bit-chip-group
        dismissible
        .chips=${args.chips}
        @chipDismiss=${(e: CustomEvent<ChipGroupItem>) => {
          action("chipDismiss")(e.detail);
          const el = e.currentTarget as BitChipGroup;
          el.chips = el.chips.filter((chip) => chip.id !== e.detail.id);
        }}
      ></bit-chip-group>
    </div>`,
  args: {
    chips: [
      { id: "type:0", label: "Login", accessibleName: "Type: Login", startIcon: "bwi-list" },
      { id: "type:1", label: "Card", accessibleName: "Type: Card", startIcon: "bwi-list" },
      { id: "folder", label: "Folder: Work" },
      { id: "vault", label: "Vault: My vault" },
    ],
  },
};

/** Chips are available in both chip sizes; the size applies to the "+N" chip too. */
export const Small: Story = {
  render: (args) =>
    html`<div style="width: 300px;">
      <bit-chip-group size="small" .chips=${args.chips}></bit-chip-group>
    </div>`,
};

/** With no chips, the group renders an empty container — no overflow "+N" chip is shown. */
export const Empty: Story = {
  render: (args) => group(args.chips, "300px"),
  args: { chips: [] },
};

/**
 * With many chips in a narrow container, nearly all collapse into the overflow "+N" chip. The
 * popover lists them in a single column that scrolls past 400px. Chips stay activatable there.
 */
export const ScrollingOverflow: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) => html`<div class="tw-h-[480px]">${group(args.chips, "200px")}</div>`,
  args: { chips: manyChips },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector("bit-chip-group")!;
    for (let i = 0; i < 20 && !el.shadowRoot?.querySelector("[data-row]:not(.tw-invisible)"); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    el.shadowRoot?.querySelector<HTMLElement>("[data-trigger]")?.click();
  },
};

export const Truncation: Story = {
  render: (args) => html`
    <div>The visible pinned chip should truncate at very small container sizes</div>
    <div class="tw-w-28 tw-border tw-border-solid tw-border-secondary-300">
      <bit-chip-group .chips=${args.chips}></bit-chip-group>
    </div>
    <div class="tw-mt-4 tw-w-16 tw-border tw-border-solid tw-border-secondary-300">
      <bit-chip-group .chips=${singleChip}></bit-chip-group>
    </div>
  `,
};

/**
 * Drag the bottom-right corner to resize the container and watch chips move in and out of the
 * overflow "+N" chip.
 */
export const Resizable: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  render: (args) =>
    html`<div
      class="tw-resize-x tw-overflow-hidden tw-rounded tw-border tw-border-solid tw-border-secondary-300 tw-p-2"
      style="width: 400px; max-width: 100%;"
    >
      <bit-chip-group .chips=${args.chips}></bit-chip-group>
    </div>`,
};
