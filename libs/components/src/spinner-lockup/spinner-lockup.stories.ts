import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { SpinnerLockupComponent } from "./spinner-lockup.component";

export default {
  title: "Component Library/Spinner Lockup",
  component: SpinnerLockupComponent,
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
} as Meta<SpinnerLockupComponent>;

type Story = StoryObj<SpinnerLockupComponent>;

export const PrimaryVariant: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-spinner-lockup
        [variant]="variant"
        [size]="size"
        [layout]="layout"
      >
        <span title>Loading</span>
        <span body>This might take a few minutes.</span>
      </bit-spinner-lockup>
    `,
  }),
  args: {
    variant: "primary",
    size: "base",
    layout: "vertical",
  },
};

export const VerticalWithRichContentDangerVariant: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-spinner-lockup
        [variant]="variant"
        [size]="size"
        [layout]="layout"
      >
        <span title><strong>Processing</strong> your request</span>
        <span body>Please <em>do not</em> refresh the page.</span>
      </bit-spinner-lockup>
    `,
  }),
  args: {
    variant: "danger",
    size: "base",
    layout: "vertical",
  },
};

export const AllVerticalVariants: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-center">
        <bit-spinner-lockup
          variant="primary"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="subtle"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="success"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="warning"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="danger"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <div class="tw-bg-bg-contrast-strong tw-gap-8 tw-p-8">
          <bit-spinner-lockup
            variant="contrast"
            [size]="size"
            [layout]="layout"
          >
            <span title class="tw-text-fg-contrast">Loading</span>
            <span body class="tw-text-fg-contrast">This might take a few minutes.</span>
          </bit-spinner-lockup>
        </div>
      </div>
    `,
  }),
  args: {
    size: "base",
    layout: "vertical",
  },
};

export const AllVerticalSizes: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-center">
        <bit-spinner-lockup
          size="sm"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          size="md"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          size="base"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          size="lg"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
      </div>
    `,
  }),
  args: {
    variant: "primary",
    layout: "vertical",
  },
};

export const HorizontalWithRichContentDangerVariant: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-spinner-lockup
        [variant]="variant"
        [size]="size"
        [layout]="layout"
      >
        <span title><strong>Processing</strong> your request</span>
        <span body>Please <em>do not</em> refresh the page.</span>
      </bit-spinner-lockup>
    `,
  }),
  args: {
    variant: "danger",
    size: "base",
    layout: "horizontal",
  },
};

export const AllHorizontalVariants: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-center">
        <bit-spinner-lockup
          variant="primary"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="subtle"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="success"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="warning"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          variant="danger"
          [size]="size"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <div class="tw-bg-bg-contrast-strong tw-gap-8 tw-p-8">
          <bit-spinner-lockup
            variant="contrast"
            [size]="size"
            [layout]="layout"
          >
            <span title class="tw-text-fg-contrast">Loading</span>
            <span body class="tw-text-fg-contrast">This might take a few minutes.</span>
          </bit-spinner-lockup>
        </div>
      </div>
    `,
  }),
  args: {
    size: "base",
    layout: "horizontal",
  },
};

export const AllHorizontalSizes: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-center">
        <bit-spinner-lockup
          size="sm"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          size="md"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          size="base"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
        <bit-spinner-lockup
          size="lg"
          [variant]="variant"
          [layout]="layout"
        >
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
      </div>
    `,
  }),
  args: {
    variant: "primary",
    layout: "horizontal",
  },
};
