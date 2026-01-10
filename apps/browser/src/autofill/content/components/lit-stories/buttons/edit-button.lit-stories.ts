import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { EditButton, EditButtonProps } from "../../buttons/edit-button";

export default {
  title: "Components/Buttons/Edit Button",
  argTypes: {
    buttonAction: { control: false },
    buttonText: { control: "text" },
    disabled: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    buttonAction: () => alert("Clicked"),
    buttonText: "Click Me",
    disabled: false,
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=502-24633&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<EditButtonProps>;

const Template = (args: EditButtonProps) => EditButton({ ...args });

export const Default: StoryObj<EditButtonProps> = {
  render: Template,
};
