import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { ProgressBarComponent } from "./progress.component";

export default {
  title: "Component Library/Progress Bar",
  component: ProgressBarComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    variant: "primary",
    progressAmount: 50,
  },
} as Meta;

type Story = StoryObj<ProgressBarComponent>;

export const Base: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: `
      <div class="tw-w-[552px]">
        <bit-progress ${formatArgsForCodeSnippet<ProgressBarComponent>(args)} />
      </div>
    `,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress variant="primary" label="primary" [progressAmount]=20></bit-progress>
        <bit-progress variant="subtle" label="subtle" [progressAmount]=40></bit-progress>
        <bit-progress variant="success" label="success" [progressAmount]=60></bit-progress>
        <bit-progress variant="warning" label="warning" [progressAmount]=80></bit-progress>
        <bit-progress variant="danger" label="danger" [progressAmount]=100></bit-progress>
      </div>
    `,
  }),
};

export const WithLabelAndHelperText: Story = {
  ...Base,
  args: {
    ...Base.args,
    label: "File name",
    startText: "50% complete",
    endText: "50MB",
  },
};

export const StartText: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress variant="danger" label="danger" [progressAmount]=25 startText="Weak"></bit-progress>
        <bit-progress variant="warning" label="warning" [progressAmount]=50 startText="Weak2"></bit-progress>
        <bit-progress variant="primary" label="primary" [progressAmount]=75 startText="Good"></bit-progress>
        <bit-progress variant="success" label="success" [progressAmount]=100 startText="Strong"></bit-progress>
      </div>
    `,
  }),
};
