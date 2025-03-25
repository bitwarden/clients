import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherInfoIndicatorIcons } from "../../cipher/cipher-indicator-icons";

type Args = {
  showBusinessIcon?: boolean;
  showFamilyIcon?: boolean;
  theme: Theme;
};

export default {
  title: "Components/Ciphers/Cipher Indicator Icon",
  argTypes: {
    showBusinessIcon: { control: "boolean" },
    showFamilyIcon: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    theme: ThemeTypes.Light,
    showBusinessIcon: true,
    showFamilyIcon: false,
  },
} as Meta<Args>;

const Template: StoryObj<Args>["render"] = (args) =>
  html`<div>${CipherInfoIndicatorIcons({ ...args })}</div>`;

export const Default: StoryObj<Args> = {
  render: Template,
};
