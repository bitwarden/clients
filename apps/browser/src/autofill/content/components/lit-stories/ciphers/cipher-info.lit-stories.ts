import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherInfo, CipherInfoProps } from "../../cipher/cipher-info";
import { mockCiphers } from "../mock-data";

export default {
  title: "Components/Ciphers/Cipher Info",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    cipher: mockCiphers[0],
    theme: ThemeTypes.Light,
  },
} as Meta<CipherInfoProps>;

const Template = (args: CipherInfoProps) => CipherInfo({ ...args });

export const Default: StoryObj<CipherInfoProps> = {
  render: Template,
};
