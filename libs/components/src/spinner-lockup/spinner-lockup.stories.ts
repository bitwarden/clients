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
      </div>
    `,
  }),
};

// export const HorizontalWithText: Story = {
//   args: {
//     variant: "primary",
//     size: "base",
//     layout: "horizontal",
//     title: "Loading",
//     body: "This might take a few minutes.",
//   },
// };

// export const VerticalWithText: Story = {
//   args: {
//     variant: "primary",
//     size: "base",
//     layout: "vertical",
//     title: "Loading",
//     body: "This might take a few minutes.",
//   },
// };

// export const HorizontalSizes: Story = {
//   render: (args) => ({
//     props: args,
//     template: `
//       <div class="tw-flex tw-flex-col tw-gap-6 tw-p-8">
//         <bit-spinner variant="primary" size="sm" layout="horizontal" title="Loading" body="This might take a few minutes." />
//         <bit-spinner variant="primary" size="md" layout="horizontal" title="Loading" body="This might take a few minutes." />
//         <bit-spinner variant="primary" size="base" layout="horizontal" title="Loading" body="This might take a few minutes." />
//         <bit-spinner variant="primary" size="lg" layout="horizontal" title="Loading" body="This might take a few minutes." />
//       </div>
//     `,
//   }),
// };

// export const VerticalSizes: Story = {
//   render: (args) => ({
//     props: args,
//     template: `
//       <div class="tw-flex tw-flex-row tw-gap-8 tw-p-8 tw-items-start">
//         <bit-spinner variant="primary" size="sm" layout="vertical" title="Loading" body="This might take a few minutes." />
//         <bit-spinner variant="primary" size="md" layout="vertical" title="Loading" body="This might take a few minutes." />
//         <bit-spinner variant="primary" size="base" layout="vertical" title="Loading" body="This might take a few minutes." />
//         <bit-spinner variant="primary" size="lg" layout="vertical" title="Loading" body="This might take a few minutes." />
//       </div>
//     `,
//   }),
// };
