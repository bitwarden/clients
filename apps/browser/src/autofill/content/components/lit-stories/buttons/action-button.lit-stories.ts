import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ActionButton, ActionButtonProps } from "../../buttons/action-button";

type ComponentAndControls = ActionButtonProps & { width: number };

export default {
  title: "Components/Buttons/Action Button",
  argTypes: {
    buttonText: { control: "text" },
    disabled: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    handleClick: { control: false },
    width: { control: "number", min: 10, max: 100, step: 1 },
  },
  args: {
    buttonText: "Click Me",
    disabled: false,
    isLoading: false,
    theme: ThemeTypes.Light,
    handleClick: () => alert("Clicked"),
    width: 150,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=487-14755&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<ComponentAndControls>;

const Template = (args: ComponentAndControls) => {
  const { width, ...componentProps } = args;
  return html`<div style="width: ${width}px;">${ActionButton({ ...componentProps })}</div>`;
};

export const Default: StoryObj<ComponentAndControls> = {
  args: {
    isLoading: true,
    theme: "dark",
  },

  render: Template,
};
