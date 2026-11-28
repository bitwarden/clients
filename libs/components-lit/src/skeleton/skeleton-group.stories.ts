import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./skeleton";
import "./skeleton-group";
import "./skeleton-text";

export default {
  title: "Component Library/Skeleton/Skeleton Group",
  component: "bit-skeleton-group",
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <bit-skeleton-group>
      <bit-skeleton class="tw-size-8" slot="start"></bit-skeleton>
      <bit-skeleton-text lines="2" class="tw-w-1/2"></bit-skeleton-text>
      <bit-skeleton-text lines="1" slot="end" class="tw-w-1/4"></bit-skeleton-text>
    </bit-skeleton-group>
  `,
};

export const NoEndSlot: Story = {
  render: () => html`
    <bit-skeleton-group>
      <bit-skeleton class="tw-size-8" slot="start"></bit-skeleton>
      <bit-skeleton-text lines="2" class="tw-w-1/2"></bit-skeleton-text>
    </bit-skeleton-group>
  `,
};

export const NoStartSlot: Story = {
  render: () => html`
    <bit-skeleton-group>
      <bit-skeleton-text lines="2" class="tw-w-1/2"></bit-skeleton-text>
      <bit-skeleton-text lines="1" slot="end" class="tw-w-1/4"></bit-skeleton-text>
    </bit-skeleton-group>
  `,
};

export const CustomContent: Story = {
  render: () => html`
    <bit-skeleton-group>
      <bit-skeleton class="tw-size-12" slot="start" edge-shape="circle"></bit-skeleton>
      <bit-skeleton-text lines="3" class="tw-w-full"></bit-skeleton-text>
      <div slot="end" class="tw-flex tw-flex-row tw-gap-1">
        <bit-skeleton class="tw-size-4"></bit-skeleton>
        <bit-skeleton class="tw-size-4"></bit-skeleton>
        <bit-skeleton class="tw-size-4"></bit-skeleton>
      </div>
    </bit-skeleton-group>
  `,
};
