import { Meta, StoryObj } from "@storybook/angular";

import { BITWARDEN_ICONS } from "../shared/icon";

import { IconComponent } from "./icon.component";

export default {
  title: "Component Library/Icon",
  component: IconComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-50335&t=k6OTDDPZOTtypRqo-11",
    },
  },
  argTypes: {
    name: {
      control: { type: "select" },
      options: BITWARDEN_ICONS,
    },
  },
} as Meta<IconComponent>;

type Story = StoryObj<IconComponent>;

export const Default: Story = {
  args: {
    name: "bwi-lock",
  },
};

export const AllIcons: Story = {
  render: () => ({
    template: `
      <div class="tw-grid tw-grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw-gap-4 tw-p-4">
        @for (icon of icons; track icon) {
          <div class="tw-flex tw-flex-col tw-items-center tw-p-2 tw-border tw-border-secondary-300 tw-rounded">
            <bit-icon [name]="icon" class="tw-text-2xl tw-mb-2"></bit-icon>
            <span class="tw-text-xs tw-text-center">{{ icon }}</span>
          </div>
        }
      </div>
    `,
    props: {
      icons: BITWARDEN_ICONS,
    },
  }),
};

export const WithAriaLabel: Story = {
  args: {
    name: "bwi-lock",
    ariaLabel: "Secure lock icon",
  },
};

export const FixedWidth: Story = {
  args: {
    name: "bwi-lock",
    fixedWidth: true,
  },
};

export const FixedWidthComparison: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-gap-2">
        <div class="tw-flex tw-items-center tw-gap-2">
          <bit-icon name="bwi-lock" fixedWidth />
          <span>bwi-lock (fixed width)</span>
        </div>
        <div class="tw-flex tw-items-center tw-gap-2">
          <bit-icon name="bwi-eye" fixedWidth />
          <span>bwi-eye (fixed width)</span>
        </div>
        <div class="tw-flex tw-items-center tw-gap-2">
          <bit-icon name="bwi-collection" fixedWidth />
          <span>bwi-collection (fixed width)</span>
        </div>
        <hr class="tw-my-2" />
        <div class="tw-flex tw-items-center tw-gap-2">
          <bit-icon name="bwi-lock" />
          <span>bwi-lock (default)</span>
        </div>
        <div class="tw-flex tw-items-center tw-gap-2">
          <bit-icon name="bwi-eye" />
          <span>bwi-eye (default)</span>
        </div>
        <div class="tw-flex tw-items-center tw-gap-2">
          <bit-icon name="bwi-collection" />
          <span>bwi-collection (default)</span>
        </div>
      </div>
    `,
  }),
};

export const CompareWithLegacy: Story = {
  render: () => ({
    template: `<bit-icon name="bwi-lock"></bit-icon> <i class="bwi bwi-lock"></i>`,
  }),
};
