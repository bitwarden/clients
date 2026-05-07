import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./hello-world";

type Args = { name: string };

const meta: Meta<Args> = {
  title: "byte/Hello World",
  argTypes: {
    name: { control: "text" },
  },
  args: {
    name: "world",
  },
  render: ({ name }) => html`<bit-hello .name=${name}></bit-hello>`,
};

export default meta;

export const Default: StoryObj<Args> = {};
