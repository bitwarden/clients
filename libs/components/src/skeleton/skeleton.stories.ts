import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

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

export const Square: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton [edgeShape]="edgeShape" class="tw-size-32"></bit-skeleton>
    `,
  }),
  args: {
    edgeShape: "box",
  },
};

export const Rectangle: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton [edgeShape]="edgeShape" class="tw-w-40 tw-h-5"></bit-skeleton>
    `,
  }),
  args: {
    edgeShape: "box",
  },
};

export const Circle: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton [edgeShape]="edgeShape" class="tw-size-32"></bit-skeleton>
    `,
  }),
  args: {
    edgeShape: "circle",
  },
};

export const Oval: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton [edgeShape]="edgeShape" class="tw-w-40 tw-h-5"></bit-skeleton>
    `,
  }),
  args: {
    edgeShape: "circle",
  },
};
