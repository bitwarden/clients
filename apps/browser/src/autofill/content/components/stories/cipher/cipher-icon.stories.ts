import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherIcon } from "../../cipher/cipher-icon";

export default {
  title: "Components/Cipher/Cipher Icon",
  argTypes: {
    color: { control: "color" },
    size: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    uri: { control: "text" },
  },
  args: {
    size: "50px",
    theme: ThemeTypes.Light,
    uri: "",
  },
} as Meta;

type Story = StoryObj;

const Template = (args: any) => {
  return html`
    <div style="width: ${args.size}; height: ${args.size}; overflow: hidden;">
      ${CipherIcon({ ...args })}
    </div>
  `;
};

export const Default: Story = {
  render: Template,
};
