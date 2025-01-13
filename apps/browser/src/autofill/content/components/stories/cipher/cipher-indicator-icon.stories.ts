import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherInfoIndicatorIcons } from "../../cipher/cipher-indicator-icons";

export default {
  title: "Components/Cipher/Cipher Indicator Icon",
  argTypes: {
    isBusinessOrg: { control: "boolean" },
    isFamilyOrg: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    theme: ThemeTypes.Light,
    isBusinessOrg: true,
    isFamilyOrg: false,
  },
  parameters: {
    controls: {
      exclude: ["isFamilyOrg"],
    },
  },
} as Meta;

type Story = StoryObj;

const Template = (args: any) => {
  args.isFamilyOrg = !args.isBusinessOrg;
  return CipherInfoIndicatorIcons({ ...args });
};

export const Default: Story = {
  render: Template,
};
