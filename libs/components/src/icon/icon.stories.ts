import { Meta, StoryObj } from "@storybook/angular";

import { BITWARDEN_ICONS } from "../shared/icon";

import { BitIconComponent } from "./icon.component";

export default {
  title: "Component Library/Icon",
  component: BitIconComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-50335&t=k6OTDDPZOTtypRqo-11",
    },
  },
  argTypes: {
    icon: {
      control: { type: "select" },
      options: BITWARDEN_ICONS,
    },
    size: {
      control: { type: "select" },
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
} as Meta<BitIconComponent>;

type Story = StoryObj<BitIconComponent>;

export const Default: Story = {
  args: {
    icon: "bwi-lock",
  },
};

export const AllIcons: Story = {
  render: () => ({
    template: `
      <div class="tw-grid tw-grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw-gap-4 tw-p-4">
        @for (icon of icons; track icon) {
          <div class="tw-flex tw-flex-col tw-items-center tw-p-2 tw-border tw-border-secondary-300 tw-rounded">
            <bit-icon [icon]="icon" class="tw-text-2xl tw-mb-2"></bit-icon>
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

export const WithFixedWidth: Story = {
  render: () => ({
    template: `
      <div class="tw-space-y-2">
        <div><bit-icon icon="bwi-lock" [fw]="true"></bit-icon> Lock</div>
        <div><bit-icon icon="bwi-user" [fw]="true"></bit-icon> User</div>
        <div><bit-icon icon="bwi-key" [fw]="true"></bit-icon> Key</div>
      </div>
    `,
  }),
};

export const WithSizes: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-items-end tw-gap-4">
        <bit-icon icon="bwi-lock" size="xs"></bit-icon>
        <bit-icon icon="bwi-lock" size="sm"></bit-icon>
        <bit-icon icon="bwi-lock" size="md"></bit-icon>
        <bit-icon icon="bwi-lock" size="lg"></bit-icon>
        <bit-icon icon="bwi-lock" size="xl"></bit-icon>
      </div>
    `,
  }),
};

export const WithAriaLabel: Story = {
  args: {
    icon: "bwi-lock",
    ariaLabel: "Secure lock icon",
  },
};
