import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { SharedModule } from "../shared/shared.module";

import { SkeletonComponent } from "./skeleton.component";

export default {
  title: "Component Library/Skeleton/Skeleton",
  component: SkeletonComponent,
  decorators: [
    moduleMetadata({
      imports: [SharedModule],
    }),
  ],
  args: {
    edgeShape: "box",
  },
  argTypes: {
    edgeShape: {
      control: { type: "radio" },
      options: ["box", "circle"],
    },
  },
} as Meta<SkeletonComponent>;

type Story = StoryObj<SkeletonComponent>;

export const BoxEdgeShape: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-mb-4">Examples of different size shapes with edgeShape={{ edgeShape }}</div>
    <div class="tw-flex tw-flex-row tw-gap-8 tw-items-center">
      <bit-skeleton ${formatArgsForCodeSnippet<SkeletonComponent>(args)} class="tw-size-32"></bit-skeleton>
      <bit-skeleton ${formatArgsForCodeSnippet<SkeletonComponent>(args)} class="tw-w-40 tw-h-5"></bit-skeleton>
    </div>
    `,
  }),
  args: {
    edgeShape: "box",
  },
};

export const CircleEdgeShape: Story = {
  ...BoxEdgeShape,
  args: {
    edgeShape: "circle",
  },
};
