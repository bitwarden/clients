import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { findByRole, userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { BadgeGroupComponent, BadgeGroupItem } from "./badge-group.component";

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

export default {
  title: "Component Library/Badge/Group",
  component: BadgeGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [BadgeGroupComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({ showMore: "Show more", showMoreCount: "Show 5 more" }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<BadgeGroupComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 600px;">
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>
    `,
  }),
  args: { badges },
};

export const Narrow: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 200px;">
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>
    `,
  }),
  args: { badges },
};

export const WithIcons: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 300px;">
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>
    `,
  }),
  args: {
    badges: [
      { label: "Active", variant: "success", startIcon: "bwi-check-circle" },
      { label: "Expired", variant: "danger" },
      { label: "Draft", variant: "subtle" },
      { label: "Pinned", variant: "primary" },
    ],
  },
};

/**
 * With no badges, the group renders an empty container — no overflow "+N" chip
 * is shown.
 */
export const Empty: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div style="width: 300px;">
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>
    `,
  }),
  args: { badges: [] },
};

/**
 * With many badges in a narrow container, nearly all collapse into the overflow
 * "+N" chip. Opening the popover lists the hidden badges in a single column that
 * scrolls once it exceeds its 400px max height.
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
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>
    `,
  }),
  args: { badges: manyBadges },
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const chip = await findByRole(canvasEl, "button");
    await userEvent.click(chip);
  },
};

export const Truncation: Story = {
  render: (args) => ({
    props: {
      singleBadge,
      ...args,
    },
    template: /*html*/ `
      <div>The visible pinned badge should truncate at very small container sizes</div>
      <div class="tw-w-28 tw-border tw-border-solid tw-border-secondary-300">
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>

      <div class="tw-mt-4 tw-w-20 tw-border tw-border-solid tw-border-secondary-300">
        <bit-badge-group [badges]="singleBadge"></bit-badge-group>
      </div>
    `,
  }),
  args: { badges },
};

/**
 * Drag the bottom-right corner to resize the container and watch badges move in
 * and out of the overflow "+N" chip as the available width changes. Click the
 * chip to see the hidden badges listed in a popover.
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
        <bit-badge-group [badges]="badges"></bit-badge-group>
      </div>
    `,
  }),
  args: { badges },
};
