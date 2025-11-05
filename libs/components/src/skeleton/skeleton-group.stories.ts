import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { SharedModule } from "../shared/shared.module";

import { SkeletonGroupComponent } from "./skeleton-group.component";
import { SkeletonTextComponent } from "./skeleton-text.component";
import { SkeletonComponent } from "./skeleton.component";

export default {
  title: "Component Library/Skeleton/Skeleton Group",
  component: SkeletonGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [SharedModule, SkeletonTextComponent, SkeletonComponent],
    }),
  ],
} as Meta<SkeletonGroupComponent>;

type Story = StoryObj<SkeletonGroupComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton-group>
        <bit-skeleton class="tw-size-8" slot="start"></bit-skeleton>
        <bit-skeleton-text [lines]="2" class="tw-w-1/2"></bit-skeleton-text>
        <bit-skeleton-text [lines]="1" slot="end" class="tw-w-1/4"></bit-skeleton-text>
      </bit-skeleton-group>
    `,
  }),
};

export const NoEndSlot: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton-group>
        <bit-skeleton class="tw-size-8" slot="start"></bit-skeleton>
        <bit-skeleton-text [lines]="2" class="tw-w-1/2"></bit-skeleton-text>
      </bit-skeleton-group>
    `,
  }),
};

export const NoStartSlot: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton-group>
        <bit-skeleton-text [lines]="2" class="tw-w-1/2"></bit-skeleton-text>
        <bit-skeleton-text [lines]="1" slot="end" class="tw-w-1/4"></bit-skeleton-text>
      </bit-skeleton-group>
    `,
  }),
};

export const CustomContent: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-skeleton-group>
        <bit-skeleton class="tw-size-12" slot="start" edgeShape="circle"></bit-skeleton>
        <bit-skeleton-text [lines]="3" class="tw-w-full"></bit-skeleton-text>
        <div slot="end" class="tw-flex tw-flex-row tw-gap-1">
          <bit-skeleton class="tw-size-4" slot="start"></bit-skeleton>
          <bit-skeleton class="tw-size-4" slot="start"></bit-skeleton>
          <bit-skeleton class="tw-size-4" slot="start"></bit-skeleton>
        </div>
      </bit-skeleton-group>
    `,
  }),
};
