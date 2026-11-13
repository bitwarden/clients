import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./color-password";

const examplePassword = "Wq$Jk😀7jlI  DX#rS5Sdi!z0O ";

type Args = { password: string; showCount: boolean };

export default {
  title: "Component Library/Color Password",
  component: "bit-color-password",
  args: { password: examplePassword, showCount: false },
  render: (args) =>
    html`<bit-color-password
      password=${args.password}
      ?show-count=${args.showCount}
    ></bit-color-password>`,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const ColorPassword: Story = {};

export const WrappedColorPassword: Story = {
  render: (args) => html`
    <div class="tw-max-w-32">
      <bit-color-password
        password=${args.password}
        ?show-count=${args.showCount}
      ></bit-color-password>
    </div>
  `,
};

export const ColorPasswordCount: Story = { args: { showCount: true } };

export const WrappedColorPasswordCount: Story = {
  ...WrappedColorPassword,
  args: { showCount: true },
};
