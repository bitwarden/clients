import { Meta, StoryObj } from "@storybook/angular";

import { BITWARDEN_ICONS } from "../shared/icon";

import { IconTileComponent } from "./icon-tile.component";

export default {
  title: "Component Library/Icon Tile",
  component: IconTileComponent,
  args: {
    icon: "bwi-star",
    variant: "primary",
    size: "base",
    borderRadius: "base",
  },
  argTypes: {
    variant: {
      options: ["primary", "success", "warning", "danger", "subtle", "dark", "contrast"],
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
          <bit-icon-tile icon="bwi-clock" variant="subtle"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Subtle</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-clock" variant="dark"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Dark</span>
        </div>
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-2">
          <bit-icon-tile icon="bwi-clock" variant="contrast"></bit-icon-tile>
          <span class="tw-text-sm tw-text-muted">Contrast</span>
        </div>
      </div>
    `,
  }),
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
          <span class="tw-text-sm tw-text-muted">Base (36px)</span>
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

export const AllCombinations: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8">
        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Primary Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-collection" variant="primary" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Success Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Danger Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-error" variant="danger" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Warning Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Subtle Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Dark Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-lock" variant="dark" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Contrast Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-star" variant="contrast" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="xl"></bit-icon-tile>
          </div>
        </div>
      </div>
    `,
  }),
};

export const AllCombinations: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8">
        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Primary Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-collection" variant="primary" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-collection" variant="primary" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Success Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-check-circle" variant="success" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Danger Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-error" variant="danger" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-error" variant="danger" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Warning Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-exclamation-triangle" variant="warning" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Subtle Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-question-circle" variant="subtle" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Dark Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-lock" variant="dark" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-lock" variant="dark" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Contrast Variant - All Sizes</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-star" variant="contrast" size="xs"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="sm"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="base"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="lg"></bit-icon-tile>
            <bit-icon-tile icon="bwi-star" variant="contrast" size="xl"></bit-icon-tile>
          </div>
        </div>

        <div>
          <h3 class="tw-text-lg tw-font-semibold tw-mb-4">Circle Shapes - All Sizes (Primary)</h3>
          <div class="tw-flex tw-gap-4 tw-items-end">
            <bit-icon-tile icon="bwi-user" variant="primary" size="xs" shape="circle"></bit-icon-tile>
            <bit-icon-tile icon="bwi-user" variant="primary" size="sm" shape="circle"></bit-icon-tile>
            <bit-icon-tile icon="bwi-user" variant="primary" size="base" shape="circle"></bit-icon-tile>
            <bit-icon-tile icon="bwi-user" variant="primary" size="lg" shape="circle"></bit-icon-tile>
            <bit-icon-tile icon="bwi-user" variant="primary" size="xl" shape="circle"></bit-icon-tile>
          </div>
        </div>
      </div>
    `,
  }),
};
