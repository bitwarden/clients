import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { SpinnerComponent } from "./spinner.component";

export default {
  title: "Component Library/Spinner",
  component: SpinnerComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rKUVGKb7Kw3d6YGoQl6Ho7/Flowbite-Component-Mapping?node-id=33686-93406",
    },
  },
} as Meta<SpinnerComponent>;

type Story = StoryObj<SpinnerComponent>;

export const Primary: Story = {
  args: {
    variant: "primary",
    size: "base",
  },
};

export const AllVariants: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-grid tw-grid-cols-6 tw-gap-8 tw-p-8 tw-bg-neutral-100">
        <!-- Primary Column -->
        <div class="tw-flex tw-flex-col tw-gap-4 tw-items-center">
          <span class="tw-text-sm tw-font-semibold">Primary</span>
          <bit-spinner variant="primary" size="sm" />
          <bit-spinner variant="primary" size="md" />
          <bit-spinner variant="primary" size="base" />
          <bit-spinner variant="primary" size="lg" />
        </div>

        <!-- Subtle Column -->
        <div class="tw-flex tw-flex-col tw-gap-4 tw-items-center">
          <span class="tw-text-sm tw-font-semibold">Subtle</span>
          <bit-spinner variant="subtle" size="sm" />
          <bit-spinner variant="subtle" size="md" />
          <bit-spinner variant="subtle" size="base" />
          <bit-spinner variant="subtle" size="lg" />
        </div>

        <!-- Success Column -->
        <div class="tw-flex tw-flex-col tw-gap-4 tw-items-center">
          <span class="tw-text-sm tw-font-semibold">Success</span>
          <bit-spinner variant="success" size="sm" />
          <bit-spinner variant="success" size="md" />
          <bit-spinner variant="success" size="base" />
          <bit-spinner variant="success" size="lg" />
        </div>

        <!-- Warning Column -->
        <div class="tw-flex tw-flex-col tw-gap-4 tw-items-center">
          <span class="tw-text-sm tw-font-semibold">Warning</span>
          <bit-spinner variant="warning" size="sm" />
          <bit-spinner variant="warning" size="md" />
          <bit-spinner variant="warning" size="base" />
          <bit-spinner variant="warning" size="lg" />
        </div>

        <!-- Danger Column -->
        <div class="tw-flex tw-flex-col tw-gap-4 tw-items-center">
          <span class="tw-text-sm tw-font-semibold">Danger</span>
          <bit-spinner variant="danger" size="sm" />
          <bit-spinner variant="danger" size="md" />
          <bit-spinner variant="danger" size="base" />
          <bit-spinner variant="danger" size="lg" />
        </div>

        <!-- Contrast Column -->
        <div class="tw-bg-bg-contrast">
          <div class="tw-flex tw-flex-col tw-gap-4 tw-items-center tw-text-fg-contrast">
            <span class="tw-text-sm tw-font-semibold tw-text-base">Contrast</span>
            <bit-spinner variant="contrast" size="sm" />
            <bit-spinner variant="contrast" size="md" />
            <bit-spinner variant="contrast" size="base" />
            <bit-spinner variant="contrast" size="lg" />
          </div>
        </div>
      </div>
    `,
  }),
};

export const SmallSize: Story = {
  args: {
    variant: "primary",
    size: "sm",
  },
};

export const MediumSize: Story = {
  args: {
    variant: "primary",
    size: "md",
  },
};

export const BaseSize: Story = {
  args: {
    variant: "primary",
    size: "base",
  },
};

export const LargeSize: Story = {
  args: {
    variant: "primary",
    size: "lg",
  },
};
