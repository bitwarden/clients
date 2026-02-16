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
  //   parameters: {
  //     design: {
  //       type: "figma",
  //       url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=1881%3A16956",
  //     },
  //   },
} as Meta<SpinnerLockupComponent>;

type Story = StoryObj<SpinnerLockupComponent>;

export const Primary: Story = {
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

export const WithRichContentDangerVariant: Story = {
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

export const HorizontalSizes: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-6 tw-p-8">
        <bit-spinner-lockup variant="primary" size="sm" layout="horizontal">
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>

        <bit-spinner-lockup variant="primary" size="md" layout="horizontal">
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>

        <bit-spinner-lockup variant="primary" size="base" layout="horizontal">
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>

        <bit-spinner-lockup variant="primary" size="lg" layout="horizontal">
          <span title>Loading</span>
          <span body>This might take a few minutes.</span>
        </bit-spinner-lockup>
      </div>
    `,
  }),
};

export const HorizontalVariants: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-6 tw-p-8">
        <bit-spinner-lockup variant="primary" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="subtle" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="success" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="warning" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="danger" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
        <div class="tw-bg-bg-contrast ">
          <bit-spinner-lockup variant="contrast" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
        </div>
      </div>
    `,
  }),
};

export const VerticalSizes: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-start">
        <bit-spinner-lockup variant="primary" size="sm" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="primary" size="md" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="primary" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="primary" size="lg" layout="vertical" title="Loading" body="This might take a few minutes." />
      </div>
    `,
  }),
};

export const VerticalVariants: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-flex tw-flex-col tw-gap-8 tw-p-8 tw-items-start">
        <bit-spinner-lockup variant="primary" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="subtle" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="success" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="warning" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="danger" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
        <bit-spinner-lockup variant="contrast" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
      </div>
    `,
  }),
};
