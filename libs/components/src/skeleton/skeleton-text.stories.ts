import { Meta, StoryObj } from "@storybook/angular";

import { SkeletonTextComponent } from "./skeleton-text.component";

import { formatArgsForCodeSnippet } from ".storybook/format-args-for-code-snippet";

export default {
  title: "Component Library/Skeleton/Skeleton Text",
  component: SkeletonTextComponent,
  args: {
    lines: 1,
  },
  argTypes: {
    lines: {
      control: { type: "number", min: 1 },
    },
  },
} as Meta<SkeletonTextComponent>;

type Story = StoryObj<SkeletonTextComponent>;

export const Text: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton-text ${formatArgsForCodeSnippet<SkeletonTextComponent>(args)}></bit-skeleton-text>
    `,
  }),
};

export const TextMultiline: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton-text ${formatArgsForCodeSnippet<SkeletonTextComponent>(args)}></bit-skeleton-text>
    `,
  }),
  args: {
    lines: 5,
  },
};
