import { Meta, StoryObj } from "@storybook/angular";

import { StackComponent } from "./stack.component";

export default {
  title: "Component Library/Stack",
  component: StackComponent,
} as Meta;

type Story = StoryObj<StackComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `<bit-stack [direction]="'${args.direction}'">
      <div class="tw-bg-primary-300 tw-min-w-52 tw-text-alt2 tw-font-bold tw-p-2">1</div>
      <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">2</div>
      <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">3</div>
    </bit-stack>`,
  }),
  args: {
    direction: "column",
  },
};

export const Row: Story = {
  ...Default,
  args: {
    direction: "row",
  },
};

export const Mixed: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `<bit-stack>
      <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">1</div>
      <bit-stack direction="row">
        <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">2A</div>
        <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">2B</div>
        <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">2C</div>
      </bit-stack>
      <div class="tw-bg-primary-300 tw-min-w-52 tw-h-52 tw-text-alt2 tw-font-bold tw-p-2">3</div>
    </bit-stack>`,
  }),
};
