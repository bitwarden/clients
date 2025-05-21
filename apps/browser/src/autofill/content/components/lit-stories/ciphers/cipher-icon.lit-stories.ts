import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherIcon, CipherIconProps } from "../../cipher/cipher-icon";

export default {
  title: "Components/Ciphers/Cipher Icon",
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
} as Meta<CipherIconProps>;

const Template = (args: CipherIconProps) => {
  return html`
    <div style="width: ${args.size}; height: ${args.size}; overflow: hidden;">
      ${CipherIcon({ ...args })}
    </div>
  `;
};

export const Default: StoryObj<CipherIconProps> = {
  render: Template,
};
