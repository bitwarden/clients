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

const baseArgs: ComponentAndControls = {
  message: mockI18n.noItemsToShow,
  actionText: mockI18n.newLogin,
  i18n: { actionAria: mockI18n.addNewLoginItemAria },
  iconName: "plus",
  theme: ThemeTypes.Light,
  handleAction: () => alert("Action"),
  width: 280,
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
  args: baseArgs,
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
    dataTestId: "inline-menu-empty-state",
    actionDataTestId: "inline-menu-new-item-button",
  },
  render: Template,
};

export const EmptyCard: StoryObj<ComponentAndControls> = {
  args: {
    actionText: mockI18n.newCard,
    i18n: { actionAria: mockI18n.addNewCardItemAria },
    dataTestId: "inline-menu-empty-state",
    actionDataTestId: "inline-menu-new-item-button",
  },
  render: Template,
};

export const EmptyIdentity: StoryObj<ComponentAndControls> = {
  args: {
    actionText: mockI18n.newIdentity,
    i18n: { actionAria: mockI18n.addNewIdentityItemAria },
    dataTestId: "inline-menu-empty-state",
    actionDataTestId: "inline-menu-new-item-button",
  },
  render: Template,
};

export const EmptyNewItem: StoryObj<ComponentAndControls> = {
  args: {
    actionText: mockI18n.newItem,
    i18n: { actionAria: mockI18n.addNewVaultItem },
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
    dataTestId: "inline-menu-save-login",
    actionDataTestId: "inline-menu-save-login-button",
  },
  render: Template,
};
