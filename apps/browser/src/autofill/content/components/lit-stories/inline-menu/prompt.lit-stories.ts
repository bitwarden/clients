import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { Lock, Plus } from "../../icons";
import { InlineMenuPrompt, InlineMenuPromptProps } from "../../inline-menu/prompt";
import { mockI18n } from "../mock-data";

type ComponentAndControls = Omit<InlineMenuPromptProps, "icon"> & {
  width: number;
  iconName: "plus" | "lock" | "none";
};

export default {
  title: "Components/Inline Menu/Prompt",
  argTypes: {
    message: { control: "text" },
    actionText: { control: "text" },
    iconName: { control: "select", options: ["plus", "lock", "none"] },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    handleAction: { control: false },
    width: { control: "number", min: 160, max: 480, step: 8 },
  },
  args: {
    message: mockI18n.noItemsToShow,
    actionText: mockI18n.newLogin,
    i18n: { actionAria: mockI18n.addNewLoginItemAria },
    iconName: "plus",
    theme: ThemeTypes.Light,
    handleAction: () => alert("Action"),
    width: 280,
  },
} as Meta<ComponentAndControls>;

const resolveIcon = (iconName: ComponentAndControls["iconName"]) => {
  if (iconName === "plus") {
    return Plus;
  }
  if (iconName === "lock") {
    return Lock;
  }
  return undefined;
};

const Template = (args: ComponentAndControls) => {
  const { width, iconName, ...componentProps } = args;
  return html`<div style="width: ${width}px;">
    ${InlineMenuPrompt({ ...componentProps, icon: resolveIcon(iconName) })}
  </div>`;
};

export const Empty: StoryObj<ComponentAndControls> = {
  args: {
    message: mockI18n.noItemsToShow,
    actionText: mockI18n.newLogin,
    i18n: { actionAria: mockI18n.addNewLoginItemAria },
    iconName: "plus",
    theme: ThemeTypes.Dark,
    dataTestId: "inline-menu-empty-state",
    actionDataTestId: "inline-menu-new-item-button",
  },
  render: Template,
};

export const Locked: StoryObj<ComponentAndControls> = {
  args: {
    message: mockI18n.unlockYourAccountToViewAutofillSuggestions,
    actionText: mockI18n.unlockAccount,
    i18n: { actionAria: mockI18n.unlockAccountAria },
    iconName: "lock",
    theme: ThemeTypes.Dark,
    dataTestId: "inline-menu-locked-state",
    actionDataTestId: "inline-menu-unlock-button",
  },
  render: Template,
};

export const SaveLogin: StoryObj<ComponentAndControls> = {
  args: {
    message: undefined,
    actionText: mockI18n.saveToBitwarden,
    i18n: {
      actionAria: `${mockI18n.saveToBitwarden}, ${mockI18n.opensInANewWindow}`,
    },
    iconName: "none",
    theme: ThemeTypes.Dark,
    dataTestId: "inline-menu-save-login",
    actionDataTestId: "inline-menu-save-login-button",
  },
  render: Template,
};
