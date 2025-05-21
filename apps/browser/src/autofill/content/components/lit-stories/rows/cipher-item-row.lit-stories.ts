import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CipherItemRow, CipherItemRowProps } from "../../rows/cipher-item-row";

export default {
  title: "Components/Rows/Cipher Item Row",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    children: { control: "object" },
  },
  args: {
    theme: ThemeTypes.Light,
  },
} as Meta<CipherItemRowProps>;

const Template = (props: CipherItemRowProps) => CipherItemRow({ ...props });

export const Default: StoryObj<CipherItemRowProps> = {
  render: Template,
};
