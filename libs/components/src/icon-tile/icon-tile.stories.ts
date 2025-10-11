import { Meta, StoryObj } from "@storybook/angular";

import { BITWARDEN_ICONS } from "../shared/icon";

import { IconTileComponent } from "./icon-tile.component";

export default {
  title: "Component Library/Icon Tile",
  component: IconTileComponent,
  args: {
    icon: "bwi-star",
    variant: "primary",
    size: "default",
    shape: "square",
  },
  argTypes: {
    variant: {
      options: ["primary", "success", "warning", "danger", "muted"],
      control: { type: "select" },
    },
    size: {
      options: ["small", "default", "large"],
      control: { type: "select" },
    },
    shape: {
      options: ["square", "circle"],
      control: { type: "select" },
    },
    icon: {
      options: BITWARDEN_ICONS,
      control: { type: "select" },
    },
    ariaLabel: {
      control: { type: "text" },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://atlassian.design/components/icon/icon-tile/examples",
    },
  },
} as Meta<IconTileComponent>;

type Story = StoryObj<IconTileComponent>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-collection" variant="primary"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Primary</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-check-circle" variant="success"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Success</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Warning</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-error" variant="danger"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Danger</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-question-circle" variant="muted"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Muted</span>
        </div>
      </div>
    `,
  }),
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-gap-4 tw-items-center">
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="small"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Small</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="default"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Default</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="large"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Large</span>
        </div>
      </div>
    `,
  }),
};

export const AllShapes: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-gap-4 tw-items-center">
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-user" variant="primary" shape="square"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Square</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-user" variant="primary" shape="circle"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Circle</span>
        </div>
      </div>
    `,
  }),
};
