import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./kbd";

type Args = { keys: string[] };

export default {
  title: "Component Library/Kbd",
  component: "bit-kbd",
  args: { keys: ["modifier", "F"] },
  render: (args) => html`<bit-kbd .keys=${args.keys}></bit-kbd>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const SingleKey: Story = { args: { keys: ["Esc"] } };

export const WithControl: Story = {
  render: () => html`
    <label class="tw-flex tw-items-center tw-gap-2">
      Search
      <input type="search" class="tw-border tw-p-1" aria-keyshortcuts="Control+f Meta+f" />
      <span aria-hidden="true"><bit-kbd .keys=${["modifier", "F"]}></bit-kbd></span>
    </label>
  `,
};
