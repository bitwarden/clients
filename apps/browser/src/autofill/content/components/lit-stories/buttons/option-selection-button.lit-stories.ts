import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import {
  OptionSelectionButton,
  OptionSelectionButtonProps,
} from "../../buttons/option-selection-button";

export default {
  title: "Components/Buttons/Option Selection Button",
  argTypes: {
    disabled: { control: "boolean" },
    handleButtonClick: { control: false },
    id: { control: "text" },
    text: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    toggledOn: { control: "boolean" },
  },
  args: {
    disabled: false,
    handleButtonClick: () => alert("Clicked"),
    id: "example-id",
    text: "Click Me",
    theme: ThemeTypes.Light,
    toggledOn: false,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=502-24633&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<OptionSelectionButtonProps>;

const Template = (args: OptionSelectionButtonProps) => OptionSelectionButton({ ...args });

export const Default: StoryObj<OptionSelectionButtonProps> = {
  render: Template,
};
