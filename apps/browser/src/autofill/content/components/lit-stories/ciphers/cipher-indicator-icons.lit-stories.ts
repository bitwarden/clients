import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import {
  CipherInfoIndicatorIcons,
  CipherInfoIndicatorIconsProps,
} from "../../cipher/cipher-indicator-icons";
import { OrganizationCategories } from "../../cipher/types";

export default {
  title: "Components/Ciphers/Cipher Indicator Icons",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    theme: ThemeTypes.Light,
    organizationCategories: [...Object.values(OrganizationCategories)],
  },
} as Meta<CipherInfoIndicatorIconsProps>;

const Template: StoryObj<CipherInfoIndicatorIconsProps>["render"] = (args) =>
  html`<div>${CipherInfoIndicatorIcons({ ...args })}</div>`;

export const Default: StoryObj<CipherInfoIndicatorIconsProps> = {
  render: Template,
};
