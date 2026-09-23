import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { BITWARDEN_ICONS } from "../shared/icon";

import { IconTileComponent } from "./icon-tile.component";

export default {
  title: "Component Library/Icon Tile",
  component: IconTileComponent,
  args: {
    icon: "bwi-star",
    variant: "primary",
    emphasis: "subtle",
    size: "base",
  },
  argTypes: {
    variant: {
      options: [
        "primary",
        "success",
        "warning",
        "danger",
        "dark",
        "brand",
        "teal",
        "green",
        "orange",
        "red",
        "purple",
        "gray",
      ],
      control: { type: "select" },
    },
    emphasis: {
      options: ["subtle", "bold"],
      control: { type: "select" },
    },
    size: {
      options: ["xs", "sm", "base", "lg", "xl"],
      control: { type: "select" },
    },
    icon: {
      options: BITWARDEN_ICONS,
      control: { type: "select" },
    },
    color: {
      control: { type: "color" },
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

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-icon-tile ${formatArgsForCodeSnippet<IconTileComponent>(args)}></bit-icon-tile>
    `,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8">
        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Semantic</h3>
          <div class="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="primary"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Primary</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="success"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Success</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="danger"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Danger</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="warning"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Warning</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="dark"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Dark</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Decorative — Subtle</h3>
          <div class="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="brand"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Brand</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="teal"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Teal</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="green"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Green</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="orange"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Orange</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="red"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Red</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="purple"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Purple</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="gray"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Gray</span>
            </div>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Decorative — Bold</h3>
          <div class="tw-flex tw-gap-4 tw-items-center tw-flex-wrap">
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="brand" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Brand</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="teal" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Teal</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="green" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Green</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="orange" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Orange</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="red" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Red</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="purple" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Purple</span>
            </div>
            <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
              <bit-icon-tile icon="bwi-clock" variant="gray" emphasis="bold"></bit-icon-tile>
              <span class="tw-text-sm tw-text-muted">Gray</span>
            </div>
          </div>
        </div>
      </div>
    `,
  }),
};

export const CustomColor: Story = {
  ...Default,
  args: {
    color: "#f8e71c",
  },
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-gap-4 tw-items-end">
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="xs"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">XS (16px)</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="sm"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">SM (24px)</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="base"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Base (32px)</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="lg"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">LG (48px)</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-star" variant="primary" size="xl"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">XL (64px)</span>
        </div>
      </div>
    `,
  }),
};
