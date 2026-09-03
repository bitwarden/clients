import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { findByRole, fn, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../../utils/i18n-mock.service";

import { ChipGroupComponent, ChipGroupItem } from "./chip-group.component";

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

export default {
  title: "Component Library/Chips/Chip Group",
  component: ChipGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [ChipGroupComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({ showMore: "Show more", showMoreCount: "Show 5 more" }),
        },
      ],
    }),
  ],
  args: {
    chipSelect: fn(),
  },
} as Meta;

type Story = StoryObj<ChipGroupComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 600px;">
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips },
};

export const Narrow: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 200px;">
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips },
};

export const WithIcons: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 300px;">
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: {
    chips: [
      {
        id: "engineering",
        label: "Engineering",
        variant: "subtle",
        startIcon: "bwi-collection-shared",
      },
      { id: "design", label: "Design", variant: "subtle", startIcon: "bwi-collection-shared" },
      { id: "support", label: "Support", variant: "subtle", startIcon: "bwi-collection-shared" },
      { id: "sales", label: "Sales", variant: "subtle", startIcon: "bwi-collection-shared" },
    ],
  },
};

/** Chips are available in both chip sizes; the size applies to the "+N" chip too. */
export const Small: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 300px;">
        <bit-chip-group size="small" [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips },
};

/**
 * With no chips, the group renders an empty container — no overflow "+N" chip
 * is shown.
 */
export const Empty: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 300px;">
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips: [] },
};

/**
 * With many chips in a narrow container, nearly all collapse into the overflow
 * "+N" chip. Opening the popover lists the hidden chips in a single column that
 * scrolls once it exceeds its 400px max height. Chips stay activatable there.
 */
export const ScrollingOverflow: Story = {
  // The popover's positioning is animated/flaky in snapshots (see CL-822).
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 200px;">
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips: manyChips },
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const chip = await findByRole(canvasEl, "button", { name: "Show 5 more" });
    await userEvent.click(chip);
  },
};

export const Truncation: Story = {
  render: (args) => ({
    props: {
      singleChip,
      ...args,
    },
    template: /*html*/ `
      <div>The visible pinned chip should truncate at very small container sizes</div>
      <div class="tw-w-28 tw-border tw-border-solid tw-border-secondary-300">
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>

      <div class="tw-mt-4 tw-w-16 tw-border tw-border-solid tw-border-secondary-300">
        <bit-chip-group [chips]="singleChip" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips },
};

/**
 * Drag the bottom-right corner to resize the container and watch chips move in
 * and out of the overflow "+N" chip as the available width changes. Click the
 * chip to see the hidden chips listed in a popover.
 */
export const Resizable: Story = {
  // Resizing is interactive; a static snapshot adds no coverage over the other stories.
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div
        class="tw-resize-x tw-overflow-hidden tw-rounded tw-border tw-border-solid tw-border-secondary-300 tw-p-2"
        style="width: 400px; max-width: 100%;"
      >
        <bit-chip-group [chips]="chips" (chipSelect)="chipSelect($event)"></bit-chip-group>
      </div>
    `,
  }),
  args: { chips },
};
