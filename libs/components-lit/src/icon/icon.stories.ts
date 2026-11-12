import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "./icon";

type Args = { name: string; label?: string; fixedWidth: boolean };

export default {
  title: "Component Library/Icon",
  component: "bit-icon",
  args: { name: "bwi-lock", fixedWidth: false },
  render: (args) =>
    html`<bit-icon
      name=${args.name}
      label=${args.label ?? nothing}
      ?fixed-width=${args.fixedWidth}
    ></bit-icon>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Decorative: Story = {};

export const WithLabel: Story = { args: { name: "bwi-star-f", label: "Favorite" } };

export const InheritsSizeAndColor: Story = {
  render: () => html`
    <div class="tw-flex tw-items-center tw-gap-4">
      <bit-icon name="bwi-lock" class="tw-text-sm"></bit-icon>
      <bit-icon name="bwi-lock" class="tw-text-2xl tw-text-fg-brand"></bit-icon>
      <bit-icon name="bwi-lock" class="tw-text-3xl tw-text-fg-danger"></bit-icon>
    </div>
  `,
};

export const FixedWidth: Story = {
  render: () => html`
    <ul class="tw-list-none tw-ps-0">
      <li><bit-icon name="bwi-globe" fixed-width></bit-icon> Globe</li>
      <li><bit-icon name="bwi-key" fixed-width></bit-icon> Key</li>
      <li><bit-icon name="bwi-id-card" fixed-width></bit-icon> ID card</li>
    </ul>
  `,
};
