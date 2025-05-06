import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import {
  NotificationConfirmationFooter,
  NotificationConfirmationFooterProps,
} from "../../../notification/confirmation/footer";

export default {
  title: "Components/Notifications/Confirmation/Footer",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    handleButtonClick: () => alert("Action button triggered"),
    i18n: {
      nextSecurityTaskAction: "Change next password",
    },
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-4949&m=dev",
    },
  },
} as Meta<NotificationConfirmationFooterProps>;

const Template = (args: NotificationConfirmationFooterProps) =>
  html`<div style="max-width:400px;">${NotificationConfirmationFooter({ ...args })}</div>`;

export const Default: StoryObj<NotificationConfirmationFooterProps> = {
  render: Template,
};
