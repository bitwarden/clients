import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherIcon } from "../../cipher/cipher-icon";

type Args = {
  color: string;
  size: string;
  theme: Theme;
  uri?: string;
};

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
} as Meta<Args>;

const Template = (args: Args) => {
  return html`
    <div style="width: ${args.size}; height: ${args.size}; overflow: hidden;">
      ${CipherIcon({ ...args })}
    </div>
  `;
};

export const Default: StoryObj<Args> = {
  render: Template,
};
